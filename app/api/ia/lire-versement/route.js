import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRole } from "@/lib/supabase/role";
import {
  clientIA, MODELE, IA_NON_CONFIGUREE, LIMITE_ATTEINTE,
  compterDemande, enregistrerConsommation, messageErreurIA,
} from "@/lib/ia/client";
import { SCHEMA_LECTURE, consignesLecture, normaliserLecture } from "@/lib/ia/lecture-versement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TYPES_ACCEPTES = ["image/jpeg", "image/png", "image/webp"];
// L'image arrive déjà réduite par le navigateur ; cette limite protège le
// serveur d'un envoi qui contournerait cette étape.
const TAILLE_MAX_BASE64 = 5_500_000;

const refus = (message, status) => NextResponse.json({ error: message }, { status });

/**
 * Lit une capture d'écran de versement et rend de quoi pré-remplir la saisie.
 * Réservé au gestionnaire. Rien n'est enregistré ici.
 */
export async function POST(request) {
  const supabase = createClient();
  const { user, role } = await getRole(supabase);
  if (!user) return refus("Connectez-vous pour utiliser cette fonction.", 401);
  if (role !== "admin") return refus("Action réservée au gestionnaire.", 403);

  const client = clientIA();
  if (!client) return NextResponse.json({ error: IA_NON_CONFIGUREE, nonConfiguree: true }, { status: 503 });

  let corps;
  try {
    corps = await request.json();
  } catch {
    return refus("Envoi illisible.", 400);
  }

  const image = typeof corps?.image === "string" ? corps.image : "";
  const type = TYPES_ACCEPTES.includes(corps?.type) ? corps.type : null;
  if (!image || !type) return refus("Envoyez une image au format JPEG, PNG ou WebP.", 400);
  if (image.length > TAILLE_MAX_BASE64) return refus("Image trop lourde. Réessayez avec une capture d'écran.", 413);
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(image)) return refus("Image illisible.", 400);

  const quota = await compterDemande(user.id);
  if (!quota.ok) return refus(LIMITE_ATTEINTE, 429);

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, marque, immatriculation")
    .order("created_at", { ascending: true });
  const flotte = vehicles || [];
  const aujourdhui = new Date().toISOString().slice(0, 10);

  try {
    const reponse = await client.messages.create({
      model: MODELE,
      // La réflexion du modèle compte dans cette limite : on laisse de la marge.
      max_tokens: 4000,
      system: consignesLecture({ aujourdhui, vehicles: flotte }),
      output_config: { format: { type: "json_schema", schema: SCHEMA_LECTURE } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: type, data: image } },
            { type: "text", text: "Lisez cette capture et remplissez les champs." },
          ],
        },
      ],
    });

    await enregistrerConsommation(user.id, reponse.usage?.input_tokens, reponse.usage?.output_tokens);

    if (reponse.stop_reason === "refusal") {
      return refus("Cette image n'a pas pu être analysée. Remplissez la saisie à la main.", 422);
    }
    if (reponse.stop_reason === "max_tokens") {
      return refus("La lecture n'a pas abouti. Réessayez, ou remplissez la saisie à la main.", 502);
    }

    // La réponse peut commencer par un bloc de réflexion : on lit le texte par
    // son type, jamais par sa position.
    const texte = reponse.content.find((bloc) => bloc.type === "text")?.text || "";
    let brut;
    try {
      brut = JSON.parse(texte);
    } catch {
      return refus("La lecture n'a pas abouti. Réessayez, ou remplissez la saisie à la main.", 502);
    }

    return NextResponse.json({ lecture: normaliserLecture(brut, { vehicles: flotte, aujourdhui }) });
  } catch (erreur) {
    return refus(messageErreurIA(erreur), 502);
  }
}
