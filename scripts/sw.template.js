const CACHE_NAME = "gym-tracker-__BUILD_VERSION__";
const APP_SHELL = [
  "/",
  "/history",
  "/plans",
  "/statistics",
  "/settings",
  "/workout",
  "/manifest.webmanifest",
  "/favicon.ico",
  "/icon",
  "/apple-icon",
];

const SHELL_PAGES = APP_SHELL.filter((url) => !url.includes("."));

async function getCurrentBuildAssets() {
  const responses = await Promise.all(
    SHELL_PAGES.map((url) => fetch(url, { cache: "no-store" }))
  );
  const htmlDocuments = await Promise.all(
    responses.filter((response) => response.ok).map((response) => response.text())
  );
  const assets = new Set();

  for (const html of htmlDocuments) {
    for (const match of html.matchAll(/(?:src|href)=["']([^"']+)["']/g)) {
      const assetUrl = new URL(match[1], self.location.origin);
      if (assetUrl.origin === self.location.origin && assetUrl.pathname.startsWith("/_next/static/")) {
        assets.add(`${assetUrl.pathname}${assetUrl.search}`);
      }
    }
  }

  return [...assets];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const buildAssets = await getCurrentBuildAssets();
      await cache.addAll([...new Set([...APP_SHELL, ...buildAssets])]);
    })()
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          if (response.ok) {
            const cache = await caches.open(CACHE_NAME);
            await cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => (await caches.match(request)) || (await caches.match("/")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(async (cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, response.clone());
      }
      return response;
    })
  );
});
