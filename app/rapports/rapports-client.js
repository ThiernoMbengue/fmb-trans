"use client";

import { useState } from "react";
import { FileText, Loader2, Download, Bus, ReceiptText, HandCoins, Scale, ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { lireTout } from "@/lib/supabase/lire-tout";
import { useVehiculeCourant } from "@/lib/vehicule-courant";
import { telechargerPDF } from "@/lib/telecharger";
import { fmtDateLongue, isoLocal, todayISO } from "@/lib/format";
import { EnTete, Champ, Vide, useToast } from "@/components/ui";

const DOC_TYPES = [
  { id: "versements", icone: ReceiptText, label: "Relevé de versements", desc: "Le détail jour par jour : recettes, dépenses et net versé au propriétaire." },
  { id: "avances", icone: HandCoins, label: "Relevé des avances", desc: "Avances, dépenses imprévues et remboursements de la période." },
  { id: "decompte", icone: Scale, label: "Décompte de solde", desc: "Versements et avances réunis, avec le solde final de la période." },
];

// Raccourcis de période. Les dates sont calculées dans le fuseau de
// l'appareil : passer par toISOString() décalerait d'un jour hors GMT.
const premierDuMois = (decalage = 0) => {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + decalage, 1));
};
const dernierDuMois = (decalage = 0) => {
  const d = new Date();
  return isoLocal(new Date(d.getFullYear(), d.getMonth() + decalage + 1, 0));
};
const RACCOURCIS = [
  { id: "mois", label: "Ce mois-ci", plage: () => [premierDuMois(), todayISO()] },
  { id: "precedent", label: "Mois dernier", plage: () => [premierDuMois(-1), dernierDuMois(-1)] },
  { id: "trimestre", label: "3 derniers mois", plage: () => [premierDuMois(-2), todayISO()] },
  { id: "annee", label: "Cette année", plage: () => [`${new Date().getFullYear()}-01-01`, todayISO()] },
];

