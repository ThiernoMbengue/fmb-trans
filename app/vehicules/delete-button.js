"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteVehicle } from "./actions";

export default function DeleteButton({ id }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => {
        if (confirm("Supprimer ce véhicule et toutes ses saisies ?")) {
          startTransition(() => deleteVehicle(id));
        }
      }}
      disabled={pending}
      className="text-[var(--text-slate-light)] hover:text-[var(--red)] disabled:opacity-40"
    >
      <Trash2 size={14} />
    </button>
  );
}
