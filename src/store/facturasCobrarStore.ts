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
  activa?: boolean;
  activo?: boolean;
};

export type ClienteLite = {
  id: string;
  nombre_completo: string;
  telefono: string;
  email: string | null;
};

export type CarritoDisponible = {
  id: string;
  cliente_id: string;
  numero_carrito: string;
  fecha_venta: string;
  destino: string | null;
  servicio: string | null;
  importe_final: string | number;
  moneda: "ARS" | "USD" | string;
  sucursal_id: string | null;
  vendedor: string | null;
  activo: boolean;
  clientes?: ClienteLite | null;
  carritos_control?: ControlCarritoDisponible[] | null;
};

export type ControlCarritoDisponible = {
  id: string;
  carrito_id: string;
  utilidad_almundo: string | number;
  porcentaje_regalia: string | number;
  importe_regalia: string | number;
  utilidad_nossix: string | number;
  importe_a_facturar: string | number;
  controlado: boolean;
  facturado: boolean;
  cobrado: boolean;
  anulado: boolean;
};

export type FacturaCobrar = {
  id: string;
  tipo_documento: "FACTURA" | "POSTVENTA" | "NOTA_CREDITO" | "NOTA_DEBITO" | string;
  numero_documento: string;
  razon_social: string;
  moneda: "ARS" | "USD" | string;
  sucursal_id: string | null;
  sucursal: string | null;
  mes: number | null;
  anio: number | null;
  neto_gravado: string | number;
  alicuota_iva: string | number;
  iva_importe: string | number;
  no_gravado: string | number;
  exento: string | number;
  total: string | number;
  estado: "PENDIENTE" | "COBRADA" | "ANULADA" | string;
  cobrado: boolean;
  cobrado_at: string | null;
  cobrado_by: string | null;
  forma_cobro: string | null;
  caja_id: string | null;
  caja: string | null;
  referencia_cobro: string | null;
  no_impacta_caja: boolean;
  observaciones: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  punto_venta?: string | null;
  tipo_comprobante?: string | null;
  cae?: string | null;
  cae_vencimiento?: string | null;
  arca_estado?: string | null;
  arca_error?: string | null;
  arca_payload?: unknown;
  arca_response?: unknown;
  facturas_cobrar_carritos?: FacturaCobrarCarrito[];
  facturas_cobrar_retenciones?: FacturaCobrarRetencion[];
};

export type FacturaCobrarCarrito = {
  id: string;
  factura_id: string;
  carrito_id: string;
  control_id: string | null;
  numero_carrito: string | null;
  pasajero: string | null;
  fecha_venta: string | null;
  importe_facturado: string | number;
  moneda: string;
  created_at: string;
};

export type FacturaCobrarRetencion = {
  id: string;
  factura_id: string;
  tipo: string;
  jurisdiccion: string | null;
  porcentaje: string | number | null;
  importe: string | number;
  numero_certificado: string | null;
  created_at: string;
};

export type RetencionFactura = {
  id: string;
  fecha_cobro: string;
  sucursal_id: string | null;
  sucursal: string | null;
  factura_id: string;
  numero_documento: string;
  moneda: "ARS" | "USD" | string;
  importe_factura: string | number;
  importe_cobrado: string | number;
  importe_retencion: string | number;
  referencia: string | null;
  observaciones: string | null;
  created_at: string;
};

export type FacturasTab = "PENDIENTE" | "COBRADA" | "RETENCIONES";

export type FacturasCobrarFilters = {
  mes: number;
  anio: number;
  moneda: "todos" | "ARS" | "USD";
  sucursalId: string;
  estado: "todos" | "PENDIENTE" | "COBRADA";
  tipoDocumento: "todos" | "FACTURA" | "POSTVENTA" | "NOTA_CREDITO" | "NOTA_DEBITO";
  search: string;
};

