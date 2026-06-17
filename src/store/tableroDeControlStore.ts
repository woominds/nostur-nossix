import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type ProfileLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: string;
  color?: string | null;
  activo: boolean;
};

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type TableroFilters = {
  mes: string;
  anio: string;
  search: string;
};

export type KpiPrincipal = {
  facturacionHistoricaUsd: number;
  facturacionHistoricaArs: number;
  facturacionMesUsd: number;
  facturacionMesArs: number;
  facturacionTotalUsd: number;
  facturacionTotalArs: number;
  facturacionAlmundoUsd: number;
  facturacionFilesUsd: number;
  utilidadTotalUsd: number;
  utilidadCarritosUsd: number;
  utilidadFilesUsd: number;
  ventasConfirmadas: number;
  carritosConfirmados: number;
  filesConfirmados: number;
  ticketPromedioUsd: number;
};

export type SerieSemana = {
  semana: string;
  desde: string;
  hasta: string;
  facturacionUsd: number;
  utilidadUsd: number;
  cantidadVentas: number;
};

export type RankingVendedor = {
  vendedorId: string | null;
  vendedor: string;
  sucursalId: string | null;
  sucursal: string;
  facturacionUsd: number;
  utilidadUsd: number;
  cantidadVentas: number;

  metaSemanalUsd: number;
  utilidadSemanalUsd: number;
  avanceSemanalPct: number;
  faltaSemanalUsd: number;
  estadoSemanal: "SIN_META" | "PENDIENTE" | "LOGRADO";

  metaPisoUsd: number;
  metaMedioUsd: number;
  metaLogradoUsd: number;
  avanceMensualPct: number;
  faltaMensualUsd: number;
  proximaMetaLabel: "Piso" | "Medio" | "Logrado" | "Completada" | "Sin meta";
  nivelMensual: "SIN_META" | "PISO" | "MEDIO" | "LOGRADO";
};

export type SucursalResumen = {
  sucursalId: string | null;
  sucursal: string;
  facturacionUsd: number;
  utilidadUsd: number;
  cantidadVentas: number;
};

export type MetaSucursalResumen = {
  sucursalId: string | null;
  sucursal: string;
  actualUsd: number;
  metaPisoUsd: number;
  metaMedioUsd: number;
  metaLogradoUsd: number;
  avancePct: number;
  faltaUsd: number;
  proximaMetaLabel: "Piso" | "Medio" | "Logrado" | "Completada" | "Sin meta";
};

export type MetaAlmundoResumen = {
  sucursalId: string | null;
  sucursal: string;
  actualUsd: number;
  objetivoUsd: number;
  avancePct: number;
  faltaUsd: number;
};

export type RankingSimple = {
  nombre: string;
  valor: number;
  subtitulo?: string;
};

export type PaxMovimiento = {
  id: string;
  pasajero: string;
  destino: string;
  fecha: string;
  vendedor: string;
  tipo: "SALE" | "REGRESA";
};

export type AlertaGestion = {
  tipo: "warning" | "danger" | "info" | "ok";
  titulo: string;
  detalle: string;
  valor?: string;
};

type VentaBase = {
  origen_id: string;
  origen: "CARRITO" | "FILE" | string;
  numero: string;
  fecha: string;
  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal_nombre?: string | null;
  cliente_id: string | null;
  pasajero: string | null;
  moneda: string;
  precio_venta_original: string | number;
  utilidad_original: string | number;
  tc_promedio_usd_ars: string | number;
  facturacion_usd: string | number;
  utilidad_usd: string | number;
  destino?: string | null;
  servicio?: string | null;
  fecha_in?: string | null;
  fecha_out?: string | null;
};

type ComisionMensualView = {
  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;
  mes: number;
  anio: number;
  meta_id: string | null;
  meta_piso_usd: string | number;
  meta_medio_usd: string | number;
  meta_logrado_usd: string | number;
  facturacion_carritos_usd: string | number;
  facturacion_files_usd: string | number;
  facturacion_total_usd: string | number;
  utilidad_carritos_usd: string | number;
  utilidad_files_usd: string | number;
  utilidad_total_usd: string | number;
  nivel_alcanzado: "SIN_META" | "PISO" | "MEDIO" | "LOGRADO" | string;
  porcentaje_comision: string | number;
  comision_estimada_usd: string | number;
  porcentaje_avance_piso: string | number;
  falta_para_piso_usd: string | number;
};

