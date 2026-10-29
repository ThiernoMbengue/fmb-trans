import { construireDecomptes, dernierePeriodeSoldee, finDePeriode } from "@/lib/decomptes";
import { lireTout } from "@/lib/supabase/lire-tout";

/**
 * Aligne le statut des avances sur l'état réel des paiements, pour toute
 * une flotte en une seule lecture.
 *
 * « Réglée » veut dire : déjà prise en compte dans un décompte soldé. Le
 * sens vaut pour les trois types — une avance remise, une dépense avancée
 * comme un remboursement reçu passent tous par le décompte du mois, et sont
 * donc consommés ensemble quand ce décompte est payé.
 *
 * Le report enchaîne les mois : dès qu'un mois retombe à zéro, tout ce qui
 * précède a été payé, donc toutes les avances antérieures ont été
 * récupérées. On marque jusqu'à ce repère, et on défait au-delà.
 *
 * La fonction est idempotente : la rejouer ne change rien, et le cas
 * courant — rien à corriger — ne coûte que trois lectures, sans écriture.
 *
 * Les marquages posés à la main (regularisee_auto = false) ne sont jamais
 * défaits : seule la machine reprend ce que la machine a écrit.
 */
export async function reconcilierFlotte(supabase, vehicleIds) {
  const ids = (vehicleIds || []).filter(Boolean);
  if (!ids.length) return { marquees: 0, rouvertes: 0 };

  const [e, a, p] = await Promise.all([
    lireTout(() => supabase.from("entries").select("vehicle_id,date,net").in("vehicle_id", ids)),
    lireTout(() => supabase.from("avances").select("*").in("vehicle_id", ids)),
    lireTout(() =>
      supabase.from("paiements").select("vehicle_id,periode,date_paiement,montant").in("vehicle_id", ids)
    ),
  ]);

  const premiereErreur = e.error || a.error || p.error;
  if (premiereErreur) return { error: premiereErreur.message };

  const entries = e.data || [];
  const avances = a.data || [];
  const paiements = p.data || [];

  // Les marquages à poser, regroupés par période : une seule écriture par
  // période au lieu d'une par véhicule.
  const parPeriode = new Map();
  const aRouvrir = [];

  for (const vehicleId of ids) {
    const decomptes = construireDecomptes(vehicleId, entries, avances, paiements);
    const periodeSoldee = dernierePeriodeSoldee(decomptes);
    const limite = periodeSoldee ? finDePeriode(periodeSoldee) : null;

    for (const av of avances) {
      if (av.vehicle_id !== vehicleId) continue;

      const couverte = limite != null && av.date <= limite;

      if (couverte && av.statut !== "regularisee") {
        if (!parPeriode.has(periodeSoldee)) parPeriode.set(periodeSoldee, []);
        parPeriode.get(periodeSoldee).push(av.id);
      } else if (!couverte && av.statut === "regularisee" && av.regularisee_auto) {
        // Le paiement qui la couvrait a été supprimé ou modifié.
        aRouvrir.push(av.id);
      }
    }
  }

  const aujourdhui = new Date().toISOString().slice(0, 10);
  let marquees = 0;

  for (const [periode, idsAvances] of parPeriode) {
    const { error } = await supabase
      .from("avances")
      .update({
        statut: "regularisee",
        regularisee_le: aujourdhui,
        regularisee_periode: periode,
        regularisee_auto: true,
        regularisee_note: null,
      })
      .in("id", idsAvances);
    if (error) return { error: error.message };
    marquees += idsAvances.length;
  }

  if (aRouvrir.length) {
    const { error } = await supabase
      .from("avances")
      .update({
        statut: "en_cours",
        regularisee_le: null,
        regularisee_periode: null,
        regularisee_auto: false,
        regularisee_note: null,
      })
      .in("id", aRouvrir);
    if (error) return { error: error.message };
  }

  return { marquees, rouvertes: aRouvrir.length };
}

/** Même chose, pour un seul véhicule. */
export async function reconcilierAvances(supabase, vehicleId) {
  if (!vehicleId) return { error: "Véhicule manquant" };
  return reconcilierFlotte(supabase, [vehicleId]);
}
