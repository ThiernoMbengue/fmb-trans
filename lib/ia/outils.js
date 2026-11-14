// Les outils de l'assistant : les seules portes par lesquelles il accède aux
// données. Chacun lit avec le compte de la personne connectée, donc avec ses
// droits — un propriétaire n'obtient que ses véhicules, quoi qu'il demande.
//
// Tous les outils sont en lecture seule. Les montants sont calculés ici, par
// le même code que les pages du site : l'assistant les rapporte, il ne les
// calcule pas.

import { lireTout } from "@/lib/supabase/lire-tout";
import { construireDecomptes } from "@/lib/decomptes";
import { TYPE_PAR_ID, aSurveiller, joursAvant } from "@/lib/carnet";

const VEHICULE = {
  type: "string",
  description: "Immatriculation du véhicule telle qu'elle figure dans la liste (par exemple « AB-449-JL »), ou « tous » pour toute la flotte visible.",
};
const DATE = (quoi) => ({ type: "string", description: `${quoi}, au format AAAA-MM-JJ.` });

/** Définitions envoyées au modèle. `admin` : outils réservés au gestionnaire. */
export const OUTILS = [
  {
    name: "versements",
    description:
      "Totaux des versements saisis sur une période : recette, gazoil, autres dépenses, net versé au propriétaire, jours travaillés. À utiliser pour toute question de chiffres sur une période (un jour, une semaine, un mois, une année) ou pour comparer des véhicules ou des périodes.",
    input_schema: {
      type: "object",
      properties: {
        vehicule: VEHICULE,
        date_debut: DATE("Premier jour de la période"),
        date_fin: DATE("Dernier jour de la période"),
        regroupement: {
          type: "string",
          enum: ["total", "mois", "jour"],
          description: "« total » : un seul total par véhicule. « mois » : une ligne par mois. « jour » : une ligne par jour (période de 92 jours au plus).",
        },
      },
      required: ["vehicule", "date_debut", "date_fin", "regroupement"],
    },
  },
  {
    name: "detail_jour",
    description:
      "Le détail complet de la saisie d'un jour précis : receveur, recette, gazoil, autres dépenses, total caisse, net, remarques, location sans chauffeur. À utiliser quand la question porte sur un jour donné.",
    input_schema: {
      type: "object",
      properties: { vehicule: VEHICULE, date: DATE("Le jour demandé") },
      required: ["vehicule", "date"],
    },
  },
  {
    name: "rechercher_remarques",
    description:
      "Cherche un mot dans les remarques des saisies (remarque du jour, remarque gazoil, remarque autres dépenses) et dans le nom du receveur. À utiliser pour retrouver un événement : une panne, une crevaison, un lavage, un chauffeur.",
    input_schema: {
      type: "object",
      properties: {
        vehicule: VEHICULE,
        texte: { type: "string", description: "Le mot ou le début de mot à chercher, sans accent de préférence." },
      },
      required: ["vehicule", "texte"],
    },
  },
  {
    name: "decomptes",
    description:
      "Les décomptes mensuels de paiement au propriétaire : net des versements, avances déduites, dépenses avancées, remboursements, report, net à payer, déjà versé, solde restant, statut. Avec « tous » : le solde actuel de chaque véhicule. À utiliser pour « combien reste-t-il à payer », « combien a été versé », « quel mois n'est pas soldé ».",
    input_schema: {
      type: "object",
      properties: { vehicule: VEHICULE },
      required: ["vehicule"],
    },
  },
  {
    name: "avances",
    description:
      "Les avances au propriétaire, dépenses imprévues et remboursements d'un véhicule, avec leur statut (en cours ou réglée) et les totaux. À utiliser pour toute question sur les avances.",
    input_schema: {
      type: "object",
      properties: {
        vehicule: VEHICULE,
        statut: { type: "string", enum: ["toutes", "en_cours", "reglees"], description: "Filtre sur le statut des lignes." },
      },
      required: ["vehicule", "statut"],
    },
  },
  {
    name: "carnet",
    admin: true,
    description:
      "Le carnet de bord de l'entreprise : notes, sommes qu'on nous doit, sommes que nous devons, échéances (assurance, visite technique), entretiens, documents. Rend les lignes ouvertes et ce qui arrive à échéance.",
    input_schema: { type: "object", properties: {}, required: [] },
  },
  {
    name: "proposer_document",
    description:
      "Affiche dans la conversation un bouton pour télécharger un document PDF officiel. À utiliser dès que la personne demande un relevé, un décompte, un reçu ou « un document ». Types : « releve_versements » (détail jour par jour), « releve_avances », « decompte_solde » (versements et avances réunis), tous trois sur une période ; « recu_paiement » pour le reçu d'un mois déjà payé (donner alors periode, au format AAAA-MM).",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["releve_versements", "releve_avances", "decompte_solde", "recu_paiement"] },
        vehicule: { type: "string", description: "Immatriculation du véhicule. Un document concerne toujours un seul véhicule." },
        date_debut: DATE("Premier jour (relevés et décompte)"),
        date_fin: DATE("Dernier jour (relevés et décompte)"),
        periode: { type: "string", description: "Mois du reçu, au format AAAA-MM (reçu de paiement uniquement)." },
      },
      required: ["type", "vehicule"],
    },
  },
];

