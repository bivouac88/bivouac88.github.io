import * as THREE from "https://esm.sh/three@0.180.0";
import { GLTFLoader } from "https://esm.sh/three@0.180.0/examples/jsm/loaders/GLTFLoader.js";

const COURSE_URL = new URL(
  "../Assets/Courrir/bivouaceur qui court full ok.glb",
  import.meta.url
);

export async function createAvatar3D(container) {
  if (!container) throw new Error("Conteneur 3D introuvable.");

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
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block;";
  container.appendChild(renderer.domElement);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x606070, 2));

  const mainLight = new THREE.DirectionalLight(0xffffff, 2.5);
  mainLight.position.set(3, 5, 4);
  scene.add(mainLight);

  const fillLight = new THREE.DirectionalLight(0xffffff, 1.2);
  fillLight.position.set(-4, 2, -3);
  scene.add(fillLight);

  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(COURSE_URL.href);
  const character = gltf.scene;

  if (!gltf.animations.length) {
    throw new Error("Aucune animation trouvée dans le fichier de course.");
  }

  // Choisit automatiquement le clip le plus long : c'est quasi toujours
  // le vrai cycle de course, les clips très courts étant des poses figées.
  const courseClip = gltf.animations.reduce((best, clip) =>
    clip.duration > best.duration ? clip : best
  );

  console.log(
    "Clip retenu :", courseClip.name,
    "| Durée :", courseClip.duration.toFixed(2), "s",
    "| sur", gltf.animations.length, "clips disponibles"
  );

  const avatarRoot = new THREE.Group();
  scene.add(avatarRoot);
  avatarRoot.add(character);

  const box = new THREE.Box3().setFromObject(character);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());
  avatarRoot.position.set(-center.x, -center.y, -center.z);

  // Orientation : valeur de départ fiable pour ce type de rig.
  // Si le personnage court à l'envers (vers la gauche au lieu de la droite),
  // remplace juste le signe : Math.PI / 2 au lieu de -Math.PI / 2.
  avatarRoot.rotation.y = -Math.PI / 2;

  const height = Math.max(size.y, 0.01);
  const distance = height / (
    2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
  ) * 1.35;

  camera.position.set(0, height * 0.08, distance);
  camera.lookAt(0, 0, 0);

  const mixer = new THREE.AnimationMixer(character);
  const courseAction = mixer.clipAction(courseClip);
  courseAction.setLoop(THREE.LoopRepeat, Infinity);
  courseAction.play();

  // Avance l'animation d'un cran avant le tout premier rendu,
  // pour ne jamais laisser apparaître la pose en T de départ.
  mixer.update(0.001);

  const clock = new THREE.Clock();
  let active = true;
  let frameId;

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
    mixer.update(Math.min(clock.getDelta(), 0.05));
    renderer.render(scene, camera);
  }
  animate();

  return {
    setRotationY(angle) { avatarRoot.rotation.y = angle; },
    dispose() {
      active = false;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      mixer.stopAllAction();
      renderer.dispose();
      renderer.domElement.remove();
    }
  };
}
