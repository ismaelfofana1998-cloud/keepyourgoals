# KeepYourGoals — Checkpoints d'alignement produit

Ce journal est le **carnet de transmission** entre deux usages du même assistant :

- **Interface intelligente personnelle (au quotidien)** : aider à clarifier les objectifs, jalonner, arbitrer, déposer les idées et identifier la seule prochaine action ; les données sont conservées dans Supabase, pas dans le code.
- **Développeur de l'application indépendante (chaque semaine)** : relever les frictions et exigences récurrentes observées pendant l'usage réel, les transformer en critères de produit, comparer ces critères au code, implémenter et tester les améliorations utiles. **L'application finale doit fonctionner sans ChatGPT et sans API de modèle.**

Ce fichier consigne l'**écart** entre l'expérience souhaitée et l'expérience réellement implémentée. Il ne doit pas devenir une liste infinie d'idées.

**Point d'entrée entre conversations :** [`START_HERE.md`](../START_HERE.md). Le modèle opérationnel de l'utilisateur et la mémoire durable privée sont sur Supabase **`mzxgpdwjklvoqsjclrtz`**, compte **« Keep Yours Goals »** ; le dépôt public ne contient que les apprentissages produit anonymisés.

## Règles de la revue hebdomadaire

1. Lire d'abord `START_HERE.md`, `README.md`, `docs/CANONICAL_PLANNING.md`, ce journal, les changements GitHub, et l'état pertinent du projet Supabase `mzxgpdwjklvoqsjclrtz`, notamment `kyg_context_notes` (sans recopier les données privées dans ce dépôt).
2. Recenser les demandes et les difficultés exprimées pendant les sept derniers jours **uniquement si elles sont effectivement consultables** dans les conversations et données disponibles. Une hypothèse n'est jamais une observation certaine.
3. Résumer **ce que l'usage dans le chat révèle de l'application attendue**, pas les détails privés de la vie de l'utilisateur. Ne jamais publier dans ce dépôt public des informations personnelles, financières, de santé ou des extraits de conversations confidentiels ; employer des comportements et exemples anonymes.
4. Distinguer clairement : **besoin confirmé**, **idée à valider**, **hors périmètre / différé**. Ne pas transformer chaque demande ponctuelle en fonctionnalité.
5. Mettre en regard les besoins confirmés et les capacités indépendantes réellement testées (UI, Supabase, auth, logique métier). Noter les écarts avec des preuves vérifiables : fichiers, tests, captures si disponibles, PR/commits.
6. Choisir **au plus 1 à 3 améliorations de valeur** par semaine. En développer au moins une quand un besoin confirmé et un chemin sécurisé existent. Éviter les nouvelles couches d'abstraction sans nécessité.
7. Développer de manière autonome sur une branche, exécuter les tests disponibles et ouvrir une PR traçable ; corriger si possible les échecs. **AUCUN MERGE de PR et AUCUN déploiement de nouvelle version sans accord explicite de l'utilisateur à la date du checkpoint**, même avec tous les tests au vert. Ne pas modifier la base de production de manière destructive sans validation dédiée. Seuls les changements documentaires des checkpoints peuvent être directement committés sur `main`.
8. Actualiser la section « Checkpoint courant » du README, ajouter un checkpoint daté ici et expliquer **ce qui est prêt en PR (pas forcément fusionné)**, **ce qui reste bloquant** et la **prochaine priorité**. Donner une recommandation **MERGER / REPORTER / NE PAS MERGER** pour chaque PR et demander une décision simple. Ne jamais interpréter l'absence de réponse comme un accord.
9. Si aucune amélioration n'est justifiée, écrire explicitement « pas de changement de code utile cette semaine » ; ce n'est pas un échec. Ne pas inventer de travail pour remplir la revue.
10. En cas d'accès insuffisant aux conversations, à Supabase, à GitHub ou aux tests, signaler la limite et documenter honnêtement ce qui a été vérifié. Pas de déclarations de tests réussis sans exécution.

## Format de chaque checkpoint

**Semaine du AAAA-MM-JJ au AAAA-MM-JJ**

- **Vision / apprentissages utilisateurs (anonymisés)** : 1 à 5 constats réellement observés.
- **Besoins confirmés** : besoins utiles à tous, accompagnés de critères d'acceptation.
- **Alignement réel** : pour chaque capacité, statut `Aligné`, `Partiel`, `Absent` ou `Non vérifié`, avec preuve et écart.
- **Décision de la semaine** : travail prioritaire et pourquoi il vaut mieux que les autres possibilités.
- **Réalisation** : commits, PR non fusionnées, migration et tests réellement exécutés (ou aucun, selon le cas).
- **Décision de merge** : pour chaque PR, recommandation `MERGER / REPORTER / NE PAS MERGER`, décision explicite de l'utilisateur et état effectif (`en attente / fusionnée après accord / abandonnée`).
- **Risques / blocages** : sécurité, ergonomie, dépendances, accès ou non-vérification.
- **Checkpoint suivant** : 1 à 3 points, pas une feuille de route interminable.

