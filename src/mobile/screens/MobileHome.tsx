// src/mobile/screens/MobileHome.tsx

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronRight,
  MessageCircle,
  RefreshCcw,
  ShoppingBag,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
  Wallet,
  WalletCards
} from "lucide-react";
import type { MobileScreen } from "../MobileApp";
import { supabase } from "../../lib/supabase";
import { formatMoneyAR } from "../../lib/formatters";
import { brandAssets, brandText } from "../../lib/brandAssets";
import { useTableroDeControlStore } from "../../store/tableroDeControlStore";
import { MobilePwaInstallBanner } from "../components/MobilePwaInstallBanner";

type HomeExtraKpis = {
  conversaciones: number;
  carritosNuevos: number;
  ctasCtes: number;
};

type CarritoResumen = {
  id: string;
  numero_carrito: string | null;
  destino: string | null;
  estado: string | null;
  moneda: string | null;
  importe_final: string | number | null;
  importe: string | number | null;
  created_at: string | null;
  fecha_venta: string | null;
  clientes?: {
    nombre_completo?: string | null;
  } | null;
};

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function getTodayAR(): string {
  const now = new Date();
  const argentinaNow = new Date(
    now.toLocaleString("en-US", { timeZone: "America/Argentina/Cordoba" })
  );

  const year = argentinaNow.getFullYear();
  const month = String(argentinaNow.getMonth() + 1).padStart(2, "0");
  const day = String(argentinaNow.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getMonthStartAR(): string {
  const today = getTodayAR();
  return `${today.slice(0, 8)}01`;
}

function getFriendlyDate(): string {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Argentina/Cordoba"
  }).format(new Date());
}

function getMonthLabel(mes?: string, anio?: string): string {
  const month = String(mes || "").padStart(2, "0");

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

  return `${labels[month] || "Mes"} ${anio || ""}`.trim();
}

function formatDate(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getClientName(carrito: CarritoResumen): string {
  return carrito.clientes?.nombre_completo || "Sin cliente";
}

function getEstadoTone(estado?: string | null): string {
  const clean = String(estado || "").toUpperCase();

  if (clean === "CONTROLADO" || clean === "COBRADO") return "bg-emerald-100 text-emerald-700";
  if (clean === "FACTURADO") return "bg-blue-100 text-blue-700";
  if (clean === "EN_CONTROL") return "bg-orange-100 text-orange-700";
  if (clean === "CTA_CTE") return "bg-amber-100 text-amber-700";
  if (clean === "CANCELADO") return "bg-red-100 text-red-700";

  return "bg-slate-100 text-slate-700";
}

function ProgressLine({ value }: { value: number }) {
  const safeValue = Math.max(0, Math.min(value, 100));

  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#e2e8f0]">
      <div className="h-full rounded-full bg-nostur-orange" style={{ width: `${safeValue}%` }} />
    </div>
  );
}

function SectionTitle({
  title,
  action
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2 flex items-center justify-between gap-3 px-1">
      <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#64748b]">
        {title}
      </div>

      {action}
    </div>
  );
}

function KpiCard({
  label,
  value,
  subtitle,
  icon,
  tone = "orange"
}: {
  label: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  tone?: "orange" | "green" | "blue" | "purple" | "slate";
}) {
  const toneClass = {
    orange: "bg-nostur-orange/10 text-nostur-orange",
    green: "bg-emerald-50 text-emerald-700",
    blue: "bg-sky-50 text-sky-700",
    purple: "bg-purple-50 text-purple-700",
    slate: "bg-slate-100 text-slate-700"
  }[tone];

  return (
    <article className="rounded-[20px] border border-black/10 bg-white/82 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-medium text-[#64748b]">{label}</div>

          <div className="mt-1 truncate text-[17px] font-semibold leading-tight text-[#111827]">
            {value}
          </div>
        </div>

        <div className={["flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", toneClass].join(" ")}>
          {icon}
        </div>
      </div>

      <div className="truncate text-[10.5px] font-normal leading-tight text-[#64748b]">
        {subtitle}
      </div>
    </article>
  );
}

