# CANON — KeepYourGoals : boussole personnelle
Version 1.3 — 2026-11-03
Statut : **référence fonctionnelle canonique** pour les échanges ChatGPT, les données Supabase et les évolutions de l’application.

> Finalité : protéger l’attention, conserver les possibilités et transformer quelques ambitions choisies en résultats observables. **Ne jamais confondre sophistication de l’outil et progrès réel.**

## 1. Architecture et indépendance du produit

**Produit final visé : une application autonome et universelle.** Le chat ChatGPT est une **passerelle de conception et de pilotage personnel temporaire**, choisie pour éviter aujourd'hui des dépenses API. Il n'est **ni le moteur obligatoire**, ni l'interface définitive, ni le détenteur exclusif des règles métier.

- **Application autonome (produit principal à terme).** Une personne peut créer ses propres volets et sous-volets, objectifs SMART, jalons, actions et idées, les modifier, les archiver et les suivre sans chat, sans changement de code, sans nouvel écran codé à chaque création. L'utilisateur n'a pas besoin d'un développeur pour enregistrer un nouveau domaine ou objectif.
- **ChatGPT (interface provisoire de l'utilisateur actuel).** Aide à clarifier, prioriser et jalonner depuis le chat ; écrit et lit la même base par connecteur Supabase. Ce mode n'est **pas obligatoire** pour les autres utilisateurs et ne doit jamais être une dépendance de l'application.
- **Supabase (source de vérité et règles partagées).** Les catégories et objets structurés sont dans des tables métier. Projet : `mzxgpdwjklvoqsjclrtz`. Pas de stockage métier faisant autorité uniquement dans une conversation.
- **GitHub (code, migrations et règles).** Dépôt `ismaelfofana1998-cloud/keepyourgoals` ; ce mémo vaut spécification produit transversale.
- **IA embarquée (capacité future, optionnelle).** À terme, un fournisseur de modèle configurable pourrait transformer du langage naturel en propositions SMART, catégories, jalons et tâches. L'assistant intégré utilise **exactement les mêmes modèles de données, contrôles et validations** que le mode manuel. Aucune implémentation d'API de modèle ni frais API maintenant.

**Trois capacités distinctes :** (1) gestion manuelle complète sans IA, (2) assistance ChatGPT temporaire avec connecteur pendant la conception, (3) assistance IA native future si les coûts et la valeur le justifient. L'application fonctionne même lorsque (2) et (3) sont indisponibles.

## 2. Volets et sous-volets entièrement personnalisables

Aucun volet n'est figé dans le code, les règles SQL ou les formulaires. **Chaque utilisateur peut** créer, renommer, ordonner, archiver et réorganiser ses volets et sous-volets. Les volets dépendent de l'espace utilisateur (`workspace_id`) : **« Personnel / Business / Professionnel » est uniquement la classification initiale choisie par l'utilisateur actuel.** Un autre utilisateur peut choisir un seul volet « Vie », cinq volets différents, ou aucun au démarrage.

**Exemple de paramétrage actuel, non universel :**
- **Personnel** : santé, sport, équilibre, finances personnelles ; **Apprentissage** en sous-volet pour DSCG ou d'autres formations.
- **Business** : création d'entreprise, Doctracker et autres activités (Doctracker peut être un sous-volet).
- **Professionnel** : carrière salariée, compétences professionnelles, candidatures.

**Schéma** : `kyg_areas(id,workspace_id,parent_id,name,position,status)`. La catégorisation d'un objectif se fait par `kyg_goals.area_id` (clé étrangère vers une catégorie du **même workspace**) ; une idée peut être sans catégorie ou référencer `kyg_ideas.area_id`. On ne code **jamais** de contrainte de type `area IN ('personal','business','professional')`. Les libellés appartiennent à l'utilisateur, et les filtres/menu/arbre de l'application sont construits à partir des données.

**Objectifs entièrement personnalisables également :** titre, résultat SMART, mesure, valeur initiale/cible, unité, date de départ/cible, priorité, statut et notes éditables ; aucun objectif-type obligatoire. Un utilisateur peut créer des objectifs à des horizons différents et définir librement le contenu et les critères de ses jalons. Les horizons 1/3/6/12 mois restent un **modèle proposé**, jamais quatre champs forcés ou des échéances rigides.

Une idée reste indépendante de l'arbre et ne devient jamais un objectif actif sans décision explicite.

## 3. Hiérarchie unique et minimale

```text
Volet utilisateur (libre) → sous-volet facultatif
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

Les jalons proposés à **1 / 3 / 6 / 12 mois** (ou une autre série décidée par l'utilisateur) se calculent à partir de la **date de départ explicite de l’objectif**, pas de la date courante à chaque affichage. Adapter ce cycle si l’utilisateur choisit une autre durée. Chaque jalon contient : livrable ou résultat attendu, critère d’acceptation vérifiable, échéance, statut. Ne pas prendre une activité (« faire de la prospection ») pour un résultat (« nombre de pilotes réellement actifs »).

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

Socle Supabase indépendant de l'ancien modèle : `kyg_workspaces` (propriétaire et fuseau), `kyg_areas` (volets/sous-volets définis par chaque utilisateur), `kyg_goals` (catégorie référencée par `area_id`, SMART et état), `kyg_milestones` (horizons flexibles et preuves), `kyg_actions` (tâches et focus unique), `kyg_ideas` (coffre et réexamen), `kyg_measurements` (mesures réelles).

**Migration :** `sql/kyg_customizable_areas_v11.sql` fait évoluer la base v1 vers des catégories dynamiques en conservant l'objectif Doctracker. L'ancienne contrainte à trois catégories et les champs texte `area/subarea` sont retirés après conversion. Les noms restent personnalisables et les nouvelles catégories ne nécessitent aucune migration.

**États** : objectifs `draft / active / paused / achieved / archived` ; jalons `proposed / planned / reached / missed / cancelled` ; actions `backlog / ready / in_progress / done / discarded` ; idées `parked / activated / archived`. Les mises à jour sont ciblées par identifiants, sans écraser un objet voisin.

**Sécurité :** données de vie personnelle privées ; ne stocker dans GitHub que des règles et exemples non confidentiels. RLS par propriétaire sur les tables exposées, pas d’accès anonyme. Tant qu’aucun utilisateur Supabase Auth n’existe, seul le connecteur administrateur peut initialiser le coffre ; attacher explicitement le workspace au compte avant de donner accès à l’application.

**Application autonome d'abord, API IA ensuite :** les parcours de création/édition/archivage des catégories, objectifs, jalons, actions et idées doivent exister sans IA ; menus et arbre sont alimentés dynamiquement par Supabase. Tout champ « ajouter un objectif » doit générer de nouvelles **données**, jamais une nouvelle branche de code. Le suivi, les échéances, les jalons et la progression ne dépendent pas du modèle. Le code change uniquement quand une fonctionnalité commune du produit évolue, pas lorsqu'un utilisateur ajoute un objet.

**Future API de planification, facultative :** saisie naturelle → extraction d'intention → lecture des catégories et objectifs actuels du workspace → **proposition structurée** (`area_id, goal, milestones, actions, confidence, unresolved_questions`) → validation humaine → écriture transactionnelle / journalisée. Les catégories peuvent être **proposées** ou sélectionnées dans les données existantes, jamais figées dans le prompt ou le frontend. Les clés modèles restent côté serveur. Le moteur IA ne doit pas être autorisé à écrire directement les décisions sans les contrôles métier.

**État actuel — ne pas confondre cible et réalisation :** le frontend historique ne propose pas encore le parcours autonome et personnalisable. Il cible encore l’ancienne structure `tenants/domains/objectives/axes/projects/actions` et une ancienne URL Supabase. Ne pas changer sa configuration vers le nouveau projet ni fusionner le code UI avant une adaptation et des tests réels. Préférer un adaptateur/migration contrôlé, sans doublons de données.

## 9. Critères de réussite de ce système

- Pouvoir capturer une idée en moins de 20 secondes, sans obligation de suite.
- Pouvoir connaître sa **prochaine action** en une requête, sans parcourir tous ses objectifs.
- Pour chaque objectif actif : indicateur, jalons datés, avancement réel explicable.
- Pouvoir faire une revue 1/3/6/12 mois sans reconstruire le contexte.
- Pouvoir fonctionner **sans ChatGPT et sans API d'IA**, grâce aux parcours manuels complets de l'application ; le chat est seulement une passerelle personnelle temporaire pendant la conception.
- Pouvoir créer ou renommer un volet, un sous-volet, un objectif ou un jalon **sans changer le code**, déployer une interface ou ajouter une migration.
- Pouvoir brancher plus tard une API d'IA sans changer la structure des données, grâce à une proposition structurée validée avant écriture.
- S’arrêter d’ajouter des fonctionnalités quand l’organisation est suffisamment fluide.

## 10. Règle pour toute future conversation

Au début d’un travail KeepYourGoals : (1) consulter ce mémo dans GitHub si disponible, (2) lire l’état réel de Supabase, (3) proposer peu de choix et une seule action prioritaire, (4) persister les décisions validées, (5) ne faire évoluer le code qu’en cas de nécessité démontrée. Ce mémo prime les anciennes spécifications de produit en cas de conflit fonctionnel, sans court-circuiter les exigences de sécurité ni les instructions explicites récentes de l’utilisateur.


## 11. Deux rôles de l'assistant et boucle de développement hebdomadaire

**Rôle A — Frontend intelligent personnel.** Au fil des échanges naturels, l'assistant aide l'utilisateur actuel à réfléchir à ses objectifs, à choisir ses jalons SMART, à trier ses idées, à arbitrer ses priorités et à mettre à jour Supabase. Ce rôle sert les besoins quotidiens de l'utilisateur et n'exige **aucune modification de l'application** à chaque nouvelle action, idée, catégorie ou objectif.

**Rôle B — Développeur de l'application indépendante.** À partir des interactions réellement accessibles pendant la semaine et des frictions rencontrées, l'assistant identifie ce qui doit devenir une **fonctionnalité générique** de KeepYourGoals. Il compare cette vision avec le code, la sécurité, le schéma et les tests, puis réalise des améliorations utiles et vérifiables. L'application doit pouvoir effectuer ces opérations **sans ChatGPT**, et sans changement de code pour la création de nouveaux objets métier. Une future API d'IA ne doit être qu'une couche d'aide facultative.

**Chaque semaine :**
1. Lire ce mémo, le [README](../README.md) et [les checkpoints d'alignement](PRODUCT_ALIGNMENT.md).
2. Analyser uniquement les retours d'usage qui sont **effectivement accessibles** depuis les sept jours écoulés ; ne pas inventer des apprentissages lorsque les conversations ne sont pas consultables.
3. Enregistrer les besoins de produit **réutilisables et anonymisés** ; garder les détails personnels et les informations sensibles dans Supabase privé ou dans le chat, jamais dans GitHub public.
4. Comparer l'application indépendante à ces besoins ; sélectionner au plus trois axes de travail et les prioriser par diminution réelle de la friction.
5. Développer de façon autonome sur une branche, exécuter les tests et préparer une PR traçable. **Ne jamais merger une PR ni déployer une nouvelle version de l'application sans l'accord explicite de l'utilisateur obtenu au checkpoint**, même si les tests passent. Les mises à jour purement documentaires du checkpoint peuvent être committées sur `main` ; aucune modification destructive de données personnelles en production.
6. Publier un **checkpoint daté** dans `docs/PRODUCT_ALIGNMENT.md` et actualiser le **checkpoint courant du README** : besoins appris, capacités préparées (en PR, et non en production), tests exécutés, lacunes, prochaine priorité et **recommandation explicite MERGER / REPORTER / NE PAS MERGER pour chaque PR**. À la date du checkpoint, demander la décision de l'utilisateur ; aucun merge implicite. La revue reste utile même lorsque la conclusion est **aucun changement de code nécessaire**.

**Critère clé d'alignement :** une opération qui a nécessité l'aide de ChatGPT cette semaine devrait, si elle est récurrente et généralisable, devenir réalisable par une personne seule dans l'application. On mesure la réduction de dépendance au chat, pas la quantité de code ajouté.


## 12. Gouvernance des livraisons — autonomie sans merge automatique

L'utilisateur délègue **entièrement l'initiative et le travail de développement hebdomadaire**, mais conserve **exclusivement la décision de merge**. Entre les checkpoints, ne pas lui demander de gérer des tickets ni d'arbitrer des détails techniques ordinaires. L'assistant est responsable de la conception, du code, des tests qu'il peut réaliser et de PR clairement documentées. Les PR, même testées, restent ouvertes jusqu'à décision explicite de l'utilisateur. Le développement n'est pas une autorisation de déployer. Toute modification sensible ou destructrice nécessite aussi un accord dédié.

**À chaque checkpoint** : rappeler la vision et les frictions observées, lister les PR prêtes ou bloquées, les tests exécutés et les risques, recommander pour chaque PR **MERGER / REPORTER / NE PAS MERGER** et solliciter une validation simple. Noter la décision dans le journal produit. Les README/checkpoints documentaires peuvent être tenus à jour sur la branche principale sans fusionner de code applicatif.


## 13. Initialisation portable et mémoire partagée entre conversations

**Fichier d'entrée obligatoire pour toute nouvelle session KeepYourGoals : [`START_HERE.md`](../START_HERE.md).** Une nouvelle conversation n'a pas besoin de connaître les échanges antérieurs si les informations durables ont été sauvegardées : elle suit ce fichier, retrouve la vision dans GitHub et charge **l'état réel** dans le projet Supabase **`mzxgpdwjklvoqsjclrtz`**, via le compte connecté **« Keep Yours Goals »**. Ne pas demander à l'utilisateur de communiquer à nouveau ces identifiants.

**Répartition de la mémoire :**
- **GitHub public :** règles de fonctionnement, modèle produit et checkpoints anonymisés. Aucun historique privé, aucune information personnelle sensible ni clé d'accès.
- **Supabase privé :** `kyg_workspaces`, `kyg_areas`, `kyg_goals`, `kyg_milestones`, `kyg_actions`, `kyg_ideas`, `kyg_measurements`, plus `kyg_context_notes` pour les décisions, contraintes et préférences durables explicitement confirmées. Chaque nouvelle session lit ces éléments **selon la demande** et les filtre par workspace.
- **ChatGPT :** session éphémère servant d'interface intelligente personnelle. Le nouveau chat ne prétend pas reconstruire les échanges non persistés ni avoir accès aux outils indisponibles.

**Handoff :** après une nouvelle décision durable, mettre à jour l'objet Supabase correspondant ; le prochain chat retrouve ces données via `START_HERE.md`. Préférer des notes structurées et sobres dans `kyg_context_notes`, jamais une transcription complète. Un changement de vision du produit entraîne une mise à jour explicite des documents canoniques et, si besoin, du checkpoint.

**Développement :** le rôle développeur hebdomadaire lit également ce protocole de reprise, mais continue à travailler en branches et PR sans aucun merge automatique. **Le mécanisme de reprise ne change ni les droits ni les règles d'approbation.**
