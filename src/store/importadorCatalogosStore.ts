import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type ImportCatalogType =
  | "clientes"
  | "destinos"
  | "metodos_contacto"
  | "servicios"
  | "formas_pago"
  | "operadores"
  | "proveedores"
  | "cajas"
  | "hoteles_maestros"
  | "carritos"
  | "carritos_files_historicos"
  | "live_contactos"
  | "live_conversaciones"
  | "live_mensajes";

export type ImportColumnMap = Record<string, string>;

export type ImportRawRow = Record<string, string>;

export type ImportMappedValue =
  | string
  | boolean
  | number
  | null
  | Record<string, unknown>
  | unknown[];

export type ImportPreviewRow = {
  index: number;
  raw: ImportRawRow;
  mapped: Record<string, ImportMappedValue>;
  status: "nuevo" | "duplicado" | "invalido";
  reason: string | null;
};

export type ImportResult = {
  inserted: number;
  skipped: number;
  invalid: number;
  errors: string[];
};

type ExistingCatalogItem = {
  id: string;
  nombre?: string | null;
  pais?: string | null;
  ubicacion?: string | null;
  nombre_comercial?: string | null;
  numero_carrito?: string | null;
  numero_file?: string | null;
  legacy_id?: string | null;
  legacy_cliente_id?: string | null;
  live_contact_id?: string | null;
  live_conversation_id?: string | null;
  activo?: boolean | null;

  nombre_completo?: string | null;
  telefono?: string | null;
  email?: string | null;
  observaciones?: string | null;
};

type ClienteLookupItem = {
  id: string;
  legacy_cliente_id?: string | null;
  nombre_completo: string | null;
  telefono: string | null;
  email: string | null;
};

type ImportadorCatalogosState = {
  loading: boolean;
  importing: boolean;
  error: string | null;

  catalogType: ImportCatalogType;
  rawText: string;
  delimiter: "," | ";" | "\t";
  hasHeaders: boolean;

  detectedColumns: string[];
  columnMap: ImportColumnMap;
  rawRows: ImportRawRow[];
  previewRows: ImportPreviewRow[];
  result: ImportResult | null;

  setCatalogType: (catalogType: ImportCatalogType) => void;
  setRawText: (rawText: string) => void;
  setDelimiter: (delimiter: "," | ";" | "\t") => void;
  setHasHeaders: (hasHeaders: boolean) => void;
  setColumnMapValue: (targetField: string, sourceColumn: string) => void;

  parseRawText: () => void;
  buildPreview: () => Promise<void>;
  importPreview: () => Promise<boolean>;

  reset: () => void;
  clearError: () => void;
};

const CATALOG_LABELS: Record<ImportCatalogType, string> = {
  clientes: "Clientes",
  destinos: "Destinos",
  metodos_contacto: "Métodos de contacto",
  servicios: "Servicios",
  formas_pago: "Formas de pago",
  operadores: "Operadores",
  proveedores: "Proveedores",
  cajas: "Cajas",
  hoteles_maestros: "Hoteles maestros",
  carritos: "Carritos",
  carritos_files_historicos: "Carritos / Files históricos",
  live_contactos: "Live Connect · Contactos",
  live_conversaciones: "Live Connect · Conversaciones",
  live_mensajes: "Live Connect · Mensajes"
};

const REQUIRED_FIELDS: Record<ImportCatalogType, string[]> = {
  clientes: [],
  destinos: ["nombre"],
  metodos_contacto: ["nombre"],
  servicios: ["nombre"],
  formas_pago: ["nombre"],
  operadores: ["nombre"],
  proveedores: ["nombre_comercial"],
  cajas: ["nombre"],
  hoteles_maestros: ["nombre"],
  carritos: ["telefono", "fecha_venta"],
  carritos_files_historicos: ["legacy_id", "legacy_cliente_id", "fecha_venta"],
  live_contactos: ["live_contact_id"],
  live_conversaciones: ["live_conversation_id"],
  live_mensajes: ["live_conversation_id", "orden", "direction", "message_type"]
};

const DEFAULT_FIELD_MAP: Record<ImportCatalogType, string[]> = {
  clientes: ["nombre_completo", "telefono", "email", "observaciones"],

  destinos: ["nombre", "pais", "activo"],

  metodos_contacto: ["nombre", "color", "activo"],

  servicios: ["nombre", "color", "activo"],

  formas_pago: ["nombre", "impacta_tesoreria", "activo"],

  operadores: ["nombre", "color", "razon_social", "cuit", "activo"],

  proveedores: ["nombre_comercial", "razon_social", "cuit", "telefono", "activo"],

  cajas: ["nombre", "tipo", "moneda", "sucursal_id", "descripcion", "orden", "activa", "activo"],

  hoteles_maestros: [
    "nombre",
    "ubicacion",
    "categoria",
    "descripcion",
    "imagenes",
    "regimen",
    "tipo_habitacion",
    "tipo_tarifa",
    "cargos_adicionales",
    "descripcion_cargos",
    "veces_usado",
    "ultimo_uso",
    "activo"
  ],

  carritos: [
    "telefono",
    "email",
    "nombre_pasajero",
    "numero_carrito",
    "fecha_venta",
    "servicio_id",
    "servicio",
    "metodo_contacto",
    "forma_pago_id",
    "forma_pago",
    "destino",
    "fecha_in",
    "fecha_out",
    "solo_ida",
    "importe",
    "moneda",
    "observaciones"
  ],

  carritos_files_historicos: [
    "legacy_id",
    "legacy_cliente_id",
    "numero_carrito",
    "numero_file",
    "es_almundo",
    "fecha_venta",
    "fecha_in",
    "fecha_out",
    "solo_ida",
    "importe",
    "importe_bruto",
    "importe_final",
    "moneda",
    "destino",
    "servicio_id",
    "servicio",
    "metodo_contacto",
    "forma_pago_id",
    "forma_pago",
    "vendedor_id",
    "sucursal_id",
    "promocode",
    "importe_promocode",
    "derivado_control",
    "utilidad_neta",
    "regalias",
    "utilidad_bruta",
    "importe_facturar",
    "facturado",
    "numero_factura",
    "numero_factura_arca",
    "cobrado",
    "controlado",
    "fecha_cobro",
    "fecha_factura",
    "tipo_cambio_usado",
    "operador_id",
    "operador_mayorista",
    "neto_operador",
    "fecha_vencimiento_operador",
    "saldo_pendiente_operador",
    "estado_pago_operador",
    "impacto_riesgo",
    "riesgo_resuelto",
    "riesgo_resuelto_at",
    "riesgo_resuelto_por",
    "cancelado",
    "fecha_cancelacion",
    "motivo_cancelacion",
    "distinta_moneda_liquidacion",
    "moneda_liquidacion",
    "importe_liquidacion",
    "created_at",
    "updated_at"
  ],

  live_contactos: [
    "live_contact_id",
    "nombre",
    "apellidos",
    "nombre_completo",
    "avatar_url",
    "email",
    "celular",
    "celular_normalizado",
    "tipo_documento",
    "documento",
    "ciudad",
    "genero",
    "direccion",
    "fecha_cumpleanos",
    "pais",
    "ubicacion",
    "habeas_data",
    "etiquetas",
    "empresa",
    "extra_1",
    "extra_2",
    "dinamicos",
    "autoasignado",
    "bloqueado",
    "live_fecha_creado",
    "live_fecha_editado"
  ],

  live_conversaciones: [
    "live_conversation_id",
    "etiqueta",
    "canal_nombre",
    "canal_tipo",
    "live_contact_id",
    "live_contacto_nombre",
    "telefono",
    "telefono_normalizado",
    "empresa",
    "live_fecha_creado",
    "live_fecha_editado",
    "live_fecha_finalizado",
    "grupo",
    "agente",
    "pais",
    "ips",
    "browser",
    "ultimo_mensaje",
    "url_conversacion",
    "html_url_original",
    "html_raw"
  ],

  live_mensajes: [
    "live_conversation_id",
    "orden",
    "fecha_mensaje",
    "hora_texto",
    "direction",
    "sender_name",
    "sender_role",
    "content",
    "message_type",
    "media_url",
    "media_filename",
    "media_mime_type",
    "raw_html"
  ]
};

function normalizeError(error: unknown): string {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "Ocurrió un error.");

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para importar en este catálogo.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("foreign key")) {
      return "La importación intentó vincular un dato que no existe en la base actual. Revisá el mapeo o dejá ese campo sin mapear.";
    }

    if (message.toLowerCase().includes("column") && message.toLowerCase().includes("does not exist")) {
      return `Hay una columna que no existe en la tabla destino. Detalle: ${message}`;
    }

    return message;
  }

  return String(error);
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .replace(/\\N/g, "")
    .replace(/\\"/g, '"')
    .replace(/^"+|"+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function nullableUuid(value: unknown): string | null {
  const cleaned = cleanText(value);
  if (!cleaned) return null;
  return isUuid(cleaned) ? cleaned : null;
}

function titleCase(value: string): string {
  const cleaned = cleanText(value).toLowerCase();

  if (!cleaned) return "";

  const lowercaseWords = new Set(["de", "del", "la", "las", "el", "los", "y", "do", "da", "dos"]);

  return cleaned
    .split(" ")
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(" ");
}

function parseBoolean(value: unknown, defaultValue = true): boolean {
  const normalized = normalizeText(value);

  if (!normalized) return defaultValue;

  if (["true", "si", "sí", "1", "activo", "activa", "yes", "y", "x"].includes(normalized)) {
    return true;
  }

  if (["false", "no", "0", "inactivo", "inactiva", "baja", "n", "ninguno"].includes(normalized)) {
    return false;
  }

  return defaultValue;
}

function parseNumber(value: unknown, defaultValue = 100): number {
  const cleaned = cleanText(value);

  if (!cleaned) return defaultValue;

  const normalized = cleaned.replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return defaultValue;

  return parsed;
}

function parseMoney(value: unknown, defaultValue = 0): number {
  const cleaned = cleanText(value);

  if (!cleaned) return defaultValue;

  const normalized = cleaned.replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return defaultValue;

  return parsed;
}

function normalizeMoneda(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase();

  if (
    normalized === "USD" ||
    normalized === "DOLAR" ||
    normalized === "DÓLAR" ||
    normalized === "DOLARES" ||
    normalized === "DÓLARES"
  ) {
    return "USD";
  }

  return "ARS";
}

function normalizeCajaTipo(value: unknown): string {
  const normalized = normalizeText(value).toUpperCase();

  if (normalized === "BANCO") return "BANCO";
  if (normalized === "BILLETERA") return "BILLETERA";
  if (normalized === "TARJETA") return "TARJETA";
  if (normalized === "ALMUNDO") return "ALMUNDO";
  if (normalized === "OTRA") return "OTRA";

  return "CAJA";
}

function normalizePhone(value: unknown): string {
  let phone = String(value || "").replace(/\D/g, "");

  if (!phone) return "";

  phone = phone.replace(/^00+/, "");

  if (phone.startsWith("5499") && phone.length >= 14) {
    phone = `549${phone.slice(4)}`;
  }

  return phone;
}

function normalizeEmail(value: unknown): string {
  return String(value || "").trim().toLowerCase();
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(cleanText(value));
}

function parseDate(value: unknown): string | null {
  const raw = cleanText(value);

  if (!raw) return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return raw;
  }

  const dateTimeMatch = raw.match(/^(\d{4}-\d{2}-\d{2})[ T]/);
  if (dateTimeMatch) {
    return dateTimeMatch[1];
  }

  const slashMatch = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3];

    return `${year}-${month}-${day}`;
  }

  const dashMatch = raw.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);

  if (dashMatch) {
    const day = dashMatch[1].padStart(2, "0");
    const month = dashMatch[2].padStart(2, "0");
    const year = dashMatch[3];

    return `${year}-${month}-${day}`;
  }

  const parsed = new Date(raw);

  if (Number.isNaN(parsed.getTime())) return null;

  const year = parsed.getFullYear();
  const month = String(parsed.getMonth() + 1).padStart(2, "0");
  const day = String(parsed.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDateTime(value: unknown): string | null {
  const raw = cleanText(value);

  if (!raw) return null;

  const isoReady = raw.includes("T") ? raw : raw.replace(" ", "T");
  const parsedDirect = new Date(isoReady);

  if (!Number.isNaN(parsedDirect.getTime())) {
    return parsedDirect.toISOString();
  }

  const slashMatch = raw.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
  );

  if (slashMatch) {
    const day = Number(slashMatch[1]);
    const month = Number(slashMatch[2]);
    const year = Number(slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3]);
    const hour = Number(slashMatch[4] || 0);
    const minute = Number(slashMatch[5] || 0);
    const second = Number(slashMatch[6] || 0);

    const parsed = new Date(year, month - 1, day, hour, minute, second);

    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }

  return null;
}

