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
  is_support_user?: boolean | null;
  is_super_admin?: boolean | null;
};

export type CatalogItem = {
  id: string;
  nombre: string;
  color?: string;
  activo?: boolean;
  pais?: string;
  impacta_tesoreria?: boolean;
  activa?: boolean;
};

export type Caja = {
  id: string;
  nombre: string;
  moneda?: string;
  tipo?: string;
  sucursal_id?: string | null;
  activa?: boolean;
  activo?: boolean;
};

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

  importe_bruto?: string | number;
  promocode_aplicado?: boolean;
  promocode_importe?: string | number;
  importe_final?: string | number;
  pago_parcial?: boolean;
  fecha_ingreso_gastos?: string | null;
  total_pagado?: string | number;
  saldo_cta_cte?: string | number;
  visible_en_carritos?: boolean;
  fecha_visible_carritos?: string | null;
  riesgo?: boolean;
  importe_riesgo?: string | number;
  riesgo_motivo?: string | null;
  riesgo_resuelto?: boolean;
  riesgo_resuelto_at?: string | null;
  riesgo_resuelto_by?: string | null;
  riesgo_observaciones?: string | null;
confirmado_vendedor?: boolean;
confirmado_at?: string | null;
enviado_control_at?: string | null;

derivado_control?: boolean;
controlado?: boolean;
controlado_at?: string | null;
controlado_by?: string | null;
facturado?: boolean;
cobrado?: boolean;

clientes?: Cliente | null;
};

export type PagoComercial = {
  id?: string;
  carrito_id?: string;
  forma_pago_id?: string | null;
  forma_pago?: string | null;
  importe: number;
  moneda: string;
};

export type MovimientoTesoreria = {
  id?: string;
  carrito_id?: string;
  caja_id?: string | null;
  caja?: string | null;
  forma_pago_id?: string | null;
  forma_pago?: string | null;
  importe: number;
  moneda: string;
  tipo_cambio?: number | null;
  moneda_equivalente?: string | null;
  importe_equivalente?: number | null;
  fecha_movimiento?: string | null;
};

export type ClienteDraft = {
  id?: string;
  nombre_completo: string;
  telefono: string;
  email?: string | null;
  origen?: string | null;
  vendedor_id?: string | null;
  sucursal_id?: string | null;
};

export type CarritoWizardInput = {
  cliente: ClienteDraft;
  carrito: {
    contacto_id?: string | null;
    numero_carrito: string;
    fecha_venta: string;
    servicio_id?: string | null;
    servicio?: string | null;
    metodo_contacto?: string | null;
    destino?: string | null;
    fecha_in?: string | null;
    fecha_out?: string | null;
    solo_ida?: boolean;
    importe_bruto: number;
    moneda: string;
    promocode_aplicado: boolean;
    promocode_importe: number;
    importe_final: number;
    pago_parcial: boolean;
    fecha_ingreso_gastos?: string | null;
    total_pagado: number;
    saldo_cta_cte: number;
    visible_en_carritos: boolean;
    riesgo: boolean;
    importe_riesgo?: number;
    riesgo_motivo?: string | null;
    confirmado_vendedor: boolean;
    observaciones?: string | null;
    vendedor_id?: string | null;
    sucursal_id?: string | null;
  };
  pagosComerciales: PagoComercial[];
  movimientosTesoreria: MovimientoTesoreria[];
};

export type CarritoMobileUpdateInput = {
  carritoId: string;
  cliente?: {
    id?: string;
    nombre_completo?: string;
    telefono?: string;
    email?: string | null;
    origen?: string | null;
  };
  carrito: {
    numero_carrito?: string;
    fecha_venta?: string;
    servicio_id?: string | null;
    servicio?: string | null;
    metodo_contacto?: string | null;
    destino?: string | null;
    fecha_in?: string | null;
    fecha_out?: string | null;
    solo_ida?: boolean;
    importe_bruto?: number;
    moneda?: string;
    promocode_aplicado?: boolean;
    promocode_importe?: number;
    importe_final?: number;
    pago_parcial?: boolean;
    fecha_ingreso_gastos?: string | null;
    total_pagado?: number;
    saldo_cta_cte?: number;
    visible_en_carritos?: boolean;
    riesgo?: boolean;
    importe_riesgo?: number;
    riesgo_motivo?: string | null;
    estado?: string;
    observaciones?: string | null;
    vendedor_id?: string | null;
    sucursal_id?: string | null;
    activo?: boolean;
  };
  pagosComerciales: PagoComercial[];
  movimientosTesoreria: MovimientoTesoreria[];
};

export type CarritosFilters = {
  periodMode: "mes" | "rango";
  month: string;
  desde: string;
  hasta: string;
  estado: string;
  vendedorId: string;
  sucursalId: string;
  riesgo: "todos" | "riesgo" | "normal";
  activo: "todos" | "activos" | "inactivos";
  search: string;
};

