import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import VehicleForm from "./vehicle-form";
import DeleteButton from "./delete-button";
import OwnerSelect from "./owner-select";

const COLORS = { ink: "var(--text-ink)", line: "var(--border-line)" };

export default async function VehiculesPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const [{ data: vehicles }, { data: owners }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, nom, email").eq("role", "proprietaire").order("nom", { ascending: true }),
  ]);

  return (
    <main className="px-6 md:px-10 py-8 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-1" style={{ color: COLORS.ink }}>
        Véhicules de la flotte
      </h1>
      <p className="text-xs text-[var(--text-slate-light)] mb-6 max-w-2xl leading-relaxed">
        La colonne « Propriétaire » est une simple étiquette. C&apos;est la colonne
        « Compte lié » qui donne au propriétaire l&apos;accès à son véhicule : tant qu&apos;aucun
        compte n&apos;y est rattaché, il ne verra aucune donnée en se connectant.
      </p>

      <VehicleForm owners={owners || []} />

      <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "var(--bg-page)" }}>
              {["Marque", "Immatriculation", "Propriétaire", "Compte lié", "Chauffeur", "Taux chauffeur/jour", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-[var(--text-slate)]">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(vehicles || []).map((v) => (
              <tr key={v.id} className="border-t" style={{ borderColor: COLORS.line }}>
                <td className="px-4 py-2.5">{v.marque}</td>
                <td className="px-4 py-2.5 font-mono">{v.immatriculation}</td>
                <td className="px-4 py-2.5">{v.proprietaire}</td>
                <td className="px-4 py-2.5">
                  <OwnerSelect vehicleId={v.id} ownerId={v.owner_id} owners={owners || []} />
                </td>
                <td className="px-4 py-2.5">{v.chauffeur}</td>
                <td className="px-4 py-2.5">{v.taux_chauffeur ? `${v.taux_chauffeur} F` : "5000 F"}</td>
                <td className="px-4 py-2.5">
                  <DeleteButton id={v.id} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
