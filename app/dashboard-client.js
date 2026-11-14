"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, Cell, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Coins, Wallet, TrendingUp, HandCoins, CalendarCheck, Gauge, Bus, Search,
  MessageSquareText, CalendarClock, ArrowRight, BarChart3, Plus, BellRing,
  ArrowDownLeft, ArrowUpRight,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { aSurveiller } from "@/lib/carnet";
import { iconeDuType } from "@/components/carnet-icones";
import { lireTout } from "@/lib/supabase/lire-tout";
import { useVehiculeCourant } from "@/lib/vehicule-courant";
import { isoLocal, fmt, fmtF, fmtJour, fmtDateLongue } from "@/lib/format";
import { EnTete, SelecteurVehicule, Segments, Indicateur, Vide, Bandeau } from "@/components/ui";

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

// Une seule série affichée à la fois : elle porte la couleur de la marque.
// Seul un bénéfice négatif change de teinte, parce que le signe est une
// information.
const METRICS = [
  { id: "Recette", label: "Recette", cle: "recette" },
  { id: "Dépenses", label: "Dépenses", cle: "depenses" },
  { id: "Bénéfice", label: "Bénéfice", cle: "benefice" },
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

// Variation mise en forme pour <Indicateur>. `inverse` : pour une dépense,
// une baisse est une bonne nouvelle.
function tendance(courant, precedent, inverse = false) {
  const t = trendCalc(courant, precedent);
  const bon = t.dir === "flat" ? null : (t.dir === "up") !== inverse;
  return { pct: t.pct, dir: t.dir, bon };
}

function Sparkline({ data }) {
  if (!data || data.length < 2) return null;
  return (
    <div className="-mx-1 -mb-1 mt-3 h-9" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 3, right: 1, left: 1, bottom: 0 }}>
          <Area type="monotone" dataKey="v" stroke="var(--fleet-bright)" fill="var(--fleet-bright)" fillOpacity={0.1} strokeWidth={1.75} dot={false} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function DetailItem({ label, value, caption }) {
  return (
    <div className="min-w-0 rounded-[10px] border border-[var(--border-line)] bg-[var(--bg-surface-alt)] px-3 py-2.5">
      <div className="text-xs text-[var(--text-slate-light)]">{label}</div>
      <div className="font-figures mt-0.5 text-sm font-semibold text-[var(--text-ink)]">{value}</div>
      {caption && <div className="mt-0.5 break-words text-xs text-[var(--text-slate)]">{caption}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="rounded-[10px] border border-[var(--border-line)] bg-[var(--bg-surface)] px-3 py-2.5 text-xs" style={{ boxShadow: "var(--shadow-pop)" }}>
      <div className="mb-1 text-[var(--text-slate-light)]">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block h-2 w-2 rounded-[3px]" style={{ backgroundColor: p.payload?.[p.dataKey] < 0 ? "var(--red)" : "var(--fleet-bright)" }} />
          <span className="text-[var(--text-slate)]">{p.name}</span>
          <span className="font-figures ml-3 font-semibold text-[var(--text-ink)]">{fmtF(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export default function DashboardClient({ vehicles, role, vehiculeInitial }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useVehiculeCourant(vehicles, vehiculeInitial, { extra: [ALL_ID] });
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
  const isAdmin = role === "admin";
  const aSurveillerVisible = isAdmin && (surveille.echeances.length > 0 || surveille.aPayer > 0 || surveille.aRecevoir > 0);
  const totalMetrique = cur[activeMetric.cle];

  return (
    <main className="page">
      <EnTete
        titre={isAdmin ? "Tableau de bord" : "Mon tableau de bord"}
        description={
          range.start === range.end
            ? `Journée du ${fmtDateLongue(range.start)}`
            : `Du ${fmtDateLongue(range.start)} au ${fmtDateLongue(range.end)}`
        }
        actions={
          isAdmin && (
            <Link href="/saisie" className="btn btn-primaire hidden sm:inline-flex">
              <Plus size={16} /> Saisir un versement
            </Link>
          )
        }
      />

      {/* Véhicule et période */}
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <SelecteurVehicule
          vehicles={vehicles}
          value={vehicleId}
          onChange={setVehicleId}
          extra={vehicles.length > 1 ? <option value={ALL_ID}>{allLabel}</option> : null}
        />
        <Segments label="Période" options={PERIODS} value={periodType} onChange={setPeriodType} etire />
      </div>

      {periodType === "personnalise" && (
        <div className="animate-fondu mb-5 flex flex-wrap items-center gap-2">
          <input type="date" aria-label="Début de période" value={customStart} max={customEnd} onChange={(e) => setCustomStart(e.target.value)} className="champ w-auto" />
          <span className="text-sm text-[var(--text-slate-light)]">au</span>
          <input type="date" aria-label="Fin de période" value={customEnd} min={customStart} onChange={(e) => setCustomEnd(e.target.value)} className="champ w-auto" />
        </div>
      )}

      {loading ? (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <div key={i} className="squelette h-[7.5rem]" style={{ borderRadius: "var(--r-carte)" }} />)}
          </div>
          <div className="squelette mt-5 h-[22rem]" style={{ borderRadius: "var(--r-carte)" }} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <Indicateur icone={Coins} label="Recette" valeur={fmtF(cur.recette)} couleur={COLORS.fleet} tendance={tendance(cur.recette, prev.recette)} legende={vsLabel}>
              <Sparkline data={sparkSeries.recette} />
            </Indicateur>
            <Indicateur icone={Wallet} label="Dépenses" valeur={fmtF(cur.depenses)} couleur={COLORS.red} tendance={tendance(cur.depenses, prev.depenses, true)} legende={vsLabel}>
              <Sparkline data={sparkSeries.depenses} />
            </Indicateur>
            <Indicateur icone={HandCoins} label="Net versé au propriétaire" valeur={fmtF(cur.net)} couleur={COLORS.green} tendance={tendance(cur.net, prev.net)} legende={vsLabel}>
              <Sparkline data={sparkSeries.net} />
            </Indicateur>
            <Indicateur icone={TrendingUp} label="Bénéfice" valeur={fmtF(cur.benefice)} couleur={COLORS.green} tendance={tendance(cur.benefice, prev.benefice)} legende={vsLabel} />
            <Indicateur icone={CalendarCheck} label="Jours d'activité" valeur={cur.jours} couleur={COLORS.purple} tendance={tendance(cur.jours, prev.jours)} legende={vsLabel} />
            <Indicateur icone={Gauge} label="Taux de marge" valeur={`${cur.marge.toFixed(0)} %`} couleur={COLORS.amber} tendance={tendance(cur.marge, prev.marge)} legende={vsLabel} />
          </div>

          <div className={`mt-5 grid items-start gap-5 ${aSurveillerVisible ? "xl:grid-cols-[minmax(0,1fr)_21rem]" : ""}`}>
            {/* ------------------------------------------- À surveiller */}
            {/* Ce que le carnet de bord réclame : échéances proches et dettes
                ouvertes. Le reste y dort, pour ne pas en faire un cimetière. */}
            {aSurveillerVisible && (
              <section className="carte overflow-hidden xl:col-start-2 xl:row-start-1">
                <div className="flex items-center justify-between gap-3 border-b border-[var(--border-line)] px-4 py-3.5 sm:px-5">
                  <h2 className="titre-bloc flex items-center gap-2">
                    <BellRing size={16} color={COLORS.amber} /> À surveiller
                  </h2>
                  <Link href="/carnet" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--fleet-bright)] hover:underline">
                    Carnet <ArrowRight size={14} />
                  </Link>
                </div>

                {(surveille.aRecevoir > 0 || surveille.aPayer > 0) && (
                  <div className="grid grid-cols-2 divide-x divide-[var(--border-line)] border-b border-[var(--border-line)]">
                    <div className="px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-slate)]"><ArrowDownLeft size={13} color={COLORS.green} /> On nous doit</div>
                      <div className="mt-1 text-[15px] font-semibold text-[var(--text-ink)]">{fmtF(surveille.aRecevoir)}</div>
                    </div>
                    <div className="px-4 py-3 sm:px-5">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--text-slate)]"><ArrowUpRight size={13} color={COLORS.red} /> Nous devons</div>
                      <div className="mt-1 text-[15px] font-semibold text-[var(--text-ink)]">{fmtF(surveille.aPayer)}</div>
                    </div>
                  </div>
                )}

                {surveille.echeances.length > 0 && (
                  <ul className="divide-y divide-[var(--border-line)]">
                    {surveille.echeances.slice(0, 5).map((l) => {
                      const enRetard = l.jours < 0;
                      const couleur = enRetard ? COLORS.red : l.jours <= 7 ? COLORS.amber : COLORS.slate;
                      const Icone = iconeDuType(l.type);
                      return (
                        <li key={l.id}>
                          <Link href="/carnet" className="flex items-center gap-3 px-4 py-3 hover:bg-[var(--bg-surface-alt)] sm:px-5">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `color-mix(in srgb, ${couleur} 12%, transparent)`, color: couleur }}>
                              <Icone size={15} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-[var(--text-ink)]">{l.titre}</span>
                              <span className="flex items-center gap-1 text-xs font-medium" style={{ color: couleur }}>
                                <CalendarClock size={12} />
                                {enRetard ? `En retard de ${-l.jours} j` : l.jours === 0 ? "Aujourd'hui" : l.jours === 1 ? "Demain" : `Dans ${l.jours} jours`}
                              </span>
                            </span>
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {surveille.echeances.length > 5 && (
                  <div className="border-t border-[var(--border-line)] px-4 py-2.5 text-xs text-[var(--text-slate-light)] sm:px-5">
                    et {surveille.echeances.length - 5} autre{surveille.echeances.length - 5 > 1 ? "s" : ""} dans le carnet
                  </div>
                )}
              </section>
            )}

            {/* --------------------------------------------- Graphique */}
            <section className={`carte min-w-0 p-4 sm:p-5 ${aSurveillerVisible ? "xl:col-start-1 xl:row-start-1" : ""}`}>
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-[13px] font-medium text-[var(--text-slate)]">
                    {activeMetric.label} par {GRANULARITY_LABEL[granularity]}
                  </h2>
                  <div className="mt-1 text-[1.6rem] font-semibold leading-none tracking-[-0.02em] text-[var(--text-ink)]">{fmtF(totalMetrique)}</div>
                </div>
                <Segments label="Mesure affichée" options={METRICS} value={metric} onChange={setMetric} />
              </div>
              {chartData.length === 0 ? (
                <Vide icone={BarChart3} titre="Aucune saisie sur cette période">
                  Choisissez une autre période{isAdmin ? ", ou enregistrez un versement" : ""}.
                </Vide>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <BarChart data={chartData} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
                    <CartesianGrid stroke="var(--border-line)" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-slate-light)" }} axisLine={{ stroke: "var(--border-line)" }} tickLine={false} interval="preserveStartEnd" minTickGap={12} tickMargin={6} />
                    <YAxis tick={{ fontSize: 11, fill: "var(--text-slate-light)" }} axisLine={false} tickLine={false} width={42} tickFormatter={fmtAxe} />
                    <Tooltip content={<CustomTooltip />} cursor={{ fill: "color-mix(in srgb, var(--text-slate) 9%, transparent)", radius: 6 }} />
                    <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={420}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d[metric] < 0 ? "var(--red)" : "var(--fleet-bright)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </section>
          </div>
        </>
      )}

      {!loading && (
        <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_21rem]">
          {/* ---------------------------------- Derniers versements */}
          <section className="carte min-w-0 overflow-hidden">
            <div className="flex items-center justify-between gap-3 border-b border-[var(--border-line)] px-4 py-3.5 sm:px-5">
              <h2 className="titre-bloc">Derniers versements saisis</h2>
              {isAdmin && (
                <Link href="/saisie" className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-[13px] font-semibold text-[var(--fleet-bright)] hover:underline">
                  Tout voir <ArrowRight size={14} />
                </Link>
              )}
            </div>
            {recentEntries.length === 0 ? (
              <Vide icone={Coins} titre="Aucun versement saisi">
                {isAdmin ? "Les versements enregistrés apparaîtront ici." : "Les versements de vos véhicules apparaîtront ici."}
              </Vide>
            ) : (
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
                      const repos = Number(e.recette) === 0;
                      return (
                        <Fragment key={cleLigne(e)}>
                          <tr style={{ color: repos ? "var(--text-slate-light)" : COLORS.ink }}>
                            <td className="whitespace-nowrap font-medium" title={e.date}>{fmtJour(e.date)}</td>
                            {isAllMode && (
                              <td className="text-[13px] text-[var(--text-slate)]">
                                <span className="whitespace-nowrap">{v ? v.marque : "—"}</span>
                                {v && <span className="ml-1.5 hidden whitespace-nowrap text-[var(--text-slate-light)] sm:inline">{v.immatriculation}</span>}
                              </td>
                            )}
                            <td className="hidden text-[var(--text-slate)] md:table-cell">{e.receveur || "—"}</td>
                            <td className="num">{repos ? "—" : fmt(e.recette)}</td>
                            <td className="num hidden text-[var(--text-slate)] sm:table-cell">{repos ? "—" : fmt(e.gazoil)}</td>
                            <td className="num hidden text-[var(--text-slate)] sm:table-cell">{repos ? "—" : fmt(e.autres)}</td>
                            <td className="num font-semibold">{repos ? "Repos" : fmt(e.net)}</td>
                            <td className="!px-2 text-center">
                              {e.note && (
                                <button
                                  onClick={() => setNoteOuverte(ouverte ? null : cleLigne(e))}
                                  aria-expanded={ouverte}
                                  aria-label="Voir la remarque de la journée"
                                  title="Voir la remarque de la journée"
                                  className="btn-icone nu h-8 w-8"
                                  style={{ color: ouverte ? COLORS.fleet : undefined }}
                                >
                                  <MessageSquareText size={15} />
                                </button>
                              )}
                            </td>
                          </tr>
                          {e.note && ouverte && (
                            <tr style={{ backgroundColor: "var(--bg-surface-alt)" }}>
                              <td colSpan={isAllMode ? 8 : 7}>
                                <div className="flex items-start gap-2 whitespace-pre-wrap text-[13px] leading-relaxed text-[var(--text-slate)]">
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
            )}
          </section>

          {/* ------------------------------ Retrouver un versement */}
          <section className="carte min-w-0 p-4 sm:p-5">
            <h2 className="titre-bloc flex items-center gap-2">
              <Search size={16} color={COLORS.fleet} /> Retrouver un versement
            </h2>
            <p className="mb-3.5 mt-1 text-[13px] text-[var(--text-slate)]">Choisissez un jour pour afficher son détail.</p>
            <div className="flex items-center gap-2">
              <input
                type="date"
                aria-label="Date du versement recherché"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="champ min-w-0 flex-1"
              />
              {searchDate && (
                <button onClick={() => setSearchDate("")} className="btn btn-discret btn-petit shrink-0">Effacer</button>
              )}
            </div>

            {searchDate && (
              searchResults.length > 0 ? (
                <div className="animate-fondu mt-4 flex flex-col gap-4">
                  {searchResults.map((r) => (
                    <div key={cleLigne(r)}>
                      <div className="mb-2 text-[13px] font-semibold text-[var(--text-ink)]">
                        {fmtJour(r.date, { annee: true })}
                        {isAllMode && vehicleById[r.vehicle_id] && (
                          <span className="font-normal text-[var(--text-slate)]"> · {vehicleById[r.vehicle_id].marque} {vehicleById[r.vehicle_id].immatriculation}</span>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <DetailItem label="Recette" value={fmtF(r.recette)} />
                        <DetailItem label="Net versé" value={fmtF(r.net)} />
                        <DetailItem label="Gazoil" value={fmtF(r.gazoil)} caption={r.gazoil_note} />
                        <DetailItem label="Autres dépenses" value={fmtF(r.autres)} caption={r.autres_note} />
                        <DetailItem label="Total caisse" value={fmtF(r.total_caisse)} />
                        <DetailItem label="Receveur" value={r.receveur || "—"} />
                      </div>
                      {r.note && (
                        <Bandeau icone={MessageSquareText} className="mt-2 whitespace-pre-wrap">
                          <div className="mb-0.5 font-semibold text-[var(--text-ink)]">Remarque sur la journée</div>
                          {r.note}
                        </Bandeau>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 rounded-[10px] border border-dashed border-[var(--border-strong)] px-3 py-4 text-center text-[13px] text-[var(--text-slate)]">
                  {isAllMode
                    ? `Aucune saisie le ${fmtDateLongue(searchDate)}.`
                    : `Aucune saisie le ${fmtDateLongue(searchDate)} pour ${vehicle?.marque} — ${vehicle?.immatriculation}.`}
                </div>
              )
            )}
          </section>
        </div>
      )}
    </main>
  );
}
