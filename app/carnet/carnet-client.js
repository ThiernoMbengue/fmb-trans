"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Loader2, Check, RotateCcw, Trash2, Paperclip, X, CalendarClock, Pencil,
  NotebookPen, Bus, Search, ArrowDownLeft, ArrowUpRight, StickyNote, FileText,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveNote, setNoteStatut, deleteNote, deleteFichier } from "./actions";
import { TYPES, TYPE_PAR_ID, joursAvant, aSurveiller } from "@/lib/carnet";
import { fmtF, fmtDate } from "@/lib/format";
import { iconeDuType } from "@/components/carnet-icones";
import { EnTete, Champ, Vide, Chargement, Indicateur, useToast, useConfirm } from "@/components/ui";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const fmtTaille = (o) => {
  const n = Number(o) || 0;
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
};

// Un nom de fichier sûr pour le stockage : on garde l'original en base,
// seul le chemin est normalisé.
const cheminSur = (nom) =>
  `${Date.now()}-${(nom || "fichier").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-80)}`;

const formeVide = () => ({
  id: null, type: "note", titre: "", detail: "",
  montant: "", dateEcheance: "", vehicleId: "",
});

function Pastille({ type }) {
  const t = TYPE_PAR_ID[type] || TYPE_PAR_ID.note;
  const Icone = iconeDuType(t.id);
  return (
    <span className="pastille" style={{ backgroundColor: `color-mix(in srgb, ${t.couleur} 13%, transparent)`, color: t.couleur }}>
      <Icone size={12} strokeWidth={2.3} /> {t.label}
    </span>
  );
}

function Echeance({ date }) {
  const jours = joursAvant(date);
  if (jours == null) return null;

  const couleur = jours < 0 ? COLORS.red : jours <= 7 ? COLORS.amber : COLORS.slate;
  const texte =
    jours < 0 ? `en retard de ${-jours} j` :
    jours === 0 ? "aujourd'hui" :
    jours === 1 ? "demain" : `dans ${jours} j`;

  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium" style={{ color: couleur }}>
      <CalendarClock size={13} /> {fmtDate(date)} · {texte}
    </span>
  );
}

