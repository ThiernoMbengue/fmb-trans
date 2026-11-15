import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { contextePage } from "@/lib/supabase/contexte";
import { PARAMETRE_MOT_DE_PASSE } from "@/lib/investor-access";
import ComptesClient from "./comptes-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Comptes" };

export default async function ComptesPage() {
  const supabase = createClient();
  // Tout est demandé en même temps ; ces deux tables ne sont lisibles que par
  // un gestionnaire, la base y veille.
  const [{ role, user }, { data: profiles }, { data: parametre }] = await Promise.all([
    contextePage(),
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    // On ne lit que la date de mise à jour : la valeur est un hachage, elle
    // n'a aucun intérêt à circuler jusqu'au navigateur.
    supabase
      .from("app_settings")
      .select("updated_at")
      .eq("cle", PARAMETRE_MOT_DE_PASSE)
      .maybeSingle(),
  ]);
  if (role !== "admin") redirect("/");

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
