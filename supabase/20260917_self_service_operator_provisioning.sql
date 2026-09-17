-- MY WAY CARS — DEVELOPMENT SELF-SERVICE OPERATOR PROVISIONING V1
-- TARGET: My Way Cars Development Environment (vmucrktaoieldudxkkcn) ONLY.
-- NEVER RUN THIS DEVELOPMENT PACKAGE AGAINST LIVE PRODUCTION.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

do $$
begin
  if to_regclass('public.businesses') is null
     or to_regclass('public.branches') is null
     or to_regclass('public.business_profiles') is null
     or to_regclass('public.business_subscriptions') is null
     or to_regclass('public.business_entitlements') is null
     or to_regclass('public.business_memberships') is null
     or to_regclass('public.operator_users') is null
     or to_regclass('public.security_audit_log') is null then
    raise exception 'PREFLIGHT FAILED: the multi-business security foundation is incomplete.';
  end if;

  if not exists (
    select 1 from public.businesses
    where id = '10000000-0000-4000-8000-000000000001'
  ) then
    raise exception 'PREFLIGHT FAILED: My Way Cars Development tenant was not found.';
  end if;
end
$$;

alter table public.business_profiles
  add column if not exists operator_licence_number text,
  add column if not exists licensing_authority text,
  add column if not exists public_booking_slug text;

update public.business_profiles
set public_booking_slug = case business_id
  when '10000000-0000-4000-8000-000000000001'::uuid then 'my-way-cars'
  when '20000000-0000-4000-8000-000000000001'::uuid then 'second-operator-test-cars'
  else 'operator-' || substr(replace(business_id::text, '-', ''), 1, 12)
end
where public_booking_slug is null;

alter table public.business_profiles
  alter column public_booking_slug set not null;

create unique index if not exists business_profiles_public_booking_slug_key
  on public.business_profiles (lower(public_booking_slug));

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.business_profiles'::regclass
      and conname = 'business_profiles_public_booking_slug_format_check'
  ) then
    alter table public.business_profiles
      add constraint business_profiles_public_booking_slug_format_check
      check (
        public_booking_slug = lower(public_booking_slug)
        and public_booking_slug ~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$'
      );
  end if;
end
$$;