/** Ce que l'on affiche pendant qu'un outil travaille. */
export const LIBELLE_OUTIL = {
  versements: "Lecture des versements…",
  detail_jour: "Lecture de la saisie du jour…",
  rechercher_remarques: "Recherche dans les remarques…",
  decomptes: "Calcul des décomptes…",
  avances: "Lecture des avances…",
  carnet: "Lecture du carnet de bord…",
  proposer_document: "Préparation du document…",
};

export const NOM_DOCUMENT = {
  releve_versements: "Relevé de versements",
  releve_avances: "Relevé des avances",
  decompte_solde: "Décompte de solde",
  recu_paiement: "Reçu de paiement",
};

/* ------------------------------------------------------------------ */
/* Contrôles                                                           */
/* ------------------------------------------------------------------ */

class ErreurOutil extends Error {}

const sansSeparateur = (texte) => String(texte || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const exigerDate = (valeur, nom) => {
  const texte = String(valeur || "");
  const d = new Date(texte + "T00:00:00Z");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte) || Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== texte) {
    throw new ErreurOutil(`${nom} doit être une date au format AAAA-MM-JJ.`);
  }
  return texte;
};

const exigerPeriode = (debut, fin) => {
  const d = exigerDate(debut, "date_debut");
  const f = exigerDate(fin, "date_fin");
  if (d > f) throw new ErreurOutil("date_debut doit précéder date_fin.");
  return [d, f];
};

const nbJours = (debut, fin) =>
  Math.round((new Date(fin + "T00:00:00Z") - new Date(debut + "T00:00:00Z")) / 86400000) + 1;

/** Véhicules désignés par l'assistant : « tous », ou une immatriculation. */
function choisirVehicules(vehicles, designation, { unSeul = false } = {}) {
  const texte = String(designation || "").trim();
  if (!vehicles.length) throw new ErreurOutil("Aucun véhicule n'est accessible avec ce compte.");

  if (/^tou(s|te|tes|t)?$/i.test(texte) || texte === "") {
    if (unSeul) throw new ErreurOutil("Précisez un véhicule : " + vehicles.map((v) => v.immatriculation).join(", ") + ".");
    return vehicles;
  }

  const cle = sansSeparateur(texte);
  let trouves = vehicles.filter((v) => sansSeparateur(v.immatriculation) === cle || v.id === texte);
  // À défaut, la marque — si elle ne désigne qu'un seul véhicule.
  if (!trouves.length) trouves = vehicles.filter((v) => sansSeparateur(v.marque).includes(cle) && cle.length >= 3);
  if (trouves.length === 1) return trouves;

  throw new ErreurOutil(
    (trouves.length > 1 ? `« ${texte} » désigne plusieurs véhicules. ` : `Véhicule « ${texte} » introuvable. `) +
    "Véhicules accessibles : " + vehicles.map((v) => `${v.immatriculation} (${v.marque})`).join(", ") + "."
  );
}

const etiquette = (v) => ({ immatriculation: v.immatriculation, marque: v.marque });
const nombre = (n) => Math.round(Number(n) || 0);

function cumuler(lignes) {
  const t = { jours_saisis: lignes.length, jours_travailles: 0, recette: 0, gazoil: 0, autres: 0, net: 0 };
  for (const e of lignes) {
    if (Number(e.recette) > 0) t.jours_travailles++;
    t.recette += Number(e.recette) || 0;
    t.gazoil += Number(e.gazoil) || 0;
    t.autres += Number(e.autres) || 0;
    t.net += Number(e.net) || 0;
  }
  return { ...t, recette: nombre(t.recette), gazoil: nombre(t.gazoil), autres: nombre(t.autres), net: nombre(t.net) };
}

