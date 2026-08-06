-- IKIGAI Pilot 2.0 — expérience focus + garde-fous IA
-- À exécuter après 00_install.sql ou 01_upgrade_from_mvp.sql.
-- Idempotent : peut être relancé après correction d'une erreur.

begin;

alter table public.ai_proposals add column if not exists risk_level text not null default 'low';
alter table public.ai_proposals add column if not exists guardrail_state text not null default 'validated';
alter table public.ai_proposals add column if not exists requires_professional_review boolean not null default false;
alter table public.ai_proposals add column if not exists input_excerpt text;
alter table public.ai_proposals add column if not exists expires_at timestamptz not null default (now() + interval '30 days');

create table if not exists public.daily_checkins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null default current_date,
  energy_level smallint not null default 3 check (energy_level between 1 and 5),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(tenant_id,user_id,checkin_date)
);

create table if not exists public.ai_guardrail_events (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  request_id uuid not null default gen_random_uuid(),
  feature_code text not null,
  context_type text,
  context_id uuid,
  input_risk_level text not null default 'low',
  moderation_flagged boolean not null default false,
  moderation_categories jsonb not null default '{}'::jsonb,
  validator_state text not null default 'pending',
  blocked_reason text,
  prompt_version text not null default 'focus-v2',
  schema_version text not null default '2.0',
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_daily_checkins_lookup on public.daily_checkins(tenant_id,user_id,checkin_date);
create index if not exists idx_guardrails_tenant_created on public.ai_guardrail_events(tenant_id,created_at desc);

alter table public.daily_checkins enable row level security;
alter table public.ai_guardrail_events enable row level security;

drop policy if exists daily_checkins_read on public.daily_checkins;
create policy daily_checkins_read on public.daily_checkins for select to authenticated
using (public.is_tenant_member(tenant_id) and user_id=auth.uid());

drop policy if exists daily_checkins_write on public.daily_checkins;
create policy daily_checkins_write on public.daily_checkins for all to authenticated
using (public.has_tenant_role(tenant_id,array['owner','admin','member']) and user_id=auth.uid())
with check (public.has_tenant_role(tenant_id,array['owner','admin','member']) and user_id=auth.uid());

drop policy if exists guardrails_read on public.ai_guardrail_events;
create policy guardrails_read on public.ai_guardrail_events for select to authenticated
using (public.has_tenant_role(tenant_id,array['owner','admin']));

drop policy if exists guardrails_insert on public.ai_guardrail_events;
create policy guardrails_insert on public.ai_guardrail_events for insert to authenticated
with check (public.is_tenant_member(tenant_id) and user_id=auth.uid());

grant select,insert,update,delete on public.daily_checkins to authenticated;
grant select,insert on public.ai_guardrail_events to authenticated;
grant usage,select on sequence public.ai_guardrail_events_id_seq to authenticated;

create or replace function public.touch_daily_checkin()
returns trigger language plpgsql as $$
begin new.updated_at=now(); return new; end $$;

drop trigger if exists trg_daily_checkins_touch on public.daily_checkins;
create trigger trg_daily_checkins_touch before update on public.daily_checkins
for each row execute function public.touch_daily_checkin();

create or replace function public.apply_ai_proposal(p_proposal uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare
  v public.ai_proposals%rowtype;
  v_domain jsonb;
  v_objective jsonb;
  v_axis jsonb;
  v_project jsonb;
  v_action jsonb;
  v_domain_id uuid;
  v_objective_id uuid;
  v_axis_id uuid;
  v_project_id uuid;
  v_parent_action public.actions%rowtype;
  v_count integer := 0;
  v_color text;
begin
  select * into v from public.ai_proposals where id=p_proposal for update;
  if v.id is null then raise exception 'Proposition introuvable'; end if;
  if v.status <> 'pending' then raise exception 'Cette proposition a déjà été traitée'; end if;
  if v.expires_at < now() then raise exception 'Cette proposition a expiré'; end if;
  if not public.has_tenant_role(v.tenant_id,array['owner','admin','member']) then raise exception 'Accès refusé'; end if;
  if v.guardrail_state <> 'validated' then raise exception 'La proposition n’a pas validé les garde-fous'; end if;
  if v.risk_level in ('high','critical') or v.requires_professional_review then
    raise exception 'Cette proposition doit rester informative et ne peut pas modifier automatiquement le plan';
  end if;

  if v.feature_code='clarify_goal' then
    v_domain := coalesce(v.payload->'domain','{}'::jsonb);
    v_objective := coalesce(v.payload->'objective','{}'::jsonb);
    if length(trim(coalesce(v_domain->>'title',''))) < 2 or length(trim(coalesce(v_objective->>'title',''))) < 3 then
      raise exception 'Proposition incomplète';
    end if;
    v_color := coalesce(nullif(v_domain->>'color',''),'#173B68');
    insert into public.domains(tenant_id,name,description,color,icon)
    values(v.tenant_id,left(v_domain->>'title',120),left(coalesce(v_domain->>'description',''),500),v_color,left(coalesce(v_domain->>'icon','◇'),8))
    returning id into v_domain_id;
    v_count := v_count + 1;

    insert into public.objectives(tenant_id,domain_id,title,description,horizon,target_date,success_metric,priority,status)
    values(
      v.tenant_id,v_domain_id,left(v_objective->>'title',180),left(coalesce(v_objective->>'description',''),1000),
      case when v_objective->>'horizon' in ('life','five_years','three_years','year','quarter','month') then v_objective->>'horizon' else 'year' end,
      case when coalesce(v_objective->>'target_offset_days','') ~ '^[0-9]+$' then current_date + (v_objective->>'target_offset_days')::integer else null end,
      left(coalesce(v_objective->>'success_metric',''),500),'medium','active'
    ) returning id into v_objective_id;
    v_count := v_count + 1;

    for v_axis in select * from jsonb_array_elements(coalesce(v.payload->'axes','[]'::jsonb)) limit 4 loop
      if length(trim(coalesce(v_axis->>'title',''))) >= 2 then
        insert into public.axes(tenant_id,objective_id,title,description)
        values(v.tenant_id,v_objective_id,left(v_axis->>'title',160),left(coalesce(v_axis->>'description',''),700));
        v_count := v_count + 1;
      end if;
    end loop;

  elsif v.feature_code='suggest_axes' then
    select id into v_objective_id from public.objectives where id=v.context_id and tenant_id=v.tenant_id;
    if v_objective_id is null then raise exception 'Objectif introuvable'; end if;
    for v_axis in select * from jsonb_array_elements(coalesce(v.payload->'axes','[]'::jsonb)) limit 4 loop
      if length(trim(coalesce(v_axis->>'title',''))) >= 2 then
        insert into public.axes(tenant_id,objective_id,title,description)
        values(v.tenant_id,v_objective_id,left(v_axis->>'title',160),left(coalesce(v_axis->>'description',''),700));
        v_count := v_count + 1;
      end if;
    end loop;

  elsif v.feature_code='suggest_projects' then
    select a.id,a.objective_id into v_axis_id,v_objective_id
    from public.axes a where a.id=v.context_id and a.tenant_id=v.tenant_id;
    if v_axis_id is null then raise exception 'Axe introuvable'; end if;
    for v_project in select * from jsonb_array_elements(coalesce(v.payload->'projects','[]'::jsonb)) limit 3 loop
      if length(trim(coalesce(v_project->>'title',''))) >= 3 then
        insert into public.projects(tenant_id,objective_id,axis_id,title,description,status,priority,target_date)
        values(
          v.tenant_id,v_objective_id,v_axis_id,left(v_project->>'title',180),left(coalesce(v_project->>'outcome',v_project->>'description',''),1000),'planned',
          case when v_project->>'priority' in ('low','medium','high','critical') then (v_project->>'priority')::public.priority_level else 'medium'::public.priority_level end,
          case when coalesce(v_project->>'target_offset_days','') ~ '^[0-9]+$' then current_date+(v_project->>'target_offset_days')::integer else null end
        );
        v_count := v_count + 1;
      end if;
    end loop;

  elsif v.feature_code='suggest_actions' then
    select id into v_project_id from public.projects where id=v.context_id and tenant_id=v.tenant_id;
    if v_project_id is null then raise exception 'Projet introuvable'; end if;
    for v_action in select * from jsonb_array_elements(coalesce(v.payload->'actions','[]'::jsonb)) limit 3 loop
      if length(trim(coalesce(v_action->>'title',''))) >= 3 then
        insert into public.actions(tenant_id,project_id,title,description,estimated_minutes,priority,impact_score)
        values(
          v.tenant_id,v_project_id,left(v_action->>'title',180),left(coalesce(v_action->>'description',''),1000),
          greatest(5,least(120,coalesce(nullif(v_action->>'estimated_minutes','')::integer,30))),
          case when v_action->>'priority' in ('low','medium','high','critical') then (v_action->>'priority')::public.priority_level else 'medium'::public.priority_level end,
          greatest(1,least(5,coalesce(nullif(v_action->>'impact_score','')::smallint,3)))
        );
        v_count := v_count + 1;
      end if;
    end loop;

  elsif v.feature_code='split_action' then
    select * into v_parent_action from public.actions where id=v.context_id and tenant_id=v.tenant_id;
    if v_parent_action.id is null then raise exception 'Action introuvable'; end if;
    for v_action in select * from jsonb_array_elements(coalesce(v.payload->'child_actions','[]'::jsonb)) limit 3 loop
      if length(trim(coalesce(v_action->>'title',''))) >= 3 then
        insert into public.actions(tenant_id,project_id,milestone_id,parent_action_id,title,description,estimated_minutes,priority,impact_score)
        values(
          v.tenant_id,v_parent_action.project_id,v_parent_action.milestone_id,v_parent_action.id,left(v_action->>'title',180),left(coalesce(v_action->>'description',''),1000),
          greatest(5,least(60,coalesce(nullif(v_action->>'estimated_minutes','')::integer,20))),v_parent_action.priority,v_parent_action.impact_score
        );
        v_count := v_count + 1;
      end if;
    end loop;

  else
    raise exception 'Cette proposition est informative et ne peut pas modifier automatiquement le plan';
  end if;

  update public.ai_proposals set status='applied',applied_at=now() where id=v.id;
  return jsonb_build_object('created',v_count,'feature',v.feature_code);
end $$;

grant execute on function public.apply_ai_proposal(uuid) to authenticated;

commit;
