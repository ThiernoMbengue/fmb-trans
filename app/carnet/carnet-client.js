"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Plus, Loader2, AlertCircle, Check, RotateCcw, Trash2, Paperclip, Download,
  X, CalendarClock, Pencil, NotebookPen, Bus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { saveNote, setNoteStatut, deleteNote, deleteFichier } from "./actions";
import { TYPES, TYPE_PAR_ID, joursAvant, aSurveiller } from "@/lib/carnet";

const COLORS = {
  ink: "var(--text-ink)", fleet: "var(--fleet-bright)", amber: "var(--amber)",
  green: "var(--green)", red: "var(--red)", purple: "var(--purple)",
  slate: "var(--text-slate)", line: "var(--border-line)",
};

const inputClass =
  "w-full min-w-0 text-sm bg-[var(--bg-page)] border border-[var(--border-line)] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--fleet)]/30";

const fmt = (n) => Math.round(Number(n) || 0).toLocaleString("fr-FR").replace(/ | /g, " ");

const fmtDate = (iso) => {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
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
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ backgroundColor: `color-mix(in srgb, ${t.couleur} 14%, transparent)`, color: t.couleur }}
    >
      {t.emoji} {t.label}
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
    <span className="inline-flex items-center gap-1 text-[11px] whitespace-nowrap" style={{ color: couleur }}>
      <CalendarClock size={12} /> {fmtDate(date)} · {texte}
    </span>
  );
}

