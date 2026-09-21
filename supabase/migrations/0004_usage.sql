-- ExcelToGo — counting that the app was used, without learning who used it.
--
-- Optional, and independent of everything above it: a deployment that only wants a usage count
-- can run this file alone, and one that wants cloud save but no counting can skip it. Nothing in
-- `0001`–`0003` refers to this table.
--
-- The question is the smallest useful one — has anyone actually used this, or am I looking at my
-- own visits — and the answer is allowed to be a number and nothing else. What is stored is one
-- row per day per event, holding a count. There is no row per visit, so there is nothing to
-- correlate, aggregate or subpoena: not by a stranger, not by whoever owns this database.

create table if not exists public.usage_counts (
  -- Stamped by the database, never sent by the browser. A date that arrives over the network is a
  -- field somebody eventually makes more precise, and an exact time plus a rare event is an
  -- identifier.
  day   date not null default current_date,
  event text not null,
  count bigint not null default 0,
  primary key (day, event)
);

alter table public.usage_counts enable row level security;

-- Deliberately no policy of any kind. Not an oversight and not a stricter version of one: the key
-- the server holds may call the function below and may do nothing else, so the same key leaking
-- does not read back a single row. The owner reads this table in the Supabase dashboard, where a
-- policy has never applied.
--
-- `check:rls` would otherwise ask why a table has RLS on and no policy; it is told about this one
-- by name, because "enabled with nothing written" is exactly the shape that is usually a bug.

/**
 * Adds one to today's count for an event, and refuses anything that is not one.
 *
 * The list is repeated here rather than referenced from the application, and that repetition is
 * the point: this is the third place it is checked and the only one an attacker cannot skip by
 * not using the browser. A free-text event column would make this table a place to put a
 * spreadsheet, reachable by anyone who can reach the deployment's own origin.
 *
 * `security definer` so the caller needs no rights on the table at all, with `search_path` pinned
 * the way every definer function in this project is — an unpinned one runs whatever a caller's
 * schema happens to shadow.
 */
create or replace function public.bump_usage(p_event text)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_event is null or p_event not in (
    'app_opened', 'formula_entered', 'file_imported', 'file_exported', 'ai_asked', 'live_data_inserted'
  ) then
    return;
  end if;

  insert into public.usage_counts (day, event, count)
  values (current_date, p_event, 1)
  on conflict (day, event) do update set count = public.usage_counts.count + 1;
end;
$$;

-- The one thing the deployment's key is allowed to do. `revoke` first because `public` is granted
-- execute on a new function by default, and a default is not a decision.
revoke all on function public.bump_usage(text) from public;
grant execute on function public.bump_usage(text) to anon, authenticated;

-- Read it back with, for example:
--   select day, event, count from public.usage_counts order by day desc, count desc;
