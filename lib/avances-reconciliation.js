import { construireDecomptes, dernierePeriodeSoldee, finDePeriode } from "@/lib/decomptes";

/**
 * Aligne le statut des avances d'un véhicule sur l'état réel des paiements.
 *
 * « Réglée » veut dire : déjà prise en compte dans un décompte soldé. Le
 * sens vaut pour les trois types — une avance remise, une dépense avancée
 * comme un remboursement reçu passent tous par le décompte du mois, et sont
 * donc consommés ensemble quand ce décompte est payé.
 *
 * Le report enchaîne les mois : dès qu'un mois retombe à zéro, tout ce qui
 * précède a été payé — donc toutes les avances antérieures ont été
 * récupérées. On marque jusqu'à ce repère, et on défait au-delà.
 *
 * La fonction est idempotente : la rejouer ne change rien. Elle sert aussi
 * bien après l'ajout d'un paiement qu'après sa suppression, et elle rattrape
 * au passage l'historique d'avant l'introduction du statut.
 *
 * Les marquages posés à la main (regularisee_auto = false) ne sont jamais
 * défaits : seule la machine reprend ce que la machine a écrit.
 */
export async function reconcilierAvances(supabase, vehicleId) {
  if (!vehicleId) return { error: "Véhicule manquant" };

  const [e, a, p] = await Promise.all([
    supabase.from("entries").select("vehicle_id,date,net").eq("vehicle_id", vehicleId),
    supabase.from("avances").select("*").eq("vehicle_id", vehicleId),
    supabase.from("paiements").select("vehicle_id,periode,date_paiement,montant").eq("vehicle_id", vehicleId),
  ]);

  const premiereErreur = e.error || a.error || p.error;
  if (premiereErreur) return { error: premiereErreur.message };

  const avances = a.data || [];
  const decomptes = construireDecomptes(vehicleId, e.data || [], avances, p.data || []);

  const periodeSoldee = dernierePeriodeSoldee(decomptes);
  const limite = periodeSoldee ? finDePeriode(periodeSoldee) : null;

  const aMarquer = [];
  const aRouvrir = [];

  for (const av of avances) {
    const couverte = limite != null && av.date <= limite;

    if (couverte && av.statut !== "regularisee") {
      aMarquer.push(av.id);
    } else if (!couverte && av.statut === "regularisee" && av.regularisee_auto) {
      // Le paiement qui la couvrait a été supprimé ou modifié.
      aRouvrir.push(av.id);
    }
  }

  if (aMarquer.length) {
    const { error } = await supabase
      .from("avances")
      .update({
        statut: "regularisee",
        regularisee_le: new Date().toISOString().slice(0, 10),
        regularisee_periode: periodeSoldee,
        regularisee_auto: true,
        regularisee_note: null,
      })
      .in("id", aMarquer);
    if (error) return { error: error.message };
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

  return { marquees: aMarquer.length, rouvertes: aRouvrir.length, periodeSoldee };
}
