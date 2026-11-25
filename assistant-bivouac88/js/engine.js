import { detectIntent, normalizeText } from "./intent.js";
import { pickAnswer } from "./knowledge.js";
import {
  getPersonalityAnswer,
  personalizeIntentAnswer,
  getWelcomeMessage as defaultWelcomeMessage
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

  function getTripDataAnswer(question) {
    const text = normalizeText(question);
    const trip = knowledge.tripData;

    if (!trip || !trip.totaux || !Array.isArray(trip.etapes)) {
      return null;
    }

    const t = trip.totaux;
    const etapes = trip.etapes;
    const fmt = n => Number(n || 0).toLocaleString("fr-FR");

    // Prochaine étape
    if (
      text.includes("prochaine etape") ||
      text.includes("etape suivante") ||
      text.includes("ou allons nous ensuite")
    ) {
      const e = etapes.find(item => !item.fait);

      if (!e) return "Toutes les étapes sont terminées !";

      return `La prochaine étape est l'étape ${e.jour} : ${e.depart} vers ${e.arrivee}, ${fmt(e.km)} km et ${fmt(e.denivele)} m de dénivelé.`;
    }

    // Détails d'une étape précise
    const numero = text.match(/\betape\s+(\d+)\b/);

    if (numero) {
      const e = etapes.find(item => Number(item.jour) === Number(numero[1]));

      if (e) {
        return `Étape ${e.jour} : ${e.depart} vers ${e.arrivee}, ${fmt(e.km)} km, ${fmt(e.denivele)} m de dénivelé. ${e.fait ? "Cette étape est réalisée." : "Cette étape est à venir."}`;
      }
    }

    // Totaux du voyage
    if (
      text.includes("kilometres parcourus") ||
      text.includes("km parcourus") ||
      text.includes("distance parcourue")
    ) {
      return `Nous avons parcouru ${fmt(t.km_faits)} km sur ${fmt(t.km_total)} km prévus.`;
    }

    if (
      text.includes("kilometres restants") ||
      text.includes("km restants") ||
      text.includes("distance restante")
    ) {
      return `Il reste ${fmt(t.km_restants)} km à parcourir.`;
    }

    if (
      text.includes("denivele") &&
      (text.includes("parcouru") || text.includes("fait") || text.includes("total"))
    ) {
      return `Le dénivelé réalisé est de ${fmt(t.denivele_fait)} m sur ${fmt(t.denivele_total)} m prévus.`;
    }

    if (
      text.includes("avancement") ||
      text.includes("pourcentage du voyage") ||
      text.includes("progression du voyage")
    ) {
      return `Le voyage est réalisé à ${fmt(t.avancement)} %.`;
    }

    if (
      text.includes("combien d etapes") ||
      text.includes("nombre d etapes") ||
      text.includes("etapes realisees")
    ) {
      return `${fmt(t.jours_faits)} étapes réalisées sur ${fmt(t.jours)} au total.`;
    }

    return null;
  }

  // --------------------------------------------------
  // MESSAGES SPÉCIFIQUES À LA PAGE COURANTE
  // --------------------------------------------------

  function currentPageKey() {
    return (
      (typeof document !== "undefined" && document.body?.dataset?.page) ||
      ""
    );
  }

  function liveDataValue(key) {
    const data = knowledge.liveData || {};
    const customResponse = data._responses?.[key];

    if (customResponse) return customResponse;

    const value = data[key];

    if (value === undefined || value === null || value === "") {
      return null;
    }

    return value;
  }

  function getPageWelcomeMessage() {
    const page = currentPageKey();
    if (!page) return null;

    return liveDataValue(`message_ouverture_${page}`);
  }

  function getPageDescriptionAnswer(question) {
    const text = normalizeText(question);

    const asksAboutPage =
      /\b(cette page|cette rubrique|cet onglet)\b/.test(text) &&
      /\b(c est quoi|qu est ce que|ca sert a quoi|a quoi sert|c est quoi ca)\b/.test(text);

    if (!asksAboutPage) return null;

    const page = currentPageKey();
    if (!page) return null;

    const description = liveDataValue(`description_page_${page}`);
    if (!description) return null;

    return {
      type: "pageDescription",
      text: description
    };
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
    if (
      !intent ||
      conversationalIntents.has(intent.id) ||
      intent.conversational // <-- changé : ignore aussi les clés "conversational" du sheet
    ) {
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

      if (
        intent &&
        !conversationalIntents.has(intent.id) &&
        !intent.conversational // <-- changé : même logique ici
      ) {
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

    const pageDescriptionAnswer = getPageDescriptionAnswer(cleanQuestion);

    if (pageDescriptionAnswer) {
      remember("user", cleanQuestion);
      saveExchange(pageDescriptionAnswer);

      return pageDescriptionAnswer;
    }

    const tripDataAnswer = getTripDataAnswer(cleanQuestion);

    if (tripDataAnswer) {
      const response = {
        type: "tripData",
        text: tripDataAnswer
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

  function getWelcomeMessage() {
    return getPageWelcomeMessage() || defaultWelcomeMessage();
  }

  return {
    ask,
    askIntent,
    getIntent,
    getHistory,
    getContext,
    getWelcomeMessage
  };
}
