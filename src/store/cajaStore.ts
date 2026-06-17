// src/store/cajaStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type CajaTipo = "CAJA" | "BANCO" | "BILLETERA" | "OTRA";
export type CajaMoneda = "ARS" | "USD";
export type CajaMovimientoTipo =
  | "INGRESO"
  | "EGRESO"
  | "PASE_INGRESO"
  | "PASE_EGRESO"
  | "AJUSTE"
  | "CONCILIACION";

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

export type CajaLite = {
  id: string;
  nombre: string;
  moneda: CajaMoneda | string;
  tipo: CajaTipo | string;
  sucursal_id: string | null;
  descripcion: string | null;
  activa: boolean;
  activo: boolean;
  orden: number;
};

export type CajaSaldo = {
  caja_id: string;
  caja_nombre: string;
  caja_tipo: CajaTipo | string;
  moneda: CajaMoneda | string;
  sucursal_id: string | null;
  sucursal: string | null;
  activa: boolean;
  activo: boolean;
  orden: number;
  saldo_actual: string | number;
  ultimo_movimiento_fecha: string | null;
  ultima_conciliacion_fecha: string | null;
  ultimo_saldo_conciliado: string | number | null;
};

export type CajaSaldoConsolidado = {
  moneda: CajaMoneda | string;
  saldo_total: string | number;
  cantidad_cajas: number;
};

export type CajaMovimiento = {
  id: string;
  fecha: string;
  tipo: CajaMovimientoTipo | string;
  tipo_resumen: string;
  categoria: string;
  descripcion: string;

  caja_id: string;
  caja_nombre: string | null;
  caja_tipo: CajaTipo | string | null;

  sucursal_id: string | null;
  sucursal: string | null;

  moneda: CajaMoneda | string;
  importe: string | number;
  importe_con_signo: string | number;

  referencia_tipo: string | null;
  referencia_id: string | null;
  referencia_texto: string | null;

  pase_grupo_id: string | null;
  conciliacion_id: string | null;

  vendedor_id: string | null;
  vendedor_nombre: string | null;

  cliente_id: string | null;
  cliente_nombre: string | null;

  forma_pago: string | null;
  observaciones: string | null;

  origen: string;

  anulado: boolean;
  anulado_at: string | null;
  anulado_by: string | null;
  anulado_by_nombre: string | null;
  motivo_anulacion: string | null;

  created_by: string | null;
  created_by_nombre: string | null;

  updated_by: string | null;
  updated_by_nombre: string | null;

  created_at: string;
  updated_at: string;
};

export type CajaFilters = {
  desde: string;
  hasta: string;
  moneda: "todos" | "ARS" | "USD";
  cajaId: string;
  tipo: "todos" | CajaMovimientoTipo;
  search: string;
  anulados: "no" | "si" | "todos";
};

export type MovimientoDraft = {
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  categoria: string;
  descripcion: string;
  caja_id: string;
  moneda: string;
  importe: string;
  referencia_texto: string;
  forma_pago: string;
  observaciones: string;
};

export type PaseCajaDraft = {
  fecha: string;
  caja_origen_id: string;
  caja_destino_id: string;
  importe: string;
  descripcion: string;
};

export type ConciliacionDraft = {
  fecha: string;
  caja_id: string;
  saldo_real: string;
  observaciones: string;
};

export type CajaMobileDraft = {
  id?: string;
  nombre: string;
  moneda: string;
  tipo: string;
  sucursal_id?: string | null;
  descripcion?: string | null;
  activa: boolean;
  activo: boolean;
  orden?: number;
};

export type MovimientoMobileUpdateInput = {
  id: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO" | string;
  categoria: string;
  descripcion: string;
  caja_id: string;
  moneda: string;
  importe: number;
  referencia_texto?: string | null;
  forma_pago?: string | null;
  observaciones?: string | null;
};

type CajaMetrics = {
  ars: number;
  usd: number;
  cajas: number;
  movimientos: number;
  ingresosArs: number;
  egresosArs: number;
  ingresosUsd: number;
  egresosUsd: number;
};

