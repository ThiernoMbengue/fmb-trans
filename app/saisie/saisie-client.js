"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import {
  Save, Pencil, Trash2, X, Loader2, AlertCircle, Search, Repeat, CalendarRange,
  MessageSquareText, ChevronRight, ChevronDown, ClipboardList, Plus, Bus, KeyRound,
  ScanLine, Paperclip, ZoomIn, Sparkles, TriangleAlert,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { lireTout } from "@/lib/supabase/lire-tout";
import { useVehiculeCourant } from "@/lib/vehicule-courant";
import { fmt, fmtF, fmtJour, fmtPeriode, todayISO, ajouterJours, plageDeJours } from "@/lib/format";
import { EnTete, SelecteurVehicule, Champ, Bandeau, Vide, Chargement, useToast, useConfirm } from "@/components/ui";
import { preparerImage } from "@/lib/image";
import { saveEntry, deleteEntry, saveLocationRange } from "./actions";

const COLORS = { ink: "var(--text-ink)", fleet: "var(--fleet-bright)", green: "var(--green)", red: "var(--red)", amber: "var(--amber)", line: "var(--border-line)" };

const majuscule = (t) => t.charAt(0).toUpperCase() + t.slice(1);

const emptyForm = (chauffeur, date) => ({
  date, receveur: chauffeur || "", recette: "", gazoil: "", gazoilNote: "Gazoil",
  autres: "", autresNote: "", totalCaisse: "", net: "", sansChauffeur: false, note: "",
});

const formDe = (e) => ({
  date: e.date, receveur: e.receveur || "", recette: String(e.recette ?? ""),
  gazoil: String(e.gazoil ?? ""), gazoilNote: e.gazoil_note || "",
  autres: String(e.autres ?? ""), autresNote: e.autres_note || "",
  totalCaisse: String(e.total_caisse ?? ""), net: String(e.net ?? ""),
  sansChauffeur: e.sans_chauffeur === true,
  note: e.note || "",
});

function Detail({ label, valeur, legende, accent }) {
  return (
    <div className="min-w-0 rounded-xl bg-[var(--bg-surface)] p-3">
      <div className="mb-0.5 text-[11px] text-[var(--text-slate)]">{label}</div>
      <div className="font-figures text-sm font-semibold" style={{ color: accent || COLORS.ink }}>{valeur}</div>
      {legende && <div className="mt-1 break-words text-[11px] text-[var(--text-slate-light)]">{legende}</div>}
    </div>
  );
}

// Champ de montant : clavier numérique sur mobile, pas de valeur négative.
function Montant({ value, onChange, className = "", ...rest }) {
  return (
    <input
      type="number"
      inputMode="numeric"
      min={0}
      step="any"
      className={"champ font-figures " + className}
      value={value}
      onChange={onChange}
      {...rest}
    />
  );
}

