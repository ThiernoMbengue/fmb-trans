"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, HandCoins, Bus, FileText, Users, Receipt,
  NotebookPen, LogOut, LogIn, Moon, Sun, Menu, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initiales } from "@/lib/format";

// `onglet` : présent dans la barre du bas sur mobile, dans cet ordre.
const NAV = [
  {
    titre: "Pilotage",
    items: [
      { href: "/", label: "Tableau de bord", court: "Accueil", icon: LayoutDashboard, roles: ["admin", "proprietaire"], onglet: 1 },
      { href: "/paiements", label: "Paiements", court: "Paiements", icon: Receipt, roles: ["admin", "proprietaire"], onglet: 3 },
      { href: "/avances", label: "Avances", court: "Avances", icon: HandCoins, roles: ["admin", "proprietaire"], onglet: 4, ongletRoles: ["proprietaire"] },
      { href: "/rapports", label: "Rapports", court: "Rapports", icon: FileText, roles: ["admin", "proprietaire"], onglet: 5, ongletRoles: ["proprietaire"] },
    ],
  },
  {
    titre: "Gestion",
    items: [
      { href: "/saisie", label: "Saisie", court: "Saisie", icon: ClipboardList, roles: ["admin"], onglet: 2 },
      { href: "/vehicules", label: "Véhicules", icon: Bus, roles: ["admin"] },
      { href: "/carnet", label: "Carnet de bord", court: "Carnet", icon: NotebookPen, roles: ["admin"], onglet: 4 },
      { href: "/comptes", label: "Comptes", icon: Users, roles: ["admin"] },
    ],
  },
];

const ROLE_LABEL = { admin: "Gestionnaire", proprietaire: "Propriétaire" };

const estActif = (href, pathname) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function Logo({ taille = 36 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white"
      style={{ width: taille, height: taille }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={taille} height={taille} className="h-full w-full object-cover" />
    </span>
  );
}

function ThemeToggle({ className = "" }) {
  const [dark, setDark] = useState(false);

  // Le thème a déjà été appliqué avant le rendu (script dans <head>) : on se
  // contente de lire l'état réel du document.
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { window.localStorage.setItem("theme", next ? "dark" : "light"); } catch {}
  };

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Passer au thème clair" : "Passer au thème sombre"}
      title={dark ? "Thème clair" : "Thème sombre"}
      className={"btn-icone " + className}
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}

