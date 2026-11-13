
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const CHARACTER_ID = "b88-character";

function createMaterial(color, roughness = 0.85) {
  return new THREE.MeshStandardMaterial({ color, roughness });
}

function createCharacter() {
  const character = new THREE.Group();

  const skin = createMaterial("#d9a477");
  const skinLight = createMaterial("#e8b58b");
  const hair = createMaterial("#493326");
  const hairLight = createMaterial("#65452f");
  const clothes = createMaterial("#526b42");
  const clothesDark = createMaterial("#344b32");
  const orange = createMaterial("#e58e26");
  const backpackMaterial = createMaterial("#465b38");
  const boots = createMaterial("#49372b");
  const eyes = createMaterial("#30251e");
  const white = createMaterial("#fff3df");

  function addMesh(geometry, material, parent, x, y, z) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  // Corps
  addMesh(
    new THREE.CapsuleGeometry(0.34, 0.62, 5, 10),
    clothes,
    character,
    0,
    1.25,
    0
  );

  // Veste et détails
  addMesh(
    new THREE.BoxGeometry(0.045, 0.75, 0.035),
    orange,
    character,
    0,
    1.25,
    0.345
  );

  // Sac à dos
  addMesh(
    new THREE.BoxGeometry(0.48, 0.68, 0.27),
    backpackMaterial,
    character,
    -0.38,
    1.3,
    -0.17
  );

  addMesh(
    new THREE.BoxGeometry(0.3, 0.12, 0.29),
    clothesDark,
    character,
    -0.38,
    0.95,
    -0.17
  );

  // Tête
  const head = new THREE.Group();
  character.add(head);
  head.position.set(0, 2.12, 0.04);

  addMesh(
    new THREE.SphereGeometry(0.42, 24, 20),
    skin,
    head,
    0,
    0,
    0
  );

  // Cheveux arrière
  addMesh(
    new THREE.SphereGeometry(0.43, 20, 16),
    hair,
    head,
    0,
    0.06,
    -0.12
  );

  // Visage devant les cheveux
  addMesh(
    new THREE.SphereGeometry(0.365, 24, 20),
    skin,
    head,
    0,
    -0.015,
    0.105
  );

  // Mèches latérales
  addMesh(
    new THREE.SphereGeometry(0.17, 16, 12),
    hairLight,
    head,
    -0.34,
    0.13,
    0.04
  );

  addMesh(
    new THREE.SphereGeometry(0.17, 16, 12),
    hairLight,
    head,
    0.34,
    0.13,
    0.04
  );

  // Yeux
  [-0.14, 0.14].forEach(x => {
    addMesh(
      new THREE.SphereGeometry(0.065, 12, 12),
      white,
      head,
      x,
      0.045,
      0.432
    );

    addMesh(
      new THREE.SphereGeometry(0.036, 12, 12),
      eyes,
      head,
      x,
      0.045,
      0.487
    );
  });

  // Nez
  addMesh(
    new THREE.SphereGeometry(0.055, 12, 12),
    skinLight,
    head,
    0,
    -0.055,
    0.49
  );

  // Sourire
  const smileCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.09, -0.15, 0.45),
    new THREE.Vector3(0, -0.22, 0.48),
    new THREE.Vector3(0.09, -0.15, 0.45)
  );

  const smile = new THREE.Mesh(
    new THREE.TubeGeometry(smileCurve, 12, 0.012, 6, false),
    eyes
  );
  head.add(smile);

  // Chapeau
  addMesh(
    new THREE.CylinderGeometry(0.53, 0.53, 0.075, 32),
    hairLight,
    head,
    0,
    0.39,
    0
  );

  addMesh(
    new THREE.CylinderGeometry(0.29, 0.34, 0.34, 24),
    hair,
    head,
    0,
    0.57,
    -0.015
  );

  addMesh(
    new THREE.BoxGeometry(0.19, 0.11, 0.025),
    orange,
    head,
    0,
    0.56,
    0.315
  );

  // Foulard
  addMesh(
    new THREE.TorusGeometry(0.25, 0.085, 10, 24),
    orange,
    character,
    0,
    1.78,
    0.015
  );

  addMesh(
    new THREE.BoxGeometry(0.13, 0.38, 0.08),
    orange,
    character,
    0.19,
    1.57,
    0.24
  );

  // Bras articulés
  const arms = [];

  [-1, 1].forEach(side => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.37, 1.52, 0);
    character.add(arm);

    const sleeve = addMesh(
      new THREE.CapsuleGeometry(0.105, 0.38, 4, 8),
      clothesDark,
      arm,
      0,
      -0.27,
      0
    );

    const hand = addMesh(
      new THREE.SphereGeometry(0.105, 12, 12),
      skin,
      arm,
      0,
      -0.57,
      0.015
    );

    arms.push(arm);
  });

  // Jambes articulées
  const legs = [];

  [-1, 1].forEach(side => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.16, 0.91, 0);
    character.add(leg);

    addMesh(
      new THREE.CapsuleGeometry(0.115, 0.43, 4, 8),
      clothesDark,
      leg,
      0,
      -0.28,
      0
    );

    addMesh(
      new THREE.SphereGeometry(0.14, 12, 12),
      boots,
      leg,
      0,
      -0.56,
      0.09
    );

    legs.push(leg);
  });

  return { character, arms, legs, head };
}

