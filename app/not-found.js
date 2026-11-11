import Link from "next/link";
import { Compass } from "lucide-react";

export const metadata = { title: "Page introuvable" };

export default function NotFound() {
  return (
    <div className="page page-etroite">
      <div className="carte mx-auto mt-6 max-w-md p-6 text-center sm:mt-12 sm:p-8">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 12%, transparent)" }}
        >
          <Compass size={22} color="var(--fleet-bright)" />
        </div>
        <h1 className="font-display text-lg font-bold text-[var(--text-ink)]">Page introuvable</h1>
        <p className="mt-2 text-sm leading-relaxed text-[var(--text-slate)]">
          Cette adresse ne correspond à aucune page. Elle a peut-être été déplacée.
        </p>
        <Link href="/" className="btn btn-primaire mt-5">Retour au tableau de bord</Link>
      </div>
    </div>
  );
}
