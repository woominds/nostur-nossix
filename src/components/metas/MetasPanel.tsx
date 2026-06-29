import { useEffect, useMemo, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Building2,
  CalendarClock,
  ChevronDown,
  ChevronsUpDown,
  Copy,
  Edit3,
  Plus,
  RefreshCcw,
  Search,
  Target,
  Trash2,
  Trophy,
  UsersRound,
  X
} from "lucide-react";
import {
  getWeekRangeFromDate,
  monthEnd,
  monthStart,
  useMetasStore,
  type CreateMetaDraft,
  type MetaDraft,
  type MetaResumen,
  type MetaTipo
} from "../../store/metasStore";
import { IconButton } from "../ui/IconButton";
import { formatMoneyAR } from "../../lib/formatters";
import { NosturDateInput } from "../ui/NosturDateInput";

/* =========================================================
   NOSSIX / NOSTUR — METAS
   Editables + upsert + memoria período anterior
========================================================= */

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

const TIPO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  { value: "VENDEDOR_SEMANAL", label: "Vendedor semanal" },
  { value: "VENDEDOR_MENSUAL", label: "Vendedor mensual" },
  { value: "SUCURSAL_MENSUAL", label: "Utilidad sucursal" },
  { value: "ALMUNDO_MENSUAL", label: "Meta Almundo" }
];

const TIPO_CREATE_OPTIONS: SelectOption[] = [
  { value: "ALMUNDO_MENSUAL", label: "Meta Almundo por sucursal" },
  { value: "SUCURSAL_MENSUAL", label: "Meta utilidad por sucursal" },
  { value: "VENDEDOR_MENSUAL", label: "Meta mensual vendedores" },
  { value: "VENDEDOR_SEMANAL", label: "Meta semanal vendedores" }
];

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "ACTIVA", label: "Activas" },
  { value: "INACTIVA", label: "Inactivas" },
  { value: "VENCIDA", label: "Vencidas" },
  { value: "FUTURA", label: "Futuras" }
];

/* =========================================================
   HELPERS
========================================================= */

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatInputMoney(value: string | number | null | undefined): string {
  const parsed = parseMoney(value);
  if (!parsed) return "";

  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsed);
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getMonthYearLabel(mes: string, anio: string): string {
  const monthIndex = Number(mes) - 1;
  return `${MONTH_NAMES[monthIndex] || "Mes"} ${anio}`;
}

function getNombreCompleto(profile?: { nombre?: string; apellido?: string; email?: string } | null): string {
  if (!profile) return "Todos los vendedores";

  return `${profile.nombre || ""} ${profile.apellido || ""}`.trim() || profile.email || "Vendedor";
}

function getTipoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    VENDEDOR_SEMANAL: "Vendedor semanal",
    VENDEDOR_MENSUAL: "Vendedor mensual",
    SUCURSAL_MENSUAL: "Utilidad sucursal",
    ALMUNDO_MENSUAL: "Meta Almundo"
  };

  return labels[tipo] || tipo;
}

function getBaseLabel(tipo: MetaTipo): string {
  if (tipo === "ALMUNDO_MENSUAL") return "Facturación total Almundo · Carritos";
  if (tipo === "VENDEDOR_SEMANAL") return "Meta semanal general o por vendedor";
  if (tipo === "VENDEDOR_MENSUAL") return "Comisiones vendedores 8% / 10% / 12%";
  return "Importe a facturar mensual por sucursal";
}

function getEstadoType(estado: string): "ok" | "pending" | "danger" | "neutral" {
  if (estado === "ACTIVA") return "ok";
  if (estado === "FUTURA") return "neutral";
  if (estado === "VENCIDA") return "pending";
  return "danger";
}

function applyMonthlyPeriod(mes: string, anio: string) {
  return {
    mes,
    anio,
    fecha_desde: monthStart(anio, mes),
    fecha_hasta: monthEnd(anio, mes)
  };
}

/* =========================================================
   UI BASE
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
    <div className={["relative", open ? "z-[160]" : "z-0"].join(" ")}>
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

          <div className="absolute left-0 right-0 top-[36px] z-[170] max-h-56 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-xl">
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
    neutral: "border-sky-200 bg-sky-50 text-sky-700"
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

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "blue"
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  tone?: "orange" | "blue" | "green" | "red" | "amber" | "slate";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-nostur-orange ring-orange-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-50 text-slate-700 ring-slate-100"
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
   DRAFTS
========================================================= */

