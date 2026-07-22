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
