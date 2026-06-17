// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type AssistantChatResponse = {
  ok: boolean;
  thread_id?: string | null;
  user_message_id?: string | null;
  assistant_message_id?: string | null;
  response?: string;
  error?: string;
  detail?: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: AssistantChatResponse | Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => cleanText(item)).filter(Boolean);
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/[^\d+]/g, "");
}

function extractOutputText(openAiResponse: any): string {
  if (typeof openAiResponse?.output_text === "string") {
    return openAiResponse.output_text.trim();
  }

  const output = openAiResponse?.output;
  if (!Array.isArray(output)) return "";

  const chunks: string[] = [];

  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;

    for (const part of content) {
      if (typeof part?.text === "string") chunks.push(part.text);
      if (typeof part?.content === "string") chunks.push(part.content);
    }
  }

  return chunks.join("\n").trim();
}

async function getCurrentUserId(supabaseUser: any, bearerToken: string): Promise<string | null> {
  if (!bearerToken) return null;

  const userRes = await supabaseUser.auth.getUser(bearerToken);
  return userRes.data?.user?.id || null;
}

function buildArrayText(label: string, values: unknown): string {
  const items = safeArray(values);

  if (items.length === 0) return `${label}: sin datos.`;

  return `${label}: ${items.join(", ")}.`;
}

async function insertActionLog({
  supabase,
  conversationId,
  contactoId,
  clienteId,
  contactAiProfileId,
  threadId,
  actorType,
  actorId,
  actionType,
  actionTitle,
  actionDetail,
  source,
  metadata,
  createdBy
}: {
  supabase: any;
  conversationId: string | null;
  contactoId?: string | null;
  clienteId?: string | null;
  contactAiProfileId?: string | null;
  threadId?: string | null;
  actorType: "AI" | "USER" | "SYSTEM" | string;
  actorId?: string | null;
  actionType: string;
  actionTitle: string;
  actionDetail: string;
  source: string;
  metadata?: Record<string, unknown> | null;
  createdBy?: string | null;
}) {
  try {
    await supabase.from("ai_actions_log").insert({
      conversation_id: conversationId,
      contacto_id: contactoId || null,
      cliente_id: clienteId || null,
      contact_ai_profile_id: contactAiProfileId || null,
      ai_event_id: null,
      action_type: actionType,
      action_title: actionTitle,
      action_detail: actionDetail,
      actor_type: actorType,
      actor_id: actorId || null,
      source,
      previous_value: null,
      new_value: null,
      metadata: {
        ...(metadata || {}),
        thread_id: threadId || null
      },
      created_by: createdBy || null
    });
  } catch (error) {
    console.error("ai_actions_log insert error", error);
  }
}

async function insertUsageLog({
  supabase,
  conversationId,
  contactoId,
  contactAiProfileId,
  threadId,
  currentUserId,
  success,
  errorMessage,
  rawResponse
}: {
  supabase: any;
  conversationId: string | null;
  contactoId?: string | null;
  contactAiProfileId?: string | null;
  threadId?: string | null;
  currentUserId?: string | null;
  success: boolean;
  errorMessage?: string | null;
  rawResponse?: unknown;
}) {
  try {
    await supabase.from("ai_usage_log").insert({
      conversation_id: conversationId,
      contacto_id: contactoId || null,
      contact_ai_profile_id: contactAiProfileId || null,
      thread_id: threadId || null,
      provider: "OPENAI",
      model: "gpt-4.1-mini",
      model_used: "gpt-4.1-mini",
      operation: "commercial_assistant_chat",
      action: "commercial_assistant_chat",
      tokens_input: 0,
      tokens_output: 0,
      estimated_cost: 0,
      success,
      error_message: errorMessage || null,
      metadata: {
        raw_response: rawResponse || null
      },
      created_by: currentUserId || null
    });
  } catch (error) {
    console.error("ai_usage_log insert error", error);
  }
}

