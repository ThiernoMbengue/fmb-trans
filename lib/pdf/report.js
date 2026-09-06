import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "./logo.js";

// ---------------------------------------------------------------------------
// Coordonnées de l'entreprise (affichées sur chaque document généré)
// ---------------------------------------------------------------------------
export const COMPANY = {
  nom: "FMB TRANS-MOBILITÉ SERVICES SARL",
  rc: "RC : SN DKR 2025 B 31716",
  ninea: "NINEA : 012385862",
  adresse: "Siège social : Yeumbeul Nord, Cité Asecna, Quartier Moussa Sall, N°A 28",
  tel: "Tél : +221 77 689 33 69",
  email: "E-mail : fmb.transmobilite@gmail.com",
};

const INK = [20, 50, 77];
const FLEET = [31, 78, 120];
const AMBER = [201, 134, 43];
const GREEN = [30, 122, 95];
const RED = [179, 69, 44];
const SLATE = [91, 107, 122];
const LINE = [228, 233, 239];

const fmt = (n) => {
  const num = Math.round(Number(n) || 0);
  const neg = num < 0;
  const digits = Math.abs(num).toString();
  let out = "";
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += " ";
    out += digits[i];
  }
  return (neg ? "-" : "") + out;
};
const fmtDateLong = (iso) => {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

// ---------------------------------------------------------------------------
// Assainissement du texte
//
// jsPDF écrit en WinAnsi avec les polices standard. Tout caractère absent de
// cet encodage est remplacé par un glyphe parasite ET fausse le calcul de
// largeur, ce qui décale les alignements à droite et fait déborder le texte
// hors de la page. On convertit donc les caractères risqués en équivalents
// sûrs — y compris dans les notes saisies par les utilisateurs.
// ---------------------------------------------------------------------------
const REMPLACEMENTS = {
  0x2212: "-", // signe moins mathématique
  0x2010: "-", // tiret
  0x2011: "-", // tiret insécable
  0x00a0: " ", // espace insécable
  0x2007: " ",
  0x2009: " ", // espace fine
  0x202f: " ", // espace fine insécable
};

// Caractères hors Latin-1 malgré tout présents dans WinAnsi
const WINANSI_HORS_LATIN1 = new Set([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030,
  0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022,
  0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0x017e, 0x0178,
]);

function safe(valeur) {
  const texte = valeur === null || valeur === undefined ? "" : String(valeur);
  let out = "";
  for (const ch of texte) {
    const code = ch.codePointAt(0);
    if (REMPLACEMENTS[code] !== undefined) out += REMPLACEMENTS[code];
    else if (code <= 0xff || WINANSI_HORS_LATIN1.has(code)) out += ch;
    // tout le reste (emoji, caractères exotiques) est écarté
  }
  return out;
}

const MARGE = 14;
const BAS_RESERVE = 21; // hauteur réservée au pied de page

// Passe à la page suivante s'il ne reste pas la place demandée
function ensureSpace(doc, y, hauteur) {
  if (y + hauteur > doc.internal.pageSize.getHeight() - BAS_RESERVE) {
    doc.addPage();
    return 20;
  }
  return y;
}

function drawHeader(doc, title, subtitle) {
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 18;

  // Logo FMB (icône bus + mains)
  const logoW = 20;
  const logoH = 13.3;
  doc.addImage(LOGO_BASE64, "PNG", 14, 10, logoW, logoH);

  doc.setTextColor(...INK);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(COMPANY.nom, 14 + logoW + 4, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  const infoLines = [COMPANY.rc, COMPANY.ninea, COMPANY.adresse, COMPANY.tel, COMPANY.email];
  infoLines.forEach((line, i) => {
    doc.text(line, pageWidth - 14, 12 + i * 3.6, { align: "right" });
  });

  y = 34;
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.4);
  doc.line(14, y, pageWidth - 14, y);
  y += 12;

  doc.setTextColor(...FLEET);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(title, pageWidth / 2, y, { align: "center" });
  y += 7;

  if (subtitle) {
    doc.setTextColor(...SLATE);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(subtitle, pageWidth / 2, y, { align: "center" });
    y += 8;
  } else {
    y += 4;
  }

  return y;
}

function drawInfoTable(doc, y, rows) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const xValeur = 90;
  const largeurValeur = pageWidth - MARGE - xValeur;

  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(MARGE, y, pageWidth - MARGE, y);
  y += 2;

  rows.forEach(([label, value]) => {
    doc.setFontSize(9.5);
    doc.setFont("helvetica", "normal");
    const lignes = doc.splitTextToSize(safe(value), largeurValeur);
    const hauteur = Math.max(6.4, lignes.length * 4.6 + 1.8);

    y = ensureSpace(doc, y, hauteur);

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(safe(label), MARGE, y + 5, { maxWidth: xValeur - MARGE - 4 });
    doc.setFont("helvetica", "normal");
    doc.text(lignes, xValeur, y + 5);
    y += hauteur;
  });

  doc.line(MARGE, y, pageWidth - MARGE, y);
  return y + 7;
}

