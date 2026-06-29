// src/components/carritos/CarritosPanel.tsx

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Eye,
  FileText,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  ShoppingCart,
  ToggleLeft,
  ToggleRight,
  UserRound,
  X
} from "lucide-react";
import {
  useCarritosStore,
  type Carrito,
  type CarritoWizardInput,
  type Cliente,
  type MovimientoTesoreria,
  type PagoComercial,
  type ProfileLite
} from "../../store/carritosStore";
import { NosturDateInput } from "../ui/NosturDateInput";
import { formatMoneyAR } from "../../lib/formatters";

type SelectOption = {
  value: string;
  label: string;
};

type WizardStep = 1 | 2 | 3 | 4 | 5;

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type WizardDraft = {
  phonePrefix: string;
  phoneLocal: string;
  cliente: {
    id?: string;
    nombre_completo: string;
    telefono: string;
    email: string;
    origen: string;
    vendedor_id: string;
    sucursal_id: string;
  };
  venta: {
    numero_carrito: string;
    fecha_venta: string;
    fecha_in: string;
    fecha_out: string;
    solo_ida: boolean;
    servicio_id: string;
    servicio: string;
    destinos: string[];
    importe_bruto: string;
    moneda: string;
    promocode_aplicado: boolean;
    promocode_importe: string;
    observaciones: string;
  };
  pagosComerciales: PagoComercial[];
  pagoParcial: boolean;
  fechaIngresoGastos: string;
  movimientosTesoreria: MovimientoTesoreria[];
  riesgo: boolean;
  importe_riesgo: string;
  riesgo_motivo: string;
  confirmado: boolean;
};

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "CARGADO", label: "Cargado" },
  { value: "EN_CONTROL", label: "En control" },
  { value: "CONTROLADO", label: "Controlado" },
  { value: "FACTURADO", label: "Facturado" },
  { value: "COBRADO", label: "Cobrado" },
  { value: "CANCELADO", label: "Cancelado" },
  { value: "CTA_CTE", label: "Cta Cte" }
];

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

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

function formatDateAR(value?: string | null): string {
  if (!value) return "—";
  return toDisplayDate(value) || "—";
}

function formatMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");

  const labels: Record<string, string> = {
    "01": "Enero",
    "02": "Febrero",
    "03": "Marzo",
    "04": "Abril",
    "05": "Mayo",
    "06": "Junio",
    "07": "Julio",
    "08": "Agosto",
    "09": "Septiembre",
    "10": "Octubre",
    "11": "Noviembre",
    "12": "Diciembre"
  };

  return `${labels[monthNumber] || monthNumber} ${year}`;
}

