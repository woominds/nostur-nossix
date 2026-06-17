// supabase/functions/presupuestos-ai-parser/index.ts

/// <reference lib="deno.ns" />

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type ParserEntidadTipo =
  | "PRESUPUESTO"
  | "VUELO"
  | "HOTEL"
  | "SERVICIO"
  | "COMBINACION";

type ParserRequest = {
  mode?: "TEXT" | "FILE";

  text?: string;
  presupuesto_text?: string;

  adjunto_id?: string;
  file_url?: string;
  file_mime_type?: string | null;

  entidad_tipo?: ParserEntidadTipo;
  titulo?: string | null;

  caratula?: {
    cliente_nombre?: string | null;
    destino_principal?: string | null;
    destino_detalle?: string | null;
    fecha_salida?: string | null;
    fecha_regreso?: string | null;
    adultos?: number | null;
    menores?: number | null;
    edades_menores?: string | null;
  } | null;
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

function normalizeCurrency(value: unknown): string {
  const raw = String(value || "").trim().toUpperCase();

  if (["USD", "ARS", "EUR", "BRL", "UYU", "OTRA"].includes(raw)) return raw;

  if (raw.includes("DOLAR") || raw.includes("DÓLAR") || raw.includes("U$D") || raw.includes("US$")) {
    return "USD";
  }

  if (raw.includes("REAL") || raw.includes("BRL") || raw.includes("R$")) {
    return "BRL";
  }

  if (raw.includes("EURO") || raw.includes("EUR") || raw.includes("€")) {
    return "EUR";
  }

  if (raw.includes("$") || raw.includes("PESO") || raw.includes("ARS")) {
    return "ARS";
  }

  return "USD";
}

function getBaseJsonExample() {
  return `
{
  "tipo": "PRESUPUESTO",
  "confianza": 0.0,
  "resumen_humano": {
    "titulo": "",
    "descripcion": "",
    "vuelos_detectados": 0,
    "hoteles_detectados": 0,
    "servicios_detectados": 0,
    "opciones_detectadas": 0,
    "precio_final_detectado": "",
    "advertencias": []
  },
  "caratula_no_modificar": true,
  "vuelos": [
    {
      "titulo": "Vuelo Ida - Córdoba a Oranjestad",
      "tipo_tramo": "IDA",
      "aerolinea": "Copa Airlines",
      "codigo_reserva": "",
      "ruta_resumen": "Córdoba (COR) → Panamá (PTY) → Oranjestad (AUA)",
      "ida_origen": "Córdoba (COR)",
      "ida_destino": "Oranjestad (AUA)",
      "ida_fecha": "2026-07-10",
      "ida_hora_salida": "03:33",
      "ida_hora_llegada": "12:11",
      "ida_escalas": "Escala en Panamá (PTY). Duración de escala: 1h 02m.",
      "ida_detalle": "Tramo 1: CM 789 · Copa Airlines · 10/07/2026 · 03:33 COR Córdoba → 08:10 PTY Panamá · Duración 6h 37m.\\nEscala en Panamá (PTY): 1h 02m.\\nTramo 2: CM 348 · Copa Airlines · 10/07/2026 · 09:12 PTY Panamá → 12:11 AUA Oranjestad · Duración 1h 59m.",
      "vuelta_origen": "",
      "vuelta_destino": "",
      "vuelta_fecha": "",
      "vuelta_hora_salida": "",
      "vuelta_hora_llegada": "",
      "vuelta_escalas": "",
      "vuelta_detalle": "",
      "equipaje": "Bolso de mano + Carry on + Equipaje despachado con costo",
      "tarifa_familia": "",
      "condiciones": "",
      "precio_total": null,
      "moneda": "USD",
      "incluir_en_pdf": true,
      "mostrar_precio_en_pdf": false,
      "metadata": {
        "origen": "PRESUPUESTO_IA",
        "tipo_tramo": "IDA",
        "seleccion_asientos": "Sujeta a disponibilidad y condiciones de la tarifa.",
        "tramos": [
          {
            "direccion": "ida",
            "indice": 1,
            "aerolinea": "Copa Airlines",
            "codigo_aerolinea": "CM",
            "numero_vuelo": "CM 789",
            "clase": "",
            "fecha_salida": "2026-07-10",
            "hora_salida": "03:33",
            "origen": {
              "iata": "COR",
              "ciudad": "Córdoba",
              "aeropuerto": "",
              "terminal": ""
            },
            "fecha_llegada": "2026-07-10",
            "hora_llegada": "08:10",
            "destino": {
              "iata": "PTY",
              "ciudad": "Panamá",
              "aeropuerto": "",
              "terminal": ""
            },
            "duracion": "6h 37m",
            "equipaje": "Bolso de mano + Carry on + Equipaje despachado con costo",
            "escala_posterior": {
              "ciudad": "Panamá",
              "iata": "PTY",
              "espera": "1h 02m"
            }
          }
        ],
        "escalas": [
          {
            "ciudad": "Panamá",
            "iata": "PTY",
            "duracion": "1h 02m",
            "observacion": ""
          }
        ]
      }
    }
  ],
  "hoteles": [
    {
      "titulo": "Radisson Blu Aruba",
      "nombre": "Radisson Blu Aruba",
      "destino": "Aruba",
      "zona": "J.E. Irausquin Boulevard 97-A, Aruba",
      "categoria": "",
      "regimen": "",
      "habitacion": "",
      "ocupacion": "",
      "check_in": "",
      "check_out": "",
      "descripcion": "",
      "beneficios": "",
      "condiciones": "",
      "politica_cancelacion": "",
      "precio_total": null,
      "moneda": "USD",
      "incluir_en_pdf": true,
      "mostrar_precio_en_pdf": false,
      "metadata": {
        "origen": "PRESUPUESTO_IA",
        "direccion_original": "J.E. Irausquin Boulevard 97-A, Aruba"
      }
    }
  ],
  "servicios": [
    {
      "tipo": "TRASLADO",
      "nombre": "Traslados",
      "descripcion": "Traslados incluidos según detalle del proveedor.",
      "incluido": true,
      "opcional": false,
      "precio_total": null,
      "moneda": "USD",
      "incluir_en_pdf": true,
      "mostrar_precio_en_pdf": false,
      "metadata": {
        "origen": "PRESUPUESTO_IA"
      }
    },
    {
      "tipo": "ASISTENCIA",
      "nombre": "Asistencia al viajero",
      "descripcion": "Asistencia incluida según detalle del proveedor.",
      "incluido": true,
      "opcional": false,
      "precio_total": null,
      "moneda": "USD",
      "incluir_en_pdf": true,
      "mostrar_precio_en_pdf": false,
      "metadata": {
        "origen": "PRESUPUESTO_IA"
      }
    }
  ],
  "opciones_comerciales": [
    {
      "nombre": "Opción 1",
      "subtitulo": "Paquete completo",
      "descripcion": "Precio final para todos los pasajeros.",
      "precio_total": 6435,
      "moneda": "USD",
      "forma_pago_resumen": "",
      "condiciones_pago": "",
      "incluye_resumen": "Vuelos, alojamiento y servicios indicados.",
      "no_incluye_resumen": "Gastos personales y todo servicio no especificado.",
      "notas": "",
      "visible_en_pdf": true,
      "destacada": true,
      "metadata": {
        "origen": "PRESUPUESTO_IA",
        "precio_es_total_paquete": true
      }
    }
  ],
  "incluye_general": "",
  "no_incluye_general": "",
  "condiciones_generales": "",
  "observaciones": []
}
`;
}

function getTextPresupuestoPrompt(caratula: ParserRequest["caratula"]) {
  const caratulaContext = caratula
    ? `
CARÁTULA YA CARGADA EN EL SISTEMA.
IMPORTANTE: NO MODIFICAR LA CARÁTULA. SOLO USAR COMO CONTEXTO.
Cliente: ${caratula.cliente_nombre || ""}
Destino principal: ${caratula.destino_principal || ""}
Detalle destino: ${caratula.destino_detalle || ""}
Fecha salida: ${caratula.fecha_salida || ""}
Fecha regreso: ${caratula.fecha_regreso || ""}
Adultos: ${caratula.adultos ?? ""}
Menores: ${caratula.menores ?? ""}
Edades menores: ${caratula.edades_menores || ""}
`
    : "";

  return `
Sos un parser experto de presupuestos turísticos para una agencia de viajes emisiva.

RECIBÍS TEXTO COMPLETO PEGADO POR UN VENDEDOR.
Ese texto puede tener, en este orden o mezclado:
- vuelos de ida
- vuelos de vuelta
- hotel
- régimen
- habitación
- traslados
- asistencia
- excursiones
- servicios adicionales
- equipaje
- condiciones
- precio final
- forma de pago
- incluye
- no incluye

REGLA ABSOLUTA:
Debés analizar TODO EL TEXTO HASTA EL FINAL.
No te detengas después de detectar vuelos.
Aunque encuentres vuelos perfectos, igualmente debés seguir buscando hoteles, servicios y precio.
Si existe una sección de hotel, alojamiento, régimen, habitación o estadía, debe crear al menos un objeto en hoteles.
Si existe una sección de traslados, asistencia, excursiones, equipaje adicional, seguro o servicios, debe crear objetos en servicios.
Si existe precio final, total, tarifa, valor paquete, precio por pasajeros o importe, debe crear opciones_comerciales.

DEVOLUCIÓN:
Devolvé SOLO JSON válido.
No uses markdown.
No expliques fuera del JSON.
No incluyas comentarios.
No inventes datos.
Si un dato no está claro, dejalo vacío o null.

${caratulaContext}

IMPORTANTE SOBRE LA CARÁTULA:
- NO completes ni modifiques cliente.
- NO completes ni modifiques teléfono.
- NO completes ni modifiques email.
- NO cambies fechas de carátula.
- NO cambies pasajeros.
- Si el texto contradice la carátula, agregalo como advertencia en resumen_humano.advertencias.

VUELOS:
- Separá IDA y VUELTA como vuelos distintos.
- Si el texto tiene ida y vuelta, el array vuelos debe tener mínimo 2 objetos.
- Cada vuelo debe tener tipo_tramo: "IDA" o "VUELTA".
- Cada vuelo debe tener título claro.
- Completá aerolínea, número de vuelo, ruta, fecha, horario de salida, horario de llegada, duración y escala si aparecen.
- metadata.tramos debe contener cada tramo real.
- En metadata.tramos usá esta estructura:
  {
    "direccion": "ida" | "vuelta",
    "indice": number,
    "aerolinea": string,
    "codigo_aerolinea": string,
    "numero_vuelo": string,
    "clase": string,
    "fecha_salida": "YYYY-MM-DD",
    "hora_salida": "HH:mm",
    "origen": { "iata": string, "ciudad": string, "aeropuerto": string, "terminal": string },
    "fecha_llegada": "YYYY-MM-DD",
    "hora_llegada": "HH:mm",
    "destino": { "iata": string, "ciudad": string, "aeropuerto": string, "terminal": string },
    "duracion": string,
    "equipaje": string,
    "escala_posterior": { "ciudad": string, "iata": string, "espera": string } | null
  }
- El último tramo de ida debe tener escala_posterior=null.
- El último tramo de vuelta debe tener escala_posterior=null.
- Si hay escala entre dos tramos de la misma dirección, calculá o copiá el tiempo de espera si aparece.
- No inventes horarios ni números de vuelo.
- Si aparece "Copa", usar "Copa Airlines".
- Si aparece CM 789, número de vuelo debe ser "CM 789".
- Si aparece CM789, número de vuelo debe ser "CM 789".
- Equipaje debe copiarse comercialmente.
- Si no aparece selección de asientos, metadata.seleccion_asientos debe decir: "Sujeta a disponibilidad y condiciones de la tarifa."
- mostrar_precio_en_pdf debe ser false salvo que el precio de aéreo deba mostrarse por separado.

HOTELES:
- Crear un hotel por cada hotel detectado.
- Palabras que indican hotel: hotel, alojamiento, hospedaje, estadía, habitacion, habitación, régimen, regimen, all inclusive, desayuno.
- nombre debe ser el nombre comercial exacto del hotel.
- zona puede contener zona o dirección.
- metadata.direccion_original debe guardar dirección si aparece.
- regimen debe guardar desayuno, media pensión, all inclusive, solo alojamiento, etc.
- habitacion debe guardar tipo de habitación.
- check_in/check_out solo si aparecen claramente en el texto.
- No inventar descripción. Si no hay descripción, dejar vacío.
- incluir_en_pdf=true.
- mostrar_precio_en_pdf=false por defecto.

SERVICIOS:
Tipos válidos:
TRASLADO, ASISTENCIA, EXCURSION, EQUIPAJE, SEGURO, CIRCUITO, AUTO, OTRO.
- Asistencia al viajero va como ASISTENCIA.
- Traslados van como TRASLADO.
- Excursiones van como EXCURSION.
- Equipaje adicional va como EQUIPAJE.
- Seguro va como SEGURO.
- Circuito o paquete terrestre va como CIRCUITO.
- Servicios incluidos deben tener incluido=true.
- incluir_en_pdf=true.
- mostrar_precio_en_pdf=false por defecto.

PRECIOS / OPCIONES COMERCIALES:
- El precio final del paquete debe ir en opciones_comerciales.
- precio_total representa el valor TOTAL DEL PAQUETE para todos los pasajeros.
- Si detectás "PRECIO POR LOS DOS PASAJEROS USD 6435", entonces precio_total=6435 y moneda="USD".
- Si detectás "Total paquete", "Precio final", "Tarifa final", "Valor total", "Total por pasajeros", crear opción comercial.
- No uses separador de miles en números.
- Si no está claro si un precio es total o por pasajero, agregalo en notas y advertencia.
- Por defecto visible_en_pdf=true.
- La primera opción debe destacada=true.

INCLUYE / NO INCLUYE:
- incluye_general debe contener lo incluido general si aparece.
- no_incluye_general debe contener lo no incluido si aparece.
- condiciones_generales debe contener condiciones generales, disponibilidad, vencimientos, políticas o aclaraciones.
- En opciones_comerciales también repetir incluye_resumen y no_incluye_resumen si corresponden.

RESUMEN HUMANO:
- Debe indicar qué detectaste.
- Si el texto parece tener hotel pero no pudiste identificar nombre, agregá advertencia.
- Si el texto parece tener vuelta pero no pudiste separarla, agregá advertencia.
- Si el texto parece tener precio pero no pudiste interpretarlo, agregá advertencia.

ESTRUCTURA OBLIGATORIA:
${getBaseJsonExample()}

REGLAS DE NORMALIZACIÓN:
- precio_total debe ser número o null.
- No uses strings para precio_total.
- Monedas válidas: USD, ARS, EUR, BRL, UYU, OTRA.
- Fechas: YYYY-MM-DD si son claras.
- Horas: HH:mm si son claras.
- Si un dato no existe, usar "" o null según corresponda.
- Arrays vacíos si no hay datos.
- confianza entre 0 y 1.
`;
}

function getImagePrompt(entidadTipo: ParserEntidadTipo) {
  if (entidadTipo === "VUELO") {
    return `
Analizá esta captura de una cotización aérea.

Devolvé SOLO JSON válido.
No uses markdown.
No inventes datos.

Estructura obligatoria:
${getBaseJsonExample()}

Reglas:
- Devolver solo vuelos.
- Separá IDA y VUELTA como vuelos distintos si aparecen ambos.
- Cargar aerolínea, números de vuelo, ruta_resumen, fechas, horarios, escalas, duración, equipaje y metadata.tramos.
- metadata.tramos debe contener cada tramo real.
- Si hay equipaje, colocarlo en equipaje.
- Si hay precio final de paquete, crear opción comercial.
- Si solo aparece precio aéreo y no queda claro que debe mostrarse al pasajero, dejar precio_total null.
`;
  }

  if (entidadTipo === "HOTEL") {
    return `
Analizá esta captura o imagen de hotelería.

Devolvé SOLO JSON válido.
No uses markdown.
No inventes datos.

Estructura obligatoria:
${getBaseJsonExample()}

Reglas:
- Devolver solo hoteles.
- nombre debe ser el nombre comercial del hotel.
- zona puede contener ubicación o dirección.
- metadata.direccion_original debe guardar la dirección si aparece.
- Detectar régimen, habitación, check-in, check-out y noches si aparecen.
- No inventar descripción.
`;
  }

  return getTextPresupuestoPrompt(null);
}

function extractOutputText(openaiData: any): string {
  if (typeof openaiData?.output_text === "string") {
    return openaiData.output_text;
  }

  const output = openaiData?.output;

  if (Array.isArray(output)) {
    for (const item of output) {
      const content = item?.content;

      if (Array.isArray(content)) {
        for (const contentItem of content) {
          if (typeof contentItem?.text === "string") {
            return contentItem.text;
          }

          if (typeof contentItem?.content === "string") {
            return contentItem.content;
          }
        }
      }
    }
  }

  const choices = openaiData?.choices;

  if (Array.isArray(choices)) {
    const first = choices[0];
    const content = first?.message?.content;

    if (typeof content === "string") return content;
  }

  return "";
}

function isImageMimeType(mimeType?: string | null): boolean {
  if (!mimeType) return true;
  return mimeType.startsWith("image/");
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

  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return cleaned.slice(firstBrace, lastBrace + 1);
  }

  return cleaned;
}

function safeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const raw = String(value)
    .replace(/\s/g, "")
    .replace(/USD/gi, "")
    .replace(/ARS/gi, "")
    .replace(/EUR/gi, "")
    .replace(/BRL/gi, "")
    .replace(/UYU/gi, "")
    .replace(/U\$D/gi, "")
    .replace(/US\$/gi, "")
    .replace(/\$/g, "")
    .trim();

  if (!raw) return null;

  let normalized = raw;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    const lastComma = raw.lastIndexOf(",");
    const lastDot = raw.lastIndexOf(".");

    if (lastComma > lastDot) {
      normalized = raw.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = raw.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = raw.replace(/\./g, "").replace(",", ".");
  }

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : null;
}

function asArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return String(value || "").trim();
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  if (value === null || value === undefined || value === "") return fallback;
  return Boolean(value);
}

function normalizeServicioTipo(value: unknown): string {
  const raw = asString(value).toUpperCase();

  const allowed = [
    "TRASLADO",
    "ASISTENCIA",
    "EXCURSION",
    "EQUIPAJE",
    "SEGURO",
    "CIRCUITO",
    "AUTO",
    "OTRO"
  ];

  if (allowed.includes(raw)) return raw;

  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (text.includes("TRASL")) return "TRASLADO";
  if (text.includes("ASIST")) return "ASISTENCIA";
  if (text.includes("EXCUR")) return "EXCURSION";
  if (text.includes("EQUIP")) return "EQUIPAJE";
  if (text.includes("SEGU")) return "SEGURO";
  if (text.includes("CIRCU")) return "CIRCUITO";
  if (text.includes("AUTO") || text.includes("CAR")) return "AUTO";

  return "OTRO";
}

