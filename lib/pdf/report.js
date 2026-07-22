import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { LOGO_BASE64 } from "./logo";

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

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/,/g, " ");
const fmtDateLong = (iso) => {
  if (!iso) return "";
  return new Date(iso + "T00:00:00").toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });
};

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
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(14, y, pageWidth - 14, y);
  y += 2;

  rows.forEach(([label, value]) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(label, 14, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(String(value), 90, y + 5);
    y += 7.5;
  });

  doc.line(14, y, pageWidth - 14, y);
  return y + 10;
}

function drawSectionTitle(doc, y, text) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFillColor(...FLEET);
  doc.rect(14, y, pageWidth - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text(text, 17, y + 5.5);
  return y + 8 + 3;
}

function drawSummaryRows(doc, y, rows) {
  const pageWidth = doc.internal.pageSize.getWidth();
  rows.forEach(([label, value], i) => {
    if (i > 0) {
      doc.setDrawColor(...LINE);
      doc.line(14, y, pageWidth - 14, y);
    }
    doc.setFont(label.bold ? "helvetica" : "helvetica", label.bold ? "bold" : "normal");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(label.text || label, 14, y + 6);
    doc.setFont("helvetica", label.bold ? "bold" : "normal");
    doc.text(String(value), pageWidth - 14, y + 6, { align: "right" });
    y += 9;
  });
  return y + 4;
}

function drawHighlightBox(doc, y, label, value, color) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const h = 14;
  doc.setFillColor(...color);
  doc.rect(14, y, pageWidth - 28, h, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(label, 18, y + h / 2 + 1.5, { maxWidth: pageWidth - 100 });
  doc.setFontSize(13);
  doc.text(String(value), pageWidth - 18, y + h / 2 + 1.5, { align: "right" });
  return y + h + 10;
}

function drawFooter(doc, note) {
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setDrawColor(...LINE);
    doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...SLATE);
    doc.text(note, 14, pageHeight - 11);
    doc.text(`Page ${i} / ${pageCount}`, pageWidth - 14, pageHeight - 11, { align: "right" });
  }
}

function drawSignatures(doc, y, leftLabel, rightLabel) {
  const pageWidth = doc.internal.pageSize.getWidth();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  doc.text(leftLabel, 14, y);
  doc.text(rightLabel, pageWidth / 2 + 6, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...SLATE);
  doc.text("Nom : ____________________   Date : __________", 14, y + 8);
  doc.text("Nom : ____________________   Date : __________", pageWidth / 2 + 6, y + 8);
  doc.text("Signature :", 14, y + 16);
  doc.text("Signature :", pageWidth / 2 + 6, y + 16);
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
    ["Période couverte", `Du ${dateDebut} au ${dateFin}`],
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
    body: avances.map((a) => [a.date, AVANCE_LABEL[a.type] || a.type, fmt(a.montant), a.note || ""]),
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
  const lines = doc.splitTextToSize(explication, doc.internal.pageSize.getWidth() - 28);
  doc.text(lines, 14, y);
  y += lines.length * 4.5 + 14;

  drawSignatures(doc, y, "Établi par (FMB Transport)", "Pris acte par (Propriétaire)");

  drawFooter(
    doc,
    `Réf. : ce décompte s'appuie sur le Relevé de versements et le Relevé des avances (${vehicle.marque} — ${vehicle.immatriculation}), période du ${dateDebut} au ${dateFin}.`
  );
  return doc;
}
