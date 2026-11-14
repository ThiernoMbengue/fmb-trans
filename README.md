# FMB Trans-Mobilité Services — site web

Site de suivi des versements de flotte, accès réservé aux comptes connectés (email / mot de passe) :
- **Gestionnaire (admin)** : voit tous les véhicules, saisit les versements, gère la flotte, les comptes et les avances (dont l'approbation des demandes), et tient le carnet de bord (notes, dettes, échéances, justificatifs).
- **Propriétaire** : voit uniquement le(s) véhicule(s) qui lui sont rattachés (tableau de bord, rapports PDF, avances) en lecture seule, et peut soumettre une demande d'avance au gestionnaire.

**Stack** : Next.js (site) + Supabase (base de données Postgres + comptes) + Vercel (hébergement gratuit).

## Déploiement — 6 étapes

1. **Créer le projet Supabase** (base de données + comptes)
2. **Créer les tables**, dans l'éditeur SQL Supabase, dans cet ordre :
   `schema.sql` → `migration_avances.sql` → `migration_rapports.sql` → `migration_roles.sql` → `migration_demandes.sql` → `migration_paiements.sql` → `migration_parametres.sql` → `migration_location.sql` → `migration_avances_statut.sql` → `migration_note_saisie.sql` → `migration_carnet.sql` → `migration_ia.sql`
3. **Créer le premier compte gestionnaire** (Authentication > Users), puis le passer admin :
   `update profiles set role = 'admin' where id = (select id from auth.users where email = 'ton_email@exemple.com');`
4. **Ajouter la clé `service_role`** (Project Settings > API) dans `SUPABASE_SERVICE_ROLE_KEY` (local et Vercel) — nécessaire pour créer d'autres comptes depuis l'onglet « Comptes » du site
5. **Mettre le code sur GitHub**
6. **Déployer sur Vercel** (connecter le repo GitHub + variables d'environnement)

Ensuite, tout le reste (créer les comptes propriétaires, les rattacher à leurs véhicules) se fait depuis le site (onglets « Comptes » et « Véhicules »).

Voir la conversation avec Claude pour le détail de chaque étape, ou suivre :
- Supabase : https://supabase.com
- Vercel : https://vercel.com
- GitHub : https://github.com

## Assistant IA et lecture des captures

Deux fonctions s'appuient sur l'API de Claude (Anthropic) :

- **Assistant** — un panneau de discussion, ouvert depuis la barre du haut, qui répond aux questions sur les données (chiffres d'une période, soldes, avances, carnet) et propose les relevés en PDF. Il lit avec le compte de la personne connectée : un propriétaire n'obtient que ses véhicules. Il ne modifie jamais rien.
- **Remplir depuis une capture** — dans Saisie, on envoie la capture de la conversation WhatsApp du chauffeur ; le formulaire est pré-rempli (véhicule, date, recette, gazoil, autres dépenses), on vérifie puis on enregistre. La capture est conservée comme justificatif de la saisie.

Mise en service :

1. Créer un compte sur la console Anthropic, y ajouter du crédit, puis créer une clé d'API.
2. Dans Vercel > Settings > Environment Variables, ajouter `ANTHROPIC_API_KEY` (valeur : la clé).
3. Dans Supabase > SQL Editor, exécuter `supabase/migration_ia.sql`.
4. Redéployer le site : une variable d'environnement n'est prise en compte qu'au déploiement suivant.

Tant que la clé n'est pas définie, le site fonctionne comme avant et l'assistant reste masqué.

Réglages facultatifs : `ANTHROPIC_MODEL` (par défaut `claude-haiku-5-5`, le modèle le moins cher) et `IA_LIMITE_QUOTIDIENNE` (150 demandes par personne et par jour par défaut). L'usage est suivi dans la table `ia_usage`.

## Développement local

```bash
npm install
cp .env.local.example .env.local   # puis remplir avec tes clés Supabase
npm run dev
```

Site disponible sur http://localhost:3000