type CarritosMetrics = {
  carritos: number;
  totalVenta: number;
  totalPagado: number;
  saldo: number;
  riesgos: number;
  cargados: number;
  enControl: number;
  controlados: number;
};

type CarritosState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

 currentProfile: ProfileLite | null;
canManageCarritos: boolean;

  carritos: Carrito[];
  pagosComerciales: PagoComercial[];
  movimientosTesoreria: MovimientoTesoreria[];

  clientesSearch: Cliente[];

  catalogos: {
    metodosContacto: CatalogItem[];
    destinos: CatalogItem[];
    servicios: CatalogItem[];
    formasPago: CatalogItem[];
    cajas: Caja[];
    vendedores: ProfileLite[];
    sucursales: CatalogItem[];
  };

  filters: CarritosFilters;
  selectedCarritoId: string | null;

  loadCarritos: () => Promise<void>;
  searchClientesByPhone: (telefono: string) => Promise<void>;
  createDestinoInline: (nombre: string, pais?: string) => Promise<string | null>;
  saveCarritoWizard: (input: CarritoWizardInput) => Promise<boolean>;

  loadCarritoPagos: (carritoId: string) => Promise<PagoComercial[]>;
  loadCarritoMovimientos: (carritoId: string) => Promise<MovimientoTesoreria[]>;
  updateCarritoMobile: (input: CarritoMobileUpdateInput) => Promise<boolean>;

  toggleCarritoActivo: (carrito: Carrito) => Promise<boolean>;
  sendToControl: (carrito: Carrito) => Promise<boolean>;

  setFilter: <K extends keyof CarritosFilters>(key: K, value: CarritosFilters[K]) => void;
  setMonthFilter: (month: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  resetFilters: () => void;
  selectCarrito: (id: string | null) => void;
  clearError: () => void;

  getFilteredCarritos: () => Carrito[];
  getMetrics: () => CarritosMetrics;
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

function getCurrentMonth(): string {
  return getToday().slice(0, 7);
}

function getMonthRange(month: string): { desde: string; hasta: string } {
  const [yearRaw, monthRaw] = month.split("-");
  const year = Number(yearRaw);
  const monthIndex = Number(monthRaw) - 1;

  if (!Number.isFinite(year) || !Number.isFinite(monthIndex)) {
    const today = getToday();
    return {
      desde: `${today.slice(0, 8)}01`,
      hasta: today
    };
  }

  const firstDay = new Date(year, monthIndex, 1);
  const lastDay = new Date(year, monthIndex + 1, 0);

  const desde = [
    firstDay.getFullYear(),
    String(firstDay.getMonth() + 1).padStart(2, "0"),
    String(firstDay.getDate()).padStart(2, "0")
  ].join("-");

  const hasta = [
    lastDay.getFullYear(),
    String(lastDay.getMonth() + 1).padStart(2, "0"),
    String(lastDay.getDate()).padStart(2, "0")
  ].join("-");

  return { desde, hasta };
}

function addMonthsToMonth(month: string, amount: number): string {
  const [yearRaw, monthRaw] = month.split("-");
  const date = new Date(Number(yearRaw), Number(monthRaw) - 1 + amount, 1);

  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getDefaultFilters(): CarritosFilters {
  const month = getCurrentMonth();
  const range = getMonthRange(month);

  return {
    periodMode: "mes",
    month,
    desde: range.desde,
    hasta: range.hasta,
    estado: "todos",
    vendedorId: "todos",
    sucursalId: "todos",
    riesgo: "todos",
    activo: "activos",
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

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function normalizePhone(value: string): string {
  return value.replace(/[^\d+]/g, "");
}

function getNumber(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileManage(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      (profile.is_super_admin ||
        profile.is_support_user ||
        profile.rol === "admin_general" ||
        profile.rol === "gerencia" ||
        profile.rol === "administracion" ||
        profile.rol === "soporte")
  );
}

function canProfileUse(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      (profile.is_super_admin ||
        profile.is_support_user ||
        profile.rol === "admin_general" ||
        profile.rol === "gerencia" ||
        profile.rol === "administracion" ||
        profile.rol === "soporte" ||
        profile.rol === "vendedor")
  );
}

function getProfileName(profile: ProfileLite | null): string {
  return profile ? `${profile.nombre} ${profile.apellido}`.trim() : "";
}

async function fetchByCarritoIdsInBatches<T>(
  tableName: string,
  carritoIds: string[],
  batchSize = 80
): Promise<{ data: T[]; error: unknown | null }> {
  if (carritoIds.length === 0) {
    return { data: [], error: null };
  }

  const allRows: T[] = [];

  for (let index = 0; index < carritoIds.length; index += batchSize) {
    const batch = carritoIds.slice(index, index + batchSize);

    const { data, error } = await supabase
      .from(tableName)
      .select("*")
      .in("carrito_id", batch);

    if (error) {
      return { data: [], error };
    }

    allRows.push(...((data || []) as T[]));
  }

  return { data: allRows, error: null };
}

function calculateMobileTotals(input: CarritoMobileUpdateInput) {
  const importeBruto = getNumber(input.carrito.importe_bruto);
  const promocodeAplicado = Boolean(input.carrito.promocode_aplicado);
  const promocodeImporte = promocodeAplicado ? getNumber(input.carrito.promocode_importe) : 0;
  const importeFinal =
    input.carrito.importe_final !== undefined
      ? getNumber(input.carrito.importe_final)
      : Math.max(0, importeBruto - promocodeImporte);

  const totalTesoreria = input.movimientosTesoreria.reduce(
    (total, movimiento) => total + getNumber(movimiento.importe),
    0
  );

  const saldoCtaCte =
    input.carrito.saldo_cta_cte !== undefined
      ? getNumber(input.carrito.saldo_cta_cte)
      : Math.max(0, importeFinal - totalTesoreria);

  const pagoParcial =
    input.carrito.pago_parcial !== undefined
      ? Boolean(input.carrito.pago_parcial)
      : saldoCtaCte > 0.009;

  const visibleEnCarritos =
    input.carrito.visible_en_carritos !== undefined
      ? Boolean(input.carrito.visible_en_carritos)
      : true;

  return {
    importeBruto,
    promocodeAplicado,
    promocodeImporte,
    importeFinal,
    totalTesoreria,
    saldoCtaCte,
    pagoParcial,
    visibleEnCarritos
  };
}

export const useCarritosStore = create<CarritosState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

currentProfile: null,
canManageCarritos: false,


  carritos: [],
  pagosComerciales: [],
  movimientosTesoreria: [],

  clientesSearch: [],

  catalogos: {
    metodosContacto: [],
    destinos: [],
    servicios: [],
    formasPago: [],
    cajas: [],
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedCarritoId: null,

  loadCarritos: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageCarritos: false,
        carritos: [],
        pagosComerciales: [],
        movimientosTesoreria: [],
        clientesSearch: [],
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
        error: normalizeError(profileRes.error)
      });

      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManageCarritos = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageCarritos,
        carritos: [],
        pagosComerciales: [],
        movimientosTesoreria: [],
        clientesSearch: [],
        error: "Tu usuario no tiene acceso al módulo Carritos."
      });

      return;
    }

    const effectiveFilters = get().filters;

