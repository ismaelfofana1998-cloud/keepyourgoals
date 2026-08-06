begin;

alter table public.tenants
  add column if not exists ai_provider_preference text not null default 'groq'
  check (ai_provider_preference in ('groq','openai','auto'));

alter table public.ai_usage_events
  add column if not exists provider text;

alter table public.tenants alter column ai_enabled set default true;
alter table public.tenants alter column ai_monthly_request_limit set default 50;

update public.tenants
set ai_enabled = true,
    ai_provider_preference = coalesce(ai_provider_preference,'groq'),
    ai_monthly_request_limit = greatest(ai_monthly_request_limit,50);

create table if not exists public.ai_intake_sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  raw_text text not null,
  answers jsonb not null default '[]'::jsonb,
  question_count smallint not null default 0 check (question_count between 0 and 3),
  status text not null default 'active' check (status in ('active','proposed','cancelled','completed')),
  last_question jsonb,
  proposal_id uuid references public.ai_proposals(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_intake_sessions_tenant_user_idx
  on public.ai_intake_sessions(tenant_id,user_id,updated_at desc);

alter table public.ai_intake_sessions enable row level security;

drop policy if exists ai_intake_sessions_select on public.ai_intake_sessions;
create policy ai_intake_sessions_select on public.ai_intake_sessions
for select to authenticated
using (public.has_tenant_role(tenant_id,array['owner','admin','member','viewer']));

drop policy if exists ai_intake_sessions_insert on public.ai_intake_sessions;
create policy ai_intake_sessions_insert on public.ai_intake_sessions
for insert to authenticated
with check (
  user_id=auth.uid()
  and public.has_tenant_role(tenant_id,array['owner','admin','member'])
);

drop policy if exists ai_intake_sessions_update on public.ai_intake_sessions;
create policy ai_intake_sessions_update on public.ai_intake_sessions
for update to authenticated
using (user_id=auth.uid() and public.has_tenant_role(tenant_id,array['owner','admin','member']))
with check (user_id=auth.uid() and public.has_tenant_role(tenant_id,array['owner','admin','member']));

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

  if v.feature_code in ('clarify_goal','natural_intake') then
    if v.feature_code='natural_intake' then
      v_domain := coalesce(v.payload->'branch'->'domain','{}'::jsonb);
      v_objective := coalesce(v.payload->'branch'->'objective','{}'::jsonb);
    else
      v_domain := coalesce(v.payload->'domain','{}'::jsonb);
      v_objective := coalesce(v.payload->'objective','{}'::jsonb);
    end if;

    if length(trim(coalesce(v_domain->>'title',''))) < 2 or length(trim(coalesce(v_objective->>'title',''))) < 3 then
      raise exception 'Proposition incomplète';
    end if;

    if coalesce(v_domain->>'existing_domain_id','') ~ '^[0-9a-fA-F-]{36}$' then
      select id into v_domain_id from public.domains
      where id=(v_domain->>'existing_domain_id')::uuid and tenant_id=v.tenant_id and status<>'archived';
    end if;

    if v_domain_id is null then
      v_color := coalesce(nullif(v_domain->>'color',''),'#173B68');
      insert into public.domains(tenant_id,name,description,color,icon)
      values(v.tenant_id,left(v_domain->>'title',120),left(coalesce(v_domain->>'description',''),500),v_color,left(coalesce(v_domain->>'icon','◇'),8))
      returning id into v_domain_id;
      v_count := v_count + 1;
    end if;

    insert into public.objectives(tenant_id,domain_id,title,description,horizon,target_date,success_metric,priority,status)
    values(
      v.tenant_id,v_domain_id,left(v_objective->>'title',180),left(coalesce(v_objective->>'description',''),1000),
      case when v_objective->>'horizon' in ('life','five_years','three_years','year','quarter','month') then v_objective->>'horizon' else 'year' end,
      case when coalesce(v_objective->>'target_offset_days','') ~ '^[0-9]+$' then current_date + (v_objective->>'target_offset_days')::integer else null end,
      left(coalesce(v_objective->>'success_metric',''),500),'medium','active'
    ) returning id into v_objective_id;
    v_count := v_count + 1;

    if v.feature_code='natural_intake' then
      for v_axis in select * from jsonb_array_elements(coalesce(v.payload->'branch'->'axes','[]'::jsonb)) limit 3 loop
        if length(trim(coalesce(v_axis->>'title',''))) >= 2 then
          insert into public.axes(tenant_id,objective_id,title,description)
          values(v.tenant_id,v_objective_id,left(v_axis->>'title',160),left(coalesce(v_axis->>'description',''),700))
          returning id into v_axis_id;
          v_count := v_count + 1;

          for v_project in select * from jsonb_array_elements(coalesce(v_axis->'projects','[]'::jsonb)) limit 2 loop
            if length(trim(coalesce(v_project->>'title',''))) >= 3 then
              insert into public.projects(tenant_id,objective_id,axis_id,title,description,status,priority,target_date)
              values(
                v.tenant_id,v_objective_id,v_axis_id,left(v_project->>'title',180),left(coalesce(v_project->>'outcome',''),1000),'planned',
                case when v_project->>'priority' in ('low','medium','high','critical') then (v_project->>'priority')::public.priority_level else 'medium'::public.priority_level end,
                case when coalesce(v_project->>'target_offset_days','') ~ '^[0-9]+$' then current_date+(v_project->>'target_offset_days')::integer else null end
              ) returning id into v_project_id;
              v_count := v_count + 1;

              for v_action in select * from jsonb_array_elements(coalesce(v_project->'actions','[]'::jsonb)) limit 3 loop
                if length(trim(coalesce(v_action->>'title',''))) >= 3 then
                  insert into public.actions(tenant_id,project_id,title,description,estimated_minutes,priority,impact_score,planned_date,is_main)
                  values(
                    v.tenant_id,v_project_id,left(v_action->>'title',180),left(coalesce(v_action->>'description',''),1000),
                    greatest(5,least(120,coalesce(nullif(v_action->>'estimated_minutes','')::integer,30))),
                    case when v_action->>'priority' in ('low','medium','high','critical') then (v_action->>'priority')::public.priority_level else 'medium'::public.priority_level end,
                    greatest(1,least(5,coalesce(nullif(v_action->>'impact_score','')::smallint,3))),
                    case when coalesce(v_action->>'schedule_offset_days','') ~ '^[0-9]+$' then current_date+(v_action->>'schedule_offset_days')::integer else null end,
                    coalesce((v_action->>'is_first')::boolean,false)
                  );
                  v_count := v_count + 1;
                end if;
              end loop;
            end if;
          end loop;
        end if;
      end loop;
    else
      for v_axis in select * from jsonb_array_elements(coalesce(v.payload->'axes','[]'::jsonb)) limit 4 loop
        if length(trim(coalesce(v_axis->>'title',''))) >= 2 then
          insert into public.axes(tenant_id,objective_id,title,description)
          values(v.tenant_id,v_objective_id,left(v_axis->>'title',160),left(coalesce(v_axis->>'description',''),700));
          v_count := v_count + 1;
        end if;
      end loop;
    end if;

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
  update public.ai_intake_sessions set status='completed',updated_at=now() where proposal_id=v.id;
  return jsonb_build_object('created',v_count,'feature',v.feature_code,'domain_id',v_domain_id,'objective_id',v_objective_id);
end $$;

grant execute on function public.apply_ai_proposal(uuid) to authenticated;

commit;
