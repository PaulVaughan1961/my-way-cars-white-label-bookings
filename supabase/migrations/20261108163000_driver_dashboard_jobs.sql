begin;

-- Use the same business and driver identity check as the existing booking policy.
create or replace function public.driver_dashboard_jobs()
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  with assigned as (
    select
      b.id, b.business_id, b.pickup_datetime, b.passengers,
      b.bags_large, b.bags_small, b.vehicle, b.booking_type, b.payment_status,
      coalesce(b.status, 'Scheduled') as status,
      case
        when b.driver_assignment_status is null and b.status in ('On My Way', 'POB')
          then 'Accepted'
        else coalesce(b.driver_assignment_status, 'Awaiting response')
      end as assignment_status,
      coalesce(to_jsonb(b)->>'outbound_pickup', to_jsonb(b)->>'pickup',
        to_jsonb(b)->>'from_address', b.pickup_address) as pickup,
      coalesce(to_jsonb(b)->>'outbound_dropoff', to_jsonb(b)->>'dropoff',
        to_jsonb(b)->>'to_address', b.dropoff_address) as dropoff,
      coalesce(b.passenger_name, to_jsonb(b)->>'lead_passenger',
        to_jsonb(b)->>'booker_name') as passenger_name
    from public.bookings b
    where auth.uid() is not null
      and app_private.is_current_driver(b.business_id, b.driver_id)
      and coalesce(b.status, 'Scheduled') in ('Scheduled', 'On My Way', 'POB')
  )
  select jsonb_build_object(
    'id', j.id,
    'pickup_datetime', j.pickup_datetime,
    'driver_assignment_status', j.assignment_status,
    'passengers', j.passengers,
    'bags_large', j.bags_large,
    'bags_small', j.bags_small,
    'vehicle', j.vehicle,
    'operator_phone', nullif(regexp_replace(p.contact_phone, '[^0-9+]', '', 'g'), '')
  ) || case when j.assignment_status = 'Accepted' then
    jsonb_build_object(
      'passenger_name', j.passenger_name,
      'pickup', j.pickup,
      'dropoff', j.dropoff,
      'booking_type', j.booking_type,
      'payment_status', j.payment_status,
      'status', j.status
    )
  else
    jsonb_build_object('pickup', areas.pickup_area, 'dropoff', areas.dropoff_area)
  end
  from assigned j
  left join public.business_profiles p on p.business_id = j.business_id
  cross join lateral (
    -- An airport name or the outward part of a postcode is safe to show on an offer.
    -- If neither is present, leave the area blank for the driver to ask the operator.
    select
      coalesce(
        initcap(substring(lower(j.pickup) from '\m(heathrow|gatwick|luton|stansted|birmingham|bristol|southampton|manchester|london city|london southend)\s+(?:airport|terminal|t[1-5])\M')) || ' Airport',
        substring(upper(j.pickup) from '\m([A-Z]{1,2}[0-9][0-9A-Z]?)\s*[0-9][A-Z]{2}\M') || ' area'
      ) as pickup_area,
      coalesce(
        initcap(substring(lower(j.dropoff) from '\m(heathrow|gatwick|luton|stansted|birmingham|bristol|southampton|manchester|london city|london southend)\s+(?:airport|terminal|t[1-5])\M')) || ' Airport',
        substring(upper(j.dropoff) from '\m([A-Z]{1,2}[0-9][0-9A-Z]?)\s*[0-9][A-Z]{2}\M') || ' area'
      ) as dropoff_area
  ) areas
  where j.assignment_status = 'Accepted'
    or (j.assignment_status = 'Awaiting response' and j.status = 'Scheduled')
  order by j.pickup_datetime, j.id;
$$;

revoke all on function public.driver_dashboard_jobs() from public, anon, authenticated;
grant execute on function public.driver_dashboard_jobs() to authenticated;