async function ensureThread({
  supabase,
  threadId,
  conversation,
  profile,
  currentUserId
}: {
  supabase: any;
  threadId?: string | null;
  conversation: any;
  profile: any;
  currentUserId: string | null;
}) {
  if (threadId) {
    const existingRes = await supabase
      .from("ai_assistant_threads")
      .select("*")
      .eq("id", threadId)
      .maybeSingle();

    if (!existingRes.error && existingRes.data) {
      return existingRes.data;
    }
  }

  const title =
    cleanText(profile?.nombre_detectado) ||
    cleanText(conversation?.contacto_nombre) ||
    cleanText(conversation?.titulo) ||
    cleanText(conversation?.subject) ||
    cleanText(conversation?.telefono) ||
    "Asistente comercial";

  const insertRes = await supabase
    .from("ai_assistant_threads")
    .insert({
      title: `Asistente comercial · ${title}`,
      conversation_id: conversation?.id || null,
      contacto_id: conversation?.contacto_id || profile?.contacto_id || null,
      cliente_id: conversation?.cliente_id || profile?.cliente_id || null,
      contact_ai_profile_id: profile?.id || null,
      owner_id: currentUserId,
      thread_type: "COMMERCIAL_ASSISTANT",
      status: "ACTIVO",
      metadata: {
        source: "commercial-assistant-chat",
        conversation_id: conversation?.id || null,
        contact_ai_profile_id: profile?.id || null
      },
      created_by: currentUserId,
      updated_by: currentUserId
    })
    .select("*")
    .single();

  if (insertRes.error) {
    throw new Error(insertRes.error.message || "No se pudo crear el thread del asistente.");
  }

  return insertRes.data;
}

