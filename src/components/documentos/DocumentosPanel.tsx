// src/components/documentos/DocumentosPanel.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  ChevronDown,
  ChevronsUpDown,
  Download,
  Edit3,
  Eye,
  File,
  FileImage,
  FileSpreadsheet,
  FileText,
  Folder,
  FolderOpen,
  Filter,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  Upload,
  X
} from "lucide-react";
import {
  createInitialFileDraft,
  createInitialFolderDraft,
  formatFileSize,
  getDocumentFileLabel,
  getDocumentFolderLabel,
  getDocumentTipoLabel,
  useDocumentosStore,
  type DocumentFile,
  type DocumentFolder,
  type FileDraft,
  type FolderDraft,
  type SucursalLite,
  type UploadDocumentInput
} from "../../store/documentosStore";
import {
  clearDownloadHistory,
  formatDownloadDate,
  getDownloadHistory,
  getDownloadSourceLabel,
  getDownloadTipoArchivo,
  removeDownloadHistoryItem,
  type NosturDownloadHistoryItem
} from "../../lib/downloads";

/* =========================================================
   NOSSIX / NOSTUR — GESTOR DOCUMENTAL
   Estética compacta unificada con Caja / Colaborativo
========================================================= */

type DocumentosState = ReturnType<typeof useDocumentosStore.getState>;

type SelectOption = {
  value: string;
  label: string;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ModalMode = "folder" | "upload" | "file-edit" | "file-detail" | null;

const TIPO_ARCHIVO_OPTIONS: SelectOption[] = [
  { value: "todos", label: "Todos" },
  { value: "pdf", label: "PDF" },
  { value: "word", label: "Word" },
  { value: "excel", label: "Excel" },
  { value: "imagen", label: "Imágenes" },
  { value: "texto", label: "Texto" },
  { value: "otros", label: "Otros" }
];

const ACTIVO_OPTIONS: SelectOption[] = [
  { value: "activos", label: "Activos" },
  { value: "inactivos", label: "Archivados" },
  { value: "todos", label: "Todos" }
];

const FOLDER_COLOR_OPTIONS: SelectOption[] = [
  { value: "#4f7c90", label: "Azul NOSTUR" },
  { value: "#ff7a1a", label: "Naranja NOSTUR" },
  { value: "#2563eb", label: "Azul" },
  { value: "#16a34a", label: "Verde" },
  { value: "#9333ea", label: "Violeta" },
  { value: "#dc2626", label: "Rojo" },
  { value: "#334155", label: "Gris" }
];

/* =========================================================
   HELPERS
========================================================= */

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

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
  disabled = false,
  inputMode = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      inputMode={inputMode}
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
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] border px-3 text-[12px] font-medium transition",
        checked
          ? "border-[#4f7c90]/30 bg-[#eef6f7] text-[#4f7c90]"
          : "border-black/10 bg-white text-[#64748b] hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      {checked ? <CheckCircle2 size={13} /> : <Plus size={13} />}
      {label}
    </button>
  );
}

function InlineError({ message, onClose }: { message: string | null; onClose: () => void }) {
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

function FileIcon({ tipo }: { tipo?: string | null }) {
  if (tipo === "pdf") return <FileText size={15} strokeWidth={1.8} />;
  if (tipo === "word") return <FileText size={15} strokeWidth={1.8} />;
  if (tipo === "excel") return <FileSpreadsheet size={15} strokeWidth={1.8} />;
  if (tipo === "imagen") return <FileImage size={15} strokeWidth={1.8} />;

  return <File size={15} strokeWidth={1.8} />;
}

function FileTypeBadge({ tipo }: { tipo?: string | null }) {
  const safeTipo = tipo || "otros";

  const className =
    safeTipo === "pdf"
      ? "border-red-200 bg-red-50 text-red-700"
      : safeTipo === "excel"
        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
        : safeTipo === "word"
          ? "border-sky-200 bg-sky-50 text-sky-700"
          : safeTipo === "imagen"
            ? "border-purple-200 bg-purple-50 text-purple-700"
            : "border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={["rounded-md border px-1.5 py-0.5 text-[10px] font-medium", className].join(" ")}>
      {getDocumentTipoLabel(safeTipo)}
    </span>
  );
}

