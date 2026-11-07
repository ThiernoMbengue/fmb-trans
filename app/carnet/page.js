import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import CarnetClient from "./carnet-client";

export const dynamic = "force-dynamic";

export default async function CarnetPage() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, marque, immatriculation")
    .order("created_at", { ascending: true });

  return <CarnetClient vehicles={vehicles || []} />;
}
