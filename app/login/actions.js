"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Après connexion, on ne renvoie que vers une page du site. Sans ce contrôle,
// un lien du type /login?next=https://site-pirate.example enverrait la
// personne, une fois connectée, sur un site extérieur imitant le nôtre.
function destinationSure(next) {
  const chemin = String(next || "/");
  return chemin.startsWith("/") && !chemin.startsWith("//") && !chemin.includes("\\") ? chemin : "/";
}

// Messages renvoyés par le service d'authentification, traduits.
function traduire(message) {
  const m = String(message || "").toLowerCase();
  if (m.includes("invalid login credentials")) return "E-mail ou mot de passe incorrect.";
  if (m.includes("email not confirmed")) return "Cette adresse e-mail n'a pas encore été confirmée.";
  if (m.includes("rate limit") || m.includes("too many")) return "Trop de tentatives. Patientez une minute avant de réessayer.";
  if (m.includes("fetch") || m.includes("network")) return "Connexion au serveur impossible. Vérifiez votre réseau.";
  return "Connexion impossible. Réessayez dans un instant.";
}

// Appelée par useFormState : en cas d'échec, on rend le message au
// formulaire au lieu de recharger la page — l'adresse e-mail déjà tapée
// reste en place, et aucun texte d'erreur ne transite par l'adresse.
export async function login(_etat, formData) {
  const supabase = createClient();

  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  const next = destinationSure(formData.get("next"));

  if (!email || !password) return { error: "Saisissez votre adresse e-mail et votre mot de passe." };

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: traduire(error.message) };

  redirect(next);
}