function Navigation({ user, role, pathname, onNavigate, onLogout }) {
  const groupes = NAV
    .map((g) => ({ ...g, items: g.items.filter((it) => role && it.roles.includes(role)) }))
    .filter((g) => g.items.length);

  return (
    <div className="flex h-full flex-col">
      <Link href="/" onClick={onNavigate} className="flex items-center gap-3 px-5 pb-4 pt-5">
        <Logo />
        <div className="min-w-0 leading-tight">
          <div className="font-display text-[15px] font-bold tracking-wide text-white">FMB Trans</div>
          <div className="text-[10px] uppercase tracking-[0.16em] text-white/50">Mobilité Services</div>
        </div>
      </Link>
      <div className="road-divider mx-5 text-[var(--amber)]" />

      <nav className="defilement-fin flex-1 overflow-y-auto px-3 py-4" aria-label="Navigation principale">
        {groupes.map((g) => (
          <div key={g.titre} className="mb-4 last:mb-0">
            {groupes.length > 1 && (
              <div className="px-3 pb-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/35">
                {g.titre}
              </div>
            )}
            <div className="flex flex-col gap-0.5">
              {g.items.map((it) => {
                const actif = estActif(it.href, pathname);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={onNavigate}
                    aria-current={actif ? "page" : undefined}
                    className={
                      "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium " +
                      (actif ? "bg-white/10 text-white" : "text-white/70 hover:bg-white/5 hover:text-white")
                    }
                  >
                    {actif && <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-[#E3A947]" />}
                    <Icon size={17} strokeWidth={2} className={actif ? "text-[#E3A947]" : "text-white/60 group-hover:text-white/90"} />
                    {it.label}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-white/10 p-3">
        {user ? (
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
              {initiales(user.nom || user.email)}
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-sm font-medium text-white">{user.nom || user.email}</div>
              <div className="truncate text-[11px] text-white/45">{ROLE_LABEL[role] || ""}</div>
            </div>
            <button
              onClick={onLogout}
              aria-label="Se déconnecter"
              title="Se déconnecter"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <Link href="/login" onClick={onNavigate} className="btn w-full text-white" style={{ backgroundColor: "var(--fleet-bright)" }}>
            <LogIn size={15} /> Connexion
          </Link>
        )}
      </div>
    </div>
  );
}

export default function AppShell({ user, role, children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [tiroir, setTiroir] = useState(false);

  useEffect(() => setTiroir(false), [pathname]);

  // Le tiroir ouvert, la page derrière ne doit pas défiler ; Échap le ferme.
  useEffect(() => {
    if (!tiroir) return;
    const touche = (e) => { if (e.key === "Escape") setTiroir(false); };
    window.addEventListener("keydown", touche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", touche);
      document.body.style.overflow = avant;
    };
  }, [tiroir]);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    // Les pages mises en cache pour l'usage hors ligne contiennent des
    // données du compte : elles ne doivent pas survivre à la déconnexion.
    try {
      if ("caches" in window) {
        const cles = await caches.keys();
        await Promise.all(cles.map((c) => caches.delete(c)));
      }
    } catch {}
    router.push("/login");
    router.refresh();
  };

  // La page de connexion occupe tout l'écran, sans menu.
  if (pathname === "/login") return <>{children}</>;

  // Visiteur non connecté (espace investisseur) : simple bandeau, pas de menu.
  if (!user) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col">
        <header
          className="sticky top-0 z-20 border-b backdrop-blur"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)",
            borderColor: "var(--border-line)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
            <Link href="/login" className="flex min-w-0 items-center gap-2.5">
              <Logo taille={32} />
              <span className="truncate font-display text-sm font-bold text-[var(--text-ink)]">FMB Trans-Mobilité Services</span>
            </Link>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <Link href="/login" className="btn btn-contour btn-petit">
                <LogIn size={14} /> <span className="hidden sm:inline">Connexion</span>
              </Link>
            </div>
          </div>
        </header>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  const tous = NAV.flatMap((g) => g.items).filter((it) => it.roles.includes(role));
  const onglets = tous
    .filter((it) => it.onglet && (!it.ongletRoles || it.ongletRoles.includes(role)))
    .sort((a, b) => a.onglet - b.onglet)
    .slice(0, 4);
  const courante = tous.find((it) => estActif(it.href, pathname));

  return (
    <div className="flex min-h-screen min-h-[100dvh]">
      {/* Menu latéral — grands écrans */}
      <aside
        className="fixed inset-y-0 left-0 z-30 hidden w-64 shrink-0 flex-col lg:flex"
        style={{ backgroundColor: "var(--bg-sidebar)" }}
      >
        <Navigation user={user} role={role} pathname={pathname} onLogout={logout} />
      </aside>

      {/* Tiroir — téléphones et tablettes */}
      {tiroir && (
        <div className="fixed inset-0 z-50 flex lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div
            className="animate-glisse-gauche relative flex w-[19rem] max-w-[85vw] flex-col"
            style={{
              backgroundColor: "var(--bg-sidebar)",
              paddingTop: "env(safe-area-inset-top, 0px)",
              paddingBottom: "env(safe-area-inset-bottom, 0px)",
            }}
          >
            <button
              onClick={() => setTiroir(false)}
              aria-label="Fermer le menu"
              className="absolute right-3 z-10 flex h-9 w-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10 hover:text-white"
              style={{ top: "calc(env(safe-area-inset-top, 0px) + 1.1rem)" }}
            >
              <X size={19} />
            </button>
            <Navigation user={user} role={role} pathname={pathname} onNavigate={() => setTiroir(false)} onLogout={logout} />
          </div>
          <div className="animate-fondu flex-1 bg-black/50 backdrop-blur-[2px]" onClick={() => setTiroir(false)} />
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:ml-64">
        <header
          className="hors-impression sticky top-0 z-20 border-b backdrop-blur"
          style={{
            backgroundColor: "color-mix(in srgb, var(--bg-surface) 86%, transparent)",
            borderColor: "var(--border-line)",
            paddingTop: "env(safe-area-inset-top, 0px)",
          }}
        >
          <div className="flex h-14 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setTiroir(true)} aria-label="Ouvrir le menu" className="btn-icone lg:hidden">
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--text-ink)] lg:hidden">
                  {courante?.label || "FMB Trans"}
                </div>
                <div className="hidden truncate text-sm text-[var(--text-slate)] lg:block">
                  FMB Trans-Mobilité Services SARL
                </div>
              </div>
            </div>
            <ThemeToggle />
          </div>
        </header>

        <div className="marge-contenu flex-1">{children}</div>
      </div>

      {/* Barre d'onglets — téléphones et tablettes */}
      <nav
        aria-label="Navigation rapide"
        className="hors-impression fixed inset-x-0 bottom-0 z-30 border-t backdrop-blur lg:hidden"
        style={{
          backgroundColor: "color-mix(in srgb, var(--bg-surface) 92%, transparent)",
          borderColor: "var(--border-line)",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <div className="mx-auto grid max-w-xl" style={{ gridTemplateColumns: `repeat(${onglets.length + 1}, minmax(0, 1fr))` }}>
          {onglets.map((it) => {
            const actif = estActif(it.href, pathname);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={actif ? "page" : undefined}
                className="relative flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[10.5px] font-medium"
                style={{ color: actif ? "var(--fleet-bright)" : "var(--text-slate-light)" }}
              >
                {actif && <span className="absolute top-0 h-[3px] w-8 rounded-b-full" style={{ backgroundColor: "var(--fleet-bright)" }} />}
                <Icon size={20} strokeWidth={actif ? 2.4 : 2} />
                <span className="max-w-full truncate px-1">{it.court || it.label}</span>
              </Link>
            );
          })}
          <button
            onClick={() => setTiroir(true)}
            className="flex h-[3.75rem] flex-col items-center justify-center gap-1 text-[10.5px] font-medium text-[var(--text-slate-light)]"
          >
            <Menu size={20} />
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
