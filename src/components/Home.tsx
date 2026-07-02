// src/components/Home.tsx

import { useEffect, useMemo, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  Bell,
  CalendarDays,
  Clock3,
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
import { appRegistry } from "../registry/appRegistry";
import { useBrowserStore } from "../store/browserStore";

import { useNotificacionesStore } from "../store/notificacionesStore";
import { useTableroDeControlStore } from "../store/tableroDeControlStore";
import { supabase } from "../lib/supabase";
import { formatMoneyAR } from "../lib/formatters";
import { brandAssets, brandText } from "../lib/brandAssets";

type TipoCambioResumen = {
  fechaVigente: string | null;
  tcVigente: number;
  mes: string;
  tcPromedioMensual: number;
  diasConTc: number;
  tcMinimo: number;
  tcMaximo: number;
};

type NotificacionAny = {
  id?: string;
  key?: string;
  tipo?: string;
  titulo?: string;
  mensaje?: string;
  descripcion?: string;
  prioridad?: string;
  origen?: string;
  origen_id?: string;
  numero_operacion?: string;
  pasajero?: string;
  fecha_objetivo?: string | null;
  fecha_ingreso_gastos?: string | null;
  dias_restantes?: number | null;
  metadata?: Record<string, unknown> | null;
};

type HomeRankingVendedor = {
  vendedorId?: string | null;
  vendedor?: string | null;
  utilidadUsd?: string | number | null;
  utilidadSemanalUsd?: string | number | null;
  metaSemanalUsd?: string | number | null;
  metaPisoUsd?: string | number | null;
  metaMedioUsd?: string | number | null;
  metaLogradoUsd?: string | number | null;
  avanceSemanalPct?: string | number | null;
  avanceMensualPct?: string | number | null;
};

type HomeMetaAlmundo = {
  sucursalId?: string | null;
  sucursal?: string | null;
  actualUsd?: string | number | null;
  objetivoUsd?: string | number | null;
  avancePct?: string | number | null;
  faltaUsd?: string | number | null;
};

type HomeMetaSucursal = {
  sucursalId?: string | null;
  sucursal?: string | null;
  actualUsd?: string | number | null;
  metaPisoUsd?: string | number | null;
  metaMedioUsd?: string | number | null;
  metaLogradoUsd?: string | number | null;
  avancePct?: string | number | null;
  proximaMetaLabel?: string | null;
  faltaUsd?: string | number | null;
};

type HomeAdminMontoResumen = {
  ars: number;
  usd: number;
  cantidad: number;
};

type HomeAdminResumen = {
  deudaOperadores: {
    total: HomeAdminMontoResumen;
    vencida: HomeAdminMontoResumen;
    proximos5Dias: HomeAdminMontoResumen;
  };
  facturasPagar: {
    proximos5Dias: HomeAdminMontoResumen;
    vencidas: HomeAdminMontoResumen;
  };
  facturasCobrar: {
    totalPendiente: HomeAdminMontoResumen;
    vencidas: HomeAdminMontoResumen;
    proximos5Dias: HomeAdminMontoResumen;
  };
  cajas: {
    totalArs: number;
    totalUsd: number;
    cantidad: number;
  };
};

type HomeRankingSimple = {
  nombre: string;
  valor: number;
};

type HomePaxMovimiento = {
  id: string;
  pasajero: string;
  destino?: string | null;
  vendedor?: string | null;
  fecha?: string | null;
};

function getToday(): string {
  const now = new Date();
  const argentinaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" })
  );

  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getFriendlyDate(): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Argentina/Cordoba"
  }).format(new Date());
}

function getCurrentTimeLabel(): string {
  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "America/Argentina/Cordoba"
  }).format(new Date());
}

function formatDateAR(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatUsd(value: string | number | null | undefined): string {
  return `US$ ${formatMoneyAR(parseMoney(value))}`;
}

function formatPct(value: string | number | null | undefined): string {
  return `${Math.round(parseMoney(value))}%`;
}

function normalizeAppKey(appId: string): string {
  if (appId === "presupuestos") return "presupuestos-v2";
  if (appId === "contactos") return "oportunidades";

  return appId;
}



function getNotificacionId(notificacion: NotificacionAny): string {
  return String(
    notificacion.id ||
      notificacion.key ||
      `${notificacion.tipo || "AVISO"}:${notificacion.origen || ""}:${
        notificacion.origen_id || notificacion.numero_operacion || ""
      }`
  );
}

function getNotificacionTitulo(notificacion: NotificacionAny): string {
  if (notificacion.titulo) return notificacion.titulo;

  if (notificacion.tipo === "CTA_CTE_INGRESO_GASTOS") {
    return "Cuenta corriente próxima a ingresar en gastos";
  }

  return "Aviso operativo";
}

function getNotificacionMensaje(notificacion: NotificacionAny): string {
  if (notificacion.mensaje) return notificacion.mensaje;
  if (notificacion.descripcion) return notificacion.descripcion;

  const pasajero = notificacion.pasajero || "el pasajero";
  const numero = notificacion.numero_operacion ? ` del carrito ${notificacion.numero_operacion}` : "";
  const fechaGastos = notificacion.fecha_ingreso_gastos || notificacion.fecha_objetivo || null;
  const fechaTexto = fechaGastos ? ` antes del ${formatDateAR(fechaGastos)}` : "";

  if (notificacion.tipo === "CTA_CTE_INGRESO_GASTOS") {
    return `Recordar que ${pasajero}${numero} debe cancelar el saldo${fechaTexto}.`;
  }

  return "Tenés un aviso pendiente para revisar.";
}

function clampProgress(value: string | number | null | undefined): number {
  return Math.max(0, Math.min(parseMoney(value), 100));
}

function getProgressTone(value: string | number | null | undefined): {
  bar: string;
  text: string;
  pill: string;
  label: "Bajo" | "Medio" | "Alto";
} {
  const percent = parseMoney(value);

  if (percent >= 70) {
    return {
      bar: "bg-emerald-500",
      text: "text-emerald-700",
      pill: "bg-emerald-50 text-emerald-700 ring-emerald-100",
      label: "Alto"
    };
  }

  if (percent >= 30) {
    return {
      bar: "bg-nostur-orange",
      text: "text-nostur-orange",
      pill: "bg-orange-50 text-nostur-orange ring-orange-100",
      label: "Medio"
    };
  }

  return {
    bar: "bg-sky-500",
    text: "text-sky-700",
    pill: "bg-sky-50 text-sky-700 ring-sky-100",
    label: "Bajo"
  };
}

function getDashboardMonthLabel(filters: { mes?: string; anio?: string }) {
  const mes = String(filters?.mes || "").padStart(2, "0");
  const anio = String(filters?.anio || "");

  const labels: Record<string, string> = {
    "01": "Enero",
    "02": "Febrero",
    "03": "Marzo",
    "04": "Abril",
    "05": "Mayo",
    "06": "Junio",
    "07": "Julio",
    "08": "Agosto",
    "09": "Septiembre",
    "10": "Octubre",
    "11": "Noviembre",
    "12": "Diciembre"
  };

  return `${labels[mes] || "Mes"} ${anio}`;
}

function ProgressLine({
  value,
  color
}: {
  value: number;
  color?: string;
}) {
  const safeValue = Math.max(0, Math.min(value, 100));
  const tone = getProgressTone(safeValue);
  const finalColor = color || tone.bar;

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e5eaf1]">
      <div
        className={["h-full rounded-full transition-all duration-500", finalColor].join(" ")}
        style={{ width: `${safeValue}%` }}
      />
    </div>
  );
}

