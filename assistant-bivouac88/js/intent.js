
// intent.js — compréhension linguistique globale du Bivouaciste

const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "cette",
  "dans", "de", "des", "du", "elle", "elles", "en",
  "est", "et", "eux", "il", "ils", "je", "la", "le",
  "les", "leur", "leurs", "lui", "ma", "me", "mes",
  "moi", "mon", "ne", "nos", "notre", "nous", "on",
  "ou", "par", "pour", "sa", "se", "ses", "son",
  "sur", "ta", "te", "tes", "toi", "ton", "tu",
  "un", "une", "vos", "votre", "vous", "y", "donc",
  "car"
]);

// Synonymes centralisés.
const SYNONYMS = {
  velo: [
    "bicyclette", "becane", "biclou", "cycle",
    "deux roues"
  ],
  voyage: [
    "periple", "vadrouille", "expedition", "aventure"
  ],
  parcours: [
    "itineraire", "trace", "trajet", "route"
  ],
  photo: [
    "image", "cliche", "photographie"
  ],
  carte: [
    "plan", "cartographie"
  ],
  statistique: [
    "chiffre", "donnee", "indicateur"
  ],
  etape: [
    "journee", "escale"
  ],
  kilometre: [
    "km", "kilometrage"
  ],
  denivele: [
    "elevation"
  ],
  aide: [
    "assistance"
  ],
  commentaire: [
    "reaction", "message"
  ],
  don: [
    "donation", "contribution"
  ],
  meteo: [
    "temps", "conditions meteorologiques"
  ],
  peche: [
    "pecher", "pecheur", "pecheurs"
  ]
};

const SYNONYM_LOOKUP = new Map();
const PHRASE_SYNONYMS = [];

for (const [reference, variants] of Object.entries(SYNONYMS)) {
  SYNONYM_LOOKUP.set(reference, reference);

  for (const variant of variants) {
    if (variant.includes(" ")) {
      PHRASE_SYNONYMS.push([variant, reference]);
    } else {
      SYNONYM_LOOKUP.set(variant, reference);
    }
  }
}

const WORD_EXCEPTIONS = new Set([
  "apres", "assez", "avis", "bras", "choix", "corps",
  "cours", "croix", "fois", "frais", "gris", "jamais",
  "mais", "mois", "pays", "prix", "progres", "sens",
  "souris", "temps", "tous", "vers", "voix"
]);

export function normalizeText(value = "") {
  return String(value)
    .toLocaleLowerCase("fr")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[’']/g, " ")
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/-/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeWord(word) {
  if (!word || word.length <= 3) return word;

  if (SYNONYM_LOOKUP.has(word)) {
    return SYNONYM_LOOKUP.get(word);
  }

  if (WORD_EXCEPTIONS.has(word)) {
    return word;
  }

  if (word.length > 4 && word.endsWith("aux")) {
    return word.slice(0, -3) + "al";
  }

  if (word.length > 4 && word.endsWith("eaux")) {
    return word.slice(0, -1);
  }

  if (word.length > 4 && word.endsWith("s")) {
    return word.slice(0, -1);
  }

  return word;
}

function normalizePhrases(value) {
  let text = normalizeText(value);

  for (const [variant, reference] of PHRASE_SYNONYMS) {
    const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    text = text.replace(
      new RegExp(`\\b${escaped}\\b`, "g"),
      reference
    );
  }

  return text;
}

export function tokenize(value = "") {
  return normalizePhrases(value)
    .split(" ")
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .map(normalizeWord);
}

// Analyse grammaticale complémentaire avec Compromise.
function getSemanticTokens(value) {
  if (
    typeof window === "undefined" ||
    typeof window.frCompromise !== "function"
  ) {
    return new Set();
  }

  try {
    const sentences = window.frCompromise(value).json();
    const semanticTokens = new Set();

    for (const sentence of sentences) {
      for (const term of sentence.terms || []) {
        const tags = term.tags || [];

        const isSemantic = tags.some(tag =>
          ["Noun", "Verb", "Adjective", "Adverb"].includes(tag)
        );

        if (!isSemantic) continue;

        const word = normalizeWord(
          normalizeText(term.normal || term.text)
        );

        if (word && word.length > 1) {
          semanticTokens.add(word);
        }
      }
    }

    return semanticTokens;

  } catch (error) {
    console.warn("Analyse linguistique indisponible :", error);
    return new Set();
  }
}

// Distance de Levenshtein.
function levenshtein(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 3;

  const previous = Array.from(
    { length: b.length + 1 },
    (_, i) => i
  );

  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;

    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];

      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );

      diagonal = above;
    }
  }

  return previous[b.length];
}

// Reconnaissance d'une inversion de deux lettres voisines.
function hasAdjacentTransposition(a, b) {
  if (a.length !== b.length) return false;

  const differences = [];

  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) differences.push(i);
  }

  if (differences.length !== 2) return false;

  const [first, second] = differences;

  return (
    second === first + 1 &&
    a[first] === b[second] &&
    a[second] === b[first]
  );
}

function wordsMatch(a, b) {
  if (a === b) return true;

  if (a.length < 5 || b.length < 5) return false;

  if (hasAdjacentTransposition(a, b)) return true;

  const distance = levenshtein(a, b);

  if (Math.max(a.length, b.length) >= 9) {
    return distance <= 2;
  }

  return distance <= 1;
}

function tokenMatches(token, candidates) {
  return candidates.some(candidate =>
    wordsMatch(token, candidate)
  );
}

export function detectIntent(question, intents = []) {
  const normalizedQuestion = normalizeText(question);
  const questionTokens = tokenize(question);
  const semanticTokens = getSemanticTokens(question);
  const scores = [];

  for (const intent of intents) {
    let score = 0;
    const matched = [];
    const processedKeywords = new Set();

    for (const rawKeyword of intent.keywords || []) {
      const keyword = normalizeText(rawKeyword);
      if (!keyword) continue;

      const keywordTokens = tokenize(keyword);

      if (
        keyword.includes(" ") &&
        normalizedQuestion.includes(keyword)
      ) {
        score += 5;
        matched.push(rawKeyword);
        continue;
      }

      if (!keywordTokens.length) continue;

      const keywordKey = keywordTokens.join(" ");
      if (processedKeywords.has(keywordKey)) continue;
      processedKeywords.add(keywordKey);

      if (keywordTokens.length === 1) {
        const matchingToken = questionTokens.find(token =>
          wordsMatch(token, keywordTokens[0])
        );

        if (matchingToken) {
          score += semanticTokens.has(matchingToken) ? 3 : 2.5;
          matched.push(rawKeyword);
        }
        continue;
      }

      if (
        keywordTokens.every(keywordToken =>
          tokenMatches(keywordToken, questionTokens)
        )
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

  const suggestions = scores.slice(0, 3).map(item => ({
    id: item.intent.id,
    label: item.intent.label,
    score: item.score
  }));

  if (!scores.length || scores[0].score < 2.5) {
    return {
      intent: null,
      ambiguous: [],
      suggestions,
      score: scores[0]?.score || 0
    };
  }

  const best = scores[0];
  const second = scores[1];

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
      suggestions,
      score: best.score
    };
  }

  return {
    intent: best.intent,
    ambiguous: [],
    suggestions,
    score: best.score,
    matched: best.matched
  };
}
