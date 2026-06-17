export type ContactoEstado =
  | "NUEVO"
  | "CONTACTADO"
  | "COTIZADO"
  | "SEGUIMIENTO"
  | "POSTERGADO"
  | "RECHAZADO"
  | "VENDIDO";

export const CONTACTO_ESTADOS: Array<{
  value: ContactoEstado;
  label: string;
}> = [
  { value: "NUEVO", label: "Nuevo" },
  { value: "CONTACTADO", label: "Contactado" },
  { value: "COTIZADO", label: "Cotizado" },
  { value: "SEGUIMIENTO", label: "Seguimiento" },
  { value: "POSTERGADO", label: "Postergado" },
  { value: "RECHAZADO", label: "Rechazado" },
  { value: "VENDIDO", label: "Vendido" }
];

export function getEstadoLabel(estado?: string | null): string {
  const found = CONTACTO_ESTADOS.find((item) => item.value === estado);
  return found?.label || estado || "Sin estado";
}

export function getEstadoClassName(estado?: string | null): string {
  if (estado === "NUEVO") {
    return "bg-amber-100 text-amber-700 border-amber-200";
  }

  if (estado === "CONTACTADO") {
    return "bg-orange-100 text-orange-700 border-orange-200";
  }

  if (estado === "COTIZADO") {
    return "bg-purple-100 text-purple-700 border-purple-200";
  }

  if (estado === "SEGUIMIENTO") {
    return "bg-blue-100 text-blue-700 border-blue-200";
  }

  if (estado === "POSTERGADO") {
    return "bg-slate-200 text-slate-600 border-slate-300";
  }

  if (estado === "RECHAZADO") {
    return "bg-rose-100 text-rose-700 border-rose-200";
  }

  if (estado === "VENDIDO") {
    return "bg-green-100 text-green-700 border-green-200";
  }

  return "bg-slate-100 text-slate-600 border-slate-200";
}

export function cleanObservaciones(value?: string | null): string {
  if (!value) return "";

  const metaIndex = value.indexOf("__NOSSIX_META__:");

  if (metaIndex >= 0) {
    return value.slice(0, metaIndex).trim();
  }

  return value.trim();
}

export function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getMonthStart(): string {
  const today = new Date();
  return formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1));
}

export function getToday(): string {
  return formatDateForInput(new Date());
}

export function formatDateAR(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) return value;

  return `${day}/${month}/${year}`;
}

export function formatDateTimeAR(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getInitials(name?: string | null): string {
  if (!name) return "N";

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "N";

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

export function getPaxLabel(adultos?: number | null, menores?: number | null): string {
  const adultCount = adultos ?? 1;
  const childCount = menores ?? 0;

  return `${adultCount} adulto${adultCount === 1 ? "" : "s"} · ${childCount} menor${
    childCount === 1 ? "" : "es"
  }`;
}

export function getTravelDateLabel(input: {
  fecha_viaje?: string | null;
  fecha_viaje_out?: string | null;
  solo_ida?: boolean | null;
}): string {
  if (!input.fecha_viaje) return "Sin fecha";

  if (input.solo_ida) {
    return `${formatDateAR(input.fecha_viaje)} · solo ida`;
  }

  return `${formatDateAR(input.fecha_viaje)} → ${formatDateAR(input.fecha_viaje_out)}`;
}

export function normalizeText(value?: string | null): string {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}