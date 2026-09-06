"use client";

import { useState, useTransition } from "react";
import { Loader2, Check, AlertCircle } from "lucide-react";
import { updateVehicleOwner } from "./actions";

export default function OwnerSelect({ vehicleId, ownerId, owners }) {
  const [value, setValue] = useState(ownerId || "");
  const [pending, startTransition] = useTransition();
  const [etat, setEtat] = useState(null); // "ok" | "erreur"
  const [message, setMessage] = useState(null);

  const onChange = (e) => {
    const nouveau = e.target.value;
    const precedent = value;
    setValue(nouveau);
    setEtat(null);
    setMessage(null);

    startTransition(async () => {
      const res = await updateVehicleOwner(vehicleId, nouveau);
      if (res?.error) {
        setValue(precedent);
        setEtat("erreur");
        setMessage(res.error);
      } else {
        setEtat("ok");
        setTimeout(() => setEtat(null), 2500);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1 min-w-0">
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={onChange}
          disabled={pending}
          className="text-xs bg-[var(--bg-surface)] border rounded-lg px-2 py-1.5 max-w-[190px] disabled:opacity-60"
          style={{ borderColor: value ? "var(--green)" : "var(--border-line)" }}
        >
          <option value="">— aucun compte lié —</option>
          {(owners || []).map((o) => (
            <option key={o.id} value={o.id}>{o.nom || o.email || o.id}</option>
          ))}
        </select>
        {pending && <Loader2 size={13} className="animate-spin text-[var(--text-slate-light)] shrink-0" />}
        {etat === "ok" && <Check size={13} className="shrink-0" style={{ color: "var(--green)" }} />}
        {etat === "erreur" && <AlertCircle size={13} className="shrink-0" style={{ color: "var(--red)" }} />}
      </div>
      {message && <div className="text-[10px]" style={{ color: "var(--red)" }}>{message}</div>}
    </div>
  );
}