function drawSectionTitle(doc, y, text) {
  const pageWidth = doc.internal.pageSize.getWidth();
  y = ensureSpace(doc, y, 16);
  doc.setFillColor(...FLEET);
  doc.rect(MARGE, y, pageWidth - MARGE * 2, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(safe(text), MARGE + 3, y + 5.5);
  return y + 8 + 2.5;
}

function drawSummaryRows(doc, y, rows) {
  const pageWidth = doc.internal.pageSize.getWidth();

  rows.forEach(([label, value], i) => {
    const gras = Boolean(label.bold);
    const texteLabel = safe(label.text || label);
    const texteValeur = safe(value);

    // La valeur est alignée à droite : on borne le libellé pour qu'il ne
    // vienne jamais chevaucher le montant.
    doc.setFont("helvetica", gras ? "bold" : "normal");
    doc.setFontSize(9.5);
    const largeurValeur = doc.getTextWidth(texteValeur);
    const largeurLabel = pageWidth - MARGE * 2 - largeurValeur - 6;
    const lignes = doc.splitTextToSize(texteLabel, Math.max(30, largeurLabel));
    const hauteur = Math.max(7.8, lignes.length * 4.6 + 2.6);

    y = ensureSpace(doc, y, hauteur);

    if (i > 0) {
      doc.setDrawColor(...LINE);
      doc.line(MARGE, y, pageWidth - MARGE, y);
    }
    doc.setTextColor(...INK);
    doc.text(lignes, MARGE, y + 6);
    doc.text(texteValeur, pageWidth - MARGE, y + 6, { align: "right" });
    y += hauteur;
  });
  return y + 3;
}

function drawHighlightBox(doc, y, label, value, color) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const texteValeur = safe(value);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  const largeurValeur = doc.getTextWidth(texteValeur);

  doc.setFontSize(10.5);
  const lignes = doc.splitTextToSize(safe(label), pageWidth - MARGE * 2 - largeurValeur - 14);
  const h = Math.max(13, lignes.length * 5 + 7);

  y = ensureSpace(doc, y, h + 10);

  doc.setFillColor(...color);
  doc.rect(MARGE, y, pageWidth - MARGE * 2, h, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10.5);
  doc.text(lignes, MARGE + 4, y + h / 2 - (lignes.length - 1) * 2.5 + 1.5);
  doc.setFontSize(13);
  doc.text(texteValeur, pageWidth - MARGE - 4, y + h / 2 + 1.5, { align: "right" });
  return y + h + 7;
}

function drawFooter(doc, note) {
  const pageCount = doc.internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);

    // On réserve la zone de droite pour la pagination, puis on tronque la
    // note sur une seule ligne : elle ne peut plus déborder ni se superposer.
    const pagination = `Page ${i} / ${pageCount}`;
    const largeurPagination = doc.getTextWidth(pagination);
    const largeurNote = pageWidth - MARGE * 2 - largeurPagination - 6;

    let texte = safe(note);
    if (doc.getTextWidth(texte) > largeurNote) {
      const lignes = doc.splitTextToSize(texte, largeurNote - 3);
      texte = (lignes[0] || "").replace(/\s+\S*$/, "") + "...";
    }

    doc.setDrawColor(...LINE);
    doc.line(MARGE, pageHeight - 16, pageWidth - MARGE, pageHeight - 16);
    doc.setTextColor(...SLATE);
    doc.text(texte, MARGE, pageHeight - 11);
    doc.text(pagination, pageWidth - MARGE, pageHeight - 11, { align: "right" });
  }
}

