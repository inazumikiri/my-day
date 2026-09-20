// мой день — офлайн-кэш
// если обновляешь index.html, поменяй версию ниже (v1 -> v2), чтобы телефон подтянул новую
const CACHE = 'myday-v3';
const ASSETS = ['./', './index.html', './manifest.json', './icon-180.png', './icon-192.png', './icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => c.add(u).catch(() => {}))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // api.github.com и прочее чужое не кэшируем — иначе синхронизация будет
  // получать вчерашние данные
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  const font = /(^|\.)(googleapis|gstatic)\.com$/.test(url.hostname);
  if (!own && !font) return;

  // страница: сначала сеть (чтобы подхватывались обновления), офлайн — из кэша
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(r => {
          const copy = r.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy));
          return r;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // всё остальное (шрифты, иконки): сначала кэш, параллельно обновляем
  e.respondWith(
    caches.match(req).then(cached => {
      const net = fetch(req)
        .then(r => {
          if (r && (r.ok || r.type === 'opaque')) {
            const copy = r.clone();
            caches.open(CACHE).then(c => c.put(req, copy));
          }
          return r;
        })
        .catch(() => cached);
      return cached || net;
    })
  );
});