type CajaState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageCaja: boolean;

  cajas: CajaLite[];
  saldos: CajaSaldo[];
  saldosConsolidados: CajaSaldoConsolidado[];
  movimientos: CajaMovimiento[];

  filters: CajaFilters;
  selectedCajaId: string | null;

  loadCaja: () => Promise<void>;
  saveMovimiento: (draft: MovimientoDraft) => Promise<boolean>;
  savePaseCaja: (draft: PaseCajaDraft) => Promise<boolean>;
  saveConciliacion: (draft: ConciliacionDraft) => Promise<boolean>;
  anularMovimiento: (movimiento: CajaMovimiento, motivo: string) => Promise<boolean>;

  saveCajaMobile: (draft: CajaMobileDraft) => Promise<boolean>;
  toggleCajaActiva: (caja: CajaLite | CajaSaldo) => Promise<boolean>;
  updateMovimientoMobile: (input: MovimientoMobileUpdateInput) => Promise<boolean>;

  setFilter: <K extends keyof CajaFilters>(key: K, value: CajaFilters[K]) => void;
  resetFilters: () => void;
  selectCaja: (cajaId: string | null) => void;
  clearError: () => void;

  getFilteredMovimientos: () => CajaMovimiento[];
  getSelectedSaldo: () => CajaSaldo | null;
  getMetrics: () => CajaMetrics;
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
  return `${today.slice(0, 7)}-01`;
}

function getDefaultFilters(): CajaFilters {
  return {
    desde: getMonthStart(),
    hasta: getToday(),
    moneda: "todos",
    cajaId: "todos",
    tipo: "todos",
    search: "",
    anulados: "no"
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

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para esta acción.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("duplicate key")) {
      return "Ya existe un registro con esos datos.";
    }

    return message;
  }

  return String(error);
}

