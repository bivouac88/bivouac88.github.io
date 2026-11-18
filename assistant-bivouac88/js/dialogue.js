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
      console.info("[Bivouaciste] Compromise chargé.");
    } else {
      console.warn("[Bivouaciste] Compromise non disponible.");
    }
  };

  script.onerror = () => {
    console.warn("[Bivouaciste] Impossible de charger Compromise.");
  };

  document.head.appendChild(script);
}

loadCompromise();

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

  function updateDialoguePosition() {
    const bounds = window.characterGetScreenBounds?.();

    if (bounds) {
      const gap = 14;
      const margin = 10;
      const dialogueWidth = dialogue.offsetWidth;

      // Centrage horizontal
      let left =
        (bounds.left + bounds.right) / 2 - dialogueWidth / 2;

      left = Math.max(
        margin,
        Math.min(left, window.innerWidth - dialogueWidth - margin)
      );

      // Bulle au-dessus de la tête
      bubble.style.width = `${dialogueWidth}px`;
      bubble.style.left = `${left}px`;
      bubble.style.top = `${bounds.top - bubble.offsetHeight - gap}px`;

      // Champ de saisie sous les pieds
      form.style.width = `${dialogueWidth}px`;
      form.style.left = `${left}px`;
      form.style.top = `${bounds.bottom + gap}px`;
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
      showBubble("Oups... Mon cerveau est encore dans mes sacoches. Réessaie dans un instant !");
    } else {
      showBubble("Salut voyageur ! Qu'est-ce que tu aimerais savoir ?");
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

  // --- Envoi du message ---

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
