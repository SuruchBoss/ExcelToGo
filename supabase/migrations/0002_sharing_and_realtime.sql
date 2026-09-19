-- ExcelToGo — sharing a workbook, and authorising the live channel.
--
-- Run this after `0001_workbooks.sql`, against YOUR OWN Supabase project.
--
-- Two things that turned out to be the same problem.
--
-- **Sharing.** `0001` scopes a workbook to the account that made it, so "several people editing one
-- workbook" could only ever have meant one account in several tabs. Live editing is not worth much
-- under that rule, so this file adds members: the owner names an email, and whoever signs in with
-- that email can open and edit the workbook.
--
-- **The channel.** A Supabase Realtime topic is public unless the client marks it private and the
-- database says who may join. Before this file the app opened `workbook:<id>` as a public topic,
-- which means the row-level security on `public.workbooks` protected the *saved* copy while every
-- keystroke travelled on a channel anyone holding the anon key could subscribe to — and the anon
-- key is in the JavaScript, for everyone. The workbook id is a uuid, so this was hard to exploit,
-- but "hard to guess" is not authorisation. The policies at the bottom make it authorisation.

create table if not exists public.workbook_members (
  workbook_id uuid not null references public.workbooks (id) on delete cascade,
  -- Invited by email rather than by user id: there is no user directory to pick from, and the
  -- person being invited may not have an account yet. The row waits for them.
  email       text not null check (position('@' in email) > 1 and length(email) <= 320),
  invited_by  uuid not null references auth.users (id) on delete cascade,
  created_at  timestamptz not null default now(),
  -- Stored lower-cased so an invitation to Somchai@example.com matches a sign-in as
  -- somchai@example.com. Making it the key means the same address cannot be invited twice.
  primary key (workbook_id, email)
);

create index if not exists workbook_members_email_idx on public.workbook_members (email);

create or replace function public.normalise_member_email()
returns trigger
language plpgsql
as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists workbook_members_normalise_email on public.workbook_members;
create trigger workbook_members_normalise_email
  before insert or update on public.workbook_members
  for each row execute function public.normalise_member_email();

-- Who may see a workbook: its owner, or somebody it was shared with.
--
-- `security definer` on purpose. The policies on `public.workbooks` call this, and this reads
-- `public.workbook_members`, whose own policies read `public.workbooks` — left to itself that is
-- infinite recursion, which Postgres reports as a policy error rather than as the loop it is.
-- Running as the definer breaks the cycle. `search_path` is pinned because a security-definer
-- function that resolves names through the caller's path is how privilege escalation happens.
create or replace function public.can_access_workbook(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.workbooks w
    where w.id = wid
      and (
        w.user_id = auth.uid()
        or exists (
          select 1
          from public.workbook_members m
          where m.workbook_id = w.id
            and m.email = lower(auth.jwt() ->> 'email')
        )
      )
  );
$$;

-- Everyone a workbook is shared with may edit it. There is no viewer role, and saying so is better
-- than implying one: a read-only share that the app cannot enforce in the grid would be a promise
-- made in the database and broken in the browser.
create or replace function public.owns_workbook(wid uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.workbooks w where w.id = wid and w.user_id = auth.uid());
$$;

-- Reading and updating now follow membership; creating and deleting stay with the owner, because
-- neither is something a guest should be able to do to somebody else's document.
drop policy if exists "workbooks are readable by their owner" on public.workbooks;
drop policy if exists "workbooks are readable by their owner or a member" on public.workbooks;
create policy "workbooks are readable by their owner or a member"
  on public.workbooks for select
  using (public.can_access_workbook(id));

drop policy if exists "workbooks are updated by their owner" on public.workbooks;
drop policy if exists "workbooks are updated by their owner or a member" on public.workbooks;
create policy "workbooks are updated by their owner or a member"
  on public.workbooks for update
  using (public.can_access_workbook(id))
  with check (public.can_access_workbook(id));

-- `with check` above no longer pins user_id, so the column is pinned here instead: a member who
-- can update the row must not be able to update it into being theirs.
create or replace function public.freeze_workbook_owner()
returns trigger
language plpgsql
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'a workbook cannot change owner';
  end if;
  return new;
end;
$$;

drop trigger if exists workbooks_freeze_owner on public.workbooks;
create trigger workbooks_freeze_owner
  before update on public.workbooks
  for each row execute function public.freeze_workbook_owner();

alter table public.workbook_members enable row level security;

-- A member may see that they are a member (the app lists who else is on a workbook). Only the
-- owner may invite or remove, so a guest cannot invite the rest of the internet to somebody
-- else's spreadsheet.
drop policy if exists "members are visible to the workbook's people" on public.workbook_members;
create policy "members are visible to the workbook's people"
  on public.workbook_members for select
  using (public.can_access_workbook(workbook_id));

drop policy if exists "only the owner invites" on public.workbook_members;
create policy "only the owner invites"
  on public.workbook_members for insert
  with check (public.owns_workbook(workbook_id) and invited_by = auth.uid());

drop policy if exists "only the owner removes" on public.workbook_members;
create policy "only the owner removes"
  on public.workbook_members for delete
  using (public.owns_workbook(workbook_id));

-- ── The live channel ────────────────────────────────────────────────────────────────────────────
--
-- The app opens one topic per workbook, named `workbook:<id>` — see `channelName()` in
-- `src/lib/cloud/realtimeChannel.ts`, which a test pins against the `split_part` below so the two
-- cannot drift apart without something going red.
--
-- Realtime evaluates these against `realtime.messages` when a client subscribes to a private topic.
-- `select` decides who may listen; `insert` decides who may speak. Presence rides on the same
-- topic, so a person who cannot read the workbook cannot see who is in it either.

create or replace function public.workbook_id_from_topic(topic text)
returns uuid
language plpgsql
immutable
as $$
begin
  if topic is null or left(topic, 9) <> 'workbook:' then
    return null;
  end if;
  -- An id that is not a uuid is somebody probing, not a typo. Null, not an error: an exception
  -- inside a policy is a 500 where a refusal belongs.
  return split_part(topic, ':', 2)::uuid;
exception
  when others then return null;
end;
$$;

drop policy if exists "workbook channels are readable by their people" on realtime.messages;
create policy "workbook channels are readable by their people"
  on realtime.messages for select
  to authenticated
  using (public.can_access_workbook(public.workbook_id_from_topic(realtime.topic())));

drop policy if exists "workbook channels are writable by their people" on realtime.messages;
create policy "workbook channels are writable by their people"
  on realtime.messages for insert
  to authenticated
  with check (public.can_access_workbook(public.workbook_id_from_topic(realtime.topic())));
