// src/lib/presupuestosPdf.ts

import type {
  PresupuestoCombinacion,
  PresupuestoHotel,
  PresupuestoServicio,
  PresupuestoV2,
  PresupuestoVuelo
} from "../store/presupuestosV2Store";
import { formatMoneyAR } from "./formatters";

/* =========================================================
   NOSSIX / NOSTUR — PRESUPUESTOS PDF / PREVIEW
   Plantilla comercial ALMUNDO

   Ajustes incluidos:
   - Header más compacto.
   - Datos del viaje en card compacta.
   - Hotel sin mostrar web ni Maps.
   - Hotel con hasta 4 imágenes en una fila.
   - Precio destacado en una sola fila visual.
   - Footer más prolijo y compacto.
========================================================= */

export type PresupuestoPdfData = {
  presupuesto: PresupuestoV2;
  vuelos: PresupuestoVuelo[];
  hoteles: PresupuestoHotel[];
  servicios: PresupuestoServicio[];
  combinaciones: PresupuestoCombinacion[];
};

type SafeRecord = Record<string, unknown>;

type FlightLeg = {
  tipo: "IDA" | "VUELTA" | "";
  aerolinea: string;
  numero: string;
  avion: string;
  clase: string;
  fecha: string;
  salidaHora: string;
  salidaCodigo: string;
  salidaCiudad: string;
  salidaAeropuerto: string;
  duracion: string;
  llegadaHora: string;
  llegadaCodigo: string;
  llegadaCiudad: string;
  llegadaAeropuerto: string;
  escalaDespues: string;
};

type FlightDirectionRow = {
  label: string;
  fecha: string;
  aerolinea: string;
  numero: string;
  origen: string;
  destino: string;
  salida: string;
  llegada: string;
  duracion: string;
  escala: string;
};

const ALMUNDO_LOGO_URL = "brand/almundo-logo.png";

/* =========================================================
   HELPERS GENERALES
========================================================= */

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(value: unknown): string {
  return escapeHtml(value).replace(/\n/g, "<br />");
}

function hasText(value: unknown): boolean {
  return String(value ?? "").trim().length > 0;
}

function cleanLine(value: unknown): string {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\d]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getMetadata(item: { metadata?: SafeRecord | null } | null | undefined): SafeRecord {
  if (!item?.metadata || typeof item.metadata !== "object" || Array.isArray(item.metadata)) return {};
  return item.metadata;
}

function getNestedRecord(value: unknown): SafeRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as SafeRecord;
}

function getStringFromAny(...values: unknown[]): string {
  for (const value of values) {
    if (hasText(value)) return cleanLine(value);
  }

  return "";
}

function getNumberFromAny(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;

    const parsed = Number(
      String(value ?? "")
        .replace(/\./g, "")
        .replace(",", ".")
        .replace(/[^\d.-]/g, "")
    );

    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }

  return null;
}

function getArrayFromAny(...values: unknown[]): unknown[] {
  for (const value of values) {
    if (Array.isArray(value)) return value;
  }

  return [];
}

function metadataBool(metadata: SafeRecord | null | undefined, key: string, fallback: boolean): boolean {
  if (!metadata || typeof metadata !== "object") return fallback;

  const value = metadata[key];

  if (typeof value === "boolean") return value;

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();

    if (["true", "1", "si", "sí", "yes"].includes(normalized)) return true;
    if (["false", "0", "no"].includes(normalized)) return false;
  }

  return fallback;
}

function shouldShowPrice(item: { precio_total?: number | null; metadata?: SafeRecord | null }): boolean {
  if (!item.precio_total) return false;
  return metadataBool(item.metadata, "mostrar_precio_en_pdf", false);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const clean = String(value).slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return clean || "—";

  return `${day}/${month}/${year}`;
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function getDisplayName(presupuesto: PresupuestoV2): string {
  return (
    presupuesto.cliente_nombre ||
    presupuesto.destino_principal ||
    presupuesto.titulo ||
    presupuesto.numero ||
    "Pasajero"
  );
}

function getPasajerosLabel(presupuesto: PresupuestoV2): string {
  const adultos = Number(presupuesto.adultos || 0);
  const menores = Number(presupuesto.menores || 0);

  const adultoText = `${adultos} adulto${adultos === 1 ? "" : "s"}`;
  const menorText = menores > 0 ? ` + ${menores} menor${menores === 1 ? "" : "es"}` : "";
  const edadesText = menores > 0 && presupuesto.edades_menores ? ` (${presupuesto.edades_menores})` : "";

  return `${adultoText}${menorText}${edadesText}`;
}

function getTotalPax(presupuesto: PresupuestoV2): number {
  return Math.max(1, Number(presupuesto.adultos || 0) + Number(presupuesto.menores || 0));
}

function uniqueBy<T>(items: T[], getKey: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];

  for (const item of items) {
    const key = normalizeText(getKey(item));

    if (!key) {
      result.push(item);
      continue;
    }

    if (seen.has(key)) continue;

    seen.add(key);
    result.push(item);
  }

  return result;
}

function dedupeVuelos(vuelos: PresupuestoVuelo[]): PresupuestoVuelo[] {
  return uniqueBy(vuelos, (vuelo) =>
    [
      vuelo.titulo,
      vuelo.aerolinea,
      vuelo.ida_origen,
      vuelo.ida_destino,
      vuelo.ida_fecha,
      vuelo.vuelta_origen,
      vuelo.vuelta_destino,
      vuelo.vuelta_fecha,
      getMetadata(vuelo).tipo_tramo
    ].join(" | ")
  );
}

function dedupeHoteles(hoteles: PresupuestoHotel[]): PresupuestoHotel[] {
  return uniqueBy(hoteles, (hotel) =>
    [hotel.nombre, hotel.destino, hotel.zona, hotel.check_in, hotel.check_out].join(" | ")
  );
}

function dedupeServicios(servicios: PresupuestoServicio[]): PresupuestoServicio[] {
  return uniqueBy(servicios, (servicio) =>
    [servicio.nombre, servicio.tipo, servicio.descripcion].join(" | ")
  );
}

function dedupeCombinaciones(combinaciones: PresupuestoCombinacion[]): PresupuestoCombinacion[] {
  return uniqueBy(combinaciones, (combinacion) =>
    [
      combinacion.nombre,
      combinacion.subtitulo,
      combinacion.precio_total,
      combinacion.moneda,
      combinacion.incluye_resumen,
      combinacion.no_incluye_resumen
    ].join(" | ")
  );
}

function getRecommendedCombinacion(
  presupuesto: PresupuestoV2,
  combinaciones: PresupuestoCombinacion[]
): PresupuestoCombinacion | null {
  return (
    combinaciones.find((item) => item.id === presupuesto.opcion_recomendada_id) ||
    combinaciones.find((item) => item.destacada) ||
    combinaciones[0] ||
    null
  );
}

function renderBadge(text: string): string {
  return `<span class="badge">${escapeHtml(text)}</span>`;
}

function renderInfoItem(label: string, value: unknown): string {
  if (!hasText(value)) return "";

  return `
    <div class="info-item">
      <div class="info-label">${escapeHtml(label)}</div>
      <div class="info-value">${escapeHtml(value)}</div>
    </div>
  `;
}

function renderSection(title: string, content: string, className = ""): string {
  if (!content.trim()) return "";

  return `
    <section class="section ${escapeHtml(className)}">
      <div class="section-title">
        <h2>${escapeHtml(title)}</h2>
        <span></span>
      </div>
      ${content}
    </section>
  `;
}

/* =========================================================
   VUELOS
========================================================= */

function extractAirlineFromText(value: unknown, fallback = "Aerolínea a confirmar"): string {
  const raw = String(value ?? "");
  const known = raw.match(
    /(Aerol[ií]neas Argentinas|LATAM|GOL|JetSMART|Jet Smart|Copa Airlines|Copa|Avianca|Iberia|Air Europa|American Airlines|Delta|United|Sky Airline|Flybondi|Arajet)/i
  );

  const found = cleanLine(known?.[1] || "");

  if (found.toLowerCase() === "copa") return "Copa Airlines";

  return found || fallback;
}

