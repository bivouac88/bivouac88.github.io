export async function loadKnowledge() {
  const response = await fetch("./data/knowledge.json", { cache: "no-store" });
  if (!response.ok) throw new Error(`Chargement de la base impossible (${response.status})`);
  return response.json();
}

export function pickAnswer(intent) {
  const answers = intent?.answers || [];
  if (!answers.length) return null;
  return answers[Math.floor(Math.random() * answers.length)];
}
