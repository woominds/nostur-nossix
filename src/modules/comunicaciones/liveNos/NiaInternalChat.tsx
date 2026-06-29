// src/modules/comunicaciones/liveNos/NiaInternalChat.tsx

import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Mic, Send, Sparkles } from "lucide-react";
import { supabase } from "../../../lib/supabase";

type NiaInternalMessage = {
  id: string;
  direction: "user" | "assistant";
  text: string;
  tool?: string | null;
};

type NiaInternalChatProps = {
  getContext: () => Record<string, any>;
  onRefreshNeeded?: (data: any) => void | Promise<void>;
};

function getNiaAssistantText(data: any, error: any) {
  return (
    data?.text ||
    data?.response ||
    data?.message ||
    data?.error ||
    error?.message ||
    "NIA no pudo responder en este momento."
  );
}

function getContextConversationId(context: Record<string, any> | null | undefined) {
  return context?.conversation_id || context?.conversacion_id || null;
}

function getContextOpportunityId(context: Record<string, any> | null | undefined) {
  return context?.oportunidad_id || context?.opportunity_id || null;
}

function getContextName(context: Record<string, any> | null | undefined) {
  return (
    context?.contacto_nombre ||
    context?.contacto ||
    context?.contacto_profile_name ||
    context?.wa_phone ||
    "sin oportunidad seleccionada"
  );
}

function cleanValue(value: unknown, fallback = "—") {
  if (value === null || value === undefined) return fallback;

  if (typeof value === "string") {
    const text = value.trim();
    return text || fallback;
  }

  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "Sí" : "No";

  return fallback;
}

