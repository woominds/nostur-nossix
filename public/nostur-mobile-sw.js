self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const conversationId = data.conversationId || data.conversation_id || null;
  const messageId = data.messageId || data.message_id || null;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      const url = new URL("/", self.location.origin);

      if (conversationId) {
        url.searchParams.set("open_livenos", "1");
        url.searchParams.set("conversation_id", conversationId);
      }

      if (messageId) {
        url.searchParams.set("message_id", messageId);
      }

      for (const client of clientList) {
        if ("focus" in client) {
          client.postMessage({
            type: "NOSTUR_OPEN_LIVENOS",
            conversationId,
            messageId
          });

          return client.focus();
        }
      }

      if (clients.openWindow) {
        return clients.openWindow(url.toString());
      }

      return undefined;
    })
  );
});

self.addEventListener("push", (event) => {
  let payload = {};

  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {
      title: "NOSTUR",
      body: event.data ? event.data.text() : "Nueva notificación"
    };
  }

  const title = payload.title || "NOSTUR";
  const body = payload.body || "Nueva notificación";
  const data = payload.data || payload;

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/brand/icono-color.png",
      badge: "/brand/icono-color.png",
      data
    })
  );
});