function nullableText(value: unknown): string | null {
  const clean = String(value || "").trim();
  return clean ? clean : null;
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

function buildCajaDisplayName(caja: Pick<CajaLite, "nombre" | "moneda">): string {
  return `${caja.nombre} · ${caja.moneda}`;
}

function normalizeMovimiento(row: Partial<CajaMovimiento>): CajaMovimiento {
  return {
    id: String(row.id || ""),
    fecha: String(row.fecha || ""),
    tipo: row.tipo || "INGRESO",
    tipo_resumen: row.tipo_resumen || "INGRESO",
    categoria: row.categoria || "Sin categoría",
    descripcion: row.descripcion || "",

    caja_id: String(row.caja_id || ""),
    caja_nombre: row.caja_nombre || null,
    caja_tipo: row.caja_tipo || null,

    sucursal_id: row.sucursal_id || null,
    sucursal: row.sucursal || null,

    moneda: row.moneda || "ARS",
    importe: row.importe || 0,
    importe_con_signo: row.importe_con_signo || 0,

    referencia_tipo: row.referencia_tipo || null,
    referencia_id: row.referencia_id || null,
    referencia_texto: row.referencia_texto || null,

    pase_grupo_id: row.pase_grupo_id || null,
    conciliacion_id: row.conciliacion_id || null,

    vendedor_id: row.vendedor_id || null,
    vendedor_nombre: row.vendedor_nombre || null,

    cliente_id: row.cliente_id || null,
    cliente_nombre: row.cliente_nombre || null,

    forma_pago: row.forma_pago || null,
    observaciones: row.observaciones || null,

    origen: row.origen || "MANUAL",

    anulado: Boolean(row.anulado),
    anulado_at: row.anulado_at || null,
    anulado_by: row.anulado_by || null,
    anulado_by_nombre: row.anulado_by_nombre || null,
    motivo_anulacion: row.motivo_anulacion || null,

    created_by: row.created_by || null,
    created_by_nombre: row.created_by_nombre || null,

    updated_by: row.updated_by || null,
    updated_by_nombre: row.updated_by_nombre || null,

    created_at: String(row.created_at || ""),
    updated_at: String(row.updated_at || "")
  };
}

export const useCajaStore = create<CajaState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageCaja: false,

  cajas: [],
  saldos: [],
  saldosConsolidados: [],
  movimientos: [],

  filters: getDefaultFilters(),
  selectedCajaId: null,

  loadCaja: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageCaja: false,
        cajas: [],
        saldos: [],
        saldosConsolidados: [],
        movimientos: [],
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
    const canManageCaja = canProfileManage(currentProfile);

    if (!canManageCaja) {
      set({
        loading: false,
        currentProfile,
        canManageCaja,
        cajas: [],
        saldos: [],
        saldosConsolidados: [],
        movimientos: [],
        error: "Tu usuario no tiene acceso al módulo Caja."
      });
      return;
    }

    const filters = get().filters;

    let movimientosQuery = supabase
      .from("vw_caja_movimientos")
      .select("*")
      .gte("fecha", filters.desde)
      .lte("fecha", filters.hasta)
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.moneda !== "todos") {
      movimientosQuery = movimientosQuery.eq("moneda", filters.moneda);
    }

    if (filters.cajaId !== "todos") {
      movimientosQuery = movimientosQuery.eq("caja_id", filters.cajaId);
    }

    if (filters.tipo !== "todos") {
      movimientosQuery = movimientosQuery.eq("tipo", filters.tipo);
    }

    if (filters.anulados === "no") {
      movimientosQuery = movimientosQuery.eq("anulado", false);
    }

    if (filters.anulados === "si") {
      movimientosQuery = movimientosQuery.eq("anulado", true);
    }

    const [cajasRes, saldosRes, consolidadosRes, movimientosRes] = await Promise.all([
      supabase
        .from("cajas")
        .select("id,nombre,moneda,tipo,sucursal_id,descripcion,activa,activo,orden")
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true }),

      supabase
        .from("vw_caja_saldos")
        .select("*")
        .order("moneda", { ascending: true })
        .order("orden", { ascending: true }),

      supabase
        .from("vw_caja_saldos_consolidados")
        .select("*")
        .order("moneda", { ascending: true }),

      movimientosQuery
    ]);

    const firstError =
      cajasRes.error || saldosRes.error || consolidadosRes.error || movimientosRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageCaja,
        error: normalizeError(firstError)
      });
      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageCaja,
      cajas: (cajasRes.data || []) as CajaLite[],
      saldos: (saldosRes.data || []) as CajaSaldo[],
      saldosConsolidados: (consolidadosRes.data || []) as CajaSaldoConsolidado[],
      movimientos: ((movimientosRes.data || []) as Partial<CajaMovimiento>[]).map(
        normalizeMovimiento
      )
    });
  },

  saveMovimiento: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const importe = parseMoney(draft.importe);

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.fecha) {
      set({ saving: false, error: "Completá la fecha." });
      return false;
    }

    if (!draft.caja_id) {
      set({ saving: false, error: "Seleccioná una caja." });
      return false;
    }

    if (importe <= 0) {
      set({ saving: false, error: "El importe debe ser mayor a cero." });
      return false;
    }

    if (!draft.descripcion.trim()) {
      set({ saving: false, error: "Completá una descripción." });
      return false;
    }

    const caja = get().cajas.find((item) => item.id === draft.caja_id);
    const moneda = caja?.moneda || draft.moneda || "ARS";

    const { error } = await supabase.from("caja_movimientos").insert({
      fecha: draft.fecha,
      tipo: draft.tipo,
      categoria: draft.categoria.trim() || "Sin categoría",
      descripcion: draft.descripcion.trim(),
      caja_id: draft.caja_id,
      sucursal_id: caja?.sucursal_id || null,
      moneda,
      importe,
      referencia_tipo: "MANUAL",
      referencia_texto: nullableText(draft.referencia_texto),
      origen: "MANUAL",
      forma_pago: nullableText(draft.forma_pago),
      observaciones: nullableText(draft.observaciones),
      created_by: currentUserId,
      updated_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  savePaseCaja: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const importe = parseMoney(draft.importe);

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.fecha) {
      set({ saving: false, error: "Completá la fecha." });
      return false;
    }

    if (!draft.caja_origen_id || !draft.caja_destino_id) {
      set({ saving: false, error: "Seleccioná caja origen y caja destino." });
      return false;
    }

    if (draft.caja_origen_id === draft.caja_destino_id) {
      set({ saving: false, error: "La caja origen y destino no pueden ser la misma." });
      return false;
    }

    const cajaOrigen = get().cajas.find((item) => item.id === draft.caja_origen_id);
    const cajaDestino = get().cajas.find((item) => item.id === draft.caja_destino_id);

    if (cajaOrigen?.moneda !== cajaDestino?.moneda) {
      set({ saving: false, error: "El pase solo puede hacerse entre cajas de la misma moneda." });
      return false;
    }

    if (importe <= 0) {
      set({ saving: false, error: "El importe debe ser mayor a cero." });
      return false;
    }

    const { error } = await supabase.rpc("crear_pase_caja", {
      p_fecha: draft.fecha,
      p_caja_origen_id: draft.caja_origen_id,
      p_caja_destino_id: draft.caja_destino_id,
      p_importe: importe,
      p_descripcion: draft.descripcion.trim() || null,
      p_created_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  saveConciliacion: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const saldoReal = parseMoney(draft.saldo_real);

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.fecha) {
      set({ saving: false, error: "Completá la fecha." });
      return false;
    }

    if (!draft.caja_id) {
      set({ saving: false, error: "Seleccioná una caja." });
      return false;
    }

    const { error } = await supabase.rpc("conciliar_caja", {
      p_fecha: draft.fecha,
      p_caja_id: draft.caja_id,
      p_saldo_real: saldoReal,
      p_observaciones: draft.observaciones.trim() || null,
      p_created_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  anularMovimiento: async (movimiento, motivo) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!motivo.trim()) {
      set({ saving: false, error: "Indicá el motivo de anulación." });
      return false;
    }

    const payload = {
      anulado: true,
      anulado_at: new Date().toISOString(),
      anulado_by: currentUserId,
      motivo_anulacion: motivo.trim(),
      updated_by: currentUserId
    };

    if (movimiento.pase_grupo_id) {
      const { error } = await supabase
        .from("caja_movimientos")
        .update(payload)
        .eq("pase_grupo_id", movimiento.pase_grupo_id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    } else {
      const { error } = await supabase
        .from("caja_movimientos")
        .update(payload)
        .eq("id", movimiento.id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  saveCajaMobile: async (draft) => {
    set({ saving: true, error: null });

    const nombre = String(draft.nombre || "").trim();

    if (!nombre) {
      set({ saving: false, error: "Completá el nombre de la caja." });
      return false;
    }

    if (!draft.moneda) {
      set({ saving: false, error: "Seleccioná la moneda." });
      return false;
    }

    if (!draft.tipo) {
      set({ saving: false, error: "Seleccioná el tipo de caja." });
      return false;
    }

    const payload = {
      nombre,
      moneda: draft.moneda,
      tipo: draft.tipo,
      sucursal_id: draft.sucursal_id || null,
      descripcion: nullableText(draft.descripcion),
      activa: Boolean(draft.activa),
      activo: Boolean(draft.activo),
      orden: Number.isFinite(Number(draft.orden)) ? Number(draft.orden) : 0
    };

    if (draft.id) {
      const { error } = await supabase.from("cajas").update(payload).eq("id", draft.id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    } else {
      const { error } = await supabase.from("cajas").insert(payload);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  toggleCajaActiva: async (caja) => {
    set({ saving: true, error: null });

    const cajaId = "id" in caja ? caja.id : caja.caja_id;
    const activaActual = Boolean(caja.activa);
    const activoActual = Boolean(caja.activo);

    const nextValue = !(activaActual && activoActual);

    const { error } = await supabase
      .from("cajas")
      .update({
        activa: nextValue,
        activo: nextValue
      })
      .eq("id", cajaId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  updateMovimientoMobile: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!input.id) {
      set({ saving: false, error: "No se encontró el movimiento." });
      return false;
    }

    if (!input.fecha) {
      set({ saving: false, error: "Completá la fecha." });
      return false;
    }

    if (!input.caja_id) {
      set({ saving: false, error: "Seleccioná una caja." });
      return false;
    }

    if (parseMoney(input.importe) <= 0) {
      set({ saving: false, error: "El importe debe ser mayor a cero." });
      return false;
    }

    if (!String(input.descripcion || "").trim()) {
      set({ saving: false, error: "Completá una descripción." });
      return false;
    }

    const caja = get().cajas.find((item) => item.id === input.caja_id);

    const { error } = await supabase
      .from("caja_movimientos")
      .update({
        fecha: input.fecha,
        tipo: input.tipo,
        categoria: String(input.categoria || "").trim() || "Sin categoría",
        descripcion: String(input.descripcion || "").trim(),
        caja_id: input.caja_id,
        sucursal_id: caja?.sucursal_id || null,
        moneda: caja?.moneda || input.moneda || "ARS",
        importe: parseMoney(input.importe),
        referencia_texto: nullableText(input.referencia_texto),
        forma_pago: nullableText(input.forma_pago),
        observaciones: nullableText(input.observaciones),
        updated_by: currentUserId
      })
      .eq("id", input.id)
      .eq("origen", "MANUAL")
      .eq("anulado", false);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCaja();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters() });
  },

  selectCaja: (cajaId) => {
    set({ selectedCajaId: cajaId });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredMovimientos: () => {
    const { movimientos, filters } = get();
    const search = normalizeText(filters.search);

    return movimientos.filter((movimiento) => {
      if (search) {
        const haystack = normalizeText(
          [
            movimiento.tipo,
            movimiento.categoria,
            movimiento.descripcion,
            movimiento.caja_nombre,
            movimiento.caja_tipo,
            movimiento.sucursal,
            movimiento.moneda,
            movimiento.referencia_tipo,
            movimiento.referencia_texto,
            movimiento.origen,
            movimiento.vendedor_nombre,
            movimiento.cliente_nombre,
            movimiento.created_by_nombre,
            movimiento.updated_by_nombre,
            movimiento.anulado_by_nombre,
            movimiento.forma_pago,
            movimiento.observaciones,
            movimiento.motivo_anulacion
          ].join(" ")
        );

        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  },

  getSelectedSaldo: () => {
    const { saldos, selectedCajaId } = get();

    if (!selectedCajaId) return saldos[0] || null;

    return saldos.find((saldo) => saldo.caja_id === selectedCajaId) || saldos[0] || null;
  },

  getMetrics: () => {
    const { saldosConsolidados } = get();
    const movimientos = get().getFilteredMovimientos();

    const ars = saldosConsolidados.find((item) => item.moneda === "ARS");
    const usd = saldosConsolidados.find((item) => item.moneda === "USD");

    return {
      ars: parseMoney(ars?.saldo_total),
      usd: parseMoney(usd?.saldo_total),
      cajas: get().saldos.length,
      movimientos: movimientos.length,
      ingresosArs: movimientos
        .filter(
          (item) =>
            item.moneda === "ARS" && parseMoney(item.importe_con_signo) > 0 && !item.anulado
        )
        .reduce((total, item) => total + parseMoney(item.importe_con_signo), 0),
      egresosArs: movimientos
        .filter(
          (item) =>
            item.moneda === "ARS" && parseMoney(item.importe_con_signo) < 0 && !item.anulado
        )
        .reduce((total, item) => total + Math.abs(parseMoney(item.importe_con_signo)), 0),
      ingresosUsd: movimientos
        .filter(
          (item) =>
            item.moneda === "USD" && parseMoney(item.importe_con_signo) > 0 && !item.anulado
        )
        .reduce((total, item) => total + parseMoney(item.importe_con_signo), 0),
      egresosUsd: movimientos
        .filter(
          (item) =>
            item.moneda === "USD" && parseMoney(item.importe_con_signo) < 0 && !item.anulado
        )
        .reduce((total, item) => total + Math.abs(parseMoney(item.importe_con_signo)), 0)
    };
  }
}));

export function createInitialMovimientoDraft(caja?: CajaLite | null): MovimientoDraft {
  return {
    fecha: getToday(),
    tipo: "INGRESO",
    categoria: "",
    descripcion: "",
    caja_id: caja?.id || "",
    moneda: caja?.moneda || "ARS",
    importe: "",
    referencia_texto: "",
    forma_pago: "",
    observaciones: ""
  };
}

export function createInitialPaseCajaDraft(): PaseCajaDraft {
  return {
    fecha: getToday(),
    caja_origen_id: "",
    caja_destino_id: "",
    importe: "",
    descripcion: ""
  };
}

export function createInitialConciliacionDraft(caja?: CajaSaldo | null): ConciliacionDraft {
  return {
    fecha: getToday(),
    caja_id: caja?.caja_id || "",
    saldo_real: caja ? String(caja.saldo_actual || "").replace(".", ",") : "",
    observaciones: ""
  };
}

export function getCajaDisplayName(caja: Pick<CajaLite, "nombre" | "moneda">): string {
  return buildCajaDisplayName(caja);
}