function extractAirline(vuelo: PresupuestoVuelo): string {
  if (hasText(vuelo.aerolinea)) return cleanLine(vuelo.aerolinea);

  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const metadataAirline = getStringFromAny(
    metadata.aerolinea,
    metadata.airline,
    parsed.aerolinea,
    parsed.airline
  );

  if (metadataAirline) return metadataAirline;

  return extractAirlineFromText(
    [
      vuelo.raw_text,
      vuelo.ida_detalle,
      vuelo.vuelta_detalle,
      parsed.texto_libre,
      parsed.raw_text
    ].join("\n")
  );
}

function extractFlightNumbersFromVuelo(vuelo: PresupuestoVuelo): string[] {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const tramos = getArrayFromAny(metadata.tramos, parsed.tramos, metadata.legs, metadata.segmentos);

  const fromTramos = tramos
    .map((item) => {
      const tramo = getNestedRecord(item);
      return getStringFromAny(tramo.numero_vuelo, tramo.flight_number, tramo.numero);
    })
    .filter(Boolean);

  const text = [
    vuelo.ida_detalle,
    vuelo.vuelta_detalle,
    vuelo.ruta_resumen,
    vuelo.raw_text,
    parsed.numero_vuelo,
    parsed.flight_number,
    parsed.texto_libre,
    parsed.raw_text,
    parsed.ida_detalle,
    parsed.vuelta_detalle
  ].join("\n");

  const fromText = Array.from(text.matchAll(/\b([A-Z]{2}\s?\d{2,4})\b/g)).map((match) =>
    cleanLine(match[1]).replace(/\s+/g, "")
  );

  return Array.from(new Set([...fromTramos, ...fromText].map((item) => cleanLine(item).replace(/\s+/g, ""))));
}

function normalizeDirection(value: unknown): "IDA" | "VUELTA" | "" {
  const normalized = normalizeText(value);

  if (
    normalized.includes("vuelta") ||
    normalized.includes("regreso") ||
    normalized.includes("return") ||
    normalized.includes("inbound")
  ) {
    return "VUELTA";
  }

  if (normalized.includes("ida") || normalized.includes("outbound")) {
    return "IDA";
  }

  return "";
}

function parseFlightLegsFromMetadata(vuelo: PresupuestoVuelo): FlightLeg[] {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);
  const tramos = getArrayFromAny(metadata.tramos, parsed.tramos, metadata.legs, metadata.segmentos);
  const airline = extractAirline(vuelo);
  const fallbackTipo = normalizeDirection(
    getStringFromAny(metadata.tipo_tramo, metadata.tramo_tipo, parsed.tipo_tramo, parsed.tramo_tipo)
  );

  return tramos
    .map((item): FlightLeg | null => {
      const tramo = getNestedRecord(item);
      const origen = getNestedRecord(tramo.origen);
      const destino = getNestedRecord(tramo.destino);
      const escalaPosterior = getNestedRecord(tramo.escala_posterior);

      const tipo =
        normalizeDirection(
          getStringFromAny(
            tramo.tipo,
            tramo.tramo_tipo,
            tramo.direction,
            tramo.direccion
          )
        ) || fallbackTipo;

      const salidaHora = getStringFromAny(
        tramo.salida_hora,
        tramo.hora_salida,
        tramo.departure_time,
        tramo.departureTime
      );

      const llegadaHora = getStringFromAny(
        tramo.llegada_hora,
        tramo.hora_llegada,
        tramo.arrival_time,
        tramo.arrivalTime
      );

      const salidaCodigo = getStringFromAny(
        tramo.salida_codigo,
        tramo.origen_codigo,
        tramo.origen_iata,
        tramo.departure_code,
        tramo.departureCode,
        origen.iata
      );

      const llegadaCodigo = getStringFromAny(
        tramo.llegada_codigo,
        tramo.destino_codigo,
        tramo.destino_iata,
        tramo.arrival_code,
        tramo.arrivalCode,
        destino.iata
      );

      if (!salidaHora && !llegadaHora && !salidaCodigo && !llegadaCodigo) return null;

      const escalaDespues =
        Object.keys(escalaPosterior).length > 0
          ? [
              escalaPosterior.ciudad,
              escalaPosterior.iata ? `(${escalaPosterior.iata})` : "",
              escalaPosterior.espera
            ]
              .filter(Boolean)
              .join(" ")
          : getStringFromAny(
              tramo.escala_despues,
              tramo.tiempo_escala,
              tramo.layover_duration,
              tramo.connection_time
            );

      return {
        tipo,
        aerolinea: getStringFromAny(tramo.aerolinea, tramo.airline, airline),
        numero: getStringFromAny(tramo.numero_vuelo, tramo.flight_number, tramo.numero),
        avion: getStringFromAny(tramo.avion, tramo.aircraft),
        clase: getStringFromAny(tramo.clase, tramo.cabin),
        fecha: formatDate(
          getStringFromAny(
            tramo.fecha_salida,
            tramo.salida_fecha,
            tramo.departure_date,
            tramo.fecha
          )
        ),
        salidaHora,
        salidaCodigo,
        salidaCiudad: getStringFromAny(
          tramo.salida_ciudad,
          tramo.origen_ciudad,
          tramo.origen_nombre,
          tramo.departure_city,
          origen.ciudad
        ),
        salidaAeropuerto: getStringFromAny(
          tramo.salida_aeropuerto,
          tramo.origen_aeropuerto,
          origen.aeropuerto
        ),
        duracion: getStringFromAny(tramo.duracion, tramo.duration),
        llegadaHora,
        llegadaCodigo,
        llegadaCiudad: getStringFromAny(
          tramo.llegada_ciudad,
          tramo.destino_ciudad,
          tramo.destino_nombre,
          tramo.arrival_city,
          destino.ciudad
        ),
        llegadaAeropuerto: getStringFromAny(
          tramo.llegada_aeropuerto,
          tramo.destino_aeropuerto,
          destino.aeropuerto
        ),
        escalaDespues
      };
    })
    .filter((item): item is FlightLeg => Boolean(item));
}

function getDirectionFromVuelo(vuelo: PresupuestoVuelo): "IDA" | "VUELTA" | "" {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const tipoTramo = normalizeDirection(
    getStringFromAny(
      metadata.tipo_tramo,
      metadata.tramo_tipo,
      parsed.tipo_tramo,
      parsed.tramo_tipo
    )
  );

  if (tipoTramo) return tipoTramo;

  const title = normalizeText(vuelo.titulo);

  if (title.includes("vuelta") || title.includes("regreso")) return "VUELTA";
  if (title.includes("ida")) return "IDA";

  const lightText = normalizeText(
    [
      vuelo.ida_detalle,
      vuelo.vuelta_detalle,
      parsed.titulo,
      parsed.nombre
    ].join(" ")
  );

  if (lightText.includes("vuelo vuelta") || lightText.includes("regreso")) return "VUELTA";
  if (lightText.includes("vuelo ida")) return "IDA";

  return "";
}

function compactRoute(value: string): string {
  return cleanLine(value)
    .replace(/\s*-\s*/g, " - ")
    .replace(/\s*→\s*/g, " → ");
}

function buildRowsFromLegs(legs: FlightLeg[], direction: "IDA" | "VUELTA" | ""): FlightDirectionRow[] {
  return legs.map((leg, index) => {
    const escala =
      leg.escalaDespues ||
      (index < legs.length - 1
        ? `${leg.llegadaCiudad || leg.llegadaCodigo || "Escala"} · tiempo a confirmar`
        : "Directo / tramo final");

    return {
      label: direction === "VUELTA" || leg.tipo === "VUELTA" ? "Vuelta" : "Ida",
      fecha: leg.fecha || "—",
      aerolinea: leg.aerolinea || "Aerolínea",
      numero: leg.numero || "—",
      origen: compactRoute(
        [leg.salidaCiudad, leg.salidaCodigo ? `(${leg.salidaCodigo})` : ""].filter(Boolean).join(" ")
      ),
      destino: compactRoute(
        [leg.llegadaCiudad, leg.llegadaCodigo ? `(${leg.llegadaCodigo})` : ""].filter(Boolean).join(" ")
      ),
      salida: leg.salidaHora || "—",
      llegada: leg.llegadaHora || "—",
      duracion: leg.duracion || "A confirmar",
      escala
    };
  });
}

