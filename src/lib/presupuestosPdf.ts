// src/lib/presupuestosPdf.ts

import type {
  PresupuestoCombinacion,
  PresupuestoHotel,
  PresupuestoServicio,
  PresupuestoV2,
  PresupuestoVuelo
} from "../store/presupuestosV2Store";
import { formatMoneyAR as formatMoneyARBase } from "./formatters";

/* =========================================================
   NOSSIX / NOSTUR — PRESUPUESTOS PDF / PREVIEW

   Enfoque:
   - Presupuesto como propuesta comercial de turismo.
   - PDF armado por opciones: Opción 1 = vuelo + hotel + servicios.
   - Luego resumen rápido de opciones.
   - Luego precios, pagos, promos e incluye/no incluye por opción.
   - Nunca divide precio total / pasajeros salvo que metadata lo indique.
   - Cuotas sin tarjeta/banco = pagos a cuenta.
   - Compatible con presupuestos manuales y generados por IA.
========================================================= */

export type PresupuestoPdfData = {
  presupuesto: PresupuestoV2;
  vuelos: PresupuestoVuelo[];
  hoteles: PresupuestoHotel[];
  servicios: PresupuestoServicio[];
  combinaciones: PresupuestoCombinacion[];
};



type SafeRecord = Record<string, unknown>;

type PresupuestoDestinoPdf = {
  pais: string;
  destino: string;
};

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

type FormaPagoFlexible = {
  id?: string;
  tipo?: string;
  titulo?: string;
  descripcion?: string;
  moneda?: string;
  monto?: number | null;
  porcentaje?: number | null;
  cuotas?: number | null;
  valor_cuota?: number | null;
  total_financiado?: number | null;
  tarjeta?: string | null;
  banco?: string | null;
  con_interes?: boolean | null;
  tasa_interes?: number | null;
  fecha_vencimiento?: string | null;
  visible_en_pdf?: boolean;
};

type PromoFlexible = {
  id?: string;
  nombre?: string;
  descripcion?: string;
  descuento_monto?: number | null;
  descuento_porcentaje?: number | null;
  monto?: number | null;
  porcentaje?: number | null;
  moneda?: string | null;
  vigencia_hasta?: string | null;
  visible_en_pdf?: boolean;
};

type TarifaPasajeroFlexible = {
  id?: string;
  tipo?: string;
  descripcion?: string;
  nombre?: string;
  cantidad?: number | null;
  precio_unitario?: number | null;
  subtotal?: number | null;
  moneda?: string | null;
  notas?: string | null;
  visible_en_pdf?: boolean;
};

const ALMUNDO_LOGO_URL = "/brand/almundo-logo.png";

/* =========================================================
   HELPERS GENERALES
========================================================= */

function formatMoneyAR(value: number | null | undefined, moneda?: string | null): string {
  const amount = Number(value || 0);

  if (!Number.isFinite(amount)) {
    return formatMoneyARBase(0, moneda || "USD");
  }

  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(Math.round(amount));

  return `${formatted} ${moneda || "USD"}`;
}

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

function cleanBlock(value: unknown): string {
  return String(value ?? "")
    .replace(/\r/g, "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
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
  if (!item?.metadata || typeof item.metadata !== "object" || Array.isArray(item.metadata)) {
    return {};
  }

  return item.metadata;
}

function getPresupuestoExtra(presupuesto: PresupuestoV2): SafeRecord {
  return presupuesto as unknown as SafeRecord;
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

function getBlockFromAny(...values: unknown[]): string {
  for (const value of values) {
    if (hasText(value)) return cleanBlock(value);
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

function formatPercent(value: unknown): string {
  const parsed = getNumberFromAny(value);

  if (!parsed) return "";

  return `${parsed.toLocaleString("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  })}%`;
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

function getStringArrayFromMetadata(metadata: SafeRecord, ...keys: string[]): string[] {
  const result: string[] = [];

  for (const key of keys) {
    const value = metadata[key];

    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (hasText(item)) result.push(cleanLine(item));
      });
    }

    if (hasText(value)) {
      String(value)
        .split(/[,\n;]/)
        .map(cleanLine)
        .filter(Boolean)
        .forEach((item) => result.push(item));
    }
  }

  return Array.from(new Set(result));
}

function idsMatch(itemId: string | null | undefined, ids: string[]): boolean {
  if (!itemId || !ids.length) return false;
  return ids.includes(itemId);
}

function isAConfirmar(value: unknown): boolean {
  const normalized = normalizeText(value);

  return (
    normalized.includes("aerolinea a confirmar") ||
    normalized.includes("aerolínea a confirmar") ||
    normalized === "a confirmar"
  );
}

/* =========================================================
   VUELOS
========================================================= */

function extractAirlineFromText(value: unknown, fallback = ""): string {
  const raw = String(value ?? "");
  const known = raw.match(
    /(Aerol[ií]neas Argentinas|LATAM|GOL|JetSMART|Jet Smart|Copa Airlines|Copa|Avianca|Iberia|Air Europa|American Airlines|Delta|United|Sky Airline|Flybondi|Arajet)/i
  );

  const found = cleanLine(known?.[1] || "");

  if (found.toLowerCase() === "copa") return "Copa Airlines";

  return found || fallback;
}

function extractAirline(vuelo: PresupuestoVuelo): string {
  if (hasText(vuelo.aerolinea) && !isAConfirmar(vuelo.aerolinea)) {
    return cleanLine(vuelo.aerolinea);
  }

  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const metadataAirline = getStringFromAny(
    metadata.aerolinea,
    metadata.airline,
    parsed.aerolinea,
    parsed.airline,
    parsed.compania,
    parsed.compania_aerea
  );

  if (metadataAirline && !isAConfirmar(metadataAirline)) return metadataAirline;

  const fromText = extractAirlineFromText(
    [
      vuelo.raw_text,
      vuelo.ida_detalle,
      vuelo.vuelta_detalle,
      parsed.texto_libre,
      parsed.raw_text
    ].join("\n"),
    ""
  );

  return isAConfirmar(fromText) ? "" : fromText;
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

function getPlaceCode(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") {
    const match = value.match(/\b[A-Z]{3}\b/);
    return match?.[0] || "";
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as SafeRecord;

    return getStringFromAny(
      record.codigo,
      record.code,
      record.iata,
      record.iata_code,
      record.airport_code
    );
  }

  return "";
}

function getPlaceCity(value: unknown): string {
  if (!value) return "";

  if (typeof value === "string") {
    return cleanLine(value.replace(/\(([A-Z]{3})\)/g, ""));
  }

  if (typeof value === "object" && !Array.isArray(value)) {
    const record = value as SafeRecord;

    return getStringFromAny(
      record.ciudad,
      record.city,
      record.nombre,
      record.name,
      record.aeropuerto,
      record.airport
    );
  }

  return "";
}

function formatFlightPlace(code: string, city: string): string {
  const cleanCode = cleanLine(code);
  const cleanCity = cleanLine(city);

  if (cleanCity && cleanCode) return `${cleanCity} (${cleanCode})`;
  if (cleanCode) return cleanCode;
  if (cleanCity) return cleanCity;
  return "—";
}

function parseTimeToMinutes(value: string): number | null {
  const match = cleanLine(value).match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return null;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;

  return hours * 60 + minutes;
}

function formatMinutesAsDuration(totalMinutes: number): string {
  const normalized = Math.max(0, totalMinutes);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;

  if (hours && minutes) return `${hours}h ${minutes}m`;
  if (hours) return `${hours}h`;
  return `${minutes}m`;
}

function getConnectionDuration(current: FlightLeg, next: FlightLeg): string {
  const arrival = parseTimeToMinutes(current.llegadaHora);
  const departure = parseTimeToMinutes(next.salidaHora);

  if (arrival === null || departure === null) return "";

  let diff = departure - arrival;

  if (diff < 0) diff += 24 * 60;

  return formatMinutesAsDuration(diff);
}

function getFlightLegRoute(leg: FlightLeg): string {
  return `${formatFlightPlace(leg.salidaCodigo, leg.salidaCiudad)} → ${formatFlightPlace(
    leg.llegadaCodigo,
    leg.llegadaCiudad
  )}`;
}

function parseFlightLegsFromStructured(vuelo: PresupuestoVuelo): FlightLeg[] {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);
  const rawTramos = getArrayFromAny(
    metadata.tramos,
    parsed.tramos,
    metadata.legs,
    parsed.legs,
    metadata.segmentos,
    parsed.segmentos
  );

  const airline = extractAirline(vuelo);

  return rawTramos
    .map((item, index): FlightLeg | null => {
      const tramo = getNestedRecord(item);

      const salidaSource = tramo.salida || tramo.origen || tramo.from || tramo.origin;
      const llegadaSource = tramo.llegada || tramo.destino || tramo.to || tramo.destination;

      const salidaCodigo = getStringFromAny(
        tramo.salida_codigo,
        tramo.origen_codigo,
        tramo.origin_code,
        tramo.from_code,
        getPlaceCode(salidaSource)
      );

      const llegadaCodigo = getStringFromAny(
        tramo.llegada_codigo,
        tramo.destino_codigo,
        tramo.destination_code,
        tramo.to_code,
        getPlaceCode(llegadaSource)
      );

      const salidaCiudad = getStringFromAny(
        tramo.salida_ciudad,
        tramo.origen_ciudad,
        tramo.origin_city,
        tramo.from_city,
        getPlaceCity(salidaSource)
      );

      const llegadaCiudad = getStringFromAny(
        tramo.llegada_ciudad,
        tramo.destino_ciudad,
        tramo.destination_city,
        tramo.to_city,
        getPlaceCity(llegadaSource)
      );

      const numero = getStringFromAny(tramo.numero_vuelo, tramo.flight_number, tramo.numero);

      if (!salidaCodigo && !llegadaCodigo && !numero && !salidaCiudad && !llegadaCiudad) {
        return null;
      }

      return {
        tipo: index === 0 ? "IDA" : "",
        aerolinea: getStringFromAny(tramo.aerolinea, tramo.airline, airline),
        numero,
        avion: getStringFromAny(tramo.avion, tramo.aircraft),
        clase: getStringFromAny(tramo.clase, tramo.cabin, tramo.tarifa_familia, vuelo.tarifa_familia),
        fecha: getStringFromAny(tramo.fecha, tramo.date, vuelo.ida_fecha, vuelo.vuelta_fecha),
        salidaHora: getStringFromAny(tramo.salida_hora, tramo.hora_salida, tramo.departure_time),
        salidaCodigo,
        salidaCiudad,
        salidaAeropuerto: getStringFromAny(
          tramo.salida_aeropuerto,
          tramo.origen_aeropuerto,
          tramo.origin_airport
        ),
        duracion: getStringFromAny(tramo.duracion, tramo.duration),
        llegadaHora: getStringFromAny(tramo.llegada_hora, tramo.hora_llegada, tramo.arrival_time),
        llegadaCodigo,
        llegadaCiudad,
        llegadaAeropuerto: getStringFromAny(
          tramo.llegada_aeropuerto,
          tramo.destino_aeropuerto,
          tramo.destination_airport
        ),
        escalaDespues: getStringFromAny(tramo.escala_despues, tramo.escala, tramo.stopover)
      };
    })
    .filter((item): item is FlightLeg => Boolean(item));
}

function parseFlightLegsFromLines(vuelo: PresupuestoVuelo): FlightLeg[] {
  const raw = [
    vuelo.raw_text,
    vuelo.ida_detalle,
    vuelo.vuelta_detalle,
    vuelo.ruta_resumen,
    vuelo.condiciones
  ]
    .filter(Boolean)
    .join("\n");

  if (!raw.trim()) return [];

  const airline = extractAirline(vuelo);
  const flightNumbers = extractFlightNumbersFromVuelo(vuelo);

  const airportPattern =
    /([A-ZÁÉÍÓÚÑa-záéíóúñüÜ\s.]+?)\s*\(([A-Z]{3})\).*?(\d{1,2}:\d{2}).*?([A-ZÁÉÍÓÚÑa-záéíóúñüÜ\s.]+?)\s*\(([A-Z]{3})\).*?(\d{1,2}:\d{2})/g;

  const matches = Array.from(raw.matchAll(airportPattern));

  return matches.map((match, index) => ({
    tipo: index === 0 ? "IDA" : "",
    aerolinea: airline,
    numero: flightNumbers[index] || flightNumbers[0] || "",
    avion: "",
    clase: vuelo.tarifa_familia || "",
    fecha: index === 0 ? vuelo.ida_fecha || "" : vuelo.vuelta_fecha || "",
    salidaHora: cleanLine(match[3]),
    salidaCodigo: cleanLine(match[2]),
    salidaCiudad: cleanLine(match[1]),
    salidaAeropuerto: "",
    duracion: "",
    llegadaHora: cleanLine(match[6]),
    llegadaCodigo: cleanLine(match[5]),
    llegadaCiudad: cleanLine(match[4]),
    llegadaAeropuerto: "",
    escalaDespues: ""
  }));
}

function buildFlightRowsFromVuelo(vuelo: PresupuestoVuelo): FlightDirectionRow[] {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);
  const airline = extractAirline(vuelo);
  const numbers = extractFlightNumbersFromVuelo(vuelo);

  const rows: FlightDirectionRow[] = [];

  const idaOrigen = getStringFromAny(vuelo.ida_origen, parsed.ida_origen, parsed.origen);
  const idaDestino = getStringFromAny(vuelo.ida_destino, parsed.ida_destino, parsed.destino);
  const vueltaOrigen = getStringFromAny(vuelo.vuelta_origen, parsed.vuelta_origen);
  const vueltaDestino = getStringFromAny(vuelo.vuelta_destino, parsed.vuelta_destino);

  if (idaOrigen || idaDestino || vuelo.ida_fecha || vuelo.ida_detalle) {
    rows.push({
      label: "IDA",
      fecha: getStringFromAny(vuelo.ida_fecha, parsed.ida_fecha, parsed.fecha_salida),
      aerolinea: airline,
      numero: numbers[0] || "",
      origen: idaOrigen,
      destino: idaDestino,
      salida: getStringFromAny(vuelo.ida_hora_salida, parsed.ida_hora_salida, parsed.hora_salida),
      llegada: getStringFromAny(vuelo.ida_hora_llegada, parsed.ida_hora_llegada, parsed.hora_llegada),
      duracion: getStringFromAny(parsed.ida_duracion, parsed.duracion),
      escala: getStringFromAny(vuelo.ida_escalas, parsed.ida_escalas, parsed.escalas)
    });
  }

  if (vueltaOrigen || vueltaDestino || vuelo.vuelta_fecha || vuelo.vuelta_detalle) {
    rows.push({
      label: "VUELTA",
      fecha: getStringFromAny(vuelo.vuelta_fecha, parsed.vuelta_fecha, parsed.fecha_regreso),
      aerolinea: airline,
      numero: numbers[1] || numbers[0] || "",
      origen: vueltaOrigen,
      destino: vueltaDestino,
      salida: getStringFromAny(vuelo.vuelta_hora_salida, parsed.vuelta_hora_salida),
      llegada: getStringFromAny(vuelo.vuelta_hora_llegada, parsed.vuelta_hora_llegada),
      duracion: getStringFromAny(parsed.vuelta_duracion),
      escala: getStringFromAny(vuelo.vuelta_escalas, parsed.vuelta_escalas)
    });
  }

  return rows;
}

