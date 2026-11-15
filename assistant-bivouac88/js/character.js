
import { createAvatar3D } from "./avatar3d.js";

const CHARACTER_ID = "b88-character";

async function initCharacter() {
  if (document.getElementById(CHARACTER_ID)) return;

  const character = document.createElement("div");
  character.id = CHARACTER_ID;
  character.className = "b88-character";

  character.style.transition = "none";
  character.style.left = "12px";

  document.body.appendChild(character);

  try {
    const avatar = await createAvatar3D(character);

    console.log("Bivouaciste chargé !");

    // Orientation de face
    avatar.setRotationY(Math.PI / 2);
    
  } 
    catch (error) {
    console.error("Erreur Bivouaciste :", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCharacter, { once: true });
} else {
  initCharacter();
}
