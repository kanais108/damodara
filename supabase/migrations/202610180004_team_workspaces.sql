-- v0.6 team collaboration. Review and apply once in Supabase SQL Editor BEFORE enabling UI.
-- Existing core role model is preserved; memberships are separate.
create table if not exists public.seva_teams (
 id uuid primary key default gen_random_uuid(),
 code text not null unique check(code in ('communication','coordination','followup')),
 name text not null, active boolean not null default true
);
insert into public.seva_teams(code,name) values
 ('communication','Communication'),('coordination','Programme Coordination'),('followup','Follow-up')
on conflict (code) do nothing;
create table if not exists public.team_members (
 team_id uuid not null references public.seva_teams(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 responsibility text not null default 'member' check(responsibility in ('lead','member')),
 active boolean not null default true,
 primary key(team_id,user_id)
);
create table if not exists public.programme_tasks(
 id uuid primary key default gen_random_uuid(),
 registration_id uuid not null references public.registrations(id),
 team_id uuid not null references public.seva_teams(id),
 assigned_to uuid references public.profiles(id),
 status text not null default 'pending' check(status in ('pending','in_progress','waiting','completed','cancelled')),
 due_at timestamptz, outcome text, requirements text[] not null default '{}',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(registration_id,team_id)
);
create table if not exists public.programme_comments(
 id uuid primary key default gen_random_uuid(),
 task_id uuid not null references public.programme_tasks(id) on delete cascade,
 author_id uuid not null references public.profiles(id),
 comment text not null check(char_length(trim(comment)) between 1 and 2000),
 created_at timestamptz not null default now()
);
create index if not exists task_queue_index on public.programme_tasks(team_id,status,due_at);
create index if not exists task_assignee_index on public.programme_tasks(assigned_to,status);
create index if not exists comments_task_index on public.programme_comments(task_id,created_at);
alter table public.seva_teams enable row level security;
alter table public.team_members enable row level security;
alter table public.programme_tasks enable row level security;
alter table public.programme_comments enable row level security;
-- No browser table access. SECURITY DEFINER functions expose only scoped fields.
revoke all on public.seva_teams,public.team_members,public.programme_tasks,public.programme_comments from anon,authenticated;

create or replace function public.team_is_member(p_team uuid, p_lead boolean default false)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.team_members tm join public.profiles pr on pr.id=tm.user_id
  where tm.team_id=p_team and tm.user_id=(select auth.uid()) and tm.active and pr.active
  and (not p_lead or tm.responsibility='lead'))
$$;
revoke all on function public.team_is_member(uuid,boolean) from public,anon;
grant execute on function public.team_is_member(uuid,boolean) to authenticated;

create or replace function public.team_manage_member(p_team uuid,p_user uuid,p_responsibility text,p_active boolean)
returns void language plpgsql security definer set search_path='' as $$
begin
 if public.staff_role()<>'admin' then raise exception 'Only administrators can change team membership';end if;
 if p_responsibility not in ('lead','member') then raise exception 'Invalid responsibility';end if;
 if not exists(select 1 from public.seva_teams where id=p_team and active) then raise exception 'Team not found';end if;
 if not exists(select 1 from public.profiles where id=p_user and active) then raise exception 'Active portal user required';end if;
 insert into public.team_members(team_id,user_id,responsibility,active) values(p_team,p_user,p_responsibility,p_active)
 on conflict(team_id,user_id) do update set responsibility=excluded.responsibility,active=excluded.active;
 insert into public.audit_log(actor_id,entity_type,entity_id,action,details)
 values(auth.uid(),'team_membership',p_user,'membership_updated',jsonb_build_object('team',p_team,'responsibility',p_responsibility,'active',p_active));
end;$$;

create or replace function public.team_assign_task(p_registration uuid,p_team uuid,p_assignee uuid,p_due timestamptz)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_task uuid;v_code text;
begin
 if not (public.is_manager() or public.team_is_member(p_team,true)) then raise exception 'Team lead or coordinator permission required';end if;
 select code into v_code from public.seva_teams where id=p_team and active;
 if v_code is null then raise exception 'Unknown team';end if;
 if not exists(select 1 from public.registrations where id=p_registration) then raise exception 'Unknown registration';end if;
 if p_assignee is not null and not exists (
  select 1 from public.team_members m join public.profiles p on p.id=m.user_id
  where m.team_id=p_team and m.user_id=p_assignee and m.active and p.active
 ) then raise exception 'Select an active member of this team';end if;
 insert into public.programme_tasks(registration_id,team_id,assigned_to,due_at)
 values(p_registration,p_team,p_assignee,p_due)
 on conflict(registration_id,team_id) do update
 set assigned_to=excluded.assigned_to,due_at=excluded.due_at,updated_at=now()
 returning id into v_task;
 insert into public.audit_log(actor_id,entity_type,entity_id,action,details)
 values(auth.uid(),'team_task',v_task,'assigned',jsonb_build_object('assigned_to',p_assignee,'team',v_code));
 return v_task;
