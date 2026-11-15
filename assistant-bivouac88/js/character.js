
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

  character.style.transition = "none";
  character.style.left = "12px";

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

    // Orientation vers la droite
    avatar.setRotationY(Math.PI / 2);

    // 1. Animation chercher
    console.log("Animation : chercher");
    await avatar.playOnce("chercher", 0.25);

    // 2. Animation course
    console.log("Animation : course");
    avatar.play("course", 0.2);

    // 3. Déplacement vers la droite
    requestAnimationFrame(() => {
      character.style.transition = "left 6s linear";
      character.style.left =
        `${window.innerWidth + character.offsetWidth}px`;
    });

  } catch (error) {
    console.error("Erreur de chargement du Bivouaciste :", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCharacter, { once: true });
} else {
  initCharacter();
}
