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
    { media: "(prefers-color-scheme: light)", color: "#14324D" },
    { media: "(prefers-color-scheme: dark)", color: "#0A1122" },
  ],
};

// Appliqué avant le premier rendu, pour éviter un éclair de thème clair.
// Sans choix enregistré, on suit le réglage du système.
const SCRIPT_THEME = `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}`;

export default async function RootLayout({ children }) {
  const supabase = createClient();
  const { user, role, nom } = await getRole(supabase);

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_THEME }} />
      </head>
      <body>
        <RegisterSW />
        <ToastProvider>
          <ConfirmProvider>
            <AppShell user={user ? { email: user.email, nom } : null} role={role}>
              {children}
            </AppShell>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
