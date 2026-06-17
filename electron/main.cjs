// electron/main.cjs

const {
  app,
  BrowserWindow,
  session,
  shell,
  ipcMain,
  screen,
  Notification,
  Menu,
  clipboard
} = require("electron");

const path = require("path");
const fs = require("fs");
const { execFile } = require("child_process");
const tenantConfig = require("./tenantConfig.cjs");

let mainWindow = null;
const activeNotifications = new Set();
let dockNotificationCount = 0;

app.setName("NOSTUR");

if (process.platform === "darwin" || process.platform === "win32") {
  app.setAppUserModelId("com.nossix.nostur");
}

const isDev = !app.isPackaged;

/*
  Provisorio:
  En macOS desactivamos autoupdate y notificaciones de actualización
  hasta tener firma Apple Developer ID + notarización.
  Esto NO afecta las notificaciones normales de mensajes LiveNos / CANDE.
*/
const DISABLE_MAC_AUTOUPDATE = true;

const CHROME_USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

/* =========================================================
   HELPERS GENERALES
========================================================= */

function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      if (candidate && fs.existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // Ignorar.
    }
  }

  return candidates[0];
}

function getAppIconPath() {
  if (process.platform === "darwin") {
    return firstExistingPath([
      path.join(__dirname, "../build/icon.icns"),
      path.join(__dirname, "../build/icons/icon.icns"),
      path.join(process.resourcesPath || "", "build/icon.icns"),
      path.join(process.resourcesPath || "", "build/icons/icon.icns")
    ]);
  }

  if (process.platform === "win32") {
    return firstExistingPath([
      path.join(__dirname, "../build/icon.ico"),
      path.join(__dirname, "../build/icons/icon.ico"),
      path.join(process.resourcesPath || "", "build/icon.ico"),
      path.join(process.resourcesPath || "", "build/icons/icon.ico")
    ]);
  }

  return firstExistingPath([
    path.join(__dirname, "../build/icon.png"),
    path.join(__dirname, "../build/icons/icon.png"),
    path.join(process.resourcesPath || "", "build/icon.png"),
    path.join(process.resourcesPath || "", "build/icons/icon.png")
  ]);
}

function getNotificationIconPath() {
  return firstExistingPath([
    path.join(__dirname, "../build/icon.png"),
    path.join(__dirname, "../build/icons/icon.png"),
    path.join(process.resourcesPath || "", "build/icon.png"),
    path.join(process.resourcesPath || "", "build/icons/icon.png"),
    path.join(__dirname, "../dist/brand/nostur-icono-color.png"),
    path.join(__dirname, "../dist/brand/NOSSTOUR_iso_transparente.png"),
    getAppIconPath()
  ]);
}

function log(...args) {
  console.log("[NOSTUR MAIN]", ...args);
}

function warn(...args) {
  console.warn("[NOSTUR MAIN WARNING]", ...args);
}

function errorLog(...args) {
  console.error("[NOSTUR MAIN ERROR]", ...args);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateDockBadge(count) {
  dockNotificationCount = Math.max(0, Number(count) || 0);

  if (process.platform === "darwin" && app.dock) {
    app.dock.setBadge(dockNotificationCount > 0 ? String(dockNotificationCount) : "");
  }
}

function incrementDockBadge() {
  updateDockBadge(dockNotificationCount + 1);
}

function clearDockBadge() {
  updateDockBadge(0);
}

function bounceDock() {
  if (process.platform === "darwin" && app.dock) {
    try {
      app.dock.bounce("informational");
    } catch {
      // Ignorar.
    }
  }
}

function isMainWindowFocused() {
  return Boolean(
    mainWindow &&
      !mainWindow.isDestroyed() &&
      mainWindow.isVisible() &&
      mainWindow.isFocused() &&
      !mainWindow.isMinimized()
  );
}

function escapeAppleScriptText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, " ")
    .trim();
}

function showMacOsFallbackNotification(payload) {
  if (process.platform !== "darwin") return false;

  const title = escapeAppleScriptText(payload?.title || "NOSTUR");
  const subtitle = escapeAppleScriptText(payload?.subtitle || "Sistema");
  const body = escapeAppleScriptText(payload?.body || "Nuevo mensaje");

  const script = `display notification "${body}" with title "${title}" subtitle "${subtitle}" sound name "Glass"`;

  execFile("osascript", ["-e", script], (err) => {
    if (err) {
      errorLog("Falló fallback macOS notification:", err);
      return;
    }

    log("Fallback macOS notification ejecutado.");
  });

  return true;
}

function sendInternalNotification(payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return false;

  mainWindow.webContents.send("nostur:internal-notification", payload);
  return true;
}

