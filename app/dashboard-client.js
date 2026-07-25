"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Coins, Wallet, TrendingUp, HandCoins, CalendarCheck, Gauge,
  ArrowUpRight, ArrowDownRight, Minus, ChevronDown, Loader2, Bus, ArrowLeft,
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
];

const MONTH_NAMES = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];
const DAY_NAMES = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const pad2 = (n) => String(n).padStart(2, "0");
const parseIsoLocal = (iso) => new Date(`${iso}T00:00:00`);
const startOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diffToMonday);
  d.setHours(0, 0, 0, 0);
  return d;
};
const endOfMonthIso = (year, month) => isoOf(new Date(year, month + 1, 0));
const weekLabel = (startIso) => {
  const start = parseIsoLocal(startIso);
  const end = addDays(start, 6);
  return `${fmtShortDate(isoOf(start))} au ${fmtShortDate(isoOf(end))}`;
};
const initialDrill = (level) => {
  const today = todayDate();
  const weekStart = isoOf(startOfWeek(today));
  return { level, year: today.getFullYear(), month: today.getMonth(), weekStart };
};
const rangeForDrill = (drill) => {
  const today = todayDate();
  if (drill.level === "annee") {
    const years = [];
    return { start: "0000-01-01", end: "9999-12-31", title: "Toutes les années", crumb: years };
  }
  if (drill.level === "mois") {
    return { start: `${drill.year}-01-01`, end: `${drill.year}-12-31`, title: `Année ${drill.year}`, crumb: [String(drill.year)] };
  }
  if (drill.level === "semaine") {
    return { start: `${drill.year}-${pad2(drill.month + 1)}-01`, end: endOfMonthIso(drill.year, drill.month), title: `${MONTH_NAMES[drill.month]} ${drill.year}`, crumb: [String(drill.year), MONTH_NAMES[drill.month]] };
  }
  const start = drill.weekStart || isoOf(startOfWeek(today));
  return { start, end: isoOf(addDays(parseIsoLocal(start), 6)), title: `Semaine du ${weekLabel(start)}`, crumb: [String(drill.year), MONTH_NAMES[drill.month], weekLabel(start)] };
};
const previousRangeFor = ({ start, end }) => {
  if (start === "0000-01-01") return { prevStart: "0000-01-01", prevEnd: "0000-01-01" };
  const startDate = parseIsoLocal(start);
  const endDate = parseIsoLocal(end);
  const lengthDays = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
  const prevEnd = addDays(startDate, -1);
  const prevStart = addDays(prevEnd, -(lengthDays - 1));
  return { prevStart: isoOf(prevStart), prevEnd: isoOf(prevEnd) };
};

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
  const row = payload[0]?.payload;
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg shadow-md px-3 py-2 text-xs font-figures">
      <div className="text-[var(--text-slate)] mb-1 font-sans">{row?.tooltipLabel || label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-[var(--text-slate)] font-sans">{p.name}</span>
          <span className="ml-auto font-semibold" style={{ color: COLORS.ink }}>{fmt(p.value)} F</span>
        </div>
      ))}
      {row?.hint && <div className="font-sans text-[10px] text-[var(--text-slate-light)] mt-1">{row.hint}</div>}
    </div>
  );
}

