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

export type HorarioTipo = "TURNO" | "VACACIONES" | "FERIADO" | "DIA_LIBRE";

export type HorarioVendedor = {
  id: string;
  vendedor_id: string;
  vendedor: string | null;
  vendedor_email: string | null;
  vendedor_color: string | null;
  vendedor_rol: string | null;

  sucursal_id: string | null;
  sucursal: string | null;
  sucursal_color: string | null;

  fecha: string;
  dia_semana_numero: number;
  dia_semana: string;

  tipo: HorarioTipo;
  hora_inicio: string | null;
  hora_fin: string | null;
  descripcion_celda: string;
  horas: string | number;

  observaciones: string | null;
  activo: boolean;
  creado_por: string | null;
  actualizado_por: string | null;
  created_at: string;
  updated_at: string;
};

export type HorasSemanalesVendedor = {
  vendedor_id: string;
  vendedor: string;
  vendedor_color: string | null;
  sucursal_id: string | null;
  sucursal: string | null;
  horas: string | number;
};

export type HorarioDraft = {
  id?: string | null;
  vendedor_id: string;
  sucursal_id: string | null;
  fecha: string;
  tipo: HorarioTipo;
  hora_inicio: string;
  hora_fin: string;
  observaciones: string;
};

export type HorariosFilters = {
  semanaInicio: string;
  sucursalId: string;
  vendedorId: string;
  search: string;
};

export type HorariosMetrics = {
  vendedores: number;
  turnos: number;
  vacaciones: number;
  feriados: number;
  diasLibres: number;
  horasTotales: number;
};

type CopiarModo = "COMPLETAR_VACIOS" | "REEMPLAZAR";

type HorariosState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageHorarios: boolean;

  horarios: HorarioVendedor[];
  horasSemanales: HorasSemanalesVendedor[];

  catalogos: {
    vendedores: ProfileLite[];
    sucursales: SucursalLite[];
  };

  filters: HorariosFilters;
  selectedHorarioId: string | null;

  loadHorarios: () => Promise<void>;
  saveHorario: (draft: HorarioDraft) => Promise<boolean>;
  deleteHorario: (horarioId: string) => Promise<boolean>;
  copyPreviousWeek: (modo: CopiarModo) => Promise<boolean>;

  setFilter: <K extends keyof HorariosFilters>(key: K, value: HorariosFilters[K]) => void;
  resetFilters: () => void;
  selectHorario: (id: string | null) => void;
  clearError: () => void;

  setSemanaInicio: (value: string) => void;
  goToPreviousWeek: () => void;
  goToNextWeek: () => void;
  goToCurrentWeek: () => void;

  getWeekDays: () => string[];
  getSemanaFin: () => string;
  getFilteredHorarios: () => HorarioVendedor[];
  getHorariosByCell: (vendedorId: string, fecha: string) => HorarioVendedor[];
  getSelectedHorario: () => HorarioVendedor | null;
  getVendedoresVisibles: () => ProfileLite[];
  getMetrics: () => HorariosMetrics;
};

function getToday(): string {
  const now = new Date();
  const argentinaNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" }));
  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function createDateFromStorage(value: string): Date {
  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function formatStorageDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(value: string, days: number): string {
  const date = createDateFromStorage(value);
  date.setDate(date.getDate() + days);

  return formatStorageDate(date);
}

function getMonday(value: string): string {
  const date = createDateFromStorage(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;

  date.setDate(date.getDate() + diff);

  return formatStorageDate(date);
}

function getWeekDaysFromMonday(monday: string): string[] {
  return Array.from({ length: 6 }, (_, index) => addDays(monday, index));
}

function getDefaultFilters(): HorariosFilters {
  return {
    semanaInicio: getMonday(getToday()),
    sucursalId: "todas",
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

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
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
      ["admin_general", "gerencia", "administracion"].includes(String(profile.rol || ""))
  );
}

function canProfileUse(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      ["admin_general", "gerencia", "administracion", "vendedor"].includes(String(profile.rol || ""))
  );
}



function sortByName<T extends { nombre?: string; apellido?: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const nameA = `${a.nombre || ""} ${a.apellido || ""}`.trim();
    const nameB = `${b.nombre || ""} ${b.apellido || ""}`.trim();

    return nameA.localeCompare(nameB);
  });
}

