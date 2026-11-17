alter table public.drivers
  add column if not exists dispatch_method text not null default 'dashboard'
  check (dispatch_method in ('dashboard', 'subcontractor_sms'));
