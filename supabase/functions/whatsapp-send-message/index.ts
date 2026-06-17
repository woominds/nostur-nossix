// @ts-nocheck

/* =========================================================
   NOSSIX / NOSTUR — whatsapp-send-message
   Versión LiveNos nuevo — AUDIO DIRECTO WHATSAPP.

   Usa:
   - conversaciones
   - mensajes

   Soporta:
   - text
   - template
   - reaction
   - image
   - document
   - audio

   Cambio aplicado:
   - Mensajes, imágenes, documentos y reacciones quedan igual.
   - Audio vuelve al flujo anterior funcional:
     descarga media_url, sube directo a Meta y envía como type: audio.
   - Ya NO exige AUDIO_CONVERTER_URL ni AUDIO_CONVERTER_API_KEY.
========================================================= */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
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

function getMetaConfig() {
  const token =
    Deno.env.get("WHATSAPP_ACCESS_TOKEN") ||
    Deno.env.get("WHATSAPP_TOKEN");

  const phoneNumberId = Deno.env.get("WHATSAPP_PHONE_NUMBER_ID");
  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v25.0";

  if (!token) {
    throw new Error("Falta configurar WHATSAPP_ACCESS_TOKEN.");
  }

  if (!phoneNumberId) {
    throw new Error("Falta configurar WHATSAPP_PHONE_NUMBER_ID.");
  }

  return {
    token,
    phoneNumberId,
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

function normalizePhone(value: unknown): string {
  let phone = String(value || "").trim();

  phone = phone.replace(/[^\d+]/g, "");

  if (!phone) return "";

  if (phone.startsWith("+")) return phone.replace("+", "");
  if (phone.startsWith("549")) return phone;

  if (phone.startsWith("54")) {
    const rest = phone.slice(2);
    return rest.startsWith("9") ? phone : `549${rest}`;
  }

  if (phone.startsWith("9")) return `54${phone}`;

  return `549${phone}`;
}

function isUuid(value: unknown): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    cleanText(value)
  );
}

function getNowIso(): string {
  return new Date().toISOString();
}

function getErrorMessage(error: unknown): string {
  if (!error) return "Error desconocido.";

  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Error desconocido.");
  }

  return String(error);
}

function getMetaErrorMessage(data: any, fallback = "WhatsApp rechazó la operación."): string {
  return (
    cleanText(data?.error?.error_data?.details) ||
    cleanText(data?.error?.message) ||
    cleanText(data?.error?.error_user_msg) ||
    fallback
  );
}

function shouldShowAgentName(payload: any): boolean {
  return payload.show_agent_name === true || payload.show_agent_name === "true";
}

function getSafeFilename(value: unknown, fallback = "archivo"): string {
  const name = cleanText(value) || fallback;

  return name
    .replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function getFileExtensionFromMime(mimeType?: string | null): string {
  const mime = cleanText(mimeType).toLowerCase().split(";")[0].trim();

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
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "text/plain": "txt",

    "audio/mpeg": "mp3",
    "audio/mp3": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/amr": "amr",
    "audio/webm": "webm",

    "video/mp4": "mp4",
    "video/3gpp": "3gp"
  };

  return map[mime] || "bin";
}

function normalizeMimeForMeta(mimeType?: string | null): string {
  const original = cleanText(mimeType).toLowerCase();
  const base = original.split(";")[0].trim();

  if (!base) return "application/octet-stream";

  if (base === "audio/ogg" || base === "audio/opus") return "audio/ogg";
  if (base === "audio/mp4" || base === "audio/m4a" || base === "audio/x-m4a") return "audio/mp4";
  if (base === "audio/mpeg" || base === "audio/mp3") return "audio/mpeg";
  if (base === "audio/aac") return "audio/aac";
  if (base === "audio/amr") return "audio/amr";

  return base;
}

function isMediaMessageType(type: string): boolean {
  return type === "image" || type === "document" || type === "audio";
}

