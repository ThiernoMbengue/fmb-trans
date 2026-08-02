"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Coins, Wallet, TrendingUp, HandCoins, CalendarCheck, Gauge,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, Loader2, Bus,
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
    <div className="surface-card pro-card rounded-2xl p-3.5 sm:p-4 flex flex-col gap-2.5 sm:gap-3 min-w-0">
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
  const [metric, setMetric] = useState("Recette");

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

  const recentEntries = useMemo(
    () => [...entries].sort((a, b) => (b.created_at || b.date).localeCompare(a.created_at || a.date)).slice(0, 7),
    [entries]
  );

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-6xl mx-auto text-sm text-[var(--text-slate-light)]">
        Aucun véhicule enregistré pour le moment.
      </main>
    );
  }

  return (
    <main className="px-4 md:px-8 py-6 max-w-6xl mx-auto animate-fade-up">
      <section className="surface-card rounded-3xl p-5 sm:p-6 mb-5 overflow-hidden relative">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-[var(--fleet-bright)]/10 blur-2xl" />
        <div className="absolute right-16 bottom-0 h-20 w-20 rounded-full bg-[var(--amber)]/10 blur-xl" />
        <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[var(--border-line)] bg-[var(--bg-page)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-slate)]">
              <span className="status-dot h-2 w-2 rounded-full bg-[var(--green)] text-[var(--green)]" />
              Pilotage en temps réel
            </div>
            <h1 className="font-display mt-4 text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-ink)]">Tableau de bord de flotte</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-slate)]">Suivez les recettes, dépenses, marges et versements avec une lecture claire par véhicule et par période.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs text-[var(--text-slate)] sm:min-w-64">
            <div className="rounded-2xl bg-[var(--bg-page)] p-3">
              <div className="font-figures text-lg font-semibold text-[var(--text-ink)]">{vehicles.length}</div>
              <div>Véhicules suivis</div>
            </div>
            <div className="rounded-2xl bg-[var(--bg-page)] p-3">
              <div className="font-figures text-lg font-semibold text-[var(--text-ink)]">{range.start}</div>
              <div>Début période</div>
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
          <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-3.5">
            <KpiCard icon={Coins} label="Recette totale" value={`${fmt(cur.recette)} F`} accent={COLORS.amber} t={trendCalc(cur.recette, prev.recette)} caption={vsLabel} />
            <KpiCard icon={Wallet} label="Dépenses totales" value={`${fmt(cur.depenses)} F`} accent={COLORS.red} t={trendCalc(cur.depenses, prev.depenses)} invert caption={vsLabel} />
            <KpiCard icon={TrendingUp} label="Bénéfice" value={`${fmt(cur.benefice)} F`} accent={COLORS.green} t={trendCalc(cur.benefice, prev.benefice)} caption={vsLabel} />
            <KpiCard icon={HandCoins} label="Net versé au propriétaire" value={`${fmt(cur.net)} F`} accent={COLORS.fleet} t={trendCalc(cur.net, prev.net)} caption={vsLabel} />
            <KpiCard icon={CalendarCheck} label="Jours d'activité" value={cur.jours} accent={COLORS.purple} t={trendCalc(cur.jours, prev.jours)} caption={vsLabel} />
            <KpiCard icon={Gauge} label="Taux de marge" value={`${cur.marge.toFixed(0)}%`} accent={COLORS.green} t={trendCalc(cur.marge, prev.marge)} caption={vsLabel} />
          </div>

          {chartData.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center text-sm text-[var(--text-slate-light)] mt-6">
              Aucune saisie sur la période sélectionnée.
            </div>
          ) : (
            <div className="surface-card pro-card rounded-2xl p-5 mt-6">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
                  {activeMetric.label} par {GRANULARITY_LABEL[granularity]}
                </div>
                <div className="flex items-center gap-1 bg-[var(--bg-page)] border border-[var(--border-line)] rounded-xl p-1">
                  {METRICS.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => setMetric(m.id)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-lg transition-colors"
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
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={chartData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke={COLORS.line} vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={38} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey={metric} radius={[4, 4, 0, 0]}>
                    {chartData.map((d, i) => (
                      <Cell key={i} fill={metric === "Bénéfice" ? (d.Bénéfice >= 0 ? COLORS.green : COLORS.red) : COLORS[activeMetric.color]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </>
      )}

      {!loading && recentEntries.length > 0 && (
        <div className="surface-card rounded-2xl mt-6 overflow-hidden">
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
