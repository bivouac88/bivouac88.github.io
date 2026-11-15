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

document.body.appendChild(panel);
