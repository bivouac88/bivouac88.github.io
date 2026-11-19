
import { detectIntent, normalizeText } from "./intent.js";
import { pickAnswer } from "./knowledge.js";
import {
  getPersonalityAnswer,
  personalizeIntentAnswer
} from "./personality.js";

export function createEngine(knowledge) {
  let fallbackIndex = 0;

  const history = [];
  const recentTopics = [];

  let currentIntent = null;

  const MAX_HISTORY = 24;
  const MAX_TOPICS = 8;

  const conversationalIntents = new Set([
    "greeting",
    "politeness",
    "identity",
    "help",
    "smalltalk"
  ]);

  // --------------------------------------------------
  // MÉMOIRE DES ÉCHANGES
  // --------------------------------------------------

  function remember(role, text, intentId = null) {
    history.push({
      role,
      text,
      intentId,
      topicId: currentIntent?.id || null,
      timestamp: Date.now()
    });

    if (history.length > MAX_HISTORY) {
      history.shift();
    }
  }

  // --------------------------------------------------
  // DONNÉES DYNAMIQUES DU VOYAGE
  // --------------------------------------------------

  function getLiveDataAnswer(question) {
    const text = normalizeText(question);
    const data = knowledge.liveData || {};

    const answers = [
      {
        patterns: [
          /ou sommes nous/,
          /quelle est notre region/,
          /dans quelle region sommes nous/,
          /ou est ce qu on se trouve/
        ],
        key: "region_actuelle",
        label: "Nous sommes actuellement dans la région suivante :"
      },
      {
        patterns: [
          /dans quel pays sommes nous/,
          /quel pays traversons nous/,
          /quel est le pays actuel/
        ],
        key: "pays_actuel",
        label: "Nous sommes actuellement en"
      },
      {
        patterns: [
          /combien de kilometres/,
          /combien de km/,
          /quelle distance avons nous parcouru/
        ],
        key: "km_total_parcouru",
        label: "Nous avons parcouru"
      },
      {
        patterns: [
          /quel jour sommes nous/,
          /combien de jours/,
          /jour du voyage/
        ],
        key: "jour_actuel",
        label: "Nous sommes au jour"
      },
      {
        patterns: [
          /quelle est la prochaine etape/,
          /ou allons nous ensuite/,
          /quelle est notre prochaine destination/
        ],
        key: "prochaine_etape",
        label: "Notre prochaine étape est :"
      }
    ];

    const match = answers.find(item =>
      item.patterns.some(pattern => pattern.test(text))
    );

    if (!match) return null;

    const value = data[match.key];

    if (value === undefined || value === null || value === "") {
      return "Je n'ai pas encore cette information dans mes données de voyage.";
    }

    return `${match.label} ${value}.`;
  }
  
  // --------------------------------------------------
  // GESTION DES INTENTIONS
  // --------------------------------------------------

  function getIntent(intentId) {
    return (knowledge.intents || []).find(
      item => item.id === intentId
    ) || null;
  }

  function getRelatedIntents(intent) {
    if (!intent?.related) return [];

    return intent.related.filter(id => getIntent(id));
  }

  function rememberTopic(intent) {
    if (!intent || conversationalIntents.has(intent.id)) {
      return;
    }

    currentIntent = intent;

    const existingIndex = recentTopics.findIndex(
      topic => topic.id === intent.id
    );

    if (existingIndex !== -1) {
      recentTopics.splice(existingIndex, 1);
    }

    recentTopics.unshift({
      id: intent.id,
      label: intent.label,
      timestamp: Date.now()
    });

    if (recentTopics.length > MAX_TOPICS) {
      recentTopics.pop();
    }
  }

  function buildAnswer(intent, question = "") {
    rememberTopic(intent);

    const originalAnswer = pickAnswer(intent);

    return {
      type: "answer",
      intentId: intent.id,
      intentLabel: intent.label,
      text: personalizeIntentAnswer(
        intent.id,
        originalAnswer,
        question
      ),
      action: intent.action || null,
      related: getRelatedIntents(intent),
      links: intent.links || []
    };
  }

  // --------------------------------------------------
  // RECONNAISSANCE DES RELANCES
  // --------------------------------------------------

  function isFollowUp(question) {
    const text = normalizeText(question);

    const patterns = [
      /^(et|mais|alors|du coup)\b/,
      /^(combien|pourquoi|comment|ou|quand|quel|quelle|quels|quelles)\b/,
      /^(ca|cela|ceci|cette|cet|ces|celui|celle|ceux|celles)\b/,
      /^(la bas|ici|ensuite|apres|concernant)\b/,
      /^(tu peux|peux tu|est ce que tu peux)\b/,
      /\b(en dire plus|davantage|plus de details)\b/,
      /\b(ca coute|quel prix|combien ca)\b/,
      /\b(son prix|sa distance|ses dimensions|son fonctionnement)\b/
    ];

    return patterns.some(pattern => pattern.test(text));
  }

  // --------------------------------------------------
  // RETROUVER LE SUJET PERTINENT
  // --------------------------------------------------

  function resolveContext(question) {
    if (!recentTopics.length) return null;

    const text = normalizeText(question);

    if (
      /\b(sujet precedent|ce dont on parlait avant|revenons a|retournons a)\b/.test(text)
    ) {
      return recentTopics[1]
        ? getIntent(recentTopics[1].id)
        : currentIntent;
    }

    if (
      /\b(l autre|un autre sujet|celui d avant|celle d avant|le precedent|la precedente)\b/.test(text)
    ) {
      return recentTopics[1]
        ? getIntent(recentTopics[1].id)
        : null;
    }

    if (/\b(les deux|tous les deux|comparer|compare)\b/.test(text)) {
      return null;
    }

    const previousUserMessages = history
      .filter(message => message.role === "user" && message.intentId)
      .slice()
      .reverse();

    for (const message of previousUserMessages) {
      const intent = getIntent(message.intentId);

      if (intent && !conversationalIntents.has(intent.id)) {
        return intent;
      }
    }

    return currentIntent || getIntent(recentTopics[0].id);
  }

  // --------------------------------------------------
  // RÉPONSES CONTEXTUELLES
  // --------------------------------------------------

  function contextualFallback(intent) {
    if (!intent) {
      return fallback();
    }

    return {
      type: "contextual",
      intentId: intent.id,
      intentLabel: intent.label,
      text:
        `On parlait de ${intent.label.toLowerCase()}. ` +
        "Je garde le fil de notre conversation, mais je n'ai pas encore " +
        "l'information précise que tu demandes. Tu peux préciser ?",
      related: getRelatedIntents(intent)
    };
  }

  function fallback(score = 0, suggestions = []) {
    const lowConfidence = knowledge.assistant?.lowConfidence;

    let text;

    if (score > 0 && lowConfidence) {
      text = lowConfidence;
    } else {
      const fallbacks = knowledge.assistant?.fallback || [
        "Je ne sais pas encore répondre à ça."
      ];

      text = fallbacks[fallbackIndex % fallbacks.length];
      fallbackIndex++;
    }

    return {
      type: "fallback",
      text,
      confidence: score,
      related: suggestions
        .map(item => item.id)
        .filter(id => getIntent(id))
    };
  }

  // --------------------------------------------------
  // TRAITEMENT DES MESSAGES
  // --------------------------------------------------

  function saveExchange(result) {
    remember("assistant", result.text, result.intentId || null);
  }

  function ask(question) {
    const cleanQuestion = String(question || "").trim();

    if (!cleanQuestion) {
      return {
        type: "empty",
        text: "Écris-moi une question et on regarde ça."
      };
    }

    const liveDataAnswer = getLiveDataAnswer(cleanQuestion);

    if (liveDataAnswer) {
      const response = {
        type: "liveData",
        text: liveDataAnswer
      };

      remember("user", cleanQuestion);
      saveExchange(response);

      return response;
    }
    
    // La personnalité traite uniquement les questions qui la concernent.
    // Les autres questions continuent vers le moteur de compréhension.
    const personalityAnswer = getPersonalityAnswer(cleanQuestion);

    if (personalityAnswer) {
      remember("user", cleanQuestion, null);

      saveExchange(personalityAnswer);

      return personalityAnswer;
    }

    const result = detectIntent(
      cleanQuestion,
      knowledge.intents || []
    );

    if (result.intent) {
      rememberTopic(result.intent);
    }

    remember(
      "user",
      cleanQuestion,
      result.intent?.id || currentIntent?.id || null
    );

    let response;

    if (result.ambiguous.length) {
      response = {
        type: "clarification",
        text: "J'hésite entre plusieurs sujets. Tu peux préciser ?",
        choices: result.ambiguous
      };
    } else if (result.intent) {
      response = buildAnswer(result.intent, cleanQuestion);
    } else if (isFollowUp(cleanQuestion)) {
      const context = resolveContext(cleanQuestion);

      response = context
        ? contextualFallback(context)
        : fallback(result.score, result.suggestions || []);
    } else {
      response = fallback(
        result.score,
        result.suggestions || []
      );
    }

    saveExchange(response);

    return response;
  }

  function askIntent(intentId) {
    const intent = getIntent(intentId);

    if (!intent) {
      return fallback();
    }

    remember("user", intent.label, intent.id);

    const response = buildAnswer(intent, intent.label);
    saveExchange(response);

    return response;
  }

  // --------------------------------------------------
  // ACCÈS À LA MÉMOIRE
  // --------------------------------------------------

  function getHistory() {
    return history.map(message => ({ ...message }));
  }

  function getContext() {
    return {
      current: currentIntent
        ? {
            intentId: currentIntent.id,
            intentLabel: currentIntent.label
          }
        : null,

      recent: recentTopics.map(topic => ({ ...topic }))
    };
  }

  return {
    ask,
    askIntent,
    getIntent,
    getHistory,
    getContext
  };
}
