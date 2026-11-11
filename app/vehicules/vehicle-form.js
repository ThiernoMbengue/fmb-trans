"use client";

import { useEffect, useRef, useState } from "react";
import { Plus, Save, Loader2, ChevronDown } from "lucide-react";
import { addVehicle } from "./actions";
import { Champ, useToast } from "@/components/ui";

export default function VehicleForm({ owners, ouvert: ouvertAuDepart = false }) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [ouvert, setOuvert] = useState(ouvertAuDepart);
  const formRef = useRef(null);

  // Sur grand écran le formulaire reste visible à côté de la liste ; sur
  // téléphone il se replie pour laisser la place aux véhicules.
  useEffect(() => {
    if (window.matchMedia("(min-width: 1280px)").matches) setOuvert(true);
  }, []);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const res = await addVehicle(new FormData(e.currentTarget));
    setSaving(false);
    if (res?.error) return toast(res.error, "error");
    toast("Véhicule ajouté");
    formRef.current?.reset();
  };

  return (
    <section className="carte overflow-hidden">
      <button
        type="button"
        onClick={() => setOuvert((o) => !o)}
        aria-expanded={ouvert}
        className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left text-sm font-semibold text-[var(--text-ink)] sm:px-5"
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}
        >
          <Plus size={15} color="var(--fleet-bright)" />
        </span>
        Ajouter un véhicule
        <ChevronDown size={16} className={`ml-auto shrink-0 text-[var(--text-slate-light)] transition-transform ${ouvert ? "rotate-180" : ""}`} />
      </button>

      {ouvert && (
        <form ref={formRef} onSubmit={onSubmit} className="animate-fondu grid grid-cols-1 gap-4 border-t border-[var(--border-line)] px-4 py-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-1">
          <Champ label="Marque / modèle">
            <input name="marque" required className="champ" placeholder="Renault QM3" autoComplete="off" />
          </Champ>
          <Champ label="Immatriculation">
            <input name="immatriculation" required className="champ uppercase placeholder:normal-case" placeholder="AB-123-CD" autoComplete="off" />
          </Champ>
          <Champ label="Propriétaire">
            <input name="proprietaire" className="champ" placeholder="Nom affiché" autoComplete="off" />
          </Champ>
          <Champ label="Compte propriétaire lié" aide="Donne au propriétaire l'accès à ce véhicule.">
            <select name="owner_id" defaultValue="" className="champ">
              <option value="">Aucun pour l&apos;instant</option>
              {(owners || []).map((o) => (
                <option key={o.id} value={o.id}>{o.nom || o.email || o.id}</option>
              ))}
            </select>
          </Champ>
          <Champ label="Chauffeur">
            <input name="chauffeur" className="champ" placeholder="Nom du chauffeur" autoComplete="off" />
          </Champ>
          <Champ label="Taux chauffeur / jour (FCFA)">
            <input name="taux_chauffeur" type="number" inputMode="numeric" min={0} step={500} defaultValue={5000} className="champ font-figures" />
          </Champ>
          <button type="submit" disabled={saving} className="btn btn-primaire sm:col-span-2 xl:col-span-1">
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
            Ajouter le véhicule
          </button>
        </form>
      )}
    </section>
  );
}
