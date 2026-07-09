// src/mobile/components/MobileChatsScreen.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RefObject } from "react";
import {
  ArrowLeft,
  Bot,
  CheckCheck,
  Clock3,
  FileText,
  Forward,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  RefreshCcw,
  Reply,
  Search,
  Send,
  Smile,
  Sparkles,
  Trash2,
  User,
  UserPlus,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { brandAssets, brandText } from "../../lib/brandAssets";
import type {
  ContactoWa,
  Conversacion,
  ConversacionColaborador,
  ConversationVM,
  Mensaje,
  ProfileLite
} from "../../modules/comunicaciones/liveNos/types";
import {
  formatDateTime,
  getDisplayName,
  getInitials,
  getMessageRole,
  getVendedorName,
  isWindowOpen
} from "../../modules/comunicaciones/liveNos/helpers";

type MobileProfile = ProfileLite & {
  rol?: string | null;
};

type NiaConversacion = {
  id: string;
  profile_id: string | null;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

type NiaMensaje = {
  id: string;
  conversacion_id: string | null;
  direction: string;
  text: string;
  created_at: string;
};

type MobileMensaje = Mensaje & {
  sender_kind?: string | null;
};

type MobileChatItem =
  | {
      kind: "nia";
      id: "nia";
      conversation: NiaConversacion | null;
    }
  | {
      kind: "conversation";
      id: string;
      conversation: ConversationVM;
    };

const NIA_EDGE_FUNCTION = "nia-internal-chat";
const NOTIFICATION_SOUND_URL = "/sounds/chat-new.mp3";

const MOBILE_CHAT_MEDIA_BUCKET = "livenos-media";
const QUICK_EMOJIS = ["😊", "👍", "🙏", "❤️", "😂", "😎", "🚀", "✅"];
const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

type MobileMediaPayload = {
  url?: string | null;
  public_url?: string | null;
  path?: string | null;
  filename?: string | null;
  mime_type?: string | null;
  content_type?: string | null;
  size_bytes?: number | null;
  caption?: string | null;
};

type WhatsAppSendPayload = {
  text: string;
  type?: string;
  media?: MobileMediaPayload | null;
  replyToId?: string | null;
  forwarded?: boolean;
};

function normalizeMessageType(type?: string | null, mime?: string | null) {
  const cleanType = String(type || "").toLowerCase();
  const cleanMime = String(mime || "").toLowerCase();

  if (cleanType === "image" || cleanMime.startsWith("image/")) return "image";
  if (cleanType === "audio" || cleanMime.startsWith("audio/")) return "audio";
  if (cleanType === "video" || cleanMime.startsWith("video/")) return "video";
  if (cleanType === "document" || cleanType === "file" || cleanMime) return "document";

  return cleanType || "text";
}

function cleanMimeType(mime?: string | null) {
  return String(mime || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

function getOutgoingFileMessageType(file: File) {
  const mime = cleanMimeType(file.type);
  const filename = String(file.name || "").toLowerCase();

  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";

  if (mime.startsWith("audio/")) {
    const isAcceptedWhatsappAudio =
      mime === "audio/mpeg" ||
      mime === "audio/mp3" ||
      mime === "audio/ogg" ||
      filename.endsWith(".mp3") ||
      filename.endsWith(".ogg");

    return isAcceptedWhatsappAudio ? "audio" : "document";
  }

  return "document";
}

function safeJsonParse(value: unknown): any {
  if (!value) return null;
  if (typeof value === "object") return value;
  if (typeof value !== "string") return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getMediaPayload(message: MobileMensaje): MobileMediaPayload | null {
  const raw = (message as any).media || (message as any).attachment || (message as any).file || null;
  const parsed = safeJsonParse(raw) || raw;

  if (!parsed) return null;

  if (typeof parsed === "string") {
    return {
      url: parsed,
      public_url: parsed,
      filename: parsed.split("/").pop() || "archivo"
    };
  }

  const media = parsed as MobileMediaPayload;
  const url = media.public_url || media.url || null;

  if (!url && !media.path) return null;

  return {
    ...media,
    url,
    public_url: url
  };
}

function getMessageDisplayText(message: MobileMensaje) {
  const text = String(message.text || "").trim();
  if (text) return text;

  const media = getMediaPayload(message);
  if (media?.filename) return media.filename;

  const type = normalizeMessageType(message.type, media?.mime_type || media?.content_type);
  if (type === "image") return "Imagen";
  if (type === "audio") return "Audio";
  if (type === "video") return "Video";
  if (type === "document") return "Archivo";

  return "Mensaje";
}

function getReplyPreview(message: MobileMensaje | null | undefined) {
  if (!message) return "Mensaje citado";
  const author = getMessageRole(message) === "passenger" ? "Cliente" : "NOSTUR";
  return `${author}: ${getMessageDisplayText(message)}`;
}

async function uploadMobileChatFile(file: File, conversationId: string): Promise<MobileMediaPayload> {
  const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `${conversationId}/${Date.now()}-${safeName || `archivo.${ext}`}`;
  const contentType = cleanMimeType(file.type) || "application/octet-stream";

  const uploadRes = await supabase.storage.from(MOBILE_CHAT_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType
  });

  if (uploadRes.error) {
    throw new Error(
      uploadRes.error.message ||
        `No se pudo subir el archivo al bucket ${MOBILE_CHAT_MEDIA_BUCKET}.`
    );
  }

  const publicRes = supabase.storage.from(MOBILE_CHAT_MEDIA_BUCKET).getPublicUrl(path);
  const publicUrl = publicRes.data.publicUrl;

  return {
    public_url: publicUrl,
    url: publicUrl,
    path,
    filename: file.name || path.split("/").pop() || "archivo",
    mime_type: contentType,
    content_type: contentType,
    size_bytes: file.size
  };
}

function canSeeAllConversations(profile: MobileProfile | null): boolean {
  const rol = String(profile?.rol || "").toLowerCase();

  return rol === "admin_general" || rol === "gerencia" || rol === "administracion";
}

function getConversationStateLabel(conv: ConversationVM): string {
  if (conv.deleted_at) return "Eliminada";
  if (conv.archived_at) return "Archivada";
  if (conv.closed_at) return "Cerrada";
  if (conv.oportunidad?.cande_activa) return "CANDE";
  if (!conv.assigned_to || conv.estado_gestion === "sin_atender") return "Sin atender";
  if (conv.colaboradores && conv.colaboradores.length > 0) return "Colaboración";

  return "En gestión";
}

function getConversationStateClass(conv: ConversationVM): string {
  const label = getConversationStateLabel(conv);

  if (label === "CANDE") return "bg-purple-100 text-purple-700";
  if (label === "Sin atender") return "bg-amber-100 text-amber-700";
  if (label === "Cerrada") return "bg-slate-100 text-slate-600";
  if (label === "Archivada" || label === "Eliminada") return "bg-slate-100 text-slate-500";
  if (label === "Colaboración") return "bg-blue-100 text-blue-700";

  return "bg-emerald-100 text-emerald-700";
}

function isInternalMessage(message: MobileMensaje): boolean {
  const direction = String(message.direction || "").toLowerCase();
  const senderKind = String(message.sender_kind || "").toLowerCase();

  return Boolean(
    direction === "internal" ||
      direction === "interno" ||
      senderKind === "interno" ||
      senderKind === "internal" ||
      senderKind === "nota_interna"
  );
}

function getMessageStatusIcon(message: MobileMensaje) {
  if (isInternalMessage(message)) return null;

  const status = String(message.status || "").toLowerCase();

  if (status === "pending") {
    return <Clock3 size={11} className="text-white/65" />;
  }

  if (status === "read") {
    return <CheckCheck size={13} className="text-sky-300" />;
  }

  if (status === "delivered" || status === "sent") {
    return <CheckCheck size={13} className="text-white/75" />;
  }

  return null;
}

function getWhatsappBubbleClass(message: MobileMensaje): string {
  if (isInternalMessage(message)) {
    return "self-center border border-amber-200 bg-amber-50 text-amber-900";
  }

  const role = getMessageRole(message);

  if (role === "passenger") {
    return "self-start rounded-bl-md bg-white text-[#111827]";
  }

  if (role === "cande") {
    return "self-end rounded-br-md bg-gradient-to-br from-purple-600 to-fuchsia-600 text-white";
  }

  if (role === "nia") {
    return "self-end rounded-br-md bg-gradient-to-br from-[#ff2f76] to-purple-700 text-white";
  }

  if (role === "system") {
    return "self-center bg-amber-50 text-amber-800";
  }

  return "self-end rounded-br-md bg-[#172033] text-white";
}

function getNiaBubbleClass(message: NiaMensaje): string {
  const direction = String(message.direction || "").toLowerCase();

  if (direction === "assistant" || direction === "nia") {
    return "self-start rounded-bl-md bg-white text-[#111827]";
  }

  if (direction === "system") {
    return "self-center bg-amber-50 text-amber-800";
  }

  return "self-end rounded-br-md bg-gradient-to-br from-[#ff2f76] to-[#7c3aed] text-white";
}

function getNiaPreview(conversation: NiaConversacion | null): string {
  return (
    conversation?.last_message_preview ||
    "Hablá con NIA sobre oportunidades, demoras, seguimientos y próximos pasos."
  );
}

function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

    if (!AudioContextClass) {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.volume = 0.7;
      void audio.play().catch(() => {});
      return;
    }

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = 880;

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.22);

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.24);
  } catch {
    try {
      const audio = new Audio(NOTIFICATION_SOUND_URL);
      audio.volume = 0.7;
      void audio.play().catch(() => {});
    } catch {
      // No bloquear la app si el navegador no permite audio.
    }
  }
}

