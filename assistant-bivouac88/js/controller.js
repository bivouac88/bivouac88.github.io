// controller.js — panneau de contrôle (accès admin uniquement via ?edit=bivouac88admin)

(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('edit') !== 'bivouac88admin') {
    return; // Visiteur normal : pas de panneau, le script ne fait rien.
  }

  const ANIMATIONS = [
    'Angry', 'Blow_a_Kiss', 'Clapping', 'Classique_Pose',
    'Cycle_Crunch', 'Fall_to_Roll', 'Fast_Run', 'Happy',
    'Jump', 'Jump.001', 'Laying_Position', 'Pointe_Doigt_Gauche',
    'Robot_Hip_Hop', 'Run_Lock_Back', 'Running', 'Sitting_Pose',
    'Sleeping', 'Standing', 'Standing_Pied_Droit', 'Styling_Flip',
    'Swimming', 'Wall_Crash'
  ];

  // --- État courant (utilisé pour sauvegarder les scènes) ---
  // On appelle les fonctions du personnage au moment du clic : ça marche même
  // si character.js se charge après ce fichier.
  let currentAnim = 'Angry';
  let currentX = window.innerWidth - 120;
  let currentY = 6;
  let currentRot = 0;

  function doPlay(name) {
    currentAnim = name;
    if (typeof window.characterPlay === 'function') window.characterPlay(name);
  }

  function doMove(x, y) {
    currentX = x;
    currentY = y;
    if (typeof window.characterMoveTo === 'function') window.characterMoveTo(x, y);
  }

  function doRotate(deg) {
    currentRot = deg;
    if (typeof window.characterRotate === 'function') window.characterRotate(deg);
  }

  // --- Styles réutilisables ---
  const BTN_OFF = { background: '#2a2520', color: '#ccc', borderColor: '#38332b' };
  const BTN_ON = { background: '#e58e26', color: '#12100e', borderColor: '#e58e26' };

  function makeLabel(text, extra) {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, { color: '#888', marginBottom: '6px', fontSize: '11px' }, extra || {});
    return el;
  }

  function makeButton(text, extra) {
    const btn = document.createElement('button');
    btn.textContent = text;
    Object.assign(btn.style, {
      width: '100%',
      background: '#2a2520',
      border: '1px solid #38332b',
      borderRadius: '4px',
      color: '#ccc',
      padding: '7px',
      cursor: 'pointer',
      fontSize: '11px',
    }, extra || {});
    return btn;
  }

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
  body.appendChild(makeLabel('ANIMATIONS'));

  const grid = document.createElement('div');
  Object.assign(grid.style, {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '5px',
    marginBottom: '14px',
  });

  let activeBtn = null;

  ANIMATIONS.forEach((name) => {
    const btn = makeButton(name.replace(/_/g, ' '), {
      width: 'auto',
      padding: '5px 4px',
      fontSize: '10px',
      textAlign: 'left',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    });
    btn.title = name;

    btn.addEventListener('click', () => {
      doPlay(name);
      if (activeBtn) Object.assign(activeBtn.style, BTN_OFF);
      Object.assign(btn.style, BTN_ON);
      activeBtn = btn;
    });

    grid.appendChild(btn);
  });
  body.appendChild(grid);

  // --- Section position ---
  body.appendChild(makeLabel('POSITION (clic sur la page)'));

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

  const modeBtn = makeButton('📍 Activer placement');
  body.appendChild(modeBtn);

  // Mode placement : clic sur la page pour déplacer le perso
  let placementMode = false;

  function setPlacementMode(on) {
    placementMode = on;
    if (on) {
      Object.assign(modeBtn.style, BTN_ON);
      modeBtn.textContent = '✅ Clic pour placer…';
      document.body.style.cursor = 'crosshair';
    } else {
      Object.assign(modeBtn.style, BTN_OFF);
      modeBtn.textContent = '📍 Activer placement';
      document.body.style.cursor = '';
    }
  }

  modeBtn.addEventListener('click', () => setPlacementMode(!placementMode));

  document.addEventListener('click', (e) => {
    if (!placementMode) return;
    if (panel.contains(e.target)) return;

    const x = e.clientX;
    const y = window.innerHeight - e.clientY; // coordonnées Three.js (Y inversé)

    doMove(x, y);
    coords.textContent = `x: ${x}  y: ${y}`;

    // Désactive le mode après placement
    setPlacementMode(false);
  });

  // --- Déplacement des champs de dialogue (ADMIN UNIQUEMENT) ---
  body.appendChild(makeLabel('POSITION DES CHAMPS', { marginTop: '14px' }));

  let fieldsMoveMode = false;

  const fieldsMoveBtn = makeButton('↔ Déplacer les champs', { marginBottom: '6px' });
  body.appendChild(fieldsMoveBtn);

  const fieldsResetBtn = makeButton('↺ Réinitialiser les champs');
  body.appendChild(fieldsResetBtn);

  const dialogueFields = [
    '.b88-dialogue-bubble',
    '.b88-dialogue-form',
  ];

  function getDialogueElements() {
    return dialogueFields
      .map((selector) => document.querySelector(selector))
      .filter(Boolean);
  }

  function updateFieldsMode() {
    getDialogueElements().forEach((element) => {
      if (fieldsMoveMode) {
        element.style.cursor = 'move';
        element.style.outline = '2px dashed #e58e26';
        element.style.outlineOffset = '3px';
      } else {
        element.style.cursor = '';
        element.style.outline = '';
        element.style.outlineOffset = '';
      }
    });

    fieldsMoveBtn.textContent = fieldsMoveMode
      ? '✅ Désactiver déplacement'
      : '↔ Déplacer les champs';

    Object.assign(fieldsMoveBtn.style, fieldsMoveMode ? BTN_ON : BTN_OFF);
  }

  function attachFieldDragging(element) {
    if (element.dataset.adminDragBound === 'true') return;

    element.dataset.adminDragBound = 'true';
    element.dataset.dragX = '0';
    element.dataset.dragY = '0';

    element.addEventListener('pointerdown', (event) => {
      if (!fieldsMoveMode || event.button !== 0) return;

      event.preventDefault();
      event.stopPropagation();

      const startX = event.clientX;
      const startY = event.clientY;

      const initialX = Number(element.dataset.dragX);
      const initialY = Number(element.dataset.dragY);

      function moveField(moveEvent) {
        const x = initialX + moveEvent.clientX - startX;
        const y = initialY + moveEvent.clientY - startY;

        element.dataset.dragX = String(x);
        element.dataset.dragY = String(y);

        // Translate indépendant du positionnement calculé par dialogue.js
        element.style.translate = `${x}px ${y}px`;
      }

      function stopMoving() {
        document.removeEventListener('pointermove', moveField);
        document.removeEventListener('pointerup', stopMoving);
        document.removeEventListener('pointercancel', stopMoving);
      }

      document.addEventListener('pointermove', moveField);
      document.addEventListener('pointerup', stopMoving);
      document.addEventListener('pointercancel', stopMoving);
    });
  }

  function scanDialogueFields() {
    getDialogueElements().forEach(attachFieldDragging);
    updateFieldsMode();
  }

  fieldsMoveBtn.addEventListener('click', () => {
    fieldsMoveMode = !fieldsMoveMode;
    scanDialogueFields();
  });

  fieldsResetBtn.addEventListener('click', () => {
    getDialogueElements().forEach((element) => {
      element.dataset.dragX = '0';
      element.dataset.dragY = '0';
      element.style.translate = '0px 0px';
    });
  });

  // Le dialogue peut être créé après le chargement du contrôleur.
  const dialogueObserver = new MutationObserver(scanDialogueFields);

  dialogueObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scanDialogueFields();

  // --- Section orientation ---
  body.appendChild(makeLabel('ORIENTATION', { marginTop: '14px' }));

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
    const deg = parseInt(rotSlider.value, 10);
    rotValue.textContent = deg + '°';
    doRotate(deg);
  });

  rotRow.appendChild(rotSlider);
  rotRow.appendChild(rotValue);
  body.appendChild(rotRow);

  // --- Section scènes ---
  body.appendChild(makeLabel('SCÈNES', { marginTop: '14px' }));

  const scenes = [];

  const saveBtn = makeButton('💾 Sauvegarder cette scène', { marginBottom: '8px' });

  const sceneList = document.createElement('div');
  Object.assign(sceneList.style, { fontSize: '10px', color: '#aaa' });

  saveBtn.addEventListener('click', () => {
    const scene = {
      id: scenes.length + 1,
      animation: currentAnim,
      x: currentX,
      y: currentY,
      rotation: currentRot,
      trigger: 'manuel',
    };
    scenes.push(scene);

    const item = document.createElement('div');
    Object.assign(item.style, {
      padding: '4px 6px',
      marginBottom: '3px',
      background: '#2a2520',
      borderRadius: '3px',
      border: '1px solid #38332b',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    });

    const label = document.createElement('span');
    label.textContent = `#${scene.id} — ${scene.animation}`;
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';

    const playBtn = document.createElement('button');
    playBtn.textContent = '▶';
    Object.assign(playBtn.style, {
      background: '#e58e26',
      border: 'none',
      borderRadius: '3px',
      color: '#12100e',
      cursor: 'pointer',
      padding: '2px 6px',
      fontSize: '10px',
      flexShrink: '0',
      marginLeft: '6px',
    });

    playBtn.addEventListener('click', () => {
      doMove(scene.x, scene.y);
      doPlay(scene.animation);
      doRotate(scene.rotation);
    });

    item.appendChild(label);
    item.appendChild(playBtn);
    sceneList.appendChild(item);

    console.info('[controller] scène sauvegardée :', scene);
  });

  body.appendChild(saveBtn);

  const exportBtn = makeButton('📤 Exporter JSON', { marginBottom: '8px' });

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

    const animNames = scenes.map((s) => s.animation).join('-');
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}h${pad(now.getMinutes())}`;

    a.download = `${animNames}_${stamp}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  body.appendChild(exportBtn);
  body.appendChild(sceneList);

  document.body.appendChild(panel);
})();
