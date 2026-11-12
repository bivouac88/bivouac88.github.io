import { detectIntent } from "./intent.js";
import { pickAnswer } from "./knowledge.js";

export function createEngine(knowledge) {
  let fallbackIndex = 0;

  return {
    ask(question) {
      const cleanQuestion = String(question || "").trim();
      if (!cleanQuestion) {
        return { type: "empty", text: "Écris-moi une question et on regarde ça." };
      }

      const result = detectIntent(cleanQuestion, knowledge.intents || []);
      if (!result.intent) {
        const fallbacks = knowledge.assistant?.fallback || ["Je ne sais pas encore répondre à ça."];
        const text = fallbacks[fallbackIndex % fallbacks.length];
        fallbackIndex += 1;
        return { type: "fallback", text, confidence: result.score };
      }

      return {
        type: "answer",
        intentId: result.intent.id,
        intentLabel: result.intent.label,
        text: pickAnswer(result.intent),
        action: result.intent.action || null,
        related: result.intent.related || [],
        confidence: result.score
      };
    }
  };
}
