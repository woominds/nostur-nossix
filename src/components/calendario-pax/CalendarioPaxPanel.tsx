// src/components/calendario/CalendarioPaxPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  Filter,
  Plane,
  PlaneLanding,
  PlaneTakeoff,
  RefreshCcw,
  Search,
  UsersRound,
  X
} from "lucide-react";
import {
  useCalendarioPaxStore,
  type CalendarioPaxEvento
} from "../../store/calendarioPaxStore";

type SelectOption = {
  value: string;
  label: string;
};

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

const WEEK_DAYS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

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

function getMonthDate(monthKey: string): Date {
  const [year, month] = monthKey.split("-").map(Number);
  return new Date(year, month - 1, 1);
}

function getCalendarDays(monthKey: string): Date[] {
  const monthDate = getMonthDate(monthKey);
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const days: Date[] = [];

  for (let index = firstWeekDay - 1; index >= 0; index -= 1) {
    days.push(new Date(year, month, -index));
  }

  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  while (days.length < 42) {
    const next = days.length - firstWeekDay - lastDay.getDate() + 1;
    days.push(new Date(year, month + 1, next));
  }

  return days;
}

function formatStorageDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDateAR(value?: string | null): string {
  if (!value) return "—";

  const [year, month, day] = value.slice(0, 10).split("-");
  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function getMonthTitle(monthKey: string): string {
  const date = getMonthDate(monthKey);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`;
}

function normalizeOriginLabel(value?: string | null): string {
  if (!value) return "—";

  return value
    .replace("CARRITO", "Carrito")
    .replace("FILE", "File");
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
      {children}
    </label>
  );
}

function NosturSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar"
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <div className={["relative", open ? "z-[140]" : "z-0"].join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 w-full items-center justify-between gap-2 rounded-[10px] border border-black/10 bg-white px-3 text-left text-[12px] font-normal text-[#172033] outline-none transition hover:bg-[#f8fafc]"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={13}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
            tabIndex={-1}
            aria-label="Cerrar selector"
          />

          <div className="absolute left-0 right-0 top-[36px] z-[150] max-h-56 overflow-auto rounded-[14px] border border-black/10 bg-white p-1.5 shadow-xl">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[12px] font-normal text-[#94a3b8]">
                Sin opciones
              </div>
            ) : (
              options.map((option) => {
                const active = option.value === value;

                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      onChange(option.value);
                      setOpen(false);
                    }}
                    className={[
                      "flex h-8 w-full items-center rounded-[10px] px-3 text-left text-[12px] font-medium transition",
                      active
                        ? "bg-[#4f7c90] text-white"
                        : "text-[#334155] hover:bg-[#f1f5f9]"
                    ].join(" ")}
                  >
                    <span className="truncate">{option.label}</span>
                  </button>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "orange"
}: {
  label: string;
  value: string | number;
  icon: typeof Plane;
  tone?: "orange" | "green" | "amber" | "blue";
}) {
  const toneClass = {
    orange: "bg-orange-50 text-nostur-orange ring-orange-100",
    green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
    amber: "bg-amber-50 text-amber-700 ring-amber-100",
    blue: "bg-sky-50 text-sky-700 ring-sky-100"
  }[tone];

  return (
    <div className="rounded-[14px] border border-black/10 bg-white/62 px-3 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10.5px] font-medium text-[#64748b]">{label}</div>
          <div className="mt-0.5 truncate text-[18px] font-semibold tracking-tight text-[#172033]">
            {value}
          </div>
        </div>

        <div
          className={[
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ring-1",
            toneClass
          ].join(" ")}
        >
          <Icon size={14} strokeWidth={1.8} />
        </div>
      </div>
    </div>
  );
}

function EventPill({
  event,
  compact = false,
  selected,
  onClick
}: {
  event: CalendarioPaxEvento;
  compact?: boolean;
  selected?: boolean;
  onClick: () => void;
}) {
  const isIn = event.tipo_evento === "IN";

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${event.pasajero || "Sin pasajero"} · ${event.destinos || "Sin destino"}`}
      className={[
        "flex min-w-0 items-center gap-1 rounded-[9px] border px-1.5 py-1 text-left transition",
        isIn
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
          : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
        selected ? "ring-2 ring-[#4f7c90]/35" : ""
      ].join(" ")}
    >
      {isIn ? (
        <PlaneTakeoff size={12} className="shrink-0" />
      ) : (
        <PlaneLanding size={12} className="shrink-0" />
      )}

      <span
        className={[
          "min-w-0 truncate font-medium",
          compact ? "text-[10px]" : "text-[11px]"
        ].join(" ")}
      >
        {event.pasajero || "Sin pasajero"}
      </span>

      {event.cantidad_servicios > 1 ? (
        <span className="ml-auto shrink-0 rounded-md bg-white/70 px-1 text-[9px] font-semibold">
          +{event.cantidad_servicios}
        </span>
      ) : null}
    </button>
  );
}

