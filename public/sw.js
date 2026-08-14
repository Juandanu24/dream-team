// Service worker del Dream Team.
// Estáticos: cache-first. Navegación: red primero con fallback a caché.
// Además recibe las notificaciones push del torneo.
const CACHE = "dream-team-v2";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== location.origin) return;

  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    /\.(png|ico|svg|webp|woff2?)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        if (cached) return cached;
        const response = await fetch(request);
        if (response.ok) cache.put(request, response.clone());
        return response;
      }),
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match("/");
        }),
    );
  }
});

// ---------- Notificaciones ----------

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Dream Team", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Dream Team";
  const options = {
    body: payload.body || "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    tag: payload.tag || "dream-team",
    // Con renotify + tag, un aviso nuevo reemplaza al anterior del
    // mismo tipo en vez de apilarse.
    renotify: Boolean(payload.tag),
    data: { url: payload.url || "/torneo" },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    event.notification.data?.url || "/torneo",
    self.location.origin,
  ).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Si la app ya está abierta, la enfocamos en vez de abrir otra.
        for (const client of clientList) {
          if (client.url === target && "focus" in client) return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});
