"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  descripteurSecret,
  jetonSession,
  lireHachage,
  verifierMotDePasse,
} from "@/lib/investor-access";

export async function unlockInvestor(formData) {
  const password = (formData.get("password") || "").trim();

  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null;
  const descripteur = descripteurSecret(await lireHachage(admin));

  if (!verifierMotDePasse(descripteur, password)) {
    redirect("/investisseur?error=1");
  }

  cookies().set({
    name: "investisseur_ok",
    // Le jeton dépend du mot de passe courant : le changer invalide
    // automatiquement les accès déjà ouverts.
    value: jetonSession(descripteur),
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 jours
  });

  redirect("/investisseur");
}

export async function lockInvestor() {
  cookies().delete("investisseur_ok");
  redirect("/investisseur");
}
