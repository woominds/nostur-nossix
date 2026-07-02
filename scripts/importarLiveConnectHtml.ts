// src/scripts/importarLiveConnectHtml.ts

import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { parseLiveConnectHtml } from "../src/lib/liveConnectHtmlParser";


type LiveConversationRow = {
  id: string;
  live_conversation_id: string;
  url_conversacion: string | null;
  html_url_original: string | null;
  html_importado?: boolean | null;
  html_raw?: string | null;
  metadata?: Record<string, any> | null;
};

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const index = line.indexOf("=");
    if (index <= 0) continue;

    const key = line.slice(0, index).trim();
    const value = line
      .slice(index + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function getArg(name: string, fallback: string) {
  const prefix = `--${name}=`;
  const found = process.argv.find((arg) => arg.startsWith(prefix));

  if (!found) return fallback;

  return found.slice(prefix.length);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Error desconocido");
}

function normalizeMessageTypeForDb(
  value: string | null | undefined
): "text" | "image" | "audio" | "video" | "document" | "system" | "unknown" {
  const normalized = String(value || "text").toLowerCase().trim();

  if (normalized === "image") return "image";
  if (normalized === "audio") return "audio";
  if (normalized === "video") return "video";
  if (normalized === "system") return "system";
  if (normalized === "unknown") return "unknown";

  if (
    normalized === "file" ||
    normalized === "document" ||
    normalized === "pdf" ||
    normalized === "application/pdf"
  ) {
    return "document";
  }

  return "text";
}

async function fetchHtml(url: string): Promise<string> {


  const response = await fetch(url, {
    method: "GET",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X) AppleWebKit/537.36 NOSTUR-LiveConnect-Importer",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

async function main() {
  const root = process.cwd();

loadEnvFile(path.join(root, ".env.secrets.nossix"));
loadEnvFile(path.join(root, ".env.local"));
loadEnvFile(path.join(root, ".env.secrets"));
loadEnvFile(path.join(root, ".env"));

const supabaseUrl =
  process.env.NOSTUR_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  process.env.SUPABASE_URL;

const supabaseKey =
  process.env.NOSTUR_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

const supabaseKeySource = process.env.NOSTUR_SERVICE_ROLE_KEY
  ? "NOSTUR_SERVICE_ROLE_KEY"
  : process.env.SUPABASE_SERVICE_ROLE_KEY
    ? "SUPABASE_SERVICE_ROLE_KEY"
    : process.env.SUPABASE_SECRET_KEY
      ? "SUPABASE_SECRET_KEY"
      : null;

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    "Faltan variables de Supabase. Necesito NOSTUR_SUPABASE_URL/VITE_SUPABASE_URL y NOSTUR_SERVICE_ROLE_KEY/SUPABASE_SERVICE_ROLE_KEY. No uses anon key para este importador."
  );
}

  const limit = Number(getArg("limit", "50"));
  const delayMs = Number(getArg("delay", "250"));
  const onlyId = getArg("only", "");

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });

 console.log(`Supabase URL usada: ${supabaseUrl}`);
console.log(`Supabase key usada: ${supabaseKeySource}`);

const { count: diagTotal } = await supabase
  .from("comunicaciones_live_conversaciones")
  .select("id", { count: "exact", head: true });

const { count: diagConUrl } = await supabase
  .from("comunicaciones_live_conversaciones")
  .select("id", { count: "exact", head: true })
  .not("url_conversacion", "is", null)
  .neq("url_conversacion", "");

const { count: diagHtmlRawNull } = await supabase
  .from("comunicaciones_live_conversaciones")
  .select("id", { count: "exact", head: true })
  .is("html_raw", null);

const { count: diagPendientes } = await supabase
  .from("comunicaciones_live_conversaciones")
  .select("id", { count: "exact", head: true })
  .not("url_conversacion", "is", null)
  .neq("url_conversacion", "")
  .is("html_raw", null);

console.log(`Diag total conversaciones: ${diagTotal ?? 0}`);
console.log(`Diag con URL: ${diagConUrl ?? 0}`);
console.log(`Diag html_raw null: ${diagHtmlRawNull ?? 0}`);
console.log(`Diag pendientes: ${diagPendientes ?? 0}`);

