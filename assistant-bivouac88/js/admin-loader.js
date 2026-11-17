
// admin-loader.js — chargement du Bivouaciste réservé au mode admin

(async function () {
  try {
    // 1. Créer l'avatar
    await import('./character.js');

    // 2. Charger le dialogue
    await import('./dialogue.js');

    // 3. Charger le panneau de contrôle
    await import('./controller.js');

    // 4. Charger le lecteur de scènes
    await import('./scene-reader.js');

    // 5. Charger les scènes de la page
    const racine = window.B88?.racine || '';
    const url = racine + 'assistant-bivouac88/js/scenes-v2.json';

    window.b88LoadScenes(url);

    console.info('[Bivouaciste] Chargement admin terminé.');

  } catch (error) {
    console.error('[Bivouaciste] Erreur de chargement :', error);
  }
})();