function drawSignatures(doc, y, leftLabel, rightLabel) {
  const pageWidth = doc.internal.pageSize.getWidth();
  // Le bloc fait ~20 mm : sans cette garde il chevauchait le pied de page.
  y = ensureSpace(doc, y, 19);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(safe(leftLabel), MARGE, y);
  doc.text(safe(rightLabel), pageWidth / 2 + 6, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text("Nom : ____________________   Date : __________", MARGE, y + 7);
  doc.text("Nom : ____________________   Date : __________", pageWidth / 2 + 6, y + 7);
  doc.text("Signature :", MARGE, y + 14);
  doc.text("Signature :", pageWidth / 2 + 6, y + 14);
}

// ---------------------------------------------------------------------------
// Relevé de versements
// ---------------------------------------------------------------------------
export function generateVersementsPDF(vehicle, entries, dateDebut, dateFin) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = drawHeader(doc, "RELEVÉ DE VERSEMENTS", "Gestion de véhicule de transport");

  const worked = entries.filter((e) => Number(e.recette) > 0).length;
  const rest = entries.length - worked;
  const totRecette = entries.reduce((s, e) => s + (Number(e.recette) || 0), 0);
  const totGazoil = entries.reduce((s, e) => s + (Number(e.gazoil) || 0), 0);
  const totAutres = entries.reduce((s, e) => s + (Number(e.autres) || 0), 0);
  const totNet = entries.reduce((s, e) => s + (Number(e.net) || 0), 0);

  y = drawInfoTable(doc, y, [
    ["Propriétaire du véhicule", vehicle.proprietaire || "—"],
    ["Gestionnaire", "FMB Transport"],
    ["Chauffeur", vehicle.chauffeur || "—"],
    ["Véhicule", vehicle.marque],
    ["Immatriculation", vehicle.immatriculation],
    ["Période couverte", `Du ${fmtDateLong(dateDebut)} au ${fmtDateLong(dateFin)}`],
    ["Date d'émission", fmtDateLong(new Date().toISOString().slice(0, 10))],
  ]);

  y = drawSectionTitle(doc, y, "RÉSUMÉ DE LA PÉRIODE");
  y = drawSummaryRows(doc, y, [
    ["Recette totale générée", `${fmt(totRecette)} FCFA`],
    ["Dépenses principales (gazoil)", `${fmt(totGazoil)} FCFA`],
    ["Autres dépenses (parking, lavage, entretien, etc.)", `${fmt(totAutres)} FCFA`],
    ["Jours travaillés / jours de repos", `${worked} / ${rest}`],
  ]);
  y = drawHighlightBox(doc, y, "NET TOTAL VERSÉ AU PROPRIÉTAIRE", `${fmt(totNet)} FCFA`, GREEN);

  y = drawSectionTitle(doc, y, "DÉTAIL JOURNALIER DES VERSEMENTS");

  autoTable(doc, {
    startY: y,
    head: [["Date", "Recette totale", "Dép. princip.", "Autres dép.", "Net versé"]],
    body: entries.map((e) => [
      e.date,
      fmt(e.recette),
      fmt(e.gazoil),
      fmt(e.autres),
      fmt(e.net),
    ]),
    foot: [["TOTAL", fmt(totRecette), fmt(totGazoil), fmt(totAutres), fmt(totNet)]],
    // Sans cela, le total général se répète en bas de chaque page et se lit
    // à tort comme un sous-total.
    showFoot: "lastPage",
    theme: "grid",
    headStyles: { fillColor: FLEET, textColor: 255, fontSize: 8.5, halign: "center" },
    footStyles: { fillColor: [245, 247, 250], textColor: INK, fontStyle: "bold", fontSize: 8.5, halign: "center" },
    bodyStyles: { fontSize: 8.5, halign: "center", textColor: INK },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === "body" && data.row.raw[1] === "0") {
        data.cell.styles.textColor = [183, 192, 202];
      }
    },
  });

  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...SLATE);
  doc.text(
    "Notes : « Dép. princip. » correspond principalement au gazoil. « Autres dép. » regroupe le parking, le lavage, les péages,\nles réparations ponctuelles et autres frais divers renseignés au jour le jour.",
    14, finalY
  );
  drawSignatures(doc, finalY + 14, "Établi par (FMB Transport)", "Approuvé par (Propriétaire)");

  drawFooter(doc, `FMB Transport - Relevé de versements (${vehicle.marque} — ${vehicle.immatriculation})`);
  return doc;
}

