import { loadKnowledge } from "./knowledge.js";
import { createEngine } from "./engine.js";
import { createTour } from "./tour.js";

const messages = document.querySelector("#messages");
const form = document.querySelector("#chat-form");
const input = document.querySelector("#question");
const suggestions = document.querySelector("#suggestions");
const tourStatus = document.querySelector("#tour-status");

function addMessage(text, sender = "bot", action = null) {
  const article = document.createElement("article");
  article.className = `message ${sender}`;

  const paragraph = document.createElement("p");
  paragraph.textContent = text;
  article.append(paragraph);

  if (action?.type === "tour") {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "inline-action";
    button.textContent = action.label || "Lancer la visite";
    button.addEventListener("click", () => tour.start());
    article.append(button);
  }

  messages.append(article);
  messages.scrollTop = messages.scrollHeight;
}

function ask(engine, question) {
  addMessage(question, "user");
  const result = engine.ask(question);
  addMessage(result.text, "bot", result.action);
}

let tour;

try {
  const knowledge = await loadKnowledge();
  const engine = createEngine(knowledge);

  form.addEventListener("submit", event => {
    event.preventDefault();
    const question = input.value.trim();
    if (!question) return;
    ask(engine, question);
    input.value = "";
    input.focus();
  });

  suggestions.addEventListener("click", event => {
    const button = event.target.closest("[data-question]");
    if (!button) return;
    ask(engine, button.dataset.question);
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
        `Étape ${state.index + 1}/${state.total} — ${state.step.title}. ${state.step.text}${targetInfo}`;
    }
  });

  document.querySelector("#tour-preview").addEventListener("click", () => {
    tour.start();
    const controls = document.createElement("div");
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
  });

} catch (error) {
  console.error(error);
  addMessage("Impossible de charger ma base de connaissances. Vérifie que les fichiers sont servis depuis GitHub Pages ou un serveur local.", "bot");
  form.querySelector("button").disabled = true;
}