function showBrowserNotification(title: string, body: string) {
  if (!("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  try {
    new Notification(title, {
      body,
      icon: brandAssets.iconoColor,
      badge: brandAssets.iconoColor
    });
  } catch {
    // No bloquear la app si el navegador no permite mostrar notificación.
  }
}

async function activateMobileNotifications() {
  playNotificationSound();

  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    showBrowserNotification(brandText.appName, "Avisos activados correctamente.");
    return;
  }

  try {
    const permission = await Notification.requestPermission();

    if (permission === "granted") {
      showBrowserNotification(brandText.appName, "Avisos activados correctamente.");
    }
  } catch {
    // No bloquear la app si el navegador no permite solicitar permisos.
  }
}

function NiaChatRow({
  conversation,
  active,
  onClick
}: {
  conversation: NiaConversacion | null;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-[22px] border p-3 text-left shadow-sm transition active:scale-[0.99]",
        active
          ? "border-purple-300 bg-purple-50"
          : "border-black/10 bg-white/84 backdrop-blur-xl hover:border-purple-200 hover:bg-purple-50/70"
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-gradient-to-br from-[#ff2f76] to-[#7c3aed] text-white shadow-lg shadow-purple-500/20">
          <Sparkles size={19} strokeWidth={2} />

          <span className="absolute -right-0.5 -top-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />

          {conversation && conversation.unread_count > 0 ? (
            <span className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff2f76] px-1 text-[9px] font-semibold text-white">
              {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight text-[#111827]">
                NIA
              </div>

              <div className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.11em] text-purple-700">
                Asistente interno
              </div>
            </div>

            <div className="shrink-0 text-right text-[10px] font-medium text-[#94a3b8]">
              {conversation?.last_message_at
                ? formatDateTime(conversation.last_message_at)
                : "Fijo"}
            </div>
          </div>

          <div className="mt-1.5 line-clamp-1 text-[11px] font-normal leading-snug text-[#64748b]">
            {getNiaPreview(conversation)}
          </div>
        </div>
      </div>
    </button>
  );
}

function ConversationRow({
  conv,
  active,
  onClick
}: {
  conv: ConversationVM;
  active: boolean;
  onClick: () => void;
}) {
  const name = getDisplayName(conv.contacto, conv);
  const vendedor = getVendedorName(conv.vendedor);
  const stateLabel = getConversationStateLabel(conv);
  const stateClass = getConversationStateClass(conv);

  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "w-full rounded-[22px] border p-3 text-left shadow-sm transition active:scale-[0.99]",
        active
          ? "border-[#172033] bg-white"
          : "border-black/10 bg-white/84 backdrop-blur-xl hover:border-[#172033]/20"
      ].join(" ")}
    >
      <div className="flex items-center gap-2.5">
        <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[17px] bg-emerald-50 text-emerald-700">
          <MessageCircle size={20} strokeWidth={2} />

          {conv.unread_count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff2f76] px-1 text-[9px] font-semibold text-white">
              {conv.unread_count > 9 ? "9+" : conv.unread_count}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[15px] font-semibold leading-tight text-[#111827]">
                {name}
              </div>

              <div className="mt-0.5 truncate text-[11px] font-normal leading-tight text-[#94a3b8]">
                {conv.wa_phone || "Sin teléfono"}
              </div>
            </div>

            <div className="shrink-0 text-right text-[10px] font-medium text-[#94a3b8]">
              {formatDateTime(conv.last_message_at || conv.updated_at)}
            </div>
          </div>

          <div className="mt-1.5 line-clamp-1 text-[11px] font-normal leading-snug text-[#64748b]">
            {conv.last_message_preview || "Sin mensajes todavía"}
          </div>

          <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1">
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                stateClass
              ].join(" ")}
            >
              {stateLabel}
            </span>

            <span className="rounded-full bg-[#eef2f7] px-2 py-0.5 text-[9px] font-semibold text-[#64748b]">
              {vendedor}
            </span>

            {isWindowOpen(conv) ? (
              <span className="rounded-full bg-green-100 px-2 py-0.5 text-[9px] font-semibold text-green-700">
                24h abierta
              </span>
            ) : (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-500">
                24h cerrada
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}


function MessageMedia({ message }: { message: MobileMensaje }) {
  const media = getMediaPayload(message);
  if (!media) return null;

  const url = media.public_url || media.url || "";
  const type = normalizeMessageType(message.type, media.mime_type || media.content_type);
  const filename = media.filename || "archivo";

  if (!url) return null;

  if (type === "image") {
    return (
      <a href={url} target="_blank" rel="noreferrer" className="mb-1 block overflow-hidden rounded-2xl bg-black/5">
        <img src={url} alt={filename} className="max-h-64 w-full object-cover" loading="lazy" />
      </a>
    );
  }

  if (type === "audio") {
    return (
      <div className="mb-1 rounded-2xl bg-black/5 p-2">
        <audio controls src={url} className="w-full" />
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mb-1 overflow-hidden rounded-2xl bg-black/5">
        <video controls src={url} className="max-h-64 w-full" />
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="mb-1 flex items-center gap-2 rounded-2xl bg-black/5 p-2 text-current underline decoration-current/30 underline-offset-2"
    >
      <FileText size={16} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold">{filename}</span>
    </a>
  );
}

function ReplyPreviewBubble({ message }: { message: MobileMensaje | null | undefined }) {
  if (!message) return null;

  return (
    <div className="mb-1.5 rounded-xl border-l-2 border-current/40 bg-black/5 px-2 py-1 text-[10px] font-medium leading-snug opacity-90">
      <div className="line-clamp-2 whitespace-pre-wrap break-words">{getReplyPreview(message)}</div>
    </div>
  );
}

function NiaDetail({
  messages,
  loadingMessages,
  sending,
  text,
  onTextChange,
  onBack,
  onSend
}: {
  messages: NiaMensaje[];
  loadingMessages: boolean;
  sending: boolean;
  text: string;
  onTextChange: (value: string) => void;
  onBack: () => void;
  onSend: () => void;
}) {
  const timelineRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    window.requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "auto"
      });
    });
  }, [messages.length]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#eef2f7]">
      <header className="flex h-[58px] shrink-0 items-center gap-2.5 border-b border-black/10 bg-white/90 px-3 shadow-sm backdrop-blur-xl">
        <button
          type="button"
          onClick={onBack}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
        >
          <ArrowLeft size={18} />
        </button>

        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff2f76] to-[#7c3aed] text-white">
          <Sparkles size={18} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-semibold leading-tight text-[#111827]">NIA</div>
          <div className="truncate text-[10.5px] font-normal leading-tight text-[#64748b]">
            Asistente interno comercial
          </div>
        </div>
      </header>

      <div
        ref={timelineRef}
        className="min-h-0 flex-1 space-y-2 overflow-auto bg-[radial-gradient(circle_at_10%_0%,rgba(124,58,237,0.12),transparent_32%),linear-gradient(180deg,#f5f3ff,#eef2f7)] p-3"
      >
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={22} className="animate-spin text-purple-700" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div className="rounded-[22px] border border-black/10 bg-white/90 p-4 shadow-sm">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-[18px] bg-purple-50 text-purple-700">
                <Bot size={24} />
              </div>

              <h2 className="text-[16px] font-semibold leading-tight text-[#111827]">
                Hablá con NIA
              </h2>

              <p className="mt-1.5 text-[12px] font-normal leading-snug text-[#64748b]">
                Podés pedirle resumen de oportunidades, próximos pasos, demoras, clientes sin
                atender o ayuda con una gestión comercial.
              </p>
            </div>
          </div>
        ) : (
          messages.map((message) => {
            const assistant =
              message.direction === "assistant" || message.direction === "nia";

            return (
              <article key={message.id} className="flex w-full flex-col">
                <div
                  className={[
                    "max-w-[84%] rounded-[18px] px-3 py-2 text-[12px] font-normal leading-snug shadow-sm",
                    getNiaBubbleClass(message)
                  ].join(" ")}
                >
                  {assistant ? (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-purple-700">
                      <Sparkles size={11} />
                      NIA
                    </div>
                  ) : null}

                  <div className="whitespace-pre-wrap break-words">{message.text}</div>

                  <div
                    className={[
                      "mt-1.5 text-[9px] font-medium",
                      assistant ? "text-[#94a3b8]" : "text-white/70"
                    ].join(" ")}
                  >
                    {formatDateTime(message.created_at)}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <footer className="shrink-0 border-t border-black/10 bg-white/95 p-2.5 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <input
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder="Escribile a NIA"
            className="h-10 min-w-0 flex-1 rounded-full border border-black/10 bg-[#f8fafc] px-4 text-[13px] font-medium text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-purple-500"
          />

          <button
            type="button"
            onClick={onSend}
            disabled={sending || !text.trim()}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#ff2f76] to-[#7c3aed] text-white shadow-sm disabled:opacity-50"
          >
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
          </button>
        </div>
      </footer>
    </div>
  );
}

function ConversationDetail({
  conversation,
  conversaciones,
  mensajes,
  loadingMessages,
  sending,
  joining,
  uploading,
  recording,
  pendingAudioPreviewUrl,
  canJoin,
  privateMode,
  text,
  replyingTo,
  forwardingMessage,
  activeMessageId,
  emojiPickerOpen,
  reactionTargetId,
  fileInputRef,
  onTextChange,
  onPrivateModeChange,
  onBack,
  onSend,
  onJoin,
  onPickFile,
  onFileSelected,
  onToggleRecording,
  onSendPendingAudio,
  onDiscardPendingAudio,
  onSetReplyingTo,
  onCancelReply,
  onStartForward,
  onCancelForward,
  onForwardToConversation,
  onDeleteMessage,
  onReactToMessage,
  onToggleEmojiPicker,
  onAddEmoji,
  onToggleMessageActions,
  onSetReactionTarget
}: {
  conversation: ConversationVM;
  conversaciones: ConversationVM[];
  mensajes: MobileMensaje[];
  loadingMessages: boolean;
  sending: boolean;
  joining: boolean;
  uploading: boolean;
  recording: boolean;
  pendingAudioPreviewUrl: string | null;
  canJoin: boolean;
  privateMode: boolean;
  text: string;
  replyingTo: MobileMensaje | null;
  forwardingMessage: MobileMensaje | null;
  activeMessageId: string | null;
  emojiPickerOpen: boolean;
  reactionTargetId: string | null;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onTextChange: (value: string) => void;
  onPrivateModeChange: (value: boolean) => void;
  onBack: () => void;
  onSend: () => void;
  onJoin: () => void;
  onPickFile: () => void;
  onFileSelected: (file: File) => void;
  onToggleRecording: () => void;
  onSendPendingAudio: () => void;
  onDiscardPendingAudio: () => void;
  onSetReplyingTo: (message: MobileMensaje) => void;
  onCancelReply: () => void;
  onStartForward: (message: MobileMensaje) => void;
  onCancelForward: () => void;
  onForwardToConversation: (conversationId: string) => void;
  onDeleteMessage: (message: MobileMensaje) => void;
  onReactToMessage: (message: MobileMensaje, emoji: string) => void;
  onToggleEmojiPicker: () => void;
  onAddEmoji: (emoji: string) => void;
  onToggleMessageActions: (messageId: string) => void;
  onSetReactionTarget: (messageId: string | null) => void;
}) {
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const name = getDisplayName(conversation.contacto, conversation);
  const initials = getInitials(name);
  const mensajesById = useMemo(() => {
    const map = new Map<string, MobileMensaje>();
    mensajes.forEach((message) => map.set(message.id, message));
    return map;
  }, [mensajes]);
  const forwardingTargets = useMemo(
    () => conversaciones.filter((item) => item.id !== conversation.id).slice(0, 12),
    [conversaciones, conversation.id]
  );

  useEffect(() => {
    const el = timelineRef.current;
    if (!el) return;

    window.requestAnimationFrame(() => {
      el.scrollTo({
        top: el.scrollHeight,
        behavior: "auto"
      });
    });
  }, [mensajes.length, conversation.id, loadingMessages]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#e8f0f2]">
      <header className="shrink-0 border-b border-black/10 bg-white/95 shadow-sm backdrop-blur-xl">
        <div className="flex h-[58px] items-center gap-2.5 px-3">
          <button
            type="button"
            onClick={onBack}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[#172033] text-[12px] font-semibold text-white">
            {initials}
          </div>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[14px] font-semibold leading-tight text-[#111827]">{name}</div>
            <div className="truncate text-[10.5px] font-normal leading-tight text-[#64748b]">
              {conversation.wa_phone} · {getConversationStateLabel(conversation)}
            </div>
          </div>

          {canJoin ? (
            <button
              type="button"
              onClick={onJoin}
              disabled={joining}
              className="flex h-8 shrink-0 items-center justify-center gap-1 rounded-2xl bg-[#172033] px-2.5 text-[10px] font-semibold text-white disabled:opacity-50"
            >
              {joining ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
              Unirme
            </button>
          ) : null}
        </div>
      </header>

      <div
        ref={timelineRef}
        className="min-h-0 flex-1 space-y-2 overflow-auto bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.09),transparent_32%),linear-gradient(180deg,#eef6f7,#e8f0f2)] p-3"
      >
        {loadingMessages ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 size={22} className="animate-spin text-[#172033]" />
          </div>
        ) : mensajes.length === 0 ? (
          <div className="flex h-full items-center justify-center px-4 text-center">
            <div className="rounded-[20px] bg-white/90 p-4 text-[12px] font-medium text-[#64748b] shadow-sm">
              No hay mensajes cargados para esta conversación.
            </div>
          </div>
        ) : (
          mensajes.map((message) => {
            const internal = isInternalMessage(message);
            const role = getMessageRole(message);
            const outbound = !internal && role !== "passenger" && role !== "system";
            const replyMessage = message.reply_to_id ? mensajesById.get(String(message.reply_to_id)) : null;
            const media = getMediaPayload(message);
            const reaction = (message as any).reaction || (message as any).reaction_emoji || null;

            return (
              <article key={message.id} className="flex w-full flex-col">
                <div
                  className={[
                    internal ? "max-w-[92%]" : "max-w-[82%]",
                    "relative rounded-[18px] px-3 py-2 text-[12px] font-normal leading-snug shadow-sm",
                    getWhatsappBubbleClass(message)
                  ].join(" ")}
                >
                  <button
                    type="button"
                    onClick={() => onToggleMessageActions(message.id)}
                    className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#64748b] shadow-sm ring-1 ring-black/10"
                    aria-label="Acciones del mensaje"
                  >
                    <MoreVertical size={13} />
                  </button>

                  {activeMessageId === message.id ? (
                    <div className="absolute right-0 top-7 z-20 min-w-[174px] overflow-hidden rounded-2xl border border-black/10 bg-white text-[#111827] shadow-xl">
                      <button
                        type="button"
                        onClick={() => onSetReplyingTo(message)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold hover:bg-[#f8fafc]"
                      >
                        <Reply size={14} />
                        Responder
                      </button>
                      <button
                        type="button"
                        onClick={() => onStartForward(message)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold hover:bg-[#f8fafc]"
                      >
                        <Forward size={14} />
                        Reenviar
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetReactionTarget(reactionTargetId === message.id ? null : message.id)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold hover:bg-[#f8fafc]"
                      >
                        <Smile size={14} />
                        Reaccionar
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteMessage(message)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-semibold text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={14} />
                        Eliminar
                      </button>
                    </div>
                  ) : null}

                  {reactionTargetId === message.id ? (
                    <div className="absolute right-0 top-7 z-30 flex gap-1 rounded-full border border-black/10 bg-white p-1 shadow-xl">
                      {QUICK_REACTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => onReactToMessage(message, emoji)}
                          className="flex h-8 w-8 items-center justify-center rounded-full text-[16px] hover:bg-[#f1f5f9]"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {internal ? (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-amber-800">
                      <User size={11} />
                      Mensaje privado
                    </div>
                  ) : null}

                  {role === "cande" && !internal ? (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-white/85">
                      <Sparkles size={11} />
                      CANDE
                    </div>
                  ) : null}

                  {role === "nia" && !internal ? (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold text-white/85">
                      <Sparkles size={11} />
                      NIA
                    </div>
                  ) : null}

                  {message.forwarded ? (
                    <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold opacity-75">
                      <Forward size={11} />
                      Reenviado
                    </div>
                  ) : null}

                  <ReplyPreviewBubble message={replyMessage} />
                  <MessageMedia message={message} />

                  {message.text || !media ? (
                    <div className="whitespace-pre-wrap break-words">
                      {message.text || `[${message.type}]`}
                    </div>
                  ) : null}

                  {reaction ? (
                    <div className="absolute -bottom-3 right-2 rounded-full bg-white px-1.5 py-0.5 text-[12px] shadow-sm ring-1 ring-black/10">
                      {String(reaction)}
                    </div>
                  ) : null}

                  <div
                    className={[
                      "mt-1.5 flex items-center gap-1 text-[9px] font-medium",
                      internal
                        ? "justify-start text-amber-700"
                        : outbound
                          ? "justify-end text-white/70"
                          : "justify-start text-[#94a3b8]"
                    ].join(" ")}
                  >
                    <span>{formatDateTime(message.wa_timestamp || message.created_at)}</span>
                    {outbound ? getMessageStatusIcon(message) : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <footer className="shrink-0 border-t border-black/10 bg-white/95 p-2.5 backdrop-blur-xl">
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,audio/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onFileSelected(file);
          }}
        />

        {forwardingMessage ? (
          <div className="mb-2 rounded-2xl border border-blue-200 bg-blue-50 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0 text-[11px] font-semibold text-blue-800">
                Reenviar: <span className="font-medium">{getMessageDisplayText(forwardingMessage)}</span>
              </div>
              <button type="button" onClick={onCancelForward} className="text-blue-700">
                <X size={14} />
              </button>
            </div>
            <div className="flex gap-1.5 overflow-x-auto pb-1">
              {forwardingTargets.map((target) => (
                <button
                  key={target.id}
                  type="button"
                  onClick={() => onForwardToConversation(target.id)}
                  className="max-w-[150px] shrink-0 rounded-full bg-white px-3 py-1.5 text-[11px] font-semibold text-[#172033] shadow-sm"
                >
                  <span className="block truncate">{getDisplayName(target.contacto, target)}</span>
                </button>
              ))}
              {forwardingTargets.length === 0 ? (
                <div className="text-[11px] font-medium text-blue-700">No hay otros chats visibles.</div>
              ) : null}
            </div>
          </div>
        ) : null}

        {replyingTo ? (
          <div className="mb-2 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2">
            <Reply size={14} className="shrink-0 text-emerald-700" />
            <div className="min-w-0 flex-1 truncate text-[11px] font-semibold text-emerald-800">
              {getReplyPreview(replyingTo)}
            </div>
            <button type="button" onClick={onCancelReply} className="text-emerald-700">
              <X size={14} />
            </button>
          </div>
        ) : null}

        {pendingAudioPreviewUrl ? (
          <div className="mb-2 rounded-2xl border border-[#172033]/10 bg-[#f8fafc] p-2 shadow-sm">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-[#172033]">
                <Mic size={14} className="shrink-0" />
                Audio grabado listo para enviar
              </div>
              <button
                type="button"
                onClick={onDiscardPendingAudio}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-[#64748b] shadow-sm"
                title="Descartar audio"
              >
                <X size={14} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <audio controls src={pendingAudioPreviewUrl} className="min-w-0 flex-1" />
              <button
                type="button"
                onClick={onSendPendingAudio}
                disabled={sending || uploading}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#172033] text-white shadow-sm disabled:opacity-50"
                title="Enviar audio"
              >
                {sending || uploading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
              </button>
            </div>
          </div>
        ) : null}

        {emojiPickerOpen ? (
          <div className="mb-2 flex gap-1 rounded-2xl border border-black/10 bg-white p-1.5 shadow-sm">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onAddEmoji(emoji)}
                className="flex h-8 w-8 items-center justify-center rounded-full text-[17px] hover:bg-[#f1f5f9]"
              >
                {emoji}
              </button>
            ))}
          </div>
        ) : null}

        <div className="mb-2 grid grid-cols-2 gap-2 rounded-2xl bg-[#f1f5f9] p-1">
          <button
            type="button"
            onClick={() => onPrivateModeChange(false)}
            className={[
              "h-8 rounded-xl text-[11px] font-semibold",
              !privateMode ? "bg-white text-[#172033] shadow-sm" : "text-[#64748b]"
            ].join(" ")}
          >
            Cliente
          </button>

          <button
            type="button"
            onClick={() => onPrivateModeChange(true)}
            className={[
              "h-8 rounded-xl text-[11px] font-semibold",
              privateMode ? "bg-amber-100 text-amber-800 shadow-sm" : "text-[#64748b]"
            ].join(" ")}
          >
            Privado
          </button>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={onPickFile}
            disabled={sending || uploading || privateMode}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b] disabled:opacity-40"
            title="Adjuntar archivo"
          >
            {uploading ? <Loader2 size={17} className="animate-spin" /> : <Paperclip size={17} />}
          </button>

          <button
            type="button"
            onClick={onToggleEmojiPicker}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f1f5f9] text-[#64748b]"
            title="Emoticones"
          >
            <Smile size={17} />
          </button>

          <input
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                onSend();
              }
            }}
            placeholder={privateMode ? "Mensaje privado interno" : "Escribí un mensaje"}
            className={[
              "h-10 min-w-0 flex-1 rounded-full border px-4 text-[13px] font-medium text-[#111827] outline-none placeholder:text-[#94a3b8]",
              privateMode
                ? "border-amber-200 bg-amber-50 focus:border-amber-400"
                : "border-black/10 bg-[#f8fafc] focus:border-[#172033]"
            ].join(" ")}
          />

          {!text.trim() && !pendingAudioPreviewUrl && !privateMode ? (
            <button
              type="button"
              onClick={onToggleRecording}
              disabled={sending || uploading}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-50",
                recording ? "bg-red-600" : "bg-[#172033]"
              ].join(" ")}
              title={recording ? "Detener audio" : "Grabar audio"}
            >
              {recording ? <Loader2 size={17} className="animate-spin" /> : <Mic size={17} />}
            </button>
          ) : (
            <button
              type="button"
              onClick={onSend}
              disabled={sending || uploading || (!text.trim() && !pendingAudioPreviewUrl)}
              className={[
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm disabled:opacity-50",
                privateMode ? "bg-amber-600" : "bg-[#172033]"
              ].join(" ")}
            >
              {sending || uploading ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

export function MobileChatsScreen() {
  const [loading, setLoading] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [joining, setJoining] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [pendingAudioFile, setPendingAudioFile] = useState<File | null>(null);
  const [pendingAudioPreviewUrl, setPendingAudioPreviewUrl] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<MobileProfile | null>(null);
  const currentUserIdRef = useRef<string | null>(null);

  const [search, setSearch] = useState("");
  const [conversations, setConversations] = useState<ConversationVM[]>([]);
  const [mensajes, setMensajes] = useState<MobileMensaje[]>([]);
  const [privateMessagesByConversation, setPrivateMessagesByConversation] = useState<
    Record<string, MobileMensaje[]>
  >({});

  const [niaConversation, setNiaConversation] = useState<NiaConversacion | null>(null);
  const [niaMessages, setNiaMessages] = useState<NiaMensaje[]>([]);

  const [selectedKind, setSelectedKind] = useState<"list" | "nia" | "conversation">("list");
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const [composerText, setComposerText] = useState("");
  const [privateMode, setPrivateMode] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MobileMensaje | null>(null);
  const [forwardingMessage, setForwardingMessage] = useState<MobileMensaje | null>(null);
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [reactionTargetId, setReactionTargetId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  function setPendingAudio(file: File) {
    setPendingAudioFile(file);
    setPendingAudioPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return URL.createObjectURL(file);
    });
  }

  function discardPendingAudio() {
    setPendingAudioFile(null);
    setPendingAudioPreviewUrl((currentUrl) => {
      if (currentUrl) {
        URL.revokeObjectURL(currentUrl);
      }

      return null;
    });
  }

  const selectedKindRef = useRef(selectedKind);
  const selectedConversationIdRef = useRef<string | null>(selectedConversationId);
  const niaConversationIdRef = useRef<string | null>(niaConversation?.id || null);
  const knownConversationMessageIdsRef = useRef<Set<string>>(new Set());
  const knownNiaMessageIdsRef = useRef<Set<string>>(new Set());
  const initializedRealtimeRef = useRef(false);

  const selectedConversation = useMemo(() => {
    if (!selectedConversationId) return null;
    return conversations.find((conv) => conv.id === selectedConversationId) || null;
  }, [conversations, selectedConversationId]);

  useEffect(() => {
    return () => {
      setPendingAudioPreviewUrl((currentUrl) => {
        if (currentUrl) {
          URL.revokeObjectURL(currentUrl);
        }

        return null;
      });
    };
  }, [selectedConversationId]);

  const visibleMensajes = useMemo(() => {
    if (!selectedConversationId) return mensajes;

    const privateMessages = privateMessagesByConversation[selectedConversationId] || [];
    const mergedMap = new Map<string, MobileMensaje>();

    mensajes.forEach((message) => {
      mergedMap.set(message.id, message);
    });

    privateMessages.forEach((message) => {
      mergedMap.set(message.id, message);
    });

    return Array.from(mergedMap.values()).sort((a, b) => {
      const aTime = new Date(a.wa_timestamp || a.created_at || "").getTime();
      const bTime = new Date(b.wa_timestamp || b.created_at || "").getTime();

      return aTime - bTime;
    });
  }, [mensajes, privateMessagesByConversation, selectedConversationId]);

  const currentUserCanJoinSelectedConversation = useMemo(() => {
    if (!selectedConversation) return false;

    const currentUserId = currentUserIdRef.current;
    if (!currentUserId) return false;

    if (selectedConversation.assigned_to === currentUserId) return false;

    const alreadyCollaborator = Boolean(
      selectedConversation.colaboradores?.some(
        (colaborador) => colaborador.profile_id === currentUserId
      )
    );

    return !alreadyCollaborator;
  }, [selectedConversation]);

  useEffect(() => {
    selectedKindRef.current = selectedKind;
  }, [selectedKind]);

  useEffect(() => {
    selectedConversationIdRef.current = selectedConversationId;
  }, [selectedConversationId]);

  useEffect(() => {
    niaConversationIdRef.current = niaConversation?.id || null;
  }, [niaConversation?.id]);

  async function getCurrentUserId() {
    const { data } = await supabase.auth.getUser();
    const id = data.user?.id || null;
    currentUserIdRef.current = id;
    return id;
  }

  const loadNiaConversation = useCallback(async () => {
    const currentUserId = await getCurrentUserId();

    if (!currentUserId) return null;

    const existingRes = await supabase
      .from("nia_conversaciones")
      .select("id,profile_id,unread_count,last_message_at,last_message_preview,created_at,updated_at")
      .eq("profile_id", currentUserId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRes.error) {
      setError(existingRes.error.message || "No se pudo cargar la conversación de NIA.");
      return null;
    }

    if (existingRes.data) {
      const existing = existingRes.data as NiaConversacion;
      setNiaConversation(existing);
      niaConversationIdRef.current = existing.id;
      return existing;
    }

    const now = new Date().toISOString();

    const insertRes = await supabase
      .from("nia_conversaciones")
      .insert({
        profile_id: currentUserId,
        unread_count: 0,
        last_message_at: now,
        last_message_preview: "Conversación iniciada con NIA.",
        created_at: now,
        updated_at: now
      })
      .select("id,profile_id,unread_count,last_message_at,last_message_preview,created_at,updated_at")
      .single();

    if (insertRes.error) {
      setError(insertRes.error.message || "No se pudo crear la conversación con NIA.");
      return null;
    }

    const created = insertRes.data as NiaConversacion;
    setNiaConversation(created);
    niaConversationIdRef.current = created.id;

    return created;
  }, []);

  const loadNiaMessages = useCallback(async (conversationId: string, options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoadingMessages(true);
    }

    setError(null);

    const messagesRes = await supabase
      .from("nia_mensajes")
      .select("id,conversacion_id,direction,text,created_at")
      .eq("conversacion_id", conversationId)
      .order("created_at", { ascending: true });

    if (messagesRes.error) {
      setError(messagesRes.error.message || "No se pudieron cargar los mensajes de NIA.");

      if (!options.silent) {
        setLoadingMessages(false);
      }

      return;
    }

    const nextMessages = (messagesRes.data || []) as NiaMensaje[];

    knownNiaMessageIdsRef.current = new Set(nextMessages.map((message) => message.id));
    setNiaMessages(nextMessages);

    await supabase.from("nia_conversaciones").update({ unread_count: 0 }).eq("id", conversationId);

    if (!options.silent) {
      setLoadingMessages(false);
    }
  }, []);

  const loadConversationMessages = useCallback(
    async (conversationId: string, options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoadingMessages(true);
      }

      setError(null);

      const messagesRes = await supabase
        .from("mensajes")
        .select("*")
        .eq("conversacion_id", conversationId)
        .is("deleted_at", null)
        .order("wa_timestamp", { ascending: true });

      if (messagesRes.error) {
        setError(messagesRes.error.message || "No se pudieron cargar los mensajes.");

        if (!options.silent) {
          setLoadingMessages(false);
        }

        return;
      }

      const nextMessages = (messagesRes.data || []) as MobileMensaje[];

      knownConversationMessageIdsRef.current = new Set(nextMessages.map((message) => message.id));
      setMensajes(nextMessages);

      await supabase.from("conversaciones").update({ unread_count: 0 }).eq("id", conversationId);

      if (!options.silent) {
        setLoadingMessages(false);
      }
    },
    []
  );

  const loadData = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
      }

      setError(null);

      const currentUserId = await getCurrentUserId();

      if (!currentUserId) {
        setError("No hay usuario autenticado.");

        if (!options.silent) {
          setLoading(false);
        }

        return;
      }

      const profileRes = await supabase
        .from("profiles")
        .select("id,nombre,apellido,email,color,activo,rol,nombre_publico_whatsapp,mostrar_nombre_agente")
        .eq("id", currentUserId)
        .maybeSingle();

      if (profileRes.error) {
        setError(profileRes.error.message || "No se pudo cargar el perfil.");

        if (!options.silent) {
          setLoading(false);
        }

        return;
      }

      const profile = (profileRes.data || null) as MobileProfile | null;
      setCurrentProfile(profile);

      await loadNiaConversation();

      const [convRes, contactosRes, profilesRes, oppRes, colaboradoresRes] = await Promise.all([
        supabase
          .from("conversaciones")
          .select("*")
          .is("deleted_at", null)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(250),

        supabase.from("contactos_wa").select("*"),

        supabase
          .from("profiles")
          .select("id,nombre,apellido,email,color,activo,nombre_publico_whatsapp,mostrar_nombre_agente")
          .eq("activo", true),

        supabase.from("lead_oportunidades").select("*").order("updated_at", { ascending: false }),

        supabase
          .from("conversacion_colaboradores")
          .select("id,conversacion_id,profile_id,added_by,created_at")
          .order("created_at", { ascending: true })
      ]);

      const firstError =
        convRes.error ||
        contactosRes.error ||
        profilesRes.error ||
        oppRes.error ||
        colaboradoresRes.error;

      if (firstError) {
        setError(firstError.message || "No se pudieron cargar las conversaciones.");

        if (!options.silent) {
          setLoading(false);
        }

        return;
      }

      const contactosMap = new Map<string, ContactoWa>();
      ((contactosRes.data || []) as ContactoWa[]).forEach((item) => contactosMap.set(item.id, item));

      const profilesMap = new Map<string, ProfileLite>();
      ((profilesRes.data || []) as ProfileLite[]).forEach((item) => profilesMap.set(item.id, item));

      const oppMap = new Map<string, any>();
      ((oppRes.data || []) as any[]).forEach((item) => oppMap.set(item.conversacion_id, item));

      const colaboradoresByConversation = new Map<string, ConversacionColaborador[]>();

      ((colaboradoresRes.data || []) as ConversacionColaborador[]).forEach((item) => {
        const current = colaboradoresByConversation.get(item.conversacion_id) || [];

        current.push({
          ...item,
          profile: profilesMap.get(item.profile_id) || null
        });

        colaboradoresByConversation.set(item.conversacion_id, current);
      });

      const canSeeAll = canSeeAllConversations(profile);

      const allConversations = ((convRes.data || []) as Conversacion[]).map((conv) => ({
        ...conv,
        contacto: contactosMap.get(conv.contacto_id) || null,
        vendedor: conv.assigned_to ? profilesMap.get(conv.assigned_to) || null : null,
        oportunidad: oppMap.get(conv.id) || null,
        colaboradores: colaboradoresByConversation.get(conv.id) || []
      }));

      const visibleConversations = allConversations.filter((conv) => {
        if (canSeeAll) return true;
        if (conv.assigned_to === currentUserId) return true;

        return Boolean(
          conv.colaboradores?.some((colaborador) => colaborador.profile_id === currentUserId)
        );
      });

      setConversations(visibleConversations);

      if (!options.silent) {
        setLoading(false);
      }
    },
    [loadNiaConversation]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const channel = supabase
      .channel(`mobile-chats-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversaciones"
        },
        () => {
          void loadData({ silent: true });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes"
        },
        (payload) => {
          const message = payload.new as MobileMensaje;
          const conversationId = message.conversacion_id;

          const alreadyKnown = knownConversationMessageIdsRef.current.has(message.id);

          if (!alreadyKnown) {
            knownConversationMessageIdsRef.current.add(message.id);

            const role = getMessageRole(message);
            const isInbound =
              !isInternalMessage(message) &&
              (role === "passenger" || role === "cande" || role === "nia");

            if (initializedRealtimeRef.current && isInbound) {
              playNotificationSound();

              const relatedConversation = conversations.find((conv) => conv.id === conversationId);
              const title = relatedConversation
                ? getDisplayName(relatedConversation.contacto, relatedConversation)
                : "Nuevo mensaje";

              showBrowserNotification(title, message.text || "Tenés un nuevo mensaje.");
            }
          }

          void loadData({ silent: true });

          if (
            selectedKindRef.current === "conversation" &&
            selectedConversationIdRef.current === conversationId
          ) {
            void loadConversationMessages(conversationId, { silent: true });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensajes"
        },
        (payload) => {
          const message = payload.new as MobileMensaje;
          const conversationId = message.conversacion_id;

          void loadData({ silent: true });

          if (
            selectedKindRef.current === "conversation" &&
            selectedConversationIdRef.current === conversationId
          ) {
            void loadConversationMessages(conversationId, { silent: true });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "nia_conversaciones"
        },
        () => {
          void loadNiaConversation();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "nia_mensajes"
        },
        (payload) => {
          const message = payload.new as NiaMensaje;
          const conversationId = message.conversacion_id;

          const alreadyKnown = knownNiaMessageIdsRef.current.has(message.id);

          if (!alreadyKnown) {
            knownNiaMessageIdsRef.current.add(message.id);

            const direction = String(message.direction || "").toLowerCase();
            const isNiaResponse = direction === "assistant" || direction === "nia";

            if (initializedRealtimeRef.current && isNiaResponse) {
              playNotificationSound();
              showBrowserNotification("NIA", message.text || "NIA respondió.");
            }
          }

          void loadNiaConversation();

          if (
            selectedKindRef.current === "nia" &&
            niaConversationIdRef.current === conversationId &&
            conversationId
          ) {
            void loadNiaMessages(conversationId, { silent: true });
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "nia_mensajes"
        },
        (payload) => {
          const message = payload.new as NiaMensaje;
          const conversationId = message.conversacion_id;

          void loadNiaConversation();

          if (
            selectedKindRef.current === "nia" &&
            niaConversationIdRef.current === conversationId &&
            conversationId
          ) {
            void loadNiaMessages(conversationId, { silent: true });
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          window.setTimeout(() => {
            initializedRealtimeRef.current = true;
          }, 1200);
        }
      });

    const fallbackInterval = window.setInterval(() => {
      void loadData({ silent: true });

      if (selectedKindRef.current === "conversation" && selectedConversationIdRef.current) {
        void loadConversationMessages(selectedConversationIdRef.current, { silent: true });
      }

      if (selectedKindRef.current === "nia" && niaConversationIdRef.current) {
        void loadNiaMessages(niaConversationIdRef.current, { silent: true });
      }
    }, 10000);

    return () => {
      window.clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [
    conversations,
    loadData,
    loadConversationMessages,
    loadNiaConversation,
    loadNiaMessages
  ]);

  const chatItems = useMemo<MobileChatItem[]>(() => {
    const clean = search.trim().toLowerCase();

    const filtered = conversations
      .filter((conv) => {
        if (!clean) return true;

        const haystack = [
          conv.wa_phone,
          conv.titulo,
          conv.subject,
          conv.last_message_preview,
          conv.contacto?.display_name,
          conv.contacto?.profile_name,
          conv.vendedor?.nombre,
          conv.vendedor?.apellido
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(clean);
      })
      .sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
        const bTime = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();

        return bTime - aTime;
      });

    return [
      {
        kind: "nia",
        id: "nia",
        conversation: niaConversation
      },
      ...filtered.map((conversation) => ({
        kind: "conversation" as const,
        id: conversation.id,
        conversation
      }))
    ];
  }, [conversations, niaConversation, search]);

  async function openConversation(conversationId: string) {
    setSelectedConversationId(conversationId);
    selectedConversationIdRef.current = conversationId;
    setSelectedKind("conversation");
    selectedKindRef.current = "conversation";
    setComposerText("");
    setPrivateMode(false);
    setReplyingTo(null);
    setForwardingMessage(null);
    setActiveMessageId(null);
    setEmojiPickerOpen(false);
    setReactionTargetId(null);
    await loadConversationMessages(conversationId);
    await loadData({ silent: true });
  }

  async function openNia() {
    const conversation = niaConversation || (await loadNiaConversation());

    if (!conversation) return;

    setSelectedConversationId(null);
    selectedConversationIdRef.current = null;
    setSelectedKind("nia");
    selectedKindRef.current = "nia";
    setComposerText("");
    setPrivateMode(false);
    setMensajes([]);

    await loadNiaMessages(conversation.id);
    await loadNiaConversation();
  }

  function backToList() {
    setSelectedKind("list");
    selectedKindRef.current = "list";
    setSelectedConversationId(null);
    selectedConversationIdRef.current = null;
    setComposerText("");
    setPrivateMode(false);
    setReplyingTo(null);
    setForwardingMessage(null);
    setActiveMessageId(null);
    setEmojiPickerOpen(false);
    setReactionTargetId(null);
    setMensajes([]);
    setNiaMessages([]);
  }

  async function joinConversation() {
    if (!selectedConversation) return;

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      setError("No se pudo identificar el usuario actual.");
      return;
    }

    setJoining(true);
    setError(null);

    const alreadyCollaborator = Boolean(
      selectedConversation.colaboradores?.some(
        (colaborador) => colaborador.profile_id === currentUserId
      )
    );

    if (!alreadyCollaborator && selectedConversation.assigned_to !== currentUserId) {
      const insertRes = await supabase.from("conversacion_colaboradores").insert({
        conversacion_id: selectedConversation.id,
        profile_id: currentUserId,
        added_by: currentUserId,
        created_at: new Date().toISOString()
      });

      if (insertRes.error) {
        setError(insertRes.error.message || "No se pudo unir a la conversación.");
        setJoining(false);
        return;
      }
    }

    await loadData({ silent: true });
    await loadConversationMessages(selectedConversation.id, { silent: true });

    setJoining(false);
  }

  async function sendPrivateMessage() {
    if (!selectedConversation) return;

    if (!privateMode && pendingAudioFile && !composerText.trim()) {
      await sendPendingAudioMessage();
      return;
    }

    if (!composerText.trim()) return;

    setSending(true);
    setError(null);

    const userId = await getCurrentUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setSending(false);
      return;
    }

    const text = composerText.trim();
    const now = new Date().toISOString();
    const conversationId = selectedConversation.id;
    const localId = `private-${conversationId}-${Date.now()}`;

    const optimisticMessage = {
      id: localId,
      conversacion_id: conversationId,
      direction: "out",
      type: "text",
      text,
      media: null,
      reply_to_id: null,
      forwarded: false,
      status: "sent",
      error: null,
      wa_message_id: null,
      sender_profile_id: userId,
      deleted_at: null,
      delivered_at: null,
      read_at: null,
      wa_timestamp: now,
      created_at: now,
      sender_kind: "interno"
    } as MobileMensaje;

    setPrivateMessagesByConversation((current) => ({
      ...current,
      [conversationId]: [...(current[conversationId] || []), optimisticMessage]
    }));

    setComposerText("");

    const insertRes = await supabase
      .from("mensajes")
      .insert({
        conversacion_id: conversationId,
        direction: "out",
        type: "text",
        text,
        media: null,
        reply_to_id: null,
        forwarded: false,
        status: "sent",
        error: null,
        wa_message_id: null,
        sender_profile_id: userId,
        deleted_at: null,
        delivered_at: null,
        read_at: null,
        wa_timestamp: now,
        sender_kind: "humano"
      })
      .select("*")
      .single();

    if (insertRes.error) {
      console.error("Error guardando mensaje privado mobile:", insertRes.error);

      setPrivateMessagesByConversation((current) => ({
        ...current,
        [conversationId]: (current[conversationId] || []).map((message) =>
          message.id === localId
            ? {
                ...message,
                error: insertRes.error?.message || "No se pudo guardar en base de datos.",
                status: "failed"
              }
            : message
        )
      }));

      setError(insertRes.error.message || "No se pudo guardar el mensaje privado.");
      setSending(false);
      return;
    }

    const savedMessage = {
      ...(insertRes.data as MobileMensaje),
      sender_kind: "interno"
    } as MobileMensaje;

    setPrivateMessagesByConversation((current) => ({
      ...current,
      [conversationId]: (current[conversationId] || []).map((message) =>
        message.id === localId ? savedMessage : message
      )
    }));

    await supabase
      .from("conversaciones")
      .update({
        updated_at: now
      })
      .eq("id", conversationId);

    await loadData({ silent: true });

    setSending(false);
  }

  async function sendWhatsappPayload(
    targetConversation: ConversationVM,
    payload: WhatsAppSendPayload
  ) {
    const userId = await getCurrentUserId();

    if (!userId) {
      throw new Error("No se pudo identificar el usuario actual.");
    }

    const text = payload.text.trim();
    const media = payload.media || null;
    const messageType = normalizeMessageType(payload.type || (media ? undefined : "text"), media?.mime_type || media?.content_type);
    const now = new Date().toISOString();

    const insertRes = await supabase
      .from("mensajes")
      .insert({
        conversacion_id: targetConversation.id,
        direction: "out",
        type: messageType,
        text,
        media,
        reply_to_id: payload.replyToId || null,
        forwarded: Boolean(payload.forwarded),
        status: "pending",
        error: null,
        wa_message_id: null,
        sender_profile_id: userId,
        deleted_at: null,
        delivered_at: null,
        read_at: null,
        wa_timestamp: now,
        sender_kind: "humano"
      })
      .select("id")
      .single();

    if (insertRes.error) {
      throw new Error(insertRes.error.message || "No se pudo crear el mensaje.");
    }

    const messageId = insertRes.data.id as string;
    const preview = text || media?.filename || (messageType === "image" ? "Imagen" : messageType === "audio" ? "Audio" : "Archivo");

    await supabase
      .from("conversaciones")
      .update({
        last_message_at: now,
        last_outbound_message_at: now,
        last_message_preview: preview,
        estado_gestion: "en_gestion",
        updated_at: now
      })
      .eq("id", targetConversation.id);

    const sendRes = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        conversacion_id: targetConversation.id,
        conversation_id: targetConversation.id,
        message_id: messageId,
        local_message_id: messageId,
        to: targetConversation.wa_phone,
        wa_phone: targetConversation.wa_phone,
        text,
        caption: text,
        media,
        media_url: media?.public_url || media?.url || null,
        filename: media?.filename || null,
        mime_type: media?.mime_type || media?.content_type || null,
        message_type: messageType,
        type: messageType,
        reply_to_id: payload.replyToId || null,
        forwarded: Boolean(payload.forwarded),
        sender_profile_id: userId,
        show_agent_name: true
      }
    });

    if (sendRes.error || !sendRes.data?.ok) {
      const errorMessage = sendRes.error?.message || sendRes.data?.error || "WhatsApp rechazó el envío.";

      await supabase
        .from("mensajes")
        .update({
          status: "failed",
          error: errorMessage
        })
        .eq("id", messageId);

      throw new Error(errorMessage);
    }

    return messageId;
  }

  async function sendWhatsappMessage() {
    if (privateMode) {
      await sendPrivateMessage();
      return;
    }

    if (!selectedConversation) return;

    if (!privateMode && pendingAudioFile && !composerText.trim()) {
      await sendPendingAudioMessage();
      return;
    }

    if (!composerText.trim()) return;

    setSending(true);
    setError(null);

    const text = composerText.trim();
    const replyToId = replyingTo?.id || null;

    setComposerText("");
    setReplyingTo(null);
    setEmojiPickerOpen(false);

    try {
      await sendWhatsappPayload(selectedConversation, {
        text,
        type: "text",
        replyToId
      });

      await loadConversationMessages(selectedConversation.id, { silent: true });
      await loadData({ silent: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo enviar el mensaje.");
      setComposerText(text);
    } finally {
      setSending(false);
    }
  }

  function pickFile() {
    fileInputRef.current?.click();
  }

  async function sendFileMessage(file: File) {
    if (!selectedConversation || privateMode) return;

    setUploading(true);
    setSending(true);
    setError(null);

    const caption = composerText.trim();
    const replyToId = replyingTo?.id || null;

    try {
      const media = await uploadMobileChatFile(file, selectedConversation.id);
      const type = getOutgoingFileMessageType(file);

      setComposerText("");
      setReplyingTo(null);

      await sendWhatsappPayload(selectedConversation, {
        text: caption,
        type,
        media,
        replyToId
      });

      await loadConversationMessages(selectedConversation.id, { silent: true });
      await loadData({ silent: true });
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo enviar el archivo.");
    } finally {
      setUploading(false);
      setSending(false);
    }
  }

  async function sendPendingAudioMessage() {
    if (!pendingAudioFile || !selectedConversation || privateMode) return;

    const file = pendingAudioFile;
    discardPendingAudio();
    await sendFileMessage(file);
  }

async function toggleAudioRecording() {
  if (recording) {
    try {
      mediaRecorderRef.current?.stop();
    } catch {
      setRecording(false);
    }
    return;
  }

  if (!navigator.mediaDevices?.getUserMedia) {
    setError("El navegador no permite grabar audio desde esta pantalla.");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    const preferredAudioMimeTypes = [
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/webm;codecs=opus",
      "audio/webm"
    ];

    const supportedAudioMimeType =
      preferredAudioMimeTypes.find((mimeType) => {
        try {
          return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(mimeType);
        } catch {
          return false;
        }
      }) || "";

    const recorder = supportedAudioMimeType
      ? new MediaRecorder(stream, { mimeType: supportedAudioMimeType })
      : new MediaRecorder(stream);

    audioChunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      const recorderMimeType = recorder.mimeType || supportedAudioMimeType || "audio/webm";
      const contentType = cleanMimeType(recorderMimeType) || "audio/webm";

      const blob = new Blob(audioChunksRef.current, { type: recorderMimeType });

      stream.getTracks().forEach((track) => track.stop());
      mediaRecorderRef.current = null;
      setRecording(false);

      if (blob.size > 0) {
    const extension =
  contentType === "audio/ogg"
    ? "ogg"
    : contentType === "audio/mp4"
      ? "m4a"
      : contentType === "audio/mpeg" || contentType === "audio/mp3"
        ? "mp3"
        : "webm";

        const file = new File([blob], `audio-${Date.now()}.${extension}`, {
          type: contentType
        });

        setPendingAudio(file);
      }
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  } catch (error) {
    setError(error instanceof Error ? error.message : "No se pudo acceder al micrófono.");
    setRecording(false);
  }
}

  function setReply(message: MobileMensaje) {
    setReplyingTo(message);
    setActiveMessageId(null);
    setReactionTargetId(null);
    setForwardingMessage(null);
  }

  function startForward(message: MobileMensaje) {
    setForwardingMessage(message);
    setActiveMessageId(null);
    setReactionTargetId(null);
    setReplyingTo(null);
  }

  async function forwardToConversation(conversationId: string) {
    const target = conversations.find((item) => item.id === conversationId);
    if (!target || !forwardingMessage) return;

    setSending(true);
    setError(null);

    try {
      await sendWhatsappPayload(target, {
        text: String(forwardingMessage.text || ""),
        type: forwardingMessage.type || "text",
        media: getMediaPayload(forwardingMessage),
        forwarded: true
      });

      setForwardingMessage(null);
      await loadData({ silent: true });

      if (selectedConversationIdRef.current) {
        await loadConversationMessages(selectedConversationIdRef.current, { silent: true });
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo reenviar el mensaje.");
    } finally {
      setSending(false);
    }
  }

  async function deleteMessage(message: MobileMensaje) {
    if (!selectedConversation) return;

    setActiveMessageId(null);
    setReactionTargetId(null);
    setError(null);

    const now = new Date().toISOString();
    const updateRes = await supabase
      .from("mensajes")
      .update({
        deleted_at: now,
        text: "Mensaje eliminado"
      })
      .eq("id", message.id);

    if (updateRes.error) {
      setError(updateRes.error.message || "No se pudo eliminar el mensaje.");
      return;
    }

    try {
      await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          action: "delete",
          message_type: "delete",
          conversacion_id: selectedConversation.id,
          conversation_id: selectedConversation.id,
          message_id: message.id,
          wa_message_id: message.wa_message_id,
          to: selectedConversation.wa_phone,
          wa_phone: selectedConversation.wa_phone
        }
      });
    } catch {
      // Si WhatsApp no permite borrar, por lo menos queda oculto localmente.
    }

    await loadConversationMessages(selectedConversation.id, { silent: true });
    await loadData({ silent: true });
  }

  async function reactToMessage(message: MobileMensaje, emoji: string) {
    if (!selectedConversation) return;

    setReactionTargetId(null);
    setActiveMessageId(null);
    setError(null);

    const updateRes = await supabase
      .from("mensajes")
      .update({ reaction: emoji } as any)
      .eq("id", message.id);

    if (updateRes.error) {
      console.warn("No se pudo guardar reaction en mensajes.reaction:", updateRes.error.message);
    }

    try {
      const userId = await getCurrentUserId();

      await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          conversacion_id: selectedConversation.id,
          conversation_id: selectedConversation.id,
          to: selectedConversation.wa_phone,
          wa_phone: selectedConversation.wa_phone,
          message_type: "reaction",
          type: "reaction",
          emoji,
          reaction: emoji,
          reaction_message_id: message.wa_message_id || message.id,
          target_message_id: message.wa_message_id || message.id,
          sender_profile_id: userId
        }
      });
    } catch (error) {
      setError(error instanceof Error ? error.message : "No se pudo enviar la reacción.");
    }

    await loadConversationMessages(selectedConversation.id, { silent: true });
  }

  async function sendNiaMessage() {
    if (!composerText.trim()) return;

    setSending(true);
    setError(null);

    const conversation = niaConversation || (await loadNiaConversation());

    if (!conversation) {
      setError("No se pudo abrir la conversación con NIA.");
      setSending(false);
      return;
    }

    const text = composerText.trim();
    const now = new Date().toISOString();

    const insertRes = await supabase
      .from("nia_mensajes")
      .insert({
        conversacion_id: conversation.id,
        direction: "user",
        text,
        created_at: now
      })
      .select("id,conversacion_id,direction,text,created_at")
      .single();

    if (insertRes.error) {
      setError(insertRes.error.message || "No se pudo enviar el mensaje a NIA.");
      setSending(false);
      return;
    }

    await supabase
      .from("nia_conversaciones")
      .update({
        last_message_at: now,
        last_message_preview: text,
        updated_at: now
      })
      .eq("id", conversation.id);

    setComposerText("");

    await loadNiaMessages(conversation.id, { silent: true });
    await loadNiaConversation();

    const functionRes = await supabase.functions.invoke(NIA_EDGE_FUNCTION, {
      body: {
        conversacion_id: conversation.id,
        conversation_id: conversation.id,
        message_id: insertRes.data.id,
        text,
        source: "mobile"
      }
    });

    if (functionRes.error || functionRes.data?.ok === false) {
      setError(
        functionRes.error?.message ||
          functionRes.data?.error ||
          `Mensaje guardado, pero falta conectar la Edge Function ${NIA_EDGE_FUNCTION}.`
      );
    }

    await loadNiaMessages(conversation.id, { silent: true });
    await loadNiaConversation();

    setSending(false);
  }

  if (selectedKind === "nia") {
    return (
      <NiaDetail
        messages={niaMessages}
        loadingMessages={loadingMessages}
        sending={sending}
        text={composerText}
        onTextChange={setComposerText}
        onBack={backToList}
        onSend={sendNiaMessage}
      />
    );
  }

  if (selectedKind === "conversation" && selectedConversation) {
    return (
      <ConversationDetail
        conversation={selectedConversation}
        conversaciones={conversations}
        mensajes={visibleMensajes}
        loadingMessages={loadingMessages}
        sending={sending}
        joining={joining}
        uploading={uploading}
        recording={recording}
        pendingAudioPreviewUrl={pendingAudioPreviewUrl}
        canJoin={currentUserCanJoinSelectedConversation}
        privateMode={privateMode}
        text={composerText}
        replyingTo={replyingTo}
        forwardingMessage={forwardingMessage}
        activeMessageId={activeMessageId}
        emojiPickerOpen={emojiPickerOpen}
        reactionTargetId={reactionTargetId}
        fileInputRef={fileInputRef}
        onTextChange={setComposerText}
        onPrivateModeChange={setPrivateMode}
        onBack={backToList}
        onSend={sendWhatsappMessage}
        onJoin={() => void joinConversation()}
        onPickFile={pickFile}
        onFileSelected={(file) => void sendFileMessage(file)}
        onToggleRecording={() => void toggleAudioRecording()}
        onSendPendingAudio={() => void sendPendingAudioMessage()}
        onDiscardPendingAudio={discardPendingAudio}
        onSetReplyingTo={setReply}
        onCancelReply={() => setReplyingTo(null)}
        onStartForward={startForward}
        onCancelForward={() => setForwardingMessage(null)}
        onForwardToConversation={(conversationId) => void forwardToConversation(conversationId)}
        onDeleteMessage={(message) => void deleteMessage(message)}
        onReactToMessage={(message, emoji) => void reactToMessage(message, emoji)}
        onToggleEmojiPicker={() => setEmojiPickerOpen((current) => !current)}
        onAddEmoji={(emoji) => setComposerText((current) => `${current}${emoji}`)}
        onToggleMessageActions={(messageId) => {
          setActiveMessageId((current) => (current === messageId ? null : messageId));
          setReactionTargetId(null);
        }}
        onSetReactionTarget={setReactionTargetId}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_12%_8%,rgba(255,122,26,0.10),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(255,47,118,0.06),transparent_30%),linear-gradient(135deg,#f7fbfc,#eff8f8_48%,#f4f8ff)] text-[#111827]">
      <header className="shrink-0 border-b border-black/10 bg-white/88 px-3 pb-3 pt-[max(env(safe-area-inset-top),12px)] shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10">
            <img
              src={brandAssets.iconoColor}
              alt={brandText.appName}
              className="h-8 w-8 object-contain"
              draggable={false}
            />
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[18px] font-semibold leading-tight text-[#172033]">
              Chats
            </h1>

            <p className="truncate text-[11px] font-normal leading-tight text-[#64748b]">
              NIA y conversaciones con pasajeros
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={activateMobileNotifications}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-purple-200 bg-purple-50 text-purple-700 shadow-sm"
              title="Activar avisos"
            >
              <Sparkles size={16} strokeWidth={1.9} />
            </button>

            <button
              type="button"
              onClick={() => void loadData()}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-black/10 bg-white text-[#64748b] shadow-sm disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <RefreshCcw size={16} strokeWidth={1.9} />
              )}
            </button>
          </div>
        </div>

        <div className="mt-3 flex h-9 items-center gap-2 rounded-2xl border border-black/10 bg-[#f8fafc] px-3">
          <User size={14} className="shrink-0 text-nostur-orange" />

          <div className="min-w-0 flex-1 truncate text-[11px] font-medium text-[#64748b]">
            {currentProfile?.email || "Usuario"}
          </div>
        </div>

        <div className="mt-3 flex h-10 items-center gap-2.5 rounded-[18px] border border-black/10 bg-white px-3 shadow-sm">
          <Search size={16} className="shrink-0 text-[#94a3b8]" />

          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar conversación"
            className="h-full min-w-0 flex-1 bg-transparent text-[13px] font-medium text-[#111827] outline-none placeholder:text-[#94a3b8]"
          />

          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="flex h-7 w-7 items-center justify-center rounded-full bg-[#f1f5f9] text-[#94a3b8]"
            >
              <X size={14} />
            </button>
          ) : null}
        </div>

        {error ? (
          <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium leading-snug text-red-700">
            {error}
          </div>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-auto px-3 py-3">
        {loading && conversations.length === 0 ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-[#172033]" />
          </div>
        ) : chatItems.length === 1 ? (
          <div className="space-y-2.5">
            <NiaChatRow conversation={niaConversation} active={false} onClick={() => void openNia()} />

            <div className="rounded-[22px] border border-dashed border-black/10 bg-white/70 p-5 text-center backdrop-blur-xl">
              <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#f1f5f9] text-[#64748b]">
                <MessageCircle size={22} />
              </div>

              <h2 className="text-[16px] font-semibold leading-tight text-[#111827]">
                Sin conversaciones
              </h2>

              <p className="mt-1 text-[12px] font-normal leading-snug text-[#64748b]">
                Cuando tengas chats asignados van a aparecer debajo de NIA.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5 pb-3">
            {chatItems.map((item) => {
              if (item.kind === "nia") {
                return (
                  <NiaChatRow
                    key={item.id}
                    conversation={item.conversation}
                    active={false}
                    onClick={() => void openNia()}
                  />
                );
              }

              return (
                <ConversationRow
                  key={item.id}
                  conv={item.conversation}
                  active={item.id === selectedConversationId}
                  onClick={() => void openConversation(item.id)}
                />
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}

export default MobileChatsScreen;