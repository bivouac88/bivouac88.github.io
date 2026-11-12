const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "comment", "dans", "de", "des",
  "du", "elle", "en", "est", "et", "il", "je", "la", "le", "les", "moi",
  "mon", "ou", "par", "pas", "pour", "que", "qui", "quoi", "sur", "un",
  "une", "vos", "vous"
]);

export function normalizeText(value = "") {
  return String(value)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter(word => word.length > 1 && !STOP_WORDS.has(word));
}

export function detectIntent(question, intents = []) {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = new Set(tokenize(question));
  let best = null;

  for (const intent of intents) {
    let score = 0;
    const matched = [];

    for (const rawKeyword of intent.keywords || []) {
      const keyword = normalizeText(rawKeyword);
      if (!keyword) continue;

      if (normalizedQuestion.includes(keyword)) {
        // Expressions exactes pèsent davantage qu'un mot isolé.
        const points = keyword.includes(" ") ? 4 : 2;
        score += points;
        matched.push(rawKeyword);
      } else {
        const keywordTokens = tokenize(keyword);
        if (keywordTokens.length && keywordTokens.every(token => questionTokens.has(token))) {
          score += keywordTokens.length;
          matched.push(rawKeyword);
        }
      }
    }

    if (!best || score > best.score) best = { intent, score, matched };
  }

  // Seuil volontairement prudent : mieux vaut ne pas répondre que deviner.
  if (!best || best.score < 2) return { intent: null, score: best?.score || 0, matched: [] };
  return best;
}
