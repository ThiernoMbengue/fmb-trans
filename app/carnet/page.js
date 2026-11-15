import { redirect } from "next/navigation";
import { contextePage } from "@/lib/supabase/contexte";
import CarnetClient from "./carnet-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Carnet de bord" };

export default async function CarnetPage() {
  const { role, vehicles } = await contextePage();
  if (role !== "admin") redirect("/");
  return <CarnetClient vehicles={vehicles.map(({ id, marque, immatriculation }) => ({ id, marque, immatriculation }))} />;
}
