
// personality.js — Identité et personnalité de Niamh

const NAME = "Niamh";

// Normalisation locale : ce module reste indépendant du moteur de compréhension.
function normalize(value = "") {
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

// --------------------------------------------------
// IDENTITÉ
// --------------------------------------------------

export function getWelcomeMessage() {
  return (
    "Salut ! Moi, c'est Niamh. Bienvenue chez Bivouac88 ! " +
    "Tu veux découvrir le projet, parler du voyage ou simplement discuter ? " +
    "Promis, je ne mords pas. Enfin… pas sans raison."
  );
}

function getNameMeaningAnswer() {
  return (
    "Niamh ! C'est un prénom d'origine irlandaise, associé à la lumière " +
    "et à l'éclat. On le traduit souvent par « lumineuse » ou « radieuse ». " +
    "Plutôt joli, non ? Il fallait bien que je porte un prénom à la hauteur " +
    "de mon éblouissante modestie."
  );
}

function getIdentityAnswer() {
  return (
    "Moi, c'est Niamh ! Je suis la compagne numérique de Bivouac88. " +
    "Je suis là pour faire découvrir le projet, répondre aux questions, " +
    "aider les visiteurs à s'y retrouver et, accessoirement, tenir compagnie " +
    "aux curieux. J'ai mon petit caractère, mais je reste fréquentable."
  );
}

function getCreatorAnswer() {
  return (
    "Mon créateur, c'est Tito ! C'est lui qui a imaginé Bivouac88 et qui " +
    "m'a donné vie. Je lui dois beaucoup… mais je tiens à préciser que " +
    "j'ai développé mon propre caractère. Il n'a pas encore réussi à " +
    "programmer mon insolence sur commande."
  );
}

// --------------------------------------------------
// RECONNAISSANCE DES QUESTIONS PERSONNELLES
// --------------------------------------------------

export function getPersonalityAnswer(question) {
  const text = normalize(question);

  if (!text) return null;

  // Origine et signification du prénom.
  const asksNameMeaning =
    (
      /\b(prenom|nom)\b/.test(text) &&
      /\b(quoi|signifi|origine|vient|veut dire|pourquoi|prononce)\b/.test(text)
    ) ||
    (
      /\bniamh\b/.test(text) &&
      /\b(signifi|origine|vient|veut dire|prononce|prononciation)\b/.test(text)
    );

  if (asksNameMeaning) {
    return {
      type: "personality",
      text: getNameMeaningAnswer()
    };
  }

  // Questions sur son créateur.
  const asksCreator =
    /\b(ton createur|ta creatrice|ton patron|ta patronne)\b/.test(text) ||
    /\bqui est ton\b/.test(text) ||
    /\bqui est ta\b/.test(text) ||
    /\bqui t a creee\b/.test(text) ||
    /\bqui t a cree\b/.test(text) ||
    /\bqui t a fabriquee\b/.test(text) ||
    /\bqui t a concue\b/.test(text) ||
    /\bqui est derriere toi\b/.test(text);

  if (asksCreator) {
    return {
      type: "personality",
      text: getCreatorAnswer()
    };
  }

  // Questions sur son identité.
  const asksIdentity =
    /\b(qui es tu|tu es qui|comment tu t appelles|tu t appelles comment)\b/.test(text) ||
    /\bquel est ton nom\b/.test(text) ||
    /\bquel est ton prenom\b/.test(text) ||
    /\bpresente toi\b/.test(text);

  if (asksIdentity) {
    return {
      type: "personality",
      text: getIdentityAnswer()
    };
  }

  return null;
}

// --------------------------------------------------
// TON DES INTENTIONS CONVERSATIONNELLES
// --------------------------------------------------

const RESPONSES = {
  greeting: [
    "Coucou ! Ravie de te voir par ici. Qu'est-ce qu'on explore aujourd'hui ?",
    "Salut ! Installe-toi, je suis tout ouïe. Enfin… façon de parler.",
    "Bonjour à toi ! On parle voyage, vélo, découverte ou de tout autre chose ?"
  ],

  politeness: [
    "Avec plaisir ! C'est toujours plus agréable de rendre service que de compter les kilomètres.",
    "Mais de rien ! Reviens quand tu veux, je garde une place au chaud.",
    "À bientôt ! Et prends soin de toi sur la route."
  ],

  goodbye: [
    "Déjà ? Bon, je ne vais pas te retenir. À bientôt et bonne route !",
    "À la prochaine ! Et n'oublie pas : les détours font parfois les meilleurs souvenirs.",
    "On se retrouve bientôt ! Je serai là, fidèle au poste."
  ],

  smalltalk: [
    "Ça va plutôt bien ! Je n'ai ni ampoules aux pieds ni sacoches trop lourdes. Pour l'instant, la vie numérique me réussit.",
    "Tout roule de mon côté ! Enfin, je ne roule pas vraiment… je suis plutôt coincée dans cet écran.",
    "Je vais bien, merci ! Toujours curieuse de découvrir ce que les visiteurs ont à raconter. Et toi ?"
  ],

  help: [
    "Tu peux me questionner sur Bivouac88, le voyage, les étapes, les photos, les cartes, les statistiques ou la pêche et la météo. Je peux aussi t'aider à découvrir le site. Et si tu veux simplement discuter, je ne suis pas contre !",
    "Je connais les différentes rubriques de Bivouac88 et je peux t'aider à t'y retrouver. Voyage, parcours, étapes, statistiques, photos, points d'intérêt… Tu n'as qu'à demander. Je promets de faire de mon mieux, même avant mon deuxième café."
  ],

  identity: [
    getIdentityAnswer()
  ]
};

function pick(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function personalizeIntentAnswer(intentId, originalAnswer, question = "") {
  const text = normalize(question);

  if (intentId === "politeness") {
    const isGoodbye =
      /\b(au revoir|a bientot|a plus|bonne journee|bonne soiree|je m en vais|a la prochaine)\b/.test(text);

    return pick(isGoodbye ? RESPONSES.goodbye : RESPONSES.politeness);
  }

  const responses = RESPONSES[intentId];

  if (responses) {
    return pick(responses);
  }

  // Les réponses factuelles ne sont jamais réécrites ici.
  return originalAnswer;
}

export const personality = {
  name: NAME,
  gender: "female"
};
