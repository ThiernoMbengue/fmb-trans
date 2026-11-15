import { contextePage } from "@/lib/supabase/contexte";
import { vehiculeInitial } from "@/lib/vehicule-initial";
import PaiementsClient from "./paiements-client";

export const dynamic = "force-dynamic";

export const metadata = { title: "Paiements" };

// Le rattrapage du statut des avances ne se fait plus ici : il obligeait à
// relire toute la base avant d'afficher la page. La page s'affiche d'abord ;
// le rattrapage est lancé ensuite, en arrière-plan (voir paiements-client).
export default async function PaiementsPage() {
  const { role, vehicles } = await contextePage();
  return <PaiementsClient vehicles={vehicles} role={role} vehiculeInitial={vehiculeInitial()} />;
}
