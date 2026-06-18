// src/components/config/DeployActionsPanel.tsx

import { useState } from "react";
import {
  CloudUpload,
  Loader2,
  MonitorDown,
  RefreshCcw,
  Smartphone
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type DeployTarget = "pwa" | "mac" | "win";

type DeployState = {
  loading: DeployTarget | null;
  message: string | null;
  error: string | null;
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

export function DeployActionsPanel() {
  const [state, setState] = useState<DeployState>({
    loading: null,
    message: null,
    error: null
  });

  async function triggerDeploy(target: DeployTarget) {
    if (state.loading) return;

    const confirmed = window.confirm(
      target === "pwa"
        ? "¿Querés publicar la PWA de NOSSIX ahora?"
        : `¿Querés generar y publicar la actualización ${target.toUpperCase()} ahora?`
    );

    if (!confirmed) return;

    setState({
      loading: target,
      message: null,
      error: null
    });

    try {
      const { data, error } = await supabase.functions.invoke("trigger-github-deploy", {
        body: { target }
      });

      if (error) {
        throw new Error(error.message || "No se pudo disparar el deploy.");
      }

      if (data?.error) {
        throw new Error(String(data.error));
      }

      setState({
        loading: null,
        message: data?.message || "Deploy disparado correctamente.",
        error: null
      });
    } catch (error) {
      setState({
        loading: null,
        message: null,
        error: error instanceof Error ? error.message : "No se pudo disparar el deploy."
      });
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

      <div className="grid gap-2 md:grid-cols-3">
        {DEPLOY_OPTIONS.map((option) => {
          const Icon = option.icon;
          const loading = state.loading === option.target;
          const disabled = Boolean(state.loading);

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

              <div className="text-[13px] font-bold text-[#172033]">{option.title}</div>
              <p className="mt-1 text-[11px] font-medium leading-relaxed text-[#64748b]">
                {option.description}
              </p>
            </button>
          );
        })}
      </div>

      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#94a3b8]">
        El proceso corre en GitHub Actions. Puede tardar varios minutos.
      </p>
    </section>
  );
}