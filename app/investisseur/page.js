import { cookies } from "next/headers";
import { Lock, AlertCircle, TrendingUp } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { descripteurSecret, jetonSession, lireHachage } from "@/lib/investor-access";
import { lireTout } from "@/lib/supabase/lire-tout";
import { unlockInvestor } from "./actions";
import InvestisseurClient from "./investisseur-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "Espace investisseur" };

// Montant reellement investi dans le vehicule de reference. C'est le seul
// vehicule disposant de donnees d'exploitation : tout le dossier est bati
// sur ce montant, aussi bien pour le suivi du capital rembourse que pour le
// ticket d'entree presente a un nouvel investisseur.
const PRIX_ACHAT = Number(process.env.INVESTOR_PRIX_ACHAT) || 6500000;
const PRIX_REFERENCE = Number(process.env.INVESTOR_PRIX_REFERENCE) || PRIX_ACHAT;
const VEHICLE_IMMAT = process.env.INVESTOR_VEHICLE_IMMAT || "AB-449-JL";

function Gate({ error }) {
  return (
    <main className="flex min-h-[78vh] items-center justify-center px-4 py-10">
      <div className="carte animate-fade-up w-full max-w-sm p-6 sm:p-7">
        <div
          className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}
        >
          <TrendingUp size={22} color="var(--fleet-bright)" />
        </div>
        <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text-ink)]">
          Espace investisseur
        </h1>
        <p className="mb-5 mt-1.5 text-sm leading-relaxed text-[var(--text-slate)]">
          Dossier de performance d&apos;un véhicule de la flotte FMB Trans-Mobilité Services.
          Saisissez le mot de passe qui vous a été communiqué.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-4 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium"
            style={{
              color: "var(--red)",
              borderColor: "color-mix(in srgb, var(--red) 35%, transparent)",
              backgroundColor: "color-mix(in srgb, var(--red) 8%, transparent)",
            }}
          >
            <AlertCircle size={16} className="shrink-0" /> Mot de passe incorrect.
          </div>
        )}

        <form action={unlockInvestor} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="etiquette">Mot de passe</span>
            <input type="password" name="password" required autoFocus autoComplete="current-password" className="champ" />
          </label>
          <button type="submit" className="btn btn-primaire w-full">
            <Lock size={15} /> Accéder au dossier
          </button>
        </form>
      </div>
    </main>
  );
}

function Message({ children }) {
  return (
    <main className="page-etroite">
      <div className="carte p-6 text-sm leading-relaxed text-[var(--text-slate)]">{children}</div>
    </main>
  );
}

export default async function InvestisseurPage({ searchParams }) {
  const admin = process.env.SUPABASE_SERVICE_ROLE_KEY ? createAdminClient() : null;

  // Le cookie porte un jeton dérivé du mot de passe courant : si celui-ci a
  // été changé entre-temps, l'accès est refermé automatiquement.
  const descripteur = descripteurSecret(await lireHachage(admin));
  const unlocked = cookies().get("investisseur_ok")?.value === jetonSession(descripteur);
  if (!unlocked) return <Gate error={searchParams?.error} />;

  if (!admin) {
    return (
      <Message>
        <div className="font-semibold text-[var(--red)] mb-1">Configuration incomplète</div>
        La variable <code>SUPABASE_SERVICE_ROLE_KEY</code> n&apos;est pas définie. Ajoutez-la dans les
        variables d&apos;environnement (Vercel et <code>.env.local</code>), puis redéployez.
      </Message>
    );
  }

  const { data: vehicles } = await admin.from("vehicles").select("*").order("created_at", { ascending: true });

  if (!vehicles?.length) {
    return <Message>Aucun véhicule enregistré pour le moment.</Message>;
  }

  const vehicle =
    vehicles.find((v) => v.immatriculation === VEHICLE_IMMAT) ||
    vehicles.find((v) => (v.marque || "").toUpperCase().includes("QM3")) ||
    vehicles[0];

  // Lecture paginée : au-delà de 1 000 lignes l'API tronque sans prévenir,
  // et le dossier présenterait une rentabilité calculée sur une partie
  // seulement de l'historique.
  const [entriesRes, flotteRes] = await Promise.all([
    lireTout(() =>
      admin.from("entries").select("*").eq("vehicle_id", vehicle.id).order("date", { ascending: true })
    ),
    lireTout(() =>
      admin.from("entries").select("vehicle_id,date,recette,net").order("date", { ascending: true })
    ),
  ]);

  if (entriesRes.error || flotteRes.error) {
    return (
      <Message>
        <div className="mb-1 font-semibold text-[var(--red)]">Données momentanément indisponibles</div>
        Le dossier n&apos;a pas pu être chargé. Réessayez dans quelques instants.
      </Message>
    );
  }

  const entries = entriesRes.data || [];

  if (!entries.length) {
    return <Message>Aucune donnée d&apos;exploitation disponible pour ce véhicule.</Message>;
  }

  // Synthèse par véhicule sur toute la flotte : sert de base à l'estimation
  // de rentabilité d'un nouvel investissement.
  const aujourdhui = new Date().toISOString().slice(0, 10);
  const toutesSaisies = flotteRes.data || [];
  const flotte = vehicles
    .map((v) => {
      const rows = toutesSaisies.filter((e) => e.vehicle_id === v.id);
      if (!rows.length) return null;

      const premiereDate = rows[0].date;
      const derniereDate = rows[rows.length - 1].date;
      const finPeriode = aujourdhui > derniereDate ? aujourdhui : derniereDate;
      const jours =
        Math.round(
          (new Date(finPeriode + "T00:00:00") - new Date(premiereDate + "T00:00:00")) / 86400000
        ) + 1;

      return {
        id: v.id,
        marque: v.marque,
        immatriculation: v.immatriculation,
        premiereDate,
        derniereDate,
        jours,
        nbSaisies: rows.length,
        joursTravailles: rows.filter((e) => Number(e.recette) > 0).length,
        net: rows.reduce((s, e) => s + (Number(e.net) || 0), 0),
      };
    })
    .filter(Boolean);

  return (
    <InvestisseurClient
      vehicle={vehicle}
      entries={entries}
      prixAchat={PRIX_ACHAT}
      prixReference={PRIX_REFERENCE}
      aujourdhui={aujourdhui}
      flotte={flotte}
    />
  );
}
