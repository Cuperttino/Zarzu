// Service worker: app disponible sin conexión, datos de la red con copia de respaldo y notificaciones.
const V = '__VERSION__', SHELL = __SHELL__, CORE = `zarzu-${V}`, BIBLE = 'zarzu-bible', DATA = 'zarzu-data';
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CORE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((k) => Promise.all(k.filter((n) => n.startsWith('zarzu-') && ![CORE, BIBLE, DATA].includes(n)).map((n) => caches.delete(n)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (u.pathname.startsWith('/bible/')) { e.respondWith(caches.open(BIBLE).then(async (c) => (await c.match(e.request)) || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))); return; }
  if (u.pathname.startsWith('/api/')) {
    if (!/^\/api\/(liturgy|news)/.test(u.pathname)) return;
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) { const k = r.clone(); caches.open(DATA).then((c) => c.put(e.request, k)); } return r; }).catch(() => caches.match(e.request).then((r) => r || Response.error())));
    return;
  }
  if (e.request.mode === 'navigate') { e.respondWith(fetch(e.request).catch(() => caches.match('/'))); return; }
  e.respondWith(caches.match(e.request).then((r) => r || fetch(e.request)));
});
self.addEventListener('push', (e) => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch {}
  e.waitUntil(self.registration.showNotification(d.title || 'Zarzu', { body: d.body || '', icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', tag: d.url || 'zarzu', data: { url: d.url || '/' } }));
});
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(self.clients.matchAll({ type: 'window' }).then((l) => { for (const c of l) if ('focus' in c) { c.navigate(e.notification.data.url); return c.focus(); } return self.clients.openWindow(e.notification.data.url); }));
});
