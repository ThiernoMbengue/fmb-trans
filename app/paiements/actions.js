"use server";

import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { revalidatePath } from "next/cache";

async function assertAdmin(supabase) {
  const { role } = await getRole(supabase);
  return role === "admin";
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

    revalidatePath("/paiements");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deletePaiement(id) {
  try {
    const supabase = createClient();
    if (!(await assertAdmin(supabase))) return { error: "Accès refusé" };

    const { error } = await supabase.from("paiements").delete().eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/paiements");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}
