// src/modules/comunicaciones/CandePanel.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clock3,
  HelpCircle,
  ListChecks,
  Loader2,
  RefreshCcw,
  Save,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Target,
  Trash2,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "./comunicacionesShared";

type TabKey = "general" | "identidad" | "campos" | "faqs" | "scoring" | "pipeline";

type HorarioDayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";

type HorarioDayConfig = {
  enabled: boolean;
  start: string;
  end: string;
};

type HorarioAtencionConfig = {
  timezone: string;
  cooldown_hours: number;
  dias: Record<HorarioDayKey, HorarioDayConfig>;
};

type CandeConfig = {
  id: string;
  enabled: boolean;
  modo: string;
  horario_inicio: string;
  horario_fin: string;
  dias_laborales: number[];
  espera_minutos: number;
  nombre_ia: string;
  tono: string;
  prompt_base: string;
  reglas_duras: string;
  modelo: string;
  umbral_transferencia: number;
  mensaje_despedida: string;
  plantilla_resumen: string;

  marca_visible?: string | null;
  mensaje_inicial?: string | null;
  mensaje_falta_info?: string | null;
  mensaje_fuera_horario?: string | null;
  mensaje_fin_semana?: string | null;
  mensaje_no_entiende?: string | null;
  datos_a_relevar?: string[] | null;
  cosas_prohibidas?: string[] | null;

  auto_reply_fuera_horario_enabled?: boolean | null;
  horario_atencion_config?: HorarioAtencionConfig | null;

  max_mensajes_antes_derivar?: number | null;
  derivar_si_pide_humano?: boolean | null;
  derivar_si_urgente?: boolean | null;
  derivar_si_score_supera_umbral?: boolean | null;

  pedir_presupuesto_antes_derivar?: boolean | null;
  origen_sugerido_suma_score?: boolean | null;
  confirmar_origen_sugerido?: boolean | null;
  minimo_score_para_derivar?: number | null;
  mensaje_confirmar_origen_sugerido?: string | null;
  mensaje_datos_completos?: string | null;

  updated_at: string;
};

type CandeCampo = {
  id: string;
  clave: string;
  etiqueta: string;
  pregunta_sugerida: string | null;
  requerido: boolean;
  peso: number;
  orden: number;
};

type CandeFaq = {
  id: string;
  pregunta: string;
  respuesta: string;
  orden: number;
};

type PalabraClave = {
  id: string;
  palabra: string;
  peso: number;
};

type PipelineEstado = {
  id: string;
  nombre: string;
  color: string;
  orden: number;
  es_final: boolean;
  resultado: string | null;
  es_sin_atender: boolean;
};

type CampoDraft = {
  id?: string;
  clave: string;
  etiqueta: string;
  pregunta_sugerida: string;
  requerido: boolean;
  peso: string;
  orden: string;
};

type FaqDraft = {
  id?: string;
  pregunta: string;
  respuesta: string;
  orden: string;
};

type PalabraDraft = {
  id?: string;
  palabra: string;
  peso: string;
};

type PipelineDraft = {
  id?: string;
  nombre: string;
  color: string;
  orden: string;
  es_final: boolean;
  resultado: string;
  es_sin_atender: boolean;
};

const MODE_OPTIONS = [
  {
    value: "apagada",
    label: "Apagada",
    description: "Cande no responde automáticamente."
  },
  {
    value: "manual",
    label: "Manual",
    description: "Se activa por conversación o por acción de NIA."
  },
  {
    value: "sugerida",
    label: "Sugerida",
    description: "Sugiere respuestas para revisión humana."
  },
  {
    value: "automatica",
    label: "Automática",
    description: "Puede responder cuando corresponde."
  },
  {
    value: "fuera_horario",
    label: "Fuera de horario",
    description: "Actúa cuando la agencia no está atendiendo."
  }
];



const HORARIO_DAY_OPTIONS: { key: HorarioDayKey; value: number; label: string }[] = [
  { key: "mon", value: 1, label: "Lunes" },
  { key: "tue", value: 2, label: "Martes" },
  { key: "wed", value: 3, label: "Miércoles" },
  { key: "thu", value: 4, label: "Jueves" },
  { key: "fri", value: 5, label: "Viernes" },
  { key: "sat", value: 6, label: "Sábado" },
  { key: "sun", value: 7, label: "Domingo" }
];

const DEFAULT_HORARIO_ATENCION_CONFIG: HorarioAtencionConfig = {
  timezone: "America/Argentina/Cordoba",
  cooldown_hours: 8,
  dias: {
    mon: { enabled: true, start: "09:00", end: "20:30" },
    tue: { enabled: true, start: "09:00", end: "20:30" },
    wed: { enabled: true, start: "09:00", end: "20:30" },
    thu: { enabled: true, start: "09:00", end: "20:30" },
    fri: { enabled: true, start: "09:00", end: "20:30" },
    sat: { enabled: false, start: "09:00", end: "13:00" },
    sun: { enabled: false, start: "09:00", end: "13:00" }
  }
};

const DEFAULT_MENSAJE_FIN_SEMANA =
  "¡Hola! 👋 Gracias por escribirnos.\n\nEn este momento estamos fuera de horario de atención. Nuestro equipo retomará la atención el próximo día hábil.\n\nDejanos tu consulta y apenas estemos nuevamente en línea te respondemos por este mismo medio.";

const MODEL_OPTIONS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "gpt-4.1"];

function toNumber(value: string | number | null | undefined, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeTime(value?: string | null): string {
  if (!value) return "09:00";
  return value.slice(0, 5);
}

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function ensureHorarioAtencionConfig(
  value?: HorarioAtencionConfig | null,
  legacyConfig?: Partial<CandeConfig> | null
): HorarioAtencionConfig {
  const raw = value && typeof value === "object" ? value : null;

  const legacyStart = normalizeTime(legacyConfig?.horario_inicio || "09:00");
  const legacyEnd = normalizeTime(legacyConfig?.horario_fin || "20:30");
  const legacyDays = Array.isArray(legacyConfig?.dias_laborales)
    ? legacyConfig?.dias_laborales || []
    : [1, 2, 3, 4, 5];

  const base: HorarioAtencionConfig = {
    timezone: cleanText(raw?.timezone) || DEFAULT_HORARIO_ATENCION_CONFIG.timezone,
    cooldown_hours: toNumber(raw?.cooldown_hours, DEFAULT_HORARIO_ATENCION_CONFIG.cooldown_hours),
    dias: { ...DEFAULT_HORARIO_ATENCION_CONFIG.dias }
  };

  for (const day of HORARIO_DAY_OPTIONS) {
    const existing = raw?.dias?.[day.key];

    base.dias[day.key] = {
      enabled:
        typeof existing?.enabled === "boolean"
          ? existing.enabled
          : legacyDays.includes(day.value),
      start: normalizeTime(existing?.start || legacyStart),
      end: normalizeTime(existing?.end || legacyEnd)
    };
  }

  return base;
}

function getDiasLaboralesFromHorarioConfig(config: HorarioAtencionConfig): number[] {
  return HORARIO_DAY_OPTIONS
    .filter((day) => config.dias[day.key]?.enabled)
    .map((day) => day.value);
}

function textToArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((item) => cleanText(item)).filter(Boolean);
  }

  const text = cleanText(value);
  if (!text) return [];

  return text
    .split("\n")
    .map((item) => item.replace(/^[-•]\s*/, "").trim())
    .filter(Boolean);
}

