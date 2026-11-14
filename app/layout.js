import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import AppShell from "./app-shell";
import RegisterSW from "./register-sw";
import { ToastProvider, ConfirmProvider } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";

export const metadata = {
  title: {
    default: "FMB Trans-Mobilité Services",
    template: "%s · FMB Trans",
  },
  description: "Suivi de flotte — versements, avances et rapports",
  manifest: "/manifest.json",
  applicationName: "FMB Trans",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FMB Trans",
  },
  formatDetection: { telephone: false },
  // Outil de gestion privé : rien ici n'a vocation à être indexé.
  robots: { index: false, follow: false },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // Laisse la page occuper tout l'écran sur les téléphones à encoche ; les
  // marges de sécurité sont gérées par env(safe-area-inset-*).
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFFFFF" },
    { media: "(prefers-color-scheme: dark)", color: "#121823" },
  ],
};

// Appliqué avant le premier rendu, pour éviter un éclair de thème clair ou un
// menu qui se replie sous les yeux. Sans choix enregistré, le thème suit le
// réglage du système.
const SCRIPT_AVANT_RENDU = `try{var d=document.documentElement,t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){d.classList.add('dark')}if(localStorage.getItem('menu')==='reduit'){d.dataset.menu='reduit'}}catch(e){}`;

export default async function RootLayout({ children }) {
  const supabase = createClient();
  const { user, role, nom } = await getRole(supabase);

  // La recherche rapide propose les véhicules : la liste est courte, et les
  // règles d'accès de la base n'y laissent que ceux de la personne connectée.
  let vehicles = [];
  if (user) {
    const { data } = await supabase
      .from("vehicles")
      .select("id, marque, immatriculation, proprietaire, chauffeur")
      .order("created_at", { ascending: true });
    vehicles = data || [];
  }

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_AVANT_RENDU }} />
      </head>
      <body>
        <RegisterSW />
        <ToastProvider>
          <ConfirmProvider>
            <AppShell user={user ? { email: user.email, nom } : null} role={role} vehicles={vehicles}>
              {children}
            </AppShell>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
