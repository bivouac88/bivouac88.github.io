// controller.js — panneau de contrôle (accès admin uniquement via ?edit=bivouac88admin)
// Version 2 : sections déroulantes + scènes au format JSON v2
// (points ancrés sur des éléments, déclencheurs, conditions, étapes riches).
//
// >>> CORRECTIF : la section "SCÈNES ENREGISTRÉES" était incomplète
//     (renderSceneList() et les handlers de saveBtn/exportBtn manquaient),
//     ce qui provoquait une ReferenceError au chargement et empêchait
//     le panneau d'être ajouté à la page. Voir les blocs marqués
//     "// --- RESTAURÉ ---" plus bas.

(function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('edit') !== 'bivouac88admin') {
    return; // Visiteur normal : pas de panneau, le script ne fait rien.
  }

  // ---------------------------------------------------------------
  // Données de référence
  // ---------------------------------------------------------------

  let ANIMATIONS = window.characterAnimations || [];

  // Un seul écouteur : reconstruit la grille d'animations et le menu de marche
  document.addEventListener('b88:animations-ready', (e) => {
    ANIMATIONS = e.detail.animations;
    buildAnimationButtons();
    refreshWalkAnimSelect();
  });


  const PAGES = [
    ['test', 'Index'],
    ['accueil', 'Résumé'],
    ['stats', 'Stats'],
    ['etapes', 'Étapes'],
    ['journal', 'Journal de bord'],
    ['meteo-peche', 'Météo & pêche'],
    ['poi', 'POI'],
  ];

  const DEVICES = [
    ['mobile', 'Mobile (< 768 px)'],
    ['pc', 'PC (≥ 768 px)'],
  ];

  const TRIGGERS = [
    ['load', 'Au chargement de la page'],
    ['enter', 'Un élément entre dans l\'écran'],
    ['scroll', 'Scroll : % de la page'],
    ['avatar-click', 'Clic sur l\'avatar'],
    ['element-click', 'Clic sur un élément'],
    ['hover', 'Survol d\'un élément'],
    ['idle', 'Inactivité (secondes)'],
    ['after-scene', 'Fin d\'une autre scène'],
    ['event', 'Événement personnalisé'],
  ];
  const PANEL_POSITION_KEY = 'b88-admin-panel-position';
  const PANEL_WIDTH = 270;

  // ---------------------------------------------------------------
  // Petits utilitaires
  // ---------------------------------------------------------------
  const r2 = (n) => Math.round(n * 100) / 100;
  const num = (v) => {
    const n = parseFloat(v);
    return Number.isFinite(n) ? n : null;
  };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------------------------------------------------------------
  // État courant de l'avatar (utilisé pour sauvegarder les scènes)
  // On appelle les fonctions du personnage au moment du clic : ça marche même
  // si character.js se charge après ce fichier.
  // ---------------------------------------------------------------
  let currentAnim = 'Angry';
  let currentX = window.innerWidth - 120;
  let currentY = 6;
  let currentRot = { x: 0, y: 0, z: 0 };

  function doPlay(name) {
    currentAnim = name;
    if (typeof updateAnimSelection === 'function') updateAnimSelection();
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

  // Position réelle de l'avatar (fonctionne aussi s'il a été déplacé à la souris)
  function getAvatarPos() {
    if (typeof window.characterGetPosition === 'function') {
      const p = window.characterGetPosition();
      if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return { x: p.x, y: p.y };
    }
    return { x: currentX, y: currentY };
  }

  // ---------------------------------------------------------------
  // Styles et fabriques d'éléments
  // ---------------------------------------------------------------

  const BTN_OFF = { background: '#2a2520', color: '#ccc', borderColor: '#38332b' };
  const BTN_ON = { background: '#e58e26', color: '#12100e', borderColor: '#e58e26' };

  const FIELD_STYLE = {
    width: '100%',
    background: '#2a2520',
    border: '1px solid #38332b',
    borderRadius: '4px',
    color: '#ccc',
    padding: '5px 6px',
    fontSize: '11px',
    boxSizing: 'border-box',
    userSelect: 'text',
  };

  function makeLabel(text, extra) {
    const el = document.createElement('div');
    el.textContent = text;
    Object.assign(el.style, { color: '#888', marginBottom: '6px', fontSize: '11px' }, extra || {});
    return el;
  }

  function makeButton(text, extra) {
    const btn = document.createElement('button');
    btn.type = 'button';
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

  function makeInput(type, placeholder, value) {
    const input = document.createElement('input');
    input.type = type;
    if (placeholder) input.placeholder = placeholder;
    if (value !== undefined) input.value = value;
    Object.assign(input.style, FIELD_STYLE);
    return input;
  }

  function makeSelect(options, value) {
    const select = document.createElement('select');
    Object.assign(select.style, FIELD_STYLE);
    options.forEach(([val, text]) => {
      const opt = document.createElement('option');
      opt.value = val;
      opt.textContent = text;
      select.appendChild(opt);
    });
    if (value !== undefined) select.value = value;
    return select;
  }

  // Ligne "étiquette + champ"
  function makeRow(labelText, control) {
    const row = document.createElement('div');
    row.style.marginBottom = '7px';
    row.appendChild(makeLabel(labelText, { marginBottom: '3px', fontSize: '10px' }));
    row.appendChild(control);
    return row;
  }

  // Case à cocher avec texte
  function makeCheck(labelText, checked) {
    const label = document.createElement('label');
    Object.assign(label.style, {
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      marginBottom: '4px',
      fontSize: '11px',
      color: '#ccc',
      cursor: 'pointer',
    });
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.style.accentColor = '#e58e26';
    const span = document.createElement('span');
    span.textContent = labelText;
    label.append(input, span);
    return { label, input };
  }

  function makeListItem() {
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
      gap: '6px',
      fontSize: '10px',
      color: '#aaa',
    });
    return item;
  }

  function makeMiniButton(text, bg, title) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = text;
    if (title) btn.title = title;
    Object.assign(btn.style, {
      background: bg || '#e58e26',
      border: 'none',
      borderRadius: '3px',
      color: '#12100e',
      cursor: 'pointer',
      padding: '2px 6px',
      fontSize: '10px',
      flexShrink: '0',
    });
    return btn;
  }

  // ---------------------------------------------------------------
  // Panneau
  // ---------------------------------------------------------------

  function getDefaultPanelPosition() {
    return { x: window.innerWidth - PANEL_WIDTH - 16, y: 80 };
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
    width: PANEL_WIDTH + 'px',
    fontFamily: 'Arial, sans-serif',
    fontSize: '12px',
    color: '#eee',
    userSelect: 'none',
  });
