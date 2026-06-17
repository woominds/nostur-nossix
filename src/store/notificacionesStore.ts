import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type NotificacionTipo = "CTA_CTE_GASTOS";

export type NotificacionPrioridad = "info" | "warning" | "danger" | "ok";

export type NotificacionHome = {
  origen_id: string;
  origen: "CARRITO" | "FILE" | string;
  notificacion_key: string;

  numero_carrito: string | null;
  cliente_id: string | null;
  pasajero: string | null;
  telefono: string | null;
  email: string | null;

  vendedor_id: string | null;
  vendedor: string | null;
  sucursal_id: string | null;
  sucursal: string | null;

  moneda: "ARS" | "USD" | string | null;
  importe_total: string | number | null;
  total_pagado: string | number | null;
  saldo_cta_cte: string | number | null;

  fecha_venta: string | null;
  fecha_in: string | null;
  fecha_out: string | null;
  fecha_ingreso_gastos: string | null;
  fecha_inicio_aviso: string | null;
  fecha_limite_pago: string | null;

  dias_para_limite_pago: number | null;
  dias_para_ingreso_gastos: number | null;

  estado_alerta: "PENDIENTE" | "VENCE_HOY" | "VENCIDO" | string | null;
  estado: string | null;

  created_at: string | null;
  updated_at: string | null;
};

export type NotificacionUI = NotificacionHome & {
  tipo: NotificacionTipo;
  prioridad: NotificacionPrioridad;
  titulo: string;
  detalle: string;
  accionLabel: string;
};

type NotificacionesState = {
  loading: boolean;
  saving: boolean;
  error: string | null;

  open: boolean;
  notificaciones: NotificacionUI[];

  loadNotificaciones: () => Promise<void>;
  descartarNotificacion: (notificacion: NotificacionUI) => Promise<boolean>;

  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  clearError: () => void;

  getUnreadCount: () => number;
};

function parseNumber(value: string | number | null | undefined): number {
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
      return "Esta notificación ya fue descartada.";
    }

    return message;
  }

  return String(error);
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function getPrioridad(item: NotificacionHome): NotificacionPrioridad {
  if (item.estado_alerta === "VENCIDO") return "danger";
  if (item.estado_alerta === "VENCE_HOY") return "danger";

  const diasParaLimite = Number(item.dias_para_limite_pago ?? 0);

  if (diasParaLimite <= 1) return "danger";
  if (diasParaLimite <= 4) return "warning";

  return "info";
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function formatMoney(value: string | number | null | undefined, moneda?: string | null): string {
  const parsed = parseNumber(value);

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsed)} ${moneda || ""}`.trim();
}

function buildTitulo(item: NotificacionHome): string {
  if (item.estado_alerta === "VENCIDO") {
    return `Pago vencido para carrito ${item.numero_carrito || "sin número"}`;
  }

  if (item.estado_alerta === "VENCE_HOY") {
    return `Hoy vence el pago del carrito ${item.numero_carrito || "sin número"}`;
  }

  return `Próximo ingreso a gastos · Carrito ${item.numero_carrito || "sin número"}`;
}

function buildDetalle(item: NotificacionHome): string {
  const pasajero = item.pasajero || "Pasajero sin nombre";
  const saldo = formatMoney(item.saldo_cta_cte, item.moneda);
  const fechaGastos = formatDate(item.fecha_ingreso_gastos);
  const fechaLimite = formatDate(item.fecha_limite_pago);
  const diasLimite = Number(item.dias_para_limite_pago ?? 0);
  const diasGastos = Number(item.dias_para_ingreso_gastos ?? 0);

  if (item.estado_alerta === "VENCIDO") {
    return `${pasajero} tiene saldo pendiente de ${saldo}. El límite de pago era el ${fechaLimite} y el carrito entra en gastos el ${fechaGastos}.`;
  }

  if (item.estado_alerta === "VENCE_HOY") {
    return `${pasajero} debe cancelar hoy el saldo pendiente de ${saldo}. El carrito entra en gastos el ${fechaGastos}.`;
  }

  return `${pasajero} tiene saldo pendiente de ${saldo}. Faltan ${diasLimite} día/s para el límite de pago/cancelación y ${diasGastos} día/s para que el carrito entre en gastos (${fechaGastos}).`;
}

function mapNotificacion(item: NotificacionHome): NotificacionUI {
  return {
    ...item,
    tipo: "CTA_CTE_GASTOS",
    prioridad: getPrioridad(item),
    titulo: buildTitulo(item),
    detalle: buildDetalle(item),
    accionLabel: "Ver Cta Cte"
  };
}

export const useNotificacionesStore = create<NotificacionesState>((set, get) => ({
  loading: false,
  saving: false,
  error: null,

  open: false,
  notificaciones: [],

  loadNotificaciones: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        notificaciones: [],
        error: "No hay usuario autenticado."
      });

      return;
    }

    const { data, error } = await supabase
      .from("vw_notificaciones_home")
      .select("*")
      .order("fecha_ingreso_gastos", { ascending: true })
      .order("created_at", { ascending: false });

    if (error) {
      set({
        loading: false,
        error: normalizeError(error),
        notificaciones: []
      });

      return;
    }

    const rows = (data || []) as NotificacionHome[];

    set({
      loading: false,
      error: null,
      notificaciones: rows.map(mapNotificacion)
    });
  },

  descartarNotificacion: async (notificacion) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        saving: false,
        error: "No hay usuario autenticado."
      });

      return false;
    }

    const { error } = await supabase.from("notificaciones_descartadas").insert({
      user_id: currentUserId,
      notificacion_key: notificacion.notificacion_key,
      origen: notificacion.origen,
      origen_id: notificacion.origen_id
    });

    if (error) {
      const message = normalizeError(error);

      if (!message.toLowerCase().includes("ya fue descartada")) {
        set({
          saving: false,
          error: message
        });

        return false;
      }
    }

    set((state) => ({
      saving: false,
      notificaciones: state.notificaciones.filter(
        (item) => item.notificacion_key !== notificacion.notificacion_key
      )
    }));

    return true;
  },

  setOpen: (open) => {
    set({ open });
  },

  toggleOpen: () => {
    set((state) => ({ open: !state.open }));
  },

  clearError: () => {
    set({ error: null });
  },

  getUnreadCount: () => {
    return get().notificaciones.length;
  }
}));