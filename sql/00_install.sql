-- IKIGAI Pilot V1 — installation complète pour un nouveau projet Supabase
-- À exécuter une seule fois dans SQL Editor.
begin;

create extension if not exists pgcrypto;

create type public.project_status as enum ('idea','planned','active','paused','completed','abandoned');
create type public.action_status as enum ('todo','doing','done','cancelled');
create type public.priority_level as enum ('low','medium','high','critical');
create type public.proposal_status as enum ('pending','applied','rejected','expired');

create table public.subscription_plans (
  code text primary key,
  name text not null,
  price_monthly_eur numeric(10,2) not null default 0,
  seats_limit integer not null default 1,
  projects_limit integer not null default 5,
  ai_requests_limit integer not null default 0,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

insert into public.subscription_plans(code,name,price_monthly_eur,seats_limit,projects_limit,ai_requests_limit,features)
values
  ('free','Découverte',0,1,3,5,'{"reviews":true,"team":false,"billing":false}'::jsonb),
  ('starter','Essentiel',12,1,10,50,'{"reviews":true,"team":false,"billing":true}'::jsonb),
  ('pro','Pro',29,5,50,300,'{"reviews":true,"team":true,"billing":true,"advanced_ai":true}'::jsonb),
  ('business','Business',69,25,250,1500,'{"reviews":true,"team":true,"billing":true,"advanced_ai":true,"audit_log":true}'::jsonb)
on conflict (code) do update set
  name=excluded.name, price_monthly_eur=excluded.price_monthly_eur,
  seats_limit=excluded.seats_limit, projects_limit=excluded.projects_limit,
  ai_requests_limit=excluded.ai_requests_limit, features=excluded.features;

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  timezone text not null default 'Europe/Paris',
  locale text not null default 'fr-FR',
  week_start smallint not null default 1 check (week_start between 0 and 6),
  weekly_capacity_minutes integer not null default 600 check (weekly_capacity_minutes between 60 and 10080),
  daily_focus_limit integer not null default 3 check (daily_focus_limit between 1 and 10),
  active_project_limit integer not null default 3 check (active_project_limit between 1 and 500),
  ai_enabled boolean not null default false,
  ai_monthly_request_limit integer not null default 5 check (ai_monthly_request_limit between 0 and 100000),
  plan_code text not null default 'free' references public.subscription_plans(code),
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_members (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'owner' check (role in ('owner','admin','member','viewer')),
  email text,
  display_name text,
  capacity_minutes_per_week integer check (capacity_minutes_per_week between 60 and 10080),
  created_at timestamptz not null default now(),
  primary key (tenant_id,user_id)
);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin','member','viewer')),
  token uuid not null unique default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id,email)
);

