
import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';

// ---------- Réglages ----------
const CONFIG = {
  modelUrl: new URL('../Assets/bivouaceur_complet.glb', import.meta.url).href,
  heightPx: 160,
  startXPx: 120,
  canvasHeightPx: 220,
  bottomOffsetPx: 6,
  facingOffset: 0,

  standClipName: 'Se lever',
  runClipName: 'Courir',
  searchClipName: 'Action chercher',

  hideMeshes: ['geometry_0_BACKUP_POIDS'],
  turnDuration: 0.7
};

// ---------- Scène ----------
const container = document.createElement('div');
container.id = 'character-runner';
container.style.height = CONFIG.canvasHeightPx + 'px';
document.body.appendChild(container);

const renderer = new THREE.WebGLRenderer({
  alpha: true,
  antialias: true
});

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.OrthographicCamera(0, 1, 1, 0, -1000, 1000);
camera.position.set(0, 0, 500);

scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 2.2));

const sun = new THREE.DirectionalLight(0xffffff, 2.5);
sun.position.set(-200, 400, 300);
scene.add(sun);

let width = 0;
let height = 0;

function resize() {
  width = container.clientWidth;
  height = container.clientHeight;

  renderer.setSize(width, height, false);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';

  camera.left = 0;
  camera.right = width;
  camera.top = height;
  camera.bottom = 0;
  camera.updateProjectionMatrix();
}

resize();
window.addEventListener('resize', resize);

// ---------- Personnage et animations ----------
let runner = null;
let model = null;
let mixer = null;

let standAction = null;
let runAction = null;
let searchAction = null;

let rootMotionNode = null;
let rootMotionInitialPosition = null;
let runStartPosition = null;

let state = 'loading';
let turnElapsed = 0;

const clock = new THREE.Clock();

// ---------- Détection du déplacement intégré ----------
function findRootMotionNode(model, clip) {
  const candidates = new Set();

  for (const track of clip.tracks) {
    const parsed = THREE.PropertyBinding.parseTrackName(track.name);

    if (parsed.propertyName !== 'position') continue;

    const node = THREE.PropertyBinding.findNode(model, parsed.nodeName);

    if (node) candidates.add(node);
  }

  if (!candidates.size) return null;

  function depth(node) {
    let value = 0;

    while (node && node !== model) {
      value++;
      node = node.parent;
    }

    return value;
  }

  return [...candidates].sort((a, b) => depth(a) - depth(b))[0];
}

// Position d'un objet exprimée dans les coordonnées de la scène.
function getScenePosition(object) {
  model.updateMatrixWorld(true);
  scene.updateMatrixWorld(true);

  const worldPosition = object.getWorldPosition(new THREE.Vector3());

  return scene.worldToLocal(worldPosition);
}

// ---------- Enchaînement des animations ----------
function startRunning() {
  if (!runAction) return;

  // Orientation de profil : le personnage court vers la droite.
  runner.rotation.y = Math.PI / 2;

  if (rootMotionNode) {
    rootMotionInitialPosition = rootMotionNode.position.clone();
    runStartPosition = getScenePosition(rootMotionNode);
  } else {
    console.warn('[character] aucune piste de déplacement détectée.');
  }

  state = 'running';

  runAction.reset();
  runAction.setLoop(THREE.LoopOnce, 1);
  runAction.clampWhenFinished = true;
  runAction.play();

  console.info('[character] début de la course');
}

function startTurning() {
  state = 'turning';
  turnElapsed = 0;

  console.info('[character] fin de course, pivot vers la caméra');
}

function startSearching() {
  if (!searchAction) {
    state = 'finished';
    console.warn('[character] animation Action chercher introuvable');
    return;
  }

  // Préparation de la recherche face caméra.
  runner.rotation.y = 0;

  state = 'searching';

  // Démarrer la recherche avant de libérer la course.
  searchAction.reset();
  searchAction.setLoop(THREE.LoopRepeat, Infinity);
  searchAction.play();

  // La course est arrêtée uniquement maintenant :
  // sa pose finale est conservée jusqu'à l'application
  // de la première image de l'animation de recherche.
  if (runAction) {
    runAction.stop();
  }

  // Appliquer immédiatement la première pose de recherche.
  mixer.update(0);

  console.info('[character] début de Action chercher');
}

function finishRunning() {
  if (state !== 'running') return;

  if (rootMotionNode && runStartPosition && rootMotionInitialPosition) {
    // Capturer la position réellement atteinte par les hanches.
    const endPosition = getScenePosition(rootMotionNode);

    const displacement = endPosition.sub(runStartPosition);

    // Le déplacement est transféré au groupe extérieur.
    // Il est exprimé dans le repère de la scène, pas dans
    // celui du modèle ou des hanches.
    runner.position.add(displacement);

    // Remettre les hanches à leur position initiale sans
    // déplacer visuellement le personnage.
    rootMotionNode.position.copy(rootMotionInitialPosition);

    console.info(
      '[character] déplacement transféré :',
      displacement.x.toFixed(2),
      displacement.y.toFixed(2),
      displacement.z.toFixed(2)
    );

    // Garder la pose finale de course pendant le pivot.
    runAction.paused = true;
  } else {
    runAction.paused = true;
    console.warn('[character] transfert du déplacement impossible.');
  }

  model.updateMatrixWorld(true);

  startTurning();
}

