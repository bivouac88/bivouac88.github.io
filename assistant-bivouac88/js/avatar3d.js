import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = new URL("../Assets/nomade.glb", import.meta.url);

const ANIMATION_FILES = {
  course: new URL("../Assets/Courrir/bivouaceur qui court full ok.glb", import.meta.url),
  chercher: new URL("../Assets/Chercher/bivouaceur qui cherche full ok.glb", import.meta.url),
  chill: new URL("../Assets/Chill/chill.glb", import.meta.url),
  lever: new URL("../Assets/Se lever/assi debout.glb", import.meta.url)
};

export async function createAvatar3D(container) {
  if (!container) {
    throw new Error("Conteneur 3D introuvable.");
  }

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 100);

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

  scene.add(new THREE.HemisphereLight(0xffffff, 0x606070, 2));

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
  mainLight.position.set(3, 5, 4);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  const loader = new GLTFLoader();

  let gltf;
  try {
    gltf = await loader.loadAsync(MODEL_URL.href);
  } catch (error) {
    renderer.dispose();
    renderer.domElement.remove();
    throw new Error("Impossible de charger nomade.glb : " + error.message);
  }

  const character = gltf.scene;
  scene.add(character);

  const box = new THREE.Box3().setFromObject(character);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  character.position.sub(center);

  const height = Math.max(size.y, 0.01);
  const cameraDistance = height / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const distance = cameraDistance * 1.35;

  camera.position.set(0, height * 0.08, distance);
  camera.lookAt(0, 0, 0);

  const mixer = new THREE.AnimationMixer(character);
  const actions = {};
  let currentAction = null;

  // Charge chaque fichier d'animation externe, en place (sans déplacement des hanches)
  for (const [key, url] of Object.entries(ANIMATION_FILES)) {
    try {
      const animGltf = await loader.loadAsync(url.href);

      console.log(`Animation "${key}" chargée. Clips :`, animGltf.animations.map(c => c.name));

      animGltf.animations.forEach(clip => {
        const inPlaceClip = clip.clone();
if (key === "course") console.log("Tracks course:", clip.tracks.map(t => t.name));
        inPlaceClip.tracks.forEach(track => {
          if (/hips?.*\.position$/i.test(track.name)) {
            const values = track.values;
            for (let i = 0; i < values.length; i += 3) {
              values[i] = values[0];
              values[i + 2] = values[2];
            }
          }
        });

        actions[key] = mixer.clipAction(inPlaceClip, character);
        if (key === "course") actions[key].loop = THREE.LoopPingPong;
      });
    } catch (error) {
      console.warn(`Impossible de charger l'animation "${key}" :`, error.message);
    }
  }

  function play(name, fade = 0.25) {
    const action = actions[name];

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

  return {
    character,
    mixer,
    play,
    getAnimationNames() {
      return Object.keys(actions);
    },
    setVisible(visible) {
      character.visible = visible;
    },
    setRotationY(angle) {
      character.rotation.y = angle;
    },
    dispose() {
      active = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mixer.stopAllAction();
      scene.remove(character);

      character.traverse(object => {
        if (object.isMesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach(material => material.dispose());
        }
      });

      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
