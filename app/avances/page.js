import { contextePage } from "@/lib/supabase/contexte";
import { vehiculeInitial } from "@/lib/vehicule-initial";
import AvancesClient from "./avances-client";

export const metadata = { title: "Avances" };

export default async function AvancesPage() {
  const { role, vehicles } = await contextePage();
  return <AvancesClient vehicles={vehicles} role={role} vehiculeInitial={vehiculeInitial()} />;
}
