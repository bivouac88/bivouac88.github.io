
import { loadKnowledge } from "./knowledge.js";
import { createEngine } from "./engine.js";
import { createTour } from "./tour.js";

const messages = document.querySelector("#messages");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#question");
const suggestions = document.querySelector("#suggestions");
const tourStatus = document.querySelector("#tour-status");

let tour;
let engine;

function addMessage(text, sender = "bot", result = null) {
  const article = document.createElement("article");
  article.className = `message ${sender}`;

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(paragraph);

  if (result?.action?.type === "tour") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-action";
    button.textContent = result.action.label || "Lancer la visite";
    button.addEventListener("click", () => tour.start());
    article.append(button);
  }

  // Suggestions de sujets associés.
  if (result?.related?.length) {
    const relatedBox = document.createElement("div");
    relatedBox.className = "related-topics";

    const label = document.createElement("small");
    label.textContent = "Pour continuer :";
    relatedBox.append(label);

    result.related.forEach(intentId => {
      const intent = engine.getIntent(intentId);
      if (!intent) return;

      relatedBox.append(createIntentButton(intent.id, intent.label));
    });

    article.append(relatedBox);
  }

  // Choix proposés lorsque la question est ambiguë.
  if (result?.type === "clarification") {
    const choicesBox = document.createElement("div");
    choicesBox.className = "related-topics";

    result.choices.forEach(choice => {
      choicesBox.append(
        createIntentButton(choice.id, choice.label)
      );
    });

    article.append(choicesBox);
  }

  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function createIntentButton(id, label) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "related-button";
  button.dataset.intent = id;
  button.textContent = label;
  return button;
}

function displayResult(result) {
  addMessage(result.text, "bot", result);
}

function ask(question) {
  addMessage(question, "user");
  displayResult(engine.ask(question));
}

function askIntent(intentId) {
  const intent = engine.getIntent(intentId);
  if (!intent) return;

  addMessage(intent.label, "user");
  displayResult(engine.askIntent(intentId));
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const question = input.value.trim();
  if (!question || !engine) return;

  ask(question);

  input.value = "";
  input.focus();
});

suggestions.addEventListener("click", event => {
  const button = event.target.closest("[data-question]");
  if (!button || !engine) return;

  ask(button.dataset.question);
});

messages.addEventListener("click", event => {
  const button = event.target.closest("[data-intent]");
  if (!button || !engine) return;

  askIntent(button.dataset.intent);
});

tour = createTour({
  steps: [
    {
      title: "Le parcours",
      text: "Cette étape présentera la carte et le tracé du voyage.",
      target: '[data-bivouac-tour="parcours"]'
    },
    {
      title: "Les étapes",
      text: "Ici, le visiteur pourra consulter les journées de route et la progression.",
      target: '[data-bivouac-tour="etapes"]'
    },
    {
      title: "Les photos",
      text: "Cette zone mettra en avant les photos et les moments du voyage.",
      target: '[data-bivouac-tour="photos"]'
    }
  ],

  onUpdate(state) {
    if (state.message) {
      tourStatus.textContent = state.message;
      return;
    }

    if (!state.active) {
      tourStatus.textContent = "Visite terminée ou fermée.";
      return;
    }

    const targetInfo = state.targetExists
      ? " Élément cible détecté."
      : " Élément cible absent : normal dans cette page de test.";

    tourStatus.textContent =
      `Étape ${state.index + 1}/${state.total} — ` +
      `${state.step.title}. ${state.step.text}${targetInfo}`;
  }
});

document.querySelector("#tour-preview").addEventListener("click", () => {
  tour.start();

  let controls = document.querySelector(".tour-controls");

  if (!controls) {
    controls = document.createElement("div");
    controls.className = "tour-controls";

    controls.innerHTML = `
      <button type="button" data-tour-prev>Précédent</button>
      <button type="button" data-tour-next>Suivant</button>
      <button type="button" data-tour-stop>Quitter</button>
    `;

    tourStatus.append(controls);

    controls.addEventListener("click", event => {
      if (event.target.matches("[data-tour-prev]")) tour.previous();
      if (event.target.matches("[data-tour-next]")) tour.next();

      if (event.target.matches("[data-tour-stop]")) {
        tour.stop();
        controls.remove();
      }
    });
  }
});

try {
  const knowledge = await loadKnowledge();
  engine = createEngine(knowledge);

} catch (error) {
  console.error(error);

  addMessage(
    "Impossible de charger ma base de connaissances. Vérifie les fichiers et leur chemin.",
    "bot"
  );

  form.querySelector("button").disabled = true;
}
