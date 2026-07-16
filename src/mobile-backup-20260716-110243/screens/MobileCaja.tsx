// src/mobile/screens/MobileCaja.tsx

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Edit3,
  Eye,
  Landmark,
  Loader2,
  Plus,
  RefreshCcw,
  Search,
  ToggleLeft,
  ToggleRight,
  Trash2,
  Wallet,
  X
} from "lucide-react";
import {
  createInitialMovimientoDraft,
  createInitialPaseCajaDraft,
  getCajaDisplayName,
  useCajaStore,
  type CajaLite,
  type CajaMobileDraft,
  type CajaMovimiento,
  type CajaSaldo,
  type MovimientoDraft,
  type MovimientoMobileUpdateInput,
  type PaseCajaDraft
} from "../../store/cajaStore";
import { NosturDateInput } from "../../components/ui/NosturDateInput";
import { formatMoneyAR } from "../../lib/formatters";
import { supabase } from "../../lib/supabase";

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ModalMode = "movimiento" | "pase" | "caja" | null;

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const MONEDA_EDIT_OPTIONS: SelectOption[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

const CAJA_TIPO_OPTIONS: SelectOption[] = [
  { value: "CAJA", label: "Caja" },
  { value: "BANCO", label: "Banco" },
  { value: "BILLETERA", label: "Billetera" },
  { value: "OTRA", label: "Otra" }
];

const MOVIMIENTO_TIPO_OPTIONS: SelectOption[] = [
  { value: "INGRESO", label: "Ingreso" },
  { value: "EGRESO", label: "Egreso" }
];

const TIPO_FILTER_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "INGRESO", label: "Ingresos" },
  { value: "EGRESO", label: "Egresos" },
  { value: "PASE_INGRESO", label: "Pases +" },
  { value: "PASE_EGRESO", label: "Pases -" },
  { value: "CONCILIACION", label: "Conciliación" }
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

