import { cookies } from "next/headers";

// Dernier véhicule choisi par la personne, lu côté serveur : la page est
// rendue directement dessus. Le nom du cookie est repris de
// lib/vehicule-courant.js (fichier client, qu'on ne peut pas importer ici).
export function vehiculeInitial() {
  try {
    return cookies().get("fmb_vehicule")?.value || null;
  } catch {
    return null;
  }
}
