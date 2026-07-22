"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Pencil, Trash2, X, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveEntry, deleteEntry } from "./actions";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet)", green: "var(--green)", red: "var(--red)", line: "var(--border-line)" };
const inputClass =
  "w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";
const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/,/g, " ");
const todayISO = () => new Date().toISOString().slice(0, 10);

function Field({ label, children, hint }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-[var(--text-slate)]">{label}</span>
      {children}
      {hint && <span className="text-[11px] text-[var(--text-slate-light)]">{hint}</span>}
    </label>
  );
}

const emptyForm = (chauffeur, date) => ({
  date, receveur: chauffeur || "", recette: "", gazoil: "", gazoilNote: "Gazoil",
  autres: "", autresNote: "", totalCaisse: "", net: "",
});

export default function SaisieClient({ vehicles }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const vehicle = vehicles.find((v) => v.id === vehicleId) || null;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(null);
  const [editingDate, setEditingDate] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  };

  const loadEntries = async (vId) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entries")
      .select("*")
      .eq("vehicle_id", vId)
      .order("date", { ascending: true });
    if (!error) setEntries(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (vehicleId) loadEntries(vehicleId);
  }, [vehicleId]); // eslint-disable-line

  const lastDate = entries[entries.length - 1]?.date;

  useEffect(() => {
    if (!vehicle || editingDate) return;
    let nextDate = todayISO();
    if (lastDate) {
      const d = new Date(lastDate + "T00:00:00");
      d.setDate(d.getDate() + 1);
      nextDate = d.toISOString().slice(0, 10);
    }
    setForm(emptyForm(vehicle.chauffeur, nextDate));
  }, [vehicleId, vehicle, lastDate]); // eslint-disable-line

  const updateForm = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      const recette = Number(next.recette) || 0;
      const gazoil = Number(next.gazoil) || 0;
      const autres = Number(next.autres) || 0;
      if (patch.recette !== undefined || patch.gazoil !== undefined) {
        next.totalCaisse = String(recette - gazoil);
      }
      if (patch.recette !== undefined || patch.gazoil !== undefined || patch.autres !== undefined) {
        next.net = String((Number(next.totalCaisse) || 0) - autres);
      }
      return next;
    });
  };

  const startEdit = (e) => {
    setEditingDate(e.date);
    setForm({
      date: e.date, receveur: e.receveur || "", recette: String(e.recette ?? ""),
      gazoil: String(e.gazoil ?? ""), gazoilNote: e.gazoil_note || "",
      autres: String(e.autres ?? ""), autresNote: e.autres_note || "",
      totalCaisse: String(e.total_caisse ?? ""), net: String(e.net ?? ""),
    });
  };

  const cancelEdit = () => {
    setEditingDate(null);
    setForm(emptyForm(vehicle?.chauffeur, todayISO()));
  };

  const onSave = async () => {
    if (!vehicleId || !form?.date) return;
    setSaving(true);
    const res = await saveEntry({ vehicleId, ...form });
    setSaving(false);
    if (res?.error) {
      showToast("Erreur: " + res.error, "error");
    } else {
      showToast(editingDate ? "Saisie mise à jour" : "Versement enregistré");
      setEditingDate(null);
      await loadEntries(vehicleId);
      const d = new Date(form.date + "T00:00:00");
      d.setDate(d.getDate() + 1);
      setForm(emptyForm(vehicle?.chauffeur, d.toISOString().slice(0, 10)));
    }
  };

  const onDelete = async (date) => {
    if (!vehicleId) return;
    setSaving(true);
    const res = await deleteEntry(vehicleId, date);
    setSaving(false);
    if (res?.error) showToast("Erreur: " + res.error, "error");
    else {
      showToast("Saisie supprimée");
      await loadEntries(vehicleId);
      if (editingDate === date) cancelEdit();
    }
  };

  const recent = useMemo(() => [...entries].reverse().slice(0, 8), [entries]);

  if (!vehicles.length) {
    return (
      <main className="px-6 md:px-10 py-8 max-w-3xl mx-auto text-sm text-[var(--text-slate-light)]">
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

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <select
          value={vehicleId || ""}
          onChange={(e) => { setVehicleId(e.target.value); setEditingDate(null); }}
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

      {form && (
        <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6">
          <div className="flex items-center justify-between mb-5">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>
              {editingDate ? `Modifier la saisie du ${editingDate}` : "Nouvelle saisie du jour"}
            </div>
            {editingDate && (
              <button onClick={cancelEdit} className="text-xs text-[var(--text-slate-light)] flex items-center gap-1">
                <X size={13} /> Annuler
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label="Date">
              <input type="date" className={inputClass} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
            </Field>
            <Field label="Nom du receveur / chauffeur">
              <input className={inputClass} value={form.receveur} onChange={(e) => setForm({ ...form, receveur: e.target.value })} />
            </Field>
            <Field label="Recette totale (FCFA)">
              <input type="number" className={inputClass} value={form.recette} onChange={(e) => updateForm({ recette: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Field label="Gazoil (FCFA)">
              <input type="number" className={inputClass} value={form.gazoil} onChange={(e) => updateForm({ gazoil: e.target.value })} />
            </Field>
            <Field label="Remarque gazoil">
              <input className={inputClass} value={form.gazoilNote} onChange={(e) => setForm({ ...form, gazoilNote: e.target.value })} />
            </Field>
            <Field label="Autres dépenses (FCFA)">
              <input type="number" className={inputClass} value={form.autres} onChange={(e) => updateForm({ autres: e.target.value })} />
            </Field>
            <Field label="Remarque autres dépenses">
              <input className={inputClass} value={form.autresNote} onChange={(e) => setForm({ ...form, autresNote: e.target.value })} />
            </Field>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Field label="Total caisse (FCFA)" hint="Calculé automatiquement, modifiable">
              <input type="number" className={inputClass} value={form.totalCaisse} onChange={(e) => setForm({ ...form, totalCaisse: e.target.value })} />
            </Field>
            <Field label="Net versé au propriétaire (FCFA)" hint="Calculé automatiquement, modifiable">
              <input type="number" className={inputClass + " font-semibold"} value={form.net} onChange={(e) => setForm({ ...form, net: e.target.value })} />
            </Field>
          </div>

          <button
            onClick={onSave}
            disabled={saving || !form.date}
            className="mt-6 flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
            style={{ backgroundColor: COLORS.green }}
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            {editingDate ? "Mettre à jour" : "Enregistrer le versement"}
          </button>
        </div>
      )}

      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] mt-6 overflow-hidden">
        <div className="px-5 py-4 text-sm font-semibold border-b" style={{ color: COLORS.ink, borderColor: COLORS.line }}>
          Dernières saisies
        </div>
        {loading ? (
          <div className="px-5 py-6 text-sm text-[var(--text-slate-light)] flex items-center gap-2">
            <Loader2 size={14} className="animate-spin" /> Chargement…
          </div>
        ) : recent.length === 0 ? (
          <div className="px-5 py-6 text-sm text-[var(--text-slate-light)]">Aucune saisie pour ce véhicule.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-mono">
              <thead>
                <tr style={{ backgroundColor: "var(--bg-page)" }}>
                  {["Date", "Recette", "Gazoil", "Autres", "Net versé", ""].map((h) => (
                    <th key={h} className="text-left px-5 py-2.5 font-sans font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recent.map((e) => (
                  <tr key={e.date} className="border-t" style={{ borderColor: COLORS.line, color: e.recette === 0 ? "var(--text-slate-light)" : COLORS.ink }}>
                    <td className="px-5 py-2">{e.date}</td>
                    <td className="px-5 py-2">{fmt(e.recette)}</td>
                    <td className="px-5 py-2">{fmt(e.gazoil)}</td>
                    <td className="px-5 py-2">{fmt(e.autres)}</td>
                    <td className="px-5 py-2 font-semibold">{fmt(e.net)}</td>
                    <td className="px-5 py-2">
                      <div className="flex items-center gap-2 font-sans">
                        <button onClick={() => startEdit(e)} className="text-[var(--text-slate-light)] hover:text-[var(--fleet)]"><Pencil size={14} /></button>
                        <button onClick={() => onDelete(e.date)} className="text-[var(--text-slate-light)] hover:text-[var(--red)]"><Trash2 size={14} /></button>
                      </div>
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
