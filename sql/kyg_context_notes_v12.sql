-- KeepYourGoals v1.2: mémoire opérationnelle privée et portable entre conversations.
-- Aucun historique brut de chat ; uniquement des décisions, contraintes ou faits stables utiles.
-- Les données privées restent dans Supabase ; seuls ce schéma et le protocole figurent dans GitHub.

create table public.kyg_context_notes (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.kyg_workspaces(id),
  context_key text not null check (length(trim(context_key)) > 0),
  kind text not null default 'preference'
    check (kind in ('preference','decision','constraint','reference','handoff')),
  summary text not null check (length(trim(summary)) > 0),
  status text not null default 'active'
    check (status in ('active','superseded','archived')),
  source_note text,
  observed_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint kyg_context_notes_unique_key unique(workspace_id,context_key)
);

create index kyg_context_notes_lookup_idx
  on public.kyg_context_notes(workspace_id,status,kind,updated_at desc);

alter table public.kyg_context_notes enable row level security;

create policy kyg_context_notes_owner_all on public.kyg_context_notes
  for all to authenticated
  using (exists (
    select 1 from public.kyg_workspaces w
    where w.id = workspace_id and w.owner_user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.kyg_workspaces w
    where w.id = workspace_id and w.owner_user_id = (select auth.uid())
  ));

revoke all on public.kyg_context_notes from anon;
grant select,insert,update,delete on public.kyg_context_notes to authenticated;
