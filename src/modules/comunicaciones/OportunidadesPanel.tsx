import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCcw } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { OportunidadDetalleModal } from "./OportunidadDetalleModal";
import { EmptyState } from "./comunicacionesShared";

type PipelineEstado = {
  id: string;
  nombre: string;
  color: string | null;
  orden: number | null;
  es_final: boolean | null;
  resultado: string | null;
  es_sin_atender: boolean | null;
};

type Oportunidad = {
  id: string;
  conversacion_id: string;
  estado_id: string | null;
  score: number | null;
  datos: Record<string, unknown> | null;
  assigned_to: string | null;
  cande_activa: boolean | null;
  transferida_at: string | null;
  updated_at: string | null;
  created_at: string | null;
};

type ConversacionLite = {
  id: string;
  contacto_id: string | null;
  wa_phone: string | null;
  titulo: string | null;
  subject: string | null;
  estado_gestion: string | null;
  estado_comercial: string | null;
  assigned_to: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
};

type ContactoWaLite = {
  id: string;
  wa_phone: string | null;
  display_name: string | null;
  profile_name: string | null;
};

type OportunidadVM = Oportunidad & {
  conversacion?: ConversacionLite | null;
  contacto?: ContactoWaLite | null;
};

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function getTextFromDatos(
  datos: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = "—"
) {
  if (!datos) return fallback;

  for (const key of keys) {
    const value = datos[key];
    if (value === null || value === undefined) continue;

    const text = String(value).trim();
    if (text) return text;
  }

  return fallback;
}

function getNumberFromDatos(datos: Record<string, unknown> | null | undefined, keys: string[]) {
  if (!datos) return null;

  for (const key of keys) {
    const value = datos[key];

    if (typeof value === "number" && Number.isFinite(value)) return value;

    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/[^\d.-]/g, ""));
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return null;
}

function temperaturaFromScore(score: number) {
  if (score >= 75) return "Caliente";
  if (score >= 45) return "Tibia";
  return "Fría";
}

function temperaturaClass(score: number) {
  if (score >= 75) return "bg-red-50 text-red-600 ring-red-100";
  if (score >= 45) return "bg-amber-50 text-amber-700 ring-amber-100";
  return "bg-slate-100 text-slate-600 ring-slate-200";
}

function scoreBarClass(score: number) {
  if (score >= 75) return "bg-red-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-400";
}

function getNombreOportunidad(item: OportunidadVM) {
  const fromDatos = getTextFromDatos(
    item.datos,
    [
      "nombre",
      "contacto_nombre",
      "pasajero",
      "nombre_pasajero",
      "contacto",
      "cliente",
      "display_name",
      "profile_name"
    ],
    ""
  );

  if (fromDatos) return fromDatos;

  const fromContacto = cleanText(item.contacto?.display_name) || cleanText(item.contacto?.profile_name);
  if (fromContacto) return fromContacto;

  const fromConversacion = cleanText(item.conversacion?.titulo) || cleanText(item.conversacion?.subject);
  if (fromConversacion) return fromConversacion;

  return "Sin nombre";
}

function getTelefonoOportunidad(item: OportunidadVM) {
  const fromDatos = getTextFromDatos(
    item.datos,
    ["telefono", "phone", "wa_phone", "celular", "whatsapp"],
    ""
  );

  if (fromDatos) return fromDatos;

  const fromContacto = cleanText(item.contacto?.wa_phone);
  if (fromContacto) return fromContacto;

  const fromConversacion = cleanText(item.conversacion?.wa_phone);
  if (fromConversacion) return fromConversacion;

  return "Sin teléfono";
}

function getDestinoOportunidad(item: OportunidadVM) {
  return getTextFromDatos(
    item.datos,
    ["destino", "destinos", "lugar", "ciudad_destino", "pais", "país"],
    "Destino sin relevar"
  );
}

function getOrigenOportunidad(item: OportunidadVM) {
  return getTextFromDatos(
    item.datos,
    ["origen", "ciudad_origen", "salida_desde", "origen_sugerido"],
    "Origen sin relevar"
  );
}

function getOrigenLabel(item: OportunidadVM) {
  const origen = getOrigenOportunidad(item);
  const origenConfirmado = item.datos?.origen_confirmado === true;

  if (origen === "Origen sin relevar") return origen;
  if (origenConfirmado) return origen;

  if (cleanText(item.datos?.origen_sugerido) && !cleanText(item.datos?.origen)) {
    return `${origen} sugerido`;
  }

  return origen;
}

