# Assistant Bivouac88 — version 0.1

Assistant local en HTML / CSS / JavaScript natif. Aucun service externe, aucune API et aucun abonnement.

## Arborescence

```text
assistant-bivouac88/
├── assistant-bivouac88.html
├── README.md
├── css/
│   └── assistant.css
├── data/
│   └── knowledge.json
├── js/
│   ├── app.js
│   ├── engine.js
│   ├── intent.js
│   ├── knowledge.js
│   └── tour.js
└── tests/
    └── test-engine.html
```

## Installation dans le dépôt GitHub

1. À la racine du dépôt Bivouac88, crée le dossier `assistant-bivouac88`.
2. Place tous les fichiers de cette archive dans ce dossier en conservant les sous-dossiers.
3. Commit / push sur GitHub.
4. La page sera accessible à l'adresse :
   `https://bivouac88.github.io/assistant-bivouac88/assistant-bivouac88.html`

Le nom de page est volontairement différent de `index.html` pour éviter tout conflit avec l'accueil du site.

## Test local

Les modules JavaScript et le chargement JSON utilisent `fetch` : ouvre le projet avec un petit serveur local (par exemple l'extension Live Server de VS Code), pas en double-cliquant sur le fichier HTML.

## Modifier les réponses

Édite `data/knowledge.json` :
- `keywords` : mots et expressions qui peuvent déclencher l'intention ;
- `answers` : réponses possibles ;
- `related` : identifiants d'intentions associées ;
- `action` : action optionnelle (actuellement le lancement de la visite guidée).

Garde les identifiants `id` uniques.

## Limites assumées de la version 0.1

Ce n'est pas une IA générative. Le moteur compare les mots et expressions de la question à une liste de mots-clés et calcule un score simple. Il peut donc rater une formulation inhabituelle. Il répond par un message de prudence si le score est trop faible.

La base ne contient que des informations de démonstration déjà validées dans le contexte du projet. Il faudra compléter les réponses factuelles avant de mettre le bot à disposition des visiteurs.

## Visite guidée

Le module `js/tour.js` est indépendant. Les étapes utilisent des sélecteurs dédiés qui seront ajoutés au site au moment de l'intégration, par exemple :

```html
<section data-bivouac-tour="parcours">...</section>
```

Les sélecteurs prévus dans cette version sont `parcours`, `etapes` et `photos`. La page de test signale simplement que les cibles ne sont pas encore présentes. Le véritable affichage des bulles, surlignages et boutons suivant/précédent sera développé au moment de l'intégration au site réel.

## Tests

Après lancement via serveur local, ouvre :
`tests/test-engine.html`

Les tests couvrent la présentation, la carte, les étapes, les questions inconnues et la normalisation des accents.
