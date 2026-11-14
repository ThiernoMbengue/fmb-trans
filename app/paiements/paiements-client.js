"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Wallet, Loader2, Save, Trash2, FileText, CheckCircle2, Clock, CircleAlert, Bus, Receipt, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { savePaiement, deletePaiement } from "./actions";
import { telechargerPDF } from "@/lib/telecharger";
import { construireDecomptes, avancesNonAbsorbees } from "@/lib/decomptes";
import { lireTout } from "@/lib/supabase/lire-tout";
import { useVehiculeCourant } from "@/lib/vehicule-courant";
import { fmt, fmtF, fmtDate, todayISO } from "@/lib/format";
import {
  EnTete, SelecteurVehicule, Champ, Vide, Chargement, Indicateur, Bandeau, useToast, useConfirm,
} from "@/components/ui";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const MODES = [
  { id: "especes", label: "Espèces" },
  { id: "wave", label: "Wave" },
  { id: "orange_money", label: "Orange Money" },
  { id: "virement", label: "Virement" },
  { id: "cheque", label: "Chèque" },
  { id: "autre", label: "Autre" },
];
const MODE_LABEL = Object.fromEntries(MODES.map((m) => [m.id, m.label]));

const STATUTS = {
  en_cours: { label: "En cours", color: "slate", icon: Clock },
  a_payer: { label: "À payer", color: "red", icon: CircleAlert },
  partiel: { label: "Partiel", color: "amber", icon: CircleAlert },
  solde: { label: "Soldé", color: "green", icon: CheckCircle2 },
};

const couleurSolde = (solde) => (solde > 0 ? COLORS.red : solde < 0 ? COLORS.amber : COLORS.green);

