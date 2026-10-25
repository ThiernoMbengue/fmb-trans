"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Save, Trash2, Loader2, AlertCircle, HandCoins, TriangleAlert, Send, Check, X, Clock,
  CheckCircle2, RotateCcw,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  saveAvance, deleteAvance, setAvanceStatut,
  requestAvance, cancelAvanceRequest, resolveAvanceRequest,
} from "./actions";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet)", green: "var(--green)", red: "var(--red)", amber: "var(--amber)", line: "var(--border-line)" };
const inputClass =
  "w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/,/g, " ");
const todayISO = () => new Date().toISOString().slice(0, 10);

const TYPE_LABEL = {
  avance_proprietaire: "Avance au propriétaire",
  depense_imprevue: "Dépense imprévue (véhicule)",
  remboursement: "Remboursement reçu",
};

const STATUS_LABEL = { en_attente: "En attente", approuvee: "Approuvée", refusee: "Refusée" };
const STATUS_COLOR = { en_attente: "amber", approuvee: "green", refusee: "red" };

// Une ligne est « réglée » lorsqu'elle a déjà été prise en compte dans un
// décompte mensuel soldé. Elle sort alors des sommes encore dues, mais reste
// dans l'historique : c'est ce que la suppression ne permettait pas.
const estReglee = (r) => r.statut === "regularisee";

const MOIS_LONG = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const fmtPeriode = (key) => {
  if (!key) return "";
  const [y, m] = key.split("-");
  return `${MOIS_LONG[Number(m) - 1]} ${y}`;
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--text-slate)]">{label}</span>
      {children}
    </label>
  );
}

const emptyForm = () => ({ date: todayISO(), type: "avance_proprietaire", montant: "", note: "" });

