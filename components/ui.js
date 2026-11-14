"use client";

// Briques d'interface communes à toutes les pages : en-tête, messages,
// boîtes de confirmation, états vides. Les avoir à un seul endroit garantit
// que deux pages ne dérivent pas l'une de l'autre.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AlertCircle, Check, TriangleAlert, X, Loader2, Bus, ChevronDown, ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";

/* ------------------------------------------------------------------ */
/* En-tête de page                                                     */
/* ------------------------------------------------------------------ */

export function EnTete({ titre, description, actions, children }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
      <div className="min-w-0 max-w-2xl">
        <h1 className="font-display text-[1.5rem] font-bold leading-[1.15] text-[var(--text-ink)] sm:text-[1.7rem]">
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
    <label className={`flex min-w-0 flex-col gap-2 ${className}`}>
      <span className="etiquette">{label}</span>
      {children}
      {aide && <span className="-mt-0.5 text-xs leading-snug text-[var(--text-slate-light)]">{aide}</span>}
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
      <div className="relative flex h-11 min-w-0 max-w-full items-center rounded-[10px] border border-[var(--border-strong)] bg-[var(--bg-surface)] shadow-[0_1px_1px_rgba(15,27,45,0.04)] transition-colors focus-within:border-[var(--fleet-bright)] focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--fleet-bright)_20%,transparent)] hover:border-[color-mix(in_srgb,var(--fleet-bright)_45%,var(--border-strong))] sm:h-10">
        <span
          className="pointer-events-none ml-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] sm:h-7 sm:w-7"
          style={{ backgroundColor: "color-mix(in srgb, var(--fleet-bright) 12%, transparent)" }}
        >
          <Bus size={15} color="var(--fleet-bright)" />
        </span>
        <select
          aria-label="Véhicule"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="h-full min-w-0 max-w-[68vw] cursor-pointer appearance-none truncate bg-transparent pl-2.5 pr-9 text-base font-semibold text-[var(--text-ink)] focus:outline-none sm:max-w-xs sm:text-sm"
        >
          {extra}
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>{v.marque} — {v.immatriculation}</option>
          ))}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-3 text-[var(--text-slate-light)]" />
      </div>
      {courant && (courant.proprietaire || courant.chauffeur) && (
        <div className="min-w-0 truncate text-[13px] text-[var(--text-slate-light)]">
          {[courant.proprietaire, courant.chauffeur && `chauffeur ${courant.chauffeur}`].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Sélecteur à segments                                                */
/* ------------------------------------------------------------------ */

/**
 * <Segments label="Période" value={v} onChange={setV}
 *           options={[{ id: "mois", label: "Mois", compte: 3 }]} />
 */
export function Segments({ options, value, onChange, label, etire = false, className = "" }) {
  // `etire` : sur téléphone, les segments se partagent toute la largeur.
  return (
    <div className={`sans-barre max-w-full overflow-x-auto ${className}`}>
      <div className={`segments ${etire ? "flex w-full sm:inline-flex sm:w-auto" : ""}`} role="tablist" aria-label={label}>
        {options.map((o) => (
          <button key={o.id} type="button" role="tab" aria-selected={value === o.id} onClick={() => onChange(o.id)} className={`segment ${etire ? "flex-auto sm:flex-none" : ""}`}>
            {o.label}
            {o.compte != null && <span className="ml-1.5 font-normal text-[var(--text-slate-light)]">{o.compte}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* États : vide, chargement                                            */
/* ------------------------------------------------------------------ */

export function Vide({ icone: Icone, titre, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icone && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-[var(--border-line)] bg-[var(--bg-muted)]">
          <Icone size={20} className="text-[var(--text-slate-light)]" />
        </div>
      )}
      {titre && <div className="text-[15px] font-semibold text-[var(--text-ink)]">{titre}</div>}
      {children && <div className="mt-1.5 max-w-sm text-sm leading-relaxed text-[var(--text-slate)]">{children}</div>}
      {action && <div className="mt-5">{action}</div>}
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
  success: { couleur: "#12A372", Icone: Check, duree: 3200 },
  warning: { couleur: "#D08A1E", Icone: TriangleAlert, duree: 8000 },
  error: { couleur: "#DC4444", Icone: X, duree: 7000 },
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
              className="animate-pop pointer-events-auto flex max-w-md items-start gap-3 rounded-xl py-3 pl-3.5 pr-2 text-sm font-medium"
              style={{ backgroundColor: "#0F1B2D", color: "#F4F6F9", boxShadow: "var(--shadow-pop)", border: "1px solid rgba(255,255,255,0.08)" }}
            >
              <span className="mt-px flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: couleur }}>
                <Icone size={13} color="#fff" strokeWidth={2.6} />
              </span>
              <span className="min-w-0 break-words leading-snug">{t.msg}</span>
              <button onClick={() => fermer(t.id)} aria-label="Fermer" className="-my-0.5 shrink-0 rounded-md p-1 text-white/55 hover:bg-white/10 hover:text-white">
                <X size={15} />
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
          <div className="animate-fondu absolute inset-0 bg-[#0A1626]/50 backdrop-blur-[3px]" onClick={() => repondre(false)} />
          <form
            onSubmit={(e) => { e.preventDefault(); repondre(true); }}
            className="animate-pop relative w-full rounded-t-[22px] border border-[var(--border-line)] bg-[var(--bg-surface)] p-5 sm:max-w-md sm:rounded-2xl sm:p-6"
            style={{ boxShadow: "var(--shadow-pop)", paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom, 0px))" }}
          >
            <div className="mx-auto -mt-2 mb-4 h-1 w-10 rounded-full bg-[var(--border-strong)] sm:hidden" />
            <div className="flex items-start gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ backgroundColor: `color-mix(in srgb, ${demande.danger ? "var(--red)" : "var(--fleet-bright)"} 12%, transparent)` }}
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

/**
 * Tuile de chiffre clé. Le chiffre reste à l'encre : la couleur ne sert
 * qu'à la petite icône, pour distinguer les tuiles d'un coup d'œil.
 *
 * `tendance` : { pct, dir: "up" | "down" | "flat", bon: true | false | null }
 */
export function Indicateur({ icone: Icone, label, valeur, legende, couleur = "var(--fleet-bright)", tendance, children }) {
  return (
    <div className="carte flex min-w-0 flex-col p-4 sm:p-[1.125rem]">
      <div className="flex items-start justify-between gap-2">
        <span className="line-clamp-2 min-w-0 text-[13px] font-medium leading-snug text-[var(--text-slate)]">{label}</span>
        {Icone && (
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: `color-mix(in srgb, ${couleur} 12%, transparent)` }}
          >
            <Icone size={14} color={couleur} strokeWidth={2.2} />
          </span>
        )}
      </div>
      <div className="mt-2 text-[1.35rem] font-semibold leading-none tracking-[-0.02em] text-[var(--text-ink)] sm:text-[1.6rem]">{valeur}</div>
      {(tendance || legende) && (
        <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--text-slate-light)]">
          {tendance && <Tendance {...tendance} />}
          {legende && <span className="min-w-0 leading-snug">{legende}</span>}
        </div>
      )}
      {children && <div className="hidden sm:block">{children}</div>}
    </div>
  );
}

/** Variation par rapport à la période précédente : flèche, pourcentage, couleur selon que c'est bon ou non. */
export function Tendance({ pct, dir, bon }) {
  const couleur = bon === true ? "var(--green)" : bon === false ? "var(--red)" : "var(--text-slate)";
  const Icone = dir === "up" ? ArrowUpRight : dir === "down" ? ArrowDownRight : Minus;
  const texte = `${pct > 0 && dir !== "flat" ? "+" : ""}${pct.toFixed(1).replace(".", ",").replace("-", "−")} %`;
  return (
    <span
      className="inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11.5px] font-semibold"
      style={{ color: couleur, backgroundColor: `color-mix(in srgb, ${couleur} 11%, transparent)` }}
    >
      <Icone size={12} strokeWidth={2.4} />
      {texte}
    </span>
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
      className={`flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed text-[var(--text-slate)] ${className}`}
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
