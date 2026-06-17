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

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type ComisionMensual = {
  vendedor_id: string;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;
  mes: number;
  anio: number;

  meta_id: string | null;
  meta_piso_usd: string | number;
  meta_medio_usd: string | number;
  meta_logrado_usd: string | number;

  facturacion_carritos_usd: string | number;
  facturacion_files_usd: string | number;
  facturacion_total_usd: string | number;

  utilidad_carritos_usd: string | number;
  utilidad_files_usd: string | number;
  utilidad_total_usd: string | number;

  nivel_alcanzado: "SIN_META" | "PISO" | "MEDIO" | "LOGRADO" | string;
  porcentaje_comision: string | number;
  comision_estimada_usd: string | number;
  porcentaje_avance_piso: string | number;
  falta_para_piso_usd: string | number;
};

export type MatrizVendedorAnual = {
  vendedor_id: string;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;
  anio: number;
  meses: Record<
    number,
    {
      utilidad_usd: number;
      facturacion_usd: number;
    }
  >;
  total_utilidad_usd: number;
  total_facturacion_usd: number;
};

export type ComisionSemanal = {
  vendedor_id: string;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;
  meta_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  meta_unica_usd: string | number;
  utilidad_semana_usd: string | number;
  estado_meta: "LOGRADO" | "PENDIENTE" | string;
  porcentaje_avance: string | number;
};

export type VentaComision = {
  origen_id: string;
  origen: "CARRITO" | "FILE" | string;
  numero: string;
  fecha: string;
  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal_nombre?: string | null;
  cliente_id: string | null;
  pasajero: string | null;
  moneda: string;
  precio_venta_original: string | number;
  utilidad_original: string | number;
  tc_promedio_usd_ars: string | number;
  facturacion_usd: string | number;
  utilidad_usd: string | number;
};

export type ComisionesFilters = {
  mes: string;
  anio: string;
  vendedorId: string;
  sucursalId: string;
  search: string;
};

type ComisionesMetrics = {
  vendedores: number;
  utilidadTotalUsd: number;
  facturacionTotalUsd: number;
  comisionTotalUsd: number;
  logrados: number;
  piso: number;
  medio: number;
  sinMeta: number;
};

type ComisionesState = {
  loading: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageComisiones: boolean;

  mensual: ComisionMensual[];
  semanal: ComisionSemanal[];
  ventas: VentaComision[];
  matrizAnual: MatrizVendedorAnual[];

  catalogos: {
    vendedores: ProfileLite[];
    sucursales: SucursalLite[];
  };

  filters: ComisionesFilters;
  selectedVendedorId: string | null;

  loadComisiones: () => Promise<void>;

  setFilter: <K extends keyof ComisionesFilters>(key: K, value: ComisionesFilters[K]) => void;
  resetFilters: () => void;
  selectVendedor: (id: string | null) => void;
  clearError: () => void;

  getMensualFiltrado: () => ComisionMensual[];
  getSemanalFiltrado: () => ComisionSemanal[];
  getVentasFiltradas: () => VentaComision[];
  getSelectedMensual: () => ComisionMensual | null;
  getMetrics: () => ComisionesMetrics;
  getMatrizAnual: () => MatrizVendedorAnual[];
};

function getToday(): string {
  const now = new Date();
  const argentinaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }));
  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultFilters(): ComisionesFilters {
  const today = getToday();

  return {
    mes: today.slice(5, 7),
    anio: today.slice(0, 4),
    vendedorId: "todos",
    sucursalId: "todos",
    search: ""
  };
}