export default function AvancesClient({ vehicles, role }) {
  const isAdmin = role === "admin";
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const vehicle = vehicles.find((v) => v.id === vehicleId) || null;

  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [requestForm, setRequestForm] = useState({ montant: "", note: "" });
  const [resolvingId, setResolvingId] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const loadRows = async (vId) => {
    setLoading(true);
    const [avancesRes, requestsRes] = await Promise.all([
      supabase.from("avances").select("*").eq("vehicle_id", vId).order("date", { ascending: false }),
      supabase.from("avance_requests").select("*").eq("vehicle_id", vId).order("created_at", { ascending: false }),
    ]);
    if (!avancesRes.error) setRows(avancesRes.data || []);
    if (!requestsRes.error) setRequests(requestsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (vehicleId) loadRows(vehicleId);
  }, [vehicleId]); // eslint-disable-line

  const onSave = async () => {
    if (!vehicleId || !form.montant) return;
    setSaving(true);
    const res = await saveAvance({ vehicleId, ...form });
    setSaving(false);
    if (res?.error) {
      showToast("Erreur: " + res.error, "error");
    } else {
      showToast("Enregistré");
      setForm(emptyForm());
      await loadRows(vehicleId);
    }
  };

  const onDelete = async (id) => {
    if (!confirm("Supprimer définitivement cette ligne ?\n\nPour une avance déjà récupérée, préférez « Marquer réglée » : la trace de l'argent remis est conservée.")) return;
    setSaving(true);
    const res = await deleteAvance(id);
    setSaving(false);
    if (res?.error) showToast("Erreur: " + res.error, "error");
    else {
      showToast("Supprimé");
      await loadRows(vehicleId);
    }
  };

  const onToggleStatut = async (row) => {
    const vers = estReglee(row) ? "en_cours" : "regularisee";

    if (vers === "regularisee" && row.statut !== "regularisee") {
      const note = prompt(
        "Marquer cette ligne comme réglée.\n\n" +
        "Comment a-t-elle été récupérée ? (facultatif)\n" +
        "Ex : rendue en espèces, compensée, abandonnée…",
        ""
      );
      // prompt renvoie null si l'utilisateur annule.
      if (note === null) return;
      setSaving(true);
      const res = await setAvanceStatut(row.id, vers, note);
      setSaving(false);
      if (res?.error) showToast("Erreur: " + res.error, "error");
      else {
        showToast("Marquée comme réglée");
        await loadRows(vehicleId);
      }
      return;
    }

    if (row.regularisee_auto && !confirm(
      "Cette ligne a été réglée automatiquement par le paiement de " +
      fmtPeriode(row.regularisee_periode) + ".\n\n" +
      "La rouvrir manuellement sera annulé au prochain enregistrement de paiement. Continuer ?"
    )) return;

    setSaving(true);
    const res = await setAvanceStatut(row.id, vers);
    setSaving(false);
    if (res?.error) showToast("Erreur: " + res.error, "error");
    else {
      showToast("Remise en cours");
      await loadRows(vehicleId);
    }
  };

  const onSendRequest = async () => {
    if (!vehicleId || !requestForm.montant) return;
    setSaving(true);
    const res = await requestAvance({ vehicleId, ...requestForm });
    setSaving(false);
    if (res?.error) {
      showToast("Erreur: " + res.error, "error");
    } else {
      showToast("Demande envoyée");
      setRequestForm({ montant: "", note: "" });
      await loadRows(vehicleId);
    }
  };

  const onCancelRequest = async (id) => {
    setSaving(true);
    const res = await cancelAvanceRequest(id);
    setSaving(false);
    if (res?.error) showToast("Erreur: " + res.error, "error");
    else {
      showToast("Demande annulée");
      await loadRows(vehicleId);
    }
  };

  const onResolve = async (id, decision) => {
    setResolvingId(id);
    const res = await resolveAvanceRequest(id, decision);
    setResolvingId(null);
    if (res?.error) showToast("Erreur: " + res.error, "error");
    else {
      showToast(decision === "approuvee" ? "Demande approuvée" : "Demande refusée");
      await loadRows(vehicleId);
    }
  };

  const totals = useMemo(() => {
    const somme = (liste, type) =>
      liste.filter((r) => r.type === type).reduce((s, r) => s + (Number(r.montant) || 0), 0);

    // Seules les lignes encore en cours constituent ce qui reste dû : une
    // ligne réglée a déjà été récupérée sur un paiement.
    const enCours = rows.filter((r) => !estReglee(r));
    const reglees = rows.filter(estReglee);

    const avance = somme(enCours, "avance_proprietaire");
    const depense = somme(enCours, "depense_imprevue");
    const rembourse = somme(enCours, "remboursement");

    return {
      avance,
      depense,
      rembourse,
      soldeDu: avance + depense - rembourse,
      regle: somme(reglees, "avance_proprietaire") + somme(reglees, "depense_imprevue"),
      nbReglees: reglees.length,
    };
  }, [rows]);

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-3xl mx-auto text-sm text-[var(--text-slate-light)]">
        {isAdmin
          ? "Aucun véhicule enregistré. Ajoute d'abord un véhicule dans l'onglet « Véhicules »."
          : "Aucun véhicule ne vous a été attribué pour le moment. Contactez le gestionnaire."}
      </main>
    );
  }

  return (
    <main className="px-6 md:px-10 py-8 max-w-3xl mx-auto">
      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 text-white"
          style={{ backgroundColor: toast.type === "error" ? COLORS.red : COLORS.green }}
        >
          {toast.type === "error" && <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      <h1 className="text-lg font-semibold mb-1" style={{ color: COLORS.ink }}>
        Avances & dépenses imprévues
      </h1>
      <p className="text-xs text-[var(--text-slate-light)] mb-6">
        Argent donné au propriétaire en dehors du versement quotidien, ou dépenses non prévues sur le véhicule.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={vehicleId || ""}
          onChange={(e) => setVehicleId(e.target.value)}
          className="text-sm font-medium bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2"
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
          ))}
        </select>
        {vehicle && (
          <div className="text-xs text-[var(--text-slate-light)]">{vehicle.proprietaire} · chauffeur {vehicle.chauffeur}</div>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="relative bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: COLORS.fleet }} />
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-slate)] pl-2">
            <HandCoins size={14} color={COLORS.fleet} /> Avances au propriétaire
          </div>
          <div className="pl-2 font-mono text-xl font-semibold mt-1" style={{ color: COLORS.ink }}>{fmt(totals.avance)} F</div>
          <div className="pl-2 text-[10px] text-[var(--text-slate-light)] mt-0.5">pas encore récupérées</div>
        </div>
        <div className="relative bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: COLORS.amber }} />
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-slate)] pl-2">
            <TriangleAlert size={14} color={COLORS.amber} /> Dépenses imprévues
          </div>
          <div className="pl-2 font-mono text-xl font-semibold mt-1" style={{ color: COLORS.ink }}>{fmt(totals.depense)} F</div>
        </div>
        <div className="relative bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: COLORS.green }} />
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-slate)] pl-2">
            Reste à récupérer
          </div>
          <div className="pl-2 font-mono text-xl font-semibold mt-1" style={{ color: COLORS.ink }}>{fmt(totals.soldeDu)} F</div>
          <div className="pl-2 text-[10px] text-[var(--text-slate-light)] mt-0.5">lignes en cours uniquement</div>
        </div>
        <div className="relative bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: "var(--text-slate-light)" }} />
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-[var(--text-slate)] pl-2">
            <CheckCircle2 size={14} color="var(--text-slate-light)" /> Déjà réglé
          </div>
          <div className="pl-2 font-mono text-xl font-semibold mt-1" style={{ color: "var(--text-slate)" }}>{fmt(totals.regle)} F</div>
          <div className="pl-2 text-[10px] text-[var(--text-slate-light)] mt-0.5">
            {totals.nbReglees} ligne{totals.nbReglees > 1 ? "s" : ""} récupérée{totals.nbReglees > 1 ? "s" : ""}
          </div>
        </div>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl px-4 py-3 mb-6 border text-xs leading-relaxed text-[var(--text-slate)]"
        style={{
          borderColor: "color-mix(in srgb, var(--fleet) 30%, transparent)",
          backgroundColor: "color-mix(in srgb, var(--fleet) 6%, transparent)",
        }}
      >
        <CheckCircle2 size={15} color={COLORS.fleet} className="mt-0.5 shrink-0" />
        <div>
          <strong style={{ color: COLORS.ink }}>Une ligne réglée sort des sommes dues, mais reste dans l&apos;historique.</strong>{" "}
          Lorsqu&apos;un décompte mensuel est soldé dans l&apos;onglet Paiements, les avances qu&apos;il
          couvrait passent automatiquement en « réglée ». Le marquage manuel sert aux cas réglés
          autrement : rendus en espèces, compensés, abandonnés.
        </div>
      </div>

      {!isAdmin && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6 mb-6">
          <div className="text-sm font-semibold mb-1" style={{ color: COLORS.ink }}>Demander une avance</div>
          <p className="text-xs text-[var(--text-slate-light)] mb-4">
            Ta demande est envoyée au gestionnaire, qui l'approuve ou la refuse.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Montant (FCFA)">
              <input type="number" className={inputClass} value={requestForm.montant} onChange={(e) => setRequestForm({ ...requestForm, montant: e.target.value })} placeholder="0" />
            </Field>
            <div className="md:col-span-2">
              <Field label="Note">
                <input className={inputClass} value={requestForm.note} onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })} placeholder="Ex: besoin urgent, dépannage véhicule…" />
              </Field>
            </div>
          </div>
          <button
            onClick={onSendRequest}
            disabled={saving || !requestForm.montant}
            className="mt-4 flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
            style={{ backgroundColor: COLORS.fleet }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Envoyer la demande
          </button>

          {requests.length > 0 && (
            <div className="mt-6 pt-5 border-t" style={{ borderColor: COLORS.line }}>
              <div className="text-xs font-medium uppercase tracking-wide text-[var(--text-slate)] mb-3">Vos demandes</div>
              <div className="flex flex-col gap-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-[var(--bg-page)] rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <span className="font-mono font-semibold" style={{ color: COLORS.ink }}>{fmt(r.montant)} F</span>
                      {r.note && <span className="text-[var(--text-slate)] ml-2">— {r.note}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: `color-mix(in srgb, ${COLORS[STATUS_COLOR[r.status]]} 14%, transparent)`, color: COLORS[STATUS_COLOR[r.status]] }}
                      >
                        {STATUS_LABEL[r.status]}
                      </span>
                      {r.status === "en_attente" && (
                        <button onClick={() => onCancelRequest(r.id)} className="text-[var(--text-slate-light)] hover:text-[var(--red)]">
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {isAdmin && requests.some((r) => r.status === "en_attente") && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6 mb-6">
          <div className="flex items-center gap-2 text-sm font-semibold mb-4" style={{ color: COLORS.ink }}>
            <Clock size={15} color={COLORS.amber} /> Demandes en attente
          </div>
          <div className="flex flex-col gap-2">
            {requests.filter((r) => r.status === "en_attente").map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 text-sm bg-[var(--bg-page)] rounded-lg px-3 py-2.5">
                <div className="min-w-0">
                  <span className="font-mono font-semibold" style={{ color: COLORS.ink }}>{fmt(r.montant)} F</span>
                  {r.note && <span className="text-[var(--text-slate)] ml-2">— {r.note}</span>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {resolvingId === r.id ? (
                    <Loader2 size={15} className="animate-spin text-[var(--text-slate-light)]" />
                  ) : (
                    <>
                      <button
                        onClick={() => onResolve(r.id, "approuvee")}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white"
                        style={{ backgroundColor: COLORS.green }}
                      >
                        <Check size={13} /> Approuver
                      </button>
                      <button
                        onClick={() => onResolve(r.id, "refusee")}
                        className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-lg text-white"
                        style={{ backgroundColor: COLORS.red }}
                      >
                        <X size={13} /> Refuser
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6">
          <div className="text-sm font-semibold mb-5" style={{ color: COLORS.ink }}>Nouvelle entrée</div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Type">
              <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                <option value="avance_proprietaire">Avance au propriétaire</option>
                <option value="depense_imprevue">Dépense imprévue (véhicule)</option>
                <option value="remboursement">Remboursement reçu</option>
              </select>
            </Field>
            <Field label="Montant (FCFA)">
              <input type="number" className={inputClass} value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="0" />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Note">
              <input className={inputClass} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Ex: réparation moteur, avance pour dépannage familial…" />
            </Field>
          </div>
          <button
            onClick={onSave}
            disabled={saving || !form.montant}
            className="mt-6 flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
            style={{ backgroundColor: COLORS.green }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Enregistrer
          </button>
        </div>
      )}

      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] mt-6 overflow-hidden">
        <div className="px-5 py-4 text-sm font-semibold border-b" style={{ color: COLORS.ink, borderColor: COLORS.line }}>
          Historique
        </div>
        {loading ? (
          <div className="px-5 py-6 text-sm text-[var(--text-slate-light)] flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[var(--text-slate-light)]">Aucune entrée pour ce véhicule.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-page)" }}>
                  {["Date", "Type", "Montant", "Statut", "Note", ...(isAdmin ? [""] : [])].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t"
                    style={{ borderColor: COLORS.line, opacity: estReglee(r) ? 0.55 : 1 }}
                  >
                    <td className="px-5 py-2 font-mono">{r.date}</td>
                    <td className="px-5 py-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor:
                            r.type === "avance_proprietaire" ? "rgba(31,78,120,0.1)" :
                            r.type === "remboursement" ? "rgba(30,122,95,0.1)" : "rgba(201,134,43,0.1)",
                          color: r.type === "avance_proprietaire" ? COLORS.fleet : r.type === "remboursement" ? COLORS.green : COLORS.amber,
                        }}
                      >
                        {TYPE_LABEL[r.type]}
                      </span>
                    </td>
                    <td className="px-5 py-2 font-mono font-semibold">{fmt(r.montant)} F</td>
                    <td className="px-5 py-2 whitespace-nowrap">
                      {estReglee(r) ? (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{ backgroundColor: "rgba(30,122,95,0.12)", color: COLORS.green }}
                          title={
                            r.regularisee_auto
                              ? `Réglée par le paiement de ${fmtPeriode(r.regularisee_periode)}`
                              : r.regularisee_note || "Réglée manuellement"
                          }
                        >
                          <CheckCircle2 size={12} /> Réglée
                        </span>
                      ) : (
                        <span className="text-xs text-[var(--text-slate-light)]">En cours</span>
                      )}
                      {estReglee(r) && (
                        <div className="text-[10px] text-[var(--text-slate-light)] mt-0.5">
                          {r.regularisee_auto
                            ? `paiement ${fmtPeriode(r.regularisee_periode)}`
                            : r.regularisee_note || "manuel"}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-2 text-[var(--text-slate)]">{r.note}</td>
                    {isAdmin && (
                      <td className="px-5 py-2">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => onToggleStatut(r)}
                            disabled={saving}
                            title={estReglee(r) ? "Remettre en cours" : "Marquer comme réglée"}
                            className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg border whitespace-nowrap disabled:opacity-50"
                            style={{
                              borderColor: COLORS.line,
                              color: estReglee(r) ? "var(--text-slate)" : COLORS.green,
                            }}
                          >
                            {estReglee(r) ? <><RotateCcw size={12} /> Rouvrir</> : <><Check size={12} /> Réglée</>}
                          </button>
                          <button
                            onClick={() => onDelete(r.id)}
                            title="Supprimer définitivement"
                            className="text-[var(--text-slate-light)] hover:text-[var(--red)]"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
