begin;

-- Keep the existing jobs RPC for dashboard tabs open during the release.
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
      and b.pickup_datetime >= now() - interval '48 hours'
  ) as feed
  order by (feed.job->>'pickup_datetime')::timestamptz, feed.job->>'id';
$$;

revoke all on function public.driver_dashboard_jobs_with_cancellations() from public, anon, authenticated;
grant execute on function public.driver_dashboard_jobs_with_cancellations() to authenticated;

notify pgrst, 'reload schema';
commit;

select 'Driver cancellation notices installed.' as result;
