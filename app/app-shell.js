"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ClipboardList, HandCoins, Bus, FileText, Users, Receipt,
  NotebookPen, LogOut, LogIn, Moon, Sun, Search, PanelLeftClose, PanelLeftOpen,
  LayoutGrid, X, Plus, TrendingUp, FileDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { initiales } from "@/lib/format";
import { choisirVehicule } from "@/lib/vehicule-courant";
import Palette from "@/components/palette";

// `onglet` : place dans la barre du bas sur téléphone (les autres pages
// se trouvent derrière « Plus »).
const NAV = [
  {
    titre: "Pilotage",
    items: [
      { href: "/", label: "Tableau de bord", court: "Accueil", icon: LayoutDashboard, roles: ["admin", "proprietaire"], onglet: 1 },
      { href: "/paiements", label: "Paiements", court: "Paiements", icon: Receipt, roles: ["admin", "proprietaire"], onglet: 3 },
      { href: "/avances", label: "Avances", court: "Avances", icon: HandCoins, roles: ["admin", "proprietaire"], onglet: 4 },
      { href: "/rapports", label: "Rapports", court: "Rapports", icon: FileText, roles: ["admin", "proprietaire"], onglet: 6 },
    ],
  },
  {
    titre: "Gestion",
    items: [
      { href: "/saisie", label: "Saisie", court: "Saisie", icon: ClipboardList, roles: ["admin"], onglet: 2 },
      { href: "/vehicules", label: "Véhicules", court: "Véhicules", icon: Bus, roles: ["admin"], onglet: 7 },
      { href: "/carnet", label: "Carnet de bord", court: "Carnet", icon: NotebookPen, roles: ["admin"], onglet: 5 },
      { href: "/comptes", label: "Comptes", court: "Comptes", icon: Users, roles: ["admin"], onglet: 8 },
    ],
  },
];

const ROLE_LABEL = { admin: "Gestionnaire", proprietaire: "Propriétaire" };
// Pages qui travaillent sur un véhicule : y changer de véhicule ne fait pas
// quitter la page.
const PAGES_VEHICULE = ["/", "/saisie", "/paiements", "/avances", "/rapports"];

const estActif = (href, pathname) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

