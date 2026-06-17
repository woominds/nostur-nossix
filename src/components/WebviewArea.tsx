// src/components/WebviewArea.tsx

import { useEffect, useMemo, useRef } from "react";
import { useBrowserStore, type BrowserTab } from "../store/browserStore";
import { getFaviconUrl } from "../utils/url";

type WebviewAreaProps = {
  visibleTabIds?: string[];
};

type PopupPayload = {
  url?: string;
  title?: string;
  appId?: string;
};

function getHostname(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isValidExternalUrl(url: string): boolean {
  return url.startsWith("http://") || url.startsWith("https://");
}

function isGoogleAuthUrl(url: string): boolean {
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

function isMicrosoftAuthUrl(url: string): boolean {
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

function isOpenAiAuthUrl(url: string): boolean {
  const hostname = getHostname(url);
  const cleanUrl = String(url || "").toLowerCase();

  return (
    hostname === "auth.openai.com" ||
    hostname.endsWith(".auth.openai.com") ||
    cleanUrl.includes("auth.openai.com") ||
    cleanUrl.includes("/oauth") ||
    cleanUrl.includes("/authorize")
  );
}

function isTrustedAuthPopupUrl(url: string): boolean {
  if (!url) return false;
  if (url === "about:blank") return true;

  return isMicrosoftAuthUrl(url) || isGoogleAuthUrl(url) || isOpenAiAuthUrl(url);
}

function isMicrosoftAppUrl(url: string): boolean {
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

function getPopupAppId(url: string, sourceTab?: BrowserTab | null): string {
  if (isMicrosoftAppUrl(url) || isMicrosoftAuthUrl(url)) return "office";
  if (sourceTab?.appId) return sourceTab.appId;
  return "web";
}

function normalizeForCompare(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return String(url || "").trim();
  }
}

function safeLoadUrl(webview: NosturWebview | null, url: string) {
  if (!webview || !url || url.startsWith("internal://") || url === "nostur://home") return;

  try {
    const withLoadUrl = webview as NosturWebview & {
      loadURL?: (targetUrl: string) => void;
    };

    if (typeof withLoadUrl.loadURL === "function") {
      withLoadUrl.loadURL(url);
      return;
    }

    webview.setAttribute("src", url);
  } catch {
    /*
      Si el webview todavía no está listo, no rompemos la app.
      El src inicial lo carga igual.
    */
  }
}

export function WebviewArea({ visibleTabIds }: WebviewAreaProps = {}) {
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const updateTab = useBrowserStore((state) => state.updateTab);
  const createTab = useBrowserStore((state) => state.createTab);

  const webviewRefs = useRef<Record<string, NosturWebview | null>>({});
  const initialSrcByTabIdRef = useRef<Record<string, string>>({});
  const initialPartitionByTabIdRef = useRef<Record<string, string>>({});
  const lastRequestedUrlByTabIdRef = useRef<Record<string, string>>({});

  const visibleSet = useMemo(() => {
    return new Set(visibleTabIds || [activeTabId || ""]);
  }, [activeTabId, visibleTabIds]);

  /*
    IMPORTANTE:
    El main.js ya intercepta window.open / popups con setWindowOpenHandler
    y manda este evento por IPC:
      nostur:new-tab-from-main

    Sin este listener, Electron bloquea o deriva el popup,
    pero React nunca crea la pestaña nueva.
  */
  useEffect(() => {
    const nosturApi = window.nostur as
      | {
          onNewTabFromMain?: (callback: (payload: PopupPayload) => void) => () => void;
        }
      | undefined;

    if (!nosturApi?.onNewTabFromMain) return;

    const unsubscribe = nosturApi.onNewTabFromMain((payload: PopupPayload) => {
      const url = String(payload?.url || "").trim();

      if (!url || url === "about:blank") return;
      if (!isValidExternalUrl(url)) return;

      const activeTab = tabs.find((tab) => tab.id === activeTabId) || null;

      createTab({
        appId: payload.appId || getPopupAppId(url, activeTab),
        url,
        title: payload.title || "Web",
        activate: true
      });
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [activeTabId, createTab, tabs]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];

    for (const tab of tabs) {
      if (tab.url === "nostur://home") continue;

      const webview = webviewRefs.current[tab.id];

      if (!webview) continue;

      const forceResize = () => {
        webview.style.position = "absolute";
        webview.style.inset = "0";
        webview.style.width = "100%";
        webview.style.height = "100%";
        webview.style.minWidth = "100%";
        webview.style.minHeight = "100%";
        webview.style.display = "flex";
      };

      const handleDidAttach = () => {
        forceResize();
      };

      const handleDomReady = () => {
        forceResize();
      };

      const handleDidStartLoading = () => {
        forceResize();

        updateTab(tab.id, {
          isLoading: true
        });
      };

      const handleDidStopLoading = () => {
        forceResize();

        updateTab(tab.id, {
          isLoading: false,
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward()
        });
      };

      const handleDidNavigate = (event: Event) => {
        const navigationEvent = event as NosturDidNavigateEvent;

        forceResize();

        lastRequestedUrlByTabIdRef.current[tab.id] = navigationEvent.url;

        updateTab(tab.id, {
          url: navigationEvent.url,
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
          faviconUrl: getFaviconUrl(navigationEvent.url)
        });
      };

      const handleDidNavigateInPage = (event: Event) => {
        const navigationEvent = event as NosturDidNavigateInPageEvent;

        forceResize();

        lastRequestedUrlByTabIdRef.current[tab.id] = navigationEvent.url;

        updateTab(tab.id, {
          url: navigationEvent.url,
          canGoBack: webview.canGoBack(),
          canGoForward: webview.canGoForward(),
          faviconUrl: getFaviconUrl(navigationEvent.url)
        });
      };

      const handlePageTitleUpdated = (event: Event) => {
        const titleEvent = event as NosturPageTitleUpdatedEvent;

        updateTab(tab.id, {
          title: titleEvent.title || tab.title
        });
      };

      const handlePageFaviconUpdated = (event: Event) => {
        const faviconEvent = event as NosturPageFaviconUpdatedEvent;
        const favicon = faviconEvent.favicons?.[0];

        if (favicon) {
          updateTab(tab.id, {
            faviconUrl: favicon
          });
        }
      };

      /*
        Fallback para versiones de Electron / webview donde todavía llega new-window.
        El flujo principal ahora pasa por main.js + preload + onNewTabFromMain.
      */
      const handleNewWindow = (event: Event) => {
        const newWindowEvent = event as NosturNewWindowEvent;
        const url = String(newWindowEvent.url || "").trim();

        if (!url || url === "about:blank") {
          return;
        }

        if (isTrustedAuthPopupUrl(url)) {
          return;
        }

        newWindowEvent.preventDefault();

        createTab({
          appId: getPopupAppId(url, tab),
          url,
          title: "Web",
          activate: true
        });
      };

      webview.addEventListener("did-attach", handleDidAttach);
      webview.addEventListener("dom-ready", handleDomReady);
      webview.addEventListener("did-start-loading", handleDidStartLoading);
      webview.addEventListener("did-stop-loading", handleDidStopLoading);
      webview.addEventListener("did-navigate", handleDidNavigate);
      webview.addEventListener("did-navigate-in-page", handleDidNavigateInPage);
      webview.addEventListener("page-title-updated", handlePageTitleUpdated);
      webview.addEventListener("page-favicon-updated", handlePageFaviconUpdated);
      webview.addEventListener("new-window", handleNewWindow);

      forceResize();

      cleanups.push(() => {
        webview.removeEventListener("did-attach", handleDidAttach);
        webview.removeEventListener("dom-ready", handleDomReady);
        webview.removeEventListener("did-start-loading", handleDidStartLoading);
        webview.removeEventListener("did-stop-loading", handleDidStopLoading);
        webview.removeEventListener("did-navigate", handleDidNavigate);
        webview.removeEventListener("did-navigate-in-page", handleDidNavigateInPage);
        webview.removeEventListener("page-title-updated", handlePageTitleUpdated);
        webview.removeEventListener("page-favicon-updated", handlePageFaviconUpdated);
        webview.removeEventListener("new-window", handleNewWindow);
      });
    }

    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [tabs, updateTab, createTab]);

  useEffect(() => {
    for (const tab of tabs) {
      if (tab.url === "nostur://home") continue;

      const webview = webviewRefs.current[tab.id];

      if (!webview) continue;

      const targetUrl = tab.url;
      const lastRequestedUrl = lastRequestedUrlByTabIdRef.current[tab.id] || "";

      if (!targetUrl || targetUrl.startsWith("internal://")) continue;

      if (normalizeForCompare(targetUrl) === normalizeForCompare(lastRequestedUrl)) {
        continue;
      }

      lastRequestedUrlByTabIdRef.current[tab.id] = targetUrl;

      safeLoadUrl(webview, targetUrl);
    }
  }, [tabs]);

  useEffect(() => {
    const idsToShow = visibleTabIds || [activeTabId || ""];

    idsToShow.forEach((tabId) => {
      const webview = webviewRefs.current[tabId];

      if (!webview) return;

      webview.style.position = "absolute";
      webview.style.inset = "0";
      webview.style.width = "100%";
      webview.style.height = "100%";
      webview.style.minWidth = "100%";
      webview.style.minHeight = "100%";
      webview.style.display = "flex";
      webview.style.visibility = "visible";
      webview.style.opacity = "1";
      webview.style.pointerEvents = "auto";
    });
  }, [activeTabId, tabs.length, visibleTabIds]);

  return (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden bg-white">
      {tabs
        .filter((tab) => tab.url !== "nostur://home")
        .map((tab) => {
          const active = visibleSet.has(tab.id);

          if (!initialSrcByTabIdRef.current[tab.id]) {
            initialSrcByTabIdRef.current[tab.id] = tab.url;
            lastRequestedUrlByTabIdRef.current[tab.id] = tab.url;
          }

          if (!initialPartitionByTabIdRef.current[tab.id]) {
            initialPartitionByTabIdRef.current[tab.id] = tab.partition;
          }

          const initialSrc = initialSrcByTabIdRef.current[tab.id];
          const initialPartition = initialPartitionByTabIdRef.current[tab.id];

          return (
        <webview
  key={tab.id}
  ref={(element) => {
    webviewRefs.current[tab.id] = element as NosturWebview | null;
  }}
  data-tab-id={tab.id}
  src={initialSrc}
  partition={initialPartition}
  allowpopups={"true" as unknown as boolean}
  webpreferences="contextIsolation=yes, nodeIntegration=no, javascript=yes, plugins=yes"
  style={{
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    minWidth: "100%",
    minHeight: "100%",
    display: "flex",
    border: 0,
    background: "#ffffff",
    visibility: active ? "visible" : "hidden",
    opacity: active ? 1 : 0,
    pointerEvents: active ? "auto" : "none",
    zIndex: active ? 2 : 1
  }}
/>
          );
        })}
    </div>
  );
}

export default WebviewArea;