function arrayToText(value: unknown): string {
  return textToArray(value).join("\n");
}



function emptyCampoDraft(): CampoDraft {
  return {
    clave: "",
    etiqueta: "",
    pregunta_sugerida: "",
    requerido: true,
    peso: "10",
    orden: "1"
  };
}

function emptyFaqDraft(): FaqDraft {
  return {
    pregunta: "",
    respuesta: "",
    orden: "1"
  };
}

function emptyPalabraDraft(): PalabraDraft {
  return {
    palabra: "",
    peso: "10"
  };
}

function emptyPipelineDraft(): PipelineDraft {
  return {
    nombre: "",
    color: "#8b5cf6",
    orden: "1",
    es_final: false,
    resultado: "",
    es_sin_atender: false
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
    <article className="rounded-[14px] border border-black/10 bg-white/62 px-3.5 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="text-[10.5px] font-medium text-[#64748b]">{label}</div>
      <div className="mt-0.5 text-[18px] font-semibold tracking-tight text-[#172033]">{value}</div>
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
  children: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-black/10 bg-white/58 p-3.5 shadow-sm backdrop-blur-xl">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon ? (
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#eef6f7] text-[#4f7c90]">
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

function FieldLabel({ children }: { children: React.ReactNode }) {
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
  type?: "text" | "time" | "number";
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-9 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12.5px] font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90] disabled:opacity-50"
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
      value={value || ""}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className="w-full resize-none rounded-[14px] border border-black/10 bg-white px-3 py-2.5 text-[12.5px] font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]/50 focus:ring-2 focus:ring-[#4f7c90]/15 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
    />
  );
}

function ToggleButton({
  active,
  children,
  onClick
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-h-8 items-center justify-center rounded-[10px] border px-2.5 text-[11px] font-medium transition",
        active
          ? "border-[#4f7c90] bg-[#4f7c90] text-white shadow-sm"
          : "border-black/10 bg-white text-[#475569] hover:border-[#4f7c90]/35 hover:text-[#172033]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  disabled = false,
  danger = false,
  type = "button"
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  danger?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-3 text-[11px] font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
        danger ? "bg-red-50 text-red-600 hover:bg-red-100" : "bg-[#4f7c90] text-white hover:bg-[#456f82]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function SmallPill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 items-center rounded-md bg-[#f1f5f9] px-1.5 text-[10px] font-medium text-[#64748b] ring-1 ring-black/5">
      {children}
    </span>
  );
}

