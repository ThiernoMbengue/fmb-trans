"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Save, Trash2, Loader2, HandCoins, TriangleAlert, Send, Check, X, Clock,
  CheckCircle2, RotateCcw, Bus, Wallet, Plus, CircleHelp, ChevronDown,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { lireTout } from "@/lib/supabase/lire-tout";
import { fmtF, fmtJour, fmtPeriode, todayISO } from "@/lib/format";
import { useVehiculeCourant } from "@/lib/vehicule-courant";
import { EnTete, SelecteurVehicule, Segments, Champ, Vide, Chargement, Indicateur, useToast, useConfirm } from "@/components/ui";
import {
  saveAvance, deleteAvance, setAvanceStatut,
  requestAvance, cancelAvanceRequest, resolveAvanceRequest,
} from "./actions";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet-bright)", green: "var(--green)", red: "var(--red)", amber: "var(--amber)", slate: "var(--text-slate)", line: "var(--border-line)" };

const TYPES = {
  avance_proprietaire: { label: "Avance au propriétaire", court: "Avance", couleur: COLORS.fleet },
  depense_imprevue: { label: "Dépense imprévue (véhicule)", court: "Dépense imprévue", couleur: COLORS.amber },
  remboursement: { label: "Remboursement reçu", court: "Remboursement", couleur: COLORS.green },
};

const STATUS_LABEL = { en_attente: "En attente", approuvee: "Approuvée", refusee: "Refusée" };
const STATUS_COLOR = { en_attente: COLORS.amber, approuvee: COLORS.green, refusee: COLORS.red };

// Une ligne est « réglée » lorsqu'elle a déjà été prise en compte dans un
// décompte mensuel soldé. Elle sort alors des sommes encore dues, mais reste
// dans l'historique : c'est ce que la suppression ne permettait pas.
const estReglee = (r) => r.statut === "regularisee";

const emptyForm = () => ({ date: todayISO(), type: "avance_proprietaire", montant: "", note: "" });

