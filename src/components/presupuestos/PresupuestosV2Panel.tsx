// src/components/presupuestos/PresupuestosV2Panel.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ChangeEvent, ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  BadgeDollarSign,
  BedDouble,
  Check,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  Eye,
  FileText,
  Filter,
  Hotel,
  Image as ImageIcon,
  Loader2,
  PackageCheck,
  Pencil,
  Plane,
  Plus,
  RefreshCcw,
  Search,
  Send,
  Sparkles,
  Trash2,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatMoneyAR } from "../../lib/formatters";
import { buildPresupuestoHtml } from "../../lib/presupuestosPdf";
import {
  usePresupuestosV2Store,
  type CreateCombinacionDraft,
  type CreateHotelDraft,
  type CreatePresupuestoV2Draft,
  type CreateServicioDraft,
  type CreateVueloDraft,
  type PresupuestoAdjunto,
  type PresupuestoAdjuntoTipo,
  type PresupuestoCombinacion,
  type PresupuestoHotel,
  type PresupuestoMarca,
  type PresupuestoServicio,
  type PresupuestoServicioTipo,
  type PresupuestoV2,
  type PresupuestoV2Resumen,
  type PresupuestoVuelo,
  type PresupuestosV2Filters,
  type ProfileLite,
  type SucursalLite
} from "../../store/presupuestosV2Store";

/* =========================================================
   NOSSIX / NOSTUR — PRESUPUESTOS V2

   Enfoque funcional:
   - IA como flujo principal: crear y pegar texto.
   - Manual como carga/corrección.
   - Presupuesto = comparador de opciones comerciales.
   - Opción comercial = vuelos + hoteles + servicios + tarifa + pagos + promos.
   - No divide precio por pasajero salvo que el vendedor lo marque.
   - Todo lo flexible se guarda en combinacion.metadata para testear sin migración.
========================================================= */

type PresupuestosState = ReturnType<typeof usePresupuestosV2Store.getState>;

type SelectOption = {
  value: string;
  label: string;
};

type ModalMode = "nuevo" | "manual" | "ia" | "confirmDelete" | null;

type ManualWizardStep = "aereos" | "hoteles" | "servicios" | "precios";

type MonedaSimple = "USD" | "ARS";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type PassengerDraft = {
  adultos: number;
  menores: number;
  edadesMenores: string;
};

type PresupuestoDestinoDraft = {
  pais: string;
  destino: string;
};

type ClienteDetectado = {
  id: string;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  source: "clientes" | "contactos";
};

type HotelMaestroLite = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  categoria: number | null;
  descripcion: string | null;
  direccion: string | null;
  imagen_url: string | null;
  fotos: string[];
};

type DraftVuelo = CreateVueloDraft & {
  id?: string;
};

type DraftHotel = CreateHotelDraft & {
  id?: string;
};

type DraftServicio = CreateServicioDraft & {
  id?: string;
};

type DraftCombinacion = CreateCombinacionDraft & {
  id?: string;
};

type UploadedImageResult = {
  url: string;
  path: string | null;
};

type PresupuestoIaApplyPayload = {
  raw_text: string;
  parsed: Record<string, unknown>;
};

type PresupuestoIaPreview = {
  raw_text: string;
  parsed: Record<string, unknown>;
  vuelos: Record<string, unknown>[];
  hoteles: Record<string, unknown>[];
  servicios: Record<string, unknown>[];
  opciones_comerciales: Record<string, unknown>[];
  resumen_humano: {
    titulo: string;
    descripcion: string;
    precio_final_detectado: string;
    advertencias: string[];
  };
};

/* =========================================================
   LOCAL STORAGE DRAFTS
========================================================= */

const PRESUPUESTOS_DRAFT_VERSION = 3;

type NuevoPresupuestoDraftStorage = {
  version: number;
  draft: CreatePresupuestoV2Draft;
  passengers: PassengerDraft;
  destinosPresupuestados: PresupuestoDestinoDraft[];
  updatedAt: string;
};

type PresupuestoIaDraftStorage = {
  version: number;
  rawText: string;
  updatedAt: string;
};

type PrecioDraftStorage = {
  version: number;
  step: ManualWizardStep;
  vueloDraft: ManualVueloDraft;
  hotelSearch: string;
  selectedHotelMaestro: HotelMaestroLite | null;
  hotelDraft: ManualHotelDraft;
  servicioDraft: ManualServicioDraft;
  precioDraft: ManualPrecioDraft;
  updatedAt: string;
};

type ManualVueloDraft = {
  titulo: string;
  raw_text: string;
  captura_url: string;
  captura_path: string | null;
  precio_total: string;
  moneda: MonedaSimple;
  mostrar_precio_en_pdf: boolean;
  incluir_en_pdf: boolean;
};

type ManualHotelDraft = {
  hotel_id: string | null;
  nombre: string;
  destino: string;
  ubicacion: string;
  categoria: string;
  regimen: string;
  habitacion: string;
  descripcion: string;
  imagen_url: string;
  precio_total: string;
  moneda: MonedaSimple;
  mostrar_precio_en_pdf: boolean;
  incluir_en_pdf: boolean;
};

type ManualServicioDraft = {
  tipo: string;
  nombre: string;
  descripcion: string;
  precio_total: string;
  moneda: MonedaSimple;
  mostrar_precio_en_pdf: boolean;
  incluir_en_pdf: boolean;
  incluido: boolean;
  opcional: boolean;
};

type ManualPrecioDraft = {
  id?: string;
  nombre: string;
  subtitulo: string;
  descripcion: string;
  precio_total: string;
  moneda: MonedaSimple;
  mostrar_precio_por_pasajero: boolean;
  precio_label: string;
  composicion_precio_texto: string;
  tarifas_pasajeros_texto: string;
  promociones_texto: string;
  descuentos_texto: string;
  formas_pago_texto: string;
  precio_contado: string;
  precio_transferencia: string;
  precio_tarjeta: string;
  precio_financiado: string;
  cuotas: string;
  valor_cuota: string;
  tarjeta: string;
  banco: string;
  con_interes: boolean;
  seña: string;
  saldo: string;
  incluye_resumen: string;
  no_incluye_resumen: string;
  forma_pago_resumen: string;
  condiciones_pago: string;
  promocion_utilizada: string;
  destacada: boolean;
  visible_en_pdf: boolean;
  vuelos_ids: string[];
  hoteles_ids: string[];
  servicios_ids: string[];
};

function getNuevoPresupuestoDraftKey(): string {
  return "nostur:presupuestos-v2:nuevo:draft";
}

function getPresupuestoIaDraftKey(presupuestoId: string): string {
  return `nostur:presupuestos-v2:${presupuestoId}:ia-draft`;
}

function getPresupuestoManualDraftKey(presupuestoId: string): string {
  return `nostur:presupuestos-v2:${presupuestoId}:manual-draft-v3`;
}

function readJsonDraft<T>(key: string): T | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJsonDraft<T>(key: string, value: T): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // No romper operación principal.
  }
}

function removeJsonDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // No romper operación principal.
  }
}

/* =========================================================
   OPCIONES
========================================================= */

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "TODOS", label: "Todos" },
  { value: "BORRADOR", label: "Borrador" },
  { value: "ENVIADO", label: "Enviado" },
  { value: "ACEPTADO", label: "Aceptado" },
  { value: "RECHAZADO", label: "Rechazado" },
  { value: "VENCIDO", label: "Vencido" },
  { value: "CANCELADO", label: "Cancelado" }
];

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "USD", label: "USD" },
  { value: "ARS", label: "ARS" }
];

const SERVICIO_TIPO_OPTIONS: SelectOption[] = [
  { value: "TRASLADO", label: "Traslado" },
  { value: "ASISTENCIA", label: "Asistencia" },
  { value: "EXCURSION", label: "Excursión" },
  { value: "EQUIPAJE", label: "Equipaje" },
  { value: "SEGURO", label: "Seguro" },
  { value: "CIRCUITO", label: "Circuito" },
  { value: "AUTO", label: "Auto" },
  { value: "OTRO", label: "Otro" }
];

const MARCA_OPTIONS: SelectOption[] = [
  { value: "TODAS", label: "Todas" },
  { value: "ALMUNDO", label: "ALMUNDO" },
  { value: "NOSSIX", label: "NOSSIX" }
];

const COMMON_DESTINOS: SelectOption[] = [
  "Cancún",
  "Playa del Carmen",
  "Punta Cana",
  "Aruba",
  "Porto de Galinhas",
  "Buzios",
  "Río de Janeiro",
  "Madrid",
  "Miami",
  "Orlando"
].map((item) => ({
  value: item,
  label: item
}));

/* =========================================================
   HELPERS
========================================================= */

function todayIsoDate(): string {
  const now = new Date();

  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(
    now.getDate()
  ).padStart(2, "0")}`;
}

function addDaysIsoDate(baseDate: string, days: number): string {
  if (!baseDate) return "";

  const date = new Date(`${baseDate}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  date.setDate(date.getDate() + days);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;
}

function diffNights(fechaSalida?: string | null, fechaRegreso?: string | null): number | null {
  if (!fechaSalida || !fechaRegreso) return null;

  const salida = new Date(`${fechaSalida}T00:00:00`);
  const regreso = new Date(`${fechaRegreso}T00:00:00`);

  if (Number.isNaN(salida.getTime()) || Number.isNaN(regreso.getTime())) return null;

  const diff = regreso.getTime() - salida.getTime();

  if (diff <= 0) return null;

  return Math.round(diff / 86_400_000);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(`${String(value).slice(0, 10)}T00:00:00`);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).format(date);
}

function normalizeSearchText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/[^\d]/g, "");
}

function phoneMatches(inputPhone: string, dbPhone: unknown): boolean {
  const input = normalizePhone(inputPhone);
  const db = normalizePhone(dbPhone);

  if (!input || !db) return false;

  const inputTail8 = input.slice(-8);
  const inputTail10 = input.slice(-10);
  const dbTail8 = db.slice(-8);
  const dbTail10 = db.slice(-10);

  return (
    input.includes(db) ||
    db.includes(input) ||
    inputTail8 === dbTail8 ||
    inputTail10 === dbTail10 ||
    db.includes(inputTail8) ||
    input.includes(dbTail8)
  );
}

function toNumberOrNull(value: string | number | null | undefined): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const cleaned = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .trim();

  if (!cleaned) return null;

  const parsed = Number(cleaned);

  return Number.isFinite(parsed) ? parsed : null;
}

function toMonedaSimple(value: string): MonedaSimple {
  return value === "ARS" ? "ARS" : "USD";
}

function getInitials(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || "";
  const second = parts[1]?.[0] || "";

  return `${first}${second}`.toUpperCase() || "PX";
}

function getEstadoLabel(value: string): string {
  return ESTADO_OPTIONS.find((item) => item.value === value)?.label || value;
}

function getEstadoClass(value: string): string {
  if (value === "ACEPTADO") return "border-emerald-200 bg-emerald-50 text-emerald-700";
  if (value === "ENVIADO") return "border-sky-200 bg-sky-50 text-sky-700";
  if (value === "RECHAZADO" || value === "CANCELADO") return "border-red-200 bg-red-50 text-red-700";
  if (value === "VENCIDO") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-slate-200 bg-slate-50 text-slate-700";
}

function isSellerProfile(profile?: ProfileLite | null): boolean {
  return String(profile?.rol || "").toLowerCase() === "vendedor";
}

function getDisplayName(presupuesto?: PresupuestoV2Resumen | PresupuestoV2 | null): string {
  if (!presupuesto) return "Sin presupuesto";

  return (
    presupuesto.cliente_nombre ||
    presupuesto.destino_principal ||
    presupuesto.titulo ||
    presupuesto.numero ||
    "Sin nombre"
  );
}
function getPdfVendedorNombre(
  presupuesto: PresupuestoV2 | null,
  vendedores: ProfileLite[]
): string {
  if (!presupuesto) return "";

  const record = presupuesto as unknown as Record<string, unknown>;

  const vendedorDirecto = String(
    record.vendedor_nombre ||
      record.vendedor ||
      record.vendedor_email ||
      ""
  ).trim();

  if (vendedorDirecto) return vendedorDirecto;

  const vendedorId = String(record.vendedor_id || "").trim();

  if (!vendedorId) return "";

  const vendedor = vendedores.find((item) => item.id === vendedorId);

  if (!vendedor) return "";

  return (
    [vendedor.nombre, vendedor.apellido].filter(Boolean).join(" ").trim() ||
    vendedor.email ||
    ""
  );
}

function withPdfExtraFields(
  presupuesto: PresupuestoV2,
  vendedores: ProfileLite[]
): PresupuestoV2 {
  const vendedorNombre = getPdfVendedorNombre(presupuesto, vendedores);

  return {
    ...presupuesto,
    vendedor_nombre: vendedorNombre
  } as PresupuestoV2;
}


function getStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item || "").trim())
    .filter(Boolean);
}

function getArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
}

function getPreviewValue(item: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = item[key];

    if (value !== null && value !== undefined && String(value).trim()) {
      return String(value).trim();
    }
  }

  return "";
}

function safeRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizeDestinoDraftItem(item: Partial<PresupuestoDestinoDraft>): PresupuestoDestinoDraft {
  return {
    pais: String(item.pais || "").trim(),
    destino: String(item.destino || "").trim()
  };
}

function normalizeDestinosDraft(items: PresupuestoDestinoDraft[]): PresupuestoDestinoDraft[] {
  const result: PresupuestoDestinoDraft[] = [];
  const seen = new Set<string>();

  items.forEach((item) => {
    const clean = normalizeDestinoDraftItem(item);
    const key = normalizeSearchText(`${clean.destino}|${clean.pais}`);

    if (!clean.destino && !clean.pais) return;
    if (seen.has(key)) return;

    seen.add(key);
    result.push(clean);
  });

  return result;
}

function getDestinoDraftLabel(item: PresupuestoDestinoDraft): string {
  const clean = normalizeDestinoDraftItem(item);

  if (clean.destino && clean.pais) return `${clean.destino}, ${clean.pais}`;
  return clean.destino || clean.pais;
}

function buildDestinoPrincipalFromDraft(items: PresupuestoDestinoDraft[]): string {
  const destinos = normalizeDestinosDraft(items)
    .map((item) => item.destino || item.pais)
    .filter(Boolean);

  return destinos.join(" + ");
}

function buildDestinoDetalleFromDraft(items: PresupuestoDestinoDraft[]): string | null {
  const paises = normalizeDestinosDraft(items)
    .map((item) => item.pais)
    .filter(Boolean);

  const unique = Array.from(new Set(paises));

  return unique.length ? unique.join(" · ") : null;
}

function getDestinosFromMetadataLike(value: unknown): PresupuestoDestinoDraft[] {
  const metadata = safeRecord(value);
  const raw = metadata.destinos_presupuestados || metadata.destinos;

  if (Array.isArray(raw)) {
    return normalizeDestinosDraft(
      raw
        .map((item): PresupuestoDestinoDraft | null => {
          if (typeof item === "string") {
            return {
              pais: "",
              destino: item
            };
          }

          if (item && typeof item === "object" && !Array.isArray(item)) {
            const record = item as Record<string, unknown>;

            return {
              pais: String(record.pais || record.country || record.pais_nombre || record.country_name || ""),
              destino: String(
                record.destino ||
                  record.destination ||
                  record.ciudad ||
                  record.city ||
                  record.nombre ||
                  record.name ||
                  ""
              )
            };
          }

          return null;
        })
        .filter((item): item is PresupuestoDestinoDraft => Boolean(item))
    );
  }

  if (typeof raw === "string" && raw.trim()) {
    return normalizeDestinosDraft(
      raw
        .split(/[,\n;]/)
        .map((item) => ({
          pais: "",
          destino: item.trim()
        }))
    );
  }

  return [];
}

function getDestinosFromPresupuestoLike(
  presupuesto: Partial<PresupuestoV2> | Partial<CreatePresupuestoV2Draft> | null | undefined
): PresupuestoDestinoDraft[] {
  if (!presupuesto) return [];

  const record = presupuesto as Record<string, unknown>;
  const metadataDestinos = getDestinosFromMetadataLike(record.metadata);

  if (metadataDestinos.length) return metadataDestinos;

  const principal = String(record.destino_principal || "").trim();
  const detalle = String(record.destino_detalle || "").trim();

  if (principal) {
    return normalizeDestinosDraft([
      {
        pais: detalle,
        destino: principal
      }
    ]);
  }

  return [
    {
      pais: "",
      destino: ""
    }
  ];
}

function getDestinosFromParsedIa(
  parsed: Record<string, unknown>,
  fallbackPresupuesto: PresupuestoV2
): PresupuestoDestinoDraft[] {
  const direct = getDestinosFromMetadataLike({
    destinos_presupuestados:
      parsed.destinos_presupuestados ||
      parsed.destinos_detectados ||
      parsed.destinos ||
      safeRecord(parsed.caratula).destinos_presupuestados
  });

  if (direct.length) return direct;

  const destinoPrincipal = String(
    parsed.destino_principal ||
      safeRecord(parsed.caratula).destino_principal ||
      fallbackPresupuesto.destino_principal ||
      ""
  ).trim();

  const destinoDetalle = String(
    parsed.destino_detalle ||
      safeRecord(parsed.caratula).destino_detalle ||
      fallbackPresupuesto.destino_detalle ||
      ""
  ).trim();

  if (destinoPrincipal) {
    return normalizeDestinosDraft([
      {
        pais: destinoDetalle,
        destino: destinoPrincipal
      }
    ]);
  }

  return getDestinosFromPresupuestoLike(fallbackPresupuesto);
}




function buildFlightRawText(item: Record<string, unknown>, fallback: string): string {
  const direct = getPreviewValue(item, [
    "texto_libre",
    "raw_text",
    "descripcion",
    "detalle",
    "itinerario",
    "resumen"
  ]);

  if (direct) return direct;

  const parts = [
    getPreviewValue(item, ["titulo", "nombre"]),
    getPreviewValue(item, ["aerolinea", "compania", "airline"]),
    getPreviewValue(item, ["ruta", "ruta_resumen", "tramo"]),
    getPreviewValue(item, ["ida_fecha", "salida", "fecha_salida", "ida"]),
    getPreviewValue(item, ["vuelta_fecha", "regreso", "fecha_regreso", "vuelta"]),
    getPreviewValue(item, ["equipaje"]),
    getPreviewValue(item, ["condiciones"])
  ].filter(Boolean);

  return parts.length ? parts.join("\n") : fallback;
}

function buildHotelDescription(item: Record<string, unknown>): string {
  return [
    getPreviewValue(item, ["descripcion"]),
    getPreviewValue(item, ["beneficios"]),
    getPreviewValue(item, ["condiciones"]),
    getPreviewValue(item, ["politica_cancelacion"])
  ]
    .filter(Boolean)
    .join("\n\n");
}

function buildIaPreview(rawText: string, parsed: Record<string, unknown>): PresupuestoIaPreview {
  const vuelos = getArray(parsed.vuelos);
  const hoteles = getArray(parsed.hoteles);
  const servicios = getArray(parsed.servicios);
  const opciones = getArray(parsed.opciones_comerciales).length
    ? getArray(parsed.opciones_comerciales)
    : getArray(parsed.opciones);

  const firstPrice =
    opciones
      .map((item) => {
        const precio = item.precio_total ?? item.precio;
        const moneda = String(item.moneda || "USD");

        return precio === null || precio === undefined || precio === ""
          ? ""
          : `${moneda} ${String(precio)}`;
      })
      .find(Boolean) || "";

  const resumen = safeRecord(parsed.resumen_humano);

  const advertencias = Array.isArray(resumen.advertencias)
    ? resumen.advertencias.map((item) => String(item || "").trim()).filter(Boolean)
    : [];

  if (!firstPrice && !advertencias.includes("No se detectó un precio final claro.")) {
    advertencias.push("No se detectó un precio final claro.");
  }

  return {
    raw_text: rawText,
    parsed,
    vuelos,
    hoteles,
    servicios,
    opciones_comerciales: opciones,
    resumen_humano: {
      titulo: String(resumen.titulo || "Contenido detectado por IA"),
      descripcion:
        String(resumen.descripcion || "") ||
        `Detectado: ${vuelos.length} aéreo(s), ${hoteles.length} hotel(es), ${servicios.length} servicio(s) y ${opciones.length} opción(es) comercial(es).`,
      precio_final_detectado: String(resumen.precio_final_detectado || firstPrice || ""),
      advertencias
    }
  };
}

function formatPreviewPrice(item: Record<string, unknown>): string {
  const precio = item.precio_total ?? item.precio;
  const moneda = String(item.moneda || "USD");

  if (precio === null || precio === undefined || precio === "") return "";

  return `${moneda} ${String(precio)}`;
}