function normalizeMetadata(value: unknown): Record<string, unknown> {
  return asRecord(value);
}

function normalizeTipoTramo(value: unknown): string {
  const raw = asString(value).toUpperCase();
  const normalized = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (normalized.includes("VUELTA") || normalized.includes("REGRESO") || normalized.includes("RETURN")) {
    return "VUELTA";
  }

  if (normalized.includes("IDA") || normalized.includes("SALIDA") || normalized.includes("OUTBOUND")) {
    return "IDA";
  }

  return raw === "IDA" || raw === "VUELTA" ? raw : "";
}

function normalizeVueloNumber(value: unknown): string {
  const raw = asString(value);

  if (!raw) return "";

  const match = raw.match(/\b([A-Z0-9]{2})\s?(\d{2,4})\b/i);

  if (!match) return raw;

  return `${match[1].toUpperCase()} ${match[2]}`;
}

function normalizeTramoObject(value: unknown, fallbackDireccion: string, index: number): Record<string, unknown> {
  const tramo = asRecord(value);
  const origen = asRecord(tramo.origen);
  const destino = asRecord(tramo.destino);
  const escala = asRecord(tramo.escala_posterior);

  const direccion =
    asString(tramo.direccion).toLowerCase() ||
    (fallbackDireccion === "VUELTA" ? "vuelta" : fallbackDireccion === "IDA" ? "ida" : "");

  return {
    ...tramo,
    direccion,
    indice: typeof tramo.indice === "number" ? tramo.indice : index + 1,
    numero_vuelo: normalizeVueloNumber(tramo.numero_vuelo || tramo.flight_number || tramo.numero),
    codigo_aerolinea: asString(tramo.codigo_aerolinea),
    aerolinea: asString(tramo.aerolinea),
    fecha_salida: asString(tramo.fecha_salida || tramo.salida_fecha),
    hora_salida: asString(tramo.hora_salida || tramo.salida_hora),
    fecha_llegada: asString(tramo.fecha_llegada || tramo.llegada_fecha),
    hora_llegada: asString(tramo.hora_llegada || tramo.llegada_hora),
    duracion: asString(tramo.duracion),
    origen: {
      iata: asString(origen.iata || tramo.origen_iata || tramo.salida_codigo),
      ciudad: asString(origen.ciudad || tramo.origen_ciudad || tramo.salida_ciudad),
      aeropuerto: asString(origen.aeropuerto || tramo.origen_aeropuerto || tramo.salida_aeropuerto),
      terminal: asString(origen.terminal || tramo.origen_terminal || tramo.salida_terminal)
    },
    destino: {
      iata: asString(destino.iata || tramo.destino_iata || tramo.llegada_codigo),
      ciudad: asString(destino.ciudad || tramo.destino_ciudad || tramo.llegada_ciudad),
      aeropuerto: asString(destino.aeropuerto || tramo.destino_aeropuerto || tramo.llegada_aeropuerto),
      terminal: asString(destino.terminal || tramo.destino_terminal || tramo.llegada_terminal)
    },
    escala_posterior:
      tramo.escala_posterior === null
        ? null
        : Object.keys(escala).length
          ? {
              ciudad: asString(escala.ciudad),
              iata: asString(escala.iata),
              espera: asString(escala.espera || escala.duracion)
            }
          : null
  };
}

