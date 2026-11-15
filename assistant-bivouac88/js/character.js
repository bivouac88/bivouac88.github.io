import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';

const CONFIG = {
  modelUrl: new URL('../Assets/Nouvelle_IA.glb', import.meta.url).href,
  heightPx: 45,
  canvasHeightPx: 220,
  bottomOffsetPx: 6,
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

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);
Object.assign(renderer.domElement.style, {
  width: '100%',
  height: '100%',
});

const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
camera.position.set(0, 0, 500);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));
const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-200, 400, 300);
scene.add(sun);

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

function playAnimation(name) {
  if (!actions[name]) {
    console.warn('[character] animation introuvable :', name);
    return;
  }
  if (currentAction === actions[name]) return;
  if (currentAction) currentAction.fadeOut(0.3);
  actions[name].reset().fadeIn(0.3).play();
  currentAction = actions[name];
  console.info('[character] animation :', name);
}

// --- Chargement GLB ---
new GLTFLoader().load(
  CONFIG.modelUrl,

  (gltf) => {
    const model = gltf.scene;

    console.info('[character] animations disponibles :',
      gltf.animations.map(a => a.name));

    // Mise à l'échelle
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.scale.setScalar(CONFIG.heightPx / size.y);
window.__charWidth = size.x * (CONFIG.heightPx / size.y);
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

    // Mixer + toutes les animations
    mixer = new THREE.AnimationMixer(model);
    for (const clip of gltf.animations) {
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopRepeat, Infinity);
      actions[clip.name] = action;
    }

    // Démarrage avec Angry
    playAnimation('Angry');
  },

  undefined,

  (error) => console.error('[character] chargement impossible :', error)
);

// --- Boucle ---
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (mixer) mixer.update(dt);
  if (runner) runner.position.set(posX, posY, 0);
  renderer.render(scene, camera);
}

tick();

// --- API publique pour déclencher les animations depuis l'extérieur ---
window.characterPlay = (name) => playAnimation(name);
window.characterMoveTo = (x, y) => { posX = x; posY = y; };
window.characterRotate = (deg) => {
  if (runner) runner.rotation.y = deg * (Math.PI / 180);
};
// --- Drag & drop + clic ---
let dragging = false;
let dragMoved = false;
let dragOffsetX = 0;
let dragOffsetY = 0;

function isOverCharacter(mx, my) {
  const w = (window.__charWidth || 40) / 2 + 15; // marge de confort
  const h = (window.__charHeight || 45) + 15;
  return mx > posX - w && mx < posX + w && my > posY - 10 && my < posY + h;
}

window.addEventListener('mousemove', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = rect.height - (e.clientY - rect.top);

  if (dragging) {
    const newX = mx - dragOffsetX;
    const newY = my - dragOffsetY;
    if (Math.abs(newX - posX) > 3 || Math.abs(newY - posY) > 3) {
      dragMoved = true;
    }
    posX = newX;
    posY = newY;
    return;
  }

  container.style.pointerEvents = isOverCharacter(mx, my) ? 'auto' : 'none';
});

renderer.domElement.addEventListener('mousedown', (e) => {
  const rect = renderer.domElement.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = rect.height - (e.clientY - rect.top);

  if (isOverCharacter(mx, my)) {
    dragging = true;
    dragMoved = false;
    dragOffsetX = mx - posX;
    dragOffsetY = my - posY;
    e.preventDefault();
  }
});

window.addEventListener('mouseup', () => {
  if (dragging && !dragMoved) {
    // Clic simple (sans déplacement) : on prévient le dialogue.
    document.dispatchEvent(new CustomEvent('b88:character-click'));
  }
  dragging = false;
  dragMoved = false;
});
