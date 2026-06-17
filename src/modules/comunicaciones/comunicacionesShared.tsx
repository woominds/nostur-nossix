import type { ReactNode } from "react";
import { RefreshCcw } from "lucide-react";

export type LoadingState = "idle" | "loading" | "error" | "success";

export function ComunicacionesPageShell({
  title,
  subtitle,
  badge,
  children,
  onRefresh,
  loading = false
}: {
  title: string;
  subtitle: string;
  badge?: string;
  children: ReactNode;
  onRefresh?: () => void;
  loading?: boolean;
}) {
  return (
    <section className="h-full min-h-0 overflow-hidden bg-[radial-gradient(circle_at_top_left,#d8f8ee_0,#eef3f8_34%,#f7f8fb_100%)]">
      <header className="flex items-center justify-between border-b border-black/10 bg-white/70 px-6 py-4 backdrop-blur-xl">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[20px] font-semibold tracking-tight text-[#172033]">
              {title}
            </h1>

            {badge ? (
              <span className="inline-flex h-5 items-center rounded-full bg-emerald-50 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-emerald-700">
                {badge}
              </span>
            ) : null}
          </div>

          <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">{subtitle}</p>
        </div>

        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-black/10 bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm transition hover:bg-[#f8fafc] disabled:opacity-60"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        ) : null}
      </header>

      <div className="h-[calc(100%-65px)] min-h-0 overflow-auto p-5">{children}</div>
    </section>
  );
}

export function EmptyState({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center rounded-[22px] border border-dashed border-black/10 bg-white/58 p-6 text-center shadow-sm">
      <div>
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f7f1] text-[17px] text-[#4f7c90]">
          ✦
        </div>

        <h3 className="text-[15px] font-semibold text-[#172033]">{title}</h3>

        <p className="mt-1 max-w-md text-[12px] font-normal leading-relaxed text-[#64748b]">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <article className="rounded-[20px] border border-black/10 bg-white/72 p-4 shadow-sm backdrop-blur-xl">
      <p className="text-[11px] font-medium text-[#64748b]">{label}</p>

      <p className="mt-1.5 text-[24px] font-semibold tracking-tight text-[#172033]">
        {value}
      </p>

      {hint ? <p className="mt-1 text-[11px] font-normal text-[#94a3b8]">{hint}</p> : null}
    </article>
  );
}

export function Pill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 max-w-full items-center rounded-md bg-slate-100/80 px-1.5 text-[10px] font-medium leading-none text-slate-500 ring-1 ring-slate-200/60">
      <span className="truncate">{children}</span>
    </span>
  );
}