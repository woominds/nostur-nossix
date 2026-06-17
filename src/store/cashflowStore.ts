import { create } from "zustand";
import { supabase } from "../lib/supabase";

/* =========================================================
   TIPOS BASE
========================================================= */

export type ProfileLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: string;
  color: string | null;
  activo: boolean;
};

export type ProveedorLite = {
  id: string;
  nombre: string | null;
  nombre_comercial?: string | null;
  razon_social: string | null;
  cuit: string | null;
  email?: string | null;
  telefono?: string | null;
  observaciones?: string | null;
  activo: boolean;
};

export type CajaLite = {
  id: string;
  nombre: string;
  moneda?: string | null;
  tipo?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

/* =========================================================
   CASHFLOW
========================================================= */

export type CashflowOrigen =
  | "FACTURA"
  | "CUOTA"
  | "RECURRENTE_PROYECTADO"
  | "RECURRENTE"
  | "MANUAL";

export type CashflowEstado =
  | "PENDIENTE"
  | "PROYECTADA"
  | "PAGADA"
  | "CANCELADA"
  | "VENCIDA"
  | "POR_VENCER";

export type CashflowItem = {
  id: string;
  source_id: string | null;
  factura_id: string | null;
  cuota_id: string | null;
  recurrente_id: string | null;

  anio: number;
  mes: number;
  periodo: string;
  fecha: string;

  proveedor_id: string | null;
  proveedor_nombre: string | null;
  concepto: string;
  descripcion: string | null;
  numero_factura: string | null;

  tipo_origen: CashflowOrigen | string;
  estado: CashflowEstado | string;
  moneda: string;

  importe: string | number;
  saldo_pendiente: string | number;
  total_pagado: string | number;

  sucursal_id: string | null;
  sucursal_nombre: string | null;

  no_impacta_caja: boolean;
  plan_pago: boolean;
  es_proyectado: boolean;
  activo: boolean;

  fecha_emision?: string | null;
  fecha_vencimiento?: string | null;

  neto_gravado?: string | number | null;
  iva_porcentaje?: string | number | null;
  iva_importe?: string | number | null;
  no_gravado?: string | number | null;
  exento?: string | number | null;

  observaciones?: string | null;
};

export type CashflowResumenMensual = {
  anio: number;
  moneda: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  concepto: string;
  tipo_origen: string;
  sucursal_id: string | null;
  sucursal_nombre: string | null;

  ene: string | number | null;
  feb: string | number | null;
  mar: string | number | null;
  abr: string | number | null;
  may: string | number | null;
  jun: string | number | null;
  jul: string | number | null;
  ago: string | number | null;
  sep: string | number | null;
  oct: string | number | null;
  nov: string | number | null;
  dic: string | number | null;

  total_anual: string | number;
  saldo_anual: string | number;
  cantidad_items: number;
};

/* =========================================================
   DRAFTS
========================================================= */

export type CashflowFacturaDraft = {
  factura_id: string | null;
  recurrente_id: string | null;
  cuota_id: string | null;

  proveedor_id: string | null;
  proveedor_nombre: string;

  descripcion: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  periodo: string;

  moneda: string;
  sucursal_id: string | null;

  neto_gravado: string;
  iva_porcentaje: string;
  iva_importe: string;
  no_gravado: string;
  exento: string;
  total: string;

  no_impacta_caja: boolean;
  plan_pago: boolean;
  observaciones: string;

  estado: "PENDIENTE" | "PROYECTADA";
};

export type CashflowPagoDraft = {
  factura_id: string;
  cuota_id: string | null;

  fecha_pago: string;
  caja_id: string | null;
  caja_nombre: string;

  forma_pago_id: string | null;
  forma_pago: string;

  moneda: string;
  importe: string;

  no_impacta_caja: boolean;
  observaciones: string;
};



export type CashflowRecurrenteDraft = {
  id: string;
  proveedor_id: string | null;
  proveedor_nombre: string;

  descripcion: string;
  moneda: string;
  importe_estimado: string;

  dia_vencimiento: string;
  categoria: string;

  no_impacta_caja: boolean;
  generar_automatico: boolean;

  fecha_inicio: string;
  fecha_fin: string;

  observaciones: string;
  activo: boolean;
};

/* =========================================================
   FILTROS / MÉTRICAS
========================================================= */

export type CashflowFilters = {
  anio: number;
  mes: number;
  moneda: "todas" | "ARS" | "USD";
  proveedorId: string;
  sucursalId: string;
  origen: "todos" | "FACTURA" | "CUOTA" | "RECURRENTE_PROYECTADO" | "RECURRENTE" | "MANUAL";
  estado: "todos" | "pendientes" | "vencidas" | "por_vencer" | "pagadas" | "proyectadas";
  search: string;
};

export type CashflowMetrics = {
  totalMesArs: number;
  totalMesUsd: number;
  saldoMesArs: number;
  saldoMesUsd: number;
  vencidas: number;
  porVencer: number;
  proyectadas: number;
  pagadas: number;
  totalItems: number;
};

type CashflowState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageCashflow: boolean;

  items: CashflowItem[];
  resumen: CashflowResumenMensual[];

  catalogos: {
    proveedores: ProveedorLite[];
    cajas: CajaLite[];
    sucursales: SucursalLite[];
  };

  filters: CashflowFilters;
  selectedItemId: string | null;

  loadCashflow: () => Promise<void>;

  saveFacturaFromCashflow: (draft: CashflowFacturaDraft) => Promise<boolean>;
  registrarPagoFromCashflow: (draft: CashflowPagoDraft) => Promise<boolean>;
  updateRecurrenteFromCashflow: (draft: CashflowRecurrenteDraft) => Promise<boolean>;

  createProveedorInline: (nombre: string) => Promise<ProveedorLite | null>;

  setFilter: <K extends keyof CashflowFilters>(key: K, value: CashflowFilters[K]) => void;
  resetFilters: () => void;
  selectItem: (id: string | null) => void;
  clearError: () => void;

  getFilteredItems: () => CashflowItem[];
  getSelectedItem: () => CashflowItem | null;
  getItemsByDay: () => Record<string, CashflowItem[]>;
  getMetrics: () => CashflowMetrics;
};

