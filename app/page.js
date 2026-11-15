import { contextePage } from "@/lib/supabase/contexte";
import { vehiculeInitial } from "@/lib/vehicule-initial";
import DashboardClient from "./dashboard-client";

export const metadata = { title: "Tableau de bord" };

export default async function HomePage() {
  const { role, vehicles } = await contextePage();
  return <DashboardClient vehicles={vehicles} role={role} vehiculeInitial={vehiculeInitial()} />;
}
