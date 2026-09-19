-- ExcelToGo — version history for cloud workbooks.
--
-- Run this after `0002_sharing_and_realtime.sql`, against YOUR OWN Supabase project.
--
-- Saving over a workbook was final. The app warns before overwriting a *newer* save from another
-- device, which is a different problem and already solved; what it could not do was answer "what
-- did this look like yesterday, before I deleted that column". The conflict warning implies an
-- answer to that — it tells you a version you have not seen exists — and then there was nowhere to
-- look.
--
-- Kept in the database rather than in the browser on purpose: the point of a version is to survive
-- the machine that made it.

create table if not exists public.workbook_versions (
  id          uuid primary key default gen_random_uuid(),
  workbook_id uuid not null references public.workbooks (id) on delete cascade,
  -- The workbook as it was *before* the save that replaced it, with the name it had then: a
  -- version whose name is the current one is no use for telling two of them apart in a list.
  name        text not null,
  data        jsonb not null,
  -- Who was signed in when it was replaced. Null once that account is gone, rather than taking the
  -- version with it — the history of a shared workbook should outlive one member leaving.
  saved_by    uuid references auth.users (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- The listing is always "this workbook's versions, newest first".
create index if not exists workbook_versions_recent_idx
  on public.workbook_versions (workbook_id, created_at desc);

/**
 * How many versions to keep per workbook.
 *
 * A workbook is one jsonb document, so a version is a whole copy — thirty of them is thirty times
 * the row. Twenty is enough to cover "yesterday" and "before that big paste" without turning a
 * personal project's database into a backup service by accident.
 */
create or replace function public.snapshot_workbook()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  -- Only when the document actually changed. Renaming a workbook, or a save that writes the same
  -- jsonb back, should not push a real version out of the window.
  if new.data is not distinct from old.data then
    return new;
  end if;

  insert into public.workbook_versions (workbook_id, name, data, saved_by)
  values (old.id, old.name, old.data, auth.uid());

  delete from public.workbook_versions v
  where v.workbook_id = old.id
    and v.id not in (
      select id from public.workbook_versions
      where workbook_id = old.id
      order by created_at desc
      limit 20
    );

  return new;
end;
$$;

-- Before the update, so `old` is still the document being replaced.
drop trigger if exists workbooks_snapshot on public.workbooks;
create trigger workbooks_snapshot
  before update on public.workbooks
  for each row execute function public.snapshot_workbook();

alter table public.workbook_versions enable row level security;

-- Readable by whoever can open the workbook, and by nobody else. There is deliberately no insert,
-- update or delete policy: rows appear only through the trigger above, which runs as its definer,
-- and a client that could write here could forge a history.
drop policy if exists "versions are readable by the workbook's people" on public.workbook_versions;
create policy "versions are readable by the workbook's people"
  on public.workbook_versions for select
  using (public.can_access_workbook(workbook_id));