function getHostname(url) {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isHttpUrl(url) {
  return String(url || "").startsWith("http://") || String(url || "").startsWith("https://");
}

function isInternalAppUrl(url) {
  return (
    !url ||
    url === "about:blank" ||
    url.startsWith("http://127.0.0.1:5173") ||
    url.startsWith("http://localhost:5173") ||
    url.startsWith("file://") ||
    url.startsWith("nostur://") ||
    url.startsWith("internal://")
  );
}

/* =========================================================
   DETECCIÓN DE DOMINIOS
========================================================= */

function isChatGptUrl(url) {
  const hostname = getHostname(url);

  return (
    hostname === "chatgpt.com" ||
    hostname.endsWith(".chatgpt.com") ||
    hostname === "auth.openai.com" ||
    hostname.endsWith(".auth.openai.com") ||
    hostname === "openai.com" ||
    hostname.endsWith(".openai.com")
  );
}

function isGoogleUrl(url) {
  const hostname = getHostname(url);

  return (
    hostname === "google.com" ||
    hostname.endsWith(".google.com") ||
    hostname === "accounts.google.com" ||
    hostname.endsWith(".accounts.google.com") ||
    hostname === "gmail.com" ||
    hostname.endsWith(".gmail.com") ||
    hostname === "mail.google.com"
  );
}

function isGoogleAuthUrl(url) {
  const hostname = getHostname(url);
  const cleanUrl = String(url || "").toLowerCase();

  return (
    hostname === "accounts.google.com" ||
    hostname.endsWith(".accounts.google.com") ||
    cleanUrl.includes("accounts.google.com/") ||
    cleanUrl.includes("/signin/") ||
    cleanUrl.includes("/oauth") ||
    cleanUrl.includes("/o/oauth2/") ||
    cleanUrl.includes("oauth2")
  );
}

function isMicrosoftAuthUrl(url) {
  const hostname = getHostname(url);
  const cleanUrl = String(url || "").toLowerCase();

  return (
    hostname === "login.microsoftonline.com" ||
    hostname.endsWith(".login.microsoftonline.com") ||
    hostname === "login.live.com" ||
    hostname === "account.live.com" ||
    hostname === "login.microsoft.com" ||
    cleanUrl.includes("login.microsoftonline.com/") ||
    cleanUrl.includes("/oauth2/") ||
    cleanUrl.includes("/common/login") ||
    cleanUrl.includes("/common/oauth2") ||
    cleanUrl.includes("/organizations/oauth2") ||
    cleanUrl.includes("/consumers/oauth2")
  );
}

function isMicrosoftAppUrl(url) {
  const hostname = getHostname(url);

  return (
    hostname === "m365.cloud.microsoft" ||
    hostname.endsWith(".cloud.microsoft") ||
    hostname === "office.com" ||
    hostname.endsWith(".office.com") ||
    hostname === "office365.com" ||
    hostname.endsWith(".office365.com") ||
    hostname.endsWith(".sharepoint.com") ||
    hostname.endsWith(".officeapps.live.com") ||
    hostname.endsWith(".microsoft.com") ||
    hostname.endsWith(".outlook.com") ||
    hostname.endsWith(".live.com")
  );
}

function isOpenAiAuthUrl(url) {
  const hostname = getHostname(url);
  const cleanUrl = String(url || "").toLowerCase();

  return (
    hostname === "auth.openai.com" ||
    hostname.endsWith(".auth.openai.com") ||
    hostname === "chatgpt.com" ||
    hostname.endsWith(".chatgpt.com") ||
    hostname === "openai.com" ||
    hostname.endsWith(".openai.com") ||
    cleanUrl.includes("auth.openai.com") ||
    cleanUrl.includes("/oauth") ||
    cleanUrl.includes("/authorize")
  );
}

function isTrustedLoginUrl(url) {
  if (!url) return false;
  if (url === "about:blank") return true;

  const cleanUrl = String(url || "").toLowerCase();

  return (
    isGoogleAuthUrl(url) ||
    isMicrosoftAuthUrl(url) ||
    isOpenAiAuthUrl(url) ||
    cleanUrl.includes("/oauth") ||
    cleanUrl.includes("/authorize") ||
    cleanUrl.includes("/login") ||
    cleanUrl.includes("/signin") ||
    cleanUrl.includes("/sso") ||
    cleanUrl.includes("saml") ||
    cleanUrl.includes("openid")
  );
}

function shouldOpenInsideNosturTab(url) {
  if (!url) return false;
  if (url === "about:blank") return false;
  if (!isHttpUrl(url)) return false;

  return true;
}

/* =========================================================
   PARTICIONES
========================================================= */

function getBasePartitionByUrl(url) {
  if (isChatGptUrl(url)) return "persist:chatgpt";
  if (isMicrosoftAppUrl(url) || isMicrosoftAuthUrl(url)) return "persist:office";
  if (isGoogleUrl(url) || isGoogleAuthUrl(url)) return "persist:web";

  return "persist:web";
}

function getPartitionForContents(contents, targetUrl) {
  const openerUrl = contents?.getURL?.() || "";
  const openerPartition = getBasePartitionByUrl(openerUrl);
  const targetPartition = getBasePartitionByUrl(targetUrl);

  if (openerPartition === "persist:chatgpt") return "persist:chatgpt";
  if (openerPartition === "persist:office") return "persist:office";
  if (targetPartition === "persist:office") return "persist:office";
  if (targetPartition === "persist:chatgpt") return "persist:chatgpt";

  return "persist:web";
}

function getAppIdByUrl(url) {
  if (isMicrosoftAppUrl(url) || isMicrosoftAuthUrl(url)) return "office";
  if (isChatGptUrl(url)) return "chatgpt";
  return "web";
}

function getTitleByUrl(url) {
  if (isMicrosoftAppUrl(url) || isMicrosoftAuthUrl(url)) return "Microsoft 365";
  if (isChatGptUrl(url)) return "ChatGPT";
  return "Web";
}

/* =========================================================
   MAIN → RENDERER
========================================================= */

function sendNewTab(url, options = {}) {
  log("sendNewTab recibido:", url, options);

  if (!url || url === "about:blank" || !isHttpUrl(url)) {
    warn("sendNewTab cancelado:", url);
    return;
  }

  if (!mainWindow || mainWindow.isDestroyed()) {
    warn("sendNewTab cancelado: mainWindow no disponible");
    return;
  }

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();

  mainWindow.webContents.send("nostur:new-tab-from-main", {
    url,
    title: options.title || getTitleByUrl(url),
    appId: options.appId || getAppIdByUrl(url)
  });
}

function sendOpenConversationFromNotification(conversationId) {
  log("sendOpenConversationFromNotification:", conversationId);

  if (!conversationId) return;
  if (!mainWindow || mainWindow.isDestroyed()) return;

  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }

  mainWindow.show();
  mainWindow.focus();

  mainWindow.webContents.send("nostur:open-conversation-from-notification", {
    conversationId
  });
}

/* =========================================================
   NOTIFICACIONES
========================================================= */

function normalizeNotificationPayload(payload) {
  const raw = payload || {};

  return {
    title: String(raw.title || "Nuevo mensaje"),
    subtitle: String(raw.subtitle || "NOSTUR"),
    body: String(raw.body || raw.message || "Nuevo mensaje"),
    conversationId: raw.conversationId ? String(raw.conversationId) : "",
    messageId: raw.messageId ? String(raw.messageId) : "",
    badgeCount:
      raw.badgeCount === null || raw.badgeCount === undefined
        ? null
        : Math.max(0, Number(raw.badgeCount) || 0)
  };
}

