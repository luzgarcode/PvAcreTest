const CACHE = "pv-terrain-shell-v7";
// Ordre important : le plus critique en premier. Si l'appli est fermée pendant
// l'installation (réseau lent sur le terrain), tout ce qui a déjà été mis en
// cache reste utilisable hors-ligne — contrairement à un simple c.addAll(SHELL),
// qui est tout-ou-rien : un seul fichier lent ou en échec fait annuler la mise
// en cache de TOUT, y compris index.html, d'où l'écran blanc en mode avion.
const SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/pdf-lib.min.js",
  "./vendor/zxing-browser.min.js",
  "./assets/mcdo-restaurants.json",
  "./assets/quick-restaurants.json"
];

// Page de secours 100% locale (pas de requête réseau) : sur iOS notamment, la toute
// première installation du SW ne contrôle pas encore l'onglet qui vient de l'enregistrer,
// donc tout le rechargement du cache (~2,3 Mo) doit finir avant que le technicien ne
// referme l'appli — sur un réseau terrain faible, ça peut ne jamais aboutir. Cette page
// est écrite en cache quasi instantanément (aucun fetch), donc même dans ce cas, une
// prochaine ouverture hors-ligne affiche un message clair au lieu d'un écran blanc.
const OFFLINE_URL = "./__offline.html";
const OFFLINE_HTML = `<!doctype html><html lang="fr"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>PV & Go — hors ligne</title>
<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#EDF0F2;font-family:-apple-system,system-ui,sans-serif;color:#17212B;padding:24px;box-sizing:border-box;text-align:center">
<div style="max-width:340px">
<h1 style="font-size:20px;margin:0 0 12px">Hors ligne, appli pas encore prête</h1>
<p style="color:#5b6b78;line-height:1.5;margin:0 0 20px">L'appli n'a pas fini de se préparer pour le mode hors-ligne (ça arrive sur un réseau faible). Reconnecte-toi une fois avec du réseau, laisse l'appli ouverte quelques secondes, puis réessaie.</p>
<button onclick="location.reload()" style="border:none;border-radius:10px;background:#17212B;color:#fff;padding:12px 20px;font-size:15px">Réessayer</button>
</div></body></html>`;

async function cacheOne(cache, url){
  try{
    const res = await fetch(url, {cache:"no-cache"});
    if (res.ok) await cache.put(url, res);
  }catch(e){ /* un fichier manquant/lent ne doit pas bloquer les autres */ }
}

// Recache tout ce qui manque encore dans SHELL, sans bloquer (pas de await côté appelant) :
// filet de sécurité qui complète le cache à chaque ouverture en ligne, pas seulement la
// toute première fois — utile si l'installation initiale a été interrompue.
async function fillGaps(){
  try{
    const c = await caches.open(CACHE);
    for (const url of SHELL) {
      if (!(await c.match(url))) await cacheOne(c, url);
    }
  }catch(e){}
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.put(OFFLINE_URL, new Response(OFFLINE_HTML, {headers:{"Content-Type":"text/html; charset=utf-8"}}));
    for (const url of SHELL) await cacheOne(c, url); // un par un, dans l'ordre de priorité
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
      .then(() => { fillGaps(); }) // fire-and-forget : ne retarde pas l'activation
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page navigation (opening/launching the app, incl. the installed PWA): network first,
  // so a relaunch always picks up the latest index.html when online. Falls back to the
  // cached shell only when offline, puis à une page de secours locale si même index.html
  // n'a pas encore été mis en cache (plutôt qu'un écran blanc). Checked BEFORE the shell
  // cache below, since index.html is also listed in SHELL and would otherwise be served
  // stale-first even on launch.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put("./index.html", res.clone()));
        return res;
      }).catch(() => caches.match("./index.html")).then(res => res || caches.match(OFFLINE_URL))
    );
    return;
  }

  // App shell (this origin, listed files, non-navigation requests): cache-first, refresh in background.
  if (url.origin === self.location.origin && SHELL.some(p => url.pathname.endsWith(p.replace("./", "/")))) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res.ok) caches.open(CACHE).then(c => c.put(req, res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // Everything else (models/*, fonts, etc.): let the app's own logic handle failures.
});