function getParsedRouteLabel(value: string): string {
  const clean = cleanLine(value);

  if (!clean) return "";

  const airportMatch = clean.match(/(.+?)\s+\(([A-Z]{3})\)/);

  if (airportMatch) {
    return `${cleanLine(airportMatch[1])} (${airportMatch[2]})`;
  }

  return clean;
}

function parseCommercialFlightSummary(vuelo: PresupuestoVuelo, direction: "IDA" | "VUELTA" | ""): FlightDirectionRow {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const airline = extractAirline(vuelo);
  const flightNumbers = extractFlightNumbersFromVuelo(vuelo);

  const isVuelta = direction === "VUELTA";

  const directOrigen = isVuelta
    ? getStringFromAny(vuelo.vuelta_origen, parsed.vuelta_origen, vuelo.ida_origen, parsed.ida_origen)
    : getStringFromAny(vuelo.ida_origen, parsed.ida_origen);

  const directDestino = isVuelta
    ? getStringFromAny(vuelo.vuelta_destino, parsed.vuelta_destino, vuelo.ida_destino, parsed.ida_destino)
    : getStringFromAny(vuelo.ida_destino, parsed.ida_destino);

  const directFecha = isVuelta
    ? getStringFromAny(vuelo.vuelta_fecha, parsed.vuelta_fecha, vuelo.ida_fecha, parsed.ida_fecha)
    : getStringFromAny(vuelo.ida_fecha, parsed.ida_fecha);

  const directSalida = isVuelta
    ? getStringFromAny(
        vuelo.vuelta_hora_salida,
        parsed.vuelta_hora_salida,
        vuelo.ida_hora_salida,
        parsed.ida_hora_salida
      )
    : getStringFromAny(vuelo.ida_hora_salida, parsed.ida_hora_salida);

  const directLlegada = isVuelta
    ? getStringFromAny(
        vuelo.vuelta_hora_llegada,
        parsed.vuelta_hora_llegada,
        vuelo.ida_hora_llegada,
        parsed.ida_hora_llegada
      )
    : getStringFromAny(vuelo.ida_hora_llegada, parsed.ida_hora_llegada);

  const directEscala = isVuelta
    ? getStringFromAny(vuelo.vuelta_escalas, parsed.vuelta_escalas, vuelo.ida_escalas, parsed.ida_escalas)
    : getStringFromAny(vuelo.ida_escalas, parsed.ida_escalas);

  const detalle = cleanLine(
    [
      isVuelta ? vuelo.vuelta_detalle : vuelo.ida_detalle,
      isVuelta ? parsed.vuelta_detalle : parsed.ida_detalle,
      vuelo.ruta_resumen,
      parsed.ruta_resumen,
      parsed.texto_libre,
      parsed.raw_text,
      vuelo.raw_text
    ].join(" ")
  );

  const salidaLlegadaMatch = detalle.match(
    /Salida\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}),?\s*llegada\s+(\d{4}-\d{2}-\d{2})\s+(\d{1,2}:\d{2}(?:\+\d)?)/i
  );

  const duracionMatch = detalle.match(/Duraci[oó]n\s+total\s+([^.]+)/i);
  const escalaMatch = detalle.match(/con\s+escala\s+en\s+(.+?)(?:\.|,|$)/i);

  const routeMatch = detalle.match(
    /Vuelo\s+(.+?)\s+\(([A-Z]{3})\)\s+a\s+(.+?)\s+\(([A-Z]{3})\)/i
  );

  const origen =
    getParsedRouteLabel(directOrigen) ||
    (routeMatch ? `${cleanLine(routeMatch[1])} (${cleanLine(routeMatch[2])})` : "Ruta a confirmar");

  const destino =
    getParsedRouteLabel(directDestino) ||
    (routeMatch ? `${cleanLine(routeMatch[3])} (${cleanLine(routeMatch[4])})` : "Ruta a confirmar");

  return {
    label: isVuelta ? "Vuelta" : "Ida",
    fecha: salidaLlegadaMatch ? formatDate(salidaLlegadaMatch[1]) : formatDate(directFecha),
    aerolinea: airline,
    numero: flightNumbers.join(" / ") || "—",
    origen,
    destino,
    salida: salidaLlegadaMatch ? salidaLlegadaMatch[2] : directSalida || "—",
    llegada: salidaLlegadaMatch ? salidaLlegadaMatch[4] : directLlegada || "—",
    duracion: cleanLine(duracionMatch?.[1] || "A confirmar"),
    escala: directEscala || (escalaMatch ? cleanLine(escalaMatch[1]) : "Directo / a confirmar")
  };
}

function getFlightRows(vuelo: PresupuestoVuelo): FlightDirectionRow[] {
  const direction = getDirectionFromVuelo(vuelo);
  const metadataLegs = parseFlightLegsFromMetadata(vuelo);

  const typedMetadataLegs =
    direction === "VUELTA"
      ? metadataLegs.filter((leg) => leg.tipo === "VUELTA" || leg.tipo === "")
      : direction === "IDA"
        ? metadataLegs.filter((leg) => leg.tipo === "IDA" || leg.tipo === "")
        : metadataLegs;

  if (typedMetadataLegs.length) {
    return buildRowsFromLegs(typedMetadataLegs, direction);
  }

  return [parseCommercialFlightSummary(vuelo, direction)];
}

function extractBaggage(vuelo: PresupuestoVuelo): string {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const text = [
    vuelo.equipaje,
    parsed.equipaje,
    vuelo.raw_text,
    vuelo.ida_detalle,
    vuelo.vuelta_detalle,
    parsed.texto_libre,
    parsed.raw_text
  ].join("\n");

  const normalized = normalizeText(text);

  const items: string[] = [];

  if (/mochila|bolso de mano|personal item/.test(normalized)) items.push("Bolso de mano");
  if (/cabina|carry/.test(normalized)) items.push("Carry on");
  if (/despachar|valija|equipaje facturado|checked baggage/.test(normalized)) {
    if (/costo extra|con costo|permite|adicional/.test(normalized)) {
      items.push("Equipaje despachado con costo");
    } else {
      items.push("Equipaje despachado");
    }
  }

  return items.length ? Array.from(new Set(items)).join(" + ") : "A confirmar";
}

function extractSeatSelection(vuelo: PresupuestoVuelo): string {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const metadataValue = getStringFromAny(
    metadata.seleccion_asientos,
    metadata.seleccion_de_asientos,
    metadata.asientos,
    parsed.seleccion_asientos,
    parsed.asientos
  );

  if (metadataValue) return metadataValue;

  const raw = String(vuelo.raw_text ?? "");

  if (/selecci[oó]n de asientos incluida|asientos incluidos/i.test(raw)) {
    return "Selección de asientos incluida según tarifa.";
  }

  if (/selecci[oó]n de asientos con costo|asientos con costo/i.test(raw)) {
    return "Selección de asientos con costo adicional.";
  }

  return "Sujeta a disponibilidad y condiciones de la tarifa.";
}

