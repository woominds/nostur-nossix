// @ts-nocheck

/* =========================================================
   NOSSIX / NOSTUR — customer-assistant-reply
   CANDE · Asistente de Pasajeros

   Recibe:
   - conversation_id
   - inbound_message_id
   - force
   - source
   - mode

   Hace:
   - lee conversación
   - verifica modo automático
   - espera debounce para agrupar mensajes partidos
   - evita respuestas duplicadas
   - lee últimos mensajes
   - lee configuración de CANDE desde ai_personas
   - detecta saludos / INFO y responde bienvenida
   - detecta derivación temprana por datos suficientes, pedido humano o problema
   - genera respuesta con OpenAI si hay OPENAI_API_KEY
   - si no hay OPENAI_API_KEY usa fallback comercial
   - guarda mensaje outbound
   - envía por WhatsApp usando whatsapp-send-message
   - devuelve rápido para evitar reintentos de Meta/WhatsApp
   - dispara análisis automático en segundo plano
   - si el score supera el umbral, deriva a vendedores en segundo plano
========================================================= */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

/* =========================================================
   CONSTANTES
========================================================= */

const DEFAULT_HANDOFF_SCORE = 65;

// Espera corta para agrupar mensajes partidos del pasajero.
// Ejemplo: "Buzios" + "Abril" + "4 adultos".
const INBOUND_DEBOUNCE_MS = 8000;

/* =========================================================
   RESPONSES
========================================================= */

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

/* =========================================================
   CLIENTS / ENV
========================================================= */

