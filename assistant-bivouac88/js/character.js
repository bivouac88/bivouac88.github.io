
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
    document.dispatchEvent(
      new CustomEvent("b88:character-click")
    );
  });

  character.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();

      document.dispatchEvent(
        new CustomEvent("b88:character-click")
      );
    }
  });

  try {
    const avatar = await createAvatar3D(character);

    console.log("Bivouaciste GLB chargé !");
    console.log("Personnage prêt :", avatar.character);
  } catch (error) {
    console.error("Erreur de chargement du Bivouaciste :", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCharacter, { once: true });
} else {
  initCharacter();
}
