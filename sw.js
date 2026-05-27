const CACHE = 'diagnostika-v73';
const ASSETS = ['./', './index.html', './manifest.json', './assets/logo-dark.png', './assets/logo-vertical.png', './assets/icon.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Network-first para HTML (index.html navegação) — garante código sempre atualizado
  const isHTML = req.mode === 'navigate' ||
                 req.headers.get('accept')?.includes('text/html') ||
                 url.pathname.endsWith('/') ||
                 url.pathname.endsWith('.html');

  if (isHTML) {
    e.respondWith(
      fetch(req).then(resp => {
        // Salva cópia no cache para fallback offline
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(()=>{});
        return resp;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first para assets (CSS, JS, imagens, fontes)
  e.respondWith(
    caches.match(req).then(r => r || fetch(req).catch(() => caches.match('./index.html')))
  );
});
