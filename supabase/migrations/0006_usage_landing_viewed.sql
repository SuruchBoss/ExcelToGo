-- ExcelToGo — count a view of the landing page, apart from opening the app.
--
-- Adds one name to the list `bump_usage` accepts, and changes nothing else: the table, the grants
-- and the rule that anything not on the list is ignored all stay as `0004` left them. The two page
-- loads answer different questions — how many visits the link got, and how many of those went on
-- to open the app — so they are counted apart.
--
-- Safe to run against a project that already has `0004`: `create or replace` keeps the function's
-- owner and grants. The grant is restated anyway, so this file reads as complete on its own.

create or replace function public.bump_usage(p_event text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event is null or p_event not in (
    'landing_viewed', 'app_opened', 'formula_entered', 'file_imported', 'file_exported', 'ai_asked', 'live_data_inserted'
  ) then
    return;
  end if;

  insert into public.usage_counts (day, event, count)
  values (current_date, p_event, 1)
  on conflict (day, event) do update set count = public.usage_counts.count + 1;
end;
$$;

revoke all on function public.bump_usage(text) from public;
grant execute on function public.bump_usage(text) to anon, authenticated;
