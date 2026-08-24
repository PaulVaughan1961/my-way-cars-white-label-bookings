-- MY WAY CARS OPERATOR SECURITY SETUP
-- Run this whole file once in Supabase SQL Editor.

create table if not exists public.operator_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now()
);

alter table public.operator_users enable row level security;

drop policy if exists "operator can read own access record" on public.operator_users;
create policy "operator can read own access record"
on public.operator_users
for select
to authenticated
using (auth.uid() = user_id);

-- Link Paul's existing authentication account to operator access.
insert into public.operator_users (user_id, email)
select id, email
from auth.users
where lower(email) = lower('paulvaughan1961@hotmail.co.uk')
on conflict (user_id) do update set email = excluded.email;

-- Secure all business tables.
alter table public.accounts enable row level security;
alter table public.bookings enable row level security;
alter table public.clash_reviews enable row level security;
alter table public.customers enable row level security;
alter table public.drivers enable row level security;
alter table public.licensing_authorities enable row level security;
alter table public.vehicles enable row level security;

-- Operators have full access to the business tables.
drop policy if exists "operator full access" on public.accounts;
create policy "operator full access" on public.accounts
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

drop policy if exists "operator full access" on public.bookings;
create policy "operator full access" on public.bookings
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

drop policy if exists "operator full access" on public.clash_reviews;
create policy "operator full access" on public.clash_reviews
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

drop policy if exists "operator full access" on public.customers;
create policy "operator full access" on public.customers
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

drop policy if exists "operator full access" on public.drivers;
create policy "operator full access" on public.drivers
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

drop policy if exists "operator full access" on public.licensing_authorities;
create policy "operator full access" on public.licensing_authorities
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

drop policy if exists "operator full access" on public.vehicles;
create policy "operator full access" on public.vehicles
for all to authenticated
using (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
))
with check (exists (
  select 1 from public.operator_users
  where operator_users.user_id = auth.uid()
));

-- The public can submit a new request, but cannot read any bookings.
drop policy if exists "public can submit pending request" on public.bookings;
create policy "public can submit pending request"
on public.bookings
for insert
to anon
with check (
  status = 'Pending Approval'
  and payment_status = 'Unpaid'
  and driver_name is null
  and driver_phone is null
  and vehicle is null
);

-- A signed-in driver can see their own driver record and assigned jobs.
drop policy if exists "driver can read own record" on public.drivers;
create policy "driver can read own record"
on public.drivers
for select
to authenticated
using (
  auth_user_id = auth.uid()
  or lower(coalesce(email, '')) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

drop policy if exists "driver can read assigned bookings" on public.bookings;
create policy "driver can read assigned bookings"
on public.bookings
for select
to authenticated
using (
  exists (
    select 1
    from public.drivers
    where (
      drivers.auth_user_id = auth.uid()
      or lower(coalesce(drivers.email, '')) =
        lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and drivers.name = bookings.driver_name
  )
);

drop policy if exists "driver can update assigned bookings" on public.bookings;
create policy "driver can update assigned bookings"
on public.bookings
for update
to authenticated
using (
  exists (
    select 1
    from public.drivers
    where (
      drivers.auth_user_id = auth.uid()
      or lower(coalesce(drivers.email, '')) =
        lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and drivers.name = bookings.driver_name
  )
)
with check (
  exists (
    select 1
    from public.drivers
    where (
      drivers.auth_user_id = auth.uid()
      or lower(coalesce(drivers.email, '')) =
        lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    and drivers.name = bookings.driver_name
  )
);