type MetaRow = {
  id: string;
  tipo: string;
  fecha_desde: string;
  fecha_hasta: string;
  mes: number | null;
  anio: number | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  moneda: string;
  meta_unica_usd: string | number;
  meta_piso_usd: string | number;
  meta_medio_usd: string | number;
  meta_logrado_usd: string | number;
  es_meta_almundo: boolean;
  activa: boolean;
};

type TableroControlState = {
  loading: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageDashboard: boolean;

  filters: TableroFilters;

  kpis: KpiPrincipal;
  serieSemanal: SerieSemana[];
  rankingVendedores: RankingVendedor[];
  rankingSucursales: SucursalResumen[];
  metasSucursal: MetaSucursalResumen[];
  metasAlmundo: MetaAlmundoResumen[];
  destinosMensual: RankingSimple[];
  destinosHistorico: RankingSimple[];
  serviciosMensual: RankingSimple[];
  serviciosHistorico: RankingSimple[];
  paxSaliendo: PaxMovimiento[];
  paxRegresando: PaxMovimiento[];
  alertas: AlertaGestion[];

  loadTablero: () => Promise<void>;
  setFilter: <K extends keyof TableroFilters>(key: K, value: TableroFilters[K]) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToCurrentMonth: () => void;
  clearError: () => void;
};

const emptyKpis: KpiPrincipal = {
  facturacionHistoricaUsd: 0,
  facturacionHistoricaArs: 0,
  facturacionMesUsd: 0,
  facturacionMesArs: 0,
  facturacionTotalUsd: 0,
  facturacionTotalArs: 0,
  facturacionAlmundoUsd: 0,
  facturacionFilesUsd: 0,
  utilidadTotalUsd: 0,
  utilidadCarritosUsd: 0,
  utilidadFilesUsd: 0,
  ventasConfirmadas: 0,
  carritosConfirmados: 0,
  filesConfirmados: 0,
  ticketPromedioUsd: 0
};

function getArgentinaDate(): Date {
  const now = new Date();
  return new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }));
}

function getDefaultFilters(): TableroFilters {
  const today = getArgentinaDate();

  return {
    mes: String(today.getMonth() + 1).padStart(2, "0"),
    anio: String(today.getFullYear()),
    search: ""
  };
}

function normalizeMonthYear(mes: number, anio: number): { mes: string; anio: string } {
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
    mes: String(nextMes).padStart(2, "0"),
    anio: String(nextAnio)
  };
}

function getDateStartForQuery(anio: string, mes: string): string {
  return `${anio}-${mes.padStart(2, "0")}-01`;
}

