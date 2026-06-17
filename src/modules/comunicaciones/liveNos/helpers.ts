/* =========================================================
   NOSSIX / NOSTUR — LiveNos helpers
========================================================= */

import type {
  ContactoWa,
  Conversacion,
  ConversationVM,
  InboxKey,
  Mensaje,
  MessageRole,
  ProfileLite
} from "./types";

export function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

export function getDisplayName(contacto?: ContactoWa | null, conv?: Conversacion | null): string {
  return (
    contacto?.display_name ||
    contacto?.profile_name ||
    conv?.titulo ||
    conv?.subject ||
    conv?.wa_phone ||
    "Pasajero"
  );
}

export function getInitials(value: string): string {
  const clean = value.trim();

  if (!clean) return "P";

  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function getVendedorName(profile?: ProfileLite | null): string {
  if (!profile) return "Sin asignar";
  return `${profile.nombre} ${profile.apellido}`.trim();
}

export function getMessageSenderName(message: Mensaje, profiles: ProfileLite[]): string {
  const profile = profiles.find((item) => item.id === message.sender_profile_id);

  if (!profile) return "NOSSIX";

  return profile.nombre_publico_whatsapp || getVendedorName(profile);
}

export function cleanDato(value: unknown): string {
  if (value === null || value === undefined) return "";

  if (typeof value === "string") return value.trim();

  if (typeof value === "number" && Number.isFinite(value)) return String(value);

  if (typeof value === "boolean") return value ? "Sí" : "No";

  return "";
}

export function getDato(datos: Record<string, unknown> | null | undefined, key: string): string {
  const value = cleanDato(datos?.[key]);
  return value || "—";
}

export function getDatoFromKeys(
  datos: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = "—"
): string {
  if (!datos) return fallback;

  for (const key of keys) {
    const value = cleanDato(datos[key]);
    if (value) return value;
  }

  return fallback;
}

export function normalizePhoneForLiveNos(value: string): string {
  let phone = String(value || "").trim();

  phone = phone.replace(/[^\d+]/g, "");

  if (!phone) return "";

  if (phone.startsWith("+")) return phone.replace("+", "");

  if (phone.startsWith("549")) return phone;

  if (phone.startsWith("54")) {
    const rest = phone.slice(2);
    return rest.startsWith("9") ? phone : `549${rest}`;
  }

  if (phone.startsWith("9")) return `54${phone}`;

  return `549${phone}`;
}

export function normalizePhoneWithPlus(value: string): string {
  const digits = normalizePhoneForLiveNos(value);
  return digits ? `+${digits}` : "";
}

export function isWindowOpen(conv?: Conversacion | null): boolean {
  const value = conv?.whatsapp_24h_expires_at || conv?.window_expires_at;

  if (!value) return false;

  return new Date(value).getTime() > Date.now();
}

export function getWindowRemainingLabel(conv?: Conversacion | null): string {
  const value = conv?.whatsapp_24h_expires_at || conv?.window_expires_at;

  if (!value) return "Ventana cerrada";

  const diff = new Date(value).getTime() - Date.now();

  if (diff <= 0) return "Ventana cerrada";

  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);

  if (hours <= 0) return `Ventana 24h · vence en ${minutes}m`;

  return `Ventana 24h · vence en ${hours}h`;
}

export function filterByInbox(conv: ConversationVM, inbox: InboxKey): boolean {
  if (inbox === "eliminadas") return Boolean(conv.deleted_at);
  if (inbox === "archivadas") return Boolean(conv.archived_at) && !conv.deleted_at;
  if (inbox === "cerradas") return Boolean(conv.closed_at) && !conv.deleted_at;

  if (conv.deleted_at || conv.archived_at || conv.closed_at) return false;

  if (inbox === "sin_atender") {
    return !conv.assigned_to || conv.estado_gestion === "sin_atender" || conv.inbox === "sin_atender";
  }

  if (inbox === "en_gestion") {
    return (
      Boolean(conv.assigned_to) ||
      conv.estado_gestion === "en_gestion" ||
      conv.inbox === "vendedor"
    );
  }

  if (inbox === "cande") {
    return Boolean(conv.oportunidad?.cande_activa);
  }

  if (inbox === "colaboracion") {
    return (
      conv.inbox === "colaboracion" ||
      conv.estado_gestion === "colaboracion" ||
      Boolean(conv.colaboradores && conv.colaboradores.length > 0)
    );
  }

  return true;
}

