// src/components/controlVentas/ControlVentasPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  ChevronDown,
  ChevronsUpDown,
  Eye,
  FilePenLine,
  Filter,
  RefreshCcw,
  Search,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import {
  useControlVentasStore,
  type CarritoControlItem,
  type ControlDraft,
  type ControlVenta
} from "../../store/controlVentasStore";
import { IconButton } from "../ui/IconButton";
import { NosturDateInput } from "../ui/NosturDateInput";
import { formatMoneyAR } from "../../lib/formatters";

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type AnularControlState = ControlVenta | null;

type SelectedResumen = ReturnType<
  ReturnType<typeof useControlVentasStore.getState>["getSelectedResumen"]
>;

const ESTADO_CONTROL_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "pendiente", label: "Pendientes" },
  { value: "controlado", label: "Controlados" }
];

const SI_NO_TODOS_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "si", label: "Sí" },
  { value: "no", label: "No" }
];

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" }
];

const ANULADO_OPTIONS: SelectOption[] = [
  { value: "no", label: "No anulados" },
  { value: "si", label: "Anulados" },
  { value: "todos", label: "Todos" }
];

function getMonthOptions(): SelectOption[] {
  const monthNames = [
    "Enero",
    "Febrero",
    "Marzo",
    "Abril",
    "Mayo",
    "Junio",
    "Julio",
    "Agosto",
    "Septiembre",
    "Octubre",
    "Noviembre",
    "Diciembre"
  ];

  const now = new Date();
  const currentYear = now.getFullYear();
  const options: SelectOption[] = [];

  for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year}-${String(month).padStart(2, "0")}`;

      options.push({
        value,
        label: `${monthNames[month - 1]} ${year}`
      });
    }
  }

  return options.reverse();
}

function getCurrentMonthValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

function shiftMonthValue(monthValue: string, offset: number): string {
  const [yearRaw, monthRaw] = monthValue.split("-");
  const year = Number(yearRaw);
  const month = Number(monthRaw);

  if (!year || !month) return getCurrentMonthValue();

  const date = new Date(year, month - 1 + offset, 1);
  const nextYear = date.getFullYear();
  const nextMonth = String(date.getMonth() + 1).padStart(2, "0");

  return `${nextYear}-${nextMonth}`;
}

function toDisplayDate(value?: string | null): string {
  if (!value) return "";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
}

function formatDateAR(value?: string | null): string {
  if (!value) return "—";
  return toDisplayDate(value) || "—";
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function getTravelLabel(carrito: CarritoControlItem): string {
  return `${formatDateAR(carrito.fecha_in)} → ${
    carrito.solo_ida ? "Solo ida" : formatDateAR(carrito.fecha_out)
  }`;
}

function calculatePreview(utilidadAlmundo: string, importeRegalia: string) {
  const utilidad = parseMoney(utilidadAlmundo);
  const rawRegalia = importeRegalia.trim() ? parseMoney(importeRegalia) : utilidad * 0.36;

  const regalia =
    rawRegalia > 0 && rawRegalia <= 1 && utilidad > 1 ? utilidad * rawRegalia : rawRegalia;

  const pct = utilidad > 0 ? (regalia / utilidad) * 100 : 36;
  const nossix = utilidad - regalia;
  const aFacturar = nossix * 1.21;

  return {
    utilidad,
    pct,
    regalia,
    nossix,
    aFacturar
  };
}

function formatDraftMoney(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(Number.isFinite(value) ? value : 0);
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  inputMode = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-[78px] w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[12px] font-normal leading-relaxed text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
    />
  );
}

function ToggleChip({
  label,
  checked,
  onChange,
  disabled = false,
  tone = "default"
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  tone?: "default" | "green" | "blue" | "orange";
}) {
  const activeClass = {
    default: "border-[#4f7c90]/30 bg-[#eef6f7] text-[#4f7c90]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
    orange: "border-orange-200 bg-orange-50 text-orange-700"
  }[tone];

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={[
        "flex h-8 items-center justify-between gap-2 rounded-[10px] border px-3 text-[12px] font-medium transition disabled:opacity-50",
        checked
          ? activeClass
          : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      <span>{label}</span>
      <span
        className={[
          "flex h-4 w-4 items-center justify-center rounded-full text-[10px]",
          checked ? "bg-white/80" : "bg-[#f1f5f9]"
        ].join(" ")}
      >
        {checked ? "✓" : ""}
      </span>
    </button>
  );
}

function NosturSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar"
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(search);

    if (!q) return options;

    return options.filter((option) => normalizeText(`${option.label} ${option.value}`).includes(q));
  }, [options, search]);

  return (
    <div className={["relative", open ? "z-[140]" : "z-0"].join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-left text-[12px] font-normal text-[#172033] outline-none transition hover:bg-[#f8fafc]"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
            tabIndex={-1}
            aria-label="Cerrar selector"
          />

          <div className="absolute left-0 right-0 top-[36px] z-[150] rounded-[14px] border border-black/10 bg-white p-1.5 shadow-xl">
            {options.length > 8 ? (
              <div className="mb-1.5 flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-[#f8fafc] px-2">
                <Search size={13} className="text-[#94a3b8]" />

                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  autoFocus
                  className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal outline-none"
                />
              </div>
            ) : null}

            <div className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                  Sin opciones
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const active = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={[
                        "flex h-8 w-full items-center rounded-[10px] px-3 text-left text-[12px] font-medium transition",
                        active
                          ? "bg-[#4f7c90] text-white"
                          : "text-[#334155] hover:bg-[#f1f5f9]"
                      ].join(" ")}
                    >
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function StatusBadge({
  children,
  type
}: {
  children: ReactNode;
  type: "ok" | "pending" | "danger" | "neutral";
}) {
  const className = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-black/10 bg-white text-[#334155]"
  }[type];

  return (
    <span className={["rounded-md border px-1.5 py-0.5 text-[10px] font-medium", className].join(" ")}>
      {children}
    </span>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed right-5 top-5 z-[260] w-[300px] rounded-[14px] border border-black/10 bg-white px-3.5 py-3 text-[12px] shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={[
              "mb-0.5 font-semibold",
              toast.type === "success" ? "text-emerald-700" : "text-red-700"
            ].join(" ")}
          >
            {toast.type === "success" ? "Operación exitosa" : "Atención"}
          </div>

          <div className="font-normal leading-relaxed text-[#334155]">{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function buildInitialDraft(control: ControlVenta | null): ControlDraft {
  const utilidad = parseMoney(control?.utilidad_almundo || 0);
  const storedRegalia = parseMoney(control?.importe_regalia || 0);

  const normalizedRegalia =
    storedRegalia > 0 && storedRegalia <= 1 && utilidad > 1 ? utilidad * storedRegalia : storedRegalia;

  return {
    utilidad_almundo: control?.utilidad_almundo ? String(control.utilidad_almundo).replace(".", ",") : "",
    importe_regalia: normalizedRegalia > 0 ? formatDraftMoney(normalizedRegalia) : "",
    controlado: true,
    facturado: Boolean(control?.facturado),
    cobrado: Boolean(control?.cobrado),
    observaciones: control?.observaciones || ""
  };
}

function ColoredSummaryCard({
  title,
  icon: Icon,
  tone,
  items
}: {
  title: string;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone: "ars" | "usd";
  items: {
    label: string;
    value: string;
    variant: "blue" | "green" | "orange";
  }[];
}) {
  const wrapperClass =
    tone === "ars"
      ? "border-sky-200/80 bg-sky-50/75"
      : "border-indigo-200/80 bg-indigo-50/70";

  const titleClass = tone === "ars" ? "text-sky-800" : "text-indigo-800";
  const iconClass = tone === "ars" ? "text-sky-700 bg-sky-100/80" : "text-indigo-700 bg-indigo-100/80";

  const itemClass = {
    blue: "border-sky-200/70 bg-white/72 text-sky-800",
    green: "border-emerald-200/70 bg-emerald-50/80 text-emerald-800",
    orange: "border-orange-200/80 bg-orange-50/80 text-orange-900"
  };

  const labelClass = {
    blue: "text-sky-600",
    green: "text-emerald-600",
    orange: "text-nostur-orange"
  };

  return (
    <div className={["rounded-[16px] border p-3 shadow-sm backdrop-blur-xl", wrapperClass].join(" ")}>
      <div className="mb-3 flex items-center gap-2">
        <div className={["flex h-8 w-8 items-center justify-center rounded-[10px]", iconClass].join(" ")}>
          <Icon size={15} strokeWidth={1.8} />
        </div>

        <h2 className={["text-[14px] font-semibold", titleClass].join(" ")}>{title}</h2>
      </div>

      <div className="grid gap-2.5 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className={["rounded-[14px] border p-3", itemClass[item.variant]].join(" ")}>
            <div className={["text-[11px] font-semibold", labelClass[item.variant]].join(" ")}>
              {item.label}
            </div>

            <div className="mt-1 truncate text-[18px] font-semibold tracking-tight">{item.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MotivoAnulacionControlModal({
  control,
  saving,
  onClose,
  onConfirm
}: {
  control: ControlVenta | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setMotivo("");
  }, [control?.id]);

  if (!control) return null;

  const canConfirm = motivo.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center bg-black/35 px-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#172033]">Anular control</h2>

            <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#64748b]">
              Indicá el motivo de anulación del control. Quedará guardado como respaldo
              administrativo.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div>
          <FieldLabel>Motivo</FieldLabel>

          <TextArea
            value={motivo}
            onChange={setMotivo}
            placeholder="Ej: diferencia detectada, control cargado por error, importes incorrectos..."
          />
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033] disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving || !canConfirm}
            onClick={() => onConfirm(motivo.trim())}
            className="h-8 rounded-[10px] bg-red-600 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Anulando..." : "Anular control"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ControlSidePanel({
  selected,
  saving,
  onSave,
  onAnular
}: {
  selected: SelectedResumen;
  saving: boolean;
  onSave: (draft: ControlDraft) => Promise<void>;
  onAnular: (control: ControlVenta) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ControlDraft>(() => buildInitialDraft(selected?.control || null));

  useEffect(() => {
    setDraft(buildInitialDraft(selected?.control || null));
  }, [selected?.carrito.id, selected?.control?.id]);

  if (!selected) {
    return (
      <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
          Seleccioná un carrito para controlar.
        </div>
      </aside>
    );
  }

  const carrito = selected.carrito;
  const cliente = carrito.clientes;
  const preview = calculatePreview(draft.utilidad_almundo, draft.importe_regalia);
  const locked = selected.anulado;

  function setField<K extends keyof ControlDraft>(key: K, value: ControlDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-[#4f7c90] text-[13px] font-semibold text-white">
            {getInitials(cliente?.nombre_completo || "C")}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-[#172033]">
              {carrito.numero_carrito}
            </h2>

            <p className="truncate text-[12px] font-normal text-[#64748b]">
              {cliente?.nombre_completo || "Sin cliente"}
            </p>
          </div>
        </div>

        {selected.anulado ? (
          <StatusBadge type="danger">ANULADO</StatusBadge>
        ) : selected.controlado ? (
          <StatusBadge type="ok">CONTROLADO</StatusBadge>
        ) : (
          <StatusBadge type="pending">PENDIENTE</StatusBadge>
        )}
      </div>

      <div className="grid gap-2.5 text-[12px]">
            {selected.controlado || selected.facturado || selected.cobrado ? (
          <div className="rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-[12px] font-medium text-sky-700">
            Este control ya tiene movimientos guardados. Podés editarlo para corregir
            errores administrativos.
          </div>
        ) : null}

        {selected.anulado ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            Este control está anulado. Para modificarlo primero habría que restaurarlo.
          </div>
        ) : null}

        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <div className="mb-1.5 flex items-center gap-2">
            <UserRound size={14} className="text-[#4f7c90]" />

            <span className="truncate font-semibold text-[#172033]">
              {cliente?.nombre_completo || "Sin cliente"}
            </span>
          </div>

          <div className="font-normal text-[#64748b]">{cliente?.telefono || "—"}</div>
          <div className="font-normal text-[#64748b]">{cliente?.email || "Sin email"}</div>
        </div>

        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Datos del carrito</FieldLabel>

          <div className="font-semibold text-[#172033]">{carrito.destino || "Sin destino"}</div>

          <div className="font-normal text-[#64748b]">
            {carrito.servicio || "Sin servicio"} · {getTravelLabel(carrito)}
          </div>

          <div className="mt-1 font-normal text-[#64748b]">
            Venta: <strong>{formatMoneyAR(carrito.importe_final, carrito.moneda)}</strong>
          </div>

          <div className="font-normal text-[#64748b]">
            Fecha venta: <strong>{formatDateAR(carrito.fecha_venta)}</strong>
          </div>

          <div className="font-normal text-[#64748b]">
            Vendedor: <strong>{carrito.vendedor || "—"}</strong>
          </div>
        </div>

        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Control económico</FieldLabel>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Utilidad bruta</FieldLabel>

              <div className={locked ? "pointer-events-none opacity-60" : ""}>
                <TextInput
                  value={draft.utilidad_almundo}
                  onChange={(value) => {
                    const utilidadAnterior = parseMoney(draft.utilidad_almundo);
                    const regaliaActual = parseMoney(draft.importe_regalia);
                    const regaliaAutomaticaAnterior = utilidadAnterior > 0 ? utilidadAnterior * 0.36 : 0;

                    const utilidadNueva = parseMoney(value);

                    const debeRecalcularRegalia =
                      !draft.importe_regalia.trim() ||
                      regaliaActual <= 1 ||
                      Math.abs(regaliaActual - regaliaAutomaticaAnterior) < 0.01;

                    setField("utilidad_almundo", value);

                    if (utilidadNueva > 0 && debeRecalcularRegalia) {
                      setField("importe_regalia", formatDraftMoney(utilidadNueva * 0.36));
                    }
                  }}
                  placeholder={locked ? "Control cerrado." : "0,00"}
                  inputMode="decimal"
                />
              </div>
            </div>

            <div>
              <FieldLabel>Regalías</FieldLabel>

              <div className={locked ? "pointer-events-none opacity-60" : ""}>
                <TextInput
                  value={draft.importe_regalia}
                  onChange={(value) => {
                    const utilidad = parseMoney(draft.utilidad_almundo);
                    const regalia = parseMoney(value);

                    if (utilidad > 0 && regalia > 0 && regalia <= 1) {
                      setField("importe_regalia", formatDraftMoney(utilidad * regalia));
                      return;
                    }

                    setField("importe_regalia", value);
                  }}
                  placeholder={locked ? "Control cerrado." : "Automático: 36%"}
                  inputMode="decimal"
                />
              </div>
            </div>
          </div>

          <div className="mt-3 rounded-[14px] border border-black/10 bg-white p-3">
            <div className="flex justify-between gap-3">
              <span className="text-[#64748b]">Regalías</span>
              <strong>{formatMoneyAR(preview.regalia, carrito.moneda)}</strong>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-[#64748b]">% regalía ref.</span>

              <strong>
                {new Intl.NumberFormat("es-AR", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2
                }).format(preview.pct)}
                %
              </strong>
            </div>

            <div className="flex justify-between gap-3">
              <span className="text-[#64748b]">Utilidad neta</span>

              <strong className="text-emerald-700">
                {formatMoneyAR(preview.nossix, carrito.moneda)}
              </strong>
            </div>

            <div className="mt-2 flex justify-between gap-3 border-t border-black/10 pt-2">
              <span className="font-semibold text-[#172033]">Facturación</span>

              <strong className="text-[#4f7c90]">
                {formatMoneyAR(preview.aFacturar, carrito.moneda)}
              </strong>
            </div>
                    <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Estado administrativo</FieldLabel>

          <div className="grid grid-cols-3 gap-2">
            <ToggleChip
              label="Controlado"
              checked={draft.controlado}
              disabled={locked}
              tone="blue"
              onChange={(value) => setField("controlado", value)}
            />

            <ToggleChip
              label="Facturado"
              checked={draft.facturado}
              disabled={locked}
              tone="orange"
              onChange={(value) => {
                setField("facturado", value);

                if (value) {
                  setField("controlado", true);
                }

                if (!value) {
                  setField("cobrado", false);
                }
              }}
            />

            <ToggleChip
              label="Cobrado"
              checked={draft.cobrado}
              disabled={locked}
              tone="green"
              onChange={(value) => {
                setField("cobrado", value);

                if (value) {
                  setField("controlado", true);
                  setField("facturado", true);
                }
              }}
            />
          </div>

          <p className="mt-2 text-[11px] font-normal leading-relaxed text-[#64748b]">
            Si marcás cobrado, también queda facturado y controlado. Si desmarcás facturado,
            se desmarca cobrado.
          </p>
        </div>
          </div>
        </div>

        <div>
          <FieldLabel>Observaciones</FieldLabel>

          <div className={locked ? "pointer-events-none opacity-60" : ""}>
            <TextArea
              value={draft.observaciones}
              onChange={(value) => setField("observaciones", value)}
              placeholder={
                locked
                  ? "Control cerrado. No se puede modificar."
                  : "Notas de control, factura, cobro o diferencias..."
              }
            />
          </div>
        </div>

        <button
          type="button"
          disabled={saving || locked}
          onClick={() => onSave(draft)}
          className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
        >
          {saving ? "Guardando..." : locked ? "Control anulado" : "Guardar cambios"}
        </button>

        {selected.control && !selected.controlado ? (
          <button
            type="button"
            disabled={saving || selected.anulado}
            onClick={() => onAnular(selected.control as ControlVenta)}
            className="h-8 rounded-[10px] border border-red-200 bg-red-50 px-4 text-[12px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
          >
            Anular control
          </button>
        ) : null}
      </div>
    </aside>
  );
}

export function ControlVentasPanel() {
  const loading = useControlVentasStore((state) => state.loading);
  const saving = useControlVentasStore((state) => state.saving);
  const error = useControlVentasStore((state) => state.error);
  const currentProfile = useControlVentasStore((state) => state.currentProfile);
  const canManageControlVentas = useControlVentasStore((state) => state.canManageControlVentas);
  const filters = useControlVentasStore((state) => state.filters);
  const catalogos = useControlVentasStore((state) => state.catalogos);
  const selectedCarritoId = useControlVentasStore((state) => state.selectedCarritoId);

  const loadControlVentas = useControlVentasStore((state) => state.loadControlVentas);
  const saveControlVenta = useControlVentasStore((state) => state.saveControlVenta);
  const anularControlVenta = useControlVentasStore((state) => state.anularControlVenta);
  const setFilter = useControlVentasStore((state) => state.setFilter);
  const clearError = useControlVentasStore((state) => state.clearError);
  const selectCarrito = useControlVentasStore((state) => state.selectCarrito);

  const getResumen = useControlVentasStore((state) => state.getResumen);
  const getSelectedResumen = useControlVentasStore((state) => state.getSelectedResumen);
  const getMetrics = useControlVentasStore((state) => state.getMetrics);

  const resumen = getResumen();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [controlAnular, setControlAnular] = useState<AnularControlState>(null);

  const selectedResumen = useMemo(
    () => getSelectedResumen(),
    [resumen, selectedCarritoId, getSelectedResumen]
  );

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const selectedMonthLabel =
    monthOptions.find((option) => option.value === filters.mes)?.label || filters.mes;

  const currentMonthValue = getCurrentMonthValue();

  function applyMonthAndReload(monthValue: string) {
    setFilter("mes", monthValue);

    window.setTimeout(() => {
      loadControlVentas();
    }, 0);
  }

  function goToPreviousMonth() {
    applyMonthAndReload(shiftMonthValue(filters.mes, -1));
  }

  function goToNextMonth() {
    applyMonthAndReload(shiftMonthValue(filters.mes, 1));
  }

  function goToCurrentMonth() {
    applyMonthAndReload(currentMonthValue);
  }

  useEffect(() => {
    loadControlVentas();
  }, [loadControlVentas]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  async function handleSave(draft: ControlDraft) {
    if (!selectedResumen) return;

    const ok = await saveControlVenta(selectedResumen.carrito, draft);

    if (ok) showToast("Control guardado correctamente.");
  }

  async function handleAnular(control: ControlVenta) {
    setControlAnular(control);
  }

  async function confirmAnularControl(motivo: string) {
    if (!controlAnular) return;

    const ok = await anularControlVenta(controlAnular, motivo);

    if (ok) {
      setControlAnular(null);
      showToast("Control anulado correctamente.");
    }
  }

  const vendedorOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...catalogos.vendedores.map((item) => ({
      value: item.id,
      label: `${item.nombre} ${item.apellido}`.trim()
    }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "todos", label: "Todas" },
    ...catalogos.sucursales.map((item) => ({
      value: item.id,
      label: item.nombre
    }))
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Control de ventas
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Almundo
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManageControlVentas
                ? "Liquidación, regalías, facturación y cobro."
                : `Carritos asignados a ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex h-7 items-center rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
            >
              Mes anterior
            </button>

            <div className="inline-flex h-7 min-w-[120px] items-center justify-center rounded-[10px] bg-[#172033] px-3 text-center text-[11px] font-medium text-white shadow-sm">
              {selectedMonthLabel}
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex h-7 items-center rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
            >
              Mes siguiente
            </button>

            <button
              type="button"
              onClick={goToCurrentMonth}
              className={[
                "inline-flex h-7 items-center rounded-[10px] px-2.5 text-[11px] font-medium shadow-sm transition",
                filters.mes === currentMonthValue
                  ? "bg-[#4f7c90] text-white"
                  : "bg-white text-[#334155] ring-1 ring-black/10 hover:bg-[#f8fafc]"
              ].join(" ")}
            >
              Este mes
            </button>

            <button
              type="button"
              onClick={loadControlVentas}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        {error ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
            <span>{error}</span>

            <button type="button" onClick={clearError} className="text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="relative z-[60] mb-3 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Filter size={14} className="text-[#4f7c90]" />

                <h2 className="text-[12px] font-semibold text-[#172033]">Filtros</h2>

                <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-nostur-orange ring-1 ring-orange-100">
                  Mes operativo obligatorio
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                {selectedMonthLabel} · {filters.desde} → {filters.hasta} · Moneda:{" "}
                {filters.moneda} · Control: {filters.estadoControl} · Facturado:{" "}
                {filters.facturado} · Cobrado: {filters.cobrado}
              </div>
            </button>

            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
            >
              {filtersOpen ? "Ocultar" : "Mostrar"}
              <ChevronsUpDown size={13} strokeWidth={1.8} />
            </button>
          </div>

          {filtersOpen ? (
            <>
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.1fr_1.1fr_1fr_1fr_1fr]">
                <div className="rounded-[14px] border border-[#4f7c90]/20 bg-white/70 p-2">
                  <FieldLabel>Mes operativo</FieldLabel>

                  <div className="flex h-8 items-center rounded-[10px] border border-black/10 bg-[#172033] px-3 text-[12px] font-medium text-white">
                    {selectedMonthLabel}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-black/10 bg-white/70 p-2">
                  <div>
                    <FieldLabel>Desde</FieldLabel>

                    <NosturDateInput
                      value={filters.desde}
                      onChange={(value) => setFilter("desde", value)}
                    />
                  </div>

                  <div>
                    <FieldLabel>Hasta</FieldLabel>

                    <NosturDateInput
                      value={filters.hasta}
                      onChange={(value) => setFilter("hasta", value)}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Moneda</FieldLabel>

                  <NosturSelect
                    value={filters.moneda}
                    onChange={(value) => setFilter("moneda", value as typeof filters.moneda)}
                    options={MONEDA_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Estado control</FieldLabel>

                  <NosturSelect
                    value={filters.estadoControl}
                    onChange={(value) =>
                      setFilter("estadoControl", value as typeof filters.estadoControl)
                    }
                    options={ESTADO_CONTROL_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Facturado</FieldLabel>

                  <NosturSelect
                    value={filters.facturado}
                    onChange={(value) => setFilter("facturado", value as typeof filters.facturado)}
                    options={SI_NO_TODOS_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Cobrado</FieldLabel>

                  <NosturSelect
                    value={filters.cobrado}
                    onChange={(value) => setFilter("cobrado", value as typeof filters.cobrado)}
                    options={SI_NO_TODOS_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Anulado</FieldLabel>

                  <NosturSelect
                    value={filters.anulado}
                    onChange={(value) => setFilter("anulado", value as typeof filters.anulado)}
                    options={ANULADO_OPTIONS}
                  />
                </div>

                {canManageControlVentas ? (
                  <div>
                    <FieldLabel>Vendedor</FieldLabel>

                    <NosturSelect
                      value={filters.vendedorId}
                      onChange={(value) => setFilter("vendedorId", value)}
                      options={vendedorOptions}
                    />
                  </div>
                ) : null}

                <div>
                  <FieldLabel>Sucursal</FieldLabel>

                  <NosturSelect
                    value={filters.sucursalId}
                    onChange={(value) => setFilter("sucursalId", value)}
                    options={sucursalOptions}
                  />
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por cliente, teléfono, carrito, destino..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadControlVentas}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Aplicar filtros
                </button>

                <button
                  type="button"
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                  title="La exportación se agrega en la próxima etapa."
                >
                  Exportar Excel
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-3 xl:grid-cols-2">
          <ColoredSummaryCard
            title="Resumen Facturación ARS"
            icon={Wallet}
            tone="ars"
            items={[
              {
                label: "Total facturado ARS",
                value: formatMoneyAR(metrics.ars.totalFacturado, "ARS"),
                variant: "blue"
              },
              {
                label: "Cobrado mes ARS",
                value: formatMoneyAR(metrics.ars.cobradoMes, "ARS"),
                variant: "green"
              },
              {
                label: "A cobrar semana ARS",
                value: formatMoneyAR(metrics.ars.aCobrarSemana, "ARS"),
                variant: "orange"
              }
            ]}
          />

          <ColoredSummaryCard
            title="Resumen Facturación USD"
            icon={Wallet}
            tone="usd"
            items={[
              {
                label: "Total facturado USD",
                value: formatMoneyAR(metrics.usd.totalFacturado, "USD"),
                variant: "blue"
              },
              {
                label: "Cobrado mes USD",
                value: formatMoneyAR(metrics.usd.cobradoMes, "USD"),
                variant: "green"
              },
              {
                label: "A cobrar semana USD",
                value: formatMoneyAR(metrics.usd.aCobrarSemana, "USD"),
                variant: "orange"
              }
            ]}
          />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">
                  Listado de carritos para control
                </h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${resumen.length} carritos encontrados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando carritos...
              </div>
            ) : resumen.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay carritos para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {resumen.map((item) => {
                  const carrito = item.carrito;
                  const selected = selectedResumen?.carrito.id === carrito.id;
                  const cliente = carrito.clientes;

                  return (
                    <button
                      key={carrito.id}
                      type="button"
                      onClick={() => selectCarrito(carrito.id)}
                      className={[
                        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition lg:grid-cols-[1.25fr_1.1fr_1fr_1fr_1.1fr_124px_54px]",
                        selected
                          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                          : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {cliente?.nombre_completo || "Sin cliente"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {cliente?.telefono || "—"}
                        </div>

                        <div className="truncate text-[11px] font-semibold text-[#4f7c90]">
                          {carrito.numero_carrito}
                        </div>

                        <div className="truncate text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
                          {carrito.moneda === "USD" ? "Dólares" : "Pesos"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {carrito.destino || "Sin destino"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {getTravelLabel(carrito)}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          Venta: {formatDateAR(carrito.fecha_venta)}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {carrito.servicio || "Sin servicio"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatMoneyAR(carrito.importe_final, carrito.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">Venta</div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatMoneyAR(item.utilidadAlmundo, carrito.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">Utilidad bruta</div>

                        <div className="text-[11px] font-normal text-red-600">
                          Regalías {formatMoneyAR(item.importeRegalia, carrito.moneda)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-emerald-700">
                          {formatMoneyAR(item.utilidadNossix, carrito.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">Utilidad neta</div>

                        <div className="text-[11px] font-semibold text-[#4f7c90]">
                          Facturar {formatMoneyAR(item.importeAFacturar, carrito.moneda)}
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        {item.anulado ? (
                          <StatusBadge type="danger">ANULADO</StatusBadge>
                        ) : item.controlado ? (
                          <StatusBadge type="ok">CONTROLADO</StatusBadge>
                        ) : (
                          <StatusBadge type="pending">PENDIENTE</StatusBadge>
                        )}

                        {item.facturado ? <StatusBadge type="ok">FACTURADO</StatusBadge> : null}
                        {item.cobrado ? <StatusBadge type="ok">COBRADO</StatusBadge> : null}
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={Eye}
                          label="Ver detalle"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectCarrito(carrito.id);
                          }}
                        />

                        <IconButton
                          icon={FilePenLine}
                          label="Editar control"
                          className="text-[#4f7c90]"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectCarrito(carrito.id);
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <ControlSidePanel
            selected={selectedResumen}
            saving={saving}
            onSave={handleSave}
            onAnular={handleAnular}
          />
        </div>
      </main>

      <MotivoAnulacionControlModal
        control={controlAnular}
        saving={saving}
        onClose={() => setControlAnular(null)}
        onConfirm={confirmAnularControl}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default ControlVentasPanel;  