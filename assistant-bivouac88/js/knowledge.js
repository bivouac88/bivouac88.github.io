
export async function loadKnowledge() {
  const url = new URL("../data/knowledge.json", import.meta.url);

  const response = await fetch(url, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(
      `Impossible de charger la base de connaissances : ${response.status}`
    );
  }

  return await response.json();
}

export function pickAnswer(intent) {
  if (!intent || !Array.isArray(intent.answers) || !intent.answers.length) {
    return "Je n'ai pas encore cette information dans mes sacoches.";
  }

  return intent.answers[
    Math.floor(Math.random() * intent.answers.length)
  ];
}
