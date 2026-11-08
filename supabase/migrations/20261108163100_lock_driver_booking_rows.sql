-- Apply after the driver dashboard release that uses driver_dashboard_jobs().
begin;

do $$
begin
  if to_regprocedure('public.driver_dashboard_jobs()') is null then
    raise exception 'Install the driver dashboard function first.';
  end if;

  if not exists (
    select 1
    from pg_class c
    join pg_roles r on r.rolname = 'authenticated'
    where c.oid = 'public.bookings'::regclass and c.relrowsecurity
      and not r.rolbypassrls and c.relowner <> r.oid
  ) then
    raise exception 'Row level security is required for authenticated booking access.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and policyname = 'bookings_driver_select'
      and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and roles = '{authenticated}'::name[]
      and qual in ('app_private.is_current_driver(business_id, driver_id)', 'false')
  ) then
    raise exception 'The driver booking policy differs from the reviewed export.';
  end if;

  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and policyname = 'bookings_operator_select'
      and cmd = 'SELECT' and permissive = 'PERMISSIVE'
      and roles = '{authenticated}'::name[]
      and qual = 'app_private.can_view_business_data(business_id, ''bookings.manage''::text, branch_id)'
  ) or exists (
    select 1
    from pg_policies
    where schemaname = 'public' and tablename = 'bookings'
      and cmd in ('ALL', 'SELECT') and permissive = 'PERMISSIVE'
      and policyname not in ('bookings_driver_select', 'bookings_operator_select')
  ) then
    raise exception 'The booking read policies differ from the reviewed export.';
  end if;
end;
$$;

alter policy bookings_driver_select on public.bookings using (false);

commit;

select 'Driver booking access restricted to the protected dashboard.' as result;
