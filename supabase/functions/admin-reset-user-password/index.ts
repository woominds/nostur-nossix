// supabase/functions/admin-reset-user-password/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey =
      Deno.env.get("NOSTUR_SERVICE_ROLE_KEY") ||
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ||
      "";

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Faltan variables de entorno." }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return jsonResponse({ error: "No autorizado." }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const token = authHeader.replace("Bearer ", "").trim();

    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !userData.user) {
      return jsonResponse({ error: "Sesión inválida." }, 401);
    }

    const currentUserId = userData.user.id;

    const { data: currentProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id,rol,activo,is_support_user,is_super_admin")
      .eq("id", currentUserId)
      .maybeSingle();

    if (profileError || !currentProfile) {
      return jsonResponse({ error: "No se pudo validar el perfil." }, 403);
    }

    const canReset =
      currentProfile.activo === true &&
      (
        currentProfile.is_support_user === true ||
        currentProfile.is_super_admin === true ||
        currentProfile.rol === "admin_general" ||
        currentProfile.rol === "gerencia"
      );

    if (!canReset) {
      return jsonResponse({ error: "No tenés permisos para resetear contraseñas." }, 403);
    }

    const body = await req.json().catch(() => null);

    const targetUserId = String(body?.user_id || "").trim();
    const newPassword = String(body?.password || "").trim();

    if (!targetUserId) {
      return jsonResponse({ error: "Falta user_id." }, 400);
    }

    if (!newPassword || newPassword.length < 8) {
      return jsonResponse({ error: "La contraseña debe tener al menos 8 caracteres." }, 400);
    }

    const { data: targetProfile, error: targetProfileError } = await supabaseAdmin
      .from("profiles")
      .select("id,email,rol,is_support_user,is_super_admin")
      .eq("id", targetUserId)
      .maybeSingle();

    if (targetProfileError || !targetProfile) {
      return jsonResponse({ error: "No se encontró el usuario destino." }, 404);
    }

    if (
      targetProfile.is_super_admin === true &&
      currentProfile.is_super_admin !== true &&
      currentProfile.is_support_user !== true
    ) {
      return jsonResponse(
        { error: "Solo soporte o super admin puede resetear un super admin." },
        403
      );
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUserId, {
      password: newPassword
    });

    if (updateError) {
      return jsonResponse({ error: updateError.message }, 400);
    }

    await supabaseAdmin
      .from("profiles")
      .update({
        must_change_password: true,
        updated_at: new Date().toISOString()
      })
      .eq("id", targetUserId);

    return jsonResponse({
      ok: true,
      message: "Contraseña actualizada correctamente."
    });
  } catch (error) {
    return jsonResponse(
      {
        error: error instanceof Error ? error.message : "Error inesperado."
      },
      500
    );
  }
});