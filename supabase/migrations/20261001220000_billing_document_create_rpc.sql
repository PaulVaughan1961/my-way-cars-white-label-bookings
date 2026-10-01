create or replace function public.get_or_create_billing_document(
  requested_type text,
  requested_booking_ids uuid[]
)
returns table (
  document_id uuid,
  document_number text,
  issue_date date,
  document_status text,
  payment_status text,
  total_amount numeric,
  was_created boolean
)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_ids uuid[];
  v_business_id uuid;
  v_booking_count integer;
  v_business_count integer;
  v_document_id uuid;
  v_document_number text;
  v_issue_date date;
  v_document_status text;
  v_payment_status text;
  v_total numeric(12,2);
begin
  if requested_type not in ('invoice', 'receipt') then
    raise exception 'Invalid document type.';
  end if;

  select array_agg(distinct x order by x)
  into v_ids
  from unnest(requested_booking_ids) as x;

  if v_ids is null or cardinality(v_ids) = 0 then
    raise exception 'At least one booking is required.';
  end if;

  select
    count(*),
    count(distinct b.business_id),
    min(b.business_id)
  into
    v_booking_count,
    v_business_count,
    v_business_id
  from public.bookings b
  where b.id = any(v_ids);

  if v_booking_count <> cardinality(v_ids) then
    raise exception 'One or more bookings are unavailable.';
  end if;

  if v_business_count <> 1 then
    raise exception 'All bookings must belong to the same business.';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      v_business_id::text || ':' ||
      requested_type || ':' ||
      array_to_string(v_ids, ','),
      0
    )
  );

  select bd.id
  into v_document_id
  from public.billing_documents bd
  where bd.business_id = v_business_id
    and bd.document_type = requested_type
    and bd.status not in ('void', 'superseded')
    and (
      select count(*)
      from public.billing_document_bookings bdb
      where bdb.document_id = bd.id
    ) = cardinality(v_ids)
    and (
      select count(*)
      from public.billing_document_bookings bdb
      where bdb.document_id = bd.id
        and bdb.booking_id = any(v_ids)
    ) = cardinality(v_ids)
  order by bd.created_at desc
  limit 1;

  if v_document_id is not null then
    return query
    select
      bd.id,
      bd.document_number,
      bd.issue_date,
      bd.status,
      bd.payment_status,
      bd.total_amount,
      false
    from public.billing_documents bd
    where bd.id = v_document_id;

    return;
  end if;

  select
    coalesce(
      sum(
        case
          when b.fare::text ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
            then b.fare::text::numeric
          else 0
        end
      ),
      0
    )::numeric(12,2),
    case
      when bool_and(lower(coalesce(b.payment_status, '')) = 'paid')
        then 'paid'
      else 'unpaid'
    end
  into
    v_total,
    v_payment_status
  from public.bookings b
  where b.id = any(v_ids);

  insert into public.billing_documents (
    business_id,
    document_type,
    status,
    payment_status,
    total_amount,
    paid_at
  )
  values (
    v_business_id,
    requested_type,
    'created',
    v_payment_status,
    v_total,
    case
      when v_payment_status = 'paid' then now()
      else null
    end
  )
  returning
    id,
    billing_documents.document_number,
    billing_documents.issue_date,
    status
  into
    v_document_id,
    v_document_number,
    v_issue_date,
    v_document_status;

  insert into public.billing_document_bookings (
    document_id,
    business_id,
    booking_id,
    line_position,
    line_amount,
    booking_snapshot
  )
  select
    v_document_id,
    v_business_id,
    b.id,
    row_number() over (
      order by b.pickup_datetime nulls last, b.id
    ),
    case
      when b.fare::text ~ '^\s*-?[0-9]+(\.[0-9]+)?\s*$'
        then b.fare::text::numeric
      else 0
    end,
    to_jsonb(b)
  from public.bookings b
  where b.id = any(v_ids);

  return query
  select
    v_document_id,
    v_document_number,
    v_issue_date,
    v_document_status,
    v_payment_status,
    v_total,
    true;
end
$$;

revoke all
on function public.get_or_create_billing_document(text, uuid[])
from public, anon;

grant execute
on function public.get_or_create_billing_document(text, uuid[])
to authenticated;
