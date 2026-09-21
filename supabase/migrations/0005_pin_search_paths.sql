-- ExcelToGo — pin the search_path on the four functions that were missing it.
--
-- Found by Supabase's own database linter after `0001`–`0004` were applied to a real project,
-- which is the point worth recording: `policies.test.ts` already checked that every
-- `security definer` function pins its `search_path`, and it passed, because these four are not
-- definer functions. Three are triggers and one is `immutable`, so the escalation they allow is
-- much narrower than a definer's — but "narrower" is not "none", and a trigger runs with whatever
-- `search_path` the statement that fired it happened to have.
--
-- The test has been widened to cover every function in these files rather than only the definers,
-- so this is the last time the two can disagree about which ones matter.
--
-- Safe to run against a project that already has `0001`–`0004`: `create or replace` changes the
-- attribute and leaves the body, the triggers and the policies exactly as they were.

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.normalise_member_email()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.email = lower(trim(new.email));
  return new;
end;
$$;

create or replace function public.freeze_workbook_owner()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'a workbook cannot change owner';
  end if;
  return new;
end;
$$;

-- Called from the two `realtime.messages` policies, so it is evaluated as whoever is subscribing.
-- That is precisely the caller whose `search_path` should not be deciding what `split_part` means.
create or replace function public.workbook_id_from_topic(topic text)
returns uuid
language plpgsql
immutable
set search_path = public, pg_temp
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
