"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2 } from "lucide-react";
import { updateVehicle } from "./actions";
import OwnerSelect from "./owner-select";
import DeleteButton from "./delete-button";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet)", green: "var(--green)",
  red: "var(--red)", line: "var(--border-line)",
};

const inputClass =
  "w-full min-w-0 text-sm bg-[var(--bg-page)] border border-[var(--border-line)] rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";

const champsDe = (v) => ({
  marque: v.marque || "",
  immatriculation: v.immatriculation || "",
  proprietaire: v.proprietaire || "",
  chauffeur: v.chauffeur || "",
  taux_chauffeur: v.taux_chauffeur ?? 5000,
});

export default function VehicleRow({ vehicle, owners }) {
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState(champsDe(vehicle));
  const [saving, setSaving] = useState(false);
  const [erreur, setErreur] = useState(null);

  const ouvrir = () => {
    setChamps(champsDe(vehicle));
    setErreur(null);
    setEdition(true);
  };

  const enregistrer = async () => {
    setSaving(true);
    setErreur(null);
    const res = await updateVehicle(vehicle.id, champs);
    setSaving(false);
    if (res?.error) setErreur(res.error);
    else setEdition(false);
  };

  // Entrée valide, Échap annule : on ne quitte pas une ligne au clavier
  // sans savoir ce qu'on a fait.
  const auClavier = (e) => {
    if (e.key === "Enter") { e.preventDefault(); enregistrer(); }
    if (e.key === "Escape") setEdition(false);
  };

  if (!edition) {
    return (
      <tr className="border-t" style={{ borderColor: COLORS.line }}>
        <td className="px-4 py-2.5">{vehicle.marque}</td>
        <td className="px-4 py-2.5 font-mono">{vehicle.immatriculation}</td>
        <td className="px-4 py-2.5">{vehicle.proprietaire || "—"}</td>
        <td className="px-4 py-2.5">
          <OwnerSelect vehicleId={vehicle.id} ownerId={vehicle.owner_id} owners={owners} />
        </td>
        <td className="px-4 py-2.5">{vehicle.chauffeur || "—"}</td>
        <td className="px-4 py-2.5">{vehicle.taux_chauffeur ? `${vehicle.taux_chauffeur} F` : "5000 F"}</td>
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              onClick={ouvrir}
              title="Modifier ce véhicule"
              className="text-[var(--text-slate-light)] hover:text-[var(--fleet)]"
            >
              <Pencil size={14} />
            </button>
            <DeleteButton id={vehicle.id} />
          </div>
        </td>
      </tr>
    );
  }

  return (
    <>
      <tr className="border-t" style={{ borderColor: COLORS.line, backgroundColor: "var(--bg-page)" }}>
        <td className="px-4 py-2">
          <input autoFocus className={inputClass} value={champs.marque} onKeyDown={auClavier}
            onChange={(e) => setChamps({ ...champs, marque: e.target.value })} />
        </td>
        <td className="px-4 py-2">
          <input className={inputClass + " font-mono"} value={champs.immatriculation} onKeyDown={auClavier}
            onChange={(e) => setChamps({ ...champs, immatriculation: e.target.value })} />
        </td>
        <td className="px-4 py-2">
          <input className={inputClass} value={champs.proprietaire} onKeyDown={auClavier}
            onChange={(e) => setChamps({ ...champs, proprietaire: e.target.value })} />
        </td>
        <td className="px-4 py-2">
          <OwnerSelect vehicleId={vehicle.id} ownerId={vehicle.owner_id} owners={owners} />
        </td>
        <td className="px-4 py-2">
          <input className={inputClass} value={champs.chauffeur} onKeyDown={auClavier}
            placeholder="Nom du chauffeur"
            onChange={(e) => setChamps({ ...champs, chauffeur: e.target.value })} />
        </td>
        <td className="px-4 py-2">
          <input type="number" step={500} className={inputClass} value={champs.taux_chauffeur} onKeyDown={auClavier}
            onChange={(e) => setChamps({ ...champs, taux_chauffeur: e.target.value })} />
        </td>
        <td className="px-4 py-2">
          <div className="flex items-center gap-1.5">
            <button
              onClick={enregistrer}
              disabled={saving}
              title="Enregistrer (Entrée)"
              className="flex items-center justify-center w-7 h-7 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: COLORS.green }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
            </button>
            <button
              onClick={() => setEdition(false)}
              title="Annuler (Échap)"
              className="flex items-center justify-center w-7 h-7 rounded-lg border"
              style={{ borderColor: COLORS.line, color: "var(--text-slate)" }}
            >
              <X size={14} />
            </button>
          </div>
        </td>
      </tr>
      <tr style={{ backgroundColor: "var(--bg-page)" }}>
        <td colSpan={7} className="px-4 pb-3">
          {erreur ? (
            <div className="text-xs text-white bg-[var(--red)] rounded-lg px-3 py-2">{erreur}</div>
          ) : (
            <div className="text-[11px] text-[var(--text-slate-light)] leading-relaxed">
              Changer le chauffeur ne modifie pas les saisies déjà enregistrées : chacune garde
              le nom du receveur noté ce jour-là. Le nouveau nom sera proposé par défaut sur les
              prochaines saisies.
            </div>
          )}
        </td>
      </tr>
    </>
  );
}