function normalizeVueloParsed(item: Record<string, unknown>, index: number) {
  const metadata = normalizeMetadata(item.metadata);

  const tipoTramo = normalizeTipoTramo(item.tipo_tramo || metadata.tipo_tramo || item.tramo_tipo);

  const titulo =
    asString(item.titulo) ||
    (tipoTramo === "VUELTA" ? "Vuelo Vuelta" : tipoTramo === "IDA" ? "Vuelo Ida" : `Vuelo ${index + 1}`);

  const idaDetalle =
    asString(item.ida_detalle) ||
    asString(item.detalle_ida) ||
    (tipoTramo !== "VUELTA"
      ? asString(item.texto_libre) || asString(item.raw_text) || asString(item.descripcion)
      : "");

  const vueltaDetalle =
    asString(item.vuelta_detalle) ||
    asString(item.detalle_vuelta) ||
    (tipoTramo === "VUELTA"
      ? asString(item.texto_libre) || asString(item.raw_text) || asString(item.descripcion)
      : "");

  const rawText =
    asString(item.raw_text) ||
    asString(item.texto_libre) ||
    [idaDetalle, vueltaDetalle].filter(Boolean).join("\n\n");

  const rawTramos = Array.isArray(metadata.tramos)
    ? metadata.tramos
    : Array.isArray(item.tramos)
      ? item.tramos
      : [];

  const tramos = rawTramos.map((tramo, tramoIndex) => normalizeTramoObject(tramo, tipoTramo, tramoIndex));

  const escalas = Array.isArray(metadata.escalas)
    ? metadata.escalas
    : Array.isArray(item.escalas)
      ? item.escalas
      : [];

  return {
    titulo,
    tipo_tramo: tipoTramo,
    aerolinea: asString(item.aerolinea),
    codigo_reserva: asString(item.codigo_reserva),
    ruta_resumen: asString(item.ruta_resumen),

    ida_origen: asString(item.ida_origen),
    ida_destino: asString(item.ida_destino),
    ida_fecha: asString(item.ida_fecha),
    ida_hora_salida: asString(item.ida_hora_salida),
    ida_hora_llegada: asString(item.ida_hora_llegada),
    ida_escalas: asString(item.ida_escalas),
    ida_detalle: idaDetalle,

    vuelta_origen: asString(item.vuelta_origen),
    vuelta_destino: asString(item.vuelta_destino),
    vuelta_fecha: asString(item.vuelta_fecha),
    vuelta_hora_salida: asString(item.vuelta_hora_salida),
    vuelta_hora_llegada: asString(item.vuelta_hora_llegada),
    vuelta_escalas: asString(item.vuelta_escalas),
    vuelta_detalle: vueltaDetalle,

    equipaje: asString(item.equipaje),
    tarifa_familia: asString(item.tarifa_familia),
    condiciones: asString(item.condiciones),
    precio_total: safeNumber(item.precio_total),
    moneda: normalizeCurrency(item.moneda),
    incluir_en_pdf: asBoolean(item.incluir_en_pdf, true),
    mostrar_precio_en_pdf: asBoolean(item.mostrar_precio_en_pdf, false),
    raw_text: rawText,
    metadata: {
      ...metadata,
      origen: "PRESUPUESTO_IA",
      tipo_tramo: tipoTramo || metadata.tipo_tramo || "",
      seleccion_asientos:
        asString(metadata.seleccion_asientos) ||
        asString(item.seleccion_asientos) ||
        "Sujeta a disponibilidad y condiciones de la tarifa.",
      tramos,
      escalas
    }
  };
}

