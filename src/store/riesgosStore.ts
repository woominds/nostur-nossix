import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type RiesgoEstado = "EN_PLAZO" | "PROXIMO" | "VENCIDO" | "RESUELTO";
export type CajaMoneda = "ARS" | "USD";

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
  tipo: string;
  activa?: boolean;
  activo?: boolean;
  orden?: number;
};

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type VendedorLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: string;
  color?: string | null;
  activo: boolean;
};

export type RiesgoAlmundo = {
  carrito_id: string;
  numero_carrito: string;
  cliente_id: string | null;
  pasajero: string | null;
  telefono: string | null;
  email: string | null;

  fecha_venta: string;
  carrito_created_at: string;
  vencimiento_at: string;

  fecha_in: string | null;
  fecha_out: string | null;
  solo_ida: boolean;
  destino: string | null;
  servicio: string | null;

  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;

  moneda: CajaMoneda | string;
  importe_riesgo: string | number;
  total_pagado_riesgo: string | number;
  saldo_riesgo: string | number;

  cantidad_pagos: number;
  ultimo_pago_fecha: string | null;

  riesgo: boolean;
  riesgo_motivo: string | null;
  riesgo_resuelto: boolean;
  riesgo_resuelto_at: string | null;
  riesgo_resuelto_by: string | null;
  riesgo_observaciones: string | null;

  estado_riesgo: RiesgoEstado | string;
  orden_estado: number;

  activo: boolean;
  estado_carrito: string;
  created_at: string;
  updated_at: string;
};

