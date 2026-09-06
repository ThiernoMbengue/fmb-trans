import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import { PARAMETRE_MOT_DE_PASSE } from "@/lib/investor-access";
import ComptesClient from "./comptes-client";

export const dynamic = "force-dynamic";

export default async function ComptesPage() {
  const supabase = createClient();
  const { role, user } = await getRole(supabase);
  if (role !== "admin") redirect("/");

  const [{ data: profiles }, { data: parametre }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    // On ne lit que la date de mise à jour : la valeur est un hachage, elle
    // n'a aucun intérêt à circuler jusqu'au navigateur.
    supabase
      .from("app_settings")
      .select("updated_at")
      .eq("cle", PARAMETRE_MOT_DE_PASSE)
      .maybeSingle(),
  ]);

  const serviceKeyConfigured = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);

  return (
    <ComptesClient
      profiles={profiles || []}
      currentUserId={user.id}
      serviceKeyConfigured={serviceKeyConfigured}
      investorPasswordSetAt={parametre?.updated_at || null}
    />
  );
}
