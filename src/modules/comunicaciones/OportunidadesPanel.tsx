// src/components/comunicaciones/OportunidadesPanel.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  ChevronDown,
  Loader2,
  MessageCircle,
  Minus,
  Plus,
  RefreshCcw,
  Search,
  UserPlus,
  X
} from "lucide-react";
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
  conversacion_id: string | null;
  estado_id: string | null;
  score: number | null;
  datos: Record<string, unknown> | null;
  assigned_to: string | null;
  cande_activa: boolean | null;
  transferida_at: string | null;
  updated_at: string | null;
  created_at: string | null;

  origen?: string | null;
  metodo_contacto?: string | null;
  nombre_contacto?: string | null;
  telefono?: string | null;
  email?: string | null;
  notas?: string | null;
  contacto_wa_id?: string | null;
  created_manually?: boolean | null;
  created_by?: string | null;
  sucursal_id?: string | null;
  canal_preferido?: string | null;
  conversacion_creada_desde_oportunidad_at?: string | null;
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

type DestinoOption = {
  id: string;
  nombre: string;
  pais?: string | null;
};

type ProfileLite = {
  id: string;
  nombre: string | null;
  apellido: string | null;
  email: string | null;
  rol: string | null;
  activo?: boolean | null;
  visible_en_sistema?: boolean | null;
  color?: string | null;
  is_support_user?: boolean | null;
  is_super_admin?: boolean | null;
};

type SelectOption = {
  value: string;
  label: string;
  helper?: string | null;
};

type PassengerDraft = {
  adultos: number;
  menores: number;
  edadesMenores: string;
};

type OportunidadVM = Oportunidad & {
  conversacion?: ConversacionLite | null;
  contacto?: ContactoWaLite | null;
};

type ManualOpportunityDraft = {
  nombre_contacto: string;
  telefono: string;
  email: string;
  origen: string;
  metodo_contacto: string;
  destino: string;
  origen_viaje: string;
  fechas: string;
  pasajeros: PassengerDraft;
  presupuesto: string;
  notas: string;
  crear_conversacion_whatsapp: boolean;
};

const SELLER_FILTER_ALL = "__all__";
const SELLER_FILTER_UNASSIGNED = "__unassigned__";

const EMPTY_PASSENGERS: PassengerDraft = {
  adultos: 2,
  menores: 0,
  edadesMenores: ""
};

const EMPTY_MANUAL_DRAFT: ManualOpportunityDraft = {
  nombre_contacto: "",
  telefono: "",
  email: "",
  origen: "retail",
  metodo_contacto: "retail",
  destino: "",
  origen_viaje: "",
  fechas: "",
  pasajeros: EMPTY_PASSENGERS,
  presupuesto: "",
  notas: "",
  crear_conversacion_whatsapp: false
};

const ORIGEN_OPTIONS: SelectOption[] = [
  { value: "retail", label: "Retail / local" },
  { value: "telefono", label: "Teléfono" },
  { value: "whatsapp", label: "WhatsApp" },
  { value: "instagram", label: "Instagram" },
  { value: "web", label: "Web" },
  { value: "referido", label: "Referido" },
  { value: "cliente_anterior", label: "Cliente anterior" },
  { value: "campaña", label: "Campaña" },
  { value: "mail", label: "Mail" },
  { value: "otro", label: "Otro" }
];

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function normalizePhone(value: unknown): string {
  return String(value || "").replace(/[^\d+]/g, "").trim();
}

