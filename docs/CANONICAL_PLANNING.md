# CANON — KeepYourGoals : boussole personnelle
Version 1.0 — 2026-11-03
Statut : **référence fonctionnelle canonique** pour les échanges ChatGPT, les données Supabase et les évolutions de l’application.

> Finalité : protéger l’attention, conserver les possibilités et transformer quelques ambitions choisies en résultats observables. **Ne jamais confondre sophistication de l’outil et progrès réel.**

## 1. Architecture des responsabilités

- **ChatGPT = interface naturelle et copilote de réflexion.** L’utilisateur exprime une intention dans le langage courant ; l’assistant aide à clarifier, classer, jalonner, arbitrer et propose une action à la fois. Lorsque le connecteur Supabase est disponible, les lectures et écritures ont lieu directement dans Supabase, sans API de modèle.
- **Supabase = source de vérité opérationnelle.** Les objectifs, jalons, actions, idées, statuts, dates et indicateurs sont persistés dans le projet `mzxgpdwjklvoqsjclrtz` (« Keep Yours Goals »). Ne pas considérer le contexte d’un chat comme une preuve de persistance.
- **GitHub = code et règles durables.** Dépôt `ismaelfofana1998-cloud/keepyourgoals`. Ce document est la spécification canonique. Ne modifier l’application que pour un besoin utilisateur confirmé et testé.
- **Application = seconde interface, pas un système concurrent.** À terme, elle lit et écrit les mêmes objets que le chat. Aucune autre base de vérité, aucune duplication des objectifs.
- **Aucune API OpenAI/Groq ni agent autonome à construire maintenant.** Préparer un futur adaptateur de planification qui propose des changements structurés, soumis aux mêmes validations métier et à la validation humaine ; l’API pourra être branchée ultérieurement sans refondre le modèle.

## 2. Les trois volets de vie

1. **Personnel** (`personal`) : santé, sport, relations, équilibre, argent personnel et **apprentissage** (`subarea=learning`, dont DSCG). L’apprentissage n’est pas un quatrième volet.
2. **Business** (`business`) : activités entrepreneuriales et leur rentabilité (ex. Doctracker, livraison, pressing).
3. **Professionnel** (`professional`) : carrière, emploi, candidatures, évolution dans le salariat et compétences propres à cette trajectoire.

Chaque objectif appartient à **un seul volet**, avec éventuellement une sous-catégorie libre. Ne pas créer de volets supplémentaires sans besoin réel. Une idée ne devient jamais un objectif actif par simple enregistrement.

## 3. Hiérarchie unique et minimale

```text
Volet de vie
  └── Grand objectif stratégique SMART (cap à 12 mois ou autre horizon explicite)
       ├── Jalon à 1 mois
       ├── Jalon à 3 mois
       ├── Jalon à 6 mois
       ├── Jalon à 12 mois
       └── Actions concrètes, liées si utile à un jalon
            └── UNE seule « prochaine action » affichée par défaut

Coffre à idées : flux indépendant ; sans échéance ni activation obligatoire.
```

Ne pas réintroduire par défaut les cinq menus « domaine → objectif → axe → projet → action » de l’ancien prototype. Axes/projets peuvent devenir des métadonnées ou des vues détaillées **seulement si** la complexité est utile. Le plan est long terme (objectif) → moyen terme (jalons) → court terme (actions) → maintenant (une action).

## 4. Définition d’un objectif SMART

Avant activation, rechercher avec la personne :
- **S — Spécifique :** résultat concret, périmètre et formulation non ambiguë.
- **M — Mesurable :** indicateur, méthode de mesure, valeur de départ (si connue), seuil cible, unité et source des preuves.
- **A — Atteignable :** ressources, contraintes et hypothèses réalistes ; ne jamais vendre comme certaine une cible non testée.
- **R — Pertinent :** pourquoi cela mérite du temps, valeur créée, compatibilité avec santé, travail et vie personnelle.
- **T — Temporel :** date de début, date cible et échéances des jalons.

Un élément manquant = **objectif au statut brouillon (`draft`)**, et non obligation d’inventer un chiffre. Poser **une seule question utile à la fois**. Présenter un plan proposé puis demander validation avant de l’activer.

Les jalons à **1 / 3 / 6 / 12 mois** se calculent à partir de la **date de départ explicite de l’objectif**, pas de la date courante à chaque affichage. Adapter ce cycle si l’utilisateur choisit une autre durée. Chaque jalon contient : livrable ou résultat attendu, critère d’acceptation vérifiable, échéance, statut. Ne pas prendre une activité (« faire de la prospection ») pour un résultat (« nombre de pilotes réellement actifs »).

## 5. Navigation et comportement du chat

**« J’ai une idée… »** → capturer dans le coffre, classer si possible, confirmer l’enregistrement ; aucun projet créé automatiquement. Un réexamen occasionnel et non culpabilisant peut être proposé ; le rejet, le report et l’archivage sont normaux.

**« Je veux atteindre… »** → identifier le volet, lire les objectifs existants pour éviter les doublons, clarifier le résultat SMART si nécessaire, proposer les jalons 1/3/6/12 mois puis les premières actions. Enregistrer le brouillon ; n’activer et ne programmer qu’après validation.

**« Qu’est-ce que je fais maintenant ? »** → lire les engagements et actions réels ; proposer **une seule action faisable**, avec durée indicative courte et justification minimale. Favoriser échéances incontournables, impact, dépendances et capacité du moment ; éviter le changement permanent de contexte.

**« C’est fait. »** → confirmer l’action visée si ambiguë ; la marquer terminée dans Supabase ; ne proposer la suivante qu’ensuite.

**« Faisons le point. »** → comparer réel et attendu, reconnaître les faits et les incertitudes, ajuster les jalons plutôt que créer une montagne de nouvelles tâches.

