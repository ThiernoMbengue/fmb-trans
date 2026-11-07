"use server";

import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { revalidatePath } from "next/cache";

async function assertAdmin(supabase) {
  const { role } = await getRole(supabase);
  return role === "admin";
}

// La table arrive par migration_carnet.sql. Tant qu'elle n'existe pas, le
// dire franchement plutôt que de laisser une erreur Postgres brute.
function messageErreur(error) {
  const texte = error?.message || "";
  if (/relation .*carnet.* does not exist|could not find the table/i.test(texte)) {
    return "La migration migration_carnet.sql n'a pas encore été exécutée dans Supabase.";
  }
  return texte || "Erreur inattendue";
}

export async function saveNote(payload) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    const titre = (payload.titre || "").trim();
    if (!titre) return { error: "Le titre est requis" };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const ligne = {
      type: payload.type || "note",
      titre,
      detail: (payload.detail || "").trim() || null,
      montant: payload.montant === "" || payload.montant == null ? null : Number(payload.montant),
      date_echeance: payload.dateEcheance || null,
      vehicle_id: payload.vehicleId || null,
    };

    if (payload.id) {
      const { error } = await supabase.from("carnet").update(ligne).eq("id", payload.id);
      if (error) return { error: messageErreur(error) };
      revalidatePath("/carnet");
      return { success: true, id: payload.id };
    }

    const { data, error } = await supabase
      .from("carnet")
      .insert({ ...ligne, created_by: user?.id })
      .select("id")
      .single();
    if (error) return { error: messageErreur(error) };

    revalidatePath("/carnet");
    revalidatePath("/");
    return { success: true, id: data?.id };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function setNoteStatut(id, statut) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };
    if (!["ouvert", "regle"].includes(statut)) return { error: "Statut inconnu" };

    const { error } = await supabase
      .from("carnet")
      .update({
        statut,
        regle_le: statut === "regle" ? new Date().toISOString().slice(0, 10) : null,
      })
      .eq("id", id);
    if (error) return { error: messageErreur(error) };

    revalidatePath("/carnet");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deleteNote(id) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    // Les fichiers partent avec la ligne (cascade en base), mais le contenu
    // stocké doit être retiré explicitement : rien ne le supprime pour nous.
    const { data: fichiers } = await supabase
      .from("carnet_fichiers")
      .select("chemin")
      .eq("carnet_id", id);

    if (fichiers?.length) {
      await supabase.storage.from("carnet").remove(fichiers.map((f) => f.chemin));
    }

    const { error } = await supabase.from("carnet").delete().eq("id", id);
    if (error) return { error: messageErreur(error) };

    revalidatePath("/carnet");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deleteFichier(fichierId) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    const { data: fichier } = await supabase
      .from("carnet_fichiers")
      .select("chemin")
      .eq("id", fichierId)
      .single();

    if (fichier?.chemin) {
      await supabase.storage.from("carnet").remove([fichier.chemin]);
    }

    const { error } = await supabase.from("carnet_fichiers").delete().eq("id", fichierId);
    if (error) return { error: messageErreur(error) };

    revalidatePath("/carnet");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}
