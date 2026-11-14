"use client";

// Génération des documents PDF à partir des données saisies. Partagé par la
// page Rapports et par l'assistant : un même document, quel que soit
// l'endroit d'où on le demande.

import { createClient } from "@/lib/supabase/client";
import { lireTout } from "@/lib/supabase/lire-tout";
import { construireDecomptes } from "@/lib/decomptes";
import { telechargerPDF } from "@/lib/telecharger";

export const TYPES_DOCUMENT = {
  releve_versements: "Relevé de versements",
  releve_avances: "Relevé des avances",
  decompte_solde: "Décompte de solde",
  recu_paiement: "Reçu de paiement",
};

/** Erreur attendue : rien à mettre dans le document. Le message s'affiche tel quel. */
export class DocumentVide extends Error {}

/**
 * Génère et remet un document.
 *
 *   { type, vehicle, dateDebut, dateFin }   relevés et décompte
 *   { type: "recu_paiement", vehicle, periode }
 *
 * `vehicle` est la fiche complète du véhicule. Le générateur de PDF, lourd,
 * n'est chargé qu'à ce moment.
 */
export async function genererDocument({ type, vehicle, dateDebut, dateFin, periode }) {
  if (!vehicle) throw new Error("Véhicule introuvable.");
  const supabase = createClient();
  const pdf = await import("@/lib/pdf/report");

  // Lecture paginée : un relevé sur plusieurs années dépasse vite la limite
  // de 1 000 lignes de l'API, et le PDF serait tronqué sans avertissement.
  const lire = async (table, { borne = true, colonnes = "*", tri = "date" } = {}) => {
    const { data, error } = await lireTout(() => {
      let requete = supabase.from(table).select(colonnes).eq("vehicle_id", vehicle.id);
      if (borne) requete = requete.gte("date", dateDebut).lte("date", dateFin);
      return requete.order(tri, { ascending: true });
    });
    if (error) throw error;
    return data || [];
  };

  if (type === "recu_paiement") {
    const [entries, avances, paiements] = await Promise.all([
      lire("entries", { borne: false, colonnes: "vehicle_id,date,net" }),
      lire("avances", { borne: false, colonnes: "vehicle_id,date,type,montant,statut,regularisee_auto" }),
      lire("paiements", { borne: false, tri: "date_paiement" }),
    ]);
    const decompte = construireDecomptes(vehicle.id, entries, avances, paiements).find((d) => d.periode === periode);
    if (!decompte || !decompte.paiements.length) {
      throw new DocumentVide("Aucun paiement n'est enregistré pour ce mois : il n'y a pas de reçu à établir.");
    }
    return telechargerPDF(
      pdf.generateRecuPDF(vehicle, decompte, decompte.paiements),
      `recu_${vehicle.immatriculation}_${periode}.pdf`
    );
  }

  if (!dateDebut || !dateFin) throw new Error("Indiquez une date de début et une date de fin.");
  if (dateDebut > dateFin) throw new Error("La date de début doit précéder la date de fin.");
  const nom = (prefixe) => `${prefixe}_${vehicle.immatriculation}_${dateDebut}_${dateFin}.pdf`;

  if (type === "releve_versements") {
    const entries = await lire("entries");
    if (!entries.length) throw new DocumentVide("Aucune saisie sur cette période.");
    return telechargerPDF(pdf.generateVersementsPDF(vehicle, entries, dateDebut, dateFin), nom("versements"));
  }

  if (type === "releve_avances") {
    const avances = await lire("avances");
    if (!avances.length) throw new DocumentVide("Aucune avance sur cette période.");
    return telechargerPDF(pdf.generateAvancesPDF(vehicle, avances, dateDebut, dateFin), nom("avances"));
  }

  if (type === "decompte_solde") {
    const [entries, avances] = await Promise.all([lire("entries"), lire("avances")]);
    if (!entries.length && !avances.length) throw new DocumentVide("Aucune donnée sur cette période.");
    return telechargerPDF(pdf.generateDecomptePDF(vehicle, entries, avances, dateDebut, dateFin), nom("decompte"));
  }

  throw new Error("Type de document inconnu.");
}