export const useHorariosStore = create<HorariosState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  currentProfile: null,
  canManageHorarios: false,

  horarios: [],
  horasSemanales: [],

  catalogos: {
    vendedores: [],
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedHorarioId: null,

  loadHorarios: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageHorarios: false,
        horarios: [],
        horasSemanales: [],
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
    const canManageHorarios = canProfileManage(currentProfile);

    if (!canProfileUse(currentProfile)) {
      set({
        loading: false,
        currentProfile,
        canManageHorarios,
        horarios: [],
        horasSemanales: [],
        error: "Tu usuario no tiene acceso al módulo Horarios."
      });

      return;
    }

    const filters = get().filters;
    const semanaInicio = getMonday(filters.semanaInicio);
    const semanaFin = addDays(semanaInicio, 5);
    const sucursalId = filters.sucursalId !== "todas" ? filters.sucursalId : null;

    const [
      horariosRes,
      horasRes,
      vendedoresRes,
      sucursalesRes
    ] = await Promise.all([
      supabase
        .from("vw_horarios_vendedores")
        .select("*")
        .eq("activo", true)
        .gte("fecha", semanaInicio)
        .lte("fecha", semanaFin)
        .order("fecha", { ascending: true })
        .order("vendedor", { ascending: true }),

      supabase.rpc("get_horas_semanales_vendedores", {
        p_desde: semanaInicio,
        p_hasta: semanaFin,
        p_sucursal_id: sucursalId
      }),

      supabase
        .from("profiles")
        .select("*")
        .in("rol", ["vendedor", "gerencia", "admin_general", "administracion"])
        .eq("activo", true)
        .order("nombre", { ascending: true }),

      supabase
        .from("sucursales")
        .select("*")
        .order("nombre", { ascending: true })
    ]);

    const firstError =
      horariosRes.error ||
      horasRes.error ||
      vendedoresRes.error ||
      sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageHorarios,
        error: normalizeError(firstError)
      });

      return;
    }

    const horariosRaw = (horariosRes.data || []) as HorarioVendedor[];
    const vendedoresRaw = (vendedoresRes.data || []) as ProfileLite[];
    const sucursalesRaw = (sucursalesRes.data || []) as SucursalLite[];

    const horarios = horariosRaw.filter((item) => {
      if (filters.sucursalId !== "todas" && item.sucursal_id !== filters.sucursalId) return false;
      if (filters.vendedorId !== "todos" && item.vendedor_id !== filters.vendedorId) return false;

      return true;
    });

    let vendedores = vendedoresRaw;

    if (filters.sucursalId !== "todas") {
      vendedores = vendedores.filter((item) => item.sucursal_id === filters.sucursalId);
    }

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageHorarios,
      horarios,
      horasSemanales: (horasRes.data || []) as HorasSemanalesVendedor[],
      catalogos: {
        vendedores: sortByName(vendedores),
        sucursales: sucursalesRaw
      },
      filters: {
        ...filters,
        semanaInicio
      }
    });
  },

  saveHorario: async (draft) => {
    set({ saving: true, error: null });

    const { canManageHorarios } = get();

    if (!canManageHorarios) {
      set({
        saving: false,
        error: "No tenés permisos para modificar horarios."
      });

      return false;
    }

    if (!draft.vendedor_id) {
      set({
        saving: false,
        error: "Seleccioná un vendedor."
      });

      return false;
    }

    if (!draft.fecha) {
      set({
        saving: false,
        error: "Seleccioná una fecha."
      });

      return false;
    }

    if (!draft.tipo) {
      set({
        saving: false,
        error: "Seleccioná un tipo."
      });

      return false;
    }

    if (draft.tipo === "TURNO") {
      if (!draft.hora_inicio || !draft.hora_fin) {
        set({
          saving: false,
          error: "Para un turno tenés que indicar horario de inicio y fin."
        });

        return false;
      }

      if (draft.hora_fin <= draft.hora_inicio) {
        set({
          saving: false,
          error: "El horario de fin debe ser posterior al horario de inicio."
        });

        return false;
      }
    }

    const { error } = await supabase.rpc("guardar_horario_vendedor", {
      p_vendedor_id: draft.vendedor_id,
      p_sucursal_id: draft.sucursal_id || null,
      p_fecha: draft.fecha,
      p_tipo: draft.tipo,
      p_hora_inicio: draft.tipo === "TURNO" ? draft.hora_inicio : null,
      p_hora_fin: draft.tipo === "TURNO" ? draft.hora_fin : null,
      p_observaciones: nullableText(draft.observaciones)
    });

    if (error) {
      set({
        saving: false,
        error: normalizeError(error)
      });

      return false;
    }

    await get().loadHorarios();

    set({ saving: false });
    return true;
  },

  deleteHorario: async (horarioId) => {
    set({ saving: true, error: null });

    const { canManageHorarios } = get();

    if (!canManageHorarios) {
      set({
        saving: false,
        error: "No tenés permisos para eliminar horarios."
      });

      return false;
    }

    if (!horarioId) {
      set({
        saving: false,
        error: "No hay horario seleccionado."
      });

      return false;
    }

    const { error } = await supabase.rpc("eliminar_horario_vendedor", {
      p_horario_id: horarioId
    });

    if (error) {
      set({
        saving: false,
        error: normalizeError(error)
      });

      return false;
    }

    await get().loadHorarios();

    set({
      saving: false,
      selectedHorarioId: null
    });

    return true;
  },

  copyPreviousWeek: async (modo) => {
    set({ saving: true, error: null });

    const { canManageHorarios, filters } = get();

    if (!canManageHorarios) {
      set({
        saving: false,
        error: "No tenés permisos para copiar horarios."
      });

      return false;
    }

    const semanaInicio = getMonday(filters.semanaInicio);
    const sucursalId = filters.sucursalId !== "todas" ? filters.sucursalId : null;

    const { error } = await supabase.rpc("copiar_horarios_semana_anterior", {
      p_semana_inicio: semanaInicio,
      p_sucursal_id: sucursalId,
      p_modo: modo
    });

    if (error) {
      set({
        saving: false,
        error: normalizeError(error)
      });

      return false;
    }

    await get().loadHorarios();

    set({ saving: false });
    return true;
  },

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: key === "semanaInicio" ? getMonday(String(value)) : value
      }
    }));
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters() });
  },

  selectHorario: (id) => {
    set({ selectedHorarioId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  setSemanaInicio: (value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        semanaInicio: getMonday(value)
      }
    }));
  },

  goToPreviousWeek: () => {
    set((state) => ({
      filters: {
        ...state.filters,
        semanaInicio: addDays(state.filters.semanaInicio, -7)
      }
    }));
  },

  goToNextWeek: () => {
    set((state) => ({
      filters: {
        ...state.filters,
        semanaInicio: addDays(state.filters.semanaInicio, 7)
      }
    }));
  },

  goToCurrentWeek: () => {
    set((state) => ({
      filters: {
        ...state.filters,
        semanaInicio: getMonday(getToday())
      }
    }));
  },

  getWeekDays: () => {
    return getWeekDaysFromMonday(get().filters.semanaInicio);
  },

  getSemanaFin: () => {
    return addDays(get().filters.semanaInicio, 5);
  },

  getFilteredHorarios: () => {
    const { horarios, filters } = get();
    const search = normalizeText(filters.search);

    return horarios.filter((item) => {
      if (filters.sucursalId !== "todas" && item.sucursal_id !== filters.sucursalId) return false;
      if (filters.vendedorId !== "todos" && item.vendedor_id !== filters.vendedorId) return false;

      if (!search) return true;

      const haystack = normalizeText(
        [
          item.vendedor,
          item.vendedor_email,
          item.sucursal,
          item.tipo,
          item.descripcion_celda,
          item.observaciones,
          item.fecha
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getHorariosByCell: (vendedorId, fecha) => {
    return get()
      .getFilteredHorarios()
      .filter((item) => item.vendedor_id === vendedorId && item.fecha === fecha)
      .sort((a, b) => {
        const aTime = a.hora_inicio || "99:99";
        const bTime = b.hora_inicio || "99:99";

        return aTime.localeCompare(bTime);
      });
  },

  getSelectedHorario: () => {
    const { selectedHorarioId } = get();

    if (!selectedHorarioId) return null;

    return get().horarios.find((item) => item.id === selectedHorarioId) || null;
  },

  getVendedoresVisibles: () => {
    const { catalogos, filters, horarios } = get();
    const search = normalizeText(filters.search);

    let vendedores = catalogos.vendedores;

    if (filters.sucursalId !== "todas") {
      vendedores = vendedores.filter((item) => item.sucursal_id === filters.sucursalId);
    }

    if (filters.vendedorId !== "todos") {
      vendedores = vendedores.filter((item) => item.id === filters.vendedorId);
    }

    const vendedoresConHorario = new Set(horarios.map((item) => item.vendedor_id));

    vendedores = vendedores.filter((item) => {
      if (String(item.rol || "") === "vendedor") return true;
      return vendedoresConHorario.has(item.id);
    });

    if (!search) return sortByName(vendedores);

    return sortByName(
      vendedores.filter((item) => {
        const haystack = normalizeText(
          [
            item.nombre,
            item.apellido,
            item.email,
            item.rol
          ].join(" ")
        );

        return haystack.includes(search);
      })
    );
  },

  getMetrics: () => {
    const horarios = get().getFilteredHorarios();
    const vendedores = new Set(horarios.map((item) => item.vendedor_id));

    return {
      vendedores: vendedores.size,
      turnos: horarios.filter((item) => item.tipo === "TURNO").length,
      vacaciones: horarios.filter((item) => item.tipo === "VACACIONES").length,
      feriados: horarios.filter((item) => item.tipo === "FERIADO").length,
      diasLibres: horarios.filter((item) => item.tipo === "DIA_LIBRE").length,
      horasTotales: horarios.reduce((total, item) => total + getNumber(item.horas), 0)
    };
  }
}));