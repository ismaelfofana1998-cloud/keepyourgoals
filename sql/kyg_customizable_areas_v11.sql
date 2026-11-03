-- KeepYourGoals v1.1 — categories definies par les donnees, jamais par le code.
-- Migration additive avec reprise des classifications existantes.
-- A appliquer APRES sql/kyg_chat_first_v1.sql dans le projet mzxgpdwjklvoqsjclrtz.
-- Les donnees (Dont le brouillon Doctracker) sont conservees.

create table public.kyg_areas (
 id uuid primary key default gen_random_uuid(),
 workspace_id uuid not null references public.kyg_workspaces(id),
 parent_id uuid,
 name text not null check (length(trim(name)) > 0),
 position integer not null default 0,
 status text not null default 'active' check (status in ('active','archived')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint kyg_areas_id_workspace_unique unique(id,workspace_id),
 constraint kyg_areas_no_self_parent check (parent_id is null or parent_id <> id),
 foreign key (parent_id, workspace_id) references public.kyg_areas(id,workspace_id)
);

-- Autorise la personnalisation de l'arbre tout en evitant des doublons actifs.
create unique index kyg_areas_active_sibling_name_idx
 on public.kyg_areas (workspace_id, parent_id, lower(name))
 nulls not distinct where status = 'active';
create index kyg_areas_tree_idx
 on public.kyg_areas(workspace_id,parent_id,position);

alter table public.kyg_areas enable row level security;
create policy kyg_areas_owner_all on public.kyg_areas
 for all to authenticated
 using (exists (select 1 from public.kyg_workspaces w
                where w.id=workspace_id and w.owner_user_id=(select auth.uid())))
 with check (exists (select 1 from public.kyg_workspaces w
                     where w.id=workspace_id and w.owner_user_id=(select auth.uid())));
revoke all on public.kyg_areas from anon;
grant select,insert,update,delete on public.kyg_areas to authenticated;

-- Les 3 categories suivantes sont des donnees d'amorcage du workspace ACTUEL,
-- et non des valeurs reservees au niveau du modele.
insert into public.kyg_areas(workspace_id,name,position)
select w.id,v.name,v.position
from public.kyg_workspaces w
cross join (values ('Personnel',10),('Business',20),('Professionnel',30)) v(name,position)
on conflict do nothing;

-- Sous-categorie personnelle exprimee explicitement par l'utilisateur.
insert into public.kyg_areas(workspace_id,parent_id,name,position)
select a.workspace_id,a.id,'Apprentissage',10
from public.kyg_areas a where a.parent_id is null and a.name='Personnel'
on conflict do nothing;

-- Reprendre les sous-categories texte qui existaient avant cette migration.
with legacy as (
  select distinct workspace_id,area,subarea
  from public.kyg_goals
  where nullif(trim(subarea),'') is not null
  union
  select distinct workspace_id,area,subarea
  from public.kyg_ideas
  where nullif(trim(subarea),'') is not null and area is not null
)
insert into public.kyg_areas(workspace_id,parent_id,name,position)
select l.workspace_id,r.id,
  case when lower(l.subarea)='learning' then 'Apprentissage'
       when lower(l.subarea)='doctracker' then 'Doctracker'
       else initcap(replace(l.subarea,'_',' ')) end,20
from legacy l
join public.kyg_areas r on r.workspace_id=l.workspace_id
 and r.parent_id is null
 and r.name=(case l.area
     when 'personal' then 'Personnel'
     when 'business' then 'Business'
     when 'professional' then 'Professionnel' end)
on conflict do nothing;

alter table public.kyg_goals add column area_id uuid;
alter table public.kyg_ideas add column area_id uuid;

with mapping as (
 select g.id,coalesce(child.id,r.id) as area_id
 from public.kyg_goals g
 join public.kyg_areas r on r.workspace_id=g.workspace_id
     and r.parent_id is null
     and r.name=(case g.area when 'personal' then 'Personnel'
                 when 'business' then 'Business'
                 when 'professional' then 'Professionnel' end)
 left join public.kyg_areas child on child.workspace_id=g.workspace_id
     and child.parent_id=r.id
     and child.name=(case when lower(g.subarea)='learning' then 'Apprentissage'
                          when lower(g.subarea)='doctracker' then 'Doctracker'
                          else initcap(replace(g.subarea,'_',' ')) end)
)
update public.kyg_goals g set area_id=mapping.area_id
from mapping where g.id=mapping.id;

with mapping as (
 select i.id,coalesce(child.id,r.id) as area_id
 from public.kyg_ideas i
 join public.kyg_areas r on r.workspace_id=i.workspace_id
     and r.parent_id is null
     and r.name=(case i.area when 'personal' then 'Personnel'
                 when 'business' then 'Business'
                 when 'professional' then 'Professionnel' end)
 left join public.kyg_areas child on child.workspace_id=i.workspace_id
     and child.parent_id=r.id
     and child.name=(case when lower(i.subarea)='learning' then 'Apprentissage'
                          when lower(i.subarea)='doctracker' then 'Doctracker'
                          else initcap(replace(i.subarea,'_',' ')) end)
)
update public.kyg_ideas i set area_id=mapping.area_id
from mapping where i.id=mapping.id;

do $$ begin
 if exists(select 1 from public.kyg_goals where area_id is null) then
  raise exception 'Migration incomplete : des objectifs ne sont pas classes';
 end if;
 if exists(select 1 from public.kyg_ideas where area is not null and area_id is null) then
  raise exception 'Migration incomplete : des idees classees ont perdu leur categorie';
 end if;
end $$;

alter table public.kyg_goals alter column area_id set not null;
alter table public.kyg_goals
 add constraint kyg_goals_area_workspace_fkey
 foreign key (area_id,workspace_id) references public.kyg_areas(id,workspace_id);
alter table public.kyg_ideas
 add constraint kyg_ideas_area_workspace_fkey
 foreign key (area_id,workspace_id) references public.kyg_areas(id,workspace_id);

drop index if exists public.kyg_goals_area_idx;
create index kyg_goals_area_id_idx on public.kyg_goals(workspace_id,area_id,status);
create index kyg_ideas_area_id_idx on public.kyg_ideas(workspace_id,area_id,status);

-- Apres reprise controlee, supprimer l'ancienne classification figee.
alter table public.kyg_goals drop column area, drop column subarea;
alter table public.kyg_ideas drop column area, drop column subarea;