export function CandePanel() {
  const [activeTab, setActiveTab] = useState<TabKey>("general");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [, setConfig] = useState<CandeConfig | null>(null);
  const [configDraft, setConfigDraft] = useState<CandeConfig | null>(null);

  const [datosARelevarDraft, setDatosARelevarDraft] = useState("");
  const [cosasProhibidasDraft, setCosasProhibidasDraft] = useState("");

  const [campos, setCampos] = useState<CandeCampo[]>([]);
  const [faqs, setFaqs] = useState<CandeFaq[]>([]);
  const [palabras, setPalabras] = useState<PalabraClave[]>([]);
  const [pipeline, setPipeline] = useState<PipelineEstado[]>([]);

  const [campoDraft, setCampoDraft] = useState<CampoDraft>(emptyCampoDraft());
  const [faqDraft, setFaqDraft] = useState<FaqDraft>(emptyFaqDraft());
  const [palabraDraft, setPalabraDraft] = useState<PalabraDraft>(emptyPalabraDraft());
  const [pipelineDraft, setPipelineDraft] = useState<PipelineDraft>(emptyPipelineDraft());

  const [editingCampoId, setEditingCampoId] = useState<string | null>(null);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingPalabraId, setEditingPalabraId] = useState<string | null>(null);
  const [editingPipelineId, setEditingPipelineId] = useState<string | null>(null);

  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);

    const [configRes, camposRes, faqsRes, palabrasRes, pipelineRes] = await Promise.all([
      supabase
        .from("cande_config")
        .select("*")
        .order("updated_at", { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("cande_campos")
        .select("id,clave,etiqueta,pregunta_sugerida,requerido,peso,orden")
        .order("orden", { ascending: true }),
      supabase
        .from("cande_faqs")
        .select("id,pregunta,respuesta,orden")
        .order("orden", { ascending: true }),
      supabase
        .from("cande_palabras_clave")
        .select("id,palabra,peso")
        .order("peso", { ascending: false }),
      supabase
        .from("pipeline_estados")
        .select("id,nombre,color,orden,es_final,resultado,es_sin_atender")
        .order("orden", { ascending: true })
    ]);

    const firstError =
      configRes.error || camposRes.error || faqsRes.error || palabrasRes.error || pipelineRes.error;

    if (firstError) {
      setError(firstError.message || "Error cargando configuración de Cande.");
      setLoading(false);
      return;
    }

    const rawConfig = (configRes.data || null) as CandeConfig | null;

    const nextConfig = rawConfig
      ? {
          ...rawConfig,
          auto_reply_fuera_horario_enabled:
            rawConfig.auto_reply_fuera_horario_enabled ?? true,
          horario_atencion_config: ensureHorarioAtencionConfig(
            rawConfig.horario_atencion_config,
            rawConfig
          ),
          mensaje_fin_semana: rawConfig.mensaje_fin_semana || DEFAULT_MENSAJE_FIN_SEMANA
        }
      : null;

    setConfig(nextConfig);
    setConfigDraft(nextConfig);
    setDatosARelevarDraft(arrayToText(nextConfig?.datos_a_relevar));
    setCosasProhibidasDraft(arrayToText(nextConfig?.cosas_prohibidas));

    setCampos((camposRes.data || []) as CandeCampo[]);
    setFaqs((faqsRes.data || []) as CandeFaq[]);
    setPalabras((palabrasRes.data || []) as PalabraClave[]);
    setPipeline((pipelineRes.data || []) as PipelineEstado[]);
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

  const sortedCampos = useMemo(() => [...campos].sort((a, b) => a.orden - b.orden), [campos]);
  const sortedFaqs = useMemo(() => [...faqs].sort((a, b) => a.orden - b.orden), [faqs]);
  const sortedPipeline = useMemo(() => [...pipeline].sort((a, b) => a.orden - b.orden), [pipeline]);

  const totalScoreCampos = useMemo(() => {
    return sortedCampos.reduce((acc, campo) => acc + Number(campo.peso || 0), 0);
  }, [sortedCampos]);

  const horarioConfig = useMemo(
    () => ensureHorarioAtencionConfig(configDraft?.horario_atencion_config, configDraft),
    [configDraft]
  );

  function updateDraft<K extends keyof CandeConfig>(key: K, value: CandeConfig[K]) {
    setConfigDraft((current) => {
      if (!current) return current;
      return { ...current, [key]: value };
    });
  }

  

  function updateHorarioConfig(patch: Partial<HorarioAtencionConfig>) {
    setConfigDraft((current) => {
      if (!current) return current;

      const base = ensureHorarioAtencionConfig(current.horario_atencion_config, current);

      return {
        ...current,
        horario_atencion_config: {
          ...base,
          ...patch,
          dias: patch.dias || base.dias
        }
      };
    });
  }

  function updateHorarioDay(key: HorarioDayKey, patch: Partial<HorarioDayConfig>) {
    setConfigDraft((current) => {
      if (!current) return current;

      const base = ensureHorarioAtencionConfig(current.horario_atencion_config, current);

      const nextConfig: HorarioAtencionConfig = {
        ...base,
        dias: {
          ...base.dias,
          [key]: {
            ...base.dias[key],
            ...patch
          }
        }
      };

      return {
        ...current,
        horario_atencion_config: nextConfig,
        dias_laborales: getDiasLaboralesFromHorarioConfig(nextConfig)
      };
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

    const horarioAtencionConfig = ensureHorarioAtencionConfig(
      configDraft.horario_atencion_config,
      configDraft
    );

    const diasLaboralesFromHorario = getDiasLaboralesFromHorarioConfig(horarioAtencionConfig);

    const payload = {
      enabled: configDraft.enabled,
      modo: configDraft.modo,
      horario_inicio: normalizeTime(horarioAtencionConfig.dias.mon.start),
      horario_fin: normalizeTime(horarioAtencionConfig.dias.mon.end),
      dias_laborales: diasLaboralesFromHorario,
      espera_minutos: toNumber(configDraft.espera_minutos, 5),

      auto_reply_fuera_horario_enabled: Boolean(configDraft.auto_reply_fuera_horario_enabled),
      horario_atencion_config: horarioAtencionConfig,
      mensaje_fin_semana: cleanText(configDraft.mensaje_fin_semana),

      nombre_ia: cleanText(configDraft.nombre_ia) || "Cande",
      marca_visible: cleanText(configDraft.marca_visible) || "ALMUNDO Franquicia Córdoba",
      tono: cleanText(configDraft.tono),
      prompt_base: cleanText(configDraft.prompt_base),
      reglas_duras: cleanText(configDraft.reglas_duras),
      modelo: cleanText(configDraft.modelo) || "gpt-4o-mini",

      mensaje_inicial: cleanText(configDraft.mensaje_inicial),
      mensaje_falta_info: cleanText(configDraft.mensaje_falta_info),
      mensaje_fuera_horario: cleanText(configDraft.mensaje_fuera_horario),
      mensaje_no_entiende: cleanText(configDraft.mensaje_no_entiende),
      mensaje_despedida: cleanText(configDraft.mensaje_despedida),
      mensaje_confirmar_origen_sugerido: cleanText(configDraft.mensaje_confirmar_origen_sugerido),
      mensaje_datos_completos: cleanText(configDraft.mensaje_datos_completos),
      plantilla_resumen: cleanText(configDraft.plantilla_resumen),

      datos_a_relevar: textToArray(datosARelevarDraft),
      cosas_prohibidas: textToArray(cosasProhibidasDraft),

      umbral_transferencia: toNumber(configDraft.umbral_transferencia, 70),
      minimo_score_para_derivar: toNumber(configDraft.minimo_score_para_derivar, 85),
      max_mensajes_antes_derivar: toNumber(configDraft.max_mensajes_antes_derivar, 0),

      derivar_si_pide_humano: Boolean(configDraft.derivar_si_pide_humano),
      derivar_si_urgente: Boolean(configDraft.derivar_si_urgente),
      derivar_si_score_supera_umbral: Boolean(configDraft.derivar_si_score_supera_umbral),

      pedir_presupuesto_antes_derivar: Boolean(configDraft.pedir_presupuesto_antes_derivar),
      origen_sugerido_suma_score: Boolean(configDraft.origen_sugerido_suma_score),
      confirmar_origen_sugerido: Boolean(configDraft.confirmar_origen_sugerido),

      updated_by: userId,
      updated_at: new Date().toISOString()
    };

    const { error: saveError } = await supabase
      .from("cande_config")
      .update(payload)
      .eq("id", configDraft.id);

    if (saveError) {
      setError(saveError.message || "No se pudo guardar Cande.");
      setSaving(false);
      return;
    }

    setStatus("Configuración de Cande guardada.");
    await loadData();
    setSaving(false);
  }

  function editCampo(campo: CandeCampo) {
    setEditingCampoId(campo.id);
    setCampoDraft({
      id: campo.id,
      clave: campo.clave,
      etiqueta: campo.etiqueta,
      pregunta_sugerida: campo.pregunta_sugerida || "",
      requerido: campo.requerido,
      peso: String(campo.peso || 0),
      orden: String(campo.orden || 0)
    });
    setActiveTab("campos");
  }

  function resetCampoDraft() {
    setEditingCampoId(null);
    setCampoDraft(emptyCampoDraft());
  }

  async function saveCampo() {
    const clave = campoDraft.clave.trim().toLowerCase().replace(/\s+/g, "_");
    const etiqueta = campoDraft.etiqueta.trim();

    if (!clave || !etiqueta) {
      setError("Completá clave y etiqueta del campo.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    const payload = {
      clave,
      etiqueta,
      pregunta_sugerida: campoDraft.pregunta_sugerida.trim() || null,
      requerido: campoDraft.requerido,
      peso: toNumber(campoDraft.peso, 0),
      orden: toNumber(campoDraft.orden, campos.length + 1)
    };

    const response = editingCampoId
      ? await supabase.from("cande_campos").update(payload).eq("id", editingCampoId)
      : await supabase.from("cande_campos").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar el campo.");
      setSaving(false);
      return;
    }

    resetCampoDraft();
    setStatus("Campo guardado.");
    await loadData();
    setSaving(false);
  }

  async function deleteCampo(id: string) {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase.from("cande_campos").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message || "No se pudo eliminar el campo.");
      setSaving(false);
      return;
    }

    setStatus("Campo eliminado.");
    await loadData();
    setSaving(false);
  }

  function editFaq(faq: CandeFaq) {
    setEditingFaqId(faq.id);
    setFaqDraft({
      id: faq.id,
      pregunta: faq.pregunta,
      respuesta: faq.respuesta,
      orden: String(faq.orden || 0)
    });
    setActiveTab("faqs");
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
      orden: toNumber(faqDraft.orden, faqs.length + 1)
    };

    const response = editingFaqId
      ? await supabase.from("cande_faqs").update(payload).eq("id", editingFaqId)
      : await supabase.from("cande_faqs").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar la FAQ.");
      setSaving(false);
      return;
    }

    resetFaqDraft();
    setStatus("FAQ guardada.");
    await loadData();
    setSaving(false);
  }

  async function deleteFaq(id: string) {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase.from("cande_faqs").delete().eq("id", id);

    if (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la FAQ.");
      setSaving(false);
      return;
    }

    setStatus("FAQ eliminada.");
    await loadData();
    setSaving(false);
  }

  function editPalabra(item: PalabraClave) {
    setEditingPalabraId(item.id);
    setPalabraDraft({
      id: item.id,
      palabra: item.palabra,
      peso: String(item.peso || 0)
    });
    setActiveTab("scoring");
  }

  function resetPalabraDraft() {
    setEditingPalabraId(null);
    setPalabraDraft(emptyPalabraDraft());
  }

  async function savePalabra() {
    const palabra = palabraDraft.palabra.trim();

    if (!palabra) {
      setError("Completá la palabra clave.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    const payload = {
      palabra,
      peso: toNumber(palabraDraft.peso, 10)
    };

    const response = editingPalabraId
      ? await supabase.from("cande_palabras_clave").update(payload).eq("id", editingPalabraId)
      : await supabase.from("cande_palabras_clave").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar la palabra clave.");
      setSaving(false);
      return;
    }

    resetPalabraDraft();
    setStatus("Palabra clave guardada.");
    await loadData();
    setSaving(false);
  }

  async function deletePalabra(id: string) {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase
      .from("cande_palabras_clave")
      .delete()
      .eq("id", id);

    if (deleteError) {
      setError(deleteError.message || "No se pudo eliminar la palabra clave.");
      setSaving(false);
      return;
    }

    setStatus("Palabra clave eliminada.");
    await loadData();
    setSaving(false);
  }

  function editPipeline(estado: PipelineEstado) {
    setEditingPipelineId(estado.id);
    setPipelineDraft({
      id: estado.id,
      nombre: estado.nombre,
      color: estado.color || "#8b5cf6",
      orden: String(estado.orden || 0),
      es_final: estado.es_final,
      resultado: estado.resultado || "",
      es_sin_atender: estado.es_sin_atender
    });
    setActiveTab("pipeline");
  }

  function resetPipelineDraft() {
    setEditingPipelineId(null);
    setPipelineDraft(emptyPipelineDraft());
  }

    async function savePipeline() {
    const nombre = pipelineDraft.nombre.trim();

    if (!nombre) {
      setError("Completá el nombre del estado.");
      return;
    }

    setSaving(true);
    setError(null);
    setStatus(null);

    const payload = {
      nombre,
      color: pipelineDraft.color.trim() || "#8b5cf6",
      orden: toNumber(pipelineDraft.orden, pipeline.length + 1),
      es_final: pipelineDraft.es_final,
      resultado: pipelineDraft.resultado.trim() || null,
      es_sin_atender: pipelineDraft.es_sin_atender
    };

    const response = editingPipelineId
      ? await supabase.from("pipeline_estados").update(payload).eq("id", editingPipelineId)
      : await supabase.from("pipeline_estados").insert(payload);

    if (response.error) {
      setError(response.error.message || "No se pudo guardar el estado del pipeline.");
      setSaving(false);
      return;
    }

    resetPipelineDraft();
    setStatus("Estado de pipeline guardado.");
    await loadData();
    setSaving(false);
  }

  async function deletePipeline(id: string) {
    setSaving(true);
    setError(null);
    setStatus(null);

    const { error: deleteError } = await supabase.from("pipeline_estados").delete().eq("id", id);

    if (deleteError) {
      setError(
        deleteError.message ||
          "No se pudo eliminar el estado. Puede estar usado por oportunidades existentes."
      );
      setSaving(false);
      return;
    }

    setStatus("Estado eliminado.");
    await loadData();
    setSaving(false);
  }

  const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings2 size={13} /> },
    { id: "identidad", label: "Identidad", icon: <Sparkles size={13} /> },
    { id: "campos", label: "Campos", icon: <ListChecks size={13} /> },
    { id: "faqs", label: "FAQs", icon: <HelpCircle size={13} /> },
    { id: "scoring", label: "Scoring", icon: <Target size={13} /> },
    { id: "pipeline", label: "Pipeline", icon: <SlidersHorizontal size={13} /> }
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Cande
              </h1>

              <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-emerald-700 ring-1 ring-emerald-100">
                IA pasajero
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Configuración editable de la asistente IA de primera atención.
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
          >
            <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        <div className="grid gap-2.5 md:grid-cols-4">
          <MiniMetric label="Estado" value={configDraft?.enabled ? "Activa" : "Apagada"} />
          <MiniMetric label="Modo" value={configDraft?.modo || "—"} />
          <MiniMetric label="Campos" value={`${campos.length} · ${totalScoreCampos} pts`} />
          <MiniMetric
            label="Auto fuera horario"
            value={configDraft?.auto_reply_fuera_horario_enabled ? "Sí" : "No"}
          />
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
                "flex h-7 items-center gap-1.5 rounded-[9px] px-2.5 text-[11px] font-medium transition",
                activeTab === tab.id
                  ? "bg-[#4f7c90] text-white shadow-sm"
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
            <Loader2 className="animate-spin text-[#4f7c90]" size={22} />
          </div>
        ) : null}

        {!loading && !configDraft ? (
          <div className="mt-3">
            <EmptyState title="No hay configuración de Cande" subtitle="Revisá el seed inicial de cande_config." />
          </div>
        ) : null}

        {!loading && configDraft ? (
          <div className="mt-3">
            {activeTab === "general" ? (
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <Card
                  title="Modo de operación"
                  subtitle="Definí cuándo Cande puede responder, indagar o derivar."
                  icon={<Settings2 size={15} />}
                >
                  <div className="mb-3 flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                    <div>
                      <div className="text-[12.5px] font-semibold text-[#172033]">
                        Cande está {configDraft.enabled ? "activa" : "apagada"}
                      </div>
                      <p className="mt-0.5 text-[11px] font-normal text-[#64748b]">
                        Toggle maestro. Si está apagada, no responde como IA en ninguna conversación.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateDraft("enabled", !configDraft.enabled)}
                      className={[
                        "relative h-6 w-11 rounded-full transition",
                        configDraft.enabled ? "bg-emerald-500" : "bg-slate-300"
                      ].join(" ")}
                      aria-label="Activar o apagar Cande"
                    >
                      <span
                        className={[
                          "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
                          configDraft.enabled ? "left-6" : "left-1"
                        ].join(" ")}
                      />
                    </button>
                  </div>

                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {MODE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => updateDraft("modo", option.value)}
                        className={[
                          "min-h-[58px] rounded-[12px] border px-3 py-2.5 text-left transition",
                          configDraft.modo === option.value
                            ? "border-[#4f7c90]/45 bg-[#eef6f7]"
                            : "border-black/10 bg-white hover:border-[#4f7c90]/35"
                        ].join(" ")}
                      >
                        <div className="text-[12.5px] font-semibold text-[#172033]">
                          {option.label}
                        </div>
                        <div className="mt-0.5 text-[11px] font-normal leading-snug text-[#64748b]">
                          {option.description}
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[14px] border border-black/10 bg-white/70 p-3">
                    <div className="mb-3">
                      <h3 className="text-[13px] font-semibold text-[#172033]">
                        Horario de atención por día
                      </h3>
                      <p className="mt-0.5 text-[11px] font-normal leading-relaxed text-[#64748b]">
                        Estos horarios los usa LiveNos para saber cuándo responder automáticamente si Cande está apagada.
                      </p>
                    </div>

                    <div className="grid gap-2">
                      {HORARIO_DAY_OPTIONS.map((day) => {
                        const dayConfig = horarioConfig.dias[day.key];

                        return (
                          <div
                            key={day.key}
                            className="grid gap-2 rounded-[12px] border border-black/10 bg-white px-3 py-2.5 md:grid-cols-[120px_1fr_1fr]"
                          >
                            <div className="flex items-center justify-between gap-2 md:justify-start">
                              <button
                                type="button"
                                onClick={() =>
                                  updateHorarioDay(day.key, {
                                    enabled: !dayConfig.enabled
                                  })
                                }
                                className={[
                                  "relative h-5 w-9 shrink-0 rounded-full transition",
                                  dayConfig.enabled ? "bg-emerald-500" : "bg-slate-300"
                                ].join(" ")}
                                aria-label={`Activar ${day.label}`}
                              >
                                <span
                                  className={[
                                    "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition",
                                    dayConfig.enabled ? "left-4.5" : "left-0.5"
                                  ].join(" ")}
                                />
                              </button>

                              <span className="text-[12px] font-semibold text-[#172033]">
                                {day.label}
                              </span>
                            </div>

                            <div>
                              <FieldLabel>Inicio</FieldLabel>
                              <TextInput
                                type="time"
                                value={normalizeTime(dayConfig.start)}
                                onChange={(value) =>
                                  updateHorarioDay(day.key, {
                                    start: normalizeTime(value)
                                  })
                                }
                                disabled={!dayConfig.enabled}
                              />
                            </div>

                            <div>
                              <FieldLabel>Fin</FieldLabel>
                              <TextInput
                                type="time"
                                value={normalizeTime(dayConfig.end)}
                                onChange={(value) =>
                                  updateHorarioDay(day.key, {
                                    end: normalizeTime(value)
                                  })
                                }
                                disabled={!dayConfig.enabled}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Card>

                <aside className="space-y-3.5">
                  <Card title="Auto-respuesta fuera de horario" icon={<Clock3 size={15} />}>
                    <div className="grid gap-2.5">
                      <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                        <div>
                          <div className="text-[12.5px] font-semibold text-[#172033]">
                            Responder cuando Cande está apagada
                          </div>
                          <p className="mt-0.5 text-[11px] font-normal leading-relaxed text-[#64748b]">
                            Si entra un WhatsApp fuera de horario y Cande no está activa, LiveNos envía este mensaje automático.
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updateDraft(
                              "auto_reply_fuera_horario_enabled",
                              !configDraft.auto_reply_fuera_horario_enabled
                            )
                          }
                          className={[
                            "relative h-6 w-11 shrink-0 rounded-full transition",
                            configDraft.auto_reply_fuera_horario_enabled
                              ? "bg-emerald-500"
                              : "bg-slate-300"
                          ].join(" ")}
                          aria-label="Activar auto-respuesta fuera de horario"
                        >
                          <span
                            className={[
                              "absolute top-1 h-4 w-4 rounded-full bg-white shadow transition",
                              configDraft.auto_reply_fuera_horario_enabled ? "left-6" : "left-1"
                            ].join(" ")}
                          />
                        </button>
                      </div>

                      <div>
                        <FieldLabel>Zona horaria</FieldLabel>
                        <TextInput
                          value={horarioConfig.timezone}
                          onChange={(value) => updateHorarioConfig({ timezone: value })}
                          placeholder="America/Argentina/Cordoba"
                        />
                      </div>

                      <div>
                        <FieldLabel>Cooldown en horas</FieldLabel>
                        <TextInput
                          type="number"
                          value={String(horarioConfig.cooldown_hours)}
                          onChange={(value) =>
                            updateHorarioConfig({
                              cooldown_hours: toNumber(value, 8)
                            })
                          }
                          placeholder="8"
                        />
                        <p className="mt-1 text-[10.5px] font-normal text-[#64748b]">
                          Evita mandar varias respuestas automáticas seguidas en la misma conversación.
                        </p>
                      </div>

                      <div>
                        <FieldLabel>Espera antes de responder Cande</FieldLabel>
                        <TextInput
                          type="number"
                          value={String(configDraft.espera_minutos)}
                          onChange={(value) =>
                            updateDraft("espera_minutos", toNumber(value, 0))
                          }
                          placeholder="5"
                        />
                      </div>
                    </div>
                  </Card>

                  <Card title="Mensajes automáticos">
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Mensaje fuera de horario</FieldLabel>
                        <TextArea
                          value={configDraft.mensaje_fuera_horario || ""}
                          onChange={(value) => updateDraft("mensaje_fuera_horario", value)}
                          rows={5}
                          placeholder="Gracias por escribirnos. En este momento estamos fuera de nuestro horario de atención..."
                        />
                      </div>

                      <div>
                        <FieldLabel>Mensaje día no laborable / fin de semana</FieldLabel>
                        <TextArea
                          value={configDraft.mensaje_fin_semana || ""}
                          onChange={(value) => updateDraft("mensaje_fin_semana", value)}
                          rows={5}
                          placeholder="Gracias por escribirnos. Nuestro equipo retomará la atención el próximo día hábil..."
                        />
                      </div>
                    </div>
                  </Card>
                </aside>

                <div className="flex justify-end xl:col-span-2">
                  <ActionButton onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar configuración general
                  </ActionButton>
                </div>
              </div>
            ) : null}

            {activeTab === "identidad" ? (
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <Card
                  title="Identidad, tono y reglas"
                  subtitle="Define cómo habla Cande y qué límites comerciales tiene."
                  icon={<Sparkles size={15} />}
                >
                  <div className="grid gap-2.5 md:grid-cols-2">
                    <div>
                      <FieldLabel>Nombre IA</FieldLabel>
                      <TextInput
                        value={configDraft.nombre_ia}
                        onChange={(value) => updateDraft("nombre_ia", value)}
                        placeholder="Cande"
                      />
                    </div>

                    <div>
                      <FieldLabel>Marca visible</FieldLabel>
                      <TextInput
                        value={cleanText(configDraft.marca_visible)}
                        onChange={(value) => updateDraft("marca_visible", value)}
                        placeholder="ALMUNDO Franquicia Córdoba"
                      />
                    </div>
                  </div>

                  <div className="mt-2.5">
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

                  <div className="mt-2.5">
                    <FieldLabel>Tono</FieldLabel>
                    <TextArea
                      value={configDraft.tono}
                      onChange={(value) => updateDraft("tono", value)}
                      rows={3}
                    />
                  </div>


                                    <div className="mt-2.5">
                    <FieldLabel>Prompt base</FieldLabel>
                    <TextArea
                      value={configDraft.prompt_base}
                      onChange={(value) => updateDraft("prompt_base", value)}
                      rows={7}
                    />
                  </div>

                  <div className="mt-2.5">
                    <FieldLabel>Reglas duras</FieldLabel>
                    <TextArea
                      value={configDraft.reglas_duras}
                      onChange={(value) => updateDraft("reglas_duras", value)}
                      rows={5}
                    />
                  </div>
                </Card>

                <aside className="space-y-3.5">
                  <Card title="Mensajes base">
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Mensaje inicial</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.mensaje_inicial)}
                          onChange={(value) => updateDraft("mensaje_inicial", value)}
                          rows={3}
                        />
                      </div>

                      <div>
                        <FieldLabel>Falta información</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.mensaje_falta_info)}
                          onChange={(value) => updateDraft("mensaje_falta_info", value)}
                          rows={3}
                        />
                      </div>

                      <div>
                        <FieldLabel>No entiende</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.mensaje_no_entiende)}
                          onChange={(value) => updateDraft("mensaje_no_entiende", value)}
                          rows={3}
                        />
                      </div>

                      <div>
                        <FieldLabel>Fuera de horario</FieldLabel>
                        <TextArea
                         value={configDraft.mensaje_fuera_horario || ""}
                          onChange={(value) => updateDraft("mensaje_fuera_horario", value)}
                          rows={3}
                        />
                      </div>
                    </div>
                  </Card>

                  <Card title="Datos a relevar">
                    <FieldLabel>Uno por línea</FieldLabel>
                    <TextArea value={datosARelevarDraft} onChange={setDatosARelevarDraft} rows={6} />
                  </Card>

                  <Card title="Cosas prohibidas">
                    <FieldLabel>Una por línea</FieldLabel>
                    <TextArea value={cosasProhibidasDraft} onChange={setCosasProhibidasDraft} rows={6} />
                  </Card>
                </aside>

                <div className="flex justify-end xl:col-span-2">
                  <ActionButton onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar identidad y reglas
                  </ActionButton>
                </div>
              </div>
            ) : null}

            {activeTab === "campos" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card
                  title={editingCampoId ? "Editar campo" : "Nuevo campo"}
                  subtitle="Datos que Cande debe pedir antes de derivar."
                  icon={<ListChecks size={15} />}
                >
                  <div className="grid gap-2.5">
                    <div>
                      <FieldLabel>Clave interna</FieldLabel>
                      <TextInput
                        value={campoDraft.clave}
                        onChange={(value) => setCampoDraft((current) => ({ ...current, clave: value }))}
                        placeholder="destino"
                      />
                    </div>

                    <div>
                      <FieldLabel>Etiqueta visible</FieldLabel>
                      <TextInput
                        value={campoDraft.etiqueta}
                        onChange={(value) => setCampoDraft((current) => ({ ...current, etiqueta: value }))}
                        placeholder="Destino"
                      />
                    </div>

                    <div>
                      <FieldLabel>Pregunta sugerida</FieldLabel>
                      <TextArea
                        value={campoDraft.pregunta_sugerida}
                        onChange={(value) =>
                          setCampoDraft((current) => ({ ...current, pregunta_sugerida: value }))
                        }
                        rows={3}
                        placeholder="¿A dónde te gustaría viajar?"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel>Peso score</FieldLabel>
                        <TextInput
                          value={campoDraft.peso}
                          onChange={(value) => setCampoDraft((current) => ({ ...current, peso: value }))}
                          placeholder="10"
                        />
                      </div>

                      <div>
                        <FieldLabel>Orden</FieldLabel>
                        <TextInput
                          value={campoDraft.orden}
                          onChange={(value) => setCampoDraft((current) => ({ ...current, orden: value }))}
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <ToggleButton
                      active={campoDraft.requerido}
                      onClick={() => setCampoDraft((current) => ({ ...current, requerido: !current.requerido }))}
                    >
                      {campoDraft.requerido ? "Requerido" : "Opcional"}
                    </ToggleButton>

                    <div className="flex gap-2">
                      <ActionButton onClick={saveCampo} disabled={saving}>
                        <Save size={13} />
                        {editingCampoId ? "Guardar" : "Agregar"}
                      </ActionButton>

                      {editingCampoId ? (
                        <ActionButton onClick={resetCampoDraft} disabled={saving} danger>
                          <X size={13} />
                          Cancelar
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <Card
                  title="Campos configurados"
                  subtitle={`Alimentan oportunidad comercial y score. Total actual: ${totalScoreCampos}/100.`}
                >
                  <div className="space-y-2">
                    {sortedCampos.length === 0 ? (
                      <EmptyState title="Sin campos" subtitle="Agregá el primer campo a relevar." />
                    ) : null}

                    {sortedCampos.map((campo) => (
                      <article key={campo.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-[12.5px] font-semibold text-[#172033]">{campo.etiqueta}</h3>
                              <SmallPill>{campo.clave}</SmallPill>
                              <SmallPill>{campo.requerido ? "Requerido" : "Opcional"}</SmallPill>
                              <SmallPill>{campo.peso || 0} pts</SmallPill>
                              <SmallPill>Orden {campo.orden}</SmallPill>
                            </div>

                            <p className="mt-2 text-[11px] font-normal leading-relaxed text-[#64748b]">
                              {campo.pregunta_sugerida || "Sin pregunta sugerida"}
                            </p>
                          </div>

                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => editCampo(campo)}
                              className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#eef6f7] text-[#4f7c90] hover:bg-[#dcecef]"
                              aria-label="Editar"
                            >
                              <Settings2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteCampo(campo.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red-50 text-red-600 hover:bg-red-100"
                              aria-label="Eliminar"
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
            ) : null}

            {activeTab === "faqs" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card
                  title={editingFaqId ? "Editar FAQ" : "Nueva FAQ"}
                  subtitle="Respuestas autorizadas que Cande puede usar."
                  icon={<HelpCircle size={15} />}
                >
                  <div className="grid gap-2.5">
                    <div>
                      <FieldLabel>Pregunta</FieldLabel>
                      <TextArea
                        value={faqDraft.pregunta}
                        onChange={(value) => setFaqDraft((current) => ({ ...current, pregunta: value }))}
                        rows={3}
                        placeholder="¿Venden paquetes a Brasil?"
                      />
                    </div>

                    <div>
                      <FieldLabel>Respuesta permitida</FieldLabel>
                      <TextArea
                        value={faqDraft.respuesta}
                        onChange={(value) => setFaqDraft((current) => ({ ...current, respuesta: value }))}
                        rows={6}
                        placeholder="Sí, podemos ayudarte con paquetes..."
                      />
                    </div>

                    <div>
                      <FieldLabel>Orden</FieldLabel>
                      <TextInput
                        value={faqDraft.orden}
                        onChange={(value) => setFaqDraft((current) => ({ ...current, orden: value }))}
                        placeholder="1"
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

                <Card title="FAQs cargadas" subtitle="Base de respuestas comerciales permitidas.">
                  <div className="space-y-2">
                    {sortedFaqs.length === 0 ? (
                      <EmptyState title="Sin FAQs" subtitle="Agregá la primera pregunta frecuente." />
                    ) : null}

                    {sortedFaqs.map((faq) => (
                      <article key={faq.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <h3 className="text-[12.5px] font-semibold text-[#172033]">{faq.pregunta}</h3>
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
                              className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#eef6f7] text-[#4f7c90] hover:bg-[#dcecef]"
                              aria-label="Editar"
                            >
                              <Settings2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteFaq(faq.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red-50 text-red-600 hover:bg-red-100"
                              aria-label="Eliminar"
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
            ) : null}

            {activeTab === "scoring" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <div className="space-y-3.5">
                  <Card
                    title={editingPalabraId ? "Editar palabra" : "Nueva palabra"}
                    subtitle="Estas palabras o frases suman score."
                    icon={<Target size={15} />}
                  >
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Palabra o frase</FieldLabel>
                        <TextInput
                          value={palabraDraft.palabra}
                          onChange={(value) => setPalabraDraft((current) => ({ ...current, palabra: value }))}
                          placeholder="quiero reservar"
                        />
                      </div>

                      <div>
                        <FieldLabel>Peso</FieldLabel>
                        <TextInput
                          value={palabraDraft.peso}
                          onChange={(value) => setPalabraDraft((current) => ({ ...current, peso: value }))}
                          placeholder="10"
                        />
                      </div>

                      <div className="flex gap-2">
                        <ActionButton onClick={savePalabra} disabled={saving}>
                          <Save size={13} />
                          {editingPalabraId ? "Guardar" : "Agregar"}
                        </ActionButton>

                        {editingPalabraId ? (
                          <ActionButton onClick={resetPalabraDraft} disabled={saving} danger>
                            <X size={13} />
                            Cancelar
                          </ActionButton>
                        ) : null}
                      </div>
                    </div>
                  </Card>

                  <Card title="Derivación y score">
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Umbral transferencia histórico</FieldLabel>
                        <TextInput
                          value={String(configDraft.umbral_transferencia || 0)}
                          onChange={(value) => updateDraft("umbral_transferencia", toNumber(value, 0))}
                          placeholder="70"
                        />
                      </div>

                      <div>
                        <FieldLabel>Mínimo score para derivar</FieldLabel>
                        <TextInput
                          value={String(configDraft.minimo_score_para_derivar || 0)}
                          onChange={(value) => updateDraft("minimo_score_para_derivar", toNumber(value, 0))}
                          placeholder="85"
                        />
                      </div>

                      <div>
                        <FieldLabel>Máximo mensajes antes de derivar</FieldLabel>
                        <TextInput
                          value={String(configDraft.max_mensajes_antes_derivar || 0)}
                          onChange={(value) => updateDraft("max_mensajes_antes_derivar", toNumber(value, 0))}
                          placeholder="0"
                        />
                        <p className="mt-1 text-[10.5px] font-normal text-[#64748b]">
                          0 significa que no deriva por cantidad de mensajes.
                        </p>
                      </div>

                      <div className="grid gap-1.5">
                        <ToggleButton
                          active={Boolean(configDraft.derivar_si_pide_humano)}
                          onClick={() => updateDraft("derivar_si_pide_humano", !configDraft.derivar_si_pide_humano)}
                        >
                          {configDraft.derivar_si_pide_humano ? "Deriva si pide humano: Sí" : "Deriva si pide humano: No"}
                        </ToggleButton>

                        <ToggleButton
                          active={Boolean(configDraft.derivar_si_urgente)}
                          onClick={() => updateDraft("derivar_si_urgente", !configDraft.derivar_si_urgente)}
                        >
                          {configDraft.derivar_si_urgente ? "Deriva si es urgente: Sí" : "Deriva si es urgente: No"}
                        </ToggleButton>

                        <ToggleButton
                          active={Boolean(configDraft.derivar_si_score_supera_umbral)}
                          onClick={() =>
                            updateDraft("derivar_si_score_supera_umbral", !configDraft.derivar_si_score_supera_umbral)
                          }
                        >
                          {configDraft.derivar_si_score_supera_umbral ? "Deriva por score: Sí" : "Deriva por score: No"}
                        </ToggleButton>

                        <ToggleButton
                          active={Boolean(configDraft.pedir_presupuesto_antes_derivar)}
                          onClick={() =>
                            updateDraft("pedir_presupuesto_antes_derivar", !configDraft.pedir_presupuesto_antes_derivar)
                          }
                        >
                          {configDraft.pedir_presupuesto_antes_derivar ? "Pide presupuesto antes: Sí" : "Pide presupuesto antes: No"}
                        </ToggleButton>

                        <ToggleButton
                          active={Boolean(configDraft.confirmar_origen_sugerido)}
                          onClick={() =>
                            updateDraft("confirmar_origen_sugerido", !configDraft.confirmar_origen_sugerido)
                          }
                        >
                          {configDraft.confirmar_origen_sugerido ? "Confirma origen sugerido: Sí" : "Confirma origen sugerido: No"}
                        </ToggleButton>

                        <ToggleButton
                          active={Boolean(configDraft.origen_sugerido_suma_score)}
                          onClick={() =>
                            updateDraft("origen_sugerido_suma_score", !configDraft.origen_sugerido_suma_score)
                          }
                        >
                          {configDraft.origen_sugerido_suma_score
                            ? "Origen sugerido suma score: Sí"
                            : "Origen sugerido suma score: No"}
                        </ToggleButton>
                      </div>

                      <ActionButton onClick={saveConfig} disabled={saving}>
                        <Save size={13} />
                        Guardar derivación
                      </ActionButton>
                    </div>
                  </Card>
                </div>

                <div className="space-y-3.5">
                  <Card title="Mensajes de derivación e indagación">
                    <div className="grid gap-2.5">
                      <div>
                        <FieldLabel>Confirmar origen sugerido</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.mensaje_confirmar_origen_sugerido)}
                          onChange={(value) => updateDraft("mensaje_confirmar_origen_sugerido", value)}
                          rows={3}
                          placeholder="Por tu número, pareciera que estás en zona {{origen_sugerido}}..."
                        />
                      </div>

                      <div>
                        <FieldLabel>Datos completos / seguir indagando</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.mensaje_datos_completos)}
                          onChange={(value) => updateDraft("mensaje_datos_completos", value)}
                          rows={3}
                        />
                      </div>

                      <div>
                        <FieldLabel>Mensaje de despedida al transferir</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.mensaje_despedida)}
                          onChange={(value) => updateDraft("mensaje_despedida", value)}
                          rows={4}
                        />
                      </div>

                      <div>
                        <FieldLabel>Plantilla resumen interno</FieldLabel>
                        <TextArea
                          value={cleanText(configDraft.plantilla_resumen)}
                          onChange={(value) => updateDraft("plantilla_resumen", value)}
                          rows={5}
                        />
                      </div>
                    </div>
                  </Card>

                  <Card title="Palabras clave" subtitle="Ajustan manualmente la temperatura del lead.">
                    <div className="grid gap-2 md:grid-cols-2">
                      {palabras.length === 0 ? (
                        <EmptyState title="Sin palabras clave" subtitle="Agregá frases que indiquen intención comercial." />
                      ) : null}

                      {palabras.map((item) => (
                        <article key={item.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <h3 className="text-[12.5px] font-semibold text-[#172033]">{item.palabra}</h3>
                              <p className="mt-1 text-[11px] font-normal text-[#64748b]">+{item.peso || 0} puntos</p>
                            </div>

                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() => editPalabra(item)}
                                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#eef6f7] text-[#4f7c90] hover:bg-[#dcecef]"
                                aria-label="Editar"
                              >
                                <Settings2 size={13} />
                              </button>

                              <button
                                type="button"
                                onClick={() => deletePalabra(item.id)}
                                className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red-50 text-red-600 hover:bg-red-100"
                                aria-label="Eliminar"
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

            {activeTab === "pipeline" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card
                  title={editingPipelineId ? "Editar estado" : "Nuevo estado"}
                  subtitle="Estados del pipeline comercial generado por Cande."
                  icon={<SlidersHorizontal size={15} />}
                >
                  <div className="grid gap-2.5">
                    <div>
                      <FieldLabel>Nombre</FieldLabel>
                      <TextInput
                        value={pipelineDraft.nombre}
                        onChange={(value) => setPipelineDraft((current) => ({ ...current, nombre: value }))}
                        placeholder="Presupuestada"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <FieldLabel>Color</FieldLabel>
                        <TextInput
                          value={pipelineDraft.color}
                          onChange={(value) => setPipelineDraft((current) => ({ ...current, color: value }))}
                          placeholder="#8b5cf6"
                        />
                      </div>

                      <div>
                        <FieldLabel>Orden</FieldLabel>
                        <TextInput
                          value={pipelineDraft.orden}
                          onChange={(value) => setPipelineDraft((current) => ({ ...current, orden: value }))}
                          placeholder="1"
                        />
                      </div>
                    </div>

                    <div>
                      <FieldLabel>Resultado</FieldLabel>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { value: "", label: "Ninguno" },
                          { value: "ganada", label: "Ganada" },
                          { value: "perdida", label: "Perdida" }
                        ].map((item) => (
                          <ToggleButton
                            key={item.value}
                            active={pipelineDraft.resultado === item.value}
                            onClick={() => setPipelineDraft((current) => ({ ...current, resultado: item.value }))}
                          >
                            {item.label}
                          </ToggleButton>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <ToggleButton
                        active={pipelineDraft.es_final}
                        onClick={() => setPipelineDraft((current) => ({ ...current, es_final: !current.es_final }))}
                      >
                        {pipelineDraft.es_final ? "Estado final" : "No final"}
                      </ToggleButton>

                      <ToggleButton
                        active={pipelineDraft.es_sin_atender}
                        onClick={() =>
                          setPipelineDraft((current) => ({
                            ...current,
                            es_sin_atender: !current.es_sin_atender
                          }))
                        }
                      >
                        {pipelineDraft.es_sin_atender ? "Sin atender" : "Normal"}
                      </ToggleButton>
                    </div>

                    <div className="flex gap-2">
                      <ActionButton onClick={savePipeline} disabled={saving}>
                        <Save size={13} />
                        {editingPipelineId ? "Guardar" : "Agregar"}
                      </ActionButton>

                      {editingPipelineId ? (
                        <ActionButton onClick={resetPipelineDraft} disabled={saving} danger>
                          <X size={13} />
                          Cancelar
                        </ActionButton>
                      ) : null}
                    </div>
                  </div>
                </Card>

                <Card title="Pipeline de oportunidades" subtitle="Orden y comportamiento de cada columna.">
                  <div className="space-y-2">
                    {sortedPipeline.length === 0 ? (
                      <EmptyState title="Sin pipeline" subtitle="Agregá los estados comerciales." />
                    ) : null}

                    {sortedPipeline.map((estado) => (
                      <article key={estado.id} className="rounded-[12px] border border-black/10 bg-white p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span
                                className="h-2.5 w-2.5 rounded-full"
                                style={{ backgroundColor: estado.color || "#8b5cf6" }}
                              />
                              <h3 className="text-[12.5px] font-semibold text-[#172033]">{estado.nombre}</h3>
                              <SmallPill>Orden {estado.orden}</SmallPill>
                              {estado.es_final ? <SmallPill>Final</SmallPill> : null}
                              {estado.es_sin_atender ? <SmallPill>Sin atender</SmallPill> : null}
                              {estado.resultado ? <SmallPill>{estado.resultado}</SmallPill> : null}
                            </div>
                          </div>

                          <div className="flex shrink-0 gap-1.5">
                            <button
                              type="button"
                              onClick={() => editPipeline(estado)}
                              className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-[#eef6f7] text-[#4f7c90] hover:bg-[#dcecef]"
                              aria-label="Editar"
                            >
                              <Settings2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => deletePipeline(estado.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-red-50 text-red-600 hover:bg-red-100"
                              aria-label="Eliminar"
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
            ) : null}
          </div>
        ) : null}
      </main>
    </section>
  );
}