function normalizeHotelParsed(item: Record<string, unknown>, index: number) {
  const metadata = normalizeMetadata(item.metadata);

  return {
    titulo: asString(item.titulo) || asString(item.nombre) || `Hotel ${index + 1}`,
    nombre: asString(item.nombre) || asString(item.titulo) || `Hotel ${index + 1}`,
    destino: asString(item.destino),
    zona: asString(item.zona) || asString(item.ubicacion) || asString(item.direccion),
    categoria: asString(item.categoria),
    regimen: asString(item.regimen),
    habitacion: asString(item.habitacion),
    ocupacion: asString(item.ocupacion),
    check_in: asString(item.check_in),
    check_out: asString(item.check_out),
    descripcion: asString(item.descripcion),
    beneficios: asString(item.beneficios),
    condiciones: asString(item.condiciones),
    politica_cancelacion: asString(item.politica_cancelacion),
    precio_total: safeNumber(item.precio_total),
    moneda: normalizeCurrency(item.moneda),
    incluir_en_pdf: asBoolean(item.incluir_en_pdf, true),
    mostrar_precio_en_pdf: asBoolean(item.mostrar_precio_en_pdf, false),
    metadata: {
      ...metadata,
      origen: "PRESUPUESTO_IA",
      direccion_original:
        asString(metadata.direccion_original) ||
        asString(item.direccion) ||
        asString(item.zona) ||
        asString(item.ubicacion)
    }
  };
}