// ---------------------------------------------------------------------------
// Relevé des avances
// ---------------------------------------------------------------------------
const AVANCE_LABEL = {
  avance_proprietaire: "Avance",
  depense_imprevue: "Prêt (dépense)",
  remboursement: "Remboursement",
};

export function generateAvancesPDF(vehicle, avances, dateDebut, dateFin) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = drawHeader(doc, "RELEVÉ DES AVANCES", `Dépenses non fixes (prêts et remboursements) — ${vehicle.marque}, ${vehicle.immatriculation}`);

  const totPrets = avances.filter((a) => a.type !== "remboursement").reduce((s, a) => s + (Number(a.montant) || 0), 0);
  const totRembourse = avances.filter((a) => a.type === "remboursement").reduce((s, a) => s + (Number(a.montant) || 0), 0);
  const soldeNet = totPrets - totRembourse;

  y = drawInfoTable(doc, y, [
    ["Concerné (propriétaire)", vehicle.proprietaire || "—"],
    ["Gestionnaire", "FMB Transport"],
    ["Véhicule", `${vehicle.marque} — ${vehicle.immatriculation}`],
    ["Période couverte", `Du ${fmtDateLong(dateDebut)} au ${fmtDateLong(dateFin)}`],
    ["Date d'émission", fmtDateLong(new Date().toISOString().slice(0, 10))],
  ]);

  y = drawSectionTitle(doc, y, "RÉSUMÉ");
  y = drawSummaryRows(doc, y, [
    ["Total des avances (prêts)", `${fmt(totPrets)} FCFA`],
    ["Total des remboursements", `${fmt(totRembourse)} FCFA`],
  ]);
  y = drawHighlightBox(doc, y, "SOLDE NET DÛ AU GESTIONNAIRE", `${fmt(soldeNet)} FCFA`, AMBER);

  y = drawSectionTitle(doc, y, "DÉTAIL DES AVANCES ET REMBOURSEMENTS");

  autoTable(doc, {
    startY: y,
    head: [["Date", "Type", "Montant", "Remarques"]],
    body: avances.map((a) => [a.date, AVANCE_LABEL[a.type] || a.type, fmt(a.montant), safe(a.note || "")]),
    theme: "grid",
    headStyles: { fillColor: FLEET, textColor: 255, fontSize: 8.5, halign: "center" },
    bodyStyles: { fontSize: 8.5, textColor: INK },
    columnStyles: { 0: { halign: "center", cellWidth: 24 }, 1: { halign: "center", cellWidth: 30 }, 2: { halign: "right", cellWidth: 24 } },
    alternateRowStyles: { fillColor: [250, 251, 253] },
    margin: { left: 14, right: 14 },
  });

  const finalY = doc.lastAutoTable.finalY + 6;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK);
  doc.text(
    `Total prêts : ${fmt(totPrets)} FCFA  |  Total remboursements : ${fmt(totRembourse)} FCFA  |  Solde net dû : ${fmt(soldeNet)} FCFA`,
    14, finalY
  );

  drawSignatures(doc, finalY + 16, "Établi par (Gestionnaire)", "Approuvé par (Propriétaire)");
  drawFooter(doc, `FMB Trans-Mobilité Services SARL - Relevé des avances (${vehicle.marque} — ${vehicle.immatriculation})`);
  return doc;
}

