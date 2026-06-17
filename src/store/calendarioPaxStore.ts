import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type ProfileLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: string;
  color: string | null;
  activo: boolean;
};

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type CalendarioPaxEvento = {
  id: string;
  cliente_id: string | null;
  pasajero: string | null;
  telefono: string | null;
  email: string | null;
  fecha: string;
  tipo_evento: "IN" | "OUT";
  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  cantidad_servicios: number;
  origenes: string | null;
  numeros: string | null;
  destinos: string | null;
  servicios: string | null;
  primer_created_at: string | null;
  ultimo_created_at: string | null;
};

export type CalendarioPaxFilters = {
  desde: string;
  hasta: string;
  vendedorId: string;
  sucursalId: string;
  tipoEvento: "todos" | "IN" | "OUT";
  search: string;
};

export type CalendarioPaxMetrics = {
  totalEventos: number;
  totalIn: number;
  totalOut: number;
  totalPasajeros: number;
  proximasSalidas: number;
  proximosRegresos: number;
};

type CalendarioPaxState = {
  loading: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageCalendario: boolean;

  eventos: CalendarioPaxEvento[];

  catalogos: {
    vendedores: ProfileLite[];
    sucursales: SucursalLite[];
  };

  filters: CalendarioPaxFilters;
  selectedDate: string;
  selectedEventId: string | null;
  currentMonth: string;

  loadCalendario: () => Promise<void>;

  setFilter: <K extends keyof CalendarioPaxFilters>(
    key: K,
    value: CalendarioPaxFilters[K]
  ) => void;

  resetFilters: () => void;
  setSelectedDate: (date: string) => void;
  selectEvent: (id: string | null) => void;
  setCurrentMonth: (month: string) => void;
  goToPreviousMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  clearError: () => void;

  getFilteredEventos: () => CalendarioPaxEvento[];
  getEventosByDate: (date: string) => CalendarioPaxEvento[];
  getSelectedDateEventos: () => CalendarioPaxEvento[];
  getSelectedEvent: () => CalendarioPaxEvento | null;
  getMetrics: () => CalendarioPaxMetrics;
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

function getMonthStart(date = getToday()): string {
  return `${date.slice(0, 8)}01`;
}

function getMonthEnd(date = getToday()): string {
  const [yearRaw, monthRaw] = date.slice(0, 7).split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  const lastDay = new Date(year, month, 0).getDate();

  return `${yearRaw}-${monthRaw}-${String(lastDay).padStart(2, "0")}`;
}

function getMonthKey(date = getToday()): string {
  return date.slice(0, 7);
}

function addMonths(monthKey: string, amount: number): string {
  const [yearRaw, monthRaw] = monthKey.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  const next = new Date(year, month - 1 + amount, 1);
  const nextYear = next.getFullYear();
  const nextMonth = String(next.getMonth() + 1).padStart(2, "0");

  return `${nextYear}-${nextMonth}`;
}

function getDefaultFilters(profile?: ProfileLite | null): CalendarioPaxFilters {
  const today = getToday();
  const canManage = canProfileManage(profile || null);

  return {
    desde: getMonthStart(today),
    hasta: getMonthEnd(today),
    vendedorId: canManage ? "todos" : profile?.id || "todos",
    sucursalId: "todos",
    tipoEvento: "todos",
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

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para esta acción.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("does not exist")) {
      return "Falta crear la vista o tabla necesaria en Supabase.";
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

function buildMonthRange(monthKey: string) {
  return {
    desde: getMonthStart(`${monthKey}-01`),
    hasta: getMonthEnd(`${monthKey}-01`)
  };
}

export const useCalendarioPaxStore = create<CalendarioPaxState>((set, get) => ({
  loading: false,
  error: null,

  currentProfile: null,
  canManageCalendario: false,

  eventos: [],

  catalogos: {
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(null),
  selectedDate: getToday(),
  selectedEventId: null,
  currentMonth: getMonthKey(getToday()),

  loadCalendario: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageCalendario: false,
        eventos: [],
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
    const canManageCalendario = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageCalendario,
        eventos: [],
        error: "Tu usuario no tiene acceso al calendario de pasajeros."
      });

      return;
    }

    let filters = get().filters;

    if (!canManageCalendario && filters.vendedorId === "todos") {
      filters = {
        ...filters,
        vendedorId: currentUserId
      };

      set({ filters });
    }

    let eventosQuery = supabase
      .from("vw_calendario_pax")
      .select("*")
      .gte("fecha", filters.desde)
      .lte("fecha", filters.hasta)
      .order("fecha", { ascending: true })
      .order("pasajero", { ascending: true });

    if (!canManageCalendario) {
      eventosQuery = eventosQuery.eq("vendedor_id", currentUserId);
    }

    if (filters.vendedorId !== "todos") {
      eventosQuery = eventosQuery.eq("vendedor_id", filters.vendedorId);
    }

    if (filters.sucursalId !== "todos") {
      eventosQuery = eventosQuery.eq("sucursal_id", filters.sucursalId);
    }

    if (filters.tipoEvento !== "todos") {
      eventosQuery = eventosQuery.eq("tipo_evento", filters.tipoEvento);
    }

    const [eventosRes, vendedoresRes, sucursalesRes] = await Promise.all([
      eventosQuery,
      supabase
        .from("profiles")
        .select("*")
        .in("rol", ["vendedor", "administracion", "gerencia", "admin_general"])
        .eq("activo", true)
        .order("nombre"),
      supabase.from("sucursales").select("*").order("nombre")
    ]);

    const firstError = eventosRes.error || vendedoresRes.error || sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageCalendario,
        error: normalizeError(firstError)
      });

      return;
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageCalendario,
      eventos: (eventosRes.data || []) as CalendarioPaxEvento[],
      catalogos: {
        vendedores: (vendedoresRes.data || []) as ProfileLite[],
        sucursales: (sucursalesRes.data || []) as SucursalLite[]
      }
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

  resetFilters: () => {
    const { currentProfile } = get();
    const today = getToday();
    const monthKey = getMonthKey(today);

    set({
      filters: getDefaultFilters(currentProfile),
      selectedDate: today,
      selectedEventId: null,
      currentMonth: monthKey
    });
  },

  setSelectedDate: (date) => {
    set({
      selectedDate: date,
      selectedEventId: null
    });
  },

  selectEvent: (id) => {
    set({ selectedEventId: id });
  },

  setCurrentMonth: (month) => {
    const range = buildMonthRange(month);

    set((state) => ({
      currentMonth: month,
      selectedDate: `${month}-01`,
      selectedEventId: null,
      filters: {
        ...state.filters,
        desde: range.desde,
        hasta: range.hasta
      }
    }));
  },

  goToPreviousMonth: () => {
    const nextMonth = addMonths(get().currentMonth, -1);
    get().setCurrentMonth(nextMonth);
  },

  goToNextMonth: () => {
    const nextMonth = addMonths(get().currentMonth, 1);
    get().setCurrentMonth(nextMonth);
  },

  goToToday: () => {
    const today = getToday();
    const monthKey = getMonthKey(today);
    const range = buildMonthRange(monthKey);

    set((state) => ({
      currentMonth: monthKey,
      selectedDate: today,
      selectedEventId: null,
      filters: {
        ...state.filters,
        desde: range.desde,
        hasta: range.hasta
      }
    }));
  },

  clearError: () => {
    set({ error: null });
  },

  getFilteredEventos: () => {
    const { eventos, filters } = get();
    const search = normalizeText(filters.search);

    if (!search) return eventos;

    return eventos.filter((evento) => {
      const haystack = normalizeText(
        [
          evento.pasajero,
          evento.telefono,
          evento.email,
          evento.destinos,
          evento.servicios,
          evento.numeros,
          evento.origenes,
          evento.vendedor,
          evento.tipo_evento === "IN" ? "saliendo salida fecha in pax saliendo" : "regresando regreso fecha out pax regresando"
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getEventosByDate: (date) => {
    return get()
      .getFilteredEventos()
      .filter((evento) => evento.fecha === date)
      .sort((a, b) => {
        if (a.tipo_evento !== b.tipo_evento) {
          return a.tipo_evento === "IN" ? -1 : 1;
        }

        return String(a.pasajero || "").localeCompare(String(b.pasajero || ""));
      });
  },

  getSelectedDateEventos: () => {
    return get().getEventosByDate(get().selectedDate);
  },

  getSelectedEvent: () => {
    const { selectedEventId } = get();

    if (!selectedEventId) return null;

    return get().getFilteredEventos().find((evento) => evento.id === selectedEventId) || null;
  },

  getMetrics: () => {
    const eventos = get().getFilteredEventos();
    const today = getToday();

    const uniquePax = new Set(
      eventos.map((evento) =>
        [
          evento.cliente_id || normalizeText(evento.pasajero),
          evento.fecha,
          evento.tipo_evento
        ].join("-")
      )
    );

    return {
      totalEventos: eventos.length,
      totalIn: eventos.filter((evento) => evento.tipo_evento === "IN").length,
      totalOut: eventos.filter((evento) => evento.tipo_evento === "OUT").length,
      totalPasajeros: uniquePax.size,
      proximasSalidas: eventos.filter(
        (evento) => evento.tipo_evento === "IN" && evento.fecha >= today
      ).length,
      proximosRegresos: eventos.filter(
        (evento) => evento.tipo_evento === "OUT" && evento.fecha >= today
      ).length
    };
  }
}));