function normalizeServicioParsed(item: Record<string, unknown>, index: number) {
  const metadata = normalizeMetadata(item.metadata);

  return {
    tipo: normalizeServicioTipo(item.tipo),
    nombre: asString(item.nombre) || asString(item.titulo) || `Servicio ${index + 1}`,
    descripcion: asString(item.descripcion) || asString(item.texto_libre),
    incluido: asBoolean(item.incluido, true),
    opcional: asBoolean(item.opcional, false),
    precio_total: safeNumber(item.precio_total),
    moneda: normalizeCurrency(item.moneda),
    incluir_en_pdf: asBoolean(item.incluir_en_pdf, true),
    mostrar_precio_en_pdf: asBoolean(item.mostrar_precio_en_pdf, false),
    metadata: {
      ...metadata,
      origen: "PRESUPUESTO_IA"
    }
  };
}

function normalizeOpcionParsed(item: Record<string, unknown>, index: number) {
  const metadata = normalizeMetadata(item.metadata);

  return {
    nombre: asString(item.nombre) || asString(item.titulo) || `Opción ${index + 1}`,
    subtitulo: asString(item.subtitulo),
    descripcion: asString(item.descripcion),
    precio_total: safeNumber(item.precio_total ?? item.precio),
    moneda: normalizeCurrency(item.moneda),
    forma_pago_resumen: asString(item.forma_pago_resumen) || asString(item.forma_pago),
    condiciones_pago: asString(item.condiciones_pago),
    incluye_resumen: asString(item.incluye_resumen) || asString(item.incluye),
    no_incluye_resumen: asString(item.no_incluye_resumen) || asString(item.no_incluye),
    notas: asString(item.notas),
    visible_en_pdf: asBoolean(item.visible_en_pdf, true),
    destacada: index === 0 ? asBoolean(item.destacada, true) : asBoolean(item.destacada, false),
    metadata: {
      ...metadata,
      origen: "PRESUPUESTO_IA",
      precio_es_total_paquete: true
    }
  };
}

