// src/components/NiaFloatingWidget.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  ChevronDown,
  Mic,
  RefreshCcw,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  X
} from "lucide-react";
import { supabase } from "../lib/supabase";

type NiaFloatingWidgetProps = {
  activeUrl: string;
};

type NiaContext = {
  source?: string | null;
  module?: string | null;
  action?: string | null;

  conversation_id?: string | null;
  conversacion_id?: string | null;

  wa_phone?: string | null;
  contacto_id?: string | null;
  contacto?: string | null;
  contacto_nombre?: string | null;
  contacto_profile_name?: string | null;

  vendedor_id?: string | null;
  vendedor_nombre?: string | null;

  estado_gestion?: string | null;
  estado_comercial?: string | null;
  inbox?: string | null;
  status?: string | null;

  last_message_at?: string | null;
  last_inbound_message_at?: string | null;
  last_outbound_message_at?: string | null;
  last_message_preview?: string | null;

  ventana_24h_abierta?: boolean;
  whatsapp_24h_expires_at?: string | null;

  oportunidad_id?: string | null;
  oportunidad_score?: number | null;
  oportunidad_estado_id?: string | null;
  oportunidad_datos?: Record<string, unknown> | null;

  cande_activa?: boolean;
  cande_handoff_requested_at?: string | null;

  destino?: string | null;
  origen?: string | null;

  created_at?: string | null;
};

type ChatMessage = {
  id: string;
  direction: "user" | "assistant";
  text: string;
  tool?: string;
  audit_id?: string | null;
  feedback_rating?: "positive" | "negative" | null;
};

type OpportunityLite = {
  id: string;
  conversacion_id: string | null;
  estado_id: string | null;
  score: number | null;
  datos: Record<string, unknown> | null;
  manual_data?: Record<string, unknown> | null;
  assigned_to: string | null;
  cande_activa: boolean | null;
  cande_handoff_requested_at?: string | null;
  updated_at: string | null;
  created_at: string | null;
  nombre_contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
};

type PipelineEstadoLite = {
  id: string;
  nombre: string;
  color: string | null;
  orden: number | null;
};

const NIA_REFRESH_ACTIONS = [
  "MOVER_PIPELINE",
  "RECALIFICAR_OPORTUNIDAD",
  "ACTUALIZAR_DATO_OPORTUNIDAD",
  "ACTIVAR_CANDE",
  "DESACTIVAR_CANDE",
  "REPORTE_DIARIO_VENDEDORES",
  "CAMBIAR_CONTEXTO_OPORTUNIDAD"
];

function isInternalUrl(activeUrl: string): boolean {
  return activeUrl.startsWith("internal://");
}

