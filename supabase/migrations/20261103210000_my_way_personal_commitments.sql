-- Paul's private personal diary. No booking rows or existing policies are changed.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $setup$
declare owner_user uuid; owner_count integer;
begin
  if to_regprocedure('app_private.current_user_business_id()') is null then
    raise exception 'Existing business access setup is required.';
  end if;
  if to_regclass('public.my_way_personal_commitments') is not null then
    raise exception 'Personal diary is already installed. Do not run this setup again.';
  end if;
  select count(distinct u.id), (array_agg(distinct u.id))[1]
    into owner_count, owner_user
  from auth.users u
  join public.business_memberships m on m.user_id = u.id
  join public.operator_users o on o.user_id = u.id and o.business_id = m.business_id
  where lower(u.email) = 'hello@mywaytaxis.co.uk'
    and u.email_confirmed_at is not null
    and m.business_id = '10000000-0000-4000-8000-000000000001'::uuid
    and m.status = 'active' and m.role in ('owner', 'admin');
  if owner_count <> 1 then
    raise exception 'The verified My Way Cars owner could not be identified uniquely. No changes made.';
  end if;
  -- Freeze the verified user's UUID; a matching display name never grants access.
  execute format($fn$
    create function public.my_way_personal_calendar_enabled()
    returns boolean language sql stable security definer
    set search_path = pg_catalog, public, app_private
    as $body$
      select case when auth.uid() = %L::uuid then
        app_private.current_user_business_id() = '10000000-0000-4000-8000-000000000001'::uuid
        and exists (
          select 1 from public.business_memberships m
          join public.operator_users o on o.user_id=m.user_id and o.business_id=m.business_id
          where m.user_id=auth.uid()
            and m.business_id='10000000-0000-4000-8000-000000000001'::uuid
            and m.status='active' and m.role in ('owner','admin')
        )
      else false end
    $body$;
  $fn$, owner_user);
end
$setup$;

revoke all on function public.my_way_personal_calendar_enabled() from public, anon;
grant execute on function public.my_way_personal_calendar_enabled() to authenticated;

create table public.my_way_personal_commitments (
  id uuid primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 160),
  starts_at timestamp without time zone not null,
  ends_at timestamp without time zone not null,
  all_day boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (isfinite(starts_at) and isfinite(ends_at) and ends_at > starts_at),
  check (not all_day or (starts_at = date_trunc('day', starts_at) and ends_at = starts_at + interval '1 day'))
);
comment on table public.my_way_personal_commitments is 'Private personal diary for the verified My Way Cars owner only. Times are Europe/London wall time.';
create index my_way_personal_commitments_owner_start on public.my_way_personal_commitments(owner_id, starts_at);
alter table public.my_way_personal_commitments enable row level security;
alter table public.my_way_personal_commitments force row level security;
revoke all on public.my_way_personal_commitments from public, anon, authenticated;
grant select, insert, update, delete on public.my_way_personal_commitments to authenticated;
create policy personal_diary_owner on public.my_way_personal_commitments for all to authenticated
  using (owner_id = (select auth.uid()) and (select public.my_way_personal_calendar_enabled()))
  with check (owner_id = (select auth.uid()) and (select public.my_way_personal_calendar_enabled()));

create function public.my_way_list_personal_commitments(requested_from timestamp, requested_to timestamp)
returns setof public.my_way_personal_commitments
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not public.my_way_personal_calendar_enabled() then
    raise exception 'Personal diary is not available for this account.' using errcode='42501';
  end if;
  if requested_from is null or requested_to is null or not isfinite(requested_from)
    or not isfinite(requested_to) or requested_to <= requested_from then
    raise exception 'Please choose a valid date range.';
  end if;
  return query select * from public.my_way_personal_commitments
    where owner_id=auth.uid() and starts_at < requested_to and ends_at > requested_from
    order by starts_at, id limit 501;
end $$;

create function public.my_way_save_personal_commitment(
  requested_id uuid, requested_title text, requested_start timestamp,
  requested_end timestamp, requested_all_day boolean
) returns uuid language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not public.my_way_personal_calendar_enabled() then
    raise exception 'Personal diary is not available for this account.' using errcode='42501';
  end if;
  insert into public.my_way_personal_commitments(id, owner_id, title, starts_at, ends_at, all_day)
  values (requested_id, auth.uid(), btrim(requested_title), requested_start, requested_end, requested_all_day)
  on conflict (id) do update set title=excluded.title, starts_at=excluded.starts_at,
    ends_at=excluded.ends_at, all_day=excluded.all_day, updated_at=now();
  return requested_id;
end $$;

create function public.my_way_delete_personal_commitment(requested_id uuid)
returns boolean language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if not public.my_way_personal_calendar_enabled() then
    raise exception 'Personal diary is not available for this account.' using errcode='42501';
  end if;
  delete from public.my_way_personal_commitments where id=requested_id and owner_id=auth.uid();
  return found;
end $$;

revoke all on function public.my_way_list_personal_commitments(timestamp,timestamp) from public,anon;
revoke all on function public.my_way_save_personal_commitment(uuid,text,timestamp,timestamp,boolean) from public,anon;
revoke all on function public.my_way_delete_personal_commitment(uuid) from public,anon;
grant execute on function public.my_way_list_personal_commitments(timestamp,timestamp) to authenticated;
grant execute on function public.my_way_save_personal_commitment(uuid,text,timestamp,timestamp,boolean) to authenticated;
grant execute on function public.my_way_delete_personal_commitment(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
select 'Personal diary installed for the verified My Way Cars owner only.' as result;
