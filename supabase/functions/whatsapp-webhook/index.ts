// @ts-nocheck

/* =========================================================
   NOSSIX / NOSTUR — whatsapp-webhook
   Versión limpia para esquema LiveNos nuevo.

   Escribe en:
   - contactos_wa
   - conversaciones
   - mensajes
   - lead_oportunidades

   Maneja:
   - verificación GET de Meta
   - mensajes inbound
   - status updates
   - descarga de media a bucket comunicaciones-media
========================================================= */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: {
          display_phone_number?: string;
          phone_number_id?: string;
        };
        contacts?: Array<{
          profile?: {
            name?: string;
          };
          wa_id?: string;
        }>;
        messages?: Array<any>;
        statuses?: Array<any>;
      };
    }>;
  }>;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

/* =========================================================
   RESPONSES
========================================================= */

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function textResponse(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain"
    }
  });
}

/* =========================================================
   ENV / CLIENTS
========================================================= */

function getSupabaseAdmin() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");

  const serviceRoleKey =
    Deno.env.get("NOSTUR_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl) {
    throw new Error("Falta configurar SUPABASE_URL.");
  }

  if (!serviceRoleKey) {
    throw new Error("Falta configurar NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getEnvSupabaseUrl() {
  const value = Deno.env.get("SUPABASE_URL");

  if (!value) {
    throw new Error("Falta SUPABASE_URL.");
  }

  return value;
}

function getEnvServiceRoleKey() {
  const value =
    Deno.env.get("NOSTUR_SERVICE_ROLE_KEY") ||
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!value) {
    throw new Error("Falta NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY.");
  }

  return value;
}

function fireAndForgetCandeReply(params: {
  conversationId?: string | null;
  inboundMessageId?: string | null;
  oportunidadId?: string | null;
  source?: string;
}) {
  const conversationId = String(params.conversationId || "").trim();

  if (!conversationId) {
    console.warn("[whatsapp-webhook] CANDE no se dispara: falta conversationId.");
    return;
  }

  const supabaseUrl = getEnvSupabaseUrl();
  const serviceRoleKey = getEnvServiceRoleKey();

  const body = {
    conversation_id: conversationId,
    conversacion_id: conversationId,
    inbound_message_id: params.inboundMessageId || null,
    mensaje_id: params.inboundMessageId || null,
    oportunidad_id: params.oportunidadId || null,
    source: params.source || "whatsapp-webhook"
  };

  EdgeRuntime.waitUntil(
    fetch(`${supabaseUrl}/functions/v1/cande-reply`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    })
      .then(async (response) => {
        let data: any = null;

        try {
          data = await response.json();
        } catch {
          data = null;
        }

        console.log("[whatsapp-webhook] cande-reply result", {
          status: response.status,
          ok: response.ok,
          data
        });
      })
      .catch((error) => {
        console.error("[whatsapp-webhook] cande-reply error", error?.message || error);
      })
  );
}

