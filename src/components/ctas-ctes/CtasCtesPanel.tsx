// src/components/ctasctes/CtasCtesPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  Copy,
  ExternalLink,
  Eye,
  Filter,
  RefreshCcw,
  Search,
  UserRound,
  Wallet,
  X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  createInitialPagoDraft,
  useCtasCtesStore,
  type CajaLite,
  type CtaCteItem,
  type CtaCtePago,
  type PagoCtaCteDraft
} from "../../store/ctasCtesStore";
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

const ORIGEN_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "CARRITO", label: "Carritos" },
  { value: "FILE", label: "Files" }
];

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" }
];

const METODO_PAGO_OPTIONS: SelectOption[] = [
  { value: "Transferencia bancaria", label: "Transferencia bancaria" },
  { value: "Efectivo", label: "Efectivo" },
  { value: "Tarjeta", label: "Tarjeta" },
  { value: "Mercado Pago", label: "Mercado Pago" },
  { value: "Otro", label: "Otro" }
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

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";

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

function toDisplayDate(value?: string | null): string {
  if (!value) return "";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "";

  return `${day}/${month}/${year}`;
}

function formatDateInputMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);

  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

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

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function getOrigenLabel(origen: string): string {
  if (origen === "CARRITO") return "Carrito";
  if (origen === "FILE") return "File";
  return origen;
}

