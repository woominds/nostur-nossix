// src/components/updates/NosturUpdateBanner.tsx

import { useEffect, useRef, useState } from "react";
import { DownloadCloud, Loader2, RefreshCcw, X } from "lucide-react";

type UpdateEventPayload = {
  type: string;
  payload?: {
    currentVersion?: string;
    nextVersion?: string | null;
    percent?: number;
    message?: string;
    feedUrl?: string;
    info?: {
      version?: string;
    } | null;
  };
  createdAt?: string;
};

type UpdateStatus = {
  ok: boolean;
  isDev: boolean;
  platform: string;
  currentVersion: string;
  feedUrl: string;
  updateCheckInProgress: boolean;
  updateDownloaded: boolean;
  updateInfo?: {
    version?: string;
  } | null;
};

type NosturUpdateApi = {
  checkForUpdates?: () => Promise<unknown>;
  installUpdate?: () => Promise<{
    ok: boolean;
    reason?: string;
    error?: string;
  }>;
  getUpdateStatus?: () => Promise<UpdateStatus>;
  onUpdateEvent?: (callback: (payload: UpdateEventPayload) => void) => () => void;
};

function getNosturUpdateApi(): NosturUpdateApi | null {
  const api = (window as unknown as { nostur?: NosturUpdateApi }).nostur;

  return api || null;
}

function getUpdateDismissKey(version?: string | null) {
  return `nostur:update-banner-dismissed:${version || "unknown"}`;
}

