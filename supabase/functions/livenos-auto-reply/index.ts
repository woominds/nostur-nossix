// @ts-nocheck

/* =========================================================
   NOSTUR / NOSSIX — livenos-auto-reply
   Compatible con esquema LiveNos nuevo:
   - conversaciones
   - mensajes
   - lead_oportunidades
   - livenos_auto_reply_rules
   - livenos_auto_reply_logs

   Recibe:
   {
     conversation_id / conversacion_id,
     inbound_message_id / mensaje_id,
     oportunidad_id?
   }
========================================================= */

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CODE_VERSION = "livenos-auto-reply-live-nos-schema-v2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type JsonRecord = Record<string, any>;

type AutoReplyRule = {
  id: string;
  nombre: string;
  activo: boolean;
  dias_semana: number[];
  hora_desde: string;
  hora_hasta: string;
  timezone: string;
  mensaje: string;
  cooldown_minutos: number;
  aplicar_si_cande_activa: boolean;
  aplicar_si_conversacion_tomada: boolean;
  prioridad: number;
};

function jsonResponse(body: JsonRecord, status = 200) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
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

function cleanText(value: any): string {
  return String(value || "").trim();
}

function normalizeTime(value: string | null | undefined): string {
  const raw = cleanText(value);
  if (!raw) return "00:00";

  const parts = raw.split(":");
  const hh = parts[0]?.padStart(2, "0") || "00";
  const mm = parts[1]?.padStart(2, "0") || "00";

  return `${hh}:${mm}`;
}

function timeToMinutes(value: string): number {
  const [hh, mm] = normalizeTime(value).split(":").map((n) => Number(n));
  return hh * 60 + mm;
}

function getZonedParts(timezone: string) {
  const now = new Date();

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Argentina/Cordoba",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).formatToParts(now);

  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";

  const weekdayText = get("weekday");
  const hour = Number(get("hour"));
  const minute = Number(get("minute"));

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6
  };

  return {
    weekday: weekdayMap[weekdayText] ?? 0,
    minutes: hour * 60 + minute,
    hour,
    minute,
    timezone
  };
}

function isInsideRange(currentMinutes: number, fromMinutes: number, toMinutes: number) {
  if (fromMinutes <= toMinutes) {
    return currentMinutes >= fromMinutes && currentMinutes <= toMinutes;
  }

  return currentMinutes >= fromMinutes || currentMinutes <= toMinutes;
}

function isAllDayRange(fromMinutes: number, toMinutes: number) {
  return fromMinutes === 0 && toMinutes >= 1438;
}

function shouldApplyRuleNow(rule: AutoReplyRule) {
  const timezone = rule.timezone || "America/Argentina/Cordoba";
  const zoned = getZonedParts(timezone);

  const dias = Array.isArray(rule.dias_semana) ? rule.dias_semana : [];
  const appliesToday = dias.includes(zoned.weekday);

  if (!appliesToday) {
    return {
      apply: false,
      reason: "rule_not_for_today",
      zoned
    };
  }

  const fromMinutes = timeToMinutes(rule.hora_desde);
  const toMinutes = timeToMinutes(rule.hora_hasta);

  const allDay = isAllDayRange(fromMinutes, toMinutes);
  const insideRange = isInsideRange(zoned.minutes, fromMinutes, toMinutes);

  const apply = allDay || !insideRange;

  return {
    apply,
    reason: apply ? "rule_matches" : "inside_attention_hours",
    zoned,
    fromMinutes,
    toMinutes,
    allDay,
    insideRange
  };
}

function isInboundMessage(message: JsonRecord | null): boolean {
  if (!message) return false;

  const direction = cleanText(message.direction).toLowerCase();

  if (direction) {
    return ["in", "inbound", "incoming", "entrada"].includes(direction);
  }

  return true;
}

