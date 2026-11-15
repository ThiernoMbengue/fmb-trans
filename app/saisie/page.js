import { redirect } from "next/navigation";
import { contextePage } from "@/lib/supabase/contexte";
import { vehiculeInitial } from "@/lib/vehicule-initial";
import SaisieClient from "./saisie-client";

export const metadata = { title: "Saisie" };

export default async function SaisiePage() {
  const { role, vehicles } = await contextePage();
  if (role !== "admin") redirect("/");
  return <SaisieClient vehicles={vehicles} vehiculeInitial={vehiculeInitial()} />;
}
