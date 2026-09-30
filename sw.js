/* Keeps a copy of the portal on the panel so it opens without internet.
   Bump VERSION whenever files change, so panels pick up the new copy. */
var VERSION = 'pilot-v1';
var FILES = [
  './', 'index.html', 'style.css', 'app.js', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png',
  'audio/a_name.m4a', 'audio/a_sound.m4a', 'audio/a_cue.m4a', 'audio/apple.m4a', 'audio/ant.m4a', 'audio/axe.m4a', 'audio/a_question.m4a',
  'audio/b_name.m4a', 'audio/b_sound.m4a', 'audio/b_cue.m4a', 'audio/ball.m4a', 'audio/banana.m4a', 'audio/bus.m4a', 'audio/b_question.m4a',
  'audio/well_done.m4a', 'audio/try_again.m4a', 'audio/line_prompt.m4a', 'audio/chart_prompt.m4a'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(VERSION).then(function (c) { return c.addAll(FILES); }));
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== VERSION; }).map(function (k) { return caches.delete(k); }));
  }));
  self.clients.claim();
});

// Try the internet first (so updates show up), fall back to the saved copy.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request).then(function (res) {
      if (res.ok && new URL(e.request.url).origin === location.origin) {
        var copy = res.clone();
        caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(e.request, { ignoreSearch: true });
    })
  );
});