export default function CarnetClient({ vehicles }) {
  const supabase = createClient();

  const [lignes, setLignes] = useState([]);
  const [fichiers, setFichiers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [form, setForm] = useState(formeVide());
  const [ouvert, setOuvert] = useState(false);
  const [filtreType, setFiltreType] = useState("tous");
  const [voirReglees, setVoirReglees] = useState(false);
  const [televersement, setTeleversement] = useState(null);
  const inputFichier = useRef(null);
  const [cibleFichier, setCibleFichier] = useState(null);

  const vehiculeParId = useMemo(
    () => Object.fromEntries(vehicles.map((v) => [v.id, v])),
    [vehicles]
  );

  const montrer = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), type === "success" ? 2800 : 7000);
  };

  const charger = async () => {
    setLoading(true);
    const [l, f] = await Promise.all([
      supabase.from("carnet").select("*").order("created_at", { ascending: false }),
      supabase.from("carnet_fichiers").select("*").order("created_at", { ascending: true }),
    ]);
    if (l.error) {
      montrer(
        /does not exist|could not find/i.test(l.error.message || "")
          ? "La migration migration_carnet.sql n'a pas encore été exécutée dans Supabase."
          : "Erreur : " + l.error.message,
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
        .filter((l) => filtreType === "tous" || l.type === filtreType),
    [lignes, filtreType, voirReglees]
  );

  const fichiersDe = (carnetId) => fichiers.filter((f) => f.carnet_id === carnetId);

  const enregistrer = async () => {
    if (!form.titre.trim()) return;
    setSaving(true);
    const res = await saveNote(form);
    setSaving(false);
    if (res?.error) return montrer(res.error, "error");
    montrer(form.id ? "Modifié" : "Ajouté");
    setForm(formeVide());
    setOuvert(false);
    await charger();
  };

  const modifier = (l) => {
    setForm({
      id: l.id, type: l.type, titre: l.titre, detail: l.detail || "",
      montant: l.montant ?? "", dateEcheance: l.date_echeance || "",
      vehicleId: l.vehicle_id || "",
    });
    setOuvert(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const basculerStatut = async (l) => {
    const res = await setNoteStatut(l.id, l.statut === "regle" ? "ouvert" : "regle");
    if (res?.error) return montrer(res.error, "error");
    await charger();
  };

  const supprimer = async (l) => {
    if (!confirm(`Supprimer définitivement « ${l.titre} » ?\n\nSes pièces jointes seront supprimées aussi. Pour la sortir des totaux en gardant la trace, utilisez plutôt « Réglé ».`)) return;
    const res = await deleteNote(l.id);
    if (res?.error) return montrer(res.error, "error");
    montrer("Supprimé");
    await charger();
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
          ? "Le bucket « carnet » n'existe pas : exécutez migration_carnet.sql."
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
    if (errLigne) return montrer("Erreur : " + errLigne.message, "error");
    montrer("Pièce jointe ajoutée");
    await charger();
  };

  // Le bucket est privé : on demande un lien signé, valable une minute.
  const ouvrirFichier = async (f) => {
    const { data, error } = await supabase.storage.from("carnet").createSignedUrl(f.chemin, 60);
    if (error || !data?.signedUrl) return montrer("Lien indisponible : " + (error?.message || ""), "error");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const retirerFichier = async (f) => {
    if (!confirm(`Supprimer la pièce jointe « ${f.nom} » ?`)) return;
    const res = await deleteFichier(f.id);
    if (res?.error) return montrer(res.error, "error");
    await charger();
  };

  const typeActuel = TYPE_PAR_ID[form.type] || TYPE_PAR_ID.note;

  return (
    <main className="px-4 md:px-8 py-6 max-w-4xl mx-auto animate-fade-up">
      <input ref={inputFichier} type="file" className="hidden" onChange={televerser}
        accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" />

      {toast && (
        <div
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-start gap-2 text-white max-w-[90vw]"
          style={{ backgroundColor: toast.type === "error" ? COLORS.red : COLORS.green }}
        >
          {toast.type === "error" && <AlertCircle size={16} className="shrink-0 mt-0.5" />}
          {toast.msg}
        </div>
      )}

      <h1 className="font-display text-2xl font-bold tracking-tight" style={{ color: COLORS.ink }}>
        Carnet de bord
      </h1>
      <p className="text-sm text-[var(--text-slate)] mt-1.5 mb-5 max-w-2xl leading-relaxed">
        Tout ce qui concerne l&apos;entreprise sans avoir sa place ailleurs : une chose à ne pas
        oublier, une dette hors du circuit des véhicules, une assurance qui expire, une facture à
        conserver. Visible du gestionnaire uniquement.
      </p>

      {/* Résumé : seulement ce qui demande une action */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: "On nous doit", valeur: `${fmt(resume.aRecevoir)} F`, couleur: COLORS.green },
          { label: "Nous devons", valeur: `${fmt(resume.aPayer)} F`, couleur: COLORS.red },
          {
            label: "Échéances ≤ 30 j",
            valeur: resume.echeances.length,
            couleur: resume.enRetard > 0 ? COLORS.red : COLORS.amber,
            legende: resume.enRetard > 0 ? `dont ${resume.enRetard} en retard` : null,
          },
          { label: "Notes à classer", valeur: resume.aClasser, couleur: COLORS.slate },
        ].map((c) => (
          <div key={c.label} className="surface-card rounded-2xl p-4">
            <div className="text-xs text-[var(--text-slate)]">{c.label}</div>
            <div className="font-figures text-xl font-bold mt-1" style={{ color: c.couleur }}>{c.valeur}</div>
            {c.legende && <div className="text-[10px] mt-0.5" style={{ color: COLORS.red }}>{c.legende}</div>}
          </div>
        ))}
      </div>

      {/* Ajout rapide */}
      <div className="surface-card rounded-2xl overflow-hidden mb-5">
        {!ouvert ? (
          <button
            onClick={() => { setForm(formeVide()); setOuvert(true); }}
            className="w-full flex items-center gap-2.5 px-5 py-4 text-left hover:bg-[var(--bg-page)]"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 16%, transparent)" }}>
              <Plus size={16} color={COLORS.fleet} />
            </div>
            <span className="text-sm text-[var(--text-slate)]">
              Noter quelque chose… une dette, une échéance, un simple pense-bête
            </span>
          </button>
        ) : (
          <div className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2 text-sm font-semibold" style={{ color: COLORS.ink }}>
                <NotebookPen size={15} color={COLORS.fleet} />
                {form.id ? "Modifier" : "Nouvelle entrée"}
              </div>
              <button onClick={() => { setOuvert(false); setForm(formeVide()); }}
                className="text-xs text-[var(--text-slate-light)] flex items-center gap-1">
                <X size={13} /> Fermer
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5 mb-3">
              {TYPES.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setForm({ ...form, type: t.id })}
                  className="text-xs font-medium px-2.5 py-1.5 rounded-lg border transition-colors"
                  style={
                    form.type === t.id
                      ? { borderColor: t.couleur, backgroundColor: `color-mix(in srgb, ${t.couleur} 14%, transparent)`, color: t.couleur }
                      : { borderColor: COLORS.line, color: "var(--text-slate)" }
                  }
                >
                  {t.emoji} {t.label}
                </button>
              ))}
            </div>
            <div className="text-[11px] text-[var(--text-slate-light)] mb-3">{typeActuel.aide}</div>

            <input
              autoFocus
              className={inputClass}
              placeholder="Titre — ex : Assurance QM3 à renouveler"
              value={form.titre}
              onChange={(e) => setForm({ ...form, titre: e.target.value })}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); enregistrer(); } }}
            />

            <textarea
              rows={2}
              className={inputClass + " mt-2 resize-y"}
              placeholder="Détail (facultatif)"
              value={form.detail}
              onChange={(e) => setForm({ ...form, detail: e.target.value })}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-slate)]">Montant (FCFA)</span>
                <input type="number" className={inputClass} placeholder="facultatif"
                  value={form.montant} onChange={(e) => setForm({ ...form, montant: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-slate)]">Échéance</span>
                <input type="date" className={inputClass}
                  value={form.dateEcheance} onChange={(e) => setForm({ ...form, dateEcheance: e.target.value })} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-[var(--text-slate)]">Véhicule concerné</span>
                <select className={inputClass} value={form.vehicleId}
                  onChange={(e) => setForm({ ...form, vehicleId: e.target.value })}>
                  <option value="">— aucun —</option>
                  {vehicles.map((v) => (
                    <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
                  ))}
                </select>
              </label>
            </div>

            <button
              onClick={enregistrer}
              disabled={saving || !form.titre.trim()}
              className="mt-4 flex items-center gap-2 text-sm font-medium px-5 py-2.5 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: COLORS.green }}
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              {form.id ? "Enregistrer" : "Ajouter"}
            </button>
            {!form.id && (
              <div className="text-[11px] text-[var(--text-slate-light)] mt-2">
                Les pièces jointes s&apos;ajoutent une fois la ligne créée.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap items-center gap-1.5 mb-3">
        <button
          onClick={() => setFiltreType("tous")}
          className="text-xs font-medium px-2.5 py-1.5 rounded-lg border"
          style={filtreType === "tous"
            ? { borderColor: COLORS.fleet, backgroundColor: `color-mix(in srgb, ${COLORS.fleet} 14%, transparent)`, color: COLORS.fleet }
            : { borderColor: COLORS.line, color: "var(--text-slate)" }}
        >
          Tout
        </button>
        {TYPES.map((t) => {
          const n = lignes.filter((l) => l.type === t.id && (voirReglees || l.statut === "ouvert")).length;
          if (!n) return null;
          return (
            <button
              key={t.id}
              onClick={() => setFiltreType(t.id)}
              className="text-xs font-medium px-2.5 py-1.5 rounded-lg border"
              style={filtreType === t.id
                ? { borderColor: t.couleur, backgroundColor: `color-mix(in srgb, ${t.couleur} 14%, transparent)`, color: t.couleur }
                : { borderColor: COLORS.line, color: "var(--text-slate)" }}
            >
              {t.emoji} {t.label} <span className="opacity-60">{n}</span>
            </button>
          );
        })}
        <label className="flex items-center gap-1.5 text-xs text-[var(--text-slate)] ml-auto cursor-pointer">
          <input type="checkbox" checked={voirReglees} onChange={(e) => setVoirReglees(e.target.checked)} />
          Voir les lignes réglées
        </label>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--text-slate-light)] py-10">
          <Loader2 size={16} className="animate-spin" /> Chargement…
        </div>
      ) : visibles.length === 0 ? (
        <div className="surface-card rounded-2xl p-8 text-center text-sm text-[var(--text-slate-light)]">
          {lignes.length === 0
            ? "Rien de noté pour l'instant. Commencez par ce que vous avez en tête en ce moment."
            : "Aucune ligne ne correspond à ce filtre."}
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visibles.map((l) => {
            const regle = l.statut === "regle";
            const pj = fichiersDe(l.id);
            const vehicule = l.vehicle_id ? vehiculeParId[l.vehicle_id] : null;

            return (
              <div key={l.id} className="surface-card rounded-2xl p-4" style={{ opacity: regle ? 0.6 : 1 }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <Pastille type={l.type} />
                      {l.date_echeance && !regle && <Echeance date={l.date_echeance} />}
                      {regle && (
                        <span className="text-[11px] inline-flex items-center gap-1" style={{ color: COLORS.green }}>
                          <Check size={12} /> réglé {l.regle_le ? `le ${fmtDate(l.regle_le)}` : ""}
                        </span>
                      )}
                    </div>

                    <div className="text-sm font-semibold break-words" style={{ color: COLORS.ink, textDecoration: regle ? "line-through" : "none" }}>
                      {l.titre}
                    </div>

                    {l.detail && (
                      <div className="text-xs text-[var(--text-slate)] mt-1 leading-relaxed whitespace-pre-wrap break-words">
                        {l.detail}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-3 mt-2">
                      {l.montant != null && (
                        <span className="font-figures text-sm font-semibold"
                          style={{ color: l.type === "a_payer" ? COLORS.red : l.type === "a_recevoir" ? COLORS.green : COLORS.ink }}>
                          {fmt(l.montant)} F
                        </span>
                      )}
                      {vehicule && (
                        <span className="inline-flex items-center gap-1 text-[11px] text-[var(--text-slate-light)]">
                          <Bus size={12} /> {vehicule.marque} — {vehicule.immatriculation}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => basculerStatut(l)} title={regle ? "Rouvrir" : "Marquer réglé"}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border"
                      style={{ borderColor: COLORS.line, color: regle ? "var(--text-slate)" : COLORS.green }}>
                      {regle ? <RotateCcw size={14} /> : <Check size={15} />}
                    </button>
                    <button onClick={() => modifier(l)} title="Modifier"
                      className="flex items-center justify-center w-8 h-8 rounded-lg border"
                      style={{ borderColor: COLORS.line, color: "var(--text-slate-light)" }}>
                      <Pencil size={14} />
                    </button>
                    <button onClick={() => supprimer(l)} title="Supprimer"
                      className="flex items-center justify-center w-8 h-8 rounded-lg border"
                      style={{ borderColor: COLORS.line, color: "var(--text-slate-light)" }}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>

                {/* Pièces jointes */}
                <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t" style={{ borderColor: COLORS.line }}>
                  {pj.map((f) => (
                    <span key={f.id}
                      className="inline-flex items-center gap-1.5 text-[11px] rounded-lg px-2 py-1 border"
                      style={{ borderColor: COLORS.line }}>
                      <Paperclip size={11} className="text-[var(--text-slate-light)]" />
                      <button onClick={() => ouvrirFichier(f)} className="hover:underline max-w-[160px] truncate"
                        style={{ color: COLORS.fleet }} title={`${f.nom} — ${fmtTaille(f.taille)}`}>
                        {f.nom}
                      </button>
                      <button onClick={() => ouvrirFichier(f)} title="Ouvrir" className="text-[var(--text-slate-light)] hover:text-[var(--fleet)]">
                        <Download size={11} />
                      </button>
                      <button onClick={() => retirerFichier(f)} title="Retirer" className="text-[var(--text-slate-light)] hover:text-[var(--red)]">
                        <X size={11} />
                      </button>
                    </span>
                  ))}

                  <button
                    onClick={() => choisirFichier(l.id)}
                    disabled={televersement === l.id}
                    className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-1 rounded-lg border disabled:opacity-60"
                    style={{ borderColor: COLORS.line, color: COLORS.fleet }}
                  >
                    {televersement === l.id
                      ? <><Loader2 size={11} className="animate-spin" /> Envoi…</>
                      : <><Paperclip size={11} /> {pj.length ? "Ajouter" : "Joindre un justificatif"}</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-xs text-[var(--text-slate-light)] mt-8 pb-10 leading-relaxed">
        Une ligne réglée sort des totaux mais reste consultable — cochez « Voir les lignes réglées »
        pour la retrouver. Les pièces jointes sont stockées dans un espace privé : elles ne sont
        accessibles qu&apos;à travers cette page, jamais par une adresse publique.
      </div>
    </main>
  );
}