function EmptyMiniState({ text = "Sin datos para mostrar." }: { text?: string }) {
  return (
    <div className="flex min-h-[92px] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-[#f8fafc] px-4 py-5 text-center text-[12px] font-medium text-[#64748b]">
      {text}
    </div>
  );
}

function HomeSectionTitle({
  title,
  action
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <h2 className="text-[15px] font-semibold leading-none text-[#172033]">{title}</h2>
      {action}
    </div>
  );
}

function SoftCard({
  children,
  className = ""
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={[
        "min-w-0 rounded-[22px] border border-white/70 bg-white/68 p-3.5 shadow-sm backdrop-blur-md",
        className
      ].join(" ")}
    >
      {children}
    </section>
  );
}

function CardHeader({
  title,
  icon
}: {
  title: string;
  icon: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center gap-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-nostur-orange/10 text-nostur-orange">
        {icon}
      </div>

      <h3 className="min-w-0 truncate text-[13px] font-semibold leading-none text-[#172033]">
        {title}
      </h3>
    </div>
  );
}

function KpiHomeCard({
  title,
  value,
  detail,
  icon,
  tone = "orange"
}: {
  title: string;
  value: ReactNode;
  detail: ReactNode;
  icon: ReactNode;
  tone?: "orange" | "green" | "blue" | "amber" | "slate";
}) {
  const toneClass = {
    orange: "bg-nostur-orange/10 text-nostur-orange",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    slate: "bg-slate-100 text-slate-700"
  }[tone];

  return (
    <SoftCard className="min-h-[118px]">
      <div className="flex h-full items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[12px] font-normal leading-none text-[#64748b]">
            {title}
          </div>

          <div className="mt-2 min-w-0 text-[20px] font-semibold tracking-tight text-[#111827]">
            {value}
          </div>

          {detail ? (
            <div className="mt-1 min-w-0 text-[11px] font-normal leading-tight text-[#64748b]">
              {detail}
            </div>
          ) : null}
        </div>

        <div
          className={["flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl", toneClass].join(
            " "
          )}
        >
          {icon}
        </div>
      </div>
    </SoftCard>
  );
}

function DualMoneyValue({
  usd,
  ars
}: {
  usd: string;
  ars: string;
}) {
  return (
    <div className="grid gap-0.5 leading-none">
      <div className="truncate text-[20px] font-semibold tracking-tight text-[#111827]">
        {usd}
      </div>
      <div className="truncate text-[20px] font-semibold tracking-tight text-[#111827]">
        {ars}
      </div>
    </div>
  );
}

function formatAdminDualMonto(monto: HomeAdminMontoResumen): string {
  const parts: string[] = [];

  if (monto.usd) parts.push(formatUsd(monto.usd));
  if (monto.ars) parts.push(`$ ${formatMoneyAR(monto.ars)}`);

  return parts.length > 0 ? parts.join(" · ") : "$ 0,00";
}

function AdminHomeCard({
  title,
  value,
  detail,
  tone = "slate"
}: {
  title: string;
  value: string;
  detail: string;
  tone?: "slate" | "red" | "amber" | "green" | "blue";
}) {
  const toneClass = {
    slate: "border-black/10 bg-white/70",
    red: "border-red-200 bg-red-50",
    amber: "border-amber-200 bg-amber-50",
    green: "border-emerald-200 bg-emerald-50",
    blue: "border-blue-200 bg-blue-50"
  }[tone];

  return (
    <div className={["rounded-[16px] border p-3 shadow-sm", toneClass].join(" ")}>
      <div className="text-[11px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
        {title}
      </div>
      <div className="mt-2 truncate text-[18px] font-semibold tracking-tight text-[#111827]">
        {value}
      </div>
      <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
        {detail}
      </div>
    </div>
  );
}

function DashboardHomeCard({
  title,
  icon,
  children
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <SoftCard className="min-h-[210px]">
      <CardHeader title={title} icon={icon} />
      {children}
    </SoftCard>
  );
}



