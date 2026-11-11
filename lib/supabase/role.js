// Identité et rôle de la personne connectée, en un seul aller-retour.
export async function getRole(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null, nom: null };

  const { data } = await supabase.from("profiles").select("role, nom").eq("id", user.id).maybeSingle();

  return { user, role: data?.role || "proprietaire", nom: data?.nom || null };
}
