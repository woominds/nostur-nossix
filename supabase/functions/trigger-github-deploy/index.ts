// supabase/functions/trigger-github-deploy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type DeployTarget = "pwa" | "mac" | "win";

function getEnv(name: string): string {
  const value = Deno.env.get(name);

  if (!value) {
    throw new Error(`Falta variable de entorno: ${name}`);
  }

  return value;
}

function getWorkflowId(target: DeployTarget): string {
  if (target === "pwa") return getEnv("GITHUB_WORKFLOW_PWA");
  if (target === "mac") return getEnv("GITHUB_WORKFLOW_MAC");
  return getEnv("GITHUB_WORKFLOW_WIN");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método no permitido" }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const supabaseUrl = getEnv("SUPABASE_URL");
    const supabaseAnonKey = getEnv("SUPABASE_ANON_KEY");
    const supabaseServiceRoleKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader
        }
      }
    });

    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const {
      data: { user },
      error: userError
    } = await userClient.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Sesión inválida" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, rol, activo, is_super_admin, is_support_user")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

  const canDeploy =
  Boolean(profile?.activo) &&
  (profile?.is_support_user === true || profile?.email === "soporte@nostur.com.ar");

    if (!canDeploy) {
      return new Response(
        JSON.stringify({ error: "No tenés permisos para ejecutar deploy." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const body = await req.json().catch(() => ({}));
    const target = String(body.target || "pwa") as DeployTarget;

    if (!["pwa", "mac", "win"].includes(target)) {
      return new Response(
        JSON.stringify({ error: "Target inválido. Usar pwa, mac o win." }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    const githubToken = getEnv("GITHUB_DEPLOY_TOKEN");
    const owner = getEnv("GITHUB_OWNER");
    const repo = getEnv("GITHUB_REPO");
    const ref = Deno.env.get("GITHUB_REF") || "main";
    const workflowId = getWorkflowId(target);

    const githubUrl = `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflowId}/dispatches`;

    const githubResponse = await fetch(githubUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({ ref })
    });

    if (!githubResponse.ok) {
      const detail = await githubResponse.text();

      return new Response(
        JSON.stringify({
          error: "GitHub rechazó el deploy.",
          status: githubResponse.status,
          detail
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        target,
        workflow: workflowId,
        ref,
        message: `Deploy ${target.toUpperCase()} disparado correctamente.`,
        actions_url: `https://github.com/${owner}/${repo}/actions`
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Error desconocido"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    );
  }
});