function renderFlightLegsTable(legs: FlightLeg[]): string {
  if (!legs.length) return "";

  const rows = legs
    .map((leg, index) => {
      const nextLeg = legs[index + 1];
      const salida = formatFlightPlace(leg.salidaCodigo, leg.salidaCiudad);
      const llegada = formatFlightPlace(leg.llegadaCodigo, leg.llegadaCiudad);
      const tramoLabel = `TRAMO ${index + 1}`;

      const row = `
        <tr>
          <td>
            <strong>${escapeHtml(tramoLabel)}</strong>
            ${leg.fecha ? `<small>${escapeHtml(formatDate(leg.fecha))}</small>` : ""}
          </td>

          <td>
            <strong>${escapeHtml(leg.salidaHora || "—")}</strong>
            <small>${escapeHtml(salida)}</small>
          </td>

          <td class="flight-path-cell">
            <span>${escapeHtml(leg.duracion || "Vuelo")}</span>
            <div class="flight-path"></div>
            <small>${escapeHtml(getFlightLegRoute(leg))}</small>
          </td>

          <td>
            <strong>${escapeHtml(leg.llegadaHora || "—")}</strong>
            <small>${escapeHtml(llegada)}</small>
          </td>

          <td>
            <strong>${escapeHtml(leg.aerolinea || "Aéreo")}</strong>
            <small>${escapeHtml([leg.numero, leg.clase].filter(Boolean).join(" · ") || "Según detalle")}</small>
          </td>
        </tr>
      `;

      if (!nextLeg) return row;

      const connectionPlace = formatFlightPlace(leg.llegadaCodigo, leg.llegadaCiudad);
      const connectionDuration = getConnectionDuration(leg, nextLeg);

      return `
        ${row}
        <tr class="connection-row">
          <td colspan="5">
            ESCALA EN ${escapeHtml(connectionPlace.toUpperCase())}${
              connectionDuration ? ` · ${escapeHtml(connectionDuration)}` : ""
            }
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="flight-table-wrap">
      <table class="flight-table">
        <thead>
          <tr>
            <th>Tramo</th>
            <th>Salida</th>
            <th>Duración</th>
            <th>Llegada</th>
            <th>Vuelo</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderFlightRowsTable(rows: FlightDirectionRow[]): string {
  const validRows = rows.filter((row) => {
    const hasOrigin = hasText(row.origen);
    const hasDestination = hasText(row.destino);
    const hasTime = hasText(row.salida) || hasText(row.llegada);

    return hasOrigin || hasDestination || hasTime;
  });

  if (!validRows.length) return "";

  const htmlRows = validRows
    .map(
      (row, index) => `
        <tr>
          <td>
            <strong>${escapeHtml(`TRAMO ${index + 1}`)}</strong>
            <small>${escapeHtml(formatDate(row.fecha))}</small>
          </td>

          <td>
            <strong>${escapeHtml(row.salida || "—")}</strong>
            <small>${escapeHtml(row.origen || "Origen")}</small>
          </td>

          <td class="flight-path-cell">
            <span>${escapeHtml(row.duracion || "Vuelo")}</span>
            <div class="flight-path"></div>
            <small>${escapeHtml([row.origen, row.destino].filter(Boolean).join(" → ") || "Según detalle")}</small>
          </td>

          <td>
            <strong>${escapeHtml(row.llegada || "—")}</strong>
            <small>${escapeHtml(row.destino || "Destino")}</small>
          </td>

          <td>
            <strong>${escapeHtml(row.aerolinea || "Aéreo")}</strong>
            <small>${escapeHtml([row.numero, row.escala].filter(Boolean).join(" · ") || "Según detalle")}</small>
          </td>
        </tr>
      `
    )
    .join("");

  return `
    <div class="flight-table-wrap">
      <table class="flight-table">
        <thead>
          <tr>
            <th>Tramo</th>
            <th>Salida</th>
            <th>Duración</th>
            <th>Llegada</th>
            <th>Vuelo</th>
          </tr>
        </thead>
        <tbody>${htmlRows}</tbody>
      </table>
    </div>
  `;
}

function renderVueloTextoComplementario(vuelo: PresupuestoVuelo): string {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const explicit = getBlockFromAny(
    metadata.texto_complementario,
    metadata.texto_visible_pdf,
    metadata.detalle_visible_pdf,
    parsed.texto_complementario,
    parsed.texto_visible_pdf
  );

  if (explicit) return explicit;

  const raw = getBlockFromAny(vuelo.raw_text, parsed.raw_text, parsed.texto_libre);

  if (raw) return raw;

  return getBlockFromAny(
    vuelo.ida_detalle,
    vuelo.vuelta_detalle,
    vuelo.equipaje,
    vuelo.condiciones,
    parsed.ida_detalle,
    parsed.vuelta_detalle,
    parsed.equipaje,
    parsed.condiciones
  );
}

function renderVueloCard(vuelo: PresupuestoVuelo, index: number): string {
  const metadata = getMetadata(vuelo);
  const parsed = getNestedRecord(metadata.parsed);

  const titulo = getStringFromAny(
    vuelo.titulo,
    parsed.titulo,
    parsed.nombre,
    vuelo.ruta_resumen,
    `Aéreo ${index + 1}`
  );

  const airline = extractAirline(vuelo);
  const legs = parseFlightLegsFromStructured(vuelo);
  const fallbackLegs = legs.length ? legs : parseFlightLegsFromLines(vuelo);
  const directionRows = buildFlightRowsFromVuelo(vuelo);
  const textoLibre = renderVueloTextoComplementario(vuelo);

  const ruta = getStringFromAny(vuelo.ruta_resumen, parsed.ruta_resumen, parsed.ruta);

  const badges = [
    airline ? renderBadge(airline) : "",
    ruta ? renderBadge(ruta) : "",
    vuelo.tarifa_familia ? renderBadge(vuelo.tarifa_familia) : ""
  ]
    .filter(Boolean)
    .join("");

  const imageHtml = vuelo.captura_url
    ? `
      <div class="flight-capture">
        <img src="${escapeHtml(vuelo.captura_url)}" alt="${escapeHtml(titulo)}" />
      </div>
    `
    : "";

  const tableHtml = fallbackLegs.length
    ? renderFlightLegsTable(fallbackLegs)
    : renderFlightRowsTable(directionRows);

  const textoHtml = textoLibre
    ? `
      <div class="flight-free-text">
        ${nl2br(textoLibre)}
      </div>
    `
    : "";

  const priceHtml = shouldShowPrice(vuelo)
    ? `
      <div class="resource-price">
        ${formatMoneyAR(vuelo.precio_total || 0, vuelo.moneda || "USD")}
      </div>
    `
    : "";

  const equipajeHtml = vuelo.equipaje
    ? `
      <div class="flight-luggage-note">
        <strong>Equipaje</strong>
        <span>${escapeHtml(vuelo.equipaje)}</span>
      </div>
    `
    : "";

  return `
    <article class="flight-card">
      <div class="resource-header">
        <div>
          <h3>${escapeHtml(titulo)}</h3>
          ${badges ? `<div class="badges">${badges}</div>` : ""}
        </div>
        ${priceHtml}
      </div>

      ${imageHtml}
      ${tableHtml}
      ${equipajeHtml}
      ${textoHtml}
    </article>
  `;
}

function renderVuelosSection(vuelos: PresupuestoVuelo[]): string {
  const visibles = dedupeVuelos(vuelos).filter((item) => item.incluir_en_pdf !== false);

  if (!visibles.length) return "";

  const content = visibles.map((vuelo, index) => renderVueloCard(vuelo, index)).join("");

  return renderSection("Aéreos", content);
}

/* =========================================================
   HOTELES
========================================================= */

function renderHotelStars(categoria?: string | number | null): string {
  const stars = Number(String(categoria ?? "").replace(/[^\d]/g, ""));

  if (!Number.isFinite(stars) || stars <= 0) return "";

  return "★".repeat(Math.min(stars, 5));
}

function getHotelPhotos(hotel: PresupuestoHotel): string[] {
  const metadata = getMetadata(hotel);
  const parsed = getNestedRecord(metadata.parsed);
  const hotelMaestro = getNestedRecord(metadata.hotel_maestro);
  const googlePlace = getNestedRecord(metadata.google_place);

  const googlePhotos = getArrayFromAny(
    metadata.fotos,
    metadata.photos,
    googlePlace.fotos,
    googlePlace.photos,
    parsed.fotos,
    parsed.photos,
    hotelMaestro.fotos,
    hotelMaestro.photos
  )
    .map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object" && !Array.isArray(item)) {
        const record = item as SafeRecord;
        return getStringFromAny(record.url, record.foto_url, record.src, record.photo_url);
      }

      return "";
    })
    .filter(Boolean);

  const photos = [
    hotel.imagen_url,
    hotel.captura_url,
    ...googlePhotos,
    metadata.imagen_url,
    metadata.foto_url,
    googlePlace.foto_url,
    googlePlace.imagen_url,
    parsed.imagen_url,
    parsed.foto_url,
    hotelMaestro.imagen_url,
    hotelMaestro.foto_url
  ]
    .map((item) => String(item || "").trim())
    .filter(Boolean);

  return Array.from(new Set(photos)).slice(0, 4);
}

function renderHotelPhotos(hotel: PresupuestoHotel, nombre: string): string {
  const photos = getHotelPhotos(hotel);

  if (!photos.length) return "";

  const padded = [...photos];

  while (padded.length < 4) {
    padded.push(photos[photos.length - 1]);
  }

  return `
    <div class="hotel-gallery">
      ${padded
        .slice(0, 4)
        .map(
          (photo, index) => `
            <div class="hotel-photo">
              <img src="${escapeHtml(photo)}" alt="${escapeHtml(`${nombre} ${index + 1}`)}" />
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function getHotelRatingData(hotel: PresupuestoHotel): {
  rating: number | null;
  userRatingsTotal: number | null;
} {
  const metadata = getMetadata(hotel);
  const parsed = getNestedRecord(metadata.parsed);
  const googlePlace = getNestedRecord(metadata.google_place);

  return {
    rating: getNumberFromAny(
      metadata.rating,
      metadata.google_rating,
      metadata.calificacion_google,
      googlePlace.rating,
      googlePlace.google_rating,
      parsed.rating,
      parsed.google_rating
    ),
    userRatingsTotal: getNumberFromAny(
      metadata.user_ratings_total,
      metadata.google_user_ratings_total,
      metadata.cantidad_resenias,
      metadata.cantidad_reseñas,
      googlePlace.user_ratings_total,
      googlePlace.google_user_ratings_total,
      parsed.user_ratings_total,
      parsed.google_user_ratings_total
    )
  };
}

function renderHotelBadges({
  destino,
  regimen,
  stars,
  rating,
  userRatingsTotal
}: {
  destino: string;
  regimen: string;
  stars: string;
  rating: number | null;
  userRatingsTotal: number | null;
}): string {
  const googleRatingHtml = rating
    ? `<span class="hotel-google-rating">Google ${escapeHtml(
        rating.toLocaleString("es-AR", {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1
        })
      )} ★${
        userRatingsTotal
          ? ` · ${escapeHtml(userRatingsTotal.toLocaleString("es-AR"))} reseñas`
          : ""
      }</span>`
    : "";

  return `
    <div class="hotel-badges">
      ${destino ? `<span>${escapeHtml(destino)}</span>` : ""}
      ${regimen ? `<span>${escapeHtml(regimen)}</span>` : ""}
      ${stars ? `<span>${escapeHtml(stars)}</span>` : ""}
      ${googleRatingHtml}
    </div>
  `;
}

function renderHotelDataCard(
  facts: Array<{
    label: string;
    value: string;
  }>
): string {
  const visibles = facts.filter((item) => hasText(item.value));

  if (!visibles.length) return "";

  return `
    <div class="hotel-data-card">
      ${visibles
        .map(
          (fact) => `
            <div class="hotel-data-item">
              <small>${escapeHtml(fact.label)}</small>
              <strong>${escapeHtml(fact.value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function getHotelDescription(hotel: PresupuestoHotel): string {
  const metadata = getMetadata(hotel);
  const parsed = getNestedRecord(metadata.parsed);
  const googlePlace = getNestedRecord(metadata.google_place);

  return getBlockFromAny(
    hotel.descripcion,
    hotel.beneficios,
    metadata.descripcion,
    metadata.beneficios,
    googlePlace.descripcion,
    googlePlace.editorial_summary,
    parsed.descripcion,
    parsed.beneficios,
    hotel.raw_text
  );
}

function renderHotelCard(hotel: PresupuestoHotel, index: number): string {
  const metadata = getMetadata(hotel);
  const parsed = getNestedRecord(metadata.parsed);

  const nombre = getStringFromAny(
    hotel.nombre,
    hotel.titulo,
    parsed.nombre,
    parsed.titulo,
    `Hotel ${index + 1}`
  );

  const destino = getStringFromAny(hotel.destino, parsed.destino);
  const zona = getStringFromAny(hotel.zona, parsed.zona, parsed.ubicacion, parsed.direccion);
  const regimen = getStringFromAny(hotel.regimen, parsed.regimen);
  const habitacion = getStringFromAny(hotel.habitacion, parsed.habitacion);
  const categoria = getStringFromAny(hotel.categoria, parsed.categoria);
  const stars = renderHotelStars(categoria);
  const { rating, userRatingsTotal } = getHotelRatingData(hotel);
  const galleryHtml = renderHotelPhotos(hotel, nombre);

  const hotelFacts = [
    { label: "Destino", value: destino },
    { label: "Zona", value: zona },
    { label: "Check in", value: formatDate(hotel.check_in) },
    { label: "Check out", value: formatDate(hotel.check_out) },
    { label: "Noches", value: hotel.noches ? `${hotel.noches}` : "" },
    { label: "Régimen", value: regimen },
    { label: "Habitación", value: habitacion },
    { label: "Categoría", value: stars || categoria }
  ];

  const description = getHotelDescription(hotel);
  const conditions = getBlockFromAny(
    hotel.condiciones,
    hotel.politica_cancelacion,
    parsed.condiciones,
    parsed.politica_cancelacion
  );

  const priceHtml = shouldShowPrice(hotel)
    ? `
      <div class="hotel-price">
        ${formatMoneyAR(hotel.precio_total || 0, hotel.moneda || "USD")}
      </div>
    `
    : "";

  return `
    <article class="hotel-card">
      ${galleryHtml}

      <div class="hotel-content">
        <div class="hotel-title-row">
          <div>
            <h3>${escapeHtml(nombre)}</h3>
            ${renderHotelBadges({
              destino,
              regimen,
              stars,
              rating,
              userRatingsTotal
            })}
          </div>

          ${priceHtml}
        </div>

        ${renderHotelDataCard(hotelFacts)}

        ${
          description
            ? `
              <div class="hotel-description">
                ${nl2br(description)}
              </div>
            `
            : ""
        }

        ${
          conditions
            ? `
              <div class="hotel-conditions">
                ${nl2br(conditions)}
              </div>
            `
            : ""
        }
      </div>
    </article>
  `;
}

function renderHotelesSection(hoteles: PresupuestoHotel[]): string {
  const visibles = dedupeHoteles(hoteles).filter((item) => item.incluir_en_pdf !== false);

  if (!visibles.length) return "";

  const content = visibles.map((hotel, index) => renderHotelCard(hotel, index)).join("");

  return renderSection("Alojamiento", content);
}

/* =========================================================
   SERVICIOS
========================================================= */

function getServicioTipoLabel(tipo?: string | null): string {
  const normalized = normalizeText(tipo || "");

  if (normalized.includes("traslado")) return "Traslado";
  if (normalized.includes("asistencia")) return "Asistencia";
  if (normalized.includes("excursion")) return "Excursión";
  if (normalized.includes("seguro")) return "Seguro";
  if (normalized.includes("entrada")) return "Entrada";
  if (normalized.includes("auto")) return "Auto";
  if (normalized.includes("tren")) return "Tren";
  if (normalized.includes("bus")) return "Bus";

  return tipo || "Servicio";
}

function renderServicioCard(servicio: PresupuestoServicio, index: number): string {
  const metadata = getMetadata(servicio);
  const parsed = getNestedRecord(metadata.parsed);

  const nombre = getStringFromAny(
    servicio.nombre,
    parsed.nombre,
    parsed.titulo,
    `Servicio ${index + 1}`
  );

  const tipo = getServicioTipoLabel(getStringFromAny(servicio.tipo, parsed.tipo));
  const descripcion = getBlockFromAny(
    servicio.descripcion,
    parsed.descripcion,
    parsed.texto_libre,
    parsed.raw_text
  );

  const priceHtml =
    shouldShowPrice(servicio) && servicio.precio_total
      ? `
        <div class="resource-price">
          ${formatMoneyAR(servicio.precio_total, servicio.moneda || "USD")}
        </div>
      `
      : "";

  return `
    <article class="service-card">
      <div class="service-top">
        <div>
          <div class="service-type">${escapeHtml(tipo)}</div>
          <h3>${escapeHtml(nombre)}</h3>
        </div>

        ${priceHtml}
      </div>

      ${
        descripcion
          ? `
            <div class="service-desc">
              ${nl2br(descripcion)}
            </div>
          `
          : ""
      }

      <div class="service-flags">
        ${servicio.incluido ? `<span>Incluido</span>` : ""}
        ${servicio.opcional ? `<span>Opcional</span>` : ""}
      </div>
    </article>
  `;
}

function renderServiciosSection(servicios: PresupuestoServicio[]): string {
  const visibles = dedupeServicios(servicios).filter((item) => item.incluir_en_pdf !== false);

  if (!visibles.length) return "";

  const content = `
    <div class="services-grid">
      ${visibles.map((servicio, index) => renderServicioCard(servicio, index)).join("")}
    </div>
  `;

  return renderSection("Servicios incluidos / adicionales", content);
}

/* =========================================================
   OPCIONES COMERCIALES — METADATA FLEXIBLE
========================================================= */

function getFormaPagos(combinacion: PresupuestoCombinacion): FormaPagoFlexible[] {
  const metadata = getMetadata(combinacion);
  const raw = getArrayFromAny(metadata.formas_pago, metadata.formasPagos, metadata.payments);

  return raw
    .map((item, index): FormaPagoFlexible | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        if (!hasText(item)) return null;

        return {
          id: `payment-text-${index}`,
          tipo: "TEXTO",
          titulo: "Forma de pago",
          descripcion: cleanLine(item),
          moneda: combinacion.moneda || "USD",
          visible_en_pdf: true
        };
      }

      const record = item as SafeRecord;

      return {
        id: getStringFromAny(record.id, `payment-${index}`),
        tipo: getStringFromAny(record.tipo, record.type),
        titulo: getStringFromAny(record.titulo, record.nombre, record.title, record.name),
        descripcion: getBlockFromAny(record.descripcion, record.detalle, record.texto, record.description),
        moneda: getStringFromAny(record.moneda, combinacion.moneda, "USD"),
        monto: getNumberFromAny(record.monto, record.amount),
        porcentaje: getNumberFromAny(record.porcentaje, record.percent),
        cuotas: getNumberFromAny(record.cuotas, record.installments),
        valor_cuota: getNumberFromAny(record.valor_cuota, record.installment_amount),
        total_financiado: getNumberFromAny(record.total_financiado, record.financed_total),
        tarjeta: getStringFromAny(record.tarjeta, record.card) || null,
        banco: getStringFromAny(record.banco, record.bank) || null,
        con_interes:
          typeof record.con_interes === "boolean"
            ? record.con_interes
            : typeof record.with_interest === "boolean"
              ? record.with_interest
              : null,
        tasa_interes: getNumberFromAny(record.tasa_interes, record.interest_rate),
        fecha_vencimiento: getStringFromAny(record.fecha_vencimiento, record.due_date) || null,
        visible_en_pdf: record.visible_en_pdf === false ? false : true
      };
    })
    .filter((item): item is FormaPagoFlexible => Boolean(item))
    .filter((item) => item.visible_en_pdf !== false);
}

function getPromociones(combinacion: PresupuestoCombinacion): PromoFlexible[] {
  const metadata = getMetadata(combinacion);
  const raw = getArrayFromAny(metadata.promociones, metadata.promos, metadata.promotions);

  return raw
    .map((item, index): PromoFlexible | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        if (!hasText(item)) return null;

        return {
          id: `promo-text-${index}`,
          nombre: cleanLine(item),
          descripcion: "",
          moneda: combinacion.moneda || "USD",
          visible_en_pdf: true
        };
      }

      const record = item as SafeRecord;

      return {
        id: getStringFromAny(record.id, `promo-${index}`),
        nombre: getStringFromAny(record.nombre, record.titulo, record.name, record.title),
        descripcion: getBlockFromAny(record.descripcion, record.detalle, record.texto, record.description),
        descuento_monto: getNumberFromAny(record.descuento_monto, record.discount_amount),
        descuento_porcentaje: getNumberFromAny(record.descuento_porcentaje, record.discount_percent),
        monto: getNumberFromAny(record.monto, record.amount),
        porcentaje: getNumberFromAny(record.porcentaje, record.percent),
        moneda: getStringFromAny(record.moneda, combinacion.moneda, "USD"),
        vigencia_hasta: getStringFromAny(record.vigencia_hasta, record.valid_until) || null,
        visible_en_pdf: record.visible_en_pdf === false ? false : true
      };
    })
    .filter((item): item is PromoFlexible => Boolean(item))
    .filter((item) => item.visible_en_pdf !== false);
}

function getDescuentos(combinacion: PresupuestoCombinacion): PromoFlexible[] {
  const metadata = getMetadata(combinacion);
  const raw = getArrayFromAny(metadata.descuentos, metadata.discounts);

  return raw
    .map((item, index): PromoFlexible | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        if (!hasText(item)) return null;

        return {
          id: `discount-text-${index}`,
          nombre: cleanLine(item),
          descripcion: "",
          moneda: combinacion.moneda || "USD",
          visible_en_pdf: true
        };
      }

      const record = item as SafeRecord;

      return {
        id: getStringFromAny(record.id, `discount-${index}`),
        nombre: getStringFromAny(record.nombre, record.titulo, record.name, record.title),
        descripcion: getBlockFromAny(record.descripcion, record.detalle, record.texto, record.description),
        descuento_monto: getNumberFromAny(record.descuento_monto, record.discount_amount, record.monto),
        descuento_porcentaje: getNumberFromAny(
          record.descuento_porcentaje,
          record.discount_percent,
          record.porcentaje
        ),
        monto: getNumberFromAny(record.monto, record.amount),
        porcentaje: getNumberFromAny(record.porcentaje, record.percent),
        moneda: getStringFromAny(record.moneda, combinacion.moneda, "USD"),
        vigencia_hasta: getStringFromAny(record.vigencia_hasta, record.valid_until) || null,
        visible_en_pdf: record.visible_en_pdf === false ? false : true
      };
    })
    .filter((item): item is PromoFlexible => Boolean(item))
    .filter((item) => item.visible_en_pdf !== false);
}

function getTarifasPasajeros(combinacion: PresupuestoCombinacion): TarifaPasajeroFlexible[] {
  const metadata = getMetadata(combinacion);
  const raw = getArrayFromAny(
    metadata.tarifas_pasajeros,
    metadata.tarifas,
    metadata.passenger_rates
  );

  return raw
    .map((item, index): TarifaPasajeroFlexible | null => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;

      const record = item as SafeRecord;

      return {
        id: getStringFromAny(record.id, `rate-${index}`),
        tipo: getStringFromAny(record.tipo, record.type),
        descripcion: getStringFromAny(record.descripcion, record.label, record.description),
        nombre: getStringFromAny(record.nombre, record.name),
        cantidad: getNumberFromAny(record.cantidad, record.qty, record.quantity),
        precio_unitario: getNumberFromAny(record.precio_unitario, record.unit_price),
        subtotal: getNumberFromAny(record.subtotal, record.total),
        moneda: getStringFromAny(record.moneda, combinacion.moneda, "USD"),
        notas: getStringFromAny(record.notas, record.notes) || null,
        visible_en_pdf: record.visible_en_pdf === false ? false : true
      };
    })
    .filter((item): item is TarifaPasajeroFlexible => Boolean(item))
    .filter((item) => item.visible_en_pdf !== false);
}

function isCardPayment(payment: FormaPagoFlexible): boolean {
  const tipo = normalizeText(payment.tipo || "");
  const title = normalizeText(payment.titulo || "");
  const description = normalizeText(payment.descripcion || "");

  if (payment.tarjeta || payment.banco) return true;

  return (
    tipo.includes("tarjeta") ||
    tipo.includes("card") ||
    title.includes("tarjeta") ||
    description.includes("tarjeta")
  );
}

function isPaymentOnAccount(payment: FormaPagoFlexible): boolean {
  const tipo = normalizeText(payment.tipo || "");
  const title = normalizeText(payment.titulo || "");
  const description = normalizeText(payment.descripcion || "");

  if (tipo.includes("pagos a cuenta") || tipo.includes("pago a cuenta")) return true;
  if (tipo.includes("pagos_a_cuenta")) return true;
  if (title.includes("pagos a cuenta") || title.includes("plan de pagos")) return true;
  if (description.includes("pagos a cuenta") || description.includes("pago a cuenta")) return true;

  return Boolean(payment.cuotas && payment.valor_cuota && !isCardPayment(payment));
}

function getPaymentTitle(payment: FormaPagoFlexible): string {
  if (isPaymentOnAccount(payment)) return "Plan de pagos";

  if (isCardPayment(payment)) {
    return getStringFromAny(
      payment.titulo,
      [payment.tarjeta, payment.banco].filter(Boolean).join(" · "),
      "Tarjeta de crédito"
    );
  }

  const tipo = normalizeText(payment.tipo || "");

  if (tipo.includes("senia") || tipo.includes("seña") || tipo.includes("saldo")) {
    return getStringFromAny(payment.titulo, "Pago inicial + saldo");
  }

  return getStringFromAny(payment.titulo, "Forma de pago");
}

function getPaymentDescription(
  payment: FormaPagoFlexible,
  combinacion: PresupuestoCombinacion
): string {
  const moneda = payment.moneda || combinacion.moneda || "USD";

  if (isPaymentOnAccount(payment) && payment.cuotas && payment.valor_cuota) {
    return `${payment.cuotas} pago${payment.cuotas === 1 ? "" : "s"} a cuenta de ${formatMoneyAR(
      payment.valor_cuota,
      moneda
    )}.`;
  }

  if (isCardPayment(payment) && payment.cuotas && payment.valor_cuota) {
    return [
      `${payment.cuotas} cuota${payment.cuotas === 1 ? "" : "s"} de ${formatMoneyAR(
        payment.valor_cuota,
        moneda
      )}.`,
      payment.total_financiado
        ? `Total financiado ${formatMoneyAR(payment.total_financiado, moneda)}.`
        : "",
      payment.con_interes === true
        ? "Con interés."
        : payment.con_interes === false
          ? "Sin interés."
          : "",
      payment.tasa_interes ? `Tasa ${formatPercent(payment.tasa_interes)}.` : "",
      payment.fecha_vencimiento ? `Vencimiento ${formatDate(payment.fecha_vencimiento)}.` : ""
    ]
      .filter(Boolean)
      .join(" ");
  }

  const parts = [
    payment.descripcion,
    payment.monto ? `Monto: ${formatMoneyAR(payment.monto, moneda)}.` : "",
    payment.porcentaje ? `${formatPercent(payment.porcentaje)}.` : "",
    payment.fecha_vencimiento ? `Vencimiento ${formatDate(payment.fecha_vencimiento)}.` : ""
  ]
    .filter(Boolean)
    .map(cleanLine);

  return parts.join(" ");
}

function renderFlexiblePayments(combinacion: PresupuestoCombinacion): string {
  const payments = getFormaPagos(combinacion);

  const fallbackPayments: FormaPagoFlexible[] = [];

  if (combinacion.forma_pago_resumen) {
    fallbackPayments.push({
      id: "fallback-summary",
      tipo: "RESUMEN",
      titulo: "Forma de pago",
      descripcion: combinacion.forma_pago_resumen,
      moneda: combinacion.moneda || "USD",
      visible_en_pdf: true
    });
  }

  if (combinacion.seña || combinacion.saldo) {
    fallbackPayments.push({
      id: "fallback-senia-saldo",
      tipo: "SENIA_SALDO",
      titulo: "Pago inicial + saldo",
      descripcion: [
        combinacion.seña
          ? `Pago inicial / seña: ${formatMoneyAR(combinacion.seña, combinacion.moneda || "USD")}.`
          : "",
        combinacion.saldo
          ? `Saldo: ${formatMoneyAR(combinacion.saldo, combinacion.moneda || "USD")}.`
          : ""
      ]
        .filter(Boolean)
        .join(" "),
      moneda: combinacion.moneda || "USD",
      visible_en_pdf: true
    });
  }

  const allPaymentsRaw = payments.length ? payments : fallbackPayments;
  const seenPayments = new Set<string>();

  const allPayments = allPaymentsRaw.filter((payment) => {
    const title = getPaymentTitle(payment);
    const description = getPaymentDescription(payment, combinacion);

    const key = normalizeText(
      [
        payment.tipo,
        title,
        description,
        payment.cuotas,
        payment.valor_cuota,
        payment.monto,
        payment.tarjeta,
        payment.banco
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!key) return false;
    if (seenPayments.has(key)) return false;

    seenPayments.add(key);
    return true;
  });

  if (!allPayments.length && !combinacion.condiciones_pago) return "";

  const paymentsHtml = allPayments
    .map((payment) => {
      const title = getPaymentTitle(payment);
      const description = getPaymentDescription(payment, combinacion);

      if (!title && !description) return "";

      return `
        <div class="payment-item ${isPaymentOnAccount(payment) ? "payment-account" : ""}">
          <strong>${escapeHtml(title)}</strong>
          ${description ? `<p>${nl2br(description)}</p>` : ""}
        </div>
      `;
    })
    .filter(Boolean)
    .join("");

  const condicionesHtml = combinacion.condiciones_pago
    ? `
      <div class="payment-conditions">
        ${nl2br(combinacion.condiciones_pago)}
      </div>
    `
    : "";

  return `
    <div class="payments-box">
      <div class="mini-title">Formas de pago</div>
      ${paymentsHtml}
      ${condicionesHtml}
    </div>
  `;
}

function renderPromosAndDiscounts(combinacion: PresupuestoCombinacion): string {
  const promos = getPromociones(combinacion);
  const descuentos = getDescuentos(combinacion);
  const etiquetaNormalized = normalizeText(combinacion.etiqueta || "");

  const itemsRaw = [
    ...promos.map((promo) => ({ ...promo, kind: "promo" as const })),
    ...descuentos.map((discount) => ({ ...discount, kind: "discount" as const }))
  ];

  const seen = new Set<string>();

  const items = itemsRaw.filter((item) => {
    const key = normalizeText(
      [
        item.kind,
        item.nombre,
        item.descripcion,
        item.descuento_monto,
        item.descuento_porcentaje,
        item.monto,
        item.porcentaje
      ]
        .filter(Boolean)
        .join(" ")
    );

    if (!key) return false;
    if (seen.has(key)) return false;

    seen.add(key);
    return true;
  });

  const hasEtiquetaInItems =
    etiquetaNormalized &&
    items.some((item) =>
      normalizeText([item.nombre, item.descripcion].filter(Boolean).join(" ")).includes(
        etiquetaNormalized
      )
    );

  if (!items.length && !combinacion.etiqueta) return "";

  const etiquetaHtml =
    combinacion.etiqueta && !hasEtiquetaInItems
      ? `
        <div class="promo-item">
          <strong>${escapeHtml(combinacion.etiqueta)}</strong>
        </div>
      `
      : "";

  const itemsHtml = items
    .map((item) => {
      const amount =
        item.descuento_monto || item.monto
          ? formatMoneyAR(
              item.descuento_monto || item.monto || 0,
              item.moneda || combinacion.moneda || "USD"
            )
          : "";

      const percent =
        item.descuento_porcentaje || item.porcentaje
          ? formatPercent(item.descuento_porcentaje || item.porcentaje)
          : "";

      const detail = [
        item.descripcion,
        amount ? `Beneficio: ${amount}.` : "",
        percent ? `Beneficio: ${percent}.` : "",
        item.vigencia_hasta ? `Vigente hasta ${formatDate(item.vigencia_hasta)}.` : ""
      ]
        .filter(Boolean)
        .map(cleanLine)
        .join(" ");

      return `
        <div class="promo-item ${item.kind === "discount" ? "discount-item" : ""}">
          <strong>${escapeHtml(item.nombre || (item.kind === "discount" ? "Descuento" : "Promoción"))}</strong>
          ${detail ? `<p>${nl2br(detail)}</p>` : ""}
        </div>
      `;
    })
    .join("");

  return `
    <div class="promos-box">
      <div class="mini-title">Promociones y descuentos</div>
      ${etiquetaHtml}
      ${itemsHtml}
    </div>
  `;
}

function renderTarifasPasajeros(combinacion: PresupuestoCombinacion): string {
  const tarifas = getTarifasPasajeros(combinacion);

  if (!tarifas.length) return "";

  const rows = tarifas
    .map((tarifa) => {
      const moneda = tarifa.moneda || combinacion.moneda || "USD";

      return `
        <tr>
          <td>
            <strong>${escapeHtml(tarifa.descripcion || tarifa.nombre || tarifa.tipo || "Tarifa")}</strong>
            ${tarifa.notas ? `<small>${escapeHtml(tarifa.notas)}</small>` : ""}
          </td>
          <td>${tarifa.cantidad || "—"}</td>
          <td>${tarifa.precio_unitario ? formatMoneyAR(tarifa.precio_unitario, moneda) : "—"}</td>
          <td>${tarifa.subtotal ? formatMoneyAR(tarifa.subtotal, moneda) : "—"}</td>
        </tr>
      `;
    })
    .join("");

  return `
    <div class="rates-box">
      <div class="mini-title">Detalle por pasajero / tipo de tarifa</div>
      <table class="rates-table">
        <thead>
          <tr>
            <th>Tarifa</th>
            <th>Cant.</th>
            <th>Unitario</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function getCombinacionResourceIds(combinacion: PresupuestoCombinacion): {
  vuelosIds: string[];
  hotelesIds: string[];
  serviciosIds: string[];
} {
  const metadata = getMetadata(combinacion);

  return {
    vuelosIds: getStringArrayFromMetadata(metadata, "vuelos_ids", "vuelo_ids"),
    hotelesIds: getStringArrayFromMetadata(metadata, "hoteles_ids", "hotel_ids"),
    serviciosIds: getStringArrayFromMetadata(metadata, "servicios_ids", "servicio_ids")
  };
}

function getResourcesForCombinacion(
  combinacion: PresupuestoCombinacion,
  vuelos: PresupuestoVuelo[],
  hoteles: PresupuestoHotel[],
  servicios: PresupuestoServicio[]
): {
  vuelosUsados: PresupuestoVuelo[];
  hotelesUsados: PresupuestoHotel[];
  serviciosUsados: PresupuestoServicio[];
} {
  const { vuelosIds, hotelesIds, serviciosIds } = getCombinacionResourceIds(combinacion);

  return {
    vuelosUsados: vuelosIds.length ? vuelos.filter((item) => idsMatch(item.id, vuelosIds)) : vuelos,
    hotelesUsados: hotelesIds.length ? hoteles.filter((item) => idsMatch(item.id, hotelesIds)) : hoteles,
    serviciosUsados: serviciosIds.length
      ? servicios.filter((item) => idsMatch(item.id, serviciosIds))
      : servicios
  };
}

function renderOptionFlightResource(vuelo: PresupuestoVuelo, index: number): string {
  const titulo = getStringFromAny(vuelo.titulo, vuelo.ruta_resumen, `Aéreo ${index + 1}`);
  const ruta = getStringFromAny(vuelo.ruta_resumen);
  const texto = renderVueloTextoComplementario(vuelo);
  const equipaje = cleanLine(vuelo.equipaje);
  const tableHtml = (() => {
    const legs = parseFlightLegsFromStructured(vuelo);
    const fallbackLegs = legs.length ? legs : parseFlightLegsFromLines(vuelo);
    const directionRows = buildFlightRowsFromVuelo(vuelo);

    if (fallbackLegs.length) return renderFlightLegsTable(fallbackLegs);
    return renderFlightRowsTable(directionRows);
  })();

  const imageHtml = vuelo.captura_url
    ? `
      <div class="option-flight-image">
        <img src="${escapeHtml(vuelo.captura_url)}" alt="${escapeHtml(titulo)}" />
      </div>
    `
    : "";

  return `
    <article class="option-resource-card option-flight-card">
      <div class="option-resource-head">
        <div>
          <div class="option-resource-kicker">Aéreo</div>
          <h4>${escapeHtml(titulo)}</h4>
          ${ruta ? `<p>${escapeHtml(ruta)}</p>` : ""}
        </div>
      </div>

      ${imageHtml}

      ${
        !imageHtml && tableHtml
          ? `
            <div class="option-flight-table">
              ${tableHtml}
            </div>
          `
          : ""
      }

      ${
        equipaje
          ? `
            <div class="option-resource-note">
              <strong>Equipaje</strong>
              <span>${escapeHtml(equipaje)}</span>
            </div>
          `
          : ""
      }

      ${
        texto && !vuelo.captura_url
          ? `
            <div class="option-resource-text">
              ${nl2br(texto)}
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderOptionHotelResource(hotel: PresupuestoHotel, index: number): string {
  const nombre = getStringFromAny(hotel.nombre, hotel.titulo, `Hotel ${index + 1}`);
  const destino = getStringFromAny(hotel.destino);
  const zona = getStringFromAny(hotel.zona);
  const regimen = getStringFromAny(hotel.regimen);
  const habitacion = getStringFromAny(hotel.habitacion);
  const categoria = getStringFromAny(hotel.categoria);
  const stars = renderHotelStars(categoria);
  const { rating, userRatingsTotal } = getHotelRatingData(hotel);
  const galleryHtml = renderHotelPhotos(hotel, nombre);

  const facts = [
    { label: "Destino", value: destino },
    { label: "Zona", value: zona },
    { label: "Check in", value: formatDate(hotel.check_in) },
    { label: "Check out", value: formatDate(hotel.check_out) },
    { label: "Noches", value: hotel.noches ? `${hotel.noches}` : "" },
    { label: "Régimen", value: regimen },
    { label: "Habitación", value: habitacion },
    { label: "Categoría", value: stars || categoria }
  ];

  const description = getHotelDescription(hotel);

  return `
    <article class="option-resource-card option-hotel-card">
      <div class="option-resource-head">
        <div>
          <div class="option-resource-kicker">Hotel</div>
          <h4>${escapeHtml(nombre)}</h4>

          ${renderHotelBadges({
            destino,
            regimen,
            stars,
            rating,
            userRatingsTotal
          })}
        </div>
      </div>

      ${galleryHtml}

      <div class="compact-hotel-data">
        ${renderHotelDataCard(facts)}
      </div>

      ${
        description
          ? `
            <div class="option-resource-text">
              ${nl2br(description)}
            </div>
          `
          : ""
      }
    </article>
  `;
}

function renderOptionServiceResources(servicios: PresupuestoServicio[]): string {
  if (!servicios.length) return "";

  return `
    <div class="option-services-box">
      <div class="option-resource-kicker">Servicios</div>

      <div class="option-services-grid">
        ${servicios
          .map(
            (servicio) => `
              <div class="option-service-item">
                <strong>${escapeHtml(servicio.nombre || "Servicio")}</strong>
                ${
                  servicio.descripcion
                    ? `<span>${escapeHtml(cleanLine(servicio.descripcion))}</span>`
                    : ""
                }
              </div>
            `
          )
          .join("")}
      </div>
    </div>
  `;
}

function renderOptionResourceBundle(
  combinacion: PresupuestoCombinacion,
  vuelos: PresupuestoVuelo[],
  hoteles: PresupuestoHotel[],
  servicios: PresupuestoServicio[],
  index: number
): string {
  const { vuelosUsados, hotelesUsados, serviciosUsados } = getResourcesForCombinacion(
    combinacion,
    vuelos,
    hoteles,
    servicios
  );

  const titulo = combinacion.nombre || `Opción ${index + 1}`;

  return `
    <div class="option-bundle">
      <div class="option-bundle-title">
        <span>Opción ${index + 1}</span>
        <strong>${escapeHtml(titulo)}</strong>
      </div>

      <div class="option-bundle-stack">
        ${vuelosUsados.map((vuelo, vueloIndex) => renderOptionFlightResource(vuelo, vueloIndex)).join("")}
        ${hotelesUsados.map((hotel, hotelIndex) => renderOptionHotelResource(hotel, hotelIndex)).join("")}
        ${renderOptionServiceResources(serviciosUsados)}
      </div>
    </div>
  `;
}

function renderIncludedExcluded(combinacion: PresupuestoCombinacion): string {
  const incluye = getBlockFromAny(combinacion.incluye_resumen);
  const noIncluye = getBlockFromAny(combinacion.no_incluye_resumen);

  if (!incluye && !noIncluye) return "";

  return `
    <div class="included-grid">
      ${
        incluye
          ? `
            <div class="included-box positive">
              <div class="mini-title">Incluye</div>
              <div>${nl2br(incluye)}</div>
            </div>
          `
          : ""
      }

      ${
        noIncluye
          ? `
            <div class="included-box negative">
              <div class="mini-title">No incluye</div>
              <div>${nl2br(noIncluye)}</div>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderMainPrice(
  combinacion: PresupuestoCombinacion,
  presupuesto: PresupuestoV2
): string {
  const metadata = getMetadata(combinacion);
  const total = combinacion.precio_total || 0;
  const moneda = combinacion.moneda || presupuesto.moneda_principal || "USD";
  const totalPax = getTotalPax(presupuesto);
  const showPerPassenger = metadataBool(metadata, "mostrar_precio_por_pasajero", false);
  const priceLabel = getStringFromAny(metadata.precio_label, "Precio total");
  const composicion = getBlockFromAny(metadata.composicion_precio_texto);

  const perPassenger = showPerPassenger && totalPax > 0 ? total / totalPax : null;

  return `
    <div class="main-price-box">
      <div>
        <div class="price-label">${escapeHtml(priceLabel)}</div>
        <div class="main-price">${formatMoneyAR(total, moneda)}</div>
        ${
          composicion
            ? `<div class="price-composition">${nl2br(composicion)}</div>`
            : ""
        }
      </div>

      ${
        perPassenger
          ? `
            <div class="per-pax-price">
              <span>Referencia por pasajero</span>
              <strong>${formatMoneyAR(perPassenger, moneda)}</strong>
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderAlternativePrices(combinacion: PresupuestoCombinacion): string {
  const moneda = combinacion.moneda || "USD";

  const prices = [
    combinacion.precio_contado
      ? { label: "Contado", value: formatMoneyAR(combinacion.precio_contado, moneda) }
      : null,
    combinacion.precio_transferencia
      ? { label: "Transferencia", value: formatMoneyAR(combinacion.precio_transferencia, moneda) }
      : null,
    combinacion.precio_tarjeta
      ? { label: "Tarjeta", value: formatMoneyAR(combinacion.precio_tarjeta, moneda) }
      : null,
    combinacion.precio_financiado
      ? { label: "Financiado", value: formatMoneyAR(combinacion.precio_financiado, moneda) }
      : null
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (!prices.length) return "";

  return `
    <div class="alt-prices">
      ${prices
        .map(
          (price) => `
            <div class="alt-price-item">
              <span>${escapeHtml(price.label)}</span>
              <strong>${escapeHtml(price.value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderOptionCommercialConditions(combinacion: PresupuestoCombinacion): string {
  const content = [
    renderTarifasPasajeros(combinacion),
    renderPromosAndDiscounts(combinacion),
    renderFlexiblePayments(combinacion),
    renderIncludedExcluded(combinacion)
  ]
    .filter(Boolean)
    .join("");

  if (!content) return "";

  return `
    <div class="option-commercial-extra">
      ${content}
    </div>
  `;
}

function renderCombinacionCard(
  combinacion: PresupuestoCombinacion,
  vuelos: PresupuestoVuelo[],
  hoteles: PresupuestoHotel[],
  servicios: PresupuestoServicio[],
  index: number,
  recommendedId: string | null
): string {
  const isRecommended =
    recommendedId === combinacion.id ||
    (!recommendedId && combinacion.destacada) ||
    index === 0;

  const titulo = getStringFromAny(combinacion.nombre, `Opción ${index + 1}`);
  const subtitulo = getStringFromAny(combinacion.subtitulo);
  const descripcion = getBlockFromAny(combinacion.descripcion);

  return `
    <article class="option-card ${isRecommended ? "recommended" : ""}">
      <div class="option-head">
        <div>
          <div class="option-kicker">
            ${isRecommended ? "Opción sugerida" : `Opción ${index + 1}`}
          </div>

          <h3>${escapeHtml(titulo)}</h3>

          ${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ""}
        </div>

        ${
          combinacion.etiqueta
            ? `<span class="option-tag">${escapeHtml(combinacion.etiqueta)}</span>`
            : ""
        }
      </div>

      ${descripcion ? `<div class="option-description">${nl2br(descripcion)}</div>` : ""}

      ${renderOptionResourceBundle(combinacion, vuelos, hoteles, servicios, index)}
    </article>
  `;
}

function renderCombinacionPriceCard(
  combinacion: PresupuestoCombinacion,
  presupuesto: PresupuestoV2,
  index: number,
  recommendedId: string | null
): string {
  const isRecommended =
    recommendedId === combinacion.id ||
    (!recommendedId && combinacion.destacada) ||
    index === 0;

  const titulo = getStringFromAny(combinacion.nombre, `Opción ${index + 1}`);
  const subtitulo = getStringFromAny(combinacion.subtitulo);
  const descripcion = getBlockFromAny(combinacion.descripcion);

  return `
    <article class="price-option-card ${isRecommended ? "recommended" : ""}">
      <div class="option-head">
        <div>
          <div class="option-kicker">
            ${isRecommended ? "Opción sugerida" : `Opción ${index + 1}`}
          </div>

          <h3>${escapeHtml(titulo)}</h3>

          ${subtitulo ? `<p>${escapeHtml(subtitulo)}</p>` : ""}
        </div>

        ${
          combinacion.etiqueta
            ? `<span class="option-tag">${escapeHtml(combinacion.etiqueta)}</span>`
            : ""
        }
      </div>

      ${descripcion ? `<div class="option-description">${nl2br(descripcion)}</div>` : ""}

      <div class="option-price-zone">
        ${renderMainPrice(combinacion, presupuesto)}
        ${renderAlternativePrices(combinacion)}
        ${renderOptionCommercialConditions(combinacion)}
      </div>
    </article>
  `;
}

function renderOpcionesSection(
  presupuesto: PresupuestoV2,
  vuelos: PresupuestoVuelo[],
  hoteles: PresupuestoHotel[],
  servicios: PresupuestoServicio[],
  combinaciones: PresupuestoCombinacion[]
): string {
  const visibles = dedupeCombinaciones(combinaciones).filter((item) => item.visible_en_pdf !== false);

  if (!visibles.length) return "";

  const recommended = getRecommendedCombinacion(presupuesto, visibles);
  const recommendedId = recommended?.id || null;

  const content = `
    <div class="options-stack">
      ${visibles
        .map((combinacion, index) =>
      renderCombinacionCard(
  combinacion,
  vuelos,
  hoteles,
  servicios,
  index,
  recommendedId
)
        )
        .join("")}
    </div>
  `;

  return renderSection("Opciones presupuestadas", content, "options-section");
}

function renderPreciosSection(
  presupuesto: PresupuestoV2,
  combinaciones: PresupuestoCombinacion[]
): string {
  const visibles = dedupeCombinaciones(combinaciones).filter((item) => item.visible_en_pdf !== false);

  if (!visibles.length) return "";

  const recommended = getRecommendedCombinacion(presupuesto, visibles);
  const recommendedId = recommended?.id || null;

  const content = `
    <div class="prices-stack">
      ${visibles
        .map((combinacion, index) =>
          renderCombinacionPriceCard(combinacion, presupuesto, index, recommendedId)
        )
        .join("")}
    </div>
  `;

  return renderSection("Precios y formas de pago", content, "prices-section");
}

function renderOptionSummaryRow(
  combinacion: PresupuestoCombinacion,
  index: number,
  recommendedId: string | null,
  vuelos: PresupuestoVuelo[],
  hoteles: PresupuestoHotel[],
  servicios: PresupuestoServicio[]
): string {
  const isRecommended =
    recommendedId === combinacion.id ||
    (!recommendedId && combinacion.destacada) ||
    index === 0;

  const { vuelosIds, hotelesIds, serviciosIds } = getCombinacionResourceIds(combinacion);

  const vuelosUsados = vuelosIds.length
    ? vuelos.filter((item) => idsMatch(item.id, vuelosIds))
    : vuelos;

  const hotelesUsados = hotelesIds.length
    ? hoteles.filter((item) => idsMatch(item.id, hotelesIds))
    : hoteles;

  const serviciosUsados = serviciosIds.length
    ? servicios.filter((item) => idsMatch(item.id, serviciosIds))
    : servicios;

  const combo = [
    vuelosUsados
      .map((item) => getStringFromAny(item.titulo, item.ruta_resumen, item.aerolinea, "Aéreo"))
      .filter(Boolean)
      .join(" + "),
    hotelesUsados
      .map((item) => getStringFromAny(item.nombre, item.titulo, "Hotel"))
      .filter(Boolean)
      .join(" + "),
    serviciosUsados
      .map((item) => getStringFromAny(item.nombre, item.tipo, "Servicio"))
      .filter(Boolean)
      .join(" + ")
  ]
    .filter(Boolean)
    .join(" + ");

  return `
    <tr>
      <td>
        <strong>${escapeHtml(combinacion.nombre || `Opción ${index + 1}`)}</strong>
        ${combinacion.subtitulo ? `<small>${escapeHtml(combinacion.subtitulo)}</small>` : ""}
      </td>

      <td>
        ${escapeHtml(combo || "Combinación según detalle")}
      </td>

      <td>
        ${formatMoneyAR(combinacion.precio_total || 0, combinacion.moneda || "USD")}
      </td>

      <td>
        ${isRecommended ? `<span class="summary-recommended">Sugerida</span>` : ""}
        ${combinacion.etiqueta ? `<span class="summary-tag">${escapeHtml(combinacion.etiqueta)}</span>` : ""}
      </td>
    </tr>
  `;
}

function renderOptionsSummary(
  combinaciones: PresupuestoCombinacion[],
  recommendedId: string | null,
  vuelos: PresupuestoVuelo[],
  hoteles: PresupuestoHotel[],
  servicios: PresupuestoServicio[]
): string {
  const visibles = dedupeCombinaciones(combinaciones).filter((item) => item.visible_en_pdf !== false);

  if (visibles.length <= 1) return "";

  return `
    <section class="section options-summary-section">
      <div class="section-title">
        <h2>Resumen rápido de opciones</h2>
        <span></span>
      </div>

      <div class="summary-table-wrap">
        <table class="summary-table">
          <thead>
            <tr>
              <th>Opción</th>
              <th>Combinación</th>
              <th>Precio</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            ${visibles
              .map((item, index) =>
                renderOptionSummaryRow(item, index, recommendedId, vuelos, hoteles, servicios)
              )
              .join("")}
          </tbody>
        </table>
      </div>
    </section>
  `;
}

/* =========================================================
   RESUMEN / INTRO / CONDICIONES
========================================================= */

function getDestinosPresupuestadosData(presupuesto: PresupuestoV2): PresupuestoDestinoPdf[] {
  const metadata = getMetadata(presupuesto);
  const extra = getPresupuestoExtra(presupuesto);

  const raw =
    metadata.destinos_presupuestados ||
    metadata.destinos ||
    extra.destinos_presupuestados ||
    extra.destinos;

  if (Array.isArray(raw)) {
    const destinos = raw
      .map((item): PresupuestoDestinoPdf | null => {
        if (typeof item === "string") {
          const clean = cleanLine(item);

          if (!clean) return null;

          return {
            pais: "",
            destino: clean
          };
        }

        if (item && typeof item === "object" && !Array.isArray(item)) {
          const record = item as SafeRecord;

          const pais = getStringFromAny(
            record.pais,
            record.country,
            record.pais_nombre,
            record.country_name
          );

          const destino = getStringFromAny(
            record.destino,
            record.destination,
            record.ciudad,
            record.city,
            record.nombre,
            record.name
          );

          if (!pais && !destino) return null;

          return {
            pais,
            destino
          };
        }

        return null;
      })
      .filter((item): item is PresupuestoDestinoPdf => Boolean(item));

    if (destinos.length) return destinos;
  }

  if (typeof raw === "string" && hasText(raw)) {
    return raw
      .split(/[,\n;]/)
      .map(cleanLine)
      .filter(Boolean)
      .map((item) => ({
        pais: "",
        destino: item
      }));
  }

  const fallbackDestino = getStringFromAny(presupuesto.destino_principal);
  const fallbackPais = getStringFromAny(presupuesto.destino_detalle);

  if (fallbackDestino) {
    return [
      {
        pais: fallbackPais,
        destino: fallbackDestino
      }
    ];
  }

  return [];
}

function formatDestinoPdfItem(item: PresupuestoDestinoPdf): string {
  const destino = cleanLine(item.destino);
  const pais = cleanLine(item.pais);

  if (destino && pais) return `${destino}, ${pais}`;
  return destino || pais;
}

function getDestinoPresupuestoLabel(presupuesto: PresupuestoV2): string {
  const destinos = getDestinosPresupuestadosData(presupuesto);

  if (destinos.length) {
    return destinos
      .map(formatDestinoPdfItem)
      .filter(Boolean)
      .join(" · ");
  }

  return "Viaje a cotizar";
}

function getDestinoPresupuestoResumen(presupuesto: PresupuestoV2): string {
  const destinos = getDestinosPresupuestadosData(presupuesto);

  if (destinos.length) {
    return destinos
      .map(formatDestinoPdfItem)
      .filter(Boolean)
      .join("\n");
  }

  return getDestinoPresupuestoLabel(presupuesto);
}

function getVendedorPresupuestoLabel(presupuesto: PresupuestoV2): string {
  const extra = getPresupuestoExtra(presupuesto);
  const metadata = getMetadata(presupuesto);

  return getStringFromAny(
    extra.vendedor_nombre,
    extra.vendedor,
    extra.vendedor_email,
    metadata.vendedor_nombre,
    metadata.vendedor,
    metadata.vendedor_email
  );
}

function getSucursalPresupuestoLabel(presupuesto: PresupuestoV2): string {
  const extra = getPresupuestoExtra(presupuesto);
  const metadata = getMetadata(presupuesto);

  return getStringFromAny(
    extra.sucursal_nombre,
    extra.sucursal,
    metadata.sucursal_nombre,
    metadata.sucursal
  );
}

function renderHero(presupuesto: PresupuestoV2): string {
  const vendedor = getVendedorPresupuestoLabel(presupuesto);
  const destino = getDestinoPresupuestoLabel(presupuesto);

  return `
    <section class="hero">
      <div class="hero-left">
        <div class="brand-row">
          <img src="${escapeHtml(ALMUNDO_LOGO_URL)}" alt="Almundo" />
          <span>Presupuesto de viaje</span>
        </div>

        <h1>${escapeHtml(getDisplayName(presupuesto))}</h1>

        <p>${escapeHtml(destino)}</p>
      </div>

      <div class="hero-right">
        <div class="hero-number">${escapeHtml(presupuesto.numero || "PRESUPUESTO")}</div>

        ${
          vendedor
            ? `
              <div class="hero-meta-label">Creado por</div>
              <div class="hero-seller">${escapeHtml(vendedor)}</div>
            `
            : ""
        }

        <div class="hero-date">Emitido: ${formatDateTime(presupuesto.updated_at || presupuesto.created_at)}</div>
      </div>
    </section>
  `;
}

function renderResumenSection(
  presupuesto: PresupuestoV2,
  combinaciones: PresupuestoCombinacion[]
): string {
  const recommended = getRecommendedCombinacion(presupuesto, combinaciones);
  const vendedor = getVendedorPresupuestoLabel(presupuesto);
  const sucursal = getSucursalPresupuestoLabel(presupuesto);
  const destino = getDestinoPresupuestoResumen(presupuesto);

  const resumenItems = [
    { label: "Destino/s", value: destino, multiline: true },
    { label: "Salida", value: formatDate(presupuesto.fecha_salida), multiline: false },
    { label: "Regreso", value: formatDate(presupuesto.fecha_regreso), multiline: false },
    { label: "Noches", value: presupuesto.noches ? `${presupuesto.noches}` : "", multiline: false },
    { label: "Pasajeros", value: getPasajerosLabel(presupuesto), multiline: false },
    { label: "Creado por", value: vendedor, multiline: false },
    { label: "Sucursal", value: sucursal, multiline: false },
    { label: "Opción sugerida", value: recommended?.nombre || "", multiline: false }
  ].filter((item) => hasText(item.value));

  if (!resumenItems.length) return "";

  return renderSection(
    "Resumen del viaje",
    `
      <div class="trip-summary-card">
        ${resumenItems
          .map(
            (item) => `
              <div class="trip-summary-row ${item.multiline ? "trip-summary-row-wide" : ""}">
                <span>${escapeHtml(item.label)}</span>
                <strong>${item.multiline ? nl2br(item.value) : escapeHtml(item.value)}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    `
  );
}

function renderIntroSection(presupuesto: PresupuestoV2): string {
  const extra = getPresupuestoExtra(presupuesto);
  const metadata = getMetadata(presupuesto);

  const intro = getBlockFromAny(
    extra.introduccion,
    extra.descripcion,
    extra.notas,
    metadata.introduccion,
    metadata.descripcion,
    metadata.notas,
    metadata.detalle_propuesta
  );

  if (!intro) return "";

  return renderSection(
    "Detalle de la propuesta",
    `
      <div class="intro-box">
        ${nl2br(intro)}
      </div>
    `
  );
}

function renderCondicionesSection(presupuesto: PresupuestoV2): string {
  const metadata = getMetadata(presupuesto);
  const condiciones = getBlockFromAny(
    presupuesto.condiciones_generales,
    metadata.condiciones_generales,
    metadata.condiciones,
    metadata.notas_legales
  );

  const fallback = `
    Tarifas sujetas a disponibilidad y modificación al momento de reservar.
    La reserva queda confirmada únicamente contra pago y emisión correspondiente.
    Documentación, visados, vacunas y requisitos migratorios son responsabilidad del pasajero.
    Los servicios se rigen por las condiciones de cada proveedor.
  `;

  return renderSection(
    "Condiciones generales",
    `
      <div class="conditions-box">
        ${nl2br(condiciones || fallback)}
      </div>
    `
  );
}

function renderFooter(presupuesto: PresupuestoV2): string {
  return `
    <footer class="footer">
      <div>
        <strong>NOSSIX · ALMUNDO</strong>
        <span>Acompañamiento antes, durante y después del viaje.</span>
      </div>

      <div>
        ${presupuesto.cliente_email ? escapeHtml(presupuesto.cliente_email) : ""}
        ${presupuesto.cliente_telefono ? ` · ${escapeHtml(presupuesto.cliente_telefono)}` : ""}
      </div>
    </footer>
  `;
}

/* =========================================================
   HTML FINAL
========================================================= */

export function buildPresupuestoHtml(data: PresupuestoPdfData): string {
  const presupuesto = data.presupuesto;
  const vuelos = dedupeVuelos(data.vuelos || []);
  const hoteles = dedupeHoteles(data.hoteles || []);
  const servicios = dedupeServicios(data.servicios || []);
  const combinaciones = dedupeCombinaciones(data.combinaciones || []);
  const recommended = getRecommendedCombinacion(presupuesto, combinaciones);
  const recommendedId = recommended?.id || null;

 const hero = renderHero(presupuesto);

  const resumenSection = renderResumenSection(presupuesto, combinaciones);
  const introSection = renderIntroSection(presupuesto);

  const hasCommercialOptions = combinaciones.some((item) => item.visible_en_pdf !== false);

  /*
    IMPORTANTE:
    - Cuando hay opciones comerciales, NO mostramos los recursos globales arriba.
    - Cada opción muestra su propio vuelo + hotel + servicios.
    - Después viene resumen rápido.
    - Después precios y formas de pago.
  */
  const vuelosSection = hasCommercialOptions ? "" : renderVuelosSection(vuelos);
  const hotelesSection = hasCommercialOptions ? "" : renderHotelesSection(hoteles);
  const serviciosSection = hasCommercialOptions ? "" : renderServiciosSection(servicios);

  const opcionesSection = renderOpcionesSection(
    presupuesto,
    vuelos,
    hoteles,
    servicios,
    combinaciones
  );

  const optionsSummarySection = renderOptionsSummary(
    combinaciones,
    recommendedId,
    vuelos,
    hoteles,
    servicios
  );

  const preciosSection = renderPreciosSection(presupuesto, combinaciones);
  const condicionesSection = renderCondicionesSection(presupuesto);

  return `
    <!doctype html>
    <html lang="es">
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(presupuesto.numero || "Presupuesto")}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        ${renderStyles()}
      </head>

      <body>
        <div class="page">
          ${hero}

          <section class="content">
            ${resumenSection}
            ${introSection}
            ${vuelosSection}
            ${hotelesSection}
            ${serviciosSection}
            ${opcionesSection}
            ${optionsSummarySection}
            ${preciosSection}
            ${condicionesSection}
            ${renderFooter(presupuesto)}
          </section>
        </div>
      </body>
    </html>
  `;
}

export function openPresupuestoPreview(data: PresupuestoPdfData): boolean {
  const html = buildPresupuestoHtml(data);

  try {
    const blob = new Blob([html], {
      type: "text/html;charset=utf-8"
    });

    const url = URL.createObjectURL(blob);

    const preview = window.open(
      url,
      `presupuesto-${data.presupuesto.id || Date.now()}`,
      "width=980,height=900"
    );

    if (!preview) {
      URL.revokeObjectURL(url);
      return false;
    }

    preview.focus();

    window.setTimeout(() => {
      URL.revokeObjectURL(url);
    }, 60_000);

    return true;
  } catch (error) {
    console.error("Error abriendo vista previa de presupuesto:", error);
    return false;
  }
}
function renderStyles(): string {
  return `
    <style>
      :root {
        --ink: #172033;
        --muted: #64748b;
        --soft: #f8fafc;
        --line: rgba(15, 23, 42, 0.10);
        --brand: #ff6a00;
        --brand-soft: #fff7ed;
        --orange: #ff6a00;
        --green: #047857;
        --green-soft: #ecfdf5;
        --red: #b91c1c;
        --red-soft: #fef2f2;
        --amber: #b45309;
        --amber-soft: #fffbeb;
        --blue-soft: #eff6ff;
      }

      * {
        box-sizing: border-box;
      }

      html,
      body {
        margin: 0;
        padding: 0;
        background: #e8eef3;
        color: var(--ink);
        font-family:
          Inter,
          ui-sans-serif,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
        font-size: 13px;
        line-height: 1.55;
        font-weight: 400;
      }

      body {
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      .page {
        width: 210mm;
        min-height: 297mm;
        margin: 0 auto;
        background:
          radial-gradient(circle at top left, rgba(255, 106, 0, 0.08), transparent 34%),
          linear-gradient(180deg, #ffffff 0%, #f8fafc 100%);
      }

      .hero {
        display: grid;
        grid-template-columns: minmax(0, 1fr) 230px;
        gap: 24px;
        padding: 26px 30px 24px;
        background:
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.34), transparent 34%),
          linear-gradient(135deg, #ff6a00 0%, #ff7a1a 42%, #f15a24 100%);
        color: white;
      }

      .brand-row {
        display: flex;
        align-items: center;
        gap: 12px;
        margin-bottom: 20px;
      }

      .brand-row img {
        max-width: 155px;
        max-height: 48px;
        object-fit: contain;
        background: rgba(255, 255, 255, 0.98);
        border-radius: 14px;
        padding: 8px 12px;
      }

      .brand-row span {
        display: inline-flex;
        align-items: center;
        min-height: 24px;
        border-radius: 999px;
        padding: 4px 10px;
        background: rgba(255, 255, 255, 0.20);
        color: rgba(255, 255, 255, 0.86);
        font-size: 10px;
        font-weight: 650;
        text-transform: uppercase;
        letter-spacing: 0.13em;
      }

      .hero h1 {
        margin: 0;
        max-width: 520px;
        font-size: 28px;
        line-height: 1.12;
        font-weight: 800;
        letter-spacing: -0.04em;
      }

      .hero p {
        margin: 10px 0 0;
        max-width: 560px;
        color: rgba(255, 255, 255, 0.84);
        font-size: 13px;
        font-weight: 450;
        line-height: 1.5;
      }

      .hero-right {
        align-self: stretch;
        display: flex;
        flex-direction: column;
        justify-content: center;
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.12);
        border: 1px solid rgba(255, 255, 255, 0.18);
        padding: 16px;
        text-align: right;
      }

      .hero-number {
        margin-bottom: 14px;
        color: rgba(255, 255, 255, 0.82);
        font-size: 11px;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      .hero-meta-label {
        color: rgba(255, 255, 255, 0.74);
        font-size: 10px;
        font-weight: 750;
        text-transform: uppercase;
        letter-spacing: 0.12em;
      }

      .hero-seller {
        margin-top: 4px;
        color: #ffffff;
        font-size: 18px;
        line-height: 1.15;
        font-weight: 850;
        letter-spacing: -0.02em;
      }

      .hero-date {
        margin-top: 14px;
        color: rgba(255, 255, 255, 0.70);
        font-size: 10.5px;
        font-weight: 450;
      }

      .content {
        padding: 22px 30px 28px;
      }

      .section {
        margin-bottom: 24px;
      }

      .section-title {
        display: flex;
        align-items: center;
        gap: 14px;
        margin-bottom: 12px;
      }

      .section-title h2 {
        margin: 0;
        color: var(--ink);
        font-size: 15.5px;
        line-height: 1.2;
        font-weight: 800;
        letter-spacing: -0.015em;
      }

      .section-title span {
        height: 1px;
        flex: 1;
        background: var(--line);
      }

      /* =====================================================
         RESUMEN VIAJE — UNA CARD GRANDE
      ===================================================== */

      .trip-summary-card {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.10);
        border-radius: 20px;
        background: rgba(255, 255, 255, 0.90);
        box-shadow: 0 8px 22px rgba(15, 23, 42, 0.035);
      }

      .trip-summary-row {
        min-width: 0;
        padding: 13px 15px;
        border-right: 1px solid rgba(15, 23, 42, 0.08);
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }

      .trip-summary-row:nth-child(2n) {
        border-right: 0;
      }

      .trip-summary-row:nth-last-child(-n + 2) {
        border-bottom: 0;
      }

      .trip-summary-row span {
        display: block;
        margin-bottom: 4px;
        color: var(--muted);
        font-size: 9.5px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.10em;
      }

      .trip-summary-row strong {
        display: block;
        color: var(--ink);
        font-size: 12.7px;
        line-height: 1.38;
        font-weight: 750;
      }

      .trip-summary-row-wide {
  grid-column: 1 / -1;
}

.trip-summary-row-wide strong {
  line-height: 1.55;
}

      .intro-box,
      .text-box,
      .conditions-box {
        border: 1px solid var(--line);
        border-radius: 16px;
        background: rgba(255, 255, 255, 0.78);
        padding: 14px 15px;
        color: #334155;
        font-size: 12.5px;
        font-weight: 450;
        line-height: 1.58;
      }

      .conditions-box {
        color: #475569;
        font-size: 11.5px;
      }

      /* =====================================================
         BADGES / BASE
      ===================================================== */

      .badge {
        display: inline-flex;
        align-items: center;
        min-height: 21px;
        max-width: 100%;
        border-radius: 999px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.18);
        padding: 3px 8px;
        color: #c2410c;
        font-size: 10.5px;
        font-weight: 650;
        line-height: 1.2;
      }

      .badges {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 7px;
      }

      .resource-header {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 12px;
      }

      .resource-header h3,
      .service-card h3 {
        margin: 0;
        color: var(--ink);
        font-size: 15px;
        line-height: 1.25;
        font-weight: 760;
        letter-spacing: -0.015em;
      }

      .resource-price {
        white-space: nowrap;
        border-radius: 13px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.18);
        padding: 8px 10px;
        color: #c2410c;
        font-size: 12.5px;
        font-weight: 760;
      }

      /* =====================================================
         VUELOS — FORMATO GRÁFICO CON ESCALA VERDE
      ===================================================== */

      .flight-card {
        margin-bottom: 12px;
        padding: 14px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: none;
      }

      .flight-capture {
        overflow: hidden;
        margin: 10px 0 12px;
        border: 1px solid var(--line);
        border-radius: 15px;
        background: #f8fafc;
      }

      .flight-capture img {
        display: block;
        width: 100%;
        max-height: 350px;
        object-fit: contain;
      }

      .flight-table-wrap,
      .summary-table-wrap {
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.10);
        border-radius: 14px;
        background: white;
      }

      .flight-table,
      .summary-table,
      .rates-table {
        width: 100%;
        border-collapse: collapse;
      }

      .flight-table th,
      .summary-table th,
      .rates-table th {
        background: #f8fafc;
        color: var(--muted);
        font-size: 9.5px;
        font-weight: 750;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        text-align: left;
        padding: 8px 9px;
        border-bottom: 1px solid var(--line);
      }

      .flight-table td,
      .summary-table td,
      .rates-table td {
        vertical-align: top;
        padding: 9px;
        color: #334155;
        font-size: 11.5px;
        font-weight: 450;
        border-bottom: 1px solid rgba(15, 23, 42, 0.06);
      }

      .flight-table tr:last-child td,
      .summary-table tr:last-child td,
      .rates-table tr:last-child td {
        border-bottom: 0;
      }

      .flight-table strong,
      .summary-table strong,
      .rates-table strong {
        display: block;
        color: var(--ink);
        font-weight: 750;
      }

      .flight-table small,
      .summary-table small,
      .rates-table small {
        display: block;
        margin-top: 2px;
        color: var(--muted);
        font-size: 10.5px;
        font-weight: 450;
        line-height: 1.35;
      }

      .connection-row td {
        background: #ecfdf5;
        color: #047857;
        font-size: 11px;
        font-weight: 850;
        letter-spacing: 0.06em;
        text-align: center;
        text-transform: uppercase;
        border-top: 1px solid rgba(4, 120, 87, 0.16);
        border-bottom: 1px solid rgba(4, 120, 87, 0.16);
      }

      .flight-luggage-note {
        display: flex;
        gap: 8px;
        align-items: flex-start;
        margin-top: 12px;
        border-radius: 13px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.16);
        padding: 9px 11px;
        color: #9a3412;
        font-size: 11.5px;
        line-height: 1.45;
      }

      .flight-luggage-note strong {
        flex: 0 0 auto;
        color: #c2410c;
        font-weight: 850;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .flight-luggage-note span {
        color: #9a3412;
        font-weight: 500;
      }

      .flight-path-cell {
        text-align: center;
      }

      .flight-path-cell span {
        display: block;
        color: var(--muted);
        font-size: 10px;
        font-weight: 650;
      }

      .flight-path {
        position: relative;
        height: 1px;
        margin: 7px 8px;
        background: rgba(255, 106, 0, 0.30);
      }

      .flight-path::before,
      .flight-path::after {
        content: "";
        position: absolute;
        top: 50%;
        width: 6px;
        height: 6px;
        border-radius: 999px;
        background: var(--brand);
        transform: translateY(-50%);
      }

      .flight-path::before {
        left: 0;
      }

      .flight-path::after {
        right: 0;
      }

      .flight-free-text {
        margin-top: 12px;
        border-left: 3px solid rgba(255, 106, 0, 0.35);
        border-radius: 0 12px 12px 0;
        background: var(--soft);
        padding: 10px 12px;
        color: #475569;
        font-size: 11.8px;
        font-weight: 450;
        line-height: 1.58;
      }

      /* =====================================================
         HOTELES
      ===================================================== */

      .hotel-card {
        display: block;
        position: relative;
        margin-bottom: 18px;
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.10);
        border-radius: 22px;
        background: #ffffff;
        box-shadow: none;
      }

      .hotel-gallery {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        grid-template-rows: repeat(2, 150px);
        gap: 8px;
        padding: 10px;
        background: #fff7ed;
        border-bottom: 1px solid rgba(255, 106, 0, 0.16);
      }

      .hotel-photo {
        overflow: hidden;
        border-radius: 16px;
        background: #fed7aa;
      }

      .hotel-photo img {
        display: block;
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .hotel-content {
        position: relative;
        z-index: 2;
        display: block;
        clear: both;
        padding: 16px;
        background: #ffffff;
      }

      .hotel-title-row {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        margin-bottom: 12px;
      }

      .hotel-title-row h3 {
        margin: 0;
        color: var(--ink);
        font-size: 16px;
        line-height: 1.25;
        font-weight: 800;
        letter-spacing: -0.015em;
      }

      .hotel-badges {
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
        margin-top: 8px;
      }

      .hotel-badges span {
        display: inline-flex;
        align-items: center;
        min-height: 23px;
        border-radius: 999px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.18);
        padding: 4px 9px;
        color: #c2410c;
        font-size: 10.5px;
        font-weight: 750;
        line-height: 1.1;
      }

      .hotel-google-rating {
        background: #ecfdf5 !important;
        border-color: rgba(4, 120, 87, 0.18) !important;
        color: #047857 !important;
      }

      .hotel-price {
        white-space: nowrap;
        border-radius: 13px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.18);
        padding: 8px 10px;
        color: #c2410c;
        font-size: 12.5px;
        font-weight: 760;
      }

      .hotel-data-card {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 0;
        overflow: hidden;
        margin-bottom: 12px;
        border: 1px solid rgba(15, 23, 42, 0.09);
        border-radius: 16px;
        background: #f8fafc;
      }

      .hotel-data-item {
        min-width: 0;
        padding: 10px 12px;
        border-right: 1px solid rgba(15, 23, 42, 0.08);
        border-bottom: 1px solid rgba(15, 23, 42, 0.08);
      }

      .hotel-data-item:nth-child(4n) {
        border-right: 0;
      }

      .hotel-data-item:nth-last-child(-n + 4) {
        border-bottom: 0;
      }

      .hotel-data-item small {
        display: block;
        margin-bottom: 3px;
        color: #64748b;
        font-size: 9.2px;
        font-weight: 800;
        text-transform: uppercase;
        letter-spacing: 0.10em;
      }

      .hotel-data-item strong {
        display: block;
        color: var(--ink);
        font-size: 11.8px;
        font-weight: 760;
        line-height: 1.36;
      }

      .hotel-description {
        border-radius: 16px;
        background: #ffffff;
        border: 1px solid rgba(15, 23, 42, 0.09);
        padding: 13px 14px;
        color: #334155;
        font-size: 12.3px;
        font-weight: 450;
        line-height: 1.62;
      }

      .hotel-conditions,
      .small-note {
        margin-top: 10px;
        border-radius: 13px;
        background: var(--amber-soft);
        border: 1px solid rgba(180, 83, 9, 0.14);
        padding: 10px 11px;
        color: #78350f;
        font-size: 11px;
        font-weight: 450;
        line-height: 1.55;
      }

      /* =====================================================
         SERVICIOS GENERALES
      ===================================================== */

      .services-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }

      .service-card {
        padding: 13px;
        border: 1px solid var(--line);
        border-radius: 18px;
        background: rgba(255, 255, 255, 0.88);
        box-shadow: none;
      }

      .service-top {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        margin-bottom: 8px;
      }

      .service-type {
        margin-bottom: 3px;
        color: #ea580c;
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.10em;
        text-transform: uppercase;
      }

      .service-desc {
        color: #475569;
        font-size: 11.8px;
        font-weight: 450;
        line-height: 1.55;
      }

      .service-flags {
        display: flex;
        flex-wrap: wrap;
        gap: 5px;
        margin-top: 10px;
      }

      .service-flags span {
        display: inline-flex;
        min-height: 20px;
        align-items: center;
        border-radius: 999px;
        background: var(--green-soft);
        border: 1px solid rgba(4, 120, 87, 0.14);
        padding: 3px 8px;
        color: var(--green);
        font-size: 10px;
        font-weight: 650;
      }

      /* =====================================================
         OPCIONES PRESUPUESTADAS
         Usa las clases reales generadas por PARTE 3:
         option-card / option-head / option-bundle /
         option-resource-card / option-resource-head.
      ===================================================== */

      .options-stack {
        display: grid;
        gap: 20px;
      }

      .option-card {
        overflow: hidden;
        border: 1px solid rgba(255, 106, 0, 0.22);
        border-radius: 24px;
        background:
          linear-gradient(180deg, #ffffff 0%, #ffffff 64%, #fffaf4 100%);
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.035);
      }

      .option-card.recommended {
        border-color: rgba(255, 106, 0, 0.38);
      }

      .option-head {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 16px;
        padding: 17px 18px 14px;
        background:
          radial-gradient(circle at top right, rgba(255, 106, 0, 0.11), transparent 32%),
          linear-gradient(180deg, #fff7ed 0%, #ffffff 100%);
        border-bottom: 1px solid rgba(255, 106, 0, 0.14);
      }

      .option-kicker {
        margin-bottom: 4px;
        color: #ea580c;
        font-size: 10px;
        font-weight: 850;
        letter-spacing: 0.13em;
        text-transform: uppercase;
      }

      .option-head h3 {
        margin: 0;
        color: var(--ink);
        font-size: 19px;
        line-height: 1.2;
        font-weight: 850;
        letter-spacing: -0.025em;
      }

      .option-head p {
        margin: 5px 0 0;
        color: #64748b;
        font-size: 12.2px;
        font-weight: 500;
        line-height: 1.42;
      }

      .option-tag {
        display: inline-flex;
        white-space: nowrap;
        border-radius: 999px;
        background: #ffffff;
        border: 1px solid rgba(255, 106, 0, 0.20);
        padding: 6px 10px;
        color: #c2410c;
        font-size: 10px;
        font-weight: 800;
      }

      .option-description {
        margin: 14px 18px 0;
        border-radius: 14px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.14);
        padding: 11px 13px;
        color: #9a3412;
        font-size: 11.8px;
        font-weight: 500;
        line-height: 1.56;
      }

      .option-bundle {
        padding: 16px 18px 18px;
      }

      .option-bundle-title {
        display: none;
      }

      .option-bundle-stack {
        display: grid;
        gap: 14px;
      }

      .option-resource-card {
        overflow: hidden;
        border: 1px solid rgba(15, 23, 42, 0.10);
        border-radius: 19px;
        background: #ffffff;
      }

      .option-resource-head {
        display: flex;
        justify-content: space-between;
        gap: 12px;
        padding: 14px 15px 12px;
        background: #fffaf4;
        border-bottom: 1px solid rgba(255, 106, 0, 0.12);
      }

      .option-resource-kicker {
        margin-bottom: 5px;
        color: #ea580c;
        font-size: 9.8px;
        font-weight: 850;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .option-resource-head h4 {
        margin: 0;
        color: var(--ink);
        font-size: 16px;
        line-height: 1.25;
        font-weight: 820;
        letter-spacing: -0.015em;
      }

      .option-resource-head p {
        margin: 5px 0 0;
        color: #64748b;
        font-size: 11.8px;
        font-weight: 600;
        line-height: 1.35;
      }

      .option-flight-image {
        overflow: hidden;
        margin: 14px;
        border: 1px solid rgba(15, 23, 42, 0.10);
        border-radius: 15px;
        background: #f8fafc;
      }

      .option-flight-image img {
        display: block;
        width: 100%;
        max-height: 330px;
        object-fit: contain;
      }

      .option-flight-table {
        padding: 14px;
      }

      .option-flight-card .flight-table-wrap {
        border-radius: 14px;
      }

      .option-flight-card .option-resource-text {
        display: none;
      }

      .option-resource-note {
        display: flex;
        gap: 9px;
        align-items: flex-start;
        margin: 0 14px 14px;
        border-radius: 14px;
        background: #fff7ed;
        border: 1px solid rgba(255, 106, 0, 0.16);
        padding: 10px 12px;
        color: #9a3412;
        font-size: 11.5px;
        line-height: 1.45;
      }

      .option-resource-note strong {
        flex: 0 0 auto;
        color: #c2410c;
        font-weight: 850;
        text-transform: uppercase;
        letter-spacing: 0.06em;
      }

      .option-resource-note span {
        color: #9a3412;
        font-weight: 500;
      }

      .option-resource-text {
        margin: 0 14px 14px;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid rgba(15, 23, 42, 0.08);
        padding: 11px 13px;
        color: #334155;
        font-size: 11.7px;
        font-weight: 450;
        line-height: 1.56;
      }

      .option-hotel-card .hotel-gallery {
        margin: 0;
        border-top: 0;
        border-bottom: 1px solid rgba(255, 106, 0, 0.12);
      }

      .compact-hotel-data {
        margin: 14px;
      }

      .compact-hotel-data .hotel-data-card {
        margin-bottom: 0;
      }

      .option-services-box {
        border: 1px solid rgba(15, 23, 42, 0.10);
        border-radius: 19px;
        background: #ffffff;
        padding: 14px;
      }

      .option-services-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
      }

      .option-service-item {
        min-width: 0;
        border-radius: 14px;
        background: #f8fafc;
        border: 1px solid rgba(15, 23, 42, 0.08);
        padding: 10px 11px;
      }

      .option-service-item strong {
        display: block;
        color: var(--ink);
        font-size: 12.2px;
        font-weight: 780;
        line-height: 1.3;
      }

      .option-service-item span {
        display: block;
        margin-top: 4px;
        color: #64748b;
        font-size: 10.9px;
        font-weight: 450;
        line-height: 1.35;
      }

      /* =====================================================
         RESUMEN RÁPIDO
      ===================================================== */

      .options-summary-section {
        margin-top: 4px;
      }

      .summary-table th:nth-child(2),
      .summary-table td:nth-child(2) {
        width: 48%;
      }

      .summary-table td:nth-child(2) {
        white-space: normal;
        color: #047857;
        font-weight: 750;
      }

      .summary-table td:nth-child(3) {
        white-space: nowrap;
        color: #047857;
        font-weight: 800;
      }

      .summary-table td {
        line-height: 1.42;
      }

      .summary-recommended,
      .summary-tag {
        display: inline-flex;
        margin: 0 0 3px 4px;
        border-radius: 999px;
        padding: 3px 7px;
        font-size: 9.5px;
        font-weight: 750;
        line-height: 1;
      }

      .summary-recommended {
        background: var(--green-soft);
        color: var(--green);
        border: 1px solid rgba(4, 120, 87, 0.14);
      }

      .summary-tag {
        background: var(--amber-soft);
        color: var(--amber);
        border: 1px solid rgba(180, 83, 9, 0.14);
      }

      /* =====================================================
         PRECIOS Y FORMAS DE PAGO
         Usa clases reales: price-option-card + option-head.
      ===================================================== */

      .prices-stack {
        display: grid;
        gap: 16px;
      }

      .price-option-card {
        overflow: hidden;
        border: 1px solid rgba(255, 106, 0, 0.22);
        border-radius: 22px;
        background: #ffffff;
        box-shadow: 0 10px 24px rgba(15, 23, 42, 0.035);
      }

      .price-option-card.recommended {
        border-color: rgba(255, 106, 0, 0.38);
      }

      .price-option-card > .option-head {
        padding: 14px 16px 12px;
        background: #fff7ed;
      }

      .price-option-card .option-head h3 {
        font-size: 17px;
      }

      .option-price-zone {
        padding: 14px 16px 16px;
      }

      .main-price-box {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        border-radius: 18px;
        background:
          radial-gradient(circle at top right, rgba(255, 255, 255, 0.24), transparent 32%),
          linear-gradient(135deg, #ff6a00 0%, #f97316 48%, #ea580c 100%);
        padding: 15px 16px;
        color: white;
      }

      .price-label {
        color: rgba(255, 255, 255, 0.78);
        font-size: 9.5px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
      }

      .main-price {
        margin-top: 2px;
        font-size: 25px;
        line-height: 1.05;
        font-weight: 850;
        letter-spacing: -0.04em;
      }

      .price-composition {
        max-width: 520px;
        margin-top: 8px;
        color: rgba(255, 255, 255, 0.82);
        font-size: 11px;
        font-weight: 450;
        line-height: 1.45;
      }

      .per-pax-price {
        align-self: center;
        min-width: 150px;
        border-radius: 14px;
        background: rgba(255, 255, 255, 0.14);
        border: 1px solid rgba(255, 255, 255, 0.16);
        padding: 9px 10px;
        text-align: right;
      }

      .per-pax-price span {
        display: block;
        color: rgba(255, 255, 255, 0.74);
        font-size: 9.5px;
        font-weight: 650;
        text-transform: uppercase;
      }

      .per-pax-price strong {
        display: block;
        margin-top: 2px;
        color: white;
        font-size: 14px;
        font-weight: 800;
      }

      .alt-prices {
        display: grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 8px;
        margin-top: 10px;
      }

      .alt-price-item {
        border-radius: 13px;
        background: var(--soft);
        border: 1px solid rgba(15, 23, 42, 0.07);
        padding: 9px 10px;
      }

      .alt-price-item span {
        display: block;
        color: var(--muted);
        font-size: 9.5px;
        font-weight: 750;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }

      .alt-price-item strong {
        display: block;
        margin-top: 2px;
        color: var(--ink);
        font-size: 12.5px;
        font-weight: 800;
      }

      .rates-box,
      .promos-box,
      .payments-box,
      .option-resources {
        margin-top: 11px;
        border: 1px solid var(--line);
        border-radius: 15px;
        background: rgba(255, 255, 255, 0.78);
        padding: 11px;
      }

      .mini-title {
        margin-bottom: 8px;
        color: var(--ink);
        font-size: 10px;
        font-weight: 800;
        letter-spacing: 0.10em;
        text-transform: uppercase;
      }

      .promo-item,
      .payment-item {
        border-radius: 12px;
        background: var(--soft);
        border: 1px solid rgba(15, 23, 42, 0.06);
        padding: 9px 10px;
        margin-top: 7px;
      }

      .promo-item:first-of-type,
      .payment-item:first-of-type {
        margin-top: 0;
      }

      .promo-item strong,
      .payment-item strong {
        display: block;
        color: var(--ink);
        font-size: 11.8px;
        font-weight: 760;
      }

      .promo-item p,
      .payment-item p {
        margin: 3px 0 0;
        color: #475569;
        font-size: 11.3px;
        font-weight: 450;
        line-height: 1.45;
      }

      .discount-item {
        background: var(--green-soft);
        border-color: rgba(4, 120, 87, 0.13);
      }

      .payment-account {
        background: var(--blue-soft);
        border-color: rgba(37, 99, 235, 0.13);
      }

      .payment-conditions {
        margin-top: 9px;
        border-radius: 12px;
        background: var(--amber-soft);
        border: 1px solid rgba(180, 83, 9, 0.13);
        padding: 9px 10px;
        color: #78350f;
        font-size: 11.2px;
        font-weight: 450;
        line-height: 1.5;
      }

      .included-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 9px;
        margin-top: 11px;
      }

      .included-box {
        border-radius: 15px;
        border: 1px solid var(--line);
        padding: 11px;
        color: #334155;
        font-size: 11.5px;
        font-weight: 450;
        line-height: 1.55;
      }

      .included-box.positive {
        background: var(--green-soft);
        border-color: rgba(4, 120, 87, 0.13);
      }

      .included-box.negative {
        background: var(--red-soft);
        border-color: rgba(185, 28, 28, 0.12);
      }

      /* =====================================================
         FOOTER
      ===================================================== */

      .footer {
        display: flex;
        justify-content: space-between;
        gap: 16px;
        margin-top: 26px;
        border-top: 1px solid var(--line);
        padding-top: 14px;
        color: var(--muted);
        font-size: 10.8px;
        font-weight: 450;
      }

      .footer strong {
        display: block;
        color: var(--ink);
        font-size: 11.5px;
        font-weight: 800;
      }

      .footer span {
        display: block;
        margin-top: 2px;
      }

      /* =====================================================
         PRINT
      ===================================================== */

      @media print {
        html,
        body {
          background: white;
        }

        .page {
          width: auto;
          min-height: auto;
          margin: 0;
          background: white;
        }

        .hero {
          padding: 22px 26px 20px;
        }

        .content {
          padding: 18px 26px 22px;
        }

        .section {
          margin-bottom: 19px;
        }

        .trip-summary-card,
        .intro-box,
        .conditions-box,
        .main-price-box,
        .alt-prices,
        .payments-box,
        .promos-box,
        .included-grid,
        .price-option-card {
          break-inside: avoid;
          page-break-inside: avoid;
        }

        .option-card,
        .option-bundle,
        .option-bundle-stack,
        .option-resource-card,
        .hotel-card,
        .flight-card,
        .service-card {
          break-inside: auto;
          page-break-inside: auto;
        }

        .option-card {
          margin-bottom: 16px;
          overflow: visible;
        }

        .option-resource-card,
        .hotel-card {
          overflow: visible;
        }

        .hotel-gallery {
          grid-template-rows: repeat(2, 128px);
        }

        .option-hotel-card .hotel-gallery {
          grid-template-rows: repeat(2, 112px);
        }

        .option-flight-image img {
          max-height: 280px;
        }

        .main-price-box {
          padding: 13px 15px;
        }

        .main-price {
          font-size: 23px;
        }

        .price-option-card {
          margin-bottom: 12px;
        }
      }

      @page {
        size: A4;
        margin: 0;
      }

      /* =====================================================
         MOBILE / PREVIEW ANGOSTO
      ===================================================== */

      @media screen and (max-width: 820px) {
        .page {
          width: 100%;
        }

        .hero {
          grid-template-columns: 1fr;
        }

        .hero-right {
          text-align: left;
        }

        .trip-summary-card,
        .info-grid,
        .services-grid,
        .included-grid,
        .alt-prices,
        .option-services-grid {
          grid-template-columns: 1fr;
        }

        .trip-summary-row,
        .trip-summary-row:nth-child(2n),
        .trip-summary-row:nth-last-child(-n + 2) {
          border-right: 0;
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .trip-summary-row:last-child {
          border-bottom: 0;
        }

        .hotel-gallery {
          grid-template-columns: repeat(2, minmax(0, 1fr));
          grid-template-rows: repeat(2, 120px);
        }

        .hotel-title-row,
        .option-head,
        .main-price-box,
        .resource-header {
          display: block;
        }

        .hotel-price,
        .option-tag {
          display: inline-flex;
          margin-top: 10px;
        }

        .hotel-data-card {
          grid-template-columns: 1fr;
        }

        .hotel-data-item {
          border-right: 0;
        }

        .hotel-data-item:nth-last-child(-n + 4) {
          border-bottom: 1px solid rgba(15, 23, 42, 0.08);
        }

        .hotel-data-item:last-child {
          border-bottom: 0;
        }

        .per-pax-price {
          margin-top: 10px;
          text-align: left;
        }
      }
    </style>
  `;
}