function getNumber(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
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

function getDateStartForQuery(anio: string, mes: string): string {
  return `${anio}-${mes.padStart(2, "0")}-01`;
}

function getDateEndForQuery(anio: string, mes: string): string {
  const year = Number(anio);
  const month = Number(mes);
  const last = new Date(year, month, 0).getDate();

  return `${anio}-${mes.padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function buildMatrizAnual(rows: ComisionMensual[]): MatrizVendedorAnual[] {
  const matrizMap = new Map<string, MatrizVendedorAnual>();

  rows.forEach((item) => {
    const vendedorId = item.vendedor_id || "sin-vendedor";

    if (!matrizMap.has(vendedorId)) {
      matrizMap.set(vendedorId, {
        vendedor_id: vendedorId,
        vendedor: item.vendedor || "Sin vendedor",
        sucursal_id: item.sucursal_id,
        sucursal: item.sucursal,
        anio: item.anio,
        meses: {},
        total_utilidad_usd: 0,
        total_facturacion_usd: 0
      });
    }

    const current = matrizMap.get(vendedorId);

    if (!current) return;

    const utilidad = getNumber(item.utilidad_total_usd);
    const facturacion = getNumber(item.facturacion_total_usd);

    current.meses[item.mes] = {
      utilidad_usd: utilidad,
      facturacion_usd: facturacion
    };

    current.total_utilidad_usd += utilidad;
    current.total_facturacion_usd += facturacion;
  });

  return Array.from(matrizMap.values()).sort(
    (a, b) => b.total_utilidad_usd - a.total_utilidad_usd
  );
}

export const useComisionesStore = create<ComisionesState>((set, get) => ({
  loading: false,
  error: null,

  currentProfile: null,
  canManageComisiones: false,

  mensual: [],
  semanal: [],
  ventas: [],
  matrizAnual: [],

  catalogos: {
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedVendedorId: null,

  loadComisiones: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageComisiones: false,
        mensual: [],
        semanal: [],
        ventas: [],
        matrizAnual: [],
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
    const canManageComisiones = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageComisiones,
        mensual: [],
        semanal: [],
        ventas: [],
        matrizAnual: [],
        error: "Tu usuario no tiene acceso al módulo Comisiones."
      });
      return;
    }

    const filters = get().filters;
    const mesNumber = Number(filters.mes);
    const anioNumber = Number(filters.anio);
    const desde = getDateStartForQuery(filters.anio, filters.mes);
    const hasta = getDateEndForQuery(filters.anio, filters.mes);

    let mensualQuery = supabase
      .from("vw_comisiones_vendedores_mensual")
      .select("*")
      .eq("mes", mesNumber)
      .eq("anio", anioNumber)
      .order("utilidad_total_usd", { ascending: false });

    let matrizAnualQuery = supabase
      .from("vw_comisiones_vendedores_mensual")
      .select("*")
      .eq("anio", anioNumber)
      .order("mes", { ascending: true })
      .order("utilidad_total_usd", { ascending: false });

    let semanalQuery = supabase
      .from("vw_comisiones_vendedores_semanal")
      .select("*")
      .gte("fecha_desde", desde)
      .lte("fecha_hasta", hasta)
      .order("utilidad_semana_usd", { ascending: false });

    let ventasQuery = supabase
      .from("vw_comisiones_ventas_base")
      .select("*")
      .gte("fecha", desde)
      .lte("fecha", hasta)
      .order("fecha", { ascending: false });

    if (!canManageComisiones) {
      mensualQuery = mensualQuery.eq("vendedor_id", currentUserId);
      matrizAnualQuery = matrizAnualQuery.eq("vendedor_id", currentUserId);
      semanalQuery = semanalQuery.eq("vendedor_id", currentUserId);
      ventasQuery = ventasQuery.eq("vendedor_id", currentUserId);
    } else {
      if (filters.vendedorId !== "todos") {
        mensualQuery = mensualQuery.eq("vendedor_id", filters.vendedorId);
        matrizAnualQuery = matrizAnualQuery.eq("vendedor_id", filters.vendedorId);
        semanalQuery = semanalQuery.eq("vendedor_id", filters.vendedorId);
        ventasQuery = ventasQuery.eq("vendedor_id", filters.vendedorId);
      }

      if (filters.sucursalId !== "todos") {
        mensualQuery = mensualQuery.eq("sucursal_id", filters.sucursalId);
        matrizAnualQuery = matrizAnualQuery.eq("sucursal_id", filters.sucursalId);
        semanalQuery = semanalQuery.eq("sucursal_id", filters.sucursalId);
        ventasQuery = ventasQuery.eq("sucursal_id", filters.sucursalId);
      }
    }

    const [
      mensualRes,
      semanalRes,
      ventasRes,
      matrizAnualRes,
      vendedoresRes,
      sucursalesRes
    ] = await Promise.all([
      mensualQuery,
      semanalQuery,
      ventasQuery,
      matrizAnualQuery,
      supabase
        .from("profiles")
        .select("*")
        .in("rol", ["vendedor", "gerencia", "admin_general", "administracion"])
        .eq("activo", true)
        .order("nombre"),
      supabase.from("sucursales").select("*").order("nombre")
    ]);

    const firstError =
      mensualRes.error ||
      semanalRes.error ||
      ventasRes.error ||
      matrizAnualRes.error ||
      vendedoresRes.error ||
      sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageComisiones,
        error: normalizeError(firstError)
      });
      return;
    }

    const mensual = (mensualRes.data || []) as ComisionMensual[];
    const semanal = (semanalRes.data || []) as ComisionSemanal[];
    const ventas = (ventasRes.data || []) as VentaComision[];
    const matrizRows = (matrizAnualRes.data || []) as ComisionMensual[];
    const matrizAnual = buildMatrizAnual(matrizRows);

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageComisiones,
      mensual,
      semanal,
      ventas,
      matrizAnual,
      catalogos: {
        vendedores: (vendedoresRes.data || []) as ProfileLite[],
        sucursales: (sucursalesRes.data || []) as SucursalLite[]
      }
    });
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      },
      selectedVendedorId:
        key === "vendedorId" && value !== "todos" ? String(value) : state.selectedVendedorId
    }));
  },

  resetFilters: () => {
    set({
      filters: getDefaultFilters(),
      selectedVendedorId: null
    });
  },

  selectVendedor: (id) => {
    set({ selectedVendedorId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getMensualFiltrado: () => {
    const { mensual, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return mensual;

    return mensual.filter((item) => {
      const haystack = normalizeText([
        item.vendedor,
        item.sucursal,
        item.nivel_alcanzado
      ].join(" "));

      return haystack.includes(search);
    });
  },

  getSemanalFiltrado: () => {
    const { semanal, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return semanal;

    return semanal.filter((item) => {
      const haystack = normalizeText([
        item.vendedor,
        item.sucursal,
        item.estado_meta
      ].join(" "));

      return haystack.includes(search);
    });
  },

  getVentasFiltradas: () => {
    const { ventas, filters, selectedVendedorId } = get();
    const search = normalizeText(filters.search);

    let items = ventas;

    if (selectedVendedorId) {
      items = items.filter((item) => item.vendedor_id === selectedVendedorId);
    }

    if (search) {
      items = items.filter((item) => {
        const haystack = normalizeText([
          item.origen,
          item.numero,
          item.vendedor,
          item.pasajero,
          item.moneda
        ].join(" "));

        return haystack.includes(search);
      });
    }

    return items;
  },

  getSelectedMensual: () => {
    const mensual = get().getMensualFiltrado();
    const selectedVendedorId = get().selectedVendedorId;

    if (!selectedVendedorId) return mensual[0] || null;

    return mensual.find((item) => item.vendedor_id === selectedVendedorId) || mensual[0] || null;
  },

  getMetrics: () => {
    const mensual = get().getMensualFiltrado();

    return {
      vendedores: mensual.length,
      utilidadTotalUsd: mensual.reduce((total, item) => total + getNumber(item.utilidad_total_usd), 0),
      facturacionTotalUsd: mensual.reduce((total, item) => total + getNumber(item.facturacion_total_usd), 0),
      comisionTotalUsd: mensual.reduce((total, item) => total + getNumber(item.comision_estimada_usd), 0),
      logrados: mensual.filter((item) => item.nivel_alcanzado === "LOGRADO").length,
      piso: mensual.filter((item) => item.nivel_alcanzado === "PISO").length,
      medio: mensual.filter((item) => item.nivel_alcanzado === "MEDIO").length,
      sinMeta: mensual.filter((item) => item.nivel_alcanzado === "SIN_META").length
    };
  },

  getMatrizAnual: () => {
    const { matrizAnual, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return matrizAnual;

    return matrizAnual.filter((item) => {
      const haystack = normalizeText([
        item.vendedor,
        item.sucursal
      ].join(" "));

      return haystack.includes(search);
    });
  }
}));