function getPreviewByMessageType(messageType: string, text: string): string {
  if (text) return text;

  if (messageType === "image") return "Imagen enviada";
  if (messageType === "audio") return "Audio enviado";
  if (messageType === "document") return "Archivo enviado";

  return "Mensaje enviado";
}

function getMessageText(payload: any, localMessage: any | null): string {
  return (
    cleanText(payload.text) ||
    cleanText(payload.content) ||
    cleanText(localMessage?.text)
  );
}

function getLocalMedia(localMessage: any | null): Record<string, unknown> {
  return readRecord(localMessage?.media);
}

function getMessageType(payload: any, localMessage: any | null): string {
  return (
    cleanText(payload.message_type) ||
    cleanText(payload.type) ||
    cleanText(localMessage?.type) ||
    "text"
  ).toLowerCase();
}

function getMediaUrl(payload: any, localMessage: any | null): string {
  const media = getLocalMedia(localMessage);

  return (
    cleanText(payload.media_url) ||
    cleanText(payload.url) ||
    cleanText(media.url) ||
    cleanText(media.media_url) ||
    cleanText(media.publicUrl) ||
    cleanText(media.public_url) ||
    cleanText(media.download_url)
  );
}

function getMediaMimeType(payload: any, localMessage: any | null): string {
  const media = getLocalMedia(localMessage);

  return (
    cleanText(payload.media_mime_type) ||
    cleanText(payload.mime_type) ||
    cleanText(payload.mimeType) ||
    cleanText(media.mime_type) ||
    cleanText(media.mimeType) ||
    cleanText(media.media_mime_type) ||
    cleanText(media.content_type)
  );
}

function getMediaFilename(payload: any, localMessage: any | null): string {
  const media = getLocalMedia(localMessage);

  return (
    cleanText(payload.media_filename) ||
    cleanText(payload.filename) ||
    cleanText(payload.name) ||
    cleanText(media.filename) ||
    cleanText(media.name) ||
    cleanText(media.media_filename) ||
    cleanText(media.original_name)
  );
}

/* =========================================================
   LOOKUPS
========================================================= */

async function getSenderDisplayName(params: {
  supabase: any;
  senderProfileId?: string | null;
}) {
  const senderProfileId = cleanText(params.senderProfileId);

  if (!senderProfileId || !isUuid(senderProfileId)) return "NOSSIX";

  const result = await params.supabase
    .from("profiles")
    .select("nombre, apellido, nombre_publico_whatsapp")
    .eq("id", senderProfileId)
    .maybeSingle();

  if (result.error || !result.data) return "NOSSIX";

  return (
    cleanText(result.data.nombre_publico_whatsapp) ||
    `${cleanText(result.data.nombre)} ${cleanText(result.data.apellido)}`.trim() ||
    "NOSSIX"
  );
}

async function getLocalMessage(params: {
  supabase: any;
  messageId?: string | null;
}) {
  if (!params.messageId || !isUuid(params.messageId)) return null;

  const result = await params.supabase
    .from("mensajes")
    .select("*")
    .eq("id", params.messageId)
    .maybeSingle();

  if (result.error) throw result.error;

  return result.data || null;
}

async function getConversation(params: {
  supabase: any;
  conversationId?: string | null;
}) {
  if (!params.conversationId || !isUuid(params.conversationId)) return null;

  const result = await params.supabase
    .from("conversaciones")
    .select("*")
    .eq("id", params.conversationId)
    .maybeSingle();

  if (result.error) throw result.error;

  return result.data || null;
}

function getToPhone(payload: any, conversation: any | null): string {
  const phone =
    cleanText(payload.to) ||
    cleanText(payload.phone) ||
    cleanText(payload.wa_phone) ||
    cleanText(conversation?.wa_phone);

  return normalizePhone(phone);
}

/* =========================================================
   META MEDIA UPLOAD
========================================================= */