function setPanelPosition(x, y) {
  const maxX = Math.max(0, window.innerWidth - panel.offsetWidth);
  const maxY = Math.max(0, window.innerHeight - panel.offsetHeight);

  const safeX = Math.max(0, Math.min(x, maxX));
  const safeY = Math.max(0, Math.min(y, maxY));

  panel.style.left = safeX + 'px';
  panel.style.top = safeY + 'px';
}
  // Titre + toggle
  const header = document.createElement('div');
  Object.assign(header.style, {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
    cursor: 'pointer',
  });
  header.innerHTML = `<strong style="color:#e58e26">🎮 Contrôleur</strong><span id="ctrl-toggle">▼</span>`;
  panel.appendChild(header);

  const body = document.createElement('div');
  body.id = 'ctrl-body';
  Object.assign(body.style, {
    maxHeight: 'calc(100vh - 150px)',
    overflowY: 'auto',
    paddingRight: '2px',
    display: 'none', // replié au chargement
  });
  panel.appendChild(body);

  // Toggle collapse (clic simple sur le header)
  let collapsed = true;
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

      setPanelPosition(startLeft + dx, startTop + dy);
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

  // ---------------------------------------------------------------
  // Sections déroulantes
  // ---------------------------------------------------------------

  function makeSection(title, openByDefault) {
    const wrap = document.createElement('div');
    wrap.style.borderTop = '1px solid #38332b';

    const head = document.createElement('button');
    head.type = 'button';
    Object.assign(head.style, {
      width: '100%',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      background: 'none',
      border: 'none',
      color: '#e58e26',
      padding: '8px 2px',
      fontSize: '11px',
      fontWeight: 'bold',
      cursor: 'pointer',
      textAlign: 'left',
    });

    const label = document.createElement('span');
    label.textContent = title;
    const arrow = document.createElement('span');
    arrow.textContent = '▸';
    head.append(label, arrow);

    const content = document.createElement('div');
    Object.assign(content.style, { display: 'none', padding: '2px 0 10px' });

const section = {
  content,
  head,
  open() { content.style.display = 'block'; arrow.textContent = '▾'; },
  close() { content.style.display = 'none'; arrow.textContent = '▸'; },
  isOpen() { return content.style.display !== 'none'; },
};

    head.addEventListener('click', () => {
      section.isOpen() ? section.close() : section.open();
    });

    wrap.append(head, content);
    body.appendChild(wrap);

    if (openByDefault) section.open();
    return section;
  }

  // ---------------------------------------------------------------
  // Section : animations (en premier, un seul onglet dépliable)
  // ---------------------------------------------------------------

  const secAnim = makeSection('ANIMATIONS', true);

  // Menu déroulant : une seule ligne visible (l'animation actuelle),
  // un clic dessus déroule la liste, un clic sur un choix la joue et referme.
  const animSelect = document.createElement('div');
  animSelect.style.position = 'relative';

  const animCurrent = makeButton('', {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    textAlign: 'left',
    padding: '7px 8px',
  });
  const animCurrentText = document.createElement('span');
  Object.assign(animCurrentText.style, {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  });
  const animCurrentArrow = document.createElement('span');
  animCurrentArrow.textContent = '▾';
  animCurrentArrow.style.flexShrink = '0';
  animCurrent.append(animCurrentText, animCurrentArrow);

  const animList = document.createElement('div');
  Object.assign(animList.style, {
    display: 'none',
    maxHeight: '220px',
    overflowY: 'auto',
    marginTop: '3px',
    background: '#2a2520',
    border: '1px solid #38332b',
    borderRadius: '4px',
  });

  animSelect.append(animCurrent, animList);
  secAnim.content.appendChild(animSelect);

  function setAnimListOpen(open) {
    animList.style.display = open ? 'block' : 'none';
    animCurrentArrow.textContent = open ? '▴' : '▾';
  }

  animCurrent.addEventListener('click', () => {
    setAnimListOpen(animList.style.display === 'none');
  });

  // Met à jour la ligne visible et la mise en évidence dans la liste
  function updateAnimSelection() {
    animCurrentText.textContent = currentAnim.replace(/_/g, ' ');
    [...animList.children].forEach((item) => {
      Object.assign(item.style, item.dataset.name === currentAnim ? BTN_ON : { background: 'transparent', color: '#ccc' });
    });
  }

  function buildAnimationButtons() {
    animList.replaceChildren();
    ANIMATIONS.forEach((name) => {
      const item = document.createElement('div');
      item.textContent = name.replace(/_/g, ' ');
      item.title = name;
      item.dataset.name = name;
      Object.assign(item.style, {
        padding: '5px 8px',
        fontSize: '11px',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      });
      item.addEventListener('mouseenter', () => {
        if (item.dataset.name !== currentAnim) item.style.background = '#38332b';
      });
      item.addEventListener('mouseleave', () => {
        if (item.dataset.name !== currentAnim) item.style.background = 'transparent';
      });
      item.addEventListener('click', () => {
        doPlay(name);
        setAnimListOpen(false);
      });
      animList.appendChild(item);
    });
    updateAnimSelection();
  }

  buildAnimationButtons();

  // ---------------------------------------------------------------
  // Éléments de la page : détection et sélecteurs CSS
  // ---------------------------------------------------------------

  function isIgnored(el) {
    return !!el.closest('#ctrl-panel, #b88-character, .b88-dialogue');
  }

  // Élément de la page situé sous un point écran (hors avatar, bulles et panneau)
  function elementAt(x, y) {
    return document.elementsFromPoint(x, y).find((el) =>
      !isIgnored(el) && el !== document.documentElement
    ) || null;
  }

  // Sélecteur CSS stable pour retrouver un élément
  function cssPath(el) {
    if (!el || el === document.body) return null;

    const parts = [];
    let node = el;

    while (node && node.nodeType === 1 && node !== document.body) {
      if (node.id) {
        parts.unshift('#' + CSS.escape(node.id));
        break;
      }

      let part = node.tagName.toLowerCase();
      const classes = [...node.classList].filter((c) => !c.startsWith('b88-')).slice(0, 2);
      if (classes.length) part += '.' + classes.map((c) => CSS.escape(c)).join('.');

      const parent = node.parentElement;
      if (parent) {
        const sameTag = [...parent.children].filter((s) => s.tagName === node.tagName);
        if (sameTag.length > 1) part += `:nth-of-type(${sameTag.indexOf(node) + 1})`;
      }

      parts.unshift(part);
      node = node.parentElement;
    }

    return parts.join(' > ');
  }

  // Position réelle d'un point (même formule que le lecteur de scènes)
  // Retourne des coordonnées avatar : x depuis la gauche, y depuis le bas.
  function resolvePoint(p) {
    const el = p.selector ? document.querySelector(p.selector) : null;

    if (el) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + (p.ax / 100) * rect.width + (p.offsetX || 0);
      const yTop = rect.top + (p.ay / 100) * rect.height + (p.offsetY || 0);
      return { x, y: window.innerHeight - yTop };
    }

    return {
      x: (p.fallback.xPct / 100) * window.innerWidth,
      y: (p.fallback.yPct / 100) * window.innerHeight,
    };
  }

  // Mode "choisir un élément" : le prochain clic sur la page désigne un élément
  let pickCallback = null;

  function pickElement(callback) {
    setPlacementMode(false);
    pickCallback = callback;
    document.body.style.cursor = 'crosshair';
  }

  document.addEventListener('click', (e) => {
    if (!pickCallback) return;
    if (panel.contains(e.target)) return;

    e.preventDefault();
    e.stopPropagation();

    const el = elementAt(e.clientX, e.clientY);
    const cb = pickCallback;
    pickCallback = null;
    document.body.style.cursor = '';

    if (el) cb(el);
  }, true);

  // ---------------------------------------------------------------
  // Section : position
  // ---------------------------------------------------------------

  const secPos = makeSection('POSITION');

  secPos.content.appendChild(makeLabel('Clic sur la page pour placer l\'avatar'));

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
  secPos.content.appendChild(coords);

  const modeBtn = makeButton('📍 Activer placement');
  secPos.content.appendChild(modeBtn);

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
      if (!pickCallback) document.body.style.cursor = '';
    }
  }

  modeBtn.addEventListener('click', () => setPlacementMode(!placementMode));

  document.addEventListener('click', (e) => {
    if (!placementMode) return;
    if (panel.contains(e.target)) return;

    const x = e.clientX;
    const y = window.innerHeight - e.clientY; // coordonnées Three.js (Y inversé)

    doMove(x, y);

    // Désactive le mode après placement
    setPlacementMode(false);
  });

