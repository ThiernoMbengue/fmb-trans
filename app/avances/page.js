import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import AvancesClient from "./avances-client";

export const metadata = { title: "Avances" };

export default async function AvancesPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <AvancesClient vehicles={vehicles || []} role={role} />;
}
