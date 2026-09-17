-- MY WAY CARS DEVELOPMENT ONLY
-- Target project: vmucrktaoieldudxkkcn
-- Server-only resolver for public booking links.

begin;

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
  join public.businesses b
    on b.id = bp.business_id
   and b.status in ('trial', 'active', 'grace')
  join public.business_subscriptions subscription
    on subscription.business_id = bp.business_id
   and subscription.status in ('trialing', 'active', 'grace')
   and (
     subscription.trial_ends_at is null
     or subscription.trial_ends_at > now()
     or subscription.status in ('active', 'grace')
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

do $postcheck$
begin
  if to_regprocedure(
       'public.resolve_public_booking_business(text,uuid)'
     ) is null then
    raise exception 'POSTCHECK FAILED: public booking resolver is missing.';
  end if;

  if has_function_privilege(
       'anon',
       'public.resolve_public_booking_business(text,uuid)',
       'EXECUTE'
     ) or has_function_privilege(
       'authenticated',
       'public.resolve_public_booking_business(text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'POSTCHECK FAILED: browser roles can execute the resolver.';
  end if;

  if not has_function_privilege(
       'service_role',
       'public.resolve_public_booking_business(text,uuid)',
       'EXECUTE'
     ) then
    raise exception 'POSTCHECK FAILED: service_role cannot execute the resolver.';
  end if;
end
$postcheck$;

commit;

select 'DEVELOPMENT PUBLIC BOOKING BUSINESS RESOLVER INSTALLED' as result;
