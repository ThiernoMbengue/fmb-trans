import { contextePage } from "@/lib/supabase/contexte";
import { vehiculeInitial } from "@/lib/vehicule-initial";
import RapportsClient from "./rapports-client";

export const metadata = { title: "Rapports" };

export default async function RapportsPage() {
  const { role, vehicles } = await contextePage();
  return <RapportsClient vehicles={vehicles} role={role} vehiculeInitial={vehiculeInitial()} />;
}
