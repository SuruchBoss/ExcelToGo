import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The row-level security policies, read as text.
 *
 * Nobody running this suite has a database, so nothing here proves that Postgres *enforces*
 * anything — `scripts/check-rls.mjs` does that, against a real project, when someone points it at
 * one. What these tests do is cheaper and still worth having: they notice when a policy is
 * deleted, loosened, or written in a shape that does not do what its name says.
 *
 * That is not a theoretical failure. `alter table ... enable row level security` is one line, and
 * a table without it answers every question anyone asks — a policy file can look complete while
 * protecting nothing. So the line itself is a test.
 */
const sql = (file: string) => readFileSync(new URL(`../../../supabase/migrations/${file}`, import.meta.url), "utf8");
const workbooks = sql("0001_workbooks.sql");
const sharing = sql("0002_sharing_and_realtime.sql");
const both = `${workbooks}\n${sharing}`;

/** Policies as written, so a test can ask about one by name rather than grepping for a substring. */
function policies(text: string) {
  const found = new Map<string, { on: string; verb: string; body: string }>();
  const re = /create policy\s+"([^"]+)"\s+on\s+([\w.]+)\s+for\s+(\w+)([\s\S]*?);/gi;
  for (const m of text.matchAll(re)) {
    found.set(m[1], { on: m[2], verb: m[3].toLowerCase(), body: m[4] });
  }
  return found;
}

const all = policies(both);

describe("row-level security is actually switched on", () => {
  it("is enabled on both tables", () => {
    // One missing line and the table answers everyone. The policies below would still read as if
    // they were doing something.
    expect(workbooks).toMatch(/alter table public\.workbooks enable row level security/i);
    expect(sharing).toMatch(/alter table public\.workbook_members enable row level security/i);
  });

  it("never enables it without also writing a policy for that table", () => {
    const enabled = [...both.matchAll(/alter table ([\w.]+) enable row level security/gi)].map((m) => m[1]);
    for (const table of enabled) {
      expect([...all.values()].some((p) => p.on === table)).toBe(true);
    }
  });
});

describe("what each verb on a workbook allows", () => {
  const verbs = [...all.values()].filter((p) => p.on === "public.workbooks").map((p) => p.verb);

  it("spells out all four rather than one policy for all", () => {
    // Four policies rather than `for all` so that reading the list says what an anonymous visitor
    // can do, which is nothing.
    expect(new Set(verbs)).toEqual(new Set(["select", "insert", "update", "delete"]));
  });

  it("lets a member read and write, and only the owner create or destroy", () => {
    const by = Object.fromEntries([...all.values()].filter((p) => p.on === "public.workbooks").map((p) => [p.verb, p.body]));
    expect(by.select).toContain("can_access_workbook");
    expect(by.update).toContain("can_access_workbook");
    expect(by.insert).toContain("auth.uid() = user_id");
    expect(by.delete).toContain("auth.uid() = user_id");
  });

  it("checks the row on the way out as well as on the way in when updating", () => {
    // `using` decides which rows may be updated; without `with check` an update could hand the row
    // to somebody else — and a member who may edit must not be able to edit it into being theirs.
    const update = [...all.values()].find((p) => p.on === "public.workbooks" && p.verb === "update")!;
    expect(update.body).toMatch(/with check/i);
    expect(sharing).toMatch(/a workbook cannot change owner/);
    expect(sharing).toMatch(/before update on public\.workbooks/i);
  });
});

describe("who may invite", () => {
  it("lets the people on a workbook see each other", () => {
    const select = [...all.values()].find((p) => p.on === "public.workbook_members" && p.verb === "select")!;
    expect(select.body).toContain("can_access_workbook");
  });

  it("keeps inviting and removing to the owner", () => {
    // Otherwise a guest could invite the rest of the internet to somebody else's spreadsheet.
    const insert = [...all.values()].find((p) => p.on === "public.workbook_members" && p.verb === "insert")!;
    const del = [...all.values()].find((p) => p.on === "public.workbook_members" && p.verb === "delete")!;
    expect(insert.body).toContain("owns_workbook");
    expect(insert.body).toContain("invited_by = auth.uid()");
    expect(del.body).toContain("owns_workbook");
  });
});

describe("the live channel", () => {
  it("decides listening and speaking separately", () => {
    const onMessages = [...all.values()].filter((p) => p.on === "realtime.messages");
    expect(new Set(onMessages.map((p) => p.verb))).toEqual(new Set(["select", "insert"]));
  });

  it("asks the same question the workbook itself asks", () => {
    // A channel with its own idea of who belongs is a second answer to the same question, and the
    // two would drift.
    for (const policy of [...all.values()].filter((p) => p.on === "realtime.messages")) {
      expect(policy.body).toContain("can_access_workbook");
      expect(policy.body).toContain("workbook_id_from_topic");
    }
  });

  it("is granted to signed-in callers, not to everyone", () => {
    for (const policy of [...all.values()].filter((p) => p.on === "realtime.messages")) {
      expect(policy.body).toMatch(/to authenticated/i);
    }
  });
});

describe("the helper functions the policies lean on", () => {
  it("run as their definer, with the search path pinned", () => {
    // `security definer` is needed here to break the recursion between the two tables' policies.
    // A definer function that resolves names through the caller's search_path is how privilege
    // escalation happens, so the two always appear together.
    const definers = [...sharing.matchAll(/create or replace function ([\s\S]*?)\$\$/g)]
      .map((m) => m[1])
      .filter((body) => /security definer/i.test(body));
    expect(definers.length).toBeGreaterThan(0);
    for (const body of definers) expect(body).toMatch(/set search_path = public, pg_temp/i);
  });
});

describe("shapes that would quietly allow everything", () => {
  it("has no policy that just says true", () => {
    for (const [name, policy] of all) {
      expect(`${name}: ${policy.body.replace(/\s+/g, " ")}`).not.toMatch(/(using|with check)\s*\(\s*true\s*\)/i);
    }
  });

  it("has no policy granted to anon", () => {
    for (const [name, policy] of all) {
      expect(`${name}: ${policy.body}`).not.toMatch(/to\s+(anon|public)\b/i);
    }
  });
});
