import { create } from "zustand";
import { supabase } from "../lib/supabase";

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

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type CajaLite = {
  id: string;
  nombre: string;
  moneda?: string | null;
  tipo?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type FacturaPagar = {
  id: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  descripcion: string;
  numero_factura: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string;
  moneda: string;
  sucursal_id: string | null;
  sucursal_nombre?: string | null;

  neto_gravado: string | number;
  iva_porcentaje: string | number;
  iva_importe: string | number;
  no_gravado: string | number;
  exento: string | number;
  total: string | number;
  saldo_pendiente: string | number;
  total_pagado: string | number;

  estado: string;
  estado_visual?: string | null;
  origen: string;
  recurrente_id: string | null;
  periodo: string | null;
  plan_pago: boolean;
  no_impacta_caja: boolean;

  archivo_url: string | null;
  archivo_nombre: string | null;
  observaciones: string | null;

  activo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  cantidad_cuotas?: number;
  cantidad_pagos?: number;
};

export type FacturaPagarCuota = {
  id: string;
  factura_id: string;
  numero_cuota: number;
  descripcion: string | null;
  fecha_vencimiento: string;
  moneda: string;
  importe: string | number;
  saldo_pendiente: string | number;
  total_pagado: string | number;
  estado: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type FacturaPagarPago = {
  id: string;
  factura_id: string;
  cuota_id: string | null;
  fecha_pago: string;
  caja_id: string | null;
  caja_nombre: string | null;
  forma_pago_id: string | null;
  forma_pago: string | null;
  moneda: string;
  importe: string | number;
  no_impacta_caja: boolean;
  movimiento_caja_id: string | null;
  observaciones: string | null;
  anulado: boolean;
  motivo_anulacion: string | null;
  anulado_at: string | null;
  anulado_by: string | null;
  created_by: string | null;
  created_at: string;
};

export type GastoRecurrente = {
  id: string;
  proveedor_id: string | null;
  proveedor_nombre: string | null;
  descripcion: string;
  sucursal_id: string | null;
  moneda: string;
  importe_estimado: string | number;
  frecuencia: "MENSUAL" | "SEMANAL" | "ANUAL";
  dia_vencimiento: number;
  mes_vencimiento: number | null;
  categoria: string | null;
  no_impacta_caja: boolean;
  generar_automatico: boolean;
  fecha_inicio: string;
  fecha_fin: string | null;
  observaciones: string | null;
  activo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FacturaCuotaDraft = {
  id: string | null;
  numero_cuota: number;
  descripcion: string;
  fecha_vencimiento: string;
  importe: string;
};

export type FacturaPagarDraft = {
  id: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string;
  descripcion: string;
  numero_factura: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  moneda: string;
  sucursal_id: string | null;

  neto_gravado: string;
  iva_porcentaje: string;
  iva_importe: string;
  iva_manual: boolean;
  no_gravado: string;
  exento: string;
  total: string;

  origen: "MANUAL" | "RECURRENTE";
  recurrente_id: string | null;
  periodo: string | null;
  plan_pago: boolean;
  no_impacta_caja: boolean;
  confirmar_proyectada: boolean;

  archivo_url: string;
  archivo_nombre: string;
  observaciones: string;

  cuotas: FacturaCuotaDraft[];
};

export type FacturaPagarPagoDraft = {
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

export type GastoRecurrenteDraft = {
  id: string | null;
  proveedor_id: string | null;
  proveedor_nombre: string;
  descripcion: string;
  sucursal_id: string | null;
  moneda: string;
  importe_estimado: string;
  frecuencia: "MENSUAL" | "SEMANAL" | "ANUAL";
  dia_vencimiento: string;
  mes_vencimiento: string;
  categoria: string;
  no_impacta_caja: boolean;
  generar_automatico: boolean;
  fecha_inicio: string;
  fecha_fin: string;
  observaciones: string;
};

export type FacturasPagarFilters = {
  desde: string;
  hasta: string;
  estado: "pendientes" | "vencidas" | "por_vencer" | "proyectadas" | "pagadas" | "todas";
  moneda: "todas" | "ARS" | "USD";
  proveedorId: string;
  sucursalId: string;
  search: string;
};

type FacturasPagarMetrics = {
  pendienteArs: number;
  pendienteUsd: number;
  vencidas: number;
  porVencer: number;
  pagadasMes: number;
  recurrentes: number;
};

type FacturasPagarState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageFacturas: boolean;

  facturas: FacturaPagar[];
  cuotas: FacturaPagarCuota[];
  pagos: FacturaPagarPago[];
  recurrentes: GastoRecurrente[];

  catalogos: {
    proveedores: ProveedorLite[];
    sucursales: SucursalLite[];
    cajas: CajaLite[];
  };

  filters: FacturasPagarFilters;
  selectedFacturaId: string | null;

  loadFacturas: () => Promise<void>;
  saveFactura: (draft: FacturaPagarDraft) => Promise<boolean>;
  deleteFactura: (facturaId: string) => Promise<boolean>;
  registrarPago: (draft: FacturaPagarPagoDraft) => Promise<boolean>;
  anularPago: (pago: FacturaPagarPago, motivo: string) => Promise<boolean>;
  saveRecurrente: (draft: GastoRecurrenteDraft) => Promise<boolean>;
  createProveedorInline: (nombre: string) => Promise<ProveedorLite | null>;
  generarRecurrentesMes: () => Promise<number>;

  setFilter: <K extends keyof FacturasPagarFilters>(key: K, value: FacturasPagarFilters[K]) => void;
  resetFilters: () => void;
  selectFactura: (id: string | null) => void;
  clearError: () => void;

  getFilteredFacturas: () => FacturaPagar[];
  getSelectedFactura: () => FacturaPagar | null;
  getCuotasBySelected: () => FacturaPagarCuota[];
  getPagosBySelected: () => FacturaPagarPago[];
  getMetrics: () => FacturasPagarMetrics;
};

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

function getMonthStart(): string {
  const today = getToday();
  return `${today.slice(0, 8)}01`;
}

function getDefaultFilters(): FacturasPagarFilters {
  return {
    desde: getMonthStart(),
    hasta: getToday(),
    estado: "pendientes",
    moneda: "todas",
    proveedorId: "todos",
    sucursalId: "todas",
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

function getNumber(value: string | number | null | undefined): number {
  return parseMoney(value);
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



function addDays(dateString: string, days: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");
  const nextDay = String(date.getDate()).padStart(2, "0");

  return `${nextYear}-${nextMonth}-${nextDay}`;
}

export function getFacturaEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    PROYECTADA: "Proyectada",
    PENDIENTE: "Pendiente",
    PAGADA: "Pagada",
    CANCELADA: "Cancelada",
    VENCIDA: "Vencida",
    POR_VENCER: "Por vencer"
  };

  return labels[estado] || estado;
}

export function getFacturaEstadoTone(
  estado: string
): "success" | "warning" | "danger" | "info" | "neutral" {
  if (estado === "PAGADA") return "success";
  if (estado === "VENCIDA") return "danger";
  if (estado === "POR_VENCER") return "warning";
  if (estado === "PROYECTADA") return "info";
  if (estado === "CANCELADA") return "neutral";
  return "warning";
}

export function createInitialFacturaDraft(factura?: FacturaPagar | null): FacturaPagarDraft {
  if (factura) {
    return {
      id: factura.id,
      proveedor_id: factura.proveedor_id,
      proveedor_nombre: factura.proveedor_nombre || "",
      descripcion: factura.descripcion || "",
      numero_factura: factura.numero_factura || "",
      fecha_emision: factura.fecha_emision || getToday(),
      fecha_vencimiento: factura.fecha_vencimiento || getToday(),
      moneda: factura.moneda || "ARS",
      sucursal_id: factura.sucursal_id || "",

      neto_gravado: String(factura.neto_gravado || "0").replace(".", ","),
      iva_porcentaje: String(factura.iva_porcentaje || "21").replace(".", ","),
      iva_importe: String(factura.iva_importe || "0").replace(".", ","),
      iva_manual: true,
      no_gravado: String(factura.no_gravado || "0").replace(".", ","),
      exento: String(factura.exento || "0").replace(".", ","),
      total: String(factura.total || "0").replace(".", ","),

      origen: factura.origen === "RECURRENTE" ? "RECURRENTE" : "MANUAL",
      recurrente_id: factura.recurrente_id || null,
      periodo: factura.periodo || null,
      plan_pago: Boolean(factura.plan_pago),
      no_impacta_caja: Boolean(factura.no_impacta_caja),
      confirmar_proyectada: factura.estado === "PROYECTADA",

      archivo_url: factura.archivo_url || "",
      archivo_nombre: factura.archivo_nombre || "",
      observaciones: factura.observaciones || "",

      cuotas: []
    };
  }

  return {
    id: null,
    proveedor_id: null,
    proveedor_nombre: "",
    descripcion: "",
    numero_factura: "",
    fecha_emision: getToday(),
    fecha_vencimiento: getToday(),
    moneda: "ARS",
    sucursal_id: "",

    neto_gravado: "",
    iva_porcentaje: "21",
    iva_importe: "0",
    iva_manual: false,
    no_gravado: "0",
    exento: "0",
    total: "0",

    origen: "MANUAL",
    recurrente_id: null,
    periodo: null,
    plan_pago: false,
    no_impacta_caja: false,
    confirmar_proyectada: true,

    archivo_url: "",
    archivo_nombre: "",
    observaciones: "",

    cuotas: []
  };
}

export function createInitialPagoDraft(factura?: FacturaPagar | null): FacturaPagarPagoDraft {
  return {
    factura_id: factura?.id || "",
    cuota_id: null,
    fecha_pago: getToday(),
    caja_id: null,
    caja_nombre: "",
    forma_pago_id: null,
    forma_pago: "",
    moneda: factura?.moneda || "ARS",
    importe: factura ? String(factura.saldo_pendiente || "0").replace(".", ",") : "",
    no_impacta_caja: Boolean(factura?.no_impacta_caja),
    observaciones: ""
  };
}

export function createInitialRecurrenteDraft(
  recurrente?: GastoRecurrente | null
): GastoRecurrenteDraft {
  if (recurrente) {
    return {
      id: recurrente.id,
      proveedor_id: recurrente.proveedor_id,
      proveedor_nombre: recurrente.proveedor_nombre || "",
      descripcion: recurrente.descripcion || "",
      sucursal_id: recurrente.sucursal_id || "",
      moneda: recurrente.moneda || "ARS",
      importe_estimado: String(recurrente.importe_estimado || "0").replace(".", ","),
      frecuencia: recurrente.frecuencia || "MENSUAL",
      dia_vencimiento: String(recurrente.dia_vencimiento || "1"),
      mes_vencimiento: recurrente.mes_vencimiento ? String(recurrente.mes_vencimiento) : "",
      categoria: recurrente.categoria || "",
      no_impacta_caja: Boolean(recurrente.no_impacta_caja),
      generar_automatico: Boolean(recurrente.generar_automatico),
      fecha_inicio: recurrente.fecha_inicio || getToday(),
      fecha_fin: recurrente.fecha_fin || "",
      observaciones: recurrente.observaciones || ""
    };
  }

  return {
    id: null,
    proveedor_id: null,
    proveedor_nombre: "",
    descripcion: "",
    sucursal_id: "",
    moneda: "ARS",
    importe_estimado: "",
    frecuencia: "MENSUAL",
    dia_vencimiento: "10",
    mes_vencimiento: "",
    categoria: "",
    no_impacta_caja: false,
    generar_automatico: true,
    fecha_inicio: getToday(),
    fecha_fin: "",
    observaciones: ""
  };
}

export const useFacturasPagarStore = create<FacturasPagarState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageFacturas: false,

  facturas: [],
  cuotas: [],
  pagos: [],
  recurrentes: [],

  catalogos: {
    proveedores: [],
    sucursales: [],
    cajas: []
  },

  filters: getDefaultFilters(),
  selectedFacturaId: null,

  loadFacturas: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageFacturas: false,
        facturas: [],
        cuotas: [],
        pagos: [],
        recurrentes: [],
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
      set({
        loading: false,
        error: normalizeError(profileRes.error)
      });

      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManageFacturas = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageFacturas,
        facturas: [],
        cuotas: [],
        pagos: [],
        recurrentes: [],
        error: "Tu usuario no tiene acceso al módulo Facturas a Pagar."
      });

      return;
    }

    const filters = get().filters;

    let facturasQuery = supabase
      .from("v_facturas_pagar_resumen")
      .select("*")
      .gte("fecha_vencimiento", filters.desde)
      .lte("fecha_vencimiento", filters.hasta)
      .order("fecha_vencimiento", { ascending: true });

    if (filters.moneda !== "todas") {
      facturasQuery = facturasQuery.eq("moneda", filters.moneda);
    }

    if (filters.proveedorId !== "todos") {
      facturasQuery = facturasQuery.eq("proveedor_id", filters.proveedorId);
    }

    if (filters.sucursalId !== "todas") {
      facturasQuery = facturasQuery.eq("sucursal_id", filters.sucursalId);
    }

    if (filters.estado === "vencidas") {
      facturasQuery = facturasQuery.eq("estado_visual", "VENCIDA");
    }

    if (filters.estado === "por_vencer") {
      facturasQuery = facturasQuery.eq("estado_visual", "POR_VENCER");
    }

    if (filters.estado === "proyectadas") {
      facturasQuery = facturasQuery.eq("estado", "PROYECTADA");
    }

    if (filters.estado === "pagadas") {
      facturasQuery = facturasQuery.eq("estado", "PAGADA");
    }

    if (filters.estado === "pendientes") {
      facturasQuery = facturasQuery.in("estado", ["PENDIENTE", "PROYECTADA"]);
    }

    const [
      facturasRes,
      proveedoresRes,
      sucursalesRes,
      cajasRes,
      recurrentesRes
    ] = await Promise.all([
      facturasQuery,
      supabase.from("proveedores").select("*").eq("activo", true).order("nombre"),
      supabase.from("sucursales").select("*").order("nombre"),
      supabase.from("cajas").select("*").order("orden", { ascending: true }),
      supabase.from("facturas_pagar_recurrentes").select("*").order("created_at", { ascending: false })
    ]);

    const firstError =
      facturasRes.error ||
      proveedoresRes.error ||
      sucursalesRes.error ||
      cajasRes.error ||
      recurrentesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageFacturas,
        error: normalizeError(firstError)
      });

      return;
    }

    const facturas = (facturasRes.data || []) as FacturaPagar[];
    const facturaIds = facturas.map((factura) => factura.id);

    let cuotas: FacturaPagarCuota[] = [];
    let pagos: FacturaPagarPago[] = [];

    if (facturaIds.length > 0) {
      const [cuotasRes, pagosRes] = await Promise.all([
        supabase
          .from("facturas_pagar_cuotas")
          .select("*")
          .in("factura_id", facturaIds)
          .order("numero_cuota", { ascending: true }),
        supabase
          .from("facturas_pagar_pagos")
          .select("*")
          .in("factura_id", facturaIds)
          .order("fecha_pago", { ascending: false })
      ]);

      const childError = cuotasRes.error || pagosRes.error;

      if (childError) {
        set({
          loading: false,
          currentProfile,
          canManageFacturas,
          error: normalizeError(childError)
        });

        return;
      }

      cuotas = (cuotasRes.data || []) as FacturaPagarCuota[];
      pagos = (pagosRes.data || []) as FacturaPagarPago[];
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageFacturas,
      facturas,
      cuotas,
      pagos,
      recurrentes: (recurrentesRes.data || []) as GastoRecurrente[],
      catalogos: {
        proveedores: (proveedoresRes.data || []) as ProveedorLite[],
        sucursales: (sucursalesRes.data || []) as SucursalLite[],
        cajas: (cajasRes.data || []) as CajaLite[]
      },
      selectedFacturaId: get().selectedFacturaId || facturas[0]?.id || null
    });
  },

  saveFactura: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageFacturas } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageFacturas) {
      set({ saving: false, error: "No tenés permisos para guardar facturas." });
      return false;
    }

    const netoGravado = parseMoney(draft.neto_gravado);
    const ivaPorcentaje = parseMoney(draft.iva_porcentaje);
    const ivaImporte = parseMoney(draft.iva_importe);
    const noGravado = parseMoney(draft.no_gravado);
    const exento = parseMoney(draft.exento);
    const total = parseMoney(draft.total);

    if (!cleanText(draft.descripcion)) {
      set({ saving: false, error: "Ingresá una descripción." });
      return false;
    }

    if (!draft.fecha_vencimiento) {
      set({ saving: false, error: "Ingresá una fecha de vencimiento." });
      return false;
    }

    if (total <= 0) {
      set({ saving: false, error: "El total debe ser mayor a cero." });
      return false;
    }

    if (draft.plan_pago && draft.cuotas.length > 0) {
      const totalCuotas = draft.cuotas.reduce((acc, cuota) => acc + parseMoney(cuota.importe), 0);

      if (Math.abs(totalCuotas - total) > 0.009) {
        set({
          saving: false,
          error: "El total de cuotas debe coincidir con el total de la factura."
        });

        return false;
      }
    }

    const estado =
      draft.confirmar_proyectada || draft.origen === "MANUAL"
        ? "PENDIENTE"
        : "PROYECTADA";

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
      saldo_pendiente: total,
      total_pagado: 0,

      estado,
      origen: draft.origen || "MANUAL",
      recurrente_id: draft.recurrente_id || null,
      periodo: draft.periodo || null,
      plan_pago: Boolean(draft.plan_pago),
      no_impacta_caja: Boolean(draft.no_impacta_caja),

      archivo_url: nullableText(draft.archivo_url),
      archivo_nombre: nullableText(draft.archivo_nombre),
      observaciones: nullableText(draft.observaciones),

      activo: true,
      updated_by: currentUserId
    };

    let facturaId = draft.id;

    if (draft.id) {
      const { error } = await supabase
        .from("facturas_pagar")
        .update(payload)
        .eq("id", draft.id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    } else {
      const { data, error } = await supabase
        .from("facturas_pagar")
        .insert({
          ...payload,
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
      set({ saving: false, error: "No se pudo obtener el ID de la factura." });
      return false;
    }

    if (draft.plan_pago && draft.cuotas.length > 0) {
      const cuotasPayload = draft.cuotas.map((cuota, index) => ({
        factura_id: facturaId,
        numero_cuota: cuota.numero_cuota || index + 1,
        descripcion: nullableText(cuota.descripcion) || `Cuota ${index + 1}`,
        fecha_vencimiento: cuota.fecha_vencimiento || draft.fecha_vencimiento,
        moneda: draft.moneda || "ARS",
        importe: parseMoney(cuota.importe),
        saldo_pendiente: parseMoney(cuota.importe),
        total_pagado: 0,
        estado,
        activo: true
      }));

      if (draft.id) {
        const { error: deleteCuotasError } = await supabase
          .from("facturas_pagar_cuotas")
          .delete()
          .eq("factura_id", facturaId);

        if (deleteCuotasError) {
          set({ saving: false, error: normalizeError(deleteCuotasError) });
          return false;
        }
      }

      const { error: cuotasError } = await supabase
        .from("facturas_pagar_cuotas")
        .insert(cuotasPayload);

      if (cuotasError) {
        set({ saving: false, error: normalizeError(cuotasError) });
        return false;
      }
    } else if (draft.id) {
      const { error: deleteCuotasError } = await supabase
        .from("facturas_pagar_cuotas")
        .delete()
        .eq("factura_id", facturaId);

      if (deleteCuotasError) {
        set({ saving: false, error: normalizeError(deleteCuotasError) });
        return false;
      }

      const { error: cuotaUnicaError } = await supabase
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

      if (cuotaUnicaError) {
        set({ saving: false, error: normalizeError(cuotaUnicaError) });
        return false;
      }
    }

    await supabase.rpc("recalcular_factura_pagar", { p_factura_id: facturaId });
    await get().loadFacturas();

    set({ saving: false, selectedFacturaId: facturaId });
    return true;
  },

  deleteFactura: async (facturaId) => {
    set({ saving: true, error: null });

    const { canManageFacturas } = get();

    if (!canManageFacturas) {
      set({ saving: false, error: "No tenés permisos para cancelar facturas." });
      return false;
    }

    const currentUserId = await getCurrentUserId();

    const { error } = await supabase
      .from("facturas_pagar")
      .update({
        estado: "CANCELADA",
        activo: false,
        updated_by: currentUserId
      })
      .eq("id", facturaId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadFacturas();

    set({ saving: false });
    return true;
  },

  registrarPago: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageFacturas } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageFacturas) {
      set({ saving: false, error: "No tenés permisos para registrar pagos." });
      return false;
    }

    if (!draft.factura_id) {
      set({ saving: false, error: "No hay factura seleccionada." });
      return false;
    }

    const importe = parseMoney(draft.importe);

    if (importe <= 0) {
      set({ saving: false, error: "El importe del pago debe ser mayor a cero." });
      return false;
    }

    if (!draft.no_impacta_caja && !draft.caja_id) {
      set({ saving: false, error: "Seleccioná la caja desde donde se paga." });
      return false;
    }

    if (!draft.forma_pago) {
      set({ saving: false, error: "Seleccioná la forma de pago." });
      return false;
    }

    let movimientoCajaId: string | null = null;

    if (!draft.no_impacta_caja && draft.caja_id) {
      const { data: movimientoData, error: movimientoError } = await supabase
        .from("caja_movimientos")
        .insert({
          caja_id: draft.caja_id,
          fecha: draft.fecha_pago || getToday(),
          tipo: "EGRESO",
          categoria: "Factura a pagar",
          descripcion: `Pago factura a pagar`,
          moneda: draft.moneda || "ARS",
          importe,
          forma_pago: nullableText(draft.forma_pago),
          origen: "FACTURA_PAGAR",
          referencia_id: draft.factura_id,
          observaciones: nullableText(draft.observaciones),
          created_by: currentUserId,
          activo: true
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
        caja_nombre: nullableText(draft.caja_nombre),
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

    await supabase.rpc("recalcular_factura_pagar", { p_factura_id: draft.factura_id });
    await get().loadFacturas();

    set({ saving: false, selectedFacturaId: draft.factura_id });
    return true;
  },

  anularPago: async (pago, motivo) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageFacturas } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageFacturas) {
      set({ saving: false, error: "No tenés permisos para anular pagos." });
      return false;
    }

    if (!cleanText(motivo)) {
      set({ saving: false, error: "Indicá el motivo de anulación." });
      return false;
    }

    const { error } = await supabase
      .from("facturas_pagar_pagos")
      .update({
        anulado: true,
        motivo_anulacion: cleanText(motivo),
        anulado_at: new Date().toISOString(),
        anulado_by: currentUserId
      })
      .eq("id", pago.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (pago.movimiento_caja_id) {
      await supabase
        .from("caja_movimientos")
        .update({
          activo: false,
          anulado: true,
          motivo_anulacion: `Pago factura anulado: ${cleanText(motivo)}`
        })
        .eq("id", pago.movimiento_caja_id);
    }

    await supabase.rpc("recalcular_factura_pagar", { p_factura_id: pago.factura_id });
    await get().loadFacturas();

    set({ saving: false, selectedFacturaId: pago.factura_id });
    return true;
  },

  saveRecurrente: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageFacturas } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageFacturas) {
      set({ saving: false, error: "No tenés permisos para guardar gastos recurrentes." });
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
    const mesVencimiento = draft.mes_vencimiento ? Number(draft.mes_vencimiento) : null;

    const payload = {
      proveedor_id: draft.proveedor_id || null,
      proveedor_nombre: nullableText(draft.proveedor_nombre),
      descripcion: cleanText(draft.descripcion),
      sucursal_id: draft.sucursal_id || null,
      moneda: draft.moneda || "ARS",
      importe_estimado: importeEstimado,
      frecuencia: draft.frecuencia || "MENSUAL",
      dia_vencimiento: diaVencimiento,
      mes_vencimiento: mesVencimiento,
      categoria: nullableText(draft.categoria),
      no_impacta_caja: Boolean(draft.no_impacta_caja),
      generar_automatico: Boolean(draft.generar_automatico),
      fecha_inicio: draft.fecha_inicio || getToday(),
      fecha_fin: draft.fecha_fin || null,
      observaciones: nullableText(draft.observaciones),
      activo: true,
      updated_by: currentUserId
    };

    if (draft.id) {
      const { error } = await supabase
        .from("facturas_pagar_recurrentes")
        .update(payload)
        .eq("id", draft.id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    } else {
      const { error } = await supabase
        .from("facturas_pagar_recurrentes")
        .insert({
          ...payload,
          created_by: currentUserId
        });

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    }

    await get().loadFacturas();

    set({ saving: false });
    return true;
  },

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
          String(a.nombre || a.nombre_comercial || "").localeCompare(
            String(b.nombre || b.nombre_comercial || "")
          )
        )
      }
    }));

    return created;
  },

  generarRecurrentesMes: async () => {
    set({ saving: true, error: null });

    const { canManageFacturas } = get();

    if (!canManageFacturas) {
      set({ saving: false, error: "No tenés permisos para generar recurrentes." });
      return -1;
    }

    const { data, error } = await supabase.rpc("generar_facturas_recurrentes", {
      p_mes: getToday()
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return -1;
    }

    await get().loadFacturas();

    set({ saving: false });
    return Number(data || 0);
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
    set({ filters: getDefaultFilters() });
  },

  selectFactura: (id) => {
    set({ selectedFacturaId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredFacturas: () => {
    const { facturas, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return facturas;

    return facturas.filter((factura) => {
      const haystack = normalizeText(
        [
          factura.proveedor_nombre,
          factura.descripcion,
          factura.numero_factura,
          factura.periodo,
          factura.estado,
          factura.estado_visual,
          factura.origen,
          factura.sucursal_nombre
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getSelectedFactura: () => {
    const { selectedFacturaId } = get();
    const facturas = get().getFilteredFacturas();

    return (
      facturas.find((factura) => factura.id === selectedFacturaId) ||
      facturas[0] ||
      null
    );
  },

  getCuotasBySelected: () => {
    const selected = get().getSelectedFactura();
    if (!selected) return [];

    return get()
      .cuotas.filter((cuota) => cuota.factura_id === selected.id && cuota.activo)
      .sort((a, b) => a.numero_cuota - b.numero_cuota);
  },

  getPagosBySelected: () => {
    const selected = get().getSelectedFactura();
    if (!selected) return [];

    return get()
      .pagos.filter((pago) => pago.factura_id === selected.id)
      .sort((a, b) => String(b.fecha_pago).localeCompare(String(a.fecha_pago)));
  },

  getMetrics: () => {
    const facturas = get().getFilteredFacturas();
    const today = getToday();
    const nextSeven = addDays(today, 7);

    const abiertas = facturas.filter((factura) =>
      ["PENDIENTE", "PROYECTADA"].includes(factura.estado)
    );

    return {
      pendienteArs: abiertas
        .filter((factura) => factura.moneda === "ARS")
        .reduce((total, factura) => total + getNumber(factura.saldo_pendiente), 0),

      pendienteUsd: abiertas
        .filter((factura) => factura.moneda === "USD")
        .reduce((total, factura) => total + getNumber(factura.saldo_pendiente), 0),

      vencidas: abiertas.filter((factura) => factura.fecha_vencimiento < today).length,

      porVencer: abiertas.filter(
        (factura) => factura.fecha_vencimiento >= today && factura.fecha_vencimiento <= nextSeven
      ).length,

      pagadasMes: facturas.filter((factura) => factura.estado === "PAGADA").length,

      recurrentes: facturas.filter((factura) => factura.origen === "RECURRENTE").length
    };
  }
}));