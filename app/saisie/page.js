import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import SaisieClient from "./saisie-client";

export default async function SaisiePage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("*")
    .order("created_at", { ascending: true });

  return <SaisieClient vehicles={vehicles || []} />;
}
