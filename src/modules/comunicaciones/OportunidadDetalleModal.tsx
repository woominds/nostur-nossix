// src/modules/comunicaciones/OportunidadDetalleModal.tsx

import type { ReactNode } from "react";
import {
  ClipboardCopy,
  FileText,
  FolderKanban,
  MessageCircle,
  ShoppingCart,
  Sparkles,
  X
} from "lucide-react";

type PipelineEstadoLite = {
  id: string;
  nombre: string;
  color: string | null;
};

type OportunidadDetalleModalProps = {
  open: boolean;
  onClose: () => void;
  onOpenConversation?: () => void;
  onUseSuggestedReply?: (text: string) => void;

  onCreateBudget?: () => void;
  onCreateCart?: () => void;
  onCreateFile?: () => void;

  oportunidad: {
    id: string;
    conversacion_id: string;
    estado_id: string | null;
    score: number | null;
    datos: Record<string, unknown> | null;
    cande_activa: boolean | null;
    transferida_at?: string | null;
    cande_handoff_requested_at?: string | null;
    updated_at?: string | null;
    created_at?: string | null;
  } | null;
  estados?: PipelineEstadoLite[];
  contacto?: {
    display_name?: string | null;
    profile_name?: string | null;
    wa_phone?: string | null;
  } | null;
  conversacion?: {
    titulo?: string | null;
    subject?: string | null;
    wa_phone?: string | null;
    last_message_preview?: string | null;
    estado_gestion?: string | null;
    estado_comercial?: string | null;
  } | null;
};

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function getTextFromDatos(
  datos: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = "—"
): string {
  if (!datos) return fallback;

  for (const key of keys) {
    const value = datos[key];

    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      const text = value.map((item) => cleanText(item)).filter(Boolean).join(", ");
      if (text) return text;
      continue;
    }

    if (typeof value === "object") {
      try {
        const text = JSON.stringify(value, null, 2);
        if (text && text !== "{}") return text;
      } catch {
        continue;
      }
    }

    const text = cleanText(value);
    if (text) return text;
  }

  return fallback;
}