function QuickButton({
  title,
  subtitle,
  icon,
  onClick,
  tone = "dark"
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
  tone?: "dark" | "orange" | "green" | "blue";
}) {
  const toneClass = {
    dark: "bg-[#172033] text-white",
    orange: "bg-nostur-orange text-white",
    green: "bg-emerald-600 text-white",
    blue: "bg-sky-700 text-white"
  }[tone];

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[70px] items-center gap-2.5 rounded-[22px] border border-black/10 bg-white/84 p-3 text-left shadow-sm backdrop-blur-xl transition active:scale-[0.99]"
    >
      <div className={["flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl shadow-sm", toneClass].join(" ")}>
        {icon}
      </div>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
          {title}
        </div>

        <div className="mt-0.5 line-clamp-2 text-[10.5px] font-normal leading-snug text-[#64748b]">
          {subtitle}
        </div>
      </div>

      <ChevronRight size={15} className="shrink-0 text-[#94a3b8]" />
    </button>
  );
}

function SellerRow({
  seller,
  index
}: {
  seller: any;
  index: number;
}) {
  const utilidad = parseMoney(seller.utilidadUsd);
  const avance = parseMoney(seller.avanceMensualPct);

  return (
    <div className="rounded-2xl bg-[#f8fafc] p-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold leading-tight text-[#111827]">
            #{index + 1} {seller.vendedor || "Sin vendedor"}
          </div>

          <div className="mt-0.5 text-[10.5px] font-normal leading-tight text-[#64748b]">
            Utilidad US$ {formatMoneyAR(utilidad)}
          </div>
        </div>

        <div className="shrink-0 text-[12px] font-semibold text-[#334155]">
          {Math.round(avance)}%
        </div>
      </div>

      <ProgressLine value={avance} />
    </div>
  );
}

