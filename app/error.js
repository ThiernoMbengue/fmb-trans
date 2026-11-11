"use client";

import { useEffect } from "react";
import { RotateCcw, TriangleAlert } from "lucide-react";

// Filet de sécurité : une page qui échoue affiche ceci plutôt qu'un écran
// blanc, et propose de réessayer sans tout recharger.
export default function Erreur({ error, reset }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="page page-etroite">
      <div className="carte mx-auto mt-6 max-w-md p-6 text-center sm:mt-12 sm:p-8">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--red) 12%, transparent)" }}
        >
          <TriangleAlert size={22} color="var(--red)" />
        </div>
        <h1 className="font-display text-lg font-bold text-[var(--text-ink)]">Cette page n&apos;a pas pu s&apos;afficher</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-slate)]">
          Vos données ne sont pas en cause. Il s&apos;agit le plus souvent d&apos;une coupure de
          connexion : réessayez dans un instant.
        </p>
        <button onClick={() => reset()} className="btn btn-primaire mt-5">
          <RotateCcw size={15} /> Réessayer
        </button>
        {error?.digest && (
          <p className="mt-4 text-[11px] text-[var(--text-slate-light)]">Référence : {error.digest}</p>
        )}
      </div>
    </div>
  );
}
