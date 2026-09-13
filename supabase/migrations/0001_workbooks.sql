-- ExcelToGo — cloud save schema.
--
-- Run this once against YOUR OWN Supabase project. ExcelToGo does not host a database; this file is
-- how you get one of your own. Either paste it into the SQL editor in the Supabase dashboard, or
-- run `supabase db push` with the CLI from the repository root.
--
-- Everything below assumes Supabase Auth is providing `auth.uid()`. Row-level security is what
-- keeps one account's spreadsheets away from another's — it is not optional, and the policies are
-- written so that a browser holding the anon key cannot reach past its own rows even though it
-- talks to the database directly.

create table if not exists public.workbooks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 200),
  -- The whole workbook: every tab, its cells, formats, charts and comments. jsonb rather than a
  -- table per concept because the app already treats a workbook as one document, and splitting it
  -- would buy queries nobody makes at the cost of a migration every time a feature is added.
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- The listing is always "my workbooks, newest first", so that is the index.
create index if not exists workbooks_user_updated_idx
  on public.workbooks (user_id, updated_at desc);

-- Stamp updated_at server-side as well as from the client: a client that forgets, or lies, must not
-- be able to make its own write look older than it is and defeat the conflict check.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists workbooks_touch_updated_at on public.workbooks;
create trigger workbooks_touch_updated_at
  before update on public.workbooks
  for each row execute function public.touch_updated_at();

alter table public.workbooks enable row level security;

-- Four policies rather than one "for all": each verb is spelled out so that reading the list makes
-- it obvious what an anonymous visitor can do, which is nothing.
drop policy if exists "workbooks are readable by their owner" on public.workbooks;
create policy "workbooks are readable by their owner"
  on public.workbooks for select
  using (auth.uid() = user_id);

drop policy if exists "workbooks are created by their owner" on public.workbooks;
create policy "workbooks are created by their owner"
  on public.workbooks for insert
  with check (auth.uid() = user_id);

-- `using` decides which rows may be updated; `with check` stops an update from handing a row to
-- somebody else. Without the second clause an owner could rewrite user_id and plant a row in
-- another account.
drop policy if exists "workbooks are updated by their owner" on public.workbooks;
create policy "workbooks are updated by their owner"
  on public.workbooks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "workbooks are deleted by their owner" on public.workbooks;
create policy "workbooks are deleted by their owner"
  on public.workbooks for delete
  using (auth.uid() = user_id);