// ---------------------------------------------------------------------------
// Décompte de solde
// ---------------------------------------------------------------------------
export function generateDecomptePDF(vehicle, entries, avances, dateDebut, dateFin) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = drawHeader(doc, "DÉCOMPTE DE SOLDE", "Solde dû entre le propriétaire et le gestionnaire");

  const worked = entries.filter((e) => Number(e.recette) > 0).length;
  const netVersements = entries.reduce((s, e) => s + (Number(e.net) || 0), 0);
  const remuneration = worked * (Number(vehicle.taux_chauffeur) || 5000);
  const totAvances = avances.filter((a) => a.type !== "remboursement").reduce((s, a) => s + (Number(a.montant) || 0), 0);
  const totRembourse = avances.filter((a) => a.type === "remboursement").reduce((s, a) => s + (Number(a.montant) || 0), 0);
  const avancesNonRembourse = totAvances - totRembourse;
  const sousTotal = netVersements - remuneration - avancesNonRembourse;

  let fraisGestion = 0;
  let soldeFinal = sousTotal;
  let labelSolde = "SOLDE DÛ PAR LE PROPRIÉTAIRE À FMB TRANSPORT";
  let boxColor = RED;
  if (sousTotal > 0) {
    fraisGestion = Math.round(sousTotal * 0.1);
    soldeFinal = sousTotal - fraisGestion;
    labelSolde = "SOLDE DÛ PAR FMB TRANSPORT AU PROPRIÉTAIRE";
    boxColor = GREEN;
  }

  y = drawInfoTable(doc, y, [
    ["Bénéficiaire (propriétaire)", vehicle.proprietaire || "—"],
    ["Émis par (gestionnaire)", "FMB Trans-Mobilité Services SARL"],
    ["Véhicule", `${vehicle.marque} — ${vehicle.immatriculation}`],
    ["Période de référence", `Du ${fmtDateLong(dateDebut)} au ${fmtDateLong(dateFin)} (${worked} jour(s) travaillé(s))`],
    ["Date d'émission", fmtDateLong(new Date().toISOString().slice(0, 10))],
  ]);

  y = drawSectionTitle(doc, y, "DÉTAIL DU CALCUL");
  y = drawSummaryRows(doc, y, [
    ["Net total des versements sur la période (relevé de versements)", `${fmt(netVersements)} FCFA`],
    [`Rémunération du chauffeur (${fmt(vehicle.taux_chauffeur || 5000)} FCFA × ${worked} jours travaillés)`, `− ${fmt(remuneration)} FCFA`],
    ["Avances non remboursées sur la période (relevé des avances)", `− ${fmt(avancesNonRembourse)} FCFA`],
    [{ text: "Sous-total avant rémunération de gestion", bold: true }, `${sousTotal < 0 ? "− " : ""}${fmt(Math.abs(sousTotal))} FCFA`],
    ["Rémunération de gestion FMB Transport (10 %)", fraisGestion > 0 ? `− ${fmt(fraisGestion)} FCFA` : "Non applicable (sous-total négatif)"],
  ]);
  y = drawHighlightBox(doc, y, labelSolde, `${soldeFinal < 0 ? "− " : ""}${fmt(Math.abs(soldeFinal))} FCFA`, boxColor);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const explication = sousTotal < 0
    ? `Je soussigné ${vehicle.proprietaire || "le propriétaire"}, propriétaire du véhicule ${vehicle.marque} immatriculé ${vehicle.immatriculation}, prends acte que le solde net de la période fait apparaître un déficit de ${fmt(Math.abs(soldeFinal))} FCFA en faveur de FMB Trans-Mobilité Services SARL. Ce montant reste dû par le propriétaire au gestionnaire, à régulariser lors d'un prochain versement ou remboursement.`
    : `Je soussigné ${vehicle.proprietaire || "le propriétaire"}, propriétaire du véhicule ${vehicle.marque} immatriculé ${vehicle.immatriculation}, prends acte que le solde net de la période fait apparaître un montant de ${fmt(soldeFinal)} FCFA dû par FMB Trans-Mobilité Services SARL en sa faveur, après déduction de la rémunération de gestion.`;
  const lines = doc.splitTextToSize(safe(explication), doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, y);
  y += lines.length * 4.5 + 10;

  drawSignatures(doc, y, "Établi par (FMB Transport)", "Pris acte par (Propriétaire)");

  drawFooter(
    doc,
    `Décompte de solde — ${vehicle.marque} (${vehicle.immatriculation}), du ${fmtDateLong(dateDebut)} au ${fmtDateLong(dateFin)}.`
  );
  return doc;
}

