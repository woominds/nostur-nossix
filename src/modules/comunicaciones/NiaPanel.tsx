// src/modules/comunicaciones/NiaPanel.tsx

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bell,
  Bot,
  Brain,
  Check,
  Clock3,
  FileText,
  HelpCircle,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sparkles,
  Target,
  Trash2,
  Users,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "./comunicacionesShared";

type TabKey =
  | "general"
  | "identidad"
  | "capacidades"
  | "reglas"
  | "alertas"
  | "reportes"
  | "conocimiento"
  | "chat";

type NiaConfig = {
  id?: string;
  nombre_ia: string;
  marca_visible: string;
  modo: string;
  tono: string;
  prompt_base: string;
  reglas_duras: string;
  mensaje_inicial: string;
  modelo: string;
  enabled: boolean;
  hora_resumen_diario: string;
  dias_resumen: number[];
  plantilla_resumen_vendedor: string;
  plantilla_resumen_gerencia: string;

  puede_resumir_oportunidades: boolean;
  puede_recalificar_leads: boolean;
  puede_sugerir_acciones: boolean;
  puede_mover_estados: boolean;
  puede_activar_cande: boolean;
  puede_generar_alertas: boolean;
  puede_generar_reportes: boolean;

  puede_consultar_clientes: boolean;
  puede_consultar_carritos: boolean;
  puede_consultar_files: boolean;
  puede_consultar_caja: boolean;
  puede_consultar_facturacion: boolean;

  alerta_conversacion_sin_atender_min: number;
  alerta_oportunidad_caliente_min: number;
  alerta_sin_seguimiento_horas: number;

  updated_at?: string | null;
};

type NiaFaq = {
  id: string;
  pregunta: string;
  respuesta: string;
  orden: number;
};

type NiaPalabraClave = {
  id: string;
  palabra: string;
  significado: string | null;
};

type NiaConversacion = {
  id: string;
  profile_id: string | null;
  unread_count: number;
  last_message_at: string | null;
  last_message_preview: string | null;
  created_at: string;
  updated_at: string;
};

type NiaMensaje = {
  id: string;
  conversacion_id: string | null;
  direction: string;
  text: string;
  created_at: string;
};

type FaqDraft = {
  id?: string;
  pregunta: string;
  respuesta: string;
  orden: string;
};

type KeywordDraft = {
  id?: string;
  palabra: string;
  significado: string;
};

const DAY_OPTIONS = [
  { value: 1, label: "Lun" },
  { value: 2, label: "Mar" },
  { value: 3, label: "Mié" },
  { value: 4, label: "Jue" },
  { value: 5, label: "Vie" },
  { value: 6, label: "Sáb" },
  { value: 7, label: "Dom" }
];

const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

const MODE_OPTIONS = [
  { value: "observador", label: "Observador" },
  { value: "alertas", label: "Alertas" },
  { value: "asistente", label: "Asistente" },
  { value: "operativo", label: "Operativo" }
];

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTime(value?: string | null): string {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

function formatDays(days?: number[] | null) {
  if (!days || days.length === 0) return "—";

  const labels: Record<number, string> = {
    1: "Lun",
    2: "Mar",
    3: "Mié",
    4: "Jue",
    5: "Vie",
    6: "Sáb",
    7: "Dom"
  };

  return days.map((day) => labels[day] || String(day)).join(", ");
}

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return "—";
  }
}

function emptyFaqDraft(): FaqDraft {
  return {
    pregunta: "",
    respuesta: "",
    orden: "1"
  };
}

function emptyKeywordDraft(): KeywordDraft {
  return {
    palabra: "",
    significado: ""
  };
}

