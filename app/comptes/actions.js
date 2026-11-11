"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, MISSING_SERVICE_KEY } from "@/lib/supabase/admin";
import { getRole } from "@/lib/supabase/role";
import { hacherMotDePasse, PARAMETRE_MOT_DE_PASSE } from "@/lib/investor-access";
import { revalidatePath } from "next/cache";

// Rend l'identifiant du gestionnaire connecté, ou null si la personne n'a
// pas le droit d'être ici.
async function assertAdmin() {
  const supabase = createClient();
  const { role, user } = await getRole(supabase);
  return role === "admin" && user ? user.id : null;
}

const REFUS = "Action réservée au gestionnaire.";

const traduire = (message = "") => {
  const m = message.toLowerCase();
  if (m.includes("already") && m.includes("registered")) return "Un compte existe déjà avec cette adresse e-mail.";
  if (m.includes("invalid") && m.includes("email")) return "Cette adresse e-mail n'est pas valide.";
  if (m.includes("password")) return "Mot de passe refusé : il doit comporter au moins 6 caractères.";
  return message || "Erreur inattendue";
};

export async function createAccount(formData) {
  try {
    if (!(await assertAdmin())) return { error: REFUS };

    const email = (formData.get("email") || "").trim().toLowerCase();
    const password = formData.get("password") || "";
    const nom = (formData.get("nom") || "").trim();
    const role = formData.get("role") === "admin" ? "admin" : "proprietaire";

    if (!email || !password) return { error: "L'adresse e-mail et le mot de passe sont obligatoires." };
    if (password.length < 6) return { error: "Mot de passe trop court (6 caractères minimum)" };

    const admin = createAdminClient();
    if (!admin) return { error: MISSING_SERVICE_KEY };

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) return { error: traduire(error.message) };

    const { error: profErr } = await admin
      .from("profiles")
      .upsert({ id: data.user.id, email, nom: nom || null, role }, { onConflict: "id" });
    if (profErr) return { error: profErr.message };

    revalidatePath("/comptes");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function updateAccount(id, { nom, role }) {
  try {
    const moi = await assertAdmin();
    if (!moi) return { error: REFUS };
    if (!id) return { error: "Compte manquant" };

    const modifs = { nom: String(nom || "").trim() || null };
    if (role === "admin" || role === "proprietaire") {
      // Un gestionnaire ne peut pas se retirer ses propres droits : il
      // risquerait de laisser l'application sans aucun gestionnaire.
      if (id === moi && role !== "admin") {
        return { error: "Vous ne pouvez pas retirer vos propres droits de gestionnaire." };
      }
      modifs.role = role;
    }

    const admin = createAdminClient();
    if (!admin) return { error: MISSING_SERVICE_KEY };

    const { error } = await admin.from("profiles").update(modifs).eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/comptes");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deleteAccount(id) {
  try {
    const moi = await assertAdmin();
    if (!moi) return { error: REFUS };
    if (id === moi) return { error: "Vous ne pouvez pas supprimer votre propre compte." };

    const admin = createAdminClient();
    if (!admin) return { error: MISSING_SERVICE_KEY };

    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) return { error: error.message };

    revalidatePath("/comptes");
    revalidatePath("/vehicules");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

// Définit le mot de passe de l'espace investisseur. Il est enregistré haché :
// personne, pas même le gestionnaire, ne peut le relire ensuite — il ne peut
// que le remplacer. Changer le mot de passe referme les accès en cours.
export async function setInvestorPassword(formData) {
  try {
    const supabase = createClient();
    const { role } = await getRole(supabase);
    if (role !== "admin") return { error: REFUS };

    const motDePasse = (formData.get("password") || "").trim();
    if (motDePasse.length < 4) {
      return { error: "Le mot de passe doit comporter au moins 4 caractères" };
    }

    const admin = createAdminClient();
    if (!admin) return { error: MISSING_SERVICE_KEY };

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await admin.from("app_settings").upsert(
      {
        cle: PARAMETRE_MOT_DE_PASSE,
        valeur: hacherMotDePasse(motDePasse),
        updated_at: new Date().toISOString(),
        updated_by: user?.id,
      },
      { onConflict: "cle" }
    );
    if (error) return { error: error.message };

    revalidatePath("/comptes");
    revalidatePath("/investisseur");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}
