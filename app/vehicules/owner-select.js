"use client";

import { useEffect, useState, useTransition } from "react";
import { Loader2, Check } from "lucide-react";
import { updateVehicleOwner } from "./actions";
import { useToast } from "@/components/ui";

export default function OwnerSelect({ vehicleId, ownerId, owners }) {
  const toast = useToast();
  const [value, setValue] = useState(ownerId || "");
  const [pending, startTransition] = useTransition();
  const [ok, setOk] = useState(false);

  // La fiche est rafraîchie par le serveur après chaque enregistrement.
  useEffect(() => { setValue(ownerId || ""); }, [ownerId]);

  const onChange = (e) => {
    const nouveau = e.target.value;
    const precedent = value;
    setValue(nouveau);
    setOk(false);

    startTransition(async () => {
      const res = await updateVehicleOwner(vehicleId, nouveau);
      if (res?.error) {
        setValue(precedent);
        toast(res.error, "error");
      } else {
        setOk(true);
        setTimeout(() => setOk(false), 2500);
      }
    });
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <select
        aria-label="Compte propriétaire lié"
        value={value}
        onChange={onChange}
        disabled={pending}
        className="champ min-w-0 flex-1 py-1.5"
        style={value ? { borderColor: "color-mix(in srgb, var(--green) 55%, var(--border-line))" } : undefined}
      >
        <option value="">Aucun compte lié</option>
        {(owners || []).map((o) => (
          <option key={o.id} value={o.id}>{o.nom || o.email || o.id}</option>
        ))}
      </select>
      {pending && <Loader2 size={15} className="shrink-0 animate-spin text-[var(--text-slate-light)]" />}
      {ok && !pending && <Check size={15} className="shrink-0" style={{ color: "var(--green)" }} />}
    </div>
  );
}
