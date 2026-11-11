"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, Cell, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Coins, Wallet, TrendingUp, HandCoins, CalendarCheck, Gauge,
  ArrowUpRight, ArrowDownRight, Minus, Bus, Search, MessageSquareText,
  NotebookPen, CalendarClock, ArrowRight, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { TYPE_PAR_ID, aSurveiller } from "@/lib/carnet";
import { lireTout } from "@/lib/supabase/lire-tout";
import { isoLocal, fmt, fmtF, fmtJour, fmtDateLongue } from "@/lib/format";
import { EnTete, SelecteurVehicule, Vide, Bandeau } from "@/components/ui";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

// Graduations de l'axe : 15000 -> « 15k », 1500000 -> « 1,5M ».
const fmtAxe = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${(v / 1000000).toFixed(abs % 1000000 ? 1 : 0).replace(".", ",")}M`;
  if (abs >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
};
const fmtShortDate = (isoStr) => { const [, m, d] = isoStr.split("-"); return `${d}/${m}`; };
// Date locale, pas UTC : hors du fuseau GMT (un propriétaire en Europe, par
// exemple), toISOString() ferait reculer « aujourd'hui » d'un jour.
const isoOf = (d) => isoLocal(d);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const todayDate = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

const MONTH_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const weekStartIso = (isoStr) => {
  const d = new Date(isoStr + "T00:00:00");
  const day = d.getDay();
  return isoOf(addDays(d, day === 0 ? -6 : 1 - day));
};
const monthKeyOf = (isoStr) => isoStr.slice(0, 7);
const fmtWeekLabel = (startIso) => `${fmtShortDate(startIso)}–${fmtShortDate(isoOf(addDays(new Date(startIso + "T00:00:00"), 6)))}`;
const fmtMonthLabel = (key) => { const [y, m] = key.split("-"); return `${MONTH_LABELS[Number(m) - 1]} ${y.slice(2)}`; };

const METRICS = [
  { id: "Recette", label: "Recette", color: "amber" },
  { id: "Dépenses", label: "Dépenses", color: "red" },
  { id: "Bénéfice", label: "Bénéfice", color: "green" },
];
const GRANULARITY_LABEL = { day: "jour", week: "semaine", month: "mois" };
const ALL_ID = "__all__";

const PERIODS = [
  { id: "jour", label: "Jour" },
  { id: "semaine", label: "Semaine" },
  { id: "mois", label: "Mois" },
  { id: "annee", label: "Année" },
  { id: "personnalise", label: "Personnalisé" },
];

function computeRange(periodType, customStart, customEnd) {
  const today = todayDate();
  const todayIso = isoOf(today);
  let start, end;
  if (periodType === "jour") {
    start = end = todayIso;
  } else if (periodType === "semaine") {
    const day = today.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    start = isoOf(addDays(today, diffToMonday));
    end = todayIso;
  } else if (periodType === "mois") {
    start = isoOf(new Date(today.getFullYear(), today.getMonth(), 1));
    end = todayIso;
  } else if (periodType === "annee") {
    start = isoOf(new Date(today.getFullYear(), 0, 1));
    end = todayIso;
  } else {
    start = customStart || todayIso;
    end = customEnd || todayIso;
  }
  const startDate = new Date(start + "T00:00:00");
  const endDate = new Date(end + "T00:00:00");
  const lengthDays = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const prevEnd = addDays(startDate, -1);
  const prevStart = addDays(prevEnd, -(lengthDays - 1));
  return { start, end, prevStart: isoOf(prevStart), prevEnd: isoOf(prevEnd) };
}

const PERIOD_VS_LABEL = {
  jour: "vs veille", semaine: "vs semaine précédente", mois: "vs mois précédent",
  annee: "vs année précédente", personnalise: "vs période précédente",
};

function aggregate(rows) {
  const recette = rows.reduce((s, r) => s + (Number(r.recette) || 0), 0);
  const gazoil = rows.reduce((s, r) => s + (Number(r.gazoil) || 0), 0);
  const autres = rows.reduce((s, r) => s + (Number(r.autres) || 0), 0);
  const depenses = gazoil + autres;
  const net = rows.reduce((s, r) => s + (Number(r.net) || 0), 0);
  const benefice = recette - depenses;
  const jours = rows.filter((r) => Number(r.recette) > 0).length;
  const marge = recette > 0 ? (benefice / recette) * 100 : 0;
  return { recette, gazoil, autres, depenses, net, benefice, jours, marge };
}

function trendCalc(current, previous) {
  if (!previous) {
    if (!current) return { pct: 0, dir: "flat" };
    return { pct: 100, dir: "up" };
  }
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const dir = pct > 0.5 ? "up" : pct < -0.5 ? "down" : "flat";
  return { pct, dir };
}

function TrendChip({ t, invert = false }) {
  const good = invert ? t.dir === "down" : t.dir === "up";
  const bad = invert ? t.dir === "up" : t.dir === "down";
  const color = good ? COLORS.green : bad ? COLORS.red : COLORS.slate;
  const Icon = t.dir === "up" ? ArrowUpRight : t.dir === "down" ? ArrowDownRight : Minus;
  return (
    <div
      className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-medium px-1.5 py-0.5 rounded-md whitespace-nowrap"
      style={{ color, backgroundColor: `color-mix(in srgb, ${color} 12%, transparent)` }}
    >
      <Icon size={11} />
      {t.pct > 0 && t.dir !== "flat" ? "+" : ""}{t.pct.toFixed(1).replace(".", ",")} %
    </div>
  );
}

function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="h-7 -mx-1 -mb-1">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
          <Area type="monotone" dataKey="v" stroke={color} fill={color} fillOpacity={0.16} strokeWidth={1.5} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, t, invert, caption, spark }) {
  return (
    <div className="carte pro-card flex min-w-0 flex-col gap-2.5 p-3.5 sm:gap-3 sm:p-4">
      <div className="flex items-center justify-between gap-2 min-w-0">
        <div
          className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: `color-mix(in srgb, ${accent} 16%, transparent)` }}
        >
          <Icon size={15} color={accent} strokeWidth={2.25} />
        </div>
        {t && (
          <div className="shrink-0">
            <TrendChip t={t} invert={invert} />
          </div>
        )}
      </div>
      <div className="min-w-0">
        <div className="font-figures text-[17px] font-bold leading-tight tracking-tight sm:text-xl" style={{ color: COLORS.ink }}>{value}</div>
        <div className="text-[11px] sm:text-xs text-[var(--text-slate)] mt-0.5 leading-snug">{label}</div>
        {caption && <div className="text-[10px] text-[var(--text-slate-light)] mt-1">{caption}</div>}
      </div>
      {spark && <Sparkline data={spark} color={accent} />}
    </div>
  );
}

function DetailItem({ label, value, caption, accent }) {
  return (
    <div className="rounded-xl bg-[var(--bg-page)] p-3 min-w-0">
      <div className="text-[11px] text-[var(--text-slate)] mb-1">{label}</div>
      <div className="font-figures text-base font-semibold" style={{ color: accent || COLORS.ink }}>{value}</div>
      {caption && <div className="text-[11px] text-[var(--text-slate-light)] mt-1 break-words">{caption}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface)] px-3 py-2 text-xs font-figures" style={{ boxShadow: "var(--shadow-pop)" }}>
      <div className="text-[var(--text-slate)] mb-1 font-sans">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--text-slate)] font-sans">{p.name}</span>
          <span className="ml-auto font-semibold" style={{ color: COLORS.ink }}>{fmtF(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardClient({ vehicles, role }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState("mois");
  const [customStart, setCustomStart] = useState(isoOf(addDays(todayDate(), -30)));
  const [customEnd, setCustomEnd] = useState(isoOf(todayDate()));
  const [metric, setMetric] = useState("Recette");
  const [searchDate, setSearchDate] = useState("");
  // Clé de la ligne dont la remarque est dépliée, ou null.
  const [noteOuverte, setNoteOuverte] = useState(null);
  // Lignes ouvertes du carnet de bord (gestionnaire uniquement).
  const [carnet, setCarnet] = useState([]);

  useEffect(() => {
    if (role !== "admin") return;
    // La table peut ne pas exister encore : dans ce cas le bloc reste masqué.
    supabase
      .from("carnet")
      .select("id,type,titre,montant,date_echeance,statut")
      .eq("statut", "ouvert")
      .then(({ data, error }) => setCarnet(error ? [] : data || []));
  }, [role]); // eslint-disable-line

  useEffect(() => {
    if (!vehicleId) return;
    setLoading(true);
    // Lecture paginée : au-delà de 1 000 lignes, l'API tronque sans prévenir —
    // et « toute la flotte » dépasse vite ce seuil.
    const requete = () =>
      vehicleId === ALL_ID
        ? supabase.from("entries").select("*").in("vehicle_id", vehicles.map((v) => v.id)).order("date", { ascending: true })
        : supabase.from("entries").select("*").eq("vehicle_id", vehicleId).order("date", { ascending: true });
    let annule = false;
    lireTout(requete).then(({ data }) => {
      if (annule) return;
      setEntries(data || []);
      setLoading(false);
    });
    // Si l'on change de véhicule avant la fin, la réponse en retard est ignorée.
    return () => { annule = true; };
  }, [vehicleId]); // eslint-disable-line

  const surveille = useMemo(() => aSurveiller(carnet), [carnet]);

  const isAllMode = vehicleId === ALL_ID;
  const vehicle = isAllMode ? null : vehicles.find((v) => v.id === vehicleId);
  const vehicleById = useMemo(() => Object.fromEntries(vehicles.map((v) => [v.id, v])), [vehicles]);
  const allLabel = role === "admin" ? "Toute la flotte" : "Tous mes véhicules";
  const range = useMemo(() => computeRange(periodType, customStart, customEnd), [periodType, customStart, customEnd]);

  const currentRows = useMemo(
    () => entries.filter((e) => e.date >= range.start && e.date <= range.end),
    [entries, range]
  );
  const previousRows = useMemo(
    () => entries.filter((e) => e.date >= range.prevStart && e.date <= range.prevEnd),
    [entries, range]
  );

  const cur = useMemo(() => aggregate(currentRows), [currentRows]);
  const prev = useMemo(() => aggregate(previousRows), [previousRows]);
  const vsLabel = PERIOD_VS_LABEL[periodType];

  const sparkSeries = useMemo(() => {
    const sorted = [...currentRows].sort((a, b) => a.date.localeCompare(b.date));
    const recette = [], depenses = [], benefice = [], net = [];
    for (const e of sorted) {
      const r = Number(e.recette) || 0;
      const d = (Number(e.gazoil) || 0) + (Number(e.autres) || 0);
      recette.push({ v: r });
      depenses.push({ v: d });
      benefice.push({ v: r - d });
      net.push({ v: Number(e.net) || 0 });
    }
    return { recette, depenses, benefice, net };
  }, [currentRows]);

  const rangeDays = useMemo(() => {
    const s = new Date(range.start + "T00:00:00");
    const e = new Date(range.end + "T00:00:00");
    return Math.max(1, Math.round((e - s) / 86400000) + 1);
  }, [range]);
  const granularity = rangeDays <= 31 ? "day" : rangeDays <= 93 ? "week" : "month";

  const chartData = useMemo(() => {
    const sorted = [...currentRows].sort((a, b) => a.date.localeCompare(b.date));
    if (granularity === "day") {
      return sorted.map((e) => ({
        label: fmtShortDate(e.date),
        Recette: Number(e.recette) || 0,
        Dépenses: (Number(e.gazoil) || 0) + (Number(e.autres) || 0),
        Bénéfice: (Number(e.recette) || 0) - ((Number(e.gazoil) || 0) + (Number(e.autres) || 0)),
      }));
    }
    const buckets = new Map();
    for (const e of sorted) {
      const key = granularity === "week" ? weekStartIso(e.date) : monthKeyOf(e.date);
      if (!buckets.has(key)) buckets.set(key, { recette: 0, depenses: 0 });
      const b = buckets.get(key);
      b.recette += Number(e.recette) || 0;
      b.depenses += (Number(e.gazoil) || 0) + (Number(e.autres) || 0);
    }
    return [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, b]) => ({
        label: granularity === "week" ? fmtWeekLabel(key) : fmtMonthLabel(key),
        Recette: b.recette,
        Dépenses: b.depenses,
        Bénéfice: b.recette - b.depenses,
      }));
  }, [currentRows, granularity]);

  const activeMetric = METRICS.find((m) => m.id === metric);

  const searchResults = useMemo(
    () => (searchDate ? entries.filter((e) => e.date === searchDate) : []),
    [entries, searchDate]
  );

  const recentEntries = useMemo(
    () => [...entries].sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date)).slice(0, 7),
    [entries]
  );

  if (!vehicles.length) {
    return (
      <main className="page">
        <div className="carte">
          <Vide icone={Bus} titre="Aucun véhicule pour le moment">
            {role === "admin"
              ? "Ajoutez un premier véhicule depuis l'onglet « Véhicules » pour commencer le suivi."
              : "Aucun véhicule ne vous a encore été attribué. Contactez votre gestionnaire."}
          </Vide>
        </div>
      </main>
    );
  }

  const cleLigne = (e) => `${e.vehicle_id}-${e.date}`;

  return (
    <main className="page animate-fade-up">
      <EnTete
        titre={role === "admin" ? "Tableau de bord" : "Mon tableau de bord"}
        description={
          range.start === range.end
            ? `Journée du ${fmtDateLongue(range.start)}`
            : `Du ${fmtDateLongue(range.start)} au ${fmtDateLongue(range.end)}`
        }
      />

      {/* Ce que le carnet de bord réclame : échéances proches et dettes
          ouvertes. Le reste y dort, pour ne pas en faire un cimetière. */}
      {role === "admin" && (surveille.echeances.length > 0 || surveille.aPayer > 0 || surveille.aRecevoir > 0) && (
        <section className="carte mb-5 p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: "color-mix(in srgb, var(--amber) 16%, transparent)" }}>
                <NotebookPen size={15} color={COLORS.amber} />
              </div>
              <h2 className="text-sm font-semibold text-[var(--text-ink)]">À surveiller</h2>
            </div>
            <Link href="/carnet" className="inline-flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: COLORS.fleet }}>
              Carnet de bord <ArrowRight size={13} />
            </Link>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {surveille.aRecevoir > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-page)] px-3 py-2 text-sm">
                <span className="text-[var(--text-slate)]">On nous doit</span>
                <strong className="font-figures whitespace-nowrap" style={{ color: COLORS.green }}>{fmtF(surveille.aRecevoir)}</strong>
              </div>
            )}
            {surveille.aPayer > 0 && (
              <div className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-page)] px-3 py-2 text-sm">
                <span className="text-[var(--text-slate)]">Nous devons</span>
                <strong className="font-figures whitespace-nowrap" style={{ color: COLORS.red }}>{fmtF(surveille.aPayer)}</strong>
              </div>
            )}
            {surveille.echeances.slice(0, 5).map((l) => {
              const enRetard = l.jours < 0;
              const couleur = enRetard ? COLORS.red : l.jours <= 7 ? COLORS.amber : COLORS.slate;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-page)] px-3 py-2 text-sm">
                  <span className="min-w-0 truncate text-[var(--text-ink)]">
                    {(TYPE_PAR_ID[l.type] || {}).emoji} {l.titre}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium" style={{ color: couleur }}>
                    <CalendarClock size={12} />
                    {enRetard ? `retard ${-l.jours} j` : l.jours === 0 ? "aujourd'hui" : l.jours === 1 ? "demain" : `dans ${l.jours} j`}
                  </span>
                </div>
              );
            })}
          </div>
          {surveille.echeances.length > 5 && (
            <div className="mt-2 text-[11px] text-[var(--text-slate-light)]">
              et {surveille.echeances.length - 5} autre(s) échéance(s) dans le carnet.
            </div>
          )}
        </section>
      )}

      {/* Véhicule et période */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SelecteurVehicule
          vehicles={vehicles}
          value={vehicleId}
          onChange={setVehicleId}
          extra={vehicles.length > 1 ? <option value={ALL_ID}>{allLabel}</option> : null}
        />

        <div className="defilement-fin -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface)] p-1" role="tablist" aria-label="Période">
            {PERIODS.map((p) => (
              <button
                key={p.id}
                role="tab"
                aria-selected={periodType === p.id}
                onClick={() => setPeriodType(p.id)}
                className="shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs font-semibold"
                style={{
                  backgroundColor: periodType === p.id ? "var(--amber)" : "transparent",
                  color: periodType === p.id ? "#1A1200" : "var(--text-slate)",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {periodType === "personnalise" && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input type="date" aria-label="Début de période" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} className="champ w-auto" />
          <span className="text-xs text-[var(--text-slate-light)]">au</span>
          <input type="date" aria-label="Fin de période" value={customEnd} min={customStart} onChange={(e) => setCustomEnd(e.target.value)} className="champ w-auto" />
        </div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="squelette h-[118px]" />)}
          </div>
          <div className="squelette mt-5 h-[320px]" />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
            <KpiCard icon={Coins} label="Recette totale" value={fmtF(cur.recette)} accent={COLORS.amber} t={trendCalc(cur.recette, prev.recette)} caption={vsLabel} spark={sparkSeries.recette} />
            <KpiCard icon={Wallet} label="Dépenses totales" value={fmtF(cur.depenses)} accent={COLORS.red} t={trendCalc(cur.depenses, prev.depenses)} invert caption={vsLabel} spark={sparkSeries.depenses} />
            <KpiCard icon={TrendingUp} label="Bénéfice" value={fmtF(cur.benefice)} accent={COLORS.green} t={trendCalc(cur.benefice, prev.benefice)} caption={vsLabel} spark={sparkSeries.benefice} />
            <KpiCard icon={HandCoins} label="Net versé au propriétaire" value={fmtF(cur.net)} accent={COLORS.fleet} t={trendCalc(cur.net, prev.net)} caption={vsLabel} spark={sparkSeries.net} />
            <KpiCard icon={CalendarCheck} label="Jours d'activité" value={cur.jours} accent={COLORS.purple} t={trendCalc(cur.jours, prev.jours)} caption={vsLabel} />
            <KpiCard icon={Gauge} label="Taux de marge" value={`${cur.marge.toFixed(0)} %`} accent={COLORS.green} t={trendCalc(cur.marge, prev.marge)} caption={vsLabel} />
          </div>

          <section className="carte mt-5 p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold text-[var(--text-ink)]">
                {activeMetric.label} par {GRANULARITY_LABEL[granularity]}
              </h2>
              <div className="inline-flex items-center gap-1 rounded-xl border border-[var(--border-line)] bg-[var(--bg-page)] p-1">
                {METRICS.map((m) => (
                  <button
                    key={m.id}
                    onClick={() => setMetric(m.id)}
                    aria-pressed={metric === m.id}
                    className="rounded-lg px-2.5 py-1.5 text-xs font-semibold"
                    style={{
                      backgroundColor: metric === m.id ? COLORS[m.color] : "transparent",
                      color: metric === m.id ? "#fff" : COLORS.slate,
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
            {chartData.length === 0 ? (
              <Vide icone={BarChart3} titre="Aucune saisie sur cette période">
                Choisissez une autre période, ou enregistrez un versement.
              </Vide>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.line} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval="preserveStartEnd" minTickGap={8} />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={44} tickFormatter={fmtAxe} />
                  <Tooltip content={<CustomTooltip />} cursor={{ fill: "color-mix(in srgb, var(--text-slate) 8%, transparent)" }} />
                  <Bar dataKey={metric} radius={[5, 5, 0, 0]} maxBarSize={44}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={metric === "Bénéfice" ? (d.Bénéfice >= 0 ? COLORS.green : COLORS.red) : COLORS[activeMetric.color]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </section>
        </>
      )}

      {!loading && recentEntries.length > 0 && (
        <section className="carte mt-5 overflow-hidden">
          <h2 className="border-b border-[var(--border-line)] px-4 py-3.5 text-sm font-semibold text-[var(--text-ink)] sm:px-5">
            Derniers versements saisis
          </h2>
          <div className="defilement-fin overflow-x-auto">
            <table className="tableau">
              <thead>
                <tr>
                  <th>Date</th>
                  {isAllMode && <th>Véhicule</th>}
                  <th className="hidden md:table-cell">Receveur</th>
                  <th className="num">Recette</th>
                  <th className="num hidden sm:table-cell">Gazoil</th>
                  <th className="num hidden sm:table-cell">Autres</th>
                  <th className="num">Net versé</th>
                  <th className="w-10"><span className="sr-only">Remarque</span></th>
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => {
                  const ouverte = noteOuverte === cleLigne(e);
                  const v = vehicleById[e.vehicle_id];
                  return (
                    <Fragment key={cleLigne(e)}>
                      <tr style={{ color: Number(e.recette) === 0 ? "var(--text-slate-light)" : COLORS.ink }}>
                        <td className="whitespace-nowrap" title={e.date}>{fmtJour(e.date)}</td>
                        {isAllMode && (
                          <td className="text-xs text-[var(--text-slate)]">
                            <span className="whitespace-nowrap">{v ? v.marque : "—"}</span>
                            {v && <span className="ml-1.5 hidden whitespace-nowrap text-[var(--text-slate-light)] sm:inline">{v.immatriculation}</span>}
                          </td>
                        )}
                        <td className="hidden md:table-cell">{e.receveur || "—"}</td>
                        <td className="num">{fmt(e.recette)}</td>
                        <td className="num hidden sm:table-cell">{fmt(e.gazoil)}</td>
                        <td className="num hidden sm:table-cell">{fmt(e.autres)}</td>
                        <td className="num font-semibold">{fmt(e.net)}</td>
                        <td className="!px-2 text-center">
                          {e.note && (
                            <button
                              onClick={() => setNoteOuverte(ouverte ? null : cleLigne(e))}
                              aria-expanded={ouverte}
                              aria-label="Voir la remarque de la journée"
                              title="Voir la remarque de la journée"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-[var(--bg-page)]"
                              style={{ color: ouverte ? COLORS.fleet : "var(--text-slate-light)" }}
                            >
                              <MessageSquareText size={15} />
                            </button>
                          )}
                        </td>
                      </tr>
                      {e.note && ouverte && (
                        <tr style={{ backgroundColor: "var(--bg-page)" }}>
                          <td colSpan={isAllMode ? 8 : 7}>
                            <div className="flex items-start gap-2 whitespace-pre-wrap text-xs leading-relaxed text-[var(--text-slate)]">
                              <MessageSquareText size={14} color={COLORS.fleet} className="mt-0.5 shrink-0" />
                              {e.note}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {!loading && (
        <section className="carte mt-5 p-4 sm:p-5">
          <div className="mb-3.5 flex items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}>
              <Search size={15} color={COLORS.fleet} />
            </div>
            <h2 className="text-sm font-semibold text-[var(--text-ink)]">Retrouver le versement d&apos;un jour</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="date"
              aria-label="Date du versement recherché"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="champ w-auto"
            />
            {searchDate && (
              <button onClick={() => setSearchDate("")} className="btn btn-discret btn-petit">Effacer</button>
            )}
          </div>

          {searchDate && (
            searchResults.length > 0 ? (
              <div className="mt-4 flex flex-col gap-4">
                {searchResults.map((r) => (
                  <div key={cleLigne(r)}>
                    {isAllMode && vehicleById[r.vehicle_id] && (
                      <div className="mb-2 text-xs font-semibold" style={{ color: COLORS.fleet }}>
                        {vehicleById[r.vehicle_id].marque} — {vehicleById[r.vehicle_id].immatriculation}
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                      <DetailItem label="Date" value={fmtJour(r.date, { annee: true })} />
                      <DetailItem label="Receveur" value={r.receveur || "—"} />
                      <DetailItem label="Recette" value={fmtF(r.recette)} accent={COLORS.amber} />
                      <DetailItem label="Gazoil" value={fmtF(r.gazoil)} caption={r.gazoil_note} accent={COLORS.red} />
                      <DetailItem label="Autres dépenses" value={fmtF(r.autres)} caption={r.autres_note} accent={COLORS.red} />
                      <DetailItem label="Total caisse" value={fmtF(r.total_caisse)} />
                      <DetailItem label="Net versé" value={fmtF(r.net)} accent={COLORS.green} />
                    </div>
                    {r.note && (
                      <Bandeau icone={MessageSquareText} className="mt-2.5 whitespace-pre-wrap">
                        <div className="mb-0.5 font-semibold text-[var(--text-ink)]">Remarque sur la journée</div>
                        {r.note}
                      </Bandeau>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 text-sm text-[var(--text-slate-light)]">
                {isAllMode
                  ? `Aucune saisie le ${fmtDateLongue(searchDate)}.`
                  : `Aucune saisie le ${fmtDateLongue(searchDate)} pour ${vehicle?.marque} — ${vehicle?.immatriculation}.`}
              </div>
            )
          )}
        </section>
      )}

      <p className="mt-6 text-xs text-[var(--text-slate-light)]">
        {role === "admin"
          ? "Accès gestionnaire — visibilité sur l'ensemble de la flotte."
          : "Accès propriétaire — visibilité limitée à vos véhicules."}
      </p>
    </main>
  );
}
