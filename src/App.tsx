// src/App.tsx

import { useEffect, useState } from "react";
import { Shell } from "./components/Shell";
import { LoginScreen } from "./components/LoginScreen";
import { MobileApp } from "./mobile/MobileApp";
import { useBrowserStore } from "./store/browserStore";
import { useAuthStore } from "./store/authStore";
import { brandAssets, brandText } from "./lib/brandAssets";
type NewTabFromMainPayload =
  | string
  | {
      url?: string;
      title?: string;
      appId?: string;
    };

function shouldUseMobileApp(): boolean {
  const forcedMode = String(import.meta.env.VITE_NOSTUR_MODE || "").toLowerCase();

  if (forcedMode === "mobile") return true;
  if (forcedMode === "desktop") return false;

  if (typeof window === "undefined") return false;

  const params = new URLSearchParams(window.location.search);

  if (params.get("mobile") === "1") return true;
  if (params.get("desktop") === "1") return false;

  const width = window.innerWidth || 1200;
  const hasTouch =
    "ontouchstart" in window ||
    navigator.maxTouchPoints > 0 ||
    window.matchMedia("(pointer: coarse)").matches;

  return width <= 820 || (hasTouch && width <= 1024);
}

function normalizeNewTabPayload(payload: NewTabFromMainPayload): {
  url: string;
  title?: string;
  appId?: string;
} | null {
  if (typeof payload === "string") {
    const url = payload.trim();

    if (!url || url === "about:blank") return null;

    return {
      url
    };
  }

  const url = String(payload?.url || "").trim();

  if (!url || url === "about:blank") return null;

  return {
    url,
    title: payload?.title,
    appId: payload?.appId
  };
}

function LoadingScreen() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#eef1f6] text-[#1f2937]">
      <div className="text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center overflow-hidden rounded-[24px] bg-white shadow-md ring-1 ring-black/10">
          <img
            src={brandAssets.iconoColor}
            alt={brandText.appName}
            className="h-12 w-12 object-contain"
            draggable={false}
          />
        </div>

        <img
          src={brandAssets.logoColorNegro}
          alt={brandText.appName}
          className="mx-auto h-auto max-h-[42px] w-[210px] object-contain"
          draggable={false}
        />

        <div className="mt-3 text-xs text-[#64748b]">Verificando sesión</div>
      </div>
    </div>
  );
}

export default function App() {
  const createTab = useBrowserStore((state) => state.createTab);

  const initialized = useAuthStore((state) => state.initialized);
  const loading = useAuthStore((state) => state.loading);
  const session = useAuthStore((state) => state.session);
  const initializeAuth = useAuthStore((state) => state.initializeAuth);

  const [isMobile, setIsMobile] = useState(() => shouldUseMobileApp());

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    function handleResize() {
      setIsMobile(shouldUseMobileApp());
    }

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let cancelled = false;
    let retryTimer: number | null = null;

    function attachListener() {
      if (cancelled) return;

      if (!window.nostur?.onNewTabFromMain) {
        retryTimer = window.setTimeout(attachListener, 250);
        return;
      }

      unsubscribe = window.nostur.onNewTabFromMain((payload) => {
        const normalized = normalizeNewTabPayload(payload);

        if (!normalized) return;

        createTab({
          appId: normalized.appId,
          url: normalized.url,
          title: normalized.title || "Web",
          activate: true
        });
      });
    }

    attachListener();

    return () => {
      cancelled = true;

      if (retryTimer) {
        window.clearTimeout(retryTimer);
      }

      unsubscribe?.();
    };
  }, [createTab]);

  if (!initialized || loading) {
    return <LoadingScreen />;
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (isMobile) {
    return <MobileApp />;
  }

  return <Shell />;
}