// admin-loader.js — Bivouaciste avec authentification Cloudflare
const B88_AUTH_URL = 'https://bivouac88-auth.antonista04.workers.dev';
const B88_TOKEN_KEY = 'b88_admin_session';
const B88_LOGIN_KEY = 'b88_login_started';
function showAdminError(message) {
  const box = document.createElement('div');
  box.style.cssText = [
    'position:fixed',
    'z-index:999999',
    'top:15px',
    'left:15px',
    'right:15px',
    'padding:18px',
    'background:#54201c',
    'color:white',
    'font:14px sans-serif',
    'border-radius:8px',
    'text-align:center'
  ].join(';');
  const text = document.createElement('p');
  text.textContent = message;
  const button = document.createElement('button');
  button.textContent = 'Recommencer la connexion GitHub';
  button.style.cssText = 'padding:10px 16px;margin-top:10px;cursor:pointer;';
  button.addEventListener('click', () => {
    sessionStorage.removeItem(B88_TOKEN_KEY);
    sessionStorage.removeItem(B88_LOGIN_KEY);
    const returnUrl = new URL(window.location.href);
    returnUrl.hash = '';
    window.location.href =
      B88_AUTH_URL + '/login?return=' +
      encodeURIComponent(returnUrl.toString());
  });

  box.append(text, button);
  document.body.appendChild(box);
}

async function authenticateAdmin() {
  const hashParams = new URLSearchParams(window.location.hash.slice(1));
  const callbackToken = hashParams.get('b88_admin_token');

  // Jeton reçu après le retour de GitHub.
  if (callbackToken) {
    sessionStorage.setItem(B88_TOKEN_KEY, callbackToken);
    sessionStorage.removeItem(B88_LOGIN_KEY);
    window.history.replaceState(
      null,
      '',
      window.location.pathname + window.location.search
    );
  }
  const token = sessionStorage.getItem(B88_TOKEN_KEY);

  // Aucun jeton : une seule tentative de connexion.
  if (!token) {
    if (sessionStorage.getItem(B88_LOGIN_KEY) === '1') {
      showAdminError(
        'Le retour de connexion GitHub ne contient pas de session valide.'
      );
      return false;
    }
    sessionStorage.setItem(B88_LOGIN_KEY, '1');
    const returnUrl = new URL(window.location.href);
    returnUrl.hash = '';
    window.location.replace(
      B88_AUTH_URL + '/login?return=' +
      encodeURIComponent(returnUrl.toString())
    );
    return false;
  }

  // Vérification auprès de Cloudflare.
  let response;
  try {
    response = await fetch(B88_AUTH_URL + '/verify', {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + token
      },
      cache: 'no-store'
    });
  } catch (error) {
    showAdminError(
      'Impossible de joindre le service Cloudflare. Le panneau reste verrouillé.'
    );
    return false;
  }

if (!response.ok) {
    const errorDetails = await response.text();
    console.error('[Bivouaciste] Refus du Worker :', {
      status: response.status,
      details: errorDetails
    });

    sessionStorage.removeItem(B88_TOKEN_KEY);
    sessionStorage.removeItem(B88_LOGIN_KEY);
    showAdminError(
      'Cloudflare a refusé la session (' + response.status + '). Consulte la console.'
    );
    return false;
  }
  let result;
  try {
    result = await response.json();
  } catch {
    showAdminError('Réponse invalide du service Cloudflare.');
    return false;
  }
  if (
    result.ok !== true ||
    result.user?.id !== '341067011' ||
    result.user?.login !== 'bivouac88'
  ) {
    sessionStorage.removeItem(B88_TOKEN_KEY);
    sessionStorage.removeItem(B88_LOGIN_KEY);
    showAdminError('Le compte authentifié ne correspond pas au compte administrateur.');
    return false;
  }
  sessionStorage.removeItem(B88_LOGIN_KEY);
  console.info('[Bivouaciste] Administrateur authentifié.');
  return true;
}
(async function () {
  try {
    const isAdmin =
      new URLSearchParams(window.location.search).get('edit') === 'bivouac88admin';

    // Authentification AVANT tout chargement du panneau.
    if (isAdmin) {
      const authorized = await authenticateAdmin();
      if (!authorized) return;
    }
    const racine = window.B88?.racine || '';
    const url = racine + 'assistant-bivouac88/js/scenes-v2.json';

    // Charger les scènes.
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Impossible de charger le JSON des scènes.');
    }
    const data = await response.json();
    if (!data || data.version !== 2 || !Array.isArray(data.scenes)) {
      throw new Error('JSON des scènes invalide.');
    }
    // Déterminer les scènes adaptées à la page et à l'appareil.
    const page = document.body.dataset.page || '';
    const device = window.innerWidth < 768 ? 'mobile' : 'pc';
    const matchingScenes = data.scenes.filter(scene =>
      scene.enabled &&
      scene.pages.includes(page) &&
      scene.devices.includes(device)
    );

    // Hitbox initiale.
    const initialScene = [...matchingScenes]
      .sort((a, b) => (Number(b.priority) || 0) - (Number(a.priority) || 0))
      .find(scene => scene.trigger?.type === 'load')
      || matchingScenes[0];
    window.B88_INITIAL_HITBOX =
      initialScene?.steps?.[0]?.hitbox
      || initialScene?.hitbox
      || data.avatar?.hitbox
      || { width: 140, height: 145, offsetX: 0, offsetY: 0 };

    // Visiteur sans scène : rien à charger.
    if (!isAdmin && matchingScenes.length === 0) return;

    // Charger les styles.
    const cssDialogue = document.createElement('link');
    cssDialogue.rel = 'stylesheet';
    cssDialogue.href = racine + 'assistant-bivouac88/css/dialogue.css';
    document.head.appendChild(cssDialogue);

    const cssCharacter = document.createElement('link');
    cssCharacter.rel = 'stylesheet';
    cssCharacter.href = racine + 'assistant-bivouac88/css/character.css';
    document.head.appendChild(cssCharacter);

    // Charger les modules du Bivouaciste.
    await import('./character.js');
    await import('./dialogue.js');
    await import('./scene-reader.js');

    // Le contrôleur n'est chargé qu'après validation Cloudflare.
    if (isAdmin) {
      window.B88_SCENES_DATA = data;
      await import('./controller.js');
    }

    window.b88InitScenes(data);

    console.info(
      `[Bivouaciste] ${matchingScenes.length} scène(s) disponible(s) pour "${page}" / "${device}".`
    );

  } catch (error) {
    console.error('[Bivouaciste] Erreur de chargement :', error);

    const isAdmin =
      new URLSearchParams(window.location.search).get('edit') === 'bivouac88admin';

    if (isAdmin) {
      showAdminError('Erreur de chargement : ' + error.message);
    }
  }
})();
