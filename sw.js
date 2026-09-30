/* GVSI Comunidade — service worker (PWA).
   Estratégia: network-first pra conteúdo próprio (sempre fresco quando online),
   com cópia em cache só pra funcionar offline. Supabase/CDN passam direto. */
var CACHE = 'gvsi-shell-v1';

self.addEventListener('install', function () { self.skipWaiting(); });

self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    await self.clients.claim();
    var keys = await caches.keys();
    await Promise.all(keys.map(function (k) { return k === CACHE ? null : caches.delete(k); }));
  })());
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.origin !== self.location.origin) return; // Supabase, CDNs, fontes: passam direto
  e.respondWith((async function () {
    try {
      var res = await fetch(req);
      if (res && res.ok && res.type === 'basic') {
        try { var c = await caches.open(CACHE); c.put(req, res.clone()); } catch (_) {}
      }
      return res;
    } catch (err) {
      var cached = await caches.match(req);
      if (cached) return cached;
      if (req.mode === 'navigate') { var idx = await caches.match('/'); if (idx) return idx; }
      throw err;
    }
  })());
});
