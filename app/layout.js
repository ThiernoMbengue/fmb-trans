import "./globals.css";
import AppShell from "./app-shell";
import RegisterSW from "./register-sw";
import { createClient } from "@/lib/supabase/server";

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
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
