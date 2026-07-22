import "./globals.css";
import NavBar from "./nav-bar";
import { createClient } from "@/lib/supabase/server";

export const metadata = {
  title: "FMB Trans-Mobilité Services",
  description: "Saisie & suivi des versements de la flotte",
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
        <NavBar user={user} />
        {children}
      </body>
    </html>
  );
}
