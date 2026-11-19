// controller.js — éditeur visuel de scénarios Bivouac88 (JSON v2)
// Fusion des versions précédentes :
//   - l'organisation en onglets (① Scénarios ② Éditeur ③ Vérifier/exporter ④ Outils)
//   - les outils et vérifications de la version déployée en production
//     (panneau déplaçable et borné à l'écran, position en direct, points
//     réutilisables éditables par glisser-déposer, étapes modifiables,
//     filtre par page, validations détaillées).
// Le format consommé par scene-reader.js reste inchangé.
//
// Changements notables de cette fusion par rapport aux versions d'origine :
//  1) Points réutilisables, repositionnables par glisser-déposer de l'avatar
//     une fois sélectionnés (bouton « ↔ »), au lieu d'être recréés à chaque
//     étape.
//  2) Étapes modifiables (bouton « ✎ »), pas seulement réordonnables/supprimables.
//  3) Widget d'animation unique et enrichi, utilisé à la fois pour construire
//     une étape et pour explorer les animations, au lieu d'un <select> basique
//     dupliqué avec une liste déroulante séparée.
//  4) Suppression du mélange "{...(old||{})}" à l'enregistrement d'une scène :
//     avec un editingId nul, Number(null) === 0, ce qui pouvait faire piocher
//     par erreur les champs d'une scène existante d'id 0. La scène est
//     maintenant toujours reconstruite explicitement.
//  5) Un point encore utilisé par une étape ne peut plus être supprimé par erreur.
//  6) Supprimer un scénario en cours d'édition réinitialise l'éditeur (sinon
//     "Enregistrer" pouvait le recréer avec les données encore dans le formulaire).
//  7) Animation de marche par défaut ("Running") correctement réappliquée même
//     si le <select> se construit avant que la liste d'animations soit prête.
//  8) Les réglages de hitbox sont bridés (min/max) au moment de l'enregistrement,
//     pas seulement pendant la frappe.
//  9) Panneau déplaçable, borné à l'écran (y compris au redimensionnement de la
//     fenêtre), avec position mémorisée dans localStorage.
//  10) Filtre par page dans la liste des scénarios enregistrés.
//  11) Vérifications supplémentaires avant export : nom vide, animation
//     inconnue, pause invalide, répétitions invalides, délai de déclencheur
//     invalide, type de déclencheur inconnu, bornes seuil/scroll/idle,
//     scène "after-scene" introuvable ou auto-référencée, sélecteur CSS du
//     déclencheur invalide, nom d'événement manquant, cooldown invalide.

