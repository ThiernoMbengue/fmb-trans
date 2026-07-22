import { createClient } from "@/lib/supabase/server";
import DashboardClient from "./dashboard-client";

export default async function HomePage() {
  const supabase = createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <DashboardClient vehicles={vehicles || []} />;
}
