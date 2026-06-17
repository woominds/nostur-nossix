// @ts-nocheck
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

type AiAnalysis = {
  conversation_id: string;

  resumen: string;
  summary: string;

  respuesta_sugerida: string;
  suggested_response: string;

  puntaje_lead: number;
  lead_score: number;

  temperatura_lead: string;
  lead_temperature: string;

  intencion: string;
  intent: string;

  sentimiento: string;
  sentiment: string;

  prioridad_sugerida: string;
  priority: string;

  informacion_faltante: string[];
  missing_info: string[];

  proximas_acciones: string[];
  next_actions: string[];

  etiquetas_sugeridas: string[];
  suggested_tags: string[];

  datos_detectados: {
    destino?: string | null;
    fecha_viaje?: string | null;
    cantidad_pasajeros?: string | null;
    presupuesto?: string | null;
    origen?: string | null;
    nombre?: string | null;
    telefono?: string | null;
    email?: string | null;
    preferencias?: string | null;
    restricciones?: string[];
    objeciones?: string[];
    intereses?: string[];
  };

  preferencias_generales: string;
  restricciones: string[];
  objeciones: string[];
  intereses: string[];

  confianza: number;
  analyzed_at: string;

  persisted_event_id?: string | null;
  contact_ai_profile_id?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
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

function nullableText(value: unknown): string | null {
  const text = cleanText(value);
  return text ? text : null;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function clampScore(value: unknown): number {
  return Math.max(0, Math.min(100, safeNumber(value, 0)));
}

function safeArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => cleanText(item))
    .filter(Boolean);
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizePhone(value: unknown): string | null {
  const raw = String(value || "").replace(/[^\d+]/g, "");
  if (!raw) return null;
  if (raw.startsWith("+")) return raw;
  return `+${raw}`;
}

function mergeUniqueArrays(...arrays: string[][]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  arrays.flat().forEach((item) => {
    const clean = cleanText(item);
    if (!clean) return;

    const key = clean.toLowerCase();

    if (seen.has(key)) return;

    seen.add(key);
    result.push(clean);
  });

  return result;
}

function normalizePipelineStatus(value: unknown): string {
  const estado = cleanText(value).toUpperCase();

  if (estado === "PRESUPUESTADO" || estado === "COTIZADO") return "COTIZADO";
  if (estado === "VENDIDO" || estado === "GANADO") return "GANADO";
  if (estado === "PERDIDO" || estado === "CERRADO" || estado === "RECHAZADO") return "PERDIDO";

  return "OPORTUNIDAD";
}

function normalizeTemperature(value: unknown, score: number): string {
  const text = cleanText(value).toUpperCase();

  if (["FRIO", "FRÍA", "FRIA"].includes(text)) return "FRIO";
  if (["TIBIO", "TIBIA"].includes(text)) return "TIBIO";
  if (["CALIENTE"].includes(text)) return "CALIENTE";
  if (["URGENTE"].includes(text)) return "CALIENTE";

  if (score >= 75) return "CALIENTE";
  if (score >= 45) return "TIBIO";
  if (score > 0) return "FRIO";

  return "SIN_ANALISIS";
}

function extractOutputText(openAiResponse: any): string {
  if (typeof openAiResponse?.output_text === "string") {
    return openAiResponse.output_text;
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

function parseJsonFromText(text: string): Record<string, unknown> {
  const cleaned = cleanText(text);

  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/);

    if (!match) return {};

    try {
      return JSON.parse(match[0]);
    } catch {
      return {};
    }
  }
}

function normalizeAnalysis(raw: Record<string, unknown>, conversationId: string): AiAnalysis {
  const datosDetectados = readRecord(raw.datos_detectados || raw.datosDetectados || raw.datos);

  const resumen =
    cleanText(raw.resumen || raw.summary) ||
    "No se pudo generar un resumen claro.";

  const respuestaSugerida =
    cleanText(raw.respuesta_sugerida || raw.suggested_response) ||
    "Hola, te escribimos para continuar con el seguimiento de tu consulta. ¿Nos confirmás cómo seguimos?";

  const puntajeLead = clampScore(raw.puntaje_lead || raw.lead_score);

  const temperaturaLead = normalizeTemperature(
    raw.temperatura_lead || raw.lead_temperature,
    puntajeLead
  );

  const intencion =
    cleanText(raw.intencion || raw.intent) ||
    "Seguimiento / consulta operativa";

  const sentimiento =
    cleanText(raw.sentimiento || raw.sentiment).toUpperCase() || "NEUTRO";

  const prioridad =
    cleanText(raw.prioridad_sugerida || raw.priority).toUpperCase() || "NORMAL";

  const informacionFaltante = safeArray(raw.informacion_faltante || raw.missing_info);
  const proximasAcciones = safeArray(raw.proximas_acciones || raw.next_actions);
  const etiquetasSugeridas = safeArray(raw.etiquetas_sugeridas || raw.suggested_tags);

  const restricciones = safeArray(raw.restricciones || datosDetectados.restricciones);
  const objeciones = safeArray(raw.objeciones || datosDetectados.objeciones);
  const intereses = safeArray(raw.intereses || datosDetectados.intereses);

  const preferenciasGenerales =
    cleanText(
      raw.preferencias_generales ||
        raw.preferencias ||
        datosDetectados.preferencias ||
        datosDetectados.preferencias_generales
    ) || "";

  return {
    conversation_id: conversationId,

    resumen,
    summary: resumen,

    respuesta_sugerida: respuestaSugerida,
    suggested_response: respuestaSugerida,

    puntaje_lead: puntajeLead,
    lead_score: puntajeLead,

    temperatura_lead: temperaturaLead,
    lead_temperature: temperaturaLead,

    intencion,
    intent: intencion,

    sentimiento,
    sentiment: sentimiento,

    prioridad_sugerida: prioridad,
    priority: prioridad,

    informacion_faltante: informacionFaltante,
    missing_info: informacionFaltante,

    proximas_acciones: proximasAcciones,
    next_actions: proximasAcciones,

    etiquetas_sugeridas: etiquetasSugeridas,
    suggested_tags: etiquetasSugeridas,

    datos_detectados: {
      destino: nullableText(datosDetectados.destino),
      fecha_viaje: nullableText(datosDetectados.fecha_viaje || datosDetectados.fecha),
      cantidad_pasajeros: nullableText(datosDetectados.cantidad_pasajeros || datosDetectados.pasajeros),
      presupuesto: nullableText(datosDetectados.presupuesto),
      origen: nullableText(datosDetectados.origen),
      nombre: nullableText(datosDetectados.nombre),
      telefono: nullableText(datosDetectados.telefono),
      email: nullableText(datosDetectados.email),
      preferencias: nullableText(datosDetectados.preferencias || preferenciasGenerales),
      restricciones,
      objeciones,
      intereses
    },

    preferencias_generales: preferenciasGenerales,
    restricciones,
    objeciones,
    intereses,

    confianza: clampScore(raw.confianza || 75),
    analyzed_at: new Date().toISOString()
  };
}

function analysisFromEvent(row: any): AiAnalysis {
  const metadata = readRecord(row?.metadata);
  const metadataAnalysis = readRecord(metadata.analysis);
  const outputParsed = parseJsonFromText(row?.output_text || "{}");

  const raw = {
    ...outputParsed,
    ...metadataAnalysis,

    resumen: row?.ai_resumen || outputParsed.resumen || metadataAnalysis.resumen,
    summary: row?.ai_resumen || outputParsed.summary || metadataAnalysis.summary,

    respuesta_sugerida:
      outputParsed.respuesta_sugerida ||
      outputParsed.suggested_response ||
      metadataAnalysis.respuesta_sugerida ||
      metadataAnalysis.suggested_response,

    suggested_response:
      outputParsed.suggested_response ||
      outputParsed.respuesta_sugerida ||
      metadataAnalysis.suggested_response ||
      metadataAnalysis.respuesta_sugerida,

    puntaje_lead: row?.ai_score ?? outputParsed.puntaje_lead ?? outputParsed.lead_score,
    lead_score: row?.ai_score ?? outputParsed.lead_score ?? outputParsed.puntaje_lead,

    temperatura_lead:
      row?.ai_temperatura ||
      outputParsed.temperatura_lead ||
      outputParsed.lead_temperature,

    lead_temperature:
      row?.ai_temperatura ||
      outputParsed.lead_temperature ||
      outputParsed.temperatura_lead,

    intencion:
      row?.ai_intencion_compra ||
      outputParsed.intencion ||
      outputParsed.intent,

    intent:
      row?.ai_intencion_compra ||
      outputParsed.intent ||
      outputParsed.intencion,

    sentimiento:
      outputParsed.sentimiento ||
      outputParsed.sentiment ||
      metadataAnalysis.sentimiento ||
      metadataAnalysis.sentiment,

    sentiment:
      outputParsed.sentiment ||
      outputParsed.sentimiento ||
      metadataAnalysis.sentiment ||
      metadataAnalysis.sentimiento,

    prioridad_sugerida:
      row?.ai_urgencia ||
      outputParsed.prioridad_sugerida ||
      outputParsed.priority,

    priority:
      row?.ai_urgencia ||
      outputParsed.priority ||
      outputParsed.prioridad_sugerida,

    informacion_faltante:
      outputParsed.informacion_faltante ||
      outputParsed.missing_info ||
      metadataAnalysis.informacion_faltante ||
      metadataAnalysis.missing_info,

    missing_info:
      outputParsed.missing_info ||
      outputParsed.informacion_faltante ||
      metadataAnalysis.missing_info ||
      metadataAnalysis.informacion_faltante,

    proximas_acciones:
      outputParsed.proximas_acciones ||
      outputParsed.next_actions ||
      metadataAnalysis.proximas_acciones ||
      metadataAnalysis.next_actions,

    next_actions:
      outputParsed.next_actions ||
      outputParsed.proximas_acciones ||
      metadataAnalysis.next_actions ||
      metadataAnalysis.proximas_acciones,

    etiquetas_sugeridas:
      outputParsed.etiquetas_sugeridas ||
      outputParsed.suggested_tags ||
      metadataAnalysis.etiquetas_sugeridas ||
      metadataAnalysis.suggested_tags,

    suggested_tags:
      outputParsed.suggested_tags ||
      outputParsed.etiquetas_sugeridas ||
      metadataAnalysis.suggested_tags ||
      metadataAnalysis.etiquetas_sugeridas,

    datos_detectados:
      outputParsed.datos_detectados ||
      metadataAnalysis.datos_detectados ||
      metadataAnalysis.datosDetectados,

    preferencias_generales:
      outputParsed.preferencias_generales ||
      metadataAnalysis.preferencias_generales,

    restricciones:
      outputParsed.restricciones ||
      metadataAnalysis.restricciones,

    objeciones:
      outputParsed.objeciones ||
      metadataAnalysis.objeciones,

    intereses:
      outputParsed.intereses ||
      metadataAnalysis.intereses,

    confianza:
      outputParsed.confianza ||
      metadataAnalysis.confianza ||
      75
  };

  const analysis = normalizeAnalysis(raw, row.conversation_id);
  analysis.analyzed_at = row.created_at || analysis.analyzed_at;
  analysis.persisted_event_id = row.id || null;
  analysis.contact_ai_profile_id = row.contact_ai_profile_id || null;

  return analysis;
}

async function insertAiEvent({
  supabase,
  conversationId,
  contactoId,
  clienteId,
  contactAiProfileId,
  currentUserId,
  inputText,
  outputText,
  analysis,
  status,
  errorMessage,
  rawResponse
}: {
  supabase: any;
  conversationId: string;
  contactoId?: string | null;
  clienteId?: string | null;
  contactAiProfileId?: string | null;
  currentUserId: string | null;
  inputText: string;
  outputText: string | null;
  analysis: AiAnalysis | null;
  status: "OK" | "ERROR";
  errorMessage?: string | null;
  rawResponse?: unknown;
}) {
  const insertPayload: Record<string, unknown> = {
    conversation_id: conversationId,
    contacto_id: contactoId || null,
    cliente_id: clienteId || null,
    contact_ai_profile_id: contactAiProfileId || null,
    message_id: null,

    event_type: status === "OK" ? "ANALISIS" : "ERROR",
    event_status: status,

    input_text: inputText,
    output_text: outputText,

    ai_score: analysis?.lead_score ?? null,
    ai_temperatura: analysis?.lead_temperature ?? null,
    ai_resumen: analysis?.summary ?? null,
    ai_next_action: analysis?.next_actions?.[0] || null,

    ai_destino_detectado: analysis?.datos_detectados?.destino || null,
    ai_fecha_detectada: analysis?.datos_detectados?.fecha_viaje || null,
    ai_pax_detectados: analysis?.datos_detectados?.cantidad_pasajeros || null,
    ai_presupuesto_detectado: analysis?.datos_detectados?.presupuesto || null,

    ai_intencion_compra: analysis?.intent ?? null,
    ai_urgencia: analysis?.priority ?? null,
    ai_motivo_derivacion: null,

    model_used: "gpt-4.1-mini",
    prompt_version: "crm_ia_v2",
    tokens_input: 0,
    tokens_output: 0,
    estimated_cost: 0,

    error_message: errorMessage || null,

    metadata: {
      provider: "OPENAI",
      analysis,
      raw_response: rawResponse || null
    },

    created_by: currentUserId
  };

  const { data, error } = await supabase
    .from("conversation_ai_events")
    .insert(insertPayload)
    .select("id, created_at")
    .single();

  if (error) {
    console.error("conversation_ai_events insert error", error);
    return null;
  }

  return data;
}

async function upsertContactAiProfile({
  supabase,
  conversation,
  analysis,
  currentUserId,
  aiEventId
}: {
  supabase: any;
  conversation: any;
  analysis: AiAnalysis;
  currentUserId: string | null;
  aiEventId?: string | null;
}) {
  const existingRes = await supabase
    .from("contact_ai_profiles")
    .select("*")
    .eq("conversation_id", conversation.id)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const existing = existingRes.data || null;

  const existingMetadata = readRecord(existing?.metadata);
  const now = new Date().toISOString();

  const destinosInteres = mergeUniqueArrays(
    safeArray(existing?.destinos_interes),
    analysis.datos_detectados.destino ? [analysis.datos_detectados.destino] : []
  );

  const fechasInteres = mergeUniqueArrays(
    safeArray(existing?.fechas_interes),
    analysis.datos_detectados.fecha_viaje ? [analysis.datos_detectados.fecha_viaje] : []
  );

  const restricciones = mergeUniqueArrays(
    safeArray(existing?.restricciones),
    analysis.restricciones,
    analysis.datos_detectados.restricciones || []
  );

  const objeciones = mergeUniqueArrays(
    safeArray(existing?.objeciones),
    analysis.objeciones,
    analysis.datos_detectados.objeciones || []
  );

  const intereses = mergeUniqueArrays(
    safeArray(existing?.intereses),
    analysis.intereses,
    analysis.datos_detectados.intereses || []
  );

  const payload: Record<string, unknown> = {
    conversation_id: conversation.id,
    contacto_id: conversation.contacto_id || null,
    cliente_id: conversation.cliente_id || null,

    nombre_detectado:
      analysis.datos_detectados.nombre ||
      conversation.contacto_nombre ||
      conversation.titulo ||
      conversation.subject ||
      existing?.nombre_detectado ||
      null,

    telefono_detectado:
      normalizePhone(analysis.datos_detectados.telefono) ||
      normalizePhone(conversation.telefono) ||
      existing?.telefono_detectado ||
      null,

    email_detectado:
      analysis.datos_detectados.email ||
      conversation.email ||
      existing?.email_detectado ||
      null,

    score_actual: analysis.lead_score,
    temperatura_actual: analysis.lead_temperature,

    resumen_general: analysis.resumen,
    preferencias_generales:
      analysis.preferencias_generales ||
      analysis.datos_detectados.preferencias ||
      existing?.preferencias_generales ||
      null,

    destinos_interes: destinosInteres,
    fechas_interes: fechasInteres,

    cantidad_pasajeros:
      analysis.datos_detectados.cantidad_pasajeros ||
      existing?.cantidad_pasajeros ||
      null,

    presupuesto_estimado:
      analysis.datos_detectados.presupuesto ||
      existing?.presupuesto_estimado ||
      null,

    restricciones,
    objeciones,
    intereses,

    ultimo_resumen_ia: analysis.resumen,
    ultima_accion_sugerida: analysis.next_actions?.[0] || null,
    ultima_respuesta_sugerida: analysis.suggested_response || null,

    informacion_faltante: analysis.missing_info || [],
    etiquetas_sugeridas: analysis.suggested_tags || [],

    estado_pipeline: normalizePipelineStatus(conversation.estado_comercial),
    estado_ia: "ACTIVO",

    metadata: {
      ...existingMetadata,
      last_ai_event_id: aiEventId || existingMetadata.last_ai_event_id || null,
      last_ai_analysis_at: now,
      last_ai_confidence: analysis.confianza,
      last_ai_intent: analysis.intent,
      last_ai_priority: analysis.priority,
      source: "analyze-conversation-ai"
    },

    updated_by: currentUserId,
    updated_at: now
  };

  if (!existing) {
    payload.created_by = currentUserId;
  }

  if (existing?.id) {
    const updateRes = await supabase
      .from("contact_ai_profiles")
      .update(payload)
      .eq("id", existing.id)
      .select("id")
      .single();

    if (updateRes.error) {
      console.error("contact_ai_profiles update error", updateRes.error);
      return null;
    }

    return updateRes.data;
  }

  const insertRes = await supabase
    .from("contact_ai_profiles")
    .insert(payload)
    .select("id")
    .single();

  if (insertRes.error) {
    console.error("contact_ai_profiles insert error", insertRes.error);
    return null;
  }

  return insertRes.data;
}

async function insertActionLog({
  supabase,
  conversation,
  contactAiProfileId,
  aiEventId,
  currentUserId,
  analysis,
  previousValue,
  source
}: {
  supabase: any;
  conversation: any;
  contactAiProfileId?: string | null;
  aiEventId?: string | null;
  currentUserId: string | null;
  analysis: AiAnalysis;
  previousValue?: Record<string, unknown> | null;
  source: string;
}) {
  const { error } = await supabase.from("ai_actions_log").insert({
    conversation_id: conversation.id,
    contacto_id: conversation.contacto_id || null,
    cliente_id: conversation.cliente_id || null,
    contact_ai_profile_id: contactAiProfileId || null,
    ai_event_id: aiEventId || null,

    action_type: "AI_ANALYSIS",
    action_title: "Análisis IA de conversación",
    action_detail: analysis.resumen,

    actor_type: "AI",
    actor_id: currentUserId || null,
    source,

    previous_value: previousValue || null,
    new_value: {
      score: analysis.lead_score,
      temperatura: analysis.lead_temperature,
      resumen: analysis.resumen,
      proxima_accion: analysis.next_actions?.[0] || null,
      informacion_faltante: analysis.missing_info || [],
      preferencias_generales: analysis.preferencias_generales || null
    },

    metadata: {
      prompt_version: "crm_ia_v2",
      confidence: analysis.confianza,
      suggested_response: analysis.suggested_response,
      tags: analysis.suggested_tags
    },

    created_by: currentUserId
  });

  if (error) {
    console.error("ai_actions_log insert error", error);
  }
}

async function insertUsageLog({
  supabase,
  conversationId,
  contactoId,
  contactAiProfileId,
  aiEventId,
  currentUserId,
  success,
  errorMessage
}: {
  supabase: any;
  conversationId: string;
  contactoId?: string | null;
  contactAiProfileId?: string | null;
  aiEventId?: string | null;
  currentUserId: string | null;
  success: boolean;
  errorMessage?: string | null;
}) {
  try {
    await supabase.from("ai_usage_log").insert({
      conversation_id: conversationId,
      contacto_id: contactoId || null,
      contact_ai_profile_id: contactAiProfileId || null,
      ai_event_id: aiEventId || null,

      provider: "OPENAI",
      model: "gpt-4.1-mini",
      model_used: "gpt-4.1-mini",

      operation: "analyze_conversation_ai",
      action: "analyze_conversation_ai",

      tokens_input: 0,
      tokens_output: 0,
      estimated_cost: 0,

      success,
      error_message: errorMessage || null,

      metadata: {
        source: "analyze-conversation-ai"
      },

      created_by: currentUserId
    });
  } catch (_error) {
    // No bloquear análisis por logging.
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Método no permitido." }, 405);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const conversationId = cleanText(body.conversation_id);
    const force = Boolean(body.force);
    const source = cleanText(body.source) || "comunicaciones_panel";

    if (!conversationId) {
      return jsonResponse({ ok: false, error: "Falta conversation_id." }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!supabaseUrl || !supabaseAnonKey) {
      return jsonResponse(
        { ok: false, error: "Faltan variables SUPABASE_URL o SUPABASE_ANON_KEY." },
        500
      );
    }

    if (!openAiKey) {
      return jsonResponse(
        { ok: false, error: "Falta OPENAI_API_KEY en Supabase Secrets." },
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

    const supabaseAdmin = createClient(
      supabaseUrl,
      supabaseServiceRoleKey || supabaseAnonKey,
      {
        auth: {
          persistSession: false
        }
      }
    );

    let currentUserId: string | null = null;

    if (bearerToken) {
      const userRes = await supabaseUser.auth.getUser(bearerToken);
      currentUserId = userRes.data?.user?.id || null;
    }

    if (!force) {
      const cachedRes = await supabaseAdmin
        .from("conversation_ai_events")
        .select("*")
        .eq("conversation_id", conversationId)
        .eq("event_status", "OK")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cachedRes.data) {
        const cachedAnalysis = analysisFromEvent(cachedRes.data);

        return jsonResponse({
          ok: true,
          cached: true,
          analysis: cachedAnalysis,
          data: cachedAnalysis
        });
      }
    }

    const conversationRes = await supabaseUser
      .from("conversations")
      .select(
        "id, contacto_id, cliente_id, contacto_nombre, telefono, email, subject, titulo, assigned_to, estado_gestion, estado_comercial, prioridad, last_message, created_at, updated_at"
      )
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

    if (!conversationRes.data) {
      return jsonResponse({ ok: false, error: "No se encontró la conversación." }, 404);
    }

    const conversation = conversationRes.data;

    const messagesRes = await supabaseUser
      .from("messages")
      .select("direction, sender_type, sender_name, content, message_type, created_at")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .limit(120);

    if (messagesRes.error) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudieron leer los mensajes.",
          detail: messagesRes.error.message
        },
        500
      );
    }

    const messages = (messagesRes.data || [])
      .filter((message) => cleanText(message.content))
      .map((message) => {
        const who =
          message.direction === "outbound"
            ? "Agente"
            : message.direction === "system"
              ? "Sistema"
              : "Cliente";

        return `[${message.created_at}] ${who}: ${cleanText(message.content)}`;
      });

    if (messages.length === 0) {
      return jsonResponse(
        {
          ok: false,
          error: "La conversación no tiene mensajes de texto para analizar."
        },
        400
      );
    }

    const existingProfileRes = await supabaseAdmin
      .from("contact_ai_profiles")
      .select("*")
      .eq("conversation_id", conversationId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const existingProfile = existingProfileRes.data || null;

    const transcript = messages.join("\n").slice(-18000);

    const prompt = `
Sos el Asistente Comercial interno de NOSSIX Travel / ALMUNDO Córdoba.

Tu trabajo es analizar conversaciones comerciales y operativas de WhatsApp para ayudar a vendedores, gerencia y administración.

Devolvé SOLO JSON válido. Sin markdown. Sin explicación externa.

Objetivo principal:
- Resumir la conversación.
- Calificar la oportunidad comercial con una rúbrica estricta.
- Detectar próximos pasos concretos.
- Construir de a poco una ficha inteligente del cliente.
- Detectar preferencias generales del cliente.
- Sugerir una respuesta lista para WhatsApp.
- Registrar datos faltantes.
- No inventar datos.

Rúbrica de score:
0 a 20:
- conversación sin intención comercial clara;
- solo saludo, consulta mínima o tema administrativo menor;
- no hay fechas, destino, presupuesto ni señales de compra.

21 a 44:
- interés débil o muy inicial;
- falta información clave;
- el cliente pregunta algo general pero no avanza.

45 a 64:
- oportunidad tibia;
- hay destino, producto o necesidad clara;
- falta cerrar datos importantes como fechas, pasajeros, presupuesto o decisión.

65 a 79:
- oportunidad buena;
- el cliente ya está comparando, pidiendo precio, disponibilidad o condiciones;
- hay intención real pero todavía falta decisión.

80 a 100:
- oportunidad caliente;
- el cliente muestra intención concreta de compra, urgencia, elección cercana, envío de datos, pago, reserva o confirmación.

Reglas importantes:
- No des scores altos por una simple consulta.
- Si no hay datos suficientes, bajá el score.
- Si es postventa/reclamo/operativo, no fuerces venta.
- Si es un reclamo urgente, la prioridad puede ser alta aunque el score comercial sea bajo.
- No inventes destino, fechas, pasajeros, presupuesto ni preferencias.
- Si algo no aparece, dejalo vacío o pedilo como información faltante.
- Usá español argentino, tono profesional y humano.
- La respuesta sugerida debe poder copiarse y enviarse por WhatsApp.

Formato exacto:
{
  "resumen": "string",
  "respuesta_sugerida": "string",
  "puntaje_lead": 0,
  "temperatura_lead": "FRIO | TIBIO | CALIENTE",
  "intencion": "string",
  "sentimiento": "POSITIVO | NEUTRO | NEGATIVO | ANSIOSO",
  "prioridad_sugerida": "BAJA | NORMAL | ALTA | URGENTE",
  "informacion_faltante": ["string"],
  "proximas_acciones": ["string"],
  "etiquetas_sugeridas": ["string"],
  "datos_detectados": {
    "destino": "string o null",
    "fecha_viaje": "string o null",
    "cantidad_pasajeros": "string o null",
    "presupuesto": "string o null",
    "origen": "string o null",
    "nombre": "string o null",
    "telefono": "string o null",
    "email": "string o null",
    "preferencias": "string o null",
    "restricciones": ["string"],
    "objeciones": ["string"],
    "intereses": ["string"]
  },
  "preferencias_generales": "string",
  "restricciones": ["string"],
  "objeciones": ["string"],
  "intereses": ["string"],
  "confianza": 0
}

Ficha IA existente del cliente, si existe:
${existingProfile ? JSON.stringify(existingProfile, null, 2) : "Sin ficha IA previa."}

Datos actuales de la conversación:
Nombre: ${conversation.contacto_nombre || conversation.titulo || conversation.subject || "Sin nombre"}
Teléfono: ${conversation.telefono || "Sin teléfono"}
Email: ${conversation.email || "Sin email"}
Estado gestión: ${conversation.estado_gestion || "Sin estado"}
Estado comercial: ${conversation.estado_comercial || "Sin estado"}
Prioridad actual: ${conversation.prioridad || "NORMAL"}
Forzar nuevo análisis: ${force ? "sí" : "no"}

Mensajes:
${transcript}
`.trim();

    const openAiRes = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4.1-mini",
        input: prompt,
        temperature: 0.15,
        max_output_tokens: 1500
      })
    });

    const openAiJson = await openAiRes.json().catch(async () => {
      const text = await openAiRes.text().catch(() => "");
      return { error: { message: text || "Respuesta inválida de OpenAI." } };
    });

    if (!openAiRes.ok) {
      const errorMessage = openAiJson?.error?.message || "Error desconocido de OpenAI.";

      const errorEvent = await insertAiEvent({
        supabase: supabaseAdmin,
        conversationId,
        contactoId: conversation.contacto_id || null,
        clienteId: conversation.cliente_id || null,
        contactAiProfileId: existingProfile?.id || null,
        currentUserId,
        inputText: prompt,
        outputText: JSON.stringify(openAiJson, null, 2),
        analysis: null,
        status: "ERROR",
        errorMessage,
        rawResponse: openAiJson
      });

      await insertUsageLog({
        supabase: supabaseAdmin,
        conversationId,
        contactoId: conversation.contacto_id || null,
        contactAiProfileId: existingProfile?.id || null,
        aiEventId: errorEvent?.id || null,
        currentUserId,
        success: false,
        errorMessage
      });

      return jsonResponse(
        {
          ok: false,
          error: "OpenAI rechazó el análisis.",
          detail: errorMessage
        },
        500
      );
    }

    const outputText = extractOutputText(openAiJson);
    const parsed = parseJsonFromText(outputText);
    const analysis = normalizeAnalysis(parsed, conversationId);

    const profileBefore = existingProfile
      ? {
          id: existingProfile.id,
          score_actual: existingProfile.score_actual,
          temperatura_actual: existingProfile.temperatura_actual,
          resumen_general: existingProfile.resumen_general,
          preferencias_generales: existingProfile.preferencias_generales,
          destinos_interes: existingProfile.destinos_interes,
          fechas_interes: existingProfile.fechas_interes
        }
      : null;

    let savedEvent = await insertAiEvent({
      supabase: supabaseAdmin,
      conversationId,
      contactoId: conversation.contacto_id || null,
      clienteId: conversation.cliente_id || null,
      contactAiProfileId: existingProfile?.id || null,
      currentUserId,
      inputText: prompt,
      outputText: JSON.stringify(analysis, null, 2),
      analysis,
      status: "OK",
      errorMessage: null,
      rawResponse: openAiJson
    });

    if (savedEvent?.id) {
      analysis.persisted_event_id = savedEvent.id;
      analysis.analyzed_at = savedEvent.created_at || analysis.analyzed_at;
    }

    const savedProfile = await upsertContactAiProfile({
      supabase: supabaseAdmin,
      conversation,
      analysis,
      currentUserId,
      aiEventId: savedEvent?.id || null
    });

    if (savedProfile?.id) {
      analysis.contact_ai_profile_id = savedProfile.id;

      if (savedEvent?.id) {
        await supabaseAdmin
          .from("conversation_ai_events")
          .update({
            contact_ai_profile_id: savedProfile.id
          })
          .eq("id", savedEvent.id);
      }

      await insertActionLog({
        supabase: supabaseAdmin,
        conversation,
        contactAiProfileId: savedProfile.id,
        aiEventId: savedEvent?.id || null,
        currentUserId,
        analysis,
        previousValue: profileBefore,
        source
      });
    }

    await insertUsageLog({
      supabase: supabaseAdmin,
      conversationId,
      contactoId: conversation.contacto_id || null,
      contactAiProfileId: savedProfile?.id || existingProfile?.id || null,
      aiEventId: savedEvent?.id || null,
      currentUserId,
      success: true,
      errorMessage: null
    });

    return jsonResponse({
      ok: true,
      cached: false,
      analysis,
      data: analysis
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Error interno al analizar la conversación.",
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});