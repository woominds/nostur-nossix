// supabase/functions/parse-vuelos/index.ts

/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ParseVuelosRequest = {
  text?: string;
  presupuesto_id?: string;
  contexto?: {
    fecha_salida?: string | null;
    fecha_regreso?: string | null;
    origen?: string | null;
    destino?: string | null;
  };
};

const systemPrompt = `
Sos un parser experto de itinerarios aéreos turísticos en español.

Vas a recibir texto crudo copiado de:
- ALMUNDO
- Copa Airlines
- Amadeus
- Sabre
- GDS
- mails de aerolíneas
- cotizaciones turísticas
- textos con formato desordenado

Tu única tarea es transformar ese texto en JSON estructurado.

IMPORTANTE:
Devolvé EXCLUSIVAMENTE JSON válido.
No uses markdown.
No uses comillas triples.
No expliques nada fuera del JSON.
No inventes datos que no estén en el texto.

ESQUEMA OBLIGATORIO:

{
  "tipo": "ida_vuelta" | "solo_ida" | "multidestino",
  "pasajeros": {
    "adultos": number,
    "ninos": number,
    "infantes": number
  } | null,
  "tramos": [
    {
      "direccion": "ida" | "vuelta",
      "indice": number,
      "aerolinea": string | null,
      "codigo_aerolinea": string | null,
      "numero_vuelo": string | null,
      "clase": string | null,
      "fecha_salida": string | null,
      "hora_salida": string | null,
      "origen": {
        "iata": string | null,
        "ciudad": string | null,
        "aeropuerto": string | null,
        "terminal": string | null
      },
      "fecha_llegada": string | null,
      "hora_llegada": string | null,
      "destino": {
        "iata": string | null,
        "ciudad": string | null,
        "aeropuerto": string | null,
        "terminal": string | null
      },
      "duracion": string | null,
      "equipaje": string | null,
      "escala_posterior": {
        "ciudad": string | null,
        "iata": string | null,
        "espera": string | null
      } | null
    }
  ],
  "precio": {
    "moneda": string | null,
    "por_pasajero": number | null,
    "total": number | null,
    "impuestos_incluidos": boolean | null
  } | null,
  "observaciones": string | null
}

REGLAS ESTRICTAS:

1. Cada segmento real de vuelo debe ser un tramo.
2. Una ida con escala debe tener varios tramos con direccion="ida".
3. Una vuelta con escala debe tener varios tramos con direccion="vuelta".
4. Si aparece "Ida", "Salida", "Outbound", "Vuelo de ida", esos tramos son ida.
5. Si aparece "Vuelta", "Regreso", "Return", "Inbound", esos tramos son vuelta.
6. Si el texto mezcla ida y vuelta, separalos correctamente.
7. Normalizá fechas a YYYY-MM-DD.
8. Normalizá horas a HH:mm.
9. Si la llegada dice +1 o llega al día siguiente, ajustá fecha_llegada si es claro.
10. Normalizá duración como "9h 38m", "1h 02m", "10h 00m".
11. numero_vuelo debe conservar código de aerolínea, por ejemplo "CM 789", "AR 1545", "G3 7617".
12. codigo_aerolinea debe ser "CM", "AR", "G3", "LA", "JA", etc. si aparece.
13. aerolinea debe ser nombre comercial si aparece.
14. Si aparece "Copa" o código "CM", usá "Copa Airlines".
15. Si aparece "AR", usá "Aerolíneas Argentinas" si el texto lo permite.
16. Si aparece "G3" o "GOL", usá "GOL".
17. Si aparece "JA" o "JetSMART", usá "JetSMART".
18. No inventes IATA, horarios, fechas ni vuelos.
19. PROHIBIDO meter texto crudo largo dentro de origen, destino, duración, escala o aerolínea.
20. Si un campo no está claro, usá null.
21. Si hay equipaje general, repetilo en cada tramo.
22. escala_posterior corresponde a la espera después de ese tramo, antes del siguiente tramo de la misma dirección.
23. El último tramo de ida y el último tramo de vuelta deben tener escala_posterior=null.
24. Si no detectás vuelos, devolvé tramos=[] y observaciones="No se detectaron vuelos en el texto."

CÓMO INTERPRETAR TEXTOS TÍPICOS:

Ejemplo de texto posible:
"Córdoba (COR) 10/07/2026 03:15 Panamá (PTY) 10/07/2026 09:05 CM 101 duración 6h 50m escala 2h 48m Panamá. Panamá (PTY) 10/07/2026 11:53 Aruba (AUA) 10/07/2026 14:53 CM 348 duración 2h 00m"

Debe devolver dos tramos de ida:
- COR → PTY con horario, vuelo, duración y escala_posterior Panamá/PT Y 2h 48m
- PTY → AUA con horario, vuelo, duración y escala_posterior null

Ejemplo:
"Oranjestad (AUA) 18/07/2026 13:20 Panamá (PTY) 18/07/2026 15:25 CM 349 duración 2h 05m escala 1h 30m Panamá. Panamá (PTY) 18/07/2026 16:55 Córdoba (COR) 19/07/2026 01:20 CM 100 duración 6h 25m"

Debe devolver dos tramos de vuelta:
- AUA → PTY
- PTY → COR

Si un texto dice "Tiempo de vuelo total", ese dato es duración total del itinerario, no necesariamente duración de cada tramo.
Si un texto dice "Escala en Panamá 2h 48m", eso va en escala_posterior del tramo anterior.
`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function stripJsonFence(text: string): string {
  return text
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function extractJsonObject(text: string): string {
  const cleaned = stripJsonFence(text);
  const first = cleaned.indexOf("{");
  const last = cleaned.lastIndexOf("}");

  if (first >= 0 && last > first) {
    return cleaned.slice(first, last + 1);
  }

  return cleaned;
}

function cleanString(value: unknown): string {
  return String(value ?? "").trim();
}

function normalizeDirection(value: unknown): "ida" | "vuelta" | null {
  const text = cleanString(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (
    text.includes("vuelta") ||
    text.includes("regreso") ||
    text.includes("return") ||
    text.includes("inbound")
  ) {
    return "vuelta";
  }

  if (
    text.includes("ida") ||
    text.includes("salida") ||
    text.includes("outbound")
  ) {
    return "ida";
  }

  return null;
}

function normalizeAirlineName(value: unknown, code?: string | null): string | null {
  const text = cleanString(value);
  const upperCode = cleanString(code).toUpperCase();

  if (/copa/i.test(text) || upperCode === "CM") return "Copa Airlines";
  if (/aerol/i.test(text) || upperCode === "AR") return "Aerolíneas Argentinas";
  if (/gol/i.test(text) || upperCode === "G3") return "GOL";
  if (/jetsmart|jet smart/i.test(text) || upperCode === "JA") return "JetSMART";
  if (/latam/i.test(text) || upperCode === "LA") return "LATAM";
  if (/avianca/i.test(text) || upperCode === "AV") return "Avianca";
  if (/iberia/i.test(text) || upperCode === "IB") return "Iberia";
  if (/air europa/i.test(text) || upperCode === "UX") return "Air Europa";
  if (/american/i.test(text) || upperCode === "AA") return "American Airlines";
  if (/delta/i.test(text) || upperCode === "DL") return "Delta";
  if (/united/i.test(text) || upperCode === "UA") return "United";

  return text || null;
}

function normalizeDate(value: unknown): string | null {
  const text = cleanString(value);

  if (!text) return null;

  const iso = text.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const slash = text.match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})\b/);
  if (slash) {
    const day = slash[1].padStart(2, "0");
    const month = slash[2].padStart(2, "0");
    const rawYear = slash[3];
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;

    return `${year}-${month}-${day}`;
  }

  return null;
}