function getListFromDatos(datos: Record<string, unknown> | null | undefined, keys: string[]): string[] {
  if (!datos) return [];

  for (const key of keys) {
    const value = datos[key];

    if (Array.isArray(value)) {
      return value.map((item) => cleanText(item)).filter(Boolean);
    }

    if (typeof value === "string" && value.trim()) {
      return value
        .split(/\n|,|;/)
        .map((item) => item.trim())
        .filter(Boolean);
    }
  }

  return [];
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



function scoreBarClass(score: number) {
  if (score >= 75) return "bg-red-500";
  if (score >= 45) return "bg-amber-500";
  return "bg-slate-500";
}

function getNombre(params: OportunidadDetalleModalProps) {
  const datos = params.oportunidad?.datos;

  return (
    getTextFromDatos(
      datos,
      [
        "nombre",
        "contacto_nombre",
        "pasajero",
        "nombre_pasajero",
        "cliente",
        "display_name",
        "profile_name"
      ],
      ""
    ) ||
    cleanText(params.contacto?.display_name) ||
    cleanText(params.contacto?.profile_name) ||
    cleanText(params.conversacion?.titulo) ||
    cleanText(params.conversacion?.subject) ||
    "Sin nombre"
  );
}

function getTelefono(params: OportunidadDetalleModalProps) {
  const datos = params.oportunidad?.datos;

  return (
    getTextFromDatos(datos, ["telefono", "phone", "wa_phone", "celular", "whatsapp"], "") ||
    cleanText(params.contacto?.wa_phone) ||
    cleanText(params.conversacion?.wa_phone) ||
    "Sin teléfono"
  );
}

function SmallPill({
  children,
  tone = "default"
}: {
  children: ReactNode;
  tone?: "default" | "green" | "amber" | "red" | "purple";
}) {
  const toneClass = {
    default: "border-slate-200 bg-white text-[#64748b]",
    green: "border-emerald-200 bg-emerald-50 text-emerald-700",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    red: "border-red-200 bg-red-50 text-red-700",
    purple: "border-purple-200 bg-purple-50 text-purple-700"
  }[tone];

  return (
    <span
      className={[
        "inline-flex h-6 max-w-full items-center gap-1.5 rounded-lg border px-2 text-[10.5px] font-medium leading-none",
        toneClass
      ].join(" ")}
    >
      {children}
    </span>
  );
}

function InfoCard({
  label,
  value,
  helper
}: {
  label: string;
  value: string | number | null;
  helper?: string | null;
}) {
  return (
    <div className="rounded-xl border border-black/10 bg-white px-3.5 py-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </div>

      <div className="mt-1 whitespace-pre-wrap text-[13px] font-semibold leading-relaxed text-[#172033]">
        {value || "—"}
      </div>

      {helper ? (
        <div className="mt-1 text-[11px] font-normal leading-relaxed text-[#64748b]">
          {helper}
        </div>
      ) : null}
    </div>
  );
}

function TextPanel({
  title,
  children,
  tone = "default",
  className = ""
}: {
  title: string;
  children: ReactNode;
  tone?: "default" | "amber" | "purple" | "green";
  className?: string;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-200 bg-amber-50/70"
      : tone === "purple"
        ? "border-purple-200 bg-purple-50/70"
        : tone === "green"
          ? "border-emerald-200 bg-emerald-50/70"
          : "border-black/10 bg-white";

  return (
    <section className={["rounded-xl border p-3.5", toneClass, className].join(" ")}>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
        {title}
      </div>

      {children}
    </section>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  variant = "default"
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "success" | "amber" | "purple";
}) {
  const variantClass = {
    default: "bg-white text-[#334155] ring-black/10 hover:bg-[#f8fafc]",
    primary: "bg-[#4f7c90] text-white ring-[#4f7c90]/20 hover:bg-[#456f82]",
    success: "bg-emerald-600 text-white ring-emerald-600/20 hover:bg-emerald-700",
    amber: "bg-amber-500 text-white ring-amber-500/20 hover:bg-amber-600",
    purple: "bg-purple-500 text-white ring-purple-500/20 hover:bg-purple-600"
  }[variant];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3.5 text-[12px] font-semibold shadow-sm ring-1 transition disabled:cursor-not-allowed disabled:opacity-50",
        variantClass
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function OportunidadDetalleModal({
  open,
  onClose,
  onOpenConversation,
  onUseSuggestedReply,
  onCreateBudget,
  onCreateCart,
  onCreateFile,
  oportunidad,
  estados = [],
  contacto,
  conversacion
}: OportunidadDetalleModalProps) {
  if (!open || !oportunidad) return null;

  const datos = oportunidad.datos || {};
  const score = Number(oportunidad.score || 0);
  const estado = estados.find((item) => item.id === oportunidad.estado_id) || null;

  const nombre = getNombre({ open, onClose, oportunidad, estados, contacto, conversacion });
  const telefono = getTelefono({ open, onClose, oportunidad, estados, contacto, conversacion });

  const destino = getTextFromDatos(
    datos,
    ["destino", "destinos", "lugar", "ciudad_destino", "pais", "país"],
    "Destino sin relevar"
  );

  const origen = getTextFromDatos(
    datos,
    ["origen", "ciudad_origen", "salida_desde"],
    "Origen sin confirmar"
  );

  const origenSugerido = getTextFromDatos(datos, ["origen_sugerido"], "");

  const origenAeropuerto = getTextFromDatos(
    datos,
    ["origen_aeropuerto", "origen_sugerido_aeropuerto", "aeropuerto_origen"],
    ""
  );

  const origenConfirmado = datos.origen_confirmado === true;

  const fechas = getTextFromDatos(
    datos,
    ["fechas_tentativas", "fecha_tentativa", "fecha", "fechas", "cuando", "cuándo", "fecha_viaje", "mes"],
    "Fecha sin relevar"
  );

  const pax = getNumberFromDatos(datos, [
    "cantidad_pasajeros",
    "pax",
    "pasajeros",
    "personas",
    "cantidad_pax"
  ]);

  const presupuesto = getTextFromDatos(
    datos,
    ["presupuesto_aproximado", "presupuesto", "budget", "monto_estimado"],
    "Presupuesto sin relevar"
  );

  const tipoViaje = getTextFromDatos(datos, ["tipo_viaje", "tipo_de_viaje", "categoria_viaje"], "—");
  const hoteleria = getTextFromDatos(datos, ["hoteleria", "hotel", "hotel_preferido", "categoria_hotel"], "—");
  const regimen = getTextFromDatos(datos, ["regimen", "régimen", "alimentacion", "all_inclusive"], "—");
  const habitaciones = getTextFromDatos(datos, ["habitaciones", "habitacion", "distribucion_habitaciones"], "—");
  const menores = getTextFromDatos(datos, ["menores", "edades_menores", "edad_menores", "children_ages"], "—");
  const servicios = getTextFromDatos(datos, ["servicios", "servicio", "productos_interes", "intereses"], "—");

  const resumen = getTextFromDatos(
    datos,
    ["resumen_ia", "resumen", "summary", "analisis", "analisis_cliente", "customer_summary"],
    "Sin resumen IA cargado todavía."
  );

  const intencion = getTextFromDatos(
    datos,
    ["intencion_compra", "intencion", "nivel_interes", "momento_compra", "purchase_intent"],
    "Sin intención detectada."
  );

  const urgencia = getTextFromDatos(
    datos,
    ["urgencia", "prioridad", "urgency", "deadline", "fecha_limite"],
    "Sin urgencia detectada."
  );

  const proximaAccion = getTextFromDatos(
    datos,
    ["proxima_accion", "next_action", "accion_sugerida", "siguiente_paso"],
    "Sin próxima acción sugerida."
  );

  const respuestaSugerida = getTextFromDatos(
    datos,
    [
      "proxima_respuesta_sugerida",
      "respuesta_sugerida",
      "mensaje_sugerido",
      "next_reply_suggested",
      "suggested_reply"
    ],
    ""
  );

  const ultimoMensaje =
    getTextFromDatos(datos, ["ultimo_mensaje", "last_message", "mensaje"], "") ||
    cleanText(conversacion?.last_message_preview) ||
    "Sin último mensaje registrado.";

  const datosFaltantes = getListFromDatos(datos, [
    "datos_faltantes",
    "faltantes",
    "missing_info",
    "customer_ai_missing_info",
    "pendientes",
    "datos_pendientes"
  ]);

  const objeciones = getListFromDatos(datos, ["objeciones", "riesgos", "alertas", "observaciones_ia"]);

  const hasSuggestedReply = Boolean(respuestaSugerida.trim());

  async function copySuggestedReply() {
    if (!hasSuggestedReply) return;

    try {
      await navigator.clipboard.writeText(respuestaSugerida);
    } catch {
      // Si el navegador no permite copiar, no rompemos la modal.
    }
  }

  return (
    <div className="fixed inset-0 z-[920] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-[1080px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-black/10">
        <div className="flex items-start justify-between gap-4 border-b border-black/10 px-6 py-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[22px] font-semibold leading-tight text-[#172033]">
                {nombre}
              </h2>

              <SmallPill tone={score >= 75 ? "red" : score >= 45 ? "amber" : "default"}>
                🔥 {temperaturaFromScore(score)}
              </SmallPill>
            </div>

            <p className="mt-1 text-[13px] font-medium text-[#64748b]">{telefono}</p>

            <div className="mt-3 flex flex-wrap gap-1.5">
              <SmallPill>Score {score}/100</SmallPill>

              {estado ? (
                <SmallPill>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: estado.color || "#4f7c90" }}
                  />
                  {estado.nombre}
                </SmallPill>
              ) : null}

              {oportunidad.cande_activa ? (
                <SmallPill tone="green">CANDE activa</SmallPill>
              ) : (
                <SmallPill>CANDE pausada</SmallPill>
              )}

              {datosFaltantes.length > 0 ? (
                <SmallPill tone="amber">{datosFaltantes.length} dato/s faltante/s</SmallPill>
              ) : (
                <SmallPill tone="green">Datos principales completos</SmallPill>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={18} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] px-6 py-5">
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
            <div className="space-y-4">
              <section>
                <div className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
                  Datos relevados
                </div>

                <div className="grid gap-2.5 md:grid-cols-2">
                  <InfoCard label="Destino" value={destino} />
                  <InfoCard
                    label={origenConfirmado ? "Origen confirmado" : origenSugerido ? "Origen sugerido" : "Origen"}
                    value={origen !== "Origen sin confirmar" ? origen : origenSugerido || origen}
                    helper={!origenConfirmado && origenAeropuerto ? `Aeropuerto sugerido: ${origenAeropuerto}` : null}
                  />
                  <InfoCard label="Fechas tentativas" value={fechas} />
                  <InfoCard label="Cantidad de pasajeros" value={pax || "—"} />
                  <InfoCard label="Presupuesto" value={presupuesto} />
                  <InfoCard label="Tipo de viaje" value={tipoViaje} />
                  <InfoCard label="Hotelería" value={hoteleria} />
                  <InfoCard label="Régimen" value={regimen} />
                  <InfoCard label="Habitaciones" value={habitaciones} />
                  <InfoCard label="Menores / edades" value={menores} />
                  <InfoCard label="Servicios de interés" value={servicios} />
                  <InfoCard label="Último mensaje" value={ultimoMensaje} />
                </div>
              </section>

              <TextPanel title="Resumen IA" tone="purple">
                <div className="whitespace-pre-wrap text-[13px] font-medium leading-relaxed text-[#475569]">
                  {resumen}
                </div>
              </TextPanel>

              <TextPanel title="Próxima respuesta sugerida" tone={hasSuggestedReply ? "green" : "default"}>
                {hasSuggestedReply ? (
                  <>
                    <div className="whitespace-pre-wrap rounded-xl bg-white p-3 text-[13px] font-medium leading-relaxed text-[#172033] ring-1 ring-black/5">
                      {respuestaSugerida}
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <ActionButton onClick={copySuggestedReply}>
                        <ClipboardCopy size={14} />
                        Copiar
                      </ActionButton>

                      {onUseSuggestedReply ? (
                        <ActionButton onClick={() => onUseSuggestedReply(respuestaSugerida)} variant="primary">
                          <MessageCircle size={14} />
                          Usar en el chat
                        </ActionButton>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="text-[13px] font-medium text-[#64748b]">
                    Todavía no hay una respuesta sugerida cargada por CANDE/NIA.
                  </div>
                )}
              </TextPanel>
            </div>

            <aside className="space-y-4">
              <TextPanel title="Temperatura del lead">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[13px] font-medium text-[#475569]">Puntaje actual</span>
                  <span className="text-[13px] font-semibold text-[#172033]">{score} / 100</span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={["h-full rounded-full", scoreBarClass(score)].join(" ")}
                    style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
                  />
                </div>

                <div className="mt-2.5 text-[13px] font-semibold text-[#172033]">
                  {temperaturaFromScore(score)}
                </div>
              </TextPanel>

              <TextPanel title="Datos faltantes" tone={datosFaltantes.length > 0 ? "amber" : "green"}>
                {datosFaltantes.length > 0 ? (
                  <ul className="space-y-1.5">
                    {datosFaltantes.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg bg-white px-2.5 py-2 text-[12px] font-medium text-amber-800 shadow-sm ring-1 ring-amber-100"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[13px] font-medium text-emerald-700">
                    No hay datos faltantes informados.
                  </div>
                )}
              </TextPanel>

              <TextPanel title="Análisis comercial">
                <div className="space-y-2.5">
                  <InfoCard label="Intención de compra" value={intencion} />
                  <InfoCard label="Urgencia" value={urgencia} />
                  <InfoCard label="Próxima acción" value={proximaAccion} />
                </div>
              </TextPanel>

              <TextPanel title="Objeciones / alertas" tone={objeciones.length > 0 ? "amber" : "default"}>
                {objeciones.length > 0 ? (
                  <ul className="space-y-1.5">
                    {objeciones.map((item) => (
                      <li
                        key={item}
                        className="rounded-lg bg-white px-2.5 py-2 text-[12px] font-medium text-[#475569] shadow-sm ring-1 ring-black/5"
                      >
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[13px] font-medium text-[#64748b]">
                    Sin objeciones o alertas detectadas.
                  </div>
                )}
              </TextPanel>

              <TextPanel title="IDs internos">
                <div className="space-y-2 text-[11.5px] font-normal text-[#64748b]">
                  <div>
                    <span className="block font-medium text-[#172033]">Oportunidad</span>
                    <span className="break-all">{oportunidad.id}</span>
                  </div>

                  <div>
                    <span className="block font-medium text-[#172033]">Conversación</span>
                    <span className="break-all">{oportunidad.conversacion_id}</span>
                  </div>
                </div>
              </TextPanel>
            </aside>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-black/10 bg-white px-6 py-4">
          <div className="mr-auto flex flex-wrap items-center gap-2">
            {onCreateBudget ? (
              <ActionButton onClick={onCreateBudget}>
                <FileText size={15} />
                Crear presupuesto
              </ActionButton>
            ) : null}

            {onCreateCart ? (
              <ActionButton onClick={onCreateCart} variant="success">
                <ShoppingCart size={15} />
                Generar carrito
              </ActionButton>
            ) : null}

            {onCreateFile ? (
              <ActionButton onClick={onCreateFile} variant="amber">
                <FolderKanban size={15} />
                Generar file
              </ActionButton>
            ) : null}
          </div>

          <ActionButton onClick={onClose}>Cerrar</ActionButton>

          {onOpenConversation ? (
            <ActionButton onClick={onOpenConversation} variant="primary">
              <MessageCircle size={15} />
              Abrir conversación
            </ActionButton>
          ) : null}

          <ActionButton
            onClick={() => onUseSuggestedReply?.(respuestaSugerida)}
            disabled={!hasSuggestedReply || !onUseSuggestedReply}
            variant="purple"
          >
            <Sparkles size={15} />
            Usar respuesta sugerida
          </ActionButton>
        </div>
      </div>
    </div>
  );
}

export default OportunidadDetalleModal;