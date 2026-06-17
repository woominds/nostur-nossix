import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, Volume2, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type NotificationKind = "incoming_managed" | "incoming_new" | "cande_transfer";

type ConversationLite = {
  id: string;
  contacto_id: string | null;
  assigned_to: string | null;
  estado_gestion: string | null;
  inbox: string | null;
  wa_phone: string | null;
  titulo: string | null;
  subject: string | null;
  last_message_preview: string | null;
};

type ContactLite = {
  id: string;
  display_name: string | null;
  profile_name: string | null;
  wa_phone: string | null;
};

type OpportunityLite = {
  id: string;
  conversacion_id: string;
  score: number | null;
  datos: Record<string, unknown> | null;
  cande_activa: boolean | null;
  cande_handoff_requested_at: string | null;
};

type MensajeRealtime = {
  id: string;
  conversacion_id: string;
  direction: string;
  type: string;
  text: string | null;
  sender_kind: string | null;
  created_at?: string | null;
  wa_timestamp?: string | null;
};

const STORAGE_ENABLED_KEY = "nostur_livenos_notifications_enabled";

const STORAGE_LAST_CLICK_KEY = "nostur_livenos_last_notification_click";

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function getDisplayName(contact?: ContactLite | null, conversation?: ConversationLite | null): string {
  return (
    cleanText(contact?.display_name) ||
    cleanText(contact?.profile_name) ||
    cleanText(conversation?.titulo) ||
    cleanText(conversation?.subject) ||
    cleanText(conversation?.wa_phone) ||
    "Pasajero"
  );
}

function getDato(datos: Record<string, unknown> | null | undefined, keys: string[]): string {
  if (!datos) return "";

  for (const key of keys) {
    const value = datos[key];

    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }

  return "";
}

function getMessagePreview(message: MensajeRealtime): string {
  const text = cleanText(message.text);

  if (text) return text.slice(0, 160);

  if (message.type === "audio") return "Audio recibido";
  if (message.type === "image") return "Imagen recibida";
  if (message.type === "document") return "Documento recibido";

  return "Nuevo mensaje recibido";
}

function isInboundMessage(message: MensajeRealtime): boolean {
  return message.direction === "in" || message.direction === "inbound";
}

function isBrowserNotificationAvailable(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

async function requestBrowserNotificationPermission() {
  if (!isBrowserNotificationAvailable()) return "unsupported";

  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";

  return await Notification.requestPermission();
}

function openConversation(conversationId: string) {
  if (!conversationId) return;

  window.localStorage.setItem(STORAGE_LAST_CLICK_KEY, conversationId);

  window.dispatchEvent(
    new CustomEvent("nostur:open-internal", {
      detail: {
        moduleId: "livenos",
        title: "LiveNos"
      }
    })
  );

  window.dispatchEvent(
    new CustomEvent("nostur:open-livenos-conversation", {
      detail: {
        conversationId
      }
    })
  );
}

function createAudioContext(): AudioContext | null {
  const AudioContextClass =
    window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextClass) return null;

  return new AudioContextClass();
}

function playToneSequence(kind: NotificationKind) {
  try {
    const context = createAudioContext();

    if (!context) return;

    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;

    const sequence =
      kind === "incoming_new"
        ? [
            { frequency: 880, start: 0, duration: 0.16, gain: 0.22 },
            { frequency: 1046, start: 0.19, duration: 0.18, gain: 0.24 },
            { frequency: 1318, start: 0.42, duration: 0.22, gain: 0.24 }
          ]
        : kind === "cande_transfer"
          ? [
              { frequency: 659, start: 0, duration: 0.18, gain: 0.2 },
              { frequency: 988, start: 0.2, duration: 0.22, gain: 0.23 },
              { frequency: 784, start: 0.46, duration: 0.26, gain: 0.22 }
            ]
          : [
              { frequency: 740, start: 0, duration: 0.11, gain: 0.14 },
              { frequency: 880, start: 0.16, duration: 0.11, gain: 0.14 }
            ];

    sequence.forEach((item) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();

      oscillator.type = kind === "incoming_new" ? "triangle" : "sine";
      oscillator.frequency.setValueAtTime(item.frequency, now + item.start);

      gain.gain.setValueAtTime(0.0001, now + item.start);
      gain.gain.exponentialRampToValueAtTime(item.gain, now + item.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.start + item.duration);

      oscillator.connect(gain);
      gain.connect(context.destination);

      oscillator.start(now + item.start);
      oscillator.stop(now + item.start + item.duration + 0.04);
    });

    window.setTimeout(() => {
      void context.close();
    }, 1200);
  } catch {
    // No bloqueamos la app si el sistema impide reproducir sonido.
  }
}

