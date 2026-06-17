// src/modules/comunicaciones/ControlIaPanel.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  Flame,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Sparkles,
  TrendingUp,
  Users,
  Zap
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type Metrics = {
  conversaciones: number;
  mensajes: number;
  oportunidades: number;
  calientes: number;
  candeActivas: number;
};

type FutureMetric = {
  label: string;
  description: string;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "emerald" | "purple" | "slate" | "red";
};

function MiniMetric({
  label,
  value,
  hint,
  icon,
  tone = "slate"
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: React.ReactNode;
  tone?: "blue" | "amber" | "emerald" | "purple" | "slate" | "red";
}) {
  const toneClass =
    tone === "blue"
      ? "bg-sky-50 text-sky-700 ring-sky-100"
      : tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : tone === "emerald"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : tone === "purple"
            ? "bg-purple-50 text-purple-700 ring-purple-100"
            : tone === "red"
              ? "bg-red-50 text-red-700 ring-red-100"
              : "bg-slate-50 text-slate-600 ring-slate-100";

  return (
    <article className="rounded-[14px] border border-black/10 bg-white/62 px-3.5 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[10.5px] font-medium text-[#64748b]">{label}</div>

          <div className="mt-0.5 text-[20px] font-semibold tracking-tight text-[#172033]">
            {value}
          </div>

          {hint ? (
            <div className="mt-0.5 text-[10.5px] font-normal text-[#94a3b8]">{hint}</div>
          ) : null}
        </div>

        <div className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1", toneClass].join(" ")}>
          {icon}
        </div>
      </div>
    </article>
  );
}

function SoftCard({
  title,
  subtitle,
  children
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-black/10 bg-white/58 p-3.5 shadow-sm backdrop-blur-xl">
      <div className="mb-3">
        <h2 className="text-[14px] font-semibold leading-tight text-[#172033]">{title}</h2>

        {subtitle ? (
          <p className="mt-1 text-[11.5px] font-normal leading-relaxed text-[#64748b]">
            {subtitle}
          </p>
        ) : null}
      </div>

      {children}
    </section>
  );
}

