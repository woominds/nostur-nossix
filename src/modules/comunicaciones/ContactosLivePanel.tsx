import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Eye,
  Loader2,
  MessageCircle,
  RefreshCcw,
  Search,
  Users,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";

type LiveContacto = {
  id: string;
  live_contact_id: string;
  display_name: string | null;
  nombre_completo: string | null;
  celular: string | null;
  celular_normalizado: string | null;
  email: string | null;
  ciudad: string | null;
  pais: string | null;
  etiquetas: string | null;
  bloqueado: boolean | null;
  estado_vinculacion: string | null;
  total_conversaciones: number | null;
  ultima_conversacion_at: string | null;
  contacto_id: string | null;
  cliente_id: string | null;
};

type LiveHistorial = {
  id: string;
  live_conversation_id: string;
  display_name: string | null;
  telefono: string | null;
  agente: string | null;
  grupo: string | null;
  canal_tipo: string | null;
  live_fecha_creado: string | null;
  ultimo_mensaje: string | null;
  ya_retomada: boolean | null;
  conversation_id: string | null;
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

export function ContactosLivePanel() {
  const [loading, setLoading] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [contactos, setContactos] = useState<LiveContacto[]>([]);
  const [selectedContacto, setSelectedContacto] = useState<LiveContacto | null>(null);
  const [historiales, setHistoriales] = useState<LiveHistorial[]>([]);
  const [historialesLoading, setHistorialesLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"todos" | "con_historial" | "sin_vincular" | "vinculados">("todos");
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function loadContactos() {
    setLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("vw_comunicaciones_live_contactos")
      .select("*")
      .order("ultima_conversacion_at", { ascending: false, nullsFirst: false })
      .limit(5000);

    if (loadError) {
      setError(loadError.message || "No se pudieron cargar los contactos Live.");
      setLoading(false);
      return;
    }

    setContactos((data || []) as LiveContacto[]);
    setLoading(false);
  }

  async function loadHistorialesForContacto(contacto: LiveContacto) {
    setSelectedContacto(contacto);
    setHistoriales([]);
    setHistorialesLoading(true);
    setError(null);

    const { data, error: loadError } = await supabase
      .from("vw_comunicaciones_live_historial")
      .select(
        "id,live_conversation_id,display_name,telefono,agente,grupo,canal_tipo,live_fecha_creado,ultimo_mensaje,ya_retomada,conversation_id"
      )
      .eq("live_contact_id", contacto.live_contact_id)
      .order("fecha_orden", { ascending: false, nullsFirst: false })
      .limit(100);

    if (loadError) {
      setError(loadError.message || "No se pudieron cargar los historiales del contacto.");
      setHistorialesLoading(false);
      return;
    }

    setHistoriales((data || []) as LiveHistorial[]);
    setHistorialesLoading(false);
  }

  async function retomarHistorial(historial: LiveHistorial) {
    setActionLoadingId(historial.id);
    setError(null);
    setStatus(null);

    const { data, error: rpcError } = await supabase.rpc("retomar_live_conversacion", {
      p_live_conversation_row_id: historial.id
    });

    if (rpcError) {
      setError(rpcError.message || "No se pudo retomar la conversación.");
      setActionLoadingId(null);
      return;
    }

    const result = data as { conversation_id?: string; conversacion_id?: string; id?: string } | null;
    const conversationId = result?.conversation_id || result?.conversacion_id || result?.id || historial.conversation_id;

    setStatus("Conversación retomada en LiveNos.");

    if (conversationId) {
      window.localStorage.setItem("nostur_open_livenos_conversation_id", conversationId);
    }

    openInternal("livenos", "LiveNos", "internal://livenos", {
      conversationId,
      source: "contactos-live",
      live_conversation_id: historial.live_conversation_id
    });

    setActionLoadingId(null);
  }

  useEffect(() => {
    void loadContactos();
  }, []);

  const filteredContactos = useMemo(() => {
    const clean = search.trim().toLowerCase();

    return contactos.filter((item) => {
      if (filter === "con_historial" && Number(item.total_conversaciones || 0) <= 0) return false;
      if (filter === "sin_vincular" && item.estado_vinculacion !== "SIN_VINCULAR") return false;
      if (filter === "vinculados" && !item.contacto_id && !item.cliente_id) return false;

      if (!clean) return true;

      const haystack = [
        item.display_name,
        item.nombre_completo,
        item.celular,
        item.celular_normalizado,
        item.email,
        item.ciudad,
        item.pais,
        item.etiquetas,
        item.live_contact_id
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(clean);
    });
  }, [contactos, filter, search]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef3f6] text-[#142033]">
      <header className="shrink-0 border-b border-black/10 bg-white/86 px-5 py-3 backdrop-blur-xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                <Users size={19} />
              </div>
              <div>
                <h1 className="text-[18px] font-semibold tracking-tight text-[#142033]">
                  Contactos Live
                </h1>
                <p className="text-[12px] font-normal text-[#64748b]">
                  Contactos históricos importados desde Live Connect.
                </p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={loadContactos}
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

      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_420px] gap-3 overflow-hidden p-3">
        <section className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/86 shadow-sm">
          <div className="shrink-0 border-b border-black/10 p-3">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-[260px] flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94a3b8]" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar por nombre, teléfono, email..."
                  className="h-10 w-full rounded-xl border border-black/10 bg-[#f8fafc] pl-9 pr-3 text-[13px] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                />
              </div>

              <select
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
                className="h-10 rounded-xl border border-black/10 bg-white px-3 text-[13px] text-[#142033] outline-none focus:border-[#4f7c90]"
              >
                <option value="todos">Todos</option>
                <option value="con_historial">Con historial</option>
                <option value="sin_vincular">Sin vincular</option>
                <option value="vinculados">Vinculados</option>
              </select>
            </div>

            <div className="mt-2 text-[12px] text-[#64748b]">
              {filteredContactos.length} de {contactos.length} contactos.
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm text-[#64748b]">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Cargando contactos...
              </div>
            ) : filteredContactos.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-[#94a3b8]">
                No hay contactos para mostrar.
              </div>
            ) : (
              <div className="divide-y divide-black/5">
                {filteredContactos.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => loadHistorialesForContacto(item)}
                    className={[
                      "grid w-full grid-cols-[minmax(0,1.4fr)_160px_90px_120px] items-center gap-3 px-4 py-3 text-left transition hover:bg-[#f8fafc]",
                      selectedContacto?.id === item.id ? "bg-[#eef6f7]" : ""
                    ].join(" ")}
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[13px] font-semibold text-[#142033]">
                        {item.display_name || item.nombre_completo || "Sin nombre"}
                      </div>
                      <div className="truncate text-[12px] text-[#64748b]">
                        {item.email || "Sin email"} · {item.ciudad || item.pais || "Sin ubicación"}
                      </div>
                    </div>

                    <div className="truncate text-[12px] font-medium text-[#475569]">
                      {item.celular || item.celular_normalizado || "—"}
                    </div>

                    <div className="text-[12px] font-semibold text-[#142033]">
                      {Number(item.total_conversaciones || 0)}
                    </div>

                    <div className="truncate text-[11px] text-[#64748b]">
                      {formatDateTime(item.ultima_conversacion_at)}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/86 shadow-sm">
          <div className="shrink-0 border-b border-black/10 p-4">
            <h2 className="text-[14px] font-semibold text-[#142033]">Historial del contacto</h2>
            <p className="mt-1 text-[12px] text-[#64748b]">
              {selectedContacto
                ? selectedContacto.display_name || selectedContacto.nombre_completo || "Sin nombre"
                : "Seleccioná un contacto."}
            </p>
          </div>

          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!selectedContacto ? (
              <div className="rounded-2xl bg-[#f8fafc] p-4 text-[12px] text-[#94a3b8]">
                Elegí un contacto para ver sus conversaciones históricas.
              </div>
            ) : historialesLoading ? (
              <div className="flex items-center gap-2 rounded-2xl bg-[#f8fafc] p-4 text-[12px] text-[#64748b]">
                <Loader2 size={15} className="animate-spin" />
                Cargando historiales...
              </div>
            ) : historiales.length === 0 ? (
              <div className="rounded-2xl bg-[#f8fafc] p-4 text-[12px] text-[#94a3b8]">
                Este contacto no tiene historiales.
              </div>
            ) : (
              <div className="space-y-2">
                {historiales.map((historial) => (
                  <article
                    key={historial.id}
                    className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-[12px] font-semibold text-[#142033]">
                          {formatDateTime(historial.live_fecha_creado)}
                        </div>
                        <div className="mt-0.5 truncate text-[11px] text-[#64748b]">
                          {historial.agente || "Sin agente"} · {historial.canal_tipo || "—"}
                        </div>
                      </div>

                      <span
                        className={[
                          "rounded-full px-2 py-0.5 text-[10px] font-medium",
                          historial.ya_retomada
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                        ].join(" ")}
                      >
                        {historial.ya_retomada ? "Retomada" : "Histórica"}
                      </span>
                    </div>

                    <p className="mt-2 line-clamp-3 text-[12px] leading-relaxed text-[#475569]">
                      {historial.ultimo_mensaje || "Sin último mensaje."}
                    </p>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          openInternal("historiales-live", "Historiales Live", "internal://historiales-live", {
                            historialId: historial.id
                          })
                        }
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[11px] font-medium text-[#475569] ring-1 ring-black/10 hover:bg-[#f1f5f9]"
                      >
                        <Eye size={13} />
                        Ver
                      </button>

                      <button
                        type="button"
                        onClick={() => retomarHistorial(historial)}
                        disabled={actionLoadingId === historial.id}
                        className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#4f7c90] px-3 text-[11px] font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                      >
                        {actionLoadingId === historial.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <MessageCircle size={13} />
                        )}
                        Retomar
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}

export default ContactosLivePanel;