// Affichage de la position réelle uniquement quand la section est ouverte
let positionInterval = null;

function updateAvatarCoords() {
  const p = getAvatarPos();
  coords.textContent = `x: ${Math.round(p.x)}  y: ${Math.round(p.y)}`;
}

function startPositionUpdates() {
  if (positionInterval !== null) return;

  updateAvatarCoords();
  positionInterval = setInterval(updateAvatarCoords, 250);
}

function stopPositionUpdates() {
  if (positionInterval !== null) {
    clearInterval(positionInterval);
    positionInterval = null;
  }
}

secPos.head.addEventListener('click', () => {
  if (secPos.isOpen()) {
    startPositionUpdates();
  } else {
    stopPositionUpdates();
  }
});

  // ---------------------------------------------------------------
  // Section : hitbox (prévisualisation admin uniquement)
  // ---------------------------------------------------------------

  const HITBOX_KEY = 'b88-admin-hitbox-settings';

  function loadHitboxSettings() {
    const defaults = { width: 140, height: 145, offsetX: 0, offsetY: 0 };
    try {
      const saved = JSON.parse(localStorage.getItem(HITBOX_KEY));
      if (saved && typeof saved === 'object') {
        return {
          width: Number(saved.width) || defaults.width,
          height: Number(saved.height) || defaults.height,
          offsetX: Number(saved.offsetX) || 0,
          offsetY: Number(saved.offsetY) || 0,
        };
      }
    } catch (e) {}
    return defaults;
  }

  const hitboxSettings = loadHitboxSettings();
  const secHitbox = makeSection('HITBOX');

  secHitbox.content.appendChild(
    makeLabel('Réglages de la zone cliquable — prévisualisation uniquement')
  );

  const hitboxFields = {};

  [
    ['width', 'Largeur (px)', 20, 1000],
    ['height', 'Hauteur (px)', 20, 1000],
    ['offsetX', 'Décalage horizontal (px)', -500, 500],
    ['offsetY', 'Décalage vertical (px)', -500, 500],
  ].forEach(([key, label, min, max]) => {
    const input = makeInput('number', '', hitboxSettings[key]);
    input.min = min;
    input.max = max;
    input.step = 1;

    input.addEventListener('input', () => {
      const value = parseFloat(input.value);
      if (Number.isFinite(value)) {
        hitboxSettings[key] = Math.max(min, Math.min(max, value));
      }
    });

    hitboxFields[key] = input;
    secHitbox.content.appendChild(makeRow(label, input));
  });

  const hitboxSaveBtn = makeButton('💾 Sauvegarder les réglages', {
    marginTop: '4px',
  });
  secHitbox.content.appendChild(hitboxSaveBtn);

  const hitboxStatus = makeLabel('Prévisualisation active lorsque cette section est ouverte.');
  secHitbox.content.appendChild(hitboxStatus);

  const hitboxPreview = document.createElement('div');
  Object.assign(hitboxPreview.style, {
    position: 'fixed',
    display: 'none',
    pointerEvents: 'none',
    zIndex: '9998',
    boxSizing: 'border-box',
    border: '2px dashed #ff3333',
    background: 'rgba(255, 50, 50, 0.12)',
    borderRadius: '3px',
  });
  document.body.appendChild(hitboxPreview);

let hitboxAnimationFrame = null;

function updateHitboxPreview() {
  hitboxAnimationFrame = null;

  if (!secHitbox.isOpen() || !window.characterGetScreenBounds) {
    hitboxPreview.style.display = 'none';
    return;
  }

  const bounds = window.characterGetScreenBounds();

  if (!bounds) {
    hitboxPreview.style.display = 'none';
  } else {
    const centerX = (bounds.left + bounds.right) / 2;
    const centerY = (bounds.top + bounds.bottom) / 2;

    const width = Math.max(1, hitboxSettings.width);
    const height = Math.max(1, hitboxSettings.height);

    hitboxPreview.style.display = 'block';
    hitboxPreview.style.width = width + 'px';
    hitboxPreview.style.height = height + 'px';
    hitboxPreview.style.left = (centerX + hitboxSettings.offsetX - width / 2) + 'px';
    hitboxPreview.style.top = (centerY + hitboxSettings.offsetY - height / 2) + 'px';
  }

  hitboxAnimationFrame = requestAnimationFrame(updateHitboxPreview);
}

function startHitboxPreview() {
  if (hitboxAnimationFrame !== null) return;
  hitboxAnimationFrame = requestAnimationFrame(updateHitboxPreview);
}

function stopHitboxPreview() {
  if (hitboxAnimationFrame !== null) {
    cancelAnimationFrame(hitboxAnimationFrame);
    hitboxAnimationFrame = null;
  }

  hitboxPreview.style.display = 'none';
}

