import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { reconcilierFlotte } from "@/lib/avances-reconciliation";
import PaiementsClient from "./paiements-client";

export const dynamic = "force-dynamic";

export default async function PaiementsPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  // Rattrapage du statut des avances, ici plutôt que depuis le navigateur.
  //
  // Une server action par véhicule paraissait équivalent, mais les server
  // actions sont mises en file d'attente côté client : elles s'exécutaient
  // l'une après l'autre, et chaque revalidatePath relançait un rendu complet
  // de la page. Ici, tout se fait en une passe, avant le rendu, sans aucun
  // aller-retour avec le navigateur.
  //
  // L'opération est idempotente : quand il n'y a rien à corriger — le cas
  // courant — elle ne coûte que trois lectures et aucune écriture.
  if (role === "admin" && vehicles?.length) {
    try {
      await reconcilierFlotte(supabase, vehicles.map((v) => v.id));
    } catch {
      // Un rattrapage qui échoue ne doit pas empêcher la page de s'afficher :
      // les décomptes restent justes, seuls les statuts attendent le prochain
      // passage.
    }
  }

  return <PaiementsClient vehicles={vehicles || []} role={role} />;
}
