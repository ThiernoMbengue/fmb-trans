import { randomBytes, scryptSync, timingSafeEqual, createHash } from "crypto";

// ---------------------------------------------------------------------------
// Mot de passe de l'espace investisseur
//
// Il est stocké haché (scrypt + sel aléatoire) dans app_settings, jamais en
// clair. Tant qu'aucun mot de passe n'a été défini depuis l'interface, on
// retombe sur la variable d'environnement INVESTOR_PASSWORD.
//
// Ce module utilise node:crypto : à n'importer que côté serveur.
// ---------------------------------------------------------------------------

const CLE_PARAMETRE = "investor_password";
const LONGUEUR_CLE = 32;

export const PARAMETRE_MOT_DE_PASSE = CLE_PARAMETRE;

export function hacherMotDePasse(motDePasse) {
  const sel = randomBytes(16).toString("hex");
  const derive = scryptSync(motDePasse, sel, LONGUEUR_CLE).toString("hex");
  return `scrypt$${sel}$${derive}`;
}

// Décrit le secret courant : soit le hachage enregistré en base, soit le
// mot de passe de repli défini par variable d'environnement.
export function descripteurSecret(hachageEnregistre) {
  if (hachageEnregistre) return hachageEnregistre;
  return `plain$${process.env.INVESTOR_PASSWORD || "yango"}`;
}

export function verifierMotDePasse(descripteur, saisie) {
  if (!descripteur || !saisie) return false;

  if (descripteur.startsWith("plain$")) {
    const attendu = Buffer.from(descripteur.slice("plain$".length));
    const fourni = Buffer.from(String(saisie));
    if (attendu.length !== fourni.length) return false;
    return timingSafeEqual(fourni, attendu);
  }

  const [schema, sel, hachage] = descripteur.split("$");
  if (schema !== "scrypt" || !sel || !hachage) return false;

  const derive = scryptSync(String(saisie), sel, LONGUEUR_CLE);
  const attendu = Buffer.from(hachage, "hex");
  if (attendu.length !== derive.length) return false;
  return timingSafeEqual(derive, attendu);
}

// Jeton déposé dans le cookie. Il dépend du secret courant : dès que le mot
// de passe change, les cookies émis avec l'ancien deviennent invalides et
// les visiteurs concernés perdent l'accès.
export function jetonSession(descripteur) {
  return createHash("sha256").update(descripteur).digest("hex").slice(0, 32);
}

// Lit le hachage en base avec le client service_role (contourne la RLS).
export async function lireHachage(admin) {
  if (!admin) return null;
  const { data } = await admin
    .from("app_settings")
    .select("valeur")
    .eq("cle", CLE_PARAMETRE)
    .maybeSingle();
  return data?.valeur || null;
}
