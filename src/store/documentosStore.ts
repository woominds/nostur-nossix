import { create } from "zustand";
import { supabase } from "../lib/supabase";

/* =========================================================
   TIPOS BASE
========================================================= */

export type ProfileLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  sucursal_id: string | null;
  rol: string;
  color: string | null;
  activo: boolean;
};

export type SucursalLite = {
  id: string;
  nombre: string;
  color?: string | null;
  activa?: boolean;
  activo?: boolean;
};

export type DocumentFolder = {
  id: string;
  parent_id: string | null;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  icono: string | null;
  sucursal_id: string | null;
  compartida: boolean;
  activa: boolean;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type DocumentFile = {
  id: string;
  folder_id: string | null;
  folder_nombre?: string | null;

  nombre: string;
  descripcion: string | null;

  storage_bucket: string;
  storage_path: string;
  public_url: string | null;

  mime_type: string | null;
  extension: string | null;
  size_bytes: number | string | null;

  tipo_archivo: string | null;
  tags: string[];

  entidad_tipo: string | null;
  entidad_id: string | null;

  sucursal_id: string | null;
  sucursal_nombre?: string | null;

  compartido: boolean;
  activo: boolean;

  created_by: string | null;
  created_by_nombre?: string | null;

  updated_by: string | null;
  created_at: string;
  updated_at: string;
};

export type FolderDraft = {
  id: string | null;
  parent_id: string | null;
  nombre: string;
  descripcion: string;
  color: string;
  icono: string;
  sucursal_id: string | null;
  compartida: boolean;
  activa: boolean;
};

export type FileDraft = {
  id: string | null;
  folder_id: string | null;
  nombre: string;
  descripcion: string;
  tags: string;
  sucursal_id: string | null;
  compartido: boolean;
};

export type UploadDocumentInput = {
  file: File;
  folder_id: string | null;
  nombre: string;
  descripcion: string;
  tags: string;
  sucursal_id: string | null;
  compartido: boolean;
};

export type DocumentosFilters = {
  folderId: string;
  tipoArchivo: "todos" | "pdf" | "word" | "excel" | "imagen" | "texto" | "otros";
  sucursalId: string;
  search: string;
  activos: "activos" | "inactivos" | "todos";
};

export type DocumentosMetrics = {
  carpetas: number;
  archivos: number;
  pdf: number;
  word: number;
  excel: number;
  imagenes: number;
  pesoTotalBytes: number;
};

type DocumentosState = {
  loading: boolean;
  saving: boolean;
  uploading: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canManageDocumentos: boolean;

  folders: DocumentFolder[];
  files: DocumentFile[];

  catalogos: {
    sucursales: SucursalLite[];
  };

  filters: DocumentosFilters;
  selectedFolderId: string | null;
  selectedFileId: string | null;

  loadDocumentos: () => Promise<void>;

  saveFolder: (draft: FolderDraft) => Promise<boolean>;
  archiveFolder: (folderId: string) => Promise<boolean>;

  uploadDocument: (input: UploadDocumentInput) => Promise<boolean>;
  updateDocumentFile: (draft: FileDraft) => Promise<boolean>;
  moveDocumentFile: (fileId: string, folderId: string | null) => Promise<boolean>;
  archiveDocumentFile: (fileId: string) => Promise<boolean>;

  getSignedUrl: (file: DocumentFile) => Promise<string | null>;
  downloadDocument: (file: DocumentFile) => Promise<string | null>;

  setFilter: <K extends keyof DocumentosFilters>(key: K, value: DocumentosFilters[K]) => void;
  resetFilters: () => void;
  selectFolder: (id: string | null) => void;
  selectFile: (id: string | null) => void;
  clearError: () => void;

  getFilteredFolders: () => DocumentFolder[];
  getFilteredFiles: () => DocumentFile[];
  getSelectedFolder: () => DocumentFolder | null;
  getSelectedFile: () => DocumentFile | null;
  getFilesByFolder: (folderId: string | null) => DocumentFile[];
  getMetrics: () => DocumentosMetrics;
};

/* =========================================================
   HELPERS
========================================================= */

function getDefaultFilters(): DocumentosFilters {
  return {
    folderId: "todas",
    tipoArchivo: "todos",
    sucursalId: "todas",
    search: "",
    activos: "activos"
  };
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function normalizeError(error: unknown): string {
  if (!error) return "Ocurrió un error inesperado.";

  if (typeof error === "object" && "message" in error) {
    const message = String((error as { message?: unknown }).message || "Ocurrió un error.");

    if (message.toLowerCase().includes("row-level security")) {
      return "No tenés permisos para esta acción.";
    }

    if (message.toLowerCase().includes("permission denied")) {
      return "Permiso denegado por Supabase/RLS.";
    }

    if (message.toLowerCase().includes("duplicate key")) {
      return "Ya existe un registro igual.";
    }

    if (message.toLowerCase().includes("violates not-null constraint")) {
      return "Falta completar un dato obligatorio.";
    }

    return message;
  }

  return String(error);
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileManageDocumentos(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      ["administracion", "gerencia", "admin_general"].includes(profile.rol)
  );
}

function getExtensionFromName(fileName: string): string {
  const cleanName = cleanText(fileName);
  const parts = cleanName.split(".");
  if (parts.length <= 1) return "";
  return String(parts.pop() || "").toLowerCase();
}

function getTipoArchivo(mimeType?: string | null, extension?: string | null): string {
  const mime = String(mimeType || "").toLowerCase();
  const ext = String(extension || "").toLowerCase();

  if (mime.includes("pdf") || ext === "pdf") return "pdf";

  if (
    mime.includes("word") ||
    mime.includes("document") ||
    ["doc", "docx"].includes(ext)
  ) {
    return "word";
  }

  if (
    mime.includes("excel") ||
    mime.includes("spreadsheet") ||
    ["xls", "xlsx", "csv"].includes(ext)
  ) {
    return "excel";
  }

  if (
    mime.startsWith("image/") ||
    ["jpg", "jpeg", "png", "webp", "gif"].includes(ext)
  ) {
    return "imagen";
  }

  if (mime.startsWith("text/") || ["txt", "csv"].includes(ext)) return "texto";

  return "otros";
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((tag) => cleanText(tag))
    .filter(Boolean);
}

function createStoragePath(file: File, userId: string): string {
  const extension = getExtensionFromName(file.name);
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-zA-Z0-9-_]/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase()
    .slice(0, 60);

  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  const finalName = extension ? `${safeName}-${uuid}.${extension}` : `${safeName}-${uuid}`;

  return `${userId}/${year}/${month}/${finalName}`;
}

function getFolderName(folder: DocumentFolder): string {
  return folder.nombre || "Carpeta sin nombre";
}

function getFileDisplayName(file: DocumentFile): string {
  return file.nombre || "Archivo sin nombre";
}

function isFileActive(file: DocumentFile, activos: DocumentosFilters["activos"]): boolean {
  if (activos === "todos") return true;
  if (activos === "activos") return file.activo;
  return !file.activo;
}

function isFolderActive(folder: DocumentFolder, activos: DocumentosFilters["activos"]): boolean {
  if (activos === "todos") return true;
  if (activos === "activos") return folder.activa;
  return !folder.activa;
}

/* =========================================================
   EXPORTS PARA PANEL
========================================================= */

export function getDocumentFolderLabel(folder: DocumentFolder): string {
  return getFolderName(folder);
}

export function getDocumentFileLabel(file: DocumentFile): string {
  return getFileDisplayName(file);
}

export function getDocumentTipoLabel(tipo: string | null | undefined): string {
  const labels: Record<string, string> = {
    pdf: "PDF",
    word: "Word",
    excel: "Excel",
    imagen: "Imagen",
    texto: "Texto",
    otros: "Otros"
  };

  return labels[String(tipo || "otros")] || "Otros";
}

export function formatFileSize(bytesValue: number | string | null | undefined): string {
  const bytes = Number(bytesValue || 0);

  if (!Number.isFinite(bytes) || bytes <= 0) return "—";

  if (bytes < 1024) return `${bytes} B`;

  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1).replace(".", ",")} KB`;

  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1).replace(".", ",")} MB`;

  const gb = mb / 1024;
  return `${gb.toFixed(1).replace(".", ",")} GB`;
}

