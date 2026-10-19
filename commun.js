/* Bivouac88 · script commun : thème clair / sombre
   À charger dans le <head>, sans "defer" : le thème s'applique avant l'affichage. */
(function () {
  var SOLEIL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>';
  var LUNE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';

  function themeChoisi() {
    try { return localStorage.getItem('theme'); } catch (e) { return null; }
  }
  function themeSysteme() {
    return (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) ? 'light' : 'dark';
  }
  function themeActuel() {
    return document.documentElement.getAttribute('data-theme') || 'dark';
  }
  function majIcone() {
    var b = document.getElementById('btn-theme');
    if (b) b.innerHTML = (themeActuel() === 'light') ? LUNE : SOLEIL;
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
      b = document.createElement('button');
      b.id = 'btn-theme';
      b.className = 'bouton-theme';
      b.type = 'button';
      b.setAttribute('aria-label', 'Changer de thème');
      b.title = 'Thème';
      (document.querySelector('main') || document.body).prepend(b);
    }
    majIcone();
        b.onclick = function () { appliquer(themeActuel() === 'light' ? 'dark' : 'light', true); };

    // Pied de page commun (ajouté seulement s'il n'y en a pas déjà un dans la page)
    if (!document.querySelector('.pied')) {
      var f = document.createElement('footer');
      f.className = 'pied';
      f.innerHTML =
        '<a href="index.html">Bivouac88</a>' +
        ' · <img src="Aventure cycliste au coucher du soleil.png" alt="Lost but Free" style="height:20px;vertical-align:middle;">' +
        ' <a href="#">Lost but Free</a>' +
        ' · <a href="https://www.leetchi.com/fr/c/bivouac88-4670104" target="_blank" rel="noopener">Soutenir</a>' +
        '<br>Made with ♥ by Tito';
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
