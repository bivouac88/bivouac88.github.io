export async function loadKnowledge() {
  const knowledgeUrl = new URL("../data/knowledge.json", import.meta.url);
  const niamhDataUrl = new URL("../data/niamh-data.json", import.meta.url);
  const voyageApiUrl = "https://script.google.com/macros/s/AKfycbyptX2-OXsxh8yXqk9Hi_ygvcxP1_4vD0AT-KzZPcTFzR9AfEKHbQnBvgi3Pvw5a-LL/exec?public=1";
  // Chargement de la base de connaissances habituelle
  const response = await fetch(knowledgeUrl, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Impossible de charger la base de connaissances : ${response.status}`
    );
  }

  const knowledge = await response.json();

  // Chargement des données provenant de l'onglet Google Sheets autorisé
  try {
    const dataResponse = await fetch(niamhDataUrl, {
      cache: "no-store"
    });

    if (!dataResponse.ok) {
      throw new Error(`Erreur HTTP ${dataResponse.status}`);
    }

    knowledge.liveData = await dataResponse.json();

  } catch (error) {
    console.warn(
      "[Niamh] Impossible de charger les données du voyage :",
      error
    );

    knowledge.liveData = {};
  }

  // Pont : transforme les lignes du Google Sheet en intents compris
  // par le moteur intelligent (synonymes, fautes de frappe, contexte...)
  const sheetIntents = buildIntentsFromLiveData(knowledge.liveData);
  const existingIds = new Set((knowledge.intents || []).map(i => i.id));

  knowledge.intents = [
    ...(knowledge.intents || []).filter(i => !existingIds.has(i.id)),
    ...sheetIntents
  ];

  // Chargement des totaux et des étapes depuis la source publique du site
  try {
    const voyageResponse = await fetch(voyageApiUrl, {
      cache: "no-store"
    });

    if (!voyageResponse.ok) {
      throw new Error(`Erreur HTTP ${voyageResponse.status}`);
    }

    const voyageData = await voyageResponse.json();

    if (!voyageData.totaux || !Array.isArray(voyageData.etapes)) {
      throw new Error("Format des données du voyage invalide");
    }

    knowledge.tripData = voyageData;

  } catch (error) {
    console.warn(
      "[Niamh] Impossible de charger les totaux et étapes :",
      error
    );

    knowledge.tripData = {
      totaux: {},
      etapes: []
    };
  }
  return knowledge;
}

// --------------------------------------------------
// PONT : transforme les lignes du Google Sheet en intents
// --------------------------------------------------

const DYNAMIC_PREFIXES = ["message_ouverture_", "description_page_"];

// Clés "structurelles" (politesse, identité de l'IA...), pas de vrais
// sujets de voyage. Elles ne doivent pas être retenues comme "sujet en
// cours" dans la mémoire de contexte. Pour ajouter une nouvelle clé de
// ce type un jour : il suffit de rajouter son nom ici.
const CONVERSATIONAL_SHEET_KEYS = new Set([
  "niamh",
  "role_niamh",
  "conversation",
  "remerciement",
  "au_revoir"
]);

export function buildIntentsFromLiveData(liveData = {}) {
  const questionCatalog = liveData._questions || {};
  const responses = liveData._responses || {};
  const intents = [];

  for (const [key, formulations] of Object.entries(questionCatalog)) {
    if (!Array.isArray(formulations) || !formulations.length) continue;
    if (DYNAMIC_PREFIXES.some(prefix => key.startsWith(prefix))) continue;

    const value = liveData[key];
    const customAnswer = responses[key];

    // Clé "dynamique pure" (valeur vide, pas de réponse perso) :
    // on laisse getTripDataAnswer / les données calculées s'en occuper.
    if (!customAnswer && (value === undefined || value === null || value === "")) {
      continue;
    }

    const answerText =
      customAnswer ||
      `Concernant ${key.replace(/_/g, " ")}, j'ai noté : ${value}.`;

    intents.push({
      id: `sheet_${key}`,
      label: key.replace(/_/g, " "),
      keywords: formulations, // tes phrases de la colonne "questions", déjà splittées sur ";"
      answers: [answerText],
      source: "sheet",
      conversational: CONVERSATIONAL_SHEET_KEYS.has(key)
    });
  }

  return intents;
}

export function pickAnswer(intent) {
  if (!intent || !Array.isArray(intent.answers) || !intent.answers.length) {
    return "Je n'ai pas encore cette information dans mes sacoches.";
  }

  return intent.answers[
    Math.floor(Math.random() * intent.answers.length)
  ];
}
