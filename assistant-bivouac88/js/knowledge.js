
export async function loadKnowledge() {
  const knowledgeUrl = new URL("../data/knowledge.json", import.meta.url);
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

export function pickAnswer(intent) {
  if (!intent || !Array.isArray(intent.answers) || !intent.answers.length) {
    return "Je n'ai pas encore cette information dans mes sacoches.";
  }

  return intent.answers[
    Math.floor(Math.random() * intent.answers.length)
  ];
}
