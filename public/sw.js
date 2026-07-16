const CACHE = "nostur-mobile-v1.4.2";
const APP_SCOPE = "/app/";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
})()));

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  event.respondWith((async () => {
    try {
      const response = await fetch(request);
      if (response.ok && new URL(request.url).origin === self.location.origin) {
        const cache = await caches.open(CACHE);
        cache.put(request, response.clone());
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      if (request.mode === "navigate") return caches.match(APP_SCOPE);
      throw new Error("offline");
    }
  })());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data ? event.data.text() : "Tenés una nueva notificación." };
  }

  const data = payload.data || {};
  const targetUrl = payload.url || data.url || APP_SCOPE;

  event.waitUntil(self.registration.showNotification(payload.title || "NOSTUR", {
    body: payload.body || "Tenés una nueva notificación.",
    icon: `${APP_SCOPE}android-chrome-192x192.png`,
    badge: `${APP_SCOPE}favicon-96x96.png`,
    data: { ...data, url: targetUrl },
    tag: payload.tag || "nostur-notification",
    renotify: true,
    requireInteraction: Boolean(payload.requireInteraction)
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || APP_SCOPE, self.location.origin).toString();

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientList) {
      if ("navigate" in client) await client.navigate(targetUrl);
      if ("focus" in client) return client.focus();
    }
    return clients.openWindow ? clients.openWindow(targetUrl) : undefined;
  })());
});
