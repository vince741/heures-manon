const SCOPE = new URL(self.registration.scope);
const CACHE_PREFIX = `aideplanning:${SCOPE.href}:`;
const CACHE = `${CACHE_PREFIX}v13`;
const INDEX = new URL("index.html", SCOPE).href;
const ASSETS = [INDEX, ...["style.css?v=13", "data.js?v=13", "app.js?v=13", "manifest.json", "icon.svg"].map(path => new URL(path, SCOPE).href)];

self.addEventListener("install", event => {
  const requests = ASSETS.map(url => new Request(url, { cache: "reload" }));
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(requests)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE).map(key => caches.delete(key))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== SCOPE.origin) return;

  const appNavigation = event.request.mode === "navigate" &&
    (url.pathname === SCOPE.pathname || url.pathname === new URL(INDEX).pathname);
  const asset = appNavigation ? INDEX : url.href;
  if (!ASSETS.includes(asset)) return;

  event.respondWith(caches.open(CACHE).then(cache => cache.match(asset)).then(cached => cached || fetch(event.request)));
});