export type DocumentoDraft = {
  tipo_documento: "FACTURA" | "POSTVENTA" | "NOTA_CREDITO" | "NOTA_DEBITO";
  numero_documento: string;
  razon_social: string;
  moneda: "ARS" | "USD";
  sucursal_id: string;
  mes: string;
  anio: string;
  neto_gravado: string;
  observaciones: string;
  selectedCarritoIds: string[];
};

export type CobroDraft = {
  forma_cobro: "TRANSFERENCIA" | "CASHFLOW";
  caja_id: string;
  importe_ingresado_banco: string;
  referencia_cobro: string;
  observaciones: string;
};

export type MoneyMetrics = {
  pendiente: number;
  cobradoMes: number;
  totalDocumentos: number;
  cantidadPendiente: number;
  cantidadCobrada: number;
};

export type SucursalResumen = {
  sucursalId: string;
  sucursal: string;
  ars: MoneyMetrics;
  usd: MoneyMetrics;
};

export type FacturasGrupoMoneda = {
  moneda: "ARS" | "USD";
  facturas: FacturaCobrar[];
  total: number;
  totalSeleccionado: number;
  cantidadSeleccionada: number;
};

export type FacturasGrupoSucursal = {
  sucursalId: string | null;
  sucursal: string;
  monedas: FacturasGrupoMoneda[];
};

type FacturasCobrarState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageFacturas: boolean;

  selectedTab: FacturasTab;
  selectedFacturaId: string | null;
  selectedFacturaIds: string[];

  facturas: FacturaCobrar[];
  retenciones: RetencionFactura[];
  carritosDisponibles: CarritoDisponible[];

  catalogos: {
    sucursales: SucursalLite[];
    cajas: CajaLite[];
  };

  filters: FacturasCobrarFilters;

  loadFacturas: () => Promise<void>;
  createDocumento: (draft: DocumentoDraft) => Promise<boolean>;
  cobrarFactura: (factura: FacturaCobrar, draft: CobroDraft) => Promise<boolean>;
  cobrarFacturasSeleccionadas: (draft: CobroDraft) => Promise<boolean>;

  setTab: (tab: FacturasTab) => void;
  setFilter: <K extends keyof FacturasCobrarFilters>(key: K, value: FacturasCobrarFilters[K]) => void;
  setMonth: (mes: number, anio: number) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  resetFilters: () => void;

  selectFactura: (id: string | null) => void;
  toggleFacturaSelection: (facturaId: string) => void;
  clearSelection: () => void;
  selectOnlyFactura: (facturaId: string) => void;

  clearError: () => void;

  getFilteredFacturas: () => FacturaCobrar[];
  getSelectedFactura: () => FacturaCobrar | null;
  getSelectedFacturas: () => FacturaCobrar[];
  getSelectedTotal: () => number;
  getSelectedMoneda: () => string | null;
  getSelectedSucursalId: () => string | null;
  getSelectedSucursal: () => string | null;
  getCarritosDisponiblesForDraft: (draft: DocumentoDraft) => CarritoDisponible[];
  getSucursalResumen: () => SucursalResumen[];
  getFacturasAgrupadas: () => FacturasGrupoSucursal[];
};

function getArgentinaDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }));
}

function getCurrentMonthYear(): { mes: number; anio: number } {
  const argentinaNow = getArgentinaDate();

  return {
    mes: argentinaNow.getMonth() + 1,
    anio: argentinaNow.getFullYear()
  };
}

function getDefaultFilters(): FacturasCobrarFilters {
  const current = getCurrentMonthYear();

  return {
    mes: current.mes,
    anio: current.anio,
    moneda: "todos",
    sucursalId: "todos",
    estado: "PENDIENTE",
    tipoDocumento: "todos",
    search: ""
  };
}

function getNumber(value: string | number | null | undefined): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
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
        profile.rol === "administracion")
  );
}

function calculateDocumentTotals(netoGravado: number, tipoDocumento: string) {
  const sign = tipoDocumento === "NOTA_CREDITO" ? -1 : 1;
  const neto = netoGravado * sign;
  const iva = neto * 0.21;
  const total = neto + iva;

  return {
    neto,
    iva,
    total
  };
}