function getSupabaseAdmin() {
  const supabaseUrl =
    Deno.env.get("SUPABASE_URL") ||
    "https://vkzgfhdfqyjqwvowtarh.supabase.co";

  const serviceRoleKey =
    Deno.env.get("NOSTUR_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!serviceRoleKey) {
    throw new Error("Falta configurar NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function normalizePhoneToPlus(value: unknown): string {
  const raw = String(value || "").replace(/[^\d+]/g, "");

  if (!raw) return "";
  if (raw.startsWith("+")) return raw;

  return `+${raw}`;
}

function normalizePhoneDigits(value: unknown): string {
  return String(value || "").replace(/\D/g, "");
}

function detectArgentinaAreaFromPhone(value: unknown): string | null {
  const digits = normalizePhoneDigits(value);

  if (!digits) return null;

  /*
    Formatos frecuentes:
    +54 9 351 ...
    549351...
    54351...
    351...
  */

  let local = digits;

  if (local.startsWith("549")) {
    local = local.slice(3);
  } else if (local.startsWith("54")) {
    local = local.slice(2);
  }

  // Algunos celulares pueden quedar con 9 adelante si vino mal normalizado.
  if (local.startsWith("9") && local.length > 9) {
    local = local.slice(1);
  }

  const areaMap: Array<{ code: string; city: string }> = [
    { code: "11", city: "Buenos Aires" },
    { code: "351", city: "Córdoba" },
    { code: "341", city: "Rosario" },
    { code: "261", city: "Mendoza" },
    { code: "381", city: "Tucumán" },
    { code: "387", city: "Salta" },
    { code: "342", city: "Santa Fe" },
    { code: "223", city: "Mar del Plata" },
    { code: "221", city: "La Plata" },
    { code: "291", city: "Bahía Blanca" },
    { code: "299", city: "Neuquén" },
    { code: "280", city: "Trelew / Puerto Madryn" },
    { code: "297", city: "Comodoro Rivadavia" },
    { code: "2966", city: "Río Gallegos" },
    { code: "2901", city: "Ushuaia" },
    { code: "264", city: "San Juan" },
    { code: "266", city: "San Luis" },
    { code: "343", city: "Paraná" },
    { code: "379", city: "Corrientes" },
    { code: "362", city: "Resistencia" },
    { code: "370", city: "Formosa" },
    { code: "376", city: "Posadas" },
    { code: "383", city: "Catamarca" },
    { code: "380", city: "La Rioja" },
    { code: "385", city: "Santiago del Estero" },
    { code: "388", city: "Jujuy" }
  ];

  const match = areaMap
    .sort((a, b) => b.code.length - a.code.length)
    .find((item) => local.startsWith(item.code));

  return match?.city || null;
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function getNowIso(): string {
  return new Date().toISOString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function minutesSince(value: unknown): number | null {
  const text = cleanText(value);

  if (!text) return null;

  const date = new Date(text);
  const time = date.getTime();

  if (!Number.isFinite(time)) return null;

  return Math.floor((Date.now() - time) / 60000);
}

function toNumberOrNull(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

function parseJsonSafe(value: unknown): Record<string, unknown> {
  if (!value) return {};
  if (typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;

  const text = String(value || "").trim();

  if (!text) return {};

  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    const match = text.match(/\{[\s\S]*\}/);

    if (!match) return {};

    try {
      return JSON.parse(match[0]) as Record<string, unknown>;
    } catch {
      return {};
    }
  }
}

function normalizeForComparison(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function similarityRatio(a: unknown, b: unknown): number {
  const aa = normalizeForComparison(a);
  const bb = normalizeForComparison(b);

  if (!aa || !bb) return 0;
  if (aa === bb) return 1;

  const aWords = new Set(aa.split(" ").filter(Boolean));
  const bWords = new Set(bb.split(" ").filter(Boolean));

  if (aWords.size === 0 || bWords.size === 0) return 0;

  let intersection = 0;

  aWords.forEach((word) => {
    if (bWords.has(word)) intersection += 1;
  });

  const union = new Set([...aWords, ...bWords]).size;

  return union > 0 ? intersection / union : 0;
}

function isSameUuid(a: unknown, b: unknown): boolean {
  const aa = cleanText(a);
  const bb = cleanText(b);

  return Boolean(aa && bb && aa === bb);
}

function isConversationAutomatic(conversation: any): boolean {
  const enabled = Boolean(conversation?.customer_ai_enabled);
  const mode = cleanText(conversation?.customer_ai_mode).toUpperCase();
  const status = cleanText(conversation?.customer_ai_status).toUpperCase();
  const handoffStatus = cleanText(conversation?.customer_ai_handoff_status).toUpperCase();
  const conversationStatus = cleanText(conversation?.status).toUpperCase();

  if (conversationStatus === "CERRADA") return false;
  if (conversationStatus === "ARCHIVADA") return false;
  if (conversationStatus === "ELIMINADA") return false;

  if (!enabled) return false;
  if (mode !== "AUTOMATICA") return false;

  if (status === "INACTIVA") return false;
  if (status === "PAUSADA") return false;


  if (handoffStatus === "DERIVADA_A_BANDEJA") return false;
  if (handoffStatus === "TOMADA") return false;

  return true;
}

/* =========================================================
   FALLBACK
========================================================= */

function getFallbackReply(params: {
  lastInboundText: string;
  personaMetadata: Record<string, unknown>;
}) {
  const fallbackMessage =
    cleanText(params.personaMetadata.fallback_message) ||
    "Te entiendo. Para poder ayudarte mejor, ¿me indicás destino, fecha aproximada de viaje y cantidad de pasajeros?";

  const welcomeMessage =
    cleanText(params.personaMetadata.welcome_message) ||
    "¡Hola! Soy Cande. Para ayudarte mejor, contame destino, fecha aproximada y cuántas personas viajan.";

  const text = params.lastInboundText.toLowerCase();

  if (
    text === "hola" ||
    text === "buenas" ||
    text === "buen dia" ||
    text === "buen día" ||
    text === "buenas tardes" ||
    text === "buenas noches"
  ) {
    return welcomeMessage;
  }

  if (
    text.includes("vuelos") ||
    text.includes("vuelo") ||
    text.includes("aereo") ||
    text.includes("aéreo")
  ) {
    return "Perfecto. Para ayudarte con vuelos, ¿me indicás ciudad de salida, destino, fecha aproximada y cuántas personas viajan?";
  }

  if (
    text.includes("hotel") ||
    text.includes("paquete") ||
    text.includes("all inclusive")
  ) {
    return "Genial. Para orientarte mejor, ¿me pasás destino, fecha aproximada, cantidad de pasajeros y cuántas noches quieren viajar?";
  }

  return fallbackMessage;
}

/* =========================================================
   DETECCIÓN DE MENSAJES INICIALES / INFO
========================================================= */

function classifyPassengerOpeningMessage(value: unknown): {
  isOpeningOnly: boolean;
  type: "GREETING" | "INFO" | "EMPTY" | "NORMAL";
} {
  const normalized = normalizeForComparison(value);

  if (!normalized) {
    return {
      isOpeningOnly: true,
      type: "EMPTY"
    };
  }

  const greetingOnly = [
    "hola",
    "buenas",
    "buen dia",
    "buenas tardes",
    "buenas noches",
    "buenas dias",
    "hello",
    "hi"
  ];

  const infoOnly = [
    "info",
    "informacion",
    "mas info",
    "quiero info",
    "me pasas info",
    "me pasarias info",
    "consulta",
    "consultar",
    "precio",
    "precios",
    "valor",
    "valores"
  ];

  if (greetingOnly.includes(normalized)) {
    return {
      isOpeningOnly: true,
      type: "GREETING"
    };
  }

  if (infoOnly.includes(normalized)) {
    return {
      isOpeningOnly: true,
      type: "INFO"
    };
  }

  if (
    normalized.length <= 18 &&
    (normalized.includes("info") || normalized.includes("precio") || normalized.includes("consulta"))
  ) {
    return {
      isOpeningOnly: true,
      type: "INFO"
    };
  }

  return {
    isOpeningOnly: false,
    type: "NORMAL"
  };
}

function getOpeningReply(params: {
  type: "GREETING" | "INFO" | "EMPTY" | "NORMAL";
  persona: any;
}) {
  const metadata = readRecord(params.persona?.metadata);

  const assistantName =
    cleanText(metadata.assistant_brand_name) ||
    cleanText(params.persona?.name) ||
    "Cande";

  if (params.type === "GREETING") {
    return `¡Hola! Soy ${assistantName}, asistente de pasajeros de NOSSIX Travel. Para ayudarte mejor, ¿me contás qué destino tenés en mente, para qué fecha aproximada y cuántas personas viajarían?`;
  }

  if (params.type === "INFO") {
    return `¡Hola! Soy ${assistantName}, asistente de pasajeros de NOSSIX Travel. Con gusto te ayudo. ¿Sobre qué destino o viaje querés recibir información? También decime fecha aproximada y cuántas personas viajarían.`;
  }

  if (params.type === "EMPTY") {
    return `¡Hola! Soy ${assistantName}, asistente de pasajeros de NOSSIX Travel. ¿Me contás qué viaje estás buscando?`;
  }

  return "";
}

/* =========================================================
   DERIVACIÓN TEMPRANA CANDE
========================================================= */

function getConversationRecentInboundText(messages: any[]): string {
  return messages
    .filter((message) => message.direction === "inbound")
    .slice(-8)
    .map((message) => cleanText(message.content))
    .filter(Boolean)
    .join("\n");
}

function includesAnyNormalized(text: string, patterns: string[]): boolean {
  const normalized = normalizeForComparison(text);

  return patterns.some((pattern) => normalized.includes(normalizeForComparison(pattern)));
}

function detectHumanRequest(text: string): boolean {
  return includesAnyNormalized(text, [
    "quiero hablar con una persona",
    "quiero hablar con un vendedor",
    "me atiende alguien",
    "no quiero hablar con una ia",
    "no quiero hablar con ia",
    "pasame con un asesor",
    "pasame con una persona",
    "pasame con un vendedor",
    "humano",
    "persona real",
    "alguien real",
    "asesor",
    "agente",
    "vendedor",
    "operador",
    "atencion humana",
    "atención humana",
    "me llama alguien",
    "quiero que me llamen"
  ]);
}

function detectProblemOrUrgency(text: string): boolean {
  return includesAnyNormalized(text, [
    "estoy en destino",
    "tengo un problema",
    "necesito cancelar",
    "necesito cambiar",
    "tengo que pagar",
    "tengo una reserva",
    "tengo un reclamo",
    "no puedo viajar",
    "documentacion",
    "documentación",
    "visa",
    "pasaporte",
    "migraciones",
    "problema",
    "urgente",
    "emergencia",
    "perdi el vuelo",
    "perdí el vuelo",
    "me cancelaron",
    "me cambiaron el vuelo",
    "no me dejan embarcar",
    "no puedo embarcar",
    "no puedo hacer check in",
    "no me llego el voucher",
    "no me llegó el voucher",
    "no me llego el ticket",
    "no me llegó el ticket",
    "necesito asistencia",
    "asistencia",
    "reprogramar",
    "devolucion",
    "devolución",
    "reintegro",
    "equipaje",
    "maleta",
    "demora",
    "cancelacion",
    "cancelación"
  ]);
}

function detectDestination(text: string): boolean {
  const normalized = normalizeForComparison(text);

  // Base inicial de destinos frecuentes. Después la podemos llevar a tabla editable.
  const destinations = [
    "buzios",
    "buzios brasil",
    "rio",
    "rio de janeiro",
    "brasil",
    "miami",
    "orlando",
    "punta cana",
    "cancun",
    "cancun mexico",
    "mexico",
    "playa del carmen",
    "madrid",
    "barcelona",
    "europa",
    "italia",
    "roma",
    "florencia",
    "paris",
    "londres",
    "ushuaia",
    "bariloche",
    "calafate",
    "mendoza",
    "salta",
    "iguazu",
    "caribe",
    "aruba",
    "curazao",
    "san andres",
    "cartagena",
    "panama",
    "punta del este",
    "uruguay",
    "chile",
    "santiago",
    "peru",
    "cusco",
    "machu picchu"
  ];

  return destinations.some((destination) => normalized.includes(normalizeForComparison(destination)));
}

function detectTravelMonthOrDate(text: string): boolean {
  const normalized = normalizeForComparison(text);

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "setiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ];

  const hasMonth = months.some((month) => normalized.includes(month));

  const hasDateLike =
    /\b\d{1,2}[\/\-]\d{1,2}\b/.test(normalized) ||
    /\b\d{1,2}\s+de\s+[a-záéíóúñ]+\b/i.test(text) ||
    /\bfinde\b/.test(normalized) ||
    /\bfin de semana\b/.test(normalized) ||
    /\bsemana santa\b/.test(normalized) ||
    /\bvacaciones\b/.test(normalized);

  return hasMonth || hasDateLike;
}

function detectPassengers(text: string): boolean {
  const normalized = normalizeForComparison(text);

  if (/\b\d+\s*(adulto|adultos|persona|personas|pax|pasajero|pasajeros)\b/.test(normalized)) {
    return true;
  }

  if (/\b\d+\s*(menor|menores|nino|ninos|niño|niños|bebe|bebes|bebé|bebés)\b/.test(normalized)) {
    return true;
  }

  if (/\b\d+\s*(viajan|viajamos|somos)\b/.test(normalized)) {
    return true;
  }

  if (
    /\b\d+\b/.test(normalized) &&
    (
      normalized.includes("pasajeros") ||
      normalized.includes("pasajero") ||
      normalized.includes("adultos") ||
      normalized.includes("adulto") ||
      normalized.includes("personas") ||
      normalized.includes("persona") ||
      normalized.includes("pax")
    )
  ) {
    return true;
  }

  if (normalized.includes("somos")) return true;
  if (normalized.includes("pareja")) return true;
  if (normalized.includes("familia")) return true;

  return false;
}

/* =========================================================
   LECTURA LIVIANA DE DATOS YA DETECTADOS
========================================================= */

type LightTravelFacts = {
  destination: string | null;
  travelDate: string | null;
  passengers: string | null;
  origin: string | null;
  nights: string | null;
  budget: string | null;
  hasDestination: boolean;
  hasTravelDate: boolean;
  hasPassengers: boolean;
  hasMinimumCommercialInfo: boolean;
  detectedSummary: string;
};

function detectDestinationValue(text: string): string | null {
  const normalized = normalizeForComparison(text);

  const destinations = [
    "rio de janeiro",
    "río de janeiro",
    "rio",
    "buzios",
    "buzios brasil",
    "brasil",
    "praia do forte",
    "salvador",
    "maceio",
    "recife",
    "florianopolis",
    "punta cana",
    "bayahibe",
    "cancun",
    "playa del carmen",
    "miami",
    "orlando",
    "madrid",
    "barcelona",
    "europa",
    "italia",
    "roma",
    "paris",
    "londres",
    "bariloche",
    "ushuaia",
    "calafate",
    "mendoza",
    "salta",
    "iguazu"
  ];

  const found = destinations.find((destination) =>
    normalized.includes(normalizeForComparison(destination))
  );

  if (!found) return null;

  if (found === "rio") return "Río de Janeiro";
  if (found === "río de janeiro") return "Río de Janeiro";
  if (found === "rio de janeiro") return "Río de Janeiro";
  if (found === "buzios") return "Búzios";
  if (found === "buzios brasil") return "Búzios";
  if (found === "iguazu") return "Iguazú";

  return found
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function detectTravelDateValue(text: string): string | null {
  const normalized = normalizeForComparison(text);

  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "setiembre",
    "octubre",
    "noviembre",
    "diciembre"
  ];

  const month = months.find((item) => normalized.includes(item));

  if (month) {
    return month.charAt(0).toUpperCase() + month.slice(1);
  }

  const dateMatch = cleanText(text).match(/\b\d{1,2}[\/\-]\d{1,2}(?:[\/\-]\d{2,4})?\b/);

  if (dateMatch?.[0]) return dateMatch[0];

  if (normalized.includes("semana santa")) return "Semana Santa";
  if (normalized.includes("vacaciones")) return "Vacaciones";
  if (normalized.includes("fin de semana") || normalized.includes("finde")) return "Fin de semana";

  return null;
}

function detectPassengersValue(text: string): string | null {
  const normalized = normalizeForComparison(text);

  const explicitMatch =
    normalized.match(/\b\d+\s*(adulto|adultos|persona|personas|pax|pasajero|pasajeros)\b/) ||
    normalized.match(/\b\d+\s*(menor|menores|nino|ninos|bebe|bebes)\b/);

  if (explicitMatch?.[0]) {
    return explicitMatch[0]
      .replace(/\bnino\b/g, "niño")
      .replace(/\bninos\b/g, "niños")
      .replace(/\bbebe\b/g, "bebé")
      .replace(/\bbebes\b/g, "bebés");
  }

  const somosMatch = normalized.match(/\bsomos\s+(\d+)\b/);

  if (somosMatch?.[1]) {
    return `${somosMatch[1]} personas`;
  }

  if (normalized.includes("pareja")) return "2 adultos";
  if (normalized.includes("familia")) return "familia";

  return null;
}

function detectOriginValue(text: string): string | null {
  const normalized = normalizeForComparison(text);

  const originMatch =
    normalized.match(/\bdesde\s+([a-z\s]{3,35})\b/) ||
    normalized.match(/\bsaliendo\s+desde\s+([a-z\s]{3,35})\b/) ||
    normalized.match(/\bsalida\s+desde\s+([a-z\s]{3,35})\b/);

  if (!originMatch?.[1]) return null;

  const raw = originMatch[1]
    .replace(/\bpara\b.*$/g, "")
    .replace(/\ben\b.*$/g, "")
    .replace(/\bpor\b.*$/g, "")
    .trim();

  if (!raw) return null;

  return raw
    .split(" ")
    .slice(0, 4)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function detectNightsValue(text: string): string | null {
  const normalized = normalizeForComparison(text);

  const match =
    normalized.match(/\b(\d+)\s*(noche|noches)\b/) ||
    normalized.match(/\b(\d+)\s*(dias|días)\b/) ||
    normalized.match(/\buna\s+semana\b/);

  if (!match) return null;

  if (match[0].includes("una semana")) return "7 noches";
  if (match[1] && match[0].includes("dia")) return `${match[1]} días`;
  if (match[1]) return `${match[1]} noches`;

  return null;
}

function detectBudgetValue(text: string): string | null {
  const normalized = normalizeForComparison(text);

  const usdMatch =
    cleanText(text).match(/(?:usd|u\$s|dolares|dólares)\s*[\$]?\s*([\d.,]+)/i) ||
    cleanText(text).match(/([\d.,]+)\s*(?:usd|u\$s|dolares|dólares)/i);

  if (usdMatch?.[1]) return `USD ${usdMatch[1]}`;

  const perPersonMatch = normalized.match(/\b(\d+(?:[.,]\d+)?)\s*(mil)?\s*por\s*persona\b/);

  if (perPersonMatch?.[1]) {
    const amount = perPersonMatch[2] ? `${perPersonMatch[1]} mil` : perPersonMatch[1];
    return `${amount} por persona`;
  }

  return null;
}

function extractLightTravelFacts(messages: any[], conversation: any): LightTravelFacts {
  const recentInboundText = messages
    .filter((message) => message.direction === "inbound")
    .slice(-10)
    .map((message) => cleanText(message.content))
    .filter(Boolean)
    .join("\n");

  const destination = detectDestinationValue(recentInboundText);
  const travelDate = detectTravelDateValue(recentInboundText);
  const passengers = detectPassengersValue(recentInboundText);
  const origin =
    detectOriginValue(recentInboundText) ||
    detectArgentinaAreaFromPhone(conversation?.telefono);
  const nights = detectNightsValue(recentInboundText);
  const budget = detectBudgetValue(recentInboundText);

  const hasDestination = Boolean(destination);
  const hasTravelDate = Boolean(travelDate);
  const hasPassengers = Boolean(passengers);

  const detectedParts = [
    destination ? `Destino: ${destination}` : "",
    travelDate ? `Fecha/mes: ${travelDate}` : "",
    passengers ? `Pasajeros: ${passengers}` : "",
    origin ? `Origen sugerido/detectado: ${origin}` : "",
    nights ? `Duración: ${nights}` : "",
    budget ? `Presupuesto: ${budget}` : ""
  ].filter(Boolean);

  return {
    destination,
    travelDate,
    passengers,
    origin,
    nights,
    budget,
    hasDestination,
    hasTravelDate,
    hasPassengers,
    hasMinimumCommercialInfo: hasDestination && hasTravelDate && hasPassengers,
    detectedSummary: detectedParts.length > 0 ? detectedParts.join(" · ") : "Sin datos comerciales detectados todavía."
  };
}

function shouldEarlyHandoff(params: {
  conversation: any;
  messages: any[];
  targetInboundMessage: any;
}) {
  const recentInboundText = getConversationRecentInboundText(params.messages);
  const lastInboundText = cleanText(params.targetInboundMessage?.content);
  const text = [recentInboundText, lastInboundText].filter(Boolean).join("\n");

  const humanRequest = detectHumanRequest(text);
  const problemOrUrgency = detectProblemOrUrgency(text);

  const facts = extractLightTravelFacts(params.messages, params.conversation);

  const hasExtraCommercialInfo = Boolean(
    facts.origin ||
      facts.nights ||
      facts.budget ||
      includesAnyNormalized(text, [
        "all inclusive",
        "todo incluido",
        "hotel",
        "paquete",
        "vuelo",
        "aereo",
        "aéreo",
        "desde",
        "salimos",
        "salen",
        "salida"
      ])
  );

  const hasEnoughToStopAsking =
    facts.hasDestination &&
    facts.hasTravelDate &&
    facts.hasPassengers &&
    hasExtraCommercialInfo;

  if (problemOrUrgency) {
    return {
      shouldHandoff: true,
      reason: "CANDE detectó problema, urgencia, documentación, reserva, pago, cambio, cancelación o reclamo.",
      kind: "PROBLEM_OR_URGENCY",
      reply:
        "Entiendo. Para este tipo de consulta es mejor que continúe directamente un asesor del equipo. Ya dejo la conversación derivada para que te respondan a la brevedad.",
      score: 95,
      temperature: "URGENTE",
      facts
    };
  }

 if (humanRequest) {
  return {
    shouldHandoff: true,
    reason: "El pasajero pidió hablar con una persona, vendedor, asesor o agente humano.",
    kind: "HUMAN_REQUEST",
    reply:
      "Perfecto, te paso con un asesor del equipo para que pueda ayudarte personalmente. En breve continúan con la atención.",
    score: 75,
    temperature: "DERIVAR"
  };
}

  if (hasEnoughToStopAsking) {
    return {
      shouldHandoff: true,
      reason: `CANDE detectó datos suficientes para que intervenga un asesor. ${facts.detectedSummary}`,
      kind: "COMMERCIAL_ENOUGH_INFO",
      reply:
        "Perfecto, ya tengo los datos principales para que un asesor continúe con la cotización. En breve te responden.",
      score: 75,
      temperature: "CALIENTE",
      facts
    };
  }

  return {
    shouldHandoff: false,
    reason: "",
    kind: "NONE",
    reply: "",
    score: null,
    temperature: null,
    facts
  };
}
async function sendEarlyHandoffReply(params: {
  supabase: any;
  conversation: any;
  conversationId: string;
  targetInboundMessage: any;
  persona: any;
  replyText: string;
  reason: string;
  score: number | null;
  temperature: string | null;
  kind: string;
}) {
  const now = getNowIso();
  const phone = normalizePhoneToPlus(params.conversation.telefono);
  const senderName = params.persona?.display_name || "Cande · Asistente de Pasajeros";
  const metadata = readRecord(params.conversation.metadata);

  const insertMessageRes = await params.supabase
    .from("messages")
    .insert({
      conversation_id: params.conversationId,
      channel: "whatsapp",
      direction: "outbound",
      sender_type: "agent",
      sender_id: null,
      sender_name: senderName,
      content: params.replyText,
      message_type: "text",
      status: "pending",
      is_internal: false,
      metadata: {
        source: "customer-assistant-reply",
        ai_persona_code: "customer_assistant",
        ai_persona_name: "CANDE",
        ai_persona_id: params.persona?.id || null,
        inbound_message_id: params.targetInboundMessage.id,
        inbound_whatsapp_message_id: params.targetInboundMessage.whatsapp_message_id || null,
        automatic: true,
        early_handoff: true,
        early_handoff_kind: params.kind,
        early_handoff_reason: params.reason
      },
      created_at: now,
      created_by: null
    })
    .select("id")
    .single();

  if (insertMessageRes.error) throw insertMessageRes.error;

  const localMessageId = insertMessageRes.data.id;

  await params.supabase
    .from("conversations")
    .update({
      assigned_to: null,
      last_message: params.replyText,
      last_message_time: now,
      last_outbound_message_at: now,
      estado_gestion: "DERIVADO_NUEVO",
      customer_ai_status: "DERIVADA_A_BANDEJA",
      customer_ai_handoff_status: "DERIVADA_A_BANDEJA",
      customer_ai_handoff_reason: params.reason,
      customer_ai_handoff_at: now,
      customer_ai_score: params.score,
      customer_ai_temperature: params.temperature,
      customer_ai_last_response_at: now,
      customer_ai_last_replied_to_message_id: params.targetInboundMessage.id,
      customer_ai_last_inbound_message_id: params.targetInboundMessage.id,
      customer_ai_last_inbound_at: params.targetInboundMessage.created_at || now,
      customer_ai_last_error: null,
      customer_ai_auto_reply_count: Number(params.conversation.customer_ai_auto_reply_count || 0) + 1,
      updated_at: now,
      metadata: {
        ...metadata,
        customer_ai_stage: "DERIVADO_NUEVO",
        customer_ai_handoff_source: "customer-assistant-reply-early",
        customer_ai_handoff_kind: params.kind,
        customer_ai_handoff_reason: params.reason,
        customer_ai_handoff_at: now,
        customer_ai_score: params.score,
        customer_ai_temperature: params.temperature,
        play_handoff_sound: true
      }
    })
    .eq("id", params.conversationId);

  await params.supabase.from("messages").insert({
    conversation_id: params.conversationId,
    channel: "interno",
    direction: "system",
    sender_type: "system",
    sender_id: null,
    sender_name: "CANDE",
    content: [
      "CANDE derivó esta conversación a vendedores.",
      "",
      `Motivo: ${params.reason}`,
      params.score !== null ? `Score: ${params.score}` : "",
      params.temperature ? `Temperatura: ${params.temperature}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    message_type: "system",
    status: "sent",
    is_internal: true,
    metadata: {
      system_ai: true,
      source: "customer_ai_handoff",
      customer_ai_handoff_status: "DERIVADA_A_BANDEJA",
      early_handoff: true,
      early_handoff_kind: params.kind,
      play_handoff_sound: true
    },
    created_by: null,
    created_at: now
  });

  if (!phone) {
    await params.supabase
      .from("messages")
      .update({
        status: "failed",
        wa_error_code: "missing_phone",
        wa_error_message: "La conversación no tiene teléfono."
      })
      .eq("id", localMessageId);

    return {
      ok: false,
      localMessageId,
      error: "La conversación no tiene teléfono."
    };
  }

  const sendRes = await params.supabase.functions.invoke("whatsapp-send-message", {
    body: {
      conversation_id: params.conversationId,
      local_message_id: localMessageId,
      to: phone,
      content: params.replyText,
      text: params.replyText,
      message_type: "text",
      source: "customer-assistant-reply-early-handoff"
    }
  });

  if (sendRes.error) {
    const sendErrorMessage = sendRes.error.message || "No se pudo enviar WhatsApp.";

    await params.supabase
      .from("messages")
      .update({
        status: "failed",
        wa_error_message: sendErrorMessage
      })
      .eq("id", localMessageId);

    await params.supabase
      .from("conversations")
      .update({
        customer_ai_last_error: sendErrorMessage,
        updated_at: getNowIso()
      })
      .eq("id", params.conversationId);

    return {
      ok: false,
      localMessageId,
      error: sendErrorMessage
    };
  }

  /*
  IMPORTANTE:
  whatsapp-send-message puede dejar la conversación como ESPERA_CLIENTE
  porque interpreta el outbound como una respuesta normal.
  Después de enviar el WhatsApp de derivación, reforzamos el estado final
  para que aparezca correctamente en la bandeja DERIVADO NUEVO.
*/
await params.supabase
  .from("conversations")
  .update({
    assigned_to: null,
    estado_gestion: "DERIVADO_NUEVO",
    customer_ai_status: "DERIVADA",
    customer_ai_handoff_status: "DERIVADA_A_BANDEJA",
    customer_ai_handoff_reason: params.reason,
    customer_ai_handoff_at: now,
    customer_ai_score: params.score,
    customer_ai_temperature: params.temperature,
    updated_at: getNowIso(),
    metadata: {
      ...metadata,
      customer_ai_stage: "DERIVADO_NUEVO",
      customer_ai_handoff_source: "customer-assistant-reply-early",
      customer_ai_handoff_kind: params.kind,
      customer_ai_handoff_reason: params.reason,
      customer_ai_handoff_at: now,
      customer_ai_score: params.score,
      customer_ai_temperature: params.temperature,
      play_handoff_sound: true,
      force_derivado_nuevo_after_send: true
    }
  })
  .eq("id", params.conversationId);

  await saveDebug({
    supabase: params.supabase,
    eventType: "cande_early_handoff_replied",
    conversationId: params.conversationId,
    messageId: params.targetInboundMessage.id,
    rawPayload: {
      local_message_id: localMessageId,
      reply: params.replyText,
      reason: params.reason,
      kind: params.kind,
      score: params.score,
      temperature: params.temperature,
      send_response: sendRes.data || null
    }
  });

  return {
    ok: true,
    localMessageId,
    error: null
  };
}

/* =========================================================
   DEBUG
========================================================= */

async function saveDebug(params: {
  supabase: any;
  eventType: string;
  conversationId?: string | null;
  messageId?: string | null;
  rawPayload: any;
}) {
  try {
    await params.supabase.from("whatsapp_webhook_debug").insert({
      event_type: params.eventType,
      field: "customer-assistant-reply",
      whatsapp_message_id: params.messageId || null,
      raw_payload: {
        conversation_id: params.conversationId || null,
        ...readRecord(params.rawPayload)
      }
    });
  } catch {
    // El debug no debe romper la función.
  }
}

/* =========================================================
   ANTI DUPLICADOS
========================================================= */

async function alreadyRepliedToInbound(params: {
  supabase: any;
  conversation: any;
  conversationId: string;
  inboundMessageId: string;
}) {
  if (!params.inboundMessageId) return false;

  if (isSameUuid(params.conversation.customer_ai_last_replied_to_message_id, params.inboundMessageId)) {
    return true;
  }

  const existingAiReply = await params.supabase
    .from("messages")
    .select("id")
    .eq("conversation_id", params.conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "agent")
    .is("deleted_at", null)
    .contains("metadata", {
      source: "customer-assistant-reply",
      inbound_message_id: params.inboundMessageId
    })
    .limit(1)
    .maybeSingle();

  if (existingAiReply.error) {
    await saveDebug({
      supabase: params.supabase,
      eventType: "cande_duplicate_check_error",
      conversationId: params.conversationId,
      messageId: params.inboundMessageId,
      rawPayload: {
        error: existingAiReply.error.message || existingAiReply.error
      }
    });

    return false;
  }

  return Boolean(existingAiReply.data?.id);
}

async function getTargetInboundMessage(params: {
  supabase: any;
  conversationId: string;
  inboundMessageId: string;
}) {
  if (params.inboundMessageId) {
    const messageRes = await params.supabase
      .from("messages")
      .select("*")
      .eq("id", params.inboundMessageId)
      .eq("conversation_id", params.conversationId)
      .is("deleted_at", null)
      .maybeSingle();

    if (messageRes.error) throw messageRes.error;

    if (messageRes.data?.id) {
      return messageRes.data;
    }
  }

  const lastInboundRes = await params.supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.conversationId)
    .eq("direction", "inbound")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastInboundRes.error) throw lastInboundRes.error;

  return lastInboundRes.data || null;
}

async function getLatestInboundMessage(params: {
  supabase: any;
  conversationId: string;
}) {
  const latestInboundRes = await params.supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.conversationId)
    .eq("direction", "inbound")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestInboundRes.error) throw latestInboundRes.error;

  return latestInboundRes.data || null;
}

async function getLastCandeOutbound(params: {
  supabase: any;
  conversationId: string;
}) {
  const lastOutboundRes = await params.supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", params.conversationId)
    .eq("direction", "outbound")
    .eq("sender_type", "agent")
    .is("deleted_at", null)
    .contains("metadata", {
      source: "customer-assistant-reply"
    })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastOutboundRes.error) return null;

  return lastOutboundRes.data || null;
}

async function claimInboundReplyLock(params: {
  supabase: any;
  conversationId: string;
  inboundMessageId: string;
}) {
  const lockRes = await params.supabase
    .from("customer_ai_reply_locks")
    .insert({
      conversation_id: params.conversationId,
      inbound_message_id: params.inboundMessageId,
      source: "customer-assistant-reply",
      status: "PROCESSING"
    })
    .select("id")
    .single();

  if (lockRes.error) {
    const message = cleanText(lockRes.error.message);

    if (
      message.includes("duplicate key") ||
      message.includes("customer_ai_reply_locks_inbound_unique")
    ) {
      await saveDebug({
        supabase: params.supabase,
        eventType: "cande_skipped_lock_duplicate",
        conversationId: params.conversationId,
        messageId: params.inboundMessageId,
        rawPayload: {
          reason: "Ya existe lock para este inbound_message_id."
        }
      });

      return {
        claimed: false,
        lockId: null
      };
    }

    throw lockRes.error;
  }

  return {
    claimed: true,
    lockId: lockRes.data?.id || null
  };
}

async function finishInboundReplyLock(params: {
  supabase: any;
  lockId?: string | null;
  status: "DONE" | "SKIPPED" | "ERROR";
  errorMessage?: string | null;
}) {
  if (!params.lockId) return;

  await params.supabase
    .from("customer_ai_reply_locks")
    .update({
      status: params.status,
      finished_at: getNowIso(),
      error_message: params.errorMessage || null
    })
    .eq("id", params.lockId);
}

/* =========================================================
   OPENAI
========================================================= */

async function generateAiReply(params: {
  conversation: any;
  messages: any[];
  persona: any;
  targetInboundMessage: any;
}) {
  const openAiKey = Deno.env.get("OPENAI_API_KEY");

  const metadata = readRecord(params.persona?.metadata);

  const lastInboundText = cleanText(params.targetInboundMessage?.content);
  const suggestedDepartureCity = detectArgentinaAreaFromPhone(params.conversation?.telefono);

  if (!openAiKey) {
    return getFallbackReply({
      lastInboundText,
      personaMetadata: metadata
    });
  }

  const assistantName =
    cleanText(metadata.assistant_brand_name) ||
    cleanText(params.persona?.name) ||
    "Cande";

  const canSay = cleanText(metadata.can_say);
  const cannotSay = cleanText(metadata.cannot_say);
  const businessRules = cleanText(metadata.business_rules);
  const handoffRules = cleanText(metadata.handoff_rules);
  const tone = cleanText(params.persona?.tone) || "Amable, comercial, claro y profesional.";

  const conversationText = params.messages
    .slice(-12)
    .map((message) => {
      const who =
        message.direction === "inbound"
          ? "Pasajero"
          : message.direction === "outbound"
            ? cleanText(message.sender_name) || "Agente"
            : "Sistema";

      return `${who}: ${cleanText(message.content)}`;
    })
    .join("\n");
  const lightFacts = extractLightTravelFacts(params.messages, params.conversation);
  const systemPrompt = [
    `Sos ${assistantName}, la IA vendedora / primer filtro de NOSSIX Travel.`,
    "Tu función es responder consultas iniciales de pasajeros por WhatsApp.",
    "",
    "REGLA CRÍTICA DE CONTEXTO:",
    "Respondé principalmente al ÚLTIMO mensaje del pasajero, pero usando los últimos mensajes si fueron enviados juntos como datos partidos.",
    "No arrastres destinos, fechas, pasajeros ni preferencias de mensajes viejos si el último mensaje no los confirma.",
    "Si el último mensaje cambia de tema o destino, tomalo como nueva intención dentro de la misma conversación.",
    "Si el último mensaje es ambiguo, corto o no se entiende, pedí aclaración simple.",
        "Antes de preguntar, revisá DATOS YA DETECTADOS.",
    "No vuelvas a pedir destino si ya aparece detectado.",
    "No vuelvas a pedir cantidad de pasajeros si ya aparece detectada.",
    "No vuelvas a pedir mes o fecha aproximada si ya aparece detectada.",
    "Si falta información, preguntá solamente lo faltante.",
    "",
    "REGLA CRÍTICA DE NO INVENTAR:",
    "No digas que ya tenés opciones armadas si el sistema no te entregó opciones reales.",
    "No digas 'te paso las opciones que armé', 'opciones que preparé', 'opciones listas' ni frases similares.",
    "No inventes paquetes, hoteles, vuelos, precios, disponibilidad ni promociones.",
    "No digas que un asesor ya tiene una cotización lista si no aparece en el contexto.",
    "",
    "REGLAS COMERCIALES:",
    "Indagá con preguntas simples, de a una o dos por vez, sin saturar.",
    "Objetivo: detectar destino, fecha aproximada, cantidad de pasajeros, edades de menores, ciudad de salida, cantidad de noches, presupuesto y urgencia.",
    "Si el pasajero pide vuelos, priorizá ciudad de salida, destino, fechas y cantidad de pasajeros.",
    "Si el pasajero pide paquete u hotel, priorizá destino, fechas, noches, pasajeros y tipo de hotel.",
    suggestedDepartureCity
      ? `PISTA DE ORIGEN POR TELÉFONO: El número parece corresponder a ${suggestedDepartureCity}. No lo tomes como confirmado. Cuando falte ciudad de salida, preguntá de forma natural: "¿Salen desde ${suggestedDepartureCity} o desde otra ciudad?".`
      : "Si falta ciudad de salida, preguntá desde qué ciudad salen, sin asumir el origen.",
    "No confirmes disponibilidad final.",
    "No garantices precios.",
    "No emitas tickets.",
    "No tomes pagos.",
    "No inventes políticas.",
    "",
    "DERIVACIÓN:",
    "Si detectás urgencia, reclamo, pasajero en destino, documentación, cambios, cancelaciones, pagos, pedido explícito de asesor o intención fuerte de compra, respondé breve y decí que un asesor va a continuar.",
    "",
    `Tono: ${tone}`,
    canSay ? `Puede decir: ${canSay}` : "",
    cannotSay ? `No puede decir: ${cannotSay}` : "",
    businessRules ? `Reglas de negocio configuradas: ${businessRules}` : "",
    handoffRules ? `Reglas de derivación configuradas: ${handoffRules}` : "",
    "",
    "Respondé SIEMPRE en español argentino.",
    "Respuesta corta, natural y lista para enviar por WhatsApp.",
    "No uses markdown pesado.",
    "No digas que sos ChatGPT.",
    `No te presentes como ${assistantName} en cada mensaje si ya venís hablando en la misma conversación.`
  ]
    .filter(Boolean)
    .join("\n");

  const userPrompt = [
    "Conversación reciente:",
    conversationText || "Sin mensajes previos.",
    "",
    suggestedDepartureCity
      ? `Ciudad sugerida por código de área del teléfono: ${suggestedDepartureCity}. Es solo una pista, no está confirmada por el pasajero.`
      : "No hay ciudad de salida sugerida por teléfono.",
    "",
         "DATOS YA DETECTADOS POR LECTURA LIVIANA:",
    lightFacts.detectedSummary,
    "",
    "Usá estos datos como memoria inmediata. No los vuelvas a preguntar si ya están detectados.",
    "",
    "ÚLTIMO MENSAJE REAL DEL PASAJERO AL QUE TENÉS QUE RESPONDER:",
   
    lastInboundText || "Sin contenido.",
    "",
    `Generá la próxima respuesta de ${assistantName}.`
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: Deno.env.get("OPENAI_MODEL_CANDE") || Deno.env.get("OPENAI_MODEL_IAPAX") || "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userPrompt
        }
      ],
      temperature: 0.35,
      max_output_tokens: 220
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "OpenAI no pudo generar respuesta.");
  }

  const outputText =
    cleanText(data.output_text) ||
    cleanText(data.output?.[0]?.content?.[0]?.text) ||
    cleanText(data.output?.[0]?.content?.[0]?.content);

  if (!outputText) {
    return getFallbackReply({
      lastInboundText,
      personaMetadata: metadata
    });
  }

  return outputText;
}

/* =========================================================
   ANALISIS / SCORE / DERIVACION
========================================================= */

function normalizeAnalysisPayload(value: unknown): Record<string, unknown> {
  const raw = readRecord(value);
  const metadata = readRecord(raw.metadata);
  const parsedOutput = parseJsonSafe(raw.output_text);

  const data = readRecord(
    raw.analysis ||
      raw.analisis ||
      raw.result ||
      raw.data ||
      metadata.analysis ||
      metadata.analisis ||
      parsedOutput.analysis ||
      parsedOutput.analisis ||
      parsedOutput ||
      raw
  );

  return {
    ...raw,
    ...data
  };
}

function getAnalysisScore(analysis: Record<string, unknown>): number | null {
  return (
    toNumberOrNull(analysis.score_cliente) ??
    toNumberOrNull(analysis.puntaje_lead) ??
    toNumberOrNull(analysis.lead_score) ??
    toNumberOrNull(analysis.score) ??
    toNumberOrNull(analysis.ai_score) ??
    null
  );
}

function getAnalysisMissingInfo(analysis: Record<string, unknown>): string[] {
  return asStringArray(
    analysis.informacion_faltante ||
      analysis.missing_info ||
      analysis.datos_faltantes ||
      analysis.missing
  );
}

function getAnalysisTemperature(analysis: Record<string, unknown>): string | null {
  return (
    cleanText(analysis.temperatura_lead) ||
    cleanText(analysis.lead_temperature) ||
    cleanText(analysis.temperature) ||
    cleanText(analysis.temperatura) ||
    null
  );
}

function getAnalysisSummary(analysis: Record<string, unknown>): string | null {
  return (
    cleanText(analysis.resumen) ||
    cleanText(analysis.summary) ||
    cleanText(analysis.sintesis) ||
    null
  );
}

function getAnalysisNextAction(analysis: Record<string, unknown>): string | null {
  return (
    cleanText(analysis.proxima_accion) ||
    cleanText(analysis.next_action) ||
    cleanText(analysis.accion_sugerida) ||
    null
  );
}

function getHandoffThreshold(persona: any): number {
  const metadata = readRecord(persona?.metadata);

  return (
    toNumberOrNull(metadata.handoff_score_threshold) ??
    toNumberOrNull(metadata.derivation_score_threshold) ??
    DEFAULT_HANDOFF_SCORE
  );
}

function shouldHandoffByAnalysis(params: {
  analysis: Record<string, unknown>;
  persona: any;
}) {
  const score = getAnalysisScore(params.analysis);
  const threshold = getHandoffThreshold(params.persona);
  const missingInfo = getAnalysisMissingInfo(params.analysis);
  const nextAction = normalizeForComparison(getAnalysisNextAction(params.analysis));
  const intent = normalizeForComparison(
    params.analysis.intencion ||
      params.analysis.intent ||
      params.analysis.intention ||
      ""
  );

  const explicitHandoff =
    nextAction.includes("deriv") ||
    nextAction.includes("asesor") ||
    nextAction.includes("vendedor") ||
    intent.includes("compra") ||
    intent.includes("cotiz") ||
    intent.includes("presupuesto");

  const scoreReached = score !== null && score >= threshold;
  const hasEnoughInfoByMissing = missingInfo.length === 0 && score !== null && score >= 55;

  return {
    shouldHandoff: scoreReached || explicitHandoff || hasEnoughInfoByMissing,
    score,
    threshold,
    missingInfo,
    reason: scoreReached
      ? `Score ${score} supera umbral ${threshold}.`
      : explicitHandoff
        ? "La IA detectó intención de compra o necesidad de asesor."
        : hasEnoughInfoByMissing
          ? "La IA detectó información suficiente para derivar."
          : ""
  };
}

async function triggerAutomaticAnalysis(params: {
  supabase: any;
  conversationId: string;
  inboundMessageId: string | null;
}) {
  try {
    const analysisRes = await params.supabase.functions.invoke("analyze-conversation-ai", {
      body: {
        conversation_id: params.conversationId,
        inbound_message_id: params.inboundMessageId,
        force: true,
        source: "customer-assistant-reply-auto"
      }
    });

    await saveDebug({
      supabase: params.supabase,
      eventType: analysisRes.error ? "cande_auto_analysis_error" : "cande_auto_analysis_invoked",
      conversationId: params.conversationId,
      messageId: params.inboundMessageId,
      rawPayload: {
        error: analysisRes.error?.message || null,
        response: analysisRes.data || null
      }
    });

    if (analysisRes.error) {
      return {
        ok: false,
        analysis: null,
        error: analysisRes.error?.message || "No se pudo analizar la conversación."
      };
    }

    return {
      ok: true,
      analysis: normalizeAnalysisPayload(analysisRes.data),
      error: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await saveDebug({
      supabase: params.supabase,
      eventType: "cande_auto_analysis_soft_error",
      conversationId: params.conversationId,
      messageId: params.inboundMessageId,
      rawPayload: {
        error: message
      }
    });

    return {
      ok: false,
      analysis: null,
      error: message
    };
  }
}

async function handoffToSellers(params: {
  supabase: any;
  conversation: any;
  conversationId: string;
  persona: any;
  analysis: Record<string, unknown>;
  reason: string;
}) {
  const now = getNowIso();
  const metadata = readRecord(params.conversation.metadata);
  const summary = getAnalysisSummary(params.analysis);
  const score = getAnalysisScore(params.analysis);
  const temperature = getAnalysisTemperature(params.analysis);
  const missingInfo = getAnalysisMissingInfo(params.analysis);
  const nextAction = getAnalysisNextAction(params.analysis);
  const handoffMessage =
    cleanText(readRecord(params.persona?.metadata).handoff_message) ||
    "Perfecto, ya tengo información suficiente para que un asesor continúe con la atención. Te vamos a responder a la brevedad.";

  const updateRes = await params.supabase
    .from("conversations")
    .update({
      assigned_to: null,
      estado_gestion: "DERIVADO_NUEVO",
      customer_ai_status: "DERIVADA_A_BANDEJA",
      customer_ai_handoff_status: "DERIVADA_A_BANDEJA",
      customer_ai_handoff_reason: params.reason,
      customer_ai_handoff_at: now,
      customer_ai_score: score,
      customer_ai_temperature: temperature,
      customer_ai_summary: summary,
      customer_ai_missing_info: missingInfo,
      customer_ai_next_action: nextAction,
      updated_at: now,
      metadata: {
        ...metadata,
        customer_ai_stage: "DERIVADO_NUEVO",
        customer_ai_handoff_source: "customer-assistant-reply",
        customer_ai_handoff_message: handoffMessage,
        customer_ai_handoff_reason: params.reason,
        customer_ai_handoff_at: now,
        customer_ai_score: score,
        customer_ai_temperature: temperature,
        customer_ai_summary: summary,
        customer_ai_missing_info: missingInfo,
        customer_ai_next_action: nextAction,
        play_handoff_sound: true
      }
    })
    .eq("id", params.conversationId);

  if (updateRes.error) throw updateRes.error;

  await params.supabase.from("messages").insert({
    conversation_id: params.conversationId,
    channel: "interno",
    direction: "system",
    sender_type: "system",
    sender_id: null,
    sender_name: "Cande",
    content: [
      "CANDE derivó esta conversación a vendedores.",
      "",
      `Motivo: ${params.reason}`,
      score !== null ? `Score: ${score}` : "",
      temperature ? `Temperatura: ${temperature}` : "",
      summary ? `Resumen: ${summary}` : "",
      nextAction ? `Próxima acción: ${nextAction}` : ""
    ]
      .filter(Boolean)
      .join("\n"),
    message_type: "system",
    status: "sent",
    is_internal: true,
    metadata: {
      system_ai: true,
      source: "customer_ai_handoff",
      customer_ai_handoff_status: "DERIVADA_A_BANDEJA",
      play_handoff_sound: true,
      analysis: params.analysis
    },
    created_by: null,
    created_at: now
  });

  await saveDebug({
    supabase: params.supabase,
    eventType: "cande_handoff_to_sellers",
    conversationId: params.conversationId,
    messageId: null,
    rawPayload: {
      reason: params.reason,
      score,
      temperature,
      summary,
      nextAction
    }
  });

  return true;
}

async function runPostReplyBackground(params: {
  supabase: any;
  conversation: any;
  conversationId: string;
  inboundMessageId: string;
  persona: any;
}) {
  try {
    const analysisResult = await triggerAutomaticAnalysis({
      supabase: params.supabase,
      conversationId: params.conversationId,
      inboundMessageId: params.inboundMessageId
    });

    if (!analysisResult.ok || !analysisResult.analysis) {
      return;
    }

    const decision = shouldHandoffByAnalysis({
      analysis: analysisResult.analysis,
      persona: params.persona
    });

    await saveDebug({
      supabase: params.supabase,
      eventType: "cande_handoff_decision",
      conversationId: params.conversationId,
      messageId: params.inboundMessageId,
      rawPayload: {
        should_handoff: decision.shouldHandoff,
        score: decision.score,
        threshold: decision.threshold,
        missing_info: decision.missingInfo,
        reason: decision.reason
      }
    });

    if (decision.shouldHandoff) {
      await handoffToSellers({
        supabase: params.supabase,
        conversation: params.conversation,
        conversationId: params.conversationId,
        persona: params.persona,
        analysis: analysisResult.analysis,
        reason: decision.reason || "CANDE detectó que debe intervenir un asesor."
      });

      return;
    }

    const now = getNowIso();
    const analysis = analysisResult.analysis;
    const score = getAnalysisScore(analysis);
    const temperature = getAnalysisTemperature(analysis);
    const summary = getAnalysisSummary(analysis);
    const missingInfo = getAnalysisMissingInfo(analysis);
    const nextAction = getAnalysisNextAction(analysis);

    await params.supabase
      .from("conversations")
      .update({
        customer_ai_score: score,
        customer_ai_temperature: temperature,
        customer_ai_summary: summary,
        customer_ai_missing_info: missingInfo,
        customer_ai_next_action: nextAction,
        updated_at: now,
        metadata: {
          ...readRecord(params.conversation.metadata),
          customer_ai_stage: "CANDE_ATENDIENDO",
          customer_ai_score: score,
          customer_ai_temperature: temperature,
          customer_ai_summary: summary,
          customer_ai_missing_info: missingInfo,
          customer_ai_next_action: nextAction,
          customer_ai_last_analysis_at: now
        }
      })
      .eq("id", params.conversationId);
  } catch (error) {
    await saveDebug({
      supabase: params.supabase,
      eventType: "cande_background_error",
      conversationId: params.conversationId,
      messageId: params.inboundMessageId,
      rawPayload: {
        error: error instanceof Error ? error.message : String(error)
      }
    });
  }
}

function runInBackground(promise: Promise<unknown>) {
  try {
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      EdgeRuntime.waitUntil(promise);
      return;
    }
  } catch {
    // Si EdgeRuntime no está disponible, cae al catch de abajo.
  }

  promise.catch(() => {
    // Evita error no capturado.
  });
}

/* =========================================================
   MAIN
========================================================= */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Método no permitido."
      },
      405
    );
  }

  const supabase = getSupabaseAdmin();

  let replyLockId: string | null = null;
  let conversationIdForError: string | null = null;
  let inboundMessageIdForError: string | null = null;

  try {
    const body = await req.json();

    const conversationId = cleanText(body.conversation_id);
    const inboundMessageId = cleanText(body.inbound_message_id);
    const force = Boolean(body.force);

    conversationIdForError = conversationId || null;
    inboundMessageIdForError = inboundMessageId || null;

    if (!conversationId) {
      return jsonResponse(
        {
          ok: false,
          error: "Falta conversation_id."
        },
        400
      );
    }

    await saveDebug({
      supabase,
      eventType: "cande_request",
      conversationId,
      messageId: inboundMessageId || null,
      rawPayload: body
    });

    const conversationRes = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationRes.error) throw conversationRes.error;

    const conversation = conversationRes.data;

    if (!conversation?.id) {
      return jsonResponse({
        ok: false,
        skipped: true,
        reason: "No se encontró la conversación."
      });
    }

    if (!force && !isConversationAutomatic(conversation)) {
      await saveDebug({
        supabase,
        eventType: "cande_skipped_not_automatic",
        conversationId,
        messageId: inboundMessageId || null,
        rawPayload: {
          customer_ai_enabled: conversation.customer_ai_enabled,
          customer_ai_mode: conversation.customer_ai_mode,
          customer_ai_status: conversation.customer_ai_status,
          customer_ai_handoff_status: conversation.customer_ai_handoff_status
        }
      });

      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "CANDE no está en modo automático."
      });
    }

    const targetInboundMessage = await getTargetInboundMessage({
      supabase,
      conversationId,
      inboundMessageId
    });

    if (!targetInboundMessage?.id) {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "No se encontró mensaje inbound para responder."
      });
    }

    if (targetInboundMessage.direction !== "inbound") {
      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "El mensaje objetivo no es inbound."
      });
    }

    const realInboundMessageId = targetInboundMessage.id as string;
    inboundMessageIdForError = realInboundMessageId;

    if (!force) {
      await saveDebug({
        supabase,
        eventType: "cande_debounce_wait_start",
        conversationId,
        messageId: realInboundMessageId,
        rawPayload: {
          debounce_ms: INBOUND_DEBOUNCE_MS,
          reason: "CANDE espera por si el pasajero envía mensajes partidos."
        }
      });

      await sleep(INBOUND_DEBOUNCE_MS);

      const latestInboundMessage = await getLatestInboundMessage({
        supabase,
        conversationId
      });

      if (
        latestInboundMessage?.id &&
        latestInboundMessage.id !== realInboundMessageId
      ) {
        await saveDebug({
          supabase,
          eventType: "cande_skipped_newer_inbound",
          conversationId,
          messageId: realInboundMessageId,
          rawPayload: {
            reason: "Entró un inbound más nuevo durante el debounce. Esta ejecución vieja no responde.",
            skipped_inbound_message_id: realInboundMessageId,
            latest_inbound_message_id: latestInboundMessage.id,
            latest_inbound_content: latestInboundMessage.content || null,
            latest_inbound_created_at: latestInboundMessage.created_at || null
          }
        });

        return jsonResponse({
          ok: true,
          skipped: true,
          reason: "Entró un mensaje más nuevo. CANDE espera y responde sobre el último.",
          skipped_inbound_message_id: realInboundMessageId,
          latest_inbound_message_id: latestInboundMessage.id
        });
      }

      await saveDebug({
        supabase,
        eventType: "cande_debounce_wait_done",
        conversationId,
        messageId: realInboundMessageId,
        rawPayload: {
          debounce_ms: INBOUND_DEBOUNCE_MS,
          reason: "No entró otro inbound más nuevo. CANDE puede responder."
        }
      });
    }

    const refreshedConversationRes = await supabase
      .from("conversations")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (refreshedConversationRes.error) throw refreshedConversationRes.error;

    const refreshedConversation = refreshedConversationRes.data || conversation;

    const refreshedLastResponseMinutes = minutesSince(
      refreshedConversation.customer_ai_last_response_at
    );

    if (!force && refreshedLastResponseMinutes !== null && refreshedLastResponseMinutes < 1) {
      await saveDebug({
        supabase,
        eventType: "cande_skipped_refreshed_cooldown",
        conversationId,
        messageId: realInboundMessageId,
        rawPayload: {
          last_response_minutes: refreshedLastResponseMinutes,
          reason: "CANDE volvió a leer la conversación después del debounce y detectó respuesta reciente."
        }
      });

      return jsonResponse({
        ok: true,
        skipped: true,
        reason: "CANDE ya respondió recientemente después del debounce."
      });
    }

    if (!force) {
      const lock = await claimInboundReplyLock({
        supabase,
        conversationId,
        inboundMessageId: realInboundMessageId
      });

      if (!lock.claimed) {
        return jsonResponse({
          ok: true,
          skipped: true,
          duplicate: true,
          reason: "CANDE ya está procesando o ya procesó este mensaje."
        });
      }

      replyLockId = lock.lockId;
    }

    if (!force) {
      const duplicate = await alreadyRepliedToInbound({
        supabase,
        conversation: refreshedConversation,
        conversationId,
        inboundMessageId: realInboundMessageId
      });

      if (duplicate) {
        await supabase
          .from("conversations")
          .update({
            customer_ai_last_duplicate_skipped_at: getNowIso(),
            updated_at: getNowIso()
          })
          .eq("id", conversationId);

        await saveDebug({
          supabase,
          eventType: "cande_skipped_duplicate",
          conversationId,
          messageId: realInboundMessageId,
          rawPayload: {
            reason: "CANDE ya respondió a este inbound_message_id."
          }
        });

        await finishInboundReplyLock({
          supabase,
          lockId: replyLockId,
          status: "SKIPPED"
        });

        return jsonResponse({
          ok: true,
          skipped: true,
          duplicate: true,
          reason: "CANDE ya respondió a este mensaje."
        });
      }

      const lastResponseMinutes = minutesSince(refreshedConversation.customer_ai_last_response_at);

      if (lastResponseMinutes !== null && lastResponseMinutes < 1) {
        await saveDebug({
          supabase,
          eventType: "cande_skipped_cooldown",
          conversationId,
          messageId: realInboundMessageId,
          rawPayload: {
            last_response_minutes: lastResponseMinutes
          }
        });

        await finishInboundReplyLock({
          supabase,
          lockId: replyLockId,
          status: "SKIPPED"
        });

        return jsonResponse({
          ok: true,
          skipped: true,
          reason: "Cooldown anti duplicado activo."
        });
      }
    }

    const personaRes = await supabase
      .from("ai_personas")
      .select("*")
      .eq("code", "customer_assistant")
      .maybeSingle();

    if (personaRes.error) throw personaRes.error;

    const persona = personaRes.data || null;

    const messagesRes = await supabase
      .from("messages")
      .select("*")
      .eq("conversation_id", conversationId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(14);

    if (messagesRes.error) throw messagesRes.error;

    const messages = (messagesRes.data || []).reverse();
    const lightFacts = extractLightTravelFacts(messages, refreshedConversation);

    await saveDebug({
      supabase,
      eventType: "cande_light_facts_detected",
      conversationId,
      messageId: realInboundMessageId,
      rawPayload: {
        facts: lightFacts
      }
    });
    const earlyHandoff = shouldEarlyHandoff({
      conversation: refreshedConversation,
      messages,
      targetInboundMessage
    });

if (earlyHandoff.shouldHandoff) {
          const result = await sendEarlyHandoffReply({
        supabase,
        conversation: refreshedConversation,
        conversationId,
        targetInboundMessage,
        persona,
        replyText: earlyHandoff.reply,
        reason: earlyHandoff.reason,
        score: earlyHandoff.score,
        temperature: earlyHandoff.temperature,
        kind: earlyHandoff.kind
      });

      await finishInboundReplyLock({
        supabase,
        lockId: replyLockId,
        status: result.ok ? "DONE" : "ERROR",
        errorMessage: result.error || null
      });

      return jsonResponse({
        ok: result.ok,
        replied: result.ok,
        early_handoff: true,
        handoff_background: false,
        conversation_id: conversationId,
        local_message_id: result.localMessageId,
        inbound_message_id: realInboundMessageId,
        reason: earlyHandoff.reason,
        kind: earlyHandoff.kind,
        score: earlyHandoff.score,
        temperature: earlyHandoff.temperature,
        error: result.error
      });
    }

    const openingClassification = classifyPassengerOpeningMessage(targetInboundMessage.content);

    const replyText = openingClassification.isOpeningOnly
      ? getOpeningReply({
          type: openingClassification.type,
          persona
        })
      : await generateAiReply({
          conversation: refreshedConversation,
          messages,
          persona,
          targetInboundMessage
        });

    if (!replyText) {
      await supabase
        .from("conversations")
        .update({
          customer_ai_last_error: "CANDE no generó respuesta.",
          updated_at: getNowIso()
        })
        .eq("id", conversationId);

      await finishInboundReplyLock({
        supabase,
        lockId: replyLockId,
        status: "ERROR",
        errorMessage: "CANDE no generó respuesta."
      });

      return jsonResponse({
        ok: false,
        error: "CANDE no generó respuesta."
      });
    }

    if (!force) {
      const latestInboundBeforeSend = await getLatestInboundMessage({
        supabase,
        conversationId
      });

      if (
        latestInboundBeforeSend?.id &&
        latestInboundBeforeSend.id !== realInboundMessageId
      ) {
        await saveDebug({
          supabase,
          eventType: "cande_skipped_newer_inbound_before_send",
          conversationId,
          messageId: realInboundMessageId,
          rawPayload: {
            reason: "Entró un inbound más nuevo antes de enviar. CANDE cancela esta respuesta vieja.",
            skipped_inbound_message_id: realInboundMessageId,
            latest_inbound_message_id: latestInboundBeforeSend.id,
            latest_inbound_content: latestInboundBeforeSend.content || null,
            latest_inbound_created_at: latestInboundBeforeSend.created_at || null
          }
        });

        await finishInboundReplyLock({
          supabase,
          lockId: replyLockId,
          status: "SKIPPED"
        });

        return jsonResponse({
          ok: true,
          skipped: true,
          reason: "Entró un mensaje más nuevo antes de enviar. CANDE cancela esta respuesta vieja.",
          skipped_inbound_message_id: realInboundMessageId,
          latest_inbound_message_id: latestInboundBeforeSend.id
        });
      }
    }

    const lastCandeOutbound = await getLastCandeOutbound({
      supabase,
      conversationId
    });

    const replySimilarity = similarityRatio(replyText, lastCandeOutbound?.content);

    if (!force && lastCandeOutbound?.id && replySimilarity >= 0.82) {
      await supabase
        .from("conversations")
        .update({
          customer_ai_last_duplicate_skipped_at: getNowIso(),
          customer_ai_last_replied_to_message_id: realInboundMessageId,
          customer_ai_last_inbound_message_id: realInboundMessageId,
          updated_at: getNowIso()
        })
        .eq("id", conversationId);

      await saveDebug({
        supabase,
        eventType: "cande_skipped_similar_reply",
        conversationId,
        messageId: realInboundMessageId,
        rawPayload: {
          similarity: replySimilarity,
          reply: replyText,
          previous_reply: lastCandeOutbound?.content || null
        }
      });

      await finishInboundReplyLock({
        supabase,
        lockId: replyLockId,
        status: "SKIPPED"
      });

      return jsonResponse({
        ok: true,
        skipped: true,
        duplicate: true,
        reason: "CANDE evitó enviar una respuesta muy parecida a la anterior."
      });
    }

    const now = getNowIso();
    const phone = normalizePhoneToPlus(refreshedConversation.telefono);
    const senderName = persona?.display_name || "Cande · Asistente de Pasajeros";

    const insertMessageRes = await supabase
      .from("messages")
      .insert({
        conversation_id: conversationId,
        channel: "whatsapp",
        direction: "outbound",
        sender_type: "agent",
        sender_id: null,
        sender_name: senderName,
        content: replyText,
        message_type: "text",
        status: "pending",
        is_internal: false,
        metadata: {
          source: "customer-assistant-reply",
          ai_persona_code: "customer_assistant",
          ai_persona_name: "CANDE",
          ai_persona_id: persona?.id || null,
          inbound_message_id: realInboundMessageId,
          inbound_whatsapp_message_id: targetInboundMessage.whatsapp_message_id || null,
          automatic: true,
          opening_reply: openingClassification.isOpeningOnly,
          opening_type: openingClassification.type
        },
        created_at: now,
        created_by: null
      })
      .select("id")
      .single();

    if (insertMessageRes.error) throw insertMessageRes.error;

    const localMessageId = insertMessageRes.data.id;

    await supabase
      .from("conversations")
      .update({
        last_message: replyText,
        last_message_time: now,
        last_outbound_message_at: now,
        customer_ai_status: "RESPONDIENDO",
        customer_ai_last_response_at: now,
        customer_ai_last_replied_to_message_id: realInboundMessageId,
        customer_ai_last_inbound_message_id: realInboundMessageId,
        customer_ai_last_inbound_at: targetInboundMessage.created_at || now,
        customer_ai_last_error: null,
        customer_ai_auto_reply_count: Number(refreshedConversation.customer_ai_auto_reply_count || 0) + 1,
        estado_gestion: "EN_ATENCION_IA",
        updated_at: now,
        metadata: {
          ...readRecord(refreshedConversation.metadata),
          customer_ai_stage: "CANDE_ATENDIENDO",
          customer_ai_last_reply_source: "customer-assistant-reply",
          customer_ai_last_reply_at: now
        }
      })
      .eq("id", conversationId);

    if (!phone) {
      await supabase
        .from("messages")
        .update({
          status: "failed",
          wa_error_code: "missing_phone",
          wa_error_message: "La conversación no tiene teléfono."
        })
        .eq("id", localMessageId);

      await finishInboundReplyLock({
        supabase,
        lockId: replyLockId,
        status: "ERROR",
        errorMessage: "La conversación no tiene teléfono."
      });

      return jsonResponse({
        ok: false,
        error: "La conversación no tiene teléfono.",
        local_message_id: localMessageId
      });
    }

    const sendRes = await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        conversation_id: conversationId,
        local_message_id: localMessageId,
        to: phone,
        content: replyText,
        text: replyText,
        message_type: "text",
        source: "customer-assistant-reply"
      }
    });

    if (sendRes.error) {
      const sendErrorMessage = sendRes.error.message || "No se pudo enviar WhatsApp.";

      await supabase
        .from("messages")
        .update({
          status: "failed",
          wa_error_message: sendErrorMessage
        })
        .eq("id", localMessageId);

      await supabase
        .from("conversations")
        .update({
          customer_ai_last_error: sendErrorMessage,
          updated_at: getNowIso()
        })
        .eq("id", conversationId);

      await finishInboundReplyLock({
        supabase,
        lockId: replyLockId,
        status: "ERROR",
        errorMessage: sendErrorMessage
      });

      return jsonResponse({
        ok: false,
        error: sendErrorMessage,
        local_message_id: localMessageId
      });
    }

    await saveDebug({
      supabase,
      eventType: "cande_replied",
      conversationId,
      messageId: realInboundMessageId,
      rawPayload: {
        local_message_id: localMessageId,
        reply: replyText,
        send_response: sendRes.data || null
      }
    });

    await finishInboundReplyLock({
      supabase,
      lockId: replyLockId,
      status: "DONE"
    });

    runInBackground(
      runPostReplyBackground({
        supabase,
        conversation: refreshedConversation,
        conversationId,
        inboundMessageId: realInboundMessageId,
        persona
      })
    );

    return jsonResponse({
      ok: true,
      replied: true,
      conversation_id: conversationId,
      local_message_id: localMessageId,
      inbound_message_id: realInboundMessageId,
      reply: replyText,
      analysis_background: true,
      handoff_background: true
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    try {
      if (replyLockId) {
        await finishInboundReplyLock({
          supabase,
          lockId: replyLockId,
          status: "ERROR",
          errorMessage: message
        });
      }

      await saveDebug({
        supabase,
        eventType: "cande_exception",
        conversationId: conversationIdForError,
        messageId: inboundMessageIdForError,
        rawPayload: {
          error: message
        }
      });
    } catch {
      // Evita error secundario.
    }

    return jsonResponse(
      {
        ok: false,
        error: message
      },
      200
    );
  }
});
