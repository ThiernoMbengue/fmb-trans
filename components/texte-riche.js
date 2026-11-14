// Mise en forme légère des réponses de l'assistant : gras, listes, petits
// tableaux. Le texte est découpé puis rendu en éléments React — jamais
// injecté comme HTML, donc rien de ce qu'écrit le modèle ne peut s'exécuter.

import { Fragment } from "react";

const DECOUPE = /(\*\*[^*\n]+\*\*|`[^`\n]+`|\*[^*\n]+\*)/g;

function enLigne(texte, cle) {
  return String(texte).split(DECOUPE).map((morceau, i) => {
    if (!morceau) return null;
    const k = `${cle}-${i}`;
    if (morceau.startsWith("**") && morceau.endsWith("**") && morceau.length > 4) {
      return <strong key={k} className="font-semibold text-[var(--text-ink)]">{morceau.slice(2, -2)}</strong>;
    }
    if (morceau.startsWith("`") && morceau.endsWith("`") && morceau.length > 2) {
      return <code key={k}>{morceau.slice(1, -1)}</code>;
    }
    if (morceau.startsWith("*") && morceau.endsWith("*") && morceau.length > 2) {
      return <em key={k}>{morceau.slice(1, -1)}</em>;
    }
    return <Fragment key={k}>{morceau}</Fragment>;
  });
}

const cellules = (ligne) => ligne.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
const estSeparateur = (ligne) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(ligne);
const estNombre = (texte) => /^[−\-+]?\s*[\d\s  .,]+\s*(F|FCFA|%|j)?$/.test(texte) && /\d/.test(texte);

/** Regroupe les lignes en blocs : paragraphe, liste, tableau, titre, trait. */
function blocs(texte) {
  const lignes = String(texte || "").replace(/\r/g, "").split("\n");
  const sortie = [];
  let i = 0;

  while (i < lignes.length) {
    const ligne = lignes[i];

    if (!ligne.trim()) { i++; continue; }

    if (/^\s*(-{3,}|\*{3,})\s*$/.test(ligne)) { sortie.push({ type: "trait" }); i++; continue; }

    const titre = ligne.match(/^\s*#{1,6}\s+(.*)$/);
    if (titre) { sortie.push({ type: "titre", texte: titre[1] }); i++; continue; }

    if (ligne.trim().startsWith("|")) {
      const rangs = [];
      while (i < lignes.length && lignes[i].trim().startsWith("|")) {
        if (!estSeparateur(lignes[i])) rangs.push(cellules(lignes[i]));
        i++;
      }
      if (rangs.length) sortie.push({ type: "tableau", entete: rangs[0], rangs: rangs.slice(1) });
      continue;
    }

    const puce = /^\s*[-*•]\s+(.*)$/;
    const numero = /^\s*\d+[.)]\s+(.*)$/;
    if (puce.test(ligne) || numero.test(ligne)) {
      const ordonnee = numero.test(ligne);
      const motif = ordonnee ? numero : puce;
      const elements = [];
      while (i < lignes.length && motif.test(lignes[i])) {
        elements.push(lignes[i].match(motif)[1]);
        i++;
      }
      sortie.push({ type: "liste", ordonnee, elements });
      continue;
    }

    const paragraphe = [];
    while (
      i < lignes.length && lignes[i].trim() &&
      !lignes[i].trim().startsWith("|") && !puce.test(lignes[i]) && !numero.test(lignes[i]) &&
      !/^\s*#{1,6}\s+/.test(lignes[i])
    ) {
      paragraphe.push(lignes[i]);
      i++;
    }
    sortie.push({ type: "paragraphe", lignes: paragraphe });
  }
  return sortie;
}

export default function TexteRiche({ texte }) {
  return (
    <div className="flex flex-col gap-2.5 text-sm leading-relaxed text-[var(--text-slate)]">
      {blocs(texte).map((b, i) => {
        if (b.type === "trait") return <hr key={i} className="border-[var(--border-line)]" />;

        if (b.type === "titre") {
          return <div key={i} className="mt-1 text-sm font-semibold text-[var(--text-ink)]">{enLigne(b.texte, i)}</div>;
        }

        if (b.type === "liste") {
          const Liste = b.ordonnee ? "ol" : "ul";
          return (
            <Liste key={i} className={`flex flex-col gap-1 pl-5 ${b.ordonnee ? "list-decimal" : "list-disc"} marker:text-[var(--text-slate-light)]`}>
              {b.elements.map((e, j) => <li key={j} className="pl-0.5">{enLigne(e, `${i}-${j}`)}</li>)}
            </Liste>
          );
        }

        if (b.type === "tableau") {
          return (
            <div key={i} className="defilement-fin -mx-1 overflow-x-auto rounded-[10px] border border-[var(--border-line)]">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="bg-[var(--bg-surface-alt)]">
                    {b.entete.map((c, j) => (
                      <th key={j} className={`whitespace-nowrap border-b border-[var(--border-line)] px-2.5 py-2 text-xs font-semibold text-[var(--text-slate)] ${j === 0 ? "text-left" : "text-right"}`}>
                        {enLigne(c, `${i}-h-${j}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {b.rangs.map((rang, r) => (
                    <tr key={r} className={r > 0 ? "border-t border-[var(--border-line)]" : ""}>
                      {b.entete.map((_, j) => {
                        const valeur = rang[j] ?? "";
                        return (
                          <td key={j} className={`px-2.5 py-2 ${j === 0 ? "text-left text-[var(--text-ink)]" : "text-right"} ${estNombre(valeur.replace(/\*/g, "")) ? "font-figures whitespace-nowrap" : ""}`}>
                            {enLigne(valeur, `${i}-${r}-${j}`)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return (
          <p key={i}>
            {b.lignes.map((l, j) => (
              <Fragment key={j}>{j > 0 && <br />}{enLigne(l, `${i}-${j}`)}</Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
