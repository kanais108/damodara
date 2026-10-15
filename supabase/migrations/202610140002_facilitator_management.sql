-- ISKCON Reading v0.3 - additive facilitator/area/availability operations.
-- Apply AFTER 202610140001_initial.sql. Safe to rerun function definitions.
create or replace function public.manage_facilitator(p_facilitator uuid,p_name text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.staff_role() <> 'admin' then raise exception 'Administrator access required'; end if;
 if not exists(select 1 from public.profiles where id=p_facilitator and role='facilitator') then raise exception 'Facilitator not found'; end if;
 if nullif(trim(p_name),'') is null or length(p_name)>160 then raise exception 'Invalid facilitator name'; end if;
 update public.profiles set full_name=trim(p_name),active=p_active where id=p_facilitator and role='facilitator';
 insert into public.audit_log(actor_id,entity_type,entity_id,action,details) values(auth.uid(),'facilitator',p_facilitator,'profile_updated',jsonb_build_object('active',p_active));
end;$$;

create or replace function public.manage_area(p_name text,p_postcode_prefix text)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_id uuid; v_prefix text;
begin
 if public.staff_role()<>'admin' then raise exception 'Administrator access required'; end if;
 if nullif(trim(p_name),'') is null or length(trim(p_name))>120 then raise exception 'Invalid area name'; end if;
 v_prefix:=nullif(upper(trim(coalesce(p_postcode_prefix,''))), '');
 if v_prefix is not null and v_prefix !~ '^[A-Z]{1,2}[0-9][0-9A-Z]?$' then raise exception 'Enter a UK postcode district such as RG1 or RG30'; end if;
 insert into public.areas(name,postcode_prefix,active) values(trim(p_name),v_prefix,true) returning id into v_id;
 insert into public.audit_log(actor_id,entity_type,entity_id,action) values(auth.uid(),'area',v_id,'created');
 return v_id;
end;$$;

create or replace function public.set_facilitator_area(p_facilitator uuid,p_area uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Coordinator access required'; end if;
 if not exists(select 1 from public.profiles where id=p_facilitator and role='facilitator') then raise exception 'Invalid facilitator'; end if;
 if not exists(select 1 from public.areas where id=p_area and active=true) then raise exception 'Invalid area'; end if;
 if p_enabled then insert into public.facilitator_areas(facilitator_id,area_id) values(p_facilitator,p_area) on conflict do nothing;
 else delete from public.facilitator_areas where facilitator_id=p_facilitator and area_id=p_area;
 end if;
 insert into public.audit_log(actor_id,entity_type,entity_id,action,details) values(auth.uid(),'facilitator',p_facilitator,'coverage_updated',jsonb_build_object('area_id',p_area,'enabled',p_enabled));
end;$$;

create or replace function public.manage_availability(p_facilitator uuid,p_slot uuid,p_date date,p_start time,p_end time,p_remove boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_slot uuid;
begin
 if not (public.is_manager() or (public.staff_role()='facilitator' and auth.uid()=p_facilitator)) then raise exception 'Not authorised'; end if;
 if not exists(select 1 from public.profiles where id=p_facilitator and role='facilitator' and active=true) then raise exception 'Inactive or invalid facilitator'; end if;
 if p_remove then
   if p_slot is null then raise exception 'Missing availability slot'; end if;
   delete from public.facilitator_availability where id=p_slot and facilitator_id=p_facilitator returning id into v_slot;
   if v_slot is null then raise exception 'Availability slot not found'; end if;
 else
   if p_date not between '2026-10-25' and '2026-11-24' or p_start is null or p_end is null or p_end<=p_start then raise exception 'Invalid date or availability time'; end if;
   if exists(select 1 from public.facilitator_availability where facilitator_id=p_facilitator and available_date=p_date and start_time<p_end and end_time>p_start) then raise exception 'Availability overlaps an existing slot'; end if;
   insert into public.facilitator_availability(facilitator_id,available_date,start_time,end_time) values(p_facilitator,p_date,p_start,p_end) returning id into v_slot;
 end if;
 insert into public.audit_log(actor_id,entity_type,entity_id,action) values(auth.uid(),'availability',v_slot,case when p_remove then 'deleted' else 'created' end);
end;$$;

revoke all on function public.manage_facilitator(uuid,text,boolean),public.manage_area(text,text),public.set_facilitator_area(uuid,uuid,boolean),public.manage_availability(uuid,uuid,date,time,time,boolean) from public,anon;
grant execute on function public.manage_facilitator(uuid,text,boolean),public.manage_area(text,text),public.set_facilitator_area(uuid,uuid,boolean),public.manage_availability(uuid,uuid,date,time,time,boolean) to authenticated;
