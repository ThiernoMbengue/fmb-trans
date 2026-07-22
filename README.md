# FMB Trans-Mobilité Services — site web

Site de suivi des versements de flotte : consultation publique (tableaux + graphiques),
saisie protégée par compte (email / mot de passe).

**Stack** : Next.js (site) + Supabase (base de données Postgres + comptes) + Vercel (hébergement gratuit).

## Déploiement — 5 étapes

1. **Créer le projet Supabase** (base de données + comptes)
2. **Créer les tables** (coller `supabase/schema.sql` dans l'éditeur SQL)
3. **Créer un premier compte utilisateur** (pour pouvoir se connecter et saisir)
4. **Mettre le code sur GitHub**
5. **Déployer sur Vercel** (connecter le repo GitHub + variables d'environnement)

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
