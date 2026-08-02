# FMB Trans-Mobilité Services — site web

Site de suivi des versements de flotte, accès réservé aux comptes connectés (email / mot de passe) :
- **Gestionnaire (admin)** : voit tous les véhicules, saisit les versements, gère la flotte et les avances.
- **Propriétaire** : voit uniquement les véhicules qui lui sont rattachés (tableau de bord + avances), en lecture seule.

**Stack** : Next.js (site) + Supabase (base de données Postgres + comptes) + Vercel (hébergement gratuit).

## Déploiement — 6 étapes

1. **Créer le projet Supabase** (base de données + comptes)
2. **Créer les tables** (coller `supabase/schema.sql`, puis les migrations dans `supabase/*.sql` dans l'ordre, dans l'éditeur SQL)
3. **Créer les comptes utilisateurs** (un pour le gestionnaire, un par propriétaire) — le premier compte créé doit être passé en admin manuellement, voir `supabase/migration_roles.sql`
4. **Rattacher les véhicules aux comptes propriétaires** depuis l'onglet « Véhicules »
5. **Mettre le code sur GitHub**
6. **Déployer sur Vercel** (connecter le repo GitHub + variables d'environnement)

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