function normalizeSearch(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function profileName(profile: ProfileLite | null | undefined) {
  if (!profile) return "Sin vendedor";

  const fullName = `${cleanText(profile.nombre)} ${cleanText(profile.apellido)}`.trim();

  return fullName || cleanText(profile.email) || "Usuario";
}

function canSeeAllOpportunities(profile: ProfileLite | null | undefined) {
  return (
    profile?.rol === "gerencia" ||
    profile?.rol === "admin_general" ||
    profile?.is_support_user === true ||
    profile?.is_super_admin === true
  );
}

function getOpportunityOwnerIds(item: OportunidadVM) {
  return [
    item.assigned_to || null,
    item.conversacion?.assigned_to || null
  ].filter((value): value is string => Boolean(value));
}

function getEffectiveSellerId(item: OportunidadVM) {
  return item.assigned_to || item.conversacion?.assigned_to || null;
}

function opportunityBelongsToSeller(item: OportunidadVM, sellerId: string | null) {
  if (!sellerId) return false;

  return (
    item.assigned_to === sellerId ||
    item.conversacion?.assigned_to === sellerId
  );
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

function passengerTotal(passengers: PassengerDraft) {
  return Math.max(0, Number(passengers.adultos || 0)) + Math.max(0, Number(passengers.menores || 0));
}

function passengerLabel(passengers: PassengerDraft) {
  const adultos = Math.max(0, Number(passengers.adultos || 0));
  const menores = Math.max(0, Number(passengers.menores || 0));
  const edades = cleanText(passengers.edadesMenores);

  const adultosLabel = adultos === 1 ? "1 adulto" : `${adultos} adultos`;
  const menoresLabel = menores === 1 ? "1 menor" : `${menores} menores`;

  if (menores > 0 && edades) return `${adultosLabel}, ${menoresLabel} (${edades})`;
  if (menores > 0) return `${adultosLabel}, ${menoresLabel}`;
  return adultosLabel;
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
  const fromColumns = cleanText(item.nombre_contacto);
  if (fromColumns) return fromColumns;

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
  const fromColumns = cleanText(item.telefono);
  if (fromColumns) return fromColumns;

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
  const passengerText = getTextFromDatos(item.datos, ["pasajeros_detalle", "pasajeros_label"], "");
  if (passengerText) return passengerText;

  const pax = getNumberFromDatos(item.datos, [
    "cantidad_pasajeros",
    "pax",
    "pasajeros",
    "personas",
    "cantidad_pax"
  ]);

  return pax ? `${pax} pax` : "—";
}

function getPresupuestoOportunidad(item: OportunidadVM) {
  return getTextFromDatos(
    item.datos,
    ["presupuesto_aproximado", "presupuesto", "budget", "monto_estimado"],
    "Presupuesto sin relevar"
  );
}

function getOrigenComercialLabel(item: OportunidadVM) {
  const value =
    cleanText(item.origen) ||
    cleanText(item.metodo_contacto) ||
    cleanText(item.datos?.origen_oportunidad) ||
    cleanText(item.datos?.metodo_contacto) ||
    (item.conversacion_id ? "whatsapp" : "manual");

  const found = ORIGEN_OPTIONS.find((option) => option.value === value);
  return found?.label || value;
}

function enrichDatos(item: OportunidadVM) {
  const nombre = getNombreOportunidad(item);
  const telefono = getTelefonoOportunidad(item);
  const ultimoMensaje =
    cleanText(item.conversacion?.last_message_preview) ||
    cleanText(item.datos?.ultimo_mensaje) ||
    cleanText(item.notas) ||
    null;

  return {
    ...(item.datos || {}),
    nombre: cleanText((item.datos || {}).nombre) || nombre,
    contacto_nombre: cleanText((item.datos || {}).contacto_nombre) || nombre,
    pasajero: cleanText((item.datos || {}).pasajero) || nombre,
    telefono: cleanText((item.datos || {}).telefono) || telefono,
    wa_phone: cleanText((item.datos || {}).wa_phone) || telefono,
    ultimo_mensaje: ultimoMensaje,
    origen_livenos: Boolean(item.conversacion_id),
    origen_oportunidad:
      cleanText(item.origen) ||
      cleanText((item.datos || {}).origen_oportunidad) ||
      "manual",
    metodo_contacto:
      cleanText(item.metodo_contacto) ||
      cleanText((item.datos || {}).metodo_contacto) ||
      "manual",
    conversation_id: item.conversacion_id || null,
    conversacion_id: item.conversacion_id || null
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
  children: ReactNode;
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

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
      {children}
    </label>
  );
}

function ModalInput({
  value,
  onChange,
  placeholder,
  autoFocus = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90] focus:ring-3 focus:ring-[#4f7c90]/10"
    />
  );
}

function ModalTextarea({
  value,
  onChange,
  placeholder,
  rows = 4
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-normal leading-relaxed text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90] focus:ring-3 focus:ring-[#4f7c90]/10"
    />
  );
}

function NosturSelect({
  value,
  options,
  placeholder,
  searchable = false,
  disabled = false,
  onChange
}: {
  value: string;
  options: SelectOption[];
  placeholder: string;
  searchable?: boolean;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((option) => option.value === value) || null;

  const filteredOptions = useMemo(() => {
    const clean = normalizeSearch(search);

    if (!clean) return options;

    return options.filter((option) =>
      normalizeSearch([option.label, option.helper, option.value].filter(Boolean).join(" ")).includes(clean)
    );
  }, [options, search]);

  return (
    <div className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setOpen((current) => !current);
        }}
        className={[
          "flex h-10 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-[13px] font-normal shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60",
          open
            ? "border-[#4f7c90] bg-white text-[#172033] ring-3 ring-[#4f7c90]/10"
            : "border-black/10 bg-white text-[#172033] hover:border-[#4f7c90]/40"
        ].join(" ")}
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected ? selected.label : placeholder}
        </span>

        <ChevronDown
          size={16}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[940] cursor-default bg-transparent"
            onClick={() => {
              setSearch("");
              setOpen(false);
            }}
            tabIndex={-1}
          />

          <div className="absolute left-0 right-0 top-[44px] z-[950] overflow-hidden rounded-2xl border border-black/10 bg-white shadow-2xl">
            {searchable ? (
              <div className="border-b border-black/10 p-2">
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar..."
                  autoFocus
                  className="h-9 w-full rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                />
              </div>
            ) : null}

            <div className="max-h-[260px] overflow-auto p-2">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setSearch("");
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-normal transition",
                  !value
                    ? "bg-[#eef6f7] text-[#4f7c90]"
                    : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#172033]"
                ].join(" ")}
              >
                {placeholder}
              </button>

              {filteredOptions.length === 0 ? (
                <div className="rounded-xl px-3 py-3 text-xs font-normal text-[#94a3b8]">
                  Sin resultados.
                </div>
              ) : (
                filteredOptions.map((option) => {
                  const active = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setSearch("");
                        setOpen(false);
                      }}
                      className={[
                        "flex w-full items-start justify-between gap-3 rounded-xl px-3 py-2 text-left transition",
                        active
                          ? "bg-[#eef6f7] text-[#4f7c90]"
                          : "text-[#172033] hover:bg-[#f8fafc]"
                      ].join(" ")}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium">
                          {option.label}
                        </span>

                        {option.helper ? (
                          <span className="mt-0.5 block truncate text-[11px] font-normal text-[#94a3b8]">
                            {option.helper}
                          </span>
                        ) : null}
                      </span>

                      {active ? (
                        <span className="shrink-0 text-xs font-medium text-[#4f7c90]">✓</span>
                      ) : null}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function CounterButton({
  onClick,
  disabled,
  children
}: {
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function PassengerSelector({
  value,
  onChange
}: {
  value: PassengerDraft;
  onChange: (value: PassengerDraft) => void;
}) {
  const adultos = Math.max(1, Number(value.adultos || 1));
  const menores = Math.max(0, Number(value.menores || 0));

  function patch(patchValue: Partial<PassengerDraft>) {
    onChange({
      adultos,
      menores,
      edadesMenores: value.edadesMenores || "",
      ...patchValue
    });
  }

  return (
    <div className="rounded-2xl border border-black/10 bg-white p-3 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-[#f8fafc] p-3 ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold text-[#172033]">Adultos</div>
              <div className="mt-0.5 text-[10.5px] font-normal text-[#64748b]">
                Desde 12 años
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CounterButton
                onClick={() => patch({ adultos: Math.max(1, adultos - 1) })}
                disabled={adultos <= 1}
              >
                <Minus size={14} />
              </CounterButton>

              <span className="w-6 text-center text-[14px] font-semibold text-[#172033]">
                {adultos}
              </span>

              <CounterButton onClick={() => patch({ adultos: adultos + 1 })}>
                <Plus size={14} />
              </CounterButton>
            </div>
          </div>
        </div>

        <div className="rounded-xl bg-[#f8fafc] p-3 ring-1 ring-black/5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold text-[#172033]">Menores</div>
              <div className="mt-0.5 text-[10.5px] font-normal text-[#64748b]">
                Menores de 12 años
              </div>
            </div>

            <div className="flex items-center gap-2">
              <CounterButton
                onClick={() => patch({ menores: Math.max(0, menores - 1) })}
                disabled={menores <= 0}
              >
                <Minus size={14} />
              </CounterButton>

              <span className="w-6 text-center text-[14px] font-semibold text-[#172033]">
                {menores}
              </span>

              <CounterButton onClick={() => patch({ menores: menores + 1 })}>
                <Plus size={14} />
              </CounterButton>
            </div>
          </div>
        </div>
      </div>

      {menores > 0 ? (
        <div className="mt-3">
          <FieldLabel>Edades de menores</FieldLabel>
          <ModalInput
            value={value.edadesMenores || ""}
            onChange={(next) => patch({ edadesMenores: next })}
            placeholder="Ej: 4 y 8 años"
          />
        </div>
      ) : null}

      <div className="mt-3 rounded-xl bg-[#eef6f7] px-3 py-2 text-[12px] font-medium text-[#4f7c90]">
        Total: {passengerTotal({ adultos, menores, edadesMenores: value.edadesMenores })} pasajero/s
      </div>
    </div>
  );
}

export function OportunidadesPanel() {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [estados, setEstados] = useState<PipelineEstado[]>([]);
  const [oportunidades, setOportunidades] = useState<OportunidadVM[]>([]);
  const [destinosConfig, setDestinosConfig] = useState<DestinoOption[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentProfile, setCurrentProfile] = useState<ProfileLite | null>(null);
  const [sellerFilter, setSellerFilter] = useState(SELLER_FILTER_ALL);
  const [selectedOpportunity, setSelectedOpportunity] = useState<OportunidadVM | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverEstadoId, setDragOverEstadoId] = useState<string | null>(null);
  const [manualModalOpen, setManualModalOpen] = useState(false);
  const [manualDraft, setManualDraft] = useState<ManualOpportunityDraft>(EMPTY_MANUAL_DRAFT);
  const [manualSaving, setManualSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const realtimeTimerRef = useRef<number | null>(null);
  const statusTimerRef = useRef<number | null>(null);

  const canSeeAll = useMemo(() => {
    return canSeeAllOpportunities(currentProfile);
  }, [currentProfile]);

  const loadData = useCallback(
    async (options: { silent?: boolean } = {}) => {
      if (!options.silent) {
        setLoading(true);
      }

      setError(null);

      const { data: authData, error: authError } = await supabase.auth.getUser();
      const userId = authData.user?.id || null;

      if (authError || !userId) {
        setError(authError?.message || "No se pudo identificar el usuario actual.");

        if (!options.silent) {
          setLoading(false);
        }

        return;
      }

      setCurrentUserId(userId);

      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("id,nombre,apellido,email,rol,activo,visible_en_sistema,color,is_support_user,is_super_admin")
        .eq("id", userId)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message || "No se pudo cargar el perfil actual.");

        if (!options.silent) {
          setLoading(false);
        }

        return;
      }

      const nextCurrentProfile = (profileData || null) as unknown as ProfileLite | null;
      const nextCanSeeAll = canSeeAllOpportunities(nextCurrentProfile);

      setCurrentProfile(nextCurrentProfile);

     

    let oportunidadesQuery = supabase
  .from("lead_oportunidades")
  .select(
    [
      "id",
      "conversacion_id",
      "estado_id",
      "score",
      "datos",
      "assigned_to",
      "cande_activa",
      "transferida_at",
      "updated_at",
      "created_at",
      "origen",
      "metodo_contacto",
      "nombre_contacto",
      "telefono",
      "email",
      "notas",
      "contacto_wa_id",
      "created_manually",
      "created_by",
      "sucursal_id",
      "canal_preferido",
      "conversacion_creada_desde_oportunidad_at"
    ].join(",")
  )
  .order("updated_at", { ascending: false, nullsFirst: false })
  .limit(300);

      const [
        estadosRes,
        oportunidadesRes,
        conversacionesRes,
        contactosRes,
        destinosRes,
        profilesRes
      ] = await Promise.all([
        supabase
          .from("pipeline_estados")
          .select("id,nombre,color,orden,es_final,resultado,es_sin_atender")
          .order("orden", { ascending: true }),

        oportunidadesQuery,

        supabase
          .from("conversaciones")
          .select(
            "id,contacto_id,wa_phone,titulo,subject,estado_gestion,estado_comercial,assigned_to,last_message_preview,last_message_at"
          )
          .is("deleted_at", null)
          .limit(700),

        supabase
          .from("contactos_wa")
          .select("id,wa_phone,display_name,profile_name")
          .limit(700),

        supabase
          .from("destinos")
          .select("id,nombre,pais")
          .order("nombre", { ascending: true })
          .limit(1000),

        supabase
          .from("profiles")
          .select("id,nombre,apellido,email,rol,activo,visible_en_sistema,color,is_support_user,is_super_admin")
          .order("nombre", { ascending: true })
          .limit(500)
      ]);

      const firstError =
        estadosRes.error ||
        oportunidadesRes.error ||
        conversacionesRes.error ||
        contactosRes.error ||
        destinosRes.error ||
        profilesRes.error;

      if (firstError) {
        setError(firstError.message || "Error cargando oportunidades");

        if (!options.silent) {
          setLoading(false);
        }

        return;
      }

      const conversacionesMap = new Map<string, ConversacionLite>();

      ((conversacionesRes.data || []) as unknown as ConversacionLite[]).forEach((conv) => {
        conversacionesMap.set(conv.id, conv);
      });

      const contactosMap = new Map<string, ContactoWaLite>();

      ((contactosRes.data || []) as unknown as ContactoWaLite[]).forEach((contacto) => {
        contactosMap.set(contacto.id, contacto);
      });

     const allOportunidades = ((oportunidadesRes.data || []) as unknown as Oportunidad[]).map(
  (opp) => {
    const conversacion = opp.conversacion_id
      ? conversacionesMap.get(opp.conversacion_id) || null
      : null;

    const contacto = conversacion?.contacto_id
      ? contactosMap.get(conversacion.contacto_id) || null
      : opp.contacto_wa_id
        ? contactosMap.get(opp.contacto_wa_id) || null
        : null;

    return {
      ...opp,
      conversacion,
      contacto
    };
  }
);

const nextOportunidades = allOportunidades.filter((opp) => {
  if (!nextCanSeeAll) {
    return opportunityBelongsToSeller(opp, userId);
  }

  if (sellerFilter === SELLER_FILTER_UNASSIGNED) {
    return getOpportunityOwnerIds(opp).length === 0;
  }

  if (sellerFilter && sellerFilter !== SELLER_FILTER_ALL) {
    return opportunityBelongsToSeller(opp, sellerFilter);
  }

  return true;
});
    

      setEstados((estadosRes.data || []) as unknown as PipelineEstado[]);
      setOportunidades(nextOportunidades);
      setDestinosConfig((destinosRes.data || []) as unknown as DestinoOption[]);
      setProfiles((profilesRes.data || []) as unknown as ProfileLite[]);

      setSelectedOpportunity((current) => {
        if (!current) return null;
        return nextOportunidades.find((item) => item.id === current.id) || null;
      });

      if (!options.silent) {
        setLoading(false);
      }
    },
    [sellerFilter]
  );

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!canSeeAll && sellerFilter !== SELLER_FILTER_ALL) {
      setSellerFilter(SELLER_FILTER_ALL);
    }
  }, [canSeeAll, sellerFilter]);

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

  const destinoOptions = useMemo<SelectOption[]>(() => {
    return destinosConfig.map((destino) => ({
      value: destino.nombre,
      label: destino.nombre,
      helper: destino.pais || null
    }));
  }, [destinosConfig]);

  const vendedorOptions = useMemo<SelectOption[]>(() => {
    const activeProfiles = profiles
      .filter((profile) => profile.visible_en_sistema !== false)
      .filter((profile) => profile.activo !== false)
      .sort((a, b) => profileName(a).localeCompare(profileName(b), "es"));

    return [
      { value: SELLER_FILTER_ALL, label: "Todos los vendedores" },
      { value: SELLER_FILTER_UNASSIGNED, label: "Sin asignar" },
      ...activeProfiles.map((profile) => ({
        value: profile.id,
        label: profileName(profile),
        helper: [profile.email, profile.rol].filter(Boolean).join(" · ")
      }))
    ];
  }, [profiles]);

  const selectedSellerLabel = useMemo(() => {
    if (!canSeeAll) return profileName(currentProfile);
    return vendedorOptions.find((option) => option.value === sellerFilter)?.label || "Todos los vendedores";
  }, [canSeeAll, currentProfile, sellerFilter, vendedorOptions]);

  const totalScore = useMemo(() => {
    if (oportunidades.length === 0) return 0;

    return Math.round(oportunidades.reduce((acc, item) => acc + (item.score || 0), 0) / oportunidades.length);
  }, [oportunidades]);

  const manualCount = useMemo(() => {
    return oportunidades.filter((item) => item.created_manually || !item.conversacion_id).length;
  }, [oportunidades]);

  const whatsappLinkedCount = useMemo(() => {
    return oportunidades.filter((item) => Boolean(item.conversacion_id)).length;
  }, [oportunidades]);

  function patchManualDraft(patch: Partial<ManualOpportunityDraft>) {
    setManualDraft((current) => ({
      ...current,
      ...patch
    }));
    setError(null);
    setStatus(null);
  }

  function resetManualModal() {
    setManualDraft({
      ...EMPTY_MANUAL_DRAFT,
      pasajeros: { ...EMPTY_PASSENGERS }
    });
    setManualModalOpen(false);
    setManualSaving(false);
  }

  async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  }