function shouldShowNiaFloatingWidget(activeUrl: string): boolean {
  if (!isInternalUrl(activeUrl)) return false;

  const url = activeUrl.toLowerCase().trim();

  /*
    Regla NOSTUR:
    - En LiveNos / Comunicaciones, NIA NO va como widget.
      Ahí NIA debe aparecer como un chat más o como panel interno.
    - El widget flotante solo queda en:
      Control IA, Panel NIA, Panel CANDE / Oportunidades.
  */
  if (
    url.includes("livenos") ||
    url.includes("live-nos") ||
    url.includes("comunicaciones") ||
    url.includes("chats")
  ) {
    return false;
  }

  return (
    url === "internal://control-ia" ||
    url === "internal://controlia" ||
    url === "internal://nia" ||
    url === "internal://panel-nia" ||
    url === "internal://cande" ||
    url === "internal://panel-cande" ||
    url === "internal://oportunidades" ||
    url.includes("control-ia") ||
    url.includes("controlia") ||
    url.includes("panel-nia") ||
    url.includes("panel-cande") ||
    url.includes("cande") ||
    url.includes("oportunidades")
  );
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeSearch(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getDefaultContextFromActiveUrl(activeUrl: string): NiaContext {
  const now = new Date().toISOString();

  if (activeUrl.includes("control") || activeUrl.includes("tablero")) {
    return {
      source: "tablero",
      module: "control_comercial",
      action: "open_nia_from_dashboard",
      created_at: now
    };
  }

  if (activeUrl.includes("oportunidades")) {
    return {
      source: "oportunidades",
      module: "oportunidades",
      action: "open_nia_from_opportunities",
      created_at: now
    };
  }

  if (activeUrl.includes("cande")) {
    return {
      source: "cande",
      module: "panel_cande",
      action: "open_nia_from_cande_panel",
      created_at: now
    };
  }

  if (activeUrl.includes("nia")) {
    return {
      source: "nia",
      module: "panel_nia",
      action: "open_nia_from_nia_panel",
      created_at: now
    };
  }

  return {
    source: "general",
    module: "general",
    action: "open_nia_general",
    created_at: now
  };
}

function getNiaConversationId(context: NiaContext | null): string | null {
  return context?.conversation_id || context?.conversacion_id || null;
}

function getNiaOpportunityId(context: NiaContext | null): string | null {
  return context?.oportunidad_id || null;
}

function getNiaPassengerName(context: NiaContext | null): string {
  return (
    context?.contacto_nombre ||
    context?.contacto ||
    context?.contacto_profile_name ||
    context?.wa_phone ||
    "sin oportunidad seleccionada"
  );
}

function formatContextValue(value: unknown, fallback = "—"): string {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "string") {
    const text = value.trim();
    return text || fallback;
  }

  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";

  return fallback;
}

function getContextData(context: NiaContext | null) {
  const datos =
    context?.oportunidad_datos && typeof context.oportunidad_datos === "object"
      ? context.oportunidad_datos
      : {};

  const pasajero =
    formatContextValue(context?.contacto_nombre, "") ||
    formatContextValue(context?.contacto, "") ||
    formatContextValue(datos.contacto_nombre, "") ||
    formatContextValue(datos.pasajero, "") ||
    formatContextValue(datos.nombre, "") ||
    "Sin nombre";

  const telefono =
    formatContextValue(context?.wa_phone, "") ||
    formatContextValue(datos.wa_phone, "") ||
    formatContextValue(datos.telefono, "");

  const destino =
    formatContextValue(context?.destino, "") ||
    formatContextValue(datos.destino, "") ||
    formatContextValue(datos.lugar, "") ||
    "sin definir";

  const origenConfirmado =
    formatContextValue(context?.origen, "") ||
    formatContextValue(datos.origen, "") ||
    formatContextValue(datos.origen_confirmado, "");

  const origenSugerido = formatContextValue(datos.origen_sugerido, "");

  const aeropuertoSugerido =
    formatContextValue(datos.origen_sugerido_aeropuerto_nombre, "") ||
    formatContextValue(datos.origen_sugerido_aeropuerto, "");

  const origen = origenConfirmado
    ? origenConfirmado
    : origenSugerido
      ? `${origenSugerido}${aeropuertoSugerido ? ` (${aeropuertoSugerido})` : ""} · sugerido, falta confirmar`
      : "sin confirmar";

  const fechas =
    formatContextValue(datos.fechas_tentativas, "") ||
    formatContextValue(datos.fecha_aproximada, "") ||
    formatContextValue(datos.fecha, "") ||
    formatContextValue(datos.fechas, "") ||
    "sin definir";

  const pasajeros =
    formatContextValue(datos.cantidad_pasajeros, "") ||
    formatContextValue(datos.pasajeros, "") ||
    formatContextValue(datos.pax, "") ||
    "sin definir";

  const presupuesto =
    formatContextValue(datos.presupuesto_aproximado, "") ||
    formatContextValue(datos.presupuesto, "") ||
    "sin definir";

  const ultimoMensaje =
    formatContextValue(context?.last_message_preview, "") ||
    formatContextValue(datos.ultimo_mensaje, "");

  const vendedor = formatContextValue(context?.vendedor_nombre, "sin asignar");
  const estadoGestion = formatContextValue(context?.estado_gestion, "sin definir");
  const estadoComercial = formatContextValue(context?.estado_comercial, "sin definir");
  const score = formatContextValue(context?.oportunidad_score, "—");
  const cande = context?.cande_activa ? "activa" : "pausada";

  const faltantes: string[] = [];

  if (!formatContextValue(datos.destino, "")) {
    faltantes.push("Destino");
  }

  if (!origenConfirmado) {
    faltantes.push("Confirmar origen / ciudad de salida");
  }

  if (
    !formatContextValue(datos.fechas_tentativas, "") &&
    !formatContextValue(datos.fecha_aproximada, "")
  ) {
    faltantes.push("Fechas tentativas");
  }

  if (!formatContextValue(datos.cantidad_pasajeros, "")) {
    faltantes.push("Cantidad de pasajeros");
  }

  if (
    !formatContextValue(datos.presupuesto_aproximado, "") &&
    !formatContextValue(datos.presupuesto, "")
  ) {
    faltantes.push("Presupuesto aproximado");
  }

  return {
    pasajero,
    telefono,
    vendedor,
    estadoGestion,
    estadoComercial,
    destino,
    origen,
    fechas,
    pasajeros,
    presupuesto,
    ultimoMensaje,
    score,
    cande,
    faltantes
  };
}

function getOpportunityData(opportunity: OpportunityLite | null | undefined) {
  return {
    ...(opportunity?.datos || {}),
    ...(opportunity?.manual_data || {})
  };
}

function getOpportunityValue(opportunity: OpportunityLite, keys: string[], fallback = "") {
  const data = getOpportunityData(opportunity);

  for (const key of keys) {
    const value = data[key];

    if (value === null || value === undefined) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return fallback;
}

function getOpportunityName(opportunity: OpportunityLite) {
  return (
    cleanText(opportunity.nombre_contacto) ||
    getOpportunityValue(opportunity, [
      "nombre",
      "contacto_nombre",
      "pasajero",
      "nombre_pasajero",
      "cliente",
      "display_name",
      "profile_name"
    ]) ||
    cleanText(opportunity.telefono) ||
    "Sin nombre"
  );
}

function getOpportunityPhone(opportunity: OpportunityLite) {
  return (
    cleanText(opportunity.telefono) ||
    getOpportunityValue(opportunity, ["telefono", "wa_phone", "phone", "celular", "whatsapp"]) ||
    ""
  );
}

function getOpportunityDestino(opportunity: OpportunityLite) {
  return getOpportunityValue(
    opportunity,
    ["destino", "destinos", "lugar", "ciudad_destino", "pais", "país"],
    ""
  );
}

function getOpportunityOrigen(opportunity: OpportunityLite) {
  return getOpportunityValue(
    opportunity,
    ["origen", "ciudad_origen", "salida_desde", "origen_sugerido"],
    ""
  );
}

function getOpportunityFechas(opportunity: OpportunityLite) {
  return getOpportunityValue(
    opportunity,
    ["fechas_tentativas", "fecha", "fechas", "mes", "cuando", "cuándo"],
    ""
  );
}

function buildContextFromOpportunity(
  opportunity: OpportunityLite,
  estados: PipelineEstadoLite[]
): NiaContext {
  const name = getOpportunityName(opportunity);
  const phone = getOpportunityPhone(opportunity);
  const estado = estados.find((item) => item.id === opportunity.estado_id) || null;

  return {
    source: "nia_widget_selector",
    module: "oportunidades",
    action: "context_update_from_selector",

    conversation_id: opportunity.conversacion_id || null,
    conversacion_id: opportunity.conversacion_id || null,

    oportunidad_id: opportunity.id,
    oportunidad_score: Number(opportunity.score || 0),
    oportunidad_estado_id: opportunity.estado_id || null,
    oportunidad_datos: opportunity.datos || null,

    wa_phone: phone || null,
    contacto_nombre: name,
    contacto: name,
    contacto_profile_name: name,

    estado_comercial: estado?.nombre || null,
    cande_activa: Boolean(opportunity.cande_activa),
    cande_handoff_requested_at: opportunity.cande_handoff_requested_at || null,

    destino: getOpportunityDestino(opportunity) || null,
    origen: getOpportunityOrigen(opportunity) || null,

    created_at: new Date().toISOString()
  };
}

function buildNiaContextSummary(context: NiaContext | null): string {
  if (!getNiaConversationId(context) && !getNiaOpportunityId(context)) {
    return "NIA abierta sin conversación u oportunidad seleccionada.";
  }

  const data = getContextData(context);

  return [
    `Pasajero: ${data.pasajero}`,
    data.telefono ? `WhatsApp: ${data.telefono}` : null,
    `Vendedor: ${data.vendedor}`,
    `Estado gestión: ${data.estadoGestion}`,
    `Estado comercial: ${data.estadoComercial}`,
    "",
    `Destino: ${data.destino}`,
    `Origen: ${data.origen}`,
    `Fechas: ${data.fechas}`,
    `Pasajeros: ${data.pasajeros}`,
    `Presupuesto: ${data.presupuesto}`,
    "",
    `Score: ${data.score}`,
    `CANDE: ${data.cande}`,
    data.ultimoMensaje ? `Último mensaje: “${data.ultimoMensaje}”` : null,
    "",
    "Faltantes detectados:",
    data.faltantes.length > 0
      ? data.faltantes.map((item) => `• ${item}`).join("\n")
      : "• No detecto datos comerciales críticos faltantes."
  ]
    .filter(Boolean)
    .join("\n");
}

function getInitialMessages(context: NiaContext | null): ChatMessage[] {
  if (getNiaConversationId(context) || getNiaOpportunityId(context)) {
    return [
      {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: `Estoy viendo el contexto real de esta oportunidad.\n\n${buildNiaContextSummary(
          context
        )}\n\nPodés pedirme, por ejemplo:\n• Recalificá esta oportunidad.\n• Pasala a presupuestada / ganada / perdida / en gestión.\n• Activá o desactivá CANDE.\n• Cambiale el destino, origen, fechas, pasajeros o presupuesto.\n• Resumime la oportunidad.\n• Decime qué debería hacer el vendedor.`,
        tool: "contexto_oportunidad",
        audit_id: null,
        feedback_rating: null
      }
    ];
  }

  return [
    {
      id: crypto.randomUUID(),
      direction: "assistant",
      text:
        context?.module && context.module !== "general"
          ? `Estoy parada en el módulo ${context.module}.\n\nPodés elegir una oportunidad arriba o pedirme un resumen, alertas, diagnóstico comercial o próximas acciones según esta pantalla.`
          : "Hola, soy NIA. Puedo ayudarte con oportunidades, conversaciones, reportes, alertas comerciales y acciones internas.",
      audit_id: null,
      feedback_rating: null
    }
  ];
}

function shouldDispatchRefresh(data: any) {
  if (!data) return false;

  if (data.action_executed === true) return true;

  const action = String(data.action || data.result?.action || "").trim();

  if (data.ok === true && NIA_REFRESH_ACTIONS.includes(action)) {
    return true;
  }

  if (data.oportunidad_id && data.ok === true) {
    return true;
  }

  return false;
}

function getAssistantText(data: any, error: any) {
  return (
    data?.text ||
    data?.response ||
    data?.message ||
    data?.error ||
    error?.message ||
    "NIA no pudo responder en este momento."
  );
}

function getAssistantTool(data: any, activeContext: NiaContext | null) {
  if (data?.tool) return data.tool;
  if (data?.action) return String(data.action).toLowerCase();

  if (data?.action_executed) return "nia_action_livenos";

  if (getNiaConversationId(activeContext) || getNiaOpportunityId(activeContext)) {
    return "nia_context";
  }

  return "nia_chat";
}

export function NiaFloatingWidget({ activeUrl }: NiaFloatingWidgetProps) {
  const [open, setOpen] = useState(false);
  const [context, setContext] = useState<NiaContext | null>(null);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>(() => getInitialMessages(null));

  const [audioRecording, setAudioRecording] = useState(false);
  const [audioSending, setAudioSending] = useState(false);

  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [feedbackTarget, setFeedbackTarget] = useState<ChatMessage | null>(null);
  const [feedbackRating, setFeedbackRating] = useState<"positive" | "negative">("positive");
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSaving, setFeedbackSaving] = useState(false);
  const [feedbackError, setFeedbackError] = useState<string | null>(null);

  const [opportunityOptions, setOpportunityOptions] = useState<OpportunityLite[]>([]);
  const [pipelineEstados, setPipelineEstados] = useState<PipelineEstadoLite[]>([]);
  const [opportunitiesLoading, setOpportunitiesLoading] = useState(false);
  const [opportunitySelectOpen, setOpportunitySelectOpen] = useState(false);
  const [opportunitySearch, setOpportunitySearch] = useState("");

  const openRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const visible = useMemo(() => {
    return shouldShowNiaFloatingWidget(activeUrl);
  }, [activeUrl]);

  const filteredOpportunityOptions = useMemo(() => {
    const search = normalizeSearch(opportunitySearch);

    return opportunityOptions.filter((opportunity) => {
      if (!search) return true;

      const haystack = normalizeSearch(
        [
          getOpportunityName(opportunity),
          getOpportunityPhone(opportunity),
          opportunity.email,
          getOpportunityDestino(opportunity),
          getOpportunityOrigen(opportunity),
          getOpportunityFechas(opportunity),
          opportunity.score,
          opportunity.estado_id
        ].join(" ")
      );

      return haystack.includes(search);
    });
  }, [opportunityOptions, opportunitySearch]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

  function scrollNiaToBottom(behavior: ScrollBehavior = "smooth") {
    window.requestAnimationFrame(() => {
      window.setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({
          behavior,
          block: "end"
        });
      }, 50);
    });
  }

  async function loadOpportunityOptions() {
    setOpportunitiesLoading(true);

    const [oppRes, estadosRes] = await Promise.all([
      supabase
        .from("lead_oportunidades")
        .select(
          [
            "id",
            "conversacion_id",
            "estado_id",
            "score",
            "datos",
            "manual_data",
            "assigned_to",
            "cande_activa",
            "cande_handoff_requested_at",
            "updated_at",
            "created_at",
            "nombre_contacto",
            "telefono",
            "email",
            "notas"
          ].join(",")
        )
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(300),

      supabase
        .from("pipeline_estados")
        .select("id,nombre,color,orden")
        .order("orden", { ascending: true })
    ]);

    if (!oppRes.error) {
      setOpportunityOptions((oppRes.data || []) as unknown as OpportunityLite[]);
    }

    if (!estadosRes.error) {
      setPipelineEstados((estadosRes.data || []) as unknown as PipelineEstadoLite[]);
    }

    setOpportunitiesLoading(false);
  }

  useEffect(() => {
    return () => {
      const recorder = audioRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    scrollNiaToBottom("smooth");
  }, [messages.length, sending, audioSending, open]);

  useEffect(() => {
    if (!visible && open) {
      setOpen(false);
    }
  }, [visible, open]);

  useEffect(() => {
    if (!visible || !open) return;

    void loadOpportunityOptions();
  }, [visible, open]);

  function readContextFromStorage(options: { resetMessages?: boolean } = {}) {
    const raw = window.localStorage.getItem("nostur_nia_context");

    if (!raw) {
      const screenContext = getDefaultContextFromActiveUrl(activeUrl);
      setContext(screenContext);

      if (options.resetMessages) {
        setMessages(getInitialMessages(screenContext));
      }

      return;
    }

    try {
      const parsed = JSON.parse(raw) as NiaContext;
      setContext(parsed);

      if (options.resetMessages) {
        setMessages(getInitialMessages(parsed));
      }
    } catch {
      const screenContext = getDefaultContextFromActiveUrl(activeUrl);
      setContext(screenContext);

      if (options.resetMessages) {
        setMessages(getInitialMessages(screenContext));
      }
    }
  }

  function openChat() {
    const screenContext = getDefaultContextFromActiveUrl(activeUrl);
    const raw = window.localStorage.getItem("nostur_nia_context");

    if (raw) {
      try {
        const stored = JSON.parse(raw) as NiaContext;
        const storedHasContext = Boolean(getNiaConversationId(stored) || getNiaOpportunityId(stored));
        const isWidgetAllowedHere = shouldShowNiaFloatingWidget(activeUrl);

        if (storedHasContext && isWidgetAllowedHere && activeUrl.includes("oportunidades")) {
          setContext(stored);
          setMessages(getInitialMessages(stored));
          setOpen(true);
          return;
        }
      } catch {
        // Si el contexto guardado está roto, seguimos con contexto de pantalla.
      }
    }

    setContext(screenContext);
    setMessages(getInitialMessages(screenContext));
    setOpen(true);
  }

  function closeChat() {
    setOpen(false);
  }

  function updateNiaContext(
    nextContext: NiaContext,
    options: { resetMessages?: boolean; announce?: boolean } = {}
  ) {
    setContext(nextContext);
    window.localStorage.setItem("nostur_nia_context", JSON.stringify(nextContext));

    window.dispatchEvent(
      new CustomEvent("nostur:nia-context-updated", {
        detail: nextContext
      })
    );

    if (options.resetMessages) {
      setMessages(getInitialMessages(nextContext));
    }

    if (options.announce) {
      setMessages((current) => [
        ...current,
        {
          id: crypto.randomUUID(),
          direction: "assistant",
          text: `Listo. Ahora estoy trabajando con ${getNiaPassengerName(nextContext)}.`,
          tool: "contexto_oportunidad",
          audit_id: null,
          feedback_rating: null
        }
      ]);
    }
  }

  function selectOpportunityContext(opportunity: OpportunityLite) {
    const nextContext = buildContextFromOpportunity(opportunity, pipelineEstados);

    updateNiaContext(nextContext, {
      resetMessages: true,
      announce: false
    });

    setOpportunitySelectOpen(false);
    setOpportunitySearch("");
  }

  function openFeedbackModal(message: ChatMessage, rating: "positive" | "negative") {
    if (!message.audit_id) {
      setFeedbackError("Esta respuesta todavía no tiene auditoría vinculada.");
      return;
    }

    setFeedbackTarget(message);
    setFeedbackRating(rating);
    setFeedbackComment("");
    setFeedbackError(null);
    setFeedbackModalOpen(true);
  }

  function closeFeedbackModal() {
    if (feedbackSaving) return;

    setFeedbackModalOpen(false);
    setFeedbackTarget(null);
    setFeedbackComment("");
    setFeedbackError(null);
  }

  async function saveFeedback() {
    if (!feedbackTarget?.audit_id) {
      setFeedbackError("No se encontró la auditoría de esta respuesta.");
      return;
    }

    setFeedbackSaving(true);
    setFeedbackError(null);

    const { error } = await supabase
      .from("nia_interacciones")
      .update({
        feedback_rating: feedbackRating,
        feedback_comment: feedbackComment.trim() || null,
        feedback_created_at: new Date().toISOString()
      })
      .eq("id", feedbackTarget.audit_id);

    if (error) {
      setFeedbackError(error.message || "No se pudo guardar el feedback.");
      setFeedbackSaving(false);
      return;
    }

    setMessages((current) =>
      current.map((message) =>
        message.id === feedbackTarget.id
          ? {
              ...message,
              feedback_rating: feedbackRating
            }
          : message
      )
    );

    setFeedbackSaving(false);
    closeFeedbackModal();
  }

  function getNiaRecorderMimeType() {
    const options = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4"
    ];

    return options.find((type) => {
      try {
        return MediaRecorder.isTypeSupported(type);
      } catch {
        return false;
      }
    });
  }

  function getAudioExtension(mimeType: string) {
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mp4")) return "m4a";
    if (mimeType.includes("mpeg")) return "mp3";
    return "webm";
  }

  function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onloadend = () => {
        const result = String(reader.result || "");
        const base64 = result.includes(",") ? result.split(",")[1] : result;
        resolve(base64);
      };

      reader.onerror = () => reject(new Error("No se pudo leer el audio."));
      reader.readAsDataURL(blob);
    });
  }

  function getActiveContextForNia() {
    const activeContext = context || getDefaultContextFromActiveUrl(activeUrl);

    setContext(activeContext);

    return activeContext;
  }

  function dispatchNiaActionExecuted(data: any, source: "nia" | "nia_audio") {
    if (data?.context_update) {
      updateNiaContext(data.context_update, {
        resetMessages: true,
        announce: false
      });
    }

    if (!shouldDispatchRefresh(data)) return;

    const action = String(data?.action || data?.result?.action || data?.tool || "").trim();

    const detail = {
      source,
      tool: data?.tool || action || null,
      action,
      conversation_id: data?.conversation_id || data?.result?.conversation_id || null,
      conversacion_id: data?.conversation_id || data?.result?.conversation_id || null,
      oportunidad_id: data?.oportunidad_id || data?.result?.oportunidad_id || null,
      action_result: data?.action_result || data?.result || null,
      result: data?.result || null,
      ok: data?.ok === true,
      code_version: data?.code_version || null,
      created_at: new Date().toISOString()
    };

    window.dispatchEvent(
      new CustomEvent("nostur:nia-action-executed", {
        detail
      })
    );

    window.dispatchEvent(
      new CustomEvent("nostur:oportunidades-refresh", {
        detail
      })
    );

    window.dispatchEvent(
      new CustomEvent("nostur:livenos-refresh", {
        detail
      })
    );

    void loadOpportunityOptions();
  }

  async function handleSend() {
    const clean = input.trim();

    if (!clean || sending) return;

    const activeContext = getActiveContextForNia();

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      direction: "user",
      text: clean
    };

    setMessages((current) => [...current, userMessage]);
    setInput("");
    setSending(true);

    try {
      const { data, error } = await supabase.functions.invoke("nia-chat", {
        body: {
          message: clean,
          text: clean,
          context: activeContext,

          conversation_id: getNiaConversationId(activeContext),
          conversacion_id: getNiaConversationId(activeContext),

          oportunidad_id: getNiaOpportunityId(activeContext),
          opportunity_id: getNiaOpportunityId(activeContext),

          source: "nia_floating_widget",
          module: activeContext?.module || "oportunidades"
        }
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: getAssistantText(data, error),
        tool: getAssistantTool(data, activeContext),
        audit_id: data?.audit_id || data?.interaction_id || null,
        feedback_rating: null
      };

      setMessages((current) => [...current, assistantMessage]);
      dispatchNiaActionExecuted(data, "nia");
    } catch (err) {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: err instanceof Error ? err.message : "No se pudo conectar con NIA.",
        tool: "nia_error",
        audit_id: null,
        feedback_rating: null
      };

      setMessages((current) => [...current, assistantMessage]);
    } finally {
      setSending(false);
    }
  }

  async function sendAudioToNia(audioBlob: Blob, mimeType: string) {
    if (sending || audioSending) return;

    const activeContext = getActiveContextForNia();
    const tempUserMessageId = crypto.randomUUID();

    const userMessage: ChatMessage = {
      id: tempUserMessageId,
      direction: "user",
      text: "🎙️ Audio recibido. Transcribiendo..."
    };

    setMessages((current) => [...current, userMessage]);
    setAudioSending(true);
    setSending(true);

    try {
      const audioBase64 = await blobToBase64(audioBlob);
      const extension = getAudioExtension(mimeType);

      const { data: transcribeData, error: transcribeError } =
        await supabase.functions.invoke("nia-transcribe-audio", {
          body: {
            audio_base64: audioBase64,
            audio_mime_type: mimeType,
            audio_filename: `nia-audio-${Date.now()}.${extension}`
          }
        });

      if (transcribeError || !transcribeData?.ok) {
        const errorMessage =
          transcribeError?.message ||
          transcribeData?.error ||
          "No pude transcribir el audio.";

        setMessages((current) =>
          current.map((message) =>
            message.id === tempUserMessageId
              ? {
                  ...message,
                  text: `🎙️ Audio recibido, pero no pude transcribirlo.\n\n${errorMessage}`
                }
              : message
          )
        );

        const assistantMessage: ChatMessage = {
          id: crypto.randomUUID(),
          direction: "assistant",
          text: errorMessage,
          tool: "nia_audio_transcription_error",
          audit_id: null,
          feedback_rating: null
        };

        setMessages((current) => [...current, assistantMessage]);
        return;
      }

      const transcribedText = String(
        transcribeData.transcribed_text || transcribeData.text || ""
      ).trim();

      if (!transcribedText) {
        setMessages((current) =>
          current.map((message) =>
            message.id === tempUserMessageId
              ? {
                  ...message,
                  text: "🎙️ Audio recibido, pero la transcripción vino vacía."
                }
              : message
          )
        );

        return;
      }

      setMessages((current) =>
        current.map((message) =>
          message.id === tempUserMessageId
            ? {
                ...message,
                text: `🎙️ ${transcribedText}`
              }
            : message
        )
      );

      const { data, error } = await supabase.functions.invoke("nia-chat", {
        body: {
          message: transcribedText,
          text: transcribedText,
          transcription: transcribedText,
          context: activeContext,

          conversation_id: getNiaConversationId(activeContext),
          conversacion_id: getNiaConversationId(activeContext),

          oportunidad_id: getNiaOpportunityId(activeContext),
          opportunity_id: getNiaOpportunityId(activeContext),

          source: "nia_floating_widget_audio",
          module: activeContext?.module || "oportunidades"
        }
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: getAssistantText(data, error),
        tool: getAssistantTool(data, activeContext),
        audit_id: data?.audit_id || data?.interaction_id || null,
        feedback_rating: null
      };

      setMessages((current) => [...current, assistantMessage]);
      dispatchNiaActionExecuted(data, "nia_audio");
    } catch (err) {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: err instanceof Error ? err.message : "No se pudo transcribir o ejecutar el audio.",
        tool: "nia_audio_error",
        audit_id: null,
        feedback_rating: null
      };

      setMessages((current) => [...current, assistantMessage]);
    } finally {
      setAudioSending(false);
      setSending(false);
    }
  }

  async function startNiaAudioRecording() {
    if (audioRecording || audioSending || sending) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: "Este navegador no permite grabar audio para NIA.",
        tool: "nia_audio_error",
        audit_id: null,
        feedback_rating: null
      };

      setMessages((current) => [...current, assistantMessage]);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getNiaRecorderMimeType();

      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = () => {
        const finalMimeType = recorder.mimeType || mimeType || "audio/webm";
        const audioBlob = new Blob(audioChunksRef.current, {
          type: finalMimeType
        });

        stream.getTracks().forEach((track) => track.stop());
        audioRecorderRef.current = null;
        audioChunksRef.current = [];
        setAudioRecording(false);

        if (audioBlob.size > 0) {
          void sendAudioToNia(audioBlob, finalMimeType);
        }
      };

      audioRecorderRef.current = recorder;
      recorder.start();
      setAudioRecording(true);
    } catch (err) {
      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: err instanceof Error ? err.message : "No se pudo iniciar la grabación de audio.",
        tool: "nia_audio_error",
        audit_id: null,
        feedback_rating: null
      };

      setMessages((current) => [...current, assistantMessage]);
      setAudioRecording(false);
    }
  }

  function stopNiaAudioRecording() {
    const recorder = audioRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      setAudioRecording(false);
      return;
    }

    recorder.stop();
  }

  function handleNiaMicButtonClick() {
    if (audioRecording) {
      stopNiaAudioRecording();
      return;
    }

    void startNiaAudioRecording();
  }

  useEffect(() => {
    function handleOpenNiaChat(event: Event) {
      if (!shouldShowNiaFloatingWidget(activeUrl)) return;

      const customEvent = event as CustomEvent<NiaContext | undefined>;

      if (customEvent.detail) {
        updateNiaContext(customEvent.detail, {
          resetMessages: !openRef.current,
          announce: false
        });
      } else if (!openRef.current) {
        readContextFromStorage({ resetMessages: true });
      }

      setOpen(true);
    }

    function handleNiaContextUpdated(event: Event) {
      const customEvent = event as CustomEvent<NiaContext | undefined>;

      if (!customEvent.detail) return;

      window.localStorage.setItem("nostur_nia_context", JSON.stringify(customEvent.detail));

      if (shouldShowNiaFloatingWidget(activeUrl)) {
        setContext(customEvent.detail);
      }
    }

    window.addEventListener("nostur:open-nia-chat", handleOpenNiaChat);
    window.addEventListener("nostur:nia-context-updated", handleNiaContextUpdated);

    return () => {
      window.removeEventListener("nostur:open-nia-chat", handleOpenNiaChat);
      window.removeEventListener("nostur:nia-context-updated", handleNiaContextUpdated);
    };
  }, [activeUrl]);

  if (!visible) return null;

  return (
    <>
      {!open ? (
        <div className="nostur-no-drag fixed bottom-6 right-6 z-[900]">
          <button
            type="button"
            onClick={openChat}
            className="group flex h-14 items-center gap-3 rounded-full bg-gradient-to-br from-[#ff2f76] to-[#8b2cff] px-4 pr-5 text-white shadow-2xl shadow-purple-500/30 transition hover:scale-[1.03] hover:shadow-purple-500/40"
            title="Abrir NIA"
          >
            <span className="relative flex h-9 w-9 items-center justify-center rounded-full bg-white/18">
              <Bot size={19} strokeWidth={2} />

              <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#8b2cff]">
                <Sparkles size={10} strokeWidth={2.5} />
              </span>
            </span>

            <span className="hidden flex-col items-start leading-none sm:flex">
              <span className="text-[12px] font-black">NIA</span>
              <span className="mt-1 text-[10px] font-bold text-white/75">Asistente interno</span>
            </span>
          </button>
        </div>
      ) : null}

      {open ? (
        <div className="nostur-no-drag fixed inset-0 z-[950]">
          <button
            type="button"
            className="absolute inset-0 cursor-default bg-black/28 backdrop-blur-[3px]"
            onClick={closeChat}
            tabIndex={-1}
          />

          <aside className="absolute bottom-4 right-4 top-4 flex w-[430px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border border-white/30 bg-white shadow-2xl">
            <header className="shrink-0 bg-gradient-to-r from-[#ff2f76] to-[#8b2cff] px-4 py-3 text-white">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/18">
                    <Sparkles size={20} />
                  </div>

                  <div>
                    <div className="text-base font-black leading-none">NIA</div>
                    <div className="mt-1 text-xs font-bold text-white/75">Asistente comercial</div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={closeChat}
                  className="flex h-9 w-9 items-center justify-center rounded-2xl text-white/85 hover:bg-white/15 hover:text-white"
                  title="Cerrar NIA"
                >
                  <X size={18} />
                </button>
              </div>
            </header>

            <div className="shrink-0 border-b border-black/10 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-black text-[#dc1748]">
                  ✨ Contexto de trabajo
                </div>

                <button
                  type="button"
                  onClick={loadOpportunityOptions}
                  disabled={opportunitiesLoading}
                  className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#f8fafc] text-[#64748b] ring-1 ring-black/10 hover:bg-[#f1f5f9] disabled:opacity-50"
                  title="Actualizar oportunidades"
                >
                  <RefreshCcw size={14} className={opportunitiesLoading ? "animate-spin" : ""} />
                </button>
              </div>

              <div className="relative mt-3">
                <button
                  type="button"
                  onClick={() => setOpportunitySelectOpen((current) => !current)}
                  className="flex w-full items-center justify-between gap-3 rounded-2xl border border-purple-100 bg-purple-50 px-3 py-2.5 text-left text-xs font-bold text-[#5b21b6] shadow-sm transition hover:border-purple-200 hover:bg-purple-50/80"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-black">
                      {getNiaOpportunityId(context)
                        ? `Contexto activo: ${getNiaPassengerName(context)}`
                        : "Elegir oportunidad para NIA"}
                    </span>

                    <span className="mt-1 block truncate text-[11px] leading-relaxed text-[#6d28d9]">
                      {getNiaOpportunityId(context)
                        ? `WhatsApp: ${context?.wa_phone || "—"} · Score: ${
                            context?.oportunidad_score ?? "—"
                          } · CANDE: ${context?.cande_activa ? "activa" : "pausada"}`
                        : "Seleccioná una oportunidad para que NIA trabaje con ese contexto."}
                    </span>
                  </span>

                  <ChevronDown
                    size={16}
                    className={[
                      "shrink-0 transition",
                      opportunitySelectOpen ? "rotate-180" : ""
                    ].join(" ")}
                  />
                </button>

                {opportunitySelectOpen ? (
                  <div className="absolute left-0 right-0 top-[68px] z-[980] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
                    <div className="border-b border-black/10 p-2">
                      <input
                        value={opportunitySearch}
                        onChange={(event) => setOpportunitySearch(event.target.value)}
                        placeholder="Buscar pasajero, teléfono o destino..."
                        autoFocus
                        className="h-9 w-full rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-[12px] font-semibold text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#8b2cff]"
                      />
                    </div>

                    <div className="max-h-[270px] overflow-auto p-2">
                      {opportunitiesLoading ? (
                        <div className="flex items-center gap-2 rounded-xl px-3 py-3 text-xs font-bold text-[#64748b]">
                          <Sparkles size={14} className="animate-pulse" />
                          Cargando oportunidades...
                        </div>
                      ) : filteredOpportunityOptions.length === 0 ? (
                        <div className="rounded-xl px-3 py-3 text-xs font-bold text-[#94a3b8]">
                          Sin oportunidades.
                        </div>
                      ) : (
                        filteredOpportunityOptions.map((opportunity) => {
                          const active = getNiaOpportunityId(context) === opportunity.id;
                          const estado = pipelineEstados.find((item) => item.id === opportunity.estado_id);
                          const name = getOpportunityName(opportunity);
                          const phone = getOpportunityPhone(opportunity);
                          const destino = getOpportunityDestino(opportunity);
                          const fechas = getOpportunityFechas(opportunity);
                          const score = Number(opportunity.score || 0);

                          return (
                            <button
                              key={opportunity.id}
                              type="button"
                              onClick={() => selectOpportunityContext(opportunity)}
                              className={[
                                "flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition",
                                active
                                  ? "bg-purple-50 text-[#5b21b6] ring-1 ring-purple-100"
                                  : "text-[#172033] hover:bg-[#f8fafc]"
                              ].join(" ")}
                            >
                              <span
                                className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: estado?.color || "#8b2cff" }}
                              />

                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] font-black">
                                  {name}
                                </span>

                                <span className="mt-0.5 block truncate text-[11px] font-semibold text-[#64748b]">
                                  {phone || "Sin teléfono"} · Score {score}
                                  {estado?.nombre ? ` · ${estado.nombre}` : ""}
                                </span>

                                <span className="mt-0.5 block truncate text-[11px] font-normal text-[#94a3b8]">
                                  {destino || "Sin destino"}
                                  {fechas ? ` · ${fechas}` : ""}
                                </span>
                              </span>

                              {active ? (
                                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                                  Activa
                                </span>
                              ) : null}
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {feedbackError && !feedbackModalOpen ? (
                <div className="mt-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  {feedbackError}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 space-y-3 overflow-auto bg-[#fafafa] px-4 py-4">
              {messages.map((message) => {
                const isUser = message.direction === "user";

                return (
                  <div key={message.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
                    <div
                      className={[
                        "max-w-[86%] rounded-[22px] px-4 py-3 text-sm font-semibold leading-relaxed shadow-sm",
                        isUser
                          ? "rounded-br-md bg-[#8b2cff] text-white"
                          : "rounded-bl-md border border-black/10 bg-white text-[#172033]"
                      ].join(" ")}
                    >
                      <div className="whitespace-pre-wrap">{message.text}</div>

                      {!isUser ? (
                        <div className="mt-2 flex items-center justify-between gap-2">
                          {message.tool ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                              ✓ {message.tool}
                            </span>
                          ) : (
                            <span />
                          )}

                          <span className="flex gap-1 text-[#94a3b8]">
                            <button
                              type="button"
                              onClick={() => openFeedbackModal(message, "positive")}
                              disabled={!message.audit_id}
                              className={[
                                "rounded-lg p-1 transition hover:bg-emerald-50 hover:text-emerald-600 disabled:cursor-not-allowed disabled:opacity-40",
                                message.feedback_rating === "positive"
                                  ? "bg-emerald-50 text-emerald-600"
                                  : ""
                              ].join(" ")}
                              title="Buen resultado"
                            >
                              <ThumbsUp size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => openFeedbackModal(message, "negative")}
                              disabled={!message.audit_id}
                              className={[
                                "rounded-lg p-1 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-40",
                                message.feedback_rating === "negative"
                                  ? "bg-red-50 text-red-600"
                                  : ""
                              ].join(" ")}
                              title="Mal resultado"
                            >
                              <ThumbsDown size={13} />
                            </button>
                          </span>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}

              {sending || audioSending ? (
                <div className="flex justify-start">
                  <div className="rounded-[22px] rounded-bl-md border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-relaxed text-[#64748b] shadow-sm">
                    <span className="inline-flex items-center gap-2">
                      <Sparkles size={15} className="animate-pulse text-[#8b2cff]" />
                      NIA pensando...
                    </span>
                  </div>
                </div>
              ) : null}

              <div ref={messagesEndRef} />
            </div>

            <footer className="shrink-0 border-t border-black/10 bg-white p-3">
              <div className="flex items-end gap-2 rounded-[24px] bg-[#eef2f7] p-2">
                <button
                  type="button"
                  onClick={handleNiaMicButtonClick}
                  disabled={sending && !audioRecording}
                  className={[
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl transition disabled:opacity-50",
                    audioRecording
                      ? "animate-pulse bg-red-500 text-white"
                      : "text-[#64748b] hover:bg-white"
                  ].join(" ")}
                  title={audioRecording ? "Detener audio" : "Hablar con NIA"}
                >
                  {audioRecording ? (
                    <span className="h-3.5 w-3.5 rounded-sm bg-white" />
                  ) : audioSending ? (
                    <Sparkles size={18} className="animate-pulse" />
                  ) : (
                    <Mic size={18} />
                  )}
                </button>

                <textarea
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      void handleSend();
                    }
                  }}
                  rows={1}
                  placeholder={
                    getNiaOpportunityId(context)
                      ? `Hablale a NIA sobre ${getNiaPassengerName(context)}...`
                      : "Elegí una oportunidad o hablale a NIA..."
                  }
                  className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm font-semibold text-[#172033] outline-none placeholder:text-[#94a3b8]"
                />

                <button
                  type="button"
                  onClick={handleSend}
                  disabled={!input.trim() || sending}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#8b2cff] text-white shadow-sm transition hover:bg-[#7c3aed] disabled:opacity-50"
                  title="Enviar"
                >
                  {sending ? (
                    <Sparkles size={17} className="animate-pulse" />
                  ) : (
                    <Send size={17} />
                  )}
                </button>
              </div>
            </footer>
          </aside>
        </div>
      ) : null}

      {feedbackModalOpen ? (
        <div className="nostur-no-drag fixed inset-0 z-[1000] flex items-center justify-center bg-[#0f172a]/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[28px] bg-white shadow-2xl ring-1 ring-black/10">
            <div className="border-b border-black/10 px-5 py-4">
              <div className="text-base font-black text-[#142033]">Feedback para NIA</div>

              <div className="mt-1 text-xs font-bold text-[#64748b]">
                Esto ayuda a mejorar las respuestas y queda guardado en auditoría.
              </div>
            </div>

            <div className="p-5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFeedbackRating("positive")}
                  className={[
                    "flex h-11 items-center justify-center gap-2 rounded-2xl text-xs font-black ring-1 ring-black/10",
                    feedbackRating === "positive"
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-white text-[#64748b] hover:bg-[#f8fafc]"
                  ].join(" ")}
                >
                  <ThumbsUp size={15} />
                  Buena respuesta
                </button>

                <button
                  type="button"
                  onClick={() => setFeedbackRating("negative")}
                  className={[
                    "flex h-11 items-center justify-center gap-2 rounded-2xl text-xs font-black ring-1 ring-black/10",
                    feedbackRating === "negative"
                      ? "bg-red-50 text-red-700 ring-red-200"
                      : "bg-white text-[#64748b] hover:bg-[#f8fafc]"
                  ].join(" ")}
                >
                  <ThumbsDown size={15} />
                  Mala respuesta
                </button>
              </div>

              <textarea
                value={feedbackComment}
                onChange={(event) => setFeedbackComment(event.target.value)}
                placeholder={
                  feedbackRating === "positive"
                    ? "Opcional: ¿qué estuvo bien?"
                    : "Opcional: ¿qué debería mejorar NIA?"
                }
                className="mt-4 min-h-[110px] w-full resize-none rounded-2xl border border-black/10 bg-[#f8fafc] px-3 py-3 text-sm font-semibold text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#8b2cff]"
              />

              {feedbackError ? (
                <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
                  {feedbackError}
                </div>
              ) : null}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-black/10 bg-[#f8fafc] px-5 py-4">
              <button
                type="button"
                onClick={closeFeedbackModal}
                disabled={feedbackSaving}
                className="h-10 rounded-2xl bg-white px-4 text-xs font-black text-[#64748b] ring-1 ring-black/10 hover:bg-[#f1f5f9] disabled:opacity-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={saveFeedback}
                disabled={feedbackSaving}
                className="h-10 rounded-2xl bg-[#8b2cff] px-4 text-xs font-black text-white hover:bg-[#7c3aed] disabled:opacity-50"
              >
                {feedbackSaving ? "Guardando..." : "Guardar feedback"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export default NiaFloatingWidget;