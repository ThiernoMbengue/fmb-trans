"use client";

// Recherche rapide (Ctrl+K) : aller à une page, lancer une action, changer de
// véhicule — sans quitter le clavier, ou d'un seul geste sur téléphone.

import { useEffect, useMemo, useRef, useState } from "react";
import { Search, CornerDownLeft } from "lucide-react";

// « Véhicules » doit se trouver en tapant « vehicule » : on compare sans
// accents ni majuscules.
const normaliser = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

// La fenêtre n'existe que lorsqu'elle est ouverte : chaque ouverture repart
// d'un champ vide, sans reste de la recherche précédente.
export default function Palette({ ouvert, onFermer, elements }) {
  return ouvert ? <Fenetre onFermer={onFermer} elements={elements} /> : null;
}

function Fenetre({ onFermer, elements }) {
  const [texte, setTexte] = useState("");
  const [actif, setActif] = useState(0);
  const liste = useRef(null);

  // La page derrière ne défile pas tant que la recherche est ouverte.
  useEffect(() => {
    const avant = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = avant; };
  }, []);

  const resultats = useMemo(() => {
    const mots = normaliser(texte).split(/\s+/).filter(Boolean);
    if (!mots.length) return elements;
    return elements.filter((e) => {
      const cible = normaliser(`${e.label} ${e.detail || ""} ${e.groupe} ${e.motsCles || ""}`);
      return mots.every((m) => cible.includes(m));
    });
  }, [texte, elements]);


  // L'élément sélectionné au clavier reste visible dans la liste.
  useEffect(() => {
    liste.current?.querySelector('[data-actif="true"]')?.scrollIntoView({ block: "nearest" });
  }, [actif]);

  const lancer = (e) => {
    if (!e) return;
    onFermer();
    e.action();
  };

  const auClavier = (ev) => {
    if (ev.key === "ArrowDown") { ev.preventDefault(); setActif((i) => Math.min(resultats.length - 1, i + 1)); }
    else if (ev.key === "ArrowUp") { ev.preventDefault(); setActif((i) => Math.max(0, i - 1)); }
    else if (ev.key === "Enter") { ev.preventDefault(); lancer(resultats[actif]); }
    else if (ev.key === "Escape") { ev.preventDefault(); onFermer(); }
  };

  let groupePrecedent = null;

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center sm:px-4 sm:pt-[12vh]" role="dialog" aria-modal="true" aria-label="Recherche rapide">
      <div className="animate-fondu absolute inset-0 bg-[#0A1626]/50 backdrop-blur-[3px]" onClick={onFermer} />
      <div
        className="animate-pop relative flex max-h-[100dvh] w-full flex-col overflow-hidden border-[var(--border-line)] bg-[var(--bg-surface)] sm:max-h-[70vh] sm:max-w-xl sm:rounded-2xl sm:border"
        style={{ boxShadow: "var(--shadow-pop)", paddingTop: "env(safe-area-inset-top, 0px)" }}
      >
        <div className="flex items-center gap-3 border-b border-[var(--border-line)] px-4">
          <Search size={18} className="shrink-0 text-[var(--text-slate-light)]" />
          <input
            autoFocus
            value={texte}
            onChange={(e) => { setTexte(e.target.value); setActif(0); }}
            onKeyDown={auClavier}
            placeholder="Rechercher une page, une action, un véhicule…"
            aria-label="Rechercher"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-liste"
            className="h-14 min-w-0 flex-1 bg-transparent text-base text-[var(--text-ink)] placeholder:text-[var(--text-slate-light)] focus:outline-none"
          />
          <button onClick={onFermer} className="touche shrink-0 px-2" aria-label="Fermer la recherche">Échap</button>
        </div>

        <div ref={liste} id="palette-liste" role="listbox" className="defilement-fin flex-1 overflow-y-auto p-2">
          {resultats.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--text-slate-light)]">
              Aucun résultat pour « {texte} ».
            </div>
          ) : (
            resultats.map((e, i) => {
              const Icone = e.icone;
              const estActif = i === actif;
              const titre = e.groupe !== groupePrecedent ? e.groupe : null;
              groupePrecedent = e.groupe;
              return (
                <div key={e.id}>
                  {titre && <div className="sur-titre px-3 pb-1.5 pt-3">{titre}</div>}
                  <button
                    role="option"
                    aria-selected={estActif}
                    data-actif={estActif}
                    onMouseMove={() => setActif(i)}
                    onClick={() => lancer(e)}
                    className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left"
                    style={{ backgroundColor: estActif ? "var(--bg-muted)" : "transparent" }}
                  >
                    <span
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[var(--border-line)] bg-[var(--bg-surface)]"
                      style={{ color: estActif ? "var(--fleet-bright)" : "var(--text-slate)" }}
                    >
                      {Icone && <Icone size={16} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-[var(--text-ink)]">{e.label}</span>
                      {e.detail && <span className="block truncate text-xs text-[var(--text-slate-light)]">{e.detail}</span>}
                    </span>
                    {estActif && <CornerDownLeft size={15} className="hidden shrink-0 text-[var(--text-slate-light)] sm:block" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden items-center gap-4 border-t border-[var(--border-line)] bg-[var(--bg-surface-alt)] px-4 py-2.5 text-xs text-[var(--text-slate-light)] sm:flex">
          <span className="flex items-center gap-1.5"><span className="touche">↑</span><span className="touche">↓</span> naviguer</span>
          <span className="flex items-center gap-1.5"><span className="touche">↵</span> ouvrir</span>
          <span className="ml-auto flex items-center gap-1.5"><span className="touche px-2">Ctrl</span><span className="touche">K</span> à tout moment</span>
        </div>
      </div>
    </div>
  );
}
