// @ts-nocheck

/* =========================================================
   NOSSIX / NOSTUR — whatsapp-webhook

   Escribe en:
   - contactos_wa
   - conversaciones
   - mensajes
   - lead_oportunidades

   Maneja:
   - verificación GET de Meta
   - mensajes inbound
   - reacciones
   - status updates
   - descarga de media
   - automatizaciones LiveNos
   - CANDE
   - push web
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

type LiveNosAutoReplyRule = {
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
  created_at?: string | null;
  updated_at?: string | null;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};

/* =========================================================
   RESPONSES
========================================================= */

function jsonResponse(
  body: Record<string, unknown>,
  status = 200
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

function textResponse(
  body: string,
  status = 200
): Response {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain"
    }
  });
}

/* =========================================================
   HELPERS BÁSICOS
========================================================= */

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function readRecord(
  value: unknown
): Record<string, unknown> {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return {};
  }

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
    throw new Error(
      "Falta configurar NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return createClient(
    supabaseUrl,
    serviceRoleKey,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    }
  );
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
    throw new Error(
      "Falta NOSTUR_SERVICE_ROLE_KEY o SUPABASE_SERVICE_ROLE_KEY."
    );
  }

  return value;
}

function getMetaConfig() {
  const token =
    Deno.env.get("WHATSAPP_ACCESS_TOKEN") ||
    Deno.env.get("WHATSAPP_TOKEN");

  const apiVersion =
    Deno.env.get("WHATSAPP_API_VERSION") ||
    "v25.0";

  if (!token) {
    throw new Error(
      "Falta configurar WHATSAPP_ACCESS_TOKEN."
    );
  }

  return {
    token,
    apiVersion
  };
}

/* =========================================================
   PUSH WEB
========================================================= */

function fireAndForgetInboundWebPush(params: {
  supabase: any;
  conversationId: string;
  messageId: string | null;
  whatsappMessageId: string | null;
  oportunidadId: string | null;
  contactName: string | null;
  fromPhone: string;
  preview: string | null;
}) {
  const task = (async () => {
    try {
      const supabaseUrl = getEnvSupabaseUrl();
      const serviceRoleKey = getEnvServiceRoleKey();

      const conversationRes = await params.supabase
        .from("conversaciones")
        .select("id, assigned_to, titulo, subject")
        .eq("id", params.conversationId)
        .maybeSingle();

      if (conversationRes.error) {
        console.error(
          "[whatsapp-webhook] push omitido: no se pudo leer la conversación",
          conversationRes.error
        );
        return;
      }

      const conversation = conversationRes.data;

      if (!conversation?.id) {
        console.warn(
          "[whatsapp-webhook] push omitido: conversación inexistente",
          {
            conversationId: params.conversationId
          }
        );
        return;
      }

      const assignedTo =
        cleanText(conversation.assigned_to) || null;

      let targetUserIds: string[] = assignedTo
        ? [assignedTo]
        : [];

      /*
       * Si está asignada pero el vendedor no tiene push,
       * usamos gerencia/admin_general como respaldo.
       */
      if (assignedTo) {
        const assignedSubscriptionRes = await params.supabase
          .from("push_subscriptions")
          .select("id")
          .eq("user_id", assignedTo)
          .eq("enabled", true)
          .eq("mensajes_propios", true)
          .limit(1);

        const assignedHasPush =
          !assignedSubscriptionRes.error &&
          Boolean(assignedSubscriptionRes.data?.length);

        if (!assignedHasPush) {
          const fallbackProfilesRes = await params.supabase
            .from("profiles")
            .select("id")
            .eq("activo", true)
            .in("rol", [
              "gerencia",
              "admin_general"
            ]);

          if (fallbackProfilesRes.error) {
            console.warn(
              "[whatsapp-webhook] no se pudieron obtener usuarios de respaldo",
              fallbackProfilesRes.error
            );
          } else {
            targetUserIds = [
              assignedTo,
              ...(fallbackProfilesRes.data || []).map(
                (profile: any) => String(profile.id)
              )
            ];
          }
        }
      }

      targetUserIds = Array.from(
        new Set(
          targetUserIds
            .map((id) => cleanText(id))
            .filter(Boolean)
        )
      );

      const displayName =
        cleanText(params.contactName) ||
        cleanText(conversation.titulo) ||
        cleanText(conversation.subject) ||
        params.fromPhone ||
        "WhatsApp";

      const messagePreview =
        cleanText(params.preview) ||
        "Envió un archivo o contenido multimedia.";

      const preference = assignedTo
        ? "mensajes_propios"
        : "mensajes_nuevos";

      const payload = {
        mode: "internal",
        user_ids: targetUserIds,
        preference,
        title: assignedTo
          ? `Mensaje de ${displayName}`
          : `Nuevo WhatsApp · ${displayName}`,
        body: messagePreview.slice(0, 180),
        url: `/app/?screen=comunicaciones&conversation=${encodeURIComponent(
          params.conversationId
        )}`,
        tag: `whatsapp-${
          params.whatsappMessageId ||
          params.messageId ||
          params.conversationId
        }`,
        data: {
          type: assignedTo
            ? "whatsapp_assigned"
            : "whatsapp_unattended",
          conversation_id: params.conversationId,
          message_id: params.messageId,
          whatsapp_message_id: params.whatsappMessageId,
          oportunidad_id: params.oportunidadId
        }
      };

      console.log(
        "[whatsapp-webhook] enviando push secundario",
        {
          conversationId: params.conversationId,
          messageId: params.messageId,
          assignedTo,
          targetUserIds,
          preference
        }
      );

      const response = await fetch(
        `${supabaseUrl}/functions/v1/send-web-push`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        }
      );

      const responseText = await response.text();

      if (!response.ok) {
        console.error(
          "[whatsapp-webhook] push secundario falló",
          {
            status: response.status,
            body: responseText,
            conversationId: params.conversationId,
            targetUserIds
          }
        );
        return;
      }

      console.log(
        "[whatsapp-webhook] push secundario enviado",
        {
          status: response.status,
          body: responseText,
          conversationId: params.conversationId,
          targetUserIds
        }
      );
    } catch (error) {
      console.error(
        "[whatsapp-webhook] error no bloqueante enviando push",
        error?.message || error
      );
    }
  })();

  const edgeRuntime =
    (globalThis as any).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
  } else {
    void task;
  }
}

/* =========================================================
   CANDE REPLY
========================================================= */

function fireAndForgetCandeReply(params: {
  conversationId?: string | null;
  inboundMessageId?: string | null;
  oportunidadId?: string | null;
  source?: string;
}) {
  const conversationId = cleanText(
    params.conversationId
  );

  const inboundMessageId = cleanText(
    params.inboundMessageId
  );

  if (
    !conversationId ||
    !inboundMessageId
  ) {
    console.warn(
      "[whatsapp-webhook] cande-reply no se dispara: faltan ids.",
      {
        conversationId,
        inboundMessageId
      }
    );

    return;
  }

  const supabaseUrl =
    getEnvSupabaseUrl();

  const serviceRoleKey =
    getEnvServiceRoleKey();

  const body = {
    conversation_id:
      conversationId,
    conversacion_id:
      conversationId,
    inbound_message_id:
      inboundMessageId,
    mensaje_id:
      inboundMessageId,
    oportunidad_id:
      params.oportunidadId || null,
    source:
      params.source ||
      "whatsapp-webhook"
  };

  const task = fetch(
    `${supabaseUrl}/functions/v1/cande-reply`,
    {
      method: "POST",
      headers: {
        Authorization:
          `Bearer ${serviceRoleKey}`,
        apikey:
          serviceRoleKey,
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify(body)
    }
  )
    .then(async (response) => {
      let data: any = null;

      try {
        data = await response.json();
      } catch {
        data = null;
      }

      console.log(
        "[whatsapp-webhook] cande-reply result",
        {
          status: response.status,
          ok: response.ok,
          data
        }
      );
    })
    .catch((error) => {
      console.error(
        "[whatsapp-webhook] cande-reply error",
        error?.message || error
      );
    });

  const edgeRuntime =
    (globalThis as any).EdgeRuntime;

  if (edgeRuntime?.waitUntil) {
    edgeRuntime.waitUntil(task);
  } else {
    void task;
  }
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
    await params.supabase
      .from("whatsapp_webhook_debug")
      .insert({
        event_type:
          params.eventType,
        field:
          params.field,
        whatsapp_message_id:
          params.whatsappMessageId || null,
        status:
          params.status || null,
        from_phone:
          params.fromPhone || null,
        recipient_id:
          params.recipientId || null,
        raw_payload:
          params.rawPayload
      });
  } catch {
    // El debug nunca debe romper el webhook.
  }
}

/* =========================================================
   AUTOMATIZACIONES LIVENOS

   Fuente única:
   livenos_auto_reply_rules
========================================================= */

