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

export type ColaborativoProyecto = {
  id: string;
  nombre: string;
  descripcion: string | null;
  color: string | null;
  icono: string | null;
  orden: number;
  activo: boolean;

  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;

  cantidad_procedimientos?: number;
  publicados?: number;
  borradores?: number;
  archivados?: number;
  ultimo_movimiento?: string | null;
};

export type ColaborativoProcedimiento = {
  id: string;
  proyecto_id: string;
  proyecto_nombre?: string | null;
  proyecto_color?: string | null;

  titulo: string;
  resumen: string | null;

  contenido_html: string;
  contenido_texto: string | null;

  estado: "BORRADOR" | "PUBLICADO" | "ARCHIVADO" | string;
  etiquetas: string[];

  orden: number;
  activo: boolean;

  ultima_version: number;

  created_by: string | null;
  created_by_nombre?: string | null;

  updated_by: string | null;
  updated_by_nombre?: string | null;

  created_at: string;
  updated_at: string;

  cantidad_adjuntos?: number;
  cantidad_imagenes?: number;
  cantidad_comentarios?: number;
  comentarios_abiertos?: number;
};

export type ColaborativoAdjunto = {
  id: string;

  proyecto_id: string | null;
  procedimiento_id: string | null;

  bucket: string;
  storage_path: string;

  nombre_archivo: string;
  mime_type: string | null;
  extension: string | null;
  size_bytes: number | null;

  tipo: "IMAGEN" | "DOCUMENTO" | "ARCHIVO" | string;

  alt_text: string | null;
  descripcion: string | null;

  usado_en_contenido: boolean;
  activo: boolean;

  created_by: string | null;
  created_at: string;

  public_url?: string | null;
};

export type ColaborativoHistorial = {
  id: string;

  procedimiento_id: string;
  proyecto_id: string | null;

  version: number;

  titulo: string;
  resumen: string | null;
  contenido_html: string;
  contenido_texto: string | null;
  estado: string;

  accion: "CREATE" | "UPDATE" | "ARCHIVE" | "RESTORE" | "DELETE" | string;
  observaciones: string | null;

  created_by: string | null;
  created_at: string;
};

export type ColaborativoComentario = {
  id: string;

  procedimiento_id: string;

  comentario: string;
  resuelto: boolean;
  activo: boolean;

  created_by: string | null;
  updated_by: string | null;

  created_at: string;
  updated_at: string;
};

/* =========================================================
   DRAFTS
========================================================= */

export type ColaborativoProyectoDraft = {
  id: string | null;
  nombre: string;
  descripcion: string;
  color: string;
  icono: string;
  orden: string;
  activo: boolean;
};

export type ColaborativoProcedimientoDraft = {
  id: string | null;
  proyecto_id: string;

  titulo: string;
  resumen: string;

  contenido_html: string;
  contenido_texto: string;

  estado: "BORRADOR" | "PUBLICADO" | "ARCHIVADO";

  etiquetas_texto: string;
  orden: string;
};

export type ColaborativoAdjuntoDraft = {
  proyecto_id: string | null;
  procedimiento_id: string | null;

  file: File | null;

  alt_text: string;
  descripcion: string;

  usado_en_contenido: boolean;
};

/* =========================================================
   FILTROS / MÉTRICAS
========================================================= */

export type ColaborativoFilters = {
  proyectoId: string;
  estado: "todos" | "PUBLICADO" | "BORRADOR" | "ARCHIVADO";
  search: string;
  soloConImagenes: boolean;
};

export type ColaborativoMetrics = {
  proyectos: number;
  procedimientos: number;
  publicados: number;
  borradores: number;
  archivados: number;
  imagenes: number;
  comentariosAbiertos: number;
};

