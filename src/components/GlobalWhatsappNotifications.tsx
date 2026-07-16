// src/components/GlobalWhatsappNotifications.tsx

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabase";

type NotificationKind =
  | "nuevo"
  | "gestion"
  | "cande_transfer"
  | "internal";

type ConversationLite = {
  id: string;
  wa_phone: string | null;
  titulo: string | null;
  subject: string | null;
  estado_gestion: string | null;
  inbox: string | null;
  assigned_to: string | null;
  tomada_by: string | null;
  last_message_preview: string | null;
  deleted_at: string | null;
};

type OpportunityLite = {
  id: string;
  conversacion_id: string;
  cande_activa: boolean | null;
  cande_handoff_requested_at: string | null;
  score: number | null;
  datos: Record<string, unknown> | null;
};

type NotificationProfileLite = {
  id: string;
  rol: string | null;
  activo: boolean | null;
  is_support_user?: boolean | null;
  is_super_admin?: boolean | null;
};

type IncomingMessagePayload = {
  id: string;
  conversacion_id: string;
  direction: string;
  sender_kind: string | null;
  type: string | null;
  text: string | null;
  created_at: string | null;
  wa_timestamp: string | null;
};

type InternalNotePayload = {
  id: string;
  conversacion_id: string;
  autor_id: string | null;
  contenido: string | null;
  tipo: string | null;
  created_at: string | null;
};

type InternalNotificationPayload = {
  title: string;
  subtitle?: string;
  body: string;
  conversationId?: string;
  messageId?: string;
  appFocused?: boolean;
  createdAt?: string;
};

type VisibleToast = InternalNotificationPayload & {
  id: string;
};

type NosturBridge = {
  notify?: (
    payload: Record<string, unknown>
  ) => Promise<unknown>;

  notifyNewMessage?: (
    payload: Record<string, unknown>
  ) => Promise<unknown>;

  playNotificationSound?: (
    payload: Record<string, unknown>
  ) => Promise<unknown>;

  onInternalNotification?: (
    callback: (payload: InternalNotificationPayload) => void
  ) => () => void;

  onOpenConversationFromNotification?: (
    callback: (payload: {
      conversationId?: string;
      conversation_id?: string;
    }) => void
  ) => () => void;
};

function getNosturBridge(): NosturBridge | null {
  const possibleWindow = window as unknown as {
    nostur?: NosturBridge;
  };

  return possibleWindow.nostur || null;
}

function logInfo(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.log(`[GlobalWhatsappNotifications] ${message}`);
    return;
  }

  try {
    console.log(
      `[GlobalWhatsappNotifications] ${message}`,
      JSON.stringify(payload, null, 2)
    );
  } catch {
    console.log(
      `[GlobalWhatsappNotifications] ${message}`,
      payload
    );
  }
}