secHitbox.head.addEventListener('click', () => {
  if (secHitbox.isOpen()) {
    startHitboxPreview();
  } else {
    stopHitboxPreview();
  }
});
  // ---------------------------------------------------------------
  // Section : orientation (3 axes)
  // ---------------------------------------------------------------

  const secRot = makeSection('ORIENTATION');
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

    rotSliders[axis] = { slider, value };

    row.appendChild(axisLabel);
    row.appendChild(slider);
    row.appendChild(value);
    secRot.content.appendChild(row);
  });

  function setSliders(rot) {
    ['x', 'y', 'z'].forEach((axis) => {
      rotSliders[axis].slider.value = rot[axis];
      rotSliders[axis].value.textContent = rot[axis] + '°';
    });
  }

  // ---------------------------------------------------------------
  // Section : champs de dialogue (bulle et champ de saisie)
  // ---------------------------------------------------------------

  const secFields = makeSection('CHAMPS DE DIALOGUE');

  let fieldsMoveMode = false;

  const fieldsMoveBtn = makeButton('↔ Déplacer les champs', { marginBottom: '6px' });
  secFields.content.appendChild(fieldsMoveBtn);

  const fieldsResetBtn = makeButton('↺ Réinitialiser les champs');
  secFields.content.appendChild(fieldsResetBtn);

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

  // ---------------------------------------------------------------
  // Section : scène (identité, pages, appareils)
  // ---------------------------------------------------------------

  const secScene = makeSection('SCÈNE : OÙ ET POUR QUI');

  const nameInput = makeInput('text', 'Nom (optionnel)');
  secScene.content.appendChild(makeRow('Nom de la scène', nameInput));

  const priorityInput = makeInput('number', '0', '0');
  secScene.content.appendChild(makeRow('Priorité (la plus haute gagne en cas de conflit)', priorityInput));

  secScene.content.appendChild(makeLabel('Pages concernées', { marginBottom: '3px', fontSize: '10px' }));
  const pageChecks = {};
  PAGES.forEach(([value, text]) => {
    const { label, input } = makeCheck(text, value === 'test');
    pageChecks[value] = input;
    secScene.content.appendChild(label);
  });

  secScene.content.appendChild(makeLabel('Appareils', { marginBottom: '3px', marginTop: '8px', fontSize: '10px' }));
  const deviceChecks = {};
  DEVICES.forEach(([value, text]) => {
    const { label, input } = makeCheck(text, value === 'pc');
    deviceChecks[value] = input;
    secScene.content.appendChild(label);
  });

  // ---------------------------------------------------------------
  // Section : déclencheur
  // ---------------------------------------------------------------

  const secTrigger = makeSection('DÉCLENCHEUR');

  const trigType = makeSelect(TRIGGERS, 'load');
  secTrigger.content.appendChild(makeRow('Quand la scène démarre', trigType));

  const trigSelector = makeInput('text', 'ex : #photos');
  const trigPickBtn = makeButton('🎯 Choisir l\'élément (clic)', { marginTop: '4px' });
  const trigSelectorRow = makeRow('Élément concerné', trigSelector);
  trigSelectorRow.appendChild(trigPickBtn);
  secTrigger.content.appendChild(trigSelectorRow);

  trigPickBtn.addEventListener('click', () => {
    pickElement((el) => {
      trigSelector.value = cssPath(el) || 'body';
    });
  });

  const trigValue = makeInput('text', '');
  const trigValueLabel = makeLabel('', { marginBottom: '3px', fontSize: '10px' });
  const trigValueRow = document.createElement('div');
  trigValueRow.style.marginBottom = '7px';
  trigValueRow.append(trigValueLabel, trigValue);
  secTrigger.content.appendChild(trigValueRow);

  const trigDelay = makeInput('number', '0', '0');
  secTrigger.content.appendChild(makeRow('Délai avant de démarrer (secondes)', trigDelay));

  const trigLeave = makeSelect([
    ['hold', 'Rester en place'],
    ['stop', 'S\'arrêter'],
  ], 'hold');

  const trigLeaveRow = makeRow('Quand le déclencheur disparaît (sortie d\'écran, fin de survol)', trigLeave);
  secTrigger.content.appendChild(trigLeaveRow);

const TRIGGER_VALUE_INFO = {
  enter: {
    label: 'Seuil de visibilité',
    placeholder: 'Exemple : 0.5',
    help: 'Déclenche la scène lorsque l’élément devient suffisamment visible. 0 = aucun seuil, 1 = entièrement visible.',
    type: 'number',
    min: 0,
    max: 1,
    step: 0.05,
    value: '0.5',
  },
  scroll: {
    label: 'Pourcentage de défilement',
    placeholder: 'Exemple : 50',
    help: 'Définit le pourcentage de défilement auquel la scène doit se déclencher.',
    type: 'number',
    min: 0,
    max: 100,
    step: 1,
    value: '50',
  },
  idle: {
    label: 'Durée sans activité (secondes)',
    placeholder: 'Exemple : 10',
    help: 'La scène se déclenche après cette durée sans activité de l’utilisateur.',
    type: 'number',
    min: 0,
    step: 1,
    value: '10',
  },
  'after-scene': {
    label: 'Identifiant de la scène précédente',
    placeholder: 'Exemple : 2',
    help: 'La scène démarre lorsque la scène indiquée est terminée.',
    type: 'number',
    min: 1,
    step: 1,
    value: '',
  },
  event: {
    label: 'Nom de l’événement personnalisé',
    placeholder: 'Exemple : b88:mon-evenement',
    help: 'La scène démarre lorsqu’un événement portant exactement ce nom est envoyé.',
    type: 'text',
    value: 'b88:',
  },
};

const trigHelp = makeLabel('', {
  fontSize: '10px',
  marginBottom: '7px',
});
trigHelp.style.color = '#c5a879';
secTrigger.content.insertBefore(trigHelp, trigSelectorRow);

function refreshTriggerUI(resetValue) {
  const type = trigType.value;
  const info = TRIGGER_VALUE_INFO[type];

  const needsSelector = ['enter', 'element-click', 'hover'].includes(type);

  trigSelectorRow.style.display = needsSelector ? 'block' : 'none';
  trigValueRow.style.display = info ? 'block' : 'none';
  trigLeaveRow.style.display = ['enter', 'scroll', 'hover'].includes(type)
    ? 'block'
    : 'none';

  if (info) {
    trigValueLabel.textContent = info.label;
    trigValue.placeholder = info.placeholder;
    trigValue.type = info.type;

    trigValue.min = info.min ?? '';
    trigValue.max = info.max ?? '';
    trigValue.step = info.step ?? '';

    trigHelp.textContent = info.help;

    if (resetValue) {
      trigValue.value = info.value;
    }
  } else {
    trigHelp.textContent = {
      load: 'La scène démarre au chargement de la page.',
      'avatar-click': 'La scène démarre lorsque le visiteur clique sur le personnage.',
      'element-click': 'La scène démarre lorsque le visiteur clique sur l’élément choisi.',
      hover: 'La scène démarre lorsque le visiteur passe la souris sur l’élément choisi.',
    }[type] || '';
  }

  if (needsSelector) {
    trigSelector.placeholder = 'Exemple : #photos ou .mon-element';
  }
}

