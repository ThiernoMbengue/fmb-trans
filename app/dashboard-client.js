"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Fuel, Wallet, TrendingUp, CalendarCheck, CalendarX, ChevronDown, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const COLORS = {
  ink: "#14324D", fleet: "#1F4E78", amber: "#C9862B", green: "#1E7A5F",
  red: "#B3452C", slate: "#5B6B7A", line: "#E4E9EF",
};
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/,/g, " ");
const fmtShortDate = (iso) => { const [, m, d] = iso.split("-"); return `${d}/${m}`; };
const monthOf = (iso) => iso.slice(0, 7);
const monthLabel = (ym) => new Date(ym + "-01T00:00:00").toLocaleDateString("fr-FR", { month: "long", year: "numeric" });

function RoadDivider() {
  return (
    <div className="w-full h-[2px] my-8" style={{
      backgroundImage: `repeating-linear-gradient(90deg, ${COLORS.fleet} 0 14px, transparent 14px 26px)`,
      opacity: 0.35,
    }} />
  );
}

function KpiCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="relative bg-white rounded-xl border border-slate-200 p-4 flex flex-col gap-2 overflow-hidden">
      <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: accent }} />
      <div className="flex items-center justify-between pl-2">
        <span className="text-xs font-medium tracking-wide uppercase text-slate-500">{label}</span>
        <Icon size={16} color={accent} strokeWidth={2.25} />
      </div>
      <div className="pl-2 font-mono text-2xl font-semibold" style={{ color: COLORS.ink }}>{value}</div>
      {sub && <div className="pl-2 text-xs text-slate-400">{sub}</div>}
    </div>
  );
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-md px-3 py-2 text-xs font-mono">
      <div className="text-slate-500 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center gap-2">
          <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-slate-600">{p.name}</span>
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
  const [month, setMonth] = useState(null);

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

  const months = useMemo(() => {
    const set = new Set(entries.map((e) => monthOf(e.date)));
    return Array.from(set).sort();
  }, [entries]);

  useEffect(() => {
    if (months.length) setMonth((m) => (m && months.includes(m) ? m : months[months.length - 1]));
  }, [months]);

  const monthDays = useMemo(
    () => entries.filter((e) => monthOf(e.date) === month),
    [entries, month]
  );

  const totals = useMemo(() => {
    const recette = monthDays.reduce((s, d) => s + (Number(d.recette) || 0), 0);
    const gazoil = monthDays.reduce((s, d) => s + (Number(d.gazoil) || 0), 0);
    const autres = monthDays.reduce((s, d) => s + (Number(d.autres) || 0), 0);
    const net = monthDays.reduce((s, d) => s + (Number(d.net) || 0), 0);
    const worked = monthDays.filter((d) => (Number(d.recette) || 0) > 0).length;
    const rest = monthDays.length - worked;
    const avgNet = worked > 0 ? Math.round(net / worked) : 0;
    return { recette, gazoil, autres, net, worked, rest, avgNet };
  }, [monthDays]);

  const chartData = monthDays.map((d) => ({
    date: fmtShortDate(d.date),
    Recette: Number(d.recette) || 0,
    Dépenses: (Number(d.gazoil) || 0) + (Number(d.autres) || 0),
    "Net versé": Number(d.net) || 0,
  }));

  const pieData = [
    { name: "Gazoil", value: totals.gazoil, color: COLORS.amber },
    { name: "Autres dépenses", value: totals.autres, color: COLORS.slate },
    { name: "Net versé", value: totals.net, color: COLORS.green },
  ].filter((d) => d.value > 0);

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-5xl mx-auto text-sm text-slate-400">
        Aucun véhicule enregistré pour le moment.
      </main>
    );
  }

  return (
    <main className="px-6 md:px-10 py-8 max-w-5xl mx-auto">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative">
          <select
            value={vehicleId || ""}
            onChange={(e) => setVehicleId(e.target.value)}
            className="appearance-none text-sm font-medium bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 cursor-pointer"
            style={{ color: COLORS.ink }}
          >
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
        </div>
        {vehicle && (
          <div className="text-xs text-slate-400">{vehicle.proprietaire} · chauffeur {vehicle.chauffeur}</div>
        )}
        {months.length > 0 && (
          <div className="relative ml-auto">
            <select
              value={month || ""}
              onChange={(e) => setMonth(e.target.value)}
              className="appearance-none text-sm font-medium bg-white border border-slate-200 rounded-lg pl-3 pr-8 py-2 cursor-pointer capitalize"
              style={{ color: COLORS.ink }}
            >
              {months.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-slate-400 text-sm py-10">
          <Loader2 size={16} className="animate-spin" /> Chargement des données…
        </div>
      ) : months.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-400">
          Aucune donnée pour ce véhicule.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <KpiCard icon={TrendingUp} label="Recette totale" value={`${fmt(totals.recette)} F`} accent={COLORS.fleet} />
            <KpiCard icon={Fuel} label="Gazoil" value={`${fmt(totals.gazoil)} F`} accent={COLORS.amber} />
            <KpiCard icon={Wallet} label="Autres dépenses" value={`${fmt(totals.autres)} F`} accent={COLORS.slate} />
            <KpiCard icon={CalendarCheck} label="Jours travaillés" value={totals.worked} sub={`${totals.rest} jour(s) de repos`} accent={COLORS.green} />
            <KpiCard icon={CalendarX} label="Net versé" value={`${fmt(totals.net)} F`} sub={`moy. ${fmt(totals.avgNet)} F / jour`} accent={COLORS.green} />
          </div>

          <RoadDivider />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5">
              <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Évolution journalière</div>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={chartData} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gRecette" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.fleet} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={COLORS.fleet} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={COLORS.green} stopOpacity={0.28} />
                      <stop offset="100%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={COLORS.line} vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v / 1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Area type="monotone" dataKey="Recette" stroke={COLORS.fleet} fill="url(#gRecette)" strokeWidth={2} />
                  <Area type="monotone" dataKey="Dépenses" stroke={COLORS.amber} fill="transparent" strokeWidth={2} />
                  <Area type="monotone" dataKey="Net versé" stroke={COLORS.green} fill="url(#gNet)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col">
              <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Répartition du mois</div>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={50} outerRadius={75} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => `${fmt(v)} F`} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-col gap-1.5 mt-2">
                {pieData.map((d) => (
                  <div key={d.name} className="flex items-center gap-2 text-xs">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: d.color }} />
                    <span className="text-slate-500">{d.name}</span>
                    <span className="ml-auto font-mono font-medium" style={{ color: COLORS.ink }}>{fmt(d.value)} F</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 mt-6">
            <div className="text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>Dépenses par jour</div>
            <ResponsiveContainer width="100%" height={210}>
              <BarChart data={monthDays.map((d) => ({ date: fmtShortDate(d.date), Gazoil: Number(d.gazoil) || 0, Autres: Number(d.autres) || 0 }))} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid stroke={COLORS.line} vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={{ stroke: COLORS.line }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: COLORS.slate }} axisLine={false} tickLine={false} width={44} tickFormatter={(v) => `${v / 1000}k`} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Gazoil" stackId="a" fill={COLORS.amber} />
                <Bar dataKey="Autres" stackId="a" fill={COLORS.slate} radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}

      <div className="text-xs text-slate-400 mt-8 pb-10">
        Consultation publique — les données affichées sont partagées entre tous les visiteurs du site.
      </div>
    </main>
  );
}