export function createInitialFolderDraft(folder?: DocumentFolder | null): FolderDraft {
  if (folder) {
    return {
      id: folder.id,
      parent_id: folder.parent_id || null,
      nombre: folder.nombre || "",
      descripcion: folder.descripcion || "",
      color: folder.color || "#ff7a1a",
      icono: folder.icono || "folder",
      sucursal_id: folder.sucursal_id || null,
      compartida: Boolean(folder.compartida),
      activa: Boolean(folder.activa)
    };
  }

  return {
    id: null,
    parent_id: null,
    nombre: "",
    descripcion: "",
    color: "#ff7a1a",
    icono: "folder",
    sucursal_id: null,
    compartida: true,
    activa: true
  };
}

export function createInitialFileDraft(file?: DocumentFile | null): FileDraft {
  if (file) {
    return {
      id: file.id,
      folder_id: file.folder_id || null,
      nombre: file.nombre || "",
      descripcion: file.descripcion || "",
      tags: Array.isArray(file.tags) ? file.tags.join(", ") : "",
      sucursal_id: file.sucursal_id || null,
      compartido: Boolean(file.compartido)
    };
  }

  return {
    id: null,
    folder_id: null,
    nombre: "",
    descripcion: "",
    tags: "",
    sucursal_id: null,
    compartido: true
  };
}