export function getMessageRole(message: Mensaje): MessageRole {
  const sender = String(message.sender_kind || "").toLowerCase();
  const type = String(message.type || "").toLowerCase();

  if (sender === "cande") return "cande";
  if (sender === "nia") return "nia";
  if (sender === "sistema" || type === "system") return "system";

  if (message.direction === "in" || message.direction === "inbound") return "passenger";

  return "agent";
}

export function getMessageMediaUrl(message: Mensaje): string | null {
  const media = message.media || {};

  const url = String(
    media.url ||
      media.media_url ||
      media.publicUrl ||
      media.public_url ||
      media.download_url ||
      ""
  ).trim();

  return url || null;
}

export function getMessageMediaName(message: Mensaje): string {
  const media = message.media || {};

  return (
    String(media.filename || "").trim() ||
    String(media.name || "").trim() ||
    String(media.media_filename || "").trim() ||
    String(media.original_name || "").trim() ||
    "archivo"
  );
}

export function getMessageMediaMime(message: Mensaje): string {
  const media = message.media || {};

  return String(
    media.mime_type ||
      media.mimeType ||
      media.media_mime_type ||
      media.content_type ||
      ""
  ).trim();
}

export function getMessageMediaSize(message: Mensaje): number | null {
  const media = message.media || {};
  const raw = media.size || media.media_size || media.file_size;

  const parsed = Number(raw);

  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function formatFileSize(size?: number | null): string {
  if (!size) return "";

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export function isImageMessage(message: Mensaje): boolean {
  const mime = getMessageMediaMime(message).toLowerCase();
  const type = String(message.type || "").toLowerCase();

  return type === "image" || mime.startsWith("image/");
}

export function isAudioMessage(message: Mensaje): boolean {
  const mime = getMessageMediaMime(message).toLowerCase();
  const type = String(message.type || "").toLowerCase();

  return type === "audio" || mime.startsWith("audio/");
}

export function getRecorderMimeType(): string {
  if (typeof MediaRecorder === "undefined") return "";

  const candidates = ["audio/ogg;codecs=opus", "audio/ogg"];

  return candidates.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

export function getAudioExtension(mimeType: string): string {
  const clean = mimeType.toLowerCase();

  if (clean.includes("ogg")) return "ogg";
  if (clean.includes("mpeg") || clean.includes("mp3")) return "mp3";
  if (clean.includes("mp4") || clean.includes("m4a") || clean.includes("aac")) return "m4a";
  if (clean.includes("amr")) return "amr";

  return "ogg";
}

export function getCleanAudioMimeForMeta(mimeType: string): string {
  const clean = mimeType.toLowerCase();

  if (clean.includes("ogg")) return "audio/ogg";
  if (clean.includes("mpeg") || clean.includes("mp3")) return "audio/mpeg";
  if (clean.includes("mp4") || clean.includes("m4a")) return "audio/mp4";
  if (clean.includes("aac")) return "audio/aac";
  if (clean.includes("amr")) return "audio/amr";

  return "audio/ogg";
}

export function canSendAsWhatsappAudio(mimeType: string): boolean {
  const clean = mimeType.toLowerCase();

  return (
    clean.includes("ogg") ||
    clean.includes("mpeg") ||
    clean.includes("mp3") ||
    clean.includes("mp4") ||
    clean.includes("m4a") ||
    clean.includes("aac") ||
    clean.includes("amr")
  ) && !clean.includes("webm");
}

export function getScoreLabel(score: number): string {
  if (score >= 75) return "Caliente";
  if (score >= 45) return "Tibia";
  return "Fría";
}