-- v0.4 / ISKCON Reading: atomic availability-aware assignments, 30-minute travel buffer.
-- Apply AFTER migrations 001 and 002. No existing registrations/reports are removed.
-- Existing assignments remain unchanged; new/revised assignments are validated.
create or replace function public.assign_program(p_registration_id uuid,p_facilitator_id uuid,p_date date,p_time time)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_role text;
  v_status text;
  v_existing_status text;
  v_end time;
  v_other uuid;
  v_campaign_start date;
  v_campaign_end date;
begin
  if not public.is_manager() then raise exception 'Only coordinators can assign programmes'; end if;
  if p_registration_id is null or p_facilitator_id is null or p_date is null or p_time is null then
    raise exception 'Programme, facilitator, date and time are required';
  end if;
  select r.status, c.start_date, c.end_date into v_status,v_campaign_start,v_campaign_end
    from public.registrations r join public.campaigns c on c.id=r.campaign_id
    where r.id=p_registration_id for update of r;
  if v_status is null then raise exception 'Registration not found'; end if;
  if v_status in ('completed','cancelled') then raise exception 'Completed or cancelled requests cannot be rescheduled'; end if;
  if p_date < v_campaign_start or p_date > v_campaign_end then raise exception 'Date outside campaign'; end if;
  if (p_date + p_time + interval '1 hour')::date > p_date then
    raise exception 'Programmes must finish before midnight UK local time';
  end if;
  v_end := (p_time + interval '1 hour')::time;
  select role into v_role from public.profiles where id=p_facilitator_id and active=true;
  if v_role is distinct from 'facilitator' then raise exception 'Choose an active facilitator'; end if;
  -- Serialize assignments to the same facilitator, including concurrent admin requests.
  perform pg_advisory_xact_lock(hashtextextended(p_facilitator_id::text, 0));
  if not exists(
    select 1 from public.facilitator_availability a
    where a.facilitator_id=p_facilitator_id and a.available_date=p_date
      and a.start_time<=p_time and a.end_time>=v_end
  ) then raise exception 'Facilitator has no recorded availability covering this hour'; end if;
  select p.status into v_existing_status from public.programs p where p.registration_id=p_registration_id for update;
  if v_existing_status in ('completed','cancelled') then raise exception 'Cannot reassign a completed or cancelled programme'; end if;
  -- Existing completed programme remains occupied for that date; only cancelled slots are freed.
  select p.id into v_other from public.programs p
    where p.lead_facilitator_id=p_facilitator_id and p.registration_id<>p_registration_id
      and p.scheduled_date=p_date and p.status<>'cancelled'
      and (p.scheduled_date + p.scheduled_time) < (p_date + p_time + interval '1 hour 30 minutes')
      and (p.scheduled_date + p.scheduled_end_time + interval '30 minutes') > (p_date + p_time)
    limit 1;
  if v_other is not null then raise exception 'Facilitator has another programme within the 30-minute travel buffer'; end if;
  insert into public.programs(registration_id,lead_facilitator_id,scheduled_date,scheduled_time,scheduled_end_time,status)
    values (p_registration_id,p_facilitator_id,p_date,p_time,v_end,'assigned')
    on conflict (registration_id) do update set
      lead_facilitator_id=excluded.lead_facilitator_id,
      scheduled_date=excluded.scheduled_date,scheduled_time=excluded.scheduled_time,
      scheduled_end_time=excluded.scheduled_end_time,status='assigned',updated_at=now();
  update public.registrations set status='assigned',updated_at=now() where id=p_registration_id;
  insert into public.audit_log(actor_id,entity_type,entity_id,action,details)
    values(auth.uid(),'registration',p_registration_id,'assigned_or_rescheduled',
      jsonb_build_object('facilitator',p_facilitator_id,'date',p_date,'time',p_time,'travel_buffer_minutes',30));
end; $$;
revoke all on function public.assign_program(uuid,uuid,date,time) from public,anon;
grant execute on function public.assign_program(uuid,uuid,date,time) to authenticated;
-- Read access for authenticated staff; existing RLS policies still restrict rows.
grant select on public.areas, public.facilitator_areas, public.facilitator_availability to authenticated;
