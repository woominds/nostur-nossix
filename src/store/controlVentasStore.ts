import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type ProfileLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: string;
  color: string;
  activo: boolean;
};

export type Cliente = {
  id: string;
  nombre_completo: string;
  telefono: string;
  email: string | null;
  origen: string | null;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  activo: boolean;
};

export type CarritoControlItem = {
  id: string;
  cliente_id: string;
  contacto_id: string | null;
  numero_carrito: string;
  fecha_venta: string;
  servicio_id: string | null;
  servicio: string | null;
  metodo_contacto: string | null;
  forma_pago_id: string | null;
  forma_pago: string | null;
  destino: string | null;
  fecha_in: string | null;
  fecha_out: string | null;
  solo_ida: boolean;
  importe: string | number;
  moneda: string;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  estado: string;
  observaciones: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  importe_bruto: string | number;
  promocode_aplicado: boolean;
  promocode_importe: string | number;
  importe_final: string | number;
  pago_parcial: boolean;
  total_pagado: string | number;
  saldo_cta_cte: string | number;
  visible_en_carritos: boolean;
  fecha_visible_carritos: string | null;
  riesgo: boolean;
  riesgo_motivo: string | null;
  confirmado_vendedor: boolean;
  confirmado_at: string | null;
  enviado_control_at: string | null;

  derivado_control: boolean;
  controlado: boolean;
  facturado: boolean;
  cobrado: boolean;
  cancelado: boolean;
  fecha_factura: string | null;
  fecha_cobro: string | null;
  numero_factura: string | null;
  numero_factura_arca: string | null;
  utilidad_neta: string | number;
  regalias: string | number;
  utilidad_bruta: string | number;
  importe_facturar: string | number;
  

  clientes?: Cliente | null;
};

