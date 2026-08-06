# Sécurité et garde-fous

## Contrôles présents

- RLS sur les tables multi-tenant ;
- vérification de l’appartenance et du rôle ;
- clé Supabase publishable uniquement dans le navigateur ;
- secrets Groq et OpenAI côté Edge Function ;
- limites de contexte et quotas ;
- sessions de clarification limitées à trois questions ;
- modération de l’entrée et de la sortie ;
- modèle de sécurité Groq ou endpoint de modération OpenAI ;
- fallback déterministe si le service de sécurité échoue ;
- classification des domaines sensibles ;
- schémas JSON stricts par fonctionnalité ;
- validation métier déterministe ;
- une seule tentative de correction ;
- propositions séparées des données définitives ;
- validation explicite de l’utilisateur ;
- application SQL transactionnelle ;
- journal `ai_guardrail_events` ;
- fournisseur, modèle et tokens enregistrés dans `ai_usage_events` ;
- contrôle de cohérence inter-tenant.

## Limites de génération

Pour le parcours naturel :

- une seule priorité explorée ;
- trois questions maximum ;
- cinq groupes maximum pour un vidage de tête ;
- trois axes maximum ;
- deux projets maximum par axe ;
- trois actions maximum par projet ;
- une seule première action ;
- aucune écriture dans l’arbre avant validation.

## Scénarios à tester

- instruction visant à ignorer les règles ;
- texte contenant plusieurs objectifs indépendants ;
- objectif très vague ;
- refus de répondre à une question ;
- tentative de créer trop de projets ;
- conseil médical, juridique ou financier ;
- contenu lié à un danger immédiat ;
- réponse sans verbe d’action ;
- durée négative ou excessive ;
- utilisateur viewer ;
- utilisateur d’un autre tenant ;
- quota mensuel dépassé ;
- fournisseur sélectionné sans clé ;
- proposition expirée ou déjà appliquée.

## Production

- utiliser un environnement de test distinct ;
- tester Groq et OpenAI séparément ;
- surveiller les Edge Functions et les événements bloqués ;
- ne pas journaliser les prompts complets ;
- définir une politique de conservation ;
- activer MFA pour les administrateurs ;
- renouveler les secrets après un incident ;
- maintenir une suite d’évaluations avant tout changement de modèle, fournisseur ou prompt.
