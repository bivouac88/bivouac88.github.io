
// intent.js — compréhension linguistique globale du Bivouaciste

const STOP_WORDS = new Set([
  "a", "au", "aux", "avec", "ce", "ces", "cette", "dans",
  "de", "des", "du", "elle", "elles", "en", "est", "et",
  "eux", "il", "ils", "je", "la", "le", "les", "leur",
  "leurs", "lui", "ma", "mais", "me", "mes", "moi", "mon",
  "ne", "nos", "notre", "nous", "on", "ou", "par", "pour",
  "que", "qui", "quoi", "sa", "se", "ses", "son", "sur",
  "ta", "te", "tes", "toi", "ton", "tu", "un", "une",
  "vos", "votre", "vous", "y", "dans", "donc", "car"
]);

// Synonymes communs à toutes les intentions.
// Chaque variante est ramenée vers une forme de référence.
const SYNONYMS = {
  velo: [
    "bicyclette", "becane", "biclou", "deux roues",
    "deuxroues", "cycle"
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
    "d+", "elevation"
  ],
  aide: [
    "assistance", "support"
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

for (const [reference, variants] of Object.entries(SYNONYMS)) {
  SYNONYM_LOOKUP.set(reference, reference);

  for (const variant of variants) {
    SYNONYM_LOOKUP.set(variant, reference);
  }
}

// Quelques mots qui ne doivent pas être déformés
// par la simplification des pluriels.
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

  // Pluriels français réguliers.
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

export function tokenize(value = "") {
  return normalizeText(value)
    .split(" ")
    .filter(word => word.length > 1 && !STOP_WORDS.has(word))
    .map(normalizeWord);
}

// Distance de Levenshtein : mesure les différences entre deux mots.
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

// Tolérance aux petites fautes de frappe.
// Les mots courts sont volontairement exclus.
function wordsMatch(a, b) {
  if (a === b) return true;

  if (a.length < 5 || b.length < 5) return false;

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

  const scores = [];

  for (const intent of intents) {
    let score = 0;
    const matched = [];

    for (const rawKeyword of intent.keywords || []) {
      const keyword = normalizeText(rawKeyword);
      if (!keyword) continue;

      const keywordTokens = tokenize(keyword);

      // Expression complète reconnue.
      if (
        keyword.includes(" ") &&
        normalizedQuestion.includes(keyword)
      ) {
        score += 5;
        matched.push(rawKeyword);
        continue;
      }

      if (!keywordTokens.length) continue;

      // Correspondance d'un mot.
      if (keywordTokens.length === 1) {
        if (
          questionTokens.some(token =>
            wordsMatch(token, keywordTokens[0])
          )
        ) {
          score += 2.5;
          matched.push(rawKeyword);
        }

        continue;
      }

      // Expression composée : tous les mots doivent correspondre.
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