function parseJsonObject(value: unknown): Record<string, unknown> {
  const raw = cleanText(value);

  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    return {};
  }

  return {};
}

function parseJsonArray(value: unknown): unknown[] {
  const raw = cleanText(value);

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      return [parsed];
    }
  } catch {
    return [];
  }

  return [];
}

function parseHotelCategoria(value: unknown): number | null {
  const cleaned = cleanText(value);

  if (!cleaned) return null;

  const normalized = cleaned.replace(",", ".").replace(/[^\d.]/g, "");
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function generateHistoricCartNumber(index: number, fechaVenta: string | null, telefono: string): string {
  const datePart = (fechaVenta || "0000-00-00").replace(/\D/g, "").slice(0, 8) || "00000000";
  const phonePart = normalizePhone(telefono).slice(-4) || String(index).padStart(4, "0");
  const indexPart = String(index).padStart(5, "0");

  return `HIST-${datePart}-${phonePart}-${indexPart}`;
}

function generateHistoricFileNumber(index: number, fechaVenta: string | null, legacyId: string): string {
  const datePart = (fechaVenta || "0000-00-00").replace(/\D/g, "").slice(0, 8) || "00000000";
  const idPart = cleanText(legacyId).replace(/\D/g, "").slice(-5) || String(index).padStart(5, "0");

  return `FILE-HIST-${datePart}-${idPart}`;
}

function splitCsvRecords(text: string): string[] {
  const records: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && next === '"') {
      current += '""';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      current += char;
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") index += 1;

      if (current.trim()) records.push(current);

      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) records.push(current);

  return records;
}

function splitCsvLine(line: string, delimiter: "," | ";" | "\t"): string[] {
  const values: string[] = [];
  let current = "";
  let insideQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());

  return values.map((value) => {
    const cleaned = value.replace(/^"|"$/g, "").trim();

    if (cleaned === "\\N") return "";
    if (cleaned.toLowerCase() === "null") return "";

    return cleaned;
  });
}

function parseTextToRows(
  rawText: string,
  delimiter: "," | ";" | "\t",
  hasHeaders: boolean
): {
  columns: string[];
  rows: ImportRawRow[];
} {
  const clean = rawText.trim();

  if (!clean) {
    return {
      columns: [],
      rows: []
    };
  }

  try {
    const parsed = JSON.parse(clean);

    if (Array.isArray(parsed)) {
      const jsonRows = parsed
        .filter((item) => item && typeof item === "object")
        .map((item) => {
          const row: ImportRawRow = {};

          Object.entries(item as Record<string, unknown>).forEach(([key, value]) => {
            row[key] = String(value ?? "");
          });

          return row;
        });

      const columns = Array.from(new Set(jsonRows.flatMap((row) => Object.keys(row))));

      return {
        columns,
        rows: jsonRows
      };
    }
  } catch {
    // No es JSON. Sigue como CSV/TSV.
  }

  const records = splitCsvRecords(clean).filter((record) => record.trim());

  if (records.length === 0) {
    return {
      columns: [],
      rows: []
    };
  }

  const parsedRecords = records.map((record) => splitCsvLine(record, delimiter));
  const firstRecord = parsedRecords[0] || [];

  const columns = hasHeaders
    ? firstRecord.map((column, index) => cleanText(column) || `columna_${index + 1}`)
    : firstRecord.map((_, index) => `columna_${index + 1}`);

  const dataRecords = hasHeaders ? parsedRecords.slice(1) : parsedRecords;

  const rows = dataRecords.map((record) => {
    const row: ImportRawRow = {};

    columns.forEach((column, index) => {
      row[column] = record[index] || "";
    });

    return row;
  });

  return {
    columns,
    rows
  };
}

function guessColumn(columns: string[], possibleNames: string[]): string {
  const normalizedColumns = columns.map((column) => ({
    original: column,
    normalized: normalizeText(column)
  }));

  for (const possibleName of possibleNames) {
    const normalizedPossibleName = normalizeText(possibleName);
    const exact = normalizedColumns.find((column) => column.normalized === normalizedPossibleName);

    if (exact) return exact.original;
  }

  for (const possibleName of possibleNames) {
    const normalizedPossibleName = normalizeText(possibleName);
    const partial = normalizedColumns.find((column) => column.normalized.includes(normalizedPossibleName));

    if (partial) return partial.original;
  }

  return "";
}

