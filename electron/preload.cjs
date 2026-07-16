// electron/preload.cjs

const { contextBridge, ipcRenderer } = require("electron");

/* =========================================================
   NOSTUR PRELOAD
   Puente seguro entre MAIN y RENDERER
========================================================= */

function safeInvoke(channel, payload) {
  return ipcRenderer.invoke(channel, payload);
}

function createSafeListener(channel, callback) {
  if (typeof callback !== "function") {
    return () => {};
  }

  const handler = (_event, payload) => {
    try {
      callback(payload);
    } catch (error) {
      console.error(
        `[NOSTUR PRELOAD] Error en listener ${channel}:`,
        error
      );
    }
  };

  ipcRenderer.on(channel, handler);

  return () => {
    ipcRenderer.removeListener(channel, handler);
  };
}

function normalizeNewTabPayload(payload) {
  if (!payload) return null;

  if (typeof payload === "string") {
    return {
      url: payload,
      title: "Web",
      appId: "web"
    };
  }

  const url = String(payload.url || "").trim();

  if (!url) return null;

  return {
    url,
    title: String(payload.title || "Web"),
    appId: String(payload.appId || "web")
  };
}

function normalizeNotificationPayload(payload) {
  const raw = payload || {};

  return {
    title: String(raw.title || "Nuevo mensaje"),
    subtitle: String(raw.subtitle || "NOSTUR"),
    body: String(raw.body || raw.message || "Nuevo mensaje"),
    conversationId: raw.conversationId
      ? String(raw.conversationId)
      : "",
    messageId: raw.messageId
      ? String(raw.messageId)
      : "",
    badgeCount: raw.badgeCount
  };
}

contextBridge.exposeInMainWorld("nostur", {
  /* =========================================================
     SISTEMA / CACHE / ZOOM
  ========================================================= */

  ping: () =>
    safeInvoke("nostur:ping"),

  clearCache: (partitionName) =>
    safeInvoke("nostur:clear-cache", partitionName),

  clearAllCache: () =>
    safeInvoke("nostur:clear-cache", null),

  setMainZoom: (zoomFactor) =>
    safeInvoke("nostur:set-main-zoom", zoomFactor),

  openExternal: (url) =>
    safeInvoke("nostur:open-external", url),

  /* =========================================================
     AUTOUPDATE
  ========================================================= */

  checkForUpdates: () =>
    safeInvoke("nostur:check-for-updates"),

  downloadUpdate: () =>
    safeInvoke("nostur:download-update"),

  installUpdate: () =>
    safeInvoke("nostur:install-update"),

  getUpdateStatus: () =>
    safeInvoke("nostur:get-update-status"),

  onUpdateEvent: (callback) =>
    createSafeListener("nostur:update-event", callback),

  /* =========================================================
     ARCHIVOS DESCARGADOS
  ========================================================= */

  openDownloadedFile: (filePath) =>
    safeInvoke("nostur:open-downloaded-file", filePath),

  showDownloadedFile: (filePath) =>
    safeInvoke("nostur:show-downloaded-file", filePath),

  /* =========================================================
     NOTIFICACIONES
  ========================================================= */

  notify: (payload) =>
    safeInvoke(
      "nostur:notify",
      normalizeNotificationPayload(payload)
    ),

  notifyNewMessage: (payload) =>
    safeInvoke(
      "nostur:notify-new-message",
      normalizeNotificationPayload(payload)
    ),

  playNotificationSound: (payload) =>
    safeInvoke(
      "nostur:play-notification-sound",
      payload || { kind: "gestion" }
    ),

  setDockBadge: (count) =>
    safeInvoke("nostur:set-dock-badge", count),

  clearDockBadge: () =>
    safeInvoke("nostur:clear-dock-badge"),

  onInternalNotification: (callback) =>
    createSafeListener(
      "nostur:internal-notification",
      callback
    ),

  /* =========================================================
     NUEVA PESTAÑA DESDE MAIN
  ========================================================= */

  onNewTabFromMain: (callback) => {
    if (typeof callback !== "function") {
      return () => {};
    }

    const handler = (_event, payload) => {
      try {
        const normalized = normalizeNewTabPayload(payload);

        if (!normalized) {
          console.warn(
            "[NOSTUR PRELOAD] new-tab ignorado: payload inválido",
            payload
          );

          return;
        }

        callback(normalized);
      } catch (error) {
        console.error(
          "[NOSTUR PRELOAD] Error procesando nostur:new-tab-from-main:",
          error
        );
      }
    };

    ipcRenderer.on(
      "nostur:new-tab-from-main",
      handler
    );

    return () => {
      ipcRenderer.removeListener(
        "nostur:new-tab-from-main",
        handler
      );
    };
  },

  /* =========================================================
     ABRIR CONVERSACIÓN DESDE NOTIFICACIÓN
  ========================================================= */

  onOpenConversationFromNotification: (callback) =>
    createSafeListener(
      "nostur:open-conversation-from-notification",
      callback
    ),

  /* =========================================================
     RESET DE CONTRASEÑA
  ========================================================= */

  onPasswordResetLink: (callback) =>
    createSafeListener(
      "nostur:password-reset-link",
      callback
    ),

  /* =========================================================
     DESCARGAS
  ========================================================= */

  onDownloadStarted: (callback) =>
    createSafeListener(
      "nostur:download-started",
      callback
    ),

  onDownloadUpdated: (callback) =>
    createSafeListener(
      "nostur:download-updated",
      callback
    ),

  onDownloadDone: (callback) =>
    createSafeListener(
      "nostur:download-done",
      callback
    )
});