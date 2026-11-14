
import { startTour } from "./widget-tour.js";
import { loadKnowledge } from "./knowledge.js";
import { createEngine } from "./engine.js";
import { createAvatar3D } from "./avatar3d.js";
const ROOT_ID = "b88-assistant-widget";

async function initAssistant() {
  // Évite de créer plusieurs assistants sur une même page.
  if (document.getElementById(ROOT_ID)) return;

  // Chargement du style du widget.
  const stylesheet = document.createElement("link");
  stylesheet.rel = "stylesheet";
  stylesheet.href = new URL("../css/widget.css", import.meta.url);
  document.head.appendChild(stylesheet);

  const root = document.createElement("div");
  root.id = ROOT_ID;
  root.className = "b88-assistant";

  root.innerHTML = `
    <button
      class="b88-assistant-toggle"
      type="button"
      aria-label="Ouvrir l'assistant"
      aria-expanded="false"
      title="Demander au Bivouaciste"
    >
      <span aria-hidden="true">🎒</span>
    </button>

    <section
      class="b88-assistant-panel"
      role="dialog"
      aria-label="Assistant Bivouac88"
      aria-hidden="true"
    >
      <header class="b88-assistant-header">
        <div>
          <strong>Le Bivouaciste</strong>
          <small>Assistant Bivouac88</small>
        </div>
        <button
          class="b88-assistant-close"
          type="button"
          aria-label="Fermer"
        >×</button>
            </header>

      <div id="b88-avatar-container"></div>

      <div class="b88-assistant-messages" aria-live="polite">
        <div class="b88-assistant-message bot">
          Salut voyageur ! 🎒
          <br><br>
          Je suis le Bivouaciste. Pose-moi une question sur le projet,
          le voyage ou le fonctionnement du site.
        </div>
      </div>

      <div class="b88-assistant-suggestions">
        <button type="button" data-question="Présente-moi Bivouac88">
          Le projet
        </button>
        <button type="button" data-question="Comment fonctionne le site ?">
          Le site
        </button>
        <button type="button" data-question="Que trouve-t-on sur la carte ?">
          Les POI
        </button>
      </div>

      <form class="b88-assistant-form">
        <input
          type="text"
          class="b88-assistant-input"
          placeholder="Écris ta question..."
          autocomplete="off"
          aria-label="Ta question"
        >
        <button type="submit" aria-label="Envoyer">➤</button>
      </form>
    </section>
  `;

  document.body.appendChild(root);
  const avatarContainer = root.querySelector("#b88-avatar-container");

  let avatar3D = null;

  createAvatar3D(avatarContainer)
    .then(avatar => {
      avatar3D = avatar;
      console.log("Bivouaciste 3D chargé !");
      console.log("Animations disponibles :", avatar.animations);
    })
    .catch(error => {
      console.error("Erreur de chargement du Bivouaciste 3D :", error);
    });
  const toggle = root.querySelector(".b88-assistant-toggle");
  const close = root.querySelector(".b88-assistant-close");
  const panel = root.querySelector(".b88-assistant-panel");
  const messages = root.querySelector(".b88-assistant-messages");
  const form = root.querySelector(".b88-assistant-form");
  const input = root.querySelector(".b88-assistant-input");
  const suggestions = root.querySelector(".b88-assistant-suggestions");

  let engine;

  function openPanel() {
    panel.classList.add("open");
    panel.setAttribute("aria-hidden", "false");
    toggle.setAttribute("aria-expanded", "true");
    input.focus();
  }

  function closePanel() {
    panel.classList.remove("open");
    panel.setAttribute("aria-hidden", "true");
    toggle.setAttribute("aria-expanded", "false");
    toggle.focus();
  }

  function addMessage(text, sender = "bot") {
    const message = document.createElement("div");
    message.className = `b88-assistant-message ${sender}`;
    message.textContent = text;
    messages.appendChild(message);
    messages.scrollTop = messages.scrollHeight;
    return message;
  }

  function addLinks(links, message) {
    if (!Array.isArray(links) || !links.length) return;

    const container = document.createElement("div");
    container.className = "b88-assistant-answer-links";

    links.forEach(link => {
      if (!link.url || !link.label) return;

      const anchor = document.createElement("a");
      anchor.href = link.url;
      anchor.textContent = `↗ ${link.label}`;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";

      container.appendChild(anchor);
    });

    if (container.children.length) {
      message.appendChild(container);
    }

    messages.scrollTop = messages.scrollHeight;
  }

  function addChoices(items, callback) {
    if (!Array.isArray(items) || !items.length) return;

    const container = document.createElement("div");
    container.className = "b88-assistant-choices";

    items.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item.label || item.id || "Choisir";

      button.addEventListener("click", () => {
        container.remove();
        callback(item);
      });

      container.appendChild(button);
    });

    messages.appendChild(container);
    messages.scrollTop = messages.scrollHeight;
  }

  function handleResult(result) {
    if (!result) {
      addMessage("Je n'ai pas réussi à traiter cette question.");
      return;
    }

    const answerMessage = addMessage(
      result.text || "Je n'ai pas de réponse pour le moment."
    );

    // Affichage des liens associés à la réponse.
    addLinks(result.links, answerMessage);

    if (result.type === "clarification") {
      addChoices(result.choices, choice => {
        const intentId = typeof choice === "string" ? choice : choice.id;

        if (intentId) {
          handleResult(engine.askIntent(intentId));
        }
      });

      return;
    }

    if (result.related?.length) {
      const relatedIntents = result.related
        .map(id => engine.getIntent(id))
        .filter(Boolean);

      addChoices(relatedIntents, intent => {
        addMessage(intent.label, "user");
        handleResult(engine.askIntent(intent.id));
      });
    }

    if (result.action?.type === "tour") {
      closePanel();

      const started = startTour();

      if (!started) {
        openPanel();
        addMessage("Je ne trouve pas les éléments à présenter sur cette page.");
      }
    }
  }

  function ask(question) {
    const cleanQuestion = String(question || "").trim();
    if (!cleanQuestion || !engine) return;

    addMessage(cleanQuestion, "user");
    input.value = "";

    try {
      handleResult(engine.ask(cleanQuestion));
    } catch (error) {
      console.error("Erreur assistant Bivouac88 :", error);
      addMessage("Un petit problème technique m'empêche de répondre. Réessaie dans un instant.");
    }
  }

  toggle.addEventListener("click", openPanel);
  close.addEventListener("click", closePanel);

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && panel.classList.contains("open")) {
      closePanel();
    }
  });

  form.addEventListener("submit", event => {
    event.preventDefault();
    ask(input.value);
  });

  suggestions.addEventListener("click", event => {
    const button = event.target.closest("[data-question]");
    if (button) ask(button.dataset.question);
  });

  try {
    const knowledge = await loadKnowledge();
    engine = createEngine(knowledge);
  } catch (error) {
    console.error("Chargement de l'assistant impossible :", error);
    addMessage(
      "Je n'arrive pas à charger ma base de connaissances. Vérifie le fichier knowledge.json."
    );
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAssistant, { once: true });
} else {
  initAssistant();
}
