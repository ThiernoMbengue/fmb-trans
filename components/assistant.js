"use client";

// L'assistant : une conversation à côté de la page. Il lit les données avec
// le compte de la personne connectée, et ne modifie jamais rien.

import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, X, ArrowUp, Square, SquarePen, FileDown, Loader2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { genererDocument, DocumentVide, TYPES_DOCUMENT } from "@/lib/documents";
import { fmtDateLongue, fmtPeriode } from "@/lib/format";
import { useToast } from "@/components/ui";
import TexteRiche from "@/components/texte-riche";

const SUGGESTIONS = {
  admin: [
    "Combien reste-t-il à payer à chaque propriétaire ?",
    "Quel véhicule a le mieux marché ce mois-ci ?",
    "Compare ce mois-ci au mois dernier",
    "Qu'est-ce qui arrive à échéance bientôt ?",
  ],
  proprietaire: [
    "Combien me reste-t-il à recevoir ?",
    "Fais-moi le résumé de ce mois",
    "Quelles avances sont encore en cours ?",
    "Donne-moi le relevé de versements du mois dernier",
  ],
};

let compteur = 0;
const nouvelId = () => `m${Date.now()}-${++compteur}`;

function libelleDocument(d) {
  const quoi = TYPES_DOCUMENT[d.type] || "Document";
  const quand = d.type === "recu_paiement"
    ? fmtPeriode(d.periode)
    : `du ${fmtDateLongue(d.dateDebut)} au ${fmtDateLongue(d.dateFin)}`;
  return { quoi, detail: `${d.vehicule} · ${quand}` };
}

function BoutonDocument({ document }) {
  const toast = useToast();
  const [enCours, setEnCours] = useState(false);
  const { quoi, detail } = libelleDocument(document);

  const telecharger = async () => {
    setEnCours(true);
    try {
      // La fiche complète du véhicule : le document en reprend le propriétaire,
      // le chauffeur et le taux journalier.
      const { data: vehicle, error } = await createClient().from("vehicles").select("*").eq("id", document.vehicleId).maybeSingle();
      if (error || !vehicle) throw new Error("Véhicule introuvable.");
      await genererDocument({ ...document, vehicle });
      toast("Document généré");
    } catch (e) {
      if (e instanceof DocumentVide) toast(e.message, "warning");
      else toast("La génération a échoué : " + (e?.message || "erreur inconnue"), "error");
    } finally {
      setEnCours(false);
    }
  };

  return (
    <button
      onClick={telecharger}
      disabled={enCours}
      className="flex w-full items-center gap-3 rounded-xl border border-[var(--border-strong)] bg-[var(--bg-surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 12%, transparent)", color: "var(--fleet-bright)" }}>
        {enCours ? <Loader2 size={17} className="animate-spin" /> : <FileDown size={17} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-[var(--text-ink)]">{quoi} (PDF)</span>
        <span className="block truncate text-xs text-[var(--text-slate-light)]">{detail}</span>
      </span>
    </button>
  );
}

function Attente({ libelle }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-[var(--text-slate-light)]" role="status">
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <span key={i} className="h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--text-slate-light)]" style={{ animationDelay: `${i * 160}ms` }} />
        ))}
      </span>
      {libelle || "Réflexion…"}
    </div>
  );
}