const periodRange =
  effectiveFilters.periodMode === "mes"
    ? getMonthRange(effectiveFilters.month)
    : {
        desde: effectiveFilters.desde,
        hasta: effectiveFilters.hasta
      };

let carritosQuery = supabase
  .from("carritos")
  .select("*, clientes(*)")
  .gte("fecha_venta", periodRange.desde)
  .lte("fecha_venta", periodRange.hasta)
  .order("fecha_venta", { ascending: false })
  .order("created_at", { ascending: false });

if (effectiveFilters.estado !== "todos") {
  carritosQuery = carritosQuery.eq("estado", effectiveFilters.estado);
}

if (effectiveFilters.vendedorId !== "todos") {
  carritosQuery = carritosQuery.eq("vendedor_id", effectiveFilters.vendedorId);
}

  

  if (effectiveFilters.sucursalId !== "todos") {
  carritosQuery = carritosQuery.eq("sucursal_id", effectiveFilters.sucursalId);
}

if (effectiveFilters.riesgo === "riesgo") {
  carritosQuery = carritosQuery.eq("riesgo", true);
}

if (effectiveFilters.riesgo === "normal") {
  carritosQuery = carritosQuery.eq("riesgo", false);
}

if (effectiveFilters.activo === "activos") {
  carritosQuery = carritosQuery.eq("activo", true);
}