function showNosturNotification(payload) {
  if (!payload) {
    return {
      ok: false,
      mode: "none",
      reason: "payload_empty"
    };
  }

  const normalized = normalizeNotificationPayload(payload);
  const icon = getNotificationIconPath();
  const appFocused = isMainWindowFocused();

  log("showNosturNotification:", {
    ...normalized,
    supported: Notification.isSupported(),
    icon,
    isPackaged: app.isPackaged,
    appFocused
  });

  if (normalized.badgeCount !== null) {
    updateDockBadge(normalized.badgeCount);
  } else {
    incrementDockBadge();
  }

  bounceDock();

  sendInternalNotification({
    title: normalized.title,
    subtitle: normalized.subtitle,
    body: normalized.body,
    conversationId: normalized.conversationId,
    messageId: normalized.messageId,
    appFocused,
    createdAt: new Date().toISOString()
  });

  /*
    Importante:
    macOS a veces no muestra la notificación nativa de Electron
    cuando la app está activa/en foco. Para NOSTUR forzamos fallback
    con osascript porque en tu Mac ya comprobamos que funciona.
    Esto se mantiene para mensajes normales, no para updates.
  */
  if (process.platform === "darwin") {
    showMacOsFallbackNotification({
      title: normalized.title,
      subtitle: normalized.subtitle,
      body: normalized.body
    });

    return {
      ok: true,
      mode: "macos_osascript",
      appFocused,
      dockBadge: dockNotificationCount
    };
  }

  if (!Notification.isSupported()) {
    warn("Notificaciones no soportadas. Solo badge/bounce/internal.");

    return {
      ok: true,
      mode: "internal_only",
      appFocused,
      dockBadge: dockNotificationCount
    };
  }

  try {
    const notification = new Notification({
      title: normalized.title,
      subtitle: normalized.subtitle,
      body: normalized.body,
      silent: false,
      sound: "default",
      icon
    });

    activeNotifications.add(notification);

    notification.on("click", () => {
      activeNotifications.delete(notification);
      clearDockBadge();
      sendOpenConversationFromNotification(normalized.conversationId);
    });

    notification.on("close", () => {
      activeNotifications.delete(notification);
    });

    notification.on("failed", (_event, err) => {
      activeNotifications.delete(notification);
      errorLog("Falló la notificación:", err);
    });

    notification.show();

    setTimeout(() => {
      activeNotifications.delete(notification);
    }, 45000);

    return {
      ok: true,
      mode: "native",
      appFocused,
      dockBadge: dockNotificationCount
    };
  } catch (err) {
    errorLog("Error creando/mostrando notificación:", err);

    return {
      ok: false,
      mode: "native_failed",
      appFocused,
      dockBadge: dockNotificationCount,
      error: err instanceof Error ? err.message : String(err)
    };
  }
}

/* =========================================================
   POPUPS
========================================================= */

function getPopupWindowOptions(partitionName = "persist:web") {
  return {
    width: 720,
    height: 820,
    minWidth: 520,
    minHeight: 620,
    show: true,
    backgroundColor: "#ffffff",
    title: "Inicio de sesión",
    autoHideMenuBar: true,
    webPreferences: {
      partition: partitionName,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  };
}

function openPopupNavigationInsideNostur(childWindow, _partitionName, nextUrl) {
  if (!nextUrl || nextUrl === "about:blank") return false;
  if (isTrustedLoginUrl(nextUrl)) return false;
  if (!shouldOpenInsideNosturTab(nextUrl)) return false;

  sendNewTab(nextUrl, {
    appId: getAppIdByUrl(nextUrl),
    title: getTitleByUrl(nextUrl)
  });

  if (childWindow && !childWindow.isDestroyed()) {
    childWindow.close();
  }

  return true;
}

function configurePopupWindow(childWindow, partitionName) {
  if (!childWindow || childWindow.isDestroyed()) return;

  childWindow.setMenuBarVisibility(false);
  childWindow.webContents.setUserAgent(CHROME_USER_AGENT);

  childWindow.webContents.on("will-navigate", (event, nextUrl) => {
    if (openPopupNavigationInsideNostur(childWindow, partitionName, nextUrl)) {
      event.preventDefault();
    }
  });

  childWindow.webContents.on("did-navigate", (_event, nextUrl) => {
    openPopupNavigationInsideNostur(childWindow, partitionName, nextUrl);
  });

  childWindow.webContents.on("did-redirect-navigation", (_event, nextUrl) => {
    openPopupNavigationInsideNostur(childWindow, partitionName, nextUrl);
  });

  childWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    errorLog("Popup falló al cargar:", {
      partitionName,
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  childWindow.webContents.setWindowOpenHandler(({ url }) => {
    const nextPartition = getBasePartitionByUrl(url) || partitionName;

    if (!url || url === "about:blank" || isTrustedLoginUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: getPopupWindowOptions(nextPartition)
      };
    }

    sendNewTab(url, {
      appId: getAppIdByUrl(url),
      title: getTitleByUrl(url)
    });

    return { action: "deny" };
  });
}

/* =========================================================
   DESCARGAS
========================================================= */

function getNosturDownloadsDir() {
  const downloadsDir = app.getPath("downloads");
  const nosturDownloadsDir = path.join(downloadsDir, "NOSTUR");

  if (!fs.existsSync(nosturDownloadsDir)) {
    fs.mkdirSync(nosturDownloadsDir, { recursive: true });
  }

  return nosturDownloadsDir;
}

function cleanDownloadFilename(filename) {
  const fallback = `descarga-${Date.now()}`;

  const clean = String(filename || fallback)
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);

  return clean || fallback;
}

function getUniqueDownloadPath(folder, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(folder, filename);
  let index = 1;

  while (fs.existsSync(candidate)) {
    const nextName = `${parsed.name}-${index}${parsed.ext}`;
    candidate = path.join(folder, nextName);
    index += 1;
  }

  return candidate;
}

function sendDownloadEvent(channel, payload) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send(channel, payload);
}

