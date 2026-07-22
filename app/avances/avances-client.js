"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Trash2, Loader2, AlertCircle, HandCoins, TriangleAlert } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveAvance, deleteAvance } from "./actions";

const COLORS = { ink: "#14324D", fleet: "#1F4E78", green: "#1E7A5F", red: "#B3452C", amber: "#C9862B", line: "#E4E9EF" };
const inputClass =
  "w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E78]/30";
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/,/g, " ");
const todayISO = () => new Date().toISOString().slice(0, 10);

const TYPE_LABEL = {
  avance_proprietaire: "Avance au propriétaire",
  depense_imprevue: "Dépense imprévue (véhicule)",
};

function Field({ label, children }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}

const emptyForm = () => ({ date: todayISO(), type: "avance_proprietaire", montant: "", note: "" });

export default function AvancesClient({ vehicles }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const vehicle = vehicles.find((v) => v.id === vehicleId) || null;

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(emptyForm());

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const loadRows = async (vId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("avances")
      .select("*")
      .eq("vehicle_id", vId)
      .order("date", { ascending: false });
    if (!error) setRows(data || []);
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
    setSaving(true);
    const res = await deleteAvance(id);
    setSaving(false);
    if (res?.error) showToast("Erreur: " + res.error, "error");
    else {
      showToast("Supprimé");
      await loadRows(vehicleId);
    }
  };

  const totals = useMemo(() => {
    const avance = rows.filter((r) => r.type === "avance_proprietaire").reduce((s, r) => s + (Number(r.montant) || 0), 0);
    const depense = rows.filter((r) => r.type === "depense_imprevue").reduce((s, r) => s + (Number(r.montant) || 0), 0);
    return { avance, depense };
  }, [rows]);

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-3xl mx-auto text-sm text-slate-400">
        Aucun véhicule enregistré. Ajoute d'abord un véhicule dans l'onglet « Véhicules ».
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
      <p className="text-xs text-slate-400 mb-6">
        Argent donné au propriétaire en dehors du versement quotidien, ou dépenses non prévues sur le véhicule.
      </p>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={vehicleId || ""}
          onChange={(e) => setVehicleId(e.target.value)}
          className="text-sm font-medium bg-white border border-slate-200 rounded-lg px-3 py-2"
        >
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
          ))}
        </select>
        {vehicle && (
          <div className="text-xs text-slate-400">{vehicle.proprietaire} · chauffeur {vehicle.chauffeur}</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="relative bg-white rounded-xl border border-slate-200 p-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: COLORS.fleet }} />
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 pl-2">
            <HandCoins size={14} color={COLORS.fleet} /> Avances au propriétaire
          </div>
          <div className="pl-2 font-mono text-xl font-semibold mt-1" style={{ color: COLORS.ink }}>{fmt(totals.avance)} F</div>
        </div>
        <div className="relative bg-white rounded-xl border border-slate-200 p-4 overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1" style={{ backgroundColor: COLORS.amber }} />
          <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-slate-500 pl-2">
            <TriangleAlert size={14} color={COLORS.amber} /> Dépenses imprévues
          </div>
          <div className="pl-2 font-mono text-xl font-semibold mt-1" style={{ color: COLORS.ink }}>{fmt(totals.depense)} F</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-5 md:p-6">
        <div className="text-sm font-semibold mb-5" style={{ color: COLORS.ink }}>Nouvelle entrée</div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Date">
            <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </Field>
          <Field label="Type">
            <select className={inputClass} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="avance_proprietaire">Avance au propriétaire</option>
              <option value="depense_imprevue">Dépense imprévue (véhicule)</option>
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

      <div className="bg-white rounded-xl border border-slate-200 mt-6 overflow-hidden">
        <div className="px-5 py-4 text-sm font-semibold border-b" style={{ color: COLORS.ink, borderColor: COLORS.line }}>
          Historique
        </div>
        {loading ? (
          <div className="px-5 py-6 text-sm text-slate-400 flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Chargement…
          </div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-6 text-sm text-slate-400">Aucune entrée pour ce véhicule.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#F5F7FA" }}>
                  {["Date", "Type", "Montant", "Note", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-medium text-xs uppercase tracking-wide text-slate-500">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t" style={{ borderColor: COLORS.line }}>
                    <td className="px-5 py-2 font-mono">{r.date}</td>
                    <td className="px-5 py-2">
                      <span
                        className="text-xs font-medium px-2 py-0.5 rounded-full"
                        style={{
                          backgroundColor: r.type === "avance_proprietaire" ? "#1F4E7815" : "#C9862B15",
                          color: r.type === "avance_proprietaire" ? COLORS.fleet : COLORS.amber,
                        }}
                      >
                        {TYPE_LABEL[r.type]}
                      </span>
                    </td>
                    <td className="px-5 py-2 font-mono font-semibold">{fmt(r.montant)} F</td>
                    <td className="px-5 py-2 text-slate-500">{r.note}</td>
                    <td className="px-5 py-2">
                      <button onClick={() => onDelete(r.id)} className="text-slate-400 hover:text-[#B3452C]"><Trash2 size={14} /></button>
                    </td>
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