export default function Assistant({ ouvert, onFermer, role }) {
  const [messages, setMessages] = useState([]);
  const [saisie, setSaisie] = useState("");
  const [enCours, setEnCours] = useState(false);
  const [activite, setActivite] = useState("");
  const arret = useRef(null);
  const zone = useRef(null);
  const champ = useRef(null);
  const colleEnBas = useRef(true);

  // Échap ferme ; sur téléphone la page derrière ne défile pas.
  useEffect(() => {
    if (!ouvert) return;
    const touche = (e) => { if (e.key === "Escape") onFermer(); };
    window.addEventListener("keydown", touche);
    const petit = window.matchMedia("(max-width: 767.98px)").matches;
    const avant = document.body.style.overflow;
    if (petit) document.body.style.overflow = "hidden";
    const t = setTimeout(() => champ.current?.focus({ preventScroll: true }), 120);
    return () => {
      window.removeEventListener("keydown", touche);
      document.body.style.overflow = avant;
      clearTimeout(t);
    };
  }, [ouvert, onFermer]);

  // La conversation suit la réponse qui s'écrit, sauf si la personne est
  // remontée lire plus haut.
  useEffect(() => {
    const el = zone.current;
    if (el && colleEnBas.current) el.scrollTop = el.scrollHeight;
  }, [messages, activite]);

  const surDefilement = () => {
    const el = zone.current;
    if (el) colleEnBas.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  };

  const modifier = (id, changement) =>
    setMessages((liste) => liste.map((m) => (m.id === id ? { ...m, ...changement(m) } : m)));

  const envoyer = useCallback(async (texte) => {
    const question = String(texte || "").trim();
    if (!question || enCours) return;

    const idReponse = nouvelId();
    // Seuls les échanges aboutis sont renvoyés comme historique.
    const historique = [...messages.filter((m) => m.texte && !m.erreur), { role: "user", texte: question }]
      .map((m) => ({ role: m.role, content: m.texte }));

    setMessages((liste) => [
      ...liste,
      { id: nouvelId(), role: "user", texte: question },
      { id: idReponse, role: "assistant", texte: "", documents: [], enCours: true },
    ]);
    setSaisie("");
    setEnCours(true);
    setActivite("");
    colleEnBas.current = true;

    const controle = new AbortController();
    arret.current = controle;
    const echec = (message) => modifier(idReponse, (m) => ({ erreur: message, enCours: false, texte: m.texte }));

    try {
      const reponse = await fetch("/api/ia/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historique }),
        signal: controle.signal,
      });

      if (!reponse.ok || !reponse.body) {
        const corps = await reponse.json().catch(() => ({}));
        echec(corps.error || "L'assistant est indisponible pour le moment. Réessayez dans un instant.");
        return;
      }

      const lecteur = reponse.body.getReader();
      const decodeur = new TextDecoder();
      let tampon = "";

      const traiter = (ligne) => {
        if (!ligne.trim()) return;
        let e;
        try { e = JSON.parse(ligne); } catch { return; }
        if (e.t === "texte") {
          setActivite("");
          modifier(idReponse, (m) => ({ texte: m.texte + e.v }));
        } else if (e.t === "outil") {
          setActivite(e.libelle);
        } else if (e.t === "documents") {
          modifier(idReponse, () => ({ documents: e.liste || [] }));
        } else if (e.t === "erreur") {
          modifier(idReponse, () => ({ erreur: e.message }));
        }
      };

      for (;;) {
        const { done, value } = await lecteur.read();
        if (done) break;
        tampon += decodeur.decode(value, { stream: true });
        const lignes = tampon.split("\n");
        tampon = lignes.pop() || "";
        lignes.forEach(traiter);
      }
      traiter(tampon);
      modifier(idReponse, (m) => ({
        enCours: false,
        // Une réponse vide sans erreur ne doit pas rester une bulle blanche.
        erreur: m.erreur || (!m.texte && !m.documents?.length ? "Aucune réponse reçue. Réessayez." : undefined),
      }));
    } catch (e) {
      if (controle.signal.aborted) modifier(idReponse, () => ({ enCours: false, arrete: true }));
      else echec("La connexion a été interrompue. Vérifiez votre réseau et réessayez.");
    } finally {
      setEnCours(false);
      setActivite("");
      arret.current = null;
    }
  }, [messages, enCours]);

  const stopper = () => arret.current?.abort();

  const recommencer = () => {
    stopper();
    setMessages([]);
    setSaisie("");
    champ.current?.focus();
  };

  if (!ouvert) return null;

  const suggestions = SUGGESTIONS[role] || SUGGESTIONS.proprietaire;

  return (
    <aside
      role="dialog"
      aria-label="Assistant"
      className="animate-fondu fixed inset-0 z-[60] flex flex-col bg-[var(--bg-surface)] md:inset-y-0 md:left-auto md:right-0 md:w-[27rem] md:max-w-[92vw] md:border-l md:border-[var(--border-line)]"
      style={{ boxShadow: "var(--shadow-pop)", paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-[var(--border-line)] px-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ background: "linear-gradient(135deg, #2767B4, #17426D)" }}>
          <Sparkles size={16} />
        </span>
        <div className="min-w-0 flex-1 leading-tight">
          <h2 className="truncate text-[15px] font-semibold text-[var(--text-ink)]">Assistant</h2>
          <p className="truncate text-xs text-[var(--text-slate-light)]">Répond à partir de vos données</p>
        </div>
        {messages.length > 0 && (
          <button onClick={recommencer} aria-label="Nouvelle conversation" title="Nouvelle conversation" className="btn-icone nu">
            <SquarePen size={17} />
          </button>
        )}
        <button onClick={onFermer} aria-label="Fermer l'assistant" title="Fermer" className="btn-icone nu">
          <X size={19} />
        </button>
      </header>

      <div ref={zone} onScroll={surDefilement} className="defilement-fin flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col justify-end gap-5 pb-2">
            <div>
              <div className="text-base font-semibold text-[var(--text-ink)]">Posez votre question</div>
              <p className="mt-1 text-sm leading-relaxed text-[var(--text-slate)]">
                Chiffres d&apos;une période, solde d&apos;un véhicule, avances, relevé en PDF, explication d&apos;un
                décompte… L&apos;assistant lit vos données mais ne modifie jamais rien.
              </p>
            </div>
            <div className="flex flex-col gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => envoyer(s)}
                  className="rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface-alt)] px-3.5 py-2.5 text-left text-sm text-[var(--text-ink)] transition-colors hover:border-[var(--border-strong)] hover:bg-[var(--bg-muted)]"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="ml-8 self-end whitespace-pre-wrap break-words rounded-2xl rounded-br-md px-3.5 py-2.5 text-sm leading-relaxed text-white" style={{ backgroundColor: "#17426D" }}>
                  {m.texte}
                </div>
              ) : (
                <div key={m.id} className="mr-2 flex min-w-0 flex-col gap-2.5">
                  {m.texte && <TexteRiche texte={m.texte} />}
                  {m.enCours && (!m.texte || activite) && <Attente libelle={activite} />}
                  {m.documents?.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {m.documents.map((d, i) => <BoutonDocument key={i} document={d} />)}
                    </div>
                  )}
                  {m.arrete && <div className="text-xs text-[var(--text-slate-light)]">Réponse interrompue.</div>}
                  {m.erreur && (
                    <div
                      role="alert"
                      className="flex items-start gap-2 rounded-xl border px-3 py-2.5 text-[13px] leading-relaxed"
                      style={{
                        color: "var(--text-ink)",
                        borderColor: "color-mix(in srgb, var(--red) 32%, transparent)",
                        backgroundColor: "color-mix(in srgb, var(--red) 7%, transparent)",
                      }}
                    >
                      <AlertCircle size={15} color="var(--red)" className="mt-0.5 shrink-0" />
                      <span className="min-w-0">{m.erreur}</span>
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => { e.preventDefault(); envoyer(saisie); }}
        className="shrink-0 border-t border-[var(--border-line)] px-3 pt-3"
        style={{ paddingBottom: "calc(0.6rem + env(safe-area-inset-bottom, 0px))" }}
      >
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-surface)] py-1.5 pl-3.5 pr-1.5 transition-shadow focus-within:border-[var(--fleet-bright)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--fleet-bright)_20%,transparent)]">
          <textarea
            ref={champ}
            rows={1}
            value={saisie}
            maxLength={4000}
            onChange={(e) => {
              setSaisie(e.target.value);
              // Le champ grandit avec le texte, jusqu'à quelques lignes.
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 140) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                envoyer(saisie);
                e.currentTarget.style.height = "auto";
              }
            }}
            placeholder="Votre question…"
            aria-label="Votre question"
            className="max-h-[140px] min-h-[2.25rem] flex-1 resize-none bg-transparent py-1.5 text-base leading-snug text-[var(--text-ink)] placeholder:text-[var(--text-slate-light)] focus:outline-none sm:text-sm"
          />
          {enCours ? (
            <button type="button" onClick={stopper} aria-label="Arrêter la réponse" title="Arrêter" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--text-ink)] text-[var(--bg-surface)]">
              <Square size={13} fill="currentColor" />
            </button>
          ) : (
            <button type="submit" disabled={!saisie.trim()} aria-label="Envoyer" title="Envoyer" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-white transition-opacity disabled:opacity-35" style={{ backgroundColor: "#17426D" }}>
              <ArrowUp size={18} strokeWidth={2.4} />
            </button>
          )}
        </div>
        <p className="mt-1.5 px-1 text-center text-[11px] text-[var(--text-slate-light)]">
          L&apos;assistant peut se tromper : vérifiez les chiffres importants dans les pages du site.
        </p>
      </form>
    </aside>
  );
}
