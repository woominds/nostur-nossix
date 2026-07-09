import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Search,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type LiveHistorial = {
  id: string;
  live_conversation_id: string;
  display_name: string | null;
  contacto_email: string | null;
  contacto_etiquetas: string | null;
  contacto_bloqueado: boolean | null;
  telefono: string | null;
  telefono_normalizado: string | null;
  canal_nombre: string | null;
  canal_tipo: string | null;
  grupo: string | null;
  agente: string | null;
  live_fecha_creado: string | null;
  live_fecha_finalizado: string | null;
  ultimo_mensaje: string | null;
  url_conversacion: string | null;
  html_url_original: string | null;
  html_importado: boolean | null;
  html_raw: string | null;
  mensajes_parseados: number | null;
  conversation_id: string | null;
  estado_historial: string | null;
  ya_retomada: boolean | null;
  mayor_15_dias: boolean | null;
  fecha_orden: string | null;
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function openInternal(appId: string, title: string, url: string, params?: Record<string, unknown>) {
  window.dispatchEvent(
    new CustomEvent("nostur:open-internal", {
      detail: {
        appId,
        url,
        title,
        params
      }
    })
  );
}

function getMonthValue(value?: string | null): string {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");

  return `${year}-${month}`;
}

export function HistorialesLivePanel() {
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [historiales, setHistoriales] = useState<LiveHistorial[]>([]);
  const [selectedHistorial, setSelectedHistorial] = useState<LiveHistorial | null>(null);
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [agent, setAgent] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "todos" | "retomadas" | "sin_retomar" | "con_html" | "sin_html"
  >("todos");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadHistoriales() {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("vw_comunicaciones_live_historial")
      .select("*")
      .order("fecha_orden", { ascending: false, nullsFirst: false })
      .limit(5000);

    if (loadError) {
      setError(loadError.message || "No se pudieron cargar los historiales Live.");
      setLoading(false);
      return;
    }

    const next = (data || []) as LiveHistorial[];

    setHistoriales(next);

    if (!selectedHistorial && next.length > 0) {
      setSelectedHistorial(next[0]);
    }

    setLoading(false);
  }

async function retomarHistorial(historial: LiveHistorial) {
  setActionLoadingId(historial.id);
  setError(null);
  setStatus(null);

  try {
    const telefono =
      historial.telefono_normalizado ||
      historial.telefono ||
      "";

    const nombre =
      historial.display_name ||
      historial.telefono ||
      historial.telefono_normalizado ||
      "";

    if (!telefono.trim()) {
      throw new Error("Este historial no tiene teléfono válido para retomar.");
    }

    const detail = {
      source: "historiales-live",
      action: "open_new_conversation_from_history",
      openNewConversation: true,
      open_new_conversation: true,
      telefono,
      phone: telefono,
      nombre,
      name: nombre,
      live_conversation_id: historial.live_conversation_id,
      historial_live_id: historial.id
    };

    window.localStorage.setItem("nostur_livenos_open_new_conversation", "1");
    window.localStorage.setItem("nostur_livenos_new_conversation_phone", telefono);
    window.localStorage.setItem("nostur_livenos_new_conversation_name", nombre);

    openInternal("livenos", "LiveNos", "internal://livenos", detail);

    window.dispatchEvent(
      new CustomEvent("nostur:open-livenos-conversation", {
        detail
      })
    );

    setStatus("Abrimos LiveNos para iniciar una nueva conversación con plantilla.");

    await loadHistoriales();
  } catch (error) {
    setError(error instanceof Error ? error.message : "No se pudo retomar la conversación.");
  } finally {
    setActionLoadingId(null);
  }
}

  

  useEffect(() => {
    void loadHistoriales();
  }, []);

  const agents = useMemo(() => {
    return Array.from(
      new Set(historiales.map((item) => item.agente).filter(Boolean) as string[])
    ).sort((a, b) => a.localeCompare(b));
  }, [historiales]);

  const months = useMemo(() => {
    return Array.from(
      new Set(historiales.map((item) => getMonthValue(item.live_fecha_creado)).filter(Boolean))
    ).sort();
  }, [historiales]);

  const filteredHistoriales = useMemo(() => {
    const clean = search.trim().toLowerCase();

    return historiales.filter((item) => {
      if (month && getMonthValue(item.live_fecha_creado) !== month) return false;
      if (agent && item.agente !== agent) return false;

      if (statusFilter === "retomadas" && !item.ya_retomada) return false;
      if (statusFilter === "sin_retomar" && item.ya_retomada) return false;
      if (statusFilter === "con_html" && !item.html_importado && !item.html_raw) return false;
      if (statusFilter === "sin_html" && (item.html_importado || item.html_raw)) return false;

      if (!clean) return true;

      const haystack = [
        item.display_name,
        item.telefono,
        item.telefono_normalizado,
        item.agente,
        item.grupo,
        item.canal_nombre,
        item.canal_tipo,
        item.ultimo_mensaje,
        item.live_conversation_id,
        item.contacto_email,
        item.contacto_etiquetas
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(clean);
    });
  }, [agent, historiales, month, search, statusFilter]);

  const selectedUrl =
    selectedHistorial?.html_url_original || selectedHistorial?.url_conversacion || "";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef3f6] text-[#142033]">
      <header className="shrink-0 border-b border-black/10 bg-white/86 px-5 py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
              <FileText size={19} />
            </div>

            <div>
              <h1 className="text-[18px] font-semibold tracking-tight text-[#142033]">
                Historiales Live
              </h1>
              <p className="text-[12px] font-normal text-[#64748b]">
                Conversaciones históricas importadas desde Live Connect.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadHistoriales}
            disabled={loading}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-medium text-[#475569] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:opacity-50"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
            Actualizar
          </button>
        </div>

        {error ? (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] text-red-700">
            <AlertTriangle size={15} />
            <span>{error}</span>
          </div>
        ) : null}

        {status ? (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-[12px] text-emerald-700">
            <span>{status}</span>
            <button type="button" onClick={() => setStatus(null)}>
              <X size={14} />
            </button>
          </div>
        ) : null}
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-[390px_minmax(0,1fr)] gap-3 overflow-hidden p-3">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/86 shadow-sm">
          <div className="shrink-0 border-b border-black/10 p-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar historial..."
                className="h-10 w-full rounded-xl border border-black/10 bg-[#f8fafc] pl-9 pr-3 text-[13px] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
              />
            </div>

            <div className="mt-2 grid grid-cols-2 gap-2">
              <select
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="h-9 rounded-xl border border-black/10 bg-white px-2 text-[12px] outline-none"
              >
                <option value="">Todos los meses</option>
                {months.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
                className="h-9 rounded-xl border border-black/10 bg-white px-2 text-[12px] outline-none"
              >
                <option value="todos">Todos</option>
                <option value="retomadas">Retomadas</option>
                <option value="sin_retomar">Sin retomar</option>
                <option value="con_html">Con HTML</option>
                <option value="sin_html">Sin HTML</option>
              </select>
            </div>

            <select
              value={agent}
              onChange={(event) => setAgent(event.target.value)}
              className="mt-2 h-9 w-full rounded-xl border border-black/10 bg-white px-2 text-[12px] outline-none"
            >
              <option value="">Todos los agentes</option>
              {agents.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <div className="mt-2 text-[12px] text-[#64748b]">
              {filteredHistoriales.length} de {historiales.length} historiales.
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[#64748b]">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Cargando historiales...
              </div>
            ) : filteredHistoriales.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#94a3b8]">
                No hay historiales para mostrar.
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {filteredHistoriales.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedHistorial(item)}
                    className={[
                      "w-full px-4 py-3 text-left transition hover:bg-[#f8fafc]",
                      selectedHistorial?.id === item.id ? "bg-[#eef6f7]" : ""
                    ].join(" ")}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-semibold text-[#142033]">
                          {item.display_name || item.telefono || "Sin contacto"}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-[#64748b]">
                          {formatDateTime(item.live_fecha_creado)} · {item.agente || "Sin agente"}
                        </div>
                      </div>

                      <span
                        className={[
                          "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                          item.ya_retomada
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        ].join(" ")}
                      >
                        {item.ya_retomada ? "Retomada" : "Histórica"}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-2 text-[12px] leading-relaxed text-[#475569]">
                      {item.ultimo_mensaje || "Sin último mensaje."}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/86 shadow-sm">
          {!selectedHistorial ? (
            <div className="flex h-full items-center justify-center p-8 text-center text-sm text-[#94a3b8]">
              Seleccioná un historial para ver el detalle.
            </div>
          ) : (
            <>
              <div className="shrink-0 border-b border-black/10 bg-white px-4 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-[17px] font-semibold text-[#142033]">
                      {selectedHistorial.display_name || selectedHistorial.telefono || "Sin contacto"}
                    </h2>

                    <p className="mt-0.5 text-[12px] text-[#64748b]">
                      {selectedHistorial.telefono || "Sin teléfono"} ·{" "}
                      {formatDateTime(selectedHistorial.live_fecha_creado)}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-medium text-[#64748b]">
                        {selectedHistorial.canal_tipo || "Sin canal"}
                      </span>

                      <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-medium text-[#64748b]">
                        {selectedHistorial.agente || "Sin agente"}
                      </span>

                      <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-medium text-[#64748b]">
                        {selectedHistorial.grupo || "Sin grupo"}
                      </span>

                      <span className="rounded-full bg-[#f1f5f9] px-2 py-1 text-[10px] font-medium text-[#64748b]">
                        {selectedHistorial.html_importado || selectedHistorial.html_raw
                          ? "HTML importado"
                          : "HTML pendiente"}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedUrl ? (
                      <button
                        type="button"
                        onClick={() => window.open(selectedUrl, "_blank", "noopener,noreferrer")}
                        className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-medium text-[#475569] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
                      >
                        <ExternalLink size={14} />
                        URL original
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => retomarHistorial(selectedHistorial)}
                      disabled={actionLoadingId === selectedHistorial.id}
                      className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f7c90] px-3 text-xs font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
                    >
                      {actionLoadingId === selectedHistorial.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <MessageCircle size={14} />
                      )}
                      Retomar en LiveNos
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px] overflow-hidden">
                <div className="min-h-0 overflow-auto bg-[#f8fafc] p-4">
                  {selectedHistorial.html_raw ? (
                    <iframe
                      title={`Historial ${selectedHistorial.live_conversation_id}`}
                      sandbox=""
                      srcDoc={selectedHistorial.html_raw}
                      className="h-full min-h-[680px] w-full rounded-2xl border border-black/10 bg-white"
                    />
                  ) : (
                    <div className="flex h-full min-h-[420px] items-center justify-center rounded-2xl border border-dashed border-black/10 bg-white p-8 text-center">
                      <div>
                        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef6f7] text-[#4f7c90]">
                          <Eye size={24} />
                        </div>

                        <h3 className="text-[14px] font-semibold text-[#142033]">
                          HTML todavía no importado
                        </h3>

                        <p className="mt-1 max-w-[420px] text-[12px] leading-relaxed text-[#64748b]">
                          La conversación tiene URL original, pero todavía no se descargó el HTML
                          dentro de NOSTUR. Podés abrir la URL original o importar HTML en una fase
                          siguiente.
                        </p>

                        {selectedUrl ? (
                          <button
                            type="button"
                            onClick={() => window.open(selectedUrl, "_blank", "noopener,noreferrer")}
                            className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f7c90] px-4 text-xs font-medium text-white hover:bg-[#406b7d]"
                          >
                            <ExternalLink size={14} />
                            Abrir URL original
                          </button>
                        ) : null}
                      </div>
                    </div>
                  )}
                </div>

                <aside className="min-h-0 overflow-auto border-l border-black/10 bg-white p-4">
                  <h3 className="text-[13px] font-semibold text-[#142033]">Detalle</h3>

                  <div className="mt-3 space-y-3 text-[12px] text-[#475569]">
                    <div>
                      <span className="block text-[#94a3b8]">ID Live</span>
                      <span className="break-all font-medium text-[#142033]">
                        {selectedHistorial.live_conversation_id}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Contacto</span>
                      <span className="font-medium text-[#142033]">
                        {selectedHistorial.display_name || "—"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Teléfono</span>
                      <span className="font-medium text-[#142033]">
                        {selectedHistorial.telefono ||
                          selectedHistorial.telefono_normalizado ||
                          "—"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Agente</span>
                      <span className="font-medium text-[#142033]">
                        {selectedHistorial.agente || "—"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Inicio</span>
                      <span className="font-medium text-[#142033]">
                        {formatDateTime(selectedHistorial.live_fecha_creado)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Finalizado</span>
                      <span className="font-medium text-[#142033]">
                        {formatDateTime(selectedHistorial.live_fecha_finalizado)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Mensajes parseados</span>
                      <span className="font-medium text-[#142033]">
                        {Number(selectedHistorial.mensajes_parseados || 0)}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Estado</span>
                      <span className="font-medium text-[#142033]">
                        {selectedHistorial.ya_retomada
                          ? "Retomada"
                          : selectedHistorial.estado_historial || "Histórico"}
                      </span>
                    </div>

                    <div>
                      <span className="block text-[#94a3b8]">Último mensaje</span>
                      <p className="mt-1 rounded-xl bg-[#f8fafc] p-3 leading-relaxed text-[#142033]">
                        {selectedHistorial.ultimo_mensaje || "—"}
                      </p>
                    </div>
                  </div>
                </aside>
              </div>
            </>
          )}
        </section>
      </main>
    </div>
  );
}

export default HistorialesLivePanel;