create table if not exists app_private.self_service_operator_provisioning (
  user_id uuid primary key references auth.users(id) on delete restrict,
  business_id uuid not null unique references public.businesses(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz not null default now()
);

revoke all on table app_private.self_service_operator_provisioning
  from public, anon, authenticated;

create or replace function public.provision_self_service_operator(
  requested_user_id uuid,
  requested_business_name text,
  requested_contact_name text,
  requested_contact_phone text,
  requested_address text,
  requested_licence_number text,
  requested_licensing_authority text
)
returns table (
  business_id uuid,
  display_name text,
  public_booking_slug text,
  resumed boolean
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $$
declare
  auth_email text;
  confirmed_at timestamptz;
  existing_business_id uuid;
  existing_owner_count integer;
  new_business_id uuid := gen_random_uuid();
  new_branch_id uuid := gen_random_uuid();
  new_membership_id uuid := gen_random_uuid();
  clean_business_name text := btrim(requested_business_name);
  clean_contact_name text := btrim(requested_contact_name);
  clean_contact_phone text := btrim(requested_contact_phone);
  clean_address text := btrim(requested_address);
  clean_licence_number text := btrim(requested_licence_number);
  clean_licensing_authority text := btrim(requested_licensing_authority);
  slug_base text;
  new_slug text;
begin
  if requested_user_id is null then
    raise exception 'A verified user is required.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('self-service-operator:' || requested_user_id::text, 0)
  );

  select lower(u.email), u.email_confirmed_at
  into auth_email, confirmed_at
  from auth.users u
  where u.id = requested_user_id;

  if auth_email is null or confirmed_at is null then
    raise exception 'The email account must be verified before provisioning.';
  end if;

  if clean_business_name is null
     or clean_contact_name is null
     or clean_contact_phone is null
     or clean_address is null
     or clean_licence_number is null
     or clean_licensing_authority is null
     or length(clean_business_name) not between 2 and 120
     or length(clean_contact_name) not between 2 and 120
     or length(clean_contact_phone) not between 5 and 40
     or length(clean_address) not between 5 and 500
     or length(clean_licence_number) not between 2 and 80
     or length(clean_licensing_authority) not between 2 and 120 then
    raise exception 'The submitted business details are invalid.';
  end if;

  select p.business_id
  into existing_business_id
  from app_private.self_service_operator_provisioning p
  where p.user_id = requested_user_id;

  if existing_business_id is not null then
    return query
    select bp.business_id, bp.display_name, bp.public_booking_slug, true
    from public.business_profiles bp
    join public.business_memberships bm
      on bm.business_id = bp.business_id
     and bm.user_id = requested_user_id
     and bm.role = 'owner'
     and bm.status = 'active'
    where bp.business_id = existing_business_id;

    if not found then
      raise exception 'The existing provisioning record is incomplete.';
    end if;
    return;
  end if;

  select count(*), (array_agg(bm.business_id))[1]
  into existing_owner_count, existing_business_id
  from public.business_memberships bm
  where bm.user_id = requested_user_id
    and bm.role = 'owner'
    and bm.status = 'active';

  if existing_owner_count > 1 then
    raise exception 'This account owns more than one business and requires support.';
  elsif existing_owner_count = 1 then
    insert into app_private.self_service_operator_provisioning (
      user_id, business_id
    ) values (
      requested_user_id, existing_business_id
    );

    return query
    select bp.business_id, bp.display_name, bp.public_booking_slug, true
    from public.business_profiles bp
    where bp.business_id = existing_business_id;
    return;
  end if;

  if exists (
    select 1
    from public.business_memberships bm
    where bm.user_id = requested_user_id
      and bm.status in ('invited', 'active', 'suspended')
  ) then
    raise exception 'This account already has business access and requires support.';
  end if;

  if exists (
    select 1 from public.operator_users ou
    where ou.user_id = requested_user_id
  ) then
    raise exception 'This account has incomplete legacy operator access and requires support.';
  end if;

  slug_base := trim(both '-' from regexp_replace(
    lower(clean_business_name), '[^a-z0-9]+', '-', 'g'
  ));
  if length(slug_base) < 2 then slug_base := 'operator'; end if;
  slug_base := left(slug_base, 60);
  new_slug := slug_base || '-' || substr(replace(new_business_id::text, '-', ''), 1, 10);

  insert into public.businesses (
    id, legal_name, trading_name, status, created_by
  ) values (
    new_business_id,
    clean_business_name,
    clean_business_name,
    'trial',
    requested_user_id
  );

  insert into public.branches (
    id, business_id, name, is_primary, status
  ) values (
    new_branch_id, new_business_id, 'Primary office', true, 'active'
  );

  insert into public.business_profiles (
    business_id, display_name, contact_name, contact_email, contact_phone,
    address, operator_licence_number, licensing_authority,
    public_booking_slug
  ) values (
    new_business_id, clean_business_name, clean_contact_name, auth_email,
    clean_contact_phone, clean_address, clean_licence_number,
    clean_licensing_authority, new_slug
  );

  insert into public.business_subscriptions (
    business_id, plan_key, status, trial_started_at, trial_ends_at
  ) values (
    new_business_id, 'commercial_trial', 'trialing', now(), now() + interval '30 days'
  );

  insert into public.business_entitlements (
    business_id, feature_key, enabled, source, ends_at
  )
  select
    new_business_id,
    feature_key,
    true,
    'trial',
    now() + interval '30 days'
  from unnest(array[
    'booking_diary',
    'calendar',
    'driver_dispatch',
    'customer_requests',
    'messaging',
    'accounts_invoicing',
    'multi_booking_invoicing'
  ]) as features(feature_key);

  insert into public.operator_users (
    user_id, email, created_at, business_id
  ) values (
    requested_user_id, auth_email, now(), new_business_id
  );

  insert into public.business_memberships (
    id, business_id, user_id, role, status, invited_at, accepted_at
  ) values (
    new_membership_id, new_business_id, requested_user_id,
    'owner', 'active', now(), now()
  );

  insert into app_private.self_service_operator_provisioning (
    user_id, business_id
  ) values (
    requested_user_id, new_business_id
  );

  insert into public.security_audit_log (
    business_id, actor_user_id, actor_membership_id,
    action, resource_type, resource_id, details
  ) values (
    new_business_id,
    requested_user_id,
    new_membership_id,
    'self_service_operator_provisioned',
    'business',
    new_business_id,
    jsonb_build_object(
      'plan_key', 'commercial_trial',
      'trial_days', 30,
      'public_booking_slug', new_slug
    )
  );

  return query
  select new_business_id, clean_business_name, new_slug, false;
end
$$;

revoke all on function public.provision_self_service_operator(
  uuid, text, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.provision_self_service_operator(
  uuid, text, text, text, text, text, text
) to service_role;

do $$
begin
  if has_function_privilege(
       'anon',
       'public.provision_self_service_operator(uuid,text,text,text,text,text,text)',
       'EXECUTE'
     )
     or has_function_privilege(
       'authenticated',
       'public.provision_self_service_operator(uuid,text,text,text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'POSTCHECK FAILED: browser roles can execute provisioning.';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.provision_self_service_operator(uuid,text,text,text,text,text,text)',
       'EXECUTE'
     ) then
    raise exception 'POSTCHECK FAILED: service_role cannot execute provisioning.';
  end if;

  if exists (
    select 1 from public.business_profiles
    where public_booking_slug is null
  ) then
    raise exception 'POSTCHECK FAILED: an existing business has no public booking slug.';
  end if;
end
$$;

commit;

select 'DEVELOPMENT SELF-SERVICE PROVISIONING FOUNDATION INSTALLED' as result;