(function () {
  const params = new URLSearchParams(location.search);
  if (params.get('edit') !== 'bivouac88admin') return;
  if (document.getElementById('ctrl-panel')) return;

  // ---------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const num = (value) => {
    if (value === '' || value == null) return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  };
  const r2 = (value) => Math.round(value * 100) / 100;

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
    ['manual', 'Uniquement appelée par une autre scène'],
    ['avatar-click', 'Au clic sur l’avatar'],
    ['enter', 'Quand un élément entre à l’écran'],
    ['scroll', 'À un niveau de défilement'],
    ['element-click', 'Au clic sur un élément'],
    ['hover', 'Au survol d’un élément'],
    ['idle', 'Après une période d’inactivité'],
    ['after-scene', 'Après une autre scène'],
    ['event', 'Sur événement personnalisé'],
  ];
  // Libellé, bornes et aide pour le champ "valeur" selon le type de
  // déclencheur (afterScene a son propre menu déroulant, pas besoin d'entrée ici).
  const TRIGGER_VALUE_INFO = {
    enter: { label: 'Seuil de visibilité', placeholder: 'Exemple : 0.5', help: 'Déclenche la scène lorsque l’élément devient suffisamment visible. 0 = aucun seuil, 1 = entièrement visible.', type: 'number', min: 0, max: 1, step: 0.05, value: '0.5' },
    scroll: { label: 'Pourcentage de défilement', placeholder: 'Exemple : 50', help: 'Pourcentage de la page défilée auquel la scène se déclenche.', type: 'number', min: 0, max: 100, step: 1, value: '50' },
    idle: { label: 'Durée sans activité (secondes)', placeholder: 'Exemple : 10', help: 'La scène se déclenche après cette durée sans activité du visiteur.', type: 'number', min: 0, step: 1, value: '10' },
    event: { label: 'Nom de l’événement personnalisé', placeholder: 'Exemple : b88:mon-evenement', help: 'La scène démarre lorsqu’un événement portant exactement ce nom est envoyé.', type: 'text', value: 'b88:' },
  };
  // Texte d'aide pour les types de déclencheur sans champ "valeur".
  const TRIGGER_HELP_TEXT = {
    load: 'La scène démarre au chargement de la page.',
    manual: 'Cette scène ne démarre que si une autre scène l’appelle explicitement (enchaînement) ; elle n’a pas de déclencheur propre.',
    'avatar-click': 'La scène démarre lorsque le visiteur clique sur le personnage.',
    'element-click': 'La scène démarre lorsque le visiteur clique sur l’élément choisi.',
    hover: 'La scène démarre lorsque le visiteur passe la souris sur l’élément choisi.',
    'after-scene': 'La scène démarre juste après la fin de la scène choisie ci-dessous.',
  };

  const PANEL_POSITION_KEY = 'b88-admin-panel-position';
  const HITBOX_KEY = 'b88-admin-hitbox-settings';
  const PANEL_WIDTH = 360;

  // ---------------------------------------------------------------
  // État de l'avatar
  // ---------------------------------------------------------------
  let ANIMATIONS = window.characterAnimations || [];
  let currentAnimation = ANIMATIONS[0] || 'Angry';
  let currentRotation = { x: 0, y: 0, z: 0 };

  function doPlay(name) {
    currentAnimation = name;
    window.characterPlay?.(name);
    updateAnimHighlight();
  }
  function doMove(x, y) {
    window.characterMoveTo?.(x, y);
  }
  function doRotate() {
    window.characterRotate?.(currentRotation.x, currentRotation.y, currentRotation.z);
  }
  function getAvatarPos() {
    const p = window.characterGetPosition?.();
    if (p && Number.isFinite(p.x) && Number.isFinite(p.y)) return p;
    return { x: innerWidth - 120, y: 6 };
  }

  // Un seul écouteur : met à jour la liste d'animations (widget + menu de
  // marche) et re-rend l'onglet actif, même si character.js se charge après
  // ce contrôleur.
  document.addEventListener('b88:animations-ready', (e) => {
    ANIMATIONS = e.detail?.animations || window.characterAnimations || [];
    refreshAnimationsUI();
    showView(currentView);
  });

  // ---------------------------------------------------------------
  // Fabriques DOM
  // ---------------------------------------------------------------
  const el = (tag, text, cls) => {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (cls) node.className = cls;
    return node;
  };
  const button = (text, fn, cls = '') => {
    const b = el('button', text, cls);
    b.type = 'button';
    b.addEventListener('click', fn);
    return b;
  };
  const field = (label, control) => {
    const wrap = el('div', undefined, 'field');
    wrap.append(el('label', label), control);
    return wrap;
  };
  const input = (type = 'text', value = '', placeholder = '') => {
    const i = el('input');
    i.type = type;
    i.value = value ?? '';
    i.placeholder = placeholder;
    return i;
  };
  const select = (options, value) => {
    const s = el('select');
    options.forEach(([v, t]) => {
      const o = el('option', t);
      o.value = v;
      s.append(o);
    });
    if (value !== undefined) s.value = value;
    return s;
  };
  const heading = (text) => {
    const h = el('h3', text);
    Object.assign(h.style, { fontSize: '13px', color: '#e58e26', margin: '15px 0 6px' });
    return h;
  };
  const help = (text) => el('div', text, 'muted');
  const makeCheck = (labelText, checked) => {
    const label = el('label');
    Object.assign(label.style, { display: 'flex', gap: '6px', alignItems: 'center', fontSize: '12px', cursor: 'pointer' });
    const c = el('input');
    c.type = 'checkbox';
    c.checked = !!checked;
    label.append(c, el('span', labelText));
    return { label, input: c };
  };
  const listItem = () => el('div', undefined, 'listitem');
  const miniButton = (text, bg, title) => {
    const b = el('button', text);
    b.type = 'button';
    if (title) b.title = title;
    Object.assign(b.style, { background: bg || '#e58e26', border: 'none', borderRadius: '3px', color: '#12100e', cursor: 'pointer', padding: '2px 7px', fontSize: '10px', flexShrink: '0' });
    return b;
  };
  
  const panel = document.createElement('aside');
  panel.id = 'ctrl-panel';
  Object.assign(panel.style, {
    position: 'fixed', width: PANEL_WIDTH + 'px', maxWidth: 'calc(100vw - 28px)', maxHeight: 'calc(100vh - 28px)',
    overflow: 'auto', zIndex: 10001, background: '#191713f5', color: '#eee', border: '1px solid #e58e26',
    borderRadius: '10px', padding: '12px', font: '13px Arial,sans-serif', boxShadow: '0 8px 30px #0009', boxSizing: 'border-box',
  });

  const style = document.createElement('style');
  style.textContent = `#ctrl-panel *{box-sizing:border-box}#ctrl-panel input,#ctrl-panel select,#ctrl-panel textarea{width:100%;background:#2a2520;color:#eee;border:1px solid #514638;border-radius:5px;padding:7px;font:inherit}#ctrl-panel button{cursor:pointer;border:1px solid #514638;border-radius:5px;padding:7px 9px;background:#302a23;color:#eee;font:inherit}#ctrl-panel button.primary{background:#e58e26;color:#17120c;border-color:#e58e26;font-weight:bold}#ctrl-panel button.danger{border-color:#8a3b2e;color:#ffb3a8}#ctrl-panel .muted{color:#aaa;font-size:11px}#ctrl-panel .field{display:grid;gap:4px;margin:8px 0}#ctrl-panel .field>label{color:#c7b9a5;font-size:11px}#ctrl-panel .row{display:flex;gap:7px;align-items:center}#ctrl-panel .row>*{min-width:0;flex:1}#ctrl-panel .card{border:1px solid #514638;background:#211e19;border-radius:7px;padding:9px;margin:7px 0}#ctrl-panel .pill{display:inline-block;border-radius:20px;padding:3px 7px;background:#383126;color:#e9bd7c;font-size:10px}#ctrl-panel .step{border-left:3px solid #e58e26;padding:7px 8px;margin:7px 0;background:#242019;border-radius:4px}#ctrl-panel .step.editing{border-left-color:#ffd27a;background:#302516}#ctrl-panel .checkgrid{display:grid;grid-template-columns:1fr 1fr;gap:5px}#ctrl-panel .checkgrid label{display:flex;gap:6px;align-items:center;font-size:12px}#ctrl-panel .checkgrid input{width:auto}#ctrl-panel .listitem{display:flex;justify-content:space-between;align-items:center;gap:6px;padding:4px 7px;margin-bottom:4px;background:#2a2520;border:1px solid #38332b;border-radius:4px;font-size:11px;color:#ccc}#ctrl-panel .listitem>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ctrl-panel .listitem>div{display:flex;gap:4px;flex-shrink:0}#ctrl-panel .anim-widget{position:relative}#ctrl-panel .anim-current{display:flex;justify-content:space-between;text-align:left}#ctrl-panel .anim-list{display:none;max-height:220px;overflow-y:auto;margin-top:3px;background:#2a2520;border:1px solid #514638;border-radius:5px}#ctrl-panel .anim-list>div{padding:6px 8px;font-size:12px;cursor:pointer;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}`;
  document.head.appendChild(style);

  document.body.appendChild(panel);

  // ---------------------------------------------------------------
  // En-tête : glisser pour déplacer (borné à l'écran), cliquer pour
  // replier/déplier. Position mémorisée dans localStorage.
  // ---------------------------------------------------------------
  function getDefaultPanelPosition() {
    return { x: Math.max(8, innerWidth - PANEL_WIDTH - 16), y: 14 };
  }
  function loadPanelPosition() {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_POSITION_KEY));
      if (saved && typeof saved.x === 'number' && typeof saved.y === 'number') return saved;
    } catch (e) {}
    return getDefaultPanelPosition();
  }
  function savePanelPosition(x, y) {
    try { localStorage.setItem(PANEL_POSITION_KEY, JSON.stringify({ x, y })); } catch (e) {}
  }
  // Empêche le panneau de sortir de l'écran (position mémorisée invalide
  // après un redimensionnement, ou glisser-déposer trop loin).
  function setPanelPosition(x, y) {
    const maxX = Math.max(0, innerWidth - panel.offsetWidth);
    const maxY = Math.max(0, innerHeight - panel.offsetHeight);
    panel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
    panel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
  }

  const panelPos = loadPanelPosition();
  panel.style.left = panelPos.x + 'px';
  panel.style.top = panelPos.y + 'px';

  const header = el('div');
  Object.assign(header.style, { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', cursor: 'move' });
  const title = el('strong', '🧭 Éditeur de scénarios');
  title.style.color = '#e58e26';
  const toggleArrow = el('span', '▾');
  header.append(title, toggleArrow);
  panel.append(header);

  const body = el('div');
  panel.append(body);

  let collapsed = false;
  function setCollapsed(value) {
    collapsed = value;
    body.style.display = collapsed ? 'none' : 'block';
    toggleArrow.textContent = collapsed ? '▸' : '▾';
  }

  const DRAG_THRESHOLD_PX = 5;
  header.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const startClientX = event.clientX, startClientY = event.clientY;
    const startLeft = panel.offsetLeft, startTop = panel.offsetTop;
    let dragged = false;
    function movePanel(moveEvent) {
      const dx = moveEvent.clientX - startClientX, dy = moveEvent.clientY - startClientY;
      if (!dragged && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) dragged = true;
      if (!dragged) return;
      setPanelPosition(startLeft + dx, startTop + dy);
    }
    function stopDragging() {
      document.removeEventListener('pointermove', movePanel);
      document.removeEventListener('pointerup', stopDragging);
      document.removeEventListener('pointercancel', stopDragging);
      if (dragged) savePanelPosition(panel.offsetLeft, panel.offsetTop);
      else setCollapsed(!collapsed);
    }
    document.addEventListener('pointermove', movePanel);
    document.addEventListener('pointerup', stopDragging);
    document.addEventListener('pointercancel', stopDragging);
  });

  // Corrige une position mémorisée devenue invalide, et garde le panneau
  // accessible si la fenêtre change de taille.
  setPanelPosition(panel.offsetLeft, panel.offsetTop);
  window.addEventListener('resize', () => {
    setPanelPosition(panel.offsetLeft, panel.offsetTop);
    savePanelPosition(panel.offsetLeft, panel.offsetTop);
  });

  // ---------------------------------------------------------------
  // Onglets
  // ---------------------------------------------------------------
  const statusEl = el('div', 'Prêt. Les modifications sont en mémoire jusqu’à l’export.', 'muted');
  statusEl.style.margin = '8px 0';
  body.append(statusEl);
  const setStatus = (msg) => { statusEl.textContent = msg; };

  const tabs = el('div');
  tabs.className = 'row';
  tabs.style.margin = '10px 0';
  const overviewTab = button('① Scénarios', () => showView('overview'), 'primary');
  const editorTab = button('② Éditeur', () => showView('editor'));
  const checkTab = button('③ Vérifier / exporter', () => showView('check'));
  const toolsTab = button('④ Outils personnage', () => showView('tools'));
  tabs.append(overviewTab, editorTab, checkTab, toolsTab);
  body.append(tabs);
  const view = el('div');
  body.append(view);

  let currentView = 'overview';
  let toolsIntervalId = 0;

  function showView(which) {
    currentView = which;
    clearInterval(toolsIntervalId);
    overviewTab.classList.toggle('primary', which === 'overview');
    editorTab.classList.toggle('primary', which === 'editor');
    checkTab.classList.toggle('primary', which === 'check');
    toolsTab.classList.toggle('primary', which === 'tools');
    if (which === 'overview') renderOverview();
    if (which === 'editor') renderEditor();
    if (which === 'check') renderCheck();
    if (which === 'tools') renderTools();
    refreshPointBadges();
  }

  // ---------------------------------------------------------------
  // Détection d'éléments de la page (pour les sélecteurs CSS)
  // ---------------------------------------------------------------
  function isIgnored(node) {
    return !!node.closest('#ctrl-panel, #b88-character, .b88-dialogue');
  }
  function elementAt(x, y) {
    return document.elementsFromPoint(x, y).find((n) => !isIgnored(n) && n !== document.documentElement) || null;
  }
  function cssPath(node) {
    if (!node || node === document.body) return null;
    const parts = [];
    let n = node;
    while (n && n.nodeType === 1 && n !== document.body) {
      if (n.id) { parts.unshift('#' + CSS.escape(n.id)); break; }
      let p = n.tagName.toLowerCase();
      const classes = [...n.classList].filter((c) => !c.startsWith('b88-')).slice(0, 2);
      if (classes.length) p += '.' + classes.map((c) => CSS.escape(c)).join('.');
      const parent = n.parentElement;
      if (parent) {
        const same = [...parent.children].filter((x) => x.tagName === n.tagName);
        if (same.length > 1) p += `:nth-of-type(${same.indexOf(n) + 1})`;
      }
      parts.unshift(p);
      n = n.parentElement;
    }
    return parts.join(' > ');
  }
  // Position réelle d'un point (même formule que scene-reader.js).
  // Retourne des coordonnées avatar : x depuis la gauche, y depuis le bas.
  function resolvePoint(p) {
    const el = p.selector ? document.querySelector(p.selector) : null;
    if (el) {
      const rect = el.getBoundingClientRect();
      const x = rect.left + (p.ax / 100) * rect.width + (p.offsetX || 0);
      const yTop = rect.top + (p.ay / 100) * rect.height + (p.offsetY || 0);
      return { x, y: innerHeight - yTop };
    }
    return { x: (p.fallback.xPct / 100) * innerWidth, y: (p.fallback.yPct / 100) * innerHeight };
  }

  // Mode "choisir un élément" : le prochain clic sur la page désigne un élément.
  let pickCallback = null;
  function pickElement(callback) {
    setPlacementMode(false);
    setStatus('Clique sur un élément de la page…');
    pickCallback = callback;
    document.body.style.cursor = 'crosshair';
  }
  document.addEventListener('click', (event) => {
    if (!pickCallback) return;
    if (panel.contains(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    const target = elementAt(event.clientX, event.clientY);
    const cb = pickCallback;
    pickCallback = null;
    document.body.style.cursor = '';
    if (target) { cb(target); setStatus('Élément sélectionné.'); }
  }, true);

  // Mode "placer l'avatar" : le prochain clic déplace le personnage.
  let placementMode = false;
  function setPlacementMode(on) {
    placementMode = on;
    document.body.style.cursor = on ? 'crosshair' : (pickCallback ? 'crosshair' : '');
    if (on) setStatus('Clique sur la page pour placer l’avatar.');
  }
  document.addEventListener('click', (event) => {
    if (!placementMode) return;
    if (panel.contains(event.target)) return;
    const x = event.clientX;
    const y = innerHeight - event.clientY; // coordonnées avatar : Y depuis le bas
    doMove(x, y);
    setPlacementMode(false);
    setStatus('Position de l’avatar mise à jour.');
  });

  // ---------------------------------------------------------------
  // Widget d'animation unique (liste dépliable), utilisé à la fois pour
  // construire une étape et pour explorer les animations disponibles.
  // ---------------------------------------------------------------
  const animWidget = el('div', undefined, 'anim-widget');
  const animCurrent = button('', () => setAnimListOpen(animList.style.display === 'none'), '');
  animCurrent.className = 'anim-current';
  const animCurrentText = el('span', currentAnimation.replace(/_/g, ' '));
  const animCurrentArrow = el('span', '▾');
  animCurrent.append(animCurrentText, animCurrentArrow);
  const animList = el('div', undefined, 'anim-list');
  animWidget.append(animCurrent, animList);

  function setAnimListOpen(open) {
    animList.style.display = open ? 'block' : 'none';
    animCurrentArrow.textContent = open ? '▴' : '▾';
  }
  function updateAnimHighlight() {
    animCurrentText.textContent = currentAnimation.replace(/_/g, ' ');
    [...animList.children].forEach((item) => {
      const match = item.dataset.name === currentAnimation;
      item.style.background = match ? '#e58e26' : 'transparent';
      item.style.color = match ? '#17120c' : '#ccc';
    });
  }
  function refreshAnimationBrowser() {
    animList.replaceChildren();
    ANIMATIONS.forEach((n) => {
      const item = el('div', n.replace(/_/g, ' '));
      item.title = n;
      item.dataset.name = n;
      item.addEventListener('mouseenter', () => { if (n !== currentAnimation) item.style.background = '#302a23'; });
      item.addEventListener('mouseleave', () => { if (n !== currentAnimation) item.style.background = 'transparent'; });
      item.addEventListener('click', () => { doPlay(n); setAnimListOpen(false); });
      animList.append(item);
    });
    updateAnimHighlight();
  }

  // ---------------------------------------------------------------
  // Formulaire : identité, pages, appareils, déclencheur
  // (éléments persistants, réutilisés à chaque rendu de l'onglet Éditeur)
  // ---------------------------------------------------------------
  const nameInput = input('text', '', 'Ex. Accueil, Réponse au clic…');
  const priorityInput = input('number', '0');
  const pageChecks = {}, deviceChecks = {};

  function makeCheckGrid(items, state, defaultValue) {
    const grid = el('div');
    grid.className = 'checkgrid';
    items.forEach(([value, label]) => {
      const l = el('label');
      const c = el('input');
      c.type = 'checkbox';
      c.checked = state[value] ?? (value === defaultValue);
      state[value] = c.checked;
      c.addEventListener('change', () => { state[value] = c.checked; });
      l.append(c, el('span', label));
      grid.append(l);
    });
    return grid;
  }

  const triggerType = select(TRIGGERS, 'load');
  const triggerDelay = input('number', '0');
  const triggerSelector = input('text', '', 'Sélecteur CSS, ex. #photos');
  const triggerValue = input('text', '');
  const triggerValueLabel = el('label', '');
  const triggerHelp = el('div', '', 'muted');
  triggerHelp.style.color = '#c5a879';
  const triggerAfterScene = select([['', '— Choisir la scène précédente —']], '');
  const triggerLeave = select([['hold', 'Conserver la scène'], ['stop', 'Arrêter la scène']], 'hold');

  const triggerSelectorRow = el('div', undefined, 'field');
  triggerSelectorRow.append(
    el('label', 'Élément concerné (clic, survol ou visibilité)'),
    triggerSelector,
    button('🎯 Choisir cet élément sur la page', () => pickElement((node) => { triggerSelector.value = cssPath(node) || 'body'; }))
  );
  const triggerValueRow = el('div', undefined, 'field');
  triggerValueRow.append(triggerValueLabel, triggerValue);
  const triggerAfterSceneRow = field('Scène précédente', triggerAfterScene);
  const triggerLeaveRow = field('Quand le déclencheur disparaît (sortie d’écran, fin de survol)', triggerLeave);

  function refreshTriggerUI(resetValue) {
    const type = triggerType.value;
    const info = TRIGGER_VALUE_INFO[type];
    triggerSelectorRow.style.display = ['enter', 'element-click', 'hover'].includes(type) ? 'grid' : 'none';
    triggerValueRow.style.display = info ? 'grid' : 'none';
    triggerAfterSceneRow.style.display = type === 'after-scene' ? 'grid' : 'none';
    triggerLeaveRow.style.display = ['enter', 'scroll', 'hover'].includes(type) ? 'grid' : 'none';
    if (info) {
      triggerValueLabel.textContent = info.label;
      triggerValue.type = info.type;
      triggerValue.placeholder = info.placeholder;
      triggerValue.min = info.min ?? '';
      triggerValue.max = info.max ?? '';
      triggerValue.step = info.step ?? '';
      if (resetValue) triggerValue.value = info.value;
    }
    triggerHelp.textContent = (info && info.help) || TRIGGER_HELP_TEXT[type] || '';
  }
  triggerType.addEventListener('change', () => refreshTriggerUI(true));

  function buildTrigger() {
    const type = triggerType.value;
    const trigger = { type, delay: num(triggerDelay.value) ?? 0 };
    if (['enter', 'element-click', 'hover'].includes(type)) {
      const selector = triggerSelector.value.trim();
      if (!selector) { setStatus('Ce déclencheur nécessite un élément CSS : choisis-le ou saisis un sélecteur.'); return null; }
      trigger.selector = selector;
    }
    if (type === 'enter') trigger.threshold = num(triggerValue.value) ?? 0.5;
    if (type === 'scroll') trigger.scrollPct = num(triggerValue.value) ?? 50;
    if (type === 'idle') trigger.idleSeconds = num(triggerValue.value) ?? 10;
    if (type === 'after-scene') {
      if (!triggerAfterScene.value) { setStatus('Choisis la scène qui doit se terminer avant celle-ci.'); return null; }
      trigger.afterScene = Number(triggerAfterScene.value);
    }
    if (type === 'event') {
      const eventName = triggerValue.value.trim();
      if (!eventName) { setStatus('Indique le nom de l’événement.'); return null; }
      trigger.eventName = eventName;
    }
    if (['enter', 'scroll', 'hover'].includes(type)) trigger.leave = triggerLeave.value;
    return trigger;
  }
  function applyTriggerToUI(trigger) {
    triggerType.value = trigger.type || 'load';
    refreshTriggerUI(false);
    triggerDelay.value = trigger.delay ?? 0;
    triggerSelector.value = trigger.selector || '';
    triggerLeave.value = trigger.leave || 'hold';
    refreshAfterSceneOptions(trigger.afterScene ?? '');
    const valueByType = { enter: trigger.threshold, scroll: trigger.scrollPct, idle: trigger.idleSeconds, event: trigger.eventName };
    triggerValue.value = valueByType[trigger.type] ?? '';
  }

  // ---------------------------------------------------------------
  // Formulaire : conditions et fin de scène
  // ---------------------------------------------------------------
  const frequency = select([['always', 'À chaque fois'], ['load', 'Une fois par chargement'], ['session', 'Une fois par session'], ['visitor', 'Une fois par visiteur']], 'always');
  const cooldown = input('number', '0');
  const { label: interruptibleLabel, input: interruptible } = makeCheck('Peut être interrompue par une autre scène', true);
  const endAction = select([['hold', 'Terminer ici'], ['chain', 'Enchaîner vers une autre scène']], 'hold');
  const endNext = select([['', '— Choisir la scène suivante —']], '');
  const endNextRow = field('Enchaîner vers', endNext);
  const repeat = input('number', '1');
  endAction.addEventListener('change', () => { endNextRow.style.display = endAction.value === 'chain' ? 'grid' : 'none'; });

  // ---------------------------------------------------------------
  // Formulaire : points réutilisables, repositionnables par glisser-déposer
  // ---------------------------------------------------------------
  let draftPoints = {};
  let draftSteps = [];
  let activePointKey = null;

      const pointBadgesHost = el('div');
  Object.assign(pointBadgesHost.style, { position: 'fixed', inset: '0', pointerEvents: 'none', zIndex: 9999 });
  document.body.append(pointBadgesHost);

  function refreshPointBadges() {
    pointBadgesHost.replaceChildren();
    if (currentView !== 'editor') return;
    Object.entries(draftPoints).forEach(([key, p]) => {
      const pos = resolvePoint(p);
      const badge = el('div', key);
      Object.assign(badge.style, {
        position: 'fixed',
        left: pos.x + 'px',
        top: (innerHeight - pos.y) + 'px',
        transform: 'translate(-50%, -50%)',
        width: '22px', height: '22px', borderRadius: '50%',
        background: key === activePointKey ? '#ffd27a' : '#e58e26',
        color: '#17120c', fontWeight: 'bold', fontSize: '11px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2px solid #17120c', boxShadow: '0 2px 6px #0007',
      });
      pointBadgesHost.append(badge);
    });
  }
  
  const pointMode = select([['screen', 'Collé à l’écran (position fixe)'], ['follow', 'Suit l’élément pendant le scroll']], 'screen');
  const pointsHost = el('div');
  const stepPoint = select([]);

  // Séquence de clés A, B, … Z, AA, AB, … (comme les colonnes d'un tableur :
  // pas de limite pratique de points par scène).
  function nextPointKey() {
    let i = 0;
    let key;
    do {
      key = '';
      let n = i;
      do { key = String.fromCharCode(65 + (n % 26)) + key; n = Math.floor(n / 26) - 1; } while (n >= 0);
      i++;
    } while (draftPoints[key]);
    return key;
  }

  function capturePointAt(pos, forcedElement) {
    const clientX = pos.x;
    const clientY = innerHeight - pos.y;
    let target = forcedElement || elementAt(clientX, clientY);
    if (target === document.body || target === document.documentElement) target = null;
    const point = {
      selector: null, ax: null, ay: null, offsetX: 0, offsetY: 0,
      mode: pointMode.value,
      fallback: { xPct: r2((pos.x / innerWidth) * 100), yPct: r2((pos.y / innerHeight) * 100) },
    };
    if (target) {
      const rect = target.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0) {
        point.selector = cssPath(target);
        point.ax = r2(((clientX - rect.left) / rect.width) * 100);
        point.ay = r2(((clientY - rect.top) / rect.height) * 100);
      }
    }
    return point;
  }

  function createPoint(forcedElement) {
    const key = nextPointKey();
    draftPoints[key] = capturePointAt(getAvatarPos(), forcedElement);
    activePointKey = key;
    refreshPointsUI();
    stepPoint.value = key;
    setStatus(`Point ${key} créé et sélectionné. Fais glisser l’avatar sur la page pour ajuster sa position.`);
  }

  // Tant qu'un point est sélectionné (bouton « ↔ » ou juste créé), faire
  // glisser l'avatar directement sur la page met à jour sa position en
  // direct (character.js doit émettre cet événement pendant le glisser).
  document.addEventListener('b88:character-drag', () => {
    if (!activePointKey || !draftPoints[activePointKey]) return;
    draftPoints[activePointKey] = { ...capturePointAt(getAvatarPos()), mode: draftPoints[activePointKey].mode };
    refreshPointsUI();
    setStatus(`Position du point ${activePointKey} mise à jour.`);
  });

  function refreshPointsUI() {
    pointsHost.replaceChildren();
    const keys = Object.keys(draftPoints);
    if (!keys.length) pointsHost.append(help('Aucun point pour le moment.'));
    keys.forEach((key) => {
      const p = draftPoints[key];
      const item = listItem();
      const label = el('span', `${key === activePointKey ? '● ' : ''}${key} — ${p.selector || 'écran'} (${p.selector ? (p.mode === 'follow' ? 'suit le scroll' : 'capturé une fois') : 'position fixe'})`);
      label.title = p.selector || 'position écran uniquement';
      const edit = miniButton('↔', '#e58e26', 'Sélectionner ce point et y déplacer l’avatar');
      edit.addEventListener('click', () => {
        activePointKey = key;
        const pos = resolvePoint(p);
        doMove(pos.x, pos.y);
        refreshPointsUI();
        setStatus(`Point ${key} sélectionné : fais glisser l’avatar sur la page pour ajuster sa position.`);
      });
      const del = miniButton('✕', '#8a3b2e', 'Supprimer ce point');
      del.addEventListener('click', () => {
        if (draftSteps.some((s) => s.at === key)) { setStatus(`Le point ${key} est utilisé par une étape : supprime d’abord cette étape.`); return; }
        delete draftPoints[key];
        if (activePointKey === key) activePointKey = null;
        refreshPointsUI();
      });
      const wrap = el('div');
      wrap.append(edit, del);
      item.append(label, wrap);
      pointsHost.append(item);
    });
    const previous = stepPoint.value;
    stepPoint.replaceChildren();
    keys.forEach((key) => {
      const opt = el('option', `Point ${key}`);
      opt.value = key;
      stepPoint.append(opt);
    });
    if (draftPoints[previous]) stepPoint.value = previous;
        if (stepPoint._lastRefresh !== undefined) {} // (ligne neutre, ignore)
    refreshPointBadges();
  }

  // ---------------------------------------------------------------
  // Formulaire : étapes (création et modification)
  // ---------------------------------------------------------------
  const duration = input('number', '', '∞ (jusqu’à la suite)');
  const pause = input('number', '0');
  const movement = select([['instant', 'Déplacement instantané'], ['walk', 'Marcher jusqu’au point']], 'instant');
  const walkSpeed = input('number', '200');
  const walkAnimation = select([], 'Running');
  const { label: autoFaceLabel, input: autoFace } = makeCheck('Orienter le personnage dans le sens de la marche', true);
  const walkOptionsHost = el('div');
  walkOptionsHost.append(field('Vitesse (px/s)', walkSpeed), field('Animation de marche', walkAnimation), autoFaceLabel);
  movement.addEventListener('change', () => { walkOptionsHost.style.display = movement.value === 'walk' ? 'block' : 'none'; });

  function refreshAnimationsUI() {
    refreshAnimationBrowser();
    const old = walkAnimation.value;
    walkAnimation.replaceChildren();
    ANIMATIONS.forEach((n) => {
      const o = el('option', n.replace(/_/g, ' '));
      o.value = n;
      walkAnimation.append(o);
    });
    if (ANIMATIONS.includes(old)) walkAnimation.value = old;
    else if (ANIMATIONS.includes('Running')) walkAnimation.value = 'Running';
  }

  const stepsHost = el('div');
    const timelineHost = el('div');
  Object.assign(timelineHost.style, { display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' });

  function refreshTimeline() {
    timelineHost.replaceChildren();
    draftSteps.forEach((step, index) => {
      const pill = el('div', `${index + 1}. ${step.animation.replace(/_/g, ' ')}`, 'pill');
      pill.style.cursor = 'pointer';
      pill.title = `Point ${step.at}`;
      pill.addEventListener('click', () => loadStepIntoEditor(index));
      timelineHost.append(pill);
    });
  }
  const addStepBtn = button('+ Ajouter cette étape à la séquence', () => addStep(), 'primary');
  const testStepBtn = button('▶ Tester cette étape maintenant', () => {
  const at = stepPoint.value;
  if (!at || !draftPoints[at]) { setStatus('Crée d’abord un point (section « Points »).'); return; }
  const pos = resolvePoint(draftPoints[at]);
  doMove(pos.x, pos.y);
  doPlay(currentAnimation);
  setStatus(`Test : « ${currentAnimation.replace(/_/g, ' ')} » au point ${at}.`);
});
  
  const dialogueSelectors = ['.b88-dialogue-bubble', '.b88-dialogue-form'];
  function dialogueElements() { return dialogueSelectors.map((sel) => document.querySelector(sel)).filter(Boolean); }
  function readFieldOffsets() {
    const read = (sel) => { const node = document.querySelector(sel); return { x: Number(node?.dataset.dragX || 0), y: Number(node?.dataset.dragY || 0) }; };
    return { bubble: read(dialogueSelectors[0]), form: read(dialogueSelectors[1]) };
  }
  function applyFieldOffsets(fields) {
    if (!fields) return;
    const apply = (sel, offset) => {
      const node = document.querySelector(sel);
      if (!node || !offset) return;
      node.dataset.dragX = String(offset.x);
      node.dataset.dragY = String(offset.y);
      node.style.translate = `${offset.x}px ${offset.y}px`;
    };
    apply(dialogueSelectors[0], fields.bubble);
    apply(dialogueSelectors[1], fields.form);
  }
  function attachDialogueDrag(node) {
    if (node.dataset.adminDragBound === 'true') return;
    node.dataset.adminDragBound = 'true';
    node.dataset.dragX = node.dataset.dragX || '0';
    node.dataset.dragY = node.dataset.dragY || '0';
    node.addEventListener('pointerdown', (event) => {
      if (!fieldMoveState.enabled || event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      const sx = event.clientX, sy = event.clientY, ix = Number(node.dataset.dragX), iy = Number(node.dataset.dragY);
      const move = (e) => {
        const x = ix + e.clientX - sx, y = iy + e.clientY - sy;
        node.dataset.dragX = String(x);
        node.dataset.dragY = String(y);
        node.style.translate = `${x}px ${y}px`;
      };
      const stop = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', stop);
        document.removeEventListener('pointercancel', stop);
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', stop);
      document.addEventListener('pointercancel', stop);
    });
  }
  const fieldMoveState = { enabled: false };
  const dialogueObserver = new MutationObserver(() => dialogueElements().forEach((node) => {
    attachDialogueDrag(node);
    if (fieldMoveState.enabled) { node.style.cursor = 'move'; node.style.outline = '2px dashed #e58e26'; }
  }));
  dialogueObserver.observe(document.body, { childList: true, subtree: true });
  dialogueElements().forEach(attachDialogueDrag);

  let editingStepIndex = null;

  function resetStepEditor() {
    editingStepIndex = null;
    addStepBtn.textContent = '+ Ajouter cette étape à la séquence';
  }

  function loadStepIntoEditor(index) {
    const step = draftSteps[index];
    if (!step) return;
    editingStepIndex = index;
    doPlay(step.animation);
    stepPoint.value = step.at;
    duration.value = step.duration ?? '';
    pause.value = step.pause ?? 0;
    movement.value = step.move?.type || 'instant';
    walkOptionsHost.style.display = movement.value === 'walk' ? 'block' : 'none';
    walkSpeed.value = step.move?.speed ?? 200;
    walkAnimation.value = step.move?.walkAnimation || 'Running';
    autoFace.checked = step.autoFace === true;
    currentRotation = { ...(step.rotation || { x: 0, y: 0, z: 0 }) };
    doRotate();
    applyFieldOffsets({ bubble: step.bubble, form: step.form });
    addStepBtn.textContent = `💾 Enregistrer les modifications de l’étape ${index + 1}`;
    refreshStepsUI();
    setStatus(`Étape ${index + 1} chargée : ajuste puis clique sur « Enregistrer les modifications ».`);
  }

  function refreshStepsUI() {
        refreshTimeline();
    stepsHost.replaceChildren();
    if (!draftSteps.length) { stepsHost.append(help('Aucune étape pour le moment.')); return; }
    draftSteps.forEach((step, index) => {
      const card = el('div', undefined, index === editingStepIndex ? 'step editing' : 'step');
      const top = el('div', `${index + 1}. ${step.animation.replace(/_/g, ' ')} — point ${step.at}`);
      top.style.fontWeight = 'bold';
      card.append(top);
      card.append(help(`Durée : ${step.duration == null ? 'sans limite / jusqu’à la suite' : step.duration + ' s'} · Pause : ${step.pause || 0} s · ${step.move?.type === 'walk' ? 'Marche' : 'Instantané'}`));
      const actions = el('div');
      actions.className = 'row';
      actions.style.marginTop = '6px';
      actions.append(
        button('↑', () => {
          if (!index) return;
          [draftSteps[index - 1], draftSteps[index]] = [draftSteps[index], draftSteps[index - 1]];
          if (editingStepIndex === index) editingStepIndex = index - 1;
          else if (editingStepIndex === index - 1) editingStepIndex = index;
          refreshStepsUI();
        }),
        button('↓', () => {
          if (index >= draftSteps.length - 1) return;
          [draftSteps[index + 1], draftSteps[index]] = [draftSteps[index], draftSteps[index + 1]];
          if (editingStepIndex === index) editingStepIndex = index + 1;
          else if (editingStepIndex === index + 1) editingStepIndex = index;
          refreshStepsUI();
        }),
        button('✎', () => loadStepIntoEditor(index)),
        button('Supprimer', () => {
          draftSteps.splice(index, 1);
          if (editingStepIndex === index) resetStepEditor();
          else if (editingStepIndex !== null && editingStepIndex > index) editingStepIndex--;
          refreshStepsUI();
        }, 'danger')
      );
      card.append(actions);
      stepsHost.append(card);
    });
  }

  function addStep() {
    const at = stepPoint.value;
    if (!at || !draftPoints[at]) { setStatus('Crée d’abord un point (section « Points »).'); return; }
    const offsets = readFieldOffsets();
    const step = {
      animation: currentAnimation,
      at,
      duration: num(duration.value),
      pause: num(pause.value) ?? 0,
      move: { type: movement.value },
      rotation: { ...currentRotation },
      autoFace: false,
      bubble: offsets.bubble,
      form: offsets.form,
    };
    if (movement.value === 'walk') {
      step.move.speed = num(walkSpeed.value) || 200;
      step.move.walkAnimation = walkAnimation.value;
      step.autoFace = autoFace.checked;
    }
    if (editingStepIndex !== null) {
      draftSteps[editingStepIndex] = step;
      setStatus(`Étape ${editingStepIndex + 1} mise à jour.`);
      resetStepEditor();
    } else {
      draftSteps.push(step);
      setStatus(`Étape ${draftSteps.length} ajoutée au scénario.`);
    }
    refreshStepsUI();
  }

  // ---------------------------------------------------------------
  // Scènes : état, CRUD, options dépendantes
  // ---------------------------------------------------------------
  const savedData = window.B88_SCENES_DATA || { version: 2, scenes: [] };
  let scenes = Array.isArray(savedData.scenes) ? clone(savedData.scenes) : [];
  let editingId = null;

  const nameOf = (id) => scenes.find((s) => Number(s.id) === Number(id))?.name || `Scène #${id}`;
  const nextSceneId = () => scenes.reduce((max, s) => Math.max(max, Number(s.id) || 0), 0) + 1;

  function refreshAfterSceneOptions(selected = '') {
    triggerAfterScene.replaceChildren();
    triggerAfterScene.append(new Option('— Choisir la scène précédente —', ''));
    scenes.filter((s) => editingId == null || Number(s.id) !== Number(editingId))
      .forEach((s) => triggerAfterScene.append(new Option(`${s.name || 'Sans nom'} (scénario #${s.id})`, String(s.id))));
    triggerAfterScene.value = selected == null ? '' : String(selected);
  }
  function refreshChainOptions(selected = '') {
    endNext.replaceChildren();
    endNext.append(new Option('— Choisir la scène suivante —', ''));
    scenes.filter((s) => editingId == null || Number(s.id) !== Number(editingId))
      .forEach((s) => endNext.append(new Option(`${s.name || 'Sans nom'} (scénario #${s.id})`, String(s.id))));
    endNext.value = selected == null ? '' : String(selected);
    refreshAfterSceneOptions(triggerAfterScene.value);
  }

  function resetEditor() {
    editingId = null;
    nameInput.value = '';
    priorityInput.value = '0';
    Object.keys(pageChecks).forEach((k) => { pageChecks[k] = k === 'test'; });
    Object.keys(deviceChecks).forEach((k) => { deviceChecks[k] = k === 'pc'; });
    applyTriggerToUI({ type: 'load', delay: 0 });
    frequency.value = 'always';
    cooldown.value = '0';
    interruptible.checked = true;
    endAction.value = 'hold';
    repeat.value = '1';
    refreshChainOptions('');
    endNextRow.style.display = 'none';
    draftPoints = {};
    draftSteps = [];
    activePointKey = null;
    resetStepEditor();
    refreshPointsUI();
    refreshStepsUI();
    currentRotation = { x: 0, y: 0, z: 0 };
    doRotate();
  }

  function loadScene(scene) {
    editingId = scene.id;
    activePointKey = null;
    resetStepEditor();
    nameInput.value = scene.name || '';
    priorityInput.value = scene.priority ?? 0;
    PAGES.forEach(([v]) => { pageChecks[v] = (scene.pages || []).includes(v); });
    DEVICES.forEach(([v]) => { deviceChecks[v] = (scene.devices || []).includes(v); });
    applyTriggerToUI(scene.trigger || { type: 'load', delay: 0 });
    frequency.value = scene.conditions?.frequency || 'always';
    cooldown.value = scene.conditions?.cooldownSeconds ?? 0;
    interruptible.checked = scene.conditions?.interruptible !== false;
    endAction.value = scene.end?.action || 'hold';
    repeat.value = scene.end?.repeat ?? 1;
    refreshChainOptions(scene.end?.next ?? '');
    endNextRow.style.display = endAction.value === 'chain' ? 'grid' : 'none';
    draftPoints = clone(scene.points || {});
    draftSteps = clone(scene.steps || []);
    refreshPointsUI();
    refreshStepsUI();
    const lastStep = draftSteps[draftSteps.length - 1];
    if (lastStep) {
      currentRotation = { ...(lastStep.rotation || { x: 0, y: 0, z: 0 }) };
      applyFieldOffsets({ bubble: lastStep.bubble, form: lastStep.form });
    } else {
      currentRotation = { x: 0, y: 0, z: 0 };
    }
    doRotate();
    showView('editor');
  }

  function collectScene() {
    const pages = PAGES.filter(([v]) => pageChecks[v]).map(([v]) => v);
    const devices = DEVICES.filter(([v]) => deviceChecks[v]).map(([v]) => v);
    if (!nameInput.value.trim()) { setStatus('Donne un nom à ce scénario.'); return null; }
    if (!pages.length) { setStatus('Sélectionne au moins une page.'); return null; }
    if (!devices.length) { setStatus('Sélectionne au moins un appareil.'); return null; }
    if (!Object.keys(draftPoints).length) { setStatus('Crée au moins un point (section « Points »).'); return null; }
    if (!draftSteps.length) { setStatus('Ajoute au moins une étape.'); return null; }
    const trigger = buildTrigger();
    if (!trigger) return null;
    const chain = endAction.value === 'chain';
    if (chain && !endNext.value) { setStatus('Choisis la scène qui suit.'); return null; }

    // editingId peut être nul (nouveau scénario) : on ne réutilise jamais
    // Number(null)===0 pour aller chercher un id existant par erreur.
    const id = editingId != null ? editingId : nextSceneId();

    return {
      id,
      name: nameInput.value.trim(),
      enabled: true,
      priority: num(priorityInput.value) ?? 0,
      pages,
      devices,
      trigger,
      conditions: { frequency: frequency.value, cooldownSeconds: num(cooldown.value) ?? 0, interruptible: interruptible.checked },
      points: clone(draftPoints),
      steps: clone(draftSteps),
      end: { action: chain ? 'chain' : 'hold', next: chain ? Number(endNext.value) : null, repeat: num(repeat.value) ?? 1 },
      recorded: { viewport: { width: innerWidth, height: innerHeight }, scrollY: scrollY, date: new Date().toISOString() },
    };
  }

  // ---------------------------------------------------------------
  // Onglet ① Scénarios (aperçu + filtre par page)
  // ---------------------------------------------------------------
  function renderOverview() {
    view.replaceChildren();
    view.append(heading('Déroulement de tes scénarios'), help('Les scénarios marqués « Départ » se lancent seuls. Les autres sont appelés par une scène précédente.'));

    const pageFilter = select([['all', 'Toutes les pages'], ...PAGES], 'all');
    view.append(field('Filtrer par page', pageFilter));

    const list = el('div');
    view.append(list);

    function renderList() {
      list.replaceChildren();
      const filter = pageFilter.value;
      const visible = scenes.filter((s) => filter === 'all' || (s.pages || []).includes(filter));
      if (!visible.length) { list.append(help('Aucun scénario pour ce filtre.')); return; }
      visible.slice().sort((a, b) => Number(a.id) - Number(b.id)).forEach((scene) => {
        const card = el('div', undefined, 'card');
        const start = scene.trigger?.type === 'manual' ? 'Appelée uniquement par une autre scène'
          : scene.trigger?.type === 'load' ? 'Départ au chargement'
          : scene.trigger?.type === 'avatar-click' ? 'Départ au clic avatar'
          : `Déclencheur : ${TRIGGERS.find((t) => t[0] === scene.trigger?.type)?.[1] || scene.trigger?.type}`;
        const incoming = scenes.filter((source) => source.end?.action === 'chain' && Number(source.end.next) === Number(scene.id));
        card.append(
          el('strong', scene.name || `Scénario #${scene.id}`),
          el('div', `${start} · ${(scene.pages || []).map((p) => PAGES.find((x) => x[0] === p)?.[1] || p).join(', ')}`, 'muted')
        );
        if (incoming.length) card.append(el('div', 'Reçoit un enchaînement depuis : ' + incoming.map((x) => x.name || 'Scénario #' + x.id).join(', '), 'muted'));
        if (incoming.length && scene.trigger?.type !== 'manual') card.append(el('div', '⚠ Possède aussi son propre déclencheur : elle peut démarrer indépendamment.', 'muted'));
        card.append(el('div', `${(scene.steps || []).length} étape(s) · ${scene.end?.action === 'chain' ? 'Enchaîne vers ' + nameOf(scene.end.next) : 'Termine ici'}`, 'pill'));
        const actions = el('div');
        actions.className = 'row';
        actions.style.marginTop = '8px';
        actions.append(
          button('▶ Aperçu', () => {
            if (typeof window.b88PlayScene === 'function') window.b88PlayScene(clone(scene));
            else setStatus('scene-reader.js (b88PlayScene) n’est pas chargé sur cette page.');
          }),
          button('Modifier', () => loadScene(scene)),
          button('Supprimer', () => {
            if (!confirm(`Supprimer « ${scene.name || 'Scénario #' + scene.id} » ?`)) return;
            scenes = scenes.filter((s) => s.id !== scene.id);
            // La scène supprimée était en cours d'édition : on vide le
            // formulaire pour ne pas la recréer au prochain "Enregistrer".
            if (editingId === scene.id) resetEditor();
            renderList();
          }, 'danger')
        );
        card.append(actions);
        list.append(card);
      });
    }
    pageFilter.addEventListener('change', renderList);
    renderList();

    view.append(button('+ Nouveau scénario', () => { resetEditor(); showView('editor'); }, 'primary'));
  }

  // ---------------------------------------------------------------
  // Onglet ② Éditeur
  // ---------------------------------------------------------------
  function renderEditor() {
    view.replaceChildren();
    view.append(heading(editingId == null ? 'Créer un scénario' : 'Modifier : ' + (nameInput.value || 'scénario')));
    view.append(field('Nom du scénario', nameInput));
    view.append(field('Priorité (si plusieurs départs concurrents)', priorityInput));

    view.append(heading('1. Où et quand ça démarre'));
    view.append(field('Pages concernées', makeCheckGrid(PAGES, pageChecks, 'test')));
    view.append(field('Appareils', makeCheckGrid(DEVICES, deviceChecks, 'pc')));
    view.append(field('Déclencheur', triggerType));
    view.append(triggerHelp);
    view.append(field('Délai avant démarrage (secondes)', triggerDelay));
    view.append(triggerSelectorRow, triggerValueRow, triggerAfterSceneRow, triggerLeaveRow);
    refreshTriggerUI(false);

    view.append(heading('2. Points (positions réutilisables)'));
    view.append(help('Crée un point à la position actuelle de l’avatar, puis sélectionne-le (↔) et fais-le glisser sur la page pour l’ajuster. Un même point peut servir à plusieurs étapes.'));
    view.append(field('Mode du prochain point', pointMode));
    const pointActions = el('div');
    pointActions.className = 'row';
    pointActions.append(
      button('📍 Déplacer l’avatar ici', () => setPlacementMode(true)),
      button('📌 Créer un point ici', () => createPoint(null)),
      button('🎯 Créer un point sur un élément', () => pickElement((node) => createPoint(node)))
    );
    view.append(pointActions, pointsHost);
    
    view.append(heading('3. Construire le déroulement'));
    view.append(field('Point où se joue l’étape', stepPoint));
    view.append(field('Animation', animWidget));
    if (!ANIMATIONS.length) view.append(help('En attente de la liste d’animations du personnage…'));
    view.append(field('Durée (secondes)', duration));
    view.append(help('Laisse vide pour ne pas imposer de durée. Ce n’est pas une erreur.'));
    view.append(field('Pause avant cette étape (secondes)', pause));
    view.append(field('Déplacement vers le point', movement));
    view.append(walkOptionsHost);
    walkOptionsHost.style.display = movement.value === 'walk' ? 'block' : 'none';
    view.append(testStepBtn, addStepBtn);
    view.append(timelineHost);
    view.append(stepsHost);

    view.append(heading('4. Fin du scénario'));
    view.append(field('Après la dernière étape', endAction));
    view.append(endNextRow);
    endNextRow.style.display = endAction.value === 'chain' ? 'grid' : 'none';
    view.append(field('Répétitions (1 = une fois, 0 = boucle)', repeat));
    view.append(field('Fréquence', frequency));
    view.append(field('Délai minimum entre deux lancements (secondes)', cooldown));
    view.append(interruptibleLabel);

    const actions = el('div');
    actions.className = 'row';
    actions.style.marginTop = '12px';
    actions.append(
      button(editingId == null ? 'Enregistrer le scénario' : 'Mettre à jour le scénario', () => {
        const scene = collectScene();
        if (!scene) return;
        const index = scenes.findIndex((s) => Number(s.id) === Number(scene.id));
        if (index < 0) scenes.push(scene); else scenes[index] = scene;
        editingId = scene.id;
        refreshChainOptions(scene.end.next ?? '');
        setStatus(`« ${scene.name} » enregistré en mémoire. Pense à exporter le JSON (onglet ③) pour mettre le site à jour.`);
        showView('overview');
      }, 'primary'),
      button('Nouveau / vider', () => {
        if (confirm('Abandonner les modifications non enregistrées ?')) { resetEditor(); showView('editor'); }
      })
    );
    view.append(actions);
  }

  // ---------------------------------------------------------------
  // Onglet ③ Vérifier / exporter
  // ---------------------------------------------------------------
  function validate() {
    const errors = [], warnings = [];
    const ids = new Set();
    scenes.forEach((s) => {
      const label = s.name || `Scénario #${s.id}`;
      if (!Number.isInteger(Number(s.id)) || ids.has(Number(s.id))) errors.push(`${label} : identifiant invalide ou doublon.`);
      ids.add(Number(s.id));
      if (!s.name?.trim()) warnings.push(`${label} : aucun nom renseigné.`);

      const trigger = s.trigger || {};
      if (!TRIGGERS.some(([t]) => t === trigger.type)) errors.push(`${label} : type de déclencheur inconnu.`);
      const triggerDelayValue = Number(trigger.delay ?? 0);
      if (!Number.isFinite(triggerDelayValue) || triggerDelayValue < 0) errors.push(`${label} : délai du déclencheur invalide.`);
      if (trigger.type === 'enter') {
        const threshold = Number(trigger.threshold ?? 0.5);
        if (!Number.isFinite(threshold) || threshold < 0 || threshold > 1) errors.push(`${label} : seuil de visibilité invalide (0 à 1).`);
      }
      if (trigger.type === 'scroll') {
        const scrollPct = Number(trigger.scrollPct ?? 50);
        if (!Number.isFinite(scrollPct) || scrollPct < 0 || scrollPct > 100) errors.push(`${label} : pourcentage de défilement invalide (0 à 100).`);
      }
      if (trigger.type === 'idle') {
        const idleSeconds = Number(trigger.idleSeconds ?? 10);
        if (!Number.isFinite(idleSeconds) || idleSeconds < 0) errors.push(`${label} : durée d’inactivité invalide.`);
      }
      if (trigger.type === 'after-scene') {
        const afterScene = Number(trigger.afterScene);
        if (!Number.isInteger(afterScene) || !scenes.some((x) => Number(x.id) === afterScene)) errors.push(`${label} : scène déclencheuse introuvable.`);
        else if (afterScene === Number(s.id)) errors.push(`${label} : une scène ne peut pas attendre sa propre fin.`);
      }
      if (['enter', 'element-click', 'hover'].includes(trigger.type)) {
        const selector = typeof trigger.selector === 'string' ? trigger.selector.trim() : '';
        if (!selector) errors.push(`${label} : sélecteur CSS du déclencheur manquant.`);
        else { try { document.querySelector(selector); } catch (e) { errors.push(`${label} : sélecteur CSS du déclencheur invalide.`); } }
      }
      if (trigger.type === 'event' && !trigger.eventName?.trim()) errors.push(`${label} : nom de l’événement manquant.`);
      const cooldownValue = Number(s.conditions?.cooldownSeconds ?? 0);
      if (!Number.isFinite(cooldownValue) || cooldownValue < 0) errors.push(`${label} : délai d’attente (cooldown) invalide.`);

      if (!s.steps?.length) { errors.push(`${label} : aucune étape.`); return; }
      s.steps.forEach((step, i) => {
        const stepLabel = `${label}, étape ${i + 1}`;
        if (!step.at || !s.points?.[step.at]) {
          errors.push(`${stepLabel} : point absent.`);
        } else {
          const point = s.points[step.at];
          if (point.selector) { try { document.querySelector(point.selector); } catch (e) { warnings.push(`${stepLabel} : sélecteur CSS invalide.`); } }
        }
        if (!step.animation) errors.push(`${stepLabel} : animation absente.`);
        else if (ANIMATIONS.length && !ANIMATIONS.includes(step.animation)) warnings.push(`${stepLabel} : animation « ${step.animation} » inconnue.`);
        if (step.duration != null && (!Number.isFinite(Number(step.duration)) || Number(step.duration) < 0)) errors.push(`${stepLabel} : durée invalide.`);
        if (step.pause != null && (!Number.isFinite(Number(step.pause)) || Number(step.pause) < 0)) errors.push(`${stepLabel} : pause invalide.`);
        if (step.move?.type === 'walk' && step.move.walkAnimation && ANIMATIONS.length && !ANIMATIONS.includes(step.move.walkAnimation)) {
          warnings.push(`${stepLabel} : animation de marche inconnue.`);
        }
      });
      if (s.end?.action === 'chain') {
        const next = scenes.find((x) => Number(x.id) === Number(s.end.next));
        if (!next) errors.push(`${label} : la scène suivante n’existe plus.`);
        else {
          if (!(s.pages || []).some((p) => (next.pages || []).includes(p))) errors.push(`${label} : la scène suivante ne partage aucune page avec elle.`);
          if (!(s.devices || []).some((d) => (next.devices || []).includes(d))) errors.push(`${label} : la scène suivante ne partage aucun appareil avec elle.`);
        }
      }
      const repeatValue = Number(s.end?.repeat ?? 1);
      if (!Number.isInteger(repeatValue) || repeatValue < 0) errors.push(`${label} : nombre de répétitions invalide.`);
      if (s.trigger?.type === 'manual' && !scenes.some((source) => source.end?.action === 'chain' && Number(source.end.next) === Number(s.id))) {
        warnings.push(`${label} : mode « appelée uniquement » mais aucun scénario ne l’appelle.`);
      }
      if (scenes.some((source) => source.end?.action === 'chain' && Number(source.end.next) === Number(s.id)) && s.trigger?.type !== 'manual') {
        warnings.push(`${label} : elle est appelée par une autre scène mais garde aussi un déclencheur indépendant.`);
      }
      if (s.end?.action === 'chain' && Number(s.end.next) === Number(s.id)) warnings.push(`${label} : s’enchaîne vers elle-même (boucle).`);
      if (s.trigger?.type === 'load') warnings.push(`${label} : démarre automatiquement au chargement.`);
    });
    return { errors, warnings };
  }

  function renderCheck() {
    view.replaceChildren();
    view.append(heading('Vérification du JSON v2'));
    const result = validate();
    if (!result.errors.length) view.append(el('div', '✓ Aucune erreur bloquante.', 'pill'));
    else { view.append(el('strong', `${result.errors.length} erreur(s)`)); result.errors.forEach((x) => view.append(el('div', '✕ ' + x, 'muted'))); }
    if (result.warnings.length) { view.append(heading('À vérifier')); result.warnings.forEach((x) => view.append(el('div', '⚠ ' + x, 'muted'))); }

    view.append(heading('Chaînes détectées'));
    scenes.forEach((s) => view.append(el('div', `${s.name || '#' + s.id}  →  ${s.end?.action === 'chain' ? nameOf(s.end.next) : 'Fin'}`, 'card')));

    const exportBtn = button('Exporter scenes-v2.json', () => {
      const v = validate();
      if (v.errors.length) { alert('Export annulé :\n\n' + v.errors.join('\n')); return; }
      if (v.warnings.length && !confirm('Avertissements :\n\n' + v.warnings.join('\n') + '\n\nExporter quand même ?')) return;
      const data = { version: 2, exportedAt: new Date().toISOString(), avatar: { ...(savedData.avatar || {}), hitbox: { ...hitbox } }, scenes };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'scenes-v2.json';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setStatus('JSON exporté. Remplace le fichier scenes-v2.json sur ton site.');
    }, 'primary');
    view.append(exportBtn);

    const importInput = input('file');
    importInput.accept = '.json,application/json';
    importInput.addEventListener('change', async () => {
      const file = importInput.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.version !== 2 || !Array.isArray(data.scenes)) throw new Error('Format JSON v2 non reconnu.');
        if (!confirm(`Remplacer les ${scenes.length} scénarios en mémoire par les ${data.scenes.length} du fichier ?`)) return;
        scenes = clone(data.scenes);
        savedData.avatar = data.avatar || {};
        if (data.avatar?.hitbox) Object.assign(hitbox, data.avatar.hitbox);
        editingId = null;
        refreshChainOptions();
        setStatus('JSON importé en mémoire.');
        showView('overview');
      } catch (e) { alert('Import impossible : ' + e.message); }
    });
    view.append(field('Importer un JSON v2 existant', importInput));
  }

  // ---------------------------------------------------------------
  // Onglet ④ Outils personnage
  // ---------------------------------------------------------------
  const hitboxDefaults = { width: 140, height: 145, offsetX: 0, offsetY: 0 };
  let hitbox = { ...hitboxDefaults };
  try { hitbox = { ...hitboxDefaults, ...JSON.parse(localStorage.getItem(HITBOX_KEY) || '{}') }; } catch (e) {}

  const hitboxPreview = el('div');
  Object.assign(hitboxPreview.style, { position: 'fixed', display: 'none', pointerEvents: 'none', zIndex: 10000, boxSizing: 'border-box', border: '2px dashed #ff3333', background: 'rgba(255,50,50,.12)', borderRadius: '3px' });
  document.body.append(hitboxPreview);
  let hitboxPreviewEnabled = false;
  let hitboxRaf = 0;
  function updateHitboxPreview() {
    if (hitboxRaf) cancelAnimationFrame(hitboxRaf);
    const tick = () => {
      if (!hitboxPreviewEnabled) { hitboxPreview.style.display = 'none'; hitboxRaf = 0; return; }
      const bounds = window.characterGetScreenBounds?.();
      if (bounds) {
        const cx = (bounds.left + bounds.right) / 2, cy = (bounds.top + bounds.bottom) / 2;
        Object.assign(hitboxPreview.style, {
          display: 'block', width: hitbox.width + 'px', height: hitbox.height + 'px',
          left: (cx + hitbox.offsetX - hitbox.width / 2) + 'px', top: (cy + hitbox.offsetY - hitbox.height / 2) + 'px',
        });
      } else hitboxPreview.style.display = 'none';
      hitboxRaf = requestAnimationFrame(tick);
    };
    tick();
  }

  function renderTools() {
    view.replaceChildren();
    view.append(heading('Position de l’avatar'));
    const coords = el('div', 'x: — y: —', 'muted');
    view.append(coords);
    view.append(button('📍 Activer le placement (clic sur la page)', () => setPlacementMode(true)));
    toolsIntervalId = setInterval(() => {
      const p = getAvatarPos();
      coords.textContent = `x: ${Math.round(p.x)}  y: ${Math.round(p.y)}`;
    }, 250);

    view.append(heading('Hitbox — zone de clic'));
    view.append(help('Prévisualisation admin uniquement, non exportée dans le comportement du site.'));
    const hitFields = {}, hitBounds = {};
    [['width', 'Largeur (px)', 20, 1000], ['height', 'Hauteur (px)', 20, 1000], ['offsetX', 'Décalage horizontal', -500, 500], ['offsetY', 'Décalage vertical', -500, 500]].forEach(([key, label, min, max]) => {
      hitBounds[key] = [min, max];
      const i = input('number', String(hitbox[key]));
      i.min = min; i.max = max;
      i.addEventListener('input', () => { const n = num(i.value); if (n !== null) hitbox[key] = Math.max(min, Math.min(max, n)); });
      hitFields[key] = i;
      view.append(field(label, i));
    });
    view.append(button(hitboxPreviewEnabled ? 'Masquer l’aperçu de hitbox' : 'Afficher l’aperçu de hitbox', () => { hitboxPreviewEnabled = !hitboxPreviewEnabled; updateHitboxPreview(); renderTools(); }));
    view.append(button('Enregistrer les réglages de hitbox', () => {
      // Le clamp [min,max] est réappliqué ici : la saisie en direct bride déjà
      // hitbox[key], mais le champ affiché peut encore contenir une valeur
      // hors bornes qui serait sinon reprise telle quelle à l'enregistrement.
      Object.keys(hitFields).forEach((k) => {
        const [min, max] = hitBounds[k];
        const n = num(hitFields[k].value);
        hitbox[k] = n === null ? hitboxDefaults[k] : Math.max(min, Math.min(max, n));
      });
      try { localStorage.setItem(HITBOX_KEY, JSON.stringify(hitbox)); setStatus('Réglages de hitbox enregistrés dans ce navigateur.'); }
      catch (e) { setStatus('Impossible d’enregistrer la hitbox.'); }
    }, 'primary'));

    view.append(heading('Orientation manuelle'));
    doRotate();
    ['x', 'y', 'z'].forEach((axis) => {
      const wrap = el('div');
      const label = el('label', axis.toUpperCase() + ' — ' + (currentRotation[axis] || 0) + '°');
      const slider = input('range', String(currentRotation[axis] || 0));
      slider.min = '0'; slider.max = '360';
      slider.addEventListener('input', () => { currentRotation[axis] = Number(slider.value); label.textContent = axis.toUpperCase() + ' — ' + slider.value + '°'; doRotate(); });
      wrap.append(label, slider);
      view.append(wrap);
    });
    view.append(button('Réinitialiser orientation', () => { currentRotation = { x: 0, y: 0, z: 0 }; doRotate(); renderTools(); }));

    view.append(heading('Champs de dialogue'));
    view.append(help('Active le mode puis fais glisser la bulle ou le champ de saisie. Les décalages sont mémorisés dans chaque étape ajoutée ensuite.'));
    view.append(button(fieldMoveState.enabled ? 'Désactiver le déplacement' : 'Activer le déplacement des champs', () => {
      fieldMoveState.enabled = !fieldMoveState.enabled;
      dialogueElements().forEach((node) => { attachDialogueDrag(node); node.style.cursor = fieldMoveState.enabled ? 'move' : ''; node.style.outline = fieldMoveState.enabled ? '2px dashed #e58e26' : ''; });
      renderTools();
    }));
    view.append(button('Réinitialiser les positions des champs', () => {
      dialogueElements().forEach((node) => { node.dataset.dragX = '0'; node.dataset.dragY = '0'; node.style.translate = '0px 0px'; });
      setStatus('Positions des champs réinitialisées.');
    }));
  }

  updateHitboxPreview();
  refreshAnimationsUI();
  showView('overview');
})();
