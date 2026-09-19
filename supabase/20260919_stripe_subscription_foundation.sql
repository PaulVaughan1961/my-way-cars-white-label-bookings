-- MY WAY CARS STRIPE SUBSCRIPTION FOUNDATION
-- Apply to Development first through the guarded rollout package.
-- Adds Stripe event processing and makes tenant access fail closed when a
-- trial or paid period has actually expired.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '120s';

alter table public.business_subscriptions
  add column if not exists provider_price_id text,
  add column if not exists provider_event_created_at timestamptz;

create table if not exists public.stripe_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  business_id uuid references public.businesses(id) on delete set null,
  outcome text not null default 'received'
    check (outcome in ('received', 'applied', 'ignored_stale')),
  details jsonb not null default '{}'::jsonb,
  processed_at timestamptz not null default now(),
  check (nullif(btrim(event_id), '') is not null),
  check (nullif(btrim(event_type), '') is not null)
);

revoke all on table public.stripe_webhook_events
  from public, anon, authenticated;
alter table public.stripe_webhook_events enable row level security;
alter table public.stripe_webhook_events force row level security;

create or replace function app_private.can_read_business(
  requested_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    exists (
      select 1
      from public.business_memberships m
      join public.businesses b on b.id = m.business_id
      join public.business_subscriptions s
        on s.business_id = m.business_id
      where m.user_id = auth.uid()
        and m.business_id = requested_business_id
        and m.status = 'active'
        and (
          (
            b.status = 'trial'
            and s.status = 'trialing'
            and s.trial_ends_at > now()
          )
          or (
            b.status = 'active'
            and s.status = 'active'
            and (
              s.current_period_ends_at is null
              or s.current_period_ends_at > now()
            )
          )
          or (
            b.status = 'grace'
            and s.status = 'grace'
            and s.grace_ends_at > now()
          )
          or (
            b.status = 'read_only'
            and s.status in ('read_only', 'cancelled', 'unpaid')
            and s.read_only_ends_at > now()
          )
        )
    )
    or app_private.has_support_access(requested_business_id);
$$;

create or replace function app_private.can_write_business(
  requested_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.business_memberships m
    join public.businesses b on b.id = m.business_id
    join public.business_subscriptions s
      on s.business_id = m.business_id
    where m.user_id = auth.uid()
      and m.business_id = requested_business_id
      and m.status = 'active'
      and (
        (
          b.status = 'trial'
          and s.status = 'trialing'
          and s.trial_ends_at > now()
        )
        or (
          b.status = 'active'
          and s.status = 'active'
          and (
            s.current_period_ends_at is null
            or s.current_period_ends_at > now()
          )
        )
        or (
          b.status = 'grace'
          and s.status = 'grace'
          and s.grace_ends_at > now()
        )
      )
  );
$$;

revoke all on function app_private.can_read_business(uuid) from public;
revoke all on function app_private.can_write_business(uuid) from public;
grant execute on function app_private.can_read_business(uuid)
  to authenticated;
grant execute on function app_private.can_write_business(uuid)
  to authenticated;

drop policy if exists operator_users_self_read on public.operator_users;
create policy operator_users_self_read
on public.operator_users
for select to authenticated
using (user_id = auth.uid());

create or replace function public.get_current_subscription_status()
returns table (
  business_id uuid,
  plan_key text,
  status text,
  trial_ends_at timestamptz,
  current_period_ends_at timestamptz,
  cancel_at_period_end boolean,
  grace_ends_at timestamptz,
  read_only_ends_at timestamptz,
  access_mode text,
  is_owner boolean
)
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select
    s.business_id,
    s.plan_key,
    s.status,
    s.trial_ends_at,
    s.current_period_ends_at,
    s.cancel_at_period_end,
    s.grace_ends_at,
    s.read_only_ends_at,
    case
      when b.status = 'trial'
        and s.status = 'trialing'
        and s.trial_ends_at > now()
        then 'full'
      when b.status = 'active'
        and s.status = 'active'
        and (
          s.current_period_ends_at is null
          or s.current_period_ends_at > now()
        )
        then 'full'
      when b.status = 'grace'
        and s.status = 'grace'
        and s.grace_ends_at > now()
        then 'full'
      when b.status = 'read_only'
        and s.status in ('read_only', 'cancelled', 'unpaid')
        and s.read_only_ends_at > now()
        then 'read_only'
      else 'blocked'
    end as access_mode,
    m.role = 'owner' as is_owner
  from public.business_memberships m
  join public.businesses b on b.id = m.business_id
  join public.business_subscriptions s on s.business_id = m.business_id
  where m.user_id = auth.uid()
    and m.status = 'active'
  order by m.accepted_at nulls last, m.created_at
  limit 1;
$$;

revoke all on function public.get_current_subscription_status()
  from public, anon;
grant execute on function public.get_current_subscription_status()
  to authenticated;

create or replace function public.record_stripe_customer(
  requested_business_id uuid,
  requested_user_id uuid,
  requested_customer_id text
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  current_customer_id text;
begin
  if nullif(btrim(requested_customer_id), '') is null then
    raise exception 'A Stripe customer ID is required.';
  end if;

  if not exists (
    select 1
    from public.business_memberships m
    where m.business_id = requested_business_id
      and m.user_id = requested_user_id
      and m.role = 'owner'
      and m.status = 'active'
  ) then
    raise exception 'The requested user is not the active business owner.';
  end if;

  select s.provider_customer_id
  into current_customer_id
  from public.business_subscriptions s
  where s.business_id = requested_business_id
  for update;

  if not found then
    raise exception 'The business subscription does not exist.';
  end if;

  if current_customer_id is not null
     and current_customer_id <> btrim(requested_customer_id) then
    raise exception 'The business already has a different Stripe customer.';
  end if;

  update public.business_subscriptions
  set provider_customer_id = btrim(requested_customer_id),
      updated_at = now()
  where business_id = requested_business_id;
end
$$;

revoke all on function public.record_stripe_customer(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.record_stripe_customer(uuid, uuid, text)
  to service_role;

create or replace function public.apply_stripe_subscription_event(
  requested_event_id text,
  requested_event_type text,
  requested_event_created_at timestamptz,
  requested_business_id uuid,
  requested_customer_id text,
  requested_subscription_id text,
  requested_price_id text,
  requested_plan_key text,
  requested_status text,
  requested_trial_ends_at timestamptz,
  requested_current_period_ends_at timestamptz,
  requested_cancel_at_period_end boolean,
  requested_grace_ends_at timestamptz,
  requested_read_only_ends_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  resolved_business_id uuid;
  inserted_event_id text;
  existing_event_created_at timestamptz;
  enable_features boolean;
  feature_end timestamptz;
begin
  if nullif(btrim(requested_event_id), '') is null
     or nullif(btrim(requested_event_type), '') is null
     or nullif(btrim(requested_customer_id), '') is null
     or nullif(btrim(requested_subscription_id), '') is null
     or nullif(btrim(requested_price_id), '') is null
     or nullif(btrim(requested_plan_key), '') is null then
    raise exception 'The Stripe event is incomplete.';
  end if;

  if requested_status not in (
    'trialing', 'active', 'grace', 'read_only', 'cancelled', 'unpaid'
  ) then
    raise exception 'The Stripe subscription status is invalid.';
  end if;

  select s.business_id
  into resolved_business_id
  from public.business_subscriptions s
  where s.provider_subscription_id = btrim(requested_subscription_id)
     or s.provider_customer_id = btrim(requested_customer_id)
  order by (s.provider_subscription_id = btrim(requested_subscription_id)) desc
  limit 1;

  if resolved_business_id is null
     and requested_business_id is not null
     and exists (
       select 1 from public.business_subscriptions s
       where s.business_id = requested_business_id
     ) then
    resolved_business_id := requested_business_id;
  end if;

  if resolved_business_id is null then
    raise exception 'The Stripe subscription could not be mapped to a business.';
  end if;

  if requested_business_id is not null
     and requested_business_id <> resolved_business_id then
    raise exception 'Stripe metadata does not match the stored business.';
  end if;

  insert into public.stripe_webhook_events (
    event_id, event_type, event_created_at, business_id, details
  ) values (
    btrim(requested_event_id),
    btrim(requested_event_type),
    requested_event_created_at,
    resolved_business_id,
    jsonb_build_object(
      'provider_subscription_id', btrim(requested_subscription_id),
      'status', requested_status
    )
  )
  on conflict (event_id) do nothing
  returning event_id into inserted_event_id;

  if inserted_event_id is null then
    return;
  end if;

  select s.provider_event_created_at
  into existing_event_created_at
  from public.business_subscriptions s
  where s.business_id = resolved_business_id
  for update;

  if existing_event_created_at is not null
     and requested_event_created_at < existing_event_created_at then
    update public.stripe_webhook_events
    set outcome = 'ignored_stale', processed_at = now()
    where event_id = inserted_event_id;
    return;
  end if;

  update public.business_subscriptions
  set plan_key = btrim(requested_plan_key),
      provider_customer_id = btrim(requested_customer_id),
      provider_subscription_id = btrim(requested_subscription_id),
      provider_price_id = btrim(requested_price_id),
      provider_event_created_at = requested_event_created_at,
      status = requested_status,
      trial_started_at = case
        when requested_status = 'trialing'
          then coalesce(trial_started_at, now())
        else trial_started_at
      end,
      trial_ends_at = coalesce(requested_trial_ends_at, trial_ends_at),
      current_period_ends_at = requested_current_period_ends_at,
      cancel_at_period_end = coalesce(requested_cancel_at_period_end, false),
      grace_ends_at = case
        when requested_status = 'grace' then requested_grace_ends_at
        else null
      end,
      read_only_ends_at = case
        when requested_status in ('read_only', 'cancelled', 'unpaid')
          then coalesce(read_only_ends_at, requested_read_only_ends_at)
        else null
      end,
      data_delete_after = case
        when requested_status in ('read_only', 'cancelled', 'unpaid')
          then coalesce(
            data_delete_after,
            requested_read_only_ends_at + interval '30 days'
          )
        else null
      end,
      updated_at = now()
  where business_id = resolved_business_id;

  update public.businesses
  set status = case
        when requested_status = 'trialing' then 'trial'
        when requested_status = 'active' then 'active'
        when requested_status = 'grace' then 'grace'
        else 'read_only'
      end,
      updated_at = now()
  where id = resolved_business_id;

  enable_features := requested_status in ('trialing', 'active', 'grace');
  feature_end := case
    when requested_status = 'trialing' then requested_trial_ends_at
    when requested_status = 'active' then requested_current_period_ends_at
    when requested_status = 'grace' then requested_grace_ends_at
    else null
  end;

  insert into public.business_entitlements (
    business_id, feature_key, enabled, source, starts_at, ends_at, updated_at
  )
  select
    resolved_business_id,
    feature_key,
    enable_features,
    'plan',
    now(),
    feature_end,
    now()
  from unnest(array[
    'booking_diary',
    'calendar',
    'driver_dispatch',
    'customer_requests',
    'messaging',
    'accounts_invoicing',
    'multi_booking_invoicing'
  ]) as features(feature_key)
  on conflict (business_id, feature_key)
  do update set
    enabled = excluded.enabled,
    source = excluded.source,
    ends_at = excluded.ends_at,
    updated_at = now();

  update public.stripe_webhook_events
  set outcome = 'applied', processed_at = now()
  where event_id = inserted_event_id;
end
$$;

revoke all on function public.apply_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz
) from public, anon, authenticated;
grant execute on function public.apply_stripe_subscription_event(
  text, text, timestamptz, uuid, text, text, text, text, text,
  timestamptz, timestamptz, boolean, timestamptz, timestamptz
) to service_role;

create or replace function public.resolve_public_booking_business(
  requested_slug text,
  fallback_business_id uuid
)
returns table (
  business_id uuid,
  display_name text
)
language plpgsql
security definer
set search_path = pg_catalog, public, app_private
as $function$
declare
  clean_slug text := nullif(lower(btrim(requested_slug)), '');
begin
  if clean_slug is not null
     and clean_slug !~ '^[a-z0-9][a-z0-9-]{1,78}[a-z0-9]$' then
    return;
  end if;

  if clean_slug is null and fallback_business_id is null then
    return;
  end if;

  return query
  select bp.business_id, bp.display_name
  from public.business_profiles bp
  join public.businesses b on b.id = bp.business_id
  join public.business_subscriptions subscription
    on subscription.business_id = bp.business_id
   and (
     (
       b.status = 'trial'
       and subscription.status = 'trialing'
       and subscription.trial_ends_at > now()
     )
     or (
       b.status = 'active'
       and subscription.status = 'active'
       and (
         subscription.current_period_ends_at is null
         or subscription.current_period_ends_at > now()
       )
     )
     or (
       b.status = 'grace'
       and subscription.status = 'grace'
       and subscription.grace_ends_at > now()
     )
   )
  join public.business_entitlements entitlement
    on entitlement.business_id = bp.business_id
   and entitlement.feature_key = 'customer_requests'
   and entitlement.enabled
   and (entitlement.ends_at is null or entitlement.ends_at > now())
  where (
    (clean_slug is not null and bp.public_booking_slug = clean_slug)
    or
    (clean_slug is null and bp.business_id = fallback_business_id)
  )
  limit 1;
end
$function$;

revoke all on function public.resolve_public_booking_business(text, uuid)
  from public, anon, authenticated;
grant execute on function public.resolve_public_booking_business(text, uuid)
  to service_role;

do $$
begin
  if to_regclass('public.stripe_webhook_events') is null then
    raise exception 'POSTCHECK FAILED: Stripe webhook event table is missing.';
  end if;

  if to_regprocedure('public.get_current_subscription_status()') is null
     or to_regprocedure(
       'public.record_stripe_customer(uuid,uuid,text)'
     ) is null
     or to_regprocedure(
       'public.apply_stripe_subscription_event(text,text,timestamp with time zone,uuid,text,text,text,text,text,timestamp with time zone,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)'
     ) is null then
    raise exception 'POSTCHECK FAILED: Stripe subscription functions are missing.';
  end if;

  if has_table_privilege(
       'authenticated', 'public.stripe_webhook_events', 'SELECT'
     ) then
    raise exception 'POSTCHECK FAILED: browser users can read webhook events.';
  end if;

  if has_function_privilege(
       'authenticated',
       'public.record_stripe_customer(uuid,uuid,text)',
       'EXECUTE'
     ) or has_function_privilege(
       'authenticated',
       'public.apply_stripe_subscription_event(text,text,timestamp with time zone,uuid,text,text,text,text,text,timestamp with time zone,timestamp with time zone,boolean,timestamp with time zone,timestamp with time zone)',
       'EXECUTE'
     ) then
    raise exception 'POSTCHECK FAILED: browser users can execute Stripe writes.';
  end if;
end
$$;

commit;

select 'STRIPE SUBSCRIPTION FOUNDATION INSTALLED' as result;