function canActOnOpportunity(item: OportunidadVM) {
  if (canSeeAll) return true;
  return opportunityBelongsToSeller(item, currentUserId);
}

  async function moveOpportunityToEstado(item: OportunidadVM, estado: PipelineEstado) {
    if (item.estado_id === estado.id || actionLoading) return;

    if (!canActOnOpportunity(item)) {
      setError("No tenés permiso para modificar esta oportunidad.");
      return;
    }

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

    let updateQuery = supabase
      .from("lead_oportunidades")
      .update({
        estado_id: estado.id,
        datos: enrichDatos(item),
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id);

    if (!canSeeAll && currentUserId) {
      updateQuery = updateQuery.eq("assigned_to", currentUserId);
    }

    const { error: updateOppError } = await updateQuery;

    if (updateOppError) {
      setOportunidades(previous);
      setError(updateOppError.message || "No se pudo mover la oportunidad.");
      setActionLoading(false);
      return;
    }

    if (item.conversacion_id) {
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
    } else {
      setStatus(`Oportunidad movida a ${estado.nombre}.`);
    }

    await loadData({ silent: true });
    setActionLoading(false);
  }

  function handleDragStart(item: OportunidadVM) {
    if (!canActOnOpportunity(item)) {
      setError("No tenés permiso para mover esta oportunidad.");
      return;
    }

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

  async function ensureWhatsappConversation(item: OportunidadVM): Promise<string | null> {
    if (!canActOnOpportunity(item)) {
      setError("No tenés permiso para abrir o crear conversación sobre esta oportunidad.");
      return null;
    }

    if (item.conversacion_id) return item.conversacion_id;

    const telefono = normalizePhone(getTelefonoOportunidad(item));

    if (!telefono || telefono === "Sin teléfono") {
      setError("La oportunidad no tiene teléfono para crear una conversación WhatsApp.");
      return null;
    }

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    const { data, error: rpcError } = await supabase.rpc(
      "ensure_whatsapp_conversation_for_oportunidad",
      {
        p_oportunidad_id: item.id,
        p_created_by: userId
      }
    );

    if (rpcError) {
      setError(rpcError.message || "No se pudo crear/vincular la conversación WhatsApp.");
      setActionLoading(false);
      return null;
    }

    const conversationId = String(data || "").trim();

    if (!conversationId) {
      setError("No se recibió el ID de conversación creado.");
      setActionLoading(false);
      return null;
    }

    setStatus("Conversación WhatsApp vinculada.");
    await loadData({ silent: true });
    setActionLoading(false);

    return conversationId;
  }

  async function openConversation(item: OportunidadVM) {
    const conversationId = await ensureWhatsappConversation(item);

    if (!conversationId) return;

    const inbox = item.assigned_to ? "en_gestion" : "sin_atender";

    const detail = {
      source: "oportunidades",
      module: "comunicaciones",
      action: "open_conversation_from_opportunity",

      conversation_id: conversationId,
      conversacion_id: conversationId,

      wa_phone: getTelefonoOportunidad(item),
      contacto: getNombreOportunidad(item),
      contacto_nombre: getNombreOportunidad(item),

      oportunidad_id: item.id,
      oportunidad_score: item.score || 0,
      oportunidad_estado_id: item.estado_id,
      oportunidad_datos: enrichDatos({
        ...item,
        conversacion_id: conversationId
      }),

      cande_activa: Boolean(item.cande_activa),
      inbox,

      created_at: new Date().toISOString()
    };

    window.localStorage.setItem("nostur_open_livenos_conversation_id", conversationId);
    window.localStorage.setItem("nostur_livenos_open_inbox", inbox);
    window.localStorage.setItem("nostur_livenos_open_context", JSON.stringify(detail));

    window.dispatchEvent(
      new CustomEvent("nostur:open-internal", {
        detail: {
          appId: "livenos",
          url: "internal://livenos",
          title: "LiveNos",
          params: detail
        }
      })
    );

    window.dispatchEvent(
      new CustomEvent("nostur:open-livenos-conversation", {
        detail
      })
    );

    setSelectedOpportunity(null);
  }

  async function createManualOpportunity() {
    const nombre = manualDraft.nombre_contacto.trim();
    const telefono = normalizePhone(manualDraft.telefono);
    const pasajerosTotal = passengerTotal(manualDraft.pasajeros);
    const pasajerosDetalle = passengerLabel(manualDraft.pasajeros);

    if (!nombre && !telefono) {
      setError("Cargá al menos nombre o teléfono para crear la oportunidad.");
      return;
    }

    setManualSaving(true);
    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setManualSaving(false);
      setActionLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc("create_manual_lead_oportunidad", {
      p_nombre_contacto: nombre || telefono,
      p_telefono: telefono || null,
      p_email: manualDraft.email.trim() || null,
      p_origen: manualDraft.origen || "retail",
      p_metodo_contacto: manualDraft.metodo_contacto || manualDraft.origen || "retail",
      p_destino: manualDraft.destino.trim() || null,
      p_origen_viaje: manualDraft.origen_viaje.trim() || null,
      p_fechas: manualDraft.fechas.trim() || null,
      p_pasajeros: pasajerosDetalle,
      p_presupuesto: manualDraft.presupuesto.trim() || null,
      p_notas: manualDraft.notas.trim() || null,
      p_assigned_to: userId,
      p_sucursal_id: null,
      p_created_by: userId
    });

    if (rpcError) {
      setError(rpcError.message || "No se pudo crear la oportunidad.");
      setManualSaving(false);
      setActionLoading(false);
      return;
    }

    const oportunidadId = String(data || "").trim();

    if (!oportunidadId) {
      setError("La oportunidad se creó, pero no se recibió ID.");
      setManualSaving(false);
      setActionLoading(false);
      await loadData({ silent: true });
      return;
    }

    await supabase
      .from("lead_oportunidades")
      .update({
        assigned_to: userId,
        datos: {
          nombre: nombre || telefono,
          contacto_nombre: nombre || telefono,
          pasajero: nombre || telefono,
          telefono: telefono || null,
          wa_phone: telefono || null,
          email: manualDraft.email.trim() || null,
          origen_oportunidad: manualDraft.origen || "retail",
          metodo_contacto: manualDraft.metodo_contacto || manualDraft.origen || "retail",
          canal_preferido: "whatsapp",
          destino: manualDraft.destino.trim() || null,
          origen: manualDraft.origen_viaje.trim() || null,
          fechas_tentativas: manualDraft.fechas.trim() || null,
          cantidad_pasajeros: pasajerosTotal,
          pasajeros_detalle: pasajerosDetalle,
          pasajeros_adultos: manualDraft.pasajeros.adultos,
          pasajeros_menores: manualDraft.pasajeros.menores,
          edades_menores: manualDraft.pasajeros.edadesMenores.trim() || null,
          presupuesto_aproximado: manualDraft.presupuesto.trim() || null,
          ultimo_mensaje: manualDraft.notas.trim() || null,
          notas: manualDraft.notas.trim() || null,
          created_manually: true
        },
        updated_at: new Date().toISOString()
      })
      .eq("id", oportunidadId);

    let createdConversationId: string | null = null;

    if (manualDraft.crear_conversacion_whatsapp && telefono) {
      const { data: convData, error: convError } = await supabase.rpc(
        "ensure_whatsapp_conversation_for_oportunidad",
        {
          p_oportunidad_id: oportunidadId,
          p_created_by: userId
        }
      );

      if (convError) {
        setError(
          `Oportunidad creada, pero no se pudo crear la conversación WhatsApp: ${convError.message}`
        );
      } else {
        createdConversationId = String(convData || "").trim() || null;
      }
    }

    const draftSnapshot = { ...manualDraft, pasajeros: { ...manualDraft.pasajeros } };

    resetManualModal();
    setStatus("Oportunidad creada correctamente.");
    await loadData({ silent: true });

    if (createdConversationId) {
      const item: OportunidadVM = {
        id: oportunidadId,
        conversacion_id: createdConversationId,
        estado_id: null,
        score: 0,
        datos: {
          nombre,
          contacto_nombre: nombre,
          telefono,
          wa_phone: telefono,
          destino: draftSnapshot.destino,
          origen: draftSnapshot.origen_viaje,
          fechas_tentativas: draftSnapshot.fechas,
          cantidad_pasajeros: passengerTotal(draftSnapshot.pasajeros),
          pasajeros_detalle: passengerLabel(draftSnapshot.pasajeros),
          presupuesto_aproximado: draftSnapshot.presupuesto,
          notas: draftSnapshot.notas
        },
        assigned_to: userId,
        cande_activa: false,
        transferida_at: null,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        nombre_contacto: nombre,
        telefono,
        origen: draftSnapshot.origen,
        metodo_contacto: draftSnapshot.metodo_contacto,
        created_manually: true,
        conversacion: null,
        contacto: null
      };

      void openConversation(item);
    }

    setManualSaving(false);
    setActionLoading(false);
  }

  function buildSelectedOpportunityActionDetail(action: string) {
    if (!selectedOpportunity) return null;

    if (!canActOnOpportunity(selectedOpportunity)) {
      setError("No tenés permiso para usar esta oportunidad.");
      return null;
    }

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

      contacto_id: selectedOpportunity.conversacion?.contacto_id || selectedOpportunity.contacto_wa_id || null,
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

  function renderManualOpportunityModal() {
    if (!manualModalOpen) return null;

    return (
      <div className="fixed inset-0 z-[900] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[24px] bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#eef6f7] text-[#4f7c90]">
                  <UserPlus size={20} />
                </div>

                <div>
                  <h2 className="text-[17px] font-semibold text-[#172033]">
                    Nueva oportunidad
                  </h2>
                  <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
                    Cargá oportunidades de retail, teléfono, web, referidos u otros canales.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={resetManualModal}
              disabled={manualSaving}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#172033] disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-5">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <FieldLabel>Nombre pasajero / contacto</FieldLabel>
                <ModalInput
                  value={manualDraft.nombre_contacto}
                  onChange={(value) => patchManualDraft({ nombre_contacto: value })}
                  placeholder="Ej: Juan Pérez"
                  autoFocus
                />
              </div>

              <div>
                <FieldLabel>Teléfono / WhatsApp</FieldLabel>
                <ModalInput
                  value={manualDraft.telefono}
                  onChange={(value) => patchManualDraft({ telefono: value })}
                  placeholder="Ej: 351..."
                />
              </div>

              <div>
                <FieldLabel>Email</FieldLabel>
                <ModalInput
                  value={manualDraft.email}
                  onChange={(value) => patchManualDraft({ email: value })}
                  placeholder="Opcional"
                />
              </div>

              <div>
                <FieldLabel>Origen de la oportunidad</FieldLabel>
                <NosturSelect
                  value={manualDraft.origen}
                  options={ORIGEN_OPTIONS}
                  placeholder="Elegir origen..."
                  onChange={(value) =>
                    patchManualDraft({
                      origen: value || "retail",
                      metodo_contacto: value || "retail"
                    })
                  }
                />
              </div>

              <div>
                <FieldLabel>Destino / consulta</FieldLabel>
                <NosturSelect
                  value={manualDraft.destino}
                  options={destinoOptions}
                  placeholder="Elegir destino..."
                  searchable
                  onChange={(value) => patchManualDraft({ destino: value })}
                />
              </div>

              <div>
                <FieldLabel>Origen del viaje</FieldLabel>
                <NosturSelect
                  value={manualDraft.origen_viaje}
                  options={destinoOptions}
                  placeholder="Elegir origen..."
                  searchable
                  onChange={(value) => patchManualDraft({ origen_viaje: value })}
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Pasajeros</FieldLabel>
                <PassengerSelector
                  value={manualDraft.pasajeros}
                  onChange={(passengers) => patchManualDraft({ pasajeros: passengers })}
                />
              </div>

              <div>
                <FieldLabel>Fechas tentativas</FieldLabel>
                <ModalInput
                  value={manualDraft.fechas}
                  onChange={(value) => patchManualDraft({ fechas: value })}
                  placeholder="Ej: Enero, segunda quincena..."
                />
              </div>

              <div>
                <FieldLabel>Presupuesto aproximado</FieldLabel>
                <ModalInput
                  value={manualDraft.presupuesto}
                  onChange={(value) => patchManualDraft({ presupuesto: value })}
                  placeholder="Ej: USD 3000 / ARS..."
                />
              </div>

              <div className="md:col-span-2">
                <FieldLabel>Notas iniciales</FieldLabel>
                <ModalTextarea
                  value={manualDraft.notas}
                  onChange={(value) => patchManualDraft({ notas: value })}
                  placeholder="Ej: Pasó por el local, quiere viajar en familia, pidió seguimiento por WhatsApp..."
                  rows={4}
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() =>
                patchManualDraft({
                  crear_conversacion_whatsapp: !manualDraft.crear_conversacion_whatsapp
                })
              }
              className={[
                "mt-4 w-full rounded-2xl border p-4 text-left transition",
                manualDraft.crear_conversacion_whatsapp
                  ? "border-[#4f7c90]/40 bg-[#eef6f7]"
                  : "border-black/10 bg-white hover:bg-[#f8fafc]"
              ].join(" ")}
            >
              <div className="flex items-center gap-3">
                <span
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-semibold",
                    manualDraft.crear_conversacion_whatsapp
                      ? "border-[#4f7c90] bg-[#4f7c90] text-white"
                      : "border-slate-300 bg-white text-transparent"
                  ].join(" ")}
                >
                  ✓
                </span>

                <div>
                  <div className="text-[13px] font-semibold text-[#172033]">
                    Crear / vincular conversación WhatsApp ahora
                  </div>
                  <div className="mt-0.5 text-[12px] font-normal text-[#64748b]">
                    Recomendado si ya tenés el teléfono y querés abrir LiveNos para continuar el seguimiento.
                  </div>
                </div>
              </div>
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/10 bg-white px-5 py-4">
            <button
              type="button"
              onClick={resetManualModal}
              disabled={manualSaving}
              className="h-9 rounded-xl bg-[#f1f5f9] px-4 text-xs font-medium text-[#64748b] transition hover:bg-[#e2e8f0] disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={createManualOpportunity}
              disabled={manualSaving}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f7c90] px-4 text-xs font-medium text-white shadow-sm transition hover:bg-[#406b7d] disabled:opacity-50"
            >
              {manualSaving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Crear oportunidad
            </button>
          </div>
        </div>
      </div>
    );
  }

  const selectedOpportunityForModal = selectedOpportunity
    ? ({
        ...selectedOpportunity,
        conversacion_id: selectedOpportunity.conversacion_id || ""
      } as any)
    : null;

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      {renderManualOpportunityModal()}

      <OportunidadDetalleModal
        open={Boolean(selectedOpportunity)}
        oportunidad={selectedOpportunityForModal}
        estados={estados}
        contacto={selectedOpportunity?.contacto || null}
        conversacion={selectedOpportunity?.conversacion || null}
        onClose={() => setSelectedOpportunity(null)}
        onOpenConversation={() => {
          if (selectedOpportunity) void openConversation(selectedOpportunity);
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
                Pipeline comercial
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Pipeline comercial desde WhatsApp, CANDE, retail, teléfono, web y otros canales.
            </p>

            <p className="mt-1 text-[11.5px] font-medium text-[#4f7c90]">
              Vista actual: {canSeeAll ? selectedSellerLabel : `Mis oportunidades · ${selectedSellerLabel}`}
            </p>
          </div>

          <div className="flex flex-wrap justify-end gap-2">
            {canSeeAll ? (
              <div className="min-w-[260px]">
                <NosturSelect
                  value={sellerFilter}
                  options={vendedorOptions}
                  placeholder="Filtrar vendedor..."
                  searchable
                  onChange={(value) => setSellerFilter(value || SELLER_FILTER_ALL)}
                />
              </div>
            ) : null}

            <button
              type="button"
              onClick={() => setManualModalOpen(true)}
              disabled={actionLoading}
              className="inline-flex h-8 items-center gap-1.5 rounded-xl bg-[#4f7c90] px-3 text-[11.5px] font-medium text-white shadow-sm ring-1 ring-[#4f7c90]/20 transition hover:bg-[#406b7d] disabled:opacity-50"
            >
              <Plus size={14} />
              Nueva oportunidad
            </button>

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
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-4">
        <div className="grid gap-3 md:grid-cols-5">
          <MiniMetric label="Oportunidades" value={oportunidades.length} />
          <MiniMetric label="Estados" value={estados.length} />
          <MiniMetric label="Score promedio" value={`${totalScore}/100`} />
          <MiniMetric label="Manuales / Retail" value={manualCount} />
          <MiniMetric label="Con WhatsApp" value={whatsappLinkedCount} />
        </div>

        {canSeeAll ? (
          <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-black/10 bg-white/58 px-4 py-3 text-[12px] font-medium text-[#64748b] shadow-sm backdrop-blur-xl">
            <Search size={14} className="shrink-0 text-[#4f7c90]" />
            Filtro vendedor: <span className="text-[#172033]">{selectedSellerLabel}</span>
          </div>
        ) : null}

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
                        const origenComercial = getOrigenComercialLabel(item);
                        const isDragging = draggingId === item.id;
                        const hasConversation = Boolean(item.conversacion_id);
                        const effectiveSellerId = getEffectiveSellerId(item);
const seller = profiles.find((profile) => profile.id === effectiveSellerId);
const sellerLabel = effectiveSellerId ? profileName(seller) : "Sin asignar";

                        return (
                          <article
                            key={item.id}
                            draggable={canActOnOpportunity(item)}
                            onDragStart={() => handleDragStart(item)}
                            onDragEnd={() => {
                              setDraggingId(null);
                              setDragOverEstadoId(null);
                            }}
                            onClick={() => setSelectedOpportunity(item)}
                            className={[
                              "rounded-[16px] border border-black/10 bg-white px-3 py-3 shadow-sm transition",
                              canActOnOpportunity(item) ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
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

                            <div className="mt-2 flex flex-wrap gap-1">
                              <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[9.5px] font-medium text-[#64748b]">
                                {origenComercial}
                              </span>

                              {canSeeAll ? (
                                <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[9.5px] font-medium text-blue-700">
                                  {sellerLabel}
                                </span>
                              ) : null}

                              {hasConversation ? (
                                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9.5px] font-medium text-emerald-700">
                                  WhatsApp vinculado
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[9.5px] font-medium text-amber-700">
                                  Sin chat
                                </span>
                              )}
                            </div>

                            <div className="mt-2.5 space-y-1 text-[11.5px] font-normal leading-snug text-[#475569]">
                              <p className="truncate">📍 {destino}</p>
                              <p className="truncate">🛫 {origen}</p>
                              <p className="truncate">🗓 {fechas}</p>
                              <p className="truncate">👥 {pax}</p>
                            </div>

                            <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={["h-full rounded-full", scoreBarClass(score)].join(" ")}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>

                            <div className="mt-2 flex items-center justify-between gap-2">
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void openConversation(item);
                                }}
                                className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-[#eef6f7] px-2 text-[10.5px] font-medium text-[#4f7c90] transition hover:bg-[#dff0f2]"
                              >
                                <MessageCircle size={12} />
                                {hasConversation ? "Abrir chat" : "Hablar por WhatsApp"}
                              </button>

                              <p className="text-right text-[10.5px] font-medium text-[#64748b]">
                                {score}/100
                              </p>
                            </div>
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

export default OportunidadesPanel;