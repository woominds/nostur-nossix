// src/components/NiaFloatingWidget.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Mic, Send, Sparkles, ThumbsDown, ThumbsUp, X } from "lucide-react";
import { supabase } from "../lib/supabase";

type NiaFloatingWidgetProps = {
  activeUrl: string;
};

type NiaContext = {
  source?: string;
  module?: string;
  action?: string;

  conversation_id?: string;
  conversacion_id?: string;

  wa_phone?: string;
  contacto_id?: string;
  contacto?: string;
  contacto_nombre?: string;
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

  created_at?: string;
};

type ChatMessage = {
  id: string;
  direction: "user" | "assistant";
  text: string;
  tool?: string;
  audit_id?: string | null;
  feedback_rating?: "positive" | "negative" | null;
};

function isInternalUrl(activeUrl: string): boolean {
  return activeUrl.startsWith("internal://");
}

function shouldShowNiaFloatingWidget(activeUrl: string): boolean {
  if (!isInternalUrl(activeUrl)) return false;

  const url = activeUrl.toLowerCase().trim();

  /*
    Regla NOSTUR:
    - En LiveNos / Comunicaciones, NIA NO va como widget.
      Ahí NIA debe aparecer como un chat más, siempre arriba.
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

function getNiaPassengerName(context: NiaContext | null): string {
  return (
    context?.contacto_nombre ||
    context?.contacto ||
    context?.contacto_profile_name ||
    context?.wa_phone ||
    "conversación de LiveNos"
  );
}

function formatContextValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";

  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }

  return String(value);
}

function buildNiaContextSummary(context: NiaContext | null): string {
  if (!getNiaConversationId(context)) {
    return "NIA abierta sin conversación seleccionada.";
  }

  return [
    `Pasajero: ${getNiaPassengerName(context)}`,
    `WhatsApp: ${formatContextValue(context?.wa_phone)}`,
    `Vendedor: ${formatContextValue(context?.vendedor_nombre)}`,
    `Estado gestión: ${formatContextValue(context?.estado_gestion)}`,
    `Estado comercial: ${formatContextValue(context?.estado_comercial)}`,
    `Último mensaje: ${formatContextValue(context?.last_message_preview)}`,
    `Ventana 24h abierta: ${formatContextValue(context?.ventana_24h_abierta)}`,
    `Score oportunidad: ${formatContextValue(context?.oportunidad_score)}`,
    `Cande activa: ${formatContextValue(context?.cande_activa)}`,
    `Datos oportunidad: ${formatContextValue(context?.oportunidad_datos)}`
  ].join("\n");
}

function getInitialMessages(context: NiaContext | null): ChatMessage[] {
  if (getNiaConversationId(context)) {
    return [
      {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: `Estoy viendo el contexto real de LiveNos.\n\n${buildNiaContextSummary(
          context
        )}\n\nPodés pedirme, por ejemplo:\n• Resumí esta conversación.\n• Decime qué debería responder el vendedor.\n• Detectá si está caliente o fría.\n• Decime si conviene activar, pausar o derivar CANDE.`,
        tool: "contexto_livenos",
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
          ? `Estoy parada en el módulo ${context.module}.\n\nPodés pedirme un resumen, alertas, diagnóstico comercial o próximas acciones según esta pantalla.`
          : "Hola, soy NIA. Puedo ayudarte con oportunidades, conversaciones, reportes, alertas comerciales y acciones internas.",
      audit_id: null,
      feedback_rating: null
    }
  ];
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

  const openRef = useRef(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);

  const visible = useMemo(() => {
    return shouldShowNiaFloatingWidget(activeUrl);
  }, [activeUrl]);

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

        /*
          El contexto de LiveNos puede quedar guardado en localStorage.
          Pero el widget ya no debe abrirse desde LiveNos. Si se abre desde
          Control IA / NIA / CANDE / Oportunidades, usamos contexto de pantalla.
        */
        const storedHasConversation = Boolean(getNiaConversationId(stored));
        const isWidgetAllowedHere = shouldShowNiaFloatingWidget(activeUrl);

        if (storedHasConversation && isWidgetAllowedHere) {
          setContext(screenContext);
          setMessages(getInitialMessages(screenContext));
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
    if (!data?.action_executed) return;

    window.dispatchEvent(
      new CustomEvent("nostur:nia-action-executed", {
        detail: {
          source,
          tool: data?.tool || null,
          conversation_id: data?.conversation_id || null,
          action_result: data?.action_result || null,
          created_at: new Date().toISOString()
        }
      })
    );
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
          context: activeContext,
          conversation_id: getNiaConversationId(activeContext),
          conversacion_id: getNiaConversationId(activeContext),
          source: "nia_floating_widget"
        }
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text:
          data?.text ||
          data?.error ||
          error?.message ||
          "NIA no pudo responder en este momento.",
        tool:
          data?.tool ||
          (data?.action_executed
            ? "nia_action_livenos"
            : getNiaConversationId(activeContext)
              ? "nia_livenos_context"
              : "nia_chat"),
        audit_id: data?.audit_id || null,
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
          context: activeContext,
          conversation_id: getNiaConversationId(activeContext),
          conversacion_id: getNiaConversationId(activeContext),
          source: "nia_floating_widget_audio"
        }
      });

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text:
          data?.text ||
          data?.error ||
          error?.message ||
          "NIA no pudo responder en este momento.",
        tool:
          data?.tool ||
          (data?.action_executed
            ? "nia_action_livenos"
            : getNiaConversationId(activeContext)
              ? "nia_livenos_context"
              : "nia_chat"),
        audit_id: data?.audit_id || null,
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
        window.localStorage.setItem("nostur_nia_context", JSON.stringify(customEvent.detail));
        setContext(customEvent.detail);

        if (!openRef.current) {
          setMessages(getInitialMessages(customEvent.detail));
        }
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

          <aside className="absolute bottom-4 right-4 top-4 flex w-[410px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[28px] border border-white/30 bg-white shadow-2xl">
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
              <div className="text-sm font-black text-[#dc1748]">
                ✨ Pedile a NIA un resumen de tus oportunidades
              </div>

              {context ? (
                <div className="mt-2 rounded-2xl border border-purple-100 bg-purple-50 px-3 py-2 text-xs font-bold text-[#5b21b6]">
                  {getNiaConversationId(context) ? (
                    <>
                      <div className="font-black">
                        Contexto activo: {getNiaPassengerName(context)}
                      </div>

                      <div className="mt-1 text-[11px] leading-relaxed text-[#6d28d9]">
                        WhatsApp: {context?.wa_phone || "—"} · Score:{" "}
                        {context?.oportunidad_score ?? "—"} · CANDE:{" "}
                        {context?.cande_activa ? "activa" : "pausada"} · 24h:{" "}
                        {context?.ventana_24h_abierta ? "abierta" : "cerrada"}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="font-black">
                        Contexto activo: {context.module || "general"}
                      </div>

                      <div className="mt-1 text-[11px] leading-relaxed text-[#6d28d9]">
                        NIA está parada en esta pantalla, sin conversación puntual seleccionada.
                      </div>
                    </>
                  )}
                </div>
              ) : null}

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
                  placeholder="Hablale a NIA..."
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
              <div className="text-base font-black text-[#142033]">
                Feedback para NIA
              </div>

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