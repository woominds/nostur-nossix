import { useEffect, useMemo, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  ClipboardList,
  Clock3,
  Edit3,
  FileText,
  Filter,
  MoreVertical,
  Phone,
  Plane,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  UsersRound,
  X
} from "lucide-react";
import {
  parseDestinosText,
  serializeDestinosText,
  useContactosStore,
  type Contacto,
  type ContactoInput,
  type Destino
} from "../../store/contactosStore";
import {
  CONTACTO_ESTADOS,
  cleanObservaciones,
  formatDateAR,
  getEstadoClassName,
  getEstadoLabel,
  getInitials,
  getPaxLabel,
  getToday,
  getTravelDateLabel,
  normalizeText
} from "./contactosUtils";
import type { ContactoEstado } from "./contactosUtils";

type ModalMode = "create" | "edit";

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

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

const MINOR_AGE_OPTIONS: SelectOption[] = [
  { value: "Infante 0 a 12 meses", label: "Infante · 0 a 12 meses" },
  ...Array.from({ length: 12 }, (_, index) => {
    const age = index + 1;

    return {
      value: `${age} año${age === 1 ? "" : "s"}`,
      label: `${age} año${age === 1 ? "" : "s"}`
    };
  })
];

const PROXIMA_ACCION_OPTIONS: SelectOption[] = [
  { value: "", label: "Sin próxima acción" },
  { value: "Llamar", label: "Llamar" },
  { value: "Enviar WhatsApp", label: "Enviar WhatsApp" },
  { value: "Enviar presupuesto", label: "Enviar presupuesto" },
  { value: "Recontactar", label: "Recontactar" },
  { value: "Pedir documentación", label: "Pedir documentación" },
  { value: "Confirmar decisión", label: "Confirmar decisión" },
  { value: "Cerrar venta", label: "Cerrar venta" }
];

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

  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

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