create table public.domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  color text not null default '#ff6b00',
  icon text,
  status text not null default 'active' check (status in ('active','paused','archived')),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.objectives (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  domain_id uuid references public.domains(id) on delete set null,
  title text not null,
  description text,
  horizon text not null default 'year' check (horizon in ('life','five_years','three_years','year','quarter','month')),
  start_date date,
  target_date date,
  success_metric text,
  target_value numeric,
  current_value numeric,
  unit text,
  priority public.priority_level not null default 'medium',
  status text not null default 'active' check (status in ('draft','active','paused','completed','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.axes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  objective_id uuid not null references public.objectives(id) on delete cascade,
  title text not null,
  description text,
  position integer not null default 0,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  axis_id uuid references public.axes(id) on delete set null,
  owner_id uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status public.project_status not null default 'planned',
  health text not null default 'on_track' check (health in ('on_track','at_risk','blocked','off_track')),
  priority public.priority_level not null default 'medium',
  start_date date,
  target_date date,
  estimated_hours numeric(8,2),
  started_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,
  title text not null,
  description text,
  due_date date,
  weight numeric(5,2) not null default 1 check(weight > 0),
  status text not null default 'todo' check (status in ('todo','doing','done','cancelled')),
  completed_at timestamptz,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.recurring_rules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  rrule text not null,
  template jsonb not null default '{}'::jsonb,
  next_run date,
  last_run date,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.actions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  project_id uuid references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  parent_action_id uuid references public.actions(id) on delete cascade,
  recurrence_rule_id uuid references public.recurring_rules(id) on delete set null,
  assigned_to uuid references auth.users(id) on delete set null,
  title text not null,
  description text,
  status public.action_status not null default 'todo',
  priority public.priority_level not null default 'medium',
  planned_date date,
  due_date date,
  estimated_minutes integer not null default 30 check(estimated_minutes between 5 and 1440),
  actual_minutes integer not null default 0 check(actual_minutes between 0 and 100000),
  impact_score smallint not null default 3 check (impact_score between 1 and 5),
  energy_level smallint not null default 3 check (energy_level between 1 and 5),
  is_main boolean not null default false,
  position integer not null default 0,
  report_count integer not null default 0,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.action_dependencies (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action_id uuid not null references public.actions(id) on delete cascade,
  depends_on_action_id uuid not null references public.actions(id) on delete cascade,
  dependency_type text not null default 'finish_to_start' check (dependency_type in ('finish_to_start','start_to_start')),
  created_at timestamptz not null default now(),
  primary key (action_id,depends_on_action_id),
  check (action_id <> depends_on_action_id)
);

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  action_id uuid references public.actions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  duration_minutes integer check (duration_minutes between 0 and 100000),
  note text,
  created_at timestamptz not null default now()
);

create table public.ideas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  objective_id uuid references public.objectives(id) on delete set null,
  title text not null,
  description text,
  review_after date not null default (current_date + 7),
  status text not null default 'parked' check(status in ('parked','promoted','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  period_type text not null check (period_type in ('day','week','month','quarter','year')),
  period_start date not null,
  period_end date not null,
  metrics jsonb not null default '{}'::jsonb,
  notes text,
  decisions text,
  status text not null default 'draft' check(status in ('draft','completed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(tenant_id,user_id,period_type,period_start)
);

create table public.ai_proposals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  feature_code text not null,
  context_type text,
  context_id uuid,
  title text not null,
  summary text,
  payload jsonb not null default '{}'::jsonb,
  model text,
  response_id text,
  status public.proposal_status not null default 'pending',
  applied_at timestamptz,
  rejected_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.ai_usage_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  feature_code text not null,
  model text,
  response_id text,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  reasoning_tokens integer not null default 0,
  credits_charged integer not null default 1,
  supplier_cost numeric(12,6) not null default 0,
  created_at timestamptz not null default now()
);

create table public.tenant_subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_code text not null default 'free' references public.subscription_plans(code),
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  status text not null default 'trialing' check(status in ('trialing','active','past_due','canceled','unpaid','incomplete','incomplete_expired','paused')),
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  entity_type text,
  entity_id uuid,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.audit_log (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  changes jsonb,
  created_at timestamptz not null default now()
);

create index idx_tenant_members_user on public.tenant_members(user_id);
create index idx_domains_tenant on public.domains(tenant_id,position);
create index idx_objectives_tenant_status on public.objectives(tenant_id,status,target_date);
create index idx_axes_objective on public.axes(tenant_id,objective_id,position);
create index idx_projects_tenant_status on public.projects(tenant_id,status,target_date);
create index idx_milestones_project on public.milestones(tenant_id,project_id,due_date);
create index idx_actions_planning on public.actions(tenant_id,planned_date,status,due_date);
create index idx_actions_project on public.actions(tenant_id,project_id,milestone_id);
create index idx_ideas_tenant_status on public.ideas(tenant_id,status,review_after);
create index idx_ai_usage_month on public.ai_usage_events(tenant_id,created_at);
create index idx_ai_proposals_status on public.ai_proposals(tenant_id,status,created_at);
create index idx_notifications_user on public.notifications(tenant_id,user_id,read_at,created_at);
create index idx_audit_tenant on public.audit_log(tenant_id,created_at);

create or replace function public.is_tenant_member(p_tenant uuid)
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.tenant_members tm where tm.tenant_id=p_tenant and tm.user_id=(select auth.uid()));
$$;

create or replace function public.has_tenant_role(p_tenant uuid, p_roles text[])
returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.tenant_members tm where tm.tenant_id=p_tenant and tm.user_id=(select auth.uid()) and tm.role=any(p_roles));
$$;

create or replace function public.current_tenant_id()
returns uuid language sql stable security definer set search_path=public as $$
  select tenant_id from public.tenant_members where user_id=(select auth.uid()) order by created_at limit 1;
$$;

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

create or replace function public.bootstrap_personal_tenant(p_name text default 'Mon espace')
returns uuid language plpgsql security definer set search_path=public as $$
declare v_tenant uuid; v_slug text;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select tenant_id into v_tenant from public.tenant_members where user_id=auth.uid() order by created_at limit 1;
  if v_tenant is not null then return v_tenant; end if;
  v_slug := lower(regexp_replace(coalesce(nullif(trim(p_name),''),'espace'), '[^a-zA-Z0-9]+','-','g')) || '-' || substr(gen_random_uuid()::text,1,8);
  insert into public.tenants(name,slug) values(coalesce(nullif(trim(p_name),''),'Mon espace'),v_slug) returning id into v_tenant;
  insert into public.tenant_members(tenant_id,user_id,role,email) values(v_tenant,auth.uid(),'owner',auth.jwt()->>'email');
  insert into public.tenant_subscriptions(tenant_id,plan_code,status) values(v_tenant,'free','active');
  insert into public.domains(tenant_id,name,description,position,color) values
    (v_tenant,'Personnel','Santé, équilibre, relations et organisation personnelle',1,'#ff6b00'),
    (v_tenant,'Professionnel','Carrière, activité, revenus et impact',2,'#5b5bd6'),
    (v_tenant,'Apprentissage','Compétences, diplômes et développement',3,'#14804a');
  return v_tenant;
end $$;

create or replace function public.assert_same_tenant()
returns trigger language plpgsql as $$
declare i integer; v_id uuid; v_tenant uuid;
begin
  i := 0;
  while i < array_length(tg_argv,1) loop
    v_id := nullif(to_jsonb(new)->>tg_argv[i], '')::uuid;
    if v_id is not null then
      execute format('select tenant_id from public.%I where id=$1', tg_argv[i+1]) into v_tenant using v_id;
      if v_tenant is null or v_tenant <> new.tenant_id then
        raise exception 'Référence inter-tenant interdite (%).', tg_argv[i];
      end if;
    end if;
    i := i + 2;
  end loop;
  return new;
end $$;

create or replace function public.enforce_seat_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limit int; v_count int;
begin
  if exists(select 1 from public.tenant_members where tenant_id=new.tenant_id and user_id=new.user_id) then return new; end if;
  select sp.seats_limit into v_limit from public.tenants t join public.subscription_plans sp on sp.code=t.plan_code where t.id=new.tenant_id;
  select count(*) into v_count from public.tenant_members where tenant_id=new.tenant_id;
  if v_count >= coalesce(v_limit,1) then raise exception 'Limite de membres atteinte pour cette formule (%).',v_limit; end if;
  return new;
end $$;

create or replace function public.protect_last_owner()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_other int;
begin
  if old.role='owner' then
    if tg_op='DELETE' or (tg_op='UPDATE' and new.role<>'owner') then
      select count(*) into v_other from public.tenant_members where tenant_id=old.tenant_id and role='owner' and user_id<>old.user_id;
      if v_other=0 then raise exception 'Un espace doit conserver au moins un propriétaire.'; end if;
    end if;
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

create or replace function public.validate_project_hierarchy()
returns trigger language plpgsql as $$
declare v_objective uuid;
begin
  if new.axis_id is not null then
    select objective_id into v_objective from public.axes where id=new.axis_id;
    if new.objective_id is null then new.objective_id=v_objective;
    elsif new.objective_id<>v_objective then raise exception 'L’axe sélectionné n’appartient pas à cet objectif.'; end if;
  end if;
  return new;
end $$;

create or replace function public.validate_action_hierarchy()
returns trigger language plpgsql as $$
declare v_project uuid;
begin
  if new.milestone_id is not null then
    select project_id into v_project from public.milestones where id=new.milestone_id;
    if new.project_id is null then new.project_id=v_project;
    elsif new.project_id<>v_project then raise exception 'Le jalon sélectionné n’appartient pas à ce projet.'; end if;
  end if;
  return new;
end $$;

create or replace function public.enforce_active_project_limit()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_limit int; v_count int;
begin
  if new.status='active' and (tg_op='INSERT' or old.status is distinct from new.status) then
    select active_project_limit into v_limit from public.tenants where id=new.tenant_id;
    select count(*) into v_count from public.projects where tenant_id=new.tenant_id and status='active' and id<>new.id;
    if v_count >= v_limit then raise exception 'Limite de projets actifs atteinte (%). Suspendez ou terminez un projet.',v_limit; end if;
  end if;
  if new.status='active' and new.started_at is null then new.started_at=now(); end if;
  if new.status='completed' and new.completed_at is null then new.completed_at=now(); end if;
  return new;
end $$;

create or replace function public.set_action_completion()
returns trigger language plpgsql as $$
begin
  if new.status='done' and (tg_op='INSERT' or old.status is distinct from new.status) then new.completed_at=now(); end if;
  if new.status<>'done' then new.completed_at=null; end if;
  return new;
end $$;

create or replace function public.set_milestone_completion()
returns trigger language plpgsql as $$
begin
  if new.status='done' and (tg_op='INSERT' or old.status is distinct from new.status) then new.completed_at=now(); end if;
  if new.status<>'done' then new.completed_at=null; end if;
  return new;
end $$;

create or replace function public.audit_row_change()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_tenant uuid; v_id uuid; v_changes jsonb;
begin
  if tg_op='DELETE' then
    v_tenant=old.tenant_id; v_id=old.id; v_changes=jsonb_build_object('old',to_jsonb(old));
  elsif tg_op='INSERT' then
    v_tenant=new.tenant_id; v_id=new.id; v_changes=jsonb_build_object('new',to_jsonb(new));
  else
    v_tenant=new.tenant_id; v_id=new.id; v_changes=jsonb_build_object('old',to_jsonb(old),'new',to_jsonb(new));
  end if;
  insert into public.audit_log(tenant_id,actor_user_id,entity_type,entity_id,action,changes)
  values(v_tenant,auth.uid(),tg_table_name,v_id,lower(tg_op),v_changes);
  if tg_op='DELETE' then return old; else return new; end if;
end $$;

create or replace view public.project_progress with (security_invoker=true) as
with action_stats as (
  select p.id as project_id,
    count(a.id) as action_count,
    count(a.id) filter(where a.status='done') as action_done
  from public.projects p left join public.actions a on a.project_id=p.id
  group by p.id
), milestone_stats as (
  select p.id as project_id,
    sum(m.weight) as total_weight,
    sum(m.weight) filter(where m.status='done') as done_weight
  from public.projects p left join public.milestones m on m.project_id=p.id
  group by p.id
)
select p.id,p.tenant_id,p.title,
  case
    when coalesce(ms.total_weight,0)>0 then round(100*coalesce(ms.done_weight,0)/ms.total_weight,0)
    when coalesce(ast.action_count,0)>0 then round(100.0*ast.action_done/ast.action_count,0)
    else 0
  end::integer as progress
from public.projects p
left join action_stats ast on ast.project_id=p.id
left join milestone_stats ms on ms.project_id=p.id;

create or replace view public.objective_progress with (security_invoker=true) as
select o.id,o.tenant_id,o.title,
  coalesce(round(avg(pp.progress),0),0)::integer as progress
from public.objectives o
left join public.projects p on p.objective_id=o.id and p.status<>'abandoned'
left join public.project_progress pp on pp.id=p.id
group by o.id;

create or replace view public.domain_progress with (security_invoker=true) as
select d.id,d.tenant_id,d.name,
  coalesce(round(avg(op.progress),0),0)::integer as progress
from public.domains d
left join public.objectives o on o.domain_id=d.id and o.status<>'abandoned'
left join public.objective_progress op on op.id=o.id
group by d.id;

create or replace view public.action_priority_scores with (security_invoker=true) as
select a.*,
  (
    case a.priority when 'critical' then 40 when 'high' then 30 when 'medium' then 20 else 10 end
    + a.impact_score*6
    + case when a.due_date < current_date then 35
           when a.due_date = current_date then 30
           when a.due_date <= current_date+3 then 20
           when a.due_date <= current_date+7 then 10 else 0 end
    + least(a.report_count*4,20)
    - least(greatest(a.estimated_minutes-30,0)/15,12)
    - case when exists(
        select 1 from public.action_dependencies ad
        join public.actions dep on dep.id=ad.depends_on_action_id
        where ad.action_id=a.id and dep.status<>'done'
      ) then 100 else 0 end
  )::integer as priority_score,
  exists(
    select 1 from public.action_dependencies ad
    join public.actions dep on dep.id=ad.depends_on_action_id
    where ad.action_id=a.id and dep.status<>'done'
  ) as is_blocked
from public.actions a;

create or replace function public.generate_week_plan(p_tenant uuid, p_week_start date default date_trunc('week',current_date)::date)
returns table(action_id uuid, planned_date date, priority_score integer)
language plpgsql security definer set search_path=public as $$
declare
  v_capacity integer;
  v_daily integer;
  v_day date := p_week_start;
  v_used integer := 0;
  rec record;
begin
  if not public.has_tenant_role(p_tenant,array['owner','admin','member']) then raise exception 'Accès refusé'; end if;
  select coalesce(tm.capacity_minutes_per_week,t.weekly_capacity_minutes)
    into v_capacity
  from public.tenants t join public.tenant_members tm on tm.tenant_id=t.id and tm.user_id=auth.uid()
  where t.id=p_tenant;
  v_daily := greatest(30, floor(v_capacity/5.0)::integer);

  for rec in
    select aps.id, aps.estimated_minutes, aps.priority_score
    from public.action_priority_scores aps
    where aps.tenant_id=p_tenant
      and aps.status in ('todo','doing')
      and not aps.is_blocked
      and (aps.planned_date is null or aps.planned_date < p_week_start or aps.planned_date > p_week_start+6)
    order by aps.priority_score desc, aps.due_date nulls last, aps.created_at
  loop
    if v_used>0 and v_used+rec.estimated_minutes>v_daily then
      v_day := v_day+1; v_used := 0;
      if extract(isodow from v_day)=6 then v_day := v_day+2; end if;
    end if;
    exit when v_day>p_week_start+6;
    update public.actions set planned_date=v_day,updated_at=now() where id=rec.id;
    v_used := v_used+rec.estimated_minutes;
    action_id:=rec.id; planned_date:=v_day; priority_score:=rec.priority_score;
    return next;
  end loop;
end $$;

create or replace function public.create_review_snapshot(p_tenant uuid,p_period_type text,p_period_start date,p_period_end date)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_metrics jsonb;
begin
  if not public.has_tenant_role(p_tenant,array['owner','admin','member']) then raise exception 'Accès refusé'; end if;
  select jsonb_build_object(
    'actions_total',count(*) filter(where planned_date between p_period_start and p_period_end),
    'actions_done',count(*) filter(where completed_at::date between p_period_start and p_period_end),
    'actions_overdue',count(*) filter(where status<>'done' and due_date<=p_period_end),
    'planned_minutes',coalesce(sum(estimated_minutes) filter(where planned_date between p_period_start and p_period_end),0),
    'completed_minutes',coalesce(sum(estimated_minutes) filter(where status='done' and completed_at::date between p_period_start and p_period_end),0)
  ) into v_metrics from public.actions where tenant_id=p_tenant;

  insert into public.reviews(tenant_id,user_id,period_type,period_start,period_end,metrics)
  values(p_tenant,auth.uid(),p_period_type,p_period_start,p_period_end,v_metrics)
  on conflict(tenant_id,user_id,period_type,period_start)
  do update set period_end=excluded.period_end,metrics=excluded.metrics
  returning id into v_id;
  return v_id;
end $$;

create or replace function public.accept_tenant_invitation(p_token uuid)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_inv public.tenant_invitations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentification requise'; end if;
  select * into v_inv from public.tenant_invitations where token=p_token and accepted_at is null and expires_at>now();
  if v_inv.id is null then raise exception 'Invitation invalide ou expirée'; end if;
  if lower(coalesce(v_inv.email,'')) <> lower(coalesce(auth.jwt()->>'email','')) then raise exception 'Cette invitation est destinée à une autre adresse email'; end if;
  insert into public.tenant_members(tenant_id,user_id,role,email) values(v_inv.tenant_id,auth.uid(),v_inv.role,v_inv.email)
  on conflict(tenant_id,user_id) do update set role=excluded.role,email=excluded.email;
  update public.tenant_invitations set accepted_at=now() where id=v_inv.id;
  return v_inv.tenant_id;
end $$;

create or replace function public.apply_ai_proposal(p_proposal uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v public.ai_proposals%rowtype; v_axis jsonb; v_project jsonb; v_milestone jsonb; v_action jsonb; v_axis_id uuid; v_project_id uuid; v_milestone_id uuid; v_count int:=0;
begin
  select * into v from public.ai_proposals where id=p_proposal for update;
  if v.id is null or v.status<>'pending' then raise exception 'Proposition indisponible'; end if;
  if not public.has_tenant_role(v.tenant_id,array['owner','admin','member']) then raise exception 'Accès refusé'; end if;

  if v.feature_code='objective_breakdown' then
    for v_axis in select * from jsonb_array_elements(coalesce(v.payload->'axes','[]'::jsonb)) loop
      insert into public.axes(tenant_id,objective_id,title,description)
      values(v.tenant_id,v.context_id,v_axis->>'title',v_axis->>'description') returning id into v_axis_id;
      v_count:=v_count+1;
      for v_project in select * from jsonb_array_elements(coalesce(v_axis->'projects','[]'::jsonb)) loop
        insert into public.projects(tenant_id,objective_id,axis_id,title,description,status,priority,target_date)
        values(v.tenant_id,v.context_id,v_axis_id,v_project->>'title',v_project->>'description','planned',
          coalesce(nullif(v_project->>'priority','')::public.priority_level,'medium'),
          case when (v_project->>'target_offset_days')~'^[0-9]+$' then current_date+(v_project->>'target_offset_days')::integer else null end);
        v_count:=v_count+1;
      end loop;
    end loop;
  elsif v.feature_code='project_actions' then
    for v_milestone in select * from jsonb_array_elements(coalesce(v.payload->'milestones','[]'::jsonb)) loop
      insert into public.milestones(tenant_id,project_id,title,description,due_date,weight)
      values(v.tenant_id,v.context_id,v_milestone->>'title',v_milestone->>'description',
        case when (v_milestone->>'target_offset_days')~'^[0-9]+$' then current_date+(v_milestone->>'target_offset_days')::integer else null end,
        coalesce(nullif(v_milestone->>'weight','')::numeric,1)) returning id into v_milestone_id;
      v_count:=v_count+1;
      for v_action in select * from jsonb_array_elements(coalesce(v_milestone->'actions','[]'::jsonb)) loop
        insert into public.actions(tenant_id,project_id,milestone_id,title,description,estimated_minutes,priority,impact_score)
        values(v.tenant_id,v.context_id,v_milestone_id,v_action->>'title',v_action->>'description',
          coalesce(nullif(v_action->>'estimated_minutes','')::integer,30),
          coalesce(nullif(v_action->>'priority','')::public.priority_level,'medium'),
          coalesce(nullif(v_action->>'impact_score','')::smallint,3));
        v_count:=v_count+1;
      end loop;
    end loop;
  else
    raise exception 'Cette proposition est informative et ne peut pas être appliquée automatiquement.';
  end if;
  update public.ai_proposals set status='applied',applied_at=now() where id=v.id;
  return jsonb_build_object('created',v_count,'feature',v.feature_code);
end $$;

create trigger trg_tenants_touch before update on public.tenants for each row execute function public.touch_updated_at();
create trigger trg_domains_touch before update on public.domains for each row execute function public.touch_updated_at();
create trigger trg_objectives_touch before update on public.objectives for each row execute function public.touch_updated_at();
create trigger trg_axes_touch before update on public.axes for each row execute function public.touch_updated_at();
create trigger trg_projects_touch before update on public.projects for each row execute function public.touch_updated_at();
create trigger trg_milestones_touch before update on public.milestones for each row execute function public.touch_updated_at();
create trigger trg_actions_touch before update on public.actions for each row execute function public.touch_updated_at();
create trigger trg_ideas_touch before update on public.ideas for each row execute function public.touch_updated_at();
create trigger trg_recurring_touch before update on public.recurring_rules for each row execute function public.touch_updated_at();
create trigger trg_subscriptions_touch before update on public.tenant_subscriptions for each row execute function public.touch_updated_at();

create trigger trg_last_owner before update or delete on public.tenant_members for each row execute function public.protect_last_owner();
create trigger trg_seat_limit before insert on public.tenant_members for each row execute function public.enforce_seat_limit();
create trigger trg_active_project_limit before insert or update of status on public.projects for each row execute function public.enforce_active_project_limit();
create trigger trg_action_completion before insert or update of status on public.actions for each row execute function public.set_action_completion();
create trigger trg_milestone_completion before insert or update of status on public.milestones for each row execute function public.set_milestone_completion();

create trigger trg_project_hierarchy before insert or update on public.projects for each row execute function public.validate_project_hierarchy();
create trigger trg_action_hierarchy before insert or update on public.actions for each row execute function public.validate_action_hierarchy();
create trigger trg_objective_tenant before insert or update on public.objectives for each row execute function public.assert_same_tenant('domain_id','domains');
create trigger trg_axis_tenant before insert or update on public.axes for each row execute function public.assert_same_tenant('objective_id','objectives');
create trigger trg_project_tenant before insert or update on public.projects for each row execute function public.assert_same_tenant('objective_id','objectives','axis_id','axes');
create trigger trg_milestone_tenant before insert or update on public.milestones for each row execute function public.assert_same_tenant('project_id','projects');
create trigger trg_action_tenant before insert or update on public.actions for each row execute function public.assert_same_tenant('project_id','projects','milestone_id','milestones','parent_action_id','actions','recurrence_rule_id','recurring_rules');
create trigger trg_dependency_tenant before insert or update on public.action_dependencies for each row execute function public.assert_same_tenant('action_id','actions','depends_on_action_id','actions');
create trigger trg_time_entry_tenant before insert or update on public.time_entries for each row execute function public.assert_same_tenant('action_id','actions');
create trigger trg_idea_tenant before insert or update on public.ideas for each row execute function public.assert_same_tenant('objective_id','objectives');

create trigger audit_domains after insert or update or delete on public.domains for each row execute function public.audit_row_change();
create trigger audit_objectives after insert or update or delete on public.objectives for each row execute function public.audit_row_change();
create trigger audit_axes after insert or update or delete on public.axes for each row execute function public.audit_row_change();
create trigger audit_projects after insert or update or delete on public.projects for each row execute function public.audit_row_change();
create trigger audit_milestones after insert or update or delete on public.milestones for each row execute function public.audit_row_change();
create trigger audit_actions after insert or update or delete on public.actions for each row execute function public.audit_row_change();

alter table public.subscription_plans enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_members enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.domains enable row level security;
alter table public.objectives enable row level security;
alter table public.axes enable row level security;
alter table public.projects enable row level security;
alter table public.milestones enable row level security;
alter table public.recurring_rules enable row level security;
alter table public.actions enable row level security;
alter table public.action_dependencies enable row level security;
alter table public.time_entries enable row level security;
alter table public.ideas enable row level security;
alter table public.reviews enable row level security;
alter table public.ai_proposals enable row level security;
alter table public.ai_usage_events enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_log enable row level security;

create policy plans_read on public.subscription_plans for select to authenticated using(is_active);
create policy tenant_read on public.tenants for select to authenticated using(public.is_tenant_member(id));
create policy tenant_update on public.tenants for update to authenticated using(public.has_tenant_role(id,array['owner','admin'])) with check(public.has_tenant_role(id,array['owner','admin']));
create policy members_read on public.tenant_members for select to authenticated using(public.is_tenant_member(tenant_id));
create policy members_manage on public.tenant_members for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin'])) with check(public.has_tenant_role(tenant_id,array['owner','admin']));
create policy invites_read on public.tenant_invitations for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin']));
create policy invites_manage on public.tenant_invitations for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin'])) with check(public.has_tenant_role(tenant_id,array['owner','admin']));

create policy domains_read on public.domains for select to authenticated using(public.is_tenant_member(tenant_id));
create policy domains_write on public.domains for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy objectives_read on public.objectives for select to authenticated using(public.is_tenant_member(tenant_id));
create policy objectives_write on public.objectives for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy axes_read on public.axes for select to authenticated using(public.is_tenant_member(tenant_id));
create policy axes_write on public.axes for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy projects_read on public.projects for select to authenticated using(public.is_tenant_member(tenant_id));
create policy projects_write on public.projects for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy milestones_read on public.milestones for select to authenticated using(public.is_tenant_member(tenant_id));
create policy milestones_write on public.milestones for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy recurring_read on public.recurring_rules for select to authenticated using(public.is_tenant_member(tenant_id));
create policy recurring_write on public.recurring_rules for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy actions_read on public.actions for select to authenticated using(public.is_tenant_member(tenant_id));
create policy actions_write on public.actions for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy dependencies_read on public.action_dependencies for select to authenticated using(public.is_tenant_member(tenant_id));
create policy dependencies_write on public.action_dependencies for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy time_entries_read on public.time_entries for select to authenticated using(public.is_tenant_member(tenant_id));
create policy time_entries_write on public.time_entries for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member']) and user_id=auth.uid()) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']) and user_id=auth.uid());
create policy ideas_read on public.ideas for select to authenticated using(public.is_tenant_member(tenant_id));
create policy ideas_write on public.ideas for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy reviews_read on public.reviews for select to authenticated using(public.is_tenant_member(tenant_id));
create policy reviews_write on public.reviews for all to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']) and user_id=auth.uid());
create policy proposals_read on public.ai_proposals for select to authenticated using(public.is_tenant_member(tenant_id));
create policy proposals_write on public.ai_proposals for insert to authenticated with check(public.has_tenant_role(tenant_id,array['owner','admin','member']) and created_by=auth.uid());
create policy proposals_update on public.ai_proposals for update to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin','member'])) with check(public.has_tenant_role(tenant_id,array['owner','admin','member']));
create policy ai_usage_read on public.ai_usage_events for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin']));
create policy ai_usage_insert on public.ai_usage_events for insert to authenticated with check(public.is_tenant_member(tenant_id) and user_id=auth.uid());
create policy subscription_read on public.tenant_subscriptions for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin']));
create policy notifications_read on public.notifications for select to authenticated using(public.is_tenant_member(tenant_id) and (user_id is null or user_id=auth.uid()));
create policy notifications_update on public.notifications for update to authenticated using(public.is_tenant_member(tenant_id) and (user_id is null or user_id=auth.uid())) with check(public.is_tenant_member(tenant_id) and (user_id is null or user_id=auth.uid()));
create policy audit_read on public.audit_log for select to authenticated using(public.has_tenant_role(tenant_id,array['owner','admin']));

-- Privilèges API (RLS reste la barrière d'autorisation)
grant usage on schema public to authenticated;
grant select on public.subscription_plans,public.project_progress,public.objective_progress,public.domain_progress,public.action_priority_scores to authenticated;
grant select,update on public.tenants to authenticated;
grant select,insert,update,delete on public.tenant_members,public.tenant_invitations,public.domains,public.objectives,public.axes,public.projects,public.milestones,public.recurring_rules,public.actions,public.action_dependencies,public.time_entries,public.ideas,public.reviews,public.ai_proposals,public.ai_usage_events,public.notifications to authenticated;
grant select on public.tenant_subscriptions,public.audit_log to authenticated;
grant execute on function public.bootstrap_personal_tenant(text),public.accept_tenant_invitation(uuid),public.generate_week_plan(uuid,date),public.create_review_snapshot(uuid,text,date,date),public.apply_ai_proposal(uuid) to authenticated;

commit;
