"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, HandCoins, Bus, FileText,
  LogOut, LogIn, Moon, Sun, Menu, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const NAV_ITEMS = [
  { href: "/", label: "Tableau de bord", icon: LayoutDashboard, roles: ["admin", "proprietaire"] },
  { href: "/avances", label: "Avances", icon: HandCoins, roles: ["admin", "proprietaire"] },
  { href: "/saisie", label: "Saisie", icon: ClipboardList, roles: ["admin"] },
  { href: "/vehicules", label: "Véhicules", icon: Bus, roles: ["admin"] },
  { href: "/rapports", label: "Rapports", icon: FileText, roles: ["admin"] },
];

const ROLE_LABEL = { admin: "Gestionnaire", proprietaire: "Propriétaire" };

function ThemeToggle({ className }) {
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
      className={"flex items-center justify-center w-9 h-9 rounded-lg border border-[var(--border-line)] text-[var(--text-ink)] shrink-0 " + (className || "")}
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

function SidebarContent({ user, role, pathname, onNavigate }) {
  const router = useRouter();
  const supabase = createClient();

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  const items = NAV_ITEMS.filter((it) => role && it.roles.includes(role));

  return (
    <div className="flex flex-col h-full">
      <div className="px-5 pt-6 pb-4">
        <Link href="/" onClick={onNavigate} className="flex items-center gap-2.5">
          <img src="/logo.png" alt="FMB" className="h-8 w-auto" />
          <div className="leading-tight">
            <div className="font-display font-bold text-sm tracking-wide text-white">FMB</div>
            <div className="text-[9px] uppercase tracking-[0.18em] text-white/50">Trans-Mobilité</div>
          </div>
        </Link>
      </div>
      <div className="road-divider mx-5 text-[var(--amber)]" />

      <nav className="flex-1 px-3 py-5 flex flex-col gap-1">
        {items.map((it) => {
          const active = it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          const Icon = it.icon;
          return (
            <Link
              key={it.href}
              href={it.href}
              onClick={onNavigate}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium hover:translate-x-1"
              style={{
                backgroundColor: active ? "rgba(201,134,43,0.14)" : "transparent",
                color: active ? "#E3A947" : "rgba(255,255,255,0.75)",
              }}
            >
              <Icon size={17} strokeWidth={2} />
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 pb-3">
        <div className="road-divider text-white/20 mb-4" />
        {user ? (
          <>
            <div className="text-[10px] uppercase tracking-[0.14em] text-white/40 mb-2 truncate">
              {ROLE_LABEL[role] || ""} {user.email ? `· ${user.email}` : ""}
            </div>
            <button
              onClick={logout}
              className="w-full flex items-center gap-2 justify-center text-sm font-medium px-3 py-2.5 rounded-lg text-white/85 border border-white/15 hover:bg-white/5"
            >
              <LogOut size={14} /> Déconnexion
            </button>
          </>
        ) : (
          <Link
            href="/login"
            onClick={onNavigate}
            className="w-full flex items-center gap-2 justify-center text-sm font-medium px-3 py-2.5 rounded-lg text-white"
            style={{ backgroundColor: "var(--fleet-bright)" }}
          >
            <LogIn size={14} /> Connexion
          </Link>
        )}
        <div className="text-[10px] text-white/35 mt-4 leading-snug">
          Suivi de flotte<br />Transparence · Temps réel
        </div>
      </div>
    </div>
  );
}

export default function AppShell({ user, role, children }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => setMobileOpen(false), [pathname]);

  return (
    <div className="min-h-screen flex">
      {/* Sidebar desktop */}
      <aside
        className="hidden md:flex flex-col w-64 shrink-0 fixed inset-y-0 left-0 z-30"
        style={{ backgroundColor: "var(--bg-sidebar)" }}
      >
        <SidebarContent user={user} role={role} pathname={pathname} />
      </aside>

      {/* Sidebar mobile (drawer) */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex animate-fade-up">
          <div className="w-72 flex flex-col" style={{ backgroundColor: "var(--bg-sidebar)" }}>
            <div className="flex justify-end px-4 pt-4">
              <button onClick={() => setMobileOpen(false)} className="text-white/70">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 -mt-10">
              <SidebarContent user={user} role={role} pathname={pathname} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
          <div className="flex-1 bg-black/50" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 md:ml-64 flex flex-col min-w-0">
        <header
          className="sticky top-0 z-20 flex items-center justify-between gap-3 px-4 md:px-8 py-3 border-b backdrop-blur shadow-sm"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", borderColor: "var(--border-line)" }}
        >
          <button onClick={() => setMobileOpen(true)} className="md:hidden text-[var(--text-ink)]">
            <Menu size={20} />
          </button>
          <div className="hidden md:block text-sm text-[var(--text-slate)]">
            FMB Trans-Mobilité Services SARL
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
