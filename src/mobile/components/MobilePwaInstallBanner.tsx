// src/mobile/components/MobilePwaInstallBanner.tsx

import { useEffect, useMemo, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { brandAssets } from "../../lib/brandAssets";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

const HIDE_KEY = "nostur_mobile_pwa_banner_hidden";

function isStandaloneMode(): boolean {
  const standaloneMedia = window.matchMedia?.("(display-mode: standalone)")?.matches;

  const navigatorStandalone = Boolean(
    (window.navigator as Navigator & { standalone?: boolean }).standalone
  );

  return Boolean(standaloneMedia || navigatorStandalone);
}

function isIosDevice(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();

  return /iphone|ipad|ipod/.test(userAgent);
}

function isAndroidDevice(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();

  return /android/.test(userAgent);
}

function isChromeLikeBrowser(): boolean {
  const userAgent = window.navigator.userAgent.toLowerCase();

  return (
    userAgent.includes("chrome") ||
    userAgent.includes("crios") ||
    userAgent.includes("edg") ||
    userAgent.includes("samsungbrowser")
  );
}

export function MobilePwaInstallBanner() {
  const [hidden, setHidden] = useState(() => window.localStorage.getItem(HIDE_KEY) === "1");
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(() => isStandaloneMode());

  const device = useMemo(() => {
    if (isIosDevice()) return "ios";
    if (isAndroidDevice()) return "android";
    return "other";
  }, []);

  const canShowInstallButton = Boolean(deferredPrompt && device !== "ios");
  const shouldShow = !hidden && !isStandalone;

  useEffect(() => {
    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    }

    function handleAppInstalled() {
      setIsStandalone(true);
      setHidden(true);
      window.localStorage.setItem(HIDE_KEY, "1");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  function closeBanner() {
    setHidden(true);
    window.localStorage.setItem(HIDE_KEY, "1");
  }

  async function installApp() {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();

    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "accepted") {
      setHidden(true);
      window.localStorage.setItem(HIDE_KEY, "1");
    }

    setDeferredPrompt(null);
  }

  if (!shouldShow) return null;

  return (
    <section className="mb-3 overflow-hidden rounded-[24px] border border-black/10 bg-white/88 p-3 shadow-sm backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[18px] bg-[#172033] shadow-sm">
          <img
            src={brandAssets.iconoColor}
            alt="NOSTUR"
            className="h-8 w-8 object-contain"
            draggable={false}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-[13px] font-semibold leading-tight text-[#111827]">
                Instalá NOSTUR Mobile
              </h2>

              <p className="mt-1 text-[11px] font-normal leading-snug text-[#64748b]">
                Acceso rápido desde la pantalla de inicio, como una app del celular.
              </p>
            </div>

            <button
              type="button"
              onClick={closeBanner}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b]"
              aria-label="Ocultar banner"
            >
              <X size={14} strokeWidth={1.9} />
            </button>
          </div>

          {canShowInstallButton ? (
            <button
              type="button"
              onClick={installApp}
              className="mt-3 flex h-9 w-full items-center justify-center gap-2 rounded-2xl bg-[#172033] text-[12px] font-semibold text-white shadow-sm active:scale-[0.99]"
            >
              <Download size={15} strokeWidth={2} />
              Instalar app
            </button>
          ) : device === "ios" ? (
            <div className="mt-3 rounded-2xl border border-nostur-orange/20 bg-nostur-orange/8 px-3 py-2">
              <div className="flex items-start gap-2">
                <Share size={15} className="mt-0.5 shrink-0 text-nostur-orange" />

                <div className="text-[11px] font-medium leading-snug text-[#475569]">
                  En iPhone: tocá <strong>Compartir</strong> y después{" "}
                  <strong>Agregar a pantalla de inicio</strong>.
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-3 rounded-2xl border border-black/10 bg-[#f8fafc] px-3 py-2">
              <div className="flex items-start gap-2">
                <Smartphone size={15} className="mt-0.5 shrink-0 text-[#64748b]" />

                <div className="text-[11px] font-medium leading-snug text-[#64748b]">
                  {isChromeLikeBrowser()
                    ? "Si no aparece el botón, abrí el menú del navegador y elegí Instalar app o Agregar a pantalla principal."
                    : "Abrí el menú del navegador y elegí Agregar a pantalla principal."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export default MobilePwaInstallBanner;