function normalizeConfig(raw: Partial<NiaConfig> | null): NiaConfig {
  return {
    id: raw?.id,
    nombre_ia: raw?.nombre_ia || "NIA",
    marca_visible: raw?.marca_visible || "NOSTUR",
    modo: raw?.modo || "asistente",
    tono: raw?.tono || "claro, profesional, directo, comercial y operativo",
    prompt_base:
      raw?.prompt_base ||
      "Sos NIA, asistente comercial interno de NOSTUR. Ayudás a vendedores, gerencia y administración a gestionar oportunidades, conversaciones, alertas, seguimiento comercial y operación interna. No hablás con pasajeros, solo con usuarios internos del sistema.",
    reglas_duras:
      raw?.reglas_duras ||
      "No inventes datos. No envíes mensajes al pasajero. No modifiques estados sensibles sin confirmación. No prometas precios, disponibilidad ni condiciones comerciales. No expongas información sensible innecesaria. Si falta contexto, pedilo.",
    mensaje_inicial:
      raw?.mensaje_inicial ||
      "Hola, soy NIA. Puedo ayudarte a resumir oportunidades, detectar pendientes, sugerir próximos pasos, revisar conversaciones y generar reportes internos.",
    modelo: raw?.modelo || "gpt-4o",
    enabled: raw?.enabled ?? true,
    hora_resumen_diario: normalizeTime(raw?.hora_resumen_diario),
    dias_resumen: Array.isArray(raw?.dias_resumen) ? raw.dias_resumen : [1, 2, 3, 4, 5],
    plantilla_resumen_vendedor:
      raw?.plantilla_resumen_vendedor ||
      "Prepará un resumen breve para el vendedor con oportunidades abiertas, mensajes pendientes, conversaciones tomadas, derivaciones de Cande y próximos pasos sugeridos.",
    plantilla_resumen_gerencia:
      raw?.plantilla_resumen_gerencia ||
      "Prepará un resumen ejecutivo para gerencia con oportunidades calientes, demoras, conversaciones sin atender, rendimiento comercial y alertas operativas.",

    puede_resumir_oportunidades: raw?.puede_resumir_oportunidades ?? true,
    puede_recalificar_leads: raw?.puede_recalificar_leads ?? true,
    puede_sugerir_acciones: raw?.puede_sugerir_acciones ?? true,
    puede_mover_estados: raw?.puede_mover_estados ?? false,
    puede_activar_cande: raw?.puede_activar_cande ?? false,
    puede_generar_alertas: raw?.puede_generar_alertas ?? true,
    puede_generar_reportes: raw?.puede_generar_reportes ?? true,

    puede_consultar_clientes: raw?.puede_consultar_clientes ?? true,
    puede_consultar_carritos: raw?.puede_consultar_carritos ?? true,
    puede_consultar_files: raw?.puede_consultar_files ?? true,
    puede_consultar_caja: raw?.puede_consultar_caja ?? false,
    puede_consultar_facturacion: raw?.puede_consultar_facturacion ?? false,

    alerta_conversacion_sin_atender_min: raw?.alerta_conversacion_sin_atender_min ?? 15,
    alerta_oportunidad_caliente_min: raw?.alerta_oportunidad_caliente_min ?? 30,
    alerta_sin_seguimiento_horas: raw?.alerta_sin_seguimiento_horas ?? 48,

    updated_at: raw?.updated_at || null
  };
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-[16px] border border-black/10 bg-white/68 px-3.5 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="text-[10.5px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
        {label}
      </div>
      <div className="mt-1 text-[18px] font-semibold tracking-tight text-[#172033]">{value}</div>
    </article>
  );
}

function Card({
  title,
  subtitle,
  children,
  icon
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="rounded-[18px] border border-black/10 bg-white/62 p-4 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#f3efff] text-[#7c3aed]">
                {icon}
              </span>
            ) : null}

            <h2 className="text-[14px] font-semibold leading-tight text-[#172033]">{title}</h2>
          </div>

          {subtitle ? (
            <p className="mt-1 text-[11.5px] font-normal leading-relaxed text-[#64748b]">
              {subtitle}
            </p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.11em] text-[#64748b]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  disabled = false,
  type = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  type?: string;
}) {
  return (
    <input
      value={value}
      type={type}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-9 w-full rounded-[11px] border border-black/10 bg-white px-3 text-[12.5px] font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#7c3aed] disabled:opacity-50"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  rows = 4,
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full resize-none rounded-[11px] border border-black/10 bg-white px-3 py-2 text-[12.5px] font-medium leading-relaxed text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#7c3aed] disabled:opacity-50"
    />
  );
}

function ToggleButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-8 items-center justify-center rounded-[10px] border px-2.5 text-[11px] font-medium transition",
        active
          ? "border-[#7c3aed] bg-[#7c3aed] text-white shadow-sm"
          : "border-black/10 bg-white text-[#475569] hover:border-[#7c3aed]/35 hover:text-[#172033]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SwitchRow({
  title,
  subtitle,
  active,
  onToggle
}: {
  title: string;
  subtitle?: string;
  active: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[13px] border border-black/10 bg-white px-3 py-2.5">
      <div className="min-w-0">
        <div className="text-[12.5px] font-semibold text-[#172033]">{title}</div>
        {subtitle ? (
          <div className="mt-0.5 text-[11px] font-normal leading-snug text-[#64748b]">
            {subtitle}
          </div>
        ) : null}
      </div>

      <button
        type="button"
        onClick={onToggle}
        className={[
          "relative h-6 w-11 shrink-0 rounded-full transition",
          active ? "bg-[#7c3aed]" : "bg-slate-300"
        ].join(" ")}
      >
        <span
          className={[
            "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
            active ? "left-6" : "left-1"
          ].join(" ")}
        />
      </button>
    </div>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  danger = false
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-[#7c3aed] text-white hover:bg-[#6d28d9]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SmallPill({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-[#f1f5f9] px-1.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/5">
      {children}
    </span>
  );
}