-- Keep the installed action and audit flow. Require the current assignment
-- state under the booking lock for every driver action.
create or replace function public.driver_booking_action(
  requested_booking_id uuid,
  requested_action text,
  requested_decline_reason text default null
)
returns void
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  membership public.business_memberships%rowtype;
  booking public.bookings%rowtype;
begin
  select b.*
  into booking
  from public.bookings b
  join public.business_memberships m
    on m.business_id = b.business_id
   and m.driver_id = b.driver_id
  where b.id = requested_booking_id
    and m.user_id = auth.uid()
    and m.status = 'active'
  limit 1;

  if not found then
    raise exception 'Assigned booking not found.';
  end if;

  select m.*
  into membership
  from public.business_memberships m
  where m.user_id = auth.uid()
    and m.business_id = booking.business_id
    and m.driver_id = booking.driver_id
    and m.status = 'active'
  for update;

  if not found
     or not coalesce(app_private.can_write_business(membership.business_id), false)
     or not coalesce(app_private.is_current_driver(membership.business_id, membership.driver_id), false) then
    raise exception 'Active driver access required.';
  end if;

  select b.*
  into booking
  from public.bookings b
  where b.id = requested_booking_id
    and b.business_id = membership.business_id
    and b.driver_id = membership.driver_id
  for update;

  if not found then
    raise exception 'Assigned booking not found.';
  end if;

  if requested_action in ('accept', 'decline') then
    if coalesce(booking.driver_assignment_status, 'Awaiting response') <> 'Awaiting response'
       or coalesce(booking.status, 'Scheduled') <> 'Scheduled' then
      raise exception 'This booking is not awaiting a response.';
    end if;
  elsif booking.driver_assignment_status is distinct from 'Accepted'
     and not (booking.driver_assignment_status is null
       and coalesce(booking.status in ('On My Way', 'POB'), false)) then
    raise exception 'Accept the booking before updating it.';
  end if;

  case requested_action
    when 'accept' then
      update public.bookings
      set driver_assignment_status = 'Accepted',
          driver_response_at = now(),
          driver_decline_reason = null
      where id = booking.id;

    when 'decline' then
      if nullif(btrim(requested_decline_reason), '') is null then
        raise exception 'A decline reason is required.';
      end if;
      update public.bookings
      set driver_assignment_status = 'Declined',
          driver_response_at = now(),
          driver_decline_reason = left(btrim(requested_decline_reason), 500)
      where id = booking.id;

    when 'on_my_way' then
      if coalesce(booking.status, 'Scheduled') not in ('Scheduled', 'On My Way') then
        raise exception 'This booking cannot be marked On My Way.';
      end if;
      update public.bookings
      set status = 'On My Way'
      where id = booking.id;

    when 'pob' then
      if coalesce(booking.status, 'Scheduled') not in ('Scheduled', 'On My Way', 'POB') then
        raise exception 'This booking cannot be marked POB.';
      end if;
      update public.bookings
      set status = 'POB'
      where id = booking.id;

    when 'complete_paid', 'complete_unpaid' then
      if coalesce(booking.status, 'Scheduled') not in ('Scheduled', 'On My Way', 'POB') then
        raise exception 'This booking cannot be completed.';
      end if;
      update public.bookings
      set status = 'Completed',
          payment_status = case when requested_action = 'complete_paid' then 'Paid' else 'Unpaid' end
      where id = booking.id;

    when 'mark_paid', 'mark_unpaid' then
      update public.bookings
      set payment_status = case when requested_action = 'mark_paid' then 'Paid' else 'Unpaid' end
      where id = booking.id;

    else
      raise exception 'Unsupported driver action.';
  end case;

  insert into public.security_audit_log (
    business_id, actor_user_id, actor_membership_id, action, resource_type,
    resource_id, details
  )
  values (
    membership.business_id, auth.uid(), membership.id, 'driver_booking_action',
    'bookings', booking.id, jsonb_build_object('driver_action', requested_action)
  );
end;
$$;

notify pgrst, 'reload schema';
commit;

select 'Driver offer reader installed.' as result;
