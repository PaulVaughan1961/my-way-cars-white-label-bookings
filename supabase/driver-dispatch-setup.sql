-- MY WAY CARS DRIVER DISPATCH SETUP
-- Run this whole file once in Supabase SQL Editor.

alter table public.bookings
  add column if not exists driver_assignment_status text,
  add column if not exists driver_assigned_at timestamptz,
  add column if not exists driver_response_at timestamptz,
  add column if not exists driver_decline_reason text;

alter table public.bookings
  drop constraint if exists bookings_driver_assignment_status_check;

alter table public.bookings
  add constraint bookings_driver_assignment_status_check
  check (
    driver_assignment_status is null
    or driver_assignment_status in (
      'Awaiting response',
      'Accepted',
      'Declined'
    )
  );

-- Treat existing driver allocations as already accepted. New allocations
-- made by the updated operator dashboard will start as Awaiting response.
update public.bookings
set
  driver_assignment_status = 'Accepted',
  driver_assigned_at = coalesce(driver_assigned_at, created_at),
  driver_response_at = coalesce(driver_response_at, created_at)
where
  driver_name is not null
  and coalesce(driver_assignment_status, '') = '';

create index if not exists bookings_driver_assignment_status_idx
  on public.bookings (driver_assignment_status);
