# Architecture — IKIGAI Pilot 3.0 Natural Focus

## 1. Une entrée naturelle, une structure fiable

L’utilisateur ne remplit pas cinq menus. Il écrit avec ses mots dans une zone unique.

```text
Texte libre ou dictée
        ↓
Compréhension du besoin
        ↓
Une question courte si nécessaire
        ↓
Domaine → Objectif → Axe → Projet → Action
        ↓
Proposition graphique
        ↓
Validation humaine
        ↓
Création transactionnelle
```

Lorsque plusieurs préoccupations sont présentes, le système les range d’abord par domaines et demande laquelle traiter. Il ne transforme pas tout en projets actifs.

## 2. Hiérarchie de navigation

```text
Tenant
└── Domaine
    └── Objectif
        └── Axe
            └── Projet
                ├── Jalons internes
                └── Actions
```

Les jalons structurent le projet mais ne deviennent pas un niveau permanent de navigation. L’utilisateur ne voit qu’une branche à la fois.

## 3. Trois espaces visibles

- **Mon chemin** : saisie naturelle, arbre hiérarchique et progression ;
- **Aujourd’hui** : une priorité et deux actions secondaires ;
- **Mes idées** : parking sans activation automatique.

Les réglages, bilans et propositions restent secondaires afin de ne pas polluer l’attention.

## 4. Moteur natif

Il fonctionne sans IA pour :

- conserver les relations hiérarchiques ;
- calculer la progression ;
- gérer les échéances et la capacité ;
- choisir la todo quotidienne ;
- suivre les actions, reports et idées ;
- produire les bilans factuels.

## 5. Couche d’aide intelligente

Le fournisseur est sélectionnable par tenant : `groq`, `openai` ou `auto`.

L’Edge Function :

1. valide le JWT, le tenant et le rôle ;
2. vérifie le quota ;
3. crée ou reprend une session de clarification ;
4. nettoie et limite le contexte ;
5. modère l’entrée ;
6. classe le niveau de risque ;
7. appelle le fournisseur avec un schéma JSON strict ;
8. valide la hiérarchie et les actions ;
9. effectue au maximum une correction ;
10. modère la sortie ;
11. enregistre une proposition ;
12. attend la décision de l’utilisateur.

## 6. Application d’une proposition

`apply_ai_proposal` est une fonction SQL transactionnelle. Pour `natural_intake`, elle peut créer en une fois :

- un domaine ou réutiliser un domaine existant ;
- un objectif ;
- jusqu’à trois axes ;
- jusqu’à deux projets par axe ;
- jusqu’à trois premières actions par projet.

Une seule action est désignée comme première action et peut alimenter immédiatement **Aujourd’hui**.

La fonction refuse une proposition expirée, déjà traitée, non validée, à risque élevé, exigeant un professionnel ou appartenant à un autre tenant.

## 7. Données de clarification

`ai_intake_sessions` conserve uniquement ce qui est nécessaire pour poursuivre les trois questions maximum : texte initial, réponses, dernière question, statut et proposition associée.

## 8. Confidentialité

Le contexte envoyé au fournisseur est limité au besoin en cours et aux domaines existants utiles. Les champs ressemblant à des secrets sont supprimés. Les clés Groq et OpenAI restent dans les secrets Supabase.
