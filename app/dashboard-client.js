"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Coins, Wallet, TrendingUp, HandCoins, CalendarCheck, Gauge,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, Loader2, Bus,
  Sparkles, ShieldCheck, Target, Route,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
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
const fmtShortDate = (isoStr) => { const [, m, d] = isoStr.split("-"); return `${d}/${m}`; };
const isoOf = (d) => d.toISOString().slice(0, 10);
const addDays = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
const todayDate = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

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
      {t.pct > 0 && t.dir !== "flat" ? "+" : ""}{t.pct.toFixed(1)}%
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, accent, t, invert, caption }) {
  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] p-3.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 min-w-0">
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
        <div className="font-figures text-base sm:text-xl font-semibold leading-tight break-words" style={{ color: COLORS.ink }}>{value}</div>
        <div className="text-[11px] sm:text-xs text-[var(--text-slate)] mt-0.5 leading-snug">{label}</div>
        {caption && <div className="text-[10px] text-[var(--text-slate-light)] mt-1">{caption}</div>}
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg shadow-md px-3 py-2 text-xs font-figures">
      <div className="text-[var(--text-slate)] mb-1 font-sans">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--text-slate)] font-sans">{p.name}</span>
          <span className="ml-auto font-semibold" style={{ color: COLORS.ink }}>{fmt(p.value)} F</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardClient({ vehicles }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [periodType, setPeriodType] = useState("mois");
  const [customStart, setCustomStart] = useState(isoOf(addDays(todayDate(), -30)));
  const [customEnd, setCustomEnd] = useState(isoOf(todayDate()));

  useEffect(() => {
    if (!vehicleId) return;
    setLoading(true);
    supabase
      .from("entries")
      .select("*")
      .eq("vehicle_id", vehicleId)
      .order("date", { ascending: true })
      .then(({ data }) => {
        setEntries(data || []);
        setLoading(false);
      });
  }, [vehicleId]); // eslint-disable-line

  const vehicle = vehicles.find((v) => v.id === vehicleId);
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

  const chartData = useMemo(
    () =>
      [...currentRows].sort((a, b) => a.date.localeCompare(b.date)).map((e) => ({
        date: fmtShortDate(e.date),
        Recette: Number(e.recette) || 0,
        Dépenses: (Number(e.gazoil) || 0) + (Number(e.autres) || 0),
        Bénéfice: (Number(e.recette) || 0) - ((Number(e.gazoil) || 0) + (Number(e.autres) || 0)),
      })),
    [currentRows]
  );

  const recentEntries = useMemo(
    () => [...entries].sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date)).slice(0, 7),
    [entries]
  );

  const avgDailyRevenue = cur.jours > 0 ? cur.recette / cur.jours : 0;
  const expenseRate = cur.recette > 0 ? (cur.depenses / cur.recette) * 100 : 0;
  const operationalScore = Math.max(0, Math.min(100, Math.round((cur.marge * 0.7) + (cur.jours > 0 ? 25 : 0) - Math.max(0, expenseRate - 45) * 0.25)));
  const targetRevenue = Math.max(cur.recette, Math.ceil((avgDailyRevenue * Math.max(cur.jours + 4, 7)) / 1000) * 1000);
  const insightCards = [
    {
      icon: ShieldCheck,
      title: "Score pilotage",
      value: `${operationalScore}/100`,
      detail: operationalScore >= 75 ? "Exploitation saine : maintenir la cadence." : operationalScore >= 45 ? "À surveiller : réduire les dépenses variables." : "Priorité : sécuriser les recettes quotidiennes.",
      accent: COLORS.green,
    },
    {
      icon: Target,
      title: "Objectif période",
      value: `${fmt(targetRevenue)} F`,
      detail: `Basé sur ${fmt(avgDailyRevenue)} F de recette moyenne active.`,
      accent: COLORS.amber,
    },
    {
      icon: Route,
      title: "Efficacité coûts",
      value: `${expenseRate.toFixed(0)}%`,
      detail: expenseRate <= 35 ? "Très bon ratio dépenses / recettes." : expenseRate <= 55 ? "Optimisation possible du gazoil et des autres charges." : "Charges élevées : vérifier trajets, carburant et incidents.",
      accent: expenseRate <= 45 ? COLORS.fleet : COLORS.red,
    },
  ];

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-6xl mx-auto text-sm text-[var(--text-slate-light)]">
        Aucun véhicule enregistré pour le moment.
      </main>
    );
  }

  return (
    <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto">
      <section className="relative overflow-hidden rounded-3xl border border-[var(--border-line)] bg-[var(--bg-surface)] p-5 sm:p-6 mb-5 shadow-sm">
        <div className="absolute inset-0 opacity-70 pointer-events-none" style={{ background: "radial-gradient(circle at top right, color-mix(in srgb, var(--fleet-bright) 22%, transparent), transparent 34%), linear-gradient(135deg, color-mix(in srgb, var(--amber) 14%, transparent), transparent 42%)" }} />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] mb-3" style={{ color: COLORS.fleet, backgroundColor: "color-mix(in srgb, var(--fleet-bright) 12%, transparent)" }}>
              <Sparkles size={13} /> Centre de contrôle intelligent
            </div>
            <h1 className="font-display text-2xl sm:text-4xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
              Pilotez la rentabilité de chaque véhicule en temps réel.
            </h1>
            <p className="text-sm sm:text-base text-[var(--text-slate)] mt-2 leading-relaxed">
              Vue exécutive claire, indicateurs de tendance et recommandations automatiques pour agir vite sur les recettes, le gazoil et le net propriétaire.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:min-w-[360px]">
            <div className="rounded-2xl bg-white/60 dark:bg-white/5 border border-[var(--border-line)] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-slate-light)]">Véhicules</div>
              <div className="font-figures text-lg font-bold mt-1">{vehicles.length}</div>
            </div>
            <div className="rounded-2xl bg-white/60 dark:bg-white/5 border border-[var(--border-line)] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-slate-light)]">Marge</div>
              <div className="font-figures text-lg font-bold mt-1">{cur.marge.toFixed(0)}%</div>
            </div>
            <div className="rounded-2xl bg-white/60 dark:bg-white/5 border border-[var(--border-line)] p-3">
              <div className="text-[10px] uppercase tracking-wide text-[var(--text-slate-light)]">Score</div>
              <div className="font-figures text-lg font-bold mt-1">{operationalScore}</div>
            </div>
          </div>
        </div>
      </section>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-xl px-3 py-2 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 16%, transparent)" }}>
            <Bus size={15} color={COLORS.fleet} />
          </div>
          <div className="relative min-w-0">
            <select
              value={vehicleId || ""}
              onChange={(e) => setVehicleId(e.target.value)}
              className="appearance-none bg-transparent text-sm font-semibold pr-6 focus:outline-none max-w-[180px] sm:max-w-none truncate"
              style={{ color: COLORS.ink }}
            >
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
              ))}
            </select>
            <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-slate-light)]" />
          </div>
          {vehicle && <div className="text-xs text-[var(--text-slate-light)] hidden md:block border-l border-[var(--border-line)] pl-2.5 ml-0.5 shrink-0">{vehicle.chauffeur}</div>}
        </div>

        <div className="flex items-center gap-1 bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-xl p-1 overflow-x-auto max-w-full">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodType(p.id)}
              className="text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors shrink-0 whitespace-nowrap"
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

      {periodType === "personnalise" && (
        <div className="flex flex-wrap items-center gap-2 mb-4 text-sm">
          <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className="bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-2.5 py-1.5 text-xs min-w-0" />
          <span className="text-[var(--text-slate-light)] text-xs">au</span>
          <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className="bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-2.5 py-1.5 text-xs min-w-0" />
        </div>
      )}

      <div className="road-divider mb-6" style={{ color: "var(--amber)" }} />

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-slate-light)] text-sm py-10">
          <Loader2 size={16} className="animate-spin" /> Chargement des données…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-5">
            {insightCards.map((card) => {
              const Icon = card.icon;
              return (
                <div key={card.title} className="group rounded-2xl border border-[var(--border-line)] bg-[var(--bg-surface)] p-4 shadow-sm transition-transform hover:-translate-y-0.5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0" style={{ backgroundColor: `color-mix(in srgb, ${card.accent} 14%, transparent)` }}>
                      <Icon size={18} color={card.accent} strokeWidth={2.25} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-[var(--text-slate)]">{card.title}</div>
                      <div className="font-figures text-xl font-semibold mt-0.5" style={{ color: COLORS.ink }}>{card.value}</div>
                      <div className="text-[11px] text-[var(--text-slate-light)] mt-1 leading-snug">{card.detail}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
            <KpiCard icon={Coins} label="Recette totale" value={`${fmt(cur.recette)} F`} accent={COLORS.amber} t={trendCalc(cur.recette, prev.recette)} caption={vsLabel} />
            <KpiCard icon={Wallet} label="Dépenses totales" value={`${fmt(cur.depenses)} F`} accent={COLORS.red} t={trendCalc(cur.depenses, prev.depenses)} invert caption={vsLabel} />
            <KpiCard icon={TrendingUp} label="Bénéfice" value={`${fmt(cur.benefice)} F`} accent={COLORS.green} t={trendCalc(cur.benefice, prev.benefice)} caption={vsLabel} />
            <KpiCard icon={HandCoins} label="Net versé au propriétaire" value={`${fmt(cur.net)} F`} accent={COLORS.fleet} t={trendCalc(cur.net, prev.net)} caption={vsLabel} />
            <KpiCard icon={CalendarCheck} label="Jours d'activité" value={cur.jours} accent={COLORS.purple} t={trendCalc(cur.jours, prev.jours)} caption={vsLabel} />
            <KpiCard icon={Gauge} label="Taux de marge" value={`${cur.marge.toFixed(0)}%`} accent={COLORS.green} t={trendCalc(cur.marge, prev.marge)} caption={vsLabel} />
          </div>

          {chartData.length === 0 ? (
            <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] p-8 text-center text-sm text-[var(--text-slate-light)] mt-6">
              Aucune saisie sur la période sélectionnée.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] p-5">
                <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Évolution des recettes</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gRec" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.amber} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COLORS.amber} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.line} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Recette" stroke={COLORS.amber} fill="url(#gRec)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] p-5">
                <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Évolution des dépenses</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gDep" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.red} stopOpacity={0.3} />
                        <stop offset="100%" stopColor={COLORS.red} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.line} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Dépenses" stroke={COLORS.red} fill="url(#gDep)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] p-5">
                <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Recettes vs Dépenses</div>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <CartesianGrid stroke={COLORS.line} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Recette" fill={COLORS.amber} radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Dépenses" fill={COLORS.red} radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] p-5">
                <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Bénéfice net</div>
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gBen" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.35} />
                        <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke={COLORS.line} vertical={false} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v / 1000}k`} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="Bénéfice" stroke={COLORS.green} fill="url(#gBen)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </>
      )}

      {!loading && recentEntries.length > 0 && (
        <div className="bg-[var(--bg-surface)] rounded-2xl border border-[var(--border-line)] mt-6 overflow-hidden">
          <div className="px-5 py-4 text-sm font-semibold border-b" style={{ color: COLORS.ink, borderColor: COLORS.line }}>
            7 derniers versements ajoutés
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-figures">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-page)" }}>
                  {["Date", "Receveur", "Recette", "Gazoil", "Autres", "Net versé"].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentEntries.map((e) => (
                  <tr
                    key={e.date}
                    className="border-t"
                    style={{ borderColor: COLORS.line, color: Number(e.recette) === 0 ? "var(--text-slate-light)" : COLORS.ink }}
                  >
                    <td className="px-5 py-2">{e.date}</td>
                    <td className="px-5 py-2 font-sans">{e.receveur}</td>
                    <td className="px-5 py-2">{fmt(e.recette)}</td>
                    <td className="px-5 py-2">{fmt(e.gazoil)}</td>
                    <td className="px-5 py-2">{fmt(e.autres)}</td>
                    <td className="px-5 py-2 font-semibold">{fmt(e.net)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="text-xs text-[var(--text-slate-light)] mt-8 pb-10">
        Consultation publique — les données affichées sont partagées entre tous les visiteurs du site.
      </div>
    </main>
  );
}
