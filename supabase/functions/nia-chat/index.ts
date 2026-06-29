// supabase/functions/nia-chat/index.ts

/* =========================================================
   NOSSIX / NOSTUR — nia-chat
   NIA · Asistente comercial interno

   Versión:
   - Acciones operativas por reglas.
   - Interpretación IA con OpenAI.
   - Usa nia_config: prompt_base, tono, reglas, modelo.
   - Puede modificar datos de oportunidad actual:
     "cambiale el destino a Miami"
     "poné origen Córdoba"
     "cambiá pasajeros a 4"
     "presupuesto 3000 usd"
   - NIA NO pide IDs técnicos al usuario.
========================================================= */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CODE_VERSION = "nia-chat-actions-v3-openai-tools";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type AnyRecord = Record<string, any>;

type NiaIntent =
  | "CAMBIAR_CONTEXTO_OPORTUNIDAD"
  | "MOVER_PIPELINE"
  | "RECALIFICAR_OPORTUNIDAD"
  | "RESUMIR_OPORTUNIDAD"
  | "ACTUALIZAR_DATO_OPORTUNIDAD"
  | "ACTIVAR_CANDE"
  | "DESACTIVAR_CANDE"
  | "REPORTE_DIARIO_VENDEDORES"
  | "CONSULTA_GENERAL";

type PipelineCanonical =
  | "GANADA"
  | "PERDIDA"
  | "PRESUPUESTADA"
  | "EN_GESTION"
  | "SIN_ATENDER";

type ResolveResult = {
  status: "resolved" | "ambiguous" | "not_found";
  opportunity: AnyRecord | null;
  matches: AnyRecord[];
  targetText: string;
  resolvedBy: string;
};

type AiInterpretation = {
  intent?: NiaIntent;
  targetText?: string;
  field?: string;
  value?: any;
  needs_confirmation?: boolean;
  answer?: string;
  confidence?: number;
};

