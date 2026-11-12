
import { detectIntent } from "./intent.js";
import { pickAnswer } from "./knowledge.js";

export function createEngine(knowledge) {
  let fallbackIndex = 0;

  function buildAnswer(intent) {
    return {
      type: "answer",
      intentId: intent.id,
      intentLabel: intent.label,
      text: pickAnswer(intent),
      action: intent.action || null,
      related: intent.related || []
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

  return {
    ask(question) {
      const cleanQuestion = String(question || "").trim();

      if (!cleanQuestion) {
        return {
          type: "empty",
          text: "Écris-moi une question et on regarde ça."
        };
      }

      const result = detectIntent(
        cleanQuestion,
        knowledge.intents || []
      );

      if (!result.intent) {
        return fallback(result.score);
      }

      return buildAnswer(result.intent);
    },

    askIntent(intentId) {
      const intent = (knowledge.intents || [])
        .find(item => item.id === intentId);

      if (!intent) {
        return fallback();
      }

      return buildAnswer(intent);
    },

    getIntent(intentId) {
      return (knowledge.intents || [])
        .find(item => item.id === intentId) || null;
    }
  };
}
