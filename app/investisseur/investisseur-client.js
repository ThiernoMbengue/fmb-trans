"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Banknote, TrendingUp, CalendarClock, Percent, Wallet, Info, Bus,
  PiggyBank, FileSpreadsheet, FileText, SlidersHorizontal, CalendarRange, Calculator,
} from "lucide-react";
import { generateVersementsPDF } from "@/lib/pdf/report";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS_PER_MONTH = 30.44;

// Valeurs par défaut communiquées par l'exploitant
const DEFAUTS = {
  assuranceMensuelle: 7000,
  coutEntretien: 70000,
  kmParEntretien: 5000,
  kmParMois: 3000,
  provisionMensuelle: 50000,
  prixEstimation: 5000000,
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

function StatCard({ icon: Icon, label, value, caption, accent }) {
  return (
    <div className="surface-card pro-card rounded-2xl p-4 flex flex-col gap-3 min-w-0">
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
        style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)` }}
      >
        <Icon size={16} color={accent} strokeWidth={2.25} />
      </div>
      <div className="min-w-0">
        <div className="font-figures text-lg sm:text-xl font-semibold leading-tight break-words" style={{ color: COLORS.ink }}>
          {value}
        </div>
        <div className="text-xs text-[var(--text-slate)] mt-0.5 leading-snug">{label}</div>
        {caption && <div className="text-[10px] text-[var(--text-slate-light)] mt-1 leading-snug">{caption}</div>}
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

function ParamField({ label, value, onChange, step = 1000, suffix }) {
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
        <span className="text-[11px] text-[var(--text-slate-light)] shrink-0">{suffix}</span>
      </div>
    </label>
  );
}

export default function InvestisseurClient({ vehicle, entries, depensesImprevues, prixAchat, aujourdhui, flotte }) {
  const [assuranceMensuelle, setAssuranceMensuelle] = useState(DEFAUTS.assuranceMensuelle);
  const [coutEntretien, setCoutEntretien] = useState(DEFAUTS.coutEntretien);
  const [kmParEntretien, setKmParEntretien] = useState(DEFAUTS.kmParEntretien);
  const [kmParMois, setKmParMois] = useState(DEFAUTS.kmParMois);
  const [provisionMensuelle, setProvisionMensuelle] = useState(DEFAUTS.provisionMensuelle);
  const [prixEstimation, setPrixEstimation] = useState(DEFAUTS.prixEstimation);

  const base = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const premiereDate = sorted[0].date;
    const derniereSaisie = sorted[sorted.length - 1].date;
    // La période court du premier jour saisi jusqu'à aujourd'hui : les jours sans
    // saisie comptent aussi, sinon les moyennes seraient artificiellement gonflées.
    const finPeriode = aujourdhui > derniereSaisie ? aujourdhui : derniereSaisie;

    const joursObserves =
      Math.round(
        (new Date(finPeriode + "T00:00:00") - new Date(premiereDate + "T00:00:00")) / 86400000
      ) + 1;
    const moisObserves = joursObserves / DAYS_PER_MONTH;

    const recetteBrute = sorted.reduce((s, e) => s + (Number(e.recette) || 0), 0);
    const depensesExploitation = sorted.reduce(
      (s, e) => s + (Number(e.gazoil) || 0) + (Number(e.autres) || 0),
      0
    );
    const netVerse = sorted.reduce((s, e) => s + (Number(e.net) || 0), 0);
    const joursActifs = sorted.filter((e) => Number(e.recette) > 0).length;

    const parMois = new Map();
    for (const e of sorted) {
      const key = monthKeyOf(e.date);
      if (!parMois.has(key)) parMois.set(key, { net: 0, recette: 0, depenses: 0, joursTravailles: 0, joursSaisis: 0 });
      const b = parMois.get(key);
      b.net += Number(e.net) || 0;
      b.recette += Number(e.recette) || 0;
      b.depenses += (Number(e.gazoil) || 0) + (Number(e.autres) || 0);
      b.joursSaisis += 1;
      if (Number(e.recette) > 0) b.joursTravailles += 1;
    }
    const mois = [...parMois.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // Saisies portant sur des dates à venir : locations réservées et convenues à l'avance
    const saisiesFutures = sorted.filter((e) => e.date > aujourdhui);
    const montantFutur = saisiesFutures.reduce((s, e) => s + (Number(e.net) || 0), 0);

    return {
      sorted, premiereDate, derniereSaisie, finPeriode, joursObserves, moisObserves,
      recetteBrute, depensesExploitation, netVerse, joursActifs, mois,
      saisiesFutures, montantFutur,
    };
  }, [entries, aujourdhui]);

  const charges = useMemo(() => {
    const entretiensParMois = kmParEntretien > 0 ? kmParMois / kmParEntretien : 0;
    const entretienMensuel = entretiensParMois * coutEntretien;
    const chargesMensuelles = assuranceMensuelle + entretienMensuel;
    return {
      entretiensParMois,
      entretienMensuel,
      chargesMensuelles,
      chargesAnnuelles: chargesMensuelles * 12,
    };
  }, [assuranceMensuelle, coutEntretien, kmParEntretien, kmParMois]);

  const calc = useMemo(() => {
    const chargesSurPeriode = charges.chargesMensuelles * base.moisObserves;
    const netApresCharges = base.netVerse - depensesImprevues - chargesSurPeriode;
    const netMensuelMoyen = base.moisObserves > 0 ? netApresCharges / base.moisObserves : 0;
    const netJournalierMoyen = base.joursObserves > 0 ? netApresCharges / base.joursObserves : 0;

    const provisionConstituee = provisionMensuelle * base.moisObserves;
    const netDistribuableMensuel = netMensuelMoyen - provisionMensuelle;

    const pctRembourse = prixAchat > 0 ? (netApresCharges / prixAchat) * 100 : 0;
    const rendementAnnuel = prixAchat > 0 ? ((netMensuelMoyen * 12) / prixAchat) * 100 : 0;
    const moisRentabilite = netMensuelMoyen > 0 ? prixAchat / netMensuelMoyen : null;
    const moisRestants = netMensuelMoyen > 0 ? Math.max(0, (prixAchat - netApresCharges) / netMensuelMoyen) : null;

    let dateRentabilite = null;
    if (moisRestants != null) {
      const d = new Date(base.finPeriode + "T00:00:00");
      d.setMonth(d.getMonth() + Math.ceil(moisRestants));
      dateRentabilite = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    return {
      chargesSurPeriode, netApresCharges, netMensuelMoyen, netJournalierMoyen,
      provisionConstituee, netDistribuableMensuel,
      pctRembourse, rendementAnnuel, moisRentabilite, moisRestants, dateRentabilite,
    };
  }, [base, charges, depensesImprevues, prixAchat, provisionMensuelle]);

  // Courbe : cumul réel observé, puis projection au rythme moyen jusqu'au remboursement
  const courbe = useMemo(() => {
    const depensesParMois = base.mois.length > 0 ? depensesImprevues / base.mois.length : 0;

    let cumul = 0;
    const points = base.mois.map(([key, b]) => {
      cumul += b.net - depensesParMois - charges.chargesMensuelles;
      return { label: fmtMonthLabel(key), reel: Math.round(cumul), projection: null };
    });

    if (calc.netMensuelMoyen > 0 && points.length > 0) {
      // Le dernier point réel amorce la projection pour que les deux courbes se rejoignent
      points[points.length - 1].projection = points[points.length - 1].reel;

      let key = base.mois[base.mois.length - 1][0];
      let valeur = cumul;
      let i = 0;
      while (valeur < prixAchat && i < 180) {
        key = addMonthsToKey(key, 1);
        valeur += calc.netMensuelMoyen;
        points.push({ label: fmtMonthLabel(key), reel: null, projection: Math.round(valeur) });
        i++;
      }
      // Deux mois de marge après le point d'équilibre, pour bien voir le croisement
      for (let j = 0; j < 2; j++) {
        key = addMonthsToKey(key, 1);
        valeur += calc.netMensuelMoyen;
        points.push({ label: fmtMonthLabel(key), reel: null, projection: Math.round(valeur) });
      }
    }

    return points;
  }, [base, calc, charges, depensesImprevues, prixAchat]);

  const moisChart = useMemo(
    () =>
      base.mois.map(([key, b]) => ({
        label: fmtMonthLabel(key),
        Recette: Math.round(b.recette),
        Dépenses: Math.round(b.depenses),
        "Net investisseur": Math.round(b.net),
      })),
    [base]
  );

  // Estimation d'un nouvel investissement, basée sur l'ensemble des véhicules de la plateforme
  const estimation = useMemo(() => {
    const parVehicule = (flotte || []).map((v) => {
      const mois = v.jours / DAYS_PER_MONTH;
      return { ...v, mois, netMensuel: mois > 0 ? v.net / mois : 0 };
    });

    const nbVehicules = parVehicule.length;
    const netMensuelBrut =
      nbVehicules > 0 ? parVehicule.reduce((s, v) => s + v.netMensuel, 0) / nbVehicules : 0;
    const netMensuelMoyen = netMensuelBrut - charges.chargesMensuelles;

    const moisRentabilite = netMensuelMoyen > 0 ? prixEstimation / netMensuelMoyen : null;
    const rendementAnnuel = prixEstimation > 0 ? ((netMensuelMoyen * 12) / prixEstimation) * 100 : 0;

    return {
      parVehicule,
      nbVehicules,
      netMensuelBrut,
      netMensuelMoyen,
      moisRentabilite,
      rendementAnnuel,
      joursCumules: parVehicule.reduce((s, v) => s + v.jours, 0),
      saisiesCumulees: parVehicule.reduce((s, v) => s + v.nbSaisies, 0),
    };
  }, [flotte, charges, prixEstimation]);

  const scenarios = useMemo(() => {
    const defs = [
      { id: "prudent", label: "Prudent", coef: 0.75, desc: "−25 % vs observé", color: COLORS.amber },
      { id: "reel", label: "Observé", coef: 1, desc: "rythme actuel", color: COLORS.fleet },
      { id: "optimiste", label: "Optimiste", coef: 1.25, desc: "+25 % vs observé", color: COLORS.green },
    ];
    return defs.map((d) => {
      const mensuel = calc.netMensuelMoyen * d.coef;
      const mois = mensuel > 0 ? prixAchat / mensuel : null;
      return {
        ...d,
        mensuel,
        annuel: mensuel * 12,
        mois,
        rendement: prixAchat > 0 ? ((mensuel * 12) / prixAchat) * 100 : 0,
      };
    });
  }, [calc, prixAchat]);

  const exportCSV = () => {
    const entete = [
      "Date", "Receveur", "Recette", "Gazoil", "Note gazoil",
      "Autres dépenses", "Note autres", "Total caisse", "Net versé",
    ];
    const lignes = base.sorted.map((e) => [
      e.date,
      e.receveur || "",
      Math.round(Number(e.recette) || 0),
      Math.round(Number(e.gazoil) || 0),
      (e.gazoil_note || "").replace(/[;\n\r]/g, " "),
      Math.round(Number(e.autres) || 0),
      (e.autres_note || "").replace(/[;\n\r]/g, " "),
      Math.round(Number(e.total_caisse) || 0),
      Math.round(Number(e.net) || 0),
    ]);
    // Séparateur ";" et BOM UTF-8 : Excel en français ouvre le fichier correctement
    const csv = "﻿" + [entete, ...lignes].map((l) => l.join(";")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `donnees_${vehicle.immatriculation}_${base.premiereDate}_${base.derniereSaisie}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    generateVersementsPDF(vehicle, base.sorted, base.premiereDate, base.derniereSaisie).save(
      `rapport_${vehicle.immatriculation}_${base.premiereDate}_${base.derniereSaisie}.pdf`
    );
  };

  const pctBar = Math.max(0, Math.min(100, calc.pctRembourse));
  const tauxActivite = base.joursObserves > 0 ? (base.joursActifs / base.joursObserves) * 100 : 0;

  return (
    <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto animate-fade-up">
      {/* En-tête */}
      <section className="surface-card rounded-3xl p-5 sm:p-7 mb-5 overflow-hidden relative">
        <div className="absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[var(--fleet-bright)]/10 blur-2xl" />
        <div className="absolute right-20 bottom-0 h-24 w-24 rounded-full bg-[var(--amber)]/10 blur-xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="min-w-0">
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-line)] bg-[var(--bg-page)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-slate)]">
              <span className="status-dot h-2 w-2 rounded-full bg-[var(--green)] text-[var(--green)]" />
              Dossier investisseur
            </div>
            <h1 className="font-display mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-ink)]">
              {vehicle.marque}
            </h1>
            <div className="flex items-center gap-2 mt-2 text-sm text-[var(--text-slate)]">
              <Bus size={15} color={COLORS.fleet} />
              <span className="font-figures">{vehicle.immatriculation}</span>
              {vehicle.chauffeur && <span className="text-[var(--text-slate-light)]">· chauffeur {vehicle.chauffeur}</span>}
            </div>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[var(--text-slate)]">
              Performance réelle mesurée sur l&apos;exploitation quotidienne du véhicule, du{" "}
              {fmtDateLong(base.premiereDate)} au {fmtDateLong(base.finPeriode)}.
              Les chiffres se mettent à jour automatiquement à chaque nouvelle saisie.
            </p>
          </div>

          <div className="rounded-2xl bg-[var(--bg-page)] p-4 sm:min-w-[240px]">
            <div className="text-[11px] uppercase tracking-wide text-[var(--text-slate)]">Investissement de départ</div>
            <div className="font-figures text-2xl font-bold mt-1" style={{ color: COLORS.ink }}>
              {fmt(prixAchat)} F
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-[11px] text-[var(--text-slate)] mb-1.5">
                <span>Capital déjà remboursé</span>
                <span className="font-figures font-semibold" style={{ color: COLORS.green }}>
                  {calc.pctRembourse.toFixed(1)} %
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: "var(--border-line)" }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pctBar}%`, backgroundColor: COLORS.green }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Saisies portant sur des dates à venir */}
      {base.saisiesFutures.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-2xl px-4 py-3.5 mb-5 border"
          style={{
            borderColor: `color-mix(in srgb, ${COLORS.fleet} 35%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${COLORS.fleet} 7%, transparent)`,
          }}
        >
          <CalendarRange size={17} color={COLORS.fleet} className="mt-0.5 shrink-0" />
          <div className="text-xs leading-relaxed text-[var(--text-slate)]">
            <span className="font-semibold text-[var(--text-ink)]">
              Certaines saisies portent sur des dates postérieures à aujourd&apos;hui
            </span>{" "}
            — {base.saisiesFutures.length} jour(s) jusqu&apos;au {fmtDateLong(base.derniereSaisie)},
            pour un montant de {fmt(base.montantFutur)} F.
            <br />
            Il ne s&apos;agit pas d&apos;une projection : ce sont des <strong>périodes de location
            réservées et convenues à l&apos;avance</strong>, dont le montant est fixé au contrat dès
            la signature. Le revenu est donc connu avant même que la période soit écoulée.
          </div>
        </div>
      )}

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          icon={Banknote}
          label="Revenu net après charges"
          value={`${fmt(calc.netApresCharges)} F`}
          caption={`sur ${base.joursObserves} jours`}
          accent={COLORS.green}
        />
        <StatCard
          icon={TrendingUp}
          label="Revenu net mensuel moyen"
          value={`${fmt(calc.netMensuelMoyen)} F`}
          caption={`≈ ${fmt(calc.netJournalierMoyen)} F / jour`}
          accent={COLORS.fleet}
        />
        <StatCard
          icon={Percent}
          label="Rendement annuel estimé"
          value={`${calc.rendementAnnuel.toFixed(1)} %`}
          caption="du capital investi"
          accent={COLORS.purple}
        />
        <StatCard
          icon={CalendarClock}
          label="Durée de rentabilisation"
          value={calc.moisRentabilite != null ? `${calc.moisRentabilite.toFixed(1)} mois` : "—"}
          caption={calc.moisRentabilite != null ? `soit ${(calc.moisRentabilite / 12).toFixed(1)} an(s)` : "revenu net nul"}
          accent={COLORS.amber}
        />
        <StatCard
          icon={PiggyBank}
          label="Provision constituée"
          value={`${fmt(calc.provisionConstituee)} F`}
          caption={`${fmt(provisionMensuelle)} F mis de côté / mois`}
          accent={COLORS.purple}
        />
        <StatCard
          icon={Wallet}
          label="Jours travaillés"
          value={`${base.joursActifs} / ${base.joursObserves}`}
          caption={`taux d'activité ${tauxActivite.toFixed(0)} %`}
          accent={COLORS.slate}
        />
      </div>

      {/* Courbe de remboursement */}
      <div className="surface-card pro-card rounded-2xl p-5 mt-6">
        <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
          Remboursement du capital investi
        </div>
        <div className="text-xs text-[var(--text-slate-light)] mt-1 mb-3">
          Cumul des revenus nets perçus, charges déduites. La ligne pointillée prolonge la tendance
          au rythme actuel jusqu&apos;au remboursement des {fmt(prixAchat)} F.
        </div>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={courbe} margin={{ top: 12, right: 8, left: -8, bottom: 0 }}>
            <defs>
              <linearGradient id="gReel" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval="preserveStartEnd" />
            <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine
              y={prixAchat}
              stroke={COLORS.red}
              strokeDasharray="6 4"
              label={{ value: `Capital investi ${fmt(prixAchat)} F`, position: "insideTopLeft", fontSize: 10, fill: COLORS.red }}
            />
            <Area type="monotone" dataKey="reel" name="Revenus perçus (réel)" stroke={COLORS.green} fill="url(#gReel)" strokeWidth={2.5} connectNulls={false} dot={false} />
            <Area type="monotone" dataKey="projection" name="Projection au rythme actuel" stroke={COLORS.fleet} fill="transparent" strokeWidth={2} strokeDasharray="6 4" connectNulls={false} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Détail mensuel */}
      <div className="surface-card pro-card rounded-2xl p-5 mt-4">
        <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
          Détail mensuel de l&apos;exploitation
        </div>
        <div className="text-xs text-[var(--text-slate-light)] mt-1 mb-4">
          Recette encaissée, dépenses d&apos;exploitation (carburant, parking, lavage…) et revenu net revenant à l&apos;investisseur.
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={moisChart} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
            <CartesianGrid stroke={COLORS.line} vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
            <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={42} tickFormatter={(v) => `${v / 1000}k`} />
            <Tooltip content={<ChartTooltip />} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="Recette" fill={COLORS.amber} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Dépenses" fill={COLORS.red} radius={[4, 4, 0, 0]} />
            <Bar dataKey="Net investisseur" radius={[4, 4, 0, 0]}>
              {moisChart.map((d, i) => (
                <Cell key={i} fill={d["Net investisseur"] >= 0 ? COLORS.green : COLORS.red} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="overflow-x-auto mt-5 -mx-5">
          <table className="w-full text-sm font-figures">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-page)" }}>
                {["Mois", "Jours travaillés", "Recette", "Dépenses", "Net investisseur"].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {base.mois.map(([key, b]) => (
                <tr key={key} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="px-5 py-2 font-sans">{fmtMonthLong(key)}</td>
                  <td className="px-5 py-2">
                    {b.joursTravailles}
                    <span className="text-[11px] font-sans text-[var(--text-slate-light)] ml-1.5">
                      / {b.joursSaisis} jours saisis
                    </span>
                  </td>
                  <td className="px-5 py-2">{fmt(b.recette)}</td>
                  <td className="px-5 py-2">{fmt(b.depenses)}</td>
                  <td className="px-5 py-2 font-semibold" style={{ color: b.net >= 0 ? COLORS.green : COLORS.red }}>
                    {fmt(b.net)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Scénarios */}
      <div className="surface-card rounded-2xl mt-4 overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: COLORS.line }}>
          <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Scénarios de rentabilité</div>
          <div className="text-xs text-[var(--text-slate-light)] mt-1">
            Trois hypothèses d&apos;activité appliquées au revenu net mensuel constaté, charges déduites.
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm font-figures">
            <thead>
              <tr style={{ backgroundColor: "var(--bg-page)" }}>
                {["Scénario", "Net mensuel", "Net annuel", "Rendement / an", "Rentabilisé en"].map((h) => (
                  <th key={h} className="text-left px-5 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {scenarios.map((s) => (
                <tr key={s.id} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="px-5 py-3">
                    <span className="text-xs font-sans font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${s.color} 14%, transparent)`, color: s.color }}>
                      {s.label}
                    </span>
                    <span className="text-[11px] font-sans text-[var(--text-slate-light)] ml-2">{s.desc}</span>
                  </td>
                  <td className="px-5 py-3">{fmt(s.mensuel)} F</td>
                  <td className="px-5 py-3">{fmt(s.annuel)} F</td>
                  <td className="px-5 py-3 font-semibold" style={{ color: s.color }}>{s.rendement.toFixed(1)} %</td>
                  <td className="px-5 py-3">
                    {s.mois != null ? (
                      <>
                        {s.mois.toFixed(1)} mois
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
      </div>

      {/* Estimation pour un nouvel investissement */}
      {estimation.nbVehicules > 0 && (
        <div className="surface-card rounded-2xl p-5 mt-4">
          <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
            <Calculator size={15} color={COLORS.purple} /> Estimation pour un nouvel investissement
          </div>
          <div className="text-xs text-[var(--text-slate)] mt-2 mb-4 leading-relaxed max-w-3xl">
            Cette estimation n&apos;est pas basée sur un seul véhicule : elle s&apos;appuie sur{" "}
            <strong>l&apos;ensemble des {estimation.nbVehicules} véhicule(s) exploité(s) sur la
            plateforme</strong>, soit {estimation.saisiesCumulees} journées d&apos;exploitation
            réellement saisies et {estimation.joursCumules} jours de présence cumulés en flotte.
            La durée de rentabilisation est ensuite recalculée en fonction du prix d&apos;achat
            du véhicule que vous envisagez.
          </div>

          <div className="flex flex-wrap items-end gap-3 mb-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[11px] font-medium text-[var(--text-slate)]">
                Prix d&apos;achat du véhicule envisagé
              </span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min={0}
                  step={250000}
                  value={prixEstimation}
                  onChange={(e) => setPrixEstimation(Math.max(0, Number(e.target.value) || 0))}
                  className="w-44 text-sm font-figures bg-[var(--bg-page)] border border-[var(--border-line)] rounded-lg px-3 py-2"
                />
                <span className="text-[11px] text-[var(--text-slate-light)]">FCFA</span>
              </div>
            </label>
            {prixEstimation !== DEFAUTS.prixEstimation && (
              <button
                onClick={() => setPrixEstimation(DEFAUTS.prixEstimation)}
                className="text-xs text-[var(--text-slate-light)] underline underline-offset-2 pb-2.5"
              >
                Revenir à {fmt(DEFAUTS.prixEstimation)} F
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-xl bg-[var(--bg-page)] p-3.5">
              <div className="text-[11px] text-[var(--text-slate)]">Net mensuel moyen par véhicule</div>
              <div className="font-figures text-lg font-semibold mt-0.5" style={{ color: COLORS.ink }}>
                {fmt(estimation.netMensuelMoyen)} F
              </div>
              <div className="text-[10px] text-[var(--text-slate-light)] mt-1">
                {fmt(estimation.netMensuelBrut)} F avant charges
              </div>
            </div>
            <div className="rounded-xl bg-[var(--bg-page)] p-3.5">
              <div className="text-[11px] text-[var(--text-slate)]">Durée de rentabilisation estimée</div>
              <div className="font-figures text-lg font-semibold mt-0.5" style={{ color: COLORS.amber }}>
                {estimation.moisRentabilite != null ? `${estimation.moisRentabilite.toFixed(1)} mois` : "—"}
              </div>
              <div className="text-[10px] text-[var(--text-slate-light)] mt-1">
                {estimation.moisRentabilite != null
                  ? `soit ${(estimation.moisRentabilite / 12).toFixed(1)} an(s)`
                  : "revenu net insuffisant"}
              </div>
            </div>
            <div className="rounded-xl bg-[var(--bg-page)] p-3.5">
              <div className="text-[11px] text-[var(--text-slate)]">Rendement annuel estimé</div>
              <div className="font-figures text-lg font-semibold mt-0.5" style={{ color: COLORS.green }}>
                {estimation.rendementAnnuel.toFixed(1)} %
              </div>
              <div className="text-[10px] text-[var(--text-slate-light)] mt-1">
                sur {fmt(prixEstimation)} F investis
              </div>
            </div>
          </div>

          <div className="overflow-x-auto mt-5 -mx-5">
            <table className="w-full text-sm font-figures">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-page)" }}>
                  {["Véhicule", "Jours en flotte", "Jours travaillés", "Net cumulé", "Net / mois"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {estimation.parVehicule.map((v) => (
                  <tr key={v.id} className="border-t" style={{ borderColor: COLORS.line }}>
                    <td className="px-5 py-2 font-sans">
                      {v.marque}
                      <span className="text-[11px] text-[var(--text-slate-light)] ml-1.5">{v.immatriculation}</span>
                    </td>
                    <td className="px-5 py-2">{v.jours}</td>
                    <td className="px-5 py-2">{v.joursTravailles}</td>
                    <td className="px-5 py-2">{fmt(v.net)} F</td>
                    <td className="px-5 py-2 font-semibold">{fmt(v.netMensuel)} F</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {estimation.nbVehicules === 1 && (
            <div className="text-[11px] text-[var(--text-slate-light)] mt-3 leading-relaxed">
              Un seul véhicule est actuellement exploité sur la plateforme : l&apos;estimation repose
              donc entièrement sur son historique. Elle gagnera en fiabilité à mesure que d&apos;autres
              véhicules alimenteront la base.
            </div>
          )}
        </div>
      )}

      {/* Paramètres de charges */}
      <div className="surface-card rounded-2xl p-5 mt-4">
        <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
          <SlidersHorizontal size={15} color={COLORS.fleet} /> Charges et provisions
        </div>
        <div className="text-xs text-[var(--text-slate-light)] mt-1 mb-4">
          Ces montants ne figurent pas dans les saisies quotidiennes. Ajustez-les pour voir leur
          impact immédiat sur tous les chiffres ci-dessus.
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <ParamField label="Assurance" value={assuranceMensuelle} onChange={setAssuranceMensuelle} step={1000} suffix="F/mois" />
          <ParamField label="Coût d'un entretien" value={coutEntretien} onChange={setCoutEntretien} step={5000} suffix="F" />
          <ParamField label="Entretien tous les" value={kmParEntretien} onChange={setKmParEntretien} step={1000} suffix="km" />
          <ParamField label="Distance parcourue" value={kmParMois} onChange={setKmParMois} step={500} suffix="km/mois" />
          <ParamField label="Mise de côté" value={provisionMensuelle} onChange={setProvisionMensuelle} step={10000} suffix="F/mois" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <div className="text-[11px] text-[var(--text-slate)]">Entretien mensuel estimé</div>
            <div className="font-figures text-base font-semibold mt-0.5" style={{ color: COLORS.ink }}>
              {fmt(charges.entretienMensuel)} F
            </div>
            <div className="text-[10px] text-[var(--text-slate-light)] mt-1">
              {charges.entretiensParMois.toFixed(2)} entretien / mois
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <div className="text-[11px] text-[var(--text-slate)]">Charges totales</div>
            <div className="font-figures text-base font-semibold mt-0.5" style={{ color: COLORS.ink }}>
              {fmt(charges.chargesMensuelles)} F / mois
            </div>
            <div className="text-[10px] text-[var(--text-slate-light)] mt-1">
              soit {fmt(charges.chargesAnnuelles)} F / an
            </div>
          </div>
          <div className="rounded-xl bg-[var(--bg-page)] p-3">
            <div className="text-[11px] text-[var(--text-slate)]">Net distribuable</div>
            <div
              className="font-figures text-base font-semibold mt-0.5"
              style={{ color: calc.netDistribuableMensuel >= 0 ? COLORS.green : COLORS.red }}
            >
              {fmt(calc.netDistribuableMensuel)} F / mois
            </div>
            <div className="text-[10px] text-[var(--text-slate-light)] mt-1">
              après mise de côté de {fmt(provisionMensuelle)} F
            </div>
          </div>
        </div>
      </div>

      {/* Export + hypothèses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="surface-card rounded-2xl p-5">
          <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
            Télécharger les données détaillées
          </div>
          <div className="text-xs text-[var(--text-slate-light)] mb-4">
            L&apos;intégralité des saisies journalières ({base.sorted.length} jours), pour vérifier
            vous-même les chiffres présentés sur cette page.
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={exportCSV}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: COLORS.green }}
            >
              <FileSpreadsheet size={15} /> Excel (CSV)
            </button>
            <button
              onClick={exportPDF}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg text-white"
              style={{ backgroundColor: COLORS.fleet }}
            >
              <FileText size={15} /> Rapport PDF
            </button>
          </div>
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>
            <Info size={15} color={COLORS.slate} /> Hypothèses et limites
          </div>
          <ul className="text-xs text-[var(--text-slate)] leading-relaxed flex flex-col gap-1.5 list-disc pl-4">
            <li>
              Période prise en compte : du {fmtDateLong(base.premiereDate)} à aujourd&apos;hui
              ({base.joursObserves} jours, soit {base.moisObserves.toFixed(1)} mois). Dernière saisie
              enregistrée le {fmtDateLong(base.derniereSaisie)}. Les jours sans saisie comptent dans
              la période, pour ne pas gonfler les moyennes.
            </li>
            <li>
              Les projections prolongent simplement le rythme constaté. Plus la période observée est courte,
              moins l&apos;extrapolation est fiable — la saisonnalité et les pannes ne sont pas modélisées.
            </li>
            <li>
              Charges déduites : {fmt(charges.chargesMensuelles)} F/mois (assurance {fmt(assuranceMensuelle)} F
              + entretien {fmt(charges.entretienMensuel)} F estimé sur {fmt(kmParMois)} km/mois).
            </li>
            <li>
              Dépenses imprévues déjà constatées sur la période : <strong>{fmt(depensesImprevues)} F</strong>.
            </li>
            <li>
              La mise de côté de {fmt(provisionMensuelle)} F/mois constitue une réserve : elle reste
              acquise à l&apos;investisseur et sert à couvrir les réparations futures. Elle est donc
              exclue du calcul de rentabilité, mais retirée du net distribuable.
            </li>
            <li>
              L&apos;estimation d&apos;un nouvel investissement s&apos;appuie sur la moyenne de tous les
              véhicules de la plateforme ({estimation.nbVehicules} véhicule(s)), et non sur ce seul
              véhicule.
            </li>
            {base.saisiesFutures.length > 0 && (
              <li>
                {base.saisiesFutures.length} jour(s) saisi(s) portent sur des dates à venir : ce sont
                des locations déjà contractées, au montant convenu à l&apos;avance.
              </li>
            )}
            <li>
              Ne sont pris en compte ni la valeur de revente du véhicule, ni sa dépréciation, ni l&apos;inflation.
            </li>
            <li>
              Les performances passées ne garantissent pas les performances futures. Ce document est
              informatif et ne constitue pas une offre d&apos;investissement.
            </li>
          </ul>
        </div>
      </div>

      <div className="text-xs text-[var(--text-slate-light)] mt-8 pb-10">
        Données issues du suivi d&apos;exploitation FMB Trans-Mobilité Services · dernière saisie le {fmtDateLong(base.derniereSaisie)}.
      </div>
    </main>
  );
}
