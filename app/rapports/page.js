import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import RapportsClient from "./rapports-client";

export default async function RapportsPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <RapportsClient vehicles={vehicles || []} role={role} />;
}