/* =========================================================
   HELPERS FECHA / TEXTO / IMPORTES
========================================================= */

function getToday(): string {
  const now = new Date();
  const argentinaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" })
  );

  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCurrentYear(): number {
  return Number(getToday().slice(0, 4));
}

function getCurrentMonth(): number {
  return Number(getToday().slice(5, 7));
}

function getDefaultFilters(): CashflowFilters {
  return {
    anio: getCurrentYear(),
    mes: getCurrentMonth(),
    moneda: "todas",
    proveedorId: "todos",
    sucursalId: "todas",
    origen: "todos",
    estado: "pendientes",
    search: ""
  };
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyToInput(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  return String(value).replace(".", ",");
}

function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

function getPeriod(anio: number, mes: number): string {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

function normalizeError(error: unknown): string {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "Ocurrió un error.");

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para esta acción.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("duplicate key")) {
      return "Ya existe un registro igual.";
    }

    return message;
  }

  return String(error);
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileManage(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      ["administracion", "gerencia", "admin_general"].includes(profile.rol)
  );
}

function canProfileUse(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      ["administracion", "gerencia", "admin_general", "vendedor"].includes(profile.rol)
  );
}

function getEstadoVisual(item: CashflowItem): string {
  if (item.estado === "PAGADA" || item.estado === "CANCELADA") return item.estado;
  if (item.fecha < getToday()) return "VENCIDA";
  if (item.fecha <= addDays(getToday(), 7)) return "POR_VENCER";
  return item.estado;
}

function getProveedorDisplayName(proveedor: ProveedorLite): string {
  return (
    proveedor.nombre_comercial ||
    proveedor.nombre ||
    proveedor.razon_social ||
    "Proveedor sin nombre"
  );
}

