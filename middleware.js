import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

const PROTECTED_PATHS = ["/saisie", "/vehicules", "/avances", "/rapports", "/comptes", "/paiements", "/carnet"];
const PUBLIC_PATHS = ["/login"];

export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        // Une session renouvelée est écrite à deux endroits : dans la requête,
        // pour que la page affichée juste après la voie, et dans la réponse,
        // pour que le navigateur la conserve.
        setAll(aEcrire) {
          aEcrire.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          aEcrire.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Contrôle de la session, et renouvellement si elle arrive à expiration.
  // getClaims vérifie la signature du jeton sur place quand le projet le
  // permet, sans appel réseau ; sinon, ou au moindre doute, on interroge le
  // service d'authentification comme avant.
  let connecte = false;
  try {
    const { data } = await supabase.auth.getClaims();
    connecte = Boolean(data?.claims?.sub);
  } catch {}
  if (!connecte) {
    const { data: { user } } = await supabase.auth.getUser();
    connecte = Boolean(user);
  }

  const pathname = request.nextUrl.pathname;
  const isProtected =
    !PUBLIC_PATHS.includes(pathname) &&
    (pathname === "/" || PROTECTED_PATHS.some((p) => pathname.startsWith(p)));

  if (isProtected && !connecte) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  // Toutes les pages et les routes d'API, pour que la session soit toujours
  // renouvelée ici — jamais les fichiers statiques.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)$).*)"],
};
