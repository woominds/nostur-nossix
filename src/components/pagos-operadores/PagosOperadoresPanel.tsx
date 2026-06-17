// src/components/pagos-operadores/PagosOperadoresPanel.tsx

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
  Eye,
  FileText,
  Filter,
  RefreshCcw,
  Search,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import {
  usePagosOperadoresStore,
  type Caja,
  type FileOperador,
  type PagoOperador
} from "../../store/pagosOperadoresStore";
import { IconButton } from "../ui/IconButton";
import { formatMoneyAR } from "../../lib/formatters";

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type PagoDraft = {
  fecha_pago: string;
  caja_id: string;
  caja: string;
  importe: string;
  moneda: string;
  observaciones: string;
};

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const ESTADO_PAGO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Pendientes + parciales" },
  { value: "pendiente", label: "Pendientes" },
  { value: "parcial", label: "Parciales" },
  { value: "pagado", label: "Pagados" }
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

function getMonthOptions(): SelectOption[] {
  const currentYear = new Date().getFullYear();
  const options: SelectOption[] = [];

  for (let year = currentYear - 2; year <= currentYear + 1; year += 1) {
    for (let month = 1; month <= 12; month += 1) {
      const value = `${year}-${String(month).padStart(2, "0")}`;

      options.push({
        value,
        label: `${MONTH_NAMES[month - 1]} ${year}`
      });
    }
  }

  return options.reverse();
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

function formatDateAR(value?: string | null): string {
  if (!value) return "—";
  return toDisplayDate(value) || "—";
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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function getEstadoPagoClassName(estado: string): string {
  if (estado === "PAGADO") return "border-green-200 bg-green-50 text-green-700";
  if (estado === "PARCIAL") return "border-amber-200 bg-amber-50 text-amber-700";

  return "border-red-200 bg-red-50 text-red-700";
}

function createInitialPagoDraft(moneda = "ARS"): PagoDraft {
  return {
    fecha_pago: getToday(),
    caja_id: "",
    caja: "",
    importe: "",
    moneda,
    observaciones: ""
  };
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
          <CalendarDays size={14} strokeWidth={1.8} />
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
          />

          <div className="absolute left-0 top-[36px] z-[150] w-[260px] rounded-[16px] border border-black/10 bg-white p-3 shadow-xl">
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

              <div className="text-xs font-semibold text-[#172033]">
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
                      "flex h-7 items-center justify-center rounded-lg text-[11px] font-semibold transition",
                      isSelected
                        ? "bg-[#4f7c90] text-white"
                        : isToday
                          ? "bg-[#eef6f7] text-[#4f7c90]"
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
                      active ? "bg-[#4f7c90] text-white" : "text-[#334155] hover:bg-[#f1f5f9]"
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

function CardMetric({
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

function PagoOperadorForm({
  file,
  saldoOperador,
  cajas,
  saving,
  onSave
}: {
  file: FileOperador;
  saldoOperador: number;
  cajas: Caja[];
  saving: boolean;
  onSave: (draft: PagoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PagoDraft>(() => createInitialPagoDraft(file.moneda));

  useEffect(() => {
    setDraft(createInitialPagoDraft(file.moneda));
  }, [file.id, file.moneda]);

  const cajaOptions: SelectOption[] = cajas
    .filter((caja) => caja.activo !== false && caja.activa !== false)
    .map((caja) => ({ value: caja.id, label: caja.nombre }));

  function setField<K extends keyof PagoDraft>(key: K, value: PagoDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function handleSubmit() {
    await onSave(draft);
    setDraft(createInitialPagoDraft(file.moneda));
  }

  return (
    <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
      <h3 className="mb-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
        Registrar pago al operador
      </h3>

      <div className="grid gap-2.5">
        <div>
          <FieldLabel>Fecha pago</FieldLabel>
          <NosturDateInput
            value={draft.fecha_pago}
            onChange={(value) => setField("fecha_pago", value)}
          />
        </div>

        <div>
          <FieldLabel>Caja</FieldLabel>
          <NosturSelect
            value={draft.caja_id}
            onChange={(value) => {
              const selected = cajas.find((caja) => caja.id === value);

              setDraft((current) => ({
                ...current,
                caja_id: value,
                caja: selected?.nombre || ""
              }));
            }}
            options={cajaOptions}
            placeholder="Seleccionar caja"
          />
        </div>

        <div className="grid grid-cols-[1fr_92px] gap-2">
          <div>
            <FieldLabel>Importe</FieldLabel>
            <TextInput
              value={draft.importe}
              onChange={(value) => setField("importe", value)}
              placeholder={String(saldoOperador).replace(".", ",")}
              inputMode="decimal"
            />
          </div>

          <div>
            <FieldLabel>Moneda</FieldLabel>
            <NosturSelect
              value={draft.moneda}
              onChange={(value) => setField("moneda", value)}
              options={MONEDA_OPTIONS}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Observaciones</FieldLabel>
          <TextArea
            value={draft.observaciones}
            onChange={(value) => setField("observaciones", value)}
            placeholder="Detalle de liquidación, referencia o comprobante..."
          />
        </div>

        <button
          type="button"
          disabled={saving || parseMoney(draft.importe) <= 0}
          onClick={handleSubmit}
          className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
        >
          {saving ? "Registrando..." : "Registrar pago"}
        </button>
      </div>
    </div>
  );
}

function PagosList({ pagos, moneda }: { pagos: PagoOperador[]; moneda: string }) {
  if (pagos.length === 0) {
    return (
      <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-4 text-center text-[12px] font-normal text-[#64748b]">
        Todavía no se registraron pagos al operador.
      </div>
    );
  }

  return (
    <div className="grid gap-1.5">
      {pagos.map((pago) => (
        <div key={pago.id} className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-2.5 text-[12px]">
          <div className="mb-1 flex items-center justify-between gap-3">
            <strong className="font-semibold text-[#172033]">
              {formatMoneyAR(pago.importe, pago.moneda || moneda)}
            </strong>

            <span className="text-[11px] font-medium text-[#64748b]">
              {formatDateAR(pago.fecha_pago)}
            </span>
          </div>

          <div className="font-normal text-[#64748b]">
            Caja: <strong className="font-semibold">{pago.caja || "—"}</strong>
          </div>

          {pago.observaciones ? (
            <div className="mt-1 whitespace-pre-wrap font-normal text-[#64748b]">
              {pago.observaciones}
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function PagosOperadoresPanel() {
  const loading = usePagosOperadoresStore((state) => state.loading);
  const saving = usePagosOperadoresStore((state) => state.saving);
  const error = usePagosOperadoresStore((state) => state.error);
  const currentProfile = usePagosOperadoresStore((state) => state.currentProfile);
  const canManagePagosOperadores = usePagosOperadoresStore(
    (state) => state.canManagePagosOperadores
  );
  const filters = usePagosOperadoresStore((state) => state.filters);
  const catalogos = usePagosOperadoresStore((state) => state.catalogos);
  const selectedFileId = usePagosOperadoresStore((state) => state.selectedFileId);

  const loadPagosOperadores = usePagosOperadoresStore((state) => state.loadPagosOperadores);
  const savePagoOperador = usePagosOperadoresStore((state) => state.savePagoOperador);
  const setFilter = usePagosOperadoresStore((state) => state.setFilter);
  const clearError = usePagosOperadoresStore((state) => state.clearError);
  const selectFile = usePagosOperadoresStore((state) => state.selectFile);

  const getResumen = usePagosOperadoresStore((state) => state.getResumen);
  const getSelectedResumen = usePagosOperadoresStore((state) => state.getSelectedResumen);
  const getMetrics = usePagosOperadoresStore((state) => state.getMetrics);

  const resumen = getResumen();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const selectedResumen = useMemo(
    () => getSelectedResumen(),
    [resumen, selectedFileId, getSelectedResumen]
  );

  const monthOptions = useMemo(() => getMonthOptions(), []);

  const selectedMonthLabel =
    monthOptions.find((option) => option.value === filters.mes)?.label || filters.mes;

  const currentMonthValue = getCurrentMonthValue();

  function applyMonthAndReload(monthValue: string) {
    setFilter("mes", monthValue);

    window.setTimeout(() => {
      loadPagosOperadores();
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
    loadPagosOperadores();
  }, [loadPagosOperadores]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  async function handleSavePago(draft: PagoDraft) {
    if (!selectedResumen) return;

    const importe = parseMoney(draft.importe);

    if (importe <= 0) {
      showToast("El importe debe ser mayor a cero.", "error");
      return;
    }

    const ok = await savePagoOperador({
      file_id: selectedResumen.file.id,
      operador_id: selectedResumen.file.operador_id,
      caja_id: draft.caja_id || null,
      caja: draft.caja || null,
      fecha_pago: draft.fecha_pago,
      importe,
      moneda: draft.moneda,
      observaciones: draft.observaciones
    });

    if (ok) {
      showToast("Pago al operador registrado correctamente.");
    }
  }

  const operadorOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...catalogos.operadores.map((item) => ({
      value: item.id,
      label: item.nombre
    }))
  ];

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

  const activoOptions: SelectOption[] = [
    { value: "activos", label: "Activos" },
    { value: "inactivos", label: "Inactivos" },
    { value: "todos", label: "Todos" }
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Pagos a operadores
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Files
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManagePagosOperadores
                ? "Liquidaciones, pagos y saldos pendientes de operadores."
                : `Files asignados a ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex h-7 items-center rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc]"
            >
              Mes anterior
            </button>

            <div className="inline-flex h-7 min-w-[116px] items-center justify-center rounded-[10px] bg-[#172033] px-3 text-[11px] font-medium text-white shadow-sm">
              {selectedMonthLabel}
            </div>

            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex h-7 items-center rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc]"
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
              onClick={loadPagosOperadores}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
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
                  {selectedMonthLabel}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                {filters.desde} → {filters.hasta} · Estado pago: {filters.estadoPago} ·
                Operador: {filters.operadorId}
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
                  <FieldLabel>Estado pago</FieldLabel>
                  <NosturSelect
                    value={filters.estadoPago}
                    onChange={(value) =>
                      setFilter("estadoPago", value as typeof filters.estadoPago)
                    }
                    options={ESTADO_PAGO_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Operador</FieldLabel>
                  <NosturSelect
                    value={filters.operadorId}
                    onChange={(value) => setFilter("operadorId", value)}
                    options={operadorOptions}
                  />
                </div>

                {canManagePagosOperadores ? (
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

                <div>
                  <FieldLabel>Activo</FieldLabel>
                  <NosturSelect
                    value={filters.activo}
                    onChange={(value) => setFilter("activo", value as typeof filters.activo)}
                    options={activoOptions}
                  />
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por cliente, teléfono, file, operador, destino..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadPagosOperadores}
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

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <CardMetric label="Files" value={metrics.files} icon={FileText} tone="blue" />
          <CardMetric label="Venta" value={formatMoneyAR(metrics.totalVenta)} icon={Wallet} />
          <CardMetric
            label="Neto operador"
            value={formatMoneyAR(metrics.netoOperador)}
            icon={FileText}
            tone="amber"
          />
          <CardMetric
            label="Utilidad"
            value={formatMoneyAR(metrics.utilidad)}
            icon={CheckCircle2}
            tone="green"
          />
          <CardMetric
            label="Pagado operador"
            value={formatMoneyAR(metrics.pagadoOperador)}
            icon={CheckCircle2}
            tone="green"
          />
          <CardMetric
            label="Saldo operador"
            value={formatMoneyAR(metrics.saldoOperador)}
            icon={AlertTriangle}
            tone="red"
          />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Listado de files</h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${resumen.length} files encontrados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando files...
              </div>
            ) : resumen.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay files para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {resumen.map((item) => {
                  const file = item.file;
                  const selected = selectedResumen?.file.id === file.id;
                  const cliente = file.clientes;

                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => selectFile(file.id)}
                      className={[
                        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition lg:grid-cols-[1.25fr_1.1fr_1fr_1fr_110px_44px]",
                        selected
                          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                          : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {cliente?.nombre_completo || "Sin cliente"}
                        </div>

                        <div className="truncate text-[11px] font-medium text-[#64748b]">
                          File {file.numero_file}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {cliente?.telefono || "—"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {file.operador || "Sin operador"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {file.destino || "Sin destino"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {formatDateAR(file.fecha_in)} →{" "}
                          {file.solo_ida ? "Solo ida" : formatDateAR(file.fecha_out)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatMoneyAR(file.importe_final, file.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">Venta</div>

                        <div className="text-[11px] font-medium text-emerald-700">
                          Utilidad {formatMoneyAR(item.utilidad, file.moneda)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatMoneyAR(file.neto_operador, file.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">
                          Pagado {formatMoneyAR(item.totalPagadoOperador, file.moneda)}
                        </div>

                        <div className="text-[11px] font-medium text-red-600">
                          Saldo {formatMoneyAR(item.saldoOperador, file.moneda)}
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span
                          className={[
                            "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                            getEstadoPagoClassName(item.estadoPago)
                          ].join(" ")}
                        >
                          {item.estadoPago}
                        </span>
                      </div>

                      <div className="flex items-center justify-end">
                        <IconButton
                          icon={Eye}
                          label="Ver y pagar operador"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectFile(file.id);
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            {selectedResumen ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4f7c90] text-[12px] font-semibold text-white">
                      {getInitials(selectedResumen.file.clientes?.nombre_completo || "F")}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                        File {selectedResumen.file.numero_file}
                      </h2>

                      <p className="mt-0.5 truncate text-[11.5px] font-normal text-[#64748b]">
                        {selectedResumen.file.operador || "Sin operador"}
                      </p>
                    </div>
                  </div>

                  <span
                    className={[
                      "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                      getEstadoPagoClassName(selectedResumen.estadoPago)
                    ].join(" ")}
                  >
                    {selectedResumen.estadoPago}
                  </span>
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <div className="mb-2 flex items-center gap-2">
                      <UserRound size={14} className="text-[#4f7c90]" />

                      <span className="truncate font-semibold text-[#172033]">
                        {selectedResumen.file.clientes?.nombre_completo || "Sin cliente"}
                      </span>
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {selectedResumen.file.clientes?.telefono || "—"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {selectedResumen.file.clientes?.email || "Sin email"}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Liquidación</FieldLabel>

                    <div className="flex justify-between gap-3">
                      <span>Venta</span>
                      <strong className="font-semibold">
                        {formatMoneyAR(
                          selectedResumen.file.importe_final,
                          selectedResumen.file.moneda
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Neto operador</span>
                      <strong className="font-semibold">
                        {formatMoneyAR(
                          selectedResumen.file.neto_operador,
                          selectedResumen.file.moneda
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Utilidad</span>
                      <strong className="font-semibold text-emerald-700">
                        {formatMoneyAR(selectedResumen.utilidad, selectedResumen.file.moneda)}
                      </strong>
                    </div>

                    <div className="mt-2 border-t border-black/10 pt-2">
                      <div className="flex justify-between gap-3">
                        <span>Pagado operador</span>
                        <strong className="font-semibold">
                          {formatMoneyAR(
                            selectedResumen.totalPagadoOperador,
                            selectedResumen.file.moneda
                          )}
                        </strong>
                      </div>

                      <div className="flex justify-between gap-3">
                        <span>Saldo operador</span>
                        <strong
                          className={[
                            "font-semibold",
                            selectedResumen.saldoOperador > 0 ? "text-red-600" : "text-emerald-700"
                          ].join(" ")}
                        >
                          {formatMoneyAR(
                            selectedResumen.saldoOperador,
                            selectedResumen.file.moneda
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Viaje</FieldLabel>

                    <div className="font-semibold text-[#172033]">
                      {selectedResumen.file.destino || "Sin destino"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {formatDateAR(selectedResumen.file.fecha_in)} →{" "}
                      {selectedResumen.file.solo_ida
                        ? "Solo ida"
                        : formatDateAR(selectedResumen.file.fecha_out)}
                    </div>

                    <div className="mt-1 font-normal text-[#64748b]">
                      {selectedResumen.file.servicio || "Sin servicio"}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
                      Pagos realizados
                    </h3>

                    <PagosList
                      pagos={selectedResumen.pagos}
                      moneda={selectedResumen.file.moneda}
                    />
                  </div>

                  {selectedResumen.saldoOperador > 0 ? (
                    <PagoOperadorForm
                      file={selectedResumen.file}
                      saldoOperador={selectedResumen.saldoOperador}
                      cajas={catalogos.cajas}
                      saving={saving}
                      onSave={handleSavePago}
                    />
                  ) : (
                    <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-4 text-center text-[12px] font-semibold text-emerald-700">
                      Operador pagado completamente.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná un file para ver la liquidación del operador.
              </div>
            )}
          </aside>
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default PagosOperadoresPanel;