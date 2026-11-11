import Link from "next/link";
import { redirect } from "next/navigation";
import { TrendingUp, ChevronRight, ShieldCheck, BarChart3, FileText } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import LoginForm from "./login-form";

export const metadata = { title: "Connexion" };

const ATOUTS = [
  { icone: BarChart3, titre: "Suivi au jour le jour", texte: "Recettes, dépenses et versements de chaque véhicule." },
  { icone: FileText, titre: "Décomptes et reçus", texte: "Un relevé mensuel clair, des reçus numérotés." },
  { icone: ShieldCheck, titre: "Accès cloisonné", texte: "Chaque propriétaire ne voit que ses véhicules." },
];

export default async function LoginPage({ searchParams }) {
  const next = searchParams?.next || "/";

  // Déjà connecté : inutile de redemander le mot de passe.
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (user) redirect("/");

  return (
    <main className="grid min-h-screen min-h-[100dvh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      {/* Panneau de marque */}
      <section
        className="relative flex flex-col justify-between overflow-hidden px-6 pb-8 text-white sm:px-10 lg:px-14 lg:py-12"
        style={{
          backgroundColor: "#14324D",
          paddingTop: "calc(env(safe-area-inset-top, 0px) + 2rem)",
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(46,111,176,0.55), transparent 45%), radial-gradient(circle at 90% 95%, rgba(201,134,43,0.28), transparent 42%)",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/icon-192.png" alt="" width={44} height={44} className="h-full w-full object-cover" />
          </span>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-wide">FMB Trans</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55">Mobilité Services SARL</div>
          </div>
        </div>

        <div className="mt-8 lg:mt-0">
          <h1 className="font-display text-2xl font-bold leading-tight tracking-tight sm:text-3xl lg:text-[2.6rem] lg:leading-[1.1]">
            La gestion de votre flotte,<br className="hidden sm:block" /> en toute transparence.
          </h1>
          <div className="road-divider my-6 max-w-[14rem] text-[#E3A947] lg:my-8" />
          <ul className="hidden flex-col gap-5 lg:flex">
            {ATOUTS.map(({ icone: Icone, titre, texte }) => (
              <li key={titre} className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icone size={18} className="text-[#E3A947]" />
                </span>
                <div>
                  <div className="text-sm font-semibold">{titre}</div>
                  <div className="mt-0.5 text-sm leading-relaxed text-white/60">{texte}</div>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="hidden text-xs text-white/40 lg:block">
          © {new Date().getFullYear()} FMB Trans-Mobilité Services SARL · Dakar, Sénégal
        </div>
      </section>

      {/* Formulaire */}
      <section className="flex items-start justify-center px-5 py-8 sm:px-8 lg:items-center lg:py-12">
        <div className="animate-fade-up w-full max-w-sm">
          <h2 className="font-display text-2xl font-bold tracking-tight text-[var(--text-ink)]">Connexion</h2>
          <p className="mb-6 mt-1.5 text-sm text-[var(--text-slate)]">
            Accédez à votre espace gestionnaire ou propriétaire.
          </p>

          <LoginForm next={next} />

          <div className="my-6 flex items-center gap-3 text-[11px] uppercase tracking-wider text-[var(--text-slate-light)]">
            <span className="h-px flex-1 bg-[var(--border-line)]" />
            ou
            <span className="h-px flex-1 bg-[var(--border-line)]" />
          </div>

          <Link
            href="/investisseur"
            className="group flex items-center gap-3 rounded-2xl border border-[var(--border-line)] bg-[var(--bg-surface)] px-4 py-3.5 hover:border-[var(--fleet-bright)]"
            style={{ boxShadow: "var(--shadow-card)" }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}
            >
              <TrendingUp size={18} color="var(--fleet-bright)" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-[var(--text-ink)]">Espace investisseur</span>
              <span className="block text-xs leading-snug text-[var(--text-slate-light)]">
                Performance d&apos;un véhicule — accès par mot de passe
              </span>
            </span>
            <ChevronRight size={17} className="shrink-0 text-[var(--text-slate-light)] group-hover:translate-x-0.5 group-hover:text-[var(--fleet-bright)]" style={{ transition: "transform 150ms ease, color 150ms ease" }} />
          </Link>

          <p className="mt-8 text-center text-xs text-[var(--text-slate-light)]">
            Un problème d&apos;accès ? Contactez votre gestionnaire.
          </p>
        </div>
      </section>
    </main>
  );
}