export default function CarnetClient({ vehicles }) {
  const supabase = createClient();
  const montrer = useToast();
  const confirmer = useConfirm();

  const [lignes, setLignes] = useState([]);
  const [fichiers, setFichiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(formeVide());
  const [ouvert, setOuvert] = useState(false);
  const [filtreType, setFiltreType] = useState("tous");
  const [voirReglees, setVoirReglees] = useState(false);
  const [recherche, setRecherche] = useState("");
  const formulaire = useRef(null);
  const [televersement, setTeleversement] = useState(null);
  const inputFichier = useRef(null);
  const [cibleFichier, setCibleFichier] = useState(null);

  const vehiculeParId = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const charger = async ({ silencieux } = {}) => {
    if (!silencieux) setLoading(true);
    const [l, f] = await Promise.all([
      supabase.from("carnet").select("*").order("created_at", { ascending: false }),
      supabase.from("carnet_fichiers").select("*").order("created_at", { ascending: true }),
    ]);
    if (l.error) {
      montrer(
        /does not exist|could not find/i.test(l.error.message || "")
          ? "Le carnet n'est pas encore installé : exécutez migration_carnet.sql dans Supabase."
          : "Chargement impossible : " + l.error.message,
        "error"
      );
      setLignes([]);
    } else {
      setLignes(l.data || []);
    }
    if (!f.error) setFichiers(f.data || []);
    setLoading(false);
  };

  useEffect(() => {
    charger();
  }, []); // eslint-disable-line

  const resume = useMemo(() => aSurveiller(lignes), [lignes]);

  const visibles = useMemo(
    () =>
      lignes
        .filter((l) => (voirReglees ? true : l.statut === "ouvert"))
        .filter((l) => filtreType === "tous" || l.type === filtreType)
        .filter((l) => {
          const q = recherche.trim().toLowerCase();
          return !q || `${l.titre} ${l.detail || ""}`.toLowerCase().includes(q);
        }),
    [lignes, filtreType, voirReglees, recherche]
  );

  const fichiersDe = (carnetId) => fichiers.filter((f) => f.carnet_id === carnetId);

  const enregistrer = async () => {
    if (!form.titre.trim()) return;
    setSaving(true);
    const res = await saveNote(form);
    setSaving(false);
    if (res?.error) return montrer(res.error, "error");
    montrer(form.id ? "Modification enregistrée" : "Ajouté au carnet");
    setForm(formeVide());
    setOuvert(false);
    await charger({ silencieux: true });
  };

  const modifier = (l) => {
    setForm({
      id: l.id, type: l.type, titre: l.titre, detail: l.detail || "",
      montant: l.montant ?? "", dateEcheance: l.date_echeance || "",
      vehicleId: l.vehicle_id || "",
    });
    setOuvert(true);
    requestAnimationFrame(() => formulaire.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const basculerStatut = async (l) => {
    const res = await setNoteStatut(l.id, l.statut === "regle" ? "ouvert" : "regle");
    if (res?.error) return montrer(res.error, "error");
    montrer(l.statut === "regle" ? "Ligne rouverte" : "Marqué comme réglé");
    await charger({ silencieux: true });
  };

  const supprimer = async (l) => {
    const ok = await confirmer({
      titre: "Supprimer définitivement ?",
      message: `« ${l.titre} »\n\nSes pièces jointes seront supprimées aussi. Pour la sortir des totaux en gardant la trace, utilisez plutôt « Réglé ».`,
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;
    const res = await deleteNote(l.id);
    if (res?.error) return montrer(res.error, "error");
    montrer("Supprimé");
    await charger({ silencieux: true });
  };

  const choisirFichier = (carnetId) => {
    setCibleFichier(carnetId);
    inputFichier.current?.click();
  };

  const televerser = async (e) => {
    const fichier = e.target.files?.[0];
    e.target.value = "";
    if (!fichier || !cibleFichier) return;

    if (fichier.size > 10 * 1024 * 1024) {
      return montrer("Fichier trop lourd : 10 Mo maximum.", "error");
    }

    setTeleversement(cibleFichier);
    const chemin = `${cibleFichier}/${cheminSur(fichier.name)}`;

    const { error: errUpload } = await supabase.storage
      .from("carnet")
      .upload(chemin, fichier, { contentType: fichier.type || undefined });

    if (errUpload) {
      setTeleversement(null);
      return montrer(
        /bucket not found/i.test(errUpload.message || "")
          ? "L'espace de stockage « carnet » n'existe pas : exécutez migration_carnet.sql dans Supabase."
          : "Envoi impossible : " + errUpload.message,
        "error"
      );
    }

    const { error: errLigne } = await supabase.from("carnet_fichiers").insert({
      carnet_id: cibleFichier,
      nom: fichier.name,
      chemin,
      type_mime: fichier.type || null,
      taille: fichier.size,
    });

    setTeleversement(null);
    if (errLigne) return montrer("Envoi impossible : " + errLigne.message, "error");
    montrer("Pièce jointe ajoutée");
    await charger({ silencieux: true });
  };

  // Le bucket est privé : on demande un lien signé, valable une minute.
  const ouvrirFichier = async (f) => {
    const { data, error } = await supabase.storage.from("carnet").createSignedUrl(f.chemin, 60);
    if (error || !data?.signedUrl) return montrer("Lien indisponible : " + (error?.message || ""), "error");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const retirerFichier = async (f) => {
    const ok = await confirmer({ titre: "Supprimer cette pièce jointe ?", message: `« ${f.nom} »`, confirmer: "Supprimer", danger: true });
    if (!ok) return;
    const res = await deleteFichier(f.id);
    if (res?.error) return montrer(res.error, "error");
    montrer("Pièce jointe supprimée");
    await charger({ silencieux: true });
  };

  const typeActuel = TYPE_PAR_ID[form.type] || TYPE_PAR_ID.note;

  return (
    <main className="page">
      <input ref={inputFichier} type="file" className="hidden" onChange={televerser}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />

      <EnTete
        titre="Carnet de bord"
        description="Ce qui concerne l'entreprise sans avoir sa place ailleurs : un pense-bête, une dette hors du circuit des véhicules, une assurance qui expire, une facture à conserver. Visible du gestionnaire uniquement."
        actions={
          !ouvert && (
            <button onClick={() => { setForm(formeVide()); setOuvert(true); }} className="btn btn-primaire">
              <Plus size={16} /> Nouvelle entrée
            </button>
          )
        }
      />

      {/* Résumé : seulement ce qui demande une action */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Indicateur icone={ArrowDownLeft} label="On nous doit" valeur={fmtF(resume.aRecevoir)} couleur={COLORS.green} />
        <Indicateur icone={ArrowUpRight} label="Nous devons" valeur={fmtF(resume.aPayer)} couleur={COLORS.red} />
        <Indicateur
          icone={CalendarClock}
          label="Échéances (30 j)"
          valeur={resume.echeances.length}
          legende={resume.enRetard > 0 ? `dont ${resume.enRetard} en retard` : null}
          couleur={resume.enRetard > 0 ? COLORS.red : COLORS.amber}
        />
        <Indicateur icone={StickyNote} label="Notes à classer" valeur={resume.aClasser} couleur={COLORS.slate} />
      </div>

      {/* Formulaire d'ajout / de modification */}
      {ouvert && (
        <section ref={formulaire} className="carte animate-fondu mb-5 scroll-mt-20 p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
              <NotebookPen size={16} color={COLORS.fleet} />
              {form.id ? "Modifier l'entrée" : "Nouvelle entrée"}
            </h2>
            <button onClick={() => { setOuvert(false); setForm(formeVide()); }} aria-label="Fermer" className="btn-icone h-8 w-8">
              <X size={15} />
            </button>
          </div>

          <div className="mb-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Type d'entrée">
            {TYPES.map((t) => {
              const Icone = iconeDuType(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t.id}
                  onClick={() => setForm({ ...form, type: t.id })}
                  className="puce"
                >
                  <Icone size={14} style={{ color: t.couleur }} /> {t.label}
                </button>
              );
            })}
          </div>
          <p className="mb-4 text-xs text-[var(--text-slate-light)]">{typeActuel.aide}</p>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Champ label="Titre" className="sm:col-span-3">
              <input
                autoFocus
                className="champ"
                placeholder="Assurance QM3 à renouveler"
                value={form.titre}
                onChange={(e) => setForm({ ...form, titre: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enregistrer(); } }}
              />
            </Champ>
            <Champ label="Détail (facultatif)" className="sm:col-span-3">
              <textarea
                rows={2}
                className="champ resize-y"
                value={form.detail}
                onChange={(e) => setForm({ ...form, detail: e.target.value })}
              />
            </Champ>
            <Champ label="Montant (FCFA)">
              <input type="number" inputMode="numeric" min={0} className="champ font-figures" placeholder="Facultatif"
                value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
            </Champ>
            <Champ label="Échéance">
              <input type="date" className="champ"
                value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} />
            </Champ>
            <Champ label="Véhicule concerné">
              <select className="champ" value={form.vehicleId}
                onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                <option value="">Aucun</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
                ))}
              </select>
            </Champ>
          </div>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <button onClick={enregistrer} disabled={saving || !form.titre.trim()} className="btn btn-succes">
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {form.id ? "Enregistrer" : "Ajouter au carnet"}
            </button>
            <button onClick={() => { setOuvert(false); setForm(formeVide()); }} className="btn btn-discret">Annuler</button>
            {!form.id && (
              <span className="text-xs text-[var(--text-slate-light)] sm:ml-auto">
                Les pièces jointes s&apos;ajoutent une fois la ligne créée.
              </span>
            )}
          </div>
        </section>
      )}

      {/* Filtres */}
      <div className="mb-3 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="sans-barre -mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 sm:pb-0 lg:flex-1">
          <button onClick={() => setFiltreType("tous")} aria-pressed={filtreType === "tous"} className="puce">
            Tout
          </button>
          {TYPES.map((t) => {
            const n = lignes.filter((l) => l.type === t.id && (voirReglees || l.statut === "ouvert")).length;
            if (!n) return null;
            const Icone = iconeDuType(t.id);
            return (
              <button key={t.id} onClick={() => setFiltreType(t.id)} aria-pressed={filtreType === t.id} className="puce">
                <Icone size={14} style={{ color: t.couleur }} /> {t.label} <span className="font-normal text-[var(--text-slate-light)]">{n}</span>
              </button>
            );
          })}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="relative min-w-0 flex-1 lg:w-56 lg:flex-none">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-slate-light)]" />
            <input type="search" aria-label="Rechercher dans le carnet" className="champ py-1.5 pl-9" placeholder="Rechercher…"
              value={recherche} onChange={(e) => setRecherche(e.target.value)} />
          </div>
          <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs text-[var(--text-slate)]">
            <input type="checkbox" className="h-4 w-4 accent-[var(--fleet-bright)]" checked={voirReglees} onChange={(e) => setVoirReglees(e.target.checked)} />
            Afficher les réglées
          </label>
        </div>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="carte p-5"><Chargement lignes={5} /></div>
      ) : visibles.length === 0 ? (
        <div className="carte">
          <Vide icone={NotebookPen} titre={lignes.length === 0 ? "Rien de noté pour l'instant" : "Aucune ligne ne correspond"}>
            {lignes.length === 0
              ? "Commencez par ce que vous avez en tête en ce moment : une dette, une échéance, un simple rappel."
              : "Modifiez le filtre ou la recherche pour élargir la liste."}
          </Vide>
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visibles.map((l) => {
            const regle = l.statut === "regle";
            const pj = fichiersDe(l.id);
            const vehicule = l.vehicle_id ? vehiculeParId[l.vehicle_id] : null;

            return (
              <article key={l.id} className="carte flex min-w-0 flex-col p-4" style={{ opacity: regle ? 0.65 : 1 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1.5">
                    <Pastille type={l.type} />
                    {l.date_echeance && !regle && <Echeance date={l.date_echeance} />}
                    {regle && (
                      <span className="inline-flex items-center gap-1 text-xs font-medium" style={{ color: COLORS.green }}>
                        <Check size={13} /> Réglé{l.regle_le ? ` le ${fmtDate(l.regle_le)}` : ""}
                      </span>
                    )}
                  </div>
                  <div className="-mr-1 -mt-1 flex shrink-0 items-center gap-1">
                    <button onClick={() => basculerStatut(l)} aria-label={regle ? "Rouvrir" : "Marquer réglé"} title={regle ? "Rouvrir" : "Marquer réglé"}
                      className={`btn-icone h-8 w-8 ${regle ? "" : "succes"}`}>
                      {regle ? <RotateCcw size={14} /> : <Check size={15} />}
                    </button>
                    <button onClick={() => modifier(l)} aria-label="Modifier" title="Modifier" className="btn-icone h-8 w-8">
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => supprimer(l)} aria-label="Supprimer" title="Supprimer" className="btn-icone danger h-8 w-8">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                <h3 className="mt-2 break-words text-[15px] font-semibold leading-snug text-[var(--text-ink)]" style={{ textDecorationLine: regle ? "line-through" : "none" }}>
                  {l.titre}
                </h3>

                {l.detail && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--text-slate)]">{l.detail}</p>
                )}

                {(l.montant != null || vehicule) && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    {l.montant != null && (
                      <span className="font-figures text-base font-bold"
                        style={{ color: l.type === "a_payer" ? COLORS.red : l.type === "a_recevoir" ? COLORS.green : COLORS.ink }}>
                        {fmtF(l.montant)}
                      </span>
                    )}
                    {vehicule && (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[var(--text-slate)]">
                        <Bus size={13} /> {vehicule.marque} — {vehicule.immatriculation}
                      </span>
                    )}
                  </div>
                )}

                {/* Pièces jointes */}
                <div className="mt-auto flex flex-wrap items-center gap-2 pt-3.5">
                  {pj.map((f) => (
                    <span key={f.id} className="inline-flex max-w-full items-center rounded-lg border border-[var(--border-line)] bg-[var(--bg-page)] text-xs">
                      <button onClick={() => ouvrirFichier(f)} title={`Ouvrir ${f.nom} (${fmtTaille(f.taille)})`}
                        className="inline-flex min-w-0 items-center gap-1.5 py-1.5 pl-2.5 pr-1.5 font-medium hover:underline" style={{ color: COLORS.fleet }}>
                        <FileText size={13} className="shrink-0" />
                        <span className="max-w-[11rem] truncate">{f.nom}</span>
                      </button>
                      <button onClick={() => retirerFichier(f)} aria-label={`Supprimer ${f.nom}`} title="Supprimer la pièce jointe"
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-r-lg text-[var(--text-slate-light)] hover:text-[var(--red)]">
                        <X size={13} />
                      </button>
                    </span>
                  ))}

                  <button onClick={() => choisirFichier(l.id)} disabled={televersement === l.id} className="btn btn-discret btn-petit" style={{ color: COLORS.fleet }}>
                    {televersement === l.id
                      ? <><Loader2 size={13} className="animate-spin" /> Envoi…</>
                      : <><Paperclip size={13} /> {pj.length ? "Ajouter" : "Joindre un justificatif"}</>}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-[var(--text-slate-light)]">
        Une ligne réglée sort des totaux mais reste consultable — cochez « Afficher les réglées » pour la retrouver.
        Les pièces jointes sont conservées dans un espace privé : elles ne sont accessibles qu&apos;à travers cette
        page, jamais par une adresse publique.
      </p>
    </main>
  );
}
