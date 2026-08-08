import { createClient } from "@supabase/supabase-js";

// Client "service role" — contourne les policies RLS et peut créer/supprimer
// des comptes auth.users. Ne jamais importer ce fichier dans un composant
// client ni exposer SUPABASE_SERVICE_ROLE_KEY au navigateur.
//
// Renvoie null si la clé n'est pas configurée, pour que l'appelant puisse
// afficher un message clair au lieu de planter.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export const MISSING_SERVICE_KEY =
  "La clé SUPABASE_SERVICE_ROLE_KEY n'est pas configurée. Ajoute-la dans .env.local (et dans les variables d'environnement Vercel), puis redémarre le site.";
