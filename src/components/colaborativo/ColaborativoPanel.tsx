// src/components/colaborativo/ColaborativoPanel.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Edit3,
  Eye,
  FileText,
  Filter,
  FolderOpen,
  Image as ImageIcon,
  MessageSquare,
  Paperclip,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Trash2,
  Upload,
  X
} from "lucide-react";
import {
  createInitialProcedimientoDraft,
  createInitialProyectoDraft,
  formatFileSize,
  getColaborativoEstadoLabel,
  getColaborativoTipoAdjuntoLabel,
  useColaborativoStore,
  type ColaborativoAdjunto,
  type ColaborativoAdjuntoDraft,
  type ColaborativoComentario,
  type ColaborativoHistorial,
  type ColaborativoProcedimiento,
  type ColaborativoProcedimientoDraft,
  type ColaborativoProyecto,
  type ColaborativoProyectoDraft
} from "../../store/colaborativoStore";

/* =========================================================
   NOSSIX / NOSTUR — COLABORATIVO
   Estilo visual unificado con CajaPanel
========================================================= */

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ModalMode = "proyecto" | "procedimiento" | "adjunto" | "comentario" | null;

type ConfirmAdjuntoState = ColaborativoAdjunto | null;

const ESTADO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "PUBLICADO", label: "Publicados" },
  { value: "BORRADOR", label: "Borradores" },
  { value: "ARCHIVADO", label: "Archivados" }
];

const PROCEDIMIENTO_ESTADO_OPTIONS: SelectOption[] = [
  { value: "BORRADOR", label: "Borrador" },
  { value: "PUBLICADO", label: "Publicado" },
  { value: "ARCHIVADO", label: "Archivado" }
];

const PROJECT_COLORS = [
  "#4f7c90",
  "#2563eb",
  "#7c3aed",
  "#f97316",
  "#0f766e",
  "#334155",
  "#16a34a",
  "#dc2626",
  "#0891b2"
];

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
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
    minute: "2-digit",
    timeZone: "America/Argentina/Cordoba"
  }).format(date);
}

function getTodayDisplay(): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Cordoba"
  }).format(new Date());
}

function getInitials(name?: string | null): string {
  return cleanText(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function getAdjuntoUrl(adjunto: ColaborativoAdjunto): string | null {
  return adjunto.public_url || null;
}

function getAdjuntoNombre(adjunto: ColaborativoAdjunto): string {
  return adjunto.nombre_archivo || "Archivo";
}

function getAdjuntoIcon(adjunto: ColaborativoAdjunto) {
  if (adjunto.tipo === "IMAGEN") return ImageIcon;
  return FileText;
}

function getEstadoTone(estado: string): "success" | "warning" | "neutral" {
  if (estado === "PUBLICADO") return "success";
  if (estado === "BORRADOR") return "warning";
  return "neutral";
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
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90] disabled:cursor-not-allowed disabled:opacity-60"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  minHeight = 78
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={{ minHeight }}
      className="w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[12px] font-normal leading-relaxed text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
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

function InlineError({ message, onClose }: { message: string | null; onClose: () => void }) {
  if (!message) return null;

  return (
    <div className="mb-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
      <span>{message}</span>

      <button type="button" onClick={onClose} className="text-red-500 hover:text-red-700">
        <X size={14} />
      </button>
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
  tone?: "orange" | "blue" | "green" | "red" | "amber" | "slate";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-nostur-orange ring-orange-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    red: "bg-red-50 text-red-700 ring-red-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    slate: "bg-slate-100 text-slate-700 ring-slate-200"
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
  const tone = getEstadoTone(estado);

  const className = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-700"
  }[tone];

  return (
    <span
      className={[
        "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
        className
      ].join(" ")}
    >
      {getColaborativoEstadoLabel(estado)}
    </span>
  );
}

/* =========================================================
   RICH TEXT EDITOR
========================================================= */

function RichTextEditor({
  value,
  onChange
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!editorRef.current) return;

    if (editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || "";
    }
  }, [value]);

  function sync() {
    onChange(editorRef.current?.innerHTML || "");
  }

  function exec(command: string) {
    document.execCommand(command);
    sync();
  }

  function insertImageFromFile(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      const src = String(reader.result || "");
      if (!src) return;

      document.execCommand("insertImage", false, src);
      sync();
    };

    reader.readAsDataURL(file);
  }

  return (
    <div className="overflow-hidden rounded-[14px] border border-black/10 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-1 border-b border-black/10 bg-[#f8fafc] p-1.5">
        <button
          type="button"
          onClick={() => exec("bold")}
          className="h-7 rounded-[8px] px-2.5 text-[11px] font-semibold text-[#334155] hover:bg-white"
        >
          B
        </button>

        <button
          type="button"
          onClick={() => exec("italic")}
          className="h-7 rounded-[8px] px-2.5 text-[11px] font-semibold italic text-[#334155] hover:bg-white"
        >
          I
        </button>

        <button
          type="button"
          onClick={() => exec("underline")}
          className="h-7 rounded-[8px] px-2.5 text-[11px] font-semibold underline text-[#334155] hover:bg-white"
        >
          U
        </button>

        <button
          type="button"
          onClick={() => exec("insertUnorderedList")}
          className="h-7 rounded-[8px] px-2.5 text-[11px] font-medium text-[#334155] hover:bg-white"
        >
          Lista
        </button>

        <button
          type="button"
          onClick={() => exec("insertOrderedList")}
          className="h-7 rounded-[8px] px-2.5 text-[11px] font-medium text-[#334155] hover:bg-white"
        >
          1. Lista
        </button>

        <label className="ml-auto flex h-7 cursor-pointer items-center gap-1.5 rounded-[8px] border border-black/10 bg-white px-2.5 text-[11px] font-medium text-[#334155] hover:bg-[#f8fafc]">
          <ImageIcon size={13} />
          Imagen
          <input
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";

              if (file) insertImageFromFile(file);
            }}
          />
        </label>
      </div>

      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={sync}
        className="prose prose-sm max-w-none min-h-[260px] rounded-b-[14px] px-4 py-3 text-[13px] font-normal leading-relaxed text-[#172033] outline-none"
      />
    </div>
  );
}