function buildInitialDraft(selected: MetaResumen | null): MetaDraft {
  const meta = selected?.meta;
  const isVendedor = meta?.tipo === "VENDEDOR_MENSUAL" || meta?.tipo === "VENDEDOR_SEMANAL";

  return {
    sucursal_id: meta?.sucursal_id || "",
    vendedor_id: meta?.vendedor_id || "",
    alcance: isVendedor && meta?.vendedor_id ? "ESPECIFICO" : "TODOS",
    fecha_desde: meta?.fecha_desde || "",
    fecha_hasta: meta?.fecha_hasta || "",
    mes: meta?.mes ? String(meta.mes).padStart(2, "0") : "",
    anio: meta?.anio ? String(meta.anio) : "",
    meta_unica_usd: formatInputMoney(meta?.meta_unica_usd),
    meta_piso_usd: formatInputMoney(meta?.meta_piso_usd),
    meta_medio_usd: formatInputMoney(meta?.meta_medio_usd),
    meta_logrado_usd: formatInputMoney(meta?.meta_logrado_usd),
    comision_piso_pct: String(meta?.comision_piso_pct ?? "8").replace(".", ","),
    comision_medio_pct: String(meta?.comision_medio_pct ?? "10").replace(".", ","),
    comision_logrado_pct: String(meta?.comision_logrado_pct ?? "12").replace(".", ","),
    activa: meta?.activa ?? true,
    observaciones: meta?.observaciones || ""
  };
}

function buildInitialCreateDraft(mes: string, anio: string): CreateMetaDraft {
  return {
    tipo: "ALMUNDO_MENSUAL",
    alcance: "ESPECIFICO",
    sucursal_id: "",
    vendedor_id: "",
    fecha_desde: monthStart(anio, mes),
    fecha_hasta: monthEnd(anio, mes),
    mes,
    anio,
    meta_unica_usd: "",
    meta_piso_usd: "",
    meta_medio_usd: "",
    meta_logrado_usd: "",
    comision_piso_pct: "8",
    comision_medio_pct: "10",
    comision_logrado_pct: "12",
    observaciones: ""
  };
}

/* =========================================================
   MODAL CREAR / ACTUALIZAR META
========================================================= */

