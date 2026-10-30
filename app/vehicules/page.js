import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import VehicleForm from "./vehicle-form";
import VehicleCard from "./vehicle-card";

const COLORS = { ink: "var(--text-ink)" };

export default async function VehiculesPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const [{ data: vehicles }, { data: owners }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, nom, email").eq("role", "proprietaire").order("nom", { ascending: true }),
  ]);

  return (
    <main className="px-4 md:px-8 py-8 max-w-4xl mx-auto">
      <h1 className="text-lg font-semibold mb-1" style={{ color: COLORS.ink }}>
        Véhicules de la flotte
      </h1>
      <p className="text-xs text-[var(--text-slate-light)] mb-6 max-w-2xl leading-relaxed">
        La ligne « Propriétaire » est une simple étiquette. C&apos;est le « Compte lié » qui donne
        au propriétaire l&apos;accès à son véhicule : tant qu&apos;aucun compte n&apos;y est
        rattaché, il ne verra aucune donnée en se connectant.
      </p>

      <VehicleForm owners={owners || []} />

      <div className="flex flex-col gap-3 mt-6">
        {(vehicles || []).length === 0 ? (
          <div className="bg-[var(--bg-surface)] rounded-xl border border-[var(--border-line)] px-5 py-8 text-center text-sm text-[var(--text-slate-light)]">
            Aucun véhicule enregistré pour le moment.
          </div>
        ) : (
          vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} owners={owners || []} />)
        )}
      </div>
    </main>
  );
}
