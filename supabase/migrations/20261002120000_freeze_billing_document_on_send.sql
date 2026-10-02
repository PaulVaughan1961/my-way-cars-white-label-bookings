-- Freeze the billing document state when it is issued/sent.

alter table public.billing_documents
  add column if not exists document_snapshot jsonb
  not null default '{}'::jsonb;

create or replace function public.mark_billing_document_sent(
  requested_document_id uuid,
  requested_document_snapshot jsonb default '{}'::jsonb
)
returns table (
  document_id uuid,
  document_status text,
  document_sent_at timestamptz,
  document_total_amount numeric,
  frozen_snapshot jsonb
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_business_id uuid;
  v_status text;
  v_total numeric(12,2);
begin
  select
    bd.business_id,
    bd.status
  into
    v_business_id,
    v_status
  from public.billing_documents bd
  where bd.id = requested_document_id
  for update;

  if not found then
    raise exception 'Billing document not found or access denied.';
  end if;

  if v_status in ('void', 'superseded') then
    raise exception 'This billing document can no longer be sent.';
  end if;

  -- If already sent, do not alter its frozen historical record.
  if v_status = 'sent' then
    return query
    select
      bd.id,
      bd.status,
      bd.sent_at,
      bd.total_amount,
      bd.document_snapshot
    from public.billing_documents bd
    where bd.id = requested_document_id;

    return;
  end if;

  -- Refresh the booking snapshots from the live bookings immediately
  -- before freezing the document.
  update public.billing_document_bookings bdb
  set
    line_amount = case
      when b.fare::text ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
        then b.fare::text::numeric
      else 0
    end,
    booking_snapshot = to_jsonb(b)
  from public.bookings b
  where bdb.document_id = requested_document_id
    and bdb.business_id = v_business_id
    and b.id = bdb.booking_id;

  select
    coalesce(sum(bdb.line_amount), 0)::numeric(12,2)
  into v_total
  from public.billing_document_bookings bdb
  where bdb.document_id = requested_document_id
    and bdb.business_id = v_business_id;

  update public.billing_documents bd
  set
    status = 'sent',
    sent_at = now(),
    total_amount = v_total,
    document_snapshot = coalesce(
      requested_document_snapshot,
      '{}'::jsonb
    ),
    updated_at = now()
  where bd.id = requested_document_id
    and bd.business_id = v_business_id;

  return query
  select
    bd.id,
    bd.status,
    bd.sent_at,
    bd.total_amount,
    bd.document_snapshot
  from public.billing_documents bd
  where bd.id = requested_document_id;
end;
$$;

revoke all
on function public.mark_billing_document_sent(uuid, jsonb)
from public, anon;

grant execute
on function public.mark_billing_document_sent(uuid, jsonb)
to authenticated;