/* =========================================================
   CARDS
========================================================= */

function ProyectoCard({
  proyecto,
  selected,
  canAdmin,
  onSelect,
  onEdit
}: {
  proyecto: ColaborativoProyecto;
  selected: boolean;
  canAdmin: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  const color = proyecto.color || "#4f7c90";

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : "border-black/10 bg-white/68 hover:bg-white"
      ].join(" ")}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[11px] font-semibold text-white shadow-sm"
          style={{ backgroundColor: color }}
        >
          {getInitials(proyecto.nombre)}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="truncate text-[12px] font-semibold text-[#172033]">
                {proyecto.nombre}
              </div>

              <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[#64748b]">
                {proyecto.descripcion || "Procedimientos y documentación interna."}
              </div>
            </div>

            {canAdmin ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onEdit();
                }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[#94a3b8] opacity-0 transition hover:bg-white hover:text-[#4f7c90] group-hover:opacity-100"
                title="Editar proyecto"
              >
                <Edit3 size={13} />
              </button>
            ) : null}
          </div>

          <div className="mt-2 flex flex-wrap gap-1">
            <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#334155] ring-1 ring-black/10">
              {proyecto.cantidad_procedimientos || 0} procedimientos
            </span>

            <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 ring-1 ring-emerald-100">
              {proyecto.publicados || 0} publicados
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

