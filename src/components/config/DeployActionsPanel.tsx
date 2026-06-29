// src/components/config/DeployActionsPanel.tsx

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  CloudUpload,
  ExternalLink,
  Loader2,
  MonitorDown,
  RefreshCcw,
  Smartphone
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type DeployTarget = "pwa" | "mac" | "win";
type DeployStatus = "triggered" | "running" | "success" | "failed";

type DeployState = {
  loading: DeployTarget | null;
  message: string | null;
  error: string | null;
};

type DeployJob = {
  id: string;
  created_at: string;
  updated_at: string | null;
  tenant_slug: string;
  target: DeployTarget;
  status: DeployStatus;
  workflow_id: string | null;
  github_owner: string | null;
  github_repo: string | null;
  github_ref: string | null;
  github_actions_url: string | null;
  triggered_by_email: string | null;
  message: string | null;
  error_message: string | null;

  // Si más adelante agregás esta columna en Supabase,
  // el panel ya queda preparado para leerla.
  version?: string | null;
};

const DEPLOY_OPTIONS: Array<{
  target: DeployTarget;
  title: string;
  description: string;
  icon: typeof CloudUpload;
}> = [
  {
    target: "pwa",
    title: "Subir PWA",
    description: "Compila y publica https://nossix.nostur.com.ar/app/",
    icon: Smartphone
  },
  {
    target: "mac",
    title: "Subir actualización Mac",
    description: "Genera release Mac y actualiza desktop/mac.",
    icon: MonitorDown
  },
  {
    target: "win",
    title: "Subir actualización Windows",
    description: "Genera instalador Windows y actualiza desktop/win.",
    icon: MonitorDown
  }
];

function getTargetLabel(target: DeployTarget): string {
  if (target === "pwa") return "PWA";
  if (target === "mac") return "Mac";
  return "Windows";
}

function getStatusLabel(status: DeployStatus): string {
  if (status === "triggered") return "Disparado";
  if (status === "running") return "Ejecutando";
  if (status === "success") return "Exitoso";
  return "Fallido";
}

function getStatusClasses(status: DeployStatus): string {
  if (status === "failed") {
    return "border-red-200 bg-red-50 text-red-700";
  }

  if (status === "success") {
    return "border-emerald-200 bg-emerald-50 text-emerald-700";
  }

  if (status === "running") {
    return "border-blue-200 bg-blue-50 text-blue-700";
  }

  return "border-amber-200 bg-amber-50 text-amber-700";
}