function getAbacoUrl(numero: string): string {
  return `https://abaco.almundo.com/bo/cart/${numero}`;
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
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const [displayValue, setDisplayValue] = useState(() => toDisplayDate(value));
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(() => createDateFromStorage(value));

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

    onChange(storageValue);
    setVisibleMonth(createDateFromStorage(storageValue));
  }

  function selectDate(date: Date) {
    const storageValue = formatCalendarStorageDate(date);

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

          <div className="absolute right-0 top-[36px] z-[120] w-[252px] rounded-[14px] border border-black/10 bg-white p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                  )
                }
                className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
              >
                ‹
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
                className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
              >
                ›
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-medium text-[#94a3b8]">
              {WEEK_DAYS.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {days.map((date) => {
                const storageDate = formatCalendarStorageDate(date);
                const isCurrentMonth = date.getMonth() === visibleMonth.getMonth();
                const isSelected = storageDate === selectedStorageDate;
                const isToday = storageDate === todayStorageDate;

                return (
                  <button
                    key={storageDate}
                    type="button"
                    onClick={() => selectDate(date)}
                    className={[
                      "flex h-7 items-center justify-center rounded-[9px] text-[11px] font-medium transition",
                      isSelected
                        ? "bg-[#4f7c90] text-white"
                        : isToday
                          ? "bg-[#eef6f7] text-[#4f7c90]"
                          : isCurrentMonth
                            ? "text-[#334155] hover:bg-[#f1f5f9]"
                            : "text-[#cbd5e1] hover:bg-[#f8fafc]"
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

          <div className="absolute left-0 right-0 top-[36px] z-[150] max-h-56 overflow-auto rounded-[14px] border border-black/10 bg-white p-1 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">Sin opciones</div>
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
          aria-label="Cerrar aviso"
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
  icon: LucideIcon;
  tone?: "orange" | "blue" | "green" | "red";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-nostur-orange ring-orange-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100"
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

        <div className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1", toneClass].join(" ")}>
          <Icon size={14} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function OriginBadge({ origen }: { origen: string }) {
  return (
    <span
      className={[
        "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        origen === "CARRITO"
          ? "border-orange-200 bg-orange-50 text-nostur-orange"
          : "border-sky-200 bg-sky-50 text-sky-700"
      ].join(" ")}
    >
      {getOrigenLabel(origen)}
    </span>
  );
}

function PagoModal({
  item,
  saving,
  cajas,
  onClose,
  onSave
}: {
  item: CtaCteItem;
  saving: boolean;
  cajas: CajaLite[];
  onClose: () => void;
  onSave: (draft: PagoCtaCteDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PagoCtaCteDraft>(() => createInitialPagoDraft(item));

  const cajaOptions: SelectOption[] = [
    { value: "", label: "Sin caja" },
    ...cajas.map((caja) => ({
      value: caja.id,
      label: caja.nombre
    }))
  ];

  function setField<K extends keyof PagoCtaCteDraft>(key: K, value: PagoCtaCteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-[#172033]">
              Registrar pago · {item.pasajero || "Sin pasajero"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {getOrigenLabel(item.origen)} · {item.numero_operacion}
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

        <div className="mb-3 grid gap-2 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px] md:grid-cols-3">
          <div>
            <FieldLabel>Total</FieldLabel>
            <div className="font-semibold text-[#172033]">
              {formatMoneyAR(item.importe_total, item.moneda)}
            </div>
          </div>

          <div>
            <FieldLabel>Pagado</FieldLabel>
            <div className="font-semibold text-emerald-700">
              {formatMoneyAR(item.total_pagado, item.moneda)}
            </div>
          </div>

          <div>
            <FieldLabel>Saldo cliente</FieldLabel>
            <div className="font-semibold text-red-700">
              {formatMoneyAR(item.saldo_cta_cte, item.moneda)}
            </div>
          </div>
        </div>

        {item.origen === "CARRITO" ? (
          <div className="mb-3 rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px]">
            <div className="font-semibold text-amber-800">Ingreso a gastos</div>
            <div className="mt-0.5 font-medium text-amber-700">
              {formatDate(item.fecha_ingreso_gastos)}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Fecha de pago</FieldLabel>
            <NosturDateInput
              value={draft.fecha_pago}
              onChange={(value) => setField("fecha_pago", value)}
            />
          </div>

          <div>
            <FieldLabel>Importe del pago</FieldLabel>
            <TextInput
              value={draft.importe}
              onChange={(value) => setField("importe", value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>

          <div>
            <FieldLabel>Método de pago</FieldLabel>
            <NosturSelect
              value={draft.metodo_pago}
              onChange={(value) => setField("metodo_pago", value)}
              options={METODO_PAGO_OPTIONS}
              placeholder="Seleccionar método"
            />
          </div>

          <div>
            <FieldLabel>Caja / banco destino</FieldLabel>
            <NosturSelect
              value={draft.caja_id}
              onChange={(value) => setField("caja_id", value)}
              options={cajaOptions}
              placeholder="Seleccionar caja"
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea
              value={draft.observaciones}
              onChange={(value) => setField("observaciones", value)}
              placeholder="Notas del pago..."
            />
          </div>

          <button
            type="button"
            onClick={() => setField("entrega_efectivo", !draft.entrega_efectivo)}
            className={[
              "flex h-8 items-center justify-center rounded-[10px] border px-3 text-[12px] font-medium transition",
              draft.entrega_efectivo
                ? "border-[#4f7c90]/30 bg-[#eef6f7] text-[#172033]"
                : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
            ].join(" ")}
          >
            {draft.entrega_efectivo ? "✓ Entrega efectivo" : "Entrega efectivo"}
          </button>
        </div>

        <div className="mt-4 flex justify-between gap-2">
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
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-emerald-600 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar pago cliente"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalleModal({
  item,
  pagos,
  onClose
}: {
  item: CtaCteItem;
  pagos: CtaCtePago[];
  onClose: () => void;
}) {
  const textoCliente = [
    `Cliente: ${item.pasajero || "Sin pasajero"}`,
    item.telefono ? `Teléfono: ${item.telefono}` : "",
    item.email ? `Email: ${item.email}` : "",
    `${getOrigenLabel(item.origen)}: ${item.numero_operacion}`,
    item.origen === "CARRITO" ? `Ingreso a gastos: ${formatDate(item.fecha_ingreso_gastos)}` : "",
    `Total: ${formatMoneyAR(item.importe_total, item.moneda)}`,
    `Pagado: ${formatMoneyAR(item.total_pagado, item.moneda)}`,
    `Saldo: ${formatMoneyAR(item.saldo_cta_cte, item.moneda)}`
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-10 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-64px)] w-full max-w-6xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-[#172033]">
              Detalle de cuenta corriente · {item.pasajero || "Sin pasajero"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {getOrigenLabel(item.origen)} · {item.numero_operacion}
            </p>
          </div>

          <div className="flex items-center gap-1.5">
            <IconButton
              icon={Copy}
              label="Copiar resumen"
              onClick={() => navigator.clipboard.writeText(textoCliente)}
            />

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <div className="mb-2.5 flex items-center gap-2">
              <UserRound size={15} className="text-[#4f7c90]" />
              <h3 className="text-[13px] font-semibold text-[#172033]">Información del cliente</h3>
            </div>

            <div className="grid gap-1 text-[12px] font-normal text-[#334155]">
              <div>Nombre: <strong>{item.pasajero || "—"}</strong></div>
              <div>Teléfono: <strong>{item.telefono || "—"}</strong></div>
              <div>Email: <strong>{item.email || "—"}</strong></div>
              <div>Vendedor: <strong>{item.vendedor || "—"}</strong></div>
              <div>Sucursal: <strong>{item.sucursal || "—"}</strong></div>
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <div className="mb-2.5 flex items-center gap-2">
              <CalendarDays size={15} className="text-[#4f7c90]" />
              <h3 className="text-[13px] font-semibold text-[#172033]">Información de la operación</h3>
            </div>

            <div className="grid gap-1 text-[12px] font-normal text-[#334155]">
              <div>
                {getOrigenLabel(item.origen)}: <strong>{item.numero_operacion}</strong>
                {item.origen === "CARRITO" ? (
                  <button
                    type="button"
                    onClick={() => window.open(getAbacoUrl(item.numero_operacion), "_blank")}
                    className="ml-2 text-[#4f7c90] hover:underline"
                  >
                    abrir
                  </button>
                ) : null}
              </div>

              <div>Fecha venta: <strong>{formatDate(item.fecha_venta)}</strong></div>

              {item.origen === "CARRITO" ? (
                <div>
                  Fecha ingreso a gastos:{" "}
                  <strong className="text-amber-700">{formatDate(item.fecha_ingreso_gastos)}</strong>
                </div>
              ) : null}

              <div>Fecha IN: <strong>{formatDate(item.fecha_in)}</strong></div>
              <div>Fecha OUT: <strong>{item.solo_ida ? "Solo ida" : formatDate(item.fecha_out)}</strong></div>
              <div>Servicio: <strong>{item.servicio || "—"}</strong></div>
              <div>Destino: <strong>{item.destino || "—"}</strong></div>
              <div>Forma de pago: <strong>{item.forma_pago || "—"}</strong></div>
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 md:grid-cols-4">
          <div className="rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-center">
            <div className="text-[16px] font-semibold text-sky-800">
              {formatMoneyAR(item.importe_total, item.moneda)}
            </div>
            <div className="text-[11px] font-medium text-sky-700">Importe total</div>
          </div>

          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-center">
            <div className="text-[16px] font-semibold text-emerald-800">
              {formatMoneyAR(item.total_pagado, item.moneda)}
            </div>
            <div className="text-[11px] font-medium text-emerald-700">Pagado por cliente</div>
          </div>

          <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-center">
            <div className="text-[16px] font-semibold text-red-800">
              {formatMoneyAR(item.saldo_cta_cte, item.moneda)}
            </div>
            <div className="text-[11px] font-medium text-red-700">Saldo pendiente</div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-center">
            <div className="text-[16px] font-semibold text-[#172033]">
              {item.cantidad_pagos || pagos.length}
            </div>
            <div className="text-[11px] font-medium text-[#64748b]">Pagos registrados</div>
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-black/10 bg-white">
          <div className="border-b border-black/10 px-3 py-2.5">
            <h3 className="text-[13px] font-semibold text-[#172033]">Historial de pagos</h3>
          </div>

          {pagos.length === 0 ? (
            <div className="p-5 text-center text-[12px] font-normal text-[#64748b]">
              No hay pagos registrados para esta cuenta corriente.
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full min-w-[760px] border-collapse text-left text-[12px]">
                <thead>
                  <tr className="border-b border-black/10 bg-[#f8fafc] text-[10px] uppercase tracking-wide text-[#64748b]">
                    <th className="px-3 py-2 font-medium">Fecha</th>
                    <th className="px-3 py-2 text-right font-medium">Importe</th>
                    <th className="px-3 py-2 font-medium">Método</th>
                    <th className="px-3 py-2 font-medium">Efectivo</th>
                    <th className="px-3 py-2 font-medium">Observaciones</th>
                  </tr>
                </thead>

                <tbody>
                  {pagos.map((pago) => (
                    <tr key={pago.id} className="border-b border-black/5 last:border-0">
                      <td className="px-3 py-2 font-semibold text-[#172033]">
                        {formatDate(pago.fecha_pago)}
                      </td>

                      <td className="px-3 py-2 text-right font-semibold text-emerald-700">
                        {formatMoneyAR(pago.importe, pago.moneda)}
                      </td>

                      <td className="px-3 py-2 font-normal text-[#334155]">{pago.metodo_pago || "—"}</td>
                      <td className="px-3 py-2 font-normal text-[#334155]">{pago.entrega_efectivo ? "Sí" : "No"}</td>
                      <td className="px-3 py-2 font-normal text-[#64748b]">{pago.observaciones || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] border border-black/10 bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export function CtasCtesPanel() {
  const loading = useCtasCtesStore((state) => state.loading);
  const saving = useCtasCtesStore((state) => state.saving);
  const error = useCtasCtesStore((state) => state.error);
  const currentProfile = useCtasCtesStore((state) => state.currentProfile);
  const canManageCtasCtes = useCtasCtesStore((state) => state.canManageCtasCtes);
  const filters = useCtasCtesStore((state) => state.filters);
  const catalogos = useCtasCtesStore((state) => state.catalogos);

  const loadCtasCtes = useCtasCtesStore((state) => state.loadCtasCtes);
  const registrarPago = useCtasCtesStore((state) => state.registrarPago);
  const setFilter = useCtasCtesStore((state) => state.setFilter);
  const clearError = useCtasCtesStore((state) => state.clearError);
  const selectItem = useCtasCtesStore((state) => state.selectItem);

  const getFilteredItems = useCtasCtesStore((state) => state.getFilteredItems);
  const getSelectedItem = useCtasCtesStore((state) => state.getSelectedItem);
  const getPagosForItem = useCtasCtesStore((state) => state.getPagosForItem);
  const getMetrics = useCtasCtesStore((state) => state.getMetrics);

  const items = getFilteredItems();
  const selectedItem = useMemo(() => getSelectedItem(), [items, getSelectedItem]);
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pagoItem, setPagoItem] = useState<CtaCteItem | null>(null);
  const [detalleItem, setDetalleItem] = useState<CtaCteItem | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const pagosDetalle = getPagosForItem(detalleItem);

  useEffect(() => {
    loadCtasCtes();
  }, [loadCtasCtes]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
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

  async function handleSavePago(draft: PagoCtaCteDraft) {
    if (!pagoItem) return;

    const ok = await registrarPago(pagoItem, draft);

    if (ok) {
      setPagoItem(null);
      showToast("Pago registrado correctamente.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">Ctas Ctes</h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Clientes
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManageCtasCtes
                ? "Saldos pendientes de Carritos y Files."
                : `Cuentas corrientes asignadas a ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <button
            type="button"
            onClick={loadCtasCtes}
            disabled={loading}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
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
                  Carritos y Files
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Origen: {filters.origen} · Moneda: {filters.moneda} · Vendedor:{" "}
                {filters.vendedorId} · Sucursal: {filters.sucursalId}
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
              <div
                className={[
                  "mt-3 grid gap-2.5",
                  canManageCtasCtes
                    ? "lg:grid-cols-[180px_180px_220px_220px]"
                    : "lg:grid-cols-[180px_180px]"
                ].join(" ")}
              >
                <div>
                  <FieldLabel>Origen</FieldLabel>

                  <NosturSelect
                    value={filters.origen}
                    onChange={(value) => setFilter("origen", value as typeof filters.origen)}
                    options={ORIGEN_OPTIONS}
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

                {canManageCtasCtes ? (
                  <>
                    <div>
                      <FieldLabel>Vendedor</FieldLabel>

                      <NosturSelect
                        value={filters.vendedorId}
                        onChange={(value) => setFilter("vendedorId", value)}
                        options={vendedorOptions}
                      />
                    </div>

                    <div>
                      <FieldLabel>Sucursal</FieldLabel>

                      <NosturSelect
                        value={filters.sucursalId}
                        onChange={(value) => setFilter("sucursalId", value)}
                        options={sucursalOptions}
                      />
                    </div>
                  </>
                ) : null}
              </div>

              <div className="mt-2.5 flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                <Search size={14} className="shrink-0 text-[#94a3b8]" />

                <input
                  value={filters.search}
                  onChange={(event) => setFilter("search", event.target.value)}
                  placeholder="Buscar por pasajero, teléfono, carrito, file, vendedor, destino..."
                  className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                />
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Cuentas" value={metrics.total} icon={Wallet} />

          <MetricCard
            label="ARS pendiente"
            value={formatMoneyAR(metrics.ars.pendiente, "ARS")}
            icon={CircleDollarSign}
            tone="blue"
          />

          <MetricCard
            label="USD pendiente"
            value={formatMoneyAR(metrics.usd.pendiente, "USD")}
            icon={CircleDollarSign}
            tone="green"
          />

          <MetricCard label="Carritos" value={metrics.carritos} icon={CheckCircle2} />
          <MetricCard label="Files" value={metrics.files} icon={CheckCircle2} />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">
                  Cuentas corrientes pendientes
                </h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${items.length} cuentas encontradas`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando cuentas corrientes...
              </div>
            ) : items.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay cuentas corrientes para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {items.map((item) => {
                  const selected =
                    selectedItem?.origen === item.origen &&
                    selectedItem?.origen_id === item.origen_id;

                  return (
                    <button
                      key={`${item.origen}-${item.origen_id}`}
                      type="button"
                      onClick={() => selectItem(item)}
                      className={[
                        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition lg:grid-cols-[82px_1.15fr_1fr_1fr_1fr_1fr_68px]",
                        selected
                          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                          : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <OriginBadge origen={item.origen} />

                        <div className="mt-1 text-[10.5px] font-normal text-[#64748b]">
                          {item.moneda}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {item.pasajero || "Sin pasajero"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {item.telefono || "Sin teléfono"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#4f7c90]">
                          {item.numero_operacion}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          Venta {formatDate(item.fecha_venta)}
                        </div>

                        {item.origen === "CARRITO" ? (
                          <div className="truncate text-[11px] font-medium text-amber-700">
                            Gastos {formatDate(item.fecha_ingreso_gastos)}
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {item.vendedor || "Sin vendedor"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {item.sucursal || "Sin sucursal"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatMoneyAR(item.importe_total, item.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-emerald-700">
                          Pagado {formatMoneyAR(item.total_pagado, item.moneda)}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-red-700">
                          {formatMoneyAR(item.saldo_cta_cte, item.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">Saldo cliente</div>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={Eye}
                          label="Detalle"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectItem(item);
                            setDetalleItem(item);
                          }}
                        />

                        <IconButton
                          icon={CircleDollarSign}
                          label="Registrar pago"
                          className="text-emerald-700"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectItem(item);
                            setPagoItem(item);
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
            {!selectedItem ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná una cuenta corriente.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4f7c90] text-[12px] font-semibold text-white">
                      {getInitials(selectedItem.pasajero || "C")}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-[13.5px] font-semibold text-[#172033]">
                        {selectedItem.pasajero || "Sin pasajero"}
                      </h2>

                      <p className="truncate text-[11.5px] font-normal text-[#64748b]">
                        {getOrigenLabel(selectedItem.origen)} · {selectedItem.numero_operacion}
                      </p>
                    </div>
                  </div>

                  <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                    Parcial
                  </span>
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Saldo cliente</FieldLabel>

                    <div className="text-[18px] font-semibold text-red-700">
                      {formatMoneyAR(selectedItem.saldo_cta_cte, selectedItem.moneda)}
                    </div>

                    <div className="mt-1 font-normal text-[#64748b]">
                      Total {formatMoneyAR(selectedItem.importe_total, selectedItem.moneda)} ·
                      Pagado {formatMoneyAR(selectedItem.total_pagado, selectedItem.moneda)}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Datos</FieldLabel>

                    <div className="font-semibold text-[#172033]">
                      {selectedItem.vendedor || "Sin vendedor"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {selectedItem.sucursal || "Sin sucursal"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      Venta: {formatDate(selectedItem.fecha_venta)}
                    </div>

                    {selectedItem.origen === "CARRITO" ? (
                      <div className="font-medium text-amber-700">
                        Ingreso a gastos: {formatDate(selectedItem.fecha_ingreso_gastos)}
                      </div>
                    ) : null}

                    <div className="font-normal text-[#64748b]">
                      Destino: {selectedItem.destino || "—"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        selectItem(selectedItem);
                        setPagoItem(selectedItem);
                      }}
                      className="h-8 rounded-[10px] bg-emerald-600 px-3 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-700"
                    >
                      Registrar pago
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        selectItem(selectedItem);
                        setDetalleItem(selectedItem);
                      }}
                      className="h-8 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Ver detalle
                    </button>
                  </div>

                  {selectedItem.origen === "CARRITO" ? (
                    <button
                      type="button"
                      onClick={() => window.open(getAbacoUrl(selectedItem.numero_operacion), "_blank")}
                      className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] border border-[#4f7c90]/20 bg-[#eef6f7] px-3 text-[12px] font-medium text-[#4f7c90] hover:bg-[#4f7c90] hover:text-white"
                    >
                      <ExternalLink size={13} />
                      Abrir carrito en Ábaco
                    </button>
                  ) : null}
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {pagoItem ? (
        <PagoModal
          item={pagoItem}
          saving={saving}
          cajas={catalogos.cajas}
          onClose={() => setPagoItem(null)}
          onSave={handleSavePago}
        />
      ) : null}

      {detalleItem ? (
        <DetalleModal
          item={detalleItem}
          pagos={pagosDetalle}
          onClose={() => setDetalleItem(null)}
        />
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default CtasCtesPanel;