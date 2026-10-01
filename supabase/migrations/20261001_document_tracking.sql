-- Stage 1: permanent invoice / receipt tracking

do $$
begin
  if to_regclass('public.businesses') is null
     or to_regclass('public.operator_users') is null
     or to_regclass('public.bookings') is null then
    raise exception 'PREFLIGHT FAILED: businesses, operator_users and bookings must already exist.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'business_id'
  ) then
    raise exception 'PREFLIGHT FAILED: public.bookings.business_id is required.';
  end if;

  if not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'operator_users'
      and column_name = 'business_id'
  ) then
    raise exception 'PREFLIGHT FAILED: public.operator_users.business_id is required.';
  end if;
end
$$;

create schema if not exists app_private;

create table if not exists app_private.billing_document_counters (
  business_id uuid not null references public.businesses(id) on delete restrict,
  document_type text not null check (document_type in ('invoice', 'receipt')),
  document_year integer not null check (document_year between 2000 and 2200),
  last_number integer not null check (last_number > 0),
  primary key (business_id, document_type, document_year)
);

revoke all on table app_private.billing_document_counters
  from public, anon, authenticated;

create table if not exists public.billing_documents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete restrict,

  document_type text not null
    check (document_type in ('invoice', 'receipt')),

  document_number text not null,

  status text not null default 'created'
    check (status in ('created', 'sent', 'void', 'superseded')),

  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'part_paid', 'paid')),

  issue_date date not null default current_date,

  total_amount numeric(12,2) not null default 0
    check (total_amount >= 0),

  sent_at timestamptz,
  paid_at timestamptz,
  payment_method text,

  voided_at timestamptz,
  void_reason text,

  supersedes_document_id uuid
    references public.billing_documents(id) on delete restrict,

  created_by uuid default auth.uid(),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint billing_documents_id_business_unique
    unique (id, business_id),

  constraint billing_documents_number_unique
    unique (business_id, document_number),

  constraint billing_documents_sent_has_date
    check (status <> 'sent' or sent_at is not null),

  constraint billing_documents_void_has_reason
    check (
      status <> 'void'
      or (
        voided_at is not null
        and nullif(btrim(void_reason), '') is not null
      )
    )
);

create index if not exists billing_documents_business_created_idx
  on public.billing_documents (business_id, created_at desc);

create index if not exists billing_documents_business_status_idx
  on public.billing_documents (business_id, status);

create index if not exists billing_documents_business_payment_idx
  on public.billing_documents (business_id, payment_status);

create table if not exists public.billing_document_bookings (
  document_id uuid not null,
  business_id uuid not null,

  booking_id uuid not null
    references public.bookings(id) on delete restrict,

  line_position integer not null default 1
    check (line_position > 0),

  line_amount numeric(12,2) not null default 0
    check (line_amount >= 0),

  booking_snapshot jsonb not null default '{}'::jsonb,

  created_at timestamptz not null default now(),

  primary key (document_id, booking_id),

  constraint billing_document_bookings_document_fk
    foreign key (document_id, business_id)
    references public.billing_documents(id, business_id)
    on delete cascade
);

create index if not exists billing_document_bookings_booking_idx
  on public.billing_document_bookings (booking_id);

create index if not exists billing_document_bookings_business_idx
  on public.billing_document_bookings (business_id);

create or replace function app_private.assign_billing_document_number()
returns trigger
language plpgsql
security definer
set search_path = public, app_private, pg_temp
as $$
declare
  v_year integer;
  v_next integer;
  v_prefix text;
begin
  if new.document_number is not null
     and nullif(btrim(new.document_number), '') is not null then
    return new;
  end if;

  v_year :=
    extract(year from coalesce(new.issue_date, current_date))::integer;

  v_prefix :=
    case new.document_type
      when 'invoice' then 'INV'
      when 'receipt' then 'R'
      else null
    end;

  if v_prefix is null then
    raise exception
      'Unsupported billing document type: %',
      new.document_type;
  end if;

  insert into app_private.billing_document_counters (
    business_id,
    document_type,
    document_year,
    last_number
  )
  values (
    new.business_id,
    new.document_type,
    v_year,
    1
  )
  on conflict (business_id, document_type, document_year)
  do update
    set last_number =
      app_private.billing_document_counters.last_number + 1
  returning last_number into v_next;

  new.document_number :=
    format(
      '%s-%s-%s',
      v_prefix,
      v_year,
      lpad(v_next::text, 6, '0')
    );

  return new;
end
$$;

revoke all
on function app_private.assign_billing_document_number()
from public, anon, authenticated;

drop trigger if exists billing_documents_assign_number
  on public.billing_documents;

create trigger billing_documents_assign_number
before insert on public.billing_documents
for each row
execute function app_private.assign_billing_document_number();

create or replace function app_private.touch_billing_document_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end
$$;

revoke all
on function app_private.touch_billing_document_updated_at()
from public, anon, authenticated;

drop trigger if exists billing_documents_touch_updated_at
  on public.billing_documents;

create trigger billing_documents_touch_updated_at
before update on public.billing_documents
for each row
execute function app_private.touch_billing_document_updated_at();

create or replace function app_private.check_billing_booking_business()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.bookings b
    where b.id = new.booking_id
      and b.business_id = new.business_id
  ) then
    raise exception
      'Booking % does not belong to business %.',
      new.booking_id,
      new.business_id;
  end if;

  return new;
end
$$;

revoke all
on function app_private.check_billing_booking_business()
from public, anon, authenticated;

drop trigger if exists billing_document_bookings_check_business
  on public.billing_document_bookings;

create trigger billing_document_bookings_check_business
before insert or update on public.billing_document_bookings
for each row
execute function app_private.check_billing_booking_business();

alter table public.billing_documents
  enable row level security;

alter table public.billing_documents
  force row level security;

alter table public.billing_document_bookings
  enable row level security;

alter table public.billing_document_bookings
  force row level security;

drop policy if exists "operator billing document access"
  on public.billing_documents;

create policy "operator billing document access"
on public.billing_documents
for all
to authenticated
using (
  exists (
    select 1
    from public.operator_users ou
    where ou.user_id = auth.uid()
      and ou.business_id = billing_documents.business_id
  )
)
with check (
  exists (
    select 1
    from public.operator_users ou
    where ou.user_id = auth.uid()
      and ou.business_id = billing_documents.business_id
  )
);

drop policy if exists "operator billing document booking access"
  on public.billing_document_bookings;

create policy "operator billing document booking access"
on public.billing_document_bookings
for all
to authenticated
using (
  exists (
    select 1
    from public.operator_users ou
    where ou.user_id = auth.uid()
      and ou.business_id = billing_document_bookings.business_id
  )
)
with check (
  exists (
    select 1
    from public.operator_users ou
    where ou.user_id = auth.uid()
      and ou.business_id = billing_document_bookings.business_id
  )
);

grant select, insert, update, delete
on public.billing_documents
to authenticated;

grant select, insert, update, delete
on public.billing_document_bookings
to authenticated;

revoke all
on public.billing_documents
from anon;

revoke all
on public.billing_document_bookings
from anon;