type ColaborativoState = {
  loading: boolean;
  saving: boolean;
  uploading: boolean;
  error: string | null;

  currentProfile: ProfileLite | null;
  canAccessColaborativo: boolean;
  canManageColaborativo: boolean;
  canAdminColaborativo: boolean;

  proyectos: ColaborativoProyecto[];
  procedimientos: ColaborativoProcedimiento[];
  adjuntos: ColaborativoAdjunto[];
  historial: ColaborativoHistorial[];
  comentarios: ColaborativoComentario[];

  filters: ColaborativoFilters;
  selectedProyectoId: string | null;
  selectedProcedimientoId: string | null;

  loadColaborativo: () => Promise<void>;
  loadProcedimientoExtras: (procedimientoId: string) => Promise<void>;

  saveProyecto: (draft: ColaborativoProyectoDraft) => Promise<string | null>;
  toggleProyectoActivo: (proyecto: ColaborativoProyecto) => Promise<boolean>;

  saveProcedimiento: (draft: ColaborativoProcedimientoDraft) => Promise<string | null>;
  cambiarEstadoProcedimiento: (
    procedimiento: ColaborativoProcedimiento,
    estado: "BORRADOR" | "PUBLICADO" | "ARCHIVADO"
  ) => Promise<boolean>;

  uploadAdjunto: (draft: ColaborativoAdjuntoDraft) => Promise<ColaborativoAdjunto | null>;
  deleteAdjunto: (adjunto: ColaborativoAdjunto) => Promise<boolean>;

  saveComentario: (procedimientoId: string, comentario: string) => Promise<boolean>;
  toggleComentarioResuelto: (comentario: ColaborativoComentario) => Promise<boolean>;

  setFilter: <K extends keyof ColaborativoFilters>(key: K, value: ColaborativoFilters[K]) => void;
  resetFilters: () => void;

  selectProyecto: (id: string | null) => void;
  selectProcedimiento: (id: string | null) => void;

  clearError: () => void;

  getFilteredProcedimientos: () => ColaborativoProcedimiento[];
  getSelectedProyecto: () => ColaborativoProyecto | null;
  getSelectedProcedimiento: () => ColaborativoProcedimiento | null;
  getAdjuntosBySelected: () => ColaborativoAdjunto[];
  getHistorialBySelected: () => ColaborativoHistorial[];
  getComentariosBySelected: () => ColaborativoComentario[];
  getMetrics: () => ColaborativoMetrics;
};

/* =========================================================
   HELPERS
========================================================= */

const COLABORATIVO_BUCKET = "colaborativo-assets";

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

function getDefaultFilters(): ColaborativoFilters {
  return {
    proyectoId: "todos",
    estado: "todos",
    search: "",
    soloConImagenes: false
  };
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function nullableText(value: unknown): string | null {
  const cleaned = cleanText(value);
  return cleaned ? cleaned : null;
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
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

    return message;
  }

  return String(error);
}

async function getCurrentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getUser();
  return data.user?.id || null;
}

function canProfileAccess(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      ["vendedor", "administracion", "gerencia", "admin_general"].includes(profile.rol)
  );
}

function canProfileManage(profile: ProfileLite | null): boolean {
  return Boolean(
    profile?.activo &&
      ["administracion", "gerencia", "admin_general"].includes(profile.rol)
  );
}

function canProfileAdmin(profile: ProfileLite | null): boolean {
  return Boolean(profile?.activo && ["gerencia", "admin_general"].includes(profile.rol));
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

function getFileExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? String(parts.pop() || "").toLowerCase() : "";
}



