
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';
import { DRACOLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/DRACOLoader.js/+esm';

const CONFIG = {
  modelUrl: new URL('../Assets/Nouvelle_IA.glb', import.meta.url).href,
  heightPx: 45,
  canvasHeightPx: 220,
  bottomOffsetPx: 6,

  // Zone de clic du personnage
  hitboxWidthPx: 130,
  hitboxHeightPx: 145,
  hitboxOffsetXPx: 0,
  hitboxOffsetYPx: 0,
};

// --- Canvas pleine page ---

const container = document.createElement('div');
container.id = 'b88-character';

Object.assign(container.style, {
  position: 'fixed',
  inset: '0',
  width: '100vw',
  height: '100vh',
  pointerEvents: 'none',
  zIndex: '9999',
});

document.body.appendChild(container);

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true,
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

Object.assign(renderer.domElement.style, {
  width: '100%',
  height: '100%',
});

// --- Scène et caméra ---

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(
  0, 1, 1, 0, -1000, 1000
);

camera.position.set(0, 0, 500);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-200, 400, 300);
scene.add(sun);

// --- Dimensions de l'écran ---

let width = window.innerWidth;
let height = window.innerHeight;

function resize() {
  width = window.innerWidth;
  height = window.innerHeight;

  renderer.setSize(width, height, false);

  camera.left = 0;
  camera.right = width;
  camera.top = height;
  camera.bottom = 0;

  camera.updateProjectionMatrix();
}

resize();
window.addEventListener('resize', resize);

// --- État du personnage ---

let runner = null;
let mixer = null;

const actions = {};
let currentAction = null;

// Position de départ : bas droite
let posX = width - 120;
let posY = CONFIG.bottomOffsetPx;

// --- Gestion des animations ---

function playAnimation(name) {
  if (!actions[name]) {
    console.warn('[character] animation introuvable :', name);
    return;
  }

  if (currentAction === actions[name]) return;

  if (currentAction) {
    currentAction.fadeOut(0.3);
  }

  actions[name].reset().fadeIn(0.3).play();
  currentAction = actions[name];

  console.info('[character] animation :', name);
}

// --- Chargement du modèle GLB ---

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const loader = new GLTFLoader();
loader.setDRACOLoader(dracoLoader);

loader.load(
  CONFIG.modelUrl,

  (gltf) => {
    const model = gltf.scene;

    console.info(
      '[character] animations disponibles :',
      gltf.animations.map(animation => animation.name)
    );

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    const scale = CONFIG.heightPx / size.y;
    model.scale.setScalar(scale);

    window.__charWidth = size.x * scale;
    window.__charHeight = CONFIG.heightPx;

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;

    runner = new THREE.Group();
    runner.position.set(posX, posY, 0);
    runner.add(model);
    scene.add(runner);

    mixer = new THREE.AnimationMixer(model);

    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      actions[clip.name] = action;
    }

    playAnimation('Angry');

    window.characterAnimations = gltf.animations.map(a => a.name);
    document.dispatchEvent(new CustomEvent('b88:animations-ready', {
      detail: { animations: window.characterAnimations }
    }));
  },

  undefined,

  (error) => {
    console.error('[character] chargement impossible :', error);
  }
);

// --- Boucle d'animation ---

const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);

  const dt = Math.min(clock.getDelta(), 0.1);

  if (mixer) mixer.update(dt);
  if (runner) runner.position.set(posX, posY, 0);

  renderer.render(scene, camera);
}

tick();

// --- API publique ---

window.characterPlay = (name) => {
  playAnimation(name);
};

window.characterMoveTo = (x, y) => {
  posX = x;
  posY = y;
};

window.characterRotate = (x, y, z) => {
  if (runner) {
    runner.rotation.x = x * (Math.PI / 180);
    runner.rotation.y = y * (Math.PI / 180);
    runner.rotation.z = z * (Math.PI / 180);
  }
};

window.characterGetPosition = () => ({
  x: posX,
  y: posY,
  width: window.__charWidth || 40,
  height: window.__charHeight || 45,
});

// --- Limites du personnage à l'écran ---

window.characterGetScreenBounds = () => {
  if (!runner) return null;

  runner.updateWorldMatrix(true, true);
  camera.updateMatrixWorld(true);

  const rect = renderer.domElement.getBoundingClientRect();

  const halfWidth = (window.__charWidth || 40) / 2;
  const charHeight = window.__charHeight || CONFIG.heightPx;

  const corners = [
    new THREE.Vector3(-halfWidth, 0, 0),
    new THREE.Vector3(halfWidth, 0, 0),
    new THREE.Vector3(-halfWidth, charHeight, 0),
    new THREE.Vector3(halfWidth, charHeight, 0),
  ];

  const projected = corners.map(point => {
    point.applyMatrix4(runner.matrixWorld);
    point.project(camera);

    return {
      x: rect.left + (point.x + 1) * rect.width / 2,
      y: rect.top + (1 - point.y) * rect.height / 2,
    };
  });

  return {
    left: Math.min(...projected.map(point => point.x)),
    right: Math.max(...projected.map(point => point.x)),
    top: Math.min(...projected.map(point => point.y)),
    bottom: Math.max(...projected.map(point => point.y)),
  };
};

// --- Détection des clics et du drag (admin) sur le personnage ---
const CLICK_PADDING_PX = 50; // marge ajoutée autour du perso pour la zone cliquable
const DRAG_THRESHOLD_PX = 5; // distance avant de considérer que c'est un drag, pas un clic

const ADMIN_MODE = new URLSearchParams(window.location.search).get('edit') === 'bivouac88admin';

function isOverCharacter(mx, my) {
  if (!runner) return false;

  const bounds = window.characterGetScreenBounds();
  if (!bounds) return false;

  return (
    mx >= bounds.left - CLICK_PADDING_PX &&
    mx <= bounds.right + CLICK_PADDING_PX &&
    my >= bounds.top - CLICK_PADDING_PX &&
    my <= bounds.bottom + CLICK_PADDING_PX
  );
}

window.addEventListener('mousemove', (event) => {
  const mx = event.clientX;
  const my = event.clientY;

  container.style.pointerEvents =
    isOverCharacter(mx, my) ? 'auto' : 'none';
});

renderer.domElement.addEventListener('pointerdown', (event) => {
const rect = renderer.domElement.getBoundingClientRect();

const mx = event.clientX;
const my = event.clientY;

  if (!isOverCharacter(mx, my)) return;

  const startClientX = event.clientX;
  const startClientY = event.clientY;
  const startPosX = posX;
  const startPosY = posY;
  let dragged = false;

  function movePointer(moveEvent) {
    const dx = moveEvent.clientX - startClientX;
    const dy = moveEvent.clientY - startClientY;

    if (!dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      if (!ADMIN_MODE) return; // le drag n'est autorisé qu'en mode admin
      dragged = true;
    }
    if (!dragged) return;

    posX = startPosX + dx;
    posY = startPosY - dy; // axe Y inversé (coordonnées Three.js)
  }

  function stopPointer() {
    document.removeEventListener('pointermove', movePointer);
    document.removeEventListener('pointerup', stopPointer);
    document.removeEventListener('pointercancel', stopPointer);

    if (!dragged) {
      document.dispatchEvent(new CustomEvent('b88:character-click'));
    }
  }

  document.addEventListener('pointermove', movePointer);
  document.addEventListener('pointerup', stopPointer);
  document.addEventListener('pointercancel', stopPointer);
});
