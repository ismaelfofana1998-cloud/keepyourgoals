-- KeepYourGoals chat-first v1 — nouveau projet Supabase mzxgpdwjklvoqsjclrtz.
-- Installer uniquement sur la NOUVELLE base vide ; ne pas exécuter par-dessus l'ancien modèle IKIGAI.
-- Le connecteur ChatGPT peut écrire en administration ; accès applicatif uniquement après liaison owner_user_id.
-- Aucune API d'IA n'est requise.

create table public.kyg_workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Mon espace',
  owner_user_id uuid references auth.users(id) on delete set null,
  timezone text not null default 'Europe/Paris',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kyg_workspaces_owner_idx on public.kyg_workspaces(owner_user_id);

create table public.kyg_goals (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kyg_workspaces(id),
  area text not null check (area in ('personal','business','professional')),
  subarea text,
  title text not null check (length(trim(title)) > 0),
  specific_outcome text,
  why_it_matters text,
  metric_name text,
  metric_unit text,
  measurement_method text,
  baseline_value numeric,
  target_value numeric,
  feasibility_notes text,
  start_date date not null default current_date,
  target_date date,
  status text not null default 'draft'
    check (status in ('draft','active','paused','achieved','archived')),
  priority smallint not null default 3 check (priority between 1 and 5),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyg_goals_target_date_check check (target_date is null or target_date >= start_date),
  constraint kyg_goals_id_workspace_unique unique(id,workspace_id)
);

create index kyg_goals_area_idx on public.kyg_goals(workspace_id,area,status);

create table public.kyg_milestones (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kyg_workspaces(id),
  goal_id uuid not null,
  horizon_months smallint not null check (horizon_months between 1 and 120),
  title text not null,
  expected_result text,
  acceptance_evidence text,
  due_date date not null,
  status text not null default 'proposed'
    check (status in ('proposed','planned','reached','missed','cancelled')),
  reached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (goal_id,workspace_id)
    references public.kyg_goals(id,workspace_id),
  constraint kyg_milestones_id_workspace_goal_unique unique(id,workspace_id,goal_id),
  constraint kyg_milestones_goal_horizon_unique unique(goal_id,horizon_months)
);

create index kyg_milestones_due_idx on public.kyg_milestones(workspace_id,due_date,status);

create table public.kyg_actions (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kyg_workspaces(id),
  goal_id uuid,
  milestone_id uuid,
  title text not null check (length(trim(title)) > 0),
  details text,
  status text not null default 'backlog'
    check (status in ('backlog','ready','in_progress','done','discarded')),
  is_focus boolean not null default false,
  planned_for date,
  due_date date,
  estimated_minutes smallint check (estimated_minutes between 5 and 480),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyg_actions_milestone_goal_check check (milestone_id is null or goal_id is not null),
  foreign key (goal_id,workspace_id)
    references public.kyg_goals(id,workspace_id),
  foreign key (milestone_id,workspace_id,goal_id)
    references public.kyg_milestones(id,workspace_id,goal_id)
);

create index kyg_actions_open_idx on public.kyg_actions(workspace_id,status,due_date,planned_for);
create unique index kyg_single_live_focus_idx on public.kyg_actions(workspace_id)
  where is_focus = true and status in ('ready','in_progress');

create table public.kyg_ideas (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kyg_workspaces(id),
  area text check (area in ('personal','business','professional')),
  subarea text,
  title text not null check (length(trim(title)) > 0),
  raw_text text,
  status text not null default 'parked'
    check (status in ('parked','activated','archived')),
  review_after date,
  last_reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index kyg_ideas_review_idx on public.kyg_ideas(workspace_id,status,review_after);

create table public.kyg_measurements (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kyg_workspaces(id),
  goal_id uuid not null,
  observed_on date not null,
  metric_value numeric,
  evidence_note text,
  created_at timestamptz not null default now(),
  foreign key (goal_id,workspace_id)
    references public.kyg_goals(id,workspace_id),
  constraint kyg_measurements_content_check check (metric_value is not null or nullif(trim(evidence_note),'') is not null)
);

create index kyg_measurements_goal_date_idx on public.kyg_measurements(workspace_id,goal_id,observed_on desc);

-- Toutes les tables publiques exigent l'authentification et l'appartenance au workspace.
alter table public.kyg_workspaces enable row level security;
alter table public.kyg_goals enable row level security;
alter table public.kyg_milestones enable row level security;
alter table public.kyg_actions enable row level security;
alter table public.kyg_ideas enable row level security;
alter table public.kyg_measurements enable row level security;

create policy kyg_workspaces_owner_all on public.kyg_workspaces
  for all to authenticated
  using (owner_user_id = (select auth.uid()))
  with check (owner_user_id = (select auth.uid()));

create policy kyg_goals_owner_all on public.kyg_goals
  for all to authenticated
  using (exists(select 1 from public.kyg_workspaces w
                where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
  with check (exists(select 1 from public.kyg_workspaces w
                     where w.id=workspace_id and w.owner_user_id=(select auth.uid())));

create policy kyg_milestones_owner_all on public.kyg_milestones
  for all to authenticated
  using (exists(select 1 from public.kyg_workspaces w
                where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
  with check (exists(select 1 from public.kyg_workspaces w
                     where w.id=workspace_id and w.owner_user_id=(select auth.uid())));

create policy kyg_actions_owner_all on public.kyg_actions
  for all to authenticated
  using (exists(select 1 from public.kyg_workspaces w
                where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
  with check (exists(select 1 from public.kyg_workspaces w
                     where w.id=workspace_id and w.owner_user_id=(select auth.uid())));

create policy kyg_ideas_owner_all on public.kyg_ideas
  for all to authenticated
  using (exists(select 1 from public.kyg_workspaces w
                where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
  with check (exists(select 1 from public.kyg_workspaces w
                     where w.id=workspace_id and w.owner_user_id=(select auth.uid())));

create policy kyg_measurements_owner_all on public.kyg_measurements
  for all to authenticated
  using (exists(select 1 from public.kyg_workspaces w
                where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
  with check (exists(select 1 from public.kyg_workspaces w
                     where w.id=workspace_id and w.owner_user_id=(select auth.uid())));

revoke all on public.kyg_workspaces,public.kyg_goals,public.kyg_milestones,
  public.kyg_actions,public.kyg_ideas,public.kyg_measurements from anon;
grant select,insert,update,delete on
  public.kyg_workspaces,public.kyg_goals,public.kyg_milestones,
  public.kyg_actions,public.kyg_ideas,public.kyg_measurements
  to authenticated;
