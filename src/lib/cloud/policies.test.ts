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
const versions = sql("0003_versions.sql");
const usage = sql("0004_usage.sql");
const both = `${workbooks}\n${sharing}\n${versions}\n${usage}`;

/**
 * The one table that has row-level security on and no policy, on purpose.
 *
 * Written down here, by name, rather than left out of the corpus: "enabled with nothing written"
 * is exactly the shape that is usually a bug, so the rule below still applies to every other
 * table and this is the single documented exception rather than a hole in the check.
 */
const RLS_WITHOUT_POLICY = ["public.usage_counts"];

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
    for (const table of enabled.filter((t) => !RLS_WITHOUT_POLICY.includes(t))) {
      expect([...all.values()].some((p) => p.on === table)).toBe(true);
    }
  });

  it("is on for the usage counter too, which has no policy by design", () => {
    // No policy of any kind, so the key the server holds cannot read a row back — it may call
    // `bump_usage` and nothing else. The exception is listed above rather than silently skipped.
    expect(usage).toMatch(/alter table public\.usage_counts enable row level security/i);
    expect([...all.values()].some((p) => p.on === "public.usage_counts")).toBe(false);
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

describe("version history", () => {
  it("has row-level security on, like everything else", () => {
    expect(versions).toMatch(/alter table public\.workbook_versions enable row level security/i);
  });

  it("is readable by the workbook's people and nobody else", () => {
    const policy = [...all.values()].find((p) => p.on === "public.workbook_versions")!;
    expect(policy.verb).toBe("select");
    expect(policy.body).toContain("can_access_workbook");
  });

  it("has no insert, update or delete policy at all", () => {
    // Rows appear only through the trigger, which runs as its definer. A client that could write
    // here could forge a history, and a history that can be forged is not a history.
    const verbs = [...all.values()].filter((p) => p.on === "public.workbook_versions").map((p) => p.verb);
    expect(verbs).toEqual(["select"]);
  });

  it("snapshots the document being replaced, not the one replacing it", () => {
    // `before update` and `old` together: `after`, or `new`, would store the version that is
    // already on screen and lose the one worth keeping.
    expect(versions).toMatch(/before update on public\.workbooks/i);
    expect(versions).toContain("old.data");
  });

  it("does not make a version out of a rename", () => {
    expect(versions).toContain("new.data is not distinct from old.data");
  });

  it("keeps the window bounded, so a personal project is not a backup service", () => {
    expect(versions).toMatch(/limit 20/i);
    expect(versions).toMatch(/delete from public\.workbook_versions/i);
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

describe("the usage counter, which must not become a place to put a spreadsheet", () => {
  it("names the events it accepts instead of taking any text", () => {
    // The third place this list is checked, and the only one an attacker cannot skip by not using
    // the browser. A free-text event column would make this table reachable storage for anyone
    // who can reach the deployment's own origin.
    for (const event of ["app_opened", "formula_entered", "file_imported", "file_exported", "ai_asked", "live_data_inserted"]) {
      expect(usage).toContain(`'${event}'`);
    }
    expect(usage).toMatch(/p_event not in \(/i);
  });

  it("stamps the day itself rather than believing the caller", () => {
    // A date that arrives over the network is a field somebody eventually makes more precise, and
    // an exact time plus a rare event is an identifier.
    expect(usage).toMatch(/day\s+date not null default current_date/i);
    expect(usage).toMatch(/values \(current_date, p_event, 1\)/i);
    // One argument, and it is the event.
    expect(usage).toMatch(/function public\.bump_usage\(p_event text\)/i);
  });

  it("stores a count and nothing that could be a person", () => {
    const columns = /create table if not exists public\.usage_counts \(([\s\S]*?)\);/i.exec(usage)![1];
    for (const forbidden of ["ip", "user_agent", "session", "uuid", "auth.uid", "timestamptz", "referrer"]) {
      expect(columns.toLowerCase()).not.toContain(forbidden);
    }
  });

  it("runs as its definer with the search path pinned, like every other one here", () => {
    expect(usage).toMatch(/security definer/i);
    expect(usage).toMatch(/set search_path = public, pg_temp/i);
  });

  it("takes the default grant away before giving the one it means", () => {
    // Postgres grants execute on a new function to `public` by default, and a default is not a
    // decision — without the revoke, "granted to anon" would be true for reasons nobody chose.
    const revokeAt = usage.search(/revoke all on function public\.bump_usage/i);
    const grantAt = usage.search(/grant execute on function public\.bump_usage/i);
    expect(revokeAt).toBeGreaterThan(-1);
    expect(grantAt).toBeGreaterThan(revokeAt);
  });
});
