"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Banknote, TrendingUp, CalendarClock, Percent, Target, Info, Bus,
  FileSpreadsheet, FileText, SlidersHorizontal, CalendarRange, Calculator,
  CalendarDays, ShieldCheck, Wrench, UserCog, Receipt, PiggyBank,
} from "lucide-react";
import { generateVersementsPDF, generateDossierInvestisseurPDF } from "@/lib/pdf/report";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const JOURS_PAR_MOIS = 30.44;

// Paramètres réels communiqués par l'exploitation
const DEFAUTS = {
  chauffeurParJour: 5000,        // payé par jour effectivement travaillé
  assuranceMensuelle: 7000,
  coutEntretien: 70000,          // une révision complète
  entretienTousLesMois: 2,       // ~5 000 km, soit environ 2 mois
  tauxGestion: 10,               // rémunération FMB, en % du résultat
  provisionMensuelle: 50000,     // réserve prudentielle, reste acquise à l'investisseur
  joursTravaillesParSemaine: 6,  // repos le dimanche
};

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
const fmtM = (n) => `${(Math.round(Number(n) || 0) / 1000000).toFixed(2)} M`;

const monthKeyOf = (iso) => iso.slice(0, 7);
const addMonthsToKey = (key, n) => {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};
const fmtMonthLabel = (key) => {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
};
const fmtMonthLong = (key) => {
  const [y, m] = key.split("-");
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
};
const fmtDateLong = (iso) => {
  const [y, m, d] = iso.split("-");
  return `${Number(d)} ${MONTHS_LONG[Number(m) - 1]} ${y}`;
};

/* ----------------------------------------------------------------------- */

function Section({ titre, sous, icone: Icone, couleur, children, className = "" }) {
  return (
    <section className={`surface-card rounded-2xl p-5 sm:p-6 ${className}`}>
      <div className="flex items-start gap-2.5 mb-1">
        {Icone && (
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: `color-mix(in srgb, ${couleur || COLORS.fleet} 16%, transparent)` }}
          >
            <Icone size={15} color={couleur || COLORS.fleet} strokeWidth={2.25} />
          </div>
        )}
        <div className="min-w-0">
          <h2 className="font-display text-base font-bold tracking-tight" style={{ color: COLORS.ink }}>
            {titre}
          </h2>
          {sous && <p className="text-xs text-[var(--text-slate)] mt-1 leading-relaxed max-w-3xl">{sous}</p>}
        </div>
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function StatCard({ icon: Icon, label, value, caption, accent, fort }) {
  return (
    <div
      className="rounded-2xl p-4 flex flex-col gap-3 min-w-0"
      style={
        fort
          ? { backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)`, border: `1px solid color-mix(in srgb, ${accent} 35%, transparent)` }
          : { backgroundColor: "var(--bg-page)" }
      }
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 18%, transparent)` }}
      >
        <Icon size={16} color={accent} strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <div className="font-figures text-lg sm:text-xl font-bold leading-tight break-words" style={{ color: COLORS.ink }}>
          {value}
        </div>
        <div className="text-xs text-[var(--text-slate)] mt-0.5 leading-snug">{label}</div>
        {caption && <div className="text-[10px] text-[var(--text-slate-light)] mt-1 leading-snug">{caption}</div>}
      </div>
    </div>
  );
}

// Une ligne du compte de résultat
function Ligne({ libelle, detail, montant, signe, total, accent }) {
  return (
    <div
      className={`flex items-start justify-between gap-3 py-2.5 ${total ? "border-t-2 mt-1" : "border-t"}`}
      style={{ borderColor: total ? COLORS.line : "color-mix(in srgb, var(--border-line) 60%, transparent)" }}
    >
      <div className="min-w-0">
        <div className={`text-sm ${total ? "font-semibold" : ""}`} style={{ color: total ? COLORS.ink : COLORS.slate }}>
          {libelle}
        </div>
        {detail && <div className="text-[11px] text-[var(--text-slate-light)] mt-0.5 leading-snug">{detail}</div>}
      </div>
      <div
        className={`font-figures text-sm whitespace-nowrap ${total ? "font-bold text-base" : "font-medium"}`}
        style={{ color: accent || (signe === "-" ? COLORS.red : total ? COLORS.ink : COLORS.ink) }}
      >
        {signe && montant !== 0 ? `${signe} ` : ""}{fmt(Math.abs(montant))} F
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg shadow-md px-3 py-2 text-xs font-figures">
      <div className="text-[var(--text-slate)] mb-1 font-sans">{label}</div>
      {payload.filter((p) => p.value != null).map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--text-slate)] font-sans">{p.name}</span>
          <span className="ml-auto font-semibold" style={{ color: COLORS.ink }}>{fmt(p.value)} F</span>
        </div>
      ))}
    </div>
  );
}

