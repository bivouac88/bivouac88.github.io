
/*
 * BIVOUAC88 — Moteur de visite guidée
 * Indépendant de l'assistant flottant.
 * Tutoriel principal : resume.html
 */

(function () {
  'use strict';

  if (window.B88Tour) return;

  var PAGE = location.pathname.split('/').pop() || 'index.html';
  var CLE = 'b88-visite-resume-v1';
  var PARAM_RELANCE = new URLSearchParams(location.search).get('visite');

  var etapes = [
    {
      title: 'Bonjour et bienvenue !',
      text: 'Bienvenue sur Bivouac88 ! Je vais te présenter les différentes parties du projet et les informations disponibles sur ce tour d’Europe à vélo.'
    },
    {
      target: '#compte',
      title: 'Le compte à rebours',
      text: 'Ce compteur indique le temps restant avant le départ. Une fois le voyage commencé, cette partie pourra évoluer avec le projet.'
    },
    {
      target: '#bloc-prochaine',
      title: 'La prochaine étape',
      text: 'Cette carte présente l’étape en cours ou la prochaine étape prévue, avec les informations essentielles pour suivre le parcours.'
    },
    {
      target: '.stats-principales',
      title: 'Les chiffres du voyage',
      text: 'Ces quatre indicateurs permettent de suivre rapidement les étapes réalisées, les kilomètres parcourus, la distance restante et le dénivelé.'
    },
    {
      targets: ['.zone-carte-etapes', '#journal'],
      title: 'La carte et les étapes',
      text: 'La carte permet de visualiser le parcours. À côté, retrouve la liste des étapes et les informations associées à chaque journée de route.'
    },
    {
      target: '.stats-secondaires',
      title: 'Les statistiques détaillées',
      text: 'Retrouve ici des informations complémentaires : distance moyenne, plus longue étape, plus gros dénivelé et temps passé sur la route.'
    },
    {
      target: '.menu-site',
      title: 'La navigation',
      text: 'Le menu permet de parcourir les différentes rubriques : résumé, étapes, statistiques, journal de bord, météo et pêche, ainsi que les points d’intérêt.'
    },
    {
      targets: ['.btn-don', '.btn-partage'],
      title: 'Soutenir et partager',
      text: 'Tu peux soutenir le projet ou partager facilement le site autour de toi. Chaque partage aide à faire connaître l’aventure.'
    },
    {
      title: 'Voilà, tu connais le chemin !',
      text: 'Tu peux maintenant explorer librement le site. Les informations évolueront au fil du voyage. Merci de suivre l’aventure Bivouac88 !'
    }
  ];

  var index = 0;
  var actif = false;
  var overlay = null;
  var carte = null;
  var cibles = [];
  var observateur = null;
  var attente = null;

  function injecterStyle() {
    if (document.getElementById('b88-tour-style')) return;

    var style = document.createElement('style');
    style.id = 'b88-tour-style';
    style.textContent = `
      .b88-tour-highlight {
        position: relative !important;
        z-index: 10002 !important;
        outline: 3px solid #e58e26 !important;
        outline-offset: 5px;
        border-radius: 5px;
        box-shadow: 0 0 25px rgba(229,142,38,.45) !important;
      }
.b88-tour-overlay {
  position: fixed;
  inset: 0;
  z-index: 10000;
  background: rgba(0,0,0,.78);
  pointer-events: none;
}

.b88-tour-highlight {
  position: relative !important;
  z-index: 10002 !important;
  outline: 3px solid #e58e26 !important;
  outline-offset: 5px;
  border-radius: 5px;
  box-shadow:
    0 0 0 9999px rgba(0,0,0,.78),
    0 0 25px rgba(229,142,38,.45) !important;
}
      .b88-tour-card {
        position: fixed;
        z-index: 10003;
        left: 50%;
        bottom: 25px;
        transform: translateX(-50%);
        width: min(520px, calc(100vw - 30px));
        max-height: calc(100vh - 50px);
        overflow-y: auto;
        padding: 22px;
        border-radius: 13px;
        background: #201d18;
        color: #eee;
        box-shadow: 0 10px 40px rgba(0,0,0,.5);
        font-family: Arial, Helvetica, sans-serif;
        pointer-events: auto;
      }
      .b88-tour-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      .b88-tour-label {
        color: #e58e26;
        font-size: 10px;
        font-weight: bold;
        letter-spacing: 2px;
      }
      .b88-tour-close {
        border: 0;
        background: transparent;
        color: #fff;
        font-size: 25px;
        cursor: pointer;
      }
      .b88-tour-counter {
        margin-top: 16px;
        color: #e58e26;
        font-size: 11px;
      }
      .b88-tour-title {
        margin: 8px 0;
        color: #fff;
        font-size: 21px;
      }
      .b88-tour-description {
        margin: 0;
        color: #ccc;
        font-size: 14px;
        line-height: 1.6;
      }
      .b88-tour-controls {
        margin-top: 22px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 10px;
      }
      .b88-tour-controls > div {
        display: flex;
        gap: 8px;
      }
      .b88-tour-controls button {
        padding: 9px 13px;
        border: 1px solid #51483b;
        border-radius: 5px;
        background: #302a22;
        color: #fff;
        font-size: 12px;
        cursor: pointer;
      }
      .b88-tour-controls .b88-tour-next {
        background: #e58e26;
        border-color: #e58e26;
        color: #12100e;
        font-weight: bold;
      }
      .b88-tour-controls button:disabled {
        opacity: .35;
        cursor: default;
      }
      .b88-tour-controls button:hover:not(:disabled) {
        filter: brightness(1.15);
      }
        .b88-tour-launch {
        position: fixed;
        left: 20px;
        bottom: 20px;
        z-index: 9999;
        padding: 11px 16px;
        border: 1px solid #e58e26;
        border-radius: 8px;
        background: #201d18;
        color: #e58e26;
        font-size: 13px;
        font-weight: bold;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0,0,0,.35);
      }
      .b88-tour-launch:hover {
        background: #e58e26;
        color: #12100e;
      }
      @media (max-width: 480px) {
        .b88-tour-card {
          bottom: 12px;
          padding: 17px;
        }
        .b88-tour-controls {
          align-items: flex-end;
        }
      }
    `;
    document.head.appendChild(style);
  }

  function nettoyerCibles() {
    cibles.forEach(function (element) {
      element.classList.remove('b88-tour-highlight');
    });
    cibles = [];
  }

  function terminer(memoriser) {
    actif = false;

    if (observateur) {
      observateur.disconnect();
      observateur = null;
    }

    if (attente) {
      clearTimeout(attente);
      attente = null;
    }

    nettoyerCibles();

    if (overlay) {
      overlay.remove();
      overlay = null;
    }

    if (memoriser) {
      try {
        localStorage.setItem(CLE, '1');
      } catch (e) {}
    }
  }

  function creerPanneau() {
    overlay = document.createElement('div');
    overlay.className = 'b88-tour-overlay';

    carte = document.createElement('div');
    carte.className = 'b88-tour-card';
    carte.setAttribute('role', 'dialog');
    carte.setAttribute('aria-modal', 'true');
    carte.setAttribute('aria-label', 'Visite guidée Bivouac88');

    carte.innerHTML = `
      <div class="b88-tour-top">
        <span class="b88-tour-label">VISITE GUIDÉE</span>
        <button class="b88-tour-close" type="button"
                aria-label="Quitter la visite">×</button>
      </div>
      <div class="b88-tour-counter"></div>
      <h3 class="b88-tour-title"></h3>
      <p class="b88-tour-description"></p>
      <div class="b88-tour-controls">
        <button class="b88-tour-skip" type="button">Quitter</button>
        <div>
          <button class="b88-tour-previous" type="button">← Retour</button>
          <button class="b88-tour-next" type="button">Suivant →</button>
        </div>
      </div>
    `;

    overlay.appendChild(carte);
    document.body.appendChild(overlay);

    carte.querySelector('.b88-tour-close')
      .addEventListener('click', function () {
        terminer(false);
      });

    carte.querySelector('.b88-tour-skip')
      .addEventListener('click', function () {
        terminer(false);
      });

    carte.querySelector('.b88-tour-previous')
      .addEventListener('click', precedent);

    carte.querySelector('.b88-tour-next')
      .addEventListener('click', suivant);

    document.addEventListener('keydown', toucheClavier);
  }

  function toucheClavier(event) {
    if (!actif) return;

    if (event.key === 'Escape') {
      document.removeEventListener('keydown', toucheClavier);
      terminer(false);
    }
  }

  function trouverCibles(etape) {
    var selecteurs = etape.targets || (etape.target ? [etape.target] : []);

    return selecteurs.map(function (selecteur) {
      return document.querySelector(selecteur);
    }).filter(function (element) {
      if (!element) return false;

      var style = getComputedStyle(element);
      return style.display !== 'none' &&
             style.visibility !== 'hidden' &&
             element.getBoundingClientRect().width > 0;
    });
  }

  function afficherEtape() {
    if (!actif || !carte) return;

    nettoyerCibles();

    var etape = etapes[index];
    if (!etape) {
      terminer(true);
      return;
    }

    var trouvees = trouverCibles(etape);

    // Une étape avec cible est ignorée si son élément n'existe pas
    // ou n'est pas visible.
    if ((etape.target || etape.targets) && !trouvees.length) {
      index++;
      afficherEtape();
      return;
    }

    cibles = trouvees;

    cibles.forEach(function (element) {
      element.classList.add('b88-tour-highlight');
    });

    if (cibles.length) {
      cibles[0].scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    carte.querySelector('.b88-tour-counter').textContent =
      (index + 1) + ' / ' + etapes.length;

    carte.querySelector('.b88-tour-title').textContent = etape.title;
    carte.querySelector('.b88-tour-description').textContent = etape.text;

    carte.querySelector('.b88-tour-previous').disabled = index === 0;

    carte.querySelector('.b88-tour-next').textContent =
      index === etapes.length - 1 ? 'Terminer' : 'Suivant →';
  }

  function suivant() {
    if (!actif) return;

    if (index < etapes.length - 1) {
      index++;
      afficherEtape();
    } else {
      document.removeEventListener('keydown', toucheClavier);
      terminer(true);
    }
  }

  function precedent() {
    if (!actif || index <= 0) return;
    index--;
    afficherEtape();
  }

  function demarrer() {
    if (PAGE !== 'resume.html') return false;

    if (actif) terminer(false);

    injecterStyle();

    index = 0;
    actif = true;

    creerPanneau();
    afficherEtape();

    return true;
  }

  function initialiser() {
    if (PAGE === 'index.html') return;

    injecterStyle();

    if (document.getElementById('b88-tour-launch')) return;

    var bouton = document.createElement('button');
    bouton.id = 'b88-tour-launch';
    bouton.className = 'b88-tour-launch';
    bouton.type = 'button';
    bouton.textContent = '▶ Visite guidée';

    bouton.addEventListener('click', function () {
      if (PAGE === 'resume.html') {
        demarrer();
      } else {
        alert('La visite guidée de cette page est en préparation.');
      }
    });

    document.body.appendChild(bouton);
  }

  window.B88Tour = {
    start: demarrer,
    stop: function () {
      document.removeEventListener('keydown', toucheClavier);
      terminer(false);
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initialiser);
  } else {
    initialiser();
  }

})();
