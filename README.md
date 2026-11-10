# KeepYourGoals — Application autonome de pilotage d'objectifs

## Version intégrée — application autonome sur GitHub Pages

La [PR #2](https://github.com/ismaelfofana1998-cloud/keepyourgoals/pull/2), **fusionnée sur `main` le 10/11/2026** (commit `30d5f87`), remplace l'ancienne interface par KeepYourGoals **sans API d'IA obligatoire**, connectée au projet Supabase `mzxgpdwjklvoqsjclrtz`. Elle corrige l'ancienne configuration à l'origine d'une incompatibilité de connexion et de chargement.

**Site GitHub Pages :** https://ismaelfofana1998-cloud.github.io/keepyourgoals/ — [déploiement confirmé par GitHub Actions](https://github.com/ismaelfofana1998-cloud/keepyourgoals/actions/runs/42756614423). Le navigateur avec compte Auth n'est **pas encore testé** ; le site Vercel indiqué historiquement dans le profil GitHub n'a pas été vérifié.

- Connexion/création de compte Supabase Auth, redirection de confirmation d'e-mail.
- Volets et sous-volets dynamiques, objectifs SMART, jalons flexibles, actions et coffre à idées.
- **Calendrier semaine/mois**, accessible par le menu : tâches datées, ajout depuis un jour, modification, rattachement facultatif **volet (filtre) → objectif → jalon** ou tâche indépendante. Aucun changement de base de données requis. [Spécification et tests du calendrier](docs/CALENDAR.md).
- Une seule prochaine action visible par défaut.
- [Guide d'accès et de reprise des objectifs existants](docs/APP_ACCESS.md).
- Tests CI **réussis** : `node --check kyg-app.js`, `node tests/smoke.mjs` et `node tests/calendar.mjs` ([run #42756523570](https://github.com/ismaelfofana1998-cloud/keepyourgoals/actions/runs/42756523570)). Auth en navigateur et liaison de compte à tester avant validation fonctionnelle complète.
- L'espace initial prérempli dans Supabase n'est rattaché à **aucun utilisateur Auth**. L'association aux objectifs préexistants doit se faire uniquement après vérification de l'identité du compte créé. Il ne faut jamais le faire réclamer automatiquement au premier inscrit.

## Reprendre dans n'importe quelle conversation — point d'entrée unique

**[START_HERE.md — Prompt d'initialisation portable](START_HERE.md)**

Dans un nouveau chat, écrire simplement :

> Initialise KeepYourGoals à partir de https://github.com/ismaelfofana1998-cloud/keepyourgoals/blob/main/START_HERE.md et reprends mon organisation depuis Supabase.

Ce fichier dirige le nouvel assistant vers **ce dépôt GitHub** pour les règles et checkpoints, et vers **Supabase « Keep Yours Goals » — projet `mzxgpdwjklvoqsjclrtz`** pour les données personnelles réelles. La mémoire structurée privée `kyg_context_notes` enregistre les décisions et préférences durables qui ne sont pas des objectifs. Il n'est pas nécessaire de redonner ces références à chaque nouvelle conversation. Les contenus jamais sauvegardés dans les sources ne sont pas récupérables intégralement.

> **Source de vérité produit** : [Mémo canonique](docs/CANONICAL_PLANNING.md) · **Historique des apprentissages et de l'alignement** : [Checkpoints produit](docs/PRODUCT_ALIGNMENT.md).

KeepYourGoals est destiné à fonctionner **indépendamment de ChatGPT et sans modification du code à chaque utilisation**. Une personne peut personnaliser ses volets, objectifs SMART, horizons, jalons, actions et idées. L'interface masque la complexité et montre en priorité **une seule prochaine action**. ChatGPT est actuellement l'interface intelligente temporaire utilisée pour piloter une organisation personnelle et identifier, par l'usage, les besoins du produit final. L'IA par API pourra être ajoutée plus tard, sans devenir indispensable au fonctionnement manuel.

## Deux rôles complémentaires, deux rythmes

| Rôle de l'assistant | Quand | Résultat attendu |
| --- | --- | --- |
| **Frontend intelligent personnel** | Pendant l'usage quotidien dans le chat | Clarifier et organiser les objectifs, jalons, priorités et idées. Lire/écrire les données dans Supabase, sans créer de nouvelles fonctionnalités pour chaque utilisation. |
| **Développeur de KeepYourGoals** | Revue de produit hebdomadaire | Déduire des difficultés observées des besoins généralisables, comparer au code et à la base, implémenter les améliorations utiles avec tests et traçabilité, puis mettre à jour le checkpoint. |

**La boucle de développement est indépendante du chat :** les exigences découvertes dans les usages du chat nourrissent le produit, mais l'application ne doit jamais avoir besoin de ChatGPT pour exécuter une fonctionnalité. Un changement d'objectif est une **modification de données**, pas un commit. Les changements de code concernent uniquement les fonctionnalités réutilisables de l'application.

## Validation des livraisons : décision au checkpoint

**Développement autonome, intégration sous validation humaine.** Chaque semaine, le développeur peut coder, tester et préparer des **pull requests**, mais **ne fusionne jamais de code applicatif sur `main`, et ne déploie pas de nouvelle version sans accord explicite**. L'utilisateur n'a rien à piloter entre les revues ; à chaque checkpoint, il reçoit le bilan de la semaine, les tests effectués, les PR prêtes et une recommandation **MERGER / REPORTER / NE PAS MERGER**, puis décide. L'existence d'une PR ou d'une automatisation n'autorise pas le merge. Les fichiers de documentation du checkpoint peuvent être actualisés directement sur `main`.

## Checkpoint d'alignement courant — 10/11/2026

**Vision confirmée :** interface indépendante de ChatGPT, volets et objectifs personnalisables, une seule prochaine action mise en avant, et **Calendrier semaine/mois** avec création de tâches indépendantes ou rattachées à une cascade volet → objectif → jalon.

**Livré et vérifié :** la [PR #2](https://github.com/ismaelfofana1998-cloud/keepyourgoals/pull/2) a été **MERGÉE après accord explicite** (commit `30d5f87`) : connexion au bon projet Supabase, frontend autonome et calendrier. [CI réussie](https://github.com/ismaelfofana1998-cloud/keepyourgoals/actions/runs/42756523570) et [déploiement GitHub Pages réussi](https://github.com/ismaelfofana1998-cloud/keepyourgoals/actions/runs/42756614423). La [PR #1](https://github.com/ismaelfofana1998-cloud/keepyourgoals/pull/1) a été **clôturée SANS MERGE**, devenue obsolète et incompatible avec le nouveau schéma.

**Écart restant :** authentification et CRUD en navigateur non testés de bout en bout. Aucun compte Supabase Auth n'existe encore dans ce projet et l'espace initial avec les objectifs n'est pas rattaché ; il faudra créer le compte puis procéder à une liaison vérifiée. [Consignes de première connexion](docs/APP_ACCESS.md).

**Prochaine priorité unique :** tester le parcours réel inscription/connexion → rattachement du workspace → affichage des objectifs et création/édition d'une tâche depuis le calendrier. Ne pas réintroduire l'ancien frontend. Pour les PR futures, conserver l'approbation explicite avant chaque merge.

**Détail :** [checkpoint spécial du 10/11/2026](docs/PRODUCT_ALIGNMENT.md#checkpoint-exceptionnel--2026-11-10-validation-et-fusion).

## Ancien prototype — archive fonctionnelle (non alignée avec la nouvelle base)

Les sections historiques ci-dessous décrivent **IKIGAI Pilot 3.0**, son ancienne structure de tables et ses consignes de déploiement. Elles ne décrivent pas l'architecture cible actuelle ; **ne pas exécuter leurs scripts sur le nouveau projet Supabase**.

---

# IKIGAI Pilot 3.0 — Natural Focus

IKIGAI Pilot aide une personne submergée à rendre ses objectifs palpables sans lui demander de connaître la gestion de projet.

La hiérarchie reste :

**Domaine → Objectif → Axe → Projet → Action**

Mais l'utilisateur ne remplit plus ces niveaux un par un. Il écrit ce qu'il veut avec ses propres mots. L'aide intelligente :

1. comprend s'il s'agit d'un objectif, d'un projet, d'une action ou d'un ensemble de préoccupations ;
2. pose une seule question à la fois, uniquement si une information essentielle manque ;
3. limite le parcours à trois questions ;
4. range un vidage de tête par domaines ;
5. propose un arbre léger et visible ;
6. attend une validation humaine avant de créer quoi que ce soit ;
7. génère une première action qui alimente automatiquement la todo du jour.

## Expérience principale

La page **Mon chemin** est désormais l'écran d'ouverture.

Une grande zone naturelle permet d'écrire par exemple :

```text
Je veux évoluer professionnellement, terminer mon application et retrouver du temps pour moi.
```

Selon le contenu, l'application :

- pose une question simple ;
- range plusieurs préoccupations en domaines et demande laquelle traiter d'abord ;
- ou présente directement un arbre complet à valider.

L'utilisateur voit ensuite uniquement la branche ouverte et son pourcentage de progression.

## Moteurs IA pris en charge

### Groq — recommandé pour les tests

Le fournisseur par défaut est `groq`. Il permet de tester l'expérience sans configurer OpenAI.

Créer une clé Groq puis ajouter les secrets :

```bash
supabase secrets set GROQ_API_KEY=...
supabase secrets set GROQ_MODEL=openai/gpt-oss-20b
supabase secrets set GROQ_SAFETY_MODEL=openai/gpt-oss-safeguard-20b
```

### OpenAI

```bash
supabase secrets set OPENAI_API_KEY=...
supabase secrets set OPENAI_MODEL=gpt-5-mini
supabase secrets set OPENAI_MODERATION_MODEL=omni-moderation-latest
```

### Sélection

Dans les réglages de l'espace :

- `Groq` : aucun basculement vers OpenAI ;
- `OpenAI` : utilise uniquement OpenAI ;
- `Automatique` : essaie Groq en premier, puis OpenAI si Groq n'est pas configuré.

Pour éviter une consommation OpenAI involontaire pendant les tests, conserve `Groq` comme préférence.

## Garde-fous

Les contrôles fonctionnent quel que soit le fournisseur :

- authentification et contrôle du tenant ;
- quota mensuel ;
- suppression des champs ressemblant à des secrets ;
- contexte limité ;
- règles déterministes de détection des domaines sensibles ;
- modération du texte d'entrée et de la sortie ;
- modèle de sécurité Groq quand Groq est utilisé ;
- endpoint de modération OpenAI quand OpenAI est utilisé ;
- JSON Schema strict ;
- validation métier après génération ;
- une seule tentative de correction ;
- au maximum trois questions ;
- au maximum trois axes ;
- au maximum deux projets par axe ;
- au maximum trois premières actions par projet ;
- une seule première action prioritaire ;
- stockage dans `ai_proposals` ;
- aucune écriture dans l'arbre sans validation ;
- application SQL transactionnelle ;
- journal `ai_guardrail_events`.

## Mise à jour depuis IKIGAI Pilot 2.0

1. Sauvegarder la base Supabase.
2. Exécuter uniquement :

```text
sql/03_natural_intake_multi_provider.sql
```

3. Remplacer le dossier `public/`.
4. Remplacer :

```text
supabase/functions/ai-assistant/index.ts
```

5. Déployer :

```bash
supabase functions deploy ai-assistant
```

6. Ajouter au minimum la clé Groq :

```bash
supabase secrets set GROQ_API_KEY=...
```

7. Publier GitHub Pages et effectuer `Ctrl + F5`.

## Nouvelle installation

Exécuter dans cet ordre :

```text
sql/00_install.sql
sql/02_calm_focus_ai_guardrails.sql
sql/03_natural_intake_multi_provider.sql
```

`01_upgrade_from_mvp.sql` est uniquement destiné aux anciennes bases du prototype.

## Configuration frontend

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://TON_PROJET.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "sb_publishable_..."
};
```

Ne jamais placer une clé Groq, OpenAI, Stripe, `service_role` ou `sb_secret_...` dans `public/`.

## Aperçu

Ouvrir :

```text
public/preview.html
```

## Tests statiques

```bash
node --check public/app.js
node tests/smoke.mjs
```

## À tester avant ouverture publique

- appels réels Groq sur les parcours question, classement et proposition ;
- modèle de sécurité disponible dans l'organisation Groq ;
- politiques RLS avec plusieurs comptes ;
- migration sur une copie de la base ;
- ergonomie avec des utilisateurs réellement submergés ;
- compréhension des cartes sans explication ;
- sauvegardes, supervision et procédure d'incident.