function ParamField({ label, value, onChange, step = 1000, suffix, aide }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-medium text-[var(--text-slate)] leading-snug">{label}</span>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          step={step}
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value) || 0))}
          className="w-full text-sm font-figures bg-[var(--bg-page)] border border-[var(--border-line)] rounded-lg px-2.5 py-1.5 min-w-0"
        />
        <span className="text-[11px] text-[var(--text-slate-light)] shrink-0 whitespace-nowrap">{suffix}</span>
      </div>
      {aide && <span className="text-[10px] text-[var(--text-slate-light)] leading-snug">{aide}</span>}
    </label>
  );
}

/* ----------------------------------------------------------------------- */

export default function InvestisseurClient({
  vehicle, entries, prixAchat, prixReference, aujourdhui, flotte,
}) {
  const [chauffeurParJour, setChauffeurParJour] = useState(DEFAUTS.chauffeurParJour);
  const [assuranceMensuelle, setAssuranceMensuelle] = useState(DEFAUTS.assuranceMensuelle);
  const [coutEntretien, setCoutEntretien] = useState(DEFAUTS.coutEntretien);
  const [entretienTousLesMois, setEntretienTousLesMois] = useState(DEFAUTS.entretienTousLesMois);
  const [tauxGestion, setTauxGestion] = useState(DEFAUTS.tauxGestion);
  const [provisionMensuelle, setProvisionMensuelle] = useState(DEFAUTS.provisionMensuelle);
  const [prixSimule, setPrixSimule] = useState(prixReference);

  /* ---- Données brutes observées ---- */
  const base = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const premiereDate = sorted[0].date;
    const derniereSaisie = sorted[sorted.length - 1].date;
    const finPeriode = aujourdhui > derniereSaisie ? aujourdhui : derniereSaisie;

    const joursObserves =
      Math.round((new Date(finPeriode + "T00:00:00") - new Date(premiereDate + "T00:00:00")) / 86400000) + 1;
    const moisObserves = joursObserves / JOURS_PAR_MOIS;

    const recetteBrute = sorted.reduce((s, e) => s + (Number(e.recette) || 0), 0);
    const depensesQuotidiennes = sorted.reduce(
      (s, e) => s + (Number(e.gazoil) || 0) + (Number(e.autres) || 0), 0
    );
    const netRemonte = sorted.reduce((s, e) => s + (Number(e.net) || 0), 0);
    const joursTravailles = sorted.filter((e) => Number(e.recette) > 0).length;

    const parMois = new Map();
    for (const e of sorted) {
      const key = monthKeyOf(e.date);
      if (!parMois.has(key)) parMois.set(key, { net: 0, recette: 0, depenses: 0, joursTravailles: 0 });
      const b = parMois.get(key);
      b.net += Number(e.net) || 0;
      b.recette += Number(e.recette) || 0;
      b.depenses += (Number(e.gazoil) || 0) + (Number(e.autres) || 0);
      if (Number(e.recette) > 0) b.joursTravailles += 1;
    }
    const mois = [...parMois.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    const saisiesFutures = sorted.filter((e) => e.date > aujourdhui);

    return {
      sorted, premiereDate, derniereSaisie, finPeriode, joursObserves, moisObserves,
      recetteBrute, depensesQuotidiennes, netRemonte, joursTravailles, mois, saisiesFutures,
      montantFutur: saisiesFutures.reduce((s, e) => s + (Number(e.net) || 0), 0),
    };
  }, [entries, aujourdhui]);

  /* ---- Compte de résultat sur la période observée ---- */
  const compte = useMemo(() => {
    const chauffeur = base.joursTravailles * chauffeurParJour;
    const assurance = assuranceMensuelle * base.moisObserves;
    const entretienMensuel = entretienTousLesMois > 0 ? coutEntretien / entretienTousLesMois : 0;
    const entretien = entretienMensuel * base.moisObserves;

    const resultatAvantGestion = base.netRemonte - chauffeur - assurance - entretien;

    // Pas de commission sur une perte : FMB ne se rémunère que sur un résultat positif
    const fraisGestion = resultatAvantGestion > 0 ? (resultatAvantGestion * tauxGestion) / 100 : 0;
    const revenuNet = resultatAvantGestion - fraisGestion;

    const revenuMensuel = base.moisObserves > 0 ? revenuNet / base.moisObserves : 0;
    const revenuParJourTravaille = base.joursTravailles > 0 ? revenuNet / base.joursTravailles : 0;

    return {
      chauffeur, assurance, entretien, entretienMensuel,
      resultatAvantGestion, fraisGestion, revenuNet,
      revenuMensuel, revenuParJourTravaille,
      chargesTotales: chauffeur + assurance + entretien,
      provisionConstituee: provisionMensuelle * base.moisObserves,
    };
  }, [base, chauffeurParJour, assuranceMensuelle, coutEntretien, entretienTousLesMois, tauxGestion, provisionMensuelle]);

  /* ---- Indicateurs d'investissement ---- */
  const invest = useMemo(() => {
    const pctRembourse = prixAchat > 0 ? (compte.revenuNet / prixAchat) * 100 : 0;
    const rendementAnnuel = prixAchat > 0 ? ((compte.revenuMensuel * 12) / prixAchat) * 100 : 0;
    const moisRentabilite = compte.revenuMensuel > 0 ? prixAchat / compte.revenuMensuel : null;
    const moisRestants = compte.revenuMensuel > 0
      ? Math.max(0, (prixAchat - compte.revenuNet) / compte.revenuMensuel) : null;

    let dateRentabilite = null;
    if (moisRestants != null) {
      const d = new Date(base.finPeriode + "T00:00:00");
      d.setMonth(d.getMonth() + Math.ceil(moisRestants));
      dateRentabilite = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
    // Le rendement presente a l'investisseur porte sur le ticket d'entree
    // actuel, pas sur le prix historique du vehicule de reference : ce sont
    // deux montants differents, les confondre fausserait la lecture.
    const rendementReference = prixReference > 0 ? ((compte.revenuMensuel * 12) / prixReference) * 100 : 0;
    const moisRentabiliteReference = compte.revenuMensuel > 0 ? prixReference / compte.revenuMensuel : null;

    return {
      pctRembourse, rendementAnnuel, moisRentabilite, moisRestants, dateRentabilite,
      rendementReference, moisRentabiliteReference,
    };
  }, [compte, prixAchat, prixReference, base.finPeriode]);

  /* ---- Simulation pour un nouvel investisseur ---- */
  const simulation = useMemo(() => {
    const mensuel = compte.revenuMensuel;
    const defs = [
      { id: "prudent", label: "Prudent", coef: 0.75, desc: "activité réduite de 25 %", color: COLORS.amber },
      { id: "constate", label: "Constaté", coef: 1, desc: "rythme observé", color: COLORS.fleet },
      { id: "favorable", label: "Favorable", coef: 1.25, desc: "activité accrue de 25 %", color: COLORS.green },
    ];
    return defs.map((d) => {
      const m = mensuel * d.coef;
      return {
        ...d,
        mensuel: m,
        annuel: m * 12,
        mois: m > 0 ? prixSimule / m : null,
        rendement: prixSimule > 0 ? ((m * 12) / prixSimule) * 100 : 0,
      };
    });
  }, [compte.revenuMensuel, prixSimule]);

  /* ---- Courbe de remboursement du capital ---- */
  const courbe = useMemo(() => {
    const chargesMensuelles = assuranceMensuelle + compte.entretienMensuel;

    let cumul = 0;
    const points = base.mois.map(([key, b]) => {
      const brut = b.net - b.joursTravailles * chauffeurParJour - chargesMensuelles;
      const net = brut > 0 ? brut * (1 - tauxGestion / 100) : brut;
      cumul += net;
      return { label: fmtMonthLabel(key), reel: Math.round(cumul), projection: null };
    });

    if (compte.revenuMensuel > 0 && points.length) {
      points[points.length - 1].projection = points[points.length - 1].reel;
      let key = base.mois[base.mois.length - 1][0];
      let valeur = cumul;
      let i = 0;
      while (valeur < prixAchat && i < 180) {
        key = addMonthsToKey(key, 1);
        valeur += compte.revenuMensuel;
        points.push({ label: fmtMonthLabel(key), reel: null, projection: Math.round(valeur) });
        i++;
      }
      for (let j = 0; j < 2; j++) {
        key = addMonthsToKey(key, 1);
        valeur += compte.revenuMensuel;
        points.push({ label: fmtMonthLabel(key), reel: null, projection: Math.round(valeur) });
      }
    }
    return points;
  }, [base, compte, chauffeurParJour, assuranceMensuelle, tauxGestion, prixAchat]);

  /* ---- Détail mensuel ---- */
  const moisDetail = useMemo(() => {
    const chargesFixes = assuranceMensuelle + compte.entretienMensuel;
    return base.mois.map(([key, b]) => {
      const chauffeur = b.joursTravailles * chauffeurParJour;
      const brut = b.net - chauffeur - chargesFixes;
      const net = brut > 0 ? brut * (1 - tauxGestion / 100) : brut;
      return {
        key,
        label: fmtMonthLabel(key),
        labelLong: fmtMonthLong(key),
        joursTravailles: b.joursTravailles,
        recette: b.recette,
        depenses: b.depenses,
        netRemonte: b.net,
        chauffeur,
        chargesFixes,
        netInvestisseur: Math.round(net),
      };
    });
  }, [base.mois, chauffeurParJour, assuranceMensuelle, compte.entretienMensuel, tauxGestion]);

  const moisChart = useMemo(
    () => moisDetail.map((m) => ({
      label: m.label,
      Recette: Math.round(m.recette),
      "Charges totales": Math.round(m.depenses + m.chauffeur + m.chargesFixes),
      "Net investisseur": m.netInvestisseur,
    })),
    [moisDetail]
  );

  /* ---- Exports ---- */
  const dossierPourPDF = () => ({
    periodeDebut: base.premiereDate,
    periodeFin: base.finPeriode,
    derniereSaisie: base.derniereSaisie,
    joursObserves: base.joursObserves,
    moisObserves: base.moisObserves,
    joursTravailles: base.joursTravailles,
    recetteBrute: base.recetteBrute,
    depensesQuotidiennes: base.depensesQuotidiennes,
    netRemonte: base.netRemonte,
    chauffeur: compte.chauffeur,
    chauffeurParJour,
    assurance: compte.assurance,
    assuranceMensuelle,
    entretien: compte.entretien,
    coutEntretien,
    entretienTousLesMois,
    resultatAvantGestion: compte.resultatAvantGestion,
    tauxGestion,
    fraisGestion: compte.fraisGestion,
    revenuNet: compte.revenuNet,
    revenuMensuel: compte.revenuMensuel,
    prixAchat,
    prixReference: prixSimule,
    rendementAnnuel: invest.rendementAnnuel,
    moisRentabilite: invest.moisRentabilite,
    rendementReference: prixSimule > 0 ? ((compte.revenuMensuel * 12) / prixSimule) * 100 : 0,
    moisRentabiliteReference: compte.revenuMensuel > 0 ? prixSimule / compte.revenuMensuel : null,
    pctRembourse: invest.pctRembourse,
    scenarios: simulation,
    mois: moisDetail,
  });

  const exportDossierPDF = () => {
    generateDossierInvestisseurPDF(vehicle, dossierPourPDF()).save(
      `dossier_investisseur_${vehicle.immatriculation}_${base.finPeriode}.pdf`
    );
  };

  const exportVersementsPDF = () => {
    generateVersementsPDF(vehicle, base.sorted, base.premiereDate, base.derniereSaisie).save(
      `releve_versements_${vehicle.immatriculation}.pdf`
    );
  };

  const exportCSV = () => {
    const entete = ["Date", "Receveur", "Recette", "Depenses du jour", "Note", "Net remonte"];
    const lignes = base.sorted.map((e) => [
      e.date, e.receveur || "",
      Math.round(Number(e.recette) || 0),
      Math.round((Number(e.gazoil) || 0) + (Number(e.autres) || 0)),
      `${e.gazoil_note || ""} ${e.autres_note || ""}`.trim().replace(/[;\n\r]/g, " "),
      Math.round(Number(e.net) || 0),
    ]);
    const csv = "﻿" + [entete, ...lignes].map((l) => l.join(";")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `donnees_${vehicle.immatriculation}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pctBar = Math.max(0, Math.min(100, invest.pctRembourse));
  const autresVehicules = (flotte || []).filter((v) => v.id !== vehicle.id);

  return (
    <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto animate-fade-up flex flex-col gap-4">

      {/* ═══ Résumé exécutif ═══ */}
      <section className="surface-card rounded-3xl p-5 sm:p-7 overflow-hidden relative">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[var(--fleet-bright)]/10 blur-2xl" />
        <div className="absolute right-20 bottom-0 h-24 w-24 rounded-full bg-[var(--amber)]/10 blur-xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-line)] bg-[var(--bg-page)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-slate)]">
            <span className="status-dot h-2 w-2 rounded-full bg-[var(--green)] text-[var(--green)]" />
            Dossier d&apos;investissement
          </div>

          <h1 className="font-display mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-ink)]">
            Location de véhicule avec chauffeur
          </h1>
          <div className="flex items-center gap-2 mt-2 text-sm text-[var(--text-slate)]">
            <Bus size={15} color={COLORS.fleet} />
            <span>{vehicle.marque}</span>
            <span className="font-figures text-[var(--text-slate-light)]">{vehicle.immatriculation}</span>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-[var(--text-slate)]">
            Un véhicule exploité en location et en VTC (Yango), géré de bout en bout par
            FMB Trans-Mobilité Services. Les chiffres ci-dessous ne sont pas des projections
            commerciales : ils proviennent des <strong>{base.sorted.length} journées
            d&apos;exploitation réellement saisies</strong> entre le {fmtDateLong(base.premiereDate)} et
            le {fmtDateLong(base.finPeriode)}, et se mettent à jour à chaque nouvelle saisie.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-6">
            <StatCard
              icon={Receipt} fort accent={COLORS.fleet}
              label="Ticket d'entrée"
              value={`${fmt(prixReference)} F`}
              caption="investissement réalisé"
            />
            <StatCard
              icon={Banknote} fort accent={COLORS.green}
              label="Revenu net mensuel"
              value={`${fmt(compte.revenuMensuel)} F`}
              caption="après toutes charges et gestion"
            />
            <StatCard
              icon={CalendarClock} fort accent={COLORS.amber}
              label="Capital remboursé en"
              value={invest.moisRentabiliteReference != null ? `${invest.moisRentabiliteReference.toFixed(0)} mois` : "—"}
              caption={invest.moisRentabiliteReference != null ? `soit ${(invest.moisRentabiliteReference / 12).toFixed(1)} an(s)` : null}
            />
            <StatCard
              icon={Percent} fort accent={COLORS.purple}
              label="Rendement annuel"
              value={`${invest.rendementReference.toFixed(1)} %`}
              caption={`sur ${fmt(prixReference)} F investis`}
            />
          </div>
        </div>
      </section>

      {/* ═══ Périmètre ═══ */}
      <Section
        titre="Périmètre de ces chiffres"
        icone={ShieldCheck}
        couleur={COLORS.fleet}
        sous="Ce que ces données couvrent exactement, et ce qu'elles ne couvrent pas encore."
      >
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="rounded-xl bg-[var(--bg-page)] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-slate)]">Véhicule de référence</div>
            <div className="text-sm font-semibold mt-1" style={{ color: COLORS.ink }}>{vehicle.marque}</div>
            <div className="text-[11px] text-[var(--text-slate-light)] mt-1 leading-relaxed">
              Investissement réel de {fmt(prixAchat)} F. C&apos;est le seul véhicule disposant
              de données d&apos;exploitation : tout ce dossier repose sur lui.
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-slate)]">Historique disponible</div>
            <div className="text-sm font-semibold mt-1" style={{ color: COLORS.ink }}>
              {base.joursObserves} jours ({base.moisObserves.toFixed(1)} mois)
            </div>
            <div className="text-[11px] text-[var(--text-slate-light)] mt-1 leading-relaxed">
              Dont {base.joursTravailles} jours effectivement travaillés. Dernière saisie le{" "}
              {fmtDateLong(base.derniereSaisie)}.
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-4">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-slate)]">À venir</div>
            <div className="text-sm font-semibold mt-1" style={{ color: COLORS.ink }}>3 véhicules supplémentaires</div>
            <div className="text-[11px] text-[var(--text-slate-light)] mt-1 leading-relaxed">
              Dont 2 Renault QM3 identiques, acquis à des conditions plus favorables. Ils
              n&apos;ont pas encore de données d&apos;exploitation : leur mise en service
              affinera les moyennes présentées ici.
            </div>
          </div>
        </div>

        <div
          className="flex items-start gap-2.5 rounded-xl px-4 py-3 mt-3 border text-xs leading-relaxed"
          style={{
            borderColor: `color-mix(in srgb, ${COLORS.amber} 35%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${COLORS.amber} 7%, transparent)`,
            color: COLORS.slate,
          }}
        >
          <Info size={15} color={COLORS.amber} className="mt-0.5 shrink-0" />
          <div>
            <strong className="text-[var(--text-ink)]">Un seul véhicule, {base.moisObserves.toFixed(1)} mois d&apos;historique.</strong>{" "}
            C&apos;est une base réelle mais courte : elle ne capture ni la saisonnalité complète,
            ni une panne majeure, ni l&apos;usure des années suivantes. Les montants ci-dessous
            décrivent fidèlement ce qui s&apos;est passé — ils ne constituent pas une garantie de
            résultat futur.
            {autresVehicules.length > 0 && (
              <> La flotte compte d&apos;autres véhicules ({autresVehicules.map((v) => v.immatriculation).join(", ")}),
              volontairement exclus de ce dossier : leur modèle d&apos;exploitation diffère et les
              mélanger fausserait la moyenne.</>
            )}
          </div>
        </div>
      </Section>

      {/* ═══ Saisies à venir ═══ */}
      {base.saisiesFutures.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5 border"
          style={{
            borderColor: `color-mix(in srgb, ${COLORS.fleet} 35%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${COLORS.fleet} 7%, transparent)`,
          }}
        >
          <CalendarRange size={17} color={COLORS.fleet} className="mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed text-[var(--text-slate)]">
            <span className="font-semibold text-[var(--text-ink)]">
              {base.saisiesFutures.length} journée(s) portent sur des dates à venir
            </span>{" "}
            ({fmt(base.montantFutur)} F). Ce ne sont pas des projections : ce sont des{" "}
            <strong>locations déjà contractées</strong>, dont le montant est fixé au contrat dès la
            signature.
          </div>
        </div>
      )}

      {/* ═══ Compte de résultat ═══ */}
      <Section
        titre="Du chiffre d'affaires au revenu de l'investisseur"
        icone={Calculator}
        couleur={COLORS.green}
        sous={`Compte de résultat complet sur les ${base.joursObserves} jours observés. Chaque ligne est soit issue des saisies quotidiennes, soit calculée à partir des paramètres d'exploitation réels.`}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div>
            <Ligne libelle="Recette brute encaissée" detail={`${base.joursTravailles} jours travaillés`} montant={base.recetteBrute} signe="+" />
            <Ligne libelle="Carburant et frais quotidiens" detail="gazoil, parking, lavage, péage…" montant={base.depensesQuotidiennes} signe="-" />
            <Ligne libelle="Net remonté par le chauffeur" montant={base.netRemonte} total />

            <div className="h-3" />

            <Ligne
              libelle="Rémunération du chauffeur"
              detail={`${fmt(chauffeurParJour)} F × ${base.joursTravailles} jours travaillés`}
              montant={compte.chauffeur} signe="-"
            />
            <Ligne
              libelle="Assurance"
              detail={`${fmt(assuranceMensuelle)} F par mois`}
              montant={compte.assurance} signe="-"
            />
            <Ligne
              libelle="Entretien"
              detail={`${fmt(coutEntretien)} F tous les ${entretienTousLesMois} mois (environ 5 000 km)`}
              montant={compte.entretien} signe="-"
            />
            <Ligne libelle="Résultat avant rémunération de gestion" montant={compte.resultatAvantGestion} total />

            <div className="h-3" />

            <Ligne
              libelle={`Rémunération de gestion FMB (${tauxGestion} %)`}
              detail={compte.fraisGestion > 0 ? "prélevée uniquement sur un résultat positif" : "non applicable : résultat négatif"}
              montant={compte.fraisGestion} signe="-"
            />
            <Ligne libelle="REVENU NET DE L'INVESTISSEUR" montant={compte.revenuNet} total accent={COLORS.green} />
          </div>

          <div className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <StatCard icon={TrendingUp} accent={COLORS.green} label="Revenu net par mois" value={`${fmt(compte.revenuMensuel)} F`} />
              <StatCard icon={CalendarDays} accent={COLORS.fleet} label="Par jour travaillé" value={`${fmt(compte.revenuParJourTravaille)} F`} />
              <StatCard icon={UserCog} accent={COLORS.amber} label="Coût chauffeur / mois" value={`${fmt(base.moisObserves > 0 ? compte.chauffeur / base.moisObserves : 0)} F`} />
              <StatCard icon={Wrench} accent={COLORS.red} label="Charges fixes / mois" value={`${fmt(assuranceMensuelle + compte.entretienMensuel)} F`} caption="assurance + entretien" />
            </div>

            <div className="rounded-2xl bg-[var(--bg-page)] p-4">
              <div className="flex items-center justify-between text-xs text-[var(--text-slate)] mb-2">
                <span>Capital remboursé à ce jour</span>
                <span className="font-figures font-bold text-sm" style={{ color: COLORS.green }}>
                  {invest.pctRembourse.toFixed(1)} %
                </span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-line)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pctBar}%`, backgroundColor: COLORS.green }} />
              </div>
              <div className="flex items-center justify-between text-[11px] text-[var(--text-slate-light)] mt-2">
                <span>{fmt(compte.revenuNet)} F perçus</span>
                <span>sur {fmt(prixAchat)} F investis</span>
              </div>
              {invest.dateRentabilite && (
                <div className="text-[11px] text-[var(--text-slate)] mt-3 pt-3 border-t" style={{ borderColor: COLORS.line }}>
                  Au rythme actuel, le capital serait intégralement remboursé vers{" "}
                  <strong className="capitalize">{fmtMonthLong(invest.dateRentabilite)}</strong>.
                </div>
              )}
            </div>
          </div>
        </div>
      </Section>

      {/* ═══ Courbe de remboursement ═══ */}
      <Section
        titre="Remboursement du capital"
        icone={Target}
        couleur={COLORS.green}
        sous={`Cumul des revenus nets réellement perçus, toutes charges déduites. La ligne pointillée prolonge le rythme constaté jusqu'au remboursement des ${fmt(prixAchat)} F investis.`}
      >
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={courbe} margin={{ top: 12, right: 8, left: -4, bottom: 0 }}>
            <defs>
              <linearGradient id="gReel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={52} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={prixAchat} stroke={COLORS.red} strokeDasharray="6 4"
              label={{ value: `Capital investi : ${fmt(prixAchat)} F`, position: "insideTopLeft", fontSize: 10, fill: COLORS.red }}
            />
            <Area type="monotone" dataKey="reel" name="Revenus nets perçus" stroke={COLORS.green} fill="url(#gReel)" strokeWidth={2.5} connectNulls={false} dot={false} />
            <Area type="monotone" dataKey="projection" name="Projection au rythme actuel" stroke={COLORS.fleet} fill="transparent" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </Section>

      {/* ═══ Détail mensuel ═══ */}
      <Section
        titre="Mois par mois"
        icone={CalendarDays}
        couleur={COLORS.amber}
        sous="Recette encaissée, total des charges et revenu net revenant à l'investisseur, pour chaque mois d'exploitation."
      >
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={moisChart} margin={{ top: 4, right: 8, left: -4, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Recette" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Charges totales" fill={COLORS.red} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Net investisseur" radius={[4, 4, 0, 0]}>
              {moisChart.map((d, i) => (
                <Cell key={i} fill={d["Net investisseur"] >= 0 ? COLORS.green : COLORS.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto mt-5 -mx-5 sm:-mx-6">
          <table className="w-full text-sm font-figures">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-page)" }}>
                {["Mois", "Jours", "Recette", "Frais quotidiens", "Chauffeur", "Charges fixes", "Net investisseur"].map((h) => (
                  <th key={h} className="text-left px-5 sm:px-6 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {moisDetail.map((m) => (
                <tr key={m.key} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="px-5 sm:px-6 py-2 font-sans capitalize whitespace-nowrap">{m.labelLong}</td>
                  <td className="px-5 sm:px-6 py-2">{m.joursTravailles}</td>
                  <td className="px-5 sm:px-6 py-2">{fmt(m.recette)}</td>
                  <td className="px-5 sm:px-6 py-2" style={{ color: COLORS.red }}>{fmt(m.depenses)}</td>
                  <td className="px-5 sm:px-6 py-2" style={{ color: COLORS.red }}>{fmt(m.chauffeur)}</td>
                  <td className="px-5 sm:px-6 py-2" style={{ color: COLORS.red }}>{fmt(m.chargesFixes)}</td>
                  <td className="px-5 sm:px-6 py-2 font-bold" style={{ color: m.netInvestisseur >= 0 ? COLORS.green : COLORS.red }}>
                    {fmt(m.netInvestisseur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* ═══ Simulateur ═══ */}
      <Section
        titre="Simuler votre investissement"
        icone={SlidersHorizontal}
        couleur={COLORS.purple}
        sous="Ajustez le prix d'acquisition et les paramètres d'exploitation : tous les chiffres de cette page se recalculent instantanément."
      >
        <div className="rounded-2xl bg-[var(--bg-page)] p-4 mb-4">
          <label className="flex flex-col gap-1.5 max-w-xs">
            <span className="text-xs font-semibold" style={{ color: COLORS.ink }}>
              Montant que vous investissez
            </span>
            <div className="flex items-center gap-2">
              <input
                type="number" min={0} step={100000} value={prixSimule}
                onChange={(e) => setPrixSimule(Math.max(0, Number(e.target.value) || 0))}
                className="w-48 text-base font-figures font-semibold bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2"
              />
              <span className="text-sm text-[var(--text-slate)]">FCFA</span>
            </div>
            <span className="text-[11px] text-[var(--text-slate-light)]">
              Par défaut : {fmt(prixReference)} F, montant réellement investi dans le véhicule
              dont proviennent ces données.
            </span>
          </label>
        </div>

        <div className="overflow-x-auto -mx-5 sm:-mx-6">
          <table className="w-full text-sm font-figures">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-page)" }}>
                {["Hypothèse", "Revenu net / mois", "Revenu net / an", "Rendement annuel", "Capital remboursé en"].map((h) => (
                  <th key={h} className="text-left px-5 sm:px-6 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)] whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {simulation.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="px-5 sm:px-6 py-3 whitespace-nowrap">
                    <span className="text-xs font-sans font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}>
                      {s.label}
                    </span>
                    <span className="text-[11px] font-sans text-[var(--text-slate-light)] ml-2">{s.desc}</span>
                  </td>
                  <td className="px-5 sm:px-6 py-3 font-semibold">{fmt(s.mensuel)} F</td>
                  <td className="px-5 sm:px-6 py-3">{fmt(s.annuel)} F</td>
                  <td className="px-5 sm:px-6 py-3 font-bold" style={{ color: s.color }}>{s.rendement.toFixed(1)} %</td>
                  <td className="px-5 sm:px-6 py-3 whitespace-nowrap">
                    {s.mois != null ? (
                      <>
                        {s.mois.toFixed(0)} mois
                        <span className="text-[11px] font-sans text-[var(--text-slate-light)] ml-1.5">
                          ({(s.mois / 12).toFixed(1)} an)
                        </span>
                      </>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-5 pt-5 border-t" style={{ borderColor: COLORS.line }}>
          <div className="text-xs font-semibold mb-3" style={{ color: COLORS.ink }}>
            Paramètres d&apos;exploitation
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
            <ParamField label="Chauffeur" value={chauffeurParJour} onChange={setChauffeurParJour} step={500} suffix="F/jour" />
            <ParamField label="Assurance" value={assuranceMensuelle} onChange={setAssuranceMensuelle} step={1000} suffix="F/mois" />
            <ParamField label="Coût d'un entretien" value={coutEntretien} onChange={setCoutEntretien} step={5000} suffix="F" />
            <ParamField label="Entretien tous les" value={entretienTousLesMois} onChange={setEntretienTousLesMois} step={1} suffix="mois" aide="≈ 5 000 km" />
            <ParamField label="Gestion FMB" value={tauxGestion} onChange={setTauxGestion} step={1} suffix="%" />
            <ParamField label="Réserve conseillée" value={provisionMensuelle} onChange={setProvisionMensuelle} step={10000} suffix="F/mois" />
          </div>
        </div>
      </Section>

      {/* ═══ Réserve ═══ */}
      {provisionMensuelle > 0 && (
        <Section
          titre="Constituer une réserve"
          icone={PiggyBank}
          couleur={COLORS.purple}
          sous="Recommandation de gestion, et non une charge : cet argent reste votre propriété."
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[var(--bg-page)] p-4">
              <div className="text-[11px] text-[var(--text-slate)]">Mise de côté conseillée</div>
              <div className="font-figures text-lg font-bold mt-0.5" style={{ color: COLORS.ink }}>{fmt(provisionMensuelle)} F / mois</div>
            </div>
            <div className="rounded-xl bg-[var(--bg-page)] p-4">
              <div className="text-[11px] text-[var(--text-slate)]">Réserve sur la période</div>
              <div className="font-figures text-lg font-bold mt-0.5" style={{ color: COLORS.purple }}>{fmt(compte.provisionConstituee)} F</div>
            </div>
            <div className="rounded-xl bg-[var(--bg-page)] p-4">
              <div className="text-[11px] text-[var(--text-slate)]">Revenu restant disponible</div>
              <div
                className="font-figures text-lg font-bold mt-0.5"
                style={{ color: compte.revenuMensuel - provisionMensuelle >= 0 ? COLORS.green : COLORS.red }}
              >
                {fmt(compte.revenuMensuel - provisionMensuelle)} F / mois
              </div>
            </div>
          </div>
          <p className="text-[11px] text-[var(--text-slate)] mt-3 leading-relaxed">
            Cette réserve couvre les gros imprévus — boîte de vitesses, accident, immobilisation
            prolongée. Si elle n&apos;est pas consommée, elle s&apos;ajoute simplement à votre gain :
            c&apos;est pourquoi elle n&apos;est pas déduite du rendement affiché plus haut.
          </p>
        </Section>
      )}

      {/* ═══ Documents ═══ */}
      <Section
        titre="Documents et données"
        icone={FileText}
        couleur={COLORS.fleet}
        sous="Tout est vérifiable : téléchargez le dossier complet ou les données brutes pour contrôler vous-même chaque chiffre."
      >
        <div className="flex flex-wrap gap-2.5">
          <button
            onClick={exportDossierPDF}
            className="flex items-center gap-2 text-sm font-semibold px-5 py-3 rounded-xl text-white"
            style={{ backgroundColor: COLORS.fleet }}
          >
            <FileText size={16} /> Dossier d&apos;investissement (PDF)
          </button>
          <button
            onClick={exportVersementsPDF}
            className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-xl border"
            style={{ borderColor: COLORS.line, color: COLORS.ink }}
          >
            <FileText size={16} /> Relevé détaillé des versements
          </button>
          <button
            onClick={exportCSV}
            className="flex items-center gap-2 text-sm font-medium px-5 py-3 rounded-xl border"
            style={{ borderColor: COLORS.line, color: COLORS.ink }}
          >
            <FileSpreadsheet size={16} /> Données brutes (Excel)
          </button>
        </div>
        <p className="text-[11px] text-[var(--text-slate-light)] mt-3">
          Les documents PDF reprennent l&apos;en-tête officiel de FMB Trans-Mobilité Services SARL
          et sont générés à l&apos;instant, à partir des données en base.
        </p>
      </Section>

      {/* ═══ Hypothèses ═══ */}
      <Section titre="Hypothèses et limites" icone={Info} couleur={COLORS.slate}>
        <ul className="text-xs text-[var(--text-slate)] leading-relaxed flex flex-col gap-2 list-disc pl-4">
          <li>
            <strong>Période retenue :</strong> du {fmtDateLong(base.premiereDate)} à aujourd&apos;hui,
            soit {base.joursObserves} jours ({base.moisObserves.toFixed(1)} mois), dont{" "}
            {base.joursTravailles} jours travaillés. Les jours sans activité sont inclus dans la
            période, afin de ne pas gonfler les moyennes mensuelles.
          </li>
          <li>
            <strong>Rémunération du chauffeur :</strong> {fmt(chauffeurParJour)} F par jour
            effectivement travaillé. Elle n&apos;est pas prélevée sur la recette quotidienne mais
            déduite ici, comme une charge de l&apos;investisseur.
          </li>
          <li>
            <strong>Entretien :</strong> {fmt(coutEntretien)} F tous les {entretienTousLesMois} mois,
            correspondant à une révision tous les 5 000 km environ, lissé mensuellement.
          </li>
          <li>
            <strong>Rémunération de FMB :</strong> {tauxGestion} % du résultat après charges, et
            uniquement si ce résultat est positif. Aucune commission n&apos;est prélevée sur un mois
            déficitaire.
          </li>
          <li>
            <strong>Ne sont pas pris en compte :</strong> la valeur de revente du véhicule, sa
            dépréciation comptable, l&apos;inflation, ni la fiscalité applicable à l&apos;investisseur.
          </li>
          <li>
            <strong>Portée statistique :</strong> ces chiffres proviennent d&apos;un seul véhicule
            observé sur {base.moisObserves.toFixed(1)} mois. Les performances passées ne préjugent pas
            des performances futures. Ce document est informatif et ne constitue pas une offre
            d&apos;investissement au sens réglementaire.
          </li>
        </ul>
      </Section>

      <div className="text-xs text-[var(--text-slate-light)] mt-2 pb-10 leading-relaxed">
        FMB Trans-Mobilité Services SARL · Données d&apos;exploitation arrêtées au{" "}
        {fmtDateLong(base.derniereSaisie)} · Document généré le {fmtDateLong(aujourdhui)}.
      </div>
    </main>
  );
}
