import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type MetaTipo =
  | "VENDEDOR_SEMANAL"
  | "VENDEDOR_MENSUAL"
  | "SUCURSAL_MENSUAL"
  | "ALMUNDO_MENSUAL";

export type EstadoPeriodo = "ACTIVA" | "INACTIVA" | "VENCIDA" | "FUTURA";

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

export type Meta = {
  id: string;
  tipo: MetaTipo;
  fecha_desde: string;
  fecha_hasta: string;
  mes: number | null;
  anio: number | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  moneda: string;
  meta_unica_usd: string | number;
  meta_piso_usd: string | number;
  meta_medio_usd: string | number;
  meta_logrado_usd: string | number;
  comision_piso_pct: string | number;
  comision_medio_pct: string | number;
  comision_logrado_pct: string | number;
  es_meta_almundo: boolean;
  activa: boolean;
  observaciones: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type MetaResumen = {
  meta: Meta;
  sucursal: SucursalLite | null;
  vendedor: ProfileLite | null;
  estadoPeriodo: EstadoPeriodo;
};

export type MetasFilters = {
  mes: string;
  anio: string;
  tipo: "todos" | MetaTipo;
  sucursalId: string;
  vendedorId: string;
  estado: "todos" | EstadoPeriodo;
  search: string;
};

export type MetaDraft = {
  fecha_desde: string;
  fecha_hasta: string;
  mes: string;
  anio: string;
  meta_unica_usd: string;
  meta_piso_usd: string;
  meta_medio_usd: string;
  meta_logrado_usd: string;
  comision_piso_pct: string;
  comision_medio_pct: string;
  comision_logrado_pct: string;
  activa: boolean;
  observaciones: string;
};

export type CreateMetaDraft = {
  tipo: MetaTipo;
  alcance: "TODOS" | "ESPECIFICO";
  sucursal_id: string;
  vendedor_id: string;
  fecha_desde: string;
  fecha_hasta: string;
  mes: string;
  anio: string;
  meta_unica_usd: string;
  meta_piso_usd: string;
  meta_medio_usd: string;
  meta_logrado_usd: string;
  comision_piso_pct: string;
  comision_medio_pct: string;
  comision_logrado_pct: string;
  observaciones: string;
};

type MetasMetrics = {
  total: number;
  activas: number;
  inactivas: number;
  vendedor: number;
  sucursal: number;
  almundo: number;
};

type MetasState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  currentProfile: ProfileLite | null;
  canManageMetas: boolean;
  metas: Meta[];
  catalogos: {
    sucursales: SucursalLite[];
    vendedores: ProfileLite[];
  };
  filters: MetasFilters;
  selectedMetaId: string | null;

  loadMetas: () => Promise<void>;
  saveMeta: (meta: Meta, draft: MetaDraft) => Promise<boolean>;
  createMeta: (draft: CreateMetaDraft) => Promise<boolean>;

  setFilter: <K extends keyof MetasFilters>(key: K, value: MetasFilters[K]) => void;
  setMonth: (mes: string | number, anio: string | number) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  resetFilters: () => void;
  selectMeta: (id: string | null) => void;
  clearError: () => void;

  getResumen: () => MetaResumen[];
  getSelectedResumen: () => MetaResumen | null;
  getMetrics: () => MetasMetrics;
};

function getArgentinaDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }));
}

