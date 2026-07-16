// src/store/presupuestosV2Store.ts

import { create } from "zustand";

import { supabase } from "../lib/supabase";
import { filtrarSucursalesActivas } from "../lib/sucursales";

/* =========================================================
   NOSSIX / NOSTUR — PRESUPUESTOS V2 STORE
   Constructor de Propuestas ALMUNDO / NOSSIX

   Marca default: ALMUNDO
   Plantilla cerrada: ALMUNDO_PREMIUM
========================================================= */

/* =========================================================
   TIPOS BASE
========================================================= */

export type PresupuestoMarca = "ALMUNDO" | "NOSSIX";

export type PresupuestoPlantilla =
  | "ALMUNDO_PREMIUM"
  | "ALMUNDO_COMPACTO"
  | "NOSSIX_PREMIUM"
  | "NOSSIX_COMPACTO";

export type PresupuestoEstado =
  | "BORRADOR"
  | "ENVIADO"
  | "ACEPTADO"
  | "RECHAZADO"
  | "VENCIDO"
  | "CANCELADO";

export type PresupuestoOrigenCarga =
  | "MANUAL"
  | "ALMUNDO_TEXTO"
  | "CAPTURA"
  | "IA"
  | "MIXTO";

export type PresupuestoMoneda =
  | "USD"
  | "ARS";

export type PresupuestoServicioTipo =
  | "TRASLADO"
  | "ASISTENCIA"
  | "EXCURSION"
  | "EQUIPAJE"
  | "SEGURO"
  | "CIRCUITO"
  | "AUTO"
  | "OTRO";

export type PresupuestoCombinacionItemTipo =
  | "VUELO"
  | "HOTEL"
  | "SERVICIO"
  | "TEXTO"
  | "OTRO";

export type PresupuestoAdjuntoEntidadTipo =
  | "PRESUPUESTO"
  | "VUELO"
  | "HOTEL"
  | "SERVICIO"
  | "COMBINACION";

export type PresupuestoAdjuntoTipo =
  | "CAPTURA"
  | "IMAGEN"
  | "PDF"
  | "DOCUMENTO"
  | "OTRO";

export type ProfileLite = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  sucursal_id?: string | null;
  rol?: string | null;
  activo?: boolean | null;
  is_super_admin?: boolean | null;
  is_support_user?: boolean | null;
};

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean | null;
  activo?: boolean | null;
};

export type ClienteDetectadoLite = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  source: "clientes" | "contactos";
};

