/* journal-3d.js · lampe, ombre dynamique et poussière (grand écran, sans librairie) */
(function () {
  'use strict';
  if (!window.matchMedia('(min-width: 1100px)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var lampe = document.createElement('div');
  lampe.className = 'lampe';
  lampe.setAttribute('aria-hidden', 'true');
  var cv = document.createElement('canvas');
  cv.className = 'poussiere';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(lampe);
  document.body.appendChild(cv);

  var ctx = cv.getContext('2d');
  var W = 0, H = 0;
  function taille() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
  taille();
  window.addEventListener('resize', taille);

  var tx = W * 0.5, ty = H * 0.18, mx = tx, my = ty;
  window.addEventListener('pointermove', function (e) { tx = e.clientX; ty = e.clientY; }, { passive: true });

  var grains = [];
  for (var i = 0; i < 45; i++) {
    grains.push({
      x: Math.random() * W, y: Math.random() * H,
      r: 0.6 + Math.random() * 1.4,
      vx: (Math.random() - 0.5) * 0.12, vy: -0.03 - Math.random() * 0.1,
      ph: Math.random() * 6.28
    });
  }

  var livre = document.querySelector('.carnet.livre-actif');
  var ox = null, oy = null;
  var n = 0, t0 = 0, actif = true;

  function boucle(t) {
    if (!actif) return;
    /* Garde-fou : si les 90 premières images sont trop lentes (< ~35 i/s), on coupe les effets */
    if (n === 0) t0 = t;
    if (++n === 90 && (t - t0) / 90 > 28) { actif = false; lampe.remove(); cv.remove(); return; }

    mx += (tx - mx) * 0.08;
    my += (ty - my) * 0.08;
    lampe.style.setProperty('--mx', mx.toFixed(0) + 'px');
    lampe.style.setProperty('--my', my.toFixed(0) + 'px');

    if (livre) {
      var nx = Math.round((0.5 - mx / W) * 40);
      var ny = Math.round(-(my / H - 0.3) * 30);
      if (nx !== ox) { ox = nx; livre.style.setProperty('--ox', nx); }
      if (ny !== oy) { oy = ny; livre.style.setProperty('--oy', ny); }
    }

    ctx.clearRect(0, 0, W, H);
    for (var k = 0; k < grains.length; k++) {
      var g = grains[k];
      g.x += g.vx + Math.sin(t * 0.0004 + g.ph) * 0.15;
      g.y += g.vy;
      if (g.y < -5) { g.y = H + 5; g.x = Math.random() * W; }
      if (g.x < -5) g.x = W + 5; else if (g.x > W + 5) g.x = -5;
      var d = Math.hypot(g.x - mx, g.y - my);
      var a = Math.max(0, 1 - d / 520) * (0.25 + 0.35 * Math.abs(Math.sin(t * 0.001 + g.ph)));
      if (a < 0.02) continue;
      ctx.fillStyle = 'rgba(255,225,170,' + a.toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(g.x, g.y, g.r, 0, 6.2832);
      ctx.fill();
    }
    requestAnimationFrame(boucle);
  }
  requestAnimationFrame(boucle);
})();
