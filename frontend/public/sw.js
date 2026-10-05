/*
 * Service worker de ChefChek. Alcance deliberadamente pequeño: solo hace que
 * la pantalla de fichaje (/fichar) abra sin conexión.
 *
 *  - Navegación a /fichar: red primero; si no hay red, la última copia.
 *  - Ficheros estáticos con huella en el nombre (/_next/static, fuentes,
 *    iconos): caché primero. Son inmutables, así que no pueden quedar viejos.
 *  - Todo lo demás (API incluida) pasa de largo: aquí nunca se guardan datos.
 *
 * Los fichajes pendientes NO viven aquí, sino en localStorage (ver
 * src/lib/check-in-offline.ts): la página los envía al recuperar la red.
 */
const VERSION = "v1";
const PAGE_CACHE = `chefchek-pages-${VERSION}`;
const STATIC_CACHE = `chefchek-static-${VERSION}`;
const OFFLINE_PAGES = ["/fichar"];
const STATIC_PREFIXES = ["/_next/static/", "/fonts/", "/icons/"];

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(
            (key) =>
              key.startsWith("chefchek-") &&
              key !== PAGE_CACHE &&
              key !== STATIC_CACHE,
          )
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

async function networkFirstPage(request, cacheKey) {
  const cache = await caches.open(PAGE_CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    throw error;
  }
}

async function cacheFirstStatic(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate" && OFFLINE_PAGES.includes(url.pathname)) {
    // Clave sin parámetros: /fichar?x=1 y /fichar comparten copia.
    event.respondWith(networkFirstPage(request, url.pathname));
    return;
  }
  if (STATIC_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    event.respondWith(cacheFirstStatic(request));
  }
});
