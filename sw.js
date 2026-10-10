/* SINAI Club: the app moved to /app/. This old root worker cleans up after itself:
   it drops the old app cache, unregisters, and sends any open app window to /app/. */
self.addEventListener('install', function () { self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil((async function () {
    try { await caches.delete('sc-app-v1'); } catch (err) {}
    await self.registration.unregister();
    var list = await self.clients.matchAll({ type: 'window' });
    list.forEach(function (c) {
      try { var u = new URL(c.url); if (!u.pathname.startsWith('/app/')) c.navigate('/app/'); } catch (err) {}
    });
  })());
});