function getCajaDisplayName(caja: CajaLite): string {
  const moneda = caja.moneda ? ` · ${caja.moneda}` : "";
  const tipo = caja.tipo ? ` · ${caja.tipo}` : "";

  return `${caja.nombre}${moneda}${tipo}`;
}

function buildFacturaEstadoFromDraft(draft: CashflowFacturaDraft): "PENDIENTE" | "PROYECTADA" {
  if (draft.numero_factura.trim()) return "PENDIENTE";
  return draft.estado || "PENDIENTE";
}

function normalizeCashflowItem(raw: Partial<CashflowItem>): CashflowItem {
  const id = String(raw.id || "");

  return {
    id,
    source_id: raw.source_id || raw.factura_id || raw.cuota_id || raw.recurrente_id || id || null,
    factura_id: raw.factura_id || null,
    cuota_id: raw.cuota_id || null,
    recurrente_id: raw.recurrente_id || null,

    anio: Number(raw.anio || getCurrentYear()),
    mes: Number(raw.mes || getCurrentMonth()),
    periodo: raw.periodo || getPeriod(Number(raw.anio || getCurrentYear()), Number(raw.mes || getCurrentMonth())),
    fecha: raw.fecha || getToday(),

    proveedor_id: raw.proveedor_id || null,
    proveedor_nombre: raw.proveedor_nombre || null,
    concepto: raw.concepto || raw.descripcion || "Sin concepto",
    descripcion: raw.descripcion || raw.concepto || null,
    numero_factura: raw.numero_factura || null,

    tipo_origen: raw.tipo_origen || "MANUAL",
    estado: raw.estado || "PENDIENTE",
    moneda: raw.moneda || "ARS",

    importe: raw.importe || 0,
    saldo_pendiente: raw.saldo_pendiente || raw.importe || 0,
    total_pagado: raw.total_pagado || 0,

    sucursal_id: raw.sucursal_id || null,
    sucursal_nombre: raw.sucursal_nombre || null,

    no_impacta_caja: Boolean(raw.no_impacta_caja),
    plan_pago: Boolean(raw.plan_pago),
    es_proyectado: Boolean(raw.es_proyectado),
    activo: raw.activo !== false,

    fecha_emision: raw.fecha_emision || null,
    fecha_vencimiento: raw.fecha_vencimiento || raw.fecha || null,

    neto_gravado: raw.neto_gravado ?? null,
    iva_porcentaje: raw.iva_porcentaje ?? null,
    iva_importe: raw.iva_importe ?? null,
    no_gravado: raw.no_gravado ?? null,
    exento: raw.exento ?? null,

    observaciones: raw.observaciones || null
  };
}

/* =========================================================
   EXPORTS PARA PANEL
========================================================= */

export function getCashflowProveedorLabel(proveedor: ProveedorLite): string {
  return getProveedorDisplayName(proveedor);
}

export function getCashflowCajaLabel(caja: CajaLite): string {
  return getCajaDisplayName(caja);
}

export function createFacturaDraftFromCashflowItem(
  item?: CashflowItem | null
): CashflowFacturaDraft {
  const today = getToday();

  if (!item) {
    return {
      factura_id: null,
      recurrente_id: null,
      cuota_id: null,

      proveedor_id: null,
      proveedor_nombre: "",

      descripcion: "",
      numero_factura: "",
      fecha_emision: today,
      fecha_vencimiento: today,
      periodo: today.slice(0, 7),

      moneda: "ARS",
      sucursal_id: null,

      neto_gravado: "",
      iva_porcentaje: "21",
      iva_importe: "0",
      no_gravado: "0",
      exento: "0",
      total: "0",

      no_impacta_caja: false,
      plan_pago: false,
      observaciones: "",

      estado: "PENDIENTE"
    };
  }

  const isProjected = item.es_proyectado || item.tipo_origen === "RECURRENTE_PROYECTADO";
  const total = item.importe || item.saldo_pendiente || "0";

  return {
    factura_id: isProjected ? null : item.factura_id,
    recurrente_id: item.recurrente_id,
    cuota_id: item.cuota_id,

    proveedor_id: item.proveedor_id,
    proveedor_nombre: item.proveedor_nombre || "",

    descripcion: item.descripcion || item.concepto || "",
    numero_factura: item.numero_factura || "",
    fecha_emision: item.fecha_emision || today,
    fecha_vencimiento: item.fecha_vencimiento || item.fecha || today,
    periodo: item.periodo || item.fecha.slice(0, 7),

    moneda: item.moneda || "ARS",
    sucursal_id: item.sucursal_id || null,

    neto_gravado: moneyToInput(item.neto_gravado ?? total),
    iva_porcentaje: moneyToInput(item.iva_porcentaje ?? "21"),
    iva_importe: moneyToInput(item.iva_importe ?? "0"),
    no_gravado: moneyToInput(item.no_gravado ?? "0"),
    exento: moneyToInput(item.exento ?? "0"),
    total: moneyToInput(total),

    no_impacta_caja: Boolean(item.no_impacta_caja),
    plan_pago: Boolean(item.plan_pago),
    observaciones: item.observaciones || "",

    estado: isProjected || item.estado === "PROYECTADA" ? "PROYECTADA" : "PENDIENTE"
  };
}

