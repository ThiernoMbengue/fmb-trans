import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getRole, getRoleRapide, identiteLocale } from "@/lib/supabase/role";

/**
 * Ce dont toute page a besoin pour s'afficher : qui est connecté, avec quel
 * rôle, et la liste de ses véhicules.
 *
 * Deux choses rendent cette lecture rapide :
 *  - le profil et les véhicules sont demandés en même temps, pas l'un après
 *    l'autre ;
 *  - le résultat est mis en commun pour toute la durée d'une même requête :
 *    le gabarit et la page le demandent tous les deux, il n'est lu qu'une fois.
 *
 * Les véhicules sont lus avec le compte de la personne : la base n'y laisse
 * que ceux auxquels elle a droit.
 */
export const contextePage = cache(async () => {
  const supabase = createClient();
  const vide = { supabase, user: null, role: null, nom: null, vehicles: [] };

  const identite = await identiteLocale(supabase);
  if (!identite) return vide;

  const [session, vehicules] = await Promise.all([
    getRoleRapide(supabase, identite),
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
  ]);
  if (!session.user) return vide;

  // Si la lecture des véhicules a échoué alors que la session est valide (le
  // jeton vient d'être renouvelé, par exemple), on la refait une fois.
  let vehicles = vehicules.data;
  if (vehicules.error) {
    ({ data: vehicles } = await supabase.from("vehicles").select("*").order("created_at", { ascending: true }));
  }

  return { supabase, ...session, vehicles: vehicles || [] };
});

export { getRole };
