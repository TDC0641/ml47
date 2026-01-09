/* ML47 Service Worker (cache + offline) */
const VERSION = 'ml47-v1';
const ROOT = new URL(self.registration.scope).pathname; // 例: "/ml47/"
const ASSETS = [
  ROOT,                    // index.html に解決
  ROOT + 'index.html',
  ROOT + 'manifest.json',
  ROOT + 'icons/icon-192.png',
  ROOT + 'icons/icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  const inScope = url.origin === location.origin && url.pathname.startsWith(ROOT);
  if (!inScope || req.method !== 'GET') return;

  // 既知アセットは cache-first
  if (ASSETS.some(p => url.pathname === p)) {
    e.respondWith(caches.match(req).then(r => r || fetch(req)));
    return;
  }

  // それ以外は SWR 風
  e.respondWith(
    caches.match(req).then(cached => {
      const fetchPromise = fetch(req).then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(req, copy));
        return res;
      }).catch(() => cached || caches.match(ROOT)); // オフライン時はTOPへ
      return cached || fetchPromise;
    })
  );
});
