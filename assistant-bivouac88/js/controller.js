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
  let currentRot = { x: 0, y: 0, z: 0 }

  function doPlay(name) {
    currentAnim = name;
    if (typeof window.characterPlay === 'function') window.characterPlay(name);
  }

  function doMove(x, y) {
    currentX = x;
    currentY = y;
    if (typeof window.characterMoveTo === 'function') window.characterMoveTo(x, y);
  }

    function doRotate(axis, deg) {
    currentRot[axis] = deg;
    if (typeof window.characterRotate === 'function') {
      window.characterRotate(currentRot.x, currentRot.y, currentRot.z);
    }
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
  const PANEL_POSITION_KEY = 'b88-admin-panel-position';

  function getDefaultPanelPosition() {
    return { x: window.innerWidth - 190 - 16, y: 80 };
  }

  function loadPanelPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch (e) {}
    return getDefaultPanelPosition();
  }

  function savePanelPosition(x, y) {
    try {
      localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ x, y }));
    } catch (e) {}
  }

  const panelPos = loadPanelPosition();

  const panel = document.createElement('div');
  panel.id = 'ctrl-panel';
  Object.assign(panel.style, {
    position: 'fixed',
    left: panelPos.x + 'px',
    top: panelPos.y + 'px',
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

  // Toggle collapse (clic simple sur le header)
  let collapsed = false;
  function toggleCollapsed() {
    collapsed = !collapsed;
    body.style.display = collapsed ? 'none' : 'block';
    document.getElementById('ctrl-toggle').textContent = collapsed ? '▼' : '▲';
  }

  // Déplacement du panel (drag sur le header)
  const DRAG_THRESHOLD_PX = 5;

  header.style.cursor = 'move';

  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;

    const startClientX = event.clientX;
    const startClientY = event.clientY;
    const startLeft = panel.offsetLeft;
    const startTop = panel.offsetTop;
    let dragged = false;

    function movePanel(moveEvent) {
      const dx = moveEvent.clientX - startClientX;
      const dy = moveEvent.clientY - startClientY;

      if (!dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
        dragged = true;
      }
      if (!dragged) return;

      panel.style.left = (startLeft + dx) + 'px';
      panel.style.top = (startTop + dy) + 'px';
    }

    function stopDragging() {
      document.removeEventListener('pointermove', movePanel);
      document.removeEventListener('pointerup', stopDragging);
      document.removeEventListener('pointercancel', stopDragging);

      if (dragged) {
        savePanelPosition(panel.offsetLeft, panel.offsetTop);
      } else {
        toggleCollapsed();
      }
    }

    document.addEventListener('pointermove', movePanel);
    document.addEventListener('pointerup', stopDragging);
    document.addEventListener('pointercancel', stopDragging);
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

  // Décalages actuels des deux champs (pour les sauvegarder dans une scène)
  function getFieldOffsets() {
    const read = (selector) => {
      const el = document.querySelector(selector);
      return {
        x: el ? Number(el.dataset.dragX || 0) : 0,
        y: el ? Number(el.dataset.dragY || 0) : 0,
      };
    };
    return {
      bubble: read('.b88-dialogue-bubble'),
      form: read('.b88-dialogue-form'),
    };
  }

  // Remet les deux champs aux décalages d'une scène sauvegardée
  function applyFieldOffsets(fields) {
    if (!fields) return;
    const apply = (selector, offset) => {
      const el = document.querySelector(selector);
      if (!el || !offset) return;
      el.dataset.dragX = String(offset.x);
      el.dataset.dragY = String(offset.y);
      el.style.translate = `${offset.x}px ${offset.y}px`;
    };
    apply('.b88-dialogue-bubble', fields.bubble);
    apply('.b88-dialogue-form', fields.form);
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
  const dialogueObserver = new MutationObserver(() => {
    const pending = getDialogueElements().filter(
      (el) => el.dataset.adminDragBound !== 'true'
    );
    if (pending.length) scanDialogueFields();
  });
  dialogueObserver.observe(document.body, {
    childList: true,
    subtree: true,
  });

  scanDialogueFields();

    // --- Section orientation (3 axes) ---
  body.appendChild(makeLabel('ORIENTATION', { marginTop: '14px' }));

  const rotSliders = {};

  ['x', 'y', 'z'].forEach((axis) => {
    const row = document.createElement('div');
    Object.assign(row.style, { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' });

    const axisLabel = document.createElement('span');
    axisLabel.textContent = axis.toUpperCase();
    Object.assign(axisLabel.style, { color: '#aaa', fontSize: '11px', width: '12px' });

    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '360';
    slider.value = '0';
    Object.assign(slider.style, { flex: '1', accentColor: '#e58e26', cursor: 'pointer' });

    const value = document.createElement('span');
    value.textContent = '0°';
    Object.assign(value.style, { color: '#aaa', fontSize: '11px', minWidth: '30px' });

    slider.addEventListener('input', () => {
      const deg = parseInt(slider.value, 10);
      value.textContent = deg + '°';
      doRotate(axis, deg);
    });

    rotSliders[axis] = slider;

    row.appendChild(axisLabel);
    row.appendChild(slider);
    row.appendChild(value);
    body.appendChild(row);
  });
  // --- Section scènes ---
  body.appendChild(makeLabel('SCÈNES', { marginTop: '14px' }));

  body.appendChild(makeLabel('Page concernée'));
  const pageSelect = document.createElement('select');
  Object.assign(pageSelect.style, {
    width: '100%',
    background: '#2a2520',
    border: '1px solid #38332b',
    borderRadius: '4px',
    color: '#ccc',
    padding: '6px',
    fontSize: '11px',
    marginBottom: '8px',
  });
  [
    ['accueil', 'Accueil'],
    ['stats', 'Stats'],
    ['etapes', 'Étapes'],
    ['journal', 'Journal de bord'],
    ['meteo-peche', 'Météo & pêche'],
    ['poi', 'POI'],
  ].forEach(([value, text]) => {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = text;
    pageSelect.appendChild(opt);
  });
  body.appendChild(pageSelect);

  const scenes = [];

  const saveBtn = makeButton('💾 Sauvegarder cette scène', { marginBottom: '8px' });

  const sceneList = document.createElement('div');
  Object.assign(sceneList.style, { fontSize: '10px', color: '#aaa' });

    saveBtn.addEventListener('click', () => {
    const offsets = getFieldOffsets();
    const scene = {
      id: scenes.length + 1,
      name: `Scène ${scenes.length + 1} : ${currentAnim}`,
      enabled: true,
      page: pageSelect.value,
      device: {
        type: window.innerWidth < 768 ? 'mobile' : 'pc',
        minWidth: window.innerWidth < 768 ? 0 : 1024,
        maxWidth: window.innerWidth < 768 ? 767 : 2560,
      },
      trigger: { type: 'load', threshold: 0.5 },
      delay: 0,
      once: false,
      points: {
        A: {
          selector: null,
          offsetX: null,
          offsetY: null,
          fallback: { x: currentX, y: currentY },
        },
      },
      steps: [
        {
          animation: currentAnim,
          at: 'A',
          duration: null,
          rotation: { ...currentRot },
          
          bubble: { visible: true, x: offsets.bubble.x, y: offsets.bubble.y, tail: 'bottom' },
          form: { visible: true, x: offsets.form.x, y: offsets.form.y },
        },
      ],
      end: 'hold',
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
    label.textContent = `#${scene.id} — ${scene.steps[0].animation}`;
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
      const step = scene.steps[0];
      const p = scene.points[step.at].fallback;
      doMove(p.x, p.y);
      doPlay(step.animation);
      doRotate('x', step.rotation.x);
      doRotate('y', step.rotation.y);
      doRotate('z', step.rotation.z);
      rotSliders.x.value = step.rotation.x;
      rotSliders.y.value = step.rotation.y;
      rotSliders.z.value = step.rotation.z;
      applyFieldOffsets({ bubble: step.bubble, form: step.form });
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

    const json = JSON.stringify({ version: 1, scenes }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;

    const animNames = scenes.map((s) => s.steps[0].animation).join('-');
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