export type ControlVenta = {
  id: string;
  carrito_id: string;
  utilidad_almundo: string | number;
  porcentaje_regalia: string | number;
  importe_regalia: string | number;
  utilidad_nossix: string | number;
  importe_a_facturar: string | number;
  controlado: boolean;
  controlado_at: string | null;
  controlado_by: string | null;
  facturado: boolean;
  facturado_at: string | null;
  facturado_by: string | null;
  cobrado: boolean;
  cobrado_at: string | null;
  cobrado_by: string | null;
  anulado: boolean;
  anulado_at: string | null;
  anulado_by: string | null;
  motivo_anulacion: string | null;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ControlVentasFilters = {
  mes: string;
  desde: string;
  hasta: string;
  moneda: "todos" | "ARS" | "USD";
  estadoControl: "todos" | "pendiente" | "controlado";
  facturado: "todos" | "si" | "no";
  cobrado: "todos" | "si" | "no";
  anulado: "no" | "si" | "todos";
  vendedorId: string;
  sucursalId: string;
  search: string;
};

export type ControlDraft = {
  utilidad_almundo: string;
  importe_regalia: string;
  controlado: boolean;
  facturado: boolean;
  cobrado: boolean;
  observaciones: string;
};

type ControlResumen = {
  carrito: CarritoControlItem;
  control: ControlVenta | null;
  utilidadAlmundo: number;
  porcentajeRegalia: number;
  importeRegalia: number;
  utilidadNossix: number;
  importeAFacturar: number;
  controlado: boolean;
  facturado: boolean;
  cobrado: boolean;
  anulado: boolean;
};

type MoneyBucketMetrics = {
  carritos: number;
  pendientes: number;
  controlados: number;
  facturados: number;
  cobrados: number;
  utilidadAlmundo: number;
  regalias: number;
  utilidadNossix: number;
  aFacturar: number;
  totalFacturado: number;
  cobradoMes: number;
  aCobrarSemana: number;
};

type ControlVentasMetrics = MoneyBucketMetrics & {
  ars: MoneyBucketMetrics;
  usd: MoneyBucketMetrics;
};

type ControlVentasState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageControlVentas: boolean;

  carritos: CarritoControlItem[];
  controles: ControlVenta[];

  catalogos: {
    vendedores: ProfileLite[];
    sucursales: { id: string; nombre: string; activo?: boolean; activa?: boolean }[];
  };

  filters: ControlVentasFilters;
  selectedCarritoId: string | null;

  loadControlVentas: () => Promise<void>;
  saveControlVenta: (carrito: CarritoControlItem, draft: ControlDraft) => Promise<boolean>;
  anularControlVenta: (control: ControlVenta, motivo: string) => Promise<boolean>;

  setFilter: <K extends keyof ControlVentasFilters>(key: K, value: ControlVentasFilters[K]) => void;
  resetFilters: () => void;
  selectCarrito: (id: string | null) => void;
  clearError: () => void;

  getResumen: () => ControlResumen[];
  getSelectedResumen: () => ControlResumen | null;
  getMetrics: () => ControlVentasMetrics;
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

function getCurrentMonthValue(): string {
  return getToday().slice(0, 7);
}

function getMonthStart(): string {
  const today = getToday();
  return `${today.slice(0, 8)}01`;
}

function getMonthRange(monthValue: string): { desde: string; hasta: string } {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!year || !month) {
    return {
      desde: getMonthStart(),
      hasta: getToday()
    };
  }

  const desde = `${yearRaw}-${monthRaw}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const hasta = `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, "0")}`;

  return {
    desde,
    hasta
  };
}

function getDefaultFilters(): ControlVentasFilters {
  const mes = getCurrentMonthValue();
  const range = getMonthRange(mes);

  return {
    mes,
    desde: range.desde,
    hasta: range.hasta,
    moneda: "todos",
    estadoControl: "todos",
    facturado: "todos",
    cobrado: "todos",
    anulado: "no",
    vendedorId: "todos",
    sucursalId: "todos",
    search: ""
  };
}

function getNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value || "").trim();
  if (!raw) return 0;

  let normalized = raw
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/ARS/gi, "")
    .replace(/USD/gi, "");

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");

    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  normalized = normalized.replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

    return message;
  }

  return String(error);
}

/**
 * Regla de negocio Control de Ventas ALMUNDO:
 * utilidad_neta = utilidad cargada / importada
 * regalias = utilidad_neta * 36%
 * utilidad_bruta = utilidad_neta - regalias
 * importe_facturar = utilidad_bruta * 1.21
 *
 * Ojo:
 * Los nombres utilidadAlmundo/utilidadNossix vienen heredados del panel.
 */
function calculateControl(utilidadNeta: number, regalias: number) {
  const normalizedRegalias =
    regalias > 0 && regalias <= 1 && utilidadNeta > 1 ? utilidadNeta * regalias : regalias;

  const utilidadBruta = utilidadNeta - normalizedRegalias;
  const importeAFacturar = utilidadBruta * 1.21;
  const porcentajeRegalia = utilidadNeta > 0 ? (normalizedRegalias / utilidadNeta) * 100 : 36;

  return {
    porcentajeRegalia,
    importeRegalia: normalizedRegalias,
    utilidadNossix: utilidadBruta,
    importeAFacturar
  };
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileManage(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      (profile.rol === "admin_general" ||
        profile.rol === "gerencia" ||
        profile.rol === "administracion")
  );
}

function canProfileUse(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      (profile.rol === "admin_general" ||
        profile.rol === "gerencia" ||
        profile.rol === "administracion" ||
        profile.rol === "vendedor")
  );
}

function normalizeCarrito(raw: any): CarritoControlItem {
  return {
    id: raw.id,
    cliente_id: raw.cliente_id,
    contacto_id: raw.contacto_id || null,
    numero_carrito: raw.numero_carrito || "",
    fecha_venta: raw.fecha_venta || raw.created_at?.slice(0, 10) || getToday(),
    servicio_id: raw.servicio_id || null,
    servicio: raw.servicio || null,
    metodo_contacto: raw.metodo_contacto || null,
    forma_pago_id: raw.forma_pago_id || null,
    forma_pago: raw.forma_pago || null,
    destino: raw.destino || null,
    fecha_in: raw.fecha_in || null,
    fecha_out: raw.fecha_out || null,
    solo_ida: Boolean(raw.solo_ida ?? raw.ida_solo),
    importe: raw.importe || 0,
    moneda: raw.moneda || "ARS",
    vendedor: raw.vendedor || null,
    vendedor_id: raw.vendedor_id || null,
    sucursal_id: raw.sucursal_id || raw.clientes?.sucursal_id || null,
    estado: raw.estado || "NUEVO",
    observaciones: raw.observaciones || null,
    activo: raw.activo !== false,
    created_at: raw.created_at || new Date().toISOString(),
    updated_at: raw.updated_at || raw.created_at || new Date().toISOString(),
    importe_bruto: raw.importe_bruto ?? raw.importe ?? 0,
    promocode_aplicado: Boolean(raw.promocode_aplicado ?? raw.promocode),
    promocode_importe: raw.promocode_importe ?? raw.importe_promocode ?? 0,
    importe_final: raw.importe_final ?? raw.importe ?? 0,
    pago_parcial: Boolean(raw.pago_parcial),
    total_pagado: raw.total_pagado || 0,
    saldo_cta_cte: raw.saldo_cta_cte || 0,
    visible_en_carritos: raw.visible_en_carritos !== false,
    fecha_visible_carritos: raw.fecha_visible_carritos || null,
    riesgo: Boolean(raw.riesgo ?? raw.impacto_riesgo),
    riesgo_motivo: raw.riesgo_motivo || null,
    confirmado_vendedor: raw.confirmado_vendedor !== false,
    confirmado_at: raw.confirmado_at || null,
    enviado_control_at: raw.enviado_control_at || null,

    derivado_control: Boolean(raw.derivado_control),
    controlado: Boolean(raw.controlado),
    facturado: Boolean(raw.facturado),
    cobrado: Boolean(raw.cobrado),
    cancelado: Boolean(raw.cancelado),
    fecha_factura: raw.fecha_factura || null,
    fecha_cobro: raw.fecha_cobro || null,
    numero_factura: raw.numero_factura || null,
    numero_factura_arca: raw.numero_factura_arca || null,
    utilidad_neta: raw.utilidad_neta || 0,
    regalias: raw.regalias || 0,
    utilidad_bruta: raw.utilidad_bruta || 0,
    importe_facturar: raw.importe_facturar || 0,
    

    clientes: raw.clientes || null
  };
}

function buildVirtualControl(carrito: CarritoControlItem): ControlVenta | null {
  const utilidadNeta = getNumber(carrito.utilidad_neta);
  const regalias = getNumber(carrito.regalias);
  const utilidadBruta = getNumber(carrito.utilidad_bruta);
  const importeFacturar = getNumber(carrito.importe_facturar);

  const hasEconomicControl =
    utilidadNeta !== 0 || regalias !== 0 || utilidadBruta !== 0 || importeFacturar !== 0;

 const hasStatusControl =
  carrito.controlado ||
  carrito.estado === "CONTROLADO" ||
  carrito.facturado ||
  carrito.cobrado ||
  carrito.cancelado;

  if (!hasEconomicControl && !hasStatusControl) return null;

  const porcentajeRegalia = utilidadNeta > 0 ? (regalias / utilidadNeta) * 100 : 36;

  return {
    id: `carrito-control-${carrito.id}`,
    carrito_id: carrito.id,
    utilidad_almundo: utilidadNeta,
    porcentaje_regalia: porcentajeRegalia,
    importe_regalia: regalias,
    utilidad_nossix: utilidadBruta,
    importe_a_facturar: importeFacturar,
    controlado: carrito.controlado,
    controlado_at: carrito.enviado_control_at || carrito.updated_at || null,
    controlado_by: null,
    facturado: carrito.facturado,
    facturado_at: carrito.fecha_factura,
    facturado_by: null,
    cobrado: carrito.cobrado,
    cobrado_at: carrito.fecha_cobro,
    cobrado_by: null,
    anulado: carrito.cancelado,
    anulado_at: null,
    anulado_by: null,
    motivo_anulacion: null,
    observaciones: carrito.observaciones,
    created_by: null,
    created_at: carrito.created_at,
    updated_at: carrito.updated_at
  };
}

function isCarritoAlreadyControlled(
  carrito: CarritoControlItem,
  control?: ControlVenta | null
): boolean {
  return Boolean(control?.controlado || carrito.controlado || carrito.estado === "CONTROLADO");
}

function buildResumen(carritos: CarritoControlItem[], controles: ControlVenta[]): ControlResumen[] {
  return carritos.map((carrito) => {
    const control = controles.find((item) => item.carrito_id === carrito.id) || null;

    const utilidadNeta = control
      ? getNumber(control.utilidad_almundo)
      : getNumber(carrito.utilidad_neta);

    const importeRegalia = control
      ? getNumber(control.importe_regalia)
      : getNumber(carrito.regalias) || utilidadNeta * 0.36;

    const calculated = calculateControl(utilidadNeta, importeRegalia);

    const utilidadBruta = control
      ? getNumber(control.utilidad_nossix)
      : getNumber(carrito.utilidad_bruta) || calculated.utilidadNossix;

    const importeAFacturar = control
      ? getNumber(control.importe_a_facturar)
      : getNumber(carrito.importe_facturar) || calculated.importeAFacturar;

  return {
  carrito,
  control,
  utilidadAlmundo: utilidadNeta,
  porcentajeRegalia: calculated.porcentajeRegalia,
  importeRegalia: getNumber(carrito.regalias) || calculated.importeRegalia,
  utilidadNossix: utilidadBruta,
  importeAFacturar,
  controlado: Boolean(carrito.controlado || control?.controlado || carrito.estado === "CONTROLADO"),
  facturado: Boolean(carrito.facturado || control?.facturado),
  cobrado: Boolean(carrito.cobrado || control?.cobrado),
  anulado: Boolean(carrito.cancelado || control?.anulado)
};
  });
}

export const useControlVentasStore = create<ControlVentasState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageControlVentas: false,

  carritos: [],
  controles: [],

  catalogos: {
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedCarritoId: null,

  loadControlVentas: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageControlVentas: false,
        carritos: [],
        controles: [],
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
    const canManageControlVentas = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageControlVentas,
        carritos: [],
        controles: [],
        error: "Tu usuario no tiene acceso al módulo Control de Ventas."
      });

      return;
    }

    const filters = get().filters;

  let carritosQuery = supabase
  .from("carritos")
  .select("*, clientes:cliente_id(*)")
  .or("derivado_control.eq.true,controlado.eq.true,facturado.eq.true,cobrado.eq.true")
  .gte("fecha_venta", filters.desde)
  .lte("fecha_venta", filters.hasta)
  .order("fecha_venta", { ascending: false })
  .order("created_at", { ascending: false });

    if (!canManageControlVentas) {
      carritosQuery = carritosQuery.eq("vendedor_id", currentUserId);
    }

    if (filters.moneda !== "todos") {
      carritosQuery = carritosQuery.eq("moneda", filters.moneda);
    }

    if (filters.vendedorId !== "todos" && canManageControlVentas) {
      carritosQuery = carritosQuery.eq("vendedor_id", filters.vendedorId);
    }

    if (filters.sucursalId !== "todos") {
      carritosQuery = carritosQuery.eq("sucursal_id", filters.sucursalId);
    }

    const [carritosRes, vendedoresRes, sucursalesRes] = await Promise.all([
      carritosQuery,
      supabase
        .from("profiles")
        .select("*")
        .in("rol", ["vendedor", "gerencia", "admin_general", "administracion"])
        .eq("activo", true)
        .order("nombre"),
      supabase.from("sucursales").select("*").order("nombre")
    ]);

    const firstError = carritosRes.error || vendedoresRes.error || sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageControlVentas,
        error: normalizeError(firstError)
      });

      return;
    }

    const carritos = ((carritosRes.data || []) as any[]).map(normalizeCarrito);
    const controles = carritos
      .map(buildVirtualControl)
      .filter(Boolean) as ControlVenta[];

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageControlVentas,
      carritos,
      controles,
      catalogos: {
        vendedores: (vendedoresRes.data || []) as ProfileLite[],
        sucursales: (sucursalesRes.data || []) as {
          id: string;
          nombre: string;
          activo?: boolean;
          activa?: boolean;
        }[]
      }
    });
  },

  saveControlVenta: async (carrito, draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const existing = get().controles.find((control) => control.carrito_id === carrito.id);

    if (isCarritoAlreadyControlled(carrito, existing)) {
      set({
        saving: false,
     error:
  "Este carrito ya está controlado. No se puede volver a controlar desde esta acción."
      });

      return false;
    }

    const utilidadNeta = parseMoney(draft.utilidad_almundo);

    if (utilidadNeta <= 0) {
      set({
        saving: false,
        error: "Ingresá una utilidad neta válida antes de guardar el control."
      });

      return false;
    }

    const importeRegalia = parseMoney(draft.importe_regalia || String(utilidadNeta * 0.36));
    const calculated = calculateControl(utilidadNeta, importeRegalia);

    const { error } = await supabase
      .from("carritos")
      .update({
        utilidad_neta: utilidadNeta,
        regalias: Number(calculated.importeRegalia.toFixed(2)),
        utilidad_bruta: Number(calculated.utilidadNossix.toFixed(2)),
        importe_facturar: Number(calculated.importeAFacturar.toFixed(2)),
        controlado: true,
        estado: "CONTROLADO",
        observaciones: draft.observaciones || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", carrito.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadControlVentas();

    set({ saving: false });
    return true;
  },

  anularControlVenta: async (control, motivo) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (control.controlado || control.facturado || control.cobrado) {
      set({
        saving: false,
        error: "No se puede anular un control ya controlado/facturado/cobrado desde esta acción."
      });

      return false;
    }

    const { error } = await supabase
      .from("carritos")
      .update({
        controlado: false,
        observaciones: motivo || "Control anulado desde Control de Ventas",
        updated_at: new Date().toISOString()
      })
      .eq("id", control.carrito_id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadControlVentas();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => {
      if (key === "mes") {
        const range = getMonthRange(String(value));

        return {
          filters: {
            ...state.filters,
            mes: String(value),
            desde: range.desde,
            hasta: range.hasta
          }
        };
      }

      return {
        filters: {
          ...state.filters,
          [key]: value
        }
      };
    });
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters() });
  },

  selectCarrito: (id) => {
    set({ selectedCarritoId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getResumen: () => {
    const { carritos, controles, filters } = get();
    const search = normalizeText(filters.search);

    let resumen = buildResumen(carritos, controles);

    if (filters.moneda !== "todos") {
      resumen = resumen.filter((item) => item.carrito.moneda === filters.moneda);
    }

    if (filters.estadoControl === "pendiente") {
      resumen = resumen.filter((item) => !item.controlado);
    }

    if (filters.estadoControl === "controlado") {
      resumen = resumen.filter((item) => item.controlado);
    }

    if (filters.facturado === "si") {
      resumen = resumen.filter((item) => item.facturado);
    }

    if (filters.facturado === "no") {
      resumen = resumen.filter((item) => !item.facturado);
    }

    if (filters.cobrado === "si") {
      resumen = resumen.filter((item) => item.cobrado);
    }

    if (filters.cobrado === "no") {
      resumen = resumen.filter((item) => !item.cobrado);
    }

    if (filters.anulado === "si") {
      resumen = resumen.filter((item) => item.anulado);
    }

    if (filters.anulado === "no") {
      resumen = resumen.filter((item) => !item.anulado);
    }

    if (search) {
      resumen = resumen.filter((item) => {
        const carrito = item.carrito;
        const cliente = carrito.clientes;

        const haystack = normalizeText(
          [
            carrito.numero_carrito,
            carrito.destino,
            carrito.servicio,
            carrito.estado,
            carrito.vendedor,
            cliente?.nombre_completo,
            cliente?.telefono,
            cliente?.email
          ].join(" ")
        );

        return haystack.includes(search);
      });
    }

    return resumen;
  },

  getSelectedResumen: () => {
    const { selectedCarritoId } = get();
    const resumen = get().getResumen();

    if (!selectedCarritoId) return resumen[0] || null;

    return resumen.find((item) => item.carrito.id === selectedCarritoId) || resumen[0] || null;
  },

  getMetrics: () => {
    const resumen = get().getResumen();

    const emptyBucket = (): MoneyBucketMetrics => ({
      carritos: 0,
      pendientes: 0,
      controlados: 0,
      facturados: 0,
      cobrados: 0,
      utilidadAlmundo: 0,
      regalias: 0,
      utilidadNossix: 0,
      aFacturar: 0,
      totalFacturado: 0,
      cobradoMes: 0,
      aCobrarSemana: 0
    });

    const buildBucket = (items: ControlResumen[]): MoneyBucketMetrics => ({
      carritos: items.length,
      pendientes: items.filter((item) => !item.controlado).length,
      controlados: items.filter((item) => item.controlado).length,
      facturados: items.filter((item) => item.facturado).length,
      cobrados: items.filter((item) => item.cobrado).length,
      utilidadAlmundo: items.reduce((total, item) => total + item.utilidadAlmundo, 0),
      regalias: items.reduce((total, item) => total + item.importeRegalia, 0),
      utilidadNossix: items.reduce((total, item) => total + item.utilidadNossix, 0),
      aFacturar: items.reduce((total, item) => total + item.importeAFacturar, 0),
      totalFacturado: items
        .filter((item) => item.facturado && !item.anulado)
        .reduce((total, item) => total + item.importeAFacturar, 0),
      cobradoMes: items
        .filter((item) => item.cobrado && !item.anulado)
        .reduce((total, item) => total + item.importeAFacturar, 0),
      aCobrarSemana: items
        .filter((item) => item.facturado && !item.cobrado && !item.anulado)
        .reduce((total, item) => total + item.importeAFacturar, 0)
    });

    const ars = buildBucket(resumen.filter((item) => item.carrito.moneda === "ARS"));
    const usd = buildBucket(resumen.filter((item) => item.carrito.moneda === "USD"));
    const total = buildBucket(resumen);

    return {
      ...total,
      ars: ars || emptyBucket(),
      usd: usd || emptyBucket()
    };
  }
}));