function buildInitialMap(catalogType: ImportCatalogType, columns: string[]): ImportColumnMap {
  const map: ImportColumnMap = {};

  if (catalogType === "clientes") {
    map.nombre_completo = guessColumn(columns, [
      "nombre_pasajero",
      "nombre pasajero",
      "pasajero",
      "cliente",
      "nombre_cliente",
      "nombre cliente",
      "nombre_completo",
      "nombre completo",
      "fullname",
      "full name"
    ]);

    map.telefono = guessColumn(columns, ["telefono", "teléfono", "tel", "celular", "whatsapp", "phone"]);
    map.email = guessColumn(columns, ["email", "mail", "correo", "correo electronico", "correo electrónico"]);

    map.observaciones = guessColumn(columns, [
      "notas_adicionales",
      "notas adicionales",
      "observaciones",
      "notas",
      "comentarios",
      "detalle"
    ]);
  }

  if (catalogType === "destinos") {
    map.nombre = guessColumn(columns, ["nombre", "destino", "ciudad", "lugar", "name"]);
    map.pais = guessColumn(columns, ["pais", "país", "country"]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "metodos_contacto") {
    map.nombre = guessColumn(columns, ["nombre", "metodo", "método", "origen", "contacto"]);
    map.color = guessColumn(columns, ["color"]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "servicios") {
    map.nombre = guessColumn(columns, ["nombre", "servicio", "tipo", "producto"]);
    map.color = guessColumn(columns, ["color"]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "formas_pago") {
    map.nombre = guessColumn(columns, ["nombre", "forma", "forma_pago", "pago", "medio"]);
    map.impacta_tesoreria = guessColumn(columns, [
      "impacta_tesoreria",
      "impacta tesoreria",
      "impacta tesorería",
      "impacta caja",
      "impacta"
    ]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "operadores") {
    map.nombre = guessColumn(columns, ["nombre", "operador", "mayorista"]);
    map.color = guessColumn(columns, ["color"]);
    map.razon_social = guessColumn(columns, ["razon_social", "razón social", "razon", "empresa"]);
    map.cuit = guessColumn(columns, ["cuit", "cuil", "tax"]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "proveedores") {
    map.nombre_comercial = guessColumn(columns, [
      "nombre_comercial",
      "nombre comercial",
      "nombre",
      "proveedor",
      "empresa"
    ]);
    map.razon_social = guessColumn(columns, ["razon_social", "razón social", "razon", "empresa"]);
    map.cuit = guessColumn(columns, ["cuit", "cuil", "tax"]);
    map.telefono = guessColumn(columns, ["telefono", "teléfono", "tel", "phone"]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "cajas") {
    map.nombre = guessColumn(columns, ["nombre", "caja", "cuenta", "banco"]);
    map.tipo = guessColumn(columns, ["tipo", "tipo caja", "tipo_caja"]);
    map.moneda = guessColumn(columns, ["moneda", "currency", "divisa"]);
    map.sucursal_id = guessColumn(columns, ["sucursal_id", "sucursal"]);
    map.descripcion = guessColumn(columns, ["descripcion", "descripción", "detalle", "observacion"]);
    map.orden = guessColumn(columns, ["orden", "posicion", "posición"]);
    map.activa = guessColumn(columns, ["activa", "activo", "estado", "habilitado"]);
    map.activo = map.activa;
  }

  if (catalogType === "hoteles_maestros") {
    map.nombre = guessColumn(columns, ["nombre", "hotel", "alojamiento", "name"]);
    map.ubicacion = guessColumn(columns, ["ubicacion", "ubicación", "direccion", "dirección", "zona", "destino"]);
    map.categoria = guessColumn(columns, ["categoria", "categoría", "estrellas", "stars"]);
    map.descripcion = guessColumn(columns, ["descripcion", "descripción", "detalle", "description"]);
    map.imagenes = guessColumn(columns, ["imagenes", "imágenes", "images", "fotos", "galeria", "galería"]);
    map.regimen = guessColumn(columns, ["regimen", "régimen", "alimentacion", "alimentación", "meal"]);
    map.tipo_habitacion = guessColumn(columns, [
      "tipo_habitacion",
      "tipo habitación",
      "habitacion",
      "habitación",
      "room"
    ]);
    map.tipo_tarifa = guessColumn(columns, ["tipo_tarifa", "tipo tarifa", "tarifa", "rate"]);
    map.cargos_adicionales = guessColumn(columns, [
      "cargos_adicionales",
      "cargos adicionales",
      "extras",
      "tasas",
      "fees"
    ]);
    map.descripcion_cargos = guessColumn(columns, [
      "descripcion_cargos",
      "descripción cargos",
      "detalle cargos",
      "observaciones cargos"
    ]);
    map.veces_usado = guessColumn(columns, ["veces_usado", "veces usado", "uso", "usos"]);
    map.ultimo_uso = guessColumn(columns, ["ultimo_uso", "último uso", "last_used"]);
    map.activo = guessColumn(columns, ["activo", "activa", "estado", "habilitado"]);
  }

  if (catalogType === "carritos") {
    map.telefono = guessColumn(columns, ["telefono", "teléfono", "tel", "phone", "celular"]);
    map.email = guessColumn(columns, ["email", "mail", "correo"]);
    map.nombre_pasajero = guessColumn(columns, ["nombre_pasajero", "pasajero", "cliente", "nombre"]);
    map.numero_carrito = guessColumn(columns, ["numero_carrito", "número carrito", "carrito", "numero", "número"]);
    map.fecha_venta = guessColumn(columns, ["fecha_venta", "fecha venta", "fecha", "created_at"]);
    map.servicio_id = guessColumn(columns, ["servicio_id"]);
    map.servicio = guessColumn(columns, ["servicio", "producto", "tipo_servicio"]);
    map.metodo_contacto = guessColumn(columns, ["metodo_contacto", "método contacto", "origen"]);
    map.forma_pago_id = guessColumn(columns, ["forma_pago_id", "metodo_pago_id"]);
    map.forma_pago = guessColumn(columns, ["forma_pago", "forma pago", "medio_pago", "pago"]);
    map.destino = guessColumn(columns, ["destino", "ciudad", "lugar"]);
    map.fecha_in = guessColumn(columns, ["fecha_in", "fecha in", "desde", "salida"]);
    map.fecha_out = guessColumn(columns, ["fecha_out", "fecha out", "hasta", "regreso"]);
    map.solo_ida = guessColumn(columns, ["solo_ida", "ida_solo", "solo ida"]);
    map.importe = guessColumn(columns, ["importe", "monto", "precio", "total", "venta"]);
    map.moneda = guessColumn(columns, ["moneda", "currency", "divisa"]);
    map.observaciones = guessColumn(columns, ["observaciones", "notas", "notas_adicionales", "comentarios"]);
  }

  if (catalogType === "carritos_files_historicos") {
    map.legacy_id = guessColumn(columns, ["id", "legacy_id", "id viejo"]);
    map.legacy_cliente_id = guessColumn(columns, ["cliente_id", "legacy_cliente_id", "cliente id"]);

    map.numero_carrito = guessColumn(columns, ["numero_carrito", "número carrito", "carrito"]);
    map.numero_file = guessColumn(columns, ["numero_file", "número file", "file"]);

    map.es_almundo = guessColumn(columns, ["es_almundo", "es almundo", "almundo"]);

    map.fecha_venta = guessColumn(columns, ["fecha_venta", "fecha venta", "fecha"]);
    map.fecha_in = guessColumn(columns, ["fecha_in", "fecha in", "desde", "salida"]);
    map.fecha_out = guessColumn(columns, ["fecha_out", "fecha out", "hasta", "regreso"]);
    map.solo_ida = guessColumn(columns, ["ida_solo", "solo_ida", "solo ida"]);

    map.importe = guessColumn(columns, ["importe", "monto", "precio", "venta"]);
    map.importe_bruto = guessColumn(columns, ["importe_bruto", "importe bruto"]);
    map.importe_final = guessColumn(columns, ["importe_final", "importe final"]);
    map.moneda = guessColumn(columns, ["moneda", "currency", "divisa"]);
    map.destino = guessColumn(columns, ["destino", "ciudad", "lugar"]);

    map.servicio_id = guessColumn(columns, ["servicio_id"]);
    map.servicio = guessColumn(columns, ["servicio", "producto", "tipo_servicio"]);
    map.metodo_contacto = guessColumn(columns, ["metodo_contacto", "método contacto", "origen"]);

    map.forma_pago_id = guessColumn(columns, ["forma_pago_id", "metodo_pago_id"]);
    map.forma_pago = guessColumn(columns, ["forma_pago", "forma pago", "medio_pago", "pago"]);

    map.vendedor_id = guessColumn(columns, ["vendedor_id"]);
    map.sucursal_id = guessColumn(columns, ["sucursal_id"]);

    map.promocode = guessColumn(columns, ["promocode", "promo", "codigo promo"]);
    map.importe_promocode = guessColumn(columns, ["importe_promocode", "importe promocode", "descuento"]);

    map.derivado_control = guessColumn(columns, ["derivado_control", "derivado control"]);
    map.utilidad_neta = guessColumn(columns, ["utilidad_neta", "utilidad neta"]);
    map.regalias = guessColumn(columns, ["regalias", "regalías"]);
    map.utilidad_bruta = guessColumn(columns, ["utilidad_bruta", "utilidad bruta"]);
    map.importe_facturar = guessColumn(columns, ["importe_facturar", "importe facturar"]);

    map.facturado = guessColumn(columns, ["facturado"]);
    map.numero_factura = guessColumn(columns, ["numero_factura", "número factura"]);
    map.numero_factura_arca = guessColumn(columns, ["numero_factura_arca", "factura arca"]);
    map.cobrado = guessColumn(columns, ["cobrado"]);
    map.controlado = guessColumn(columns, ["controlado"]);
    map.fecha_cobro = guessColumn(columns, ["fecha_cobro", "fecha cobro"]);
    map.fecha_factura = guessColumn(columns, ["fecha_factura", "fecha factura"]);
    map.tipo_cambio_usado = guessColumn(columns, ["tipo_cambio_usado", "tipo cambio usado", "tc"]);

    map.operador_id = guessColumn(columns, ["operador_id"]);
    map.operador_mayorista = guessColumn(columns, ["operador_mayorista", "operador mayorista", "operador", "mayorista"]);
    map.neto_operador = guessColumn(columns, ["neto_operador", "neto operador", "neto"]);

    map.fecha_vencimiento_operador = guessColumn(columns, [
      "fecha_vencimiento_operador",
      "fecha vencimiento operador",
      "vencimiento operador"
    ]);
    map.saldo_pendiente_operador = guessColumn(columns, [
      "saldo_pendiente_operador",
      "saldo pendiente operador",
      "saldo operador"
    ]);
    map.estado_pago_operador = guessColumn(columns, [
      "estado_pago_operador",
      "estado pago operador",
      "pago operador"
    ]);

    map.impacto_riesgo = guessColumn(columns, ["impacto_riesgo", "impacto riesgo", "riesgo"]);
    map.riesgo_resuelto = guessColumn(columns, ["riesgo_resuelto", "riesgo resuelto"]);
    map.riesgo_resuelto_at = guessColumn(columns, ["riesgo_resuelto_at", "riesgo resuelto at"]);
    map.riesgo_resuelto_por = guessColumn(columns, ["riesgo_resuelto_por", "riesgo resuelto por"]);

    map.cancelado = guessColumn(columns, ["cancelado"]);
    map.fecha_cancelacion = guessColumn(columns, ["fecha_cancelacion", "fecha cancelacion", "fecha cancelación"]);
    map.motivo_cancelacion = guessColumn(columns, ["motivo_cancelacion", "motivo cancelacion", "motivo cancelación"]);

    map.distinta_moneda_liquidacion = guessColumn(columns, [
      "distinta_moneda_liquidacion",
      "distinta moneda liquidacion",
      "distinta moneda liquidación"
    ]);
    map.moneda_liquidacion = guessColumn(columns, ["moneda_liquidacion", "moneda liquidacion", "moneda liquidación"]);
    map.importe_liquidacion = guessColumn(columns, ["importe_liquidacion", "importe liquidacion", "importe liquidación"]);

    map.created_at = guessColumn(columns, ["created_at", "creado"]);
    map.updated_at = guessColumn(columns, ["updated_at", "actualizado"]);
  }

if (catalogType === "live_contactos") {
    map.live_contact_id = guessColumn(columns, ["id", "ID", "live_contact_id", "id contacto", "contact id"]);
    map.apellidos = guessColumn(columns, ["apellidos", "apellido", "surname"]);
    map.nombre = guessColumn(columns, ["nombre", "name"]);
    map.avatar_url = guessColumn(columns, ["avatar", "avatar_url", "foto"]);
    map.email = guessColumn(columns, ["email", "mail", "correo"]);
    map.celular = guessColumn(columns, ["celular", "telefono", "teléfono", "phone", "whatsapp"]);
    map.celular_normalizado = guessColumn(columns, ["celular_normalizado", "telefono_normalizado"]);
    map.tipo_documento = guessColumn(columns, ["tipo documento", "tipo_documento"]);
    map.documento = guessColumn(columns, ["documento", "dni", "passport"]);
    map.ciudad = guessColumn(columns, ["ciudad", "city"]);
    map.genero = guessColumn(columns, ["genero", "género", "gender"]);
    map.dinamicos = guessColumn(columns, ["dinamicos", "dinámicos", "dynamic"]);
    map.direccion = guessColumn(columns, ["direccion", "dirección", "address"]);
    map.fecha_cumpleanos = guessColumn(columns, ["fecha cumpleaños", "fecha_cumpleanos", "cumpleaños", "birthday"]);
   map.live_fecha_creado = guessColumn(columns, [
  "fecha_add",
  "fecha add",
  "fecha creado",
  "fecha_creado",
  "created",
  "created_at"
]);

map.live_fecha_editado = guessColumn(columns, [
  "fecha_edt",
  "fecha edt",
  "fecha editado",
  "fecha_editado",
  "updated",
  "updated_at"
]);
    map.habeas_data = guessColumn(columns, ["habeas data", "habeas_data"]);
    map.pais = guessColumn(columns, ["pais", "país", "country"]);
    map.ubicacion = guessColumn(columns, ["ubicacion", "ubicación", "location"]);
    map.etiquetas = guessColumn(columns, ["etiquetas", "tags"]);
    map.empresa = guessColumn(columns, ["empresa", "company"]);
    map.extra_1 = guessColumn(columns, ["extra 1", "extra_1"]);
    map.extra_2 = guessColumn(columns, ["extra 2", "extra_2"]);
    map.autoasignado = guessColumn(columns, ["autoasignado"]);
    map.bloqueado = guessColumn(columns, ["bloqueado", "blocked"]);
  }

  if (catalogType === "live_conversaciones") {
    map.live_conversation_id = guessColumn(columns, ["id", "ID", "live_conversation_id", "conversation id"]);
    map.live_contact_id = guessColumn(columns, ["id contacto", "ID Contacto", "live_contact_id", "contact id"]);
    map.live_contacto_nombre = guessColumn(columns, ["contacto", "Contacto", "nombre", "cliente"]);
    map.telefono = guessColumn(columns, ["telefono", "teléfono", "celular", "phone"]);
    map.empresa = guessColumn(columns, ["empresa", "Empresa"]);
    map.canal_nombre = guessColumn(columns, ["canal nombre", "Canal Nombre", "canal_nombre"]);
    map.canal_tipo = guessColumn(columns, ["canal tipo", "Canal Tipo", "canal_tipo"]);
    map.etiqueta = guessColumn(columns, ["etiqueta", "Etiqueta"]);
    map.grupo = guessColumn(columns, ["grupo", "Grupo"]);
    map.agente = guessColumn(columns, ["agente", "Agente"]);
    map.pais = guessColumn(columns, ["pais", "país", "Pais", "País"]);
    map.ips = guessColumn(columns, ["ips", "IPs", "IP"]);
    map.browser = guessColumn(columns, ["browser", "Browser", "navegador"]);
    map.live_fecha_creado = guessColumn(columns, ["fecha creado", "Fecha Creado", "fecha_creado"]);
    map.live_fecha_editado = guessColumn(columns, ["fecha editado", "Fecha Editado", "fecha_editado"]);
    map.live_fecha_finalizado = guessColumn(columns, ["fecha finalizado", "Fecha Finalizado", "fecha_finalizado"]);
    map.ultimo_mensaje = guessColumn(columns, ["último mensaje", "ultimo mensaje", "Último mensaje", "ultimo_mensaje"]);
    map.url_conversacion = guessColumn(columns, ["url conversación", "url conversacion", "Url Conversación", "url_conversacion"]);
    map.html_url_original = map.url_conversacion;
  }

  if (catalogType === "live_mensajes") {
    map.live_conversation_id = guessColumn(columns, ["id conversacion", "id conversación", "live_conversation_id", "conversation id"]);
    map.orden = guessColumn(columns, ["orden", "order", "index"]);
    map.fecha_mensaje = guessColumn(columns, ["fecha mensaje", "fecha_mensaje", "fecha", "date"]);
    map.hora_texto = guessColumn(columns, ["hora", "hora_texto", "time"]);
    map.direction = guessColumn(columns, ["direction", "direccion", "dirección", "tipo"]);
    map.sender_name = guessColumn(columns, ["sender_name", "sender", "remitente", "nombre"]);
    map.sender_role = guessColumn(columns, ["sender_role", "rol"]);
    map.content = guessColumn(columns, ["content", "mensaje", "texto", "message"]);
    map.message_type = guessColumn(columns, ["message_type", "tipo_mensaje", "tipo"]);
    map.media_url = guessColumn(columns, ["media_url", "archivo_url", "url"]);
    map.media_filename = guessColumn(columns, ["media_filename", "archivo", "filename"]);
    map.media_mime_type = guessColumn(columns, ["media_mime_type", "mime"]);
    map.raw_html = guessColumn(columns, ["raw_html", "html"]);
  }

  return map;
}

function getTableName(catalogType: ImportCatalogType): string {
  if (catalogType === "clientes") return "clientes";
  if (catalogType === "destinos") return "destinos";
  if (catalogType === "metodos_contacto") return "metodos_contacto";
  if (catalogType === "servicios") return "servicios";
  if (catalogType === "formas_pago") return "formas_pago";
  if (catalogType === "operadores") return "operadores";
  if (catalogType === "proveedores") return "proveedores";
  if (catalogType === "cajas") return "cajas";
  if (catalogType === "hoteles_maestros") return "hoteles_maestros";
  if (catalogType === "carritos") return "carritos";
  if (catalogType === "carritos_files_historicos") return "carritos";
  if (catalogType === "live_contactos") return "comunicaciones_live_contactos";
  if (catalogType === "live_conversaciones") return "comunicaciones_live_conversaciones";
  if (catalogType === "live_mensajes") return "comunicaciones_live_mensajes";

  return "destinos";
}

function getExistingKey(catalogType: ImportCatalogType, item: ExistingCatalogItem): string {
  if (catalogType === "clientes") {
    const phone = normalizePhone(item.telefono);
    const email = normalizeEmail(item.email);

    if (phone) return `phone:${phone}`;
    if (email) return `email:${email}`;

    return `name:${normalizeText(item.nombre_completo)}`;
  }

  if (catalogType === "destinos") {
    return `${normalizeText(item.nombre)}|${normalizeText(item.pais || "Sin especificar")}`;
  }

  if (catalogType === "proveedores") {
    return normalizeText(item.nombre_comercial || item.nombre);
  }

  if (catalogType === "hoteles_maestros") {
    return `${normalizeText(item.nombre)}|${normalizeText(item.ubicacion || "")}`;
  }

  if (catalogType === "carritos") {
    return normalizeText(item.numero_carrito);
  }

  if (catalogType === "carritos_files_historicos") {
    return normalizeText(item.legacy_id);
  }

  if (catalogType === "live_contactos") {
    return normalizeText(item.live_contact_id);
  }

  if (catalogType === "live_conversaciones" || catalogType === "live_mensajes") {
    return normalizeText(item.live_conversation_id);
  }

  return normalizeText(item.nombre);
}

function getMappedValue(row: ImportRawRow, column?: string): string {
  if (!column) return "";
  return cleanText(row[column]);
}

function isHistoricFileRow(mapped: Record<string, ImportMappedValue>): boolean {
  const tipoHistorico = cleanText(mapped.tipo_historico);

  if (tipoHistorico === "file") return true;
  if (tipoHistorico === "carrito") return false;

  const esAlmundoRaw = cleanText(mapped.es_almundo);

  if (esAlmundoRaw) {
    return !parseBoolean(esAlmundoRaw, true);
  }

  return (
    Boolean(cleanText(mapped.numero_file)) ||
    Boolean(cleanText(mapped.operador)) ||
    parseMoney(mapped.neto_operador, 0) > 0
  );
}

function mapRow(
  catalogType: ImportCatalogType,
  row: ImportRawRow,
  columnMap: ImportColumnMap,
  index = 1
): Record<string, ImportMappedValue> {
  if (catalogType === "clientes") {
    const nombreCompleto = titleCase(getMappedValue(row, columnMap.nombre_completo));
    const telefono = normalizePhone(getMappedValue(row, columnMap.telefono));
    const email = normalizeEmail(getMappedValue(row, columnMap.email));
    const observaciones = nullableText(getMappedValue(row, columnMap.observaciones));

    return {
      nombre_completo: nombreCompleto,
      telefono: telefono || null,
      email: email || null,
      observaciones
    };
  }

  if (catalogType === "destinos") {
    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      pais: titleCase(getMappedValue(row, columnMap.pais)) || "Sin especificar",
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "metodos_contacto") {
    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      color: getMappedValue(row, columnMap.color) || "#FF6A00",
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "servicios") {
    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      color: getMappedValue(row, columnMap.color) || "#FF6A00",
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "formas_pago") {
    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      impacta_tesoreria: parseBoolean(getMappedValue(row, columnMap.impacta_tesoreria), true),
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "operadores") {
    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      color: getMappedValue(row, columnMap.color) || "#FF6A00",
      razon_social: nullableText(getMappedValue(row, columnMap.razon_social)),
      cuit: nullableText(getMappedValue(row, columnMap.cuit)),
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "proveedores") {
    const nombreComercial = titleCase(getMappedValue(row, columnMap.nombre_comercial));

    return {
      nombre: nombreComercial,
      nombre_comercial: nombreComercial,
      razon_social: nullableText(getMappedValue(row, columnMap.razon_social)),
      cuit: nullableText(getMappedValue(row, columnMap.cuit)),
      telefono: nullableText(getMappedValue(row, columnMap.telefono)),
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "cajas") {
    const activa = parseBoolean(getMappedValue(row, columnMap.activa), true);

    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      tipo: normalizeCajaTipo(getMappedValue(row, columnMap.tipo)),
      moneda: normalizeMoneda(getMappedValue(row, columnMap.moneda)),
      sucursal_id: nullableText(getMappedValue(row, columnMap.sucursal_id)),
      descripcion: nullableText(getMappedValue(row, columnMap.descripcion)),
      orden: parseNumber(getMappedValue(row, columnMap.orden), 100),
      activa,
      activo: parseBoolean(getMappedValue(row, columnMap.activo), activa)
    };
  }

  if (catalogType === "hoteles_maestros") {
    return {
      nombre: titleCase(getMappedValue(row, columnMap.nombre)),
      ubicacion: nullableText(getMappedValue(row, columnMap.ubicacion)),
      categoria: parseHotelCategoria(getMappedValue(row, columnMap.categoria)),
      descripcion: nullableText(getMappedValue(row, columnMap.descripcion)),
      imagenes: parseJsonArray(getMappedValue(row, columnMap.imagenes)),
      regimen: nullableText(getMappedValue(row, columnMap.regimen)),
      tipo_habitacion: nullableText(getMappedValue(row, columnMap.tipo_habitacion)),
      tipo_tarifa: nullableText(getMappedValue(row, columnMap.tipo_tarifa)),
      cargos_adicionales: parseBoolean(getMappedValue(row, columnMap.cargos_adicionales), false),
      descripcion_cargos: nullableText(getMappedValue(row, columnMap.descripcion_cargos)),
      veces_usado: parseNumber(getMappedValue(row, columnMap.veces_usado), 0),
      ultimo_uso: parseDateTime(getMappedValue(row, columnMap.ultimo_uso)),
      activo: parseBoolean(getMappedValue(row, columnMap.activo), true)
    };
  }

  if (catalogType === "carritos") {
    const telefono = normalizePhone(getMappedValue(row, columnMap.telefono));
    const email = normalizeEmail(getMappedValue(row, columnMap.email));
    const fechaVenta = parseDate(getMappedValue(row, columnMap.fecha_venta) || getMappedValue(row, columnMap.fecha_in));
    const numeroCarrito = cleanText(getMappedValue(row, columnMap.numero_carrito)) || generateHistoricCartNumber(index, fechaVenta, telefono);
    const importe = parseMoney(getMappedValue(row, columnMap.importe), 0);
    const soloIda = parseBoolean(getMappedValue(row, columnMap.solo_ida), false);
    const fechaIn = parseDate(getMappedValue(row, columnMap.fecha_in));
    const fechaOut = soloIda ? null : parseDate(getMappedValue(row, columnMap.fecha_out));

    return {
      cliente_id: null,
      telefono,
      email: email || null,
      nombre_pasajero: titleCase(getMappedValue(row, columnMap.nombre_pasajero)),
      numero_carrito: numeroCarrito,
      fecha_venta: fechaVenta,
      servicio_id: nullableUuid(getMappedValue(row, columnMap.servicio_id)),
      servicio: nullableText(getMappedValue(row, columnMap.servicio)),
      metodo_contacto: nullableText(getMappedValue(row, columnMap.metodo_contacto)),
      forma_pago_id: nullableUuid(getMappedValue(row, columnMap.forma_pago_id)),
      forma_pago: nullableText(getMappedValue(row, columnMap.forma_pago)),
      destino: nullableText(getMappedValue(row, columnMap.destino)),
      fecha_in: fechaIn,
      fecha_out: fechaOut,
      solo_ida: soloIda,
      importe,
      importe_bruto: importe,
      importe_final: importe,
      moneda: normalizeMoneda(getMappedValue(row, columnMap.moneda)),
      estado: "NUEVO",
      observaciones: nullableText(getMappedValue(row, columnMap.observaciones)),
      activo: true,
      visible_en_carritos: true
    };
  }

if (catalogType === "carritos_files_historicos") {
  const legacyId = cleanText(getMappedValue(row, columnMap.legacy_id));
  const legacyClienteId = cleanText(getMappedValue(row, columnMap.legacy_cliente_id));
  const fechaVenta = parseDate(getMappedValue(row, columnMap.fecha_venta));
  const fechaIn = parseDate(getMappedValue(row, columnMap.fecha_in));
  const soloIda = parseBoolean(getMappedValue(row, columnMap.solo_ida), false);
  const fechaOut = soloIda ? null : parseDate(getMappedValue(row, columnMap.fecha_out));

  const importe = parseMoney(getMappedValue(row, columnMap.importe), 0);
  const importeBruto = parseMoney(getMappedValue(row, columnMap.importe_bruto), importe);
  const importeFinal = parseMoney(getMappedValue(row, columnMap.importe_final), importe || importeBruto);

  const impactoRiesgo = parseMoney(getMappedValue(row, columnMap.impacto_riesgo), 0);
  const riesgo = impactoRiesgo !== 0 || parseBoolean(getMappedValue(row, columnMap.impacto_riesgo), false);

  const esAlmundoRaw = cleanText(getMappedValue(row, columnMap.es_almundo));
  const esAlmundo = esAlmundoRaw ? parseBoolean(esAlmundoRaw, true) : true;

  const numeroFileRaw = cleanText(getMappedValue(row, columnMap.numero_file));
  const operadorRaw = nullableText(getMappedValue(row, columnMap.operador_mayorista));
  const netoOperador = parseMoney(getMappedValue(row, columnMap.neto_operador), 0);

  const isFile =
    !esAlmundo ||
    Boolean(numeroFileRaw) ||
    Boolean(operadorRaw) ||
    netoOperador > 0;

  const numeroCarrito =
    cleanText(getMappedValue(row, columnMap.numero_carrito)) ||
    generateHistoricCartNumber(index, fechaVenta, legacyId);

  const numeroFile = isFile
    ? numeroFileRaw || generateHistoricFileNumber(index, fechaVenta, legacyId)
    : null;

  const promocodeRaw = cleanText(getMappedValue(row, columnMap.promocode));
  const importePromocode = parseMoney(getMappedValue(row, columnMap.importe_promocode), 0);
  const cancelado = parseBoolean(getMappedValue(row, columnMap.cancelado), false);

  return {
    tipo_historico: isFile ? "file" : "carrito",

    legacy_id: legacyId,
    legacy_cliente_id: legacyClienteId,
    cliente_id: null,

    numero_carrito: numeroCarrito,
    numero_file: numeroFile,
    es_almundo: esAlmundoRaw,

    fecha_venta: fechaVenta,
    fecha_in: fechaIn,
    fecha_out: fechaOut,
    solo_ida: soloIda,

    importe,
    importe_bruto: importeBruto,
    importe_final: importeFinal,
    moneda: normalizeMoneda(getMappedValue(row, columnMap.moneda)),
    destino: nullableText(getMappedValue(row, columnMap.destino)),

    servicio_id: nullableUuid(getMappedValue(row, columnMap.servicio_id)),
    servicio: nullableText(getMappedValue(row, columnMap.servicio)),
    metodo_contacto: nullableText(getMappedValue(row, columnMap.metodo_contacto)),

    forma_pago_id: nullableUuid(getMappedValue(row, columnMap.forma_pago_id)),
    forma_pago: nullableText(getMappedValue(row, columnMap.forma_pago)),

vendedor_id: null,
sucursal_id: null,

    promocode_aplicado: Boolean(promocodeRaw) || importePromocode > 0,
    promocode_importe: importePromocode,

    derivado_control: parseBoolean(getMappedValue(row, columnMap.derivado_control), false),
    utilidad_neta: parseMoney(getMappedValue(row, columnMap.utilidad_neta), 0),
    regalias: parseMoney(getMappedValue(row, columnMap.regalias), 0),
    utilidad_bruta: parseMoney(getMappedValue(row, columnMap.utilidad_bruta), 0),
    importe_facturar: parseMoney(getMappedValue(row, columnMap.importe_facturar), 0),

    facturado: parseBoolean(getMappedValue(row, columnMap.facturado), false),
    numero_factura: nullableText(getMappedValue(row, columnMap.numero_factura)),
    numero_factura_arca: nullableText(getMappedValue(row, columnMap.numero_factura_arca)),
    cobrado: parseBoolean(getMappedValue(row, columnMap.cobrado), false),
    controlado: parseBoolean(getMappedValue(row, columnMap.controlado), false),
    fecha_cobro: parseDate(getMappedValue(row, columnMap.fecha_cobro)),
    fecha_factura: parseDate(getMappedValue(row, columnMap.fecha_factura)),
    tipo_cambio_usado: parseMoney(getMappedValue(row, columnMap.tipo_cambio_usado), 0),

    operador_id: null,
    operador: operadorRaw,
    neto_operador: netoOperador,

    fecha_vencimiento_operador: parseDate(getMappedValue(row, columnMap.fecha_vencimiento_operador)),
    saldo_pendiente_operador: parseMoney(getMappedValue(row, columnMap.saldo_pendiente_operador), 0),
    estado_pago_operador: nullableText(getMappedValue(row, columnMap.estado_pago_operador)),

    riesgo,
    riesgo_motivo: riesgo ? "Importado desde histórico con impacto de riesgo." : null,
    importe_riesgo: impactoRiesgo,
    riesgo_resuelto: parseBoolean(getMappedValue(row, columnMap.riesgo_resuelto), false),
    riesgo_resuelto_at: parseDateTime(getMappedValue(row, columnMap.riesgo_resuelto_at)),
    riesgo_resuelto_by: null,

    cancelado,
    fecha_cancelacion: parseDate(getMappedValue(row, columnMap.fecha_cancelacion)),
    motivo_cancelacion: nullableText(getMappedValue(row, columnMap.motivo_cancelacion)),

    distinta_moneda_liquidacion: parseBoolean(getMappedValue(row, columnMap.distinta_moneda_liquidacion), false),
    moneda_liquidacion: nullableText(getMappedValue(row, columnMap.moneda_liquidacion)),
    importe_liquidacion: parseMoney(getMappedValue(row, columnMap.importe_liquidacion), 0),

    estado: cancelado ? "CANCELADO" : "NUEVO",

    observaciones: nullableText(
      [
        promocodeRaw ? `Promocode histórico: ${promocodeRaw}` : "",
        cleanText(getMappedValue(row, columnMap.motivo_cancelacion))
          ? `Motivo cancelación: ${cleanText(getMappedValue(row, columnMap.motivo_cancelacion))}`
          : ""
      ]
        .filter(Boolean)
        .join("\n")
    ),

    activo: !cancelado,
   created_at:
  parseDateTime(getMappedValue(row, columnMap.created_at)) ||
  parseDateTime(getMappedValue(row, columnMap.fecha_venta)) ||
  new Date().toISOString(),

updated_at:
  parseDateTime(getMappedValue(row, columnMap.updated_at)) ||
  parseDateTime(getMappedValue(row, columnMap.created_at)) ||
  parseDateTime(getMappedValue(row, columnMap.fecha_venta)) ||
  new Date().toISOString()
  };
}

  if (catalogType === "live_contactos") {
    const nombre = titleCase(getMappedValue(row, columnMap.nombre));
    const apellidos = titleCase(getMappedValue(row, columnMap.apellidos));
    const nombreCompleto = cleanText(getMappedValue(row, columnMap.nombre_completo)) || cleanText(`${nombre} ${apellidos}`);
    const celular = cleanText(getMappedValue(row, columnMap.celular));
    const celularNormalizado = normalizePhone(getMappedValue(row, columnMap.celular_normalizado) || celular);

    return {
      live_contact_id: cleanText(getMappedValue(row, columnMap.live_contact_id)),
      nombre: nombre || null,
      apellidos: apellidos || null,
      nombre_completo: nombreCompleto || null,
      avatar_url: nullableText(getMappedValue(row, columnMap.avatar_url)),
      email: normalizeEmail(getMappedValue(row, columnMap.email)) || null,
      celular: celular || null,
      celular_normalizado: celularNormalizado || null,
      tipo_documento: nullableText(getMappedValue(row, columnMap.tipo_documento)),
      documento: nullableText(getMappedValue(row, columnMap.documento)),
      ciudad: nullableText(getMappedValue(row, columnMap.ciudad)),
      genero: nullableText(getMappedValue(row, columnMap.genero)),
      direccion: nullableText(getMappedValue(row, columnMap.direccion)),
      fecha_cumpleanos: parseDate(getMappedValue(row, columnMap.fecha_cumpleanos)),
      pais: nullableText(getMappedValue(row, columnMap.pais)),
      ubicacion: nullableText(getMappedValue(row, columnMap.ubicacion)),
      habeas_data: nullableText(getMappedValue(row, columnMap.habeas_data)),
      etiquetas: nullableText(getMappedValue(row, columnMap.etiquetas)),
      empresa: nullableText(getMappedValue(row, columnMap.empresa)),
      extra_1: nullableText(getMappedValue(row, columnMap.extra_1)),
      extra_2: nullableText(getMappedValue(row, columnMap.extra_2)),
      dinamicos: parseJsonObject(getMappedValue(row, columnMap.dinamicos)),
      autoasignado: parseBoolean(getMappedValue(row, columnMap.autoasignado), false),
      bloqueado: parseBoolean(getMappedValue(row, columnMap.bloqueado), false),
      live_fecha_creado: parseDateTime(getMappedValue(row, columnMap.live_fecha_creado)),
      live_fecha_editado: parseDateTime(getMappedValue(row, columnMap.live_fecha_editado)),
      estado_vinculacion: "SIN_VINCULAR",
      metadata: {
        origen: "liveconnect_contactos_csv"
      }
    };
  }

  if (catalogType === "live_conversaciones") {
    const telefono = cleanText(getMappedValue(row, columnMap.telefono));

    return {
      live_conversation_id: cleanText(getMappedValue(row, columnMap.live_conversation_id)),
      etiqueta: nullableText(getMappedValue(row, columnMap.etiqueta)),
      canal_nombre: nullableText(getMappedValue(row, columnMap.canal_nombre)),
      canal_tipo: nullableText(getMappedValue(row, columnMap.canal_tipo)),
      live_contact_id: nullableText(getMappedValue(row, columnMap.live_contact_id)),
      live_contacto_nombre: nullableText(getMappedValue(row, columnMap.live_contacto_nombre)),
      telefono,
      telefono_normalizado: normalizePhone(getMappedValue(row, columnMap.telefono_normalizado) || telefono) || null,
      empresa: nullableText(getMappedValue(row, columnMap.empresa)),
      live_fecha_creado: parseDateTime(getMappedValue(row, columnMap.live_fecha_creado)),
      live_fecha_editado: parseDateTime(getMappedValue(row, columnMap.live_fecha_editado)),
      live_fecha_finalizado: parseDateTime(getMappedValue(row, columnMap.live_fecha_finalizado)),
      grupo: nullableText(getMappedValue(row, columnMap.grupo)),
      agente: nullableText(getMappedValue(row, columnMap.agente)),
      pais: nullableText(getMappedValue(row, columnMap.pais)),
      ips: nullableText(getMappedValue(row, columnMap.ips)),
      browser: nullableText(getMappedValue(row, columnMap.browser)),
      ultimo_mensaje: nullableText(getMappedValue(row, columnMap.ultimo_mensaje)),
      url_conversacion: nullableText(getMappedValue(row, columnMap.url_conversacion)),
      html_importado: false,
      html_url_original: nullableText(getMappedValue(row, columnMap.html_url_original) || getMappedValue(row, columnMap.url_conversacion)),
      html_raw: nullableText(getMappedValue(row, columnMap.html_raw)),
      mensajes_parseados: 0,
      estado_historial: "HISTORICO",
      metadata: {
        origen: "liveconnect_conversaciones_csv"
      }
    };
  }

  if (catalogType === "live_mensajes") {
    return {
      live_conversation_id: cleanText(getMappedValue(row, columnMap.live_conversation_id)),
      orden: parseNumber(getMappedValue(row, columnMap.orden), index),
      fecha_mensaje: parseDateTime(getMappedValue(row, columnMap.fecha_mensaje)),
      hora_texto: nullableText(getMappedValue(row, columnMap.hora_texto)),
      direction: cleanText(getMappedValue(row, columnMap.direction)) || "inbound",
      sender_name: nullableText(getMappedValue(row, columnMap.sender_name)),
      sender_role: nullableText(getMappedValue(row, columnMap.sender_role)),
      content: nullableText(getMappedValue(row, columnMap.content)),
      message_type: cleanText(getMappedValue(row, columnMap.message_type)) || "text",
      media_url: nullableText(getMappedValue(row, columnMap.media_url)),
      media_filename: nullableText(getMappedValue(row, columnMap.media_filename)),
      media_mime_type: nullableText(getMappedValue(row, columnMap.media_mime_type)),
      raw_html: nullableText(getMappedValue(row, columnMap.raw_html)),
      metadata: {
        origen: "liveconnect_mensajes_csv"
      }
    };
  }

  return {};
}

function getMappedKey(catalogType: ImportCatalogType, mapped: Record<string, ImportMappedValue>): string {
  if (catalogType === "clientes") {
    const phone = normalizePhone(mapped.telefono);
    const email = normalizeEmail(mapped.email);

    if (phone) return `phone:${phone}`;
    if (email) return `email:${email}`;

    return `name:${normalizeText(mapped.nombre_completo)}`;
  }

  if (catalogType === "destinos") {
    return `${normalizeText(mapped.nombre)}|${normalizeText(mapped.pais || "Sin especificar")}`;
  }

  if (catalogType === "proveedores") {
    return normalizeText(mapped.nombre_comercial || mapped.nombre);
  }

  if (catalogType === "hoteles_maestros") {
    return `${normalizeText(mapped.nombre)}|${normalizeText(mapped.ubicacion || "")}`;
  }

  if (catalogType === "carritos") {
    return normalizeText(mapped.numero_carrito);
  }

  if (catalogType === "carritos_files_historicos") {
    const tipo = cleanText(mapped.tipo_historico) || (isHistoricFileRow(mapped) ? "file" : "carrito");
    return `${tipo}:${normalizeText(mapped.legacy_id)}`;
  }

  if (catalogType === "live_contactos") {
    return normalizeText(mapped.live_contact_id);
  }

  if (catalogType === "live_conversaciones") {
    return normalizeText(mapped.live_conversation_id);
  }

  if (catalogType === "live_mensajes") {
    return `${normalizeText(mapped.live_conversation_id)}|${normalizeText(mapped.orden)}|${normalizeText(mapped.fecha_mensaje)}|${normalizeText(mapped.content)}`;
  }

  return normalizeText(mapped.nombre);
}

function validateMappedRow(catalogType: ImportCatalogType, mapped: Record<string, ImportMappedValue>): string | null {
  const requiredFields = REQUIRED_FIELDS[catalogType];

  for (const field of requiredFields) {
    const value = mapped[field];

    if (!cleanText(value)) {
      return `Falta ${getImportFieldLabel(field)}.`;
    }
  }

  if (catalogType === "clientes") {
    const nombreCompleto = cleanText(mapped.nombre_completo);
    const telefono = normalizePhone(mapped.telefono);
    const email = normalizeEmail(mapped.email);

    if (!nombreCompleto) {
      return "Falta nombre del cliente.";
    }

    if (!telefono && !email) {
      return "Falta teléfono o email para identificar al cliente.";
    }
  }

  if (catalogType === "destinos" && !cleanText(mapped.pais)) {
    mapped.pais = "Sin especificar";
  }

  if (catalogType === "proveedores" && !cleanText(mapped.nombre)) {
    mapped.nombre = cleanText(mapped.nombre_comercial);
  }

  if (catalogType === "cajas") {
    if (!cleanText(mapped.tipo)) mapped.tipo = "CAJA";
    if (!cleanText(mapped.moneda)) mapped.moneda = "ARS";
    if (!Number.isFinite(Number(mapped.orden))) mapped.orden = 100;
  }

  if (catalogType === "hoteles_maestros") {
    if (!cleanText(mapped.nombre)) return "Falta nombre del hotel.";

    if (!Array.isArray(mapped.imagenes)) {
      mapped.imagenes = [];
    }

    if (!Number.isFinite(Number(mapped.veces_usado))) {
      mapped.veces_usado = 0;
    }
  }

  if (catalogType === "carritos") {
    if (!cleanText(mapped.fecha_venta)) return "Falta Fecha de venta o no se pudo interpretar.";
    if (!cleanText(mapped.numero_carrito)) return "No se pudo generar número de carrito histórico.";
  }

  if (catalogType === "carritos_files_historicos") {
    const isFile = isHistoricFileRow(mapped);
    mapped.tipo_historico = isFile ? "file" : "carrito";

    if (!isUuid(mapped.legacy_id)) {
      return "Falta ID histórico o no es UUID válido.";
    }

    if (!isUuid(mapped.legacy_cliente_id)) {
      return "Falta cliente_id histórico o no es UUID válido.";
    }

    if (!cleanText(mapped.fecha_venta)) {
      return "Falta Fecha de venta o no se pudo interpretar.";
    }

    if (isFile && !cleanText(mapped.numero_file)) {
      mapped.numero_file = generateHistoricFileNumber(0, cleanText(mapped.fecha_venta), cleanText(mapped.legacy_id));
    }

    if (!isFile && !cleanText(mapped.numero_carrito)) {
      return "Falta número de carrito o no se pudo generar.";
    }
  }

  if (catalogType === "live_contactos") {
    if (!cleanText(mapped.live_contact_id)) return "Falta ID contacto Live.";
  }

  if (catalogType === "live_conversaciones") {
    if (!cleanText(mapped.live_conversation_id)) return "Falta ID conversación Live.";
  }

  if (catalogType === "live_mensajes") {
    if (!cleanText(mapped.live_conversation_id)) return "Falta ID conversación Live.";
    if (!cleanText(mapped.direction)) mapped.direction = "inbound";
    if (!cleanText(mapped.message_type)) mapped.message_type = "text";
    if (!Number.isFinite(Number(mapped.orden))) return "Falta Orden o no se pudo interpretar.";
  }

  return null;
}

function buildClienteLookup(clientes: ClienteLookupItem[]) {
  const byLegacyId = new Map<string, ClienteLookupItem>();
  const byPhone = new Map<string, ClienteLookupItem>();
  const byEmail = new Map<string, ClienteLookupItem>();

  clientes.forEach((cliente) => {
    const legacyId = cleanText(cliente.legacy_cliente_id);
    const phone = normalizePhone(cliente.telefono);
    const email = normalizeEmail(cliente.email);

    if (legacyId && !byLegacyId.has(legacyId)) byLegacyId.set(legacyId, cliente);
    if (phone && !byPhone.has(phone)) byPhone.set(phone, cliente);
    if (email && !byEmail.has(email)) byEmail.set(email, cliente);
  });

  return {
    byLegacyId,
    byPhone,
    byEmail
  };
}

function enrichHistoricCartRow(
  mapped: Record<string, ImportMappedValue>,
  clientes: ClienteLookupItem[],
  validServicioIds: Set<string>,
  validFormaPagoIds: Set<string>
): string | null {
  const lookup = buildClienteLookup(clientes);
  const phone = normalizePhone(mapped.telefono);
  const email = normalizeEmail(mapped.email);

  const cliente = (phone ? lookup.byPhone.get(phone) : undefined) || (email ? lookup.byEmail.get(email) : undefined);

  if (!cliente) {
    return "No encontré cliente ya importado por teléfono/email.";
  }

  mapped.cliente_id = cliente.id;

  const servicioId = cleanText(mapped.servicio_id);
  if (servicioId && (!isUuid(servicioId) || !validServicioIds.has(servicioId))) {
    mapped.servicio_id = null;
  }

  const formaPagoId = cleanText(mapped.forma_pago_id);
  if (formaPagoId && (!isUuid(formaPagoId) || !validFormaPagoIds.has(formaPagoId))) {
    mapped.forma_pago_id = null;
  }

  return null;
}

function enrichHistoricCarritoFileRow(
  mapped: Record<string, ImportMappedValue>,
  clientes: ClienteLookupItem[],
  validServicioIds: Set<string>,
  validFormaPagoIds: Set<string>
): string | null {
  const lookup = buildClienteLookup(clientes);
  const legacyClienteId = cleanText(mapped.legacy_cliente_id);
  const cliente = legacyClienteId ? lookup.byLegacyId.get(legacyClienteId) : undefined;

  if (!cliente) {
    return "No encontré cliente por legacy_cliente_id. Primero hay que completar clientes.legacy_cliente_id.";
  }

  mapped.cliente_id = cliente.id;

  const servicioId = cleanText(mapped.servicio_id);
  if (servicioId && (!isUuid(servicioId) || !validServicioIds.has(servicioId))) {
    mapped.servicio_id = null;
  }

  const formaPagoId = cleanText(mapped.forma_pago_id);
  if (formaPagoId && (!isUuid(formaPagoId) || !validFormaPagoIds.has(formaPagoId))) {
    mapped.forma_pago_id = null;
  }

  return null;
}

function buildLiveContactFromConversationRow(mapped: Record<string, ImportMappedValue>): Record<string, ImportMappedValue> {
  const nombreCompleto = cleanText(mapped.live_contacto_nombre);
  const parts = nombreCompleto.split(/\s+/).filter(Boolean);
  const nombre = parts[0] || null;
  const apellidos = parts.length > 1 ? parts.slice(1).join(" ") : null;

  return {
    live_contact_id: cleanText(mapped.live_contact_id),
    nombre,
    apellidos,
    nombre_completo: nombreCompleto || null,
    email: null,
    celular: cleanText(mapped.telefono) || null,
    celular_normalizado: normalizePhone(mapped.telefono) || null,
    empresa: cleanText(mapped.empresa) || null,
    etiquetas: cleanText(mapped.etiqueta) || null,
    dinamicos: {},
    autoasignado: false,
    bloqueado: false,
    live_fecha_creado: cleanText(mapped.live_fecha_creado) || null,
    live_fecha_editado: cleanText(mapped.live_fecha_editado) || null,
    estado_vinculacion: "SIN_VINCULAR",
    metadata: {
      origen: "liveconnect_conversaciones_csv"
    }
  };
}

function toHistoricCarritoInsertRow(mapped: Record<string, ImportMappedValue>): Record<string, ImportMappedValue> {
  return {
    legacy_id: mapped.legacy_id,
    legacy_cliente_id: mapped.legacy_cliente_id,
    cliente_id: mapped.cliente_id,
    contacto_id: null,

    numero_carrito: mapped.numero_carrito,
    fecha_venta: mapped.fecha_venta,

    servicio_id: mapped.servicio_id,
    servicio: mapped.servicio,
    metodo_contacto: mapped.metodo_contacto,

    forma_pago_id: mapped.forma_pago_id,
    forma_pago: mapped.forma_pago,

    destino: mapped.destino,
    fecha_in: mapped.fecha_in,
    fecha_out: mapped.fecha_out,
    solo_ida: mapped.solo_ida,

    importe: mapped.importe,
    importe_bruto: mapped.importe_bruto,
    promocode_aplicado: mapped.promocode_aplicado,
    promocode_importe: mapped.promocode_importe,
    importe_final: mapped.importe_final,

    pago_parcial: false,
    total_pagado: mapped.cobrado ? mapped.importe_final : 0,
    saldo_cta_cte: 0,

    moneda: mapped.moneda,

    vendedor: null,
    vendedor_id: mapped.vendedor_id,
    sucursal_id: mapped.sucursal_id,

    estado: mapped.estado,
    observaciones: mapped.observaciones,

    activo: mapped.activo,
    visible_en_carritos: true,
    fecha_visible_carritos: mapped.fecha_venta,

    riesgo: mapped.riesgo,
    riesgo_motivo: mapped.riesgo_motivo,
    importe_riesgo: mapped.importe_riesgo,
    riesgo_resuelto: mapped.riesgo_resuelto,
    riesgo_resuelto_at: mapped.riesgo_resuelto_at,
    riesgo_resuelto_by: mapped.riesgo_resuelto_by,
    riesgo_observaciones: null,

    confirmado_vendedor: false,
    confirmado_at: null,
    enviado_control_at: null,
    fecha_ingreso_gastos: null,

    derivado_control: mapped.derivado_control,
    utilidad_neta: mapped.utilidad_neta,
    regalias: mapped.regalias,
    utilidad_bruta: mapped.utilidad_bruta,
    importe_facturar: mapped.importe_facturar,

    facturado: mapped.facturado,
    numero_factura: mapped.numero_factura,
    numero_factura_arca: mapped.numero_factura_arca,
    cobrado: mapped.cobrado,
    controlado: mapped.controlado,
    fecha_cobro: mapped.fecha_cobro,
    fecha_factura: mapped.fecha_factura,
    tipo_cambio_usado: mapped.tipo_cambio_usado,

    cancelado: mapped.cancelado,
    fecha_cancelacion: mapped.fecha_cancelacion,
    motivo_cancelacion: mapped.motivo_cancelacion,

    distinta_moneda_liquidacion: mapped.distinta_moneda_liquidacion,
    moneda_liquidacion: mapped.moneda_liquidacion,
    importe_liquidacion: mapped.importe_liquidacion,

   created_at: mapped.created_at || new Date().toISOString(),
updated_at: mapped.updated_at || mapped.created_at || new Date().toISOString()
  };
}

function toHistoricFileInsertRow(mapped: Record<string, ImportMappedValue>): Record<string, ImportMappedValue> {
  return {
    legacy_id: mapped.legacy_id,
    legacy_cliente_id: mapped.legacy_cliente_id,
    cliente_id: mapped.cliente_id,

    numero_file: mapped.numero_file,

    operador_id: mapped.operador_id,
    operador: mapped.operador,

    fecha_venta: mapped.fecha_venta,

    servicio_id: mapped.servicio_id,
    servicio: mapped.servicio,
    metodo_contacto: mapped.metodo_contacto,

    destino: mapped.destino,
    fecha_in: mapped.fecha_in,
    fecha_out: mapped.fecha_out,
    solo_ida: mapped.solo_ida,

    importe_bruto: mapped.importe_bruto,
    importe_final: mapped.importe_final,
    moneda: mapped.moneda,

    neto_operador: mapped.neto_operador,

    pago_parcial: false,
    total_pagado: mapped.cobrado ? mapped.importe_final : 0,
    saldo_cta_cte: 0,

    visible_en_files: true,
    fecha_visible_files: mapped.fecha_venta,

    riesgo: mapped.riesgo,
    riesgo_motivo: mapped.riesgo_motivo,
    importe_riesgo: mapped.importe_riesgo,

    confirmado_vendedor: false,
    confirmado_at: null,

    estado: mapped.estado,
    observaciones: mapped.observaciones,

    vendedor: null,
    vendedor_id: mapped.vendedor_id,
    sucursal_id: mapped.sucursal_id,

    activo: mapped.activo,

    derivado_control: mapped.derivado_control,
    utilidad_neta: mapped.utilidad_neta,
    utilidad_bruta: mapped.utilidad_bruta,
    regalias: mapped.regalias,
    importe_facturar: mapped.importe_facturar,

    facturado: mapped.facturado,
    numero_factura: mapped.numero_factura,
    numero_factura_arca: mapped.numero_factura_arca,
    cobrado: mapped.cobrado,
    controlado: mapped.controlado,
    fecha_cobro: mapped.fecha_cobro,
    fecha_factura: mapped.fecha_factura,
    tipo_cambio_usado: mapped.tipo_cambio_usado,

    fecha_vencimiento_operador: mapped.fecha_vencimiento_operador,
    saldo_pendiente_operador: mapped.saldo_pendiente_operador,
    estado_pago_operador: mapped.estado_pago_operador,

    cancelado: mapped.cancelado,
    fecha_cancelacion: mapped.fecha_cancelacion,
    motivo_cancelacion: mapped.motivo_cancelacion,

    distinta_moneda_liquidacion: mapped.distinta_moneda_liquidacion,
    moneda_liquidacion: mapped.moneda_liquidacion,
    importe_liquidacion: mapped.importe_liquidacion,

   created_at: mapped.created_at || new Date().toISOString(),
updated_at: mapped.updated_at || mapped.created_at || new Date().toISOString()
  };
}

function toInsertRow(
  catalogType: ImportCatalogType,
  mapped: Record<string, ImportMappedValue>
): Record<string, ImportMappedValue> {
  if (catalogType === "clientes") {
    return {
      nombre_completo: mapped.nombre_completo,
      telefono: mapped.telefono,
      email: mapped.email,
      observaciones: mapped.observaciones
    };
  }

  if (catalogType === "live_contactos") {
    return {
      live_contact_id: mapped.live_contact_id,
      nombre: mapped.nombre,
      apellidos: mapped.apellidos,
      nombre_completo: mapped.nombre_completo,
      avatar_url: mapped.avatar_url,
      email: mapped.email,
      celular: mapped.celular,
      celular_normalizado: mapped.celular_normalizado,
      tipo_documento: mapped.tipo_documento,
      documento: mapped.documento,
      ciudad: mapped.ciudad,
      genero: mapped.genero,
      direccion: mapped.direccion,
      fecha_cumpleanos: mapped.fecha_cumpleanos,
      pais: mapped.pais,
      ubicacion: mapped.ubicacion,
      habeas_data: mapped.habeas_data,
      etiquetas: mapped.etiquetas,
      empresa: mapped.empresa,
      extra_1: mapped.extra_1,
      extra_2: mapped.extra_2,
      dinamicos: mapped.dinamicos || {},
      autoasignado: mapped.autoasignado,
      bloqueado: mapped.bloqueado,
      live_fecha_creado: mapped.live_fecha_creado,
      live_fecha_editado: mapped.live_fecha_editado,
      estado_vinculacion: "SIN_VINCULAR",
      metadata: mapped.metadata || { origen: "liveconnect_contactos_csv" }
    };
  }

  if (catalogType === "live_conversaciones") {
    return {
      live_conversation_id: mapped.live_conversation_id,
      etiqueta: mapped.etiqueta,
      canal_nombre: mapped.canal_nombre,
      canal_tipo: mapped.canal_tipo,
      live_contact_id: mapped.live_contact_id,
      live_contacto_nombre: mapped.live_contacto_nombre,
      telefono: mapped.telefono,
      telefono_normalizado: mapped.telefono_normalizado,
      empresa: mapped.empresa,
      live_fecha_creado: mapped.live_fecha_creado,
      live_fecha_editado: mapped.live_fecha_editado,
      live_fecha_finalizado: mapped.live_fecha_finalizado,
      grupo: mapped.grupo,
      agente: mapped.agente,
      pais: mapped.pais,
      ips: mapped.ips,
      browser: mapped.browser,
      ultimo_mensaje: mapped.ultimo_mensaje,
      url_conversacion: mapped.url_conversacion,
      html_importado: false,
      html_url_original: mapped.html_url_original,
      html_raw: mapped.html_raw,
      mensajes_parseados: 0,
      estado_historial: "HISTORICO",
      metadata: mapped.metadata || { origen: "liveconnect_conversaciones_csv" }
    };
  }

  if (catalogType === "live_mensajes") {
    return {
      live_conversation_id: mapped.live_conversation_id,
      orden: mapped.orden,
      fecha_mensaje: mapped.fecha_mensaje,
      hora_texto: mapped.hora_texto,
      direction: mapped.direction,
      sender_name: mapped.sender_name,
      sender_role: mapped.sender_role,
      content: mapped.content,
      message_type: mapped.message_type,
      media_url: mapped.media_url,
      media_filename: mapped.media_filename,
      media_mime_type: mapped.media_mime_type,
      raw_html: mapped.raw_html,
      metadata: mapped.metadata || { origen: "liveconnect_mensajes_csv" }
    };
  }

  if (catalogType === "hoteles_maestros") {
    return {
      nombre: mapped.nombre,
      ubicacion: mapped.ubicacion,
      categoria: mapped.categoria,
      descripcion: mapped.descripcion,
      imagenes: mapped.imagenes || [],
      regimen: mapped.regimen,
      tipo_habitacion: mapped.tipo_habitacion,
      tipo_tarifa: mapped.tipo_tarifa,
      cargos_adicionales: mapped.cargos_adicionales,
      descripcion_cargos: mapped.descripcion_cargos,
      veces_usado: mapped.veces_usado || 0,
      ultimo_uso: mapped.ultimo_uso,
      activo: mapped.activo
    };
  }

  if (catalogType !== "carritos") {
    return mapped;
  }

  return {
    cliente_id: mapped.cliente_id,
    contacto_id: null,
    numero_carrito: mapped.numero_carrito,
    fecha_venta: mapped.fecha_venta,
    servicio_id: mapped.servicio_id,
    servicio: mapped.servicio,
    metodo_contacto: mapped.metodo_contacto,
    forma_pago_id: mapped.forma_pago_id,
    forma_pago: mapped.forma_pago,
    destino: mapped.destino,
    fecha_in: mapped.fecha_in,
    fecha_out: mapped.fecha_out,
    solo_ida: mapped.solo_ida,
    importe: mapped.importe,
    importe_bruto: mapped.importe_bruto,
    promocode_aplicado: false,
    promocode_importe: 0,
    importe_final: mapped.importe_final,
    pago_parcial: false,
    total_pagado: 0,
    saldo_cta_cte: 0,
    moneda: mapped.moneda,
    vendedor: null,
    vendedor_id: null,
    sucursal_id: null,
    estado: mapped.estado,
    observaciones: mapped.observaciones,
    activo: true,
    visible_en_carritos: true,
    riesgo: false,
    importe_riesgo: 0,
    riesgo_resuelto: false,
    confirmado_vendedor: false
  };
}

async function loadExisting(catalogType: ImportCatalogType): Promise<ExistingCatalogItem[]> {
  const tableName = getTableName(catalogType);

  if (catalogType === "clientes") {
    const { data, error } = await supabase
      .from(tableName)
      .select("id, nombre_completo, telefono, email, observaciones, legacy_cliente_id");

    if (error) throw error;

    return (data || []) as ExistingCatalogItem[];
  }

  if (catalogType === "carritos_files_historicos") {
    const [carritosResult, filesResult] = await Promise.all([
      supabase.from("carritos").select("id, legacy_id, numero_carrito"),
      supabase.from("files").select("id, legacy_id, numero_file")
    ]);

    if (carritosResult.error) throw carritosResult.error;
    if (filesResult.error) throw filesResult.error;

    const carritos = (carritosResult.data || []).map((item) => ({
      ...item,
      legacy_id: item.legacy_id ? `carrito:${item.legacy_id}` : null
    }));

    const files = (filesResult.data || []).map((item) => ({
      ...item,
      legacy_id: item.legacy_id ? `file:${item.legacy_id}` : null
    }));

    return [...carritos, ...files] as ExistingCatalogItem[];
  }

  if (catalogType === "live_contactos") {
    const { data, error } = await supabase.from(tableName).select("id, live_contact_id");

    if (error) throw error;

    return (data || []) as ExistingCatalogItem[];
  }

  if (catalogType === "live_conversaciones") {
    const { data, error } = await supabase.from(tableName).select("id, live_conversation_id");

    if (error) throw error;

    return (data || []) as ExistingCatalogItem[];
  }

  if (catalogType === "live_mensajes") {
    return [];
  }

  const { data, error } = await supabase.from(tableName).select("*");

  if (error) throw error;

  return (data || []) as ExistingCatalogItem[];
}

async function loadClientesLookup(): Promise<ClienteLookupItem[]> {
  const { data, error } = await supabase
    .from("clientes_legacy_map")
    .select(`
      legacy_cliente_id,
      cliente:clientes (
        id,
        nombre_completo,
        telefono,
        email
      )
    `);

  if (error) throw error;

  return (data || [])
    .map((item: any) => ({
      id: item.cliente?.id,
      legacy_cliente_id: item.legacy_cliente_id,
      nombre_completo: item.cliente?.nombre_completo || null,
      telefono: item.cliente?.telefono || null,
      email: item.cliente?.email || null
    }))
    .filter((item) => Boolean(item.id)) as ClienteLookupItem[];
}

async function loadValidIdSet(tableName: string): Promise<Set<string>> {
  const { data, error } = await supabase.from(tableName).select("id");

  if (error) throw error;

  return new Set((data || []).map((item) => String(item.id)));
}

export const useImportadorCatalogosStore = create<ImportadorCatalogosState>((set, get) => ({
  loading: false,
  importing: false,
  error: null,

  catalogType: "destinos",
  rawText: "",
  delimiter: ",",
  hasHeaders: true,

  detectedColumns: [],
  columnMap: {},
  rawRows: [],
  previewRows: [],
  result: null,

  setCatalogType: (catalogType) => {
    set({
      catalogType,
      detectedColumns: [],
      columnMap: {},
      rawRows: [],
      previewRows: [],
      result: null,
      error: null
    });
  },

  setRawText: (rawText) => {
    set({
      rawText,
      previewRows: [],
      result: null,
      error: null
    });
  },

  setDelimiter: (delimiter) => {
    set({
      delimiter,
      previewRows: [],
      result: null,
      error: null
    });
  },

  setHasHeaders: (hasHeaders) => {
    set({
      hasHeaders,
      previewRows: [],
      result: null,
      error: null
    });
  },

  setColumnMapValue: (targetField, sourceColumn) => {
    set((state) => ({
      columnMap: {
        ...state.columnMap,
        [targetField]: sourceColumn
      },
      previewRows: [],
      result: null,
      error: null
    }));
  },

  parseRawText: () => {
    const { rawText, delimiter, hasHeaders, catalogType } = get();

    try {
      const parsed = parseTextToRows(rawText, delimiter, hasHeaders);
      const columnMap = buildInitialMap(catalogType, parsed.columns);

      set({
        detectedColumns: parsed.columns,
        rawRows: parsed.rows,
        columnMap,
        previewRows: [],
        result: null,
        error: null
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        detectedColumns: [],
        rawRows: [],
        previewRows: []
      });
    }
  },

  buildPreview: async () => {
    const { catalogType, rawRows, columnMap } = get();

    set({ loading: true, error: null, result: null });

    try {
      const existing = await loadExisting(catalogType);
      const existingKeys = new Set(existing.map((item) => getExistingKey(catalogType, item)));
      const batchKeys = new Set<string>();

      const needsClientes = catalogType === "carritos" || catalogType === "carritos_files_historicos";
      const needsIds = catalogType === "carritos" || catalogType === "carritos_files_historicos";

      const clientes = needsClientes ? await loadClientesLookup() : [];
      const validServicioIds = needsIds ? await loadValidIdSet("servicios") : new Set<string>();
      const validFormaPagoIds = needsIds ? await loadValidIdSet("formas_pago") : new Set<string>();

      const previewRows: ImportPreviewRow[] = rawRows.map((row, index) => {
        const mapped = mapRow(catalogType, row, columnMap, index + 1);

        let validationError = validateMappedRow(catalogType, mapped);

        if (!validationError && catalogType === "carritos") {
          validationError = enrichHistoricCartRow(mapped, clientes, validServicioIds, validFormaPagoIds);
        }

        if (!validationError && catalogType === "carritos_files_historicos") {
          validationError = enrichHistoricCarritoFileRow(mapped, clientes, validServicioIds, validFormaPagoIds);
        }

        const mappedKey = getMappedKey(catalogType, mapped);

        if (validationError) {
          return {
            index: index + 1,
            raw: row,
            mapped,
            status: "invalido",
            reason: validationError
          };
        }

        if (!mappedKey) {
          return {
            index: index + 1,
            raw: row,
            mapped,
            status: "invalido",
            reason: "No se pudo generar clave de comparación."
          };
        }

        if (existingKeys.has(mappedKey)) {
          return {
            index: index + 1,
            raw: row,
            mapped,
            status: "duplicado",
            reason: "Ya existe en Supabase."
          };
        }

        if (batchKeys.has(mappedKey)) {
          return {
            index: index + 1,
            raw: row,
            mapped,
            status: "duplicado",
            reason: "Duplicado dentro del archivo."
          };
        }

        batchKeys.add(mappedKey);

        return {
          index: index + 1,
          raw: row,
          mapped,
          status: "nuevo",
          reason: null
        };
      });

      set({
        loading: false,
        previewRows,
        result: null,
        error: null
      });
    } catch (error) {
      set({
        loading: false,
        error: normalizeError(error)
      });
    }
  },

  importPreview: async () => {
    const { catalogType, previewRows } = get();

    set({ importing: true, error: null, result: null });

    try {
      const rowsToImport = previewRows.filter((row) => row.status === "nuevo");

      if (catalogType === "carritos_files_historicos") {
        const carritosToInsert = rowsToImport
          .filter((row) => !isHistoricFileRow(row.mapped))
          .map((row) => toHistoricCarritoInsertRow(row.mapped));

        const filesToInsert = rowsToImport
          .filter((row) => isHistoricFileRow(row.mapped))
          .map((row) => toHistoricFileInsertRow(row.mapped));

        if (carritosToInsert.length > 0) {
          const { error } = await supabase.from("carritos").insert(carritosToInsert);

          if (error) {
            set({
              importing: false,
              error: normalizeError(error)
            });

            return false;
          }
        }

        if (filesToInsert.length > 0) {
          const { error } = await supabase.from("files").insert(filesToInsert);

          if (error) {
            set({
              importing: false,
              error: normalizeError(error)
            });

            return false;
          }
        }

        set({
          importing: false,
          result: {
            inserted: carritosToInsert.length + filesToInsert.length,
            skipped: previewRows.filter((row) => row.status === "duplicado").length,
            invalid: previewRows.filter((row) => row.status === "invalido").length,
            errors: []
          }
        });

        return true;
      }

     if (catalogType === "live_conversaciones") {
  const contactosMap = new Map<string, Record<string, ImportMappedValue>>();

  const conversaciones = rowsToImport.map((row) => {
    const mapped = row.mapped;
    const liveContactId = cleanText(mapped.live_contact_id);

    if (liveContactId && !contactosMap.has(liveContactId)) {
      contactosMap.set(liveContactId, buildLiveContactFromConversationRow(mapped));
    }

    return toInsertRow(catalogType, mapped);
  });

  const liveContactIds = Array.from(contactosMap.keys()).filter(Boolean);

  let existingLiveContactIds = new Set<string>();

  if (liveContactIds.length > 0) {
    const { data: existingContacts, error: existingContactsError } = await supabase
      .from("comunicaciones_live_contactos")
      .select("live_contact_id")
      .in("live_contact_id", liveContactIds);

    if (existingContactsError) {
      set({
        importing: false,
        error: normalizeError(existingContactsError)
      });

      return false;
    }

    existingLiveContactIds = new Set(
      (existingContacts || [])
        .map((item) => cleanText(item.live_contact_id))
        .filter(Boolean)
    );
  }

  const contactos = Array.from(contactosMap.values()).filter((contacto) => {
    const liveContactId = cleanText(contacto.live_contact_id);
    return liveContactId && !existingLiveContactIds.has(liveContactId);
  });

  if (contactos.length > 0) {
    const { error: contactosError } = await supabase
      .from("comunicaciones_live_contactos")
      .insert(contactos);

    if (contactosError) {
      set({
        importing: false,
        error: normalizeError(contactosError)
      });

      return false;
    }
  }

  if (conversaciones.length > 0) {
    const { error: conversacionesError } = await supabase
      .from("comunicaciones_live_conversaciones")
      .upsert(conversaciones, {
        onConflict: "live_conversation_id",
        ignoreDuplicates: false
      });

          if (conversacionesError) {
            set({
              importing: false,
              error: normalizeError(conversacionesError)
            });

            return false;
          }
        }

        set({
          importing: false,
          result: {
            inserted: conversaciones.length,
            skipped: previewRows.filter((row) => row.status === "duplicado").length,
            invalid: previewRows.filter((row) => row.status === "invalido").length,
            errors: []
          }
        });

        return true;
      }

      const rowsToInsert = rowsToImport.map((row) => toInsertRow(catalogType, row.mapped));

      if (rowsToInsert.length === 0) {
        set({
          importing: false,
          result: {
            inserted: 0,
            skipped: previewRows.filter((row) => row.status === "duplicado").length,
            invalid: previewRows.filter((row) => row.status === "invalido").length,
            errors: []
          }
        });

        return true;
      }

      const tableName = getTableName(catalogType);

      if (catalogType === "live_contactos") {
        const { error } = await supabase.from(tableName).upsert(rowsToInsert, {
          onConflict: "live_contact_id",
          ignoreDuplicates: false
        });

        if (error) {
          set({
            importing: false,
            error: normalizeError(error)
          });

          return false;
        }
      } else if (catalogType === "live_mensajes") {
        const { error } = await supabase.from(tableName).insert(rowsToInsert);

        if (error) {
          set({
            importing: false,
            error: normalizeError(error)
          });

          return false;
        }
      } else {
        const { error } = await supabase.from(tableName).insert(rowsToInsert);

        if (error) {
          set({
            importing: false,
            error: normalizeError(error)
          });

          return false;
        }
      }

      set({
        importing: false,
        result: {
          inserted: rowsToInsert.length,
          skipped: previewRows.filter((row) => row.status === "duplicado").length,
          invalid: previewRows.filter((row) => row.status === "invalido").length,
          errors: []
        }
      });

      return true;
    } catch (error) {
      set({
        importing: false,
        error: normalizeError(error)
      });

      return false;
    }
  },

  reset: () => {
    set({
      loading: false,
      importing: false,
      error: null,
      catalogType: "destinos",
      rawText: "",
      delimiter: ",",
      hasHeaders: true,
      detectedColumns: [],
      columnMap: {},
      rawRows: [],
      previewRows: [],
      result: null
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));

export function getImportCatalogLabel(catalogType: ImportCatalogType): string {
  return CATALOG_LABELS[catalogType];
}

export function getImportCatalogFields(catalogType: ImportCatalogType): string[] {
  return DEFAULT_FIELD_MAP[catalogType];
}

export function getImportFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    nombre: "Nombre",
    pais: "País",
    activo: "Activo",
    activa: "Activa",
    color: "Color",
    impacta_tesoreria: "Impacta tesorería",
    razon_social: "Razón social",
    cuit: "CUIT",
    telefono: "Teléfono",
    nombre_comercial: "Nombre comercial",
    tipo: "Tipo",
    moneda: "Moneda",
    sucursal_id: "Sucursal ID",
    descripcion: "Descripción",
    direccion: "Dirección",
    ciudad: "Ciudad",
    orden: "Orden",

    nombre_completo: "Nombre completo",
    observaciones: "Observaciones",

    legacy_id: "ID histórico",
    legacy_cliente_id: "Cliente histórico ID",

    nombre_pasajero: "Nombre pasajero",
    notas_adicionales: "Notas adicionales",
    fecha: "Fecha",

    ubicacion: "Ubicación",
    categoria: "Categoría",
    imagenes: "Imágenes",
    regimen: "Régimen",
    tipo_habitacion: "Tipo habitación",
    tipo_tarifa: "Tipo tarifa",
    cargos_adicionales: "Cargos adicionales",
    descripcion_cargos: "Descripción cargos",
    veces_usado: "Veces usado",
    ultimo_uso: "Último uso",

    email: "Email",
    numero_carrito: "Número carrito",
    numero_file: "Número file",
    es_almundo: "Es ALMUNDO",
    fecha_venta: "Fecha venta",
    servicio_id: "Servicio ID",
    servicio: "Servicio",
    metodo_contacto: "Método contacto",
    forma_pago_id: "Forma pago ID",
    forma_pago: "Forma pago",
    destino: "Destino",
    fecha_in: "Fecha IN",
    fecha_out: "Fecha OUT",
    solo_ida: "Solo ida",
    importe: "Importe",
    importe_bruto: "Importe bruto",
    importe_final: "Importe final",

    vendedor_id: "Vendedor ID",
    promocode: "Promocode",
    importe_promocode: "Importe promocode",
    derivado_control: "Derivado control",
    utilidad_neta: "Utilidad neta",
    regalias: "Regalías",
    utilidad_bruta: "Utilidad bruta",
    importe_facturar: "Importe facturar",
    facturado: "Facturado",
    numero_factura: "Número factura",
    numero_factura_arca: "Número factura ARCA",
    cobrado: "Cobrado",
    controlado: "Controlado",
    fecha_cobro: "Fecha cobro",
    fecha_factura: "Fecha factura",
    tipo_cambio_usado: "Tipo cambio usado",

    operador_id: "Operador ID",
    operador_mayorista: "Operador mayorista",
    neto_operador: "Neto operador",
    fecha_vencimiento_operador: "Fecha vencimiento operador",
    saldo_pendiente_operador: "Saldo pendiente operador",
    estado_pago_operador: "Estado pago operador",

    impacto_riesgo: "Impacto riesgo",
    riesgo_resuelto: "Riesgo resuelto",
    riesgo_resuelto_at: "Riesgo resuelto fecha",
    riesgo_resuelto_por: "Riesgo resuelto por",

    cancelado: "Cancelado",
    fecha_cancelacion: "Fecha cancelación",
    motivo_cancelacion: "Motivo cancelación",

    distinta_moneda_liquidacion: "Distinta moneda liquidación",
    moneda_liquidacion: "Moneda liquidación",
    importe_liquidacion: "Importe liquidación",

    created_at: "Creado",
    updated_at: "Actualizado",

    live_contact_id: "ID contacto Live",
    live_conversation_id: "ID conversación Live",
    apellidos: "Apellidos",
    avatar_url: "Avatar",
    celular: "Celular",
    celular_normalizado: "Celular normalizado",
    tipo_documento: "Tipo documento",
    documento: "Documento",
    genero: "Género",
    fecha_cumpleanos: "Fecha cumpleaños",
    habeas_data: "Habeas data",
    etiquetas: "Etiquetas",
    empresa: "Empresa",
    extra_1: "Extra 1",
    extra_2: "Extra 2",
    dinamicos: "Dinámicos",
    autoasignado: "Autoasignado",
    bloqueado: "Bloqueado",

    etiqueta: "Etiqueta",
    canal_nombre: "Canal nombre",
    canal_tipo: "Canal tipo",
    live_contacto_nombre: "Contacto",
    grupo: "Grupo",
    agente: "Agente",
    ips: "IPs",
    browser: "Browser",
    ultimo_mensaje: "Último mensaje",
    url_conversacion: "URL conversación",
    html_url_original: "HTML URL original",
    html_raw: "HTML raw",

    live_fecha_creado: "Fecha creado",
    live_fecha_editado: "Fecha editado",
    live_fecha_finalizado: "Fecha finalizado",

    fecha_mensaje: "Fecha mensaje",
    hora_texto: "Hora",
    direction: "Dirección",
    sender_name: "Remitente",
    sender_role: "Rol remitente",
    content: "Contenido",
    message_type: "Tipo mensaje",
    media_url: "Media URL",
    media_filename: "Archivo",
    media_mime_type: "Mime type",
    raw_html: "HTML raw"
  };

  return labels[field] || field;
}