if (effectiveFilters.activo === "inactivos") {
  carritosQuery = carritosQuery.eq("activo", false);
}

    const [
      carritosRes,
      metodosRes,
      destinosRes,
      serviciosRes,
      formasPagoRes,
      cajasRes,
      sucursalesRes,
      vendedoresRes
    ] = await Promise.all([
      carritosQuery,
      supabase.from("metodos_contacto").select("*").eq("activo", true).order("nombre"),
      supabase.from("destinos").select("*").eq("activo", true).order("nombre"),
      supabase.from("servicios").select("*").eq("activo", true).order("nombre"),
      supabase.from("formas_pago").select("*").eq("activo", true).order("nombre"),
      supabase.from("cajas").select("*").or("activo.eq.true,activa.eq.true").order("orden"),
      supabase.from("sucursales").select("*").order("nombre"),
      supabase
        .from("profiles")
        .select("*")
  .in("rol", ["vendedor", "administracion", "gerencia", "admin_general"])
          .eq("activo", true)
        .order("nombre")
    ]);

    const firstError =
      carritosRes.error ||
      metodosRes.error ||
      destinosRes.error ||
      serviciosRes.error ||
      formasPagoRes.error ||
      cajasRes.error ||
      sucursalesRes.error ||
      vendedoresRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageCarritos,
        error: normalizeError(firstError)
      });

      return;
    }

    const carritos = (carritosRes.data || []) as Carrito[];
    const carritoIds = carritos.map((carrito) => carrito.id);

    const pagosRes = await fetchByCarritoIdsInBatches<PagoComercial>(
      "carrito_pagos_comerciales",
      carritoIds
    );

    if (pagosRes.error) {
      set({
        loading: false,
        currentProfile,
        canManageCarritos,
        error: normalizeError(pagosRes.error)
      });

      return;
    }

    const movimientosRes = await fetchByCarritoIdsInBatches<MovimientoTesoreria>(
      "carrito_movimientos_tesoreria",
      carritoIds
    );

    if (movimientosRes.error) {
      set({
        loading: false,
        currentProfile,
        canManageCarritos,
        error: normalizeError(movimientosRes.error)
      });

      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageCarritos,
      carritos,
      pagosComerciales: pagosRes.data,
      movimientosTesoreria: movimientosRes.data,
      catalogos: {
        metodosContacto: (metodosRes.data || []) as CatalogItem[],
        destinos: (destinosRes.data || []) as CatalogItem[],
        servicios: (serviciosRes.data || []) as CatalogItem[],
        formasPago: (formasPagoRes.data || []) as CatalogItem[],
        cajas: (cajasRes.data || []) as Caja[],
        sucursales: (sucursalesRes.data || []) as CatalogItem[],
        vendedores: (vendedoresRes.data || []) as ProfileLite[]
      }
    });
  },

  searchClientesByPhone: async (telefono) => {
    const normalized = normalizePhone(telefono);
    const digits = normalized.replace(/\D/g, "");

    if (digits.length < 3) {
      set({ clientesSearch: [] });
      return;
    }

    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .ilike("telefono", `%${digits}%`)
      .limit(10);

    if (error) {
      set({ error: normalizeError(error) });
      return;
    }

    set({ clientesSearch: (data || []) as Cliente[] });
  },

  createDestinoInline: async (nombre, pais = "Sin especificar") => {
    const cleanNombre = cleanText(nombre);
    const cleanPais = cleanText(pais) || "Sin especificar";

    if (!cleanNombre) {
      set({ error: "Ingresá un destino válido." });
      return null;
    }

    const existing = get().catalogos.destinos.find(
      (destino) =>
        normalizeText(destino.nombre) === normalizeText(cleanNombre) &&
        normalizeText(destino.pais || "Sin especificar") === normalizeText(cleanPais)
    );

    if (existing) return existing.nombre;

    const { data, error } = await supabase
      .from("destinos")
      .insert({
        nombre: cleanNombre,
        pais: cleanPais,
        activo: true,
        veces_usado_total: 0
      })
      .select("*")
      .single();

    if (error) {
      set({ error: normalizeError(error) });
      return null;
    }

    const created = data as CatalogItem;

    set((state) => ({
      catalogos: {
        ...state.catalogos,
        destinos: [...state.catalogos.destinos, created].sort((a, b) =>
          a.nombre.localeCompare(b.nombre)
        )
      }
    }));

    return created.nombre;
  },

  saveCarritoWizard: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageCarritos } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!input.carrito.confirmado_vendedor) {
      set({ saving: false, error: "El vendedor debe confirmar que los datos son correctos." });
      return false;
    }

    const vaACuentaCorriente =
      Boolean(input.carrito.pago_parcial) && getNumber(input.carrito.saldo_cta_cte) > 0.009;

    if (vaACuentaCorriente && !input.carrito.fecha_ingreso_gastos) {
      set({
        saving: false,
        error: "Completá la fecha de ingreso a gastos para enviar el carrito a cuenta corriente."
      });
      return false;
    }

    const vendedorId = canManageCarritos
      ? input.carrito.vendedor_id || input.cliente.vendedor_id || currentUserId
      : currentUserId;

    const vendedorProfile = get().catalogos.vendedores.find(
      (vendedor) => vendedor.id === vendedorId
    );

    const vendedorNombre = vendedorProfile
      ? getProfileName(vendedorProfile)
      : getProfileName(currentProfile);

    const sucursalId =
      input.carrito.sucursal_id ||
      input.cliente.sucursal_id ||
      currentProfile.sucursal_id ||
      null;

    let clienteId = input.cliente.id || null;

    if (!clienteId) {
      const clientePayload = {
        nombre_completo: cleanText(input.cliente.nombre_completo),
        telefono: cleanText(input.cliente.telefono),
        email: nullableText(input.cliente.email),
        origen: nullableText(input.cliente.origen),
        vendedor: vendedorNombre,
        vendedor_id: vendedorId,
        sucursal_id: sucursalId,
        activo: true
      };

      const clienteRes = await supabase.from("clientes").insert(clientePayload).select("id").single();

      if (clienteRes.error) {
        set({ saving: false, error: normalizeError(clienteRes.error) });
        return false;
      }

      clienteId = clienteRes.data.id;
    }

    const now = new Date().toISOString();
    const importeRiesgo = getNumber(input.carrito.importe_riesgo);

    const carritoPayload = {
      cliente_id: clienteId,
      contacto_id: input.carrito.contacto_id || null,
      numero_carrito: cleanText(input.carrito.numero_carrito),
      fecha_venta: input.carrito.fecha_venta || getToday(),

      servicio_id: input.carrito.servicio_id || null,
      servicio: nullableText(input.carrito.servicio),
      metodo_contacto: nullableText(input.carrito.metodo_contacto),
      destino: nullableText(input.carrito.destino),

      fecha_in: input.carrito.fecha_in || null,
      fecha_out: input.carrito.solo_ida ? null : input.carrito.fecha_out || null,
      solo_ida: Boolean(input.carrito.solo_ida),

      importe: input.carrito.importe_final,
      moneda: input.carrito.moneda || "ARS",

      importe_bruto: input.carrito.importe_bruto,
      promocode_aplicado: Boolean(input.carrito.promocode_aplicado),
      promocode_importe: input.carrito.promocode_importe || 0,
      importe_final: input.carrito.importe_final,
      pago_parcial: vaACuentaCorriente,
      fecha_ingreso_gastos: vaACuentaCorriente ? input.carrito.fecha_ingreso_gastos || null : null,
      total_pagado: input.carrito.total_pagado,
      saldo_cta_cte: input.carrito.saldo_cta_cte,

      visible_en_carritos: Boolean(input.carrito.visible_en_carritos),
      fecha_visible_carritos: input.carrito.visible_en_carritos ? getToday() : null,

      riesgo: Boolean(input.carrito.riesgo),
      importe_riesgo: Boolean(input.carrito.riesgo) ? importeRiesgo : 0,
      riesgo_motivo: nullableText(input.carrito.riesgo_motivo),
      riesgo_resuelto: false,
      riesgo_observaciones: null,

   confirmado_vendedor: true,
confirmado_at: now,
derivado_control: input.carrito.visible_en_carritos ? true : false,
enviado_control_at: input.carrito.visible_en_carritos ? now : null,

estado: input.carrito.visible_en_carritos ? "EN_CONTROL" : "CTA_CTE",
      observaciones: nullableText(input.carrito.observaciones),
      vendedor: vendedorNombre,
      vendedor_id: vendedorId,
      sucursal_id: sucursalId,
      activo: true
    };

    const carritoRes = await supabase.from("carritos").insert(carritoPayload).select("id").single();

    if (carritoRes.error) {
      set({ saving: false, error: normalizeError(carritoRes.error) });
      return false;
    }

    const carritoId = carritoRes.data.id;

    const pagosPayload = input.pagosComerciales
      .filter((pago) => getNumber(pago.importe) > 0)
      .map((pago) => ({
        carrito_id: carritoId,
        forma_pago_id: pago.forma_pago_id || null,
        forma_pago: nullableText(pago.forma_pago),
        importe: pago.importe || 0,
        moneda: pago.moneda || input.carrito.moneda || "ARS"
      }));

    if (pagosPayload.length > 0) {
      const pagosRes = await supabase.from("carrito_pagos_comerciales").insert(pagosPayload);

      if (pagosRes.error) {
        set({ saving: false, error: normalizeError(pagosRes.error) });
        return false;
      }
    }

    const movimientosPayload = input.movimientosTesoreria
      .filter((movimiento) => getNumber(movimiento.importe) > 0)
      .map((movimiento) => ({
        carrito_id: carritoId,
        caja_id: movimiento.caja_id || null,
        caja: nullableText(movimiento.caja),
        forma_pago_id: movimiento.forma_pago_id || null,
        forma_pago: nullableText(movimiento.forma_pago),
        importe: movimiento.importe || 0,
        moneda: movimiento.moneda || input.carrito.moneda || "ARS",
        tipo_cambio: movimiento.tipo_cambio || null,
        moneda_equivalente: movimiento.moneda_equivalente || null,
        importe_equivalente: movimiento.importe_equivalente || null
      }));

    if (movimientosPayload.length > 0) {
      const movimientosRes = await supabase
        .from("carrito_movimientos_tesoreria")
        .insert(movimientosPayload);

      if (movimientosRes.error) {
        set({ saving: false, error: normalizeError(movimientosRes.error) });
        return false;
      }
    }

    if (input.carrito.riesgo) {
      const riesgoRes = await supabase.from("carrito_riesgos").insert({
        carrito_id: carritoId,
        importe_riesgo: importeRiesgo,
        moneda: input.carrito.moneda || "ARS",
        motivo: nullableText(input.carrito.riesgo_motivo),
        estado: "PENDIENTE",
        created_by: currentUserId
      });

      if (riesgoRes.error) {
        set({ saving: false, error: normalizeError(riesgoRes.error) });
        return false;
      }
    }

    await get().loadCarritos();

    set({ saving: false, clientesSearch: [] });
    return true;
  },

  loadCarritoPagos: async (carritoId) => {
    set({ error: null });

    const { data, error } = await supabase
      .from("carrito_pagos_comerciales")
      .select("*")
      .eq("carrito_id", carritoId)
      .order("created_at", { ascending: true });

    if (error) {
      set({ error: normalizeError(error) });
      return [];
    }

    return (data || []) as PagoComercial[];
  },

  loadCarritoMovimientos: async (carritoId) => {
    set({ error: null });

    const { data, error } = await supabase
      .from("carrito_movimientos_tesoreria")
      .select("*")
      .eq("carrito_id", carritoId)
      .order("created_at", { ascending: true });

    if (error) {
      set({ error: normalizeError(error) });
      return [];
    }

    return (data || []) as MovimientoTesoreria[];
  },

  updateCarritoMobile: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageCarritos, catalogos } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const carritoActual = get().carritos.find((item) => item.id === input.carritoId) || null;

    if (!carritoActual) {
      set({ saving: false, error: "No encontramos el carrito seleccionado." });
      return false;
    }

   

    const totals = calculateMobileTotals(input);

    if (totals.importeFinal <= 0) {
      set({ saving: false, error: "El importe final debe ser mayor a cero." });
      return false;
    }

    if (totals.pagoParcial && totals.saldoCtaCte > 0.009 && !input.carrito.fecha_ingreso_gastos) {
      set({
        saving: false,
        error: "Completá la fecha de ingreso a gastos para el saldo pendiente."
      });
      return false;
    }

    const vendedorId = canManageCarritos
      ? input.carrito.vendedor_id || carritoActual.vendedor_id || currentUserId
      : carritoActual.vendedor_id || currentUserId;

    const vendedorProfile = catalogos.vendedores.find((profile) => profile.id === vendedorId);
    const vendedorNombre = vendedorProfile
      ? getProfileName(vendedorProfile)
      : carritoActual.vendedor || getProfileName(currentProfile);

    const sucursalId =
      input.carrito.sucursal_id !== undefined
        ? input.carrito.sucursal_id
        : carritoActual.sucursal_id || currentProfile.sucursal_id || null;

    if (input.cliente?.id || carritoActual.cliente_id) {
      const clienteId = input.cliente?.id || carritoActual.cliente_id;

      const clientePayload: Record<string, unknown> = {};

      if (input.cliente?.nombre_completo !== undefined) {
        clientePayload.nombre_completo = cleanText(input.cliente.nombre_completo);
      }

      if (input.cliente?.telefono !== undefined) {
        clientePayload.telefono = cleanText(input.cliente.telefono);
      }

      if (input.cliente?.email !== undefined) {
        clientePayload.email = nullableText(input.cliente.email);
      }

      if (input.cliente?.origen !== undefined) {
        clientePayload.origen = nullableText(input.cliente.origen);
      }

      if (Object.keys(clientePayload).length > 0) {
        const clienteRes = await supabase.from("clientes").update(clientePayload).eq("id", clienteId);

        if (clienteRes.error) {
          set({ saving: false, error: normalizeError(clienteRes.error) });
          return false;
        }
      }
    }

    const now = new Date().toISOString();

    const carritoPayload = {
      numero_carrito: cleanText(input.carrito.numero_carrito || carritoActual.numero_carrito),
      fecha_venta: input.carrito.fecha_venta || carritoActual.fecha_venta || getToday(),

      servicio_id:
        input.carrito.servicio_id !== undefined ? input.carrito.servicio_id : carritoActual.servicio_id,
      servicio: nullableText(
        input.carrito.servicio !== undefined ? input.carrito.servicio : carritoActual.servicio
      ),
      metodo_contacto: nullableText(
        input.carrito.metodo_contacto !== undefined
          ? input.carrito.metodo_contacto
          : carritoActual.metodo_contacto
      ),
      destino: nullableText(
        input.carrito.destino !== undefined ? input.carrito.destino : carritoActual.destino
      ),

      fecha_in:
        input.carrito.fecha_in !== undefined ? input.carrito.fecha_in : carritoActual.fecha_in,
      fecha_out: input.carrito.solo_ida
        ? null
        : input.carrito.fecha_out !== undefined
          ? input.carrito.fecha_out
          : carritoActual.fecha_out,
      solo_ida:
        input.carrito.solo_ida !== undefined ? Boolean(input.carrito.solo_ida) : carritoActual.solo_ida,

      importe: totals.importeFinal,
      moneda: input.carrito.moneda || carritoActual.moneda || "ARS",
      importe_bruto: totals.importeBruto,
      promocode_aplicado: totals.promocodeAplicado,
      promocode_importe: totals.promocodeImporte,
      importe_final: totals.importeFinal,

      pago_parcial: totals.pagoParcial,
      fecha_ingreso_gastos:
        totals.pagoParcial && totals.saldoCtaCte > 0.009
          ? input.carrito.fecha_ingreso_gastos || carritoActual.fecha_ingreso_gastos || null
          : null,
      total_pagado: totals.totalTesoreria,
      saldo_cta_cte: totals.saldoCtaCte,

      visible_en_carritos: totals.visibleEnCarritos,
      fecha_visible_carritos: totals.visibleEnCarritos
        ? carritoActual.fecha_visible_carritos || getToday()
        : null,

      riesgo:
        input.carrito.riesgo !== undefined ? Boolean(input.carrito.riesgo) : Boolean(carritoActual.riesgo),
      importe_riesgo: input.carrito.riesgo ? getNumber(input.carrito.importe_riesgo) : 0,
      riesgo_motivo: input.carrito.riesgo ? nullableText(input.carrito.riesgo_motivo) : null,

 estado: input.carrito.estado || carritoActual.estado || "CARGADO",

derivado_control:
  input.carrito.estado === "EN_CONTROL"
    ? true
    : Boolean(carritoActual.derivado_control),

controlado:
  input.carrito.estado === "CONTROLADO"
    ? true
    : Boolean(carritoActual.controlado),

enviado_control_at:
  input.carrito.estado === "EN_CONTROL"
    ? carritoActual.enviado_control_at || now
    : carritoActual.enviado_control_at || null,

confirmado_vendedor:
  carritoActual.confirmado_vendedor !== undefined
    ? Boolean(carritoActual.confirmado_vendedor)
    : true,

confirmado_at:
  carritoActual.confirmado_at || now,

observaciones: nullableText(
  input.carrito.observaciones !== undefined
    ? input.carrito.observaciones
    : carritoActual.observaciones
),

vendedor: vendedorNombre,
      vendedor_id: vendedorId,
      sucursal_id: sucursalId,

      activo:
        input.carrito.activo !== undefined ? Boolean(input.carrito.activo) : carritoActual.activo,

      updated_at: now
    };

    const carritoRes = await supabase
      .from("carritos")
      .update(carritoPayload)
      .eq("id", input.carritoId);

    if (carritoRes.error) {
      set({ saving: false, error: normalizeError(carritoRes.error) });
      return false;
    }

    const deletePagosRes = await supabase
      .from("carrito_pagos_comerciales")
      .delete()
      .eq("carrito_id", input.carritoId);

    if (deletePagosRes.error) {
      set({ saving: false, error: normalizeError(deletePagosRes.error) });
      return false;
    }

    const pagosPayload = input.pagosComerciales
      .filter((pago) => getNumber(pago.importe) > 0)
      .map((pago) => ({
        carrito_id: input.carritoId,
        forma_pago_id: pago.forma_pago_id || null,
        forma_pago: nullableText(pago.forma_pago),
        importe: getNumber(pago.importe),
        moneda: pago.moneda || input.carrito.moneda || carritoActual.moneda || "ARS"
      }));

    if (pagosPayload.length > 0) {
      const insertPagosRes = await supabase.from("carrito_pagos_comerciales").insert(pagosPayload);

      if (insertPagosRes.error) {
        set({ saving: false, error: normalizeError(insertPagosRes.error) });
        return false;
      }
    }

    const deleteMovimientosRes = await supabase
      .from("carrito_movimientos_tesoreria")
      .delete()
      .eq("carrito_id", input.carritoId);

    if (deleteMovimientosRes.error) {
      set({ saving: false, error: normalizeError(deleteMovimientosRes.error) });
      return false;
    }

    const movimientosPayload = input.movimientosTesoreria
      .filter((movimiento) => getNumber(movimiento.importe) > 0)
      .map((movimiento) => ({
        carrito_id: input.carritoId,
        caja_id: movimiento.caja_id || null,
        caja: nullableText(movimiento.caja),
        forma_pago_id: movimiento.forma_pago_id || null,
        forma_pago: nullableText(movimiento.forma_pago),
        importe: getNumber(movimiento.importe),
        moneda: movimiento.moneda || input.carrito.moneda || carritoActual.moneda || "ARS",
        tipo_cambio: movimiento.tipo_cambio || null,
        moneda_equivalente: movimiento.moneda_equivalente || null,
        importe_equivalente: movimiento.importe_equivalente || null
      }));

    if (movimientosPayload.length > 0) {
      const insertMovimientosRes = await supabase
        .from("carrito_movimientos_tesoreria")
        .insert(movimientosPayload);

      if (insertMovimientosRes.error) {
        set({ saving: false, error: normalizeError(insertMovimientosRes.error) });
        return false;
      }
    }

    await get().loadCarritos();

    set({ saving: false });
    return true;
  },

  toggleCarritoActivo: async (carrito) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("carritos")
      .update({
        activo: !carrito.activo
      })
      .eq("id", carrito.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCarritos();

    set({ saving: false });
    return true;
  },

  sendToControl: async (carrito) => {
    set({ saving: true, error: null });

    if (["EN_CONTROL", "CONTROLADO", "FACTURADO", "COBRADO"].includes(carrito.estado)) {
      set({
        saving: false,
        error: "Este carrito ya fue enviado a control o ya fue controlado. No se puede reenviar."
      });

      return false;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("carritos")
      .update({
        estado: "EN_CONTROL",
        derivado_control: true,
        controlado: false,
        enviado_control_at: now,
        visible_en_carritos: true,
        confirmado_vendedor: true,
        confirmado_at: carrito.confirmado_at || now,
        fecha_visible_carritos: carrito.fecha_visible_carritos || getToday(),
        updated_at: now
      })
      .eq("id", carrito.id)
      .not("estado", "in", '("EN_CONTROL","CONTROLADO","FACTURADO","COBRADO")');

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadCarritos();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => {
      const shouldSwitchToRange = key === "desde" || key === "hasta";

      return {
        filters: {
          ...state.filters,
          periodMode: shouldSwitchToRange ? "rango" : state.filters.periodMode,
          [key]: value
        }
      };
    });
  },

  setMonthFilter: (month) => {
    const range = getMonthRange(month);

    set((state) => ({
      filters: {
        ...state.filters,
        periodMode: "mes",
        month,
        desde: range.desde,
        hasta: range.hasta
      }
    }));
  },

  goToPreviousMonth: () => {
    const currentMonth = get().filters.month;
    const nextMonth = addMonthsToMonth(currentMonth, -1);
    const range = getMonthRange(nextMonth);

    set((state) => ({
      filters: {
        ...state.filters,
        periodMode: "mes",
        month: nextMonth,
        desde: range.desde,
        hasta: range.hasta
      }
    }));
  },

  goToNextMonth: () => {
    const currentMonth = get().filters.month;
    const nextMonth = addMonthsToMonth(currentMonth, 1);
    const range = getMonthRange(nextMonth);

    set((state) => ({
      filters: {
        ...state.filters,
        periodMode: "mes",
        month: nextMonth,
        desde: range.desde,
        hasta: range.hasta
      }
    }));
  },

  goToCurrentMonth: () => {
    const month = getCurrentMonth();
    const range = getMonthRange(month);

    set((state) => ({
      filters: {
        ...state.filters,
        periodMode: "mes",
        month,
        desde: range.desde,
        hasta: range.hasta
      }
    }));
  },