function jsonResponse(body: AnyRecord, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function normalizeHumanText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s@.+-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function includesAny(text: unknown, values: string[]): boolean {
  const normalized = normalizeHumanText(text);
  return values.some((value) => normalized.includes(normalizeHumanText(value)));
}

function safeJsonText(value: unknown): string {
  try {
    return normalizeHumanText(JSON.stringify(value || {}));
  } catch {
    return "";
  }
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function getNowIso() {
  return new Date().toISOString();
}

function getSupabaseAdmin() {
  const supabaseUrl =
    Deno.env.get("NOSTUR_SUPABASE_URL") ||
    Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("NOSTUR_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("Falta NOSTUR_SUPABASE_URL o SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Falta NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getMessage(payload: AnyRecord): string {
  return (
    cleanText(payload.message) ||
    cleanText(payload.text) ||
    cleanText(payload.prompt) ||
    cleanText(payload.user_message) ||
    cleanText(payload.transcription) ||
    cleanText(payload.audio_transcription) ||
    cleanText(payload.body?.message) ||
    cleanText(payload.body?.text) ||
    cleanText(payload.context?.message) ||
    cleanText(payload.context?.text)
  );
}

function getUserId(payload: AnyRecord): string | null {
  return (
    cleanText(payload.user_id) ||
    cleanText(payload.userId) ||
    cleanText(payload.profile_id) ||
    cleanText(payload.profileId) ||
    cleanText(payload.context?.user_id) ||
    cleanText(payload.context?.profile_id) ||
    null
  );
}

function getConversationId(payload: AnyRecord): string | null {
  return (
    cleanText(payload.conversation_id) ||
    cleanText(payload.conversationId) ||
    cleanText(payload.conversacion_id) ||
    cleanText(payload.conversacionId) ||
    cleanText(payload.context?.conversation_id) ||
    cleanText(payload.context?.conversacion_id) ||
    null
  );
}

function getOportunidadId(payload: AnyRecord): string | null {
  return (
    cleanText(payload.oportunidad_id) ||
    cleanText(payload.oportunidadId) ||
    cleanText(payload.opportunity_id) ||
    cleanText(payload.opportunityId) ||
    cleanText(payload.context?.oportunidad_id) ||
    cleanText(payload.context?.opportunity_id) ||
    null
  );
}

function getSource(payload: AnyRecord): string {
  return cleanText(payload.source) || cleanText(payload.context?.source) || "nia-chat";
}

function getModule(payload: AnyRecord): string {
  return (
    cleanText(payload.module) ||
    cleanText(payload.modulo) ||
    cleanText(payload.context?.module) ||
    cleanText(payload.context?.modulo) ||
    "comunicaciones"
  );
}

/* =========================================================
   INTENCIONES / SINÓNIMOS
========================================================= */

const PIPELINE_SYNONYMS: Record<PipelineCanonical, string[]> = {
  GANADA: [
    "ganada",
    "ganado",
    "vendida",
    "vendido",
    "venta",
    "venta cerrada",
    "cerrada",
    "cerrado",
    "cerro",
    "cerró",
    "compro",
    "compró",
    "compra",
    "comprado",
    "comprada",
    "reservo",
    "reservó",
    "reservada",
    "reservado",
    "seño",
    "señó",
    "senio",
    "senado",
    "señado",
    "confirmada",
    "confirmado"
  ],
  PERDIDA: [
    "perdida",
    "perdido",
    "rechazada",
    "rechazado",
    "no compra",
    "no compro",
    "no compró",
    "descartada",
    "descartado",
    "cancelada",
    "cancelado",
    "perdio",
    "perdió",
    "baja",
    "sin interes",
    "sin interés"
  ],
  PRESUPUESTADA: [
    "presupuestada",
    "presupuestado",
    "presupuesto",
    "presupuesto enviado",
    "cotizacion enviada",
    "cotización enviada",
    "cotizada",
    "cotizado",
    "enviada",
    "enviado",
    "mandada",
    "mandado",
    "propuesta enviada"
  ],
  EN_GESTION: [
    "en gestion",
    "en gestión",
    "gestion",
    "gestión",
    "gestionar",
    "tomada",
    "tomado",
    "trabajando",
    "seguimiento",
    "seguir",
    "seguile",
    "recontactar",
    "recontacto",
    "volver a contactar",
    "en proceso"
  ],
  SIN_ATENDER: [
    "sin atender",
    "nuevo",
    "nueva",
    "pendiente",
    "sin tomar",
    "sin gestionar"
  ]
};

const ACTION_SYNONYMS = {
  cambiarContexto: [
    "cambiar a",
    "cambia a",
    "cambiá a",
    "cambiame a",
    "cambiame",
    "cambiate a",
    "abrir a",
    "abri a",
    "abrí a",
    "abrime a",
    "abrime",
    "seleccionar a",
    "selecciona a",
    "seleccioná a",
    "seleccioname a",
    "ir a",
    "anda a",
    "andá a",
    "andate a",
    "trabajar con",
    "trabajemos con",
    "seguimos con",
    "sigamos con",
    "ahora con",
    "contexto de",
    "poneme en",
    "ponete en",
    "usar a",
    "usa a",
    "usá a",
    "tomar a",
    "tomemos a"
  ],
  moverPipeline: [
    "pasar",
    "pasa",
    "pasá",
    "pasala",
    "pasalo",
    "pasame",
    "mover",
    "move",
    "movela",
    "movelo",
    "cambiar estado",
    "cambiale el estado",
    "mandar a",
    "dejar en",
    "dejala en",
    "dejalo en",
    "marcar",
    "marcala",
    "marcalo",
    "poner en",
    "ponela en",
    "ponelo en"
  ],
  recalificar: [
    "recalificar",
    "recalifica",
    "recalificá",
    "recalificala",
    "recalificalo",
    "calificar",
    "califica",
    "score",
    "scrore",
    "puntaje",
    "temperatura",
    "medir interes",
    "medir interés"
  ],
  resumen: [
    "resumen",
    "resumir",
    "resumime",
    "resumi",
    "resumí",
    "estado de",
    "contame",
    "que paso",
    "qué pasó",
    "que tenemos",
    "qué tenemos"
  ],
  activarCande: [
    "activar cande",
    "activa cande",
    "activá cande",
    "prender cande",
    "encender cande",
    "que atienda cande",
    "pasar a cande"
  ],
  desactivarCande: [
    "desactivar cande",
    "desactiva cande",
    "desactivá cande",
    "apagar cande",
    "frenar cande",
    "sacar cande",
    "que no atienda cande"
  ],
  reporte: [
    "reporte diario",
    "resumen diario",
    "mandar reporte",
    "manda reporte",
    "mandá reporte",
    "enviar reporte",
    "envia reporte",
    "enviá reporte",
    "reporte a vendedores",
    "reporte vendedores",
    "informe vendedores",
    "mandale a los vendedores",
    "mandar a vendedores"
  ]
};

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function detectPipelineCanonical(text: string): PipelineCanonical | null {
  const normalized = normalizeHumanText(text);

  for (const [canonical, words] of Object.entries(PIPELINE_SYNONYMS)) {
    const allWords = [canonical, ...words];

    if (allWords.some((word) => normalized.includes(normalizeHumanText(word)))) {
      return canonical as PipelineCanonical;
    }
  }

  return null;
}

function detectDatoUpdateIntent(message: string): boolean {
  const normalized = normalizeHumanText(message);

  return includesAny(normalized, [
    "cambiar destino",
    "cambia destino",
    "cambiá destino",
    "cambiale destino",
    "cambiale el destino",
    "modificar destino",
    "modifica destino",
    "modificá destino",
    "actualizar destino",
    "actualiza destino",
    "actualizá destino",
    "poner destino",
    "poné destino",
    "pone destino",
    "destino a",
    "destino es",
    "destino sea",
    "destino seria",
    "destino sería",

    "cambiar origen",
    "cambiale origen",
    "cambiale el origen",
    "origen a",
    "origen es",
    "origen sea",
    "salida desde",
    "sale desde",

    "cambiar fecha",
    "cambiale fecha",
    "cambiale la fecha",
    "fecha a",
    "fecha es",
    "fecha sea",
    "fechas a",
    "fechas son",

    "cambiar pasajeros",
    "cambiale pasajeros",
    "cambiale los pasajeros",
    "pasajeros a",
    "pasajeros son",
    "pax a",
    "pax son",
    "personas son",

    "cambiar presupuesto",
    "cambiale presupuesto",
    "cambiale el presupuesto",
    "presupuesto a",
    "presupuesto es",
    "presupuesto sea",

    "tipo de viaje a",
    "tipo de viaje es",
    "cambiar tipo de viaje",
    "cambiale tipo de viaje"
  ]);
}

function detectIntent(message: string): NiaIntent {
  const normalized = normalizeHumanText(message);
  const pipelineTarget = detectPipelineCanonical(message);

  if (includesAny(normalized, ACTION_SYNONYMS.reporte)) {
    return "REPORTE_DIARIO_VENDEDORES";
  }

  if (includesAny(normalized, ACTION_SYNONYMS.activarCande)) {
    return "ACTIVAR_CANDE";
  }

  if (includesAny(normalized, ACTION_SYNONYMS.desactivarCande)) {
    return "DESACTIVAR_CANDE";
  }

  if (detectDatoUpdateIntent(normalized)) {
    return "ACTUALIZAR_DATO_OPORTUNIDAD";
  }

  if (
    includesAny(normalized, ACTION_SYNONYMS.cambiarContexto) &&
    !pipelineTarget
  ) {
    return "CAMBIAR_CONTEXTO_OPORTUNIDAD";
  }

  if (includesAny(normalized, ACTION_SYNONYMS.recalificar)) {
    return "RECALIFICAR_OPORTUNIDAD";
  }

  if (
    pipelineTarget &&
    (includesAny(normalized, ACTION_SYNONYMS.moverPipeline) ||
      includesAny(normalized, [
        "vendida",
        "vendido",
        "ganada",
        "ganado",
        "perdida",
        "perdido",
        "presupuestada",
        "presupuestado",
        "en gestion",
        "en gestión",
        "sin atender"
      ]))
  ) {
    return "MOVER_PIPELINE";
  }

  if (includesAny(normalized, ACTION_SYNONYMS.resumen)) {
    return "RESUMIR_OPORTUNIDAD";
  }

  return "CONSULTA_GENERAL";
}

function removeKnownActionWords(message: string): string {
  let normalized = normalizeHumanText(message);

  const wordsToRemove = unique([
    ...Object.values(ACTION_SYNONYMS).flat(),
    ...Object.values(PIPELINE_SYNONYMS).flat(),
    ...Object.keys(PIPELINE_SYNONYMS),
    "a",
    "al",
    "la",
    "lo",
    "el",
    "de",
    "del",
    "para",
    "por",
    "favor",
    "porfa",
    "cliente",
    "pasajero",
    "oportunidad",
    "lead",
    "contacto",
    "nia",
    "cande"
  ]);

  for (const word of wordsToRemove.sort((a, b) => b.length - a.length)) {
    const cleanWord = normalizeHumanText(word);
    if (!cleanWord) continue;

    normalized = normalized
      .replace(new RegExp(`(^|\\s)${escapeRegExp(cleanWord)}(\\s|$)`, "g"), " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  return normalized;
}

/* =========================================================
   DB LOADERS
========================================================= */

async function loadNiaConfig(supabase: any) {
  const { data, error } = await supabase
    .from("nia_config")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadNiaFaqs(supabase: any) {
  const { data, error } = await supabase
    .from("nia_faqs")
    .select("id,pregunta,respuesta,orden")
    .order("orden", { ascending: true })
    .limit(80);

  if (error) return [];
  return data || [];
}

async function loadNiaKeywords(supabase: any) {
  const { data, error } = await supabase
    .from("nia_palabras_clave")
    .select("id,palabra,significado")
    .limit(120);

  if (error) return [];
  return data || [];
}

async function loadPipelineEstados(supabase: any) {
  const { data, error } = await supabase
    .from("pipeline_estados")
    .select("id,nombre,color,orden,es_final,resultado,es_sin_atender")
    .order("orden", { ascending: true });

  if (error) throw error;
  return data || [];
}

async function loadCandeCampos(supabase: any) {
  const { data, error } = await supabase
    .from("cande_campos")
    .select("*");

  if (error) return [];
  return data || [];
}

async function loadOpportunityById(supabase: any, id: string | null) {
  if (!id) return null;

  const { data, error } = await supabase
    .from("lead_oportunidades")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadOpportunityByConversationId(supabase: any, conversationId: string | null) {
  if (!conversationId) return null;

  const { data, error } = await supabase
    .from("lead_oportunidades")
    .select("*")
    .eq("conversacion_id", conversationId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function loadRecentOpportunities(supabase: any) {
  const { data, error } = await supabase
    .from("lead_oportunidades")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(300);

  if (error) throw error;
  return data || [];
}

async function loadProfiles(supabase: any) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id,nombre,apellido,display_name,email,rol,activo,visible_en_sistema,is_support_user,sucursal_id")
    .eq("activo", true)
    .order("nombre", { ascending: true });

  if (error) throw error;
  return data || [];
}

/* =========================================================
   OPORTUNIDAD HELPERS
========================================================= */

function mergedOpportunityData(opportunity: AnyRecord | null) {
  if (!opportunity) return {};

  return {
    ...(opportunity.datos || {}),
    ...(opportunity.manual_data || {})
  };
}

function getValueByLooseKey(data: AnyRecord, key: string) {
  const normalizedKey = normalizeHumanText(key);

  for (const [dataKey, value] of Object.entries(data || {})) {
    if (normalizeHumanText(dataKey) === normalizedKey) return value;
  }

  for (const [dataKey, value] of Object.entries(data || {})) {
    const cleanDataKey = normalizeHumanText(dataKey);
    if (cleanDataKey.includes(normalizedKey) || normalizedKey.includes(cleanDataKey)) {
      return value;
    }
  }

  return null;
}

function getOpportunityName(opportunity: AnyRecord | null) {
  if (!opportunity) return "la oportunidad";

  const data = mergedOpportunityData(opportunity);

  return (
    cleanText(opportunity.nombre_contacto) ||
    cleanText(data.nombre) ||
    cleanText(data.contacto_nombre) ||
    cleanText(data.pasajero) ||
    cleanText(data.nombre_pasajero) ||
    cleanText(data.cliente) ||
    cleanText(data.display_name) ||
    "la oportunidad"
  );
}

function getOpportunityPhone(opportunity: AnyRecord | null) {
  if (!opportunity) return "";

  const data = mergedOpportunityData(opportunity);

  return (
    cleanText(opportunity.telefono) ||
    cleanText(data.telefono) ||
    cleanText(data.wa_phone) ||
    cleanText(data.phone) ||
    cleanText(data.celular) ||
    cleanText(data.whatsapp) ||
    ""
  );
}

function getOpportunityEmail(opportunity: AnyRecord | null) {
  if (!opportunity) return "";

  const data = mergedOpportunityData(opportunity);

  return (
    cleanText(opportunity.email) ||
    cleanText(data.email) ||
    cleanText(data.mail) ||
    ""
  );
}

function getOpportunityDestino(opportunity: AnyRecord | null) {
  if (!opportunity) return "";

  const data = mergedOpportunityData(opportunity);

  return (
    cleanText(getValueByLooseKey(data, "destino")) ||
    cleanText(getValueByLooseKey(data, "lugar")) ||
    cleanText(getValueByLooseKey(data, "ciudad_destino")) ||
    ""
  );
}

function getOpportunityOrigen(opportunity: AnyRecord | null) {
  if (!opportunity) return "";

  const data = mergedOpportunityData(opportunity);

  return (
    cleanText(getValueByLooseKey(data, "origen")) ||
    cleanText(getValueByLooseKey(data, "origen_confirmado")) ||
    cleanText(getValueByLooseKey(data, "origen_sugerido")) ||
    ""
  );
}

function buildContextUpdate(opportunity: AnyRecord) {
  const data = mergedOpportunityData(opportunity);
  const name = getOpportunityName(opportunity);
  const phone = getOpportunityPhone(opportunity);

  return {
    source: "nia",
    module: "oportunidades",
    action: "context_update_from_nia",

    conversation_id: opportunity.conversacion_id || cleanText(data.conversation_id) || null,
    conversacion_id: opportunity.conversacion_id || cleanText(data.conversation_id) || null,

    oportunidad_id: opportunity.id,
    oportunidad_score: Number(opportunity.score || 0),
    oportunidad_estado_id: opportunity.estado_id || null,
    oportunidad_datos: opportunity.datos || null,

    wa_phone: phone || null,
    contacto_nombre: name,
    contacto: name,
    contacto_profile_name: name,

    cande_activa: Boolean(opportunity.cande_activa),
    cande_handoff_requested_at: opportunity.cande_handoff_requested_at || null,

    destino: getOpportunityDestino(opportunity) || null,
    origen: getOpportunityOrigen(opportunity) || null,

    created_at: getNowIso()
  };
}

function opportunitySearchHaystack(opportunity: AnyRecord) {
  const merged = mergedOpportunityData(opportunity);

  return normalizeHumanText(
    [
      opportunity.id,
      opportunity.nombre_contacto,
      opportunity.telefono,
      opportunity.email,
      opportunity.notas,
      opportunity.origen,
      opportunity.metodo_contacto,
      opportunity.canal_preferido,
      getOpportunityName(opportunity),
      getOpportunityPhone(opportunity),
      getOpportunityEmail(opportunity),
      getOpportunityDestino(opportunity),
      safeJsonText(opportunity.datos),
      safeJsonText(opportunity.manual_data),
      safeJsonText(merged)
    ].join(" ")
  );
}

function scoreOpportunityMatch(opportunity: AnyRecord, targetText: string, originalMessage: string) {
  const target = normalizeHumanText(targetText);
  const original = normalizeHumanText(originalMessage);
  const haystack = opportunitySearchHaystack(opportunity);

  if (!target && !original) return 0;

  let score = 0;

  const nombre = normalizeHumanText(getOpportunityName(opportunity));
  const telefono = normalizeHumanText(getOpportunityPhone(opportunity));
  const email = normalizeHumanText(getOpportunityEmail(opportunity));

  if (target && nombre && nombre === target) score += 140;
  if (target && nombre && nombre.includes(target)) score += 105;
  if (target && nombre && target.includes(nombre)) score += 90;

  if (target && telefono && target.includes(telefono)) score += 120;
  if (target && telefono && telefono.includes(target)) score += 95;

  if (target && email && email.includes(target)) score += 95;

  const tokens = unique(
    target
      .split(" ")
      .map((item) => item.trim())
      .filter((item) => item.length >= 3)
  );

  for (const token of tokens) {
    if (haystack.includes(token)) score += 18;
    if (nombre.includes(token)) score += 26;
  }

  const originalTokens = unique(
    original
      .split(" ")
      .map((item) => item.trim())
      .filter((item) => item.length >= 4)
  );

  for (const token of originalTokens) {
    if (haystack.includes(token)) score += 5;
  }

  const updatedAt = opportunity.updated_at || opportunity.created_at;
  if (updatedAt) {
    const ageHours = Math.max(0, Date.now() - new Date(updatedAt).getTime()) / 36e5;
    if (ageHours <= 24) score += 12;
    else if (ageHours <= 72) score += 8;
    else if (ageHours <= 168) score += 4;
  }

  return score;
}

async function resolveOpportunity(params: {
  supabase: any;
  payload: AnyRecord;
  message: string;
  intent: NiaIntent;
}): Promise<ResolveResult> {
  const { supabase, payload, message, intent } = params;

  const shouldIgnoreCurrentContext = intent === "CAMBIAR_CONTEXTO_OPORTUNIDAD";

  const oportunidadId = shouldIgnoreCurrentContext ? null : getOportunidadId(payload);
  const conversationId = shouldIgnoreCurrentContext ? null : getConversationId(payload);

  if (oportunidadId) {
    const opportunity = await loadOpportunityById(supabase, oportunidadId);

    if (opportunity) {
      return {
        status: "resolved",
        opportunity,
        matches: [opportunity],
        targetText: oportunidadId,
        resolvedBy: "oportunidad_id_context"
      };
    }
  }

  if (conversationId) {
    const opportunity = await loadOpportunityByConversationId(supabase, conversationId);

    if (opportunity) {
      return {
        status: "resolved",
        opportunity,
        matches: [opportunity],
        targetText: conversationId,
        resolvedBy: "conversation_id_context"
      };
    }
  }

  const targetText =
    cleanText(payload.target) ||
    cleanText(payload.search) ||
    cleanText(payload.nombre) ||
    cleanText(payload.contacto) ||
    cleanText(payload.context?.target) ||
    removeKnownActionWords(message);

  const recent = await loadRecentOpportunities(supabase);

  const scored = recent
    .map((opportunity: AnyRecord) => ({
      ...opportunity,
      __match_score: scoreOpportunityMatch(opportunity, targetText, message)
    }))
    .filter((opportunity: AnyRecord) => opportunity.__match_score > 0)
    .sort((a: AnyRecord, b: AnyRecord) => {
      if (b.__match_score !== a.__match_score) return b.__match_score - a.__match_score;
      return (
        new Date(b.updated_at || b.created_at || 0).getTime() -
        new Date(a.updated_at || a.created_at || 0).getTime()
      );
    });

  if (scored.length === 0) {
    return {
      status: "not_found",
      opportunity: null,
      matches: [],
      targetText,
      resolvedBy: "not_found"
    };
  }

  const first = scored[0];
  const second = scored[1];

  if (second && second.__match_score >= Math.max(35, first.__match_score - 12)) {
    return {
      status: "ambiguous",
      opportunity: null,
      matches: scored.slice(0, 5),
      targetText,
      resolvedBy: "ambiguous_text"
    };
  }

  return {
    status: "resolved",
    opportunity: first,
    matches: [first],
    targetText,
    resolvedBy: "text_search"
  };
}

/* =========================================================
   PIPELINE
========================================================= */

function matchPipelineEstado(estados: AnyRecord[], canonical: PipelineCanonical | null) {
  if (!canonical) return null;

  const synonyms = [canonical, ...(PIPELINE_SYNONYMS[canonical] || [])].map(normalizeHumanText);

  const preferredNames: Record<PipelineCanonical, string[]> = {
    GANADA: ["ganada"],
    PERDIDA: ["perdida"],
    PRESUPUESTADA: ["presupuestada"],
    EN_GESTION: ["en gestion", "en gestión"],
    SIN_ATENDER: ["sin atender"]
  };

  const preferred = (preferredNames[canonical] || []).map(normalizeHumanText);

  return (
    estados.find((estado) => preferred.includes(normalizeHumanText(estado.nombre))) ||
    estados.find((estado) => {
      const nombre = normalizeHumanText(estado.nombre);
      const resultado = normalizeHumanText(estado.resultado);

      return synonyms.some((word) => {
        return nombre === word || resultado === word;
      });
    }) ||
    estados.find((estado) => {
      const nombre = normalizeHumanText(estado.nombre);
      const resultado = normalizeHumanText(estado.resultado);

      return synonyms.some((word) => {
        return nombre.includes(word) || word.includes(nombre) || resultado.includes(word);
      });
    }) ||
    null
  );
}

async function movePipeline(params: {
  supabase: any;
  opportunity: AnyRecord;
  estados: AnyRecord[];
  message: string;
  userId: string | null;
}) {
  const canonical = detectPipelineCanonical(params.message);
  const estado = matchPipelineEstado(params.estados, canonical);

  if (!canonical || !estado) {
    return {
      ok: false,
      text:
        "Entendí que querés mover la oportunidad, pero no pude identificar el estado destino. Podés decir: ganada, perdida, presupuestada, en gestión o sin atender.",
      canonical,
      estado: null
    };
  }

  const previousEstadoId = params.opportunity.estado_id || null;

  const { error } = await params.supabase
    .from("lead_oportunidades")
    .update({
      estado_id: estado.id,
      updated_at: getNowIso(),
      manual_updated_at: getNowIso(),
      manual_updated_by: params.userId
    })
    .eq("id", params.opportunity.id);

  if (error) throw error;

  const nombre = getOpportunityName(params.opportunity);

  return {
    ok: true,
    text: `Listo. Moví ${nombre} a "${estado.nombre}".`,
    canonical,
    estado,
    previousEstadoId,
    context_update: buildContextUpdate({
      ...params.opportunity,
      estado_id: estado.id,
      updated_at: getNowIso()
    })
  };
}

/* =========================================================
   SCORE / RECALIFICACIÓN
========================================================= */

function getCampoNombre(campo: AnyRecord) {
  return (
    cleanText(campo.campo) ||
    cleanText(campo.key) ||
    cleanText(campo.nombre) ||
    cleanText(campo.slug) ||
    cleanText(campo.codigo)
  );
}

function getCampoPeso(campo: AnyRecord) {
  const value =
    campo.peso ??
    campo.score ??
    campo.puntos ??
    campo.valor ??
    campo.weight ??
    10;

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 10;
}

function hasUsefulValue(value: unknown) {
  if (value === null || value === undefined) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as AnyRecord).length > 0;
  return true;
}

function calculateScore(opportunity: AnyRecord, campos: AnyRecord[]) {
  const data = mergedOpportunityData(opportunity);

  const activeCampos = (campos || []).filter((campo) => {
    if ("activo" in campo) return campo.activo !== false;
    if ("enabled" in campo) return campo.enabled !== false;
    return true;
  });

  if (activeCampos.length > 0) {
    let totalWeight = 0;
    let achieved = 0;
    const missing: string[] = [];
    const present: string[] = [];

    for (const campo of activeCampos) {
      const campoNombre = getCampoNombre(campo);
      const peso = getCampoPeso(campo);

      if (!campoNombre) continue;

      totalWeight += peso;

      const value = getValueByLooseKey(data, campoNombre);

      if (hasUsefulValue(value)) {
        achieved += peso;
        present.push(campoNombre);
      } else {
        missing.push(campoNombre);
      }
    }

    const score = totalWeight > 0
      ? Math.round((achieved / totalWeight) * 100)
      : Number(opportunity.score || 0);

    return {
      score: Math.max(0, Math.min(100, score)),
      missing,
      present,
      mode: "cande_campos"
    };
  }

  const fallbackChecks = [
    ["destino", ["destino", "viaje", "lugar"]],
    ["fecha", ["fecha", "salida", "desde", "regreso"]],
    ["pasajeros", ["pax", "pasajeros", "adultos", "menores"]],
    ["presupuesto", ["presupuesto", "budget", "monto"]],
    ["origen", ["origen", "salida", "ciudad"]],
    ["telefono", ["telefono", "teléfono", "whatsapp"]]
  ];

  const missing: string[] = [];
  let achieved = 0;

  for (const [label, keys] of fallbackChecks) {
    const found =
      keys.some((key) => hasUsefulValue(getValueByLooseKey(data, key))) ||
      hasUsefulValue((opportunity as AnyRecord)[label]);

    if (found) achieved += 1;
    else missing.push(label);
  }

  return {
    score: Math.round((achieved / fallbackChecks.length) * 100),
    missing,
    present: [],
    mode: "fallback"
  };
}

async function recalificarOpportunity(params: {
  supabase: any;
  opportunity: AnyRecord;
  campos: AnyRecord[];
  userId: string | null;
}) {
  const previousScore = Number(params.opportunity.score || 0);
  const result = calculateScore(params.opportunity, params.campos);

  const { error } = await params.supabase
    .from("lead_oportunidades")
    .update({
      score: result.score,
      last_score_at: getNowIso(),
      updated_at: getNowIso(),
      manual_updated_at: getNowIso(),
      manual_updated_by: params.userId
    })
    .eq("id", params.opportunity.id);

  if (error) throw error;

  const nombre = getOpportunityName(params.opportunity);

  const faltantesText =
    result.missing.length > 0
      ? ` Faltan datos: ${result.missing.slice(0, 8).join(", ")}.`
      : " No detecto datos críticos faltantes.";

  return {
    ok: true,
    previousScore,
    newScore: result.score,
    missing: result.missing,
    text: `Listo. Recalifiqué ${nombre}: score ${previousScore} → ${result.score}.${faltantesText}`,
    context_update: buildContextUpdate({
      ...params.opportunity,
      score: result.score,
      updated_at: getNowIso()
    })
  };
}

/* =========================================================
   ACTUALIZAR DATOS DE OPORTUNIDAD
========================================================= */

function normalizeAiIntent(value: unknown): NiaIntent | null {
  const intent = cleanText(value).toUpperCase();

  const allowed: NiaIntent[] = [
    "CAMBIAR_CONTEXTO_OPORTUNIDAD",
    "MOVER_PIPELINE",
    "RECALIFICAR_OPORTUNIDAD",
    "RESUMIR_OPORTUNIDAD",
    "ACTUALIZAR_DATO_OPORTUNIDAD",
    "ACTIVAR_CANDE",
    "DESACTIVAR_CANDE",
    "REPORTE_DIARIO_VENDEDORES",
    "CONSULTA_GENERAL"
  ];

  return allowed.includes(intent as NiaIntent) ? (intent as NiaIntent) : null;
}

function normalizeOpportunityField(field: unknown): string | null {
  const normalized = normalizeHumanText(field);

  const map: Record<string, string[]> = {
    destino: ["destino", "lugar", "ciudad destino", "pais destino", "país destino", "viaje"],
    origen: ["origen", "salida", "ciudad origen", "desde", "salida desde"],
    fechas_tentativas: [
      "fecha",
      "fechas",
      "fecha aproximada",
      "fechas tentativas",
      "salida",
      "regreso",
      "cuando",
      "cuándo"
    ],
    cantidad_pasajeros: [
      "pasajeros",
      "pax",
      "cantidad pasajeros",
      "cantidad de pasajeros",
      "personas",
      "cantidad personas"
    ],
    presupuesto_aproximado: [
      "presupuesto",
      "budget",
      "monto",
      "monto estimado",
      "presupuesto aproximado"
    ],
    tipo_viaje: ["tipo", "tipo viaje", "tipo de viaje", "categoria", "categoría", "motivo"],
    origen_confirmado: ["origen confirmado", "confirmar origen"],
    origen_sugerido: ["origen sugerido", "sugerido origen"]
  };

  for (const [key, aliases] of Object.entries(map)) {
    if (normalizeHumanText(key) === normalized) return key;

    if (aliases.some((alias) => normalizeHumanText(alias) === normalized)) {
      return key;
    }

    if (aliases.some((alias) => normalized.includes(normalizeHumanText(alias)))) {
      return key;
    }
  }

  return null;
}

function extractDatoUpdateFallback(message: string): { field: string; value: string } | null {
  const raw = cleanText(message);

  const fieldPatterns = [
    {
      field: "destino",
      patterns: [
        /destino\s+(?:a|por|es|sea|seria|sería)\s+(.+)$/i,
        /(?:cambiar|cambia|cambiá|cambiale|modificar|actualizar|poner|poné|pone).*destino.*(?:a|por|es|sea|seria|sería)\s+(.+)$/i
      ]
    },
    {
      field: "origen",
      patterns: [
        /origen\s+(?:a|por|es|sea|seria|sería)\s+(.+)$/i,
        /(?:cambiar|cambia|cambiá|cambiale|modificar|actualizar|poner|poné|pone).*origen.*(?:a|por|es|sea|seria|sería)\s+(.+)$/i
      ]
    },
    {
      field: "fechas_tentativas",
      patterns: [
        /fecha(?:s)?\s+(?:a|por|es|son|sea|seria|sería)\s+(.+)$/i,
        /(?:cambiar|cambia|cambiá|cambiale|modificar|actualizar|poner|poné|pone).*fecha(?:s)?.*(?:a|por|es|son|sea|seria|sería)\s+(.+)$/i
      ]
    },
    {
      field: "cantidad_pasajeros",
      patterns: [
        /(?:pasajeros|pax|personas)\s+(?:a|son|es|sean)\s+(.+)$/i,
        /(?:cambiar|cambia|cambiá|cambiale|modificar|actualizar|poner|poné|pone).*(?:pasajeros|pax|personas).*(?:a|son|es|sean)\s+(.+)$/i
      ]
    },
    {
      field: "presupuesto_aproximado",
      patterns: [
        /presupuesto\s+(?:a|es|sea|seria|sería)\s+(.+)$/i,
        /(?:cambiar|cambia|cambiá|cambiale|modificar|actualizar|poner|poné|pone).*presupuesto.*(?:a|es|sea|seria|sería)\s+(.+)$/i
      ]
    },
    {
      field: "tipo_viaje",
      patterns: [
        /tipo(?: de viaje)?\s+(?:a|es|sea|seria|sería)\s+(.+)$/i,
        /(?:cambiar|cambia|cambiá|cambiale|modificar|actualizar|poner|poné|pone).*tipo(?: de viaje)?.*(?:a|es|sea|seria|sería)\s+(.+)$/i
      ]
    }
  ];

  if (!detectDatoUpdateIntent(raw)) return null;

  for (const item of fieldPatterns) {
    for (const pattern of item.patterns) {
      const match = raw.match(pattern);
      const value = cleanText(match?.[1])
        .replace(/[.。]+$/g, "")
        .replace(/\s+por favor$/i, "")
        .trim();

      if (value) {
        return {
          field: item.field,
          value
        };
      }
    }
  }

  return null;
}

function coerceOpportunityValue(field: string, value: any) {
  if (field === "origen_confirmado") {
    const normalized = normalizeHumanText(value);
    if (["si", "sí", "true", "confirmado", "confirmada"].includes(normalized)) return true;
    if (["no", "false", "sin confirmar"].includes(normalized)) return false;
  }

  return typeof value === "string" ? value.trim() : value;
}

async function updateOpportunityDato(params: {
  supabase: any;
  opportunity: AnyRecord;
  field: string | null;
  value: any;
  userId: string | null;
}) {
  const normalizedField = normalizeOpportunityField(params.field);

  if (!normalizedField) {
    return {
      ok: false,
      text:
        "Entendí que querés modificar un dato de la oportunidad, pero no pude identificar qué campo cambiar. Podés decir: destino, origen, fechas, pasajeros o presupuesto."
    };
  }

  const cleanValue = coerceOpportunityValue(normalizedField, params.value);

  if (cleanValue === null || cleanValue === undefined || cleanText(cleanValue) === "") {
    return {
      ok: false,
      text: `Entendí que querés modificar "${normalizedField}", pero no detecté el nuevo valor.`
    };
  }

  const previousDatos =
    params.opportunity.datos && typeof params.opportunity.datos === "object"
      ? params.opportunity.datos
      : {};

  const nextDatos = {
    ...previousDatos,
    [normalizedField]: cleanValue
  };

  const { error } = await params.supabase
    .from("lead_oportunidades")
    .update({
      datos: nextDatos,
      updated_at: getNowIso(),
      manual_updated_at: getNowIso(),
      manual_updated_by: params.userId
    })
    .eq("id", params.opportunity.id);

  if (error) throw error;

  const nombre = getOpportunityName(params.opportunity);
  const label = normalizedField.replaceAll("_", " ");

  const updatedOpportunity = {
    ...params.opportunity,
    datos: nextDatos,
    updated_at: getNowIso()
  };

  return {
    ok: true,
    text: `Listo. Actualicé ${label} de ${nombre} a "${cleanValue}".`,
    field: normalizedField,
    value: cleanValue,
    previous_value: previousDatos[normalizedField] ?? null,
    context_update: buildContextUpdate(updatedOpportunity)
  };
}

/* =========================================================
   CANDE
========================================================= */

async function setCandeStatus(params: {
  supabase: any;
  opportunity: AnyRecord;
  enabled: boolean;
  userId: string | null;
}) {
  const { error } = await params.supabase
    .from("lead_oportunidades")
    .update({
      cande_activa: params.enabled,
      updated_at: getNowIso(),
      manual_updated_at: getNowIso(),
      manual_updated_by: params.userId
    })
    .eq("id", params.opportunity.id);

  if (error) throw error;

  const nombre = getOpportunityName(params.opportunity);

  return {
    ok: true,
    text: params.enabled
      ? `Listo. Activé CANDE para ${nombre}.`
      : `Listo. Desactivé CANDE para ${nombre}.`,
    context_update: buildContextUpdate({
      ...params.opportunity,
      cande_activa: params.enabled,
      updated_at: getNowIso()
    })
  };
}

/* =========================================================
   RESÚMENES
========================================================= */

function getScoreTemperature(score: number) {
  if (score >= 75) return "caliente";
  if (score >= 45) return "tibia";
  return "fría / incompleta";
}

function cleanDisplayValue(value: unknown, fallback = "—") {
  const text = cleanText(value);
  return text || fallback;
}

function summarizeOpportunity(opportunity: AnyRecord) {
  const data = mergedOpportunityData(opportunity);

  const nombre = getOpportunityName(opportunity);
  const telefono = getOpportunityPhone(opportunity);
  const email = getOpportunityEmail(opportunity);

  const destino =
    cleanText(getValueByLooseKey(data, "destino")) ||
    cleanText(getValueByLooseKey(data, "lugar")) ||
    cleanText(getValueByLooseKey(data, "ciudad_destino"));

  const origenConfirmado =
    cleanText(getValueByLooseKey(data, "origen")) ||
    cleanText(getValueByLooseKey(data, "origen_confirmado"));

  const origenSugerido =
    cleanText(getValueByLooseKey(data, "origen_sugerido")) ||
    cleanText(getValueByLooseKey(data, "origen_sugerido_provincia"));

  const aeropuertoSugerido =
    cleanText(getValueByLooseKey(data, "origen_sugerido_aeropuerto")) ||
    cleanText(getValueByLooseKey(data, "origen_sugerido_aeropuerto_nombre"));

  const fechas =
    cleanText(getValueByLooseKey(data, "fechas_tentativas")) ||
    cleanText(getValueByLooseKey(data, "fecha_tentativa")) ||
    cleanText(getValueByLooseKey(data, "fechas")) ||
    cleanText(getValueByLooseKey(data, "fecha")) ||
    cleanText(getValueByLooseKey(data, "salida"));

  const pasajeros =
    cleanText(getValueByLooseKey(data, "cantidad_pasajeros")) ||
    cleanText(getValueByLooseKey(data, "pasajeros")) ||
    cleanText(getValueByLooseKey(data, "pax"));

  const presupuesto =
    cleanText(getValueByLooseKey(data, "presupuesto_aproximado")) ||
    cleanText(getValueByLooseKey(data, "presupuesto")) ||
    cleanText(getValueByLooseKey(data, "budget"));

  const tipoViaje =
    cleanText(getValueByLooseKey(data, "tipo_viaje")) ||
    cleanText(getValueByLooseKey(data, "tipo de viaje")) ||
    cleanText(getValueByLooseKey(data, "motivo"));

  const ultimoMensaje =
    cleanText(getValueByLooseKey(data, "ultimo_mensaje")) ||
    cleanText(opportunity.ultimo_mensaje) ||
    cleanText(opportunity.last_message_preview);

  const score = Number(opportunity.score || 0);
  const temperatura = getScoreTemperature(score);
  const cande = opportunity.cande_activa ? "activa" : "pausada";

  const faltantes: string[] = [];

  if (!destino) faltantes.push("Destino");
  if (!origenConfirmado) faltantes.push("Confirmar origen / ciudad de salida");
  if (!fechas) faltantes.push("Fechas tentativas");
  if (!pasajeros) faltantes.push("Cantidad de pasajeros");
  if (!presupuesto) faltantes.push("Presupuesto aproximado");
  if (!tipoViaje) faltantes.push("Tipo de viaje");

  const origenText = origenConfirmado
    ? origenConfirmado
    : origenSugerido
      ? `${origenSugerido}${aeropuertoSugerido ? ` (${aeropuertoSugerido})` : ""} · sugerido, falta confirmar`
      : "sin confirmar";

  const lecturaComercial =
    score >= 75
      ? "La oportunidad tiene buena calidad comercial. Conviene avanzar rápido con propuesta o seguimiento directo."
      : score >= 45
        ? "La oportunidad tiene interés, pero todavía necesita completar algunos datos antes de cotizar con precisión."
        : "La oportunidad está incompleta. Antes de presupuestar conviene confirmar los datos básicos para evitar una cotización débil.";

  const proximaAccion =
    faltantes.length > 0
      ? `Confirmar: ${faltantes.slice(0, 4).join(", ")}.`
      : "Avanzar con presupuesto o propuesta comercial según disponibilidad.";

  return [
    "**Contexto de la oportunidad**",
    "",
    `**Pasajero:** ${cleanDisplayValue(nombre)}`,
    telefono ? `**WhatsApp:** ${telefono}` : null,
    email ? `**Email:** ${email}` : null,
    `**Destino:** ${cleanDisplayValue(destino, "sin definir")}`,
    `**Origen:** ${origenText}`,
    `**Fechas:** ${cleanDisplayValue(fechas, "sin definir")}`,
    `**Pasajeros:** ${cleanDisplayValue(pasajeros, "sin definir")}`,
    `**Presupuesto:** ${cleanDisplayValue(presupuesto, "sin definir")}`,
    tipoViaje ? `**Tipo de viaje:** ${tipoViaje}` : null,
    `**Score:** ${score} · ${temperatura}`,
    `**CANDE:** ${cande}`,
    ultimoMensaje ? `**Último mensaje:** “${ultimoMensaje}”` : null,
    "",
    "**Faltantes**",
    faltantes.length > 0
      ? faltantes.map((item) => `- ${item}`).join("\n")
      : "- No detecto datos comerciales críticos faltantes.",
    "",
    "**Lectura comercial**",
    lecturaComercial,
    "",
    "**Próxima acción sugerida**",
    proximaAccion
  ]
    .filter(Boolean)
    .join("\n");
}

/* =========================================================
   CAMBIO DE CONTEXTO
========================================================= */

function changeContextText(opportunity: AnyRecord) {
  const name = getOpportunityName(opportunity);
  const phone = getOpportunityPhone(opportunity);
  const destino = getOpportunityDestino(opportunity);
  const score = Number(opportunity.score || 0);

  return [
    `Listo. Cambié el contexto a ${name}.`,
    phone ? `WhatsApp: ${phone}` : null,
    destino ? `Destino: ${destino}` : null,
    `Score: ${score}`,
    opportunity.cande_activa ? "CANDE: activa" : "CANDE: pausada"
  ]
    .filter(Boolean)
    .join("\n");
}

/* =========================================================
   OPENAI
========================================================= */

async function interpretWithOpenAI(params: {
  config: AnyRecord | null;
  faqs: AnyRecord[];
  keywords: AnyRecord[];
  message: string;
  payload: AnyRecord;
  opportunity: AnyRecord | null;
  estados: AnyRecord[];
}) {
  const apiKey =
    Deno.env.get("NOSTUR_OPENAI_API_KEY") ||
    Deno.env.get("OPENAI_API_KEY");

if (!apiKey) {
  return {
    intent: "CONSULTA_GENERAL",
    answer: "No encontré OPENAI_API_KEY ni NOSTUR_OPENAI_API_KEY dentro de la Edge Function.",
    confidence: 0
  } as AiInterpretation;
}
  const config = params.config || {};
  const model = cleanText(config.modelo) || "gpt-4o-mini";

  const currentOpportunity = params.opportunity
    ? {
        id: params.opportunity.id,
        nombre: getOpportunityName(params.opportunity),
        telefono: getOpportunityPhone(params.opportunity),
        email: getOpportunityEmail(params.opportunity),
        destino: getOpportunityDestino(params.opportunity),
        origen: getOpportunityOrigen(params.opportunity),
        score: params.opportunity.score,
        estado_id: params.opportunity.estado_id,
        cande_activa: params.opportunity.cande_activa,
        datos: mergedOpportunityData(params.opportunity)
      }
    : null;

  const systemPrompt = [
    cleanText(config.prompt_base) ||
      "Sos NIA, asistente comercial interno de NOSTUR. Interpretás pedidos humanos y devolvés una acción estructurada.",
    "",
    "Tono:",
    cleanText(config.tono) || "claro, profesional, directo, comercial y operativo",
    "",
    "Reglas duras:",
    cleanText(config.reglas_duras) ||
      "No inventes datos. No envíes mensajes al pasajero. No modifiques datos sensibles sin claridad.",
    "",
    "Tu tarea principal es interpretar el pedido del usuario y devolver JSON válido.",
    "",
    "Tu tarea principal es interpretar el pedido del usuario y devolver JSON válido.",
"Si el usuario hace una pregunta general, comercial, operativa o turística, devolvé intent CONSULTA_GENERAL y completá answer con una respuesta útil.",
"Para consultas generales NO devuelvas answer vacío.",
"Usá el contexto de la oportunidad actual si existe: destino, origen, fechas, pasajeros, presupuesto, score y datos detectados.",
"Si falta un dato clave, pedilo de forma natural, sin pedir IDs técnicos.",
"Si pregunta qué fecha recomendar para un destino, respondé como asesor comercial: temporada, clima, precios, demanda y conveniencia para vender.",
    "Intenciones posibles:",
    "- CAMBIAR_CONTEXTO_OPORTUNIDAD",
    "- MOVER_PIPELINE",
    "- RECALIFICAR_OPORTUNIDAD",
    "- RESUMIR_OPORTUNIDAD",
    "- ACTUALIZAR_DATO_OPORTUNIDAD",
    "- ACTIVAR_CANDE",
    "- DESACTIVAR_CANDE",
    "- REPORTE_DIARIO_VENDEDORES",
    "- CONSULTA_GENERAL",
    "",
    "Campos modificables de oportunidad:",
    "- destino",
    "- origen",
    "- fechas_tentativas",
    "- cantidad_pasajeros",
    "- presupuesto_aproximado",
    "- tipo_viaje",
    "- origen_confirmado",
    "- origen_sugerido",
    "",
    "Si el usuario dice 'cambiale el destino a Miami', devolvé intent ACTUALIZAR_DATO_OPORTUNIDAD, field destino, value Miami.",
    "Si el usuario dice 'poné 4 pasajeros', devolvé field cantidad_pasajeros, value 4.",
    "Si el usuario dice 'cambiá fecha a enero', devolvé field fechas_tentativas, value enero.",
    "Si el usuario está parado en una oportunidad, usá esa oportunidad aunque no nombre al pasajero.",
    "Si el pedido es ambiguo o riesgoso, devolvé needs_confirmation true.",
    "",
    "FAQs internas disponibles:",
    JSON.stringify(params.faqs || []),
    "",
    "Keywords internas disponibles:",
    JSON.stringify(params.keywords || []),
    "",
    "Respondé solamente JSON con esta forma:",
    JSON.stringify({
      intent: "ACTUALIZAR_DATO_OPORTUNIDAD",
      targetText: "",
      field: "destino",
      value: "Miami",
      needs_confirmation: false,
      answer: "",
      confidence: 0.9
    })
  ].join("\n");

  const userContent = {
    message: params.message,
    source: params.payload.source || params.payload.context?.source || null,
    module: params.payload.module || params.payload.context?.module || null,
    current_context: params.payload.context || {},
    current_opportunity: currentOpportunity,
    pipeline_estados: params.estados.map((estado) => ({
      id: estado.id,
      nombre: estado.nombre,
      resultado: estado.resultado,
      es_final: estado.es_final
    }))
  };

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: JSON.stringify(userContent)
        }
      ]
    })
  });

if (!response.ok) {
  const text = await response.text();

  console.error("[NIA OpenAI] Error:", response.status, text);

  return {
    intent: "CONSULTA_GENERAL",
    answer: `OpenAI respondió con error ${response.status}: ${text.slice(0, 500)}`,
    confidence: 0
  } as AiInterpretation;
}

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as AiInterpretation;
    const intent = normalizeAiIntent(parsed.intent);

    return {
      ...parsed,
      intent: intent || undefined
    };
} catch (err) {
  console.error("[NIA OpenAI] JSON inválido:", content, err);

  return {
    intent: "CONSULTA_GENERAL",
    answer: `OpenAI respondió, pero NIA no pudo interpretar el JSON. Respuesta recibida: ${String(content).slice(0, 500)}`,
    confidence: 0
  } as AiInterpretation;
}
}

/* =========================================================
   REPORTES NIA
========================================================= */

function isSellerProfile(profile: AnyRecord) {
  if (!profile.activo) return false;
  if (profile.is_support_user) return false;
  if (profile.visible_en_sistema === false) return false;

  const rol = normalizeHumanText(profile.rol);
  return (
    rol.includes("vendedor") ||
    rol.includes("ventas") ||
    rol.includes("gerente") ||
    rol.includes("admin") ||
    rol.includes("administrador")
  );
}

function getProfileDisplayName(profile: AnyRecord) {
  return (
    cleanText(profile.display_name) ||
    cleanText(`${profile.nombre || ""} ${profile.apellido || ""}`) ||
    cleanText(profile.email) ||
    "Usuario"
  );
}

async function getOrCreateNiaConversationForProfile(supabase: any, profileId: string) {
  const { data: existing, error: existingError } = await supabase
    .from("nia_conversaciones")
    .select("*")
    .eq("profile_id", profileId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) throw existingError;
  if (existing) return existing;

  const { data, error } = await supabase
    .from("nia_conversaciones")
    .insert({
      profile_id: profileId,
      unread_count: 1,
      last_message_at: getNowIso(),
      last_message_preview: "Reporte diario de NIA",
      created_at: getNowIso(),
      updated_at: getNowIso()
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

async function createNiaMessage(params: {
  supabase: any;
  profileId: string;
  text: string;
  metadata?: AnyRecord;
}) {
  const conversation = await getOrCreateNiaConversationForProfile(params.supabase, params.profileId);

  const { error: messageError } = await params.supabase
    .from("nia_mensajes")
    .insert({
      conversacion_id: conversation.id,
      direction: "assistant",
      text: params.text,
      metadata: params.metadata || {},
      created_at: getNowIso()
    });

  if (messageError) throw messageError;

  const { error: updateError } = await params.supabase
    .from("nia_conversaciones")
    .update({
      unread_count: Number(conversation.unread_count || 0) + 1,
      last_message_at: getNowIso(),
      last_message_preview: params.text.slice(0, 240),
      updated_at: getNowIso()
    })
    .eq("id", conversation.id);

  if (updateError) throw updateError;

  return conversation;
}

async function generateDailyReports(params: {
  supabase: any;
  estados: AnyRecord[];
}) {
  const profiles = (await loadProfiles(params.supabase)).filter(isSellerProfile);

  const { data: opportunities, error } = await params.supabase
    .from("lead_oportunidades")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(500);

  if (error) throw error;

  const finalEstadoIds = new Set(
    params.estados
      .filter((estado) => estado.es_final)
      .map((estado) => estado.id)
  );

  const sent: AnyRecord[] = [];

  for (const profile of profiles) {
    const mine = (opportunities || []).filter((opportunity: AnyRecord) => {
      if (opportunity.assigned_to !== profile.id) return false;
      if (opportunity.estado_id && finalEstadoIds.has(opportunity.estado_id)) return false;
      return true;
    });

    const hot = mine.filter((opportunity: AnyRecord) => Number(opportunity.score || 0) >= 70);
    const medium = mine.filter((opportunity: AnyRecord) => {
      const score = Number(opportunity.score || 0);
      return score >= 40 && score < 70;
    });
    const cold = mine.filter((opportunity: AnyRecord) => Number(opportunity.score || 0) < 40);

    const topLines = mine.slice(0, 8).map((opportunity: AnyRecord, index: number) => {
      const name = getOpportunityName(opportunity);
      const score = Number(opportunity.score || 0);
      const destino = getOpportunityDestino(opportunity) || "sin destino";

      return `${index + 1}. ${name} · ${destino} · score ${score}`;
    });

    const text = [
      `NIA · Reporte diario para ${getProfileDisplayName(profile)}`,
      "",
      `Oportunidades abiertas asignadas: ${mine.length}`,
      `Calientes: ${hot.length}`,
      `Medias: ${medium.length}`,
      `Frías/incompletas: ${cold.length}`,
      "",
      mine.length > 0 ? "Prioridad sugerida:" : "No tenés oportunidades abiertas asignadas para revisar.",
      ...topLines,
      "",
      "Sugerencia NIA: priorizá las oportunidades calientes y completá datos faltantes en las incompletas."
    ].join("\n");

    const conversation = await createNiaMessage({
      supabase: params.supabase,
      profileId: profile.id,
      text,
      metadata: {
        type: "daily_report",
        code_version: CODE_VERSION,
        opportunity_count: mine.length,
        hot_count: hot.length,
        medium_count: medium.length,
        cold_count: cold.length
      }
    });

    sent.push({
      profile_id: profile.id,
      profile_name: getProfileDisplayName(profile),
      conversation_id: conversation.id,
      opportunity_count: mine.length
    });
  }

  return {
    ok: true,
    sent,
    text: `Listo. Generé y envié ${sent.length} reportes diarios de NIA a vendedores/usuarios activos.`
  };
}

/* =========================================================
   LOG NIA
========================================================= */

async function insertNiaInteraction(params: {
  supabase: any;
  userId: string | null;
  source: string;
  module: string;
  action: NiaIntent;
  conversationId: string | null;
  oportunidadId: string | null;
  userMessage: string;
  assistantResponse: string;
  context?: AnyRecord;
  metadata?: AnyRecord;
  tool?: string;
  usedOpenai?: boolean;
  success?: boolean;
  error?: string | null;
}) {
  try {
    await params.supabase
      .from("nia_interacciones")
      .insert({
        user_id: params.userId,
        source: params.source,
        module: params.module,
        action: params.action,
        conversation_id: params.conversationId,
        oportunidad_id: params.oportunidadId,
        user_message: params.userMessage,
        assistant_response: params.assistantResponse,
        context: params.context || {},
        metadata: {
          ...(params.metadata || {}),
          code_version: CODE_VERSION
        },
        tool: params.tool || null,
        used_openai: Boolean(params.usedOpenai),
        success: params.success !== false,
        error: params.error || null,
        created_at: getNowIso()
      });
  } catch (err) {
    console.error("[NIA] No se pudo insertar nia_interacciones:", err);
  }
}

/* =========================================================
   RESPUESTAS HUMANAS
========================================================= */

function formatAmbiguous(matches: AnyRecord[], targetText: string) {
  const lines = matches.slice(0, 5).map((opportunity, index) => {
    const name = getOpportunityName(opportunity);
    const phone = getOpportunityPhone(opportunity);
    const score = Number(opportunity.score || 0);
    const destino = getOpportunityDestino(opportunity) || "sin destino";

    return `${index + 1}. ${name}${phone ? ` · ${phone}` : ""} · ${destino} · score ${score}`;
  });

  return [
    `Encontré más de una oportunidad posible para "${targetText || "ese pedido"}".`,
    "Decime cuál querés usar:",
    "",
    ...lines
  ].join("\n");
}

function notFoundText(targetText: string) {
  if (targetText) {
    return `No encontré una oportunidad con "${targetText}". Pasame nombre completo, teléfono o email del pasajero.`;
  }

  return "No encontré la oportunidad. Pasame nombre, teléfono o email del pasajero.";
}

function generalHelpText() {
  return [
    "Soy NIA. Puedo ayudarte con acciones comerciales internas.",
    "",
    "Ejemplos:",
    "• Cambiá a Jorge Luis Batica",
    "• Recalificá a Jorge Luis Batica",
    "• Pasá a Natalia a presupuestada",
    "• Marcá a Carlos como vendido",
    "• Activá CANDE para Mariana",
    "• Cambiale el destino a Miami",
    "• Cambiá pasajeros a 4",
    "• Resumime la oportunidad de Laura",
    "• Mandá el reporte diario a vendedores"
  ].join("\n");
}

/* =========================================================
   SERVE
========================================================= */

serve(async (req) => {
  let payload: AnyRecord = {};
  let supabase: any = null;

  if (req.method === "OPTIONS") return jsonResponse({ ok: true });

  if (req.method !== "POST") {
    return jsonResponse({
      ok: false,
      error: "Method not allowed",
      code_version: CODE_VERSION
    });
  }

  try {
    payload = await req.json();
    supabase = getSupabaseAdmin();

    const message = getMessage(payload);
    const userId = getUserId(payload);
    const source = getSource(payload);
    const module = getModule(payload);
    const conversationId = getConversationId(payload);
    const oportunidadId = getOportunidadId(payload);

    if (!message) {
      const text = "No recibí mensaje para interpretar. Escribime qué querés que haga NIA.";

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: "CONSULTA_GENERAL",
        conversationId,
        oportunidadId,
        userMessage: "",
        assistantResponse: text,
        success: false,
        error: "missing_message"
      });

      return jsonResponse({
        ok: false,
        text,
        response: text,
        reason: "missing_message",
        code_version: CODE_VERSION
      });
    }

    let intent = detectIntent(message);

    const [config, estados, campos, faqs, keywords] = await Promise.all([
      loadNiaConfig(supabase),
      loadPipelineEstados(supabase),
      loadCandeCampos(supabase),
      loadNiaFaqs(supabase),
      loadNiaKeywords(supabase)
    ]);

    if (config && config.enabled === false) {
      const text = "NIA está apagada desde configuración.";

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: intent,
        conversationId,
        oportunidadId,
        userMessage: message,
        assistantResponse: text,
        success: false,
        error: "nia_disabled"
      });

      return jsonResponse({
        ok: false,
        text,
        response: text,
        reason: "nia_disabled",
        code_version: CODE_VERSION
      });
    }

    let contextOpportunity: AnyRecord | null = null;

    if (oportunidadId) {
      contextOpportunity = await loadOpportunityById(supabase, oportunidadId);
    } else if (conversationId) {
      contextOpportunity = await loadOpportunityByConversationId(supabase, conversationId);
    }

    const fallbackDatoUpdate = extractDatoUpdateFallback(message);

    const aiInterpretation = await interpretWithOpenAI({
      config,
      faqs,
      keywords,
      message,
      payload,
      opportunity: contextOpportunity,
      estados
    });

    const usedOpenai = Boolean(aiInterpretation);

    if (aiInterpretation?.intent) {
      intent = aiInterpretation.intent;
    } else if (fallbackDatoUpdate) {
      intent = "ACTUALIZAR_DATO_OPORTUNIDAD";
    }

    if (aiInterpretation?.needs_confirmation) {
      const text =
        cleanText(aiInterpretation.answer) ||
        "Antes de hacerlo necesito confirmación. Decime exactamente si querés que avance con esa acción.";

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: intent,
        conversationId,
        oportunidadId,
        userMessage: message,
        assistantResponse: text,
        context: {
          ai_interpretation: aiInterpretation
        },
        usedOpenai,
        success: false,
        error: "needs_confirmation"
      });

      return jsonResponse({
        ok: false,
        needs_confirmation: true,
        text,
        response: text,
        action: intent,
        used_openai: usedOpenai,
        ai_interpretation: aiInterpretation,
        code_version: CODE_VERSION
      });
    }

    if (intent === "REPORTE_DIARIO_VENDEDORES") {
      const result = await generateDailyReports({
        supabase,
        estados
      });

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: intent,
        conversationId,
        oportunidadId,
        userMessage: message,
        assistantResponse: result.text,
        context: {
          sent: result.sent
        },
        metadata: {
          ai_interpretation: aiInterpretation
        },
        tool: "generate_daily_reports",
        usedOpenai,
        success: true
      });

      return jsonResponse({
        ok: true,
        text: result.text,
        response: result.text,
        action: intent,
        sent: result.sent,
        used_openai: usedOpenai,
        ai_interpretation: aiInterpretation,
        code_version: CODE_VERSION
      });
    }

    if (intent === "CONSULTA_GENERAL") {
      let text = cleanText(aiInterpretation?.answer);

      if (!text && usedOpenai) {
        const currentDestino = contextOpportunity ? getOpportunityDestino(contextOpportunity) : "";

        if (currentDestino) {
          text = `Para ${currentDestino}, puedo ayudarte a pensar una recomendación comercial, pero necesito un poco más de contexto: fecha aproximada deseada, cantidad de pasajeros, presupuesto y flexibilidad del pasajero. Con eso puedo sugerirte la mejor ventana para venderlo.`;
        } else {
          text =
            "Puedo ayudarte con eso, pero necesito saber el destino o tener una oportunidad seleccionada con destino cargado. Decime el destino y te sugiero una fecha conveniente según clima, demanda y oportunidad comercial.";
        }
      }

      if (!text) {
        text =
          "No pude usar la IA en este momento. Revisá los logs de nia-chat para confirmar si OpenAI respondió correctamente.";
      }

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: intent,
        conversationId,
        oportunidadId,
        userMessage: message,
        assistantResponse: text,
        metadata: {
          ai_interpretation: aiInterpretation
        },
        usedOpenai,
        success: true
      });

      return jsonResponse({
        ok: true,
        text,
        response: text,
        action: intent,
        used_openai: usedOpenai,
        ai_interpretation: aiInterpretation,
        code_version: CODE_VERSION
      });
    }

    const resolved = await resolveOpportunity({
      supabase,
      payload: aiInterpretation?.targetText
        ? {
            ...payload,
            target: aiInterpretation.targetText
          }
        : payload,
      message,
      intent
    });

    if (resolved.status === "ambiguous") {
      const text = formatAmbiguous(resolved.matches, resolved.targetText);

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: intent,
        conversationId,
        oportunidadId,
        userMessage: message,
        assistantResponse: text,
        context: {
          targetText: resolved.targetText,
          ai_interpretation: aiInterpretation,
          matches: resolved.matches.map((item) => ({
            id: item.id,
            nombre_contacto: item.nombre_contacto,
            nombre: getOpportunityName(item),
            telefono: getOpportunityPhone(item),
            score: item.score
          }))
        },
        usedOpenai,
        success: false,
        error: "ambiguous_target"
      });

      return jsonResponse({
        ok: false,
        needs_clarification: true,
        reason: "ambiguous_target",
        text,
        response: text,
        action: intent,
        matches: resolved.matches.map((item) => ({
          id: item.id,
          nombre_contacto: item.nombre_contacto,
          nombre: getOpportunityName(item),
          telefono: getOpportunityPhone(item),
          email: getOpportunityEmail(item),
          score: item.score,
          updated_at: item.updated_at
        })),
        used_openai: usedOpenai,
        ai_interpretation: aiInterpretation,
        code_version: CODE_VERSION
      });
    }

    if (resolved.status === "not_found" || !resolved.opportunity) {
      const text = notFoundText(resolved.targetText);

      await insertNiaInteraction({
        supabase,
        userId,
        source,
        module,
        action: intent,
        conversationId,
        oportunidadId,
        userMessage: message,
        assistantResponse: text,
        context: {
          targetText: resolved.targetText,
          ai_interpretation: aiInterpretation
        },
        usedOpenai,
        success: false,
        error: "target_not_found"
      });

      return jsonResponse({
        ok: false,
        reason: "target_not_found",
        text,
        response: text,
        action: intent,
        used_openai: usedOpenai,
        ai_interpretation: aiInterpretation,
        code_version: CODE_VERSION
      });
    }

    const opportunity = resolved.opportunity;
    let result: AnyRecord;

    if (intent === "CAMBIAR_CONTEXTO_OPORTUNIDAD") {
      const contextUpdate = buildContextUpdate(opportunity);

      result = {
        ok: true,
        text: changeContextText(opportunity),
        context_update: contextUpdate
      };
    } else if (intent === "MOVER_PIPELINE") {
      result = await movePipeline({
        supabase,
        opportunity,
        estados,
        message,
        userId
      });
    } else if (intent === "RECALIFICAR_OPORTUNIDAD") {
      result = await recalificarOpportunity({
        supabase,
        opportunity,
        campos,
        userId
      });
    } else if (intent === "ACTIVAR_CANDE") {
      result = await setCandeStatus({
        supabase,
        opportunity,
        enabled: true,
        userId
      });
    } else if (intent === "DESACTIVAR_CANDE") {
      result = await setCandeStatus({
        supabase,
        opportunity,
        enabled: false,
        userId
      });
    } else if (intent === "RESUMIR_OPORTUNIDAD") {
      const text = summarizeOpportunity(opportunity);

      result = {
        ok: true,
        text,
        context_update: buildContextUpdate(opportunity)
      };
    } else if (intent === "ACTUALIZAR_DATO_OPORTUNIDAD") {
      const field =
        aiInterpretation?.field ||
        fallbackDatoUpdate?.field ||
        null;

      const value =
        aiInterpretation?.value ??
        fallbackDatoUpdate?.value ??
        null;

      result = await updateOpportunityDato({
        supabase,
        opportunity,
        field,
        value,
        userId
      });
    } else {
      result = {
        ok: true,
        text: cleanText(aiInterpretation?.answer) || generalHelpText()
      };
    }

    const responseContextUpdate = result.context_update || null;

    await insertNiaInteraction({
      supabase,
      userId,
      source,
      module,
      action: intent,
      conversationId: opportunity.conversacion_id || conversationId,
      oportunidadId: opportunity.id,
      userMessage: message,
      assistantResponse: result.text,
      context: {
        resolved_by: resolved.resolvedBy,
        targetText: resolved.targetText,
        ai_interpretation: aiInterpretation,
        opportunity: {
          id: opportunity.id,
          nombre_contacto: opportunity.nombre_contacto,
          nombre: getOpportunityName(opportunity),
          telefono: getOpportunityPhone(opportunity),
          score: opportunity.score,
          estado_id: opportunity.estado_id
        },
        context_update: responseContextUpdate
      },
      metadata: result,
      tool: intent.toLowerCase(),
      usedOpenai,
      success: result.ok !== false,
      error: result.ok === false ? "action_failed" : null
    });

    return jsonResponse({
      ok: result.ok !== false,
      text: result.text,
      response: result.text,
      action: intent,
      code_version: CODE_VERSION,
      used_openai: usedOpenai,
      ai_interpretation: aiInterpretation,
      resolved_by: resolved.resolvedBy,
      oportunidad_id: opportunity.id,
      conversation_id: opportunity.conversacion_id || conversationId,
      conversacion_id: opportunity.conversacion_id || conversationId,
      context_update: responseContextUpdate,
      result
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    console.error("[NIA] Error:", err);

    try {
      if (supabase) {
        await insertNiaInteraction({
          supabase,
          userId: getUserId(payload),
          source: getSource(payload),
          module: getModule(payload),
          action: detectIntent(getMessage(payload)),
          conversationId: getConversationId(payload),
          oportunidadId: getOportunidadId(payload),
          userMessage: getMessage(payload),
          assistantResponse: `NIA tuvo un error: ${message}`,
          success: false,
          error: message
        });
      }
    } catch {
      // Ignorar error de logging.
    }

    return jsonResponse({
      ok: false,
      text: `NIA tuvo un error: ${message}`,
      response: `NIA tuvo un error: ${message}`,
      error: message,
      code_version: CODE_VERSION
    });
  }
});