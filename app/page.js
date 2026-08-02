import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import DashboardClient from "./dashboard-client";

export default async function HomePage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <DashboardClient vehicles={vehicles || []} role={role} />;
}