end;$$;

create or replace function public.team_update_task(p_task uuid,p_status text,p_outcome text,p_requirements text[],p_comment text)
returns void language plpgsql security definer set search_path='' as $$
declare v_team uuid;v_assignee uuid;
begin
 select team_id,assigned_to into v_team,v_assignee from public.programme_tasks where id=p_task for update;
 if v_team is null then raise exception 'Task not found';end if;
 if not (public.is_manager() or public.team_is_member(v_team,true) or
 (v_assignee=auth.uid() and public.team_is_member(v_team,false))) then raise exception 'Not permitted to edit this task';end if;
 if p_status not in ('pending','in_progress','waiting','completed','cancelled') then raise exception 'Invalid status';end if;
 if length(coalesce(p_outcome,''))>500 then raise exception 'Outcome too long';end if;
 if coalesce(array_length(p_requirements,1),0)>20 then raise exception 'Too many requirements';end if;
 update public.programme_tasks set status=p_status,outcome=nullif(trim(p_outcome),''),
 requirements=coalesce(p_requirements,'{}'::text[]),updated_at=now() where id=p_task;
 if nullif(trim(coalesce(p_comment,'')),'') is not null then
  if length(p_comment)>2000 then raise exception 'Comment too long';end if;
  insert into public.programme_comments(task_id,author_id,comment) values(p_task,auth.uid(),trim(p_comment));
 end if;
 insert into public.audit_log(actor_id,entity_type,entity_id,action) values(auth.uid(),'team_task',p_task,'updated');
end;$$;

-- Scoped JSON data projection: members see only their assigned tasks or their own team's queue as a lead.
-- Managers see all. Contact details are withheld from unassigned members.
create or replace function public.team_workspace_data()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if public.staff_role() is null then raise exception 'Active account required';end if;
 select jsonb_build_object(
 'teams',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'code',t.code))
   from public.seva_teams t where t.active and (public.is_manager() or public.team_is_member(t.id,false))),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg(jsonb_build_object('team_id',m.team_id,'user_id',m.user_id,'responsibility',m.responsibility,'active',m.active))
   from public.team_members m where public.staff_role()='admin' or m.user_id=auth.uid()),'[]'::jsonb),
 'users',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'full_name',p.full_name,'role',p.role))
   from public.profiles p where p.active and (public.is_manager() or exists(
    select 1 from public.team_members tm where tm.user_id=p.id and tm.active
    and (public.team_is_member(tm.team_id,true) or public.team_is_member(tm.team_id,false))
   ))),'[]'::jsonb),
 'registrations',coalesce((select jsonb_agg(jsonb_build_object(
   'id',r.id,'reference',r.reference,'host_name',r.host_name,'city',r.city,
   'postcode',r.postcode,'program_type',r.program_type,'status',r.status,
   'preferred_date',r.preferred_date,'phone',case when public.is_manager() or exists(
      select 1 from public.programme_tasks t where t.registration_id=r.id and
       (t.assigned_to=auth.uid() or public.team_is_member(t.team_id,true))) then r.mobile else null end,
   'email',case when public.is_manager() or exists(
      select 1 from public.programme_tasks t where t.registration_id=r.id and
       (t.assigned_to=auth.uid() or public.team_is_member(t.team_id,true))) then r.email else null end
   ))
  from public.registrations r where public.is_manager() or exists(
    select 1 from public.programme_tasks t where t.registration_id=r.id
    and (t.assigned_to=auth.uid() or public.team_is_member(t.team_id,true))
  )),'[]'::jsonb),
 'tasks',coalesce((select jsonb_agg(jsonb_build_object('id',t.id,'registration_id',t.registration_id,
   'team_id',t.team_id,'assigned_to',t.assigned_to,'status',t.status,'outcome',t.outcome,
   'requirements',t.requirements,'due_at',t.due_at,'updated_at',t.updated_at))
  from public.programme_tasks t where public.is_manager() or t.assigned_to=auth.uid()
   or public.team_is_member(t.team_id,true)),'[]'::jsonb),
 'comments',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'task_id',c.task_id,'comment',c.comment,
 'created_at',c.created_at,'author',p.full_name))
 from public.programme_comments c join public.profiles p on p.id=c.author_id
 join public.programme_tasks t on t.id=c.task_id
 where public.is_manager() or t.assigned_to=auth.uid() or public.team_is_member(t.team_id,true)),'[]'::jsonb)
 ) into result;
 return result;
end;$$;
revoke all on function public.team_manage_member(uuid,uuid,text,boolean),
 public.team_assign_task(uuid,uuid,uuid,timestamptz),
 public.team_update_task(uuid,text,text,text[],text),
 public.team_workspace_data() from public,anon;
grant execute on function public.team_manage_member(uuid,uuid,text,boolean),
 public.team_assign_task(uuid,uuid,uuid,timestamptz),
 public.team_update_task(uuid,text,text,text[],text),
 public.team_workspace_data() to authenticated;
