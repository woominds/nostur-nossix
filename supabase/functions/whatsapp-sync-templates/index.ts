// @ts-nocheck

/* =========================================================
   NOSSIX / NOSTUR — whatsapp-sync-templates

   Sincroniza plantillas reales de Meta WhatsApp Cloud API
   hacia public.whatsapp_templates.

   Requiere secrets:
   - SUPABASE_URL
   - NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY
   - WHATSAPP_ACCESS_TOKEN
   - WHATSAPP_WABA_ID

   Consulta Meta:
   GET /{WABA_ID}/message_templates

   Guarda:
   - name
   - display_name
   - language
   - category
   - body
   - variables
   - components
   - meta_id
   - meta_status
   - active
   - raw_meta
   - last_synced_at
========================================================= */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS"
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

  const wabaId =
    Deno.env.get("WHATSAPP_WABA_ID") ||
    Deno.env.get("WABA_ID") ||
    Deno.env.get("WHATSAPP_BUSINESS_ACCOUNT_ID");

  const apiVersion = Deno.env.get("WHATSAPP_API_VERSION") || "v25.0";

  if (!token) {
    throw new Error("Falta configurar WHATSAPP_ACCESS_TOKEN.");
  }

  if (!wabaId) {
    throw new Error("Falta configurar WHATSAPP_WABA_ID.");
  }

  return {
    token,
    wabaId,
    apiVersion
  };
}

/* =========================================================
   HELPERS
========================================================= */

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : [];
}

function extractBodyFromComponents(components: any[]): string {
  const bodyComponent = components.find((component) => {
    return cleanText(component?.type).toUpperCase() === "BODY";
  });

  return cleanText(bodyComponent?.text);
}

function extractVariablesFromBody(body: string): string[] {
  const matches = body.match(/\{\{\s*\d+\s*\}\}/g) || [];

  return Array.from(new Set(matches)).map((match) => {
    return match.replace(/[{} ]/g, "");
  });
}

function extractVariablesFromComponents(components: any[]): string[] {
  const body = extractBodyFromComponents(components);
  const bodyVariables = extractVariablesFromBody(body);

  const exampleVariables: string[] = [];

  for (const component of components) {
    const example = component?.example;

    const bodyText =
      example?.body_text ||
      example?.bodyText ||
      example?.text ||
      null;

    if (Array.isArray(bodyText)) {
      for (const item of bodyText) {
        if (Array.isArray(item)) {
          for (const value of item) {
            const clean = cleanText(value);
            if (clean) exampleVariables.push(clean);
          }
        } else {
          const clean = cleanText(item);
          if (clean) exampleVariables.push(clean);
        }
      }
    }
  }

  if (exampleVariables.length > 0) {
    return exampleVariables;
  }

  return bodyVariables;
}

function buildDisplayName(name: string): string {
  return cleanText(name)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeStatus(value: unknown): string {
  return cleanText(value).toLowerCase() || "unknown";
}

function isTemplateActive(status: string): boolean {
  const clean = normalizeStatus(status);

  return ["approved", "active"].includes(clean);
}

function normalizeTemplateFromMeta(template: any) {
  const components = asArray(template?.components);
  const name = cleanText(template?.name);
  const language = cleanText(template?.language) || "es_AR";
  const body = extractBodyFromComponents(components);
  const status = normalizeStatus(template?.status);

  return {
    name,
    display_name: buildDisplayName(name),
    language,
    category: cleanText(template?.category) || null,
    body,
    variables: extractVariablesFromComponents(components),
    components,
    meta_id: cleanText(template?.id) || null,
    meta_status: status,
    active: isTemplateActive(status),
    raw_meta: template,
    last_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

/* =========================================================
   META FETCH
========================================================= */

async function fetchTemplatesFromMeta(params: {
  token: string;
  wabaId: string;
  apiVersion: string;
}) {
  const allTemplates: any[] = [];

  let url =
    `https://graph.facebook.com/${params.apiVersion}/${params.wabaId}/message_templates` +
    `?fields=id,name,language,status,category,components`;

  while (url) {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${params.token}`
      }
    });

    const data = await response.json();

    if (!response.ok || data.error) {
      const message =
        data?.error?.message ||
        data?.error?.error_user_msg ||
        `Meta rechazó la consulta de plantillas. HTTP ${response.status}`;

      return {
        ok: false,
        error: message,
        meta: data,
        templates: allTemplates
      };
    }

    allTemplates.push(...asArray(data?.data));

    url = cleanText(data?.paging?.next);
  }

  return {
    ok: true,
    error: null,
    meta: null,
    templates: allTemplates
  };
}

/* =========================================================
   UPSERT
========================================================= */

async function upsertTemplates(params: {
  supabase: any;
  templates: any[];
}) {
  const normalized = params.templates
    .map((template) => normalizeTemplateFromMeta(template))
    .filter((template) => template.name && template.language);

  if (normalized.length === 0) {
    return {
      synced: 0,
      templates: []
    };
  }

  const upsertRes = await params.supabase
    .from("whatsapp_templates")
    .upsert(normalized, {
      onConflict: "name,language"
    })
    .select("id,name,language,display_name,meta_status,active");

  if (upsertRes.error) {
    throw new Error(`No se pudieron guardar plantillas: ${upsertRes.error.message}`);
  }

  return {
    synced: upsertRes.data?.length || 0,
    templates: upsertRes.data || []
  };
}

/* =========================================================
   SERVER
========================================================= */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true });
  }

  if (!["GET", "POST"].includes(req.method)) {
    return jsonResponse({ ok: false, error: "Method not allowed" }, 405);
  }

  try {
    const supabase = getSupabaseAdmin();
    const meta = getMetaConfig();

    const fetched = await fetchTemplatesFromMeta({
      token: meta.token,
      wabaId: meta.wabaId,
      apiVersion: meta.apiVersion
    });

    if (!fetched.ok) {
      return jsonResponse(
        {
          ok: false,
          error: fetched.error,
          meta: fetched.meta
        },
        400
      );
    }

    const saved = await upsertTemplates({
      supabase,
      templates: fetched.templates
    });

    return jsonResponse({
      ok: true,
      fetched: fetched.templates.length,
      synced: saved.synced,
      templates: saved.templates
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error || "Error desconocido.")
      },
      500
    );
  }
});