export default function RapportsClient({ vehicles, role, vehiculeInitial }) {
  const supabase = createClient();
  const toast = useToast();
  const [vehicleId, setVehicleId] = useVehiculeCourant(vehicles, vehiculeInitial);
  const [dateDebut, setDateDebut] = useState(premierDuMois());
  const [dateFin, setDateFin] = useState(todayISO());
  const [docType, setDocType] = useState("versements");
  const [loading, setLoading] = useState(false);

  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const raccourciActif = RACCOURCIS.find((r) => {
    const [d, f] = r.plage();
    return d === dateDebut && f === dateFin;
  })?.id;

  // Lecture paginée : un relevé sur plusieurs années dépasse vite la limite
  // de 1 000 lignes de l'API, et le PDF serait tronqué sans avertissement.
  const lire = async (table) => {
    const { data, error } = await lireTout(() =>
      supabase.from(table).select("*").eq("vehicle_id", vehicleId)
        .gte("date", dateDebut).lte("date", dateFin).order("date", { ascending: true })
    );
    if (error) throw error;
    return data || [];
  };

  const generate = async () => {
    if (!vehicle) return;
    if (!dateDebut || !dateFin) return toast("Indiquez une date de début et une date de fin.", "error");
    if (dateDebut > dateFin) return toast("La date de début doit précéder la date de fin.", "error");

    setLoading(true);
    try {
      const filename = `${docType}_${vehicle.immatriculation}_${dateDebut}_${dateFin}.pdf`;
      let doc = null;
      // Le générateur de PDF est lourd : il n'est chargé qu'à la demande.
      const { generateVersementsPDF, generateAvancesPDF, generateDecomptePDF } = await import("@/lib/pdf/report");

      if (docType === "versements") {
        const entries = await lire("entries");
        if (!entries.length) return toast("Aucune saisie sur cette période.", "warning");
        doc = generateVersementsPDF(vehicle, entries, dateDebut, dateFin);
      } else if (docType === "avances") {
        const avances = await lire("avances");
        if (!avances.length) return toast("Aucune avance sur cette période.", "warning");
        doc = generateAvancesPDF(vehicle, avances, dateDebut, dateFin);
      } else {
        const [entries, avances] = await Promise.all([lire("entries"), lire("avances")]);
        if (!entries.length && !avances.length) return toast("Aucune donnée sur cette période.", "warning");
        doc = generateDecomptePDF(vehicle, entries, avances, dateDebut, dateFin);
      }

      await telechargerPDF(doc, filename);
      toast("Document généré");
    } catch (e) {
      toast("La génération a échoué : " + (e?.message || "erreur inconnue"), "error");
    } finally {
      setLoading(false);
    }
  };

  if (!vehicles.length) {
    return (
      <main className="page">
        <EnTete titre="Rapports" />
        <div className="carte">
          <Vide icone={Bus} titre="Aucun véhicule pour le moment">
            {role === "admin"
              ? "Ajoutez d'abord un véhicule depuis l'onglet « Véhicules »."
              : "Aucun véhicule ne vous a encore été attribué. Contactez votre gestionnaire."}
          </Vide>
        </div>
      </main>
    );
  }

  const typeChoisi = DOC_TYPES.find((t) => t.id === docType);

  return (
    <main className="page">
      <EnTete
        titre="Rapports"
        description="Générez un document PDF à partir des données saisies : choisissez le véhicule, la période et le type de document."
      />

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,7fr)_minmax(0,4fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <section className="carte p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-ink)]">1. Véhicule et période</h2>
            <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
              <Champ label="Véhicule" className="col-span-2">
                <select className="champ" value={vehicleId || ""} onChange={(e) => setVehicleId(e.target.value)}>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
                  ))}
                </select>
              </Champ>
              <Champ label="Du">
                <input type="date" className="champ" value={dateDebut} max={dateFin || undefined} onChange={(e) => setDateDebut(e.target.value)} />
              </Champ>
              <Champ label="Au">
                <input type="date" className="champ" value={dateFin} min={dateDebut || undefined} onChange={(e) => setDateFin(e.target.value)} />
              </Champ>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {RACCOURCIS.map((r) => {
                const actif = raccourciActif === r.id;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => { const [d, f] = r.plage(); setDateDebut(d); setDateFin(f); }}
                    aria-pressed={actif}
                    className="puce"
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="carte p-4 sm:p-6">
            <h2 className="mb-4 text-sm font-semibold text-[var(--text-ink)]">2. Type de document</h2>
            <div className="grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Type de document">
              {DOC_TYPES.map((t) => {
                const actif = docType === t.id;
                const Icone = t.icone;
                return (
                  <label
                    key={t.id}
                    className="relative flex cursor-pointer gap-3 rounded-xl border p-3.5 transition-colors sm:flex-col sm:gap-2.5"
                    style={{
                      borderColor: actif ? "var(--fleet-bright)" : "var(--border-line)",
                      backgroundColor: actif ? "color-mix(in srgb, var(--fleet-bright) 7%, transparent)" : "transparent",
                      boxShadow: actif ? "0 0 0 1px var(--fleet-bright)" : "none",
                    }}
                  >
                    <input type="radio" name="docType" className="sr-only" checked={actif} onChange={() => setDocType(t.id)} />
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                      style={{ backgroundColor: `color-mix(in srgb, ${actif ? "var(--fleet-bright)" : "var(--text-slate)"} 13%, transparent)` }}
                    >
                      <Icone size={17} color={actif ? "var(--fleet-bright)" : "var(--text-slate)"} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-[var(--text-ink)]">{t.label}</span>
                      <span className="mt-0.5 block text-xs leading-relaxed text-[var(--text-slate)]">{t.desc}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>

        {/* Récapitulatif + bouton : toujours sous les yeux sur grand écran */}
        <aside className="carte p-4 sm:p-6 lg:sticky lg:top-6">
          <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
            <FileText size={16} color="var(--fleet-bright)" /> Votre document
          </h2>
          <dl className="flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-slate-light)]">Document</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-ink)]">{typeChoisi.label}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-slate-light)]">Véhicule</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-ink)]">{vehicle ? `${vehicle.marque} — ${vehicle.immatriculation}` : "—"}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium uppercase tracking-wide text-[var(--text-slate-light)]">Période</dt>
              <dd className="mt-0.5 font-medium text-[var(--text-ink)]">
                {dateDebut && dateFin ? <>du {fmtDateLongue(dateDebut)}<br />au {fmtDateLongue(dateFin)}</> : "À préciser"}
              </dd>
            </div>
          </dl>
          <button onClick={generate} disabled={loading || !vehicle} className="btn btn-succes mt-5 w-full">
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            {loading ? "Génération…" : "Générer le PDF"}
          </button>
          <p className="mt-4 flex items-start gap-2 text-[11px] leading-relaxed text-[var(--text-slate-light)]">
            <ShieldCheck size={14} className="mt-0.5 shrink-0" />
            Le document est créé directement sur votre appareil : rien n&apos;est conservé sur un serveur.
          </p>
        </aside>
      </div>
    </main>
  );
}
