// src/components/facturas/FacturasCobrarPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Archive,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Eye,
  Paperclip,
  Plus,
  ReceiptText,
  RefreshCcw,
  Search,
  ShieldCheck,
  Wallet,
  X
} from "lucide-react";
import {
  useFacturasCobrarStore,
  type CobroDraft,
  type DocumentoDraft,
  type FacturaCobrar,
  type FacturasGrupoMoneda,
  type FacturasGrupoSucursal,
  type FacturasTab
} from "../../store/facturasCobrarStore";
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

const MONEDA_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" }
];

const MONEDA_DRAFT_OPTIONS: SelectOption[] = [
  { value: "ARS", label: "Pesos" },
  { value: "USD", label: "Dólares" }
];

const TIPO_DOCUMENTO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "FACTURA", label: "Factura" },
  { value: "POSTVENTA", label: "Postventa" },
  { value: "NOTA_CREDITO", label: "Nota crédito" },
  { value: "NOTA_DEBITO", label: "Nota débito" }
];

const TIPO_DOCUMENTO_DRAFT_OPTIONS: SelectOption[] = [
  { value: "FACTURA", label: "Factura carritos" },
  { value: "POSTVENTA", label: "Postventa" },
  { value: "NOTA_CREDITO", label: "Nota crédito" },
  { value: "NOTA_DEBITO", label: "Nota débito" }
];

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "PENDIENTE", label: "Pendientes" },
  { value: "COBRADA", label: "Cobradas" }
];

const FORMA_COBRO_OPTIONS: SelectOption[] = [
  { value: "TRANSFERENCIA", label: "Transferencia / Banco" },
  { value: "CASHFLOW", label: "Cashflow" }
];

