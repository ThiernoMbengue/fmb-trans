import Anthropic from "@anthropic-ai/sdk";
import { createAdminClient } from "@/lib/supabase/admin";

// Fichier réservé au serveur : il lit la clé de l'API. Ne jamais l'importer
// depuis un composant affiché dans le navigateur.

// Le modèle le moins cher de la gamme. Pour en changer sans toucher au code,
// définir ANTHROPIC_MODEL dans les variables d'environnement.
export const MODELE = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

// Nombre de demandes par personne et par jour, toutes fonctions confondues.
export const LIMITE_QUOTIDIENNE = Math.max(1, Number(process.env.IA_LIMITE_QUOTIDIENNE) || 150);

export const IA_NON_CONFIGUREE =
  "L'assistant n'est pas encore activé : la clé ANTHROPIC_API_KEY n'est pas définie dans les variables d'environnement de l'hébergeur.";

let instance = null;

/** Client de l'API, ou null tant que la clé n'est pas configurée. */
export function clientIA() {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!instance) instance = new Anthropic({ maxRetries: 2, timeout: 55_000 });
  return instance;
}

/** Message lisible pour une erreur de l'API. */
export function messageErreurIA(erreur) {
  if (erreur instanceof Anthropic.AuthenticationError || erreur instanceof Anthropic.PermissionDeniedError) {
    return "La clé de l'API est refusée. Vérifiez ANTHROPIC_API_KEY dans les variables d'environnement.";
  }
  if (erreur instanceof Anthropic.RateLimitError) {
    return "Trop de demandes en même temps. Réessayez dans une minute.";
  }
  if (erreur instanceof Anthropic.BadRequestError) {
    // Crédit épuisé, modèle inconnu, image illisible : le détail aide à corriger.
    return "La demande a été refusée par le service d'IA : " + (erreur.message || "requête invalide");
  }
  if (erreur instanceof Anthropic.APIConnectionError) {
    return "Le service d'IA est injoignable pour le moment. Réessayez dans un instant.";
  }
  if (erreur instanceof Anthropic.APIError) {
    return "Le service d'IA rencontre un problème. Réessayez dans un instant.";
  }
  return "Une erreur inattendue s'est produite. Réessayez dans un instant.";
}

/* ------------------------------------------------------------------ */
/* Garde-fou : nombre de demandes par personne et par jour             */
/* ------------------------------------------------------------------ */

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/**
 * Compte une demande pour cette personne et dit si elle reste sous la limite.
 *
 * Le compteur est tenu avec la clé de service : personne ne peut le remettre
 * à zéro. Si la table n'existe pas encore (migration_ia.sql non exécutée) ou
 * si la clé de service manque, on laisse passer — le suivi est un garde-fou,
 * pas une condition pour que la fonction marche.
 */
export async function compterDemande(userId) {
  try {
    const admin = createAdminClient();
    if (!admin || !userId) return { ok: true };
    const { data, error } = await admin.rpc("ia_compter", {
      p_user: userId, p_jour: aujourdhui(), p_appels: 1, p_entree: 0, p_sortie: 0,
    });
    if (error) return { ok: true };
    return { ok: Number(data) <= LIMITE_QUOTIDIENNE };
  } catch {
    return { ok: true };
  }
}

/** Ajoute la consommation d'une demande au suivi du jour. N'échoue jamais. */
export async function enregistrerConsommation(userId, entree, sortie) {
  try {
    const admin = createAdminClient();
    if (!admin || !userId) return;
    await admin.rpc("ia_compter", {
      p_user: userId, p_jour: aujourdhui(), p_appels: 0,
      p_entree: Math.round(entree) || 0, p_sortie: Math.round(sortie) || 0,
    });
  } catch {}
}

export const LIMITE_ATTEINTE =
  `Vous avez atteint la limite de ${LIMITE_QUOTIDIENNE} demandes à l'assistant pour aujourd'hui. Elle se remet à zéro demain.`;
