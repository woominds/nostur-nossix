// src/components/LiveNosNotificationBell.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Bell, Loader2, MessageCircle, RefreshCcw, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useBrowserStore } from "../store/browserStore";

type PendingConversationRow = {
  id: string;
  wa_phone: string | null;
  titulo: string | null;
  subject: string | null;
  last_message_preview: string | null;
  unread_count: number | null;
  estado_gestion: string | null;
  inbox: string | null;
  status: string | null;
  last_message_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type PendingMessageRow = {
  id: string;
  conversacion_id: string;
  direction: string;
  type: string;
  text: string | null;
  media: Record<string, unknown> | null;
  wa_timestamp: string | null;
  created_at: string | null;
  sender_kind: string | null;
};

type LiveNosPendingItem = {
  conversationId: string;
  messageId: string | null;
  title: string;
  phone: string;
  preview: string;
  type: string;
  at: string | null;
  unreadCount: number;
  isSinAtender: boolean;
};

type LiveNosNotificationState = {
  items: LiveNosPendingItem[];
  unreadConversations: number;
  sinAtenderConversations: number;
  total: number;
  loading: boolean;
};

function getSafeCount(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatTime(value?: string | null): string {
  if (!value) return "";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Cordoba"
    }).format(new Date(value));
  } catch {
    return "";
  }
}

function getMessagePreview(message: PendingMessageRow | null, fallback?: string | null): string {
  if (message?.text?.trim()) return message.text.trim();

  const type = String(message?.type || "").toLowerCase();

  if (type === "audio") return "Audio recibido";
  if (type === "image") return "Imagen recibida";
  if (type === "document") return "Archivo recibido";
  if (type === "video") return "Video recibido";

  return String(fallback || "Nuevo mensaje recibido").trim();
}

function isSinAtender(row: PendingConversationRow): boolean {
  const estadoGestion = String(row.estado_gestion || "").toLowerCase();
  const inbox = String(row.inbox || "").toLowerCase();
  const status = String(row.status || "").toLowerCase();

  return (
    estadoGestion === "sin_atender" ||
    estadoGestion === "espera_agente" ||
    inbox === "sin_atender" ||
    inbox === "derivado_nuevo" ||
    status === "new"
  );
}

function isPendingConversation(row: PendingConversationRow): boolean {
  return getSafeCount(row.unread_count) > 0 || isSinAtender(row);
}

