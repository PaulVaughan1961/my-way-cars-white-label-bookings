create table if not exists public.operator_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists operator_push_subscriptions_business_idx on public.operator_push_subscriptions(business_id);
create index if not exists operator_push_subscriptions_user_idx on public.operator_push_subscriptions(user_id);
alter table public.operator_push_subscriptions enable row level security;
alter table public.operator_push_subscriptions force row level security;
revoke all on table public.operator_push_subscriptions from anon, authenticated;