// scene-reader.js — lecteur de scènes v2
// Lit un JSON exporté par le panneau admin et exécute les scènes sur la page.
// Passe uniquement par characterPlay, characterMoveTo, characterRotate, characterGetPosition.

(function () {

  // ---------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------

  function currentPage() {
    return document.body.dataset.page || '';
  }

  function currentDevice() {
    const w = window.innerWidth;
    if (w < 768) return 'mobile';
    if (w < 1024) return 'tablet';
    return 'pc';
  }

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

  function prefersReducedMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ---------------------------------------------------------------
  // Mémoire des conditions (fréquence, cooldown)
  // ---------------------------------------------------------------

  const STORAGE_KEY = 'b88-scenes-state';

  function loadState() {
    try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {}; } catch (e) { return {}; }
  }

  function saveState(state) {
    try { sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
  }

  function canRun(scene) {
    const freq = scene.conditions?.frequency || 'always';
    const cooldown = scene.conditions?.cooldownSeconds || 0;
    const state = loadState();
    const entry = state[scene.id] || {};
    const now = Date.now();

    if (cooldown > 0 && entry.lastRun && (now - entry.lastRun) < cooldown * 1000) return false;

    if (freq === 'load') return !entry.ranThisLoad;
    if (freq === 'session') return !entry.ranThisSession;
    if (freq === 'visitor') {
      try {
        const ls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        return !ls[scene.id]?.ranEver;
      } catch (e) { return true; }
    }
    return true;
  }

  function markRan(scene) {
    const state = loadState();
    state[scene.id] = {
      lastRun: Date.now(),
      ranThisLoad: true,
      ranThisSession: true,
    };
    saveState(state);

    if (scene.conditions?.frequency === 'visitor') {
      try {
        const ls = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        ls[scene.id] = { ranEver: true };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(ls));
      } catch (e) {}
    }
  }

  // ---------------------------------------------------------------
  // Exécution d'une scène
  // ---------------------------------------------------------------

  let runningScene = null; // { id, cancel }

  function applyFieldOffsets(bubble, form) {
    const apply = (selector, offset) => {
      if (!offset) return;
      const el = document.querySelector(selector);
      if (!el) return;
      el.dataset.dragX = String(offset.x);
      el.dataset.dragY = String(offset.y);
      el.style.translate = `${offset.x}px ${offset.y}px`;
    };
    apply('.b88-dialogue-bubble', bubble);
    apply('.b88-dialogue-form', form);
  }

  function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // Déplace l'avatar à pied vers (tx, ty) à une vitesse donnée (px/s).
  // Retourne une promesse qui se résout quand la destination est atteinte.
  function walkTo(tx, ty, speed, walkAnim, autoFace, cancelRef) {
    return new Promise((resolve) => {
      if (typeof window.characterPlay === 'function') window.characterPlay(walkAnim);

      const STEP_MS = 16;
      const pxPerStep = (speed / 1000) * STEP_MS;

      function tick() {
        if (cancelRef.cancelled) { resolve(); return; }

        const pos = typeof window.characterGetPosition === 'function'
          ? window.characterGetPosition()
          : null;

        if (!pos) { arrive(); return; }

        const dx = tx - pos.x;
        const dy = ty - pos.y;
        const dist = Math.hypot(dx, dy);

        if (dist <= pxPerStep) { arrive(); return; }

        const nx = pos.x + (dx / dist) * pxPerStep;
        const ny = pos.y + (dy / dist) * pxPerStep;

        if (autoFace && typeof window.characterRotate === 'function') {
          // Tourne vers la gauche ou la droite selon le sens de marche
          window.characterRotate(0, dx < 0 ? 180 : 0, 0);
        }

        if (typeof window.characterMoveTo === 'function') window.characterMoveTo(nx, ny);
        setTimeout(tick, STEP_MS);
      }

      function arrive() {
        if (typeof window.characterMoveTo === 'function') window.characterMoveTo(tx, ty);
        resolve();
      }

      tick();
    });
  }

  async function runScene(scene) {
    if (prefersReducedMotion()) return;
    if (!canRun(scene)) return;

    // Interrompre la scène en cours si elle l'autorise
    if (runningScene) {
      const current = runningScene;
      // On annule seulement si la scène en cours est interruptible
      const currentSceneDef = _scenes.find((s) => s.id === current.id);
      if (currentSceneDef?.conditions?.interruptible !== false) {
        current.cancel();
      } else {
        return; // La scène en cours refuse d'être interrompue
      }
    }

    markRan(scene);

    const cancelRef = { cancelled: false };
    runningScene = { id: scene.id, cancel: () => { cancelRef.cancelled = true; runningScene = null; } };

    const repeat = scene.end?.repeat ?? 1;
    const loops = repeat === 0 ? Infinity : repeat;

    for (let loop = 0; loop < loops; loop++) {
      if (cancelRef.cancelled) break;

      for (const step of scene.steps) {
        if (cancelRef.cancelled) break;

        // Pause avant l'étape
        if (step.pause > 0) await wait(step.pause * 1000);
        if (cancelRef.cancelled) break;

        const point = scene.points[step.at];
        if (!point) continue;

        // Position cible
        let target;
        if (point.mode === 'follow') {
          // Recalcul en temps réel : on démarre simplement avec la position actuelle
          target = resolvePoint(point);
        } else {
          target = resolvePoint(point);
        }

        // Déplacement
        if (step.move?.type === 'walk') {
          await walkTo(
            target.x, target.y,
            step.move.speed || 200,
            step.move.walkAnimation || 'Running',
            step.autoFace ?? true,
            cancelRef
          );
        } else {
          if (typeof window.characterMoveTo === 'function') window.characterMoveTo(target.x, target.y);
        }

        if (cancelRef.cancelled) break;

        // Animation et orientation
        if (typeof window.characterPlay === 'function') window.characterPlay(step.animation);
        if (typeof window.characterRotate === 'function') {
          window.characterRotate(step.rotation.x, step.rotation.y, step.rotation.z);
        }

        // Champs de dialogue
        applyFieldOffsets(step.bubble, step.form);

        // Suivi continu si mode "follow"
        if (point.mode === 'follow') {
          const followInterval = setInterval(() => {
            if (cancelRef.cancelled) { clearInterval(followInterval); return; }
            const pos = resolvePoint(point);
            if (typeof window.characterMoveTo === 'function') window.characterMoveTo(pos.x, pos.y);
          }, 100);

          // Durée
          if (step.duration != null) {
            await wait(step.duration * 1000);
            clearInterval(followInterval);
          }
          // Si pas de durée, on attend indéfiniment (jusqu'à annulation)
        } else {
          // Durée
          if (step.duration != null) await wait(step.duration * 1000);
        }
      }
    }

    if (!cancelRef.cancelled) {
      // Fin de scène
      const endAction = scene.end?.action || 'hold';
      if (endAction === 'chain' && scene.end?.next != null) {
        const next = _scenes.find((s) => s.id === scene.end.next);
        if (next) runScene(next);
      }
      runningScene = null;
    }
  }

  // ---------------------------------------------------------------
  // Déclencheurs
  // ---------------------------------------------------------------

  let _scenes = [];
  let _tourActive = false;

  // La visite guidée met le lecteur en pause
  document.addEventListener('b88:tour-start', () => { _tourActive = true; });
  document.addEventListener('b88:tour-end', () => { _tourActive = false; });

  function tryRun(scene) {
    if (_tourActive) return;
    runScene(scene);
  }

  const _observers = new Map();   // sceneId → IntersectionObserver
  const _intervals = new Map();   // sceneId → setInterval
  const _listeners = new Map();   // sceneId → { target, type, fn }

  function attachTrigger(scene) {
    const t = scene.trigger;
    const delay = (t.delay || 0) * 1000;

    // ---- Chargement ----
    if (t.type === 'load') {
      setTimeout(() => tryRun(scene), delay);
      return;
    }

    // ---- Élément entre dans l'écran ----
    if (t.type === 'enter') {
      const el = document.querySelector(t.selector);
      if (!el) return;

      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setTimeout(() => tryRun(scene), delay);
            if (t.leave === 'stop' || t.leave === 'revert') {
              // géré à la sortie ci-dessous
            }
          } else if (t.leave === 'stop' || t.leave === 'revert') {
            if (runningScene?.id === scene.id) runningScene.cancel();
          }
        });
      }, { threshold: t.threshold ?? 0.5 });

      obs.observe(el);
      _observers.set(scene.id, obs);
      return;
    }

    // ---- Scroll % ----
    if (t.type === 'scroll') {
      let fired = false;
      const onScroll = () => {
        const pct = (window.scrollY / (document.body.scrollHeight - window.innerHeight)) * 100;
        if (!fired && pct >= (t.scrollPct ?? 50)) {
          fired = true;
          setTimeout(() => tryRun(scene), delay);
        }
        if (fired && pct < (t.scrollPct ?? 50) && t.leave === 'revert') {
          fired = false;
          if (runningScene?.id === scene.id) runningScene.cancel();
        }
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      _listeners.set(scene.id, { target: window, type: 'scroll', fn: onScroll });
      return;
    }

    // ---- Clic sur l'avatar ----
    if (t.type === 'avatar-click') {
      const fn = () => setTimeout(() => tryRun(scene), delay);
      document.addEventListener('b88:character-click', fn);
      _listeners.set(scene.id, { target: document, type: 'b88:character-click', fn });
      return;
    }

    // ---- Clic sur un élément ----
    if (t.type === 'element-click') {
      const el = document.querySelector(t.selector);
      if (!el) return;
      const fn = () => setTimeout(() => tryRun(scene), delay);
      el.addEventListener('click', fn);
      _listeners.set(scene.id, { target: el, type: 'click', fn });
      return;
    }

    // ---- Survol ----
    if (t.type === 'hover') {
      const el = document.querySelector(t.selector);
      if (!el) return;
      const fnIn = () => setTimeout(() => tryRun(scene), delay);
      const fnOut = () => { if (runningScene?.id === scene.id) runningScene.cancel(); };
      el.addEventListener('mouseenter', fnIn);
      if (t.leave !== 'hold') el.addEventListener('mouseleave', fnOut);
      _listeners.set(scene.id, { target: el, type: 'mouseenter', fn: fnIn });
      return;
    }

    // ---- Inactivité ----
    if (t.type === 'idle') {
      const idleMs = (t.idleSeconds ?? 10) * 1000;
      let timer = null;
      const reset = () => {
        clearTimeout(timer);
        timer = setTimeout(() => tryRun(scene), idleMs + delay);
      };
      ['mousemove', 'keydown', 'scroll', 'click', 'touchstart'].forEach((ev) => {
        window.addEventListener(ev, reset, { passive: true });
      });
      reset();
      return;
    }

    // ---- Événement personnalisé ----
    if (t.type === 'event') {
      const fn = () => setTimeout(() => tryRun(scene), delay);
      document.addEventListener(t.eventName, fn);
      _listeners.set(scene.id, { target: document, type: t.eventName, fn });
      return;
    }
  }

  // ---------------------------------------------------------------
  // Initialisation
  // ---------------------------------------------------------------

  function init(data) {
    if (!data || data.version !== 2 || !Array.isArray(data.scenes)) {
      console.warn('[scene-reader] JSON invalide ou version incorrecte.');
      return;
    }

    const page = currentPage();
    const device = currentDevice();

    _scenes = data.scenes.filter((s) =>
      s.enabled &&
      s.pages.includes(page) &&
      s.devices.includes(device)
    );

    _scenes.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    // Si l'avatar est déjà prêt, on attache les déclencheurs tout de suite.
    // Sinon on attend l'événement b88:animations-ready.
    if (window.characterAnimations && window.characterAnimations.length) {
      _scenes.forEach(attachTrigger);
      console.info(`[scene-reader] ${_scenes.length} scène(s) chargée(s) pour "${page}" / "${device}".`);
    } else {
      document.addEventListener('b88:animations-ready', () => {
        _scenes.forEach(attachTrigger);
        console.info(`[scene-reader] ${_scenes.length} scène(s) chargée(s) pour "${page}" / "${device}".`);
      }, { once: true });
    }
  }
    // Tri par priorité décroissante
    _scenes.sort((a, b) => (b.priority || 0) - (a.priority || 0));

    _scenes.forEach(attachTrigger);

    console.info(`[scene-reader] ${_scenes.length} scène(s) chargée(s) pour "${page}" / "${device}".`);
  }

  // ---------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------

  // Lecture d'un fichier JSON via fetch
  window.b88LoadScenes = function (url) {
    fetch(url)
      .then((r) => r.json())
      .then(init)
      .catch((e) => console.warn('[scene-reader] Impossible de charger', url, e));
  };

  // Lecture directe d'un objet (utile pour le panneau admin)
  window.b88InitScenes = init;

  // Jouer une scène directement (utilisé par le bouton aperçu du panneau admin)
  window.b88PlayScene = function (scene) {
    runScene(scene);
  };

})();
