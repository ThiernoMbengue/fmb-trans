// Remise d'un fichier à l'utilisateur, dans un navigateur comme dans
// l'application mobile.
//
// Dans un navigateur, « télécharger » est un geste natif : un lien avec
// l'attribut download, ou doc.save() de jsPDF qui fait la même chose. Dans la
// coque Android / iOS, ce mécanisme n'existe pas : la page n'a pas de dossier
// Téléchargements, et le clic ne produit rien — sans erreur. Les reçus et les
// rapports ne sortiraient donc jamais de l'application.
//
// Là, on écrit le fichier dans le cache de l'application puis on ouvre la
// feuille de partage du téléphone : ouvrir, enregistrer, envoyer par WhatsApp.

// La coque native injecte window.Capacitor avant le chargement de la page.
// Dans un navigateur ordinaire l'objet n'existe pas.
const estApplicationMobile = () =>
  typeof window !== "undefined" && !!window.Capacitor?.isNativePlatform?.();

// Un nom de fichier sans surprise pour le système du téléphone.
const nomSur = (nom) => (nom || "document").replace(/[^a-zA-Z0-9._-]/g, "_");

async function partager(nom, ecrire) {
  // Chargés à la demande : dans un navigateur, ces modules ne sont jamais
  // téléchargés.
  const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  const { uri } = await Filesystem.writeFile({
    path: nomSur(nom),
    directory: Directory.Cache,
    ...ecrire(Encoding),
  });

  try {
    await Share.share({ title: nom, url: uri, dialogTitle: "Ouvrir ou envoyer le document" });
  } catch (e) {
    // Fermer la feuille de partage sans rien choisir n'est pas une erreur.
    if (!/cancel/i.test(e?.message || "")) throw e;
  }
}

/** Remet un document jsPDF : téléchargement dans un navigateur, partage sur mobile. */
export async function telechargerPDF(doc, nom) {
  if (!estApplicationMobile()) {
    doc.save(nom);
    return;
  }
  // « data:application/pdf;filename=…;base64,XXXX » : seul le contenu nous intéresse.
  const base64 = doc.output("datauristring").split("base64,")[1];
  await partager(nom, () => ({ data: base64 }));
}

/** Remet un fichier texte (CSV…) : téléchargement dans un navigateur, partage sur mobile. */
export async function telechargerTexte(contenu, nom, mime = "text/plain") {
  if (!estApplicationMobile()) {
    const url = URL.createObjectURL(new Blob([contenu], { type: `${mime};charset=utf-8;` }));
    const a = document.createElement("a");
    a.href = url;
    a.download = nom;
    a.click();
    URL.revokeObjectURL(url);
    return;
  }
  await partager(nom, (Encoding) => ({ data: contenu, encoding: Encoding.UTF8 }));
}
