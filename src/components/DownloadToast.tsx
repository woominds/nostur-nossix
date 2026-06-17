// src/components/DownloadToast.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Loader2,
  X,
  XCircle
} from "lucide-react";
import { upsertDownloadHistoryItem } from "../lib/downloads";

type DownloadPayload = {
  filename?: string;
  path?: string;
  folder?: string;
  partitionName?: string;
  state?: string;
  originalState?: string;
  receivedBytes?: number;
  totalBytes?: number;
  fileExists?: boolean;
  fileSize?: number;
  error?: string;
};

type DownloadStatus = "downloading" | "completed" | "error";

type DownloadToastState = {
  filename: string;
  path: string;
  folder: string;
  partitionName: string;
  state: string;
  originalState: string;
  receivedBytes: number;
  totalBytes: number;
  fileExists: boolean;
  fileSize: number;
  status: DownloadStatus;
  message: string;
};

function getPercent(receivedBytes: number, totalBytes: number): number {
  if (!totalBytes || totalBytes <= 0) return 0;
  return Math.min(100, Math.max(0, Math.round((receivedBytes / totalBytes) * 100)));
}

function formatBytes(value: number): string {
  if (!value || value <= 0) return "";

  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;

  return `${(value / 1024 / 1024).toFixed(2)} MB`;
}

function buildToastState(payload: DownloadPayload, status: DownloadStatus): DownloadToastState {
  const filename = String(payload.filename || "Archivo descargado");
  const filePath = String(payload.path || "");
  const folder = String(payload.folder || "");
  const partitionName = String(payload.partitionName || "");
  const state = String(payload.state || "");
  const originalState = String(payload.originalState || "");
  const receivedBytes = Number(payload.receivedBytes || 0);
  const totalBytes = Number(payload.totalBytes || 0);
  const fileExists = Boolean(payload.fileExists);
  const fileSize = Number(payload.fileSize || receivedBytes || 0);

  let message = "Descarga procesada por NOSTUR.";

  if (status === "downloading") {
    const percent = getPercent(receivedBytes, totalBytes);
    message = totalBytes > 0 ? `Descargando... ${percent}%` : "Descargando archivo...";
  }

  if (status === "completed") {
    message = folder ? `Guardado en: ${folder}` : "Archivo descargado correctamente.";
  }

  if (status === "error") {
    message = payload.error || "No se pudo completar la descarga.";
  }

  return {
    filename,
    path: filePath,
    folder,
    partitionName,
    state,
    originalState,
    receivedBytes,
    totalBytes,
    fileExists,
    fileSize,
    status,
    message
  };
}

function saveDownloadToHistory(toast: DownloadToastState) {
  upsertDownloadHistoryItem({
    filename: toast.filename,
    path: toast.path,
    folder: toast.folder,
    partitionName: toast.partitionName,
    state: toast.state,
    originalState: toast.originalState,
    receivedBytes: toast.receivedBytes,
    totalBytes: toast.totalBytes,
    fileExists: toast.fileExists,
    fileSize: toast.fileSize
  });
}

