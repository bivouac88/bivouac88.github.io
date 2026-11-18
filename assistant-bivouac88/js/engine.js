
import { detectIntent, normalizeText } from "./intent.js";
import { pickAnswer } from "./knowledge.js";

export function createEngine(knowledge) {
  let fallbackIndex = 0;

  const history = [];
  let currentIntent = null;

  const conversationalIntents = new Set([
    "greeting",
    "politeness",
    "identity",
    "help",
    "smalltalk"
  ]);

  function remember(role, text, intentId = null) {
    history.push({
      role,
      text,
      intentId,
      timestamp: Date.now()
    });

    if (history.length > 24) {
      history.shift();
    }
  }

  function getIntent(intentId) {
    return (knowledge.intents || []).find(
      item => item.id === intentId
    ) || null;
  }

  function getRelatedIntents(intent) {
    if (!intent?.related) return [];

    return intent.related.filter(id => getIntent(id));
  }

  function buildAnswer(intent) {
    if (!conversationalIntents.has(intent.id)) {
      currentIntent = intent;
    }

    return {
      type: "answer",
      intentId: intent.id,
      intentLabel: intent.label,
      text: pickAnswer(intent),
      action: intent.action || null,
      related: getRelatedIntents(intent),
      links: intent.links || []
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


function isFollowUp(question) {
  const text = normalizeText(question);

  const followUpPatterns = [
    /^(et|mais|alors|du coup)\b/,
    /^(combien|pourquoi|comment|ou|quand|quel|quelle|quels|quelles)\b/,
    /^(ca|cela|ceci|cette|cet|ces|celui|celle|ceux|celles)\b/,
    /^(la bas|ici|ensuite|apres|concernant)\b/,
    /^(tu peux|peux tu|est ce que tu peux)\b/,
    /\b(en dire plus|davantage|plus de details)\b/,
    /\b(ca coute|quel prix|combien ca)\b/
  ];

  return followUpPatterns.some(pattern => pattern.test(text));
}

  function contextualFallback() {
    const label = currentIntent.label.toLowerCase();

    return {
      type: "contextual",
      intentId: currentIntent.id,
      intentLabel: currentIntent.label,
      text:
        `Je garde en tête qu'on parlait de ${label}. ` +
        "Je n'ai pas encore assez d'informations pour répondre précisément. " +
        "Tu peux préciser ce que tu souhaites savoir ?",
      related: getRelatedIntents(currentIntent)
    };
  }

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

    remember("user", cleanQuestion);

    const result = detectIntent(
      cleanQuestion,
      knowledge.intents || []
    );

    let response;

    if (result.ambiguous.length) {
      response = {
        type: "clarification",
        text: "J'hésite entre plusieurs sujets. Tu peux préciser ?",
        choices: result.ambiguous
      };
    } else if (result.intent) {
      response = buildAnswer(result.intent);
    } else if (currentIntent && isFollowUp(cleanQuestion)) {
      response = contextualFallback();
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

    const response = buildAnswer(intent);
    saveExchange(response);

    return response;
  }

  function getHistory() {
    return history.map(message => ({ ...message }));
  }

  function getContext() {
    return currentIntent
      ? {
          intentId: currentIntent.id,
          intentLabel: currentIntent.label
        }
      : null;
  }

  return {
    ask,
    askIntent,
    getIntent,
    getHistory,
    getContext
  };
}
