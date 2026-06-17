// src/mobile/screens/MobileDashboard.tsx

import { useEffect } from "react";
import { CalendarDays, RefreshCcw, TrendingUp, Trophy, WalletCards } from "lucide-react";
import { useTableroDeControlStore } from "../../store/tableroDeControlStore";
import { formatMoneyAR } from "../../lib/formatters";

function MetricCard({
  title,
  value,
  subtitle,
  icon
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-[20px] border border-black/10 bg-white p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="truncate text-[9px] font-black uppercase tracking-[0.11em] text-[#64748b]">
          {title}
        </div>

        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nostur-orange/10 text-nostur-orange">
          {icon}
        </div>
      </div>

      <div className="truncate text-[17px] font-black leading-tight text-[#111827]">
        {value}
      </div>

      <div className="mt-0.5 truncate text-[10px] font-bold leading-tight text-[#64748b]">
        {subtitle}
      </div>
    </div>
  );
}

function ProgressLine({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
      <div className="h-full rounded-full bg-nostur-orange" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

export function MobileDashboard() {
  const loading = useTableroDeControlStore((state) => state.loading);
  const error = useTableroDeControlStore((state) => state.error);
  const filters = useTableroDeControlStore((state) => state.filters);
  const kpis = useTableroDeControlStore((state) => state.kpis);
  const rankingVendedores = useTableroDeControlStore((state) => state.rankingVendedores);
  const metasAlmundo = useTableroDeControlStore((state) => state.metasAlmundo);
  const loadTablero = useTableroDeControlStore((state) => state.loadTablero);

  useEffect(() => {
    loadTablero();
  }, [loadTablero]);

  return (
    <div className="min-h-full px-3 py-3">
      <section className="mb-3 rounded-[22px] border border-black/10 bg-[#172033] p-4 text-white shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-[0.12em] text-white/60">
              <CalendarDays size={12} />
              <span>
                {filters.mes}/{filters.anio}
              </span>
            </div>

            <h1 className="mt-2 text-[20px] font-black leading-tight">
              Dashboard
            </h1>

            <p className="mt-1.5 text-[12px] font-semibold leading-snug text-white/70">
              Vista simple para celular: facturación, utilidad, ventas y metas.
            </p>
          </div>

          <button
            type="button"
            onClick={loadTablero}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </section>

      {error ? (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-bold leading-snug text-red-700">
          {error}
        </div>
      ) : null}

      <section className="mb-3 grid grid-cols-1 gap-2.5">
        <MetricCard
          title="Facturación mes"
          value={`US$ ${formatMoneyAR(kpis.facturacionMesUsd || kpis.facturacionTotalUsd || 0)}`}
          subtitle={`ARS ${formatMoneyAR(kpis.facturacionMesArs || kpis.facturacionTotalArs || 0)}`}
          icon={<WalletCards size={16} strokeWidth={2} />}
        />

        <MetricCard
          title="Utilidad mensual"
          value={`US$ ${formatMoneyAR(kpis.utilidadTotalUsd || 0)}`}
          subtitle="Base para metas y comisiones"
          icon={<TrendingUp size={16} strokeWidth={2} />}
        />

        <MetricCard
          title="Ventas confirmadas"
          value={String(kpis.ventasConfirmadas || 0)}
          subtitle={`${kpis.carritosConfirmados || 0} carritos · ${kpis.filesConfirmados || 0} files`}
          icon={<Trophy size={16} strokeWidth={2} />}
        />
      </section>

      <section className="mb-3 rounded-[20px] border border-black/10 bg-white p-3 shadow-sm">
        <div className="mb-2 text-[13px] font-black leading-tight text-[#111827]">
          Meta Almundo
        </div>

        <div className="grid gap-2">
          {metasAlmundo.length === 0 ? (
            <div className="rounded-2xl bg-[#f8fafc] px-3 py-4 text-center text-[11px] font-bold text-[#64748b]">
              Sin metas Almundo cargadas.
            </div>
          ) : (
            metasAlmundo.map((item) => (
              <div key={item.sucursalId || item.sucursal} className="rounded-2xl bg-[#f8fafc] p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-black leading-tight text-[#111827]">
                      {item.sucursal}
                    </div>

                    <div className="mt-0.5 text-[10px] font-bold leading-tight text-[#64748b]">
                      US$ {formatMoneyAR(item.actualUsd)} / US$ {formatMoneyAR(item.objetivoUsd)}
                    </div>
                  </div>

                  <div className="shrink-0 text-[11px] font-black text-nostur-orange">
                    {Math.round(item.avancePct || 0)}%
                  </div>
                </div>

                <ProgressLine value={item.avancePct || 0} />
              </div>
            ))
          )}
        </div>
      </section>

      <section className="rounded-[20px] border border-black/10 bg-white p-3 shadow-sm">
        <div className="mb-2 text-[13px] font-black leading-tight text-[#111827]">
          Vendedores del mes
        </div>

        <div className="grid gap-2">
          {rankingVendedores.length === 0 ? (
            <div className="rounded-2xl bg-[#f8fafc] px-3 py-4 text-center text-[11px] font-bold text-[#64748b]">
              Sin ranking para mostrar.
            </div>
          ) : (
            rankingVendedores.slice(0, 6).map((item, index) => (
              <div
                key={`${item.vendedorId || item.vendedor}-${index}`}
                className="rounded-2xl bg-[#f8fafc] p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-black leading-tight text-[#111827]">
                      #{index + 1} {item.vendedor}
                    </div>

                    <div className="mt-0.5 text-[10px] font-bold leading-tight text-[#64748b]">
                      Utilidad US$ {formatMoneyAR(item.utilidadUsd)}
                    </div>
                  </div>

                  <div className="shrink-0 text-[11px] font-black text-[#334155]">
                    {Math.round(item.avanceMensualPct || 0)}%
                  </div>
                </div>

                <ProgressLine value={item.avanceMensualPct || 0} />
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}