function renderVueloCard(vuelo: PresupuestoVuelo): string {
  const showPrice = shouldShowPrice(vuelo);
  const tieneCaptura = hasText(vuelo.captura_url);

  /*
    IMPORTANTE:
    raw_text se usa para que la IA pueda interpretar el vuelo,
    pero NO debe mostrarse en el PDF porque puede contener texto pegado,
    prompt, scraping completo o información repetida.
  */
  const mostrarTextoLibreVuelo = false;
  const textoLibre = mostrarTextoLibreVuelo ? cleanLine(vuelo.raw_text) : "";

  if (tieneCaptura) {
    return `
      <article class="flight-card">
        <div class="flight-capture">
          <img src="${escapeHtml(vuelo.captura_url)}" alt="Captura del aéreo" />
        </div>

            ${
          textoLibre
            ? `
              <div class="flight-free-text">
                ${nl2br(textoLibre)}
              </div>
            `
            : ""
        }

        ${
          showPrice
            ? `
              <div class="visible-price">
                <span>Valor del aéreo</span>
                <strong>${formatMoneyAR(vuelo.precio_total, vuelo.moneda)}</strong>
              </div>
            `
            : ""
        }

        ${vuelo.condiciones ? `<div class="small-note">${nl2br(vuelo.condiciones)}</div>` : ""}
      </article>
    `;
  }

  const rows = getFlightRows(vuelo);
  const seatSelection = extractSeatSelection(vuelo);
  const baggage = extractBaggage(vuelo);

  return `
    <article class="flight-card">
      <div class="table-wrap">
        <table class="flight-table">
          <thead>
            <tr>
              <th>Tramo</th>
              <th>Aerolínea / vuelo</th>
              <th>Origen</th>
              <th>Destino</th>
              <th>Salida</th>
              <th>Llegada</th>
              <th>Duración</th>
              <th>Escala</th>
            </tr>
          </thead>

          <tbody>
            ${rows
              .map(
                (row) => `
                  <tr>
                    <td>
                      <strong>${escapeHtml(row.label)}</strong>
                      <span>${escapeHtml(row.fecha)}</span>
                    </td>
                    <td>
                      <strong>${escapeHtml(row.aerolinea)}</strong>
                      <span>${escapeHtml(row.numero)}</span>
                    </td>
                    <td>${escapeHtml(row.origen)}</td>
                    <td>${escapeHtml(row.destino)}</td>
                    <td>${escapeHtml(row.salida)}</td>
                    <td>${escapeHtml(row.llegada)}</td>
                    <td>${escapeHtml(row.duracion)}</td>
                    <td>${escapeHtml(row.escala)}</td>
                  </tr>
                `
              )
              .join("")}
          </tbody>
        </table>
      </div>

      <div class="flight-bottom-grid">
        <div class="flight-note">
          <strong>Equipaje</strong>
          <span>${escapeHtml(baggage)}</span>
        </div>

        <div class="flight-note">
          <strong>Asientos</strong>
          <span>${escapeHtml(seatSelection)}</span>
        </div>
      </div>

          ${
        textoLibre
          ? `
            <div class="flight-free-text">
              ${nl2br(textoLibre)}
            </div>
          `
          : ""
      }

      ${
        showPrice
          ? `
            <div class="visible-price">
              <span>Valor del aéreo</span>
              <strong>${formatMoneyAR(vuelo.precio_total, vuelo.moneda)}</strong>
            </div>
          `
          : ""
      }

      ${vuelo.condiciones ? `<div class="small-note">${nl2br(vuelo.condiciones)}</div>` : ""}
    </article>
  `;
}

/* =========================================================
   HOTELES
========================================================= */

function getHotelGoogleData(hotel: PresupuestoHotel): SafeRecord {
  const metadata = getMetadata(hotel);

  return getNestedRecord(
    metadata.google_hotel ||
      metadata.googleHotel ||
      metadata.hotel_google ||
      metadata.google_places ||
      metadata.googlePlaces ||
      metadata.place ||
      metadata.place_details ||
      metadata.placeDetails ||
      metadata.enrichment ||
      metadata.enriquecimiento_google
  );
}

function pushPhotoCandidate(candidates: string[], value: unknown): void {
  if (!value) return;

  if (typeof value === "string") {
    const clean = value.trim();

    if (clean.startsWith("http") || clean.startsWith("/")) {
      candidates.push(clean);
    }

    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => pushPhotoCandidate(candidates, item));
    return;
  }

  if (typeof value === "object") {
    const record = value as SafeRecord;

    pushPhotoCandidate(candidates, record.url);
    pushPhotoCandidate(candidates, record.foto_url);
    pushPhotoCandidate(candidates, record.photo_url);
    pushPhotoCandidate(candidates, record.imagen_url);
    pushPhotoCandidate(candidates, record.image_url);
    pushPhotoCandidate(candidates, record.src);

    pushPhotoCandidate(candidates, record.imagenes);
    pushPhotoCandidate(candidates, record.fotos);
    pushPhotoCandidate(candidates, record.photos);
    pushPhotoCandidate(candidates, record.fotos_urls);
    pushPhotoCandidate(candidates, record.photo_urls);
    pushPhotoCandidate(candidates, record.photos_urls);
  }
}

function getHotelPhotos(hotel: PresupuestoHotel): string[] {
  const metadata = getMetadata(hotel);
  const google = getHotelGoogleData(hotel);

  const hotelMaestro = getNestedRecord(
    metadata.hotel_maestro ||
      metadata.hotelMaestro ||
      metadata.hotel_maestro_data ||
      metadata.hotelMaestroData ||
      metadata.hotel_base ||
      metadata.hotelBase ||
      metadata.maestro
  );

  const parsed = getNestedRecord(metadata.parsed);

  const candidates: string[] = [];

  pushPhotoCandidate(candidates, hotel.imagen_url);
  pushPhotoCandidate(candidates, hotel.captura_url);

  pushPhotoCandidate(candidates, metadata.imagen_url);
  pushPhotoCandidate(candidates, metadata.foto_url);
  pushPhotoCandidate(candidates, metadata.photo_url);
  pushPhotoCandidate(candidates, metadata.image_url);

  pushPhotoCandidate(candidates, hotelMaestro.imagen_url);
  pushPhotoCandidate(candidates, hotelMaestro.foto_url);
  pushPhotoCandidate(candidates, hotelMaestro.imagenes);
  pushPhotoCandidate(candidates, hotelMaestro.fotos);
  pushPhotoCandidate(candidates, hotelMaestro.photos);

  pushPhotoCandidate(candidates, parsed.imagen_url);
  pushPhotoCandidate(candidates, parsed.foto_url);
  pushPhotoCandidate(candidates, parsed.imagenes);
  pushPhotoCandidate(candidates, parsed.fotos);
  pushPhotoCandidate(candidates, parsed.photos);

  pushPhotoCandidate(candidates, google.foto_url);
  pushPhotoCandidate(candidates, google.photo_url);
  pushPhotoCandidate(candidates, google.imagen_url);
  pushPhotoCandidate(candidates, google.fotos);
  pushPhotoCandidate(candidates, google.photos);
  pushPhotoCandidate(candidates, google.photo_urls);
  pushPhotoCandidate(candidates, google.photos_urls);

  pushPhotoCandidate(candidates, metadata.imagenes);
  pushPhotoCandidate(candidates, metadata.fotos);
  pushPhotoCandidate(candidates, metadata.photos);
  pushPhotoCandidate(candidates, metadata.fotos_urls);
  pushPhotoCandidate(candidates, metadata.photo_urls);
  pushPhotoCandidate(candidates, metadata.photos_urls);

  return Array.from(new Set(candidates)).slice(0, 4);
}

function getHotelRating(hotel: PresupuestoHotel): string {
  const metadata = getMetadata(hotel);
  const google = getHotelGoogleData(hotel);

  const rating = getNumberFromAny(metadata.rating, metadata.google_rating, google.rating);
  const total = getNumberFromAny(
    metadata.user_ratings_total,
    metadata.reviews_total,
    google.user_ratings_total,
    google.reviews_total
  );

  if (!rating) return "";

  return `${rating.toFixed(1).replace(".", ",")} / 5${total ? ` · ${total} reseñas` : ""}`;
}

function getHotelAddress(hotel: PresupuestoHotel): string {
  const metadata = getMetadata(hotel);
  const google = getHotelGoogleData(hotel);

  return getStringFromAny(
    metadata.direccion_original,
    metadata.direccion,
    metadata.formatted_address,
    metadata.address,
    google.direccion,
    google.formatted_address,
    google.address,
    hotel.zona
  );
}

