import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type PrioridadPendiente = "BAJA" | "MEDIA" | "ALTA" | "URGENTE";

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

export type Pendiente = {
  id: string;
  titulo: string;
  descripcion: string | null;
  prioridad: PrioridadPendiente;
  resuelto: boolean;
  resuelto_at: string | null;
  resuelto_by: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  nombre: string | null;
  apellido: string | null;
  vendedor: string | null;
  sucursal: string | null;
  prioridad_orden: number;
};

export type PendienteDraft = {
  titulo: string;
  descripcion: string;
  prioridad: PrioridadPendiente;
};

export type PendientesFilters = {
  estado: "todos" | "abiertos" | "resueltos";
  prioridad: "todos" | PrioridadPendiente;
  vendedorId: string;
  search: string;
};

type PendientesMetrics = {
  total: number;
  abiertos: number;
  resueltos: number;
  urgentes: number;
  altas: number;
};

type PendientesState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManagePendientes: boolean;

  pendientes: Pendiente[];

  catalogos: {
    vendedores: VendedorLite[];
  };

  filters: PendientesFilters;

  loadPendientes: () => Promise<void>;
  createPendiente: (draft: PendienteDraft) => Promise<boolean>;
  updatePendiente: (pendiente: Pendiente, draft: PendienteDraft) => Promise<boolean>;
  resolvePendiente: (pendiente: Pendiente) => Promise<boolean>;
  reopenPendiente: (pendiente: Pendiente) => Promise<boolean>;
  deletePendiente: (pendiente: Pendiente) => Promise<boolean>;

  setFilter: <K extends keyof PendientesFilters>(key: K, value: PendientesFilters[K]) => void;
  resetFilters: () => void;
  clearError: () => void;

  getPendientesFiltrados: () => Pendiente[];
  getMetrics: () => PendientesMetrics;
};

