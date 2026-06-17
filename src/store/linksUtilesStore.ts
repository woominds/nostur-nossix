import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type LinksUtilesTab = "links" | "cuentas" | "accesos";

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

export type LinkUtil = {
  id: string;
  herramienta: string;
  url: string;
  observaciones: string | null;
  activo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CuentaBancariaUtil = {
  id: string;
  banco: string;
  cbu: string | null;
  alias: string | null;
  cuit: string | null;
  titular_cuenta: string;
  observaciones: string | null;
  activo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AccesoRestringido = {
  id: string;
  titulo: string;
  url: string | null;
  usuario: string | null;
  password: string | null;
  observaciones: string | null;
  activo: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type LinkUtilDraft = {
  herramienta: string;
  url: string;
  observaciones: string;
};

export type CuentaBancariaDraft = {
  banco: string;
  cbu: string;
  alias: string;
  cuit: string;
  titular_cuenta: string;
  observaciones: string;
};

export type AccesoDraft = {
  titulo: string;
  url: string;
  usuario: string;
  password: string;
  observaciones: string;
};

export type LinksUtilesFilters = {
  search: string;
};

type LinksUtilesState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageLinksUtiles: boolean;

  links: LinkUtil[];
  cuentas: CuentaBancariaUtil[];
  accesos: AccesoRestringido[];

  filters: LinksUtilesFilters;

  loadLinksUtiles: () => Promise<void>;

  createLink: (draft: LinkUtilDraft) => Promise<boolean>;
  updateLink: (item: LinkUtil, draft: LinkUtilDraft) => Promise<boolean>;
  deleteLink: (item: LinkUtil) => Promise<boolean>;

  createCuenta: (draft: CuentaBancariaDraft) => Promise<boolean>;
  updateCuenta: (item: CuentaBancariaUtil, draft: CuentaBancariaDraft) => Promise<boolean>;
  deleteCuenta: (item: CuentaBancariaUtil) => Promise<boolean>;

  createAcceso: (draft: AccesoDraft) => Promise<boolean>;
  updateAcceso: (item: AccesoRestringido, draft: AccesoDraft) => Promise<boolean>;
  deleteAcceso: (item: AccesoRestringido) => Promise<boolean>;

  setFilter: <K extends keyof LinksUtilesFilters>(key: K, value: LinksUtilesFilters[K]) => void;
  clearError: () => void;

  getFilteredLinks: () => LinkUtil[];
  getFilteredCuentas: () => CuentaBancariaUtil[];
  getFilteredAccesos: () => AccesoRestringido[];
};

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
  return Boolean(profile?.activo);
}

function normalizeUrl(value: string): string {
  const clean = value.trim();
  if (!clean) return "";
  if (/^https?:\/\//i.test(clean)) return clean;
  return `https://${clean}`;
}

export const useLinksUtilesStore = create<LinksUtilesState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageLinksUtiles: false,

  links: [],
  cuentas: [],
  accesos: [],

  filters: {
    search: ""
  },

  loadLinksUtiles: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageLinksUtiles: false,
        links: [],
        cuentas: [],
        accesos: [],
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
    const canManageLinksUtiles = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageLinksUtiles,
        links: [],
        cuentas: [],
        accesos: [],
        error: "Tu usuario no tiene acceso al módulo Links útiles."
      });
      return;
    }

    const [linksRes, cuentasRes, accesosRes] = await Promise.all([
      supabase.from("links_utiles").select("*").eq("activo", true).order("herramienta"),
      supabase.from("cuentas_bancarias_utiles").select("*").eq("activo", true).order("banco"),
      canManageLinksUtiles
        ? supabase.from("accesos_restringidos").select("*").eq("activo", true).order("titulo")
        : Promise.resolve({ data: [], error: null })
    ]);

    const firstError = linksRes.error || cuentasRes.error || accesosRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageLinksUtiles,
        error: normalizeError(firstError)
      });
      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageLinksUtiles,
      links: (linksRes.data || []) as LinkUtil[],
      cuentas: (cuentasRes.data || []) as CuentaBancariaUtil[],
      accesos: (accesosRes.data || []) as AccesoRestringido[]
    });
  },

  createLink: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.herramienta.trim()) {
      set({ saving: false, error: "Ingresá la herramienta." });
      return false;
    }

    if (!draft.url.trim()) {
      set({ saving: false, error: "Ingresá la URL." });
      return false;
    }

    const { error } = await supabase.from("links_utiles").insert({
      herramienta: draft.herramienta.trim(),
      url: normalizeUrl(draft.url),
      observaciones: draft.observaciones.trim() || null,
      activo: true,
      created_by: currentUserId,
      updated_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  updateLink: async (item, draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.herramienta.trim()) {
      set({ saving: false, error: "Ingresá la herramienta." });
      return false;
    }

    if (!draft.url.trim()) {
      set({ saving: false, error: "Ingresá la URL." });
      return false;
    }

    const { error } = await supabase
      .from("links_utiles")
      .update({
        herramienta: draft.herramienta.trim(),
        url: normalizeUrl(draft.url),
        observaciones: draft.observaciones.trim() || null,
        updated_by: currentUserId
      })
      .eq("id", item.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  deleteLink: async (item) => {
    set({ saving: true, error: null });

    const { error } = await supabase.from("links_utiles").delete().eq("id", item.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  createCuenta: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.banco.trim()) {
      set({ saving: false, error: "Ingresá el banco." });
      return false;
    }

    if (!draft.titular_cuenta.trim()) {
      set({ saving: false, error: "Ingresá el titular de la cuenta." });
      return false;
    }

    const { error } = await supabase.from("cuentas_bancarias_utiles").insert({
      banco: draft.banco.trim(),
      cbu: draft.cbu.trim() || null,
      alias: draft.alias.trim() || null,
      cuit: draft.cuit.trim() || null,
      titular_cuenta: draft.titular_cuenta.trim(),
      observaciones: draft.observaciones.trim() || null,
      activo: true,
      created_by: currentUserId,
      updated_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  updateCuenta: async (item, draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.banco.trim()) {
      set({ saving: false, error: "Ingresá el banco." });
      return false;
    }

    if (!draft.titular_cuenta.trim()) {
      set({ saving: false, error: "Ingresá el titular de la cuenta." });
      return false;
    }

    const { error } = await supabase
      .from("cuentas_bancarias_utiles")
      .update({
        banco: draft.banco.trim(),
        cbu: draft.cbu.trim() || null,
        alias: draft.alias.trim() || null,
        cuit: draft.cuit.trim() || null,
        titular_cuenta: draft.titular_cuenta.trim(),
        observaciones: draft.observaciones.trim() || null,
        updated_by: currentUserId
      })
      .eq("id", item.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  deleteCuenta: async (item) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("cuentas_bancarias_utiles")
      .delete()
      .eq("id", item.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  createAcceso: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.titulo.trim()) {
      set({ saving: false, error: "Ingresá el título." });
      return false;
    }

    const { error } = await supabase.from("accesos_restringidos").insert({
      titulo: draft.titulo.trim(),
      url: draft.url.trim() ? normalizeUrl(draft.url) : null,
      usuario: draft.usuario.trim() || null,
      password: draft.password.trim() || null,
      observaciones: draft.observaciones.trim() || null,
      activo: true,
      created_by: currentUserId,
      updated_by: currentUserId
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  updateAcceso: async (item, draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.titulo.trim()) {
      set({ saving: false, error: "Ingresá el título." });
      return false;
    }

    const { error } = await supabase
      .from("accesos_restringidos")
      .update({
        titulo: draft.titulo.trim(),
        url: draft.url.trim() ? normalizeUrl(draft.url) : null,
        usuario: draft.usuario.trim() || null,
        password: draft.password.trim() || null,
        observaciones: draft.observaciones.trim() || null,
        updated_by: currentUserId
      })
      .eq("id", item.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  deleteAcceso: async (item) => {
    set({ saving: true, error: null });

    const { error } = await supabase.from("accesos_restringidos").delete().eq("id", item.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadLinksUtiles();
    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => ({ filters: { ...state.filters, [key]: value } }));
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredLinks: () => {
    const { links, filters } = get();
    const search = normalizeText(filters.search);

    return links.filter((item) => {
      if (!search) return true;

      const haystack = normalizeText([
        item.herramienta,
        item.url,
        item.observaciones
      ].join(" "));

      return haystack.includes(search);
    });
  },

  getFilteredCuentas: () => {
    const { cuentas, filters } = get();
    const search = normalizeText(filters.search);

    return cuentas.filter((item) => {
      if (!search) return true;

      const haystack = normalizeText([
        item.banco,
        item.cbu,
        item.alias,
        item.cuit,
        item.titular_cuenta,
        item.observaciones
      ].join(" "));

      return haystack.includes(search);
    });
  },

  getFilteredAccesos: () => {
    const { accesos, filters } = get();
    const search = normalizeText(filters.search);

    return accesos.filter((item) => {
      if (!search) return true;

      const haystack = normalizeText([
        item.titulo,
        item.url,
        item.usuario,
        item.observaciones
      ].join(" "));

      return haystack.includes(search);
    });
  }
}));