export default function AvancesClient({ vehicles, role, vehiculeInitial }) {
  const isAdmin = role === "admin";
  const supabase = createClient();
  const toast = useToast();
  const confirmer = useConfirm();

  const [vehicleId, setVehicleId] = useVehiculeCourant(vehicles, vehiculeInitial);
  // Numéro de la dernière demande de chargement : une réponse en retard,
  // arrivée après un changement de véhicule, est ignorée.
  const demande = useRef(0);
  const [rows, setRows] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [requestForm, setRequestForm] = useState({ montant: "", note: "" });
  const [resolvingId, setResolvingId] = useState(null);
  const [filtre, setFiltre] = useState("toutes");

  const loadRows = async (vId, { silencieux } = {}) => {
    const numero = ++demande.current;
    if (!silencieux) setLoading(true);
    const [avancesRes, requestsRes] = await Promise.all([
      lireTout(() => supabase.from("avances").select("*").eq("vehicle_id", vId).order("date", { ascending: false })),
      supabase.from("avance_requests").select("*").eq("vehicle_id", vId).order("created_at", { ascending: false }),
    ]);
    if (numero !== demande.current) return;
    if (avancesRes.error) toast("Chargement impossible : " + avancesRes.error.message, "error");
    else setRows(avancesRes.data || []);
    if (!requestsRes.error) setRequests(requestsRes.data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (vehicleId) loadRows(vehicleId);
  }, [vehicleId]); // eslint-disable-line

  const executer = async (action, succes) => {
    setSaving(true);
    const res = await action();
    setSaving(false);
    if (res?.error) { toast(res.error, "error"); return false; }
    if (succes) toast(succes);
    await loadRows(vehicleId, { silencieux: true });
    return true;
  };

  const onSave = async () => {
    if (!vehicleId || !form.montant) return;
    if (await executer(() => saveAvance({ vehicleId, ...form }), "Ligne enregistrée")) setForm(emptyForm());
  };

  const onDelete = async (r) => {
    const ok = await confirmer({
      titre: "Supprimer définitivement cette ligne ?",
      message: `${TYPES[r.type]?.court || "Ligne"} de ${fmtF(r.montant)} du ${fmtJour(r.date, { annee: true })}.\n\nPour une avance déjà récupérée, préférez « Marquer réglée » : la trace de l'argent remis est conservée.`,
      confirmer: "Supprimer",
      danger: true,
    });
    if (ok) await executer(() => deleteAvance(r.id), "Ligne supprimée");
  };

  const onToggleStatut = async (r) => {
    if (!estReglee(r)) {
      const note = await confirmer({
        titre: "Marquer cette ligne comme réglée",
        message: "Elle sera retirée des décomptes mensuels et cessera d'être déduite des paiements. Les mois concernés seront recalculés.",
        saisie: { label: "Comment a-t-elle été réglée ? (facultatif)", placeholder: "Rendue en espèces, compensée, saisie par erreur…" },
        confirmer: "Marquer réglée",
      });
      if (note === null) return;
      await executer(() => setAvanceStatut(r.id, "regularisee", note), "Ligne marquée comme réglée");
      return;
    }

    if (r.regularisee_auto) {
      const ok = await confirmer({
        titre: "Rouvrir cette ligne ?",
        message: `Elle a été réglée automatiquement par le paiement de ${fmtPeriode(r.regularisee_periode)}. Si vous la rouvrez, elle sera de nouveau marquée réglée au prochain enregistrement de paiement.`,
        confirmer: "Rouvrir quand même",
      });
      if (!ok) return;
    }
    await executer(() => setAvanceStatut(r.id, "en_cours"), "Ligne remise en cours");
  };

  const onSendRequest = async () => {
    if (!vehicleId || !requestForm.montant) return;
    if (await executer(() => requestAvance({ vehicleId, ...requestForm }), "Demande envoyée au gestionnaire")) {
      setRequestForm({ montant: "", note: "" });
    }
  };

  const onCancelRequest = async (r) => {
    const ok = await confirmer({ titre: "Annuler cette demande ?", message: `Demande de ${fmtF(r.montant)}.`, confirmer: "Annuler la demande", annuler: "Garder", danger: true });
    if (ok) await executer(() => cancelAvanceRequest(r.id), "Demande annulée");
  };

  const onResolve = async (r, decision) => {
    if (decision === "refusee") {
      const ok = await confirmer({ titre: "Refuser cette demande ?", message: `Demande de ${fmtF(r.montant)}${r.note ? ` — ${r.note}` : ""}.`, confirmer: "Refuser", danger: true });
      if (!ok) return;
    }
    setResolvingId(r.id);
    const res = await resolveAvanceRequest(r.id, decision);
    setResolvingId(null);
    if (res?.error) return toast(res.error, "error");
    toast(decision === "approuvee" ? "Demande approuvée — l'avance est enregistrée" : "Demande refusée");
    await loadRows(vehicleId, { silencieux: true });
  };

  const totals = useMemo(() => {
    const somme = (liste, type) =>
      liste.filter((r) => r.type === type).reduce((s, r) => s + (Number(r.montant) || 0), 0);

    // Seules les lignes encore en cours constituent ce qui reste dû : une
    // ligne réglée a déjà été récupérée sur un paiement.
    const enCours = rows.filter((r) => !estReglee(r));
    const reglees = rows.filter(estReglee);

    const avance = somme(enCours, "avance_proprietaire");
    const depense = somme(enCours, "depense_imprevue");
    const rembourse = somme(enCours, "remboursement");

    return {
      avance, depense, rembourse,
      soldeDu: avance + depense - rembourse,
      regle: somme(reglees, "avance_proprietaire") + somme(reglees, "depense_imprevue"),
      nbReglees: reglees.length,
      nbEnCours: enCours.length,
    };
  }, [rows]);

  const visibles = useMemo(
    () => rows.filter((r) => filtre === "toutes" || (filtre === "reglees" ? estReglee(r) : !estReglee(r))),
    [rows, filtre]
  );

  const enAttente = requests.filter((r) => r.status === "en_attente");

  if (!vehicles.length) {
    return (
      <main className="page">
        <EnTete titre="Avances et dépenses" />
        <div className="carte">
          <Vide icone={Bus} titre="Aucun véhicule pour le moment">
            {isAdmin
              ? "Ajoutez d'abord un véhicule depuis l'onglet « Véhicules »."
              : "Aucun véhicule ne vous a encore été attribué. Contactez votre gestionnaire."}
          </Vide>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <EnTete
        titre="Avances et dépenses"
        description={
          isAdmin
            ? "L'argent remis au propriétaire en dehors du versement quotidien, et les dépenses imprévues avancées sur le véhicule."
            : "Les avances que vous avez reçues et les dépenses imprévues avancées sur votre véhicule."
        }
      />

      <SelecteurVehicule className="mb-5" vehicles={vehicles} value={vehicleId} onChange={setVehicleId} />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur icone={HandCoins} label="Avances en cours" valeur={fmtF(totals.avance)} legende="pas encore récupérées" couleur={COLORS.fleet} />
        <Indicateur icone={TriangleAlert} label="Dépenses imprévues" valeur={fmtF(totals.depense)} legende="en cours" couleur={COLORS.amber} />
        <Indicateur icone={Wallet} label="Reste à récupérer" valeur={fmtF(totals.soldeDu)} legende={totals.rembourse > 0 ? `après ${fmtF(totals.rembourse)} remboursés` : "lignes en cours uniquement"} couleur={COLORS.red} />
        <Indicateur icone={CheckCircle2} label="Déjà réglé" valeur={fmtF(totals.regle)} legende={`${totals.nbReglees} ligne${totals.nbReglees > 1 ? "s" : ""}`} couleur={COLORS.green} />
      </div>

      {/* Explication repliée : utile une fois, encombrante ensuite. */}
      <details className="carte group mb-5 overflow-hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2.5 px-4 py-3 text-sm font-medium text-[var(--text-slate)] hover:text-[var(--text-ink)] sm:px-5 [&::-webkit-details-marker]:hidden">
          <CircleHelp size={16} color={COLORS.fleet} className="shrink-0" />
          Que signifie « réglée » ?
          <ChevronDown size={16} className="ml-auto shrink-0 transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-4 border-t border-[var(--border-line)] px-4 py-4 text-xs leading-relaxed text-[var(--text-slate)] sm:grid-cols-2 sm:px-5">
          <p className="sm:col-span-2">
            <strong className="text-[var(--text-ink)]">Une ligne réglée sort des sommes dues, mais reste dans l&apos;historique.</strong>{" "}
            Il y a deux façons d&apos;y arriver, et elles n&apos;ont pas le même effet sur les décomptes.
          </p>
          <p>
            <strong style={{ color: COLORS.green }}>Automatique</strong> — quand un décompte mensuel est soldé dans
            Paiements, les avances qu&apos;il couvrait basculent toutes seules. Elles <strong>restent dans le décompte</strong> :
            c&apos;est lui qui les a récupérées. Une avance qui dépasse ce que le mois pouvait absorber reste « en cours »
            jusqu&apos;à ce que les mois suivants l&apos;aient couverte.
          </p>
          <p>
            <strong style={{ color: COLORS.amber }}>Manuel</strong> — pour une somme réglée en dehors du circuit mensuel :
            rendue en espèces, compensée, abandonnée, ou saisie par erreur. Elle <strong>sort du décompte</strong> et
            cesse d&apos;être déduite des paiements. Les mois concernés sont recalculés.
          </p>
        </div>
      </details>

      {/* Demandes à traiter — gestionnaire */}
      {isAdmin && enAttente.length > 0 && (
        <section className="carte mb-5 p-4 sm:p-5" style={{ borderColor: "color-mix(in srgb, var(--amber) 45%, var(--border-line))" }}>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
            <Clock size={16} color={COLORS.amber} /> {enAttente.length} demande{enAttente.length > 1 ? "s" : ""} d&apos;avance à traiter
          </h2>
          <div className="flex flex-col gap-2">
            {enAttente.map((r) => (
              <div key={r.id} className="flex flex-col gap-3 rounded-xl bg-[var(--bg-page)] p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-figures text-base font-bold text-[var(--text-ink)]">{fmtF(r.montant)}</div>
                  {r.note && <div className="mt-0.5 break-words text-sm text-[var(--text-slate)]">{r.note}</div>}
                </div>
                <div className="flex shrink-0 gap-2">
                  {resolvingId === r.id ? (
                    <Loader2 size={18} className="animate-spin text-[var(--text-slate-light)]" />
                  ) : (
                    <>
                      <button onClick={() => onResolve(r, "approuvee")} className="btn btn-succes btn-petit flex-1 sm:flex-none">
                        <Check size={14} /> Approuver
                      </button>
                      <button onClick={() => onResolve(r, "refusee")} className="btn btn-contour btn-petit flex-1 sm:flex-none" style={{ color: COLORS.red }}>
                        <X size={14} /> Refuser
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        {/* ------------------------------------------------ Formulaire */}
        {isAdmin ? (
          <section className="carte p-4 sm:p-6">
            <h2 className="mb-5 flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
              <Plus size={16} color={COLORS.fleet} /> Nouvelle ligne
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Champ label="Type" className="sm:col-span-2">
                <select className="champ" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                  {Object.entries(TYPES).map(([id, t]) => <option key={id} value={id}>{t.label}</option>)}
                </select>
              </Champ>
              <Champ label="Date">
                <input type="date" className="champ" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </Champ>
              <Champ label="Montant (FCFA)">
                <input type="number" inputMode="numeric" min={0} className="champ font-figures" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="0" />
              </Champ>
              <Champ label="Motif" className="sm:col-span-2">
                <input className="champ" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Réparation moteur, dépannage familial…" />
              </Champ>
            </div>
            <button onClick={onSave} disabled={saving || !form.montant} className="btn btn-succes mt-5 w-full sm:w-auto">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
              Enregistrer
            </button>
          </section>
        ) : (
          <section className="carte p-4 sm:p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
              <Send size={15} color={COLORS.fleet} /> Demander une avance
            </h2>
            <p className="mb-5 mt-1 text-xs text-[var(--text-slate-light)]">
              Votre demande est transmise au gestionnaire, qui l&apos;approuve ou la refuse.
            </p>
            <div className="grid grid-cols-1 gap-4">
              <Champ label="Montant souhaité (FCFA)">
                <input type="number" inputMode="numeric" min={0} className="champ font-figures" value={requestForm.montant} onChange={(e) => setRequestForm({ ...requestForm, montant: e.target.value })} placeholder="0" />
              </Champ>
              <Champ label="Motif">
                <input className="champ" value={requestForm.note} onChange={(e) => setRequestForm({ ...requestForm, note: e.target.value })} placeholder="Besoin urgent, frais de scolarité…" />
              </Champ>
            </div>
            <button onClick={onSendRequest} disabled={saving || !requestForm.montant} className="btn btn-primaire mt-5 w-full sm:w-auto">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
              Envoyer la demande
            </button>

            {requests.length > 0 && (
              <div className="mt-6 border-t border-[var(--border-line)] pt-5">
                <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-slate)]">Vos demandes</h3>
                <div className="flex flex-col gap-2">
                  {requests.map((r) => (
                    <div key={r.id} className="flex items-center justify-between gap-3 rounded-xl bg-[var(--bg-page)] px-3 py-2.5">
                      <div className="min-w-0">
                        <span className="font-figures text-sm font-semibold text-[var(--text-ink)]">{fmtF(r.montant)}</span>
                        {r.note && <div className="truncate text-xs text-[var(--text-slate)]">{r.note}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <span className="pastille" style={{ backgroundColor: `color-mix(in srgb, ${STATUS_COLOR[r.status]} 14%, transparent)`, color: STATUS_COLOR[r.status] }}>
                          {STATUS_LABEL[r.status]}
                        </span>
                        {r.status === "en_attente" && (
                          <button onClick={() => onCancelRequest(r)} aria-label="Annuler la demande" title="Annuler la demande" className="btn-icone danger h-8 w-8">
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ------------------------------------------------ Historique */}
        <section className="carte min-w-0 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border-line)] px-4 py-3.5 sm:px-5">
            <h2 className="titre-bloc">Historique</h2>
            <Segments
              label="Filtrer l'historique"
              value={filtre}
              onChange={setFiltre}
              options={[
                { id: "toutes", label: "Toutes", compte: rows.length },
                { id: "en_cours", label: "En cours", compte: totals.nbEnCours },
                { id: "reglees", label: "Réglées", compte: totals.nbReglees },
              ]}
            />
          </div>

          {loading ? (
            <Chargement className="p-4 sm:p-5" />
          ) : visibles.length === 0 ? (
            <Vide icone={HandCoins} titre={rows.length === 0 ? "Aucune avance ni dépense" : "Aucune ligne dans ce filtre"}>
              {rows.length === 0 ? "Les lignes enregistrées pour ce véhicule apparaîtront ici." : null}
            </Vide>
          ) : (
            <ul className="divide-y divide-[var(--border-line)]">
              {visibles.map((r) => {
                const t = TYPES[r.type] || TYPES.avance_proprietaire;
                const reglee = estReglee(r);
                return (
                  <li key={r.id} className="px-4 py-3.5 sm:px-5" style={{ opacity: reglee ? 0.72 : 1 }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <span className="pastille" style={{ backgroundColor: `color-mix(in srgb, ${t.couleur} 13%, transparent)`, color: t.couleur }}>
                            {t.court}
                          </span>
                          <span className="whitespace-nowrap text-xs text-[var(--text-slate)]" title={r.date}>{fmtJour(r.date)}</span>
                        </div>
                        {r.note && <div className="mt-1.5 break-words text-sm text-[var(--text-ink)]">{r.note}</div>}
                        <div className="mt-1.5 text-[11px] leading-snug">
                          {reglee ? (
                            <span className="inline-flex flex-wrap items-center gap-x-1.5" style={{ color: COLORS.green }}>
                              <CheckCircle2 size={12} className="shrink-0" />
                              <span className="font-medium">Réglée</span>
                              <span className="text-[var(--text-slate-light)]">
                                {r.regularisee_auto
                                  ? `· par le paiement de ${fmtPeriode(r.regularisee_periode)}`
                                  : `· ${r.regularisee_note || "à la main"} · retirée des décomptes`}
                              </span>
                            </span>
                          ) : (
                            <span className="text-[var(--text-slate-light)]">En cours</span>
                          )}
                        </div>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div
                          className="font-figures whitespace-nowrap text-base font-bold"
                          style={{ color: r.type === "remboursement" ? COLORS.green : COLORS.ink, textDecorationLine: reglee ? "line-through" : "none", textDecorationColor: "var(--text-slate-light)" }}
                        >
                          {r.type === "remboursement" ? "+ " : ""}{fmtF(r.montant)}
                        </div>
                        {isAdmin && (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => onToggleStatut(r)}
                              disabled={saving}
                              className="btn btn-contour btn-petit"
                              style={{ color: reglee ? "var(--text-slate)" : COLORS.green }}
                            >
                              {reglee ? <><RotateCcw size={13} /> Rouvrir</> : <><Check size={13} /> Réglée</>}
                            </button>
                            <button onClick={() => onDelete(r)} disabled={saving} aria-label="Supprimer" title="Supprimer définitivement" className="btn-icone danger h-8 w-8">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
