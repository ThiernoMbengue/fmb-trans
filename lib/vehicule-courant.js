"use client";

// Le véhicule choisi suit la personne de page en page : sélectionné une fois
// dans Saisie, il l'est encore dans Paiements ou Avances.
//
// Il est conservé dans un cookie plutôt que dans le stockage du navigateur :
// le serveur le lit et rend la page directement sur le bon véhicule, sans
// passer d'abord par le premier de la liste.

import { useCallback, useEffect, useState } from "react";

export const COOKIE_VEHICULE = "fmb_vehicule";
const EVENEMENT = "fmb:vehicule";

function lireCookie() {
  if (typeof document === "undefined") return null;
  const trouve = document.cookie.split("; ").find((c) => c.startsWith(COOKIE_VEHICULE + "="));
  return trouve ? decodeURIComponent(trouve.slice(COOKIE_VEHICULE.length + 1)) : null;
}

function ecrireCookie(id) {
  try {
    document.cookie = `${COOKIE_VEHICULE}=${encodeURIComponent(id)}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
}

/** Change le véhicule courant depuis n'importe où (recherche rapide). */
export function choisirVehicule(id) {
  ecrireCookie(id);
  window.dispatchEvent(new CustomEvent(EVENEMENT, { detail: id }));
}

/**
 * const [vehicleId, setVehicleId] = useVehiculeCourant(vehicles, initial);
 *
 * `initial` vient du serveur (cookie). `extra` liste les valeurs acceptées en
 * plus des véhicules — « toute la flotte » sur le tableau de bord.
 */
export function useVehiculeCourant(vehicles, initial, { extra = [] } = {}) {
  const valide = useCallback(
    (id) => Boolean(id) && (extra.includes(id) || vehicles.some((v) => v.id === id)),
    [vehicles, extra.join("|")] // eslint-disable-line
  );

  const [id, setId] = useState(valide(initial) ? initial : vehicles[0]?.id || null);

  const choisir = useCallback((nouveau) => {
    setId(nouveau);
    if (nouveau) ecrireCookie(nouveau);
  }, []);

  useEffect(() => {
    // Une page revenue du cache peut dater d'avant le dernier choix.
    const enregistre = lireCookie();
    if (enregistre && valide(enregistre)) setId((actuel) => (actuel === enregistre ? actuel : enregistre));

    const surChoix = (e) => { if (valide(e.detail)) setId(e.detail); };
    window.addEventListener(EVENEMENT, surChoix);
    return () => window.removeEventListener(EVENEMENT, surChoix);
  }, [valide]);

  return [id, choisir];
}