function getContextData(context: any) {
  const datos =
    context?.oportunidad_datos && typeof context.oportunidad_datos === "object"
      ? context.oportunidad_datos
      : {};

  const pasajero =
    cleanValue(context?.contacto_nombre, "") ||
    cleanValue(datos?.contacto_nombre, "") ||
    cleanValue(datos?.pasajero, "") ||
    cleanValue(datos?.nombre, "") ||
    "Sin nombre";

  const telefono =
    cleanValue(context?.wa_phone, "") ||
    cleanValue(datos?.wa_phone, "") ||
    cleanValue(datos?.telefono, "");

  const destino = cleanValue(datos?.destino, "sin definir");

  const origenConfirmado =
    cleanValue(datos?.origen, "") ||
    cleanValue(datos?.origen_confirmado, "");

  const origenSugerido = cleanValue(datos?.origen_sugerido, "");
  const aeropuertoSugerido =
    cleanValue(datos?.origen_sugerido_aeropuerto_nombre, "") ||
    cleanValue(datos?.origen_sugerido_aeropuerto, "");

  const origen = origenConfirmado
    ? origenConfirmado
    : origenSugerido
      ? `${origenSugerido}${aeropuertoSugerido ? ` (${aeropuertoSugerido})` : ""} · sugerido, falta confirmar`
      : "sin confirmar";

  const fechas =
    cleanValue(datos?.fechas_tentativas, "") ||
    cleanValue(datos?.fecha_aproximada, "") ||
    cleanValue(datos?.fecha, "") ||
    "sin definir";

  const pasajeros =
    cleanValue(datos?.cantidad_pasajeros, "") ||
    cleanValue(datos?.pasajeros, "") ||
    cleanValue(datos?.pax, "") ||
    "sin definir";

  const presupuesto =
    cleanValue(datos?.presupuesto_aproximado, "") ||
    cleanValue(datos?.presupuesto, "") ||
    "sin definir";

  const ultimoMensaje =
    cleanValue(context?.last_message_preview, "") ||
    cleanValue(datos?.ultimo_mensaje, "");

  const score = cleanValue(context?.oportunidad_score, "—");
  const cande = context?.cande_activa ? "activa" : "pausada";

  const faltantes: string[] = [];

  if (!cleanValue(datos?.destino, "")) faltantes.push("Destino");
  if (!origenConfirmado) faltantes.push("Confirmar origen / ciudad de salida");

  if (!cleanValue(datos?.fechas_tentativas, "") && !cleanValue(datos?.fecha_aproximada, "")) {
    faltantes.push("Fechas tentativas");
  }

  if (!cleanValue(datos?.cantidad_pasajeros, "")) {
    faltantes.push("Cantidad de pasajeros");
  }

  if (!cleanValue(datos?.presupuesto_aproximado, "") && !cleanValue(datos?.presupuesto, "")) {
    faltantes.push("Presupuesto aproximado");
  }

  return {
    pasajero,
    telefono,
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

function buildInitialContextMessage(context: any) {
  const data = getContextData(context);

  return [
    "Estoy viendo el contexto real de esta oportunidad.",
    "",
    `Pasajero: ${data.pasajero}`,
    data.telefono ? `WhatsApp: ${data.telefono}` : null,
    `Destino: ${data.destino}`,
    `Origen: ${data.origen}`,
    `Fechas: ${data.fechas}`,
    `Pasajeros: ${data.pasajeros}`,
    `Presupuesto: ${data.presupuesto}`,
    `Score: ${data.score}`,
    `CANDE: ${data.cande}`,
    data.ultimoMensaje ? `Último mensaje: “${data.ultimoMensaje}”` : null,
    "",
    "Faltantes detectados:",
    data.faltantes.length > 0
      ? data.faltantes.map((item) => `• ${item}`).join("\n")
      : "• No detecto datos comerciales críticos faltantes.",
    "",
    "Podés pedirme, por ejemplo:",
    "• Recalificá esta oportunidad.",
    "• Pasala a presupuestada / ganada / perdida / en gestión.",
    "• Activá o desactivá CANDE.",
    "• Cambiale el destino, origen, fechas, pasajeros o presupuesto.",
    "• Resumime la oportunidad.",
    "• Decime qué debería hacer el vendedor."
  ]
    .filter(Boolean)
    .join("\n");
}

export function NiaInternalChat({ getContext, onRefreshNeeded }: NiaInternalChatProps) {
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const [messages, setMessages] = useState<NiaInternalMessage[]>(() => {
    const context = getContext();

    return [
      {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: buildInitialContextMessage(context),
        tool: getContextOpportunityId(context) || getContextConversationId(context)
          ? "contexto_oportunidad"
          : "nia_inicio"
      }
    ];
  });

  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const currentContext = getContext();
  const hasContext = Boolean(getContextConversationId(currentContext) || getContextOpportunityId(currentContext));
const contextKey =
  getContextOpportunityId(currentContext) ||
  getContextConversationId(currentContext) ||
  "nia-general";

useEffect(() => {
  const context = getContext();

  setMessages([
    {
      id: crypto.randomUUID(),
      direction: "assistant",
      text: buildInitialContextMessage(context),
      tool: getContextOpportunityId(context) || getContextConversationId(context)
        ? "contexto_oportunidad"
        : "nia_inicio"
    }
  ]);
}, [contextKey]);
  useEffect(() => {
    window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "end"
      });
    });
  }, [messages.length, sending]);

  function refreshContextMessage() {
    const context = getContext();

    setMessages((current) => [
      ...current,
      {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: buildInitialContextMessage(context),
        tool: getContextOpportunityId(context) || getContextConversationId(context)
          ? "contexto_oportunidad"
          : "nia_inicio"
      }
    ]);
  }

  async function sendNiaMessage() {
    const clean = input.trim();

    if (!clean || sending) return;

    const context = getContext();

    const userMessage: NiaInternalMessage = {
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
          context,

          conversation_id: getContextConversationId(context),
          conversacion_id: getContextConversationId(context),

          oportunidad_id: getContextOpportunityId(context),
          opportunity_id: getContextOpportunityId(context),

          source: "livenos_nia_internal_chat",
          module: "comunicaciones"
        }
      });

      const assistantMessage: NiaInternalMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: getNiaAssistantText(data, error),
        tool: data?.action ? String(data.action).toLowerCase() : data?.tool || "nia_chat"
      };

      setMessages((current) => [...current, assistantMessage]);

      if (data?.ok === true) {
        await onRefreshNeeded?.(data);
      }
    } catch (err) {
      const assistantMessage: NiaInternalMessage = {
        id: crypto.randomUUID(),
        direction: "assistant",
        text: err instanceof Error ? err.message : "No se pudo conectar con NIA.",
        tool: "nia_error"
      };

      setMessages((current) => [...current, assistantMessage]);
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <div className="shrink-0 border-b border-black/10 bg-gradient-to-r from-[#fff1f8] to-[#f5f3ff] px-4 py-3">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ff2f76] to-[#8b2cff] text-white shadow-sm">
            <Bot size={21} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-[17px] font-semibold leading-tight text-[#581c87]">
                NIA interno
              </h2>

              <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#7e22ce] ring-1 ring-purple-100">
                Chat fijado
              </span>
            </div>

            <p className="mt-0.5 text-[12px] font-normal text-[#6b21a8]">
              Asistente comercial interno para vendedores, oportunidades y reportes.
            </p>

            <button
              type="button"
              onClick={refreshContextMessage}
              className="mt-2 w-full rounded-2xl border border-purple-100 bg-white/70 px-3 py-2 text-left text-[11px] font-semibold text-[#6d28d9] transition hover:border-purple-200 hover:bg-white"
            >
              {hasContext ? (
                <>
                  Contexto disponible: {getContextName(currentContext)}
                  {currentContext?.oportunidad_score !== null &&
                  currentContext?.oportunidad_score !== undefined
                    ? ` · Score ${currentContext.oportunidad_score}`
                    : ""}
                  {currentContext?.cande_activa !== null &&
                  currentContext?.cande_activa !== undefined
                    ? ` · CANDE ${currentContext.cande_activa ? "activa" : "pausada"}`
                    : ""}
                  <span className="ml-2 text-[10px] font-normal text-[#a78bfa]">
                    Click para refrescar contexto
                  </span>
                </>
              ) : (
                <>Sin conversación puntual seleccionada. NIA puede trabajar sobre reportes generales.</>
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-auto bg-[linear-gradient(180deg,#faf5ff,#f8fafc)] px-5 py-4">
        {messages.map((message) => {
          const isUser = message.direction === "user";

          return (
            <div key={message.id} className={isUser ? "flex justify-end" : "flex justify-start"}>
              <div
                className={[
                  "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-[13px] font-normal leading-relaxed shadow-sm ring-1",
                  isUser
                    ? "rounded-br-sm bg-[#8b2cff] text-white ring-[#8b2cff]/20"
                    : "rounded-bl-sm bg-white text-[#172033] ring-black/10"
                ].join(" ")}
              >
                {!isUser ? (
                  <div className="mb-1 flex items-center gap-1 text-[11px] font-semibold text-[#be185d]">
                    <Sparkles size={11} />
                    NIA
                  </div>
                ) : null}

                <div className="whitespace-pre-wrap break-words">{message.text}</div>

                {!isUser && message.tool ? (
                  <div className="mt-2">
                    <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                      ✓ {message.tool}
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {sending ? (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm border border-black/10 bg-white px-3.5 py-2.5 text-[13px] font-normal text-[#64748b] shadow-sm">
              <span className="inline-flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" />
                NIA pensando...
              </span>
            </div>
          </div>
        ) : null}

        <div ref={messagesEndRef} />
      </div>

      <div className="relative z-20 shrink-0 border-t border-black/10 bg-white p-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-purple-100 bg-purple-50 text-[#8b2cff] opacity-60"
            title="Audio para NIA"
          >
            <Mic size={18} />
          </button>

          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void sendNiaMessage();
              }
            }}
            placeholder={`Hablale a NIA sobre ${getContextName(currentContext)}...`}
            className="h-10 min-w-0 flex-1 rounded-full border border-purple-100 bg-[#faf5ff] px-4 text-[13px] font-normal text-[#172033] outline-none placeholder:text-[#a78bfa] focus:border-[#8b2cff]"
          />

          <button
            type="button"
            onClick={sendNiaMessage}
            disabled={!input.trim() || sending}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#8b2cff] text-white shadow-sm transition hover:bg-[#7c3aed] disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Enviar a NIA"
          >
            {sending ? <Loader2 size={17} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        <div className="mt-2 text-[11px] font-normal text-[#94a3b8]">
          Este chat no envía mensajes al pasajero. Es comunicación interna con NIA.
        </div>
      </div>
    </>
  );
}

export default NiaInternalChat;