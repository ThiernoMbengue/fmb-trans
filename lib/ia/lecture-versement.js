// Lecture d'une capture d'écran envoyée par un chauffeur : la conversation
// WhatsApp qui contient l'écran Yango du jour et, dessous, les dépenses.
//
// Le modèle ne fait que lire. Ce qu'il rend est vérifié ici, puis proposé
// dans le formulaire : rien n'est enregistré sans validation.

// Schéma de la réponse. Tous les champs sont obligatoires : un montant
// absent de l'image vaut 0, et le drapeau « _trouve » dit s'il a été lu.
export const SCHEMA_LECTURE = {
  type: "object",
  additionalProperties: false,
  required: [
    "lisible", "immatriculation", "date", "receveur",
    "recette", "recette_trouvee", "gazoil", "gazoil_trouve",
    "autres", "autres_trouve", "autres_note", "remarque", "incertitudes",
  ],
  properties: {
    lisible: { type: "boolean", description: "false si l'image n'est pas une capture de versement exploitable." },
    immatriculation: { type: "string", description: "Immatriculation lue dans le nom du groupe, telle qu'écrite. Chaîne vide si absente." },
    date: { type: "string", description: "Jour du versement au format AAAA-MM-JJ. Chaîne vide si illisible." },
    receveur: { type: "string", description: "Prénom ou nom de la personne qui a envoyé la capture. Chaîne vide si inconnu." },
    recette: { type: "number", description: "Recette du jour en FCFA : le grand montant affiché sous la date sur l'écran Yango." },
    recette_trouvee: { type: "boolean" },
    gazoil: { type: "number", description: "Dépense de carburant en FCFA." },
    gazoil_trouve: { type: "boolean" },
    autres: { type: "number", description: "Total des autres dépenses en FCFA (parking, lavage, péage…)." },
    autres_trouve: { type: "boolean" },
    autres_note: { type: "string", description: "Nature des autres dépenses, en quelques mots. Chaîne vide si aucune." },
    remarque: { type: "string", description: "Information utile qui ne rentre dans aucun champ. Chaîne vide sinon." },
    incertitudes: {
      type: "array",
      items: { type: "string" },
      description: "Chaque point douteux, en une phrase courte adressée au gestionnaire. Tableau vide si tout est clair.",
    },
  },
};

export function consignesLecture({ aujourdhui, vehicles }) {
  const flotte = vehicles.map((v) => `- ${v.immatriculation} (${v.marque})`).join("\n");
  return `Vous lisez une capture d'écran pour pré-remplir la saisie d'un versement dans l'outil de gestion de FMB Trans-Mobilité Services, une société de location de véhicules avec chauffeur à Dakar. Les montants sont en francs CFA, sans décimales.

Ce que montre habituellement la capture : une conversation WhatsApp d'un groupe par véhicule. Le chauffeur y envoie une capture de l'application Yango, puis un ou deux messages texte avec ses dépenses.

Où lire chaque information :
- Immatriculation : dans le nom du groupe, en haut (par exemple « GUICHET N°3 AB921LC » donne AB921LC).
- Date du versement : la date affichée sur l'écran Yango au-dessus du grand montant (« 13 novembre »). C'est elle qui compte, pas la date d'envoi du message : un chauffeur envoie souvent la capture le lendemain. L'année n'est pas affichée : prenez la date la plus récente qui ne soit pas dans le futur. Nous sommes le ${aujourdhui}.
- Recette : le grand montant sous cette date (« 46168 FCFA »). Les pastilles en dessous (Espèces, Carte, Bonus, Commission…) et la liste des courses ne sont pas la recette : ignorez-les.
- Gazoil et autres dépenses : dans les messages texte envoyés juste après la capture. « Gasoil 8700 » ou « Gazoil 12100 » est le carburant. « Parking 500 », « Lavage 1000 », « Péage » sont d'autres dépenses : additionnez-les et décrivez-les dans autres_note.
- Deux nombres seuls à la suite, sans libellé (« 17000 » puis « 500 ») : le premier est le gazoil, le second les autres dépenses. Signalez-le dans incertitudes pour que le gestionnaire confirme.
- Receveur : le nom affiché au-dessus de la capture (« Weuzi », « Assane »).

Règles :
- Ne devinez jamais un montant. Si une information n'est pas visible, laissez le champ à 0 ou vide, mettez le drapeau « _trouve » à false.
- Un message ambigu (« Plus 20000 », un montant sans rapport clair) ne doit entrer dans aucun montant : recopiez-le dans remarque et expliquez le doute dans incertitudes.
- Si plusieurs jours sont visibles, ne lisez que le plus récent et signalez dans incertitudes que d'autres jours apparaissent.
- Si l'image n'a rien d'une capture de versement, mettez lisible à false et expliquez pourquoi dans incertitudes.

Véhicules de la flotte, pour reconnaître l'immatriculation :
${flotte || "- (aucun véhicule enregistré)"}`;
}

const sansSeparateur = (texte) => String(texte || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const montant = (valeur) => {
  const n = Math.round(Number(valeur));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const estDate = (texte) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(texte || "")) return false;
  const d = new Date(texte + "T00:00:00Z");
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === texte;
};

/**
 * Vérifie et met en forme ce que le modèle a lu. Le modèle est tenu par le
 * schéma, mais une date impossible ou une immatriculation inconnue restent
 * possibles : ce contrôle évite de les faire entrer dans le formulaire.
 */
export function normaliserLecture(brut, { vehicles, aujourdhui }) {
  const lu = brut && typeof brut === "object" ? brut : {};
  const incertitudes = Array.isArray(lu.incertitudes)
    ? lu.incertitudes.map((t) => String(t || "").trim()).filter(Boolean).slice(0, 8)
    : [];

  // Immatriculation : « AB921LC » et « AB-921-LC » désignent le même véhicule.
  const cle = sansSeparateur(lu.immatriculation);
  const vehicule = cle ? vehicles.find((v) => sansSeparateur(v.immatriculation) === cle) || null : null;
  if (cle && !vehicule) {
    incertitudes.push(`L'immatriculation lue (${String(lu.immatriculation).trim()}) ne correspond à aucun véhicule de la flotte.`);
  }

  let date = estDate(lu.date) ? lu.date : "";
  if (date && date > aujourdhui) {
    incertitudes.push("La date lue est dans le futur : vérifiez-la.");
    date = "";
  }

  const recetteTrouvee = lu.recette_trouvee === true && montant(lu.recette) > 0;
  const gazoilTrouve = lu.gazoil_trouve === true;
  const autresTrouve = lu.autres_trouve === true;

  return {
    lisible: lu.lisible !== false && (recetteTrouvee || Boolean(date)),
    vehicleId: vehicule?.id || null,
    immatriculation: vehicule?.immatriculation || String(lu.immatriculation || "").trim(),
    date,
    receveur: String(lu.receveur || "").trim().slice(0, 60),
    recette: recetteTrouvee ? montant(lu.recette) : null,
    gazoil: gazoilTrouve ? montant(lu.gazoil) : null,
    autres: autresTrouve ? montant(lu.autres) : null,
    autresNote: String(lu.autres_note || "").trim().slice(0, 120),
    remarque: String(lu.remarque || "").trim().slice(0, 300),
    incertitudes,
  };
}
