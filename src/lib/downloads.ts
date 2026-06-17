/* =========================================================
   NOSSIX / NOSTUR — Historial local de descargas
========================================================= */

export type NosturDownloadState =
  | "started"
  | "progressing"
  | "completed"
  | "cancelled"
  | "interrupted"
  | "failed";

export type NosturDownloadHistoryItem = {
  id: string;
  filename: string;
  path: string;
  folder: string;
  partitionName?: string | null;
  state: NosturDownloadState | string;
  originalState?: string | null;
  receivedBytes?: number;
  totalBytes?: number;
  fileExists?: boolean;
  fileSize?: number;
  createdAt: string;
  updatedAt: string;
};

const STORAGE_KEY = "nostur_download_history";

function safeString(value: unknown): string {
  return String(value || "").trim();
}

function createId(payload: Partial<NosturDownloadHistoryItem>): string {
  const path = safeString(payload.path);
  const filename = safeString(payload.filename);
  const createdAt = safeString(payload.createdAt);

  return `${path || filename || "download"}-${createdAt || Date.now()}`;
}

export function getDownloadHistory(): NosturDownloadHistoryItem[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) return [];

    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter((item) => item && typeof item === "object")
      .map((item) => ({
        id: safeString(item.id) || createId(item),
        filename: safeString(item.filename) || "descarga",
        path: safeString(item.path),
        folder: safeString(item.folder),
        partitionName: safeString(item.partitionName) || null,
        state: safeString(item.state) || "completed",
        originalState: safeString(item.originalState) || null,
        receivedBytes: Number(item.receivedBytes || 0),
        totalBytes: Number(item.totalBytes || 0),
        fileExists: Boolean(item.fileExists),
        fileSize: Number(item.fileSize || item.receivedBytes || 0),
        createdAt: safeString(item.createdAt) || new Date().toISOString(),
        updatedAt: safeString(item.updatedAt) || safeString(item.createdAt) || new Date().toISOString()
      }))
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  } catch {
    return [];
  }
}

export function saveDownloadHistory(items: NosturDownloadHistoryItem[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, 300)));
}

export function upsertDownloadHistoryItem(
  payload: Partial<NosturDownloadHistoryItem>
): NosturDownloadHistoryItem {
  const now = new Date().toISOString();

  const current = getDownloadHistory();

  const path = safeString(payload.path);
  const filename = safeString(payload.filename);

  const existingIndex = current.findIndex((item) => {
    if (path && item.path === path) return true;
    if (!path && filename && item.filename === filename) return true;
    return false;
  });

  const existing = existingIndex >= 0 ? current[existingIndex] : null;

  const nextItem: NosturDownloadHistoryItem = {
    id: existing?.id || createId({ ...payload, createdAt: now }),
    filename: safeString(payload.filename) || existing?.filename || "descarga",
    path: path || existing?.path || "",
    folder: safeString(payload.folder) || existing?.folder || "",
    partitionName: safeString(payload.partitionName) || existing?.partitionName || null,
    state: safeString(payload.state) || existing?.state || "completed",
    originalState: safeString(payload.originalState) || existing?.originalState || null,
    receivedBytes: Number(payload.receivedBytes ?? existing?.receivedBytes ?? 0),
    totalBytes: Number(payload.totalBytes ?? existing?.totalBytes ?? 0),
    fileExists: Boolean(payload.fileExists ?? existing?.fileExists ?? false),
    fileSize: Number(payload.fileSize ?? existing?.fileSize ?? payload.receivedBytes ?? 0),
    createdAt: existing?.createdAt || now,
    updatedAt: now
  };

  const next = existingIndex >= 0 ? [...current] : [nextItem, ...current];

  if (existingIndex >= 0) {
    next[existingIndex] = nextItem;
  }

  saveDownloadHistory(next);

  window.dispatchEvent(
    new CustomEvent("nostur:download-history-updated", {
      detail: nextItem
    })
  );

  return nextItem;
}

export function removeDownloadHistoryItem(id: string) {
  const next = getDownloadHistory().filter((item) => item.id !== id);
  saveDownloadHistory(next);

  window.dispatchEvent(
    new CustomEvent("nostur:download-history-updated", {
      detail: null
    })
  );
}

export function clearDownloadHistory() {
  saveDownloadHistory([]);

  window.dispatchEvent(
    new CustomEvent("nostur:download-history-updated", {
      detail: null
    })
  );
}

export function getDownloadTipoArchivo(filename: string): string {
  const lower = filename.toLowerCase();

  if (lower.endsWith(".pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx")) return "word";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx") || lower.endsWith(".csv")) return "excel";
  if (
    lower.endsWith(".jpg") ||
    lower.endsWith(".jpeg") ||
    lower.endsWith(".png") ||
    lower.endsWith(".webp") ||
    lower.endsWith(".gif")
  ) {
    return "imagen";
  }

  if (lower.endsWith(".txt")) return "texto";

  return "otros";
}

export function getDownloadSourceLabel(partitionName?: string | null): string {
  const clean = safeString(partitionName).replace("persist:", "");

  const labels: Record<string, string> = {
    web: "Web",
    experts: "Experts",
    abaco: "Ábaco",
    krooze: "Krooze",
    liveconnect: "Live Connect",
    aivo: "Aivo",
    amadeus: "Amadeus",
    sabre: "Sabre",
    office: "Microsoft 365",
    chatgpt: "ChatGPT",
    crm: "CRM",
    internal: "NOSTUR"
  };

  return labels[clean] || clean || "NOSTUR";
}

export function formatDownloadDate(value?: string | null): string {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "—";
  }
}