function isDateBefore(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;

  return a < b;
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

function parseMinorAges(value?: string | null, count = 0): string[] {
  const parts = String(value || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);

  return Array.from({ length: count }, (_, index) => parts[index] || "");
}

function serializeMinorAges(values: string[]): string {
  return values.filter(Boolean).join(", ");
}

function formatDateTimeAR(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function openInternalModule(moduleId: "presupuestos-v2" | "carritos", contacto: Contacto) {
  const route = `internal://${moduleId}`;

  window.localStorage.setItem(
    "nostur_contacto_handoff",
    JSON.stringify({
      moduleId,
      contactoId: contacto.id,
      contacto,
      createdAt: new Date().toISOString()
    })
  );

  window.dispatchEvent(
    new CustomEvent("nostur:open-internal", {
      detail: {
        moduleId,
        route,
        title: moduleId === "presupuestos-v2" ? "Presupuestos" : "Carritos",
        params: {
          contactoId: contacto.id,
          source: "contactos"
        }
      }
    })
  );
}
function CardMetric({
  label,
  value,
  icon: Icon,
  tone = "orange"
}: {
  label: string;
  value: number;
  icon: typeof UsersRound;
  tone?: "orange" | "red" | "green" | "blue" | "slate";
}) {
  const toneClass = {
    orange: "bg-nostur-orange/15 text-nostur-orange",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    slate: "bg-slate-100 text-slate-600"
  }[tone];

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={["flex h-9 w-9 items-center justify-center rounded-xl", toneClass].join(" ")}>
          <Icon size={17} strokeWidth={1.8} />
        </div>

        <div>
          <div className="text-lg font-black text-[#111827]">{value}</div>
          <div className="text-[11px] font-bold text-[#64748b]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
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
      className="h-9 w-full rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-xs font-semibold text-[#111827] outline-none transition focus:border-nostur-orange"
    />
  );
}

function NosturNumberInput({
  value,
  onChange,
  min = 0
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
}) {
  return (
    <div className="flex h-9 overflow-hidden rounded-xl border border-black/10 bg-[#f8fafc]">
      <button
        type="button"
        onClick={() => onChange(Math.max(min, value - 1))}
        className="w-9 border-r border-black/10 text-sm font-black text-[#64748b] hover:bg-white"
      >
        −
      </button>

      <input
        value={String(value)}
        onChange={(event) => {
          const parsed = Number(event.target.value.replace(/\D/g, ""));
          onChange(Number.isNaN(parsed) ? min : Math.max(min, parsed));
        }}
        inputMode="numeric"
        className="min-w-0 flex-1 bg-transparent px-2 text-center text-xs font-black text-[#111827] outline-none"
      />

      <button
        type="button"
        onClick={() => onChange(value + 1)}
        className="w-9 border-l border-black/10 text-sm font-black text-[#64748b] hover:bg-white"
      >
        +
      </button>
    </div>
  );
}

function NosturDateInput({
  value,
  onChange,
  placeholder = "dd/mm/aaaa",
  min
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
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
    <div className="relative">
      <div className="flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 focus-within:border-nostur-orange">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className="shrink-0 text-[#64748b] hover:text-nostur-orange"
          title="Abrir calendario"
        >
          <CalendarDays size={14} strokeWidth={1.8} />
        </button>

        <input
          value={displayValue}
          onChange={(event) => {
            const masked = formatDateInputMask(event.target.value);
            setDisplayValue(masked);

            if (masked.length === 10) {
              commit(masked);
            }

            if (masked.length === 0) {
              onChange("");
            }
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => commit(displayValue)}
          placeholder={placeholder}
          inputMode="numeric"
          className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8]"
        />
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div className="absolute left-0 top-[42px] z-[80] w-[260px] rounded-2xl border border-black/10 bg-white p-3 shadow-xl">
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1)
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#111827]"
              >
                <ChevronLeft size={15} />
              </button>

              <div className="text-xs font-black text-[#111827]">
                {MONTH_NAMES[visibleMonth.getMonth()]} {visibleMonth.getFullYear()}
              </div>

              <button
                type="button"
                onClick={() =>
                  setVisibleMonth(
                    new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1)
                  )
                }
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#111827]"
              >
                <ChevronRight size={15} />
              </button>
            </div>

            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[10px] font-black text-[#94a3b8]">
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
                const isDisabled = Boolean(min && storageDate < min);

                return (
                  <button
                    key={storageDate}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => selectDate(date)}
                    className={[
                      "flex h-8 items-center justify-center rounded-xl text-[11px] font-black transition",
                      isSelected
                        ? "bg-nostur-orange text-white"
                        : isToday
                          ? "bg-nostur-orange/15 text-nostur-orange"
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

function NosturDateRangePicker({
  startValue,
  endValue,
  onStartChange,
  onEndChange,
  startLabel = "Desde",
  endLabel = "Hasta",
  min,
  disabledEnd = false
}: {
  startValue: string;
  endValue: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  startLabel?: string;
  endLabel?: string;
  min?: string;
  disabledEnd?: boolean;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-2xl border border-nostur-orange/20 bg-white/70 p-2">
      <div>
        <FieldLabel>{startLabel}</FieldLabel>
        <NosturDateInput value={startValue} onChange={onStartChange} min={min} />
      </div>

      {!disabledEnd ? (
        <div>
          <FieldLabel>{endLabel}</FieldLabel>
          <NosturDateInput value={endValue} onChange={onEndChange} min={startValue || min} />
        </div>
      ) : (
        <div>
          <FieldLabel>{endLabel}</FieldLabel>
          <div className="flex h-9 items-center rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-xs font-bold text-[#94a3b8]">
            Solo ida
          </div>
        </div>
      )}
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
  const [search, setSearch] = useState("");
  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(search);

    if (!q) return options;

    return options.filter((option) => normalizeText(option.label).includes(q));
  }, [options, search]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-left text-xs font-semibold text-[#111827] outline-none transition hover:bg-white focus:border-nostur-orange"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={14}
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

          <div className="absolute left-0 right-0 top-[42px] z-50 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
            <div className="mb-2 flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-2">
              <Search size={13} className="text-[#94a3b8]" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
              />
            </div>

            <div className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs font-bold text-[#94a3b8]">Sin opciones</div>
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
                        "flex h-8 w-full items-center rounded-xl px-3 text-left text-xs font-bold transition",
                        active
                          ? "bg-nostur-orange text-white"
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

function DestinosMultiSelect({
  value,
  destinos,
  onChange,
  onCreateDestino
}: {
  value: string[];
  destinos: Destino[];
  onChange: (value: string[]) => void;
  onCreateDestino: (input: { nombre: string; pais?: string | null }) => Promise<Destino | null>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newPais, setNewPais] = useState("Sin especificar");
  const [creating, setCreating] = useState(false);

  const selectedKeys = value.map((item) => normalizeText(item));

  const filteredDestinos = useMemo(() => {
    const q = normalizeText(search);

    return destinos
      .filter((destino) => !selectedKeys.includes(normalizeText(destino.nombre)))
      .filter((destino) => {
        if (!q) return true;

        return normalizeText(`${destino.nombre} ${destino.pais || ""}`).includes(q);
      })
      .slice(0, 80);
  }, [destinos, search, selectedKeys]);

  const canCreate =
    search.trim().length >= 2 &&
    !destinos.some((destino) => normalizeText(destino.nombre) === normalizeText(search));

  async function handleCreate() {
    if (!canCreate || creating) return;

    setCreating(true);

    const created = await onCreateDestino({
      nombre: search.trim(),
      pais: newPais || "Sin especificar"
    });

    setCreating(false);

    if (created) {
      onChange([...value, created.nombre]);
      setSearch("");
      setNewPais("Sin especificar");
      setOpen(false);
    }
  }

  function addDestino(destino: Destino) {
    onChange([...value, destino.nombre]);
    setSearch("");
  }

  function removeDestino(nombre: string) {
    onChange(value.filter((item) => normalizeText(item) !== normalizeText(nombre)));
  }

  return (
    <div className="relative">
      <div className="min-h-9 rounded-xl border border-black/10 bg-[#f8fafc] px-2 py-1.5 focus-within:border-nostur-orange">
        <div className="flex flex-wrap gap-1.5">
          {value.map((destino) => (
            <span
              key={destino}
              className="flex h-7 max-w-full items-center gap-1 rounded-lg bg-nostur-orange/15 px-2 text-[11px] font-black text-[#111827]"
            >
              <span className="truncate">{destino}</span>

              <button
                type="button"
                onClick={() => removeDestino(destino)}
                className="text-[#64748b] hover:text-red-600"
              >
                <X size={12} />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex h-7 min-w-[130px] flex-1 items-center gap-2 rounded-lg px-2 text-left text-[11px] font-semibold text-[#64748b] hover:bg-white"
          >
            <Search size={13} />
            {value.length ? "Agregar destino" : "Buscar destino"}
          </button>
        </div>
      </div>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div className="absolute left-0 right-0 top-[44px] z-50 rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
            <div className="mb-2 flex h-9 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-2">
              <Search size={14} className="text-[#94a3b8]" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Escribí 2 o 3 letras..."
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
              />
            </div>

            <div className="max-h-56 overflow-auto">
              {filteredDestinos.map((destino) => (
                <button
                  key={destino.id}
                  type="button"
                  onClick={() => addDestino(destino)}
                  className="flex h-9 w-full items-center justify-between gap-2 rounded-xl px-3 text-left text-xs font-bold text-[#334155] hover:bg-[#f1f5f9]"
                >
                  <span className="truncate">{destino.nombre}</span>

                  <span className="shrink-0 text-[10px] font-black text-[#94a3b8]">
                    {destino.pais || "Sin especificar"}
                    {destino.veces_usado_total ? ` · ${destino.veces_usado_total}` : ""}
                  </span>
                </button>
              ))}

              {filteredDestinos.length === 0 ? (
                <div className="px-3 py-2 text-xs font-bold text-[#94a3b8]">
                  No encontramos ese destino.
                </div>
              ) : null}
            </div>

            {canCreate ? (
              <div className="mt-2 rounded-2xl border border-nostur-orange/20 bg-nostur-orange/5 p-2">
                <div className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                  Crear destino nuevo
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <div className="flex h-9 items-center rounded-xl bg-white px-3 text-xs font-black text-[#111827]">
                    {search.trim()}
                  </div>

                  <input
                    value={newPais}
                    onChange={(event) => setNewPais(event.target.value)}
                    placeholder="País"
                    className="h-9 rounded-xl border border-black/10 bg-white px-3 text-xs font-semibold outline-none focus:border-nostur-orange"
                  />

                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="h-9 rounded-xl bg-nostur-orange px-3 text-xs font-black text-white hover:bg-nostur-orangeSoft disabled:opacity-50"
                  >
                    {creating ? "Creando..." : "Crear"}
                  </button>
                </div>
              </div>
            ) : null}
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
        "flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition",
        checked
          ? "border-nostur-orange/40 bg-nostur-orange/20 text-[#111827]"
          : "border-black/10 bg-white/70 text-[#64748b]"
      ].join(" ")}
    >
      {checked ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {label}
    </button>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  return (
    <div className="fixed right-5 top-5 z-[260] w-[320px] rounded-2xl border border-black/10 bg-white p-4 text-xs shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={[
              "mb-1 font-black",
              toast.type === "success" ? "text-green-700" : "text-red-700"
            ].join(" ")}
          >
            {toast.type === "success" ? "Operación exitosa" : "Atención"}
          </div>

          <div className="font-semibold text-[#334155]">{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#111827]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function RecontactoBadge({ contacto }: { contacto: Contacto }) {
  if (!contacto.requiere_recontacto) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-red-700">
      <AlertTriangle size={11} />
      Recontactar
    </span>
  );
}

function ContactoModal({
  mode,
  contacto,
  onClose,
  onSaved
}: {
  mode: ModalMode;
  contacto?: Contacto | null;
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const saving = useContactosStore((state) => state.saving);
  const saveContacto = useContactosStore((state) => state.saveContacto);
  const createDestino = useContactosStore((state) => state.createDestino);
  const canManageContactos = useContactosStore((state) => state.canManageContactos);
  const currentProfile = useContactosStore((state) => state.currentProfile);
  const sucursales = useContactosStore((state) => state.sucursales);
  const vendedores = useContactosStore((state) => state.vendedores);
  const metodosContacto = useContactosStore((state) => state.metodosContacto);
  const destinos = useContactosStore((state) => state.destinos);

  const [selectedDestinos, setSelectedDestinos] = useState<string[]>(() =>
    parseDestinosText(contacto?.destinos)
  );

  const [form, setForm] = useState<ContactoInput>(() => ({
    id: contacto?.id,
    nombre_completo: contacto?.nombre_completo || "",
    telefono: contacto?.telefono || "",
    origen: contacto?.origen || "",
    destinos: contacto?.destinos || "",
    adultos: contacto?.adultos ?? 1,
    menores: contacto?.menores ?? 0,
    edad_menores: contacto?.edad_menores || "",
    fecha_viaje: contacto?.fecha_viaje || "",
    fecha_viaje_out: contacto?.fecha_viaje_out || "",
    solo_ida: contacto?.solo_ida ?? false,
    observaciones: cleanObservaciones(contacto?.observaciones),
    estado: contacto?.estado || "NUEVO",
    activo: contacto?.activo ?? true,
    vendedor_id: contacto?.vendedor_id || currentProfile?.id || "",
    sucursal_id: contacto?.sucursal_id || currentProfile?.sucursal_id || "",
    proxima_accion: contacto?.proxima_accion || "",
    proxima_accion_fecha: contacto?.proxima_accion_fecha || ""
  }));

  const minorAges = parseMinorAges(form.edad_menores, form.menores ?? 0);

  function setField<K extends keyof ContactoInput>(key: K, value: ContactoInput[K]) {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const destinosText = serializeDestinosText(selectedDestinos);

    const ok = await saveContacto({
      ...form,
      destinos: destinosText
    });

    if (ok) {
      onSaved(mode === "create" ? "Contacto creado correctamente." : "Contacto actualizado correctamente.");
      onClose();
    }
  }

  const today = getToday();

  const estadoOptions: SelectOption[] = CONTACTO_ESTADOS.map((estado) => ({
    value: estado.value,
    label: estado.label
  }));

  const vendedorOptions: SelectOption[] = vendedores.map((vendedor) => ({
    value: vendedor.id,
    label: `${vendedor.nombre} ${vendedor.apellido}`.trim()
  }));

  const sucursalOptions: SelectOption[] = [
    { value: "", label: "Sin sucursal" },
    ...sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  const origenOptions: SelectOption[] = metodosContacto.map((metodo) => ({
    value: metodo.nombre,
    label: metodo.nombre
  }));

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/25 px-4 pt-16 backdrop-blur-sm">
      <form
        onSubmit={handleSubmit}
        className="max-h-[calc(100vh-96px)] w-full max-w-5xl overflow-auto rounded-[24px] border border-black/10 bg-white p-5 text-[#1f2937] shadow-2xl"
      >
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-black text-[#111827]">
              {mode === "create" ? "Nuevo contacto" : "Editar contacto"}
            </h2>

            <p className="text-xs text-[#64748b]">
              CRM básico de leads, oportunidades comerciales, próximas acciones y recontactos.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-[#64748b] hover:bg-black/5 hover:text-[#111827]"
          >
            <X size={17} />
          </button>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[#475569]">
              Datos del contacto
            </h3>

            <div className="grid gap-3">
              <div>
                <FieldLabel>Nombre completo *</FieldLabel>
                <TextInput
                  value={form.nombre_completo}
                  onChange={(value) => setField("nombre_completo", value)}
                  placeholder="Ej: Jorge Batica"
                />
              </div>

              <div>
                <FieldLabel>Teléfono *</FieldLabel>
                <TextInput
                  value={form.telefono}
                  onChange={(value) => setField("telefono", value)}
                  placeholder="Ej: 1133950050"
                  inputMode="tel"
                />
              </div>

              <div>
                <FieldLabel>Origen</FieldLabel>
                <NosturSelect
                  value={form.origen || ""}
                  onChange={(value) => setField("origen", value)}
                  options={origenOptions}
                  placeholder="Buscar origen"
                />
              </div>

              <div>
                <FieldLabel>Destino / destinos</FieldLabel>
                <DestinosMultiSelect
                  value={selectedDestinos}
                  destinos={destinos}
                  onChange={setSelectedDestinos}
                  onCreateDestino={createDestino}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Adultos</FieldLabel>
                  <NosturNumberInput
                    value={form.adultos ?? 1}
                    min={1}
                    onChange={(value) => setField("adultos", value)}
                  />
                </div>

                <div>
                  <FieldLabel>Menores</FieldLabel>
                  <NosturNumberInput
                    value={form.menores ?? 0}
                    min={0}
                    onChange={(value) => {
                      setField("menores", value);
                      setField(
                        "edad_menores",
                        serializeMinorAges(parseMinorAges(form.edad_menores, value))
                      );
                    }}
                  />
                </div>
              </div>

              {(form.menores ?? 0) > 0 ? (
                <div>
                  <FieldLabel>Edad menores</FieldLabel>

                  <div className="grid gap-2">
                    {minorAges.map((minorAge, index) => (
                      <NosturSelect
                        key={`minor-age-${index}`}
                        value={minorAge}
                        onChange={(value) => {
                          const nextMinorAges = [...minorAges];
                          nextMinorAges[index] = value;
                          setField("edad_menores", serializeMinorAges(nextMinorAges));
                        }}
                        options={MINOR_AGE_OPTIONS}
                        placeholder={`Menor ${index + 1}`}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4">
            <h3 className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-[#475569]">
              Viaje y gestión
            </h3>

            <div className="grid gap-3">
              <NosturDateRangePicker
                startLabel="Fecha IN"
                endLabel="Fecha OUT"
                min={mode === "create" ? today : undefined}
                startValue={form.fecha_viaje || ""}
                endValue={form.fecha_viaje_out || ""}
                disabledEnd={Boolean(form.solo_ida)}
                onStartChange={(value) => {
                  setField("fecha_viaje", value);

                  if (form.fecha_viaje_out && value && isDateBefore(form.fecha_viaje_out, value)) {
                    setField("fecha_viaje_out", value);
                  }
                }}
                onEndChange={(value) => setField("fecha_viaje_out", value)}
              />

              <BooleanChip
                checked={Boolean(form.solo_ida)}
                onChange={(value) => {
                  setField("solo_ida", value);

                  if (value) {
                    setField("fecha_viaje_out", null);
                  }
                }}
                label="Solo ida"
              />

              <div>
                <FieldLabel>Estado</FieldLabel>
                <NosturSelect
                  value={String(form.estado || "NUEVO")}
                  onChange={(value) => setField("estado", value)}
                  options={estadoOptions}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <FieldLabel>Próxima acción</FieldLabel>
                  <NosturSelect
                    value={form.proxima_accion || ""}
                    onChange={(value) => setField("proxima_accion", value || null)}
                    options={PROXIMA_ACCION_OPTIONS}
                    placeholder="Seleccionar acción"
                  />
                </div>

                <div>
                  <FieldLabel>Fecha próxima acción</FieldLabel>
                  <NosturDateInput
                    value={form.proxima_accion_fecha || ""}
                    onChange={(value) => setField("proxima_accion_fecha", value || null)}
                    min={today}
                  />
                </div>
              </div>

              {canManageContactos ? (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <FieldLabel>Vendedor</FieldLabel>
                    <NosturSelect
                      value={form.vendedor_id || ""}
                      onChange={(value) => setField("vendedor_id", value || null)}
                      options={vendedorOptions}
                    />
                  </div>

                  <div>
                    <FieldLabel>Sucursal</FieldLabel>
                    <NosturSelect
                      value={form.sucursal_id || ""}
                      onChange={(value) => setField("sucursal_id", value || null)}
                      options={sucursalOptions}
                    />
                  </div>
                </div>
              ) : null}

              <div>
                <FieldLabel>Observaciones</FieldLabel>

                <textarea
                  value={form.observaciones || ""}
                  onChange={(event) => setField("observaciones", event.target.value)}
                  placeholder="Preferencias, fechas flexibles, presupuesto estimado..."
                  className="min-h-[118px] w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-xs font-semibold text-[#111827] outline-none transition focus:border-nostur-orange"
                />
              </div>

              <BooleanChip
                checked={form.activo ?? true}
                onChange={(value) => setField("activo", value)}
                label="Contacto activo"
              />
            </div>
          </section>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-9 rounded-xl px-4 text-xs font-bold text-[#64748b] hover:bg-black/5 hover:text-[#111827]"
          >
            Cancelar
          </button>

          <button
            type="submit"
            disabled={saving || !form.nombre_completo.trim() || !form.telefono.trim()}
            className="h-9 rounded-xl bg-nostur-orange px-5 text-xs font-black text-white shadow-sm hover:bg-nostur-orangeSoft disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar contacto"}
          </button>
        </div>
      </form>
    </div>
  );
}

export function ContactosPanel() {
  const loading = useContactosStore((state) => state.loading);
  const saving = useContactosStore((state) => state.saving);
  const error = useContactosStore((state) => state.error);
  const currentProfile = useContactosStore((state) => state.currentProfile);
  const canManageContactos = useContactosStore((state) => state.canManageContactos);

  const filters = useContactosStore((state) => state.filters);
  const vendedores = useContactosStore((state) => state.vendedores);
  const metodosContacto = useContactosStore((state) => state.metodosContacto);
  const destinos = useContactosStore((state) => state.destinos);

  const loadContactos = useContactosStore((state) => state.loadContactos);
  const setFilter = useContactosStore((state) => state.setFilter);
  const clearError = useContactosStore((state) => state.clearError);
  const selectContacto = useContactosStore((state) => state.selectContacto);
  const selectedContactoId = useContactosStore((state) => state.selectedContactoId);
  const updateContactoEstado = useContactosStore((state) => state.updateContactoEstado);
  const toggleContactoActivo = useContactosStore((state) => state.toggleContactoActivo);

  const getFilteredContactos = useContactosStore((state) => state.getFilteredContactos);
  const getMetrics = useContactosStore((state) => state.getMetrics);

  const contactos = getFilteredContactos();
  const metrics = getMetrics();

  const contactosRecontacto = contactos.filter((contacto) => Boolean(contacto.requiere_recontacto)).length;

  const [modalMode, setModalMode] = useState<ModalMode | null>(null);
  const [modalContacto, setModalContacto] = useState<Contacto | null>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const selectedContacto = useMemo(
    () => contactos.find((contacto) => contacto.id === selectedContactoId) || contactos[0] || null,
    [contactos, selectedContactoId]
  );

  useEffect(() => {
    loadContactos();
  }, [loadContactos]);

  function openCreateModal() {
    setModalContacto(null);
    setModalMode("create");
  }

  function openEditModal(contacto: Contacto) {
    setModalContacto(contacto);
    setModalMode("edit");
  }

  function closeModal() {
    setModalMode(null);
    setModalContacto(null);
  }

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function handleOpenPresupuesto(contacto: Contacto) {
    openInternalModule("presupuestos-v2", contacto);
    showToast("Abriendo presupuesto con los datos del contacto.");
  }

  function handleOpenCarrito(contacto: Contacto) {
    openInternalModule("carritos", contacto);
    showToast("Abriendo carrito con los datos del contacto.");
  }


  const estadoFilterOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...CONTACTO_ESTADOS.map((estado) => ({
      value: estado.value,
      label: estado.label
    }))
  ];

  const origenFilterOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...metodosContacto.map((metodo) => ({
      value: metodo.nombre,
      label: metodo.nombre
    }))
  ];

  const destinoFilterOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...destinos.map((destino) => ({
      value: destino.nombre,
      label: destino.pais ? `${destino.nombre} · ${destino.pais}` : destino.nombre
    }))
  ];

  const vendedorFilterOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...vendedores.map((vendedor) => ({
      value: vendedor.id,
      label: `${vendedor.nombre} ${vendedor.apellido}`.trim()
    }))
  ];

  const activoFilterOptions: SelectOption[] = [
    { value: "activos", label: "Activos" },
    { value: "inactivos", label: "Inactivos" },
    { value: "todos", label: "Todos" }
  ];

  return (
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_22%_10%,rgba(255,122,26,0.10),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(90,120,190,0.13),transparent_30%),linear-gradient(135deg,#eef1f6,#e1e7f0_48%,#eef1f6)] px-6 py-5 text-[#1f2937]">
      <div className="mx-auto w-full max-w-[calc(100vw-110px)]">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-black tracking-tight text-[#111827]">Contactos</h1>

          <span className="rounded-xl bg-white/80 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#64748b]">
            CRM
          </span>

          <span className="text-xs font-semibold text-[#64748b]">
            {canManageContactos
              ? "Leads y oportunidades"
              : `Contactos asignados a ${currentProfile?.nombre || "tu usuario"}`}
          </span>
        </div>

        {error ? (
          <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
            <span>{error}</span>

            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="relative z-[30] mb-4 rounded-[24px] border border-black/10 bg-white/55 p-3 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Filter size={15} className="text-nostur-orange" />

                <h2 className="text-[11px] font-black uppercase tracking-[0.16em] text-[#475569]">
                  Filtros
                </h2>

                <span className="text-[11px] font-semibold text-nostur-orange">
                  Período obligatorio
                </span>
              </div>

              <div className="mt-1 truncate text-[11px] font-semibold text-[#64748b]">
                {filters.desde} → {filters.hasta} · Estado:{" "}
                {filters.estado === "todos" ? "Todos" : filters.estado} · Origen:{" "}
                {filters.origen === "todos" ? "Todos" : filters.origen}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={loadContactos}
                disabled={loading}
                className="flex h-8 items-center gap-2 rounded-xl bg-white/80 px-3 text-[11px] font-black text-[#334155] shadow-sm hover:bg-white disabled:opacity-50"
              >
                <RefreshCcw size={13} strokeWidth={1.8} />
                Actualizar
              </button>

              <button
                type="button"
                onClick={openCreateModal}
                className="flex h-8 items-center gap-2 rounded-xl bg-nostur-orange px-3 text-[11px] font-black text-white shadow-sm hover:bg-nostur-orangeSoft"
              >
                <Plus size={13} strokeWidth={1.8} />
                Nuevo contacto
              </button>

              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="flex h-8 items-center gap-2 rounded-xl bg-white/80 px-3 text-[11px] font-black text-[#334155] shadow-sm hover:bg-white"
              >
                {filtersOpen ? "Ocultar" : "Mostrar"}
                <ChevronsUpDown size={14} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <>
              <div className="mt-4 grid gap-3 lg:grid-cols-[1.1fr_1fr_1fr_1fr_1fr_1fr]">
                <NosturDateRangePicker
                  startValue={filters.desde}
                  endValue={filters.hasta}
                  onStartChange={(value) => setFilter("desde", value)}
                  onEndChange={(value) => setFilter("hasta", value)}
                />

                <div>
                  <FieldLabel>Estado</FieldLabel>
                  <NosturSelect
                    value={filters.estado}
                    onChange={(value) => setFilter("estado", value)}
                    options={estadoFilterOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Origen</FieldLabel>
                  <NosturSelect
                    value={filters.origen}
                    onChange={(value) => setFilter("origen", value)}
                    options={origenFilterOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Destino</FieldLabel>
                  <NosturSelect
                    value={filters.destino || "todos"}
                    onChange={(value) => setFilter("destino", value === "todos" ? "" : value)}
                    options={destinoFilterOptions}
                    placeholder="Buscar destino"
                  />
                </div>

                {canManageContactos ? (
                  <div>
                    <FieldLabel>Vendedor</FieldLabel>
                    <NosturSelect
                      value={filters.vendedorId}
                      onChange={(value) => setFilter("vendedorId", value)}
                      options={vendedorFilterOptions}
                    />
                  </div>
                ) : null}

                <div>
                  <FieldLabel>Activo</FieldLabel>
                  <NosturSelect
                    value={filters.activo}
                    onChange={(value) => setFilter("activo", value as typeof filters.activo)}
                    options={activoFilterOptions}
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-10 items-center gap-2 rounded-2xl border border-black/10 bg-white/80 px-3">
                  <Search size={15} className="shrink-0 text-[#64748b]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por nombre, teléfono, destino u observación..."
                    className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadContactos}
                  className="h-10 rounded-2xl bg-white/80 px-4 text-xs font-black text-[#334155] shadow-sm hover:bg-white"
                >
                  Aplicar filtros
                </button>

                <button
                  type="button"
                  className="h-10 rounded-2xl bg-white/80 px-4 text-xs font-black text-[#334155] shadow-sm hover:bg-white"
                  title="La exportación se agrega en la próxima etapa."
                >
                  Exportar Excel
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-4 grid gap-3 md:grid-cols-3 xl:grid-cols-7">
          <CardMetric label="Nuevos" value={metrics.nuevos} icon={UsersRound} />
          <CardMetric label="Contactados" value={metrics.contactados} icon={Phone} tone="blue" />
          <CardMetric label="Cotizados" value={metrics.cotizados} icon={FileText} tone="slate" />
          <CardMetric label="Seguimiento" value={metrics.seguimiento} icon={CalendarDays} tone="orange" />
          <CardMetric label="Recontacto" value={contactosRecontacto} icon={AlertTriangle} tone="red" />
          <CardMetric label="Vendidos" value={metrics.vendidos} icon={CheckCircle2} tone="green" />
          <CardMetric label="Rechazados" value={metrics.rechazados} icon={X} tone="slate" />
        </section>

        <div className="relative z-0 grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <section className="min-w-0 rounded-[24px] border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-black text-[#111827]">Listado de contactos</h2>

                <p className="text-[11px] text-[#64748b]">
                  {loading ? "Cargando..." : `${contactos.length} contactos encontrados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-5 text-center text-xs text-[#64748b]">
                Cargando contactos...
              </div>
            ) : contactos.length === 0 ? (
              <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-5 text-center text-xs text-[#64748b]">
                No hay contactos para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-2">
                {contactos.map((contacto) => {
                  const selected = selectedContacto?.id === contacto.id;

                  return (
                    <button
                      key={contacto.id}
                      onClick={() => selectContacto(contacto.id)}
                      className={[
                        "grid min-w-0 gap-3 rounded-2xl border p-3 text-left transition lg:grid-cols-[1.35fr_1.25fr_1.35fr_120px_135px]",
                        selected
                          ? "border-nostur-orange/50 bg-nostur-orange/10"
                          : contacto.requiere_recontacto
                            ? "border-red-200 bg-red-50/70 hover:bg-red-50"
                            : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-nostur-orange text-xs font-black text-white">
                          {getInitials(contacto.nombre_completo)}
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-xs font-black text-[#111827]">
                            {contacto.nombre_completo}
                          </div>

                          <div className="truncate text-[11px] font-semibold text-[#64748b]">
                            {contacto.telefono}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold text-[#111827]">
                          {contacto.origen || "Sin origen"}
                        </div>

                        <div className="truncate text-[11px] text-[#64748b]">
                          {contacto.vendedor || "Sin vendedor"}
                        </div>

                        <div className="mt-1">
                          <RecontactoBadge contacto={contacto} />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-xs font-black text-[#111827]">
                          {contacto.destinos || "Sin destino"}
                        </div>

                        <div className="truncate text-[11px] text-[#64748b]">
                          {getPaxLabel(contacto.adultos, contacto.menores)}
                        </div>

                        <div className="truncate text-[11px] text-[#64748b]">
                          {getTravelDateLabel(contacto)}
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span
                          className={[
                            "rounded-xl border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
                            getEstadoClassName(contacto.estado)
                          ].join(" ")}
                        >
                          {getEstadoLabel(contacto.estado)}
                        </span>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            openEditModal(contacto);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#111827]"
                          title="Editar"
                        >
                          <Edit3 size={14} />
                        </span>

                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenPresupuesto(contacto);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#111827]"
                          title="Crear presupuesto"
                        >
                          <ClipboardList size={14} />
                        </span>

                        <span
                          onClick={(event) => {
                            event.stopPropagation();
                            handleOpenCarrito(contacto);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#111827]"
                          title="Crear carrito"
                        >
                          <ShoppingCart size={14} />
                        </span>
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg text-[#64748b] hover:bg-white hover:text-[#111827]">
                          <MoreVertical size={14} />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[24px] border border-black/10 bg-white/80 p-4 shadow-sm backdrop-blur">
            {selectedContacto ? (
              <>
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-nostur-orange text-sm font-black text-white">
                      {getInitials(selectedContacto.nombre_completo)}
                    </div>

                    <div>
                      <h2 className="text-sm font-black text-[#111827]">
                        {selectedContacto.nombre_completo}
                      </h2>

                      <p className="text-xs text-[#64748b]">{selectedContacto.telefono}</p>

                      <div className="mt-1">
                        <RecontactoBadge contacto={selectedContacto} />
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => openEditModal(selectedContacto)}
                    className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-black/5 hover:text-[#111827]"
                  >
                    <Edit3 size={15} />
                  </button>
                </div>

                <div className="grid gap-4 text-xs">
                  <div>
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                      Información del viaje
                    </h3>

                    <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <Plane size={14} className="text-nostur-orange" />

                        <span className="font-black text-[#111827]">
                          {selectedContacto.destinos || "Sin destino"}
                        </span>
                      </div>

                      <div className="text-[#64748b]">
                        {getPaxLabel(selectedContacto.adultos, selectedContacto.menores)}
                      </div>

                      <div className="text-[#64748b]">{getTravelDateLabel(selectedContacto)}</div>

                      {selectedContacto.menores ? (
                        <div className="mt-1 text-[#64748b]">
                          Edad menores: {selectedContacto.edad_menores || "—"}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div>
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                      Gestión CRM
                    </h3>

                    <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3">
                      <div className="mb-2">
                        Origen: <strong>{selectedContacto.origen || "—"}</strong>
                      </div>

                      <div className="mb-2">
                        Vendedor: <strong>{selectedContacto.vendedor || "—"}</strong>
                      </div>

                      <div className="mb-2">
                        Alta: <strong>{formatDateAR(selectedContacto.created_at)}</strong>
                      </div>

                      <div className="mb-2">
                        Última gestión:{" "}
                        <strong>{formatDateTimeAR(selectedContacto.ultima_gestion_at)}</strong>
                      </div>

                      <div className="mb-2">
                        Próxima acción:{" "}
                        <strong>{selectedContacto.proxima_accion || "—"}</strong>
                      </div>

                      <div className="mb-3">
                        Fecha próxima acción:{" "}
                        <strong>{toDisplayDate(selectedContacto.proxima_accion_fecha) || "—"}</strong>
                      </div>

                      <FieldLabel>Estado</FieldLabel>

                      <NosturSelect
                        value={selectedContacto.estado || "NUEVO"}
                        onChange={(value) =>
                          updateContactoEstado(selectedContacto, value as ContactoEstado)
                        }
                        options={CONTACTO_ESTADOS.map((estado) => ({
                          value: estado.value,
                          label: estado.label
                        }))}
                      />

                      <div className="mt-3">
                        <BooleanChip
                          checked={Boolean(selectedContacto.activo)}
                          onChange={() => toggleContactoActivo(selectedContacto)}
                          label={selectedContacto.activo ? "Activo" : "Inactivo"}
                        />
                      </div>
                    </div>
                  </div>

                  {selectedContacto.requiere_recontacto ? (
                    <div className="rounded-2xl border border-red-200 bg-red-50 p-3">
                      <div className="mb-1 flex items-center gap-2 text-xs font-black text-red-700">
                        <Clock3 size={14} />
                        Requiere recontacto
                      </div>

                      <div className="text-[11px] font-semibold leading-5 text-red-700">
                        Pasaron más de 48 horas sin una gestión registrada. Al editar, cambiar estado o guardar el contacto, se reinicia el contador.
                      </div>
                    </div>
                  ) : null}

                  <div>
                    <h3 className="mb-2 text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
                      Observaciones
                    </h3>

                    <div className="min-h-[90px] whitespace-pre-wrap rounded-2xl border border-black/10 bg-[#f8fafc] p-3 text-[#334155]">
                      {cleanObservaciones(selectedContacto.observaciones) || "Sin observaciones"}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => openEditModal(selectedContacto)}
                      className="h-10 rounded-xl border border-black/10 bg-white text-xs font-black text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Editar
                    </button>

                    <button
                      onClick={() => handleOpenPresupuesto(selectedContacto)}
                      className="h-10 rounded-xl border border-black/10 bg-white text-xs font-black text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Presupuesto
                    </button>

                    <button
                      onClick={() => handleOpenCarrito(selectedContacto)}
                      className="h-10 rounded-xl border border-black/10 bg-white text-xs font-black text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Carrito
                    </button>

                    <button
                      onClick={() => toggleContactoActivo(selectedContacto)}
                      disabled={saving}
                      className="h-10 rounded-xl border border-red-200 bg-red-50 text-xs font-black text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {selectedContacto.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-5 text-center text-xs text-[#64748b]">
                Seleccioná un contacto para ver el detalle.
              </div>
            )}
          </aside>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />

      {modalMode ? (
        <ContactoModal
          mode={modalMode}
          contacto={modalContacto}
          onClose={closeModal}
          onSaved={(message) => showToast(message)}
        />
      ) : null}
    </div>
  );
}