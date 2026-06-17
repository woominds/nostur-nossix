// src/components/caja/CajaPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  ChevronsUpDown,
  CircleDollarSign,
  Filter,
  Landmark,
  Plus,
  RefreshCcw,
  Search,
  Settings2,
  Wallet,
  X
} from "lucide-react";
import {
  createInitialConciliacionDraft,
  createInitialMovimientoDraft,
  createInitialPaseCajaDraft,
  getCajaDisplayName,
  useCajaStore,
  type CajaLite,
  type CajaMovimiento,
  type CajaSaldo,
  type ConciliacionDraft,
  type MovimientoDraft,
  type PaseCajaDraft
} from "../../store/cajaStore";
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

type ModalMode = "movimiento" | "pase" | "conciliacion" | null;
type AnularMovimientoState = CajaMovimiento | null;

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const TIPO_FILTER_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "INGRESO", label: "Ingresos" },
  { value: "EGRESO", label: "Egresos" },
  { value: "PASE_INGRESO", label: "Pases ingreso" },
  { value: "PASE_EGRESO", label: "Pases egreso" },
  { value: "CONCILIACION", label: "Conciliaciones" }
];

const ANULADO_OPTIONS: SelectOption[] = [
  { value: "no", label: "No anulados" },
  { value: "si", label: "Anulados" },
  { value: "todos", label: "Todos" }
];

const MOVIMIENTO_TIPO_OPTIONS: SelectOption[] = [
  { value: "INGRESO", label: "Ingreso" },
  { value: "EGRESO", label: "Egreso" }
];

const CATEGORIA_OPTIONS: SelectOption[] = [
  { value: "Cobro cliente", label: "Cobro cliente" },
  { value: "Pago proveedor", label: "Pago proveedor" },
  { value: "Gastos oficina", label: "Gastos oficina" },
  { value: "Sueldos / adelantos", label: "Sueldos / adelantos" },
  { value: "Impuestos", label: "Impuestos" },
  { value: "Ajuste manual", label: "Ajuste manual" },
  { value: "Otros", label: "Otros" }
];

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
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

function TipoBadge({ movimiento }: { movimiento: CajaMovimiento }) {
  const signed = parseMoney(movimiento.importe_con_signo);
  const isIngreso = signed >= 0;

  return (
    <span
      className={[
        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        movimiento.anulado
          ? "border-red-200 bg-red-50 text-red-700"
          : isIngreso
            ? "border-emerald-200 bg-emerald-50 text-emerald-700"
            : "border-amber-200 bg-amber-50 text-amber-700"
      ].join(" ")}
    >
      {movimiento.anulado ? "Anulado" : isIngreso ? "Ingreso" : "Egreso"}
    </span>
  );
}

