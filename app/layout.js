import "./globals.css";
import AppShell from "./app-shell";
import RegisterSW from "./register-sw";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";

export const metadata = {
  title: "FMB Trans-Mobilité Services",
  description: "Suivi de flotte — versements, avances et rapports",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "FMB Trans",
  },
};

export const viewport = {
  themeColor: "#14324D",
};

export default async function RootLayout({ children }) {
  const supabase = createClient();
  const { user, role } = await getRole(supabase);

  return (
    <html lang="fr">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('theme')==='dark'){document.documentElement.classList.add('dark')}}catch(e){}`,
          }}
        />
      </head>
      <body style={{ fontFamily: "'Inter', ui-sans-serif, system-ui" }}>
        <RegisterSW />
        <AppShell user={user} role={role}>{children}</AppShell>
      </body>
    </html>
  );
}
