-- ExcelToGo — take away EXECUTE on the helper functions from roles that have no use for it.
--
-- Hardening, not a fix: nothing here was reachable in a way that mattered. Supabase's security
-- advisor lists every `security definer` function that `anon` can call through `/rest/v1/rpc/…`,
-- and three of ours were on it:
--
--   can_access_workbook(uuid), owns_workbook(uuid)
--     Both answer from `auth.uid()` and the email in the caller's token, so a caller who is not
--     signed in always got `false`. The row-level security policies call them with the caller's
--     own rights, so a signed-in caller (`authenticated`) must keep EXECUTE; `public` and `anon`
--     have no reason to hold it.
--
--   snapshot_workbook()
--     A trigger function. Postgres does not check EXECUTE when a trigger fires, so nobody needs
--     it, and calling it by hand has never done anything but fail.
--
-- `bump_usage` is left alone on purpose: `anon` calling it is the whole design of the counter.
--
-- One thing had to change first. Six policies in `0002`–`0003` were written without a `to` clause,
-- which means `to public` — and `public` includes `anon`. Postgres checks EXECUTE on a function a
-- policy calls as the caller, so with the grants below and those policies unchanged, a signed-out
-- request that touched these tables would fail with "permission denied for function" instead of
-- quietly seeing nothing. Scoping each of them to `authenticated` keeps that answer the same: no
-- policy applies to `anon`, and row-level security with no policy is an empty result. The two live
-- channel policies were already `to authenticated`; the four owner-only policies in `0001` call no
-- function and are not touched.
--
-- Safe to run more than once: `alter policy` and `revoke`/`grant` all leave the same end state.

alter policy "workbooks are readable by their owner or a member" on public.workbooks to authenticated;
alter policy "workbooks are updated by their owner or a member" on public.workbooks to authenticated;
alter policy "members are visible to the workbook's people" on public.workbook_members to authenticated;
alter policy "only the owner invites" on public.workbook_members to authenticated;
alter policy "only the owner removes" on public.workbook_members to authenticated;
alter policy "versions are readable by the workbook's people" on public.workbook_versions to authenticated;

revoke execute on function public.can_access_workbook(uuid) from public, anon;
grant execute on function public.can_access_workbook(uuid) to authenticated;

revoke execute on function public.owns_workbook(uuid) from public, anon;
grant execute on function public.owns_workbook(uuid) to authenticated;

revoke execute on function public.snapshot_workbook() from public, anon, authenticated;