function getConversationTaken(conversation: JsonRecord | null): boolean {
  if (!conversation) return false;

  if (conversation.assigned_to) return true;
  if (conversation.tomada_by) return true;

  const estadoGestion = cleanText(conversation.estado_gestion).toLowerCase();
  const inbox = cleanText(conversation.inbox).toLowerCase();

  const takenEstados = ["en_gestion", "tomada", "asignada", "recontactar"];
  const takenInboxes = ["vendedor", "mis_conversaciones"];

  return takenEstados.includes(estadoGestion) || takenInboxes.includes(inbox);
}

async function getCandeActive(params: {
  supabase: any;
  conversationId: string;
  oportunidadId?: string | null;
}) {
  let query = params.supabase
    .from("lead_oportunidades")
    .select("id, cande_activa, transferida_at, cande_handoff_requested_at, assigned_to")
    .eq("conversacion_id", params.conversationId)
    .order("created_at", { ascending: false })
    .limit(1);

  if (params.oportunidadId) {
    query = params.supabase
      .from("lead_oportunidades")
      .select("id, cande_activa, transferida_at, cande_handoff_requested_at, assigned_to")
      .eq("id", params.oportunidadId)
      .limit(1);
  }

  const { data, error } = await query.maybeSingle();

  if (error) {
    console.warn("[livenos-auto-reply] error leyendo lead_oportunidades", error);
    return {
      active: false,
      oportunidad: null
    };
  }

  if (!data?.id) {
    return {
      active: false,
      oportunidad: null
    };
  }

  const candeActiva = data.cande_activa === true;
  const transferida = Boolean(data.transferida_at || data.cande_handoff_requested_at || data.assigned_to);

  return {
    active: candeActiva && !transferida,
    oportunidad: data
  };
}

async function findRecentAutoReplyLog(params: {
  supabase: any;
  conversationId: string;
  ruleId: string;
  cooldownMinutes: number;
}) {
  const since = new Date(
    Date.now() - Math.max(params.cooldownMinutes, 1) * 60 * 1000
  ).toISOString();

  const { data, error } = await params.supabase
    .from("livenos_auto_reply_logs")
    .select("id, sent_at, rule_id, conversation_id")
    .eq("conversation_id", params.conversationId)
    .eq("rule_id", params.ruleId)
    .gte("sent_at", since)
    .order("sent_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.warn("[livenos-auto-reply] cooldown check error", error);
    return null;
  }

  return data || null;
}

async function insertOutboundMessage(params: {
  supabase: any;
  conversationId: string;
  text: string;
  rule: AutoReplyRule;
}) {
  const insertRes = await params.supabase
    .from("mensajes")
    .insert({
      conversacion_id: params.conversationId,
      direction: "out",
      type: "text",
      text: params.text,
      media: null,
      reply_to_id: null,
      forwarded: false,
      status: "pending",
      error: null,
      wa_message_id: null,
      sender_profile_id: null,
      deleted_at: null,
      delivered_at: null,
      read_at: null,
      wa_timestamp: null,
      sender_kind: "automatizacion",
      metadata: {
        source: "livenos-auto-reply",
        rule_id: params.rule.id,
        rule_name: params.rule.nombre,
        code_version: CODE_VERSION
      }
    })
    .select("id")
    .single();

  if (insertRes.error) {
    /*
      Si tu tabla mensajes no tiene metadata, reintentamos sin metadata.
    */
    const fallbackRes = await params.supabase
      .from("mensajes")
      .insert({
        conversacion_id: params.conversationId,
        direction: "out",
        type: "text",
        text: params.text,
        media: null,
        reply_to_id: null,
        forwarded: false,
        status: "pending",
        error: null,
        wa_message_id: null,
        sender_profile_id: null,
        deleted_at: null,
        delivered_at: null,
        read_at: null,
        wa_timestamp: null,
        sender_kind: "automatizacion"
      })
      .select("id")
      .single();

    if (fallbackRes.error) throw fallbackRes.error;

    return fallbackRes.data;
  }

  return insertRes.data;
}

