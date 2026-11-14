
import { startTour } from "./widget-tour.js";

// Chargement du CSS nécessaire à la visite guidée.
const stylesheet = document.createElement("link");
stylesheet.rel = "stylesheet";
stylesheet.href = new URL("../css/widget.css", import.meta.url);
document.head.appendChild(stylesheet);

// Déclenchement de la visite guidée depuis le dialogue.
document.addEventListener("b88:start-tour", () => {
  startTour();
});
