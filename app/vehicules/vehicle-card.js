"use client";

import { useState } from "react";
import { Pencil, Check, X, Loader2, Trash2, Bus, AlertCircle } from "lucide-react";
import { updateVehicle, deleteVehicle } from "./actions";
import OwnerSelect from "./owner-select";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet)", green: "var(--green)",
  red: "var(--red)", amber: "var(--amber)", line: "var(--border-line)",
};

const inputClass =
  "w-full min-w-0 text-sm bg-[var(--bg-page)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";

const champsDe = (v) => ({
  marque: v.marque || "",
  immatriculation: v.immatriculation || "",
  proprietaire: v.proprietaire || "",
  chauffeur: v.chauffeur || "",
  taux_chauffeur: v.taux_chauffeur ?? 5000,
});

function Champ({ label, children, aide }) {
  return (
    <label className="flex flex-col gap-1.5 min-w-0">
      <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-slate)]">{label}</span>
      {children}
      {aide && <span className="text-[10px] text-[var(--text-slate-light)] leading-snug">{aide}</span>}
    </label>
  );
}

function Lecture({ label, valeur, children }) {
  return (
    <div className="min-w-0">
      <div className="text-[11px] uppercase tracking-wide text-[var(--text-slate)] mb-1">{label}</div>
      {children || (
        <div className="text-sm break-words" style={{ color: valeur ? COLORS.ink : "var(--text-slate-light)" }}>
          {valeur || "—"}
        </div>
      )}
    </div>
  );
}

export default function VehicleCard({ vehicle, owners }) {
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState(champsDe(vehicle));
  const [saving, setSaving] = useState(false);
  const [suppression, setSuppression] = useState(false);
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

  const supprimer = async () => {
    setSuppression(false);
    setSaving(true);
    const res = await deleteVehicle(vehicle.id);
    setSaving(false);
    if (res?.error) setErreur(res.error);
  };

  // Entrée valide, Échap annule : on ne quitte pas une fiche au clavier
  // sans savoir ce qu'on a fait.
  const auClavier = (e) => {
    if (e.key === "Enter") { e.preventDefault(); enregistrer(); }
    if (e.key === "Escape") setEdition(false);
  };

  return (
    <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] overflow-hidden">
      <div
        className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-b"
        style={{ borderColor: COLORS.line, backgroundColor: "var(--bg-page)" }}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "color-mix(in srgb, var(--fleet) 16%, transparent)" }}
          >
            <Bus size={15} color={COLORS.fleet} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: COLORS.ink }}>
              {vehicle.marque}
            </div>
            <div className="text-xs font-mono text-[var(--text-slate-light)]">
              {vehicle.immatriculation}
            </div>
          </div>
        </div>

        {!edition && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={ouvrir}
              className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg border"
              style={{ borderColor: COLORS.line, color: COLORS.fleet }}
            >
              <Pencil size={13} /> Modifier
            </button>
            <button
              onClick={() => setSuppression(true)}
              disabled={saving}
              title="Supprimer ce véhicule"
              className="flex items-center justify-center w-8 h-8 rounded-lg border disabled:opacity-40"
              style={{ borderColor: COLORS.line, color: "var(--text-slate-light)" }}
            >
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        )}
      </div>

      {erreur && (
        <div className="mx-4 sm:mx-5 mt-4 text-xs text-white bg-[var(--red)] rounded-lg px-3 py-2">{erreur}</div>
      )}

      {/* Confirmation de suppression, dans la carte plutôt qu'en pop-up
          système : on voit quel véhicule est concerné. */}
      {suppression && (
        <div
          className="m-4 sm:m-5 rounded-xl border px-4 py-3"
          style={{
            borderColor: `color-mix(in srgb, ${COLORS.red} 35%, transparent)`,
            backgroundColor: `color-mix(in srgb, ${COLORS.red} 7%, transparent)`,
          }}
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle size={16} color={COLORS.red} className="mt-0.5 shrink-0" />
            <div className="text-xs leading-relaxed text-[var(--text-slate)]">
              <strong style={{ color: COLORS.ink }}>
                Supprimer {vehicle.marque} — {vehicle.immatriculation} ?
              </strong>
              <div className="mt-1">
                Toutes ses saisies, avances et paiements seront supprimés avec lui, et
                définitivement. Pour simplement arrêter de l&apos;exploiter, mieux vaut le garder :
                son historique reste utile aux rapports.
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={supprimer}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: COLORS.red }}
            >
              Supprimer définitivement
            </button>
            <button
              onClick={() => setSuppression(false)}
              className="text-xs text-[var(--text-slate-light)] underline underline-offset-2"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {!edition ? (
        <div className="px-4 sm:px-5 py-4 grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Lecture label="Propriétaire" valeur={vehicle.proprietaire} />
          <Lecture label="Compte lié">
            <OwnerSelect vehicleId={vehicle.id} ownerId={vehicle.owner_id} owners={owners} />
          </Lecture>
          <Lecture label="Chauffeur" valeur={vehicle.chauffeur} />
          <Lecture label="Taux chauffeur / jour" valeur={`${vehicle.taux_chauffeur ?? 5000} F`} />
        </div>
      ) : (
        <div className="px-4 sm:px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Champ label="Marque / modèle">
              <input autoFocus className={inputClass} value={champs.marque} onKeyDown={auClavier}
                onChange={(e) => setChamps({ ...champs, marque: e.target.value })} />
            </Champ>
            <Champ label="Immatriculation">
              <input className={inputClass + " font-mono"} value={champs.immatriculation} onKeyDown={auClavier}
                onChange={(e) => setChamps({ ...champs, immatriculation: e.target.value })} />
            </Champ>
            <Champ label="Propriétaire" aide="Simple étiquette, sans effet sur les accès.">
              <input className={inputClass} value={champs.proprietaire} onKeyDown={auClavier}
                onChange={(e) => setChamps({ ...champs, proprietaire: e.target.value })} />
            </Champ>
            <Champ label="Chauffeur" aide="Proposé par défaut sur les prochaines saisies.">
              <input className={inputClass} value={champs.chauffeur} onKeyDown={auClavier}
                placeholder="Nom du chauffeur"
                onChange={(e) => setChamps({ ...champs, chauffeur: e.target.value })} />
            </Champ>
            <Champ label="Taux chauffeur / jour (FCFA)">
              <input type="number" step={500} className={inputClass} value={champs.taux_chauffeur} onKeyDown={auClavier}
                onChange={(e) => setChamps({ ...champs, taux_chauffeur: e.target.value })} />
            </Champ>
            <Champ label="Compte propriétaire lié" aide="C'est lui qui donne l'accès au véhicule.">
              <OwnerSelect vehicleId={vehicle.id} ownerId={vehicle.owner_id} owners={owners} />
            </Champ>
          </div>

          <div
            className="text-[11px] text-[var(--text-slate-light)] leading-relaxed mt-4 pt-3 border-t"
            style={{ borderColor: COLORS.line }}
          >
            Changer le chauffeur ne modifie pas les saisies déjà enregistrées : chacune garde le
            nom du receveur noté ce jour-là.
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button
              onClick={enregistrer}
              disabled={saving}
              className="flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: COLORS.green }}
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={15} />}
              Enregistrer
            </button>
            <button
              onClick={() => setEdition(false)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border"
              style={{ borderColor: COLORS.line, color: "var(--text-slate)" }}
            >
              <X size={14} /> Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