function CajaCard({
  saldo,
  selected,
  onSelect
}: {
  saldo: CajaSaldo;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : "border-black/10 bg-white/68 hover:bg-white"
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-[#172033]">
            {saldo.caja_nombre}
          </div>

          <div className="mt-0.5 text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
            {saldo.caja_tipo} · {saldo.moneda}
          </div>

          <div className="mt-2 truncate text-[17px] font-semibold leading-none text-[#172033]">
            {formatMoneyAR(saldo.saldo_actual, saldo.moneda)}
          </div>

          <div className="mt-2 grid gap-0.5 text-[10.5px] font-normal text-[#64748b]">
            <div>Últ. mov.: {formatDate(saldo.ultimo_movimiento_fecha)}</div>
            <div>Últ. conc.: {formatDate(saldo.ultima_conciliacion_fecha)}</div>
          </div>
        </div>

        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] bg-white text-[#4f7c90] shadow-sm ring-1 ring-black/10">
          {saldo.caja_tipo === "BANCO" ? <Landmark size={14} /> : <Wallet size={14} />}
        </div>
      </div>
    </button>
  );
}

function MovimientoModal({
  cajas,
  selectedCaja,
  saving,
  onClose,
  onSave
}: {
  cajas: CajaLite[];
  selectedCaja: CajaSaldo | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: MovimientoDraft) => Promise<void>;
}) {
  const cajaDefault = selectedCaja
    ? cajas.find((item) => item.id === selectedCaja.caja_id) || null
    : cajas[0] || null;

  const [draft, setDraft] = useState<MovimientoDraft>(() =>
    createInitialMovimientoDraft(cajaDefault)
  );

  function setField<K extends keyof MovimientoDraft>(key: K, value: MovimientoDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const cajaOptions = cajas.map((caja) => ({
    value: caja.id,
    label: getCajaDisplayName(caja)
  }));

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Nuevo movimiento</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Ingreso o egreso manual de caja.
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

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Fecha</FieldLabel>
            <NosturDateInput value={draft.fecha} onChange={(value) => setField("fecha", value)} />
          </div>

          <div>
            <FieldLabel>Tipo</FieldLabel>
            <NosturSelect
              value={draft.tipo}
              onChange={(value) => setField("tipo", value as MovimientoDraft["tipo"])}
              options={MOVIMIENTO_TIPO_OPTIONS}
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Caja</FieldLabel>
            <NosturSelect
              value={draft.caja_id}
              onChange={(value) => {
                const caja = cajas.find((item) => item.id === value);
                setDraft((current) => ({
                  ...current,
                  caja_id: value,
                  moneda: caja?.moneda || current.moneda
                }));
              }}
              options={cajaOptions}
              placeholder="Seleccionar caja"
            />
          </div>

          <div>
            <FieldLabel>Categoría</FieldLabel>
            <NosturSelect
              value={draft.categoria}
              onChange={(value) => setField("categoria", value)}
              options={CATEGORIA_OPTIONS}
              placeholder="Seleccionar categoría"
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

          <div className="md:col-span-2">
            <FieldLabel>Descripción</FieldLabel>
            <TextInput
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Detalle del movimiento"
            />
          </div>

          <div>
            <FieldLabel>Forma de pago</FieldLabel>
            <TextInput
              value={draft.forma_pago}
              onChange={(value) => setField("forma_pago", value)}
              placeholder="Efectivo, transferencia, tarjeta..."
            />
          </div>

          <div>
            <FieldLabel>Referencia</FieldLabel>
            <TextInput
              value={draft.referencia_texto}
              onChange={(value) => setField("referencia_texto", value)}
              placeholder="Comprobante, recibo, nota interna..."
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea
              value={draft.observaciones}
              onChange={(value) => setField("observaciones", value)}
              placeholder="Detalle adicional del movimiento..."
            />
          </div>
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
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar movimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function PaseModal({
  cajas,
  saving,
  onClose,
  onSave
}: {
  cajas: CajaLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: PaseCajaDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PaseCajaDraft>(() => createInitialPaseCajaDraft());

  function setField<K extends keyof PaseCajaDraft>(key: K, value: PaseCajaDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const cajaOptions = cajas.map((caja) => ({
    value: caja.id,
    label: getCajaDisplayName(caja)
  }));

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Pase de caja</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Mueve dinero entre cajas de la misma moneda.
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

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Fecha</FieldLabel>
            <NosturDateInput value={draft.fecha} onChange={(value) => setField("fecha", value)} />
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
            <FieldLabel>Caja origen</FieldLabel>
            <NosturSelect
              value={draft.caja_origen_id}
              onChange={(value) => setField("caja_origen_id", value)}
              options={cajaOptions}
              placeholder="Seleccionar origen"
            />
          </div>

          <div>
            <FieldLabel>Caja destino</FieldLabel>
            <NosturSelect
              value={draft.caja_destino_id}
              onChange={(value) => setField("caja_destino_id", value)}
              options={cajaOptions}
              placeholder="Seleccionar destino"
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Descripción</FieldLabel>
            <TextInput
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Ej: Pase de efectivo a banco"
            />
          </div>
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
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-sky-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-sky-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Crear pase"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConciliacionModal({
  selectedSaldo,
  saving,
  onClose,
  onSave
}: {
  selectedSaldo: CajaSaldo | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ConciliacionDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ConciliacionDraft>(() =>
    createInitialConciliacionDraft(selectedSaldo)
  );

  function setField<K extends keyof ConciliacionDraft>(key: K, value: ConciliacionDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const saldoSistema = parseMoney(selectedSaldo?.saldo_actual);
  const saldoReal = parseMoney(draft.saldo_real);
  const diferencia = saldoReal - saldoSistema;

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Conciliar caja</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {selectedSaldo
                ? `${selectedSaldo.caja_nombre} · ${selectedSaldo.moneda}`
                : "Seleccioná una caja"}
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

        {!selectedSaldo ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            Seleccioná una caja antes de conciliar.
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-2.5 md:grid-cols-3">
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Saldo sistema</FieldLabel>
                <div className="text-[13px] font-semibold text-[#172033]">
                  {formatMoneyAR(saldoSistema, selectedSaldo.moneda)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Saldo real</FieldLabel>
                <div className="text-[13px] font-semibold text-[#172033]">
                  {formatMoneyAR(saldoReal, selectedSaldo.moneda)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Diferencia</FieldLabel>
                <div
                  className={[
                    "text-[13px] font-semibold",
                    Math.abs(diferencia) > 0.009 ? "text-red-700" : "text-emerald-700"
                  ].join(" ")}
                >
                  {formatMoneyAR(diferencia, selectedSaldo.moneda)}
                </div>
              </div>
            </div>

            <div className="grid gap-3">
              <div>
                <FieldLabel>Fecha</FieldLabel>
                <NosturDateInput value={draft.fecha} onChange={(value) => setField("fecha", value)} />
              </div>

              <div>
                <FieldLabel>Saldo real contado</FieldLabel>
                <TextInput
                  value={draft.saldo_real}
                  onChange={(value) => setField("saldo_real", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Observaciones</FieldLabel>
                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Detalle de la conciliación o ajuste..."
                />
              </div>
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
            disabled={saving || !selectedSaldo}
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-emerald-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-emerald-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Conciliar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MotivoAnulacionModal({
  movimiento,
  saving,
  onClose,
  onConfirm
}: {
  movimiento: CajaMovimiento | null;
  saving: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setMotivo("");
  }, [movimiento?.id]);

  if (!movimiento) return null;

  const canConfirm = motivo.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center bg-black/35 px-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#172033]">Anular movimiento</h2>
            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Indicá el motivo de anulación. Quedará guardado en el historial.
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

        <div className="mb-3 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]">
          <div className="font-semibold text-[#172033]">{movimiento.descripcion}</div>
          <div className="mt-0.5 font-normal text-[#64748b]">
            {formatDate(movimiento.fecha)} ·{" "}
            {formatMoneyAR(Math.abs(parseMoney(movimiento.importe_con_signo)), movimiento.moneda)}
          </div>
          <div className="mt-1 text-[11px] font-normal text-[#64748b]">
            Registrado por: {movimiento.created_by_nombre || "—"}
          </div>
        </div>

        <div>
          <FieldLabel>Motivo</FieldLabel>
          <TextArea
            value={motivo}
            onChange={setMotivo}
            placeholder="Ej: carga duplicada, importe incorrecto, error administrativo..."
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
            {saving ? "Anulando..." : "Anular"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function CajaPanel() {
  const loading = useCajaStore((state) => state.loading);
  const saving = useCajaStore((state) => state.saving);
  const error = useCajaStore((state) => state.error);
  const currentProfile = useCajaStore((state) => state.currentProfile);
  const canManageCaja = useCajaStore((state) => state.canManageCaja);
  const cajas = useCajaStore((state) => state.cajas);
  const saldos = useCajaStore((state) => state.saldos);
  const filters = useCajaStore((state) => state.filters);
  const selectedCajaId = useCajaStore((state) => state.selectedCajaId);

  const loadCaja = useCajaStore((state) => state.loadCaja);
  const saveMovimiento = useCajaStore((state) => state.saveMovimiento);
  const savePaseCaja = useCajaStore((state) => state.savePaseCaja);
  const saveConciliacion = useCajaStore((state) => state.saveConciliacion);
  const anularMovimiento = useCajaStore((state) => state.anularMovimiento);
  const setFilter = useCajaStore((state) => state.setFilter);
  const resetFilters = useCajaStore((state) => state.resetFilters);
  const selectCaja = useCajaStore((state) => state.selectCaja);
  const clearError = useCajaStore((state) => state.clearError);

  const getFilteredMovimientos = useCajaStore((state) => state.getFilteredMovimientos);
  const getSelectedSaldo = useCajaStore((state) => state.getSelectedSaldo);
  const getMetrics = useCajaStore((state) => state.getMetrics);

  const movimientos = getFilteredMovimientos();
  const selectedSaldo = useMemo(
    () => getSelectedSaldo(),
    [saldos, selectedCajaId, getSelectedSaldo]
  );
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [toast, setToast] = useState<ToastState>(null);
  const [movimientoAnular, setMovimientoAnular] = useState<AnularMovimientoState>(null);

  const cajaOptions: SelectOption[] = [
    { value: "todos", label: "Todas" },
    ...cajas.map((caja) => ({
      value: caja.id,
      label: getCajaDisplayName(caja)
    }))
  ];

  useEffect(() => {
    loadCaja();
  }, [loadCaja]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  async function handleSaveMovimiento(draft: MovimientoDraft) {
    const ok = await saveMovimiento(draft);

    if (ok) {
      setModalMode(null);
      showToast("Movimiento guardado correctamente.");
    }
  }

  async function handleSavePase(draft: PaseCajaDraft) {
    const ok = await savePaseCaja(draft);

    if (ok) {
      setModalMode(null);
      showToast("Pase de caja creado correctamente.");
    }
  }

  async function handleSaveConciliacion(draft: ConciliacionDraft) {
    const ok = await saveConciliacion(draft);

    if (ok) {
      setModalMode(null);
      showToast("Caja conciliada correctamente.");
    }
  }

  function handleAnular(movimiento: CajaMovimiento) {
    setMovimientoAnular(movimiento);
  }

  async function confirmAnularMovimiento(motivo: string) {
    if (!movimientoAnular) return;

    const ok = await anularMovimiento(movimientoAnular, motivo);

    if (ok) {
      setMovimientoAnular(null);
      showToast("Movimiento anulado correctamente.");
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">Caja</h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Tesorería
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManageCaja
                ? "Ingresos, egresos, saldos, pases y conciliaciones."
                : `Caja de ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={loadCaja}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => setModalMode("movimiento")}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Movimiento
            </button>

            <button
              type="button"
              onClick={() => setModalMode("pase")}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-sky-700 px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-sky-800"
            >
              <ArrowLeftRight size={13} />
              Pase
            </button>

            <button
              type="button"
              onClick={() => setModalMode("conciliacion")}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-emerald-700 px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-emerald-800"
            >
              <Settings2 size={13} />
              Conciliar
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
                  {filters.desde} → {filters.hasta}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Moneda: {filters.moneda} · Caja: {filters.cajaId} · Tipo: {filters.tipo} ·
                Anulados: {filters.anulados}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-2">
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
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.2fr_150px_220px_180px_160px]">
                <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-[#4f7c90]/20 bg-white/70 p-2">
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
                  <FieldLabel>Caja</FieldLabel>
                  <NosturSelect
                    value={filters.cajaId}
                    onChange={(value) => setFilter("cajaId", value)}
                    options={cajaOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <NosturSelect
                    value={filters.tipo}
                    onChange={(value) => setFilter("tipo", value as typeof filters.tipo)}
                    options={TIPO_FILTER_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Anulados</FieldLabel>
                  <NosturSelect
                    value={filters.anulados}
                    onChange={(value) => setFilter("anulados", value as typeof filters.anulados)}
                    options={ANULADO_OPTIONS}
                  />
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por caja, categoría, descripción, referencia, vendedor, cliente o registrado por..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadCaja}
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
            value={formatMoneyAR(metrics.ars, "ARS")}
            icon={Wallet}
            tone="blue"
          />
          <MetricCard
            label="Saldo USD"
            value={formatMoneyAR(metrics.usd, "USD")}
            icon={Wallet}
            tone="green"
          />
          <MetricCard label="Cajas activas" value={metrics.cajas} icon={Landmark} />
          <MetricCard label="Movimientos" value={metrics.movimientos} icon={CalendarDays} />
          <MetricCard
            label="Ingresos ARS"
            value={formatMoneyAR(metrics.ingresosArs, "ARS")}
            icon={CircleDollarSign}
            tone="green"
          />
          <MetricCard
            label="Egresos ARS"
            value={formatMoneyAR(metrics.egresosArs, "ARS")}
            icon={AlertTriangle}
            tone="red"
          />
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          {saldos.map((saldo) => (
            <CajaCard
              key={saldo.caja_id}
              saldo={saldo}
              selected={selectedSaldo?.caja_id === saldo.caja_id}
              onSelect={() => selectCaja(saldo.caja_id)}
            />
          ))}
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Movimientos de caja</h2>
                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${movimientos.length} movimientos encontrados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando movimientos...
              </div>
            ) : movimientos.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay movimientos para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {movimientos.map((movimiento) => {
                  const signed = parseMoney(movimiento.importe_con_signo);
                  const isIngreso = signed >= 0;

                  return (
                    <div
                      key={movimiento.id}
                      className={[
                        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition xl:grid-cols-[86px_minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_118px_86px]",
                        movimiento.anulado
                          ? "border-red-200 bg-red-50/60"
                          : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#172033]">
                          {formatDate(movimiento.fecha)}
                        </div>
                        <div className="mt-1">
                          <TipoBadge movimiento={movimiento} />
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {movimiento.descripcion}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {movimiento.categoria || "Sin categoría"}
                        </div>

                        {movimiento.observaciones ? (
                          <div className="mt-1 line-clamp-2 text-[10.5px] font-normal text-[#94a3b8]">
                            Obs.: {movimiento.observaciones}
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {movimiento.caja_nombre || "Sin caja"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {movimiento.caja_tipo || "—"} · {movimiento.moneda}
                        </div>

                        <div className="truncate text-[10.5px] font-normal text-[#94a3b8]">
                          {movimiento.sucursal || "Sin sucursal"}
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
                          Referencia
                        </div>

                        <div className="truncate text-[12px] font-medium text-[#334155]">
                          {movimiento.referencia_texto ||
                            movimiento.referencia_tipo ||
                            "Sin referencia"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          Origen: {movimiento.origen || "MANUAL"}
                        </div>

                        {movimiento.forma_pago ? (
                          <div className="truncate text-[10.5px] font-normal text-[#94a3b8]">
                            Forma pago: {movimiento.forma_pago}
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
                          Trazabilidad
                        </div>

                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          Vendedor: {movimiento.vendedor_nombre || "—"}
                        </div>

                        <div className="truncate text-[11px] font-medium text-[#475569]">
                          Cliente: {movimiento.cliente_nombre || "—"}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          Registró: {movimiento.created_by_nombre || "—"}
                        </div>
                      </div>

                      <div className="text-right">
                        <div
                          className={[
                            "text-[12px] font-semibold",
                            isIngreso ? "text-emerald-700" : "text-red-700"
                          ].join(" ")}
                        >
                          {formatMoneyAR(Math.abs(signed), movimiento.moneda)}
                        </div>

                        <div className="text-[11px] font-normal text-[#64748b]">
                          {isIngreso ? "Suma" : "Resta"}
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        {!movimiento.anulado ? (
                          <button
                            type="button"
                            onClick={() => handleAnular(movimiento)}
                            disabled={saving}
                            className="h-7 rounded-[9px] border border-red-200 bg-red-50 px-2.5 text-[11px] font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                          >
                            Anular
                          </button>
                        ) : (
                          <div className="text-right text-[10.5px] font-medium text-red-700">
                            {movimiento.motivo_anulacion || "Anulado"}
                            {movimiento.anulado_by_nombre ? (
                              <div className="mt-1 text-[10px] font-normal text-red-500">
                                Por: {movimiento.anulado_by_nombre}
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            {!selectedSaldo ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná una caja.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                      {selectedSaldo.caja_nombre}
                    </h2>

                    <p className="mt-0.5 text-[11.5px] font-normal text-[#64748b]">
                      {selectedSaldo.caja_tipo} · {selectedSaldo.moneda}
                    </p>
                  </div>

                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#eef6f7] text-[#4f7c90] ring-1 ring-[#4f7c90]/15">
                    {selectedSaldo.caja_tipo === "BANCO" ? <Landmark size={17} /> : <Wallet size={17} />}
                  </div>
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Saldo actual</FieldLabel>

                    <div className="truncate text-[23px] font-semibold tracking-tight text-[#172033]">
                      {formatMoneyAR(selectedSaldo.saldo_actual, selectedSaldo.moneda)}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Control</FieldLabel>

                    <div className="flex justify-between gap-3">
                      <span>Último movimiento</span>
                      <strong className="font-semibold">
                        {formatDate(selectedSaldo.ultimo_movimiento_fecha)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Última conciliación</span>
                      <strong className="font-semibold">
                        {formatDate(selectedSaldo.ultima_conciliacion_fecha)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Saldo conciliado</span>
                      <strong className="font-semibold">
                        {selectedSaldo.ultimo_saldo_conciliado === null
                          ? "—"
                          : formatMoneyAR(
                              selectedSaldo.ultimo_saldo_conciliado,
                              selectedSaldo.moneda
                            )}
                      </strong>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => setModalMode("movimiento")}
                      className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                    >
                      Nuevo movimiento
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalMode("pase")}
                      className="h-8 rounded-[10px] border border-sky-200 bg-sky-50 px-4 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
                    >
                      Pase de caja
                    </button>

                    <button
                      type="button"
                      onClick={() => setModalMode("conciliacion")}
                      className="h-8 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Conciliar / ajustar saldo
                    </button>
                  </div>

                  <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-700">
                    Los ajustes y conciliaciones quedan registrados como movimientos para mantener
                    historial.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {modalMode === "movimiento" ? (
        <MovimientoModal
          cajas={cajas}
          selectedCaja={selectedSaldo}
          saving={saving}
          onClose={() => setModalMode(null)}
          onSave={handleSaveMovimiento}
        />
      ) : null}

      {modalMode === "pase" ? (
        <PaseModal
          cajas={cajas}
          saving={saving}
          onClose={() => setModalMode(null)}
          onSave={handleSavePase}
        />
      ) : null}

      {modalMode === "conciliacion" ? (
        <ConciliacionModal
          selectedSaldo={selectedSaldo}
          saving={saving}
          onClose={() => setModalMode(null)}
          onSave={handleSaveConciliacion}
        />
      ) : null}

      <MotivoAnulacionModal
        movimiento={movimientoAnular}
        saving={saving}
        onClose={() => setMovimientoAnular(null)}
        onConfirm={confirmAnularMovimiento}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default CajaPanel;