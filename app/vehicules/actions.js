"use server";

import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { revalidatePath } from "next/cache";

// Les règles de la base (RLS) refusent déjà ces écritures à un compte qui
// n'est pas gestionnaire ; la vérification ici donne un message clair plutôt
// qu'un échec silencieux.
async function exigerAdmin() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  return role === "admin" ? { supabase } : { error: "Action réservée au gestionnaire." };
}

const messageErreur = (error) => error?.message || "Erreur inattendue";

// Même règle que partout ailleurs dans l'application : un taux vide ou nul
// retombe sur 5 000 F par jour travaillé.
const tauxValide = (valeur) => {
  const n = Math.round(Number(valeur));
  return Number.isFinite(n) && n > 0 ? n : 5000;
};

export async function addVehicle(formData) {
  try {
    const { supabase, error: refus } = await exigerAdmin();
    if (refus) return { error: refus };

    const texte = (cle) => String(formData.get(cle) || "").trim();
    const marque = texte("marque");
    const immatriculation = texte("immatriculation").toUpperCase();
    if (!marque || !immatriculation) {
      return { error: "La marque et l'immatriculation sont obligatoires." };
    }

    const { error } = await supabase.from("vehicles").insert({
      marque,
      immatriculation,
      proprietaire: texte("proprietaire") || null,
      chauffeur: texte("chauffeur") || null,
      taux_chauffeur: tauxValide(formData.get("taux_chauffeur")),
      owner_id: formData.get("owner_id") || null,
    });
    if (error) return { error: messageErreur(error) };

    revalidatePath("/vehicules");
    revalidatePath("/");
    revalidatePath("/saisie");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deleteVehicle(id) {
  try {
    const { supabase, error: refus } = await exigerAdmin();
    if (refus) return { error: refus };

    const { error } = await supabase.from("vehicles").delete().eq("id", id);
    if (error) return { error: messageErreur(error) };

    revalidatePath("/vehicules");
    revalidatePath("/");
    revalidatePath("/saisie");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
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
    const { supabase, error: refus } = await exigerAdmin();
    if (refus) return { error: refus };

    if (!vehicleId) return { error: "Véhicule manquant" };

    const marque = (champs.marque || "").trim();
    const immatriculation = (champs.immatriculation || "").trim();
    if (!marque || !immatriculation) {
      return { error: "La marque et l'immatriculation sont obligatoires." };
    }

    const { error } = await supabase
      .from("vehicles")
      .update({
        marque,
        immatriculation,
        proprietaire: (champs.proprietaire || "").trim() || null,
        chauffeur: (champs.chauffeur || "").trim() || null,
        taux_chauffeur: tauxValide(champs.taux_chauffeur),
      })
      .eq("id", vehicleId);

    if (error) return { error: messageErreur(error) };

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
    const { supabase, error: refus } = await exigerAdmin();
    if (refus) return { error: refus };

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
