// Catégories du carnet de bord, partagées par la page et le tableau de bord.

export const TYPES = [
  { id: "note", label: "Note", emoji: "📌", couleur: "var(--text-slate)", aide: "À ne pas oublier, à classer plus tard" },
  { id: "a_recevoir", label: "On nous doit", emoji: "💰", couleur: "var(--green)", aide: "Argent dû à FMB, hors circuit véhicules", montant: true },
  { id: "a_payer", label: "Nous devons", emoji: "💸", couleur: "var(--red)", aide: "Argent que FMB doit", montant: true },
  { id: "echeance", label: "Échéance", emoji: "📅", couleur: "var(--amber)", aide: "Assurance, visite technique, vignette, permis…", date: true },
  { id: "entretien", label: "Entretien", emoji: "🔧", couleur: "var(--fleet-bright)", aide: "Révision ou réparation à prévoir", date: true },
  { id: "document", label: "Document", emoji: "📄", couleur: "var(--purple)", aide: "Carte grise, contrat, facture à conserver" },
  { id: "incident", label: "Incident", emoji: "⚠️", couleur: "var(--red)", aide: "Accident, PV, panne majeure" },
];

export const TYPE_PAR_ID = Object.fromEntries(TYPES.map((t) => [t.id, t]));

/** Nombre de jours entre aujourd'hui et une date ISO. Négatif si passée. */
export function joursAvant(dateISO, aujourdhui = new Date().toISOString().slice(0, 10)) {
  if (!dateISO) return null;
  const ms = new Date(dateISO + "T00:00:00") - new Date(aujourdhui + "T00:00:00");
  return Math.round(ms / 86400000);
}

/**
 * Ce qui mérite d'apparaître sur le tableau de bord : les lignes ouvertes
 * dont l'échéance approche ou est dépassée, plus les dettes.
 *
 * Le reste dort dans le carnet. C'est ce qui l'empêche de devenir un
 * cimetière : on n'affiche que ce qui demande une action.
 */
export function aSurveiller(lignes, horizonJours = 30) {
  const ouvertes = (lignes || []).filter((l) => l.statut === "ouvert");

  const echeances = ouvertes
    .filter((l) => l.date_echeance)
    .map((l) => ({ ...l, jours: joursAvant(l.date_echeance) }))
    .filter((l) => l.jours <= horizonJours)
    .sort((a, b) => a.jours - b.jours);

  const aRecevoir = ouvertes
    .filter((l) => l.type === "a_recevoir")
    .reduce((s, l) => s + (Number(l.montant) || 0), 0);

  const aPayer = ouvertes
    .filter((l) => l.type === "a_payer")
    .reduce((s, l) => s + (Number(l.montant) || 0), 0);

  return {
    echeances,
    enRetard: echeances.filter((l) => l.jours < 0).length,
    aRecevoir,
    aPayer,
    aClasser: ouvertes.filter((l) => l.type === "note").length,
  };
}