function finishStanding() {
  if (state !== 'standing') return;

  standAction.stop();
  startRunning();
}

// ---------- Chargement du GLB ----------
new GLTFLoader().load(
  CONFIG.modelUrl,

  (gltf) => {
    model = gltf.scene;
    model.rotation.y = CONFIG.facingOffset;

    const standClip = THREE.AnimationClip.findByName(
      gltf.animations,
      CONFIG.standClipName
    );

    const runClip = THREE.AnimationClip.findByName(
      gltf.animations,
      CONFIG.runClipName
    );

    const searchClip = THREE.AnimationClip.findByName(
      gltf.animations,
      CONFIG.searchClipName
    );

    console.info(
      '[character] animations :',
      gltf.animations.map(
        clip => `${clip.name} (${clip.duration.toFixed(2)} s)`
      )
    );

    if (!standClip || !runClip || !searchClip) {
      console.error('[character] animations manquantes :', {
        stand: Boolean(standClip),
        run: Boolean(runClip),
        search: Boolean(searchClip)
      });
      return;
    }

    // Conserver les maillages nécessaires aux trois animations.
    const animatedNodes = new Set();

    for (const clip of [standClip, runClip, searchClip]) {
      for (const track of clip.tracks) {
        const parsed = THREE.PropertyBinding.parseTrackName(track.name);
        const node = THREE.PropertyBinding.findNode(model, parsed.nodeName);

        if (node) animatedNodes.add(node);
      }
    }

    const underAnimatedNode = (obj) => {
      for (let parent = obj; parent; parent = parent.parent) {
        if (animatedNodes.has(parent)) return true;
      }

      return false;
    };

    const toRemove = [];

    model.traverse((obj) => {
      if (obj.isSkinnedMesh) {
        if (!obj.skeleton.bones.some(bone => animatedNodes.has(bone))) {
          toRemove.push(obj);
        }
      } else if (obj.isMesh && !underAnimatedNode(obj)) {
        toRemove.push(obj);
      }
    });

    toRemove.forEach(obj => obj.removeFromParent());

    // Retrait manuel des maillages indésirables.
    CONFIG.hideMeshes.forEach((name) => {
      const obj = model.getObjectByName(name);

      if (obj) obj.removeFromParent();
      else console.warn('[character] maillage introuvable :', name);
    });

    // Mise à l'échelle et positionnement.
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());

    if (!size.y) {
      console.error('[character] dimensions invalides du modèle');
      return;
    }

    model.scale.setScalar(CONFIG.heightPx / size.y);

    const scaledBox = new THREE.Box3().setFromObject(model);
    const center = scaledBox.getCenter(new THREE.Vector3());

    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= scaledBox.min.y;

    // Groupe externe : position et orientation à l'écran.
    runner = new THREE.Group();
    runner.position.set(CONFIG.startXPx, CONFIG.bottomOffsetPx, 0);
    runner.add(model);
    scene.add(runner);

    // Création du moteur d'animation.
    mixer = new THREE.AnimationMixer(model);

    standAction = mixer.clipAction(standClip);
    runAction = mixer.clipAction(runClip);
    searchAction = mixer.clipAction(searchClip);

    rootMotionNode = findRootMotionNode(model, runClip);

    console.info(
      '[character] nœud de déplacement :',
      rootMotionNode?.name || 'non détecté'
    );

    standAction.setLoop(THREE.LoopOnce, 1);
    standAction.clampWhenFinished = true;

    searchAction.setLoop(THREE.LoopRepeat, Infinity);

    mixer.addEventListener('finished', (event) => {
      if (event.action === standAction) {
        finishStanding();
      }

      if (event.action === runAction) {
        finishRunning();
      }
    });

    // Départ face caméra : le personnage se lève.
    runner.rotation.y = 0;

    state = 'standing';
    standAction.reset();
    standAction.play();

    console.info('[character] séquence démarrée : Se lever');
  },

  undefined,

  (error) => {
    console.error('[character] chargement du GLB impossible :', error);
  }
);

// ---------- Boucle de rendu ----------
function tick() {
  requestAnimationFrame(tick);

  const dt = Math.min(clock.getDelta(), 0.1);

  if (mixer) mixer.update(dt);

  // Pivot progressif vers la caméra après la course.
  if (state === 'turning' && runner) {
    turnElapsed += dt;

    const progress = Math.min(
      turnElapsed / CONFIG.turnDuration,
      1
    );

    const eased = progress * progress * (3 - 2 * progress);

    runner.rotation.y = Math.PI / 2 * (1 - eased);

    if (progress >= 1) {
      startSearching();
    }
  }

  renderer.render(scene, camera);
}

tick();
