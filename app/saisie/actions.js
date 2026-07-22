"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function saveEntry(payload) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const row = {
    vehicle_id: payload.vehicleId,
    date: payload.date,
    receveur: payload.receveur,
    recette: Number(payload.recette) || 0,
    gazoil: Number(payload.gazoil) || 0,
    gazoil_note: payload.gazoilNote || "",
    autres: Number(payload.autres) || 0,
    autres_note: payload.autresNote || "",
    total_caisse: Number(payload.totalCaisse) || 0,
    net: Number(payload.net) || 0,
    created_by: user?.id,
  };

  const { error } = await supabase
    .from("entries")
    .upsert(row, { onConflict: "vehicle_id,date" });

  if (error) return { error: error.message };

  revalidatePath("/saisie");
  revalidatePath("/");
  return { success: true };
}

export async function deleteEntry(vehicleId, date) {
  const supabase = createClient();
  const { error } = await supabase
    .from("entries")
    .delete()
    .eq("vehicle_id", vehicleId)
    .eq("date", date);

  if (error) return { error: error.message };

  revalidatePath("/saisie");
  revalidatePath("/");
  return { success: true };
}