function renderHotelPhotos(photos: string[]): string {
  if (!photos.length) return "";

  return `
    <div class="hotel-photo-grid count-${photos.length}">
      ${photos.map((photo) => `<div><img src="${escapeHtml(photo)}" /></div>`).join("")}
    </div>
  `;
}

function renderHotelCard(hotel: PresupuestoHotel): string {
  const showPrice = shouldShowPrice(hotel);
  const photos = getHotelPhotos(hotel);
  const rating = getHotelRating(hotel);
  const address = getHotelAddress(hotel);

  return `
    <article class="hotel-card">
      ${renderHotelPhotos(photos)}

      <div class="hotel-head">
        <div>
          <div class="eyebrow">Hotel</div>
          <h3>${escapeHtml(hotel.nombre || "Hotel")}</h3>
          <p>${escapeHtml(hotel.destino || "Destino no especificado")}</p>
        </div>
        ${hotel.es_principal ? `<span class="mini-badge">Principal</span>` : ""}
      </div>

      <div class="hotel-info-grid">
        ${renderInfoItem("Check-in", formatDate(hotel.check_in))}
        ${renderInfoItem("Check-out", formatDate(hotel.check_out))}
        ${renderInfoItem("Noches", hotel.noches ?? "—")}
        ${hotel.regimen ? renderInfoItem("Régimen", hotel.regimen) : ""}
        ${hotel.habitacion ? renderInfoItem("Habitación", hotel.habitacion) : ""}
        ${hotel.ocupacion ? renderInfoItem("Ocupación", hotel.ocupacion) : ""}
      </div>

      ${
        address || rating
          ? `
            <div class="hotel-google-box">
              ${address ? `<span><strong>Dirección:</strong> ${escapeHtml(address)}</span>` : ""}
              ${rating ? `<span><strong>Google:</strong> ${escapeHtml(rating)}</span>` : ""}
            </div>
          `
          : ""
      }

      ${hotel.descripcion ? `<div class="text-box">${nl2br(hotel.descripcion)}</div>` : ""}

      ${
        hotel.beneficios
          ? `
            <div class="included-box">
              <strong>Destacados</strong>
              <div>${nl2br(hotel.beneficios)}</div>
            </div>
          `
          : ""
      }

      ${
        showPrice
          ? `
            <div class="visible-price">
              <span>Valor del hotel</span>
              <strong>${formatMoneyAR(hotel.precio_total, hotel.moneda)}</strong>
            </div>
          `
          : ""
      }

      ${hotel.condiciones ? `<div class="small-note">${nl2br(hotel.condiciones)}</div>` : ""}
      ${hotel.politica_cancelacion ? `<div class="small-note">${nl2br(hotel.politica_cancelacion)}</div>` : ""}
    </article>
  `;
}

/* =========================================================
   SERVICIOS / PRECIOS
========================================================= */

function renderServicioCard(servicio: PresupuestoServicio): string {
  const showPrice = shouldShowPrice(servicio);

  return `
    <article class="service-row">
      <div>
        <div class="service-title">
          ${escapeHtml(servicio.nombre || "Servicio")}
          ${servicio.incluido ? `<span>Incluido</span>` : ""}
          ${servicio.opcional ? `<span class="amber">Opcional</span>` : ""}
        </div>
        ${servicio.descripcion ? `<div class="service-desc">${nl2br(servicio.descripcion)}</div>` : ""}
      </div>

      ${
        servicio.incluido
          ? `<strong>Incluido</strong>`
          : showPrice
            ? `<strong>${formatMoneyAR(servicio.precio_total, servicio.moneda)}</strong>`
            : ""
      }
    </article>
  `;
}

function renderPaymentGrid(combinacion: PresupuestoCombinacion): string {
  const items = [
    combinacion.precio_contado
      ? renderInfoItem("Contado", formatMoneyAR(combinacion.precio_contado, combinacion.moneda))
      : "",
    combinacion.precio_transferencia
      ? renderInfoItem("Transferencia", formatMoneyAR(combinacion.precio_transferencia, combinacion.moneda))
      : "",
    combinacion.precio_tarjeta
      ? renderInfoItem("Tarjeta", formatMoneyAR(combinacion.precio_tarjeta, combinacion.moneda))
      : "",
    combinacion.seña ? renderInfoItem("Seña", formatMoneyAR(combinacion.seña, combinacion.moneda)) : "",
    combinacion.saldo ? renderInfoItem("Saldo", formatMoneyAR(combinacion.saldo, combinacion.moneda)) : ""
  ]
    .filter(Boolean)
    .join("");

  if (!items) return "";

  return `<div class="payment-grid">${items}</div>`;
}

function renderCombinacionCard(
  combinacion: PresupuestoCombinacion,
  presupuesto: PresupuestoV2,
  recommendedId: string | null
): string {
  const pax = getTotalPax(presupuesto);
  const precioPorPasajero = combinacion.precio_total / pax;
  const isRecommended = recommendedId === combinacion.id;

  return `
    <article class="option-card ${isRecommended ? "recommended" : ""}">
      <div class="option-head">
        <div>
          <div class="eyebrow">${isRecommended ? "Opción destacada" : combinacion.etiqueta || "Opción"}</div>
          <h3>${escapeHtml(combinacion.nombre || "Opción")}</h3>
          ${combinacion.subtitulo ? `<p>${escapeHtml(combinacion.subtitulo)}</p>` : ""}
        </div>

        <div class="price-box">
          <small>Precio total</small>
          <strong>${formatMoneyAR(combinacion.precio_total, combinacion.moneda)}</strong>
          <em>${formatMoneyAR(precioPorPasajero, combinacion.moneda)} por pasajero</em>
        </div>
      </div>

      ${combinacion.descripcion ? `<div class="text-box">${nl2br(combinacion.descripcion)}</div>` : ""}
      ${renderPaymentGrid(combinacion)}

      ${
        combinacion.forma_pago_resumen
          ? `
            <div class="included-box blue-box">
              <strong>Forma de pago</strong>
              <div>${nl2br(combinacion.forma_pago_resumen)}</div>
            </div>
          `
          : ""
      }

      ${
        combinacion.incluye_resumen
          ? `
            <div class="included-box">
              <strong>Incluye</strong>
              <div>${nl2br(combinacion.incluye_resumen)}</div>
            </div>
          `
          : ""
      }

      ${
        combinacion.no_incluye_resumen
          ? `
            <div class="small-note">
              <strong>No incluye:</strong><br />
              ${nl2br(combinacion.no_incluye_resumen)}
            </div>
          `
          : ""
      }

      ${
        combinacion.condiciones_pago
          ? `
            <div class="small-note">
              <strong>Condiciones de pago:</strong><br />
              ${nl2br(combinacion.condiciones_pago)}
            </div>
          `
          : ""
      }

      ${combinacion.notas ? `<div class="small-note">${nl2br(combinacion.notas)}</div>` : ""}
    </article>
  `;
}

function renderResumenViaje(presupuesto: PresupuestoV2): string {
  const items = [
    renderInfoItem("Cliente", getDisplayName(presupuesto)),
    renderInfoItem("Teléfono", presupuesto.cliente_telefono),
    renderInfoItem("Email", presupuesto.cliente_email),
    renderInfoItem("Destino", presupuesto.destino_detalle || presupuesto.destino_principal),
    renderInfoItem("Salida", formatDate(presupuesto.fecha_salida)),
    renderInfoItem("Regreso", formatDate(presupuesto.fecha_regreso)),
    renderInfoItem("Pasajeros", getPasajerosLabel(presupuesto)),
    renderInfoItem("Noches", presupuesto.noches ?? "—"),
    renderInfoItem("Validez", presupuesto.validez_hasta || "Sujeto a disponibilidad")
  ]
    .filter(Boolean)
    .join("");

  return `<div class="client-grid">${items}</div>`;
}

