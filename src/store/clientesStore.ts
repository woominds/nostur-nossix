import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { MetodoContacto, Profile, Sucursal } from "./configStore";

export type Cliente = {
  id: string;
  nombre_completo: string;
  telefono: string;
  email: string | null;
  origen: string | null;
  contacto_id: string | null;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type Carrito = {
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
};

export type ClienteConCarritos = Cliente & {
  carritos: Carrito[];
};

export type ClienteInput = {
  id?: string;
  nombre_completo: string;
  telefono: string;
  email?: string | null;
  origen?: string | null;
  contacto_id?: string | null;
  vendedor?: string | null;
  vendedor_id?: string | null;
  sucursal_id?: string | null;
  activo?: boolean;
};

export type CarritoInput = {
  id?: string;
  cliente_id: string;
  contacto_id?: string | null;
  numero_carrito: string;
  fecha_venta: string;
  servicio?: string | null;
  metodo_contacto?: string | null;
  forma_pago?: string | null;
  destino?: string | null;
  fecha_in?: string | null;
  fecha_out?: string | null;
  solo_ida?: boolean;
  importe?: number;
  moneda?: string;
  estado?: string;
  observaciones?: string | null;
  vendedor?: string | null;
  vendedor_id?: string | null;
  sucursal_id?: string | null;
};

export type ClientesFilters = {
  desde: string;
  hasta: string;
  vendedorId: string;
  sucursalId: string;
  activo: "todos" | "activos" | "inactivos";
  search: string;
};

type ClientesMetrics = {
  clientes: number;
  activos: number;
  conCarritos: number;
  carritos: number;
  totalHistorico: number;
  ticketPromedio: number;
};

type ClientesState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: Profile | null;
  canManageClientes: boolean;

  clientes: Cliente[];
  carritos: Carrito[];
  sucursales: Sucursal[];
  vendedores: Profile[];
  metodosContacto: MetodoContacto[];

  filters: ClientesFilters;
  selectedClienteId: string | null;

  loadClientes: () => Promise<void>;
  saveCliente: (input: ClienteInput) => Promise<boolean>;
  saveCarrito: (input: CarritoInput) => Promise<boolean>;
  toggleClienteActivo: (cliente: Cliente) => Promise<boolean>;
  toggleCarritoActivo: (carrito: Carrito) => Promise<boolean>;

  setFilter: <K extends keyof ClientesFilters>(key: K, value: ClientesFilters[K]) => void;
  resetFilters: () => void;

  selectCliente: (id: string | null) => void;
  clearError: () => void;

  getClientesConCarritos: () => ClienteConCarritos[];
  getFilteredClientes: () => ClienteConCarritos[];
  getMetrics: () => ClientesMetrics;
};

