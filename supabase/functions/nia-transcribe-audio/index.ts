// @ts-nocheck

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

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

function base64ToUint8Array(base64: string) {
  const cleanBase64 = cleanText(base64)
    .replace(/^data:audio\/[a-zA-Z0-9.+-]+;base64,/, "")
    .replace(/\s/g, "");

  if (!cleanBase64) {
    throw new Error("El audio llegó vacío.");
  }

  const binary = atob(cleanBase64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return jsonResponse({ ok: true });
  if (req.method !== "POST") return jsonResponse({ ok: false, error: "Method not allowed" }, 200);

  try {
    const payload = await req.json();

    const apiKey = Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return jsonResponse({
        ok: false,
        error: "Falta OPENAI_API_KEY en Supabase."
      });
    }

    const audioBase64 = cleanText(payload.audio_base64);
    const mimeType = cleanText(payload.audio_mime_type || payload.mime_type || "audio/webm");
    const filename = cleanText(payload.audio_filename || "nia-audio.webm");

    if (!audioBase64) {
      return jsonResponse({
        ok: false,
        error: "No llegó audio para transcribir."
      });
    }

    const bytes = base64ToUint8Array(audioBase64);

    if (bytes.length < 1000) {
      return jsonResponse({
        ok: false,
        error: "El audio es demasiado corto o llegó vacío."
      });
    }

    const blob = new Blob([bytes], {
      type: mimeType
    });

    const formData = new FormData();
    formData.append("file", blob, filename);

    // whisper-1 es el más estable para este caso.
    formData.append("model", Deno.env.get("NIA_TRANSCRIPTION_MODEL") || "whisper-1");
    formData.append("language", "es");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`
      },
      body: formData
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      return jsonResponse({
        ok: false,
        error:
          data?.error?.message ||
          `OpenAI rechazó la transcripción. HTTP ${response.status}`
      });
    }

    const text = cleanText(data.text);

    if (!text) {
      return jsonResponse({
        ok: false,
        error: "No pude transcribir el audio."
      });
    }

    return jsonResponse({
      ok: true,
      text,
      transcribed_text: text,
      mime_type: mimeType,
      filename,
      size: bytes.length
    });
  } catch (error) {
    return jsonResponse({
      ok: false,
      error: getErrorMessage(error)
    });
  }
});