function ProcedimientoRow({
  procedimiento,
  selected,
  onSelect,
  onEdit
}: {
  procedimiento: ColaborativoProcedimiento;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition xl:grid-cols-[minmax(0,1fr)_170px_94px]",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : "border-black/10 bg-[#f8fafc] hover:bg-white"
      ].join(" ")}
    >
      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-[#172033]">
          {procedimiento.titulo}
        </div>

        <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[#64748b]">
          {procedimiento.resumen || "Sin resumen."}
        </div>

        {procedimiento.etiquetas?.length ? (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {procedimiento.etiquetas.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#475569] ring-1 ring-black/10"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="flex flex-wrap gap-1.5">
          <EstadoBadge estado={procedimiento.estado} />

          <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/10">
            v{procedimiento.ultima_version || 1}
          </span>
        </div>

        <div className="mt-1.5 text-[10.5px] font-normal text-[#64748b]">
          Adjuntos: {procedimiento.cantidad_adjuntos || 0} · Comentarios:{" "}
          {procedimiento.cantidad_comentarios || 0}
        </div>

        {procedimiento.updated_by_nombre ? (
          <div className="mt-0.5 truncate text-[10.5px] font-normal text-[#94a3b8]">
            Últ. edición: {procedimiento.updated_by_nombre}
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="h-7 rounded-[9px] border border-[#4f7c90]/20 bg-white px-2.5 text-[11px] font-medium text-[#4f7c90] hover:bg-[#eef6f7]"
        >
          Editar
        </button>
      </div>
    </button>
  );
}

/* =========================================================
   MODALES
========================================================= */

function ProyectoModal({
  proyecto,
  saving,
  onClose,
  onSave
}: {
  proyecto: ColaborativoProyecto | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ColaborativoProyectoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ColaborativoProyectoDraft>(() =>
    createInitialProyectoDraft(proyecto)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof ColaborativoProyectoDraft>(
    key: K,
    value: ColaborativoProyectoDraft[K]
  ) {
    setLocalError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleSave() {
    if (!cleanText(draft.nombre)) {
      setLocalError("Ingresá el nombre del proyecto.");
      return;
    }

    onSave(draft);
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {proyecto ? "Editar proyecto" : "Nuevo proyecto"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Agrupá procedimientos por aplicativo, área o proceso interno.
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

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        <div className="grid gap-3">
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={draft.nombre}
              onChange={(value) => setField("nombre", value)}
              placeholder="Ej: Amadeus"
            />
          </div>

          <div>
            <FieldLabel>Descripción</FieldLabel>
            <TextArea
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Procedimientos, comandos y operaciones frecuentes..."
            />
          </div>

          <div>
            <FieldLabel>Color</FieldLabel>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setField("color", color)}
                  className={[
                    "h-8 w-8 rounded-[10px] border-2 transition",
                    draft.color === color ? "scale-105 border-[#172033]" : "border-white"
                  ].join(" ")}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          <div>
            <FieldLabel>Orden</FieldLabel>
            <TextInput
              value={draft.orden}
              onChange={(value) => setField("orden", value.replace(/\D/g, "").slice(0, 4))}
              placeholder="0"
            />
          </div>

          <button
            type="button"
            onClick={() => setField("activo", !draft.activo)}
            className={[
              "h-8 rounded-[10px] border px-3 text-[12px] font-medium transition",
              draft.activo
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-red-200 bg-red-50 text-red-700"
            ].join(" ")}
          >
            {draft.activo ? "Proyecto activo" : "Proyecto inactivo"}
          </button>
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
            onClick={handleSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            <Save size={13} />
            {saving ? "Guardando..." : proyecto ? "Guardar cambios" : "Crear proyecto"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ProcedimientoModal({
  procedimiento,
  proyectoId,
  saving,
  onClose,
  onSave
}: {
  procedimiento: ColaborativoProcedimiento | null;
  proyectoId: string | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: ColaborativoProcedimientoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<ColaborativoProcedimientoDraft>(() =>
    createInitialProcedimientoDraft(proyectoId, procedimiento)
  );
  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof ColaborativoProcedimientoDraft>(
    key: K,
    value: ColaborativoProcedimientoDraft[K]
  ) {
    setLocalError(null);
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function handleContentChange(value: string) {
    setDraft((current) => ({
      ...current,
      contenido_html: value,
      contenido_texto: htmlToPlainText(value)
    }));
  }

  function handleSave() {
    if (!draft.proyecto_id) {
      setLocalError("Seleccioná un proyecto.");
      return;
    }

    if (!cleanText(draft.titulo)) {
      setLocalError("Ingresá el título del procedimiento.");
      return;
    }

    if (!cleanText(draft.contenido_html)) {
      setLocalError("Ingresá el contenido del procedimiento.");
      return;
    }

    onSave({
      ...draft,
      contenido_texto: cleanText(draft.contenido_texto) || htmlToPlainText(draft.contenido_html)
    });
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-8 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-56px)] w-full max-w-6xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {procedimiento ? "Editar procedimiento" : "Nuevo procedimiento"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Texto enriquecido, imágenes embebidas y documentación interna.
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

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px]">
          <main className="grid gap-3">
            <div>
              <FieldLabel>Título</FieldLabel>
              <TextInput
                value={draft.titulo}
                onChange={(value) => setField("titulo", value)}
                placeholder="Ej: Crear PNR completo en Amadeus"
              />
            </div>

            <div>
              <FieldLabel>Resumen</FieldLabel>
              <TextInput
                value={draft.resumen}
                onChange={(value) => setField("resumen", value)}
                placeholder="Resumen visible en el índice..."
              />
            </div>

            <div>
              <FieldLabel>Contenido</FieldLabel>
              <RichTextEditor value={draft.contenido_html} onChange={handleContentChange} />
            </div>
          </main>

          <aside className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
            <div className="grid gap-3">
              <div>
                <FieldLabel>Estado</FieldLabel>
                <NosturSelect
                  value={draft.estado}
                  onChange={(value) =>
                    setField("estado", value as ColaborativoProcedimientoDraft["estado"])
                  }
                  options={PROCEDIMIENTO_ESTADO_OPTIONS}
                />
              </div>

              <div>
                <FieldLabel>Etiquetas</FieldLabel>
                <TextArea
                  value={draft.etiquetas_texto}
                  onChange={(value) => setField("etiquetas_texto", value)}
                  placeholder="amadeus, pnr, aéreo"
                  minHeight={74}
                />

                <p className="mt-1 text-[10.5px] font-normal text-[#64748b]">
                  Separá las etiquetas con coma.
                </p>
              </div>

              <div>
                <FieldLabel>Orden</FieldLabel>
                <TextInput
                  value={draft.orden}
                  onChange={(value) => setField("orden", value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="0"
                />
              </div>

              <div className="rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-[11px] font-medium leading-relaxed text-sky-700">
                Podés pegar imágenes dentro del contenido o insertarlas desde el botón Imagen.
              </div>

              <div className="rounded-[14px] border border-amber-200 bg-amber-50 p-3 text-[11px] font-medium leading-relaxed text-amber-700">
                Los archivos adjuntos se cargan desde el visor del procedimiento.
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
            onClick={handleSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            <Save size={13} />
            {saving ? "Guardando..." : procedimiento ? "Guardar cambios" : "Crear procedimiento"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdjuntoModal({
  proyectoId,
  procedimientoId,
  uploading,
  onClose,
  onUpload
}: {
  proyectoId: string | null;
  procedimientoId: string | null;
  uploading: boolean;
  onClose: () => void;
  onUpload: (draft: ColaborativoAdjuntoDraft) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [altText, setAltText] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleUpload() {
    if (!file) {
      setLocalError("Seleccioná un archivo.");
      return;
    }

    onUpload({
      proyecto_id: proyectoId,
      procedimiento_id: procedimientoId,
      file,
      alt_text: altText,
      descripcion,
      usado_en_contenido: false
    });
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-lg overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Subir adjunto</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              PDF, Word, Excel, JPG, PNG u otros archivos internos.
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

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        <label className="flex min-h-[128px] cursor-pointer flex-col items-center justify-center rounded-[14px] border border-dashed border-black/20 bg-[#f8fafc] p-5 text-center hover:bg-white">
          <Upload size={22} className="mb-2 text-[#4f7c90]" />

          <div className="text-[13px] font-semibold text-[#172033]">
            {file ? file.name : "Seleccionar archivo"}
          </div>

          <div className="mt-1 text-[12px] font-normal text-[#64748b]">
            {file ? formatFileSize(file.size) : "Arrastrá o seleccioná un archivo"}
          </div>

          <input
            type="file"
            className="hidden"
            onChange={(event) => {
              const nextFile = event.target.files?.[0] || null;
              setLocalError(null);
              setFile(nextFile);
            }}
          />
        </label>

        <div className="mt-3 grid gap-3">
          <div>
            <FieldLabel>Descripción</FieldLabel>
            <TextInput
              value={descripcion}
              onChange={setDescripcion}
              placeholder="Ej: Captura, comprobante, instructivo..."
            />
          </div>

          <div>
            <FieldLabel>Texto alternativo</FieldLabel>
            <TextInput value={altText} onChange={setAltText} placeholder="Opcional" />
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
            disabled={uploading || !file}
            onClick={handleUpload}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-sky-700 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-sky-800 disabled:opacity-50"
          >
            <Upload size={13} />
            {uploading ? "Subiendo..." : "Subir"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ComentarioModal({
  saving,
  onClose,
  onSave
}: {
  saving: boolean;
  onClose: () => void;
  onSave: (comentario: string) => Promise<void>;
}) {
  const [comentario, setComentario] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  function handleSave() {
    if (cleanText(comentario).length < 2) {
      setLocalError("Escribí un comentario.");
      return;
    }

    onSave(comentario);
  }

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Nuevo comentario</h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Agregá una nota interna sobre este procedimiento.
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

        <InlineError message={localError} onClose={() => setLocalError(null)} />

        <div>
          <FieldLabel>Comentario</FieldLabel>
          <TextArea
            value={comentario}
            onChange={(value) => {
              setLocalError(null);
              setComentario(value);
            }}
            placeholder="Escribí el comentario..."
            minHeight={118}
          />
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
            onClick={handleSave}
            className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            <MessageSquare size={13} />
            {saving ? "Guardando..." : "Guardar comentario"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmAdjuntoModal({
  adjunto,
  saving,
  onClose,
  onConfirm
}: {
  adjunto: ConfirmAdjuntoState;
  saving: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  if (!adjunto) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center bg-black/35 px-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#172033]">Eliminar adjunto</h2>
            <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#64748b]">
              ¿Querés eliminar este archivo? Quedará oculto del procedimiento.
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
          <div className="font-semibold text-[#172033]">{getAdjuntoNombre(adjunto)}</div>
          <div className="mt-0.5 font-normal text-[#64748b]">
            {getColaborativoTipoAdjuntoLabel(adjunto.tipo)} · {formatFileSize(adjunto.size_bytes)}
          </div>
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
            onClick={onConfirm}
            className="h-8 rounded-[10px] bg-red-600 px-4 text-[12px] font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
          >
            {saving ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   PANEL PRINCIPAL
========================================================= */

export function ColaborativoPanel() {
  const loading = useColaborativoStore((state) => state.loading);
  const saving = useColaborativoStore((state) => state.saving);
  const uploading = useColaborativoStore((state) => state.uploading);
  const error = useColaborativoStore((state) => state.error);

  const currentProfile = useColaborativoStore((state) => state.currentProfile);
  const canManageColaborativo = useColaborativoStore((state) => state.canManageColaborativo);
  const canAdminColaborativo = useColaborativoStore((state) => state.canAdminColaborativo);

  const proyectos = useColaborativoStore((state) => state.proyectos);
  const filters = useColaborativoStore((state) => state.filters);
  const selectedProyectoId = useColaborativoStore((state) => state.selectedProyectoId);
  const selectedProcedimientoId = useColaborativoStore((state) => state.selectedProcedimientoId);

  const loadColaborativo = useColaborativoStore((state) => state.loadColaborativo);
  const saveProyecto = useColaborativoStore((state) => state.saveProyecto);
  const saveProcedimiento = useColaborativoStore((state) => state.saveProcedimiento);
  const cambiarEstadoProcedimiento = useColaborativoStore(
    (state) => state.cambiarEstadoProcedimiento
  );
  const uploadAdjunto = useColaborativoStore((state) => state.uploadAdjunto);
  const deleteAdjunto = useColaborativoStore((state) => state.deleteAdjunto);
  const saveComentario = useColaborativoStore((state) => state.saveComentario);
  const toggleComentarioResuelto = useColaborativoStore(
    (state) => state.toggleComentarioResuelto
  );

  const setFilter = useColaborativoStore((state) => state.setFilter);
  const resetFilters = useColaborativoStore((state) => state.resetFilters);
  const selectProyecto = useColaborativoStore((state) => state.selectProyecto);
  const selectProcedimiento = useColaborativoStore((state) => state.selectProcedimiento);
  const clearError = useColaborativoStore((state) => state.clearError);

  const getFilteredProcedimientos = useColaborativoStore(
    (state) => state.getFilteredProcedimientos
  );
  const getSelectedProyecto = useColaborativoStore((state) => state.getSelectedProyecto);
  const getSelectedProcedimiento = useColaborativoStore(
    (state) => state.getSelectedProcedimiento
  );
  const getAdjuntosBySelected = useColaborativoStore(
    (state) => state.getAdjuntosBySelected
  );
  const getHistorialBySelected = useColaborativoStore(
    (state) => state.getHistorialBySelected
  );
  const getComentariosBySelected = useColaborativoStore(
    (state) => state.getComentariosBySelected
  );
  const getMetrics = useColaborativoStore((state) => state.getMetrics);

  const selectedProyecto = useMemo(
    () => getSelectedProyecto(),
    [proyectos, selectedProyectoId, getSelectedProyecto]
  );

  const selectedProcedimiento = useMemo(
    () => getSelectedProcedimiento(),
    [selectedProcedimientoId, filters, getSelectedProcedimiento]
  );

  const filteredProcedimientos = getFilteredProcedimientos();
  const selectedAdjuntos = getAdjuntosBySelected();
  const selectedHistorial = getHistorialBySelected();
  const selectedComentarios = getComentariosBySelected();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingProyecto, setEditingProyecto] = useState<ColaborativoProyecto | null>(null);
  const [editingProcedimiento, setEditingProcedimiento] =
    useState<ColaborativoProcedimiento | null>(null);
  const [adjuntoToDelete, setAdjuntoToDelete] = useState<ConfirmAdjuntoState>(null);
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    loadColaborativo();
  }, [loadColaborativo]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  function openNewProyecto() {
    setEditingProyecto(null);
    setModalMode("proyecto");
  }

  function openEditProyecto(proyecto: ColaborativoProyecto) {
    setEditingProyecto(proyecto);
    setModalMode("proyecto");
  }

  function openNewProcedimiento() {
    if (!selectedProyecto) {
      showToast("Seleccioná un proyecto antes de crear un procedimiento.", "error");
      return;
    }

    setEditingProcedimiento(null);
    setModalMode("procedimiento");
  }

  function openEditProcedimiento(procedimiento: ColaborativoProcedimiento) {
    setEditingProcedimiento(procedimiento);
    selectProcedimiento(procedimiento.id);
    setModalMode("procedimiento");
  }

  async function handleSaveProyecto(draft: ColaborativoProyectoDraft) {
    const result = await saveProyecto(draft);

    if (result) {
      setModalMode(null);
      setEditingProyecto(null);
      showToast(editingProyecto ? "Proyecto actualizado correctamente." : "Proyecto creado.");
    }
  }

  async function handleSaveProcedimiento(draft: ColaborativoProcedimientoDraft) {
    const result = await saveProcedimiento(draft);

    if (result) {
      setModalMode(null);
      setEditingProcedimiento(null);
      showToast(
        editingProcedimiento
          ? "Procedimiento actualizado correctamente."
          : "Procedimiento creado correctamente."
      );
    }
  }

  async function handleCambiarEstado(estado: "BORRADOR" | "PUBLICADO" | "ARCHIVADO") {
    if (!selectedProcedimiento) return;

    const ok = await cambiarEstadoProcedimiento(selectedProcedimiento, estado);

    if (ok) {
      showToast(`Estado actualizado a ${getColaborativoEstadoLabel(estado)}.`);
    }
  }

  async function handleUploadAdjunto(draft: ColaborativoAdjuntoDraft) {
    const result = await uploadAdjunto(draft);

    if (result) {
      setModalMode(null);
      showToast("Adjunto subido correctamente.");
    }
  }

  async function handleDeleteAdjunto() {
    if (!adjuntoToDelete) return;

    const ok = await deleteAdjunto(adjuntoToDelete);

    if (ok) {
      setAdjuntoToDelete(null);
      showToast("Adjunto eliminado correctamente.");
    }
  }

  async function handleSaveComentario(comentario: string) {
    if (!selectedProcedimiento) {
      showToast("Seleccioná un procedimiento.", "error");
      return;
    }

    const ok = await saveComentario(selectedProcedimiento.id, comentario);

    if (ok) {
      setModalMode(null);
      showToast("Comentario guardado correctamente.");
    }
  }

  async function handleToggleComentario(comentario: ColaborativoComentario) {
    const ok = await toggleComentarioResuelto(comentario);

    if (ok) {
      showToast(comentario.resuelto ? "Comentario reabierto." : "Comentario resuelto.");
    }
  }

  function handleResetFilters() {
    resetFilters();
    window.setTimeout(() => loadColaborativo(), 0);
  }

  const proyectoOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...proyectos.map((proyecto) => ({
      value: proyecto.id,
      label: proyecto.nombre
    }))
  ];

  if (!canManageColaborativo && !loading) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
        <main className="min-h-0 flex-1 overflow-auto p-3.5">
          <div className="mx-auto max-w-2xl rounded-[16px] border border-red-200 bg-red-50 p-4 text-red-700">
            <h1 className="text-[16px] font-semibold">Sin acceso</h1>
            <p className="mt-1 text-[12px] font-normal">
              Tu usuario no tiene permisos para ver el módulo Colaborativo.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Colaborativo
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Procedimientos
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Base interna editable de procedimientos, archivos, imágenes y comentarios.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <span className="hidden rounded-[10px] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#64748b] shadow-sm ring-1 ring-black/10 xl:inline-flex">
              {currentProfile?.nombre || "Usuario"} · {getTodayDisplay()}
            </span>

            <button
              type="button"
              onClick={loadColaborativo}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            {canAdminColaborativo ? (
              <button
                type="button"
                onClick={openNewProyecto}
                className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-sky-700 px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-sky-800"
              >
                <FolderOpen size={13} />
                Proyecto
              </button>
            ) : null}

            <button
              type="button"
              onClick={openNewProcedimiento}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Plus size={13} />
              Procedimiento
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
                  {selectedProyecto?.nombre || "Todos"}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Proyecto: {filters.proyectoId} · Estado: {filters.estado} · Imágenes:{" "}
                {filters.soloConImagenes ? "Sí" : "No"}
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
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[220px_170px_minmax(0,1fr)_auto]">
                <div>
                  <FieldLabel>Proyecto</FieldLabel>
                  <NosturSelect
                    value={filters.proyectoId}
                    onChange={(value) => {
                      setFilter("proyectoId", value as typeof filters.proyectoId);

                      if (value !== "todos") {
                        selectProyecto(value);
                      }
                    }}
                    options={proyectoOptions}
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
                  <FieldLabel>Búsqueda</FieldLabel>
                  <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                    <Search size={14} className="shrink-0 text-[#94a3b8]" />

                    <input
                      value={filters.search}
                      onChange={(event) => setFilter("search", event.target.value)}
                      placeholder="Buscar por título, resumen, contenido, proyecto o etiquetas..."
                      className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                    />
                  </div>
                </div>

                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setFilter("soloConImagenes", !filters.soloConImagenes)}
                    className={[
                      "h-8 rounded-[10px] px-3 text-[12px] font-medium shadow-sm ring-1 ring-black/10 transition",
                      filters.soloConImagenes
                        ? "bg-[#4f7c90] text-white"
                        : "bg-white text-[#334155] hover:bg-[#f8fafc]"
                    ].join(" ")}
                  >
                    Solo imágenes
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={loadColaborativo}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Aplicar filtros
                </button>

                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Limpiar
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-7">
          <MetricCard label="Proyectos" value={metrics.proyectos} icon={FolderOpen} tone="blue" />
          <MetricCard label="Procedimientos" value={metrics.procedimientos} icon={BookOpen} />
          <MetricCard label="Publicados" value={metrics.publicados} icon={CheckCircle2} tone="green" />
          <MetricCard label="Borradores" value={metrics.borradores} icon={Edit3} tone="amber" />
          <MetricCard label="Archivados" value={metrics.archivados} icon={Archive} tone="slate" />
          <MetricCard label="Imágenes" value={metrics.imagenes} icon={ImageIcon} tone="blue" />
          <MetricCard label="Comentarios" value={metrics.comentariosAbiertos} icon={MessageSquare} tone="red" />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[300px_minmax(0,1fr)_360px]">
          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Proyectos</h2>
                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {proyectos.length} proyectos activos
                </p>
              </div>

              {canAdminColaborativo ? (
                <button
                  type="button"
                  onClick={openNewProyecto}
                  className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[#4f7c90] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                  title="Nuevo proyecto"
                >
                  <Plus size={13} />
                </button>
              ) : null}
            </div>

            <div className="grid max-h-[calc(100vh-350px)] gap-1.5 overflow-auto pr-1">
              {proyectos.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  No hay proyectos cargados.
                </div>
              ) : (
                proyectos.map((proyecto) => (
                  <ProyectoCard
                    key={proyecto.id}
                    proyecto={proyecto}
                    selected={proyecto.id === selectedProyectoId}
                    canAdmin={canAdminColaborativo}
                    onSelect={() => selectProyecto(proyecto.id)}
                    onEdit={() => openEditProyecto(proyecto)}
                  />
                ))
              )}
            </div>
          </aside>

          <main className="min-w-0 grid gap-3">
            <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">
                    Índice de procedimientos
                  </h2>

                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    {loading
                      ? "Cargando..."
                      : `${filteredProcedimientos.length} procedimientos encontrados`}
                  </p>
                </div>
              </div>

              {loading ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  Cargando procedimientos...
                </div>
              ) : filteredProcedimientos.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  No hay procedimientos para los filtros seleccionados.
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {filteredProcedimientos.map((procedimiento) => (
                    <ProcedimientoRow
                      key={procedimiento.id}
                      procedimiento={procedimiento}
                      selected={procedimiento.id === selectedProcedimientoId}
                      onSelect={() => selectProcedimiento(procedimiento.id)}
                      onEdit={() => openEditProcedimiento(procedimiento)}
                    />
                  ))}
                </div>
              )}
            </section>

            <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              {!selectedProcedimiento ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  Seleccioná un procedimiento para verlo o editarlo.
                </div>
              ) : (
                <>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <EstadoBadge estado={selectedProcedimiento.estado} />

                        <span className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/10">
                          v{selectedProcedimiento.ultima_version || 1}
                        </span>

                        {selectedProcedimiento.proyecto_nombre ? (
                          <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 ring-1 ring-sky-100">
                            {selectedProcedimiento.proyecto_nombre}
                          </span>
                        ) : null}
                      </div>

                      <h2 className="text-[16px] font-semibold tracking-tight text-[#172033]">
                        {selectedProcedimiento.titulo}
                      </h2>

                      <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
                        {selectedProcedimiento.resumen || "Sin resumen."}
                      </p>

                      {selectedProcedimiento.etiquetas?.length ? (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {selectedProcedimiento.etiquetas.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-[#f8fafc] px-1.5 py-0.5 text-[10px] font-medium text-[#475569] ring-1 ring-black/10"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="w-[150px]">
                        <NosturSelect
                          value={selectedProcedimiento.estado}
                          onChange={(value) =>
                            handleCambiarEstado(
                              value as "BORRADOR" | "PUBLICADO" | "ARCHIVADO"
                            )
                          }
                          options={PROCEDIMIENTO_ESTADO_OPTIONS}
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => setModalMode("adjunto")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                      >
                        <Paperclip size={13} />
                        Archivo
                      </button>

                      <button
                        type="button"
                        onClick={() => setModalMode("comentario")}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                      >
                        <MessageSquare size={13} />
                        Comentario
                      </button>

                      <button
                        type="button"
                        onClick={() => openEditProcedimiento(selectedProcedimiento)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-3 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                      >
                        <Edit3 size={13} />
                        Editar
                      </button>
                    </div>
                  </div>

                  <div
                    className="prose prose-sm max-w-none rounded-[14px] border border-black/10 bg-white px-4 py-3 text-[13px] font-normal leading-relaxed text-[#172033]"
                    dangerouslySetInnerHTML={{
                      __html: selectedProcedimiento.contenido_html || "<p>Sin contenido.</p>"
                    }}
                  />

                  {selectedHistorial.length > 0 ? (
                    <div className="mt-3 rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-[12px] font-semibold text-[#172033]">Historial</h3>

                        <span className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b]">
                          Últimos movimientos
                        </span>
                      </div>

                      <div className="grid gap-1.5">
                        {selectedHistorial.slice(0, 5).map((item: ColaborativoHistorial) => (
                          <div key={item.id} className="rounded-[12px] bg-white p-2.5 text-[12px]">
                            <div className="font-semibold text-[#172033]">
                              {item.accion || "Actualización"} · v{item.version}
                            </div>

                            <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                              {formatDateTime(item.created_at)}
                            </div>

                            {item.observaciones ? (
                              <div className="mt-1 text-[11px] font-normal text-[#334155]">
                                {item.observaciones}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </>
              )}
            </section>
          </main>

          <aside className="min-w-0 space-y-3">
            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">Adjuntos</h2>
                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    {selectedAdjuntos.length} archivos
                  </p>
                </div>

                {selectedProcedimiento ? (
                  <button
                    type="button"
                    onClick={() => setModalMode("adjunto")}
                    className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[#4f7c90] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                    title="Subir adjunto"
                  >
                    <Plus size={13} />
                  </button>
                ) : null}
              </div>

              {selectedAdjuntos.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  Sin adjuntos.
                </div>
              ) : (
                <div className="grid max-h-[320px] gap-1.5 overflow-auto pr-1">
                  {selectedAdjuntos.map((adjunto) => {
                    const Icon = getAdjuntoIcon(adjunto);
                    const url = getAdjuntoUrl(adjunto);

                    return (
                      <div
                        key={adjunto.id}
                        className="rounded-[12px] border border-black/10 bg-[#f8fafc] p-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 gap-2">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] bg-white text-[#4f7c90] ring-1 ring-black/10">
                              <Icon size={14} />
                            </div>

                            <div className="min-w-0">
                              <div className="truncate text-[12px] font-semibold text-[#172033]">
                                {getAdjuntoNombre(adjunto)}
                              </div>

                              <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                                {getColaborativoTipoAdjuntoLabel(adjunto.tipo)} ·{" "}
                                {formatFileSize(adjunto.size_bytes)}
                              </div>

                              {adjunto.descripcion ? (
                                <div className="mt-1 line-clamp-2 text-[10.5px] font-normal text-[#94a3b8]">
                                  {adjunto.descripcion}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          {canAdminColaborativo ? (
                            <button
                              type="button"
                              onClick={() => setAdjuntoToDelete(adjunto)}
                              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-red-600 hover:bg-red-50"
                              title="Eliminar"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null}
                        </div>

                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-2 flex h-7 items-center justify-center gap-1.5 rounded-[9px] bg-white text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                          >
                            <Eye size={13} />
                            Abrir archivo
                          </a>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">Comentarios</h2>
                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    {selectedComentarios.length} comentarios
                  </p>
                </div>

                {selectedProcedimiento ? (
                  <button
                    type="button"
                    onClick={() => setModalMode("comentario")}
                    className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[#4f7c90] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                    title="Nuevo comentario"
                  >
                    <Plus size={13} />
                  </button>
                ) : null}
              </div>

              {selectedComentarios.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  Sin comentarios.
                </div>
              ) : (
                <div className="grid max-h-[340px] gap-1.5 overflow-auto pr-1">
                  {selectedComentarios.map((comentario: ColaborativoComentario) => (
                    <div
                      key={comentario.id}
                      className={[
                        "rounded-[12px] border p-2.5 text-[12px]",
                        comentario.resuelto
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-black/10 bg-[#f8fafc]"
                      ].join(" ")}
                    >
                      <div className="mb-1 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate font-semibold text-[#172033]">
                            {comentario.created_by || "Usuario"}
                          </div>

                          <div className="text-[11px] font-normal text-[#64748b]">
                            {formatDateTime(comentario.created_at)}
                          </div>
                        </div>

                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => handleToggleComentario(comentario)}
                          className={[
                            "h-7 rounded-[9px] border px-2 text-[10.5px] font-medium disabled:opacity-50",
                            comentario.resuelto
                              ? "border-emerald-200 bg-white text-emerald-700"
                              : "border-sky-200 bg-sky-50 text-sky-700"
                          ].join(" ")}
                        >
                          {comentario.resuelto ? "Resuelto" : "Resolver"}
                        </button>
                      </div>

                      <div className="mt-1 whitespace-pre-wrap font-normal leading-relaxed text-[#334155]">
                        {comentario.comentario}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </div>
      </main>

      {modalMode === "proyecto" ? (
        <ProyectoModal
          proyecto={editingProyecto}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setEditingProyecto(null);
          }}
          onSave={handleSaveProyecto}
        />
      ) : null}

      {modalMode === "procedimiento" ? (
        <ProcedimientoModal
          procedimiento={editingProcedimiento}
          proyectoId={selectedProyecto?.id || selectedProyectoId}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setEditingProcedimiento(null);
          }}
          onSave={handleSaveProcedimiento}
        />
      ) : null}

      {modalMode === "adjunto" ? (
        <AdjuntoModal
          proyectoId={selectedProyecto?.id || selectedProyectoId}
          procedimientoId={selectedProcedimiento?.id || selectedProcedimientoId}
          uploading={uploading}
          onClose={() => setModalMode(null)}
          onUpload={handleUploadAdjunto}
        />
      ) : null}

      {modalMode === "comentario" ? (
        <ComentarioModal
          saving={saving}
          onClose={() => setModalMode(null)}
          onSave={handleSaveComentario}
        />
      ) : null}

      <ConfirmAdjuntoModal
        adjunto={adjuntoToDelete}
        saving={saving}
        onClose={() => setAdjuntoToDelete(null)}
        onConfirm={handleDeleteAdjunto}
      />

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default ColaborativoPanel;