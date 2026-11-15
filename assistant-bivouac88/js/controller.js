// controller.js — panneau de test du personnage (page de test uniquement)

const ANIMATIONS = [
  'Angry', 'Blow_a_Kiss', 'Clapping', 'Classique_Pose',
  'Cycle_Crunch', 'Fall_to_Roll', 'Fast_Run', 'Happy',
  'Jump', 'Jump.001', 'Laying_Position', 'Pointe_Doigt_Gauche',
  'Robot_Hip_Hop', 'Run_Lock_Back', 'Running', 'Sitting_Pose',
  'Sleeping', 'Standing', 'Standing_Pied_Droit', 'Styling_Flip',
  'Swimming', 'Wall_Crash'
];

// --- Panneau ---
const panel = document.createElement('div');
panel.id = 'ctrl-panel';
Object.assign(panel.style, {
  position: 'fixed',
  top: '80px',
  right: '16px',
  zIndex: '10000',
  background: '#191713ee',
  border: '1px solid #e58e26',
  borderRadius: '8px',
  padding: '12px',
  width: '190px',
  fontFamily: 'Arial, sans-serif',
  fontSize: '12px',
  color: '#eee',
  userSelect: 'none',
});

// Titre + toggle
const header = document.createElement('div');
Object.assign(header.style, {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: '10px',
  cursor: 'pointer',
});
header.innerHTML = `<strong style="color:#e58e26">🎮 Contrôleur</strong><span id="ctrl-toggle">▲</span>`;
panel.appendChild(header);

const body = document.createElement('div');
body.id = 'ctrl-body';
panel.appendChild(body);

// Toggle collapse
let collapsed = false;
header.addEventListener('click', () => {
  collapsed = !collapsed;
  body.style.display = collapsed ? 'none' : 'block';
  document.getElementById('ctrl-toggle').textContent = collapsed ? '▼' : '▲';
});

// --- Section animations ---
const animLabel = document.createElement('div');
animLabel.textContent = 'ANIMATIONS';
Object.assign(animLabel.style, { color: '#888', marginBottom: '6px', fontSize: '11px' });
body.appendChild(animLabel);

const grid = document.createElement('div');
Object.assign(grid.style, {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: '5px',
  marginBottom: '14px',
});

let activeBtn = null;

ANIMATIONS.forEach(name => {
  const btn = document.createElement('button');
  btn.textContent = name.replace(/_/g, ' ');
  btn.title = name;
  Object.assign(btn.style, {
    background: '#2a2520',
    border: '1px solid #38332b',
    borderRadius: '4px',
    color: '#ccc',
    padding: '5px 4px',
    cursor: 'pointer',
    fontSize: '10px',
    textAlign: 'left',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });

  btn.addEventListener('click', () => {
    if (typeof window.characterPlay === 'function') {
      window.characterPlay(name);
      if (activeBtn) Object.assign(activeBtn.style, { background: '#2a2520', color: '#ccc', borderColor: '#38332b' });
      Object.assign(btn.style, { background: '#e58e26', color: '#12100e', borderColor: '#e58e26' });
      activeBtn = btn;
    }
  });

  grid.appendChild(btn);
});
body.appendChild(grid);

// --- Section position ---
const posLabel = document.createElement('div');
posLabel.textContent = 'POSITION (clic sur la page)';
Object.assign(posLabel.style, { color: '#888', marginBottom: '6px', fontSize: '11px' });
body.appendChild(posLabel);

const coords = document.createElement('div');
coords.id = 'ctrl-coords';
coords.textContent = 'x: — y: —';
Object.assign(coords.style, {
  background: '#2a2520',
  border: '1px solid #38332b',
  borderRadius: '4px',
  padding: '5px 8px',
  marginBottom: '8px',
  fontSize: '11px',
  color: '#aaa',
});
body.appendChild(coords);

const modeBtn = document.createElement('button');
modeBtn.textContent = '📍 Activer placement';
Object.assign(modeBtn.style, {
  width: '100%',
  background: '#2a2520',
  border: '1px solid #38332b',
  borderRadius: '4px',
  color: '#ccc',
  padding: '7px',
  cursor: 'pointer',
  fontSize: '11px',
});
body.appendChild(modeBtn);

// Mode placement : clic sur la page pour déplacer le perso
let placementMode = false;

modeBtn.addEventListener('click', () => {
  placementMode = !placementMode;
  if (placementMode) {
    Object.assign(modeBtn.style, { background: '#e58e26', color: '#12100e', borderColor: '#e58e26' });
    modeBtn.textContent = '✅ Clic pour placer…';
    document.body.style.cursor = 'crosshair';
  } else {
    Object.assign(modeBtn.style, { background: '#2a2520', color: '#ccc', borderColor: '#38332b' });
    modeBtn.textContent = '📍 Activer placement';
    document.body.style.cursor = '';
  }
});

