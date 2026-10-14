-- ISKCON Reading Dāmodara Portal. Apply in a new Supabase project using SQL Editor.
create extension if not exists pgcrypto;
create table public.campaigns(id uuid primary key default gen_random_uuid(),name text not null,start_date date not null,end_date date not null,active boolean not null default false, constraint campaign_dates check (end_date>=start_date));
insert into public.campaigns(name,start_date,end_date,active) values('ISKCON Reading Dāmodara 2026','2026-10-25','2026-11-24',true);
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade,full_name text not null,role text not null default 'facilitator' check(role in ('admin','coordinator','facilitator')),active boolean not null default true,created_at timestamptz default now());
create table public.areas(id uuid primary key default gen_random_uuid(),name text not null unique,postcode_prefix text,active boolean default true);
insert into public.areas(name,postcode_prefix) values('Reading','RG1'),('Caversham','RG4'),('Tilehurst','RG30'),('Earley','RG6'),('Lower Earley','RG6'),('Woodley','RG5'),('Wokingham','RG40'),('Bracknell','RG12');
create table public.facilitator_areas(facilitator_id uuid references public.profiles(id) on delete cascade,area_id uuid references public.areas(id) on delete cascade,primary key(facilitator_id,area_id));
create table public.facilitator_availability(id uuid primary key default gen_random_uuid(),facilitator_id uuid not null references public.profiles(id) on delete cascade,available_date date not null,start_time time not null,end_time time not null,check(end_time>start_time));
create table public.registrations(
 id uuid primary key default gen_random_uuid(),reference text unique,
 campaign_id uuid not null references public.campaigns(id),
 host_name text not null,email text not null,mobile text not null,
 city text not null,country text not null,
 program_type text not null check(program_type in ('Home','Hall','Street','Other')),
 preferred_date date not null,preferred_time time not null,
 alternate_date date,alternate_time time,
 participation text[] not null default '{}',address text,postcode text,venue_landmark text,
 estimated_guests integer check(estimated_guests is null or estimated_guests between 1 and 20000),
 outdoor_interests text[] not null default '{}',seva_interests text[] not null default '{}',seva_other text,
 notes text,acknowledged_privacy boolean not null,consent_future boolean not null default false,
 status text not null default 'new' check(status in ('new','under_review','assigned','confirmed','completed','cancelled')),
 source text not null default 'portal',submitted_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 constraint submission_name check(length(trim(host_name)) between 2 and 160),
 constraint registration_date check(preferred_date between '2026-10-25' and '2026-11-24'),
 constraint required_ack check(acknowledged_privacy),
 constraint in_person_venue check((program_type='Home' and (not('in_person'=any(participation)) or (nullif(trim(address),'') is not null and nullif(trim(postcode),'') is not null))) or (program_type<>'Home' and nullif(trim(venue_landmark),'') is not null and nullif(trim(address),'') is not null and nullif(trim(postcode),'') is not null))
);
create sequence public.damodara_registration_number start 1;
create or replace function public.set_reference() returns trigger language plpgsql set search_path='' as $$begin if new.reference is null then new.reference := 'DM-2026-'||lpad(nextval('public.damodara_registration_number')::text,6,'0');end if;return new;end;$$;
create trigger reference_before_insert before insert on public.registrations for each row execute function public.set_reference();
create table public.programs(id uuid primary key default gen_random_uuid(),registration_id uuid not null unique references public.registrations(id),lead_facilitator_id uuid not null references public.profiles(id),scheduled_date date not null,scheduled_time time not null,scheduled_end_time time not null,status text not null default 'assigned' check(status in ('assigned','confirmed','completed','cancelled')),created_at timestamptz default now(),updated_at timestamptz default now());
create table public.program_team_members(program_id uuid references public.programs(id) on delete cascade,facilitator_id uuid references public.profiles(id),primary key(program_id,facilitator_id));
create table public.program_reports(id uuid primary key default gen_random_uuid(),program_id uuid not null unique references public.programs(id),participants integer not null check(participants>=0),lamps integer not null check(lamps>=0),books integer not null check(books>=0),notes text,submitted_by uuid not null references public.profiles(id),submitted_at timestamptz not null default now());
create table public.audit_log(id bigint generated always as identity primary key,actor_id uuid,entity_type text not null,entity_id uuid not null,action text not null,details jsonb,created_at timestamptz default now());
create index registrations_status_date_idx on public.registrations(status,preferred_date);
create index registrations_campaign_idx on public.registrations(campaign_id,preferred_date);
create index registrations_postcode_idx on public.registrations(postcode);
create index programs_facilitator_date_idx on public.programs(lead_facilitator_id,scheduled_date);
create index reports_program_idx on public.program_reports(program_id);
-- Security: all client-side tables require authenticated role checking. Anonymous submission only via Edge Function.
create or replace function public.staff_role() returns text language sql stable security definer set search_path='' as $$select role from public.profiles where id=(select auth.uid()) and active=true limit 1$$;
revoke all on function public.staff_role() from public;
grant execute on function public.staff_role() to authenticated;
create or replace function public.is_manager() returns boolean language sql stable security definer set search_path='' as $$select coalesce(public.staff_role() in ('admin','coordinator'),false)$$;
revoke all on function public.is_manager() from public;
grant execute on function public.is_manager() to authenticated;
alter table public.profiles enable row level security;
alter table public.areas enable row level security;
alter table public.facilitator_areas enable row level security;
alter table public.facilitator_availability enable row level security;
alter table public.campaigns enable row level security;
alter table public.registrations enable row level security;
alter table public.programs enable row level security;
alter table public.program_team_members enable row level security;
alter table public.program_reports enable row level security;
alter table public.audit_log enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=(select auth.uid()) or public.is_manager());
create policy areas_read on public.areas for select to authenticated using(public.staff_role() is not null);
create policy campaign_read on public.campaigns for select to authenticated using(public.staff_role() is not null);
create policy facilitator_area_read on public.facilitator_areas for select to authenticated using(facilitator_id=(select auth.uid()) or public.is_manager());
create policy avail_read on public.facilitator_availability for select to authenticated using(facilitator_id=(select auth.uid()) or public.is_manager());
create policy avail_self_insert on public.facilitator_availability for insert to authenticated with check(facilitator_id=(select auth.uid()) and public.staff_role() is not null);
create policy avail_self_delete on public.facilitator_availability for delete to authenticated using(facilitator_id=(select auth.uid()) or public.is_manager());
create policy registrations_read on public.registrations for select to authenticated using(public.is_manager() or exists(select 1 from public.programs p where p.registration_id=registrations.id and p.lead_facilitator_id=(select auth.uid())));
create policy programs_read on public.programs for select to authenticated using(public.is_manager() or lead_facilitator_id=(select auth.uid()));
create policy members_read on public.program_team_members for select to authenticated using(public.is_manager() or facilitator_id=(select auth.uid()));
create policy reports_read on public.program_reports for select to authenticated using(public.is_manager() or exists(select 1 from public.programs p where p.id=program_reports.program_id and p.lead_facilitator_id=(select auth.uid())));
create policy audit_admin_read on public.audit_log for select to authenticated using(public.staff_role()='admin');
-- No client table insert/update grants. All business mutations go through validated RPCs.
revoke all on public.registrations,public.programs,public.program_reports,public.audit_log from anon,authenticated;
grant select on public.registrations,public.programs,public.program_reports to authenticated;
-- Privileged RPCs validate caller roles and inputs; database check protects against race conditions.
create or replace function public.assign_program(p_registration_id uuid,p_facilitator_id uuid,p_date date,p_time time) returns void language plpgsql security definer set search_path='' as $$
declare v_duration interval:=interval '1 hour'; v_role text;v_status text;
begin
 if not public.is_manager() then raise exception 'Only coordinators can assign programmes';end if;
 if p_date not between '2026-10-25' and '2026-11-24' then raise exception 'Date outside campaign';end if;
 perform pg_advisory_xact_lock(hashtext(p_facilitator_id::text));
 select role into v_role from public.profiles where id=p_facilitator_id and active=true;
 if v_role is null then raise exception 'Facilitator is not active';end if;
 select status into v_status from public.registrations where id=p_registration_id for update;
 if v_status is null or v_status in ('completed','cancelled') then raise exception 'Registration cannot be assigned';end if;
 if exists(select 1 from public.programs p where p.lead_facilitator_id=p_facilitator_id and p.registration_id<>p_registration_id and p.scheduled_date=p_date and p.status not in ('completed','cancelled') and p.scheduled_time < (p_time + v_duration) and p.scheduled_end_time > p_time) then raise exception 'Facilitator has a conflicting programme';end if;
 insert into public.programs(registration_id,lead_facilitator_id,scheduled_date,scheduled_time,scheduled_end_time) values(p_registration_id,p_facilitator_id,p_date,p_time,p_time+v_duration)
 on conflict(registration_id) do update set lead_facilitator_id=excluded.lead_facilitator_id,scheduled_date=excluded.scheduled_date,scheduled_time=excluded.scheduled_time,scheduled_end_time=excluded.scheduled_end_time,status='assigned',updated_at=now();
 update public.registrations set status='assigned',updated_at=now() where id=p_registration_id;
 insert into public.audit_log(actor_id,entity_type,entity_id,action,details) values(auth.uid(),'registration',p_registration_id,'assigned',jsonb_build_object('facilitator',p_facilitator_id,'date',p_date,'time',p_time));
