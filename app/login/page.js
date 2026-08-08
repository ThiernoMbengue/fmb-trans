import Link from "next/link";
import { login } from "./actions";
import { AlertCircle, TrendingUp, ChevronRight } from "lucide-react";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet)" };

export default function LoginPage({ searchParams }) {
  const error = searchParams?.error;
  const next = searchParams?.next || "/";

  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-xl p-6">
        <h1 className="text-lg font-semibold mb-1" style={{ color: COLORS.ink }}>
          Connexion
        </h1>
        <p className="text-xs text-[var(--text-slate-light)] mb-5">
          Réservé aux comptes gestionnaire et propriétaire.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-xs text-white bg-[var(--red)] rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <form action={login} className="flex flex-col gap-3">
          <input type="hidden" name="next" value={next} />
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-slate)]">Email</span>
            <input
              type="email"
              name="email"
              required
              className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-slate)]">Mot de passe</span>
            <input
              type="password"
              name="password"
              required
              className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30"
            />
          </label>
          <button
            type="submit"
            className="mt-2 text-sm font-medium px-4 py-2.5 rounded-lg text-white"
            style={{ backgroundColor: COLORS.fleet }}
          >
            Se connecter
          </button>
        </form>

        <div className="road-divider my-5" style={{ color: "var(--amber)" }} />

        <Link
          href="/investisseur"
          className="flex items-center gap-3 rounded-xl border border-[var(--border-line)] bg-[var(--bg-page)] px-3.5 py-3 hover:border-[var(--fleet-bright)]"
        >
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 16%, transparent)" }}
          >
            <TrendingUp size={16} color="var(--fleet-bright)" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold" style={{ color: COLORS.ink }}>Espace investisseur</div>
            <div className="text-[11px] text-[var(--text-slate-light)] leading-snug">
              Consulter la performance d&apos;un véhicule — accès par mot de passe
            </div>
          </div>
          <ChevronRight size={16} className="text-[var(--text-slate-light)] shrink-0" />
        </Link>
      </div>
    </main>
  );
}