const DEFAULT_BUSINESS_TIMEZONE =
  "America/Argentina/Cordoba";

const DEFAULT_AUTO_REPLY_COOLDOWN_MINUTES =
  720;

function normalizeAutomationTime(
  value: unknown,
  fallback = "00:00"
): string {
  const raw = cleanText(value);

  if (!raw) {
    return fallback;
  }

  const [
    rawHour = "00",
    rawMinute = "00"
  ] = raw.split(":");

  const parsedHour =
    Number.parseInt(rawHour, 10);

  const parsedMinute =
    Number.parseInt(rawMinute, 10);

  const hour = Number.isFinite(parsedHour)
    ? Math.min(
        23,
        Math.max(0, parsedHour)
      )
    : 0;

  const minute = Number.isFinite(parsedMinute)
    ? Math.min(
        59,
        Math.max(0, parsedMinute)
      )
    : 0;

  return `${String(hour).padStart(
    2,
    "0"
  )}:${String(minute).padStart(
    2,
    "0"
  )}`;
}

function automationTimeToMinutes(
  value: unknown,
  fallback = "00:00"
): number {
  const normalized =
    normalizeAutomationTime(
      value,
      fallback
    );

  const [hour, minute] =
    normalized
      .split(":")
      .map(Number);

  return hour * 60 + minute;
}

function getDatePartsForTimezone(
  timezone: string,
  date = new Date()
) {
  const safeTimezone =
    cleanText(timezone) ||
    DEFAULT_BUSINESS_TIMEZONE;

  const parts =
    new Intl.DateTimeFormat(
      "en-US",
      {
        timeZone:
          safeTimezone,
        weekday:
          "short",
        hour:
          "2-digit",
        minute:
          "2-digit",
        hourCycle:
          "h23"
      }
    ).formatToParts(date);

  const values:
    Record<string, string> = {};

  for (const part of parts) {
    if (
      part.type !== "literal"
    ) {
      values[part.type] =
        part.value;
    }
  }

  const weekdayMap:
    Record<string, number> = {
      Sun: 0,
      Mon: 1,
      Tue: 2,
      Wed: 3,
      Thu: 4,
      Fri: 5,
      Sat: 6
    };

  const hour =
    Number(values.hour || 0);

  const minute =
    Number(values.minute || 0);

  return {
    timezone:
      safeTimezone,
    weekday:
      values.weekday || "",
    dayNumber:
      weekdayMap[
        values.weekday || ""
      ] ?? -1,
    hour,
    minute,
    minutesOfDay:
      hour * 60 + minute
  };
}

function isCandeGloballyEnabled(
  config: any
): boolean {
  if (!config) {
    return false;
  }

  if (config.enabled === false) {
    return false;
  }

  const mode =
    cleanText(config.modo)
      .toLowerCase();

  if (
    [
      "apagada",
      "off",
      "disabled",
      "manual"
    ].includes(mode)
  ) {
    return false;
  }

  return true;
}

function isCandeActiveForConversation(
  params: {
    config: any;
    oportunidad: any;
  }
): boolean {
  if (
    !isCandeGloballyEnabled(
      params.config
    )
  ) {
    return false;
  }

  if (
    params.oportunidad
      ?.cande_activa === false
  ) {
    return false;
  }

  return true;
}

function evaluateLiveNosRuleNow(
  rule: LiveNosAutoReplyRule
) {
  const timezone =
    cleanText(rule.timezone) ||
    DEFAULT_BUSINESS_TIMEZONE;

  const now =
    getDatePartsForTimezone(
      timezone
    );

  const configuredDays =
    Array.isArray(
      rule.dias_semana
    )
      ? rule.dias_semana.map(
          Number
        )
      : [];

  if (
    !configuredDays.includes(
      now.dayNumber
    )
  ) {
    return {
      applies: false,
      reason:
        "day_not_selected",
      debug: {
        timezone,
        weekday:
          now.weekday,
        dayNumber:
          now.dayNumber,
        configuredDays,
        minutesOfDay:
          now.minutesOfDay
      }
    };
  }

  const rawStart =
    cleanText(rule.hora_desde);

  const rawEnd =
    cleanText(rule.hora_hasta);

  const start =
    normalizeAutomationTime(
      rawStart,
      "09:00"
    );

  const end =
    normalizeAutomationTime(
      rawEnd,
      "20:30"
    );

  const startMinutes =
    automationTimeToMinutes(
      start,
      "09:00"
    );

  const endMinutes =
    automationTimeToMinutes(
      end,
      "20:30"
    );

  /*
   * Según el modal:
   * 00:00 a 23:59 significa
   * responder todo el día.
   */
  const allDay =
    start === "00:00" &&
    (
      end === "23:59" ||
      rawEnd === "24:00"
    );

  if (allDay) {
    return {
      applies: true,
      reason:
        "all_day",
      debug: {
        timezone,
        weekday:
          now.weekday,
        dayNumber:
          now.dayNumber,
        configuredDays,
        minutesOfDay:
          now.minutesOfDay,
        start,
        end,
        startMinutes,
        endMinutes
      }
    };
  }

  /*
   * Horario normal.
   *
   * hora_desde / hora_hasta
   * representan horario de atención.
   *
   * La automatización responde
   * fuera de ese rango.
   */
  if (
    startMinutes <= endMinutes
  ) {
    const outside =
      now.minutesOfDay <
        startMinutes ||
      now.minutesOfDay >
        endMinutes;

    return {
      applies:
        outside,
      reason:
        outside
          ? "outside_business_hours"
          : "inside_business_hours",
      debug: {
        timezone,
        weekday:
          now.weekday,
        dayNumber:
          now.dayNumber,
        configuredDays,
        minutesOfDay:
          now.minutesOfDay,
        start,
        end,
        startMinutes,
        endMinutes
      }
    };
  }

  /*
   * Soporta horarios de atención
   * que cruzan medianoche.
   *
   * Ejemplo:
   * 20:00 a 03:00.
   */
  const insideOvernight =
    now.minutesOfDay >=
      startMinutes ||
    now.minutesOfDay <=
      endMinutes;

  return {
    applies:
      !insideOvernight,
    reason:
      insideOvernight
        ? "inside_overnight_business_hours"
        : "outside_overnight_business_hours",
    debug: {
      timezone,
      weekday:
        now.weekday,
      dayNumber:
        now.dayNumber,
      configuredDays,
      minutesOfDay:
        now.minutesOfDay,
      start,
      end,
      startMinutes,
      endMinutes
    }
  };
}

