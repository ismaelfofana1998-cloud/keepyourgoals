# Notes de version — 3.0.0 Natural Focus

## Changement majeur

L'utilisateur ne remplit plus manuellement Domaine, Objectif, Axe, Projet puis Action. Une seule zone de saisie naturelle devient le point d'entrée principal.

## Nouveau parcours

- texte libre ou dictée vocale ;
- classification automatique ;
- une question à la fois si nécessaire ;
- trois questions maximum ;
- classement visuel d'un vidage de tête ;
- arbre complet proposé avec premières actions ;
- validation humaine ;
- création transactionnelle ;
- navigation immédiate vers la branche créée ;
- première action ajoutée à Aujourd'hui.

## Multi-fournisseur

- Groq par défaut pour les tests ;
- OpenAI en option ;
- mode automatique Groq puis OpenAI ;
- modèle et fournisseur journalisés ;
- statut du moteur visible dans l'interface.

## Garde-fous

- modération adaptée au fournisseur ;
- modèle Groq Safety avec fallback déterministe ;
- sortie JSON stricte ;
- limitation du nombre de niveaux générés ;
- aucune écriture directe par le modèle ;
- validation explicite obligatoire.
