# McDo restaurant scrape — progress

But : enrichir `assets/mcdo-restaurants.json` avec téléphone + adresse
pour tous les restaurants McDo (actuellement seulement le nom est
embarqué dans l'app, pour tous les 1477).

Source : pages `https://www.mcdonalds.fr/restaurants/mcdonalds-x/<numero>`
(le slug n'a pas d'importance, seul le numéro compte). Les données sont
dans `window.__NUXT__.data[0].restaurantData` (name, phone,
restaurantAddress[0].{address1,zipCode,city}) — accessible en JS depuis
une page réellement chargée dans un navigateur (le HTML brut ne suffit
pas, c'est un payload Nuxt minifié).

Le site bloque (HTTP 403) après quelques dizaines/centaines de requêtes
rapprochées, même en espaçant les appels. Le blocage semble se lever
après un certain temps (pas mesuré précisément) — d'où l'idée d'y aller
tranquillement, par petits lots espacés dans le temps (ex: ~300/jour).

## progress.json

- `done`: dict `{"<numero>": {name, phone, address, zip, city}}` — déjà récupérés.
- `remaining`: liste des numéros encore à récupérer.

## Pour continuer

1. Ouvrir une page `mcdonalds.fr/restaurants/mcdonalds-x/<id>` par iframe caché,
   lire `window.__NUXT__.data[0].restaurantData` au `onload`, avec un espacement
   raisonnable entre requêtes (quelques centaines de ms) et une concurrence
   limitée (4-6 en parallèle max).
2. Dès qu'un fetch de contrôle renvoie 403, arrêter immédiatement (ne pas
   insister, ça aggrave/allonge le blocage).
3. Fusionner les nouveaux résultats dans `done`, retirer de `remaining`,
   re-sauvegarder `progress.json`.
4. Une fois qu'on a une masse suffisante (ou tout), régénérer
   `assets/mcdo-restaurants.json` avec le schéma objet
   `{"<num>": {"name":.., "phone":.., "address":.., "zip":.., "city":..}}`
   (garder juste `{"name":..}` pour les restaurants sans détail).
