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

3. Mettre à jour les fichiers du site à la racine du dépôt.
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

Ne jamais placer une clé Groq, OpenAI, Stripe, `service_role` ou `sb_secret_...` dans les fichiers publics de ce dépôt.

## Aperçu

Ouvrir :

```text
public/preview.html
```

## Tests statiques

```bash
node --check app.js
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