/* =========================================================
   STORE
========================================================= */

export const useDocumentosStore = create<DocumentosState>((set, get) => ({
  loading: false,
  saving: false,
  uploading: false,
  error: null,

  currentProfile: null,
  canManageDocumentos: false,

  folders: [],
  files: [],

  catalogos: {
    sucursales: []
  },

  filters: getDefaultFilters(),
  selectedFolderId: null,
  selectedFileId: null,

  /* =========================================================
     LOAD
  ========================================================= */

  loadDocumentos: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canManageDocumentos: false,
        folders: [],
        files: [],
        error: "No hay usuario autenticado."
      });

      return;
    }

    const profileRes = await supabase
      .from("profiles")
      .select("*")
      .eq("id", currentUserId)
      .maybeSingle();

    if (profileRes.error) {
      set({
        loading: false,
        error: normalizeError(profileRes.error)
      });

      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canManageDocumentos = canProfileManageDocumentos(currentProfile);

    if (!canManageDocumentos) {
      set({
        loading: false,
        currentProfile,
        canManageDocumentos,
        folders: [],
        files: [],
        error: "Tu usuario no tiene acceso al Gestor Documental."
      });

      return;
    }

    const [foldersRes, filesRes, sucursalesRes] = await Promise.all([
      supabase
        .from("document_folders")
        .select("*")
        .order("nombre", { ascending: true }),

      supabase
        .from("v_document_files")
        .select("*")
        .order("created_at", { ascending: false }),

      supabase
        .from("sucursales")
        .select("*")
        .order("nombre", { ascending: true })
    ]);

    const firstError = foldersRes.error || filesRes.error || sucursalesRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canManageDocumentos,
        error: normalizeError(firstError)
      });

      return;
    }

    const folders = (foldersRes.data || []) as DocumentFolder[];
    const files = (filesRes.data || []) as DocumentFile[];

    set({
      loading: false,
      error: null,
      currentProfile,
      canManageDocumentos,
      folders,
      files,
      catalogos: {
        sucursales: (sucursalesRes.data || []) as SucursalLite[]
      },
      selectedFolderId: get().selectedFolderId || folders[0]?.id || null,
      selectedFileId: get().selectedFileId || files[0]?.id || null
    });
  },

  /* =========================================================
     CARPETAS
  ========================================================= */

  saveFolder: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageDocumentos } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageDocumentos) {
      set({ saving: false, error: "No tenés permisos para crear o editar carpetas." });
      return false;
    }

    if (!cleanText(draft.nombre)) {
      set({ saving: false, error: "Ingresá el nombre de la carpeta." });
      return false;
    }

    const payload = {
      parent_id: draft.parent_id || null,
      nombre: cleanText(draft.nombre),
      descripcion: nullableText(draft.descripcion),
      color: nullableText(draft.color) || "#ff7a1a",
      icono: nullableText(draft.icono) || "folder",
      sucursal_id: draft.sucursal_id || null,
      compartida: Boolean(draft.compartida),
      activa: Boolean(draft.activa),
      updated_by: currentUserId
    };

    let folderId = draft.id;

    if (draft.id) {
      const { error } = await supabase
        .from("document_folders")
        .update(payload)
        .eq("id", draft.id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }
    } else {
      const { data, error } = await supabase
        .from("document_folders")
        .insert({
          ...payload,
          created_by: currentUserId
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return false;
      }

      folderId = data.id;
    }

    await get().loadDocumentos();

    set({
      saving: false,
      selectedFolderId: folderId || get().selectedFolderId
    });

    return true;
  },

  archiveFolder: async (folderId) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageDocumentos } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageDocumentos) {
      set({ saving: false, error: "No tenés permisos para archivar carpetas." });
      return false;
    }

    const { error } = await supabase
      .from("document_folders")
      .update({
        activa: false,
        updated_by: currentUserId
      })
      .eq("id", folderId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadDocumentos();

    set({ saving: false });
    return true;
  },

  /* =========================================================
     ARCHIVOS
  ========================================================= */

  uploadDocument: async (input) => {
    set({ uploading: true, saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageDocumentos } = get();

    if (!currentUserId) {
      set({ uploading: false, saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageDocumentos) {
      set({ uploading: false, saving: false, error: "No tenés permisos para subir archivos." });
      return false;
    }

    if (!input.file) {
      set({ uploading: false, saving: false, error: "Seleccioná un archivo." });
      return false;
    }

    const extension = getExtensionFromName(input.file.name);
    const tipoArchivo = getTipoArchivo(input.file.type, extension);
    const storagePath = createStoragePath(input.file, currentUserId);
    const nombreVisible = cleanText(input.nombre) || input.file.name;

    const uploadRes = await supabase.storage
      .from("documentos")
      .upload(storagePath, input.file, {
        cacheControl: "3600",
        upsert: false,
        contentType: input.file.type || undefined
      });

    if (uploadRes.error) {
      set({
        uploading: false,
        saving: false,
        error: normalizeError(uploadRes.error)
      });

      return false;
    }

    const { data, error } = await supabase
      .from("document_files")
      .insert({
        folder_id: input.folder_id || null,

        nombre: nombreVisible,
        descripcion: nullableText(input.descripcion),

        storage_bucket: "documentos",
        storage_path: storagePath,
        public_url: null,

        mime_type: input.file.type || null,
        extension: extension || null,
        size_bytes: input.file.size,

        tipo_archivo: tipoArchivo,
        tags: parseTags(input.tags),

        entidad_tipo: null,
        entidad_id: null,

        sucursal_id: input.sucursal_id || null,

        compartido: Boolean(input.compartido),
        activo: true,

        created_by: currentUserId,
        updated_by: currentUserId
      })
      .select("id")
      .single();

    if (error) {
      await supabase.storage.from("documentos").remove([storagePath]);

      set({
        uploading: false,
        saving: false,
        error: normalizeError(error)
      });

      return false;
    }

    await get().loadDocumentos();

    set({
      uploading: false,
      saving: false,
      selectedFileId: data.id,
      selectedFolderId: input.folder_id || get().selectedFolderId
    });

    return true;
  },

  updateDocumentFile: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageDocumentos } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageDocumentos) {
      set({ saving: false, error: "No tenés permisos para editar archivos." });
      return false;
    }

    if (!draft.id) {
      set({ saving: false, error: "No hay archivo seleccionado." });
      return false;
    }

    if (!cleanText(draft.nombre)) {
      set({ saving: false, error: "Ingresá el nombre del archivo." });
      return false;
    }

    const { error } = await supabase
      .from("document_files")
      .update({
        folder_id: draft.folder_id || null,
        nombre: cleanText(draft.nombre),
        descripcion: nullableText(draft.descripcion),
        tags: parseTags(draft.tags),
        sucursal_id: draft.sucursal_id || null,
        compartido: Boolean(draft.compartido),
        updated_by: currentUserId
      })
      .eq("id", draft.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadDocumentos();

    set({
      saving: false,
      selectedFileId: draft.id,
      selectedFolderId: draft.folder_id || get().selectedFolderId
    });

    return true;
  },

  moveDocumentFile: async (fileId, folderId) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageDocumentos } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageDocumentos) {
      set({ saving: false, error: "No tenés permisos para mover archivos." });
      return false;
    }

    const { error } = await supabase
      .from("document_files")
      .update({
        folder_id: folderId || null,
        updated_by: currentUserId
      })
      .eq("id", fileId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadDocumentos();

    set({
      saving: false,
      selectedFileId: fileId,
      selectedFolderId: folderId
    });

    return true;
  },

  archiveDocumentFile: async (fileId) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageDocumentos } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageDocumentos) {
      set({ saving: false, error: "No tenés permisos para archivar archivos." });
      return false;
    }

    const { error } = await supabase
      .from("document_files")
      .update({
        activo: false,
        updated_by: currentUserId
      })
      .eq("id", fileId);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadDocumentos();

    set({ saving: false });
    return true;
  },

  /* =========================================================
     URLS PRIVADAS
  ========================================================= */

  getSignedUrl: async (file) => {
    const { canManageDocumentos } = get();

    if (!canManageDocumentos) {
      set({ error: "No tenés permisos para abrir documentos." });
      return null;
    }

    const { data, error } = await supabase.storage
      .from(file.storage_bucket || "documentos")
      .createSignedUrl(file.storage_path, 60 * 10);

    if (error) {
      set({ error: normalizeError(error) });
      return null;
    }

    return data.signedUrl;
  },

  downloadDocument: async (file) => {
    const { canManageDocumentos } = get();

    if (!canManageDocumentos) {
      set({ error: "No tenés permisos para descargar documentos." });
      return null;
    }

    const { data, error } = await supabase.storage
      .from(file.storage_bucket || "documentos")
      .createSignedUrl(file.storage_path, 60 * 10, {
        download: file.nombre || true
      });

    if (error) {
      set({ error: normalizeError(error) });
      return null;
    }

    return data.signedUrl;
  },

  /* =========================================================
     FILTROS / SELECTORES
  ========================================================= */

  setFilter: (key, value) => {
    set((state) => ({
      filters: {
        ...state.filters,
        [key]: value
      }
    }));
  },

  resetFilters: () => {
    set({ filters: getDefaultFilters() });
  },

  selectFolder: (id) => {
    set((state) => ({
      selectedFolderId: id,
      filters: {
        ...state.filters,
        folderId: id || "todas"
      }
    }));
  },

  selectFile: (id) => {
    set({ selectedFileId: id });
  },

  clearError: () => {
    set({ error: null });
  },

  /* =========================================================
     DERIVADOS
  ========================================================= */

  getFilteredFolders: () => {
    const { folders, filters } = get();
    const search = normalizeText(filters.search);

    return folders.filter((folder) => {
      if (!isFolderActive(folder, filters.activos)) return false;

      if (filters.sucursalId !== "todas" && folder.sucursal_id !== filters.sucursalId) {
        return false;
      }

      if (!search) return true;

      const haystack = normalizeText(
        [
          folder.nombre,
          folder.descripcion,
          folder.color,
          folder.icono
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getFilteredFiles: () => {
    const { files, filters } = get();
    const search = normalizeText(filters.search);

    return files.filter((file) => {
      if (!isFileActive(file, filters.activos)) return false;

      if (filters.folderId !== "todas") {
        const selectedFolderId = filters.folderId === "sin-carpeta" ? null : filters.folderId;
        if ((file.folder_id || null) !== selectedFolderId) return false;
      }

      if (filters.tipoArchivo !== "todos" && file.tipo_archivo !== filters.tipoArchivo) {
        return false;
      }

      if (filters.sucursalId !== "todas" && file.sucursal_id !== filters.sucursalId) {
        return false;
      }

      if (!search) return true;

      const haystack = normalizeText(
        [
          file.nombre,
          file.descripcion,
          file.folder_nombre,
          file.mime_type,
          file.extension,
          file.tipo_archivo,
          Array.isArray(file.tags) ? file.tags.join(" ") : "",
          file.sucursal_nombre,
          file.created_by_nombre
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getSelectedFolder: () => {
    const { selectedFolderId, folders } = get();

    if (!selectedFolderId) return null;

    return folders.find((folder) => folder.id === selectedFolderId) || null;
  },

  getSelectedFile: () => {
    const { selectedFileId } = get();
    const files = get().getFilteredFiles();

    return files.find((file) => file.id === selectedFileId) || files[0] || null;
  },

  getFilesByFolder: (folderId) => {
    return get()
      .files.filter((file) => file.activo && (file.folder_id || null) === (folderId || null))
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  getMetrics: () => {
    const folders = get().getFilteredFolders();
    const files = get().getFilteredFiles();

    return {
      carpetas: folders.length,
      archivos: files.length,
      pdf: files.filter((file) => file.tipo_archivo === "pdf").length,
      word: files.filter((file) => file.tipo_archivo === "word").length,
      excel: files.filter((file) => file.tipo_archivo === "excel").length,
      imagenes: files.filter((file) => file.tipo_archivo === "imagen").length,
      pesoTotalBytes: files.reduce((total, file) => total + Number(file.size_bytes || 0), 0)
    };
  }
}));