async function updateOutboundMessageStatus(params: {
  supabase: any;
  messageId: string;
  status: string;
  waMessageId?: string | null;
  error?: string | null;
}) {
  if (!params.messageId) return;

  const patch: Record<string, unknown> = {
    status: params.status
  };

  if (params.waMessageId) {
    patch.wa_message_id = params.waMessageId;
  }

  if (params.error) {
    patch.error = params.error;
  }

  if (params.status === "delivered" || params.status === "sent") {
    patch.delivered_at = new Date().toISOString();
  }

  await params.supabase
    .from("mensajes")
    .update(patch)
    .eq("id", params.messageId);
}

async function sendWhatsappMessage(params: {
  conversationId: string;
  outboundMessageId: string;
  text: string;
}) {
  const supabaseUrl = getEnvSupabaseUrl();
  const serviceRoleKey = getEnvServiceRoleKey();

  const body = {
    conversation_id: params.conversationId,
    conversacion_id: params.conversationId,
    message_id: params.outboundMessageId,
    mensaje_id: params.outboundMessageId,
    text: params.text,
    body: params.text,
    message: params.text,
    type: "text",
    source: "livenos-auto-reply"
  };

  const response = await fetch(`${supabaseUrl}/functions/v1/whatsapp-send-message`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });

  let data: any = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.details || `whatsapp-send-message HTTP ${response.status}`);
  }

  return data;
}

