import { create } from "zustand";
import { supabase } from "../lib/supabase";
import type { MetodoContacto, Profile, Sucursal } from "./configStore";
import {
  type ContactoEstado,
  getMonthStart,
  getToday,
  normalizeText
} from "../components/contactos/contactosUtils";

export type Destino = {
  id: string;
  nombre: string;
  pais: string | null;
  activo: boolean | null;
  veces_usado_total: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Contacto = {
  id: string;
  nombre_completo: string;
  telefono: string;
  origen: string | null;
  destinos: string | null;
  adultos: number | null;
  menores: number | null;
  edad_menores: string | null;
  fecha_viaje: string | null;
  fecha_viaje_out: string | null;
  solo_ida: boolean;
  observaciones: string | null;
  estado: string | null;
  activo: boolean | null;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  created_at: string | null;
  updated_at: string | null;
    proxima_accion: string | null;
  proxima_accion_fecha: string | null;
  ultima_gestion_at: string | null;
  ultima_gestion_por: string | null;
  requiere_recontacto: boolean | null;
};

export type ContactoInput = {
  id?: string;
  nombre_completo: string;
  telefono: string;
  origen?: string | null;
  destinos?: string | null;
  adultos?: number | null;
  menores?: number | null;
  edad_menores?: string | null;
  fecha_viaje?: string | null;
  fecha_viaje_out?: string | null;
  solo_ida?: boolean;
  observaciones?: string | null;
  estado?: ContactoEstado | string | null;
  activo?: boolean;
  vendedor?: string | null;
  vendedor_id?: string | null;
  sucursal_id?: string | null;
    proxima_accion?: string | null;
  proxima_accion_fecha?: string | null;
};

export type ContactosFilters = {
  desde: string;
  hasta: string;
  estado: string;
  origen: string;
  destino: string;
  vendedorId: string;
  sucursalId: string;
  activo: "todos" | "activos" | "inactivos";
  search: string;
};

type ContactosMetrics = {
  total: number;
  nuevos: number;
  contactados: number;
  cotizados: number;
  seguimiento: number;
  postergados: number;
  rechazados: number;
  vendidos: number;
};

type ContactosState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: Profile | null;
  canManageContactos: boolean;

  contactos: Contacto[];
  sucursales: Sucursal[];
  vendedores: Profile[];
  metodosContacto: MetodoContacto[];
  destinos: Destino[];

  filters: ContactosFilters;
  selectedContactoId: string | null;

  loadContactos: () => Promise<void>;
  saveContacto: (input: ContactoInput) => Promise<boolean>;
  createDestino: (input: { nombre: string; pais?: string | null }) => Promise<Destino | null>;
  toggleContactoActivo: (contacto: Contacto) => Promise<boolean>;
  updateContactoEstado: (contacto: Contacto, estado: ContactoEstado) => Promise<boolean>;

  setFilter: <K extends keyof ContactosFilters>(key: K, value: ContactosFilters[K]) => void;
  resetFilters: () => void;

  selectContacto: (id: string | null) => void;
  clearError: () => void;

  getFilteredContactos: () => Contacto[];
  getMetrics: () => ContactosMetrics;
};

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

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function canProfileManageContactos(profile: Profile | null): boolean {
  return Boolean(
    profile?.activo &&
      (
        profile.rol === "admin_general" ||
        profile.rol === "gerencia" ||
        profile.rol === "administracion"
      )
  );
}

function canProfileUseContactos(profile: Profile | null): boolean {
  return Boolean(
    profile?.activo &&
      (
        profile.rol === "admin_general" ||
        profile.rol === "gerencia" ||
        profile.rol === "administracion" ||
        profile.rol === "vendedor"
      )
  );
}

function getDefaultFilters(): ContactosFilters {
  return {
    desde: getMonthStart(),
    hasta: getToday(),
    estado: "todos",
    origen: "todos",
    destino: "",
    vendedorId: "todos",
    sucursalId: "todos",
    activo: "activos",
    search: ""
  };
}

function getDateEndForQuery(value: string): string {
  return `${value}T23:59:59.999-03:00`;
}

function getDateStartForQuery(value: string): string {
  return `${value}T00:00:00.000-03:00`;
}

function normalizeDestinoNombre(nombre: string): string {
  return nombre
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\s+\+/g, " +")
    .replace(/\+\s+/g, "+ ");
}

function buildDestinoText(destinos: string[]): string | null {
  const clean = destinos
    .map((item) => normalizeDestinoNombre(item))
    .filter(Boolean);

  return clean.length ? clean.join(", ") : null;
}

