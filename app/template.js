import { Suspense } from "react";
import SquelettePage from "@/components/squelette-page";

// Rejoué à chaque changement de page : le contenu entre en douceur, pendant
// que le menu et la barre du haut restent en place.
//
// La silhouette d'attente est posée ici, et non dans un fichier loading.js :
// avec loading.js, Next 14 recrée toute la page après chaque enregistrement
// (les filtres se vident, l'historique se recharge deux fois). Ici, la page
// reste en place et seules ses données sont rafraîchies.
export default function Template({ children }) {
  return (
    <div className="animate-page">
      <Suspense fallback={<SquelettePage />}>{children}</Suspense>
    </div>
  );
}
