// src/components/pendientes/PendientesPanel.tsx

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Edit3,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  Undo2,
  X
} from "lucide-react";
import {
  usePendientesStore,
  type Pendiente,
  type PendienteDraft,
  type PrioridadPendiente
} from "../../store/pendientesStore";

/* =========================================================
   NOSSIX / NOSTUR — PENDIENTES
   Estética compacta unificada con Caja / Documentos
========================================================= */

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
} | null;

const PRIORIDAD_OPTIONS: SelectOption[] = [
  { value: "BAJA", label: "Baja" },
  { value: "MEDIA", label: "Media" },
  { value: "ALTA", label: "Alta" },
  { value: "URGENTE", label: "Urgente" }
];

const PRIORIDAD_FILTER_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todas" },
  ...PRIORIDAD_OPTIONS
];

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "abiertos", label: "Abiertos" },
  { value: "resueltos", label: "Resueltos" }
];

/* =========================================================
   HELPERS
========================================================= */

function getDateLabel(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getPrioridadBadgeClass(prioridad: string): string {
  if (prioridad === "URGENTE") return "border-red-200 bg-red-50 text-red-700";
  if (prioridad === "ALTA") return "border-orange-200 bg-orange-50 text-orange-700";
  if (prioridad === "MEDIA") return "border-amber-200 bg-amber-50 text-amber-700";
  return "border-sky-200 bg-sky-50 text-sky-700";
}

function getPrioridadLabel(prioridad: string): string {
  const labels: Record<string, string> = {
    BAJA: "Baja",
    MEDIA: "Media",
    ALTA: "Alta",
    URGENTE: "Urgente"
  };

  return labels[prioridad] || prioridad;
}

function createInitialDraft(): PendienteDraft {
  return {
    titulo: "",
    descripcion: "",
    prioridad: "MEDIA"
  };
}

function createDraftFromPendiente(pendiente: Pendiente | null): PendienteDraft {
  if (!pendiente) return createInitialDraft();

  return {
    titulo: pendiente.titulo || "",
    descripcion: pendiente.descripcion || "",
    prioridad: pendiente.prioridad
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
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
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

function SmallActionButton({
  icon: Icon,
  title,
  disabled,
  tone = "neutral",
  onClick
}: {
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title: string;
  disabled?: boolean;
  tone?: "neutral" | "green" | "red" | "blue";
  onClick: () => void;
}) {
  const toneClass = {
    neutral: "text-[#64748b] hover:bg-white hover:text-[#172033]",
    green: "text-emerald-700 hover:bg-emerald-50",
    red: "text-red-600 hover:bg-red-50",
    blue: "text-sky-700 hover:bg-sky-50"
  }[tone];

  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={[
        "flex h-7 w-7 items-center justify-center rounded-[9px] transition disabled:opacity-50",
        toneClass
      ].join(" ")}
    >
      <Icon size={13} strokeWidth={1.8} />
    </button>
  );
}

/* =========================================================
   MODALES
========================================================= */

function ConfirmModal({
  confirm,
  saving,
  onClose
}: {
  confirm: ConfirmState;
  saving: boolean;
  onClose: () => void;
}) {
  if (!confirm) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center bg-black/35 px-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#172033]">{confirm.title}</h2>

            <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#64748b]">
              {confirm.message}
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

        <div className="flex justify-end gap-2">
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
            disabled={saving}
            onClick={confirm.onConfirm}
            className={[
              "h-8 rounded-[10px] px-4 text-[12px] font-medium text-white shadow-sm disabled:opacity-50",
              confirm.danger ? "bg-red-600 hover:bg-red-700" : "bg-[#4f7c90] hover:bg-[#406b7d]"
            ].join(" ")}
          >
            {saving ? "Procesando..." : confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function PendienteModal({
  pendiente,
  saving,
  onClose,
  onSave
}: {
  pendiente: Pendiente | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: PendienteDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<PendienteDraft>(() => createDraftFromPendiente(pendiente));

  function setField<K extends keyof PendienteDraft>(key: K, value: PendienteDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {pendiente ? "Editar pendiente" : "Nuevo pendiente"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Texto libre, prioridad y seguimiento simple.
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

        <div className="grid gap-3">
          <div>
            <FieldLabel>Pendiente</FieldLabel>
            <TextInput
              value={draft.titulo}
              onChange={(value) => setField("titulo", value)}
              placeholder="Ej: llamar a cliente, revisar reserva, enviar comprobante..."
            />
          </div>

          <div>
            <FieldLabel>Prioridad</FieldLabel>
            <NosturSelect
              value={draft.prioridad}
              onChange={(value) => setField("prioridad", value as PrioridadPendiente)}
              options={PRIORIDAD_OPTIONS}
            />
          </div>

          <div>
            <FieldLabel>Detalle opcional</FieldLabel>
            <TextArea
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Agregá contexto, teléfono, carrito, horario o cualquier nota útil..."
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
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CARDS
========================================================= */

function PendienteCard({
  pendiente,
  saving,
  onEdit,
  onResolve,
  onReopen,
  onDelete
}: {
  pendiente: Pendiente;
  saving: boolean;
  onEdit: (pendiente: Pendiente) => void;
  onResolve: (pendiente: Pendiente) => void;
  onReopen: (pendiente: Pendiente) => void;
  onDelete: (pendiente: Pendiente) => void;
}) {
  return (
    <div
      className={[
        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition xl:grid-cols-[112px_minmax(0,1fr)_180px_142px_112px]",
        pendiente.resuelto
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-black/10 bg-[#f8fafc] hover:bg-white"
      ].join(" ")}
    >
      <div className="min-w-0">
        <span
          className={[
            "inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
            getPrioridadBadgeClass(pendiente.prioridad)
          ].join(" ")}
        >
          {getPrioridadLabel(pendiente.prioridad)}
        </span>

        <div
          className={[
            "mt-1.5 text-[10.5px] font-medium",
            pendiente.resuelto ? "text-emerald-700" : "text-[#64748b]"
          ].join(" ")}
        >
          {pendiente.resuelto ? "Resuelto" : "Abierto"}
        </div>
      </div>

      <div className="min-w-0">
        <div
          className={[
            "truncate text-[13px] font-semibold",
            pendiente.resuelto
              ? "text-emerald-800 line-through decoration-emerald-700/50"
              : "text-[#172033]"
          ].join(" ")}
        >
          {pendiente.titulo}
        </div>

        {pendiente.descripcion ? (
          <div className="mt-0.5 line-clamp-2 text-[11.5px] font-normal leading-relaxed text-[#64748b]">
            {pendiente.descripcion}
          </div>
        ) : (
          <div className="mt-0.5 text-[11.5px] font-normal text-[#94a3b8]">
            Sin detalle adicional
          </div>
        )}
      </div>

      <div className="min-w-0 text-[12px]">
        <div className="truncate font-semibold text-[#172033]">
          {pendiente.vendedor || "Sin vendedor"}
        </div>

        <div className="truncate font-normal text-[#64748b]">
          {pendiente.sucursal || "Sin sucursal"}
        </div>
      </div>

      <div className="min-w-0 text-[12px]">
        <div className="font-semibold text-[#172033]">{getDateLabel(pendiente.created_at)}</div>

        <div className="font-normal text-[#64748b]">
          {pendiente.resuelto
            ? `Resuelto: ${getDateLabel(pendiente.resuelto_at)}`
            : "Creado"}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <SmallActionButton
          icon={Edit3}
          title="Editar"
          disabled={saving}
          onClick={() => onEdit(pendiente)}
        />

        {pendiente.resuelto ? (
          <SmallActionButton
            icon={Undo2}
            title="Reabrir"
            disabled={saving}
            tone="blue"
            onClick={() => onReopen(pendiente)}
          />
        ) : (
          <SmallActionButton
            icon={CheckCircle2}
            title="Resolver"
            disabled={saving}
            tone="green"
            onClick={() => onResolve(pendiente)}
          />
        )}

        <SmallActionButton
          icon={Trash2}
          title="Eliminar definitivamente"
          disabled={saving}
          tone="red"
          onClick={() => onDelete(pendiente)}
        />
      </div>
    </div>
  );
}

/* =========================================================
   PANEL PRINCIPAL
========================================================= */

export function PendientesPanel() {
  const loading = usePendientesStore((state) => state.loading);
  const saving = usePendientesStore((state) => state.saving);
  const error = usePendientesStore((state) => state.error);
  const filters = usePendientesStore((state) => state.filters);
  const canManagePendientes = usePendientesStore((state) => state.canManagePendientes);
  const catalogos = usePendientesStore((state) => state.catalogos);

  const loadPendientes = usePendientesStore((state) => state.loadPendientes);
  const createPendiente = usePendientesStore((state) => state.createPendiente);
  const updatePendiente = usePendientesStore((state) => state.updatePendiente);
  const resolvePendiente = usePendientesStore((state) => state.resolvePendiente);
  const reopenPendiente = usePendientesStore((state) => state.reopenPendiente);
  const deletePendiente = usePendientesStore((state) => state.deletePendiente);
  const setFilter = usePendientesStore((state) => state.setFilter);
  const clearError = usePendientesStore((state) => state.clearError);
  const getPendientesFiltrados = usePendientesStore((state) => state.getPendientesFiltrados);
  const getMetrics = usePendientesStore((state) => state.getMetrics);

  const pendientes = getPendientesFiltrados();
  const metrics = getMetrics();

  const vendedorOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...catalogos.vendedores.map((item) => ({
      value: item.id,
      label: `${item.nombre} ${item.apellido}`.trim()
    }))
  ];

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalPendiente, setModalPendiente] = useState<Pendiente | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  useEffect(() => {
    loadPendientes();
  }, [loadPendientes]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  function openCreateModal() {
    setModalPendiente(null);
    setModalOpen(true);
  }

  function openEditModal(pendiente: Pendiente) {
    setModalPendiente(pendiente);
    setModalOpen(true);
  }

  async function handleSave(draft: PendienteDraft) {
    const ok = modalPendiente
      ? await updatePendiente(modalPendiente, draft)
      : await createPendiente(draft);

    if (ok) {
      setModalOpen(false);
      setModalPendiente(null);
      showToast(modalPendiente ? "Pendiente actualizado." : "Pendiente creado.");
    }
  }

  async function handleResolve(pendiente: Pendiente) {
    const ok = await resolvePendiente(pendiente);

    if (ok) showToast("Pendiente marcado como resuelto.");
  }

  async function handleReopen(pendiente: Pendiente) {
    const ok = await reopenPendiente(pendiente);

    if (ok) showToast("Pendiente reabierto.");
  }

  async function handleDelete(pendiente: Pendiente) {
    setConfirm({
      title: "Eliminar pendiente",
      message: `¿Querés eliminar definitivamente el pendiente "${pendiente.titulo}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
      onConfirm: async () => {
        const ok = await deletePendiente(pendiente);

        if (ok) {
          setConfirm(null);
          showToast("Pendiente eliminado definitivamente.");
        }
      }
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Pendientes
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Simple
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Tareas libres por vendedor, prioridad y resolución.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={loadPendientes}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Nuevo pendiente
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
                  {filters.estado} · {filters.prioridad}
                  {canManagePendientes && filters.vendedorId !== "todos"
                    ? ` · ${vendedorOptions.find((item) => item.value === filters.vendedorId)?.label || "Vendedor"}`
                    : ""}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Ordenados por prioridad: urgente, alta, media y baja.
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
            <div
              className={[
                "mt-3 grid gap-2.5",
                canManagePendientes
                  ? "lg:grid-cols-[150px_150px_210px_minmax(0,1fr)]"
                  : "lg:grid-cols-[150px_150px_minmax(0,1fr)]"
              ].join(" ")}
            >
              <div>
                <FieldLabel>Estado</FieldLabel>
                <NosturSelect
                  value={filters.estado}
                  onChange={(value) => setFilter("estado", value as typeof filters.estado)}
                  options={ESTADO_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>Prioridad</FieldLabel>
                <NosturSelect
                  value={filters.prioridad}
                  onChange={(value) => setFilter("prioridad", value as typeof filters.prioridad)}
                  options={PRIORIDAD_FILTER_OPTIONS}
                />
              </div>

              {canManagePendientes ? (
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
                <FieldLabel>Buscar</FieldLabel>
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por texto, vendedor, sucursal o prioridad..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>
              </div>
            </div>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-5">
          <MetricCard label="Total visibles" value={metrics.total} icon={Filter} tone="blue" />
          <MetricCard label="Abiertos" value={metrics.abiertos} icon={AlertTriangle} tone="amber" />
          <MetricCard label="Urgentes" value={metrics.urgentes} icon={AlertTriangle} tone="red" />
          <MetricCard label="Altos" value={metrics.altas} icon={AlertTriangle} tone="orange" />
          <MetricCard label="Resueltos 10 días" value={metrics.resueltos} icon={CheckCircle2} tone="green" />
        </section>

        <section className="relative z-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-[#172033]">Listado de pendientes</h2>

              <p className="text-[11.5px] font-normal text-[#64748b]">
                {loading ? "Cargando..." : `${pendientes.length} pendientes encontrados`}
              </p>
            </div>
          </div>

          {loading ? (
            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
              Cargando pendientes...
            </div>
          ) : pendientes.length === 0 ? (
            <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
              No hay pendientes para los filtros seleccionados.
            </div>
          ) : (
            <div className="grid gap-1.5">
              {pendientes.map((pendiente) => (
                <PendienteCard
                  key={pendiente.id}
                  pendiente={pendiente}
                  saving={saving}
                  onEdit={openEditModal}
                  onResolve={handleResolve}
                  onReopen={handleReopen}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {modalOpen ? (
        <PendienteModal
          pendiente={modalPendiente}
          saving={saving}
          onClose={() => {
            setModalOpen(false);
            setModalPendiente(null);
          }}
          onSave={handleSave}
        />
      ) : null}

      <ConfirmModal confirm={confirm} saving={saving} onClose={() => setConfirm(null)} />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default PendientesPanel;