export function createPagoDraftFromCashflowItem(
  item?: CashflowItem | null
): CashflowPagoDraft {
  return {
    factura_id: item?.factura_id || "",
    cuota_id: item?.cuota_id || null,

    fecha_pago: getToday(),
    caja_id: null,
    caja_nombre: "",

    forma_pago_id: null,
    forma_pago: "",

    moneda: item?.moneda || "ARS",
    importe: item ? moneyToInput(item.saldo_pendiente || item.importe || "0") : "",

    no_impacta_caja: Boolean(item?.no_impacta_caja),
    observaciones: ""
  };
}

export function createRecurrenteDraftFromCashflowItem(
  item: CashflowItem
): CashflowRecurrenteDraft {
  return {
    id: item.recurrente_id || "",
    proveedor_id: item.proveedor_id,
    proveedor_nombre: item.proveedor_nombre || "",

    descripcion: item.descripcion || item.concepto || "",
    moneda: item.moneda || "ARS",
    importe_estimado: moneyToInput(item.importe || "0"),

    dia_vencimiento: item.fecha ? String(Number(item.fecha.slice(8, 10))) : "10",
    categoria: "",

    no_impacta_caja: Boolean(item.no_impacta_caja),
    generar_automatico: true,

    fecha_inicio: item.fecha || getToday(),
    fecha_fin: "",

    observaciones: item.observaciones || "",
    activo: true
  };
}

/* =========================================================
   STORE
========================================================= */

