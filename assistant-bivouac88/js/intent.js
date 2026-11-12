
const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "comment", "dans",
  "de", "des", "du", "elle", "en", "est", "et", "il", "je",
  "la", "le", "les", "moi", "mon", "ou", "par", "pas",
  "pour", "que", "qui", "quoi", "sur", "un", "une", "vos",
  "vous", "ou"
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

function normalizeWord(word) {
  // Normalisation simple des pluriels français.
  if (word.length > 4 && word.endsWith("es")) {
    return word.slice(0, -2);
  }

  if (word.length > 3 && (word.endsWith("s") || word.endsWith("x"))) {
    return word.slice(0, -1);
  }

  return word;
}

export function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .map(normalizeWord);
}

export function detectIntent(question, intents = []) {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = new Set(tokenize(question));

  const scores = [];

  for (const intent of intents) {
    let score = 0;
    const matched = [];

    for (const rawKeyword of intent.keywords || []) {
      const keyword = normalizeText(rawKeyword);
      if (!keyword) continue;

      const keywordTokens = tokenize(keyword);

      // Expression complète trouvée dans la question.
      if (
        keyword.includes(" ") &&
        normalizedQuestion.includes(keyword)
      ) {
        score += 5;
        matched.push(rawKeyword);
        continue;
      }

      // Mot simple reconnu.
      if (
        keywordTokens.length === 1 &&
        questionTokens.has(keywordTokens[0])
      ) {
        score += 2.5;
        matched.push(rawKeyword);
        continue;
      }

      // Expression composée dont tous les mots sont présents.
      if (
        keywordTokens.length > 1 &&
        keywordTokens.every(token => questionTokens.has(token))
      ) {
        score += 3.5;
        matched.push(rawKeyword);
      }
    }

    if (score > 0) {
      scores.push({ intent, score, matched });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  if (!scores.length || scores[0].score < 2.5) {
    return {
      intent: null,
      ambiguous: [],
      score: scores[0]?.score || 0
    };
  }

  const best = scores[0];
  const second = scores[1];

  // Deux intentions proches : demander une précision.
  if (
    second &&
    second.score >= 2.5 &&
    best.score - second.score <= 1.5
  ) {
    return {
      intent: null,
      ambiguous: scores
        .filter(item => item.score >= best.score - 1.5)
        .slice(0, 3)
        .map(item => ({
          id: item.intent.id,
          label: item.intent.label
        })),
      score: best.score
    };
  }

  return {
    intent: best.intent,
    ambiguous: [],
    score: best.score,
    matched: best.matched
  };
}