function renderRecommendedHero(recommended: PresupuestoCombinacion, presupuesto: PresupuestoV2): string {
  const pax = getTotalPax(presupuesto);
  const precioPorPasajero = recommended.precio_total / pax;

  return `
    <div class="recommended-hero compact-price-hero">
      <div class="compact-price-left">
        <div class="eyebrow">Opción destacada</div>
        <h2>${escapeHtml(recommended.nombre || "Opción")}</h2>
        ${
          recommended.subtitulo || recommended.descripcion
            ? `<p>${escapeHtml(recommended.subtitulo || recommended.descripcion)}</p>`
            : ""
        }
      </div>

      <div class="compact-price-right">
        <span>Precio total del paquete</span>
        <strong>${formatMoneyAR(recommended.precio_total, recommended.moneda)}</strong>
        <em>${formatMoneyAR(precioPorPasajero, recommended.moneda)} por pasajero</em>
      </div>

      ${
        recommended.forma_pago_resumen
          ? `<div class="compact-price-payment">${escapeHtml(recommended.forma_pago_resumen)}</div>`
          : ""
      }
    </div>
  `;
}

function renderFooter(presupuesto: PresupuestoV2): string {
  return `
    <footer class="footer">
      <div class="footer-title">ALMUNDO Franquicia Córdoba</div>
      <div class="footer-text">${nl2br(presupuesto.footer_text)}</div>
    </footer>
  `;
}

/* =========================================================
   HTML PRINCIPAL
========================================================= */

