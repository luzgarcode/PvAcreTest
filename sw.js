const CACHE = "pv-terrain-shell-v6";
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

async function cacheOne(cache, url){
  try{
    const res = await fetch(url, {cache:"no-cache"});
    if (res.ok) await cache.put(url, res);
  }catch(e){ /* un fichier manquant/lent ne doit pas bloquer les autres */ }
}

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const c = await caches.open(CACHE);
    for (const url of SHELL) await cacheOne(c, url); // un par un, dans l'ordre de priorité
    self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Page navigation (opening/launching the app, incl. the installed PWA): network first,
  // so a relaunch always picks up the latest index.html when online. Falls back to the
  // cached shell only when offline. Checked BEFORE the shell cache below, since index.html
  // is also listed in SHELL and would otherwise be served stale-first even on launch.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).then(res => {
        if (res.ok) caches.open(CACHE).then(c => c.put("./index.html", res.clone()));
        return res;
      }).catch(() => caches.match("./index.html"))
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