## Checkpoint initial — 2026-11-03 (cadre de départ, pas une revue de 7 jours)

### Vision / apprentissages confirmés

- **Le chat actuel sert d'interface personnelle intelligente et d'instrument de découverte des vrais besoins.** Ce choix réduit les coûts d'API, mais ne constitue pas le design cible de l'application.
- **L'application doit être autonome et généraliste.** Un utilisateur doit créer, renommer et utiliser volets, sous-volets, objectifs SMART, jalons, actions et idées sans intervention d'un développeur ou d'un assistant.
- **La simplicité de la surface et la souplesse du modèle sont essentielles.** L'utilisateur veut consulter **une seule prochaine action** ; le stockage et le jalonnage complexes doivent rester en arrière-plan.
- **Les idées ne sont pas des engagements.** Le coffre doit assurer la capture et le réexamen sans transformer automatiquement les idées en projets.
- **L'apprentissage hebdomadaire est une boucle produit** : transformer les usages observés dans le chat en améliorations concrètes, sans refonte à chaque objectif individuel.

### État d'alignement vérifiable

| Capacité produit | État au 2026-11-03 | Écart / preuve |
| --- | --- | --- |
| Volets et sous-volets configurables dans la base | **Aligné côté schéma** | `kyg_areas` et `area_id` créés par `sql/kyg_customizable_areas_v11.sql`. Parcours de personnalisation dans l'UI non encore vérifié. |
| Objectifs SMART et jalons de durée libre, persistants | **Partiel** | `kyg_goals`, `kyg_milestones`, `kyg_measurements` disponibles. L'ancien frontend utilise un autre schéma. |
| Application indépendante, sans ChatGPT ni IA payante | **Absent sur le nouveau schéma** | Un frontend historique IKIGAI Pilot 3.0 existe mais doit être adapté aux tables `kyg_*`. |
| Une seule action visible dans l'interface | **Partiel / non testé** | Une proposition d'interface existe sur une ancienne branche/PR. Aucune preuve de test E2E sur la nouvelle base. |
| Coffre à idées avec réexamen non intrusif | **Partiel** | `kyg_ideas` stocke les idées ; le workflow applicatif complet et les rappels autonomes restent à tester / développer. |
| Authentification et usage réel de l'application | **Non vérifié / non prêt** | Au moment de la conception, la base n'avait pas encore d'utilisateur Auth et l'espace n'était lié à aucun compte. |
| Assistant IA intégré via API | **Hors périmètre immédiat** | Pas de dépense API actuellement, mais futur branchement possible au même moteur de règles. |

### Décision de développement

**Priorité n°1 : rapprocher l'interface de la nouvelle base, avec un parcours manuel complet.** Faire fonctionner et tester les opérations essentielles de création et d'édition sur les `kyg_*`, avant tout moteur IA intégré. Les captures d'idées et le focus unique suivent immédiatement, sans transformer le produit en gestionnaire de projets complexe.

**Livré aujourd'hui** : schéma Supabase personnalisable et mémo canonique déjà réalisés ; journal et procédure de checkpoint introduits. **Non livré à ce stade** : application indépendante pleinement opérationnelle sur le nouveau schéma. Ne pas la décrire comme prête.

### Critère de succès pour le prochain checkpoint

Sans ChatGPT, un utilisateur connecté pourra **créer un volet inédit**, y créer un **objectif SMART**, ajouter ses **jalons personnalisés** puis voir une **prochaine action**, sans changement de code spécifique à cet objectif. Toute capacité non encore développée sera marquée explicitement comme telle.

---

Les prochains checkpoints sont ajoutés à la suite, en conservant l'historique. Le README ne contient que le résumé et le lien vers le dernier checkpoint.


## Amendement de conception — 2026-11-03 : reprise inter-conversations

- **Besoin confirmé :** continuer la gestion personnelle dans un nouveau chat **sans réexpliquer le dépôt, la base Supabase ni les décisions durables**.
- **Livré :** `START_HERE.md` comme prompt de reprise portable ; protocole GitHub → Supabase → workspace → mémoire privée / objectifs → réponse ; table `kyg_context_notes` protégée pour les préférences, décisions et handoffs non représentés dans les objectifs.
- **À vérifier lors du prochain checkpoint :** test réel depuis une conversation distincte avec connecteurs disponibles, et vérification des permissions et de la continuité d'une nouvelle note privée.
- **Limite explicite :** les messages qui n'ont jamais été sauvegardés n'ont pas une copie complète transférable. La reprise offre **la mémoire structurée enregistrée**, pas une archive magique des discussions.
- **Gouvernance inchangée :** aucune PR applicative n'est mergée sans validation au checkpoint.
