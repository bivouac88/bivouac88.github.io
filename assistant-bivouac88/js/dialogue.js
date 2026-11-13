
import { loadKnowledge } from "./knowledge.js";
import { createEngine } from "./engine.js";

const character = document.getElementById("b88-character");

if (!character) {
  console.warn("Le Bivouaciste est introuvable.");
} else {
  initDialogue(character);
}

async function initDialogue(character) {
  let engine;

  try {
    const knowledge = await loadKnowledge();
    engine = createEngine(knowledge);
  } catch (error) {
    console.error("Erreur de chargement du dialogue :", error);
  }

  const dialogue = document.createElement("div");
  dialogue.className = "b88-dialogue";
  dialogue.innerHTML = `
    <div class="b88-dialogue-bubble" aria-live="polite">
      <button class="b88-dialogue-close" type="button" aria-label="Fermer">×</button>
      <div class="b88-dialogue-text"></div>
      <div class="b88-dialogue-choices"></div>
    </div>
    <form class="b88-dialogue-form">
      <input type="text" placeholder="Écris-moi quelque chose..." maxlength="300" aria-label="Ton message">
      <button type="submit" aria-label="Envoyer">➤</button>
    </form>
  `;

  character.appendChild(dialogue);

  const bubble = dialogue.querySelector(".b88-dialogue-bubble");
  const text = dialogue.querySelector(".b88-dialogue-text");
  const choices = dialogue.querySelector(".b88-dialogue-choices");
  const form = dialogue.querySelector(".b88-dialogue-form");
  const input = form.querySelector("input");
  const closeButton = dialogue.querySelector(".b88-dialogue-close");

  let opened = false;
  let greetingTimer;

  dialogue.addEventListener("click", event => event.stopPropagation());

  function showBubble(message) {
    text.textContent = message;
    bubble.classList.add("visible");
  }

  function hideDialogue() {
    opened = false;
    dialogue.classList.remove("active");
    bubble.classList.remove("visible");
    choices.replaceChildren();
  }

  function openDialogue() {
    opened = true;
    dialogue.classList.add("active");
    choices.replaceChildren();

    if (!engine) {
      showBubble("Oups... Mon cerveau est encore dans mes sacoches. Réessaie dans un instant !");
    } else {
      showBubble("Salut voyageur ! Qu'est-ce que tu aimerais savoir ?");
    }

    input.focus();
  }

  function addChoice(label, callback) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "b88-dialogue-choice";
    button.textContent = label;

    button.addEventListener("click", () => {
      choices.replaceChildren();
      callback();
    });

    choices.appendChild(button);
  }

  function displayResult(result) {
    if (!result) return;

    showBubble(result.text || "Je n'ai pas de réponse pour le moment.");
    choices.replaceChildren();

    if (result.type === "clarification" && Array.isArray(result.choices)) {
      result.choices.forEach(choice => {
        addChoice(choice.label || choice.id, () => {
          displayResult(engine.askIntent(choice.id));
        });
      });
    }

    if (Array.isArray(result.related)) {
      result.related.forEach(id => {
        const intent = engine.getIntent(id);

        if (intent) {
          addChoice(intent.label, () => {
            displayResult(engine.askIntent(id));
          });
        }
      });
    }

    if (Array.isArray(result.links)) {
      result.links.forEach(link => {
        if (!link.url) return;

        const anchor = document.createElement("a");
        anchor.className = "b88-dialogue-link";
        anchor.href = link.url;
        anchor.textContent = link.label || "En savoir plus";
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";

        choices.appendChild(anchor);
      });
    }

    if (result.action === "tour") {
      addChoice("Découvrir le site", () => {
        document.dispatchEvent(new CustomEvent("b88:start-tour"));
      });
    }
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    input.value = "";

    if (!engine) {
      showBubble("Je n'arrive pas encore à réfléchir. Réessaie un peu plus tard !");
      return;
    }

    displayResult(engine.ask(question));
  });

  closeButton.addEventListener("click", hideDialogue);

  document.addEventListener("b88:character-click", () => {
    clearTimeout(greetingTimer);

    if (opened) {
      hideDialogue();
    } else {
      openDialogue();
    }
  });

  // Première apparition : petit message d'accueil
  greetingTimer = setTimeout(() => {
    if (!opened) {
      showBubble("Oh, salut ! Bienvenue sur les chemins de Bivouac88.");
      setTimeout(() => {
        if (!opened) bubble.classList.remove("visible");
      }, 5000);
    }
  }, 2500);
}