export function LiveNosNotificationBell() {
  const createTab = useBrowserStore((state) => state.createTab);

  const wrapperRef = useRef<HTMLDivElement | null>(null);

  const [open, setOpen] = useState(false);
  const [state, setState] = useState<LiveNosNotificationState>({
    items: [],
    unreadConversations: 0,
    sinAtenderConversations: 0,
    total: 0,
    loading: false
  });

  const hasNotifications = state.total > 0;

  const tooltip = useMemo(() => {
    if (state.loading) return "Revisando LiveNos...";

    if (!hasNotifications) {
      return "Sin mensajes nuevos en LiveNos";
    }

    const parts: string[] = [];

    if (state.unreadConversations > 0) {
      parts.push(`${state.unreadConversations} sin leer`);
    }

    if (state.sinAtenderConversations > 0) {
      parts.push(`${state.sinAtenderConversations} sin atender`);
    }

    return `LiveNos: ${parts.join(" · ")}`;
  }, [hasNotifications, state.loading, state.sinAtenderConversations, state.unreadConversations]);

  async function loadNotificationState() {
    setState((current) => ({
      ...current,
      loading: true
    }));

    const { data: conversationsData, error: conversationsError } = await supabase
      .from("conversaciones")
      .select(
        "id,wa_phone,titulo,subject,last_message_preview,unread_count,estado_gestion,inbox,status,last_message_at,updated_at,created_at,deleted_at,archived_at,closed_at"
      )
      .is("deleted_at", null)
      .is("archived_at", null)
      .is("closed_at", null)
      .limit(300);

    if (conversationsError) {
      setState((current) => ({
        ...current,
        loading: false
      }));

      return;
    }

    const pendingConversations = ((conversationsData || []) as PendingConversationRow[])
      .filter(isPendingConversation)
      .sort((a, b) => {
        const aTime = new Date(a.last_message_at || a.updated_at || a.created_at || 0).getTime();
        const bTime = new Date(b.last_message_at || b.updated_at || b.created_at || 0).getTime();

        return bTime - aTime;
      });

    const conversationIds = pendingConversations.map((item) => item.id);

    let messagesByConversation = new Map<string, PendingMessageRow>();

    if (conversationIds.length > 0) {
      const { data: messagesData } = await supabase
        .from("mensajes")
        .select("id,conversacion_id,direction,type,text,media,wa_timestamp,created_at,sender_kind")
        .in("conversacion_id", conversationIds)
        .eq("direction", "in")
        .is("deleted_at", null)
        .order("wa_timestamp", { ascending: false })
        .limit(500);

      messagesByConversation = ((messagesData || []) as PendingMessageRow[]).reduce(
        (acc, message) => {
          if (!acc.has(message.conversacion_id)) {
            acc.set(message.conversacion_id, message);
          }

          return acc;
        },
        new Map<string, PendingMessageRow>()
      );
    }

    const unreadConversationIds = new Set<string>();
    const sinAtenderConversationIds = new Set<string>();

    const items: LiveNosPendingItem[] = pendingConversations.map((conversation) => {
      const unreadCount = getSafeCount(conversation.unread_count);
      const sinAtender = isSinAtender(conversation);
      const message = messagesByConversation.get(conversation.id) || null;

      if (unreadCount > 0) {
        unreadConversationIds.add(conversation.id);
      }

      if (sinAtender) {
        sinAtenderConversationIds.add(conversation.id);
      }

      const title =
        String(conversation.titulo || conversation.subject || "").trim() ||
        String(conversation.wa_phone || "").trim() ||
        "Pasajero";

      return {
        conversationId: conversation.id,
        messageId: message?.id || null,
        title,
        phone: String(conversation.wa_phone || "").trim(),
        preview: getMessagePreview(message, conversation.last_message_preview),
        type: message?.type || "text",
        at: message?.wa_timestamp || conversation.last_message_at || conversation.updated_at,
        unreadCount,
        isSinAtender: sinAtender
      };
    });

    setState({
      items: items.slice(0, 10),
      unreadConversations: unreadConversationIds.size,
      sinAtenderConversations: sinAtenderConversationIds.size,
      total: pendingConversations.length,
      loading: false
    });
  }

  function openLiveNosItem(item?: LiveNosPendingItem) {
    if (item?.conversationId) {
      window.localStorage.setItem("nostur_open_livenos_conversation_id", item.conversationId);
    }

    if (item?.messageId) {
      window.localStorage.setItem("nostur_open_livenos_message_id", item.messageId);
    }

    window.localStorage.setItem(
      "nostur_livenos_open_inbox",
      item?.isSinAtender ? "sin_atender" : "en_gestion"
    );

    createTab({
      appId: "livenos",
      url: "internal://livenos",
      title: "LiveNos",
      activate: true
    });

    window.setTimeout(() => {
      window.dispatchEvent(
        new CustomEvent("nostur:open-livenos-conversation", {
          detail: {
            conversationId: item?.conversationId || null,
            messageId: item?.messageId || null
          }
        })
      );
    }, 250);

    setOpen(false);
  }

  useEffect(() => {
    void loadNotificationState();

    const channelName = `tabsbar-livenos-notifications-${Date.now()}`;
    let refreshTimer: number | null = null;

    function refreshSoft() {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      refreshTimer = window.setTimeout(() => {
        void loadNotificationState();
      }, 450);
    }

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversaciones"
        },
        refreshSoft
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensajes"
        },
        refreshSoft
      )
      .subscribe();

    const interval = window.setInterval(() => {
      void loadNotificationState();
    }, 30000);

    return () => {
      if (refreshTimer) {
        window.clearTimeout(refreshTimer);
      }

      window.clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node | null;

      if (!target) return;
      if (wrapperRef.current?.contains(target)) return;

      setOpen(false);
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  return (
    <div ref={wrapperRef} className="group/tab relative flex h-8 w-8 items-center justify-center">
      <button
        type="button"
        onClick={() => {
          setOpen((current) => !current);
          void loadNotificationState();
        }}
        aria-label={tooltip}
        title={tooltip}
        className={[
          "relative flex h-8 w-8 items-center justify-center rounded-lg transition",
          hasNotifications
            ? "bg-red-50 text-red-600 ring-1 ring-red-200 hover:bg-red-100"
            : "text-[#334155] hover:bg-white/65 hover:text-[#172033]"
        ].join(" ")}
      >
        {state.loading ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <Bell size={16} strokeWidth={2} className={hasNotifications ? "animate-pulse" : ""} />
        )}

        {hasNotifications ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[9px] font-black leading-none text-white shadow-sm">
            {state.total > 99 ? "99+" : state.total}
          </span>
        ) : null}
      </button>

      {!open ? (
        <span className="pointer-events-none absolute left-1/2 top-[36px] z-[9999] -translate-x-1/2 translate-y-1 opacity-0 transition duration-150 group-hover/tab:translate-y-0 group-hover/tab:opacity-100">
          <span className="whitespace-nowrap rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[11px] font-normal text-[#334155] shadow-lg">
            {tooltip}
          </span>
        </span>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-[36px] z-[9999] w-[390px] overflow-hidden rounded-[22px] border border-black/10 bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-[#f8fafc] px-4 py-3">
            <div className="min-w-0">
              <h3 className="text-[13px] font-semibold text-[#111827]">LiveNos</h3>
              <p className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                {hasNotifications ? `${state.total} conversación/es pendiente/s` : "Sin mensajes nuevos"}
              </p>
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={() => loadNotificationState()}
                disabled={state.loading}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-white hover:text-[#111827] disabled:opacity-50"
                title="Actualizar"
              >
                <RefreshCcw
                  size={14}
                  strokeWidth={1.8}
                  className={state.loading ? "animate-spin" : ""}
                />
              </button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-white hover:text-[#111827]"
                title="Cerrar"
              >
                <X size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {state.items.length === 0 ? (
            <div className="p-5 text-center text-xs font-normal text-[#64748b]">
              No hay conversaciones pendientes.
            </div>
          ) : (
            <div className="max-h-[390px] overflow-auto p-2">
              {state.items.map((item) => (
                <button
                  key={`${item.conversationId}-${item.messageId || "conversation"}`}
                  type="button"
                  onClick={() => openLiveNosItem(item)}
                  className="mb-2 flex w-full items-start gap-3 rounded-2xl border border-black/5 bg-white p-3 text-left transition last:mb-0 hover:border-red-200 hover:bg-red-50/45"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600">
                    <MessageCircle size={17} strokeWidth={1.9} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[12.5px] font-semibold text-[#111827]">
                          {item.title}
                        </div>

                        {item.phone ? (
                          <div className="mt-0.5 truncate text-[10.5px] font-normal text-[#94a3b8]">
                            {item.phone}
                          </div>
                        ) : null}
                      </div>

                      <div className="shrink-0 text-[10px] font-normal text-[#94a3b8]">
                        {formatTime(item.at)}
                      </div>
                    </div>

                    <div className="mt-1.5 line-clamp-2 text-[11.5px] font-normal leading-relaxed text-[#475569]">
                      {item.preview}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {item.unreadCount > 0 ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-red-700">
                          {item.unreadCount} mensaje/s sin leer
                        </span>
                      ) : null}

                      {item.isSinAtender ? (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-amber-700">
                          Sin atender
                        </span>
                      ) : null}

                      <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-medium uppercase tracking-wide text-[#64748b]">
                        {item.type}
                      </span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-black/10 bg-[#f8fafc] px-3 py-3">
            <button
              type="button"
              onClick={() => openLiveNosItem()}
              className="h-9 w-full rounded-xl bg-[#172033] text-xs font-semibold text-white hover:bg-[#0f172a]"
            >
              Abrir LiveNos
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default LiveNosNotificationBell;