function normalizeTime(value: unknown): string | null {
  const text = cleanString(value);
  const match = text.match(/\b(\d{1,2})[:h](\d{2})\b/);

  if (!match) return null;

  return `${match[1].padStart(2, "0")}:${match[2]}`;
}

function normalizeDuration(value: unknown): string | null {
  const text = cleanString(value);

  if (!text) return null;

  const already = text.match(/\b(\d{1,2})\s*h\s*(\d{1,2})\s*m\b/i);
  if (already) {
    return `${Number(already[1])}h ${String(Number(already[2])).padStart(2, "0")}m`;
  }

  const hoursMinutes = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (hoursMinutes) {
    return `${Number(hoursMinutes[1])}h ${hoursMinutes[2]}m`;
  }

  const hoursOnly = text.match(/\b(\d{1,2})\s*h\b/i);
  if (hoursOnly) {
    return `${Number(hoursOnly[1])}h 00m`;
  }

  return text;
}

function normalizeAirport(value: any) {
  const airport = value && typeof value === "object" && !Array.isArray(value) ? value : {};

  return {
    iata: cleanString(airport.iata).toUpperCase() || null,
    ciudad: cleanString(airport.ciudad) || null,
    aeropuerto: cleanString(airport.aeropuerto) || null,
    terminal: cleanString(airport.terminal) || null
  };
}

