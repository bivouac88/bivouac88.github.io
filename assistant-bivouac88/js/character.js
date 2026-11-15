
import { createAvatar3D } from "./avatar3d.js";

async function initCharacter() {
  if (document.getElementById("b88-character")) return;

  const container = document.createElement("div");
  container.id = "b88-character";
  container.className = "b88-character";

  document.body.appendChild(container);

  try {
    await createAvatar3D(container);
    console.log("Bivouaciste chargé !");
  } catch (error) {
    console.error("Erreur Bivouaciste :", error);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCharacter, { once: true });
} else {
  initCharacter();
}
