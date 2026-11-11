"use client";

// Briques d'interface communes à toutes les pages : en-tête, messages,
// boîtes de confirmation, états vides. Les avoir à un seul endroit garantit
// que deux pages ne dérivent pas l'une de l'autre.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, TriangleAlert, X, Loader2, Bus, ChevronDown } from "lucide-react";

/* ------------------------------------------------------------------ */
/* En-tête de page                                                     */
/* ------------------------------------------------------------------ */

export function EnTete({ titre, description, actions, children }) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-x-6 gap-y-3 sm:mb-6">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-[1.4rem] font-bold leading-tight tracking-tight text-[var(--text-ink)] sm:text-2xl">
          {titre}
        </h1>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-slate)]">{description}</p>
        )}
        {children}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ------------------------------------------------------------------ */
/* Champ de formulaire                                                 */
/* ------------------------------------------------------------------ */

export function Champ({ label, aide, children, className = "" }) {
  return (
    <label className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <span className="etiquette">{label}</span>
      {children}
      {aide && <span className="text-[11px] leading-snug text-[var(--text-slate-light)]">{aide}</span>}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur de véhicule                                               */
/* ------------------------------------------------------------------ */

export function SelecteurVehicule({ vehicles, value, onChange, extra, className = "" }) {
  const courant = vehicles.find((v) => v.id === value);
  return (
    <div className={`flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      <div className="relative flex min-w-0 max-w-full items-center gap-2.5 rounded-xl border border-[var(--border-line)] bg-[var(--bg-surface)] py-1.5 pl-2 pr-2 shadow-sm">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
          style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 14%, transparent)" }}
        >
          <Bus size={15} color="var(--fleet-bright)" />
        </div>
        <select
          aria-label="Véhicule"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="min-w-0 max-w-[62vw] cursor-pointer appearance-none truncate bg-transparent py-1 pr-7 text-base font-semibold text-[var(--text-ink)] focus:outline-none sm:max-w-xs sm:text-sm"
        >
          {extra}
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-3 text-[var(--text-slate-light)]" />
      </div>
      {courant && (courant.proprietaire || courant.chauffeur) && (
        <div className="min-w-0 truncate text-xs text-[var(--text-slate-light)]">
          {[courant.proprietaire, courant.chauffeur && `chauffeur ${courant.chauffeur}`].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* États : vide, chargement                                            */
/* ------------------------------------------------------------------ */

export function Vide({ icone: Icone, titre, children }) {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center">
      {Icone && (
        <div
          className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl"
          style={{ backgroundColor: "color-mix(in srgb, var(--text-slate) 10%, transparent)" }}
        >
          <Icone size={20} className="text-[var(--text-slate-light)]" />
        </div>
      )}
      {titre && <div className="text-sm font-semibold text-[var(--text-ink)]">{titre}</div>}
      {children && <div className="mt-1 max-w-sm text-sm leading-relaxed text-[var(--text-slate-light)]">{children}</div>}
    </div>
  );
}

export function Chargement({ lignes = 4, className = "" }) {
  return (
    <div className={`flex flex-col gap-2.5 ${className}`} aria-busy="true" aria-label="Chargement">
      {Array.from({ length: lignes }).map((_, i) => (
        <div key={i} className="squelette h-10" style={{ width: `${100 - (i % 3) * 8}%` }} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Messages (toasts)                                                   */
/* ------------------------------------------------------------------ */

const ToastContexte = createContext(() => {});

const TOAST_STYLE = {
  success: { couleur: "var(--green)", Icone: CheckCircle2, duree: 3000 },
  warning: { couleur: "var(--amber)", Icone: TriangleAlert, duree: 8000 },
  error: { couleur: "var(--red)", Icone: AlertCircle, duree: 7000 },
};

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const compteur = useRef(0);

  const fermer = useCallback((id) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const montrer = useCallback((msg, type = "success") => {
    const id = ++compteur.current;
    const style = TOAST_STYLE[type] || TOAST_STYLE.success;
    // Un seul message à la fois : le dernier remplace le précédent.
    setToasts([{ id, msg: String(msg), type }]);
    setTimeout(() => fermer(id), style.duree);
  }, [fermer]);

  return (
    <ToastContexte.Provider value={montrer}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 z-[70] flex flex-col items-center gap-2 px-4"
        style={{ bottom: "calc(var(--barre-basse) + env(safe-area-inset-bottom, 0px) + 1rem)" }}
        aria-live="polite"
      >
        {toasts.map((t) => {
          const { couleur, Icone } = TOAST_STYLE[t.type] || TOAST_STYLE.success;
          return (
            <div
              key={t.id}
              role={t.type === "error" ? "alert" : "status"}
              className="animate-pop pointer-events-auto flex max-w-md items-start gap-2.5 rounded-xl py-2.5 pl-3.5 pr-2 text-sm font-medium text-white"
              style={{ backgroundColor: couleur, boxShadow: "var(--shadow-pop)" }}
            >
              <Icone size={17} className="mt-0.5 shrink-0" />
              <span className="min-w-0 break-words leading-snug">{t.msg}</span>
              <button onClick={() => fermer(t.id)} aria-label="Fermer" className="shrink-0 rounded-md p-1 text-white/80 hover:bg-white/15 hover:text-white">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContexte.Provider>
  );
}

/** const toast = useToast(); toast("Enregistré"); toast("Erreur…", "error"); */
export const useToast = () => useContext(ToastContexte);

/* ------------------------------------------------------------------ */
/* Boîte de confirmation                                               */
/* ------------------------------------------------------------------ */

const ConfirmContexte = createContext(async () => false);

/**
 * Remplace confirm() et prompt() du navigateur.
 *
 *   const confirmer = useConfirm();
 *   if (!(await confirmer({ titre, message, danger: true }))) return;
 *
 * Avec `saisie`, la promesse rend le texte tapé (éventuellement vide), ou
 * null si la personne annule.
 */
export function ConfirmProvider({ children }) {
  const [demande, setDemande] = useState(null);
  const [texte, setTexte] = useState("");
  const resoudre = useRef(null);

  const confirmer = useCallback((options) => {
    setTexte(options?.saisie?.valeur || "");
    setDemande(options || {});
    return new Promise((ok) => { resoudre.current = ok; });
  }, []);

  const repondre = useCallback((accepte) => {
    const avecSaisie = Boolean(demande?.saisie);
    resoudre.current?.(avecSaisie ? (accepte ? texte : null) : accepte);
    resoudre.current = null;
    setDemande(null);
  }, [demande, texte]);

  useEffect(() => {
    if (!demande) return;
    const touche = (e) => { if (e.key === "Escape") repondre(false); };
    window.addEventListener("keydown", touche);
    // La page derrière ne doit pas défiler pendant que la boîte est ouverte.
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", touche);
      document.body.style.overflow = avant;
    };
  }, [demande, repondre]);

  return (
    <ConfirmContexte.Provider value={confirmer}>
      {children}
      {demande && (
        <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-4" role="dialog" aria-modal="true" aria-labelledby="confirm-titre">
          <div className="animate-fondu absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={() => repondre(false)} />
          <form
            onSubmit={(e) => { e.preventDefault(); repondre(true); }}
            className="animate-pop relative w-full rounded-t-3xl border border-[var(--border-line)] bg-[var(--bg-surface)] p-5 sm:max-w-md sm:rounded-2xl sm:p-6"
            style={{ boxShadow: "var(--shadow-pop)", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `color-mix(in srgb, ${demande.danger ? "var(--red)" : "var(--fleet-bright)"} 14%, transparent)` }}
              >
                {demande.danger
                  ? <TriangleAlert size={19} color="var(--red)" />
                  : <AlertCircle size={19} color="var(--fleet-bright)" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 id="confirm-titre" className="text-base font-semibold leading-snug text-[var(--text-ink)]">
                  {demande.titre || "Confirmer"}
                </h2>
                {demande.message && (
                  <div className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-[var(--text-slate)]">
                    {demande.message}
                  </div>
                )}
              </div>
            </div>

            {demande.saisie && (
              <label className="mt-4 flex flex-col gap-1.5">
                <span className="etiquette">{demande.saisie.label}</span>
                <input
                  autoFocus
                  className="champ"
                  value={texte}
                  onChange={(e) => setTexte(e.target.value)}
                  placeholder={demande.saisie.placeholder || ""}
                />
              </label>
            )}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => repondre(false)} className="btn btn-contour">
                {demande.annuler || "Annuler"}
              </button>
              <button type="submit" autoFocus={!demande.saisie} className={`btn ${demande.danger ? "btn-danger" : "btn-primaire"}`}>
                {demande.confirmer || "Confirmer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </ConfirmContexte.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContexte);

/* ------------------------------------------------------------------ */
/* Indicateur chiffré                                                  */
/* ------------------------------------------------------------------ */

export function Indicateur({ icone: Icone, label, valeur, legende, couleur = "var(--fleet-bright)" }) {
  return (
    <div className="carte relative min-w-0 overflow-hidden p-4">
      <span className="absolute inset-y-0 left-0 w-1" style={{ backgroundColor: couleur }} />
      <div className="flex items-center gap-1.5 text-xs text-[var(--text-slate)]">
        {Icone && <Icone size={13} color={couleur} className="shrink-0" />}
        <span className="truncate">{label}</span>
      </div>
      <div className="font-figures mt-1.5 text-lg font-bold tracking-tight text-[var(--text-ink)] sm:text-xl">{valeur}</div>
      {legende && <div className="mt-0.5 text-[11px] leading-snug text-[var(--text-slate-light)]">{legende}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Divers                                                              */
/* ------------------------------------------------------------------ */

export function Tourniquet({ size = 15 }) {
  return <Loader2 size={size} className="animate-spin" />;
}

/** Bandeau d'information ou d'alerte dans le corps d'une page. */
export function Bandeau({ couleur = "var(--fleet-bright)", icone: Icone = AlertCircle, children, className = "" }) {
  return (
    <div
      className={`flex items-start gap-2.5 rounded-xl border px-4 py-3 text-xs leading-relaxed text-[var(--text-slate)] ${className}`}
      style={{
        borderColor: `color-mix(in srgb, ${couleur} 32%, transparent)`,
        backgroundColor: `color-mix(in srgb, ${couleur} 7%, transparent)`,
      }}
    >
      <Icone size={15} color={couleur} className="mt-0.5 shrink-0" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
