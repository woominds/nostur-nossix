// @ts-nocheck

/* =========================================================
   NOSSIX / NOSTUR — whatsapp-transcribe-audio

   Recibe:
   - mensaje_id / message_id
   - conversacion_id / conversation_id
   - media_path
   - media_url
   - mime_type

   Hace:
   - busca el audio entrante de WhatsApp
   - lo manda a OpenAI para transcribir
   - actualiza public.mensajes
   - actualiza public.conversaciones.last_message_preview
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

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function getErrorMessage(error: unknown): string {
  if (!error) return "Error desconocido.";

  if (typeof error === "object" && "message" in error) {
    return String((error as { message?: unknown }).message || "Error desconocido.");
  }

  return String(error);
}

function getNowIso(): string {
  return new Date().toISOString();
}

function safeFileName(value: unknown, fallback = "audio.ogg"): string {
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
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/aac": "aac",
    "audio/ogg": "ogg",
    "audio/opus": "opus",
    "audio/webm": "webm",
    "audio/wav": "wav",
    "audio/x-wav": "wav",
    "audio/amr": "amr"
  };

  return map[mime] || "ogg";
}

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

async function saveDebug(params: {
  supabase: any;
  eventType: string;
  mensajeId?: string | null;
  conversacionId?: string | null;
  rawPayload: any;
}) {
  try {
    await params.supabase.from("whatsapp_webhook_debug").insert({
      event_type: params.eventType,
      field: "whatsapp-transcribe-audio",
      whatsapp_message_id: params.mensajeId || null,
      raw_payload: {
        mensaje_id: params.mensajeId || null,
        conversacion_id: params.conversacionId || null,
        ...params.rawPayload
      }
    });
  } catch {
    // Debug nunca debe romper la transcripción.
  }
}

async function updateMessageError(params: {
  supabase: any;
  mensajeId: string;
  error: string;
}) {
  await params.supabase
    .from("mensajes")
    .update({
      transcription_status: "error",
      transcription_error: params.error,
      transcription_at: getNowIso()
    })
    .eq("id", params.mensajeId);
}

async function getAudioBlobFromStorageOrUrl(params: {
  supabase: any;
  mediaPath?: string | null;
  mediaUrl?: string | null;
}) {
  const mediaPath = cleanText(params.mediaPath);
  const mediaUrl = cleanText(params.mediaUrl);

  if (mediaPath) {
    const downloadRes = await params.supabase.storage
      .from("comunicaciones-media")
      .download(mediaPath);

    if (downloadRes.error) {
      throw new Error(
        downloadRes.error.message || "No se pudo descargar el audio desde Storage."
      );
    }

    return downloadRes.data as Blob;
  }

  if (mediaUrl) {
    const audioRes = await fetch(mediaUrl);

    if (!audioRes.ok) {
      throw new Error(`No se pudo leer el audio desde URL pública. HTTP ${audioRes.status}`);
    }

    return await audioRes.blob();
  }

  throw new Error("No llegó media_path ni media_url para transcribir.");
}

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });

  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 200);
  }

  const supabase = getSupabaseAdmin();

  let mensajeId = "";
  let conversacionId = "";

  try {
    const payload = await req.json();

    mensajeId = cleanText(payload.mensaje_id || payload.message_id);
    conversacionId = cleanText(payload.conversacion_id || payload.conversation_id);

    const mediaPath = cleanText(payload.media_path);
    const mediaUrl = cleanText(payload.media_url);
    const mimeType = cleanText(payload.mime_type || "audio/ogg") || "audio/ogg";

    if (!mensajeId) {
      return jsonResponse({
        ok: false,
        error: "Falta mensaje_id."
      });
    }

    if (!conversacionId) {
      return jsonResponse({
        ok: false,
        error: "Falta conversacion_id."
      });
    }

    const openAiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openAiKey) {
      await updateMessageError({
        supabase,
        mensajeId,
        error: "Falta OPENAI_API_KEY en Supabase."
      });

      return jsonResponse({
        ok: false,
        error: "Falta OPENAI_API_KEY en Supabase."
      });
    }

    await supabase
      .from("mensajes")
      .update({
        transcription_status: "pending",
        transcription_error: null,
        transcription_at: null
      })
      .eq("id", mensajeId);

    await saveDebug({
      supabase,
      eventType: "audio_transcription_started",
      mensajeId,
      conversacionId,
      rawPayload: {
        media_path: mediaPath || null,
        media_url: mediaUrl || null,
        mime_type: mimeType || null
      }
    });

    const audioBlob = await getAudioBlobFromStorageOrUrl({
      supabase,
      mediaPath,
      mediaUrl
    });

    if (!audioBlob || audioBlob.size < 1000) {
      throw new Error("El audio es demasiado corto o llegó vacío.");
    }

    const extension = getExtensionFromMime(mimeType);
    const filename = safeFileName(payload.filename, `whatsapp-audio.${extension}`);

    const normalizedBlob = new Blob([audioBlob], {
      type: mimeType
    });

    const formData = new FormData();
    formData.append("file", normalizedBlob, filename);
    formData.append(
      "model",
      Deno.env.get("WHATSAPP_TRANSCRIPTION_MODEL") ||
        Deno.env.get("NIA_TRANSCRIPTION_MODEL") ||
        "whisper-1"
    );
    formData.append("language", "es");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openAiKey}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      throw new Error(
        data?.error?.message ||
          `OpenAI rechazó la transcripción. HTTP ${response.status}`
      );
    }

    const transcriptionText = cleanText(data.text);

    if (!transcriptionText) {
      throw new Error("OpenAI no devolvió texto transcripto.");
    }

    await supabase
      .from("mensajes")
      .update({
        text: transcriptionText,
        transcription_text: transcriptionText,
        transcription_status: "done",
        transcription_error: null,
        transcription_at: getNowIso()
      })
      .eq("id", mensajeId);

    await supabase
      .from("conversaciones")
      .update({
        last_message_preview: transcriptionText,
        updated_at: getNowIso()
      })
      .eq("id", conversacionId);

    await saveDebug({
      supabase,
      eventType: "audio_transcription_done",
      mensajeId,
      conversacionId,
      rawPayload: {
        transcription_text: transcriptionText
      }
    });

    return jsonResponse({
      ok: true,
      mensaje_id: mensajeId,
      conversacion_id: conversacionId,
      transcription_text: transcriptionText,
      text: transcriptionText
    });
  } catch (error) {
    const message = getErrorMessage(error);

    if (mensajeId) {
      await updateMessageError({
        supabase,
        mensajeId,
        error: message
      });
    }

    await saveDebug({
      supabase,
      eventType: "audio_transcription_error",
      mensajeId,
      conversacionId,
      rawPayload: {
        error: message
      }
    });

    return jsonResponse({
      ok: false,
      mensaje_id: mensajeId || null,
      conversacion_id: conversacionId || null,
      error: message
    });
  }
});