export function normalizeClienteText(value: unknown): string {
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

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

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

function getDateEndForQuery(value: string): string {
  return `${value}T23:59:59.999-03:00`;
}

function getDateStartForQuery(value: string): string {
  return `${value}T00:00:00.000-03:00`;
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileManageClientes(profile: Profile | null): boolean {
  return Boolean(
    profile?.activo && (profile.rol === "admin_general" || profile.rol === "gerencia")
  );
}

function canProfileUseClientes(profile: Profile | null): boolean {
  return Boolean(
    profile?.activo &&
      (profile.rol === "admin_general" || profile.rol === "gerencia" || profile.rol === "vendedor")
  );
}

function getDefaultFilters(): ClientesFilters {
  return {
    desde: getMonthStart(),
    hasta: getToday(),
    vendedorId: "todos",
    sucursalId: "todos",
    activo: "activos",
    search: ""
  };
}

function getImporteNumber(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const useClientesStore = create<ClientesState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageClientes: false,

  clientes: [],
  carritos: [],
  sucursales: [],
  vendedores: [],
  metodosContacto: [],

  filters: getDefaultFilters(),
  selectedClienteId: null,

  loadClientes: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageClientes: false,
        clientes: [],
        carritos: [],
        sucursales: [],
        vendedores: [],
        metodosContacto: [],
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
        currentProfile: null,
        canManageClientes: false,
        clientes: [],
        carritos: [],
        sucursales: [],
        vendedores: [],
        metodosContacto: [],
        error: normalizeError(profileRes.error)
      });

      return;
    }

    const currentProfile = (profileRes.data || null) as Profile | null;
    const canManageClientes = canProfileManageClientes(currentProfile);

    if (!canProfileUseClientes(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageClientes,
        clientes: [],
        carritos: [],
        sucursales: [],
        vendedores: [],
        metodosContacto: [],
        error: "Tu usuario no tiene acceso al módulo Clientes."
      });

      return;
    }

    const filters = get().filters;

    let clientesQuery = supabase
      .from("clientes")
      .select("*")
      .gte("created_at", getDateStartForQuery(filters.desde))
      .lte("created_at", getDateEndForQuery(filters.hasta))
      .order("created_at", { ascending: false });

    if (!canManageClientes) {
      clientesQuery = clientesQuery.eq("vendedor_id", currentUserId);
    }

    if (filters.sucursalId !== "todos") {
      clientesQuery = clientesQuery.eq("sucursal_id", filters.sucursalId);
    }

    if (filters.vendedorId !== "todos" && canManageClientes) {
      clientesQuery = clientesQuery.eq("vendedor_id", filters.vendedorId);
    }

    if (filters.activo === "activos") {
      clientesQuery = clientesQuery.eq("activo", true);
    }

    if (filters.activo === "inactivos") {
      clientesQuery = clientesQuery.eq("activo", false);
    }

    const [clientesRes, metodosContactoRes] = await Promise.all([
      clientesQuery,
      supabase.from("metodos_contacto").select("*").eq("activo", true).order("nombre", {
        ascending: true
      })
    ]);

    if (clientesRes.error || metodosContactoRes.error) {
      set({
        loading: false,
        currentProfile,
        canManageClientes,
        error: normalizeError(clientesRes.error || metodosContactoRes.error)
      });

      return;
    }

    const clientes = (clientesRes.data || []) as Cliente[];
    const clienteIds = clientes.map((cliente) => cliente.id);

    let carritos: Carrito[] = [];

    if (clienteIds.length > 0) {
      const carritosRes = await supabase
        .from("carritos")
        .select("*")
        .in("cliente_id", clienteIds)
        .order("fecha_venta", { ascending: false });

      if (carritosRes.error) {
        set({
          loading: false,
          currentProfile,
          canManageClientes,
          error: normalizeError(carritosRes.error)
        });

        return;
      }

      carritos = (carritosRes.data || []) as Carrito[];
    }

    let sucursales: Sucursal[] = [];
    let vendedores: Profile[] = [];

    if (canManageClientes) {
      const [sucursalesRes, vendedoresRes] = await Promise.all([
        supabase.from("sucursales").select("*").order("nombre", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .in("rol", ["vendedor", "gerencia", "admin_general"])
          .eq("activo", true)
          .order("nombre", { ascending: true })
      ]);

      const catalogError = sucursalesRes.error || vendedoresRes.error;

      if (catalogError) {
        set({
          loading: false,
          currentProfile,
          canManageClientes,
          error: normalizeError(catalogError)
        });

        return;
      }

      sucursales = (sucursalesRes.data || []) as Sucursal[];
      vendedores = (vendedoresRes.data || []) as Profile[];
    } else {
      vendedores = currentProfile ? [currentProfile] : [];
      sucursales = [];
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageClientes,
      clientes,
      carritos,
      sucursales,
      vendedores,
      metodosContacto: (metodosContactoRes.data || []) as MetodoContacto[]
    });
  },

  saveCliente: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageClientes } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const vendedorId = canManageClientes ? input.vendedor_id || currentUserId : currentUserId;

    const vendedorProfile = get().vendedores.find((vendedor) => vendedor.id === vendedorId);
    const vendedorNombre = vendedorProfile
      ? `${vendedorProfile.nombre} ${vendedorProfile.apellido}`.trim()
      : `${currentProfile.nombre} ${currentProfile.apellido}`.trim();

    const payload = {
      id: input.id,
      nombre_completo: cleanText(input.nombre_completo),
      telefono: cleanText(input.telefono),
      email: nullableText(input.email),
      origen: nullableText(input.origen),
      contacto_id: input.contacto_id || null,
      vendedor: vendedorNombre,
      vendedor_id: vendedorId,
      sucursal_id: input.sucursal_id || currentProfile.sucursal_id || null,
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("clientes").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadClientes();

    set({ saving: false });
    return true;
  },

  saveCarrito: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageClientes } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const vendedorId = canManageClientes ? input.vendedor_id || currentUserId : currentUserId;

    const vendedorProfile = get().vendedores.find((vendedor) => vendedor.id === vendedorId);
    const vendedorNombre = vendedorProfile
      ? `${vendedorProfile.nombre} ${vendedorProfile.apellido}`.trim()
      : `${currentProfile.nombre} ${currentProfile.apellido}`.trim();

    const soloIda = Boolean(input.solo_ida);

    const payload = {
      id: input.id,
      cliente_id: input.cliente_id,
      contacto_id: input.contacto_id || null,
      numero_carrito: cleanText(input.numero_carrito),
      fecha_venta: input.fecha_venta || getToday(),
      servicio: nullableText(input.servicio),
      metodo_contacto: nullableText(input.metodo_contacto),
      forma_pago: nullableText(input.forma_pago),
      destino: nullableText(input.destino),
      fecha_in: input.fecha_in || null,
      fecha_out: soloIda ? null : input.fecha_out || null,
      solo_ida: soloIda,
      importe: input.importe ?? 0,
      moneda: input.moneda || "ARS",
      estado: input.estado || "NUEVO",
      observaciones: nullableText(input.observaciones),
      vendedor: vendedorNombre,
      vendedor_id: vendedorId,
      sucursal_id: input.sucursal_id || currentProfile.sucursal_id || null,
      activo: true
    };

    const { error } = await supabase.from("carritos").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadClientes();

    set({ saving: false });
    return true;
  },

  toggleClienteActivo: async (cliente) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("clientes")
      .update({ activo: !cliente.activo })
      .eq("id", cliente.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadClientes();

    set({ saving: false });
    return true;
  },

  toggleCarritoActivo: async (carrito) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("carritos")
      .update({ activo: !carrito.activo })
      .eq("id", carrito.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadClientes();

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

  selectCliente: (id) => {
    set({ selectedClienteId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getClientesConCarritos: () => {
    const { clientes, carritos } = get();

    return clientes.map((cliente) => ({
      ...cliente,
      carritos: carritos.filter((carrito) => carrito.cliente_id === cliente.id)
    }));
  },

  getFilteredClientes: () => {
    const { filters } = get();
    const search = normalizeClienteText(filters.search);

    return get().getClientesConCarritos().filter((cliente) => {
      if (!search) return true;

      const haystack = normalizeClienteText(
        [
          cliente.nombre_completo,
          cliente.telefono,
          cliente.email,
          cliente.origen,
          cliente.vendedor,
          ...cliente.carritos.flatMap((carrito) => [
            carrito.numero_carrito,
            carrito.destino,
            carrito.servicio,
            carrito.forma_pago,
            carrito.estado
          ])
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getMetrics: () => {
    const clientes = get().getFilteredClientes();
    const carritos = clientes.flatMap((cliente) => cliente.carritos);
    const totalHistorico = carritos.reduce(
      (total, carrito) => total + getImporteNumber(carrito.importe),
      0
    );

    return {
      clientes: clientes.length,
      activos: clientes.filter((cliente) => cliente.activo).length,
      conCarritos: clientes.filter((cliente) => cliente.carritos.length > 0).length,
      carritos: carritos.length,
      totalHistorico,
      ticketPromedio: carritos.length > 0 ? totalHistorico / carritos.length : 0
    };
  }
}));