import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { EnTete } from "@/components/ui";
import VehicleForm from "./vehicle-form";
import VehicleCard from "./vehicle-card";

export const metadata = { title: "Véhicules" };

export default async function VehiculesPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const [{ data: vehicles }, { data: owners }] = await Promise.all([
    supabase.from("vehicles").select("*").order("created_at", { ascending: true }),
    supabase.from("profiles").select("id, nom, email").eq("role", "proprietaire").order("nom", { ascending: true }),
  ]);

  const liste = vehicles || [];
  const sansCompte = liste.filter((v) => !v.owner_id).length;

  const aide = (
    <p className="rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface)] px-4 py-3 text-xs leading-relaxed text-[var(--text-slate)]">
      <strong className="text-[var(--text-ink)]">Propriétaire ou compte lié ?</strong> Le champ « Propriétaire »
      est un simple nom affiché. C&apos;est le « Compte lié » qui donne au propriétaire l&apos;accès à son
      véhicule : sans compte rattaché, il ne voit aucune donnée en se connectant.
    </p>
  );

  return (
    <main className="page animate-fade-up">
      <EnTete
        titre="Véhicules"
        description={
          liste.length === 0
            ? "Enregistrez les véhicules de la flotte pour commencer à saisir leurs versements."
            : `${liste.length} véhicule${liste.length > 1 ? "s" : ""} dans la flotte${
                sansCompte > 0 ? ` · ${sansCompte} sans compte propriétaire lié` : ""
              }.`
        }
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <section className="flex min-w-0 flex-col gap-3 xl:order-1">
          {liste.length === 0 ? (
            <div className="carte px-5 py-10 text-center text-sm text-[var(--text-slate-light)]">
              Aucun véhicule enregistré pour le moment.
            </div>
          ) : (
            liste.map((v) => <VehicleCard key={v.id} vehicle={v} owners={owners || []} />)
          )}
          <div className="xl:hidden">{aide}</div>
        </section>

        <aside className="order-first flex min-w-0 flex-col gap-4 xl:sticky xl:top-6 xl:order-2">
          <VehicleForm owners={owners || []} ouvert={liste.length === 0} />
          <div className="hidden xl:block">{aide}</div>
        </aside>
      </div>
    </main>
  );
}
