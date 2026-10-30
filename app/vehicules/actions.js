"use server";

import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { revalidatePath } from "next/cache";

export async function addVehicle(formData) {
  const supabase = createClient();

  const marque = formData.get("marque");
  const immatriculation = formData.get("immatriculation");
  const proprietaire = formData.get("proprietaire");
  const chauffeur = formData.get("chauffeur");
  const taux_chauffeur = Number(formData.get("taux_chauffeur")) || 5000;
  const owner_id = formData.get("owner_id") || null;

  if (!marque || !immatriculation) {
    return { error: "Marque et immatriculation requises" };
  }

  const { error } = await supabase
    .from("vehicles")
    .insert({ marque, immatriculation, proprietaire, chauffeur, taux_chauffeur, owner_id });

  if (error) return { error: error.message };

  revalidatePath("/vehicules");
  revalidatePath("/");
  revalidatePath("/saisie");
  return { success: true };
}

export async function deleteVehicle(id) {
  const supabase = createClient();
  const { error } = await supabase.from("vehicles").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/vehicules");
  revalidatePath("/");
  revalidatePath("/saisie");
  return { success: true };
}

/**
 * Met à jour les informations d'un véhicule : chauffeur, marque,
 * immatriculation, propriétaire, taux journalier.
 *
 * Changer le chauffeur ne touche pas aux saisies passées : chacune garde le
 * nom du receveur enregistré ce jour-là. C'est voulu — l'historique doit
 * rester le reflet de qui conduisait réellement.
 */
export async function updateVehicle(vehicleId, champs) {
  try {
    const supabase = createClient();
    const { role } = await getRole(supabase);
    if (role !== "admin") return { error: "Accès refusé" };

    if (!vehicleId) return { error: "Véhicule manquant" };

    const marque = (champs.marque || "").trim();
    const immatriculation = (champs.immatriculation || "").trim();
    if (!marque || !immatriculation) {
      return { error: "Marque et immatriculation requises" };
    }

    const { error } = await supabase
      .from("vehicles")
      .update({
        marque,
        immatriculation,
        proprietaire: (champs.proprietaire || "").trim() || null,
        chauffeur: (champs.chauffeur || "").trim() || null,
        taux_chauffeur: Number(champs.taux_chauffeur) || 5000,
      })
      .eq("id", vehicleId);

    if (error) return { error: error.message };

    revalidatePath("/vehicules");
    revalidatePath("/saisie");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

// Rattache (ou détache) un véhicule existant au compte d'un propriétaire.
// C'est ce lien — et non le champ texte "propriétaire" — qui donne au
// propriétaire l'accès à son véhicule.
export async function updateVehicleOwner(vehicleId, ownerId) {
  try {
    const supabase = createClient();
    const { error } = await supabase
      .from("vehicles")
      .update({ owner_id: ownerId || null })
      .eq("id", vehicleId);

    if (error) return { error: error.message };

    revalidatePath("/vehicules");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}
