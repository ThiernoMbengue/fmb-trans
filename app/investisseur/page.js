import { cookies } from "next/headers";
import { Lock, AlertCircle, TrendingUp } from "lucide-react";
import { createAdminClient } from "@/lib/supabase/admin";
import { unlockInvestor } from "./actions";
import InvestisseurClient from "./investisseur-client";

export const dynamic = "force-dynamic";

const PRIX_ACHAT = Number(process.env.INVESTOR_PRIX_ACHAT) || 6000000;
const VEHICLE_IMMAT = process.env.INVESTOR_VEHICLE_IMMAT || "AB-449-JL";

function Gate({ error }) {
  return (
    <main className="min-h-[80vh] flex items-center justify-center px-4">
      <div className="w-full max-w-sm surface-card rounded-2xl p-6">
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
          style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 16%, transparent)" }}
        >
          <TrendingUp size={20} color="var(--fleet-bright)" />
        </div>
        <h1 className="font-display text-xl font-bold tracking-tight text-[var(--text-ink)]">
          Espace investisseur
        </h1>
        <p className="text-xs text-[var(--text-slate)] mt-1.5 mb-5 leading-relaxed">
          Dossier de performance d&apos;un véhicule de la flotte FMB Trans-Mobilité Services.
          Entrez le mot de passe qui vous a été communiqué.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-xs text-white bg-[var(--red)] rounded-lg px-3 py-2 mb-4">
            <AlertCircle size={14} /> Mot de passe incorrect.
          </div>
        )}

        <form action={unlockInvestor} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-[var(--text-slate)]">Mot de passe</span>
            <input
              type="password"
              name="password"
              required
              autoFocus
              className="w-full text-sm bg-[var(--bg-surface)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30"
            />
          </label>
          <button
            type="submit"
            className="mt-1 flex items-center justify-center gap-2 text-sm font-medium px-4 py-2.5 rounded-lg text-white"
            style={{ backgroundColor: "var(--fleet)" }}
          >
            <Lock size={14} /> Accéder au dossier
          </button>
        </form>
      </div>
    </main>
  );
}

function Message({ children }) {
  return (
    <main className="px-6 md:px-10 py-10 max-w-2xl mx-auto">
      <div className="surface-card rounded-2xl p-6 text-sm text-[var(--text-slate)]">{children}</div>
    </main>
  );
}

export default async function InvestisseurPage({ searchParams }) {
  const unlocked = cookies().get("investisseur_ok")?.value === "1";
  if (!unlocked) return <Gate error={searchParams?.error} />;

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return (
      <Message>
        <div className="font-semibold text-[var(--red)] mb-1">Configuration incomplète</div>
        La variable <code>SUPABASE_SERVICE_ROLE_KEY</code> n&apos;est pas définie. Ajoutez-la dans les
        variables d&apos;environnement (Vercel et <code>.env.local</code>), puis redéployez.
      </Message>
    );
  }

  const admin = createAdminClient();
  const { data: vehicles } = await admin.from("vehicles").select("*").order("created_at", { ascending: true });

  if (!vehicles?.length) {
    return <Message>Aucun véhicule enregistré pour le moment.</Message>;
  }

  const vehicle =
    vehicles.find((v) => v.immatriculation === VEHICLE_IMMAT) ||
    vehicles.find((v) => (v.marque || "").toUpperCase().includes("QM3")) ||
    vehicles[0];

  const [entriesRes, avancesRes, flotteRes] = await Promise.all([
    admin.from("entries").select("*").eq("vehicle_id", vehicle.id).order("date", { ascending: true }),
    admin.from("avances").select("*").eq("vehicle_id", vehicle.id),
    admin.from("entries").select("vehicle_id,date,recette,net").order("date", { ascending: true }),
  ]);

  const entries = entriesRes.data || [];
  const depensesImprevues = (avancesRes.data || [])
    .filter((a) => a.type === "depense_imprevue")
    .reduce((s, a) => s + (Number(a.montant) || 0), 0);

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
      depensesImprevues={depensesImprevues}
      prixAchat={PRIX_ACHAT}
      aujourdhui={aujourdhui}
      flotte={flotte}
    />
  );
}
