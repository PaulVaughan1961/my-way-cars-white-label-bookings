begin;

do $$
begin
  if to_regprocedure('public.driver_dashboard_jobs_with_cancellations()') is null
     or to_regprocedure('app_private.driver_on_my_way_available_at(timestamp)') is null then
    raise exception 'Install the driver cancellation notices and departure privacy updates first.';
  end if;
end;
$$;

alter table public.bookings
  add column if not exists driver_cancellation_acknowledged_at timestamptz;

create or replace function app_private.protect_driver_cancellation_acknowledgement()
returns trigger
language plpgsql
set search_path = pg_catalog
as $$
begin
  if tg_op = 'INSERT' then
    new.driver_cancellation_acknowledged_at := null;
  elsif new.status is distinct from old.status
     or new.business_id is distinct from old.business_id
     or new.driver_id is distinct from old.driver_id
     or new.driver_assigned_at is distinct from old.driver_assigned_at
     or new.driver_assignment_status is distinct from old.driver_assignment_status then
    new.driver_cancellation_acknowledged_at := null;
  elsif current_user in ('anon', 'authenticated')
     and new.driver_cancellation_acknowledged_at is distinct from old.driver_cancellation_acknowledged_at then
    raise exception 'Use the driver dashboard to acknowledge a cancellation.';
  end if;
  return new;
end;
$$;

revoke all on function app_private.protect_driver_cancellation_acknowledgement() from public, anon, authenticated;

drop trigger if exists protect_driver_cancellation_acknowledgement on public.bookings;
create trigger protect_driver_cancellation_acknowledgement
before insert or update on public.bookings
for each row execute function app_private.protect_driver_cancellation_acknowledgement();

create or replace function public.acknowledge_driver_cancellation(requested_booking_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  acknowledged_at timestamptz;
begin
  update public.bookings b
  set driver_cancellation_acknowledged_at = coalesce(b.driver_cancellation_acknowledged_at, now())
  where b.id = requested_booking_id
    and auth.uid() is not null
    and app_private.is_current_driver(b.business_id, b.driver_id)
    and b.status = 'Cancelled'
    and b.driver_assignment_status = 'Accepted'
    and (b.pickup_datetime at time zone 'Europe/London') >= now() - interval '48 hours'
  returning b.driver_cancellation_acknowledged_at into acknowledged_at;

  if not found then
    raise exception 'This cancellation notice is no longer available to you.';
  end if;
  return acknowledged_at;
end;
$$;

revoke all on function public.acknowledge_driver_cancellation(uuid) from public, anon, authenticated;
grant execute on function public.acknowledge_driver_cancellation(uuid) to authenticated;

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
      'pickup', app_private.driver_offer_area(coalesce(
        to_jsonb(b)->>'outbound_pickup', to_jsonb(b)->>'pickup',
        to_jsonb(b)->>'from_address', b.pickup_address
      )),
      'dropoff', app_private.driver_offer_area(coalesce(
        to_jsonb(b)->>'outbound_dropoff', to_jsonb(b)->>'dropoff',
        to_jsonb(b)->>'to_address', b.dropoff_address
      ))
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

select 'Driver cancellation acknowledgement installed.' as result;