end;$$;
create or replace function public.set_registration_status(p_registration_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_manager() then raise exception 'Not authorised';end if;
 if p_status not in ('under_review','confirmed','cancelled') then raise exception 'Invalid status transition';end if;
 if not exists(select 1 from public.registrations where id=p_registration_id and status not in ('completed','cancelled')) then raise exception 'Registration cannot be changed';end if;
 if p_status='confirmed' and not exists(select 1 from public.programs where registration_id=p_registration_id) then raise exception 'Assign a facilitator first';end if;
 update public.registrations set status=p_status,updated_at=now() where id=p_registration_id;
 update public.programs set status=p_status,updated_at=now() where registration_id=p_registration_id and p_status in ('confirmed','cancelled');
 insert into public.audit_log(actor_id,entity_type,entity_id,action) values(auth.uid(),'registration',p_registration_id,p_status);
end;$$;
create or replace function public.complete_program(p_program_id uuid,p_participants integer,p_lamps integer,p_books integer,p_notes text) returns void language plpgsql security definer set search_path='' as $$
declare v_reg uuid;v_fac uuid;v_status text;
begin
 select registration_id,lead_facilitator_id,status into v_reg,v_fac,v_status from public.programs where id=p_program_id for update;
 if v_reg is null or v_status in ('completed','cancelled') then raise exception 'Programme not available for reporting';end if;
 if not(public.is_manager() or (v_fac=auth.uid() and public.staff_role() is not null)) then raise exception 'Not authorised';end if;
 if p_participants is null or p_lamps is null or p_books is null or least(p_participants,p_lamps,p_books)<0 then raise exception 'Invalid report counts';end if;
 insert into public.program_reports(program_id,participants,lamps,books,notes,submitted_by) values(p_program_id,p_participants,p_lamps,p_books,left(coalesce(p_notes,''),3000),auth.uid());
 update public.programs set status='completed',updated_at=now() where id=p_program_id;
 update public.registrations set status='completed',updated_at=now() where id=v_reg;
 insert into public.audit_log(actor_id,entity_type,entity_id,action) values(auth.uid(),'program',p_program_id,'completed');
end;$$;
revoke all on function public.assign_program(uuid,uuid,date,time),public.set_registration_status(uuid,text),public.complete_program(uuid,integer,integer,integer,text) from public;
grant execute on function public.assign_program(uuid,uuid,date,time),public.set_registration_status(uuid,text),public.complete_program(uuid,integer,integer,integer,text) to authenticated;
-- Create staff users via Supabase Auth dashboard, then insert profiles manually with matching auth.users IDs.
-- Example (replace the UUID): insert into public.profiles(id,full_name,role) values('UUID_FROM_AUTH_USERS','Temple Admin','admin');
