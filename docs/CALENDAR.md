# Calendrier KeepYourGoals — spécification de la première intégration

## Objectif

Un nouvel onglet **Calendrier** dans la navigation de KeepYourGoals permet de consulter les tâches datées en **semaine** et en **mois** et d'en ajouter directement depuis un jour. Le calendrier utilise **les mêmes données Supabase `kyg_actions`** que « Maintenant » et les objectifs ; il ne crée pas une table d'agenda parallèle.

L'ajout d'une tâche, comme l'ajout d'un volet ou d'un objectif, est une **modification de données** : aucune intervention de développeur n'est nécessaire à chaque utilisation.

## Parcours utilisateur

1. Ouvrir **Calendrier** (barre latérale ou menu inférieur mobile).
2. Passer entre **Semaine** et **Mois**, reculer/avancer d'une période, ou revenir à **Aujourd'hui**.
3. Sélectionner une date pour voir toutes ses tâches. Cliquer sur une tâche pour la modifier (titre, statut, jour, échéance, rattachement, durée, priorité).
4. Cliquer **+ Tâche ce jour**, ou sur **+ Ajouter une tâche**, pour créer une tâche sur la date sélectionnée.
5. Choisir éventuellement le **volet** comme filtre, puis **l'objectif parent** et éventuellement **un jalon de cet objectif**. Le jalon proposé appartient forcément à l'objectif choisi : le changement d'objectif réinitialise le jalon.
6. Si aucun objectif n'est choisi, la tâche demeure **indépendante** (elle n'est pas artificiellement rattachée à un objectif ou volet). L'indication de volet ne sert alors qu'au filtrage du choix d'objectif.
7. Retrouver les tâches sans date dans « Voir les tâches sans date ». Un lien « Voir l'objectif » permet de revenir au niveau stratégique lorsqu'il existe.

Le parcours accepte les tâches de tous statuts, y compris « Plus tard » et « Terminée » : elles figurent dans l'agenda sans déclencher de notifications.

## Règles de données

| Concept | Champ de `public.kyg_actions` |
| --- | --- |
| Espace privé | `workspace_id` |
| Objectif parent, facultatif | `goal_id` (nullable) |
| Jalon, facultatif | `milestone_id` (nullable, cohérent avec `goal_id`) |
| Jour choisi dans le calendrier | `planned_for` (date) |
| Échéance, pouvant être différente du jour de travail | `due_date` (date) |
| Durée estimée | `estimated_minutes` |
| Avancement | `status`, `completed_at` |
| Unique prochaine action | `is_focus` |

Le jour de classement de la tâche est **`planned_for` si renseigné, sinon `due_date`**. Ne pas présenter deux copies d'une même tâche lorsque la date prévue et l'échéance diffèrent : le jour prévu gagne, l'échéance reste mentionnée dans la description. Une tâche sans aucune de ces deux dates reste accessible dans la section **Sans date**.

**Cascade :** le volet est chargé depuis `kyg_areas` ; le choix d'un volet filtre les objectifs de ce volet et de ses sous-volets ; le choix de l'objectif filtre les jalons de `kyg_milestones`. Le code vérifie aussi le couple objectif/jalon avant la sauvegarde ; les clés étrangères Supabase protègent les données. Aucune catégorie utilisateur n'est codée en dur.

**Aucun changement de schéma requis** dans le projet `mzxgpdwjklvoqsjclrtz`. Toutes les colonnes nécessaires existent déjà ; aucun enregistrement de production n'a été modifié par ce développement.

## Simplicité et limites conscientes

- Calendrier **par jour**, pas encore de gestion d'heures/minutes de début et de fin : l'utilisateur a demandé un calendrier *ou une sorte d'emploi du temps* pour visualiser les tâches. Le passage à une grille horaire pourra être ajouté **si le besoin se confirme**, avec un modèle de créneaux tenant compte du fuseau horaire.
- Pas de récurrence automatique, synchronisation Google Calendar, notification permanente, IA payante ou création spontanée d'obligations : ce sont des fonctionnalités distinctes, non présumées nécessaires.
- L'interface mobile utilise une grille semaine/mois à défilement horizontal, puis le détail vertical du jour choisi.
- Les actions de l'objectif ne sont pas dupliquées, car le calendrier, la vue des objectifs et « Maintenant » lisent le même `kyg_actions`.

## Déploiement et tests

Le calendrier est intégré à `main` par la **[PR #2](https://github.com/ismaelfofana1998-cloud/keepyourgoals/pull/2)**, fusionnée le 10/11/2026 avec l'accord explicite de l'utilisateur (commit `30d5f87`). **Déploiement GitHub Pages réussi** sur https://ismaelfofana1998-cloud.github.io/keepyourgoals/ ; les futures PR nécessitent toujours un accord de merge distinct.

Vérifications prévues par CI :
- `node --check kyg-app.js`
- `node tests/smoke.mjs`
- `node tests/calendar.mjs`

Les tests du calendrier couvrent les lundis, passages d'année et heure d'été, jours planifiés vs échéances, création indépendante, rattachement à un objectif et à un jalon valide, rejet des jalons d'un autre objectif, filtres de volets, affichage des tâches et navigation semaine/mois.

**Restant à vérifier sur un navigateur connecté :** inscription/connexion au nouveau projet Supabase, autorisations RLS, création et modification réelle d'une tâche indépendante et liée à un jalon, fonctionnement mobile. La publication de l'interface ne constitue pas une preuve de ces parcours. Pour retrouver les objectifs déjà saisis via ChatGPT, il faudra rattacher l'espace Supabase initial au compte Auth vérifié, selon `docs/APP_ACCESS.md`.