export function LiveNosNotificationsProvider() {
  const [enabled, setEnabled] = useState(() => {
    return window.localStorage.getItem(STORAGE_ENABLED_KEY) === "true";
  });



  const [showPermissionBanner, setShowPermissionBanner] = useState(() => {
    return window.localStorage.getItem(STORAGE_ENABLED_KEY) !== "true";
  });

  const enabledRef = useRef(enabled);
  
  const knownMessageIdsRef = useRef<Set<string>>(new Set());
  const handoffCacheRef = useRef<Map<string, string>>(new Map());
  const lastSoundAtRef = useRef<Record<NotificationKind, number>>({
    incoming_managed: 0,
    incoming_new: 0,
    cande_transfer: 0
  });

  useEffect(() => {
    enabledRef.current = enabled;
    window.localStorage.setItem(STORAGE_ENABLED_KEY, enabled ? "true" : "false");
  }, [enabled]);

 

  const notifyDesktop = useCallback(
    async (params: {
      kind: NotificationKind;
      title: string;
      body: string;
      conversationId: string;
      messageId?: string;
    }) => {
      if (!enabledRef.current) return;

      if (window.nostur?.notify) {
        await window.nostur.notify({
          title: params.title,
          body: params.body,
          conversationId: params.conversationId,
          messageId: params.messageId
        });

        return;
      }

      if (!isBrowserNotificationAvailable()) return;
      if (Notification.permission !== "granted") return;

      const notification = new Notification(params.title, {
        body: params.body,
        silent: true
      });

      notification.onclick = () => {
        window.focus();
        openConversation(params.conversationId);
      };
    },
    []
  );

  const playSound = useCallback((kind: NotificationKind) => {
   if (!enabledRef.current) return;

    const now = Date.now();
    const last = lastSoundAtRef.current[kind] || 0;

    if (now - last < 900) return;

    lastSoundAtRef.current[kind] = now;
    playToneSequence(kind);
  }, []);

  const loadConversationContext = useCallback(async (conversationId: string) => {
    const { data: conversation } = await supabase
      .from("conversaciones")
      .select("id,contacto_id,assigned_to,estado_gestion,inbox,wa_phone,titulo,subject,last_message_preview")
      .eq("id", conversationId)
      .maybeSingle();

    const conv = (conversation || null) as ConversationLite | null;

    let contact: ContactLite | null = null;

    if (conv?.contacto_id) {
      const { data: contactData } = await supabase
        .from("contactos_wa")
        .select("id,display_name,profile_name,wa_phone")
        .eq("id", conv.contacto_id)
        .maybeSingle();

      contact = (contactData || null) as ContactLite | null;
    }

    const { data: opportunity } = await supabase
      .from("lead_oportunidades")
      .select("id,conversacion_id,score,datos,cande_activa,cande_handoff_requested_at")
      .eq("conversacion_id", conversationId)
      .maybeSingle();

    return {
      conversation: conv,
      contact,
      opportunity: (opportunity || null) as OpportunityLite | null
    };
  }, []);

  const handleInboundMessage = useCallback(
    async (message: MensajeRealtime) => {
      if (!enabledRef.current) return;
      if (!message?.id || !message?.conversacion_id) return;
      if (!isInboundMessage(message)) return;
      if (knownMessageIdsRef.current.has(message.id)) return;

      knownMessageIdsRef.current.add(message.id);

      const { conversation, contact } = await loadConversationContext(message.conversacion_id);

      if (!conversation?.id) return;

      const passengerName = getDisplayName(contact, conversation);
      const preview = getMessagePreview(message);

      const isNewOrUnassigned =
        !conversation.assigned_to ||
        conversation.estado_gestion === "sin_atender" ||
        conversation.inbox === "sin_atender";

      const kind: NotificationKind = isNewOrUnassigned ? "incoming_new" : "incoming_managed";

      playSound(kind);

      await notifyDesktop({
        kind,
        title: isNewOrUnassigned ? "Nuevo pasajero sin atender" : `Nuevo mensaje de ${passengerName}`,
        body: isNewOrUnassigned ? `${passengerName}: ${preview}` : preview,
        conversationId: conversation.id,
        messageId: message.id
      });
    },
    [loadConversationContext, notifyDesktop, playSound]
  );

  const handleCandeTransfer = useCallback(
    async (opportunity: OpportunityLite) => {
      if (!enabledRef.current) return;
      if (!opportunity?.id || !opportunity?.conversacion_id) return;
      if (!opportunity.cande_handoff_requested_at) return;

      const previous = handoffCacheRef.current.get(opportunity.id);

      if (previous === opportunity.cande_handoff_requested_at) return;

      handoffCacheRef.current.set(opportunity.id, opportunity.cande_handoff_requested_at);

      const { conversation, contact } = await loadConversationContext(opportunity.conversacion_id);

      if (!conversation?.id) return;

      const passengerName = getDisplayName(contact, conversation);
      const datos = opportunity.datos || {};
      const destino = getDato(datos, ["destino", "destinos", "lugar"]);
      const pasajeros = getDato(datos, ["cantidad_pasajeros", "pasajeros", "pax", "personas"]);
      const score = Number(opportunity.score || 0);

      const bodyParts = [
        passengerName,
        destino ? `Destino: ${destino}` : "",
        pasajeros ? `Pax: ${pasajeros}` : "",
        score ? `Score ${score}` : ""
      ].filter(Boolean);

      playSound("cande_transfer");

      await notifyDesktop({
        kind: "cande_transfer",
        title: "Cande derivó una oportunidad",
        body: bodyParts.join(" · ") || "Hay una oportunidad lista para tomar.",
        conversationId: conversation.id
      });
    },
    [loadConversationContext, notifyDesktop, playSound]
  );

  const initializeKnownState = useCallback(async () => {
    const [{ data: recentMessages }, { data: opportunities }] = await Promise.all([
      supabase
        .from("mensajes")
        .select("id")
        .order("created_at", { ascending: false })
        .limit(80),
      supabase
        .from("lead_oportunidades")
        .select("id,cande_handoff_requested_at")
        .not("cande_handoff_requested_at", "is", null)
        .order("updated_at", { ascending: false })
        .limit(200)
    ]);

    (recentMessages || []).forEach((message) => {
      if (message.id) knownMessageIdsRef.current.add(message.id);
    });

    (opportunities || []).forEach((opportunity) => {
      if (opportunity.id && opportunity.cande_handoff_requested_at) {
        handoffCacheRef.current.set(opportunity.id, opportunity.cande_handoff_requested_at);
      }
    });
  }, []);

  useEffect(() => {
    if (!enabled) return;

    void initializeKnownState();

    const channelName = `nostur-global-livenos-notifications-${Date.now()}`;

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes"
        },
        (payload) => {
          void handleInboundMessage(payload.new as MensajeRealtime);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "lead_oportunidades"
        },
        (payload) => {
          void handleCandeTransfer(payload.new as OpportunityLite);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, handleInboundMessage, handleCandeTransfer, initializeKnownState]);

  const enableNotifications = useCallback(async () => {
    const permission = await requestBrowserNotificationPermission();

    if (permission === "denied") {
      setShowPermissionBanner(true);
      return;
    }

   setEnabled(true);
setShowPermissionBanner(false);

    playToneSequence("incoming_managed");
  }, []);

 

if (!showPermissionBanner && enabled) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[130]">
      <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white/90 px-3 py-2 text-xs font-black text-emerald-700 shadow-lg backdrop-blur-xl">
        <Volume2 size={14} />
        Avisos LiveNos activos
      </div>
    </div>
  );
}

  if (!showPermissionBanner) return null;

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[130]">
      <div className="pointer-events-auto w-[360px] rounded-[24px] border border-amber-200 bg-white p-4 shadow-2xl">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Bell size={20} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-sm font-black text-[#142033]">Activar avisos de LiveNos</div>
            <p className="mt-1 text-xs font-bold leading-relaxed text-[#64748b]">
              Esto habilita sonidos y notificaciones aunque estés trabajando en otro módulo del sistema.
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={enableNotifications}
                className="h-9 rounded-2xl bg-[#4f7c90] px-3 text-xs font-black text-white hover:bg-[#406b7d]"
              >
                Activar avisos
              </button>

              <button
                type="button"
                onClick={() => setShowPermissionBanner(false)}
                className="h-9 rounded-2xl bg-[#f1f5f9] px-3 text-xs font-black text-[#64748b] hover:bg-[#e2e8f0]"
              >
                Después
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowPermissionBanner(false)}
            className="rounded-xl p-1 text-[#94a3b8] hover:bg-[#f1f5f9] hover:text-[#475569]"
          >
            <X size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}