function getFechaOportunidad(item: OportunidadVM) {
  return getTextFromDatos(
    item.datos,
    ["fechas_tentativas", "fecha", "fechas", "cuando", "cuándo", "fecha_viaje", "mes"],
    "Fecha sin relevar"
  );
}

function getPaxOportunidad(item: OportunidadVM) {
  return getNumberFromDatos(item.datos, [
    "cantidad_pasajeros",
    "pax",
    "pasajeros",
    "personas",
    "cantidad_pax"
  ]);
}

function getPresupuestoOportunidad(item: OportunidadVM) {
  return getTextFromDatos(
    item.datos,
    ["presupuesto_aproximado", "presupuesto", "budget", "monto_estimado"],
    "Presupuesto sin relevar"
  );
}

function enrichDatos(item: OportunidadVM) {
  const nombre = getNombreOportunidad(item);
  const telefono = getTelefonoOportunidad(item);
  const ultimoMensaje =
    cleanText(item.conversacion?.last_message_preview) ||
    cleanText(item.datos?.ultimo_mensaje) ||
    null;

  return {
    ...(item.datos || {}),
    nombre: cleanText((item.datos || {}).nombre) || nombre,
    contacto_nombre: cleanText((item.datos || {}).contacto_nombre) || nombre,
    pasajero: cleanText((item.datos || {}).pasajero) || nombre,
    telefono: cleanText((item.datos || {}).telefono) || telefono,
    wa_phone: cleanText((item.datos || {}).wa_phone) || telefono,
    ultimo_mensaje: ultimoMensaje,
    origen_livenos: true,
    conversation_id: item.conversacion_id
  };
}

function MiniMetric({
  label,
  value
}: {
  label: string;
  value: string | number;
}) {
  return (
    <article className="rounded-[18px] border border-black/10 bg-white/60 px-4 py-3 shadow-sm backdrop-blur-xl">
      <div className="text-[11px] font-medium text-[#64748b]">{label}</div>
      <div className="mt-1 text-[21px] font-semibold tracking-tight text-[#172033]">{value}</div>
    </article>
  );
}

function SoftStatus({
  children,
  score
}: {
  children: React.ReactNode;
  score: number;
}) {
  return (
    <span
      className={[
        "inline-flex h-6 items-center rounded-lg px-2 text-[10.5px] font-medium ring-1",
        temperaturaClass(score)
      ].join(" ")}
    >
      {children}
    </span>
  );
}