document.addEventListener('click', (e) => {
  if (!placementMode) return;
  if (panel.contains(e.target)) return;

  const x = e.clientX;
  const y = window.innerHeight - e.clientY; // coordonnées Three.js (Y inversé)

  if (typeof window.characterMoveTo === 'function') {
    window.characterMoveTo(x, y);
  }

  coords.textContent = `x: ${x}  y: ${y}`;

  // Désactive le mode après placement
  placementMode = false;
  Object.assign(modeBtn.style, { background: '#2a2520', color: '#ccc', borderColor: '#38332b' });
  modeBtn.textContent = '📍 Activer placement';
  document.body.style.cursor = '';
});
// --- Section orientation ---
const rotLabel = document.createElement('div');
rotLabel.textContent = 'ORIENTATION';
Object.assign(rotLabel.style, { color: '#888', marginBottom: '6px', fontSize: '11px', marginTop: '14px' });
body.appendChild(rotLabel);

const rotRow = document.createElement('div');
Object.assign(rotRow.style, { display: 'flex', alignItems: 'center', gap: '8px' });

const rotSlider = document.createElement('input');
rotSlider.type = 'range';
rotSlider.min = '0';
rotSlider.max = '360';
rotSlider.value = '0';
Object.assign(rotSlider.style, { flex: '1', accentColor: '#e58e26', cursor: 'pointer' });

const rotValue = document.createElement('span');
rotValue.textContent = '0°';
Object.assign(rotValue.style, { color: '#aaa', fontSize: '11px', minWidth: '30px' });

rotSlider.addEventListener('input', () => {
  const deg = parseInt(rotSlider.value);
  rotValue.textContent = deg + '°';
  if (typeof window.characterRotate === 'function') {
    window.characterRotate(deg);
  }
});

rotRow.appendChild(rotSlider);
rotRow.appendChild(rotValue);
body.appendChild(rotRow);

// --- Section scènes ---
const scenesLabel = document.createElement('div');
scenesLabel.textContent = 'SCÈNES';
Object.assign(scenesLabel.style, { color: '#888', marginBottom: '6px', fontSize: '11px', marginTop: '14px' });
body.appendChild(scenesLabel);

const scenes = [];
let currentAnim = 'Angry';
let currentX = window.innerWidth - 120;
let currentY = 6;
let currentRot = 0;

// Mise à jour de l'état courant
const origPlay = window.characterPlay;
window.characterPlay = (name) => { currentAnim = name; origPlay(name); };
const origMove = window.characterMoveTo;
window.characterMoveTo = (x, y) => { currentX = x; currentY = y; origMove(x, y); };
const origRotate = window.characterRotate;
window.characterRotate = (deg) => { currentRot = deg; origRotate(deg); };

const saveBtn = document.createElement('button');
saveBtn.textContent = '💾 Sauvegarder cette scène';
Object.assign(saveBtn.style, {
  width: '100%', background: '#2a2520', border: '1px solid #38332b',
  borderRadius: '4px', color: '#ccc', padding: '7px',
  cursor: 'pointer', fontSize: '11px', marginBottom: '8px'
});

const sceneList = document.createElement('div');
Object.assign(sceneList.style, { fontSize: '10px', color: '#aaa' });

saveBtn.addEventListener('click', () => {
  const scene = {
    id: scenes.length + 1,
    animation: currentAnim,
    x: currentX,
    y: currentY,
    rotation: currentRot,
    trigger: 'manuel'
  };
  scenes.push(scene);

  const item = document.createElement('div');
Object.assign(item.style, {
  padding: '4px 6px', marginBottom: '3px',
  background: '#2a2520', borderRadius: '3px',
  border: '1px solid #38332b',
  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
});

const label = document.createElement('span');
label.textContent = `#${scene.id} — ${scene.animation}`;
label.style.overflow = 'hidden';
label.style.textOverflow = 'ellipsis';
label.style.whiteSpace = 'nowrap';

const playBtn = document.createElement('button');
playBtn.textContent = '▶';
Object.assign(playBtn.style, {
  background: '#e58e26', border: 'none', borderRadius: '3px',
  color: '#12100e', cursor: 'pointer', padding: '2px 6px',
  fontSize: '10px', flexShrink: '0', marginLeft: '6px'
});

playBtn.addEventListener('click', () => {
  window.characterMoveTo(scene.x, scene.y);
  window.characterPlay(scene.animation);
  window.characterRotate(scene.rotation);
});

item.appendChild(label);
item.appendChild(playBtn);
sceneList.appendChild(item);

  console.info('[controller] scène sauvegardée :', scene);
});

body.appendChild(saveBtn);
const exportBtn = document.createElement('button');
exportBtn.textContent = '📤 Exporter JSON';
Object.assign(exportBtn.style, {
  width: '100%', background: '#2a2520', border: '1px solid #38332b',
  borderRadius: '4px', color: '#ccc', padding: '7px',
  cursor: 'pointer', fontSize: '11px', marginBottom: '8px'
});

exportBtn.addEventListener('click', () => {
  if (!scenes.length) {
    alert('Aucune scène à exporter.');
    return;
  }
  const json = JSON.stringify({ scenes }, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
const animNames = scenes.map(s => s.animation).join('-');
const now = new Date();
const stamp = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}_${String(now.getHours()).padStart(2,'0')}h${String(now.getMinutes()).padStart(2,'0')}`;
a.download = `${animNames}_${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

body.appendChild(exportBtn);
body.appendChild(sceneList);

document.body.appendChild(panel);