function EventDetailCard({ event }: { event: CalendarioPaxEvento }) {
  const isIn = event.tipo_evento === "IN";

  return (
    <div
      className={[
        "rounded-[14px] border p-3 text-[12px]",
        isIn ? "border-emerald-200 bg-emerald-50" : "border-amber-200 bg-amber-50"
      ].join(" ")}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em]">
            {isIn ? <PlaneTakeoff size={13} /> : <PlaneLanding size={13} />}
            {isIn ? "Pax saliendo" : "Pax regresando"}
          </div>

          <div className="mt-1 truncate text-[14px] font-semibold text-[#172033]">
            {event.pasajero || "Sin pasajero"}
          </div>

          <div className="truncate text-[11px] font-normal text-[#64748b]">
            {event.destinos || "Sin destino"}
          </div>
        </div>

        <span className="rounded-[10px] bg-white/80 px-2 py-1 text-[10px] font-medium text-[#334155]">
          {formatDateAR(event.fecha)}
        </span>
      </div>

      <div className="grid gap-1">
        <div className="flex justify-between gap-3">
          <span className="text-[#64748b]">Origen</span>
          <strong className="font-semibold">{normalizeOriginLabel(event.origenes)}</strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-[#64748b]">Números</span>
          <strong className="max-w-[190px] truncate text-right font-semibold">
            {event.numeros || "—"}
          </strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-[#64748b]">Servicios</span>
          <strong className="max-w-[190px] truncate text-right font-semibold">
            {event.servicios || "—"}
          </strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-[#64748b]">Vendedor</span>
          <strong className="max-w-[190px] truncate text-right font-semibold">
            {event.vendedor || "—"}
          </strong>
        </div>

        <div className="flex justify-between gap-3">
          <span className="text-[#64748b]">Teléfono</span>
          <strong className="font-semibold">{event.telefono || "—"}</strong>
        </div>

        <div className="mt-1 flex justify-between gap-3 border-t border-black/10 pt-2">
          <span className="font-semibold text-[#172033]">Servicios agrupados</span>
          <strong className="font-semibold">{event.cantidad_servicios}</strong>
        </div>
      </div>
    </div>
  );
}

export function CalendarioPaxPanel() {
  const loading = useCalendarioPaxStore((state) => state.loading);
  const error = useCalendarioPaxStore((state) => state.error);
  const currentProfile = useCalendarioPaxStore((state) => state.currentProfile);
  const canManageCalendario = useCalendarioPaxStore((state) => state.canManageCalendario);
  const catalogos = useCalendarioPaxStore((state) => state.catalogos);
  const filters = useCalendarioPaxStore((state) => state.filters);
  const selectedDate = useCalendarioPaxStore((state) => state.selectedDate);
  const selectedEventId = useCalendarioPaxStore((state) => state.selectedEventId);
  const currentMonth = useCalendarioPaxStore((state) => state.currentMonth);

  const loadCalendario = useCalendarioPaxStore((state) => state.loadCalendario);
  const setFilter = useCalendarioPaxStore((state) => state.setFilter);
  const setSelectedDate = useCalendarioPaxStore((state) => state.setSelectedDate);
  const selectEvent = useCalendarioPaxStore((state) => state.selectEvent);
  const clearError = useCalendarioPaxStore((state) => state.clearError);
  const resetFilters = useCalendarioPaxStore((state) => state.resetFilters);
  const goToPreviousMonth = useCalendarioPaxStore((state) => state.goToPreviousMonth);
  const goToNextMonth = useCalendarioPaxStore((state) => state.goToNextMonth);
  const goToToday = useCalendarioPaxStore((state) => state.goToToday);

  const getEventosByDate = useCalendarioPaxStore((state) => state.getEventosByDate);
  const getSelectedDateEventos = useCalendarioPaxStore((state) => state.getSelectedDateEventos);
  const getSelectedEvent = useCalendarioPaxStore((state) => state.getSelectedEvent);
  const getFilteredEventos = useCalendarioPaxStore((state) => state.getFilteredEventos);
  const getMetrics = useCalendarioPaxStore((state) => state.getMetrics);

  const [filtersOpen, setFiltersOpen] = useState(false);

  const monthDays = useMemo(() => getCalendarDays(currentMonth), [currentMonth]);
  const monthDate = getMonthDate(currentMonth);
  const today = getToday();
  const selectedDateEventos = getSelectedDateEventos();
  const selectedEvent = getSelectedEvent();
  const filteredEventos = getFilteredEventos();
  const metrics = getMetrics();

  const proximasSalidas = useMemo(
    () =>
      filteredEventos
        .filter((event) => event.tipo_evento === "IN" && event.fecha >= today)
        .slice(0, 8),
    [filteredEventos, today]
  );

  const proximosRegresos = useMemo(
    () =>
      filteredEventos
        .filter((event) => event.tipo_evento === "OUT" && event.fecha >= today)
        .slice(0, 8),
    [filteredEventos, today]
  );

  useEffect(() => {
    loadCalendario();
  }, [loadCalendario]);

  useEffect(() => {
    loadCalendario();
  }, [currentMonth, loadCalendario]);

  const vendedorOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    ...catalogos.vendedores.map((item) => ({
      value: item.id,
      label: `${item.nombre} ${item.apellido}`.trim()
    }))
  ];

  const sucursalOptions: SelectOption[] = [
    { value: "todos", label: "Todas" },
    ...catalogos.sucursales.map((item) => ({
      value: item.id,
      label: item.nombre
    }))
  ];

  const tipoOptions: SelectOption[] = [
    { value: "todos", label: "Todos" },
    { value: "IN", label: "Pax saliendo" },
    { value: "OUT", label: "Pax regresando" }
  ];

  function handleRefresh() {
    loadCalendario();
  }

  function handleToday() {
    goToToday();
    window.setTimeout(() => loadCalendario(), 0);
  }

  function handlePreviousMonth() {
    goToPreviousMonth();
  }

  function handleNextMonth() {
    goToNextMonth();
  }

  function handleReset() {
    resetFilters();
    window.setTimeout(() => loadCalendario(), 0);
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Calendario Pax
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                IN / OUT
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              {canManageCalendario
                ? "Pasajeros saliendo y regresando por carritos y files."
                : `Calendario de ${currentProfile?.nombre || "tu usuario"}.`}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleToday}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc]"
            >
              Hoy
            </button>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        {error ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
            <span>{error}</span>

            <button type="button" onClick={clearError} className="text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="relative z-[60] mb-3 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => setFiltersOpen((current) => !current)}
              className="min-w-0 flex-1 text-left"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Filter size={14} className="text-[#4f7c90]" />

                <h2 className="text-[12px] font-semibold text-[#172033]">Filtros</h2>

                <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-nostur-orange ring-1 ring-orange-100">
                  {getMonthTitle(currentMonth)}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Vendedor: {filters.vendedorId} · Sucursal: {filters.sucursalId} · Tipo:{" "}
                {filters.tipoEvento}
              </div>
            </button>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
                className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
              >
                {filtersOpen ? "Ocultar" : "Mostrar"}
                <ChevronsUpDown size={13} strokeWidth={1.8} />
              </button>
            </div>
          </div>

          {filtersOpen ? (
            <>
              <div className="mt-3 grid gap-2.5 lg:grid-cols-[1fr_1fr_1fr_1.5fr]">
                <div>
                  <FieldLabel>Vendedor</FieldLabel>
                  <NosturSelect
                    value={filters.vendedorId}
                    onChange={(value) => setFilter("vendedorId", value)}
                    options={vendedorOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Sucursal</FieldLabel>
                  <NosturSelect
                    value={filters.sucursalId}
                    onChange={(value) => setFilter("sucursalId", value)}
                    options={sucursalOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Tipo</FieldLabel>
                  <NosturSelect
                    value={filters.tipoEvento}
                    onChange={(value) => setFilter("tipoEvento", value as typeof filters.tipoEvento)}
                    options={tipoOptions}
                  />
                </div>

                <div>
                  <FieldLabel>Buscar</FieldLabel>
                  <div className="flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                    <Search size={14} className="shrink-0 text-[#94a3b8]" />

                    <input
                      value={filters.search}
                      onChange={(event) => setFilter("search", event.target.value)}
                      placeholder="Pasajero, destino, carrito, file..."
                      className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="h-8 rounded-[10px] bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                >
                  Limpiar
                </button>

                <button
                  type="button"
                  onClick={handleRefresh}
                  className="h-8 rounded-[10px] bg-[#4f7c90] px-3 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d]"
                >
                  Aplicar filtros
                </button>
              </div>
            </>
          ) : null}
        </section>

        <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard label="Eventos" value={metrics.totalEventos} icon={CalendarDays} />
          <MetricCard label="Pax saliendo" value={metrics.totalIn} icon={PlaneTakeoff} tone="green" />
          <MetricCard label="Pax regresando" value={metrics.totalOut} icon={PlaneLanding} tone="amber" />
          <MetricCard
            label="Pasajeros únicos"
            value={metrics.totalPasajeros}
            icon={UsersRound}
            tone="blue"
          />
          <MetricCard
            label="Próximas salidas"
            value={metrics.proximasSalidas}
            icon={PlaneTakeoff}
            tone="green"
          />
          <MetricCard
            label="Próximos regresos"
            value={metrics.proximosRegresos}
            icon={PlaneLanding}
            tone="amber"
          />
        </section>

        <div className="relative z-0 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
          <section className="min-w-0 overflow-hidden rounded-[16px] border border-black/10 bg-white/62 shadow-sm backdrop-blur-xl">
            <div className="flex items-center justify-between gap-3 border-b border-black/10 px-3 py-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <CalendarDays size={16} className="text-[#4f7c90]" />

                <h2 className="truncate text-[14px] font-semibold text-[#172033]">
                  {getMonthTitle(currentMonth)}
                </h2>

                {loading ? (
                  <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/10">
                    Cargando...
                  </span>
                ) : null}
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={handlePreviousMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-white hover:text-[#172033]"
                >
                  <ChevronLeft size={16} />
                </button>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-white hover:text-[#172033]"
                >
                  <ChevronRight size={16} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 border-b border-black/10 bg-[#f8fafc]">
              {WEEK_DAYS.map((day) => (
                <div
                  key={day}
                  className="border-r border-black/10 px-2 py-2 text-center text-[10px] font-medium uppercase tracking-[0.1em] text-[#64748b] last:border-r-0"
                >
                  {day}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7">
              {monthDays.map((date, index) => {
                const storageDate = formatStorageDate(date);
                const isCurrentMonth = date.getMonth() === monthDate.getMonth();
                const isToday = storageDate === today;
                const isSelected = storageDate === selectedDate;
                const dayEvents = getEventosByDate(storageDate);
                const visibleEvents = dayEvents.slice(0, 4);
                const hiddenCount = Math.max(0, dayEvents.length - visibleEvents.length);
                const isLastColumn = (index + 1) % 7 === 0;

                return (
                  <button
                    key={storageDate}
                    type="button"
                    onClick={() => setSelectedDate(storageDate)}
                    className={[
                      "min-h-[112px] border-b border-black/10 p-1.5 text-left transition",
                      isLastColumn ? "" : "border-r border-black/10",
                      isCurrentMonth ? "bg-white/70 hover:bg-white" : "bg-[#f8fafc]/70 text-[#94a3b8]",
                      isSelected ? "bg-[#eef6f7] ring-2 ring-inset ring-[#4f7c90]/35" : "",
                      isToday ? "shadow-[inset_0_0_0_1px_rgba(255,122,26,0.35)]" : ""
                    ].join(" ")}
                  >
                    <div className="mb-1 flex items-center justify-between gap-1">
                      <span
                        className={[
                          "flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold",
                          isToday
                            ? "bg-[#172033] text-white"
                            : isCurrentMonth
                              ? "text-[#172033]"
                              : "text-[#94a3b8]"
                        ].join(" ")}
                      >
                        {date.getDate()}
                      </span>

                      {dayEvents.length > 0 ? (
                        <span className="rounded-md bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold text-[#64748b]">
                          {dayEvents.length}
                        </span>
                      ) : null}
                    </div>

                    <div className="grid gap-1">
                      {visibleEvents.map((event) => (
                        <EventPill
                          key={event.id}
                          event={event}
                          compact
                          selected={event.id === selectedEventId}
                          onClick={() => {
                            setSelectedDate(storageDate);
                            selectEvent(event.id);
                          }}
                        />
                      ))}

                      {hiddenCount > 0 ? (
                        <span className="px-1 text-[10px] font-semibold text-[#64748b]">
                          +{hiddenCount} más
                        </span>
                      ) : null}
                    </div>
                  </button>
                );
              })}
            </div>
          </section>

          <aside className="min-w-0 space-y-3">
            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
                  {formatDateAR(selectedDate)}
                </div>

                <div className="text-[24px] font-semibold tracking-tight text-[#172033]">
                  {selectedDate.slice(8, 10)}
                </div>

                <div className="text-[12px] font-normal text-[#64748b]">
                  {selectedDateEventos.length} eventos
                </div>
              </div>

              <div className="grid gap-1.5">
                {selectedDateEventos.length === 0 ? (
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-4 text-center text-[12px] font-normal text-[#64748b]">
                    No hay pasajeros para esta fecha.
                  </div>
                ) : (
                  selectedDateEventos.map((event) => (
                    <EventPill
                      key={event.id}
                      event={event}
                      selected={event.id === selectedEventId}
                      onClick={() => selectEvent(event.id)}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="text-[14px] font-semibold text-[#172033]">Detalle</h2>

                <div className="flex items-center gap-2 text-[10px] font-medium text-[#64748b]">
                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-400" />
                    IN
                  </span>

                  <span className="flex items-center gap-1">
                    <span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />
                    OUT
                  </span>
                </div>
              </div>

              {selectedEvent ? (
                <EventDetailCard event={selectedEvent} />
              ) : selectedDateEventos[0] ? (
                <EventDetailCard event={selectedDateEventos[0]} />
              ) : (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-4 text-center text-[12px] font-normal text-[#64748b]">
                  Seleccioná un pasajero para ver el detalle.
                </div>
              )}
            </section>

            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <PlaneTakeoff size={15} className="text-emerald-700" />

                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                  Próximas salidas
                </h2>
              </div>

              <div className="grid max-h-[220px] gap-1.5 overflow-auto pr-1">
                {proximasSalidas.length === 0 ? (
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-center text-[12px] font-normal text-[#64748b]">
                    Sin próximas salidas.
                  </div>
                ) : (
                  proximasSalidas.map((event) => (
                    <EventPill
                      key={`next-in-${event.id}`}
                      event={event}
                      compact
                      selected={event.id === selectedEventId}
                      onClick={() => {
                        setSelectedDate(event.fecha);
                        selectEvent(event.id);
                      }}
                    />
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
              <div className="mb-3 flex items-center gap-2">
                <PlaneLanding size={15} className="text-amber-700" />

                <h2 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#64748b]">
                  Próximos regresos
                </h2>
              </div>

              <div className="grid max-h-[220px] gap-1.5 overflow-auto pr-1">
                {proximosRegresos.length === 0 ? (
                  <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-3 text-center text-[12px] font-normal text-[#64748b]">
                    Sin próximos regresos.
                  </div>
                ) : (
                  proximosRegresos.map((event) => (
                    <EventPill
                      key={`next-out-${event.id}`}
                      event={event}
                      compact
                      selected={event.id === selectedEventId}
                      onClick={() => {
                        setSelectedDate(event.fecha);
                        selectEvent(event.id);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default CalendarioPaxPanel;