function FutureMetricCard({ item }: { item: FutureMetric }) {
  const toneClass =
    item.tone === "blue"
      ? "bg-sky-50 text-sky-700 ring-sky-100"
      : item.tone === "amber"
        ? "bg-amber-50 text-amber-700 ring-amber-100"
        : item.tone === "emerald"
          ? "bg-emerald-50 text-emerald-700 ring-emerald-100"
          : item.tone === "purple"
            ? "bg-purple-50 text-purple-700 ring-purple-100"
            : item.tone === "red"
              ? "bg-red-50 text-red-700 ring-red-100"
              : "bg-slate-50 text-slate-600 ring-slate-100";

  return (
    <article className="rounded-[12px] border border-black/10 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex items-start gap-2.5">
        <div className={["flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1", toneClass].join(" ")}>
          {item.icon}
        </div>

        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold leading-tight text-[#172033]">
            {item.label}
          </div>

          <p className="mt-0.5 text-[11px] font-normal leading-relaxed text-[#64748b]">
            {item.description}
          </p>
        </div>
      </div>
    </article>
  );
}

function StatusAlert({
  type,
  children,
  onClose
}: {
  type: "error" | "success";
  children: React.ReactNode;
  onClose?: () => void;
}) {
  const className =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <div className={["flex items-start justify-between gap-3 rounded-[12px] border px-3 py-2.5 text-[12px] font-medium", className].join(" ")}>
      <div className="flex min-w-0 items-start gap-2">
        {type === "error" ? (
          <AlertTriangle size={14} className="mt-0.5 shrink-0" />
        ) : (
          <CheckCircle2 size={14} className="mt-0.5 shrink-0" />
        )}

        <span>{children}</span>
      </div>

      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 opacity-70 hover:opacity-100"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

export function ControlIaPanel() {
  const [loading, setLoading] = useState(false);
  const [metrics, setMetrics] = useState<Metrics>({
    conversaciones: 0,
    mensajes: 0,
    oportunidades: 0,
    calientes: 0,
    candeActivas: 0
  });
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [convRes, msgRes, oppRes, hotRes, candeRes] = await Promise.all([
      supabase.from("conversaciones").select("id", { count: "exact", head: true }),
      supabase.from("mensajes").select("id", { count: "exact", head: true }),
      supabase.from("lead_oportunidades").select("id", { count: "exact", head: true }),
      supabase.from("lead_oportunidades").select("id", { count: "exact", head: true }).gte("score", 70),
      supabase.from("lead_oportunidades").select("id", { count: "exact", head: true }).eq("cande_activa", true)
    ]);

    const firstError = convRes.error || msgRes.error || oppRes.error || hotRes.error || candeRes.error;

    if (firstError) {
      setError(firstError.message || "No se pudieron cargar las métricas.");
      setLoading(false);
      return;
    }

    setMetrics({
      conversaciones: convRes.count || 0,
      mensajes: msgRes.count || 0,
      oportunidades: oppRes.count || 0,
      calientes: hotRes.count || 0,
      candeActivas: candeRes.count || 0
    });

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const futureMetrics = useMemo<FutureMetric[]>(
    () => [
      {
        label: "Clientes esperando respuesta",
        description: "Conversaciones abiertas sin respuesta reciente del equipo.",
        icon: <Users size={14} />,
        tone: "blue"
      },
      {
        label: "Gap 24 horas",
        description: "Chats que superaron 24 horas sin gestión suficiente.",
        icon: <Clock3 size={14} />,
        tone: "amber"
      },
      {
        label: "Gap 48 horas",
        description: "Casos con demora crítica para alertar a vendedores o gerencia.",
        icon: <AlertTriangle size={14} />,
        tone: "red"
      },
      {
        label: "Primera respuesta",
        description: "Tiempo promedio desde ingreso hasta primera atención humana o IA.",
        icon: <Zap size={14} />,
        tone: "purple"
      },
      {
        label: "Intervención humana",
        description: "Casos donde Cande pidió derivar o detectó necesidad de asesor.",
        icon: <Bot size={14} />,
        tone: "emerald"
      },
      {
        label: "Ranking vendedores",
        description: "Actividad, respuesta, oportunidades tomadas y conversiones.",
        icon: <TrendingUp size={14} />,
        tone: "blue"
      },
      {
        label: "Uso de NIA",
        description: "Mensajes internos, consultas, reportes y acciones por usuario.",
        icon: <Sparkles size={14} />,
        tone: "purple"
      },
      {
        label: "Ganadas / perdidas",
        description: "Resultado comercial de oportunidades generadas por CANDE/NIA.",
        icon: <CheckCircle2 size={14} />,
        tone: "emerald"
      },
      {
        label: "Reactivadas",
        description: "Conversaciones dormidas que volvieron a tener actividad.",
        icon: <RefreshCcw size={14} />,
        tone: "slate"
      }
    ],
    []
  );

  const totalActividad = metrics.conversaciones + metrics.mensajes + metrics.oportunidades;
  const hotRatio =
    metrics.oportunidades > 0
      ? Math.round((metrics.calientes / metrics.oportunidades) * 100)
      : 0;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Control comercial IA
              </h1>

              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                Control
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Métricas operativas de atención, oportunidades y asistencia IA.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        {error ? (
          <div className="mb-3">
            <StatusAlert type="error" onClose={() => setError(null)}>
              {error}
            </StatusAlert>
          </div>
        ) : null}

        <div className="grid gap-2.5 md:grid-cols-5">
          <MiniMetric
            label="Conversaciones"
            value={metrics.conversaciones}
            icon={<MessageCircle size={14} />}
            tone="blue"
          />

          <MiniMetric
            label="Mensajes"
            value={metrics.mensajes}
            icon={<MessageCircle size={14} />}
            tone="slate"
          />

          <MiniMetric
            label="Oportunidades"
            value={metrics.oportunidades}
            icon={<Sparkles size={14} />}
            tone="purple"
          />

          <MiniMetric
            label="Calientes"
            value={metrics.calientes}
            hint="Score 70+"
            icon={<Flame size={14} />}
            tone="red"
          />

          <MiniMetric
            label="Cande activa"
            value={metrics.candeActivas}
            icon={<Bot size={14} />}
            tone="emerald"
          />
        </div>

        <div className="mt-3 grid gap-2.5 md:grid-cols-2">
          <SoftCard
            title="Lectura rápida"
            subtitle="Resumen simple del volumen que está moviendo la IA comercial."
          >
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                <div className="text-[10.5px] font-medium text-[#64748b]">Actividad total</div>
                <div className="mt-0.5 text-[18px] font-semibold text-[#172033]">
                  {totalActividad}
                </div>
              </div>

              <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                <div className="text-[10.5px] font-medium text-[#64748b]">Ratio caliente</div>
                <div className="mt-0.5 text-[18px] font-semibold text-[#172033]">
                  {hotRatio}%
                </div>
              </div>

              <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                <div className="text-[10.5px] font-medium text-[#64748b]">IA activa</div>
                <div className="mt-0.5 text-[18px] font-semibold text-[#172033]">
                  {metrics.candeActivas > 0 ? "Sí" : "No"}
                </div>
              </div>
            </div>
          </SoftCard>

          <SoftCard
            title="Estado operativo"
            subtitle="Panel base para empezar a medir atención, demoras y calidad comercial."
          >
            <div className="space-y-2 text-[12px] font-normal leading-relaxed text-[#475569]">
              <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                Cande y NIA ya están generando datos para conversaciones, mensajes y oportunidades.
              </div>

              <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                El próximo paso es cruzar tiempos de respuesta, estados comerciales y actividad por vendedor.
              </div>
            </div>
          </SoftCard>
        </div>

        <SoftCard
          title="Próximas métricas"
          subtitle="Indicadores que conviene activar para que NIA pueda alertar y reportar mejor."
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {futureMetrics.map((item) => (
              <FutureMetricCard key={item.label} item={item} />
            ))}
          </div>
        </SoftCard>

        {loading ? (
          <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex items-center gap-2 rounded-[12px] border border-black/10 bg-white px-3 py-2 text-[11px] font-medium text-[#475569] shadow-xl">
            <Loader2 size={14} className="animate-spin text-[#4f7c90]" />
            Actualizando métricas
          </div>
        ) : null}
      </main>
    </section>
  );
}