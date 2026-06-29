// supabase/functions/admin-create-user-profile/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type CreateUserPayload = {
  nombre: string;
  apellido: string;
  email: string;
  password?: string;
  rol: string;
  sucursal_id?: string | null;
  color?: string | null;
  activo?: boolean;
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

function normalizeEmail(email: string) {
  return String(email || "").trim().toLowerCase();
}

function generateTempPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789@$#";
  let password = "";
  for (let i = 0; i < 14; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  return password;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Método no permitido"
      },
      405
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return jsonResponse(
        {
          ok: false,
          error:
            "Faltan variables de entorno SUPABASE_URL, SUPABASE_ANON_KEY o SUPABASE_SERVICE_ROLE_KEY."
        },
        500
      );
    }

    const authHeader = req.headers.get("Authorization") ?? "";

    if (!authHeader) {
      return jsonResponse(
        {
          ok: false,
          error: "No autorizado"
        },
        401
      );
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const {
      data: currentUserData,
      error: currentUserError
    } = await userClient.auth.getUser();

    if (currentUserError || !currentUserData.user) {
      return jsonResponse(
        {
          ok: false,
          error: "Sesión inválida"
        },
        401
      );
    }

    const currentUserId = currentUserData.user.id;

    const { data: currentProfile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, rol, is_super_admin, is_support_user, activo")
      .eq("id", currentUserId)
      .maybeSingle();

    if (profileError) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudo validar el perfil administrador",
          detail: profileError.message
        },
        500
      );
    }

    const canCreateUsers =
      currentProfile?.is_super_admin === true ||
      currentProfile?.is_support_user === true ||
      currentProfile?.rol === "admin_general" ||
      currentProfile?.rol === "gerencia";

    if (!canCreateUsers) {
      return jsonResponse(
        {
          ok: false,
          error: "No tenés permisos para crear usuarios"
        },
        403
      );
    }

    const payload = (await req.json()) as CreateUserPayload;

    const nombre = String(payload.nombre || "").trim();
    const apellido = String(payload.apellido || "").trim();
    const email = normalizeEmail(payload.email);
    const rol = String(payload.rol || "").trim();
    const sucursal_id = payload.sucursal_id || null;
    const color = payload.color || "#FF6A00";
    const activo = payload.activo !== false;
    const password = payload.password?.trim() || generateTempPassword();

    if (!nombre) {
      return jsonResponse(
        {
          ok: false,
          error: "El nombre es obligatorio"
        },
        400
      );
    }

    if (!apellido) {
      return jsonResponse(
        {
          ok: false,
          error: "El apellido es obligatorio"
        },
        400
      );
    }

    if (!email || !email.includes("@")) {
      return jsonResponse(
        {
          ok: false,
          error: "El email no es válido"
        },
        400
      );
    }

    if (!rol) {
      return jsonResponse(
        {
          ok: false,
          error: "El rol es obligatorio"
        },
        400
      );
    }

    const { data: existingProfile } = await adminClient
      .from("profiles")
      .select("id, email")
      .eq("email", email)
      .maybeSingle();

    if (existingProfile) {
      return jsonResponse(
        {
          ok: false,
          error: "Ya existe un perfil con ese email"
        },
        409
      );
    }

    const { data: createdAuthUser, error: authCreateError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          nombre,
          apellido,
          rol
        }
      });

    if (authCreateError || !createdAuthUser.user) {
      return jsonResponse(
        {
          ok: false,
          error: "No se pudo crear el usuario en Supabase Auth",
          detail: authCreateError?.message
        },
        500
      );
    }

    const userId = createdAuthUser.user.id;

    const profileInsert: Record<string, unknown> = {
      id: userId,
      nombre,
      apellido,
      email,
      rol,
      sucursal_id,
      color,
      activo,
      visible_en_sistema: true
    };

    const { data: insertedProfile, error: insertProfileError } =
      await adminClient
        .from("profiles")
        .insert(profileInsert)
        .select("*")
        .single();

    if (insertProfileError) {
      await adminClient.auth.admin.deleteUser(userId);

      return jsonResponse(
        {
          ok: false,
          error:
            "Se creó el usuario en Auth, pero falló la creación del perfil. Se revirtió el usuario.",
          detail: insertProfileError.message
        },
        500
      );
    }

    return jsonResponse({
      ok: true,
      message: "Usuario creado correctamente",
      user_id: userId,
      temp_password: payload.password ? null : password,
      profile: insertedProfile
    });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        error: "Error inesperado creando usuario",
        detail: error instanceof Error ? error.message : String(error)
      },
      500
    );
  }
});