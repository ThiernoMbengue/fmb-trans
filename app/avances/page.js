import { createClient } from "@/lib/supabase/server";
import AvancesClient from "./avances-client";

export default async function AvancesPage() {
  const supabase = createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <AvancesClient vehicles={vehicles || []} />;
}