function MetaAlmundoContent({ data }: { data: HomeMetaAlmundo[] }) {
  const visible = data.filter((item) => parseMoney(item.objetivoUsd) > 0 || parseMoney(item.actualUsd) > 0);

  if (visible.length === 0) {
    return <EmptyMiniState text="Sin meta Almundo cargada para este período." />;
  }

  return (
    <div className="grid gap-2">
      {visible.slice(0, 2).map((item) => {
        const avance = clampProgress(item.avancePct);
        const falta = parseMoney(item.faltaUsd);
        const tone = getProgressTone(avance);

        return (
          <div
            key={item.sucursalId || item.sucursal}
            className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
                  {item.sucursal || "Sucursal"}
                </div>

                <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                  {formatUsd(item.actualUsd)} / {formatUsd(item.objetivoUsd)}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={["text-[16px] font-semibold leading-none", tone.text].join(" ")}>
                  {formatPct(avance)}
                </div>
              </div>
            </div>

            <ProgressLine value={avance} />

            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-normal text-[#64748b]">
              <span>Falta</span>
              <span className={falta > 0 ? "text-amber-700" : "text-emerald-700"}>
                {falta > 0 ? formatUsd(falta) : "Meta lograda"}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MetasSucursalContent({ data }: { data: HomeMetaSucursal[] }) {
  const visible = data.filter(
    (item) =>
      parseMoney(item.actualUsd) > 0 ||
      parseMoney(item.metaPisoUsd) > 0 ||
      parseMoney(item.metaMedioUsd) > 0 ||
      parseMoney(item.metaLogradoUsd) > 0
  );

  if (visible.length === 0) {
    return <EmptyMiniState text="Sin metas por sucursal cargadas." />;
  }

  return (
    <div className="grid gap-2">
      {visible.slice(0, 3).map((item) => {
        const avance = clampProgress(item.avancePct);
        const tone = getProgressTone(avance);
        const objetivo =
          parseMoney(item.metaLogradoUsd) ||
          parseMoney(item.metaMedioUsd) ||
          parseMoney(item.metaPisoUsd);

        return (
          <div
            key={item.sucursalId || item.sucursal}
            className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
                  {item.sucursal || "Sucursal"}
                </div>

                <div className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                  {formatUsd(item.actualUsd)} / {objetivo > 0 ? formatUsd(objetivo) : "Sin meta"}
                </div>
              </div>

              <div className="shrink-0 text-right">
                <div className={["text-[16px] font-semibold leading-none", tone.text].join(" ")}>
                  {formatPct(avance)}
                </div>
              </div>
            </div>

            <ProgressLine value={avance} />

            <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px] font-normal text-[#64748b]">
              <span>{item.proximaMetaLabel || "Avance"}</span>
              <span>{parseMoney(item.faltaUsd) > 0 ? `Faltan ${formatUsd(item.faltaUsd)}` : "Meta lograda"}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}


function WeekRankingContent({ data }: { data: HomeRankingVendedor[] }) {
  const visible = data.slice(0, 4);


  if (visible.length === 0) {
    return <EmptyMiniState text="Sin ventas semanales para mostrar." />;
  }

  return (
    <div className="grid gap-2">
      {visible.map((item, index) => {
       const utilidad = parseMoney(item.utilidadSemanalUsd);

  const metaSemanal = parseMoney(item.metaSemanalUsd);

  const avanceSemanal = clampProgress(item.avanceSemanalPct);

  const progressValue = avanceSemanal > 0 ? avanceSemanal : 0;

  const tone = getProgressTone(avanceSemanal);

        return (
          <div
            key={`${item.vendedorId || item.vendedor}-week-${index}`}
            className="rounded-2xl border border-black/5 bg-[#f8fafc] p-2.5"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold",
                    index === 0
                      ? "bg-nostur-orange text-white"
                      : "bg-white text-[#334155] ring-1 ring-black/10"
                  ].join(" ")}
                >
                  #{index + 1}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
                    {item.vendedor || "Sin vendedor"}
                  </div>

                  <div className="text-[10px] font-normal text-[#64748b]">
                    Avance{" "}
                    <span className={["font-semibold", tone.text].join(" ")}>
                      {formatPct(avanceSemanal)}
                    </span>
                    {metaSemanal > 0 ? (
                      <span className="text-[#94a3b8]"> · Meta {formatUsd(metaSemanal)}</span>
                    ) : (
                      <span className="text-[#94a3b8]"> · Sin meta semanal</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right text-[12px] font-semibold text-[#111827]">
                {formatUsd(utilidad)}
              </div>
            </div>

            <ProgressLine value={progressValue} color={tone.bar} />
          </div>
        );
      })}
    </div>
  );
}

function MonthRankingContent({ data }: { data: HomeRankingVendedor[] }) {
  const visible = data.slice(0, 4);
  const max = Math.max(...visible.map((item) => parseMoney(item.utilidadUsd)), 1);

  if (visible.length === 0) {
    return <EmptyMiniState />;
  }

  return (
    <div className="grid gap-2">
      {visible.map((item, index) => {
        const utilidad = parseMoney(item.utilidadUsd);
        const avanceMensual = clampProgress(item.avanceMensualPct);
        const relativeFallback = Math.max(6, Math.min((utilidad / max) * 100, 100));
        const progressValue = avanceMensual > 0 ? avanceMensual : relativeFallback;
        const tone = getProgressTone(avanceMensual);

        return (
          <div
            key={`${item.vendedorId || item.vendedor}-${index}`}
            className="rounded-2xl border border-black/5 bg-[#f8fafc] p-2.5"
          >
            <div className="mb-2 flex items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className={[
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold",
                    index === 0
                      ? "bg-nostur-orange text-white"
                      : "bg-white text-[#334155] ring-1 ring-black/10"
                  ].join(" ")}
                >
                  #{index + 1}
                </div>

                <div className="min-w-0">
                  <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
                    {item.vendedor || "Sin vendedor"}
                  </div>

                  <div className="text-[10px] font-normal text-[#64748b]">
                    Avance <span className={["font-semibold", tone.text].join(" ")}>{formatPct(avanceMensual)}</span>
                  </div>
                </div>
              </div>

              <div className="shrink-0 text-right text-[12px] font-semibold text-[#111827]">
                {formatUsd(utilidad)}
              </div>
            </div>

            <ProgressLine value={progressValue} color={tone.bar} />
          </div>
        );
      })}
    </div>
  );
}

function SimpleChartCard({
  title,
  icon,
  data
}: {
  title: string;
  icon: ReactNode;
  data: HomeRankingSimple[];
}) {
  const visible = data.slice(0, 6);
  const max = Math.max(...visible.map((item) => parseMoney(item.valor)), 1);

  return (
    <SoftCard>
      <CardHeader title={title} icon={icon} />

      {visible.length === 0 ? (
        <EmptyMiniState />
      ) : (
        <div className="grid gap-2">
          {visible.map((item, index) => {
            const value = parseMoney(item.valor);
            const pct = Math.max(7, Math.min((value / max) * 100, 100));

            return (
              <div key={`${title}-${item.nombre}-${index}`} className="rounded-2xl bg-[#f8fafc] p-2.5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[11px] font-semibold",
                        index === 0
                          ? "bg-nostur-orange text-white"
                          : "bg-white text-[#334155] ring-1 ring-black/10"
                      ].join(" ")}
                    >
                      #{index + 1}
                    </div>

                    <div className="min-w-0 truncate text-[13px] font-semibold text-[#111827]">
                      {item.nombre}
                    </div>
                  </div>

                  <div className="shrink-0 text-[12px] font-normal text-[#64748b]">{value}</div>
                </div>

                <ProgressLine
                  value={pct}
                  color={
                    index === 0
                      ? "bg-nostur-orange"
                      : index === 1
                        ? "bg-blue-500"
                        : index === 2
                          ? "bg-emerald-500"
                          : "bg-slate-500"
                  }
                />
              </div>
            );
          })}
        </div>
      )}
    </SoftCard>
  );
}

function PaxHomeCard({
  title,
  icon,
  data,
  emptyText
}: {
  title: string;
  icon: ReactNode;
  data: HomePaxMovimiento[];
  emptyText: string;
}) {
  const visible = data.slice(0, 6);

  return (
    <SoftCard>
      <CardHeader title={title} icon={icon} />

      {visible.length === 0 ? (
        <EmptyMiniState text={emptyText} />
      ) : (
        <div className="grid gap-2">
          {visible.map((item) => (
            <div
              key={item.id}
              className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2"
            >
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold text-[#111827]">
                  {item.pasajero || "Pasajero"}
                </div>

                <div className="mt-0.5 truncate text-[11px] font-normal text-[#64748b]">
                  {item.destino || "Sin destino"} · {item.vendedor || "Sin vendedor"}
                </div>
              </div>

              <div className="shrink-0 rounded-xl bg-white px-2 py-1 text-[10px] font-normal text-[#334155] shadow-sm ring-1 ring-black/5">
                {formatDateAR(item.fecha)}
              </div>
            </div>
          ))}
        </div>
      )}
    </SoftCard>
  );
}

export function Home() {
  const createTab = useBrowserStore((state) => state.createTab);

  const loadTablero = useTableroDeControlStore((state) => state.loadTablero);
  const goToPreviousMonth = useTableroDeControlStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useTableroDeControlStore((state) => state.goToNextMonth);
  const filters = useTableroDeControlStore((state) => state.filters);
  const kpis = useTableroDeControlStore((state) => state.kpis);
  const currentProfile = useTableroDeControlStore((state) => state.currentProfile);
const adminResumen = useTableroDeControlStore((state) => state.adminResumen) as HomeAdminResumen;
  const rankingVendedores = useTableroDeControlStore(
    (state) => state.rankingVendedores
  ) as HomeRankingVendedor[];
  const metasAlmundo = useTableroDeControlStore((state) => state.metasAlmundo) as HomeMetaAlmundo[];
  const metasSucursal = useTableroDeControlStore((state) => state.metasSucursal) as HomeMetaSucursal[];
  const destinosMensual = useTableroDeControlStore((state) => state.destinosMensual) as HomeRankingSimple[];
  const serviciosMensual = useTableroDeControlStore((state) => state.serviciosMensual) as HomeRankingSimple[];
  const paxSaliendo = useTableroDeControlStore((state) => state.paxSaliendo) as HomePaxMovimiento[];
  const paxRegresando = useTableroDeControlStore((state) => state.paxRegresando) as HomePaxMovimiento[];
 

  const [currentTime, setCurrentTime] = useState(getCurrentTimeLabel());

  const notificacionesStore = useNotificacionesStore((state) => state as any);
  const notificaciones = Array.isArray(notificacionesStore.notificaciones)
    ? (notificacionesStore.notificaciones as NotificacionAny[])
    : [];
  const notificacionesLoading = Boolean(notificacionesStore.loading);
  const notificacionesError = notificacionesStore.error || null;

  const [notificacionesOpen, setNotificacionesOpen] = useState(false);

  const [tcLoading, setTcLoading] = useState(false);
  const [tcSaving, setTcSaving] = useState(false);
  const [tcError, setTcError] = useState<string | null>(null);
  const [tcFecha] = useState(getToday());
  const [tcValor, setTcValor] = useState("");
  const [tcFuente, setTcFuente] = useState("");
  const [tcObservaciones, setTcObservaciones] = useState("");
  const [tcResumen, setTcResumen] = useState<TipoCambioResumen | null>(null);

  const internalApps = useMemo(() => {
    const seen = new Set<string>();




    return appRegistry
      .filter((app) => app.url.startsWith("internal://"))
      .filter((app) => {
        const key = normalizeAppKey(app.id);

        if (seen.has(key)) return false;

        seen.add(key);

        return !["presupuestos", "contactos", "importador-catalogos"].includes(app.id);
      });
  }, []);

  const chatModules = useMemo(() => {
    return internalApps.filter((app) =>
      ["livenos", "oportunidades", "cande", "nia", "control-ia"].includes(app.id)
    );
  }, [internalApps]);

  const ventasModules = useMemo(() => {
    return internalApps.filter((app) =>
      ["clientes", "carritos", "files", "ctas-ctes", "presupuestos-v2", "comisiones"].includes(
        app.id
      )
    );
  }, [internalApps]);

  const administracionModules = useMemo(() => {
    return internalApps.filter((app) =>
      [
        "caja",
        "control-ventas",
        "facturas-pagar",
        "cashflow",
        "facturas-cobrar",
        "metas",
        "pagos-operadores",
        "riesgos"
      ].includes(app.id)
    );
  }, [internalApps]);

  const operacionesModules = useMemo(() => {
    return internalApps.filter((app) =>
      [
        "calendario-pax",
        "horarios",
        "pendientes",
        "documentos",
        "colaborativo",
        "links-utiles"
      ].includes(app.id)
    );
  }, [internalApps]);

const rankingSemanalActual = useMemo(() => {
  return [...rankingVendedores]
    .sort((a, b) => {
      const utilidadDiff = parseMoney(b.utilidadSemanalUsd) - parseMoney(a.utilidadSemanalUsd);

      if (Math.abs(utilidadDiff) > 0.009) return utilidadDiff;

      return parseMoney(b.avanceSemanalPct) - parseMoney(a.avanceSemanalPct);
    })
    .slice(0, 4);
}, [rankingVendedores]);

  const rankingMensual = useMemo(() => {
    return [...rankingVendedores]
      .sort((a, b) => parseMoney(b.utilidadUsd) - parseMoney(a.utilidadUsd))
      .filter((item) => parseMoney(item.utilidadUsd) > 0 || parseMoney(item.metaPisoUsd) > 0);
  }, [rankingVendedores]);

  const tcPromedioMensual = useMemo(() => {
    return tcResumen?.tcPromedioMensual || 0;
  }, [tcResumen]);

  const tcDelDia = useMemo(() => {
    return tcResumen?.tcVigente || 0;
  }, [tcResumen]);

  async function loadTipoCambio(fecha = tcFecha) {
    setTcLoading(true);
    setTcError(null);

    const mes = `${fecha.slice(0, 7)}-01`;

    const { data: tcVigenteData, error: errorVigente } = await supabase
      .from("tipos_cambio_diarios")
      .select("id, fecha, valor_usd_ars, fuente, observaciones, created_at")
      .lte("fecha", fecha)
      .eq("moneda_origen", "USD")
      .eq("moneda_destino", "ARS")
      .order("fecha", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (errorVigente) {
      setTcError(errorVigente.message || "No se pudo cargar el TC vigente.");
      setTcLoading(false);
      return;
    }

    const { data: promedioMensualData, error: errorPromedioMensual } = await supabase
      .from("vw_tc_promedio_mensual")
      .select("mes, tc_promedio_mensual, dias_con_tc, tc_minimo, tc_maximo")
      .eq("mes", mes)
      .maybeSingle();

    if (errorPromedioMensual) {
      setTcError(errorPromedioMensual.message || "No se pudo cargar el TC promedio mensual.");
      setTcLoading(false);
      return;
    }

    setTcResumen({
      fechaVigente: tcVigenteData?.fecha || null,
      tcVigente: parseMoney(tcVigenteData?.valor_usd_ars),
      mes,
      tcPromedioMensual: parseMoney(promedioMensualData?.tc_promedio_mensual),
      diasConTc: Number(promedioMensualData?.dias_con_tc || 0),
      tcMinimo: parseMoney(promedioMensualData?.tc_minimo),
      tcMaximo: parseMoney(promedioMensualData?.tc_maximo)
    });

    setTcLoading(false);
  }

  async function loadNotificacionesHome() {
    if (typeof notificacionesStore.loadNotificaciones === "function") {
      await notificacionesStore.loadNotificaciones();
      return;
    }

    if (typeof notificacionesStore.load === "function") {
      await notificacionesStore.load();
      return;
    }

    if (typeof notificacionesStore.refresh === "function") {
      await notificacionesStore.refresh();
    }
  }

  async function descartarNotificacion(notificacion: NotificacionAny) {
    const id = getNotificacionId(notificacion);

    if (typeof notificacionesStore.descartarNotificacion === "function") {
      await notificacionesStore.descartarNotificacion(id);
      return;
    }

    if (typeof notificacionesStore.descartar === "function") {
      await notificacionesStore.descartar(id);
      return;
    }

    if (typeof notificacionesStore.dismiss === "function") {
      await notificacionesStore.dismiss(id);
    }
  }

  async function handleSaveTipoCambio(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const valor = parseMoney(tcValor);

    if (valor <= 0) {
      setTcError("Ingresá un tipo de cambio válido.");
      return;
    }

    setTcSaving(true);
    setTcError(null);

    const { data: userData } = await supabase.auth.getUser();

    const { error } = await supabase.from("tipos_cambio_diarios").insert({
      fecha: tcFecha,
      moneda_origen: "USD",
      moneda_destino: "ARS",
      valor_usd_ars: valor,
      fuente: tcFuente.trim() || "Manual NOSTUR",
      observaciones: tcObservaciones.trim() || null,
      created_by: userData.user?.id || null
    });

    if (error) {
      setTcError(error.message || "No se pudo guardar el tipo de cambio.");
      setTcSaving(false);
      return;
    }

    setTcValor(String(valor).replace(".", ","));
    setTcFuente("");
    setTcObservaciones("");
    await loadTipoCambio(tcFecha);
    setTcSaving(false);
  }

  function handleOpenApp(app: { id: string; url: string; name: string }) {
    const appId = normalizeAppKey(app.id);
    const url = app.id === "presupuestos" ? "internal://presupuestos-v2" : app.url;

    createTab({
      appId,
      url,
      title: app.name,
      activate: true
    });
  }

  function reloadDashboardAfterPeriodChange(action: () => void) {
    action();

    window.setTimeout(() => {
      void loadTablero();
    }, 0);
  }

  useEffect(() => {
    void loadTipoCambio(tcFecha);
  }, [tcFecha]);

  useEffect(() => {
    void loadTablero();
  }, [loadTablero]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setCurrentTime(getCurrentTimeLabel());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    void loadNotificacionesHome();
  }, []);

  const friendlyDate = getFriendlyDate();

  const canViewAdminHome =
    Boolean(currentProfile?.activo) &&
    (currentProfile?.rol === "gerencia" ||
      currentProfile?.rol === "admin_general" ||
      Boolean(currentProfile?.is_support_user) ||
      Boolean(currentProfile?.is_super_admin));

  function renderTipoCambioWidget() {
    return (
      <form
        onSubmit={handleSaveTipoCambio}
        className="flex h-9 min-w-0 items-center justify-end gap-1.5 rounded-2xl bg-white/45 px-2 py-1 text-xs font-normal text-[#475569] shadow-sm ring-1 ring-white/70"
      >
        <div className="flex items-center gap-1.5 whitespace-nowrap font-medium text-[#172033]">
          <DollarSign size={13} className="text-[#ff7a1a]" strokeWidth={2} />
          T.C.
        </div>

        <input
          value={tcValor}
          onChange={(event) => setTcValor(event.target.value)}
          placeholder="1 USD"
          inputMode="decimal"
          className="h-7 w-[78px] rounded-xl border border-white/70 bg-white/70 px-2 text-[10.5px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#ff7a1a]"
        />

        <button
          type="submit"
          disabled={tcSaving}
          className="h-7 rounded-xl bg-gradient-to-r from-[#ff7a1a] to-[#ff2f76] px-2.5 text-[10px] font-semibold text-white shadow-sm hover:brightness-105 disabled:opacity-50"
        >
          {tcSaving ? "..." : "OK"}
        </button>

        <button
          type="button"
          onClick={() => loadTipoCambio(tcFecha)}
          disabled={tcLoading}
          className="flex h-7 w-7 items-center justify-center rounded-xl bg-white/70 text-[#64748b] shadow-sm hover:bg-white disabled:opacity-50"
          title="Actualizar promedio"
        >
          <RefreshCcw size={12} strokeWidth={1.8} className={tcLoading ? "animate-spin" : ""} />
        </button>

        <span className="hidden whitespace-nowrap rounded-xl bg-white/85 px-2 py-1 font-normal text-[#172033] ring-1 ring-black/5 2xl:inline">
          Vigente: $ {formatMoneyAR(tcDelDia || parseMoney(tcValor))}
        </span>

        <span
          className="whitespace-nowrap rounded-xl bg-orange-500/10 px-2 py-1 font-normal text-[#172033]"
          title={
            tcResumen
              ? `Promedio mensual · ${tcResumen.diasConTc} días · Min ${formatMoneyAR(
                  tcResumen.tcMinimo
                )} · Max ${formatMoneyAR(tcResumen.tcMaximo)}`
              : "Promedio mensual"
          }
        >
          Prom. mes: $ {formatMoneyAR(tcPromedioMensual)}
        </span>

        {tcError ? (
          <span className="absolute right-4 top-[58px] rounded-xl bg-red-50 px-2 py-1 text-[10px] font-medium text-red-600 shadow-sm ring-1 ring-red-100">
            {tcError}
          </span>
        ) : null}
      </form>
    );
  }

  function renderModuleColumn(title: string, items: typeof internalApps, color: string) {
    return (
      <section className="min-w-0 rounded-[22px] border border-white/70 bg-white/62 p-3.5 shadow-sm backdrop-blur-md">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          <h3 className="text-[13px] font-semibold leading-none text-[#263f60]">{title}</h3>
        </div>

        <div className="grid gap-1">
          {items.map((app) => (
            <button
              key={app.id}
              type="button"
              onClick={() => handleOpenApp(app)}
              className="flex h-8 items-center justify-between rounded-xl px-2.5 text-left text-[12px] font-normal text-[#253247] transition hover:bg-white/90"
            >
              <span className="truncate">{app.name}</span>
              <span className="text-[10px] font-normal text-[#8a9aad]">Abrir</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  return (
    <div className="relative h-full overflow-auto bg-[radial-gradient(circle_at_12%_8%,rgba(255,122,26,0.12),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(255,47,118,0.09),transparent_30%),radial-gradient(circle_at_48%_94%,rgba(147,197,253,0.18),transparent_34%),linear-gradient(135deg,#f7fbfc,#eff8f8_48%,#f4f8ff)] px-6 py-4 text-[#172033]">

      <div className="mx-auto w-full max-w-[1840px]">
        <header className="mb-4 flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="min-w-0">
              <img
                src={brandAssets.logoColorNegro}
                alt={`${brandText.appName} - ${brandText.appDescription}`}
                className="h-auto max-h-[46px] w-[292px] max-w-full object-contain object-left"
                draggable={false}
              />
            </div>
          </div>

          <div className="relative flex flex-wrap items-center justify-end gap-2">
            <div className="hidden items-center gap-2 rounded-2xl bg-white/45 px-2 py-1 text-xs font-normal text-[#475569] ring-1 ring-white/70 md:flex">
              <CalendarDays size={14} className="text-[#ff7a1a]" strokeWidth={1.8} />
              <span className="capitalize">{friendlyDate}</span>
            </div>

            <div className="hidden items-center gap-2 rounded-2xl bg-white/45 px-2 py-1 text-xs font-normal text-[#475569] ring-1 ring-white/70 md:flex">
              <Clock3 size={15} className="text-[#ff7a1a]" strokeWidth={1.8} />
              <span>Córdoba · {currentTime}</span>
            </div>

            {renderTipoCambioWidget()}

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotificacionesOpen((current) => !current)}
                className="relative flex h-9 w-9 items-center justify-center rounded-2xl bg-white/55 text-[#334155] shadow-sm ring-1 ring-white/70 transition hover:bg-white/85"
                title="Notificaciones"
              >
                <Bell size={15} strokeWidth={1.8} />

                {notificaciones.length > 0 ? (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff2f76] px-1 text-[10px] font-semibold text-white shadow-sm">
                    {notificaciones.length > 9 ? "9+" : notificaciones.length}
                  </span>
                ) : (
                  <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-[#94a3b8]" />
                )}
              </button>

              {notificacionesOpen ? (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-[80] cursor-default bg-transparent"
                    onClick={() => setNotificacionesOpen(false)}
                    tabIndex={-1}
                  />

                  <div className="absolute right-0 top-11 z-[120] w-[390px] overflow-hidden rounded-[24px] border border-black/10 bg-white shadow-2xl">
                    <div className="flex items-start justify-between gap-3 border-b border-black/10 bg-[#f8fafc] px-4 py-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#111827]">Notificaciones</h3>
                      </div>

                      <button
                        type="button"
                        onClick={() => loadNotificacionesHome()}
                        disabled={notificacionesLoading}
                        className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-white hover:text-[#111827] disabled:opacity-50"
                        title="Actualizar"
                      >
                        <RefreshCcw
                          size={14}
                          strokeWidth={1.8}
                          className={notificacionesLoading ? "animate-spin" : ""}
                        />
                      </button>
                    </div>

                    {notificacionesError ? (
                      <div className="m-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700">
                        {notificacionesError}
                      </div>
                    ) : null}

                    {notificacionesLoading && notificaciones.length === 0 ? (
                      <div className="p-5 text-center text-xs font-normal text-[#64748b]">
                        Cargando avisos...
                      </div>
                    ) : notificaciones.length === 0 ? (
                      <div className="p-5 text-center text-xs font-normal text-[#64748b]">
                        No tenés avisos pendientes.
                      </div>
                    ) : (
                      <div className="max-h-[410px] overflow-auto p-2">
                        {notificaciones.map((notificacion) => (
                          <div
                            key={getNotificacionId(notificacion)}
                            className="mb-2 rounded-2xl border border-amber-200 bg-amber-50/75 p-3 last:mb-0"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-xs font-semibold text-[#111827]">
                                  {getNotificacionTitulo(notificacion)}
                                </div>

                                <div className="mt-1 text-[11px] font-normal leading-relaxed text-[#92400e]">
                                  {getNotificacionMensaje(notificacion)}
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => descartarNotificacion(notificacion)}
                                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-white/80 text-[#64748b] hover:bg-red-50 hover:text-red-600"
                                title="Descartar aviso"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="border-t border-black/10 bg-[#f8fafc] px-4 py-3">
                      <button
                        type="button"
                        onClick={() => {
                          setNotificacionesOpen(false);
                          void loadNotificacionesHome();
                        }}
                        className="h-9 w-full rounded-xl bg-gradient-to-r from-[#ff7a1a] to-[#ff2f76] text-xs font-semibold text-white hover:brightness-105"
                      >
                        Actualizar avisos
                      </button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="grid gap-4">
          <section>
            <HomeSectionTitle
              title="Dashboard comercial"
              action={
                <div className="flex items-center gap-1.5 rounded-2xl bg-white/60 p-1 shadow-sm ring-1 ring-white/80">
                  <button
                    type="button"
                    onClick={() => reloadDashboardAfterPeriodChange(goToPreviousMonth)}
                    className="h-8 rounded-xl px-3 text-[11px] font-medium text-[#64748b] hover:bg-white hover:text-[#172033]"
                  >
                    Mes anterior
                  </button>

                  <div className="flex h-8 min-w-[126px] items-center justify-center rounded-xl bg-[#172033] px-3 text-[11px] font-medium text-white shadow-sm">
                    {getDashboardMonthLabel(filters)}
                  </div>

                  <button
                    type="button"
                    onClick={() => reloadDashboardAfterPeriodChange(goToNextMonth)}
                    className="h-8 rounded-xl px-3 text-[11px] font-medium text-[#64748b] hover:bg-white hover:text-[#172033]"
                  >
                    Próximo
                  </button>
                </div>
              }
            />

            <div className="mb-3 grid gap-3 md:grid-cols-2 2xl:grid-cols-5">
  <KpiHomeCard
  title="Facturación histórica"
  value={
    <DualMoneyValue
      usd={formatUsd(kpis.facturacionHistoricaUsd || 0)}
      ars={`$ ${formatMoneyAR(kpis.facturacionHistoricaArs || 0)}`}
    />
  }
  detail="Importes originales"
  icon={<WalletCards size={16} strokeWidth={2} />}
  tone="green"
/>

<KpiHomeCard
  title="Facturación del mes"
  value={
    <DualMoneyValue
      usd={formatUsd(kpis.facturacionMesUsd || 0)}
      ars={`$ ${formatMoneyAR(kpis.facturacionMesArs || 0)}`}
    />
  }
  detail="Importes originales"
  icon={<FileText size={16} strokeWidth={2} />}
  tone="orange"
/>

<KpiHomeCard
  title="Utilidad mensual"
  value={
    <DualMoneyValue
      usd={formatUsd(kpis.utilidadTotalUsd || 0)}
      ars={`$ ${formatMoneyAR(kpis.utilidadTotalArs || 0)}`}
    />
  }
  detail="Base metas y comisiones"
  icon={<TrendingUp size={16} strokeWidth={2} />}
  tone="green"
/>

              <KpiHomeCard
                title="Ventas confirmadas"
                value={String(kpis.ventasConfirmadas || 0)}
                detail={`${kpis.carritosConfirmados || 0} carritos · ${kpis.filesConfirmados || 0} files`}
                icon={<Users size={16} strokeWidth={2} />}
                tone="blue"
              />

<KpiHomeCard
  title="Ticket promedio"
  value={
    <DualMoneyValue
      usd={formatUsd(kpis.ticketPromedioUsd || 0)}
      ars={`$ ${formatMoneyAR(kpis.ticketPromedioArs || 0)}`}
    />
  }
  detail="Facturación mensual / ventas por moneda"
  icon={<DollarSign size={16} strokeWidth={2} />}
  tone="amber"
/>
            </div>

            {canViewAdminHome ? (
  <section className="grid gap-3">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-[14px] font-semibold text-[#172033]">
          Administración
        </h2>
        <p className="text-[11.5px] font-normal text-[#64748b]">
          Resumen operativo de pagos, cobros, operadores y cajas.
        </p>
      </div>
    </div>

    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <AdminHomeCard
        title="Deuda operadores"
        value={formatAdminDualMonto(adminResumen.deudaOperadores.total)}
        detail={`${adminResumen.deudaOperadores.vencida.cantidad} vencidas · ${adminResumen.deudaOperadores.proximos5Dias.cantidad} próximos 5 días`}
        tone={adminResumen.deudaOperadores.vencida.cantidad > 0 ? "red" : "slate"}
      />

      <AdminHomeCard
        title="Facturas a pagar"
        value={formatAdminDualMonto(adminResumen.facturasPagar.proximos5Dias)}
        detail={`${adminResumen.facturasPagar.proximos5Dias.cantidad} vencen hasta +5 días · ${adminResumen.facturasPagar.vencidas.cantidad} vencidas`}
        tone={adminResumen.facturasPagar.vencidas.cantidad > 0 ? "red" : "amber"}
      />

      <AdminHomeCard
        title="Facturas a cobrar"
        value={formatAdminDualMonto(adminResumen.facturasCobrar.totalPendiente)}
        detail={`${adminResumen.facturasCobrar.vencidas.cantidad} vencidas · ${adminResumen.facturasCobrar.proximos5Dias.cantidad} próximos 5 días`}
        tone={adminResumen.facturasCobrar.vencidas.cantidad > 0 ? "red" : "blue"}
      />

      <AdminHomeCard
        title="Resumen de cajas"
        value={`${formatUsd(adminResumen.cajas.totalUsd)} · $ ${formatMoneyAR(adminResumen.cajas.totalArs)}`}
        detail={`${adminResumen.cajas.cantidad} cajas operativas`}
        tone="green"
      />
    </div>
  </section>
) : null}

            <div className="grid gap-3 xl:grid-cols-2">
             <DashboardHomeCard
  title="Top vendedores de la semana"
  icon={<Trophy size={16} strokeWidth={2} />}
>
  <WeekRankingContent data={rankingSemanalActual} />
</DashboardHomeCard>

              <DashboardHomeCard
                title="Top vendedores del mes"
                icon={<Users size={16} strokeWidth={2} />}
              >
                <MonthRankingContent data={rankingMensual} />
              </DashboardHomeCard>

              <DashboardHomeCard
                title="Meta Almundo"
                icon={<Target size={16} strokeWidth={2} />}
              >
                <MetaAlmundoContent data={metasAlmundo} />
              </DashboardHomeCard>

              <DashboardHomeCard
                title="Metas por sucursal"
                icon={<Target size={16} strokeWidth={2} />}
              >
                <MetasSucursalContent data={metasSucursal} />
              </DashboardHomeCard>
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <SimpleChartCard
                title="Destinos más vendidos"
                icon={<MapPin size={16} strokeWidth={2} />}
                data={destinosMensual}
              />

              <SimpleChartCard
                title="Servicios más vendidos"
                icon={<Plane size={16} strokeWidth={2} />}
                data={serviciosMensual}
              />
            </div>

            <div className="mt-3 grid gap-3 xl:grid-cols-2">
              <PaxHomeCard
                title="Próximos pasajeros saliendo"
                icon={<Plane size={16} strokeWidth={2} />}
                data={paxSaliendo}
                emptyText="Sin pasajeros próximos a salir."
              />

              <PaxHomeCard
                title="Próximos pasajeros regresando"
                icon={<CalendarDays size={16} strokeWidth={2} />}
                data={paxRegresando}
                emptyText="Sin pasajeros próximos a regresar."
              />
            </div>
          </section>

          <section>
            <HomeSectionTitle title="Todos los módulos" />

            <div className="grid gap-3 xl:grid-cols-5">
              {renderModuleColumn("Chat", chatModules, "#10b981")}

              {renderModuleColumn("Ventas", ventasModules, "#ff7a1a")}

              {renderModuleColumn("Administración", administracionModules, "#0ea5e9")}

              {renderModuleColumn("Operaciones", operacionesModules, "#7c3aed")}

              <section className="relative min-h-[218px] overflow-hidden rounded-[22px] border border-white/70 bg-[radial-gradient(circle_at_22%_15%,rgba(255,122,26,0.18),transparent_34%),radial-gradient(circle_at_82%_18%,rgba(255,47,118,0.14),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.78),rgba(239,248,255,0.58))] p-4 shadow-sm backdrop-blur-md">
                <div className="absolute right-4 top-4 flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl bg-[#160a20] shadow-lg shadow-pink-500/20">
                  <img
                    src={brandAssets.iconoColor}
                    alt={brandText.appName}
                    className="h-11 w-11 object-contain"
                    draggable={false}
                  />
                </div>

                <div className="max-w-[72%]">
                  <h3 className="text-[16px] font-semibold leading-tight text-[#172033]">
                    Todo lo que necesitás, en un solo lugar.
                  </h3>

                  <p className="mt-2 text-[12px] font-normal leading-relaxed text-[#607086]">
                    NOSTUR conecta chat, ventas, administración y operaciones para que el equipo
                    trabaje más rápido y con menos pantallas sueltas.
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-2">
                  <div className="rounded-2xl bg-white/64 p-3">
                    <div className="text-[18px] font-semibold text-[#ff7a1a]">4</div>
                    <div className="text-[10px] font-normal uppercase tracking-wide text-[#64748b]">
                      áreas clave
                    </div>
                  </div>

                  <div className="rounded-2xl bg-white/64 p-3">
                    <div className="text-[18px] font-semibold text-[#ff7a1a]">{internalApps.length}</div>
                    <div className="text-[10px] font-normal uppercase tracking-wide text-[#64748b]">
                      módulos activos
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}

export default Home;