async function uploadBlobToMeta(params: {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  blob: Blob;
  mimeType: string;
  filename: string;
}) {
  const contentType = normalizeMimeForMeta(params.mimeType);
  const extension = getFileExtensionFromMime(contentType);
  const filename = getSafeFilename(params.filename, `archivo.${extension}`);

  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("file", new File([params.blob], filename, { type: contentType }));

  const url = `https://graph.facebook.com/${params.apiVersion}/${params.phoneNumberId}/media`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`
    },
    body: formData
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return {
      ok: false,
      error: getMetaErrorMessage(data, "WhatsApp rechazó la carga del archivo."),
      data
    };
  }

  return {
    ok: true,
    mediaId: data.id as string,
    data,
    uploadedMimeType: contentType,
    filename
  };
}

async function uploadMediaUrlToMeta(params: {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  mediaUrl: string;
  mimeType: string | null;
  filename: string | null;
}) {
  const mediaFetch = await fetch(params.mediaUrl);

  if (!mediaFetch.ok) {
    throw new Error(`No se pudo descargar el archivo para enviarlo a WhatsApp. HTTP ${mediaFetch.status}`);
  }

  const blob = await mediaFetch.blob();

  const fetchedContentType =
    cleanText(mediaFetch.headers.get("content-type")) ||
    blob.type ||
    "application/octet-stream";

  const contentType = normalizeMimeForMeta(params.mimeType || fetchedContentType);
  const extension = getFileExtensionFromMime(contentType);
  const filename = getSafeFilename(params.filename, `archivo.${extension}`);

  return uploadBlobToMeta({
    token: params.token,
    phoneNumberId: params.phoneNumberId,
    apiVersion: params.apiVersion,
    blob,
    mimeType: contentType,
    filename
  });
}

/* =========================================================
   META MESSAGE BUILDERS
========================================================= */

function buildTextMessage(params: {
  to: string;
  text: string;
  replyToWhatsappMessageId?: string | null;
}) {
  const context = cleanText(params.replyToWhatsappMessageId)
    ? {
        context: {
          message_id: cleanText(params.replyToWhatsappMessageId)
        }
      }
    : {};

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "text",
    ...context,
    text: {
      preview_url: true,
      body: params.text
    }
  };
}

function buildTemplateMessage(params: {
  to: string;
  templateName: string;
  language: string;
  variables: unknown[];
}) {
  const components =
    params.variables.length > 0
      ? [
          {
            type: "body",
            parameters: params.variables.map((value) => ({
              type: "text",
              text: String(value ?? "")
            }))
          }
        ]
      : undefined;

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "template",
    template: {
      name: params.templateName,
      language: {
        code: params.language
      },
      components
    }
  };
}

function buildReactionMessage(params: {
  to: string;
  reactedToWhatsappMessageId: string;
  emoji: string;
}) {
  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "reaction",
    reaction: {
      message_id: params.reactedToWhatsappMessageId,
      emoji: params.emoji
    }
  };
}

function buildImageMessage(params: {
  to: string;
  mediaId: string;
  caption?: string | null;
  replyToWhatsappMessageId?: string | null;
}) {
  const context = cleanText(params.replyToWhatsappMessageId)
    ? {
        context: {
          message_id: cleanText(params.replyToWhatsappMessageId)
        }
      }
    : {};

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "image",
    ...context,
    image: {
      id: params.mediaId,
      caption: cleanText(params.caption) || undefined
    }
  };
}

function buildDocumentMessage(params: {
  to: string;
  mediaId: string;
  filename: string;
  caption?: string | null;
  replyToWhatsappMessageId?: string | null;
}) {
  const context = cleanText(params.replyToWhatsappMessageId)
    ? {
        context: {
          message_id: cleanText(params.replyToWhatsappMessageId)
        }
      }
    : {};

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "document",
    ...context,
    document: {
      id: params.mediaId,
      filename: getSafeFilename(params.filename, "archivo"),
      caption: cleanText(params.caption) || undefined
    }
  };
}

function buildAudioMessage(params: {
  to: string;
  mediaId: string;
  replyToWhatsappMessageId?: string | null;
}) {
  const context = cleanText(params.replyToWhatsappMessageId)
    ? {
        context: {
          message_id: cleanText(params.replyToWhatsappMessageId)
        }
      }
    : {};

  return {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: params.to,
    type: "audio",
    ...context,
    audio: {
      id: params.mediaId
    }
  };
}

/* =========================================================
   META MESSAGE BUILD
========================================================= */

async function buildMetaMessage(params: {
  payload: any;
  localMessage: any | null;
  to: string;
  text: string;
  token: string;
  phoneNumberId: string;
  apiVersion: string;
}) {
  const reactionEmoji = cleanText(params.payload.reaction_emoji || params.payload.emoji);

  const reactionToWhatsappMessageId = cleanText(
    params.payload.reaction_to_whatsapp_message_id ||
      params.payload.react_to_whatsapp_message_id ||
      params.payload.reply_to_whatsapp_message_id
  );

  if (reactionEmoji && reactionToWhatsappMessageId) {
    return {
      ok: true,
      metaMessage: buildReactionMessage({
        to: params.to,
        reactedToWhatsappMessageId: reactionToWhatsappMessageId,
        emoji: reactionEmoji
      }),
      uploadedMediaId: null,
      uploadResponse: null,
      uploadedMimeType: null,
      mediaFilename: null,
      convertedAudio: false,
      conversionInfo: null
    };
  }

  const templateName = cleanText(params.payload.template_name);

  if (templateName) {
    return {
      ok: true,
      metaMessage: buildTemplateMessage({
        to: params.to,
        templateName,
        language: cleanText(params.payload.template_language) || "es_AR",
        variables: Array.isArray(params.payload.template_variables)
          ? params.payload.template_variables
          : []
      }),
      uploadedMediaId: null,
      uploadResponse: null,
      uploadedMimeType: null,
      mediaFilename: null,
      convertedAudio: false,
      conversionInfo: null
    };
  }

  const messageType = getMessageType(params.payload, params.localMessage);
  const mediaUrl = getMediaUrl(params.payload, params.localMessage);
  const mediaMimeType = getMediaMimeType(params.payload, params.localMessage);
  const mediaFilename = getMediaFilename(params.payload, params.localMessage);

  const replyToWhatsappMessageId =
    params.payload.reply_to_whatsapp_message_id ||
    params.payload.context_message_id ||
    null;

  if (isMediaMessageType(messageType)) {
    if (!mediaUrl) {
      throw new Error("El mensaje con archivo necesita media_url pública.");
    }

    /*
      AUDIO:
      Volvemos al comportamiento del backup funcional.
      No usamos conversor obligatorio.
      Se sube directo a Meta y se envía como WhatsApp type: audio.
    */
    if (messageType === "audio") {
      const upload = await uploadMediaUrlToMeta({
        token: params.token,
        phoneNumberId: params.phoneNumberId,
        apiVersion: params.apiVersion,
        mediaUrl,
        mimeType: mediaMimeType || null,
        filename: mediaFilename || "audio"
      });

      if (!upload.ok) {
        return {
          ok: false,
          error: upload.error,
          metaMessage: null,
          uploadedMediaId: null,
          uploadResponse: upload.data,
          uploadedMimeType: null,
          mediaFilename,
          convertedAudio: false,
          conversionInfo: null
        };
      }

      return {
        ok: true,
        metaMessage: buildAudioMessage({
          to: params.to,
          mediaId: upload.mediaId,
          replyToWhatsappMessageId
        }),
        uploadedMediaId: upload.mediaId,
        uploadResponse: upload.data,
        uploadedMimeType: upload.uploadedMimeType,
        mediaFilename: mediaFilename || upload.filename,
        convertedAudio: false,
        conversionInfo: null
      };
    }

    const upload = await uploadMediaUrlToMeta({
      token: params.token,
      phoneNumberId: params.phoneNumberId,
      apiVersion: params.apiVersion,
      mediaUrl,
      mimeType: mediaMimeType || null,
      filename: mediaFilename || null
    });

    if (!upload.ok) {
      return {
        ok: false,
        error: upload.error,
        metaMessage: null,
        uploadedMediaId: null,
        uploadResponse: upload.data,
        uploadedMimeType: null,
        mediaFilename,
        convertedAudio: false,
        conversionInfo: null
      };
    }

    if (messageType === "image") {
      return {
        ok: true,
        metaMessage: buildImageMessage({
          to: params.to,
          mediaId: upload.mediaId,
          caption: params.text,
          replyToWhatsappMessageId
        }),
        uploadedMediaId: upload.mediaId,
        uploadResponse: upload.data,
        uploadedMimeType: upload.uploadedMimeType,
        mediaFilename: mediaFilename || upload.filename,
        convertedAudio: false,
        conversionInfo: null
      };
    }

    return {
      ok: true,
      metaMessage: buildDocumentMessage({
        to: params.to,
        mediaId: upload.mediaId,
        filename: mediaFilename || upload.filename || "archivo",
        caption: params.text,
        replyToWhatsappMessageId
      }),
      uploadedMediaId: upload.mediaId,
      uploadResponse: upload.data,
      uploadedMimeType: upload.uploadedMimeType,
      mediaFilename: mediaFilename || upload.filename,
      convertedAudio: false,
      conversionInfo: null
    };
  }

  return {
    ok: true,
    metaMessage: buildTextMessage({
      to: params.to,
      text: params.text,
      replyToWhatsappMessageId
    }),
    uploadedMediaId: null,
    uploadResponse: null,
    uploadedMimeType: null,
    mediaFilename: null,
    convertedAudio: false,
    conversionInfo: null
  };
}

/* =========================================================
   DB UPDATES
========================================================= */

async function updateLocalMessage(params: {
  supabase: any;
  messageId?: string | null;
  status: "pending" | "sent" | "delivered" | "read" | "failed";
  whatsappMessageId?: string | null;
  error?: string | null;
  mediaWhatsappId?: string | null;
  mediaPatch?: Record<string, unknown> | null;
}) {
  if (!params.messageId || !isUuid(params.messageId)) return;

  const patch: Record<string, unknown> = {
    status: params.status,
    error: params.error || null
  };

  if (params.whatsappMessageId) {
    patch.wa_message_id = params.whatsappMessageId;
  }

  if (params.status === "sent") {
    patch.delivered_at = null;
    patch.read_at = null;
  }

  if (params.status === "delivered") {
    patch.delivered_at = getNowIso();
  }

  if (params.status === "read") {
    patch.read_at = getNowIso();
  }

  if (params.mediaWhatsappId || params.mediaPatch) {
    const currentRes = await params.supabase
      .from("mensajes")
      .select("media")
      .eq("id", params.messageId)
      .maybeSingle();

    if (!currentRes.error) {
      const currentMedia = readRecord(currentRes.data?.media);

      patch.media = {
        ...currentMedia,
        ...(params.mediaWhatsappId ? { media_whatsapp_id: params.mediaWhatsappId } : {}),
        ...(params.mediaPatch || {})
      };
    }
  }

  const updateRes = await params.supabase
    .from("mensajes")
    .update(patch)
    .eq("id", params.messageId)
    .select("id, status, wa_message_id")
    .maybeSingle();

  if (updateRes.error) {
    throw new Error(`No se pudo actualizar mensajes: ${updateRes.error.message}`);
  }
}

async function touchConversation(params: {
  supabase: any;
  conversationId?: string | null;
  lastMessage: string;
}) {
  if (!params.conversationId || !isUuid(params.conversationId)) return;

  const updateRes = await params.supabase
    .from("conversaciones")
    .update({
      last_message_at: getNowIso(),
      last_outbound_message_at: getNowIso(),
      last_message_preview: params.lastMessage,
      estado_gestion: "en_gestion",
      updated_at: getNowIso()
    })
    .eq("id", params.conversationId);

  if (updateRes.error) {
    throw new Error(`No se pudo actualizar conversaciones: ${updateRes.error.message}`);
  }
}

async function insertLocalMessageIfNeeded(params: {
  supabase: any;
  conversationId?: string | null;
  text: string;
  messageType: string;
  media: Record<string, unknown> | null;
  senderProfileId?: string | null;
}) {
  if (!params.conversationId || !isUuid(params.conversationId)) return null;

  const insertRes = await params.supabase
    .from("mensajes")
    .insert({
      conversacion_id: params.conversationId,
      direction: "out",
      type: params.messageType || "text",
      text: params.text || null,
      media: params.media || null,
      reply_to_id: null,
      forwarded: false,
      status: "pending",
      error: null,
      wa_message_id: null,
      sender_profile_id: params.senderProfileId || null,
      deleted_at: null,
      delivered_at: null,
      read_at: null,
      wa_timestamp: getNowIso(),
      sender_kind: "humano"
    })
    .select("id")
    .single();

  if (insertRes.error) throw insertRes.error;

  return insertRes.data.id as string;
}

/* =========================================================
   SEND TO META
========================================================= */

async function sendToMeta(params: {
  token: string;
  phoneNumberId: string;
  apiVersion: string;
  metaMessage: Record<string, unknown>;
}) {
  const url = `https://graph.facebook.com/${params.apiVersion}/${params.phoneNumberId}/messages`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${params.token}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params.metaMessage)
  });

  const data = await response.json();

  if (!response.ok || data.error) {
    return {
      ok: false,
      error: getMetaErrorMessage(data, `WhatsApp rechazó el envío. HTTP ${response.status}`),
      data,
      status: response.status
    };
  }

  return {
    ok: true,
    data,
    whatsappMessageId: data?.messages?.[0]?.id || null
  };
}

