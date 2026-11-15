
import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const MODEL_URL = new URL(
  "../Assets/Courrir/bivouaceur qui court full ok.glb",
  import.meta.url
);

export async function createAvatar3D(container) {
  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(35, 1, 0.01, 1000);

  const renderer = new THREE.WebGLRenderer({
    alpha: true,
    antialias: true
  });

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.setClearColor(0x000000, 0);

  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x606070, 2));

  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(3, 5, 4);
  scene.add(light);

  // Chargement du seul fichier GLB
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(MODEL_URL.href);

const animatedMeshes = [];

gltf.scene.traverse((object) => {
  if (object.isSkinnedMesh) {
    animatedMeshes.push(object);
  }
});

if (!animatedMeshes.length) {
  throw new Error("Aucun personnage animé (SkinnedMesh) trouvé.");
}

const animatedCharacter = new THREE.Group();

animatedMeshes.forEach((mesh) => {
  animatedCharacter.add(mesh);
});

scene.add(animatedCharacter);
  // Cadrage automatique
  const bounds = new THREE.Box3().setFromObject(gltf.scene);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  const height = Math.max(size.y, 0.01);
  const distance = height / (
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  ) * 1.5;

  camera.position.set(center.x, center.y, center.z + distance);
  camera.lookAt(center);

  // Lecture de la dernière animation intégrée
  if (!gltf.animations.length) {
    throw new Error("Aucune animation trouvée dans le GLB.");
  }

  const clip = gltf.animations[gltf.animations.length - 1];
const mixer = new THREE.AnimationMixer(gltf.scene);
  const action = mixer.clipAction(clip);

  action.setLoop(THREE.LoopRepeat, Infinity);
  action.play();

  console.log("Bivouaciste :", clip.name, clip.duration);

  const clock = new THREE.Clock();
  let active = true;
  let frameId;

  function resize() {
    const width = container.clientWidth;
    const height = container.clientHeight;

    if (!width || !height) return;

    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  }

  const observer = new ResizeObserver(resize);
  observer.observe(container);

  function animate() {
    if (!active) return;

    frameId = requestAnimationFrame(animate);
    mixer.update(clock.getDelta());
    renderer.render(scene, camera);
  }

  animate();

  return {
    dispose() {
      active = false;
      cancelAnimationFrame(frameId);
      observer.disconnect();
      mixer.stopAllAction();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
