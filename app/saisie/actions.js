"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// Deux colonnes arrivent par migration : sans_chauffeur (migration_location)
// et note (migration_note_saisie). Tant qu'une migration n'a pas été exécutée,
// on réenregistre sans ces colonnes plutôt que de bloquer la saisie — mieux
// vaut une remarque perdue qu'un versement qu'on ne peut pas enregistrer.
//
// Mais ce repli doit se voir : une remarque jetee en silence donne
// l'impression que la fonction ne marche pas. L'appelant recoit donc de quoi
// prevenir l'utilisateur.
async function upsertEntries(supabase, rows) {
  let { error } = await supabase.from("entries").upsert(rows, { onConflict: "vehicle_id,date" });
  if (!error) return { error: null };

  const message = error.message || "";
  const noteManquante = /\bnote\b/i.test(message);
  const modeManquant = /sans_chauffeur/i.test(message);
  if (!noteManquante && !modeManquant) return { error };

  const sansColonne = rows.map(({ sans_chauffeur, note, ...reste }) => reste);
  ({ error } = await supabase.from("entries").upsert(sansColonne, { onConflict: "vehicle_id,date" }));
  if (error) return { error };

  const manquantes = [];
  if (noteManquante) manquantes.push("migration_note_saisie.sql");
  if (modeManquant) manquantes.push("migration_location.sql");

  return {
    error: null,
    avertissement:
      `Versement enregistré, mais la remarque n'a pas pu être conservée : ` +
      `exécutez ${manquantes.join(" et ")} dans Supabase.`,
  };
}

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
    sans_chauffeur: payload.sansChauffeur === true,
    note: payload.note || null,
    created_by: user?.id,
  };

  const { error, avertissement } = await upsertEntries(supabase, [row]);
  if (error) return { error: error.message };

  revalidatePath("/saisie");
  revalidatePath("/");
  return { success: true, avertissement };
}

// Enregistre une série de saisies identiques sur une plage de dates (ex: location à montant fixe/jour)
export async function saveLocationRange(payload) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { vehicleId, dateDebut, dateFin, montant, note, receveur, skipDates } = payload;
  if (!vehicleId || !dateDebut || !dateFin || !montant) return { error: "Champs manquants" };
  if (dateDebut > dateFin) return { error: "La date de début doit précéder la date de fin" };

  const skipSet = new Set(skipDates || []);
  const dates = [];
  let d = new Date(dateDebut + "T00:00:00");
  const end = new Date(dateFin + "T00:00:00");
  while (d <= end) {
    const isoDate = d.toISOString().slice(0, 10);
    if (!skipSet.has(isoDate)) dates.push(isoDate);
    d.setDate(d.getDate() + 1);
  }
  if (dates.length > 366) return { error: "Période trop longue (max 366 jours)" };
  if (dates.length === 0) return { success: true, count: 0 };

  const amount = Number(montant) || 0;
  const rows = dates.map((date) => ({
    vehicle_id: vehicleId,
    date,
    receveur: receveur || "",
    recette: amount,
    gazoil: 0,
    gazoil_note: "",
    autres: 0,
    autres_note: "",
    note: note || "Location",
    total_caisse: amount,
    net: amount,
    // Une location à montant fixe est par définition une location sans
    // chauffeur : aucun salaire n'est dû sur ces journées.
    sans_chauffeur: true,
    created_by: user?.id,
  }));

  const { error, avertissement } = await upsertEntries(supabase, rows);
  if (error) return { error: error.message };

  revalidatePath("/saisie");
  revalidatePath("/");
  return { success: true, count: dates.length, avertissement };
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
