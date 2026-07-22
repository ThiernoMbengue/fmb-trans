import { createClient } from "@/lib/supabase/server";
import SaisieClient from "./saisie-client";

export default async function SaisiePage() {
  const supabase = createClient();
  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <SaisieClient vehicles={vehicles || []} />;
}
