import { createAvatar3D } from "./avatar3d.js";

const CHARACTER_ID = "b88-character";

async function initCharacter() {
  if (document.getElementById(CHARACTER_ID)) return;

  const character = document.createElement("div");
  character.id = CHARACTER_ID;
  character.className = "b88-character";
  character.setAttribute("role", "button");
  character.setAttribute("tabindex", "0");
  character.setAttribute("aria-label", "Parler au Bivouaciste");
  character.setAttribute("title", "Parler au Bivouaciste");

  document.body.appendChild(character);

  character.addEventListener("click", () => {
    document.dispatchEvent(new CustomEvent("b88:character-click"));
  });

  character.addEventListener("keydown", event => {
    if (event.target !== character) return;

    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      document.dispatchEvent(new CustomEvent("b88:character-click"));
    }
  });

  try {
    const avatar = await createAvatar3D(character);

    console.log("Bivouaciste GLB chargé !");

    // COURSE : traversée complète de l'écran
    setTimeout(() => {
      // Oriente le personnage vers la droite
      avatar.setRotationY(Math.PI / 2);

      // Lance la course
      avatar.play("course:mixamo.com.001", 0.2);

      // Prépare le déplacement
      character.style.transition = "none";
      character.style.left = "12px";

      // Force le navigateur à appliquer la position initiale
      character.offsetHeight;

      // Départ vers la droite, jusqu'à sortir complètement de l'écran
      requestAnimationFrame(() => {
        character.style.transition = "left 6s linear";
        character.style.left = `${window.innerWidth + character.offsetWidth}px`;
      });

    }, 1500);

  } catch (error) {
    console.error("Erreur de chargement du Bivouaciste :", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCharacter, { once: true });
} else {
  initCharacter();
}