export type PresupuestoV2Resumen = {
  id: string;
  numero: string | null;
  version: number;
  marca: PresupuestoMarca;
  plantilla: PresupuestoPlantilla;
  estado: PresupuestoEstado;
  origen_carga: PresupuestoOrigenCarga;
  cliente_id: string | null;
  contacto_id: string | null;
  lead_id: string | null;
  carrito_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  titulo: string | null;
  destino_principal: string | null;
  destino_detalle: string | null;
  fecha_salida: string | null;
  fecha_regreso: string | null;
  noches: number | null;
  adultos: number;
  menores: number;
  edades_menores: string | null;
  vendedor_id: string | null;
  vendedor_nombre?: string | null;
  vendedor_email?: string | null;
  sucursal_id: string | null;
  sucursal_nombre?: string | null;
  moneda_principal: PresupuestoMoneda;
  validez_hasta: string | null;
  opcion_recomendada_id: string | null;
  cantidad_vuelos: number;
  cantidad_hoteles: number;
  cantidad_servicios: number;
  cantidad_combinaciones: number;
  precio_desde: number | null;
  precio_recomendado: number | null;
  pdf_url: string | null;
  pdf_generado_at: string | null;
  enviado_at: string | null;
  aceptado_at: string | null;
  rechazado_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PresupuestoV2 = {
  id: string;
  numero: string | null;
  version: number;
  marca: PresupuestoMarca;
  plantilla: PresupuestoPlantilla;
  estado: PresupuestoEstado;
  origen_carga: PresupuestoOrigenCarga;
  cliente_id: string | null;
  contacto_id: string | null;
  lead_id: string | null;
  carrito_id: string | null;
  cliente_nombre: string | null;
  cliente_telefono: string | null;
  cliente_email: string | null;
  titulo: string | null;
  destino_principal: string | null;
  destino_detalle: string | null;
  origen_ciudad: string | null;
  origen_iata: string | null;
  destino_ciudad: string | null;
  destino_iata: string | null;
  fecha_salida: string | null;
  fecha_regreso: string | null;
  noches: number | null;
  adultos: number;
  menores: number;
  edades_menores: string | null;
  pasajeros_detalle: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  validez_hasta: string | null;
  moneda_principal: PresupuestoMoneda;
  observaciones_internas: string | null;
  intro_comercial: string | null;
  condiciones_generales: string | null;
  footer_text: string;
  opcion_recomendada_id: string | null;
  html_preview: string | null;
  pdf_url: string | null;
  pdf_path: string | null;
  pdf_generado_at: string | null;
  enviado_at: string | null;
  enviado_por: string | null;
  aceptado_at: string | null;
  rechazado_at: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PresupuestoVuelo = {
  id: string;
  presupuesto_id: string;
  orden: number;
  titulo: string;
  aerolinea: string | null;
  codigo_reserva: string | null;
  ruta_resumen: string | null;
  ida_origen: string | null;
  ida_destino: string | null;
  ida_fecha: string | null;
  ida_hora_salida: string | null;
  ida_hora_llegada: string | null;
  ida_escalas: string | null;
  ida_detalle: string | null;
  vuelta_origen: string | null;
  vuelta_destino: string | null;
  vuelta_fecha: string | null;
  vuelta_hora_salida: string | null;
  vuelta_hora_llegada: string | null;
  vuelta_escalas: string | null;
  vuelta_detalle: string | null;
  equipaje: string | null;
  tarifa_familia: string | null;
  condiciones: string | null;
  precio_total: number | null;
  moneda: PresupuestoMoneda | string;
  incluir_en_pdf: boolean;
  es_principal: boolean;
  captura_url: string | null;
  captura_path: string | null;
  raw_text: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PresupuestoHotel = {
  id: string;
  presupuesto_id: string;
  hotel_id: string | null;
  orden: number;
  titulo: string;
  nombre: string;
  destino: string | null;
  zona: string | null;
  categoria: string | null;
  regimen: string | null;
  habitacion: string | null;
  ocupacion: string | null;
  check_in: string | null;
  check_out: string | null;
  noches: number | null;
  descripcion: string | null;
  beneficios: string | null;
  condiciones: string | null;
  politica_cancelacion: string | null;
  imagen_url: string | null;
  captura_url: string | null;
  captura_path: string | null;
  precio_total: number | null;
  moneda: PresupuestoMoneda | string;
  incluir_en_pdf: boolean;
  es_principal: boolean;
  raw_text: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PresupuestoServicio = {
  id: string;
  presupuesto_id: string;
  orden: number;
  tipo: PresupuestoServicioTipo;
  nombre: string;
  descripcion: string | null;
  incluido: boolean;
  opcional: boolean;
  precio_total: number | null;
  moneda: PresupuestoMoneda | string;
  incluir_en_pdf: boolean;
  raw_text: string | null;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PresupuestoCombinacion = {
  id: string;
  presupuesto_id: string;
  orden: number;
  nombre: string;
  subtitulo: string | null;
  descripcion: string | null;
  destacada: boolean;
  etiqueta: string | null;
  vuelo_id: string | null;
  hotel_id: string | null;
  precio_total: number;
  moneda: PresupuestoMoneda | string;
  precio_contado: number | null;
  precio_transferencia: number | null;
  precio_tarjeta: number | null;
  precio_financiado: number | null;
  seña: number | null;
  saldo: number | null;
  forma_pago_resumen: string | null;
  condiciones_pago: string | null;
  incluye_resumen: string | null;
  no_incluye_resumen: string | null;
  notas: string | null;
  visible_en_pdf: boolean;
  metadata: Record<string, unknown>;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PresupuestoCombinacionItem = {
  id: string;
  combinacion_id: string;
  presupuesto_id: string;
  orden: number;
  item_tipo: PresupuestoCombinacionItemTipo;
  vuelo_id: string | null;
  hotel_id: string | null;
  servicio_id: string | null;
  titulo: string | null;
  descripcion: string | null;
  precio: number | null;
  moneda: PresupuestoMoneda | string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PresupuestoAdjunto = {
  id: string;
  presupuesto_id: string;
  entidad_tipo: PresupuestoAdjuntoEntidadTipo;
  entidad_id: string | null;
  tipo: PresupuestoAdjuntoTipo;
  titulo: string | null;
  descripcion: string | null;
  file_url: string;
  file_path: string | null;
  file_name: string | null;
  file_mime_type: string | null;
  file_size: number | null;
  incluir_en_pdf: boolean;
  orden: number;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

export type PresupuestoV2Full = {
  presupuesto: PresupuestoV2 | null;
  vuelos: PresupuestoVuelo[];
  hoteles: PresupuestoHotel[];
  servicios: PresupuestoServicio[];
  combinaciones: PresupuestoCombinacion[];
  combinacionItems: PresupuestoCombinacionItem[];
  adjuntos: PresupuestoAdjunto[];
};

/* =========================================================
   IA PREVIEW TYPES
========================================================= */

export type PresupuestoIaPreviewResumen = {
  titulo: string;
  descripcion: string;
  vuelos_detectados: number;
  hoteles_detectados: number;
  servicios_detectados: number;
  opciones_detectadas: number;
  precio_final_detectado: string;
  advertencias: string[];
};

export type PresupuestoIaPreview = {
  raw_text: string;
  parsed: Record<string, unknown>;
  resumen_humano: PresupuestoIaPreviewResumen;
  vuelos: Record<string, unknown>[];
  hoteles: Record<string, unknown>[];
  servicios: Record<string, unknown>[];
  opciones_comerciales: Record<string, unknown>[];
  incluye_general: string;
  no_incluye_general: string;
  condiciones_generales: string;
  created_at: string;
};

export type ProcessPresupuestoIaDraft = {
  presupuesto: PresupuestoV2;
  raw_text: string;
};

/* =========================================================
   DRAFTS
========================================================= */

export type CreatePresupuestoV2Draft = {
  cliente_nombre?: string;
  cliente_telefono?: string;
  cliente_email?: string;
  destino_principal?: string;
  fecha_salida?: string | null;
  fecha_regreso?: string | null;
  adultos?: number;
  menores?: number;
  edades_menores?: string | null;
  vendedor_id?: string | null;
  sucursal_id?: string | null;
};

export type UpdatePresupuestoV2Draft = Partial<PresupuestoV2> & {
  id: string;
};

export type CreateVueloDraft = Partial<PresupuestoVuelo> & {
  presupuesto_id: string;
};

export type UpdateVueloDraft = Partial<PresupuestoVuelo> & {
  id: string;
};

export type CreateHotelDraft = Partial<PresupuestoHotel> & {
  presupuesto_id: string;
  nombre: string;
};

export type UpdateHotelDraft = Partial<PresupuestoHotel> & {
  id: string;
};

export type CreateServicioDraft = Partial<PresupuestoServicio> & {
  presupuesto_id: string;
  nombre: string;
};

export type UpdateServicioDraft = Partial<PresupuestoServicio> & {
  id: string;
};

export type CreateCombinacionDraft = Partial<PresupuestoCombinacion> & {
  presupuesto_id: string;
  nombre: string;
};

export type UpdateCombinacionDraft = Partial<PresupuestoCombinacion> & {
  id: string;
};

export type CreateCombinacionItemDraft = Partial<PresupuestoCombinacionItem> & {
  presupuesto_id: string;
  combinacion_id: string;
  item_tipo: PresupuestoCombinacionItemTipo;
};

export type UpdateCombinacionItemDraft = Partial<PresupuestoCombinacionItem> & {
  id: string;
};

export type UploadAdjuntoDraft = {
  presupuesto_id: string;
  file: File;
  entidad_tipo?: PresupuestoAdjuntoEntidadTipo;
  entidad_id?: string | null;
  tipo?: PresupuestoAdjuntoTipo;
  titulo?: string | null;
  descripcion?: string | null;
  incluir_en_pdf?: boolean;
};

export type PresupuestosV2Filters = {
  search: string;
  estado: "TODOS" | PresupuestoEstado;
  marca: "TODAS" | PresupuestoMarca;
  vendedorId: string;
  sucursalId: string;
  desde: string;
  hasta: string;
};

export type PresupuestosV2Metrics = {
  total: number;
  borradores: number;
  enviados: number;
  aceptados: number;
  rechazados: number;
  vencidos: number;
  conPdf: number;
};

type PresupuestosV2State = {
  loading: boolean;
  loadingDetail: boolean;
  saving: boolean;
  uploading: boolean;
  processingIa: boolean;
  searchingCliente: boolean;
  error: string | null;

  presupuestos: PresupuestoV2Resumen[];
  selectedPresupuestoId: string | null;

  presupuesto: PresupuestoV2 | null;
  vuelos: PresupuestoVuelo[];
  hoteles: PresupuestoHotel[];
  servicios: PresupuestoServicio[];
  combinaciones: PresupuestoCombinacion[];
  combinacionItems: PresupuestoCombinacionItem[];
  adjuntos: PresupuestoAdjunto[];

    currentProfile: ProfileLite | null;
  vendedores: ProfileLite[];
  sucursales: SucursalLite[];

  clienteDetectado: ClienteDetectadoLite | null;
  aiPreview: PresupuestoIaPreview | null;

  filters: PresupuestosV2Filters;

  loadPresupuestos: (silent?: boolean) => Promise<void>;
  loadPresupuestoFull: (presupuestoId?: string | null, silent?: boolean) => Promise<void>;
  loadCatalogs: () => Promise<void>;

  createPresupuesto: (draft: CreatePresupuestoV2Draft) => Promise<string | null>;
  updatePresupuesto: (draft: UpdatePresupuestoV2Draft) => Promise<boolean>;
  deletePresupuesto: (presupuestoId: string) => Promise<boolean>;

  addVuelo: (draft: CreateVueloDraft) => Promise<string | null>;
  updateVuelo: (draft: UpdateVueloDraft) => Promise<boolean>;
  deleteVuelo: (vueloId: string) => Promise<boolean>;
  setVueloPrincipal: (vueloId: string) => Promise<boolean>;

  addHotel: (draft: CreateHotelDraft) => Promise<string | null>;
  updateHotel: (draft: UpdateHotelDraft) => Promise<boolean>;
  deleteHotel: (hotelId: string) => Promise<boolean>;
  setHotelPrincipal: (hotelId: string) => Promise<boolean>;

  addServicio: (draft: CreateServicioDraft) => Promise<string | null>;
  updateServicio: (draft: UpdateServicioDraft) => Promise<boolean>;
  deleteServicio: (servicioId: string) => Promise<boolean>;

  addCombinacion: (draft: CreateCombinacionDraft) => Promise<string | null>;
  updateCombinacion: (draft: UpdateCombinacionDraft) => Promise<boolean>;
  deleteCombinacion: (combinacionId: string) => Promise<boolean>;
  setCombinacionRecomendada: (combinacionId: string) => Promise<boolean>;

  addCombinacionItem: (draft: CreateCombinacionItemDraft) => Promise<string | null>;
  updateCombinacionItem: (draft: UpdateCombinacionItemDraft) => Promise<boolean>;
  deleteCombinacionItem: (itemId: string) => Promise<boolean>;

  uploadAdjunto: (draft: UploadAdjuntoDraft) => Promise<string | null>;
  deleteAdjunto: (adjuntoId: string) => Promise<boolean>;

  markAsSent: (presupuestoId: string) => Promise<boolean>;
  markAsAccepted: (presupuestoId: string) => Promise<boolean>;
  markAsRejected: (presupuestoId: string) => Promise<boolean>;

  processPresupuestoIaPreview: (draft: ProcessPresupuestoIaDraft) => Promise<PresupuestoIaPreview | null>;
  clearIaPreview: () => void;

  searchClienteByTelefono: (telefono: string) => Promise<ClienteDetectadoLite | null>;
  clearClienteDetectado: () => void;

  sendPresupuestoByLiveNos: (presupuestoId: string) => Promise<boolean>;

  duplicatePresupuesto: (presupuestoId: string) => Promise<string | null>;

  selectPresupuesto: (presupuestoId: string | null) => void;

  setFilter: <K extends keyof PresupuestosV2Filters>(
    key: K,
    value: PresupuestosV2Filters[K]
  ) => void;
  resetFilters: () => void;
  clearError: () => void;

  getFilteredPresupuestos: () => PresupuestoV2Resumen[];
  getSelectedPresupuestoResumen: () => PresupuestoV2Resumen | null;
  getMetrics: () => PresupuestosV2Metrics;
  getPresupuestoFull: () => PresupuestoV2Full;
};

/* =========================================================
   CONSTANTES
========================================================= */

const DEFAULT_FOOTER =
  "Presupuesto generado por ALMUNDO Franquicia Córdoba — Operado por NOSSIX S.A.S.\nBarrio General Paz · Ovidio Lagos 56\nBarrio Jardín · Av. Pablo Ricchieri 3304\nCórdoba, Argentina";

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/[^\d]/g, "");
}

function normalizeNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string") {
    const cleaned = value.replace(/\./g, "").replace(",", ".").trim();
    if (!cleaned) return null;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function normalizeBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return Boolean(value);
}

function normalizeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function mergeMetadata(
  current: unknown,
  next?: Record<string, unknown> | null
): Record<string, unknown> {
  return {
    ...normalizeRecord(current),
    ...(next || {})
  };
}

function normalizeError(error: unknown): string {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "");

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para esta acción.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("duplicate key")) {
      return "Ya existe un registro igual.";
    }

    return message || "Ocurrió un error.";
  }

  return String(error);
}

function getNowIso(): string {
  return new Date().toISOString();
}

function isSellerProfile(profile?: ProfileLite | null): boolean {
  return String(profile?.rol || "").toLowerCase() === "vendedor";
}

function getDefaultFilters(profile?: ProfileLite | null): PresupuestosV2Filters {
  return {
    search: "",
    estado: "TODOS",
    marca: "TODAS",
    vendedorId: isSellerProfile(profile) && profile?.id ? profile.id : "todos",
    sucursalId: "todas",
    desde: "",
    hasta: ""
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function getSafeFileExtension(file: File): string {
  const fromName = file.name.split(".").pop();

  if (fromName) return fromName.toLowerCase();

  if (file.type.includes("jpeg")) return "jpg";
  if (file.type.includes("png")) return "png";
  if (file.type.includes("webp")) return "webp";
  if (file.type.includes("pdf")) return "pdf";

  return "bin";
}

function safeFileName(value: string): string {
  return cleanText(value)
    .replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function calculateNoches(
  fechaSalida?: string | null,
  fechaRegreso?: string | null
): number | null {
  if (!fechaSalida || !fechaRegreso) return null;

  const salida = new Date(`${fechaSalida}T00:00:00`);
  const regreso = new Date(`${fechaRegreso}T00:00:00`);

  if (Number.isNaN(salida.getTime()) || Number.isNaN(regreso.getTime())) return null;

  const diffMs = regreso.getTime() - salida.getTime();
  const diffDays = Math.round(diffMs / 86400000);

  return Math.max(diffDays, 0);
}

function buildPasajerosDetalle(
  adultos: number,
  menores: number,
  edadesMenores?: string | null
): string {
  const adultText = `${adultos} adulto${adultos === 1 ? "" : "s"}`;
  const menorText = menores > 0 ? ` + ${menores} menor${menores === 1 ? "" : "es"}` : "";
  const edadesText = menores > 0 && cleanText(edadesMenores) ? ` (${edadesMenores})` : "";

  return `${adultText}${menorText}${edadesText}`;
}

function calculateSaldo(precioTotal: unknown, seña: unknown, saldoManual: unknown): number | null {
  const total = normalizeNumber(precioTotal);
  const senia = normalizeNumber(seña);
  const saldo = normalizeNumber(saldoManual);

  if (total !== null && senia !== null) {
    return Math.max(total - senia, 0);
  }

  return saldo;
}

/* =========================================================
   IA PREVIEW HELPERS
========================================================= */

function asPreviewArray(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object" && !Array.isArray(item)
  );
}

function asPreviewString(value: unknown): string {
  return String(value || "").trim();
}


function buildIaPreview(rawText: string, parsed: Record<string, unknown>): PresupuestoIaPreview {
  const vuelos = asPreviewArray(parsed.vuelos);
  const hoteles = asPreviewArray(parsed.hoteles);
  const servicios = asPreviewArray(parsed.servicios);

  const opcionesNew = asPreviewArray(parsed.opciones_comerciales);
  const opcionesOld = asPreviewArray(parsed.opciones);
  const opciones_comerciales = opcionesNew.length > 0 ? opcionesNew : opcionesOld;

  const resumenRaw =
    parsed.resumen_humano && typeof parsed.resumen_humano === "object" && !Array.isArray(parsed.resumen_humano)
      ? (parsed.resumen_humano as Record<string, unknown>)
      : {};

  const advertencias = Array.isArray(resumenRaw.advertencias)
    ? resumenRaw.advertencias.map(asPreviewString).filter(Boolean)
    : Array.isArray(parsed.observaciones)
      ? parsed.observaciones.map(asPreviewString).filter(Boolean)
      : [];

  const firstOptionWithPrice = opciones_comerciales.find((item) => {
    return item.precio_total !== null && item.precio_total !== undefined;
  });

  const precioFinalDetectado =
    asPreviewString(resumenRaw.precio_final_detectado) ||
    (firstOptionWithPrice
      ? `${asPreviewString(firstOptionWithPrice.moneda) || "USD"} ${String(
          firstOptionWithPrice.precio_total
        )}`
      : "");

  return {
    raw_text: rawText,
    parsed,
    resumen_humano: {
      titulo: asPreviewString(resumenRaw.titulo) || "Contenido detectado por IA",
      descripcion:
        asPreviewString(resumenRaw.descripcion) ||
        `Se detectaron ${vuelos.length} vuelo(s), ${hoteles.length} hotel(es), ${servicios.length} servicio(s) y ${opciones_comerciales.length} opción(es).`,
      vuelos_detectados: Number(resumenRaw.vuelos_detectados || vuelos.length),
      hoteles_detectados: Number(resumenRaw.hoteles_detectados || hoteles.length),
      servicios_detectados: Number(resumenRaw.servicios_detectados || servicios.length),
      opciones_detectadas: Number(resumenRaw.opciones_detectadas || opciones_comerciales.length),
      precio_final_detectado: precioFinalDetectado,
      advertencias
    },
    vuelos,
    hoteles,
    servicios,
    opciones_comerciales,
    incluye_general: asPreviewString(parsed.incluye_general),
    no_incluye_general: asPreviewString(parsed.no_incluye_general),
    condiciones_generales: asPreviewString(parsed.condiciones_generales),
    created_at: getNowIso()
  };
}

/* =========================================================
   NORMALIZADORES
========================================================= */

function normalizeResumen(row: Record<string, unknown>): PresupuestoV2Resumen {
  return {
    id: String(row.id),
    numero: (row.numero as string | null) || null,
    version: Number(row.version || 1),
    marca: String(row.marca || "ALMUNDO") as PresupuestoMarca,
    plantilla: String(row.plantilla || "ALMUNDO_PREMIUM") as PresupuestoPlantilla,
    estado: String(row.estado || "BORRADOR") as PresupuestoEstado,
    origen_carga: String(row.origen_carga || "MANUAL") as PresupuestoOrigenCarga,
    cliente_id: (row.cliente_id as string | null) || null,
    contacto_id: (row.contacto_id as string | null) || null,
    lead_id: (row.lead_id as string | null) || null,
    carrito_id: (row.carrito_id as string | null) || null,
    cliente_nombre: (row.cliente_nombre as string | null) || null,
    cliente_telefono: (row.cliente_telefono as string | null) || null,
    cliente_email: (row.cliente_email as string | null) || null,
    titulo: (row.titulo as string | null) || null,
    destino_principal: (row.destino_principal as string | null) || null,
    destino_detalle: (row.destino_detalle as string | null) || null,
    fecha_salida: (row.fecha_salida as string | null) || null,
    fecha_regreso: (row.fecha_regreso as string | null) || null,
    noches: normalizeNumber(row.noches),
    adultos: Number(row.adultos || 1),
    menores: Number(row.menores || 0),
    edades_menores: (row.edades_menores as string | null) || null,
    vendedor_id: (row.vendedor_id as string | null) || null,
    vendedor_nombre: (row.vendedor_nombre as string | null) || null,
    vendedor_email: (row.vendedor_email as string | null) || null,
    sucursal_id: (row.sucursal_id as string | null) || null,
    sucursal_nombre: (row.sucursal_nombre as string | null) || null,
    moneda_principal: String(row.moneda_principal || "USD") as PresupuestoMoneda,
    validez_hasta: (row.validez_hasta as string | null) || null,
    opcion_recomendada_id: (row.opcion_recomendada_id as string | null) || null,
    cantidad_vuelos: Number(row.cantidad_vuelos || 0),
    cantidad_hoteles: Number(row.cantidad_hoteles || 0),
    cantidad_servicios: Number(row.cantidad_servicios || 0),
    cantidad_combinaciones: Number(row.cantidad_combinaciones || 0),
    precio_desde: normalizeNumber(row.precio_desde),
    precio_recomendado: normalizeNumber(row.precio_recomendado),
    pdf_url: (row.pdf_url as string | null) || null,
    pdf_generado_at: (row.pdf_generado_at as string | null) || null,
    enviado_at: (row.enviado_at as string | null) || null,
    aceptado_at: (row.aceptado_at as string | null) || null,
    rechazado_at: (row.rechazado_at as string | null) || null,
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    updated_by: (row.updated_by as string | null) || null,
    created_at: String(row.created_at || getNowIso()),
    updated_at: String(row.updated_at || getNowIso())
  };
}

function normalizePresupuesto(row: Record<string, unknown>): PresupuestoV2 {
  return {
    id: String(row.id),
    numero: (row.numero as string | null) || null,
    version: Number(row.version || 1),
    marca: String(row.marca || "ALMUNDO") as PresupuestoMarca,
    plantilla: String(row.plantilla || "ALMUNDO_PREMIUM") as PresupuestoPlantilla,
    estado: String(row.estado || "BORRADOR") as PresupuestoEstado,
    origen_carga: String(row.origen_carga || "MANUAL") as PresupuestoOrigenCarga,
    cliente_id: (row.cliente_id as string | null) || null,
    contacto_id: (row.contacto_id as string | null) || null,
    lead_id: (row.lead_id as string | null) || null,
    carrito_id: (row.carrito_id as string | null) || null,
    cliente_nombre: (row.cliente_nombre as string | null) || null,
    cliente_telefono: (row.cliente_telefono as string | null) || null,
    cliente_email: (row.cliente_email as string | null) || null,
    titulo: (row.titulo as string | null) || null,
    destino_principal: (row.destino_principal as string | null) || null,
    destino_detalle: (row.destino_detalle as string | null) || null,
    origen_ciudad: (row.origen_ciudad as string | null) || null,
    origen_iata: (row.origen_iata as string | null) || null,
    destino_ciudad: (row.destino_ciudad as string | null) || null,
    destino_iata: (row.destino_iata as string | null) || null,
    fecha_salida: (row.fecha_salida as string | null) || null,
    fecha_regreso: (row.fecha_regreso as string | null) || null,
    noches: normalizeNumber(row.noches),
    adultos: Number(row.adultos || 1),
    menores: Number(row.menores || 0),
    edades_menores: (row.edades_menores as string | null) || null,
    pasajeros_detalle: (row.pasajeros_detalle as string | null) || null,
    vendedor_id: (row.vendedor_id as string | null) || null,
    sucursal_id: (row.sucursal_id as string | null) || null,
    validez_hasta: (row.validez_hasta as string | null) || null,
    moneda_principal: String(row.moneda_principal || "USD") as PresupuestoMoneda,
    observaciones_internas: (row.observaciones_internas as string | null) || null,
    intro_comercial: (row.intro_comercial as string | null) || null,
    condiciones_generales: (row.condiciones_generales as string | null) || null,
    footer_text: String(row.footer_text || DEFAULT_FOOTER),
    opcion_recomendada_id: (row.opcion_recomendada_id as string | null) || null,
    html_preview: (row.html_preview as string | null) || null,
    pdf_url: (row.pdf_url as string | null) || null,
    pdf_path: (row.pdf_path as string | null) || null,
    pdf_generado_at: (row.pdf_generado_at as string | null) || null,
    enviado_at: (row.enviado_at as string | null) || null,
    enviado_por: (row.enviado_por as string | null) || null,
    aceptado_at: (row.aceptado_at as string | null) || null,
    rechazado_at: (row.rechazado_at as string | null) || null,
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    updated_by: (row.updated_by as string | null) || null,
    created_at: String(row.created_at || getNowIso()),
    updated_at: String(row.updated_at || getNowIso())
  };
}

function normalizeVuelo(row: Record<string, unknown>): PresupuestoVuelo {
  return {
    id: String(row.id),
    presupuesto_id: String(row.presupuesto_id),
    orden: Number(row.orden || 1),
    titulo: String(row.titulo || "Opción de vuelo"),
    aerolinea: (row.aerolinea as string | null) || null,
    codigo_reserva: (row.codigo_reserva as string | null) || null,
    ruta_resumen: (row.ruta_resumen as string | null) || null,
    ida_origen: (row.ida_origen as string | null) || null,
    ida_destino: (row.ida_destino as string | null) || null,
    ida_fecha: (row.ida_fecha as string | null) || null,
    ida_hora_salida: (row.ida_hora_salida as string | null) || null,
    ida_hora_llegada: (row.ida_hora_llegada as string | null) || null,
    ida_escalas: (row.ida_escalas as string | null) || null,
    ida_detalle: (row.ida_detalle as string | null) || null,
    vuelta_origen: (row.vuelta_origen as string | null) || null,
    vuelta_destino: (row.vuelta_destino as string | null) || null,
    vuelta_fecha: (row.vuelta_fecha as string | null) || null,
    vuelta_hora_salida: (row.vuelta_hora_salida as string | null) || null,
    vuelta_hora_llegada: (row.vuelta_hora_llegada as string | null) || null,
    vuelta_escalas: (row.vuelta_escalas as string | null) || null,
    vuelta_detalle: (row.vuelta_detalle as string | null) || null,
    equipaje: (row.equipaje as string | null) || null,
    tarifa_familia: (row.tarifa_familia as string | null) || null,
    condiciones: (row.condiciones as string | null) || null,
    precio_total: normalizeNumber(row.precio_total),
    moneda: String(row.moneda || "USD"),
    incluir_en_pdf: normalizeBoolean(row.incluir_en_pdf, true),
    es_principal: normalizeBoolean(row.es_principal),
    captura_url: (row.captura_url as string | null) || null,
    captura_path: (row.captura_path as string | null) || null,
    raw_text: (row.raw_text as string | null) || null,
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    updated_by: (row.updated_by as string | null) || null,
    created_at: String(row.created_at || getNowIso()),
    updated_at: String(row.updated_at || getNowIso())
  };
}

function normalizeHotel(row: Record<string, unknown>): PresupuestoHotel {
  return {
    id: String(row.id),
    presupuesto_id: String(row.presupuesto_id),
    hotel_id: (row.hotel_id as string | null) || null,
    orden: Number(row.orden || 1),
    titulo: String(row.titulo || "Opción de hotel"),
    nombre: String(row.nombre || "Hotel"),
    destino: (row.destino as string | null) || null,
    zona: (row.zona as string | null) || null,
    categoria: (row.categoria as string | null) || null,
    regimen: (row.regimen as string | null) || null,
    habitacion: (row.habitacion as string | null) || null,
    ocupacion: (row.ocupacion as string | null) || null,
    check_in: (row.check_in as string | null) || null,
    check_out: (row.check_out as string | null) || null,
    noches: normalizeNumber(row.noches),
    descripcion: (row.descripcion as string | null) || null,
    beneficios: (row.beneficios as string | null) || null,
    condiciones: (row.condiciones as string | null) || null,
    politica_cancelacion: (row.politica_cancelacion as string | null) || null,
    imagen_url: (row.imagen_url as string | null) || null,
    captura_url: (row.captura_url as string | null) || null,
    captura_path: (row.captura_path as string | null) || null,
    precio_total: normalizeNumber(row.precio_total),
    moneda: String(row.moneda || "USD"),
    incluir_en_pdf: normalizeBoolean(row.incluir_en_pdf, true),
    es_principal: normalizeBoolean(row.es_principal),
    raw_text: (row.raw_text as string | null) || null,
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    updated_by: (row.updated_by as string | null) || null,
    created_at: String(row.created_at || getNowIso()),
    updated_at: String(row.updated_at || getNowIso())
  };
}

function normalizeServicio(row: Record<string, unknown>): PresupuestoServicio {
  return {
    id: String(row.id),
    presupuesto_id: String(row.presupuesto_id),
    orden: Number(row.orden || 1),
    tipo: String(row.tipo || "OTRO") as PresupuestoServicioTipo,
    nombre: String(row.nombre || "Servicio"),
    descripcion: (row.descripcion as string | null) || null,
    incluido: normalizeBoolean(row.incluido, true),
    opcional: normalizeBoolean(row.opcional),
    precio_total: normalizeNumber(row.precio_total),
    moneda: String(row.moneda || "USD"),
    incluir_en_pdf: normalizeBoolean(row.incluir_en_pdf, true),
    raw_text: (row.raw_text as string | null) || null,
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    updated_by: (row.updated_by as string | null) || null,
    created_at: String(row.created_at || getNowIso()),
    updated_at: String(row.updated_at || getNowIso())
  };
}

function normalizeCombinacion(row: Record<string, unknown>): PresupuestoCombinacion {
  return {
    id: String(row.id),
    presupuesto_id: String(row.presupuesto_id),
    orden: Number(row.orden || 1),
    nombre: String(row.nombre || "Opción"),
    subtitulo: (row.subtitulo as string | null) || null,
    descripcion: (row.descripcion as string | null) || null,
    destacada: normalizeBoolean(row.destacada),
    etiqueta: (row.etiqueta as string | null) || null,
    vuelo_id: (row.vuelo_id as string | null) || null,
    hotel_id: (row.hotel_id as string | null) || null,
    precio_total: Number(row.precio_total || 0),
    moneda: String(row.moneda || "USD"),
    precio_contado: normalizeNumber(row.precio_contado),
    precio_transferencia: normalizeNumber(row.precio_transferencia),
    precio_tarjeta: normalizeNumber(row.precio_tarjeta),
    precio_financiado: normalizeNumber(row.precio_financiado),
    seña: normalizeNumber(row.seña),
    saldo: normalizeNumber(row.saldo),
    forma_pago_resumen: (row.forma_pago_resumen as string | null) || null,
    condiciones_pago: (row.condiciones_pago as string | null) || null,
    incluye_resumen: (row.incluye_resumen as string | null) || null,
    no_incluye_resumen: (row.no_incluye_resumen as string | null) || null,
    notas: (row.notas as string | null) || null,
    visible_en_pdf: normalizeBoolean(row.visible_en_pdf, true),
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    updated_by: (row.updated_by as string | null) || null,
    created_at: String(row.created_at || getNowIso()),
    updated_at: String(row.updated_at || getNowIso())
  };
}

function normalizeCombinacionItem(row: Record<string, unknown>): PresupuestoCombinacionItem {
  return {
    id: String(row.id),
    combinacion_id: String(row.combinacion_id),
    presupuesto_id: String(row.presupuesto_id),
    orden: Number(row.orden || 1),
    item_tipo: String(row.item_tipo || "OTRO") as PresupuestoCombinacionItemTipo,
    vuelo_id: (row.vuelo_id as string | null) || null,
    hotel_id: (row.hotel_id as string | null) || null,
    servicio_id: (row.servicio_id as string | null) || null,
    titulo: (row.titulo as string | null) || null,
    descripcion: (row.descripcion as string | null) || null,
    precio: normalizeNumber(row.precio),
    moneda: (row.moneda as string | null) || null,
    metadata: normalizeRecord(row.metadata),
    created_at: String(row.created_at || getNowIso())
  };
}

function normalizeAdjunto(row: Record<string, unknown>): PresupuestoAdjunto {
  return {
    id: String(row.id),
    presupuesto_id: String(row.presupuesto_id),
    entidad_tipo: String(row.entidad_tipo || "PRESUPUESTO") as PresupuestoAdjuntoEntidadTipo,
    entidad_id: (row.entidad_id as string | null) || null,
    tipo: String(row.tipo || "CAPTURA") as PresupuestoAdjuntoTipo,
    titulo: (row.titulo as string | null) || null,
    descripcion: (row.descripcion as string | null) || null,
    file_url: String(row.file_url || ""),
    file_path: (row.file_path as string | null) || null,
    file_name: (row.file_name as string | null) || null,
    file_mime_type: (row.file_mime_type as string | null) || null,
    file_size: row.file_size === null || row.file_size === undefined ? null : Number(row.file_size),
    incluir_en_pdf: normalizeBoolean(row.incluir_en_pdf),
    orden: Number(row.orden || 1),
    metadata: normalizeRecord(row.metadata),
    created_by: (row.created_by as string | null) || null,
    created_at: String(row.created_at || getNowIso())
  };
}

/* =========================================================
   PAYLOAD HELPERS
========================================================= */

function cleanUndefined(payload: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};

  Object.entries(payload).forEach(([key, value]) => {
    if (value !== undefined) {
      next[key] = value;
    }
  });

  return next;
}

function buildPresupuestoUpdatePayload(
  draft: UpdatePresupuestoV2Draft,
  currentUserId: string | null
): Record<string, unknown> {
  const noches =
    draft.fecha_salida !== undefined || draft.fecha_regreso !== undefined
      ? calculateNoches(draft.fecha_salida, draft.fecha_regreso)
      : undefined;

  const adultos = draft.adultos === undefined ? undefined : Number(draft.adultos || 1);
  const menores = draft.menores === undefined ? undefined : Number(draft.menores || 0);

  const pasajerosDetalle =
    adultos !== undefined || menores !== undefined || draft.edades_menores !== undefined
      ? buildPasajerosDetalle(adultos || 1, menores || 0, draft.edades_menores)
      : undefined;

  return cleanUndefined({
    marca: draft.marca,
    plantilla: draft.plantilla,
    estado: draft.estado,
    origen_carga: draft.origen_carga,
    cliente_id: draft.cliente_id,
    contacto_id: draft.contacto_id,
    lead_id: draft.lead_id,
    carrito_id: draft.carrito_id,
    cliente_nombre: draft.cliente_nombre === "" ? null : draft.cliente_nombre,
    cliente_telefono: draft.cliente_telefono === "" ? null : draft.cliente_telefono,
    cliente_email: draft.cliente_email === "" ? null : draft.cliente_email,
    titulo: draft.titulo === "" ? null : draft.titulo,
    destino_principal: draft.destino_principal === "" ? null : draft.destino_principal,
    destino_detalle: draft.destino_detalle === "" ? null : draft.destino_detalle,
    origen_ciudad: draft.origen_ciudad === "" ? null : draft.origen_ciudad,
    origen_iata: draft.origen_iata === "" ? null : draft.origen_iata,
    destino_ciudad: draft.destino_ciudad === "" ? null : draft.destino_ciudad,
    destino_iata: draft.destino_iata === "" ? null : draft.destino_iata,
    fecha_salida: draft.fecha_salida === "" ? null : draft.fecha_salida,
    fecha_regreso: draft.fecha_regreso === "" ? null : draft.fecha_regreso,
    noches,
    adultos,
    menores,
    edades_menores: draft.edades_menores === "" ? null : draft.edades_menores,
    pasajeros_detalle: pasajerosDetalle,
    vendedor_id: draft.vendedor_id,
    sucursal_id: draft.sucursal_id,
    validez_hasta: draft.validez_hasta,
    moneda_principal: draft.moneda_principal,
    observaciones_internas:
      draft.observaciones_internas === "" ? null : draft.observaciones_internas,
    intro_comercial: draft.intro_comercial === "" ? null : draft.intro_comercial,
    condiciones_generales:
      draft.condiciones_generales === "" ? null : draft.condiciones_generales,
    footer_text: draft.footer_text,
    opcion_recomendada_id: draft.opcion_recomendada_id,
    html_preview: draft.html_preview,
    pdf_url: draft.pdf_url,
    pdf_path: draft.pdf_path,
    pdf_generado_at: draft.pdf_generado_at,
    enviado_at: draft.enviado_at,
    enviado_por: draft.enviado_por,
    aceptado_at: draft.aceptado_at,
    rechazado_at: draft.rechazado_at,
    metadata: draft.metadata,
    updated_by: currentUserId,
    updated_at: getNowIso()
  });
}

/* =========================================================
   STORE
========================================================= */

export const usePresupuestosV2Store = create<PresupuestosV2State>((set, get) => ({
  loading: false,
  loadingDetail: false,
  saving: false,
  uploading: false,
  processingIa: false,
  searchingCliente: false,
  error: null,

  presupuestos: [],
  selectedPresupuestoId: null,

  presupuesto: null,
  vuelos: [],
  hoteles: [],
  servicios: [],
  combinaciones: [],
  combinacionItems: [],
  adjuntos: [],

    currentProfile: null,
  vendedores: [],
  sucursales: [],

  clienteDetectado: null,
  aiPreview: null,

  filters: getDefaultFilters(),

  /* =========================================================
     LOAD LIST
  ========================================================= */

  loadPresupuestos: async (silent = false) => {
    if (!silent) {
      set({ loading: true, error: null });
    } else {
      set({ error: null });
    }

    const res = await supabase
      .from("v_presupuestos_v2_resumen")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);

    if (res.error) {
      set({
        loading: false,
        error: normalizeError(res.error)
      });
      return;
    }

    const presupuestos = ((res.data || []) as Record<string, unknown>[]).map(normalizeResumen);

    const currentSelectedId = get().selectedPresupuestoId;

    const nextSelectedId =
      currentSelectedId && presupuestos.some((item) => item.id === currentSelectedId)
        ? currentSelectedId
        : presupuestos[0]?.id || null;

    set({
      loading: false,
      presupuestos,
      selectedPresupuestoId: nextSelectedId
    });

    if (!silent && nextSelectedId) {
      await get().loadPresupuestoFull(nextSelectedId, true);
    }
  },

  /* =========================================================
     LOAD DETAIL
  ========================================================= */

  loadPresupuestoFull: async (presupuestoId, silent = false) => {
    const targetId = presupuestoId || get().selectedPresupuestoId;

    if (!targetId) {
      set({
        presupuesto: null,
        vuelos: [],
        hoteles: [],
        servicios: [],
        combinaciones: [],
        combinacionItems: [],
        adjuntos: [],
        loadingDetail: false
      });
      return;
    }

    if (!silent) {
      set({ loadingDetail: true, error: null });
    } else {
      set({ error: null });
    }

    const [
      presupuestoRes,
      vuelosRes,
      hotelesRes,
      serviciosRes,
      combinacionesRes,
      itemsRes,
      adjuntosRes
    ] = await Promise.all([
      supabase.from("presupuestos_v2").select("*").eq("id", targetId).maybeSingle(),

      supabase
        .from("presupuesto_vuelos")
        .select("*")
        .eq("presupuesto_id", targetId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("presupuesto_hoteles")
        .select("*")
        .eq("presupuesto_id", targetId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("presupuesto_servicios")
        .select("*")
        .eq("presupuesto_id", targetId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("presupuesto_combinaciones")
        .select("*")
        .eq("presupuesto_id", targetId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("presupuesto_combinacion_items")
        .select("*")
        .eq("presupuesto_id", targetId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true }),

      supabase
        .from("presupuesto_adjuntos")
        .select("*")
        .eq("presupuesto_id", targetId)
        .order("orden", { ascending: true })
        .order("created_at", { ascending: true })
    ]);

    const firstError =
      presupuestoRes.error ||
      vuelosRes.error ||
      hotelesRes.error ||
      serviciosRes.error ||
      combinacionesRes.error ||
      itemsRes.error ||
      adjuntosRes.error;

    if (firstError) {
      set({
        loadingDetail: false,
        error: normalizeError(firstError)
      });
      return;
    }

    set({
      loadingDetail: false,
      selectedPresupuestoId: targetId,
      presupuesto: presupuestoRes.data
        ? normalizePresupuesto(presupuestoRes.data as Record<string, unknown>)
        : null,
      vuelos: ((vuelosRes.data || []) as Record<string, unknown>[]).map(normalizeVuelo),
      hoteles: ((hotelesRes.data || []) as Record<string, unknown>[]).map(normalizeHotel),
      servicios: ((serviciosRes.data || []) as Record<string, unknown>[]).map(normalizeServicio),
      combinaciones: ((combinacionesRes.data || []) as Record<string, unknown>[]).map(
        normalizeCombinacion
      ),
      combinacionItems: ((itemsRes.data || []) as Record<string, unknown>[]).map(
        normalizeCombinacionItem
      ),
      adjuntos: ((adjuntosRes.data || []) as Record<string, unknown>[]).map(normalizeAdjunto)
    });
  },

  /* =========================================================
     LOAD CATALOGS
  ========================================================= */

  loadCatalogs: async () => {
    const currentUserId = await getCurrentUserId();

    const [vendedoresRes, sucursalesRes] = await Promise.all([
      supabase
        .from("profiles")
        .select("id,nombre,apellido,email,sucursal_id,rol,activo,is_super_admin,is_support_user")
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase.from("sucursales").select("*").order("nombre", { ascending: true })
    ]);

    const firstError = vendedoresRes.error || sucursalesRes.error;

    if (firstError) {
      set({ error: normalizeError(firstError) });
      return;
    }

    const vendedores = (vendedoresRes.data || []) as ProfileLite[];
    const currentProfile =
      vendedores.find((profile) => profile.id === currentUserId) || null;

    set((state) => {
      const shouldApplySellerDefault =
        isSellerProfile(currentProfile) &&
        currentProfile?.id &&
        state.filters.vendedorId === "todos";

      return {
        currentProfile,
        vendedores,
        sucursales: filtrarSucursalesActivas((sucursalesRes.data || []) as SucursalLite[]),
        filters: shouldApplySellerDefault
          ? {
              ...state.filters,
              vendedorId: currentProfile.id
            }
          : state.filters
      };
    });
  },

  /* =========================================================
     CREATE / UPDATE / DELETE PRESUPUESTO
  ========================================================= */

  createPresupuesto: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    const adultos = Number(draft.adultos || 1);
    const menores = Number(draft.menores || 0);

    const insertPayload = {
      cliente_nombre: nullableText(draft.cliente_nombre),
      cliente_telefono: nullableText(draft.cliente_telefono),
      cliente_email: nullableText(draft.cliente_email),
      destino_principal: nullableText(draft.destino_principal),
      fecha_salida: draft.fecha_salida || null,
      fecha_regreso: draft.fecha_regreso || null,
      noches: calculateNoches(draft.fecha_salida, draft.fecha_regreso),
      adultos,
      menores,
      edades_menores: nullableText(draft.edades_menores),
      pasajeros_detalle: buildPasajerosDetalle(adultos, menores, draft.edades_menores),
      vendedor_id: draft.vendedor_id || currentUserId,
      sucursal_id: draft.sucursal_id || null,
      marca: "ALMUNDO",
      plantilla: "ALMUNDO_PREMIUM",
      estado: "BORRADOR",
      origen_carga: "MANUAL",
      moneda_principal: "USD",
      footer_text: DEFAULT_FOOTER,
      metadata: {},
      created_by: currentUserId,
      updated_by: currentUserId
    };

    const res = await supabase
      .from("presupuestos_v2")
      .insert(insertPayload)
      .select("id")
      .single();

    if (res.error) {
      set({
        saving: false,
        error: normalizeError(res.error)
      });
      return null;
    }

    const id = res.data.id as string;

    await get().loadPresupuestos(true);
    await get().loadPresupuestoFull(id, true);

    set({
      saving: false,
      selectedPresupuestoId: id,
      aiPreview: null
    });

    return id;
  },

  updatePresupuesto: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const payload = buildPresupuestoUpdatePayload(draft, currentUserId);

    const { error } = await supabase.from("presupuestos_v2").update(payload).eq("id", draft.id);

    if (error) {
      set({
        saving: false,
        error: normalizeError(error)
      });
      return false;
    }

    await Promise.all([get().loadPresupuestoFull(draft.id, true), get().loadPresupuestos(true)]);

    set({ saving: false });

    return true;
  },

  deletePresupuesto: async (presupuestoId) => {
    set({ saving: true, error: null });

    const { error } = await supabase.from("presupuestos_v2").delete().eq("id", presupuestoId);

    if (error) {
      set({
        saving: false,
        error: normalizeError(error)
      });
      return false;
    }

    const nextSelectedId =
      get().selectedPresupuestoId === presupuestoId ? null : get().selectedPresupuestoId;

    set({
      selectedPresupuestoId: nextSelectedId,
      presupuesto: nextSelectedId ? get().presupuesto : null,
      vuelos: nextSelectedId ? get().vuelos : [],
      hoteles: nextSelectedId ? get().hoteles : [],
      servicios: nextSelectedId ? get().servicios : [],
      combinaciones: nextSelectedId ? get().combinaciones : [],
      combinacionItems: nextSelectedId ? get().combinacionItems : [],
      adjuntos: nextSelectedId ? get().adjuntos : [],
      aiPreview: null
    });

    await get().loadPresupuestos(true);

    set({ saving: false });

    return true;
  },

  /* =========================================================
     VUELOS
  ========================================================= */

addVuelo: async (draft) => {
  set({ saving: true, error: null });

  const currentUserId = await getCurrentUserId();

  const metadata = mergeMetadata(draft.metadata, {
    mostrar_precio_en_pdf: Boolean(draft.metadata?.mostrar_precio_en_pdf)
  });

  const payload = cleanUndefined({
    presupuesto_id: draft.presupuesto_id,
    orden: draft.orden || get().vuelos.length + 1,
    titulo: cleanText(draft.titulo) || `Vuelo ${get().vuelos.length + 1}`,
    aerolinea: nullableText(draft.aerolinea),
    codigo_reserva: nullableText(draft.codigo_reserva),
    ruta_resumen: nullableText(draft.ruta_resumen),

    ida_origen: nullableText(draft.ida_origen),
    ida_destino: nullableText(draft.ida_destino),
    ida_fecha: draft.ida_fecha || null,
    ida_hora_salida: nullableText(draft.ida_hora_salida),
    ida_hora_llegada: nullableText(draft.ida_hora_llegada),
    ida_escalas: nullableText(draft.ida_escalas),
    ida_detalle: nullableText(draft.ida_detalle),

    vuelta_origen: nullableText(draft.vuelta_origen),
    vuelta_destino: nullableText(draft.vuelta_destino),
    vuelta_fecha: draft.vuelta_fecha || null,
    vuelta_hora_salida: nullableText(draft.vuelta_hora_salida),
    vuelta_hora_llegada: nullableText(draft.vuelta_hora_llegada),
    vuelta_escalas: nullableText(draft.vuelta_escalas),
    vuelta_detalle: nullableText(draft.vuelta_detalle),

    equipaje: nullableText(draft.equipaje),
    tarifa_familia: nullableText(draft.tarifa_familia),
    condiciones: nullableText(draft.condiciones),
    precio_total: draft.precio_total ?? null,
    moneda: draft.moneda || get().presupuesto?.moneda_principal || "USD",
    incluir_en_pdf: draft.incluir_en_pdf ?? true,
    es_principal: draft.es_principal ?? get().vuelos.length === 0,
    captura_url: draft.captura_url || null,
    captura_path: draft.captura_path || null,
    raw_text: draft.raw_text || null,
    metadata,
    created_by: currentUserId,
    updated_by: currentUserId
  });

  const res = await supabase.from("presupuesto_vuelos").insert(payload).select("id").single();

  if (res.error) {
    set({ saving: false, error: normalizeError(res.error) });
    return null;
  }

  await get().loadPresupuestoFull(draft.presupuesto_id, true);
  await get().loadPresupuestos(true);

  set({ saving: false });

  return res.data.id as string;
},

  updateVuelo: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const currentVuelo = get().vuelos.find((item) => item.id === draft.id);

    const payload = cleanUndefined({
      orden: draft.orden,
      titulo: draft.titulo,
      aerolinea: draft.aerolinea === "" ? null : draft.aerolinea,
      codigo_reserva: draft.codigo_reserva === "" ? null : draft.codigo_reserva,
      ruta_resumen: draft.ruta_resumen === "" ? null : draft.ruta_resumen,
      ida_origen: draft.ida_origen === "" ? null : draft.ida_origen,
      ida_destino: draft.ida_destino === "" ? null : draft.ida_destino,
      ida_fecha: draft.ida_fecha === "" ? null : draft.ida_fecha,
      ida_hora_salida: draft.ida_hora_salida === "" ? null : draft.ida_hora_salida,
      ida_hora_llegada: draft.ida_hora_llegada === "" ? null : draft.ida_hora_llegada,
      ida_escalas: draft.ida_escalas === "" ? null : draft.ida_escalas,
      ida_detalle: draft.ida_detalle === "" ? null : draft.ida_detalle,
      vuelta_origen: draft.vuelta_origen === "" ? null : draft.vuelta_origen,
      vuelta_destino: draft.vuelta_destino === "" ? null : draft.vuelta_destino,
      vuelta_fecha: draft.vuelta_fecha === "" ? null : draft.vuelta_fecha,
      vuelta_hora_salida: draft.vuelta_hora_salida === "" ? null : draft.vuelta_hora_salida,
      vuelta_hora_llegada: draft.vuelta_hora_llegada === "" ? null : draft.vuelta_hora_llegada,
      vuelta_escalas: draft.vuelta_escalas === "" ? null : draft.vuelta_escalas,
      vuelta_detalle: draft.vuelta_detalle === "" ? null : draft.vuelta_detalle,
      equipaje: draft.equipaje === "" ? null : draft.equipaje,
      tarifa_familia: draft.tarifa_familia === "" ? null : draft.tarifa_familia,
      condiciones: draft.condiciones === "" ? null : draft.condiciones,
      precio_total: draft.precio_total,
      moneda: draft.moneda,
      incluir_en_pdf: draft.incluir_en_pdf,
      es_principal: draft.es_principal,
      captura_url: draft.captura_url,
      captura_path: draft.captura_path,
      raw_text: draft.raw_text,
      metadata:
        draft.metadata !== undefined
          ? mergeMetadata(currentVuelo?.metadata, draft.metadata)
          : undefined,
      updated_by: currentUserId,
      updated_at: getNowIso()
    });

    const { error } = await supabase.from("presupuesto_vuelos").update(payload).eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const presupuestoId = currentVuelo?.presupuesto_id || get().selectedPresupuestoId;

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  deleteVuelo: async (vueloId) => {
    set({ saving: true, error: null });

    const presupuestoId =
      get().vuelos.find((item) => item.id === vueloId)?.presupuesto_id ||
      get().selectedPresupuestoId;

    const { error } = await supabase.from("presupuesto_vuelos").delete().eq("id", vueloId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  setVueloPrincipal: async (vueloId) => {
    set({ saving: true, error: null });

    const vuelo = get().vuelos.find((item) => item.id === vueloId);

    if (!vuelo) {
      set({ saving: false, error: "No se encontró el vuelo." });
      return false;
    }

    const clearRes = await supabase
      .from("presupuesto_vuelos")
      .update({ es_principal: false })
      .eq("presupuesto_id", vuelo.presupuesto_id);

    if (clearRes.error) {
      set({ saving: false, error: normalizeError(clearRes.error) });
      return false;
    }

    const setRes = await supabase
      .from("presupuesto_vuelos")
      .update({ es_principal: true })
      .eq("id", vueloId);

    if (setRes.error) {
      set({ saving: false, error: normalizeError(setRes.error) });
      return false;
    }

    await get().loadPresupuestoFull(vuelo.presupuesto_id, true);

    set({ saving: false });

    return true;
  },

  /* =========================================================
     HOTELES
  ========================================================= */

  addHotel: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!cleanText(draft.nombre)) {
      set({ saving: false, error: "El hotel necesita nombre." });
      return null;
    }

    const payload = cleanUndefined({
      presupuesto_id: draft.presupuesto_id,
      hotel_id: draft.hotel_id || null,
      orden: draft.orden || get().hoteles.length + 1,
      titulo: cleanText(draft.titulo) || `Hotel ${get().hoteles.length + 1}`,
      nombre: cleanText(draft.nombre),
      destino: nullableText(draft.destino),
      zona: nullableText(draft.zona),
      categoria: nullableText(draft.categoria),
      regimen: nullableText(draft.regimen),
      habitacion: nullableText(draft.habitacion),
      ocupacion: nullableText(draft.ocupacion),
      check_in: draft.check_in || null,
      check_out: draft.check_out || null,
      noches: draft.noches ?? calculateNoches(draft.check_in, draft.check_out),
      descripcion: nullableText(draft.descripcion),
      beneficios: nullableText(draft.beneficios),
      condiciones: nullableText(draft.condiciones),
      politica_cancelacion: nullableText(draft.politica_cancelacion),
      imagen_url: draft.imagen_url || null,
      captura_url: draft.captura_url || null,
      captura_path: draft.captura_path || null,
      precio_total: draft.precio_total ?? null,
      moneda: draft.moneda || get().presupuesto?.moneda_principal || "USD",
      incluir_en_pdf: draft.incluir_en_pdf ?? true,
      es_principal: draft.es_principal ?? get().hoteles.length === 0,
      raw_text: draft.raw_text || null,
      metadata: mergeMetadata(draft.metadata, {
        mostrar_precio_en_pdf: Boolean(draft.metadata?.mostrar_precio_en_pdf)
      }),
      created_by: currentUserId,
      updated_by: currentUserId
    });

    const res = await supabase.from("presupuesto_hoteles").insert(payload).select("id").single();

    if (res.error) {
      set({ saving: false, error: normalizeError(res.error) });
      return null;
    }

    await get().loadPresupuestoFull(draft.presupuesto_id, true);
    await get().loadPresupuestos(true);

    set({ saving: false });

    return res.data.id as string;
  },

  updateHotel: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const currentHotel = get().hoteles.find((item) => item.id === draft.id);

    const noches =
      draft.check_in !== undefined || draft.check_out !== undefined
        ? calculateNoches(draft.check_in, draft.check_out)
        : draft.noches;

    const payload = cleanUndefined({
      hotel_id: draft.hotel_id,
      orden: draft.orden,
      titulo: draft.titulo,
      nombre: draft.nombre,
      destino: draft.destino === "" ? null : draft.destino,
      zona: draft.zona === "" ? null : draft.zona,
      categoria: draft.categoria === "" ? null : draft.categoria,
      regimen: draft.regimen === "" ? null : draft.regimen,
      habitacion: draft.habitacion === "" ? null : draft.habitacion,
      ocupacion: draft.ocupacion === "" ? null : draft.ocupacion,
      check_in: draft.check_in === "" ? null : draft.check_in,
      check_out: draft.check_out === "" ? null : draft.check_out,
      noches,
      descripcion: draft.descripcion === "" ? null : draft.descripcion,
      beneficios: draft.beneficios === "" ? null : draft.beneficios,
      condiciones: draft.condiciones === "" ? null : draft.condiciones,
      politica_cancelacion:
        draft.politica_cancelacion === "" ? null : draft.politica_cancelacion,
      imagen_url: draft.imagen_url === "" ? null : draft.imagen_url,
      captura_url: draft.captura_url === "" ? null : draft.captura_url,
      captura_path: draft.captura_path === "" ? null : draft.captura_path,
      precio_total: draft.precio_total,
      moneda: draft.moneda,
      incluir_en_pdf: draft.incluir_en_pdf,
      es_principal: draft.es_principal,
      raw_text: draft.raw_text,
      metadata:
        draft.metadata !== undefined
          ? mergeMetadata(currentHotel?.metadata, draft.metadata)
          : undefined,
      updated_by: currentUserId,
      updated_at: getNowIso()
    });

    const { error } = await supabase.from("presupuesto_hoteles").update(payload).eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const presupuestoId = currentHotel?.presupuesto_id || get().selectedPresupuestoId;

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  deleteHotel: async (hotelId) => {
    set({ saving: true, error: null });

    const presupuestoId =
      get().hoteles.find((item) => item.id === hotelId)?.presupuesto_id ||
      get().selectedPresupuestoId;

    const { error } = await supabase.from("presupuesto_hoteles").delete().eq("id", hotelId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  setHotelPrincipal: async (hotelId) => {
    set({ saving: true, error: null });

    const hotel = get().hoteles.find((item) => item.id === hotelId);

    if (!hotel) {
      set({ saving: false, error: "No se encontró el hotel." });
      return false;
    }

    const clearRes = await supabase
      .from("presupuesto_hoteles")
      .update({ es_principal: false })
      .eq("presupuesto_id", hotel.presupuesto_id);

    if (clearRes.error) {
      set({ saving: false, error: normalizeError(clearRes.error) });
      return false;
    }

    const setRes = await supabase
      .from("presupuesto_hoteles")
      .update({ es_principal: true })
      .eq("id", hotelId);

    if (setRes.error) {
      set({ saving: false, error: normalizeError(setRes.error) });
      return false;
    }

    await get().loadPresupuestoFull(hotel.presupuesto_id, true);

    set({ saving: false });

    return true;
  },

  /* =========================================================
     SERVICIOS
  ========================================================= */

  addServicio: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!cleanText(draft.nombre)) {
      set({ saving: false, error: "El servicio necesita nombre." });
      return null;
    }

    const payload = cleanUndefined({
      presupuesto_id: draft.presupuesto_id,
      orden: draft.orden || get().servicios.length + 1,
      tipo: draft.tipo || "OTRO",
      nombre: cleanText(draft.nombre),
      descripcion: nullableText(draft.descripcion),
      incluido: draft.incluido ?? true,
      opcional: draft.opcional ?? false,
      precio_total: draft.precio_total ?? null,
      moneda: draft.moneda || get().presupuesto?.moneda_principal || "USD",
      incluir_en_pdf: draft.incluir_en_pdf ?? true,
      raw_text: draft.raw_text || null,
      metadata: mergeMetadata(draft.metadata, {
        mostrar_precio_en_pdf: Boolean(draft.metadata?.mostrar_precio_en_pdf)
      }),
      created_by: currentUserId,
      updated_by: currentUserId
    });

    const res = await supabase.from("presupuesto_servicios").insert(payload).select("id").single();

    if (res.error) {
      set({ saving: false, error: normalizeError(res.error) });
      return null;
    }

    await get().loadPresupuestoFull(draft.presupuesto_id, true);
    await get().loadPresupuestos(true);

    set({ saving: false });

    return res.data.id as string;
  },

  updateServicio: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const currentServicio = get().servicios.find((item) => item.id === draft.id);

    const payload = cleanUndefined({
      orden: draft.orden,
      tipo: draft.tipo,
      nombre: draft.nombre,
      descripcion: draft.descripcion === "" ? null : draft.descripcion,
      incluido: draft.incluido,
      opcional: draft.opcional,
      precio_total: draft.precio_total,
      moneda: draft.moneda,
      incluir_en_pdf: draft.incluir_en_pdf,
      raw_text: draft.raw_text,
      metadata:
        draft.metadata !== undefined
          ? mergeMetadata(currentServicio?.metadata, draft.metadata)
          : undefined,
      updated_by: currentUserId,
      updated_at: getNowIso()
    });

    const { error } = await supabase
      .from("presupuesto_servicios")
      .update(payload)
      .eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const presupuestoId = currentServicio?.presupuesto_id || get().selectedPresupuestoId;

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  deleteServicio: async (servicioId) => {
    set({ saving: true, error: null });

    const presupuestoId =
      get().servicios.find((item) => item.id === servicioId)?.presupuesto_id ||
      get().selectedPresupuestoId;

    const { error } = await supabase.from("presupuesto_servicios").delete().eq("id", servicioId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  /* =========================================================
     COMBINACIONES
  ========================================================= */

  addCombinacion: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!cleanText(draft.nombre)) {
      set({ saving: false, error: "La combinación necesita nombre." });
      return null;
    }

    const precioTotal = normalizeNumber(draft.precio_total) || 0;
    const seña = normalizeNumber(draft.seña);
    const saldo = calculateSaldo(precioTotal, seña, draft.saldo);

    const pasajerosCantidad =
      Number(get().presupuesto?.adultos || 0) + Number(get().presupuesto?.menores || 0);

    const precioPorPasajero =
      pasajerosCantidad > 0 && precioTotal > 0 ? precioTotal / pasajerosCantidad : null;

    const payload = cleanUndefined({
      presupuesto_id: draft.presupuesto_id,
      orden: draft.orden || get().combinaciones.length + 1,
      nombre: cleanText(draft.nombre),
      subtitulo: nullableText(draft.subtitulo),
      descripcion: nullableText(draft.descripcion),
      destacada: draft.destacada ?? get().combinaciones.length === 0,
      etiqueta: nullableText(draft.etiqueta),
      vuelo_id: draft.vuelo_id || null,
      hotel_id: draft.hotel_id || null,
      precio_total: precioTotal,
      moneda: draft.moneda || get().presupuesto?.moneda_principal || "USD",
      precio_contado: draft.precio_contado ?? null,
      precio_transferencia: draft.precio_transferencia ?? null,
      precio_tarjeta: draft.precio_tarjeta ?? null,
      precio_financiado: draft.precio_financiado ?? null,
      seña,
      saldo,
      forma_pago_resumen: nullableText(draft.forma_pago_resumen),
      condiciones_pago: nullableText(draft.condiciones_pago),
      incluye_resumen: nullableText(draft.incluye_resumen),
      no_incluye_resumen: nullableText(draft.no_incluye_resumen),
      notas: nullableText(draft.notas),
      visible_en_pdf: draft.visible_en_pdf ?? true,
      metadata: mergeMetadata(draft.metadata, {
        precio_es_total_paquete: true,
        pasajeros_cantidad: pasajerosCantidad,
        precio_por_pasajero: precioPorPasajero
      }),
      created_by: currentUserId,
      updated_by: currentUserId
    });

    const res = await supabase
      .from("presupuesto_combinaciones")
      .insert(payload)
      .select("id")
      .single();

    if (res.error) {
      set({ saving: false, error: normalizeError(res.error) });
      return null;
    }

    const combinacionId = res.data.id as string;

    if (draft.destacada ?? get().combinaciones.length === 0) {
      await supabase
        .from("presupuestos_v2")
        .update({
          opcion_recomendada_id: combinacionId,
          updated_by: currentUserId,
          updated_at: getNowIso()
        })
        .eq("id", draft.presupuesto_id);
    }

    await get().loadPresupuestoFull(draft.presupuesto_id, true);
    await get().loadPresupuestos(true);

    set({ saving: false });

    return combinacionId;
  },

  updateCombinacion: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const currentCombinacion = get().combinaciones.find((item) => item.id === draft.id);

    const precioTotal =
      draft.precio_total !== undefined
        ? normalizeNumber(draft.precio_total) || 0
        : currentCombinacion?.precio_total || 0;

    const seña =
      draft.seña !== undefined ? normalizeNumber(draft.seña) : currentCombinacion?.seña || null;

    const saldo = calculateSaldo(
      precioTotal,
      seña,
      draft.saldo !== undefined ? draft.saldo : currentCombinacion?.saldo
    );

    const pasajerosCantidad =
      Number(get().presupuesto?.adultos || 0) + Number(get().presupuesto?.menores || 0);

    const precioPorPasajero =
      pasajerosCantidad > 0 && precioTotal > 0 ? precioTotal / pasajerosCantidad : null;

    const payload = cleanUndefined({
      orden: draft.orden,
      nombre: draft.nombre,
      subtitulo: draft.subtitulo === "" ? null : draft.subtitulo,
      descripcion: draft.descripcion === "" ? null : draft.descripcion,
      destacada: draft.destacada,
      etiqueta: draft.etiqueta === "" ? null : draft.etiqueta,
      vuelo_id: draft.vuelo_id,
      hotel_id: draft.hotel_id,
      precio_total: draft.precio_total !== undefined ? precioTotal : undefined,
      moneda: draft.moneda,
      precio_contado: draft.precio_contado,
      precio_transferencia: draft.precio_transferencia,
      precio_tarjeta: draft.precio_tarjeta,
      precio_financiado: draft.precio_financiado,
      seña: draft.seña !== undefined ? seña : undefined,
      saldo:
        draft.precio_total !== undefined || draft.seña !== undefined || draft.saldo !== undefined
          ? saldo
          : undefined,
      forma_pago_resumen: draft.forma_pago_resumen === "" ? null : draft.forma_pago_resumen,
      condiciones_pago: draft.condiciones_pago === "" ? null : draft.condiciones_pago,
      incluye_resumen: draft.incluye_resumen === "" ? null : draft.incluye_resumen,
      no_incluye_resumen: draft.no_incluye_resumen === "" ? null : draft.no_incluye_resumen,
      notas: draft.notas === "" ? null : draft.notas,
      visible_en_pdf: draft.visible_en_pdf,
      metadata:
        draft.metadata !== undefined ||
        draft.precio_total !== undefined ||
        draft.seña !== undefined ||
        draft.saldo !== undefined
          ? mergeMetadata(currentCombinacion?.metadata, {
              ...(draft.metadata || {}),
              precio_es_total_paquete: true,
              pasajeros_cantidad: pasajerosCantidad,
              precio_por_pasajero: precioPorPasajero
            })
          : undefined,
      updated_by: currentUserId,
      updated_at: getNowIso()
    });

    const { error } = await supabase
      .from("presupuesto_combinaciones")
      .update(payload)
      .eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const presupuestoId = currentCombinacion?.presupuesto_id || get().selectedPresupuestoId;

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  deleteCombinacion: async (combinacionId) => {
    set({ saving: true, error: null });

    const combinacion = get().combinaciones.find((item) => item.id === combinacionId);
    const presupuestoId = combinacion?.presupuesto_id || get().selectedPresupuestoId;

    const { error } = await supabase
      .from("presupuesto_combinaciones")
      .delete()
      .eq("id", combinacionId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (presupuestoId && get().presupuesto?.opcion_recomendada_id === combinacionId) {
      await supabase
        .from("presupuestos_v2")
        .update({
          opcion_recomendada_id: null,
          updated_at: getNowIso()
        })
        .eq("id", presupuestoId);
    }

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
      await get().loadPresupuestos(true);
    }

    set({ saving: false });

    return true;
  },

  setCombinacionRecomendada: async (combinacionId) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const combinacion = get().combinaciones.find((item) => item.id === combinacionId);

    if (!combinacion) {
      set({ saving: false, error: "No se encontró la combinación." });
      return false;
    }

    const [clearRes, setRes, presupuestoRes] = await Promise.all([
      supabase
        .from("presupuesto_combinaciones")
        .update({ destacada: false })
        .eq("presupuesto_id", combinacion.presupuesto_id),

      supabase
        .from("presupuesto_combinaciones")
        .update({ destacada: true })
        .eq("id", combinacionId),

      supabase
        .from("presupuestos_v2")
        .update({
          opcion_recomendada_id: combinacionId,
          updated_by: currentUserId,
          updated_at: getNowIso()
        })
        .eq("id", combinacion.presupuesto_id)
    ]);

    const firstError = clearRes.error || setRes.error || presupuestoRes.error;

    if (firstError) {
      set({ saving: false, error: normalizeError(firstError) });
      return false;
    }

    await get().loadPresupuestoFull(combinacion.presupuesto_id, true);
    await get().loadPresupuestos(true);

    set({ saving: false });

    return true;
  },

  /* =========================================================
     COMBINACIÓN ITEMS
  ========================================================= */

  addCombinacionItem: async (draft) => {
    set({ saving: true, error: null });

    const payload = cleanUndefined({
      combinacion_id: draft.combinacion_id,
      presupuesto_id: draft.presupuesto_id,
      orden:
        draft.orden ||
        get().combinacionItems.filter((item) => item.combinacion_id === draft.combinacion_id)
          .length + 1,
      item_tipo: draft.item_tipo,
      vuelo_id: draft.vuelo_id || null,
      hotel_id: draft.hotel_id || null,
      servicio_id: draft.servicio_id || null,
      titulo: nullableText(draft.titulo),
      descripcion: nullableText(draft.descripcion),
      precio: draft.precio ?? null,
      moneda: draft.moneda || get().presupuesto?.moneda_principal || null,
      metadata: draft.metadata || {}
    });

    const res = await supabase
      .from("presupuesto_combinacion_items")
      .insert(payload)
      .select("id")
      .single();

    if (res.error) {
      set({ saving: false, error: normalizeError(res.error) });
      return null;
    }

    await get().loadPresupuestoFull(draft.presupuesto_id, true);

    set({ saving: false });

    return res.data.id as string;
  },

  updateCombinacionItem: async (draft) => {
    set({ saving: true, error: null });

    const currentItem = get().combinacionItems.find((item) => item.id === draft.id);

    const payload = cleanUndefined({
      orden: draft.orden,
      item_tipo: draft.item_tipo,
      vuelo_id: draft.vuelo_id,
      hotel_id: draft.hotel_id,
      servicio_id: draft.servicio_id,
      titulo: draft.titulo === "" ? null : draft.titulo,
      descripcion: draft.descripcion === "" ? null : draft.descripcion,
      precio: draft.precio,
      moneda: draft.moneda,
      metadata:
        draft.metadata !== undefined ? mergeMetadata(currentItem?.metadata, draft.metadata) : undefined
    });

    const { error } = await supabase
      .from("presupuesto_combinacion_items")
      .update(payload)
      .eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const presupuestoId = currentItem?.presupuesto_id || get().selectedPresupuestoId;

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
    }

    set({ saving: false });

    return true;
  },

  deleteCombinacionItem: async (itemId) => {
    set({ saving: true, error: null });

    const item = get().combinacionItems.find((current) => current.id === itemId);
    const presupuestoId = item?.presupuesto_id || get().selectedPresupuestoId;

    const { error } = await supabase
      .from("presupuesto_combinacion_items")
      .delete()
      .eq("id", itemId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
    }

    set({ saving: false });

    return true;
  },

  /* =========================================================
     ADJUNTOS
  ========================================================= */

  uploadAdjunto: async (draft) => {
    set({ uploading: true, saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    const extension = getSafeFileExtension(draft.file);
    const fileName = safeFileName(draft.file.name || `archivo.${extension}`);

    const storagePath = `presupuestos-v2/${draft.presupuesto_id}/${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}.${extension}`;

    const uploadRes = await supabase.storage.from("comunicaciones-media").upload(storagePath, draft.file, {
      cacheControl: "3600",
      upsert: false,
      contentType: draft.file.type || undefined
    });

    if (uploadRes.error) {
      set({
        uploading: false,
        saving: false,
        error: normalizeError(uploadRes.error)
      });
      return null;
    }

    const publicRes = supabase.storage.from("comunicaciones-media").getPublicUrl(storagePath);

    const insertRes = await supabase
      .from("presupuesto_adjuntos")
      .insert({
        presupuesto_id: draft.presupuesto_id,
        entidad_tipo: draft.entidad_tipo || "PRESUPUESTO",
        entidad_id: draft.entidad_id || null,
        tipo: draft.tipo || "CAPTURA",
        titulo: nullableText(draft.titulo) || fileName,
        descripcion: nullableText(draft.descripcion),
        file_url: publicRes.data.publicUrl,
        file_path: storagePath,
        file_name: fileName,
        file_mime_type: draft.file.type || null,
        file_size: draft.file.size,
        incluir_en_pdf: draft.incluir_en_pdf || false,
        orden: get().adjuntos.length + 1,
        metadata: {
          source: "presupuestos_v2_store"
        },
        created_by: currentUserId
      })
      .select("id")
      .single();

    if (insertRes.error) {
      set({
        uploading: false,
        saving: false,
        error: normalizeError(insertRes.error)
      });
      return null;
    }

    await get().loadPresupuestoFull(draft.presupuesto_id, true);

    set({
      uploading: false,
      saving: false
    });

    return insertRes.data.id as string;
  },

  deleteAdjunto: async (adjuntoId) => {
    set({ saving: true, error: null });

    const adjunto = get().adjuntos.find((item) => item.id === adjuntoId);
    const presupuestoId = adjunto?.presupuesto_id || get().selectedPresupuestoId;

    if (adjunto?.file_path) {
      await supabase.storage.from("comunicaciones-media").remove([adjunto.file_path]);
    }

    const { error } = await supabase.from("presupuesto_adjuntos").delete().eq("id", adjuntoId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (presupuestoId) {
      await get().loadPresupuestoFull(presupuestoId, true);
    }

    set({ saving: false });

    return true;
  },

  /* =========================================================
     IA PREVIEW
  ========================================================= */

  processPresupuestoIaPreview: async (draft) => {
    const rawText = cleanText(draft.raw_text);

    if (!rawText) {
      set({
        processingIa: false,
        error: "Pegá el texto completo del presupuesto antes de procesar."
      });

      return null;
    }

    set({
      processingIa: true,
      error: null,
      aiPreview: null
    });

    try {
      const { data, error } = await supabase.functions.invoke("presupuestos-ai-parser", {
        body: {
          mode: "TEXT",
          entidad_tipo: "PRESUPUESTO",
          text: rawText,
          caratula: {
            cliente_nombre: draft.presupuesto.cliente_nombre,
            destino_principal: draft.presupuesto.destino_principal,
            destino_detalle: draft.presupuesto.destino_detalle,
            fecha_salida: draft.presupuesto.fecha_salida,
            fecha_regreso: draft.presupuesto.fecha_regreso,
            adultos: draft.presupuesto.adultos,
            menores: draft.presupuesto.menores,
            edades_menores: draft.presupuesto.edades_menores
          }
        }
      });

      if (error) {
        set({
          processingIa: false,
          error: `No se pudo procesar con IA: ${error.message}`
        });

        return null;
      }

      if (!data?.parsed || typeof data.parsed !== "object") {
        set({
          processingIa: false,
          error: "La IA no devolvió información procesable."
        });

        return null;
      }

      const preview = buildIaPreview(rawText, data.parsed as Record<string, unknown>);

      set({
        processingIa: false,
        aiPreview: preview
      });

      return preview;
    } catch (error) {
      set({
        processingIa: false,
        error:
          error instanceof Error
            ? `No se pudo procesar con IA: ${error.message}`
            : "No se pudo procesar con IA."
      });

      return null;
    }
  },

  clearIaPreview: () => {
    set({
      aiPreview: null,
      processingIa: false
    });
  },

  /* =========================================================
     CLIENTE DETECTADO
  ========================================================= */

  searchClienteByTelefono: async (telefono) => {
    const normalized = normalizePhone(telefono);

    if (normalized.length < 6) {
      set({
        clienteDetectado: null,
        searchingCliente: false
      });

      return null;
    }

    set({
      searchingCliente: true,
      clienteDetectado: null
    });

    const attempts: Array<{
      table: "clientes" | "contactos";
      fields: string;
    }> = [
      {
        table: "clientes",
        fields: "id,nombre,apellido,nombre_completo,telefono,email"
      },
      {
        table: "contactos",
        fields: "id,nombre,apellido,nombre_completo,telefono,email"
      }
    ];

    for (const attempt of attempts) {
      const { data, error } = await supabase
        .from(attempt.table)
        .select(attempt.fields)
        .limit(100);

      if (error) {
        continue;
      }

const rows = ((data || []) as unknown) as Array<Record<string, unknown>>;
      const found = rows.find((row) => {
        const phone = normalizePhone(row.telefono);
        return phone && (phone.includes(normalized) || normalized.includes(phone));
      });

      if (found) {
        const nombre =
          cleanText(found.nombre_completo) ||
          `${cleanText(found.nombre)} ${cleanText(found.apellido)}`.trim() ||
          null;

        const cliente: ClienteDetectadoLite = {
          id: String(found.id),
          nombre,
          telefono: cleanText(found.telefono) || null,
          email: cleanText(found.email) || null,
          source: attempt.table
        };

        set({
          searchingCliente: false,
          clienteDetectado: cliente
        });

        return cliente;
      }
    }

    set({
      searchingCliente: false,
      clienteDetectado: null
    });

    return null;
  },

  clearClienteDetectado: () => {
    set({
      clienteDetectado: null,
      searchingCliente: false
    });
  },

  /* =========================================================
     LIVENOS
  ========================================================= */

  sendPresupuestoByLiveNos: async (presupuestoId) => {
    set({ saving: true, error: null });

    await get().loadPresupuestoFull(presupuestoId, true);

    const presupuesto = get().presupuesto;

    if (!presupuesto) {
      set({
        saving: false,
        error: "No se encontró el presupuesto."
      });

      return false;
    }

    if (!presupuesto.pdf_url) {
      set({
        saving: false,
        error: "Primero generá o revisá el PDF antes de enviarlo por LiveNos."
      });

      return false;
    }

    set({ saving: false });

    return true;
  },

  /* =========================================================
     ESTADOS
  ========================================================= */

  markAsSent: async (presupuestoId) => {
    return get().updatePresupuesto({
      id: presupuestoId,
      estado: "ENVIADO",
      enviado_at: getNowIso(),
      enviado_por: await getCurrentUserId()
    });
  },

  markAsAccepted: async (presupuestoId) => {
    return get().updatePresupuesto({
      id: presupuestoId,
      estado: "ACEPTADO",
      aceptado_at: getNowIso()
    });
  },

  markAsRejected: async (presupuestoId) => {
    return get().updatePresupuesto({
      id: presupuestoId,
      estado: "RECHAZADO",
      rechazado_at: getNowIso()
    });
  },

  /* =========================================================
     DUPLICAR PRESUPUESTO
  ========================================================= */

  duplicatePresupuesto: async (presupuestoId) => {
    set({ saving: true, error: null });

    await get().loadPresupuestoFull(presupuestoId, true);

    const { presupuesto, vuelos, hoteles, servicios, combinaciones, combinacionItems, adjuntos } =
      get();

    if (!presupuesto) {
      set({ saving: false, error: "No se encontró el presupuesto para duplicar." });
      return null;
    }

    const currentUserId = await getCurrentUserId();

    const insertPresupuestoRes = await supabase
      .from("presupuestos_v2")
      .insert({
        marca: presupuesto.marca,
        plantilla: presupuesto.plantilla,
        estado: "BORRADOR",
        origen_carga: presupuesto.origen_carga,
        cliente_id: presupuesto.cliente_id,
        contacto_id: presupuesto.contacto_id,
        lead_id: presupuesto.lead_id,
        carrito_id: presupuesto.carrito_id,
        cliente_nombre: presupuesto.cliente_nombre,
        cliente_telefono: presupuesto.cliente_telefono,
        cliente_email: presupuesto.cliente_email,
        titulo: presupuesto.titulo ? `${presupuesto.titulo} (copia)` : null,
        destino_principal: presupuesto.destino_principal,
        destino_detalle: presupuesto.destino_detalle,
        origen_ciudad: presupuesto.origen_ciudad,
        origen_iata: presupuesto.origen_iata,
        destino_ciudad: presupuesto.destino_ciudad,
        destino_iata: presupuesto.destino_iata,
        fecha_salida: presupuesto.fecha_salida,
        fecha_regreso: presupuesto.fecha_regreso,
        noches: presupuesto.noches,
        adultos: presupuesto.adultos,
        menores: presupuesto.menores,
        edades_menores: presupuesto.edades_menores,
        pasajeros_detalle: presupuesto.pasajeros_detalle,
        vendedor_id: presupuesto.vendedor_id || currentUserId,
        sucursal_id: presupuesto.sucursal_id,
        validez_hasta: presupuesto.validez_hasta,
        moneda_principal: presupuesto.moneda_principal,
        observaciones_internas: presupuesto.observaciones_internas,
        intro_comercial: presupuesto.intro_comercial,
        condiciones_generales: presupuesto.condiciones_generales,
        footer_text: presupuesto.footer_text || DEFAULT_FOOTER,
        metadata: {
          ...(presupuesto.metadata || {}),
          duplicated_from: presupuesto.id,
          duplicated_at: getNowIso()
        },
        created_by: currentUserId,
        updated_by: currentUserId
      })
      .select("id")
      .single();

    if (insertPresupuestoRes.error) {
      set({ saving: false, error: normalizeError(insertPresupuestoRes.error) });
      return null;
    }

    const newPresupuestoId = insertPresupuestoRes.data.id as string;

    const vueloIdMap = new Map<string, string>();
    const hotelIdMap = new Map<string, string>();
    const servicioIdMap = new Map<string, string>();
    const combinacionIdMap = new Map<string, string>();

    for (const vuelo of vuelos) {
      const { data, error } = await supabase
        .from("presupuesto_vuelos")
        .insert({
          ...vuelo,
          id: undefined,
          presupuesto_id: newPresupuestoId,
          created_by: currentUserId,
          updated_by: currentUserId,
          created_at: undefined,
          updated_at: undefined
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }

      vueloIdMap.set(vuelo.id, data.id as string);
    }

    for (const hotel of hoteles) {
      const { data, error } = await supabase
        .from("presupuesto_hoteles")
        .insert({
          ...hotel,
          id: undefined,
          presupuesto_id: newPresupuestoId,
          created_by: currentUserId,
          updated_by: currentUserId,
          created_at: undefined,
          updated_at: undefined
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }

      hotelIdMap.set(hotel.id, data.id as string);
    }

    for (const servicio of servicios) {
      const { data, error } = await supabase
        .from("presupuesto_servicios")
        .insert({
          ...servicio,
          id: undefined,
          presupuesto_id: newPresupuestoId,
          created_by: currentUserId,
          updated_by: currentUserId,
          created_at: undefined,
          updated_at: undefined
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }

      servicioIdMap.set(servicio.id, data.id as string);
    }

    for (const combinacion of combinaciones) {
      const { data, error } = await supabase
        .from("presupuesto_combinaciones")
        .insert({
          ...combinacion,
          id: undefined,
          presupuesto_id: newPresupuestoId,
          vuelo_id: combinacion.vuelo_id ? vueloIdMap.get(combinacion.vuelo_id) || null : null,
          hotel_id: combinacion.hotel_id ? hotelIdMap.get(combinacion.hotel_id) || null : null,
          created_by: currentUserId,
          updated_by: currentUserId,
          created_at: undefined,
          updated_at: undefined
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }

      combinacionIdMap.set(combinacion.id, data.id as string);
    }

    for (const item of combinacionItems) {
      const { error } = await supabase.from("presupuesto_combinacion_items").insert({
        ...item,
        id: undefined,
        presupuesto_id: newPresupuestoId,
        combinacion_id: combinacionIdMap.get(item.combinacion_id),
        vuelo_id: item.vuelo_id ? vueloIdMap.get(item.vuelo_id) || null : null,
        hotel_id: item.hotel_id ? hotelIdMap.get(item.hotel_id) || null : null,
        servicio_id: item.servicio_id ? servicioIdMap.get(item.servicio_id) || null : null,
        created_at: undefined
      });

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }
    }

    for (const adjunto of adjuntos) {
      const { error } = await supabase.from("presupuesto_adjuntos").insert({
        ...adjunto,
        id: undefined,
        presupuesto_id: newPresupuestoId,
        created_by: currentUserId,
        created_at: undefined
      });

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }
    }

    await get().loadPresupuestos(true);
    await get().loadPresupuestoFull(newPresupuestoId, true);

    set({
      saving: false,
      selectedPresupuestoId: newPresupuestoId,
      aiPreview: null
    });

    return newPresupuestoId;
  },

  /* =========================================================
     SELECT / FILTERS
  ========================================================= */

  selectPresupuesto: (presupuestoId) => {
    set({
      selectedPresupuestoId: presupuestoId,
      aiPreview: null,
      processingIa: false
    });

    if (presupuestoId) {
      void get().loadPresupuestoFull(presupuestoId, false);
    } else {
      set({
        presupuesto: null,
        vuelos: [],
        hoteles: [],
        servicios: [],
        combinaciones: [],
        combinacionItems: [],
        adjuntos: []
      });
    }
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }));
  },

   resetFilters: () => {
    set((state) => ({
      filters: getDefaultFilters(state.currentProfile)
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  /* =========================================================
     DERIVADOS
  ========================================================= */

  getFilteredPresupuestos: () => {
    const { presupuestos, filters } = get();
    const search = normalizeText(filters.search);

    return presupuestos.filter((presupuesto) => {
      if (filters.estado !== "TODOS" && presupuesto.estado !== filters.estado) return false;
      if (filters.marca !== "TODAS" && presupuesto.marca !== filters.marca) return false;

      if (filters.vendedorId !== "todos" && presupuesto.vendedor_id !== filters.vendedorId) {
        return false;
      }

      if (filters.sucursalId !== "todas" && presupuesto.sucursal_id !== filters.sucursalId) {
        return false;
      }

      if (filters.desde) {
        const createdAt = new Date(presupuesto.created_at).getTime();
        const desde = new Date(`${filters.desde}T00:00:00`).getTime();

        if (createdAt < desde) return false;
      }

      if (filters.hasta) {
        const createdAt = new Date(presupuesto.created_at).getTime();
        const hasta = new Date(`${filters.hasta}T23:59:59`).getTime();

        if (createdAt > hasta) return false;
      }

      if (search) {
        const haystack = normalizeText(
          [
            presupuesto.numero,
            presupuesto.cliente_nombre,
            presupuesto.cliente_telefono,
            presupuesto.cliente_email,
            presupuesto.destino_principal,
            presupuesto.destino_detalle,
            presupuesto.vendedor_nombre,
            presupuesto.sucursal_nombre,
            presupuesto.estado,
            presupuesto.marca
          ].join(" ")
        );

        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  },

  getSelectedPresupuestoResumen: () => {
    const { selectedPresupuestoId, presupuestos } = get();
    return presupuestos.find((item) => item.id === selectedPresupuestoId) || null;
  },

   getMetrics: () => {
    const presupuestos = get().getFilteredPresupuestos();

    return {
      total: presupuestos.length,
      borradores: presupuestos.filter((item) => item.estado === "BORRADOR").length,
      enviados: presupuestos.filter((item) => item.estado === "ENVIADO").length,
      aceptados: presupuestos.filter((item) => item.estado === "ACEPTADO").length,
      rechazados: presupuestos.filter((item) => item.estado === "RECHAZADO").length,
      vencidos: presupuestos.filter((item) => item.estado === "VENCIDO").length,
      conPdf: presupuestos.filter((item) => Boolean(item.pdf_url)).length
    };
  },

  getPresupuestoFull: () => {
    const { presupuesto, vuelos, hoteles, servicios, combinaciones, combinacionItems, adjuntos } =
      get();

    return {
      presupuesto,
      vuelos,
      hoteles,
      servicios,
      combinaciones,
      combinacionItems,
      adjuntos
    };
  }
}));