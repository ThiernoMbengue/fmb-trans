import { createClient } from "@/lib/supabase/server";
import VehicleForm from "./vehicle-form";
import DeleteButton from "./delete-button";

const COLORS = { ink: "#14324D", line: "#E4E9EF" };

export default async function VehiculesPage() {
  const supabase = createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <main className="px-6 md:px-10 py-8 max-w-3xl mx-auto">
      <h1 className="text-lg font-semibold mb-6" style={{ color: COLORS.ink }}>
        Véhicules de la flotte
      </h1>

      <VehicleForm />

      <div className="bg-white rounded-xl border border-slate-200 mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: "#F5F7FA" }}>
              {["Marque", "Immatriculation", "Propriétaire", "Chauffeur", ""].map((h) => (
                <th key={h} className="text-left px-4 py-2.5 font-medium text-xs uppercase tracking-wide text-slate-500">
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
                <td className="px-4 py-2.5">{v.chauffeur}</td>
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
