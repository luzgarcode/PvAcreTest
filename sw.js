const CACHE = "pv-terrain-shell-v4";
const SHELL = [
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./vendor/pdf-lib.min.js",
  "./vendor/zxing-browser.min.js",
  "./assets/mcdo-restaurants.json"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
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
