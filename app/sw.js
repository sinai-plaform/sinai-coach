/* SINAI Coach — keeps the app itself on the tablet so it opens without signal.
   The data is handled inside the app (offline.js); this file only stores the app's own files
   (about 0.5 MB). Bump V when this file changes. */
const V = 'sc-app-v2';   // 2.0.0 — SINAI Coach blue brand, app lives at /app/
const SHARED = ['https://cdn.jsdelivr.net/', 'https://fonts.googleapis.com/', 'https://fonts.gstatic.com/'];

async function appFiles(html) {
  const out = ['./'];
  for (const m of html.matchAll(/<(?:script[^>]+src|link[^>]+href)="([^"]+)"/g)) {
    if (!/fonts\.googleapis\.com\/?$/.test(m[1]) && !m[1].startsWith('data:')) out.push(m[1]);
  }
  return [...new Set(out)];
}

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(V);
    const res = await fetch('./', { cache: 'no-cache' });
    const html = await res.clone().text();
    await c.put('./', res);
    for (const u of await appFiles(html)) {
      if (u === './') continue;
      try { const r = await fetch(u, { cache: 'no-cache' }); if (r.ok) await c.put(u, r); } catch (err) {}
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('sc-app-') && k !== V) await caches.delete(k);
    await self.clients.claim();
  })());
});

// after a new version of the page arrives, drop the files the old version used
async function tidy(html) {
  try {
    const keep = new Set((await appFiles(html)).map(u => new URL(u, self.registration.scope).href));
    keep.add(new URL('./', self.registration.scope).href);
    const c = await caches.open(V);
    for (const req of await c.keys()) {
      const u = new URL(req.url);
      if (u.origin === self.location.origin && !keep.has(req.url)) await c.delete(req);
    }
  } catch (err) {}
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  if (!own && !SHARED.some(p => req.url.startsWith(p))) return;      // the database is not handled here

  // the page: newest from the network, the saved one when there is no signal
  if (req.mode === 'navigate') {
    e.respondWith((async () => {
      const c = await caches.open(V);
      try {
        const ac = new AbortController(); const t = setTimeout(() => ac.abort(), 4000);
        const res = await fetch(req, { signal: ac.signal }); clearTimeout(t);
        if (res.ok) { const copy = res.clone(); c.put('./', copy.clone()); copy.text().then(tidy); }
        return res;
      } catch (err) {
        return (await c.match('./')) || Response.error();
      }
    })());
    return;
  }

  // scripts, fonts and the like: every version has its own address, so the saved copy is always right
  e.respondWith((async () => {
    const c = await caches.open(V);
    const hit = await c.match(req);
    if (hit) return hit;
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') c.put(req, res.clone());
    return res;
  })());
});
