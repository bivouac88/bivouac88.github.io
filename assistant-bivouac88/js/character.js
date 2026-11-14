
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
    console.log("Animations disponibles :", avatar.getAnimationNames());

    // Recherche automatique du clip de marche.
    const animations = avatar.getAnimationNames();

    const walkClip = animations.find(name =>
      /walk|walking|marche|marcher/i.test(name)
    );

    const idleClip = animations.find(name =>
      /idle|repos|wait|attente/i.test(name)
    );

    if (!walkClip) {
      console.warn("Aucune animation de marche détectée dans le GLB.");
    }

    // Lancement du test après le chargement du personnage.
    setTimeout(() => {
      const start = 12;
      const destination = Math.max(
        start,
        window.innerWidth * 0.5 - character.offsetWidth / 2
      );

      const duration = 5000;

      console.log("Début du déplacement.");

      if (walkClip) {
        avatar.play(walkClip);
      }

      character.style.transition = `left ${duration}ms linear`;
      character.style.left = `${destination}px`;

      setTimeout(() => {
        if (idleClip) {
          avatar.play(idleClip);
        }

        character.style.transition = "filter 0.25s ease";
        console.log("Le Bivouaciste a terminé sa marche.");
      }, duration);
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
