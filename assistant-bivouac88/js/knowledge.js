
export async function loadKnowledge() {
  const knowledgeUrl = new URL("../data/knowledge.json", import.meta.url);
  const niamhDataUrl = new URL("../data/niamh-data.json", import.meta.url);

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
