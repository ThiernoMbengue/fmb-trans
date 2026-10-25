// Calcul des décomptes mensuels, partagé par la page Paiements (navigateur)
// et par les actions serveur. Une seule définition, pour que l'écran et le
// serveur ne puissent jamais diverger sur ce qui est dû.

export const MOIS_LONG = [
  "janvier", "février", "mars", "avril", "mai", "juin",
  "juillet", "août", "septembre", "octobre", "novembre", "décembre",
];

export const moisCourant = () => new Date().toISOString().slice(0, 10).slice(0, 7);

export function fmtPeriode(key) {
  const [y, m] = key.split("-");
  return `${MOIS_LONG[Number(m) - 1]} ${y}`;
}

/** Dernier jour d'une période 'YYYY-MM' : '2026-06' -> '2026-06-30'. */
export function finDePeriode(key) {
  const [y, m] = key.split("-").map(Number);
  // Le jour 0 du mois suivant est le dernier jour du mois demandé.
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/**
 * Construit les décomptes mensuels d'un véhicule, avec report du solde
 * d'un mois sur l'autre.
 *
 * Le statut d'une avance n'intervient pas ici : le décompte d'un mois est un
 * fait historique, il ne doit pas changer après coup. Marquer une avance
 * comme réglée dit seulement qu'elle a déjà été récupérée — ce que le
 * décompte de son mois avait justement acté.
 */
export function construireDecomptes(vehicleId, entries, avances, paiements) {
  const mois = new Set();
  const add = (d) => d && mois.add(d.slice(0, 7));

  const e = entries.filter((r) => r.vehicle_id === vehicleId);
  const a = avances.filter((r) => r.vehicle_id === vehicleId);
  const p = paiements.filter((r) => r.vehicle_id === vehicleId);

  e.forEach((r) => add(r.date));
  a.forEach((r) => add(r.date));
  p.forEach((r) => mois.add(r.periode));

  const cles = [...mois].sort();
  let report = 0;

  return cles.map((periode) => {
    const som = (rows, f) =>
      rows.filter((r) => (r.periode || r.date).slice(0, 7) === periode).reduce((s, r) => s + f(r), 0);

    const netMois = som(e, (r) => Number(r.net) || 0);
    const avancesMois = som(a.filter((r) => r.type === "avance_proprietaire"), (r) => Number(r.montant) || 0);
    const depensesMois = som(a.filter((r) => r.type === "depense_imprevue"), (r) => Number(r.montant) || 0);
    const remboursMois = som(a.filter((r) => r.type === "remboursement"), (r) => Number(r.montant) || 0);

    const netAPayer = netMois - avancesMois - depensesMois + remboursMois;
    const paiementsMois = p
      .filter((r) => r.periode === periode)
      .sort((x, y) => (x.date_paiement || "").localeCompare(y.date_paiement || ""));
    const paye = paiementsMois.reduce((s, r) => s + (Number(r.montant) || 0), 0);

    const reportEntrant = report;
    const solde = reportEntrant + netAPayer - paye;
    report = solde;

    let statut;
    if (periode === moisCourant()) statut = "en_cours";
    else if (solde <= 0) statut = "solde";
    else if (paye > 0) statut = "partiel";
    else statut = "a_payer";

    return {
      periode,
      periodeLabel: fmtPeriode(periode),
      report: reportEntrant,
      netMois,
      avances: avancesMois,
      depenses: depensesMois,
      remboursements: remboursMois,
      netAPayer,
      paiements: paiementsMois,
      paye,
      solde,
      statut,
    };
  });
}

/**
 * Dernière période entièrement réglée (solde nul ou négatif).
 *
 * Le report enchaîne les mois : si le solde d'un mois est retombé à zéro,
 * c'est que tout ce qui précède a été payé. Cette période sert donc de
 * repère pour savoir jusqu'où les avances ont été récupérées.
 */
export function dernierePeriodeSoldee(decomptes) {
  for (let i = decomptes.length - 1; i >= 0; i--) {
    if (decomptes[i].solde <= 0) return decomptes[i].periode;
  }
  return null;
}