export default function SaisieClient({ vehicles, vehiculeInitial }) {
  const supabase = createClient();
  const toast = useToast();
  const confirmer = useConfirm();
  const formulaire = useRef(null);

  const [vehicleId, setVehicleId] = useVehiculeCourant(vehicles, vehiculeInitial);
  // Numéro de la dernière demande de chargement : une réponse en retard,
  // arrivée après un changement de véhicule, est ignorée.
  const demande = useRef(0);
  const vehicle = vehicles.find((v) => v.id === vehicleId) || null;

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(null);
  const [editingDate, setEditingDate] = useState(null);

  // Capture d'écran du chauffeur, jointe à la saisie en cours :
  // { apercu, blob, etat: "lecture" | "prete", lecture } — ou null.
  const [capture, setCapture] = useState(null);
  const [agrandie, setAgrandie] = useState(false);
  const choixFichier = useRef(null);
  // Justificatifs déjà enregistrés pour ce véhicule, par date.
  const [justificatifs, setJustificatifs] = useState({});

  // Historique
  const [ligneOuverte, setLigneOuverte] = useState(null);
  const [moisFiltre, setMoisFiltre] = useState("tous");
  const [recherche, setRecherche] = useState("");
  const [dateFiltre, setDateFiltre] = useState("");
  const [nbAffichees, setNbAffichees] = useState(30);

  // Location sur plusieurs jours
  const [locOpen, setLocOpen] = useState(false);
  const [locDebut, setLocDebut] = useState("");
  const [locFin, setLocFin] = useState("");
  const [locMontant, setLocMontant] = useState("");
  const [locReceveur, setLocReceveur] = useState("");
  const [locNote, setLocNote] = useState("Location");
  const [locOverwrite, setLocOverwrite] = useState(false);
  const [locSaving, setLocSaving] = useState(false);

  const loadEntries = async (vId, { silencieux } = {}) => {
    const numero = ++demande.current;
    if (!silencieux) setLoading(true);
    // Lecture paginée : un véhicule dépasse 1 000 saisies en moins de trois ans.
    const { data, error } = await lireTout(() =>
      supabase.from("entries").select("*").eq("vehicle_id", vId).order("date", { ascending: true })
    );
    // Les justificatifs arrivent par une migration : si la table n'existe
    // pas encore, la saisie fonctionne quand même, sans eux.
    const pieces = await supabase.from("entry_justificatifs").select("id,date,nom,chemin").eq("vehicle_id", vId);
    if (numero !== demande.current) return;
    if (error) toast("Chargement impossible : " + error.message, "error");
    else setEntries(data || []);
    const parDate = {};
    for (const j of pieces.error ? [] : pieces.data || []) (parDate[j.date] ||= []).push(j);
    setJustificatifs(parDate);
    setLoading(false);
  };

  useEffect(() => {
    if (vehicleId) loadEntries(vehicleId);
  }, [vehicleId]); // eslint-disable-line

  const lastDate = entries[entries.length - 1]?.date;

  // Par défaut, le formulaire propose le lendemain de la dernière saisie —
  // sans jamais dépasser aujourd'hui.
  useEffect(() => {
    // Une capture en cours de vérification a rempli le formulaire : on ne
    // l'écrase pas quand le véhicule ou l'historique change.
    if (!vehicle || editingDate || capture) return;
    const auj = todayISO();
    const suivante = lastDate ? ajouterJours(lastDate, 1) : auj;
    setForm(emptyForm(vehicle.chauffeur, suivante > auj ? auj : suivante));
  }, [vehicleId, vehicle, lastDate]); // eslint-disable-line

  const updateForm = (patch) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      const recette = Number(next.recette) || 0;
      const gazoil = Number(next.gazoil) || 0;
      const autres = Number(next.autres) || 0;
      if (patch.recette !== undefined || patch.gazoil !== undefined) {
        next.totalCaisse = String(recette - gazoil);
      }
      if (patch.recette !== undefined || patch.gazoil !== undefined || patch.autres !== undefined) {
        next.net = String((Number(next.totalCaisse) || 0) - autres);
      }
      return next;
    });
  };

  const versFormulaire = () =>
    formulaire.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  // Échap referme la capture agrandie.
  useEffect(() => {
    if (!agrandie) return;
    const touche = (e) => { if (e.key === "Escape") setAgrandie(false); };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [agrandie]);

  const retirerCapture = () => {
    setCapture((c) => { if (c?.apercu) URL.revokeObjectURL(c.apercu); return null; });
    setAgrandie(false);
  };

  // Lit la capture envoyée par le chauffeur et pré-remplit le formulaire.
  // Rien n'est enregistré : la personne vérifie, corrige, puis valide.
  const lireCapture = async (fichier) => {
    if (!fichier) return;
    let image;
    try {
      image = await preparerImage(fichier);
    } catch (e) {
      return toast(e?.message || "Image illisible.", "error");
    }

    setCapture((c) => {
      if (c?.apercu) URL.revokeObjectURL(c.apercu);
      return { apercu: URL.createObjectURL(image.blob), blob: image.blob, etat: "lecture", lecture: null };
    });
    versFormulaire();

    let lecture = null;
    try {
      const reponse = await fetch("/api/ia/lire-versement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: image.base64, type: image.type }),
      });
      const corps = await reponse.json().catch(() => ({}));
      if (!reponse.ok) {
        // La capture reste jointe comme justificatif, même sans lecture.
        toast(
          corps.nonConfiguree
            ? "La lecture automatique n'est pas encore activée. La capture est jointe : remplissez les montants à la main."
            : (corps.error || "La lecture a échoué.") + " La capture reste jointe : remplissez les montants à la main.",
          "warning"
        );
      } else {
        lecture = corps.lecture || null;
      }
    } catch {
      toast("Connexion interrompue pendant la lecture. La capture reste jointe : remplissez les montants à la main.", "warning");
    }

    setCapture((c) => (c ? { ...c, etat: "prete", lecture } : c));
    if (!lecture) return;

    if (!lecture.lisible) {
      return toast("Cette image ne ressemble pas à une capture de versement. Vérifiez-la, ou remplissez la saisie à la main.", "warning");
    }

    // Le véhicule lu dans le nom du groupe, s'il fait partie de la flotte.
    const cible = vehicles.find((v) => v.id === lecture.vehicleId) || vehicle;
    if (cible && cible.id !== vehicleId) setVehicleId(cible.id);
    setEditingDate(null);

    setForm((actuel) => {
      const base = emptyForm(cible?.chauffeur, lecture.date || actuel?.date || todayISO());
      const recette = lecture.recette ?? "";
      const gazoil = lecture.gazoil ?? "";
      const autres = lecture.autres ?? "";
      const caisse = (Number(recette) || 0) - (Number(gazoil) || 0);
      return {
        ...base,
        receveur: lecture.receveur || base.receveur,
        recette: recette === "" ? "" : String(recette),
        gazoil: gazoil === "" ? "" : String(gazoil),
        autres: autres === "" ? "" : String(autres),
        autresNote: lecture.autresNote || "",
        totalCaisse: recette === "" ? "" : String(caisse),
        net: recette === "" ? "" : String(caisse - (Number(autres) || 0)),
        note: lecture.remarque || "",
      };
    });
    toast(
      lecture.incertitudes.length
        ? "Capture lue, avec des points à vérifier avant d'enregistrer."
        : "Capture lue : vérifiez les montants, puis enregistrez.",
      lecture.incertitudes.length ? "warning" : "success"
    );
  };

  // Conserve la capture avec la saisie qui vient d'être enregistrée.
  const conserverCapture = async (vId, date, blob) => {
    const chemin = `${vId}/${date}-${Date.now()}.jpg`;
    const envoi = await supabase.storage.from("justificatifs").upload(chemin, blob, { contentType: "image/jpeg" });
    if (envoi.error) return envoi.error;
    const { error } = await supabase.from("entry_justificatifs").insert({
      vehicle_id: vId, date, nom: `capture-${date}.jpg`, chemin, type_mime: "image/jpeg", taille: blob.size,
    });
    return error || null;
  };

  // Le bucket est privé : on demande un lien signé, valable une minute.
  const ouvrirJustificatif = async (j) => {
    const { data, error } = await supabase.storage.from("justificatifs").createSignedUrl(j.chemin, 60);
    if (error || !data?.signedUrl) return toast("Justificatif indisponible : " + (error?.message || "lien introuvable"), "error");
    window.open(data.signedUrl, "_blank", "noopener");
  };

  const startEdit = (e) => {
    setEditingDate(e.date);
    setForm(formDe(e));
    versFormulaire();
  };

  const cancelEdit = () => {
    setEditingDate(null);
    retirerCapture();
    setForm(emptyForm(vehicle?.chauffeur, todayISO()));
  };

  // Une saisie existe déjà à la date choisie : enregistrer l'écraserait.
  const existante = useMemo(
    () => (form?.date && form.date !== editingDate ? entries.find((e) => e.date === form.date) || null : null),
    [entries, form?.date, editingDate]
  );

  const onSave = async () => {
    if (!vehicleId || !form?.date) return;

    if (existante) {
      const ok = await confirmer({
        titre: `Une saisie existe déjà le ${fmtJour(form.date, { annee: true })}`,
        message: `Elle indique une recette de ${fmtF(existante.recette)} et un net de ${fmtF(existante.net)}.\nL'enregistrer maintenant la remplacera par ce que vous venez de saisir.`,
        confirmer: "Remplacer",
        danger: true,
      });
      if (!ok) return;
    }

    setSaving(true);
    const res = await saveEntry({ vehicleId, ...form });
    setSaving(false);
    if (res?.error) return toast("Enregistrement impossible : " + res.error, "error");

    // La capture suit la saisie. Si son stockage n'est pas encore installé,
    // le versement est enregistré quand même — et on le dit.
    let captureNonConservee = false;
    if (capture?.blob) {
      const erreur = await conserverCapture(vehicleId, form.date, capture.blob);
      captureNonConservee = Boolean(erreur);
      retirerCapture();
    }

    if (res?.avertissement) toast(res.avertissement, "warning");
    else if (captureNonConservee) toast("Versement enregistré, mais la capture n'a pas pu être conservée : exécutez migration_ia.sql dans Supabase.", "warning");
    else toast(editingDate || existante ? "Saisie mise à jour" : "Versement enregistré");

    const suivante = ajouterJours(form.date, 1);
    setEditingDate(null);
    await loadEntries(vehicleId, { silencieux: true });
    setForm(emptyForm(vehicle?.chauffeur, suivante > todayISO() ? todayISO() : suivante));
  };

  const onDelete = async (e) => {
    if (!vehicleId) return;
    const ok = await confirmer({
      titre: `Supprimer la saisie du ${fmtJour(e.date, { annee: true })} ?`,
      message: `Recette ${fmtF(e.recette)}, net versé ${fmtF(e.net)}.\nLa suppression est définitive, et les décomptes du mois seront recalculés.`,
      confirmer: "Supprimer",
      danger: true,
    });
    if (!ok) return;

    setSaving(true);
    const res = await deleteEntry(vehicleId, e.date);
    setSaving(false);
    if (res?.error) return toast("Suppression impossible : " + res.error, "error");
    toast("Saisie supprimée");
    setLigneOuverte(null);
    await loadEntries(vehicleId, { silencieux: true });
    if (editingDate === e.date) cancelEdit();
  };

  // Si les lignes chargées ne portent pas la clé, c'est que la colonne
  // n'existe pas encore en base : la migration n'a pas été exécutée. Mieux
  // vaut le dire que laisser croire que les remarques ne fonctionnent pas.
  const migrationsManquantes = useMemo(() => {
    if (!entries.length) return [];
    const manque = [];
    if (!("note" in entries[0])) manque.push("migration_note_saisie.sql");
    if (!("sans_chauffeur" in entries[0])) manque.push("migration_location.sql");
    return manque;
  }, [entries]);

  const moisDisponibles = useMemo(
    () => [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().reverse(),
    [entries]
  );

  // L'historique complet, filtré. La recherche porte sur le receveur et sur
  // les trois remarques : c'est là qu'on retrouve « la crevaison de juin ».
  const historique = useMemo(() => {
    const terme = recherche.trim().toLowerCase();
    return [...entries]
      .reverse()
      .filter((e) => !dateFiltre || e.date === dateFiltre)
      .filter((e) => dateFiltre || moisFiltre === "tous" || e.date.startsWith(moisFiltre))
      .filter((e) => {
        if (!terme) return true;
        return [e.receveur, e.note, e.gazoil_note, e.autres_note].some((c) => (c || "").toLowerCase().includes(terme));
      });
  }, [entries, moisFiltre, recherche, dateFiltre]);

  // Remettre le compteur à zéro quand le filtre change, sinon on garderait
  // « 90 affichées » sur une liste qui n'en compte plus que 12.
  useEffect(() => {
    setNbAffichees(30);
    setLigneOuverte(null);
  }, [moisFiltre, recherche, dateFiltre, vehicleId]);

  const filtreActif = Boolean(recherche || dateFiltre || moisFiltre !== "tous");

  const locDates = useMemo(() => plageDeJours(locDebut, locFin), [locDebut, locFin]);
  const locExisting = useMemo(
    () => locDates.filter((d) => entries.some((e) => e.date === d)),
    [locDates, entries]
  );

  const onSaveLocation = async () => {
    if (!vehicleId || locDates.length === 0 || !locMontant) return;
    setLocSaving(true);
    const res = await saveLocationRange({
      vehicleId,
      dateDebut: locDebut,
      dateFin: locFin,
      montant: locMontant,
      note: locNote,
      receveur: locReceveur || vehicle?.chauffeur || "",
      skipDates: locOverwrite ? [] : locExisting,
    });
    setLocSaving(false);
    if (res?.error) return toast("Enregistrement impossible : " + res.error, "error");

    const ignores = locOverwrite ? 0 : locExisting.length;
    if (res.avertissement) toast(res.avertissement, "warning");
    else toast(`${res.count} jour${res.count > 1 ? "s" : ""} de location enregistré${res.count > 1 ? "s" : ""}${ignores ? ` — ${ignores} déjà saisi${ignores > 1 ? "s" : ""}, laissé${ignores > 1 ? "s" : ""} tel${ignores > 1 ? "s" : ""} quel${ignores > 1 ? "s" : ""}` : ""}`);
    setLocDebut(""); setLocFin(""); setLocMontant(""); setLocReceveur(""); setLocNote("Location"); setLocOverwrite(false);
    setLocOpen(false);
    await loadEntries(vehicleId, { silencieux: true });
  };

  if (!vehicles.length) {
    return (
      <main className="page">
        <EnTete titre="Saisie des versements" />
        <div className="carte">
          <Vide icone={Bus} titre="Aucun véhicule enregistré">
            Ajoutez d&apos;abord un véhicule depuis l&apos;onglet « Véhicules ».
          </Vide>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <EnTete
        titre="Saisie des versements"
        description="Enregistrez la recette et les dépenses de la journée. Le net versé au propriétaire se calcule tout seul."
      />

      {migrationsManquantes.length > 0 && (
        <Bandeau couleur="var(--amber)" icone={AlertCircle} className="mb-5">
          <strong className="text-[var(--text-ink)]">Une migration n&apos;a pas encore été exécutée.</strong>{" "}
          Les remarques saisies ne sont pas conservées. Dans Supabase &gt; SQL Editor, exécutez{" "}
          {migrationsManquantes.map((m, i) => (
            <Fragment key={m}>{i > 0 && " puis "}<code className="rounded bg-[var(--bg-page)] px-1 py-0.5 text-[11px]">{m}</code></Fragment>
          ))}, puis rechargez cette page.
        </Bandeau>
      )}

      <SelecteurVehicule
        className="mb-5"
        vehicles={vehicles}
        value={vehicleId}
        onChange={(id) => { setVehicleId(id); setEditingDate(null); }}
      />

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,10fr)_minmax(0,11fr)]">
        {/* ------------------------------------------------ Formulaire */}
        <div className="flex min-w-0 flex-col gap-5">
          {form && (
            <section
              ref={formulaire}
              className="carte scroll-mt-20 p-4 sm:p-6"
              style={editingDate ? { borderColor: "color-mix(in srgb, var(--amber) 55%, var(--border-line))" } : undefined}
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
                  {editingDate ? <Pencil size={15} color={COLORS.amber} /> : <Plus size={16} color={COLORS.fleet} />}
                  {editingDate ? `Modifier la saisie du ${fmtJour(editingDate, { annee: true })}` : "Nouvelle saisie"}
                </h2>
                {editingDate ? (
                  <button onClick={cancelEdit} className="btn btn-discret btn-petit">
                    <X size={13} /> Annuler
                  </button>
                ) : (
                  <button
                    onClick={() => choixFichier.current?.click()}
                    disabled={capture?.etat === "lecture"}
                    className="btn btn-contour btn-petit"
                    style={{ color: COLORS.fleet }}
                  >
                    <ScanLine size={14} /> <span className="hidden sm:inline">Remplir depuis une capture</span><span className="sm:hidden">Capture</span>
                  </button>
                )}
                <input
                  ref={choixFichier}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; lireCapture(f); }}
                />
              </div>

              {/* Capture du chauffeur : l'image reste sous les yeux pendant la vérification. */}
              {capture && (
                <div className="animate-fondu mb-5 flex gap-3 rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface-alt)] p-3">
                  <button
                    type="button"
                    onClick={() => setAgrandie(true)}
                    aria-label="Agrandir la capture"
                    className="group relative h-24 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-[var(--border-line)] bg-[var(--bg-muted)]"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={capture.apercu} alt="Capture jointe" className="h-full w-full object-cover object-top" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                      <ZoomIn size={18} />
                    </span>
                  </button>
                  <div className="min-w-0 flex-1">
                    {capture.etat === "lecture" ? (
                      <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-ink)]">
                        <Loader2 size={15} className="animate-spin" color={COLORS.fleet} /> Lecture de la capture…
                      </div>
                    ) : capture.lecture?.lisible ? (
                      <>
                        <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--text-ink)]">
                          <Sparkles size={14} color={COLORS.fleet} /> Rempli depuis la capture
                        </div>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-slate)]">
                          Vérifiez chaque montant avec l&apos;image avant d&apos;enregistrer. La capture sera conservée avec la saisie.
                        </p>
                      </>
                    ) : (
                      <>
                        <div className="text-sm font-semibold text-[var(--text-ink)]">Capture jointe</div>
                        <p className="mt-0.5 text-xs leading-relaxed text-[var(--text-slate)]">
                          Remplissez les montants à la main. La capture sera conservée avec la saisie.
                        </p>
                      </>
                    )}

                    {capture.lecture?.incertitudes?.length > 0 && (
                      <ul className="mt-2 flex flex-col gap-1">
                        {capture.lecture.incertitudes.map((point, i) => (
                          <li key={i} className="flex items-start gap-1.5 text-xs leading-relaxed text-[var(--text-ink)]">
                            <TriangleAlert size={13} color={COLORS.amber} className="mt-0.5 shrink-0" /> {point}
                          </li>
                        ))}
                      </ul>
                    )}

                    <button type="button" onClick={retirerCapture} className="mt-2 text-xs font-semibold text-[var(--text-slate)] underline underline-offset-2 hover:text-[var(--red)]">
                      Retirer la capture
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Champ label="Date">
                  <input type="date" className="champ" value={form.date}
                    onChange={(e) => setForm({ ...form, date: e.target.value })} />
                </Champ>
                <Champ label="Receveur / chauffeur">
                  <input className="champ" value={form.receveur} autoComplete="off"
                    onChange={(e) => setForm({ ...form, receveur: e.target.value })} />
                </Champ>
              </div>

              {existante && (
                <Bandeau couleur="var(--amber)" icone={AlertCircle} className="mt-3">
                  <strong className="text-[var(--text-ink)]">Une saisie existe déjà à cette date</strong>{" "}
                  (recette {fmtF(existante.recette)}). Enregistrer la remplacera.{" "}
                  <button onClick={() => startEdit(existante)} className="font-semibold underline underline-offset-2" style={{ color: COLORS.fleet }}>
                    Ouvrir la saisie existante
                  </button>
                </Bandeau>
              )}

              <div className="mt-4">
                <Champ label="Recette totale (FCFA)">
                  <Montant className="py-3 text-lg font-semibold sm:text-base" placeholder="0" value={form.recette}
                    onChange={(e) => updateForm({ recette: e.target.value })} />
                </Champ>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Champ label="Gazoil (FCFA)">
                  <Montant placeholder="0" value={form.gazoil} onChange={(e) => updateForm({ gazoil: e.target.value })} />
                </Champ>
                <Champ label="Remarque gazoil">
                  <input className="champ" value={form.gazoilNote} onChange={(e) => setForm({ ...form, gazoilNote: e.target.value })} />
                </Champ>
                <Champ label="Autres dépenses (FCFA)">
                  <Montant placeholder="0" value={form.autres} onChange={(e) => updateForm({ autres: e.target.value })} />
                </Champ>
                <Champ label="Remarque autres dépenses">
                  <input className="champ" placeholder="Parking, lavage, péage…" value={form.autresNote}
                    onChange={(e) => setForm({ ...form, autresNote: e.target.value })} />
                </Champ>
              </div>

              {/* Résultat du calcul, modifiable si la caisse réelle diffère. */}
              <div className="mt-4 grid grid-cols-2 items-end gap-3 rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface-alt)] p-3 sm:gap-4 sm:p-4">
                <Champ label="Total caisse" aide="Recette − gazoil">
                  <Montant value={form.totalCaisse} onChange={(e) => setForm({ ...form, totalCaisse: e.target.value })} />
                </Champ>
                <Champ label="Net versé au propriétaire" aide="Total caisse − autres">
                  <Montant className="font-bold" style={{ color: COLORS.green }} value={form.net}
                    onChange={(e) => setForm({ ...form, net: e.target.value })} />
                </Champ>
              </div>

              <div className="mt-4">
                <Champ
                  label="Remarque sur la journée"
                  aide="Facultatif — panne, retard, client particulier, recette inhabituelle."
                >
                  <textarea
                    rows={2}
                    className="champ min-h-[64px]"
                    value={form.note}
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                    placeholder="Ex : crevaison à Yeumbeul, immobilisé 3 h"
                  />
                </Champ>
              </div>

              {/* Sur une location sans chauffeur, aucun salaire n'est dû : le
                  dossier investisseur s'appuie sur ce marqueur. */}
              <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--border-line)] px-3.5 py-3">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--fleet-bright)]"
                  checked={form.sansChauffeur === true}
                  onChange={(e) => setForm({ ...form, sansChauffeur: e.target.checked })}
                />
                <span className="text-xs leading-relaxed text-[var(--text-slate)]">
                  <strong className="text-[var(--text-ink)]">Location sans chauffeur</strong> — le client
                  conduit et paie son carburant. Aucun salaire de chauffeur n&apos;est compté ce jour-là.
                </span>
              </label>

              <button onClick={onSave} disabled={saving || !form.date} className="btn btn-succes mt-5 w-full py-3 sm:w-auto sm:py-2.5">
                {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                {editingDate ? "Mettre à jour" : "Enregistrer le versement"}
              </button>
            </section>
          )}

          {/* --------------------------------- Location sur plusieurs jours */}
          <section className="carte overflow-hidden">
            <button
              onClick={() => setLocOpen((o) => !o)}
              aria-expanded={locOpen}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-left hover:bg-[var(--bg-page)] sm:px-6"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}>
                <CalendarRange size={17} color={COLORS.fleet} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-[var(--text-ink)]">Location sur plusieurs jours</span>
                <span className="block text-xs text-[var(--text-slate-light)]">Même montant chaque jour d&apos;une période, sans chauffeur.</span>
              </span>
              <ChevronDown size={17} className="shrink-0 text-[var(--text-slate-light)]" style={{ transform: locOpen ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }} />
            </button>

            {locOpen && (
              <div className="border-t border-[var(--border-line)] p-4 sm:p-6">
                <div className="grid grid-cols-2 gap-3 sm:gap-4">
                  <Champ label="Du">
                    <input type="date" className="champ" value={locDebut} max={locFin || undefined} onChange={(e) => setLocDebut(e.target.value)} />
                  </Champ>
                  <Champ label="Au">
                    <input type="date" className="champ" value={locFin} min={locDebut || undefined} onChange={(e) => setLocFin(e.target.value)} />
                  </Champ>
                  <Champ label="Montant par jour (FCFA)">
                    <Montant value={locMontant} onChange={(e) => setLocMontant(e.target.value)} placeholder="15000" />
                  </Champ>
                  <Champ label="Locataire">
                    <input className="champ" value={locReceveur} onChange={(e) => setLocReceveur(e.target.value)} placeholder={vehicle?.chauffeur || ""} />
                  </Champ>
                  <Champ label="Remarque (reprise sur chaque jour)" className="col-span-2">
                    <input className="champ" value={locNote} onChange={(e) => setLocNote(e.target.value)} placeholder="Location" />
                  </Champ>
                </div>

                {locDates.length > 0 && (
                  <div className="mt-4 rounded-xl bg-[var(--bg-page)] px-4 py-3 text-sm text-[var(--text-slate)]">
                    <strong className="text-[var(--text-ink)]">{locDates.length} jour{locDates.length > 1 ? "s" : ""}</strong>{" "}
                    à {fmtF(locMontant || 0)} par jour
                    {locMontant ? <> — total <strong className="font-figures text-[var(--text-ink)]">{fmtF(locDates.length * (Number(locMontant) || 0))}</strong></> : ""}.
                    {locExisting.length > 0 && (
                      <label className="mt-2 flex cursor-pointer items-start gap-2 text-xs" style={{ color: COLORS.amber }}>
                        <input type="checkbox" className="mt-0.5 accent-[var(--amber)]" checked={locOverwrite} onChange={(e) => setLocOverwrite(e.target.checked)} />
                        <span>
                          {locExisting.length} jour{locExisting.length > 1 ? "s ont" : " a"} déjà une saisie sur cette période.
                          Cochez pour {locExisting.length > 1 ? "les" : "la"} remplacer ; sinon {locExisting.length > 1 ? "ils seront laissés tels quels" : "il sera laissé tel quel"}.
                        </span>
                      </label>
                    )}
                  </div>
                )}

                <button onClick={onSaveLocation} disabled={locSaving || locDates.length === 0 || !locMontant} className="btn btn-primaire mt-4 w-full sm:w-auto">
                  {locSaving ? <Loader2 size={15} className="animate-spin" /> : <Repeat size={15} />}
                  Enregistrer {locDates.length > 0 ? `${locDates.length} jour${locDates.length > 1 ? "s" : ""}` : "la location"}
                </button>
              </div>
            )}
          </section>
        </div>

        {/* ------------------------------------------------ Historique */}
        <section className="carte min-w-0 overflow-hidden">
          <div className="border-b border-[var(--border-line)] p-4 sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-[var(--text-ink)]">
                <ClipboardList size={16} color={COLORS.fleet} /> Historique des saisies
              </h2>
              <span className="text-xs text-[var(--text-slate-light)]">
                {historique.length} saisie{historique.length > 1 ? "s" : ""}
                {historique.length !== entries.length ? ` sur ${entries.length}` : ""}
              </span>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[auto_auto_minmax(0,1fr)]">
              <select aria-label="Mois" value={moisFiltre} disabled={Boolean(dateFiltre)} onChange={(e) => setMoisFiltre(e.target.value)} className="champ px-2.5 sm:px-3">
                <option value="tous">Tous les mois</option>
                {moisDisponibles.map((m) => <option key={m} value={m}>{majuscule(fmtPeriode(m))}</option>)}
              </select>
              <input type="date" aria-label="Aller à une date" title="Aller à une date" value={dateFiltre} onChange={(e) => setDateFiltre(e.target.value)} className="champ px-2.5 sm:px-3" />
              <div className="relative col-span-2 sm:col-span-1">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-slate-light)]" />
                <input
                  type="search"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Chercher dans les remarques…"
                  className="champ pl-9"
                />
              </div>
            </div>
            {filtreActif && (
              <button onClick={() => { setRecherche(""); setMoisFiltre("tous"); setDateFiltre(""); }} className="btn btn-discret btn-petit mt-2 -ml-1">
                <X size={13} /> Effacer les filtres
              </button>
            )}
          </div>

          {loading ? (
            <Chargement className="p-4 sm:p-5" lignes={8} />
          ) : historique.length === 0 ? (
            dateFiltre ? (
              <Vide icone={Search} titre={`Aucune saisie le ${fmtJour(dateFiltre, { annee: true })}`}>
                <button
                  onClick={() => {
                    setEditingDate(null);
                    setForm(emptyForm(vehicle?.chauffeur, dateFiltre));
                    setDateFiltre("");
                    versFormulaire();
                  }}
                  className="btn btn-primaire btn-petit mt-3"
                >
                  <Plus size={14} /> Créer la saisie de ce jour
                </button>
              </Vide>
            ) : (
              <Vide icone={ClipboardList} titre={entries.length === 0 ? "Aucune saisie pour ce véhicule" : "Aucune saisie ne correspond"}>
                {entries.length === 0 ? "La première saisie apparaîtra ici dès son enregistrement." : "Essayez un autre mois ou un autre mot."}
              </Vide>
            )
          ) : (
            <>
              <table className="tableau">
                <thead>
                  <tr>
                    <th className="w-8 !px-0" />
                    <th className="!pl-1">Date</th>
                    <th className="num">Recette</th>
                    <th className="num hidden sm:table-cell">Dépenses</th>
                    <th className="num">Net versé</th>
                  </tr>
                </thead>
                <tbody>
                  {historique.slice(0, nbAffichees).map((e) => {
                    const ouverte = ligneOuverte === e.date;
                    const repos = Number(e.recette) === 0;
                    return (
                      <Fragment key={e.date}>
                        <tr
                          onClick={() => setLigneOuverte(ouverte ? null : e.date)}
                          className="cursor-pointer hover:bg-[var(--bg-page)]"
                          style={{ color: repos ? "var(--text-slate-light)" : COLORS.ink, backgroundColor: ouverte ? "var(--bg-page)" : undefined }}
                        >
                          <td className="!px-0 !pl-3">
                            <ChevronRight size={15} className="text-[var(--text-slate-light)]" style={{ transform: ouverte ? "rotate(90deg)" : "none", transition: "transform 160ms ease" }} />
                          </td>
                          <td className="whitespace-nowrap !pl-1" title={e.date}>
                            <button
                              className="text-left"
                              aria-expanded={ouverte}
                              onClick={(ev) => { ev.stopPropagation(); setLigneOuverte(ouverte ? null : e.date); }}
                            >
                              {fmtJour(e.date)}
                            </button>
                            {e.sans_chauffeur && (
                              <span className="pastille ml-2 align-middle" style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)", color: COLORS.fleet }} title="Location sans chauffeur">
                                <KeyRound size={10} /> <span className="hidden sm:inline">Location</span>
                              </span>
                            )}
                            {e.note && <MessageSquareText size={12} className="ml-1.5 inline-block align-middle" color={COLORS.fleet} aria-label="Avec remarque" />}
                            {justificatifs[e.date] && <Paperclip size={12} className="ml-1.5 inline-block align-middle text-[var(--text-slate-light)]" aria-label="Avec justificatif" />}
                          </td>
                          <td className="num">{repos ? "—" : fmt(e.recette)}</td>
                          <td className="num hidden sm:table-cell">{repos ? "—" : fmt((Number(e.gazoil) || 0) + (Number(e.autres) || 0))}</td>
                          <td className="num font-semibold">{repos ? "Repos" : fmt(e.net)}</td>
                        </tr>

                        {ouverte && (
                          <tr style={{ backgroundColor: "var(--bg-page)" }}>
                            <td colSpan={5} className="!pb-4 !pt-0">
                              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                                <Detail label="Recette" valeur={fmtF(e.recette)} />
                                <Detail label="Gazoil" valeur={fmtF(e.gazoil)} legende={e.gazoil_note} />
                                <Detail label="Autres dépenses" valeur={fmtF(e.autres)} legende={e.autres_note} />
                                <Detail label="Total caisse" valeur={fmtF(e.total_caisse)} />
                                <Detail label="Net versé" valeur={fmtF(e.net)} accent={COLORS.green} />
                                <Detail label="Receveur" valeur={e.receveur || "—"} legende={e.sans_chauffeur ? "Location sans chauffeur" : null} />
                              </div>

                              {e.note && (
                                <Bandeau icone={MessageSquareText} className="mt-2 whitespace-pre-wrap bg-[var(--bg-surface)]">
                                  <div className="mb-0.5 font-semibold text-[var(--text-ink)]">Remarque sur la journée</div>
                                  {e.note}
                                </Bandeau>
                              )}

                              <div className="mt-3 flex flex-wrap gap-2">
                                {(justificatifs[e.date] || []).map((j, i, tous) => (
                                  <button key={j.id} onClick={() => ouvrirJustificatif(j)} className="btn btn-contour btn-petit" style={{ color: COLORS.fleet }}>
                                    <Paperclip size={13} /> Justificatif{tous.length > 1 ? ` ${i + 1}` : ""}
                                  </button>
                                ))}
                                <button onClick={() => startEdit(e)} className="btn btn-contour btn-petit">
                                  <Pencil size={13} /> Modifier
                                </button>
                                <button onClick={() => onDelete(e)} disabled={saving} className="btn btn-contour btn-petit" style={{ color: COLORS.red }}>
                                  <Trash2 size={13} /> Supprimer
                                </button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>

              {historique.length > nbAffichees && (
                <div className="border-t border-[var(--border-line)] p-3 text-center">
                  <button onClick={() => setNbAffichees((n) => n + 30)} className="btn btn-discret btn-petit" style={{ color: COLORS.fleet }}>
                    Afficher 30 de plus <span className="font-normal text-[var(--text-slate-light)]">({historique.length - nbAffichees} restantes)</span>
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </div>

      {/* Capture en grand, pour lire les petits chiffres */}
      {agrandie && capture && (
        <div
          className="animate-fondu fixed inset-0 z-[85] flex items-center justify-center bg-[#0A1626]/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Capture jointe"
          onClick={() => setAgrandie(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={capture.apercu} alt="Capture jointe" className="max-h-full max-w-full rounded-xl object-contain" style={{ boxShadow: "var(--shadow-pop)" }} />
          <button onClick={() => setAgrandie(false)} aria-label="Fermer" className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/25">
            <X size={20} />
          </button>
        </div>
      )}
    </main>
  );
}