function initCharacter() {
  if (document.getElementById(CHARACTER_ID)) return;

  const widget = document.getElementById("b88-assistant-widget");
  if (!widget) {
    console.warn("Le Bivouaciste : widget introuvable sur cette page.");
    return;
  }

  const container = document.createElement("div");
  container.id = CHARACTER_ID;
  container.className = "b88-character";
  container.setAttribute("role", "button");
  container.setAttribute("tabindex", "0");
  container.setAttribute("aria-label", "Parler au Bivouaciste");
  container.title = "Parler au Bivouaciste";

  document.body.appendChild(container);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  camera.position.set(0, 1.45, 6.2);
  camera.lookAt(0, 1.35, 0);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(180, 210);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x526047, 2));

  const sunlight = new THREE.DirectionalLight(0xffffff, 2.2);
  sunlight.position.set(-3, 5, 5);
  scene.add(sunlight);

  const fillLight = new THREE.DirectionalLight(0xffc47c, 0.7);
  fillLight.position.set(3, 2, 3);
  scene.add(fillLight);

  const { character, arms, legs, head } = createCharacter();
  scene.add(character);

  let position = Math.max(12, window.innerWidth * 0.08);
  let direction = 1;
  let lastTime = 0;
  let idleUntil = 0;
  let walkPhase = 0;
  let isPaused = false;

  function updatePosition() {
    const maxPosition = Math.max(12, window.innerWidth - 165);

    position = THREE.MathUtils.clamp(position, 12, maxPosition);
    container.style.left = `${position}px`;
  }

  function animate(time) {
    requestAnimationFrame(animate);

    const delta = Math.min((time - lastTime) / 1000 || 0, 0.05);
    lastTime = time;

    if (!isPaused) {
      const maxPosition = Math.max(12, window.innerWidth - 165);

      if (time > idleUntil) {
        position += direction * delta * 30;

        if (position >= maxPosition) {
          position = maxPosition;
          direction = -1;
          idleUntil = time + 1800;
        } else if (position <= 12) {
          position = 12;
          direction = 1;
          idleUntil = time + 1800;
        }

        walkPhase += delta * 7;
      }

      container.style.left = `${position}px`;

      const walking = time > idleUntil;

      character.position.y = walking
        ? Math.abs(Math.sin(walkPhase * 2)) * 0.045
        : 0;

      character.rotation.y = walking
        ? direction * Math.PI / 2
        : 0;

      legs.forEach((leg, index) => {
        leg.rotation.x = walking
          ? Math.sin(walkPhase + index * Math.PI) * 0.55
          : 0;
      });

      arms.forEach((arm, index) => {
        arm.rotation.x = walking
          ? Math.sin(walkPhase + Math.PI + index * Math.PI) * 0.4
          : 0;
      });

      head.rotation.z = Math.sin(time * 0.0012) * 0.025;
    }

    renderer.render(scene, camera);
  }

  function talkToCharacter() {
    const toggle = widget.querySelector(".b88-assistant-toggle");
    const panel = widget.querySelector(".b88-assistant-panel");

    if (!toggle || !panel) return;

    if (panel.classList.contains("open")) {
      toggle.click();
    } else {
      toggle.click();
    }
  }

  container.addEventListener("click", talkToCharacter);

  container.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      talkToCharacter();
    }
  });

  // Met le personnage au repos lorsque le visiteur quitte l'onglet.
  document.addEventListener("visibilitychange", () => {
    isPaused = document.hidden;
  });

  window.addEventListener("resize", updatePosition);

  updatePosition();
  requestAnimationFrame(animate);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initCharacter, { once: true });
} else {
  initCharacter();
}