function normalizePlainTextForDetection(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getTextBasedWarnings(originalText: string, parsed: {
  vuelos: unknown[];
  hoteles: unknown[];
  servicios: unknown[];
  opciones_comerciales: unknown[];
}) {
  const text = normalizePlainTextForDetection(originalText);
  const warnings: string[] = [];

  const seemsHasVuelta =
    text.includes("vuelta") ||
    text.includes("regreso") ||
    text.includes("return") ||
    /\b[A-Z]{3}\s*(?:→|-|a)\s*[A-Z]{3}/i.test(originalText);

  const seemsHasHotel =
    text.includes("hotel") ||
    text.includes("alojamiento") ||
    text.includes("habitacion") ||
    text.includes("regimen") ||
    text.includes("desayuno") ||
    text.includes("all inclusive");

  const seemsHasServicio =
    text.includes("traslado") ||
    text.includes("asistencia") ||
    text.includes("seguro") ||
    text.includes("excursion") ||
    text.includes("equipaje");

  const seemsHasPrice =
    text.includes("precio") ||
    text.includes("tarifa") ||
    text.includes("total") ||
    text.includes("valor") ||
    text.includes("usd") ||
    text.includes("us$") ||
    text.includes("u$d");

  const hasVueltaParsed = parsed.vuelos.some((item) => {
    const record = asRecord(item);
    const metadata = asRecord(record.metadata);

    return normalizeTipoTramo(record.tipo_tramo || metadata.tipo_tramo) === "VUELTA";
  });

  if (seemsHasVuelta && !hasVueltaParsed) {
    warnings.push("El texto parece tener vuelo de vuelta/regreso, pero la IA no lo separó claramente.");
  }

  if (seemsHasHotel && parsed.hoteles.length === 0) {
    warnings.push("El texto parece tener hotel/alojamiento, pero la IA no creó hotel.");
  }

  if (seemsHasServicio && parsed.servicios.length === 0) {
    warnings.push("El texto parece tener servicios adicionales, pero la IA no creó servicios.");
  }

  if (seemsHasPrice && parsed.opciones_comerciales.length === 0) {
    warnings.push("El texto parece tener precio final, pero la IA no creó opción comercial.");
  }

  return warnings;
}

function normalizeParsed(parsed: any, fallbackTipo: ParserEntidadTipo, originalText = "") {
  const vuelos = asArray(parsed?.vuelos).map(normalizeVueloParsed);
  const hoteles = asArray(parsed?.hoteles).map(normalizeHotelParsed);
  const servicios = asArray(parsed?.servicios).map(normalizeServicioParsed);

  const opcionesRaw = asArray(parsed?.opciones_comerciales).length
    ? asArray(parsed?.opciones_comerciales)
    : asArray(parsed?.opciones);

  const opciones_comerciales = opcionesRaw.map(normalizeOpcionParsed);

  const advertenciasBase = Array.isArray(parsed?.resumen_humano?.advertencias)
    ? parsed.resumen_humano.advertencias.map(asString).filter(Boolean)
    : Array.isArray(parsed?.observaciones)
      ? parsed.observaciones.map(asString).filter(Boolean)
      : [];

  const autoWarnings = originalText
    ? getTextBasedWarnings(originalText, {
        vuelos,
        hoteles,
        servicios,
        opciones_comerciales
      })
    : [];

  const advertencias = Array.from(new Set([...advertenciasBase, ...autoWarnings]));

  const precioFinal =
    asString(parsed?.resumen_humano?.precio_final_detectado) ||
    (() => {
      const first = opciones_comerciales.find((item) => item.precio_total !== null);

      if (!first) return "";

      return `${first.moneda} ${first.precio_total}`;
    })();

  return {
    tipo: asString(parsed?.tipo) || fallbackTipo,
    confianza:
      typeof parsed?.confianza === "number" && Number.isFinite(parsed.confianza)
        ? Math.max(0, Math.min(parsed.confianza, 1))
        : 0,
    resumen_humano: {
      titulo: asString(parsed?.resumen_humano?.titulo) || "Contenido detectado por IA",
      descripcion:
        asString(parsed?.resumen_humano?.descripcion) ||
        `Se detectaron ${vuelos.length} vuelo(s), ${hoteles.length} hotel(es), ${servicios.length} servicio(s) y ${opciones_comerciales.length} opción(es).`,
      vuelos_detectados: vuelos.length,
      hoteles_detectados: hoteles.length,
      servicios_detectados: servicios.length,
      opciones_detectadas: opciones_comerciales.length,
      precio_final_detectado: precioFinal,
      advertencias
    },
    caratula_no_modificar: true,
    vuelos,
    hoteles,
    servicios,
    opciones_comerciales,
    incluye_general: asString(parsed?.incluye_general),
    no_incluye_general: asString(parsed?.no_incluye_general),
    condiciones_generales: asString(parsed?.condiciones_generales),
    observaciones: Array.isArray(parsed?.observaciones)
      ? parsed.observaciones.map(asString).filter(Boolean)
      : []
  };
}

function extractFirstPriceFromText(text: string): { precio: number | null; moneda: string } {
  const patterns = [
    /(precio|total|tarifa|valor|paquete)[^\n\r]{0,60}?(usd|us\$|u\$d)\s*([\d.,]+)/i,
    /(usd|us\$|u\$d)\s*([\d.,]+)/i,
    /(precio|total|tarifa|valor|paquete)[^\n\r]{0,60}?\$\s*([\d.,]+)/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);

    if (!match) continue;

    if (match.length >= 4) {
      return {
        moneda: normalizeCurrency(match[2]),
        precio: safeNumber(match[3])
      };
    }

    if (match.length >= 3) {
      return {
        moneda: normalizeCurrency(match[1]),
        precio: safeNumber(match[2])
      };
    }
  }

  return {
    precio: null,
    moneda: "USD"
  };
}

