
// admin-loader.js — chargement conditionnel du Bivouaciste

(async function () {
  try {
    const isAdmin =
      new URLSearchParams(window.location.search).get('edit') === 'bivouac88admin';

    const racine = window.B88?.racine || '';
    const url = racine + 'assistant-bivouac88/js/scenes-v2.json';

    // 1. Charger les scènes
    const response = await fetch(url);
    if (!response.ok) throw new Error('Impossible de charger le JSON des scènes.');

    const data = await response.json();

    if (!data || data.version !== 2 || !Array.isArray(data.scenes)) {
      throw new Error('JSON des scènes invalide.');
    }

    // 2. Vérifier si une scène concerne cette page et cet appareil
    const page = document.body.dataset.page || '';
    const width = window.innerWidth;
    const device = width < 768 ? 'mobile' : 'pc';

    const matchingScenes = data.scenes.filter(scene =>
      scene.enabled &&
      scene.pages.includes(page) &&
      scene.devices.includes(device)
    );

// Hitbox initiale : définie avant le chargement du personnage.
const initialScene = [...matchingScenes]
  .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
  .find(scene => scene.trigger?.type === 'load')
  || matchingScenes[0];

window.B88_INITIAL_HITBOX =
  initialScene?.steps?.[0]?.hitbox
  || initialScene?.hitbox
  || data.avatar?.hitbox
  || { width: 140, height: 145, offsetX: 0, offsetY: 0 };
    
    // Visiteur : aucun personnage si aucune scène n'est prévue ici.
    if (!isAdmin && matchingScenes.length === 0) return;

    // 3. Charger les styles nécessaires
    const cssDialogue = document.createElement('link');
    cssDialogue.rel = 'stylesheet';
    cssDialogue.href = racine + 'assistant-bivouac88/css/dialogue.css';
    document.head.appendChild(cssDialogue);

    const cssCharacter = document.createElement('link');
    cssCharacter.rel = 'stylesheet';
    cssCharacter.href = racine + 'assistant-bivouac88/css/character.css';
    document.head.appendChild(cssCharacter);

    // 4. Charger le personnage, les dialogues et le lecteur de scènes
    await import('./character.js');
    await import('./dialogue.js');
    await import('./scene-reader.js');

    // 5. Charger le panneau uniquement en mode admin
    if (isAdmin) {
      // Transmettre toutes les scènes au contrôleur
      window.B88_SCENES_DATA = data;

      await import('./controller.js');
    }

    // 6. Initialiser les scènes
    window.b88InitScenes(data);

    console.info(
      `[Bivouaciste] ${matchingScenes.length} scène(s) disponible(s) pour "${page}" / "${device}".`
    );

  } catch (error) {
    console.error('[Bivouaciste] Erreur de chargement :', error);
  }
})();
