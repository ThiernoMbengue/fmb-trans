/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Une page déjà chargée reste disponible cinq minutes dans le navigateur :
    // y revenir est immédiat, sans nouvel aller-retour avec le serveur. Ce
    // délai ne concerne que l'enveloppe de la page (rôle, liste des
    // véhicules) — les chiffres, eux, sont relus à chaque affichage. Toute
    // modification enregistrée vide cette mémoire.
    staleTimes: { dynamic: 300, static: 300 },
    // Ne charger que les icônes et graphiques réellement utilisés.
    optimizePackageImports: ["lucide-react", "recharts"],
  },
};

export default nextConfig;
