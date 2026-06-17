// src/components/riesgos/RiesgosPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  Banknote,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Clock3,
  Eye,
  Filter,
  RefreshCcw,
  Search,
  ShieldAlert,
  Wallet,
  X
} from "lucide-react";
import { NosturDateInput } from "../ui/NosturDateInput";
import { formatMoneyAR } from "../../lib/formatters";
import {
  createInitialPagoRiesgoDraft,
  createInitialResolverSinPagoDraft,
  getCajaDisplayName,
  getRiesgoEstadoLabel,
  getRiesgoEstadoTone,
  useRiesgosStore,
  type CajaLite,
  type PagoRiesgoDraft,
  type ResolverSinPagoDraft,
  type RiesgoAlmundo,
  type RiesgoPago
} from "../../store/riesgosStore";

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ModalMode = "pago" | "resolver" | "anular-pago" | null;

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "VENCIDO", label: "Vencidos" },
  { value: "PROXIMO", label: "Próximos" },
  { value: "EN_PLAZO", label: "En plazo" },
  { value: "RESUELTO", label: "Resueltos" }
];

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const FORMA_PAGO_OPTIONS: SelectOption[] = [
  { value: "Transferencia", label: "Transferencia" },
  { value: "Depósito", label: "Depósito" },
  { value: "Efectivo", label: "Efectivo" },
  { value: "Tarjeta", label: "Tarjeta" },
  { value: "Otro", label: "Otro" }
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

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function formatDateTime(value?: string | null): string {
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

function getHoursToDue(value?: string | null): number | null {
  if (!value) return null;

  const due = new Date(value).getTime();
  if (Number.isNaN(due)) return null;

  const diff = due - Date.now();
  return Math.ceil(diff / 1000 / 60 / 60);
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

function EstadoBadge({ estado }: { estado: string }) {
  const tone = getRiesgoEstadoTone(estado);

  const className = {
    ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-sky-200 bg-sky-50 text-sky-700"
  }[tone];

  return (
    <span className={["rounded-md border px-1.5 py-0.5 text-[10px] font-medium", className].join(" ")}>
      {getRiesgoEstadoLabel(estado)}
    </span>
  );
}

function RiesgoCard({
  riesgo,
  selected,
  onSelect,
  onPay
}: {
  riesgo: RiesgoAlmundo;
  selected: boolean;
  onSelect: () => void;
  onPay: () => void;
}) {
  const hours = getHoursToDue(riesgo.vencimiento_at);
  const saldo = parseMoney(riesgo.saldo_riesgo);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition lg:grid-cols-[1.1fr_1fr_1fr_1fr_138px_76px]",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : riesgo.estado_riesgo === "VENCIDO"
            ? "border-red-200 bg-red-50/60 hover:bg-red-50"
            : "border-black/10 bg-[#f8fafc] hover:bg-white"
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-[#172033]">
          {riesgo.numero_carrito}
        </div>
        <div className="truncate text-[11px] font-normal text-[#64748b]">
          {riesgo.pasajero || "Sin pasajero"}
        </div>
        <div className="truncate text-[11px] font-medium text-[#4f7c90]">
          {riesgo.destino || "Sin destino"}
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[#172033]">
          {formatMoneyAR(riesgo.importe_riesgo, riesgo.moneda)}
        </div>
        <div className="text-[11px] font-normal text-[#64748b]">Importe riesgo</div>
        <div className="text-[10.5px] font-normal text-[#94a3b8]">
          Venta: {formatDate(riesgo.fecha_venta)}
        </div>
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-emerald-700">
          {formatMoneyAR(riesgo.total_pagado_riesgo, riesgo.moneda)}
        </div>
        <div className="text-[11px] font-normal text-[#64748b]">Pagado a Almundo</div>
        <div className="text-[10.5px] font-normal text-[#94a3b8]">
          Pagos: {riesgo.cantidad_pagos}
        </div>
      </div>

      <div className="min-w-0">
        <div className={["text-[12px] font-semibold", saldo > 0 ? "text-red-700" : "text-emerald-700"].join(" ")}>
          {formatMoneyAR(riesgo.saldo_riesgo, riesgo.moneda)}
        </div>
        <div className="text-[11px] font-normal text-[#64748b]">Saldo deuda</div>
        <div className="text-[10.5px] font-normal text-[#94a3b8]">
          Últ. pago: {formatDate(riesgo.ultimo_pago_fecha)}
        </div>
      </div>

      <div className="min-w-0">
        <EstadoBadge estado={riesgo.estado_riesgo} />

        <div className="mt-1 truncate text-[10.5px] font-normal text-[#64748b]">
          Vence: {formatDateTime(riesgo.vencimiento_at)}
        </div>

        {hours !== null ? (
          <div
            className={[
              "text-[10.5px] font-medium",
              hours < 0 ? "text-red-700" : hours <= 12 ? "text-amber-700" : "text-[#64748b]"
            ].join(" ")}
          >
            {hours < 0 ? `Vencido hace ${Math.abs(hours)} h` : `Faltan ${hours} h`}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end gap-1">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onSelect();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
          title="Ver detalle"
        >
          <Eye size={14} />
        </button>

        {saldo > 0 ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPay();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#4f7c90] hover:bg-white"
            title="Registrar pago"
          >
            <Banknote size={14} />
          </button>
        ) : null}
      </div>
    </button>
  );
}

function PagoRiesgoModal({
  riesgo,
  cajas,
  saving,
  onClose,
  onSave
}: {
  riesgo: RiesgoAlmundo | null;
  cajas: CajaLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: PagoRiesgoDraft) => Promise<void>;
}) {
  const cajaCompatible = riesgo ? cajas.find((item) => item.moneda === riesgo.moneda) || null : null;

  const [draft, setDraft] = useState<PagoRiesgoDraft>(() =>
    createInitialPagoRiesgoDraft(riesgo, cajaCompatible)
  );

  useEffect(() => {
    setDraft(createInitialPagoRiesgoDraft(riesgo, cajaCompatible));
  }, [riesgo?.carrito_id, cajaCompatible?.id]);

  function setField<K extends keyof PagoRiesgoDraft>(key: K, value: PagoRiesgoDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const cajaOptions: SelectOption[] = cajas
    .filter((caja) => !riesgo || caja.moneda === riesgo.moneda)
    .map((caja) => ({
      value: caja.id,
      label: getCajaDisplayName(caja)
    }));

  const importe = parseMoney(draft.importe);
  const saldo = parseMoney(riesgo?.saldo_riesgo);

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Registrar pago a Almundo</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {riesgo
                ? `Carrito ${riesgo.numero_carrito} · ${riesgo.pasajero || "Sin pasajero"}`
                : "Seleccioná un riesgo"}
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

        {!riesgo ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            No hay riesgo seleccionado.
          </div>
        ) : (
          <>
            <div className="mb-4 grid gap-2.5 md:grid-cols-3">
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Deuda original</FieldLabel>
                <div className="text-[13px] font-semibold text-[#172033]">
                  {formatMoneyAR(riesgo.importe_riesgo, riesgo.moneda)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Ya pagado</FieldLabel>
                <div className="text-[13px] font-semibold text-emerald-700">
                  {formatMoneyAR(riesgo.total_pagado_riesgo, riesgo.moneda)}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Saldo pendiente</FieldLabel>
                <div className="text-[13px] font-semibold text-red-700">
                  {formatMoneyAR(riesgo.saldo_riesgo, riesgo.moneda)}
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
                <FieldLabel>Importe pagado</FieldLabel>
                <TextInput
                  value={draft.importe}
                  onChange={(value) => setField("importe", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Caja desde donde se pagó</FieldLabel>
                <NosturSelect
                  value={draft.caja_id}
                  onChange={(value) => setField("caja_id", value)}
                  options={cajaOptions}
                  placeholder="Seleccionar caja"
                />
              </div>

              <div>
                <FieldLabel>Forma de pago</FieldLabel>
                <NosturSelect
                  value={draft.forma_pago}
                  onChange={(value) => setField("forma_pago", value)}
                  options={FORMA_PAGO_OPTIONS}
                  placeholder="Seleccionar forma"
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Observaciones</FieldLabel>
                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Detalle del pago realizado a Almundo..."
                />
              </div>
            </div>

            <div className="mt-4 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">Saldo luego del pago</span>
                <strong className={saldo - importe <= 0.009 ? "text-emerald-700" : "text-red-700"}>
                  {formatMoneyAR(Math.max(saldo - importe, 0), riesgo.moneda)}
                </strong>
              </div>

              <div className="mt-2 rounded-[12px] border border-amber-200 bg-amber-50 p-3 font-medium text-amber-700">
                Este pago genera un egreso en Caja porque es dinero que NOSSIX le paga a Almundo.
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
            disabled={saving || !riesgo}
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResolverModal({
  riesgo,
  saving,
  onClose,
  onSave
}: {
  riesgo: RiesgoAlmundo | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ResolverSinPagoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ResolverSinPagoDraft>(() =>
    createInitialResolverSinPagoDraft(riesgo)
  );

  useEffect(() => {
    setDraft(createInitialResolverSinPagoDraft(riesgo));
  }, [riesgo?.carrito_id]);

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Resolver sin pago</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {riesgo ? `Carrito ${riesgo.numero_carrito}` : "Seleccioná un riesgo"}
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

        <div className="mb-4 rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[12px] font-medium text-amber-700">
          Esta acción no afecta Caja. Usarla solo para correcciones administrativas, cancelaciones o ajustes especiales.
        </div>

        <FieldLabel>Observación obligatoria</FieldLabel>
        <TextArea
          value={draft.observaciones}
          onChange={(value) => setDraft((current) => ({ ...current, observaciones: value }))}
          placeholder="Explicá por qué se resuelve sin pago..."
        />

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
            disabled={saving || !riesgo}
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-sky-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-sky-800 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Resolver"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AnularPagoModal({
  pago,
  saving,
  onClose,
  onSave
}: {
  pago: RiesgoPago | null;
  saving: boolean;
  onClose: () => void;
  onSave: (pago: RiesgoPago, motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");

  useEffect(() => {
    setMotivo("");
  }, [pago?.id]);

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Anular pago de riesgo</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {pago
                ? `${formatMoneyAR(pago.importe, pago.moneda)} · ${pago.numero_carrito || "Sin carrito"}`
                : "Seleccioná un pago"}
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

        <div className="mb-4 rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
          Esta acción anula el pago y también anula el egreso de Caja asociado.
        </div>

        <FieldLabel>Motivo de anulación</FieldLabel>
        <TextArea
          value={motivo}
          onChange={setMotivo}
          placeholder="Indicá el motivo..."
        />

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
            disabled={saving || !pago || motivo.trim().length === 0}
            onClick={() => {
              if (pago) onSave(pago, motivo.trim());
            }}
            className="h-8 rounded-[10px] bg-red-600 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Anulando..." : "Anular pago"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function RiesgosPanel() {
  const loading = useRiesgosStore((state) => state.loading);
  const saving = useRiesgosStore((state) => state.saving);
  const error = useRiesgosStore((state) => state.error);
  const currentProfile = useRiesgosStore((state) => state.currentProfile);
  const canManageRiesgos = useRiesgosStore((state) => state.canManageRiesgos);
  const filters = useRiesgosStore((state) => state.filters);
  const catalogos = useRiesgosStore((state) => state.catalogos);
  const selectedRiesgoId = useRiesgosStore((state) => state.selectedRiesgoId);

  const loadRiesgos = useRiesgosStore((state) => state.loadRiesgos);
  const registrarPago = useRiesgosStore((state) => state.registrarPago);
  const anularPago = useRiesgosStore((state) => state.anularPago);
  const resolverSinPago = useRiesgosStore((state) => state.resolverSinPago);
  const setFilter = useRiesgosStore((state) => state.setFilter);
  const resetFilters = useRiesgosStore((state) => state.resetFilters);
  const selectRiesgo = useRiesgosStore((state) => state.selectRiesgo);
  const clearError = useRiesgosStore((state) => state.clearError);

  const getFilteredRiesgos = useRiesgosStore((state) => state.getFilteredRiesgos);
  const getSelectedRiesgo = useRiesgosStore((state) => state.getSelectedRiesgo);
  const getPagosBySelected = useRiesgosStore((state) => state.getPagosBySelected);
  const getMetrics = useRiesgosStore((state) => state.getMetrics);

  const riesgos = getFilteredRiesgos();

  const selectedRiesgo = useMemo(
    () => getSelectedRiesgo(),
    [riesgos, selectedRiesgoId, getSelectedRiesgo]
  );

  const pagosSelected = getPagosBySelected();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [pagoToAnular, setPagoToAnular] = useState<RiesgoPago | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    loadRiesgos();
  }, [loadRiesgos]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  async function handleRegistrarPago(draft: PagoRiesgoDraft) {
    const ok = await registrarPago(draft);

    if (ok) {
      setModalMode(null);
      showToast("Pago a Almundo registrado. Se generó egreso en Caja.");
    }
  }

  async function handleResolverSinPago(draft: ResolverSinPagoDraft) {
    const ok = await resolverSinPago(draft);

    if (ok) {
      setModalMode(null);
      showToast("Riesgo resuelto sin movimiento de Caja.");
    }
  }

  async function handleAnularPago(pago: RiesgoPago, motivo: string) {
    const ok = await anularPago(pago, motivo);

    if (ok) {
      setPagoToAnular(null);
      setModalMode(null);
      showToast("Pago anulado correctamente.");
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
                Riesgos Almundo
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Deuda con Almundo
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManageRiesgos
                ? "Control de pagos a Almundo por carritos impactados a riesgo."
                : `Riesgos de ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={loadRiesgos}
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
                  {filters.desde || filters.hasta
                    ? `${filters.desde || "Inicio"} → ${filters.hasta || "Hoy"}`
                    : "Todas las fechas"}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Estado: {filters.estado} · Moneda: {filters.moneda} · Resueltos:{" "}
                {filters.incluirResueltos ? "Sí" : "No"}
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
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1.2fr_150px_140px_1fr_1fr_130px]">
                <div className="grid grid-cols-2 gap-2 rounded-[14px] border border-[#4f7c90]/20 bg-white/70 p-2">
                  <div>
                    <FieldLabel>Desde</FieldLabel>
                    <NosturDateInput
                      value={filters.desde}
                      onChange={(value) => {
                        setFilter("desde", value);

                        if (filters.hasta && value && filters.hasta < value) {
                          setFilter("hasta", value);
                        }
                      }}
                    />
                  </div>

                  <div>
                    <FieldLabel>Hasta</FieldLabel>
                    <NosturDateInput
                      value={filters.hasta}
                      onChange={(value) => setFilter("hasta", value)}
                      min={filters.desde}
                    />
                  </div>
                </div>

                <div>
                  <FieldLabel>Estado</FieldLabel>
                  <NosturSelect
                    value={filters.estado}
                    onChange={(value) => setFilter("estado", value as typeof filters.estado)}
                    options={ESTADO_OPTIONS}
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

                <div>
                  <FieldLabel>Resueltos</FieldLabel>
                  <button
                    type="button"
                    onClick={() => setFilter("incluirResueltos", !filters.incluirResueltos)}
                    className={[
                      "h-8 w-full rounded-[10px] border px-3 text-[12px] font-medium transition",
                      filters.incluirResueltos
                        ? "border-[#4f7c90]/30 bg-[#eef6f7] text-[#172033]"
                        : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
                    ].join(" ")}
                  >
                    {filters.incluirResueltos ? "Incluidos" : "Ocultos"}
                  </button>
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por carrito, pasajero, destino, vendedor..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadRiesgos}
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
          <MetricCard label="Activos" value={metrics.activos} icon={ShieldAlert} />
          <MetricCard label="Vencidos" value={metrics.vencidos} icon={AlertTriangle} tone="red" />
          <MetricCard label="Próximos" value={metrics.proximos} icon={Clock3} tone="amber" />
          <MetricCard label="En plazo" value={metrics.enPlazo} icon={CheckCircle2} tone="green" />
          <MetricCard label="Saldo ARS" value={formatMoneyAR(metrics.saldoArs, "ARS")} icon={Wallet} tone="blue" />
          <MetricCard label="Saldo USD" value={formatMoneyAR(metrics.saldoUsd, "USD")} icon={Wallet} tone="green" />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_370px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Riesgos activos</h2>
                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${riesgos.length} riesgos encontrados`}
                </p>
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando riesgos...
              </div>
            ) : riesgos.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay riesgos para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {riesgos.map((riesgo) => (
                  <RiesgoCard
                    key={riesgo.carrito_id}
                    riesgo={riesgo}
                    selected={selectedRiesgo?.carrito_id === riesgo.carrito_id}
                    onSelect={() => selectRiesgo(riesgo.carrito_id)}
                    onPay={() => {
                      selectRiesgo(riesgo.carrito_id);
                      setModalMode("pago");
                    }}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            {!selectedRiesgo ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná un riesgo.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                      {selectedRiesgo.numero_carrito}
                    </h2>
                    <p className="mt-0.5 truncate text-[11.5px] font-normal text-[#64748b]">
                      {selectedRiesgo.pasajero || "Sin pasajero"}
                    </p>
                  </div>

                  <EstadoBadge estado={selectedRiesgo.estado_riesgo} />
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Deuda con Almundo</FieldLabel>

                    <div className="flex justify-between gap-3">
                      <span>Importe riesgo</span>
                      <strong className="font-semibold">
                        {formatMoneyAR(selectedRiesgo.importe_riesgo, selectedRiesgo.moneda)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Pagado</span>
                      <strong className="font-semibold text-emerald-700">
                        {formatMoneyAR(selectedRiesgo.total_pagado_riesgo, selectedRiesgo.moneda)}
                      </strong>
                    </div>

                    <div className="mt-2 flex justify-between gap-3 border-t border-black/10 pt-2">
                      <span className="font-semibold text-[#172033]">Saldo</span>
                      <strong
                        className={[
                          "font-semibold",
                          parseMoney(selectedRiesgo.saldo_riesgo) > 0
                            ? "text-red-700"
                            : "text-emerald-700"
                        ].join(" ")}
                      >
                        {formatMoneyAR(selectedRiesgo.saldo_riesgo, selectedRiesgo.moneda)}
                      </strong>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Control 48 hs</FieldLabel>

                    <div className="flex justify-between gap-3">
                      <span>Creado</span>
                      <strong className="font-semibold">{formatDateTime(selectedRiesgo.carrito_created_at)}</strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Vencimiento</span>
                      <strong className="font-semibold">{formatDateTime(selectedRiesgo.vencimiento_at)}</strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Último pago</span>
                      <strong className="font-semibold">{formatDate(selectedRiesgo.ultimo_pago_fecha)}</strong>
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Viaje</FieldLabel>

                    <div className="font-semibold text-[#172033]">
                      {selectedRiesgo.destino || "Sin destino"}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {formatDate(selectedRiesgo.fecha_in)} →{" "}
                      {selectedRiesgo.solo_ida ? "Solo ida" : formatDate(selectedRiesgo.fecha_out)}
                    </div>

                    <div className="font-normal text-[#64748b]">
                      {selectedRiesgo.servicio || "Sin servicio"}
                    </div>
                  </div>

                  {selectedRiesgo.riesgo_motivo ? (
                    <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 font-medium text-amber-700">
                      {selectedRiesgo.riesgo_motivo}
                    </div>
                  ) : null}

                  <div className="grid gap-2">
                    {parseMoney(selectedRiesgo.saldo_riesgo) > 0 ? (
                      <button
                        type="button"
                        onClick={() => setModalMode("pago")}
                        className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                      >
                        Registrar pago a Almundo
                      </button>
                    ) : null}

                    {selectedRiesgo.estado_riesgo !== "RESUELTO" ? (
                      <button
                        type="button"
                        onClick={() => setModalMode("resolver")}
                        className="h-8 rounded-[10px] border border-sky-200 bg-sky-50 px-4 text-[12px] font-medium text-sky-700 hover:bg-sky-100"
                      >
                        Resolver sin pago
                      </button>
                    ) : null}
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-white p-3">
                    <FieldLabel>Pagos registrados</FieldLabel>

                    {pagosSelected.length === 0 ? (
                      <div className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-3 text-center text-[#64748b]">
                        Sin pagos cargados.
                      </div>
                    ) : (
                      <div className="grid max-h-[260px] gap-1.5 overflow-auto pr-1">
                        {pagosSelected.map((pago) => (
                          <div
                            key={pago.id}
                            className={[
                              "rounded-[12px] border p-2",
                              pago.anulado ? "border-red-200 bg-red-50" : "border-black/10 bg-[#f8fafc]"
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <div className="font-semibold text-[#172033]">
                                  {formatMoneyAR(pago.importe, pago.moneda)}
                                </div>
                                <div className="text-[11px] font-normal text-[#64748b]">
                                  {formatDate(pago.fecha_pago)} · {pago.caja_nombre || "Sin caja"}
                                </div>
                                <div className="text-[11px] font-normal text-[#64748b]">
                                  {pago.forma_pago}
                                </div>
                              </div>

                              {!pago.anulado ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPagoToAnular(pago);
                                    setModalMode("anular-pago");
                                  }}
                                  className="h-7 rounded-[9px] border border-red-200 bg-red-50 px-2 text-[10.5px] font-medium text-red-700 hover:bg-red-100"
                                >
                                  Anular
                                </button>
                              ) : (
                                <span className="rounded-[9px] border border-red-200 bg-red-100 px-2 py-1 text-[10px] font-medium text-red-700">
                                  Anulado
                                </span>
                              )}
                            </div>

                            {pago.observaciones ? (
                              <div className="mt-1 text-[11px] font-normal text-[#64748b]">
                                {pago.observaciones}
                              </div>
                            ) : null}

                            {pago.motivo_anulacion ? (
                              <div className="mt-1 text-[11px] font-medium text-red-700">
                                {pago.motivo_anulacion}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-700">
                    El carrito sigue visible en Carritos. Esta pantalla controla la deuda de NOSSIX con Almundo.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {modalMode === "pago" ? (
        <PagoRiesgoModal
          riesgo={selectedRiesgo}
          cajas={catalogos.cajas}
          saving={saving}
          onClose={() => setModalMode(null)}
          onSave={handleRegistrarPago}
        />
      ) : null}

      {modalMode === "resolver" ? (
        <ResolverModal
          riesgo={selectedRiesgo}
          saving={saving}
          onClose={() => setModalMode(null)}
          onSave={handleResolverSinPago}
        />
      ) : null}

      {modalMode === "anular-pago" ? (
        <AnularPagoModal
          pago={pagoToAnular}
          saving={saving}
          onClose={() => {
            setPagoToAnular(null);
            setModalMode(null);
          }}
          onSave={handleAnularPago}
        />
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default RiesgosPanel;