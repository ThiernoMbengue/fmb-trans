"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRole } from "@/lib/supabase/role";
import { revalidatePath } from "next/cache";

async function assertAdmin() {
  const supabase = createClient();
  const { role } = await getRole(supabase);
  if (role !== "admin") return false;
  return true;
}

export async function createAccount(formData) {
  if (!(await assertAdmin())) return { error: "Accès refusé" };

  const email = (formData.get("email") || "").trim();
  const password = formData.get("password") || "";
  const nom = (formData.get("nom") || "").trim();
  const role = formData.get("role") === "admin" ? "admin" : "proprietaire";

  if (!email || !password) return { error: "Email et mot de passe requis" };
  if (password.length < 6) return { error: "Mot de passe trop court (6 caractères minimum)" };

  const admin = createAdminClient();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return { error: error.message };

  const { error: profErr } = await admin
    .from("profiles")
    .update({ nom: nom || null, role })
    .eq("id", data.user.id);
  if (profErr) return { error: profErr.message };

  revalidatePath("/comptes");
  return { success: true };
}

export async function updateAccount(id, { nom, role }) {
  if (!(await assertAdmin())) return { error: "Accès refusé" };

  const admin = createAdminClient();
  const { error } = await admin.from("profiles").update({ nom, role }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/comptes");
  return { success: true };
}

export async function deleteAccount(id) {
  if (!(await assertAdmin())) return { error: "Accès refusé" };

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error) return { error: error.message };

  revalidatePath("/comptes");
  revalidatePath("/vehicules");
  return { success: true };
}
