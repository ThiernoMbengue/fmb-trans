# FMB Trans-Mobilité Services — site web

Site de suivi des versements de flotte, accès réservé aux comptes connectés (email / mot de passe) :
- **Gestionnaire (admin)** : voit tous les véhicules, saisit les versements, gère la flotte, les comptes et les avances (dont l'approbation des demandes).
- **Propriétaire** : voit uniquement le(s) véhicule(s) qui lui sont rattachés (tableau de bord, rapports PDF, avances) en lecture seule, et peut soumettre une demande d'avance au gestionnaire.

**Stack** : Next.js (site) + Supabase (base de données Postgres + comptes) + Vercel (hébergement gratuit).

## Déploiement — 6 étapes

1. **Créer le projet Supabase** (base de données + comptes)
2. **Créer les tables**, dans l'éditeur SQL Supabase, dans cet ordre :
   `schema.sql` → `migration_avances.sql` → `migration_rapports.sql` → `migration_roles.sql` → `migration_demandes.sql` → `migration_paiements.sql`
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

## Développement local

```bash
npm install
cp .env.local.example .env.local   # puis remplir avec tes clés Supabase
npm run dev
```

Site disponible sur http://localhost:3000