const IVA_OPTIONS: SelectOption[] = [
  { value: "0", label: "0%" },
  { value: "10.5", label: "10,5%" },
  { value: "21", label: "21%" },
  { value: "27", label: "27%" }
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

function formatDateAR(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value || "").trim();
  if (!raw) return 0;

  let normalized = raw
    .replace(/\s/g, "")
    .replace(/\$/g, "")
    .replace(/ARS/gi, "")
    .replace(/USD/gi, "");

  const hasComma = normalized.includes(",");
  const hasDot = normalized.includes(".");

  if (hasComma && hasDot) {
    const lastComma = normalized.lastIndexOf(",");
    const lastDot = normalized.lastIndexOf(".");

    if (lastComma > lastDot) {
      normalized = normalized.replace(/\./g, "").replace(",", ".");
    } else {
      normalized = normalized.replace(/,/g, "");
    }
  } else if (hasComma) {
    normalized = normalized.replace(/\./g, "").replace(",", ".");
  }

  normalized = normalized.replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function moneyInput(value: number): string {
  if (!Number.isFinite(value) || value === 0) return "";
  return String(value.toFixed(2)).replace(".", ",");
}

function maskDocumentoNumero(value: string): string {
  const clean = value.trim();

  if (clean.includes("/") || clean.includes("-")) {
    return clean.slice(0, 24);
  }

  const digits = clean.replace(/\D/g, "").slice(0, 12);

  if (digits.length <= 4) return digits;

  return `${digits.slice(0, 4)}-${digits.slice(4)}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.slice(0, 1).toUpperCase())
    .join("");
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    FACTURA: "Factura",
    POSTVENTA: "Postventa",
    NOTA_CREDITO: "Nota crédito",
    NOTA_DEBITO: "Nota débito"
  };

  return labels[tipo] || tipo;
}

function getMonthName(value?: number | null): string {
  if (!value || value < 1 || value > 12) return "—";
  return MONTH_NAMES[value - 1];
}

function getMonthYearLabel(mes: number, anio: number): string {
  return `${MONTH_NAMES[mes - 1] || "Mes"} ${anio}`;
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
      className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90] disabled:cursor-not-allowed disabled:bg-[#f8fafc] disabled:text-[#64748b]"
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
    <div className={["relative", open ? "z-[150]" : "z-0"].join(" ")}>
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
            className="fixed inset-0 z-[140] cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-label="Cerrar selector"
          />

          <div className="absolute left-0 right-0 top-[36px] z-[160] max-h-56 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-xl">
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

function createInitialDocumentDraft(): DocumentoDraft {
  const today = getToday();

  return {
    tipo_documento: "FACTURA",
    numero_documento: "",
    razon_social: "ALMUNDO.COM",
    moneda: "ARS",
    sucursal_id: "",
    mes: today.slice(5, 7),
    anio: today.slice(0, 4),
    neto_gravado: "",
    alicuota_iva: "21",
    iva_importe: "",
    no_gravado: "0",
    exento: "0",
    total: "",
    observaciones: "",
    selectedCarritoIds: [],
    archivo: null
  };
}

function createInitialCobroDraft(total = 0): CobroDraft {
  return {
    forma_cobro: "TRANSFERENCIA",
    caja_id: "",
    importe_ingresado_banco: total > 0 ? String(total.toFixed(2)).replace(".", ",") : "",
    referencia_cobro: "",
    observaciones: ""
  };
}

function recalculateDraftMoney(
  draft: DocumentoDraft,
  patch: Partial<DocumentoDraft>,
  forceTotal = true
): DocumentoDraft {
  const next = {
    ...draft,
    ...patch
  };

  const neto = parseMoney(next.neto_gravado);
  const alicuota = parseMoney(next.alicuota_iva || "21");
  const iva = neto * (alicuota / 100);
  const noGravado = parseMoney(next.no_gravado);
  const exento = parseMoney(next.exento);
  const total = neto + iva + noGravado + exento;

  return {
    ...next,
    iva_importe: moneyInput(iva),
    total: forceTotal ? moneyInput(total) : next.total
  };
}

function DocumentoModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const saving = useFacturasCobrarStore((state) => state.saving);
  const catalogos = useFacturasCobrarStore((state) => state.catalogos);
  const createDocumento = useFacturasCobrarStore((state) => state.createDocumento);
  const getCarritosDisponiblesForDraft = useFacturasCobrarStore(
    (state) => state.getCarritosDisponiblesForDraft
  );

  const [draft, setDraft] = useState<DocumentoDraft>(() => createInitialDocumentDraft());

  const sucursalOptions: SelectOption[] = [
    { value: "", label: "Todas las sucursales" },
    ...catalogos.sucursales.map((item) => ({
      value: item.id,
      label: item.nombre
    }))
  ];

  const carritosDisponibles = getCarritosDisponiblesForDraft(draft);
  const selectedCarritos = carritosDisponibles.filter((carrito) =>
    draft.selectedCarritoIds.includes(carrito.id)
  );

  const facturaCarritosTotalSugerido = selectedCarritos.reduce((total, carrito) => {
    const control = carrito.carritos_control?.[0];
    return total + parseMoney(control?.importe_a_facturar);
  }, 0);

  const inputNeto = parseMoney(draft.neto_gravado);
  const inputAlicuota = parseMoney(draft.alicuota_iva || "21");
  const inputIva = draft.iva_importe.trim()
    ? parseMoney(draft.iva_importe)
    : inputNeto * (inputAlicuota / 100);
  const inputNoGravado = parseMoney(draft.no_gravado);
  const inputExento = parseMoney(draft.exento);
  const inputTotal = draft.total.trim()
    ? parseMoney(draft.total)
    : inputNeto + inputIva + inputNoGravado + inputExento;

  const isFacturaCarritos = draft.tipo_documento === "FACTURA";

  function setField<K extends keyof DocumentoDraft>(key: K, value: DocumentoDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function selectCarrito(carritoId: string) {
    setDraft((current) => {
      const checked = current.selectedCarritoIds.includes(carritoId);

      const selectedCarritoIds = checked
        ? current.selectedCarritoIds.filter((id) => id !== carritoId)
        : [...current.selectedCarritoIds, carritoId];

      const nextSelected = carritosDisponibles.filter((item) =>
        selectedCarritoIds.includes(item.id)
      );

   const suggestedTotal = nextSelected.reduce((total, item) => {
  const control = item.carritos_control?.[0];
  return total + parseMoney(control?.importe_a_facturar);
}, 0);

const alicuota = parseMoney(current.alicuota_iva || "21");
const divisorIva = 1 + alicuota / 100;
const suggestedNeto = divisorIva > 0 ? suggestedTotal / divisorIva : suggestedTotal;

return recalculateDraftMoney(current, {
  selectedCarritoIds,
  neto_gravado: suggestedNeto > 0 ? moneyInput(suggestedNeto) : ""
});
    });
  }

  async function submit() {
    const ok = await createDocumento(draft);
    if (ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center bg-black/35 px-4 pt-8 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-56px)] w-full max-w-7xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              Nuevo documento a cobrar
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Facturas, postventa, notas de crédito y notas de débito para Almundo.
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

        <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_330px]">
          <main className="rounded-[16px] border border-black/10 bg-white p-3">
            <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
              <div>
                <FieldLabel>Tipo documento</FieldLabel>

                <NosturSelect
                  value={draft.tipo_documento}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      tipo_documento: value as DocumentoDraft["tipo_documento"],
                      selectedCarritoIds: []
                    }))
                  }
                  options={TIPO_DOCUMENTO_DRAFT_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>Número</FieldLabel>

                <TextInput
                  value={draft.numero_documento}
                  onChange={(value) => setField("numero_documento", maskDocumentoNumero(value))}
                  placeholder="0001-0000000"
                  inputMode="numeric"
                />
              </div>

              <div>
                <FieldLabel>A quién se factura</FieldLabel>

                <TextInput
                  value={draft.razon_social}
                  onChange={(value) => setField("razon_social", value)}
                  placeholder="ALMUNDO.COM"
                />
              </div>

              <div>
                <FieldLabel>Moneda</FieldLabel>

                <NosturSelect
                  value={draft.moneda}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      moneda: value as DocumentoDraft["moneda"],
                      selectedCarritoIds: []
                    }))
                  }
                  options={MONEDA_DRAFT_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>Sucursal</FieldLabel>

                <NosturSelect
                  value={draft.sucursal_id}
                  onChange={(value) =>
                    setDraft((current) => ({
                      ...current,
                      sucursal_id: value,
                      selectedCarritoIds: []
                    }))
                  }
                  options={sucursalOptions}
                  placeholder="Todas las sucursales"
                />
              </div>

              <div>
                <FieldLabel>Mes</FieldLabel>

                <NosturSelect
                  value={draft.mes}
                  onChange={(value) => setField("mes", value)}
                  options={MONTH_NAMES.map((month, index) => ({
                    value: String(index + 1).padStart(2, "0"),
                    label: month
                  }))}
                />
              </div>

              <div>
                <FieldLabel>Año</FieldLabel>

                <TextInput
                  value={draft.anio}
                  onChange={(value) => setField("anio", value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="2026"
                  inputMode="numeric"
                />
              </div>

              <div>
                <FieldLabel>Neto gravado</FieldLabel>

                <TextInput
                  value={draft.neto_gravado}
                  onChange={(value) =>
                    setDraft((current) =>
                      recalculateDraftMoney(current, {
                        neto_gravado: value
                      })
                    )
                  }
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Alícuota IVA %</FieldLabel>

                <NosturSelect
                  value={draft.alicuota_iva}
                  onChange={(value) =>
                    setDraft((current) =>
                      recalculateDraftMoney(current, {
                        alicuota_iva: value
                      })
                    )
                  }
                  options={IVA_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>IVA $</FieldLabel>

                <TextInput
                  value={draft.iva_importe}
                  onChange={(value) => {
                    const total =
                      parseMoney(draft.neto_gravado) +
                      parseMoney(value) +
                      parseMoney(draft.no_gravado) +
                      parseMoney(draft.exento);

                    setDraft((current) => ({
                      ...current,
                      iva_importe: value,
                      total: moneyInput(total)
                    }));
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>No gravado</FieldLabel>

                <TextInput
                  value={draft.no_gravado}
                  onChange={(value) => {
                    const total =
                      parseMoney(draft.neto_gravado) +
                      parseMoney(draft.iva_importe) +
                      parseMoney(value) +
                      parseMoney(draft.exento);

                    setDraft((current) => ({
                      ...current,
                      no_gravado: value,
                      total: moneyInput(total)
                    }));
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Exento</FieldLabel>

                <TextInput
                  value={draft.exento}
                  onChange={(value) => {
                    const total =
                      parseMoney(draft.neto_gravado) +
                      parseMoney(draft.iva_importe) +
                      parseMoney(draft.no_gravado) +
                      parseMoney(value);

                    setDraft((current) => ({
                      ...current,
                      exento: value,
                      total: moneyInput(total)
                    }));
                  }}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

              <div>
                <FieldLabel>Total</FieldLabel>

                <TextInput
                  value={draft.total}
                  onChange={(value) => setField("total", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>

                        <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>Observaciones / motivo</FieldLabel>

                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Motivo de nota, referencia de postventa o comentarios..."
                />
              </div>

              <div className="md:col-span-2 xl:col-span-2">
                <FieldLabel>Documento adjunto</FieldLabel>

                <label className="flex min-h-[78px] cursor-pointer flex-col justify-center rounded-[10px] border border-dashed border-black/15 bg-[#f8fafc] px-3 py-2 text-[12px] transition hover:border-[#4f7c90]/40 hover:bg-[#eef6f7]">
                  <input
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(event) => {
                      const file = event.target.files?.[0] || null;
                      setField("archivo", file);
                    }}
                  />

                  <div className="flex items-center gap-2 font-semibold text-[#172033]">
                    <Paperclip size={14} className="text-[#4f7c90]" />
                    {draft.archivo ? "Archivo cargado" : "Adjuntar PDF / imagen"}
                  </div>

                  <div className="mt-1 truncate font-normal text-[#64748b]">
                    {draft.archivo
                      ? `${draft.archivo.name} · ${(draft.archivo.size / 1024 / 1024).toFixed(2)} MB`
                      : "Factura, nota de crédito, nota de débito o comprobante."}
                  </div>

                  {draft.archivo ? (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        setField("archivo", null);
                      }}
                      className="mt-2 h-7 self-start rounded-[9px] bg-white px-2.5 text-[11px] font-medium text-red-600 ring-1 ring-red-100 hover:bg-red-50"
                    >
                      Quitar archivo
                    </button>
                  ) : null}
                </label>
              </div>
            </div>

            {isFacturaCarritos ? (
              <div className="mt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#172033]">
                      Carritos disponibles
                    </h3>

                    <p className="mt-0.5 text-[11.5px] font-normal text-[#64748b]">
                      Aparecen todos los carritos controlados, no anulados y no facturados de la
                      moneda elegida. No se divide por sucursal.
                    </p>
                  </div>

                  <div className="rounded-[14px] border border-[#4f7c90]/20 bg-[#eef6f7] px-3 py-2 text-right">
                    <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#4f7c90]">
                     Total carritos c/IVA
                    </div>

                    <div className="text-[14px] font-semibold text-[#172033]">
                      {formatMoneyAR(facturaCarritosTotalSugerido, draft.moneda)}
                    </div>
                  </div>
                </div>

                <div className="grid gap-1.5">
                  {carritosDisponibles.length === 0 ? (
                    <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                      No hay carritos disponibles para la moneda elegida.
                    </div>
                  ) : (
                    carritosDisponibles.map((carrito) => {
                      const control = carrito.carritos_control?.[0];
                      const checked = draft.selectedCarritoIds.includes(carrito.id);

                      return (
                        <button
                          key={carrito.id}
                          type="button"
                          onClick={() => selectCarrito(carrito.id)}
                          className={[
                            "grid gap-2 rounded-[12px] border px-2.5 py-2 text-left transition md:grid-cols-[30px_1.1fr_1fr_110px_140px]",
                            checked
                              ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                              : "border-black/10 bg-[#f8fafc] hover:bg-white"
                          ].join(" ")}
                        >
                          <div
                            className={[
                              "flex h-7 w-7 items-center justify-center rounded-[9px] border text-[11px] font-semibold",
                              checked
                                ? "border-[#4f7c90] bg-[#4f7c90] text-white"
                                : "border-black/10 bg-white text-[#94a3b8]"
                            ].join(" ")}
                          >
                            {checked ? "✓" : ""}
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[#172033]">
                              {carrito.clientes?.nombre_completo || "Sin cliente"}
                            </div>

                            <div className="truncate text-[11px] font-medium text-[#4f7c90]">
                              {carrito.numero_carrito}
                            </div>

                            <div className="truncate text-[10.5px] font-normal text-[#64748b]">
                              {carrito.vendedor || "Sin vendedor"}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[#172033]">
                              {carrito.destino || "Sin destino"}
                            </div>

                            <div className="truncate text-[11px] font-normal text-[#64748b]">
                              {carrito.servicio || "Sin servicio"} ·{" "}
                              {formatDateAR(carrito.fecha_venta)}
                            </div>
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[#172033]">
                              {catalogos.sucursales.find((item) => item.id === carrito.sucursal_id)
                                ?.nombre || "Sin sucursal"}
                            </div>

                            <div className="truncate text-[11px] font-normal text-[#64748b]">
                              {carrito.moneda}
                            </div>
                          </div>

                          <div className="text-right">
                            <div className="text-[12px] font-semibold text-[#172033]">
                              {formatMoneyAR(control?.importe_a_facturar, carrito.moneda)}
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">A facturar</div>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            ) : null}

            <div className="mt-4 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-[12px]">
              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">Neto gravado</span>
                <strong className="font-semibold text-[#172033]">
                  {formatMoneyAR(inputNeto, draft.moneda)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">IVA {inputAlicuota}%</span>
                <strong className="font-semibold text-[#172033]">
                  {formatMoneyAR(inputIva, draft.moneda)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">No gravado</span>
                <strong className="font-semibold text-[#172033]">
                  {formatMoneyAR(inputNoGravado, draft.moneda)}
                </strong>
              </div>

              <div className="flex justify-between gap-3">
                <span className="text-[#64748b]">Exento</span>
                <strong className="font-semibold text-[#172033]">
                  {formatMoneyAR(inputExento, draft.moneda)}
                </strong>
              </div>

              <div className="mt-2 flex justify-between gap-3 border-t border-black/10 pt-2">
                <span className="font-semibold text-[#172033]">Total</span>
                <strong className="font-semibold text-[#4f7c90]">
                  {formatMoneyAR(inputTotal, draft.moneda)}
                </strong>
              </div>
            </div>
          </main>

          <aside className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
            <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Resumen documento</h3>

            <div className="grid gap-3 text-[12px]">
              <div>
                <FieldLabel>Tipo</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {getTipoLabel(draft.tipo_documento)}
                </div>
              </div>

              <div>
                <FieldLabel>Número</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {draft.numero_documento || "—"}
                </div>
              </div>

              <div>
                <FieldLabel>Sucursal / moneda</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {draft.sucursal_id
                    ? catalogos.sucursales.find((item) => item.id === draft.sucursal_id)?.nombre ||
                      "Sin sucursal"
                    : "Todas las sucursales"}
                </div>

                <div className="text-[#64748b]">{draft.moneda}</div>
              </div>

                            <div>
                <FieldLabel>Adjunto</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {draft.archivo ? draft.archivo.name : "Sin archivo"}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-white p-3">
                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">Carritos</span>
                  <strong className="font-semibold text-[#172033]">{selectedCarritos.length}</strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">Neto</span>
                  <strong className="font-semibold text-[#172033]">
                    {formatMoneyAR(inputNeto, draft.moneda)}
                  </strong>
                </div>

                <div className="flex justify-between gap-3">
                  <span className="text-[#64748b]">IVA</span>
                  <strong className="font-semibold text-[#172033]">
                    {formatMoneyAR(inputIva, draft.moneda)}
                  </strong>
                </div>

                <div className="mt-2 flex justify-between gap-3 border-t border-black/10 pt-2">
                  <span className="font-semibold text-[#172033]">Total</span>
                  <strong className="font-semibold text-[#172033]">
                    {formatMoneyAR(inputTotal, draft.moneda)}
                  </strong>
                </div>
              </div>

              {isFacturaCarritos ? (
                <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium text-amber-700">
                  Al seleccionar carritos se completa un importe sugerido, pero podés modificar
                  neto, IVA, no gravado, exento y total manualmente.
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
            onClick={submit}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar documento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CobroMultipleModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const saving = useFacturasCobrarStore((state) => state.saving);
  const catalogos = useFacturasCobrarStore((state) => state.catalogos);

  const getSelectedFacturas = useFacturasCobrarStore((state) => state.getSelectedFacturas);
  const getSelectedTotal = useFacturasCobrarStore((state) => state.getSelectedTotal);
  const getSelectedMoneda = useFacturasCobrarStore((state) => state.getSelectedMoneda);
  const cobrarFacturasSeleccionadas = useFacturasCobrarStore(
    (state) => state.cobrarFacturasSeleccionadas
  );

  const selectedFacturas = useMemo(() => getSelectedFacturas(), [getSelectedFacturas]);
  const selectedTotal = useMemo(() => getSelectedTotal(), [getSelectedTotal]);
  const selectedMoneda = useMemo(() => getSelectedMoneda(), [getSelectedMoneda]);

  const [draft, setDraft] = useState<CobroDraft>(() => createInitialCobroDraft(selectedTotal));

  const importeIngresado =
    draft.forma_cobro === "CASHFLOW" ? selectedTotal : parseMoney(draft.importe_ingresado_banco);

  const retencion = Math.max(selectedTotal - importeIngresado, 0);

  const cajaOptions: SelectOption[] = catalogos.cajas.map((item) => ({
    value: item.id,
    label: item.nombre
  }));

  function setField<K extends keyof CobroDraft>(key: K, value: CobroDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function submit() {
    const ok = await cobrarFacturasSeleccionadas(draft);
    if (ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              Registrar cobro agrupado
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {selectedFacturas.length} factura/s ·{" "}
              {formatMoneyAR(selectedTotal, selectedMoneda || "ARS")}
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

        <div className="mb-4 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Facturas seleccionadas</FieldLabel>

          <div className="grid max-h-44 gap-1.5 overflow-auto pr-1">
            {selectedFacturas.map((factura) => (
              <div
                key={factura.id}
                className="flex items-center justify-between gap-3 rounded-[12px] border border-black/10 bg-white px-2.5 py-2 text-[12px]"
              >
                <div className="min-w-0">
                  <div className="truncate font-semibold text-[#172033]">
                    {factura.numero_documento}
                  </div>

                  <div className="truncate text-[11px] font-normal text-[#64748b]">
                    {factura.sucursal || "Sin sucursal"} · {factura.moneda}
                  </div>
                </div>

                <div className="shrink-0 font-semibold text-[#4f7c90]">
                  {formatMoneyAR(factura.total, factura.moneda)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3">
          <div>
            <FieldLabel>Forma de cobro</FieldLabel>

            <NosturSelect
              value={draft.forma_cobro}
              onChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  forma_cobro: value as CobroDraft["forma_cobro"],
                  importe_ingresado_banco:
                    value === "CASHFLOW"
                      ? String(selectedTotal.toFixed(2)).replace(".", ",")
                      : current.importe_ingresado_banco
                }))
              }
              options={FORMA_COBRO_OPTIONS}
            />
          </div>

          {draft.forma_cobro === "TRANSFERENCIA" ? (
            <>
              <div>
                <FieldLabel>Caja / banco destino</FieldLabel>

                <NosturSelect
                  value={draft.caja_id}
                  onChange={(value) => setField("caja_id", value)}
                  options={cajaOptions}
                  placeholder="Seleccionar caja/banco"
                />
              </div>

              <div>
                <FieldLabel>Importe ingresado realmente al banco</FieldLabel>

                <TextInput
                  value={draft.importe_ingresado_banco}
                  onChange={(value) => setField("importe_ingresado_banco", value)}
                  placeholder="0,00"
                  inputMode="decimal"
                />
              </div>
            </>
          ) : (
            <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[12px] font-medium text-amber-700">
              Cashflow no impacta caja. Marca las facturas como cobradas por el total.
            </div>
          )}

          <div className="grid gap-2.5 md:grid-cols-3">
            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
                Total facturas
              </div>

              <div className="mt-0.5 text-[13px] font-semibold text-[#172033]">
                {formatMoneyAR(selectedTotal, selectedMoneda || "ARS")}
              </div>
            </div>

            <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-emerald-700">
                Ingreso banco
              </div>

              <div className="mt-0.5 text-[13px] font-semibold text-emerald-800">
                {formatMoneyAR(importeIngresado, selectedMoneda || "ARS")}
              </div>
            </div>

            <div className="rounded-[14px] border border-red-200 bg-red-50 p-3">
              <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-red-700">
                Retención
              </div>

              <div className="mt-0.5 text-[13px] font-semibold text-red-800">
                {formatMoneyAR(retencion, selectedMoneda || "ARS")}
              </div>
            </div>
          </div>

          <div>
            <FieldLabel>Referencia</FieldLabel>

            <TextInput
              value={draft.referencia_cobro}
              onChange={(value) => setField("referencia_cobro", value)}
              placeholder="Transferencia, liquidación, referencia bancaria..."
            />
          </div>

          <div>
            <FieldLabel>Observaciones</FieldLabel>

            <TextArea
              value={draft.observaciones}
              onChange={(value) => setField("observaciones", value)}
              placeholder="Notas del cobro..."
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
            onClick={submit}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Registrar cobro"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FacturaDetailPanel({
  factura,
  saving,
  onCobrar,
  onAdjuntarArchivo
}: {
  factura: FacturaCobrar | null;
  saving: boolean;
  onCobrar: (factura: FacturaCobrar) => void;
  onAdjuntarArchivo: (factura: FacturaCobrar, archivo: File) => Promise<void>;
}) {
  if (!factura) {
    return (
      <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
          Seleccioná una factura para ver el detalle.
        </div>
      </aside>
    );
  }

  const cobrada = factura.cobrado || factura.estado === "COBRADA";

  return (
    <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px] bg-[#4f7c90] text-[13px] font-semibold text-white shadow-sm">
            {getInitials(factura.razon_social || "A")}
          </div>

          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-semibold text-[#172033]">
              {factura.numero_documento}
            </h2>

            <p className="truncate text-[11.5px] font-normal text-[#64748b]">
              {getTipoLabel(factura.tipo_documento)} · {factura.sucursal || "Sin sucursal"}
            </p>
          </div>
        </div>

        {cobrada ? (
          <StatusBadge type="ok">Cobrada</StatusBadge>
        ) : (
          <StatusBadge type="pending">Pendiente</StatusBadge>
        )}
      </div>

      <div className="grid gap-2.5 text-[12px]">
        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Documento</FieldLabel>

          <div className="font-semibold text-[#172033]">
            {getTipoLabel(factura.tipo_documento)}
          </div>

          <div className="mt-0.5 text-[#64748b]">A: {factura.razon_social}</div>

          <div className="text-[#64748b]">
            Período: {getMonthName(factura.mes)} {factura.anio || ""}
          </div>
        </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Documento adjunto</FieldLabel>

          {factura.archivo_url ? (
            <a
              href={factura.archivo_url}
              target="_blank"
              rel="noreferrer"
              className="mb-2 flex items-center justify-between gap-3 rounded-[12px] border border-[#4f7c90]/20 bg-[#eef6f7] px-3 py-2 text-[12px] font-medium text-[#4f7c90] hover:bg-[#e3f0f2]"
            >
              <span className="min-w-0">
                <span className="block font-semibold text-[#172033]">Ver archivo</span>
                <span className="block truncate font-normal text-[#64748b]">
                  {factura.archivo_nombre || "Documento"}
                </span>
              </span>

              <Download size={15} className="shrink-0" />
            </a>
          ) : (
            <div className="mb-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] font-medium text-amber-700">
              No hay PDF/archivo adjunto para este documento.
            </div>
          )}

          <label className="flex h-8 cursor-pointer items-center justify-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#eef6f7]">
            <Paperclip size={13} className="text-[#4f7c90]" />

            {factura.archivo_url ? "Reemplazar archivo" : "Adjuntar archivo"}

            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={saving}
              onChange={(event) => {
                const archivo = event.target.files?.[0] || null;
                event.target.value = "";

                if (!archivo) return;

                void onAdjuntarArchivo(factura, archivo);
              }}
            />
          </label>
        </div>

        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Importes</FieldLabel>

          <div className="flex justify-between gap-3">
            <span className="text-[#64748b]">Neto</span>
            <strong className="font-semibold text-[#172033]">
              {formatMoneyAR(factura.neto_gravado, factura.moneda)}
            </strong>
          </div>

          <div className="flex justify-between gap-3">
            <span className="text-[#64748b]">IVA</span>
            <strong className="font-semibold text-[#172033]">
              {formatMoneyAR(factura.iva_importe, factura.moneda)}
            </strong>
          </div>

          <div className="mt-2 flex justify-between gap-3 border-t border-black/10 pt-2">
            <span className="font-semibold text-[#172033]">Total</span>
            <strong className="font-semibold text-[#4f7c90]">
              {formatMoneyAR(factura.total, factura.moneda)}
            </strong>
          </div>
        </div>

        {factura.facturas_cobrar_carritos && factura.facturas_cobrar_carritos.length > 0 ? (
          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Carritos incluidos</FieldLabel>

            <div className="grid max-h-[260px] gap-1.5 overflow-auto pr-1">
              {factura.facturas_cobrar_carritos.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[12px] border border-black/10 bg-white px-2.5 py-2"
                >
                  <div className="text-[12px] font-semibold text-[#172033]">
                    {item.numero_carrito}
                  </div>

                  <div className="truncate text-[11px] font-normal text-[#64748b]">
                    {item.pasajero || "Sin pasajero"}
                  </div>

                  <div className="mt-0.5 text-[12px] font-semibold text-[#4f7c90]">
                    {formatMoneyAR(item.importe_facturado, item.moneda)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-amber-700">
            <FieldLabel>Vínculo a carritos</FieldLabel>

            <div className="text-[12px] font-medium">
              Esta factura no tiene carritos vinculados en la importación histórica.
            </div>
          </div>
        )}

        {cobrada ? (
          <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-emerald-700">
            <FieldLabel>Detalle cobro</FieldLabel>

            <div className="font-semibold">{factura.forma_cobro || "Cobrado"}</div>

            <div className="mt-0.5">
              {factura.no_impacta_caja ? "Cashflow · no impacta caja" : factura.caja || "Sin caja"}
            </div>

            <div>{factura.referencia_cobro || "Sin referencia"}</div>

            <div className="mt-1 text-[11px] font-medium">
              Fecha cobro: {formatDateAR(factura.cobrado_at)}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => onCobrar(factura)}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
          >
            Registrar cobro individual
          </button>
        )}

        {factura.observaciones ? (
          <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
            <FieldLabel>Observaciones</FieldLabel>

            <div className="whitespace-pre-wrap font-normal leading-relaxed text-[#334155]">
              {factura.observaciones}
            </div>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function GrupoMonedaCard({
  grupo,
  sucursal,
  onCobrarSeleccionadas
}: {
  grupo: FacturasGrupoMoneda;
  sucursal: FacturasGrupoSucursal;
  onCobrarSeleccionadas: () => void;
}) {
  const selectedFacturaIds = useFacturasCobrarStore((state) => state.selectedFacturaIds);
  const toggleFacturaSelection = useFacturasCobrarStore((state) => state.toggleFacturaSelection);
  const selectFactura = useFacturasCobrarStore((state) => state.selectFactura);

  const tieneSeleccion = grupo.cantidadSeleccionada > 0;

  return (
    <div className="rounded-[16px] border border-black/10 bg-white/82 p-3 shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[14px] font-semibold text-[#172033]">{grupo.moneda}</div>

          <div className="mt-0.5 text-[11.5px] font-normal text-[#64748b]">
            {grupo.facturas.length} factura/s · Total {formatMoneyAR(grupo.total, grupo.moneda)}
          </div>
        </div>

        <div className="shrink-0 rounded-[12px] border border-[#4f7c90]/20 bg-[#eef6f7] px-3 py-1.5 text-right">
          <div className="text-[9.5px] font-medium uppercase tracking-[0.12em] text-[#4f7c90]">
            Seleccionado
          </div>

          <div className="text-[13px] font-semibold text-[#172033]">
            {formatMoneyAR(grupo.totalSeleccionado, grupo.moneda)}
          </div>
        </div>
      </div>

      <div className="grid gap-1.5">
        {grupo.facturas.map((factura) => {
          const checked = selectedFacturaIds.includes(factura.id);
          const cobrada = factura.cobrado || factura.estado === "COBRADA";

          return (
            <div
              key={factura.id}
              className={[
                "grid min-w-0 items-center gap-2 rounded-[12px] border px-2.5 py-2 text-[12px] transition md:grid-cols-[32px_1.1fr_1fr_128px_94px_34px]",
                checked ? "border-[#4f7c90]/50 bg-[#eef6f7]" : "border-black/10 bg-[#f8fafc]"
              ].join(" ")}
            >
              <button
                type="button"
                disabled={cobrada}
                onClick={() => toggleFacturaSelection(factura.id)}
                className={[
                  "flex h-7 w-7 items-center justify-center rounded-[9px] border text-[11px] font-semibold",
                  checked
                    ? "border-[#4f7c90] bg-[#4f7c90] text-white"
                    : cobrada
                      ? "border-black/10 bg-white text-[#cbd5e1]"
                      : "border-black/10 bg-white text-[#94a3b8] hover:border-[#4f7c90]"
                ].join(" ")}
                title={cobrada ? "Factura ya cobrada" : "Seleccionar factura"}
              >
                {checked ? "✓" : ""}
              </button>

              <div className="min-w-0">
                <div className="truncate font-semibold text-[#172033]">
                  {factura.numero_documento}
                </div>

                <div className="truncate text-[10.5px] font-medium text-[#4f7c90]">
                  {getTipoLabel(factura.tipo_documento)}
                </div>
              </div>

              <div className="min-w-0">
                <div className="truncate font-medium text-[#334155]">{factura.razon_social}</div>

                <div className="truncate text-[10.5px] font-normal text-[#64748b]">
                  {sucursal.sucursal}
                </div>
              </div>

              <div className="text-right font-semibold text-[#172033]">
                {formatMoneyAR(factura.total, factura.moneda)}
              </div>

              <div className="flex justify-end">
                {cobrada ? (
                  <StatusBadge type="ok">Cobrada</StatusBadge>
                ) : (
                  <StatusBadge type="pending">Pendiente</StatusBadge>
                )}
              </div>

              <IconButton icon={Eye} label="Ver detalle" onClick={() => selectFactura(factura.id)} />
            </div>
          );
        })}
      </div>

      {tieneSeleccion ? (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#4f7c90]/20 bg-[#eef6f7] p-3">
          <div>
            <div className="text-[12px] font-semibold text-[#172033]">
              {grupo.cantidadSeleccionada} seleccionada/s
            </div>

            <div className="text-[11px] font-normal text-[#64748b]">
              Total seleccionado: {formatMoneyAR(grupo.totalSeleccionado, grupo.moneda)}
            </div>
          </div>

          <button
            type="button"
            onClick={onCobrarSeleccionadas}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-3 text-[11.5px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
          >
            Registrar cobro
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function FacturasCobrarPanel() {
  const loading = useFacturasCobrarStore((state) => state.loading);
  const saving = useFacturasCobrarStore((state) => state.saving);

  const error = useFacturasCobrarStore((state) => state.error);
  const filters = useFacturasCobrarStore((state) => state.filters);
  const selectedTab = useFacturasCobrarStore((state) => state.selectedTab);
  const selectedFacturaId = useFacturasCobrarStore((state) => state.selectedFacturaId);
  const selectedFacturaIds = useFacturasCobrarStore((state) => state.selectedFacturaIds);
  const catalogos = useFacturasCobrarStore((state) => state.catalogos);
  const retenciones = useFacturasCobrarStore((state) => state.retenciones);
    const loadFacturas = useFacturasCobrarStore((state) => state.loadFacturas);

   const adjuntarArchivoFactura = useFacturasCobrarStore(
    (state) => state.adjuntarArchivoFactura
  );
  const setTab = useFacturasCobrarStore((state) => state.setTab);
  const setFilter = useFacturasCobrarStore((state) => state.setFilter);
  const clearError = useFacturasCobrarStore((state) => state.clearError);
  const clearSelection = useFacturasCobrarStore((state) => state.clearSelection);
  const selectFactura = useFacturasCobrarStore((state) => state.selectFactura);
  const selectOnlyFactura = useFacturasCobrarStore((state) => state.selectOnlyFactura);
  const goToPreviousMonth = useFacturasCobrarStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useFacturasCobrarStore((state) => state.goToNextMonth);
  const goToCurrentMonth = useFacturasCobrarStore((state) => state.goToCurrentMonth);

  const getFilteredFacturas = useFacturasCobrarStore((state) => state.getFilteredFacturas);
  const getFacturasAgrupadas = useFacturasCobrarStore((state) => state.getFacturasAgrupadas);

  const facturas = getFilteredFacturas();
  const grupos = getFacturasAgrupadas();

  const selectedFactura = useMemo(() => {
    if (!selectedFacturaId) return facturas[0] || null;
    return facturas.find((factura) => factura.id === selectedFacturaId) || facturas[0] || null;
  }, [facturas, selectedFacturaId]);

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [documentModalOpen, setDocumentModalOpen] = useState(false);
  const [cobroModalOpen, setCobroModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const mesActual = filters.mes;
  const anioActual = filters.anio;

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function reloadAfterFilterChange(callback: () => void) {
    callback();
    selectFactura(null);
    clearSelection();

    window.setTimeout(() => {
      void loadFacturas();
    }, 0);
  }

  function handleTab(tab: FacturasTab) {
    reloadAfterFilterChange(() => setTab(tab));
  }

  function openCobroForFactura(factura: FacturaCobrar) {
    selectOnlyFactura(factura.id);
    setCobroModalOpen(true);
  }

    async function handleAdjuntarArchivoFactura(factura: FacturaCobrar, archivo: File) {
    const ok = await adjuntarArchivoFactura(factura, archivo);

    if (ok) {
      showToast("Archivo adjuntado correctamente.");
    }
  }

  useEffect(() => {
    void loadFacturas();
  }, [loadFacturas]);

  const sucursalOptions: SelectOption[] = [
    { value: "todos", label: "Todas" },
    ...catalogos.sucursales.map((item) => ({
      value: item.id,
      label: item.nombre
    }))
  ];

  const selectedCount = selectedFacturaIds.length;

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Facturas a cobrar
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Almundo
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Sucursales, monedas, cobros agrupados y retenciones.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void loadFacturas()}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={() => setDocumentModalOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Nuevo documento
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
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex h-8 overflow-hidden rounded-[12px] border border-black/10 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => reloadAfterFilterChange(() => goToPreviousMonth())}
                  className="h-7 rounded-[9px] px-2.5 text-[11px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  Mes anterior
                </button>

                <div className="flex h-7 min-w-[124px] items-center justify-center rounded-[9px] bg-[#172033] px-3 text-[11px] font-medium text-white">
                  {getMonthYearLabel(mesActual, anioActual)}
                </div>

                <button
                  type="button"
                  onClick={() => reloadAfterFilterChange(() => goToNextMonth())}
                  className="h-7 rounded-[9px] px-2.5 text-[11px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  Mes siguiente
                </button>
              </div>

              <button
                type="button"
                onClick={() => reloadAfterFilterChange(() => goToCurrentMonth())}
                className="h-8 rounded-[10px] bg-[#4f7c90] px-3 text-[11px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
              >
                Este mes
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <div className="flex h-8 overflow-hidden rounded-[12px] border border-black/10 bg-white p-0.5 shadow-sm">
                <button
                  type="button"
                  onClick={() => handleTab("PENDIENTE")}
                  className={[
                    "flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition",
                    selectedTab === "PENDIENTE"
                      ? "bg-[#4f7c90] text-white"
                      : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#172033]"
                  ].join(" ")}
                >
                  <ReceiptText size={12} strokeWidth={1.8} />
                  Pendientes
                </button>

                <button
                  type="button"
                  onClick={() => handleTab("COBRADA")}
                  className={[
                    "flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition",
                    selectedTab === "COBRADA"
                      ? "bg-emerald-700 text-white"
                      : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#172033]"
                  ].join(" ")}
                >
                  <Archive size={12} strokeWidth={1.8} />
                  Cobradas
                </button>

                <button
                  type="button"
                  onClick={() => handleTab("RETENCIONES")}
                  className={[
                    "flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition",
                    selectedTab === "RETENCIONES"
                      ? "bg-red-600 text-white"
                      : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#172033]"
                  ].join(" ")}
                >
                  <ShieldCheck size={12} strokeWidth={1.8} />
                  Retenciones
                </button>
              </div>

              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
              >
                {filtersOpen ? "Ocultar" : "Mostrar"}
                <ChevronsUpDown size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <>
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_1fr_1fr]">
                <div>
                  <FieldLabel>Moneda</FieldLabel>
                  <NosturSelect
                    value={filters.moneda}
                    onChange={(value) => setFilter("moneda", value as typeof filters.moneda)}
                    options={MONEDA_OPTIONS}
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
                  <FieldLabel>Estado</FieldLabel>
                  <NosturSelect
                    value={filters.estado}
                    onChange={(value) => setFilter("estado", value as typeof filters.estado)}
                    options={ESTADO_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <NosturSelect
                    value={filters.tipoDocumento}
                    onChange={(value) =>
                      setFilter("tipoDocumento", value as typeof filters.tipoDocumento)
                    }
                    options={TIPO_DOCUMENTO_OPTIONS}
                  />
                </div>

                <div>
                  <FieldLabel>Período</FieldLabel>
                  <div className="flex h-8 items-center rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#334155]">
                    {getMonthYearLabel(mesActual, anioActual)}
                  </div>
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por número, tipo, sucursal, observación..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => void loadFacturas()}
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

        {selectedTab !== "RETENCIONES" && selectedCount > 0 ? (
          <section className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-[#4f7c90]/20 bg-[#eef6f7] p-3">
            <div>
              <div className="text-[13px] font-semibold text-[#172033]">
                {selectedCount} factura/s seleccionada/s
              </div>

              <div className="text-[11.5px] font-normal text-[#64748b]">
                Se pueden agrupar solamente facturas de la misma sucursal y moneda.
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
              >
                Limpiar selección
              </button>

              <button
                type="button"
                onClick={() => setCobroModalOpen(true)}
                className="h-8 rounded-[10px] bg-[#4f7c90] px-3 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
              >
                Registrar cobro agrupado
              </button>
            </div>
          </section>
        ) : null}

        {selectedTab === "RETENCIONES" ? (
          <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">
                  Retenciones registradas
                </h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${retenciones.length} retenciones encontradas`}
                </p>
              </div>

              <div className="rounded-[10px] bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b] ring-1 ring-black/10">
                {getMonthYearLabel(filters.mes, filters.anio)}
              </div>
            </div>

            {retenciones.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay retenciones registradas para este período.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {retenciones.map((retencion) => (
                  <div
                    key={retencion.id}
                    className="grid gap-2 rounded-[12px] border border-black/10 bg-[#f8fafc] px-2.5 py-2 text-[12px] md:grid-cols-[104px_1fr_1fr_118px_118px_118px]"
                  >
                    <div>
                      <div className="font-semibold text-[#172033]">
                        {formatDateAR(retencion.fecha_cobro)}
                      </div>
                      <div className="text-[10.5px] font-normal text-[#64748b]">Fecha</div>
                    </div>

                    <div>
                      <div className="font-semibold text-[#172033]">
                        {retencion.numero_documento}
                      </div>
                      <div className="text-[10.5px] font-normal text-[#64748b]">Factura</div>
                    </div>

                    <div>
                      <div className="font-semibold text-[#172033]">
                        {retencion.sucursal || "Sin sucursal"}
                      </div>
                      <div className="text-[10.5px] font-normal text-[#64748b]">
                        {retencion.moneda}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-[#172033]">
                        {formatMoneyAR(retencion.importe_factura, retencion.moneda)}
                      </div>
                      <div className="text-[10.5px] font-normal text-[#64748b]">Factura</div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-emerald-700">
                        {formatMoneyAR(retencion.importe_cobrado, retencion.moneda)}
                      </div>
                      <div className="text-[10.5px] font-normal text-[#64748b]">Cobrado</div>
                    </div>

                    <div className="text-right">
                      <div className="font-semibold text-red-700">
                        {formatMoneyAR(retencion.importe_retencion, retencion.moneda)}
                      </div>
                      <div className="text-[10.5px] font-normal text-[#64748b]">Retención</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : (
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
            <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">
                    {selectedTab === "COBRADA" ? "Facturas cobradas" : "Documentos a cobrar"}
                  </h2>

                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    {loading ? "Cargando..." : `${facturas.length} documentos encontrados`}
                  </p>
                </div>

                <div className="rounded-[10px] bg-white px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b] ring-1 ring-black/10">
                  {getMonthYearLabel(filters.mes, filters.anio)}
                </div>
              </div>

              {loading ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  Cargando facturas...
                </div>
              ) : grupos.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  No hay documentos para los filtros seleccionados.
                </div>
              ) : (
                <div className="grid gap-3">
                  {grupos.map((grupo) => (
                    <div
                      key={grupo.sucursalId || "sin-sucursal"}
                      className="rounded-[16px] border border-black/10 bg-white/70 p-3"
                    >
                      <div className="mb-2.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <Wallet size={16} className="text-[#4f7c90]" />

                          <h3 className="text-[14px] font-semibold text-[#172033]">
                            {grupo.sucursal}
                          </h3>
                        </div>

                        <span className="rounded-[10px] bg-[#f8fafc] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
                          {grupo.monedas.reduce((total, item) => total + item.facturas.length, 0)}{" "}
                          factura/s
                        </span>
                      </div>

                      <div className="grid gap-2.5">
                        {grupo.monedas.map((monedaGrupo) => (
                          <GrupoMonedaCard
                            key={`${grupo.sucursalId || "sin-sucursal"}-${monedaGrupo.moneda}`}
                            grupo={monedaGrupo}
                            sucursal={grupo}
                            onCobrarSeleccionadas={() => setCobroModalOpen(true)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

           <FacturaDetailPanel
  factura={selectedFactura}
  saving={saving}
  onCobrar={openCobroForFactura}
  onAdjuntarArchivo={handleAdjuntarArchivoFactura}
/>
          </div>
        )}
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />

      {documentModalOpen ? (
        <DocumentoModal
          onClose={() => setDocumentModalOpen(false)}
          onSaved={() => {
            setDocumentModalOpen(false);
            showToast("Documento creado correctamente.");
          }}
        />
      ) : null}

      {cobroModalOpen ? (
        <CobroMultipleModal
          onClose={() => setCobroModalOpen(false)}
          onSaved={() => {
            setCobroModalOpen(false);
            showToast("Cobro registrado correctamente.");
          }}
        />
      ) : null}
    </div>
  );
}

export default FacturasCobrarPanel;