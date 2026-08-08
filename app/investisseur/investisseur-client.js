"use client";

import { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, Cell, ReferenceLine,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import {
  Banknote, TrendingUp, CalendarClock, Percent, Wallet, Target, Info, Bus,
} from "lucide-react";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const DAYS_PER_MONTH = 30.44;

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

export default function InvestisseurClient({ vehicle, entries, depensesImprevues, prixAchat }) {
  const [chargesAnnuelles, setChargesAnnuelles] = useState(0);

  const base = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
    const premiereDate = sorted[0].date;
    const derniereDate = sorted[sorted.length - 1].date;

    const joursObserves =
      Math.round(
        (new Date(derniereDate + "T00:00:00") - new Date(premiereDate + "T00:00:00")) / 86400000
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
      if (!parMois.has(key)) parMois.set(key, { net: 0, recette: 0, depenses: 0 });
      const b = parMois.get(key);
      b.net += Number(e.net) || 0;
      b.recette += Number(e.recette) || 0;
      b.depenses += (Number(e.gazoil) || 0) + (Number(e.autres) || 0);
    }
    const mois = [...parMois.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    return {
      sorted, premiereDate, derniereDate, joursObserves, moisObserves,
      recetteBrute, depensesExploitation, netVerse, joursActifs, mois,
    };
  }, [entries]);

  const calc = useMemo(() => {
    const chargesSurPeriode = (chargesAnnuelles / 12) * base.moisObserves;
    const netReel = base.netVerse - depensesImprevues - chargesSurPeriode;
    const netMensuelMoyen = base.moisObserves > 0 ? netReel / base.moisObserves : 0;
    const netJournalierMoyen = base.joursObserves > 0 ? netReel / base.joursObserves : 0;

    const pctRembourse = prixAchat > 0 ? (netReel / prixAchat) * 100 : 0;
    const rendementAnnuel = prixAchat > 0 ? ((netMensuelMoyen * 12) / prixAchat) * 100 : 0;
    const moisRentabilite = netMensuelMoyen > 0 ? prixAchat / netMensuelMoyen : null;
    const moisRestants = netMensuelMoyen > 0 ? Math.max(0, (prixAchat - netReel) / netMensuelMoyen) : null;

    let dateRentabilite = null;
    if (moisRestants != null) {
      const d = new Date(base.derniereDate + "T00:00:00");
      d.setMonth(d.getMonth() + Math.ceil(moisRestants));
      dateRentabilite = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }

    return {
      chargesSurPeriode, netReel, netMensuelMoyen, netJournalierMoyen,
      pctRembourse, rendementAnnuel, moisRentabilite, moisRestants, dateRentabilite,
    };
  }, [base, chargesAnnuelles, depensesImprevues, prixAchat]);

  // Courbe : cumul réel observé, puis projection au rythme moyen jusqu'au remboursement
  const courbe = useMemo(() => {
    const chargesMensuelles = chargesAnnuelles / 12;
    const depensesParMois = base.mois.length > 0 ? depensesImprevues / base.mois.length : 0;

    let cumul = 0;
    const points = base.mois.map(([key, b]) => {
      cumul += b.net - depensesParMois - chargesMensuelles;
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
  }, [base, calc, chargesAnnuelles, depensesImprevues, prixAchat]);

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

  const pctBar = Math.max(0, Math.min(100, calc.pctRembourse));

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
              {fmtDateLong(base.premiereDate)} au {fmtDateLong(base.derniereDate)}.
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

      {/* Indicateurs clés */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <StatCard
          icon={Banknote}
          label="Revenu net perçu"
          value={`${fmt(calc.netReel)} F`}
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
          icon={Target}
          label="Capital restant à couvrir"
          value={`${fmt(Math.max(0, prixAchat - calc.netReel))} F`}
          caption={calc.dateRentabilite ? `équilibre estimé : ${fmtMonthLong(calc.dateRentabilite)}` : null}
          accent={COLORS.red}
        />
        <StatCard
          icon={Wallet}
          label="Jours travaillés"
          value={`${base.joursActifs} / ${base.joursObserves}`}
          caption={`taux d'activité ${((base.joursActifs / base.joursObserves) * 100).toFixed(0)} %`}
          accent={COLORS.slate}
        />
      </div>

      {/* Courbe de remboursement */}
      <div className="surface-card pro-card rounded-2xl p-5 mt-6">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-1">
          <div>
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
              Remboursement du capital investi
            </div>
            <div className="text-xs text-[var(--text-slate-light)] mt-1">
              Cumul des revenus nets perçus. La ligne pointillée prolonge la tendance au rythme actuel
              jusqu&apos;au remboursement des {fmt(prixAchat)} F.
            </div>
          </div>
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
        <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
          Détail mensuel de l&apos;exploitation
        </div>
        <div className="text-xs text-[var(--text-slate-light)] mb-4">
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
      </div>

      {/* Scénarios */}
      <div className="surface-card rounded-2xl mt-4 overflow-hidden">
        <div className="px-5 py-4 border-b" style={{ borderColor: COLORS.line }}>
          <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Scénarios de rentabilité</div>
          <div className="text-xs text-[var(--text-slate-light)] mt-1">
            Trois hypothèses d&apos;activité appliquées au revenu net mensuel constaté.
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

      {/* Paramètre ajustable + hypothèses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <div className="surface-card rounded-2xl p-5">
          <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>
            Simuler des charges annuelles
          </div>
          <div className="text-xs text-[var(--text-slate-light)] mb-4">
            Assurance, visite technique, gros entretien… Ces montants ne figurent pas dans les saisies
            quotidiennes. Entrez une estimation annuelle pour voir son impact sur tous les chiffres ci-dessus.
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              step={50000}
              value={chargesAnnuelles}
              onChange={(e) => setChargesAnnuelles(Math.max(0, Number(e.target.value) || 0))}
              className="w-40 text-sm font-figures bg-[var(--bg-page)] border border-[var(--border-line)] rounded-lg px-3 py-2"
            />
            <span className="text-sm text-[var(--text-slate)]">FCFA / an</span>
            {chargesAnnuelles > 0 && (
              <button
                onClick={() => setChargesAnnuelles(0)}
                className="text-xs text-[var(--text-slate-light)] underline underline-offset-2 ml-1"
              >
                Réinitialiser
              </button>
            )}
          </div>
          {chargesAnnuelles > 0 && (
            <div className="text-xs text-[var(--text-slate)] mt-3">
              Soit {fmt(chargesAnnuelles / 12)} F par mois déduits du revenu net.
            </div>
          )}
        </div>

        <div className="surface-card rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>
            <Info size={15} color={COLORS.slate} /> Hypothèses et limites
          </div>
          <ul className="text-xs text-[var(--text-slate)] leading-relaxed flex flex-col gap-1.5 list-disc pl-4">
            <li>
              Période réellement observée : <strong>{base.joursObserves} jours</strong> ({base.moisObserves.toFixed(1)} mois),
              du {fmtDateLong(base.premiereDate)} au {fmtDateLong(base.derniereDate)}.
            </li>
            <li>
              Les projections prolongent simplement le rythme constaté. Plus la période observée est courte,
              moins l&apos;extrapolation est fiable — la saisonnalité et les pannes ne sont pas modélisées.
            </li>
            <li>
              Dépenses imprévues déjà déduites sur la période : <strong>{fmt(depensesImprevues)} F</strong>.
            </li>
            <li>
              Charges annuelles simulées : <strong>{fmt(chargesAnnuelles)} F/an</strong>
              {chargesAnnuelles === 0 && " (aucune — les chiffres reflètent uniquement les saisies quotidiennes)"}.
            </li>
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
        Données issues du suivi d&apos;exploitation FMB Trans-Mobilité Services · dernière saisie le {fmtDateLong(base.derniereDate)}.
      </div>
    </main>
  );
}
