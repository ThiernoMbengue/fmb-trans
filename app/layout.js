import "@fontsource-variable/inter";
import "@fontsource-variable/space-grotesk";
import "./globals.css";
import AppShell from "./app-shell";
import RegisterSW from "./register-sw";
import { ToastProvider, ConfirmProvider } from "@/components/ui";
import { contextePage } from "@/lib/supabase/contexte";

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
  // Partagé avec la page affichée : identité, rôle et véhicules ne sont lus
  // qu'une fois par requête. La recherche rapide propose ces véhicules.
  const { user, role, nom, vehicles: tous } = await contextePage();
  const vehicles = tous.map(({ id, marque, immatriculation, proprietaire, chauffeur }) => ({ id, marque, immatriculation, proprietaire, chauffeur }));

  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_AVANT_RENDU }} />
      </head>
      <body>
        <RegisterSW />
        <ToastProvider>
          <ConfirmProvider>
            <AppShell user={user ? { id: user.id, email: user.email, nom } : null} role={role} vehicles={vehicles} iaActive={Boolean(process.env.ANTHROPIC_API_KEY)}>
              {children}
            </AppShell>
          </ConfirmProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
