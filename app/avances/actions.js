"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveAvance(payload) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    vehicle_id: payload.vehicleId,
    date: payload.date,
    type: payload.type,
    montant: Number(payload.montant) || 0,
    note: payload.note || "",
    created_by: user?.id,
  };

  const { error } = await supabase.from("avances").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/avances");
  revalidatePath("/");
  return { success: true };
}

export async function deleteAvance(id) {
  const supabase = createClient();
  const { error } = await supabase.from("avances").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/avances");
  revalidatePath("/paiements");
  revalidatePath("/");
  return { success: true };
}

/**
 * Marque une avance comme réglée, ou la remet en cours.
 *
 * Le marquage posé ici est manuel : il sert aux avances récupérées en dehors
 * des décomptes — rendues en espèces, compensées, abandonnées. Il n'est
 * jamais défait automatiquement, contrairement à celui que pose le règlement
 * d'un décompte.
 *
 * Le décompte du mois de l'avance n'est pas modifié : il reste le relevé
 * historique de ce qui a été déduit ce mois-là.
 */
export async function setAvanceStatut(id, statut, note) {
  try {
    const supabase = createClient();

    if (!["en_cours", "regularisee"].includes(statut)) {
      return { error: "Statut inconnu" };
    }

    const champs =
      statut === "regularisee"
        ? {
            statut,
            regularisee_le: new Date().toISOString().slice(0, 10),
            regularisee_periode: null,
            regularisee_auto: false,
            regularisee_note: note || null,
          }
        : {
            statut,
            regularisee_le: null,
            regularisee_periode: null,
            regularisee_auto: false,
            regularisee_note: null,
          };

    const { error } = await supabase.from("avances").update(champs).eq("id", id);
    if (error) {
      if (/statut|regularisee/i.test(error.message || "")) {
        return {
          error:
            "La migration migration_avances_statut.sql n'a pas encore ete executee dans Supabase.",
        };
      }
      return { error: error.message };
    }

    revalidatePath("/avances");
    revalidatePath("/paiements");
    revalidatePath("/");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function requestAvance(payload) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    vehicle_id: payload.vehicleId,
    montant: Number(payload.montant) || 0,
    note: payload.note || "",
    requested_by: user?.id,
  };

  const { error } = await supabase.from("avance_requests").insert(row);
  if (error) return { error: error.message };

  revalidatePath("/avances");
  return { success: true };
}

export async function cancelAvanceRequest(id) {
  const supabase = createClient();
  const { error } = await supabase.from("avance_requests").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/avances");
  return { success: true };
}

export async function resolveAvanceRequest(id, decision) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: reqRow, error: fetchErr } = await supabase
    .from("avance_requests")
    .select("*")
    .eq("id", id)
    .single();
  if (fetchErr || !reqRow) return { error: fetchErr?.message || "Demande introuvable" };

  if (decision === "approuvee") {
    const { error: insErr } = await supabase.from("avances").insert({
      vehicle_id: reqRow.vehicle_id,
      date: new Date().toISOString().slice(0, 10),
      type: "avance_proprietaire",
      montant: reqRow.montant,
      note: reqRow.note ? `Demande approuvée : ${reqRow.note}` : "Demande approuvée",
      created_by: user?.id,
    });
    if (insErr) return { error: insErr.message };
  }

  const { error: updErr } = await supabase
    .from("avance_requests")
    .update({ status: decision, resolved_at: new Date().toISOString(), resolved_by: user?.id })
    .eq("id", id);
  if (updErr) return { error: updErr.message };

  revalidatePath("/avances");
  revalidatePath("/");
  return { success: true };
}