export function OportunidadesPanel() {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [estados, setEstados] = useState<PipelineEstado[]>([]);
  const [oportunidades, setOportunidades] = useState<OportunidadVM[]>([]);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OportunidadVM | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverEstadoId, setDragOverEstadoId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const realtimeTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  const loadData = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) {
      setLoading(true);
    }

    setError(null);

    const [estadosRes, oportunidadesRes, conversacionesRes, contactosRes] = await Promise.all([
      supabase
        .from("pipeline_estados")
        .select("id,nombre,color,orden,es_final,resultado,es_sin_atender")
        .order("orden", { ascending: true }),

      supabase
        .from("lead_oportunidades")
        .select("id,conversacion_id,estado_id,score,datos,assigned_to,cande_activa,transferida_at,updated_at,created_at")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(200),

      supabase
        .from("conversaciones")
        .select("id,contacto_id,wa_phone,titulo,subject,estado_gestion,estado_comercial,assigned_to,last_message_preview,last_message_at")
        .is("deleted_at", null)
        .limit(500),

      supabase
        .from("contactos_wa")
        .select("id,wa_phone,display_name,profile_name")
        .limit(500)
    ]);

    const firstError = estadosRes.error || oportunidadesRes.error || conversacionesRes.error || contactosRes.error;

    if (firstError) {
      setError(firstError.message || "Error cargando oportunidades");

      if (!options.silent) {
        setLoading(false);
      }

      return;
    }

    const conversacionesMap = new Map<string, ConversacionLite>();

    ((conversacionesRes.data || []) as ConversacionLite[]).forEach((conv) => {
      conversacionesMap.set(conv.id, conv);
    });

    const contactosMap = new Map<string, ContactoWaLite>();

    ((contactosRes.data || []) as ContactoWaLite[]).forEach((contacto) => {
      contactosMap.set(contacto.id, contacto);
    });

    const nextOportunidades = ((oportunidadesRes.data || []) as Oportunidad[]).map((opp) => {
      const conversacion = conversacionesMap.get(opp.conversacion_id) || null;
      const contacto = conversacion?.contacto_id ? contactosMap.get(conversacion.contacto_id) || null : null;

      return {
        ...opp,
        conversacion,
        contacto
      };
    });

    setEstados((estadosRes.data || []) as PipelineEstado[]);
    setOportunidades(nextOportunidades);

    setSelectedOpportunity((current) => {
      if (!current) return null;
      return nextOportunidades.find((item) => item.id === current.id) || current;
    });

    if (!options.silent) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    const channelName = `oportunidades-realtime-${Date.now()}`;

    const refreshSilent = () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
      }

      realtimeTimerRef.current = window.setTimeout(() => {
        void loadData({ silent: true });
      }, 300);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_oportunidades"
        },
        refreshSilent
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversaciones"
        },
        refreshSilent
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "contactos_wa"
        },
        refreshSilent
      )
      .subscribe((subscriptionStatus) => {
        console.log("[Oportunidades realtime]", subscriptionStatus);
      });

    function handleNiaActionExecuted() {
      refreshSilent();
    }

    window.addEventListener("nostur:nia-action-executed", handleNiaActionExecuted);

    return () => {
      if (realtimeTimerRef.current) {
        window.clearTimeout(realtimeTimerRef.current);
      }

      if (statusTimerRef.current) {
        window.clearTimeout(statusTimerRef.current);
      }

      window.removeEventListener("nostur:nia-action-executed", handleNiaActionExecuted);
      supabase.removeChannel(channel);
    };
  }, [loadData]);

  useEffect(() => {
    if (!status) return;

    if (statusTimerRef.current) {
      window.clearTimeout(statusTimerRef.current);
    }

    statusTimerRef.current = window.setTimeout(() => {
      setStatus(null);
    }, 2600);
  }, [status]);

  const totalScore = useMemo(() => {
    if (oportunidades.length === 0) return 0;

    return Math.round(oportunidades.reduce((acc, item) => acc + (item.score || 0), 0) / oportunidades.length);
  }, [oportunidades]);

  async function moveOpportunityToEstado(item: OportunidadVM, estado: PipelineEstado) {
    if (item.estado_id === estado.id || actionLoading) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const previous = oportunidades;

    const nextOptimistic = oportunidades.map((opp) =>
      opp.id === item.id
        ? {
            ...opp,
            estado_id: estado.id,
            datos: enrichDatos(opp),
            updated_at: new Date().toISOString()
          }
        : opp
    );

    setOportunidades(nextOptimistic);

    const { error: updateOppError } = await supabase
      .from("lead_oportunidades")
      .update({
        estado_id: estado.id,
        datos: enrichDatos(item),
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id);

    if (updateOppError) {
      setOportunidades(previous);
      setError(updateOppError.message || "No se pudo mover la oportunidad.");
      setActionLoading(false);
      return;
    }

    const { error: updateConvError } = await supabase
      .from("conversaciones")
      .update({
        estado_gestion: estado.es_sin_atender ? "sin_atender" : "en_gestion",
        estado_comercial: estado.nombre,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.conversacion_id);

    if (updateConvError) {
      setError(updateConvError.message || "Se movió la oportunidad, pero no se pudo actualizar la conversación.");
    } else {
      setStatus(`Oportunidad movida a ${estado.nombre}.`);
    }

    await loadData({ silent: true });
    setActionLoading(false);
  }

  function handleDragStart(item: OportunidadVM) {
    setDraggingId(item.id);
  }

  function handleDragOver(event: React.DragEvent<HTMLElement>, estadoId: string) {
    event.preventDefault();
    setDragOverEstadoId(estadoId);
  }

  function handleDragLeave(event: React.DragEvent<HTMLElement>, estadoId: string) {
    event.preventDefault();

    if (dragOverEstadoId === estadoId) {
      setDragOverEstadoId(null);
    }
  }

  async function handleDrop(event: React.DragEvent<HTMLElement>, estado: PipelineEstado) {
    event.preventDefault();

    const item = oportunidades.find((opp) => opp.id === draggingId);

    setDraggingId(null);
    setDragOverEstadoId(null);

    if (!item) return;

    await moveOpportunityToEstado(item, estado);
  }

  function openConversation(item: OportunidadVM) {
    const detail = {
      source: "oportunidades",
      module: "comunicaciones",
      action: "open_conversation_from_opportunity",
      conversation_id: item.conversacion_id,
      conversacion_id: item.conversacion_id,
      wa_phone: getTelefonoOportunidad(item),
      contacto: getNombreOportunidad(item),
      contacto_nombre: getNombreOportunidad(item),
      oportunidad_id: item.id,
      oportunidad_score: item.score || 0,
      oportunidad_estado_id: item.estado_id,
      oportunidad_datos: item.datos || null,
      cande_activa: Boolean(item.cande_activa),
      created_at: new Date().toISOString()
    };

    window.localStorage.setItem("nostur_nia_context", JSON.stringify(detail));

    window.dispatchEvent(
      new CustomEvent("nostur:open-livenos-conversation", {
        detail
      })
    );

    window.dispatchEvent(
      new CustomEvent("nostur:open-nia-chat", {
        detail
      })
    );
  }

  function buildSelectedOpportunityActionDetail(action: string) {
    if (!selectedOpportunity) return null;

    const datos = selectedOpportunity.datos || {};

    return {
      source: "oportunidades",
      module: "comunicaciones",
      action,

      conversation_id: selectedOpportunity.conversacion_id,
      conversacion_id: selectedOpportunity.conversacion_id,

      oportunidad_id: selectedOpportunity.id,
      oportunidad_score: selectedOpportunity.score || 0,
      oportunidad_estado_id: selectedOpportunity.estado_id,
      oportunidad_datos: datos,

      contacto_id: selectedOpportunity.conversacion?.contacto_id || null,
      contacto_nombre: getNombreOportunidad(selectedOpportunity),
      wa_phone: getTelefonoOportunidad(selectedOpportunity),

      destino: getDestinoOportunidad(selectedOpportunity),
      origen: getOrigenLabel(selectedOpportunity),
      fechas: getFechaOportunidad(selectedOpportunity),
      pasajeros: getPaxOportunidad(selectedOpportunity),
      presupuesto: getPresupuestoOportunidad(selectedOpportunity),

      created_at: new Date().toISOString()
    };
  }

  function openModuleFromSelectedOpportunity(params: {
    appId: string;
    url: string;
    title: string;
    action: string;
  }) {
    const detail = buildSelectedOpportunityActionDetail(params.action);

    if (!detail) return;

    window.localStorage.setItem("nostur_opportunity_action_context", JSON.stringify(detail));

    window.dispatchEvent(
      new CustomEvent("nostur:open-internal", {
        detail: {
          appId: params.appId,
          url: params.url,
          title: params.title,
          params: detail
        }
      })
    );

    window.dispatchEvent(
      new CustomEvent("nostur:opportunity-action", {
        detail
      })
    );

    setSelectedOpportunity(null);
  }

  function createBudgetFromSelectedOpportunity() {
    openModuleFromSelectedOpportunity({
      appId: "presupuestos-v2",
      url: "internal://presupuestos-v2",
      title: "Presupuestos",
      action: "create_budget_from_opportunity"
    });
  }

  function createCartFromSelectedOpportunity() {
    openModuleFromSelectedOpportunity({
      appId: "carritos",
      url: "internal://carritos",
      title: "Carritos",
      action: "create_cart_from_opportunity"
    });
  }

  function createFileFromSelectedOpportunity() {
    openModuleFromSelectedOpportunity({
      appId: "files",
      url: "internal://files",
      title: "Files",
      action: "create_file_from_opportunity"
    });
  }

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <OportunidadDetalleModal
        open={Boolean(selectedOpportunity)}
        oportunidad={selectedOpportunity}
        estados={estados}
        contacto={selectedOpportunity?.contacto || null}
        conversacion={selectedOpportunity?.conversacion || null}
        onClose={() => setSelectedOpportunity(null)}
        onOpenConversation={() => {
          if (selectedOpportunity) openConversation(selectedOpportunity);
        }}
        onCreateBudget={createBudgetFromSelectedOpportunity}
        onCreateCart={createCartFromSelectedOpportunity}
        onCreateFile={createFileFromSelectedOpportunity}
      />

      <header className="shrink-0 border-b border-black/10 bg-white/82 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight text-[#172033]">
                Oportunidades
              </h1>

              <span className="rounded-lg bg-emerald-50 px-2 py-1 text-[9.5px] font-medium uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                Pipeline IA
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Pipeline comercial nacido desde conversaciones, Cande y NIA.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadData()}
            disabled={loading}
            className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-white px-3 text-[11.5px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
          >
            <RefreshCcw size={14} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <MiniMetric label="Oportunidades" value={oportunidades.length} />
          <MiniMetric label="Estados" value={estados.length} />
          <MiniMetric label="Score promedio" value={`${totalScore}/100`} />
        </div>

        {error ? (
          <div className="mt-3 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {status ? (
          <div className="mt-3 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-700">
            {status}
          </div>
        ) : null}

        <div className="mt-4 grid gap-3 xl:grid-cols-5">
          {estados.length === 0 ? (
            <div className="xl:col-span-5">
              <EmptyState
                title="Sin estados de pipeline"
                subtitle="Revisá que el seed haya cargado pipeline_estados."
              />
            </div>
          ) : (
            estados.map((estado) => {
              const items = oportunidades.filter((item) => item.estado_id === estado.id);
              const isOver = dragOverEstadoId === estado.id;

              return (
                <section
                  key={estado.id}
                  onDragOver={(event) => handleDragOver(event, estado.id)}
                  onDragLeave={(event) => handleDragLeave(event, estado.id)}
                  onDrop={(event) => void handleDrop(event, estado)}
                  className={[
                    "min-h-[520px] rounded-[20px] border p-2.5 shadow-sm backdrop-blur-xl transition",
                    isOver
                      ? "border-[#4f7c90]/45 bg-[#e9f5f7]"
                      : "border-black/10 bg-white/58"
                  ].join(" ")}
                >
                  <header className="mb-2.5 flex items-center justify-between px-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="h-2 w-2 shrink-0 rounded-full"
                        style={{ backgroundColor: estado.color || "#0f766e" }}
                      />

                      <h2 className="truncate text-[13px] font-semibold text-[#172033]">
                        {estado.nombre}
                      </h2>
                    </div>

                    <span className="text-[11px] font-medium text-[#64748b]">{items.length}</span>
                  </header>

                  <div className="space-y-2">
                    {items.length === 0 ? (
                      <div className="rounded-[16px] border border-dashed border-black/10 bg-white/52 px-3 py-5 text-center text-[11.5px] font-medium text-[#94a3b8]">
                        Sin oportunidades
                      </div>
                    ) : (
                      items.map((item) => {
                        const score = item.score || 0;
                        const nombre = getNombreOportunidad(item);
                        const telefono = getTelefonoOportunidad(item);
                        const destino = getDestinoOportunidad(item);
                        const origen = getOrigenLabel(item);
                        const fechas = getFechaOportunidad(item);
                        const pax = getPaxOportunidad(item);
                        const isDragging = draggingId === item.id;

                        return (
                          <article
                            key={item.id}
                            draggable
                            onDragStart={() => handleDragStart(item)}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverEstadoId(null);
                            }}
                            onClick={() => setSelectedOpportunity(item)}
                            className={[
                              "cursor-grab rounded-[16px] border border-black/10 bg-white px-3 py-3 shadow-sm transition active:cursor-grabbing",
                              isDragging ? "scale-[0.985] opacity-50" : "hover:-translate-y-0.5 hover:shadow-md",
                              actionLoading ? "pointer-events-none opacity-70" : ""
                            ].join(" ")}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <h3 className="truncate text-[13px] font-semibold leading-tight text-[#172033]">
                                  {nombre}
                                </h3>

                                <p className="mt-0.5 truncate text-[11px] font-normal text-[#64748b]">
                                  {telefono}
                                </p>
                              </div>

                              <SoftStatus score={score}>{temperaturaFromScore(score)}</SoftStatus>
                            </div>

                            <div className="mt-2.5 space-y-1 text-[11.5px] font-normal leading-snug text-[#475569]">
                              <p className="truncate">📍 {destino}</p>
                              <p className="truncate">🛫 {origen}</p>
                              <p className="truncate">🗓 {fechas}</p>
                              <p className="truncate">👥 {pax || "—"} pax</p>
                            </div>

                            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={["h-full rounded-full", scoreBarClass(score)].join(" ")}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>

                            <p className="mt-1 text-right text-[10.5px] font-medium text-[#64748b]">
                              {score}/100
                            </p>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </main>
    </section>
  );
}