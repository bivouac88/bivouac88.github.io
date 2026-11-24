
// admin-loader.js — chargement conditionnel et sécurisé du Bivouaciste

const B88_AUTH_URL = 'https://bivouac88-auth.antonista04.workers.dev';
const B88_TOKEN_KEY = 'b88_admin_session';

(async function () {
  try {
    const isAdmin =
      new URLSearchParams(window.location.search).get('edit') === 'bivouac88admin';

    // 1. Authentification obligatoire avant tout chargement du panneau.
    if (isAdmin) {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const callbackToken = hashParams.get('b88_admin_token');

      // Récupérer le jeton temporaire transmis par Cloudflare.
      if (callbackToken) {
        sessionStorage.setItem(B88_TOKEN_KEY, callbackToken);

        // Retirer le jeton de l'adresse visible.
        window.history.replaceState(
          null,
          '',
          window.location.pathname + window.location.search
        );
      }

      let token = sessionStorage.getItem(B88_TOKEN_KEY);

      // Aucun jeton : démarrer la connexion GitHub.
      if (!token) {
        const returnUrl = new URL(window.location.href);
        returnUrl.hash = '';

        window.location.replace(
          B88_AUTH_URL + '/login?return=' +
          encodeURIComponent(returnUrl.toString())
        );
        return;
      }

      // Vérifier le jeton auprès du Worker.
      let authResponse;

      try {
        authResponse = await fetch(B88_AUTH_URL + '/verify', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer ' + token
          },
          cache: 'no-store'
        });
      } catch (error) {
        throw new Error(
          'Impossible de contacter le service d’authentification Cloudflare.'
        );
      }

      // Jeton refusé ou expiré : nouvelle connexion.
      if (authResponse.status === 401) {
        sessionStorage.removeItem(B88_TOKEN_KEY);

        const returnUrl = new URL(window.location.href);
        returnUrl.hash = '';

        window.location.replace(
          B88_AUTH_URL + '/login?return=' +
          encodeURIComponent(returnUrl.toString())
        );
        return;
      }

      if (!authResponse.ok) {
        throw new Error('La vérification de ton identité a échoué.');
      }

      const authData = await authResponse.json();

      if (
        authData.ok !== true ||
        authData.user?.id !== '341067011' ||
        authData.user?.login !== 'bivouac88'
      ) {
        sessionStorage.removeItem(B88_TOKEN_KEY);
        throw new Error('Compte GitHub non autorisé.');
      }

      console.info('[Bivouaciste] Administrateur authentifié.');
    }

    const racine = window.B88?.racine || '';
    const url = racine + 'assistant-bivouac88/js/scenes-v2.json';

    // 2. Charger les scènes.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Impossible de charger le JSON des scènes.');
    }

    const data = await response.json();

    if (!data || data.version !== 2 || !Array.isArray(data.scenes)) {
      throw new Error('JSON des scènes invalide.');
    }

    // 3. Vérifier si une scène concerne cette page et cet appareil.
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

    // 4. Charger les styles nécessaires.
    const cssDialogue = document.createElement('link');
    cssDialogue.rel = 'stylesheet';
    cssDialogue.href = racine + 'assistant-bivouac88/css/dialogue.css';
    document.head.appendChild(cssDialogue);

    const cssCharacter = document.createElement('link');
    cssCharacter.rel = 'stylesheet';
    cssCharacter.href = racine + 'assistant-bivouac88/css/character.css';
    document.head.appendChild(cssCharacter);

    // 5. Charger le personnage, les dialogues et le lecteur de scènes.
    await import('./character.js');
    await import('./dialogue.js');
    await import('./scene-reader.js');

    // 6. Charger le panneau uniquement après authentification.
    if (isAdmin) {
      window.B88_SCENES_DATA = data;
      await import('./controller.js');
    }

    // 7. Initialiser les scènes.
    window.b88InitScenes(data);

    console.info(
      `[Bivouaciste] ${matchingScenes.length} scène(s) disponible(s) pour "${page}" / "${device}".`
    );

  } catch (error) {
    console.error('[Bivouaciste] Erreur de chargement :', error);

    // En cas d'erreur d'authentification, le panneau reste fermé.
    if (
      new URLSearchParams(window.location.search).get('edit') === 'bivouac88admin'
    ) {
      document.documentElement.dataset.b88AdminAuth = 'failed';
      document.body.insertAdjacentHTML(
        'afterbegin',
        '<div style="position:fixed;z-index:999999;top:10px;left:10px;right:10px;padding:14px;background:#5a211c;color:white;text-align:center;font:14px sans-serif;">' +
        'Authentification administrateur impossible. Le panneau reste verrouillé. Recharge la page pour réessayer.' +
        '</div>'
      );
    }
  }
})();
