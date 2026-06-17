/* =========================================================
   NOSSIX / NOSTUR — LiveNos types
========================================================= */

export type InboxKey =
  | "sin_atender"
  | "en_gestion"
  | "cande"
  | "colaboracion"
  | "cerradas"
  | "archivadas"
  | "eliminadas";

export type RightTab = "info" | "tareas" | "historial";

export type ContactoWa = {
  id: string;
  wa_phone: string;
  display_name: string | null;
  profile_name: string | null;
  avatar_url: string | null;
};

export type ProfileLite = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  color: string;
  activo: boolean;
  nombre_publico_whatsapp: string | null;
  mostrar_nombre_agente?: boolean | null;
};

export type Conversacion = {
  id: string;
  contacto_id: string;
  assigned_to: string | null;
  sucursal_id: string | null;
  inbox: string;
  status: string;
  priority: number;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  window_expires_at: string | null;
  wa_phone: string;
  created_at: string;
  updated_at: string;
  last_inbound_message_at: string | null;
  last_outbound_message_at: string | null;
  whatsapp_24h_expires_at: string | null;
  archived_at: string | null;
  deleted_at: string | null;
  closed_at: string | null;
  estado_gestion: string;
  estado_comercial: string;
  categoria: string | null;
  etapa_comercial: string | null;
  subject: string | null;
  titulo: string | null;
  channel: string;
  metadata: Record<string, unknown>;
  tomada_at: string | null;
  tomada_by: string | null;
};

export type ConversacionColaborador = {
  id: string;
  conversacion_id: string;
  profile_id: string;
  added_by: string | null;
  created_at: string;
  profile?: ProfileLite | null;
};

export type Mensaje = {
  id: string;
  conversacion_id: string;
  direction: string;
  type: string;
  text: string | null;
  media: Record<string, unknown> | null;
  reply_to_id?: string | null;
  forwarded?: boolean | null;
  status: string;
  error: string | null;
  wa_message_id: string | null;
  sender_profile_id: string | null;
  wa_timestamp: string;
  created_at: string;
  sender_kind: string;
};

export type LeadOportunidad = {
  id: string;
  conversacion_id: string;
  estado_id: string;
  score: number;
  datos: Record<string, unknown>;
  assigned_to: string | null;
  cande_activa: boolean;
  transferida_at: string | null;
  last_score_at: string;
  created_at: string;
  updated_at: string;
  cande_handoff_requested_at: string | null;
};

export type PipelineEstado = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  es_final: boolean;
  resultado: string | null;
  es_sin_atender: boolean;
};

export type NotaConversacion = {
  id: string;
  conversacion_id: string;
  autor_id: string;
  contenido: string;
  tipo: string;
  created_at: string;
  updated_at?: string | null;
  scheduled_for?: string | null;
};

export type MensajeReaccion = {
  id: string;
  mensaje_id: string;
  autor_id: string | null;
  emoji: string;
  created_at: string;
};

export type WhatsappTemplate = {
  id: string;
  name: string;
  display_name: string;
  language: string;
  category: string | null;
  body: string;
  variables: string[];
  components?: unknown[];
  meta_id?: string | null;
  meta_status: string | null;
  active: boolean;
  last_synced_at?: string | null;
};

export type PendingAttachment = {
  file: File;
  previewUrl: string | null;
  kind: "image" | "document" | "audio";
};

export type PreviewMedia = {
  url: string;
  name: string;
  mime: string;
  type: "image" | "file" | "audio";
};

export type RespuestaRapida = {
  id: string;
  titulo: string;
  contenido: string;
  categoria: string | null;
  atajo: string | null;
  activa: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};

export type CandeFeedbackDraft = {
  message: Mensaje;
  tipo: "positivo" | "negativo" | "correccion";
};

export type ConversationVM = Conversacion & {
  contacto?: ContactoWa | null;
  vendedor?: ProfileLite | null;
  oportunidad?: LeadOportunidad | null;
  colaboradores?: ConversacionColaborador[];
};

export type TimelineItem =
  | {
      id: string;
      kind: "message";
      at: string;
      message: Mensaje;
    }
  | {
      id: string;
      kind: "internal";
      at: string;
      nota: NotaConversacion;
    };

export type MessageRole = "passenger" | "agent" | "cande" | "nia" | "system";