function buildStoragePath(file: File, proyectoId: string | null, procedimientoId: string | null): string {
  const extension = getFileExtension(file.name);
  const random = crypto.randomUUID();
  const safeName = file.name
    .replace(/\.[^/.]+$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase()
    .slice(0, 80);

  const folderProyecto = proyectoId || "sin-proyecto";
  const folderProcedimiento = procedimientoId || "sin-procedimiento";
  const date = getToday();

  return `${folderProyecto}/${folderProcedimiento}/${date}/${random}-${safeName || "archivo"}${
    extension ? `.${extension}` : ""
  }`;
}

function addPublicUrls(adjuntos: ColaborativoAdjunto[]): ColaborativoAdjunto[] {
  return adjuntos.map((adjunto) => {
    const { data } = supabase.storage.from(adjunto.bucket || COLABORATIVO_BUCKET).getPublicUrl(adjunto.storage_path);

    return {
      ...adjunto,
      public_url: data.publicUrl
    };
  });
}

function parseTags(value: string): string[] {
  return value
    .split(",")
    .map((item) => cleanText(item))
    .filter(Boolean)
    .filter((item, index, array) => array.findIndex((inner) => normalizeText(inner) === normalizeText(item)) === index);
}

/* =========================================================
   EXPORTS PARA PANEL
========================================================= */

export function getColaborativoProyectoLabel(proyecto: ColaborativoProyecto): string {
  return proyecto.nombre || "Proyecto sin nombre";
}

export function getColaborativoEstadoLabel(estado: string): string {
  const labels: Record<string, string> = {
    BORRADOR: "Borrador",
    PUBLICADO: "Publicado",
    ARCHIVADO: "Archivado"
  };

  return labels[estado] || estado;
}

export function getColaborativoTipoAdjuntoLabel(tipo: string): string {
  const labels: Record<string, string> = {
    IMAGEN: "Imagen",
    DOCUMENTO: "Documento",
    ARCHIVO: "Archivo"
  };

  return labels[tipo] || tipo;
}

export function formatFileSize(size?: number | null): string {
  if (!size || size <= 0) return "—";

  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1).replace(".", ",")} KB`;

  return `${(size / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

export function createInitialProyectoDraft(
  proyecto?: ColaborativoProyecto | null
): ColaborativoProyectoDraft {
  if (proyecto) {
    return {
      id: proyecto.id,
      nombre: proyecto.nombre || "",
      descripcion: proyecto.descripcion || "",
      color: proyecto.color || "#f97316",
      icono: proyecto.icono || "",
      orden: String(proyecto.orden || 0),
      activo: Boolean(proyecto.activo)
    };
  }

  return {
    id: null,
    nombre: "",
    descripcion: "",
    color: "#f97316",
    icono: "",
    orden: "0",
    activo: true
  };
}

export function createInitialProcedimientoDraft(
  proyectoId?: string | null,
  procedimiento?: ColaborativoProcedimiento | null
): ColaborativoProcedimientoDraft {
  if (procedimiento) {
    return {
      id: procedimiento.id,
      proyecto_id: procedimiento.proyecto_id,
      titulo: procedimiento.titulo || "",
      resumen: procedimiento.resumen || "",
      contenido_html: procedimiento.contenido_html || "",
      contenido_texto: procedimiento.contenido_texto || htmlToPlainText(procedimiento.contenido_html || ""),
      estado:
        procedimiento.estado === "BORRADOR" || procedimiento.estado === "ARCHIVADO"
          ? procedimiento.estado
          : "PUBLICADO",
      etiquetas_texto: Array.isArray(procedimiento.etiquetas)
        ? procedimiento.etiquetas.join(", ")
        : "",
      orden: String(procedimiento.orden || 0)
    };
  }

  return {
    id: null,
    proyecto_id: proyectoId || "",
    titulo: "",
    resumen: "",
    contenido_html: "",
    contenido_texto: "",
    estado: "PUBLICADO",
    etiquetas_texto: "",
    orden: "0"
  };
}

/* =========================================================
   STORE
========================================================= */

export const useColaborativoStore = create<ColaborativoState>((set, get) => ({
  loading: false,
  saving: false,
  uploading: false,
  error: null,

  currentProfile: null,
  canAccessColaborativo: false,
  canManageColaborativo: false,
  canAdminColaborativo: false,

  proyectos: [],
  procedimientos: [],
  adjuntos: [],
  historial: [],
  comentarios: [],

  filters: getDefaultFilters(),
  selectedProyectoId: null,
  selectedProcedimientoId: null,

  /* =========================================================
     LOAD PRINCIPAL
  ========================================================= */

  loadColaborativo: async () => {
    set({ loading: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({
        loading: false,
        currentProfile: null,
        canAccessColaborativo: false,
        canManageColaborativo: false,
        canAdminColaborativo: false,
        proyectos: [],
        procedimientos: [],
        adjuntos: [],
        historial: [],
        comentarios: [],
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
      set({ loading: false, error: normalizeError(profileRes.error) });
      return;
    }

    const currentProfile = (profileRes.data || null) as ProfileLite | null;
    const canAccessColaborativo = canProfileAccess(currentProfile);
    const canManageColaborativo = canProfileManage(currentProfile);
    const canAdminColaborativo = canProfileAdmin(currentProfile);

    if (!canAccessColaborativo) {
      set({
        loading: false,
        currentProfile,
        canAccessColaborativo,
        canManageColaborativo,
        canAdminColaborativo,
        proyectos: [],
        procedimientos: [],
        adjuntos: [],
        historial: [],
        comentarios: [],
        error: "Tu usuario no tiene acceso al módulo Colaborativo."
      });

      return;
    }

    const [proyectosRes, procedimientosRes] = await Promise.all([
      supabase
        .from("v_colaborativo_proyectos_resumen")
        .select("*")
        .eq("activo", true)
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true }),

      supabase
        .from("v_colaborativo_procedimientos_resumen")
        .select("*")
        .order("orden", { ascending: true })
        .order("titulo", { ascending: true })
    ]);

    const firstError = proyectosRes.error || procedimientosRes.error;

    if (firstError) {
      set({
        loading: false,
        currentProfile,
        canAccessColaborativo,
        canManageColaborativo,
        canAdminColaborativo,
        error: normalizeError(firstError)
      });

      return;
    }

    const proyectos = (proyectosRes.data || []) as ColaborativoProyecto[];
    const procedimientos = (procedimientosRes.data || []) as ColaborativoProcedimiento[];

    const currentSelectedProyectoId = get().selectedProyectoId;
    const nextSelectedProyectoId =
      currentSelectedProyectoId && proyectos.some((proyecto) => proyecto.id === currentSelectedProyectoId)
        ? currentSelectedProyectoId
        : proyectos[0]?.id || null;

    const currentSelectedProcedimientoId = get().selectedProcedimientoId;
    const nextSelectedProcedimientoId =
      currentSelectedProcedimientoId &&
      procedimientos.some((procedimiento) => procedimiento.id === currentSelectedProcedimientoId)
        ? currentSelectedProcedimientoId
        : procedimientos.find((procedimiento) => procedimiento.proyecto_id === nextSelectedProyectoId)?.id ||
          procedimientos[0]?.id ||
          null;

    set({
      loading: false,
      error: null,
      currentProfile,
      canAccessColaborativo,
      canManageColaborativo,
      canAdminColaborativo,
      proyectos,
      procedimientos,
      selectedProyectoId: nextSelectedProyectoId,
      selectedProcedimientoId: nextSelectedProcedimientoId
    });

    if (nextSelectedProcedimientoId) {
      await get().loadProcedimientoExtras(nextSelectedProcedimientoId);
    }
  },

  /* =========================================================
     LOAD EXTRAS
  ========================================================= */

  loadProcedimientoExtras: async (procedimientoId) => {
    if (!procedimientoId) {
      set({ adjuntos: [], historial: [], comentarios: [] });
      return;
    }

    const [adjuntosRes, historialRes, comentariosRes] = await Promise.all([
      supabase
        .from("colaborativo_adjuntos")
        .select("*")
        .eq("procedimiento_id", procedimientoId)
        .eq("activo", true)
        .order("created_at", { ascending: false }),

      supabase
        .from("colaborativo_historial")
        .select("*")
        .eq("procedimiento_id", procedimientoId)
        .order("version", { ascending: false }),

      supabase
        .from("colaborativo_comentarios")
        .select("*")
        .eq("procedimiento_id", procedimientoId)
        .eq("activo", true)
        .order("created_at", { ascending: false })
    ]);

    const firstError = adjuntosRes.error || historialRes.error || comentariosRes.error;

    if (firstError) {
      set({ error: normalizeError(firstError) });
      return;
    }

    set({
      adjuntos: addPublicUrls((adjuntosRes.data || []) as ColaborativoAdjunto[]),
      historial: (historialRes.data || []) as ColaborativoHistorial[],
      comentarios: (comentariosRes.data || []) as ColaborativoComentario[]
    });
  },

  /* =========================================================
     PROYECTOS
  ========================================================= */

  saveProyecto: async (draft) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageColaborativo } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return null;
    }

    if (!canManageColaborativo) {
      set({ saving: false, error: "No tenés permisos para administrar proyectos." });
      return null;
    }

    if (cleanText(draft.nombre).length < 2) {
      set({ saving: false, error: "Ingresá el nombre del proyecto." });
      return null;
    }

    const payload = {
      nombre: cleanText(draft.nombre),
      descripcion: nullableText(draft.descripcion),
      color: nullableText(draft.color),
      icono: nullableText(draft.icono),
      orden: Number(draft.orden) || 0,
      activo: Boolean(draft.activo),
      updated_by: currentUserId
    };

    let proyectoId = draft.id;

    if (draft.id) {
      const { error } = await supabase
        .from("colaborativo_proyectos")
        .update(payload)
        .eq("id", draft.id);

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }
    } else {
      const { data, error } = await supabase
        .from("colaborativo_proyectos")
        .insert({
          ...payload,
          created_by: currentUserId
        })
        .select("id")
        .single();

      if (error) {
        set({ saving: false, error: normalizeError(error) });
        return null;
      }

      proyectoId = data.id;
    }

    await get().loadColaborativo();

    set({
      saving: false,
      selectedProyectoId: proyectoId,
      filters: {
        ...get().filters,
        proyectoId: proyectoId || "todos"
      }
    });

    return proyectoId;
  },

  toggleProyectoActivo: async (proyecto) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();
    const { canManageColaborativo } = get();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!canManageColaborativo) {
      set({ saving: false, error: "No tenés permisos para modificar proyectos." });
      return false;
    }

    const { error } = await supabase
      .from("colaborativo_proyectos")
      .update({
        activo: !proyecto.activo,
        updated_by: currentUserId
      })
      .eq("id", proyecto.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadColaborativo();

    set({ saving: false });
    return true;
  },

  /* =========================================================
     PROCEDIMIENTOS
  ========================================================= */

  saveProcedimiento: async (draft) => {
    set({ saving: true, error: null });

    if (!draft.proyecto_id) {
      set({ saving: false, error: "Seleccioná un proyecto." });
      return null;
    }

    if (cleanText(draft.titulo).length < 2) {
      set({ saving: false, error: "Ingresá el título del procedimiento." });
      return null;
    }

    const contenidoTexto = cleanText(draft.contenido_texto) || htmlToPlainText(draft.contenido_html);

    const { data, error } = await supabase.rpc("guardar_colaborativo_procedimiento", {
      p_id: draft.id,
      p_proyecto_id: draft.proyecto_id,
      p_titulo: cleanText(draft.titulo),
      p_resumen: nullableText(draft.resumen),
      p_contenido_html: draft.contenido_html || "",
      p_contenido_texto: contenidoTexto,
      p_estado: draft.estado || "PUBLICADO",
      p_etiquetas: parseTags(draft.etiquetas_texto),
      p_orden: Number(draft.orden) || 0
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return null;
    }

    const procedimientoId = String(data || "");

    await get().loadColaborativo();

    set({
      saving: false,
      selectedProyectoId: draft.proyecto_id,
      selectedProcedimientoId: procedimientoId
    });

    if (procedimientoId) {
      await get().loadProcedimientoExtras(procedimientoId);
    }

    return procedimientoId;
  },

  cambiarEstadoProcedimiento: async (procedimiento, estado) => {
    set({ saving: true, error: null });

    const { error } = await supabase.rpc("cambiar_estado_colaborativo_procedimiento", {
      p_id: procedimiento.id,
      p_estado: estado
    });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadColaborativo();

    set({
      saving: false,
      selectedProyectoId: procedimiento.proyecto_id,
      selectedProcedimientoId: procedimiento.id
    });

    await get().loadProcedimientoExtras(procedimiento.id);

    return true;
  },

  /* =========================================================
     ADJUNTOS / IMÁGENES
  ========================================================= */

  uploadAdjunto: async (draft) => {
    set({ uploading: true, error: null });

    const { canAccessColaborativo } = get();

    if (!canAccessColaborativo) {
      set({ uploading: false, error: "No tenés permisos para subir archivos." });
      return null;
    }

    if (!draft.file) {
      set({ uploading: false, error: "Seleccioná un archivo." });
      return null;
    }

    const file = draft.file;
    const storagePath = buildStoragePath(file, draft.proyecto_id, draft.procedimiento_id);

    const uploadRes = await supabase.storage
      .from(COLABORATIVO_BUCKET)
      .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (uploadRes.error) {
      set({ uploading: false, error: normalizeError(uploadRes.error) });
      return null;
    }

    const registerRes = await supabase.rpc("registrar_colaborativo_adjunto", {
      p_proyecto_id: draft.proyecto_id,
      p_procedimiento_id: draft.procedimiento_id,
      p_storage_path: storagePath,
      p_nombre_archivo: file.name,
      p_mime_type: file.type || null,
      p_size_bytes: file.size,
      p_alt_text: nullableText(draft.alt_text),
      p_descripcion: nullableText(draft.descripcion),
      p_usado_en_contenido: Boolean(draft.usado_en_contenido)
    });

    if (registerRes.error) {
      await supabase.storage.from(COLABORATIVO_BUCKET).remove([storagePath]);
      set({ uploading: false, error: normalizeError(registerRes.error) });
      return null;
    }

    const adjuntoId = String(registerRes.data || "");

    const { data, error } = await supabase
      .from("colaborativo_adjuntos")
      .select("*")
      .eq("id", adjuntoId)
      .single();

    if (error) {
      set({ uploading: false, error: normalizeError(error) });
      return null;
    }

    const created = addPublicUrls([data as ColaborativoAdjunto])[0];

    if (draft.procedimiento_id) {
      await get().loadProcedimientoExtras(draft.procedimiento_id);
      await get().loadColaborativo();
    }

    set({ uploading: false });

    return created;
  },

  deleteAdjunto: async (adjunto) => {
    set({ saving: true, error: null });

    const { canAdminColaborativo } = get();

    if (!canAdminColaborativo) {
      set({ saving: false, error: "Solo Gerencia o Admin General pueden eliminar adjuntos." });
      return false;
    }

    const { error } = await supabase
      .from("colaborativo_adjuntos")
      .update({ activo: false })
      .eq("id", adjunto.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    if (adjunto.procedimiento_id) {
      await get().loadProcedimientoExtras(adjunto.procedimiento_id);
    }

    await get().loadColaborativo();

    set({ saving: false });
    return true;
  },

  /* =========================================================
     COMENTARIOS
  ========================================================= */

  saveComentario: async (procedimientoId, comentario) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    if (!procedimientoId) {
      set({ saving: false, error: "Seleccioná un procedimiento." });
      return false;
    }

    if (cleanText(comentario).length < 2) {
      set({ saving: false, error: "Escribí un comentario." });
      return false;
    }

    const { error } = await supabase
      .from("colaborativo_comentarios")
      .insert({
        procedimiento_id: procedimientoId,
        comentario: cleanText(comentario),
        created_by: currentUserId,
        updated_by: currentUserId,
        activo: true
      });

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadProcedimientoExtras(procedimientoId);
    await get().loadColaborativo();

    set({ saving: false });
    return true;
  },

  toggleComentarioResuelto: async (comentario) => {
    set({ saving: true, error: null });

    const currentUserId = await getCurrentUserId();

    if (!currentUserId) {
      set({ saving: false, error: "No hay usuario autenticado." });
      return false;
    }

    const { error } = await supabase
      .from("colaborativo_comentarios")
      .update({
        resuelto: !comentario.resuelto,
        updated_by: currentUserId
      })
      .eq("id", comentario.id);

    if (error) {
      set({ saving: false, error: normalizeError(error) });
      return false;
    }

    await get().loadProcedimientoExtras(comentario.procedimiento_id);
    await get().loadColaborativo();

    set({ saving: false });
    return true;
  },

  /* =========================================================
     FILTROS / SELECCIÓN
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

  selectProyecto: (id) => {
    const procedimientos = get().procedimientos;
    const firstProcedimiento =
      procedimientos.find((procedimiento) => procedimiento.proyecto_id === id && procedimiento.activo) ||
      procedimientos.find((procedimiento) => procedimiento.proyecto_id === id) ||
      null;

    set({
      selectedProyectoId: id,
      selectedProcedimientoId: firstProcedimiento?.id || null,
      filters: {
        ...get().filters,
        proyectoId: id || "todos"
      }
    });

    if (firstProcedimiento?.id) {
      void get().loadProcedimientoExtras(firstProcedimiento.id);
    } else {
      set({ adjuntos: [], historial: [], comentarios: [] });
    }
  },

  selectProcedimiento: (id) => {
    const procedimiento = get().procedimientos.find((item) => item.id === id) || null;

    set({
      selectedProcedimientoId: id,
      selectedProyectoId: procedimiento?.proyecto_id || get().selectedProyectoId
    });

    if (id) {
      void get().loadProcedimientoExtras(id);
    } else {
      set({ adjuntos: [], historial: [], comentarios: [] });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  /* =========================================================
     DERIVADOS
  ========================================================= */

  getFilteredProcedimientos: () => {
    const { procedimientos, filters, selectedProyectoId } = get();
    const search = normalizeText(filters.search);

    return procedimientos.filter((procedimiento) => {
      if (filters.proyectoId !== "todos" && procedimiento.proyecto_id !== filters.proyectoId) return false;

      if (filters.proyectoId === "todos" && selectedProyectoId && procedimiento.proyecto_id !== selectedProyectoId) {
        return false;
      }

      if (filters.estado !== "todos" && procedimiento.estado !== filters.estado) return false;

      if (filters.soloConImagenes && Number(procedimiento.cantidad_imagenes || 0) <= 0) return false;

      if (!search) return true;

      const haystack = normalizeText(
        [
          procedimiento.titulo,
          procedimiento.resumen,
          procedimiento.contenido_texto,
          procedimiento.proyecto_nombre,
          procedimiento.estado,
          Array.isArray(procedimiento.etiquetas) ? procedimiento.etiquetas.join(" ") : ""
        ].join(" ")
      );

      return haystack.includes(search);
    });
  },

  getSelectedProyecto: () => {
    const { selectedProyectoId, proyectos } = get();

    return (
      proyectos.find((proyecto) => proyecto.id === selectedProyectoId) ||
      proyectos[0] ||
      null
    );
  },

  getSelectedProcedimiento: () => {
    const { selectedProcedimientoId } = get();
    const procedimientos = get().getFilteredProcedimientos();

    return (
      procedimientos.find((procedimiento) => procedimiento.id === selectedProcedimientoId) ||
      procedimientos[0] ||
      null
    );
  },

  getAdjuntosBySelected: () => {
    const selected = get().getSelectedProcedimiento();

    if (!selected) return [];

    return get()
      .adjuntos.filter((adjunto) => adjunto.procedimiento_id === selected.id && adjunto.activo)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
  },

  getHistorialBySelected: () => {
    const selected = get().getSelectedProcedimiento();

    if (!selected) return [];

    return get()
      .historial.filter((item) => item.procedimiento_id === selected.id)
      .sort((a, b) => Number(b.version) - Number(a.version));
  },

  getComentariosBySelected: () => {
    const selected = get().getSelectedProcedimiento();

    if (!selected) return [];

    return get()
      .comentarios.filter((item) => item.procedimiento_id === selected.id && item.activo)
      .sort((a, b) => {
        if (a.resuelto !== b.resuelto) return a.resuelto ? 1 : -1;
        return String(b.created_at).localeCompare(String(a.created_at));
      });
  },

  getMetrics: () => {
    const proyectos = get().proyectos;
    const procedimientos = get().procedimientos.filter((procedimiento) => procedimiento.activo);

    return {
      proyectos: proyectos.filter((proyecto) => proyecto.activo).length,
      procedimientos: procedimientos.length,
      publicados: procedimientos.filter((procedimiento) => procedimiento.estado === "PUBLICADO").length,
      borradores: procedimientos.filter((procedimiento) => procedimiento.estado === "BORRADOR").length,
      archivados: procedimientos.filter((procedimiento) => procedimiento.estado === "ARCHIVADO").length,
      imagenes: procedimientos.reduce(
        (total, procedimiento) => total + Number(procedimiento.cantidad_imagenes || 0),
        0
      ),
      comentariosAbiertos: procedimientos.reduce(
        (total, procedimiento) => total + Number(procedimiento.comentarios_abiertos || 0),
        0
      )
    };
  }
}));