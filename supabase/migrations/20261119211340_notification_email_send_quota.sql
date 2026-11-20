-- Server-only, atomic per-sender quota for the Resend notification gateway.
-- Database-first release: deploy this migration before the new Edge Function.
-- Claims are conservative: failed provider requests may use up a slot.
create table public.notification_email_send_quota (
  sender_id uuid not null references auth.users(id) on delete cascade,
  bucket_type text not null check (bucket_type in ('hour','day','invite_hour','invite_day')),
  bucket_start timestamptz not null,
  send_count integer not null default 0 check (send_count>=0),
  primary key(sender_id,bucket_type,bucket_start)
);

alter table public.notification_email_send_quota enable row level security;
revoke all on public.notification_email_send_quota from public,anon,authenticated;
grant select,insert,update,delete on public.notification_email_send_quota to service_role;

-- SECURITY INVOKER and a service-role-only EXECUTE grant make the gate
-- unavailable to normal application users, even via direct Data API calls.
create function public.claim_notification_email_send_quota(p_sender_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if current_user <> 'service_role' or p_sender_id is null then
    raise exception 'A levélküldési keret csak a szerver számára érhető el.';
  end if;

  -- The nested block is a subtransaction: on either exhausted limit we
  -- undo BOTH quota increments before returning false.
  begin
    insert into public.notification_email_send_quota(sender_id,bucket_type,bucket_start,send_count)
    values
      (p_sender_id,'hour',date_trunc('hour',now()),1),
      (p_sender_id,'day',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',1)
    on conflict (sender_id,bucket_type,bucket_start)
    do update set send_count=notification_email_send_quota.send_count+1
      where
        (notification_email_send_quota.bucket_type='hour' and notification_email_send_quota.send_count<60)
        or (notification_email_send_quota.bucket_type='day' and notification_email_send_quota.send_count<200);

    get diagnostics v_claimed = row_count;
    if v_claimed<>2 then
      raise exception 'Az e-mailküldési keret betelt.' using errcode='P0001';
    end if;

    -- Keep only recent counters for active senders; inactive counters are tiny
    -- and disappear automatically if the Auth user is removed.
    delete from public.notification_email_send_quota
      where sender_id=p_sender_id and bucket_start<now()-interval '3 days';
    return true;
  exception when sqlstate 'P0001' then
    return false;
  end;
end;
$$;

revoke all on function public.claim_notification_email_send_quota(uuid) from public,anon,authenticated;
grant execute on function public.claim_notification_email_send_quota(uuid) to service_role;

-- Account invitations are more sensitive than workflow notifications. Give
-- them separate, tighter quotas so neither channel can exhaust the other.
create function public.claim_invitation_email_send_quota(p_sender_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if current_user <> 'service_role' or p_sender_id is null then
    raise exception 'A meghivasi keret csak a szerver szamara erheto el.';
  end if;

  begin
    insert into public.notification_email_send_quota(sender_id,bucket_type,bucket_start,send_count)
    values
      (p_sender_id,'invite_hour',date_trunc('hour',now()),1),
      (p_sender_id,'invite_day',date_trunc('day',now() at time zone 'UTC') at time zone 'UTC',1)
    on conflict (sender_id,bucket_type,bucket_start)
    do update set send_count=notification_email_send_quota.send_count+1
      where
        (notification_email_send_quota.bucket_type='invite_hour' and notification_email_send_quota.send_count<10)
        or (notification_email_send_quota.bucket_type='invite_day' and notification_email_send_quota.send_count<30);

    get diagnostics v_claimed = row_count;
    if v_claimed<>2 then
      raise exception 'A meghivasi keret betelt.' using errcode='P0001';
    end if;
    delete from public.notification_email_send_quota
      where sender_id=p_sender_id and bucket_start<now()-interval '3 days';
    return true;
  exception when sqlstate 'P0001' then
    return false;
  end;
end;
$$;

revoke all on function public.claim_invitation_email_send_quota(uuid) from public,anon,authenticated;
grant execute on function public.claim_invitation_email_send_quota(uuid) to service_role;