// ---------------------------------------------------------------------------
// Reçu de versement mensuel au propriétaire
// ---------------------------------------------------------------------------
const MODE_LABEL = {
  especes: "Espèces",
  wave: "Wave",
  orange_money: "Orange Money",
  virement: "Virement bancaire",
  cheque: "Chèque",
  autre: "Autre",
};

export function generateRecuPDF(vehicle, decompte, paiements) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const numero = paiements[0]?.numero_recu || "—";
  let y = drawHeader(doc, "REÇU DE VERSEMENT", `Décompte mensuel — ${decompte.periodeLabel}`);

  // La période figure déjà dans le sous-titre : inutile de la répéter ici,
  // et cela libère la place nécessaire au bloc de signature en bas de page.
  y = drawInfoTable(doc, y, [
    ["N° de reçu", numero],
    ["Véhicule", `${vehicle.marque} — ${vehicle.immatriculation}`],
    ["Propriétaire", vehicle.proprietaire || "—"],
    ["Établi le", fmtDateLong(new Date().toISOString().slice(0, 10))],
  ]);

  y = drawSectionTitle(doc, y, "DÉTAIL DU DÉCOMPTE");
  y = drawSummaryRows(doc, y, [
    ["Report du mois précédent", `${decompte.report < 0 ? "− " : "+ "}${fmt(Math.abs(decompte.report))} FCFA`],
    ["Net des versements du mois", `+ ${fmt(decompte.netMois)} FCFA`],
    ["Avances déjà remises au propriétaire", `− ${fmt(decompte.avances)} FCFA`],
    ["Dépenses imprévues avancées par FMB", `− ${fmt(decompte.depenses)} FCFA`],
    ["Remboursements reçus du propriétaire", `+ ${fmt(decompte.remboursements)} FCFA`],
    [{ text: "NET À PAYER POUR LA PÉRIODE", bold: true }, `${fmt(decompte.netAPayer)} FCFA`],
  ]);

  if (paiements.length) {
    y = drawSectionTitle(doc, y, "VERSEMENTS ENREGISTRÉS");
    autoTable(doc, {
      startY: y,
      head: [["Date", "Mode", "Référence", "Montant"]],
      body: paiements.map((p) => [
        fmtDateLong(p.date_paiement),
        MODE_LABEL[p.mode] || p.mode,
        p.reference || "—",
        `${fmt(p.montant)} FCFA`,
      ]),
      styles: { fontSize: 9, cellPadding: 2.5, textColor: INK, lineColor: LINE, lineWidth: 0.1 },
      headStyles: { fillColor: FLEET, textColor: 255, fontStyle: "bold", fontSize: 9 },
      columnStyles: { 3: { halign: "right", fontStyle: "bold" } },
      margin: { left: 14, right: 14 },
    });
    y = doc.lastAutoTable.finalY + 8;
  }

  const solde = decompte.solde;
  const soldeLabel =
    solde > 0 ? "SOLDE RESTANT DÛ AU PROPRIÉTAIRE" : solde < 0 ? "TROP-PERÇU À RÉGULARISER" : "SOLDE — INTÉGRALEMENT RÉGLÉ";
  const soldeColor = solde > 0 ? AMBER : solde < 0 ? RED : GREEN;

  y = drawSummaryRows(doc, y, [
    [{ text: "Total versé sur la période", bold: true }, `− ${fmt(decompte.paye)} FCFA`],
  ]);
  y = drawHighlightBox(doc, y, soldeLabel, `${fmt(Math.abs(solde))} FCFA`, soldeColor);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  const texte = `Je soussigné ${vehicle.proprietaire || "le propriétaire"}, propriétaire du véhicule ${vehicle.marque} immatriculé ${vehicle.immatriculation}, reconnais avoir reçu de FMB Trans-Mobilité Services SARL la somme de ${fmt(decompte.paye)} FCFA au titre du décompte de ${decompte.periodeLabel}.`;
  const lines = doc.splitTextToSize(safe(texte), doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, y);
  y += lines.length * 4.5 + 10;

  drawSignatures(doc, y, "Établi par (FMB Transport)", "Reçu par (Propriétaire)");

  drawFooter(
    doc,
    `Reçu ${numero} — ${vehicle.marque} (${vehicle.immatriculation}), période ${decompte.periodeLabel}.`
  );
  return doc;
}
