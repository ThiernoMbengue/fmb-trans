"use client";

import { useState, useRef } from "react";
import { addVehicle } from "./actions";
import { Save, Loader2 } from "lucide-react";

const inputClass =
  "w-full text-sm bg-white border border-slate-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1F4E78]/30";

export default function VehicleForm() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const formRef = useRef(null);

  const onSubmit = async (formData) => {
    setSaving(true);
    setError(null);
    const res = await addVehicle(formData);
    setSaving(false);
    if (res?.error) setError(res.error);
    else formRef.current?.reset();
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="text-sm font-semibold mb-4" style={{ color: "#14324D" }}>
        Ajouter un véhicule
      </div>
      {error && <div className="text-xs text-white bg-[#B3452C] rounded-lg px-3 py-2 mb-3">{error}</div>}
      <form ref={formRef} action={onSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <input name="marque" placeholder="Marque / modèle" required className={inputClass} />
        <input name="immatriculation" placeholder="Immatriculation" required className={inputClass} />
        <input name="proprietaire" placeholder="Propriétaire" className={inputClass} />
        <input name="chauffeur" placeholder="Chauffeur" className={inputClass} />
        <button
          type="submit"
          disabled={saving}
          className="md:col-span-4 mt-1 flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg text-white disabled:opacity-60"
          style={{ backgroundColor: "#1F4E78" }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Enregistrer
        </button>
      </form>
    </div>
  );
}
