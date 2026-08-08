import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import ComptesClient from "./comptes-client";

export default async function ComptesPage() {
  const supabase = createClient();
  const { role, user } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: true });

  return <ComptesClient profiles={profiles || []} currentUserId={user.id} />;
}