Ne pas afficher de tableaux complexes à l’ouverture. Arbre, historique, stratégies et toutes les autres actions restent consultables **sur demande**. Un jour sans action est autorisé ; les retards ne sont pas des fautes.

## 6. Règles d’arbitrage et anti-complexité

- **Une seule action visible par défaut**, aucune obligation de la faire immédiatement.
- Limiter les objectifs activement poursuivis à une capacité réaliste, négociée avec l’utilisateur ; ne jamais supprimer ni masquer définitivement des projets simplement parce qu’ils ne sont pas actifs.
- Ne pas transformer chaque nouvelle idée ou possibilité en nouveau projet, et ne pas déclencher des relances constantes.
- Pour chaque automatisation proposée : (1) quel problème récurrent réel résout-elle ? (2) peut-on fonctionner dans le chat ? (3) coût de construction et de maintenance ? (4) quel test concret prouvera sa valeur ?
- **Revue légère** hebdomadaire facultative ; **réévaluation stratégique** mensuelle ou sur demande. Un rappel n’est créé que s’il aide réellement à reprendre une décision ; éviter les notifications incessantes.
- Les chiffres, dates d’engagement et critères de succès proposés par l’assistant ne deviennent pas des faits ou obligations sans validation.
- Avant suppression/archivage destructif, demander accord. Garder les modifications auditées et réversibles lorsque c’est possible.

## 7. Premier objectif illustratif : Doctracker

- Volet : **Business** ; sous-catégorie : `doctracker`.
- Intention : « Rendre Doctracker rentable en douze mois. »
- Départ de référence initial : **2026-11-03** ; horizon illustratif : **2027-11-03**.
- **Statut initial : brouillon** tant que « rentable » n’est pas défini et qu’aucun plan chiffré n’est validé.
- Mesure **à discuter** : résultat mensuel des activités Doctracker après revenus réellement encaissés et **ensemble** des coûts pertinents (infrastructure, IA/OCR, support, commercial, etc.) ; convenir de la valorisation du temps de travail et de la durée de rentabilité soutenue. Ne pas faire passer un CA positif pour un bénéfice.
- 1 mois (2026-12-03) : définir modèle économique, coûts, proposition de valeur et tableau de mesure ; produire une base chiffrée vérifiable.
- 3 mois (2027-02-03) : valider l’usage réel avec des pilotes et clarifier le parcours de conversion ; démonstration via retours clients et métriques d’usage.
- 6 mois (2027-05-03) : éprouver commercialisation, rétention et coûts unitaires ; comparer revenu réel et coût de service.
- 12 mois (2027-11-03) : vérifier le critère de rentabilité **défini ensemble**, pas seulement des ventes isolées.
- Ces quatre jalons sont **des propositions de travail à discuter**, sans objectifs quantitatifs inventés ni promesse de résultat.

## 8. Modèle de données et interface future

Socle Supabase minimal séparé de l’ancien modèle : `kyg_workspaces` (propriétaire et fuseau), `kyg_goals` (volet, SMART, état), `kyg_milestones` (horizons et preuves), `kyg_actions` (tâches et focus unique), `kyg_ideas` (coffre et réexamen).

**États** : objectifs `draft / active / paused / achieved / archived` ; jalons `proposed / planned / reached / missed / cancelled` ; actions `backlog / ready / in_progress / done / discarded` ; idées `parked / activated / archived`. Les mises à jour sont ciblées par identifiants, sans écraser un objet voisin.

**Sécurité :** données de vie personnelle privées ; ne stocker dans GitHub que des règles et exemples non confidentiels. RLS par propriétaire sur les tables exposées, pas d’accès anonyme. Tant qu’aucun utilisateur Supabase Auth n’existe, seul le connecteur administrateur peut initialiser le coffre ; attacher explicitement le workspace au compte avant de donner accès à l’application.

**Future API de planification, facultative :** entrée en langage naturel → extraction d’intention → consultation du contexte minimal → **proposition structurée** (`area, goal, milestones, actions, confidence, unresolved_questions`) → validation humaine → écriture transactionnelle / journalisée. Le frontend n’a ni clé modèle ni droit d’exécuter des décisions IA directement. Même moteur de règles de validation pour chat et application.

**Attention à l’ancien frontend :** il cible encore l’ancienne structure `tenants/domains/objectives/axes/projects/actions` et une ancienne URL Supabase. Ne pas changer sa configuration vers le nouveau projet ni fusionner le code UI avant une adaptation et des tests réels. Préférer un adaptateur/migration contrôlé, sans doublons de données.

## 9. Critères de réussite de ce système

- Pouvoir capturer une idée en moins de 20 secondes, sans obligation de suite.
- Pouvoir connaître sa **prochaine action** en une requête, sans parcourir tous ses objectifs.
- Pour chaque objectif actif : indicateur, jalons datés, avancement réel explicable.
- Pouvoir faire une revue 1/3/6/12 mois sans reconstruire le contexte.
- Pouvoir fonctionner **sans API d’IA** ; l’application future ne doit être qu’une autre interface du même planning.
- S’arrêter d’ajouter des fonctionnalités quand l’organisation est suffisamment fluide.

## 10. Règle pour toute future conversation

Au début d’un travail KeepYourGoals : (1) consulter ce mémo dans GitHub si disponible, (2) lire l’état réel de Supabase, (3) proposer peu de choix et une seule action prioritaire, (4) persister les décisions validées, (5) ne faire évoluer le code qu’en cas de nécessité démontrée. Ce mémo prime les anciennes spécifications de produit en cas de conflit fonctionnel, sans court-circuiter les exigences de sécurité ni les instructions explicites récentes de l’utilisateur.