let data: LiveConversationRow[] | null = null;
let error: { message: string } | null = null;

if (onlyId) {
const response = await supabase
  .from("comunicaciones_live_conversaciones")
  .select("id,live_conversation_id,url_conversacion,html_url_original,html_importado,html_raw,metadata")
  .not("url_conversacion", "is", null)
  .neq("url_conversacion", "")
  .is("html_raw", null)
  .order("live_fecha_creado", { ascending: true })
  .limit(limit * 3);

data = response.data as LiveConversationRow[] | null;
error = response.error;
} else {
  const response = await supabase
    .from("comunicaciones_live_conversaciones")
    .select("id,live_conversation_id,url_conversacion,html_url_original,html_importado,html_raw")
    .not("url_conversacion", "is", null)
    .neq("url_conversacion", "")
    .is("html_raw", null)
    .order("live_fecha_creado", { ascending: true })
    .limit(limit);

  data = response.data as LiveConversationRow[] | null;
  error = response.error;
}

if (error) {
  throw new Error(error.message);
}



  const rows = (data || []) as LiveConversationRow[];

  if (rows.length === 0) {
    console.log("No hay conversaciones pendientes para importar HTML.");
    return;
  }

  console.log(`Conversaciones a procesar: ${rows.length}`);

  let ok = 0;
  let failed = 0;

  for (const [index, row] of rows.entries()) {
    const url = row.url_conversacion || row.html_url_original;

    if (!url) {
      console.log(`[${index + 1}/${rows.length}] Sin URL: ${row.live_conversation_id}`);
      failed += 1;
      continue;
    }

    try {
      console.log(`[${index + 1}/${rows.length}] Descargando ${row.live_conversation_id}`);

      const html = await fetchHtml(url);
      const parsed = parseLiveConnectHtml(html);

      const mensajes = parsed.messages.map((message) => ({
        live_conversation_id: row.live_conversation_id,
        live_conversacion_id: row.id,
        orden: message.orden,
        fecha_mensaje: message.fecha_mensaje,
        hora_texto: message.hora_texto,
        direction: message.direction,
        sender_name: message.sender_name,
        sender_role: message.sender_role,
        content: message.content,
        message_type: normalizeMessageTypeForDb(message.message_type),
        media_url: message.media_url,
        media_filename: message.media_filename,
        media_mime_type: message.media_mime_type,
        raw_html: message.raw_html,
        metadata: message.metadata || {}
      }));

      const { error: deleteError } = await supabase
        .from("comunicaciones_live_mensajes")
        .delete()
        .eq("live_conversation_id", row.live_conversation_id);

      if (deleteError) {
        throw new Error(`No pude limpiar mensajes previos: ${deleteError.message}`);
      }

      if (mensajes.length > 0) {
        const { error: insertError } = await supabase
          .from("comunicaciones_live_mensajes")
          .insert(mensajes);

        if (insertError) {
          throw new Error(`No pude insertar mensajes: ${insertError.message}`);
        }
      }

      const { error: updateError } = await supabase
        .from("comunicaciones_live_conversaciones")
        .update({
          html_importado: true,
          html_url_original: url,
          html_raw: html,
          mensajes_parseados: mensajes.length,
          metadata: {
            parser: parsed.metadata,
            imported_at: new Date().toISOString(),
            html_length: html.length
          }
        })
        .eq("id", row.id);

      if (updateError) {
        throw new Error(`No pude actualizar conversación: ${updateError.message}`);
      }

      ok += 1;

      console.log(
        `OK ${row.live_conversation_id} · mensajes: ${mensajes.length} · html: ${html.length} chars`
      );
    } catch (error) {
      failed += 1;

      console.error(`ERROR ${row.live_conversation_id}: ${normalizeError(error)}`);

      await supabase
        .from("comunicaciones_live_conversaciones")
        .update({
          metadata: {
            html_import_error: normalizeError(error),
            html_import_error_at: new Date().toISOString()
          }
        })
        .eq("id", row.id);
    }

    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  console.log("Finalizado");
  console.log(`OK: ${ok}`);
  console.log(`Errores: ${failed}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
