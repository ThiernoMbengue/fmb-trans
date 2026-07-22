"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, LogIn, Moon, Sun } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = window.localStorage.getItem("theme");
    const isDark = saved === "dark";
    setDark(isDark);
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  };

  return (
    <button
      onClick={toggle}
      aria-label="Basculer le thème clair / sombre"
      className="flex items-center justify-center w-8 h-8 rounded-lg border border-[var(--border-line)] text-[var(--text-ink)]"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

const COLORS = { fleet: "var(--fleet)", ink: "var(--text-ink)", line: "var(--border-line)" };

export default function NavBar({ user }) {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };

  return (
    <header
      className="w-full px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-4 border-b bg-[var(--bg-surface)]"
      style={{ borderColor: COLORS.line }}
    >
      <Link href="/" className="flex items-center gap-2.5">
        <img src="/logo.png" alt="FMB Trans-Mobilité Services" className="h-8 w-auto" />
        <div
          className="text-sm font-semibold tracking-tight"
          style={{ fontFamily: "'Space Grotesk','Inter',sans-serif", color: COLORS.ink }}
        >
          FMB TRANS-MOBILITÉ SERVICES
        </div>
      </Link>

      <nav className="flex items-center gap-2 text-sm font-medium">
        <ThemeToggle />
        <Link href="/" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
          Dashboard
        </Link>
        {user ? (
          <>
            <Link href="/saisie" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
              Saisie
            </Link>
            <Link href="/avances" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
              Avances
            </Link>
            <Link href="/vehicules" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
              Véhicules
            </Link>
            <Link href="/rapports" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
              Rapports
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: "var(--red)" }}
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </>
        ) : (
          <Link
            href="/login"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white"
            style={{ backgroundColor: COLORS.fleet }}
          >
            <LogIn size={14} /> Connexion
          </Link>
        )}
      </nav>
    </header>
  );
}