function formatDeployDate(value: string): string {
  if (!value) return "Sin fecha";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function extractVersionFromText(value: unknown): string | null {
  const raw = String(value || "").trim();

  if (!raw) return null;

  const patterns = [
    /(?:version|versión|versiones|release|tag|v)\s*[:#-]?\s*v?(\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?)/i,
    /\bv?(\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?)\b/i
  ];

  for (const pattern of patterns) {
    const match = raw.match(pattern);

    if (match?.[1]) {
      return match[1];
    }
  }

  return null;
}

function getJobVersion(job: DeployJob | null | undefined): string | null {
  if (!job) return null;

  return (
    job.version ||
    extractVersionFromText(job.message) ||
    extractVersionFromText(job.github_ref) ||
    extractVersionFromText(job.workflow_id) ||
    extractVersionFromText(job.error_message)
  );
}

function getResponseVersion(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;

  const record = data as Record<string, unknown>;

  return (
    extractVersionFromText(record.version) ||
    extractVersionFromText(record.next_version) ||
    extractVersionFromText(record.release_version) ||
    extractVersionFromText(record.app_version) ||
    extractVersionFromText(record.message)
  );
}

function getLastSuccessfulVersionByTarget(
  jobs: DeployJob[],
  target: DeployTarget
): string | null {
  const job = jobs.find((item) => item.target === target && item.status === "success");
  return getJobVersion(job);
}

function getMainVersion(jobs: DeployJob[]): string | null {
  const desktopJob = jobs.find(
    (job) => (job.target === "mac" || job.target === "win") && job.status === "success"
  );

  const anySuccessJob = jobs.find((job) => job.status === "success");

  return getJobVersion(desktopJob) || getJobVersion(anySuccessJob);
}

function getLatestJob(jobs: DeployJob[]): DeployJob | null {
  return jobs[0] || null;
}

function VersionMetricCard({
  label,
  value,
  tone = "slate",
  loading = false
}: {
  label: string;
  value: string;
  tone?: "orange" | "green" | "blue" | "red" | "slate";
  loading?: boolean;
}) {
  const toneClasses = {
    orange: "border-orange-200 bg-orange-50 text-nostur-orange",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    blue: "border-blue-200 bg-blue-50 text-blue-700",
    red: "border-red-200 bg-red-50 text-red-700",
    slate: "border-black/10 bg-[#f8fafc] text-[#64748b]"
  }[tone];

  return (
    <div className={["rounded-[14px] border p-3", toneClasses].join(" ")}>
      <div className="text-[10px] font-black uppercase tracking-[0.12em] opacity-80">
        {label}
      </div>

      <div className="mt-1 flex min-h-[22px] items-center gap-2 text-[14px] font-black text-[#172033]">
        {loading ? <Loader2 size={14} className="shrink-0 animate-spin" /> : null}
        <span className="truncate">{value}</span>
      </div>
    </div>
  );
}

export function DeployActionsPanel() {
  const [state, setState] = useState<DeployState>({
    loading: null,
    message: null,
    error: null
  });

  const [deployJobs, setDeployJobs] = useState<DeployJob[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [deployingVersion, setDeployingVersion] = useState<string | null>(null);

  const lastDeployByTarget = useMemo(() => {
    const map = new Map<DeployTarget, DeployJob>();

    deployJobs.forEach((job) => {
      if (!map.has(job.target)) {
        map.set(job.target, job);
      }
    });

    return map;
  }, [deployJobs]);

  const latestJob = useMemo(() => getLatestJob(deployJobs), [deployJobs]);
  const currentVersion = useMemo(() => getMainVersion(deployJobs), [deployJobs]);
  const latestJobVersion = useMemo(() => getJobVersion(latestJob), [latestJob]);

  const currentStatusLabel = useMemo(() => {
    if (state.loading) {
      const targetLabel = getTargetLabel(state.loading);

      if (deployingVersion) {
        return `Subiendo ${targetLabel} · v${deployingVersion}`;
      }

      return `Subiendo ${targetLabel}`;
    }

    if (latestJob) {
      return `${getTargetLabel(latestJob.target)} · ${getStatusLabel(latestJob.status)}`;
    }

    return "Sin actividad";
  }, [deployingVersion, latestJob, state.loading]);

  async function loadDeployHistory() {
    setHistoryLoading(true);
    setHistoryError(null);

    try {
      const { data, error } = await supabase
        .from("deploy_jobs")
       .select(
  [
    "id",
    "created_at",
    "updated_at",
    "tenant_slug",
    "target",
    "status",
    "version",
    "workflow_id",
            "github_owner",
            "github_repo",
            "github_ref",
            "github_actions_url",
            "triggered_by_email",
            "message",
            "error_message"
          ].join(",")
        )
        .order("created_at", { ascending: false })
        .limit(20);

      if (error) {
        throw error;
      }

      setDeployJobs(((data || []) as unknown) as DeployJob[]);
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : "No se pudo cargar el historial de deploys."
      );
    } finally {
      setHistoryLoading(false);
    }
  }

  useEffect(() => {
    void loadDeployHistory();
  }, []);

  async function triggerDeploy(target: DeployTarget) {
    if (state.loading) return;

    const lastTargetVersion = getLastSuccessfulVersionByTarget(deployJobs, target);
    const targetLabel = getTargetLabel(target);

    const confirmed = window.confirm(
      target === "pwa"
        ? `¿Querés publicar la PWA de NOSSIX ahora?${
            lastTargetVersion ? `\n\nÚltima versión detectada: v${lastTargetVersion}` : ""
          }`
        : `¿Querés generar y publicar la actualización ${targetLabel} ahora?${
            lastTargetVersion ? `\n\nÚltima versión detectada: v${lastTargetVersion}` : ""
          }`
    );

    if (!confirmed) return;

    setDeployingVersion(null);

    setState({
      loading: target,
      message: `Deploy iniciado para ${targetLabel}. Esperando número de versión...`,
      error: null
    });

    try {
      const { data, error } = await supabase.functions.invoke("trigger-github-deploy", {
        body: { target }
      });

      const responseVersion = getResponseVersion(data);

      if (responseVersion) {
        setDeployingVersion(responseVersion);
      }

      if (error) {
        throw new Error(error.message || "No se pudo disparar el deploy.");
      }

      if (data?.error) {
        throw new Error(String(data.error));
      }

      setState({
        loading: null,
        message: responseVersion
          ? `Deploy disparado correctamente para versión ${responseVersion}.`
          : data?.message || "Deploy disparado correctamente. La versión no fue informada por la función.",
        error: null
      });

      await loadDeployHistory();
    } catch (error) {
      setState({
        loading: null,
        message: null,
        error:
          error instanceof Error
            ? error.message
            : deployingVersion
              ? `No se pudo disparar el deploy de la versión ${deployingVersion}.`
              : "No se pudo disparar el deploy."
      });

      await loadDeployHistory();
    } finally {
      setDeployingVersion(null);
    }
  }

  return (
    <section className="rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold tracking-[-0.03em] text-[#172033]">
            Deploy NOSTUR NOSSIX
          </h3>
          <p className="mt-1 text-[12px] font-medium leading-relaxed text-[#64748b]">
            Ejecuta GitHub Actions para publicar la PWA o generar actualizaciones desktop.
          </p>
        </div>

        <div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#eef6f8] text-[#4f7c90]">
          <CloudUpload size={18} />
        </div>
      </div>

      {state.message ? (
        <div className="mb-3 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] font-semibold text-emerald-700">
          {state.message}
        </div>
      ) : null}

      {state.error ? (
        <div className="mb-3 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
          {state.error}
        </div>
      ) : null}

      <div className="mb-3 grid gap-2 md:grid-cols-4">
        <VersionMetricCard
          label="Versión actual"
          value={currentVersion ? `v${currentVersion}` : "No informada"}
          tone="slate"
        />

        <VersionMetricCard
          label="Versión en proceso"
          value={
            state.loading
              ? deployingVersion
                ? `v${deployingVersion}`
                : "Esperando dato"
              : "Sin deploy activo"
          }
          tone={state.loading ? "orange" : "slate"}
          loading={Boolean(state.loading)}
        />

        <VersionMetricCard
          label="Última subida"
          value={latestJobVersion ? `v${latestJobVersion}` : "No informada"}
          tone={latestJob?.status === "success" ? "green" : latestJob?.status === "failed" ? "red" : "slate"}
        />

        <VersionMetricCard
          label="Estado"
          value={currentStatusLabel}
          tone={
            state.loading
              ? "blue"
              : latestJob?.status === "success"
                ? "green"
                : latestJob?.status === "failed"
                  ? "red"
                  : "slate"
          }
          loading={Boolean(state.loading)}
        />
      </div>

      <div className="grid gap-2 md:grid-cols-3">
        {DEPLOY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const loading = state.loading === option.target;
          const disabled = Boolean(state.loading);
          const lastDeploy = lastDeployByTarget.get(option.target);
          const lastDeployVersion = getJobVersion(lastDeploy);

          return (
            <button
              key={option.target}
              type="button"
              disabled={disabled}
              onClick={() => void triggerDeploy(option.target)}
              className="group rounded-[16px] border border-black/10 bg-[#f8fafc] p-3 text-left transition hover:border-[#4f7c90]/40 hover:bg-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-[12px] bg-white text-[#4f7c90] shadow-sm">
                  {loading ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                </div>

                <RefreshCcw
                  size={14}
                  className="text-[#94a3b8] transition group-hover:text-[#4f7c90]"
                />
              </div>

              <div className="text-[13px] font-bold text-[#172033]">
                {loading ? `Subiendo ${getTargetLabel(option.target)}...` : option.title}
              </div>

              <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#64748b]">
                {option.description}
              </p>

              {loading ? (
                <div className="mt-3 rounded-[12px] border border-orange-200 bg-orange-50 px-2.5 py-2">
                  <div className="text-[10px] font-black uppercase tracking-[0.12em] text-nostur-orange">
                    Versión en subida
                  </div>
                  <div className="mt-1 text-[12px] font-black text-[#172033]">
                    {deployingVersion ? `v${deployingVersion}` : "Esperando respuesta de la función"}
                  </div>
                </div>
              ) : null}

              {!loading && lastDeploy ? (
                <div className="mt-3 rounded-[12px] border border-black/10 bg-white px-2.5 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.12em] text-[#94a3b8]">
                      Último
                    </span>

                    <span
                      className={[
                        "rounded-full border px-2 py-0.5 text-[10px] font-black",
                        getStatusClasses(lastDeploy.status)
                      ].join(" ")}
                    >
                      {getStatusLabel(lastDeploy.status)}
                    </span>
                  </div>

                  <div className="mt-1 text-[11px] font-semibold text-[#64748b]">
                    {formatDeployDate(lastDeploy.created_at)}
                  </div>

                  <div className="mt-1 text-[11px] font-black text-[#172033]">
                    Versión: {lastDeployVersion ? `v${lastDeployVersion}` : "No informada"}
                  </div>
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mt-4 rounded-[18px] border border-black/10 bg-[#f8fafc]">
        <button
          type="button"
          onClick={() => setHistoryOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-3 px-3 py-3 text-left"
        >
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-[13px] font-bold text-[#172033]">Control de versiones</h4>

              {latestJob ? (
                <span
                  className={[
                    "rounded-full border px-2 py-0.5 text-[10px] font-black",
                    getStatusClasses(latestJob.status)
                  ].join(" ")}
                >
                  Último: {getTargetLabel(latestJob.target)} · {getStatusLabel(latestJob.status)}
                </span>
              ) : null}
            </div>

            <p className="mt-0.5 truncate text-[11px] font-medium text-[#64748b]">
              {latestJob
                ? `${formatDeployDate(latestJob.created_at)}${
                    latestJobVersion ? ` · versión v${latestJobVersion}` : " · versión no informada"
                  }`
                : "Historial completo de deploys del tenant NOSSIX."}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {historyLoading ? <Loader2 size={14} className="animate-spin text-[#4f7c90]" /> : null}

            <ChevronDown
              size={16}
              className={[
                "text-[#64748b] transition",
                historyOpen ? "rotate-180" : ""
              ].join(" ")}
            />
          </div>
        </button>

        {historyOpen ? (
          <div className="border-t border-black/10 p-3">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-[13px] font-bold text-[#172033]">Últimos deploys</h4>
                <p className="text-[11px] font-medium text-[#64748b]">
                  Auditoría local del tenant NOSSIX.
                </p>
              </div>

              <button
                type="button"
                onClick={() => void loadDeployHistory()}
                disabled={historyLoading}
                className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-bold text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-60"
              >
                <RefreshCcw size={13} className={historyLoading ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>

            {historyError ? (
              <div className="rounded-[14px] border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                {historyError}
              </div>
            ) : null}

            {!historyError && deployJobs.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-black/15 bg-white px-3 py-4 text-center text-[12px] font-semibold text-[#94a3b8]">
                Todavía no hay deploys registrados.
              </div>
            ) : null}

            {deployJobs.length > 0 ? (
              <div className="grid max-h-[420px] gap-2 overflow-auto pr-1">
                {deployJobs.map((job) => {
                  const failed = job.status === "failed";
                  const running = job.status === "running" || job.status === "triggered";
                  const jobVersion = getJobVersion(job);

                  return (
                    <div
                      key={job.id}
                      className="rounded-[14px] border border-black/10 bg-white px-3 py-2 shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <div
                            className={[
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px]",
                              failed
                                ? "bg-red-50 text-red-700"
                                : running
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-emerald-50 text-emerald-700"
                            ].join(" ")}
                          >
                            {failed ? (
                              <AlertTriangle size={14} />
                            ) : running ? (
                              <Loader2 size={14} className="animate-spin" />
                            ) : (
                              <CheckCircle2 size={14} />
                            )}
                          </div>

                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[12px] font-black text-[#172033]">
                                {getTargetLabel(job.target)}
                              </span>

                              <span
                                className={[
                                  "rounded-full border px-2 py-0.5 text-[10px] font-black",
                                  getStatusClasses(job.status)
                                ].join(" ")}
                              >
                                {getStatusLabel(job.status)}
                              </span>

                              <span className="rounded-full border border-black/10 bg-[#f8fafc] px-2 py-0.5 text-[10px] font-black text-[#64748b]">
                                {jobVersion ? `v${jobVersion}` : "Versión no informada"}
                              </span>
                            </div>

                            <div className="mt-0.5 truncate text-[11px] font-semibold text-[#64748b]">
                              {formatDeployDate(job.created_at)}
                              {job.triggered_by_email ? ` · ${job.triggered_by_email}` : ""}
                              {job.workflow_id ? ` · ${job.workflow_id}` : ""}
                            </div>
                          </div>
                        </div>

                        {job.github_actions_url ? (
                          <a
                            href={job.github_actions_url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#eef6f8] px-2 text-[11px] font-bold text-[#4f7c90] transition hover:bg-[#dfeff3]"
                          >
                            <ExternalLink size={13} />
                            Actions
                          </a>
                        ) : null}
                      </div>

                      {job.message ? (
                        <div className="mt-2 text-[11px] font-semibold text-[#64748b]">
                          {job.message}
                        </div>
                      ) : null}

                      {job.error_message ? (
                        <div className="mt-2 max-h-20 overflow-auto rounded-[12px] border border-red-200 bg-red-50 px-2.5 py-2 text-[10px] font-semibold text-red-700">
                          {job.error_message}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
        El proceso corre en GitHub Actions. Puede tardar varios minutos.
      </p>
    </section>
  );
}