export type RiesgoPago = {
  id: string;
  carrito_id: string;
  numero_carrito: string | null;
  pasajero: string | null;

  fecha_pago: string;
  importe: string | number;
  moneda: CajaMoneda | string;

  caja_id: string;
  caja_nombre: string | null;
  caja_tipo: string | null;

  forma_pago: string;
  observaciones: string | null;
  caja_movimiento_id: string | null;

  anulado: boolean;
  anulado_at: string | null;
  anulado_by: string | null;
  motivo_anulacion: string | null;

  created_by: string | null;
  created_by_nombre: string | null;
  created_by_apellido: string | null;

  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type RiesgosFilters = {
  desde: string;
  hasta: string;
  estado: "todos" | RiesgoEstado;
  moneda: "todos" | "ARS" | "USD";
  vendedorId: string;
  sucursalId: string;
  search: string;
  incluirResueltos: boolean;
};

export type PagoRiesgoDraft = {
  carrito_id: string;
  fecha_pago: string;
  importe: string;
  caja_id: string;
  forma_pago: string;
  observaciones: string;
};

export type ResolverSinPagoDraft = {
  carrito_id: string;
  observaciones: string;
};

type RiesgosMetrics = {
  total: number;
  activos: number;
  resueltos: number;
  vencidos: number;
  proximos: number;
  enPlazo: number;
  saldoArs: number;
  saldoUsd: number;
  pagadoArs: number;
  pagadoUsd: number;
};

type RiesgosState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageRiesgos: boolean;

  riesgos: RiesgoAlmundo[];
  pagos: RiesgoPago[];

  catalogos: {
    cajas: CajaLite[];
    vendedores: VendedorLite[];
    sucursales: SucursalLite[];
  };

  filters: RiesgosFilters;
  selectedRiesgoId: string | null;

  loadRiesgos: () => Promise<void>;
  registrarPago: (draft: PagoRiesgoDraft) => Promise<boolean>;
  anularPago: (pago: RiesgoPago, motivo: string) => Promise<boolean>;
  resolverSinPago: (draft: ResolverSinPagoDraft) => Promise<boolean>;

  setFilter: <K extends keyof RiesgosFilters>(key: K, value: RiesgosFilters[K]) => void;
  resetFilters: () => void;
  selectRiesgo: (carritoId: string | null) => void;
  clearError: () => void;

  getFilteredRiesgos: () => RiesgoAlmundo[];
  getSelectedRiesgo: () => RiesgoAlmundo | null;
  getPagosBySelected: () => RiesgoPago[];
  getMetrics: () => RiesgosMetrics;
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



function getDefaultFilters(): RiesgosFilters {
  return {
    desde: "",
    hasta: "",
    estado: "todos",
    moneda: "todos",
    vendedorId: "todos",
    sucursalId: "todos",
    incluirResueltos: false,
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
    if (message.toLowerCase().includes("saldo pendiente")) return message;
    if (message.toLowerCase().includes("moneda de la caja")) return message;
    if (message.toLowerCase().includes("riesgo ya está cancelado")) return message;

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

function getCajaName(caja: CajaLite): string {
  return `${caja.nombre} · ${caja.moneda}`;
}

async function marcarCarritoRiesgoResuelto(params: {
  carritoId: string;
  userId: string;
  observaciones?: string | null;
}): Promise<string | null> {
  const { carritoId, userId, observaciones } = params;

  const { error } = await supabase
    .from("carritos")
    .update({
      riesgo: false,
      importe_riesgo: 0,
      riesgo_resuelto: true,
      riesgo_resuelto_at: new Date().toISOString(),
      riesgo_resuelto_by: userId,
      riesgo_observaciones: observaciones || null
    })
    .eq("id", carritoId);

  return error ? normalizeError(error) : null;
}

async function reabrirCarritoRiesgo(params: {
  carritoId: string;
  userId: string;
  observaciones?: string | null;
}): Promise<string | null> {
  const { carritoId, userId, observaciones } = params;

  const { error } = await supabase
    .from("carritos")
    .update({
      riesgo: true,
      riesgo_resuelto: false,
      riesgo_resuelto_at: null,
      riesgo_resuelto_by: null,
      riesgo_observaciones: observaciones || `Riesgo reabierto por anulación de pago. Usuario: ${userId}`
    })
    .eq("id", carritoId);

  return error ? normalizeError(error) : null;
}

export const useRiesgosStore = create<RiesgosState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageRiesgos: false,

  riesgos: [],
  pagos: [],

  catalogos: {
    cajas: [],
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedRiesgoId: null,

  loadRiesgos: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageRiesgos: false,
        riesgos: [],
        pagos: [],
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
    const canManageRiesgos = canProfileManage(currentProfile);

    if (!canManageRiesgos) {
      set({
        loading: false,
        currentProfile,
        canManageRiesgos,
        riesgos: [],
        pagos: [],
        error: "Tu usuario no tiene acceso al módulo Riesgos."
      });
      return;
    }

    const filters = get().filters;

    let riesgosQuery = supabase
  .from("vw_riesgos_almundo")
  .select("*")
  .order("orden_estado", { ascending: true })
  .order("fecha_venta", { ascending: false });

if (filters.desde) {
  riesgosQuery = riesgosQuery.gte("fecha_venta", filters.desde);
}

if (filters.hasta) {
  riesgosQuery = riesgosQuery.lte("fecha_venta", filters.hasta);
}

    if (filters.estado !== "todos") riesgosQuery = riesgosQuery.eq("estado_riesgo", filters.estado);
    if (filters.moneda !== "todos") riesgosQuery = riesgosQuery.eq("moneda", filters.moneda);
    if (filters.vendedorId !== "todos") riesgosQuery = riesgosQuery.eq("vendedor_id", filters.vendedorId);
    if (filters.sucursalId !== "todos") riesgosQuery = riesgosQuery.eq("sucursal_id", filters.sucursalId);
    if (!filters.incluirResueltos) riesgosQuery = riesgosQuery.neq("estado_riesgo", "RESUELTO");

    const [riesgosRes, pagosRes, cajasRes, vendedoresRes, sucursalesRes] = await Promise.all([
      riesgosQuery,
      supabase
        .from("vw_riesgos_almundo_pagos")
        .select("*")
        .order("fecha_pago", { ascending: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("cajas")
        .select("id, nombre, moneda, tipo, activa, activo, orden")
        .eq("activa", true)
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, nombre, apellido, email, sucursal_id, rol, color, activo")
        .eq("activo", true)
        .order("nombre", { ascending: true }),
      supabase
        .from("sucursales")
        .select("*")
        .order("nombre", { ascending: true })
    ]);

    const firstError =
      riesgosRes.error ||
      pagosRes.error ||
      cajasRes.error ||
      vendedoresRes.error ||
      sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageRiesgos,
        error: normalizeError(firstError)
      });
      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageRiesgos,
      riesgos: (riesgosRes.data || []) as RiesgoAlmundo[],
      pagos: (pagosRes.data || []) as RiesgoPago[],
      catalogos: {
        cajas: (cajasRes.data || []) as CajaLite[],
        vendedores: (vendedoresRes.data || []) as VendedorLite[],
        sucursales: (sucursalesRes.data || []) as SucursalLite[]
      }
    });
  },

  registrarPago: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const importe = parseMoney(draft.importe);

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.carrito_id) {
      set({ saving: false, error: "Seleccioná un riesgo." });
      return false;
    }

    if (!draft.fecha_pago) {
      set({ saving: false, error: "Completá la fecha de pago." });
      return false;
    }

    if (!draft.caja_id) {
      set({ saving: false, error: "Seleccioná desde qué caja se pagó a Almundo." });
      return false;
    }

    if (importe <= 0) {
      set({ saving: false, error: "El importe debe ser mayor a cero." });
      return false;
    }

    if (!draft.forma_pago.trim()) {
      set({ saving: false, error: "Completá la forma de pago." });
      return false;
    }

    const riesgo = get().riesgos.find((item) => item.carrito_id === draft.carrito_id);

    if (!riesgo) {
      set({ saving: false, error: "No se encontró el riesgo seleccionado." });
      return false;
    }

    const saldo = parseMoney(riesgo.saldo_riesgo);

    if (importe > saldo + 0.009) {
      set({ saving: false, error: "El pago no puede superar el saldo pendiente del riesgo." });
      return false;
    }

    const caja = get().catalogos.cajas.find((item) => item.id === draft.caja_id);

    if (caja && caja.moneda !== riesgo.moneda) {
      set({
        saving: false,
        error: `La caja seleccionada es ${caja.moneda}, pero el riesgo está en ${riesgo.moneda}.`
      });
      return false;
    }

    const { error } = await supabase.rpc("registrar_pago_riesgo_almundo", {
      p_carrito_id: draft.carrito_id,
      p_fecha_pago: draft.fecha_pago,
      p_importe: importe,
      p_caja_id: draft.caja_id,
      p_forma_pago: draft.forma_pago.trim(),
      p_observaciones: draft.observaciones.trim() || null,
      p_created_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const saldoPosterior = saldo - importe;

    if (saldoPosterior <= 0.009) {
      const syncError = await marcarCarritoRiesgoResuelto({
        carritoId: draft.carrito_id,
        userId: currentUserId,
        observaciones: draft.observaciones.trim() || "Riesgo cancelado por pago total a Almundo."
      });

      if (syncError) {
        set({ saving: false, error: syncError });
        return false;
      }
    }

    await get().loadRiesgos();

    set({ saving: false });
    return true;
  },

  anularPago: async (pago, motivo) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!pago.id) {
      set({ saving: false, error: "No se encontró el pago seleccionado." });
      return false;
    }

    if (!motivo.trim()) {
      set({ saving: false, error: "Indicá el motivo de anulación." });
      return false;
    }

    const { error } = await supabase.rpc("anular_pago_riesgo_almundo", {
      p_pago_id: pago.id,
      p_motivo: motivo.trim(),
      p_user_id: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const syncError = await reabrirCarritoRiesgo({
      carritoId: pago.carrito_id,
      userId: currentUserId,
      observaciones: `Riesgo reabierto por anulación de pago. Motivo: ${motivo.trim()}`
    });

    if (syncError) {
      set({ saving: false, error: syncError });
      return false;
    }

    await get().loadRiesgos();

    set({ saving: false });
    return true;
  },

  resolverSinPago: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.carrito_id) {
      set({ saving: false, error: "Seleccioná un riesgo." });
      return false;
    }

    if (!draft.observaciones.trim()) {
      set({
        saving: false,
        error: "La observación es obligatoria para resolver un riesgo sin pago."
      });
      return false;
    }

    const { error } = await supabase.rpc("resolver_riesgo_almundo_sin_pago", {
      p_carrito_id: draft.carrito_id,
      p_observaciones: draft.observaciones.trim(),
      p_user_id: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    const syncError = await marcarCarritoRiesgoResuelto({
      carritoId: draft.carrito_id,
      userId: currentUserId,
      observaciones: draft.observaciones.trim()
    });

    if (syncError) {
      set({ saving: false, error: syncError });
      return false;
    }

    await get().loadRiesgos();

    set({ saving: false });
    return true;
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

  selectRiesgo: (carritoId) => {
    set({ selectedRiesgoId: carritoId });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredRiesgos: () => {
    const { riesgos, filters } = get();
    const search = normalizeText(filters.search);

    return riesgos.filter((riesgo) => {
      if (search) {
        const haystack = normalizeText(
          [
            riesgo.numero_carrito,
            riesgo.pasajero,
            riesgo.telefono,
            riesgo.email,
            riesgo.destino,
            riesgo.servicio,
            riesgo.vendedor,
            riesgo.sucursal,
            riesgo.riesgo_motivo,
            riesgo.estado_riesgo,
            riesgo.moneda
          ].join(" ")
        );

        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  },

  getSelectedRiesgo: () => {
    const riesgos = get().getFilteredRiesgos();
    const selectedRiesgoId = get().selectedRiesgoId;

    if (!selectedRiesgoId) return riesgos[0] || null;

    return riesgos.find((item) => item.carrito_id === selectedRiesgoId) || riesgos[0] || null;
  },

  getPagosBySelected: () => {
    const selected = get().getSelectedRiesgo();

    if (!selected) return [];

    return get().pagos.filter((pago) => pago.carrito_id === selected.carrito_id);
  },

  getMetrics: () => {
    const riesgos = get().getFilteredRiesgos();

    return {
      total: riesgos.length,
      activos: riesgos.filter((item) => item.estado_riesgo !== "RESUELTO").length,
      resueltos: riesgos.filter((item) => item.estado_riesgo === "RESUELTO").length,
      vencidos: riesgos.filter((item) => item.estado_riesgo === "VENCIDO").length,
      proximos: riesgos.filter((item) => item.estado_riesgo === "PROXIMO").length,
      enPlazo: riesgos.filter((item) => item.estado_riesgo === "EN_PLAZO").length,
      saldoArs: riesgos
        .filter((item) => item.moneda === "ARS" && item.estado_riesgo !== "RESUELTO")
        .reduce((total, item) => total + parseMoney(item.saldo_riesgo), 0),
      saldoUsd: riesgos
        .filter((item) => item.moneda === "USD" && item.estado_riesgo !== "RESUELTO")
        .reduce((total, item) => total + parseMoney(item.saldo_riesgo), 0),
      pagadoArs: riesgos
        .filter((item) => item.moneda === "ARS")
        .reduce((total, item) => total + parseMoney(item.total_pagado_riesgo), 0),
      pagadoUsd: riesgos
        .filter((item) => item.moneda === "USD")
        .reduce((total, item) => total + parseMoney(item.total_pagado_riesgo), 0)
    };
  }
}));

export function createInitialPagoRiesgoDraft(
  riesgo?: RiesgoAlmundo | null,
  caja?: CajaLite | null
): PagoRiesgoDraft {
  const cajasCompatibles = caja && riesgo ? caja.moneda === riesgo.moneda : Boolean(caja);

  return {
    carrito_id: riesgo?.carrito_id || "",
    fecha_pago: getToday(),
    importe: riesgo ? String(riesgo.saldo_riesgo || "").replace(".", ",") : "",
    caja_id: cajasCompatibles ? caja?.id || "" : "",
    forma_pago: "",
    observaciones: ""
  };
}

export function createInitialResolverSinPagoDraft(riesgo?: RiesgoAlmundo | null): ResolverSinPagoDraft {
  return {
    carrito_id: riesgo?.carrito_id || "",
    observaciones: ""
  };
}

export function getRiesgoEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    EN_PLAZO: "En plazo",
    PROXIMO: "Próximo",
    VENCIDO: "Vencido",
    RESUELTO: "Resuelto"
  };

  return labels[estado] || estado;
}

export function getRiesgoEstadoTone(estado: string): "ok" | "warning" | "danger" | "neutral" {
  if (estado === "EN_PLAZO") return "ok";
  if (estado === "PROXIMO") return "warning";
  if (estado === "VENCIDO") return "danger";
  return "neutral";
}

export function getCajaDisplayName(caja: CajaLite): string {
  return getCajaName(caja);
}