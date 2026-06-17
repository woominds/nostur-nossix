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
};

export type Cliente = {
  id: string;
  nombre_completo: string;
  telefono: string;
  email: string | null;
  origen: string | null;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  activo: boolean;
};

export type FileOperador = {
  id: string;
  cliente_id: string;
  numero_file: string;
  operador_id: string | null;
  operador: string | null;
  fecha_venta: string;
  servicio_id: string | null;
  servicio: string | null;
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
  estado: string;
  observaciones: string | null;
  vendedor: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  clientes?: Cliente | null;
};

export type PagoOperador = {
  id: string;
  file_id: string;
  operador_id: string | null;
  caja_id: string | null;
  caja: string | null;
  fecha_pago: string;
  importe: string | number;
  moneda: string;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Caja = {
  id: string;
  nombre: string;
  activa?: boolean;
  activo?: boolean;
};

export type Operador = {
  id: string;
  nombre: string;
  color: string;
  razon_social: string | null;
  cuit: string | null;
  activo: boolean;
};

export type PagoOperadorInput = {
  file_id: string;
  operador_id?: string | null;
  caja_id?: string | null;
  caja?: string | null;
  fecha_pago: string;
  importe: number;
  moneda: string;
  observaciones?: string | null;
};

export type PagosOperadoresFilters = {
  mes: string;
  desde: string;
  hasta: string;
  estadoPago: "todos" | "pendiente" | "parcial" | "pagado";
  operadorId: string;
  vendedorId: string;
  sucursalId: string;
  activo: "todos" | "activos" | "inactivos";
  search: string;
};

type FilePagoResumen = {
  file: FileOperador;
  pagos: PagoOperador[];
  totalPagadoOperador: number;
  saldoOperador: number;
  utilidad: number;
  estadoPago: "PENDIENTE" | "PARCIAL" | "PAGADO";
};

type PagosOperadoresMetrics = {
  files: number;
  totalVenta: number;
  netoOperador: number;
  utilidad: number;
  pagadoOperador: number;
  saldoOperador: number;
  pendientes: number;
  parciales: number;
  pagados: number;
};

type PagosOperadoresState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManagePagosOperadores: boolean;

  files: FileOperador[];
  pagos: PagoOperador[];

  catalogos: {
    cajas: Caja[];
    operadores: Operador[];
    vendedores: ProfileLite[];
    sucursales: { id: string; nombre: string; activo?: boolean; activa?: boolean }[];
  };

  filters: PagosOperadoresFilters;
  selectedFileId: string | null;

  loadPagosOperadores: () => Promise<void>;
  savePagoOperador: (input: PagoOperadorInput) => Promise<boolean>;

  setFilter: <K extends keyof PagosOperadoresFilters>(
    key: K,
    value: PagosOperadoresFilters[K]
  ) => void;
  resetFilters: () => void;
  selectFile: (id: string | null) => void;
  clearError: () => void;

  getResumen: () => FilePagoResumen[];
  getSelectedResumen: () => FilePagoResumen | null;
  getMetrics: () => PagosOperadoresMetrics;
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

  const cleanMonth = String(month).padStart(2, "0");
  const desde = `${year}-${cleanMonth}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const hasta = `${year}-${cleanMonth}-${String(lastDay).padStart(2, "0")}`;

  return { desde, hasta };
}

function getDefaultFilters(): PagosOperadoresFilters {
  const mes = "2026-04";
  const range = getMonthRange(mes);

  return {
    mes,
    desde: range.desde,
    hasta: range.hasta,
    estadoPago: "todos",
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

function buildResumen(files: FileOperador[], pagos: PagoOperador[]): FilePagoResumen[] {
  return files.map((file) => {
    const filePagos = pagos.filter((pago) => pago.file_id === file.id);

    const totalPagadoOperador = filePagos.reduce(
      (total, pago) => total + getNumber(pago.importe),
      0
    );

    const netoOperador = getNumber(file.neto_operador);
    const importeVenta = getNumber(file.importe_final);
    const saldoOperador = Math.max(0, netoOperador - totalPagadoOperador);
    const utilidad = importeVenta - netoOperador;

    let estadoPago: FilePagoResumen["estadoPago"] = "PENDIENTE";

    if (totalPagadoOperador >= netoOperador && netoOperador > 0) {
      estadoPago = "PAGADO";
    } else if (totalPagadoOperador > 0) {
      estadoPago = "PARCIAL";
    }

    return {
      file,
      pagos: filePagos.sort((a, b) =>
        String(b.fecha_pago).localeCompare(String(a.fecha_pago))
      ),
      totalPagadoOperador,
      saldoOperador,
      utilidad,
      estadoPago
    };
  });
}

export const usePagosOperadoresStore = create<PagosOperadoresState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManagePagosOperadores: false,

  files: [],
  pagos: [],

  catalogos: {
    cajas: [],
    operadores: [],
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedFileId: null,

  loadPagosOperadores: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManagePagosOperadores: false,
        files: [],
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
      set({
        loading: false,
        error: normalizeError(profileRes.error)
      });
      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManagePagosOperadores = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManagePagosOperadores,
        files: [],
        pagos: [],
        error: "Tu usuario no tiene acceso al módulo Pago a Operadores."
      });
      return;
    }

    const filters = get().filters;

    let filesQuery = supabase
      .from("files")
      .select("*, clientes(*)")
      .eq("visible_en_files", true)
      .gte("fecha_venta", filters.desde)
      .lte("fecha_venta", filters.hasta)
      .order("fecha_venta", { ascending: false })
      .order("created_at", { ascending: false });

    if (!canManagePagosOperadores) {
      filesQuery = filesQuery.eq("vendedor_id", currentUserId);
    }

    if (filters.operadorId !== "todos") {
      filesQuery = filesQuery.eq("operador_id", filters.operadorId);
    }

    if (filters.vendedorId !== "todos" && canManagePagosOperadores) {
      filesQuery = filesQuery.eq("vendedor_id", filters.vendedorId);
    }

    if (filters.sucursalId !== "todos") {
      filesQuery = filesQuery.eq("sucursal_id", filters.sucursalId);
    }

    if (filters.activo === "activos") {
      filesQuery = filesQuery.eq("activo", true);
    }

    if (filters.activo === "inactivos") {
      filesQuery = filesQuery.eq("activo", false);
    }

    const [filesRes, cajasRes, operadoresRes, vendedoresRes, sucursalesRes] =
      await Promise.all([
        filesQuery,
        supabase.from("cajas").select("*").order("nombre"),
        supabase.from("operadores").select("*").eq("activo", true).order("nombre"),
        supabase
          .from("profiles")
          .select("*")
          .in("rol", ["vendedor", "gerencia", "admin_general", "administracion"])
          .eq("activo", true)
          .order("nombre"),
        supabase.from("sucursales").select("*").order("nombre")
      ]);

    const firstError =
      filesRes.error ||
      cajasRes.error ||
      operadoresRes.error ||
      vendedoresRes.error ||
      sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManagePagosOperadores,
        error: normalizeError(firstError)
      });
      return;
    }

    const files = (filesRes.data || []) as FileOperador[];
    const fileIds = files.map((file) => file.id);

    let pagos: PagoOperador[] = [];

    if (fileIds.length > 0) {
      const pagosRes = await supabase
        .from("file_pagos_operadores")
        .select("*")
        .in("file_id", fileIds)
        .order("fecha_pago", { ascending: false });

      if (pagosRes.error) {
        set({
          loading: false,
          currentProfile,
          canManagePagosOperadores,
          error: normalizeError(pagosRes.error)
        });
        return;
      }

      pagos = (pagosRes.data || []) as PagoOperador[];
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManagePagosOperadores,
      files,
      pagos,
      catalogos: {
        cajas: (cajasRes.data || []) as Caja[],
        operadores: (operadoresRes.data || []) as Operador[],
        vendedores: (vendedoresRes.data || []) as ProfileLite[],
        sucursales: (sucursalesRes.data || []) as {
          id: string;
          nombre: string;
          activo?: boolean;
          activa?: boolean;
        }[]
      }
    });
  },

  savePagoOperador: async (input) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!input.file_id) {
      set({ saving: false, error: "Seleccioná un file." });
      return false;
    }

    if (!input.caja_id && !input.caja) {
      set({ saving: false, error: "Seleccioná la caja desde donde se pagó." });
      return false;
    }

    if (!input.importe || input.importe <= 0) {
      set({ saving: false, error: "El importe del pago debe ser mayor a cero." });
      return false;
    }

    const { error } = await supabase.from("file_pagos_operadores").insert({
      file_id: input.file_id,
      operador_id: input.operador_id || null,
      caja_id: input.caja_id || null,
      caja: input.caja || null,
      fecha_pago: input.fecha_pago || getToday(),
      importe: input.importe,
      moneda: input.moneda || "ARS",
      observaciones: input.observaciones || null,
      created_by: currentUserId
    });

    if (error) {
      set({
        saving: false,
        error: normalizeError(error)
      });
      return false;
    }

    await get().loadPagosOperadores();

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
      selectedFileId: null
    });
  },

  selectFile: (id) => {
    set({ selectedFileId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  getResumen: () => {
    const { files, pagos, filters } = get();
    const search = normalizeText(filters.search);

    let resumen = buildResumen(files, pagos);

    if (filters.estadoPago !== "todos") {
      resumen = resumen.filter(
        (item) => item.estadoPago.toLowerCase() === filters.estadoPago
      );
    }

    if (search) {
      resumen = resumen.filter((item) => {
        const file = item.file;
        const cliente = file.clientes;

        const haystack = normalizeText(
          [
            file.numero_file,
            file.operador,
            file.destino,
            file.servicio,
            file.estado,
            file.vendedor,
            cliente?.nombre_completo,
            cliente?.telefono,
            cliente?.email
          ].join(" ")
        );

        return haystack.includes(search);
      });
    }

    return resumen;
  },

  getSelectedResumen: () => {
    const { selectedFileId } = get();
    const resumen = get().getResumen();

    if (!selectedFileId) return resumen[0] || null;

    return resumen.find((item) => item.file.id === selectedFileId) || resumen[0] || null;
  },

  getMetrics: () => {
    const resumen = get().getResumen();

    return {
      files: resumen.length,
      totalVenta: resumen.reduce(
        (total, item) => total + getNumber(item.file.importe_final),
        0
      ),
      netoOperador: resumen.reduce(
        (total, item) => total + getNumber(item.file.neto_operador),
        0
      ),
      utilidad: resumen.reduce((total, item) => total + item.utilidad, 0),
      pagadoOperador: resumen.reduce(
        (total, item) => total + item.totalPagadoOperador,
        0
      ),
      saldoOperador: resumen.reduce(
        (total, item) => total + item.saldoOperador,
        0
      ),
      pendientes: resumen.filter((item) => item.estadoPago === "PENDIENTE").length,
      parciales: resumen.filter((item) => item.estadoPago === "PARCIAL").length,
      pagados: resumen.filter((item) => item.estadoPago === "PAGADO").length
    };
  }
}));