// src/mobile/screens/MobileCarritos.tsx

import { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  Eye,
  Loader2,
  Pencil,
  RefreshCcw,
  Search,
  ShoppingBag,
  ToggleLeft,
  ToggleRight,
  X
} from "lucide-react";
import {
  useCarritosStore,
  type Carrito,
  type CarritoMobileUpdateInput,
  type MovimientoTesoreria,
  type PagoComercial,
  type ProfileLite
} from "../../store/carritosStore";
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

const ESTADO_EDIT_OPTIONS: SelectOption[] = ESTADO_OPTIONS.filter((item) => item.value !== "todos");

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
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

function toDisplayDate(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
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

function getClientName(carrito: Carrito): string {
  return carrito.clientes?.nombre_completo || "Sin cliente";
}

function getSellerName(carrito: Carrito, vendedores: ProfileLite[]): string {
  const vendedor = vendedores.find((item) => item.id === carrito.vendedor_id);

  if (vendedor) {
    return `${vendedor.nombre || ""} ${vendedor.apellido || ""}`.trim() || vendedor.email;
  }

  return carrito.vendedor || "Sin vendedor";
}

function getEstadoClass(estado: string): string {
  const clean = estado.toUpperCase();

  if (clean === "CONTROLADO" || clean === "COBRADO") return "bg-emerald-100 text-emerald-700";
  if (clean === "FACTURADO") return "bg-sky-100 text-sky-700";
  if (clean === "EN_CONTROL") return "bg-orange-100 text-orange-700";
  if (clean === "CTA_CTE") return "bg-amber-100 text-amber-700";
  if (clean === "CANCELADO") return "bg-red-100 text-red-700";

  return "bg-slate-100 text-slate-700";
}

function getInitials(value: string): string {
  const parts = value.trim().split(" ").filter(Boolean);
  if (parts.length === 0) return "C";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function maskCarrito(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 9);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
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

function CompactInfo({
  label,
  value
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#f8fafc] px-3 py-2">
      <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
        {label}
      </div>

      <div className="mt-0.5 truncate text-[11px] font-semibold text-[#111827]">{value}</div>
    </div>
  );
}

function CarritoViewModal({
  carrito,
  vendedores,
  onClose
}: {
  carrito: Carrito;
  vendedores: ProfileLite[];
  onClose: () => void;
}) {
  const cliente = getClientName(carrito);
  const vendedor = getSellerName(carrito, vendedores);
  const total = parseMoney(carrito.importe_final ?? carrito.importe);
  const pagado = parseMoney(carrito.total_pagado);
  const saldo = parseMoney(carrito.saldo_cta_cte);

  return (
    <div className="fixed inset-0 z-[200] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="max-h-[92vh] w-full overflow-auto rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-nostur-orange">
              Vista rápida
            </div>

            <h2 className="truncate text-[18px] font-semibold leading-tight text-[#111827]">
              {carrito.numero_carrito || "Sin número"}
            </h2>

            <p className="truncate text-[11px] font-normal leading-tight text-[#64748b]">{cliente}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-[#f1f5f9] text-[#64748b]"
          >
            <X size={15} />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-1.5">
          <span
            className={[
              "rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
              getEstadoClass(carrito.estado || "CARGADO")
            ].join(" ")}
          >
            {carrito.estado || "CARGADO"}
          </span>

          {carrito.activo === false ? (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
              INACTIVO
            </span>
          ) : null}

          {carrito.riesgo ? (
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold text-red-700">
              RIESGO
            </span>
          ) : null}

          {saldo > 0.009 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
              CTA CTE
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <CompactInfo label="Cliente" value={cliente} />
          <CompactInfo label="Vendedor" value={vendedor} />
          <CompactInfo label="Destino" value={carrito.destino || "—"} />
          <CompactInfo label="Servicio" value={carrito.servicio || "—"} />
          <CompactInfo label="IN" value={toDisplayDate(carrito.fecha_in)} />
          <CompactInfo
            label="OUT"
            value={carrito.solo_ida ? "Solo ida" : toDisplayDate(carrito.fecha_out)}
          />
          <CompactInfo label="Venta" value={toDisplayDate(carrito.fecha_venta)} />
          <CompactInfo label="Método" value={carrito.metodo_contacto || "—"} />
        </div>

        <div className="mt-3 rounded-[22px] border border-black/10 bg-[#f8fafc] p-3">
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">Bruto</span>
              <strong className="font-semibold">{formatMoneyAR(carrito.importe_bruto, carrito.moneda)}</strong>
            </div>

            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">Promo</span>
              <strong className="font-semibold">{formatMoneyAR(carrito.promocode_importe, carrito.moneda)}</strong>
            </div>

            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">Final</span>
              <strong className="font-semibold">{formatMoneyAR(total, carrito.moneda)}</strong>
            </div>

            <div className="flex justify-between gap-2">
              <span className="text-[#64748b]">Pagado</span>
              <strong className="font-semibold">{formatMoneyAR(pagado, carrito.moneda)}</strong>
            </div>
          </div>

          <div className="mt-2 flex justify-between border-t border-black/10 pt-2 text-[12px]">
            <span className="font-semibold text-[#111827]">Saldo</span>
            <strong className={saldo > 0.009 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
              {formatMoneyAR(saldo, carrito.moneda)}
            </strong>
          </div>
        </div>

        {carrito.observaciones ? (
          <div className="mt-3 rounded-[22px] border border-black/10 bg-white p-3">
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              Observaciones
            </div>

            <div className="mt-1 whitespace-pre-wrap text-[11px] font-normal leading-snug text-[#475569]">
              {carrito.observaciones}
            </div>
          </div>
        ) : null}

        {carrito.riesgo ? (
          <div className="mt-3 rounded-[22px] border border-red-200 bg-red-50 p-3 text-[11px] font-medium leading-snug text-red-700">
            Riesgo Almundo: {carrito.riesgo_motivo || "Sin motivo cargado"}
          </div>
        ) : null}

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => window.open(`https://abaco.almundo.com/bo/cart/${carrito.numero_carrito}`, "_blank")}
            className="h-10 rounded-2xl border border-black/10 bg-white text-[11px] font-semibold text-[#334155]"
          >
            Abrir Ábaco
          </button>

          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-2xl bg-[#172033] text-[11px] font-semibold text-white"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

type EditDraft = {
  cliente_nombre: string;
  cliente_telefono: string;
  cliente_email: string;
  numero_carrito: string;
  fecha_venta: string;
  fecha_in: string;
  fecha_out: string;
  solo_ida: boolean;
  servicio: string;
  destino: string;
  metodo_contacto: string;
  vendedor_id: string;
  sucursal_id: string;
  estado: string;
  moneda: string;
  importe_bruto: string;
  promocode_aplicado: boolean;
  promocode_importe: string;
  importe_final: string;
  pago_parcial: boolean;
  fecha_ingreso_gastos: string;
  riesgo: boolean;
  importe_riesgo: string;
  riesgo_motivo: string;
  observaciones: string;
  activo: boolean;
  pagosComerciales: PagoComercial[];
  movimientosTesoreria: MovimientoTesoreria[];
};

function createEditDraft(
  carrito: Carrito,
  pagosComerciales: PagoComercial[],
  movimientosTesoreria: MovimientoTesoreria[]
): EditDraft {
  const importeBruto = parseMoney(carrito.importe_bruto ?? carrito.importe_final ?? carrito.importe);
  const promo = parseMoney(carrito.promocode_importe);
  const final = parseMoney(carrito.importe_final ?? carrito.importe);

  return {
    cliente_nombre: carrito.clientes?.nombre_completo || "",
    cliente_telefono: carrito.clientes?.telefono || "",
    cliente_email: carrito.clientes?.email || "",
    numero_carrito: carrito.numero_carrito || "",
    fecha_venta: carrito.fecha_venta || getToday(),
    fecha_in: carrito.fecha_in || "",
    fecha_out: carrito.fecha_out || "",
    solo_ida: Boolean(carrito.solo_ida),
    servicio: carrito.servicio || "",
    destino: carrito.destino || "",
    metodo_contacto: carrito.metodo_contacto || "",
    vendedor_id: carrito.vendedor_id || "",
    sucursal_id: carrito.sucursal_id || "",
    estado: carrito.estado || "CARGADO",
    moneda: carrito.moneda || "ARS",
    importe_bruto: moneyInputValue(importeBruto),
    promocode_aplicado: Boolean(carrito.promocode_aplicado || promo > 0),
    promocode_importe: moneyInputValue(promo),
    importe_final: moneyInputValue(final),
    pago_parcial: Boolean(carrito.pago_parcial || parseMoney(carrito.saldo_cta_cte) > 0),
    fecha_ingreso_gastos: carrito.fecha_ingreso_gastos || "",
    riesgo: Boolean(carrito.riesgo),
    importe_riesgo: moneyInputValue(carrito.importe_riesgo),
    riesgo_motivo: carrito.riesgo_motivo || "",
    observaciones: carrito.observaciones || "",
    activo: carrito.activo !== false,
    pagosComerciales:
      pagosComerciales.length > 0
        ? pagosComerciales
        : [{ importe: 0, moneda: carrito.moneda || "ARS", forma_pago: "" }],
    movimientosTesoreria:
      movimientosTesoreria.length > 0
        ? movimientosTesoreria
        : [{ importe: 0, moneda: carrito.moneda || "ARS", forma_pago: "", caja: "" }]
  };
}

function CarritoEditModal({
  carrito,
  onClose,
  onSaved
}: {
  carrito: Carrito;
  onClose: () => void;
  onSaved: () => void;
}) {
  const saving = useCarritosStore((state) => state.saving);
  const catalogos = useCarritosStore((state) => state.catalogos);
  const loadCarritoPagos = useCarritosStore((state) => state.loadCarritoPagos);
  const loadCarritoMovimientos = useCarritosStore((state) => state.loadCarritoMovimientos);
  const updateCarritoMobile = useCarritosStore((state) => state.updateCarritoMobile);

  const [loadingDetail, setLoadingDetail] = useState(true);
  const [draft, setDraft] = useState<EditDraft | null>(null);
  const [error, setError] = useState<string | null>(null);

  const formaPagoOptions: SelectOption[] = catalogos.formasPago.map((item) => ({
    value: item.nombre,
    label: item.nombre
  }));

  const cajaOptions: SelectOption[] = catalogos.cajas.map((item) => ({
    value: item.nombre,
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

  const servicioOptions: SelectOption[] = catalogos.servicios.map((item) => ({
    value: item.nombre,
    label: item.nombre
  }));

  const metodoOptions: SelectOption[] = catalogos.metodosContacto.map((item) => ({
    value: item.nombre,
    label: item.nombre
  }));

  useEffect(() => {
    let active = true;

    async function loadDetail() {
      setLoadingDetail(true);
      setError(null);

      const [pagos, movimientos] = await Promise.all([
        loadCarritoPagos(carrito.id),
        loadCarritoMovimientos(carrito.id)
      ]);

      if (!active) return;

      setDraft(createEditDraft(carrito, pagos, movimientos));
      setLoadingDetail(false);
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [carrito, loadCarritoMovimientos, loadCarritoPagos]);

  const totals = useMemo(() => {
    if (!draft) {
      return {
        bruto: 0,
        promo: 0,
        final: 0,
        totalComercial: 0,
        totalTesoreria: 0,
        saldo: 0
      };
    }

    const bruto = parseMoney(draft.importe_bruto);
    const promo = draft.promocode_aplicado ? parseMoney(draft.promocode_importe) : 0;
    const final = Math.max(0, parseMoney(draft.importe_final) || bruto - promo);

    const totalComercial = draft.pagosComerciales.reduce(
      (total, pago) => total + parseMoney(pago.importe),
      0
    );

    const totalTesoreria = draft.movimientosTesoreria.reduce(
      (total, movimiento) => total + parseMoney(movimiento.importe),
      0
    );

    const saldo = Math.max(0, final - totalTesoreria);

    return {
      bruto,
      promo,
      final,
      totalComercial,
      totalTesoreria,
      saldo
    };
  }, [draft]);

  function updateDraft<K extends keyof EditDraft>(key: K, value: EditDraft[K]) {
    setError(null);
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  }

  function updatePago(index: number, patch: Partial<PagoComercial>) {
    setError(null);

    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        pagosComerciales: current.pagosComerciales.map((pago, itemIndex) =>
          itemIndex === index ? { ...pago, ...patch } : pago
        )
      };
    });
  }

  function updateMovimiento(index: number, patch: Partial<MovimientoTesoreria>) {
    setError(null);

    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        movimientosTesoreria: current.movimientosTesoreria.map((movimiento, itemIndex) =>
          itemIndex === index ? { ...movimiento, ...patch } : movimiento
        )
      };
    });
  }

  function addPago() {
    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        pagosComerciales: [
          ...current.pagosComerciales,
          { importe: 0, moneda: current.moneda, forma_pago: "" }
        ]
      };
    });
  }

  function addMovimiento() {
    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        movimientosTesoreria: [
          ...current.movimientosTesoreria,
          { importe: 0, moneda: current.moneda, forma_pago: "", caja: "" }
        ]
      };
    });
  }

  function removePago(index: number) {
    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        pagosComerciales:
          current.pagosComerciales.length > 1
            ? current.pagosComerciales.filter((_, itemIndex) => itemIndex !== index)
            : [{ importe: 0, moneda: current.moneda, forma_pago: "" }]
      };
    });
  }

  function removeMovimiento(index: number) {
    setDraft((current) => {
      if (!current) return current;

      return {
        ...current,
        movimientosTesoreria:
          current.movimientosTesoreria.length > 1
            ? current.movimientosTesoreria.filter((_, itemIndex) => itemIndex !== index)
            : [{ importe: 0, moneda: current.moneda, forma_pago: "", caja: "" }]
      };
    });
  }

  async function submit() {
    if (!draft) return;

    if (!draft.numero_carrito.trim()) {
      setError("Completá el número de carrito.");
      return;
    }

    if (!draft.cliente_nombre.trim()) {
      setError("Completá el nombre del cliente.");
      return;
    }

    if (totals.final <= 0) {
      setError("El importe final debe ser mayor a cero.");
      return;
    }

    if (totals.saldo > 0.009 && !draft.fecha_ingreso_gastos && draft.pago_parcial) {
      setError("Completá la fecha de ingreso a gastos.");
      return;
    }

    const payload: CarritoMobileUpdateInput = {
      carritoId: carrito.id,
      cliente: {
        id: carrito.cliente_id,
        nombre_completo: draft.cliente_nombre,
        telefono: draft.cliente_telefono,
        email: draft.cliente_email,
        origen: draft.metodo_contacto
      },
      carrito: {
        numero_carrito: draft.numero_carrito,
        fecha_venta: draft.fecha_venta,
        servicio: draft.servicio,
        metodo_contacto: draft.metodo_contacto,
        destino: draft.destino,
        fecha_in: draft.fecha_in,
        fecha_out: draft.solo_ida ? null : draft.fecha_out,
        solo_ida: draft.solo_ida,
        importe_bruto: totals.bruto,
        moneda: draft.moneda,
        promocode_aplicado: draft.promocode_aplicado,
        promocode_importe: totals.promo,
        importe_final: totals.final,
        pago_parcial: draft.pago_parcial || totals.saldo > 0.009,
        fecha_ingreso_gastos:
          draft.pago_parcial || totals.saldo > 0.009 ? draft.fecha_ingreso_gastos : null,
        total_pagado: totals.totalTesoreria,
        saldo_cta_cte: totals.saldo,
        visible_en_carritos: true,
        riesgo: draft.riesgo,
        importe_riesgo: parseMoney(draft.importe_riesgo),
        riesgo_motivo: draft.riesgo_motivo,
        estado: draft.estado,
        observaciones: draft.observaciones,
        vendedor_id: draft.vendedor_id,
        sucursal_id: draft.sucursal_id,
        activo: draft.activo
      },
      pagosComerciales: draft.pagosComerciales.filter((pago) => parseMoney(pago.importe) > 0),
      movimientosTesoreria: draft.movimientosTesoreria.filter(
        (movimiento) => parseMoney(movimiento.importe) > 0
      )
    };

    const ok = await updateCarritoMobile(payload);

    if (ok) {
      onSaved();
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[210] flex items-end bg-black/35 backdrop-blur-sm">
      <div className="max-h-[94vh] w-full overflow-auto rounded-t-[30px] bg-white p-3 shadow-2xl">
        <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2.5 border-b border-black/10 bg-white/95 px-3 py-3 backdrop-blur-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[9px] font-semibold uppercase tracking-[0.14em] text-nostur-orange">
                Edición básica
              </div>

              <h2 className="text-[17px] font-semibold leading-tight text-[#111827]">
                {carrito.numero_carrito || "Carrito"}
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

          {error ? (
            <div className="mt-2.5 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium leading-snug text-red-700">
              {error}
            </div>
          ) : null}
        </div>

        {loadingDetail || !draft ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 size={24} className="animate-spin text-nostur-orange" />
          </div>
        ) : (
          <div className="space-y-2.5 pb-20">
            <SectionCard title="Cliente y carrito">
              <div className="grid gap-2.5">
                <div>
                  <FieldLabel>Número carrito</FieldLabel>
                  <TextInput
                    value={draft.numero_carrito}
                    onChange={(value) => updateDraft("numero_carrito", maskCarrito(value))}
                    inputMode="numeric"
                    placeholder="000-000-000"
                  />
                </div>

                <div>
                  <FieldLabel>Cliente</FieldLabel>
                  <TextInput
                    value={draft.cliente_nombre}
                    onChange={(value) => updateDraft("cliente_nombre", value)}
                    placeholder="Nombre cliente"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Teléfono</FieldLabel>
                    <TextInput
                      value={draft.cliente_telefono}
                      onChange={(value) => updateDraft("cliente_telefono", value)}
                      inputMode="tel"
                    />
                  </div>

                  <div>
                    <FieldLabel>Email</FieldLabel>
                    <TextInput
                      value={draft.cliente_email}
                      onChange={(value) => updateDraft("cliente_email", value)}
                      inputMode="email"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Estado</FieldLabel>
                    <MobileSelect
                      value={draft.estado}
                      onChange={(value) => updateDraft("estado", value)}
                      options={ESTADO_EDIT_OPTIONS}
                    />
                  </div>

                  <div>
                    <FieldLabel>Moneda</FieldLabel>
                    <MobileSelect
                      value={draft.moneda}
                      onChange={(value) => {
                        updateDraft("moneda", value);

                        setDraft((current) =>
                          current
                            ? {
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
                              }
                            : current
                        );
                      }}
                      options={MONEDA_OPTIONS}
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateDraft("activo", !draft.activo)}
                  className={[
                    "flex h-9 items-center justify-center gap-1.5 rounded-2xl border text-[11px] font-semibold",
                    draft.activo
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-slate-200 bg-slate-100 text-slate-600"
                  ].join(" ")}
                >
                  {draft.activo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
                  {draft.activo ? "Activo" : "Inactivo"}
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Viaje">
              <div className="grid gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Fecha venta</FieldLabel>
                    <NosturDateInput
                      value={draft.fecha_venta}
                      onChange={(value) => updateDraft("fecha_venta", value)}
                    />
                  </div>

                  <div>
                    <FieldLabel>Método contacto</FieldLabel>
                    <MobileSelect
                      value={draft.metodo_contacto}
                      onChange={(value) => updateDraft("metodo_contacto", value)}
                      options={metodoOptions}
                      placeholder="Método"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Fecha IN</FieldLabel>
                    <NosturDateInput
                      value={draft.fecha_in}
                      onChange={(value) => updateDraft("fecha_in", value)}
                    />
                  </div>

                  <div>
                    <FieldLabel>Fecha OUT</FieldLabel>
                    {draft.solo_ida ? (
                      <div className="flex h-9 items-center rounded-2xl border border-black/10 bg-[#f8fafc] px-3 text-[11px] font-medium text-[#94a3b8]">
                        Solo ida
                      </div>
                    ) : (
                      <NosturDateInput
                        value={draft.fecha_out}
                        onChange={(value) => updateDraft("fecha_out", value)}
                        min={draft.fecha_in || getToday()}
                      />
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateDraft("solo_ida", !draft.solo_ida)}
                  className={[
                    "h-9 rounded-2xl border text-[11px] font-semibold",
                    draft.solo_ida
                      ? "border-nostur-orange/30 bg-nostur-orange/10 text-nostur-orange"
                      : "border-black/10 bg-[#f8fafc] text-[#64748b]"
                  ].join(" ")}
                >
                  {draft.solo_ida ? "Solo ida activado" : "No es solo ida"}
                </button>

                <div>
                  <FieldLabel>Servicio</FieldLabel>
                  <MobileSelect
                    value={draft.servicio}
                    onChange={(value) => updateDraft("servicio", value)}
                    options={servicioOptions}
                    placeholder="Servicio"
                  />
                </div>

                <div>
                  <FieldLabel>Destino</FieldLabel>
                  <TextInput
                    value={draft.destino}
                    onChange={(value) => updateDraft("destino", value)}
                    placeholder="Destino"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Vendedor</FieldLabel>
                    <MobileSelect
                      value={draft.vendedor_id}
                      onChange={(value) => updateDraft("vendedor_id", value)}
                      options={vendedorOptions}
                      placeholder="Vendedor"
                    />
                  </div>

                  <div>
                    <FieldLabel>Sucursal</FieldLabel>
                    <MobileSelect
                      value={draft.sucursal_id}
                      onChange={(value) => updateDraft("sucursal_id", value)}
                      options={sucursalOptions}
                      placeholder="Sucursal"
                    />
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Importes">
              <div className="grid gap-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <FieldLabel>Importe bruto</FieldLabel>
                    <TextInput
                      value={draft.importe_bruto}
                      onChange={(value) => {
                        updateDraft("importe_bruto", value);
                        const bruto = parseMoney(value);
                        const promo = draft.promocode_aplicado ? parseMoney(draft.promocode_importe) : 0;
                        updateDraft("importe_final", moneyInputValue(Math.max(0, bruto - promo)));
                      }}
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <FieldLabel>Importe final</FieldLabel>
                    <TextInput
                      value={draft.importe_final}
                      onChange={(value) => updateDraft("importe_final", value)}
                      inputMode="decimal"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => updateDraft("promocode_aplicado", !draft.promocode_aplicado)}
                  className={[
                    "h-9 rounded-2xl border text-[11px] font-semibold",
                    draft.promocode_aplicado
                      ? "border-nostur-orange/30 bg-nostur-orange/10 text-nostur-orange"
                      : "border-black/10 bg-[#f8fafc] text-[#64748b]"
                  ].join(" ")}
                >
                  {draft.promocode_aplicado ? "Tiene promocode" : "Sin promocode"}
                </button>

                {draft.promocode_aplicado ? (
                  <div>
                    <FieldLabel>Promocode importe</FieldLabel>
                    <TextInput
                      value={draft.promocode_importe}
                      onChange={(value) => {
                        updateDraft("promocode_importe", value);
                        const bruto = parseMoney(draft.importe_bruto);
                        const promo = parseMoney(value);
                        updateDraft("importe_final", moneyInputValue(Math.max(0, bruto - promo)));
                      }}
                      inputMode="decimal"
                    />
                  </div>
                ) : null}

                <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3 text-[11px]">
                  <div className="flex justify-between">
                    <span>Final cliente</span>
                    <strong className="font-semibold">{formatMoneyAR(totals.final, draft.moneda)}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Pago comercial</span>
                    <strong className="font-semibold">{formatMoneyAR(totals.totalComercial, draft.moneda)}</strong>
                  </div>

                  <div className="flex justify-between">
                    <span>Tesorería</span>
                    <strong className="font-semibold">{formatMoneyAR(totals.totalTesoreria, draft.moneda)}</strong>
                  </div>

                  <div className="mt-1 flex justify-between border-t border-black/10 pt-1">
                    <span>Saldo</span>
                    <strong className={totals.saldo > 0 ? "font-semibold text-amber-700" : "font-semibold text-emerald-700"}>
                      {formatMoneyAR(totals.saldo, draft.moneda)}
                    </strong>
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Pago comercial">
              <div className="space-y-2">
                {draft.pagosComerciales.map((pago, index) => (
                  <div key={`pago-${index}`} className="rounded-2xl border border-black/10 bg-[#f8fafc] p-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>Importe</FieldLabel>
                        <TextInput
                          value={moneyInputValue(pago.importe)}
                          onChange={(value) => updatePago(index, { importe: parseMoney(value) })}
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <FieldLabel>Moneda</FieldLabel>
                        <MobileSelect
                          value={pago.moneda || draft.moneda}
                          onChange={(value) => updatePago(index, { moneda: value })}
                          options={MONEDA_OPTIONS}
                        />
                      </div>
                    </div>

                    <div className="mt-2">
                      <FieldLabel>Forma de pago</FieldLabel>
                      <MobileSelect
                        value={pago.forma_pago || ""}
                        onChange={(value) => updatePago(index, { forma_pago: value })}
                        options={formaPagoOptions}
                        placeholder="Forma"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => removePago(index)}
                      className="mt-2 h-8 w-full rounded-2xl border border-black/10 bg-white text-[11px] font-semibold text-[#64748b]"
                    >
                      Eliminar línea
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addPago}
                  className="h-9 w-full rounded-2xl border border-dashed border-nostur-orange/40 bg-nostur-orange/5 text-[11px] font-semibold text-nostur-orange"
                >
                  + Agregar pago comercial
                </button>
              </div>
            </SectionCard>

            <SectionCard title="Tesorería">
              <div className="space-y-2">
                {draft.movimientosTesoreria.map((movimiento, index) => (
                  <div
                    key={`movimiento-${index}`}
                    className="rounded-2xl border border-black/10 bg-[#f8fafc] p-2.5"
                  >
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <FieldLabel>Caja</FieldLabel>
                        <MobileSelect
                          value={movimiento.caja || ""}
                          onChange={(value) => updateMovimiento(index, { caja: value })}
                          options={cajaOptions}
                          placeholder="Caja"
                        />
                      </div>

                      <div>
                        <FieldLabel>Forma real</FieldLabel>
                        <MobileSelect
                          value={movimiento.forma_pago || ""}
                          onChange={(value) => updateMovimiento(index, { forma_pago: value })}
                          options={formaPagoOptions}
                          placeholder="Forma"
                        />
                      </div>

                      <div>
                        <FieldLabel>Importe</FieldLabel>
                        <TextInput
                          value={moneyInputValue(movimiento.importe)}
                          onChange={(value) =>
                            updateMovimiento(index, { importe: parseMoney(value) })
                          }
                          inputMode="decimal"
                        />
                      </div>

                      <div>
                        <FieldLabel>TC</FieldLabel>
                        <TextInput
                          value={moneyInputValue(movimiento.tipo_cambio)}
                          onChange={(value) =>
                            updateMovimiento(index, { tipo_cambio: parseMoney(value) })
                          }
                          inputMode="decimal"
                          placeholder="Opcional"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeMovimiento(index)}
                      className="mt-2 h-8 w-full rounded-2xl border border-black/10 bg-white text-[11px] font-semibold text-[#64748b]"
                    >
                      Eliminar línea
                    </button>
                  </div>
                ))}

                <button
                  type="button"
                  onClick={addMovimiento}
                  className="h-9 w-full rounded-2xl border border-dashed border-nostur-orange/40 bg-nostur-orange/5 text-[11px] font-semibold text-nostur-orange"
                >
                  + Agregar movimiento tesorería
                </button>
              </div>

              {totals.saldo > 0.009 ? (
                <div className="mt-2.5 rounded-2xl border border-amber-200 bg-amber-50 p-2.5">
                  <button
                    type="button"
                    onClick={() => updateDraft("pago_parcial", !draft.pago_parcial)}
                    className="mb-2 h-8 w-full rounded-2xl bg-amber-100 text-[11px] font-semibold text-amber-800"
                  >
                    {draft.pago_parcial ? "Pago parcial activado" : "Activar pago parcial"}
                  </button>

                  <FieldLabel>Fecha ingreso a gastos</FieldLabel>
                  <NosturDateInput
                    value={draft.fecha_ingreso_gastos}
                    onChange={(value) => updateDraft("fecha_ingreso_gastos", value)}
                  />
                </div>
              ) : null}
            </SectionCard>

            <SectionCard title="Riesgo y observaciones">
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={() => updateDraft("riesgo", !draft.riesgo)}
                  className={[
                    "h-9 w-full rounded-2xl border text-[11px] font-semibold",
                    draft.riesgo
                      ? "border-red-200 bg-red-50 text-red-700"
                      : "border-black/10 bg-[#f8fafc] text-[#64748b]"
                  ].join(" ")}
                >
                  {draft.riesgo ? "Riesgo Almundo activado" : "Sin riesgo Almundo"}
                </button>

                {draft.riesgo ? (
                  <>
                    <div>
                      <FieldLabel>Importe riesgo</FieldLabel>
                      <TextInput
                        value={draft.importe_riesgo}
                        onChange={(value) => updateDraft("importe_riesgo", value)}
                        inputMode="decimal"
                      />
                    </div>

                    <div>
                      <FieldLabel>Motivo riesgo</FieldLabel>
                      <TextInput
                        value={draft.riesgo_motivo}
                        onChange={(value) => updateDraft("riesgo_motivo", value)}
                      />
                    </div>
                  </>
                ) : null}

                <div>
                  <FieldLabel>Observaciones</FieldLabel>
                  <TextArea
                    value={draft.observaciones}
                    onChange={(value) => updateDraft("observaciones", value)}
                    placeholder="Notas del carrito"
                  />
                </div>
              </div>
            </SectionCard>
          </div>
        )}

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
              onClick={submit}
              disabled={saving || loadingDetail || !draft}
              className="h-10 rounded-2xl bg-nostur-orange text-[12px] font-semibold text-white shadow-sm disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function CarritoRow({
  carrito,
  vendedores,
  onView,
  onEdit,
  onToggle
}: {
  carrito: Carrito;
  vendedores: ProfileLite[];
  onView: () => void;
  onEdit: () => void;
  onToggle: () => void;
}) {
  const cliente = getClientName(carrito);
  const vendedor = getSellerName(carrito, vendedores);
  const total = parseMoney(carrito.importe_final ?? carrito.importe);

  return (
    <article
      className={[
        "w-full rounded-[24px] border bg-white/86 p-3 shadow-sm backdrop-blur-xl",
        carrito.activo === false ? "border-slate-200 opacity-60" : "border-black/10"
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#172033] text-[11px] font-semibold text-white">
          {getInitials(cliente)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[14px] font-semibold leading-tight text-[#111827]">
                {cliente}
              </div>

              <div className="mt-0.5 truncate text-[11px] font-normal leading-tight text-[#64748b]">
                {carrito.clientes?.telefono || "Sin teléfono"}
              </div>
            </div>

            <span
              className={[
                "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
                getEstadoClass(carrito.estado || "CARGADO")
              ].join(" ")}
            >
              {carrito.estado || "CARGADO"}
            </span>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-2xl bg-[#f8fafc] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
                Carrito
              </div>

              <div className="truncate text-[12px] font-semibold text-nostur-orange">
                {carrito.numero_carrito || "—"}
              </div>
            </div>

            <div className="min-w-0 rounded-2xl bg-[#f8fafc] px-3 py-2">
              <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
                Importe
              </div>

              <div className="truncate text-[12px] font-semibold text-[#111827]">
                {formatMoneyAR(total, carrito.moneda)}
              </div>
            </div>
          </div>

          <div className="mt-2 min-w-0 rounded-2xl bg-[#f8fafc] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              Vendedor
            </div>

            <div className="truncate text-[11px] font-semibold text-[#334155]">{vendedor}</div>
          </div>

          <div className="mt-2 min-w-0 rounded-2xl bg-[#f8fafc] px-3 py-2">
            <div className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
              Destino
            </div>

            <div className="truncate text-[11px] font-semibold text-[#334155]">
              {carrito.destino || "Sin destino"}
            </div>
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            {carrito.activo === false ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold text-slate-600">
                INACTIVO
              </span>
            ) : null}

            {carrito.riesgo ? (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-semibold text-red-700">
                RIESGO
              </span>
            ) : null}

            {parseMoney(carrito.saldo_cta_cte) > 0.009 ? (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-700">
                CTA CTE
              </span>
            ) : null}
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={onView}
              className="flex h-9 items-center justify-center gap-1 rounded-2xl bg-[#f1f5f9] text-[11px] font-semibold text-[#64748b]"
              title="Ver"
            >
              <Eye size={13} />
              Ver
            </button>

            <button
              type="button"
              onClick={onEdit}
              className="flex h-9 items-center justify-center gap-1 rounded-2xl bg-nostur-orange/10 text-[11px] font-semibold text-nostur-orange"
              title="Modificar"
            >
              <Pencil size={13} />
              Editar
            </button>

            <button
              type="button"
              onClick={onToggle}
              className="flex h-9 items-center justify-center gap-1 rounded-2xl bg-[#f8fafc] text-[11px] font-semibold text-[#64748b]"
              title={carrito.activo ? "Desactivar" : "Activar"}
            >
              {carrito.activo ? <ToggleRight size={15} /> : <ToggleLeft size={15} />}
              {carrito.activo ? "Off" : "On"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function MobileCarritos() {
  const loading = useCarritosStore((state) => state.loading);
  const saving = useCarritosStore((state) => state.saving);
  const error = useCarritosStore((state) => state.error);
  const filters = useCarritosStore((state) => state.filters);
  const catalogos = useCarritosStore((state) => state.catalogos);

  const loadCarritos = useCarritosStore((state) => state.loadCarritos);
  const setFilter = useCarritosStore((state) => state.setFilter);
  const goToPreviousMonth = useCarritosStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useCarritosStore((state) => state.goToNextMonth);
  const goToCurrentMonth = useCarritosStore((state) => state.goToCurrentMonth);
  const clearError = useCarritosStore((state) => state.clearError);
  const toggleCarritoActivo = useCarritosStore((state) => state.toggleCarritoActivo);
  const getFilteredCarritos = useCarritosStore((state) => state.getFilteredCarritos);

  const [viewCarrito, setViewCarrito] = useState<Carrito | null>(null);
  const [editCarrito, setEditCarrito] = useState<Carrito | null>(null);
  const [toast, setToast] = useState<ToastState>(null);

  const carritos = getFilteredCarritos();

  useEffect(() => {
    void loadCarritos();
  }, [loadCarritos]);

  useEffect(() => {
    const channel = supabase
      .channel(`mobile-carritos-${Date.now()}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carritos"
        },
        () => {
          void loadCarritos();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "clientes"
        },
        () => {
          void loadCarritos();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carrito_pagos_comerciales"
        },
        () => {
          void loadCarritos();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "carrito_movimientos_tesoreria"
        },
        () => {
          void loadCarritos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCarritos]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3000);
  }

  function refreshAfterPeriodChange(action: () => void) {
    action();
    window.setTimeout(() => {
      void loadCarritos();
    }, 0);
  }

  async function handleToggle(carrito: Carrito) {
    const ok = await toggleCarritoActivo(carrito);

    if (ok) {
      showToast(carrito.activo ? "Carrito desactivado." : "Carrito activado.");
    }
  }

  const visibles = useMemo(() => {
    return carritos.filter((item) => {
      const q = normalizeText(filters.search);
      if (!q) return true;

      const vendedor = getSellerName(item, catalogos.vendedores);

      const haystack = normalizeText(
        [
          item.numero_carrito,
          getClientName(item),
          item.clientes?.telefono,
          vendedor,
          item.destino,
          item.estado
        ].join(" ")
      );

      return haystack.includes(q);
    });
  }, [carritos, catalogos.vendedores, filters.search]);

  const facturacionVisible = useMemo(() => {
    return visibles.reduce((sum, carrito) => sum + parseMoney(carrito.importe_final ?? carrito.importe), 0);
  }, [visibles]);

  const ctaCteVisible = useMemo(() => {
    return visibles.filter((carrito) => parseMoney(carrito.saldo_cta_cte) > 0.009).length;
  }, [visibles]);

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
                  <ShoppingBag size={18} strokeWidth={2} />
                </div>

                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                    Ventas
                  </div>

                  <h1 className="text-[21px] font-semibold leading-tight text-white">Carritos</h1>
                </div>
              </div>

              <p className="max-w-[290px] text-[12px] font-normal leading-snug text-white/72">
                Seguimiento operativo de ventas, pagos, cuentas corrientes y control comercial.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadCarritos()}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10 disabled:opacity-50"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCcw size={16} />}
            </button>
          </div>
        </div>
      </section>

      <section className="mb-3 grid grid-cols-3 gap-2">
        <div className="rounded-[22px] border border-black/10 bg-white/86 p-3 shadow-sm backdrop-blur-xl">
          <div className="text-[10px] font-medium text-[#64748b]">Visibles</div>
          <div className="mt-1 text-[18px] font-semibold text-[#111827]">{visibles.length}</div>
        </div>

        <div className="rounded-[22px] border border-black/10 bg-white/86 p-3 shadow-sm backdrop-blur-xl">
          <div className="text-[10px] font-medium text-[#64748b]">Cta Cte</div>
          <div className="mt-1 text-[18px] font-semibold text-amber-700">{ctaCteVisible}</div>
        </div>

        <div className="rounded-[22px] border border-black/10 bg-white/86 p-3 shadow-sm backdrop-blur-xl">
          <div className="text-[10px] font-medium text-[#64748b]">Total</div>
          <div className="mt-1 truncate text-[15px] font-semibold text-[#111827]">
            {formatMoneyAR(facturacionVisible, "USD")}
          </div>
        </div>
      </section>

      <section className="mb-3 rounded-[24px] border border-black/10 bg-white/84 p-3 shadow-sm backdrop-blur-xl">
        <div className="mb-2.5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => refreshAfterPeriodChange(goToPreviousMonth)}
            className="h-8 rounded-2xl bg-[#f8fafc] px-3 text-[11px] font-semibold text-[#64748b]"
          >
            Anterior
          </button>

          <button
            type="button"
            onClick={() => refreshAfterPeriodChange(goToCurrentMonth)}
            className="h-8 min-w-0 flex-1 rounded-2xl bg-[#172033] px-3 text-[11px] font-semibold text-white"
          >
            {formatMonthLabel(filters.month)}
          </button>

          <button
            type="button"
            onClick={() => refreshAfterPeriodChange(goToNextMonth)}
            className="h-8 rounded-2xl bg-[#f8fafc] px-3 text-[11px] font-semibold text-[#64748b]"
          >
            Siguiente
          </button>
        </div>

        <div className="grid grid-cols-[1fr_118px] gap-2">
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
            value={filters.estado}
            onChange={(value) => {
              setFilter("estado", value);
              window.setTimeout(() => void loadCarritos(), 0);
            }}
            options={ESTADO_OPTIONS}
          />
        </div>

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
        <ShoppingBag size={12} />
        Lista operativa
      </div>

      <main className="min-h-0 flex-1 overflow-auto">
        {loading && visibles.length === 0 ? (
          <div className="flex h-64 items-center justify-center rounded-[24px] bg-white/84 backdrop-blur-xl">
            <Loader2 size={24} className="animate-spin text-nostur-orange" />
          </div>
        ) : visibles.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-black/10 bg-white/70 p-6 text-center backdrop-blur-xl">
            <div className="mx-auto mb-2.5 flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#f1f5f9] text-[#64748b]">
              <ShoppingBag size={22} />
            </div>

            <h2 className="text-[16px] font-semibold leading-tight text-[#111827]">Sin carritos</h2>
            <p className="mt-1 text-[12px] font-normal leading-snug text-[#64748b]">
              No hay carritos para los filtros seleccionados.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5 pb-3">
            {visibles.map((carrito) => (
              <CarritoRow
                key={carrito.id}
                carrito={carrito}
                vendedores={catalogos.vendedores}
                onView={() => setViewCarrito(carrito)}
                onEdit={() => setEditCarrito(carrito)}
                onToggle={() => void handleToggle(carrito)}
              />
            ))}
          </div>
        )}
      </main>

      {viewCarrito ? (
        <CarritoViewModal
          carrito={viewCarrito}
          vendedores={catalogos.vendedores}
          onClose={() => setViewCarrito(null)}
        />
      ) : null}

      {editCarrito ? (
        <CarritoEditModal
          carrito={editCarrito}
          onClose={() => setEditCarrito(null)}
          onSaved={() => showToast("Carrito actualizado correctamente.")}
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

export default MobileCarritos;