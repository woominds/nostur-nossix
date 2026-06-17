import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type AppRole = "vendedor" | "administracion" | "gerencia" | "admin_general";
export type CategoriaTipo = "ingreso" | "egreso";
export type CajaTipo = "CAJA" | "BANCO" | "BILLETERA" | "TARJETA" | "ALMUNDO" | "OTRA";
export type Moneda = "ARS" | "USD";

export type Sucursal = {
  id: string;
  nombre: string;
  color: string;
  activa: boolean;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Profile = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: AppRole;
  color: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type MetodoContacto = {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Destino = {
  id: string;
  nombre: string;
  pais: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type FormaPago = {
  id: string;
  nombre: string;
  impacta_tesoreria: boolean;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Caja = {
  id: string;
  nombre: string;
  activa: boolean;
  activo: boolean;
  moneda: Moneda | string;
  tipo: CajaTipo | string;
  sucursal_id: string | null;
  descripcion: string | null;
  orden: number;
  created_at?: string;
  updated_at?: string;
};

export type CategoriaFinanciera = {
  id: string;
  nombre: string;
  tipo: CategoriaTipo;
  activa: boolean;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Operador = {
  id: string;
  nombre: string;
  color: string;
  razon_social: string | null;
  cuit: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Proveedor = {
  id: string;
  nombre_comercial: string;
  razon_social: string | null;
  cuit: string | null;
  telefono: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type Servicio = {
  id: string;
  nombre: string;
  color: string;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
};

export type HotelMaestroImagen = {
  id?: string;
  url: string;
  description?: string;
};

export type HotelMaestro = {
  id: string;
  nombre: string;
  ubicacion: string | null;
  categoria: number | null;
  descripcion: string | null;
  imagenes: HotelMaestroImagen[] | null;
  regimen: string | null;
  tipo_habitacion: string | null;
  tipo_tarifa: string | null;
  cargos_adicionales: boolean;
  descripcion_cargos: string | null;
  veces_usado: number;
  ultimo_uso: string | null;
  activo: boolean;
  created_at?: string;
  updated_at?: string;
  created_by?: string | null;
};

export type UserCredential = {
  id: string;
  user_id: string;
  service_key: string;
  username: string | null;
  password_encrypted: string | null;
  autofill_enabled: boolean;
  auto_submit_enabled: boolean;
  created_at?: string;
  updated_at?: string;
};

type ConfigState = {
  loading: boolean;
  saving: boolean;
  error: string | null;
  currentProfile: Profile | null;
  canManageConfig: boolean;

  sucursales: Sucursal[];
  profiles: Profile[];
  metodosContacto: MetodoContacto[];
  destinos: Destino[];
  formasPago: FormaPago[];
  cajas: Caja[];
  categoriasFinancieras: CategoriaFinanciera[];
  operadores: Operador[];
  proveedores: Proveedor[];
  servicios: Servicio[];
  hotelesMaestros: HotelMaestro[];
  userCredentials: UserCredential[];

  loadConfig: () => Promise<void>;

  upsertSucursal: (input: Partial<Sucursal> & { nombre: string }) => Promise<boolean>;
  upsertProfile: (
    input: Partial<Profile> & {
      id: string;
      nombre: string;
      apellido: string;
      email: string;
      rol: AppRole;
    }
  ) => Promise<boolean>;
  upsertMetodoContacto: (input: Partial<MetodoContacto> & { nombre: string }) => Promise<boolean>;
  upsertDestino: (input: Partial<Destino> & { nombre: string; pais: string }) => Promise<boolean>;
  upsertFormaPago: (input: Partial<FormaPago> & { nombre: string }) => Promise<boolean>;
  upsertCaja: (input: Partial<Caja> & { nombre: string }) => Promise<boolean>;
  upsertCategoriaFinanciera: (
    input: Partial<CategoriaFinanciera> & {
      nombre: string;
      tipo: CategoriaTipo;
    }
  ) => Promise<boolean>;
  upsertOperador: (input: Partial<Operador> & { nombre: string }) => Promise<boolean>;
  upsertProveedor: (input: Partial<Proveedor> & { nombre_comercial: string }) => Promise<boolean>;
  upsertServicio: (input: Partial<Servicio> & { nombre: string }) => Promise<boolean>;
  upsertHotelMaestro: (input: Partial<HotelMaestro> & { nombre: string }) => Promise<boolean>;
  upsertUserCredential: (
    input: Partial<UserCredential> & {
      service_key: string;
      username?: string | null;
      password_encrypted?: string | null;
    }
  ) => Promise<boolean>;

  toggleSucursal: (item: Sucursal) => Promise<boolean>;
  toggleProfile: (item: Profile) => Promise<boolean>;
  toggleMetodoContacto: (item: MetodoContacto) => Promise<boolean>;
  toggleDestino: (item: Destino) => Promise<boolean>;
  toggleFormaPago: (item: FormaPago) => Promise<boolean>;
  toggleCaja: (item: Caja) => Promise<boolean>;
  toggleCategoriaFinanciera: (item: CategoriaFinanciera) => Promise<boolean>;
  toggleOperador: (item: Operador) => Promise<boolean>;
  toggleProveedor: (item: Proveedor) => Promise<boolean>;
  toggleServicio: (item: Servicio) => Promise<boolean>;
  toggleHotelMaestro: (item: HotelMaestro) => Promise<boolean>;
  toggleUserCredentialAutofill: (item: UserCredential) => Promise<boolean>;

  deleteUserCredential: (id: string) => Promise<boolean>;

  clearError: () => void;
};

function normalizeError(error: unknown): string {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "Ocurrió un error.");

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para esta acción. Revisá que tu usuario sea gerencia o admin_general.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("relation") && message.toLowerCase().includes("does not exist")) {
      return "Falta crear una tabla en Supabase. Revisá que exista hoteles_maestros y las demás tablas de configuración.";
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

function cleanNumber(value: unknown, fallback = 100): number {
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".");

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return fallback;

  return parsed;
}

function cleanNullableNumber(value: unknown): number | null {
  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!normalized) return null;

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function cleanBoolean(value: unknown, fallback = true): boolean {
  if (typeof value === "boolean") return value;

  const clean = cleanText(value).toLowerCase();

  if (!clean) return fallback;

  if (["true", "1", "si", "sí", "activo", "activa", "yes"].includes(clean)) return true;
  if (["false", "0", "no", "inactivo", "inactiva"].includes(clean)) return false;

  return fallback;
}

function normalizeCajaTipo(value: unknown): CajaTipo {
  const clean = cleanText(value).toUpperCase();

  if (clean === "BANCO") return "BANCO";
  if (clean === "BILLETERA") return "BILLETERA";
  if (clean === "TARJETA") return "TARJETA";
  if (clean === "ALMUNDO") return "ALMUNDO";
  if (clean === "OTRA") return "OTRA";

  return "CAJA";
}

function normalizeMoneda(value: unknown): Moneda {
  const clean = cleanText(value).toUpperCase();

  if (clean === "USD") return "USD";

  return "ARS";
}

function normalizeHotelImagenes(value: unknown): HotelMaestroImagen[] {
  if (Array.isArray(value)) {
    return value.filter((item) => item && typeof item === "object") as HotelMaestroImagen[];
  }

  if (!value) return [];

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);

      if (Array.isArray(parsed)) {
        return parsed.filter((item) => item && typeof item === "object") as HotelMaestroImagen[];
      }

      if (parsed && typeof parsed === "object") {
        return [parsed as HotelMaestroImagen];
      }
    } catch {
      return [];
    }
  }

  if (typeof value === "object") {
    return [value as HotelMaestroImagen];
  }

  return [];
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileManageConfig(profile: Profile | null): boolean {
  return Boolean(
    profile?.activo && (profile.rol === "admin_general" || profile.rol === "gerencia")
  );
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,
  currentProfile: null,
  canManageConfig: false,

  sucursales: [],
  profiles: [],
  metodosContacto: [],
  destinos: [],
  formasPago: [],
  cajas: [],
  categoriasFinancieras: [],
  operadores: [],
  proveedores: [],
  servicios: [],
  hotelesMaestros: [],
  userCredentials: [],

  loadConfig: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageConfig: false,
        userCredentials: [],
        error: "No hay usuario autenticado."
      });

      return;
    }

    const ownProfileRes = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .maybeSingle();

    if (ownProfileRes.error) {
      set({
        loading: false,
        currentProfile: null,
        canManageConfig: false,
        error: normalizeError(ownProfileRes.error)
      });

      return;
    }

    const currentProfile = (ownProfileRes.data || null) as Profile | null;
    const canManageConfig = canProfileManageConfig(currentProfile);

    if (!canManageConfig) {
      const userCredentialsRes = await supabase
        .from("user_credentials")
        .select("*")
        .eq("user_id", currentUserId)
        .order("service_key", { ascending: true });

      if (userCredentialsRes.error) {
        set({
          loading: false,
          currentProfile,
          canManageConfig: false,
          error: normalizeError(userCredentialsRes.error)
        });

        return;
      }

      set({
        loading: false,
        error: null,
        currentProfile,
        canManageConfig: false,
        sucursales: [],
        profiles: [],
        metodosContacto: [],
        destinos: [],
        formasPago: [],
        cajas: [],
        categoriasFinancieras: [],
        operadores: [],
        proveedores: [],
        servicios: [],
        hotelesMaestros: [],
        userCredentials: (userCredentialsRes.data || []) as UserCredential[]
      });

      return;
    }

    const [
      sucursalesRes,
      profilesRes,
      metodosContactoRes,
      destinosRes,
      formasPagoRes,
      cajasRes,
      categoriasFinancierasRes,
      operadoresRes,
      proveedoresRes,
      serviciosRes,
      hotelesMaestrosRes,
      userCredentialsRes
    ] = await Promise.all([
      supabase.from("sucursales").select("*").order("nombre", { ascending: true }),
      supabase.from("profiles").select("*").order("nombre", { ascending: true }),
      supabase.from("metodos_contacto").select("*").order("nombre", { ascending: true }),
      supabase.from("destinos").select("*").order("nombre", { ascending: true }),
      supabase.from("formas_pago").select("*").order("nombre", { ascending: true }),
      supabase.from("cajas").select("*").order("orden", { ascending: true }).order("nombre", { ascending: true }),
      supabase.from("categorias_financieras").select("*").order("nombre", { ascending: true }),
      supabase.from("operadores").select("*").order("nombre", { ascending: true }),
      supabase.from("proveedores").select("*").order("nombre_comercial", { ascending: true }),
      supabase.from("servicios").select("*").order("nombre", { ascending: true }),
      supabase.from("hoteles_maestros").select("*").order("nombre", { ascending: true }),
      supabase.from("user_credentials").select("*").order("service_key", { ascending: true })
    ]);

    const firstError =
      sucursalesRes.error ||
      profilesRes.error ||
      metodosContactoRes.error ||
      destinosRes.error ||
      formasPagoRes.error ||
      cajasRes.error ||
      categoriasFinancierasRes.error ||
      operadoresRes.error ||
      proveedoresRes.error ||
      serviciosRes.error ||
      hotelesMaestrosRes.error ||
      userCredentialsRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageConfig,
        error: normalizeError(firstError)
      });

      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageConfig,
      sucursales: (sucursalesRes.data || []) as Sucursal[],
      profiles: (profilesRes.data || []) as Profile[],
      metodosContacto: (metodosContactoRes.data || []) as MetodoContacto[],
      destinos: (destinosRes.data || []) as Destino[],
      formasPago: (formasPagoRes.data || []) as FormaPago[],
      cajas: (cajasRes.data || []) as Caja[],
      categoriasFinancieras: (categoriasFinancierasRes.data || []) as CategoriaFinanciera[],
      operadores: (operadoresRes.data || []) as Operador[],
      proveedores: (proveedoresRes.data || []) as Proveedor[],
      servicios: (serviciosRes.data || []) as Servicio[],
      hotelesMaestros: (hotelesMaestrosRes.data || []) as HotelMaestro[],
      userCredentials: (userCredentialsRes.data || []) as UserCredential[]
    });
  },

  upsertSucursal: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      color: input.color || "#FF6A00",
      activa: input.activa ?? input.activo ?? true,
      activo: input.activo ?? input.activa ?? true
    };

    const { error } = await supabase.from("sucursales").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertProfile: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      apellido: cleanText(input.apellido),
      email: cleanText(input.email),
      sucursal_id: input.sucursal_id || null,
      rol: input.rol,
      color: input.color || "#FF6A00",
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("profiles").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertMetodoContacto: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      color: input.color || "#FF6A00",
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("metodos_contacto").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertDestino: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      pais: cleanText(input.pais) || "Sin especificar",
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("destinos").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertFormaPago: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      impacta_tesoreria: input.impacta_tesoreria ?? true,
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("formas_pago").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertCaja: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      activa: input.activa ?? input.activo ?? true,
      activo: input.activo ?? input.activa ?? true,
      moneda: normalizeMoneda(input.moneda),
      tipo: normalizeCajaTipo(input.tipo),
      sucursal_id: input.sucursal_id || null,
      descripcion: nullableText(input.descripcion),
      orden: cleanNumber(input.orden, 100)
    };

    const { error } = await supabase.from("cajas").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertCategoriaFinanciera: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      tipo: input.tipo,
      activa: input.activa ?? input.activo ?? true,
      activo: input.activo ?? input.activa ?? true
    };

    const { error } = await supabase.from("categorias_financieras").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertOperador: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      color: input.color || "#FF6A00",
      razon_social: nullableText(input.razon_social),
      cuit: nullableText(input.cuit),
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("operadores").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertProveedor: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre_comercial: cleanText(input.nombre_comercial),
      razon_social: nullableText(input.razon_social),
      cuit: nullableText(input.cuit),
      telefono: nullableText(input.telefono),
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("proveedores").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertServicio: async (input) => {
    set({ saving: true, error: null });

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      color: input.color || "#FF6A00",
      activo: input.activo ?? true
    };

    const { error } = await supabase.from("servicios").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertHotelMaestro: async (input) => {
    set({ saving: true, error: null });

    const userId = await getCurrentUserId();

    const payload = {
      id: input.id,
      nombre: cleanText(input.nombre),
      ubicacion: nullableText(input.ubicacion),
      categoria: cleanNullableNumber(input.categoria),
      descripcion: nullableText(input.descripcion),
      imagenes: normalizeHotelImagenes(input.imagenes),
      regimen: nullableText(input.regimen),
      tipo_habitacion: nullableText(input.tipo_habitacion),
      tipo_tarifa: nullableText(input.tipo_tarifa),
      cargos_adicionales: cleanBoolean(input.cargos_adicionales, false),
      descripcion_cargos: nullableText(input.descripcion_cargos),
      veces_usado: cleanNumber(input.veces_usado, 0),
      ultimo_uso: input.ultimo_uso || null,
      activo: input.activo ?? true,
      created_by: input.created_by || userId
    };

    const { error } = await supabase.from("hoteles_maestros").upsert(payload);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  upsertUserCredential: async (input) => {
    set({ saving: true, error: null });

    const userId = await getCurrentUserId();

    if (!userId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const serviceKey = cleanText(input.service_key);

    if (!serviceKey) {
      set({ saving: false, error: "Falta indicar el aplicativo de la credencial." });
      return false;
    }

    const payload = {
      user_id: userId,
      service_key: serviceKey,
      username: nullableText(input.username),
      password_encrypted: nullableText(input.password_encrypted),
      autofill_enabled: input.autofill_enabled ?? true,
      auto_submit_enabled: input.auto_submit_enabled ?? false,
      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("user_credentials")
      .upsert(payload, {
        onConflict: "user_id,service_key"
      });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  toggleSucursal: async (item) => {
    return get().upsertSucursal({
      ...item,
      activa: !item.activa,
      activo: !item.activo
    });
  },

  toggleProfile: async (item) => {
    return get().upsertProfile({
      ...item,
      activo: !item.activo
    });
  },

  toggleMetodoContacto: async (item) => {
    return get().upsertMetodoContacto({
      ...item,
      activo: !item.activo
    });
  },

  toggleDestino: async (item) => {
    return get().upsertDestino({
      ...item,
      activo: !item.activo
    });
  },

  toggleFormaPago: async (item) => {
    return get().upsertFormaPago({
      ...item,
      activo: !item.activo
    });
  },

  toggleCaja: async (item) => {
    return get().upsertCaja({
      ...item,
      activa: !item.activa,
      activo: !item.activo
    });
  },

  toggleCategoriaFinanciera: async (item) => {
    return get().upsertCategoriaFinanciera({
      ...item,
      activa: !item.activa,
      activo: !item.activo
    });
  },

  toggleOperador: async (item) => {
    return get().upsertOperador({
      ...item,
      activo: !item.activo
    });
  },

  toggleProveedor: async (item) => {
    return get().upsertProveedor({
      ...item,
      activo: !item.activo
    });
  },

  toggleServicio: async (item) => {
    return get().upsertServicio({
      ...item,
      activo: !item.activo
    });
  },

  toggleHotelMaestro: async (item) => {
    return get().upsertHotelMaestro({
      ...item,
      activo: !item.activo
    });
  },

  toggleUserCredentialAutofill: async (item) => {
    return get().upsertUserCredential({
      ...item,
      autofill_enabled: !item.autofill_enabled
    });
  },

  deleteUserCredential: async (id) => {
    set({ saving: true, error: null });

    const { error } = await supabase.from("user_credentials").delete().eq("id", id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadConfig();
    set({ saving: false });
    return true;
  },

  clearError: () => {
    set({ error: null });
  }
}));