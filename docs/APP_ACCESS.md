# Accès à KeepYourGoals — migration de l'ancien frontend vers la base actuelle

## Cause de l'erreur « Failed to fetch » (diagnostic du 04/11/2026)

Le `config.js` de la branche principale visait le projet Supabase historique `nyjgrpmpxajlgknlxykm`. L'application historique consommait `tenants`, `tenant_members`, `domains`, `objectives` et `actions`, alors que le modèle canonique actuel et les objectifs réels sont dans **`mzxgpdwjklvoqsjclrtz`**, tables `kyg_*`.

Changer uniquement la clé et l'URL du vieux frontend aurait rendu la connexion vers le bon projet possible sans résoudre le chargement (tables absentes, ancien RPC `bootstrap_personal_tenant`, schéma non compatible). La [PR #2](https://github.com/ismaelfofana1998-cloud/keepyourgoals/pull/2), fusionnée le 10/11/2026, a remplacé l'entrée `index.html` sur `main` par une interface indépendante compatible `kyg_*`, sans API d'IA obligatoire.

Le projet cible a été vérifié `ACTIVE_HEALTHY` dans Supabase au moment du diagnostic. Cette confirmation n'est pas un test de réseau du navigateur de l'utilisateur. Si l'erreur persiste sur la nouvelle page, vérifier la requête `/auth/v1/token` dans les outils réseau et ses erreurs DNS, blocage d'extension ou CORS. Le formulaire affiche désormais un message explicite en cas de défaut réseau.

## Fonctionnement de l'interface proposée

- Connexion / création de compte via **Supabase Auth du nouveau projet**.
- Un compte authentifié sans espace reçoit un espace privé neuf lié à `auth.uid()`. **Aucune attribution automatique des espaces sans propriétaire à la première personne qui s'inscrit.**
- Les volets sont dynamiques : création, renommage, organisation en sous-volets.
- Les objectifs SMART sont configurables : statut brouillon/actif/pause/atteint, mesure, échéance. La création n'entraîne aucune notification.
- Un objectif contient des jalons d'horizon libre et des actions facultatives.
- Une seule action prioritaire visible par défaut ; l'utilisateur peut la terminer ou en choisir une autre.
- Coffre à idées : capture, catégorie facultative et classement sans suite.
- Pas de moteur IA API, pas de secret en frontend et aucune action sur un autre workspace sans autorisation.

## Première connexion : IMPORTANT

**Aucun utilisateur Auth n'avait encore été créé dans le nouveau projet au moment du diagnostic.** Un ancien identifiant/mot de passe Supabase ne crée pas automatiquement un utilisateur dans le nouveau projet. Après le déploiement GitHub Pages confirmé le 10/11/2026 :

1. Ouvrir le site **[KeepYourGoals sur GitHub Pages](https://ismaelfofana1998-cloud.github.io/keepyourgoals/)** (URL confirmée dans le journal de déploiement GitHub). Le site Vercel du dépôt n'a pas pu être vérifié.
2. Choisir **Créer un compte**, renseigner son e-mail et un mot de passe personnel. Ne jamais communiquer le mot de passe à l'assistant.
3. Si demandé, confirmer l'adresse e-mail (configuration `Authentication → URL Configuration` sur `mzxgpdwjklvoqsjclrtz` : définir `Site URL` et ajouter l'URL exacte publiée aux `Redirect URLs` autorisées ; sinon le lien peut rediriger vers un localhost inadéquat).
4. Se connecter. L'application doit charger ou créer un espace **privé**.
5. Pour récupérer les objectifs ajoutés dans l'espace initial par ChatGPT avant création de compte, **demander explicitement dans le chat une liaison de cet espace au compte nouvellement vérifié**. Le connecteur admin doit vérifier l'identité et l'identifiant Auth réel avant de renseigner `kyg_workspaces.owner_user_id`. Ne pas attribuer l'espace source à n'importe quel nouvel inscrit, ni recopier les objectifs vers un autre compte sans vérification.
6. Une fois le rattachement vérifié, recharger la page. Le frontend choisit le plus ancien espace appartenant à ce compte, ce qui permet de réutiliser les objectifs et jalons déjà stockés. Le nouvel espace vide peut être conservé temporairement sans problème.

**PR #2 fusionnée avec l'accord explicite de l'utilisateur le 10/11/2026**, commit `30d5f87`. **GitHub Pages a publié ce commit avec succès**. Le parcours d'authentification end-to-end nécessite encore un compte utilisateur réel et, selon la configuration, la confirmation d'e-mail.

## Contrôles et limitations

- Les tests statiques sont dans `tests/smoke.mjs`, exécutables avec `node --check kyg-app.js && node tests/smoke.mjs`.
- Tests navigateur réels, inscription, vérification d'e-mail et RLS multi-comptes : **non encore exécutés**, même si les contrôles CI et le déploiement Pages ont réussi.
- La création d'un compte avec espace vide ne prouve pas encore l'accès aux données préexistantes : l'association de l'espace initial nécessite une opération d'administration contrôlée.
- Le module d'édition des objectifs reste volontairement minimal. Les évolutions produit feront l'objet des checkpoints hebdomadaires, en PR non fusionnée jusqu'à décision.