function getDefaultFilters(): PendientesFilters {
  return {
    estado: "abiertos",
    prioridad: "todos",
    vendedorId: "todos",
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

function normalizeError(error: unknown): string {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "Ocurrió un error.");
    if (message.toLowerCase().includes("row-level security")) return "No tenés permisos para esta acción.";
    if (message.toLowerCase().includes("permission denied")) return "Permiso denegado por Supabase/RLS.";
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

function sortPendientes(a: Pendiente, b: Pendiente): number {
  if (a.resuelto !== b.resuelto) return a.resuelto ? 1 : -1;

  if (!a.resuelto && !b.resuelto) {
    const prioridadDiff = (a.prioridad_orden || 99) - (b.prioridad_orden || 99);
    if (prioridadDiff !== 0) return prioridadDiff;
  }

  const aDate = new Date(a.resuelto ? a.resuelto_at || a.updated_at : a.created_at).getTime();
  const bDate = new Date(b.resuelto ? b.resuelto_at || b.updated_at : b.created_at).getTime();

  return bDate - aDate;
}

export const usePendientesStore = create<PendientesState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManagePendientes: false,

  pendientes: [],

  catalogos: {
    vendedores: []
  },

  filters: getDefaultFilters(),

  loadPendientes: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManagePendientes: false,
        pendientes: [],
        catalogos: {
          vendedores: []
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
    const canManagePendientes = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManagePendientes,
        pendientes: [],
        catalogos: {
          vendedores: []
        },
        error: "Tu usuario no tiene acceso al módulo Pendientes."
      });
      return;
    }

    let pendientesQuery = supabase
      .from("vw_pendientes_visibles")
      .select("*")
      .order("resuelto", { ascending: true })
      .order("prioridad_orden", { ascending: true })
      .order("created_at", { ascending: false });

    if (!canManagePendientes) {
      pendientesQuery = pendientesQuery.eq("vendedor_id", currentUserId);
    }

    const vendedoresQuery = supabase
      .from("profiles")
      .select("id, nombre, apellido, email, activo")
      .eq("activo", true)
      .order("nombre", { ascending: true });

    const [pendientesRes, vendedoresRes] = await Promise.all([
      pendientesQuery,
      canManagePendientes ? vendedoresQuery : Promise.resolve({ data: [], error: null })
    ]);

    const firstError = pendientesRes.error || vendedoresRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManagePendientes,
        error: normalizeError(firstError)
      });
      return;
    }

    const pendientes = ((pendientesRes.data || []) as Pendiente[]).sort(sortPendientes);

    set({
      loading: false,
      error: null,
      currentProfile,
      canManagePendientes,
      pendientes,
      catalogos: {
        vendedores: (vendedoresRes.data || []) as VendedorLite[]
      }
    });
  },

  createPendiente: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const profile = get().currentProfile;

    if (!draft.titulo.trim()) {
      set({ saving: false, error: "Escribí el pendiente." });
      return false;
    }

    const payload = {
      titulo: draft.titulo.trim(),
      descripcion: draft.descripcion.trim() || null,
      prioridad: draft.prioridad,
      resuelto: false,
      resuelto_at: null,
      resuelto_by: null,
      vendedor_id: currentUserId,
      sucursal_id: profile?.sucursal_id || null,
      created_by: currentUserId,
      updated_by: currentUserId
    };

    const { error } = await supabase.from("pendientes").insert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadPendientes();

    set({ saving: false });
    return true;
  },

  updatePendiente: async (pendiente, draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.titulo.trim()) {
      set({ saving: false, error: "Escribí el pendiente." });
      return false;
    }

    const { error } = await supabase
      .from("pendientes")
      .update({
        titulo: draft.titulo.trim(),
        descripcion: draft.descripcion.trim() || null,
        prioridad: draft.prioridad,
        updated_by: currentUserId
      })
      .eq("id", pendiente.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadPendientes();

    set({ saving: false });
    return true;
  },

  resolvePendiente: async (pendiente) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const { error } = await supabase
      .from("pendientes")
      .update({
        resuelto: true,
        resuelto_at: new Date().toISOString(),
        resuelto_by: currentUserId,
        updated_by: currentUserId
      })
      .eq("id", pendiente.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadPendientes();

    set({ saving: false });
    return true;
  },

  reopenPendiente: async (pendiente) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const { error } = await supabase
      .from("pendientes")
      .update({
        resuelto: false,
        resuelto_at: null,
        resuelto_by: null,
        updated_by: currentUserId
      })
      .eq("id", pendiente.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadPendientes();

    set({ saving: false });
    return true;
  },

  deletePendiente: async (pendiente) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("pendientes")
      .delete()
      .eq("id", pendiente.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadPendientes();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters() });
  },

  clearError: () => {
    set({ error: null });
  },

  getPendientesFiltrados: () => {
    const { pendientes, filters } = get();
    const search = normalizeText(filters.search);

    return pendientes
      .filter((pendiente) => {
        if (filters.estado === "abiertos" && pendiente.resuelto) return false;
        if (filters.estado === "resueltos" && !pendiente.resuelto) return false;
        if (filters.prioridad !== "todos" && pendiente.prioridad !== filters.prioridad) return false;
        if (filters.vendedorId !== "todos" && pendiente.vendedor_id !== filters.vendedorId) return false;

        if (search) {
          const haystack = normalizeText([
            pendiente.titulo,
            pendiente.descripcion,
            pendiente.prioridad,
            pendiente.vendedor,
            pendiente.sucursal
          ].join(" "));

          if (!haystack.includes(search)) return false;
        }

        return true;
      })
      .sort(sortPendientes);
  },

  getMetrics: () => {
    const pendientes = get().pendientes;

    return {
      total: pendientes.length,
      abiertos: pendientes.filter((item) => !item.resuelto).length,
      resueltos: pendientes.filter((item) => item.resuelto).length,
      urgentes: pendientes.filter((item) => !item.resuelto && item.prioridad === "URGENTE").length,
      altas: pendientes.filter((item) => !item.resuelto && item.prioridad === "ALTA").length
    };
  }
}));