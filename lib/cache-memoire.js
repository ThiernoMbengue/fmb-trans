"use client";

// Mémoire des dernières données affichées, dans le navigateur.
//
// En revenant sur une page, on montre tout de suite ce qu'on y avait vu, puis
// on relit la base en arrière-plan et l'on met à jour si quelque chose a
// changé. La page n'attend plus le réseau pour s'afficher.
//
// Cette mémoire ne vit que le temps de l'onglet, et elle est rattachée à un
// compte : en changeant de personne connectée, elle est vidée — personne ne
// voit, même un instant, les chiffres d'un autre.

const memoire = new Map();
let portee;

/** Rattache la mémoire au compte connecté ; la vide s'il a changé. */
export function definirPorteeCache(identifiant) {
  const cle = identifiant || null;
  if (portee !== cle) {
    memoire.clear();
    portee = cle;
  }
}

export const lireCache = (cle) => memoire.get(cle);

export function ecrireCache(cle, valeur) {
  memoire.set(cle, valeur);
}

/** Oublie tout (ou les clés commençant par `prefixe`) : à appeler après une écriture. */
export function viderCache(prefixe) {
  if (!prefixe) return memoire.clear();
  for (const cle of [...memoire.keys()]) if (cle.startsWith(prefixe)) memoire.delete(cle);
}
