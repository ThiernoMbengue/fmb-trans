// Identité et rôle de la personne connectée.

const AUCUN = { user: null, role: null, nom: null };

/**
 * Vérification complète : interroge le service d'authentification. Utilisée
 * par les actions qui écrivent (enregistrer, supprimer, payer).
 */
export async function getRole(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return AUCUN;

  const { data } = await supabase.from("profiles").select("role, nom").eq("id", user.id).maybeSingle();

  return { user, role: data?.role || "proprietaire", nom: data?.nom || null };
}

// Lit le contenu du jeton de session sans le vérifier : l'identifiant qu'il
// annonce ne sert qu'à poser la question à la base, qui, elle, le vérifie.
function lireJeton(jeton) {
  try {
    const charge = JSON.parse(Buffer.from(String(jeton).split(".")[1], "base64url").toString("utf8"));
    return charge && typeof charge.sub === "string" ? charge : null;
  } catch {
    return null;
  }
}

/** Identifiant annoncé par la session en cours, sans aller-retour réseau. */
export async function identiteLocale(supabase) {
  const { data } = await supabase.auth.getSession();
  const charge = data?.session?.access_token ? lireJeton(data.session.access_token) : null;
  return charge ? { id: charge.sub, email: charge.email || null } : null;
}

/**
 * Version rapide, pour l'affichage des pages : un seul aller-retour au lieu
 * de deux.
 *
 * La session a déjà été contrôlée et renouvelée par le middleware. Ici, le
 * profil est demandé à la base avec le jeton de la personne : la base vérifie
 * elle-même ce jeton avant de répondre. Un jeton falsifié ou périmé est donc
 * refusé à cet instant — et l'on retombe sur la vérification complète.
 */
export async function getRoleRapide(supabase, identite) {
  const qui = identite === undefined ? await identiteLocale(supabase) : identite;
  if (!qui) return AUCUN;

  const { data, error } = await supabase.from("profiles").select("role, nom").eq("id", qui.id).maybeSingle();
  if (error) return getRole(supabase);

  return { user: { id: qui.id, email: qui.email }, role: data?.role || "proprietaire", nom: data?.nom || null };
}