function getDateEndForQuery(anio: string, mes: string): string {
  const year = Number(anio);
  const month = Number(mes);
  const last = new Date(year, month, 0).getDate();

  return `${anio}-${mes.padStart(2, "0")}-${String(last).padStart(2, "0")}`;
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

function getVentaFacturacionArs(venta: VentaBase): number {
  const moneda = String(venta.moneda || "ARS").toUpperCase();
  const precioOriginal = getNumber(venta.precio_venta_original);
  const facturacionUsd = getNumber(venta.facturacion_usd);
  const tc = getNumber(venta.tc_promedio_usd_ars);

  if (moneda === "ARS") {
    return precioOriginal;
  }

  if (moneda === "USD" && precioOriginal > 0 && tc > 0) {
    return precioOriginal * tc;
  }

  if (facturacionUsd > 0 && tc > 0) {
    return facturacionUsd * tc;
  }

  return 0;
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

function getProgress(actual: number, objetivo: number): number {
  if (objetivo <= 0) return 0;
  return Math.max(0, Math.min((actual / objetivo) * 100, 999));
}

function getNextMeta(
  actual: number,
  piso: number,
  medio: number,
  logrado: number
): {
  proximaMetaLabel: "Piso" | "Medio" | "Logrado" | "Completada" | "Sin meta";
  objetivo: number;
  faltaUsd: number;
  avancePct: number;
  nivel: "SIN_META" | "PISO" | "MEDIO" | "LOGRADO";
} {
  if (piso <= 0 && medio <= 0 && logrado <= 0) {
    return {
      proximaMetaLabel: "Sin meta",
      objetivo: 0,
      faltaUsd: 0,
      avancePct: 0,
      nivel: "SIN_META"
    };
  }

  let nivel: "SIN_META" | "PISO" | "MEDIO" | "LOGRADO" = "SIN_META";

  if (logrado > 0 && actual >= logrado) nivel = "LOGRADO";
  else if (medio > 0 && actual >= medio) nivel = "MEDIO";
  else if (piso > 0 && actual >= piso) nivel = "PISO";

  if (piso > 0 && actual < piso) {
    return {
      proximaMetaLabel: "Piso",
      objetivo: piso,
      faltaUsd: piso - actual,
      avancePct: getProgress(actual, piso),
      nivel
    };
  }

  if (medio > 0 && actual < medio) {
    return {
      proximaMetaLabel: "Medio",
      objetivo: medio,
      faltaUsd: medio - actual,
      avancePct: getProgress(actual, medio),
      nivel
    };
  }

  if (logrado > 0 && actual < logrado) {
    return {
      proximaMetaLabel: "Logrado",
      objetivo: logrado,
      faltaUsd: logrado - actual,
      avancePct: getProgress(actual, logrado),
      nivel
    };
  }

  return {
    proximaMetaLabel: "Completada",
    objetivo: logrado || medio || piso,
    faltaUsd: 0,
    avancePct: 100,
    nivel
  };
}

function getSucursalName(sucursales: SucursalLite[], sucursalId: string | null): string {
  if (!sucursalId) return "Sin sucursal";
  return sucursales.find((item) => item.id === sucursalId)?.nombre || "Sin sucursal";
}

function getWeekBuckets(desde: string, hasta: string): Array<{ label: string; desde: string; hasta: string }> {
  const start = new Date(`${desde}T00:00:00`);
  const end = new Date(`${hasta}T00:00:00`);
  const buckets: Array<{ label: string; desde: string; hasta: string }> = [];

  let cursor = new Date(start);
  let index = 1;

  while (cursor <= end) {
    const bucketStart = new Date(cursor);
    const bucketEnd = new Date(cursor);
    bucketEnd.setDate(bucketEnd.getDate() + 6);

    if (bucketEnd > end) bucketEnd.setTime(end.getTime());

    buckets.push({
      label: `Sem ${index}`,
      desde: bucketStart.toISOString().slice(0, 10),
      hasta: bucketEnd.toISOString().slice(0, 10)
    });

    cursor.setDate(cursor.getDate() + 7);
    index += 1;
  }

  return buckets;
}

function getCurrentWeekRange(monthStart: string, monthEnd: string): { desde: string; hasta: string } {
  const today = getArgentinaDate().toISOString().slice(0, 10);

  if (today < monthStart || today > monthEnd) {
    const buckets = getWeekBuckets(monthStart, monthEnd);
    return buckets[0] || { desde: monthStart, hasta: monthEnd };
  }

  const current = new Date(`${today}T00:00:00`);
  const day = current.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const weekStart = new Date(current);
  weekStart.setDate(current.getDate() + diffToMonday);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  const weekStartStr = weekStart.toISOString().slice(0, 10);
  const weekEndStr = weekEnd.toISOString().slice(0, 10);

  return {
    desde: weekStartStr < monthStart ? monthStart : weekStartStr,
    hasta: weekEndStr > monthEnd ? monthEnd : weekEndStr
  };
}

function buildRankingSimpleFromVentas(
  ventas: VentaBase[],
  field: "destino" | "servicio",
  limit = 7
): RankingSimple[] {
  const map = new Map<string, number>();

  ventas.forEach((venta) => {
    const record = venta as unknown as Record<string, unknown>;
    const raw = record[field];
    const key = String(raw || "").trim();

    if (!key || key === "null" || key === "undefined") return;

    map.set(key, (map.get(key) || 0) + 1);
  });

  return Array.from(map.entries())
    .map(([nombre, valor]) => ({ nombre, valor }))
    .sort((a, b) => b.valor - a.valor)
    .slice(0, limit);
}

function isSameMonthMeta(meta: MetaRow, mes: number, anio: number): boolean {
  return Number(meta.mes || 0) === mes && Number(meta.anio || 0) === anio;
}

function overlapsPeriod(meta: MetaRow, desde: string, hasta: string): boolean {
  return meta.fecha_desde <= hasta && meta.fecha_hasta >= desde;
}

function getMetaVendedorSemanal(
  metas: MetaRow[],
  vendedorId: string | null,
  fechaDesde: string,
  fechaHasta: string
): MetaRow | null {
  const metasSemanales = metas.filter(
    (meta) =>
      meta.tipo === "VENDEDOR_SEMANAL" &&
      meta.activa &&
      overlapsPeriod(meta, fechaDesde, fechaHasta)
  );

  const particular = metasSemanales.find((meta) => meta.vendedor_id === vendedorId);
  if (particular) return particular;

  return metasSemanales.find((meta) => meta.vendedor_id === null) || null;
}

function getMetaVendedorMensual(
  metas: MetaRow[],
  vendedorId: string | null,
  mes: number,
  anio: number
): MetaRow | null {
  const metasMensuales = metas.filter(
    (meta) =>
      meta.tipo === "VENDEDOR_MENSUAL" &&
      meta.activa &&
      isSameMonthMeta(meta, mes, anio)
  );

  const particular = metasMensuales.find((meta) => meta.vendedor_id === vendedorId);
  if (particular) return particular;

  return metasMensuales.find((meta) => meta.vendedor_id === null) || null;
}

function getMetaAlmundoSucursal(
  metas: MetaRow[],
  sucursalId: string | null,
  mes: number,
  anio: number
): MetaRow | null {
  return (
    metas.find(
      (meta) =>
        meta.tipo === "ALMUNDO_MENSUAL" &&
        meta.activa &&
        meta.sucursal_id === sucursalId &&
        isSameMonthMeta(meta, mes, anio)
    ) || null
  );
}

function getMetaUtilidadSucursal(
  metas: MetaRow[],
  sucursalId: string | null,
  mes: number,
  anio: number
): MetaRow | null {
  return (
    metas.find(
      (meta) =>
        meta.tipo === "SUCURSAL_MENSUAL" &&
        meta.activa &&
        meta.sucursal_id === sucursalId &&
        isSameMonthMeta(meta, mes, anio)
    ) || null
  );
}

function getMetaAlmundoObjetivo(meta: MetaRow | null): number {
  if (!meta) return 0;

  const metaUnica = getNumber(meta.meta_unica_usd);
  if (metaUnica > 0) return metaUnica;

  const metaLogrado = getNumber(meta.meta_logrado_usd);
  if (metaLogrado > 0) return metaLogrado;

  const metaPiso = getNumber(meta.meta_piso_usd);
  if (metaPiso > 0) return metaPiso;

  return 0;
}

function buildAlertas(
  kpis: KpiPrincipal,
  metasAlmundo: MetaAlmundoResumen[],
  metasSucursal: MetaSucursalResumen[]
): AlertaGestion[] {
  const alertas: AlertaGestion[] = [];

  if (kpis.ventasConfirmadas === 0) {
    alertas.push({
      tipo: "warning",
      titulo: "Sin ventas confirmadas",
      detalle: "No hay carritos ni files confirmados en el período seleccionado."
    });
  }

  const almundoSinAvance = metasAlmundo.filter((item) => item.objetivoUsd > 0 && item.avancePct < 50);

  if (almundoSinAvance.length > 0) {
    alertas.push({
      tipo: "info",
      titulo: "Meta Almundo con avance bajo",
      detalle: `${almundoSinAvance.length} sucursal/es están por debajo del 50% de avance.`,
      valor: `${Math.round(Math.min(...almundoSinAvance.map((item) => item.avancePct)))}%`
    });
  }

  const sucursalSinMeta = metasSucursal.filter((item) => item.metaPisoUsd <= 0);

  if (sucursalSinMeta.length > 0) {
    alertas.push({
      tipo: "warning",
      titulo: "Metas de utilidad sin configurar",
      detalle: `${sucursalSinMeta.length} sucursal/es no tienen meta mensual de utilidad.`
    });
  }

  return alertas;
}

export const useTableroDeControlStore = create<TableroControlState>((set, get) => ({
  loading: false,
  error: null,

  currentProfile: null,
  canManageDashboard: false,

  filters: getDefaultFilters(),

  kpis: emptyKpis,
  serieSemanal: [],
  rankingVendedores: [],
  rankingSucursales: [],
  metasSucursal: [],
  metasAlmundo: [],
  destinosMensual: [],
  destinosHistorico: [],
  serviciosMensual: [],
  serviciosHistorico: [],
  paxSaliendo: [],
  paxRegresando: [],
  alertas: [],

  loadTablero: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageDashboard: false,
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
    const canManageDashboard = canProfileManage(currentProfile);

    const filters = get().filters;
    const mesNumber = Number(filters.mes);
    const anioNumber = Number(filters.anio);
    const desde = getDateStartForQuery(filters.anio, filters.mes);
    const hasta = getDateEndForQuery(filters.anio, filters.mes);
    const semanaActual = getCurrentWeekRange(desde, hasta);

    const [mensualRes, ventasMesRes, ventasHistoricoRes, metasRes, sucursalesRes] =
      await Promise.all([
        supabase
          .from("vw_comisiones_vendedores_mensual")
          .select("*")
          .eq("mes", mesNumber)
          .eq("anio", anioNumber)
          .order("utilidad_total_usd", { ascending: false }),

        supabase
          .from("vw_comisiones_ventas_base")
          .select("*")
          .gte("fecha", desde)
          .lte("fecha", hasta)
          .order("fecha", { ascending: false }),

        supabase
          .from("vw_comisiones_ventas_base")
          .select("*")
          .order("fecha", { ascending: false })
          .limit(2500),

        supabase
          .from("metas")
          .select("*")
          .eq("activa", true),

        supabase.from("sucursales").select("*").order("nombre")
      ]);

    const firstError =
      mensualRes.error ||
      ventasMesRes.error ||
      ventasHistoricoRes.error ||
      metasRes.error ||
      sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageDashboard,
        error: normalizeError(firstError)
      });
      return;
    }

    const mensual = (mensualRes.data || []) as ComisionMensualView[];
    const ventasMes = (ventasMesRes.data || []) as VentaBase[];
    const ventasHistorico = (ventasHistoricoRes.data || []) as VentaBase[];
    const sucursales = (sucursalesRes.data || []) as SucursalLite[];

    const metasRows = ((metasRes.data || []) as MetaRow[]).filter((meta) => {
      const coincideMesAnio = isSameMonthMeta(meta, mesNumber, anioNumber);
      const cruzaMes = overlapsPeriod(meta, desde, hasta);
      const cruzaSemanaActual = overlapsPeriod(meta, semanaActual.desde, semanaActual.hasta);

      return coincideMesAnio || cruzaMes || cruzaSemanaActual;
    });

   const facturacionCarritosMesUsd = ventasMes
  .filter((venta) => venta.origen === "CARRITO")
  .reduce((total, venta) => total + getNumber(venta.facturacion_usd), 0);

const facturacionFilesMesUsd = ventasMes
  .filter((venta) => venta.origen === "FILE")
  .reduce((total, venta) => total + getNumber(venta.facturacion_usd), 0);

const facturacionMesUsd = facturacionCarritosMesUsd + facturacionFilesMesUsd;

const facturacionMesArs = ventasMes.reduce(
  (total, venta) => total + getVentaFacturacionArs(venta),
  0
);

const facturacionHistoricaUsd = ventasHistorico.reduce(
  (total, venta) => total + getNumber(venta.facturacion_usd),
  0
);

const facturacionHistoricaArs = ventasHistorico.reduce(
  (total, venta) => total + getVentaFacturacionArs(venta),
  0
);

const utilidadCarritosUsd = ventasMes
  .filter((venta) => venta.origen === "CARRITO")
  .reduce((total, venta) => total + getNumber(venta.utilidad_usd), 0);

const utilidadFilesUsd = ventasMes
  .filter((venta) => venta.origen === "FILE")
  .reduce((total, venta) => total + getNumber(venta.utilidad_usd), 0);

const utilidadTotalUsd = utilidadCarritosUsd + utilidadFilesUsd;

const kpis: KpiPrincipal = {
  facturacionHistoricaUsd,
  facturacionHistoricaArs,

  facturacionMesUsd,
  facturacionMesArs,

  facturacionTotalUsd: facturacionMesUsd,
  facturacionTotalArs: facturacionMesArs,

  facturacionAlmundoUsd: facturacionCarritosMesUsd,
  facturacionFilesUsd: facturacionFilesMesUsd,

  utilidadTotalUsd,
  utilidadCarritosUsd,
  utilidadFilesUsd,

  ventasConfirmadas: ventasMes.length,
  carritosConfirmados: ventasMes.filter((venta) => venta.origen === "CARRITO").length,
  filesConfirmados: ventasMes.filter((venta) => venta.origen === "FILE").length,
  ticketPromedioUsd: ventasMes.length > 0 ? facturacionMesUsd / ventasMes.length : 0
};

    const weeks = getWeekBuckets(desde, hasta);

    const serieSemanal: SerieSemana[] = weeks.map((week) => {
      const ventasSemana = ventasMes.filter((venta) => venta.fecha >= week.desde && venta.fecha <= week.hasta);

      return {
        semana: week.label,
        desde: week.desde,
        hasta: week.hasta,
        facturacionUsd: ventasSemana.reduce((total, venta) => total + getNumber(venta.facturacion_usd), 0),
        utilidadUsd: ventasSemana.reduce((total, venta) => total + getNumber(venta.utilidad_usd), 0),
        cantidadVentas: ventasSemana.length
      };
    });

    const ventasPorVendedorMap = new Map<string, VentaBase[]>();

    ventasMes.forEach((venta) => {
      const key = venta.vendedor_id || `sin-vendedor-${normalizeText(venta.vendedor) || "general"}`;
      const current = ventasPorVendedorMap.get(key) || [];
      current.push(venta);
      ventasPorVendedorMap.set(key, current);
    });

    const mensualPorVendedorMap = new Map<string, ComisionMensualView[]>();

    mensual.forEach((item) => {
      const key = item.vendedor_id || `sin-vendedor-${normalizeText(item.vendedor) || "general"}`;
      const current = mensualPorVendedorMap.get(key) || [];
      current.push(item);
      mensualPorVendedorMap.set(key, current);
    });

    const vendedorKeys = new Set<string>([
      ...Array.from(ventasPorVendedorMap.keys()),
      ...Array.from(mensualPorVendedorMap.keys())
    ]);

    const rankingVendedores: RankingVendedor[] = Array.from(vendedorKeys).map((key) => {
      const ventasDelVendedor = ventasPorVendedorMap.get(key) || [];
      const mensualDelVendedor = mensualPorVendedorMap.get(key) || [];
      const firstMensual = mensualDelVendedor[0] || null;
      const firstVenta = ventasDelVendedor[0] || null;
      const vendedorId = firstMensual?.vendedor_id || firstVenta?.vendedor_id || null;

      const ventasSemanaActual = ventasDelVendedor.filter(
        (venta) => venta.fecha >= semanaActual.desde && venta.fecha <= semanaActual.hasta
      );

      const utilidadMensual =
        mensualDelVendedor.length > 0
          ? mensualDelVendedor.reduce((total, item) => total + getNumber(item.utilidad_total_usd), 0)
          : ventasDelVendedor.reduce((total, venta) => total + getNumber(venta.utilidad_usd), 0);

      const facturacionMensual =
        mensualDelVendedor.length > 0
          ? mensualDelVendedor.reduce((total, item) => total + getNumber(item.facturacion_total_usd), 0)
          : ventasDelVendedor.reduce((total, venta) => total + getNumber(venta.facturacion_usd), 0);

      const utilidadSemanalUsd = ventasSemanaActual.reduce(
        (total, venta) => total + getNumber(venta.utilidad_usd),
        0
      );

      const metaMensual = getMetaVendedorMensual(metasRows, vendedorId, mesNumber, anioNumber);

      const metaPiso =
        getNumber(metaMensual?.meta_piso_usd) ||
        mensualDelVendedor.reduce((max, item) => Math.max(max, getNumber(item.meta_piso_usd)), 0);

      const metaMedio =
        getNumber(metaMensual?.meta_medio_usd) ||
        mensualDelVendedor.reduce((max, item) => Math.max(max, getNumber(item.meta_medio_usd)), 0);

      const metaLogrado =
        getNumber(metaMensual?.meta_logrado_usd) ||
        mensualDelVendedor.reduce((max, item) => Math.max(max, getNumber(item.meta_logrado_usd)), 0);

      const next = getNextMeta(utilidadMensual, metaPiso, metaMedio, metaLogrado);

      const metaSemanal = getMetaVendedorSemanal(
        metasRows,
        vendedorId,
        semanaActual.desde,
        semanaActual.hasta
      );

      const metaSemanalUsd = getNumber(metaSemanal?.meta_unica_usd);
      const avanceSemanalPct = getProgress(utilidadSemanalUsd, metaSemanalUsd);
      const faltaSemanalUsd = Math.max(metaSemanalUsd - utilidadSemanalUsd, 0);

      return {
        vendedorId,
        vendedor: firstMensual?.vendedor || firstVenta?.vendedor || "Sin vendedor",
        sucursalId: firstMensual?.sucursal_id || firstVenta?.sucursal_id || null,
        sucursal: "",
        facturacionUsd: facturacionMensual,
        utilidadUsd: utilidadMensual,
        cantidadVentas: ventasDelVendedor.length,

        metaSemanalUsd,
        utilidadSemanalUsd,
        avanceSemanalPct,
        faltaSemanalUsd,
        estadoSemanal:
          metaSemanalUsd <= 0
            ? "SIN_META"
            : utilidadSemanalUsd >= metaSemanalUsd
              ? "LOGRADO"
              : "PENDIENTE",

        metaPisoUsd: metaPiso,
        metaMedioUsd: metaMedio,
        metaLogradoUsd: metaLogrado,
        avanceMensualPct: next.avancePct,
        faltaMensualUsd: next.faltaUsd,
        proximaMetaLabel: next.proximaMetaLabel,
        nivelMensual: next.nivel
      };
    });

    const sucursalMap = new Map<string, SucursalResumen>();

    ventasMes.forEach((venta) => {
      const key = venta.sucursal_id || "sin-sucursal";

      const current = sucursalMap.get(key) || {
        sucursalId: venta.sucursal_id,
        sucursal: getSucursalName(sucursales, venta.sucursal_id),
        facturacionUsd: 0,
        utilidadUsd: 0,
        cantidadVentas: 0
      };

      current.facturacionUsd += getNumber(venta.facturacion_usd);
      current.utilidadUsd += getNumber(venta.utilidad_usd);
      current.cantidadVentas += 1;

      sucursalMap.set(key, current);
    });

    const rankingSucursales = Array.from(sucursalMap.values()).sort(
      (a, b) => b.facturacionUsd - a.facturacionUsd
    );

    const metasSucursal: MetaSucursalResumen[] = sucursales.map((sucursal) => {
      const actual = rankingSucursales.find((item) => item.sucursalId === sucursal.id)?.utilidadUsd || 0;
      const meta = getMetaUtilidadSucursal(metasRows, sucursal.id, mesNumber, anioNumber);

      const piso = getNumber(meta?.meta_piso_usd);
      const medio = getNumber(meta?.meta_medio_usd);
      const logrado = getNumber(meta?.meta_logrado_usd);
      const next = getNextMeta(actual, piso, medio, logrado);

      return {
        sucursalId: sucursal.id,
        sucursal: sucursal.nombre,
        actualUsd: actual,
        metaPisoUsd: piso,
        metaMedioUsd: medio,
        metaLogradoUsd: logrado,
        avancePct: next.avancePct,
        faltaUsd: next.faltaUsd,
        proximaMetaLabel: next.proximaMetaLabel
      };
    });

    const metasAlmundo: MetaAlmundoResumen[] = sucursales.map((sucursal) => {
      const actual = ventasMes
        .filter((venta) => venta.origen === "CARRITO" && venta.sucursal_id === sucursal.id)
        .reduce((total, venta) => total + getNumber(venta.facturacion_usd), 0);

      const meta = getMetaAlmundoSucursal(metasRows, sucursal.id, mesNumber, anioNumber);
      const objetivo = getMetaAlmundoObjetivo(meta);
      const avance = getProgress(actual, objetivo);

      return {
        sucursalId: sucursal.id,
        sucursal: sucursal.nombre,
        actualUsd: actual,
        objetivoUsd: objetivo,
        avancePct: avance,
        faltaUsd: Math.max(objetivo - actual, 0)
      };
    });

    const destinosMensual = buildRankingSimpleFromVentas(ventasMes, "destino");
    const destinosHistorico = buildRankingSimpleFromVentas(ventasHistorico, "destino");
    const serviciosMensual = buildRankingSimpleFromVentas(ventasMes, "servicio");
    const serviciosHistorico = buildRankingSimpleFromVentas(ventasHistorico, "servicio");

    const today = getArgentinaDate().toISOString().slice(0, 10);
    const next30 = new Date(getArgentinaDate());
    next30.setDate(next30.getDate() + 30);
    const next30Str = next30.toISOString().slice(0, 10);

    const paxSaliendo: PaxMovimiento[] = ventasHistorico
      .filter((venta) => {
        const fechaIn = String((venta as unknown as Record<string, unknown>).fecha_in || "");
        return fechaIn >= today && fechaIn <= next30Str;
      })
      .slice(0, 6)
      .map((venta) => ({
        id: `${venta.origen}-${venta.origen_id}-sale`,
        pasajero: venta.pasajero || "Sin pasajero",
        destino: String((venta as unknown as Record<string, unknown>).destino || "Sin destino"),
        fecha: String((venta as unknown as Record<string, unknown>).fecha_in || ""),
        vendedor: venta.vendedor || "Sin vendedor",
        tipo: "SALE"
      }));

    const paxRegresando: PaxMovimiento[] = ventasHistorico
      .filter((venta) => {
        const fechaOut = String((venta as unknown as Record<string, unknown>).fecha_out || "");
        return fechaOut >= today && fechaOut <= next30Str;
      })
      .slice(0, 6)
      .map((venta) => ({
        id: `${venta.origen}-${venta.origen_id}-regresa`,
        pasajero: venta.pasajero || "Sin pasajero",
        destino: String((venta as unknown as Record<string, unknown>).destino || "Sin destino"),
        fecha: String((venta as unknown as Record<string, unknown>).fecha_out || ""),
        vendedor: venta.vendedor || "Sin vendedor",
        tipo: "REGRESA"
      }));

    const search = normalizeText(filters.search);

    const filteredRankingVendedores = search
      ? rankingVendedores.filter((item) => normalizeText(item.vendedor).includes(search))
      : rankingVendedores;

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageDashboard,
      kpis,
      serieSemanal,
      rankingVendedores: filteredRankingVendedores,
      rankingSucursales,
      metasSucursal,
      metasAlmundo,
      destinosMensual,
      destinosHistorico,
      serviciosMensual,
      serviciosHistorico,
      paxSaliendo,
      paxRegresando,
      alertas: buildAlertas(kpis, metasAlmundo, metasSucursal)
    });
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }));
  },

  goToPreviousMonth: () => {
    const { filters } = get();
    const normalized = normalizeMonthYear(Number(filters.mes) - 1, Number(filters.anio));

    set((state) => ({
      filters: {
        ...state.filters,
        mes: normalized.mes,
        anio: normalized.anio
      }
    }));
  },

  goToNextMonth: () => {
    const { filters } = get();
    const normalized = normalizeMonthYear(Number(filters.mes) + 1, Number(filters.anio));

    set((state) => ({
      filters: {
        ...state.filters,
        mes: normalized.mes,
        anio: normalized.anio
      }
    }));
  },

  goToCurrentMonth: () => {
    const current = getDefaultFilters();

    set((state) => ({
      filters: {
        ...state.filters,
        mes: current.mes,
        anio: current.anio
      }
    }));
  },

  clearError: () => {
    set({ error: null });
  }
}));