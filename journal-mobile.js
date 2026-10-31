/* journal-mobile.js · carnet 3D mobile (< 1100px). */
(function () {
  'use strict';
  var lance = false;
  window.demarrerMobile = function () {
    if (lance) return;
    lance = true;
    lancer();
  };
  if (window.carnetPret) window.demarrerMobile();

  function lancer() {
  if (!window.matchMedia('(max-width: 1099px)').matches) return;
  var TEXTES = { exlibris: 'Ce journal appartient à', proprio: 'Bivouac88' };
  var carnet = document.querySelector('.carnet');
  if (!carnet) return;
  var reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var feuilles = [], chaps = [], chap = '';
  Array.prototype.slice.call(carnet.children).forEach(function (el) {
    if (el.classList.contains('chapitre')) chap = el.textContent.trim();
    else if (el.classList.contains('feuille')) {
      if (chap && !el.classList.contains('garde') && !chaps.some(function (c) { return c.nom === chap; })) chaps.push({ nom: chap, i: feuilles.length });
      feuilles.push(el);
    }
  });
  var couv = carnet.querySelector('.couverture');
  var cadre = couv && couv.querySelector('.couverture-cadre');
  if (!feuilles.length || !cadre) return;

  function d(c) { var e = document.createElement('div'); e.className = c; return e; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ease(u) { return u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2; }
  function bouton(txt, label) { var b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.setAttribute('aria-label', label); return b; }
  function tween(dur, f, fin) {
    var t0 = null;
    requestAnimationFrame(function pas(t) {
      if (t0 === null) t0 = t;
      var u = Math.min(1, (t - t0) / dur);
      f(ease(u));
      if (u < 1) requestAnimationFrame(pas); else if (fin) fin();
    });
  }

  function preparer(f) {
    var date = f.querySelector(':scope > .feuille-date');
    var int = d('feuille-int'), corps = d('feuille-corps');
    Array.prototype.slice.call(f.childNodes).forEach(function (nd) { if (nd !== date) corps.appendChild(nd); });
    int.appendChild(corps); f.appendChild(int); f.appendChild(d('fondu'));
    if (date) f.appendChild(date);
    function maj() { var s = int.scrollHeight - int.clientHeight; f.classList.toggle('fin', s < 8 || int.scrollTop >= s - 8); }
    int.addEventListener('scroll', maj, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(maj).observe(corps);
    maj();
  }

  var N = feuilles.length, cur = 0, ouvert = false, busy = false, cp = 0, g = null;
  var prog = [], tilt = [], jeton = [];
  var livre = d('m-livre ferme');
  livre.innerHTML = '<div class="m-plat"></div><div class="m-pile"></div><div class="m-pile-g"></div><div class="m-spirale"></div>';
  var onglets = d('m-onglets');
  livre.appendChild(onglets);

  var leaves = feuilles.map(function (f) {
    var lf = d('m-leaf'), re = d('m-recto'), ve = d('m-verso');
    preparer(f);
    re.appendChild(f); re.appendChild(d('m-lum')); re.appendChild(d('m-sous'));
    lf.appendChild(re); lf.appendChild(ve);
    livre.appendChild(lf);
    prog.push(0); tilt.push(0); jeton.push(0);
    return lf;
  });

  var cv = d('m-couv');
  var av = d('m-face m-av'), ar = d('m-face m-ar');
  av.appendChild(cadre);
  ar.innerHTML = '<div class="m-ex"><span></span><strong></strong></div>';
  ar.querySelector('span').textContent = TEXTES.exlibris;
  ar.querySelector('strong').textContent = TEXTES.proprio;
  cv.appendChild(av); cv.appendChild(ar);
  cv.setAttribute('role', 'button'); cv.tabIndex = 0; cv.setAttribute('aria-label', 'Ouvrir le journal');
  livre.appendChild(cv);

  chaps.forEach(function (c) {
    var b = bouton(c.nom, 'Aller au chapitre : ' + c.nom);
    b.addEventListener('click', function () { aller(c.i); });
    c.btn = b; onglets.appendChild(b);
  });

  var nav = d('m-nav'), pv = bouton('‹', 'Page précédente'), nx = bouton('›', 'Page suivante');
  var cpt = document.createElement('span');
  cpt.className = 'm-cpt'; cpt.setAttribute('aria-live', 'polite');
  nav.appendChild(pv); nav.appendChild(cpt); nav.appendChild(nx);
  pv.addEventListener('click', function () { aller(cur - 1); });
  nx.addEventListener('click', function () { aller(cur + 1); });

  carnet.classList.add('m-actif');
  carnet.appendChild(livre);
  carnet.appendChild(nav);

  function serre(a) {
    if (a < 0.5) return 1;
    var u = (a - 0.5) * 2;
    return 1 - 0.98 * u * u * (3 - 2 * u);
  }
  function rendre() {
    var f1 = 0;
    while (f1 < N && prog[f1] >= 1) f1++;
    leaves.forEach(function (lf, i) {
      var a = prog[i], vol = a > 0 && a < 1, tourne = a >= 1;
      var vis = tourne ? i >= f1 - 2 : (vol || i <= f1 + 3);
      lf.style.visibility = vis ? '' : 'hidden';
      if (!vis) return;
      lf.style.zIndex = vol ? 3000 - i : (tourne ? i + 10 : N - i + 10);
      lf.style.transform = 'scaleX(' + serre(a).toFixed(3) + ') rotateY(' + (-a * 180).toFixed(2) + 'deg)' + (tilt[i] ? ' rotateX(' + (tilt[i] * Math.sin(a * Math.PI)).toFixed(2) + 'deg)' : '');
      lf.style.setProperty('--lum', (Math.sin(a * Math.PI) * 0.55).toFixed(2));
      lf.style.setProperty('--sous', i ? (Math.sin(prog[i - 1] * Math.PI) * 0.5).toFixed(2) : '0');
    });
    cv.style.transform = 'scaleX(' + serre(cp).toFixed(3) + ') rotateY(' + (-cp * 180).toFixed(2) + 'deg)';
  }
  function etat() {
    cpt.textContent = (cur + 1) + ' / ' + N;
    pv.disabled = cur === 0;
    nx.disabled = cur === N - 1;
    var act = -1;
    chaps.forEach(function (c, j) { if (c.i <= cur) act = j; });
    chaps.forEach(function (c, j) { c.btn.classList.toggle('actif', j === act); });
    livre.style.setProperty('--ep', (3 + 9 * (N - 1 - cur) / Math.max(1, N - 1)).toFixed(1) + 'px');
    livre.style.setProperty('--eg', (cur ? 3 + 8 * cur / Math.max(1, N - 1) : 0).toFixed(1) + 'px');
    rendre();
  }

  function vers(i, cible, dur, fin) {
    var de = prog[i], id = ++jeton[i];