function normalizeTramo(raw: any, index: number, fallbackDirection: "ida" | "vuelta" | null) {
  const codeRaw =
    cleanString(raw.codigo_aerolinea) ||
    cleanString(raw.numero_vuelo).match(/^([A-Z0-9]{2})\s?\d+/i)?.[1] ||
    null;

  const codigo = codeRaw ? cleanString(codeRaw).toUpperCase() : null;

  const numeroVueloRaw = cleanString(raw.numero_vuelo);
  const numeroVuelo =
    numeroVueloRaw
      ? numeroVueloRaw.replace(/^([A-Z0-9]{2})\s?(\d+)/i, (_m: string, c: string, n: string) => `${c.toUpperCase()} ${n}`)
      : null;

  const direction = normalizeDirection(raw.direccion) || fallbackDirection || "ida";

  const escala =
    raw.escala_posterior && typeof raw.escala_posterior === "object" && !Array.isArray(raw.escala_posterior)
      ? {
          ciudad: cleanString(raw.escala_posterior.ciudad) || null,
          iata: cleanString(raw.escala_posterior.iata).toUpperCase() || null,
          espera: normalizeDuration(raw.escala_posterior.espera) || cleanString(raw.escala_posterior.espera) || null
        }
      : null;

  return {
    direccion: direction,
    indice: Number.isFinite(Number(raw.indice)) ? Number(raw.indice) : index + 1,
    aerolinea: normalizeAirlineName(raw.aerolinea, codigo),
    codigo_aerolinea: codigo,
    numero_vuelo: numeroVuelo,
    clase: cleanString(raw.clase) || null,
    fecha_salida: normalizeDate(raw.fecha_salida),
    hora_salida: normalizeTime(raw.hora_salida),
    origen: normalizeAirport(raw.origen),
    fecha_llegada: normalizeDate(raw.fecha_llegada),
    hora_llegada: normalizeTime(raw.hora_llegada),
    destino: normalizeAirport(raw.destino),
    duracion: normalizeDuration(raw.duracion),
    equipaje: cleanString(raw.equipaje) || null,
    escala_posterior: escala
  };
}

function normalizeParsed(parsed: any) {
  const rawTramos = Array.isArray(parsed?.tramos) ? parsed.tramos : [];

  let currentDirection: "ida" | "vuelta" | null = null;

  const tramos = rawTramos.map((item: any, index: number) => {
    const detectedDirection = normalizeDirection(item?.direccion);

    if (detectedDirection) {
      currentDirection = detectedDirection;
    }

    return normalizeTramo(item || {}, index, currentDirection);
  });

  const hasVuelta = tramos.some((item: any) => item.direccion === "vuelta");
  const hasIda = tramos.some((item: any) => item.direccion === "ida");

  return {
    tipo: parsed?.tipo || (hasIda && hasVuelta ? "ida_vuelta" : "solo_ida"),
    pasajeros: parsed?.pasajeros || null,
    tramos,
    precio: parsed?.precio || null,
    observaciones:
      parsed?.observaciones ||
      (tramos.length ? null : "No se detectaron vuelos en el texto.")
  };
}

async function callOpenAi(apiKey: string, text: string, contexto: ParseVuelosRequest["contexto"]) {
  const userText = contexto
    ? `CONTEXTO SOLO PARA DESAMBIGUAR. NO INVENTAR DATOS QUE NO ESTÉN EN EL TEXTO:
${JSON.stringify(contexto, null, 2)}

TEXTO COMPLETO DEL ITINERARIO:
${text}`
    : `TEXTO COMPLETO DEL ITINERARIO:
${text}`;

  return await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text: systemPrompt
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: userText
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      },
      temperature: 0,
      max_output_tokens: 9000
    })
  });
}

function extractOutputText(openaiData: any): string {
  if (typeof openaiData?.output_text === "string") {
    return openaiData.output_text;
  }

  if (Array.isArray(openaiData?.output)) {
    for (const item of openaiData.output) {
      if (Array.isArray(item?.content)) {
        for (const content of item.content) {
          if (typeof content?.text === "string") return content.text;
        }
      }
    }
  }

  return "";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Método no permitido." }, 405);
  }

  try {
    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse(
        {
          error: "Falta configurar OPENAI_API_KEY en Supabase Secrets."
        },
        500
      );
    }

    const body = (await req.json()) as ParseVuelosRequest;
    const text = cleanString(body.text);

    if (text.length < 10) {
      return jsonResponse(
        {
          error: "El texto de vuelos está vacío o es demasiado corto."
        },
        400
      );
    }

    const openaiRes = await callOpenAi(apiKey, text, body.contexto || null);

    if (!openaiRes.ok) {
      const detail = await openaiRes.text();

      return jsonResponse(
        {
          error: "OpenAI no pudo parsear los vuelos.",
          status: openaiRes.status,
          detail
        },
        500
      );
    }

    const openaiData = await openaiRes.json();
    const outputText = extractOutputText(openaiData);

    if (!outputText) {
      return jsonResponse(
        {
          error: "OpenAI respondió vacío.",
          detail: openaiData
        },
        500
      );
    }

    try {
      const jsonText = extractJsonObject(outputText);
      const parsed = normalizeParsed(JSON.parse(jsonText));

      return jsonResponse({
        ok: true,
        success: true,
        data: parsed
      });
    } catch {
      return jsonResponse(
        {
          error: "La IA no devolvió JSON válido.",
          raw: outputText
        },
        502
      );
    }
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Error inesperado en parse-vuelos."
      },
      500
    );
  }
});