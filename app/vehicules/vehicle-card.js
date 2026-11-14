"use client";

import { useState } from "react";
import { Pencil, Check, Loader2, Trash2, Bus, UserRound, CircleUserRound, Banknote, Link2 } from "lucide-react";
import { updateVehicle, deleteVehicle } from "./actions";
import OwnerSelect from "./owner-select";
import { Champ, useToast, useConfirm } from "@/components/ui";
import { fmtF } from "@/lib/format";

const champsDe = (v) => ({
  marque: v.marque || "",
  immatriculation: v.immatriculation || "",
  proprietaire: v.proprietaire || "",
  chauffeur: v.chauffeur || "",
  taux_chauffeur: v.taux_chauffeur ?? 5000,
});

function Lecture({ icone: Icone, label, valeur, children }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-[var(--text-slate-light)]">
        {Icone && <Icone size={12} className="shrink-0" />}
        {label}
      </div>
      {children || (
        <div className="break-words text-sm" style={{ color: valeur ? "var(--text-ink)" : "var(--text-slate-light)" }}>
          {valeur || "Non renseigné"}
        </div>
      )}
    </div>
  );
}

export default function VehicleCard({ vehicle, owners }) {
  const toast = useToast();
  const confirmer = useConfirm();
  const [edition, setEdition] = useState(false);
  const [champs, setChamps] = useState(champsDe(vehicle));
  const [saving, setSaving] = useState(false);

  const ouvrir = () => {
    setChamps(champsDe(vehicle));
    setEdition(true);
  };

  const enregistrer = async (e) => {
    e?.preventDefault();
    setSaving(true);
    const res = await updateVehicle(vehicle.id, champs);
    setSaving(false);
    if (res?.error) return toast(res.error, "error");
    toast("Véhicule mis à jour");
    setEdition(false);
  };

  const supprimer = async () => {
    // Le nom à retaper évite la suppression d'un véhicule — et de tout son
    // historique — sur un simple clic malheureux.
    const tape = await confirmer({
      titre: `Supprimer ${vehicle.marque} — ${vehicle.immatriculation} ?`,
      message:
        "Toutes ses saisies, avances et paiements seront supprimés avec lui, définitivement.\n\nPour simplement arrêter de l'exploiter, mieux vaut le conserver : son historique reste utile aux rapports.",
      saisie: { label: `Pour confirmer, tapez ${vehicle.immatriculation}`, placeholder: vehicle.immatriculation },
      confirmer: "Supprimer définitivement",
      danger: true,
    });
    if (tape === null) return;
    if (tape.trim().toUpperCase() !== String(vehicle.immatriculation).trim().toUpperCase()) {
      return toast("L'immatriculation tapée ne correspond pas : rien n'a été supprimé.", "warning");
    }
    setSaving(true);
    const res = await deleteVehicle(vehicle.id);
    setSaving(false);
    if (res?.error) return toast(res.error, "error");
    toast("Véhicule supprimé");
  };

  const maj = (cle) => (e) => setChamps({ ...champs, [cle]: e.target.value });

  return (
    <article className="carte overflow-hidden">
      <header className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <div
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
            style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}
          >
            <Bus size={18} color="var(--fleet-bright)" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-[15px] font-semibold text-[var(--text-ink)]">{vehicle.marque}</h2>
            <div className="font-figures truncate text-xs font-medium tracking-wide text-[var(--text-slate)]">
              {vehicle.immatriculation}
            </div>
          </div>
        </div>

        {!edition && (
          <div className="flex shrink-0 items-center gap-1.5">
            <button onClick={ouvrir} className="btn btn-contour btn-petit">
              <Pencil size={13} /> Modifier
            </button>
            <button onClick={supprimer} disabled={saving} aria-label="Supprimer ce véhicule" title="Supprimer ce véhicule" className="btn-icone danger h-8 w-8">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
            </button>
          </div>
        )}
      </header>

      {!edition ? (
        <div className="grid grid-cols-2 gap-x-5 gap-y-4 border-t border-[var(--border-line)] px-4 py-4 sm:grid-cols-3 sm:px-5">
          <Lecture icone={UserRound} label="Propriétaire" valeur={vehicle.proprietaire} />
          <Lecture icone={CircleUserRound} label="Chauffeur" valeur={vehicle.chauffeur} />
          <Lecture icone={Banknote} label="Taux / jour" valeur={fmtF(vehicle.taux_chauffeur ?? 5000)} />
          <div className="col-span-full sm:max-w-sm">
            <Lecture icone={Link2} label="Compte lié">
              <OwnerSelect vehicleId={vehicle.id} ownerId={vehicle.owner_id} owners={owners} />
            </Lecture>
          </div>
        </div>
      ) : (
        <form
          onSubmit={enregistrer}
          onKeyDown={(e) => { if (e.key === "Escape") setEdition(false); }}
          className="animate-fondu border-t border-[var(--border-line)] bg-[var(--bg-page)] px-4 py-4 sm:px-5"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Champ label="Marque / modèle">
              <input autoFocus required className="champ" value={champs.marque} onChange={maj("marque")} />
            </Champ>
            <Champ label="Immatriculation">
              <input required className="champ uppercase" value={champs.immatriculation} onChange={maj("immatriculation")} />
            </Champ>
            <Champ label="Propriétaire" aide="Simple nom affiché, sans effet sur les accès.">
              <input className="champ" value={champs.proprietaire} onChange={maj("proprietaire")} />
            </Champ>
            <Champ label="Chauffeur" aide="Proposé par défaut sur les prochaines saisies.">
              <input className="champ" value={champs.chauffeur} placeholder="Nom du chauffeur" onChange={maj("chauffeur")} />
            </Champ>
            <Champ label="Taux chauffeur / jour (FCFA)">
              <input type="number" inputMode="numeric" min={0} step={500} className="champ font-figures" value={champs.taux_chauffeur} onChange={maj("taux_chauffeur")} />
            </Champ>
          </div>

          <p className="mt-4 text-xs leading-relaxed text-[var(--text-slate-light)]">
            Changer le chauffeur ne modifie pas les saisies déjà enregistrées : chacune garde le nom du receveur
            noté ce jour-là.
          </p>

          <div className="mt-4 flex flex-col gap-2 sm:flex-row">
            <button type="submit" disabled={saving} className="btn btn-succes">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Enregistrer
            </button>
            <button type="button" onClick={() => setEdition(false)} className="btn btn-contour">Annuler</button>
          </div>
        </form>
      )}
    </article>
  );
}
