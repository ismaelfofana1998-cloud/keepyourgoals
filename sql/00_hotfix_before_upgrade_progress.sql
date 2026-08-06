-- Correctif pour les bases créées avec le MVP IKIGAI Pilot.
-- À exécuter uniquement si vous utilisez encore l'ancien fichier 01_upgrade_from_mvp.sql.
-- La migration 1.0.1 inclut déjà ce correctif.

begin;
drop view if exists public.domain_progress;
drop view if exists public.objective_progress;
drop view if exists public.project_progress;
commit;
