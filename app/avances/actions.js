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
  revalidatePath("/");
  return { success: true };
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
