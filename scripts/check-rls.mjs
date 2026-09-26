#!/usr/bin/env node
// Copyright 2026 Suruch Chakrapeesirisuk
// SPDX-License-Identifier: Apache-2.0

/**
 * The other half of the row-level-security tests: does Postgres actually refuse?
 *
 * `src/lib/cloud/policies.test.ts` reads the migrations and checks their shape. That catches a
 * policy being deleted or loosened, and it runs everywhere, because it needs nothing. What it
 * cannot do is prove the database behaves the way the text implies — a policy can be present,
 * well-shaped, and still not do what its author thought.
 *
 * So this one signs in as two real accounts on a real project and tries the things that must fail.
 * It needs a project, two mailboxes and a willingness to write rows, which is why it is not part
 * of `verify`: it is run deliberately, against a project you own, the way `check:ai` is.
 *
 *   NEXT_PUBLIC_SUPABASE_URL=… NEXT_PUBLIC_SUPABASE_ANON_KEY=… \
 *   RLS_USER_A_EMAIL=… RLS_USER_A_PASSWORD=… \
 *   RLS_USER_B_EMAIL=… RLS_USER_B_PASSWORD=… \
 *   npm run check:rls
 *
 * Both accounts need to exist with those passwords (create them in the Supabase dashboard, or via
 * the auth admin API). Nothing here creates an account: a script that can make users is a script
 * that can make one on the wrong project.
 */
const need = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "RLS_USER_A_EMAIL",
  "RLS_USER_A_PASSWORD",
  "RLS_USER_B_EMAIL",
  "RLS_USER_B_PASSWORD",
];
const missing = need.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.log("check:rls — not configured, so nothing was checked.");
  console.log(`  missing: ${missing.join(", ")}`);
  console.log("  See the comment at the top of this file for what it needs and why it is not in `verify`.");
  process.exit(0);
}

const { createClient } = await import("@supabase/supabase-js");
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let failures = 0;
const ok = (pass, what, detail = "") => {
  console.log(`  ${pass ? "ok  " : "FAIL"}  ${what}${detail ? ` — ${detail}` : ""}`);
  if (!pass) failures++;
};

async function signIn(email, password) {
  const client = createClient(URL_, KEY, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`could not sign in as ${email}: ${error.message}`);
  return { client, id: data.user.id, email };
}

const a = await signIn(process.env.RLS_USER_A_EMAIL, process.env.RLS_USER_A_PASSWORD);
const b = await signIn(process.env.RLS_USER_B_EMAIL, process.env.RLS_USER_B_PASSWORD);
console.log(`check:rls — signed in as two accounts on ${new URL(URL_).host}\n`);

const made = [];
try {
  const { data: mine, error } = await a.client
    .from("workbooks")
    .insert({ name: "rls probe", user_id: a.id, data: { format: 1, sheets: [] } })
    .select("id")
    .single();
  if (error) throw new Error(`A could not create its own workbook: ${error.message}`);
  made.push(mine.id);

  // The rule the whole feature rests on.
  const { data: seen } = await b.client.from("workbooks").select("id").eq("id", mine.id);
  ok((seen ?? []).length === 0, "B cannot read a workbook A has not shared");

  const { error: wrote } = await b.client.from("workbooks").update({ name: "taken" }).eq("id", mine.id);
  const { data: after } = await a.client.from("workbooks").select("name").eq("id", mine.id).single();
  ok(after?.name === "rls probe", "B cannot rename it", wrote ? wrote.message : "no error was raised, but nothing changed");

  const { error: planted } = await b.client
    .from("workbooks")
    .insert({ name: "planted", user_id: a.id, data: { format: 1, sheets: [] } });
  ok(Boolean(planted), "B cannot create a workbook owned by A", planted?.message);

  const { error: invited } = await b.client
    .from("workbook_members")
    .insert({ workbook_id: mine.id, email: "someone@example.com", invited_by: b.id });
  ok(Boolean(invited), "B cannot invite anyone to A's workbook", invited?.message);

  // Now share it, and check the door opens exactly as far as it should.
  const { error: share } = await a.client
    .from("workbook_members")
    .insert({ workbook_id: mine.id, email: b.email, invited_by: a.id });
  if (share) throw new Error(`A could not share with B: ${share.message}`);

  const { data: nowSeen } = await b.client.from("workbooks").select("id,name").eq("id", mine.id);
  ok((nowSeen ?? []).length === 1, "B can read it once shared");

  const { error: edit } = await b.client.from("workbooks").update({ name: "edited by B" }).eq("id", mine.id);
  const { data: edited } = await a.client.from("workbooks").select("name").eq("id", mine.id).single();
  ok(!edit && edited?.name === "edited by B", "B can edit it once shared", edit?.message);

  const { error: stolen } = await b.client.from("workbooks").update({ user_id: b.id }).eq("id", mine.id);
  const { data: owner } = await a.client.from("workbooks").select("user_id").eq("id", mine.id).single();
  ok(owner?.user_id === a.id, "B cannot make a shared workbook theirs", stolen?.message);

  const { error: deleted } = await b.client.from("workbooks").delete().eq("id", mine.id);
  const { data: alive } = await a.client.from("workbooks").select("id").eq("id", mine.id);
  ok((alive ?? []).length === 1, "B cannot delete it", deleted?.message);

  // The live channel, which is the part that was public before `0002`.
  const channel = b.client.channel(`workbook:${mine.id}`, { config: { private: true } });
  await b.client.realtime.setAuth();
  const joined = await new Promise((resolve) => {
    channel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(status);
    });
    setTimeout(() => resolve("TIMED_OUT"), 8000);
  });
  ok(joined === "SUBSCRIBED", "B can join the channel of a workbook shared with them", joined);
  await b.client.removeChannel(channel);

  const stranger = createClient(URL_, KEY, { auth: { persistSession: false } });
  const strangerChannel = stranger.channel(`workbook:${mine.id}`, { config: { private: true } });
  const strangerJoined = await new Promise((resolve) => {
    strangerChannel.subscribe((status) => {
      if (status === "SUBSCRIBED" || status === "CHANNEL_ERROR" || status === "TIMED_OUT") resolve(status);
    });
    setTimeout(() => resolve("TIMED_OUT"), 8000);
  });
  ok(strangerJoined !== "SUBSCRIBED", "a caller with only the anon key cannot join it", strangerJoined);
  await stranger.removeChannel(strangerChannel);
} finally {
  for (const id of made) await a.client.from("workbooks").delete().eq("id", id);
}

console.log(`\ncheck:rls — ${failures === 0 ? "the database refuses everything it should" : `${failures} check(s) failed`}`);
process.exit(failures === 0 ? 0 : 1);
