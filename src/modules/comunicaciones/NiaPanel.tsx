// src/modules/comunicaciones/NiaPanel.tsx

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bot,
  Brain,
  Check,
  Clock3,
  HelpCircle,
  Loader2,
  MessageSquareText,
  RefreshCcw,
  Save,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { EmptyState } from "./comunicacionesShared";

type TabKey = "general" | "identidad" | "resumenes" | "faqs" | "keywords" | "chat";

type NiaConfig = {
  id: string;
  nombre_ia: string;
  tono: string;
  prompt_base: string;
  reglas_duras: string;
  modelo: string;
  enabled: boolean;
  hora_resumen_diario: string;
  dias_resumen: number[];
  plantilla_resumen_vendedor: string;
  plantilla_resumen_gerencia: string;
  updated_at: string;
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

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <article className="rounded-[14px] border border-black/10 bg-white/62 px-3.5 py-2.5 shadow-sm backdrop-blur-xl">
      <div className="text-[10.5px] font-medium text-[#64748b]">{label}</div>
      <div className="mt-0.5 text-[18px] font-semibold tracking-tight text-[#172033]">
        {value}
      </div>
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
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#f3efff] text-[#7c3aed]">
                {icon}
              </span>
            ) : null}

            <h2 className="text-[14px] font-semibold leading-tight text-[#172033]">
              {title}
            </h2>
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
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      disabled={disabled}
      className="h-9 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12.5px] font-medium text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#7c3aed] disabled:opacity-50"
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
      className="w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[12.5px] font-medium leading-relaxed text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#7c3aed] disabled:opacity-50"
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
          ? "border-[#7c3aed] bg-[#7c3aed] text-white shadow-sm"
          : "border-black/10 bg-white text-[#475569] hover:border-[#7c3aed]/35 hover:text-[#172033]"
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
  danger = false
}: {
  children: React.ReactNode;
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
        danger
          ? "bg-red-50 text-red-600 hover:bg-red-100"
          : "bg-[#7c3aed] text-white hover:bg-[#6d28d9]"
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
      supabase
        .from("nia_config")
        .select(
          "id,nombre_ia,tono,prompt_base,reglas_duras,modelo,enabled,hora_resumen_diario,dias_resumen,plantilla_resumen_vendedor,plantilla_resumen_gerencia,updated_at"
        )
        .limit(1)
        .maybeSingle(),
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

    setConfigDraft((configRes.data || null) as NiaConfig | null);
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
      tono: configDraft.tono.trim(),
      prompt_base: configDraft.prompt_base.trim(),
      reglas_duras: configDraft.reglas_duras.trim(),
      modelo: configDraft.modelo.trim() || "gpt-4o-mini",
      enabled: configDraft.enabled,
      hora_resumen_diario: normalizeTime(configDraft.hora_resumen_diario),
      dias_resumen: configDraft.dias_resumen,
      plantilla_resumen_vendedor: configDraft.plantilla_resumen_vendedor.trim(),
      plantilla_resumen_gerencia: configDraft.plantilla_resumen_gerencia.trim(),
      updated_by: userId
    };

    const { error: saveError } = await supabase
      .from("nia_config")
      .update(payload)
      .eq("id", configDraft.id);

    if (saveError) {
      setError(saveError.message || "No se pudo guardar NIA.");
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
    setActiveTab("keywords");
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
      significado: keywordDraft.significado.trim() || null
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

  const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
    { id: "general", label: "General", icon: <Settings2 size={13} /> },
    { id: "identidad", label: "Identidad", icon: <Sparkles size={13} /> },
    { id: "resumenes", label: "Resúmenes", icon: <Clock3 size={13} /> },
    { id: "faqs", label: "FAQs", icon: <HelpCircle size={13} /> },
    { id: "keywords", label: "Keywords", icon: <Target size={13} /> },
    { id: "chat", label: "Chat", icon: <MessageSquareText size={13} /> }
  ];

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">NIA</h1>

              <span className="rounded-md bg-purple-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-purple-700 ring-1 ring-purple-100">
                IA equipo interno
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Configuración editable de la asistente comercial interna.
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
          <MiniMetric label="Modelo" value={configDraft?.modelo || "—"} />
          <MiniMetric label="FAQs" value={faqs.length} />
          <MiniMetric label="Keywords" value={keywords.length} />
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
            <EmptyState title="No hay configuración de NIA" subtitle="Revisá el seed inicial de nia_config." />
          </div>
        ) : null}

        {!loading && configDraft ? (
          <div className="mt-3">
            {activeTab === "general" ? (
              <div className="grid gap-3.5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <Card
                  title="Estado operativo"
                  subtitle="NIA es la asistente interna del equipo. No habla con pasajeros."
                  icon={<Bot size={15} />}
                >
                  <div className="flex items-center justify-between gap-3 rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
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
                      aria-label="Activar o apagar NIA"
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
                      <FieldLabel>Modelo</FieldLabel>
                      <div className="grid grid-cols-2 gap-1.5">
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
                  </div>
                </Card>

                <Card title="Qué debe hacer NIA" icon={<Brain size={15} />}>
                  <div className="grid gap-2 text-[12px] font-normal leading-relaxed text-[#475569]">
                    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                      Habla con vendedores, gerentes y administradores.
                    </div>

                    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                      Resume oportunidades, detecta demoras y puede coordinar con Cande.
                    </div>

                    <div className="rounded-[12px] bg-white px-3 py-2.5 ring-1 ring-black/5">
                      Debe pedir confirmación antes de acciones sensibles.
                    </div>
                  </div>
                </Card>

                <div className="xl:col-span-2 flex justify-end">
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
                  subtitle="Definí cómo responde NIA y qué límites tiene."
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
                    <FieldLabel>Prompt base</FieldLabel>
                    <TextArea
                      value={configDraft.prompt_base}
                      onChange={(value) => updateDraft("prompt_base", value)}
                      rows={8}
                    />
                  </div>

                  <div className="mt-2.5">
                    <FieldLabel>Reglas duras</FieldLabel>
                    <TextArea
                      value={configDraft.reglas_duras}
                      onChange={(value) => updateDraft("reglas_duras", value)}
                      rows={6}
                    />
                  </div>
                </Card>

                <Card title="Acciones permitidas" icon={<Target size={15} />}>
                  <div className="grid gap-1.5">
                    {[
                      "Resumir oportunidades abiertas",
                      "Activar Cande en una conversación",
                      "Desactivar Cande en una conversación",
                      "Reasignar oportunidades con confirmación",
                      "Actualizar datos de una oportunidad",
                      "Generar reporte comercial para gerencia"
                    ].map((item) => (
                      <div
                        key={item}
                        className="rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[11.5px] font-medium text-[#475569]"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>

                <div className="xl:col-span-2 flex justify-end">
                  <ActionButton onClick={saveConfig} disabled={saving}>
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Guardar identidad y reglas
                  </ActionButton>
                </div>
              </div>
            ) : null}

            {activeTab === "resumenes" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card title="Programación de resúmenes" icon={<Clock3 size={15} />}>
                  <div>
                    <FieldLabel>Hora resumen diario</FieldLabel>
                    <TextInput
                      value={normalizeTime(configDraft.hora_resumen_diario)}
                      onChange={(value) => updateDraft("hora_resumen_diario", value)}
                      placeholder="09:00"
                    />
                  </div>

                  <div className="mt-2.5">
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

                <Card
                  title="Plantillas"
                  subtitle="Textos base que NIA usa para resúmenes internos."
                  icon={<MessageSquareText size={15} />}
                >
                  <div>
                    <FieldLabel>Resumen para vendedor</FieldLabel>
                    <TextArea
                      value={configDraft.plantilla_resumen_vendedor}
                      onChange={(value) => updateDraft("plantilla_resumen_vendedor", value)}
                      rows={5}
                    />
                  </div>

                  <div className="mt-2.5">
                    <FieldLabel>Resumen para gerencia</FieldLabel>
                    <TextArea
                      value={configDraft.plantilla_resumen_gerencia}
                      onChange={(value) => updateDraft("plantilla_resumen_gerencia", value)}
                      rows={5}
                    />
                  </div>

                  <div className="mt-3 flex justify-end">
                    <ActionButton onClick={saveConfig} disabled={saving}>
                      <Save size={13} />
                      Guardar resúmenes
                    </ActionButton>
                  </div>
                </Card>
              </div>
            ) : null}

            {activeTab === "faqs" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card
                  title={editingFaqId ? "Editar FAQ interna" : "Nueva FAQ interna"}
                  subtitle="Conocimiento que NIA puede usar con el equipo."
                  icon={<HelpCircle size={15} />}
                >
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
                        rows={6}
                        placeholder="Priorizá por score, último mensaje del pasajero..."
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

                <Card title="FAQs cargadas" subtitle="Base de conocimiento interna de NIA.">
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

            {activeTab === "keywords" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
                <Card
                  title={editingKeywordId ? "Editar keyword" : "Nueva keyword"}
                  subtitle="Palabras que ayudan a NIA a detectar intención interna."
                  icon={<Target size={15} />}
                >
                  <div className="grid gap-2.5">
                    <div>
                      <FieldLabel>Palabra o frase</FieldLabel>
                      <TextInput
                        value={keywordDraft.palabra}
                        onChange={(value) =>
                          setKeywordDraft((current) => ({ ...current, palabra: value }))
                        }
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
                        placeholder="Ej: el usuario quiere que NIA active Cande en una conversación o tome una acción operativa."
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

                <Card title="Keywords cargadas" subtitle="Señales internas para acciones de NIA.">
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
                              aria-label="Editar"
                            >
                              <Settings2 size={13} />
                            </button>

                            <button
                              type="button"
                              onClick={() => deleteKeyword(item.id)}
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

            {activeTab === "chat" ? (
              <div className="grid gap-3.5 xl:grid-cols-[340px_minmax(0,1fr)]">
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

                <Card title="Mensajes recientes" subtitle="Vista de control, todavía sin composer activo.">
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