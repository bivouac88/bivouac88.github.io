/*
 * Module de visite guidée indépendant.
 * Les sélecteurs data-bivouac-tour seront ajoutés aux éléments du vrai site
 * au moment de l'intégration. Aucun sélecteur réel n'est supposé ici.
 */
export function createTour({ steps = [], onUpdate = () => {} } = {}) {
  let index = -1;
  let active = false;

  function current() {
    return active && index >= 0 ? steps[index] || null : null;
  }

  function publish() {
    const step = current();
    const targetExists = step?.target
      ? Boolean(document.querySelector(step.target))
      : false;

    onUpdate({
      active,
      index,
      total: steps.length,
      step,
      targetExists,
      isLast: active && index === steps.length - 1
    });
  }

  return {
    start() {
      if (!steps.length) {
        onUpdate({ active: false, message: "Aucune étape de visite n'est encore configurée." });
        return;
      }
      active = true;
      index = 0;
      publish();
    },
    next() {
      if (!active) return;
      if (index < steps.length - 1) index += 1;
      else { this.stop(); return; }
      publish();
    },
    previous() {
      if (!active || index <= 0) return;
      index -= 1;
      publish();
    },
    stop() {
      active = false;
      index = -1;
      publish();
    },
    getState() {
      return { active, index, step: current() };
    }
  };
}
