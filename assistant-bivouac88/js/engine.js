
import { detectIntent, normalizeText } from "./intent.js";
import { pickAnswer } from "./knowledge.js";

export function createEngine(knowledge) {
  let fallbackIndex = 0;

  // Mémoire de la conversation : conservée tant que le moteur existe.
  const history = [];
  let currentIntent = null;

  // Les échanges conversationnels ne remplacent pas le sujet discuté.
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

    // On conserve les 24 derniers messages.
    if (history.length > 24) {
      history.shift();
    }
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
      related: intent.related || [],
      links: intent.links || []
    };
  }

  function fallback(score = 0) {
    const fallbacks = knowledge.assistant?.fallback || [
      "Je ne sais pas encore répondre à ça."
    ];

    const text = fallbacks[fallbackIndex % fallbacks.length];
    fallbackIndex++;

    return {
      type: "fallback",
      text,
      confidence: score
    };
  }

  // Repère les formulations qui dépendent probablement
  // d'un échange précédent.
  function isFollowUp(question) {
    const text = normalizeText(question);

    return /^(et |mais |alors |du coup |combien|pourquoi|comment|ou |quand|quel |quelle |quels |quelles |celui |celle |ceux |celles |la bas|ici |ensuite|ca |cela )/.test(text);
  }

  function contextualFallback() {
    const label = currentIntent.label.toLowerCase();

    return {
      type: "contextual",
      intentId: currentIntent.id,
      intentLabel: currentIntent.label,
      text:
        `Je garde en tête qu'on parlait de ${label}. ` +
        `Je n'ai pas encore assez d'informations pour répondre précisément. ` +
        `Tu peux préciser ce que tu souhaites savoir à ce sujet ?`
    };
  }

  function saveExchange(question, result) {
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
        text: "Je vois plusieurs possibilités. Tu parles de quoi exactement ?",
        choices: result.ambiguous
      };
    } else if (result.intent) {
      response = buildAnswer(result.intent);
    } else if (currentIntent && isFollowUp(cleanQuestion)) {
      response = contextualFallback();
    } else {
      response = fallback(result.score);
    }

    saveExchange(cleanQuestion, response);

    return response;
  }

  function askIntent(intentId) {
    const intent = getIntent(intentId);

    if (!intent) {
      return fallback();
    }

    remember("user", intent.label, intent.id);

    const response = buildAnswer(intent);
    saveExchange(intent.label, response);

    return response;
  }

  function getIntent(intentId) {
    return (knowledge.intents || []).find(
      item => item.id === intentId
    ) || null;
  }

  // Accès à la mémoire pour les évolutions futures.
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