async function loadThreadMessages(supabase: any, threadId: string) {
  const messagesRes = await supabase
    .from("ai_assistant_messages")
    .select("role, content, audio_transcript, created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true })
    .limit(30);

  if (messagesRes.error) return [];

  return messagesRes.data || [];
}

async function loadConversationMessages(supabase: any, conversationId: string) {
  const messagesRes = await supabase
    .from("messages")
    .select("direction, sender_type, sender_name, content, message_type, created_at")
    .eq("conversation_id", conversationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(120);

  if (messagesRes.error) {
    throw new Error(messagesRes.error.message || "No se pudieron leer los mensajes de la conversación.");
  }

  return (messagesRes.data || [])
    .filter((message) => cleanText(message.content))
    .map((message) => {
      const who =
        message.direction === "outbound"
          ? "Agente"
          : message.direction === "system"
            ? "Sistema"
            : message.direction === "internal"
              ? "Interno"
              : "Cliente";

      return `[${message.created_at}] ${who}: ${cleanText(message.content)}`;
    });
}

function buildSystemPrompt({
  conversation,
  profile,
  latestAnalysis,
  conversationTranscript,
  threadMessages
}: {
  conversation: any;
  profile: any;
  latestAnalysis: any;
  conversationTranscript: string[];
  threadMessages: any[];
}) {
  const detectedName =
    cleanText(profile?.nombre_detectado) ||
    cleanText(conversation?.contacto_nombre) ||
    cleanText(conversation?.titulo) ||
    cleanText(conversation?.subject) ||
    "Sin nombre";

  const latestAnalysisMetadata = latestAnalysis?.metadata?.analysis || {};
  const latestAnalysisSummary =
    cleanText(latestAnalysis?.ai_resumen) ||
    cleanText(latestAnalysisMetadata?.resumen) ||
    cleanText(latestAnalysisMetadata?.summary) ||
    "Sin análisis previo.";

  const latestAction =
    cleanText(latestAnalysis?.ai_next_action) ||
    cleanText(latestAnalysisMetadata?.proxima_accion) ||
    cleanText(latestAnalysisMetadata?.next_action) ||
    "Sin próxima acción registrada.";

  const assistantHistory = threadMessages
    .slice(-12)
    .map((message) => {
      const role = message.role === "assistant" ? "IA" : message.role === "user" ? "Usuario" : message.role;
      const content = cleanText(message.content || message.audio_transcript);
      return `[${message.created_at}] ${role}: ${content}`;
    })
    .filter(Boolean)
    .join("\n");

  return `
Sos el Asistente Comercial interno de NOSSIX / ALMUNDO Franquicia Córdoba.

Tu función:
- ayudar al vendedor a responder mejor;
- resumir oportunidades;
- detectar datos faltantes;
- recomendar próximos pasos;
- preparar mensajes para WhatsApp;
- ordenar la oportunidad comercial;
- cuidar tono humano, profesional y vendedor;
- NO enviar mensajes al pasajero por tu cuenta;
- NO inventar datos;
- NO prometer disponibilidad, precio final, emisión, reserva ni confirmación si no está en la conversación;
- si faltan datos, decilo claro;
- si el cliente está frío o no hay intención real, no exageres el potencial;
- si te piden una respuesta para enviar, devolvé una respuesta lista para copiar.

Contexto del cliente:
Nombre detectado: ${detectedName}
Teléfono: ${profile?.telefono_detectado || conversation?.telefono || "Sin teléfono"}
Email: ${profile?.email_detectado || conversation?.email || "Sin email"}
Vendedor: ${conversation?.assigned_full_name || "Sin vendedor"}
Sucursal: ${conversation?.sucursal_nombre || "Sin sucursal"}
Estado gestión: ${conversation?.estado_gestion || "Sin estado"}
Estado comercial: ${conversation?.estado_comercial || "Sin estado"}
Prioridad actual: ${conversation?.prioridad || "NORMAL"}

Ficha viva IA:
Score actual: ${profile?.score_actual ?? "Sin score"}
Temperatura actual: ${profile?.temperatura_actual || "Sin temperatura"}
Resumen general: ${profile?.resumen_general || "Sin resumen general"}
Preferencias generales: ${profile?.preferencias_generales || "Sin preferencias"}
${buildArrayText("Destinos de interés", profile?.destinos_interes)}
${buildArrayText("Fechas de interés", profile?.fechas_interes)}
Cantidad de pasajeros: ${profile?.cantidad_pasajeros || "Sin datos"}
Presupuesto estimado: ${profile?.presupuesto_estimado || "Sin datos"}
${buildArrayText("Restricciones", profile?.restricciones)}
${buildArrayText("Objeciones", profile?.objeciones)}
${buildArrayText("Intereses", profile?.intereses)}
${buildArrayText("Información faltante", profile?.informacion_faltante)}
Última acción sugerida: ${profile?.ultima_accion_sugerida || "Sin datos"}
Última respuesta sugerida: ${profile?.ultima_respuesta_sugerida || "Sin datos"}

Último análisis de conversación:
Resumen: ${latestAnalysisSummary}
Próxima acción: ${latestAction}

Historial reciente del chat entre vendedor e IA:
${assistantHistory || "Sin historial previo."}

Transcripción reciente de la conversación con el pasajero:
${conversationTranscript.join("\n").slice(-18000)}

Respondé siempre en español argentino.
Usá formato claro, con subtítulos cortos si ayuda.
No uses markdown excesivo.
`.trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido." }, 405);
  }

  let threadForError: any = null;
  let conversationForError: any = null;
  let profileForError: any = null;
  let currentUserIdForError: string | null = null;

  try {
    const body = await req.json().catch(() => ({}));

    const conversationId = cleanText(body.conversation_id);
    const contactAiProfileId = cleanText(body.contact_ai_profile_id);
    const threadId = cleanText(body.thread_id);
    const userMessage = cleanText(body.message || body.content || body.text);
    const source = cleanText(body.source) || "asistente_comercial";

    if (!conversationId && !contactAiProfileId) {
      return jsonResponse(
        {
          ok: false,
          error: "Falta conversation_id o contact_ai_profile_id."
        },
        400
      );
    }

    if (!userMessage) {
      return jsonResponse(
        {
          ok: false,
          error: "El mensaje está vacío."
        },
        400
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(
        {
          ok: false,
          error: "Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY."
        },
        500
      );
    }

    if (!supabaseServiceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          error: "Falta SUPABASE_SERVICE_ROLE_KEY en Supabase Secrets."
        },
        500
      );
    }

    if (!openAiKey) {
      return jsonResponse(
        {
          ok: false,
          error: "Falta OPENAI_API_KEY en Supabase Secrets."
        },
        500
      );
    }

    const authHeader = req.headers.get("Authorization") || "";
    const bearerToken = authHeader.replace("Bearer ", "").trim();

    const supabaseUser = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      },
      auth: {
        persistSession: false
      }
    });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false
      }
    });

    const currentUserId = await getCurrentUserId(supabaseUser, bearerToken);
    currentUserIdForError = currentUserId;

    if (!currentUserId) {
      return jsonResponse(
        {
          ok: false,
          error: "No hay usuario autenticado."
        },
        401
      );
    }

    let conversation: any = null;
    let profile: any = null;

    if (conversationId) {
      const conversationRes = await supabaseUser
        .from("conversations")
        .select("*")
        .eq("id", conversationId)
        .maybeSingle();

      if (conversationRes.error) {
        return jsonResponse(
          {
            ok: false,
            error: "No se pudo leer la conversación.",
            detail: conversationRes.error.message
          },
          500
        );
      }

      conversation = conversationRes.data;
    }

    if (contactAiProfileId) {
      const profileRes = await supabaseAdmin
        .from("contact_ai_profiles")
        .select("*")
        .eq("id", contactAiProfileId)
        .maybeSingle();

      if (profileRes.error) {
        return jsonResponse(
          {
            ok: false,
            error: "No se pudo leer la ficha IA del contacto.",
            detail: profileRes.error.message
          },
          500
        );
      }

      profile = profileRes.data;
    }

    if (!profile && conversation?.id) {
      const profileRes = await supabaseAdmin
        .from("contact_ai_profiles")
        .select("*")
        .eq("conversation_id", conversation.id)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!profileRes.error) {
        profile = profileRes.data;
      }
    }

    if (!conversation && profile?.conversation_id) {
      const conversationRes = await supabaseUser
        .from("conversations")
        .select("*")
        .eq("id", profile.conversation_id)
        .maybeSingle();

      if (!conversationRes.error) {
        conversation = conversationRes.data;
      }
    }

    if (!conversation && !profile) {
      return jsonResponse(
        {
          ok: false,
          error: "No se encontró conversación ni ficha IA."
        },
        404
      );
    }

    conversationForError = conversation;
    profileForError = profile;

    const finalConversationId = conversation?.id || profile?.conversation_id || null;

    const thread = await ensureThread({
      supabase: supabaseAdmin,
      threadId,
      conversation,
      profile,
      currentUserId
    });

    threadForError = thread;

    await insertActionLog({
      supabase: supabaseAdmin,
      conversationId: finalConversationId,
      contactoId: conversation?.contacto_id || profile?.contacto_id || null,
      clienteId: conversation?.cliente_id || profile?.cliente_id || null,
      contactAiProfileId: profile?.id || null,
      threadId: thread.id,
      actorType: "USER",
      actorId: currentUserId,
      actionType: "ASSISTANT_USER_MESSAGE",
      actionTitle: "Consulta del vendedor a la IA",
      actionDetail: userMessage,
      source,
      metadata: {
        input_message: userMessage
      },
      createdBy: currentUserId
    });

    const userInsertRes = await supabaseAdmin
      .from("ai_assistant_messages")
      .insert({
        thread_id: thread.id,
        conversation_id: finalConversationId,
        contacto_id: conversation?.contacto_id || profile?.contacto_id || null,
        contact_ai_profile_id: profile?.id || null,
        role: "user",
        content: userMessage,
        audio_url: null,
        audio_transcript: null,
        metadata: {
          source,
          message_type: "text"
        },
        created_by: currentUserId
      })
      .select("id")
      .single();

    if (userInsertRes.error) {
      throw new Error(userInsertRes.error.message || "No se pudo guardar el mensaje del usuario.");
    }

    const threadMessages = await loadThreadMessages(supabaseAdmin, thread.id);

    let latestAnalysis: any = null;

    if (finalConversationId) {
      const latestAnalysisRes = await supabaseAdmin
        .from("conversation_ai_events")
        .select("*")
        .eq("conversation_id", finalConversationId)
        .eq("event_type", "ANALISIS")
        .eq("event_status", "OK")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestAnalysisRes.error) {
        latestAnalysis = latestAnalysisRes.data;
      }
    }

    const conversationTranscript = finalConversationId
      ? await loadConversationMessages(supabaseUser, finalConversationId)
      : [];

    const systemPrompt = buildSystemPrompt({
      conversation,
      profile,
      latestAnalysis,
      conversationTranscript,
      threadMessages
    });

    const openAiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: [
          {
            role: "system",
            content: systemPrompt
          },
          {
            role: "user",
            content: userMessage
          }
        ],
        temperature: 0.25,
        max_output_tokens: 1300
      })
    });

    const openAiJson = await openAiRes.json().catch(async () => {
      const text = await openAiRes.text().catch(() => "");
      return {
        error: {
          message: text || "Respuesta inválida de OpenAI."
        }
      };
    });

    if (!openAiRes.ok) {
      const errorMessage = openAiJson?.error?.message || "OpenAI rechazó la respuesta.";

      await insertUsageLog({
        supabase: supabaseAdmin,
        conversationId: finalConversationId,
        contactoId: conversation?.contacto_id || profile?.contacto_id || null,
        contactAiProfileId: profile?.id || null,
        threadId: thread.id,
        currentUserId,
        success: false,
        errorMessage,
        rawResponse: openAiJson
      });

      return jsonResponse(
        {
          ok: false,
          thread_id: thread.id,
          user_message_id: userInsertRes.data?.id || null,
          error: "OpenAI rechazó la consulta.",
          detail: errorMessage
        },
        500
      );
    }

    const assistantResponse =
      extractOutputText(openAiJson) ||
      "No pude generar una respuesta útil con la información disponible.";

    const assistantInsertRes = await supabaseAdmin
      .from("ai_assistant_messages")
      .insert({
        thread_id: thread.id,
        conversation_id: finalConversationId,
        contacto_id: conversation?.contacto_id || profile?.contacto_id || null,
        contact_ai_profile_id: profile?.id || null,
        role: "assistant",
        content: assistantResponse,
        audio_url: null,
        audio_transcript: null,
        metadata: {
          source,
          provider: "OPENAI",
          model: "gpt-4.1-mini",
          raw_response: openAiJson
        },
        created_by: currentUserId
      })
      .select("id")
      .single();

    if (assistantInsertRes.error) {
      throw new Error(assistantInsertRes.error.message || "No se pudo guardar la respuesta de la IA.");
    }

    await supabaseAdmin
      .from("ai_assistant_threads")
      .update({
        status: "ACTIVO",
        updated_at: new Date().toISOString(),
        updated_by: currentUserId,
        metadata: {
          ...(thread.metadata || {}),
          last_message_at: new Date().toISOString(),
          last_user_message: userMessage,
          last_assistant_response: assistantResponse
        }
      })
      .eq("id", thread.id);

    await insertActionLog({
      supabase: supabaseAdmin,
      conversationId: finalConversationId,
      contactoId: conversation?.contacto_id || profile?.contacto_id || null,
      clienteId: conversation?.cliente_id || profile?.cliente_id || null,
      contactAiProfileId: profile?.id || null,
      threadId: thread.id,
      actorType: "AI",
      actorId: null,
      actionType: "ASSISTANT_AI_RESPONSE",
      actionTitle: "Respuesta del Asistente Comercial",
      actionDetail: assistantResponse,
      source,
      metadata: {
        user_message: userMessage,
        assistant_response: assistantResponse
      },
      createdBy: currentUserId
    });

    await insertUsageLog({
      supabase: supabaseAdmin,
      conversationId: finalConversationId,
      contactoId: conversation?.contacto_id || profile?.contacto_id || null,
      contactAiProfileId: profile?.id || null,
      threadId: thread.id,
      currentUserId,
      success: true,
      errorMessage: null,
      rawResponse: openAiJson
    });

    return jsonResponse({
      ok: true,
      thread_id: thread.id,
      user_message_id: userInsertRes.data?.id || null,
      assistant_message_id: assistantInsertRes.data?.id || null,
      response: assistantResponse
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      if (supabaseUrl && supabaseServiceRoleKey) {
        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
          auth: {
            persistSession: false
          }
        });

        await insertUsageLog({
          supabase: supabaseAdmin,
          conversationId: conversationForError?.id || profileForError?.conversation_id || null,
          contactoId: conversationForError?.contacto_id || profileForError?.contacto_id || null,
          contactAiProfileId: profileForError?.id || null,
          threadId: threadForError?.id || null,
          currentUserId: currentUserIdForError,
          success: false,
          errorMessage: detail,
          rawResponse: null
        });

        await insertActionLog({
          supabase: supabaseAdmin,
          conversationId: conversationForError?.id || profileForError?.conversation_id || null,
          contactoId: conversationForError?.contacto_id || profileForError?.contacto_id || null,
          clienteId: conversationForError?.cliente_id || profileForError?.cliente_id || null,
          contactAiProfileId: profileForError?.id || null,
          threadId: threadForError?.id || null,
          actorType: "SYSTEM",
          actorId: currentUserIdForError,
          actionType: "ASSISTANT_CHAT_ERROR",
          actionTitle: "Error del Asistente Comercial",
          actionDetail: detail,
          source: "commercial-assistant-chat",
          metadata: {
            error: detail
          },
          createdBy: currentUserIdForError
        });
      }
    } catch (_logError) {
      // No bloquear respuesta por error de logging.
    }

    return jsonResponse(
      {
        ok: false,
        error: "Error interno en commercial-assistant-chat.",
        detail
      },
      500
    );
  }
});