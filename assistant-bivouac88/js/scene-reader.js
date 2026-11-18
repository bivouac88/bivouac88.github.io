
// scene-reader.js — moteur de scènes Bivouac88
// Format JSON v2 — PC et Mobile
// Déclencheurs, conditions, déplacements, animations et enchaînements.

(function () {
  'use strict';

  // ---------------------------------------------------------------
  // CONFIGURATION
  // ---------------------------------------------------------------

  const STORAGE_KEY = 'b88-scenes-state';
  const MOBILE_BREAKPOINT = 768;

  function currentPage() {
    return document.body.dataset.page || '';
  }

  function currentDevice() {
    return window.innerWidth < MOBILE_BREAKPOINT ? 'mobile' : 'pc';
  }

  function getElement(selector) {
    if (!selector) return null;
    try {
      return document.querySelector(selector);
    } catch (error) {
      console.warn('[scene-reader] Sélecteur invalide :', selector);
      return null;
    }
  }

  function resolvePoint(point) {
    if (!point || typeof point !== 'object') {
      return { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    }

    const element = getElement(point.selector);

    if (element) {
      const rect = element.getBoundingClientRect();

      return {
        x: rect.left + ((Number(point.ax) || 0) / 100) * rect.width
          + (Number(point.offsetX) || 0),

        y: window.innerHeight - (
          rect.top + ((Number(point.ay) || 0) / 100) * rect.height
          + (Number(point.offsetY) || 0)
        )
      };
    }

    const fallback = point.fallback || {};

    return {
      x: ((Number(fallback.xPct) || 50) / 100) * window.innerWidth,
      y: ((Number(fallback.yPct) || 50) / 100) * window.innerHeight
    };
  }

  function wait(ms, cancelRef) {
    return new Promise(resolve => {
      if (cancelRef.cancelled) {
        resolve();
        return;
      }

      const timer = setTimeout(() => {
        cancelRef.timers.delete(timer);
        resolve();
      }, Math.max(0, ms));

      cancelRef.timers.add(timer);
    });
  }

  // ---------------------------------------------------------------
  // MÉMOIRE DES CONDITIONS
  // ---------------------------------------------------------------

  function readStorage(storage) {
    try {
      return JSON.parse(storage.getItem(STORAGE_KEY)) || {};
    } catch (error) {
      return {};
    }
  }

  function writeStorage(storage, data) {
    try {
      storage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (error) {
      // Le stockage peut être indisponible.
    }
  }

  const ranThisLoad = new Set();

  function canRun(scene) {
    const conditions = scene.conditions || {};
    const frequency = conditions.frequency || 'always';
    const cooldown = Math.max(0, Number(conditions.cooldownSeconds) || 0);

    const sessionState = readStorage(sessionStorage);
    const entry = sessionState[scene.id] || {};
    const now = Date.now();

    if (
      cooldown > 0 &&
      entry.lastRun &&
      now - entry.lastRun < cooldown * 1000
    ) {
      return false;
    }

    if (frequency === 'load') {
      return !ranThisLoad.has(String(scene.id));
    }

    if (frequency === 'session') {
      return !entry.ranThisSession;
    }

    if (frequency === 'visitor') {
      const visitorState = readStorage(localStorage);
      return !visitorState[scene.id]?.ranEver;
    }

    return true;
  }

  function markRan(scene) {
    const state = readStorage(sessionStorage);

    state[scene.id] = {
      lastRun: Date.now(),
      ranThisSession: true
    };

    writeStorage(sessionStorage, state);
    ranThisLoad.add(String(scene.id));

    if ((scene.conditions || {}).frequency === 'visitor') {
      const visitorState = readStorage(localStorage);

      visitorState[scene.id] = { ranEver: true };

      writeStorage(localStorage, visitorState);
    }
  }

  // ---------------------------------------------------------------
  // POSITION DES CHAMPS DE DIALOGUE
  // ---------------------------------------------------------------

  let currentFieldOffsets = null;

  function applyFieldOffsets(bubble, form) {
    currentFieldOffsets = { bubble, form };

    const apply = (selector, offset) => {
      if (!offset || !Number.isFinite(Number(offset.x))
          || !Number.isFinite(Number(offset.y))) return;

      const element = getElement(selector);
      if (!element) return;

      element.dataset.dragX = String(offset.x);
      element.dataset.dragY = String(offset.y);
      element.style.translate = `${offset.x}px ${offset.y}px`;
    };

    apply('.b88-dialogue-bubble', bubble);
    apply('.b88-dialogue-form', form);
  }

  document.addEventListener('b88:dialogue-ready', () => {
    if (!currentFieldOffsets) return;

    applyFieldOffsets(
      currentFieldOffsets.bubble,
      currentFieldOffsets.form
    );
  });

  // ---------------------------------------------------------------
  // ÉTAT DU MOTEUR
  // ---------------------------------------------------------------

  let scenes = [];
  let runningScene = null;
  let positionCleanup = null;
  let tourActive = false;

  const triggerCleanups = [];

  document.addEventListener('b88:tour-start', () => {
    tourActive = true;
  });

  document.addEventListener('b88:tour-end', () => {
    tourActive = false;
  });

  function clearPositionUpdater() {
    if (positionCleanup) {
      positionCleanup();
      positionCleanup = null;
    }
  }

  function cancelCurrentScene() {
    if (!runningScene) return;

    runningScene.cancel();
  }

  // ---------------------------------------------------------------
  // DÉPLACEMENT À PIED
  // ---------------------------------------------------------------

  function walkTo(
    targetX,
    targetY,
    speed,
    walkAnimation,
    autoFace,
    cancelRef
  ) {
    return new Promise(resolve => {
      const stepMs = 16;
      const pixelsPerStep = Math.max(1, speed) / 1000 * stepMs;

      if (typeof window.characterPlay === 'function') {
        window.characterPlay(walkAnimation);
      }

      function finish() {
        if (!cancelRef.cancelled &&
            typeof window.characterMoveTo === 'function') {
          window.characterMoveTo(targetX, targetY);
        }

        resolve();
      }

      function tick() {
        if (cancelRef.cancelled) {
          resolve();
          return;
        }

        const position =
          typeof window.characterGetPosition === 'function'
            ? window.characterGetPosition()
            : null;

        if (!position) {
          finish();
          return;
        }

        const dx = targetX - position.x;
        const dy = targetY - position.y;
        const distance = Math.hypot(dx, dy);

        if (distance <= pixelsPerStep) {
          finish();
          return;
        }

        const nextX = position.x + dx / distance * pixelsPerStep;
        const nextY = position.y + dy / distance * pixelsPerStep;

        if (autoFace && typeof window.characterRotate === 'function') {
          window.characterRotate(0, dx < 0 ? 180 : 0, 0);
        }

        if (typeof window.characterMoveTo === 'function') {
          window.characterMoveTo(nextX, nextY);
        }

        const timer = setTimeout(() => {
          cancelRef.timers.delete(timer);
          tick();
        }, stepMs);

        cancelRef.timers.add(timer);
      }

      tick();
    });
  }

  // ---------------------------------------------------------------
  // GESTION DE LA POSITION PENDANT UNE ÉTAPE
  // ---------------------------------------------------------------

  function activatePositionMode(point, target, cancelRef) {
    clearPositionUpdater();

    if (point.mode === 'follow') {
      const update = () => {
        if (cancelRef.cancelled) return;

        const position = resolvePoint(point);

        if (typeof window.characterMoveTo === 'function') {
          window.characterMoveTo(position.x, position.y);
        }
      };

      const interval = setInterval(update, 100);

      positionCleanup = () => clearInterval(interval);

      return;
    }

    const xRatio = target.x / Math.max(1, window.innerWidth);
    const yRatio = target.y / Math.max(1, window.innerHeight);

    const onResize = () => {
      if (cancelRef.cancelled) return;

      if (typeof window.characterMoveTo === 'function') {
        window.characterMoveTo(
          xRatio * window.innerWidth,
          yRatio * window.innerHeight
        );
      }
    };

    window.addEventListener('resize', onResize);

    positionCleanup = () => {
      window.removeEventListener('resize', onResize);
    };
  }

  // ---------------------------------------------------------------
  // EXÉCUTION D'UNE SCÈNE
  // ---------------------------------------------------------------

  async function runScene(scene, options = {}) {
    const preview = options.preview === true;

    if (!scene || !Array.isArray(scene.steps) || !scene.steps.length) {
      console.warn('[scene-reader] Scène vide ou invalide.');
      return;
    }

    if (tourActive && !preview) return;
    if (!preview && !canRun(scene)) return;

    // Une scène non interruptible bloque les autres scènes.
    if (runningScene) {
      const currentDefinition = scenes.find(
        item => String(item.id) === String(runningScene.id)
      );

      if (
        currentDefinition &&
        currentDefinition.conditions?.interruptible === false
      ) {
        return;
      }

      cancelCurrentScene();
    }

    if (!preview) markRan(scene);

    clearPositionUpdater();

    const cancelRef = {
      cancelled: false,
      timers: new Set()
    };

    runningScene = {
      id: scene.id,

      cancel() {
        cancelRef.cancelled = true;

        cancelRef.timers.forEach(timer => {
          clearTimeout(timer);
        });

        cancelRef.timers.clear();
        clearPositionUpdater();

        if (runningScene?.id === scene.id) {
          runningScene = null;
        }
      }
    };

    const repeat = Math.max(0, Number(scene.end?.repeat ?? 1));
    const loops = repeat === 0 ? Infinity : repeat;

    try {
      for (let loop = 0; loop < loops; loop++) {
        if (cancelRef.cancelled) break;

        for (const step of scene.steps) {
          if (cancelRef.cancelled) break;

          const pause = Math.max(0, Number(step.pause) || 0);

          if (pause > 0) {
            await wait(pause * 1000, cancelRef);
          }

          if (cancelRef.cancelled) break;

          const point = scene.points?.[step.at];

          if (!point) {
            console.warn(
              `[scene-reader] Point "${step.at}" introuvable dans la scène ${scene.id}.`
            );
            continue;
          }

          const target = resolvePoint(point);
          const move = step.move || {};

          // Déplacement
          if (
            move.type === 'walk' &&
            !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ) {
            await walkTo(
              target.x,
              target.y,
              Number(move.speed) || 200,
              move.walkAnimation || 'Running',
              step.autoFace !== false,
              cancelRef
            );
          } else if (typeof window.characterMoveTo === 'function') {
            window.characterMoveTo(target.x, target.y);
          }

          if (cancelRef.cancelled) break;

          // Animation
          if (
            step.animation &&
            typeof window.characterPlay === 'function'
          ) {
            window.characterPlay(step.animation);
          }

          // Orientation
          const rotation = step.rotation || {};

          if (typeof window.characterRotate === 'function') {
            window.characterRotate(
              Number(rotation.x) || 0,
              Number(rotation.y) || 0,
              Number(rotation.z) || 0
            );
          }

          // Champs de dialogue
          applyFieldOffsets(step.bubble, step.form);

          // Positionnement dynamique
          activatePositionMode(point, target, cancelRef);

          // Durée facultative : null signifie maintien jusqu'à la suite.
          if (step.duration !== null && step.duration !== undefined) {
            const duration = Math.max(0, Number(step.duration) || 0);

            await wait(duration * 1000, cancelRef);

            if (!cancelRef.cancelled) {
              clearPositionUpdater();
            }
          }
        }
      }

      if (cancelRef.cancelled) return;

      // Fin de scène : on arrête les mises à jour de position.
      clearPositionUpdater();

      const endAction = scene.end?.action || 'hold';
      const nextId = scene.end?.next;

      runningScene = null;

      // Signale la fin aux scènes qui attendent cet événement.
      document.dispatchEvent(new CustomEvent('b88:scene-ended', {
        detail: { id: scene.id }
      }));

      // Enchaînement éventuel.
      if (endAction === 'chain' && nextId !== null && nextId !== undefined) {
        const nextScene = scenes.find(
          item => String(item.id) === String(nextId)
        );

        if (nextScene) {
          runScene(nextScene, { preview });
        } else {
          console.warn(
            `[scene-reader] Scène suivante introuvable : ${nextId}.`
          );
        }
      }

    } catch (error) {
      console.error(
        `[scene-reader] Erreur pendant la scène ${scene.id} :`,
        error
      );

      clearPositionUpdater();

      if (runningScene?.id === scene.id) {
        runningScene = null;
      }
    }
  }

  // ---------------------------------------------------------------
  // DÉCLENCHEURS
  // ---------------------------------------------------------------

  function tryRun(scene) {
    if (!tourActive) runScene(scene);
  }

  function addTriggerCleanup(cleanup) {
    triggerCleanups.push(cleanup);
  }

  function attachTrigger(scene) {
    const trigger = scene.trigger || {};
    const type = trigger.type;
    const delay = Math.max(0, Number(trigger.delay) || 0) * 1000;

    let pendingTimer = null;

    function fire() {
      if (pendingTimer) clearTimeout(pendingTimer);

      pendingTimer = setTimeout(() => {
        pendingTimer = null;
        tryRun(scene);
      }, delay);
    }

    function cleanupTimer() {
      if (pendingTimer) {
        clearTimeout(pendingTimer);
        pendingTimer = null;
      }
    }

    // Chargement de la page
    if (type === 'load') {
      fire();
      addTriggerCleanup(cleanupTimer);
      return;
    }

    // Entrée d'un élément dans l'écran
    if (type === 'enter') {
      const element = getElement(trigger.selector);
      if (!element) return;

      const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            fire();
          } else if (trigger.leave === 'stop') {
            cleanupTimer();

            if (runningScene?.id === scene.id) {
              cancelCurrentScene();
            }
          }
        });
      }, {
        threshold: Math.min(
          1,
          Math.max(0, Number(trigger.threshold ?? 0.5))
        )
      });

      observer.observe(element);

      addTriggerCleanup(() => {
        observer.disconnect();
        cleanupTimer();
      });

      return;
    }

    // Pourcentage de défilement
    if (type === 'scroll') {
      let fired = false;

      const onScroll = () => {
        const maxScroll = document.documentElement.scrollHeight
          - window.innerHeight;

        const percentage = maxScroll > 0
          ? window.scrollY / maxScroll * 100
          : 0;

        const threshold = Number(trigger.scrollPct ?? 50);

        if (!fired && percentage >= threshold) {
          fired = true;
          fire();
        }

        if (
          fired &&
          percentage < threshold &&
          trigger.leave === 'stop'
        ) {
          fired = false;
          cleanupTimer();

          if (runningScene?.id === scene.id) {
            cancelCurrentScene();
          }
        }
      };

      window.addEventListener('scroll', onScroll, { passive: true });

      addTriggerCleanup(() => {
        window.removeEventListener('scroll', onScroll);
        cleanupTimer();
      });

      return;
    }

    // Clic sur l'avatar
    if (type === 'avatar-click') {
      const listener = fire;

      document.addEventListener('b88:character-click', listener);

      addTriggerCleanup(() => {
        document.removeEventListener('b88:character-click', listener);
        cleanupTimer();
      });

      return;
    }

    // Clic sur un élément
    if (type === 'element-click') {
      const element = getElement(trigger.selector);
      if (!element) return;

      element.addEventListener('click', fire);

      addTriggerCleanup(() => {
        element.removeEventListener('click', fire);
        cleanupTimer();
      });

      return;
    }

    // Survol d'un élément
    if (type === 'hover') {
      const element = getElement(trigger.selector);
      if (!element) return;

      const onEnter = fire;

      const onLeave = () => {
        cleanupTimer();

        if (
          trigger.leave === 'stop' &&
          runningScene?.id === scene.id
        ) {
          cancelCurrentScene();
        }
      };

      element.addEventListener('mouseenter', onEnter);

      if (trigger.leave === 'stop') {
        element.addEventListener('mouseleave', onLeave);
      }

      addTriggerCleanup(() => {
        element.removeEventListener('mouseenter', onEnter);
        element.removeEventListener('mouseleave', onLeave);
        cleanupTimer();
      });

      return;
    }

    // Inactivité
    if (type === 'idle') {
      const idleMs = Math.max(
        0,
        Number(trigger.idleSeconds ?? 10)
      ) * 1000;

      let idleTimer = null;

      const reset = () => {
        clearTimeout(idleTimer);

        idleTimer = setTimeout(() => {
          fire();
        }, idleMs);
      };

      const events = [
        'mousemove',
        'keydown',
        'scroll',
        'click',
        'touchstart'
      ];

      events.forEach(eventName => {
        window.addEventListener(eventName, reset, { passive: true });
      });

      reset();

      addTriggerCleanup(() => {
        clearTimeout(idleTimer);
        cleanupTimer();

        events.forEach(eventName => {
          window.removeEventListener(eventName, reset);
        });
      });

      return;
    }

    // Fin d'une autre scène
    if (type === 'after-scene') {
      const expectedId = String(trigger.afterScene);

      const listener = event => {
        if (String(event.detail?.id) === expectedId) {
          fire();
        }
      };

      document.addEventListener('b88:scene-ended', listener);

      addTriggerCleanup(() => {
        document.removeEventListener('b88:scene-ended', listener);
        cleanupTimer();
      });

      return;
    }

    // Événement personnalisé
    if (type === 'event') {
      if (!trigger.eventName) return;

      const listener = fire;

      document.addEventListener(trigger.eventName, listener);

      addTriggerCleanup(() => {
        document.removeEventListener(trigger.eventName, listener);
        cleanupTimer();
      });
    }
  }

  // ---------------------------------------------------------------
  // INITIALISATION
  // ---------------------------------------------------------------

  function init(data) {
    if (
      !data ||
      data.version !== 2 ||
      !Array.isArray(data.scenes)
    ) {
      console.warn('[scene-reader] JSON invalide ou version incorrecte.');
      return;
    }

    // Nettoyage d'une éventuelle initialisation précédente.
    triggerCleanups.forEach(cleanup => cleanup());
    triggerCleanups.length = 0;

    cancelCurrentScene();
    clearPositionUpdater();

    const page = currentPage();
    const device = currentDevice();

    scenes = data.scenes.filter(scene => {
      return (
        scene &&
        scene.enabled === true &&
        Array.isArray(scene.pages) &&
        scene.pages.includes(page) &&
        Array.isArray(scene.devices) &&
        scene.devices.includes(device)
      );
    });

    scenes.sort((a, b) => {
      return (Number(b.priority) || 0) - (Number(a.priority) || 0);
    });

    const attachAll = () => {
      scenes.forEach(attachTrigger);

      console.info(
        `[scene-reader] ${scenes.length} scène(s) chargée(s) pour "${page}" / "${device}".`
      );
    };

    if (
      window.characterAnimations &&
      window.characterAnimations.length
    ) {
      attachAll();
    } else {
      document.addEventListener('b88:animations-ready', attachAll, {
        once: true
      });
    }
  }

  // ---------------------------------------------------------------
  // API PUBLIQUE
  // ---------------------------------------------------------------

  window.b88LoadScenes = function (url) {
    fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        return response.json();
      })
      .then(init)
      .catch(error => {
        console.warn('[scene-reader] Impossible de charger le JSON :', error);
      });
  };

  window.b88InitScenes = init;

  // L'aperçu admin ne consomme pas les conditions de fréquence.
  window.b88PlayScene = function (scene) {
    runScene(scene, { preview: true });
  };

})();