function getHotelMaestroDescription(hotel: HotelMaestroLite): string {
  return [hotel.descripcion, hotel.direccion || hotel.ubicacion]
    .map((item) => String(item || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

function normalizeHotelMaestroFromDb(row: Record<string, unknown>): HotelMaestroLite {
  const metadata = safeRecord(row.metadata);

  const imagenesRaw = Array.isArray(row.imagenes)
    ? row.imagenes
    : Array.isArray(row.fotos)
      ? row.fotos
      : Array.isArray(metadata.imagenes)
        ? metadata.imagenes
        : Array.isArray(metadata.fotos)
          ? metadata.fotos
          : Array.isArray(metadata.photos)
            ? metadata.photos
            : [];

  const fotos = imagenesRaw
    .map((item) => {
      if (typeof item === "string") return item;

      if (item && typeof item === "object") {
        const record = item as Record<string, unknown>;
        return String(record.url || record.foto_url || record.src || "");
      }

      return "";
    })
    .filter(Boolean);

  return {
    id: String(row.id || ""),
    nombre: String(row.nombre || ""),
    ubicacion: String(row.ubicacion || metadata.ubicacion || "").trim() || null,
    categoria:
      row.categoria === null || row.categoria === undefined || row.categoria === ""
        ? null
        : Number(row.categoria),
    descripcion: String(row.descripcion || metadata.descripcion || "").trim() || null,
    direccion: String(row.direccion || metadata.direccion || row.ubicacion || "").trim() || null,
    imagen_url:
      String(row.imagen_url || row.foto_url || metadata.imagen_url || metadata.foto_url || "").trim() ||
      fotos[0] ||
      null,
    fotos
  };
}

async function fetchHotelesMaestrosFromDb(query: string): Promise<HotelMaestroLite[]> {
  const cleanQuery = query.trim();

  if (cleanQuery.length < 2) return [];

  const { data, error } = await supabase
    .from("hoteles_maestros")
    .select("*")
    .eq("activo", true)
    .or(`nombre.ilike.%${cleanQuery}%,ubicacion.ilike.%${cleanQuery}%`)
    .order("nombre", { ascending: true })
    .limit(25);

  if (error) {
    console.error("fetch hoteles_maestros error", error);
    return [];
  }

  return ((data || []) as Record<string, unknown>[]).map(normalizeHotelMaestroFromDb);
}

async function fetchDestinosFromDb(): Promise<SelectOption[]> {
  const possibleTables = ["destinos", "destinos_maestros", "catalogo_destinos"];

  for (const table of possibleTables) {
    try {
      const { data, error } = await supabase.from(table).select("*").limit(500);

      if (error) continue;

      const rows = ((data || []) as Record<string, unknown>[])
        .map((row) => {
          const nombre = String(
            row.nombre ||
              row.destino ||
              row.name ||
              row.titulo ||
              row.ciudad ||
              row.descripcion ||
              ""
          ).trim();

          if (!nombre) return null;

          return {
            value: nombre,
            label: nombre
          };
        })
        .filter((item): item is SelectOption => Boolean(item));

      const unique = new Map<string, SelectOption>();

      rows.forEach((item) => {
        unique.set(normalizeSearchText(item.value), item);
      });

      const result = Array.from(unique.values()).sort((a, b) => a.label.localeCompare(b.label));

      if (result.length > 0) return result;
    } catch {
      continue;
    }
  }

  return COMMON_DESTINOS;
}

function getRowPhone(row: Record<string, unknown>): string {
  const candidates = [
    row.telefono,
    row.telefono_principal,
    row.celular,
    row.whatsapp,
    row.phone,
    row.mobile,
    row.wa_phone,
    row.telefonos
  ];

  for (const value of candidates) {
    if (Array.isArray(value)) {
      const found = value.map(normalizePhone).find(Boolean);
      if (found) return found;
    }

    const clean = normalizePhone(value);
    if (clean) return String(value || clean);
  }

  return "";
}

function getRowEmail(row: Record<string, unknown>): string {
  return String(row.email || row.mail || row.correo || row.email_principal || "").trim();
}

function getRowName(row: Record<string, unknown>): string {
  return (
    String(row.nombre_completo || row.razon_social || row.full_name || "").trim() ||
    `${String(row.nombre || "").trim()} ${String(row.apellido || "").trim()}`.trim() ||
    String(row.name || row.titulo || "").trim()
  );
}

async function searchClienteByTelefono(telefono: string): Promise<ClienteDetectado | null> {
  const normalized = normalizePhone(telefono);

  if (normalized.length < 6) return null;

  const attempts: Array<{
    table: "clientes" | "contactos";
  }> = [{ table: "clientes" }, { table: "contactos" }];

  for (const attempt of attempts) {
    const { data, error } = await supabase.from(attempt.table).select("*").limit(1000);

    if (error) continue;

    const rows = (data || []) as Record<string, unknown>[];
    const found = rows.find((row) => phoneMatches(normalized, getRowPhone(row)));

    if (found) {
      return {
        id: String(found.id),
        nombre: getRowName(found) || null,
        telefono: getRowPhone(found) || null,
        email: getRowEmail(found) || null,
        source: attempt.table
      };
    }
  }

  return null;
}

function parseLines(value: string): string[] {
  return String(value || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePaymentLines(value: string, moneda: MonedaSimple) {
  return parseLines(value).map((line, index) => ({
    id: `manual-payment-${index + 1}`,
    tipo: "OTRO",
    titulo: line.includes(":") ? line.split(":")[0].trim() : `Forma de pago ${index + 1}`,
    descripcion: line,
    moneda,
    visible_en_pdf: true
  }));
}

function parsePromoLines(value: string, kind: "promo" | "discount", moneda: MonedaSimple) {
  return parseLines(value).map((line, index) => ({
    id: `manual-${kind}-${index + 1}`,
    nombre: line.includes(":") ? line.split(":")[0].trim() : line,
    descripcion: line.includes(":") ? line.split(":").slice(1).join(":").trim() : "",
    moneda,
    visible_en_pdf: true
  }));
}

function parseTarifaLines(value: string, moneda: MonedaSimple) {
  return parseLines(value).map((line, index) => {
    const parts = line.split("|").map((item) => item.trim());

    const descripcion = parts[0] || `Tarifa ${index + 1}`;
    const cantidad = toNumberOrNull(parts[1] || "");
    const precioUnitario = toNumberOrNull(parts[2] || "");
    const subtotal = toNumberOrNull(parts[3] || "");

    return {
      id: `manual-tariff-${index + 1}`,
      descripcion,
      cantidad,
      precio_unitario: precioUnitario,
      subtotal,
      moneda,
      notas: parts[4] || null,
      visible_en_pdf: true
    };
  });
}

function makeOptionSummaryFromIds({
  vuelos,
  hoteles,
  servicios,
  vuelosIds,
  hotelesIds,
  serviciosIds
}: {
  vuelos: PresupuestoVuelo[];
  hoteles: PresupuestoHotel[];
  servicios: PresupuestoServicio[];
  vuelosIds: string[];
  hotelesIds: string[];
  serviciosIds: string[];
}) {
  const vuelosTexto = vuelos
    .filter((item) => vuelosIds.includes(item.id))
    .map((item) => item.titulo || item.ruta_resumen || item.aerolinea || "Aéreo");

  const hotelesTexto = hoteles
    .filter((item) => hotelesIds.includes(item.id))
    .map((item) => [item.nombre, item.regimen, item.habitacion].filter(Boolean).join(" · "));

  const serviciosTexto = servicios
    .filter((item) => serviciosIds.includes(item.id))
    .map((item) => item.nombre || "Servicio");

  return {
    vuelos_texto: vuelosTexto,
    hoteles_texto: hotelesTexto,
    servicios_texto: serviciosTexto
  };
}

/* =========================================================
   UI BASE
========================================================= */

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  inputMode = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: "text" | "tel" | "email" | "decimal" | "numeric";
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
      className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90] disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  minHeight = 86,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      style={{ minHeight }}
      className="w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[12px] font-normal leading-relaxed text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90] disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

function NosturSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar",
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const selected = options.find((option) => option.value === value);

  function calculatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) return null;

    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    const spaceBelow = viewportHeight - rect.bottom - 10;
    const spaceAbove = rect.top - 10;
    const opensUp = spaceBelow < 120 && spaceAbove > spaceBelow;
    const maxHeight = opensUp
      ? Math.max(86, Math.min(280, spaceAbove - 8))
      : Math.max(86, Math.min(280, spaceBelow - 8));

    const left = Math.min(Math.max(10, rect.left), viewportWidth - rect.width - 10);

    return {
      top: opensUp ? rect.top - maxHeight - 6 : rect.bottom + 6,
      left,
      width: rect.width,
      maxHeight
    };
  }

  function closeSelect() {
    setOpen(false);
    setPosition(null);
  }

  function toggleSelect(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (disabled) return;

    if (open) {
      closeSelect();
      return;
    }

    const nextPosition = calculatePosition();

    if (!nextPosition) return;

    setPosition(nextPosition);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeSelect();
    }

    function handleReposition() {
      const nextPosition = calculatePosition();

      if (!nextPosition) {
        closeSelect();
        return;
      }

      setPosition(nextPosition);
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
    };
  }, [open, options.length]);

  const dropdown =
    open && position
      ? createPortal(
          <>
            <button
              type="button"
              className="fixed inset-0 z-[9998] cursor-default bg-transparent"
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
                closeSelect();
              }}
              tabIndex={-1}
              aria-label="Cerrar selector"
            />

            <div
              className="fixed z-[9999] overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-2xl"
              style={{
                top: position.top,
                left: position.left,
                width: position.width,
                maxHeight: position.maxHeight
              }}
              onMouseDown={(event) => {
                event.preventDefault();
                event.stopPropagation();
              }}
            >
              {options.length === 0 ? (
                <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                  Sin opciones
                </div>
              ) : (
                options.map((option) => {
                  const active = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onChange(option.value);
                        closeSelect();
                      }}
                      className={[
                        "flex min-h-8 w-full items-center rounded-[10px] px-3 py-2 text-left text-[12px] font-medium transition",
                        active
                          ? "bg-[#4f7c90] text-white"
                          : "text-[#334155] hover:bg-[#f1f5f9]"
                      ].join(" ")}
                    >
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </>,
          document.body
        )
      : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onMouseDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={toggleSelect}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-left text-[12px] font-normal text-[#172033] outline-none transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {dropdown}
    </>
  );
}

function TogglePill({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "h-8 rounded-[10px] border px-3 text-[12px] font-medium transition",
        checked
          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
          : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      {checked ? `✓ ${label}` : label}
    </button>
  );
}