function getToday(): string {
  const argentinaNow = getArgentinaDate();
  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getDefaultFilters(): MetasFilters {
  const today = getToday();

  return {
    mes: today.slice(5, 7),
    anio: today.slice(0, 4),
    tipo: "todos",
    sucursalId: "todos",
    vendedorId: "todos",
    estado: "todos",
    search: ""
  };
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
    if (message.toLowerCase().includes("row-level security")) return "No tenés permisos para esta acción.";
    if (message.toLowerCase().includes("permission denied")) return "Permiso denegado por Supabase/RLS.";
    if (message.toLowerCase().includes("duplicate key")) return "Ya existe una meta similar para ese período.";
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

function monthStart(anio: string, mes: string): string {
  return `${anio}-${mes.padStart(2, "0")}-01`;
}

function monthEnd(anio: string, mes: string): string {
  const year = Number(anio);
  const month = Number(mes);
  const last = new Date(year, month, 0).getDate();

  return `${anio}-${mes.padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function normalizeMonthYear(mes: string | number, anio: string | number): { mes: string; anio: string } {
  let nextMes = Number(mes);
  let nextAnio = Number(anio);

  while (nextMes < 1) {
    nextMes += 12;
    nextAnio -= 1;
  }

  while (nextMes > 12) {
    nextMes -= 12;
    nextAnio += 1;
  }

  return {
    mes: String(nextMes).padStart(2, "0"),
    anio: String(nextAnio)
  };
}

function isMetaInsideSelectedPeriod(meta: Meta, filters: MetasFilters): boolean {
  if (!filters.anio || !filters.mes) return true;

  const start = monthStart(filters.anio, filters.mes);
  const end = monthEnd(filters.anio, filters.mes);

  return meta.fecha_desde <= end && meta.fecha_hasta >= start;
}

function getEstadoPeriodo(meta: Meta): EstadoPeriodo {
  if (!meta.activa) return "INACTIVA";

  const today = getToday();

  if (meta.fecha_hasta < today) return "VENCIDA";
  if (meta.fecha_desde > today) return "FUTURA";

  return "ACTIVA";
}

function getNombreCompleto(profile: ProfileLite | null): string {
  if (!profile) return "Todos los vendedores";

  return `${profile.nombre || ""} ${profile.apellido || ""}`.trim() || profile.email || "Vendedor";
}

function buildResumen(
  metas: Meta[],
  sucursales: SucursalLite[],
  vendedores: ProfileLite[]
): MetaResumen[] {
  return metas.map((meta) => {
    const sucursal = meta.sucursal_id
      ? sucursales.find((item) => item.id === meta.sucursal_id) || null
      : null;

    const vendedor = meta.vendedor_id
      ? vendedores.find((item) => item.id === meta.vendedor_id) || null
      : null;

    return {
      meta,
      sucursal,
      vendedor,
      estadoPeriodo: getEstadoPeriodo(meta)
    };
  });
}

function validateMetaPayload(tipo: MetaTipo, payload: {
  fecha_desde: string;
  fecha_hasta: string;
  meta_unica_usd: number;
  meta_piso_usd: number;
  meta_medio_usd: number;
  meta_logrado_usd: number;
}) {
  if (!payload.fecha_desde || !payload.fecha_hasta) {
    return "Completá fecha desde y fecha hasta.";
  }

  if (payload.fecha_hasta < payload.fecha_desde) {
    return "La fecha hasta no puede ser anterior a la fecha desde.";
  }

  if (tipo === "VENDEDOR_SEMANAL") {
    if (payload.meta_unica_usd <= 0) return "La meta semanal debe ser mayor a cero.";
    return null;
  }

  if (tipo === "ALMUNDO_MENSUAL") {
    if (payload.meta_logrado_usd <= 0 && payload.meta_unica_usd <= 0) {
      return "Completá la meta Almundo en USD.";
    }
    return null;
  }

  if (payload.meta_piso_usd <= 0 || payload.meta_medio_usd <= 0 || payload.meta_logrado_usd <= 0) {
    return "Completá piso, medio y logrado.";
  }

  if (!(payload.meta_piso_usd <= payload.meta_medio_usd && payload.meta_medio_usd <= payload.meta_logrado_usd)) {
    return "Las metas deben respetar el orden: piso ≤ medio ≤ logrado.";
  }

  return null;
}

export const useMetasStore = create<MetasState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,
  currentProfile: null,
  canManageMetas: false,
  metas: [],
  catalogos: {
    sucursales: [],
    vendedores: []
  },
  filters: getDefaultFilters(),
  selectedMetaId: null,

  loadMetas: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageMetas: false,
        metas: [],
        error: "No hay usuario autenticado."
      });
      return;
    }

    const profileRes = await supabase.from("profiles").select("*").eq("id", currentUserId).maybeSingle();

    if (profileRes.error) {
      set({ loading: false, error: normalizeError(profileRes.error) });
      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManageMetas = canProfileManage(currentProfile);

    if (!canManageMetas) {
      set({
        loading: false,
        currentProfile,
        canManageMetas,
        metas: [],
        error: "Tu usuario no tiene acceso al módulo Metas."
      });
      return;
    }

    const filters = get().filters;

    let metasQuery = supabase
      .from("metas")
      .select("*")
      .order("fecha_desde", { ascending: false })
      .order("tipo", { ascending: true });

    if (filters.tipo !== "todos") metasQuery = metasQuery.eq("tipo", filters.tipo);
    if (filters.sucursalId !== "todos") metasQuery = metasQuery.eq("sucursal_id", filters.sucursalId);
    if (filters.vendedorId !== "todos") {
      if (filters.vendedorId === "general") {
        metasQuery = metasQuery.is("vendedor_id", null);
      } else {
        metasQuery = metasQuery.eq("vendedor_id", filters.vendedorId);
      }
    }

    const [metasRes, sucursalesRes, vendedoresRes] = await Promise.all([
      metasQuery,
      supabase.from("sucursales").select("*").order("nombre"),
      supabase
        .from("profiles")
        .select("*")
        .eq("activo", true)
        .eq("rol", "vendedor")
        .order("nombre")
    ]);

    const firstError = metasRes.error || sucursalesRes.error || vendedoresRes.error;

    if (firstError) {
      set({ loading: false, currentProfile, canManageMetas, error: normalizeError(firstError) });
      return;
    }

    const metas = ((metasRes.data || []) as Meta[]).filter((meta) => isMetaInsideSelectedPeriod(meta, filters));

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageMetas,
      metas,
      catalogos: {
        sucursales: (sucursalesRes.data || []) as SucursalLite[],
        vendedores: (vendedoresRes.data || []) as ProfileLite[]
      }
    });
  },

  saveMeta: async (meta, draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const parsedMetaUnica = parseMoney(draft.meta_unica_usd);
    const parsedPiso = parseMoney(draft.meta_piso_usd);
    const parsedMedio = parseMoney(draft.meta_medio_usd);
    const parsedLogrado = parseMoney(draft.meta_logrado_usd);

    const payload = {
      fecha_desde: draft.fecha_desde,
      fecha_hasta: draft.fecha_hasta,
      mes: draft.mes ? Number(draft.mes) : null,
      anio: draft.anio ? Number(draft.anio) : null,
      meta_unica_usd: parsedMetaUnica,
      meta_piso_usd: parsedPiso,
      meta_medio_usd: parsedMedio,
      meta_logrado_usd: parsedLogrado,
      comision_piso_pct: parseMoney(draft.comision_piso_pct),
      comision_medio_pct: parseMoney(draft.comision_medio_pct),
      comision_logrado_pct: parseMoney(draft.comision_logrado_pct),
      activa: draft.activa,
      observaciones: draft.observaciones || null,
      updated_by: currentUserId
    };

    const validation = validateMetaPayload(meta.tipo, {
      fecha_desde: payload.fecha_desde,
      fecha_hasta: payload.fecha_hasta,
      meta_unica_usd: payload.meta_unica_usd,
      meta_piso_usd: payload.meta_piso_usd,
      meta_medio_usd: payload.meta_medio_usd,
      meta_logrado_usd: payload.meta_logrado_usd
    });

    if (validation) {
      set({ saving: false, error: validation });
      return false;
    }

    const { error } = await supabase.from("metas").update(payload).eq("id", meta.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadMetas();

    set({ saving: false });
    return true;
  },

  createMeta: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const tipo = draft.tipo;
    const isVendedor = tipo === "VENDEDOR_MENSUAL" || tipo === "VENDEDOR_SEMANAL";
    const isSucursal = tipo === "SUCURSAL_MENSUAL" || tipo === "ALMUNDO_MENSUAL";
    const isAlmundo = tipo === "ALMUNDO_MENSUAL";

    if (isSucursal && !draft.sucursal_id) {
      set({ saving: false, error: "Seleccioná una sucursal." });
      return false;
    }

    if (isVendedor && draft.alcance === "ESPECIFICO" && !draft.vendedor_id) {
      set({ saving: false, error: "Seleccioná un vendedor." });
      return false;
    }

    const parsedMetaUnica = parseMoney(draft.meta_unica_usd);
    const parsedPiso = parseMoney(draft.meta_piso_usd);
    const parsedMedio = parseMoney(draft.meta_medio_usd);
    const parsedLogrado = parseMoney(draft.meta_logrado_usd);

    const payloadBase = {
      tipo,
      fecha_desde: draft.fecha_desde,
      fecha_hasta: draft.fecha_hasta,
      mes: draft.mes ? Number(draft.mes) : null,
      anio: draft.anio ? Number(draft.anio) : null,
      moneda: "USD",
      meta_unica_usd: tipo === "VENDEDOR_SEMANAL" || isAlmundo ? parsedMetaUnica || parsedLogrado : 0,
      meta_piso_usd: isAlmundo ? 0 : parsedPiso,
      meta_medio_usd: isAlmundo ? 0 : parsedMedio,
      meta_logrado_usd: isAlmundo ? parsedMetaUnica || parsedLogrado : parsedLogrado,
      comision_piso_pct: tipo === "VENDEDOR_MENSUAL" ? parseMoney(draft.comision_piso_pct || 8) : 0,
      comision_medio_pct: tipo === "VENDEDOR_MENSUAL" ? parseMoney(draft.comision_medio_pct || 10) : 0,
      comision_logrado_pct: tipo === "VENDEDOR_MENSUAL" ? parseMoney(draft.comision_logrado_pct || 12) : 0,
      es_meta_almundo: isAlmundo,
      activa: true,
      observaciones: draft.observaciones || null,
      created_by: currentUserId,
      updated_by: currentUserId
    };

    const validation = validateMetaPayload(tipo, {
      fecha_desde: payloadBase.fecha_desde,
      fecha_hasta: payloadBase.fecha_hasta,
      meta_unica_usd: payloadBase.meta_unica_usd,
      meta_piso_usd: payloadBase.meta_piso_usd,
      meta_medio_usd: payloadBase.meta_medio_usd,
      meta_logrado_usd: payloadBase.meta_logrado_usd
    });

    if (validation) {
      set({ saving: false, error: validation });
      return false;
    }

    const rows = [];

    if (isSucursal) {
      rows.push({
        ...payloadBase,
        sucursal_id: draft.sucursal_id,
        vendedor_id: null
      });
    }

    if (isVendedor) {
      rows.push({
        ...payloadBase,
        sucursal_id: null,
        vendedor_id: draft.alcance === "ESPECIFICO" ? draft.vendedor_id : null
      });
    }

    const { error } = await supabase.from("metas").insert(rows).select("*");

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadMetas();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value }, selectedMetaId: null }));
  },

  setMonth: (mes, anio) => {
    const normalized = normalizeMonthYear(mes, anio);

    set((state) => ({
      filters: {
        ...state.filters,
        mes: normalized.mes,
        anio: normalized.anio
      },
      selectedMetaId: null
    }));
  },

  goToPreviousMonth: () => {
    const { filters } = get();
    const normalized = normalizeMonthYear(Number(filters.mes) - 1, filters.anio);

    set((state) => ({
      filters: {
        ...state.filters,
        mes: normalized.mes,
        anio: normalized.anio
      },
      selectedMetaId: null
    }));
  },

  goToNextMonth: () => {
    const { filters } = get();
    const normalized = normalizeMonthYear(Number(filters.mes) + 1, filters.anio);

    set((state) => ({
      filters: {
        ...state.filters,
        mes: normalized.mes,
        anio: normalized.anio
      },
      selectedMetaId: null
    }));
  },

  goToCurrentMonth: () => {
    const today = getToday();

    set((state) => ({
      filters: {
        ...state.filters,
        mes: today.slice(5, 7),
        anio: today.slice(0, 4)
      },
      selectedMetaId: null
    }));
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters(), selectedMetaId: null });
  },

  selectMeta: (id) => {
    set({ selectedMetaId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getResumen: () => {
    const { metas, catalogos, filters } = get();
    const search = normalizeText(filters.search);

    let resumen = buildResumen(metas, catalogos.sucursales, catalogos.vendedores);

    if (filters.estado !== "todos") {
      resumen = resumen.filter((item) => item.estadoPeriodo === filters.estado);
    }

    if (search) {
      resumen = resumen.filter((item) => {
        const haystack = normalizeText(
          [
            item.meta.tipo,
            item.sucursal?.nombre,
            getNombreCompleto(item.vendedor),
            item.estadoPeriodo,
            item.meta.observaciones
          ].join(" ")
        );

        return haystack.includes(search);
      });
    }

    return resumen;
  },

  getSelectedResumen: () => {
    const resumen = get().getResumen();
    const selectedMetaId = get().selectedMetaId;

    if (!selectedMetaId) return resumen[0] || null;

    return resumen.find((item) => item.meta.id === selectedMetaId) || resumen[0] || null;
  },

  getMetrics: () => {
    const resumen = get().getResumen();

    return {
      total: resumen.length,
      activas: resumen.filter((item) => item.estadoPeriodo === "ACTIVA").length,
      inactivas: resumen.filter((item) => item.estadoPeriodo === "INACTIVA").length,
      vendedor: resumen.filter(
        (item) => item.meta.tipo === "VENDEDOR_SEMANAL" || item.meta.tipo === "VENDEDOR_MENSUAL"
      ).length,
      sucursal: resumen.filter((item) => item.meta.tipo === "SUCURSAL_MENSUAL").length,
      almundo: resumen.filter((item) => item.meta.tipo === "ALMUNDO_MENSUAL").length
    };
  }
}));