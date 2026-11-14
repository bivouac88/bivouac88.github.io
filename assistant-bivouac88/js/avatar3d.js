
import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GLTFLoader } from "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = new URL("../Assets/nomade.glb", import.meta.url);

export async function createAvatar3D(container, options = {}) {
  if (!container) {
    throw new Error("Conteneur 3D introuvable.");
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(
    32,
    1,
    0.01,
    100
  );

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true,
    powerPreference: "high-performance"
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  renderer.setClearColor(0x000000, 0);
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";

  container.appendChild(renderer.domElement);

  // Éclairage
  scene.add(new THREE.HemisphereLight(
    0xffffff,
    0x606070,
    2
  ));

  const mainLight = new THREE.DirectionalLight(
    0xffffff,
    2.5
  );

  mainLight.position.set(3, 5, 4);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(
    0xffffff,
    1.2
  );

  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  // Chargement du personnage
  const loader = new GLTFLoader();

  let gltf;

  try {
    gltf = await loader.loadAsync(MODEL_URL.href);
  } catch (error) {
    renderer.dispose();
    renderer.domElement.remove();
    throw new Error(
      "Impossible de charger nomade.glb : " + error.message
    );
  }

  const character = gltf.scene;
  scene.add(character);

  // Centrage et cadrage automatiques
  const box = new THREE.Box3().setFromObject(character);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  character.position.sub(center);

  const height = Math.max(size.y, 0.01);

  const cameraDistance = height / (
    2 * Math.tan(THREE.MathUtils.degToRad(
      camera.fov / 2
    ))
  );

  const distance = cameraDistance * 1.35;

  camera.position.set(
    0,
    height * 0.08,
    distance
  );

  camera.lookAt(0, 0, 0);

  // Animations Blender
  const mixer = new THREE.AnimationMixer(character);

  const actions = {};
  let currentAction = null;

  gltf.animations.forEach((clip) => {
    const action = mixer.clipAction(clip);
    actions[clip.name.toLowerCase()] = action;
  });

  function play(name, fade = 0.25) {
    const action = actions[name.toLowerCase()];

    if (!action) {
      console.warn("Animation inconnue :", name);
      return false;
    }

    if (currentAction === action) return true;

    action.reset();
    action.enabled = true;
    action.setEffectiveWeight(1);
    action.setEffectiveTimeScale(1);
    action.fadeIn(fade);

    if (currentAction) {
      currentAction.fadeOut(fade);
    }

    action.play();
    currentAction = action;

    return true;
  }

  // Animation de repos par défaut
  const idle = Object.keys(actions).find(name =>
    name.includes("idle") ||
    name.includes("repos") ||
    name.includes("wait")
  );

  if (idle) {
    play(idle, 0);
  } else if (gltf.animations.length > 0) {
    play(gltf.animations[0].name, 0);
  }

  // Gestion du rendu
  const clock = new THREE.Clock();

  let active = true;
  let frameId = null;

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height, false);
  }

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  resize();

  function animate() {
    if (!active) return;

    frameId = requestAnimationFrame(animate);

    const delta = Math.min(clock.getDelta(), 0.05);

    mixer.update(delta);
    renderer.render(scene, camera);
  }

  animate();

  // API accessible depuis widget.js
  return {
    character,
    mixer,
    animations: Object.keys(actions),

    play,

    getAnimationNames() {
      return Object.keys(actions);
    },

    setVisible(visible) {
      character.visible = visible;
    },

    dispose() {
      active = false;

      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();

      mixer.stopAllAction();

      scene.remove(character);

      character.traverse((object) => {
        if (object.isMesh) {
          object.geometry.dispose();

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];

          materials.forEach(material => material.dispose());
        }
      });

      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
