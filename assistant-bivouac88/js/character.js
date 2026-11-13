
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

const CHARACTER_ID = "b88-character";
const WIDTH = 180;
const HEIGHT = 210;

if (!document.getElementById("b88-assistant-widget")) {
  console.warn("Le widget Bivouac88 doit être chargé avant le personnage.");
} else {
  initCharacter();
}

function initCharacter() {
  const container = document.createElement("div");
  container.id = CHARACTER_ID;
  container.className = "b88-character";
  container.setAttribute("role", "button");
  container.setAttribute("tabindex", "0");
  container.setAttribute("aria-label", "Parler avec le Bivouaciste");

  document.body.appendChild(container);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    35,
    WIDTH / HEIGHT,
    0.1,
    100
  );

  camera.position.set(0, 1.45, 6);
  camera.lookAt(0, 1.15, 0);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });

  renderer.setSize(WIDTH, HEIGHT);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x536044, 2));

  const sunlight = new THREE.DirectionalLight(0xffffff, 2);
  sunlight.position.set(3, 5, 5);
  scene.add(sunlight);

  const character = new THREE.Group();
  scene.add(character);

  const materials = {
    skin: new THREE.MeshStandardMaterial({ color: 0xd6a27e, roughness: 0.9 }),
    hair: new THREE.MeshStandardMaterial({ color: 0x49372b }),
    hat: new THREE.MeshStandardMaterial({ color: 0xc28a43 }),
    clothes: new THREE.MeshStandardMaterial({ color: 0x58775b }),
    scarf: new THREE.MeshStandardMaterial({ color: 0xe58e26 }),
    trousers: new THREE.MeshStandardMaterial({ color: 0x484d43 }),
    boots: new THREE.MeshStandardMaterial({ color: 0x44352b }),
    backpack: new THREE.MeshStandardMaterial({ color: 0x9a7045 }),
    eyes: new THREE.MeshStandardMaterial({ color: 0xffffff }),
    pupils: new THREE.MeshStandardMaterial({ color: 0x29231e }),
    mouth: new THREE.MeshStandardMaterial({ color: 0x70453d })
  };

  function sphere(parent, material, position, scale) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 16),
      material
    );

    mesh.position.set(...position);
    mesh.scale.set(...scale);
    parent.add(mesh);
    return mesh;
  }

  function capsule(parent, material, position, radius, length) {
    const mesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(radius, length, 4, 8),
      material
    );

    mesh.position.set(...position);
    parent.add(mesh);
    return mesh;
  }

  // Corps
  const body = new THREE.Group();
  body.position.y = 1.05;
  character.add(body);

  sphere(body, materials.clothes, [0, 0, 0], [0.34, 0.48, 0.23]);

  // Sac à dos
  sphere(body, materials.backpack, [0, 0.02, -0.24], [0.3, 0.4, 0.17]);

  // Écharpe
  sphere(body, materials.scarf, [0, 0.37, 0.02], [0.36, 0.11, 0.25]);
  const scarfTail = sphere(
    body,
    materials.scarf,
    [0.22, 0.25, 0.12],
    [0.09, 0.24, 0.08]
  );
  scarfTail.rotation.z = -0.35;

  // Tête
  const head = new THREE.Group();
  head.position.set(0, 0.72, 0.02);
  body.add(head);

  sphere(head, materials.skin, [0, 0, 0], [0.29, 0.34, 0.27]);
  sphere(head, materials.hair, [0, 0.23, -0.02], [0.3, 0.19, 0.28]);

  // Cheveux latéraux
  sphere(head, materials.hair, [-0.25, 0.02, 0], [0.09, 0.2, 0.22]);
  sphere(head, materials.hair, [0.25, 0.02, 0], [0.09, 0.2, 0.22]);

  // Chapeau
  sphere(head, materials.hat, [0, 0.34, 0], [0.32, 0.1, 0.29]);
  sphere(head, materials.hat, [0, 0.43, -0.02], [0.23, 0.16, 0.22]);

  // Visage
  const eyes = [];

  for (const x of [-0.105, 0.105]) {
    const eye = new THREE.Group();
    eye.position.set(x, 0.015, 0.245);
    head.add(eye);

    sphere(eye, materials.eyes, [0, 0, 0], [0.055, 0.075, 0.025]);
    sphere(eye, materials.pupils, [0, 0, 0.022], [0.024, 0.035, 0.015]);

    eyes.push(eye);
  }

  // Sourire
  const smileCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.07, -0.105, 0.253),
    new THREE.Vector3(0, -0.15, 0.275),
    new THREE.Vector3(0.07, -0.105, 0.253)
  );

  const smile = new THREE.Mesh(
    new THREE.TubeGeometry(smileCurve, 12, 0.009, 6, false),
    materials.mouth
  );

  head.add(smile);

  // Bras articulés
  function createArm(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.32, 0.3, 0);
    body.add(pivot);

    capsule(
      pivot,
      materials.clothes,
      [side * 0.025, -0.19, 0],
      0.105,
      0.25
    );

    sphere(
      pivot,
      materials.skin,
      [side * 0.025, -0.4, 0.02],
      [0.095, 0.095, 0.09]
    );

    return pivot;
  }

  const leftArm = createArm(-1);
  const rightArm = createArm(1);

  // Jambes articulées
  function createLeg(side) {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.16, -0.38, 0);
    body.add(pivot);

    capsule(
      pivot,
      materials.trousers,
      [0, -0.22, 0],
      0.12,
      0.32
    );

    sphere(
      pivot,
      materials.boots,
      [0, -0.43, 0.06],
      [0.13, 0.09, 0.19]
    );

    return pivot;
  }

  const leftLeg = createLeg(-1);
  const rightLeg = createLeg(1);

  // Ombre légère sous les pieds
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.42, 32),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.13
    })
  );

  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.015;
  character.add(shadow);

  // États du personnage
  let x = 0;
  let direction = 1;
  let walking = true;
  let hovered = false;
  let wave = false;
  let idleAction = "none";
  let actionTimer = 0;
  let nextAction = 3;
  let blinkTimer = 2;
  let blinkDuration = 0;
  let walkPause = 0;
  let elapsed = 0;

  const clock = new THREE.Clock();

  function toggleChat() {
    const toggle = document.querySelector(".b88-assistant-toggle");

    if (toggle) {
      toggle.click();
    } else {
      const panel = document.querySelector(".b88-assistant-panel");

      if (panel) {
        panel.classList.toggle("is-open");
      }
    }
  }

  container.addEventListener("click", toggleChat);

  container.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      toggleChat();
    }
  });

  container.addEventListener("pointerenter", () => {
    hovered = true;
    walking = false;
    wave = true;
    idleAction = "greeting";
    actionTimer = 0;
  });

  container.addEventListener("pointerleave", () => {
    hovered = false;
    wave = false;
    idleAction = "none";
    walking = true;
    walkPause = 1.2;
  });

  function update(delta) {
    elapsed += delta;

    // Déplacement horizontal
    if (walking && !hovered) {
      walkPause -= delta;

      if (walkPause <= 0) {
        x += direction * delta * 0.45;

        const maxX = Math.max(
          0,
          window.innerWidth - container.offsetWidth - 24
        );

        if (x >= maxX) {
          x = maxX;
          direction = -1;
          walkPause = 1.5;
        }

        if (x <= 0) {
          x = 0;
          direction = 1;
          walkPause = 1.5;
        }
      }
    }

    container.style.transform = `translateX(${x}px)`;

    // Marche et respiration
    const walkingMotion = walking && walkPause <= 0 && !hovered;

    const walkCycle = elapsed * 7;

    body.position.y = 1.05 + Math.sin(elapsed * 2.2) * 0.025;

    if (walkingMotion) {
      body.position.y += Math.abs(Math.sin(walkCycle)) * 0.035;

      leftLeg.rotation.x = Math.sin(walkCycle) * 0.48;
      rightLeg.rotation.x = Math.sin(walkCycle + Math.PI) * 0.48;

      leftArm.rotation.x = Math.sin(walkCycle + Math.PI) * 0.35;
      rightArm.rotation.x = Math.sin(walkCycle) * 0.35;
    } else {
      leftLeg.rotation.x *= 0.88;
      rightLeg.rotation.x *= 0.88;
      leftArm.rotation.x *= 0.88;
      rightArm.rotation.x *= 0.88;
    }

    // Orientation légère selon le déplacement
    character.rotation.y = THREE.MathUtils.lerp(
      character.rotation.y,
      hovered ? 0 : direction * 0.18,
      delta * 3
    );

    // Clignement des yeux
    blinkTimer -= delta;

    if (blinkTimer <= 0 && blinkDuration <= 0) {
      blinkDuration = 0.16;
    }

    if (blinkDuration > 0) {
      blinkDuration -= delta;
      const blink = Math.max(0.12, Math.abs(blinkDuration) / 0.16);

      eyes.forEach(eye => {
        eye.scale.y = blink;
      });

      if (blinkDuration <= 0) {
        eyes.forEach(eye => eye.scale.y = 1);
        blinkTimer = 2.5 + Math.random() * 3;
      }
    }

    // Comportements spontanés
    if (!hovered && !walking) {
      actionTimer -= delta;

      if (actionTimer <= 0) {
        idleAction = "none";
        walking = true;
      }
    }

    if (!hovered && walking && walkPause <= 0) {
      nextAction -= delta;

      if (nextAction <= 0) {
        walking = false;
        walkPause = 0;

        const actions = ["look", "tilt", "rest"];
        idleAction = actions[Math.floor(Math.random() * actions.length)];

        actionTimer = 1.5 + Math.random() * 2.5;
        nextAction = 5 + Math.random() * 6;
      }
    }

    // Expression et mouvements de tête
    let targetHeadX = 0;
    let targetHeadY = 0;
    let targetHeadZ = 0;

    if (idleAction === "look") {
      targetHeadY = Math.sin(elapsed * 2) * 0.3;
    }

    if (idleAction === "tilt") {
      targetHeadZ = 0.25;
    }

    if (idleAction === "rest") {
      targetHeadZ = 0.12;
      targetHeadX = 0.08;
    }

    if (hovered) {
      targetHeadX = -0.08;
      targetHeadZ = Math.sin(elapsed * 3) * 0.04;
    }

    head.rotation.x = THREE.MathUtils.lerp(
      head.rotation.x,
      targetHeadX,
      delta * 3
    );

    head.rotation.y = THREE.MathUtils.lerp(
      head.rotation.y,
      targetHeadY,
      delta * 3
    );

    head.rotation.z = THREE.MathUtils.lerp(
      head.rotation.z,
      targetHeadZ,
      delta * 3
    );

    // Salut de la main
    if (wave) {
      rightArm.rotation.z = -0.65 + Math.sin(elapsed * 8) * 0.35;
      rightArm.rotation.x = -0.4;
    } else {
      rightArm.rotation.z = THREE.MathUtils.lerp(
        rightArm.rotation.z,
        0,
        delta * 4
      );
    }

    // Petit mouvement du corps pendant le repos
    if (idleAction === "rest") {
      body.rotation.z = Math.sin(elapsed * 1.5) * 0.025;
    } else {
      body.rotation.z = THREE.MathUtils.lerp(
        body.rotation.z,
        0,
        delta * 3
      );
    }
  }

  function animate() {
    requestAnimationFrame(animate);

    if (document.hidden) return;

    const delta = Math.min(clock.getDelta(), 0.05);

    update(delta);
    renderer.render(scene, camera);
  }

  animate();

  document.addEventListener("visibilitychange", () => {
    clock.getDelta();
  });

  window.addEventListener("resize", () => {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  });
}
