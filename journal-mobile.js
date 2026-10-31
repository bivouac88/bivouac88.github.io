/* journal-mobile.js · carnet 3D mobile (< 1100px). Remplace l'ancienne fonction mobile(). */
(function () {
  'use strict';
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

  /* Chaque feuille : zone qui défile + fondu du bas (comme sur PC) */
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

  /* Couverture : face avant (cadre doré) + face intérieure (papier de garde) */
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

  /* Dessin : appelé à chaque image de l'animation */
  /* Une page tournée se pose et s'aplatit contre le dos */
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
    tween(dur, function (e) { if (jeton[i] === id) { prog[i] = de + (cible - de) * e; rendre(); } },
      function () { if (jeton[i] === id && fin) fin(); });
  }

  /* Aller à une page : les feuilles se tournent l'une après l'autre */
  function aller(k) {
    if (!ouvert || busy || g || k < 0 || k >= N || k === cur) return;
    busy = true;
    var c0 = cur, sens = k > c0 ? 1 : -1, nb = Math.abs(k - c0), dur = reduit ? 200 : (nb > 1 ? 420 : 700);
    for (var s = 0; s < nb; s++) {
      (function (s) {
        setTimeout(function () {
          vers(sens > 0 ? c0 + s : c0 - s - 1, sens > 0 ? 1 : 0, dur,
            s === nb - 1 ? function () { cur = k; busy = false; etat(); } : null);
        }, s * 110);
      })(s);
    }
  }

  /* Ouverture de la couverture */
  function ouvrir() {
    if (ouvert || busy) return;
    busy = true;
    livre.classList.remove('ferme');
    tween(reduit ? 250 : 1100, function (e) { cp = e; rendre(); }, function () { ouvert = true; busy = false; etat(); });
    window.scrollTo({ top: Math.max(0, livre.getBoundingClientRect().top + window.pageYOffset - 120), behavior: reduit ? 'auto' : 'smooth' });
  }
  cv.addEventListener('click', ouvrir);
  cv.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(); } });

  /* Glisser : la page suit le doigt */
  livre.addEventListener('pointerdown', function (e) {
    if (!ouvert || busy || e.target.closest('.m-onglets')) return;
    g = { x: e.clientX, y: e.clientY, on: false, pts: [{ x: e.clientX, t: performance.now() }] };
  });
  livre.addEventListener('pointermove', function (e) {
    if (!g) return;
    var dx = e.clientX - g.x, dy = e.clientY - g.y;
    if (!g.on) {
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
      g.sens = dx < 0 ? 1 : -1;
      g.i = g.sens > 0 ? cur : cur - 1;
      if (g.i < 0 || (g.sens > 0 && cur >= N - 1)) { g = null; return; }
      g.on = true; jeton[g.i]++;
      try { livre.setPointerCapture(e.pointerId); } catch (x) {}
    }
    var r = livre.getBoundingClientRect();
    var p = g.sens > 0 ? -dx / r.width : 1 - dx / r.width;
    prog[g.i] = clamp(p * 1.3, 0, 1);
    tilt[g.i] = reduit ? 0 : clamp((e.clientY - r.top - r.height / 2) / r.height * 8, -4, 4);
    g.pts.push({ x: e.clientX, t: performance.now() });
    if (g.pts.length > 8) g.pts.shift();
    rendre();
  });
  function relacher() {
    if (!g) return;
    var o = g; g = null;
    if (!o.on) return;
    var p = o.pts, v = 0;
    if (p.length > 1 && p[p.length - 1].t > p[0].t) v = (p[p.length - 1].x - p[0].x) / (p[p.length - 1].t - p[0].t);
    var avant = o.sens > 0, a = prog[o.i];
    var tourne = avant ? (v < -0.4 || (v <= 0.4 && a > 0.35)) : !(v > 0.4 || (v >= -0.4 && a < 0.65));
    var nouveau = tourne ? (avant ? cur + 1 : cur) : (avant ? cur : cur - 1);
    busy = true; tilt[o.i] = 0;
    vers(o.i, tourne ? 1 : 0, reduit ? 150 : 300 + 250 * Math.abs((tourne ? 1 : 0) - a), function () { cur = nouveau; busy = false; etat(); });
  }
  livre.addEventListener('pointerup', relacher);
  livre.addEventListener('pointercancel', relacher);

  document.addEventListener('keydown', function (e) {
    if (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName)) return;
    if (e.key === 'ArrowRight') aller(cur + 1);
    else if (e.key === 'ArrowLeft') aller(cur - 1);
  });

  etat();
})();