function StatutBadge({ statut }) {
  const s = STATUTS[statut] || STATUTS.en_cours;
  const color = COLORS[s.color];
  const Icon = s.icon;
  return (
    <span className="pastille" style={{ backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
      <Icon size={12} /> {s.label}
    </span>
  );
}

export default function PaiementsClient({ vehicles, role, vehiculeInitial }) {
  const isAdmin = role === "admin";
  const supabase = createClient();
  const toast = useToast();
  const confirmer = useConfirm();

  const [vehicleId, setVehicleId] = useVehiculeCourant(vehicles, vehiculeInitial);
  const [entries, setEntries] = useState([]);
  const [avances, setAvances] = useState([]);
  const [paiements, setPaiements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openPeriode, setOpenPeriode] = useState(null);
  const [form, setForm] = useState({ datePaiement: todayISO(), montant: "", mode: "especes", reference: "", note: "" });

  const charger = async ({ silencieux } = {}) => {
    if (!silencieux) setLoading(true);
    // Lecture paginée : au-delà de 1 000 lignes, l'API tronque sans rien
    // dire, et le décompte serait calculé sur un historique incomplet.
    const [e, a, p] = await Promise.all([
      lireTout(() => supabase.from("entries").select("vehicle_id,date,net")),
      lireTout(() => supabase.from("avances").select("vehicle_id,date,type,montant,statut,regularisee_auto")),
      lireTout(() => supabase.from("paiements").select("*").order("date_paiement", { ascending: true })),
    ]);
    const erreur = e.error || a.error || p.error;
    if (erreur) toast("Chargement incomplet : " + erreur.message, "error");
    if (!e.error) setEntries(e.data || []);
    if (!a.error) setAvances(a.data || []);
    if (!p.error) setPaiements(p.data || []);
    setLoading(false);
  };

  // Le rattrapage du statut des avances se fait côté serveur, dans page.js,
  // avant même que cette page ne soit rendue : il n'y a plus qu'à charger.
  useEffect(() => {
    charger();
  }, []); // eslint-disable-line

  // Solde de chaque véhicule : c'est la vue « qui je dois payer »
  const soldesParVehicule = useMemo(
    () =>
      vehicles.map((v) => {
        const d = construireDecomptes(v.id, entries, avances, paiements);
        const dernier = d[d.length - 1];
        const aRegler = d.filter((x) => x.statut === "a_payer" || x.statut === "partiel").length;
        return {
          vehicle: v,
          decomptes: d,
          solde: dernier ? dernier.solde : 0,
          totalPaye: d.reduce((s, x) => s + x.paye, 0),
          totalDu: d.reduce((s, x) => s + x.netAPayer, 0),
          moisARegler: aRegler,
          // Part des avances que les versements n'ont pas encore absorbée.
          nonAbsorbe: avancesNonAbsorbees(d),
        };
      }),
    [vehicles, entries, avances, paiements]
  );

  const global = useMemo(() => {
    const soldeTotal = soldesParVehicule.reduce((s, v) => s + Math.max(0, v.solde), 0);
    const paye = soldesParVehicule.reduce((s, v) => s + v.totalPaye, 0);
    const du = soldesParVehicule.reduce((s, v) => s + v.totalDu, 0);
    const moisARegler = soldesParVehicule.reduce((s, v) => s + v.moisARegler, 0);
    return { soldeTotal, paye, du, moisARegler };
  }, [soldesParVehicule]);

  const courant = soldesParVehicule.find((v) => v.vehicle.id === vehicleId);
  const decomptes = courant ? [...courant.decomptes].reverse() : [];
  const vehicle = courant?.vehicle;

  const choisirVehicule = (id) => { setVehicleId(id); setOpenPeriode(null); };

  const ouvrirFormulaire = (d) => {
    setOpenPeriode(d.periode);
    setForm({
      datePaiement: todayISO(),
      montant: d.solde > 0 ? String(Math.round(d.solde)) : "",
      mode: "especes",
      reference: "",
      note: "",
    });
  };

  const onSave = async (d) => {
    const montant = Number(form.montant) || 0;
    if (montant <= 0) return toast("Indiquez un montant supérieur à zéro.", "error");
    if (montant > d.solde) {
      const ok = await confirmer({
        titre: "Montant supérieur au solde",
        message: `Vous enregistrez ${fmtF(montant)} alors qu'il reste ${fmtF(d.solde)} à régler pour ${d.periodeLabel}. Le trop-versé sera reporté en déduction du mois suivant.`,
        confirmer: "Enregistrer quand même",
      });
      if (!ok) return;
    }
    setSaving(true);
    const res = await savePaiement({ vehicleId, periode: d.periode, ...form });
    setSaving(false);
    if (res?.error) return toast(res.error, "error");
    toast("Paiement enregistré");
    setOpenPeriode(null);
    await charger({ silencieux: true });
  };

  const onDelete = async (p) => {
    const ok = await confirmer({
      titre: "Supprimer ce paiement ?",
      message: `${fmtF(p.montant)} versés le ${fmtDate(p.date_paiement)} (reçu ${p.numero_recu || "—"}).\n\nLe solde du mois sera recalculé, et les avances qu'il avait soldées repasseront « en cours » si nécessaire.`,
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    setSaving(true);
    const res = await deletePaiement(p.id);
    setSaving(false);
    if (res?.error) return toast(res.error, "error");
    toast("Paiement supprimé");
    await charger({ silencieux: true });
  };

  const telechargerRecu = async (d) => {
    try {
      // Le générateur de PDF est lourd : il n'est chargé qu'au premier reçu.
      const { generateRecuPDF } = await import("@/lib/pdf/report");
      await telechargerPDF(
        generateRecuPDF(vehicle, d, d.paiements),
        `recu_${vehicle.immatriculation}_${d.periode}.pdf`
      );
    } catch (e) {
      toast("Reçu indisponible : " + (e?.message || "erreur inconnue"), "error");
    }
  };

  const titre = isAdmin ? "Paiements aux propriétaires" : "Mes paiements";

  if (!vehicles.length) {
    return (
      <main className="page">
        <EnTete titre={titre} />
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
        titre={titre}
        description={
          isAdmin
            ? "Un décompte par véhicule et par mois : net des versements, avances déjà remises, dépenses avancées. Le solde non réglé est reporté sur le mois suivant."
            : "Ce qui vous est dû chaque mois, ce qui a été versé et ce qu'il reste. Chaque règlement donne lieu à un reçu téléchargeable."
        }
      />

      {loading ? (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <div key={i} className="squelette h-[5.5rem] rounded-2xl" />)}
          </div>
          <div className="carte p-5"><Chargement lignes={6} /></div>
        </>
      ) : (
        <>
          <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Indicateur
              icone={CircleAlert}
              label={isAdmin ? "Reste à payer" : "Reste à recevoir"}
              valeur={fmtF(global.soldeTotal)}
              legende={global.moisARegler > 0 ? `${global.moisARegler} mois à régler` : "Tout est à jour"}
              couleur={global.soldeTotal > 0 ? COLORS.red : COLORS.green}
            />
            <Indicateur icone={CheckCircle2} label="Déjà versé" valeur={fmtF(global.paye)} legende="depuis le début" couleur={COLORS.green} />
            <Indicateur icone={Wallet} label="Total dû" valeur={fmtF(global.du)} legende="depuis le début" couleur={COLORS.fleet} />
            <Indicateur icone={Bus} label="Véhicules suivis" valeur={vehicles.length} couleur={COLORS.purple} />
          </div>

          {/* Solde par véhicule */}
          {vehicles.length > 1 && (
            <section className="carte mb-6 overflow-hidden">
              <h2 className="border-b border-[var(--border-line)] px-4 py-3.5 text-sm font-semibold text-[var(--text-ink)] sm:px-5">
                Solde par véhicule
              </h2>
              <div className="defilement-fin overflow-x-auto">
                <table className="tableau">
                  <thead>
                    <tr>
                      <th>Véhicule</th>
                      <th className="hidden md:table-cell">Propriétaire</th>
                      <th className="num hidden sm:table-cell">Total dû</th>
                      <th className="num hidden sm:table-cell">Versé</th>
                      <th className="num">Solde</th>
                    </tr>
                  </thead>
                  <tbody>
                    {soldesParVehicule.map((v) => {
                      const actif = v.vehicle.id === vehicleId;
                      return (
                        <tr
                          key={v.vehicle.id}
                          tabIndex={0}
                          role="button"
                          aria-pressed={actif}
                          className="cursor-pointer"
                          style={actif ? { backgroundColor: "color-mix(in srgb, var(--fleet-bright) 7%, transparent)" } : undefined}
                          onClick={() => choisirVehicule(v.vehicle.id)}
                          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choisirVehicule(v.vehicle.id); } }}
                        >
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span className="h-6 w-1 shrink-0 rounded-full" style={{ backgroundColor: actif ? COLORS.fleet : "transparent" }} />
                              <div className="min-w-0">
                                <div className="truncate font-medium text-[var(--text-ink)]">{v.vehicle.marque}</div>
                                <div className="truncate text-[11px] text-[var(--text-slate-light)]">
                                  {v.vehicle.immatriculation}
                                  <span className="md:hidden">{v.vehicle.proprietaire ? ` · ${v.vehicle.proprietaire}` : ""}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="hidden text-[var(--text-slate)] md:table-cell">{v.vehicle.proprietaire || "—"}</td>
                          <td className="num hidden sm:table-cell">{fmt(v.totalDu)}</td>
                          <td className="num hidden sm:table-cell">{fmt(v.totalPaye)}</td>
                          <td className="num font-semibold" style={{ color: couleurSolde(v.solde) }}>{fmtF(v.solde)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SelecteurVehicule vehicles={vehicles} value={vehicleId} onChange={choisirVehicule} />
            {courant && (
              <div className="text-xs text-[var(--text-slate)]">
                Solde actuel{" "}
                <strong className="font-figures text-sm" style={{ color: couleurSolde(courant.solde) }}>{fmtF(courant.solde)}</strong>
              </div>
            )}
          </div>

          {/* Avances pas encore récupérées par les versements */}
          {courant?.nonAbsorbe > 0 && (
            <Bandeau couleur={COLORS.amber} icone={CircleAlert} className="mb-4">
              <strong className="text-[var(--text-ink)]">{fmtF(courant.nonAbsorbe)} d&apos;avances pas encore récupérés</strong>{" "}
              sur ce véhicule. Les versements n&apos;ont pas encore dégagé assez de net pour les couvrir : le reliquat
              se reporte de mois en mois, et les avances concernées restent « en cours » dans l&apos;onglet Avances.
            </Bandeau>
          )}

          {/* Décomptes mensuels */}
          {decomptes.length === 0 ? (
            <div className="carte">
              <Vide icone={Receipt} titre="Aucun décompte pour ce véhicule">
                Le premier décompte apparaîtra dès la première saisie de versement.
              </Vide>
            </div>
          ) : (
            <div className="grid items-start gap-4 xl:grid-cols-2">
              {decomptes.map((d) => {
                const lignes = [
                  ["Report du mois précédent", d.report],
                  ["Net des versements du mois", d.netMois],
                  ["Avances déjà remises", -d.avances],
                  ["Dépenses avancées par FMB", -d.depenses],
                  ["Remboursements reçus", d.remboursements],
                ].filter(([, v]) => v !== 0);
                const ouvert = openPeriode === d.periode;

                return (
                  <article key={d.periode} className="carte overflow-hidden">
                    <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-b border-[var(--border-line)] px-4 py-3.5 sm:px-5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <h3 className="text-[15px] font-semibold capitalize text-[var(--text-ink)]">{d.periodeLabel}</h3>
                        <StatutBadge statut={d.statut} />
                      </div>
                      <div className="flex flex-1 items-center justify-end gap-3 sm:flex-none">
                        <div className="mr-auto text-left sm:mr-0 sm:text-right">
                          <div className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-slate-light)]">Solde</div>
                          <div className="font-figures whitespace-nowrap text-base font-bold" style={{ color: couleurSolde(d.solde) }}>
                            {fmtF(d.solde)}
                          </div>
                        </div>
                        {d.paiements.length > 0 && (
                          <button onClick={() => telechargerRecu(d)} className="btn btn-contour btn-petit" style={{ color: COLORS.fleet }}>
                            <FileText size={14} /> Reçu
                          </button>
                        )}
                        {isAdmin && d.solde > 0 && (
                          <button
                            onClick={() => (ouvert ? setOpenPeriode(null) : ouvrirFormulaire(d))}
                            aria-expanded={ouvert}
                            className={`btn btn-petit ${ouvert ? "btn-contour" : "btn-succes"}`}
                          >
                            {ouvert ? <><X size={14} /> Fermer</> : <><Receipt size={14} /> Payer</>}
                          </button>
                        )}
                      </div>
                    </header>

                    {/* Détail du décompte */}
                    <div className="px-4 py-3.5 text-sm sm:px-5">
                      <dl>
                        {lignes.map(([label, v]) => (
                          <div key={label} className="flex items-baseline justify-between gap-4 py-1">
                            <dt className="min-w-0 text-[var(--text-slate)]">{label}</dt>
                            <dd className="font-figures shrink-0 whitespace-nowrap" style={{ color: v < 0 ? COLORS.red : COLORS.ink }}>
                              {v < 0 ? "− " : "+ "}{fmt(Math.abs(v))}
                            </dd>
                          </div>
                        ))}
                        <div className="mt-1.5 flex items-baseline justify-between gap-4 border-t border-[var(--border-line)] pt-2.5 font-semibold text-[var(--text-ink)]">
                          <dt>Net à payer</dt>
                          <dd className="font-figures shrink-0 whitespace-nowrap">{fmtF(d.netAPayer)}</dd>
                        </div>
                      </dl>

                      {/* Les avances dépassent le net du mois : le reliquat part
                          sur le mois suivant, et l'avance n'est pas récupérée. */}
                      {d.netAPayer < 0 && (
                        <p className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-slate)]">
                          <CircleAlert size={14} color={COLORS.amber} className="mt-0.5 shrink-0" />
                          <span>
                            Les avances et dépenses de ce mois dépassent le net des versements de{" "}
                            <strong className="text-[var(--text-ink)]">{fmtF(-d.netAPayer)}</strong>. Ce reliquat est reporté
                            sur le mois suivant ; les avances concernées restent « en cours » tant qu&apos;il n&apos;est pas absorbé.
                          </span>
                        </p>
                      )}

                      {/* Une fois le mois soldé, les avances qu'il couvrait sont
                          récupérées : elles basculent toutes seules côté Avances. */}
                      {d.statut === "solde" && d.netAPayer >= 0 && d.avances + d.depenses > 0 && (
                        <p className="mt-2.5 flex items-start gap-2 text-xs leading-relaxed text-[var(--text-slate)]">
                          <CheckCircle2 size={14} color={COLORS.green} className="mt-0.5 shrink-0" />
                          <span>
                            Les {fmtF(d.avances + d.depenses)} d&apos;avances et dépenses de ce mois sont récupérés : ils sont
                            marqués « réglés » dans l&apos;onglet Avances.
                          </span>
                        </p>
                      )}

                      {d.paiements.length > 0 && (
                        <div className="mt-3 border-t border-[var(--border-line)] pt-2.5">
                          <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--text-slate-light)]">
                            Versements effectués
                          </div>
                          {d.paiements.map((p) => (
                            <div key={p.id} className="flex items-center justify-between gap-3 py-1.5">
                              <div className="min-w-0 text-xs text-[var(--text-slate)]">
                                <span className="font-medium text-[var(--text-ink)]">{fmtDate(p.date_paiement)}</span>
                                {" · "}{MODE_LABEL[p.mode] || p.mode}
                                {p.reference && <span className="text-[var(--text-slate-light)]"> · réf. {p.reference}</span>}
                                {p.numero_recu && <span className="text-[var(--text-slate-light)]"> · {p.numero_recu}</span>}
                                {p.note && <div className="mt-0.5 break-words text-[var(--text-slate-light)]">{p.note}</div>}
                              </div>
                              <div className="flex shrink-0 items-center gap-1.5">
                                <span className="font-figures whitespace-nowrap font-semibold" style={{ color: COLORS.green }}>
                                  − {fmt(p.montant)}
                                </span>
                                {isAdmin && (
                                  <button onClick={() => onDelete(p)} disabled={saving} aria-label="Supprimer ce paiement" title="Supprimer ce paiement" className="btn-icone danger h-8 w-8">
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Formulaire de paiement */}
                    {isAdmin && ouvert && (
                      <div className="animate-fondu border-t border-[var(--border-line)] bg-[var(--bg-page)] px-4 py-4 sm:px-5">
                        <h4 className="mb-3 text-sm font-semibold text-[var(--text-ink)]">
                          Enregistrer un versement — <span className="capitalize">{d.periodeLabel}</span>
                        </h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <Champ label="Date du versement">
                            <input type="date" className="champ" value={form.datePaiement} onChange={(e) => setForm({ ...form, datePaiement: e.target.value })} />
                          </Champ>
                          <Champ label="Montant (FCFA)">
                            <input type="number" inputMode="numeric" min={0} className="champ font-figures" value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} placeholder="0" />
                          </Champ>
                          <Champ label="Mode de paiement">
                            <select className="champ" value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
                              {MODES.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                            </select>
                          </Champ>
                          <Champ label="Référence (n° Wave, OM…)">
                            <input className="champ" value={form.reference} onChange={(e) => setForm({ ...form, reference: e.target.value })} placeholder="Facultatif" />
                          </Champ>
                          <Champ label="Note" className="sm:col-span-2">
                            <input className="champ" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Facultatif" />
                          </Champ>
                        </div>
                        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center">
                          <button onClick={() => onSave(d)} disabled={saving || !form.montant} className="btn btn-succes">
                            {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                            Enregistrer le versement
                          </button>
                          <button onClick={() => setOpenPeriode(null)} className="btn btn-discret">Annuler</button>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <p className="mt-6 text-xs leading-relaxed text-[var(--text-slate-light)]">
            Un solde positif signifie qu&apos;il reste à verser au propriétaire ; un solde négatif indique un
            trop-perçu, qui se régularise automatiquement sur le mois suivant.
          </p>
        </>
      )}
    </main>
  );
}
