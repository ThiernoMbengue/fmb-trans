// Mise en forme des montants et des dates, partagée par toutes les pages.
//
// Tout est calculé à la main plutôt qu'avec Intl : le rendu doit être
// strictement identique sur le serveur et dans le navigateur, sinon React
// signale un écart à l'hydratation.

const MOIS_COURT = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_COURT = ["dim.", "lun.", "mar.", "mer.", "jeu.", "ven.", "sam."];

// Espace insécable : un montant ne doit jamais être coupé en fin de ligne
// (« 2 342 » d'un côté, « 969 » de l'autre).
const INSECABLE = " ";

/** 1234567 -> « 1 234 567 » */
export function fmt(n) {
  const num = Math.round(Number(n) || 0);
  const chiffres = Math.abs(num).toString();
  let out = "";
  for (let i = 0; i < chiffres.length; i++) {
    if (i > 0 && (chiffres.length - i) % 3 === 0) out += INSECABLE;
    out += chiffres[i];
  }
  return (num < 0 ? "-" : "") + out;
}

/** 1234567 -> « 1 234 567 F » */
export const fmtF = (n) => `${fmt(n)}${INSECABLE}F`;

export const todayISO = () => isoLocal();

const morceaux = (iso) => {
  const [y, m, d] = String(iso || "").slice(0, 10).split("-").map(Number);
  return y && m && d ? { y, m, d } : null;
};

/** « 2026-11-11 » -> « 11/11/2026 » */
export function fmtDate(iso) {
  const p = morceaux(iso);
  if (!p) return "";
  return `${String(p.d).padStart(2, "0")}/${String(p.m).padStart(2, "0")}/${p.y}`;
}

/**
 * « 2026-11-11 » -> « mer. 11 nov. ». L'année n'est ajoutée que si ce n'est
 * pas l'année en cours : dans un tableau de saisies, elle encombre.
 */
export function fmtJour(iso, { annee } = {}) {
  const p = morceaux(iso);
  if (!p) return "";
  const jour = JOURS_COURT[new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay()];
  const avecAnnee = annee ?? p.y !== new Date().getFullYear();
  return `${jour}${INSECABLE}${p.d}${INSECABLE}${MOIS_COURT[p.m - 1]}${avecAnnee ? INSECABLE + p.y : ""}`;
}

/** « 2026-11-11 » -> « 11 novembre 2026 » */
export function fmtDateLongue(iso) {
  const p = morceaux(iso);
  if (!p) return "";
  return `${p.d === 1 ? "1er" : p.d} ${MOIS_LONG[p.m - 1]} ${p.y}`;
}

/** « 2026-11 » -> « novembre 2026 » */
export function fmtPeriode(cle) {
  const [y, m] = String(cle || "").split("-");
  return y && m ? `${MOIS_LONG[Number(m) - 1]} ${y}` : "";
}

/** Initiales pour un avatar : « Serigne Modou Diop » -> « SD ». */
export function initiales(nom) {
  const mots = String(nom || "").trim().split(/[\s@._-]+/).filter(Boolean);
  if (!mots.length) return "?";
  return (mots[0][0] + (mots.length > 1 ? mots[mots.length - 1][0] : "")).toUpperCase();
}

/** Date du jour dans le fuseau de l'appareil, au format AAAA-MM-JJ. */
export function isoLocal(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * « 2026-11-30 » + 1 -> « 2026-12-01 ». Le calcul se fait en UTC d'un bout à
 * l'autre : passer par une date locale puis toISOString() décale d'un jour
 * dès que l'appareil n'est pas à l'heure GMT.
 */
export function ajouterJours(iso, n) {
  const p = morceaux(iso);
  if (!p) return iso;
  return new Date(Date.UTC(p.y, p.m - 1, p.d + n)).toISOString().slice(0, 10);
}

/** Tous les jours de `debut` à `fin` inclus (borné, pour ne jamais boucler). */
export function plageDeJours(debut, fin, max = 400) {
  if (!debut || !fin || debut > fin) return [];
  const jours = [];
  for (let d = debut; d <= fin && jours.length < max; d = ajouterJours(d, 1)) jours.push(d);
  return jours;
}