export function NiaPanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [configDraft, setConfigDraft] = useState<NiaConfig | null>(null);
  const [faqs, setFaqs] = useState<NiaFaq[]>([]);
  const [keywords, setKeywords] = useState<NiaPalabraClave[]>([]);
  const [conversaciones, setConversaciones] = useState<NiaConversacion[]>([]);
  const [mensajes, setMensajes] = useState<NiaMensaje[]>([]);

  const [faqDraft, setFaqDraft] = useState<FaqDraft>(emptyFaqDraft());
  const [keywordDraft, setKeywordDraft] = useState<KeywordDraft>(emptyKeywordDraft());

  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingKeywordId, setEditingKeywordId] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    const [configRes, faqsRes, keywordsRes, conversacionesRes, mensajesRes] = await Promise.all([
      supabase.from("nia_config").select("*").limit(1).maybeSingle(),
      supabase.from("nia_faqs").select("id,pregunta,respuesta,orden").order("orden", {
        ascending: true
      }),
      supabase
        .from("nia_palabras_clave")
        .select("id,palabra,significado")
        .order("created_at", { ascending: false }),
      supabase
        .from("nia_conversaciones")
        .select("id,profile_id,unread_count,last_message_at,last_message_preview,created_at,updated_at")
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("nia_mensajes")
        .select("id,conversacion_id,direction,text,created_at")
        .order("created_at", { ascending: false })
        .limit(40)
    ]);

    const firstError =
      configRes.error ||
      faqsRes.error ||
      keywordsRes.error ||
      conversacionesRes.error ||
      mensajesRes.error;

    if (firstError) {
      setError(firstError.message || "Error cargando configuración de NIA.");
      setLoading(false);
      return;
    }

    setConfigDraft(normalizeConfig((configRes.data || null) as Partial<NiaConfig> | null));
    setFaqs((faqsRes.data || []) as NiaFaq[]);
    setKeywords((keywordsRes.data || []) as NiaPalabraClave[]);
    setConversaciones((conversacionesRes.data || []) as NiaConversacion[]);
    setMensajes((mensajesRes.data || []) as NiaMensaje[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!status) return;

    const timer = window.setTimeout(() => {
      setStatus(null);
    }, 2600);

    return () => window.clearTimeout(timer);
  }, [status]);

  const sortedFaqs = useMemo(() => [...faqs].sort((a, b) => a.orden - b.orden), [faqs]);

  function updateDraft<K extends keyof NiaConfig>(key: K, value: NiaConfig[K]) {
    setConfigDraft((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  }

  function toggleDay(day: number) {
    setConfigDraft((current) => {
      if (!current) return current;

      const currentDays = Array.isArray(current.dias_resumen) ? current.dias_resumen : [];
      const exists = currentDays.includes(day);
      const nextDays = exists
        ? currentDays.filter((item) => item !== day)
        : [...currentDays, day].sort((a, b) => a - b);

      return { ...current, dias_resumen: nextDays };
    });
  }

  async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  }

  async function saveConfig() {
    if (!configDraft) return;

    setSaving(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    const payload = {
      nombre_ia: configDraft.nombre_ia.trim() || "NIA",
      marca_visible: configDraft.marca_visible.trim() || "NOSTUR",
      modo: configDraft.modo,
      tono: configDraft.tono.trim(),
      prompt_base: configDraft.prompt_base.trim(),
      reglas_duras: configDraft.reglas_duras.trim(),
      mensaje_inicial: configDraft.mensaje_inicial.trim(),
      modelo: configDraft.modelo.trim() || "gpt-4o",
      enabled: configDraft.enabled,
      hora_resumen_diario: normalizeTime(configDraft.hora_resumen_diario),
      dias_resumen: configDraft.dias_resumen,
      plantilla_resumen_vendedor: configDraft.plantilla_resumen_vendedor.trim(),
      plantilla_resumen_gerencia: configDraft.plantilla_resumen_gerencia.trim(),

      puede_resumir_oportunidades: configDraft.puede_resumir_oportunidades,
      puede_recalificar_leads: configDraft.puede_recalificar_leads,
      puede_sugerir_acciones: configDraft.puede_sugerir_acciones,
      puede_mover_estados: configDraft.puede_mover_estados,
      puede_activar_cande: configDraft.puede_activar_cande,
      puede_generar_alertas: configDraft.puede_generar_alertas,
      puede_generar_reportes: configDraft.puede_generar_reportes,

      puede_consultar_clientes: configDraft.puede_consultar_clientes,
      puede_consultar_carritos: configDraft.puede_consultar_carritos,
      puede_consultar_files: configDraft.puede_consultar_files,
      puede_consultar_caja: configDraft.puede_consultar_caja,
      puede_consultar_facturacion: configDraft.puede_consultar_facturacion,

      alerta_conversacion_sin_atender_min: configDraft.alerta_conversacion_sin_atender_min,
      alerta_oportunidad_caliente_min: configDraft.alerta_oportunidad_caliente_min,
      alerta_sin_seguimiento_horas: configDraft.alerta_sin_seguimiento_horas,
      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    const response = configDraft.id
      ? await supabase.from("nia_config").update(payload).eq("id", configDraft.id)
      : await supabase.from("nia_config").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar NIA.");
      setSaving(false);
      return;
    }

    setStatus("Configuración de NIA guardada.");
    await loadData();
    setSaving(false);
  }

  function editFaq(faq: NiaFaq) {
    setEditingFaqId(faq.id);
    setFaqDraft({
      id: faq.id,
      pregunta: faq.pregunta,
      respuesta: faq.respuesta,
      orden: String(faq.orden || 0)
    });
    setActiveTab("conocimiento");
  }

  function resetFaqDraft() {
    setEditingFaqId(null);
    setFaqDraft(emptyFaqDraft());
  }

  async function saveFaq() {
    const pregunta = faqDraft.pregunta.trim();
    const respuesta = faqDraft.respuesta.trim();

    if (!pregunta || !respuesta) {
      setError("Completá pregunta y respuesta.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    const payload = {
      pregunta,
      respuesta,
      orden: toNumber(faqDraft.orden, faqs.length + 1),
      updated_at: new Date().toISOString()
    };

    const response = editingFaqId
      ? await supabase.from("nia_faqs").update(payload).eq("id", editingFaqId)
      : await supabase.from("nia_faqs").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar la FAQ.");
      setSaving(false);
      return;
    }

    resetFaqDraft();
    setStatus("FAQ de NIA guardada.");
    await loadData();
    setSaving(false);
  }

  async function deleteFaq(id: string) {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase.from("nia_faqs").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la FAQ.");
      setSaving(false);
      return;
    }

    setStatus("FAQ eliminada.");
    await loadData();
    setSaving(false);
  }

  function editKeyword(item: NiaPalabraClave) {
    setEditingKeywordId(item.id);
    setKeywordDraft({
      id: item.id,
      palabra: item.palabra,
      significado: item.significado || ""
    });
    setActiveTab("conocimiento");
  }

  function resetKeywordDraft() {
    setEditingKeywordId(null);
    setKeywordDraft(emptyKeywordDraft());
  }

  async function saveKeyword() {
    const palabra = keywordDraft.palabra.trim();

    if (!palabra) {
      setError("Completá la palabra clave.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    const payload = {
      palabra,
      significado: keywordDraft.significado.trim() || null,
      updated_at: new Date().toISOString()
    };

    const response = editingKeywordId
      ? await supabase.from("nia_palabras_clave").update(payload).eq("id", editingKeywordId)
      : await supabase.from("nia_palabras_clave").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar la palabra clave.");
      setSaving(false);
      return;
    }

    resetKeywordDraft();
    setStatus("Palabra clave de NIA guardada.");
    await loadData();
    setSaving(false);
  }

  async function deleteKeyword(id: string) {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase.from("nia_palabras_clave").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la palabra clave.");
      setSaving(false);
      return;
    }

    setStatus("Palabra clave eliminada.");
    await loadData();
    setSaving(false);
  }

  const tabs: { id: TabKey; label: string; icon: ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings2 size={13} /> },
    { id: "identidad", label: "Identidad", icon: <Sparkles size={13} /> },
    { id: "capacidades", label: "Capacidades", icon: <Brain size={13} /> },
    { id: "reglas", label: "Reglas", icon: <ShieldCheck size={13} /> },
    { id: "alertas", label: "Alertas", icon: <Bell size={13} /> },
    { id: "reportes", label: "Reportes", icon: <FileText size={13} /> },
    { id: "conocimiento", label: "Conocimiento", icon: <HelpCircle size={13} /> },
    { id: "chat", label: "Chat / historial", icon: <MessageSquareText size={13} /> }
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight text-[#172033]">NIA</h1>

              <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-purple-700 ring-1 ring-purple-100">
                IA equipo interno
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Configuración editable de la asistente comercial interna. NIA no habla con pasajeros.
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={loadData}
              disabled={loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-[10px] bg-white px-3 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            <ActionButton onClick={saveConfig} disabled={saving || !configDraft}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
              Guardar
            </ActionButton>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        <div className="grid gap-2.5 md:grid-cols-4">
          <MiniMetric label="Estado" value={configDraft?.enabled ? "Activa" : "Apagada"} />
          <MiniMetric label="Modo" value={configDraft?.modo || "—"} />
          <MiniMetric label="Modelo" value={configDraft?.modelo || "—"} />
          <MiniMetric label="Conocimiento" value={faqs.length + keywords.length} />
        </div>

        {error ? (
          <div className="mt-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
            <span>{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-red-500">
              <X size={14} />
            </button>
          </div>
        ) : null}

        {status ? (
          <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[12px] font-medium text-emerald-700">
            <Check size={14} />
            {status}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap gap-1 rounded-[14px] border border-black/10 bg-white/52 p-1.5 shadow-sm backdrop-blur-xl">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex h-8 items-center gap-1.5 rounded-[10px] px-2.5 text-[11px] font-medium transition",
                activeTab === tab.id
                  ? "bg-[#7c3aed] text-white shadow-sm"
                  : "text-[#475569] hover:bg-white hover:text-[#172033]"
              ].join(" ")}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="mt-3 flex min-h-[240px] items-center justify-center rounded-[16px] border border-black/10 bg-white/65">
            <Loader2 className="animate-spin text-[#7c3aed]" size={22} />
          </div>
        ) : null}

        {!loading && !configDraft ? (
          <div className="mt-3">
            <EmptyState title="No hay configuración de NIA" subtitle="Ejecutá el SQL inicial de nia_config." />
          </div>
        ) : null}

        {!loading && configDraft ? (
          <div className="mt-3">
            {activeTab === "general" ? (
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card
                  title="Estado operativo"
                  subtitle="NIA es la asistente interna del equipo. No responde a pasajeros."
                  icon={<Bot size={15} />}
                >
                  <div className="flex items-center justify-between gap-3 rounded-[13px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#172033]">
                        NIA está {configDraft.enabled ? "activa" : "apagada"}
                      </div>
                      <p className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                        Si está apagada, no debería responder ni ejecutar acciones internas.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateDraft("enabled", !configDraft.enabled)}
                      className={[
                        "relative h-6 w-11 rounded-full transition",
                        configDraft.enabled ? "bg-emerald-500" : "bg-slate-300"
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
                          configDraft.enabled ? "left-6" : "left-1"
                        ].join(" ")}
                      />
                    </button>
                  </div>

                  <div className="mt-3 grid gap-2.5 md:grid-cols-2">
                    <div>
                      <FieldLabel>Nombre IA</FieldLabel>
                      <TextInput
                        value={configDraft.nombre_ia}
                        onChange={(value) => updateDraft("nombre_ia", value)}
                        placeholder="NIA"
                      />
                    </div>

                    <div>
                      <FieldLabel>Marca visible</FieldLabel>
                      <TextInput
                        value={configDraft.marca_visible}
                        onChange={(value) => updateDraft("marca_visible", value)}
                        placeholder="NOSTUR"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <FieldLabel>Modo de trabajo</FieldLabel>
                    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                      {MODE_OPTIONS.map((mode) => (
                        <ToggleButton
                          key={mode.value}
                          active={configDraft.modo === mode.value}
                          onClick={() => updateDraft("modo", mode.value)}
                        >
                          {mode.label}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>

                  <div className="mt-3">
                    <FieldLabel>Modelo</FieldLabel>
                    <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                      {MODEL_OPTIONS.map((model) => (
                        <ToggleButton
                          key={model}
                          active={configDraft.modelo === model}
                          onClick={() => updateDraft("modelo", model)}
                        >
                          {model}
                        </ToggleButton>
                      ))}
                    </div>
                  </div>
                </Card>

                <Card title="Rol de NIA" icon={<Users size={15} />}>
                  <div className="grid gap-2 text-[12px] font-normal leading-relaxed text-[#475569]">
                    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                      Habla con vendedores, gerencia, administración y soporte.
                    </div>

                    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                      Ayuda a detectar oportunidades sin atender, demoras y pendientes.
                    </div>

                    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                      Puede sugerir acciones, pero las acciones sensibles requieren confirmación.
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "identidad" ? (
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card
                  title="Identidad, tono y contexto"
                  subtitle="Esto define cómo piensa y cómo responde NIA."
                  icon={<Sparkles size={15} />}
                >
                  <div>
                    <FieldLabel>Tono</FieldLabel>
                    <TextArea
                      value={configDraft.tono}
                      onChange={(value) => updateDraft("tono", value)}
                      rows={3}
                    />
                  </div>

                  <div className="mt-2.5">
                    <FieldLabel>Mensaje inicial</FieldLabel>
                    <TextArea
                      value={configDraft.mensaje_inicial}
                      onChange={(value) => updateDraft("mensaje_inicial", value)}
                      rows={4}
                    />
                  </div>

                  <div className="mt-2.5">
                    <FieldLabel>Prompt base</FieldLabel>
                    <TextArea
                      value={configDraft.prompt_base}
                      onChange={(value) => updateDraft("prompt_base", value)}
                      rows={9}
                    />
                  </div>
                </Card>

                <Card title="Preview de personalidad" icon={<MessageSquareText size={15} />}>
                  <div className="rounded-[14px] border border-purple-100 bg-purple-50 p-3 text-[12px] font-normal leading-relaxed text-[#4c1d95]">
                    <div className="mb-1 flex items-center gap-1.5 font-semibold">
                      <Sparkles size={13} />
                      {configDraft.nombre_ia || "NIA"}
                    </div>
                    <div className="whitespace-pre-wrap">{configDraft.mensaje_inicial}</div>
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "capacidades" ? (
              <div className="grid gap-3.5 xl:grid-cols-2">
                <Card
                  title="Qué puede hacer"
                  subtitle="Capacidades operativas de NIA dentro del sistema."
                  icon={<Brain size={15} />}
                >
                  <div className="grid gap-2">
                    <SwitchRow
                      title="Resumir oportunidades"
                      subtitle="Puede explicar estado, faltantes y próximos pasos."
                      active={configDraft.puede_resumir_oportunidades}
                      onToggle={() =>
                        updateDraft("puede_resumir_oportunidades", !configDraft.puede_resumir_oportunidades)
                      }
                    />

                    <SwitchRow
                      title="Recalificar leads"
                      subtitle="Puede sugerir temperatura o score comercial."
                      active={configDraft.puede_recalificar_leads}
                      onToggle={() => updateDraft("puede_recalificar_leads", !configDraft.puede_recalificar_leads)}
                    />

                    <SwitchRow
                      title="Sugerir acciones"
                      subtitle="Puede recomendar tomar, derivar, cerrar, seguir o presupuestar."
                      active={configDraft.puede_sugerir_acciones}
                      onToggle={() => updateDraft("puede_sugerir_acciones", !configDraft.puede_sugerir_acciones)}
                    />

                    <SwitchRow
                      title="Mover estados"
                      subtitle="Recomendado solo con confirmación explícita."
                      active={configDraft.puede_mover_estados}
                      onToggle={() => updateDraft("puede_mover_estados", !configDraft.puede_mover_estados)}
                    />

                    <SwitchRow
                      title="Activar / pausar CANDE"
                      subtitle="Permite coordinar atención automática del pasajero."
                      active={configDraft.puede_activar_cande}
                      onToggle={() => updateDraft("puede_activar_cande", !configDraft.puede_activar_cande)}
                    />
                  </div>
                </Card>

                <Card
                  title="Qué puede consultar"
                  subtitle="Módulos que NIA puede usar como contexto interno."
                  icon={<Target size={15} />}
                >
                  <div className="grid gap-2">
                    <SwitchRow
                      title="Clientes"
                      active={configDraft.puede_consultar_clientes}
                      onToggle={() => updateDraft("puede_consultar_clientes", !configDraft.puede_consultar_clientes)}
                    />

                    <SwitchRow
                      title="Carritos"
                      active={configDraft.puede_consultar_carritos}
                      onToggle={() => updateDraft("puede_consultar_carritos", !configDraft.puede_consultar_carritos)}
                    />

                    <SwitchRow
                      title="Files"
                      active={configDraft.puede_consultar_files}
                      onToggle={() => updateDraft("puede_consultar_files", !configDraft.puede_consultar_files)}
                    />

                    <SwitchRow
                      title="Caja"
                      subtitle="Información sensible. Dejar apagado salvo gerencia/admin."
                      active={configDraft.puede_consultar_caja}
                      onToggle={() => updateDraft("puede_consultar_caja", !configDraft.puede_consultar_caja)}
                    />

                    <SwitchRow
                      title="Facturación"
                      subtitle="Información sensible. Dejar apagado salvo necesidad real."
                      active={configDraft.puede_consultar_facturacion}
                      onToggle={() =>
                        updateDraft("puede_consultar_facturacion", !configDraft.puede_consultar_facturacion)
                      }
                    />
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "reglas" ? (
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card
                  title="Reglas duras"
                  subtitle="Límites que NIA no debe romper."
                  icon={<ShieldCheck size={15} />}
                >
                  <TextArea
                    value={configDraft.reglas_duras}
                    onChange={(value) => updateDraft("reglas_duras", value)}
                    rows={12}
                  />
                </Card>

                <Card title="Reglas recomendadas" icon={<ShieldCheck size={15} />}>
                  <div className="space-y-2 text-[12px] font-normal leading-relaxed text-[#475569]">
                    {[
                      "No enviar mensajes al pasajero.",
                      "No modificar estados sensibles sin confirmación.",
                      "No inventar datos comerciales.",
                      "No prometer precios, cupos ni disponibilidad.",
                      "No exponer datos sensibles si no corresponde.",
                      "No tocar caja ni facturación sin permiso."
                    ].map((rule) => (
                      <div key={rule} className="rounded-[12px] bg-white px-3 py-2 ring-1 ring-black/5">
                        {rule}
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "alertas" ? (
              <div className="grid gap-3.5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card title="Alertas habilitadas" icon={<Bell size={15} />}>
                  <div className="grid gap-2">
                    <SwitchRow
                      title="Generar alertas"
                      active={configDraft.puede_generar_alertas}
                      onToggle={() => updateDraft("puede_generar_alertas", !configDraft.puede_generar_alertas)}
                    />
                  </div>
                </Card>

                <Card title="Umbrales operativos" subtitle="Cuándo NIA debe considerar que algo requiere atención.">
                  <div className="grid gap-3 md:grid-cols-3">
                    <div>
                      <FieldLabel>Sin atender min.</FieldLabel>
                      <TextInput
                        type="number"
                        value={String(configDraft.alerta_conversacion_sin_atender_min)}
                        onChange={(value) =>
                          updateDraft("alerta_conversacion_sin_atender_min", toNumber(value, 15))
                        }
                      />
                    </div>

                    <div>
                      <FieldLabel>Oportunidad caliente min.</FieldLabel>
                      <TextInput
                        type="number"
                        value={String(configDraft.alerta_oportunidad_caliente_min)}
                        onChange={(value) =>
                          updateDraft("alerta_oportunidad_caliente_min", toNumber(value, 30))
                        }
                      />
                    </div>

                    <div>
                      <FieldLabel>Sin seguimiento horas</FieldLabel>
                      <TextInput
                        type="number"
                        value={String(configDraft.alerta_sin_seguimiento_horas)}
                        onChange={(value) =>
                          updateDraft("alerta_sin_seguimiento_horas", toNumber(value, 48))
                        }
                      />
                    </div>
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "reportes" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card title="Programación" icon={<Clock3 size={15} />}>
                  <SwitchRow
                    title="Generar reportes"
                    active={configDraft.puede_generar_reportes}
                    onToggle={() => updateDraft("puede_generar_reportes", !configDraft.puede_generar_reportes)}
                  />

                  <div className="mt-3">
                    <FieldLabel>Hora resumen diario</FieldLabel>
                    <TextInput
                      value={normalizeTime(configDraft.hora_resumen_diario)}
                      onChange={(value) => updateDraft("hora_resumen_diario", value)}
                      placeholder="09:00"
                    />
                  </div>

                  <div className="mt-3">
                    <FieldLabel>Días de resumen</FieldLabel>
                    <div className="grid grid-cols-4 gap-1.5">
                      {DAY_OPTIONS.map((day) => (
                        <ToggleButton
                          key={day.value}
                          active={(configDraft.dias_resumen || []).includes(day.value)}
                          onClick={() => toggleDay(day.value)}
                        >
                          {day.label}
                        </ToggleButton>
                      ))}
                    </div>

                    <p className="mt-2 text-[11px] font-normal text-[#64748b]">
                      Activos: {formatDays(configDraft.dias_resumen)}
                    </p>
                  </div>
                </Card>

                <Card title="Plantillas de reporte" icon={<FileText size={15} />}>
                  <div>
                    <FieldLabel>Resumen para vendedor</FieldLabel>
                    <TextArea
                      value={configDraft.plantilla_resumen_vendedor}
                      onChange={(value) => updateDraft("plantilla_resumen_vendedor", value)}
                      rows={6}
                    />
                  </div>

                  <div className="mt-3">
                    <FieldLabel>Resumen para gerencia</FieldLabel>
                    <TextArea
                      value={configDraft.plantilla_resumen_gerencia}
                      onChange={(value) => updateDraft("plantilla_resumen_gerencia", value)}
                      rows={6}
                    />
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "conocimiento" ? (
              <div className="grid gap-3.5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <div className="space-y-3.5">
                  <Card title={editingFaqId ? "Editar FAQ" : "Nueva FAQ"} icon={<HelpCircle size={15} />}>
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Pregunta</FieldLabel>
                        <TextArea
                          value={faqDraft.pregunta}
                          onChange={(value) => setFaqDraft((current) => ({ ...current, pregunta: value }))}
                          rows={3}
                          placeholder="¿Cómo priorizo oportunidades calientes?"
                        />
                      </div>

                      <div>
                        <FieldLabel>Respuesta</FieldLabel>
                        <TextArea
                          value={faqDraft.respuesta}
                          onChange={(value) => setFaqDraft((current) => ({ ...current, respuesta: value }))}
                          rows={5}
                          placeholder="Priorizá por score, último mensaje del pasajero..."
                        />
                      </div>

                      <div>
                        <FieldLabel>Orden</FieldLabel>
                        <TextInput
                          value={faqDraft.orden}
                          onChange={(value) => setFaqDraft((current) => ({ ...current, orden: value }))}
                        />
                      </div>

                      <div className="flex gap-2">
                        <ActionButton onClick={saveFaq} disabled={saving}>
                          <Save size={13} />
                          {editingFaqId ? "Guardar" : "Agregar"}
                        </ActionButton>

                        {editingFaqId ? (
                          <ActionButton onClick={resetFaqDraft} disabled={saving} danger>
                            <X size={13} />
                            Cancelar
                          </ActionButton>
                        ) : null}
                      </div>
                    </div>
                  </Card>

                  <Card title={editingKeywordId ? "Editar keyword" : "Nueva keyword"} icon={<Target size={15} />}>
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Palabra o frase</FieldLabel>
                        <TextInput
                          value={keywordDraft.palabra}
                          onChange={(value) => setKeywordDraft((current) => ({ ...current, palabra: value }))}
                          placeholder="activar cande"
                        />
                      </div>

                      <div>
                        <FieldLabel>Significado / intención</FieldLabel>
                        <TextArea
                          value={keywordDraft.significado}
                          onChange={(value) =>
                            setKeywordDraft((current) => ({ ...current, significado: value }))
                          }
                          rows={4}
                        />
                      </div>

                      <div className="flex gap-2">
                        <ActionButton onClick={saveKeyword} disabled={saving}>
                          <Save size={13} />
                          {editingKeywordId ? "Guardar" : "Agregar"}
                        </ActionButton>

                        {editingKeywordId ? (
                          <ActionButton onClick={resetKeywordDraft} disabled={saving} danger>
                            <X size={13} />
                            Cancelar
                          </ActionButton>
                        ) : null}
                      </div>
                    </div>
                  </Card>
                </div>

                <div className="grid gap-3.5">
                  <Card title="FAQs cargadas">
                    <div className="space-y-2">
                      {sortedFaqs.length === 0 ? (
                        <EmptyState title="Sin FAQs" subtitle="Agregá la primera FAQ interna." />
                      ) : null}

                      {sortedFaqs.map((faq) => (
                        <article key={faq.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-[12.5px] font-semibold text-[#172033]">
                                  {faq.pregunta}
                                </h3>
                                <SmallPill>Orden {faq.orden}</SmallPill>
                              </div>

                              <p className="mt-2 text-[11px] font-normal leading-relaxed text-[#64748b]">
                                {faq.respuesta}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                onClick={() => editFaq(faq)}
                                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#f3efff] text-[#7c3aed] hover:bg-[#ede9fe]"
                              >
                                <Settings2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteFaq(faq.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red-50 text-red-600 hover:bg-red-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </Card>

                  <Card title="Keywords cargadas">
                    <div className="grid gap-2 md:grid-cols-2">
                      {keywords.length === 0 ? (
                        <EmptyState title="Sin keywords" subtitle="Agregá palabras clave internas." />
                      ) : null}

                      {keywords.map((item) => (
                        <article key={item.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <h3 className="text-[12.5px] font-semibold text-[#172033]">
                                {item.palabra}
                              </h3>

                              <p className="mt-1 text-[11px] font-normal leading-relaxed text-[#64748b]">
                                {item.significado || "Sin significado configurado"}
                              </p>
                            </div>

                            <div className="flex shrink-0 gap-1.5">
                              <button
                                type="button"
                                onClick={() => editKeyword(item)}
                                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#f3efff] text-[#7c3aed] hover:bg-[#ede9fe]"
                              >
                                <Settings2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => deleteKeyword(item.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red-50 text-red-600 hover:bg-red-100"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>
                        </article>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            ) : null}

            {activeTab === "chat" ? (
              <div className="grid gap-3.5 xl:grid-cols-[360px_minmax(0,1fr)]">
                <Card title="Conversaciones recientes" icon={<MessageSquareText size={15} />}>
                  <div className="space-y-2">
                    {conversaciones.length === 0 ? (
                      <EmptyState
                        title="Sin conversaciones"
                        subtitle="Cuando se use NIA, acá aparecerán los hilos internos."
                      />
                    ) : null}

                    {conversaciones.map((thread) => (
                      <article key={thread.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                        <div className="text-[12.5px] font-semibold text-[#172033]">
                          Conversación NIA
                        </div>

                        <div className="mt-1 text-[11px] font-normal leading-relaxed text-[#64748b]">
                          {thread.last_message_preview || "Sin vista previa"}
                        </div>

                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <SmallPill>
                            Última actividad {formatDateTime(thread.last_message_at || thread.updated_at)}
                          </SmallPill>
                          {thread.unread_count > 0 ? <SmallPill>{thread.unread_count} sin leer</SmallPill> : null}
                        </div>
                      </article>
                    ))}
                  </div>
                </Card>

                <Card title="Mensajes recientes" subtitle="Vista de control e historial de uso.">
                  <div className="space-y-2">
                    {mensajes.length === 0 ? (
                      <EmptyState title="Sin mensajes" subtitle="Todavía no hay historial de NIA." />
                    ) : null}

                    {mensajes.map((message) => (
                      <article
                        key={message.id}
                        className={[
                          "rounded-[12px] border p-3",
                          message.direction === "assistant"
                            ? "border-purple-200 bg-purple-50"
                            : "border-black/10 bg-white"
                        ].join(" ")}
                      >
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <SmallPill>{message.direction || "mensaje"}</SmallPill>
                          <span className="text-[10.5px] font-normal text-[#64748b]">
                            {formatDateTime(message.created_at)}
                          </span>
                        </div>

                        <p className="whitespace-pre-wrap text-[12px] font-normal leading-relaxed text-[#172033]">
                          {message.text}
                        </p>
                      </article>
                    ))}
                  </div>
                </Card>
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </section>
  );
}

export default NiaPanel;