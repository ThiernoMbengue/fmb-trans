// Rejoué à chaque changement de page : le contenu entre en douceur, pendant
// que le menu et la barre du haut restent en place.
export default function Template({ children }) {
  return <div className="animate-page">{children}</div>;
}