export const useContactosStore = create<ContactosState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageContactos: false,

  contactos: [],
  sucursales: [],
  vendedores: [],
  metodosContacto: [],
  destinos: [],

  filters: getDefaultFilters(),
  selectedContactoId: null,

    loadContactos: async () => {
    set({ loading: true, error: null });

    await supabase.rpc("marcar_contactos_recontacto_48h");

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageContactos: false,
        contactos: [],
        sucursales: [],
        vendedores: [],
        metodosContacto: [],
        destinos: [],
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
        canManageContactos: false,
        contactos: [],
        sucursales: [],
        vendedores: [],
        metodosContacto: [],
        destinos: [],
        error: normalizeError(profileRes.error)
      });

      return;
    }

    const currentProfile = (profileRes.data || null) as Profile | null;
    const canManageContactos = canProfileManageContactos(currentProfile);

    if (!canProfileUseContactos(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageContactos,
        contactos: [],
        sucursales: [],
        vendedores: [],
        metodosContacto: [],
        destinos: [],
        error: "Tu usuario no tiene acceso al módulo Contactos."
      });

      return;
    }

    const filters = get().filters;

   let contactosQuery = supabase
  .from("contactos")
  .select("*")
  .gte("created_at", getDateStartForQuery(filters.desde))
  .lte("created_at", getDateEndForQuery(filters.hasta))
  .order("created_at", { ascending: false });

if (!canManageContactos) {
  contactosQuery = contactosQuery.eq("vendedor_id", currentUserId);
}

if (filters.estado !== "todos") {
  contactosQuery = contactosQuery.eq("estado", filters.estado);
}

if (filters.origen !== "todos") {
  contactosQuery = contactosQuery.eq("origen", filters.origen);
}

if (filters.sucursalId !== "todos") {
  contactosQuery = contactosQuery.eq("sucursal_id", filters.sucursalId);
}

if (filters.vendedorId !== "todos" && canManageContactos) {
  contactosQuery = contactosQuery.eq("vendedor_id", filters.vendedorId);
}

if (filters.activo === "activos") {
  contactosQuery = contactosQuery.eq("activo", true);
}

if (filters.activo === "inactivos") {
  contactosQuery = contactosQuery.eq("activo", false);
}

    const catalogosPromises = [
      supabase.from("metodos_contacto").select("*").eq("activo", true).order("nombre", {
        ascending: true
      }),
      supabase
        .from("destinos")
        .select("*")
        .eq("activo", true)
        .order("veces_usado_total", { ascending: false })
        .order("nombre", { ascending: true })
        .limit(1000)
    ] as const;

    const [contactosRes, metodosContactoRes, destinosRes] = await Promise.all([
      contactosQuery,
      ...catalogosPromises
    ]);

    let sucursales: Sucursal[] = [];
    let vendedores: Profile[] = [];

    if (canManageContactos) {
      const [sucursalesRes, vendedoresRes] = await Promise.all([
        supabase.from("sucursales").select("*").order("nombre", { ascending: true }),
        supabase
          .from("profiles")
          .select("*")
          .in("rol", ["vendedor", "gerencia", "admin_general"])
          .eq("activo", true)
          .order("nombre", { ascending: true })
      ]);

      const adminCatalogError = sucursalesRes.error || vendedoresRes.error;

      if (adminCatalogError) {
        set({
          loading: false,
          currentProfile,
          canManageContactos,
          error: normalizeError(adminCatalogError)
        });

        return;
      }

      sucursales = (sucursalesRes.data || []) as Sucursal[];
      vendedores = (vendedoresRes.data || []) as Profile[];
    } else {
      vendedores = currentProfile ? [currentProfile] : [];
      sucursales = [];
    }

    const firstError = contactosRes.error || metodosContactoRes.error || destinosRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageContactos,
        error: normalizeError(firstError)
      });

      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageContactos,
      contactos: (contactosRes.data || []) as Contacto[],
      sucursales,
      vendedores,
      metodosContacto: (metodosContactoRes.data || []) as MetodoContacto[],
      destinos: (destinosRes.data || []) as Destino[]
    });
  },

  saveContacto: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageContactos } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const vendedorId = canManageContactos ? input.vendedor_id || currentUserId : currentUserId;

    const vendedorProfile = get().vendedores.find((vendedor) => vendedor.id === vendedorId);
    const vendedorNombre = vendedorProfile
      ? `${vendedorProfile.nombre} ${vendedorProfile.apellido}`.trim()
      : `${currentProfile.nombre} ${currentProfile.apellido}`.trim();

    const soloIda = Boolean(input.solo_ida);
