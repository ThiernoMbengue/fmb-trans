"use server";

import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { reconcilierAvances } from "@/lib/avances-reconciliation";
import { revalidatePath } from "next/cache";

async function assertAdmin(supabase) {
  const { role } = await getRole(supabase);
  return role === "admin";
}

// La colonne statut vient de migration_avances_statut.sql. Tant qu'elle
// n'existe pas, le paiement doit quand même aboutir : la mise à jour des
// avances est un complément, pas une condition.
async function synchroniserAvances(supabase, vehicleId) {
  try {
    const res = await reconcilierAvances(supabase, vehicleId);
    return res?.error ? { avertissement: res.error } : res;
  } catch (e) {
    return { avertissement: e?.message || "Avances non mises à jour" };
  }
}

export async function savePaiement(payload) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    const montant = Number(payload.montant) || 0;
    if (!payload.vehicleId || !payload.periode) return { error: "Véhicule et période requis" };
    if (montant <= 0) return { error: "Le montant doit être supérieur à zéro" };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("paiements").insert({
      vehicle_id: payload.vehicleId,
      periode: payload.periode,
      date_paiement: payload.datePaiement,
      montant,
      mode: payload.mode || "especes",
      reference: payload.reference || null,
      note: payload.note || null,
      created_by: user?.id,
    });
    if (error) return { error: error.message };

    // Si ce règlement solde la période, les avances qu'il couvre sont
    // récupérées : elles ne doivent plus figurer parmi les sommes dues.
    const suite = await synchroniserAvances(supabase, payload.vehicleId);

    revalidatePath("/paiements");
    revalidatePath("/avances");
    return { success: true, ...suite };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deletePaiement(id) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    // Le véhicule est relu avant la suppression : après, la ligne n'existe plus.
    const { data: paiement } = await supabase
      .from("paiements")
      .select("vehicle_id")
      .eq("id", id)
      .single();

    const { error } = await supabase.from("paiements").delete().eq("id", id);
    if (error) return { error: error.message };

    // La période n'est peut-être plus soldée : les avances qu'elle couvrait
    // redeviennent dues.
    const suite = paiement?.vehicle_id
      ? await synchroniserAvances(supabase, paiement.vehicle_id)
      : {};

    revalidatePath("/paiements");
    revalidatePath("/avances");
    return { success: true, ...suite };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

/** Relance l'alignement des avances sur les paiements, sans rien enregistrer. */
export async function resynchroniserAvances(vehicleId) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    const res = await reconcilierAvances(supabase, vehicleId);
    if (res?.error) return { error: res.error };

    revalidatePath("/paiements");
    revalidatePath("/avances");
    return { success: true, ...res };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}