export function DownloadToast() {
  const [toast, setToast] = useState<DownloadToastState | null>(null);
  const hideTimerRef = useRef<number | null>(null);

  const percent = useMemo(() => {
    if (!toast) return 0;
    return getPercent(toast.receivedBytes, toast.totalBytes);
  }, [toast]);

  function clearHideTimer() {
    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }

  function scheduleAutoHide(ms = 9000) {
    clearHideTimer();

    hideTimerRef.current = window.setTimeout(() => {
      setToast(null);
      hideTimerRef.current = null;
    }, ms);
  }

  useEffect(() => {
    const offStarted = window.nostur?.onDownloadStarted?.((payload: DownloadPayload) => {
      clearHideTimer();

      const nextToast = buildToastState(payload, "downloading");
      setToast(nextToast);

      saveDownloadToHistory(nextToast);
    });

    const offUpdated = window.nostur?.onDownloadUpdated?.((payload: DownloadPayload) => {
      setToast((current) => {
        if (!current && !payload?.filename) return null;

        const nextToast = buildToastState(
          {
            filename: payload.filename || current?.filename,
            path: payload.path || current?.path,
            folder: payload.folder || current?.folder,
            partitionName: payload.partitionName || current?.partitionName,
            state: payload.state || current?.state,
            originalState: payload.originalState || current?.originalState,
            receivedBytes: payload.receivedBytes ?? current?.receivedBytes,
            totalBytes: payload.totalBytes ?? current?.totalBytes,
            fileExists: payload.fileExists ?? current?.fileExists,
            fileSize: payload.fileSize ?? current?.fileSize
          },
          "downloading"
        );

        saveDownloadToHistory(nextToast);

        return nextToast;
      });
    });

    const offDone = window.nostur?.onDownloadDone?.((payload: DownloadPayload) => {
      const finalState = String(payload?.state || "").toLowerCase();

      const downloadedOk =
        finalState === "completed" ||
        finalState === "complete" ||
        finalState === "success" ||
        payload?.fileExists === true;

      const nextToast = buildToastState(payload || {}, downloadedOk ? "completed" : "error");

      setToast(nextToast);
      saveDownloadToHistory(nextToast);

      if (downloadedOk) {
        scheduleAutoHide(12000);
      }
    });

    return () => {
      clearHideTimer();
      offStarted?.();
      offUpdated?.();
      offDone?.();
    };
  }, []);

  if (!toast) return null;

  const isDownloading = toast.status === "downloading";
  const isCompleted = toast.status === "completed";
  const isError = toast.status === "error";

  return (
    <div className="pointer-events-none fixed right-6 top-[86px] z-[9999] w-[min(520px,calc(100vw-32px))]">
      <div
        className={[
          "pointer-events-auto overflow-hidden rounded-[30px] border p-5 shadow-2xl backdrop-blur-xl",
          isCompleted
            ? "border-emerald-200 bg-emerald-50/95 text-emerald-950"
            : isError
              ? "border-red-200 bg-red-50/95 text-red-950"
              : "border-[#4f7c90]/20 bg-white/95 text-[#142033]"
        ].join(" ")}
      >
        <div className="flex items-start gap-4">
          <div
            className={[
              "flex h-14 w-14 shrink-0 items-center justify-center rounded-[22px] bg-white shadow-sm ring-1 ring-black/5",
              isCompleted ? "text-emerald-700" : isError ? "text-red-700" : "text-[#4f7c90]"
            ].join(" ")}
          >
            {isDownloading ? (
              <Loader2 size={25} className="animate-spin" />
            ) : isCompleted ? (
              <CheckCircle2 size={25} />
            ) : isError ? (
              <XCircle size={25} />
            ) : (
              <Download size={25} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3
                  className={[
                    "text-lg font-black leading-tight",
                    isCompleted ? "text-emerald-800" : isError ? "text-red-800" : "text-[#142033]"
                  ].join(" ")}
                >
                  {isDownloading ? "Descargando archivo" : isCompleted ? "Descarga lista" : "Error de descarga"}
                </h3>

                <div
                  className={[
                    "mt-1 truncate text-sm font-black",
                    isCompleted ? "text-emerald-700" : isError ? "text-red-700" : "text-[#475569]"
                  ].join(" ")}
                  title={toast.filename}
                >
                  {toast.filename}
                </div>

                <div
                  className={[
                    "mt-1 text-xs font-bold leading-relaxed",
                    isCompleted ? "text-emerald-700" : isError ? "text-red-700" : "text-[#64748b]"
                  ].join(" ")}
                >
                  {toast.message}
                </div>
              </div>

              <button
                type="button"
                onClick={() => setToast(null)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/75 text-[#142033] hover:bg-white"
                title="Cerrar aviso"
              >
                <X size={18} />
              </button>
            </div>

            {isDownloading ? (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
                  <div
                    className="h-full rounded-full bg-[#4f7c90] transition-all"
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-[11px] font-black text-[#64748b]">
                  <span>{percent > 0 ? `${percent}%` : "Procesando..."}</span>
                  <span>
                    {formatBytes(toast.receivedBytes)}
                    {toast.totalBytes > 0 ? ` / ${formatBytes(toast.totalBytes)}` : ""}
                  </span>
                </div>
              </div>
            ) : null}

            {isCompleted ? (
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (toast.path) {
                      void window.nostur.openDownloadedFile(toast.path);
                    }
                  }}
                  disabled={!toast.path}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-emerald-700 px-4 text-xs font-black text-white shadow-sm hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <ExternalLink size={15} />
                  Abrir archivo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    if (toast.path) {
                      void window.nostur.showDownloadedFile(toast.path);
                    }
                  }}
                  disabled={!toast.path}
                  className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-emerald-800 shadow-sm ring-1 ring-emerald-200 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <FolderOpen size={15} />
                  Mostrar en carpeta
                </button>
              </div>
            ) : null}

            {isError ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {toast.path ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        void window.nostur.openDownloadedFile(toast.path);
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-red-800 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
                    >
                      <ExternalLink size={15} />
                      Probar abrir
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        void window.nostur.showDownloadedFile(toast.path);
                      }}
                      className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-red-800 shadow-sm ring-1 ring-red-200 hover:bg-red-50"
                    >
                      <FolderOpen size={15} />
                      Ver carpeta
                    </button>
                  </>
                ) : null}

                <button
                  type="button"
                  onClick={() => setToast(null)}
                  className="h-10 rounded-2xl bg-white px-4 text-xs font-black text-[#142033] shadow-sm hover:bg-[#f8fafc]"
                >
                  Cerrar
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}