trigType.addEventListener('change', () => refreshTriggerUI(true));
refreshTriggerUI(true);

  function buildTrigger() {
    const type = trigType.value;
    const trigger = { type, delay: num(trigDelay.value) || 0 };

    if (['enter', 'element-click', 'hover'].includes(type)) {
      const selector = trigSelector.value.trim();
      if (!selector) {
        alert('Ce déclencheur demande un élément : choisis-le ou saisis un sélecteur.');
        return null;
      }
      trigger.selector = selector;
    }

    if (type === 'enter') trigger.threshold = num(trigValue.value) ?? 0.5;
    if (type === 'scroll') trigger.scrollPct = num(trigValue.value) ?? 50;
    if (type === 'idle') trigger.idleSeconds = num(trigValue.value) ?? 10;

    if (type === 'after-scene') {
      const id = num(trigValue.value);
      if (id === null) {
        alert('Indique l\'ID de la scène qui doit se terminer avant celle-ci.');
        return null;
      }
      trigger.afterScene = id;
    }

    if (type === 'event') {
      const eventName = trigValue.value.trim();
      if (!eventName) {
        alert('Indique le nom de l\'événement.');
        return null;
      }
      trigger.eventName = eventName;
    }

    if (['enter', 'scroll', 'hover'].includes(type)) trigger.leave = trigLeave.value;

    return trigger;
  }

  function applyTriggerToUI(trigger) {
    trigType.value = trigger.type;
    refreshTriggerUI(false);
    trigDelay.value = trigger.delay ?? 0;
    trigSelector.value = trigger.selector || '';
    trigLeave.value = trigger.leave || 'hold';

    const valueByType = {
      enter: trigger.threshold,
      scroll: trigger.scrollPct,
      idle: trigger.idleSeconds,
      'after-scene': trigger.afterScene,
      event: trigger.eventName,
    };
    trigValue.value = valueByType[trigger.type] ?? '';
  }

  // ---------------------------------------------------------------
  // Section : conditions et fin de scène
  // ---------------------------------------------------------------

  const secEnd = makeSection('CONDITIONS ET FIN');

  const condFrequency = makeSelect([
    ['always', 'À chaque déclenchement'],
    ['load', 'Une fois par chargement de page'],
    ['session', 'Une fois par session'],
    ['visitor', 'Une fois par visiteur'],
  ], 'always');
  secEnd.content.appendChild(makeRow('Fréquence', condFrequency));

  const condCooldown = makeInput('number', '0', '0');
  secEnd.content.appendChild(makeRow('Délai minimum entre deux lancements (secondes)', condCooldown));

  const { label: interruptibleLabel, input: condInterruptible } = makeCheck('Peut être interrompue par une autre scène', true);
  secEnd.content.appendChild(interruptibleLabel);

  const endAction = makeSelect([
    ['hold', 'Rester en place à la fin'],
    ['chain', 'Enchaîner sur une autre scène'],
  ], 'hold');

  secEnd.content.appendChild(makeRow('Fin de scène', endAction));

  const endNext = makeInput('number', 'ID de la scène suivante');
  const endNextRow = makeRow('Scène à enchaîner (ID)', endNext);
  secEnd.content.appendChild(endNextRow);

  const endRepeat = makeInput('number', '1', '1');
  secEnd.content.appendChild(makeRow('Répétitions (0 = en boucle)', endRepeat));

  function refreshEndUI() {
    endNextRow.style.display = endAction.value === 'chain' ? 'block' : 'none';
  }
  endAction.addEventListener('change', refreshEndUI);
  refreshEndUI();

  // ---------------------------------------------------------------
  // Section : points (ancrés sur un élément de la page)
  // ---------------------------------------------------------------

  const secPoints = makeSection('POINTS');

  let draftPoints = {};
  let draftSteps = [];

  const pointMode = makeSelect([
    ['screen', 'Collé à l\'écran (calculé au départ)'],
    ['follow', 'Suit l\'élément pendant le scroll'],
  ], 'screen');
  secPoints.content.appendChild(makeRow('Mode du prochain point', pointMode));

  const addPointBtn = makeButton('📌 Créer un point ici', { marginBottom: '6px' });
  secPoints.content.appendChild(addPointBtn);

  const addPointOnBtn = makeButton('🎯 Créer un point sur un autre élément', { marginBottom: '8px' });
  secPoints.content.appendChild(addPointOnBtn);

  const pointsList = document.createElement('div');
  secPoints.content.appendChild(pointsList);

  function nextPointLetter() {
    for (let i = 0; i < 26; i++) {
      const letter = String.fromCharCode(65 + i);
      if (!draftPoints[letter]) return letter;
    }
    return null;
  }

  // Crée un point à l'endroit où se trouve l'avatar, ancré sur l'élément en dessous
  function createPoint(forcedElement) {
    const letter = nextPointLetter();
    if (!letter) {
      alert('Maximum 26 points par scène.');
      return;
    }

    const pos = getAvatarPos();
    const clientX = pos.x;
    const clientY = window.innerHeight - pos.y;

    let el = forcedElement || elementAt(clientX, clientY);
    if (el === document.body || el === document.documentElement) el = null;

    const point = {
      selector: null,
      ax: null,
      ay: null,
      offsetX: 0,
      offsetY: 0,
      mode: pointMode.value,
      fallback: {
        xPct: r2((pos.x / window.innerWidth) * 100),
        yPct: r2((pos.y / window.innerHeight) * 100),
      },
    };

    if (el) {
      const rect = el.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        point.selector = cssPath(el);
        point.ax = r2(((clientX - rect.left) / rect.width) * 100);
        point.ay = r2(((clientY - rect.top) / rect.height) * 100);
      }
    }

    draftPoints[letter] = point;
    refreshPointsUI();
    stepPoint.value = letter;
  }

  addPointBtn.addEventListener('click', () => createPoint(null));
  addPointOnBtn.addEventListener('click', () => pickElement((el) => createPoint(el)));

  function refreshPointsUI() {
    pointsList.replaceChildren();

    Object.entries(draftPoints).forEach(([letter, p]) => {
      const item = makeListItem();
      const label = document.createElement('span');
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';
      label.textContent = `${letter} — ${p.selector || 'écran'} (${p.mode === 'follow' ? 'suit' : 'écran'})`;
      label.title = p.selector || 'position écran uniquement';

      const del = makeMiniButton('✕', '#8a3b2e', 'Supprimer ce point');
      del.addEventListener('click', () => {
        if (draftSteps.some((s) => s.at === letter)) {
          alert(`Le point ${letter} est utilisé par une étape : supprime d'abord cette étape.`);
          return;
        }
        delete draftPoints[letter];
        refreshPointsUI();
      });

      item.append(label, del);
      pointsList.appendChild(item);
    });

    // Met à jour la liste de choix des étapes
    const previous = stepPoint.value;
    stepPoint.replaceChildren();
    Object.keys(draftPoints).forEach((letter) => {
      const opt = document.createElement('option');
      opt.value = letter;
      opt.textContent = `Point ${letter}`;
      stepPoint.appendChild(opt);
    });
    if (draftPoints[previous]) stepPoint.value = previous;
  }

  // ---------------------------------------------------------------
  // Section : étapes
  // ---------------------------------------------------------------

  const secSteps = makeSection('ÉTAPES');

  secSteps.content.appendChild(makeLabel(
    'CONSTRUIRE UNE ÉTAPE',
    {
      color: '#e58e26',
      fontSize: '11px',
      fontWeight: 'bold',
      marginTop: '2px',
    }
  ));

  secSteps.content.appendChild(makeLabel(
    'Une étape définit ce que fait le personnage à un moment précis de la scène.',
    { fontSize: '10px', lineHeight: '1.5', marginBottom: '8px' }
  ));

  secSteps.content.appendChild(makeLabel(
    '1. Choisis l’animation du personnage.',
    { fontSize: '10px', color: '#bbb', marginBottom: '5px' }
  ));

  secSteps.content.appendChild(animSelect);
  secAnim.head.style.display = 'none';

  secSteps.content.appendChild(makeLabel(
    '2. Choisis le point où le personnage doit se rendre.',
    { fontSize: '10px', color: '#bbb', marginBottom: '8px' }
  ));

  secSteps.content.appendChild(makeLabel(
    '3. Règle le déplacement, le timing et les options complémentaires.',
    { fontSize: '10px', color: '#bbb', marginBottom: '10px' }
  ));

  const stepPoint = makeSelect([]);
  secSteps.content.appendChild(makeRow('Point où se joue l\'étape', stepPoint));

  secSteps.content.appendChild(makeLabel(
    'Le personnage sera positionné à ce point. Crée d’abord tes points dans la section POINTS.',
    { fontSize: '10px', lineHeight: '1.4' }
  ));
  
  const stepDuration = makeInput('number', 'vide = jusqu\'à la suite');
  secSteps.content.appendChild(makeRow('Durée (secondes)', stepDuration));

  const stepPause = makeInput('number', '0', '0');
  secSteps.content.appendChild(makeRow('Pause avant l\'étape (secondes)', stepPause));

  const stepMove = makeSelect([
    ['instant', 'Instantané'],
    ['walk', 'À pied'],
  ], 'instant');
  secSteps.content.appendChild(makeRow('Déplacement vers le point', stepMove));

  const stepSpeed = makeInput('number', '200', '200');
  const stepSpeedRow = makeRow('Vitesse (pixels par seconde)', stepSpeed);
  secSteps.content.appendChild(stepSpeedRow);

  const stepWalkAnim = makeSelect(
    ANIMATIONS.map((a) => [a, a.replace(/_/g, ' ')]),
    'Running'
  );
  const stepWalkAnimRow = makeRow('Animation de marche', stepWalkAnim);
  secSteps.content.appendChild(stepWalkAnimRow);

  // Reconstruit le menu d'animation de marche (appelé quand les animations arrivent)
  function refreshWalkAnimSelect() {
    if (!ANIMATIONS.length) return;
    const current = stepWalkAnim.value;
    stepWalkAnim.replaceChildren();
    ANIMATIONS.forEach((a) => {
      const opt = document.createElement('option');
      opt.value = a;
      opt.textContent = a.replace(/_/g, ' ');
      stepWalkAnim.appendChild(opt);
    });
    stepWalkAnim.value = ANIMATIONS.includes(current)
      ? current
      : (ANIMATIONS.includes('Running') ? 'Running' : ANIMATIONS[0]);
  }

  const { label: autoFaceLabel, input: stepAutoFace } = makeCheck('Tourner dans le sens de la marche', true);
  secSteps.content.appendChild(autoFaceLabel);

  function refreshStepUI() {
    const walk = stepMove.value === 'walk';
    stepSpeedRow.style.display = walk ? 'block' : 'none';
    stepWalkAnimRow.style.display = walk ? 'block' : 'none';
    autoFaceLabel.style.display = walk ? 'flex' : 'none';
  }
  stepMove.addEventListener('change', refreshStepUI);
  refreshStepUI();

 
  const addStepBtn = makeButton('➕ Ajouter cette étape', {
    marginBottom: '8px',
    marginTop: '4px',
  });
  secSteps.content.appendChild(addStepBtn);

  const stepsList = document.createElement('div');
  secSteps.content.appendChild(stepsList);

  let editingStepIndex = null;

  function resetStepEditor() {
    editingStepIndex = null;
    addStepBtn.textContent = '➕ Ajouter cette étape';
  }

  function loadStepIntoEditor(index) {
    const step = draftSteps[index];
    if (!step) return;

    editingStepIndex = index;

    // Animation
    doPlay(step.animation);

    // Point
    stepPoint.value = step.at;

    // Durée et pause
    stepDuration.value = step.duration ?? '';
    stepPause.value = step.pause ?? 0;

    // Déplacement
    stepMove.value = step.move?.type || 'instant';
    stepSpeed.value = step.move?.speed ?? 200;
    stepWalkAnim.value = step.move?.walkAnimation || 'Running';
    stepAutoFace.checked = step.autoFace === true;
    refreshStepUI();

    // Orientation
    currentRot = {
      ...(step.rotation || { x: 0, y: 0, z: 0 }),
    };
    setSliders(currentRot);

    if (typeof window.characterRotate === 'function') {
      window.characterRotate(
        currentRot.x,
        currentRot.y,
        currentRot.z
      );
    }

    // Positions des champs de dialogue
    applyFieldOffsets({
      bubble: step.bubble,
      form: step.form,
    });

    addStepBtn.textContent =
      `💾 Enregistrer les modifications de l'étape ${index + 1}`;

    secAnim.open();
    secRot.open();
    secFields.open();
  }

  addStepBtn.addEventListener('click', () => {
    const at = stepPoint.value;

    if (!at || !draftPoints[at]) {
      alert('Crée d\'abord un point (section POINTS).');
      return;
    }

    const offsets = getFieldOffsets();

    const step = {
      animation: currentAnim,
      at,
      duration: num(stepDuration.value),
      pause: num(stepPause.value) || 0,
      move: { type: stepMove.value },
      rotation: { ...currentRot },
      autoFace: false,
      bubble: { x: offsets.bubble.x, y: offsets.bubble.y },
      form: { x: offsets.form.x, y: offsets.form.y },
    };

    if (stepMove.value === 'walk') {
      step.move.speed = num(stepSpeed.value) || 200;
      step.move.walkAnimation = stepWalkAnim.value;
      step.autoFace = stepAutoFace.checked;
    }

    if (editingStepIndex !== null) {
      draftSteps[editingStepIndex] = step;
      resetStepEditor();
    } else {
      draftSteps.push(step);
    }

    refreshStepsUI();
  });

  function refreshStepsUI() {
    stepsList.replaceChildren();

    draftSteps.forEach((step, index) => {
      const item = makeListItem();

      const label = document.createElement('span');
      label.style.flex = '1';
      label.style.minWidth = '0';
      label.style.overflow = 'hidden';
      label.style.textOverflow = 'ellipsis';
      label.style.whiteSpace = 'nowrap';

      label.textContent =
        `${index + 1}. ${step.animation.replace(/_/g, ' ')} @${step.at}` +
        (step.move?.type === 'walk'
          ? ' (marche)'
          : ' (instantané)');

      const edit = makeMiniButton(
        '✎',
        '#e58e26',
        'Modifier cette étape'
      );
      edit.addEventListener('click', () => {
        loadStepIntoEditor(index);
      });

      const del = makeMiniButton(
        '✕',
        '#8a3b2e',
        'Supprimer cette étape'
      );
      del.addEventListener('click', () => {
        draftSteps.splice(index, 1);

        if (editingStepIndex === index) {
          resetStepEditor();
        } else if (
          editingStepIndex !== null &&
          editingStepIndex > index
        ) {
          editingStepIndex--;
        }

        refreshStepsUI();
      });

      item.append(label, edit, del);
      stepsList.appendChild(item);
    });
  }

  // ---------------------------------------------------------------
  // Section : scènes enregistrées (sauvegarde, export, import)
  // ---------------------------------------------------------------

  const secSaved = makeSection('SCÈNES ENREGISTRÉES');

  let scenes = Array.isArray(window.B88_SCENES_DATA?.scenes)
    ? clone(window.B88_SCENES_DATA.scenes)
    : [];

  let editingId = null;

  function nextSceneId() {
    return scenes.reduce((max, s) => Math.max(max, s.id), 0) + 1;
  }

  const saveBtn = makeButton('💾 Sauvegarder cette scène', { marginBottom: '6px' });
  secSaved.content.appendChild(saveBtn);

  // --- RESTAURÉ --- bouton pour repartir sur une scène vierge
  const newBtn = makeButton('🆕 Nouvelle scène (vider le formulaire)', { marginBottom: '6px' });
  secSaved.content.appendChild(newBtn);

  const exportBtn = makeButton('📤 Exporter JSON', { marginBottom: '6px' });
  secSaved.content.appendChild(exportBtn);

  const pageFilter = makeSelect(
    [['all', 'Toutes les pages'], ...PAGES],
    'all'
  );
  secSaved.content.appendChild(makeRow('Filtrer par page', pageFilter));

  const sceneList = document.createElement('div');
  secSaved.content.appendChild(sceneList);

  pageFilter.addEventListener('change', renderSceneList);

  // --- RESTAURÉ --- construit l'objet scène à partir de tous les champs du formulaire
  function collectSceneFromUI() {
    const trigger = buildTrigger();
    if (!trigger) return null;

    const pages = PAGES.filter(([v]) => pageChecks[v].checked).map(([v]) => v);
    const devices = DEVICES.filter(([v]) => deviceChecks[v].checked).map(([v]) => v);

    if (!pages.length) {
      alert('Sélectionne au moins une page (section SCÈNE : OÙ ET POUR QUI).');
      return null;
    }
    if (!devices.length) {
      alert('Sélectionne au moins un appareil (section SCÈNE : OÙ ET POUR QUI).');
      return null;
    }
    if (!Object.keys(draftPoints).length) {
      alert('Crée au moins un point (section POINTS).');
      return null;
    }
    if (!draftSteps.length) {
      alert('Ajoute au moins une étape (section ÉTAPES).');
      return null;
    }

    const id = editingId ?? nextSceneId();

    return {
      id,
      name: nameInput.value.trim(),
      enabled: true,
      priority: num(priorityInput.value) || 0,
      pages,
      devices,
      trigger,
      conditions: {
        frequency: condFrequency.value,
        cooldownSeconds: num(condCooldown.value) || 0,
        interruptible: condInterruptible.checked,
      },
      points: clone(draftPoints),
      steps: clone(draftSteps),
      end: {
        action: endAction.value,
        next: endAction.value === 'chain' ? num(endNext.value) : null,
        repeat: num(endRepeat.value) ?? 1,
      },
      recorded: {
        viewport: { width: window.innerWidth, height: window.innerHeight },
        scrollY: window.scrollY,
        date: new Date().toISOString(),
      },
    };
  }

  // --- RESTAURÉ --- vide le formulaire pour repartir sur une scène neuve
  function resetEditor() {
    editingId = null;

    nameInput.value = '';
    priorityInput.value = '0';

    PAGES.forEach(([value]) => { pageChecks[value].checked = value === 'test'; });
    DEVICES.forEach(([value]) => { deviceChecks[value].checked = value === 'pc'; });

    applyTriggerToUI({ type: 'load', delay: 0 });

    condFrequency.value = 'always';
    condCooldown.value = '0';
    condInterruptible.checked = true;

    endAction.value = 'hold';
    endNext.value = '';
    endRepeat.value = '1';
    refreshEndUI();

    draftPoints = {};
    draftSteps = [];
    refreshPointsUI();
    refreshStepsUI();

    saveBtn.textContent = '💾 Sauvegarder cette scène';
  }

  // --- RESTAURÉ --- charge une scène existante dans le formulaire pour l'éditer
  function loadSceneIntoEditor(scene) {
    editingId = scene.id;

    nameInput.value = scene.name || '';
    priorityInput.value = scene.priority ?? 0;

    PAGES.forEach(([value]) => {
      pageChecks[value].checked = (scene.pages || []).includes(value);
    });
    DEVICES.forEach(([value]) => {
      deviceChecks[value].checked = (scene.devices || []).includes(value);
    });

    applyTriggerToUI(scene.trigger || { type: 'load', delay: 0 });

    condFrequency.value = scene.conditions?.frequency || 'always';
    condCooldown.value = scene.conditions?.cooldownSeconds ?? 0;
    condInterruptible.checked = scene.conditions?.interruptible !== false;

    endAction.value = scene.end?.action || 'hold';
    endNext.value = scene.end?.next ?? '';
    endRepeat.value = scene.end?.repeat ?? 1;
    refreshEndUI();

    draftPoints = clone(scene.points || {});
    draftSteps = clone(scene.steps || []);
    refreshPointsUI();
    refreshStepsUI();

    saveBtn.textContent = `💾 Mettre à jour la scène #${scene.id}`;

    secScene.open();
    secTrigger.open();
    secEnd.open();
    secPoints.open();
    secSteps.open();
  }

  // --- RESTAURÉ --- affiche la liste des scènes enregistrées (avec filtre par page)
  function renderSceneList() {
    sceneList.replaceChildren();

    const filter = pageFilter.value;
    const visible = scenes.filter(
      (s) => filter === 'all' || (s.pages || []).includes(filter)
    );

    if (!visible.length) {
      sceneList.appendChild(makeLabel('Aucune scène enregistrée pour ce filtre.', { fontSize: '10px' }));
      return;
    }

    visible
      .slice()
      .sort((a, b) => a.id - b.id)
      .forEach((scene) => {
        const item = makeListItem();

        const label = document.createElement('span');
        label.style.overflow = 'hidden';
        label.style.textOverflow = 'ellipsis';
        label.style.whiteSpace = 'nowrap';
        label.textContent = `#${scene.id} ${scene.name || '(sans nom)'}`;
        label.title = `${label.textContent} — ${(scene.pages || []).join(', ')} / ${(scene.devices || []).join(', ')}`;

        const btnWrap = document.createElement('div');
        Object.assign(btnWrap.style, { display: 'flex', gap: '4px', flexShrink: '0' });

        const playBtn = makeMiniButton('▶', '#3b7a57', 'Prévisualiser cette scène');
        playBtn.addEventListener('click', () => {
          if (typeof window.b88PlayScene === 'function') {
            window.b88PlayScene(clone(scene));
          } else {
            alert('scene-reader.js (b88PlayScene) n\'est pas chargé sur cette page.');
          }
        });

        const editBtn = makeMiniButton('✎', '#e58e26', 'Charger / éditer cette scène');
        editBtn.addEventListener('click', () => loadSceneIntoEditor(scene));

        const delBtn = makeMiniButton('✕', '#8a3b2e', 'Supprimer cette scène');
        delBtn.addEventListener('click', () => {
          if (!confirm(`Supprimer la scène #${scene.id} ("${scene.name || 'sans nom'}") ?`)) return;
          scenes = scenes.filter((s) => s.id !== scene.id);
          if (editingId === scene.id) resetEditor();
          renderSceneList();
        });

        btnWrap.append(playBtn, editBtn, delBtn);
        item.append(label, btnWrap);
        sceneList.appendChild(item);
      });
  }

  // --- RESTAURÉ --- sauvegarde (création ou mise à jour) de la scène courante
  saveBtn.addEventListener('click', () => {
    const scene = collectSceneFromUI();
    if (!scene) return;

    const idx = scenes.findIndex((s) => s.id === scene.id);
    if (idx >= 0) {
      scenes[idx] = scene;
    } else {
      scenes.push(scene);
    }

    editingId = scene.id;
    saveBtn.textContent = `💾 Mettre à jour la scène #${scene.id}`;
    renderSceneList();

    alert(`Scène #${scene.id} sauvegardée en mémoire.\nPense à cliquer sur "Exporter JSON" pour télécharger scenes-v2.json, puis remplace l'ancien fichier sur ton site.`);
  });

  newBtn.addEventListener('click', () => {
    if (!confirm('Vider le formulaire pour créer une nouvelle scène ? (les champs actuels seront perdus s\'ils ne sont pas sauvegardés)')) return;
    resetEditor();
  });
  // Vérifie les scènes avant l'export
  function validateScenes() {
    const errors = [];
    const warnings = [];
    const ids = new Set();

    scenes.forEach((scene) => {
      const label = `Scène #${scene.id}`;

      if (!Number.isInteger(Number(scene.id))) {
        errors.push(`${label} : identifiant invalide.`);
      } else if (ids.has(Number(scene.id))) {
        errors.push(`${label} : identifiant en double.`);
      } else {
        ids.add(Number(scene.id));
      }

      const cooldown = Number(scene.conditions?.cooldownSeconds ?? 0);

      const triggerDelay = Number(scene.trigger?.delay ?? 0);

      if (!Number.isFinite(triggerDelay) || triggerDelay < 0) {
      errors.push(`${label} : délai du déclencheur invalide.`);
}

// Vérification du type de déclencheur
const trigger = scene.trigger || {};

if (!TRIGGERS.some(([type]) => type === trigger.type)) {
  errors.push(`${label} : type de déclencheur inconnu.`);
}

// Vérification des paramètres propres à chaque déclencheur
if (trigger.type === 'enter') {
  const threshold = Number(trigger.threshold ?? 0.5);

  if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) {
    errors.push(`${label} : seuil de visibilité invalide (0 à 1).`);
  }
}

if (trigger.type === 'scroll') {
  const scrollPct = Number(trigger.scrollPct ?? 50);

  if (!Number.isFinite(scrollPct) || scrollPct < 0 || scrollPct > 100) {
    errors.push(`${label} : pourcentage de défilement invalide (0 à 100).`);
  }
}

if (trigger.type === 'idle') {
  const idleSeconds = Number(trigger.idleSeconds ?? 10);

  if (!Number.isFinite(idleSeconds) || idleSeconds < 0) {
    errors.push(`${label} : durée d'inactivité invalide.`);
  }
}

if (trigger.type === 'after-scene') {
  const afterScene = Number(trigger.afterScene);

  if (!Number.isInteger(afterScene) || !scenes.some(s => Number(s.id) === afterScene)) {
    errors.push(`${label} : scène déclencheuse introuvable.`);
  } else if (afterScene === Number(scene.id)) {
    errors.push(`${label} : une scène ne peut pas attendre sa propre fin.`);
  }
}
      // Vérification des sélecteurs CSS des déclencheurs
if (['enter', 'element-click', 'hover'].includes(trigger.type)) {
  const selector = typeof trigger.selector === 'string'
    ? trigger.selector.trim()
    : '';

  if (!selector) {
    errors.push(`${label} : sélecteur CSS manquant.`);
  } else {
    try {
      document.querySelector(selector);
    } catch (e) {
      errors.push(`${label} : sélecteur CSS invalide.`);
    }
  }
}

// Vérification du nom d'événement personnalisé
if (trigger.type === 'event' && !trigger.eventName?.trim()) {
  errors.push(`${label} : nom de l'événement manquant.`);
}
      
      if (!Number.isFinite(cooldown) || cooldown < 0) {
      errors.push(`${label} : délai d'attente invalide.`);
      }

      if (!scene.steps?.length) {
        errors.push(`${label} : aucune étape.`);
        return;
      }

      scene.steps.forEach((step, index) => {
        const stepLabel = `${label}, étape ${index + 1}`;

        if (!step.at || !scene.points?.[step.at]) {
          errors.push(`${stepLabel} : point inexistant.`);
        }

        if (!step.animation) {
          errors.push(`${stepLabel} : animation manquante.`);
        } else if (ANIMATIONS.length && !ANIMATIONS.includes(step.animation)) {
          warnings.push(`${stepLabel} : animation "${step.animation}" inconnue.`);
        }

        if (
          step.duration !== null &&
          step.duration !== undefined &&
          (!Number.isFinite(Number(step.duration)) || Number(step.duration) < 0)
        ) {
          errors.push(`${stepLabel} : durée invalide.`);
        }

        if (
          step.pause !== null &&
          step.pause !== undefined &&
          (!Number.isFinite(Number(step.pause)) || Number(step.pause) < 0)
        ) {
          errors.push(`${stepLabel} : pause invalide.`);
        }

        if (step.move?.type === 'walk' && step.move.walkAnimation) {
          if (ANIMATIONS.length && !ANIMATIONS.includes(step.move.walkAnimation)) {
            warnings.push(`${stepLabel} : animation de marche inconnue.`);
          }
        }
      });

      if (scene.end?.action === 'chain') {
        const nextId = Number(scene.end.next);

        if (!Number.isInteger(nextId) || !scenes.some(s => Number(s.id) === nextId)) {
          errors.push(`${label} : scène suivante introuvable.`);
        }
      }

      const repeat = Number(scene.end?.repeat ?? 1);
      if (!Number.isInteger(repeat) || repeat < 0) {
        errors.push(`${label} : nombre de répétitions invalide.`);
      }
    });

    return { errors, warnings };
  }
  // Export avec vérification préalable
  exportBtn.addEventListener('click', () => {
    const validation = validateScenes();

    if (validation.errors.length) {
      alert(
        'Export impossible : des erreurs ont été détectées.\n\n' +
        validation.errors.join('\n')
      );
      return;
    }

    if (validation.warnings.length) {
      const continuer = confirm(
        'Quelques avertissements ont été détectés :\n\n' +
        validation.warnings.join('\n') +
        '\n\nVeux-tu exporter quand même ?'
      );

      if (!continuer) return;
    }

    const data = {
  version: 2,
  exportedAt: new Date().toISOString(),
  avatar: {
    hitbox: {
      width: hitboxSettings.width,
      height: hitboxSettings.height,
      offsetX: hitboxSettings.offsetX,
      offsetY: hitboxSettings.offsetY,
    },
  },
  scenes,
};

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = 'scenes-v2.json';
    document.body.appendChild(a);
    a.click();
    a.remove();

// Laisse au navigateur le temps de démarrer le téléchargement.
setTimeout(() => {
  URL.revokeObjectURL(url);
}, 1000);
});

  // ---------------------------------------------------------------
  // Démarrage
  // ---------------------------------------------------------------

  refreshWalkAnimSelect();
  renderSceneList();
  refreshPointsUI();
  refreshStepsUI();

document.body.appendChild(panel);

// Corrige une éventuelle position enregistrée hors écran.
setPanelPosition(panel.offsetLeft, panel.offsetTop);

// Maintient le panneau accessible si la fenêtre change de taille.
window.addEventListener('resize', () => {
  setPanelPosition(panel.offsetLeft, panel.offsetTop);
  savePanelPosition(panel.offsetLeft, panel.offsetTop);
});
})();