function isDateBefore(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a < b;
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

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function maskCarrito(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function isValidCarrito(value: string): boolean {
  return /^\d{3}-\d{3}-\d{3}$/.test(value);
}

function createInitialDraft(): WizardDraft {
  return {
    phonePrefix: "+549",
    phoneLocal: "",
    cliente: {
      nombre_completo: "",
      telefono: "+549",
      email: "",
      origen: "",
      vendedor_id: "",
      sucursal_id: ""
    },
    venta: {
      numero_carrito: "",
      fecha_venta: getToday(),
      fecha_in: getToday(),
      fecha_out: getToday(),
      solo_ida: false,
      servicio_id: "",
      servicio: "",
      destinos: [],
      importe_bruto: "",
      moneda: "ARS",
      promocode_aplicado: false,
      promocode_importe: "",
      observaciones: ""
    },
    pagosComerciales: [
      {
        importe: 0,
        moneda: "ARS",
        forma_pago_id: null,
        forma_pago: ""
      }
    ],
    pagoParcial: false,
    fechaIngresoGastos: "",
    movimientosTesoreria: [
      {
        importe: 0,
        moneda: "ARS",
        forma_pago_id: null,
        forma_pago: "",
        caja_id: null,
        caja: "",
        fecha_movimiento: getToday()
      }
    ],
    riesgo: false,
    importe_riesgo: "",
    riesgo_motivo: "",
    confirmado: false
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

          <div className="absolute left-0 right-0 top-[36px] z-[150] rounded-[14px] border border-black/10 bg-white p-2 shadow-xl">
            <div className="mb-2 flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-[#f8fafc] px-2">
              <Search size={13} className="text-[#94a3b8]" />

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal outline-none placeholder:text-[#94a3b8]"
              />
            </div>

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

function DestinosMultiSelect({
  values,
  onChange,
  options,
  onCreate
}: {
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  onCreate: (name: string, pais?: string) => Promise<string | null>;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [pais, setPais] = useState("Sin especificar");
  const [creating, setCreating] = useState(false);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(query);

    return options
      .filter((option) => {
        const alreadySelected = values.some(
          (value) => normalizeText(value) === normalizeText(option.value)
        );

        if (alreadySelected) return false;
        if (!q) return true;

        return normalizeText(`${option.label} ${option.value}`).includes(q);
      })
      .slice(0, 80);
  }, [options, query, values]);

  function addValue(value: string) {
    const cleanValue = value.trim();

    if (!cleanValue) return;

    const exists = values.some((item) => normalizeText(item) === normalizeText(cleanValue));

    if (exists) {
      setQuery("");
      return;
    }

    onChange([...values, cleanValue]);
    setQuery("");
  }

  function removeValue(value: string) {
    onChange(values.filter((item) => normalizeText(item) !== normalizeText(value)));
  }

  async function handleCreate() {
    const cleanName = query.trim();

    if (!cleanName || creating) return;

    setCreating(true);
    const createdName = await onCreate(cleanName, pais || "Sin especificar");
    setCreating(false);

    if (createdName) {
      addValue(createdName);
      setPais("Sin especificar");
      setOpen(false);
    }
  }

  const canCreate =
    query.trim().length >= 2 &&
    !options.some((option) => normalizeText(option.value) === normalizeText(query)) &&
    !values.some((value) => normalizeText(value) === normalizeText(query));

  return (
    <div className={["relative", open ? "z-[140]" : "z-0"].join(" ")}>
      <div className="min-h-8 rounded-[10px] border border-black/10 bg-white px-2 py-1 focus-within:border-[#4f7c90]">
        <div className="flex flex-wrap items-center gap-1">
          {values.map((value) => (
            <span
              key={value}
              className="flex h-6 items-center gap-1 rounded-md bg-[#eef6f7] px-1.5 text-[11px] font-medium text-[#334155]"
            >
              <span className="truncate">{value}</span>

              <button
                type="button"
                onClick={() => removeValue(value)}
                className="flex h-4 w-4 items-center justify-center rounded-full text-[#64748b] hover:bg-white hover:text-red-600"
              >
                <X size={10} />
              </button>
            </span>
          ))}

          <input
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            placeholder={values.length === 0 ? "Buscar o crear destinos" : "Agregar destino"}
            className="h-6 min-w-[170px] flex-1 bg-transparent px-1 text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
          />

          <button
            type="button"
            onClick={() => setOpen((current) => !current)}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] text-[#64748b] hover:bg-[#f8fafc]"
          >
            <ChevronDown
              size={13}
              strokeWidth={1.8}
              className={["transition", open ? "rotate-180" : ""].join(" ")}
            />
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
            aria-label="Cerrar destinos"
          />

          <div className="absolute left-0 right-0 top-[36px] z-[150] rounded-[14px] border border-black/10 bg-white p-2 shadow-xl">
            <div className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                  No encontramos ese destino.
                </div>
              ) : (
                filteredOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      addValue(option.value);
                      setOpen(false);
                    }}
                    className="flex h-8 w-full items-center rounded-[10px] px-3 text-left text-[12px] font-medium text-[#334155] transition hover:bg-[#f1f5f9]"
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                ))
              )}
            </div>

            {canCreate ? (
              <div className="mt-2 rounded-[14px] border border-[#4f7c90]/20 bg-[#eef6f7] p-2.5">
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
                  Crear destino nuevo
                </div>

                <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
                  <div className="flex h-8 items-center rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#172033]">
                    {query.trim()}
                  </div>

                  <input
                    value={pais}
                    onChange={(event) => setPais(event.target.value)}
                    placeholder="País"
                    className="h-8 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal outline-none focus:border-[#4f7c90]"
                  />

                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={creating}
                    className="h-8 rounded-[10px] bg-[#4f7c90] px-3 text-[12px] font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
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
        "flex h-8 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-medium transition",
        checked
          ? "border-[#4f7c90]/30 bg-[#eef6f7] text-[#172033]"
          : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      {checked ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
      {label}
    </button>
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

        <div
          className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1", toneClass].join(
            " "
          )}
        >
          <Icon size={14} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function SellerBadge({
  vendedorId,
  vendedorNombre,
  vendedores
}: {
  vendedorId?: string | null;
  vendedorNombre?: string | null;
  vendedores: ProfileLite[];
}) {
  const vendedor = vendedores.find((item) => item.id === vendedorId);

  const label = vendedor
    ? `${vendedor.nombre || ""} ${vendedor.apellido || ""}`.trim()
    : vendedorNombre || "Sin vendedor";

  const color = vendedor?.color || "#64748b";

  return (
    <span
      className="inline-flex max-w-full items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[10px] font-medium"
      style={{
        borderColor: `${color}33`,
        backgroundColor: `${color}14`,
        color
      }}
      title={label}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} />

      <span className="truncate">{label}</span>
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

function WizardError({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
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

function LineButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-8 rounded-[10px] border border-black/10 bg-white px-3 text-[11.5px] font-medium text-[#334155] hover:bg-[#f8fafc]"
    >
      {children}
    </button>
  );
}

function WizardStepper({ step }: { step: WizardStep }) {
  const steps = ["Cliente", "Venta Ábaco", "Pagos comerciales", "Tesorería", "Confirmar"];

  return (
    <div className="mb-3 grid grid-cols-5 gap-1.5">
      {steps.map((label, index) => {
        const number = index + 1;
        const active = step === number;
        const done = step > number;

        return (
          <div
            key={label}
            className={[
              "rounded-[12px] border px-2 py-1.5 text-center text-[11px] font-medium",
              active
                ? "border-[#4f7c90] bg-[#4f7c90] text-white"
                : done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-black/10 bg-[#f8fafc] text-[#64748b]"
            ].join(" ")}
          >
            {number}. {label}
          </div>
        );
      })}
    </div>
  );
}

function WizardSummary({
  draft,
  totalFinal,
  totalComercial,
  totalTesoreria,
  saldo
}: {
  draft: WizardDraft;
  totalFinal: number;
  totalComercial: number;
  totalTesoreria: number;
  saldo: number;
}) {
  return (
    <aside className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
      <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Resumen rápido</h3>

      <div className="grid gap-3 text-[12px]">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
            Cliente
          </div>

          <div className="truncate font-semibold text-[#172033]">
            {draft.cliente.nombre_completo || "Sin cliente"}
          </div>

          <div className="truncate font-normal text-[#64748b]">{draft.cliente.telefono || "—"}</div>
        </div>

        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
            Carrito
          </div>

          <div className="font-semibold text-[#172033]">{draft.venta.numero_carrito || "—"}</div>

          <div className="font-normal text-[#64748b]">
            {draft.venta.destinos.length > 0 ? draft.venta.destinos.join(", ") : "Sin destinos"}
          </div>
        </div>

        <div className="rounded-[14px] border border-black/10 bg-white p-3">
          <div className="flex justify-between gap-3">
            <span className="text-[#64748b]">Final</span>
            <strong className="font-semibold">{formatMoneyAR(totalFinal, draft.venta.moneda)}</strong>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#64748b]">Comercial</span>
            <strong className="font-semibold">
              {formatMoneyAR(totalComercial, draft.venta.moneda)}
            </strong>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#64748b]">Tesorería</span>
            <strong className="font-semibold">
              {formatMoneyAR(totalTesoreria, draft.venta.moneda)}
            </strong>
          </div>

          <div className="mt-1 flex justify-between gap-3 border-t border-black/10 pt-1">
            <span className="text-[#64748b]">Saldo pasajero</span>

            <strong className={saldo > 0 ? "font-semibold text-red-600" : "font-semibold text-emerald-700"}>
              {formatMoneyAR(saldo, draft.venta.moneda)}
            </strong>
          </div>
        </div>

        <div
          className={[
            "rounded-[12px] border p-2.5 text-center text-[11.5px] font-medium",
            saldo > 0
              ? "border-amber-200 bg-amber-50 text-amber-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          ].join(" ")}
        >
          {saldo > 0 ? "Va a Cta Cte" : "Queda en Carritos"}
        </div>

        {draft.riesgo ? (
          <div className="rounded-[12px] border border-red-200 bg-red-50 p-2.5 text-center text-[11.5px] font-medium text-red-700">
            Riesgo Almundo marcado
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function CarritoWizard({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: (message: string) => void;
}) {
  const saving = useCarritosStore((state) => state.saving);
  const clientesSearch = useCarritosStore((state) => state.clientesSearch);
  const catalogos = useCarritosStore((state) => state.catalogos);
  const currentProfile = useCarritosStore((state) => state.currentProfile);
  const canManageCarritos = useCarritosStore((state) => state.canManageCarritos);
  const searchClientesByPhone = useCarritosStore((state) => state.searchClientesByPhone);
  const createDestinoInline = useCarritosStore((state) => state.createDestinoInline);
  const saveCarritoWizard = useCarritosStore((state) => state.saveCarritoWizard);

  const [step, setStep] = useState<WizardStep>(1);
  const [wizardError, setWizardError] = useState<string | null>(null);

  const [draft, setDraft] = useState<WizardDraft>(() => {
    const initial = createInitialDraft();

    initial.cliente.vendedor_id = currentProfile?.id || "";
    initial.cliente.sucursal_id = currentProfile?.sucursal_id || "";
    initial.venta.moneda = "ARS";
    initial.pagosComerciales[0].moneda = "ARS";
    initial.movimientosTesoreria[0].moneda = "ARS";
    initial.movimientosTesoreria[0].fecha_movimiento = initial.venta.fecha_venta;

    return initial;
  });

  const bruto = parseMoney(draft.venta.importe_bruto);
  const promocode = draft.venta.promocode_aplicado ? parseMoney(draft.venta.promocode_importe) : 0;
  const totalFinal = Math.max(0, bruto - promocode);

  const totalPagosComerciales = draft.pagosComerciales.reduce(
    (total, pago) => total + parseMoney(pago.importe),
    0
  );

  const importeRiesgo = draft.riesgo ? parseMoney(draft.importe_riesgo) : 0;
  const totalComercial = totalPagosComerciales + importeRiesgo;

  const totalTesoreria = draft.movimientosTesoreria.reduce(
    (total, movimiento) => total + parseMoney(movimiento.importe),
    0
  );

  const saldo = Math.max(0, totalFinal - totalTesoreria);
  const saldoComercial = Math.max(0, totalFinal - totalComercial);
  const visibleEnCarritos = saldo <= 0.009;

  function setCliente<K extends keyof WizardDraft["cliente"]>(
    key: K,
    value: WizardDraft["cliente"][K]
  ) {
    setWizardError(null);

    setDraft((current) => ({
      ...current,
      cliente: {
        ...current.cliente,
        [key]: value
      }
    }));
  }

  function setVenta<K extends keyof WizardDraft["venta"]>(
    key: K,
    value: WizardDraft["venta"][K]
  ) {
    setWizardError(null);

    setDraft((current) => {
      const nextVenta = {
        ...current.venta,
        [key]: value
      };

      return {
        ...current,
        venta: nextVenta,
        movimientosTesoreria:
          key === "fecha_venta"
            ? current.movimientosTesoreria.map((movimiento) => ({
                ...movimiento,
                fecha_movimiento: String(value || nextVenta.fecha_venta || getToday())
              }))
            : current.movimientosTesoreria
      };
    });
  }

  function setPhone(prefix: string, local: string) {
    setWizardError(null);

    const cleanPrefix = prefix.startsWith("+") ? prefix : `+${prefix}`;
    const cleanLocal = local.replace(/\D/g, "");

    setDraft((current) => ({
      ...current,
      phonePrefix: cleanPrefix,
      phoneLocal: cleanLocal,
      cliente: {
        ...current.cliente,
        telefono: `${cleanPrefix}${cleanLocal}`
      }
    }));

    if (cleanLocal.length >= 3) {
      searchClientesByPhone(`${cleanPrefix}${cleanLocal}`);
    }
  }

  function selectCliente(cliente: Cliente) {
    setWizardError(null);

    const prefix = cliente.telefono.startsWith("+549") ? "+549" : draft.phonePrefix;
    const local = cliente.telefono.replace(prefix, "").replace("+549", "").replace(/\D/g, "");

    setDraft((current) => ({
      ...current,
      phonePrefix: prefix,
      phoneLocal: local,
      cliente: {
        id: cliente.id,
        nombre_completo: cliente.nombre_completo,
        telefono: cliente.telefono,
        email: cliente.email || "",
        origen: cliente.origen || "",
        vendedor_id: cliente.vendedor_id || currentProfile?.id || "",
        sucursal_id: cliente.sucursal_id || currentProfile?.sucursal_id || ""
      }
    }));
  }

  function updatePago(index: number, patch: Partial<PagoComercial>) {
    setWizardError(null);

    setDraft((current) => ({
      ...current,
      pagosComerciales: current.pagosComerciales.map((pago, itemIndex) =>
        itemIndex === index ? { ...pago, ...patch } : pago
      )
    }));
  }

  function updateMovimiento(index: number, patch: Partial<MovimientoTesoreria>) {
    setWizardError(null);

    setDraft((current) => ({
      ...current,
      movimientosTesoreria: current.movimientosTesoreria.map((movimiento, itemIndex) =>
        itemIndex === index ? { ...movimiento, ...patch } : movimiento
      )
    }));
  }

  function validateStep(currentStep: WizardStep): string | null {
    if (currentStep === 1) {
      if (!draft.cliente.telefono.trim() || draft.phoneLocal.length < 3) {
        return "Ingresá un teléfono válido.";
      }

      if (!draft.cliente.id && !draft.cliente.nombre_completo.trim()) {
        return "Ingresá el nombre completo del cliente.";
      }
    }

    if (currentStep === 2) {
      if (!isValidCarrito(draft.venta.numero_carrito)) {
        return "El número de carrito debe tener formato 000-000-000.";
      }

      if (!draft.venta.fecha_in) return "Seleccioná fecha IN.";

      if (!draft.venta.solo_ida && !draft.venta.fecha_out) {
        return "Seleccioná fecha OUT.";
      }

      if (!draft.venta.solo_ida && isDateBefore(draft.venta.fecha_out, draft.venta.fecha_in)) {
        return "La fecha OUT no puede ser anterior a la fecha IN.";
      }

      if (!draft.venta.servicio.trim()) return "Seleccioná o cargá el servicio.";

      if (draft.venta.destinos.length === 0) {
        return "Seleccioná o cargá al menos un destino.";
      }

      if (totalFinal <= 0) return "El importe final debe ser mayor a cero.";
    }

    if (currentStep === 3) {
      const pagosConImporte = draft.pagosComerciales.filter((pago) => parseMoney(pago.importe) > 0);

      if (pagosConImporte.some((pago) => !pago.forma_pago_id)) {
        return "Completá la forma de pago comercial en todas las líneas con importe.";
      }

      if (draft.riesgo) {
        if (importeRiesgo <= 0) return "Indicá el importe imputado a riesgo Almundo.";
        if (!draft.riesgo_motivo.trim()) return "Indicá el motivo u observación del riesgo Almundo.";
      }

      if (totalComercial <= 0) {
        return "Completá al menos un pago comercial o un importe imputado a riesgo Almundo.";
      }

      if (totalComercial > totalFinal + 0.009) {
        return "La imputación comercial no puede superar el total del cliente.";
      }

      if (!draft.pagoParcial && Math.abs(totalComercial - totalFinal) > 0.009) {
        return "La imputación comercial debe igualar el total del cliente. Si queda saldo del pasajero, marcá pago parcial.";
      }

      if (draft.pagoParcial && totalComercial >= totalFinal) {
        return "Si marcás pago parcial, la imputación comercial debe ser menor al total cliente.";
      }

      if (draft.pagoParcial && !draft.fechaIngresoGastos) {
        return "Completá la fecha de ingreso a gastos para enviar el saldo a cuenta corriente.";
      }
    }

    if (currentStep === 4) {
      if (
        draft.movimientosTesoreria.some(
          (movimiento) =>
            parseMoney(movimiento.importe) <= 0 ||
            !movimiento.caja_id ||
            !movimiento.forma_pago_id
        )
      ) {
        return "Completá caja, forma real de pago e importe en todas las líneas de tesorería.";
      }

      if (totalTesoreria <= 0) return "Cargá el ingreso real del cliente en Tesorería.";

      if (totalTesoreria > totalFinal + 0.009) {
        return "Tesorería no puede superar el total cliente.";
      }

      if (!draft.pagoParcial && Math.abs(totalTesoreria - totalFinal) > 0.009) {
        return "Si no es pago parcial, Tesorería debe igualar el total cliente.";
      }

      if (draft.pagoParcial && totalTesoreria >= totalFinal) {
        return "Si marcás pago parcial, Tesorería debe ser menor al total cliente.";
      }
    }

    if (currentStep === 5) {
      if (!draft.confirmado) return "Confirmá que los datos son correctos.";
    }

    return null;
  }

  async function nextStep() {
    const error = validateStep(step);

    if (error) {
      setWizardError(error);
      return;
    }

    setWizardError(null);
    setStep((current) => Math.min(5, current + 1) as WizardStep);
  }

  async function submit() {
    const error = validateStep(5);

    if (error) {
      setWizardError(error);
      return;
    }

    setWizardError(null);

    const destinoTexto = draft.venta.destinos.join(", ");

    const movimientosTesoreria = draft.movimientosTesoreria
      .filter((movimiento) => parseMoney(movimiento.importe) > 0)
      .map((movimiento) => ({
        ...movimiento,
        fecha_movimiento: movimiento.fecha_movimiento || draft.venta.fecha_venta || getToday()
      }));

    const payload: CarritoWizardInput = {
      cliente: {
        id: draft.cliente.id,
        nombre_completo: draft.cliente.nombre_completo,
        telefono: draft.cliente.telefono,
        email: draft.cliente.email,
        origen: draft.cliente.origen,
        vendedor_id: draft.cliente.vendedor_id || currentProfile?.id || null,
        sucursal_id: draft.cliente.sucursal_id || currentProfile?.sucursal_id || null
      },
      carrito: {
        numero_carrito: draft.venta.numero_carrito,
        fecha_venta: draft.venta.fecha_venta,
        servicio_id: draft.venta.servicio_id || null,
        servicio: draft.venta.servicio,
        metodo_contacto: draft.cliente.origen,
        destino: destinoTexto,
        fecha_in: draft.venta.fecha_in,
        fecha_out: draft.venta.solo_ida ? null : draft.venta.fecha_out,
        solo_ida: draft.venta.solo_ida,
        importe_bruto: bruto,
        moneda: draft.venta.moneda,
        promocode_aplicado: draft.venta.promocode_aplicado,
        promocode_importe: promocode,
        importe_final: totalFinal,
        pago_parcial: draft.pagoParcial,
        fecha_ingreso_gastos: draft.pagoParcial ? draft.fechaIngresoGastos : null,
        total_pagado: totalTesoreria,
        saldo_cta_cte: saldo,
        visible_en_carritos: visibleEnCarritos,
        riesgo: draft.riesgo,
        importe_riesgo: importeRiesgo,
        riesgo_motivo: draft.riesgo_motivo,
        confirmado_vendedor: draft.confirmado,
        observaciones: draft.venta.observaciones,
        vendedor_id: draft.cliente.vendedor_id || currentProfile?.id || null,
        sucursal_id: draft.cliente.sucursal_id || currentProfile?.sucursal_id || null
      },
      pagosComerciales: draft.pagosComerciales.filter((pago) => parseMoney(pago.importe) > 0),
      movimientosTesoreria
    };

    const ok = await saveCarritoWizard(payload);

    if (ok) {
      onSaved(
        visibleEnCarritos ? "Carrito cargado correctamente." : "Venta creada y enviada a Cta Cte."
      );
      onClose();
    }
  }

  const metodoOptions: SelectOption[] = catalogos.metodosContacto.map((item) => ({
    value: item.nombre,
    label: item.nombre
  }));

  const servicioOptions: SelectOption[] = catalogos.servicios.map((item) => ({
    value: item.nombre,
    label: item.nombre
  }));

  const destinoOptions: SelectOption[] = catalogos.destinos.map((item) => ({
    value: item.nombre,
    label: item.pais ? `${item.nombre} · ${item.pais}` : item.nombre
  }));

  const formaPagoOptions: SelectOption[] = catalogos.formasPago.map((item) => ({
    value: item.id,
    label: item.nombre
  }));

  const cajaOptions: SelectOption[] = catalogos.cajas.map((item) => ({
    value: item.id,
    label: item.moneda ? `${item.nombre} · ${item.moneda}` : item.nombre
  }));

  const vendedorOptions: SelectOption[] = catalogos.vendedores.map((item) => ({
    value: item.id,
    label: `${item.nombre} ${item.apellido}`.trim()
  }));

  const sucursalOptions: SelectOption[] = catalogos.sucursales.map((item) => ({
    value: item.id,
    label: item.nombre
  }));

  return createPortal(
    <div className="pointer-events-none fixed bottom-0 right-0 top-[39px] z-[180] flex justify-end">
      <aside className="pointer-events-auto h-full w-full max-w-[720px] overflow-hidden border-l border-black/10 bg-[#edf3f7] text-[#172033] shadow-2xl">
        <div className="flex h-full min-h-0 flex-col">
          <div className="shrink-0 border-b border-black/10 bg-white/85 px-4 py-3 backdrop-blur-xl">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-[17px] font-semibold text-[#172033]">
                  Nuevo carrito
                </h2>

                <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
                  Cliente → Venta Ábaco → Pagos → Tesorería → Confirmar
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
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-4">
            <WizardStepper step={step} />
            <WizardError message={wizardError} onClose={() => setWizardError(null)} />

            <div className="grid gap-3">
              <main className="rounded-[16px] border border-black/10 bg-white p-3">
                {step === 1 ? (
                  <section>
                    <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">
                      Paso 1 · Cliente
                    </h3>

                    <div className="grid gap-3 lg:grid-cols-[110px_1fr]">
                      <div>
                        <FieldLabel>Prefijo</FieldLabel>

                        <TextInput
                          value={draft.phonePrefix}
                          onChange={(value) => setPhone(value, draft.phoneLocal)}
                          placeholder="+549"
                        />
                      </div>

                      <div>
                        <FieldLabel>Teléfono</FieldLabel>

                        <TextInput
                          value={draft.phoneLocal}
                          onChange={(value) => setPhone(draft.phonePrefix, value)}
                          placeholder="3516892764"
                          inputMode="tel"
                        />
                      </div>
                    </div>

                    {clientesSearch.length > 0 ? (
                      <div className="mt-3">
                        <FieldLabel>Clientes encontrados</FieldLabel>

                        <div className="grid gap-1.5">
                          {clientesSearch.map((cliente) => (
                            <button
                              key={cliente.id}
                              type="button"
                              onClick={() => selectCliente(cliente)}
                              className={[
                                "rounded-[12px] border px-3 py-2 text-left transition",
                                draft.cliente.id === cliente.id
                                  ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                                  : "border-black/10 bg-[#f8fafc] hover:bg-white"
                              ].join(" ")}
                            >
                              <div className="text-[12px] font-semibold text-[#172033]">
                                {cliente.nombre_completo}
                              </div>

                              <div className="text-[11.5px] font-normal text-[#64748b]">
                                {cliente.telefono} · {cliente.email || "sin email"}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Nombre completo *</FieldLabel>

                        <TextInput
                          value={draft.cliente.nombre_completo}
                          onChange={(value) => setCliente("nombre_completo", value)}
                          placeholder="Nombre y apellido"
                        />
                      </div>

                      <div>
                        <FieldLabel>Email</FieldLabel>

                        <TextInput
                          value={draft.cliente.email}
                          onChange={(value) => setCliente("email", value)}
                          placeholder="cliente@email.com"
                          inputMode="email"
                        />
                      </div>

                      <div>
                        <FieldLabel>Método de contacto</FieldLabel>

                        <NosturSelect
                          value={draft.cliente.origen}
                          onChange={(value) => setCliente("origen", value)}
                          options={metodoOptions}
                          placeholder="Buscar origen"
                        />
                      </div>

                      {canManageCarritos ? (
                        <>
                          <div>
                            <FieldLabel>Vendedor</FieldLabel>

                            <NosturSelect
                              value={draft.cliente.vendedor_id}
                              onChange={(value) => setCliente("vendedor_id", value)}
                              options={vendedorOptions}
                              placeholder="Buscar vendedor"
                            />
                          </div>

                          <div>
                            <FieldLabel>Sucursal</FieldLabel>

                            <NosturSelect
                              value={draft.cliente.sucursal_id}
                              onChange={(value) => setCliente("sucursal_id", value)}
                              options={sucursalOptions}
                              placeholder="Buscar sucursal"
                            />
                          </div>
                        </>
                      ) : null}
                    </div>
                  </section>
                ) : null}

                {step === 2 ? (
                  <section>
                    <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">
                      Paso 2 · Venta Ábaco
                    </h3>

                    <div className="grid gap-3 md:grid-cols-2">
                      <div>
                        <FieldLabel>Número carrito *</FieldLabel>

                        <TextInput
                          value={draft.venta.numero_carrito}
                          onChange={(value) => setVenta("numero_carrito", maskCarrito(value))}
                          placeholder="210-485-162"
                          inputMode="numeric"
                        />
                      </div>

                      <div>
                        <FieldLabel>Fecha venta</FieldLabel>

                        <NosturDateInput
                          value={draft.venta.fecha_venta}
                          onChange={(value) => setVenta("fecha_venta", value)}
                        />
                      </div>

                      <div>
                        <FieldLabel>Fecha IN</FieldLabel>

                        <NosturDateInput
                          value={draft.venta.fecha_in}
                          onChange={(value) => {
                            setVenta("fecha_in", value);

                            if (
                              draft.venta.fecha_out &&
                              value &&
                              isDateBefore(draft.venta.fecha_out, value)
                            ) {
                              setVenta("fecha_out", value);
                            }
                          }}
                          min={getToday()}
                        />
                      </div>

                      <div>
                        <FieldLabel>Fecha OUT</FieldLabel>

                        {draft.venta.solo_ida ? (
                          <div className="flex h-8 items-center rounded-[10px] border border-black/10 bg-[#f8fafc] px-3 text-[12px] font-normal text-[#94a3b8]">
                            Solo ida
                          </div>
                        ) : (
                          <NosturDateInput
                            value={draft.venta.fecha_out}
                            onChange={(value) => setVenta("fecha_out", value)}
                            min={draft.venta.fecha_in || getToday()}
                          />
                        )}
                      </div>

                      <div className="md:col-span-2">
                        <BooleanChip
                          checked={draft.venta.solo_ida}
                          onChange={(value) => {
                            setVenta("solo_ida", value);
                            if (value) setVenta("fecha_out", "");
                          }}
                          label="Solo ida"
                        />
                      </div>

                      <div>
                        <FieldLabel>Tipo de servicio</FieldLabel>

                        <NosturSelect
                          value={draft.venta.servicio}
                          onChange={(value) => setVenta("servicio", value)}
                          options={servicioOptions}
                          placeholder="Buscar servicio"
                        />
                      </div>

                      <div>
                        <FieldLabel>Destinos</FieldLabel>

                        <DestinosMultiSelect
                          values={draft.venta.destinos}
                          onChange={(values) => setVenta("destinos", values)}
                          options={destinoOptions}
                          onCreate={createDestinoInline}
                        />
                      </div>

                      <div>
                        <FieldLabel>Importe bruto</FieldLabel>

                        <TextInput
                          value={draft.venta.importe_bruto}
                          onChange={(value) => setVenta("importe_bruto", value)}
                          placeholder="61.148,00"
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <FieldLabel>Moneda</FieldLabel>

                        <NosturSelect
                          value={draft.venta.moneda}
                          onChange={(value) => {
                            setVenta("moneda", value);

                            setDraft((current) => ({
                              ...current,
                              pagosComerciales: current.pagosComerciales.map((pago) => ({
                                ...pago,
                                moneda: value
                              })),
                              movimientosTesoreria: current.movimientosTesoreria.map(
                                (movimiento) => ({
                                  ...movimiento,
                                  moneda: value
                                })
                              )
                            }));
                          }}
                          options={MONEDA_OPTIONS}
                        />
                      </div>

                      <div>
                        <BooleanChip
                          checked={draft.venta.promocode_aplicado}
                          onChange={(value) => setVenta("promocode_aplicado", value)}
                          label="Tiene promocode"
                        />
                      </div>

                      {draft.venta.promocode_aplicado ? (
                        <div>
                          <FieldLabel>Importe promocode</FieldLabel>

                          <TextInput
                            value={draft.venta.promocode_importe}
                            onChange={(value) => setVenta("promocode_importe", value)}
                            placeholder="0,00"
                            inputMode="decimal"
                          />
                        </div>
                      ) : null}

                      <div className="md:col-span-2">
                        <FieldLabel>Observaciones</FieldLabel>

                        <TextArea
                          value={draft.venta.observaciones}
                          onChange={(value) => setVenta("observaciones", value)}
                          placeholder="Notas comerciales o de control..."
                        />
                      </div>
                    </div>

                    <div className="mt-3 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]">
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Importe bruto</span>
                        <strong className="font-semibold">
                          {formatMoneyAR(bruto, draft.venta.moneda)}
                        </strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Promocode</span>
                        <strong className="font-semibold">
                          {formatMoneyAR(promocode, draft.venta.moneda)}
                        </strong>
                      </div>

                      <div className="mt-2 flex justify-between border-t border-black/10 pt-2">
                        <span className="font-semibold text-[#172033]">Total cliente</span>

                        <strong className="font-semibold text-[#172033]">
                          {formatMoneyAR(totalFinal, draft.venta.moneda)}
                        </strong>
                      </div>
                    </div>
                  </section>
                ) : null}

                {step === 3 ? (
                  <section>
                    <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">
                      Paso 3 · Pagos comerciales
                    </h3>

                    <div className="mb-3 rounded-[14px] border border-black/10 bg-[#f8fafc] px-3 py-2 text-[12px] font-medium text-[#334155]">
                      Total cliente: {formatMoneyAR(totalFinal, draft.venta.moneda)}
                    </div>

                    <div className="grid gap-2">
                      {draft.pagosComerciales.map((pago, index) => (
                        <div
                          key={`pago-comercial-${index}`}
                          className="grid gap-2 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 md:grid-cols-[1fr_110px_1fr_auto]"
                        >
                          <div>
                            <FieldLabel>Importe</FieldLabel>

                            <TextInput
                              value={pago.importe ? String(pago.importe).replace(".", ",") : ""}
                              onChange={(value) => updatePago(index, { importe: parseMoney(value) })}
                              placeholder="0,00"
                              inputMode="decimal"
                            />
                          </div>

                          <div>
                            <FieldLabel>Moneda</FieldLabel>

                            <NosturSelect
                              value={pago.moneda || draft.venta.moneda}
                              onChange={(value) => updatePago(index, { moneda: value })}
                              options={MONEDA_OPTIONS}
                            />
                          </div>

                          <div>
                            <FieldLabel>Forma pago</FieldLabel>

                            <NosturSelect
                              value={pago.forma_pago_id || ""}
                              onChange={(value) => {
                                const forma = catalogos.formasPago.find((item) => item.id === value);

                                updatePago(index, {
                                  forma_pago_id: forma?.id || null,
                                  forma_pago: forma?.nombre || null
                                });
                              }}
                              options={formaPagoOptions}
                              placeholder="Buscar forma"
                            />
                          </div>

                          <div className="flex items-end">
                            <LineButton
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  pagosComerciales:
                                    current.pagosComerciales.length > 1
                                      ? current.pagosComerciales.filter(
                                          (_, itemIndex) => itemIndex !== index
                                        )
                                      : [
                                          {
                                            importe: 0,
                                            moneda: current.venta.moneda,
                                            forma_pago_id: null,
                                            forma_pago: ""
                                          }
                                        ]
                                }))
                              }
                            >
                              Eliminar
                            </LineButton>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <LineButton
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            pagosComerciales: [
                              ...current.pagosComerciales,
                              {
                                importe: 0,
                                moneda: current.venta.moneda,
                                forma_pago_id: null,
                                forma_pago: ""
                              }
                            ]
                          }))
                        }
                      >
                        + Agregar pago comercial
                      </LineButton>

                      <BooleanChip
                        checked={draft.pagoParcial}
                        onChange={(value) => {
                          setWizardError(null);
                          setDraft((current) => ({
                            ...current,
                            pagoParcial: value,
                            fechaIngresoGastos: value ? current.fechaIngresoGastos || getToday() : ""
                          }));
                        }}
                        label="Pago parcial / Cta Cte"
                      />

                      {draft.pagoParcial ? (
                        <div className="w-full rounded-[14px] border border-amber-200 bg-amber-50 p-3 md:max-w-[320px]">
                          <FieldLabel>Fecha ingreso a gastos *</FieldLabel>

                          <NosturDateInput
                            value={draft.fechaIngresoGastos}
                            onChange={(value) => {
                              setWizardError(null);
                              setDraft((current) => ({
                                ...current,
                                fechaIngresoGastos: value
                              }));
                            }}
                          />
                        </div>
                      ) : null}

                      <BooleanChip
                        checked={draft.riesgo}
                        onChange={(value) => {
                          setWizardError(null);

                          setDraft((current) => ({
                            ...current,
                            riesgo: value,
                            importe_riesgo: value
                              ? current.importe_riesgo ||
                                String(Math.max(totalFinal - totalPagosComerciales, 0)).replace(
                                  ".",
                                  ","
                                )
                              : "",
                            riesgo_motivo: value ? current.riesgo_motivo : ""
                          }));
                        }}
                        label="Imputar a riesgo Almundo"
                      />
                    </div>

                    {draft.riesgo ? (
                      <div className="mt-3 grid gap-3 rounded-[14px] border border-red-200 bg-red-50 p-3 md:grid-cols-[210px_minmax(0,1fr)]">
                        <div>
                          <FieldLabel>Importe riesgo Almundo</FieldLabel>

                          <TextInput
                            value={draft.importe_riesgo}
                            onChange={(value) => {
                              setWizardError(null);
                              setDraft((current) => ({ ...current, importe_riesgo: value }));
                            }}
                            placeholder="0,00"
                            inputMode="decimal"
                          />
                        </div>

                        <div>
                          <FieldLabel>Motivo / observación riesgo</FieldLabel>

                          <TextInput
                            value={draft.riesgo_motivo}
                            onChange={(value) => {
                              setWizardError(null);
                              setDraft((current) => ({ ...current, riesgo_motivo: value }));
                            }}
                            placeholder="Ej: pago impactado a riesgo en Almundo"
                          />
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-3 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]">
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Imputación comercial</span>
                        <strong className="font-semibold">
                          {formatMoneyAR(totalComercial, draft.venta.moneda)}
                        </strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Pago comercial</span>
                        <strong className="font-semibold">
                          {formatMoneyAR(totalPagosComerciales, draft.venta.moneda)}
                        </strong>
                      </div>

                      {draft.riesgo ? (
                        <div className="flex justify-between">
                          <span className="text-[#64748b]">Riesgo Almundo</span>

                          <strong className="font-semibold text-red-700">
                            {formatMoneyAR(importeRiesgo, draft.venta.moneda)}
                          </strong>
                        </div>
                      ) : null}

                      <div className="mt-2 flex justify-between border-t border-black/10 pt-2">
                        <span className="text-[#64748b]">Saldo comercial</span>

                        <strong
                          className={
                            saldoComercial > 0
                              ? "font-semibold text-red-600"
                              : "font-semibold text-emerald-700"
                          }
                        >
                          {formatMoneyAR(saldoComercial, draft.venta.moneda)}
                        </strong>
                      </div>
                    </div>
                  </section>
                ) : null}

                {step === 4 ? (
                  <section>
                    <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">
                      Paso 4 · Tesorería real
                    </h3>

                    <div className="mb-3 rounded-[14px] border border-black/10 bg-[#f8fafc] px-3 py-2 text-[12px] font-medium text-[#334155]">
                      Total cliente a cobrar hoy: {formatMoneyAR(totalFinal, draft.venta.moneda)}
                    </div>

                    <div className="grid gap-2">
                      {draft.movimientosTesoreria.map((movimiento, index) => (
                        <div
                          key={`movimiento-${index}`}
                          className="grid gap-2 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 md:grid-cols-2"
                        >
                          <div>
                            <FieldLabel>Caja</FieldLabel>

                            <NosturSelect
                              value={movimiento.caja_id || ""}
                              onChange={(value) => {
                                const caja = catalogos.cajas.find((item) => item.id === value);

                                updateMovimiento(index, {
                                  caja_id: caja?.id || null,
                                  caja: caja?.nombre || null
                                });
                              }}
                              options={cajaOptions}
                              placeholder="Buscar caja"
                            />
                          </div>

                          <div>
                            <FieldLabel>Forma real</FieldLabel>

                            <NosturSelect
                              value={movimiento.forma_pago_id || ""}
                              onChange={(value) => {
                                const forma = catalogos.formasPago.find((item) => item.id === value);

                                updateMovimiento(index, {
                                  forma_pago_id: forma?.id || null,
                                  forma_pago: forma?.nombre || null
                                });
                              }}
                              options={formaPagoOptions}
                              placeholder="Buscar forma"
                            />
                          </div>

                          <div>
                            <FieldLabel>Moneda</FieldLabel>

                            <NosturSelect
                              value={movimiento.moneda || draft.venta.moneda}
                              onChange={(value) => updateMovimiento(index, { moneda: value })}
                              options={MONEDA_OPTIONS}
                            />
                          </div>

                          <div>
                            <FieldLabel>Importe</FieldLabel>

                            <TextInput
                              value={
                                movimiento.importe ? String(movimiento.importe).replace(".", ",") : ""
                              }
                              onChange={(value) =>
                                updateMovimiento(index, { importe: parseMoney(value) })
                              }
                              placeholder="0,00"
                              inputMode="decimal"
                            />
                          </div>

                          <div>
                            <FieldLabel>TC</FieldLabel>

                            <TextInput
                              value={
                                movimiento.tipo_cambio
                                  ? String(movimiento.tipo_cambio).replace(".", ",")
                                  : ""
                              }
                              onChange={(value) =>
                                updateMovimiento(index, { tipo_cambio: parseMoney(value) })
                              }
                              placeholder="—"
                              inputMode="decimal"
                            />
                          </div>

                          <div className="flex items-end justify-end">
                            <LineButton
                              onClick={() =>
                                setDraft((current) => ({
                                  ...current,
                                  movimientosTesoreria:
                                    current.movimientosTesoreria.length > 1
                                      ? current.movimientosTesoreria.filter(
                                          (_, itemIndex) => itemIndex !== index
                                        )
                                      : [
                                          {
                                            importe: 0,
                                            moneda: current.venta.moneda,
                                            forma_pago_id: null,
                                            forma_pago: "",
                                            caja_id: null,
                                            caja: "",
                                            fecha_movimiento: current.venta.fecha_venta || getToday()
                                          }
                                        ]
                                }))
                              }
                            >
                              Eliminar
                            </LineButton>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <LineButton
                        onClick={() =>
                          setDraft((current) => ({
                            ...current,
                            movimientosTesoreria: [
                              ...current.movimientosTesoreria,
                              {
                                importe: 0,
                                moneda: current.venta.moneda,
                                forma_pago_id: null,
                                forma_pago: "",
                                caja_id: null,
                                caja: "",
                                fecha_movimiento: current.venta.fecha_venta || getToday()
                              }
                            ]
                          }))
                        }
                      >
                        + Agregar movimiento
                      </LineButton>
                    </div>

                    <div className="mt-3 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]">
                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Total imputado</span>
                        <strong className="font-semibold">
                          {formatMoneyAR(totalTesoreria, draft.venta.moneda)}
                        </strong>
                      </div>

                      <div className="flex justify-between">
                        <span className="text-[#64748b]">Diferencia</span>

                        <strong
                          className={
                            Math.abs(totalTesoreria - totalFinal) > 0.009
                              ? "font-semibold text-red-600"
                              : "font-semibold text-emerald-700"
                          }
                        >
                          {formatMoneyAR(totalTesoreria - totalFinal, draft.venta.moneda)}
                        </strong>
                      </div>
                    </div>
                  </section>
                ) : null}

                {step === 5 ? (
                  <section>
                    <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">
                      Paso 5 · Confirmación final
                    </h3>

                    <div className="grid gap-3 text-[12px] md:grid-cols-2">
                      <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                        <FieldLabel>Cliente</FieldLabel>

                        <div className="font-semibold text-[#172033]">
                          {draft.cliente.nombre_completo}
                        </div>

                        <div className="font-normal text-[#64748b]">{draft.cliente.telefono}</div>
                        <div className="font-normal text-[#64748b]">
                          {draft.cliente.email || "Sin email"}
                        </div>
                      </div>

                      <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                        <FieldLabel>Venta Ábaco</FieldLabel>

                        <div className="font-semibold text-[#172033]">
                          {draft.venta.numero_carrito}
                        </div>

                        <div className="font-normal text-[#64748b]">
                          {draft.venta.servicio} · {draft.venta.destinos.join(", ")}
                        </div>

                        <div className="font-normal text-[#64748b]">
                          {formatDateAR(draft.venta.fecha_in)} →{" "}
                          {draft.venta.solo_ida ? "Solo ida" : formatDateAR(draft.venta.fecha_out)}
                        </div>
                      </div>

                      <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                        <FieldLabel>Importes</FieldLabel>

                        <div className="flex justify-between">
                          <span>Bruto</span>
                          <strong className="font-semibold">
                            {formatMoneyAR(bruto, draft.venta.moneda)}
                          </strong>
                        </div>

                        <div className="flex justify-between">
                          <span>Promo</span>
                          <strong className="font-semibold">
                            {formatMoneyAR(promocode, draft.venta.moneda)}
                          </strong>
                        </div>

                        <div className="flex justify-between">
                          <span>Final</span>
                          <strong className="font-semibold">
                            {formatMoneyAR(totalFinal, draft.venta.moneda)}
                          </strong>
                        </div>
                      </div>

                      <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                        <FieldLabel>Resultado</FieldLabel>

                        <div className="flex justify-between">
                          <span>Comercial</span>
                          <strong className="font-semibold">
                            {formatMoneyAR(totalComercial, draft.venta.moneda)}
                          </strong>
                        </div>

                        <div className="flex justify-between">
                          <span>Tesorería</span>
                          <strong className="font-semibold">
                            {formatMoneyAR(totalTesoreria, draft.venta.moneda)}
                          </strong>
                        </div>

                        <div className="flex justify-between">
                          <span>Saldo Cta Cte</span>
                          <strong className="font-semibold">
                            {formatMoneyAR(saldo, draft.venta.moneda)}
                          </strong>
                        </div>

                        <div className="mt-2 font-semibold text-[#172033]">
                          Queda en Carritos: {visibleEnCarritos ? "SÍ" : "NO · Va a Cta Cte"}
                        </div>

                        {draft.pagoParcial ? (
                          <div className="font-semibold text-amber-700">
                            Ingreso a gastos: {formatDateAR(draft.fechaIngresoGastos)}
                          </div>
                        ) : null}

                        <div className="font-semibold text-[#172033]">
                          Riesgo Almundo: {draft.riesgo ? "SÍ" : "NO"}
                        </div>

                        {draft.riesgo ? (
                          <div className="font-semibold text-red-700">
                            Importe riesgo: {formatMoneyAR(importeRiesgo, draft.venta.moneda)}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="mt-3">
                      <BooleanChip
                        checked={draft.confirmado}
                        onChange={(value) => {
                          setWizardError(null);
                          setDraft((current) => ({ ...current, confirmado: value }));
                        }}
                        label="Confirmo que los datos son correctos"
                      />
                    </div>
                  </section>
                ) : null}
              </main>

              <WizardSummary
                draft={draft}
                totalFinal={totalFinal}
                totalComercial={totalComercial}
                totalTesoreria={totalTesoreria}
                saldo={saldo}
              />
            </div>

            <div className="sticky bottom-0 mt-4 flex justify-between gap-2 border-t border-black/10 bg-[#edf3f7]/95 pt-3 backdrop-blur">
              <button
                type="button"
                onClick={onClose}
                className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
              >
                Cancelar
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={step === 1}
                  onClick={() => {
                    setWizardError(null);
                    setStep((current) => Math.max(1, current - 1) as WizardStep);
                  }}
                  className="h-8 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc] disabled:opacity-40"
                >
                  Atrás
                </button>

                {step < 5 ? (
                  <button
                    type="button"
                    onClick={nextStep}
                    className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                  >
                    Siguiente
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={saving || !draft.confirmado}
                    onClick={submit}
                    className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
                  >
                    {saving ? "Creando..." : "Crear carrito"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </aside>
    </div>,
    document.body
  );
}

function CarritoDetailModal({
  carrito,
  vendedores,
  sucursales,
  onClose
}: {
  carrito: Carrito;
  vendedores: ProfileLite[];
  sucursales: { id: string; nombre: string }[];
  onClose: () => void;
}) {
  const abacoUrl = `https://abaco.almundo.com/bo/cart/${carrito.numero_carrito}`;

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-4xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-[17px] font-semibold text-[#172033]">
              Carrito {carrito.numero_carrito}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {carrito.clientes?.nombre_completo || "Sin cliente"} ·{" "}
              {carrito.destino || "Sin destino"}
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

        <div className="grid gap-2.5 md:grid-cols-3">
          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Cliente</FieldLabel>

            <div className="text-[13px] font-semibold text-[#172033]">
              {carrito.clientes?.nombre_completo || "—"}
            </div>

            <div className="text-[12px] font-normal text-[#64748b]">
              {carrito.clientes?.telefono || "—"}
            </div>
            <div className="text-[12px] font-normal text-[#64748b]">
              {carrito.clientes?.email || "Sin email"}
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Viaje</FieldLabel>

            <div className="text-[13px] font-semibold text-[#172033]">{carrito.destino || "—"}</div>

            <div className="text-[12px] font-normal text-[#64748b]">
              {formatDateAR(carrito.fecha_in)} →{" "}
              {carrito.solo_ida ? "Solo ida" : formatDateAR(carrito.fecha_out)}
            </div>

            <div className="mt-1 text-[12px] font-normal text-[#64748b]">
              {carrito.servicio || "Sin servicio"}
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Total</FieldLabel>

            <div className="text-[13px] font-semibold text-[#172033]">
              {formatMoneyAR(carrito.importe_final ?? carrito.importe, carrito.moneda)}
            </div>

            <div className="text-[12px] font-normal text-[#64748b]">{carrito.estado}</div>

            {carrito.riesgo ? (
              <div className="mt-2 inline-flex rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                Riesgo
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px] font-normal text-[#475569]">
            <div className="mb-3">
              <FieldLabel>Vendedor</FieldLabel>

              <SellerBadge
                vendedorId={carrito.vendedor_id}
                vendedorNombre={carrito.vendedor}
                vendedores={vendedores}
              />
            </div>

            <div className="mb-1.5">
              Sucursal:{" "}
              <strong className="font-semibold">
                {sucursales.find((sucursal) => sucursal.id === carrito.sucursal_id)?.nombre || "—"}
              </strong>
            </div>

            <div className="mb-1.5">
              Método contacto:{" "}
              <strong className="font-semibold">{carrito.metodo_contacto || "—"}</strong>
            </div>

            <div className="mb-1.5">
              Forma de pago: <strong className="font-semibold">{carrito.forma_pago || "—"}</strong>
            </div>

            <div>
              Riesgo: <strong className="font-semibold">{carrito.riesgo ? "SÍ" : "NO"}</strong>
            </div>
          </div>

          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px] font-normal text-[#475569]">
            <div className="mb-1.5 flex justify-between gap-3">
              <span>Bruto</span>
              <strong className="font-semibold">
                {formatMoneyAR(carrito.importe_bruto, carrito.moneda)}
              </strong>
            </div>

            <div className="mb-1.5 flex justify-between gap-3">
              <span>Promo</span>
              <strong className="font-semibold">
                {formatMoneyAR(carrito.promocode_importe, carrito.moneda)}
              </strong>
            </div>

            <div className="mb-1.5 flex justify-between gap-3">
              <span>Final</span>
              <strong className="font-semibold">
                {formatMoneyAR(carrito.importe_final ?? carrito.importe, carrito.moneda)}
              </strong>
            </div>

            <div className="mb-1.5 flex justify-between gap-3">
              <span>Pagado</span>
              <strong className="font-semibold">
                {formatMoneyAR(carrito.total_pagado, carrito.moneda)}
              </strong>
            </div>

            <div className="flex justify-between gap-3 border-t border-black/10 pt-2">
              <span>Saldo</span>
              <strong
                className={
                  parseMoney(carrito.saldo_cta_cte) > 0
                    ? "font-semibold text-red-600"
                    : "font-semibold text-emerald-700"
                }
              >
                {formatMoneyAR(carrito.saldo_cta_cte, carrito.moneda)}
              </strong>
            </div>
          </div>
        </div>

        {carrito.riesgo ? (
          <div className="mt-3 rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            <strong>Motivo riesgo:</strong> {carrito.riesgo_motivo || "Sin motivo cargado"}
          </div>
        ) : null}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => window.open(abacoUrl, "_blank")}
            className="h-8 rounded-[10px] border border-black/10 bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
          >
            Abrir Ábaco
          </button>
        </div>
      </div>
    </div>
  );
}

export function CarritosPanel() {
  const loading = useCarritosStore((state) => state.loading);
  const saving = useCarritosStore((state) => state.saving);
  const error = useCarritosStore((state) => state.error);
  const filters = useCarritosStore((state) => state.filters);
  const catalogos = useCarritosStore((state) => state.catalogos);
  const selectedCarritoId = useCarritosStore((state) => state.selectedCarritoId);

  const loadCarritos = useCarritosStore((state) => state.loadCarritos);
  const setFilter = useCarritosStore((state) => state.setFilter);
  const setMonthFilter = useCarritosStore((state) => state.setMonthFilter);
  const goToPreviousMonth = useCarritosStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useCarritosStore((state) => state.goToNextMonth);
  const goToCurrentMonth = useCarritosStore((state) => state.goToCurrentMonth);
  const clearError = useCarritosStore((state) => state.clearError);
  const selectCarrito = useCarritosStore((state) => state.selectCarrito);
  const toggleCarritoActivo = useCarritosStore((state) => state.toggleCarritoActivo);
  const sendToControl = useCarritosStore((state) => state.sendToControl);

  const getFilteredCarritos = useCarritosStore((state) => state.getFilteredCarritos);
  const getMetrics = useCarritosStore((state) => state.getMetrics);

  const carritos = getFilteredCarritos();
  const metrics = getMetrics();

const [filtersOpen, setFiltersOpen] = useState(false);
const [wizardOpen, setWizardOpen] = useState(false);
const [detailCarrito, setDetailCarrito] = useState<Carrito | null>(null);
const [toast, setToast] = useState<ToastState>(null);

  const selectedCarrito = useMemo(
    () => carritos.find((carrito) => carrito.id === selectedCarritoId) || carritos[0] || null,
    [carritos, selectedCarritoId]
  );

  useEffect(() => {
    loadCarritos();
  }, [loadCarritos]);





  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  function refreshAfterPeriodChange(action: () => void) {
    action();

    window.setTimeout(() => {
      loadCarritos();
    }, 0);
  }

  async function handleToggle(carrito: Carrito) {
    const ok = await toggleCarritoActivo(carrito);

    if (ok) showToast(carrito.activo ? "Carrito desactivado." : "Carrito activado.");
  }

  async function handleSendToControl(carrito: Carrito) {
    if (["EN_CONTROL", "CONTROLADO", "FACTURADO", "COBRADO"].includes(carrito.estado)) {
      showToast("Este carrito ya fue enviado a control o ya fue controlado.", "error");
      return;
    }

    const ok = await sendToControl(carrito);

    if (ok) showToast("Carrito enviado a control.");
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

  const riesgoOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    { value: "riesgo", label: "Con riesgo" },
    { value: "normal", label: "Sin riesgo" }
  ];

  const activoOptions: SelectOption[] = [
    { value: "activos", label: "Activos" },
    { value: "inactivos", label: "Inactivos" },
    { value: "todos", label: "Todos" }
  ];


  const selectedVendedorFilterLabel =
  vendedorOptions.find((option) => option.value === filters.vendedorId)?.label || "Todos";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">Carritos</h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Almundo
              </span>
            </div>

           <p className="mt-1 text-[12px] font-normal text-[#64748b]">
  Carga de ventas Almundo. Por defecto cada vendedor ve sus carritos, pero puede filtrar por todos.
</p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={loadCarritos}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => setWizardOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Nuevo carrito
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
                  Mes operativo
                </span>

                <span className="rounded-md bg-white px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-[#64748b] ring-1 ring-black/10">
                  {filters.periodMode === "mes" ? "Vista mensual" : "Rango manual"}
                </span>
              </div>

             <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
  {filters.periodMode === "mes"
    ? `${formatMonthLabel(filters.month)} · ${filters.desde} → ${filters.hasta}`
    : `Rango reportes · ${filters.desde} → ${filters.hasta}`}{" "}
  · Vendedor: {selectedVendedorFilterLabel} · Estado:{" "}
  {filters.estado === "todos" ? "Todos" : filters.estado} · Riesgo: {filters.riesgo}
</div>
            </button>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <div className="flex items-center gap-1 rounded-[12px] border border-black/10 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => refreshAfterPeriodChange(goToPreviousMonth)}
                  className="h-7 rounded-[10px] px-2.5 text-[11px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  Anterior
                </button>

                <div className="flex h-7 min-w-[112px] items-center justify-center rounded-[10px] bg-[#172033] px-3 text-center text-[11px] font-medium text-white">
                  {formatMonthLabel(filters.month)}
                </div>

                <button
                  type="button"
                  onClick={() => refreshAfterPeriodChange(goToNextMonth)}
                  className="h-7 rounded-[10px] px-2.5 text-[11px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  Siguiente
                </button>
              </div>

              <button
                type="button"
                onClick={() => refreshAfterPeriodChange(goToCurrentMonth)}
                className="h-7 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
              >
                Este mes
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
          </div>

          {filtersOpen ? (
            <>
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.2fr_1fr_1fr_1fr_1fr]">
                <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-[#4f7c90]/20 bg-white/70 p-2">
                  <div>
                    <FieldLabel>Desde reportes</FieldLabel>

                    <NosturDateInput
                      value={filters.desde}
                      onChange={(value) => setFilter("desde", value)}
                    />
                  </div>

                  <div>
                    <FieldLabel>Hasta reportes</FieldLabel>

                    <NosturDateInput
                      value={filters.hasta}
                      onChange={(value) => setFilter("hasta", value)}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Estado</FieldLabel>

                  <NosturSelect
                    value={filters.estado}
                    onChange={(value) => setFilter("estado", value)}
                    options={ESTADO_OPTIONS}
                  />
                </div>

               <div>
  <FieldLabel>Vendedor</FieldLabel>

  <NosturSelect
    value={filters.vendedorId}
    onChange={(value) => {
      setFilter("vendedorId", value);

      window.setTimeout(() => {
        loadCarritos();
      }, 0);
    }}
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

                <div>
                  <FieldLabel>Riesgo</FieldLabel>

                  <NosturSelect
                    value={filters.riesgo}
                    onChange={(value) => setFilter("riesgo", value as typeof filters.riesgo)}
                    options={riesgoOptions}
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

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto_auto]">
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
                  onClick={() => {
                    setMonthFilter(filters.month);
                    window.setTimeout(loadCarritos, 0);
                  }}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Usar mes operativo
                </button>

                <button
                  type="button"
                  onClick={loadCarritos}
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
          <CardMetric label="Carritos" value={metrics.carritos} icon={ShoppingCart} />
          <CardMetric label="Total venta" value={formatMoneyAR(metrics.totalVenta)} icon={FileText} />
          <CardMetric
            label="Pagado"
            value={formatMoneyAR(metrics.totalPagado)}
            icon={CheckCircle2}
            tone="green"
          />
          <CardMetric label="Saldo" value={formatMoneyAR(metrics.saldo)} icon={AlertTriangle} tone="red" />
          <CardMetric label="Riesgos" value={metrics.riesgos} icon={AlertTriangle} tone="red" />
          <CardMetric label="En control" value={metrics.enControl} icon={Eye} tone="blue" />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Listado de carritos</h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${carritos.length} carritos cargados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando carritos...
              </div>
            ) : carritos.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay carritos para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {carritos.map((carrito) => {
                  const selected = selectedCarrito?.id === carrito.id;
                  const cliente = carrito.clientes;
                  const tieneSaldo = parseMoney(carrito.saldo_cta_cte) > 0.009;
                  const estaInactivo = carrito.activo === false;

                  return (
                    <div
                      key={carrito.id}
                      onClick={() => selectCarrito(carrito.id)}
                      className={[
                        "grid min-w-0 cursor-pointer gap-2 rounded-[12px] border px-2.5 py-2 text-left transition lg:grid-cols-[1.35fr_1.15fr_1fr_128px_136px]",
                        selected
                          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                          : estaInactivo
                            ? "border-black/10 bg-[#f8fafc] opacity-60 hover:bg-white"
                            : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                      title={
                        estaInactivo
                          ? "Carrito inactivo"
                          : tieneSaldo
                            ? "Carrito con saldo pendiente / Cta Cte"
                            : "Carrito sin saldo pendiente"
                      }
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {cliente?.nombre_completo || "Sin cliente"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {cliente?.telefono || "—"}
                        </div>

                        <div className="truncate text-[11px] font-medium text-[#4f7c90]">
                          {carrito.numero_carrito}
                        </div>

                        <div className="mt-1">
                          <SellerBadge
                            vendedorId={carrito.vendedor_id}
                            vendedorNombre={carrito.vendedor}
                            vendedores={catalogos.vendedores}
                          />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {carrito.destino || "Sin destino"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {formatDateAR(carrito.fecha_in)} →{" "}
                          {carrito.solo_ida ? "Solo ida" : formatDateAR(carrito.fecha_out)}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {carrito.servicio || "Sin servicio"} ·{" "}
                          {carrito.metodo_contacto || "Sin método"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatMoneyAR(carrito.importe_final ?? carrito.importe, carrito.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">
                          Pagado {formatMoneyAR(carrito.total_pagado, carrito.moneda)}
                        </div>

                        {tieneSaldo ? (
                          <div className="text-[11px] font-medium text-[#64748b]">
                            Saldo {formatMoneyAR(carrito.saldo_cta_cte, carrito.moneda)}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <span className="rounded-md border border-black/10 bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#334155]">
                          {carrito.estado}
                        </span>

                        {tieneSaldo ? (
                          <span className="rounded-md border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">
                            Cta Cte
                          </span>
                        ) : null}

                        {carrito.riesgo ? (
                          <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                            Riesgo
                          </span>
                        ) : null}

                        {estaInactivo ? (
                          <span className="rounded-md border border-slate-300 bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">
                            Inactivo
                          </span>
                        ) : null}
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setDetailCarrito(carrito);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
                          title="Ver detalle"
                        >
                          <Eye size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            window.open(
                              `https://abaco.almundo.com/bo/cart/${carrito.numero_carrito}`,
                              "_blank"
                            );
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
                          title="Abrir Ábaco"
                        >
                          <ShoppingCart size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleSendToControl(carrito);
                          }}
                          className={[
                            "flex h-7 w-7 items-center justify-center rounded-[9px] hover:bg-white",
                            ["EN_CONTROL", "CONTROLADO", "FACTURADO", "COBRADO"].includes(
                              carrito.estado
                            )
                              ? "text-emerald-600 opacity-60"
                              : "text-[#4f7c90]"
                          ].join(" ")}
                          title={
                            ["EN_CONTROL", "CONTROLADO", "FACTURADO", "COBRADO"].includes(
                              carrito.estado
                            )
                              ? "Ya fue enviado a control o ya fue controlado"
                              : "Enviar a control"
                          }
                        >
                          <CheckCircle2 size={13} />
                        </button>

                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleToggle(carrito);
                          }}
                          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
                          title={carrito.activo ? "Desactivar" : "Activar"}
                        >
                          {carrito.activo ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            {selectedCarrito ? (
              <>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-[#4f7c90] text-[12px] font-semibold text-white">
                      {getInitials(selectedCarrito.clientes?.nombre_completo || "C")}
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-[13.5px] font-semibold text-[#172033]">
                        {selectedCarrito.numero_carrito}
                      </h2>

                      <p className="truncate text-[11.5px] font-normal text-[#64748b]">
                        {selectedCarrito.clientes?.nombre_completo || "Sin cliente"}
                      </p>
                    </div>
                  </div>

                  {selectedCarrito.riesgo ? (
                    <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                      Riesgo
                    </span>
                  ) : null}
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <div className="mb-1.5 flex items-center gap-2">
                      <UserRound size={14} className="text-[#4f7c90]" />

                      <span className="truncate font-semibold text-[#172033]">
                        {selectedCarrito.clientes?.nombre_completo || "Sin cliente"}
                      </span>
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {selectedCarrito.clientes?.telefono || "—"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {selectedCarrito.clientes?.email || "Sin email"}
                    </div>
                  </div>

                  <div>
                    <FieldLabel>Vendedor</FieldLabel>

                    <SellerBadge
                      vendedorId={selectedCarrito.vendedor_id}
                      vendedorNombre={selectedCarrito.vendedor}
                      vendedores={catalogos.vendedores}
                    />
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Viaje</FieldLabel>

                    <div className="font-semibold text-[#172033]">
                      {selectedCarrito.destino || "Sin destino"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {formatDateAR(selectedCarrito.fecha_in)} →{" "}
                      {selectedCarrito.solo_ida
                        ? "Solo ida"
                        : formatDateAR(selectedCarrito.fecha_out)}
                    </div>

                    <div className="mt-1 font-normal text-[#64748b]">
                      {selectedCarrito.servicio || "Sin servicio"} ·{" "}
                      {selectedCarrito.metodo_contacto || "Sin método"}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Importes</FieldLabel>

                    <div className="flex justify-between">
                      <span>Bruto</span>

                      <strong className="font-semibold">
                        {formatMoneyAR(selectedCarrito.importe_bruto, selectedCarrito.moneda)}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span>Promo</span>

                      <strong className="font-semibold">
                        {formatMoneyAR(selectedCarrito.promocode_importe, selectedCarrito.moneda)}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span>Final</span>

                      <strong className="font-semibold">
                        {formatMoneyAR(
                          selectedCarrito.importe_final ?? selectedCarrito.importe,
                          selectedCarrito.moneda
                        )}
                      </strong>
                    </div>

                    <div className="flex justify-between">
                      <span>Pagado</span>

                      <strong className="font-semibold">
                        {formatMoneyAR(selectedCarrito.total_pagado, selectedCarrito.moneda)}
                      </strong>
                    </div>

                    <div className="mt-1 flex justify-between border-t border-black/10 pt-1">
                      <span>Saldo</span>

                      <strong
                        className={
                          parseMoney(selectedCarrito.saldo_cta_cte) > 0.009
                            ? "font-semibold text-amber-700"
                            : "font-semibold text-emerald-700"
                        }
                      >
                        {formatMoneyAR(selectedCarrito.saldo_cta_cte, selectedCarrito.moneda)}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setDetailCarrito(selectedCarrito)}
                      className="h-8 rounded-[10px] border border-black/10 bg-white text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Ver
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        window.open(
                          `https://abaco.almundo.com/bo/cart/${selectedCarrito.numero_carrito}`,
                          "_blank"
                        )
                      }
                      className="h-8 rounded-[10px] border border-black/10 bg-white text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Ábaco
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSendToControl(selectedCarrito)}
                      disabled={
                        saving ||
                        ["EN_CONTROL", "CONTROLADO", "FACTURADO", "COBRADO"].includes(
                          selectedCarrito.estado
                        )
                      }
                      className="h-8 rounded-[10px] border border-[#4f7c90]/25 bg-[#eef6f7] text-[12px] font-medium text-[#4f7c90] hover:bg-[#dfeff2] disabled:opacity-50"
                    >
                      Enviar a control
                    </button>

                    <button
                      type="button"
                      onClick={() => handleToggle(selectedCarrito)}
                      disabled={saving}
                      className="h-8 rounded-[10px] border border-red-200 bg-red-50 text-[12px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      {selectedCarrito.activo ? "Desactivar" : "Activar"}
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná un carrito para ver el detalle.
              </div>
            )}
          </aside>
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />

      {wizardOpen ? (
        <CarritoWizard onClose={() => setWizardOpen(false)} onSaved={(message) => showToast(message)} />
      ) : null}

      {detailCarrito ? (
        <CarritoDetailModal
          carrito={detailCarrito}
          vendedores={catalogos.vendedores}
          sucursales={catalogos.sucursales}
          onClose={() => setDetailCarrito(null)}
        />
      ) : null}
    </div>
  );
}

export default CarritosPanel;