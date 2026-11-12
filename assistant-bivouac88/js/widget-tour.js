
const STEPS = [
  {
    selector: ".test-nav",
    title: "La navigation",
    text: "C'est ici que tu peux retrouver les différentes rubriques du site."
  },
  {
    selector: ".test-hero",
    title: "Bienvenue dans l'aventure",
    text: "La présentation du projet et son esprit : voyager librement, sans itinéraire imposé."
  },
  {
    selector: "#etapes",
    title: "Les étapes",
    text: "Retrouve les journées de route, les kilomètres, le dénivelé et la progression du voyage."
  },
  {
    selector: "#carte",
    title: "La carte et les POI",
    text: "Les points d'intérêt peuvent aider à trouver de l'eau, des sanitaires, des réparateurs et des endroits utiles."
  },
  {
    selector: "#photos",
    title: "Les photos",
    text: "Un aperçu des découvertes, des paysages et des moments du voyage."
  }
];

let activeSteps = [];
let currentStep = 0;
let overlay = null;
let activeTarget = null;
let previousTargetStyles = null;
let escapeHandler = null;

function restoreTarget() {
  if (!activeTarget) return;

  activeTarget.classList.remove("b88-tour-highlight");

  if (previousTargetStyles) {
    activeTarget.style.position = previousTargetStyles.position;
    activeTarget.style.zIndex = previousTargetStyles.zIndex;
  }

  activeTarget = null;
  previousTargetStyles = null;
}

function finishTour() {
  restoreTarget();

  if (overlay) {
    overlay.remove();
    overlay = null;
  }

  if (escapeHandler) {
    document.removeEventListener("keydown", escapeHandler);
    escapeHandler = null;
  }
}

function showStep() {
  if (!overlay) return;

  restoreTarget();

  const step = activeSteps[currentStep];
  if (!step) {
    finishTour();
    return;
  }

  const target = document.querySelector(step.selector);

  if (!target) {
    if (currentStep < activeSteps.length - 1) {
      currentStep++;
      showStep();
    } else {
      finishTour();
    }
    return;
  }

  activeTarget = target;

  previousTargetStyles = {
    position: target.style.position,
    zIndex: target.style.zIndex
  };

  target.style.position = "relative";
  target.style.zIndex = "10002";
  target.classList.add("b88-tour-highlight");

  target.scrollIntoView({
    behavior: "smooth",
    block: "center"
  });

  overlay.querySelector(".b88-tour-title").textContent = step.title;
  overlay.querySelector(".b88-tour-description").textContent = step.text;
  overlay.querySelector(".b88-tour-counter").textContent =
    `${currentStep + 1} / ${activeSteps.length}`;

  overlay.querySelector(".b88-tour-previous").disabled =
    currentStep === 0;

  overlay.querySelector(".b88-tour-next").textContent =
    currentStep === activeSteps.length - 1
      ? "Terminer"
      : "Suivant →";
}

export function startTour() {
  if (overlay) finishTour();

  activeSteps = STEPS.filter(step =>
    document.querySelector(step.selector)
  );

  if (!activeSteps.length) return false;

  currentStep = 0;

  overlay = document.createElement("div");
  overlay.className = "b88-tour-overlay";

  overlay.innerHTML = `
    <div class="b88-tour-card" role="dialog" aria-modal="true"
         aria-label="Visite guidée Bivouac88">

      <div class="b88-tour-top">
        <span class="b88-tour-label">VISITE GUIDÉE</span>
        <button class="b88-tour-close" type="button"
                aria-label="Quitter la visite">×</button>
      </div>

      <div class="b88-tour-counter"></div>
      <h3 class="b88-tour-title"></h3>
      <p class="b88-tour-description"></p>

      <div class="b88-tour-controls">
        <button class="b88-tour-skip" type="button">
          Passer la visite
        </button>

        <div>
          <button class="b88-tour-previous" type="button">
            ← Retour
          </button>
          <button class="b88-tour-next" type="button">
            Suivant →
          </button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  overlay.querySelector(".b88-tour-close")
    .addEventListener("click", finishTour);

  overlay.querySelector(".b88-tour-skip")
    .addEventListener("click", finishTour);

  overlay.querySelector(".b88-tour-previous")
    .addEventListener("click", () => {
      if (currentStep > 0) {
        currentStep--;
        showStep();
      }
    });

  overlay.querySelector(".b88-tour-next")
    .addEventListener("click", () => {
      if (currentStep < activeSteps.length - 1) {
        currentStep++;
        showStep();
      } else {
        finishTour();
      }
    });

  escapeHandler = event => {
    if (event.key === "Escape") finishTour();
  };

  document.addEventListener("keydown", escapeHandler);

  showStep();
  return true;
}