function configureDownloadHandling(ses, partitionName) {
  if (!ses || ses.__nosturDownloadsConfigured) return;

  ses.__nosturDownloadsConfigured = true;

  ses.on("will-download", (_event, item) => {
    let folder = "";
    let finalPath = "";
    let cleanFilename = "";

    try {
      const originalFilename = item.getFilename() || `descarga-${Date.now()}`;
      folder = getNosturDownloadsDir();
      cleanFilename = cleanDownloadFilename(originalFilename);
      finalPath = getUniqueDownloadPath(folder, cleanFilename);

      item.setSavePath(finalPath);

      sendDownloadEvent("nostur:download-started", {
        filename: path.basename(finalPath),
        path: finalPath,
        folder,
        partitionName,
        state: "started",
        receivedBytes: 0,
        totalBytes: item.getTotalBytes()
      });

      item.on("updated", (_updatedEvent, state) => {
        sendDownloadEvent("nostur:download-updated", {
          filename: path.basename(finalPath),
          path: finalPath,
          folder,
          state,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          partitionName
        });
      });

      item.once("done", (_doneEvent, state) => {
        const savedPath = item.getSavePath() || finalPath;
        const fileExists = Boolean(savedPath && fs.existsSync(savedPath));

        let fileSize = 0;

        if (fileExists) {
          try {
            fileSize = fs.statSync(savedPath).size;
          } catch {
            fileSize = 0;
          }
        }

        const normalizedState = fileExists && fileSize > 0 ? "completed" : state;

        sendDownloadEvent("nostur:download-done", {
          filename: path.basename(savedPath || finalPath || cleanFilename || "descarga"),
          path: savedPath,
          folder: savedPath ? path.dirname(savedPath) : folder,
          state: normalizedState,
          originalState: state,
          receivedBytes: item.getReceivedBytes(),
          totalBytes: item.getTotalBytes(),
          partitionName,
          fileExists,
          fileSize
        });
      });
    } catch (err) {
      errorLog("Error manejando descarga:", err);

      sendDownloadEvent("nostur:download-done", {
        filename: cleanFilename || "descarga",
        path: finalPath,
        folder,
        state: "interrupted",
        originalState: "interrupted",
        error: err instanceof Error ? err.message : "No se pudo manejar la descarga.",
        partitionName,
        fileExists: false,
        fileSize: 0
      });
    }
  });
}

/* =========================================================
   MENÚ CONTEXTUAL
========================================================= */

function configureContextMenu(contents) {
  if (!contents || contents.isDestroyed() || contents.__nosturContextMenuConfigured) return;

  contents.__nosturContextMenuConfigured = true;

  contents.on("context-menu", (event, params) => {
    try {
      const template = [];

      const linkUrl = String(params.linkURL || "").trim();
      const srcUrl = String(params.srcURL || "").trim();
      const pageUrl = String(params.pageURL || contents.getURL() || "").trim();
      const selectionText = String(params.selectionText || "").trim();
      const isEditable = Boolean(params.isEditable);
      const mediaType = String(params.mediaType || "").trim();

      if (linkUrl) {
        template.push(
          {
            label: "Abrir link en nueva pestaña",
            click: () => sendNewTab(linkUrl)
          },
          {
            label: "Abrir link afuera",
            click: () => {
              if (isHttpUrl(linkUrl)) void shell.openExternal(linkUrl);
            }
          },
          {
            label: "Copiar link",
            click: () => clipboard.writeText(linkUrl)
          }
        );
      }

      if (srcUrl && mediaType === "image") {
        if (template.length > 0) template.push({ type: "separator" });

        template.push(
          {
            label: "Abrir imagen en nueva pestaña",
            click: () => sendNewTab(srcUrl)
          },
          {
            label: "Guardar imagen",
            click: () => {
              if (isHttpUrl(srcUrl)) contents.downloadURL(srcUrl);
            }
          },
          {
            label: "Copiar URL de imagen",
            click: () => clipboard.writeText(srcUrl)
          }
        );
      }

      if (selectionText) {
        if (template.length > 0) template.push({ type: "separator" });
        template.push({ label: "Copiar texto seleccionado", role: "copy" });
      }

      if (isEditable) {
        if (template.length > 0) template.push({ type: "separator" });

        template.push(
          { label: "Cortar", role: "cut" },
          { label: "Copiar", role: "copy" },
          { label: "Pegar", role: "paste" },
          { label: "Seleccionar todo", role: "selectAll" }
        );
      }

      if (template.length > 0) template.push({ type: "separator" });

      template.push(
        {
          label: "Atrás",
          enabled: typeof contents.canGoBack === "function" && contents.canGoBack(),
          click: () => {
            if (!contents.isDestroyed() && contents.canGoBack()) contents.goBack();
          }
        },
        {
          label: "Adelante",
          enabled: typeof contents.canGoForward === "function" && contents.canGoForward(),
          click: () => {
            if (!contents.isDestroyed() && contents.canGoForward()) contents.goForward();
          }
        },
        {
          label: "Recargar",
          click: () => {
            if (!contents.isDestroyed()) contents.reload();
          }
        }
      );

      if (pageUrl && isHttpUrl(pageUrl)) {
        template.push(
          { type: "separator" },
          {
            label: "Copiar URL de esta página",
            click: () => clipboard.writeText(pageUrl)
          },
          {
            label: "Abrir esta página afuera",
            click: () => void shell.openExternal(pageUrl)
          }
        );
      }

      if (isDev) {
        template.push(
          { type: "separator" },
          {
            label: "Inspeccionar",
            click: () => {
              if (!contents.isDestroyed()) contents.inspectElement(params.x, params.y);
            }
          }
        );
      }

      Menu.buildFromTemplate(template).popup({
        window: BrowserWindow.fromWebContents(contents) || mainWindow || undefined
      });

      event.preventDefault();
    } catch (err) {
      errorLog("Error mostrando menú contextual:", err);
    }
  });
}

