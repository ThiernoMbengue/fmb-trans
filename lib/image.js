// Préparation d'une image avant envoi : une capture d'écran de téléphone
// pèse souvent plusieurs mégaoctets. On la réduit dans le navigateur, ce qui
// accélère l'envoi et allège le stockage, sans gêner la lecture des chiffres.

const COTE_MAX = 2000;
const QUALITE = 0.85;

function versBase64(blob) {
  return new Promise((resoudre, rejeter) => {
    const lecteur = new FileReader();
    lecteur.onload = () => resoudre(String(lecteur.result).split(",")[1] || "");
    lecteur.onerror = () => rejeter(new Error("Lecture de l'image impossible."));
    lecteur.readAsDataURL(blob);
  });
}

async function charger(fichier) {
  if (typeof createImageBitmap === "function") {
    try { return await createImageBitmap(fichier); } catch {}
  }
  // Repli pour les navigateurs sans createImageBitmap.
  return new Promise((resoudre, rejeter) => {
    const url = URL.createObjectURL(fichier);
    const image = new Image();
    image.onload = () => { URL.revokeObjectURL(url); resoudre(image); };
    image.onerror = () => { URL.revokeObjectURL(url); rejeter(new Error("Ce fichier n'est pas une image lisible.")); };
    image.src = url;
  });
}

/**
 * Réduit une image et la rend en JPEG.
 * Rend { blob, base64, type, largeur, hauteur }.
 */
export async function preparerImage(fichier) {
  if (!fichier || !String(fichier.type || "").startsWith("image/")) {
    throw new Error("Choisissez une image (capture d'écran ou photo).");
  }
  const source = await charger(fichier);
  const l = source.width;
  const h = source.height;
  if (!l || !h) throw new Error("Ce fichier n'est pas une image lisible.");

  const echelle = Math.min(1, COTE_MAX / Math.max(l, h));
  const largeur = Math.max(1, Math.round(l * echelle));
  const hauteur = Math.max(1, Math.round(h * echelle));

  const toile = document.createElement("canvas");
  toile.width = largeur;
  toile.height = hauteur;
  const ctx = toile.getContext("2d");
  // Fond blanc : une capture PNG transparente deviendrait noire en JPEG.
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, largeur, hauteur);
  ctx.drawImage(source, 0, 0, largeur, hauteur);
  source.close?.();

  const blob = await new Promise((resoudre) => toile.toBlob(resoudre, "image/jpeg", QUALITE));
  if (!blob) throw new Error("Préparation de l'image impossible.");

  return { blob, base64: await versBase64(blob), type: "image/jpeg", largeur, hauteur };
}
