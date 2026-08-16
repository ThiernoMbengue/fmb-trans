"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Loader2, AlertCircle, Save, Trash2, FileText, ChevronDown,
  CheckCircle2, Clock, CircleAlert, Bus, Receipt,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { savePaiement, deletePaiement } from "./actions";
import { generateRecuPDF } from "@/lib/pdf/report";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const MONTHS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];

const MODES = [
  { id: "especes", label: "Espèces" },
  { id: "wave", label: "Wave" },
  { id: "orange_money", label: "Orange Money" },
  { id: "virement", label: "Virement" },
  { id: "cheque", label: "Chèque" },
  { id: "autre", label: "Autre" },
];
const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.id, m.label]));

const STATUTS = {
  en_cours: { label: "En cours", color: "slate", icon: Clock },
  a_payer: { label: "À payer", color: "red", icon: CircleAlert },
  partiel: { label: "Partiel", color: "amber", icon: CircleAlert },
  solde: { label: "Soldé", color: "green", icon: CheckCircle2 },
};

const inputClass =
  "w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";

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
const todayISO = () => new Date().toISOString().slice(0, 10);
const moisCourant = () => new Date().toISOString().slice(0, 7);
const fmtPeriode = (key) => {
  const [y, m] = key.split("-");
  return `${MONTHS_LONG[Number(m) - 1]} ${y}`;
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-xs font-medium text-[var(--text-slate)]">{label}</span>
      {children}
    </label>
  );
}

function StatutBadge({ statut }) {
  const s = STATUTS[statut];
  const color = COLORS[s.color];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}
    >
      <Icon size={12} /> {s.label}
    </span>
  );
}

function SummaryCard({ icon: Icon, label, value, caption, accent }) {
  return (
    <div className="surface-card rounded-2xl p-4 flex flex-col gap-3 min-w-0">
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
        <div className="text-xs text-[var(--text-slate)] mt-0.5">{label}</div>
        {caption && <div className="text-[10px] text-[var(--text-slate-light)] mt-1">{caption}</div>}
      </div>
    </div>
  );
}

// Construit les décomptes mensuels d'un véhicule, avec report du solde d'un mois sur l'autre
function construireDecomptes(vehicleId, entries, avances, paiements) {
  const mois = new Set();
  const add = (d) => d && mois.add(d.slice(0, 7));

  const e = entries.filter((r) => r.vehicle_id === vehicleId);
  const a = avances.filter((r) => r.vehicle_id === vehicleId);
  const p = paiements.filter((r) => r.vehicle_id === vehicleId);

  e.forEach((r) => add(r.date));
  a.forEach((r) => add(r.date));
  p.forEach((r) => mois.add(r.periode));

  const cles = [...mois].sort();
  let report = 0;

  return cles.map((periode) => {
    const som = (rows, f) => rows.filter((r) => (r.periode || r.date).slice(0, 7) === periode).reduce((s, r) => s + f(r), 0);

    const netMois = som(e, (r) => Number(r.net) || 0);
    const avancesMois = som(a.filter((r) => r.type === "avance_proprietaire"), (r) => Number(r.montant) || 0);
    const depensesMois = som(a.filter((r) => r.type === "depense_imprevue"), (r) => Number(r.montant) || 0);
    const remboursMois = som(a.filter((r) => r.type === "remboursement"), (r) => Number(r.montant) || 0);

    const netAPayer = netMois - avancesMois - depensesMois + remboursMois;
    const paiementsMois = p.filter((r) => r.periode === periode).sort((x, y) => x.date_paiement.localeCompare(y.date_paiement));
    const paye = paiementsMois.reduce((s, r) => s + (Number(r.montant) || 0), 0);

    const reportEntrant = report;
    const solde = reportEntrant + netAPayer - paye;
    report = solde;

    let statut;
    if (periode === moisCourant()) statut = "en_cours";
    else if (solde <= 0) statut = "solde";
    else if (paye > 0) statut = "partiel";
    else statut = "a_payer";

    return {
      periode,
      periodeLabel: fmtPeriode(periode),
      report: reportEntrant,
      netMois,
      avances: avancesMois,
      depenses: depensesMois,
      remboursements: remboursMois,
      netAPayer,
      paiements: paiementsMois,
      paye,
      solde,
      statut,
    };
  });
}

