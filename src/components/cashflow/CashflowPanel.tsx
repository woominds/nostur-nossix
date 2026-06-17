// src/components/cashflow/CashflowPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Clock3,
  Eye,
  Filter,
  Pencil,
  Plus,
  RefreshCcw,
  Repeat,
  Search,
  Wallet,
  X
} from "lucide-react";
import {
  createFacturaDraftFromCashflowItem,
  createPagoDraftFromCashflowItem,
  createRecurrenteDraftFromCashflowItem,
  getCashflowCajaLabel,
  getCashflowProveedorLabel,
  useCashflowStore,
  type CajaLite,
  type CashflowFacturaDraft,
  type CashflowItem,
  type CashflowPagoDraft,
  type CashflowRecurrenteDraft,
  type ProveedorLite
} from "../../store/cashflowStore";

/* =========================================================
   NOSSIX / NOSTUR — CASHFLOW PANEL
   Estilo desktop compacto / premium
========================================================= */

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ModalMode = "factura" | "pago" | "recurrente" | "detalle" | null;

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todas", label: "Todas" },
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const MONEDA_FORM_OPTIONS: SelectOption[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "pendientes", label: "Pendientes" },
  { value: "vencidas", label: "Vencidas" },
  { value: "por_vencer", label: "Por vencer" },
  { value: "proyectadas", label: "Proyectadas" },
  { value: "pagadas", label: "Pagadas" }
];

const ORIGEN_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "FACTURA", label: "Factura" },
  { value: "CUOTA", label: "Cuota" },
  { value: "RECURRENTE_PROYECTADO", label: "Recurrente proyectado" },
  { value: "RECURRENTE", label: "Recurrente" },
  { value: "MANUAL", label: "Manual" }
];

const IVA_OPTIONS: SelectOption[] = [
  { value: "21", label: "21%" },
  { value: "10.5", label: "10,5%" },
  { value: "27", label: "27%" },
  { value: "0", label: "0%" }
];

const YEAR_OPTIONS: SelectOption[] = Array.from({ length: 7 }, (_, index) => {
  const year = new Date().getFullYear() - 2 + index;
  return { value: String(year), label: String(year) };
});

