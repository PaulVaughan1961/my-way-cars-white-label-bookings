begin;

do $$
begin
  if to_regprocedure('public.driver_dashboard_jobs()') is null
     or to_regprocedure('public.driver_booking_action(uuid,text,text)') is null
     or to_regprocedure('app_private.driver_offer_area(text)') is null then
    raise exception 'Install the existing driver dashboard functions first.';
  end if;

  -- Confirm that drivers can only read bookings through the limited feed.
  if not exists (
    select 1
    from pg_class c
    join pg_roles r on r.rolname = 'authenticated'
    where c.oid = 'public.bookings'::regclass and c.relrowsecurity
      and not r.rolbypassrls and c.relowner <> r.oid
  ) or not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and policyname = 'bookings_driver_select' and cmd = 'SELECT' and qual = 'false'
  ) or exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and cmd in ('SELECT', 'ALL') and permissive = 'PERMISSIVE'
      and policyname not in ('bookings_driver_select', 'bookings_operator_select')
  ) then
    raise exception 'Lock direct driver booking access before installing departure privacy.';
  end if;

  if not exists (
    select 1 from pg_attribute
    where attrelid = 'public.bookings'::regclass and attname = 'pickup_datetime'
      and atttypid = 'timestamp without time zone'::regtype and not attisdropped
  ) then
    raise exception 'The pickup time column differs from the reviewed database schema.';
  end if;
end;
$$;

alter table public.bookings add column if not exists driver_on_my_way_at timestamptz;

-- Booking forms store the operator's UK local time without a UTC offset.
create or replace function app_private.driver_on_my_way_available_at(pickup_time timestamp)
returns timestamptz
language sql
stable
strict
set search_path = pg_catalog
as $$
  select case when isfinite(pickup_time)
    then (pickup_time at time zone 'Europe/London') - interval '1 hour'
  end;
$$;

revoke all on function app_private.driver_on_my_way_available_at(timestamp) from public, anon, authenticated;

-- An earlier departure must not carry over to a new assignment or pickup time.
create or replace function app_private.reset_driver_departure()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if new.driver_id is distinct from old.driver_id
     or new.driver_assigned_at is distinct from old.driver_assigned_at
     or new.driver_assignment_status is distinct from old.driver_assignment_status
     or new.pickup_datetime is distinct from old.pickup_datetime
     or coalesce(new.status, 'Scheduled') not in ('On My Way', 'POB') then
    new.driver_on_my_way_at := null;
  end if;
  return new;
end;
$$;

revoke all on function app_private.reset_driver_departure() from public, anon, authenticated;

drop trigger if exists reset_driver_departure on public.bookings;
create trigger reset_driver_departure
before update on public.bookings
for each row execute function app_private.reset_driver_departure();

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
      b.bags_large, b.bags_small, b.vehicle, b.booking_type, b.payment_status, b.fare,
      b.driver_on_my_way_at,
      app_private.driver_on_my_way_available_at(b.pickup_datetime) as departure_available_at,
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
  ), departure as (
    select *,
      coalesce(assignment_status = 'Accepted' and departure_available_at <= now(), false)
        as departure_available
    from assigned
  ), visible as (
    select *,
      coalesce(departure_available
        and status in ('On My Way', 'POB')
        and driver_on_my_way_at between departure_available_at and now(), false) as details_visible
    from departure
  )
  select jsonb_build_object(
    'id', j.id,
    'pickup_datetime', j.pickup_datetime,
    'driver_assignment_status', j.assignment_status,
    'passengers', j.passengers,
    'bags_large', j.bags_large,
    'bags_small', j.bags_small,
    'vehicle', j.vehicle,
    'fare', case when j.fare > 0 then j.fare end,
    'details_visible', j.details_visible,
    'can_mark_on_my_way', j.departure_available and not j.details_visible,
    'pickup', case when j.details_visible then j.pickup else app_private.driver_offer_area(j.pickup) end,
    'dropoff', case when j.details_visible then j.dropoff else app_private.driver_offer_area(j.dropoff) end
  ) || case when j.assignment_status = 'Accepted' then
    jsonb_build_object(
      'booking_type', j.booking_type,
      'payment_status', j.payment_status,
      'status', j.status,
      'operator_phone', nullif(regexp_replace(p.contact_phone, '[^0-9+]', '', 'g'), '')
    )
  else '{}'::jsonb
  end || case when j.details_visible then jsonb_build_object('passenger_name', j.passenger_name)
    else '{}'::jsonb
  end
  from visible j
  left join public.business_profiles p on p.business_id = j.business_id
  where j.assignment_status = 'Accepted'
    or (j.assignment_status = 'Awaiting response' and j.status = 'Scheduled')
  order by j.pickup_datetime, j.id;
$$;

revoke all on function public.driver_dashboard_jobs() from public, anon, authenticated;
grant execute on function public.driver_dashboard_jobs() to authenticated;

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
  departure_available_at timestamptz;
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
      if coalesce(booking.status, 'Scheduled') not in ('Scheduled', 'On My Way', 'POB') then
        raise exception 'This booking cannot be marked On My Way.';
      end if;
      departure_available_at := app_private.driver_on_my_way_available_at(booking.pickup_datetime);
      if departure_available_at is null then
        raise exception 'Set a pickup time before marking this booking On My Way.';
      end if;
      if now() < departure_available_at then
        raise exception 'On My Way opens one hour before pickup.';
      end if;
      update public.bookings
      set status = case when booking.status = 'POB' then 'POB' else 'On My Way' end,
          driver_on_my_way_at = now()
      where id = booking.id;

    when 'pob' then
      departure_available_at := app_private.driver_on_my_way_available_at(booking.pickup_datetime);
      if coalesce(booking.status, 'Scheduled') not in ('On My Way', 'POB')
         or not coalesce(booking.driver_on_my_way_at between departure_available_at and now(), false) then
        raise exception 'Mark On My Way before marking the passenger on board.';
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

revoke all on function public.driver_booking_action(uuid, text, text) from public, anon;
grant execute on function public.driver_booking_action(uuid, text, text) to authenticated;

notify pgrst, 'reload schema';
commit;

select 'Driver departure privacy installed.' as result;