function MetaAlmundoCard({ metasAlmundo }: { metasAlmundo: any[] }) {
  const visible = metasAlmundo.slice(0, 2);

  return (
    <section className="rounded-[22px] border border-black/10 bg-white/84 p-3 shadow-sm backdrop-blur-xl">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-nostur-orange/10 text-nostur-orange">
            <Target size={16} strokeWidth={2} />
          </div>

          <div>
            <div className="text-[13px] font-semibold leading-tight text-[#111827]">
              Meta Almundo
            </div>

            <div className="text-[10.5px] font-normal leading-tight text-[#64748b]">
              Avance por sucursal
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-2">
        {visible.length === 0 ? (
          <div className="rounded-2xl bg-[#f8fafc] px-3 py-4 text-center text-[11px] font-medium text-[#64748b]">
            Sin metas Almundo cargadas.
          </div>
        ) : (
          visible.map((item) => {
            const avance = parseMoney(item.avancePct);

            return (
              <div key={item.sucursalId || item.sucursal} className="rounded-2xl bg-[#f8fafc] p-2.5">
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-semibold leading-tight text-[#111827]">
                      {item.sucursal || "Sucursal"}
                    </div>

                    <div className="mt-0.5 text-[10.5px] font-normal leading-tight text-[#64748b]">
                      US$ {formatMoneyAR(item.actualUsd)} / US$ {formatMoneyAR(item.objetivoUsd)}
                    </div>
                  </div>

                  <div className="shrink-0 text-[12px] font-semibold text-nostur-orange">
                    {Math.round(avance)}%
                  </div>
                </div>

                <ProgressLine value={avance} />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}

function CarritoMiniRow({
  carrito,
  onClick
}: {
  carrito: CarritoResumen;
  onClick: () => void;
}) {
  const total = parseMoney(carrito.importe_final ?? carrito.importe);
  const moneda = carrito.moneda || "ARS";

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-[20px] border border-black/10 bg-white/84 p-3 text-left shadow-sm backdrop-blur-xl active:scale-[0.99]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold leading-tight text-[#111827]">
            {getClientName(carrito)}
          </div>

          <div className="mt-0.5 truncate text-[10.5px] font-normal text-[#64748b]">
            {carrito.numero_carrito || "Sin carrito"} · {carrito.destino || "Sin destino"}
          </div>
        </div>

        <span
          className={[
            "shrink-0 rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide",
            getEstadoTone(carrito.estado)
          ].join(" ")}
        >
          {carrito.estado || "Cargado"}
        </span>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <div className="text-[12px] font-semibold text-[#172033]">
          {formatMoneyAR(total, moneda)}
        </div>

        <div className="text-[10px] font-normal text-[#94a3b8]">
          {formatDate(carrito.fecha_venta || carrito.created_at)}
        </div>
      </div>
    </button>
  );
}

export function MobileHome({ setScreen }: { setScreen: (screen: MobileScreen) => void }) {
  const tableroLoading = useTableroDeControlStore((state) => state.loading);
  const tableroError = useTableroDeControlStore((state) => state.error);
  const filters = useTableroDeControlStore((state) => state.filters);
  const kpis = useTableroDeControlStore((state) => state.kpis);
  const rankingVendedores = useTableroDeControlStore((state) => state.rankingVendedores);
  const metasAlmundo = useTableroDeControlStore((state) => state.metasAlmundo);
  const loadTablero = useTableroDeControlStore((state) => state.loadTablero);

  const [extraLoading, setExtraLoading] = useState(false);
  const [extraKpis, setExtraKpis] = useState<HomeExtraKpis>({
    conversaciones: 0,
    carritosNuevos: 0,
    ctasCtes: 0
  });
  const [ultimosCarritos, setUltimosCarritos] = useState<CarritoResumen[]>([]);
  const [extraError, setExtraError] = useState<string | null>(null);

  const friendlyDate = useMemo(() => getFriendlyDate(), []);

  async function loadExtraHome() {
    setExtraLoading(true);
    setExtraError(null);

    const monthStart = getMonthStartAR();
    const today = getTodayAR();

    try {
      const [conversacionesRes, carritosNuevosRes, ctasCtesRes, ultimosRes] = await Promise.all([
        supabase.from("conversaciones").select("id", { count: "exact", head: true }),

        supabase
          .from("carritos")
          .select("id", { count: "exact", head: true })
          .gte("fecha_venta", monthStart)
          .lte("fecha_venta", today),

        supabase
          .from("carritos")
          .select("id", { count: "exact", head: true })
          .gt("saldo_cta_cte", 0),

        supabase
          .from("carritos")
          .select(
            `
              id,
              numero_carrito,
              destino,
              estado,
              moneda,
              importe_final,
              importe,
              fecha_venta,
              created_at,
              clientes:cliente_id (
                nombre_completo
              )
            `
          )
          .order("created_at", { ascending: false })
          .limit(5)
      ]);

      if (conversacionesRes.error) throw conversacionesRes.error;
      if (carritosNuevosRes.error) throw carritosNuevosRes.error;
      if (ctasCtesRes.error) throw ctasCtesRes.error;
      if (ultimosRes.error) throw ultimosRes.error;

      setExtraKpis({
        conversaciones: conversacionesRes.count || 0,
        carritosNuevos: carritosNuevosRes.count || 0,
        ctasCtes: ctasCtesRes.count || 0
      });

      setUltimosCarritos((ultimosRes.data || []) as CarritoResumen[]);
    } catch (err) {
      setExtraError(err instanceof Error ? err.message : "No se pudieron cargar datos del tablero mobile.");
      setExtraKpis({
        conversaciones: 0,
        carritosNuevos: 0,
        ctasCtes: 0
      });
      setUltimosCarritos([]);
    } finally {
      setExtraLoading(false);
    }
  }

  async function refreshAll() {
    await Promise.all([loadTablero(), loadExtraHome()]);
  }

  useEffect(() => {
    void refreshAll();
  }, []);

  const monthLabel = getMonthLabel(filters.mes, filters.anio);
  const loading = tableroLoading || extraLoading;
  const error = tableroError || extraError;

  const topRanking = Array.isArray(rankingVendedores) ? rankingVendedores.slice(0, 4) : [];
  const facturacionMesUsd = parseMoney(kpis.facturacionMesUsd || kpis.facturacionTotalUsd || 0);
  const utilidadUsd = parseMoney(kpis.utilidadTotalUsd || 0);
  const ventasConfirmadas = Number(kpis.ventasConfirmadas || 0);

  return (
  <div className="min-h-full px-3 py-3">
    <section className="mb-3 overflow-hidden rounded-[26px] border border-black/10 bg-[#172033] p-4 text-white shadow-sm">
      <div className="relative">
        <div className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-nostur-orange/20 blur-2xl" />
        <div className="absolute -bottom-10 left-10 h-28 w-28 rounded-full bg-[#ff2f76]/15 blur-2xl" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm">
                <img
                  src={brandAssets.iconoColor}
                  alt={brandText.appName}
                  className="h-8 w-8 object-contain"
                  draggable={false}
                />
              </div>

              <div className="min-w-0">
                <div className="truncate text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">
                  {friendlyDate}
                </div>

                <div className="truncate text-[13px] font-semibold leading-tight text-white">
                  {monthLabel}
                </div>
              </div>
            </div>

            <h1 className="text-[22px] font-semibold leading-tight">
              Tablero operativo
            </h1>

            <p className="mt-1.5 max-w-[280px] text-[12px] font-normal leading-snug text-white/72">
              Ventas, utilidad, chats y movimientos importantes para seguir la operación desde el celular.
            </p>
          </div>

          <button
            type="button"
            onClick={() => void refreshAll()}
            disabled={loading}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-white ring-1 ring-white/10 transition hover:bg-white/15 disabled:opacity-50"
          >
            <RefreshCcw size={15} strokeWidth={1.9} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>
    </section>

    <MobilePwaInstallBanner />

    {error ? (
      <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-[11px] font-medium leading-snug text-red-700">
        {error}
      </div>
    ) : null}

      <section className="mb-3 grid grid-cols-2 gap-2.5">
        <KpiCard
          label="Facturación"
          value={`US$ ${formatMoneyAR(facturacionMesUsd)}`}
          subtitle="Mes en curso"
          icon={<WalletCards size={16} strokeWidth={2} />}
          tone="orange"
        />

        <KpiCard
          label="Utilidad"
          value={`US$ ${formatMoneyAR(utilidadUsd)}`}
          subtitle="Base metas"
          icon={<TrendingUp size={16} strokeWidth={2} />}
          tone="green"
        />

        <KpiCard
          label="Ventas"
          value={String(ventasConfirmadas || extraKpis.carritosNuevos)}
          subtitle="Confirmadas / cargadas"
          icon={<ShoppingBag size={16} strokeWidth={2} />}
          tone="blue"
        />

        <KpiCard
          label="Chats"
          value={String(extraKpis.conversaciones)}
          subtitle="Conversaciones"
          icon={<MessageCircle size={16} strokeWidth={2} />}
          tone="purple"
        />
      </section>

      <section className="mb-3 grid grid-cols-3 gap-2.5">
        <button
          type="button"
          onClick={() => setScreen("comunicaciones")}
          className="rounded-[20px] border border-black/10 bg-white/84 p-3 text-left shadow-sm backdrop-blur-xl active:scale-[0.99]"
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
            <MessageCircle size={17} />
          </div>

          <div className="text-[12px] font-semibold text-[#111827]">Chats</div>
          <div className="mt-0.5 text-[10px] font-normal text-[#64748b]">NIA y pasajeros</div>
        </button>

        <button
          type="button"
          onClick={() => setScreen("carritos")}
          className="rounded-[20px] border border-black/10 bg-white/84 p-3 text-left shadow-sm backdrop-blur-xl active:scale-[0.99]"
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-nostur-orange/10 text-nostur-orange">
            <ShoppingBag size={17} />
          </div>

          <div className="text-[12px] font-semibold text-[#111827]">Carritos</div>
          <div className="mt-0.5 text-[10px] font-normal text-[#64748b]">Ventas y ctas.</div>
        </button>

        <button
          type="button"
          onClick={() => setScreen("caja")}
          className="rounded-[20px] border border-black/10 bg-white/84 p-3 text-left shadow-sm backdrop-blur-xl active:scale-[0.99]"
        >
          <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-2xl bg-sky-50 text-sky-700">
            <Wallet size={17} />
          </div>

          <div className="text-[12px] font-semibold text-[#111827]">Caja</div>
          <div className="mt-0.5 text-[10px] font-normal text-[#64748b]">Saldos</div>
        </button>
      </section>

      <section className="mb-3 rounded-[22px] border border-black/10 bg-white/84 p-3 shadow-sm backdrop-blur-xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-2xl bg-[#172033] text-white">
                <BarChart3 size={16} strokeWidth={2} />
              </div>

              <div>
                <h2 className="text-[13px] font-semibold leading-tight text-[#111827]">
                  Resumen operativo
                </h2>

                <p className="text-[10.5px] font-normal leading-tight text-[#64748b]">
                  Indicadores rápidos del mes
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <CalendarDays size={14} className="text-[#64748b]" />
              <span className="text-[11.5px] font-normal text-[#64748b]">Período</span>
            </div>

            <strong className="text-[11.5px] font-semibold text-[#111827]">{monthLabel}</strong>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Wallet size={14} className="text-amber-700" />
              <span className="text-[11.5px] font-normal text-[#64748b]">Ctas. ctes abiertas</span>
            </div>

            <strong className="text-[11.5px] font-semibold text-amber-700">{extraKpis.ctasCtes}</strong>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f8fafc] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <Trophy size={14} className="text-nostur-orange" />
              <span className="text-[11.5px] font-normal text-[#64748b]">Ticket promedio</span>
            </div>

            <strong className="text-[11.5px] font-semibold text-[#111827]">
              US$ {formatMoneyAR(kpis.ticketPromedioUsd || 0)}
            </strong>
          </div>
        </div>
      </section>

      <div className="mb-3">
        <MetaAlmundoCard metasAlmundo={Array.isArray(metasAlmundo) ? metasAlmundo : []} />
      </div>

      <section className="mb-3 rounded-[22px] border border-black/10 bg-white/84 p-3 shadow-sm backdrop-blur-xl">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-[13px] font-semibold leading-tight text-[#111827]">
              Top vendedores
            </h2>

            <p className="text-[10.5px] font-normal leading-tight text-[#64748b]">
              Ranking por utilidad mensual
            </p>
          </div>

          <Trophy size={17} className="text-nostur-orange" />
        </div>

        <div className="grid gap-2">
          {topRanking.length === 0 ? (
            <div className="rounded-2xl bg-[#f8fafc] px-3 py-4 text-center text-[11px] font-medium text-[#64748b]">
              Sin ranking para mostrar.
            </div>
          ) : (
            topRanking.map((item, index) => (
              <SellerRow key={`${item.vendedorId || item.vendedor}-${index}`} seller={item} index={index} />
            ))
          )}
        </div>
      </section>

      <section className="mb-3">
        <SectionTitle
          title="Últimos carritos"
          action={
            <button
              type="button"
              onClick={() => setScreen("carritos")}
              className="flex items-center gap-1 text-[10.5px] font-semibold text-nostur-orange"
            >
              Ver todos
              <ArrowRight size={12} />
            </button>
          }
        />

        <div className="grid gap-2.5">
          {ultimosCarritos.length === 0 ? (
            <div className="rounded-[22px] border border-dashed border-black/10 bg-white/70 p-5 text-center text-[12px] font-medium text-[#64748b]">
              No hay carritos recientes para mostrar.
            </div>
          ) : (
            ultimosCarritos.map((carrito) => (
              <CarritoMiniRow
                key={carrito.id}
                carrito={carrito}
                onClick={() => setScreen("carritos")}
              />
            ))
          )}
        </div>
      </section>

      <section className="grid gap-2.5 pb-3">
        <QuickButton
          title="Abrir chats"
          subtitle="Revisar NIA, CANDE y conversaciones con pasajeros."
          icon={<MessageCircle size={18} strokeWidth={2} />}
          tone="green"
          onClick={() => setScreen("comunicaciones")}
        />

        <QuickButton
          title="Controlar carritos"
          subtitle="Ventas, cuentas corrientes y próximos ingresos a gastos."
          icon={<ShoppingBag size={18} strokeWidth={2} />}
          tone="orange"
          onClick={() => setScreen("carritos")}
        />

        <QuickButton
          title="Ver caja"
          subtitle="Saldos, movimientos, pases y conciliaciones."
          icon={<Wallet size={18} strokeWidth={2} />}
          tone="blue"
          onClick={() => setScreen("caja")}
        />

        <QuickButton
          title="Preguntarle a NIA"
          subtitle="Pedir resumen comercial, demoras o próximos pasos."
          icon={<Sparkles size={18} strokeWidth={2} />}
          tone="dark"
          onClick={() => setScreen("comunicaciones")}
        />
      </section>
    </div>
  );
}

export default MobileHome;