const payload = {
  id: input.id,
  nombre_completo: cleanText(input.nombre_completo),
  telefono: cleanText(input.telefono),
  origen: nullableText(input.origen),
  destinos: nullableText(input.destinos),
  adultos: input.adultos ?? 1,
  menores: input.menores ?? 0,
  edad_menores: nullableText(input.edad_menores),
  fecha_viaje: input.fecha_viaje || null,
  fecha_viaje_out: soloIda ? null : input.fecha_viaje_out || null,
  solo_ida: soloIda,
  observaciones: nullableText(input.observaciones),
  estado: input.estado || "NUEVO",
  activo: input.activo ?? true,
  vendedor: vendedorNombre,
  vendedor_id: vendedorId,
  sucursal_id: input.sucursal_id || currentProfile.sucursal_id || null,
  proxima_accion: nullableText(input.proxima_accion),
  proxima_accion_fecha: input.proxima_accion_fecha || null,
  ultima_gestion_at: new Date().toISOString(),
  ultima_gestion_por: currentUserId,
  requiere_recontacto: false
};

    const { error } = await supabase.from("contactos").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadContactos();

    set({ saving: false });
    return true;
  },

  createDestino: async (input) => {
    set({ saving: true, error: null });

    const nombre = normalizeDestinoNombre(input.nombre);
    const pais = nullableText(input.pais) || "Sin especificar";

    if (!nombre) {
      set({ saving: false, error: "Ingresá un nombre de destino válido." });
      return null;
    }

    const existing = get().destinos.find(
      (destino) =>
        normalizeText(destino.nombre) === normalizeText(nombre) &&
        normalizeText(destino.pais || "Sin especificar") === normalizeText(pais)
    );

    if (existing) {
      set({ saving: false });
      return existing;
    }

    const { data, error } = await supabase
      .from("destinos")
      .insert({
        nombre,
        pais,
        activo: true,
        veces_usado_total: 0
      })
      .select("*")
      .single();

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return null;
    }

    const created = data as Destino;

    set((state) => ({
      saving: false,
      destinos: [...state.destinos, created].sort((a, b) => {
        const usageA = a.veces_usado_total || 0;
        const usageB = b.veces_usado_total || 0;

        if (usageA !== usageB) return usageB - usageA;

        return a.nombre.localeCompare(b.nombre);
      })
    }));

    return created;
  },

  toggleContactoActivo: async (contacto) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("contactos")
      .update({
        activo: !contacto.activo
      })
      .eq("id", contacto.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadContactos();

    set({ saving: false });
    return true;
  },

    updateContactoEstado: async (contacto, estado) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    const { error } = await supabase
      .from("contactos")
      .update({
        estado,
        ultima_gestion_at: new Date().toISOString(),
        ultima_gestion_por: currentUserId,
        requiere_recontacto: false
      })
      .eq("id", contacto.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadContactos();

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
    set({
      filters: getDefaultFilters()
    });
  },

  selectContacto: (id) => {
    set({ selectedContactoId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredContactos: () => {
    const { contactos, filters } = get();

    const search = normalizeText(filters.search);
    const destino = normalizeText(filters.destino);

    return contactos.filter((contacto) => {
      if (search) {
        const haystack = normalizeText(
          [
            contacto.nombre_completo,
            contacto.telefono,
            contacto.origen,
            contacto.destinos,
            contacto.vendedor,
            contacto.observaciones
          ].join(" ")
        );

        if (!haystack.includes(search)) return false;
      }

      if (destino) {
        if (!normalizeText(contacto.destinos).includes(destino)) return false;
      }

      return true;
    });
  },

  getMetrics: () => {
    const contactos = get().getFilteredContactos();

    return {
      total: contactos.length,
      nuevos: contactos.filter((item) => item.estado === "NUEVO").length,
      contactados: contactos.filter((item) => item.estado === "CONTACTADO").length,
      cotizados: contactos.filter((item) => item.estado === "COTIZADO").length,
      seguimiento: contactos.filter((item) => item.estado === "SEGUIMIENTO").length,
      postergados: contactos.filter((item) => item.estado === "POSTERGADO").length,
      rechazados: contactos.filter((item) => item.estado === "RECHAZADO").length,
      vendidos: contactos.filter((item) => item.estado === "VENDIDO").length
    };
  }
}));

export function parseDestinosText(value?: string | null): string[] {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function serializeDestinosText(values: string[]): string | null {
  return buildDestinoText(values);
}