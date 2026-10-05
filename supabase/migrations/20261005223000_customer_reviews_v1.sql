create table if not exists public.customer_reviews (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null,
  reviewer_name text not null,
  reviewer_area text,
  journey_type text,
  rating smallint not null check (rating between 1 and 5),
  review_text text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  moderated_at timestamptz,
  moderated_by uuid
);

create index if not exists customer_reviews_business_status_created_idx
  on public.customer_reviews (business_id, status, created_at desc);

alter table public.customer_reviews enable row level security;
alter table public.customer_reviews force row level security;

comment on table public.customer_reviews is
  'Customer-submitted reviews. Public and operator access is mediated by server routes; no direct client policies are granted.';