export function NosturUpdateBanner() {
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<
    "idle" | "checking" | "available" | "downloading" | "downloaded" | "installing" | "error"
  >("idle");

  const [currentVersion, setCurrentVersion] = useState("");
  const [nextVersion, setNextVersion] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [installing, setInstalling] = useState(false);
  const [sessionHidden, setSessionHidden] = useState(false);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  const checkingTimeoutRef = useRef<number | null>(null);

  function clearCheckingTimeout() {
    if (checkingTimeoutRef.current) {
      window.clearTimeout(checkingTimeoutRef.current);
      checkingTimeoutRef.current = null;
    }
  }

  function getEffectiveNextVersion(value?: string | null) {
    return value || nextVersion || currentVersion || "unknown";
  }

  function wasVersionDismissed(version?: string | null) {
    return localStorage.getItem(getUpdateDismissKey(getEffectiveNextVersion(version))) === "1";
  }

  function showUpdateBanner(nextStatus?: typeof status, version?: string | null) {
    const effectiveStatus = nextStatus || status;
    const effectiveVersion = getEffectiveNextVersion(version);

    if (
      effectiveStatus === "available" &&
      localStorage.getItem(getUpdateDismissKey(effectiveVersion)) === "1"
    ) {
      setVisible(false);
      setDismissedVersion(effectiveVersion);
      return;
    }

    setSessionHidden(false);
    setVisible(true);
  }

  function startCheckingTimeout() {
    clearCheckingTimeout();

    checkingTimeoutRef.current = window.setTimeout(() => {
      setStatus((current) => {
        if (current !== "checking") return current;

        setVisible(true);
        setSessionHidden(false);
        setMessage("No se pudo verificar ahora. Intentá nuevamente.");
        return "error";
      });

      checkingTimeoutRef.current = null;
    }, 15000);
  }

  function hideBanner() {
    clearCheckingTimeout();
    setVisible(false);
    setSessionHidden(true);

    if (status === "checking") {
      setStatus("idle");
      setMessage("");
    }
  }

  function dismissCurrentVersion() {
    const version = getEffectiveNextVersion();
    localStorage.setItem(getUpdateDismissKey(version), "1");
    setDismissedVersion(version);
    setVisible(false);
    setSessionHidden(true);
  }

  useEffect(() => {
    let mounted = true;
    const api = getNosturUpdateApi();

    async function loadInitialStatus() {
      try {
        if (!api?.getUpdateStatus) return;

        const updateStatus = await api.getUpdateStatus();

        if (!mounted || !updateStatus?.ok) return;

        const initialCurrentVersion = updateStatus.currentVersion || "";
        const initialNextVersion = updateStatus.updateInfo?.version || null;

        setCurrentVersion(initialCurrentVersion);
        setNextVersion(initialNextVersion);

        if (updateStatus.updateDownloaded) {
          setVisible(true);
          setSessionHidden(false);
          setStatus("downloaded");
          setMessage("La actualización ya está descargada. Reiniciá NOSTUR para instalarla.");
          return;
        }

        if (updateStatus.updateCheckInProgress) {
          setVisible(true);
          setSessionHidden(false);
          setStatus("checking");
          setMessage("Buscando actualizaciones...");
          startCheckingTimeout();
          return;
        }
      } catch (error) {
        console.error("[NOSTUR UPDATE] No se pudo leer estado inicial:", error);
      }
    }

    const unsubscribe = api?.onUpdateEvent?.((event) => {
      const payload = event?.payload || {};

      if (payload.currentVersion) {
        setCurrentVersion(String(payload.currentVersion));
      }

      const payloadNextVersion =
        payload.nextVersion ||
        payload.info?.version ||
        null;

      if (payloadNextVersion) {
        setNextVersion(String(payloadNextVersion));
      }

      if (event.type === "checking-for-update") {
        setStatus("checking");
        setMessage("Buscando actualizaciones...");

        if (!sessionHidden) {
          setVisible(true);
        }

        startCheckingTimeout();
      }

      if (event.type === "update-available") {
        clearCheckingTimeout();

        const version = payloadNextVersion || nextVersion || null;

        setNextVersion(version);
        setStatus("available");
        setMessage(
          version
            ? `Hay una nueva versión disponible: ${version}.`
            : "Hay una nueva versión disponible."
        );

        if (wasVersionDismissed(version)) {
          setVisible(false);
          setDismissedVersion(getEffectiveNextVersion(version));
        } else {
          showUpdateBanner("available", version);
        }
      }

      if (event.type === "download-progress") {
        clearCheckingTimeout();
        const percent = Number(payload.percent || 0);

        setStatus("downloading");
        setProgress(percent);
        setMessage(`Descargando actualización... ${Math.round(percent)}%`);
        setSessionHidden(false);
        setVisible(true);
      }

      if (event.type === "update-downloaded") {
        clearCheckingTimeout();

        const version = payloadNextVersion || nextVersion || null;

        setNextVersion(version);
        setStatus("downloaded");
        setProgress(100);
        setMessage("Actualización descargada. Reiniciá NOSTUR para instalarla.");
        setSessionHidden(false);
        setVisible(true);
      }

      if (event.type === "installing-update") {
        clearCheckingTimeout();
        setVisible(true);
        setSessionHidden(false);
        setStatus("installing");
        setInstalling(true);
        setMessage("Instalando actualización. NOSTUR se va a reiniciar...");
      }

      if (event.type === "error") {
        clearCheckingTimeout();
        setVisible(true);
        setSessionHidden(false);
        setStatus("error");
        setMessage(payload.message || "No se pudo completar la actualización.");
      }
    });

    void loadInitialStatus();

    return () => {
      mounted = false;
      clearCheckingTimeout();
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [sessionHidden, nextVersion]);

  async function handleCheckUpdates() {
    const api = getNosturUpdateApi();

    try {
      setVisible(true);
      setSessionHidden(false);
      setStatus("checking");
      setMessage("Buscando actualizaciones...");
      startCheckingTimeout();

      await api?.checkForUpdates?.();
    } catch (error) {
      clearCheckingTimeout();
      console.error("[NOSTUR UPDATE] Error buscando actualización:", error);
      setStatus("error");
      setMessage("No se pudo buscar actualización.");
    }
  }

  async function handleInstallUpdate() {
    const api = getNosturUpdateApi();

    if (installing) return;

    try {
      setInstalling(true);
      setStatus("installing");
      setMessage("Instalando actualización. NOSTUR se va a reiniciar...");

      const result = await api?.installUpdate?.();

      if (!result?.ok) {
        setInstalling(false);
        setStatus("error");
        setMessage(
          result?.reason === "update_not_downloaded"
            ? "La actualización todavía no está descargada."
            : result?.error || "No se pudo instalar la actualización."
        );
      }
    } catch (error) {
      console.error("[NOSTUR UPDATE] Error instalando actualización:", error);
      setInstalling(false);
      setStatus("error");
      setMessage("No se pudo instalar la actualización.");
    }
  }

  if (!visible) {
    return null;
  }

  const isChecking = status === "checking";
  const isAvailable = status === "available";
  const isDownloaded = status === "downloaded";
  const isDownloading = status === "downloading";
  const isInstalling = status === "installing";
  const isError = status === "error";
  const canDismissVersion = isAvailable && !isDownloaded && !isInstalling;

  return (
    <div className="fixed bottom-4 right-4 z-[9999] w-[360px] max-w-[calc(100vw-32px)] rounded-[18px] border border-black/10 bg-white/95 p-3 shadow-2xl shadow-black/20 backdrop-blur-xl">
      <div className="flex items-start gap-3">
        <div
          className={[
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] ring-1",
            isError
              ? "bg-red-50 text-red-700 ring-red-200"
              : isDownloaded
                ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                : "bg-[#fff1f7] text-[#c13b84] ring-[#ffd2e6]"
          ].join(" ")}
        >
          {isChecking || isDownloading || isInstalling ? (
            <Loader2 size={18} className="animate-spin" />
          ) : isDownloaded ? (
            <RefreshCcw size={18} />
          ) : (
            <DownloadCloud size={18} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold tracking-[-0.02em] text-[#172033]">
                Actualización NOSTUR
              </h3>

              <p className="mt-0.5 text-[11px] font-semibold leading-4 text-slate-500">
                {message || "Gestionando actualización..."}
              </p>
            </div>

            {!isInstalling ? (
              <button
                type="button"
                onClick={hideBanner}
                className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                title="Ocultar por ahora"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>

          {nextVersion || currentVersion ? (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-slate-500">
              {currentVersion ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 ring-1 ring-black/5">
                  Actual: {currentVersion}
                </span>
              ) : null}

              {nextVersion ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200">
                  Nueva: {nextVersion}
                </span>
              ) : null}
            </div>
          ) : null}

          {dismissedVersion && isAvailable ? (
            <div className="mt-2 text-[10px] font-medium text-slate-400">
              Podés volver a buscar actualizaciones manualmente desde este botón.
            </div>
          ) : null}

          {isDownloading ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full bg-[#c13b84] transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, progress))}%`
                }}
              />
            </div>
          ) : null}

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            {canDismissVersion ? (
              <button
                type="button"
                onClick={dismissCurrentVersion}
                className="rounded-[11px] border border-black/10 bg-white px-3 py-2 text-[11px] font-bold text-slate-500 shadow-sm transition hover:bg-slate-50 hover:text-slate-700"
              >
                No mostrar esta versión
              </button>
            ) : null}

            {!isDownloaded && !isInstalling ? (
              <button
                type="button"
                onClick={handleCheckUpdates}
                disabled={isChecking}
                className="rounded-[11px] border border-black/10 bg-white px-3 py-2 text-[11px] font-bold text-[#172033] shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isChecking ? "Buscando..." : "Buscar update"}
              </button>
            ) : null}

            {isDownloaded ? (
              <button
                type="button"
                onClick={handleInstallUpdate}
                disabled={installing}
                className="rounded-[11px] bg-[#172033] px-3 py-2 text-[11px] font-bold text-white shadow-sm transition hover:bg-[#24314d] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {installing ? "Instalando..." : "Reiniciar e instalar"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}