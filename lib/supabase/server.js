import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export function createClient() {
  const cookieStore = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(aEcrire) {
          try {
            aEcrire.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Appelé pendant l'affichage d'une page : les cookies ne peuvent
            // pas y être écrits. Sans conséquence — le middleware renouvelle
            // la session avant chaque page.
          }
        },
      },
    }
  );
}