function getSucursalName(sucursales: SucursalLite[], id: string | null): string {
  if (!id) return "Sin sucursal";
  return sucursales.find((item) => item.id === id)?.nombre || "Sin sucursal";
}

function normalizeMonthYear(mes: number, anio: number): { mes: number; anio: number } {
  let nextMes = mes;
  let nextAnio = anio;

  while (nextMes < 1) {
    nextMes += 12;
    nextAnio -= 1;
  }

  while (nextMes > 12) {
    nextMes -= 12;
    nextAnio += 1;
  }

  return {
    mes: nextMes,
    anio: nextAnio
  };
}

function getMonthRange(mes: number, anio: number): { from: string; to: string } {
  const from = `${anio}-${String(mes).padStart(2, "0")}-01`;
  const lastDay = new Date(anio, mes, 0).getDate();
  const to = `${anio}-${String(mes).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  return { from, to };
}

export const useFacturasCobrarStore = create<FacturasCobrarState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageFacturas: false,

  selectedTab: "PENDIENTE",
  selectedFacturaId: null,
  selectedFacturaIds: [],

  facturas: [],
  retenciones: [],
  carritosDisponibles: [],

  catalogos: {
    sucursales: [],
    cajas: []
  },

  filters: getDefaultFilters(),

  loadFacturas: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageFacturas: false,
        facturas: [],
        retenciones: [],
        carritosDisponibles: [],
        selectedFacturaIds: [],
        error: "No hay usuario autenticado."
      });
      return;
    }

    const profileRes = await supabase.from("profiles").select("*").eq("id", currentUserId).maybeSingle();

    if (profileRes.error) {
      set({ loading: false, error: normalizeError(profileRes.error) });
      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManageFacturas = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageFacturas,
        facturas: [],
        retenciones: [],
        carritosDisponibles: [],
        selectedFacturaIds: [],
        error: "Tu usuario no tiene acceso al módulo Facturas a Cobrar."
      });
      return;
    }

    const filters = get().filters;
    const monthRange = getMonthRange(filters.mes, filters.anio);

    let facturasQuery = supabase
      .from("facturas_cobrar")
      .select("*, facturas_cobrar_carritos(*), facturas_cobrar_retenciones(*)")
      .eq("anio", filters.anio)
      .eq("mes", filters.mes)
      .order("sucursal", { ascending: true })
      .order("moneda", { ascending: true })
      .order("numero_documento", { ascending: true });

    if (filters.moneda !== "todos") facturasQuery = facturasQuery.eq("moneda", filters.moneda);
    if (filters.sucursalId !== "todos") facturasQuery = facturasQuery.eq("sucursal_id", filters.sucursalId);

    if (filters.estado !== "todos") {
      if (filters.estado === "COBRADA") {
        facturasQuery = facturasQuery.or("estado.eq.COBRADA,cobrado.eq.true");
      }

      if (filters.estado === "PENDIENTE") {
        facturasQuery = facturasQuery.eq("cobrado", false).neq("estado", "COBRADA");
      }
    }

    if (filters.tipoDocumento !== "todos") {
      facturasQuery = facturasQuery.eq("tipo_documento", filters.tipoDocumento);
    }

    let retencionesQuery = supabase
      .from("v_facturas_cobrar_retenciones")
      .select("*")
      .gte("fecha_cobro", monthRange.from)
      .lte("fecha_cobro", monthRange.to)
      .order("fecha_cobro", { ascending: false })
      .order("created_at", { ascending: false });

    if (filters.moneda !== "todos") retencionesQuery = retencionesQuery.eq("moneda", filters.moneda);
    if (filters.sucursalId !== "todos") retencionesQuery = retencionesQuery.eq("sucursal_id", filters.sucursalId);

    const [facturasRes, retencionesRes, controlesDisponiblesRes, sucursalesRes, cajasRes] = await Promise.all([
      facturasQuery,
      retencionesQuery,
      supabase
        .from("carritos_control")
        .select("*")
        .eq("controlado", true)
        .eq("facturado", false)
        .eq("anulado", false)
        .order("updated_at", { ascending: false }),
      supabase.from("sucursales").select("*").order("nombre"),
      supabase.from("cajas").select("*").order("nombre")
    ]);

    const firstError =
      facturasRes.error ||
      retencionesRes.error ||
      controlesDisponiblesRes.error ||
      sucursalesRes.error ||
      cajasRes.error;

    if (firstError) {
      set({ loading: false, currentProfile, canManageFacturas, error: normalizeError(firstError) });
      return;
    }

    const controlesDisponibles = (controlesDisponiblesRes.data || []) as ControlCarritoDisponible[];
    const carritoIds = controlesDisponibles.map((control) => control.carrito_id).filter(Boolean);

    let carritosDisponibles: CarritoDisponible[] = [];

    if (carritoIds.length > 0) {
      let carritosQuery = supabase
        .from("carritos")
        .select("*, clientes(*)")
        .in("id", carritoIds)
        .eq("visible_en_carritos", true)
        .eq("activo", true)
        .eq("confirmado_vendedor", true)
        .order("fecha_venta", { ascending: false });

      if (filters.moneda !== "todos") carritosQuery = carritosQuery.eq("moneda", filters.moneda);
      if (filters.sucursalId !== "todos") carritosQuery = carritosQuery.eq("sucursal_id", filters.sucursalId);

      const carritosRes = await carritosQuery;

      if (carritosRes.error) {
        set({ loading: false, currentProfile, canManageFacturas, error: normalizeError(carritosRes.error) });
        return;
      }

      carritosDisponibles = ((carritosRes.data || []) as CarritoDisponible[]).map((carrito) => ({
        ...carrito,
        carritos_control: controlesDisponibles.filter((control) => control.carrito_id === carrito.id)
      }));
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageFacturas,
      facturas: (facturasRes.data || []) as FacturaCobrar[],
      retenciones: (retencionesRes.data || []) as RetencionFactura[],
      carritosDisponibles,
      catalogos: {
        sucursales: (sucursalesRes.data || []) as SucursalLite[],
        cajas: (cajasRes.data || []) as CajaLite[]
      }
    });
  },

  createDocumento: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!draft.numero_documento.trim()) {
      set({ saving: false, error: "Ingresá el número de documento." });
      return false;
    }

    if (!draft.sucursal_id) {
      set({ saving: false, error: "Seleccioná una sucursal." });
      return false;
    }

    const sucursal = getSucursalName(get().catalogos.sucursales, draft.sucursal_id);
    const isFacturaCarritos = draft.tipo_documento === "FACTURA";
    const isPostventa = draft.tipo_documento === "POSTVENTA";

    let selectedCarritos: CarritoDisponible[] = [];

    if (isFacturaCarritos) {
      selectedCarritos = get()
        .getCarritosDisponiblesForDraft(draft)
        .filter((carrito) => draft.selectedCarritoIds.includes(carrito.id));

      if (selectedCarritos.length === 0) {
        set({ saving: false, error: "Seleccioná al menos un carrito para facturar." });
        return false;
      }
    }

    const netoGravado = isFacturaCarritos
      ? selectedCarritos.reduce((total, carrito) => {
          const control = carrito.carritos_control?.[0];
          return total + getNumber(control?.importe_a_facturar);
        }, 0)
      : parseMoney(draft.neto_gravado);

    if (!isFacturaCarritos && netoGravado <= 0) {
      set({ saving: false, error: "Ingresá un importe válido." });
      return false;
    }

    const totals =
      isPostventa || draft.tipo_documento === "NOTA_CREDITO" || draft.tipo_documento === "NOTA_DEBITO"
        ? calculateDocumentTotals(netoGravado, draft.tipo_documento)
        : { neto: netoGravado, iva: 0, total: netoGravado };

    const payload = {
      tipo_documento: draft.tipo_documento,
      numero_documento: draft.numero_documento.trim(),
      razon_social: draft.razon_social.trim() || "ALMUNDO.COM",
      moneda: draft.moneda,
      sucursal_id: draft.sucursal_id,
      sucursal,
      mes: draft.mes ? Number(draft.mes) : null,
      anio: draft.anio ? Number(draft.anio) : null,
      neto_gravado: totals.neto,
      alicuota_iva: isFacturaCarritos ? 0 : 21,
      iva_importe: totals.iva,
      no_gravado: 0,
      exento: 0,
      total: totals.total,
      estado: "PENDIENTE",
      cobrado: false,
      forma_cobro: null,
      caja_id: null,
      caja: null,
      referencia_cobro: null,
      no_impacta_caja: false,
      observaciones: draft.observaciones || null,
      created_by: currentUserId
    };

    const facturaRes = await supabase.from("facturas_cobrar").insert(payload).select("*").single();

    if (facturaRes.error || !facturaRes.data) {
      set({ saving: false, error: normalizeError(facturaRes.error) });
      return false;
    }

    const factura = facturaRes.data as FacturaCobrar;

    if (isFacturaCarritos) {
      const relaciones = selectedCarritos.map((carrito) => {
        const control = carrito.carritos_control?.[0];

        return {
          factura_id: factura.id,
          carrito_id: carrito.id,
          control_id: control?.id || null,
          numero_carrito: carrito.numero_carrito,
          pasajero: carrito.clientes?.nombre_completo || null,
          fecha_venta: carrito.fecha_venta,
          importe_facturado: getNumber(control?.importe_a_facturar),
          moneda: carrito.moneda
        };
      });

      const relacionesRes = await supabase.from("facturas_cobrar_carritos").insert(relaciones);

      if (relacionesRes.error) {
        set({ saving: false, error: normalizeError(relacionesRes.error) });
        return false;
      }

      const controlIds = relaciones.map((item) => item.control_id).filter(Boolean);

      if (controlIds.length > 0) {
        const controlesRes = await supabase
          .from("carritos_control")
          .update({
            facturado: true,
            facturado_at: new Date().toISOString(),
            facturado_by: currentUserId
          })
          .in("id", controlIds);

        if (controlesRes.error) {
          set({ saving: false, error: normalizeError(controlesRes.error) });
          return false;
        }
      }
    }

    await get().loadFacturas();

    set({ saving: false, selectedFacturaId: factura.id });
    return true;
  },

  cobrarFactura: async (factura, draft) => {
    get().selectOnlyFactura(factura.id);
    return get().cobrarFacturasSeleccionadas(draft);
  },

  cobrarFacturasSeleccionadas: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const selectedFacturas = get().getSelectedFacturas();

    if (selectedFacturas.length === 0) {
      set({ saving: false, error: "Seleccioná al menos una factura." });
      return false;
    }

    const moneda = selectedFacturas[0]?.moneda || "ARS";
    const sucursalId = selectedFacturas[0]?.sucursal_id || null;
    const sucursal = selectedFacturas[0]?.sucursal || getSucursalName(get().catalogos.sucursales, sucursalId);

    const sameMoneda = selectedFacturas.every((factura) => factura.moneda === moneda);
    const sameSucursal = selectedFacturas.every((factura) => (factura.sucursal_id || null) === sucursalId);

    if (!sameMoneda) {
      set({ saving: false, error: "Para registrar un cobro agrupado, todas las facturas deben ser de la misma moneda." });
      return false;
    }

    if (!sameSucursal) {
      set({ saving: false, error: "Para registrar un cobro agrupado, todas las facturas deben ser de la misma sucursal." });
      return false;
    }

    const noImpactaCaja = draft.forma_cobro === "CASHFLOW";
    const caja = get().catalogos.cajas.find((item) => item.id === draft.caja_id) || null;

    if (!noImpactaCaja && !caja) {
      set({ saving: false, error: "Seleccioná una caja/banco para registrar la transferencia." });
      return false;
    }

    const totalFacturas = selectedFacturas.reduce((total, factura) => total + getNumber(factura.total), 0);
    const importeIngresadoBanco = noImpactaCaja ? totalFacturas : parseMoney(draft.importe_ingresado_banco || totalFacturas);

    if (!noImpactaCaja && importeIngresadoBanco <= 0) {
      set({ saving: false, error: "Ingresá el importe que entró realmente al banco." });
      return false;
    }

    if (importeIngresadoBanco > totalFacturas) {
      set({ saving: false, error: "El importe ingresado al banco no puede superar el total de las facturas seleccionadas." });
      return false;
    }

    const totalRetenciones = Math.max(totalFacturas - importeIngresadoBanco, 0);

    const cobroRes = await supabase
      .from("facturas_cobrar_cobros")
      .insert({
        fecha_cobro: new Date().toISOString().slice(0, 10),
        moneda,
        sucursal_id: sucursalId,
        sucursal,
        total_facturas: totalFacturas,
        importe_ingresado_banco: importeIngresadoBanco,
        total_retenciones: totalRetenciones,
        caja_id: noImpactaCaja ? null : caja?.id || null,
        caja: noImpactaCaja ? null : caja?.nombre || null,
        forma_cobro: draft.forma_cobro,
        referencia: draft.referencia_cobro || null,
        observaciones: draft.observaciones || null,
        created_by: currentUserId
      })
      .select("*")
      .single();

    if (cobroRes.error || !cobroRes.data) {
      set({ saving: false, error: normalizeError(cobroRes.error) });
      return false;
    }

    const cobroId = cobroRes.data.id as string;

    let acumuladoCobrado = 0;
    let acumuladoRetencion = 0;

    const items = selectedFacturas.map((factura, index) => {
      const importeFactura = getNumber(factura.total);
      const isLast = index === selectedFacturas.length - 1;

      const importeRetencion = isLast
        ? Math.max(totalRetenciones - acumuladoRetencion, 0)
        : Number(((importeFactura / totalFacturas) * totalRetenciones).toFixed(2));

      const importeCobrado = isLast
        ? Math.max(importeIngresadoBanco - acumuladoCobrado, 0)
        : Number((importeFactura - importeRetencion).toFixed(2));

      acumuladoCobrado += importeCobrado;
      acumuladoRetencion += importeRetencion;

      return {
        cobro_id: cobroId,
        factura_id: factura.id,
        numero_documento: factura.numero_documento,
        moneda: factura.moneda,
        importe_factura: importeFactura,
        importe_cobrado: importeCobrado,
        importe_retencion: importeRetencion
      };
    });

    const itemsRes = await supabase.from("facturas_cobrar_cobros_items").insert(items);

    if (itemsRes.error) {
      set({ saving: false, error: normalizeError(itemsRes.error) });
      return false;
    }

    const facturaIds = selectedFacturas.map((factura) => factura.id);

    const facturasRes = await supabase
      .from("facturas_cobrar")
      .update({
        estado: "COBRADA",
        cobrado: true,
        cobrado_at: new Date().toISOString(),
        cobrado_by: currentUserId,
        forma_cobro: draft.forma_cobro,
        caja_id: noImpactaCaja ? null : caja?.id || null,
        caja: noImpactaCaja ? null : caja?.nombre || null,
        referencia_cobro: draft.referencia_cobro || null,
        no_impacta_caja: noImpactaCaja,
        observaciones: draft.observaciones || null
      })
      .in("id", facturaIds);

    if (facturasRes.error) {
      set({ saving: false, error: normalizeError(facturasRes.error) });
      return false;
    }

    const controlIds = selectedFacturas
      .flatMap((factura) => factura.facturas_cobrar_carritos || [])
      .map((item) => item.control_id)
      .filter(Boolean) as string[];

    if (controlIds.length > 0) {
      const controlesRes = await supabase
        .from("carritos_control")
        .update({
          cobrado: true,
          cobrado_at: new Date().toISOString(),
          cobrado_by: currentUserId
        })
        .in("id", controlIds);

      if (controlesRes.error) {
        set({ saving: false, error: normalizeError(controlesRes.error) });
        return false;
      }
    }

    await get().loadFacturas();

    set({
      saving: false,
      selectedFacturaIds: [],
      selectedFacturaId: null,
      selectedTab: "COBRADA",
      filters: {
        ...get().filters,
        estado: "COBRADA"
      }
    });

    return true;
  },

  setTab: (tab) => {
    set((state) => ({
      selectedTab: tab,
      selectedFacturaId: null,
      selectedFacturaIds: [],
      filters: {
        ...state.filters,
        estado: tab === "COBRADA" ? "COBRADA" : tab === "PENDIENTE" ? "PENDIENTE" : state.filters.estado
      }
    }));
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value },
      selectedFacturaId: null,
      selectedFacturaIds: []
    }));
  },

  setMonth: (mes, anio) => {
    const normalized = normalizeMonthYear(mes, anio);

    set((state) => ({
      filters: {
        ...state.filters,
        mes: normalized.mes,
        anio: normalized.anio
      },
      selectedFacturaId: null,
      selectedFacturaIds: []
    }));
  },

  goToPreviousMonth: () => {
    const { filters } = get();
    get().setMonth(filters.mes - 1, filters.anio);
  },

  goToNextMonth: () => {
    const { filters } = get();
    get().setMonth(filters.mes + 1, filters.anio);
  },

  goToCurrentMonth: () => {
    const current = getCurrentMonthYear();
    get().setMonth(current.mes, current.anio);
  },

  resetFilters: () => {
    set({
      filters: getDefaultFilters(),
      selectedFacturaId: null,
      selectedFacturaIds: [],
      selectedTab: "PENDIENTE"
    });
  },

  selectFactura: (id) => {
    set({ selectedFacturaId: id });
  },

  toggleFacturaSelection: (facturaId) => {
    const factura = get().facturas.find((item) => item.id === facturaId);
    if (!factura) return;

    if (factura.cobrado || factura.estado === "COBRADA") return;

    const selectedFacturas = get().getSelectedFacturas();
if (selectedFacturas.length > 0) {
  const base = selectedFacturas[0];

  if (base.moneda !== factura.moneda) {
    set({
      error: "Solo podés agrupar facturas de la misma moneda."
    });
    return;
  }
}

    set((state) => {
      const exists = state.selectedFacturaIds.includes(facturaId);

      return {
        selectedFacturaIds: exists
          ? state.selectedFacturaIds.filter((id) => id !== facturaId)
          : [...state.selectedFacturaIds, facturaId],
        selectedFacturaId: facturaId
      };
    });
  },

  clearSelection: () => {
    set({ selectedFacturaIds: [] });
  },

  selectOnlyFactura: (facturaId) => {
    set({ selectedFacturaIds: [facturaId], selectedFacturaId: facturaId });
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredFacturas: () => {
    const { facturas, filters } = get();
    const search = normalizeText(filters.search);

    return facturas.filter((factura) => {
      if (search) {
        const haystack = normalizeText(
          [
            factura.numero_documento,
            factura.tipo_documento,
            factura.razon_social,
            factura.sucursal,
            factura.moneda,
            factura.estado,
            factura.observaciones
          ].join(" ")
        );

        if (!haystack.includes(search)) return false;
      }

      return true;
    });
  },

  getSelectedFactura: () => {
    const facturas = get().getFilteredFacturas();
    const selectedFacturaId = get().selectedFacturaId;

    if (!selectedFacturaId) return facturas[0] || null;

    return facturas.find((factura) => factura.id === selectedFacturaId) || facturas[0] || null;
  },

  getSelectedFacturas: () => {
    const selectedIds = get().selectedFacturaIds;
    return get().facturas.filter((factura) => selectedIds.includes(factura.id));
  },

  getSelectedTotal: () => {
    return get()
      .getSelectedFacturas()
      .reduce((total, factura) => total + getNumber(factura.total), 0);
  },

  getSelectedMoneda: () => {
    return get().getSelectedFacturas()[0]?.moneda || null;
  },

  getSelectedSucursalId: () => {
    return get().getSelectedFacturas()[0]?.sucursal_id || null;
  },

  getSelectedSucursal: () => {
    return get().getSelectedFacturas()[0]?.sucursal || null;
  },

  getCarritosDisponiblesForDraft: (draft) => {
    return get().carritosDisponibles.filter((carrito) => {
      const controles = Array.isArray(carrito.carritos_control) ? carrito.carritos_control : [];
      const tieneControlFacturable = controles.some(
        (control) => control.controlado && !control.facturado && !control.anulado
      );

      if (!tieneControlFacturable) return false;
      if (draft.moneda !== carrito.moneda) return false;
      if (draft.sucursal_id && carrito.sucursal_id !== draft.sucursal_id) return false;
      return true;
    });
  },

  getSucursalResumen: () => {
    const { catalogos } = get();
    const facturas = get().getFilteredFacturas();

    const sucursalIds = new Set<string>();

    catalogos.sucursales.forEach((sucursal) => sucursalIds.add(sucursal.id));

    facturas.forEach((factura) => {
      if (factura.sucursal_id) sucursalIds.add(factura.sucursal_id);
    });

    return Array.from(sucursalIds).map((sucursalId) => {
      const sucursal = getSucursalName(catalogos.sucursales, sucursalId);
      const items = facturas.filter((factura) => factura.sucursal_id === sucursalId);

      const buildMoney = (moneda: "ARS" | "USD"): MoneyMetrics => {
        const filtered = items.filter((factura) => factura.moneda === moneda);
        const pendientes = filtered.filter((factura) => !factura.cobrado && factura.estado !== "COBRADA");
        const cobradas = filtered.filter((factura) => factura.cobrado || factura.estado === "COBRADA");

        return {
          pendiente: pendientes.reduce((total, factura) => total + getNumber(factura.total), 0),
          cobradoMes: cobradas.reduce((total, factura) => total + getNumber(factura.total), 0),
          totalDocumentos: filtered.reduce((total, factura) => total + getNumber(factura.total), 0),
          cantidadPendiente: pendientes.length,
          cantidadCobrada: cobradas.length
        };
      };

      return {
        sucursalId,
        sucursal,
        ars: buildMoney("ARS"),
        usd: buildMoney("USD")
      };
    });
  },

  getFacturasAgrupadas: () => {
    const facturas = get().getFilteredFacturas();
    const selectedIds = get().selectedFacturaIds;

    const sucursalMap = new Map<string, FacturasGrupoSucursal>();

    facturas.forEach((factura) => {
      const sucursalKey = factura.sucursal_id || "sin-sucursal";
      const sucursalName = factura.sucursal || "Sin sucursal";

      if (!sucursalMap.has(sucursalKey)) {
        sucursalMap.set(sucursalKey, {
          sucursalId: factura.sucursal_id,
          sucursal: sucursalName,
          monedas: [
            { moneda: "ARS", facturas: [], total: 0, totalSeleccionado: 0, cantidadSeleccionada: 0 },
            { moneda: "USD", facturas: [], total: 0, totalSeleccionado: 0, cantidadSeleccionada: 0 }
          ]
        });
      }

      const grupo = sucursalMap.get(sucursalKey);
      if (!grupo) return;

      const moneda = factura.moneda === "USD" ? "USD" : "ARS";
      const monedaGrupo = grupo.monedas.find((item) => item.moneda === moneda);

      if (!monedaGrupo) return;

      const importe = getNumber(factura.total);

      monedaGrupo.facturas.push(factura);
      monedaGrupo.total += importe;

      if (selectedIds.includes(factura.id)) {
        monedaGrupo.totalSeleccionado += importe;
        monedaGrupo.cantidadSeleccionada += 1;
      }
    });

    return Array.from(sucursalMap.values()).map((grupo) => ({
      ...grupo,
      monedas: grupo.monedas.filter((moneda) => moneda.facturas.length > 0)
    }));
  }
}));