/* =========================================================
   VENTANAS / NAVEGACIÓN
========================================================= */

function configureWindowOpenHandling() {
  log("Configurando manejo de ventanas/navegación...");

  app.on("web-contents-created", (_event, contents) => {
    configureContextMenu(contents);

    contents.setWindowOpenHandler(({ url }) => {
      const partitionName = getPartitionForContents(contents, url);

      if (!url || url === "about:blank" || isTrustedLoginUrl(url)) {
        return {
          action: "allow",
          overrideBrowserWindowOptions: getPopupWindowOptions(partitionName)
        };
      }

      sendNewTab(url, {
        appId: getAppIdByUrl(url),
        title: getTitleByUrl(url)
      });

      return { action: "deny" };
    });

    contents.on("will-navigate", (event, url) => {
      const currentUrl = contents.getURL();
      const type = contents.getType();

      if (!url || url === currentUrl) return;
      if (isInternalAppUrl(url)) return;
      if (type === "webview" || type === "window") return;

      event.preventDefault();

      sendNewTab(url, {
        appId: getAppIdByUrl(url),
        title: getTitleByUrl(url)
      });
    });

    contents.on("did-create-window", (childWindow, details) => {
      const url = details?.url || "";
      const partitionName = getPartitionForContents(contents, url);

      if (!childWindow || childWindow.isDestroyed()) {
        if (shouldOpenInsideNosturTab(url)) {
          sendNewTab(url, {
            appId: getAppIdByUrl(url),
            title: getTitleByUrl(url)
          });
        }

        return;
      }

      if (!url || url === "about:blank" || isTrustedLoginUrl(url)) {
        configurePopupWindow(childWindow, partitionName);
        return;
      }

      childWindow.close();

      sendNewTab(url, {
        appId: getAppIdByUrl(url),
        title: getTitleByUrl(url)
      });
    });
  });
}

/* =========================================================
   SESIONES / PERMISOS
========================================================= */

function configureOneSession(ses, partitionName) {
  if (!ses) return;

  configureDownloadHandling(ses, partitionName);

  if (ses.__nosturPermissionsConfigured) return;

  ses.__nosturPermissionsConfigured = true;

  ses.setUserAgent(CHROME_USER_AGENT);

  ses.setPermissionRequestHandler((_webContents, permission, callback) => {
    const allowed = [
      "notifications",
      "media",
      "geolocation",
      "clipboard-read",
      "clipboard-sanitized-write",
      "fullscreen",
      "camera",
      "microphone"
    ];

    callback(allowed.includes(permission));
  });

  ses.webRequest.onBeforeSendHeaders((details, callback) => {
    callback({
      requestHeaders: {
        ...details.requestHeaders,
        "User-Agent": CHROME_USER_AGENT
      }
    });
  });

  ses.webRequest.onHeadersReceived((details, callback) => {
    if (
      details.url.includes("login.microsoftonline.com") ||
      details.url.includes("accounts.google.com") ||
      details.url.includes("auth.openai.com") ||
      details.url.includes("chatgpt.com")
    ) {
      log("Headers recibidos auth:", {
        partitionName,
        url: details.url,
        statusCode: details.statusCode
      });
    }

    callback({
      responseHeaders: details.responseHeaders
    });
  });
}

function configureSessions() {
  log("Configurando permisos de sesiones...");

  configureOneSession(session.defaultSession, "default");

  const partitions = [
    "persist:web",
    "persist:experts",
    "persist:abaco",
    "persist:krooze",
    "persist:liveconnect",
    "persist:aivo",
    "persist:amadeus",
    "persist:sabre",
    "persist:office",
    "persist:chatgpt",
    "persist:crm",
    "persist:internal"
  ];

  for (const partitionName of partitions) {
    configureOneSession(session.fromPartition(partitionName), partitionName);
  }
}

/* =========================================================
   MENÚ SUPERIOR EN ESPAÑOL
========================================================= */

