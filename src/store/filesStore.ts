// src/store/filesStore.ts

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
  activa?: boolean;
  veces_usado_total?: number;
};

export type Operador = {
  id: string;
  nombre: string;
  color: string;
  razon_social: string | null;
  cuit: string | null;
  activo: boolean;
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

export type FileItem = {
  id: string;
  cliente_id: string;
  numero_file: string;
  operador_id: string | null;
  operador: string | null;
  fecha_venta: string;
  servicio_id: string | null;
  servicio: string | null;
  metodo_contacto: string | null;
  destino: string | null;
  fecha_in: string | null;
  fecha_out: string | null;
  solo_ida: boolean;
  importe_bruto: string | number;
  importe_final: string | number;
  moneda: string;
  neto_operador: string | number;
  pago_parcial: boolean;
  total_pagado: string | number;
  saldo_cta_cte: string | number;
  visible_en_files: boolean;
  fecha_visible_files: string | null;
  confirmado_vendedor: boolean;
  confirmado_at: string | null;
  fecha_vencimiento_operador?: string | null;
  saldo_pendiente_operador?: string | number | null;
  estado_pago_operador?: string | null;
  estado: string;
  observaciones: string | null;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  riesgo?: boolean;
  importe_riesgo?: string | number;
  riesgo_motivo?: string | null;
  clientes?: Cliente | null;
};

export type PagoComercial = {
  id?: string;
  file_id?: string;
  forma_pago_id?: string | null;
  forma_pago?: string | null;
  importe: number;
  moneda: string;
};

export type MovimientoTesoreria = {
  id?: string;
  file_id?: string;
  caja_id?: string | null;
  caja?: string | null;
  forma_pago_id?: string | null;
  forma_pago?: string | null;
  importe: number;
  moneda: string;
  tipo_cambio?: number | null;
  moneda_equivalente?: string | null;
  importe_equivalente?: number | null;
};

export type FileVoucherServicioInput = {
  servicio_detalle: string;
  cantidad_pasajeros: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
};

export type FileVoucherInput = {
  requiere_voucher: boolean;
  reserva_id: string | null;
  a_favor_de: string | null;
  servicios: FileVoucherServicioInput[];
};

export type FileVoucher = {
  id: string;
  file_id: string;
  numero_voucher: string | number | null;
  requiere_voucher: boolean;
  reserva_id: string | null;
  a_favor_de: string | null;
  generado_at: string | null;
  generado_by: string | null;
  pdf_storage_path: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
};

export type FileVoucherServicio = {
  id: string;
  voucher_id: string;
  servicio_detalle: string;
  cantidad_pasajeros: number;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  orden: number;
  created_at: string;
  updated_at: string;
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

export type FileWizardInput = {
  cliente: ClienteDraft;
  file: {
    numero_file: string;
    fecha_venta: string;
    operador_id?: string | null;
    operador?: string | null;
    servicio_id?: string | null;
    servicio?: string | null;
    metodo_contacto?: string | null;
    destino?: string | null;
    fecha_in?: string | null;
    fecha_out?: string | null;
    solo_ida?: boolean;
    importe_bruto: number;
    importe_final: number;
    moneda: string;
    neto_operador: number;
    pago_parcial: boolean;
    total_pagado: number;
    saldo_cta_cte: number;
    visible_en_files: boolean;
    riesgo?: boolean;
    importe_riesgo?: number;
    riesgo_motivo?: string | null;
    confirmado_vendedor: boolean;
    observaciones?: string | null;
    vendedor_id?: string | null;
    sucursal_id?: string | null;
  };
  pagosComerciales: PagoComercial[];
  movimientosTesoreria: MovimientoTesoreria[];
  voucher?: FileVoucherInput | null;
};

export type FileDetalleUpdateInput = {
  operador_id?: string | null;
  operador?: string | null;
  servicio_id?: string | null;
  servicio?: string | null;
  destino?: string | null;
  fecha_in?: string | null;
  fecha_out?: string | null;
  solo_ida?: boolean;
  importe_bruto: number;
  importe_final: number;
  moneda: string;
  neto_operador: number;
  estado?: string | null;
  observaciones?: string | null;
  riesgo?: boolean;
  importe_riesgo?: number;
  riesgo_motivo?: string | null;
  fecha_vencimiento_operador?: string | null;
  saldo_pendiente_operador?: number;
  estado_pago_operador?: string | null;
};

export type FilesFilters = {
  mes: string;
  desde: string;
  hasta: string;
  estado: string;
  operadorId: string;
  vendedorId: string;
  sucursalId: string;
  activo: "todos" | "activos" | "inactivos";
  search: string;
};

type FilesMetrics = {
  files: number;
  totalVenta: number;
  totalPagado: number;
  saldo: number;
  netoOperador: number;
  margenEstimado: number;
  riesgos: number;
  importeRiesgo: number;
};

type FilesState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageFiles: boolean;
  sellerDefaultApplied: boolean;

  files: FileItem[];
  pagosComerciales: PagoComercial[];
  movimientosTesoreria: MovimientoTesoreria[];
  vouchers: FileVoucher[];
  voucherServicios: FileVoucherServicio[];

  clientesSearch: Cliente[];

  catalogos: {
    operadores: Operador[];
    destinos: CatalogItem[];
    servicios: CatalogItem[];
    formasPago: CatalogItem[];
    metodosContacto: CatalogItem[];
    cajas: Caja[];
    vendedores: ProfileLite[];
    sucursales: CatalogItem[];
  };

  filters: FilesFilters;
  selectedFileId: string | null;

  loadFiles: () => Promise<void>;
  searchClientesByPhone: (telefono: string) => Promise<void>;
  createDestinoInline: (nombre: string, pais?: string) => Promise<string | null>;
  saveFileWizard: (input: FileWizardInput) => Promise<boolean>;
  createVoucherForFile: (fileId: string, input: FileVoucherInput) => Promise<boolean>;
  updateFileDetalle: (fileId: string, input: FileDetalleUpdateInput) => Promise<boolean>;
  toggleFileActivo: (file: FileItem) => Promise<boolean>;

  setFilter: <K extends keyof FilesFilters>(key: K, value: FilesFilters[K]) => void;
  resetFilters: () => void;
  selectFile: (id: string | null) => void;
  clearError: () => void;

  getFilteredFiles: () => FileItem[];
  getMetrics: () => FilesMetrics;
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

function getCurrentMonthValue(): string {
  return getToday().slice(0, 7);
}

function getMonthRange(monthValue: string): { desde: string; hasta: string } {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!year || !month) {
    const today = getToday();

    return {
      desde: `${today.slice(0, 8)}01`,
      hasta: today
    };
  }

  const desde = `${yearRaw}-${monthRaw}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const hasta = `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, "0")}`;

  return {
    desde,
    hasta
  };
}

function getDefaultFilters(): FilesFilters {
  const mes = getCurrentMonthValue();
  const range = getMonthRange(mes);

  return {
    mes,
    desde: range.desde,
    hasta: range.hasta,
    estado: "todos",
    operadorId: "todos",
    vendedorId: "todos",
    sucursalId: "todos",
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
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
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
        profile.rol === "administracion")
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
        profile.rol === "vendedor")
  );
}

function getProfileName(profile: ProfileLite | null): string {
  return profile ? `${profile.nombre} ${profile.apellido}`.trim() : "";
}

export const useFilesStore = create<FilesState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageFiles: false,
  sellerDefaultApplied: false,

  files: [],
  pagosComerciales: [],
  movimientosTesoreria: [],
  vouchers: [],
  voucherServicios: [],

  clientesSearch: [],

  catalogos: {
    operadores: [],
    destinos: [],
    servicios: [],
    formasPago: [],
    metodosContacto: [],
    cajas: [],
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedFileId: null,

  loadFiles: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageFiles: false,
        files: [],
        pagosComerciales: [],
        movimientosTesoreria: [],
        vouchers: [],
        voucherServicios: [],
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
    const canManageFiles = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageFiles,
        files: [],
        pagosComerciales: [],
        movimientosTesoreria: [],
        vouchers: [],
        voucherServicios: [],
        clientesSearch: [],
        error: "Tu usuario no tiene acceso al módulo Files."
      });

      return;
    }

    const currentFilters = get().filters;
    const sellerDefaultApplied = get().sellerDefaultApplied;

    let effectiveFilters = currentFilters;

    if (!sellerDefaultApplied) {
      const role = String(currentProfile?.rol || "").toLowerCase();
      const defaultVendedorId = role === "vendedor" ? currentUserId : "todos";

      effectiveFilters = {
        ...currentFilters,
        vendedorId: defaultVendedorId
      };

      set({
        filters: effectiveFilters,
        sellerDefaultApplied: true
      });
    }

    let filesQuery = supabase
      .from("files")
      .select("*, clientes(*)")
      .eq("visible_en_files", true)
      .gte("fecha_venta", effectiveFilters.desde)
      .lte("fecha_venta", effectiveFilters.hasta)
      .order("fecha_venta", { ascending: false })
      .order("created_at", { ascending: false });

    if (effectiveFilters.estado !== "todos") {
      filesQuery = filesQuery.eq("estado", effectiveFilters.estado);
    }

    if (effectiveFilters.operadorId !== "todos") {
      filesQuery = filesQuery.eq("operador_id", effectiveFilters.operadorId);
    }

    if (effectiveFilters.vendedorId !== "todos") {
      filesQuery = filesQuery.eq("vendedor_id", effectiveFilters.vendedorId);
    }

    if (effectiveFilters.sucursalId !== "todos") {
      filesQuery = filesQuery.eq("sucursal_id", effectiveFilters.sucursalId);
    }

    if (effectiveFilters.activo === "activos") {
      filesQuery = filesQuery.eq("activo", true);
    }

    if (effectiveFilters.activo === "inactivos") {
      filesQuery = filesQuery.eq("activo", false);
    }

    const [
      filesRes,
      operadoresRes,
      destinosRes,
      serviciosRes,
      formasPagoRes,
      metodosContactoRes,
      cajasRes,
      sucursalesRes,
      vendedoresRes
    ] = await Promise.all([
      filesQuery,
      supabase.from("operadores").select("*").eq("activo", true).order("nombre"),
      supabase.from("destinos").select("*").eq("activo", true).order("nombre"),
      supabase.from("servicios").select("*").eq("activo", true).order("nombre"),
      supabase.from("formas_pago").select("*").eq("activo", true).order("nombre"),
      supabase.from("metodos_contacto").select("*").eq("activo", true).order("nombre"),
      supabase
        .from("cajas")
        .select("*")
        .or("activo.eq.true,activa.eq.true")
        .neq("tipo", "ALMUNDO")
        .order("nombre"),
      supabase.from("sucursales").select("*").order("nombre"),
      supabase
        .from("profiles")
        .select("*")
        .in("rol", ["vendedor", "administracion", "gerencia", "admin_general"])
        .eq("activo", true)
        .order("nombre")
    ]);

    const firstError =
      filesRes.error ||
      operadoresRes.error ||
      destinosRes.error ||
      serviciosRes.error ||
      formasPagoRes.error ||
      metodosContactoRes.error ||
      cajasRes.error ||
      sucursalesRes.error ||
      vendedoresRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageFiles,
        error: normalizeError(firstError)
      });

      return;
    }

    const files = (filesRes.data || []) as FileItem[];
    const fileIds = files.map((file) => file.id);

    let pagosComerciales: PagoComercial[] = [];
    let movimientosTesoreria: MovimientoTesoreria[] = [];
    let vouchers: FileVoucher[] = [];
    let voucherServicios: FileVoucherServicio[] = [];

    if (fileIds.length > 0) {
      const [pagosRes, movimientosRes, vouchersRes] = await Promise.all([
        supabase.from("file_pagos_comerciales").select("*").in("file_id", fileIds),
        supabase.from("file_movimientos_tesoreria").select("*").in("file_id", fileIds),
        supabase.from("file_vouchers").select("*").in("file_id", fileIds).eq("activo", true)
      ]);

      const childError = pagosRes.error || movimientosRes.error || vouchersRes.error;

      if (childError) {
        set({
          loading: false,
          currentProfile,
          canManageFiles,
          error: normalizeError(childError)
        });

        return;
      }

      pagosComerciales = (pagosRes.data || []) as PagoComercial[];
      movimientosTesoreria = (movimientosRes.data || []) as MovimientoTesoreria[];
      vouchers = (vouchersRes.data || []) as FileVoucher[];

      const voucherIds = vouchers.map((voucher) => voucher.id);

      if (voucherIds.length > 0) {
        const serviciosRes = await supabase
          .from("file_voucher_servicios")
          .select("*")
          .in("voucher_id", voucherIds)
          .order("orden", { ascending: true });

        if (serviciosRes.error) {
          set({
            loading: false,
            currentProfile,
            canManageFiles,
            error: normalizeError(serviciosRes.error)
          });

          return;
        }

        voucherServicios = (serviciosRes.data || []) as FileVoucherServicio[];
      }
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageFiles,
      files,
      pagosComerciales,
      movimientosTesoreria,
      vouchers,
      voucherServicios,
      catalogos: {
        operadores: (operadoresRes.data || []) as Operador[],
        destinos: (destinosRes.data || []) as CatalogItem[],
        servicios: (serviciosRes.data || []) as CatalogItem[],
        formasPago: (formasPagoRes.data || []) as CatalogItem[],
        metodosContacto: (metodosContactoRes.data || []) as CatalogItem[],
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

  saveFileWizard: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { currentProfile, canManageFiles } = get();

    if (!currentUserId || !currentProfile) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!input.file.confirmado_vendedor) {
      set({ saving: false, error: "El vendedor debe confirmar que los datos son correctos." });
      return false;
    }

   const vendedorId =
  canManageFiles
    ? input.file.vendedor_id || input.cliente.vendedor_id || currentUserId
    : currentUserId;

    const vendedorProfile = get().catalogos.vendedores.find(
      (vendedor) => vendedor.id === vendedorId
    );

    const vendedorNombre = vendedorProfile
      ? getProfileName(vendedorProfile)
      : getProfileName(currentProfile);

    const sucursalId =
      input.file.sucursal_id ||
      input.cliente.sucursal_id ||
      currentProfile.sucursal_id ||
      null;

    const metodoContacto = nullableText(input.file.metodo_contacto || input.cliente.origen);

    let clienteId = input.cliente.id || null;

    if (!clienteId) {
      const clienteRes = await supabase
        .from("clientes")
        .insert({
          nombre_completo: cleanText(input.cliente.nombre_completo),
          telefono: cleanText(input.cliente.telefono),
          email: nullableText(input.cliente.email),
          origen: metodoContacto,
          vendedor: vendedorNombre,
          vendedor_id: vendedorId,
          sucursal_id: input.file.sucursal_id || input.cliente.sucursal_id || currentProfile?.sucursal_id || null,
          activo: true
        })
        .select("id")
        .single();

      if (clienteRes.error) {
        set({ saving: false, error: normalizeError(clienteRes.error) });
        return false;
      }

      clienteId = clienteRes.data.id;
    }

    const now = new Date().toISOString();
    const operador = get().catalogos.operadores.find(
      (item) => item.id === input.file.operador_id
    );
    const importeRiesgo = getNumber(input.file.importe_riesgo);

    const fileRes = await supabase
      .from("files")
      .insert({
        cliente_id: clienteId,
        numero_file: cleanText(input.file.numero_file),
        operador_id: input.file.operador_id || null,
        operador: input.file.operador || operador?.nombre || null,
        fecha_venta: input.file.fecha_venta || getToday(),

        servicio_id: input.file.servicio_id || null,
        servicio: nullableText(input.file.servicio),
        metodo_contacto: metodoContacto,
        destino: nullableText(input.file.destino),

        fecha_in: input.file.fecha_in || null,
        fecha_out: input.file.solo_ida ? null : input.file.fecha_out || null,
        solo_ida: Boolean(input.file.solo_ida),

        importe_bruto: input.file.importe_bruto,
        importe_final: input.file.importe_final,
        moneda: input.file.moneda || "ARS",
        neto_operador: input.file.neto_operador,

        pago_parcial: Boolean(input.file.pago_parcial),
        total_pagado: input.file.total_pagado,
        saldo_cta_cte: input.file.saldo_cta_cte,
        visible_en_files: Boolean(input.file.visible_en_files),
        fecha_visible_files: input.file.visible_en_files ? getToday() : null,

        riesgo: Boolean(input.file.riesgo),
        importe_riesgo: Boolean(input.file.riesgo) ? importeRiesgo : 0,
        riesgo_motivo: nullableText(input.file.riesgo_motivo),

        confirmado_vendedor: true,
        confirmado_at: now,
        estado: input.file.visible_en_files ? "CARGADO" : "CTA_CTE",
        observaciones: nullableText(input.file.observaciones),

        vendedor: vendedorNombre,
        vendedor_id: vendedorId,
        sucursal_id: sucursalId,
        activo: true
      })
      .select("id")
      .single();

    if (fileRes.error) {
      set({ saving: false, error: normalizeError(fileRes.error) });
      return false;
    }

    const fileId = fileRes.data.id;

    const pagosPayload = input.pagosComerciales
      .filter((pago) => getNumber(pago.importe) > 0)
      .map((pago) => ({
        file_id: fileId,
        forma_pago_id: pago.forma_pago_id || null,
        forma_pago: nullableText(pago.forma_pago),
        importe: pago.importe || 0,
        moneda: pago.moneda || input.file.moneda || "ARS"
      }));

    if (pagosPayload.length > 0) {
      const pagosRes = await supabase.from("file_pagos_comerciales").insert(pagosPayload);

      if (pagosRes.error) {
        set({ saving: false, error: normalizeError(pagosRes.error) });
        return false;
      }
    }

    const movimientosValidos = input.movimientosTesoreria.filter(
      (movimiento) => getNumber(movimiento.importe) > 0
    );

    const movimientosPayload = movimientosValidos.map((movimiento) => {
      const caja = get().catalogos.cajas.find((item) => item.id === movimiento.caja_id);

      return {
        file_id: fileId,
        caja_id: movimiento.caja_id || null,
        caja: nullableText(movimiento.caja || caja?.nombre),
        forma_pago_id: movimiento.forma_pago_id || null,
        forma_pago: nullableText(movimiento.forma_pago),
        importe: getNumber(movimiento.importe),
        moneda: movimiento.moneda || caja?.moneda || input.file.moneda || "ARS",
        tipo_cambio: movimiento.tipo_cambio || null,
        moneda_equivalente: movimiento.moneda_equivalente || null,
        importe_equivalente: movimiento.importe_equivalente || null
      };
    });

    if (movimientosPayload.length > 0) {
      const movimientosRes = await supabase
        .from("file_movimientos_tesoreria")
        .insert(movimientosPayload);

      if (movimientosRes.error) {
        set({ saving: false, error: normalizeError(movimientosRes.error) });
        return false;
      }
    }

    const cajaMovimientosPayload = movimientosValidos
      .map((movimiento) => {
        const caja = get().catalogos.cajas.find((item) => item.id === movimiento.caja_id);

        if (!caja?.id) return null;

        return {
          fecha: input.file.fecha_venta || getToday(),
          tipo: "INGRESO",
          categoria: "Cobro cliente",
          descripcion: `Cobro file ${input.file.numero_file}`,
          caja_id: caja.id,
          sucursal_id: caja.sucursal_id || sucursalId || null,
          moneda: caja.moneda || movimiento.moneda || input.file.moneda || "ARS",
          importe: getNumber(movimiento.importe),
          referencia_tipo: "FILE",
          referencia_id: fileId,
          referencia_texto: input.file.numero_file,
          origen: "FILE",
          vendedor_id: vendedorId,
          cliente_id: clienteId,
          forma_pago: nullableText(movimiento.forma_pago),
          observaciones: nullableText(input.file.observaciones),
          created_by: currentUserId,
          updated_by: currentUserId
        };
      })
      .filter(
        (
          movimiento
        ): movimiento is {
          fecha: string;
          tipo: string;
          categoria: string;
          descripcion: string;
          caja_id: string;
          sucursal_id: string | null;
          moneda: string;
          importe: number;
          referencia_tipo: string;
          referencia_id: string;
          referencia_texto: string;
          origen: string;
          vendedor_id: string;
          cliente_id: string;
          forma_pago: string | null;
          observaciones: string | null;
          created_by: string;
          updated_by: string;
        } => Boolean(movimiento)
      );

    if (cajaMovimientosPayload.length > 0) {
      const cajaMovimientosRes = await supabase
        .from("caja_movimientos")
        .insert(cajaMovimientosPayload);

      if (cajaMovimientosRes.error) {
        set({ saving: false, error: normalizeError(cajaMovimientosRes.error) });
        return false;
      }
    }

    if (input.file.riesgo) {
      const riesgoRes = await supabase.from("file_riesgos").insert({
        file_id: fileId,
        operador_id: input.file.operador_id || null,
        operador: input.file.operador || operador?.nombre || null,
        importe_riesgo: importeRiesgo,
        moneda: input.file.moneda || "ARS",
        motivo: nullableText(input.file.riesgo_motivo),
        estado: "PENDIENTE",
        created_by: currentUserId
      });

      if (riesgoRes.error) {
        set({ saving: false, error: normalizeError(riesgoRes.error) });
        return false;
      }
    }

    if (input.voucher?.requiere_voucher) {
      const serviciosValidos = input.voucher.servicios.filter((servicio) =>
        cleanText(servicio.servicio_detalle)
      );

      const voucherRes = await supabase
        .from("file_vouchers")
        .insert({
          file_id: fileId,
          requiere_voucher: true,
          reserva_id: nullableText(input.voucher.reserva_id),
          a_favor_de:
            nullableText(input.voucher.a_favor_de) || cleanText(input.cliente.nombre_completo),
          activo: true
        })
        .select("id")
        .single();

      if (voucherRes.error) {
        set({ saving: false, error: normalizeError(voucherRes.error) });
        return false;
      }

      const voucherId = voucherRes.data.id;

      if (serviciosValidos.length > 0) {
        const serviciosPayload = serviciosValidos.map((servicio, index) => ({
          voucher_id: voucherId,
          servicio_detalle: cleanText(servicio.servicio_detalle),
          cantidad_pasajeros: Math.max(Number(servicio.cantidad_pasajeros || 1), 1),
          fecha_inicio: servicio.fecha_inicio || null,
          fecha_fin: servicio.fecha_fin || null,
          orden: index + 1
        }));

        const serviciosRes = await supabase
          .from("file_voucher_servicios")
          .insert(serviciosPayload);

        if (serviciosRes.error) {
          set({ saving: false, error: normalizeError(serviciosRes.error) });
          return false;
        }
      }
    }

    await get().loadFiles();

    set({ saving: false, clientesSearch: [] });
    return true;
  },

  createVoucherForFile: async (fileId, input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const currentFile = get().files.find((file) => file.id === fileId);

    if (!currentFile) {
      set({ saving: false, error: "No se encontró el file." });
      return false;
    }

    const existingVoucher = get().vouchers.find((voucher) => voucher.file_id === fileId);

    if (existingVoucher) {
      set({ saving: false, error: "Este file ya tiene voucher cargado." });
      return false;
    }

    const serviciosValidos = input.servicios.filter((servicio) =>
      cleanText(servicio.servicio_detalle)
    );

    if (serviciosValidos.length === 0) {
      set({ saving: false, error: "Agregá al menos un servicio para el voucher." });
      return false;
    }

    const voucherRes = await supabase
      .from("file_vouchers")
      .insert({
        file_id: fileId,
        requiere_voucher: true,
        reserva_id: nullableText(input.reserva_id),
        a_favor_de:
          nullableText(input.a_favor_de) ||
          currentFile.clientes?.nombre_completo ||
          "Cliente",
        activo: true
      })
      .select("id")
      .single();

    if (voucherRes.error) {
      set({ saving: false, error: normalizeError(voucherRes.error) });
      return false;
    }

    const voucherId = voucherRes.data.id;

    const serviciosPayload = serviciosValidos.map((servicio, index) => ({
      voucher_id: voucherId,
      servicio_detalle: cleanText(servicio.servicio_detalle),
      cantidad_pasajeros: Math.max(Number(servicio.cantidad_pasajeros || 1), 1),
      fecha_inicio: servicio.fecha_inicio || null,
      fecha_fin: servicio.fecha_fin || null,
      orden: index + 1
    }));

    const serviciosRes = await supabase
      .from("file_voucher_servicios")
      .insert(serviciosPayload);

    if (serviciosRes.error) {
      set({ saving: false, error: normalizeError(serviciosRes.error) });
      return false;
    }

    await get().loadFiles();

    set({ saving: false });
    return true;
  },

  updateFileDetalle: async (fileId, input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const currentFile = get().files.find((file) => file.id === fileId);
    const operador = input.operador_id
      ? get().catalogos.operadores.find((item) => item.id === input.operador_id)
      : null;

    const importeFinal = getNumber(input.importe_final);
    const totalPagado = getNumber(currentFile?.total_pagado);
    const saldoCtaCte = Math.max(importeFinal - totalPagado, 0);

    const updatePayload = {
      operador_id: input.operador_id || null,
      operador: input.operador || operador?.nombre || null,

      servicio_id: input.servicio_id || null,
      servicio: nullableText(input.servicio),
      destino: nullableText(input.destino),

      fecha_in: input.fecha_in || null,
      fecha_out: input.solo_ida ? null : input.fecha_out || null,
      solo_ida: Boolean(input.solo_ida),

      importe_bruto: getNumber(input.importe_bruto),
      importe_final: importeFinal,
      moneda: input.moneda || "ARS",
      neto_operador: getNumber(input.neto_operador),

      saldo_cta_cte: saldoCtaCte,
      pago_parcial: saldoCtaCte > 0.009,

      estado: input.estado || "CARGADO",
      observaciones: nullableText(input.observaciones),

      riesgo: Boolean(input.riesgo),
      importe_riesgo: Boolean(input.riesgo) ? getNumber(input.importe_riesgo) : 0,
      riesgo_motivo: Boolean(input.riesgo) ? nullableText(input.riesgo_motivo) : null,

      fecha_vencimiento_operador: input.fecha_vencimiento_operador || null,
      saldo_pendiente_operador: getNumber(input.saldo_pendiente_operador),
      estado_pago_operador: nullableText(input.estado_pago_operador),

      updated_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from("files")
      .update(updatePayload)
      .eq("id", fileId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadFiles();

    set({ saving: false });
    return true;
  },

  toggleFileActivo: async (file) => {
    set({ saving: true, error: null });

    const { error } = await supabase
      .from("files")
      .update({ activo: !file.activo })
      .eq("id", file.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadFiles();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => {
      if (key === "mes") {
        const range = getMonthRange(String(value));

        return {
          filters: {
            ...state.filters,
            mes: String(value),
            desde: range.desde,
            hasta: range.hasta
          }
        };
      }

      return {
        filters: {
          ...state.filters,
          [key]: value
        }
      };
    });
  },

  resetFilters: () => {
    set({
      filters: getDefaultFilters(),
      sellerDefaultApplied: false
    });
  },

  selectFile: (id) => {
    set({ selectedFileId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredFiles: () => {
    const { files, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return files;

    return files.filter((file) => {
      const cliente = file.clientes;

      const haystack = normalizeText(
        [
          file.numero_file,
          file.destino,
          file.servicio,
          file.metodo_contacto,
          file.estado,
          file.operador,
          file.vendedor,
          file.riesgo ? "riesgo" : "",
          cliente?.nombre_completo,
          cliente?.telefono,
          cliente?.email,
          cliente?.origen
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getMetrics: () => {
    const files = get().getFilteredFiles();

    const totalVenta = files.reduce(
      (total, file) => total + getNumber(file.importe_final),
      0
    );

    const totalPagado = files.reduce(
      (total, file) => total + getNumber(file.total_pagado),
      0
    );

    const saldo = files.reduce(
      (total, file) => total + getNumber(file.saldo_cta_cte),
      0
    );

    const netoOperador = files.reduce(
      (total, file) => total + getNumber(file.neto_operador),
      0
    );

    const importeRiesgo = files.reduce(
      (total, file) => total + getNumber(file.importe_riesgo),
      0
    );

    return {
      files: files.length,
      totalVenta,
      totalPagado,
      saldo,
      netoOperador,
      margenEstimado: totalVenta - netoOperador,
      riesgos: files.filter((file) => file.riesgo).length,
      importeRiesgo
    };
  }
}));