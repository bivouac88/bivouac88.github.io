// Personnage animé qui court en ligne droite, vu de profil,
// du bas gauche au bas droite de l'écran, en boucle.

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/+esm';
import { GLTFLoader } from 'https://cdn.jsdelivr.net/npm/three@0.160.0/examples/jsm/loaders/GLTFLoader.js/+esm';

// ---------- Réglages ----------
const CONFIG = {
  // Chemin du .glb, relatif à ce fichier (js/) -> remonte d'un cran puis Assets/
  modelUrl: new URL('../Assets/Courrir/bivouaceur qui court full ok.glb', import.meta.url).href,
  heightPx: 160,        // hauteur du personnage à l'écran (en pixels)
  speedPx: 0,           // 0 = pas de glissement (l'animation seule fait bouger le perso)
  startXPx: 120,         // position de départ depuis le bord gauche
  pauseSeconds: 0.8,    // pause hors écran avant de recommencer
  canvasHeightPx: 220,  // hauteur de la bande où il court
  bottomOffsetPx: 6,    // distance entre ses pieds et le bas de l'écran
  animationName: null,  // ex. "Run" ; null = dernière animation du fichier
  // Maillages à retirer par leur nom (doublons / tests restés dans le GLB).
  // Si le coureur disparaît, remplace par ['geometry_0_BACKUP_POIDS'].
hideMeshes: ['geometry_0_BACKUP_POIDS'],
  // Orientation initiale du modèle : 0 = regarde vers +Z (standard glTF).
  // Si le personnage court de dos ou à reculons, essaie Math.PI / 2 ou -Math.PI / 2.
  facingOffset: 0,
};

// ---------- Scène ----------
const container = document.createElement('div');
container.id = 'character-runner';
container.style.height = CONFIG.canvasHeightPx + 'px';
document.body.appendChild(container);

const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();

// Caméra orthographique : 1 unité = 1 pixel, vue strictement de côté (axe Z)
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

// ---------- Modèle ----------
let runner = null;   // groupe qui se déplace
let mixer = null;
let runnerWidth = 0; // largeur à l'écran, pour sortir complètement du cadre
let x = 0;
let pause = 0;

new GLTFLoader().load(
  CONFIG.modelUrl,
  (gltf) => {
    const model = gltf.scene;
    model.rotation.y = CONFIG.facingOffset;

    // Choix de l'animation (dernière du fichier par défaut)
    const clip = gltf.animations.length
      ? (CONFIG.animationName &&
          THREE.AnimationClip.findByName(gltf.animations, CONFIG.animationName)) ||
        gltf.animations[gltf.animations.length - 1]
      : null;

    console.info(
      '[character] animations :',
      gltf.animations.map((a) => `${a.name} (${a.duration.toFixed(2)} s)`),
      '| jouée :', clip && clip.name
    );

    // On ne garde que ce que l'animation fait réellement bouger.
    // Tout le reste (ex. copie en T-pose) est retiré de la scène.
    if (clip) {
      const animatedNodes = new Set();
      clip.tracks.forEach((track) => {
        const { nodeName } = THREE.PropertyBinding.parseTrackName(track.name);
        const node = THREE.PropertyBinding.findNode(model, nodeName);
        if (node) animatedNodes.add(node);
      });

      const underAnimatedNode = (obj) => {
        for (let p = obj; p; p = p.parent) if (animatedNodes.has(p)) return true;
        return false;
      };

      const toRemove = [];
      model.traverse((obj) => {
        if (obj.isSkinnedMesh) {
          if (!obj.skeleton.bones.some((b) => animatedNodes.has(b))) toRemove.push(obj);
        } else if (obj.isMesh && !underAnimatedNode(obj)) {
          toRemove.push(obj);
        }
      });
      console.info('[character] objets retirés :', toRemove.map((o) => o.name || o.type));
      toRemove.forEach((o) => o.removeFromParent());
    }

    // Retrait manuel par nom
    CONFIG.hideMeshes.forEach((name) => {
      const obj = model.getObjectByName(name);
      if (obj) obj.removeFromParent();
      else console.warn('[character] maillage introuvable :', name);
    });

    // Diagnostic : arbre de ce qui reste dans la scène
    const lines = [];
    const dump = (obj, depth) => {
      const kind = obj.isSkinnedMesh ? 'SkinnedMesh' : obj.isMesh ? 'Mesh' : obj.isBone ? 'Bone' : obj.type;
      if (!obj.isBone) lines.push(`${'  '.repeat(depth)}${kind} "${obj.name}"`);
      obj.children.forEach((c) => dump(c, depth + 1));
    };
    dump(model, 0);
    console.info('[character] contenu restant :\n' + lines.join('\n'));

    // Mise à l'échelle + pieds posés sur y = 0
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const scale = CONFIG.heightPx / size.y;
    model.scale.setScalar(scale);

    const box2 = new THREE.Box3().setFromObject(model);
    const center = box2.getCenter(new THREE.Vector3());
    model.position.x -= center.x;
    model.position.z -= center.z;
    model.position.y -= box2.min.y;

    runnerWidth = box2.getSize(new THREE.Vector3()).x;

    // Le personnage regarde vers la droite de l'écran (+X)
    runner = new THREE.Group();
    runner.rotation.y = Math.PI / 2;
    runner.add(model);
    runner.position.y = CONFIG.bottomOffsetPx;
    scene.add(runner);

    // Animation de course
    if (clip) {
      mixer = new THREE.AnimationMixer(model);
      const action = mixer.clipAction(clip);
      action.setLoop(THREE.LoopOnce, 1);
      action.clampWhenFinished = true;
      action.play();
    } else {
      console.warn('[character] aucune animation dans le GLB');
    }

    x = CONFIG.startXPx;
    runner.position.x = x;
  },
  undefined,
  (err) => console.error('[character] chargement du GLB impossible :', err)
);

// ---------- Boucle ----------
const clock = new THREE.Clock();

function tick() {
  requestAnimationFrame(tick);
  const dt = Math.min(clock.getDelta(), 0.1);

  if (mixer) mixer.update(dt);

    if (runner && CONFIG.speedPx > 0) {
    if (pause > 0) {
      
      pause -= dt;
    } else {
      x += CONFIG.speedPx * dt;
      if (x > width + runnerWidth) {
        x = -runnerWidth;
        pause = CONFIG.pauseSeconds;
      }
    }
    runner.position.x = x;
  }

  renderer.render(scene, camera);
}
tick();