export function buildPresupuestoHtml(data: PresupuestoPdfData): string {
  const { presupuesto } = data;

  const vuelos = dedupeVuelos(data.vuelos.filter((item) => item.incluir_en_pdf !== false));
  const hoteles = dedupeHoteles(data.hoteles.filter((item) => item.incluir_en_pdf !== false));
  const servicios = dedupeServicios(data.servicios.filter((item) => item.incluir_en_pdf !== false));
  const combinaciones = dedupeCombinaciones(
    data.combinaciones.filter((item) => item.visible_en_pdf !== false)
  );

  const recommended = getRecommendedCombinacion(presupuesto, combinaciones);
  const recommendedId = recommended?.id || null;

  const combinacionesSinRecomendada =
    recommendedId && combinaciones.length > 1
      ? combinaciones.filter((item) => item.id !== recommendedId)
      : [];

  const cliente = getDisplayName(presupuesto);
  const titulo =
    presupuesto.titulo ||
    presupuesto.destino_detalle ||
    presupuesto.destino_principal ||
    "Propuesta de viaje";

  const generatedAt = formatDateTime(new Date().toISOString());

  const resumenSection = renderSection("Datos del viaje", renderResumenViaje(presupuesto));

  const introSection = presupuesto.intro_comercial
    ? renderSection("Propuesta comercial", `<div class="intro-box">${nl2br(presupuesto.intro_comercial)}</div>`)
    : "";

  const vuelosSection = vuelos.length
    ? renderSection("Vuelos", vuelos.map((vuelo) => renderVueloCard(vuelo)).join(""), "compact-section")
    : "";

  const hotelesSection = hoteles.length
    ? renderSection("Hotel", hoteles.map(renderHotelCard).join(""), "compact-section")
    : "";

  const serviciosSection = servicios.length
    ? renderSection(
        "Servicios incluidos y adicionales",
        servicios.map(renderServicioCard).join(""),
        "compact-section"
      )
    : "";

  const recommendedSection = recommended
    ? renderSection("Precio destacado", renderRecommendedHero(recommended, presupuesto))
    : "";

  const combinacionesSection = combinacionesSinRecomendada.length
    ? renderSection(
        "Otras opciones de precio",
        combinacionesSinRecomendada
          .map((item) => renderCombinacionCard(item, presupuesto, recommendedId))
          .join("")
      )
    : "";

  const condicionesSection = presupuesto.condiciones_generales
    ? `
      <section class="conditions">
        <strong>Condiciones generales</strong><br />
        ${nl2br(presupuesto.condiciones_generales)}
      </section>
    `
    : "";

  return `
<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(presupuesto.numero || "Presupuesto NOSTUR")}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />

  <style>
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

        .flight-capture {
      overflow: hidden;
      margin: -4px -4px 12px -4px;
      border-radius: 18px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      background: #f8fafc;
    }

    .flight-capture img {
      display: block;
      width: 100%;
      max-height: 360px;
      object-fit: contain;
      background: #ffffff;
    }

    .flight-free-text {
      margin-top: 10px;
      border-radius: 16px;
      padding: 11px 12px;
      background: #f8fafc;
      color: #334155;
      font-size: 11px;
      font-weight: 650;
      line-height: 1.5;
      white-space: normal;
    }


    html,
    body {
      margin: 0;
      padding: 0;
      background: #eef1f6;
      color: #1f2937;
      font-family: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      font-size: 12px;
      line-height: 1.42;
    }

    body {
      padding: 24px 0;
    }

    .preview-toolbar {
      position: sticky;
      top: 0;
      z-index: 50;
      width: 794px;
      margin: 0 auto 14px auto;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 12px 14px;
      border: 1px solid rgba(15, 23, 42, 0.10);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(12px);
      box-shadow: 0 16px 35px rgba(15, 23, 42, 0.10);
    }

    .preview-toolbar strong {
      display: block;
      font-size: 13px;
      color: #111827;
    }

    .preview-toolbar span {
      display: block;
      margin-top: 2px;
      font-size: 11px;
      font-weight: 700;
      color: #64748b;
    }

    .preview-toolbar button {
      height: 38px;
      border: 0;
      border-radius: 14px;
      padding: 0 16px;
      background: #e95512;
      color: #fff;
      font-size: 12px;
      font-weight: 900;
      cursor: pointer;
      box-shadow: 0 10px 22px rgba(233, 85, 18, 0.22);
    }

    .page {
      width: 794px;
      min-height: 1123px;
      margin: 0 auto;
      background: #ffffff;
      border-radius: 22px;
      overflow: hidden;
      box-shadow: 0 28px 80px rgba(15, 23, 42, 0.18);
    }

    .cover {
      position: relative;
      padding: 24px 38px 24px 38px;
      background:
        radial-gradient(circle at 88% 12%, rgba(255, 255, 255, 0.20), transparent 28%),
        linear-gradient(135deg, #f37021 0%, #e95512 42%, #d84b0f 100%);
      color: #fff;
    }

    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 24px;
    }

    .brand-box {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 44px;
      min-width: 160px;
      padding: 8px 16px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.96);
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.12);
    }

    .brand-box img {
      max-width: 150px;
      max-height: 31px;
      object-fit: contain;
      display: block;
    }

    .brand-fallback {
      color: #e95512;
      font-size: 23px;
      font-weight: 1000;
      letter-spacing: -0.03em;
    }

    .doc-number {
      text-align: right;
      font-size: 10px;
      font-weight: 800;
      color: rgba(255, 255, 255, 0.86);
    }

    .doc-number strong {
      display: block;
      margin-top: 3px;
      font-size: 15px;
      color: #fff;
    }

    .cover-title {
      margin-top: 24px;
      max-width: none;
    }

    .cover-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-top: 7px;
      width: 100%;
      flex-wrap: wrap;
    }

    .cover-title-row h1 {
      margin: 0;
      flex-shrink: 0;
    }

    .inline-badges {
      margin-top: 0 !important;
      justify-content: flex-end;
      flex: 1;
    }

    .badges {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin-top: 0;
    }

    .cover-title .kicker {
      font-size: 10px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.18em;
      color: rgba(255, 255, 255, 0.78);
    }

    .cover-title h1 {
      margin: 7px 0 0 0;
      font-size: 30px;
      line-height: 1.05;
      letter-spacing: -0.045em;
      color: #fff;
    }

    .cover-title p {
      margin: 8px 0 0 0;
      font-size: 13px;
      font-weight: 750;
      color: rgba(255, 255, 255, 0.88);
    }

    .badge {
      display: inline-flex;
      align-items: center;
      min-height: 24px;
      padding: 5px 10px;
      border-radius: 999px;
      background: rgba(255, 255, 255, 0.18);
      color: #fff;
      font-size: 9px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.08em;
    }

    .content {
      padding: 22px 38px 28px 38px;
    }

    .section {
      margin-bottom: 18px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .compact-section {
      margin-bottom: 16px;
    }

    .section-title {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
      margin-bottom: 9px;
    }

    .section-title h2 {
      margin: 0;
      font-size: 16px;
      line-height: 1.1;
      letter-spacing: -0.025em;
      color: #111827;
    }

    .section-title span {
      height: 4px;
      flex: 1;
      border-radius: 999px;
      background: linear-gradient(90deg, #f37021, rgba(243, 112, 33, 0));
    }

    .client-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 7px;
      padding: 10px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 20px;
      background: #f8fafc;
    }

    .info-item {
      min-height: 44px;
      border: 0;
      border-radius: 13px;
      padding: 8px 9px;
      background: #ffffff;
    }

    .info-label {
      margin-bottom: 3px;
      font-size: 7.8px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.13em;
      color: #64748b;
    }

    .info-value {
      font-size: 10.8px;
      font-weight: 900;
      color: #111827;
    }

    .intro-box,
    .text-box {
      border-radius: 16px;
      padding: 11px 12px;
      background: #f8fafc;
      color: #334155;
      font-size: 11px;
      font-weight: 650;
    }

    .intro-box {
      border: 1px solid rgba(243, 112, 33, 0.22);
      background: #fff7ed;
      color: #4b2a17;
    }

    .eyebrow {
      font-size: 8.5px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: #e95512;
    }

    .mini-badge {
      display: inline-flex;
      align-items: center;
      min-height: 23px;
      padding: 5px 9px;
      border-radius: 999px;
      background: #fff7ed;
      color: #c2410c;
      font-size: 8.5px;
      font-weight: 950;
      text-transform: uppercase;
    }

    .flight-card,
    .hotel-card,
    .option-card {
      margin-bottom: 12px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 22px;
      background: #fff;
      box-shadow: 0 10px 22px rgba(15, 23, 42, 0.04);
      padding: 14px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .table-wrap {
      overflow: hidden;
      border: 1px solid rgba(15, 23, 42, 0.12);
      border-radius: 16px;
    }

    .flight-table {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }

    .flight-table th {
      background: #f8fafc;
      color: #475569;
      font-size: 9px;
      text-align: left;
      font-weight: 1000;
      padding: 8px 7px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.10);
    }

    .flight-table td {
      padding: 9px 7px;
      border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      border-right: 1px solid rgba(15, 23, 42, 0.06);
      color: #334155;
      font-size: 9.4px;
      font-weight: 760;
      vertical-align: top;
      overflow-wrap: anywhere;
    }

    .flight-table tr:last-child td {
      border-bottom: 0;
    }

    .flight-table td:last-child {
      border-right: 0;
    }

    .flight-table th:nth-child(1),
    .flight-table td:nth-child(1) {
      width: 10%;
    }

    .flight-table th:nth-child(2),
    .flight-table td:nth-child(2) {
      width: 16%;
    }

    .flight-table th:nth-child(3),
    .flight-table td:nth-child(3),
    .flight-table th:nth-child(4),
    .flight-table td:nth-child(4) {
      width: 15%;
    }

    .flight-table th:nth-child(5),
    .flight-table td:nth-child(5),
    .flight-table th:nth-child(6),
    .flight-table td:nth-child(6) {
      width: 8%;
    }

    .flight-table th:nth-child(7),
    .flight-table td:nth-child(7) {
      width: 10%;
    }

    .flight-table th:nth-child(8),
    .flight-table td:nth-child(8) {
      width: 18%;
    }

    .flight-table td strong {
      display: block;
      color: #111827;
      font-size: 10.4px;
      font-weight: 1000;
    }

    .flight-table td span {
      display: block;
      margin-top: 2px;
      color: #64748b;
      font-size: 9px;
      font-weight: 800;
    }

    .flight-bottom-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-top: 10px;
    }

    .flight-note,
    .small-note {
      margin-top: 0;
      border-radius: 15px;
      padding: 10px 11px;
      background: #fff7ed;
      color: #7c2d12;
      font-size: 10.5px;
      font-weight: 650;
    }

    .flight-note strong {
      display: block;
      margin-bottom: 5px;
      font-size: 9.5px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .flight-note span {
      display: block;
      font-size: 11px;
      font-weight: 850;
    }

    .hotel-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 14px;
      margin-bottom: 10px;
    }

    .hotel-head h3 {
      margin: 3px 0 0 0;
      font-size: 18px;
      letter-spacing: -0.025em;
      color: #111827;
    }

    .hotel-head p {
      margin: 3px 0 0 0;
      color: #64748b;
      font-weight: 850;
      font-size: 12px;
    }

    .hotel-photo-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: 118px;
      gap: 7px;
      margin: -4px -4px 12px -4px;
    }

    .hotel-photo-grid.count-1 {
      grid-template-columns: 1fr;
      grid-template-rows: 190px;
    }

    .hotel-photo-grid.count-2 {
      grid-template-columns: 1fr 1fr;
      grid-template-rows: 170px;
    }

    .hotel-photo-grid.count-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      grid-template-rows: 135px;
    }

    .hotel-photo-grid.count-4 {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      grid-template-rows: 118px;
    }

    .hotel-photo-grid div {
      overflow: hidden;
      border-radius: 16px;
      background: #f1f5f9;
    }

    .hotel-photo-grid img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }

    .hotel-info-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
    }

    .hotel-info-grid .info-item {
      min-height: 52px;
      padding: 9px 10px;
      background: #f8fafc;
    }

    .hotel-google-box {
      display: grid;
      gap: 4px;
      margin-top: 9px;
      border-radius: 16px;
      padding: 10px 11px;
      background: #eff6ff;
      color: #1d4ed8;
      font-size: 10px;
      font-weight: 750;
      overflow-wrap: anywhere;
    }

    .hotel-google-box strong {
      color: #1e3a8a;
      font-weight: 1000;
    }

    .included-box {
      margin-top: 10px;
      border: 1px solid rgba(16, 185, 129, 0.18);
      border-radius: 16px;
      padding: 11px 12px;
      background: #ecfdf5;
      color: #065f46;
      font-size: 11px;
      font-weight: 650;
    }

    .included-box.blue-box {
      border-color: rgba(14, 165, 233, 0.20);
      background: #eff6ff;
      color: #1d4ed8;
    }

    .included-box strong {
      display: block;
      margin-bottom: 5px;
      font-size: 9.5px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .visible-price {
      margin-top: 9px;
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: center;
      border-radius: 15px;
      padding: 10px 11px;
      background: #f8fafc;
      border: 1px solid rgba(15, 23, 42, 0.08);
    }

    .visible-price span {
      font-size: 9.5px;
      font-weight: 1000;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
    }

    .visible-price strong {
      font-size: 12.5px;
      font-weight: 1000;
      color: #111827;
      white-space: nowrap;
    }

    .service-row {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
      margin-bottom: 8px;
      padding: 12px 13px;
      border: 1px solid rgba(15, 23, 42, 0.08);
      border-radius: 17px;
      background: #f8fafc;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .service-title {
      font-size: 12.5px;
      font-weight: 950;
      color: #111827;
    }

    .service-title span {
      display: inline-flex;
      margin-left: 6px;
      padding: 3px 7px;
      border-radius: 999px;
      background: #dcfce7;
      color: #166534;
      font-size: 8.5px;
      font-weight: 950;
      text-transform: uppercase;
    }

    .service-title span.amber {
      background: #fef3c7;
      color: #92400e;
    }

    .service-desc {
      margin-top: 4px;
      color: #64748b;
      font-size: 10.5px;
      font-weight: 700;
    }

    .service-row > strong {
      white-space: nowrap;
      color: #111827;
      font-size: 12px;
      font-weight: 950;
    }

    .recommended-hero {
      border: 1px solid rgba(16, 185, 129, 0.20);
      border-radius: 22px;
      background:
        radial-gradient(circle at 90% 10%, rgba(16, 185, 129, 0.14), transparent 32%),
        linear-gradient(135deg, #ecfdf5, #f8fafc);
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .recommended-hero .eyebrow {
      color: #047857;
    }

    .compact-price-hero {
      display: grid;
      grid-template-columns: 1fr auto;
      align-items: center;
      gap: 18px;
      padding: 16px 18px;
    }

    .compact-price-left h2 {
      margin: 4px 0 0 0;
      font-size: 19px;
      letter-spacing: -0.035em;
      color: #111827;
    }

    .compact-price-left p {
      margin: 4px 0 0 0;
      color: #475569;
      font-size: 11.5px;
      font-weight: 800;
    }

    .compact-price-right {
      min-width: 250px;
      text-align: right;
    }

    .compact-price-right span {
      display: block;
      font-size: 9px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #64748b;
    }

    .compact-price-right strong {
      display: block;
      margin-top: 3px;
      font-size: 25px;
      line-height: 1;
      letter-spacing: -0.05em;
      color: #111827;
    }

    .compact-price-right em {
      display: block;
      margin-top: 5px;
      font-style: normal;
      font-size: 10.5px;
      font-weight: 900;
      color: #047857;
    }

    .compact-price-payment {
      grid-column: 1 / -1;
      margin-top: -6px;
      color: #475569;
      font-size: 10.5px;
      font-weight: 750;
    }

    .option-card {
      padding: 16px;
      margin-bottom: 12px;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .option-card.recommended {
      border-color: rgba(16, 185, 129, 0.22);
      background: linear-gradient(135deg, #ecfdf5, #ffffff);
    }

    .option-head {
      display: flex;
      justify-content: space-between;
      gap: 18px;
      align-items: flex-start;
    }

    .option-card h3 {
      margin: 3px 0 0 0;
      font-size: 16px;
      letter-spacing: -0.025em;
      color: #111827;
    }

    .option-card p {
      margin: 4px 0 0 0;
      color: #64748b;
      font-weight: 700;
      font-size: 11.5px;
    }

    .price-box {
      min-width: 160px;
      text-align: right;
    }

    .price-box small {
      display: block;
      margin-bottom: 4px;
      color: #64748b;
      font-size: 8.5px;
      font-weight: 950;
      text-transform: uppercase;
      letter-spacing: 0.12em;
    }

    .price-box strong {
      display: block;
      color: #111827;
      font-size: 21px;
      font-weight: 1000;
      letter-spacing: -0.04em;
    }

    .price-box em {
      display: block;
      margin-top: 4px;
      font-style: normal;
      color: #047857;
      font-size: 10px;
      font-weight: 900;
    }

    .payment-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }

    .conditions {
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      margin-top: 20px;
      padding-top: 14px;
      color: #475569;
      font-size: 10.5px;
      font-weight: 650;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .conditions strong {
      color: #111827;
      font-size: 12px;
      font-weight: 1000;
    }

    .footer {
      margin-top: 20px;
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      padding-top: 12px;
      color: #64748b;
      font-size: 9.5px;
      font-weight: 750;
      line-height: 1.45;
      text-align: center;
    }

    .footer-title {
      margin-bottom: 4px;
      color: #111827;
      font-size: 10.5px;
      font-weight: 950;
    }

    .footer-text {
      max-width: 620px;
      margin: 0 auto;
    }

    .no-print {
      display: block;
    }

    @media print {
      @page {
        size: A4;
        margin: 14mm 0 16mm 0;
      }

            .flight-capture img {
        max-height: 78mm;
      }

      html,
      body {
        width: 210mm;
        min-height: 297mm;
        background: #fff;
        padding: 0;
      }

      .no-print {
        display: none !important;
      }

      .page {
        width: 210mm;
        min-height: auto;
        margin: 0;
        border-radius: 0;
        box-shadow: none;
        overflow: visible;
      }

      .cover {
        margin-top: -14mm;
        padding: 18mm 11mm 11mm 11mm;
      }

      .content {
        padding: 11mm 10mm 14mm 10mm;
      }

      .section,
      .flight-card,
      .hotel-card,
      .option-card,
      .service-row,
      .recommended-hero,
      .conditions,
      .footer {
        break-inside: avoid;
        page-break-inside: avoid;
      }

      .section {
        margin-bottom: 15px;
      }

      .flight-card,
      .hotel-card,
      .option-card {
        box-shadow: none;
      }

      .hotel-photo-grid.count-4 {
        grid-template-columns: repeat(4, minmax(0, 1fr));
        grid-template-rows: 30mm;
      }

      .hotel-photo-grid.count-3 {
        grid-template-columns: repeat(3, minmax(0, 1fr));
        grid-template-rows: 34mm;
      }

      .hotel-photo-grid.count-2 {
        grid-template-columns: 1fr 1fr;
        grid-template-rows: 42mm;
      }

      .hotel-photo-grid.count-1 {
        grid-template-columns: 1fr;
        grid-template-rows: 48mm;
      }

      .flight-table th,
      .flight-table td {
        font-size: 8px;
        padding: 6px 5px;
      }

      .flight-table td strong {
        font-size: 8.8px;
      }

      .flight-table td span {
        font-size: 7.8px;
      }
    }
  </style>
</head>

<body>
  <div class="preview-toolbar no-print">
    <div>
      <strong>Vista previa del presupuesto</strong>
      <span>Revisalo. Para guardar en PDF usá “Imprimir / Guardar como PDF”.</span>
    </div>

    <button onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>

  <main class="page">
    <section class="cover">
      <div class="brand-row">
        <div class="brand-box">
          <img src="${ALMUNDO_LOGO_URL}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';" />
          <div class="brand-fallback" style="display:none;">almundo</div>
        </div>

        <div class="doc-number">
          Presupuesto
          <strong>${escapeHtml(presupuesto.numero || "BORRADOR")}</strong>
          <div>Generado: ${escapeHtml(generatedAt)}</div>
        </div>
      </div>

      <div class="cover-title">
        <div class="kicker">Propuesta de viaje</div>

        <div class="cover-title-row">
          <h1>${escapeHtml(titulo)}</h1>

          <div class="badges inline-badges">
            ${renderBadge(presupuesto.destino_principal || "Destino")}
            ${renderBadge(`${formatDate(presupuesto.fecha_salida)} al ${formatDate(presupuesto.fecha_regreso)}`)}
            ${renderBadge(getPasajerosLabel(presupuesto))}
            ${presupuesto.noches ? renderBadge(`${presupuesto.noches} noches`) : ""}
          </div>
        </div>

        <p>Preparado para ${escapeHtml(cliente)}</p>
      </div>
    </section>

    <section class="content">
      ${resumenSection}
      ${introSection}
      ${vuelosSection}
      ${hotelesSection}
      ${serviciosSection}
      ${recommendedSection}
      ${combinacionesSection}
      ${condicionesSection}
      ${renderFooter(presupuesto)}
    </section>
  </main>
</body>
</html>
`;
}

/* =========================================================
   ACCIONES
========================================================= */

export function openPresupuestoPreview(data: PresupuestoPdfData): boolean {
  const html = buildPresupuestoHtml(data);
  const previewWindow = window.open("", "_blank", "width=980,height=920");

  if (!previewWindow) {
    return false;
  }

  previewWindow.document.open();
  previewWindow.document.write(html);
  previewWindow.document.close();
  previewWindow.focus();

  return true;
}

export function downloadPresupuestoHtml(data: PresupuestoPdfData): void {
  const html = buildPresupuestoHtml(data);
  const presupuesto = data.presupuesto;
  const filename = `${presupuesto.numero || "presupuesto"}-${presupuesto.cliente_nombre || "cliente"}.html`
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}