async function insertLog(params: {
  supabase: any;
  ruleId: string;
  conversationId: string;
  inboundMessageId: string;
  outboundMessageId: string;
}) {
  const { data, error } = await params.supabase
    .from("livenos_auto_reply_logs")
    .insert({
      rule_id: params.ruleId,
      conversation_id: params.conversationId,
      inbound_message_id: params.inboundMessageId,
      outbound_message_id: params.outboundMessageId,
      sent_at: new Date().toISOString()
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[livenos-auto-reply] error insertando log", error);
    return null;
  }

  return data;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method not allowed",
        code_version: CODE_VERSION
      },
      405
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const body = await req.json().catch(() => ({}));

    const conversationId = cleanText(
      body.conversation_id ||
        body.conversacion_id
    );

    const inboundMessageId = cleanText(
      body.inbound_message_id ||
        body.mensaje_id ||
        body.message_id
    );

    const oportunidadId = cleanText(
      body.oportunidad_id ||
        body.oportunidadId
    ) || null;

    if (!conversationId || !inboundMessageId) {
      return jsonResponse(
        {
          ok: false,
          error: "Faltan conversation_id/conversacion_id o inbound_message_id/mensaje_id.",
          received: body,
          code_version: CODE_VERSION
        },
        400
      );
    }

    const { data: inboundMessage, error: inboundError } = await supabase
      .from("mensajes")
      .select("*")
      .eq("id", inboundMessageId)
      .maybeSingle();

    if (inboundError) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudo leer mensaje inbound.",
          details: inboundError.message,
          code_version: CODE_VERSION
        },
        500
      );
    }

    if (!inboundMessage) {
      return jsonResponse(
        {
          ok: true,
          skipped: true,
          reason: "inbound_message_not_found",
          code_version: CODE_VERSION
        },
        200
      );
    }

    if (!isInboundMessage(inboundMessage)) {
      return jsonResponse(
        {
          ok: true,
          skipped: true,
          reason: "message_is_not_inbound",
          code_version: CODE_VERSION
        },
        200
      );
    }

    const { data: conversation, error: conversationError } = await supabase
      .from("conversaciones")
      .select("*")
      .eq("id", conversationId)
      .maybeSingle();

    if (conversationError) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudo leer conversación.",
          details: conversationError.message,
          code_version: CODE_VERSION
        },
        500
      );
    }

    if (!conversation) {
      return jsonResponse(
        {
          ok: true,
          skipped: true,
          reason: "conversation_not_found",
          code_version: CODE_VERSION
        },
        200
      );
    }

    const { data: rules, error: rulesError } = await supabase
      .from("livenos_auto_reply_rules")
      .select("*")
      .eq("activo", true)
      .order("prioridad", { ascending: true })
      .order("created_at", { ascending: true });

    if (rulesError) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudieron leer reglas.",
          details: rulesError.message,
          code_version: CODE_VERSION
        },
        500
      );
    }

    const activeRules = (rules || []) as AutoReplyRule[];

    if (!activeRules.length) {
      return jsonResponse(
        {
          ok: true,
          skipped: true,
          reason: "no_active_rules",
          code_version: CODE_VERSION
        },
        200
      );
    }

    const candeState = await getCandeActive({
      supabase,
      conversationId,
      oportunidadId
    });

    const candeActive = candeState.active;
    const conversationTaken = getConversationTaken(conversation);

    const evaluations: any[] = [];

    for (const rule of activeRules) {
      const evaluation = shouldApplyRuleNow(rule);

      const currentEvaluation = {
        rule_id: rule.id,
        rule_name: rule.nombre,
        ...evaluation
      };

      evaluations.push(currentEvaluation);

      if (!evaluation.apply) continue;

      if (candeActive && !rule.aplicar_si_cande_activa) {
        currentEvaluation.blocked_by = "cande_active";
        continue;
      }

      if (conversationTaken && !rule.aplicar_si_conversacion_tomada) {
        currentEvaluation.blocked_by = "conversation_taken";
        continue;
      }

      const cooldownMinutes = Number(rule.cooldown_minutos || 720);

      const recentLog = await findRecentAutoReplyLog({
        supabase,
        conversationId,
        ruleId: rule.id,
        cooldownMinutes
      });

      if (recentLog) {
        currentEvaluation.blocked_by = "cooldown";
        currentEvaluation.recent_log_id = recentLog.id;
        continue;
      }

      const text = cleanText(rule.mensaje);

      if (!text) {
        currentEvaluation.blocked_by = "empty_message";
        continue;
      }

      const outboundMessage = await insertOutboundMessage({
        supabase,
        conversationId,
        text,
        rule
      });

      try {
        const sendResult = await sendWhatsappMessage({
          conversationId,
          outboundMessageId: outboundMessage.id,
          text
        });

        const waMessageId =
          sendResult?.message_id ||
          sendResult?.wa_message_id ||
          sendResult?.messages?.[0]?.id ||
          null;

        await updateOutboundMessageStatus({
          supabase,
          messageId: outboundMessage.id,
          status: "sent",
          waMessageId
        });

        const log = await insertLog({
          supabase,
          ruleId: rule.id,
          conversationId,
          inboundMessageId,
          outboundMessageId: outboundMessage.id
        });

        await supabase
          .from("conversaciones")
          .update({
            last_outbound_message_at: new Date().toISOString(),
            last_message_at: new Date().toISOString(),
            last_message_preview: text,
            updated_at: new Date().toISOString()
          })
          .eq("id", conversationId);

        return jsonResponse(
          {
            ok: true,
            sent: true,
            rule_id: rule.id,
            rule_name: rule.nombre,
            outbound_message_id: outboundMessage.id,
            log_id: log?.id || null,
            cande_active: candeActive,
            conversation_taken: conversationTaken,
            evaluations,
            send_result: sendResult,
            code_version: CODE_VERSION
          },
          200
        );
      } catch (sendError) {
        await updateOutboundMessageStatus({
          supabase,
          messageId: outboundMessage.id,
          status: "failed",
          error: sendError?.message || String(sendError)
        });

        return jsonResponse(
          {
            ok: false,
            sent: false,
            error: "No se pudo enviar respuesta automática.",
            details: sendError?.message || String(sendError),
            outbound_message_id: outboundMessage.id,
            rule_id: rule.id,
            rule_name: rule.nombre,
            evaluations,
            code_version: CODE_VERSION
          },
          500
        );
      }
    }

    return jsonResponse(
      {
        ok: true,
        sent: false,
        skipped: true,
        reason: "no_matching_rule",
        cande_active: candeActive,
        conversation_taken: conversationTaken,
        evaluations,
        code_version: CODE_VERSION
      },
      200
    );
  } catch (error) {
    console.error("[livenos-auto-reply] fatal error", error);

    return jsonResponse(
      {
        ok: false,
        error: error?.message || String(error),
        code_version: CODE_VERSION
      },
      500
    );
  }
});