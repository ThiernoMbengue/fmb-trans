import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import PaiementsClient from "./paiements-client";

export const dynamic = "force-dynamic";

export default async function PaiementsPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <PaiementsClient vehicles={vehicles || []} role={role} />;
}
