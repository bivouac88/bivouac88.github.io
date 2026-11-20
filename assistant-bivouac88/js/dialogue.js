import { loadKnowledge } from "./knowledge.js";
import { createEngine } from "./engine.js";

function loadCompromise() {
  if (typeof window.frCompromise === "function") return;

  const script = document.createElement("script");

  script.src = new URL(
    "../bibliotheques/compromise/fr-compromise.min.js",
    import.meta.url
  ).href;

  script.onload = () => {
    if (typeof window.frCompromise === "function") {
      console.info("[Niamh] Compromise chargé.");
    } else {
      console.warn("[Niamh] Compromise non disponible.");
    }
  };

  script.onerror = () => {
    console.warn("[Niamh] Impossible de charger Compromise.");
  };

  document.head.appendChild(script);
}

loadCompromise();

const character = document.getElementById("b88-character");

if (!character) {
  console.warn("Le personnage est introuvable.");
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

  document.body.appendChild(dialogue);
  document.dispatchEvent(new CustomEvent("b88:dialogue-ready"));

  const bubble = dialogue.querySelector(".b88-dialogue-bubble");
  const text = dialogue.querySelector(".b88-dialogue-text");
  const choices = dialogue.querySelector(".b88-dialogue-choices");
  const form = dialogue.querySelector(".b88-dialogue-form");
  const input = form.querySelector("input");
  const closeButton = dialogue.querySelector(".b88-dialogue-close");

  let opened = false;

  dialogue.addEventListener("click", event => {
    event.stopPropagation();
  });

  // --- Positionnement dynamique sur le personnage ---

  let dialogueSide = "top"; // top = bulle au-dessus de l'avatar (comportement d'origine)

  document.addEventListener("b88:dialogue-side", (event) => {
    dialogueSide = event.detail?.side || "top";
    bubble.classList.remove("tail-top", "tail-bottom", "tail-left", "tail-right");
    bubble.classList.add(
      dialogueSide === "top" ? "tail-bottom" :
      dialogueSide === "bottom" ? "tail-top" :
      dialogueSide === "left" ? "tail-right" :
      "tail-left"
    );
  });
  // Classe par défaut au démarrage (bulle au-dessus, pointe en bas)
  bubble.classList.add("tail-bottom");

  function updateDialoguePosition() {
    const bounds = window.characterGetScreenBounds?.();

    if (bounds) {
      const gap = 14;
      const margin = 10;
      const dialogueWidth = dialogue.offsetWidth;
      const bubbleHeight = bubble.offsetHeight;
      const formHeight = form.offsetHeight;

      let bubbleLeft, bubbleTop, formLeft, formTop;

      if (dialogueSide === "top") {
        bubbleLeft = (bounds.left + bounds.right) / 2 - dialogueWidth / 2;
        bubbleTop = bounds.top - bubbleHeight - gap;
        formLeft = bubbleLeft;
        formTop = bounds.bottom + gap;
      } else if (dialogueSide === "bottom") {
        bubbleLeft = (bounds.left + bounds.right) / 2 - dialogueWidth / 2;
        bubbleTop = bounds.bottom + gap;
        formLeft = bubbleLeft;
        formTop = bounds.top - formHeight - gap;
      } else if (dialogueSide === "left") {
        bubbleLeft = bounds.left - dialogueWidth - gap;
        bubbleTop = (bounds.top + bounds.bottom) / 2 - bubbleHeight / 2;
        formLeft = bubbleLeft;
        formTop = bubbleTop + bubbleHeight + 8;
      } else {
        // "right"
        bubbleLeft = bounds.right + gap;
        bubbleTop = (bounds.top + bounds.bottom) / 2 - bubbleHeight / 2;
        formLeft = bubbleLeft;
        formTop = bubbleTop + bubbleHeight + 8;
      }

      bubbleLeft = Math.max(margin, Math.min(bubbleLeft, window.innerWidth - dialogueWidth - margin));
      formLeft = Math.max(margin, Math.min(formLeft, window.innerWidth - dialogueWidth - margin));

      bubble.style.width = `${dialogueWidth}px`;
      bubble.style.left = `${bubbleLeft}px`;
      bubble.style.top = `${bubbleTop}px`;

      form.style.width = `${dialogueWidth}px`;
      form.style.left = `${formLeft}px`;
      form.style.top = `${formTop}px`;
    }

    requestAnimationFrame(updateDialoguePosition);
  }

  updateDialoguePosition();

  // --- Affichage des messages ---

  function showBubble(message) {
    text.textContent = message;
    dialogue.classList.add("active");
    bubble.classList.add("visible");
  }

  function hideDialogue() {
    opened = false;
    dialogue.classList.remove("active");
    bubble.classList.remove("visible");
    choices.replaceChildren();

    setTimeout(() => {
      document.dispatchEvent(new CustomEvent("b88:dialogue-close"));
    }, 0);
  }

  function openDialogue() {
    opened = true;
    dialogue.classList.add("active");
    choices.replaceChildren();

    if (!engine) {
      showBubble(
        "Oups... Mon cerveau est encore dans mes sacoches. Réessaie dans un instant !"
      );
    } else {
      showBubble(engine.getWelcomeMessage());
    }

    input.focus();
  }

  // --- Boutons de choix ---

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

  // --- Traitement des réponses ---

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

  // --- Envoi des messages ---

  form.addEventListener("submit", event => {
    event.preventDefault();

    const question = input.value.trim();
    if (!question) return;

    input.value = "";

    if (!engine) {
      showBubble(
        "Je n'arrive pas encore à réfléchir. Réessaie un peu plus tard !"
      );
      return;
    }

    displayResult(engine.ask(question));
  });

  // --- Fermeture et ouverture ---

  closeButton.addEventListener("click", hideDialogue);

  document.addEventListener("b88:character-click", () => {
    if (opened) {
      hideDialogue();
    } else {
      openDialogue();
    }
  });
}
