"use server";

import { createClient } from "@/lib/supabase/server";
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