const MONTH_OPTIONS: SelectOption[] = [
  { value: "1", label: "Enero" },
  { value: "2", label: "Febrero" },
  { value: "3", label: "Marzo" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Mayo" },
  { value: "6", label: "Junio" },
  { value: "7", label: "Julio" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Septiembre" },
  { value: "10", label: "Octubre" },
  { value: "11", label: "Noviembre" },
  { value: "12", label: "Diciembre" }
];

const MONTH_NAMES = [
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

const WEEK_DAYS = ["L", "M", "M", "J", "V", "S", "D"];

/* =========================================================
   HELPERS
========================================================= */

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

function toDisplayDate(value?: string | null): string {
  if (!value) return "";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
}

function toStorageDate(value: string): string {
  const clean = value.trim();

  if (!clean) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) return clean;

  const match = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);

  if (!match) return "";

  const day = match[1].padStart(2, "0");
  const month = match[2].padStart(2, "0");
  const year = match[3];

  return `${year}-${month}-${day}`;
}

function formatDateInputMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function createDateFromStorage(value?: string | null): Date {
  if (!value) return new Date();

  const [year, month, day] = value.slice(0, 10).split("-").map(Number);

  if (!year || !month || !day) return new Date();

  return new Date(year, month - 1, day);
}

function formatCalendarStorageDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getCalendarDays(monthDate: Date): Date[] {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];

  for (let index = firstWeekDay - 1; index >= 0; index -= 1) {
    days.push(new Date(year, month, -index));
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length % 7 !== 0) {
    const next = days.length - firstWeekDay - lastDay.getDate() + 1;
    days.push(new Date(year, month + 1, next));
  }

  return days;
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

function formatMoneyAR(value: string | number | null | undefined, moneda = "ARS"): string {
  const parsed = parseMoney(value);

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsed)} ${moneda}`;
}

function formatDate(value?: string | null): string {
  const display = toDisplayDate(value);
  return display || "—";
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getDaysInMonth(year: number, month: number): string[] {
  const lastDay = new Date(year, month, 0).getDate();

  return Array.from({ length: lastDay }, (_, index) => {
    const day = String(index + 1).padStart(2, "0");
    return `${year}-${String(month).padStart(2, "0")}-${day}`;
  });
}

function getItemEstadoLabel(item: CashflowItem): string {
  if (item.estado === "PAGADA") return "Pagado";
  if (item.estado === "CANCELADA") return "Cancelado";
  if (item.fecha < getToday()) return "Vencido";
  if (item.estado === "PROYECTADA" || item.es_proyectado) return "Proyectado";
  return "Pendiente";
}

function getItemOrigenLabel(item: CashflowItem): string {
  const labels: Record<string, string> = {
    FACTURA: "Factura",
    CUOTA: "Cuota",
    RECURRENTE_PROYECTADO: "Recurrente proyectado",
    RECURRENTE: "Recurrente",
    MANUAL: "Manual"
  };

  return labels[item.tipo_origen] || item.tipo_origen || "Origen";
}

/* =========================================================
   COMPONENTES UI BASE
========================================================= */

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
  inputMode = "text",
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      inputMode={inputMode}
      disabled={disabled}
      className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90] disabled:cursor-not-allowed disabled:opacity-60"
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

function NosturDateInput({
  value,
  onChange,
  min
}: {
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const [displayValue, setDisplayValue] = useState(() => toDisplayDate(value));
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => createDateFromStorage(value || min));

  useEffect(() => {
    setDisplayValue(toDisplayDate(value));

    if (value) {
      setVisibleMonth(createDateFromStorage(value));
    }
  }, [value]);

  function commit(nextDisplayValue: string) {
    const storageValue = toStorageDate(nextDisplayValue);

    if (!storageValue) {
      onChange("");
      return;
    }

    if (min && storageValue < min) {
      onChange(min);
      setDisplayValue(toDisplayDate(min));
      setVisibleMonth(createDateFromStorage(min));
      return;
    }

    onChange(storageValue);
    setVisibleMonth(createDateFromStorage(storageValue));
  }

  function selectDate(date: Date) {
    const storageValue = formatCalendarStorageDate(date);

    if (min && storageValue < min) return;

    onChange(storageValue);
    setDisplayValue(toDisplayDate(storageValue));
    setVisibleMonth(date);
    setOpen(false);
  }

  const days = getCalendarDays(visibleMonth);
  const selectedStorageDate = value || "";
  const todayStorageDate = getToday();

  return (
    <div className={["relative", open ? "z-[140]" : "z-0"].join(" ")}>
      <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3 focus-within:border-[#4f7c90]">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 text-[#64748b] hover:text-[#4f7c90]"
          title="Abrir calendario"
        >
          <CalendarDays size={13} strokeWidth={1.8} />
        </button>

        <input
          value={displayValue}
          onChange={(event) => {
            const masked = formatDateInputMask(event.target.value);
            setDisplayValue(masked);

            if (masked.length === 10) commit(masked);
            if (masked.length === 0) onChange("");
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => commit(displayValue)}
          placeholder="dd/mm/aaaa"
          inputMode="numeric"
          className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
        />
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[80] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-label="Cerrar calendario"
          />

          <div className="absolute right-0 top-[36px] z-[150] w-[260px] rounded-[16px] border border-black/10 bg-white p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="text-[12px] font-semibold text-[#172033]">
                {MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </div>

              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[#94a3b8]">
              {WEEK_DAYS.map((day, index) => (
                <div key={`${day}-${index}`}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const storageDate = formatCalendarStorageDate(date);
                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                const isSelected = storageDate === selectedStorageDate;
                const isToday = storageDate === todayStorageDate;
                const isDisabled = Boolean(min && storageDate < min);

                return (
                  <button
                    key={storageDate}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(date)}
                    className={[
                      "flex h-7 items-center justify-center rounded-lg text-[11px] font-medium transition",
                      isSelected
                        ? "bg-[#4f7c90] text-white"
                        : isToday
                          ? "bg-orange-50 text-nostur-orange"
                          : isCurrentMonth
                            ? "text-[#334155] hover:bg-[#f1f5f9]"
                            : "text-[#cbd5e1] hover:bg-[#f8fafc]",
                      isDisabled ? "cursor-not-allowed opacity-30 hover:bg-transparent" : ""
                    ].join(" ")}
                  >
                    {date.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      ) : null}
    </div>
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
  const selected = options.find((option) => option.value === value);

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
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-label="Cerrar selector"
          />

          <div className="absolute left-0 right-0 top-[36px] z-[150] max-h-56 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                Sin opciones
              </div>
            ) : (
              options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
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
        </>
      ) : null}
    </div>
  );
}

function BooleanChip({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-medium transition",
        checked
          ? "border-[#4f7c90]/30 bg-[#eef6f7] text-[#172033]"
          : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      {checked ? <CheckCircle2 size={14} /> : <Plus size={14} />}
      {label}
    </button>
  );
}

function InlineError({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
      <div className="flex items-start gap-2">
        <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        <span>{message}</span>
      </div>

      <button type="button" onClick={onClose} className="text-red-500 hover:text-red-700">
        <X size={14} />
      </button>
    </div>
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

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "orange"
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone?: "orange" | "blue" | "green" | "red" | "amber";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-nostur-orange ring-orange-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100"
  }[tone];

  return (
    <div className="rounded-[14px] border border-black/10 bg-white/62 px-3 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10.5px] font-medium text-[#64748b]">{label}</div>

          <div className="mt-0.5 truncate text-[18px] font-semibold tracking-tight text-[#172033]">
            {value}
          </div>
        </div>

        <div
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1",
            toneClass
          ].join(" ")}
        >
          <Icon size={14} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   BADGES / SELECT PROVEEDOR
========================================================= */

function EstadoBadge({ item }: { item: CashflowItem }) {
  const label = getItemEstadoLabel(item);

  const className =
    label === "Pagado"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : label === "Vencido"
        ? "border-red-200 bg-red-50 text-red-700"
        : label === "Proyectado"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : label === "Cancelado"
            ? "border-slate-200 bg-slate-50 text-slate-700"
            : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span
      className={[
        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        className
      ].join(" ")}
    >
      {label}
    </span>
  );
}

function OrigenBadge({ item }: { item: CashflowItem }) {
  const isProjected = item.tipo_origen === "RECURRENTE_PROYECTADO" || item.es_proyectado;

  return (
    <span
      className={[
        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        isProjected
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : "border-black/10 bg-white text-[#475569]"
      ].join(" ")}
    >
      {getItemOrigenLabel(item)}
    </span>
  );
}

function ProveedorInlineSelect({
  value,
  onChange,
  proveedores,
  onCreate
}: {
  value: string;
  onChange: (id: string, label: string) => void;
  proveedores: ProveedorLite[];
  onCreate: (nombre: string) => Promise<ProveedorLite | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);

  const selected = proveedores.find((proveedor) => proveedor.id === value) || null;

  useEffect(() => {
    setQuery(selected ? getCashflowProveedorLabel(selected) : "");
  }, [selected]);

  const filtered = proveedores.filter((proveedor) =>
    normalizeText(getCashflowProveedorLabel(proveedor)).includes(normalizeText(query))
  );

  async function handleCreate() {
    const cleanName = query.trim();

    if (!cleanName) return;

    setCreating(true);
    const created = await onCreate(cleanName);
    setCreating(false);

    if (created) {
      onChange(created.id, getCashflowProveedorLabel(created));
      setQuery(getCashflowProveedorLabel(created));
      setOpen(false);
    }
  }

  const canCreate =
    query.trim().length >= 2 &&
    !proveedores.some(
      (proveedor) => normalizeText(getCashflowProveedorLabel(proveedor)) === normalizeText(query)
    );

  return (
    <div className={["relative", open ? "z-[140]" : "z-0"].join(" ")}>
      <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3 focus-within:border-[#4f7c90]">
        <input
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);

            if (!event.target.value.trim()) {
              onChange("", "");
            }
          }}
          placeholder="Buscar o crear proveedor"
          className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
        />

        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 text-[#64748b]"
        >
          <ChevronDown
            size={13}
            strokeWidth={1.8}
            className={["transition", open ? "rotate-180" : ""].join(" ")}
          />
        </button>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-label="Cerrar selector proveedor"
          />

          <div className="absolute left-0 right-0 top-[36px] z-[150] max-h-64 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-xl">
            {filtered.map((proveedor) => (
              <button
                key={proveedor.id}
                type="button"
                onClick={() => {
                  onChange(proveedor.id, getCashflowProveedorLabel(proveedor));
                  setQuery(getCashflowProveedorLabel(proveedor));
                  setOpen(false);
                }}
                className={[
                  "flex h-8 w-full items-center rounded-[10px] px-3 text-left text-[12px] font-medium transition",
                  proveedor.id === value
                    ? "bg-[#4f7c90] text-white"
                    : "text-[#334155] hover:bg-[#f1f5f9]"
                ].join(" ")}
              >
                <span className="truncate">{getCashflowProveedorLabel(proveedor)}</span>
              </button>
            ))}

            {canCreate ? (
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating}
                className="mt-1 flex h-8 w-full items-center rounded-[10px] bg-[#4f7c90] px-3 text-left text-[12px] font-medium text-white transition hover:bg-[#406b7d] disabled:opacity-50"
              >
                {creating ? "Creando..." : `+ Crear proveedor “${query.trim()}”`}
              </button>
            ) : null}

            {filtered.length === 0 && !canCreate ? (
              <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                Escribí al menos 2 letras para crear un proveedor.
              </div>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/* =========================================================
   CARDS / CALENDARIO
========================================================= */

function SmallIconButton({
  icon: Icon,
  title,
  onClick,
  tone = "neutral"
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  tone?: "neutral" | "orange" | "green" | "blue";
}) {
  const toneClass = {
    neutral: "text-[#64748b] hover:bg-white hover:text-[#172033]",
    orange: "text-nostur-orange hover:bg-white",
    green: "text-emerald-700 hover:bg-white",
    blue: "text-sky-700 hover:bg-white"
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className={["flex h-7 w-7 items-center justify-center rounded-[9px]", toneClass].join(" ")}
      title={title}
    >
      <Icon size={13} strokeWidth={1.8} />
    </button>
  );
}

function CashflowItemCard({
  item,
  selected,
  onSelect,
  onDetail,
  onAdjust,
  onPay,
  onEditRecurrente
}: {
  item: CashflowItem;
  selected: boolean;
  onSelect: () => void;
  onDetail: () => void;
  onAdjust: () => void;
  onPay: () => void;
  onEditRecurrente: () => void;
}) {
  const saldo = parseMoney(item.saldo_pendiente);
  const canPay = saldo > 0.009 && Boolean(item.factura_id);
  const isProjected = item.tipo_origen === "RECURRENTE_PROYECTADO" || item.es_proyectado;
  const isOverdue = item.fecha < getToday() && saldo > 0.009;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition xl:grid-cols-[86px_minmax(0,1.05fr)_minmax(0,1.35fr)_112px_112px_116px]",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : isOverdue
            ? "border-red-200 bg-red-50/70 hover:bg-red-50"
            : "border-black/10 bg-[#f8fafc] hover:bg-white"
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[#172033]">{formatDate(item.fecha)}</div>

        <div className="mt-1 flex flex-wrap gap-1">
          <EstadoBadge item={item} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-[#172033]">
          {item.proveedor_nombre || "Sin proveedor"}
        </div>

        <div className="truncate text-[11px] font-normal text-[#64748b]">
          {item.numero_factura || "Sin número"}
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-[#172033]">
          {item.concepto || item.descripcion || "Sin concepto"}
        </div>

        <div className="truncate text-[11px] font-normal text-[#64748b]">
          {item.periodo || "—"} · {item.sucursal_nombre || "Sin sucursal"}
        </div>

        <div className="mt-1">
          <OrigenBadge item={item} />
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[#172033]">
          {formatMoneyAR(item.importe, item.moneda)}
        </div>

        <div className="text-[11px] font-normal text-[#64748b]">Importe</div>
      </div>

      <div className="min-w-0">
        <div
          className={[
            "text-[12px] font-semibold",
            saldo > 0.009 ? "text-red-700" : "text-emerald-700"
          ].join(" ")}
        >
          {formatMoneyAR(item.saldo_pendiente, item.moneda)}
        </div>

        <div className="text-[11px] font-normal text-[#64748b]">Saldo</div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <SmallIconButton
          icon={Eye}
          title="Ver detalle"
          onClick={(event) => {
            event.stopPropagation();
            onDetail();
          }}
        />

        <SmallIconButton
          icon={Pencil}
          title={isProjected ? "Cargar factura real" : "Ajustar factura"}
          tone="orange"
          onClick={(event) => {
            event.stopPropagation();
            onAdjust();
          }}
        />

        {canPay ? (
          <SmallIconButton
            icon={Wallet}
            title="Registrar pago"
            tone="green"
            onClick={(event) => {
              event.stopPropagation();
              onPay();
            }}
          />
        ) : null}

        {isProjected && item.recurrente_id ? (
          <SmallIconButton
            icon={Repeat}
            title="Editar recurrente"
            tone="blue"
            onClick={(event) => {
              event.stopPropagation();
              onEditRecurrente();
            }}
          />
        ) : null}
      </div>
    </button>
  );
}

function CalendarMonthView({
  year,
  month,
  itemsByDay,
  onSelectDayItem
}: {
  year: number;
  month: number;
  itemsByDay: Record<string, CashflowItem[]>;
  onSelectDayItem: (item: CashflowItem) => void;
}) {
  const days = getDaysInMonth(year, month);

  return (
    <section className="rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-semibold text-[#172033]">Vista mensual por día</h2>

          <p className="text-[11.5px] font-normal text-[#64748b]">
            {MONTH_NAMES[month - 1]} {year}
          </p>
        </div>
      </div>

      <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        {days.map((day) => {
          const dayItems = itemsByDay[day] || [];
          const totalArs = dayItems
            .filter((item) => item.moneda === "ARS")
            .reduce((total, item) => total + parseMoney(item.saldo_pendiente), 0);
          const totalUsd = dayItems
            .filter((item) => item.moneda === "USD")
            .reduce((total, item) => total + parseMoney(item.saldo_pendiente), 0);

          return (
            <div
              key={day}
              className={[
                "min-h-[126px] rounded-[14px] border p-2",
                day === getToday()
                  ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                  : dayItems.length > 0
                    ? "border-black/10 bg-[#f8fafc]"
                    : "border-black/5 bg-white/40"
              ].join(" ")}
            >
              <div className="mb-1 flex items-center justify-between gap-2">
                <div className="text-[12px] font-semibold text-[#172033]">
                  {day.slice(8, 10)}
                </div>

                {dayItems.length > 0 ? (
                  <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-medium text-[#64748b] ring-1 ring-black/10">
                    {dayItems.length}
                  </span>
                ) : null}
              </div>

              {dayItems.length > 0 ? (
                <div className="mb-2 grid gap-0.5 text-[10.5px] font-semibold">
                  {totalArs > 0 ? <div className="text-red-700">{formatMoneyAR(totalArs, "ARS")}</div> : null}
                  {totalUsd > 0 ? <div className="text-emerald-700">{formatMoneyAR(totalUsd, "USD")}</div> : null}
                </div>
              ) : null}

              <div className="grid gap-1">
                {dayItems.slice(0, 3).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onSelectDayItem(item)}
                    className={[
                      "rounded-[10px] border px-2 py-1 text-left transition hover:bg-white",
                      item.tipo_origen === "RECURRENTE_PROYECTADO" || item.es_proyectado
                        ? "border-sky-200 bg-sky-50"
                        : item.fecha < getToday() && parseMoney(item.saldo_pendiente) > 0.009
                          ? "border-red-200 bg-red-50"
                          : "border-black/10 bg-white/70"
                    ].join(" ")}
                  >
                    <div className="truncate text-[10.5px] font-semibold text-[#172033]">
                      {item.proveedor_nombre || "Proveedor"}
                    </div>

                    <div className="truncate text-[9.5px] font-medium text-[#64748b]">
                      {formatMoneyAR(item.saldo_pendiente, item.moneda)}
                    </div>
                  </button>
                ))}

                {dayItems.length > 3 ? (
                  <div className="rounded-[10px] bg-white/70 px-2 py-1 text-[9.5px] font-medium text-[#64748b] ring-1 ring-black/10">
                    +{dayItems.length - 3} más
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* =========================================================
   MODAL FACTURA / AJUSTE
========================================================= */

function FacturaModal({
  item,
  proveedores,
  saving,
  onClose,
  onSave,
  onCreateProveedor
}: {
  item: CashflowItem | null;
  proveedores: ProveedorLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: CashflowFacturaDraft) => Promise<void>;
  onCreateProveedor: (nombre: string) => Promise<ProveedorLite | null>;
}) {
  const [draft, setDraft] = useState<CashflowFacturaDraft>(() =>
    createFacturaDraftFromCashflowItem(item)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  const isProjected = item?.tipo_origen === "RECURRENTE_PROYECTADO" || item?.es_proyectado;

  function setField<K extends keyof CashflowFacturaDraft>(
    key: K,
    value: CashflowFacturaDraft[K]
  ) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function validate(): string | null {
    if (!draft.proveedor_id && !draft.proveedor_nombre.trim()) {
      return "Seleccioná o creá un proveedor.";
    }

    if (!draft.descripcion.trim()) return "Ingresá una descripción.";
    if (!draft.fecha_vencimiento) return "Seleccioná fecha de vencimiento.";
    if (parseMoney(draft.total) <= 0) return "El total debe ser mayor a cero.";

    return null;
  }

  function handleSave() {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    onSave(draft);
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-8 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-56px)] w-full max-w-6xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {isProjected ? "Cargar factura real" : "Ajustar factura"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Completá importe real, datos fiscales y vencimiento. Esto actualiza Cashflow y
              Facturas a pagar.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        {isProjected ? (
          <div className="mb-4 rounded-[14px] border border-sky-200 bg-sky-50 px-3 py-2.5 text-[12px] font-medium text-sky-700">
            Este ítem viene de un recurrente estimado. Al guardar, se genera o actualiza la factura
            real de este período.
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_310px]">
          <main className="rounded-[16px] border border-black/10 bg-white p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Proveedor *</FieldLabel>

                <ProveedorInlineSelect
                  value={draft.proveedor_id || ""}
                  onChange={(id, label) => {
                    setField("proveedor_id", id || null);
                    setField("proveedor_nombre", label);
                  }}
                  proveedores={proveedores}
                  onCreate={onCreateProveedor}
                />
              </div>

              <div>
                <FieldLabel>Número de factura</FieldLabel>

                <TextInput
                  value={draft.numero_factura}
                  onChange={(value) => setField("numero_factura", value)}
                  placeholder="Ej: A-001-00001234"
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Descripción *</FieldLabel>

                <TextInput
                  value={draft.descripcion}
                  onChange={(value) => setField("descripcion", value)}
                  placeholder="Ej: Alquiler Local - Mayo 2026"
                />
              </div>

              <div>
                <FieldLabel>Fecha emisión</FieldLabel>

                <NosturDateInput
                  value={draft.fecha_emision}
                  onChange={(value) => setField("fecha_emision", value)}
                />
              </div>

              <div>
                <FieldLabel>Fecha vencimiento *</FieldLabel>

                <NosturDateInput
                  value={draft.fecha_vencimiento}
                  onChange={(value) => {
                    setField("fecha_vencimiento", value);
                    if (value) setField("periodo", value.slice(0, 7));
                  }}
                />
              </div>

              <div>
                <FieldLabel>Período</FieldLabel>

                <TextInput
                  value={draft.periodo || ""}
                  onChange={(value) => setField("periodo", value)}
                  placeholder="2026-05"
                />
              </div>

              <div>
                <FieldLabel>Moneda</FieldLabel>

                <NosturSelect
                  value={draft.moneda}
                  onChange={(value) => setField("moneda", value)}
                  options={MONEDA_FORM_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>Neto gravado</FieldLabel>

                <TextInput
                  value={draft.neto_gravado}
                  onChange={(value) => setField("neto_gravado", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>IVA %</FieldLabel>

                <NosturSelect
                  value={draft.iva_porcentaje}
                  onChange={(value) => {
                    const nextIva = value;
                    const neto = parseMoney(draft.neto_gravado);
                    const ivaImporte = (neto * parseMoney(nextIva)) / 100;

                    setDraft((current) => ({
                      ...current,
                      iva_porcentaje: nextIva,
                      iva_importe: String(ivaImporte.toFixed(2)).replace(".", ",")
                    }));
                  }}
                  options={IVA_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>IVA importe</FieldLabel>

                <TextInput
                  value={draft.iva_importe}
                  onChange={(value) => setField("iva_importe", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>No gravado</FieldLabel>

                <TextInput
                  value={draft.no_gravado}
                  onChange={(value) => setField("no_gravado", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Exento</FieldLabel>

                <TextInput
                  value={draft.exento}
                  onChange={(value) => setField("exento", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Total real *</FieldLabel>

                <TextInput
                  value={draft.total}
                  onChange={(value) => setField("total", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Estado</FieldLabel>

                <NosturSelect
                  value={draft.estado}
                  onChange={(value) =>
                    setField("estado", value as CashflowFacturaDraft["estado"])
                  }
                  options={[
                    { value: "PENDIENTE", label: "Pendiente" },
                    { value: "PROYECTADA", label: "Proyectada" }
                  ]}
                />
              </div>

              <div className="md:col-span-2 flex flex-wrap gap-2">
                <BooleanChip
                  checked={draft.no_impacta_caja}
                  onChange={(value) => setField("no_impacta_caja", value)}
                  label="No impacta caja"
                />

                <BooleanChip
                  checked={draft.plan_pago}
                  onChange={(value) => setField("plan_pago", value)}
                  label="Plan de pago"
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Observaciones</FieldLabel>

                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Notas internas, aclaraciones, datos de factura..."
                />
              </div>
            </div>
          </main>

          <aside className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
            <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Resumen</h3>

            <div className="grid gap-2.5 text-[12px]">
              <div className="rounded-[14px] border border-black/10 bg-white p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">Neto gravado</span>
                  <strong className="font-semibold">
                    {formatMoneyAR(draft.neto_gravado, draft.moneda)}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">IVA</span>
                  <strong className="font-semibold">
                    {formatMoneyAR(draft.iva_importe, draft.moneda)}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">No gravado</span>
                  <strong className="font-semibold">
                    {formatMoneyAR(draft.no_gravado, draft.moneda)}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">Exento</span>
                  <strong className="font-semibold">
                    {formatMoneyAR(draft.exento, draft.moneda)}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between gap-3 border-t border-black/10 pt-2">
                  <span className="font-semibold text-[#172033]">Total</span>
                  <strong className="font-semibold text-[#172033]">
                    {formatMoneyAR(draft.total, draft.moneda)}
                  </strong>
                </div>
              </div>

              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-700">
                El ajuste queda reflejado en Facturas a pagar y en el flujo mensual.
              </div>

              {draft.no_impacta_caja ? (
                <div className="rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-[11px] font-medium text-sky-700">
                  Marcado como “No impacta caja”: no generará egreso automático al pagar.
                </div>
              ) : null}
            </div>
          </aside>
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : isProjected ? "Cargar factura real" : "Guardar ajuste"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MODAL PAGO
========================================================= */

function PagoModal({
  item,
  cajas,
  saving,
  onClose,
  onSave
}: {
  item: CashflowItem | null;
  cajas: CajaLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: CashflowPagoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CashflowPagoDraft>(() =>
    createPagoDraftFromCashflowItem(item)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof CashflowPagoDraft>(key: K, value: CashflowPagoDraft[K]) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  const cajaOptions: SelectOption[] = cajas
    .filter((caja) => !item || !caja.moneda || caja.moneda === item.moneda)
    .map((caja) => ({
      value: caja.id,
      label: getCashflowCajaLabel(caja)
    }));

  function validate(): string | null {
    if (!item) return "No hay ítem seleccionado.";
    if (!draft.factura_id) {
      return "Este ítem todavía no tiene factura real. Primero cargá la factura.";
    }

    if (!draft.fecha_pago) return "Seleccioná fecha de pago.";

    if (!draft.no_impacta_caja && !draft.caja_id) {
      return "Seleccioná la caja desde donde se paga.";
    }

    if (!draft.forma_pago.trim()) return "Indicá la forma de pago.";
    if (parseMoney(draft.importe) <= 0) return "El importe debe ser mayor a cero.";

    if (parseMoney(draft.importe) > parseMoney(item.saldo_pendiente) + 0.009) {
      return "El pago no puede superar el saldo pendiente.";
    }

    return null;
  }

  function handleSave() {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    onSave(draft);
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Registrar pago</h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {item
                ? `${item.proveedor_nombre || "Proveedor"} · ${
                    item.concepto || "Cashflow"
                  }`
                : "Seleccioná un ítem"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        {!item ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            No hay ítem seleccionado.
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-2.5 md:grid-cols-3">
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Total</FieldLabel>
                <div className="text-[13px] font-semibold text-[#172033]">
                  {formatMoneyAR(item.importe, item.moneda)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Saldo</FieldLabel>
                <div className="text-[13px] font-semibold text-red-700">
                  {formatMoneyAR(item.saldo_pendiente, item.moneda)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Vence</FieldLabel>
                <div className="text-[13px] font-semibold text-[#172033]">
                  {formatDate(item.fecha)}
                </div>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Fecha de pago</FieldLabel>

                <NosturDateInput
                  value={draft.fecha_pago}
                  onChange={(value) => setField("fecha_pago", value)}
                />
              </div>

              <div>
                <FieldLabel>Importe</FieldLabel>

                <TextInput
                  value={draft.importe}
                  onChange={(value) => setField("importe", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Caja</FieldLabel>

                <NosturSelect
                  value={draft.caja_id || ""}
                  onChange={(value) => {
                    const caja = cajas.find((itemCaja) => itemCaja.id === value);
                    setField("caja_id", value || null);
                    setField("caja_nombre", caja?.nombre || "");
                  }}
                  options={cajaOptions}
                  placeholder="Seleccionar caja"
                />
              </div>

              <div>
                <FieldLabel>Forma de pago</FieldLabel>

                <TextInput
                  value={draft.forma_pago}
                  onChange={(value) => setField("forma_pago", value)}
                  placeholder="Transferencia, efectivo..."
                />
              </div>

              <div>
                <FieldLabel>Moneda</FieldLabel>

                <TextInput value={draft.moneda || item.moneda} onChange={() => undefined} disabled />
              </div>

              <div>
                <FieldLabel>Impacto</FieldLabel>

                <BooleanChip
                  checked={draft.no_impacta_caja}
                  onChange={(value) => setField("no_impacta_caja", value)}
                  label="No impacta caja"
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Observaciones</FieldLabel>

                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Detalle del pago..."
                />
              </div>
            </div>

            <div className="mt-4 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[12px] font-medium text-amber-700">
              Si impacta en caja, se genera un egreso automático desde Cashflow.
            </div>
          </>
        )}

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving || !item}
            onClick={handleSave}
            className="h-8 rounded-[10px] bg-emerald-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   MODAL RECURRENTE
========================================================= */

function RecurrenteModal({
  item,
  proveedores,
  saving,
  onClose,
  onSave,
  onCreateProveedor
}: {
  item: CashflowItem | null;
  proveedores: ProveedorLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: CashflowRecurrenteDraft) => Promise<void>;
  onCreateProveedor: (nombre: string) => Promise<ProveedorLite | null>;
}) {
  const [draft, setDraft] = useState<CashflowRecurrenteDraft>(() =>
    item
      ? createRecurrenteDraftFromCashflowItem(item)
      : {
          id: "",
          proveedor_id: null,
          proveedor_nombre: "",
          descripcion: "",
          moneda: "ARS",
          importe_estimado: "",
          dia_vencimiento: "10",
          categoria: "",
          no_impacta_caja: false,
          generar_automatico: true,
          fecha_inicio: getToday(),
          fecha_fin: "",
          observaciones: "",
          activo: true
        }
  );

  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof CashflowRecurrenteDraft>(
    key: K,
    value: CashflowRecurrenteDraft[K]
  ) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function validate(): string | null {
    if (!draft.id) return "No hay recurrente seleccionado.";
    if (!draft.descripcion.trim()) return "Ingresá una descripción.";
    if (parseMoney(draft.importe_estimado) <= 0) {
      return "El importe estimado debe ser mayor a cero.";
    }

    if (Number(draft.dia_vencimiento) < 1 || Number(draft.dia_vencimiento) > 31) {
      return "El día de vencimiento debe estar entre 1 y 31.";
    }

    return null;
  }

  function handleSave() {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    onSave(draft);
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-10 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-3xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Editar recurrente</h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Modifica la plantilla del gasto recurrente para próximas proyecciones.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel>Proveedor</FieldLabel>

            <ProveedorInlineSelect
              value={draft.proveedor_id || ""}
              onChange={(id, label) => {
                setField("proveedor_id", id || null);
                setField("proveedor_nombre", label);
              }}
              proveedores={proveedores}
              onCreate={onCreateProveedor}
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Descripción *</FieldLabel>

            <TextInput
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Ej: Alquiler Local General Paz"
            />
          </div>

          <div>
            <FieldLabel>Importe estimado *</FieldLabel>

            <TextInput
              value={draft.importe_estimado}
              onChange={(value) => setField("importe_estimado", value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>

          <div>
            <FieldLabel>Moneda</FieldLabel>

            <NosturSelect
              value={draft.moneda}
              onChange={(value) => setField("moneda", value)}
              options={MONEDA_FORM_OPTIONS}
            />
          </div>

          <div>
            <FieldLabel>Día vencimiento</FieldLabel>

            <TextInput
              value={draft.dia_vencimiento}
              onChange={(value) => setField("dia_vencimiento", value.replace(/\D/g, ""))}
              placeholder="10"
              inputMode="numeric"
            />
          </div>

          <div>
            <FieldLabel>Categoría</FieldLabel>

            <TextInput
              value={draft.categoria}
              onChange={(value) => setField("categoria", value)}
              placeholder="Alquileres, servicios..."
            />
          </div>

          <div>
            <FieldLabel>Inicio</FieldLabel>

            <NosturDateInput
              value={draft.fecha_inicio}
              onChange={(value) => setField("fecha_inicio", value)}
            />
          </div>

          <div>
            <FieldLabel>Fin</FieldLabel>

            <NosturDateInput
              value={draft.fecha_fin}
              onChange={(value) => setField("fecha_fin", value)}
            />
          </div>

          <div className="md:col-span-2 flex flex-wrap gap-2">
            <BooleanChip
              checked={draft.no_impacta_caja}
              onChange={(value) => setField("no_impacta_caja", value)}
              label="No impacta caja"
            />

            <BooleanChip
              checked={draft.generar_automatico}
              onChange={(value) => setField("generar_automatico", value)}
              label="Generar automático"
            />

            <BooleanChip
              checked={draft.activo}
              onChange={(value) => setField("activo", value)}
              label={draft.activo ? "Activo" : "Inactivo"}
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Observaciones</FieldLabel>

            <TextArea
              value={draft.observaciones}
              onChange={(value) => setField("observaciones", value)}
              placeholder="Notas internas..."
            />
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-[12px] font-medium text-sky-700">
          Esto modifica el recurrente base. Para ajustar solo el gasto concreto del mes, usá
          “Cargar factura real”.
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="h-8 rounded-[10px] bg-sky-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-sky-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar recurrente"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   DETALLE
========================================================= */

function DetalleModal({
  item,
  onClose,
  onAdjust,
  onPay,
  onEditRecurrente
}: {
  item: CashflowItem | null;
  onClose: () => void;
  onAdjust: () => void;
  onPay: () => void;
  onEditRecurrente: () => void;
}) {
  if (!item) return null;

  const saldo = parseMoney(item.saldo_pendiente);
  const isProjected = item.tipo_origen === "RECURRENTE_PROYECTADO" || item.es_proyectado;

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-10 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-64px)] w-full max-w-4xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-[#172033]">
              {item.proveedor_nombre || "Cashflow"}
            </h2>

            <p className="mt-0.5 truncate text-[12px] font-normal text-[#64748b]">
              {item.concepto || item.descripcion || "Sin concepto"} · {formatDate(item.fecha)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-4 grid gap-2.5 md:grid-cols-4">
          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Importe</FieldLabel>
            <div className="text-[13px] font-semibold text-[#172033]">
              {formatMoneyAR(item.importe, item.moneda)}
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Saldo</FieldLabel>
            <div
              className={[
                "text-[13px] font-semibold",
                saldo > 0 ? "text-red-700" : "text-emerald-700"
              ].join(" ")}
            >
              {formatMoneyAR(item.saldo_pendiente, item.moneda)}
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Estado</FieldLabel>
            <div className="mt-1">
              <EstadoBadge item={item} />
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Origen</FieldLabel>
            <div className="mt-1">
              <OrigenBadge item={item} />
            </div>
          </div>
        </div>

        <section className="rounded-[16px] border border-black/10 bg-white p-3">
          <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Datos del ítem</h3>

          <div className="grid gap-2.5 text-[12px] md:grid-cols-2">
            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <FieldLabel>Proveedor</FieldLabel>
              <div className="font-semibold text-[#172033]">{item.proveedor_nombre || "—"}</div>
            </div>

            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <FieldLabel>Comprobante</FieldLabel>
              <div className="font-semibold text-[#172033]">{item.numero_factura || "—"}</div>
            </div>

            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <FieldLabel>Fecha</FieldLabel>
              <div className="font-semibold text-[#172033]">{formatDate(item.fecha)}</div>
            </div>

            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <FieldLabel>Período</FieldLabel>
              <div className="font-semibold text-[#172033]">{item.periodo || "—"}</div>
            </div>

            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <FieldLabel>Sucursal</FieldLabel>
              <div className="font-semibold text-[#172033]">{item.sucursal_nombre || "—"}</div>
            </div>

            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <FieldLabel>Caja</FieldLabel>
              <div className="font-semibold text-[#172033]">
                {item.no_impacta_caja ? "No impacta caja" : "Impacta caja al pagar"}
              </div>
            </div>

            {item.observaciones ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 md:col-span-2">
                <FieldLabel>Observaciones</FieldLabel>
                <div className="font-medium leading-relaxed text-[#334155]">
                  {item.observaciones}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <div className="mt-5 flex flex-wrap justify-end gap-2">
          {isProjected && item.recurrente_id ? (
            <button
              type="button"
              onClick={onEditRecurrente}
              className="h-8 rounded-[10px] border border-sky-200 bg-sky-50 px-3 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
            >
              Editar recurrente
            </button>
          ) : null}

          {saldo > 0.009 && item.factura_id ? (
            <button
              type="button"
              onClick={onPay}
              className="h-8 rounded-[10px] bg-emerald-700 px-3 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-800"
            >
              Registrar pago
            </button>
          ) : null}

          <button
            type="button"
            onClick={onAdjust}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-3 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
          >
            {isProjected ? "Cargar factura real" : "Ajustar factura"}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PANEL PRINCIPAL
========================================================= */

export function CashflowPanel() {
  const loading = useCashflowStore((state) => state.loading);
  const saving = useCashflowStore((state) => state.saving);
  const error = useCashflowStore((state) => state.error);
  const currentProfile = useCashflowStore((state) => state.currentProfile);
  const canManageCashflow = useCashflowStore((state) => state.canManageCashflow);
  const catalogos = useCashflowStore((state) => state.catalogos);
  const filters = useCashflowStore((state) => state.filters);
  const selectedItemId = useCashflowStore((state) => state.selectedItemId);

  const loadCashflow = useCashflowStore((state) => state.loadCashflow);
  const saveFacturaFromCashflow = useCashflowStore((state) => state.saveFacturaFromCashflow);
  const registrarPagoFromCashflow = useCashflowStore((state) => state.registrarPagoFromCashflow);
  const updateRecurrenteFromCashflow = useCashflowStore(
    (state) => state.updateRecurrenteFromCashflow
  );
  const createProveedorInline = useCashflowStore((state) => state.createProveedorInline);

  const setFilter = useCashflowStore((state) => state.setFilter);
  const resetFilters = useCashflowStore((state) => state.resetFilters);
  const selectItem = useCashflowStore((state) => state.selectItem);
  const clearError = useCashflowStore((state) => state.clearError);

  const getFilteredItems = useCashflowStore((state) => state.getFilteredItems);
  const getItemsByDay = useCashflowStore((state) => state.getItemsByDay);
  const getMetrics = useCashflowStore((state) => state.getMetrics);

  const items = getFilteredItems();
  const itemsByDay = getItemsByDay();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [modalItem, setModalItem] = useState<CashflowItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const selectedItem = useMemo(() => {
    return items.find((item) => item.id === selectedItemId) || items[0] || null;
  }, [items, selectedItemId]);

  useEffect(() => {
    loadCashflow();
  }, [loadCashflow]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function openModal(mode: ModalMode, item: CashflowItem | null = selectedItem) {
    if (!item && mode !== "factura") {
      showToast("Seleccioná un ítem del cashflow.", "error");
      return;
    }

    if (item) selectItem(item.id);

    setModalItem(item);
    setModalMode(mode);
  }

  async function handleSaveFactura(draft: CashflowFacturaDraft) {
    const ok = await saveFacturaFromCashflow(draft);

    if (ok) {
      setModalMode(null);
      setModalItem(null);
      showToast("Factura actualizada correctamente.");
    }
  }

  async function handlePago(draft: CashflowPagoDraft) {
    const ok = await registrarPagoFromCashflow(draft);

    if (ok) {
      setModalMode(null);
      setModalItem(null);
      showToast("Pago registrado correctamente.");
    }
  }

  async function handleSaveRecurrente(draft: CashflowRecurrenteDraft) {
    const ok = await updateRecurrenteFromCashflow(draft);

    if (ok) {
      setModalMode(null);
      setModalItem(null);
      showToast("Recurrente actualizado correctamente.");
    }
  }

  const proveedorOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...catalogos.proveedores.map((proveedor) => ({
      value: proveedor.id,
      label: getCashflowProveedorLabel(proveedor)
    }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "todas", label: "Todas" },
    ...catalogos.sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Cashflow
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Flujo de caja
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManageCashflow
                ? "Facturas, planes de pago, recurrentes proyectados y pagos."
                : `Vista asignada a ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={loadCashflow}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => openModal("factura", null)}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Factura manual
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
                  {MONTH_NAMES[filters.mes - 1]} {filters.anio}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Estado: {filters.estado} · Moneda: {filters.moneda} · Origen: {filters.origen}
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
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[150px_180px_150px_1fr_170px_170px]">
                <div>
                  <FieldLabel>Año</FieldLabel>
                  <NosturSelect
                    value={String(filters.anio)}
                    onChange={(value) => setFilter("anio", Number(value))}
                    options={YEAR_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Mes</FieldLabel>
                  <NosturSelect
                    value={String(filters.mes)}
                    onChange={(value) => setFilter("mes", Number(value))}
                    options={MONTH_OPTIONS}
                  />
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
                  <FieldLabel>Proveedor</FieldLabel>
                  <NosturSelect
                    value={filters.proveedorId}
                    onChange={(value) => setFilter("proveedorId", value)}
                    options={proveedorOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Origen</FieldLabel>
                  <NosturSelect
                    value={filters.origen}
                    onChange={(value) => setFilter("origen", value as typeof filters.origen)}
                    options={ORIGEN_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Estado</FieldLabel>
                  <NosturSelect
                    value={filters.estado}
                    onChange={(value) => setFilter("estado", value as typeof filters.estado)}
                    options={ESTADO_OPTIONS}
                  />
                </div>

                <div className="lg:col-span-2">
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
                    placeholder="Buscar por proveedor, concepto, comprobante, período..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadCashflow}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Aplicar filtros
                </button>

                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Limpiar
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            label="Saldo ARS"
            value={formatMoneyAR(metrics.saldoMesArs, "ARS")}
            icon={Wallet}
            tone="blue"
          />
          <MetricCard
            label="Saldo USD"
            value={formatMoneyAR(metrics.saldoMesUsd, "USD")}
            icon={Wallet}
            tone="green"
          />
          <MetricCard label="Vencidas" value={metrics.vencidas} icon={AlertTriangle} tone="red" />
          <MetricCard label="Por vencer" value={metrics.porVencer} icon={Clock3} tone="amber" />
          <MetricCard label="Proyectadas" value={metrics.proyectadas} icon={Repeat} tone="blue" />
          <MetricCard label="Pagadas" value={metrics.pagadas} icon={CheckCircle2} tone="green" />
        </section>

        <div className="relative z-0 mb-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Listado del mes</h2>
                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${items.length} ítems encontrados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando cashflow...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay ítems para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {items.map((item) => (
                  <CashflowItemCard
                    key={item.id}
                    item={item}
                    selected={selectedItem?.id === item.id}
                    onSelect={() => selectItem(item.id)}
                    onDetail={() => openModal("detalle", item)}
                    onAdjust={() => openModal("factura", item)}
                    onPay={() => openModal("pago", item)}
                    onEditRecurrente={() => openModal("recurrente", item)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            {!selectedItem ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná un ítem del flujo.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                      {selectedItem.proveedor_nombre || "Sin proveedor"}
                    </h2>

                    <p className="mt-0.5 truncate text-[11.5px] font-normal text-[#64748b]">
                      {selectedItem.concepto || selectedItem.descripcion || "Sin concepto"}
                    </p>
                  </div>

                  <EstadoBadge item={selectedItem} />
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Saldo pendiente</FieldLabel>

                    <div
                      className={[
                        "truncate text-[23px] font-semibold tracking-tight",
                        parseMoney(selectedItem.saldo_pendiente) > 0
                          ? "text-red-700"
                          : "text-emerald-700"
                      ].join(" ")}
                    >
                      {formatMoneyAR(selectedItem.saldo_pendiente, selectedItem.moneda)}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Datos</FieldLabel>

                    <div className="flex justify-between gap-3">
                      <span>Importe</span>
                      <strong className="font-semibold">
                        {formatMoneyAR(selectedItem.importe, selectedItem.moneda)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Vencimiento</span>
                      <strong className="font-semibold">{formatDate(selectedItem.fecha)}</strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Origen</span>
                      <strong className="font-semibold">{getItemOrigenLabel(selectedItem)}</strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Factura</span>
                      <strong className="font-semibold">{selectedItem.numero_factura || "—"}</strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    {selectedItem.factura_id &&
                    parseMoney(selectedItem.saldo_pendiente) > 0.009 ? (
                      <button
                        type="button"
                        onClick={() => openModal("pago", selectedItem)}
                        className="h-8 rounded-[10px] bg-emerald-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-800"
                      >
                        Registrar pago
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openModal("factura", selectedItem)}
                      className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                    >
                      {selectedItem.tipo_origen === "RECURRENTE_PROYECTADO" ||
                      selectedItem.es_proyectado
                        ? "Cargar factura real"
                        : "Ajustar factura"}
                    </button>

                    <button
                      type="button"
                      onClick={() => openModal("detalle", selectedItem)}
                      className="h-8 rounded-[10px] border border-black/10 bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Ver detalle
                    </button>

                    {(selectedItem.tipo_origen === "RECURRENTE_PROYECTADO" ||
                      selectedItem.es_proyectado) &&
                    selectedItem.recurrente_id ? (
                      <button
                        type="button"
                        onClick={() => openModal("recurrente", selectedItem)}
                        className="h-8 rounded-[10px] border border-sky-200 bg-sky-50 px-4 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
                      >
                        Editar recurrente base
                      </button>
                    ) : null}
                  </div>

                  <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-700">
                    Los recurrentes proyectados son estimaciones. Cuando llegue la factura real,
                    cargala desde acá para ajustar el flujo.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>

        <CalendarMonthView
          year={filters.anio}
          month={filters.mes}
          itemsByDay={itemsByDay}
          onSelectDayItem={(item) => {
            selectItem(item.id);
            openModal("detalle", item);
          }}
        />
      </main>

      {modalMode === "factura" ? (
        <FacturaModal
          item={modalItem}
          proveedores={catalogos.proveedores}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setModalItem(null);
          }}
          onSave={handleSaveFactura}
          onCreateProveedor={createProveedorInline}
        />
      ) : null}

      {modalMode === "pago" ? (
        <PagoModal
          item={modalItem || selectedItem}
          cajas={catalogos.cajas}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setModalItem(null);
          }}
          onSave={handlePago}
        />
      ) : null}

      {modalMode === "recurrente" ? (
        <RecurrenteModal
          item={modalItem || selectedItem}
          proveedores={catalogos.proveedores}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setModalItem(null);
          }}
          onSave={handleSaveRecurrente}
          onCreateProveedor={createProveedorInline}
        />
      ) : null}

      {modalMode === "detalle" ? (
        <DetalleModal
          item={modalItem || selectedItem}
          onClose={() => {
            setModalMode(null);
            setModalItem(null);
          }}
          onAdjust={() => setModalMode("factura")}
          onPay={() => setModalMode("pago")}
          onEditRecurrente={() => setModalMode("recurrente")}
        />
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default CashflowPanel;