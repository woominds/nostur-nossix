import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  BarChart3,
  Bell,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  MapPin,
  Plane,
  RefreshCcw,
  Target,
  TrendingUp,
  Trophy,
  Users,
  WalletCards,
  X
} from "lucide-react";
import {
  useTableroDeControlStore,
  type MetaAlmundoResumen,
  type MetaSucursalResumen,
  type PaxMovimiento,
  type RankingSimple,
  type RankingVendedor,
  type SerieSemana
} from "../../store/tableroDeControlStore";
import { useNotificacionesStore } from "../../store/notificacionesStore";

type RankingMode = "MENSUAL" | "HISTORICO";

type StatusType = "ok" | "pending" | "danger" | "neutral";

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre"
];

const WEEK_COLORS = [
  "bg-nostur-orange",
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-amber-500",
  "bg-cyan-500"
];

const DOT_COLORS = [
  "#ef4444",
  "#3b82f6",
  "#22c55e",
  "#f59e0b",
  "#a855f7",
  "#ec4899",
  "#14b8a6",
  "#64748b"
];

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(value: string | number | null | undefined, moneda: "ARS" | "USD" = "USD"): string {
  const parsed = parseMoney(value);

  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(parsed)} ${moneda}`;
}

function formatMoneyCompact(
  value: string | number | null | undefined,
  moneda: "ARS" | "USD" = "USD"
): string {
  const parsed = parseMoney(value);

  const formatted = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(parsed);

  return `${moneda === "USD" ? "US$" : "$"} ${formatted}`;
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getMonthLabel(mes: string, anio: string): string {
  const index = Number(mes) - 1;

  return `${MONTH_NAMES[index] || "Mes"} ${anio}`;
}

function getDotColor(index: number): string {
  return DOT_COLORS[index % DOT_COLORS.length];
}

function getProgress(actual: number, objetivo: number): number {
  if (objetivo <= 0) return 0;

  return Math.max(0, Math.min((actual / objetivo) * 100, 100));
}

function getObjetivoMensual(item: RankingVendedor): number {
  if (item.proximaMetaLabel === "Medio") return item.metaMedioUsd;

  if (item.proximaMetaLabel === "Logrado") return item.metaLogradoUsd;

  if (item.proximaMetaLabel === "Completada") return item.metaLogradoUsd;

  return item.metaPisoUsd;
}

function getEstadoSemanalLabel(estado: string): string {
  if (estado === "LOGRADO") return "Logrado";

  if (estado === "PENDIENTE") return "Bajo";

  return "Sin meta";
}

function getNivelLabel(nivel: string): string {
  if (nivel === "LOGRADO") return "Logrado";

  if (nivel === "MEDIO") return "Medio";

  if (nivel === "PISO") return "Piso";

  return "Bajo";
}

function getEstadoType(estado: string): StatusType {
  if (estado === "Logrado") return "ok";

  if (estado === "Medio") return "neutral";

  if (estado === "Piso") return "pending";

  if (estado === "Sin meta") return "neutral";

  return "danger";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={[
        "rounded-[24px] border border-black/10 bg-white/82 p-4 shadow-sm backdrop-blur",
        className
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function HeaderTitle({
  icon: Icon,
  title,
  subtitle,
  action
}: {
  icon: typeof BarChart3;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nostur-orange/12 text-nostur-orange">
          <Icon size={15} strokeWidth={2} />
        </div>

        <div className="min-w-0">
          <h3 className="truncate text-sm font-black text-[#111827]">{title}</h3>

          {subtitle ? (
            <p className="mt-0.5 truncate text-[11px] font-bold text-[#64748b]">{subtitle}</p>
          ) : null}
        </div>
      </div>

      {action}
    </div>
  );
}

function StatusBadge({ children, type }: { children: ReactNode; type: StatusType }) {
  const className = {
    ok: "border-green-200 bg-green-50 text-green-700",
    pending: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-red-200 bg-red-50 text-red-700",
    neutral: "border-slate-200 bg-slate-100 text-slate-600"
  }[type];

  return (
    <span
      className={[
        "inline-flex h-6 items-center justify-center rounded-xl border px-2.5 text-[10px] font-black uppercase tracking-wide",
        className
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function ProgressLine({
  value,
  color = "bg-nostur-orange"
}: {
  value: number;
  color?: string;
}) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="h-2 overflow-hidden rounded-full bg-[#e2e8f0]">
      <div
        className={["h-full rounded-full transition-all", color].join(" ")}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function KpiCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "blue"
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: typeof BarChart3;
  tone?: "blue" | "green" | "amber" | "red" | "slate" | "orange";
}) {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    slate: "bg-slate-50 text-slate-700",
    orange: "bg-nostur-orange/12 text-nostur-orange"
  }[tone];

  return (
    <Card className="min-h-[92px] p-3">
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]">
            {title}
          </p>

          <h2 className="mt-2 truncate text-[19px] font-black tracking-tight text-[#111827]">
            {value}
          </h2>

          <p className="mt-1 truncate text-[11px] font-bold text-[#64748b]">{subtitle}</p>
        </div>

        <div className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", toneClass].join(" ")}>
          <Icon size={16} strokeWidth={2} />
        </div>
      </div>
    </Card>
  );
}

function WeekBars({ data }: { data: SerieSemana[] }) {
  const max = Math.max(...data.map((item) => parseMoney(item.facturacionUsd)), 1);

  return (
    <div className="grid gap-3">
      <div className="grid h-[126px] grid-cols-5 gap-2">
        {data.slice(0, 5).map((item, index) => {
          const value = parseMoney(item.facturacionUsd);
          const height = Math.max(14, Math.round((value / max) * 100));
          const color = WEEK_COLORS[index % WEEK_COLORS.length];

          return (
            <div
              key={`${item.semana}-${item.desde}`}
              className="group relative flex min-w-0 flex-col items-center justify-end gap-2"
            >
              <div className="absolute -top-8 hidden rounded-xl bg-[#111827] px-3 py-2 text-[10px] font-black text-white shadow-xl group-hover:block">
                {formatMoney(value, "USD")}
              </div>

              <div className="flex h-[92px] w-full items-end rounded-2xl bg-[#eef2f7] p-1">
                <div className={["w-full rounded-xl", color].join(" ")} style={{ height: `${height}%` }} />
              </div>

              <div className="truncate text-[10px] font-black uppercase text-[#64748b]">
                {item.semana}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RankingTable({
  title,
  subtitle,
  icon: Icon,
  data,
  mode,
  compact = false
}: {
  title: string;
  subtitle: string;
  icon: typeof Trophy;
  data: RankingVendedor[];
  mode: "SEMANAL" | "MENSUAL";
  compact?: boolean;
}) {
  const visibleData = data.slice(0, compact ? 5 : 6);

  const gridCols = compact
    ? "grid-cols-[42px_minmax(170px,1.8fr)_112px_126px_104px_156px]"
    : "grid-cols-[48px_minmax(230px,2fr)_132px_150px_118px_180px]";

  return (
    <Card className={compact ? "min-h-[290px]" : "min-h-[360px]"}>
      <HeaderTitle icon={Icon} title={title} subtitle={subtitle} />

      <div className="overflow-x-auto rounded-[20px] border border-black/10 bg-[#f8fafc]">
        <div className="min-w-[820px]">
          <div
            className={[
              "grid items-center border-b border-black/10 bg-white/75 px-4 py-2 text-[10px] font-black uppercase tracking-[0.12em] text-[#64748b]",
              gridCols
            ].join(" ")}
          >
            <div>#</div>
            <div>Vendedor</div>
            <div className="text-right">Monto</div>
            <div className="pr-4 text-right">Objetivo</div>
            <div className="pl-4">Estado</div>
            <div className="text-right">Progreso</div>
          </div>

          {visibleData.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs font-bold text-[#64748b]">
              Sin datos para mostrar.
            </div>
          ) : (
            visibleData.map((item, index) => {
              const dotColor = getDotColor(index);
              const isWeekly = mode === "SEMANAL";

              const monto = isWeekly ? item.utilidadSemanalUsd : item.utilidadUsd;
              const objetivo = isWeekly ? item.metaSemanalUsd : getObjetivoMensual(item);
              const avance = isWeekly ? item.avanceSemanalPct : item.avanceMensualPct;
              const falta = isWeekly ? item.faltaSemanalUsd : item.faltaMensualUsd;

              const estadoLabel = isWeekly
                ? getEstadoSemanalLabel(item.estadoSemanal)
                : getNivelLabel(item.nivelMensual);

              const estadoType = getEstadoType(estadoLabel);

              const progresoColor =
                estadoLabel === "Logrado"
                  ? "bg-green-500"
                  : estadoLabel === "Medio"
                    ? "bg-blue-500"
                    : estadoLabel === "Piso"
                      ? "bg-amber-500"
                      : "bg-red-500";

              return (
                <div
                  key={`${mode}-${item.vendedorId || item.vendedor}-${index}`}
                  className={[
                    "grid items-center border-b border-black/5 px-4 py-3 last:border-0",
                    gridCols
                  ].join(" ")}
                >
                  <div className="text-xs font-black text-[#64748b]">#{index + 1}</div>

                  <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full"
                        style={{ backgroundColor: dotColor }}
                      />

                      <span className="truncate text-xs font-black text-[#111827]">
                        {item.vendedor}
                      </span>
                    </div>
                  </div>

                  <div className="text-right text-xs font-black text-[#111827]">
                    {formatMoneyCompact(monto, "USD")}
                  </div>

                  <div className="pr-4 text-right text-xs font-black text-[#64748b]">
                    {objetivo > 0 ? formatMoneyCompact(objetivo, "USD") : "Sin meta"}
                  </div>

                  <div className="pl-4">
                    <StatusBadge type={estadoType}>{estadoLabel}</StatusBadge>
                  </div>

                  <div className="min-w-0 text-right">
                    <div className="grid grid-cols-[minmax(74px,1fr)_42px] items-center gap-2">
                      <ProgressLine value={avance} color={progresoColor} />

                      <div className="text-right text-xs font-black text-[#334155]">
                        {Math.round(avance)}%
                      </div>
                    </div>

                    {falta > 0 && objetivo > 0 ? (
                      <div className="mt-1 text-[10px] font-black text-[#64748b]">
                        faltan {formatMoneyCompact(falta, "USD")}
                      </div>
                    ) : objetivo > 0 ? (
                      <div className="mt-1 text-[10px] font-black text-green-700">
                        meta lograda
                      </div>
                    ) : (
                      <div className="mt-1 text-[10px] font-black text-[#94a3b8]">
                        configurar meta
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </Card>
  );
}

function SucursalMetaCard({ item }: { item: MetaSucursalResumen }) {
  const progresoColor =
    item.proximaMetaLabel === "Completada"
      ? "bg-green-500"
      : item.proximaMetaLabel === "Logrado"
        ? "bg-green-500"
        : item.proximaMetaLabel === "Medio"
          ? "bg-blue-500"
          : item.proximaMetaLabel === "Piso"
            ? "bg-amber-500"
            : "bg-[#111827]";

  return (
    <div className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-[#111827]">{item.sucursal}</div>

          <div className="mt-0.5 text-[11px] font-bold text-[#64748b]">
            Utilidad: {formatMoney(item.actualUsd, "USD")}
          </div>
        </div>

        <div className="shrink-0 text-right">
          <div className="text-xs font-black text-nostur-orange">
            {Math.round(item.avancePct)}%
          </div>

          <div className="text-[10px] font-black text-[#64748b]">
            hacia {item.proximaMetaLabel}
          </div>
        </div>
      </div>

      <ProgressLine value={item.avancePct} color={progresoColor} />

      <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] font-black text-[#64748b]">
        <div>Piso {formatMoneyCompact(item.metaPisoUsd, "USD")}</div>
        <div className="text-center">Medio {formatMoneyCompact(item.metaMedioUsd, "USD")}</div>
        <div className="text-right">Logrado {formatMoneyCompact(item.metaLogradoUsd, "USD")}</div>
      </div>
    </div>
  );
}

function MetasSucursalPanel({ data }: { data: MetaSucursalResumen[] }) {
  return (
    <Card className="min-h-[360px]">
      <HeaderTitle
        icon={WalletCards}
        title="Metas de utilidad por sucursal"
        subtitle="Se calcula por utilidad: Carritos + Files"
      />

      <div className="grid gap-3">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-[#f8fafc] px-4 py-8 text-center text-xs font-bold text-[#64748b]">
            Sin metas de utilidad por sucursal para este período.
          </div>
        ) : (
          data.map((item) => (
            <SucursalMetaCard key={item.sucursalId || item.sucursal} item={item} />
          ))
        )}
      </div>
    </Card>
  );
}

function MetaAlmundoPanel({ data }: { data: MetaAlmundoResumen[] }) {
  const visible = data.filter((item) => item.objetivoUsd > 0 || item.actualUsd > 0);

  return (
    <Card className="min-h-[250px]">
      <HeaderTitle
        icon={Target}
        title="Meta Almundo"
        subtitle="Facturación de carritos únicamente, no incluye Files"
      />

      {visible.length === 0 ? (
        <div className="rounded-2xl bg-[#f8fafc] px-4 py-8 text-center text-xs font-bold text-[#64748b]">
          Sin meta Almundo cargada para este período.
        </div>
      ) : (
        <div className="grid gap-3">
          {visible.map((item) => (
            <div
              key={item.sucursalId || item.sucursal}
              className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3"
            >
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-xs font-black text-[#111827]">
                    {item.sucursal}
                  </div>

                  <div className="text-[11px] font-bold text-[#64748b]">
                    Actual {formatMoneyCompact(item.actualUsd, "USD")} · Meta{" "}
                    {formatMoneyCompact(item.objetivoUsd, "USD")}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="text-xs font-black text-nostur-orange">
                    {Math.round(item.avancePct)}%
                  </div>

                  <div className="text-[10px] font-black text-[#64748b]">
                    faltan {formatMoneyCompact(item.faltaUsd, "USD")}
                  </div>
                </div>
              </div>

              <ProgressLine value={item.avancePct} color="bg-nostur-orange" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

function RankingListPanel({
  title,
  subtitle,
  icon: Icon,
  data
}: {
  title: string;
  subtitle: string;
  icon: typeof MapPin;
  data: RankingSimple[];
}) {
  const max = Math.max(...data.map((item) => item.valor), 1);

  return (
    <Card className="min-h-[280px]">
      <HeaderTitle icon={Icon} title={title} subtitle={subtitle} />

      <div className="grid gap-2">
        {data.length === 0 ? (
          <div className="rounded-2xl border border-black/10 bg-[#f8fafc] px-4 py-8 text-center text-xs font-bold text-[#64748b]">
            Sin datos para mostrar.
          </div>
        ) : (
          data.slice(0, 7).map((item, index) => {
            const pct = getProgress(item.valor, max);

            return (
              <div key={`${title}-${item.nombre}`} className="rounded-2xl bg-[#f8fafc] p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: getDotColor(index) }}
                    />

                    <span className="truncate text-xs font-black text-[#111827]">
                      {item.nombre}
                    </span>
                  </div>

                  <span className="shrink-0 text-xs font-black text-[#334155]">
                    {item.valor}
                  </span>
                </div>

                <ProgressLine
                  value={pct}
                  color={
                    index === 0
                      ? "bg-nostur-orange"
                      : index === 1
                        ? "bg-blue-500"
                        : index === 2
                          ? "bg-green-500"
                          : "bg-slate-500"
                  }
                />
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function PaxPanel({
  saliendo,
  regresando
}: {
  saliendo: PaxMovimiento[];
  regresando: PaxMovimiento[];
}) {
  function renderList(items: PaxMovimiento[], empty: string) {
    if (items.length === 0) {
      return (
        <div className="rounded-2xl border border-black/10 bg-[#f8fafc] px-4 py-5 text-center text-xs font-bold text-[#64748b]">
          {empty}
        </div>
      );
    }

    return (
      <div className="grid gap-2">
        {items.slice(0, 4).map((item) => (
          <div
            key={item.id}
            className="flex min-h-[54px] items-center justify-between gap-3 rounded-2xl border border-black/5 bg-[#f8fafc] px-3 py-2"
          >
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-[#111827]">{item.pasajero}</div>

              <div className="mt-0.5 truncate text-[11px] font-bold text-[#64748b]">
                {item.destino} · {item.vendedor}
              </div>
            </div>

            <div className="shrink-0 rounded-xl bg-white px-2 py-1 text-[10px] font-black text-[#334155] shadow-sm">
              {formatDate(item.fecha)}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <Card className="min-h-[300px]">
      <HeaderTitle icon={Plane} title="Pasajeros próximos" subtitle="Salidas y regresos próximos" />

      <div className="grid gap-3">
        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-green-700">
            Pax saliendo
          </div>

          {renderList(saliendo, "Sin pasajeros próximos a salir.")}
        </div>

        <div>
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-amber-700">
            Pax regresando
          </div>

          {renderList(regresando, "Sin pasajeros próximos a regresar.")}
        </div>
      </div>
    </Card>
  );
}

function AvisosOperativosPanel() {
  const loading = useNotificacionesStore((state) => state.loading);
  const notificaciones = useNotificacionesStore((state) => state.notificaciones);
  const loadNotificaciones = useNotificacionesStore((state) => state.loadNotificaciones);
  const descartarNotificacion = useNotificacionesStore((state) => state.descartarNotificacion);

  useEffect(() => {
    loadNotificaciones();
  }, [loadNotificaciones]);

  if (!loading && notificaciones.length === 0) {
    return null;
  }

  return (
    <Card className="border-amber-200 bg-amber-50/80">
      <HeaderTitle
        icon={Bell}
        title="Avisos operativos"
        subtitle="Recordatorios activos de Home y Tablero de Control"
        action={
          <button
            type="button"
            onClick={loadNotificaciones}
            disabled={loading}
            className="flex h-8 items-center gap-2 rounded-xl bg-white/80 px-3 text-[11px] font-black text-[#334155] shadow-sm hover:bg-white disabled:opacity-50"
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-amber-200 bg-white/70 px-4 py-5 text-center text-xs font-bold text-[#92400e]">
          Cargando avisos operativos...
        </div>
      ) : (
        <div className="grid gap-2">
          {notificaciones.map((notificacion, index) => {
            const item = notificacion as unknown as {
              id?: string;
              notificacion_id?: string;
              clave?: string;
              titulo?: string;
              mensaje?: string;
              descripcion?: string;
              texto?: string;
              fechaReferencia?: string | null;
              fecha_referencia?: string | null;
              fecha_ingreso_gastos?: string | null;
            };

            const key =
              item.id ||
              item.notificacion_id ||
              item.clave ||
              `${item.titulo || "notificacion"}-${index}`;

            const mensaje =
              item.mensaje ||
              item.descripcion ||
              item.texto ||
              "Tenés un aviso pendiente para revisar.";

            const fechaReferencia =
              item.fechaReferencia ||
              item.fecha_referencia ||
              item.fecha_ingreso_gastos ||
              null;

            return (
              <div
                key={key}
                className="flex items-start justify-between gap-3 rounded-2xl border border-amber-200 bg-white/80 p-4 shadow-sm"
              >
                <div className="min-w-0">
                  <div className="text-sm font-black text-[#111827]">
                    {item.titulo || "Aviso operativo"}
                  </div>

                  <div className="mt-1 text-xs font-bold text-[#92400e]">
                    {mensaje}
                  </div>

                  {fechaReferencia ? (
                    <div className="mt-3 inline-flex rounded-xl bg-amber-100 px-3 py-1 text-[11px] font-black text-[#334155]">
                      Gastos {formatDate(fechaReferencia)}
                    </div>
                  ) : null}
                </div>

                <button
                  type="button"
                  onClick={() => descartarNotificacion(notificacion)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-[#64748b] shadow-sm hover:bg-red-50 hover:text-red-600"
                  title="Cerrar aviso"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function DashboardError({
  error,
  onClose
}: {
  error: string | null;
  onClose: () => void;
}) {
  if (!error) return null;

  return (
    <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-bold text-red-700">
      <span>{error}</span>

      <button
        type="button"
        onClick={onClose}
        className="text-red-500 transition hover:text-red-700"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function TableroControlPanel() {
  const loading = useTableroDeControlStore((state) => state.loading);
  const error = useTableroDeControlStore((state) => state.error);
  const filters = useTableroDeControlStore((state) => state.filters);
  const kpis = useTableroDeControlStore((state) => state.kpis);
  const serieSemanal = useTableroDeControlStore((state) => state.serieSemanal);
  const rankingVendedores = useTableroDeControlStore((state) => state.rankingVendedores);
  const metasSucursal = useTableroDeControlStore((state) => state.metasSucursal);
  const metasAlmundo = useTableroDeControlStore((state) => state.metasAlmundo);
  const destinosMensual = useTableroDeControlStore((state) => state.destinosMensual);
  const destinosHistorico = useTableroDeControlStore((state) => state.destinosHistorico);
  const serviciosMensual = useTableroDeControlStore((state) => state.serviciosMensual);
  const serviciosHistorico = useTableroDeControlStore((state) => state.serviciosHistorico);
  const paxSaliendo = useTableroDeControlStore((state) => state.paxSaliendo);
  const paxRegresando = useTableroDeControlStore((state) => state.paxRegresando);

  const loadTablero = useTableroDeControlStore((state) => state.loadTablero);
  const goToPreviousMonth = useTableroDeControlStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useTableroDeControlStore((state) => state.goToNextMonth);
  const clearError = useTableroDeControlStore((state) => state.clearError);

  const [destinosMode, setDestinosMode] = useState<RankingMode>("MENSUAL");
  const [serviciosMode, setServiciosMode] = useState<RankingMode>("MENSUAL");

  const destinosData = destinosMode === "MENSUAL" ? destinosMensual : destinosHistorico;
  const serviciosData = serviciosMode === "MENSUAL" ? serviciosMensual : serviciosHistorico;

  const rankingSemanal = useMemo(
    () =>
      [...rankingVendedores]
        .sort((a, b) => parseMoney(b.utilidadSemanalUsd) - parseMoney(a.utilidadSemanalUsd))
        .filter((item) => parseMoney(item.utilidadSemanalUsd) > 0 || parseMoney(item.metaSemanalUsd) > 0),
    [rankingVendedores]
  );

  const rankingMensual = useMemo(
    () =>
      [...rankingVendedores]
        .sort((a, b) => parseMoney(b.utilidadUsd) - parseMoney(a.utilidadUsd))
        .filter((item) => parseMoney(item.utilidadUsd) > 0 || parseMoney(item.metaPisoUsd) > 0),
    [rankingVendedores]
  );

  useEffect(() => {
    loadTablero();
  }, [loadTablero]);

  function reloadAfterMonthChange(callback: () => void) {
    callback();

    window.setTimeout(() => {
      loadTablero();
    }, 0);
  }

  return (
    <div className="h-full overflow-auto bg-[radial-gradient(circle_at_22%_10%,rgba(255,122,26,0.10),transparent_28%),radial-gradient(circle_at_78%_18%,rgba(90,120,190,0.13),transparent_30%),linear-gradient(135deg,#eef1f6,#e1e7f0_48%,#eef1f6)] px-5 py-4 text-[#1f2937]">
      <div className="mx-auto grid w-full max-w-[calc(100vw-90px)] gap-4">
        <header className="rounded-[24px] border border-black/10 bg-white/70 p-4 shadow-sm backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black tracking-tight text-[#111827]">
                  Tablero de Control
                </h1>

                <span className="rounded-xl bg-nostur-orange/12 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-nostur-orange">
                  Métricas reales
                </span>
              </div>

              <p className="mt-1 text-xs font-bold text-[#64748b]">
                Facturación, utilidad, metas, rankings, pasajeros y performance comercial.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => reloadAfterMonthChange(goToPreviousMonth)}
                className="flex h-9 items-center gap-2 rounded-xl bg-white/80 px-3 text-xs font-black text-[#334155] shadow-sm hover:bg-white"
              >
                <ChevronLeft size={14} />
                Anterior
              </button>

              <div className="flex h-9 items-center gap-2 rounded-xl bg-[#111827] px-4 text-xs font-black text-white shadow-sm">
                <CalendarDays size={14} />
                {getMonthLabel(filters.mes, filters.anio)}
              </div>

              <button
                type="button"
                onClick={() => reloadAfterMonthChange(goToNextMonth)}
                className="flex h-9 items-center gap-2 rounded-xl bg-white/80 px-3 text-xs font-black text-[#334155] shadow-sm hover:bg-white"
              >
                Siguiente
                <ChevronRight size={14} />
              </button>

              <button
                type="button"
                onClick={loadTablero}
                disabled={loading}
                className="flex h-9 items-center gap-2 rounded-xl bg-nostur-orange px-4 text-xs font-black text-white shadow-sm hover:bg-nostur-orangeSoft disabled:opacity-50"
              >
                <RefreshCcw size={14} />
                {loading ? "Actualizando..." : "Actualizar"}
              </button>
            </div>
          </div>
        </header>

        <DashboardError error={error} onClose={clearError} />

        <AvisosOperativosPanel />

        <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
         <KpiCard
  title="Facturación histórica"
  value={formatMoney(kpis.facturacionHistoricaUsd || 0, "USD")}
  subtitle={`${formatMoney(kpis.facturacionHistoricaArs || 0, "ARS")} total acumulado`}
  icon={WalletCards}
  tone="green"
/>

          <KpiCard
  title="Facturación del mes"
  value={formatMoney(kpis.facturacionMesUsd || 0, "USD")}
  subtitle={`${formatMoney(kpis.facturacionMesArs || 0, "ARS")} · Carritos + Files`}
  icon={FileText}
  tone="orange"
/>

          <KpiCard
            title="Utilidad mensual"
            value={formatMoney(kpis.utilidadTotalUsd, "USD")}
            subtitle="Base metas y comisiones"
            icon={TrendingUp}
            tone="green"
          />

          <KpiCard
            title="Ventas confirmadas"
            value={String(kpis.ventasConfirmadas)}
            subtitle={`${kpis.carritosConfirmados} carritos · ${kpis.filesConfirmados} files`}
            icon={Users}
            tone="blue"
          />

          <KpiCard
            title="Ticket promedio"
            value={formatMoney(kpis.ticketPromedioUsd, "USD")}
            subtitle="Facturación mensual / ventas"
            icon={DollarSign}
            tone="amber"
          />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="min-h-[250px]">
            <HeaderTitle
              icon={BarChart3}
              title="Facturación mensual por semana"
              subtitle="Hover sobre cada barra para ver el importe"
            />

            <WeekBars data={serieSemanal} />

            <div className="mt-4 grid gap-3 md:grid-cols-4">
              <div className="rounded-2xl bg-[#f8fafc] p-3">
                <div className="text-[10px] font-black uppercase text-[#64748b]">Carritos</div>

                <div className="mt-1 text-lg font-black text-[#111827]">
                  {kpis.carritosConfirmados}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f8fafc] p-3">
                <div className="text-[10px] font-black uppercase text-[#64748b]">Files</div>

                <div className="mt-1 text-lg font-black text-[#111827]">
                  {kpis.filesConfirmados}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f8fafc] p-3">
                <div className="text-[10px] font-black uppercase text-[#64748b]">
                  Ticket promedio
                </div>

                <div className="mt-1 text-lg font-black text-[#111827]">
                  {formatMoney(kpis.ticketPromedioUsd, "USD")}
                </div>
              </div>

              <div className="rounded-2xl bg-[#f8fafc] p-3">
                <div className="text-[10px] font-black uppercase text-[#64748b]">Utilidad</div>

                <div className="mt-1 text-lg font-black text-[#111827]">
                  {formatMoney(kpis.utilidadTotalUsd, "USD")}
                </div>
              </div>
            </div>
          </Card>

          <MetaAlmundoPanel data={metasAlmundo} />
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <RankingTable
            title="Top vendedores semana actual"
            subtitle="Ranking compacto semanal"
            icon={CalendarDays}
            data={rankingSemanal}
            mode="SEMANAL"
            compact
          />

          <Card className="min-h-[290px]">
            <HeaderTitle
              icon={CalendarDays}
              title="Top vendedores semana anterior"
              subtitle="Comparativo de la semana previa"
            />

            <div className="rounded-[20px] border border-black/10 bg-[#f8fafc] px-4 py-8 text-center text-xs font-bold text-[#64748b]">
              Sin datos para mostrar.
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.45fr_0.9fr]">
          <RankingTable
            title="Top vendedores del mes"
            subtitle="Utilidad mensual contra piso / medio / logrado"
            icon={Trophy}
            data={rankingMensual}
            mode="MENSUAL"
          />

          <MetasSucursalPanel data={metasSucursal} />
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <PaxPanel saliendo={paxSaliendo} regresando={paxRegresando} />

          <RankingListPanel
            title="Destinos vendidos"
            subtitle={destinosMode === "MENSUAL" ? "Ranking mensual" : "Ranking histórico"}
            icon={MapPin}
            data={destinosData}
          />

          <RankingListPanel
            title="Servicios vendidos"
            subtitle={serviciosMode === "MENSUAL" ? "Ranking mensual" : "Ranking histórico"}
            icon={Plane}
            data={serviciosData}
          />
        </section>

        <section className="flex flex-wrap justify-end gap-2 pb-2">
          <button
            type="button"
            onClick={() => setDestinosMode(destinosMode === "MENSUAL" ? "HISTORICO" : "MENSUAL")}
            className="h-8 rounded-xl bg-white/80 px-3 text-[11px] font-black text-[#334155] shadow-sm hover:bg-white"
          >
            Destinos: {destinosMode === "MENSUAL" ? "Mensual" : "Histórico"}
          </button>

          <button
            type="button"
            onClick={() => setServiciosMode(serviciosMode === "MENSUAL" ? "HISTORICO" : "MENSUAL")}
            className="h-8 rounded-xl bg-white/80 px-3 text-[11px] font-black text-[#334155] shadow-sm hover:bg-white"
          >
            Servicios: {serviciosMode === "MENSUAL" ? "Mensual" : "Histórico"}
          </button>
        </section>
      </div>
    </div>
  );
}