async function sendWhatsAppText(params: {
  token: string;
  apiVersion: string;
  phoneNumberId: string;
  to: string;
  text: string;
}) {
  const url =
    `https://graph.facebook.com/` +
    `${params.apiVersion}/` +
    `${params.phoneNumberId}/messages`;

  const response =
    await fetch(
      url,
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${params.token}`,
          "Content-Type":
            "application/json"
        },
        body: JSON.stringify({
          messaging_product:
            "whatsapp",
          recipient_type:
            "individual",
          to:
            params.to,
          type:
            "text",
          text: {
            preview_url:
              false,
            body:
              params.text
          }
        })
      }
    );

  const data =
    await response
      .json()
      .catch(() => null);

  if (
    !response.ok ||
    data?.error
  ) {
    throw new Error(
      data?.error?.message ||
        `No se pudo enviar la automatización. HTTP ${response.status}`
    );
  }

  return data;
}

async function wasLiveNosAutoReplySentRecently(
  params: {
    supabase: any;
    conversationId: string;
    ruleId: string;
    cooldownMinutes: number;
  }
) {
  const parsedCooldown =
    Number(
      params.cooldownMinutes
    );

  const cooldownMinutes =
    Number.isFinite(
      parsedCooldown
    ) &&
    parsedCooldown > 0
      ? parsedCooldown
      : DEFAULT_AUTO_REPLY_COOLDOWN_MINUTES;

  const since =
    new Date(
      Date.now() -
        cooldownMinutes *
          60 *
          1000
    ).toISOString();

  try {
    /*
     * Primero revisamos los mensajes
     * automáticos de esta conversación.
     *
     * El id de la regla queda guardado
     * dentro de media.
     */
    const result =
      await params.supabase
        .from("mensajes")
        .select(
          "id, media, created_at"
        )
        .eq(
          "conversacion_id",
          params.conversationId
        )
        .eq(
          "direction",
          "out"
        )
        .eq(
          "sender_kind",
          "sistema"
        )
        .gte(
          "created_at",
          since
        )
        .order(
          "created_at",
          {
            ascending: false
          }
        )
        .limit(20);

    if (result.error) {
      console.warn(
        "[whatsapp-webhook] no se pudo revisar cooldown LiveNos",
        result.error
      );

      return false;
    }

    const recentMessages =
      result.data || [];

    return recentMessages.some(
      (message: any) => {
        const media =
          readRecord(
            message?.media
          );

        const source =
          cleanText(
            media.automation_source
          );

        const ruleId =
          cleanText(
            media.automation_rule_id
          );

        return (
          source ===
            "livenos_auto_reply_rules" &&
          ruleId ===
            params.ruleId
        );
      }
    );
  } catch (error) {
    console.warn(
      "[whatsapp-webhook] error revisando cooldown LiveNos",
      error?.message || error
    );

    return false;
  }
}

async function insertOutgoingSystemMessage(
  params: {
    supabase: any;
    conversationId: string;
    text: string;
    waMessageId: string | null;
    ruleId: string;
    ruleName: string;
  }
) {
  const now =
    getNowIso();

  const insertResult =
    await params.supabase
      .from("mensajes")
      .insert({
        conversacion_id:
          params.conversationId,
        direction:
          "out",
        type:
          "text",
        text:
          params.text,
        media: {
          automation_source:
            "livenos_auto_reply_rules",
          automation_rule_id:
            params.ruleId,
          automation_rule_name:
            params.ruleName
        },
        reply_to_id:
          null,
        forwarded:
          false,
        status:
          params.waMessageId
            ? "sent"
            : "delivered",
        error:
          null,
        wa_message_id:
          params.waMessageId,
        sender_profile_id:
          null,
        deleted_at:
          null,
        delivered_at:
          now,
        read_at:
          null,
        wa_timestamp:
          now,
        sender_kind:
          "sistema"
      });

  if (insertResult.error) {
    console.warn(
      "[whatsapp-webhook] no se pudo guardar el mensaje automático",
      insertResult.error
    );
  }
}

async function maybeSendLiveNosAutoReply(
  params: {
    supabase: any;
    token: string;
    apiVersion: string;
    conversationId: string;
    oportunidadId: string | null;
    toPhone: string;
    phoneNumberId: string | null;
  }
) {
  const phoneNumberId =
    cleanText(
      params.phoneNumberId
    ) ||
    cleanText(
      Deno.env.get(
        "WHATSAPP_PHONE_NUMBER_ID"
      )
    );

  const conversationResult =
    await params.supabase
      .from("conversaciones")
      .select(
        `
          id,
          assigned_to,
          tomada_by,
          tomada_at,
          closed_at,
          archived_at,
          deleted_at
        `
      )
      .eq(
        "id",
        params.conversationId
      )
      .maybeSingle();

  if (conversationResult.error) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive:
        false,
      reason:
        "conversation_read_error",
      error:
        conversationResult.error
          .message
    };
  }

  const conversation =
    conversationResult.data;

  if (!conversation) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive:
        false,
      reason:
        "conversation_not_found"
    };
  }

  if (
    conversation.closed_at ||
    conversation.archived_at ||
    conversation.deleted_at
  ) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive:
        false,
      reason:
        "conversation_not_open"
    };
  }

  let oportunidad: any =
    null;

  if (params.oportunidadId) {
    const oportunidadResult =
      await params.supabase
        .from(
          "lead_oportunidades"
        )
        .select(
          "id, cande_activa"
        )
        .eq(
          "id",
          params.oportunidadId
        )
        .maybeSingle();

    if (
      !oportunidadResult.error
    ) {
      oportunidad =
        oportunidadResult.data;
    }
  }

  const candeConfigResult =
    await params.supabase
      .from("cande_config")
      .select(
        "id, enabled, modo"
      )
      .order(
        "updated_at",
        {
          ascending: false,
          nullsFirst: false
        }
      )
      .limit(1)
      .maybeSingle();

  const candeConfig =
    candeConfigResult.error
      ? null
      : candeConfigResult.data;

  const candeActive =
    isCandeActiveForConversation(
      {
        config:
          candeConfig,
        oportunidad
      }
    );

  const rulesResult =
    await params.supabase
      .from(
        "livenos_auto_reply_rules"
      )
      .select("*")
      .eq(
        "activo",
        true
      )
      .order(
        "prioridad",
        {
          ascending: true
        }
      )
      .order(
        "created_at",
        {
          ascending: true
        }
      );

  if (rulesResult.error) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive,
      reason:
        "rules_read_error",
      error:
        rulesResult.error.message
    };
  }

  const rules = (rulesResult.data || []) as LiveNosAutoReplyRule[];

  if (rules.length === 0) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive,
      reason:
        "no_active_rules"
    };
  }

  const conversationTaken =
    Boolean(
      cleanText(
        conversation.assigned_to
      ) ||
      cleanText(
        conversation.tomada_by
      ) ||
      conversation.tomada_at
    );

  const evaluations:
    Array<Record<string, unknown>> = [];

  let selectedRule:
    LiveNosAutoReplyRule | null =
      null;

  let selectedEvaluation:
    any = null;

  for (const rule of rules) {
    const evaluation =
      evaluateLiveNosRuleNow(
        rule
      );

    const blockedByCande =
      candeActive &&
      !Boolean(
        rule.aplicar_si_cande_activa
      );

    const blockedByTaken =
      conversationTaken &&
      !Boolean(
        rule.aplicar_si_conversacion_tomada
      );

    evaluations.push({
      rule_id:
        rule.id,
      rule_name:
        rule.nombre,
      priority:
        rule.prioridad,
      schedule:
        evaluation,
      candeActive,
      conversationTaken,
      blockedByCande,
      blockedByTaken
    });

    if (
      !evaluation.applies
    ) {
      continue;
    }

    if (blockedByCande) {
      continue;
    }

    if (blockedByTaken) {
      continue;
    }

    selectedRule =
      rule;

    selectedEvaluation =
      evaluation;

    break;
  }

  if (!selectedRule) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive,
      reason:
        "no_matching_rule",
      conversationTaken,
      evaluations
    };
  }

  const recentlySent =
    await wasLiveNosAutoReplySentRecently(
      {
        supabase:
          params.supabase,
        conversationId:
          params.conversationId,
        ruleId:
          selectedRule.id,
        cooldownMinutes:
          selectedRule.cooldown_minutos
      }
    );

  if (recentlySent) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive,
      reason:
        "cooldown",
      conversationTaken,
      rule: {
        id:
          selectedRule.id,
        nombre:
          selectedRule.nombre,
        prioridad:
          selectedRule.prioridad,
        cooldown_minutos:
          selectedRule.cooldown_minutos
      },
      evaluation:
        selectedEvaluation
    };
  }

  if (!phoneNumberId) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive,
      reason:
        "missing_phone_number_id",
      rule: {
        id:
          selectedRule.id,
        nombre:
          selectedRule.nombre
      }
    };
  }

  const finalMessage =
    cleanText(
      selectedRule.mensaje
    );

  if (!finalMessage) {
    return {
      sent:
        false,
      suppressCande:
        false,
      candeActive,
      reason:
        "empty_rule_message",
      rule: {
        id:
          selectedRule.id,
        nombre:
          selectedRule.nombre
      }
    };
  }

  const sendResult =
    await sendWhatsAppText({
      token:
        params.token,
      apiVersion:
        params.apiVersion,
      phoneNumberId,
      to:
        params.toPhone,
      text:
        finalMessage
    });

  const waMessageId =
    sendResult
      ?.messages
      ?.[0]
      ?.id ||
    null;

  await insertOutgoingSystemMessage({
    supabase:
      params.supabase,
    conversationId:
      params.conversationId,
    text:
      finalMessage,
    waMessageId,
    ruleId:
      selectedRule.id,
    ruleName:
      selectedRule.nombre
  });

  const now =
    getNowIso();

  await params.supabase
    .from("conversaciones")
    .update({
      last_outbound_message_at:
        now,
      last_message_at:
        now,
      last_message_preview:
        finalMessage,
      updated_at:
        now
    })
    .eq(
      "id",
      params.conversationId
    );

  await saveWebhookDebug({
    supabase:
      params.supabase,
    eventType:
      "livenos_auto_reply_sent",
    field:
      "messages",
    whatsappMessageId:
      waMessageId,
    fromPhone:
      params.toPhone,
    rawPayload: {
      conversation_id:
        params.conversationId,
      oportunidad_id:
        params.oportunidadId,
      cande_active:
        candeActive,
      conversation_taken:
        conversationTaken,
      selected_rule: {
        id:
          selectedRule.id,
        nombre:
          selectedRule.nombre,
        prioridad:
          selectedRule.prioridad,
        aplicar_si_cande_activa:
          selectedRule
            .aplicar_si_cande_activa,
        aplicar_si_conversacion_tomada:
          selectedRule
            .aplicar_si_conversacion_tomada,
        cooldown_minutos:
          selectedRule
            .cooldown_minutos
      },
      evaluation:
        selectedEvaluation,
      message:
        finalMessage,
      send_result:
        sendResult
    }
  });

  /*
   * Si una automatización respondió,
   * CANDE no debe responder al mismo inbound.
   */
  return {
    sent:
      true,
    suppressCande:
      true,
    candeActive,
    reason:
      selectedEvaluation?.reason ||
      "rule_sent",
    conversationTaken,
    waMessageId,
    rule: {
      id:
        selectedRule.id,
      nombre:
        selectedRule.nombre,
      prioridad:
        selectedRule.prioridad
    },
    evaluation:
      selectedEvaluation
  };
}

/* =========================================================
   MEDIA / MENSAJES HELPERS
========================================================= */

function safeFileName(
  value: unknown,
  fallback = "archivo"
): string {
  const name =
    cleanText(value) ||
    fallback;

  return name
    .replace(
      /[^\w.\-áéíóúÁÉÍÓÚñÑ ]/g,
      ""
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);
}

function getExtensionFromMime(
  mimeType?: string | null
): string {
  const mime =
    cleanText(mimeType)
      .toLowerCase();

  const map:
    Record<string, string> = {
      "image/jpeg":
        "jpg",
      "image/jpg":
        "jpg",
      "image/png":
        "png",
      "image/webp":
        "webp",
      "image/gif":
        "gif",

      "application/pdf":
        "pdf",
      "application/msword":
        "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "application/vnd.ms-excel":
        "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",

      "text/plain":
        "txt",

      "audio/mpeg":
        "mp3",
      "audio/mp4":
        "m4a",
      "audio/aac":
        "aac",
      "audio/ogg":
        "ogg",
      "audio/opus":
        "opus",
      "audio/webm":
        "webm",

      "video/mp4":
        "mp4",
      "video/3gpp":
        "3gp"
    };

  return map[mime] || "bin";
}

function getMessageContent(
  message: any
): string | null {
  const type =
    cleanText(message?.type)
      .toLowerCase();

  if (type === "text") {
    return (
      cleanText(
        message?.text?.body
      ) ||
      null
    );
  }

  if (type === "reaction") {
    const emoji =
      cleanText(
        message?.reaction?.emoji
      );

    return emoji
      ? `${emoji} Reacción del pasajero`
      : "Reacción del pasajero";
  }

  if (type === "button") {
    return (
      cleanText(
        message?.button?.text
      ) ||
      null
    );
  }

  if (type === "interactive") {
    return (
      cleanText(
        message?.interactive
          ?.button_reply
          ?.title
      ) ||
      cleanText(
        message?.interactive
          ?.list_reply
          ?.title
      ) ||
      cleanText(
        message?.interactive
          ?.button_reply
          ?.id
      ) ||
      cleanText(
        message?.interactive
          ?.list_reply
          ?.id
      ) ||
      null
    );
  }

  if (type === "image") {
    return (
      cleanText(
        message?.image?.caption
      ) ||
      "Imagen recibida"
    );
  }

  if (type === "audio") {
    return "Audio recibido";
  }

  if (type === "video") {
    return (
      cleanText(
        message?.video?.caption
      ) ||
      "Video recibido"
    );
  }

  if (type === "document") {
    return (
      cleanText(
        message?.document?.caption
      ) ||
      cleanText(
        message?.document?.filename
      ) ||
      "Documento recibido"
    );
  }

  if (type === "sticker") {
    return "Sticker recibido";
  }

  if (type === "location") {
    return "Ubicación recibida";
  }

  if (type === "contacts") {
    return "Contacto recibido";
  }

  if (type === "system") {
    return "Mensaje de sistema";
  }

  if (type === "unsupported") {
    return "Mensaje no soportado";
  }

  return "Mensaje recibido";
}

function mapMessageType(
  message: any
): string {
  const type =
    cleanText(message?.type)
      .toLowerCase();

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
    "reaction",
    "system",
    "unsupported"
  ];

  if (allowed.includes(type)) {
    return type;
  }

  if (type === "button") {
    return "interactive";
  }

  return "unsupported";
}

function getMediaData(
  message: any
): {
  mediaId: string | null;
  filename: string | null;
  mimeType: string | null;
  sha256: string | null;
} {
  const type =
    cleanText(message?.type)
      .toLowerCase();

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
    mediaId:
      media?.id || null,
    filename:
      media?.filename || null,
    mimeType:
      media?.mime_type || null,
    sha256:
      media?.sha256 || null
  };
}

/* =========================================================
   MEDIA DOWNLOAD
   META → SUPABASE STORAGE
========================================================= */

async function downloadIncomingMedia(
  params: {
    supabase: any;
    token: string;
    apiVersion: string;
    conversationId: string;
    message: any;
  }
) {
  const mediaData =
    getMediaData(
      params.message
    );

  if (!mediaData.mediaId) {
    return null;
  }

  const metaInfoUrl =
    `https://graph.facebook.com/` +
    `${params.apiVersion}/` +
    `${mediaData.mediaId}`;

  const infoRes =
    await fetch(
      metaInfoUrl,
      {
        headers: {
          Authorization:
            `Bearer ${params.token}`
        }
      }
    );

  const infoData =
    await infoRes
      .json()
      .catch(() => null);

  if (
    !infoRes.ok ||
    infoData?.error ||
    !infoData?.url
  ) {
    return {
      whatsapp_media_id:
        mediaData.mediaId,
      filename:
        mediaData.filename,
      mime_type:
        mediaData.mimeType,
      sha256:
        mediaData.sha256,
      url:
        null,
      path:
        null,
      size:
        null,
      downloaded_at:
        null,
      download_error:
        infoData
          ?.error
          ?.message ||
        "No se pudo obtener la URL del archivo de Meta."
    };
  }

  const fileRes =
    await fetch(
      infoData.url,
      {
        headers: {
          Authorization:
            `Bearer ${params.token}`
        }
      }
    );

  if (!fileRes.ok) {
    return {
      whatsapp_media_id:
        mediaData.mediaId,
      filename:
        mediaData.filename,
      mime_type:
        mediaData.mimeType,
      sha256:
        mediaData.sha256,
      url:
        null,
      path:
        null,
      size:
        null,
      downloaded_at:
        null,
      download_error:
        `No se pudo descargar el archivo de Meta. HTTP ${fileRes.status}`
    };
  }

  const blob =
    await fileRes.blob();

  const mimeType =
    cleanText(
      mediaData.mimeType
    ) ||
    cleanText(
      fileRes.headers.get(
        "content-type"
      )
    ) ||
    blob.type ||
    "application/octet-stream";

  const extension =
    getExtensionFromMime(
      mimeType
    );

  const messageType =
    cleanText(
      params.message?.type
    ).toLowerCase();

  const fallbackName =
    messageType === "image"
      ? `imagen.${extension}`
      : messageType === "audio"
        ? `audio.${extension}`
        : messageType === "video"
          ? `video.${extension}`
          : messageType === "sticker"
            ? `sticker.${extension}`
            : `documento.${extension}`;

  const filename =
    safeFileName(
      mediaData.filename,
      fallbackName
    );

  const storagePath =
    `whatsapp-inbound/` +
    `${params.conversationId}/` +
    `${Date.now()}-` +
    `${mediaData.mediaId}.` +
    `${extension}`;

  const uploadRes =
    await params.supabase
      .storage
      .from(
        "comunicaciones-media"
      )
      .upload(
        storagePath,
        blob,
        {
          contentType:
            mimeType,
          cacheControl:
            "3600",
          upsert:
            false
        }
      );

  if (uploadRes.error) {
    return {
      whatsapp_media_id:
        mediaData.mediaId,
      filename,
      mime_type:
        mimeType,
      sha256:
        mediaData.sha256,
      url:
        null,
      path:
        null,
      size:
        blob.size,
      downloaded_at:
        null,
      download_error:
        uploadRes.error.message
    };
  }

  const publicRes =
    params.supabase
      .storage
      .from(
        "comunicaciones-media"
      )
      .getPublicUrl(
        storagePath
      );

  return {
    whatsapp_media_id:
      mediaData.mediaId,
    filename,
    mime_type:
      mimeType,
    sha256:
      mediaData.sha256,
    url:
      publicRes.data.publicUrl,
    path:
      storagePath,
    size:
      blob.size,
    downloaded_at:
      getNowIso(),
    download_error:
      null
  };
}

/* =========================================================
   CONTACTO WHATSAPP
========================================================= */

async function findOrCreateContactoWa(
  params: {
    supabase: any;
    phone: string;
    contactName: string | null;
  }
) {
  const normalizedPhone =
    normalizePhoneDigits(params.phone);

  const existingRes = await params.supabase
    .from("contactos_wa")
    .select(`
      id,
      display_name,
      profile_name
    `)
    .eq("wa_phone_normalized", normalizedPhone)
    .limit(1)
    .maybeSingle();

  if (existingRes.error) {
    throw existingRes.error;
  }

  if (existingRes.data?.id) {
    const nextProfileName =
      params.contactName ||
      existingRes.data.profile_name ||
      null;

    const nextDisplayName =
      existingRes.data.display_name ||
      params.contactName ||
      existingRes.data.profile_name ||
      params.phone;

    const updateRes = await params.supabase
      .from("contactos_wa")
      .update({
        wa_phone: params.phone,
        wa_phone_normalized: normalizedPhone,
        profile_name: nextProfileName,
        display_name: nextDisplayName,
        updated_at: getNowIso()
      })
      .eq("id", existingRes.data.id);

    if (updateRes.error) {
      throw updateRes.error;
    }

    return existingRes.data.id as string;
  }

  const insertRes = await params.supabase
    .from("contactos_wa")
    .insert({
      wa_phone: params.phone,
      wa_phone_normalized: normalizedPhone,
      display_name:
        params.contactName ||
        params.phone,
      profile_name:
        params.contactName ||
        null
    })
    .select("id")
    .single();

  if (insertRes.error) {
    /*
     * Protección ante dos webhooks simultáneos
     * intentando crear el mismo contacto.
     */
    if (insertRes.error.code === "23505") {
      const recoveryRes = await params.supabase
        .from("contactos_wa")
        .select("id")
        .eq("wa_phone_normalized", normalizedPhone)
        .limit(1)
        .maybeSingle();

      if (recoveryRes.error) {
        throw recoveryRes.error;
      }

      if (recoveryRes.data?.id) {
        return recoveryRes.data.id as string;
      }
    }

    throw insertRes.error;
  }

  return insertRes.data.id as string;
}

/* =========================================================
   PIPELINE INICIAL
========================================================= */

async function getInitialPipelineEstadoId(
  params: {
    supabase: any;
  }
) {
  const sinAtenderRes =
    await params.supabase
      .from(
        "pipeline_estados"
      )
      .select("id")
      .eq(
        "es_sin_atender",
        true
      )
      .order(
        "orden",
        {
          ascending: true
        }
      )
      .limit(1)
      .maybeSingle();

  if (sinAtenderRes.error) {
    throw sinAtenderRes.error;
  }

  if (
    sinAtenderRes.data?.id
  ) {
    return sinAtenderRes.data
      .id as string;
  }

  const firstRes =
    await params.supabase
      .from(
        "pipeline_estados"
      )
      .select("id")
      .order(
        "orden",
        {
          ascending: true
        }
      )
      .limit(1)
      .maybeSingle();

  if (firstRes.error) {
    throw firstRes.error;
  }

  if (!firstRes.data?.id) {
    throw new Error(
      "No hay pipeline_estados cargados para crear oportunidades."
    );
  }

  return firstRes.data
    .id as string;
}

/* =========================================================
   CONVERSACIÓN
========================================================= */

async function findOrCreateConversacion(
  params: {
    supabase: any;
    contactoId: string;
    phone: string;
    contactName: string | null;
    lastMessage: string | null;
    phoneNumberId: string | null;
  }
) {
  const normalizedPhone =
    normalizePhoneDigits(params.phone);

  /*
   * Primera búsqueda:
   * conversación WhatsApp por teléfono normalizado.
   */
  let existingRes = await params.supabase
    .from("conversaciones")
    .select(`
      id,
      unread_count,
      metadata,
      assigned_to,
      contacto_id
    `)
    .eq("channel", "whatsapp")
    .eq("wa_phone_normalized", normalizedPhone)
    .is("deleted_at", null)
    .order("updated_at", {
      ascending: false
    })
    .limit(1)
    .maybeSingle();

  if (existingRes.error) {
    throw existingRes.error;
  }

  /*
   * Segunda búsqueda:
   * por contacto_id.
   *
   * No filtramos deleted_at porque contacto_id posee
   * una restricción UNIQUE. Si existe una conversación
   * eliminada/archivada, debemos reabrirla.
   */
  if (!existingRes.data?.id) {
    existingRes = await params.supabase
      .from("conversaciones")
      .select(`
        id,
        unread_count,
        metadata,
        assigned_to,
        contacto_id
      `)
      .eq("contacto_id", params.contactoId)
      .order("updated_at", {
        ascending: false
      })
      .limit(1)
      .maybeSingle();

    if (existingRes.error) {
      throw existingRes.error;
    }
  }

  /*
   * Si existe, actualizamos y reabrimos.
   */
  if (existingRes.data?.id) {
    const previousMetadata =
      readRecord(existingRes.data.metadata);

    const unreadCount =
      Number(existingRes.data.unread_count || 0) + 1;

    const assignedTo =
      cleanText(existingRes.data.assigned_to) ||
      null;

    const updateRes = await params.supabase
      .from("conversaciones")
      .update({
        contacto_id: params.contactoId,
        wa_phone: params.phone,
        wa_phone_normalized: normalizedPhone,

        titulo:
          params.contactName ||
          params.phone,

        subject:
          params.contactName ||
          params.phone,

        inbox:
          assignedTo
            ? "vendedor"
            : "general",

        status: "open",
        unread_count: unreadCount,

        last_message_at: getNowIso(),
        last_inbound_message_at: getNowIso(),
        last_message_preview: params.lastMessage,

        whatsapp_24h_expires_at:
          addHoursIso(24),

        window_expires_at:
          addHoursIso(24),

        archived_at: null,
        deleted_at: null,
        closed_at: null,

        estado_gestion:
          assignedTo
            ? "en_gestion"
            : "sin_atender",

        metadata: {
          ...previousMetadata,
          whatsapp_phone_number_id:
            params.phoneNumberId,
          last_webhook_update_at:
            getNowIso()
        },

        updated_at:
          getNowIso()
      })
      .eq("id", existingRes.data.id)
      .select("id")
      .single();

    if (updateRes.error) {
      throw updateRes.error;
    }

    return updateRes.data.id as string;
  }

  /*
   * Si realmente no existe, creamos una nueva.
   */
  const insertRes = await params.supabase
    .from("conversaciones")
    .insert({
      contacto_id:
        params.contactoId,

      assigned_to:
        null,

      sucursal_id:
        null,

      inbox:
        "general",

      status:
        "open",

      priority:
        0,

      unread_count:
        1,

      last_message_at:
        getNowIso(),

      last_message_preview:
        params.lastMessage,

      window_expires_at:
        addHoursIso(24),

      wa_phone:
        params.phone,

      wa_phone_normalized:
        normalizedPhone,

      last_inbound_message_at:
        getNowIso(),

      last_outbound_message_at:
        null,

      whatsapp_24h_expires_at:
        addHoursIso(24),

      archived_at:
        null,

      deleted_at:
        null,

      closed_at:
        null,

      estado_gestion:
        "sin_atender",

      estado_comercial:
        "nuevo",

      categoria:
        null,

      etapa_comercial:
        null,

      subject:
        params.contactName ||
        params.phone,

      titulo:
        params.contactName ||
        params.phone,

      channel:
        "whatsapp",

      metadata: {
        source:
          "whatsapp_webhook",

        whatsapp_phone_number_id:
          params.phoneNumberId,

        created_from_webhook_at:
          getNowIso()
      },

      tomada_at:
        null,

      tomada_by:
        null
    })
    .select("id")
    .single();

  if (insertRes.error) {
    /*
     * Código PostgreSQL 23505:
     * conflicto de clave única.
     *
     * Puede ocurrir por:
     * - contacto histórico;
     * - dos webhooks simultáneos;
     * - datos antiguos sin teléfono normalizado.
     */
    if (insertRes.error.code === "23505") {
      console.warn(
        "[whatsapp-webhook] conflicto único creando conversación; recuperando existente",
        {
          contactoId:
            params.contactoId,
          phone:
            params.phone,
          normalizedPhone,
          error:
            insertRes.error.message
        }
      );

      let recoveryRes = await params.supabase
        .from("conversaciones")
        .select(`
          id,
          unread_count,
          metadata,
          assigned_to
        `)
        .eq("contacto_id", params.contactoId)
        .limit(1)
        .maybeSingle();

      if (recoveryRes.error) {
        throw recoveryRes.error;
      }

      if (!recoveryRes.data?.id) {
        recoveryRes = await params.supabase
          .from("conversaciones")
          .select(`
            id,
            unread_count,
            metadata,
            assigned_to
          `)
          .eq("channel", "whatsapp")
          .eq("wa_phone_normalized", normalizedPhone)
          .limit(1)
          .maybeSingle();

        if (recoveryRes.error) {
          throw recoveryRes.error;
        }
      }

      if (recoveryRes.data?.id) {
        const previousMetadata =
          readRecord(recoveryRes.data.metadata);

        const assignedTo =
          cleanText(recoveryRes.data.assigned_to) ||
          null;

        const recoveryUpdateRes = await params.supabase
          .from("conversaciones")
          .update({
            contacto_id:
              params.contactoId,

            wa_phone:
              params.phone,

            wa_phone_normalized:
              normalizedPhone,

            titulo:
              params.contactName ||
              params.phone,

            subject:
              params.contactName ||
              params.phone,

            inbox:
              assignedTo
                ? "vendedor"
                : "general",

            status:
              "open",

            unread_count:
              Number(
                recoveryRes.data.unread_count || 0
              ) + 1,

            last_message_at:
              getNowIso(),

            last_inbound_message_at:
              getNowIso(),

            last_message_preview:
              params.lastMessage,

            whatsapp_24h_expires_at:
              addHoursIso(24),

            window_expires_at:
              addHoursIso(24),

            archived_at:
              null,

            deleted_at:
              null,

            closed_at:
              null,

            estado_gestion:
              assignedTo
                ? "en_gestion"
                : "sin_atender",

            metadata: {
              ...previousMetadata,
              whatsapp_phone_number_id:
                params.phoneNumberId,
              recovered_after_unique_conflict_at:
                getNowIso()
            },

            updated_at:
              getNowIso()
          })
          .eq("id", recoveryRes.data.id)
          .select("id")
          .single();

        if (recoveryUpdateRes.error) {
          throw recoveryUpdateRes.error;
        }

        return recoveryUpdateRes.data.id as string;
      }
    }

    throw insertRes.error;
  }

  return insertRes.data.id as string;
}

/* =========================================================
   OPORTUNIDAD
========================================================= */

async function ensureLeadOportunidad(
  params: {
    supabase: any;
    conversationId: string;
    lastText: string | null;
  }
) {
  const existingRes =
    await params.supabase
      .from(
        "lead_oportunidades"
      )
      .select("id")
      .eq(
        "conversacion_id",
        params.conversationId
      )
      .limit(1)
      .maybeSingle();

  if (existingRes.error) {
    throw existingRes.error;
  }

  if (existingRes.data?.id) {
    /*
     * Si ya existe, actualizamos solamente
     * el último mensaje dentro de datos.
     */
    if (params.lastText) {
      const currentRes =
        await params.supabase
          .from(
            "lead_oportunidades"
          )
          .select(
            "id, datos"
          )
          .eq(
            "id",
            existingRes.data.id
          )
          .maybeSingle();

      if (
        !currentRes.error &&
        currentRes.data?.id
      ) {
        const currentData =
          readRecord(
            currentRes.data.datos
          );

        await params.supabase
          .from(
            "lead_oportunidades"
          )
          .update({
            datos: {
              ...currentData,
              ultimo_mensaje:
                params.lastText
            },
            updated_at:
              getNowIso()
          })
          .eq(
            "id",
            existingRes.data.id
          );
      }
    }

    return existingRes.data.id as string;
  }

  const estadoId =
    await getInitialPipelineEstadoId({
      supabase:
        params.supabase
    });

  const datos:
    Record<string, unknown> = {};

  if (params.lastText) {
    datos.ultimo_mensaje =
      params.lastText;
  }

  const insertRes =
    await params.supabase
      .from(
        "lead_oportunidades"
      )
      .insert({
        conversacion_id:
          params.conversationId,
        estado_id:
          estadoId,
        score:
          0,
        datos,
        assigned_to:
          null,
        cande_activa:
          true,
        transferida_at:
          null,
        last_score_at:
          getNowIso(),
        cande_handoff_requested_at:
          null
      })
      .select("id")
      .single();

  if (insertRes.error) {
    throw insertRes.error;
  }

  return insertRes.data.id as string;
}

/* =========================================================
   MENSAJES INBOUND
========================================================= */

async function insertIncomingMessage(
  params: {
    supabase: any;
    token: string;
    apiVersion: string;
    conversationId: string;
    message: any;
    contactName: string | null;
    phone: string;
  }
) {
  const content =
    getMessageContent(
      params.message
    );

  const messageType =
    mapMessageType(
      params.message
    );

  const whatsappMessageId =
    cleanText(
      params.message?.id
    ) ||
    null;

  /*
   * Meta puede reenviar el mismo webhook.
   * Evitamos duplicar el mensaje usando wa_message_id.
   */
  if (whatsappMessageId) {
    const existingRes =
      await params.supabase
        .from("mensajes")
        .select("id")
        .eq(
          "wa_message_id",
          whatsappMessageId
        )
        .limit(1)
        .maybeSingle();

    if (existingRes.error) {
      throw existingRes.error;
    }

    if (existingRes.data?.id) {
      return {
        id:
          existingRes.data.id as string,
        created:
          false
      };
    }
  }

  const downloadedMedia =
    await downloadIncomingMedia({
      supabase:
        params.supabase,
      token:
        params.token,
      apiVersion:
        params.apiVersion,
      conversationId:
        params.conversationId,
      message:
        params.message
    });

  const whatsappTimestamp =
    params.message?.timestamp
      ? new Date(
          Number(
            params.message.timestamp
          ) *
            1000
        ).toISOString()
      : getNowIso();

  const insertRes =
    await params.supabase
      .from("mensajes")
      .insert({
        conversacion_id:
          params.conversationId,
        direction:
          "in",
        type:
          messageType,
        text:
          content,
        media:
          downloadedMedia,
        reply_to_id:
          null,
        forwarded:
          Boolean(
            params.message
              ?.context
              ?.forwarded
          ),
        status:
          "delivered",
        error:
          null,
        wa_message_id:
          whatsappMessageId,
        sender_profile_id:
          null,
        deleted_at:
          null,
        delivered_at:
          getNowIso(),
        read_at:
          null,
        wa_timestamp:
          whatsappTimestamp,
        sender_kind:
          "humano"
      })
      .select("id")
      .single();

  if (insertRes.error) {
    throw insertRes.error;
  }

  return {
    id:
      insertRes.data.id as string,
    created:
      true
  };
}

/* =========================================================
   REACCIONES INBOUND
========================================================= */

async function insertIncomingReaction(
  params: {
    supabase: any;
    conversationId: string;
    message: any;
  }
) {
  const reaction =
    params.message?.reaction ||
    null;

  const emoji =
    cleanText(
      reaction?.emoji
    );

  const targetWaMessageId =
    cleanText(
      reaction?.message_id
    );

  const reactionWaMessageId =
    cleanText(
      params.message?.id
    );

  if (
    !emoji ||
    !targetWaMessageId
  ) {
    await saveWebhookDebug({
      supabase:
        params.supabase,
      eventType:
        "reaction_ignored",
      field:
        "messages",
      whatsappMessageId:
        reactionWaMessageId ||
        null,
      rawPayload: {
        reason:
          "missing_emoji_or_target_message_id",
        message:
          params.message
      }
    });

    return null;
  }

  const targetRes =
    await params.supabase
      .from("mensajes")
      .select(
        `
          id,
          conversacion_id,
          wa_message_id
        `
      )
      .eq(
        "wa_message_id",
        targetWaMessageId
      )
      .limit(1)
      .maybeSingle();

  if (targetRes.error) {
    throw targetRes.error;
  }

  if (!targetRes.data?.id) {
    await saveWebhookDebug({
      supabase:
        params.supabase,
      eventType:
        "reaction_target_not_found",
      field:
        "messages",
      whatsappMessageId:
        reactionWaMessageId ||
        null,
      rawPayload: {
        emoji,
        target_wa_message_id:
          targetWaMessageId,
        message:
          params.message
      }
    });

    return null;
  }

  /*
   * Una reacción también puede llegar más de una vez.
   * Si ya existe por wa_reaction_message_id,
   * actualizamos en lugar de insertar.
   */
  const existingRes =
    reactionWaMessageId
      ? await params.supabase
          .from(
            "mensaje_reacciones"
          )
          .select("id")
          .eq(
            "wa_reaction_message_id",
            reactionWaMessageId
          )
          .limit(1)
          .maybeSingle()
      : {
          data:
            null,
          error:
            null
        };

  if (existingRes.error) {
    throw existingRes.error;
  }

  if (existingRes.data?.id) {
    const updateRes =
      await params.supabase
        .from(
          "mensaje_reacciones"
        )
        .update({
          emoji,
          wa_target_message_id:
            targetWaMessageId,
          direction:
            "in",
          metadata: {
            source:
              "whatsapp_webhook",
            raw_message:
              params.message,
            updated_from_duplicate_webhook_at:
              getNowIso()
          }
        })
        .eq(
          "id",
          existingRes.data.id
        )
        .select("id")
        .single();

    if (updateRes.error) {
      throw updateRes.error;
    }

    return updateRes.data.id as string;
  }

  const insertRes =
    await params.supabase
      .from(
        "mensaje_reacciones"
      )
      .insert({
        mensaje_id:
          targetRes.data.id,
        autor_id:
          null,
        emoji,
        wa_reaction_message_id:
          reactionWaMessageId ||
          null,
        wa_target_message_id:
          targetWaMessageId,
        direction:
          "in",
        metadata: {
          source:
            "whatsapp_webhook",
          raw_message:
            params.message
        }
      })
      .select("id")
      .single();

  if (insertRes.error) {
    throw insertRes.error;
  }

  await params.supabase
    .from("conversaciones")
    .update({
      last_message_at:
        getNowIso(),
      last_inbound_message_at:
        getNowIso(),
      last_message_preview:
        `${emoji} Reacción del pasajero`,
      updated_at:
        getNowIso()
    })
    .eq(
      "id",
      params.conversationId
    );

  await saveWebhookDebug({
    supabase:
      params.supabase,
    eventType:
      "reaction_saved",
    field:
      "messages",
    whatsappMessageId:
      reactionWaMessageId ||
      null,
    rawPayload: {
      reaction_id:
        insertRes.data.id,
      conversation_id:
        params.conversationId,
      target_message_id:
        targetRes.data.id,
      target_wa_message_id:
        targetWaMessageId,
      emoji,
      message:
        params.message
    }
  });

  return insertRes.data.id as string;
}

/* =========================================================
   STATUS DE MENSAJES
========================================================= */

async function updateMessageStatus(
  params: {
    supabase: any;
    status: any;
  }
) {
  const whatsappMessageId =
    cleanText(
      params.status?.id
    );

  const statusValue =
    cleanText(
      params.status?.status
    ).toLowerCase();

  if (
    !whatsappMessageId ||
    !statusValue
  ) {
    return;
  }

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

  if (!mappedStatus) {
    return;
  }

  const patch:
    Record<string, unknown> = {
      status:
        mappedStatus
    };

  if (
    mappedStatus === "sent"
  ) {
    /*
     * No hay columna sent_at en todos los esquemas.
     * Solo actualizamos el status.
     */
  }

  if (
    mappedStatus === "delivered"
  ) {
    patch.delivered_at =
      getNowIso();
  }

  if (
    mappedStatus === "read"
  ) {
    patch.read_at =
      getNowIso();
  }

  if (
    mappedStatus === "failed"
  ) {
    patch.error =
      cleanText(
        params.status
          ?.errors
          ?.[0]
          ?.title
      ) ||
      cleanText(
        params.status
          ?.errors
          ?.[0]
          ?.message
      ) ||
      cleanText(
        params.status
          ?.errors
          ?.[0]
          ?.error_data
          ?.details
      ) ||
      "WhatsApp informó un error de entrega.";
  }

  const updateRes =
    await params.supabase
      .from("mensajes")
      .update(patch)
      .eq(
        "wa_message_id",
        whatsappMessageId
      )
      .select("id");

  if (updateRes.error) {
    await saveWebhookDebug({
      supabase:
        params.supabase,
      eventType:
        "status_update_error",
      field:
        "mensajes",
      whatsappMessageId,
      status:
        mappedStatus,
      recipientId:
        params.status
          ?.recipient_id ||
        null,
      rawPayload: {
        error:
          updateRes.error,
        status:
          params.status
      }
    });

    return;
  }

  if (
    !updateRes.data ||
    updateRes.data.length === 0
  ) {
    await saveWebhookDebug({
      supabase:
        params.supabase,
      eventType:
        "status_no_match",
      field:
        "mensajes",
      whatsappMessageId,
      status:
        mappedStatus,
      recipientId:
        params.status
          ?.recipient_id ||
        null,
      rawPayload:
        params.status
    });

    return;
  }

  await saveWebhookDebug({
    supabase:
      params.supabase,
    eventType:
      "status_updated",
    field:
      "mensajes",
    whatsappMessageId,
    status:
      mappedStatus,
    recipientId:
      params.status
        ?.recipient_id ||
      null,
    rawPayload: {
      updated_message_ids:
        updateRes.data.map(
          (item: any) =>
            item.id
        ),
      status:
        params.status
    }
  });
}

/* =========================================================
   PROCESAR MENSAJE ENTRANTE
========================================================= */

async function processIncomingMessage(
  params: {
    supabase: any;
    token: string;
    apiVersion: string;
    message: any;
    contactName: string | null;
    phoneNumberId: string | null;
  }
) {
  const fromPhone =
    normalizePhoneDigits(
      params.message?.from
    );

  if (!fromPhone) {
    throw new Error(
      "Mensaje inbound sin teléfono origen."
    );
  }

  const rawMessageType =
    cleanText(
      params.message?.type
    ).toLowerCase();

  const lastMessage =
    getMessageContent(
      params.message
    );

  const contactoId =
    await findOrCreateContactoWa({
      supabase:
        params.supabase,
      phone:
        fromPhone,
      contactName:
        params.contactName
    });

  const conversationId =
    await findOrCreateConversacion({
      supabase:
        params.supabase,
      contactoId,
      phone:
        fromPhone,
      contactName:
        params.contactName,
      lastMessage,
      phoneNumberId:
        params.phoneNumberId
    });

  let messageId:
    string | null = null;

  let messageCreated =
    false;

  if (
    rawMessageType ===
    "reaction"
  ) {
    messageId =
      await insertIncomingReaction({
        supabase:
          params.supabase,
        conversationId,
        message:
          params.message
      });
  } else {
    const insertedMessage =
      await insertIncomingMessage({
        supabase:
          params.supabase,
        token:
          params.token,
        apiVersion:
          params.apiVersion,
        conversationId,
        message:
          params.message,
        contactName:
          params.contactName,
        phone:
          fromPhone
      });

    messageId =
      insertedMessage.id;

    messageCreated =
      insertedMessage.created;
  }

  const oportunidadId =
    await ensureLeadOportunidad({
      supabase:
        params.supabase,
      conversationId,
      lastText:
        lastMessage
    });

  await saveWebhookDebug({
    supabase:
      params.supabase,
    eventType:
      "inbound_saved",
    field:
      "messages",
    whatsappMessageId:
      params.message?.id ||
      null,
    fromPhone,
    rawPayload: {
      conversation_id:
        conversationId,
      message_id:
        messageId,
      message_created:
        messageCreated,
      oportunidad_id:
        oportunidadId,
      message_type:
        rawMessageType,
      message:
        params.message
    }
  });

  /*
   * Solo notificamos si efectivamente fue creado.
   * Un webhook duplicado no debe generar dos push.
   */
  if (
    messageCreated &&
    rawMessageType !==
      "reaction" &&
    conversationId &&
    messageId
  ) {
    fireAndForgetInboundWebPush({
      supabase:
        params.supabase,
      conversationId,
      messageId,
      whatsappMessageId:
        params.message?.id ||
        null,
      oportunidadId,
      contactName:
        params.contactName,
      fromPhone,
      preview:
        lastMessage
    });
  }

  return {
    conversationId,
    conversation_id:
      conversationId,
    conversacion_id:
      conversationId,

    messageId,
    message_id:
      messageId,
    mensaje_id:
      messageId,

    messageCreated,
    message_created:
      messageCreated,

    oportunidadId,
    oportunidad_id:
      oportunidadId,

    rawMessageType,
    raw_message_type:
      rawMessageType,

    fromPhone,
    from_phone:
      fromPhone
  };
}

/* =========================================================
   EJECUCIÓN POST-INBOUND

   Orden:
   1. Ignorar automatizaciones para reacciones.
   2. Ejecutar automatizaciones LiveNos.
   3. Si una automatización respondió, no ejecutar CANDE.
   4. Si no respondió y CANDE está habilitada, ejecutar CANDE.
========================================================= */

async function handleInboundAutomationsAndCande(
  params: {
    supabase: any;
    token: string;
    apiVersion: string;
    phoneNumberId: string | null;
    result: any;
  }
) {
  const conversationId =
    cleanText(
      params.result
        ?.conversationId ||
      params.result
        ?.conversation_id ||
      params.result
        ?.conversacion_id
    );

  const inboundMessageId =
    cleanText(
      params.result
        ?.messageId ||
      params.result
        ?.message_id ||
      params.result
        ?.mensaje_id ||
      params.result
        ?.inboundMessageId
    );

  const oportunidadId =
    cleanText(
      params.result
        ?.oportunidadId ||
      params.result
        ?.oportunidad_id
    ) ||
    null;

  const fromPhone =
    cleanText(
      params.result
        ?.fromPhone ||
      params.result
        ?.from_phone
    );

  const rawMessageType =
    cleanText(
      params.result
        ?.rawMessageType ||
      params.result
        ?.raw_message_type
    ).toLowerCase();

  const messageCreated =
    params.result
      ?.messageCreated === true ||
    params.result
      ?.message_created === true;

  if (!conversationId) {
    return {
      automation:
        null,
      candeTriggered:
        false,
      reason:
        "missing_conversation_id"
    };
  }

  if (
    rawMessageType ===
    "reaction"
  ) {
    console.log(
      "[whatsapp-webhook] automatizaciones y CANDE omitidas para reacción",
      {
        conversationId,
        oportunidadId
      }
    );

    return {
      automation:
        null,
      candeTriggered:
        false,
      reason:
        "reaction_message"
    };
  }

  /*
   * Si Meta repite un webhook ya guardado,
   * no volvemos a disparar automatización ni CANDE.
   */
  if (!messageCreated) {
    console.log(
      "[whatsapp-webhook] automatizaciones omitidas por webhook duplicado",
      {
        conversationId,
        inboundMessageId,
        oportunidadId
      }
    );

    return {
      automation:
        null,
      candeTriggered:
        false,
      reason:
        "duplicate_inbound"
    };
  }

  const autoReplyResult =
    await maybeSendLiveNosAutoReply({
      supabase:
        params.supabase,
      token:
        params.token,
      apiVersion:
        params.apiVersion,
      conversationId,
      oportunidadId,
      toPhone:
        fromPhone,
      phoneNumberId:
        params.phoneNumberId
    });

  await saveWebhookDebug({
    supabase:
      params.supabase,
    eventType:
      autoReplyResult?.sent
        ? "livenos_auto_reply_result_sent"
        : "livenos_auto_reply_result_skipped",
    field:
      "messages",
    fromPhone:
      fromPhone ||
      null,
    rawPayload: {
      conversation_id:
        conversationId,
      inbound_message_id:
        inboundMessageId ||
        null,
      oportunidad_id:
        oportunidadId,
      auto_reply_result:
        autoReplyResult
    }
  });

  /*
   * Si la automatización respondió,
   * suprime CANDE para este inbound.
   */
  if (
    autoReplyResult
      ?.suppressCande === true
  ) {
    console.log(
      "[whatsapp-webhook] CANDE omitida porque respondió una automatización LiveNos",
      {
        conversationId,
        oportunidadId,
        autoReplyResult
      }
    );

    return {
      automation:
        autoReplyResult,
      candeTriggered:
        false,
      reason:
        "automation_sent"
    };
  }

  /*
   * Si no hay messageId no podemos llamar cande-reply.
   */
  if (!inboundMessageId) {
    console.warn(
      "[whatsapp-webhook] CANDE no se dispara: falta inboundMessageId",
      {
        conversationId,
        oportunidadId,
        autoReplyResult
      }
    );

    return {
      automation:
        autoReplyResult,
      candeTriggered:
        false,
      reason:
        "missing_inbound_message_id"
    };
  }

  /*
   * La propia función cande-reply debe validar:
   * - configuración global
   * - cande_activa de la oportunidad
   * - estado de conversación
   * - handoff
   *
   * El webhook solo la invoca cuando ninguna
   * automatización respondió.
   */
  fireAndForgetCandeReply({
    conversationId,
    inboundMessageId,
    oportunidadId,
    source:
      "whatsapp-webhook"
  });

  return {
    automation:
      autoReplyResult,
    candeTriggered:
      true,
    reason:
      "cande_dispatched"
  };
}

/* =========================================================
   SERVER
========================================================= */

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return jsonResponse({
      ok: true
    });
  }

  try {
    const url =
      new URL(req.url);

    /* =====================================================
       VERIFICACIÓN GET DE META
    ===================================================== */

    if (req.method === "GET") {
      const mode =
        url.searchParams.get(
          "hub.mode"
        );

      const token =
        url.searchParams.get(
          "hub.verify_token"
        );

      const challenge =
        url.searchParams.get(
          "hub.challenge"
        );

      const verifyToken =
        Deno.env.get(
          "WHATSAPP_VERIFY_TOKEN"
        ) ||
        Deno.env.get(
          "META_VERIFY_TOKEN"
        );

      if (
        mode === "subscribe" &&
        token &&
        token === verifyToken &&
        challenge
      ) {
        return textResponse(
          challenge,
          200
        );
      }

      return textResponse(
        "Forbidden",
        403
      );
    }

    if (req.method !== "POST") {
      return jsonResponse(
        {
          ok: false,
          error:
            "Method not allowed"
        },
        405
      );
    }

    /* =====================================================
       INICIALIZACIÓN
    ===================================================== */

    const supabase =
      getSupabaseAdmin();

    const meta =
      getMetaConfig();

    const payload =
      (await req.json()) as WhatsAppWebhookPayload;

    await saveWebhookDebug({
      supabase,
      eventType:
        "webhook_received",
      field:
        "raw",
      rawPayload:
        payload
    });

    const results:
      Array<Record<string, unknown>> = [];

    /* =====================================================
       RECORRIDO DE PAYLOAD META
    ===================================================== */

    for (
      const entry
      of payload.entry || []
    ) {
      for (
        const change
        of entry.changes || []
      ) {
        const value =
          change.value || {};

        const field =
          change.field || null;

        const phoneNumberId =
          value.metadata
            ?.phone_number_id ||
          null;

        const contactByWaId =
          new Map<
            string,
            string | null
          >();

        for (
          const contact
          of value.contacts || []
        ) {
          const waId =
            normalizePhoneDigits(
              contact.wa_id
            );

          if (waId) {
            contactByWaId.set(
              waId,
              contact.profile
                ?.name ||
              null
            );
          }
        }

        /* =================================================
           STATUS DE MENSAJES SALIENTES
        ================================================= */

        for (
          const status
          of value.statuses || []
        ) {
          try {
            await updateMessageStatus({
              supabase,
              status
            });

            results.push({
              type:
                "status",
              id:
                status?.id ||
                null,
              status:
                status?.status ||
                null,
              processed:
                true
            });
          } catch (error) {
            await saveWebhookDebug({
              supabase,
              eventType:
                "status_processing_error",
              field,
              whatsappMessageId:
                status?.id ||
                null,
              status:
                status?.status ||
                null,
              recipientId:
                status
                  ?.recipient_id ||
                null,
              rawPayload: {
                error:
                  error?.message ||
                  String(error),
                status
              }
            });

            results.push({
              type:
                "status_error",
              id:
                status?.id ||
                null,
              status:
                status?.status ||
                null,
              error:
                error?.message ||
                String(error)
            });
          }
        }

        /* =================================================
           MENSAJES ENTRANTES
        ================================================= */

        for (
          const message
          of value.messages || []
        ) {
          const fromPhone =
            normalizePhoneDigits(
              message?.from
            );

          const contactName =
            contactByWaId.get(
              fromPhone
            ) ||
            null;

          try {
            /*
             * Primero guardamos:
             * - contacto
             * - conversación
             * - mensaje/reacción
             * - oportunidad
             */
            const result =
              await processIncomingMessage({
                supabase,
                token:
                  meta.token,
                apiVersion:
                  meta.apiVersion,
                message,
                contactName,
                phoneNumberId
              });

            /*
             * Después evaluamos:
             * - automatizaciones LiveNos
             * - CANDE
             */
            const postInboundResult =
              await handleInboundAutomationsAndCande({
                supabase,
                token:
                  meta.token,
                apiVersion:
                  meta.apiVersion,
                phoneNumberId,
                result
              });

            results.push({
              type:
                "message",
              id:
                message?.id ||
                null,
              message_type:
                message?.type ||
                null,
              ...result,
              post_inbound:
                postInboundResult
            });
          } catch (error) {
            console.error(
              "[whatsapp-webhook] error procesando inbound",
              {
                messageId:
                  message?.id ||
                  null,
                fromPhone,
                error:
                  error?.message ||
                  error
              }
            );

            await saveWebhookDebug({
              supabase,
              eventType:
                "inbound_error",
              field,
              whatsappMessageId:
                message?.id ||
                null,
              fromPhone:
                fromPhone ||
                null,
              rawPayload: {
                error:
                  error?.message ||
                  String(error),
                message
              }
            });

            results.push({
              type:
                "message_error",
              id:
                message?.id ||
                null,
              message_type:
                message?.type ||
                null,
              error:
                error?.message ||
                String(error)
            });
          }
        }
      }
    }

    /* =====================================================
       RESPUESTA FINAL A META
    ===================================================== */

    return jsonResponse({
      ok: true,
      processed_at:
        getNowIso(),
      results
    });
  } catch (error) {
    console.error(
      "[whatsapp-webhook] error general",
      error?.message ||
      error
    );

    return jsonResponse(
      {
        ok: false,
        error:
          error?.message ||
          String(error),
        processed_at:
          getNowIso()
      },
      500
    );
  }
});