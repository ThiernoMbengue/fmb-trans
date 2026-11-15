"use client";

// Graphiques du tableau de bord. Isolés dans ce fichier pour que la
// bibliothèque qui les dessine ne soit téléchargée qu'au moment où ils
// s'affichent, et non avec le reste de la page.

import {
  BarChart, Bar, Cell, Area, AreaChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { fmtF } from "@/lib/format";

// Graduations de l'axe : 15000 -> « 15k », 1500000 -> « 1,5M ».
const fmtAxe = (v) => {
  const abs = Math.abs(v);
  if (abs >= 1000000) return `${(v / 1000000).toFixed(abs % 1000000 ? 1 : 0).replace(".", ",")}M`;
  if (abs >= 1000) return `${Math.round(v / 1000)}k`;
  return String(v);
};

export function Sparkline({ data }) {
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

export function GraphiqueBarres({ data, metric }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barCategoryGap="28%">
        <CartesianGrid stroke="var(--border-line)" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-slate-light)" }} axisLine={{ stroke: "var(--border-line)" }} tickLine={false} interval="preserveStartEnd" minTickGap={12} tickMargin={6} />
        <YAxis tick={{ fontSize: 11, fill: "var(--text-slate-light)" }} axisLine={false} tickLine={false} width={42} tickFormatter={fmtAxe} />
        <Tooltip content={<CustomTooltip />} cursor={{ fill: "color-mix(in srgb, var(--text-slate) 9%, transparent)", radius: 6 }} />
        <Bar dataKey={metric} radius={[4, 4, 0, 0]} maxBarSize={24} isAnimationActive animationDuration={420}>
          {data.map((d, i) => (
            <Cell key={i} fill={d[metric] < 0 ? "var(--red)" : "var(--fleet-bright)"} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