export const useCashflowStore = create<CashflowState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageCashflow: false,

  items: [],
  resumen: [],

  catalogos: {
    proveedores: [],
    cajas: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedItemId: null,

  /* =========================================================
     LOAD
  ========================================================= */

  loadCashflow: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageCashflow: false,
        items: [],
        resumen: [],
        error: "No hay usuario autenticado."
      });

      return;
    }

    const profileRes = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .maybeSingle();

    if (profileRes.error) {
      set({ loading: false, error: normalizeError(profileRes.error) });
      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManageCashflow = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageCashflow,
        items: [],
        resumen: [],
        error: "Tu usuario no tiene acceso al módulo Cashflow."
      });

      return;
    }

    const filters = get().filters;

    let itemsQuery = supabase
      .from("v_cashflow_mensual_detalle")
      .select("*")
      .eq("anio", filters.anio)
      .eq("mes", filters.mes)
      .order("fecha", { ascending: true });

    let resumenQuery = supabase
      .from("v_cashflow_anual_resumen")
      .select("*")
      .eq("anio", filters.anio)
      .order("proveedor_nombre", { ascending: true });

    if (filters.moneda !== "todas") {
      itemsQuery = itemsQuery.eq("moneda", filters.moneda);
      resumenQuery = resumenQuery.eq("moneda", filters.moneda);
    }

    if (filters.proveedorId !== "todos") {
      itemsQuery = itemsQuery.eq("proveedor_id", filters.proveedorId);
      resumenQuery = resumenQuery.eq("proveedor_id", filters.proveedorId);
    }

    if (filters.sucursalId !== "todas") {
      itemsQuery = itemsQuery.eq("sucursal_id", filters.sucursalId);
      resumenQuery = resumenQuery.eq("sucursal_id", filters.sucursalId);
    }

    if (filters.origen !== "todos") {
      itemsQuery = itemsQuery.eq("tipo_origen", filters.origen);
      resumenQuery = resumenQuery.eq("tipo_origen", filters.origen);
    }

    const [itemsRes, resumenRes, proveedoresRes, cajasRes, sucursalesRes] = await Promise.all([
      itemsQuery,
      resumenQuery,
      supabase.from("proveedores").select("*").eq("activo", true).order("nombre_comercial"),
      supabase.from("cajas").select("*").order("nombre"),
      supabase.from("sucursales").select("*").order("nombre")
    ]);

    const firstError =
      itemsRes.error ||
      resumenRes.error ||
      proveedoresRes.error ||
      cajasRes.error ||
      sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageCashflow,
        error: normalizeError(firstError)
      });

      return;
    }

    const items = ((itemsRes.data || []) as Partial<CashflowItem>[]).map(normalizeCashflowItem);

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageCashflow,
      items,
      resumen: (resumenRes.data || []) as CashflowResumenMensual[],
      catalogos: {
        proveedores: (proveedoresRes.data || []) as ProveedorLite[],
        cajas: (cajasRes.data || []) as CajaLite[],
        sucursales: (sucursalesRes.data || []) as SucursalLite[]
      },
      selectedItemId: get().selectedItemId || items[0]?.id || null
    });
  },

  /* =========================================================
     FACTURA DESDE CASHFLOW
  ========================================================= */

  saveFacturaFromCashflow: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageCashflow } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageCashflow) {
      set({ saving: false, error: "No tenés permisos para modificar Cashflow." });
      return false;
    }

    if (!cleanText(draft.descripcion)) {
      set({ saving: false, error: "Ingresá una descripción." });
      return false;
    }

    if (!draft.fecha_vencimiento) {
      set({ saving: false, error: "Seleccioná fecha de vencimiento." });
      return false;
    }

    const netoGravado = parseMoney(draft.neto_gravado);
    const ivaPorcentaje = parseMoney(draft.iva_porcentaje);
    const ivaImporte = parseMoney(draft.iva_importe);
    const noGravado = parseMoney(draft.no_gravado);
    const exento = parseMoney(draft.exento);
    const total = parseMoney(draft.total);

    if (total <= 0) {
      set({ saving: false, error: "El total debe ser mayor a cero." });
      return false;
    }

    const estado = buildFacturaEstadoFromDraft(draft);
    const periodo = draft.periodo || draft.fecha_vencimiento.slice(0, 7);

    const payload = {
      proveedor_id: draft.proveedor_id || null,
      proveedor_nombre: nullableText(draft.proveedor_nombre),
      descripcion: cleanText(draft.descripcion),
      numero_factura: nullableText(draft.numero_factura),
      fecha_emision: draft.fecha_emision || null,
      fecha_vencimiento: draft.fecha_vencimiento,
      moneda: draft.moneda || "ARS",
      sucursal_id: draft.sucursal_id || null,

      neto_gravado: netoGravado,
      iva_porcentaje: ivaPorcentaje,
      iva_importe: ivaImporte,
      no_gravado: noGravado,
      exento,
      total,

      estado,
      origen: draft.recurrente_id ? "RECURRENTE" : "MANUAL",
      recurrente_id: draft.recurrente_id || null,
      periodo,
      plan_pago: Boolean(draft.plan_pago),
      no_impacta_caja: Boolean(draft.no_impacta_caja),

      archivo_url: null,
      archivo_nombre: null,
      observaciones: nullableText(draft.observaciones),

      activo: true,
      updated_by: currentUserId
    };

    let facturaId = draft.factura_id;

    if (facturaId) {
      const { error } = await supabase
        .from("facturas_pagar")
        .update(payload)
        .eq("id", facturaId);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    } else {
      const { data, error } = await supabase
        .from("facturas_pagar")
        .insert({
          ...payload,
          saldo_pendiente: total,
          total_pagado: 0,
          created_by: currentUserId
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }

      facturaId = data.id;
    }

    if (!facturaId) {
      set({ saving: false, error: "No se pudo obtener la factura." });
      return false;
    }

    if (!draft.plan_pago) {
      const { data: existingCuotas, error: cuotasReadError } = await supabase
        .from("facturas_pagar_cuotas")
        .select("id")
        .eq("factura_id", facturaId)
        .limit(1);

      if (cuotasReadError) {
        set({ saving: false, error: normalizeError(cuotasReadError) });
        return false;
      }

      if (existingCuotas && existingCuotas.length > 0) {
        const { error: cuotaUpdateError } = await supabase
          .from("facturas_pagar_cuotas")
          .update({
            numero_cuota: 1,
            descripcion: cleanText(draft.descripcion),
            fecha_vencimiento: draft.fecha_vencimiento,
            moneda: draft.moneda || "ARS",
            importe: total,
            saldo_pendiente: total,
            estado,
            activo: true
          })
          .eq("id", existingCuotas[0].id);

        if (cuotaUpdateError) {
          set({ saving: false, error: normalizeError(cuotaUpdateError) });
          return false;
        }
      } else {
        const { error: cuotaInsertError } = await supabase
          .from("facturas_pagar_cuotas")
          .insert({
            factura_id: facturaId,
            numero_cuota: 1,
            descripcion: cleanText(draft.descripcion),
            fecha_vencimiento: draft.fecha_vencimiento,
            moneda: draft.moneda || "ARS",
            importe: total,
            saldo_pendiente: total,
            total_pagado: 0,
            estado,
            activo: true
          });

        if (cuotaInsertError) {
          set({ saving: false, error: normalizeError(cuotaInsertError) });
          return false;
        }
      }
    }

    const recalcularRes = await supabase.rpc("recalcular_factura_pagar", {
      p_factura_id: facturaId
    });

    if (recalcularRes.error) {
      set({ saving: false, error: normalizeError(recalcularRes.error) });
      return false;
    }

    await get().loadCashflow();

    set({ saving: false, selectedItemId: `factura-${facturaId}` });
    return true;
  },

  /* =========================================================
     PAGO DESDE CASHFLOW
  ========================================================= */

  registrarPagoFromCashflow: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageCashflow, catalogos } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageCashflow) {
      set({ saving: false, error: "No tenés permisos para registrar pagos." });
      return false;
    }

    if (!draft.factura_id) {
      set({
        saving: false,
        error: "Primero tenés que convertir o seleccionar una factura."
      });
      return false;
    }

    const importe = parseMoney(draft.importe);

    if (importe <= 0) {
      set({ saving: false, error: "El importe debe ser mayor a cero." });
      return false;
    }

    if (!draft.no_impacta_caja && !draft.caja_id) {
      set({ saving: false, error: "Seleccioná la caja desde donde se paga." });
      return false;
    }

    if (!draft.forma_pago) {
      set({ saving: false, error: "Indicá la forma de pago." });
      return false;
    }

    const caja = draft.caja_id
      ? catalogos.cajas.find((item) => item.id === draft.caja_id) || null
      : null;

    const cajaNombre = draft.caja_nombre || (caja ? getCajaDisplayName(caja) : "");

    let movimientoCajaId: string | null = null;

    if (!draft.no_impacta_caja && draft.caja_id) {
  const factura = get().items.find((item) => item.factura_id === draft.factura_id) || null;

 const proveedorNombre =
  factura?.proveedor_nombre ||
  "Proveedor sin identificar";

  const numeroFactura = factura?.numero_factura || "sin número";

  const descripcionMovimiento = `Pago factura proveedor · ${proveedorNombre}`;

  const referenciaTexto = [
    `Factura: ${numeroFactura}`,
    `Proveedor: ${proveedorNombre}`,
    draft.forma_pago ? `Forma de pago: ${draft.forma_pago}` : null,
    draft.observaciones ? `Obs.: ${draft.observaciones}` : null
  ]
    .filter(Boolean)
    .join(" · ");

  const { data: movimientoData, error: movimientoError } = await supabase
    .from("caja_movimientos")
    .insert({
      caja_id: draft.caja_id,
      fecha: draft.fecha_pago || getToday(),
      tipo: "EGRESO",
      categoria: "Factura a pagar",
      descripcion: descripcionMovimiento,
      moneda: draft.moneda || "ARS",
      importe,
      referencia_tipo: "FACTURA_PAGAR",
      referencia_id: draft.factura_id,
      referencia_texto: referenciaTexto,
      origen: "CASHFLOW",
      created_by: currentUserId,
      updated_by: currentUserId
    })
    .select("id")
    .single();

  if (movimientoError) {
    set({ saving: false, error: normalizeError(movimientoError) });
    return false;
  }

  movimientoCajaId = movimientoData.id;
}

    const { error } = await supabase
      .from("facturas_pagar_pagos")
      .insert({
        factura_id: draft.factura_id,
        cuota_id: draft.cuota_id || null,
        fecha_pago: draft.fecha_pago || getToday(),
        caja_id: draft.caja_id || null,
        caja_nombre: nullableText(cajaNombre),
        forma_pago_id: draft.forma_pago_id || null,
        forma_pago: nullableText(draft.forma_pago),
        moneda: draft.moneda || "ARS",
        importe,
        no_impacta_caja: Boolean(draft.no_impacta_caja),
        movimiento_caja_id: movimientoCajaId,
        observaciones: nullableText(draft.observaciones),
        created_by: currentUserId
      });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const recalcularRes = await supabase.rpc("recalcular_factura_pagar", {
      p_factura_id: draft.factura_id
    });

    if (recalcularRes.error) {
      set({ saving: false, error: normalizeError(recalcularRes.error) });
      return false;
    }

    await get().loadCashflow();

    set({ saving: false, selectedItemId: `factura-${draft.factura_id}` });
    return true;
  },

  /* =========================================================
     RECURRENTE DESDE CASHFLOW
  ========================================================= */

  updateRecurrenteFromCashflow: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageCashflow } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageCashflow) {
      set({ saving: false, error: "No tenés permisos para editar recurrentes." });
      return false;
    }

    if (!draft.id) {
      set({ saving: false, error: "No hay recurrente seleccionado." });
      return false;
    }

    if (!cleanText(draft.descripcion)) {
      set({ saving: false, error: "Ingresá una descripción." });
      return false;
    }

    const importeEstimado = parseMoney(draft.importe_estimado);

    if (importeEstimado <= 0) {
      set({ saving: false, error: "El importe estimado debe ser mayor a cero." });
      return false;
    }

    const diaVencimiento = Math.min(Math.max(Number(draft.dia_vencimiento) || 1, 1), 31);

    const { error } = await supabase
      .from("facturas_pagar_recurrentes")
      .update({
        proveedor_id: draft.proveedor_id || null,
        proveedor_nombre: nullableText(draft.proveedor_nombre),
        descripcion: cleanText(draft.descripcion),
        moneda: draft.moneda || "ARS",
        importe_estimado: importeEstimado,
        dia_vencimiento: diaVencimiento,
        categoria: nullableText(draft.categoria),
        no_impacta_caja: Boolean(draft.no_impacta_caja),
        generar_automatico: Boolean(draft.generar_automatico),
        fecha_inicio: draft.fecha_inicio || getToday(),
        fecha_fin: draft.fecha_fin || null,
        observaciones: nullableText(draft.observaciones),
        activo: Boolean(draft.activo),
        updated_by: currentUserId
      })
      .eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCashflow();

    set({ saving: false });
    return true;
  },

  /* =========================================================
     PROVEEDOR INLINE
  ========================================================= */

  createProveedorInline: async (nombre) => {
    const cleanNombre = cleanText(nombre);

    if (!cleanNombre) {
      set({ error: "Ingresá un proveedor válido." });
      return null;
    }

    const existing = get().catalogos.proveedores.find((proveedor) =>
      [proveedor.nombre, proveedor.nombre_comercial, proveedor.razon_social]
        .filter(Boolean)
        .some((item) => normalizeText(item) === normalizeText(cleanNombre))
    );

    if (existing) return existing;

    const payload = {
      nombre: cleanNombre,
      nombre_comercial: cleanNombre,
      razon_social: cleanNombre,
      activo: true
    };

    const { data, error } = await supabase
      .from("proveedores")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      set({ error: normalizeError(error) });
      return null;
    }

    const created = data as ProveedorLite;

    set((state) => ({
      catalogos: {
        ...state.catalogos,
        proveedores: [...state.catalogos.proveedores, created].sort((a, b) =>
          getProveedorDisplayName(a).localeCompare(getProveedorDisplayName(b))
        )
      }
    }));

    return created;
  },

  /* =========================================================
     FILTROS / SELECTORES
  ========================================================= */

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }));
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters() });
  },

  selectItem: (id) => {
    set({ selectedItemId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  /* =========================================================
     DERIVADOS
  ========================================================= */

  getFilteredItems: () => {
    const { items, filters } = get();
    const search = normalizeText(filters.search);

    return items.filter((item) => {
      const estadoVisual = getEstadoVisual(item);

      if (filters.estado === "vencidas" && estadoVisual !== "VENCIDA") return false;
      if (filters.estado === "por_vencer" && estadoVisual !== "POR_VENCER") return false;
      if (filters.estado === "pagadas" && item.estado !== "PAGADA") return false;
      if (filters.estado === "proyectadas" && item.estado !== "PROYECTADA" && !item.es_proyectado) return false;

      if (filters.estado === "pendientes") {
        if (!["PENDIENTE", "PROYECTADA", "VENCIDA", "POR_VENCER"].includes(estadoVisual)) {
          return false;
        }
      }

      if (!search) return true;

      const haystack = normalizeText(
        [
          item.proveedor_nombre,
          item.concepto,
          item.descripcion,
          item.numero_factura,
          item.estado,
          item.tipo_origen,
          item.periodo,
          item.sucursal_nombre
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getSelectedItem: () => {
    const { selectedItemId } = get();
    const items = get().getFilteredItems();

    return items.find((item) => item.id === selectedItemId) || items[0] || null;
  },

  getItemsByDay: () => {
    const items = get().getFilteredItems();

    return items.reduce<Record<string, CashflowItem[]>>((acc, item) => {
      const day = item.fecha.slice(0, 10);

      if (!acc[day]) acc[day] = [];
      acc[day].push(item);

      return acc;
    }, {});
  },

  getMetrics: () => {
    const items = get().getFilteredItems();

    const abiertas = items.filter((item) =>
      ["PENDIENTE", "PROYECTADA", "VENCIDA", "POR_VENCER"].includes(getEstadoVisual(item))
    );

    return {
      totalMesArs: items
        .filter((item) => item.moneda === "ARS")
        .reduce((total, item) => total + parseMoney(item.importe), 0),

      totalMesUsd: items
        .filter((item) => item.moneda === "USD")
        .reduce((total, item) => total + parseMoney(item.importe), 0),

      saldoMesArs: abiertas
        .filter((item) => item.moneda === "ARS")
        .reduce((total, item) => total + parseMoney(item.saldo_pendiente), 0),

      saldoMesUsd: abiertas
        .filter((item) => item.moneda === "USD")
        .reduce((total, item) => total + parseMoney(item.saldo_pendiente), 0),

      vencidas: abiertas.filter((item) => getEstadoVisual(item) === "VENCIDA").length,
      porVencer: abiertas.filter((item) => getEstadoVisual(item) === "POR_VENCER").length,
      proyectadas: abiertas.filter((item) => item.estado === "PROYECTADA" || item.es_proyectado).length,
      pagadas: items.filter((item) => item.estado === "PAGADA").length,
      totalItems: items.length
    };
  }
}));