export default function PaiementsClient({ vehicles, role }) {
  const isAdmin = role === "admin";
  const supabase = createClient();

  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const [entries, setEntries] = useState([]);
  const [avances, setAvances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [openPeriode, setOpenPeriode] = useState(null);
  const [form, setForm] = useState({ datePaiement: todayISO(), montant: "", mode: "especes", reference: "", note: "" });

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === "error" ? 6000 : 3000);
  };

  const charger = async () => {
    setLoading(true);
    const [e, a, p] = await Promise.all([
      supabase.from("entries").select("vehicle_id,date,net"),
      supabase.from("avances").select("vehicle_id,date,type,montant"),
      supabase.from("paiements").select("*").order("date_paiement", { ascending: true }),
    ]);
    if (!e.error) setEntries(e.data || []);
    if (!a.error) setAvances(a.data || []);
    if (!p.error) setPaiements(p.data || []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []); // eslint-disable-line

  // Solde de chaque véhicule : c'est la vue « qui je dois payer »
  const soldesParVehicule = useMemo(
    () =>
      vehicles.map((v) => {
        const d = construireDecomptes(v.id, entries, avances, paiements);
        const dernier = d[d.length - 1];
        const aRegler = d.filter((x) => x.statut === "a_payer" || x.statut === "partiel").length;
        return {
          vehicle: v,
          decomptes: d,
          solde: dernier ? dernier.solde : 0,
          totalPaye: d.reduce((s, x) => s + x.paye, 0),
          totalDu: d.reduce((s, x) => s + x.netAPayer, 0),
          moisARegler: aRegler,
        };
      }),
    [vehicles, entries, avances, paiements]
  );

  const global = useMemo(() => {
    const soldeTotal = soldesParVehicule.reduce((s, v) => s + Math.max(0, v.solde), 0);
    const paye = soldesParVehicule.reduce((s, v) => s + v.totalPaye, 0);
    const du = soldesParVehicule.reduce((s, v) => s + v.totalDu, 0);
    const moisARegler = soldesParVehicule.reduce((s, v) => s + v.moisARegler, 0);
    return { soldeTotal, paye, du, moisARegler };
  }, [soldesParVehicule]);

  const courant = soldesParVehicule.find((v) => v.vehicle.id === vehicleId);
  const decomptes = courant ? [...courant.decomptes].reverse() : [];
  const vehicle = courant?.vehicle;

  const ouvrirFormulaire = (d) => {
    setOpenPeriode(d.periode);
    setForm({
      datePaiement: todayISO(),
      montant: d.solde > 0 ? String(Math.round(d.solde)) : "",
      mode: "especes",
      reference: "",
      note: "",
    });
  };

  const onSave = async (periode) => {
    setSaving(true);
    const res = await savePaiement({ vehicleId, periode, ...form });
    setSaving(false);
    if (res?.error) showToast("Erreur : " + res.error, "error");
    else {
      showToast("Paiement enregistré");
      setOpenPeriode(null);
      await charger();
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Supprimer ce paiement ? Le solde du mois sera recalculé.")) return;
    setSaving(true);
    const res = await deletePaiement(id);
    setSaving(false);
    if (res?.error) showToast("Erreur : " + res.error, "error");
    else {
      showToast("Paiement supprimé");
      await charger();
    }
  };

  const telechargerRecu = (d) => {
    generateRecuPDF(vehicle, d, d.paiements).save(
      `recu_${vehicle.immatriculation}_${d.periode}.pdf`
    );
  };

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-5xl mx-auto text-sm text-[var(--text-slate-light)]">
        {isAdmin
          ? "Aucun véhicule enregistré. Ajoute d'abord un véhicule dans l'onglet « Véhicules »."
          : "Aucun véhicule ne vous a été attribué pour le moment. Contactez le gestionnaire."}
      </main>
    );
  }

  return (
    <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto animate-fade-up">
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 text-white max-w-[90vw]"
          style={{ backgroundColor: toast.type === "error" ? COLORS.red : COLORS.green }}
        >
          {toast.type === "error" && <AlertCircle size={16} className="shrink-0" />}
          {toast.msg}
        </div>
      )}

      <h1 className="font-display text-2xl font-bold tracking-tight text-[var(--text-ink)]">
        {isAdmin ? "Paiements aux propriétaires" : "Mes paiements reçus"}
      </h1>
      <p className="text-sm text-[var(--text-slate)] mt-1.5 mb-6 max-w-2xl leading-relaxed">
        {isAdmin
          ? "Chaque mois génère un décompte par véhicule : net des versements, avances déjà remises et dépenses avancées. Le solde non réglé est automatiquement reporté sur le mois suivant."
          : "Le détail de ce qui vous est dû chaque mois, ce qui a été versé, et le solde restant. Chaque règlement donne lieu à un reçu téléchargeable."}
      </p>

      {loading ? (
        <div className="flex items-center gap-2 text-[var(--text-slate-light)] text-sm py-10">
          <Loader2 size={16} className="animate-spin" /> Chargement des décomptes…
        </div>
      ) : (
        <>
          {/* Vue d'ensemble */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <SummaryCard
              icon={CircleAlert}
              label={isAdmin ? "Reste à payer" : "Reste à recevoir"}
              value={`${fmt(global.soldeTotal)} F`}
              caption={`${global.moisARegler} mois à régler`}
              accent={global.soldeTotal > 0 ? COLORS.red : COLORS.green}
            />
            <SummaryCard
              icon={CheckCircle2}
              label="Total déjà versé"
              value={`${fmt(global.paye)} F`}
              accent={COLORS.green}
            />
            <SummaryCard
              icon={Wallet}
              label="Total dû depuis le début"
              value={`${fmt(global.du)} F`}
              accent={COLORS.fleet}
            />
            <SummaryCard
              icon={Bus}
              label="Véhicules suivis"
              value={vehicles.length}
              accent={COLORS.purple}
            />
          </div>

          {/* Solde par véhicule */}
          {vehicles.length > 1 && (
            <div className="surface-card rounded-2xl overflow-hidden mb-6">
              <div className="px-5 py-4 text-sm font-semibold border-b" style={{ color: COLORS.ink, borderColor: COLORS.line }}>
                Solde par véhicule
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm font-figures">
                  <thead>
                    <tr style={{ backgroundColor: "var(--bg-page)" }}>
                      {["Véhicule", "Propriétaire", "Total dû", "Versé", "Solde"].map((h) => (
                        <th key={h} className="text-left px-5 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {soldesParVehicule.map((v) => (
                      <tr
                        key={v.vehicle.id}
                        className="border-t cursor-pointer hover:bg-[var(--bg-page)]"
                        style={{ borderColor: COLORS.line }}
                        onClick={() => setVehicleId(v.vehicle.id)}
                      >
                        <td className="px-5 py-2.5 font-sans">
                          {v.vehicle.marque}
                          <span className="text-[11px] text-[var(--text-slate-light)] ml-1.5">{v.vehicle.immatriculation}</span>
                        </td>
                        <td className="px-5 py-2.5 font-sans text-[var(--text-slate)]">{v.vehicle.proprietaire || "—"}</td>
                        <td className="px-5 py-2.5">{fmt(v.totalDu)}</td>
                        <td className="px-5 py-2.5">{fmt(v.totalPaye)}</td>
                        <td className="px-5 py-2.5 font-semibold" style={{ color: v.solde > 0 ? COLORS.red : COLORS.green }}>
                          {fmt(v.solde)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sélecteur de véhicule */}
          <div className="flex items-center gap-2.5 bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-xl px-3 py-2 mb-4 w-fit max-w-full">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 16%, transparent)" }}>
              <Bus size={15} color={COLORS.fleet} />
            </div>
            <div className="relative min-w-0">
              <select
                value={vehicleId || ""}
                onChange={(e) => { setVehicleId(e.target.value); setOpenPeriode(null); }}
                className="appearance-none bg-transparent text-sm font-semibold pr-6 focus:outline-none truncate"
                style={{ color: COLORS.ink }}
              >
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
                ))}
              </select>
              <ChevronDown size={13} className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-[var(--text-slate-light)]" />
            </div>
          </div>

          {/* Décomptes mensuels */}
          {decomptes.length === 0 ? (
            <div className="surface-card rounded-2xl p-8 text-center text-sm text-[var(--text-slate-light)]">
              Aucun décompte pour ce véhicule — aucune saisie enregistrée pour l&apos;instant.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {decomptes.map((d) => (
                <div key={d.periode} className="surface-card rounded-2xl overflow-hidden">
                  <div className="px-5 py-4 flex items-center justify-between flex-wrap gap-3 border-b" style={{ borderColor: COLORS.line }}>
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-sm font-semibold capitalize" style={{ color: COLORS.ink }}>
                        {d.periodeLabel}
                      </div>
                      <StatutBadge statut={d.statut} />
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-[10px] uppercase tracking-wide text-[var(--text-slate)]">Solde</div>
                        <div
                          className="font-figures text-base font-semibold"
                          style={{ color: d.solde > 0 ? COLORS.red : d.solde < 0 ? COLORS.amber : COLORS.green }}
                        >
                          {fmt(d.solde)} F
                        </div>
                      </div>
                      {d.paiements.length > 0 && (
                        <button
                          onClick={() => telechargerRecu(d)}
                          title="Télécharger le reçu"
                          className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border"
                          style={{ borderColor: COLORS.line, color: COLORS.fleet }}
                        >
                          <FileText size={13} /> Reçu
                        </button>
                      )}
                      {isAdmin && d.solde > 0 && (
                        <button
                          onClick={() => (openPeriode === d.periode ? setOpenPeriode(null) : ouvrirFormulaire(d))}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
                          style={{ backgroundColor: COLORS.green }}
                        >
                          <Receipt size={13} /> Payer
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Détail du décompte */}
                  <div className="px-5 py-4 text-sm font-figures">
                    {[
                      ["Report du mois précédent", d.report, d.report >= 0 ? "+" : ""],
                      ["Net des versements du mois", d.netMois, "+"],
                      ["Avances déjà remises", -d.avances, ""],
                      ["Dépenses avancées par FMB", -d.depenses, ""],
                      ["Remboursements reçus", d.remboursements, "+"],
                    ]
                      .filter(([, v]) => v !== 0)
                      .map(([label, v]) => (
                        <div key={label} className="flex items-center justify-between py-1">
                          <span className="font-sans text-[var(--text-slate)]">{label}</span>
                          <span style={{ color: v < 0 ? COLORS.red : COLORS.ink }}>
                            {v < 0 ? "− " : "+ "}{fmt(Math.abs(v))}
                          </span>
                        </div>
                      ))}
                    <div className="flex items-center justify-between py-2 mt-1 border-t font-semibold" style={{ borderColor: COLORS.line }}>
                      <span className="font-sans" style={{ color: COLORS.ink }}>Net à payer</span>
                      <span style={{ color: COLORS.ink }}>{fmt(d.netAPayer)} F</span>
                    </div>

                    {d.paiements.length > 0 && (
                      <div className="mt-2 pt-2 border-t" style={{ borderColor: COLORS.line }}>
                        {d.paiements.map((p) => (
                          <div key={p.id} className="flex items-center justify-between gap-2 py-1.5">
                            <div className="min-w-0 font-sans text-[var(--text-slate)] text-xs">
                              <span className="font-figures">{p.date_paiement}</span> · {MODE_LABEL[p.mode] || p.mode}
                              {p.reference && <span className="text-[var(--text-slate-light)]"> · réf. {p.reference}</span>}
                              <span className="text-[var(--text-slate-light)]"> · {p.numero_recu}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span style={{ color: COLORS.green }}>− {fmt(p.montant)}</span>
                              {isAdmin && (
                                <button onClick={() => onDelete(p.id)} className="text-[var(--text-slate-light)] hover:text-[var(--red)]">
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Formulaire de paiement */}
                  {isAdmin && openPeriode === d.periode && (
                    <div className="px-5 py-4 border-t" style={{ borderColor: COLORS.line, backgroundColor: "var(--bg-page)" }}>
                      <div className="text-sm font-semibold mb-3" style={{ color: COLORS.ink }}>
                        Enregistrer un versement — {d.periodeLabel}
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        <Field label="Date du versement">
                          <input type="date" className={inputClass} value={form.datePaiement} onChange={(e) => setForm({ ...form, datePaiement: e.target.value })} />
                        </Field>
                        <Field label="Montant (FCFA)">
                          <input type="number" className={inputClass} value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="0" />
                        </Field>
                        <Field label="Mode de paiement">
                          <select className={inputClass} value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                            {MODES.map((m) => (
                              <option key={m.id} value={m.id}>{m.label}</option>
                            ))}
                          </select>
                        </Field>
                        <Field label="Référence (n° Wave, OM…)">
                          <input className={inputClass} value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Optionnel" />
                        </Field>
                      </div>
                      <div className="mt-3">
                        <Field label="Note">
                          <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Optionnel" />
                        </Field>
                      </div>
                      <div className="flex items-center gap-2 mt-4">
                        <button
                          onClick={() => onSave(d.periode)}
                          disabled={saving || !form.montant}
                          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
                          style={{ backgroundColor: COLORS.green }}
                        >
                          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                          Enregistrer
                        </button>
                        <button
                          onClick={() => setOpenPeriode(null)}
                          className="text-xs text-[var(--text-slate-light)] underline underline-offset-2"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <div className="text-xs text-[var(--text-slate-light)] mt-8 pb-10 leading-relaxed">
        Un solde positif signifie qu&apos;il reste à verser au propriétaire ; un solde négatif indique
        un trop-perçu, qui se régularise automatiquement sur le mois suivant.
      </div>
    </main>
  );
}