/* =========================================================
   SERVER
========================================================= */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = getSupabaseAdmin();
    const meta = getMetaConfig();
    const payload = await req.json();

    const localMessageId =
      cleanText(payload.message_id) ||
      cleanText(payload.local_message_id) ||
      cleanText(payload.mensaje_id) ||
      null;

    const conversationId =
      cleanText(payload.conversacion_id) ||
      cleanText(payload.conversation_id) ||
      null;

    const localMessage = await getLocalMessage({
      supabase,
      messageId: localMessageId
    });

    const finalConversationId =
      conversationId ||
      cleanText(localMessage?.conversacion_id) ||
      null;

    const conversation = await getConversation({
      supabase,
      conversationId: finalConversationId
    });

    const to = getToPhone(payload, conversation);

    if (!to) {
      throw new Error("No se pudo determinar el teléfono destino.");
    }

    const templateName = cleanText(payload.template_name);
    const reactionEmoji = cleanText(payload.reaction_emoji || payload.emoji);
    const isReaction = Boolean(reactionEmoji);
    const messageType = getMessageType(payload, localMessage);

    const mediaUrl = getMediaUrl(payload, localMessage);
    const mediaMimeType = getMediaMimeType(payload, localMessage);
    const mediaFilename = getMediaFilename(payload, localMessage);

    let text = getMessageText(payload, localMessage);

    if (!text && templateName) {
      text = `[Plantilla: ${templateName}]`;
    }

    if (!text && isReaction) {
      text = `[Reacción: ${reactionEmoji}]`;
    }

    if (!text && isMediaMessageType(messageType)) {
      text = "";
    }

    if (!text && !templateName && !isReaction && !isMediaMessageType(messageType)) {
      throw new Error("El mensaje está vacío.");
    }

    const senderProfileId =
      cleanText(payload.sender_profile_id) ||
      cleanText(payload.sender_id) ||
      cleanText(localMessage?.sender_profile_id) ||
      null;

    if (text && shouldShowAgentName(payload) && !templateName && !isReaction) {
      const senderName = await getSenderDisplayName({
        supabase,
        senderProfileId
      });

      text = `${senderName}:\n${text}`;
    }

    const localMedia = isMediaMessageType(messageType)
      ? {
          url: mediaUrl,
          media_url: mediaUrl,
          filename: mediaFilename,
          media_filename: mediaFilename,
          mime_type: mediaMimeType,
          media_mime_type: mediaMimeType
        }
      : null;

    const effectiveMessageId =
      localMessageId ||
      (isReaction
        ? null
        : await insertLocalMessageIfNeeded({
            supabase,
            conversationId: finalConversationId,
            text,
            messageType,
            media: localMedia,
            senderProfileId
          }));

    const buildResult = await buildMetaMessage({
      payload,
      localMessage,
      to,
      text,
      token: meta.token,
      phoneNumberId: meta.phoneNumberId,
      apiVersion: meta.apiVersion
    });

    if (!buildResult.ok) {
      await updateLocalMessage({
        supabase,
        messageId: effectiveMessageId,
        status: "failed",
        error: buildResult.error,
        mediaPatch: {
          meta_upload: buildResult.uploadResponse || null,
          converted_audio: buildResult.convertedAudio || false,
          conversion_info: buildResult.conversionInfo || null
        }
      });

      return jsonResponse(
        {
          ok: false,
          error: buildResult.error,
          meta: buildResult.uploadResponse,
          message_id: effectiveMessageId
        },
        400
      );
    }

    const sendResult = await sendToMeta({
      token: meta.token,
      phoneNumberId: meta.phoneNumberId,
      apiVersion: meta.apiVersion,
      metaMessage: buildResult.metaMessage
    });

    if (!sendResult.ok) {
      await updateLocalMessage({
        supabase,
        messageId: effectiveMessageId,
        status: "failed",
        error: sendResult.error,
        mediaWhatsappId: buildResult.uploadedMediaId,
        mediaPatch: {
          meta_error: sendResult.data,
          meta_upload: buildResult.uploadResponse,
          uploaded_mime_type: buildResult.uploadedMimeType,
          converted_audio: buildResult.convertedAudio,
          conversion_info: buildResult.conversionInfo
        }
      });

      return jsonResponse(
        {
          ok: false,
          error: sendResult.error,
          meta: sendResult.data,
          message_id: effectiveMessageId,
          media_upload: buildResult.uploadResponse
        },
        400
      );
    }

    await updateLocalMessage({
      supabase,
      messageId: effectiveMessageId,
      status: "sent",
      whatsappMessageId: sendResult.whatsappMessageId,
      mediaWhatsappId: buildResult.uploadedMediaId,
      error: null,
      mediaPatch: {
        meta_upload: buildResult.uploadResponse,
        uploaded_mime_type: buildResult.uploadedMimeType,
        converted_audio: buildResult.convertedAudio,
        conversion_info: buildResult.conversionInfo,
        sent_as_document_fallback: false
      }
    });

    if (!isReaction) {
      await touchConversation({
        supabase,
        conversationId: finalConversationId,
        lastMessage: getPreviewByMessageType(messageType, text)
      });
    }

    return jsonResponse({
      ok: true,
      message_id: effectiveMessageId,
      whatsapp_message_id: sendResult.whatsappMessageId,
      media_whatsapp_id: buildResult.uploadedMediaId,
      converted_audio: buildResult.convertedAudio,
      sent_as_document_fallback: false,
      meta: sendResult.data,
      media_upload: buildResult.uploadResponse
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: getErrorMessage(error)
      },
      500
    );
  }
});