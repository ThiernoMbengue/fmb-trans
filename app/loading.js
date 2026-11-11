// Affiché pendant qu'une page se prépare côté serveur : la navigation répond
// tout de suite au lieu de sembler figée.
export default function Loading() {
  return (
    <div className="page" aria-busy="true" aria-label="Chargement de la page">
      <div className="squelette h-8 w-56" />
      <div className="squelette mt-3 h-4 w-full max-w-md" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <div key={i} className="squelette h-24" />)}
      </div>
      <div className="squelette mt-4 h-64" />
      <div className="squelette mt-4 h-40" />
    </div>
  );
}