async function lire(requete) {
  const { data, error } = await lireTout(requete);
  if (error) throw new ErreurOutil("Lecture des données impossible : " + error.message);
  return data || [];
}

/* ------------------------------------------------------------------ */
/* Exécution                                                           */
/* ------------------------------------------------------------------ */

const EXECUTEURS = {
  async versements({ supabase, vehicles }, entree) {
    const cibles = choisirVehicules(vehicles, entree.vehicule);
    const [debut, fin] = exigerPeriode(entree.date_debut, entree.date_fin);
    const regroupement = ["total", "mois", "jour"].includes(entree.regroupement) ? entree.regroupement : "total";
    if (regroupement === "jour" && nbJours(debut, fin) > 92) {
      throw new ErreurOutil("Période trop longue pour un détail par jour (92 jours au plus). Utilisez le regroupement « mois ».");
    }

    const lignes = await lire(() =>
      supabase.from("entries").select("vehicle_id,date,recette,gazoil,autres,net")
        .in("vehicle_id", cibles.map((v) => v.id)).gte("date", debut).lte("date", fin)
        .order("date", { ascending: true })
    );

    const resultat = {
      periode: { du: debut, au: fin, jours: nbJours(debut, fin) },
      vehicules: cibles.map((v) => ({ ...etiquette(v), ...cumuler(lignes.filter((e) => e.vehicle_id === v.id)) })),
    };
    if (cibles.length > 1) resultat.total = cumuler(lignes);

    if (regroupement !== "total") {
      const groupes = new Map();
      for (const e of lignes) {
        const cle = regroupement === "mois" ? e.date.slice(0, 7) : e.date;
        if (!groupes.has(cle)) groupes.set(cle, []);
        groupes.get(cle).push(e);
      }
      resultat[regroupement === "mois" ? "par_mois" : "par_jour"] =
        [...groupes.entries()].map(([cle, g]) => ({ [regroupement === "mois" ? "mois" : "date"]: cle, ...cumuler(g) }));
    }
    if (!lignes.length) resultat.note = "Aucune saisie sur cette période.";
    return resultat;
  },

  async detail_jour({ supabase, vehicles }, entree) {
    const cibles = choisirVehicules(vehicles, entree.vehicule);
    const date = exigerDate(entree.date, "date");
    const { data, error } = await supabase.from("entries").select("*")
      .in("vehicle_id", cibles.map((v) => v.id)).eq("date", date);
    if (error) throw new ErreurOutil("Lecture des données impossible : " + error.message);

    const parId = Object.fromEntries(cibles.map((v) => [v.id, v]));
    const saisies = (data || []).map((e) => ({
      ...etiquette(parId[e.vehicle_id] || {}),
      date: e.date,
      receveur: e.receveur || null,
      recette: nombre(e.recette),
      gazoil: nombre(e.gazoil),
      remarque_gazoil: e.gazoil_note || null,
      autres_depenses: nombre(e.autres),
      remarque_autres: e.autres_note || null,
      total_caisse: nombre(e.total_caisse),
      net_verse: nombre(e.net),
      location_sans_chauffeur: e.sans_chauffeur === true,
      remarque_du_jour: e.note || null,
    }));
    return saisies.length ? { saisies } : { saisies: [], note: `Aucune saisie le ${date}.` };
  },

  async rechercher_remarques({ supabase, vehicles }, entree) {
    const cibles = choisirVehicules(vehicles, entree.vehicule);
    const terme = String(entree.texte || "").trim().toLowerCase();
    if (terme.length < 2) throw new ErreurOutil("Donnez au moins deux lettres à chercher.");

    const lignes = await lire(() =>
      supabase.from("entries").select("vehicle_id,date,receveur,recette,net,note,gazoil_note,autres_note")
        .in("vehicle_id", cibles.map((v) => v.id)).order("date", { ascending: false })
    );
    const simple = (t) => String(t || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
    const cherche = simple(terme);
    const parId = Object.fromEntries(cibles.map((v) => [v.id, v]));
    const trouvees = lignes.filter((e) =>
      [e.note, e.gazoil_note, e.autres_note, e.receveur].some((c) => simple(c).includes(cherche))
    );
    return {
      nombre_de_resultats: trouvees.length,
      resultats: trouvees.slice(0, 30).map((e) => ({
        ...etiquette(parId[e.vehicle_id] || {}),
        date: e.date,
        receveur: e.receveur || null,
        recette: nombre(e.recette),
        net_verse: nombre(e.net),
        remarque_du_jour: e.note || null,
        remarque_gazoil: e.gazoil_note || null,
        remarque_autres: e.autres_note || null,
      })),
      ...(trouvees.length > 30 ? { note: "Seuls les 30 résultats les plus récents sont listés." } : {}),
    };
  },

  async decomptes({ supabase, vehicles }, entree) {
    const cibles = choisirVehicules(vehicles, entree.vehicule);
    const ids = cibles.map((v) => v.id);
    const [entries, avances, paiements] = await Promise.all([
      lire(() => supabase.from("entries").select("vehicle_id,date,net").in("vehicle_id", ids)),
      lire(() => supabase.from("avances").select("vehicle_id,date,type,montant,statut,regularisee_auto").in("vehicle_id", ids)),
      lire(() => supabase.from("paiements").select("*").in("vehicle_id", ids).order("date_paiement", { ascending: true })),
    ]);

    const parVehicule = cibles.map((v) => {
      const d = construireDecomptes(v.id, entries, avances, paiements);
      const dernier = d[d.length - 1];
      return {
        vehicule: v,
        decomptes: d,
        resume: {
          ...etiquette(v),
          proprietaire: v.proprietaire || null,
          solde_actuel: nombre(dernier ? dernier.solde : 0),
          total_du: nombre(d.reduce((s, x) => s + x.netAPayer, 0)),
          total_verse: nombre(d.reduce((s, x) => s + x.paye, 0)),
          mois_a_regler: d.filter((x) => x.statut === "a_payer" || x.statut === "partiel").map((x) => x.periode),
        },
      };
    });

    const explication =
      "solde positif = reste à verser au propriétaire ; solde négatif = trop-perçu, reporté sur le mois suivant. Statuts : en_cours (mois en cours), a_payer, partiel, solde (soldé).";

    if (cibles.length > 1) {
      return {
        soldes_par_vehicule: parVehicule.map((x) => x.resume),
        reste_a_payer_total: nombre(parVehicule.reduce((s, x) => s + Math.max(0, x.resume.solde_actuel), 0)),
        explication,
      };
    }

    const { decomptes, resume } = parVehicule[0];
    return {
      ...resume,
      // Du plus récent au plus ancien, dix-huit mois au plus.
      mois: [...decomptes].reverse().slice(0, 18).map((d) => ({
        mois: d.periode,
        statut: d.statut,
        report_du_mois_precedent: nombre(d.report),
        net_des_versements: nombre(d.netMois),
        avances_deduites: nombre(d.avances),
        depenses_avancees: nombre(d.depenses),
        remboursements_recus: nombre(d.remboursements),
        net_a_payer: nombre(d.netAPayer),
        deja_verse: nombre(d.paye),
        solde: nombre(d.solde),
        paiements: d.paiements.map((p) => ({ date: p.date_paiement, montant: nombre(p.montant), mode: p.mode, recu: p.numero_recu || null })),
      })),
      explication,
    };
  },

  async avances({ supabase, vehicles }, entree) {
    const cibles = choisirVehicules(vehicles, entree.vehicule);
    const filtre = ["toutes", "en_cours", "reglees"].includes(entree.statut) ? entree.statut : "toutes";
    const lignes = await lire(() =>
      supabase.from("avances").select("*").in("vehicle_id", cibles.map((v) => v.id)).order("date", { ascending: false })
    );
    const reglee = (r) => r.statut === "regularisee";
    const somme = (liste, type) => nombre(liste.filter((r) => r.type === type).reduce((s, r) => s + (Number(r.montant) || 0), 0));
    const enCours = lignes.filter((r) => !reglee(r));
    const reglees = lignes.filter(reglee);
    const visibles = filtre === "en_cours" ? enCours : filtre === "reglees" ? reglees : lignes;
    const parId = Object.fromEntries(cibles.map((v) => [v.id, v]));

    return {
      totaux_en_cours: {
        avances: somme(enCours, "avance_proprietaire"),
        depenses_imprevues: somme(enCours, "depense_imprevue"),
        remboursements: somme(enCours, "remboursement"),
        reste_a_recuperer: somme(enCours, "avance_proprietaire") + somme(enCours, "depense_imprevue") - somme(enCours, "remboursement"),
      },
      total_deja_regle: somme(reglees, "avance_proprietaire") + somme(reglees, "depense_imprevue"),
      nombre_de_lignes: visibles.length,
      lignes: visibles.slice(0, 80).map((r) => ({
        ...(cibles.length > 1 ? etiquette(parId[r.vehicle_id] || {}) : {}),
        date: r.date,
        type: r.type,
        montant: nombre(r.montant),
        motif: r.note || null,
        statut: reglee(r) ? "reglee" : "en_cours",
        ...(reglee(r)
          ? { reglee_par: r.regularisee_auto ? `paiement de ${r.regularisee_periode || "?"}` : `à la main (${r.regularisee_note || "sans précision"})` }
          : {}),
      })),
      ...(visibles.length > 80 ? { note: "Seules les 80 lignes les plus récentes sont listées." } : {}),
    };
  },

  async carnet({ supabase, vehicles, role }) {
    if (role !== "admin") throw new ErreurOutil("Le carnet de bord est réservé au gestionnaire.");
    const { data, error } = await supabase.from("carnet").select("*").eq("statut", "ouvert").order("created_at", { ascending: false });
    if (error) throw new ErreurOutil("Le carnet de bord n'est pas disponible : " + error.message);
    const lignes = data || [];
    const resume = aSurveiller(lignes);
    const parId = Object.fromEntries(vehicles.map((v) => [v.id, v]));
    return {
      on_nous_doit: nombre(resume.aRecevoir),
      nous_devons: nombre(resume.aPayer),
      echeances_sous_30_jours: resume.echeances.length,
      echeances_en_retard: resume.enRetard,
      lignes_ouvertes: lignes.slice(0, 60).map((l) => ({
        type: (TYPE_PAR_ID[l.type] || {}).label || l.type,
        titre: l.titre,
        detail: l.detail || null,
        montant: l.montant != null ? nombre(l.montant) : null,
        echeance: l.date_echeance || null,
        jours_avant_echeance: l.date_echeance ? joursAvant(l.date_echeance) : null,
        vehicule: l.vehicle_id && parId[l.vehicle_id] ? parId[l.vehicle_id].immatriculation : null,
      })),
    };
  },

  async proposer_document({ vehicles, documents }, entree) {
    const type = String(entree.type || "");
    if (!NOM_DOCUMENT[type]) throw new ErreurOutil("Type de document inconnu.");
    const [v] = choisirVehicules(vehicles, entree.vehicule, { unSeul: true });

    const document = { type, vehicleId: v.id, vehicule: `${v.marque} — ${v.immatriculation}` };
    if (type === "recu_paiement") {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(entree.periode || ""))) {
        throw new ErreurOutil("Pour un reçu, donnez periode au format AAAA-MM.");
      }
      document.periode = entree.periode;
    } else {
      [document.dateDebut, document.dateFin] = exigerPeriode(entree.date_debut, entree.date_fin);
    }
    documents.push(document);
    return {
      affiche: true,
      message: "Un bouton de téléchargement est affiché sous votre réponse. Le PDF est généré au moment du clic ; s'il n'y a aucune donnée sur la période, la personne en sera avertie.",
    };
  },
};

/**
 * Exécute un outil demandé par le modèle. Rend toujours un résultat — une
 * erreur est rendue comme telle au modèle, qui peut corriger sa demande.
 */
export async function executerOutil(nom, entree, contexte) {
  const executeur = EXECUTEURS[nom];
  if (!executeur) return { contenu: `Outil inconnu : ${nom}.`, erreur: true };
  try {
    const resultat = await executeur(contexte, entree && typeof entree === "object" ? entree : {});
    return { contenu: JSON.stringify(resultat), erreur: false };
  } catch (e) {
    if (e instanceof ErreurOutil) return { contenu: e.message, erreur: true };
    return { contenu: "L'outil a rencontré une erreur inattendue.", erreur: true };
  }
}

/** Outils proposés selon le rôle, sans le champ interne `admin`. */
export function outilsPour(role) {
  return OUTILS.filter((o) => !o.admin || role === "admin").map(({ admin, ...outil }) => outil);
}