function AccessBlocked({ error }: { error: string | null }) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        <div className="mx-auto flex min-h-[calc(100vh-150px)] w-full max-w-3xl items-center justify-center">
          <div className="rounded-[18px] border border-red-200 bg-white/78 p-6 text-center shadow-sm backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-red-50 text-red-700">
              <ShieldCheck size={24} strokeWidth={1.8} />
            </div>

            <h1 className="text-[17px] font-semibold text-[#172033]">Acceso restringido</h1>

            <p className="mt-2 text-[12px] font-normal text-[#64748b]">
              El Gestor Documental es exclusivo para Administración, Gerencia y Admin General.
            </p>

            {error ? (
              <div className="mt-4 rounded-[12px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
                {error}
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}

/* =========================================================
   MODALES
========================================================= */

function FolderModal({
  folder,
  folders,
  sucursales,
  saving,
  onClose,
  onSave
}: {
  folder: DocumentFolder | null;
  folders: DocumentFolder[];
  sucursales: SucursalLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: FolderDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FolderDraft>(() => createInitialFolderDraft(folder));
  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof FolderDraft>(key: K, value: FolderDraft[K]) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function validate(): string | null {
    if (!draft.nombre.trim()) return "Ingresá el nombre de la carpeta.";
    if (draft.parent_id && draft.parent_id === draft.id) {
      return "Una carpeta no puede ser su propia carpeta superior.";
    }

    return null;
  }

  function handleSave() {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    onSave(draft);
  }

  const folderOptions: SelectOption[] = [
    { value: "", label: "Sin carpeta superior" },
    ...folders
      .filter((item) => item.id !== draft.id && item.activa)
      .map((item) => ({
        value: item.id,
        label: getDocumentFolderLabel(item)
      }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "", label: "Todas / General" },
    ...sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {folder ? "Editar carpeta" : "Nueva carpeta"}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Organizá documentos internos por área, proveedor, sucursal o proceso.
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

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={draft.nombre}
              onChange={(value) => setField("nombre", value)}
              placeholder="Ej: Contratos, Operadores, Bancos..."
            />
          </div>

          <div>
            <FieldLabel>Carpeta superior</FieldLabel>
            <NosturSelect
              value={draft.parent_id || ""}
              onChange={(value) => setField("parent_id", value || null)}
              options={folderOptions}
            />
          </div>

          <div>
            <FieldLabel>Sucursal</FieldLabel>
            <NosturSelect
              value={draft.sucursal_id || ""}
              onChange={(value) => setField("sucursal_id", value || null)}
              options={sucursalOptions}
            />
          </div>

          <div>
            <FieldLabel>Color</FieldLabel>
            <NosturSelect
              value={draft.color}
              onChange={(value) => setField("color", value)}
              options={FOLDER_COLOR_OPTIONS}
            />
          </div>

          <div>
            <FieldLabel>Icono</FieldLabel>
            <TextInput
              value={draft.icono}
              onChange={(value) => setField("icono", value)}
              placeholder="folder"
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Descripción</FieldLabel>
            <TextArea
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Notas internas sobre el contenido de esta carpeta..."
            />
          </div>

          <div className="flex flex-wrap gap-2 md:col-span-2">
            <BooleanChip
              checked={draft.compartida}
              onChange={(value) => setField("compartida", value)}
              label="Compartida internamente"
            />

            <BooleanChip
              checked={draft.activa}
              onChange={(value) => setField("activa", value)}
              label={draft.activa ? "Carpeta activa" : "Carpeta archivada"}
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
            onClick={handleSave}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : folder ? "Guardar cambios" : "Crear carpeta"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UploadModal({
  selectedFolderId,
  folders,
  sucursales,
  uploading,
  onClose,
  onUpload
}: {
  selectedFolderId: string | null;
  folders: DocumentFolder[];
  sucursales: SucursalLite[];
  uploading: boolean;
  onClose: () => void;
  onUpload: (input: UploadDocumentInput) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [draft, setDraft] = useState({
    folder_id: selectedFolderId,
    nombre: "",
    descripcion: "",
    tags: "",
    sucursal_id: "",
    compartido: true
  });
  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof typeof draft>(key: K, value: (typeof draft)[K]) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function handleFile(file: File | null) {
    setLocalError(null);
    setSelectedFile(file);

    if (file && !draft.nombre.trim()) {
      setDraft((current) => ({
        ...current,
        nombre: file.name
      }));
    }
  }

  function validate(): string | null {
    if (!selectedFile) return "Seleccioná un archivo.";
    if (!draft.nombre.trim()) return "Ingresá el nombre visible del archivo.";
    return null;
  }

  function handleUpload() {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    if (!selectedFile) return;

    onUpload({
      file: selectedFile,
      folder_id: draft.folder_id || null,
      nombre: draft.nombre,
      descripcion: draft.descripcion,
      tags: draft.tags,
      sucursal_id: draft.sucursal_id || null,
      compartido: draft.compartido
    });
  }

  const folderOptions: SelectOption[] = [
    { value: "", label: "Sin carpeta" },
    ...folders
      .filter((folder) => folder.activa)
      .map((folder) => ({
        value: folder.id,
        label: getDocumentFolderLabel(folder)
      }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "", label: "Todas / General" },
    ...sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-10 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-3xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Subir archivo</h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              PDF, Word, Excel, imágenes u otros documentos internos.
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

        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => handleFile(event.target.files?.[0] || null)}
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp,.txt"
        />

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mb-4 flex min-h-[110px] w-full flex-col items-center justify-center rounded-[16px] border border-dashed border-[#4f7c90]/35 bg-[#eef6f7] px-4 py-5 text-center transition hover:bg-[#e5f1f3]"
        >
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#4f7c90] text-white">
            <Upload size={18} strokeWidth={1.8} />
          </div>

          <div className="text-[13px] font-semibold text-[#172033]">
            {selectedFile ? selectedFile.name : "Seleccionar archivo"}
          </div>

          <div className="mt-1 text-[12px] font-normal text-[#64748b]">
            {selectedFile
              ? `${formatFileSize(selectedFile.size)} · ${selectedFile.type || "tipo no informado"}`
              : "Hacé clic para elegir el documento desde tu equipo"}
          </div>
        </button>

        <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <FieldLabel>Nombre visible</FieldLabel>
            <TextInput
              value={draft.nombre}
              onChange={(value) => setField("nombre", value)}
              placeholder="Nombre del documento"
            />
          </div>

          <div>
            <FieldLabel>Carpeta</FieldLabel>
            <NosturSelect
              value={draft.folder_id || ""}
              onChange={(value) => setField("folder_id", value || null)}
              options={folderOptions}
            />
          </div>

          <div>
            <FieldLabel>Sucursal</FieldLabel>
            <NosturSelect
              value={draft.sucursal_id || ""}
              onChange={(value) => setField("sucursal_id", value)}
              options={sucursalOptions}
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Tags</FieldLabel>
            <TextInput
              value={draft.tags}
              onChange={(value) => setField("tags", value)}
              placeholder="contrato, proveedor, banco..."
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Descripción</FieldLabel>
            <TextArea
              value={draft.descripcion}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Notas internas del archivo..."
            />
          </div>

          <div className="md:col-span-2">
            <BooleanChip
              checked={draft.compartido}
              onChange={(value) => setField("compartido", value)}
              label="Compartido internamente"
            />
          </div>
        </div>

        <div className="mt-4 rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-[11px] font-medium leading-relaxed text-sky-700">
          Los documentos se guardan en Storage privado. Solo roles autorizados pueden abrirlos o descargarlos.
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
            disabled={uploading}
            onClick={handleUpload}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {uploading ? "Subiendo..." : "Subir archivo"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileEditModal({
  file,
  folders,
  sucursales,
  saving,
  onClose,
  onSave
}: {
  file: DocumentFile | null;
  folders: DocumentFolder[];
  sucursales: SucursalLite[];
  saving: boolean;
  onClose: () => void;
  onSave: (draft: FileDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<FileDraft>(() => createInitialFileDraft(file));
  const [localError, setLocalError] = useState<string | null>(null);

  function setField<K extends keyof FileDraft>(key: K, value: FileDraft[K]) {
    setLocalError(null);
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function validate(): string | null {
    if (!file) return "No hay archivo seleccionado.";
    if (!draft.nombre.trim()) return "Ingresá el nombre del archivo.";
    return null;
  }

  function handleSave() {
    const error = validate();

    if (error) {
      setLocalError(error);
      return;
    }

    onSave(draft);
  }

  const folderOptions: SelectOption[] = [
    { value: "", label: "Sin carpeta" },
    ...folders
      .filter((folder) => folder.activa)
      .map((folder) => ({
        value: folder.id,
        label: getDocumentFolderLabel(folder)
      }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "", label: "Todas / General" },
    ...sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-12 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-72px)] w-full max-w-2xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">Editar archivo</h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Cambiá nombre, carpeta, tags o visibilidad interna.
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

        {!file ? (
          <div className="rounded-[14px] border border-red-200 bg-red-50 p-3 text-[12px] font-medium text-red-700">
            No hay archivo seleccionado.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <FieldLabel>Nombre</FieldLabel>
              <TextInput
                value={draft.nombre}
                onChange={(value) => setField("nombre", value)}
                placeholder="Nombre visible"
              />
            </div>

            <div>
              <FieldLabel>Carpeta</FieldLabel>
              <NosturSelect
                value={draft.folder_id || ""}
                onChange={(value) => setField("folder_id", value || null)}
                options={folderOptions}
              />
            </div>

            <div>
              <FieldLabel>Sucursal</FieldLabel>
              <NosturSelect
                value={draft.sucursal_id || ""}
                onChange={(value) => setField("sucursal_id", value || null)}
                options={sucursalOptions}
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel>Tags</FieldLabel>
              <TextInput
                value={draft.tags}
                onChange={(value) => setField("tags", value)}
                placeholder="contrato, proveedor, banco..."
              />
            </div>

            <div className="md:col-span-2">
              <FieldLabel>Descripción</FieldLabel>
              <TextArea
                value={draft.descripcion}
                onChange={(value) => setField("descripcion", value)}
                placeholder="Notas internas del archivo..."
              />
            </div>

            <div className="md:col-span-2">
              <BooleanChip
                checked={draft.compartido}
                onChange={(value) => setField("compartido", value)}
                label="Compartido internamente"
              />
            </div>
          </div>
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
            disabled={saving || !file}
            onClick={handleSave}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </div>
      </div>
    </div>
  );
}

function FileDetailModal({
  file,
  signedUrl,
  loadingUrl,
  onClose,
  onOpen,
  onDownload,
  onEdit,
  onArchive
}: {
  file: DocumentFile | null;
  signedUrl: string | null;
  loadingUrl: boolean;
  onClose: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  if (!file) return null;

  const isImage = file.tipo_archivo === "imagen";

  return (
    <div className="fixed inset-0 z-[230] flex items-start justify-center bg-black/35 px-4 pt-10 backdrop-blur-sm">
      <div className="max-h-[calc(100vh-64px)] w-full max-w-5xl overflow-auto rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-1.5 flex items-center gap-1.5">
              <FileTypeBadge tipo={file.tipo_archivo} />

              {!file.activo ? (
                <span className="rounded-md border border-red-200 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-700">
                  Archivado
                </span>
              ) : null}
            </div>

            <h2 className="truncate text-[17px] font-semibold text-[#172033]">
              {getDocumentFileLabel(file)}
            </h2>

            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              {file.folder_nombre || "Sin carpeta"} · {formatFileSize(file.size_bytes)}
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

        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
          <main className="rounded-[16px] border border-black/10 bg-[#f8fafc] p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-[14px] font-semibold text-[#172033]">Vista rápida</h3>

              <button
                type="button"
                onClick={onOpen}
                disabled={loadingUrl}
                className="h-8 rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc] disabled:opacity-50"
              >
                {loadingUrl ? "Preparando..." : "Abrir"}
              </button>
            </div>

            {isImage && signedUrl ? (
              <div className="overflow-hidden rounded-[14px] border border-black/10 bg-white">
                <img
                  src={signedUrl}
                  alt={file.nombre}
                  className="max-h-[520px] w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[14px] border border-dashed border-black/10 bg-white p-8 text-center">
                <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-[16px] bg-[#eef6f7] text-[#4f7c90]">
                  <FileIcon tipo={file.tipo_archivo} />
                </div>

                <div className="text-[13px] font-semibold text-[#172033]">{file.nombre}</div>

                <div className="mt-1 text-[12px] font-normal text-[#64748b]">
                  {loadingUrl
                    ? "Preparando vista privada..."
                    : "Usá Abrir o Descargar para consultar este archivo."}
                </div>
              </div>
            )}
          </main>

          <aside className="rounded-[16px] border border-black/10 bg-white p-3">
            <h3 className="mb-3 text-[14px] font-semibold text-[#172033]">Datos del archivo</h3>

            <div className="grid gap-2.5 text-[12px]">
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Nombre</FieldLabel>
                <div className="font-semibold text-[#172033]">{file.nombre}</div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Carpeta</FieldLabel>
                <div className="font-semibold text-[#172033]">
                  {file.folder_nombre || "Sin carpeta"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <FieldLabel>Tipo</FieldLabel>
                  <div className="font-semibold text-[#172033]">
                    {getDocumentTipoLabel(file.tipo_archivo)}
                  </div>
                </div>

                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <FieldLabel>Peso</FieldLabel>
                  <div className="font-semibold text-[#172033]">
                    {formatFileSize(file.size_bytes)}
                  </div>
                </div>
              </div>

              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                <FieldLabel>Fecha de carga</FieldLabel>
                <div className="font-semibold text-[#172033]">{formatDate(file.created_at)}</div>
                <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                  Por {file.created_by_nombre || "usuario interno"}
                </div>
              </div>

              {file.tags?.length ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <FieldLabel>Tags</FieldLabel>
                  <div className="flex flex-wrap gap-1">
                    {file.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#334155] ring-1 ring-black/10"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              {file.descripcion ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                  <FieldLabel>Descripción</FieldLabel>
                  <div className="font-normal leading-relaxed text-[#334155]">
                    {file.descripcion}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-2">
                <button
                  type="button"
                  onClick={onOpen}
                  className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                >
                  Abrir archivo
                </button>

                <button
                  type="button"
                  onClick={onDownload}
                  className="h-8 rounded-[10px] border border-black/10 bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                >
                  Descargar
                </button>

                <button
                  type="button"
                  onClick={onEdit}
                  className="h-8 rounded-[10px] border border-[#4f7c90]/20 bg-[#eef6f7] px-4 text-[12px] font-medium text-[#4f7c90] hover:bg-[#e5f1f3]"
                >
                  Editar datos
                </button>

                {file.activo ? (
                  <button
                    type="button"
                    onClick={onArchive}
                    className="h-8 rounded-[10px] border border-red-200 bg-red-50 px-4 text-[12px] font-medium text-red-700 hover:bg-red-100"
                  >
                    Archivar archivo
                  </button>
                ) : null}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/* =========================================================
   CARDS / LISTAS
========================================================= */

function FolderCard({
  folder,
  selected,
  fileCount,
  onSelect,
  onEdit,
  onArchive
}: {
  folder: DocumentFolder;
  selected: boolean;
  fileCount: number;
  onSelect: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "group rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : "border-black/10 bg-white/68 hover:bg-white",
        !folder.activa ? "opacity-60" : ""
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-white shadow-sm"
            style={{ backgroundColor: folder.color || "#4f7c90" }}
          >
            {selected ? <FolderOpen size={16} /> : <Folder size={16} />}
          </div>

          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-[#172033]">
              {folder.nombre}
            </div>

            <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
              {fileCount} archivos
            </div>

            {folder.descripcion ? (
              <div className="mt-1 line-clamp-2 text-[10.5px] font-normal text-[#94a3b8]">
                {folder.descripcion}
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 gap-1 opacity-100 xl:opacity-0 xl:transition xl:group-hover:opacity-100">
          <span
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
            title="Editar carpeta"
          >
            <Edit3 size={13} />
          </span>

          {folder.activa ? (
            <span
              onClick={(event) => {
                event.stopPropagation();
                onArchive();
              }}
              className="flex h-7 w-7 items-center justify-center rounded-[9px] text-red-600 hover:bg-red-50"
              title="Archivar carpeta"
            >
              <Archive size={13} />
            </span>
          ) : null}
        </div>
      </div>
    </button>
  );
}

function DocumentFileRow({
  file,
  selected,
  onSelect,
  onDetail,
  onOpen,
  onDownload,
  onEdit,
  onArchive
}: {
  file: DocumentFile;
  selected: boolean;
  onSelect: () => void;
  onDetail: () => void;
  onOpen: () => void;
  onDownload: () => void;
  onEdit: () => void;
  onArchive: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        "grid min-w-0 gap-2 rounded-[12px] border px-2.5 py-2 text-left transition xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_94px_92px_112px_140px]",
        selected
          ? "border-[#4f7c90]/50 bg-[#eef6f7]"
          : "border-black/10 bg-[#f8fafc] hover:bg-white",
        !file.activo ? "opacity-60" : ""
      ].join(" ")}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white text-[#4f7c90] shadow-sm ring-1 ring-black/10">
          <FileIcon tipo={file.tipo_archivo} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-[#172033]">
            {file.nombre}
          </div>

          <div className="truncate text-[11px] font-normal text-[#64748b]">
            {file.descripcion || "Sin descripción"}
          </div>
        </div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-[#172033]">
          {file.folder_nombre || "Sin carpeta"}
        </div>

        <div className="truncate text-[11px] font-normal text-[#64748b]">
          {file.sucursal_nombre || "General"}
        </div>
      </div>

      <div>
        <FileTypeBadge tipo={file.tipo_archivo} />

        {!file.activo ? (
          <div className="mt-1 text-[10.5px] font-medium text-red-700">Archivado</div>
        ) : null}
      </div>

      <div className="min-w-0">
        <div className="text-[12px] font-semibold text-[#172033]">
          {formatFileSize(file.size_bytes)}
        </div>

        <div className="text-[11px] font-normal text-[#64748b]">{file.extension || "—"}</div>
      </div>

      <div className="min-w-0">
        <div className="truncate text-[12px] font-semibold text-[#172033]">
          {formatDate(file.created_at)}
        </div>

        <div className="truncate text-[11px] font-normal text-[#64748b]">
          {file.created_by_nombre || "Usuario interno"}
        </div>
      </div>

      <div className="flex items-center justify-end gap-1">
        <span
          onClick={(event) => {
            event.stopPropagation();
            onDetail();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
          title="Ver detalle"
        >
          <Eye size={13} />
        </span>

        <span
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#4f7c90] hover:bg-white"
          title="Abrir"
        >
          <FileText size={13} />
        </span>

        <span
          onClick={(event) => {
            event.stopPropagation();
            onDownload();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-emerald-700 hover:bg-white"
          title="Descargar"
        >
          <Download size={13} />
        </span>

        <span
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
          className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-white hover:text-[#172033]"
          title="Editar"
        >
          <Edit3 size={13} />
        </span>

        {file.activo ? (
          <span
            onClick={(event) => {
              event.stopPropagation();
              onArchive();
            }}
            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-red-600 hover:bg-red-50"
            title="Archivar"
          >
            <Archive size={13} />
          </span>
        ) : null}
      </div>
    </button>
  );
}

/* =========================================================
   PANEL PRINCIPAL
========================================================= */

export function DocumentosPanel() {
  const loading = useDocumentosStore((state: DocumentosState) => state.loading);
  const saving = useDocumentosStore((state: DocumentosState) => state.saving);
  const uploading = useDocumentosStore((state: DocumentosState) => state.uploading);
  const error = useDocumentosStore((state: DocumentosState) => state.error);

  const currentProfile = useDocumentosStore((state: DocumentosState) => state.currentProfile);
  const canManageDocumentos = useDocumentosStore(
    (state: DocumentosState) => state.canManageDocumentos
  );

  const folders = useDocumentosStore((state: DocumentosState) => state.folders);
  const files = useDocumentosStore((state: DocumentosState) => state.files);
  const catalogos = useDocumentosStore((state: DocumentosState) => state.catalogos);
  const filters = useDocumentosStore((state: DocumentosState) => state.filters);
  const selectedFolderId = useDocumentosStore((state: DocumentosState) => state.selectedFolderId);
  const selectedFileId = useDocumentosStore((state: DocumentosState) => state.selectedFileId);

  const loadDocumentos = useDocumentosStore((state: DocumentosState) => state.loadDocumentos);
  const saveFolder = useDocumentosStore((state: DocumentosState) => state.saveFolder);
  const archiveFolder = useDocumentosStore((state: DocumentosState) => state.archiveFolder);

  const uploadDocument = useDocumentosStore((state: DocumentosState) => state.uploadDocument);
  const updateDocumentFile = useDocumentosStore((state: DocumentosState) => state.updateDocumentFile);
  const archiveDocumentFile = useDocumentosStore(
    (state: DocumentosState) => state.archiveDocumentFile
  );

  const getSignedUrl = useDocumentosStore((state: DocumentosState) => state.getSignedUrl);
  const downloadDocument = useDocumentosStore((state: DocumentosState) => state.downloadDocument);

  const setFilter = useDocumentosStore((state: DocumentosState) => state.setFilter);
  const resetFilters = useDocumentosStore((state: DocumentosState) => state.resetFilters);
  const selectFolder = useDocumentosStore((state: DocumentosState) => state.selectFolder);
  const selectFile = useDocumentosStore((state: DocumentosState) => state.selectFile);
  const clearError = useDocumentosStore((state: DocumentosState) => state.clearError);

  const getFilteredFolders = useDocumentosStore(
    (state: DocumentosState) => state.getFilteredFolders
  );
  const getFilteredFiles = useDocumentosStore((state: DocumentosState) => state.getFilteredFiles);
  const getMetrics = useDocumentosStore((state: DocumentosState) => state.getMetrics);

  const filteredFolders = getFilteredFolders();
  const filteredFiles = getFilteredFiles();
  const metrics = getMetrics();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingFolder, setEditingFolder] = useState<DocumentFolder | null>(null);
  const [editingFile, setEditingFile] = useState<DocumentFile | null>(null);
  const [detailFile, setDetailFile] = useState<DocumentFile | null>(null);
  const [detailSignedUrl, setDetailSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const [downloadHistory, setDownloadHistory] = useState<NosturDownloadHistoryItem[]>([]);
  const [showDownloadsFolder, setShowDownloadsFolder] = useState(false);

  const selectedFolder = useMemo<DocumentFolder | null>(() => {
    if (!selectedFolderId) return null;
    return folders.find((folder) => folder.id === selectedFolderId) || null;
  }, [folders, selectedFolderId]);

  const selectedFile = useMemo<DocumentFile | null>(() => {
    if (showDownloadsFolder) return null;

    return filteredFiles.find((file) => file.id === selectedFileId) || filteredFiles[0] || null;
  }, [filteredFiles, selectedFileId, showDownloadsFolder]);

  const folderOptions: SelectOption[] = [
    { value: "todas", label: "Todas" },
    { value: "sin-carpeta", label: "Sin carpeta" },
    ...folders
      .filter((folder) => folder.activa)
      .map((folder) => ({
        value: folder.id,
        label: getDocumentFolderLabel(folder)
      }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "todas", label: "Todas" },
    ...catalogos.sucursales.map((sucursal) => ({
      value: sucursal.id,
      label: sucursal.nombre
    }))
  ];

  useEffect(() => {
    loadDocumentos();
  }, [loadDocumentos]);

  useEffect(() => {
    function refreshDownloads() {
      setDownloadHistory(getDownloadHistory());
    }

    refreshDownloads();

    window.addEventListener("nostur:download-history-updated", refreshDownloads);
    window.addEventListener("storage", refreshDownloads);

    return () => {
      window.removeEventListener("nostur:download-history-updated", refreshDownloads);
      window.removeEventListener("storage", refreshDownloads);
    };
  }, []);

  async function hydrateDetailUrl(file: DocumentFile | null) {
    setDetailSignedUrl(null);

    if (!file) return;

    setLoadingUrl(true);
    const url = await getSignedUrl(file);
    setDetailSignedUrl(url);
    setLoadingUrl(false);
  }

  useEffect(() => {
    if (modalMode === "file-detail") {
      hydrateDetailUrl(detailFile);
    }
  }, [modalMode, detailFile]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  function openNewFolder() {
    setEditingFolder(null);
    setModalMode("folder");
  }

  function openEditFolder(folder: DocumentFolder) {
    setEditingFolder(folder);
    setModalMode("folder");
  }

  function openUpload() {
    setModalMode("upload");
  }

  function openEditFile(file: DocumentFile) {
    setEditingFile(file);
    selectFile(file.id);
    setModalMode("file-edit");
  }

  function openDetailFile(file: DocumentFile) {
    setDetailFile(file);
    selectFile(file.id);
    setModalMode("file-detail");
  }

  async function openFile(file: DocumentFile) {
    const url = await getSignedUrl(file);

    if (!url) {
      showToast("No se pudo abrir el archivo.", "error");
      return;
    }

    window.open(url, "_blank");
  }

  async function downloadFile(file: DocumentFile) {
    const url = await downloadDocument(file);

    if (!url) {
      showToast("No se pudo descargar el archivo.", "error");
      return;
    }

    window.open(url, "_blank");
  }

  async function openDownloadedFile(item: NosturDownloadHistoryItem) {
    if (!item.path) {
      showToast("No se encontró la ruta del archivo.", "error");
      return;
    }

    const ok = await window.nostur?.openDownloadedFile?.(item.path);

    if (!ok) {
      showToast("No se pudo abrir el archivo descargado.", "error");
    }
  }

  async function showDownloadedFile(item: NosturDownloadHistoryItem) {
    if (!item.path) {
      showToast("No se encontró la ruta del archivo.", "error");
      return;
    }

    const ok = await window.nostur?.showDownloadedFile?.(item.path);

    if (!ok) {
      showToast("No se pudo mostrar el archivo en la carpeta.", "error");
    }
  }

  function deleteDownloadItem(item: NosturDownloadHistoryItem) {
    removeDownloadHistoryItem(item.id);
    setDownloadHistory(getDownloadHistory());
    showToast("Descarga quitada del historial.");
  }

  function clearAllDownloadsHistory() {
    clearDownloadHistory();
    setDownloadHistory([]);
    showToast("Historial de descargas limpiado.");
  }

  async function handleSaveFolder(draft: FolderDraft) {
    const ok = await saveFolder(draft);

    if (ok) {
      setModalMode(null);
      setEditingFolder(null);
      showToast(draft.id ? "Carpeta actualizada correctamente." : "Carpeta creada correctamente.");
    }
  }

  async function handleArchiveFolder(folder: DocumentFolder) {
    const ok = await archiveFolder(folder.id);

    if (ok) {
      showToast("Carpeta archivada correctamente.");
    }
  }

  async function handleUpload(input: UploadDocumentInput) {
    const ok = await uploadDocument(input);

    if (ok) {
      setModalMode(null);
      showToast("Archivo subido correctamente.");
    }
  }

  async function handleUpdateFile(draft: FileDraft) {
    const ok = await updateDocumentFile(draft);

    if (ok) {
      setModalMode(null);
      setEditingFile(null);
      showToast("Archivo actualizado correctamente.");
    }
  }

  async function handleArchiveFile(file: DocumentFile) {
    const ok = await archiveDocumentFile(file.id);

    if (ok) {
      setModalMode(null);
      setDetailFile(null);
      showToast("Archivo archivado correctamente.");
    }
  }

  const showBlocked = !loading && currentProfile && !canManageDocumentos;

  if (showBlocked) {
    return <AccessBlocked error={error} />;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Gestor documental
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Gerencia
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Carpetas, archivos internos privados y descargas locales.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                if (showDownloadsFolder) {
                  setDownloadHistory(getDownloadHistory());
                } else {
                  loadDocumentos();
                }
              }}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <button
              type="button"
              onClick={openNewFolder}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-sky-700 px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-sky-800"
            >
              <Folder size={13} />
              Carpeta
            </button>

            <button
              type="button"
              onClick={openUpload}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
            >
              <Upload size={13} />
              Subir archivo
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
                  {showDownloadsFolder
                    ? "Descargas NOSTUR"
                    : selectedFolder
                      ? selectedFolder.nombre
                      : "Todas las carpetas"}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Tipo: {filters.tipoArchivo} · Sucursal: {filters.sucursalId} · Estado:{" "}
                {filters.activos}
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
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_150px_210px_150px]">
                <div>
                  <FieldLabel>Carpeta</FieldLabel>
                  <NosturSelect
                    value={filters.folderId}
                    onChange={(value) => {
                      setShowDownloadsFolder(false);
                      setFilter("folderId", value as typeof filters.folderId);
                      selectFolder(value === "todas" || value === "sin-carpeta" ? null : value);
                    }}
                    options={folderOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <NosturSelect
                    value={filters.tipoArchivo}
                    onChange={(value) => setFilter("tipoArchivo", value as typeof filters.tipoArchivo)}
                    options={TIPO_ARCHIVO_OPTIONS}
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
                    value={filters.activos}
                    onChange={(value) => setFilter("activos", value as typeof filters.activos)}
                    options={ACTIVO_OPTIONS}
                  />
                </div>
              </div>

              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                  <Search size={14} className="shrink-0 text-[#94a3b8]" />

                  <input
                    value={filters.search}
                    onChange={(event) => setFilter("search", event.target.value)}
                    placeholder="Buscar por nombre, descripción, tags, carpeta, tipo..."
                    className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                  />
                </div>

                <button
                  type="button"
                  onClick={loadDocumentos}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Aplicar filtros
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowDownloadsFolder(false);
                    resetFilters();
                  }}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Limpiar
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Carpetas" value={metrics.carpetas} icon={Folder} tone="blue" />
          <MetricCard label="Archivos" value={metrics.archivos} icon={File} tone="orange" />
          <MetricCard label="Descargas" value={downloadHistory.length} icon={Download} tone="green" />
          <MetricCard label="PDF" value={metrics.pdf} icon={FileText} tone="red" />
          <MetricCard label="Excel" value={metrics.excel} icon={FileSpreadsheet} tone="green" />
          <MetricCard
            label="Peso total"
            value={formatFileSize(metrics.pesoTotalBytes)}
            icon={Upload}
            tone="slate"
          />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[320px_minmax(0,1fr)_340px]">
          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">Carpetas</h2>
                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {loading ? "Cargando..." : `${filteredFolders.length} carpetas`}
                </p>
              </div>

              <button
                type="button"
                onClick={openNewFolder}
                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-white text-[#4f7c90] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                title="Nueva carpeta"
              >
                <Plus size={13} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setShowDownloadsFolder(false);
                selectFolder(null);
                setFilter("folderId", "todas");
              }}
              className={[
                "mb-1.5 flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition",
                !showDownloadsFolder && !selectedFolderId && filters.folderId === "todas"
                  ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                  : "border-black/10 bg-[#f8fafc] hover:bg-white"
              ].join(" ")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#4f7c90] text-white">
                <FolderOpen size={16} />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[#172033]">
                  Todas las carpetas
                </div>

                <div className="text-[11px] font-normal text-[#64748b]">
                  {files.filter((file) => file.activo).length} archivos
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setShowDownloadsFolder(true);
                selectFolder(null);
                setFilter("folderId", "todas");
                setDownloadHistory(getDownloadHistory());
              }}
              className={[
                "mb-2 flex w-full items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left shadow-sm transition",
                showDownloadsFolder
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-black/10 bg-[#f8fafc] hover:bg-white"
              ].join(" ")}
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-emerald-700 text-white">
                <Download size={16} />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[12px] font-semibold text-[#172033]">
                  Descargas NOSTUR
                </div>

                <div className="text-[11px] font-normal text-[#64748b]">
                  {downloadHistory.length} archivos descargados
                </div>
              </div>
            </button>

            {loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando carpetas...
              </div>
            ) : filteredFolders.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay carpetas para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid max-h-[calc(100vh-410px)] gap-1.5 overflow-auto pr-1">
                {filteredFolders.map((folder) => (
                  <FolderCard
                    key={folder.id}
                    folder={folder}
                    selected={!showDownloadsFolder && selectedFolderId === folder.id}
                    fileCount={files.filter((file) => file.activo && file.folder_id === folder.id).length}
                    onSelect={() => {
                      setShowDownloadsFolder(false);
                      selectFolder(folder.id);
                      setFilter("folderId", folder.id);
                    }}
                    onEdit={() => openEditFolder(folder)}
                    onArchive={() => handleArchiveFolder(folder)}
                  />
                ))}
              </div>
            )}
          </section>

          <section className="min-w-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-semibold text-[#172033]">
                  {showDownloadsFolder ? "Descargas NOSTUR" : "Archivos"}
                </h2>

                <p className="text-[11.5px] font-normal text-[#64748b]">
                  {showDownloadsFolder
                    ? `${downloadHistory.length} descargas locales`
                    : loading
                      ? "Cargando..."
                      : `${filteredFiles.length} documentos encontrados`}
                </p>
              </div>

              {showDownloadsFolder ? (
                <button
                  type="button"
                  onClick={clearAllDownloadsHistory}
                  disabled={downloadHistory.length === 0}
                  className="h-7 rounded-[9px] border border-red-200 bg-red-50 px-2.5 text-[11px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                >
                  Limpiar historial
                </button>
              ) : null}
            </div>

            {showDownloadsFolder ? (
              downloadHistory.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  Todavía no hay descargas registradas.
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {downloadHistory.map((item) => {
                    const tipoArchivo = getDownloadTipoArchivo(item.filename);
                    const sourceLabel = getDownloadSourceLabel(item.partitionName);
                    const size = item.fileSize || item.receivedBytes || item.totalBytes || 0;

                    return (
                      <div
                        key={item.id}
                        className="grid min-w-0 gap-2 rounded-[12px] border border-black/10 bg-[#f8fafc] px-2.5 py-2 text-left transition hover:bg-white xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_90px_120px_108px]"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[11px] bg-white text-emerald-700 shadow-sm ring-1 ring-black/10">
                            <FileIcon tipo={tipoArchivo} />
                          </div>

                          <div className="min-w-0">
                            <div className="truncate text-[12px] font-semibold text-[#172033]">
                              {item.filename}
                            </div>

                            <div className="truncate text-[11px] font-normal text-[#64748b]">
                              {item.path || "Sin ruta local"}
                            </div>
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {sourceLabel}
                          </div>

                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            {item.folder || "Descargas/NOSTUR"}
                          </div>
                        </div>

                        <div>
                          <FileTypeBadge tipo={tipoArchivo} />
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {formatFileSize(size)}
                          </div>

                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            {formatDownloadDate(item.updatedAt)}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => openDownloadedFile(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-[#4f7c90] hover:bg-white"
                            title="Abrir archivo"
                          >
                            <FileText size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => showDownloadedFile(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-emerald-700 hover:bg-white"
                            title="Mostrar en carpeta"
                          >
                            <FolderOpen size={13} />
                          </button>

                          <button
                            type="button"
                            onClick={() => deleteDownloadItem(item)}
                            className="flex h-7 w-7 items-center justify-center rounded-[9px] text-red-600 hover:bg-red-50"
                            title="Quitar del historial"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : loading ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Cargando documentos...
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                No hay archivos para los filtros seleccionados.
              </div>
            ) : (
              <div className="grid gap-1.5">
                {filteredFiles.map((file) => (
                  <DocumentFileRow
                    key={file.id}
                    file={file}
                    selected={selectedFile?.id === file.id}
                    onSelect={() => selectFile(file.id)}
                    onDetail={() => openDetailFile(file)}
                    onOpen={() => openFile(file)}
                    onDownload={() => downloadFile(file)}
                    onEdit={() => openEditFile(file)}
                    onArchive={() => handleArchiveFile(file)}
                  />
                ))}
              </div>
            )}
          </section>

          <aside className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            {showDownloadsFolder ? (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
                      <Download size={18} />
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                        Descargas NOSTUR
                      </h2>

                      <p className="truncate text-[11.5px] font-normal text-[#64748b]">
                        Archivos descargados desde aplicativos externos
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Total descargas</FieldLabel>
                    <div className="text-[23px] font-semibold tracking-tight text-[#172033]">
                      {downloadHistory.length}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-emerald-200 bg-emerald-50 p-3 text-[11px] font-medium leading-relaxed text-emerald-700">
                    Esta carpeta es local. No sube archivos a Supabase. Sirve para abrir,
                    ubicar o quitar del historial las descargas realizadas desde Ábaco,
                    Aivo, Live Connect y otros aplicativos.
                  </div>

                  <button
                    type="button"
                    onClick={() => setDownloadHistory(getDownloadHistory())}
                    className="h-8 rounded-[10px] border border-black/10 bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                  >
                    Actualizar descargas
                  </button>

                  <button
                    type="button"
                    onClick={clearAllDownloadsHistory}
                    disabled={downloadHistory.length === 0}
                    className="h-8 rounded-[10px] border border-red-200 bg-red-50 px-4 text-[12px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                  >
                    Limpiar historial
                  </button>
                </div>
              </div>
            ) : !selectedFile ? (
              <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                Seleccioná un archivo para ver el detalle.
              </div>
            ) : (
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[#eef6f7] text-[#4f7c90] ring-1 ring-[#4f7c90]/15">
                      <FileIcon tipo={selectedFile.tipo_archivo} />
                    </div>

                    <div className="min-w-0">
                      <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                        {selectedFile.nombre}
                      </h2>

                      <p className="truncate text-[11.5px] font-normal text-[#64748b]">
                        {selectedFile.folder_nombre || "Sin carpeta"}
                      </p>
                    </div>
                  </div>

                  <FileTypeBadge tipo={selectedFile.tipo_archivo} />
                </div>

                <div className="grid gap-2.5 text-[12px]">
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Tamaño</FieldLabel>
                    <div className="text-[23px] font-semibold tracking-tight text-[#172033]">
                      {formatFileSize(selectedFile.size_bytes)}
                    </div>
                  </div>

                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                    <FieldLabel>Datos</FieldLabel>

                    <div className="flex justify-between gap-3">
                      <span>Tipo</span>
                      <strong className="font-semibold">
                        {getDocumentTipoLabel(selectedFile.tipo_archivo)}
                      </strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Extensión</span>
                      <strong className="font-semibold">{selectedFile.extension || "—"}</strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Cargado</span>
                      <strong className="font-semibold">{formatDate(selectedFile.created_at)}</strong>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Sucursal</span>
                      <strong className="font-semibold">
                        {selectedFile.sucursal_nombre || "General"}
                      </strong>
                    </div>
                  </div>

                  {selectedFile.tags?.length ? (
                    <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3">
                      <FieldLabel>Tags</FieldLabel>
                      <div className="flex flex-wrap gap-1">
                        {selectedFile.tags.map((tag) => (
                          <span
                            key={tag}
                            className="rounded-md bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#334155] ring-1 ring-black/10"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-1 gap-2">
                    <button
                      type="button"
                      onClick={() => openDetailFile(selectedFile)}
                      className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                    >
                      Ver detalle
                    </button>

                    <button
                      type="button"
                      onClick={() => openFile(selectedFile)}
                      className="h-8 rounded-[10px] border border-black/10 bg-white px-4 text-[12px] font-medium text-[#334155] hover:bg-[#f8fafc]"
                    >
                      Abrir archivo
                    </button>

                    <button
                      type="button"
                      onClick={() => downloadFile(selectedFile)}
                      className="h-8 rounded-[10px] border border-emerald-200 bg-emerald-50 px-4 text-[12px] font-medium text-emerald-700 hover:bg-emerald-100"
                    >
                      Descargar
                    </button>

                    <button
                      type="button"
                      onClick={() => openEditFile(selectedFile)}
                      className="h-8 rounded-[10px] border border-[#4f7c90]/20 bg-[#eef6f7] px-4 text-[12px] font-medium text-[#4f7c90] hover:bg-[#e5f1f3]"
                    >
                      Editar datos
                    </button>
                  </div>

                  <div className="rounded-[14px] border border-sky-200 bg-sky-50 p-3 text-[11px] font-medium leading-relaxed text-sky-700">
                    Storage privado. Los links de apertura y descarga vencen automáticamente.
                  </div>
                </div>
              </div>
            )}
          </aside>
        </div>
      </main>

      {modalMode === "folder" ? (
        <FolderModal
          folder={editingFolder}
          folders={folders}
          sucursales={catalogos.sucursales}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setEditingFolder(null);
          }}
          onSave={handleSaveFolder}
        />
      ) : null}

      {modalMode === "upload" ? (
        <UploadModal
          selectedFolderId={selectedFolderId}
          folders={folders}
          sucursales={catalogos.sucursales}
          uploading={uploading}
          onClose={() => setModalMode(null)}
          onUpload={handleUpload}
        />
      ) : null}

      {modalMode === "file-edit" ? (
        <FileEditModal
          file={editingFile}
          folders={folders}
          sucursales={catalogos.sucursales}
          saving={saving}
          onClose={() => {
            setModalMode(null);
            setEditingFile(null);
          }}
          onSave={handleUpdateFile}
        />
      ) : null}

      {modalMode === "file-detail" ? (
        <FileDetailModal
          file={detailFile}
          signedUrl={detailSignedUrl}
          loadingUrl={loadingUrl}
          onClose={() => {
            setModalMode(null);
            setDetailFile(null);
            setDetailSignedUrl(null);
          }}
          onOpen={() => detailFile && openFile(detailFile)}
          onDownload={() => detailFile && downloadFile(detailFile)}
          onEdit={() => {
            if (detailFile) {
              setEditingFile(detailFile);
              setModalMode("file-edit");
            }
          }}
          onArchive={() => detailFile && handleArchiveFile(detailFile)}
        />
      ) : null}

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default DocumentosPanel;