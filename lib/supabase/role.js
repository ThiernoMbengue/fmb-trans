export async function getRole(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  const { data } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  return { user, role: data?.role || "proprietaire" };
}
