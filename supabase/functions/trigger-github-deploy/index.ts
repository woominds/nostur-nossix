// supabase/functions/trigger-github-deploy/index.ts

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

type DeployTarget = "pwa" | "mac" | "win";

type GitHubContentResponse = {
  content?: string;
  encoding?: string;
  message?: string;
};

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

function getTargetLabel(target: DeployTarget): string {
  if (target === "pwa") return "PWA";
  if (target === "mac") return "MAC";
  return "WINDOWS";
}

function safeJsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function decodeBase64Utf8(value: string): string {
  const clean = value.replace(/\n/g, "");
  const binary = atob(clean);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

  return new TextDecoder("utf-8").decode(bytes);
}

async function readGithubFileText({
  githubToken,
  owner,
  repo,
  ref,
  path
}: {
  githubToken: string;
  owner: string;
  repo: string;
  ref: string;
  path: string;
}): Promise<string | null> {
  const encodedPath = path
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodedPath}?ref=${encodeURIComponent(
    ref
  )}`;

  const response = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    }
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("No se pudo leer archivo de GitHub", {
      path,
      status: response.status,
      detail
    });

    return null;
  }

  const data = (await response.json()) as GitHubContentResponse;

  if (!data.content || data.encoding !== "base64") {
    return null;
  }

  return decodeBase64Utf8(data.content);
}

async function getRepoPackageVersion({
  githubToken,
  owner,
  repo,
  ref
}: {
  githubToken: string;
  owner: string;
  repo: string;
  ref: string;
}): Promise<string | null> {
  const packageJsonText = await readGithubFileText({
    githubToken,
    owner,
    repo,
    ref,
    path: "package.json"
  });

  if (!packageJsonText) {
    return null;
  }

  try {
    const parsed = JSON.parse(packageJsonText) as { version?: unknown };
    const version = String(parsed.version || "").trim();

    return version || null;
  } catch (error) {
    console.error("No se pudo parsear package.json", error);
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return safeJsonResponse({ error: "Método no permitido" }, 405);
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";

    if (!authHeader.startsWith("Bearer ")) {
      return safeJsonResponse({ error: "No autorizado" }, 401);
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
      return safeJsonResponse({ error: "Sesión inválida" }, 401);
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id, email, rol, activo, is_super_admin, is_support_user")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      throw profileError;
    }

    const profileEmail = String(profile?.email || user.email || "").toLowerCase();

    const canDeploy =
      Boolean(profile?.activo) &&
      (profile?.is_support_user === true || profileEmail === "soporte@nostur.com.ar");

    if (!canDeploy) {
      return safeJsonResponse({ error: "No tenés permisos para ejecutar deploy." }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const target = String(body.target || "pwa") as DeployTarget;

    if (!["pwa", "mac", "win"].includes(target)) {
      return safeJsonResponse({ error: "Target inválido. Usar pwa, mac o win." }, 400);
    }

    const githubToken = getEnv("GITHUB_DEPLOY_TOKEN");
    const owner = getEnv("GITHUB_OWNER");
    const repo = getEnv("GITHUB_REPO");
    const ref = Deno.env.get("GITHUB_REF") || "main";
    const workflowId = getWorkflowId(target);
    const targetLabel = getTargetLabel(target);
    const actionsUrl = `https://github.com/${owner}/${repo}/actions`;

    const version = await getRepoPackageVersion({
      githubToken,
      owner,
      repo,
      ref
    });

    const versionText = version ? ` versión ${version}` : "";
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

     await adminClient.from("deploy_jobs").insert({
  tenant_slug: "nossix",
  target,
  status: "failed",
  version,
  workflow_id: workflowId,
        github_owner: owner,
        github_repo: repo,
        github_ref: ref,
        github_actions_url: actionsUrl,
        triggered_by: user.id,
        triggered_by_email: profile?.email || user.email || null,
        message: `Deploy ${targetLabel}${versionText} rechazado por GitHub.`,
        error_message: detail,
        raw_response: {
          status: githubResponse.status,
          detail,
          version
        }
      });

      return safeJsonResponse(
        {
          error: "GitHub rechazó el deploy.",
          status: githubResponse.status,
          detail,
          target,
          version
        },
        500
      );
    }

    const successMessage = version
      ? `Deploy ${targetLabel} disparado correctamente para versión ${version}.`
      : `Deploy ${targetLabel} disparado correctamente. No se pudo detectar la versión desde package.json.`;

    const { data: deployJob, error: deployJobError } = await adminClient
      .from("deploy_jobs")
     .insert({
  tenant_slug: "nossix",
  target,
  status: "triggered",
  version,
  workflow_id: workflowId,
        github_owner: owner,
        github_repo: repo,
        github_ref: ref,
        github_actions_url: actionsUrl,
        triggered_by: user.id,
        triggered_by_email: profile?.email || user.email || null,
        message: successMessage,
        raw_response: {
          version
        }
      })
      .select("id")
      .maybeSingle();

    if (deployJobError) {
      console.error("deploy_jobs insert error", deployJobError);
    }

    return safeJsonResponse({
      ok: true,
      id: deployJob?.id || null,
      target,
      workflow: workflowId,
      ref,
      version,
      message: successMessage,
      actions_url: actionsUrl
    });
  } catch (error) {
    return safeJsonResponse(
      {
        error: error instanceof Error ? error.message : "Error desconocido"
      },
      500
    );
  }
});