/* Bivouac88 · script commun : thème clair / sombre, menu, pied de page, lien de don.
   À charger dans le <head>, sans "defer" : le thème s'applique avant l'affichage. */
(function () {
  'use strict';

  // ---- Lien de la cagnotte : UNIQUE endroit à modifier ----
  // Les liens <a data-don> de toutes les pages reçoivent cette adresse.
  var DON_URL = 'https://www.leetchi.com/fr/c/bivouac88-4670104';
  var DON_OK = DON_URL.indexOf('https://www.leetchi.com/') === 0;

  var dossier = /\/peche\//.test(location.pathname) ? '../' : '';
  // Échappe le texte avant de l'insérer dans du HTML (à utiliser sur toute donnée venant d'une API)
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  window.B88 = Object.freeze({ DON_URL: DON_URL, racine: dossier, esc: esc });
  var SOLEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  var LUNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function el(tag, cls, txt) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (txt) n.textContent = txt;
    return n;
  }
  function lienDon(a) {
    if (!DON_OK) return;
    a.href = DON_URL;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
  }

  // ---- Bouton Partager (un seul code pour toutes les pages) ----
  function partager(btn) {
    var url = location.href;
    if (navigator.share) {
      navigator.share({ title: 'Bivouac88', url: url }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(function () {
        btn.textContent = 'Lien copié ✓';
        setTimeout(function () { btn.textContent = 'Partager'; }, 2000);
      }).catch(function () {});
    }
  }

  // ---- En-tête commun : logo, nom, Soutenir, Partager ----
  function construireEntete() {
    var marque = el('div', 'marque');
    var logo = el('a', 'logo');
    logo.href = dossier + 'index.html';
    logo.setAttribute('aria-label', 'Bivouac88 · accueil');
    var img = document.createElement('img');
    img.src = dossier + 'apple-touch-icon.png';
    img.alt = '';
    img.width = 90;
    img.height = 90;
    var nom = el('span', null, 'Bivouac');
    nom.appendChild(el('em', null, '88'));
    logo.appendChild(img);
    logo.appendChild(nom);
    var don = el('a', 'btn-don', 'Soutenir');
    don.setAttribute('data-don', '');
    var part = el('button', 'btn-partage', 'Partager');
    part.type = 'button';
    part.title = 'Partager';
    part.addEventListener('click', function () { partager(part); });
    marque.appendChild(logo);
    marque.appendChild(el('small', null, "Tour d'Europe à vélo"));
    marque.appendChild(don);
    marque.appendChild(part);
    return marque;
  }

  function themeChoisi() {    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }
  function themeSysteme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  function themeActuel() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
  function majIcone() {
    var b = document.getElementById('btn-theme');
    if (b) b.innerHTML = (themeActuel() === 'light') ? LUNE : SOLEIL; // SVG constants, aucune donnée externe
  }
  function appliquer(theme, memoriser) {
    document.documentElement.setAttribute('data-theme', theme);
    if (memoriser) { try { localStorage.setItem('theme', theme); } catch (e) {} }
    majIcone();
    // Les pages qui ont une carte (index) peuvent définir cette fonction
    if (typeof window.mettreAJourMarqueursTheme === 'function') {
      window.mettreAJourMarqueursTheme(theme);
    }
  }

  // Appliqué tout de suite, avant l'affichage
  document.documentElement.setAttribute('data-theme', themeChoisi() || themeSysteme());

  document.addEventListener('DOMContentLoaded', function () {
    var b = document.getElementById('btn-theme');
    if (!b) { // une nouvelle page n'a pas besoin d'ajouter le bouton à la main
      b = el('button', 'bouton-theme');
      b.id = 'btn-theme';
      b.type = 'button';
      b.setAttribute('aria-label', 'Changer de thème');
      b.title = 'Thème';
      (document.querySelector('main') || document.body).prepend(b);
    }
    majIcone();
    b.onclick = function () { appliquer(themeActuel() === 'light' ? 'dark' : 'light', true); };
    // ---- En-tête commun (si la page contient <div id="entete-site">) ----
    var hote = document.getElementById('entete-site');
    if (hote) hote.replaceWith(construireEntete());
    // ---- Liens de don ----    
     document.querySelectorAll('a[data-don]').forEach(lienDon);
    // ---- Menu commun ----
    if (!document.querySelector('.menu-site')) {
      var PAGES = [
        { id: 'index',   nom: 'Accueil',         url: 'index.html' },
        { id: 'etapes',  nom: 'Étapes',          url: 'etapes.html' },
        { id: 'stats',   nom: 'Stats',           url: 'stats.html' },
        { id: 'meteo',   nom: 'Météo & pêche',   url: 'peche/meteo.html' },
        { id: 'journal', nom: 'Journal de bord', url: 'journal.html' }
      ];
      // Les liens s'adaptent tout seuls à la page dans le dossier peche/
      var segment = location.pathname.split('/').pop().replace(/\.html$/, '') || 'index';
      var nomCourant = 'Menu';
      var ul = el('ul', 'menu-site__liens');
      ul.id = 'menu-liens';
      PAGES.forEach(function (p) {
        var actif = (p.id === segment);
        if (actif) nomCourant = p.nom;
        var li = document.createElement('li');
        var a = document.createElement('a');
        a.href = dossier + p.url;
        a.textContent = p.nom;
        if (actif) a.setAttribute('aria-current', 'page');
        li.appendChild(a);
        ul.appendChild(li);
      });

      var menuNav = el('nav', 'menu-site');
      menuNav.setAttribute('aria-label', 'Navigation principale');
      var barre = el('div', 'menu-site__barre');
      var burger = el('button', 'menu-site__burger');
      burger.type = 'button';
      burger.setAttribute('aria-label', 'Ouvrir le menu');
      burger.setAttribute('aria-expanded', 'false');
      burger.setAttribute('aria-controls', 'menu-liens');
      for (var i = 0; i < 3; i++) burger.appendChild(document.createElement('span'));
      barre.appendChild(el('span', 'menu-site__page', nomCourant));
      barre.appendChild(ul);
      barre.appendChild(burger);
      menuNav.appendChild(barre);
      document.body.insertBefore(menuNav, document.body.firstChild);

      var menuVoile = el('div', 'menu-voile');
      document.body.appendChild(menuVoile);

      function menuOuvrir(oui) {
        menuNav.classList.toggle('ouvert', oui);
        menuVoile.classList.toggle('visible', oui);
        burger.setAttribute('aria-expanded', oui ? 'true' : 'false');
        burger.setAttribute('aria-label', oui ? 'Fermer le menu' : 'Ouvrir le menu');
      }
      burger.addEventListener('click', function () {
        menuOuvrir(!menuNav.classList.contains('ouvert'));
      });
      menuVoile.addEventListener('click', function () { menuOuvrir(false); });
      document.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') menuOuvrir(false);
      });
      window.addEventListener('resize', function () {
        if (window.innerWidth > 767) menuOuvrir(false);
      });

      // Petite ombre quand la page défile
      function menuDefile() { menuNav.classList.toggle('defile', window.scrollY > 8); }
      window.addEventListener('scroll', menuDefile, { passive: true });
      menuDefile();
    }

    // Pied de page commun (ajouté seulement s'il n'y en a pas déjà un dans la page)
    if (!document.querySelector('.pied')) {
      var f = el('footer', 'pied');
      var home = el('a', null, 'Bivouac88');
      home.href = dossier + 'index.html';
      var logo = document.createElement('img');
      logo.src = dossier + 'Aventure cycliste au coucher du soleil.png';
      logo.alt = 'Lost but Free';
      logo.height = 20;
      logo.loading = 'lazy';
      logo.decoding = 'async';
      logo.style.height = '20px';
      logo.style.width = 'auto';
      logo.style.verticalAlign = 'middle';
      var don = el('a', null, 'Soutenir');
      don.setAttribute('data-don', '');
      lienDon(don);
      f.appendChild(home);
      f.appendChild(document.createTextNode(' · '));
      f.appendChild(logo);
      f.appendChild(document.createTextNode(' Lost but Free · '));
      f.appendChild(don);
      // Mention propre à une page : <main data-credit="Données : Open-Meteo · OpenStreetMap">
      var credit = (document.querySelector('main') || document.body).getAttribute('data-credit');
      if (credit) {
        f.appendChild(document.createElement('br'));
        f.appendChild(document.createTextNode(credit));
      }
      f.appendChild(document.createElement('br'));
      f.appendChild(document.createTextNode('Made with ♥ by Tito'));
      (document.querySelector('main') || document.body).appendChild(f);
    }
  });

  // Suit le thème du système tant que la personne n'a rien choisi
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', function (e) {
      if (!themeChoisi()) appliquer(e.matches ? 'light' : 'dark', false);
    });
  }
})();