function fallbackParsedFromText(text: string, fallbackTipo: ParserEntidadTipo) {
  const lowered = normalizePlainTextForDetection(text);

  const hasVuelo =
    lowered.includes("vuelo") ||
    lowered.includes("aereo") ||
    lowered.includes("aéreo") ||
    lowered.includes("airline") ||
    lowered.includes("ida") ||
    lowered.includes("vuelta");

  const hasHotel =
    lowered.includes("hotel") ||
    lowered.includes("alojamiento") ||
    lowered.includes("habitacion") ||
    lowered.includes("habitación") ||
    lowered.includes("regimen") ||
    lowered.includes("régimen");

  const hasTraslado = lowered.includes("traslado");
  const hasAsistencia = lowered.includes("asistencia");
  const hasEquipaje = lowered.includes("equipaje") || lowered.includes("carry");

  const price = extractFirstPriceFromText(text);

  return normalizeParsed(
    {
      tipo: fallbackTipo,
      confianza: 0.15,
      resumen_humano: {
        titulo: "La IA no devolvió JSON válido",
        descripcion:
          "Se guardó una interpretación mínima para no perder el texto pegado. Conviene revisar manualmente.",
        advertencias: ["La respuesta original de la IA no fue JSON válido."]
      },
      vuelos: hasVuelo
        ? [
            {
              titulo: "Vuelo a revisar",
              texto_libre: text,
              raw_text: text,
              incluir_en_pdf: true,
              mostrar_precio_en_pdf: false,
              metadata: {
                origen: "PRESUPUESTO_IA"
              }
            }
          ]
        : [],
      hoteles: hasHotel
        ? [
            {
              titulo: "Hotel detectado",
              nombre: "Hotel a revisar",
              descripcion: "",
              incluir_en_pdf: true,
              mostrar_precio_en_pdf: false,
              metadata: {
                origen: "PRESUPUESTO_IA",
                texto_original: text
              }
            }
          ]
        : [],
      servicios: [
        ...(hasTraslado
          ? [
              {
                tipo: "TRASLADO",
                nombre: "Traslado",
                descripcion: "Traslado detectado en el texto.",
                incluido: true,
                opcional: false,
                metadata: {
                  origen: "PRESUPUESTO_IA"
                }
              }
            ]
          : []),
        ...(hasAsistencia
          ? [
              {
                tipo: "ASISTENCIA",
                nombre: "Asistencia al viajero",
                descripcion: "Asistencia detectada en el texto.",
                incluido: true,
                opcional: false,
                metadata: {
                  origen: "PRESUPUESTO_IA"
                }
              }
            ]
          : []),
        ...(hasEquipaje
          ? [
              {
                tipo: "EQUIPAJE",
                nombre: "Equipaje",
                descripcion: "Equipaje detectado en el texto.",
                incluido: true,
                opcional: false,
                metadata: {
                  origen: "PRESUPUESTO_IA"
                }
              }
            ]
          : [])
      ],
      opciones_comerciales:
        price.precio && price.precio > 0
          ? [
              {
                nombre: "Opción 1",
                subtitulo: "Paquete completo",
                precio_total: price.precio,
                moneda: price.moneda,
                visible_en_pdf: true,
                destacada: true,
                metadata: {
                  origen: "PRESUPUESTO_IA",
                  precio_es_total_paquete: true
                }
              }
            ]
          : [],
      observaciones: ["Revisar manualmente el texto original."]
    },
    fallbackTipo,
    text
  );
}

function tryParseJson(text: string, fallbackTipo: ParserEntidadTipo, originalText = "") {
  const jsonText = extractJsonObject(text);

  try {
    return normalizeParsed(JSON.parse(jsonText), fallbackTipo, originalText);
  } catch {
    return fallbackParsedFromText(originalText || text, fallbackTipo);
  }
}

async function callOpenAiWithText(apiKey: string, prompt: string, text: string) {
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
              text: "Devolvé siempre y únicamente JSON válido. No uses markdown. No expliques nada fuera del JSON."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `${prompt}\n\nTEXTO COMPLETO A PROCESAR, LEER HASTA EL FINAL:\n${text}`
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      },
      temperature: 0.02,
      max_output_tokens: 12000
    })
  });
}

async function callOpenAiWithImage(apiKey: string, prompt: string, imageUrl: string) {
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
              text: "Devolvé siempre y únicamente JSON válido. No uses markdown. No expliques nada fuera del JSON."
            }
          ]
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: prompt
            },
            {
              type: "input_image",
              image_url: imageUrl
            }
          ]
        }
      ],
      text: {
        format: {
          type: "json_object"
        }
      },
      temperature: 0.02,
      max_output_tokens: 9000
    })
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: corsHeaders
    });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        error: "Método no permitido."
      },
      405
    );
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

    const body = (await req.json()) as ParserRequest;

    const entidadTipo: ParserEntidadTipo = body.entidad_tipo || "PRESUPUESTO";
    const textPayload = cleanText(body.text || body.presupuesto_text);
    const isTextMode = body.mode === "TEXT" || Boolean(textPayload);

    let openaiRes: Response;

    if (isTextMode) {
      if (!textPayload) {
        return jsonResponse(
          {
            error: "No se recibió texto para procesar."
          },
          400
        );
      }

      const prompt = getTextPresupuestoPrompt(body.caratula || null);
      openaiRes = await callOpenAiWithText(apiKey, prompt, textPayload);
    } else {
      if (!body.file_url || !body.entidad_tipo) {
        return jsonResponse(
          {
            error: "Faltan datos para procesar el archivo.",
            received: {
              adjunto_id: Boolean(body.adjunto_id),
              file_url: Boolean(body.file_url),
              entidad_tipo: Boolean(body.entidad_tipo)
            }
          },
          400
        );
      }

      if (!isImageMimeType(body.file_mime_type)) {
        return jsonResponse(
          {
            error: "Por ahora el parser IA por captura solo acepta imágenes.",
            detail: `Archivo recibido: ${body.file_mime_type || "sin mime type"}. Para PDF necesitamos convertirlo a imagen o procesarlo como documento.`
          },
          400
        );
      }

      const prompt = getImagePrompt(body.entidad_tipo);
      openaiRes = await callOpenAiWithImage(apiKey, prompt, body.file_url);
    }

    if (!openaiRes.ok) {
      const errorText = await openaiRes.text();

      return jsonResponse(
        {
          error: "OpenAI no pudo procesar la información.",
          status: openaiRes.status,
          detail: errorText
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

    const parsed = tryParseJson(outputText, entidadTipo, textPayload);

    return jsonResponse({
      ok: true,
      mode: isTextMode ? "TEXT" : "FILE",
      adjunto_id: body.adjunto_id || null,
      parsed
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Error inesperado."
      },
      500
    );
  }
});