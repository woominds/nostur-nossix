import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type CtaCteOrigen = "CARRITO" | "FILE";

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

export type VendedorLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
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
  activo?: boolean;
  activa?: boolean;
};

export type CtaCteItem = {
  origen_id: string;
  origen: CtaCteOrigen;

  cliente_id: string;
  pasajero: string | null;
  telefono: string | null;
  email: string | null;

  numero_operacion: string;
   fecha_venta: string;
  fecha_ingreso_gastos: string | null;
  fecha_in: string | null;
  fecha_out: string | null;
  solo_ida: boolean;

  servicio: string | null;
  destino: string | null;
  metodo_contacto: string | null;
  forma_pago: string | null;

  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;

  moneda: "ARS" | "USD" | string;
  importe_total: string | number;
  total_pagado: string | number;
  saldo_cta_cte: string | number;

  pago_parcial: boolean;
  estado: string;
  observaciones: string | null;

  fecha_ultimo_pago: string | null;
  cantidad_pagos: number;

  created_at: string;
  updated_at: string;
};

export type CtaCtePago = {
  id: string;
  origen: CtaCteOrigen;
  origen_id: string;

  cliente_id: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;

  fecha_pago: string;
  moneda: "ARS" | "USD" | string;
  importe: string | number;

  metodo_pago: string | null;
  caja_id: string | null;
  entrega_efectivo: boolean;

  observaciones: string | null;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PagoCtaCteDraft = {
  fecha_pago: string;
  importe: string;
  metodo_pago: string;
  caja_id: string;
  entrega_efectivo: boolean;
  observaciones: string;
};

export type CtasCtesFilters = {
  origen: "todos" | CtaCteOrigen;
  moneda: "todos" | "ARS" | "USD";
  vendedorId: string;
  sucursalId: string;
  search: string;
};

type MoneyResumen = {
  pendiente: number;
  cantidad: number;
};

type CtasCtesMetrics = {
  total: number;
  ars: MoneyResumen;
  usd: MoneyResumen;
  carritos: number;
  files: number;
};

type CtasCtesState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageCtasCtes: boolean;

  items: CtaCteItem[];
  pagosByOrigen: Record<string, CtaCtePago[]>;

  catalogos: {
    vendedores: VendedorLite[];
    sucursales: SucursalLite[];
    cajas: CajaLite[];
  };

  filters: CtasCtesFilters;
  selectedKey: string | null;

  loadCtasCtes: () => Promise<void>;
  loadPagosForItem: (item: CtaCteItem) => Promise<void>;
  registrarPago: (item: CtaCteItem, draft: PagoCtaCteDraft) => Promise<boolean>;

  setFilter: <K extends keyof CtasCtesFilters>(key: K, value: CtasCtesFilters[K]) => void;
  resetFilters: () => void;
  selectItem: (item: CtaCteItem | null) => void;
  clearError: () => void;

  getFilteredItems: () => CtaCteItem[];
  getSelectedItem: () => CtaCteItem | null;
  getPagosForSelected: () => CtaCtePago[];
  getPagosForItem: (item: CtaCteItem | null) => CtaCtePago[];
  getMetrics: () => CtasCtesMetrics;
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

function getDefaultFilters(): CtasCtesFilters {
  return {
    origen: "todos",
    moneda: "todos",
    vendedorId: "todos",
    sucursalId: "todos",
    search: ""
  };
}

function getItemKey(item: Pick<CtaCteItem, "origen" | "origen_id">): string {
  return `${item.origen}:${item.origen_id}`;
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

    if (message.toLowerCase().includes("registrar_pago_cta_cte")) {
      return "No se pudo registrar el pago en cuenta corriente.";
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

function sortItems(a: CtaCteItem, b: CtaCteItem): number {
  const aFechaGastos = a.fecha_ingreso_gastos || a.fecha_venta || a.created_at;
  const bFechaGastos = b.fecha_ingreso_gastos || b.fecha_venta || b.created_at;

  const aDate = new Date(aFechaGastos).getTime();
  const bDate = new Date(bFechaGastos).getTime();

  if (aDate !== bDate) return aDate - bDate;

  const aSaldo = parseMoney(a.saldo_cta_cte);
  const bSaldo = parseMoney(b.saldo_cta_cte);

  return bSaldo - aSaldo;
}

function isSaldoCancelado(value: number): boolean {
  return value <= 0.009;
}

async function reactivarOperacionSaldada(item: CtaCteItem): Promise<{ error: unknown | null }> {
  const importeTotal = parseMoney(item.importe_total);
  const today = getToday();

  if (item.origen === "CARRITO") {
    const { error } = await supabase
      .from("carritos")
      .update({
        visible_en_carritos: true,
        fecha_visible_carritos: today,
        estado: "EN_CONTROL",
        pago_parcial: false,
        total_pagado: importeTotal,
        saldo_cta_cte: 0
      })
      .eq("id", item.origen_id);

    return { error };
  }

  if (item.origen === "FILE") {
    const { error } = await supabase
      .from("files")
      .update({
        visible_en_files: true,
        fecha_visible_files: today,
        estado: "CARGADO",
        pago_parcial: false,
        total_pagado: importeTotal,
        saldo_cta_cte: 0
      })
      .eq("id", item.origen_id);

    return { error };
  }

  return { error: null };
}

export const useCtasCtesStore = create<CtasCtesState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageCtasCtes: false,

  items: [],
  pagosByOrigen: {},

  catalogos: {
    vendedores: [],
    sucursales: [],
    cajas: []
  },

  filters: getDefaultFilters(),
  selectedKey: null,

  loadCtasCtes: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageCtasCtes: false,
        items: [],
        pagosByOrigen: {},
        catalogos: {
          vendedores: [],
          sucursales: [],
          cajas: []
        },
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
    const canManageCtasCtes = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageCtasCtes,
        items: [],
        pagosByOrigen: {},
        catalogos: {
          vendedores: [],
          sucursales: [],
          cajas: []
        },
        error: "Tu usuario no tiene acceso al módulo Ctas Ctes."
      });
      return;
    }

    let itemsQuery = supabase
      .from("vw_ctas_ctes_unificada")
      .select("*")
      .order("fecha_venta", { ascending: false });

    if (!canManageCtasCtes) {
      itemsQuery = itemsQuery.eq("vendedor_id", currentUserId);
    }

    const vendedoresQuery = supabase
      .from("profiles")
      .select("id, nombre, apellido, email, activo")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    const sucursalesQuery = supabase
      .from("sucursales")
      .select("*")
      .order("nombre", { ascending: true });

    const cajasQuery = supabase
      .from("cajas")
      .select("id, nombre, activo, activa")
      .or("activo.eq.true,activa.eq.true")
      .order("nombre", { ascending: true });

    const [itemsRes, vendedoresRes, sucursalesRes, cajasRes] = await Promise.all([
      itemsQuery,
      canManageCtasCtes ? vendedoresQuery : Promise.resolve({ data: [], error: null }),
      canManageCtasCtes ? sucursalesQuery : Promise.resolve({ data: [], error: null }),
      cajasQuery
    ]);

    const firstError =
      itemsRes.error || vendedoresRes.error || sucursalesRes.error || cajasRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageCtasCtes,
        error: normalizeError(firstError)
      });
      return;
    }

    const items = ((itemsRes.data || []) as CtaCteItem[]).sort(sortItems);

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageCtasCtes,
      items,
      catalogos: {
        vendedores: (vendedoresRes.data || []) as VendedorLite[],
        sucursales: (sucursalesRes.data || []) as SucursalLite[],
        cajas: (cajasRes.data || []) as CajaLite[]
      }
    });
  },

  loadPagosForItem: async (item) => {
    const key = getItemKey(item);

    const { data, error } = await supabase
      .from("ctas_ctes_pagos")
      .select("*")
      .eq("origen", item.origen)
      .eq("origen_id", item.origen_id)
      .order("fecha_pago", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      set({ error: normalizeError(error) });
      return;
    }

    set((state) => ({
      pagosByOrigen: {
        ...state.pagosByOrigen,
        [key]: (data || []) as CtaCtePago[]
      }
    }));
  },

  registrarPago: async (item, draft) => {
    set({ saving: true, error: null });

    const importe = parseMoney(draft.importe);
    const saldoActual = parseMoney(item.saldo_cta_cte);
    const nuevoSaldo = Math.max(0, saldoActual - importe);

    if (importe <= 0) {
      set({ saving: false, error: "El importe del pago debe ser mayor a cero." });
      return false;
    }

    if (importe > saldoActual + 0.009) {
      set({
        saving: false,
        error: "El importe del pago no puede superar el saldo pendiente."
      });
      return false;
    }

    if (!draft.fecha_pago) {
      set({ saving: false, error: "Completá la fecha de pago." });
      return false;
    }

    if (!draft.metodo_pago.trim()) {
      set({ saving: false, error: "Seleccioná o escribí el método de pago." });
      return false;
    }

    const { error } = await supabase.rpc("registrar_pago_cta_cte", {
      p_origen: item.origen,
      p_origen_id: item.origen_id,
      p_fecha_pago: draft.fecha_pago,
      p_importe: importe,
      p_metodo_pago: draft.metodo_pago.trim(),
      p_caja_id: draft.caja_id || null,
      p_entrega_efectivo: draft.entrega_efectivo,
      p_observaciones: draft.observaciones.trim() || null
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (isSaldoCancelado(nuevoSaldo)) {
      const reactivarRes = await reactivarOperacionSaldada(item);

      if (reactivarRes.error) {
        set({
          saving: false,
          error: normalizeError(reactivarRes.error)
        });
        return false;
      }
    }

    await get().loadPagosForItem(item);
    await get().loadCtasCtes();

    set((state) => ({
      saving: false,
      selectedKey: isSaldoCancelado(nuevoSaldo) ? null : state.selectedKey
    }));

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

  selectItem: (item) => {
    set({ selectedKey: item ? getItemKey(item) : null });

    if (item) {
      void get().loadPagosForItem(item);
    }
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredItems: () => {
    const { items, filters } = get();
    const search = normalizeText(filters.search);

    return items
      .filter((item) => {
        if (filters.origen !== "todos" && item.origen !== filters.origen) return false;
        if (filters.moneda !== "todos" && item.moneda !== filters.moneda) return false;

        if (filters.vendedorId !== "todos" && item.vendedor_id !== filters.vendedorId) {
          return false;
        }

        if (filters.sucursalId !== "todos" && item.sucursal_id !== filters.sucursalId) {
          return false;
        }

        if (search) {
          const haystack = normalizeText(
            [
              item.origen,
              item.numero_operacion,
              item.pasajero,
              item.telefono,
              item.email,
              item.vendedor,
              item.sucursal,
              item.servicio,
              item.destino,
              item.estado,
              item.observaciones
            ].join(" ")
          );

          if (!haystack.includes(search)) return false;
        }

        return true;
      })
      .sort(sortItems);
  },

  getSelectedItem: () => {
    const selectedKey = get().selectedKey;
    const filtered = get().getFilteredItems();

    if (!selectedKey) return filtered[0] || null;

    return filtered.find((item) => getItemKey(item) === selectedKey) || filtered[0] || null;
  },

  getPagosForSelected: () => {
    const selected = get().getSelectedItem();

    if (!selected) return [];

    return get().pagosByOrigen[getItemKey(selected)] || [];
  },

  getPagosForItem: (item) => {
    if (!item) return [];

    return get().pagosByOrigen[getItemKey(item)] || [];
  },

  getMetrics: () => {
    const items = get().getFilteredItems();

    return {
      total: items.length,
      ars: {
        pendiente: items
          .filter((item) => item.moneda === "ARS")
          .reduce((total, item) => total + parseMoney(item.saldo_cta_cte), 0),
        cantidad: items.filter((item) => item.moneda === "ARS").length
      },
      usd: {
        pendiente: items
          .filter((item) => item.moneda === "USD")
          .reduce((total, item) => total + parseMoney(item.saldo_cta_cte), 0),
        cantidad: items.filter((item) => item.moneda === "USD").length
      },
      carritos: items.filter((item) => item.origen === "CARRITO").length,
      files: items.filter((item) => item.origen === "FILE").length
    };
  }
}));

export function createInitialPagoDraft(item?: CtaCteItem | null): PagoCtaCteDraft {
  return {
    fecha_pago: getToday(),
    importe: item ? String(item.saldo_cta_cte || "").replace(".", ",") : "",
    metodo_pago: "",
    caja_id: "",
    entrega_efectivo: false,
    observaciones: ""
  };
}