resetFilters: () => {
  set({
    filters: getDefaultFilters()
  });
},
  selectCarrito: (id) => {
    set({ selectedCarritoId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredCarritos: () => {
    const { carritos, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return carritos;

    return carritos.filter((carrito) => {
      const cliente = carrito.clientes;

      const haystack = normalizeText(
        [
          carrito.numero_carrito,
          carrito.destino,
          carrito.servicio,
          carrito.estado,
          carrito.vendedor,
          carrito.metodo_contacto,
          cliente?.nombre_completo,
          cliente?.telefono,
          cliente?.email
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getMetrics: () => {
    const carritos = get().getFilteredCarritos();

    const totalVenta = carritos.reduce(
      (total, carrito) => total + getNumber(carrito.importe_final ?? carrito.importe),
      0
    );

    const totalPagado = carritos.reduce(
      (total, carrito) => total + getNumber(carrito.total_pagado),
      0
    );

    const saldo = carritos.reduce(
      (total, carrito) => total + getNumber(carrito.saldo_cta_cte),
      0
    );

    return {
      carritos: carritos.length,
      totalVenta,
      totalPagado,
      saldo,
      riesgos: carritos.filter((carrito) => carrito.riesgo).length,
      cargados: carritos.filter((carrito) => carrito.estado === "CARGADO").length,
      enControl: carritos.filter((carrito) => carrito.estado === "EN_CONTROL").length,
      controlados: carritos.filter((carrito) => carrito.estado === "CONTROLADO").length
    };
  }
}));