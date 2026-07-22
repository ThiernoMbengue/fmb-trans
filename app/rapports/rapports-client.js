"use client";

import { useState } from "react";
import { FileText, Loader2, AlertCircle, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { generateVersementsPDF, generateAvancesPDF, generateDecomptePDF } from "@/lib/pdf/report";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet)", green: "var(--green)", red: "var(--red)" };
const inputClass =
  "w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";
const todayISO = () => new Date().toISOString().slice(0, 10);
const firstOfMonthISO = () => {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
};

const DOC_TYPES = [
  { id: "versements", label: "Relevé de versements", desc: "Détail journalier des recettes, dépenses et net versé au propriétaire." },
  { id: "avances", label: "Relevé des avances", desc: "Avances, dépenses imprévues et remboursements sur la période." },
  { id: "decompte", label: "Décompte de solde", desc: "Combine versements et avances pour calculer le solde final." },
];

export default function RapportsClient({ vehicles }) {
  const supabase = createClient();
  const [vehicleId, setVehicleId] = useState(vehicles[0]?.id || null);
  const [dateDebut, setDateDebut] = useState(firstOfMonthISO());
  const [dateFin, setDateFin] = useState(todayISO());
  const [docType, setDocType] = useState("versements");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState(null);

  const vehicle = vehicles.find((v) => v.id === vehicleId);

  const showToast = (msg, type = "error") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const generate = async () => {
    if (!vehicleId || !dateDebut || !dateFin) return;
    if (dateDebut > dateFin) {
      showToast("La date de début doit précéder la date de fin");
      return;
    }
    setLoading(true);
    try {
      const filename = `${docType}_${vehicle.immatriculation}_${dateDebut}_${dateFin}.pdf`;

      if (docType === "versements") {
        const { data, error } = await supabase
          .from("entries").select("*").eq("vehicle_id", vehicleId)
          .gte("date", dateDebut).lte("date", dateFin).order("date", { ascending: true });
        if (error) throw error;
        if (!data.length) return showToast("Aucune saisie sur cette période");
        generateVersementsPDF(vehicle, data, dateDebut, dateFin).save(filename);
      }

      if (docType === "avances") {
        const { data, error } = await supabase
          .from("avances").select("*").eq("vehicle_id", vehicleId)
          .gte("date", dateDebut).lte("date", dateFin).order("date", { ascending: true });
        if (error) throw error;
        if (!data.length) return showToast("Aucune avance sur cette période");
        generateAvancesPDF(vehicle, data, dateDebut, dateFin).save(filename);
      }

      if (docType === "decompte") {
        const [entriesRes, avancesRes] = await Promise.all([
          supabase.from("entries").select("*").eq("vehicle_id", vehicleId).gte("date", dateDebut).lte("date", dateFin).order("date", { ascending: true }),
          supabase.from("avances").select("*").eq("vehicle_id", vehicleId).gte("date", dateDebut).lte("date", dateFin).order("date", { ascending: true }),
        ]);
        if (entriesRes.error) throw entriesRes.error;
        if (avancesRes.error) throw avancesRes.error;
        if (!entriesRes.data.length && !avancesRes.data.length) return showToast("Aucune donnée sur cette période");
        generateDecomptePDF(vehicle, entriesRes.data, avancesRes.data, dateDebut, dateFin).save(filename);
      }
    } catch (e) {
      showToast("Erreur lors de la génération : " + e.message);
    } finally {
      setLoading(false);
    }
  };

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
          style={{ backgroundColor: COLORS.red }}
        >
          <AlertCircle size={16} /> {toast.msg}
        </div>
      )}

      <h1 className="text-lg font-semibold mb-1" style={{ color: COLORS.ink }}>
        Générer un document
      </h1>
      <p className="text-xs text-[var(--text-slate-light)] mb-6">
        Choisis un véhicule, une période et un type de document. Le PDF est généré à partir des données saisies.
      </p>

      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-slate)]">Véhicule</span>
            <select className={inputClass} value={vehicleId || ""} onChange={(e) => setVehicleId(e.target.value)}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-slate)]">Du</span>
            <input type="date" className={inputClass} value={dateDebut} onChange={(e) => setDateDebut(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-slate)]">Au</span>
            <input type="date" className={inputClass} value={dateFin} onChange={(e) => setDateFin(e.target.value)} />
          </label>
        </div>

        <div className="flex flex-col gap-2.5 mb-6">
          {DOC_TYPES.map((t) => (
            <label
              key={t.id}
              className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer"
              style={{ borderColor: docType === t.id ? COLORS.fleet : "var(--border-line)", backgroundColor: docType === t.id ? "rgba(31,78,120,0.06)" : "transparent" }}
            >
              <input type="radio" name="docType" className="mt-1" checked={docType === t.id} onChange={() => setDocType(t.id)} />
              <div>
                <div className="text-sm font-medium" style={{ color: COLORS.ink }}>{t.label}</div>
                <div className="text-xs text-[var(--text-slate-light)]">{t.desc}</div>
              </div>
            </label>
          ))}
        </div>

        <button
          onClick={generate}
          disabled={loading}
          className="flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
          style={{ backgroundColor: COLORS.green }}
        >
          {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          Générer le PDF
        </button>
      </div>

      <div className="flex items-start gap-2 text-xs text-[var(--text-slate-light)] mt-4">
        <FileText size={14} className="mt-0.5 shrink-0" />
        Le document est généré directement dans ton navigateur et téléchargé, rien n'est stocké côté serveur.
      </div>
    </main>
  );
}