function MetaCreateModal({
  onClose,
  onSaved
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const saving = useMetasStore((state) => state.saving);
  const filters = useMetasStore((state) => state.filters);
  const catalogos = useMetasStore((state) => state.catalogos);
  const createMeta = useMetasStore((state) => state.createMeta);

  const [draft, setDraft] = useState<CreateMetaDraft>(() =>
    buildInitialCreateDraft(filters.mes, filters.anio)
  );

  const isVendedor = draft.tipo === "VENDEDOR_MENSUAL" || draft.tipo === "VENDEDOR_SEMANAL";
  const isSucursal = draft.tipo === "SUCURSAL_MENSUAL" || draft.tipo === "ALMUNDO_MENSUAL";
  const isWeekly = draft.tipo === "VENDEDOR_SEMANAL";
  const isAlmundo = draft.tipo === "ALMUNDO_MENSUAL";
  const isMonthlySeller = draft.tipo === "VENDEDOR_MENSUAL";

  const sucursalOptions: SelectOption[] = catalogos.sucursales.map((item) => ({
    value: item.id,
    label: item.nombre
  }));

  const vendedorOptions: SelectOption[] = catalogos.vendedores.map((item) => ({
    value: item.id,
    label: getNombreCompleto(item)
  }));

  function setField<K extends keyof CreateMetaDraft>(key: K, value: CreateMetaDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function setPeriodo(mes: string, anio: string) {
    const period = applyMonthlyPeriod(mes, anio);

    setDraft((current) => ({
      ...current,
      ...period
    }));
  }

  function handleWeeklyStart(value: string) {
    const range = getWeekRangeFromDate(value);
    const mes = range.fecha_desde ? range.fecha_desde.slice(5, 7) : draft.mes;
    const anio = range.fecha_desde ? range.fecha_desde.slice(0, 4) : draft.anio;

    setDraft((current) => ({
      ...current,
      ...range,
      mes,
      anio
    }));
  }

  function handleTipoChange(value: string) {
    const tipo = value as MetaTipo;
    const nextIsVendedor = tipo === "VENDEDOR_MENSUAL" || tipo === "VENDEDOR_SEMANAL";
    const nextIsWeekly = tipo === "VENDEDOR_SEMANAL";

    const monthlyPeriod = applyMonthlyPeriod(draft.mes, draft.anio);
    const weeklyPeriod = getWeekRangeFromDate(monthlyPeriod.fecha_desde);

    setDraft((current) => ({
      ...current,
      tipo,
      alcance: nextIsVendedor ? "TODOS" : "ESPECIFICO",
      sucursal_id: "",
      vendedor_id: "",
      fecha_desde: nextIsWeekly ? weeklyPeriod.fecha_desde : monthlyPeriod.fecha_desde,
      fecha_hasta: nextIsWeekly ? weeklyPeriod.fecha_hasta : monthlyPeriod.fecha_hasta,
      mes: nextIsWeekly ? weeklyPeriod.fecha_desde.slice(5, 7) : monthlyPeriod.mes,
      anio: nextIsWeekly ? weeklyPeriod.fecha_desde.slice(0, 4) : monthlyPeriod.anio,
      meta_unica_usd: "",
      meta_piso_usd: "",
      meta_medio_usd: "",
      meta_logrado_usd: "",
      observaciones: ""
    }));
  }

  async function submit() {
    const ok = await createMeta(draft);

    if (ok) onSaved();
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-8 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-56px)] w-full max-w-4xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Crear o actualizar meta</h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Si ya existe una meta igual para ese período, se actualiza. No duplica.
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

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_280px]">
          <main className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <FieldLabel>Tipo de meta</FieldLabel>
                <NosturSelect value={draft.tipo} onChange={handleTipoChange} options={TIPO_CREATE_OPTIONS} />
              </div>

              <div>
                <FieldLabel>Período</FieldLabel>
                <div className="grid grid-cols-[1fr_90px] gap-2">
                  <NosturSelect
                    value={draft.mes}
                    onChange={(value) => setPeriodo(value, draft.anio)}
                    options={MONTH_NAMES.map((month, index) => ({
                      value: String(index + 1).padStart(2, "0"),
                      label: month
                    }))}
                  />

                  <TextInput
                    value={draft.anio}
                    onChange={(value) => setPeriodo(draft.mes, value.replace(/\D/g, "").slice(0, 4))}
                    placeholder="2026"
                    inputMode="numeric"
                  />
                </div>
              </div>

              <div>
                <FieldLabel>{isWeekly ? "Lunes de la semana" : "Desde"}</FieldLabel>
                <NosturDateInput
                  value={draft.fecha_desde}
                  onChange={(value) => {
                    if (isWeekly) {
                      handleWeeklyStart(value);
                    } else {
                      setField("fecha_desde", value);
                    }
                  }}
                />
              </div>

              <div>
                <FieldLabel>{isWeekly ? "Domingo automático" : "Hasta"}</FieldLabel>
                <NosturDateInput
                  value={draft.fecha_hasta}
                  onChange={(value) => setField("fecha_hasta", value)}
                />
              </div>

              {isSucursal ? (
                <div className="md:col-span-2">
                  <FieldLabel>Sucursal</FieldLabel>
                  <NosturSelect
                    value={draft.sucursal_id}
                    onChange={(value) => setField("sucursal_id", value)}
                    options={sucursalOptions}
                    placeholder="Seleccionar sucursal"
                  />
                </div>
              ) : null}

              {isVendedor ? (
                <>
                  <div>
                    <FieldLabel>Alcance</FieldLabel>
                    <NosturSelect
                      value={draft.alcance}
                      onChange={(value) => {
                        setDraft((current) => ({
                          ...current,
                          alcance: value as CreateMetaDraft["alcance"],
                          vendedor_id: ""
                        }));
                      }}
                      options={[
                        { value: "TODOS", label: "Todos los vendedores" },
                        { value: "ESPECIFICO", label: "Vendedor específico" }
                      ]}
                    />
                  </div>

                  <div>
                    <FieldLabel>Vendedor</FieldLabel>
                    <NosturSelect
                      value={draft.vendedor_id}
                      onChange={(value) => setField("vendedor_id", value)}
                      options={vendedorOptions}
                      placeholder={draft.alcance === "TODOS" ? "Aplica a todos" : "Seleccionar vendedor"}
                    />
                  </div>
                </>
              ) : null}

              {isWeekly || isAlmundo ? (
                <div className="md:col-span-2">
                  <FieldLabel>{isAlmundo ? "Meta facturación Almundo USD" : "Meta semanal USD"}</FieldLabel>

                  <TextInput
                    value={draft.meta_unica_usd}
                    onChange={(value) => setField("meta_unica_usd", value)}
                    placeholder="0,00"
                    inputMode="decimal"
                  />
                </div>
              ) : (
                <div className="grid gap-3 md:col-span-2 md:grid-cols-3">
                  <div>
                    <FieldLabel>Piso USD</FieldLabel>
                    <TextInput
                      value={draft.meta_piso_usd}
                      onChange={(value) => setField("meta_piso_usd", value)}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <FieldLabel>Medio USD</FieldLabel>
                    <TextInput
                      value={draft.meta_medio_usd}
                      onChange={(value) => setField("meta_medio_usd", value)}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <FieldLabel>Logrado USD</FieldLabel>
                    <TextInput
                      value={draft.meta_logrado_usd}
                      onChange={(value) => setField("meta_logrado_usd", value)}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              )}

              {isMonthlySeller ? (
                <div className="grid gap-3 rounded-[14px] border border-orange-200 bg-orange-50 p-3 md:col-span-2 md:grid-cols-3">
                  <div>
                    <FieldLabel>% Piso</FieldLabel>
                    <TextInput
                      value={draft.comision_piso_pct}
                      onChange={(value) => setField("comision_piso_pct", value)}
                      placeholder="8"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <FieldLabel>% Medio</FieldLabel>
                    <TextInput
                      value={draft.comision_medio_pct}
                      onChange={(value) => setField("comision_medio_pct", value)}
                      placeholder="10"
                      inputMode="decimal"
                    />
                  </div>

                  <div>
                    <FieldLabel>% Logrado</FieldLabel>
                    <TextInput
                      value={draft.comision_logrado_pct}
                      onChange={(value) => setField("comision_logrado_pct", value)}
                      placeholder="12"
                      inputMode="decimal"
                    />
                  </div>
                </div>
              ) : null}

              <div className="md:col-span-2">
                <FieldLabel>Observaciones</FieldLabel>
                <TextArea
                  value={draft.observaciones}
                  onChange={(value) => setField("observaciones", value)}
                  placeholder="Notas internas sobre esta meta..."
                />
              </div>
            </div>
          </main>

          <aside className="rounded-[16px] border border-black/10 bg-white p-3">
            <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Resumen</h3>

            <div className="grid gap-3 text-[12px]">
              <div>
                <FieldLabel>Tipo</FieldLabel>

                <div className="font-semibold text-[#172033]">{getTipoLabel(draft.tipo)}</div>

                <div className="mt-0.5 font-normal leading-relaxed text-[#64748b]">
                  {getBaseLabel(draft.tipo)}
                </div>
              </div>

              <div>
                <FieldLabel>Período</FieldLabel>

                <div className="font-semibold text-[#172033]">{getMonthYearLabel(draft.mes, draft.anio)}</div>

                <div className="mt-0.5 font-normal text-[#64748b]">
                  {formatDate(draft.fecha_desde)} → {formatDate(draft.fecha_hasta)}
                </div>
              </div>

              <div>
                <FieldLabel>Aplica a</FieldLabel>

                <div className="font-semibold text-[#172033]">
                  {isSucursal
                    ? sucursalOptions.find((item) => item.value === draft.sucursal_id)?.label || "Seleccionar sucursal"
                    : draft.alcance === "TODOS"
                      ? "Todos los vendedores"
                      : vendedorOptions.find((item) => item.value === draft.vendedor_id)?.label || "Seleccionar vendedor"}
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
                  Importe principal
                </div>

                <div className="mt-1 text-[18px] font-semibold text-[#4f7c90]">
                  {isWeekly || isAlmundo
                    ? formatMoneyAR(parseMoney(draft.meta_unica_usd), "USD")
                    : formatMoneyAR(parseMoney(draft.meta_logrado_usd), "USD")}
                </div>
              </div>

              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium leading-relaxed text-amber-700">
                Las metas se expresan en USD. Si ya existía una meta igual, este guardado la actualiza.
              </div>
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
            {saving ? "Guardando..." : "Guardar meta"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PANEL LATERAL
========================================================= */

function MetaSidePanel({
  selected,
  saving,
  onSave,
  onDeactivate
}: {
  selected: MetaResumen | null;
  saving: boolean;
  onSave: (draft: MetaDraft) => Promise<void>;
  onDeactivate: () => Promise<void>;
}) {
  const catalogos = useMetasStore((state) => state.catalogos);
  const [draft, setDraft] = useState<MetaDraft>(() => buildInitialDraft(selected));

  useEffect(() => {
    setDraft(buildInitialDraft(selected));
  }, [selected?.meta.id]);

  if (!selected) {
    return (
      <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
          Seleccioná una meta para ver o editar.
        </div>
      </aside>
    );
  }

  const meta = selected.meta;
  const isWeekly = meta.tipo === "VENDEDOR_SEMANAL";
  const isAlmundo = meta.tipo === "ALMUNDO_MENSUAL";
  const isMonthlySeller = meta.tipo === "VENDEDOR_MENSUAL";
  const isVendedor = meta.tipo === "VENDEDOR_MENSUAL" || meta.tipo === "VENDEDOR_SEMANAL";
  const isSucursal = meta.tipo === "SUCURSAL_MENSUAL" || meta.tipo === "ALMUNDO_MENSUAL";

  const sucursalOptions: SelectOption[] = catalogos.sucursales.map((item) => ({
    value: item.id,
    label: item.nombre
  }));

  const vendedorOptions: SelectOption[] = catalogos.vendedores.map((item) => ({
    value: item.id,
    label: getNombreCompleto(item)
  }));

  function setField<K extends keyof MetaDraft>(key: K, value: MetaDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleWeeklyStart(value: string) {
    const range = getWeekRangeFromDate(value);
    const mes = range.fecha_desde ? range.fecha_desde.slice(5, 7) : draft.mes;
    const anio = range.fecha_desde ? range.fecha_desde.slice(0, 4) : draft.anio;

    setDraft((current) => ({
      ...current,
      ...range,
      mes,
      anio
    }));
  }

  return (
    <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] font-semibold text-[#172033]">
            Editar {getTipoLabel(meta.tipo)}
          </h2>

          <p className="mt-0.5 truncate text-[11.5px] font-normal text-[#64748b]">
            {selected.sucursal?.nombre || getNombreCompleto(selected.vendedor)} · Configuración USD
          </p>
        </div>

        <StatusBadge type={getEstadoType(selected.estadoPeriodo)}>{selected.estadoPeriodo}</StatusBadge>
      </div>

      <div className="grid gap-2.5 text-[12px]">
        <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
          <FieldLabel>Base de cálculo</FieldLabel>

          <div className="font-semibold text-[#172033]">{getBaseLabel(meta.tipo)}</div>

          <div className="mt-1 font-normal leading-relaxed text-[#64748b]">
            Esta edición actualiza el registro seleccionado. No crea una meta nueva.
          </div>
        </div>

        {isSucursal ? (
          <div>
            <FieldLabel>Sucursal</FieldLabel>
            <NosturSelect
              value={draft.sucursal_id}
              onChange={(value) => setField("sucursal_id", value)}
              options={sucursalOptions}
              placeholder="Seleccionar sucursal"
            />
          </div>
        ) : null}

        {isVendedor ? (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <FieldLabel>Alcance</FieldLabel>
              <NosturSelect
                value={draft.alcance}
                onChange={(value) =>
                  setDraft((current) => ({
                    ...current,
                    alcance: value as MetaDraft["alcance"],
                    vendedor_id: ""
                  }))
                }
                options={[
                  { value: "TODOS", label: "Todos" },
                  { value: "ESPECIFICO", label: "Vendedor" }
                ]}
              />
            </div>

            <div>
              <FieldLabel>Vendedor</FieldLabel>
              <NosturSelect
                value={draft.vendedor_id}
                onChange={(value) => setField("vendedor_id", value)}
                options={vendedorOptions}
                placeholder={draft.alcance === "TODOS" ? "Aplica a todos" : "Seleccionar"}
              />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <div>
            <FieldLabel>{isWeekly ? "Lunes de la semana" : "Desde"}</FieldLabel>
            <NosturDateInput
              value={draft.fecha_desde}
              onChange={(value) => {
                if (isWeekly) {
                  handleWeeklyStart(value);
                } else {
                  setField("fecha_desde", value);
                }
              }}
            />
          </div>

          <div>
            <FieldLabel>{isWeekly ? "Domingo automático" : "Hasta"}</FieldLabel>
            <NosturDateInput
              value={draft.fecha_hasta}
              onChange={(value) => setField("fecha_hasta", value)}
            />
          </div>
        </div>

        {isWeekly || isAlmundo ? (
          <div>
            <FieldLabel>{isAlmundo ? "Meta facturación Almundo USD" : "Meta semanal USD"}</FieldLabel>

            <TextInput
              value={draft.meta_unica_usd}
              onChange={(value) => setField("meta_unica_usd", value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            <div>
              <FieldLabel>Piso USD</FieldLabel>
              <TextInput
                value={draft.meta_piso_usd}
                onChange={(value) => setField("meta_piso_usd", value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>

            <div>
              <FieldLabel>Medio USD</FieldLabel>
              <TextInput
                value={draft.meta_medio_usd}
                onChange={(value) => setField("meta_medio_usd", value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>

            <div>
              <FieldLabel>Logrado USD</FieldLabel>
              <TextInput
                value={draft.meta_logrado_usd}
                onChange={(value) => setField("meta_logrado_usd", value)}
                placeholder="0,00"
                inputMode="decimal"
              />
            </div>
          </div>
        )}

        {isMonthlySeller ? (
          <div className="grid grid-cols-3 gap-2 rounded-[14px] border border-orange-200 bg-orange-50 p-3">
            <div>
              <FieldLabel>% Piso</FieldLabel>
              <TextInput
                value={draft.comision_piso_pct}
                onChange={(value) => setField("comision_piso_pct", value)}
                placeholder="8"
                inputMode="decimal"
              />
            </div>

            <div>
              <FieldLabel>% Medio</FieldLabel>
              <TextInput
                value={draft.comision_medio_pct}
                onChange={(value) => setField("comision_medio_pct", value)}
                placeholder="10"
                inputMode="decimal"
              />
            </div>

            <div>
              <FieldLabel>% Logrado</FieldLabel>
              <TextInput
                value={draft.comision_logrado_pct}
                onChange={(value) => setField("comision_logrado_pct", value)}
                placeholder="12"
                inputMode="decimal"
              />
            </div>
          </div>
        ) : null}

        <div>
          <FieldLabel>Observaciones</FieldLabel>
          <TextArea
            value={draft.observaciones}
            onChange={(value) => setField("observaciones", value)}
            placeholder="Notas internas de la meta..."
          />
        </div>

        <button
          type="button"
          onClick={() => setField("activa", !draft.activa)}
          className={[
            "h-8 rounded-[10px] border px-3 text-[12px] font-medium transition",
            draft.activa
              ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
              : "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
          ].join(" ")}
        >
          {draft.activa ? "Meta activa" : "Meta inactiva"}
        </button>

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="h-9 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={onDeactivate}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
            title="Desactivar meta"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </aside>
  );
}

/* =========================================================
   PANEL PRINCIPAL
========================================================= */

export function MetasPanel() {
  const loading = useMetasStore((state) => state.loading);
  const saving = useMetasStore((state) => state.saving);
  const error = useMetasStore((state) => state.error);
  const filters = useMetasStore((state) => state.filters);
  const catalogos = useMetasStore((state) => state.catalogos);
  const selectedMetaId = useMetasStore((state) => state.selectedMetaId);

  const loadMetas = useMetasStore((state) => state.loadMetas);
  const saveMeta = useMetasStore((state) => state.saveMeta);
  const deactivateMeta = useMetasStore((state) => state.deactivateMeta);
  const copyPreviousPeriod = useMetasStore((state) => state.copyPreviousPeriod);
  const setFilter = useMetasStore((state) => state.setFilter);
  const clearError = useMetasStore((state) => state.clearError);
  const selectMeta = useMetasStore((state) => state.selectMeta);
  const goToPreviousMonth = useMetasStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useMetasStore((state) => state.goToNextMonth);
  const goToCurrentMonth = useMetasStore((state) => state.goToCurrentMonth);

  const getResumen = useMetasStore((state) => state.getResumen);
  const getSelectedResumen = useMetasStore((state) => state.getSelectedResumen);
  const getMetrics = useMetasStore((state) => state.getMetrics);

  const resumen = getResumen();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const selectedResumen = useMemo(
    () => getSelectedResumen(),
    [resumen, selectedMetaId, getSelectedResumen]
  );

  useEffect(() => {
    loadMetas();
  }, [loadMetas]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
    window.setTimeout(() => setToast(null), 3200);
  }

  function reloadAfterPeriodChange(callback: () => void) {
    callback();

    window.setTimeout(() => {
      loadMetas();
    }, 0);
  }

  async function handleSave(draft: MetaDraft) {
    if (!selectedResumen) return;

    const ok = await saveMeta(selectedResumen.meta, draft);

    if (ok) showToast("Meta guardada correctamente.");
  }

  async function handleDeactivate() {
    if (!selectedResumen) return;

    const ok = await deactivateMeta(selectedResumen.meta.id);

    if (ok) showToast("Meta desactivada correctamente.");
  }

  async function handleCopyPrevious() {
    const ok = await copyPreviousPeriod();

    if (ok) showToast("Metas copiadas del mes anterior.");
  }

  const sucursalOptions: SelectOption[] = [
    { value: "todos", label: "Todas" },
    ...catalogos.sucursales.map((item) => ({
      value: item.id,
      label: item.nombre
    }))
  ];

  const vendedorOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    { value: "general", label: "General / todos los vendedores" },
    ...catalogos.vendedores.map((item) => ({
      value: item.id,
      label: getNombreCompleto(item)
    }))
  ];

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">Metas</h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Configuración
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Objetivos editables en USD para vendedores, sucursales y Almundo.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={loadMetas}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={handleCopyPrevious}
              disabled={saving}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <Copy size={13} />
              Copiar mes anterior
            </button>

            <button
              type="button"
              onClick={() => setCreateModalOpen(true)}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Nueva / actualizar
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
                  onClick={() => reloadAfterPeriodChange(goToPreviousMonth)}
                  className="h-7 rounded-[9px] px-2.5 text-[11px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  Mes anterior
                </button>

                <div className="flex h-7 min-w-[124px] items-center justify-center rounded-[9px] bg-[#172033] px-3 text-[11px] font-medium text-white">
                  {getMonthYearLabel(filters.mes, filters.anio)}
                </div>

                <button
                  type="button"
                  onClick={() => reloadAfterPeriodChange(goToNextMonth)}
                  className="h-7 rounded-[9px] px-2.5 text-[11px] font-medium text-[#334155] transition hover:bg-[#f8fafc]"
                >
                  Mes siguiente
                </button>
              </div>

              <button
                type="button"
                onClick={() => reloadAfterPeriodChange(goToCurrentMonth)}
                className="h-8 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
              >
                Este mes
              </button>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
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
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_1fr]">
                <div>
                  <FieldLabel>Tipo</FieldLabel>

                  <NosturSelect
                    value={filters.tipo}
                    onChange={(value) => setFilter("tipo", value as typeof filters.tipo)}
                    options={TIPO_OPTIONS}
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
                  <FieldLabel>Vendedor</FieldLabel>

                  <NosturSelect
                    value={filters.vendedorId}
                    onChange={(value) => setFilter("vendedorId", value)}
                    options={vendedorOptions}
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
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por tipo, sucursal, vendedor, estado u observación..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadMetas}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Aplicar filtros
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-3 xl:grid-cols-6">
          <MetricCard label="Metas" value={metrics.total} icon={Target} tone="orange" />
          <MetricCard label="Activas" value={metrics.activas} icon={CalendarClock} tone="green" />
          <MetricCard label="Inactivas" value={metrics.inactivas} icon={X} tone="red" />
          <MetricCard label="Vendedores" value={metrics.vendedor} icon={UsersRound} tone="blue" />
          <MetricCard label="Sucursales" value={metrics.sucursal} icon={Building2} tone="green" />
          <MetricCard label="Almundo" value={metrics.almundo} icon={Trophy} tone="amber" />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Listado de metas</h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${resumen.length} metas configuradas`}
                </p>
              </div>

              <div className="rounded-md bg-white px-2 py-1 text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b] ring-1 ring-black/10">
                {getMonthYearLabel(filters.mes, filters.anio)}
              </div>
            </div>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando metas...
              </div>
            ) : resumen.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay metas para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {resumen.map((item) => {
                  const meta = item.meta;
                  const selected = selectedResumen?.meta.id === meta.id;
                  const isWeekly = meta.tipo === "VENDEDOR_SEMANAL";
                  const isMonthlySeller = meta.tipo === "VENDEDOR_MENSUAL";
                  const isAlmundo = meta.tipo === "ALMUNDO_MENSUAL";

                  const appliesTo = item.sucursal?.nombre || getNombreCompleto(item.vendedor);

                  return (
                    <button
                      key={meta.id}
                      type="button"
                      onClick={() => selectMeta(meta.id)}
                      className={[
                        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition lg:grid-cols-[1.25fr_1fr_1.3fr_1fr_100px_44px]",
                        selected
                          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                          : "border-black/10 bg-[#f8fafc] hover:bg-white"
                      ].join(" ")}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {getTipoLabel(meta.tipo)}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {getBaseLabel(meta.tipo)}
                        </div>

                        <div className="truncate text-[10.5px] font-medium text-[#4f7c90]">
                          USD
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {appliesTo}
                        </div>

                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          {formatDate(meta.fecha_desde)} → {formatDate(meta.fecha_hasta)}
                        </div>

                        {meta.vendedor_id ? (
                          <div className="truncate text-[10.5px] font-normal text-[#94a3b8]">
                            Meta particular
                          </div>
                        ) : meta.tipo === "VENDEDOR_MENSUAL" || meta.tipo === "VENDEDOR_SEMANAL" ? (
                          <div className="truncate text-[10.5px] font-normal text-[#94a3b8]">
                            Aplica a todos
                          </div>
                        ) : null}
                      </div>

                      <div className="min-w-0">
                        {isWeekly || isAlmundo ? (
                          <>
                            <div className="text-[12px] font-semibold text-[#172033]">
                              {formatMoneyAR(Number(meta.meta_unica_usd || meta.meta_logrado_usd || 0), "USD")}
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">
                              {isAlmundo ? "Meta facturación" : "Meta semanal única"}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="truncate text-[12px] font-semibold text-[#172033]">
                              P {formatMoneyAR(Number(meta.meta_piso_usd || 0), "USD")} · M{" "}
                              {formatMoneyAR(Number(meta.meta_medio_usd || 0), "USD")} · L{" "}
                              {formatMoneyAR(Number(meta.meta_logrado_usd || 0), "USD")}
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">
                              Piso / Medio / Logrado
                            </div>
                          </>
                        )}
                      </div>

                      <div className="min-w-0">
                        {isMonthlySeller ? (
                          <>
                            <div className="text-[12px] font-semibold text-[#172033]">
                              {String(meta.comision_piso_pct).replace(".", ",")}% ·{" "}
                              {String(meta.comision_medio_pct).replace(".", ",")}% ·{" "}
                              {String(meta.comision_logrado_pct).replace(".", ",")}%
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">
                              Comisión mensual
                            </div>
                          </>
                        ) : meta.tipo === "VENDEDOR_SEMANAL" ? (
                          <>
                            <div className="text-[12px] font-semibold text-[#172033]">
                              Sin comisión
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">
                              Incentivo semanal
                            </div>
                          </>
                        ) : meta.tipo === "ALMUNDO_MENSUAL" ? (
                          <>
                            <div className="text-[12px] font-semibold text-[#172033]">
                              Almundo
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">
                              Carritos
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-[12px] font-semibold text-[#172033]">
                              Sucursal
                            </div>

                            <div className="text-[11px] font-normal text-[#64748b]">
                              Importe a facturar
                            </div>
                          </>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1">
                        <StatusBadge type={getEstadoType(item.estadoPeriodo)}>
                          {item.estadoPeriodo}
                        </StatusBadge>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={Edit3}
                          label="Editar meta"
                          className="text-[#4f7c90]"
                          onClick={(event) => {
                            event.stopPropagation();
                            selectMeta(meta.id);
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          <MetaSidePanel
            selected={selectedResumen}
            saving={saving}
            onSave={handleSave}
            onDeactivate={handleDeactivate}
          />
        </div>
      </main>

      <Toast toast={toast} onClose={() => setToast(null)} />

      {createModalOpen ? (
        <MetaCreateModal
          onClose={() => setCreateModalOpen(false)}
          onSaved={() => {
            setCreateModalOpen(false);
            showToast("Meta guardada correctamente.");
          }}
        />
      ) : null}
    </div>
  );
}

export default MetasPanel;