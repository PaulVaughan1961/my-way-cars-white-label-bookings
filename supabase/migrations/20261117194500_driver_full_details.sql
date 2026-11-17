begin;

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
        to_jsonb(b)->>'booker_name') as passenger_name,
      coalesce(nullif(btrim(to_jsonb(b)->>'passenger_phone'), ''),
        nullif(btrim(to_jsonb(b)->>'phone'), ''),
        nullif(btrim(to_jsonb(b)->>'mobile'), '')) as passenger_phone,
      to_jsonb(b)->>'via' as via
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
    'details_visible', true,
    'passenger_name', j.passenger_name,
    'passenger_phone', j.passenger_phone,
    'via', j.via,
    'can_mark_on_my_way', j.departure_available and not j.details_visible,
    'pickup', j.pickup,
    'dropoff', j.dropoff
  ) || case when j.assignment_status = 'Accepted' then
    jsonb_build_object(
      'booking_type', j.booking_type,
      'payment_status', j.payment_status,
      'status', j.status,
      'operator_phone', nullif(regexp_replace(p.contact_phone, '[^0-9+]', '', 'g'), '')
    )
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

create or replace function public.driver_dashboard_jobs_with_cancellations()
returns setof jsonb
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select feed.job
  from (
    select job
    from public.driver_dashboard_jobs() as jobs(job)

    union all

    select jsonb_build_object(
      'id', b.id,
      'status', 'Cancelled',
      'pickup_datetime', b.pickup_datetime,
      'driver_cancellation_acknowledged_at', b.driver_cancellation_acknowledged_at,
      'pickup', coalesce(
        to_jsonb(b)->>'outbound_pickup', to_jsonb(b)->>'pickup',
        to_jsonb(b)->>'from_address', b.pickup_address
      ),
      'dropoff', coalesce(
        to_jsonb(b)->>'outbound_dropoff', to_jsonb(b)->>'dropoff',
        to_jsonb(b)->>'to_address', b.dropoff_address
      )
    )
    from public.bookings b
    where auth.uid() is not null
      and app_private.is_current_driver(b.business_id, b.driver_id)
      and b.status = 'Cancelled'
      and b.driver_assignment_status = 'Accepted'
      and (b.pickup_datetime at time zone 'Europe/London') >= now() - interval '48 hours'
  ) as feed
  order by (feed.job->>'pickup_datetime')::timestamptz, feed.job->>'id';
$$;

revoke all on function public.driver_dashboard_jobs_with_cancellations() from public, anon, authenticated;
grant execute on function public.driver_dashboard_jobs_with_cancellations() to authenticated;

notify pgrst, 'reload schema';
commit;
