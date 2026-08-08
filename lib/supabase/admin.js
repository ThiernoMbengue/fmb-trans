import { createClient } from "@supabase/supabase-js";

// Client "service role" — contourne les policies RLS et peut créer/supprimer
// des comptes auth.users. Ne jamais importer ce fichier dans un composant
// client ni exposer SUPABASE_SERVICE_ROLE_KEY au navigateur.
export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
