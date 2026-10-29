// L'API Supabase plafonne une réponse à 1 000 lignes. Au-delà, elle ne
// signale rien : elle renvoie simplement les 1 000 premières. Un décompte
// calculé sur une table tronquée serait faux sans le moindre message
// d'erreur — d'où ce lecteur, qui lit page après page jusqu'au bout.

const TAILLE_PAGE = 1000;

// Garde-fou : 500 pages, soit 500 000 lignes. Bien au-delà de ce que la
// flotte produira, et borne une boucle qui ne doit jamais s'emballer.
const PAGES_MAX = 500;

/**
 * Lit une table entière, par pages.
 *
 * `construireRequete` est une fonction, pas une requête : une requête
 * Supabase ne peut être exécutée qu'une fois, il faut donc pouvoir la
 * reconstruire à chaque page.
 *
 *   lireTout(() => supabase.from("entries").select("vehicle_id,date,net"))
 */
export async function lireTout(construireRequete) {
  const lignes = [];

  for (let page = 0; page < PAGES_MAX; page++) {
    const debut = page * TAILLE_PAGE;
    const { data, error } = await construireRequete().range(debut, debut + TAILLE_PAGE - 1);

    if (error) return { data: null, error };

    lignes.push(...(data || []));

    // Une page incomplète signifie qu'on a atteint la fin.
    if (!data || data.length < TAILLE_PAGE) return { data: lignes, error: null };
  }

  return { data: lignes, error: null };
}