function moneyInputValue(value: string | number | null | undefined): string {
  const number = parseMoney(value);
  if (!number) return "";
  return String(number).replace(".", ",");
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

function getMonthStart(): string {
  const today = getToday();
  return `${today.slice(0, 7)}-01`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getMovimientoSign(movimiento: CajaMovimiento): number {
  return parseMoney(movimiento.importe_con_signo);
}

function getMovimientoTone(movimiento: CajaMovimiento): string {
  if (movimiento.anulado) return "bg-red-100 text-red-700";
  return getMovimientoSign(movimiento) >= 0
    ? "bg-emerald-100 text-emerald-700"
    : "bg-amber-100 text-amber-700";
}

function getMovimientoLabel(movimiento: CajaMovimiento): string {
  if (movimiento.anulado) return "Anulado";
  return getMovimientoSign(movimiento) >= 0 ? "Ingreso" : "Egreso";
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[9px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
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
      className="h-9 w-full rounded-2xl border border-black/10 bg-[#f8fafc] px-3 text-[12px] font-medium text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-nostur-orange"
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
      className="min-h-[72px] w-full resize-none rounded-2xl border border-black/10 bg-[#f8fafc] px-3 py-2 text-[12px] font-medium leading-relaxed text-[#111827] outline-none placeholder:text-[#94a3b8] focus:border-nostur-orange"
    />
  );
}

function MobileSelect({
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
    <div className={["relative", open ? "z-[240]" : "z-0"].join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-2xl border border-black/10 bg-[#f8fafc] px-3 text-left text-[12px] font-medium text-[#111827]"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={13}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[220] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
          />

          <div className="absolute left-0 right-0 top-[40px] z-[230] max-h-64 overflow-auto rounded-2xl border border-black/10 bg-white p-1.5 shadow-2xl">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={[
                  "flex min-h-8 w-full items-center rounded-xl px-3 text-left text-[11px] font-semibold",
                  option.value === value
                    ? "bg-nostur-orange text-white"
                    : "text-[#334155] hover:bg-[#f1f5f9]"
                ].join(" ")}
              >
                {option.label}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  return (
    <div className="fixed left-3 right-3 top-3 z-[300] rounded-[22px] border border-black/10 bg-white p-3 shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={[
              "text-[12px] font-semibold leading-tight",
              toast.type === "success" ? "text-emerald-700" : "text-red-700"
            ].join(" ")}
          >
            {toast.type === "success" ? "Listo" : "Atención"}
          </div>

          <div className="mt-0.5 text-[11px] font-normal leading-snug text-[#475569]">
            {toast.message}
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#f1f5f9] text-[#64748b]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function SectionCard({
  title,
  children
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[22px] border border-black/10 bg-white/86 p-3 shadow-sm backdrop-blur-xl">
      <h3 className="mb-2 text-[13px] font-semibold leading-tight text-[#111827]">{title}</h3>
      {children}
    </section>
  );
}

function BalanceCard({
  label,
  value,
  moneda,
  icon,
  tone = "orange"
}: {
  label: string;
  value: number | string;
  moneda: string;
  icon: React.ReactNode;
  tone?: "orange" | "green" | "blue";
}) {
  const toneClass = {
    orange: "bg-nostur-orange/10 text-nostur-orange",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700"
  }[tone];

  return (
    <div className="rounded-[22px] border border-black/10 bg-white/86 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="truncate text-[10px] font-medium text-[#64748b]">{label}</div>

        <div className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", toneClass].join(" ")}>
          {icon}
        </div>
      </div>

      <div className="truncate text-[17px] font-semibold leading-tight text-[#111827]">
        {formatMoneyAR(value, moneda)}
      </div>
    </div>
  );
}

function CajaSaldoCard({
  saldo,
  selected,
  onSelect,
  onEdit,
  onToggle
}: {
  saldo: CajaSaldo;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const active = Boolean(saldo.activa && saldo.activo);

  return (
    <article
      className={[
        "rounded-[24px] border p-3 shadow-sm backdrop-blur-xl transition",
        selected ? "border-nostur-orange/45 bg-nostur-orange/10" : "border-black/10 bg-white/86",
        !active ? "opacity-60" : ""
      ].join(" ")}
    >
      <button type="button" onClick={onSelect} className="w-full text-left">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
              {saldo.caja_nombre}
            </div>

            <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#64748b]">
              {saldo.caja_tipo} · {saldo.moneda}
            </div>
          </div>

          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white text-nostur-orange shadow-sm ring-1 ring-black/10">
            {saldo.caja_tipo === "BANCO" ? <Landmark size={16} /> : <Wallet size={16} />}
          </div>
        </div>

        <div className="mt-3 truncate text-[18px] font-semibold leading-tight text-[#111827]">
          {formatMoneyAR(saldo.saldo_actual, saldo.moneda)}
        </div>

        <div className="mt-1 text-[10.5px] font-normal text-[#94a3b8]">
          Últ. mov.: {formatDate(saldo.ultimo_movimiento_fecha)}
        </div>
      </button>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="h-8 rounded-2xl border border-black/10 bg-white text-[11px] font-semibold text-[#334155]"
        >
          Editar
        </button>

        <button
          type="button"
          onClick={onToggle}
          className={[
            "flex h-8 items-center justify-center gap-1 rounded-2xl text-[11px] font-semibold",
            active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
          ].join(" ")}
        >
          {active ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
          {active ? "Activa" : "Inactiva"}
        </button>
      </div>
    </article>
  );
}

function MovimientoRow({
  movimiento,
  onView,
  onEdit,
  onAnular
}: {
  movimiento: CajaMovimiento;
  onView: () => void;
  onEdit: () => void;
  onAnular: () => void;
}) {
  const signed = getMovimientoSign(movimiento);
  const canEdit = movimiento.origen === "MANUAL" && !movimiento.anulado && !movimiento.pase_grupo_id;

  return (
    <article
      className={[
        "rounded-[22px] border bg-white/86 p-3 shadow-sm backdrop-blur-xl",
        movimiento.anulado ? "border-red-200 bg-red-50/80" : "border-black/10"
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
            <span
              className={[
                "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                getMovimientoTone(movimiento)
              ].join(" ")}
            >
              {getMovimientoLabel(movimiento)}
            </span>

            <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9px] font-semibold text-[#64748b]">
              {formatDate(movimiento.fecha)}
            </span>
          </div>

          <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
            {movimiento.descripcion || "Sin descripción"}
          </div>

          <div className="truncate text-[11px] font-normal leading-tight text-[#64748b]">
            {movimiento.caja_nombre || "Sin caja"} · {movimiento.categoria || "Sin categoría"}
          </div>

          {movimiento.referencia_texto ? (
            <div className="truncate text-[10px] font-normal text-[#94a3b8]">
              Ref.: {movimiento.referencia_texto}
            </div>
          ) : null}
        </div>

        <div className="shrink-0 text-right">
          <div
            className={[
              "text-[12px] font-semibold leading-tight",
              signed >= 0 ? "text-emerald-700" : "text-red-700"
            ].join(" ")}
          >
            {signed >= 0 ? "+" : "-"}
            {formatMoneyAR(Math.abs(signed), movimiento.moneda)}
          </div>

          <div className="text-[9px] font-medium text-[#94a3b8]">{movimiento.moneda}</div>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onView}
          className="flex h-8 items-center justify-center gap-1 rounded-2xl bg-[#f8fafc] text-[11px] font-semibold text-[#64748b]"
        >
          <Eye size={13} />
          Ver
        </button>

        <button
          type="button"
          onClick={onEdit}
          disabled={!canEdit}
          className="flex h-8 items-center justify-center gap-1 rounded-2xl bg-nostur-orange/10 text-[11px] font-semibold text-nostur-orange disabled:opacity-40"
        >
          <Edit3 size={13} />
          Editar
        </button>

        <button
          type="button"
          onClick={onAnular}
          disabled={movimiento.anulado}
          className="flex h-8 items-center justify-center gap-1 rounded-2xl bg-red-50 text-[11px] font-semibold text-red-700 disabled:opacity-40"
        >
          <Trash2 size={13} />
          Anular
        </button>
      </div>
    </article>
  );
}

function MovimientoModal({
  title,
  cajas,
  saving,
  initialDraft,
  onClose,
  onSave
}: {
  title: string;
  cajas: CajaLite[];
  saving: boolean;
  initialDraft: MovimientoDraft;
  onClose: () => void;
  onSave: (draft: MovimientoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MovimientoDraft>(initialDraft);

  function setField<K extends keyof MovimientoDraft>(key: K, value: MovimientoDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  const cajaOptions = cajas
    .filter((caja) => caja.activa && caja.activo)
    .map((caja) => ({
      value: caja.id,
      label: getCajaDisplayName(caja)
    }));

  return (
    <div className="fixed inset-0 z-[210] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full overflow-auto rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2.5 border-b border-black/10 bg-white/95 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-nostur-orange">
                Caja
              </div>

              <h2 className="text-[17px] font-semibold leading-tight text-[#111827]">{title}</h2>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="space-y-2.5 pb-20">
          <SectionCard title="Datos del movimiento">
            <div className="grid gap-2.5">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Fecha</FieldLabel>
                  <NosturDateInput value={draft.fecha} onChange={(value) => setField("fecha", value)} />
                </div>

                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <MobileSelect
                    value={draft.tipo}
                    onChange={(value) => setField("tipo", value as MovimientoDraft["tipo"])}
                    options={MOVIMIENTO_TIPO_OPTIONS}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Caja</FieldLabel>
                <MobileSelect
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
                <MobileSelect
                  value={draft.categoria}
                  onChange={(value) => setField("categoria", value)}
                  options={CATEGORIA_OPTIONS}
                  placeholder="Categoría"
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
                  placeholder="Efectivo, transferencia..."
                />
              </div>

              <div>
                <FieldLabel>Referencia</FieldLabel>
                <TextInput
                  value={draft.referencia_texto}
                  onChange={(value) => setField("referencia_texto", value)}
                  placeholder="Comprobante, recibo..."
                />
              </div>

              <div>
                <FieldLabel>Observaciones</FieldLabel>
                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Observaciones"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-[230] border-t border-black/10 bg-white/95 p-2.5 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-2xl border border-black/10 bg-white text-[12px] font-semibold text-[#64748b]"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={saving}
              className="h-10 rounded-2xl bg-nostur-orange text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
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

  const cajaOptions = cajas
    .filter((caja) => caja.activa && caja.activo)
    .map((caja) => ({
      value: caja.id,
      label: getCajaDisplayName(caja)
    }));

  return (
    <div className="fixed inset-0 z-[210] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-sky-700">
              Pase interno
            </div>

            <h2 className="text-[17px] font-semibold leading-tight text-[#111827]">Pase de caja</h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-2.5 pb-20">
          <SectionCard title="Datos del pase">
            <div className="grid gap-2.5">
              <div className="grid grid-cols-2 gap-2">
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
              </div>

              <div>
                <FieldLabel>Caja origen</FieldLabel>
                <MobileSelect
                  value={draft.caja_origen_id}
                  onChange={(value) => setField("caja_origen_id", value)}
                  options={cajaOptions}
                  placeholder="Origen"
                />
              </div>

              <div>
                <FieldLabel>Caja destino</FieldLabel>
                <MobileSelect
                  value={draft.caja_destino_id}
                  onChange={(value) => setField("caja_destino_id", value)}
                  options={cajaOptions}
                  placeholder="Destino"
                />
              </div>

              <div>
                <FieldLabel>Descripción</FieldLabel>
                <TextInput
                  value={draft.descripcion}
                  onChange={(value) => setField("descripcion", value)}
                  placeholder="Ej: pase de efectivo a banco"
                />
              </div>
            </div>
          </SectionCard>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-[230] border-t border-black/10 bg-white/95 p-2.5 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-2xl border border-black/10 bg-white text-[12px] font-semibold text-[#64748b]"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={saving}
              className="h-10 rounded-2xl bg-sky-700 text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Crear pase"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CajaEditModal({
  caja,
  saving,
  onClose,
  onSave
}: {
  caja: CajaLite | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: CajaMobileDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CajaMobileDraft>(() => ({
    id: caja?.id,
    nombre: caja?.nombre || "",
    moneda: caja?.moneda || "ARS",
    tipo: caja?.tipo || "CAJA",
    sucursal_id: caja?.sucursal_id || null,
    descripcion: caja?.descripcion || "",
    activa: caja ? Boolean(caja.activa) : true,
    activo: caja ? Boolean(caja.activo) : true,
    orden: caja?.orden || 0
  }));

  function update<K extends keyof CajaMobileDraft>(key: K, value: CajaMobileDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-nostur-orange">
              Caja
            </div>

            <h2 className="text-[17px] font-semibold leading-tight text-[#111827]">
              {caja ? "Editar caja" : "Nueva caja"}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="space-y-2.5 pb-20">
          <SectionCard title="Datos de la caja">
            <div className="grid gap-2.5">
              <div>
                <FieldLabel>Nombre</FieldLabel>
                <TextInput
                  value={draft.nombre}
                  onChange={(value) => update("nombre", value)}
                  placeholder="Caja pesos, Banco USD..."
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <FieldLabel>Moneda</FieldLabel>
                  <MobileSelect
                    value={draft.moneda}
                    onChange={(value) => update("moneda", value)}
                    options={MONEDA_EDIT_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <MobileSelect
                    value={draft.tipo}
                    onChange={(value) => update("tipo", value)}
                    options={CAJA_TIPO_OPTIONS}
                  />
                </div>
              </div>

              <div>
                <FieldLabel>Orden</FieldLabel>
                <TextInput
                  value={String(draft.orden || "")}
                  onChange={(value) => update("orden", Number(value.replace(/\D/g, "")) || 0)}
                  inputMode="numeric"
                  placeholder="0"
                />
              </div>

              <div>
                <FieldLabel>Descripción</FieldLabel>
                <TextArea
                  value={draft.descripcion || ""}
                  onChange={(value) => update("descripcion", value)}
                  placeholder="Uso interno de la caja"
                />
              </div>

              <button
                type="button"
                onClick={() => {
                  const next = !(draft.activa && draft.activo);
                  update("activa", next);
                  update("activo", next);
                }}
                className={[
                  "flex h-9 items-center justify-center gap-1.5 rounded-2xl border text-[11px] font-semibold",
                  draft.activa && draft.activo
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-100 text-slate-600"
                ].join(" ")}
              >
                {draft.activa && draft.activo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                {draft.activa && draft.activo ? "Caja activa" : "Caja inactiva"}
              </button>
            </div>
          </SectionCard>
        </div>

        <div className="fixed bottom-0 left-0 right-0 z-[230] border-t border-black/10 bg-white/95 p-2.5 backdrop-blur-xl">
          <div className="mx-auto grid max-w-md grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="h-10 rounded-2xl border border-black/10 bg-white text-[12px] font-semibold text-[#64748b]"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={() => onSave(draft)}
              disabled={saving}
              className="h-10 rounded-2xl bg-nostur-orange text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MovimientoViewModal({
  movimiento,
  onClose
}: {
  movimiento: CajaMovimiento;
  onClose: () => void;
}) {
  const signed = getMovimientoSign(movimiento);

  return (
    <div className="fixed inset-0 z-[210] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-nostur-orange">
              Movimiento
            </div>

            <h2 className="truncate text-[17px] font-semibold leading-tight text-[#111827]">
              {movimiento.descripcion || "Sin descripción"}
            </h2>

            <p className="text-[11px] font-normal leading-tight text-[#64748b]">
              {formatDate(movimiento.fecha)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-[#f8fafc] p-2.5">
            <FieldLabel>Caja</FieldLabel>
            <div className="truncate text-[11px] font-semibold text-[#111827]">
              {movimiento.caja_nombre || "—"}
            </div>
          </div>

          <div className="rounded-2xl bg-[#f8fafc] p-2.5">
            <FieldLabel>Tipo</FieldLabel>
            <div className="truncate text-[11px] font-semibold text-[#111827]">{movimiento.tipo}</div>
          </div>

          <div className="rounded-2xl bg-[#f8fafc] p-2.5">
            <FieldLabel>Categoría</FieldLabel>
            <div className="truncate text-[11px] font-semibold text-[#111827]">
              {movimiento.categoria || "—"}
            </div>
          </div>

          <div className="rounded-2xl bg-[#f8fafc] p-2.5">
            <FieldLabel>Importe</FieldLabel>
            <div
              className={[
                "truncate text-[11px] font-semibold",
                signed >= 0 ? "text-emerald-700" : "text-red-700"
              ].join(" ")}
            >
              {signed >= 0 ? "+" : "-"}
              {formatMoneyAR(Math.abs(signed), movimiento.moneda)}
            </div>
          </div>
        </div>

        <div className="mt-2.5 rounded-2xl bg-[#f8fafc] p-2.5">
          <FieldLabel>Referencia</FieldLabel>
          <div className="text-[11px] font-normal leading-snug text-[#475569]">
            {movimiento.referencia_texto || movimiento.referencia_tipo || "—"}
          </div>
        </div>

        <div className="mt-2.5 rounded-2xl bg-[#f8fafc] p-2.5">
          <FieldLabel>Observaciones</FieldLabel>
          <div className="whitespace-pre-wrap text-[11px] font-normal leading-snug text-[#475569]">
            {movimiento.observaciones || "—"}
          </div>
        </div>

        {movimiento.anulado ? (
          <div className="mt-2.5 rounded-2xl border border-red-200 bg-red-50 p-2.5 text-[11px] font-medium leading-snug text-red-700">
            Anulado: {movimiento.motivo_anulacion || "Sin motivo"}
          </div>
        ) : null}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 h-10 w-full rounded-2xl bg-[#172033] text-[12px] font-semibold text-white"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

function AnularModal({
  movimiento,
  saving,
  onClose,
  onConfirm
}: {
  movimiento: CajaMovimiento;
  saving: boolean;
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState("");

  return (
    <div className="fixed inset-0 z-[240] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="w-full rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-red-700">
              Anular
            </div>

            <h2 className="text-[17px] font-semibold leading-tight text-[#111827]">
              Anular movimiento
            </h2>

            <p className="text-[11px] font-normal leading-tight text-[#64748b]">
              {movimiento.descripcion}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
          >
            <X size={15} />
          </button>
        </div>

        <div>
          <FieldLabel>Motivo</FieldLabel>
          <TextArea
            value={motivo}
            onChange={setMotivo}
            placeholder="Ej: error de carga, duplicado..."
          />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-10 rounded-2xl border border-black/10 bg-white text-[12px] font-semibold text-[#64748b]"
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={() => onConfirm(motivo)}
            disabled={saving || !motivo.trim()}
            className="h-10 rounded-2xl bg-red-600 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            {saving ? "Anulando..." : "Anular"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function MobileCaja() {
  const loading = useCajaStore((state) => state.loading);
  const saving = useCajaStore((state) => state.saving);
  const error = useCajaStore((state) => state.error);
  const cajas = useCajaStore((state) => state.cajas);
  const saldos = useCajaStore((state) => state.saldos);
  const filters = useCajaStore((state) => state.filters);
  const selectedCajaId = useCajaStore((state) => state.selectedCajaId);

  const loadCaja = useCajaStore((state) => state.loadCaja);
  const saveMovimiento = useCajaStore((state) => state.saveMovimiento);
  const savePaseCaja = useCajaStore((state) => state.savePaseCaja);
  const saveCajaMobile = useCajaStore((state) => state.saveCajaMobile);
  const toggleCajaActiva = useCajaStore((state) => state.toggleCajaActiva);
  const updateMovimientoMobile = useCajaStore((state) => state.updateMovimientoMobile);
  const anularMovimiento = useCajaStore((state) => state.anularMovimiento);
  const setFilter = useCajaStore((state) => state.setFilter);
  const clearError = useCajaStore((state) => state.clearError);
  const selectCaja = useCajaStore((state) => state.selectCaja);
  const getFilteredMovimientos = useCajaStore((state) => state.getFilteredMovimientos);
  const getMetrics = useCajaStore((state) => state.getMetrics);

  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editCaja, setEditCaja] = useState<CajaLite | null>(null);
  const [viewMovimiento, setViewMovimiento] = useState<CajaMovimiento | null>(null);
  const [editMovimiento, setEditMovimiento] = useState<CajaMovimiento | null>(null);
  const [anularTarget, setAnularTarget] = useState<CajaMovimiento | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const metrics = getMetrics();
  const movimientos = getFilteredMovimientos();

  const selectedSaldo = useMemo(() => {
    if (!selectedCajaId) return saldos[0] || null;
    return saldos.find((saldo) => saldo.caja_id === selectedCajaId) || saldos[0] || null;
  }, [saldos, selectedCajaId]);

  const cajaOptions = useMemo<SelectOption[]>(() => {
    return [
      { value: "todos", label: "Todas" },
      ...cajas.map((caja) => ({
        value: caja.id,
        label: getCajaDisplayName(caja)
      }))
    ];
  }, [cajas]);

  const visibles = useMemo(() => {
    const q = normalizeText(filters.search);

    if (!q) return movimientos;

    return movimientos.filter((movimiento) => {
      const haystack = normalizeText(
        [
          movimiento.descripcion,
          movimiento.categoria,
          movimiento.caja_nombre,
          movimiento.moneda,
          movimiento.referencia_texto,
          movimiento.forma_pago,
          movimiento.observaciones,
          movimiento.cliente_nombre,
          movimiento.vendedor_nombre
        ].join(" ")
      );

      return haystack.includes(q);
    });
  }, [filters.search, movimientos]);

  useEffect(() => {
    void loadCaja();
  }, [loadCaja]);

  useEffect(() => {
    const channel = supabase
      .channel(`mobile-caja-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "cajas"
        },
        () => {
          void loadCaja();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "caja_movimientos"
        },
        () => {
          void loadCaja();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCaja]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
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
      showToast("Pase creado correctamente.");
    }
  }

  async function handleSaveCaja(draft: CajaMobileDraft) {
    const ok = await saveCajaMobile(draft);

    if (ok) {
      setModalMode(null);
      setEditCaja(null);
      showToast("Caja guardada correctamente.");
    }
  }

  async function handleToggleCaja(caja: CajaLite | CajaSaldo) {
    const ok = await toggleCajaActiva(caja);

    if (ok) showToast("Estado de caja actualizado.");
  }

  async function handleUpdateMovimiento(draft: MovimientoDraft) {
    if (!editMovimiento) return;

    const caja = cajas.find((item) => item.id === draft.caja_id);

    const payload: MovimientoMobileUpdateInput = {
      id: editMovimiento.id,
      fecha: draft.fecha,
      tipo: draft.tipo,
      categoria: draft.categoria,
      descripcion: draft.descripcion,
      caja_id: draft.caja_id,
      moneda: caja?.moneda || draft.moneda || "ARS",
      importe: parseMoney(draft.importe),
      referencia_texto: draft.referencia_texto,
      forma_pago: draft.forma_pago,
      observaciones: draft.observaciones
    };

    const ok = await updateMovimientoMobile(payload);

    if (ok) {
      setEditMovimiento(null);
      showToast("Movimiento actualizado correctamente.");
    }
  }

  async function handleAnular(motivo: string) {
    if (!anularTarget) return;

    const ok = await anularMovimiento(anularTarget, motivo);

    if (ok) {
      setAnularTarget(null);
      showToast("Movimiento anulado correctamente.");
    }
  }

  function openEditMovimiento(movimiento: CajaMovimiento) {
    if (movimiento.origen !== "MANUAL" || movimiento.anulado || movimiento.pase_grupo_id) {
      showToast("Solo se pueden editar movimientos manuales no anulados.", "error");
      return;
    }

    setEditMovimiento(movimiento);
  }

  function getMovimientoDraftFromMovimiento(movimiento: CajaMovimiento): MovimientoDraft {
    return {
      fecha: movimiento.fecha || getToday(),
      tipo: getMovimientoSign(movimiento) >= 0 ? "INGRESO" : "EGRESO",
      categoria: movimiento.categoria || "",
      descripcion: movimiento.descripcion || "",
      caja_id: movimiento.caja_id,
      moneda: movimiento.moneda || "ARS",
      importe: moneyInputValue(Math.abs(parseMoney(movimiento.importe))),
      referencia_texto: movimiento.referencia_texto || "",
      forma_pago: movimiento.forma_pago || "",
      observaciones: movimiento.observaciones || ""
    };
  }

  const selectedCajaForMovimiento =
    selectedSaldo ? cajas.find((caja) => caja.id === selectedSaldo.caja_id) || null : null;

  return (
    <div className="flex min-h-full flex-col bg-[radial-gradient(circle_at_12%_8%,rgba(255,122,26,0.10),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(255,47,118,0.06),transparent_30%),linear-gradient(135deg,#f7fbfc,#eff8f8_48%,#f4f8ff)] px-3 py-3 text-[#111827]">
      <Toast toast={toast} onClose={() => setToast(null)} />

      <section className="mb-3 overflow-hidden rounded-[26px] border border-black/10 bg-[#172033] p-4 text-white shadow-sm">
        <div className="relative">
          <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-nostur-orange/20 blur-2xl" />
          <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-[#ff2f76]/15 blur-2xl" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10">
                  <Wallet size={18} strokeWidth={2} />
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    Tesorería
                  </div>

                  <h1 className="text-[21px] font-semibold leading-tight text-white">Caja</h1>
                </div>
              </div>

              <p className="max-w-[290px] text-[12px] font-normal leading-snug text-white/72">
                Saldos, cajas activas, movimientos, pases y control operativo desde el celular.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCaja()}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-3 grid grid-cols-2 gap-2.5">
        <BalanceCard label="Total ARS" value={metrics.ars} moneda="ARS" icon={<Wallet size={16} />} tone="blue" />
        <BalanceCard label="Total USD" value={metrics.usd} moneda="USD" icon={<Wallet size={16} />} tone="green" />
      </section>

      <section className="mb-3 grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setModalMode("movimiento")}
          className="flex h-10 items-center justify-center gap-1 rounded-2xl bg-nostur-orange text-[11px] font-semibold text-white shadow-sm"
        >
          <Plus size={13} />
          Mov.
        </button>

        <button
          type="button"
          onClick={() => setModalMode("pase")}
          className="flex h-10 items-center justify-center gap-1 rounded-2xl bg-sky-700 text-[11px] font-semibold text-white shadow-sm"
        >
          <ArrowLeftRight size={13} />
          Pase
        </button>

        <button
          type="button"
          onClick={() => {
            setEditCaja(null);
            setModalMode("caja");
          }}
          className="flex h-10 items-center justify-center gap-1 rounded-2xl bg-[#172033] text-[11px] font-semibold text-white shadow-sm"
        >
          <Plus size={13} />
          Caja
        </button>
      </section>

      <section className="mb-3 rounded-[24px] border border-black/10 bg-white/84 p-3 shadow-sm backdrop-blur-xl">
        <div className="mb-2 grid grid-cols-[1fr_106px] gap-2">
          <div className="flex h-9 items-center gap-2 rounded-2xl border border-black/10 bg-[#f8fafc] px-3">
            <Search size={14} className="shrink-0 text-[#94a3b8]" />

            <input
              value={filters.search}
              onChange={(event) => setFilter("search", event.target.value)}
              placeholder="Buscar"
              className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-medium text-[#111827] outline-none placeholder:text-[#94a3b8]"
            />
          </div>

          <MobileSelect
            value={filters.moneda}
            onChange={(value) => {
              setFilter("moneda", value as typeof filters.moneda);
              window.setTimeout(() => void loadCaja(), 0);
            }}
            options={MONEDA_OPTIONS}
          />
        </div>

        <div className="mb-2 grid grid-cols-2 gap-2">
          <MobileSelect
            value={filters.cajaId}
            onChange={(value) => {
              setFilter("cajaId", value);
              window.setTimeout(() => void loadCaja(), 0);
            }}
            options={cajaOptions}
          />

          <MobileSelect
            value={filters.tipo}
            onChange={(value) => {
              setFilter("tipo", value as typeof filters.tipo);
              window.setTimeout(() => void loadCaja(), 0);
            }}
            options={TIPO_FILTER_OPTIONS}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <NosturDateInput
            value={filters.desde || getMonthStart()}
            onChange={(value) => setFilter("desde", value)}
          />

          <NosturDateInput
            value={filters.hasta || getToday()}
            onChange={(value) => setFilter("hasta", value)}
          />
        </div>

        <button
          type="button"
          onClick={() => void loadCaja()}
          className="mt-2 h-9 w-full rounded-2xl border border-black/10 bg-white text-[11px] font-semibold text-[#334155]"
        >
          Aplicar filtros
        </button>

        {error ? (
          <div className="mt-2.5 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium leading-snug text-red-700">
            <span>{error}</span>

            <button type="button" onClick={clearError} className="shrink-0">
              <X size={14} />
            </button>
          </div>
        ) : null}
      </section>

      <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
        <Wallet size={12} />
        Balance por caja
      </div>

      <section className="mb-3 flex gap-2.5 overflow-x-auto pb-1">
        {saldos.map((saldo) => {
          const caja = cajas.find((item) => item.id === saldo.caja_id) || null;

          return (
            <div key={saldo.caja_id} className="w-[232px] shrink-0">
              <CajaSaldoCard
                saldo={saldo}
                selected={selectedSaldo?.caja_id === saldo.caja_id}
                onSelect={() => selectCaja(saldo.caja_id)}
                onEdit={() => {
                  setEditCaja(caja);
                  setModalMode("caja");
                }}
                onToggle={() => void handleToggleCaja(caja || saldo)}
              />
            </div>
          );
        })}

        {saldos.length === 0 && !loading ? (
          <div className="w-full rounded-[22px] border border-dashed border-black/10 bg-white/70 p-4 text-center text-[12px] font-medium text-[#64748b]">
            No hay cajas cargadas.
          </div>
        ) : null}
      </section>

      <div className="mb-2 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
        <Landmark size={12} />
        Últimos movimientos
      </div>

      <main className="min-h-0 flex-1 overflow-auto">
        {loading && visibles.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-[24px] bg-white/84 backdrop-blur-xl">
            <Loader2 size={24} className="animate-spin text-nostur-orange" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-black/10 bg-white/70 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#f1f5f9] text-[#64748b]">
              <Wallet size={22} />
            </div>

            <h2 className="text-[16px] font-semibold leading-tight text-[#111827]">Sin movimientos</h2>

            <p className="mt-1 text-[12px] font-normal leading-snug text-[#64748b]">
              No hay movimientos para los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-3">
            {visibles.slice(0, 80).map((movimiento) => (
              <MovimientoRow
                key={movimiento.id}
                movimiento={movimiento}
                onView={() => setViewMovimiento(movimiento)}
                onEdit={() => openEditMovimiento(movimiento)}
                onAnular={() => setAnularTarget(movimiento)}
              />
            ))}
          </div>
        )}
      </main>

      {modalMode === "movimiento" ? (
        <MovimientoModal
          title="Nuevo movimiento"
          cajas={cajas}
          saving={saving}
          initialDraft={createInitialMovimientoDraft(selectedCajaForMovimiento)}
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

      {modalMode === "caja" ? (
        <CajaEditModal
          caja={editCaja}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setEditCaja(null);
          }}
          onSave={handleSaveCaja}
        />
      ) : null}

      {viewMovimiento ? (
        <MovimientoViewModal movimiento={viewMovimiento} onClose={() => setViewMovimiento(null)} />
      ) : null}

      {editMovimiento ? (
        <MovimientoModal
          title="Editar movimiento"
          cajas={cajas}
          saving={saving}
          initialDraft={getMovimientoDraftFromMovimiento(editMovimiento)}
          onClose={() => setEditMovimiento(null)}
          onSave={handleUpdateMovimiento}
        />
      ) : null}

      {anularTarget ? (
        <AnularModal
          movimiento={anularTarget}
          saving={saving}
          onClose={() => setAnularTarget(null)}
          onConfirm={handleAnular}
        />
      ) : null}

      {saving ? (
        <div className="fixed bottom-20 left-1/2 z-[250] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#172033] px-3 py-2 text-[11px] font-semibold text-white shadow-2xl">
          <Loader2 size={13} className="animate-spin" />
          Guardando...
        </div>
      ) : null}
    </div>
  );
}

export default MobileCaja;