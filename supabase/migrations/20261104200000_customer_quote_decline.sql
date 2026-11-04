-- Add customer quote declines without replacing the existing acceptance workflow.
begin;
set local lock_timeout = '5s';

do $preflight$
declare definition text; allowed text[];
begin
  if to_regprocedure('public.customer_booking_quote_action(text,text)') is null
    or to_regclass('app_private.booking_workflow_quotes') is null then
    raise exception 'Existing customer confirmation workflow is required. No changes made.';
  end if;
  select pg_get_constraintdef(oid) into definition from pg_constraint
    where conrelid='app_private.booking_workflow_quotes'::regclass
      and conname='booking_workflow_quotes_state_check' and contype='c';
  select array_agg(distinct match[1] order by match[1]) into allowed
    from regexp_matches(definition, '''([^'']+)''', 'g') as match;
  if definition is null or regexp_replace(definition, '\s', '', 'g') not in (
      $check$CHECK((state=ANY(ARRAY['issued'::text,'confirmed'::text,'awaiting_operator'::text,'recheck_requested'::text,'withdrawn'::text])))$check$,
      $check$CHECK((state=ANY(ARRAY['issued'::text,'confirmed'::text,'awaiting_operator'::text,'recheck_requested'::text,'withdrawn'::text,'declined'::text])))$check$
    )
    or allowed is null or not (allowed @> array['issued','confirmed','awaiting_operator','recheck_requested','withdrawn'])
    or not (allowed <@ array['issued','confirmed','awaiting_operator','recheck_requested','withdrawn','declined']) then
    raise exception 'Quote states differ from the reviewed setup. Stop for review; no changes made.';
  end if;
end $preflight$;

alter table app_private.booking_workflow_quotes drop constraint booking_workflow_quotes_state_check;
alter table app_private.booking_workflow_quotes add constraint booking_workflow_quotes_state_check
  check (state in ('issued','confirmed','awaiting_operator','recheck_requested','withdrawn','declined'));

create or replace function public.decline_customer_booking_quote(requested_token_hash text)
returns jsonb language plpgsql security definer set search_path = pg_catalog, public, app_private as $$
declare quote app_private.booking_workflow_quotes%rowtype; answer jsonb;
begin
  if requested_token_hash is null or requested_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception 'This confirmation link is unavailable. Please contact your operator.';
  end if;
  select * into quote from app_private.booking_workflow_quotes where token_hash=requested_token_hash;
  if not found then raise exception 'This confirmation link is unavailable. Please contact your operator.'; end if;
  -- Same business/quote/booking lock order as acceptance and operator approval.
  perform pg_advisory_xact_lock(hashtextextended('workflow:'||quote.business_id::text,0));
  select * into quote from app_private.booking_workflow_quotes where id=quote.id for update;
  perform 1 from public.bookings where business_id=quote.business_id and id=any(quote.booking_ids) order by id for update;
  -- Reuse the deployed expiry, revision, business and linked-journey checks.
  answer:=public.customer_booking_quote_action(requested_token_hash,'view');
  if quote.state='issued' and answer->>'state'='issued' then
    update app_private.booking_workflow_quotes set state='declined' where id=quote.id;
    return answer || jsonb_build_object('state','declined','newAction',true,'canRecheck',false);
  end if;
  -- Repeated clicks cannot reverse an acceptance or cancel a confirmed booking.
  return answer || jsonb_build_object('newAction',false);
end $$;

revoke all on function public.decline_customer_booking_quote(text) from public,anon,authenticated;
grant execute on function public.decline_customer_booking_quote(text) to service_role;
notify pgrst, 'reload schema';
commit;
select 'Customer quote decline installed. Existing bookings were not changed.' as result;