function Logo({ taille = 34 }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-white"
      style={{ width: taille, height: taille, boxShadow: "0 0 0 1px rgba(15,27,45,0.08)" }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/icon-192.png" alt="" width={taille} height={taille} className="h-full w-full object-cover" />
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Thème                                                               */
/* ------------------------------------------------------------------ */

function useTheme() {
  const [sombre, setSombre] = useState(false);

  // Le thème a déjà été appliqué avant le rendu (script dans <head>) : on se
  // contente de lire l'état réel du document.
  useEffect(() => {
    setSombre(document.documentElement.classList.contains("dark"));
  }, []);

  const basculer = useCallback(() => {
    const suivant = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", suivant);
    try { window.localStorage.setItem("theme", suivant ? "dark" : "light"); } catch {}
    setSombre(suivant);
  }, []);

  return [sombre, basculer];
}

function BoutonTheme({ sombre, basculer }) {
  return (
    <button
      onClick={basculer}
      aria-label={sombre ? "Passer au thème clair" : "Passer au thème sombre"}
      title={sombre ? "Thème clair" : "Thème sombre"}
      className="btn-icone nu"
    >
      {sombre ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Progression : un trait en haut de l'écran pendant le changement de   */
/* page, pour que chaque clic réponde tout de suite.                    */
/* ------------------------------------------------------------------ */

function useProgression(pathname) {
  const [enCours, setEnCours] = useState(false);
  const garde = useRef(null);

  const demarrer = useCallback(() => {
    setEnCours(true);
    clearTimeout(garde.current);
    // Garde-fou : si la navigation n'aboutit pas, le trait ne reste pas figé.
    garde.current = setTimeout(() => setEnCours(false), 10000);
  }, []);

  useEffect(() => {
    setEnCours(false);
    clearTimeout(garde.current);
  }, [pathname]);

  useEffect(() => {
    const surClic = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const lien = e.target.closest?.("a[href]");
      if (!lien || lien.target === "_blank" || lien.hasAttribute("download")) return;
      const url = new URL(lien.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;
      demarrer();
    };
    document.addEventListener("click", surClic);
    return () => document.removeEventListener("click", surClic);
  }, [demarrer]);

  return [enCours, demarrer];
}

/* ------------------------------------------------------------------ */
/* Menu latéral (tablette : rail d'icônes, ordinateur : menu complet)   */
/* ------------------------------------------------------------------ */

function MenuLateral({ groupes, pathname }) {
  const basculer = () => {
    const racine = document.documentElement;
    const reduit = racine.dataset.menu !== "reduit";
    if (reduit) racine.dataset.menu = "reduit";
    else delete racine.dataset.menu;
    try { window.localStorage.setItem("menu", reduit ? "reduit" : "complet"); } catch {}
  };

  return (
    <aside className="menu-lateral hors-impression fixed inset-y-0 left-0 z-30 hidden flex-col overflow-hidden md:flex">
      <Link href="/" className="flex h-[3.5rem] shrink-0 items-center gap-3 px-[1.15rem]" aria-label="FMB Trans — tableau de bord">
        <Logo />
        <span className="menu-libelle min-w-0 leading-tight">
          <span className="font-display block truncate text-[15px] font-bold text-white">FMB Trans</span>
          <span className="block truncate text-[10px] uppercase tracking-[0.16em] text-white/45">Mobilité Services</span>
        </span>
      </Link>
      <div className="road-divider mx-[1.15rem] shrink-0 text-[#E3A947]" />

      <nav className="sans-barre flex-1 overflow-y-auto overflow-x-visible px-3 py-4" aria-label="Navigation principale">
        {groupes.map((g, gi) => (
          <div key={g.titre} className="mb-5 last:mb-0">
            {groupes.length > 1 && (
              <>
                <div className="menu-libelle px-3 pb-2 text-[10.5px] font-semibold uppercase tracking-[0.14em] text-white/35">{g.titre}</div>
                {gi > 0 && <div className="menu-rail-seul mx-3 mb-4 h-px bg-white/10" />}
              </>
            )}
            <div className="flex flex-col gap-1">
              {g.items.map((it) => {
                const actif = estActif(it.href, pathname);
                const Icon = it.icon;
                return (
                  <Link key={it.href} href={it.href} aria-current={actif ? "page" : undefined} aria-label={it.label} className="menu-lien">
                    <Icon size={18} strokeWidth={actif ? 2.2 : 1.9} className="shrink-0" style={{ color: actif ? "#E3A947" : undefined }} />
                    <span className="menu-libelle truncate">{it.label}</span>
                    <span className="menu-bulle" aria-hidden="true">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="hidden shrink-0 border-t border-white/10 p-3 lg:block">
        <button onClick={basculer} className="menu-lien w-full" aria-label="Réduire ou déployer le menu">
          <PanelLeftClose size={18} strokeWidth={1.9} className="menu-libelle shrink-0" />
          <PanelLeftOpen size={18} strokeWidth={1.9} className="menu-rail-seul shrink-0" />
          <span className="menu-libelle truncate">Réduire le menu</span>
          <span className="menu-bulle" aria-hidden="true">Déployer le menu</span>
        </button>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Menu du compte (en haut à droite)                                    */
/* ------------------------------------------------------------------ */

function MenuCompte({ user, role, sombre, basculerTheme, onLogout }) {
  const [ouvert, setOuvert] = useState(false);
  const zone = useRef(null);

  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e) => { if (!zone.current?.contains(e.target)) setOuvert(false); };
    const touche = (e) => { if (e.key === "Escape") setOuvert(false); };
    document.addEventListener("pointerdown", dehors);
    document.addEventListener("keydown", touche);
    return () => {
      document.removeEventListener("pointerdown", dehors);
      document.removeEventListener("keydown", touche);
    };
  }, [ouvert]);

  const nom = user.nom || user.email;

  return (
    <div ref={zone} className="relative">
      <button
        onClick={() => setOuvert((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={ouvert}
        aria-label="Mon compte"
        className="flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2 ring-transparent transition-shadow hover:ring-[color-mix(in_srgb,var(--fleet-bright)_35%,transparent)]"
        style={{ background: "linear-gradient(135deg, #2767B4, #17426D)" }}
      >
        {initiales(nom)}
      </button>

      {ouvert && (
        <div
          role="menu"
          className="animate-descend absolute right-0 top-[calc(100%+0.5rem)] z-50 w-64 overflow-hidden rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface)]"
          style={{ boxShadow: "var(--shadow-pop)" }}
        >
          <div className="border-b border-[var(--border-line)] px-4 py-3.5">
            <div className="truncate text-sm font-semibold text-[var(--text-ink)]">{nom}</div>
            {user.nom && <div className="truncate text-xs text-[var(--text-slate-light)]">{user.email}</div>}
            <span
              className="pastille mt-2"
              style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 12%, transparent)", color: "var(--fleet-bright)" }}
            >
              {ROLE_LABEL[role] || "Compte"}
            </span>
          </div>
          <div className="p-1.5">
            <button role="menuitem" onClick={basculerTheme} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-[var(--text-ink)] hover:bg-[var(--bg-muted)]">
              {sombre ? <Sun size={16} className="text-[var(--text-slate)]" /> : <Moon size={16} className="text-[var(--text-slate)]" />}
              {sombre ? "Thème clair" : "Thème sombre"}
            </button>
            {role === "admin" && (
              <Link role="menuitem" href="/investisseur" onClick={() => setOuvert(false)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-[var(--text-ink)] hover:bg-[var(--bg-muted)]">
                <TrendingUp size={16} className="text-[var(--text-slate)]" /> Espace investisseur
              </Link>
            )}
          </div>
          <div className="border-t border-[var(--border-line)] p-1.5">
            <button role="menuitem" onClick={onLogout} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-[var(--red)] hover:bg-[color-mix(in_srgb,var(--red)_8%,transparent)]">
              <LogOut size={16} /> Se déconnecter
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Gabarit                                                             */
/* ------------------------------------------------------------------ */

export default function AppShell({ user, role, vehicles = [], children }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sombre, basculerTheme] = useTheme();
  const [enCours, demarrer] = useProgression(pathname);
  const [palette, setPalette] = useState(false);
  const [plus, setPlus] = useState(false);

  // La recherche rapide se ferme d'elle-même au moment du choix : la fermer
  // ici aussi la refermerait si on la rouvre juste après un changement de page.
  useEffect(() => { setPlus(false); }, [pathname]);

  // Ctrl+K (ou ⌘K) ouvre la recherche rapide depuis n'importe quelle page.
  useEffect(() => {
    if (!user) return;
    const touche = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((o) => !o);
      }
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [user]);

  // Feuille « Plus » ouverte : la page derrière ne défile pas, Échap ferme.
  useEffect(() => {
    if (!plus) return;
    const touche = (e) => { if (e.key === "Escape") setPlus(false); };
    window.addEventListener("keydown", touche);
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", touche);
      document.body.style.overflow = avant;
    };
  }, [plus]);

  const logout = useCallback(async () => {
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
  }, [router]);

  const aller = useCallback((href) => {
    if (href !== pathname) demarrer();
    router.push(href);
  }, [router, pathname, demarrer]);

  const groupes = useMemo(
    () => NAV.map((g) => ({ ...g, items: g.items.filter((it) => role && it.roles.includes(role)) })).filter((g) => g.items.length),
    [role]
  );
  const tous = useMemo(() => groupes.flatMap((g) => g.items), [groupes]);

  const elementsPalette = useMemo(() => {
    if (!user) return [];
    const pages = tous.map((it) => ({
      id: "page:" + it.href, groupe: "Aller à", label: it.label, icone: it.icon, action: () => aller(it.href),
    }));
    const actions = [
      role === "admin" && { id: "act:saisie", groupe: "Actions", label: "Saisir un versement", detail: "Recette et dépenses du jour", icone: Plus, motsCles: "nouvelle saisie ajouter recette", action: () => aller("/saisie") },
      role === "admin" && { id: "act:paiement", groupe: "Actions", label: "Enregistrer un paiement", detail: "Régler un décompte mensuel", icone: Receipt, motsCles: "payer proprietaire versement", action: () => aller("/paiements") },
      role === "admin" && { id: "act:carnet", groupe: "Actions", label: "Ajouter une note au carnet", detail: "Dette, échéance, pense-bête", icone: NotebookPen, motsCles: "note dette echeance document", action: () => aller("/carnet") },
      { id: "act:rapport", groupe: "Actions", label: "Générer un document PDF", detail: "Relevé de versements, d'avances, décompte", icone: FileDown, motsCles: "pdf releve rapport telecharger", action: () => aller("/rapports") },
      { id: "act:theme", groupe: "Actions", label: sombre ? "Passer au thème clair" : "Passer au thème sombre", icone: sombre ? Sun : Moon, motsCles: "theme sombre clair nuit jour", action: basculerTheme },
      { id: "act:logout", groupe: "Actions", label: "Se déconnecter", icone: LogOut, motsCles: "deconnexion quitter sortir", action: logout },
    ].filter(Boolean);
    const vehicules = vehicles.map((v) => ({
      id: "veh:" + v.id,
      groupe: "Véhicules",
      label: `${v.marque} — ${v.immatriculation}`,
      detail: [v.proprietaire, v.chauffeur && `chauffeur ${v.chauffeur}`].filter(Boolean).join(" · ") || "Afficher ce véhicule",
      icone: Bus,
      action: () => {
        choisirVehicule(v.id);
        if (!PAGES_VEHICULE.includes(pathname)) aller("/");
      },
    }));
    return [...pages, ...actions, ...vehicules];
  }, [user, tous, role, vehicles, sombre, basculerTheme, logout, aller, pathname]);

  // La page de connexion occupe tout l'écran, sans menu.
  if (pathname === "/login") return <>{children}</>;

  // Visiteur non connecté (espace investisseur) : simple bandeau, pas de menu.
  if (!user) {
    return (
      <div className="flex min-h-screen min-h-[100dvh] flex-col">
        <header
          className="hors-impression sticky top-0 z-20 border-b border-[var(--border-line)] backdrop-blur-md"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 88%, transparent)", paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="mx-auto flex h-14 max-w-[76rem] items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
            <Link href="/login" className="flex min-w-0 items-center gap-2.5">
              <Logo taille={32} />
              <span className="font-display truncate text-[15px] font-bold text-[var(--text-ink)]">FMB Trans-Mobilité Services</span>
            </Link>
            <div className="flex shrink-0 items-center gap-1.5">
              <BoutonTheme sombre={sombre} basculer={basculerTheme} />
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

  const tries = [...tous].sort((a, b) => a.onglet - b.onglet);
  // Cinq cases au plus : quatre pages et « Plus », ou toutes les pages si
  // elles tiennent.
  const onglets = tries.length <= 5 ? tries : tries.slice(0, 4);
  const reste = tries.length <= 5 ? [] : tries.slice(4);
  const resteActif = reste.some((it) => estActif(it.href, pathname));

  return (
    <div className="min-h-screen min-h-[100dvh]">
      {enCours && <div className="barre-progression" aria-hidden="true" />}

      <MenuLateral groupes={groupes} pathname={pathname} />

      <div className="contenu-principal flex min-h-screen min-h-[100dvh] min-w-0 flex-col">
        <header
          className="hors-impression sticky top-0 z-20 border-b border-[var(--border-line)] backdrop-blur-md"
          style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 86%, transparent)", paddingTop: "env(safe-area-inset-top, 0px)" }}
        >
          <div className="flex h-14 items-center gap-3 px-4 sm:px-6 lg:px-8">
            {/* Téléphone : la marque. Au-delà, elle est dans le menu latéral. */}
            <Link href="/" className="flex min-w-0 items-center gap-2.5 md:hidden" aria-label="FMB Trans — tableau de bord">
              <Logo taille={32} />
              <span className="font-display truncate text-[15px] font-bold text-[var(--text-ink)]">FMB Trans</span>
            </Link>

            <button
              onClick={() => setPalette(true)}
              className="hidden h-9 w-full max-w-xs items-center gap-2.5 rounded-[10px] border border-[var(--border-line)] bg-[var(--bg-muted)] px-3 text-sm text-[var(--text-slate-light)] hover:border-[var(--border-strong)] hover:text-[var(--text-slate)] md:flex"
            >
              <Search size={15} className="shrink-0" />
              <span className="flex-1 truncate text-left">Rechercher…</span>
              <span className="flex shrink-0 items-center gap-1"><span className="touche px-1.5">Ctrl</span><span className="touche">K</span></span>
            </button>

            <div className="ml-auto flex shrink-0 items-center gap-1">
              <button onClick={() => setPalette(true)} aria-label="Rechercher" className="btn-icone nu md:hidden">
                <Search size={18} />
              </button>
              <BoutonTheme sombre={sombre} basculer={basculerTheme} />
              <div className="ml-1.5">
                <MenuCompte user={user} role={role} sombre={sombre} basculerTheme={basculerTheme} onLogout={logout} />
              </div>
            </div>
          </div>
        </header>

        <div className="marge-contenu flex-1">{children}</div>
      </div>

      {/* Barre d'onglets — téléphones */}
      <nav
        aria-label="Navigation rapide"
        className="hors-impression fixed inset-x-0 bottom-0 z-30 border-t border-[var(--border-line)] backdrop-blur-md md:hidden"
        style={{ backgroundColor: "color-mix(in srgb, var(--bg-surface) 94%, transparent)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <div className="mx-auto grid max-w-lg px-1" style={{ gridTemplateColumns: `repeat(${onglets.length + (reste.length ? 1 : 0)}, minmax(0, 1fr))` }}>
          {onglets.map((it) => {
            const actif = estActif(it.href, pathname);
            const Icon = it.icon;
            return (
              <Link
                key={it.href}
                href={it.href}
                aria-current={actif ? "page" : undefined}
                className="flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium"
                style={{ color: actif ? "var(--fleet-bright)" : "var(--text-slate-light)" }}
              >
                <span
                  className="flex h-7 w-12 items-center justify-center rounded-full transition-colors"
                  style={{ backgroundColor: actif ? "color-mix(in srgb, var(--fleet-bright) 13%, transparent)" : "transparent" }}
                >
                  <Icon size={20} strokeWidth={actif ? 2.3 : 1.9} />
                </span>
                <span className="max-w-full truncate px-0.5" style={{ fontWeight: actif ? 600 : 500 }}>{it.court || it.label}</span>
              </Link>
            );
          })}
          {reste.length > 0 && (
            <button
              onClick={() => setPlus(true)}
              aria-haspopup="dialog"
              aria-expanded={plus}
              className="flex h-16 flex-col items-center justify-center gap-1 text-[10.5px] font-medium"
              style={{ color: resteActif ? "var(--fleet-bright)" : "var(--text-slate-light)" }}
            >
              <span
                className="flex h-7 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: resteActif ? "color-mix(in srgb, var(--fleet-bright) 13%, transparent)" : "transparent" }}
              >
                <LayoutGrid size={20} strokeWidth={resteActif ? 2.3 : 1.9} />
              </span>
              <span style={{ fontWeight: resteActif ? 600 : 500 }}>Plus</span>
            </button>
          )}
        </div>
      </nav>

      {/* Feuille « Plus » — les pages qui ne tiennent pas dans la barre */}
      {plus && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden" role="dialog" aria-modal="true" aria-label="Autres pages">
          <div className="animate-fondu absolute inset-0 bg-[#0A1626]/50 backdrop-blur-[2px]" onClick={() => setPlus(false)} />
          <div
            className="animate-glisse-haut relative w-full rounded-t-[22px] border-t border-[var(--border-line)] bg-[var(--bg-surface)] px-4 pt-2.5"
            style={{ boxShadow: "var(--shadow-pop)", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-[var(--border-strong)]" />
            <div className="mb-3 flex items-center justify-between">
              <h2 className="titre-bloc">Toutes les pages</h2>
              <button onClick={() => setPlus(false)} aria-label="Fermer" className="btn-icone nu"><X size={18} /></button>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {reste.map((it) => {
                const actif = estActif(it.href, pathname);
                const Icon = it.icon;
                return (
                  <Link
                    key={it.href}
                    href={it.href}
                    onClick={() => setPlus(false)}
                    aria-current={actif ? "page" : undefined}
                    className="flex items-center gap-3 rounded-xl border px-3.5 py-3.5 text-sm font-medium"
                    style={{
                      borderColor: actif ? "color-mix(in srgb, var(--fleet-bright) 50%, transparent)" : "var(--border-line)",
                      backgroundColor: actif ? "color-mix(in srgb, var(--fleet-bright) 8%, transparent)" : "var(--bg-surface-alt)",
                      color: "var(--text-ink)",
                    }}
                  >
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px]"
                      style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 12%, transparent)", color: "var(--fleet-bright)" }}
                    >
                      <Icon size={18} />
                    </span>
                    <span className="min-w-0 leading-tight">{it.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <Palette ouvert={palette} onFermer={() => setPalette(false)} elements={elementsPalette} />
    </div>
  );
}
