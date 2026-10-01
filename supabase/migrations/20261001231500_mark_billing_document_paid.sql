create or replace function public.mark_billing_document_paid(
  requested_document_id uuid
)
returns table (
  document_id uuid,
  payment_status text,
  paid_at timestamptz
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_paid_at timestamptz := now();
begin
  select bd.business_id
  into v_business_id
  from public.billing_documents bd
  where bd.id = requested_document_id;

  if v_business_id is null then
    raise exception 'Billing document not found.';
  end if;

  update public.billing_documents
  set
    payment_status = 'paid',
    paid_at = v_paid_at
  where id = requested_document_id;

  update public.bookings b
  set payment_status = 'Paid'
  where exists (
    select 1
    from public.billing_document_bookings bdb
    where bdb.document_id = requested_document_id
      and bdb.business_id = v_business_id
      and bdb.booking_id = b.id
  );

  return query
  select
    bd.id,
    bd.payment_status,
    bd.paid_at
  from public.billing_documents bd
  where bd.id = requested_document_id;
end
$$;

revoke all
on function public.mark_billing_document_paid(uuid)
from public, anon;

grant execute
on function public.mark_billing_document_paid(uuid)
to authenticated;
