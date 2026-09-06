"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, MISSING_SERVICE_KEY } from "@/lib/supabase/admin";
import { getRole } from "@/lib/supabase/role";
import { hacherMotDePasse, PARAMETRE_MOT_DE_PASSE } from "@/lib/investor-access";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") return false;
  return true;
}

export async function createAccount(formData) {
  try {
    if (!(await assertAdmin())) return { error: "Accès refusé" };

    const email = (formData.get("email") || "").trim();
    const password = formData.get("password") || "";
    const nom = (formData.get("nom") || "").trim();
    const role = formData.get("role") === "admin" ? "admin" : "proprietaire";

    if (!email || !password) return { error: "Email et mot de passe requis" };
    if (password.length < 6) return { error: "Mot de passe trop court (6 caractères minimum)" };

    const admin = createAdminClient();
    if (!admin) return { error: MISSING_SERVICE_KEY };

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) return { error: error.message };

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
    if (!(await assertAdmin())) return { error: "Accès refusé" };

    const admin = createAdminClient();
    if (!admin) return { error: MISSING_SERVICE_KEY };

    const { error } = await admin.from("profiles").update({ nom, role }).eq("id", id);
    if (error) return { error: error.message };

    revalidatePath("/comptes");
    return { success: true };
  } catch (e) {
    return { error: e?.message || "Erreur inattendue" };
  }
}

export async function deleteAccount(id) {
  try {
    if (!(await assertAdmin())) return { error: "Accès refusé" };

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
    if (role !== "admin") return { error: "Accès refusé" };

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