function getMetaConfig() {
  const token =
    Deno.env.get("WHATSAPP_ACCESS_TOKEN") ||
    Deno.env.get("WHATSAPP_TOKEN");

  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v25.0";

  if (!token) {
    throw new Error("Falta configurar WHATSAPP_ACCESS_TOKEN.");
  }

  return {
    token,
    apiVersion
  };
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function readRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function normalizePhoneDigits(value: unknown): string {
  return String(value || "").replace(/[^\d]/g, "");
}

function getNowIso(): string {
  return new Date().toISOString();
}

function addHoursIso(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function safeFileName(value: unknown, fallback = "archivo"): string {
  const name = cleanText(value) || fallback;

  return name
    .replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function getExtensionFromMime(mimeType?: string | null): string {
  const mime = cleanText(mimeType).toLowerCase();

  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/webm": "webm",
    "video/mp4": "mp4",
    "video/3gpp": "3gp"
  };

  return map[mime] || "bin";
}

function getMessageContent(message: any): string | null {
  const type = message?.type;

  if (type === "text") return cleanText(message?.text?.body) || null;

  if (type === "button") return cleanText(message?.button?.text) || null;

  if (type === "interactive") {
    return (
      cleanText(message?.interactive?.button_reply?.title) ||
      cleanText(message?.interactive?.list_reply?.title) ||
      cleanText(message?.interactive?.button_reply?.id) ||
      cleanText(message?.interactive?.list_reply?.id) ||
      null
    );
  }

  if (type === "image") return cleanText(message?.image?.caption) || "Imagen recibida";
  if (type === "audio") return "Audio recibido";
  if (type === "video") return cleanText(message?.video?.caption) || "Video recibido";

  if (type === "document") {
    return (
      cleanText(message?.document?.caption) ||
      cleanText(message?.document?.filename) ||
      "Documento recibido"
    );
  }

  if (type === "sticker") return "Sticker recibido";
  if (type === "location") return "Ubicación recibida";
  if (type === "contacts") return "Contacto recibido";
  if (type === "system") return "Mensaje de sistema";
  if (type === "unsupported") return "Mensaje no soportado";

  return "Mensaje recibido";
}

function mapMessageType(message: any): string {
  const type = cleanText(message?.type).toLowerCase();

  const allowed = [
    "text",
    "image",
    "audio",
    "video",
    "document",
    "sticker",
    "location",
    "contacts",
    "interactive",
    "system",
    "unsupported"
  ];

  if (allowed.includes(type)) return type;
  if (type === "button") return "interactive";

  return "unsupported";
}

function getMediaData(message: any): {
  mediaId: string | null;
  filename: string | null;
  mimeType: string | null;
  sha256: string | null;
} {
  const type = message?.type;

  const media =
    type === "image"
      ? message.image
      : type === "audio"
        ? message.audio
        : type === "video"
          ? message.video
          : type === "document"
            ? message.document
            : type === "sticker"
              ? message.sticker
              : null;

  return {
    mediaId: media?.id || null,
    filename: media?.filename || null,
    mimeType: media?.mime_type || null,
    sha256: media?.sha256 || null
  };
}

/* =========================================================
   DEBUG
========================================================= */

async function saveWebhookDebug(params: {
  supabase: any;
  eventType: string;
  field: string | null;
  whatsappMessageId?: string | null;
  status?: string | null;
  fromPhone?: string | null;
  recipientId?: string | null;
  rawPayload: any;
}) {
  try {
    await params.supabase.from("whatsapp_webhook_debug").insert({
      event_type: params.eventType,
      field: params.field,
      whatsapp_message_id: params.whatsappMessageId || null,
      status: params.status || null,
      from_phone: params.fromPhone || null,
      recipient_id: params.recipientId || null,
      raw_payload: params.rawPayload
    });
  } catch {
    // El debug nunca debe romper el webhook.
  }
}

/* =========================================================
   MEDIA DOWNLOAD FROM META → SUPABASE STORAGE
========================================================= */

async function downloadIncomingMedia(params: {
  supabase: any;
  token: string;
  apiVersion: string;
  conversationId: string;
  message: any;
}) {
  const mediaData = getMediaData(params.message);

  if (!mediaData.mediaId) {
    return null;
  }

  const metaInfoUrl = `https://graph.facebook.com/${params.apiVersion}/${mediaData.mediaId}`;

  const infoRes = await fetch(metaInfoUrl, {
    headers: {
      Authorization: `Bearer ${params.token}`
    }
  });

  const infoData = await infoRes.json();

  if (!infoRes.ok || infoData.error || !infoData.url) {
    return {
      whatsapp_media_id: mediaData.mediaId,
      filename: mediaData.filename,
      mime_type: mediaData.mimeType,
      sha256: mediaData.sha256,
      url: null,
      path: null,
      size: null,
      downloaded_at: null,
      download_error:
        infoData?.error?.message || "No se pudo obtener la URL del archivo de Meta."
    };
  }

  const fileRes = await fetch(infoData.url, {
    headers: {
      Authorization: `Bearer ${params.token}`
    }
  });

  if (!fileRes.ok) {
    return {
      whatsapp_media_id: mediaData.mediaId,
      filename: mediaData.filename,
      mime_type: mediaData.mimeType,
      sha256: mediaData.sha256,
      url: null,
      path: null,
      size: null,
      downloaded_at: null,
      download_error: `No se pudo descargar el archivo de Meta. HTTP ${fileRes.status}`
    };
  }

  const blob = await fileRes.blob();

  const mimeType =
    cleanText(mediaData.mimeType) ||
    cleanText(fileRes.headers.get("content-type")) ||
    blob.type ||
    "application/octet-stream";

  const extension = getExtensionFromMime(mimeType);

  const fallbackName =
    params.message?.type === "image"
      ? `imagen.${extension}`
      : params.message?.type === "audio"
        ? `audio.${extension}`
        : params.message?.type === "video"
          ? `video.${extension}`
          : params.message?.type === "sticker"
            ? `sticker.${extension}`
            : `documento.${extension}`;

  const filename = safeFileName(mediaData.filename, fallbackName);

  const storagePath = `whatsapp-inbound/${params.conversationId}/${Date.now()}-${mediaData.mediaId}.${extension}`;

  const uploadRes = await params.supabase.storage
    .from("comunicaciones-media")
    .upload(storagePath, blob, {
      contentType: mimeType,
      cacheControl: "3600",
      upsert: false
    });

  if (uploadRes.error) {
    return {
      whatsapp_media_id: mediaData.mediaId,
      filename,
      mime_type: mimeType,
      sha256: mediaData.sha256,
      url: null,
      path: null,
      size: blob.size,
      downloaded_at: null,
      download_error: uploadRes.error.message
    };
  }

  const publicRes = params.supabase.storage
    .from("comunicaciones-media")
    .getPublicUrl(storagePath);

  return {
    whatsapp_media_id: mediaData.mediaId,
    filename,
    mime_type: mimeType,
    sha256: mediaData.sha256,
    url: publicRes.data.publicUrl,
    path: storagePath,
    size: blob.size,
    downloaded_at: new Date().toISOString(),
    download_error: null
  };
}

/* =========================================================
   CONTACTO / CONVERSACIÓN / OPORTUNIDAD
========================================================= */

async function findOrCreateContactoWa(params: {
  supabase: any;
  phone: string;
  contactName: string | null;
}) {
  const existingRes = await params.supabase
    .from("contactos_wa")
    .select("id, display_name, profile_name")
    .eq("wa_phone", params.phone)
    .limit(1)
    .maybeSingle();

  if (existingRes.error) throw existingRes.error;

  if (existingRes.data?.id) {
    await params.supabase
      .from("contactos_wa")
      .update({
        profile_name: params.contactName || existingRes.data.profile_name || null,
        display_name:
          existingRes.data.display_name ||
          params.contactName ||
          existingRes.data.profile_name ||
          params.phone,
        updated_at: getNowIso()
      })
      .eq("id", existingRes.data.id);

    return existingRes.data.id as string;
  }

  const insertRes = await params.supabase
    .from("contactos_wa")
    .insert({
      wa_phone: params.phone,
      display_name: params.contactName || params.phone,
      profile_name: params.contactName || null
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;

  return insertRes.data.id as string;
}

async function getInitialPipelineEstadoId(params: { supabase: any }) {
  const sinAtenderRes = await params.supabase
    .from("pipeline_estados")
    .select("id")
    .eq("es_sin_atender", true)
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (sinAtenderRes.error) throw sinAtenderRes.error;

  if (sinAtenderRes.data?.id) return sinAtenderRes.data.id as string;

  const firstRes = await params.supabase
    .from("pipeline_estados")
    .select("id")
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstRes.error) throw firstRes.error;

  if (!firstRes.data?.id) {
    throw new Error("No hay pipeline_estados cargados para crear oportunidades.");
  }

  return firstRes.data.id as string;
}

async function findOrCreateConversacion(params: {
  supabase: any;
  contactoId: string;
  phone: string;
  contactName: string | null;
  lastMessage: string | null;
  phoneNumberId: string | null;
}) {
  const existingRes = await params.supabase
    .from("conversaciones")
    .select("id, unread_count, metadata, assigned_to")
    .eq("channel", "whatsapp")
    .eq("wa_phone", params.phone)
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingRes.error) throw existingRes.error;

  if (existingRes.data?.id) {
    const previousMetadata = readRecord(existingRes.data.metadata);
    const unreadCount = Number(existingRes.data.unread_count || 0) + 1;

    const updateRes = await params.supabase
      .from("conversaciones")
      .update({
        contacto_id: params.contactoId,
        wa_phone: params.phone,
        titulo: params.contactName || params.phone,
        subject: params.contactName || params.phone,
        inbox: existingRes.data.assigned_to ? "vendedor" : "general",
        status: "open",
        unread_count: unreadCount,
        last_message_at: getNowIso(),
        last_inbound_message_at: getNowIso(),
        last_message_preview: params.lastMessage,
        whatsapp_24h_expires_at: addHoursIso(24),
        window_expires_at: addHoursIso(24),
        archived_at: null,
        deleted_at: null,
        closed_at: null,
        estado_gestion: existingRes.data.assigned_to ? "en_gestion" : "sin_atender",
        estado_comercial: "nuevo",
        metadata: {
          ...previousMetadata,
          whatsapp_phone_number_id: params.phoneNumberId,
          last_webhook_update_at: getNowIso()
        },
        updated_at: getNowIso()
      })
      .eq("id", existingRes.data.id)
      .select("id")
      .single();

    if (updateRes.error) throw updateRes.error;

    return updateRes.data.id as string;
  }

  const insertRes = await params.supabase
    .from("conversaciones")
    .insert({
      contacto_id: params.contactoId,
      assigned_to: null,
      sucursal_id: null,
      inbox: "general",
      status: "open",
      priority: 0,
      unread_count: 1,
      last_message_at: getNowIso(),
      last_message_preview: params.lastMessage,
      window_expires_at: addHoursIso(24),
      wa_phone: params.phone,
      last_inbound_message_at: getNowIso(),
      last_outbound_message_at: null,
      whatsapp_24h_expires_at: addHoursIso(24),
      archived_at: null,
      deleted_at: null,
      closed_at: null,
      estado_gestion: "sin_atender",
      estado_comercial: "nuevo",
      categoria: null,
      etapa_comercial: null,
      subject: params.contactName || params.phone,
      titulo: params.contactName || params.phone,
      channel: "whatsapp",
      metadata: {
        source: "whatsapp_webhook",
        whatsapp_phone_number_id: params.phoneNumberId,
        created_from_webhook_at: getNowIso()
      },
      tomada_at: null,
      tomada_by: null
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;

  return insertRes.data.id as string;
}

async function ensureLeadOportunidad(params: {
  supabase: any;
  conversationId: string;
  lastText: string | null;
}) {
  const existingRes = await params.supabase
    .from("lead_oportunidades")
    .select("id")
    .eq("conversacion_id", params.conversationId)
    .limit(1)
    .maybeSingle();

  if (existingRes.error) throw existingRes.error;

  if (existingRes.data?.id) return existingRes.data.id as string;

  const estadoId = await getInitialPipelineEstadoId({ supabase: params.supabase });

  const datos: Record<string, unknown> = {};

  if (params.lastText) {
    datos.ultimo_mensaje = params.lastText;
  }

  const insertRes = await params.supabase
    .from("lead_oportunidades")
    .insert({
      conversacion_id: params.conversationId,
      estado_id: estadoId,
      score: 0,
      datos,
      assigned_to: null,
      cande_activa: true,
      transferida_at: null,
      last_score_at: getNowIso(),
      cande_handoff_requested_at: null
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;

  return insertRes.data.id as string;
}

/* =========================================================
   MENSAJES
========================================================= */

async function insertIncomingMessage(params: {
  supabase: any;
  token: string;
  apiVersion: string;
  conversationId: string;
  message: any;
  contactName: string | null;
  phone: string;
}) {
  const content = getMessageContent(params.message);
  const messageType = mapMessageType(params.message);
  const whatsappMessageId = params.message?.id || null;

  if (whatsappMessageId) {
    const existing = await params.supabase
      .from("mensajes")
      .select("id")
      .eq("wa_message_id", whatsappMessageId)
      .limit(1)
      .maybeSingle();

    if (existing.error) throw existing.error;

    if (existing.data?.id) {
      return existing.data.id as string;
    }
  }

  const downloadedMedia = await downloadIncomingMedia({
    supabase: params.supabase,
    token: params.token,
    apiVersion: params.apiVersion,
    conversationId: params.conversationId,
    message: params.message
  });

  const insertRes = await params.supabase
    .from("mensajes")
    .insert({
      conversacion_id: params.conversationId,
      direction: "in",
      type: messageType,
      text: content,
      media: downloadedMedia,
      reply_to_id: null,
      forwarded: Boolean(params.message?.context?.forwarded),
      status: "delivered",
      error: null,
      wa_message_id: whatsappMessageId,
      sender_profile_id: null,
      deleted_at: null,
      delivered_at: getNowIso(),
      read_at: null,
      wa_timestamp: params.message?.timestamp
        ? new Date(Number(params.message.timestamp) * 1000).toISOString()
        : getNowIso(),
      sender_kind: "humano"
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;

  return insertRes.data.id as string;
}

async function updateMessageStatus(params: {
  supabase: any;
  status: any;
}) {
  const whatsappMessageId = params.status?.id || null;
  const statusValue = cleanText(params.status?.status);

  if (!whatsappMessageId || !statusValue) return;

  const mappedStatus =
    statusValue === "delivered"
      ? "delivered"
      : statusValue === "read"
        ? "read"
        : statusValue === "sent"
          ? "sent"
          : statusValue === "failed"
            ? "failed"
            : null;

  if (!mappedStatus) return;

  const patch: Record<string, unknown> = {
    status: mappedStatus
  };

  if (mappedStatus === "delivered") patch.delivered_at = getNowIso();
  if (mappedStatus === "read") patch.read_at = getNowIso();

  if (mappedStatus === "failed") {
    patch.error =
      params.status?.errors?.[0]?.title ||
      params.status?.errors?.[0]?.message ||
      "WhatsApp informó error de entrega.";
  }

  const updateRes = await params.supabase
    .from("mensajes")
    .update(patch)
    .eq("wa_message_id", whatsappMessageId)
    .select("id");

  if (updateRes.error) {
    await saveWebhookDebug({
      supabase: params.supabase,
      eventType: "status_update_error",
      field: "mensajes",
      whatsappMessageId,
      status: mappedStatus,
      recipientId: params.status?.recipient_id || null,
      rawPayload: {
        error: updateRes.error,
        status: params.status
      }
    });
  }

  if (!updateRes.data || updateRes.data.length === 0) {
    await saveWebhookDebug({
      supabase: params.supabase,
      eventType: "status_no_match",
      field: "mensajes",
      whatsappMessageId,
      status: mappedStatus,
      recipientId: params.status?.recipient_id || null,
      rawPayload: params.status
    });
  }
}

/* =========================================================
   PROCESSORS
========================================================= */

async function processIncomingMessage(params: {
  supabase: any;
  token: string;
  apiVersion: string;
  message: any;
  contactName: string | null;
  phoneNumberId: string | null;
}) {
  const fromPhone = normalizePhoneDigits(params.message?.from);

  if (!fromPhone) {
    throw new Error("Mensaje inbound sin teléfono origen.");
  }

  const lastMessage = getMessageContent(params.message);

  const contactoId = await findOrCreateContactoWa({
    supabase: params.supabase,
    phone: fromPhone,
    contactName: params.contactName
  });

  const conversationId = await findOrCreateConversacion({
    supabase: params.supabase,
    contactoId,
    phone: fromPhone,
    contactName: params.contactName,
    lastMessage,
    phoneNumberId: params.phoneNumberId
  });

  const messageId = await insertIncomingMessage({
    supabase: params.supabase,
    token: params.token,
    apiVersion: params.apiVersion,
    conversationId,
    message: params.message,
    contactName: params.contactName,
    phone: fromPhone
  });

  const oportunidadId = await ensureLeadOportunidad({
    supabase: params.supabase,
    conversationId,
    lastText: lastMessage
  });

  await saveWebhookDebug({
    supabase: params.supabase,
    eventType: "inbound_saved",
    field: "messages",
    whatsappMessageId: params.message?.id || null,
    fromPhone,
    rawPayload: {
      conversation_id: conversationId,
      message_id: messageId,
      oportunidad_id: oportunidadId,
      message: params.message
    }
  });

  return {
    conversationId,
    messageId,
    oportunidadId
  };
}

/* =========================================================
   SERVER
========================================================= */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const mode = url.searchParams.get("hub.mode");
      const token = url.searchParams.get("hub.verify_token");
      const challenge = url.searchParams.get("hub.challenge");

      const verifyToken =
        Deno.env.get("WHATSAPP_VERIFY_TOKEN") ||
        Deno.env.get("META_VERIFY_TOKEN");

      if (mode === "subscribe" && token && token === verifyToken && challenge) {
        return textResponse(challenge, 200);
      }

      return textResponse("Forbidden", 403);
    }

    if (req.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
    }

    const supabase = getSupabaseAdmin();
    const meta = getMetaConfig();

    const payload = (await req.json()) as WhatsAppWebhookPayload;

    await saveWebhookDebug({
      supabase,
      eventType: "webhook_received",
      field: "raw",
      rawPayload: payload
    });

    const results: Array<Record<string, unknown>> = [];

    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const field = change.field || null;
        const phoneNumberId = value.metadata?.phone_number_id || null;

        const contactByWaId = new Map<string, string | null>();

        for (const contact of value.contacts || []) {
          if (contact.wa_id) {
            contactByWaId.set(contact.wa_id, contact.profile?.name || null);
          }
        }

        for (const status of value.statuses || []) {
          await updateMessageStatus({
            supabase,
            status
          });

          results.push({
            type: "status",
            id: status?.id || null,
            status: status?.status || null
          });
        }

        for (const message of value.messages || []) {
          const fromPhone = normalizePhoneDigits(message?.from);
          const contactName = contactByWaId.get(fromPhone) || null;

          try {
            const result = await processIncomingMessage({
              supabase,
              token: meta.token,
              apiVersion: meta.apiVersion,
              message,
              contactName,
              phoneNumberId
            });
            if (result?.conversationId || result?.conversation_id || result?.conversacion_id) {
  fireAndForgetCandeReply({
    conversationId:
      result.conversationId ||
      result.conversation_id ||
      result.conversacion_id,
    inboundMessageId:
      result.messageId ||
      result.message_id ||
      result.mensaje_id ||
      result.inboundMessageId ||
      null,
    oportunidadId:
      result.oportunidadId ||
      result.oportunidad_id ||
      null,
    source: "whatsapp-webhook"
  });
}

            results.push({
              type: "message",
              id: message?.id || null,
              ...result
            });
          } catch (error) {
            await saveWebhookDebug({
              supabase,
              eventType: "inbound_error",
              field,
              whatsappMessageId: message?.id || null,
              fromPhone,
              rawPayload: {
                error: error?.message || String(error),
                message
              }
            });

            results.push({
              type: "message_error",
              id: message?.id || null,
              error: error?.message || String(error)
            });

            
          }
        }
      }
    }

    return jsonResponse({
      ok: true,
      results
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error?.message || String(error)
      },
      500
    );
  }
});