function NosturDatePicker({
  value,
  onChange,
  min,
  placeholder = "Seleccionar fecha"
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  const [monthCursor, setMonthCursor] = useState(() => {
    const base = value || min || todayIsoDate();
    const date = new Date(`${base}T00:00:00`);
    return Number.isNaN(date.getTime()) ? new Date() : date;
  });

  const selectedDate = value ? new Date(`${value}T00:00:00`) : null;
  const selectedLabel =
    selectedDate && !Number.isNaN(selectedDate.getTime())
      ? new Intl.DateTimeFormat("es-AR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric"
        }).format(selectedDate)
      : "";

  const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
  const cells: Array<string | null> = [];

  for (let index = 0; index < monthStart.getDay(); index += 1) {
    cells.push(null);
  }

  const daysInMonth = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(
      `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, "0")}-${String(
        day
      ).padStart(2, "0")}`
    );
  }

  function calculatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) return null;

    const pickerWidth = 292;
    const pickerHeight = 330;
    const margin = 12;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    const left = Math.min(
      Math.max(margin, rect.left),
      Math.max(margin, viewportWidth - pickerWidth - margin)
    );

    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const opensUp = spaceBelow < pickerHeight && spaceAbove > spaceBelow;

    const top = opensUp
      ? Math.max(margin, rect.top - pickerHeight - 6)
      : Math.min(rect.bottom + 6, viewportHeight - pickerHeight - margin);

    return { top, left };
  }

  function closePicker() {
    setOpen(false);
    setPosition(null);
  }

  function toggleOpen(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (open) {
      closePicker();
      return;
    }

    const nextPosition = calculatePosition();

    if (!nextPosition) return;

    setPosition(nextPosition);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleReposition() {
      const nextPosition = calculatePosition();

      if (!nextPosition) {
        closePicker();
        return;
      }

      setPosition(nextPosition);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closePicker();
    }

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-left text-[12px] font-normal text-[#172033] outline-none transition hover:bg-[#f8fafc]"
      >
        <span className={selectedLabel ? "truncate" : "truncate text-[#94a3b8]"}>
          {selectedLabel || placeholder}
        </span>

        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && position
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[9998] cursor-default bg-transparent"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closePicker();
                }}
                tabIndex={-1}
                aria-label="Cerrar calendario"
              />

              <div
                className="fixed z-[9999] w-[292px] rounded-[18px] border border-black/10 bg-white p-3 shadow-2xl"
                style={{
                  top: position.top,
                  left: position.left
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <div className="mb-3 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setMonthCursor(
                        (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f8fafc] text-[#64748b] hover:bg-[#eef2f7]"
                  >
                    ‹
                  </button>

                  <div className="text-[12px] font-semibold capitalize text-[#172033]">
                    {new Intl.DateTimeFormat("es-AR", {
                      month: "long",
                      year: "numeric"
                    }).format(monthCursor)}
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setMonthCursor(
                        (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                      )
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f8fafc] text-[#64748b] hover:bg-[#eef2f7]"
                  >
                    ›
                  </button>
                </div>

                <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium uppercase text-[#94a3b8]">
                  <span>D</span>
                  <span>L</span>
                  <span>M</span>
                  <span>M</span>
                  <span>J</span>
                  <span>V</span>
                  <span>S</span>
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {cells.map((cell, index) => {
                    if (!cell) return <div key={`empty-${index}`} className="h-8" />;

                    const disabled = Boolean(min && cell < min);

                    return (
                      <button
                        key={cell}
                        type="button"
                        disabled={disabled}
                        onClick={() => {
                          onChange(cell);
                          closePicker();
                        }}
                        className={[
                          "flex h-8 items-center justify-center rounded-[10px] text-[12px] font-medium transition",
                          cell === value
                            ? "bg-[#4f7c90] text-white"
                            : disabled
                              ? "cursor-not-allowed text-[#cbd5e1]"
                              : "text-[#334155] hover:bg-[#f1f5f9]"
                        ].join(" ")}
                      >
                        {new Date(`${cell}T00:00:00`).getDate()}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const today = todayIsoDate();

                    if (!min || today >= min) {
                      onChange(today);
                      setMonthCursor(new Date(`${today}T00:00:00`));
                      closePicker();
                    }
                  }}
                  className="mt-3 h-8 w-full rounded-[10px] bg-[#f8fafc] text-[12px] font-medium text-[#334155] hover:bg-[#eef2f7]"
                >
                  Hoy
                </button>
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}

function InlineError({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>

      <button type="button" onClick={onClose} className="text-red-500 hover:text-red-700">
        <X size={14} />
      </button>
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed right-5 top-5 z-[950] w-[300px] rounded-[14px] border border-black/10 bg-white px-3.5 py-3 text-[12px] shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={[
              "mb-0.5 font-semibold",
              toast.type === "success" ? "text-emerald-700" : "text-red-700"
            ].join(" ")}
          >
            {toast.type === "success" ? "Operación exitosa" : "Atención"}
          </div>

          <div className="font-normal leading-relaxed text-[#334155]">{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ModalShell({
  title,
  subtitle,
  children,
  onClose,
  maxWidth = "max-w-4xl",
  variant = "center"
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  onClose: () => void;
  maxWidth?: string;
  variant?: "center" | "side";
}) {
  if (variant === "side") {
    return createPortal(
      <div className="pointer-events-none fixed bottom-0 right-0 top-[39px] z-[180] flex justify-end">
        <aside className="pointer-events-auto h-full w-full max-w-[560px] overflow-hidden border-l border-black/10 bg-[#edf3f7] text-[#172033] shadow-2xl">
          <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 border-b border-black/10 bg-white/85 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate text-[17px] font-semibold text-[#172033]">{title}</h2>
                  {subtitle ? (
                    <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">{subtitle}</p>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-4">{children}</div>
          </div>
        </aside>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[260] flex items-start justify-center bg-black/35 px-4 pt-6 backdrop-blur-sm">
      <div
        className={[
          "max-h-[calc(100vh-44px)] w-full overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl",
          maxWidth
        ].join(" ")}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">{subtitle}</p> : null}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        {children}
      </div>
    </div>,
    document.body
  );
}

function EstadoBadge({ estado }: { estado: string }) {
  return (
    <span
      className={[
        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        getEstadoClass(estado)
      ].join(" ")}
    >
      {getEstadoLabel(estado)}
    </span>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "orange"
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone?: "orange" | "blue" | "green" | "red" | "amber" | "slate";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-nostur-orange ring-orange-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-50 text-slate-700 ring-slate-100"
  }[tone];

  return (
    <div className="rounded-[14px] border border-black/10 bg-white/62 px-3 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10.5px] font-medium text-[#64748b]">{label}</div>
          <div className="mt-0.5 truncate text-[18px] font-semibold tracking-tight text-[#172033]">
            {value}
          </div>
        </div>

        <div
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1",
            toneClass
          ].join(" ")}
        >
          <Icon size={14} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
      {text}
    </div>
  );
}

function SmallMetric({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-center">
      <div className="mx-auto mb-1 flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#eef6f7] text-[#4f7c90]">
        {icon}
      </div>

      <div className="text-[18px] font-semibold tracking-tight text-[#172033]">{value}</div>
      <div className="text-[10.5px] font-medium text-[#64748b]">{label}</div>
    </div>
  );
}

function ActionButton({
  label,
  icon,
  danger = false,
  primary = false,
  onClick
}: {
  label: string;
  icon: ReactNode;
  danger?: boolean;
  primary?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-7 items-center gap-1.5 rounded-[10px] px-2.5 text-[11px] font-medium transition",
        primary
          ? "bg-[#4f7c90] text-white shadow-sm hover:bg-[#406b7d]"
          : danger
            ? "border border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
            : "bg-white text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function MenuAction({
  icon,
  label,
  danger = false,
  onClick
}: {
  icon: ReactNode;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-8 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[12px] font-medium hover:bg-[#f8fafc]",
        danger ? "text-red-600" : "text-[#334155]"
      ].join(" ")}
    >
      {icon}
      {label}
    </button>
  );
}

/* =========================================================
   COMPONENTES ESPECÍFICOS
========================================================= */

function DestinoAutocomplete({
  value,
  onChange,
  options,
  placeholder = "Buscar destino"
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const query = normalizeSearchText(value);

  const filtered = options
    .filter((option) => normalizeSearchText(`${option.label} ${option.value}`).includes(query))
    .slice(0, 18);

  function openFloating() {
    const rect = wrapperRef.current?.getBoundingClientRect();

    if (rect) {
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      });
    }

    setOpen(true);
  }

  return (
    <>
      <div ref={wrapperRef}>
        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            openFloating();
          }}
          onFocus={openFloating}
          placeholder={placeholder}
          className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
        />
      </div>

      {open && position ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[900] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div
            className="fixed z-[910] max-h-72 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-2xl"
            style={{
              top: position.top,
              left: position.left,
              width: position.width
            }}
          >
            {filtered.length === 0 ? (
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="block w-full rounded-[10px] px-3 py-2 text-left text-[12px] font-medium text-[#64748b] hover:bg-[#f8fafc]"
              >
                Usar “{value || "destino"}”
              </button>
            ) : (
              filtered.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="block w-full rounded-[10px] px-3 py-2 text-left text-[12px] font-medium text-[#334155] hover:bg-[#f1f5f9]"
                >
                  {option.label}
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </>
  );
}


function DestinosMultiplesEditor({
  value,
  onChange,
  options
}: {
  value: PresupuestoDestinoDraft[];
  onChange: (value: PresupuestoDestinoDraft[]) => void;
  options: SelectOption[];
}) {
  const destinos = value.length
    ? value
    : [
        {
          pais: "",
          destino: ""
        }
      ];

  function updateDestino(index: number, patch: Partial<PresupuestoDestinoDraft>) {
    const next = destinos.map((item, itemIndex) =>
      itemIndex === index
        ? normalizeDestinoDraftItem({
            ...item,
            ...patch
          })
        : item
    );

    onChange(next);
  }

  function addDestino() {
    onChange([
      ...destinos,
      {
        pais: "",
        destino: ""
      }
    ]);
  }

  function removeDestino(index: number) {
    const next = destinos.filter((_, itemIndex) => itemIndex !== index);

    onChange(
      next.length
        ? next
        : [
            {
              pais: "",
              destino: ""
            }
          ]
    );
  }

  const cleanDestinos = normalizeDestinosDraft(destinos);

  return (
    <div className="rounded-[16px] border border-black/10 bg-white p-3 shadow-sm">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="text-[13px] font-semibold text-[#172033]">Destinos del viaje</h4>
          <p className="mt-0.5 text-[11.5px] font-normal leading-5 text-[#64748b]">
            Cargá uno o más destinos. Sirve para viajes combinados entre países, por ejemplo Punta Cana + Maceió.
          </p>
        </div>

        <button
          type="button"
          onClick={addDestino}
          className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-3 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
        >
          <Plus size={14} />
          Agregar
        </button>
      </div>

      <div className="grid gap-2">
        {destinos.map((item, index) => (
          <div
            key={`destino-${index}`}
            className="grid gap-2 rounded-[14px] border border-black/10 bg-[#f8fafc] p-2.5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_32px]"
          >
            <div>
              <FieldLabel>Destino</FieldLabel>
              <DestinoAutocomplete
                value={item.destino}
                onChange={(destino) => updateDestino(index, { destino })}
                options={options}
                placeholder="Ej: Punta Cana, Maceió, Madrid..."
              />
            </div>

            <div>
              <FieldLabel>País</FieldLabel>
              <TextInput
                value={item.pais}
                onChange={(pais) => updateDestino(index, { pais })}
                placeholder="Ej: República Dominicana, Brasil..."
              />
            </div>

            <div className="flex items-end">
              <button
                type="button"
                onClick={() => removeDestino(index)}
                disabled={destinos.length <= 1 && !item.destino && !item.pais}
                className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
                title="Quitar destino"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {cleanDestinos.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {cleanDestinos.map((item, index) => (
            <span
              key={`${item.destino}-${item.pais}-${index}`}
              className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-[11px] font-semibold text-orange-700"
            >
              {getDestinoDraftLabel(item)}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function PassengerSelector({
  value,
  onChange
}: {
  value: PassengerDraft;
  onChange: (value: PassengerDraft) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const total = value.adultos + value.menores;

  function updateCounter(key: "adultos" | "menores", delta: number) {
    onChange({
      ...value,
      [key]: Math.max(key === "adultos" ? 1 : 0, Number(value[key] || 0) + delta)
    });
  }

  function toggleOpen() {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (rect) {
      setPosition({
        top: rect.bottom + 6,
        left: rect.left
      });
    }

    setOpen((current) => !current);
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleOpen}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-left text-[12px] font-normal text-[#172033] outline-none transition hover:bg-[#f8fafc]"
      >
        <span className="truncate">
          {total} pasajero{total === 1 ? "" : "s"} · {value.adultos} adulto
          {value.adultos === 1 ? "" : "s"}
          {value.menores > 0
            ? ` + ${value.menores} menor${value.menores === 1 ? "" : "es"}`
            : ""}
        </span>

        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open && position ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[900] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div
            className="fixed z-[910] w-[340px] rounded-[18px] border border-black/10 bg-white p-3 shadow-2xl"
            style={{
              top: position.top,
              left: position.left
            }}
          >
            <div className="grid gap-2">
              {[
                { key: "adultos" as const, title: "Adultos", subtitle: "Desde 18 años" },
                { key: "menores" as const, title: "Menores", subtitle: "De 2 a 17 años" }
              ].map((item) => (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 rounded-[14px] bg-[#f8fafc] px-3 py-2"
                >
                  <div>
                    <div className="text-[12px] font-semibold text-[#172033]">{item.title}</div>
                    <div className="text-[11px] font-normal text-[#64748b]">{item.subtitle}</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => updateCounter(item.key, -1)}
                      className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/10 bg-white text-sm font-semibold text-[#334155] hover:bg-[#eef2f7]"
                    >
                      −
                    </button>

                    <div className="w-7 text-center text-[12px] font-semibold text-[#172033]">
                      {value[item.key]}
                    </div>

                    <button
                      type="button"
                      onClick={() => updateCounter(item.key, 1)}
                      className="flex h-8 w-8 items-center justify-center rounded-[10px] border border-black/10 bg-white text-sm font-semibold text-[#334155] hover:bg-[#eef2f7]"
                    >
                      +
                    </button>
                  </div>
                </div>
              ))}

              {value.menores > 0 ? (
                <div>
                  <FieldLabel>Edades menores</FieldLabel>
                  <TextInput
                    value={value.edadesMenores}
                    onChange={(edadesMenores) => onChange({ ...value, edadesMenores })}
                    placeholder="Ej: 7 y 11 años"
                  />
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-1 h-8 rounded-[10px] bg-[#4f7c90] text-[12px] font-medium text-white hover:bg-[#406b7d]"
              >
                Listo
              </button>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function RowMoreMenu({
  onDuplicate,
  onPreview,
  onSendLiveNos,
  onDelete
}: {
  onDuplicate: () => void;
  onPreview: () => void;
  onSendLiveNos: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);

  function calculatePosition() {
    const rect = buttonRef.current?.getBoundingClientRect();

    if (!rect) return null;

    const menuWidth = 230;
    const menuHeight = 188;
    const margin = 10;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const left = Math.min(Math.max(margin, rect.right - menuWidth), viewportWidth - menuWidth - margin);
    const spaceBelow = viewportHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const opensUp = spaceBelow < menuHeight && spaceAbove > spaceBelow;

    const top = opensUp
      ? Math.max(margin, rect.top - menuHeight - 6)
      : Math.min(rect.bottom + 6, viewportHeight - menuHeight - margin);

    return { top, left };
  }

  function closeMenu() {
    setOpen(false);
    setPosition(null);
  }

  function toggleMenu(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (open) {
      closeMenu();
      return;
    }

    const nextPosition = calculatePosition();

    if (!nextPosition) return;

    setPosition(nextPosition);
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;

    function handleReposition() {
      const nextPosition = calculatePosition();

      if (!nextPosition) {
        closeMenu();
        return;
      }

      setPosition(nextPosition);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") closeMenu();
    }

    window.addEventListener("resize", handleReposition);
    window.addEventListener("scroll", handleReposition, true);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("resize", handleReposition);
      window.removeEventListener("scroll", handleReposition, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc]"
      >
        <ChevronDown size={13} />
        Más
      </button>

      {open && position
        ? createPortal(
            <>
              <button
                type="button"
                className="fixed inset-0 z-[900] cursor-default bg-transparent"
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  closeMenu();
                }}
                tabIndex={-1}
                aria-label="Cerrar menú"
              />

              <div
                className="fixed z-[910] w-[230px] rounded-[14px] border border-black/10 bg-white p-1.5 shadow-2xl"
                style={{
                  top: position.top,
                  left: position.left
                }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                }}
              >
                <MenuAction
                  icon={<Copy size={14} />}
                  label="Duplicar"
                  onClick={() => {
                    closeMenu();
                    onDuplicate();
                  }}
                />

                <MenuAction
                  icon={<Eye size={14} />}
                  label="Vista previa real"
                  onClick={() => {
                    closeMenu();
                    onPreview();
                  }}
                />

                <MenuAction
                  icon={<Send size={14} />}
                  label="Enviar por LiveNos"
                  onClick={() => {
                    closeMenu();
                    onSendLiveNos();
                  }}
                />

                <div className="my-1 h-px bg-black/10" />

                <MenuAction
                  danger
                  icon={<Trash2 size={14} />}
                  label="Eliminar"
                  onClick={() => {
                    closeMenu();
                    onDelete();
                  }}
                />
              </div>
            </>,
            document.body
          )
        : null}
    </>
  );
}

function HotelSearchBox({
  value,
  onChange,
  onSelect
}: {
  value: string;
  onChange: (value: string) => void;
  onSelect: (hotel: HotelMaestroLite) => void;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number; width: number } | null>(
    null
  );
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(false);
  const [hoteles, setHoteles] = useState<HotelMaestroLite[]>([]);
  const timerRef = useRef<number | null>(null);

  function openFloating() {
    const rect = wrapperRef.current?.getBoundingClientRect();

    if (rect) {
      setPosition({
        top: rect.bottom + 6,
        left: rect.left,
        width: rect.width
      });
    }

    setOpen(true);
  }

  useEffect(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
    }

    if (value.trim().length < 2) {
      setHoteles([]);
      return;
    }

    timerRef.current = window.setTimeout(() => {
      setLoading(true);

      void fetchHotelesMaestrosFromDb(value)
        .then((items) => {
          setHoteles(items);
          openFloating();
        })
        .finally(() => setLoading(false));
    }, 350);

    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [value]);

  return (
    <>
      <div
        ref={wrapperRef}
        className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3"
      >
        <Search size={14} className="shrink-0 text-[#94a3b8]" />

        <input
          value={value}
          onChange={(event) => {
            onChange(event.target.value);
            openFloating();
          }}
          onFocus={openFloating}
          placeholder="Buscar por nombre, ubicación o dirección..."
          className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
        />

        {loading ? <Loader2 size={14} className="shrink-0 animate-spin text-[#64748b]" /> : null}
      </div>

      {open && position ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[900] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div
            className="fixed z-[910] max-h-72 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-2xl"
            style={{
              top: position.top,
              left: position.left,
              width: position.width
            }}
          >
            {hoteles.length === 0 ? (
              <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                {value.trim().length < 2
                  ? "Escribí al menos 2 letras."
                  : "Sin hoteles encontrados."}
              </div>
            ) : (
              hoteles.map((hotel) => (
                <button
                  key={hotel.id}
                  type="button"
                  onClick={() => {
                    onSelect(hotel);
                    setOpen(false);
                  }}
                  className="flex w-full items-start gap-3 rounded-[10px] px-3 py-2 text-left hover:bg-[#f8fafc]"
                >
                  {hotel.imagen_url ? (
                    <img
                      src={hotel.imagen_url}
                      alt={hotel.nombre}
                      className="h-10 w-12 rounded-[10px] object-cover"
                    />
                  ) : (
                    <div className="flex h-10 w-12 items-center justify-center rounded-[10px] bg-[#f1f5f9] text-[#64748b]">
                      <Hotel size={15} />
                    </div>
                  )}

                  <span className="min-w-0">
                    <span className="block truncate text-[12px] font-semibold text-[#172033]">
                      {hotel.nombre}
                    </span>

                    <span className="block truncate text-[11px] font-normal text-[#64748b]">
                      {[hotel.ubicacion, hotel.categoria ? `${hotel.categoria}★` : ""]
                        .filter(Boolean)
                        .join(" · ") || "Sin ubicación"}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </>
      ) : null}
    </>
  );
}

function ResourceCheckList<T extends { id: string }>({
  title,
  empty,
  items,
  selectedIds,
  getTitle,
  getSubtitle,
  onChange
}: {
  title: string;
  empty: string;
  items: T[];
  selectedIds: string[];
  getTitle: (item: T) => string;
  getSubtitle: (item: T) => string;
  onChange: (ids: string[]) => void;
}) {
  function toggle(id: string) {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
      return;
    }

    onChange([...selectedIds, id]);
  }

  return (
    <section className="min-w-0 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
      <div className="mb-2 flex min-w-0 items-center justify-between gap-2">
        <h4 className="min-w-0 truncate text-[12px] font-semibold text-[#172033]">{title}</h4>

        <span className="shrink-0 rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/10">
          {selectedIds.length}/{items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <div className="text-[11.5px] font-normal text-[#94a3b8]">{empty}</div>
      ) : (
        <div className="grid min-w-0 gap-1.5">
          {items.map((item) => {
            const checked = selectedIds.includes(item.id);

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => toggle(item.id)}
                className={[
                  "flex min-w-0 items-start gap-2 overflow-hidden rounded-[12px] border px-2.5 py-2 text-left transition",
                  checked
                    ? "border-[#4f7c90]/30 bg-[#eef6f7]"
                    : "border-black/10 bg-white hover:bg-[#f8fafc]"
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                    checked ? "border-[#4f7c90] bg-[#4f7c90] text-white" : "border-black/20 bg-white"
                  ].join(" ")}
                >
                  {checked ? <Check size={11} /> : null}
                </span>

                <span className="min-w-0 flex-1 overflow-hidden">
                  <span className="block max-w-full truncate text-[11.5px] font-semibold text-[#172033]">
                    {getTitle(item)}
                  </span>

                  <span className="block max-w-full truncate text-[10.5px] font-normal text-[#64748b]">
                    {getSubtitle(item)}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function PresupuestoFilters({
  filters,
  vendedores,
  sucursales,
  onSetFilter,
  onReset
}: {
  filters: PresupuestosV2Filters;
  vendedores: ProfileLite[];
  sucursales: SucursalLite[];
  onSetFilter: <K extends keyof PresupuestosV2Filters>(
    key: K,
    value: PresupuestosV2Filters[K]
  ) => void;
  onReset: () => void;
}) {
  const vendedorOptions = useMemo<SelectOption[]>(
    () => [
      { value: "todos", label: "Todos" },
      ...vendedores.map((vendedor) => ({
        value: vendedor.id,
        label:
          `${vendedor.nombre || ""} ${vendedor.apellido || ""}`.trim() ||
          vendedor.email ||
          "Usuario"
      }))
    ],
    [vendedores]
  );

  const sucursalOptions = useMemo<SelectOption[]>(
    () => [
      { value: "todas", label: "Todas" },
      ...sucursales.map((sucursal) => ({
        value: sucursal.id,
        label: sucursal.nombre
      }))
    ],
    [sucursales]
  );

  return (
    <div className="grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_140px_140px_180px_170px_130px_130px_auto]">
      <div>
        <FieldLabel>Buscar</FieldLabel>

        <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
          <Search size={14} className="shrink-0 text-[#94a3b8]" />

          <input
            value={filters.search}
            onChange={(event) => onSetFilter("search", event.target.value)}
            placeholder="Cliente, destino, teléfono, número..."
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
          />
        </div>
      </div>

      <div>
        <FieldLabel>Estado</FieldLabel>
        <NosturSelect
          value={filters.estado}
          onChange={(value) => onSetFilter("estado", value as PresupuestosV2Filters["estado"])}
          options={ESTADO_OPTIONS}
        />
      </div>

      <div>
        <FieldLabel>Marca</FieldLabel>
        <NosturSelect
          value={filters.marca}
          onChange={(value) => onSetFilter("marca", value as "TODAS" | PresupuestoMarca)}
          options={MARCA_OPTIONS}
        />
      </div>

      <div>
        <FieldLabel>Vendedor</FieldLabel>
        <NosturSelect
          value={filters.vendedorId}
          onChange={(value) => onSetFilter("vendedorId", value)}
          options={vendedorOptions}
        />
      </div>

      <div>
        <FieldLabel>Sucursal</FieldLabel>
        <NosturSelect
          value={filters.sucursalId}
          onChange={(value) => onSetFilter("sucursalId", value)}
          options={sucursalOptions}
        />
      </div>

      <div>
        <FieldLabel>Desde</FieldLabel>
        <NosturDatePicker
          value={filters.desde}
          onChange={(value) => onSetFilter("desde", value)}
          placeholder="Desde"
        />
      </div>

      <div>
        <FieldLabel>Hasta</FieldLabel>
        <NosturDatePicker
          value={filters.hasta}
          min={filters.desde || undefined}
          onChange={(value) => onSetFilter("hasta", value)}
          placeholder="Hasta"
        />
      </div>

      <div className="flex items-end">
        <button
          type="button"
          onClick={onReset}
          className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
        >
          Limpiar
        </button>
      </div>
    </div>
  );
}

/* =========================================================
   MODAL NUEVO PRESUPUESTO
========================================================= */

function NuevoPresupuestoModal({
  vendedores,
  sucursales,
  destinos,
  currentProfile,
  saving,
  onClose,
  onCreate
}: {
  vendedores: ProfileLite[];
  sucursales: SucursalLite[];
  destinos: SelectOption[];
  currentProfile: ProfileLite | null;
  saving: boolean;
  onClose: () => void;
  onCreate: (draft: CreatePresupuestoV2Draft, nextMode: "IA" | "MANUAL") => Promise<boolean>;
}) {
  const today = todayIsoDate();
  const searchTimer = useRef<number | null>(null);
  const nuevoDraftKey = getNuevoPresupuestoDraftKey();
  const savedNuevoDraft = readJsonDraft<NuevoPresupuestoDraftStorage>(nuevoDraftKey);
  const [localError, setLocalError] = useState<string | null>(null);
  const [searchingCliente, setSearchingCliente] = useState(false);
  const [clienteDetectado, setClienteDetectado] = useState<ClienteDetectado | null>(null);

  const defaultVendedorId =
    isSellerProfile(currentProfile) && currentProfile?.id ? currentProfile.id : null;

  const defaultSucursalId =
    isSellerProfile(currentProfile) && currentProfile?.sucursal_id
      ? currentProfile.sucursal_id
      : null;

  const [draft, setDraft] = useState<CreatePresupuestoV2Draft>(() => {
    if (savedNuevoDraft?.version === PRESUPUESTOS_DRAFT_VERSION && savedNuevoDraft.draft) {
      const savedDraftRecord = savedNuevoDraft.draft as unknown as Record<string, unknown>;

      return {
        cliente_nombre: savedNuevoDraft.draft.cliente_nombre || "",
        cliente_telefono: savedNuevoDraft.draft.cliente_telefono || "",
        cliente_email: savedNuevoDraft.draft.cliente_email || "",
        destino_principal: savedNuevoDraft.draft.destino_principal || "",
        destino_detalle: String(savedDraftRecord.destino_detalle || "").trim() || null,
        fecha_salida: savedNuevoDraft.draft.fecha_salida || "",
        fecha_regreso: savedNuevoDraft.draft.fecha_regreso || "",
        adultos: savedNuevoDraft.draft.adultos || 2,
        menores: savedNuevoDraft.draft.menores || 0,
        edades_menores: savedNuevoDraft.draft.edades_menores || null,
        vendedor_id: savedNuevoDraft.draft.vendedor_id || defaultVendedorId,
        sucursal_id: savedNuevoDraft.draft.sucursal_id || defaultSucursalId,
        metadata: safeRecord(savedDraftRecord.metadata)
      } as unknown as CreatePresupuestoV2Draft;
    }

    return {
      cliente_nombre: "",
      cliente_telefono: "",
      cliente_email: "",
      destino_principal: "",
      destino_detalle: null,
      fecha_salida: "",
      fecha_regreso: "",
      adultos: 2,
      menores: 0,
      vendedor_id: defaultVendedorId,
      sucursal_id: defaultSucursalId,
      metadata: {}
    } as unknown as CreatePresupuestoV2Draft;
  });

  const [passengers, setPassengers] = useState<PassengerDraft>(() => {
    if (savedNuevoDraft?.version === PRESUPUESTOS_DRAFT_VERSION && savedNuevoDraft.passengers) {
      return {
        adultos: savedNuevoDraft.passengers.adultos || 2,
        menores: savedNuevoDraft.passengers.menores || 0,
        edadesMenores: savedNuevoDraft.passengers.edadesMenores || ""
      };
    }

    return {
      adultos: 2,
      menores: 0,
      edadesMenores: ""
    };
  });

  const [destinosPresupuestados, setDestinosPresupuestados] = useState<PresupuestoDestinoDraft[]>(() => {
    if (
      savedNuevoDraft?.version === PRESUPUESTOS_DRAFT_VERSION &&
      Array.isArray(savedNuevoDraft.destinosPresupuestados) &&
      savedNuevoDraft.destinosPresupuestados.length > 0
    ) {
      return normalizeDestinosDraft(savedNuevoDraft.destinosPresupuestados);
    }

    return getDestinosFromPresupuestoLike(savedNuevoDraft?.draft || null);
  });

  useEffect(() => {
    const destinosClean = normalizeDestinosDraft(destinosPresupuestados);
    const destinoPrincipal = buildDestinoPrincipalFromDraft(destinosClean);
    const destinoDetalle = buildDestinoDetalleFromDraft(destinosClean);

    writeJsonDraft<NuevoPresupuestoDraftStorage>(nuevoDraftKey, {
      version: PRESUPUESTOS_DRAFT_VERSION,
      draft: {
        ...draft,
        destino_principal: destinoPrincipal,
        destino_detalle: destinoDetalle,
        adultos: passengers.adultos,
        menores: passengers.menores,
        edades_menores: passengers.edadesMenores || null,
        metadata: {
          ...safeRecord((draft as Record<string, unknown>).metadata),
          destinos_presupuestados: destinosClean
        }
      } as CreatePresupuestoV2Draft,
      passengers,
      destinosPresupuestados: destinosClean,
      updatedAt: new Date().toISOString()
    });
  }, [nuevoDraftKey, draft, passengers, destinosPresupuestados]);

  const noches = diffNights(draft.fecha_salida, draft.fecha_regreso);

  const vendedorOptions: SelectOption[] = [
    { value: "sin_vendedor", label: "Sin vendedor" },
    ...vendedores.map((vendedor) => ({
      value: vendedor.id,
      label:
        `${vendedor.nombre || ""} ${vendedor.apellido || ""}`.trim() ||
        vendedor.email ||
        "Usuario"
    }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "sin_sucursal", label: "Sin sucursal" },
    ...sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  function setField<K extends keyof CreatePresupuestoV2Draft>(
    key: K,
    value: CreatePresupuestoV2Draft[K]
  ) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleTelefonoChange(value: string) {
    setField("cliente_telefono", value);
    setClienteDetectado(null);

    if (searchTimer.current) window.clearTimeout(searchTimer.current);

    searchTimer.current = window.setTimeout(() => {
      if (normalizePhone(value).length < 6) return;

      setSearchingCliente(true);

      void searchClienteByTelefono(value)
        .then((cliente) => {
          setClienteDetectado(cliente);

          if (cliente) {
            setDraft((current) => ({
              ...current,
              cliente_nombre: current.cliente_nombre || cliente.nombre || "",
              cliente_telefono: current.cliente_telefono || cliente.telefono || value,
              cliente_email: current.cliente_email || cliente.email || ""
            }));
          }
        })
        .finally(() => setSearchingCliente(false));
    }, 350);
  }

  function useClienteDetectado() {
    if (!clienteDetectado) return;

    setDraft((current) => ({
      ...current,
      cliente_nombre: clienteDetectado.nombre || current.cliente_nombre,
      cliente_telefono: clienteDetectado.telefono || current.cliente_telefono,
      cliente_email: clienteDetectado.email || current.cliente_email
    }));
  }

  function validate(): string | null {
    const destinosClean = normalizeDestinosDraft(destinosPresupuestados);

    if (!String(draft.cliente_nombre || "").trim()) return "Ingresá el nombre del cliente.";
    if (!String(draft.cliente_telefono || "").trim()) return "Ingresá el teléfono del cliente.";
    if (!destinosClean.some((item) => item.destino || item.pais)) return "Ingresá al menos un destino.";
    if (!draft.fecha_salida) return "Seleccioná la fecha de salida.";
    if (!draft.fecha_regreso) return "Seleccioná la fecha de regreso.";
    if (draft.fecha_regreso <= draft.fecha_salida) return "La fecha de regreso debe ser posterior a la salida.";
    if (Number(passengers.adultos || 0) < 1) return "El presupuesto debe tener al menos 1 adulto.";

    return null;
  }

  async function handleCreate(nextMode: "IA" | "MANUAL") {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    const destinosClean = normalizeDestinosDraft(destinosPresupuestados);
    const destinoPrincipal = buildDestinoPrincipalFromDraft(destinosClean);
    const destinoDetalle = buildDestinoDetalleFromDraft(destinosClean);

    const created = await onCreate(
      {
        ...draft,
        destino_principal: destinoPrincipal,
        destino_detalle: destinoDetalle,
        adultos: passengers.adultos,
        menores: passengers.menores,
        edades_menores: passengers.edadesMenores || null,
        vendedor_id: draft.vendedor_id || null,
        sucursal_id: draft.sucursal_id || null,
        metadata: {
          ...safeRecord((draft as Record<string, unknown>).metadata),
          destinos_presupuestados: destinosClean
        }
      } as CreatePresupuestoV2Draft,
      nextMode
    );

    if (created) removeJsonDraft(nuevoDraftKey);
  }

  function handleSalidaChange(value: string) {
    setField("fecha_salida", value);

    if (!draft.fecha_regreso || draft.fecha_regreso <= value) {
      setField("fecha_regreso", addDaysIsoDate(value, 7));
    }
  }

  return (
    <ModalShell
      title="Nuevo presupuesto"
      subtitle="Primero cargá la carátula. Después podés pegar texto para IA o crear vacío."
      onClose={onClose}
      variant="side"
    >
      <InlineError message={localError} onClose={() => setLocalError(null)} />

      <div className="grid gap-3">
        <section className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold text-[#172033]">Carátula</h3>
              <p className="text-[11.5px] font-normal text-[#64748b]">
                Datos base del pasajero y del viaje.
              </p>
            </div>

            <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
              ALMUNDO
            </span>
          </div>

          <div className="grid gap-2.5 md:grid-cols-2">
            <div>
              <FieldLabel>Nombre y apellido</FieldLabel>
              <TextInput
                value={draft.cliente_nombre || ""}
                onChange={(value) => setField("cliente_nombre", value)}
                placeholder="Nombre del pasajero / familia"
              />
            </div>

            <div>
              <FieldLabel>Teléfono</FieldLabel>
              <TextInput
                value={draft.cliente_telefono || ""}
                onChange={handleTelefonoChange}
                placeholder="+549..."
                inputMode="tel"
              />
            </div>

            <div>
              <FieldLabel>Email</FieldLabel>
              <TextInput
                value={draft.cliente_email || ""}
                onChange={(value) => setField("cliente_email", value)}
                placeholder="cliente@email.com"
                inputMode="email"
              />
            </div>

            <div className="md:col-span-2">
              <DestinosMultiplesEditor
                value={destinosPresupuestados}
                onChange={(nextDestinos) => {
                  const destinosClean = normalizeDestinosDraft(nextDestinos);
                  const destinoPrincipal = buildDestinoPrincipalFromDraft(destinosClean);
                  const destinoDetalle = buildDestinoDetalleFromDraft(destinosClean);

                  setDestinosPresupuestados(nextDestinos);

                  setDraft((current) => ({
                    ...current,
                    destino_principal: destinoPrincipal,
                    destino_detalle: destinoDetalle,
                    metadata: {
                      ...safeRecord((current as Record<string, unknown>).metadata),
                      destinos_presupuestados: destinosClean
                    }
                  } as CreatePresupuestoV2Draft));
                }}
                options={destinos}
              />
            </div>

            <div>
              <FieldLabel>Fecha salida</FieldLabel>
              <NosturDatePicker
                value={draft.fecha_salida || ""}
                min={today}
                onChange={handleSalidaChange}
                placeholder="Seleccionar salida"
              />
            </div>

            <div>
              <FieldLabel>Fecha regreso</FieldLabel>
              <NosturDatePicker
                value={draft.fecha_regreso || ""}
                min={draft.fecha_salida || today}
                onChange={(value) => setField("fecha_regreso", value)}
                placeholder="Seleccionar regreso"
              />
            </div>

            <div>
              <FieldLabel>Pasajeros</FieldLabel>
              <PassengerSelector value={passengers} onChange={setPassengers} />
            </div>

            <div>
              <FieldLabel>Noches</FieldLabel>
              <div className="flex h-8 items-center rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#172033]">
                {noches ? `${noches} noche${noches === 1 ? "" : "s"}` : "—"}
              </div>
            </div>
          </div>

          {searchingCliente ? (
            <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-sky-200 bg-sky-50 px-3 py-2 text-[12px] font-medium text-sky-700">
              <Loader2 size={14} className="animate-spin" />
              Buscando cliente existente...
            </div>
          ) : null}

          {clienteDetectado ? (
            <div className="mt-3 rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-[12px]">
              <div className="mb-2 font-semibold text-emerald-800">Cliente encontrado</div>

              <div className="grid gap-1 font-normal text-emerald-700">
                <div>{clienteDetectado.nombre || "Sin nombre"}</div>
                <div>{clienteDetectado.telefono || "Sin teléfono"}</div>
                {clienteDetectado.email ? <div>{clienteDetectado.email}</div> : null}
              </div>

              <button
                type="button"
                onClick={useClienteDetectado}
                className="mt-3 h-8 rounded-[10px] bg-emerald-700 px-3 text-[12px] font-medium text-white hover:bg-emerald-800"
              >
                Usar datos
              </button>
            </div>
          ) : null}
        </section>

        <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
          <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Equipo responsable</h3>

          <div className="grid gap-2.5 md:grid-cols-2">
            <div>
              <FieldLabel>Vendedor</FieldLabel>
              <NosturSelect
                value={draft.vendedor_id || "sin_vendedor"}
                onChange={(value) => setField("vendedor_id", value === "sin_vendedor" ? null : value)}
                options={vendedorOptions}
              />
            </div>

            <div>
              <FieldLabel>Sucursal</FieldLabel>
              <NosturSelect
                value={draft.sucursal_id || "sin_sucursal"}
                onChange={(value) => setField("sucursal_id", value === "sin_sucursal" ? null : value)}
                options={sucursalOptions}
              />
            </div>
          </div>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
        >
          Cancelar
        </button>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreate("IA")}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#172033] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-black disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            Crear y pegar texto
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => void handleCreate("MANUAL")}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Crear vacío
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

/* =========================================================
   MODAL IA
========================================================= */

function PreviewDetectedList({
  title,
  emptyText,
  items,
  renderItem
}: {
  title: string;
  emptyText: string;
  items: Record<string, unknown>[];
  renderItem: (item: Record<string, unknown>, index: number) => ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-[14px] font-semibold text-[#172033]">{title}</h3>

        <span className="rounded-md bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/10">
          {items.length}
        </span>
      </div>

      {items.length === 0 ? (
        <EmptyState text={emptyText} />
      ) : (
        <div className="grid gap-1.5">
          {items.map((item, index) => (
            <div
              key={`${title}-${index}`}
              className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-3"
            >
              {renderItem(item, index)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PresupuestoIaModal({
  presupuesto,
  saving,
  onClose,
  onApply
}: {
  presupuesto: PresupuestoV2;
  saving: boolean;
  onClose: () => void;
  onApply: (payload: PresupuestoIaApplyPayload) => Promise<void>;
}) {
  const iaDraftKey = getPresupuestoIaDraftKey(presupuesto.id);
  const savedIaDraft = readJsonDraft<PresupuestoIaDraftStorage>(iaDraftKey);

  const [rawText, setRawText] = useState(() => {
    if (savedIaDraft?.version === PRESUPUESTOS_DRAFT_VERSION) return savedIaDraft.rawText || "";
    return "";
  });

  const [processingIa, setProcessingIa] = useState(false);
  const [aiPreview, setAiPreview] = useState<PresupuestoIaPreview | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    writeJsonDraft<PresupuestoIaDraftStorage>(iaDraftKey, {
      version: PRESUPUESTOS_DRAFT_VERSION,
      rawText,
      updatedAt: new Date().toISOString()
    });
  }, [iaDraftKey, rawText]);

  async function handleProcess() {
    if (!rawText.trim()) {
      setLocalError("Pegá el texto completo del presupuesto antes de procesar.");
      return;
    }

    setProcessingIa(true);
    setLocalError(null);
    setAiPreview(null);

    try {
      const { data, error } = await supabase.functions.invoke("presupuestos-ai-parser", {
        body: {
          mode: "TEXT",
          entidad_tipo: "PRESUPUESTO",
          text: rawText,
          caratula: {
            cliente_nombre: presupuesto.cliente_nombre,
            destino_principal: presupuesto.destino_principal,
            destino_detalle: presupuesto.destino_detalle,
            destinos_presupuestados: getDestinosFromPresupuestoLike(presupuesto),
            fecha_salida: presupuesto.fecha_salida,
            fecha_regreso: presupuesto.fecha_regreso,
            adultos: presupuesto.adultos,
            menores: presupuesto.menores,
            edades_menores: presupuesto.edades_menores
          },
          schema_hint: {
            objetivo:
              "Devolver presupuesto como opciones comerciales flexibles. Cada opción puede tener vuelos, hoteles, servicios, precio total, tarifas por pasajero/tipo pasajero, promociones, descuentos y formas de pago.",
            destinos:
              "Detectar uno o más destinos. Si hay destinos de distintos países, devolver destinos_presupuestados como array de objetos { pais, destino }. Ejemplo: [{ pais: 'República Dominicana', destino: 'Punta Cana' }, { pais: 'Brasil', destino: 'Maceió' }].",
            no_asumir_precio_por_pasajero:
              "No dividir total por pasajeros salvo que el texto lo indique explícitamente.",
            reglas_pagos:
              "Si aparecen cuotas sin tarjeta/banco explícito, tratarlas como pagos a cuenta del pasajero, no como tarjeta de crédito.",
            metadata_recomendada: [
              "destinos_presupuestados",
              "formas_pago",
              "promociones",
              "descuentos",
              "tarifas_pasajeros",
              "composicion_precio_texto",
              "vuelos_texto",
              "hoteles_texto",
              "servicios_texto",
              "mostrar_precio_por_pasajero"
            ]
          }
        }
      });

      if (error) {
        setLocalError(`No se pudo procesar con IA: ${error.message}`);
        return;
      }

      const response = (data || {}) as Record<string, unknown>;

      if (response.error) {
        setLocalError(String(response.detail || response.error));
        return;
      }

      const parsed = safeRecord(response.parsed);

      if (!Object.keys(parsed).length) {
        setLocalError("La IA no devolvió información procesable.");
        return;
      }

      setAiPreview(buildIaPreview(rawText, parsed));
    } catch (err) {
      setLocalError(err instanceof Error ? err.message : "No se pudo procesar con IA.");
    } finally {
      setProcessingIa(false);
    }
  }

  async function handleApply() {
    if (!aiPreview) {
      setLocalError("Primero procesá el texto con IA y revisá la previsualización.");
      return;
    }

    await onApply({
      raw_text: aiPreview.raw_text,
      parsed: aiPreview.parsed
    });

    removeJsonDraft(iaDraftKey);
  }

  return (
    <ModalShell
      title="Presupuesto por IA"
      subtitle="Pegá la cotización completa. La IA arma vuelos, hoteles, servicios y opciones comerciales."
      onClose={onClose}
      maxWidth="max-w-7xl"
    >
      <InlineError message={localError} onClose={() => setLocalError(null)} />

      <div className="grid gap-3 lg:grid-cols-[400px_minmax(0,1fr)]">
        <aside className="grid content-start gap-3">
          <section className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
            <div className="mb-3">
              <h3 className="text-[14px] font-semibold text-[#172033]">Texto completo</h3>
              <p className="text-[11.5px] font-normal leading-5 text-[#64748b]">
                Pegá la cotización completa. Incluí vuelos, hoteles, tarifas, promos,
                condiciones y pagos.
              </p>
            </div>

            <TextArea
              value={rawText}
              onChange={(value) => {
                setRawText(value);
                setLocalError(null);
              }}
              placeholder="Pegá acá todo el presupuesto completo."
              minHeight={480}
              disabled={processingIa || saving}
            />

            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={processingIa || saving || !rawText.trim()}
                onClick={() => void handleProcess()}
                className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white hover:bg-[#406b7d] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {processingIa ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                {processingIa ? "Procesando..." : "Previsualizar con IA"}
              </button>

              {aiPreview ? (
                <button
                  type="button"
                  disabled={processingIa || saving}
                  onClick={() => setAiPreview(null)}
                  className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-white px-4 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  <RefreshCcw size={14} />
                  Limpiar previsualización
                </button>
              ) : null}
            </div>
          </section>

          <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">
              Carátula usada como contexto
            </h3>

            <div className="grid gap-2 text-[12px]">
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Cliente</FieldLabel>
                <div className="font-semibold text-[#172033]">{presupuesto.cliente_nombre || "—"}</div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Destino/s</FieldLabel>
                <div className="grid gap-1 font-semibold text-[#172033]">
                  {getDestinosFromPresupuestoLike(presupuesto).map((item, index) => (
                    <div key={`${item.destino}-${item.pais}-${index}`}>
                      {getDestinoDraftLabel(item)}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Fechas</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {formatDate(presupuesto.fecha_salida)} al {formatDate(presupuesto.fecha_regreso)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Pasajeros</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {presupuesto.adultos} adulto{presupuesto.adultos === 1 ? "" : "s"}
                  {presupuesto.menores > 0
                    ? ` + ${presupuesto.menores} menor${presupuesto.menores === 1 ? "" : "es"}`
                    : ""}
                  {presupuesto.edades_menores ? ` · ${presupuesto.edades_menores}` : ""}
                </div>
              </div>
            </div>
          </section>
        </aside>

        <main className="min-w-0">
          {!aiPreview ? (
            <div className="flex min-h-[600px] items-center justify-center rounded-[18px] border border-dashed border-black/15 bg-white/62 p-8 text-center backdrop-blur-xl">
              <div className="max-w-md">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#eef6f7] text-[#4f7c90]">
                  {processingIa ? <Loader2 size={26} className="animate-spin" /> : <Search size={26} />}
                </div>

                <h3 className="text-[17px] font-semibold text-[#172033]">
                  {processingIa ? "Analizando presupuesto..." : "Todavía no hay previsualización"}
                </h3>

                <p className="mt-2 text-[13px] font-normal leading-6 text-[#64748b]">
                  Pegá el texto completo y tocá “Previsualizar con IA”.
                </p>
              </div>
            </div>
          ) : (
            <div className="grid gap-3">
              <section className="rounded-[18px] border border-[#4f7c90]/20 bg-[#eef6f7] p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.16em] text-[#4f7c90]">
                      Previsualización IA
                    </div>

                    <h3 className="mt-1 text-[17px] font-semibold text-[#172033]">
                      {aiPreview.resumen_humano.titulo}
                    </h3>

                    <p className="mt-2 text-[12px] font-normal leading-5 text-[#475569]">
                      {aiPreview.resumen_humano.descripcion}
                    </p>
                  </div>

                  {aiPreview.resumen_humano.precio_final_detectado ? (
                    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-right">
                      <div className="text-[10px] font-medium uppercase text-emerald-700">
                        Precio detectado
                      </div>
                      <div className="text-[14px] font-semibold text-emerald-800">
                        {aiPreview.resumen_humano.precio_final_detectado}
                      </div>
                    </div>
                  ) : null}
                </div>
              </section>

              <section className="grid gap-2.5 md:grid-cols-4">
                <SmallMetric label="Aéreos" value={aiPreview.vuelos.length} icon={<Plane size={16} />} />
                <SmallMetric label="Hoteles" value={aiPreview.hoteles.length} icon={<Hotel size={16} />} />
                <SmallMetric
                  label="Servicios"
                  value={aiPreview.servicios.length}
                  icon={<PackageCheck size={16} />}
                />
                <SmallMetric
                  label="Opciones"
                  value={aiPreview.opciones_comerciales.length}
                  icon={<BadgeDollarSign size={16} />}
                />
              </section>

              {aiPreview.resumen_humano.advertencias.length > 0 ? (
                <section className="rounded-[16px] border border-amber-200 bg-amber-50 p-3">
                  <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-amber-800">
                    <AlertTriangle size={16} />
                    Revisar antes de aplicar
                  </div>

                  <div className="grid gap-1 text-[12px] font-normal leading-5 text-amber-800">
                    {aiPreview.resumen_humano.advertencias.map((item, index) => (
                      <div key={`advertencia-${index}`}>• {item}</div>
                    ))}
                  </div>
                </section>
              ) : null}

              <PreviewDetectedList
                title="Vuelos detectados"
                emptyText="No se detectaron vuelos."
                items={aiPreview.vuelos}
                renderItem={(item, index) => (
                  <div>
                    <div className="mb-1 text-[12px] font-semibold text-[#172033]">
                      {getPreviewValue(item, ["titulo", "nombre"]) || `Vuelo ${index + 1}`}
                    </div>

                    <div className="whitespace-pre-wrap text-[11.5px] font-normal leading-5 text-[#475569]">
                      {buildFlightRawText(item, "Sin detalle de vuelo.")}
                    </div>
                  </div>
                )}
              />

              <PreviewDetectedList
                title="Hoteles detectados"
                emptyText="No se detectaron hoteles."
                items={aiPreview.hoteles}
                renderItem={(item, index) => (
                  <div>
                    <div className="mb-1 text-[12px] font-semibold text-[#172033]">
                      {getPreviewValue(item, ["nombre", "titulo"]) || `Hotel ${index + 1}`}
                    </div>

                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10.5px] font-medium text-[#64748b]">
                      {getPreviewValue(item, ["destino"]) ? (
                        <span>{getPreviewValue(item, ["destino"])}</span>
                      ) : null}
                      {getPreviewValue(item, ["zona", "ubicacion"]) ? (
                        <span>{getPreviewValue(item, ["zona", "ubicacion"])}</span>
                      ) : null}
                      {getPreviewValue(item, ["regimen"]) ? (
                        <span>{getPreviewValue(item, ["regimen"])}</span>
                      ) : null}
                      {getPreviewValue(item, ["habitacion"]) ? (
                        <span>{getPreviewValue(item, ["habitacion"])}</span>
                      ) : null}
                    </div>

                    <div className="whitespace-pre-wrap text-[11.5px] font-normal leading-5 text-[#475569]">
                      {buildHotelDescription(item) || "Sin descripción de hotel."}
                    </div>
                  </div>
                )}
              />

              <PreviewDetectedList
                title="Servicios detectados"
                emptyText="No se detectaron servicios."
                items={aiPreview.servicios}
                renderItem={(item, index) => (
                  <div>
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <div className="text-[12px] font-semibold text-[#172033]">
                        {getPreviewValue(item, ["nombre", "titulo"]) || `Servicio ${index + 1}`}
                      </div>

                      <span className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#64748b]">
                        {getPreviewValue(item, ["tipo"]) || "OTRO"}
                      </span>
                    </div>

                    <div className="whitespace-pre-wrap text-[11.5px] font-normal leading-5 text-[#475569]">
                      {getPreviewValue(item, ["descripcion", "texto_libre", "raw_text"]) ||
                        "Sin descripción de servicio."}
                    </div>
                  </div>
                )}
              />

              <PreviewDetectedList
                title="Opciones comerciales detectadas"
                emptyText="No se detectaron opciones comerciales/precios."
                items={aiPreview.opciones_comerciales}
                renderItem={(item, index) => (
                  <div>
                    <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {getPreviewValue(item, ["nombre", "titulo"]) || `Opción ${index + 1}`}
                        </div>

                        {getPreviewValue(item, ["subtitulo"]) ? (
                          <div className="mt-0.5 text-[11.5px] font-normal text-[#64748b]">
                            {getPreviewValue(item, ["subtitulo"])}
                          </div>
                        ) : null}
                      </div>

                      {formatPreviewPrice(item) ? (
                        <div className="rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-right">
                          <div className="text-[10px] font-medium uppercase text-emerald-700">
                            Total paquete
                          </div>

                          <div className="text-[14px] font-semibold text-emerald-800">
                            {formatPreviewPrice(item)}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[10.5px] font-medium text-amber-800">
                          Sin precio claro
                        </div>
                      )}
                    </div>

                    {getPreviewValue(item, ["descripcion"]) ? (
                      <div className="mb-2 whitespace-pre-wrap text-[11.5px] font-normal leading-5 text-[#475569]">
                        {getPreviewValue(item, ["descripcion"])}
                      </div>
                    ) : null}

                    <div className="grid gap-2 md:grid-cols-2">
                      {getPreviewValue(item, ["incluye_resumen", "incluye"]) ? (
                        <div className="whitespace-pre-wrap rounded-[12px] border border-emerald-200 bg-emerald-50 p-2 text-[11.5px] font-normal leading-5 text-emerald-800">
                          <strong>Incluye:</strong>
                          <br />
                          {getPreviewValue(item, ["incluye_resumen", "incluye"])}
                        </div>
                      ) : null}

                      {getPreviewValue(item, ["no_incluye_resumen", "no_incluye"]) ? (
                        <div className="whitespace-pre-wrap rounded-[12px] border border-red-200 bg-red-50 p-2 text-[11.5px] font-normal leading-5 text-red-800">
                          <strong>No incluye:</strong>
                          <br />
                          {getPreviewValue(item, ["no_incluye_resumen", "no_incluye"])}
                        </div>
                      ) : null}
                    </div>

                    {getPreviewValue(item, ["forma_pago_resumen", "forma_pago"]) ? (
                      <div className="mt-2 whitespace-pre-wrap rounded-[12px] border border-sky-200 bg-sky-50 p-2 text-[11.5px] font-normal leading-5 text-sky-800">
                        <strong>Forma de pago:</strong>
                        <br />
                        {getPreviewValue(item, ["forma_pago_resumen", "forma_pago"])}
                      </div>
                    ) : null}
                  </div>
                )}
              />

              <div className="sticky bottom-0 rounded-[16px] border border-black/10 bg-white/95 p-3 shadow-xl backdrop-blur">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[12px] font-normal text-[#64748b]">
                    Revisá la información. Al aplicar reemplaza solo contenido previo generado por IA.
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={saving || processingIa}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:opacity-50"
                    >
                      <X size={14} />
                      Cerrar
                    </button>

                    <button
                      type="button"
                      disabled={saving || processingIa || !aiPreview}
                      onClick={() => void handleApply()}
                      className="inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-emerald-200 bg-emerald-50 px-3 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      Aplicar contenido
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </ModalShell>
  );
}

/* =========================================================
   MODAL MANUAL
========================================================= */

function WizardStepButton({
  active,
  done,
  number,
  title,
  subtitle,
  onClick
}: {
  active: boolean;
  done: boolean;
  number: number;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-w-0 items-center gap-2 rounded-[14px] border px-3 py-2 text-left transition",
        active
          ? "border-[#4f7c90]/30 bg-[#eef6f7] text-[#172033] shadow-sm"
          : "border-black/10 bg-white text-[#334155] hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] text-[11px] font-semibold",
          done
            ? "bg-emerald-600 text-white"
            : active
              ? "bg-[#4f7c90] text-white"
              : "bg-[#f1f5f9] text-[#64748b]"
        ].join(" ")}
      >
        {done ? <Check size={14} /> : number}
      </span>

      <span className="min-w-0">
        <span className="block truncate text-[12px] font-semibold">{title}</span>
        <span className="block truncate text-[10.5px] font-normal text-[#64748b]">{subtitle}</span>
      </span>
    </button>
  );
}

function SummaryCard({
  title,
  empty,
  children
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
      <h3 className="mb-2.5 text-[14px] font-semibold text-[#172033]">{title}</h3>
      {children || <EmptyState text={empty} />}
    </section>
  );
}

function getCombinacionMetadata(combinacion?: PresupuestoCombinacion | null): Record<string, unknown> {
  if (!combinacion?.metadata || typeof combinacion.metadata !== "object" || Array.isArray(combinacion.metadata)) {
    return {};
  }

  return combinacion.metadata;
}

function stringifyPaymentLines(value: unknown): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (typeof item === "string") return item;

      if (!item || typeof item !== "object" || Array.isArray(item)) return "";

      const record = item as Record<string, unknown>;
      const id = String(record.id || "");
      const tipo = String(record.tipo || "");

      // Evita que al editar se vuelvan a cargar en el textarea
      // pagos que el sistema genera automáticamente al guardar.
      if (
        id === "manual-payment-summary" ||
        id === "manual-payment-installments" ||
        id === "manual-payment-down-balance" ||
        tipo === "RESUMEN" ||
        tipo === "TARJETA_CUOTAS" ||
        tipo === "PAGOS_A_CUENTA" ||
        tipo === "SENIA_SALDO"
      ) {
        return "";
      }

      const titulo = String(record.titulo || record.nombre || "").trim();
      const descripcion = String(record.descripcion || record.detalle || "").trim();

      if (titulo && descripcion) return `${titulo}: ${descripcion}`;
      return titulo || descripcion;
    })
    .filter(Boolean)
    .join("\n");
}
function stringifyPromoLines(value: unknown): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (typeof item === "string") return item;

      if (!item || typeof item !== "object" || Array.isArray(item)) return "";

      const record = item as Record<string, unknown>;
      const id = String(record.id || "");

      // Evita duplicar la promo principal al editar.
      if (id === "manual-promo-main") return "";

      const nombre = String(record.nombre || record.titulo || "").trim();
      const descripcion = String(record.descripcion || record.detalle || "").trim();

      if (nombre && descripcion) return `${nombre}: ${descripcion}`;
      return nombre || descripcion;
    })
    .filter(Boolean)
    .join("\n");
}
function stringifyTarifaLines(value: unknown): string {
  if (!Array.isArray(value)) return "";

  return value
    .map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return "";

      const record = item as Record<string, unknown>;

      return [
        String(record.descripcion || record.nombre || record.tipo || "").trim(),
        record.cantidad ?? "",
        record.precio_unitario ?? "",
        record.subtotal ?? "",
        String(record.notas || "").trim()
      ]
        .map((part) => String(part || "").trim())
        .join(" | ");
    })
    .filter((line) => line.replace(/\|/g, "").trim())
    .join("\n");
}

function buildPrecioDraftFromCombinacion(
  combinacion: PresupuestoCombinacion,
  fallback: ManualPrecioDraft
): ManualPrecioDraft {
  const metadata = getCombinacionMetadata(combinacion);

  const vuelosIds = Array.isArray(metadata.vuelos_ids)
    ? metadata.vuelos_ids.map(String)
    : fallback.vuelos_ids;

  const hotelesIds = Array.isArray(metadata.hoteles_ids)
    ? metadata.hoteles_ids.map(String)
    : fallback.hoteles_ids;

  const serviciosIds = Array.isArray(metadata.servicios_ids)
    ? metadata.servicios_ids.map(String)
    : fallback.servicios_ids;

  const cuotas =
    metadata.cuotas !== null && metadata.cuotas !== undefined ? String(metadata.cuotas) : "";

  const valorCuota =
    metadata.valor_cuota !== null && metadata.valor_cuota !== undefined
      ? String(metadata.valor_cuota)
      : "";

  return {
    ...fallback,
    nombre: combinacion.nombre || fallback.nombre,
    subtitulo: combinacion.subtitulo || "",
    descripcion: combinacion.descripcion || "",
    precio_total: combinacion.precio_total ? String(combinacion.precio_total) : "",
    moneda: toMonedaSimple(String(combinacion.moneda || "USD")),
    mostrar_precio_por_pasajero: Boolean(metadata.mostrar_precio_por_pasajero),
    precio_label: String(metadata.precio_label || "Precio total"),
    composicion_precio_texto: String(metadata.composicion_precio_texto || ""),
    tarifas_pasajeros_texto: stringifyTarifaLines(metadata.tarifas_pasajeros),
    promociones_texto: stringifyPromoLines(metadata.promociones),
    descuentos_texto: stringifyPromoLines(metadata.descuentos),
    formas_pago_texto: stringifyPaymentLines(metadata.formas_pago),
    precio_contado: combinacion.precio_contado ? String(combinacion.precio_contado) : "",
    precio_transferencia: combinacion.precio_transferencia ? String(combinacion.precio_transferencia) : "",
    precio_tarjeta: combinacion.precio_tarjeta ? String(combinacion.precio_tarjeta) : "",
    precio_financiado: combinacion.precio_financiado ? String(combinacion.precio_financiado) : "",
    cuotas,
    valor_cuota: valorCuota,
    tarjeta: String(metadata.tarjeta || ""),
    banco: String(metadata.banco || ""),
    con_interes: Boolean(metadata.con_interes),
    seña: combinacion.seña ? String(combinacion.seña) : "",
    saldo: combinacion.saldo ? String(combinacion.saldo) : "",
    incluye_resumen: combinacion.incluye_resumen || "",
    no_incluye_resumen: combinacion.no_incluye_resumen || "",
    forma_pago_resumen: combinacion.forma_pago_resumen || "",
    condiciones_pago: combinacion.condiciones_pago || "",
    promocion_utilizada: String(metadata.promocion_utilizada || combinacion.etiqueta || ""),
    destacada: Boolean(combinacion.destacada),
    visible_en_pdf: combinacion.visible_en_pdf !== false,
    vuelos_ids: vuelosIds,
    hoteles_ids: hotelesIds,
    servicios_ids: serviciosIds
  };
}

function PresupuestoManualModal({
  presupuesto,
  vuelos,
  hoteles,
  servicios,
  combinaciones,
  saving,
  uploading,
  onClose,
  onSaveVuelo,
  onSaveHotel,
  onSaveServicio,
  onSaveCombinacion,
  onUploadImage,
  onPreviewPdf
}: {
  presupuesto: PresupuestoV2;
  vuelos: PresupuestoVuelo[];
  hoteles: PresupuestoHotel[];
  servicios: PresupuestoServicio[];
  combinaciones: PresupuestoCombinacion[];
  saving: boolean;
  uploading: boolean;
  onClose: () => void;
  onSaveVuelo: (draft: DraftVuelo) => Promise<void>;
  onSaveHotel: (draft: DraftHotel) => Promise<void>;
  onSaveServicio: (draft: DraftServicio) => Promise<void>;
  onSaveCombinacion: (draft: DraftCombinacion) => Promise<void>;
  onUploadImage: (file: File) => Promise<UploadedImageResult | null>;
  onPreviewPdf: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const manualDraftKey = getPresupuestoManualDraftKey(presupuesto.id);
  const savedManualDraft = readJsonDraft<PrecioDraftStorage>(manualDraftKey);

  const [step, setStep] = useState<ManualWizardStep>(() => {
    if (savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION && savedManualDraft.step) {
      return savedManualDraft.step;
    }

    return "precios";
  });

  const [editingCombinacionId, setEditingCombinacionId] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  const [vueloDraft, setVueloDraft] = useState<ManualVueloDraft>(() => {
    if (savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION && savedManualDraft.vueloDraft) {
      return savedManualDraft.vueloDraft;
    }

    return {
      titulo: `Opción aérea ${vuelos.length + 1}`,
      raw_text: "",
      captura_url: "",
      captura_path: null,
      precio_total: "",
      moneda: "USD",
      mostrar_precio_en_pdf: false,
      incluir_en_pdf: true
    };
  });

  const [hotelSearch, setHotelSearch] = useState(() => {
    if (savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION) {
      return savedManualDraft.hotelSearch || "";
    }

    return "";
  });

  const [selectedHotelMaestro, setSelectedHotelMaestro] = useState<HotelMaestroLite | null>(() => {
    if (savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION) {
      return savedManualDraft.selectedHotelMaestro || null;
    }

    return null;
  });

  const [hotelDraft, setHotelDraft] = useState<ManualHotelDraft>(() => {
    if (savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION && savedManualDraft.hotelDraft) {
      return savedManualDraft.hotelDraft;
    }

    return {
      hotel_id: null,
      nombre: "",
      destino: presupuesto.destino_principal || "",
      ubicacion: "",
      categoria: "",
      regimen: "",
      habitacion: "",
      descripcion: "",
      imagen_url: "",
      precio_total: "",
      moneda: "USD",
      mostrar_precio_en_pdf: false,
      incluir_en_pdf: true
    };
  });

  const [servicioDraft, setServicioDraft] = useState<ManualServicioDraft>(() => {
    if (
      savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION &&
      savedManualDraft.servicioDraft
    ) {
      return savedManualDraft.servicioDraft;
    }

    return {
      tipo: "OTRO",
      nombre: "",
      descripcion: "",
      precio_total: "",
      moneda: "USD",
      mostrar_precio_en_pdf: false,
      incluir_en_pdf: true,
      incluido: true,
      opcional: false
    };
  });

  const getEmptyPrecioDraft = (): ManualPrecioDraft => ({
    nombre: `Opción ${combinaciones.length + 1}`,
    subtitulo: "",
    descripcion: "",
    precio_total: "",
    moneda: "USD",
    mostrar_precio_por_pasajero: false,
    precio_label: "Precio total",
    composicion_precio_texto: "",
    tarifas_pasajeros_texto: "",
    promociones_texto: "",
    descuentos_texto: "",
    formas_pago_texto: "",
    precio_contado: "",
    precio_transferencia: "",
    precio_tarjeta: "",
    precio_financiado: "",
    cuotas: "",
    valor_cuota: "",
    tarjeta: "",
    banco: "",
    con_interes: false,
    seña: "",
    saldo: "",
    incluye_resumen: "",
    no_incluye_resumen: "",
    forma_pago_resumen: "",
    condiciones_pago: "",
    promocion_utilizada: "",
    destacada: combinaciones.length === 0,
    visible_en_pdf: true,
    vuelos_ids: vuelos.map((item) => item.id),
    hoteles_ids: hoteles.map((item) => item.id),
    servicios_ids: servicios.map((item) => item.id)
  });

  const [precioDraft, setPrecioDraft] = useState<ManualPrecioDraft>(() => {
    if (savedManualDraft?.version === PRESUPUESTOS_DRAFT_VERSION && savedManualDraft.precioDraft) {
      return savedManualDraft.precioDraft;
    }

    return getEmptyPrecioDraft();
  });

  useEffect(() => {
    writeJsonDraft<PrecioDraftStorage>(manualDraftKey, {
      version: PRESUPUESTOS_DRAFT_VERSION,
      step,
      vueloDraft,
      hotelSearch,
      selectedHotelMaestro,
      hotelDraft,
      servicioDraft,
      precioDraft,
      updatedAt: new Date().toISOString()
    });
  }, [
    manualDraftKey,
    step,
    vueloDraft,
    hotelSearch,
    selectedHotelMaestro,
    hotelDraft,
    servicioDraft,
    precioDraft
  ]);

  const totalPax = Math.max(
    1,
    Number(presupuesto.adultos || 0) + Number(presupuesto.menores || 0)
  );

  const precioTotalPreview = toNumberOrNull(precioDraft.precio_total);
  const precioPorPaxPreview = precioTotalPreview ? precioTotalPreview / totalPax : null;

  function resetPrecioDraft() {
    setEditingCombinacionId(null);
    setPrecioDraft({
      ...getEmptyPrecioDraft(),
      nombre: `Opción ${combinaciones.length + 1}`,
      destacada: combinaciones.length === 0
    });
  }

  function editCombinacion(combinacion: PresupuestoCombinacion) {
    setLocalError(null);
    setEditingCombinacionId(combinacion.id);
    setPrecioDraft(buildPrecioDraftFromCombinacion(combinacion, getEmptyPrecioDraft()));
    setStep("precios");
  }

  async function applyFlightImage(file: File) {
    if (!file.type.startsWith("image/")) {
      setLocalError("Solo podés cargar imágenes para el aéreo.");
      return;
    }

    const uploaded = await onUploadImage(file);

    if (!uploaded) {
      setLocalError("No se pudo subir la imagen.");
      return;
    }

    setVueloDraft((current) => ({
      ...current,
      captura_url: uploaded.url,
      captura_path: uploaded.path
    }));
  }

  async function handleUploadFile(event: ChangeEvent<HTMLInputElement>) {
    const file = Array.from(event.target.files || [])[0];
    event.target.value = "";

    if (!file) return;
    await applyFlightImage(file);
  }

  async function handlePasteFlight(event: React.ClipboardEvent<HTMLDivElement>) {
    const files = Array.from(event.clipboardData.files || []);
    const image = files.find((file) => file.type.startsWith("image/"));

    if (!image) return;

    event.preventDefault();
    await applyFlightImage(image);
  }

  async function handleDropFlight(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const files = Array.from(event.dataTransfer.files || []);
    const image = files.find((file) => file.type.startsWith("image/"));

    if (!image) {
      setLocalError("Arrastrá una imagen/captura válida.");
      return;
    }

    await applyFlightImage(image);
  }

  function handleSelectHotelMaestro(hotel: HotelMaestroLite) {
    const hotelFotos = hotel.fotos || [];

    setSelectedHotelMaestro(hotel);
    setHotelSearch(hotel.nombre);

    setHotelDraft((current) => ({
      ...current,
      hotel_id: hotel.id,
      nombre: hotel.nombre,
      destino: current.destino || presupuesto.destino_principal || "",
      ubicacion: hotel.ubicacion || hotel.direccion || "",
      categoria: hotel.categoria ? String(hotel.categoria) : current.categoria,
      descripcion: getHotelMaestroDescription(hotel),
      imagen_url: hotel.imagen_url || hotelFotos[0] || ""
    }));
  }

  async function saveVuelo() {
    setLocalError(null);

    if (!vueloDraft.raw_text.trim() && !vueloDraft.captura_url) {
      setLocalError("Cargá una imagen/captura o un texto libre del aéreo.");
      return;
    }

    await onSaveVuelo({
      presupuesto_id: presupuesto.id,
      titulo: vueloDraft.titulo.trim() || `Opción aérea ${vuelos.length + 1}`,
      raw_text: vueloDraft.raw_text || null,
      captura_url: vueloDraft.captura_url || null,
      captura_path: vueloDraft.captura_path || null,
      precio_total: toNumberOrNull(vueloDraft.precio_total),
      moneda: vueloDraft.moneda,
      incluir_en_pdf: vueloDraft.incluir_en_pdf,
      metadata: {
        carga_modo: "MANUAL_WIZARD",
        mostrar_precio_en_pdf: vueloDraft.mostrar_precio_en_pdf,
        mostrar_raw_text_en_pdf: Boolean(vueloDraft.raw_text.trim())
      }
    });

    setVueloDraft({
      titulo: `Opción aérea ${vuelos.length + 2}`,
      raw_text: "",
      captura_url: "",
      captura_path: null,
      precio_total: "",
      moneda: "USD",
      mostrar_precio_en_pdf: false,
      incluir_en_pdf: true
    });

    setStep("hoteles");
  }

  async function saveHotel() {
    setLocalError(null);

    if (!hotelDraft.nombre.trim()) {
      setLocalError("El hotel necesita nombre. Buscalo en la base y seleccionalo.");
      return;
    }

    await onSaveHotel({
      presupuesto_id: presupuesto.id,
      hotel_id: hotelDraft.hotel_id,
      nombre: hotelDraft.nombre,
      titulo: hotelDraft.nombre,
      destino: hotelDraft.destino,
      zona: hotelDraft.ubicacion,
      categoria: hotelDraft.categoria,
      regimen: hotelDraft.regimen,
      habitacion: hotelDraft.habitacion,
      descripcion: hotelDraft.descripcion,
      check_in: presupuesto.fecha_salida || null,
      check_out: presupuesto.fecha_regreso || null,
      noches: presupuesto.noches || null,
      imagen_url: hotelDraft.imagen_url || null,
      precio_total: toNumberOrNull(hotelDraft.precio_total),
      moneda: hotelDraft.moneda,
      incluir_en_pdf: hotelDraft.incluir_en_pdf,
      es_principal: hoteles.length === 0,
      metadata: {
        mostrar_precio_en_pdf: hotelDraft.mostrar_precio_en_pdf,
        carga_modo: "MANUAL_WIZARD",
        hotel_maestro: selectedHotelMaestro
      }
    });

    setSelectedHotelMaestro(null);
    setHotelSearch("");

    setHotelDraft({
      hotel_id: null,
      nombre: "",
      destino: presupuesto.destino_principal || "",
      ubicacion: "",
      categoria: "",
      regimen: "",
      habitacion: "",
      descripcion: "",
      imagen_url: "",
      precio_total: "",
      moneda: "USD",
      mostrar_precio_en_pdf: false,
      incluir_en_pdf: true
    });

    setStep("servicios");
  }

  async function saveServicio() {
    setLocalError(null);

    if (!servicioDraft.nombre.trim()) {
      setLocalError("El servicio necesita nombre.");
      return;
    }

    await onSaveServicio({
      presupuesto_id: presupuesto.id,
      nombre: servicioDraft.nombre,
      tipo: servicioDraft.tipo as PresupuestoServicioTipo,
      descripcion: servicioDraft.descripcion,
      precio_total: toNumberOrNull(servicioDraft.precio_total),
      moneda: servicioDraft.moneda,
      incluido: servicioDraft.incluido,
      opcional: servicioDraft.opcional,
      incluir_en_pdf: servicioDraft.incluir_en_pdf,
      metadata: {
        mostrar_precio_en_pdf: servicioDraft.mostrar_precio_en_pdf,
        carga_modo: "MANUAL_WIZARD"
      }
    });

    setServicioDraft({
      tipo: "OTRO",
      nombre: "",
      descripcion: "",
      precio_total: "",
      moneda: "USD",
      mostrar_precio_en_pdf: false,
      incluir_en_pdf: true,
      incluido: true,
      opcional: false
    });

    setStep("precios");
  }

  async function savePrecio() {
    setLocalError(null);

    const precioTotal = toNumberOrNull(precioDraft.precio_total);
    const cuotas = Number(precioDraft.cuotas || 0);
    const valorCuota = toNumberOrNull(precioDraft.valor_cuota);
    const seña = toNumberOrNull(precioDraft.seña);
    const saldo = toNumberOrNull(precioDraft.saldo);

    if (!precioDraft.nombre.trim()) {
      setLocalError("La opción necesita nombre.");
      return;
    }

    if (!precioTotal || precioTotal <= 0) {
      setLocalError("Ingresá el precio total del paquete/opción.");
      return;
    }

    const promocionClean = precioDraft.promocion_utilizada.trim();


const formasPagoBase = parsePaymentLines(precioDraft.formas_pago_texto, precioDraft.moneda);

const formasPagoBaseText = normalizeSearchText(
  formasPagoBase
    .map((item) => {
      const record = item as Record<string, unknown>;
      return [record.titulo, record.descripcion].filter(Boolean).join(" ");
    })
    .join(" ")
);

const formaPagoResumenClean = precioDraft.forma_pago_resumen.trim();


   const formasPagoFlexibles = [
  ...formasPagoBase,
      formaPagoResumenClean && !formasPagoBaseText.includes(normalizeSearchText(formaPagoResumenClean))
  ? {
      id: "manual-payment-summary",
      tipo: "RESUMEN",
      titulo: "Forma de pago",
      descripcion: formaPagoResumenClean,
      moneda: precioDraft.moneda,
      visible_en_pdf: true
    }
  : null,
      cuotas > 0 && valorCuota
        ? {
            id: "manual-payment-installments",
            tipo:
              precioDraft.tarjeta.trim() || precioDraft.banco.trim()
                ? "TARJETA_CUOTAS"
                : "PAGOS_A_CUENTA",
            titulo:
              precioDraft.tarjeta.trim() || precioDraft.banco.trim()
                ? [precioDraft.tarjeta || "Tarjeta", precioDraft.banco].filter(Boolean).join(" · ")
                : "Pagos a cuenta",
            descripcion:
              precioDraft.tarjeta.trim() || precioDraft.banco.trim()
                ? `${cuotas} cuota${cuotas === 1 ? "" : "s"} de ${formatMoneyAR(
                    valorCuota,
                    precioDraft.moneda
                  )}. ${precioDraft.con_interes ? "Con interés." : "Sin interés."}`
                : `${cuotas} pago${cuotas === 1 ? "" : "s"} a cuenta de ${formatMoneyAR(
                    valorCuota,
                    precioDraft.moneda
                  )}.`,
            moneda: precioDraft.moneda,
            cuotas,
            valor_cuota: valorCuota,
            tarjeta: precioDraft.tarjeta || null,
            banco: precioDraft.banco || null,
            con_interes:
              precioDraft.tarjeta.trim() || precioDraft.banco.trim()
                ? precioDraft.con_interes
                : null,
            visible_en_pdf: true
          }
        : null,
      seña || saldo
        ? {
            id: "manual-payment-down-balance",
            tipo: "SENIA_SALDO",
            titulo: "Pago inicial + saldo",
            descripcion: [
              seña ? `Pago inicial / seña: ${formatMoneyAR(seña, precioDraft.moneda)}.` : "",
              saldo ? `Saldo: ${formatMoneyAR(saldo, precioDraft.moneda)}.` : ""
            ]
              .filter(Boolean)
              .join(" "),
            moneda: precioDraft.moneda,
            visible_en_pdf: true
          }
        : null
    ].filter(Boolean);

 const promocionesBase = parsePromoLines(
  precioDraft.promociones_texto,
  "promo",
  precioDraft.moneda
);

const promocionesBaseText = normalizeSearchText(
  promocionesBase
    .map((item) => {
      const record = item as Record<string, unknown>;
      return [record.nombre, record.descripcion].filter(Boolean).join(" ");
    })
    .join(" ")
);

const promociones = [
  ...promocionesBase,
  promocionClean && !promocionesBaseText.includes(normalizeSearchText(promocionClean))
    ? {
        id: "manual-promo-main",
        nombre: promocionClean,
        descripcion: `Promoción aplicada: ${promocionClean}.`,
        moneda: precioDraft.moneda,
        visible_en_pdf: true
      }
    : null
].filter(Boolean);

    const descuentos = parsePromoLines(precioDraft.descuentos_texto, "discount", precioDraft.moneda);

    const resumenRefs = makeOptionSummaryFromIds({
      vuelos,
      hoteles,
      servicios,
      vuelosIds: precioDraft.vuelos_ids,
      hotelesIds: precioDraft.hoteles_ids,
      serviciosIds: precioDraft.servicios_ids
    });

    await onSaveCombinacion({
      id: editingCombinacionId || undefined,
      presupuesto_id: presupuesto.id,
      nombre: precioDraft.nombre,
      subtitulo: precioDraft.subtitulo,
      descripcion: precioDraft.descripcion,
      precio_total: precioTotal,
      moneda: precioDraft.moneda,
      precio_contado: toNumberOrNull(precioDraft.precio_contado),
      precio_transferencia: toNumberOrNull(precioDraft.precio_transferencia),
      precio_tarjeta: toNumberOrNull(precioDraft.precio_tarjeta),
      precio_financiado: toNumberOrNull(precioDraft.precio_financiado),
      seña,
      saldo,
      incluye_resumen: precioDraft.incluye_resumen,
      no_incluye_resumen: precioDraft.no_incluye_resumen,
      forma_pago_resumen: precioDraft.forma_pago_resumen,
      condiciones_pago: precioDraft.condiciones_pago,
      destacada: precioDraft.destacada,
      visible_en_pdf: precioDraft.visible_en_pdf,
      etiqueta: promocionClean || null,
      metadata: {
        carga_modo: "MANUAL_WIZARD",
        precio_es_total_paquete: true,
        mostrar_precio_por_pasajero: precioDraft.mostrar_precio_por_pasajero,
        precio_label: precioDraft.precio_label || "Precio total",
        pasajeros_cantidad: totalPax,
        precio_por_pasajero: precioDraft.mostrar_precio_por_pasajero ? precioTotal / totalPax : null,
        composicion_precio_texto: precioDraft.composicion_precio_texto || null,
        tarifas_pasajeros: parseTarifaLines(precioDraft.tarifas_pasajeros_texto, precioDraft.moneda),
        promociones,
        descuentos,
        formas_pago: formasPagoFlexibles,
        promocion_utilizada: promocionClean || null,
        cuotas: cuotas || null,
        valor_cuota: valorCuota,
        tarjeta: precioDraft.tarjeta || null,
        banco: precioDraft.banco || null,
        con_interes:
          precioDraft.tarjeta.trim() || precioDraft.banco.trim() ? precioDraft.con_interes : null,
        pagos_a_cuenta:
          cuotas > 0 && valorCuota && !precioDraft.tarjeta.trim() && !precioDraft.banco.trim(),
        vuelos_ids: precioDraft.vuelos_ids,
        hoteles_ids: precioDraft.hoteles_ids,
        servicios_ids: precioDraft.servicios_ids,
        ...resumenRefs
      }
    });

    resetPrecioDraft();
    removeJsonDraft(manualDraftKey);
  }

  function goNextStep() {
    if (step === "aereos") setStep("hoteles");
    if (step === "hoteles") setStep("servicios");
    if (step === "servicios") setStep("precios");
  }

  function goPreviousStep() {
    if (step === "precios") setStep("servicios");
    if (step === "servicios") setStep("hoteles");
    if (step === "hoteles") setStep("aereos");
  }

    return (
    <ModalShell
      title="Editar contenido del presupuesto"
      subtitle={`${presupuesto.numero || "Presupuesto"} · cargá recursos y armá opciones comerciales.`}
      onClose={onClose}
      maxWidth="max-w-7xl"
    >
      <InlineError message={localError} onClose={() => setLocalError(null)} />

      <div className="mb-3 grid gap-2 lg:grid-cols-4">
        <WizardStepButton
          active={step === "aereos"}
          done={vuelos.length > 0}
          number={1}
          title="Aéreos"
          subtitle={`${vuelos.length} cargado${vuelos.length === 1 ? "" : "s"}`}
          onClick={() => setStep("aereos")}
        />

        <WizardStepButton
          active={step === "hoteles"}
          done={hoteles.length > 0}
          number={2}
          title="Hoteles"
          subtitle={`${hoteles.length} cargado${hoteles.length === 1 ? "" : "s"}`}
          onClick={() => setStep("hoteles")}
        />

        <WizardStepButton
          active={step === "servicios"}
          done={servicios.length > 0}
          number={3}
          title="Servicios"
          subtitle={`${servicios.length} cargado${servicios.length === 1 ? "" : "s"}`}
          onClick={() => setStep("servicios")}
        />

        <WizardStepButton
          active={step === "precios"}
          done={combinaciones.length > 0}
          number={4}
          title="Opciones"
          subtitle={`${combinaciones.length} opción${combinaciones.length === 1 ? "" : "es"}`}
          onClick={() => setStep("precios")}
        />
      </div>

      <div className="grid min-w-0 gap-3 2xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0">
          {step === "aereos" ? (
            <section className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#172033]">
                    <Plane size={15} />
                    Aéreos
                  </h3>

                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    Cargá las opciones aéreas disponibles. Después las vinculás a cada opción comercial.
                  </p>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => void handleUploadFile(event)}
                />

                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={13} className="animate-spin" />
                  ) : (
                    <ImageIcon size={13} />
                  )}
                  Cargar imagen
                </button>
              </div>

              <div
                onPaste={(event) => void handlePasteFlight(event)}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => void handleDropFlight(event)}
                className="mb-3 rounded-[16px] border border-dashed border-[#4f7c90]/35 bg-white p-3"
              >
                {vueloDraft.captura_url ? (
                  <div className="overflow-hidden rounded-[14px] border border-black/10 bg-[#f8fafc]">
                    <img
                      src={vueloDraft.captura_url}
                      alt="Captura de aéreo"
                      className="max-h-[360px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex min-h-[150px] items-center justify-center rounded-[14px] bg-[#f8fafc] text-center">
                    <div>
                      <ImageIcon size={28} className="mx-auto mb-2 text-[#94a3b8]" />
                      <div className="text-[12px] font-semibold text-[#334155]">
                        Sin imagen cargada
                      </div>
                      <div className="mt-1 text-[11px] font-normal text-[#64748b]">
                        Pegá, arrastrá o cargá una captura del aéreo.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="mb-2.5 grid gap-2.5 md:grid-cols-[1fr_150px_110px]">
                <div>
                  <FieldLabel>Título</FieldLabel>
                  <TextInput
                    value={vueloDraft.titulo}
                    onChange={(titulo) => setVueloDraft((current) => ({ ...current, titulo }))}
                    placeholder="Ej: Opción aérea Copa"
                  />
                </div>

                <div>
                  <FieldLabel>Precio aéreo</FieldLabel>
                  <TextInput
                    value={vueloDraft.precio_total}
                    onChange={(precio_total) =>
                      setVueloDraft((current) => ({ ...current, precio_total }))
                    }
                    placeholder="Opcional"
                    inputMode="decimal"
                  />
                </div>

                <div>
                  <FieldLabel>Moneda</FieldLabel>
                  <NosturSelect
                    value={vueloDraft.moneda}
                    onChange={(moneda) =>
                      setVueloDraft((current) => ({
                        ...current,
                        moneda: toMonedaSimple(moneda)
                      }))
                    }
                    options={MONEDA_OPTIONS}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Texto visible debajo de la imagen / condiciones</FieldLabel>
                <TextArea
                  value={vueloDraft.raw_text}
                  onChange={(raw_text) => setVueloDraft((current) => ({ ...current, raw_text }))}
                  placeholder="Detalle del aéreo, escalas, equipaje, condiciones, tarifa, asientos, etc. Este texto se muestra debajo de la imagen en el PDF."
                  minHeight={150}
                />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <TogglePill
                    checked={vueloDraft.incluir_en_pdf}
                    label="Mostrar aéreo en PDF"
                    onChange={(incluir_en_pdf) =>
                      setVueloDraft((current) => ({ ...current, incluir_en_pdf }))
                    }
                  />

                  <TogglePill
                    checked={vueloDraft.mostrar_precio_en_pdf}
                    label="Mostrar precio del aéreo"
                    onChange={(mostrar_precio_en_pdf) =>
                      setVueloDraft((current) => ({ ...current, mostrar_precio_en_pdf }))
                    }
                  />
                </div>

                <button
                  type="button"
                  disabled={saving || uploading}
                  onClick={() => void saveVuelo()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                >
                  {saving || uploading ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Check size={14} />
                  )}
                  Guardar aéreo
                </button>
              </div>
            </section>
          ) : null}

          {step === "hoteles" ? (
            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#172033]">
                    <Hotel size={15} />
                    Hoteles
                  </h3>

                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    Buscá en hoteles_maestros. Las imágenes quedan disponibles para el PDF.
                  </p>
                </div>
              </div>

              <div className="grid gap-2.5">
                <div>
                  <FieldLabel>Buscar hotel</FieldLabel>
                  <HotelSearchBox
                    value={hotelSearch}
                    onChange={(value) => {
                      setHotelSearch(value);
                      setSelectedHotelMaestro(null);
                    }}
                    onSelect={handleSelectHotelMaestro}
                  />
                </div>

                {hotelDraft.imagen_url ? (
                  <div className="overflow-hidden rounded-[14px] border border-black/10 bg-[#f8fafc]">
                    <img
                      src={hotelDraft.imagen_url}
                      alt={hotelDraft.nombre || "Hotel"}
                      className="max-h-64 w-full object-cover"
                    />
                  </div>
                ) : null}

                <div className="grid gap-2.5 md:grid-cols-3">
                  <div>
                    <FieldLabel>Nombre</FieldLabel>
                    <TextInput
                      value={hotelDraft.nombre}
                      onChange={() => undefined}
                      placeholder="Seleccioná desde la base"
                      disabled
                    />
                  </div>

                  <div>
                    <FieldLabel>Destino</FieldLabel>
                    <TextInput
                      value={hotelDraft.destino}
                      onChange={(destino) => setHotelDraft((current) => ({ ...current, destino }))}
                      placeholder="Destino"
                    />
                  </div>

                  <div>
                    <FieldLabel>Categoría</FieldLabel>
                    <TextInput
                      value={hotelDraft.categoria}
                      onChange={(categoria) =>
                        setHotelDraft((current) => ({ ...current, categoria }))
                      }
                      placeholder="Ej: 4"
                      inputMode="numeric"
                    />
                  </div>

                  <div>
                    <FieldLabel>Régimen</FieldLabel>
                    <TextInput
                      value={hotelDraft.regimen}
                      onChange={(regimen) => setHotelDraft((current) => ({ ...current, regimen }))}
                      placeholder="Desayuno / All inclusive"
                    />
                  </div>

                  <div>
                    <FieldLabel>Habitación</FieldLabel>
                    <TextInput
                      value={hotelDraft.habitacion}
                      onChange={(habitacion) =>
                        setHotelDraft((current) => ({ ...current, habitacion }))
                      }
                      placeholder="Standard / Doble"
                    />
                  </div>

                  <div>
                    <FieldLabel>Ubicación</FieldLabel>
                    <TextInput
                      value={hotelDraft.ubicacion}
                      onChange={(ubicacion) =>
                        setHotelDraft((current) => ({ ...current, ubicacion }))
                      }
                      placeholder="Ubicación"
                    />
                  </div>

                  <div>
                    <FieldLabel>Precio hotel</FieldLabel>
                    <TextInput
                      value={hotelDraft.precio_total}
                      onChange={(precio_total) =>
                        setHotelDraft((current) => ({ ...current, precio_total }))
                      }
                      placeholder="Opcional"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <FieldLabel>Moneda</FieldLabel>
                    <NosturSelect
                      value={hotelDraft.moneda}
                      onChange={(moneda) =>
                        setHotelDraft((current) => ({
                          ...current,
                          moneda: toMonedaSimple(moneda)
                        }))
                      }
                      options={MONEDA_OPTIONS}
                    />
                  </div>

                  <div className="flex items-end">
                    <TogglePill
                      checked={hotelDraft.mostrar_precio_en_pdf}
                      label="Mostrar precio"
                      onChange={(mostrar_precio_en_pdf) =>
                        setHotelDraft((current) => ({ ...current, mostrar_precio_en_pdf }))
                      }
                    />
                  </div>

                  <div className="md:col-span-3">
                    <FieldLabel>Descripción</FieldLabel>
                    <TextArea
                      value={hotelDraft.descripcion}
                      onChange={(descripcion) =>
                        setHotelDraft((current) => ({ ...current, descripcion }))
                      }
                      placeholder="Descripción comercial del hotel."
                      minHeight={120}
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <TogglePill
                    checked={hotelDraft.incluir_en_pdf}
                    label="Mostrar hotel en PDF"
                    onChange={(incluir_en_pdf) =>
                      setHotelDraft((current) => ({ ...current, incluir_en_pdf }))
                    }
                  />

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void saveHotel()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    Guardar hotel
                  </button>
                </div>
              </div>
            </section>
          ) : null}

                    {step === "servicios" ? (
            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <h3 className="mb-3 flex items-center gap-2 text-[14px] font-semibold text-[#172033]">
                <PackageCheck size={15} />
                Servicios
              </h3>

              <div className="grid gap-2.5 md:grid-cols-3">
                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <NosturSelect
                    value={servicioDraft.tipo}
                    onChange={(tipo) => setServicioDraft((current) => ({ ...current, tipo }))}
                    options={SERVICIO_TIPO_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Nombre</FieldLabel>
                  <TextInput
                    value={servicioDraft.nombre}
                    onChange={(nombre) => setServicioDraft((current) => ({ ...current, nombre }))}
                    placeholder="Traslado / Asistencia / Excursión"
                  />
                </div>

                <div>
                  <FieldLabel>Moneda</FieldLabel>
                  <NosturSelect
                    value={servicioDraft.moneda}
                    onChange={(moneda) =>
                      setServicioDraft((current) => ({
                        ...current,
                        moneda: toMonedaSimple(moneda)
                      }))
                    }
                    options={MONEDA_OPTIONS}
                  />
                </div>

                <div className="md:col-span-2">
                  <FieldLabel>Descripción</FieldLabel>
                  <TextArea
                    value={servicioDraft.descripcion}
                    onChange={(descripcion) =>
                      setServicioDraft((current) => ({ ...current, descripcion }))
                    }
                    placeholder="Detalle visible para el pasajero."
                    minHeight={120}
                  />
                </div>

                <div>
                  <FieldLabel>Precio individual / servicio</FieldLabel>
                  <TextInput
                    value={servicioDraft.precio_total}
                    onChange={(precio_total) =>
                      setServicioDraft((current) => ({ ...current, precio_total }))
                    }
                    placeholder="Opcional"
                    inputMode="decimal"
                  />
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-2">
                  <TogglePill
                    checked={servicioDraft.incluir_en_pdf}
                    label="Mostrar servicio"
                    onChange={(incluir_en_pdf) =>
                      setServicioDraft((current) => ({ ...current, incluir_en_pdf }))
                    }
                  />

                  <TogglePill
                    checked={servicioDraft.mostrar_precio_en_pdf}
                    label="Mostrar precio"
                    onChange={(mostrar_precio_en_pdf) =>
                      setServicioDraft((current) => ({ ...current, mostrar_precio_en_pdf }))
                    }
                  />

                  <TogglePill
                    checked={servicioDraft.incluido}
                    label="Incluido"
                    onChange={(incluido) =>
                      setServicioDraft((current) => ({ ...current, incluido }))
                    }
                  />

                  <TogglePill
                    checked={servicioDraft.opcional}
                    label="Opcional"
                    onChange={(opcional) =>
                      setServicioDraft((current) => ({ ...current, opcional }))
                    }
                  />
                </div>

                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveServicio()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                >
                  {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                  Guardar servicio
                </button>
              </div>
            </section>
          ) : null}

          {step === "precios" ? (
            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-[14px] font-semibold text-[#172033]">
                    <BadgeDollarSign size={15} />
                    Opciones comerciales
                  </h3>

                  <p className="mt-0.5 text-[11.5px] font-normal text-[#64748b]">
                    {editingCombinacionId
                      ? "Estás editando una opción guardada."
                      : "Creá una nueva opción comercial."}
                  </p>
                </div>

                {editingCombinacionId ? (
                  <button
                    type="button"
                    onClick={resetPrecioDraft}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                  >
                    <Plus size={14} />
                    Nueva opción
                  </button>
                ) : null}
              </div>

              <div className="mb-3 rounded-[14px] border border-[#4f7c90]/20 bg-[#eef6f7] p-3 text-[12px] font-normal leading-5 text-[#31596a]">
                Cada opción puede combinar distintos vuelos, hoteles, servicios, tarifas, promos y formas de pago.
                <strong className="font-semibold"> No se divide por pasajero automáticamente</strong>; solo se muestra si lo marcás.
                Las cuotas sin tarjeta/banco se muestran como <strong className="font-semibold">pagos a cuenta</strong>, no como tarjeta de crédito.
              </div>

              <div className="grid gap-3">
                <section className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <h4 className="mb-3 text-[13px] font-semibold text-[#172033]">
                    1. Servicios que usa esta opción
                  </h4>

                  <div className="grid min-w-0 gap-2.5 xl:grid-cols-3">
                    <ResourceCheckList
                      title="Aéreos"
                      empty="No hay aéreos cargados."
                      items={vuelos}
                      selectedIds={precioDraft.vuelos_ids}
                      getTitle={(item) => item.titulo || item.ruta_resumen || "Aéreo"}
                      getSubtitle={(item) =>
                        item.raw_text || item.ruta_resumen || item.aerolinea || "Sin detalle"
                      }
                      onChange={(vuelos_ids) =>
                        setPrecioDraft((current) => ({ ...current, vuelos_ids }))
                      }
                    />

                    <ResourceCheckList
                      title="Hoteles"
                      empty="No hay hoteles cargados."
                      items={hoteles}
                      selectedIds={precioDraft.hoteles_ids}
                      getTitle={(item) => item.nombre || item.titulo || "Hotel"}
                      getSubtitle={(item) =>
                        [item.destino, item.regimen, item.habitacion].filter(Boolean).join(" · ") ||
                        "Sin detalle"
                      }
                      onChange={(hoteles_ids) =>
                        setPrecioDraft((current) => ({ ...current, hoteles_ids }))
                      }
                    />

                    <ResourceCheckList
                      title="Servicios"
                      empty="No hay servicios cargados."
                      items={servicios}
                      selectedIds={precioDraft.servicios_ids}
                      getTitle={(item) => item.nombre || "Servicio"}
                      getSubtitle={(item) => item.descripcion || item.tipo || "Sin detalle"}
                      onChange={(servicios_ids) =>
                        setPrecioDraft((current) => ({ ...current, servicios_ids }))
                      }
                    />
                  </div>
                </section>

                <section className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <h4 className="mb-3 text-[13px] font-semibold text-[#172033]">
                    2. Precio y presentación
                  </h4>

                  <div className="grid gap-2.5 md:grid-cols-3">
                    <div>
                      <FieldLabel>Nombre</FieldLabel>
                      <TextInput
                        value={precioDraft.nombre}
                        onChange={(nombre) => setPrecioDraft((current) => ({ ...current, nombre }))}
                        placeholder="Opción 1"
                      />
                    </div>

                    <div>
                      <FieldLabel>Precio total opción</FieldLabel>
                      <TextInput
                        value={precioDraft.precio_total}
                        onChange={(precio_total) =>
                          setPrecioDraft((current) => ({ ...current, precio_total }))
                        }
                        placeholder="0,00"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Moneda</FieldLabel>
                      <NosturSelect
                        value={precioDraft.moneda}
                        onChange={(moneda) =>
                          setPrecioDraft((current) => ({
                            ...current,
                            moneda: toMonedaSimple(moneda)
                          }))
                        }
                        options={MONEDA_OPTIONS}
                      />
                    </div>

                    <div>
                      <FieldLabel>Etiqueta precio</FieldLabel>
                      <TextInput
                        value={precioDraft.precio_label}
                        onChange={(precio_label) =>
                          setPrecioDraft((current) => ({ ...current, precio_label }))
                        }
                        placeholder="Precio total / Precio grupo / Precio final"
                      />
                    </div>

                    <div>
                      <FieldLabel>Precio por pasajero</FieldLabel>
                      <div className="flex h-8 items-center rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#172033]">
                        {precioPorPaxPreview ? formatMoneyAR(precioPorPaxPreview, precioDraft.moneda) : "—"}
                      </div>
                    </div>

                    <div className="flex items-end">
                      <TogglePill
                        checked={precioDraft.mostrar_precio_por_pasajero}
                        label="Mostrar por pasajero"
                        onChange={(mostrar_precio_por_pasajero) =>
                          setPrecioDraft((current) => ({ ...current, mostrar_precio_por_pasajero }))
                        }
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Subtítulo</FieldLabel>
                      <TextInput
                        value={precioDraft.subtitulo}
                        onChange={(subtitulo) =>
                          setPrecioDraft((current) => ({ ...current, subtitulo }))
                        }
                        placeholder="Ej: Vuelo Copa + Hotel Riu Palace + asistencia"
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Descripción de la opción</FieldLabel>
                      <TextArea
                        value={precioDraft.descripcion}
                        onChange={(descripcion) =>
                          setPrecioDraft((current) => ({ ...current, descripcion }))
                        }
                        placeholder="Detalle opcional de la propuesta."
                        minHeight={70}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Composición del precio / tarifa</FieldLabel>
                      <TextArea
                        value={precioDraft.composicion_precio_texto}
                        onChange={(composicion_precio_texto) =>
                          setPrecioDraft((current) => ({ ...current, composicion_precio_texto }))
                        }
                        placeholder="Ej: Tarifa calculada para 2 adultos y 1 menor. El menor abona tarifa child. No se expresa valor individual porque la cotización es paquete familiar."
                        minHeight={74}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Tarifas por pasajero / tipo de pasajero</FieldLabel>
                      <TextArea
                        value={precioDraft.tarifas_pasajeros_texto}
                        onChange={(tarifas_pasajeros_texto) =>
                          setPrecioDraft((current) => ({ ...current, tarifas_pasajeros_texto }))
                        }
                        placeholder={
                          "Una línea por tarifa. Formato opcional:\nAdulto | 2 | 1800 | 3600 | Tarifa base\nMenor 8 años | 1 | 1250 | 1250 | Tarifa child"
                        }
                        minHeight={88}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <h4 className="mb-3 text-[13px] font-semibold text-[#172033]">
                    3. Promos, descuentos y pagos
                  </h4>

                  <div className="grid gap-2.5 md:grid-cols-3">
                    <div>
                      <FieldLabel>Precio contado</FieldLabel>
                      <TextInput
                        value={precioDraft.precio_contado}
                        onChange={(precio_contado) =>
                          setPrecioDraft((current) => ({ ...current, precio_contado }))
                        }
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Precio transferencia</FieldLabel>
                      <TextInput
                        value={precioDraft.precio_transferencia}
                        onChange={(precio_transferencia) =>
                          setPrecioDraft((current) => ({ ...current, precio_transferencia }))
                        }
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Precio tarjeta</FieldLabel>
                      <TextInput
                        value={precioDraft.precio_tarjeta}
                        onChange={(precio_tarjeta) =>
                          setPrecioDraft((current) => ({ ...current, precio_tarjeta }))
                        }
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Precio financiado</FieldLabel>
                      <TextInput
                        value={precioDraft.precio_financiado}
                        onChange={(precio_financiado) =>
                          setPrecioDraft((current) => ({ ...current, precio_financiado }))
                        }
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Pago inicial / seña</FieldLabel>
                      <TextInput
                        value={precioDraft.seña}
                        onChange={(seña) => setPrecioDraft((current) => ({ ...current, seña }))}
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Saldo</FieldLabel>
                      <TextInput
                        value={precioDraft.saldo}
                        onChange={(saldo) => setPrecioDraft((current) => ({ ...current, saldo }))}
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Cantidad de pagos / cuotas</FieldLabel>
                      <TextInput
                        value={precioDraft.cuotas}
                        onChange={(cuotas) =>
                          setPrecioDraft((current) => ({ ...current, cuotas }))
                        }
                        placeholder="Ej: 6"
                        inputMode="numeric"
                      />
                    </div>

                    <div>
                      <FieldLabel>Valor de cada pago</FieldLabel>
                      <TextInput
                        value={precioDraft.valor_cuota}
                        onChange={(valor_cuota) =>
                          setPrecioDraft((current) => ({ ...current, valor_cuota }))
                        }
                        placeholder="Opcional"
                        inputMode="decimal"
                      />
                    </div>

                    <div className="flex items-end">
                      <TogglePill
                        checked={!precioDraft.con_interes}
                        label="Sin interés si aplica"
                        onChange={(checked) =>
                          setPrecioDraft((current) => ({ ...current, con_interes: !checked }))
                        }
                      />
                    </div>

                    <div>
                      <FieldLabel>Tarjeta, si corresponde</FieldLabel>
                      <TextInput
                        value={precioDraft.tarjeta}
                        onChange={(tarjeta) =>
                          setPrecioDraft((current) => ({ ...current, tarjeta }))
                        }
                        placeholder="Solo si es tarjeta"
                      />
                    </div>

                    <div>
                      <FieldLabel>Banco, si corresponde</FieldLabel>
                      <TextInput
                        value={precioDraft.banco}
                        onChange={(banco) => setPrecioDraft((current) => ({ ...current, banco }))}
                        placeholder="Solo si aplica"
                      />
                    </div>

                    <div>
                      <FieldLabel>Promoción principal</FieldLabel>
                      <TextInput
                        value={precioDraft.promocion_utilizada}
                        onChange={(promocion_utilizada) =>
                          setPrecioDraft((current) => ({ ...current, promocion_utilizada }))
                        }
                        placeholder="Black Friday, Semana Promo..."
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Promociones visibles</FieldLabel>
                      <TextArea
                        value={precioDraft.promociones_texto}
                        onChange={(promociones_texto) =>
                          setPrecioDraft((current) => ({ ...current, promociones_texto }))
                        }
                        placeholder={
                          "Una línea por promo. Ej:\nBlack Friday: descuento especial vigente hasta agotar cupo\nSemana Sucursal: precio exclusivo reservando esta semana"
                        }
                        minHeight={74}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Descuentos visibles</FieldLabel>
                      <TextArea
                        value={precioDraft.descuentos_texto}
                        onChange={(descuentos_texto) =>
                          setPrecioDraft((current) => ({ ...current, descuentos_texto }))
                        }
                        placeholder={
                          "Una línea por descuento. Ej:\nDescuento familia: aplicado sobre tarifa final\nPromo transferencia: descuento abonando por transferencia"
                        }
                        minHeight={74}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Formas de pago flexibles</FieldLabel>
                      <TextArea
                        value={precioDraft.formas_pago_texto}
                        onChange={(formas_pago_texto) =>
                          setPrecioDraft((current) => ({ ...current, formas_pago_texto }))
                        }
                        placeholder={
                          "Una línea por forma de pago. Ej:\nTransferencia: USD 4.250 final\nPago mixto: 40% transferencia y saldo con pagos a cuenta\nPago mensual: 6 pagos a cuenta de USD 700"
                        }
                        minHeight={88}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Forma de pago general</FieldLabel>
                      <TextArea
                        value={precioDraft.forma_pago_resumen}
                        onChange={(forma_pago_resumen) =>
                          setPrecioDraft((current) => ({ ...current, forma_pago_resumen }))
                        }
                        placeholder="Texto general de forma de pago. Se suma a las formas flexibles."
                        minHeight={70}
                      />
                    </div>

                    <div className="md:col-span-3">
                      <FieldLabel>Condiciones de pago</FieldLabel>
                      <TextArea
                        value={precioDraft.condiciones_pago}
                        onChange={(condiciones_pago) =>
                          setPrecioDraft((current) => ({ ...current, condiciones_pago }))
                        }
                        placeholder="Condiciones, vencimientos, financiación o aclaraciones."
                        minHeight={70}
                      />
                    </div>
                  </div>
                </section>

                <section className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <h4 className="mb-3 text-[13px] font-semibold text-[#172033]">
                    4. Incluye / No incluye
                  </h4>

                  <div className="grid gap-2.5">
                    <div>
                      <FieldLabel>Incluye</FieldLabel>
                      <TextArea
                        value={precioDraft.incluye_resumen}
                        onChange={(incluye_resumen) =>
                          setPrecioDraft((current) => ({ ...current, incluye_resumen }))
                        }
                        placeholder="Aéreos, alojamiento, traslados, asistencia..."
                        minHeight={80}
                      />
                    </div>

                    <div>
                      <FieldLabel>No incluye</FieldLabel>
                      <TextArea
                        value={precioDraft.no_incluye_resumen}
                        onChange={(no_incluye_resumen) =>
                          setPrecioDraft((current) => ({ ...current, no_incluye_resumen }))
                        }
                        placeholder="Gastos personales, tasas no mencionadas..."
                        minHeight={70}
                      />
                    </div>
                  </div>
                </section>

                <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-black/10 bg-white p-3">
                  <div className="flex flex-wrap gap-2">
                    <TogglePill
                      checked={precioDraft.visible_en_pdf}
                      label="Mostrar opción"
                      onChange={(visible_en_pdf) =>
                        setPrecioDraft((current) => ({ ...current, visible_en_pdf }))
                      }
                    />

                    <TogglePill
                      checked={precioDraft.destacada}
                      label="Opción destacada"
                      onChange={(destacada) =>
                        setPrecioDraft((current) => ({ ...current, destacada }))
                      }
                    />
                  </div>

                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void savePrecio()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                    {editingCombinacionId ? "Actualizar opción comercial" : "Guardar opción comercial"}
                  </button>
                </div>
              </div>
            </section>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[16px] border border-black/10 bg-white/80 p-3 shadow-sm backdrop-blur-xl">
            <button
              type="button"
              onClick={goPreviousStep}
              disabled={step === "aereos"}
              className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Anterior
            </button>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={onPreviewPdf}
                className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
              >
                <FileText size={14} />
                Vista previa PDF
              </button>

              <div className="text-[11.5px] font-normal text-[#64748b]">
                Guardá todas las opciones necesarias antes de cerrar.
              </div>
            </div>

            {step === "precios" ? (
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded-[10px] bg-[#172033] px-4 text-[12px] font-medium text-white hover:bg-black"
              >
                Cerrar edición
              </button>
            ) : (
              <button
                type="button"
                onClick={goNextStep}
                className="h-8 rounded-[10px] bg-[#172033] px-4 text-[12px] font-medium text-white hover:bg-black"
              >
                Siguiente
              </button>
            )}
          </div>
        </main>

                <aside className="grid content-start gap-2.5">
          <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Resumen cargado</h3>

            <div className="grid grid-cols-2 gap-2">
              <SmallMetric label="Aéreos" value={vuelos.length} icon={<Plane size={16} />} />
              <SmallMetric label="Hoteles" value={hoteles.length} icon={<BedDouble size={16} />} />
              <SmallMetric
                label="Servicios"
                value={servicios.length}
                icon={<PackageCheck size={16} />}
              />
              <SmallMetric
                label="Opciones"
                value={combinaciones.length}
                icon={<BadgeDollarSign size={16} />}
              />
            </div>
          </section>

          <SummaryCard title="Aéreos cargados" empty="Todavía no hay aéreos.">
            {vuelos.length > 0 ? (
              <div className="grid gap-1.5">
                {vuelos.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#172033]">
                          {item.titulo || "Aéreo"}
                        </div>

                        <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[#64748b]">
                          {item.raw_text ||
                            item.ruta_resumen ||
                            item.ida_detalle ||
                            item.vuelta_detalle ||
                            "Sin texto"}
                        </div>
                      </div>

                      {item.captura_url ? (
                        <span className="shrink-0 rounded-md bg-sky-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-sky-700 ring-1 ring-sky-100">
                          Imagen
                        </span>
                      ) : null}
                    </div>

                    {item.precio_total ? (
                      <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                        {formatMoneyAR(item.precio_total, item.moneda)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </SummaryCard>

          <SummaryCard title="Hoteles cargados" empty="Todavía no hay hoteles.">
            {hoteles.length > 0 ? (
              <div className="grid gap-1.5">
                {hoteles.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]"
                  >
                    <div className="font-semibold text-[#172033]">
                      {item.nombre || item.titulo || "Hotel"}
                    </div>

                    <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                      {[item.destino, item.regimen, item.habitacion].filter(Boolean).join(" · ") ||
                        "Sin detalle"}
                    </div>

                    {item.precio_total ? (
                      <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                        {formatMoneyAR(item.precio_total, item.moneda)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </SummaryCard>

          <SummaryCard title="Servicios cargados" empty="Todavía no hay servicios.">
            {servicios.length > 0 ? (
              <div className="grid gap-1.5">
                {servicios.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate font-semibold text-[#172033]">
                          {item.nombre || "Servicio"}
                        </div>

                        <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[#64748b]">
                          {item.descripcion || item.tipo}
                        </div>
                      </div>

                      {item.incluido ? (
                        <span className="shrink-0 rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase text-emerald-700 ring-1 ring-emerald-100">
                          Incluido
                        </span>
                      ) : null}
                    </div>

                    {item.precio_total ? (
                      <div className="mt-1 text-[11px] font-semibold text-emerald-700">
                        {formatMoneyAR(item.precio_total, item.moneda)}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </SummaryCard>

          <SummaryCard title="Opciones comerciales" empty="Todavía no hay opciones cargadas.">
            {combinaciones.length > 0 ? (
              <div className="grid gap-1.5">
                {combinaciones.map((item) => {
                  const metadata = getCombinacionMetadata(item);
                  const esPagoACuenta = Boolean(metadata.pagos_a_cuenta);

                  return (
                    <div
                      key={item.id}
                      className={[
                        "rounded-[12px] border p-3 text-[12px] transition",
                        editingCombinacionId === item.id
                          ? "border-[#4f7c90]/40 bg-[#eef6f7]"
                          : "border-black/10 bg-[#f8fafc]"
                      ].join(" ")}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[#172033]">
                            {item.nombre || "Opción"}
                          </div>

                          {item.subtitulo ? (
                            <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[#64748b]">
                              {item.subtitulo}
                            </div>
                          ) : null}
                        </div>

                        <button
                          type="button"
                          onClick={() => editCombinacion(item)}
                          className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[9px] bg-white px-2 text-[10.5px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                        >
                          <Pencil size={12} />
                          Editar
                        </button>
                      </div>

                      <div className="mt-1 font-semibold text-emerald-700">
                        {formatMoneyAR(item.precio_total, item.moneda)}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {item.etiqueta ? (
                          <div className="rounded-md bg-amber-50 px-2 py-1 text-[10px] font-medium uppercase text-amber-700 ring-1 ring-amber-100">
                            {item.etiqueta}
                          </div>
                        ) : null}

                        {item.destacada ? (
                          <div className="rounded-md bg-emerald-50 px-2 py-1 text-[10px] font-medium uppercase text-emerald-700 ring-1 ring-emerald-100">
                            Destacada
                          </div>
                        ) : null}

                        {esPagoACuenta ? (
                          <div className="rounded-md bg-sky-50 px-2 py-1 text-[10px] font-medium uppercase text-sky-700 ring-1 ring-sky-100">
                            Pagos a cuenta
                          </div>
                        ) : null}

                        {item.visible_en_pdf === false ? (
                          <div className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-medium uppercase text-slate-600 ring-1 ring-slate-200">
                            Oculta PDF
                          </div>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </SummaryCard>
        </aside>
      </div>
    </ModalShell>
  );
}

/* =========================================================
   CONFIRM DELETE
========================================================= */

function ConfirmDeleteModal({
  presupuesto,
  saving,
  onClose,
  onConfirm
}: {
  presupuesto: PresupuestoV2 | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  return (
    <ModalShell
      title="Eliminar presupuesto"
      subtitle="Esta acción no usa confirmaciones nativas del sistema."
      onClose={onClose}
      maxWidth="max-w-md"
    >
      <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium leading-6 text-red-800">
        Vas a eliminar el presupuesto{" "}
        <strong>{presupuesto?.numero || presupuesto?.cliente_nombre || "seleccionado"}</strong>.
        Esta acción no se puede deshacer.
      </div>

      <div className="mt-5 flex justify-between gap-2">
        <button
          type="button"
          onClick={onClose}
          disabled={saving}
          className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033] disabled:opacity-50"
        >
          Cancelar
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={() => void onConfirm()}
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-red-600 px-4 text-[12px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          Eliminar
        </button>
      </div>
    </ModalShell>
  );
}


function PdfPreviewModal({
  title,
  html,
  onClose
}: {
  title: string;
  html: string;
  onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  function handlePrint() {
    const frameWindow = iframeRef.current?.contentWindow;

    if (!frameWindow) return;

    frameWindow.focus();
    frameWindow.print();
  }

  return (
    <ModalShell
      title={title}
      subtitle="Vista previa del presupuesto. Desde acá podés imprimir o guardar como PDF."
      onClose={onClose}
      maxWidth="max-w-7xl"
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-normal text-[#64748b]">
          Para generar el PDF final: tocá imprimir y elegí “Guardar como PDF”.
        </div>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
        >
          <FileText size={14} />
          Imprimir / Guardar PDF
        </button>
      </div>

      <div className="overflow-hidden rounded-[16px] border border-black/10 bg-white shadow-sm">
        <iframe
          ref={iframeRef}
          title={title}
          srcDoc={html}
          className="h-[calc(100vh-190px)] w-full bg-white"
        />
      </div>
    </ModalShell>
  );
}

/* =========================================================
   TABLA
========================================================= */

function PresupuestosTable({
  presupuestos,
  loading,
  selectedId,
  onSelect,
  onEdit,
  onEditIa,
  onDuplicate,
  onDelete,
  onPreview,
  onPdf,
  onSendLiveNos
}: {
  presupuestos: PresupuestoV2Resumen[];
  loading: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
  onEdit: (id: string) => void;
  onEditIa: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onPreview: (id: string) => void;
  onPdf: (id: string) => void;
  onSendLiveNos: (id: string) => void;
}) {
  const grid =
    "xl:grid-cols-[105px_minmax(150px,0.95fr)_minmax(170px,1.15fr)_95px_90px_125px_315px]";

  if (loading) {
    return (
      <div className="flex min-h-[280px] items-center justify-center rounded-[16px] border border-black/10 bg-white/62 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-2 text-[12px] font-medium text-[#64748b]">
          <Loader2 size={15} className="animate-spin" />
          Cargando presupuestos...
        </div>
      </div>
    );
  }

  if (presupuestos.length === 0) {
    return <EmptyState text="No hay presupuestos para los filtros seleccionados." />;
  }

  return (
    <section className="relative z-[10] overflow-hidden rounded-[16px] border border-black/10 bg-white/62 shadow-sm backdrop-blur-xl">
      <div
        className={[
          "hidden border-b border-black/10 bg-[#f8fafc] px-3 py-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b] xl:grid",
          grid
        ].join(" ")}
      >
        <div>Número</div>
        <div>Cliente</div>
        <div>Destino</div>
        <div>Salida</div>
        <div>Estado</div>
        <div>Precio</div>
        <div className="text-right">Acciones</div>
      </div>

      <div className="max-h-[calc(100vh-360px)] overflow-y-auto">
        {presupuestos.map((presupuesto) => {
          const selected = selectedId === presupuesto.id;

          return (
            <div
              key={presupuesto.id}
              className={[
                "grid min-w-0 gap-2 border-b border-black/5 px-3 py-3 text-[12px] transition xl:grid",
                grid,
                selected ? "bg-[#eef6f7]" : "hover:bg-[#f8fafc]"
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onSelect(presupuesto.id)}
                className="truncate text-left font-semibold text-[#172033]"
              >
                {presupuesto.numero || "—"}
              </button>

              <button
                type="button"
                onClick={() => onSelect(presupuesto.id)}
                className="flex min-w-0 items-center gap-2 text-left"
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-[#e2e8f0] text-[10px] font-semibold text-[#334155]">
                  {getInitials(getDisplayName(presupuesto))}
                </span>

                <span className="min-w-0">
                  <span className="block truncate font-semibold text-[#172033]">
                    {getDisplayName(presupuesto)}
                  </span>

                  <span className="block truncate text-[10.5px] font-normal text-[#64748b]">
                    {presupuesto.cliente_telefono || presupuesto.cliente_email || "Sin contacto"}
                  </span>
                </span>
              </button>

              <div className="min-w-0">
                <div className="truncate font-semibold text-[#172033]">
                  {presupuesto.destino_principal || "—"}
                </div>

                <div className="truncate text-[10.5px] font-normal text-[#64748b]">
                  {presupuesto.destino_detalle
                    ? `${presupuesto.destino_detalle} · `
                    : ""}
                  {formatDate(presupuesto.fecha_salida)} al {formatDate(presupuesto.fecha_regreso)}
                </div>
              </div>

              <div className="font-normal text-[#475569]">
                {formatDate(presupuesto.fecha_salida)}
              </div>

              <div>
                <EstadoBadge estado={presupuesto.estado} />
              </div>

              <div className="font-semibold text-[#172033]">
                {presupuesto.precio_recomendado !== null
                  ? formatMoneyAR(presupuesto.precio_recomendado, presupuesto.moneda_principal)
                  : presupuesto.precio_desde !== null
                    ? formatMoneyAR(presupuesto.precio_desde, presupuesto.moneda_principal)
                    : "—"}
              </div>

              <div className="flex min-w-[300px] flex-nowrap items-center justify-end gap-1.5">
                <ActionButton
                  label="Editar"
                  onClick={() => onEdit(presupuesto.id)}
                  icon={<Pencil size={13} />}
                />

                <ActionButton
                  label="IA"
                  primary
                  onClick={() => onEditIa(presupuesto.id)}
                  icon={<Sparkles size={13} />}
                />

                <ActionButton
                  label="PDF"
                  onClick={() => onPdf(presupuesto.id)}
                  icon={<FileText size={13} />}
                />

                <RowMoreMenu
                  onDuplicate={() => onDuplicate(presupuesto.id)}
                  onPreview={() => onPreview(presupuesto.id)}
                  onSendLiveNos={() => onSendLiveNos(presupuesto.id)}
                  onDelete={() => onDelete(presupuesto.id)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================
   PANEL PRINCIPAL
========================================================= */

export function PresupuestosV2Panel() {
  const loading = usePresupuestosV2Store((state: PresupuestosState) => state.loading);
  const loadingDetail = usePresupuestosV2Store((state: PresupuestosState) => state.loadingDetail);
  const saving = usePresupuestosV2Store((state: PresupuestosState) => state.saving);
  const error = usePresupuestosV2Store((state: PresupuestosState) => state.error);
  const uploading = usePresupuestosV2Store((state: PresupuestosState) => state.uploading);

  const presupuesto = usePresupuestosV2Store((state: PresupuestosState) => state.presupuesto);
  const vuelos = usePresupuestosV2Store((state: PresupuestosState) => state.vuelos);
  const hoteles = usePresupuestosV2Store((state: PresupuestosState) => state.hoteles);
  const servicios = usePresupuestosV2Store((state: PresupuestosState) => state.servicios);
  const combinaciones = usePresupuestosV2Store((state: PresupuestosState) => state.combinaciones);
  const currentProfile = usePresupuestosV2Store((state: PresupuestosState) => state.currentProfile);
  const vendedores = usePresupuestosV2Store((state: PresupuestosState) => state.vendedores);
  const sucursales = usePresupuestosV2Store((state: PresupuestosState) => state.sucursales);
  const filters = usePresupuestosV2Store((state: PresupuestosState) => state.filters);

  const loadPresupuestos = usePresupuestosV2Store((state: PresupuestosState) => state.loadPresupuestos);
  const loadPresupuestoFull = usePresupuestosV2Store(
    (state: PresupuestosState) => state.loadPresupuestoFull
  );
  const loadCatalogs = usePresupuestosV2Store((state: PresupuestosState) => state.loadCatalogs);

  const createPresupuesto = usePresupuestosV2Store(
    (state: PresupuestosState) => state.createPresupuesto
  );
  const updatePresupuesto = usePresupuestosV2Store(
    (state: PresupuestosState) => state.updatePresupuesto
  );
  const deletePresupuesto = usePresupuestosV2Store(
    (state: PresupuestosState) => state.deletePresupuesto
  );
  const duplicatePresupuesto = usePresupuestosV2Store(
    (state: PresupuestosState) => state.duplicatePresupuesto
  );

  const addVuelo = usePresupuestosV2Store((state: PresupuestosState) => state.addVuelo);
  const updateVuelo = usePresupuestosV2Store((state: PresupuestosState) => state.updateVuelo);
  const deleteVuelo = usePresupuestosV2Store((state: PresupuestosState) => state.deleteVuelo);

  const addHotel = usePresupuestosV2Store((state: PresupuestosState) => state.addHotel);
  const updateHotel = usePresupuestosV2Store((state: PresupuestosState) => state.updateHotel);
  const deleteHotel = usePresupuestosV2Store((state: PresupuestosState) => state.deleteHotel);

  const addServicio = usePresupuestosV2Store((state: PresupuestosState) => state.addServicio);
  const updateServicio = usePresupuestosV2Store((state: PresupuestosState) => state.updateServicio);
  const deleteServicio = usePresupuestosV2Store((state: PresupuestosState) => state.deleteServicio);

  const addCombinacion = usePresupuestosV2Store(
    (state: PresupuestosState) => state.addCombinacion
  );
  const updateCombinacion = usePresupuestosV2Store(
    (state: PresupuestosState) => state.updateCombinacion
  );
  const deleteCombinacion = usePresupuestosV2Store(
    (state: PresupuestosState) => state.deleteCombinacion
  );
  const setCombinacionRecomendada = usePresupuestosV2Store(
    (state: PresupuestosState) => state.setCombinacionRecomendada
  );

  const uploadAdjunto = usePresupuestosV2Store((state: PresupuestosState) => state.uploadAdjunto);
  const selectPresupuesto = usePresupuestosV2Store(
    (state: PresupuestosState) => state.selectPresupuesto
  );
  const setFilter = usePresupuestosV2Store((state: PresupuestosState) => state.setFilter);
  const resetFilters = usePresupuestosV2Store((state: PresupuestosState) => state.resetFilters);
  const clearError = usePresupuestosV2Store((state: PresupuestosState) => state.clearError);
  const getFilteredPresupuestos = usePresupuestosV2Store(
    (state: PresupuestosState) => state.getFilteredPresupuestos
  );
  const getMetrics = usePresupuestosV2Store((state: PresupuestosState) => state.getMetrics);

  const filteredPresupuestos = getFilteredPresupuestos();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [destinosOptions, setDestinosOptions] = useState<SelectOption[]>([]);
  const [pdfPreviewHtml, setPdfPreviewHtml] = useState<string | null>(null);
const [pdfPreviewTitle, setPdfPreviewTitle] = useState("Vista previa PDF");

  useEffect(() => {
    void loadCatalogs();
    void loadPresupuestos();

    void fetchDestinosFromDb().then((items) => {
      setDestinosOptions(items.length > 0 ? items : COMMON_DESTINOS);
    });
  }, [loadCatalogs, loadPresupuestos]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  async function ensureSelected(id: string) {
    selectPresupuesto(id);
    await loadPresupuestoFull(id, true);
  }

  async function handleCreatePresupuesto(
    draft: CreatePresupuestoV2Draft,
    nextMode: "IA" | "MANUAL"
  ): Promise<boolean> {
    const id = await createPresupuesto(draft);

    if (id) {
      await loadPresupuestoFull(id, true);
      setModalMode(nextMode === "IA" ? "ia" : "manual");
      showToast("Presupuesto creado correctamente.");
      return true;
    }

    showToast("No se pudo crear el presupuesto.", "error");
    return false;
  }

  async function handleSaveVuelo(draft: DraftVuelo) {
    const state = usePresupuestosV2Store.getState();
    const currentPresupuesto = state.presupuesto;

    if (!currentPresupuesto) return;

    const ok = draft.id
      ? await updateVuelo({ id: draft.id, ...draft })
      : Boolean(await addVuelo({ ...draft, presupuesto_id: currentPresupuesto.id }));

    if (ok) {
      await loadPresupuestoFull(currentPresupuesto.id, true);
      await loadPresupuestos(true);
      showToast("Aéreo guardado.");
    }
  }

  async function handleSaveHotel(draft: DraftHotel) {
    const state = usePresupuestosV2Store.getState();
    const currentPresupuesto = state.presupuesto;

    if (!currentPresupuesto) return;

    const ok = draft.id
      ? await updateHotel({ id: draft.id, ...draft })
      : Boolean(
          await addHotel({
            ...draft,
            presupuesto_id: currentPresupuesto.id,
            nombre: draft.nombre
          })
        );

    if (ok) {
      await loadPresupuestoFull(currentPresupuesto.id, true);
      await loadPresupuestos(true);
      showToast("Hotel guardado.");
    }
  }

  async function handleSaveServicio(draft: DraftServicio) {
    const state = usePresupuestosV2Store.getState();
    const currentPresupuesto = state.presupuesto;

    if (!currentPresupuesto) return;

    const ok = draft.id
      ? await updateServicio({ id: draft.id, ...draft })
      : Boolean(
          await addServicio({
            ...draft,
            presupuesto_id: currentPresupuesto.id,
            nombre: draft.nombre
          })
        );

    if (ok) {
      await loadPresupuestoFull(currentPresupuesto.id, true);
      await loadPresupuestos(true);
      showToast("Servicio guardado.");
    }
  }

  async function handleSaveCombinacion(draft: DraftCombinacion) {
    const state = usePresupuestosV2Store.getState();
    const currentPresupuesto = state.presupuesto;

    if (!currentPresupuesto) return;

    let combinacionId: string | null = draft.id || null;
    let ok = false;

    if (draft.id) {
      ok = await updateCombinacion({ id: draft.id, ...draft });
    } else {
      combinacionId = await addCombinacion({
        ...draft,
        presupuesto_id: currentPresupuesto.id,
        nombre: draft.nombre
      });

      ok = Boolean(combinacionId);
    }

    if (ok) {
      if (draft.destacada && combinacionId) {
        await setCombinacionRecomendada(combinacionId);
      }

      await loadPresupuestoFull(currentPresupuesto.id, true);
      await loadPresupuestos(true);
      showToast(draft.id ? "Opción comercial actualizada." : "Opción comercial guardada.");
    }
  }

  async function handleDeleteSelected() {
    if (!deleteTargetId) return;

    const ok = await deletePresupuesto(deleteTargetId);

    if (ok) {
      setDeleteTargetId(null);
      setModalMode(null);
      showToast("Presupuesto eliminado.");
    }
  }

  async function handleDuplicate(id: string) {
    await ensureSelected(id);
    const newId = await duplicatePresupuesto(id);

    if (newId) showToast("Presupuesto duplicado.");
  }

async function handleOpenPdf(id: string) {
  await ensureSelected(id);

  const state = usePresupuestosV2Store.getState();

  if (!state.presupuesto) {
    showToast("No se pudo abrir el presupuesto.", "error");
    return;
  }

  const presupuestoPdf = withPdfExtraFields(state.presupuesto, state.vendedores || []);

  const html = buildPresupuestoHtml({
    presupuesto: presupuestoPdf,
    vuelos: state.vuelos,
    hoteles: state.hoteles,
    servicios: state.servicios,
    combinaciones: state.combinaciones
  });

  setPdfPreviewTitle(state.presupuesto.numero || "Vista previa PDF");
  setPdfPreviewHtml(html);
}

function handlePreviewCurrentPdf() {
  const state = usePresupuestosV2Store.getState();

  if (!state.presupuesto) {
    showToast("No se pudo abrir el presupuesto.", "error");
    return;
  }

  const presupuestoPdf = withPdfExtraFields(state.presupuesto, state.vendedores || []);

  const html = buildPresupuestoHtml({
    presupuesto: presupuestoPdf,
    vuelos: state.vuelos,
    hoteles: state.hoteles,
    servicios: state.servicios,
    combinaciones: state.combinaciones
  });

  setPdfPreviewTitle(state.presupuesto.numero || "Vista previa PDF");
  setPdfPreviewHtml(html);
}

  async function handleSendLiveNos(id: string) {
    await ensureSelected(id);

    const state = usePresupuestosV2Store.getState();

    if (!state.presupuesto) {
      showToast("No se encontró el presupuesto.", "error");
      return;
    }

    showToast("Envío por LiveNos preparado. Falta conectar la función final de envío.");
  }

  async function handleUploadVueloImage(file: File): Promise<UploadedImageResult | null> {
    const state = usePresupuestosV2Store.getState();
    const currentPresupuesto = state.presupuesto;

    if (!currentPresupuesto) return null;

    const id = await uploadAdjunto({
      presupuesto_id: currentPresupuesto.id,
      file,
      tipo: "CAPTURA" as PresupuestoAdjuntoTipo,
      entidad_tipo: "VUELO",
      titulo: `Captura de vuelo · ${file.name}`,
      incluir_en_pdf: false
    });

    if (!id) return null;

    const uploaded = usePresupuestosV2Store
      .getState()
      .adjuntos.find((item: PresupuestoAdjunto) => item.id === id);

    if (!uploaded) return null;

    return {
      url: uploaded.file_url,
      path: uploaded.file_path || null
    };
  }

  async function handleApplyPresupuestoIa(payload: PresupuestoIaApplyPayload) {
    const state = usePresupuestosV2Store.getState();
    const currentPresupuesto = state.presupuesto;

    if (!currentPresupuesto) return;

    const parsed = payload.parsed || {};

    const vuelosParsed = getArray(parsed.vuelos);
    const hotelesParsed = getArray(parsed.hoteles);
    const serviciosParsed = getArray(parsed.servicios);
    const opcionesParsed = getArray(parsed.opciones_comerciales).length
      ? getArray(parsed.opciones_comerciales)
      : getArray(parsed.opciones);

    let createdVuelos = 0;
    let createdHoteles = 0;
    let createdServicios = 0;
    let createdOpciones = 0;

    const currentState = usePresupuestosV2Store.getState();

    const vuelosIa = currentState.vuelos.filter(
      (item) => item.metadata?.origen === "PRESUPUESTO_IA" || item.metadata?.carga_modo === "IA"
    );

    const hotelesIa = currentState.hoteles.filter(
      (item) => item.metadata?.origen === "PRESUPUESTO_IA" || item.metadata?.carga_modo === "IA"
    );

    const serviciosIa = currentState.servicios.filter(
      (item) => item.metadata?.origen === "PRESUPUESTO_IA" || item.metadata?.carga_modo === "IA"
    );

    const combinacionesIa = currentState.combinaciones.filter(
      (item) => item.metadata?.origen === "PRESUPUESTO_IA" || item.metadata?.carga_modo === "IA"
    );

    for (const item of combinacionesIa) {
      await deleteCombinacion(item.id);
    }

    for (const item of serviciosIa) {
      await deleteServicio(item.id);
    }

    for (const item of hotelesIa) {
      await deleteHotel(item.id);
    }

    for (const item of vuelosIa) {
      await deleteVuelo(item.id);
    }

    await loadPresupuestoFull(currentPresupuesto.id, true);

    const createdVueloIds: string[] = [];
    const createdHotelIds: string[] = [];
    const createdServicioIds: string[] = [];

    for (const vueloItem of vuelosParsed) {
      const metadata = safeRecord(vueloItem.metadata);
      const title = String(vueloItem.titulo || vueloItem.nombre || `Vuelo ${createdVuelos + 1}`).trim();
      const raw = buildFlightRawText(vueloItem, payload.raw_text);

      const vueloPayload = {
        presupuesto_id: currentPresupuesto.id,
        titulo: title,
        aerolinea: String(vueloItem.aerolinea || vueloItem.compania || "") || null,
        ruta_resumen: String(vueloItem.ruta_resumen || vueloItem.ruta || "") || null,
        ida_origen: String(vueloItem.ida_origen || vueloItem.origen || "") || null,
        ida_destino: String(vueloItem.ida_destino || vueloItem.destino || "") || null,
        ida_fecha:
          String(vueloItem.ida_fecha || vueloItem.fecha_salida || currentPresupuesto.fecha_salida || "") ||
          null,
        ida_hora_salida: String(vueloItem.ida_hora_salida || vueloItem.hora_salida || "") || null,
        ida_hora_llegada: String(vueloItem.ida_hora_llegada || vueloItem.hora_llegada || "") || null,
        ida_escalas: String(vueloItem.ida_escalas || vueloItem.escalas || "") || null,
        ida_detalle: String(vueloItem.ida_detalle || raw || "") || null,
        vuelta_origen: String(vueloItem.vuelta_origen || "") || null,
        vuelta_destino: String(vueloItem.vuelta_destino || "") || null,
        vuelta_fecha: String(vueloItem.vuelta_fecha || currentPresupuesto.fecha_regreso || "") || null,
        vuelta_hora_salida: String(vueloItem.vuelta_hora_salida || "") || null,
        vuelta_hora_llegada: String(vueloItem.vuelta_hora_llegada || "") || null,
        vuelta_escalas: String(vueloItem.vuelta_escalas || "") || null,
        vuelta_detalle: String(vueloItem.vuelta_detalle || "") || null,
        equipaje: String(vueloItem.equipaje || "") || null,
        tarifa_familia: String(vueloItem.tarifa_familia || vueloItem.clase || "") || null,
        condiciones: String(vueloItem.condiciones || "") || null,
        precio_total:
          typeof vueloItem.precio_total === "number"
            ? vueloItem.precio_total
            : toNumberOrNull(String(vueloItem.precio_total || "")),
        moneda: toMonedaSimple(
          String(vueloItem.moneda || currentPresupuesto.moneda_principal || "USD")
        ),
        raw_text: raw,
        incluir_en_pdf: vueloItem.incluir_en_pdf === undefined ? true : Boolean(vueloItem.incluir_en_pdf),
        es_principal: createdVuelos === 0,
        metadata: {
          ...metadata,
          carga_modo: "IA",
          origen: "PRESUPUESTO_IA",
          mostrar_precio_en_pdf: Boolean(vueloItem.mostrar_precio_en_pdf),
          mostrar_raw_text_en_pdf: Boolean(raw),
          parsed: vueloItem
        }
      } as CreateVueloDraft;

      const id = await addVuelo(vueloPayload);

      if (id) {
        createdVuelos += 1;
        createdVueloIds.push(id);
      }
    }

    for (const hotelItem of hotelesParsed) {
      const metadata = safeRecord(hotelItem.metadata);
      const nombre = String(hotelItem.nombre || hotelItem.titulo || `Hotel ${createdHoteles + 1}`).trim();

      if (!nombre) continue;

      const destino = String(
        hotelItem.destino ||
          currentPresupuesto.destino_detalle ||
          currentPresupuesto.destino_principal ||
          ""
      ).trim();

      const descripcionOriginal = buildHotelDescription(hotelItem);

  let googleHotel: Record<string, unknown> | null = null;

try {
  const { data: enrichData, error: enrichError } = await supabase.functions.invoke(
    "hotel-google-enrich",
    {
      body: {
        hotel_nombre: nombre,
        destino,
        direccion: String(
          hotelItem.zona ||
            hotelItem.ubicacion ||
            hotelItem.direccion ||
            ""
        )
      }
    }
  );

  if (enrichError) {
    console.warn("hotel-google-enrich error:", enrichError);
  } else if (
    enrichData &&
    typeof enrichData === "object" &&
    "hotel" in enrichData
  ) {
    googleHotel = (enrichData as { hotel?: Record<string, unknown> }).hotel || null;
    console.info("hotel-google-enrich ok:", googleHotel);
  }
} catch (enrichCatch) {
  console.warn("hotel-google-enrich catch:", enrichCatch);
}

const googleFotos = Array.isArray(googleHotel?.fotos)
  ? googleHotel.fotos
      .map((foto) => {
        if (!foto || typeof foto !== "object" || Array.isArray(foto)) return "";

        const record = foto as Record<string, unknown>;
        return String(record.url || "").trim();
      })
      .filter(Boolean)
  : [];

const googleDescripcion = String(googleHotel?.descripcion || "").trim();
const googleDireccion = String(googleHotel?.direccion || "").trim();
const googleFotoUrl = String(googleHotel?.foto_url || "").trim();
const googleNombre = String(googleHotel?.nombre || "").trim();

const hotelPayload = {
  presupuesto_id: currentPresupuesto.id,
  nombre: googleNombre || nombre,
  titulo: String(hotelItem.titulo || googleNombre || nombre),
  destino,
  zona:
    googleDireccion ||
    String(hotelItem.zona || hotelItem.ubicacion || hotelItem.direccion || "") ||
    null,
  categoria: String(hotelItem.categoria || "") || null,
  regimen: String(hotelItem.regimen || "") || null,
  habitacion: String(hotelItem.habitacion || "") || null,
  ocupacion: String(hotelItem.ocupacion || "") || null,
  check_in: String(hotelItem.check_in || currentPresupuesto.fecha_salida || "") || null,
  check_out: String(hotelItem.check_out || currentPresupuesto.fecha_regreso || "") || null,
  noches:
    typeof hotelItem.noches === "number"
      ? hotelItem.noches
      : currentPresupuesto.noches ||
        diffNights(currentPresupuesto.fecha_salida, currentPresupuesto.fecha_regreso),
  descripcion: googleDescripcion || descripcionOriginal,
  beneficios: String(hotelItem.beneficios || "") || null,
  condiciones: String(hotelItem.condiciones || "") || null,
  politica_cancelacion: String(hotelItem.politica_cancelacion || "") || null,
  imagen_url: googleFotoUrl || String(hotelItem.imagen_url || hotelItem.foto_url || "") || null,
  captura_url: String(hotelItem.captura_url || "") || null,
  captura_path: String(hotelItem.captura_path || "") || null,
  precio_total:
    typeof hotelItem.precio_total === "number"
      ? hotelItem.precio_total
      : toNumberOrNull(String(hotelItem.precio_total || "")),
  moneda: toMonedaSimple(
    String(hotelItem.moneda || currentPresupuesto.moneda_principal || "USD")
  ),
  incluir_en_pdf: hotelItem.incluir_en_pdf === undefined ? true : Boolean(hotelItem.incluir_en_pdf),
  es_principal: createdHoteles === 0,

  // Importante: no metemos payload.raw_text completo porque contamina el hotel con texto de vuelos/prompt.
  raw_text: String(hotelItem.raw_text || hotelItem.texto_libre || descripcionOriginal || ""),

  metadata: {
    ...metadata,
    carga_modo: "IA",
    origen: "PRESUPUESTO_IA",
    mostrar_precio_en_pdf: Boolean(hotelItem.mostrar_precio_en_pdf),
    google_place: googleHotel,
    fotos: googleFotos,
    google_maps_url: googleHotel?.google_maps_url || null,
    website: googleHotel?.website || null,
    telefono: googleHotel?.telefono || null,
    rating: googleHotel?.rating || null,
    user_ratings_total: googleHotel?.user_ratings_total || null,
    parsed: hotelItem
  }
} as CreateHotelDraft;

const id = await addHotel(hotelPayload);

if (id) {
  createdHoteles += 1;
  createdHotelIds.push(id);


}
    }

    for (const servicioItem of serviciosParsed) {
      const metadata = safeRecord(servicioItem.metadata);
      const nombre = String(servicioItem.nombre || servicioItem.titulo || `Servicio ${createdServicios + 1}`);

      const servicioPayload = {
        presupuesto_id: currentPresupuesto.id,
        nombre,
        tipo: String(servicioItem.tipo || "OTRO") as PresupuestoServicioTipo,
        descripcion: String(servicioItem.descripcion || servicioItem.texto_libre || servicioItem.raw_text || ""),
        incluido: servicioItem.incluido === undefined ? true : Boolean(servicioItem.incluido),
        opcional: Boolean(servicioItem.opcional),
        precio_total:
          typeof servicioItem.precio_total === "number"
            ? servicioItem.precio_total
            : toNumberOrNull(String(servicioItem.precio_total || "")),
        moneda: toMonedaSimple(
          String(servicioItem.moneda || currentPresupuesto.moneda_principal || "USD")
        ),
        incluir_en_pdf:
          servicioItem.incluir_en_pdf === undefined ? true : Boolean(servicioItem.incluir_en_pdf),
        metadata: {
          ...metadata,
          carga_modo: "IA",
          origen: "PRESUPUESTO_IA",
          mostrar_precio_en_pdf: Boolean(servicioItem.mostrar_precio_en_pdf),
          parsed: servicioItem
        }
      } as CreateServicioDraft;

      const id = await addServicio(servicioPayload);

      if (id) {
        createdServicios += 1;
        createdServicioIds.push(id);
      }
    }

    for (const opcionItem of opcionesParsed) {
      const metadata = safeRecord(opcionItem.metadata);
      const parsedMetadata = safeRecord(opcionItem.metadata);

      const precioTotal =
        typeof opcionItem.precio_total === "number"
          ? opcionItem.precio_total
          : toNumberOrNull(String(opcionItem.precio_total || opcionItem.precio || ""));

      if (!precioTotal || precioTotal <= 0) continue;

      const formasPago =
        getArray(opcionItem.formas_pago).length > 0
          ? getArray(opcionItem.formas_pago)
          : getArray(parsedMetadata.formas_pago);

      const promociones =
        getArray(opcionItem.promociones).length > 0
          ? getArray(opcionItem.promociones)
          : getArray(parsedMetadata.promociones);

      const descuentos =
        getArray(opcionItem.descuentos).length > 0
          ? getArray(opcionItem.descuentos)
          : getArray(parsedMetadata.descuentos);

      const tarifasPasajeros =
        getArray(opcionItem.tarifas_pasajeros).length > 0
          ? getArray(opcionItem.tarifas_pasajeros)
          : getArray(parsedMetadata.tarifas_pasajeros);

      const opcionVueloIds = getStringArray(opcionItem.vuelos_ids || metadata.vuelos_ids);
      const opcionHotelIds = getStringArray(opcionItem.hoteles_ids || metadata.hoteles_ids);
      const opcionServicioIds = getStringArray(opcionItem.servicios_ids || metadata.servicios_ids);

      const combinacionPayload = {
        presupuesto_id: currentPresupuesto.id,
        nombre: String(opcionItem.nombre || opcionItem.titulo || `Opción ${createdOpciones + 1}`),
        subtitulo: String(opcionItem.subtitulo || "Paquete completo"),
        descripcion: String(opcionItem.descripcion || ""),
        precio_total: precioTotal,
        moneda: toMonedaSimple(
          String(opcionItem.moneda || currentPresupuesto.moneda_principal || "USD")
        ),
        precio_contado:
          typeof opcionItem.precio_contado === "number"
            ? opcionItem.precio_contado
            : toNumberOrNull(String(opcionItem.precio_contado || "")),
        precio_transferencia:
          typeof opcionItem.precio_transferencia === "number"
            ? opcionItem.precio_transferencia
            : toNumberOrNull(String(opcionItem.precio_transferencia || "")),
        precio_tarjeta:
          typeof opcionItem.precio_tarjeta === "number"
            ? opcionItem.precio_tarjeta
            : toNumberOrNull(String(opcionItem.precio_tarjeta || "")),
        precio_financiado:
          typeof opcionItem.precio_financiado === "number"
            ? opcionItem.precio_financiado
            : toNumberOrNull(String(opcionItem.precio_financiado || "")),
        seña:
          typeof opcionItem.seña === "number"
            ? opcionItem.seña
            : toNumberOrNull(String(opcionItem.seña || "")),
        saldo:
          typeof opcionItem.saldo === "number"
            ? opcionItem.saldo
            : toNumberOrNull(String(opcionItem.saldo || "")),
        forma_pago_resumen: String(opcionItem.forma_pago_resumen || opcionItem.forma_pago || ""),
        condiciones_pago: String(opcionItem.condiciones_pago || ""),
        incluye_resumen: String(
          opcionItem.incluye_resumen || opcionItem.incluye || parsed.incluye_general || ""
        ),
        no_incluye_resumen: String(
          opcionItem.no_incluye_resumen || opcionItem.no_incluye || parsed.no_incluye_general || ""
        ),
        notas: String(opcionItem.notas || parsed.condiciones_generales || ""),
        destacada: createdOpciones === 0,
        visible_en_pdf: opcionItem.visible_en_pdf === undefined ? true : Boolean(opcionItem.visible_en_pdf),
        metadata: {
          ...metadata,
          carga_modo: "IA",
          origen: "PRESUPUESTO_IA",
          raw_text: payload.raw_text,
          precio_es_total_paquete: true,
          mostrar_precio_por_pasajero: Boolean(opcionItem.mostrar_precio_por_pasajero),
          composicion_precio_texto:
            String(opcionItem.composicion_precio_texto || metadata.composicion_precio_texto || "") ||
            null,
          formas_pago: formasPago,
          promociones,
          descuentos,
          tarifas_pasajeros: tarifasPasajeros,
          vuelos_ids: opcionVueloIds.length ? opcionVueloIds : createdVueloIds,
          hoteles_ids: opcionHotelIds.length ? opcionHotelIds : createdHotelIds,
          servicios_ids: opcionServicioIds.length ? opcionServicioIds : createdServicioIds,
          parsed: opcionItem
        }
      } as CreateCombinacionDraft;

      const id = await addCombinacion(combinacionPayload);

      if (id) createdOpciones += 1;
    }

    const destinosIa = getDestinosFromParsedIa(parsed, currentPresupuesto);
    const destinoPrincipalIa = buildDestinoPrincipalFromDraft(destinosIa);
    const destinoDetalleIa = buildDestinoDetalleFromDraft(destinosIa);

    await updatePresupuesto({
      id: currentPresupuesto.id,
      origen_carga: "IA",
      destino_principal: destinoPrincipalIa || currentPresupuesto.destino_principal,
      destino_detalle: destinoDetalleIa || currentPresupuesto.destino_detalle,
      metadata: {
        ...(currentPresupuesto.metadata || {}),
        destinos_presupuestados: destinosIa,
        presupuesto_ia_raw_text: payload.raw_text,
        presupuesto_ia_parsed_at: new Date().toISOString(),
        presupuesto_ia_resultado: parsed
      }
    });

    await loadPresupuestoFull(currentPresupuesto.id, true);
    await loadPresupuestos(true);
    setModalMode("manual");

    showToast(
      `IA aplicada: ${createdVuelos} aéreo(s), ${createdHoteles} hotel(es), ${createdServicios} servicio(s), ${createdOpciones} opción(es).`
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Presupuestos
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Comercial
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Armá propuestas con IA, opciones comerciales, pagos flexibles, promos y PDF.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                void loadPresupuestos();
                if (presupuesto?.id) void loadPresupuestoFull(presupuesto.id, true);
              }}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => setModalMode("nuevo")}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Nuevo presupuesto
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        {error ? <InlineError message={error} onClose={clearError} /> : null}

        <section className="relative z-[60] mb-3 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Filter size={14} className="text-[#4f7c90]" />
                <h2 className="text-[12px] font-semibold text-[#172033]">Filtros</h2>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Estado: {filters.estado} · Marca: {filters.marca} · Vendedor:{" "}
                {filters.vendedorId} · Sucursal: {filters.sucursalId}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
              >
                {filtersOpen ? "Ocultar" : "Mostrar"}
                <ChevronsUpDown size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <div className="mt-3">
              <PresupuestoFilters
                filters={filters}
                vendedores={vendedores}
                sucursales={sucursales}
                onSetFilter={setFilter}
                onReset={resetFilters}
              />
            </div>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Total" value={metrics.total} icon={FileText} tone="orange" />
          <MetricCard label="Borradores" value={metrics.borradores} icon={Pencil} tone="slate" />
          <MetricCard label="Enviados" value={metrics.enviados} icon={Send} tone="blue" />
          <MetricCard label="Aceptados" value={metrics.aceptados} icon={Check} tone="green" />
          <MetricCard label="Rechazados" value={metrics.rechazados} icon={Trash2} tone="red" />
          <MetricCard label="Vencidos" value={metrics.vencidos} icon={AlertTriangle} tone="amber" />
        </section>

        <section className="relative z-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-[#172033]">Listado de presupuestos</h2>
              <p className="text-[11.5px] font-normal text-[#64748b]">
                {loading ? "Cargando..." : `${filteredPresupuestos.length} presupuestos encontrados`}
              </p>
            </div>
          </div>

          <PresupuestosTable
            presupuestos={filteredPresupuestos}
            loading={loading}
            selectedId={presupuesto?.id || null}
            onSelect={(id) => {
              void ensureSelected(id);
            }}
            onEdit={(id) => {
              void ensureSelected(id).then(() => setModalMode("manual"));
            }}
            onEditIa={(id) => {
              void ensureSelected(id).then(() => setModalMode("ia"));
            }}
            onDuplicate={(id) => {
              void handleDuplicate(id);
            }}
            onDelete={(id) => {
              setDeleteTargetId(id);
              void ensureSelected(id).then(() => setModalMode("confirmDelete"));
            }}
            onPreview={(id) => {
              void handleOpenPdf(id);
            }}
            onPdf={(id) => {
              void handleOpenPdf(id);
            }}
            onSendLiveNos={(id) => {
              void handleSendLiveNos(id);
            }}
          />
        </section>
      </main>

      {modalMode === "nuevo" ? (
        <NuevoPresupuestoModal
          vendedores={vendedores}
          sucursales={sucursales}
          destinos={destinosOptions.length > 0 ? destinosOptions : COMMON_DESTINOS}
          currentProfile={currentProfile}
          saving={saving}
          onClose={() => setModalMode(null)}
          onCreate={handleCreatePresupuesto}
        />
      ) : null}

      {modalMode === "ia" && presupuesto ? (
        <PresupuestoIaModal
          presupuesto={presupuesto}
          saving={saving}
          onClose={() => setModalMode(null)}
          onApply={handleApplyPresupuestoIa}
        />
      ) : null}

      {modalMode === "manual" && presupuesto ? (
        <PresupuestoManualModal
          presupuesto={presupuesto}
          vuelos={vuelos}
          hoteles={hoteles}
          servicios={servicios}
          combinaciones={combinaciones}
          saving={saving || loadingDetail}
          uploading={uploading}
          onClose={() => setModalMode(null)}
          onSaveVuelo={handleSaveVuelo}
          onSaveHotel={handleSaveHotel}
          onSaveServicio={handleSaveServicio}
          onSaveCombinacion={handleSaveCombinacion}
          onUploadImage={handleUploadVueloImage}
          onPreviewPdf={handlePreviewCurrentPdf}
        />
      ) : null}

      {modalMode === "confirmDelete" ? (
        <ConfirmDeleteModal
          presupuesto={presupuesto}
          saving={saving}
          onClose={() => {
            setDeleteTargetId(null);
            setModalMode(null);
          }}
          onConfirm={handleDeleteSelected}
        />
      ) : null}

      {pdfPreviewHtml ? (
  <PdfPreviewModal
    title={pdfPreviewTitle}
    html={pdfPreviewHtml}
    onClose={() => setPdfPreviewHtml(null)}
  />
) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default PresupuestosV2Panel;