function configureApplicationMenu() {
  const isMac = process.platform === "darwin";

  const template = [
    ...(isMac
      ? [
          {
            label: "NOSTUR",
            submenu: [
              { label: "Acerca de NOSTUR", role: "about" },
              { type: "separator" },
              { label: "Ocultar NOSTUR", role: "hide" },
              { label: "Ocultar otras", role: "hideOthers" },
              { label: "Mostrar todo", role: "unhide" },
              { type: "separator" },
              { label: "Salir de NOSTUR", role: "quit" }
            ]
          }
        ]
      : []),

    {
      label: "Archivo",
      submenu: [
        {
          label: "Nueva pestaña",
          accelerator: "CmdOrCtrl+T",
          click: () => {
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send("nostur:new-tab-from-main", {
                url: "https://www.google.com",
                title: "Web",
                appId: "web"
              });
            }
          }
        },
        { type: "separator" },
        {
          label: "Cerrar ventana",
          role: "close"
        }
      ]
    },

    {
      label: "Editar",
      submenu: [
        { label: "Deshacer", role: "undo" },
        { label: "Rehacer", role: "redo" },
        { type: "separator" },
        { label: "Cortar", role: "cut" },
        { label: "Copiar", role: "copy" },
        { label: "Pegar", role: "paste" },
        { label: "Seleccionar todo", role: "selectAll" }
      ]
    },

    {
      label: "Ver",
      submenu: [
        { label: "Recargar", role: "reload" },
        { label: "Forzar recarga", role: "forceReload" },
        ...(isDev
          ? [
              {
                label: "Herramientas de desarrollo",
                role: "toggleDevTools"
              }
            ]
          : []),
        { type: "separator" },
        { label: "Tamaño real", role: "resetZoom" },
        { label: "Acercar", role: "zoomIn" },
        { label: "Alejar", role: "zoomOut" },
        { type: "separator" },
        { label: "Pantalla completa", role: "togglefullscreen" }
      ]
    },

    {
      label: "Ventana",
      submenu: [
        { label: "Minimizar", role: "minimize" },
        { label: "Zoom", role: "zoom" },
        ...(isMac
          ? [
              { type: "separator" },
              { label: "Traer todo al frente", role: "front" }
            ]
          : [
              { label: "Cerrar", role: "close" }
            ])
      ]
    },

    {
      label: "Ayuda",
      submenu: [
        {
          label: "Soporte NOSTUR",
          click: () => {
            shell.openExternal("https://nostur.com.ar");
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/* =========================================================
   VENTANA PRINCIPAL
========================================================= */

function createWindow() {
  log("Creando ventana principal...");
  log("isDev:", isDev);

  const primaryDisplay = screen.getPrimaryDisplay();
  const workArea = primaryDisplay.workArea;

  mainWindow = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: Math.max(workArea.width, 1400),
    height: Math.max(workArea.height, 900),
    minWidth: 1180,
    minHeight: 760,
    show: false,
    backgroundColor: "#eef1f6",
    title: "NOSTUR",
    icon: getAppIconPath(),

    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition:
      process.platform === "darwin"
        ? {
            x: 16,
            y: 16
          }
        : undefined,

    autoHideMenuBar: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      webviewTag: true,
      sandbox: false,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  mainWindow.webContents.setUserAgent(CHROME_USER_AGENT);

  if (process.platform !== "darwin") {
    mainWindow.setMenuBarVisibility(false);
    mainWindow.setAutoHideMenuBar(true);
  }

  mainWindow.webContents.on("did-finish-load", () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.webContents.setZoomFactor(1);

    mainWindow.webContents
      .executeJavaScript(`
        try {
          localStorage.removeItem("nostur:zoom");
          localStorage.removeItem("nostur:mainZoom");
          localStorage.removeItem("zoom");
          localStorage.removeItem("mainZoom");
          localStorage.setItem("nostur:mainZoom", "1");

          document.documentElement.style.zoom = "1";
          document.body.style.zoom = "1";
        } catch (error) {
          console.error("No se pudo resetear zoom local:", error);
        }
        true;
      `)
      .catch((err) => {
        errorLog("No se pudo ejecutar reset de zoom:", err);
      });

    setTimeout(() => {
      if (!mainWindow || mainWindow.isDestroyed()) return;

      mainWindow.webContents.setZoomFactor(1);

      mainWindow.webContents
        .executeJavaScript(`
          try {
            document.documentElement.style.zoom = "1";
            document.body.style.zoom = "1";

            localStorage.removeItem("nostur:zoom");
            localStorage.removeItem("nostur:mainZoom");
            localStorage.removeItem("zoom");
            localStorage.removeItem("mainZoom");
            localStorage.setItem("nostur:mainZoom", "1");
          } catch (error) {
            console.error("No se pudo reforzar zoom:", error);
          }
          true;
        `)
        .catch(() => {});
    }, 1200);
  });

  mainWindow.on("ready-to-show", () => {
    log("mainWindow ready-to-show");

    if (!mainWindow || mainWindow.isDestroyed()) return;

    mainWindow.maximize();
    mainWindow.show();
    mainWindow.focus();
    mainWindow.webContents.setZoomFactor(1);

    if (!isDev && !isMacAutoUpdateDisabled()) {
      setTimeout(() => {
        void checkForUpdatesSafe();
      }, 3500);
    }
  });

  mainWindow.on("focus", () => {
    clearDockBadge();
  });

  mainWindow.on("closed", () => {
    mainWindow = null;
  });

  mainWindow.webContents.on("did-fail-load", (_event, errorCode, errorDescription, validatedURL) => {
    errorLog("Renderer falló al cargar:", {
      errorCode,
      errorDescription,
      validatedURL
    });
  });

  mainWindow.webContents.on("console-message", (_event, level, message, line, sourceId) => {
    console.log("[RENDERER CONSOLE]", {
      level,
      message,
      line,
      sourceId
    });
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    const partitionName = getBasePartitionByUrl(url);

    if (!url || url === "about:blank" || isTrustedLoginUrl(url)) {
      return {
        action: "allow",
        overrideBrowserWindowOptions: getPopupWindowOptions(partitionName)
      };
    }

    sendNewTab(url, {
      appId: getAppIdByUrl(url),
      title: getTitleByUrl(url)
    });

    return { action: "deny" };
  });

  if (isDev) {
    log("Cargando renderer dev: http://127.0.0.1:5173");
    mainWindow.loadURL("http://127.0.0.1:5173");
  } else {
    const indexPath = path.join(__dirname, "../dist/index.html");
    log("Cargando renderer build:", indexPath);
    mainWindow.loadFile(indexPath);
  }
}

/* =========================================================
   AUTOUPDATE
========================================================= */

let autoUpdater = null;
let updateDownloaded = false;
let updateInfoCache = null;
let updateCheckInProgress = false;

const UPDATE_FEED_URL = tenantConfig.updateBaseUrl;

function getUpdatePlatformFolder() {
  if (process.platform === "darwin") return "mac";
  if (process.platform === "win32") return "win";
  return "linux";
}

function getUpdateFeedUrl() {
  return `${UPDATE_FEED_URL}/${getUpdatePlatformFolder()}`;
}

function isMacAutoUpdateDisabled() {
  return process.platform === "darwin" && DISABLE_MAC_AUTOUPDATE;
}

function sendUpdateEvent(type, payload = {}) {
  if (!mainWindow || mainWindow.isDestroyed()) return;

  mainWindow.webContents.send("nostur:update-event", {
    type,
    payload,
    createdAt: new Date().toISOString()
  });
}

function setupAutoUpdater() {
  if (isDev) {
    log("AutoUpdate desactivado en desarrollo.");
    return;
  }

  if (isMacAutoUpdateDisabled()) {
    log(
      "AutoUpdate y notificaciones de actualización desactivadas provisoriamente en macOS hasta firmar con Apple Developer ID."
    );
    return;
  }

  try {
    const updaterModule = require("electron-updater");
    autoUpdater = updaterModule.autoUpdater;

    if (!autoUpdater) {
      warn("electron-updater no devolvió autoUpdater.");
      return;
    }

    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    autoUpdater.allowDowngrade = false;
    autoUpdater.allowPrerelease = false;

    autoUpdater.setFeedURL({
      provider: "generic",
      url: getUpdateFeedUrl()
    });

    autoUpdater.on("checking-for-update", () => {
      log("Buscando actualizaciones...");
      updateCheckInProgress = true;

      sendUpdateEvent("checking-for-update", {
        feedUrl: getUpdateFeedUrl(),
        version: app.getVersion()
      });
    });

    autoUpdater.on("update-available", (info) => {
      log("Actualización disponible:", info);

      updateInfoCache = info || null;
      updateDownloaded = false;

      sendUpdateEvent("update-available", {
        currentVersion: app.getVersion(),
        nextVersion: info?.version || null,
        info
      });

      /*
        Notificaciones de sistema de actualización desactivadas.
        En macOS están bloqueadas hasta firmar/notarizar.
        En Windows se informa desde el banner interno.
      */
    });

    autoUpdater.on("update-not-available", (info) => {
      log("No hay actualizaciones disponibles:", info);

      updateCheckInProgress = false;
      updateInfoCache = info || null;
      updateDownloaded = false;

      sendUpdateEvent("update-not-available", {
        currentVersion: app.getVersion(),
        info
      });
    });

    autoUpdater.on("download-progress", (progress) => {
      const percent = Number(progress?.percent || 0);

      log("Descargando actualización:", {
        percent: Math.round(percent),
        transferred: progress?.transferred,
        total: progress?.total
      });

      sendUpdateEvent("download-progress", {
        percent,
        transferred: progress?.transferred || 0,
        total: progress?.total || 0,
        bytesPerSecond: progress?.bytesPerSecond || 0
      });
    });

    autoUpdater.on("update-downloaded", (info) => {
      log("Actualización descargada:", info);

      updateCheckInProgress = false;
      updateDownloaded = true;
      updateInfoCache = info || null;

      sendUpdateEvent("update-downloaded", {
        currentVersion: app.getVersion(),
        nextVersion: info?.version || null,
        info
      });

      /*
        Notificaciones de sistema de actualización desactivadas.
        La instalación se maneja desde el banner interno cuando el updater esté habilitado.
      */
    });

    autoUpdater.on("error", (err) => {
      updateCheckInProgress = false;

      const message = err instanceof Error ? err.message : String(err);

      errorLog("Error en autoupdate:", message);

      sendUpdateEvent("error", {
        message,
        currentVersion: app.getVersion(),
        feedUrl: getUpdateFeedUrl()
      });
    });

    log("AutoUpdate configurado:", {
      feedUrl: getUpdateFeedUrl(),
      currentVersion: app.getVersion(),
      platform: process.platform
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    errorLog("No se pudo configurar AutoUpdate:", message);

    sendUpdateEvent("error", {
      message,
      currentVersion: app.getVersion(),
      feedUrl: getUpdateFeedUrl()
    });
  }
}

async function checkForUpdatesSafe() {
  if (isDev) {
    return {
      ok: false,
      reason: "dev_mode"
    };
  }

  if (isMacAutoUpdateDisabled()) {
    return {
      ok: false,
      reason: "mac_autoupdate_disabled_until_codesign",
      currentVersion: app.getVersion(),
      feedUrl: getUpdateFeedUrl()
    };
  }

  if (!autoUpdater) {
    setupAutoUpdater();
  }

  if (!autoUpdater) {
    return {
      ok: false,
      reason: "autoUpdater_not_available"
    };
  }

  if (updateCheckInProgress) {
    return {
      ok: true,
      reason: "already_checking"
    };
  }

  try {
    updateCheckInProgress = true;

    log("checkForUpdatesSafe iniciado:", {
      feedUrl: getUpdateFeedUrl(),
      currentVersion: app.getVersion()
    });

    const result = await autoUpdater.checkForUpdates();

    return {
      ok: true,
      result: result || null,
      currentVersion: app.getVersion(),
      feedUrl: getUpdateFeedUrl()
    };
  } catch (err) {
    updateCheckInProgress = false;

    const message = err instanceof Error ? err.message : String(err);

    errorLog("checkForUpdatesSafe falló:", message);

    sendUpdateEvent("error", {
      message,
      currentVersion: app.getVersion(),
      feedUrl: getUpdateFeedUrl()
    });

    return {
      ok: false,
      error: message,
      currentVersion: app.getVersion(),
      feedUrl: getUpdateFeedUrl()
    };
  }
}

function installDownloadedUpdate() {
  if (isMacAutoUpdateDisabled()) {
    return {
      ok: false,
      reason: "mac_autoupdate_disabled_until_codesign"
    };
  }

  if (!autoUpdater) {
    return {
      ok: false,
      reason: "autoUpdater_not_available"
    };
  }

  if (!updateDownloaded) {
    return {
      ok: false,
      reason: "update_not_downloaded"
    };
  }

  try {
    log("Instalando actualización descargada...");

    sendUpdateEvent("installing-update", {
      currentVersion: app.getVersion(),
      nextVersion: updateInfoCache?.version || null
    });

    autoUpdater.quitAndInstall(false, true);

    return {
      ok: true
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    errorLog("No se pudo instalar actualización:", message);

    return {
      ok: false,
      error: message
    };
  }
}

function getUpdateStatus() {
  const macAutoUpdateDisabled = isMacAutoUpdateDisabled();

  return {
    ok: true,
    isDev,
    platform: process.platform,
    currentVersion: app.getVersion(),
    feedUrl: getUpdateFeedUrl(),
    updateCheckInProgress: macAutoUpdateDisabled ? false : updateCheckInProgress,
    updateDownloaded: macAutoUpdateDisabled ? false : updateDownloaded,
    updateInfo: macAutoUpdateDisabled ? null : updateInfoCache,
    autoUpdateDisabled: macAutoUpdateDisabled,
    autoUpdateDisabledReason: macAutoUpdateDisabled
      ? "mac_autoupdate_disabled_until_codesign"
      : null
  };
}

/* =========================================================
   APP READY
========================================================= */

app.whenReady().then(() => {
  log("Electron app ready.");
  log("platform:", process.platform);
  log("isPackaged:", app.isPackaged);
  log("Notification.isSupported():", Notification.isSupported());
  log("App name:", app.getName());
  log("App version:", app.getVersion());
  log("App icon path:", getAppIconPath());
  log("Notification icon path:", getNotificationIconPath());

  configureApplicationMenu();
  configureWindowOpenHandling();
  configureSessions();
  createWindow();
  setupAutoUpdater();

  if (!isMacAutoUpdateDisabled()) {
    setTimeout(() => {
      void checkForUpdatesSafe();
    }, 8000);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    } else if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.show();
      mainWindow.focus();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

/* =========================================================
   IPC
========================================================= */

ipcMain.handle("nostur:ping", async () => {
  return {
    ok: true,
    appName: app.getName(),
    appVersion: app.getVersion(),
    appId: "com.nossix.nostur",
    isPackaged: app.isPackaged,
    platform: process.platform,
    notificationSupported: Notification.isSupported(),
    icon: getAppIconPath(),
    notificationIcon: getNotificationIconPath(),
    dockBadge: dockNotificationCount,
    appFocused: isMainWindowFocused(),
    updateStatus: getUpdateStatus()
  };
});

ipcMain.handle("nostur:check-for-updates", async () => {
  return checkForUpdatesSafe();
});

ipcMain.handle("nostur:install-update", async () => {
  return installDownloadedUpdate();
});

ipcMain.handle("nostur:get-update-status", async () => {
  return getUpdateStatus();
});

ipcMain.handle("nostur:clear-cache", async (_event, partitionName) => {
  log("IPC nostur:clear-cache recibido:", partitionName);

  const partitionsToClear = partitionName
    ? [partitionName]
    : [
        "default",
        "persist:web",
        "persist:experts",
        "persist:abaco",
        "persist:krooze",
        "persist:liveconnect",
        "persist:aivo",
        "persist:amadeus",
        "persist:sabre",
        "persist:office",
        "persist:chatgpt",
        "persist:crm",
        "persist:internal"
      ];

  for (const item of partitionsToClear) {
    const ses = item === "default" ? session.defaultSession : session.fromPartition(item);

    await ses.clearCache();
    await ses.clearStorageData({
      storages: [
        "appcache",
        "cookies",
        "filesystem",
        "indexdb",
        "localstorage",
        "shadercache",
        "websql",
        "serviceworkers",
        "cachestorage"
      ]
    });
  }

  log("Cache limpiada:", partitionName || "todas");

  return true;
});

ipcMain.handle("nostur:open-external", async (_event, url) => {
  if (!url) return false;

  await shell.openExternal(url);
  return true;
});

ipcMain.handle("nostur:open-downloaded-file", async (_event, filePath) => {
  if (!filePath) return false;

  try {
    const result = await shell.openPath(String(filePath));

    if (result) {
      errorLog("No se pudo abrir archivo descargado:", result);
      return false;
    }

    return true;
  } catch (err) {
    errorLog("Error abriendo archivo descargado:", err);
    return false;
  }
});

ipcMain.handle("nostur:show-downloaded-file", async (_event, filePath) => {
  if (!filePath) return false;

  try {
    shell.showItemInFolder(String(filePath));
    return true;
  } catch (err) {
    errorLog("Error mostrando archivo en carpeta:", err);
    return false;
  }
});

ipcMain.handle("nostur:notify", async (_event, payload) => {
  return showNosturNotification(payload);
});

ipcMain.handle("nostur:notify-new-message", async (_event, payload) => {
  return showNosturNotification({
    title: payload?.title || "Nuevo mensaje",
    subtitle: payload?.subtitle || "NOSTUR",
    body: payload?.body || payload?.message || "Nuevo mensaje",
    conversationId: payload?.conversationId || "",
    messageId: payload?.messageId || "",
    badgeCount: payload?.badgeCount
  });
});

ipcMain.handle("nostur:set-dock-badge", async (_event, count) => {
  updateDockBadge(count);
  return true;
});

ipcMain.handle("nostur:clear-dock-badge", async () => {
  clearDockBadge();
  return true;
});

ipcMain.handle("nostur:set-main-zoom", async (_event, zoomFactor) => {
  const factor = Number(zoomFactor);

  if (!Number.isFinite(factor)) {
    return false;
  }

  const normalized = Math.max(1, Math.min(1.25, factor));

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.setZoomFactor(normalized);

    mainWindow.webContents
      .executeJavaScript(`
        try {
          document.documentElement.style.zoom = "1";
          document.body.style.zoom = "1";
          localStorage.removeItem("nostur:zoom");
          localStorage.removeItem("nostur:mainZoom");
          localStorage.removeItem("zoom");
          localStorage.removeItem("mainZoom");
          localStorage.setItem("nostur:mainZoom", "1");
        } catch (error) {
          console.error("No se pudo fijar zoom desde IPC:", error);
        }
        true;
      `)
      .catch(() => {});

    return true;
  }

  return false;
});

ipcMain.handle("nostur:play-notification-sound", async (_event, payload) => {
  const kind = String(payload?.kind || "gestion");

  let repeats = 1;
  let gap = 160;

  if (kind === "nuevo") {
    repeats = 2;
    gap = 180;
  }

  if (kind === "cande_transfer") {
    repeats = 3;
    gap = 130;
  }

  log("IPC nostur:play-notification-sound recibido:", {
    kind,
    repeats
  });

  try {
    for (let index = 0; index < repeats; index += 1) {
      shell.beep();

      if (index < repeats - 1) {
        await wait(gap);
      }
    }

    return true;
  } catch (err) {
    errorLog("Error reproduciendo beep:", err);
    return false;
  }
});