function logWarn(message: string, payload?: unknown) {
  if (payload === undefined) {
    console.warn(`[GlobalWhatsappNotifications] ${message}`);
    return;
  }

  try {
    console.warn(
      `[GlobalWhatsappNotifications] ${message}`,
      JSON.stringify(payload, null, 2)
    );
  } catch {
    console.warn(
      `[GlobalWhatsappNotifications] ${message}`,
      payload
    );
  }
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function truncateText(value: string, max = 120): string {
  const clean = cleanText(value).replace(/\s+/g, " ");

  if (clean.length <= max) return clean;

  return `${clean.slice(0, max - 1)}…`;
}

function canProfileReceiveAllNotifications(
  profile: NotificationProfileLite | null | undefined
): boolean {
  if (!profile || profile.activo === false) {
    return false;
  }

  const role = cleanText(profile.rol).toLowerCase();

  return (
    role === "gerencia" ||
    role === "admin_general" ||
    profile.is_support_user === true ||
    profile.is_super_admin === true
  );
}

function getConversationOwnerId(
  conversation: ConversationLite | null
): string | null {
  return (
    cleanText(conversation?.assigned_to) ||
    cleanText(conversation?.tomada_by) ||
    null
  );
}

function canReceiveConversationNotification(params: {
  conversation: ConversationLite | null;
  currentUserId: string | null;
  currentProfile: NotificationProfileLite | null;
}): boolean {
  const {
    conversation,
    currentUserId,
    currentProfile
  } = params;

  if (!currentUserId) {
    return false;
  }

  if (!conversation || conversation.deleted_at) {
    return false;
  }

  /*
   * Gerencia, admin general, soporte y super admin
   * reciben notificaciones de todas las conversaciones.
   */
  if (canProfileReceiveAllNotifications(currentProfile)) {
    return true;
  }

  /*
   * El resto de usuarios solamente recibe notificaciones
   * de las conversaciones que tiene asignadas o tomadas.
   *
   * Una conversación sin asignar no genera notificación
   * para vendedores.
   */
  return getConversationOwnerId(conversation) === currentUserId;
}

function getConversationName(
  conversation: ConversationLite | null
): string {
  return (
    cleanText(conversation?.titulo) ||
    cleanText(conversation?.subject) ||
    cleanText(conversation?.wa_phone) ||
    "Pasajero"
  );
}

function isInboundMessage(
  message: IncomingMessagePayload
): boolean {
  const direction = cleanText(message.direction).toLowerCase();

  return direction === "in" || direction === "inbound";
}

function shouldIgnoreMessage(
  message: IncomingMessagePayload
): boolean {
  if (!message?.id) {
    logWarn("Ignorado: mensaje sin id", message);
    return true;
  }

  if (!message.conversacion_id) {
    logWarn(
      "Ignorado: mensaje sin conversacion_id",
      message
    );

    return true;
  }

  if (!isInboundMessage(message)) {
    logWarn("Ignorado: no es inbound", {
      id: message.id,
      direction: message.direction,
      sender_kind: message.sender_kind,
      type: message.type,
      text: message.text
    });

    return true;
  }

  const senderKind = cleanText(
    message.sender_kind
  ).toLowerCase();

  if (
    senderKind === "cande" ||
    senderKind === "nia" ||
    senderKind === "sistema"
  ) {
    logWarn("Ignorado: inbound de sistema/IA", {
      id: message.id,
      direction: message.direction,
      sender_kind: message.sender_kind,
      type: message.type,
      text: message.text
    });

    return true;
  }

  return false;
}

function getMessagePreview(
  message: IncomingMessagePayload
): string {
  const text = cleanText(message.text);

  if (text) {
    return truncateText(text);
  }

  const type = cleanText(message.type).toLowerCase();

  if (type === "audio") return "Audio recibido";
  if (type === "image") return "Imagen recibida";
  if (type === "document") return "Archivo recibido";
  if (type === "video") return "Video recibido";

  return "Nuevo mensaje recibido";
}

function classifyNotification(params: {
  conversation: ConversationLite | null;
  opportunity: OpportunityLite | null;
}): NotificationKind {
  const conversation = params.conversation;
  const opportunity = params.opportunity;

  if (opportunity?.cande_handoff_requested_at) {
    const handoffTime = new Date(
      opportunity.cande_handoff_requested_at
    ).getTime();

    const recently =
      Number.isFinite(handoffTime) &&
      Date.now() - handoffTime < 90_000;

    if (recently) {
      return "cande_transfer";
    }
  }

  const estadoGestion = cleanText(
    conversation?.estado_gestion
  ).toLowerCase();

  const inbox = cleanText(
    conversation?.inbox
  ).toLowerCase();

  const ownerId = getConversationOwnerId(conversation);

  if (
    !ownerId ||
    estadoGestion === "sin_atender" ||
    inbox === "sin_atender"
  ) {
    return "nuevo";
  }

  return "gestion";
}

function getNotificationTitle(
  kind: NotificationKind,
  passengerName: string
): string {
  if (kind === "cande_transfer") {
    return `CANDE derivó a ${passengerName}`;
  }

  if (kind === "nuevo") {
    return `Nuevo pasajero · ${passengerName}`;
  }

  if (kind === "internal") {
    return `Mensaje interno · ${passengerName}`;
  }

  return `Nuevo mensaje · ${passengerName}`;
}

function getNotificationBody(
  kind: NotificationKind,
  preview: string
): string {
  if (kind === "cande_transfer") {
    return `Requiere atención de vendedor. ${preview}`;
  }

  if (kind === "nuevo") {
    return `Mensaje sin atender. ${preview}`;
  }

  return preview;
}

function playTone(params: {
  frequency: number;
  durationMs: number;
  volume: number;
  repeat?: number;
  gapMs?: number;
  type?: OscillatorType;
}) {
  const repeat = params.repeat || 1;
  const gapMs = params.gapMs || 120;
  const oscillatorType = params.type || "square";

  for (let index = 0; index < repeat; index += 1) {
    window.setTimeout(() => {
      try {
        const AudioContextClass =
          window.AudioContext ||
          (
            window as unknown as {
              webkitAudioContext?: typeof AudioContext;
            }
          ).webkitAudioContext;

        if (!AudioContextClass) {
          return;
        }

        const audioContext = new AudioContextClass();
        const oscillator = audioContext.createOscillator();
        const gain = audioContext.createGain();

        oscillator.type = oscillatorType;
        oscillator.frequency.value = params.frequency;

        const safeVolume = Math.min(
          Math.max(params.volume, 0.01),
          0.95
        );

        gain.gain.setValueAtTime(
          0.0001,
          audioContext.currentTime
        );

        gain.gain.exponentialRampToValueAtTime(
          safeVolume,
          audioContext.currentTime + 0.012
        );

        gain.gain.exponentialRampToValueAtTime(
          0.0001,
          audioContext.currentTime +
            params.durationMs / 1000
        );

        oscillator.connect(gain);
        gain.connect(audioContext.destination);

        oscillator.start();

        oscillator.stop(
          audioContext.currentTime +
            params.durationMs / 1000 +
            0.04
        );

        oscillator.onended = () => {
          void audioContext.close();
        };
      } catch {
        // No bloquear la aplicación si falla el audio.
      }
    }, index * (params.durationMs + gapMs));
  }
}

function playRendererTone(kind: NotificationKind) {
  logInfo("Intento reproducir sonido renderer", {
    kind
  });

  if (kind === "cande_transfer") {
    playTone({
      frequency: 660,
      durationMs: 120,
      volume: 0.34,
      repeat: 1,
      gapMs: 70,
      type: "triangle"
    });

    window.setTimeout(() => {
      playTone({
        frequency: 880,
        durationMs: 150,
        volume: 0.38,
        repeat: 1,
        gapMs: 80,
        type: "sine"
      });
    }, 170);

    window.setTimeout(() => {
      playTone({
        frequency: 740,
        durationMs: 180,
        volume: 0.32,
        repeat: 1,
        type: "triangle"
      });
    }, 390);

    return;
  }

  if (kind === "nuevo") {
    playTone({
      frequency: 720,
      durationMs: 120,
      volume: 0.36,
      repeat: 1,
      gapMs: 70,
      type: "triangle"
    });

    window.setTimeout(() => {
      playTone({
        frequency: 920,
        durationMs: 140,
        volume: 0.4,
        repeat: 1,
        gapMs: 70,
        type: "sine"
      });
    }, 170);

    window.setTimeout(() => {
      playTone({
        frequency: 760,
        durationMs: 170,
        volume: 0.34,
        repeat: 1,
        type: "triangle"
      });
    }, 370);

    return;
  }

  if (kind === "internal") {
    playTone({
      frequency: 620,
      durationMs: 110,
      volume: 0.28,
      repeat: 1,
      gapMs: 60,
      type: "triangle"
    });

    window.setTimeout(() => {
      playTone({
        frequency: 780,
        durationMs: 130,
        volume: 0.3,
        repeat: 1,
        type: "sine"
      });
    }, 160);

    return;
  }

  playTone({
    frequency: 680,
    durationMs: 110,
    volume: 0.3,
    repeat: 1,
    gapMs: 70,
    type: "triangle"
  });

  window.setTimeout(() => {
    playTone({
      frequency: 840,
      durationMs: 135,
      volume: 0.28,
      repeat: 1,
      type: "sine"
    });
  }, 170);
}

async function playNotificationSound(
  kind: NotificationKind
) {
  const bridge = getNosturBridge();

  try {
    if (bridge?.playNotificationSound) {
      const played = await bridge.playNotificationSound({
        kind
      });

      if (played) {
        logInfo("Sonido Electron ejecutado", {
          kind
        });
      }
    }
  } catch (error) {
    logWarn("No se pudo ejecutar sonido Electron", {
      kind,
      error:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }

  /*
   * Se conserva el tono del renderer como respaldo.
   */
  playRendererTone(kind);
}

async function loadNotificationContext(
  conversationId: string
) {
  const [
    conversationRes,
    opportunityRes
  ] = await Promise.all([
    supabase
      .from("conversaciones")
      .select(
        [
          "id",
          "wa_phone",
          "titulo",
          "subject",
          "estado_gestion",
          "inbox",
          "assigned_to",
          "tomada_by",
          "last_message_preview",
          "deleted_at"
        ].join(",")
      )
      .eq("id", conversationId)
      .maybeSingle(),

    supabase
      .from("lead_oportunidades")
      .select(
        [
          "id",
          "conversacion_id",
          "cande_activa",
          "cande_handoff_requested_at",
          "score",
          "datos"
        ].join(",")
      )
      .eq("conversacion_id", conversationId)
      .maybeSingle()
  ]);

  if (conversationRes.error) {
    logWarn(
      "Error cargando conversación para notificación",
      conversationRes.error.message
    );
  }

  if (opportunityRes.error) {
    logWarn(
      "Error cargando oportunidad para notificación",
      opportunityRes.error.message
    );
  }

  return {
    conversation:
      (conversationRes.data || null) as unknown as
        | ConversationLite
        | null,

    opportunity:
      (opportunityRes.data || null) as unknown as
        | OpportunityLite
        | null
  };
}

async function notifySystem(params: {
  kind: NotificationKind;
  conversation: ConversationLite | null;
  message: IncomingMessagePayload;
}) {
  const passengerName = getConversationName(
    params.conversation
  );

  const preview = getMessagePreview(params.message);

  const title = getNotificationTitle(
    params.kind,
    passengerName
  );

  const body = getNotificationBody(
    params.kind,
    preview
  );

  const conversationId =
    params.conversation?.id ||
    params.message.conversacion_id;

  const messageId = params.message.id;
  const bridge = getNosturBridge();

  try {
    if (bridge?.notify) {
      const result = await bridge.notify({
        title,
        subtitle: "LiveNos",
        body,
        conversationId,
        messageId
      });

      logInfo(
        "Notificación solicitada a Electron",
        {
          result,
          title,
          body,
          kind: params.kind,
          conversationId,
          messageId
        }
      );

      return;
    }

    logWarn("window.nostur.notify no disponible.");
  } catch (error) {
    logWarn(
      "Error solicitando notificación a Electron",
      {
        error:
          error instanceof Error
            ? error.message
            : String(error)
      }
    );
  }
}

function openConversationFromToast(
  conversationId?: string,
  messageId?: string
) {
  if (!conversationId || conversationId === "test") {
    return;
  }

  window.localStorage.setItem(
    "nostur_open_livenos_conversation_id",
    conversationId
  );

  if (messageId) {
    window.localStorage.setItem(
      "nostur_open_livenos_message_id",
      messageId
    );
  }

  window.dispatchEvent(
    new CustomEvent("nostur:open-internal", {
      detail: {
        appId: "livenos",
        moduleId: "livenos",
        url: "internal://livenos",
        title: "LiveNos"
      }
    })
  );

  window.dispatchEvent(
    new CustomEvent(
      "nostur:open-livenos-conversation",
      {
        detail: {
          conversationId,
          messageId
        }
      }
    )
  );
}

function InternalNotificationToast({
  toast,
  onClose
}: {
  toast: VisibleToast | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!toast) {
      return;
    }

    const timer = window.setTimeout(() => {
      onClose();
    }, 7000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [toast, onClose]);

  if (!toast) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        right: 22,
        top: 72,
        zIndex: 99999,
        width: 360,
        maxWidth: "calc(100vw - 44px)",
        borderRadius: 20,
        border:
          "1px solid rgba(15, 23, 42, 0.10)",
        background: "rgba(255,255,255,0.96)",
        boxShadow:
          "0 24px 70px rgba(15, 23, 42, 0.22)",
        backdropFilter: "blur(14px)",
        overflow: "hidden",
        color: "#172033"
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={() => {
          openConversationFromToast(
            toast.conversationId,
            toast.messageId
          );

          onClose();
        }}
        onKeyDown={(event) => {
          if (
            event.key !== "Enter" &&
            event.key !== " "
          ) {
            return;
          }

          event.preventDefault();

          openConversationFromToast(
            toast.conversationId,
            toast.messageId
          );

          onClose();
        }}
        style={{
          display: "block",
          width: "100%",
          border: 0,
          background: "transparent",
          padding: 0,
          textAlign: "left",
          cursor: "pointer"
        }}
      >
        <div
          style={{
            display: "flex",
            gap: 12,
            padding: 14,
            alignItems: "flex-start"
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background:
                toast.title
                  ?.toLowerCase()
                  .includes("nuevo pasajero") ||
                toast.title
                  ?.toLowerCase()
                  .includes("whatsapp") ||
                toast.title
                  ?.toLowerCase()
                  .includes("cande")
                  ? "linear-gradient(135deg, #ef4444, #991b1b)"
                  : "linear-gradient(135deg, #4f7c90, #172033)",
              color: "white",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 15,
              fontWeight: 800,
              flexShrink: 0
            }}
          >
            N
          </div>

          <div
            style={{
              minWidth: 0,
              flex: 1
            }}
          >
            <div
              style={{
                fontSize: 13,
                fontWeight: 800,
                color: "#172033",
                lineHeight: 1.25,
                marginBottom: 4
              }}
            >
              {toast.title || "Nuevo mensaje"}
            </div>

            <div
              style={{
                fontSize: 12,
                fontWeight: 500,
                color: "#475569",
                lineHeight: 1.45,
                wordBreak: "break-word"
              }}
            >
              {toast.body ||
                "Nuevo mensaje recibido"}
            </div>

            <div
              style={{
                marginTop: 8,
                fontSize: 11,
                fontWeight: 700,
                color: "#4f7c90"
              }}
            >
              Tocar para abrir conversación
            </div>
          </div>

          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }}
            style={{
              width: 26,
              height: 26,
              borderRadius: 10,
              border:
                "1px solid rgba(15, 23, 42, 0.08)",
              background: "#f8fafc",
              color: "#64748b",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: "22px",
              flexShrink: 0
            }}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  );
}