function SimpleMoneyChart({ title, data, onBarClick }) {
  return (
    <div className="surface-card pro-card rounded-2xl p-5 lg:col-span-2">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-4">
        <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>{title}</div>
        <div className="text-xs text-[var(--text-slate-light)]">Cliquez sur une barre pour voir le détail.</div>
      </div>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 6, right: 6, left: -10, bottom: 0 }} onClick={(state) => state?.activePayload?.[0]?.payload && onBarClick(state.activePayload[0].payload)}>
          <CartesianGrid stroke={COLORS.line} vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} interval={0} />
          <YAxis tick={{ fontSize: 10, fill: COLORS.slate }} axisLine={false} tickLine={false} width={46} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(0,0,0,0.04)" }} />
          <Legend wrapperStyle={{ fontSize: 11 }} />
          <Bar dataKey="Recette" fill={COLORS.amber} radius={[5, 5, 0, 0]} cursor="pointer" />
          <Bar dataKey="Dépenses" fill={COLORS.red} radius={[5, 5, 0, 0]} cursor="pointer" />
          <Bar dataKey="Bénéfice" fill={COLORS.green} radius={[5, 5, 0, 0]} cursor="pointer" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function DashboardClient({ vehicles }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [drill, setDrill] = useState(() => initialDrill("mois"));

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
  const range = useMemo(() => ({ ...rangeForDrill(drill), ...previousRangeFor(rangeForDrill(drill)) }), [drill]);

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
  const vsLabel = PERIOD_VS_LABEL[drill.level];

  const chartData = useMemo(() => {
    const emptyMetric = () => ({ Recette: 0, Dépenses: 0, Bénéfice: 0 });
    const addRow = (bucket, row) => {
      bucket.Recette += Number(row.recette) || 0;
      bucket.Dépenses += (Number(row.gazoil) || 0) + (Number(row.autres) || 0);
      bucket.Bénéfice = bucket.Recette - bucket.Dépenses;
    };

    if (drill.level === "annee") {
      const years = [...new Set(entries.map((e) => parseIsoLocal(e.date).getFullYear()))].sort((a, b) => a - b);
      return years.map((year) => {
        const bucket = { label: String(year), tooltipLabel: `Année ${year}`, level: "annee", year, ...emptyMetric() };
        entries.filter((e) => parseIsoLocal(e.date).getFullYear() === year).forEach((e) => addRow(bucket, e));
        return { ...bucket, hint: "Cliquer pour voir les mois" };
      });
    }

    if (drill.level === "mois") {
      return MONTH_NAMES.map((label, month) => {
        const bucket = { label, tooltipLabel: `${label} ${drill.year}`, level: "mois", year: drill.year, month, ...emptyMetric() };
        currentRows.filter((e) => parseIsoLocal(e.date).getMonth() === month).forEach((e) => addRow(bucket, e));
        return { ...bucket, hint: "Cliquer pour voir les semaines" };
      });
    }

    if (drill.level === "semaine") {
      const first = parseIsoLocal(range.start);
      const last = parseIsoLocal(range.end);
      const starts = [];
      for (let d = startOfWeek(first); d <= last; d = addDays(d, 7)) starts.push(isoOf(d));
      return starts.map((weekStart, idx) => {
        const weekEnd = isoOf(addDays(parseIsoLocal(weekStart), 6));
        const bucket = { label: `Sem. ${idx + 1}`, tooltipLabel: weekLabel(weekStart), level: "semaine", year: drill.year, month: drill.month, weekStart, ...emptyMetric() };
        currentRows.filter((e) => e.date >= weekStart && e.date <= weekEnd).forEach((e) => addRow(bucket, e));
        return { ...bucket, hint: "Cliquer pour voir les jours" };
      });
    }

    return DAY_NAMES.map((label, index) => {
      const date = isoOf(addDays(parseIsoLocal(range.start), index));
      const bucket = { label, tooltipLabel: `${label} ${fmtShortDate(date)}`, level: "jour", date, ...emptyMetric() };
      currentRows.filter((e) => e.date === date).forEach((e) => addRow(bucket, e));
      return bucket;
    });
  }, [currentRows, drill, entries, range]);

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
              onClick={() => setDrill(initialDrill(p.id))}
              className="text-xs font-medium px-2.5 sm:px-3 py-1.5 rounded-lg transition-colors shrink-0 whitespace-nowrap"
              style={{
                backgroundColor: drill.level === p.id ? "var(--amber)" : "transparent",
                color: drill.level === p.id ? "#1A1200" : "var(--text-slate)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
              <div className="surface-card rounded-2xl p-4 lg:col-span-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-slate-light)]">Vue simple</div>
                    <div className="text-base font-semibold text-[var(--text-ink)]">{range.title}</div>
                    <div className="text-xs text-[var(--text-slate)] mt-1">Barres jaunes = argent reçu, rouges = dépenses, vertes = bénéfice.</div>
                  </div>
                  {drill.level !== "annee" && (
                    <button
                      onClick={() => setDrill((d) => d.level === "jour" ? { level: "semaine", year: d.year, month: d.month } : d.level === "semaine" ? { level: "mois", year: d.year } : initialDrill("annee"))}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-line)] px-3 py-2 text-xs font-semibold text-[var(--text-slate)] hover:bg-[var(--bg-page)]"
                    >
                      <ArrowLeft size={14} /> Retour
                    </button>
                  )}
                </div>
                {range.crumb.length > 0 && <div className="mt-3 text-xs text-[var(--text-slate-light)]">Année / {range.crumb.join(" / ")}</div>}
              </div>
              <SimpleMoneyChart
                title="Recette, dépenses et bénéfice"
                data={chartData}
                onBarClick={(row) => {
                  if (row.level === "annee") setDrill({ level: "mois", year: row.year });
                  if (row.level === "mois") setDrill({ level: "semaine", year: row.year, month: row.month });
                  if (row.level === "semaine") setDrill({ level: "jour", year: row.year, month: row.month, weekStart: row.weekStart });
                }}
              />
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
