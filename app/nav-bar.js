"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bus, LogOut, LogIn } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const COLORS = { fleet: "#1F4E78", ink: "#14324D", line: "#E4E9EF" };

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
      className="w-full px-6 md:px-10 py-4 flex flex-wrap items-center justify-between gap-4 border-b bg-white"
      style={{ borderColor: COLORS.line }}
    >
      <Link href="/" className="flex items-center gap-3">
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: COLORS.fleet }}
        >
          <Bus size={18} color="#fff" strokeWidth={2.25} />
        </div>
        <div
          className="text-sm font-semibold tracking-tight"
          style={{ fontFamily: "'Space Grotesk','Inter',sans-serif", color: COLORS.ink }}
        >
          FMB TRANS-MOBILITÉ SERVICES
        </div>
      </Link>

      <nav className="flex items-center gap-2 text-sm font-medium">
        <Link href="/" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
          Dashboard
        </Link>
        {user ? (
          <>
            <Link href="/saisie" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
              Saisie
            </Link>
            <Link href="/vehicules" className="px-3 py-1.5 rounded-lg" style={{ color: COLORS.ink }}>
              Véhicules
            </Link>
            <button
              onClick={logout}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-white"
              style={{ backgroundColor: "#B3452C" }}
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