export function GlobalWhatsappNotifications() {
  const processedMessagesRef = useRef<Set<string>>(
    new Set()
  );

  const lastHandoffByOpportunityRef = useRef<
    Record<string, string>
  >({});

  const currentUserIdRef = useRef<string | null>(
    null
  );

  const currentProfileRef =
    useRef<NotificationProfileLite | null>(null);

  const notificationIdentityReadyRef =
    useRef<Promise<void> | null>(null);

  const [internalToast, setInternalToast] =
    useState<VisibleToast | null>(null);

  async function loadNotificationIdentity() {
    if (notificationIdentityReadyRef.current) {
      await notificationIdentityReadyRef.current;
      return;
    }

    notificationIdentityReadyRef.current =
      (async () => {
        const {
          data: authData,
          error: authError
        } = await supabase.auth.getUser();

        const userId = authData.user?.id || null;

        if (authError || !userId) {
          currentUserIdRef.current = null;
          currentProfileRef.current = null;

          logWarn(
            "No se pudo identificar usuario para notificaciones",
            {
              error: authError?.message || null
            }
          );

          return;
        }

        currentUserIdRef.current = userId;

        const {
          data: profileData,
          error: profileError
        } = await supabase
          .from("profiles")
          .select(
            [
              "id",
              "rol",
              "activo",
              "is_support_user",
              "is_super_admin"
            ].join(",")
          )
          .eq("id", userId)
          .maybeSingle();

        if (profileError) {
          currentProfileRef.current = null;

          logWarn(
            "No se pudo cargar perfil para notificaciones",
            {
              userId,
              error: profileError.message
            }
          );

          return;
        }

        currentProfileRef.current =
          (profileData || null) as unknown as
            | NotificationProfileLite
            | null;

        logInfo(
          "Identidad de notificaciones cargada",
          {
            userId,
            rol:
              currentProfileRef.current?.rol ||
              null,
            canReceiveAll:
              canProfileReceiveAllNotifications(
                currentProfileRef.current
              )
          }
        );
      })();

    await notificationIdentityReadyRef.current;
  }

  async function userCanReceiveNotification(
    conversation: ConversationLite | null
  ): Promise<boolean> {
    await loadNotificationIdentity();

    const allowed =
      canReceiveConversationNotification({
        conversation,
        currentUserId: currentUserIdRef.current,
        currentProfile: currentProfileRef.current
      });

    if (!allowed) {
      logInfo(
        "Notificación ignorada por destinatario",
        {
          currentUserId:
            currentUserIdRef.current,
          currentRole:
            currentProfileRef.current?.rol ||
            null,
          conversationId:
            conversation?.id || null,
          assignedTo:
            conversation?.assigned_to || null,
          tomadaBy:
            conversation?.tomada_by || null,
          deletedAt:
            conversation?.deleted_at || null
        }
      );
    }

    return allowed;
  }

  function fireVisibleNotification(params: {
    title: string;
    body: string;
    conversationId?: string;
    messageId?: string;
    createdAt?: string | null;
  }) {
    logInfo(
      "Muestro toast interno",
      params
    );

    setInternalToast({
      id:
        params.messageId ||
        `toast:${Date.now()}`,
      title: params.title,
      subtitle: "LiveNos",
      body: params.body,
      conversationId: params.conversationId,
      messageId: params.messageId,
      appFocused: true,
      createdAt:
        params.createdAt ||
        new Date().toISOString()
    });
  }

  useEffect(() => {
    logInfo(
      "Componente montado correctamente"
    );

    void loadNotificationIdentity();

    const { data: authListener } =
      supabase.auth.onAuthStateChange(() => {
        currentUserIdRef.current = null;
        currentProfileRef.current = null;
        notificationIdentityReadyRef.current =
          null;

        void loadNotificationIdentity();
      });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const bridge = getNosturBridge();

    if (!bridge?.onInternalNotification) {
      return undefined;
    }

    const unsubscribe =
      bridge.onInternalNotification((payload) => {
        logInfo(
          "Notificación interna recibida desde Electron",
          payload
        );

        if (!payload?.appFocused) {
          return;
        }

        setInternalToast({
          id:
            payload.messageId ||
            `${Date.now()}`,
          title:
            payload.title ||
            "Nuevo mensaje",
          subtitle:
            payload.subtitle || "NOSTUR",
          body:
            payload.body ||
            "Nuevo mensaje recibido",
          conversationId:
            payload.conversationId,
          messageId: payload.messageId,
          appFocused: payload.appFocused,
          createdAt: payload.createdAt
        });
      });

    return unsubscribe;
  }, []);

  useEffect(() => {
    const bridge = getNosturBridge();

    if (
      !bridge?.onOpenConversationFromNotification
    ) {
      return undefined;
    }

    const unsubscribe =
      bridge.onOpenConversationFromNotification(
        (payload) => {
          const conversationId = cleanText(
            payload?.conversationId ||
              payload?.conversation_id
          );

          if (!conversationId) {
            return;
          }

          openConversationFromToast(
            conversationId
          );
        }
      );

    return unsubscribe;
  }, []);

  useEffect(() => {
    let mounted = true;
    let pollingTimer: number | null = null;

    const pollingStartedAt = new Date(
      Date.now() - 5000
    ).toISOString();

    async function handleIncomingMessage(
      message: IncomingMessagePayload
    ) {
      if (!mounted) return;

      logInfo("Evento mensaje", {
        id: message.id,
        conversacion_id:
          message.conversacion_id,
        direction: message.direction,
        sender_kind: message.sender_kind,
        type: message.type,
        text: message.text,
        created_at: message.created_at,
        wa_timestamp: message.wa_timestamp
      });

      if (shouldIgnoreMessage(message)) {
        logInfo("Mensaje ignorado", {
          id: message.id,
          direction: message.direction,
          sender_kind: message.sender_kind,
          type: message.type,
          text: message.text
        });

        return;
      }

      if (
        processedMessagesRef.current.has(
          message.id
        )
      ) {
        logWarn(
          "Ignorado: mensaje ya procesado",
          {
            id: message.id
          }
        );

        return;
      }

      processedMessagesRef.current.add(
        message.id
      );

      if (
        processedMessagesRef.current.size >
        300
      ) {
        processedMessagesRef.current =
          new Set(
            Array.from(
              processedMessagesRef.current
            ).slice(-120)
          );
      }

      const conversationId = cleanText(
        message.conversacion_id
      );

      if (!conversationId) {
        logWarn(
          "Ignorado: conversationId vacío",
          message
        );

        return;
      }

      const {
        conversation,
        opportunity
      } = await loadNotificationContext(
        conversationId
      );

      const canReceive =
        await userCanReceiveNotification(
          conversation
        );

      if (!canReceive) {
        return;
      }

      const kind = classifyNotification({
        conversation,
        opportunity
      });

      logInfo(
        "Mensaje inbound válido. Disparo sonido y notificación",
        {
          kind,
          messageId: message.id,
          conversationId,
          passenger:
            getConversationName(
              conversation
            ),
          preview:
            getMessagePreview(message),
          estado_gestion:
            conversation?.estado_gestion,
          inbox: conversation?.inbox,
          assigned_to:
            conversation?.assigned_to,
          tomada_by:
            conversation?.tomada_by
        }
      );

      await playNotificationSound(kind);

      await notifySystem({
        kind,
        conversation,
        message
      });

      const passengerName =
        getConversationName(conversation);

      const preview =
        getMessagePreview(message);

      const title = getNotificationTitle(
        kind,
        passengerName
      );

      const body = getNotificationBody(
        kind,
        preview
      );

      fireVisibleNotification({
        title,
        body,
        conversationId,
        messageId: message.id,
        createdAt:
          message.created_at ||
          new Date().toISOString()
      });

      window.dispatchEvent(
        new CustomEvent(
          "nostur:global-whatsapp-message",
          {
            detail: {
              kind,
              conversation_id:
                conversationId,
              message_id: message.id
            }
          }
        )
      );
    }

    async function handleOpportunityChange(
      opportunity: OpportunityLite
    ) {
      if (!mounted) return;
      if (!opportunity?.id) return;

      if (
        !opportunity.cande_handoff_requested_at
      ) {
        return;
      }

      const previous =
        lastHandoffByOpportunityRef.current[
          opportunity.id
        ];

      if (
        previous ===
        opportunity.cande_handoff_requested_at
      ) {
        return;
      }

      lastHandoffByOpportunityRef.current[
        opportunity.id
      ] =
        opportunity.cande_handoff_requested_at;

      const handoffTime = new Date(
        opportunity.cande_handoff_requested_at
      ).getTime();

      if (!Number.isFinite(handoffTime)) {
        return;
      }

      if (
        Date.now() - handoffTime >
        120_000
      ) {
        return;
      }

      const conversationId = cleanText(
        opportunity.conversacion_id
      );

      if (!conversationId) {
        return;
      }

      const { conversation } =
        await loadNotificationContext(
          conversationId
        );

      const canReceive =
        await userCanReceiveNotification(
          conversation
        );

      if (!canReceive) {
        return;
      }

      logInfo(
        "Handoff de CANDE detectado. Disparo sonido y notificación",
        {
          opportunityId:
            opportunity.id,
          conversationId,
          cande_handoff_requested_at:
            opportunity.cande_handoff_requested_at
        }
      );

      await playNotificationSound(
        "cande_transfer"
      );

      await notifySystem({
        kind: "cande_transfer",
        conversation,
        message: {
          id: `handoff:${opportunity.id}:${opportunity.cande_handoff_requested_at}`,
          conversacion_id:
            conversationId,
          direction: "in",
          sender_kind: "sistema",
          type: "system",
          text:
            "CANDE derivó esta conversación al equipo.",
          created_at:
            opportunity.cande_handoff_requested_at,
          wa_timestamp:
            opportunity.cande_handoff_requested_at
        }
      });

      window.dispatchEvent(
        new CustomEvent(
          "nostur:cande-handoff",
          {
            detail: {
              conversation_id:
                conversationId,
              oportunidad_id:
                opportunity.id
            }
          }
        )
      );
    }

    async function handleInternalNote(
      note: InternalNotePayload
    ) {
      if (!mounted) return;

      const tipo = cleanText(
        note.tipo
      ).toLowerCase();

      if (tipo !== "mensaje_interno") {
        return;
      }

      if (
        !note?.id ||
        !note.conversacion_id
      ) {
        logWarn(
          "Nota interna ignorada: faltan datos",
          note
        );

        return;
      }

      const processedKey =
        `internal:${note.id}`;

      if (
        processedMessagesRef.current.has(
          processedKey
        )
      ) {
        logWarn(
          "Ignorado: mensaje interno ya procesado",
          {
            id: note.id
          }
        );

        return;
      }

      processedMessagesRef.current.add(
        processedKey
      );

      if (
        processedMessagesRef.current.size >
        300
      ) {
        processedMessagesRef.current =
          new Set(
            Array.from(
              processedMessagesRef.current
            ).slice(-120)
          );
      }

      await loadNotificationIdentity();

      const currentUserId =
        currentUserIdRef.current;

      if (
        currentUserId &&
        note.autor_id === currentUserId
      ) {
        logInfo(
          "Mensaje interno propio ignorado",
          {
            id: note.id,
            autor_id: note.autor_id
          }
        );

        return;
      }

      const conversationId = cleanText(
        note.conversacion_id
      );

      const { conversation } =
        await loadNotificationContext(
          conversationId
        );

      const canReceive =
        await userCanReceiveNotification(
          conversation
        );

      if (!canReceive) {
        return;
      }

      let authorName = "Un usuario";

      if (note.autor_id) {
        const {
          data: authorProfile,
          error: authorError
        } = await supabase
          .from("profiles")
          .select(
            "nombre,apellido,email"
          )
          .eq("id", note.autor_id)
          .maybeSingle();

        if (authorError) {
          logWarn(
            "No se pudo cargar autor del mensaje interno",
            {
              authorId: note.autor_id,
              error: authorError.message
            }
          );
        }

        if (authorProfile) {
          authorName =
            `${authorProfile.nombre || ""} ${
              authorProfile.apellido || ""
            }`.trim() ||
            authorProfile.email ||
            "Un usuario";
        }
      }

      const passengerName =
        getConversationName(conversation);

      const preview = truncateText(
        cleanText(note.contenido) ||
          "Nuevo mensaje interno"
      );

      const title =
        `Mensaje interno · ${passengerName}`;

      const body =
        `${authorName}: ${preview}`;

      logInfo(
        "Mensaje interno válido. Disparo sonido y notificación",
        {
          noteId: note.id,
          conversationId,
          passengerName,
          authorName,
          preview
        }
      );

      await playNotificationSound(
        "internal"
      );

      const bridge =
        getNosturBridge();

      try {
        if (bridge?.notify) {
          await bridge.notify({
            title,
            subtitle: "LiveNos",
            body,
            conversationId,
            messageId: note.id
          });
        }
      } catch (error) {
        logWarn(
          "Error solicitando notificación interna a Electron",
          {
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );
      }

      fireVisibleNotification({
        title,
        body,
        conversationId,
        messageId: note.id,
        createdAt:
          note.created_at ||
          new Date().toISOString()
      });

      window.dispatchEvent(
        new CustomEvent(
          "nostur:global-internal-message",
          {
            detail: {
              kind: "internal",
              conversation_id:
                conversationId,
              note_id: note.id
            }
          }
        )
      );
    }

    async function pollRecentInboundMessages() {
      if (!mounted) return;

      try {
        const {
          data,
          error
        } = await supabase
          .from("mensajes")
          .select(
            [
              "id",
              "conversacion_id",
              "direction",
              "sender_kind",
              "type",
              "text",
              "created_at",
              "wa_timestamp"
            ].join(",")
          )
          .eq("direction", "in")
          .gte(
            "created_at",
            pollingStartedAt
          )
          .order("created_at", {
            ascending: true
          })
          .limit(25);

        if (error) {
          logWarn(
            "Polling mensajes falló",
            error.message
          );

          return;
        }

        const messages =
          (data || []) as unknown as IncomingMessagePayload[];

        if (messages.length > 0) {
          logInfo(
            "Polling detectó mensajes inbound recientes",
            {
              count: messages.length,
              ids: messages.map(
                (message) => message.id
              )
            }
          );
        }

        for (const message of messages) {
          if (!mounted) return;

          if (
            processedMessagesRef.current.has(
              message.id
            )
          ) {
            continue;
          }

          await handleIncomingMessage(
            message
          );
        }
      } catch (error) {
        logWarn(
          "Polling mensajes lanzó excepción",
          {
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );
      }
    }

    async function pollRecentInternalNotes() {
      if (!mounted) return;

      try {
        const {
          data,
          error
        } = await supabase
          .from("notas_conversacion")
          .select(
            [
              "id",
              "conversacion_id",
              "autor_id",
              "contenido",
              "tipo",
              "created_at"
            ].join(",")
          )
          .eq(
            "tipo",
            "mensaje_interno"
          )
          .gte(
            "created_at",
            pollingStartedAt
          )
          .order("created_at", {
            ascending: true
          })
          .limit(25);

        if (error) {
          logWarn(
            "Polling mensajes internos falló",
            error.message
          );

          return;
        }

        const notes =
          (data || []) as unknown as InternalNotePayload[];

        if (notes.length > 0) {
          logInfo(
            "Polling detectó mensajes internos recientes",
            {
              count: notes.length,
              ids: notes.map(
                (note) => note.id
              )
            }
          );
        }

        for (const note of notes) {
          if (!mounted) return;

          if (
            processedMessagesRef.current.has(
              `internal:${note.id}`
            )
          ) {
            continue;
          }

          await handleInternalNote(note);
        }
      } catch (error) {
        logWarn(
          "Polling mensajes internos lanzó excepción",
          {
            error:
              error instanceof Error
                ? error.message
                : String(error)
          }
        );
      }
    }

    pollingTimer = window.setInterval(
      () => {
        void pollRecentInboundMessages();
        void pollRecentInternalNotes();
      },
      6000
    );

    void pollRecentInboundMessages();
    void pollRecentInternalNotes();

    const channel = supabase
      .channel(
        `global-whatsapp-notifications-${Date.now()}`
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes"
        },
        (payload) => {
          void handleIncomingMessage(
            payload.new as IncomingMessagePayload
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notas_conversacion"
        },
        (payload) => {
          void handleInternalNote(
            payload.new as InternalNotePayload
          );
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
          void handleOpportunityChange(
            payload.new as OpportunityLite
          );
        }
      )
      .subscribe((status) => {
        logInfo(
          `Realtime status: ${status}`
        );
      });

    return () => {
      mounted = false;

      if (pollingTimer) {
        window.clearInterval(
          pollingTimer
        );
      }

      void supabase.removeChannel(
        channel
      );
    };
  }, []);

  return (
    <InternalNotificationToast
      toast={internalToast}
      onClose={() =>
        setInternalToast(null)
      }
    />
  );
}

export default GlobalWhatsappNotifications;