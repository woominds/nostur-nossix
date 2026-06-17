// src/components/configuracion/ConfiguracionIAsPanel.tsx

import { useEffect, useMemo, useState } from "react";
import {
  Bot,
  Brain,
  Database,
  Edit3,
  Eye,
  Loader2,
  MessageCircle,
  Palette,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  Trash2,
  X
} from "lucide-react";

import { supabase } from "../../lib/supabase";

type AiPersonaRow = {
  id: string;
  code: string;
  name: string | null;
  display_name: string | null;
  role_label: string | null;
  description: string | null;
  tone: string | null;
  avatar_url: string | null;
  color: string | null;
  active: boolean | null;
  is_default: boolean | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

type AiKnowledgeRow = {
  id: string;
  persona_code: string;
  title: string;
  category: string;
  content: string;
  active: boolean;
  priority: number;
  created_at: string | null;
  updated_at: string | null;
};

type AiPersonaDraft = {
  code: string;
  name: string;
  display_name: string;
  role_label: string;
  description: string;
  tone: string;
  avatar_url: string;
  color: string;
  active: boolean;
  default_mode: "APAGADA" | "SUGERIDA" | "AUTOMATICA";
  welcome_message: string;
  fallback_message: string;
  handoff_message: string;
  can_say: string;
  cannot_say: string;
  business_rules: string;
  handoff_rules: string;
  forbidden_phrases: string;
  allowed_auto_cases: string;
  requires_human_validation_for: string;
  style_rules: string;
};

type KnowledgeDraft = {
  id?: string;
  persona_code: string;
  title: string;
  category: string;
  content: string;
  active: boolean;
  priority: number;
};

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

const PERSONA_CODES = [
  {
    code: "customer_assistant",
    title: "IAPAX",
    subtitle: "Asistente de pasajeros / primer filtro",
    color: "#0f766e"
  },
  {
    code: "commercial_assistant",
    title: "NIA",
    subtitle: "Asistente comercial interno",
    color: "#7c3aed"
  }
];

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function readMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function readArrayAsText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value.map((item) => String(item || "").trim()).filter(Boolean).join("\n");
}

function textToArray(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function getDefaultDraft(code: string): AiPersonaDraft {
  if (code === "commercial_assistant") {
    return {
      code: "commercial_assistant",
      name: "NIA",
      display_name: "NIA · Asistente Comercial",
      role_label: "Asistente Comercial NOSTUR",
      description:
        "Asistente interno para alertas comerciales, reportes, seguimiento de oportunidades y soporte operativo del equipo.",
      tone: "Claro, directo, ejecutivo, amable y orientado a la acción.",
      avatar_url: "",
      color: "#7c3aed",
      active: true,
      default_mode: "SUGERIDA",
      welcome_message:
        "Hola. Soy NIA · Asistente Comercial. Desde este chat voy a enviarte alertas, reportes y recordatorios comerciales importantes.",
      fallback_message:
        "No tengo información suficiente para responder con precisión. Te sugiero revisar el caso o pedir más datos.",
      handoff_message:
        "Este caso requiere revisión del equipo comercial o gerencia.",
      can_say:
        "Puede resumir conversaciones, detectar oportunidades, sugerir próximas acciones, alertar demoras, marcar conversaciones en riesgo y ayudar a priorizar gestión comercial.",
      cannot_say:
        "No puede modificar ventas, confirmar pagos, aprobar comisiones, alterar caja ni tomar decisiones administrativas sin validación humana.",
      business_rules:
        "Debe priorizar oportunidades calientes, conversaciones sin respuesta, reclamos, derivaciones pendientes y casos con riesgo comercial.",
      handoff_rules:
        "Debe escalar a gerencia cuando detecte reclamos sensibles, oportunidades importantes sin atender, demoras graves o inconsistencias comerciales.",
      forbidden_phrases: "",
      allowed_auto_cases:
        "resumen interno\nalerta comercial\nsugerencia de próxima acción\nreporte de gestión\nrecordatorio operativo",
      requires_human_validation_for:
        "cambios de estado críticos\nventas\npagos\ncomisiones\nfacturación\ncaja\nreclamos sensibles",
      style_rules:
        "Ser clara y ejecutiva.\nNo extenderse innecesariamente.\nDar acciones concretas."
    };
  }

  return {
    code: "customer_assistant",
    name: "IAPAX",
    display_name: "IAPAX · Asistente de Pasajeros",
    role_label: "IA Vendedora / Primer Filtro",
    description:
      "Asistente para responder consultas iniciales de pasajeros, indagar necesidades, detectar oportunidades y derivar al equipo comercial cuando corresponda.",
    tone:
      "Amable, comercial, claro, empático, profesional, argentino neutro y orientado a obtener datos útiles para que un asesor pueda cotizar.",
    avatar_url: "",
    color: "#0f766e",
    active: true,
    default_mode: "AUTOMATICA",
    welcome_message:
      "¡Hola! Soy IAPAX, asistente de NOSSIX Travel. Para ayudarte mejor, contame destino, fecha aproximada y cuántas personas viajan.",
    fallback_message:
      "Gracias, ya recibimos tu consulta. Para ayudarte mejor, te voy a pedir algunos datos o derivarte con un asesor del equipo.",
    handoff_message:
      "Perfecto, ya tengo información suficiente para que un asesor continúe con la atención. Te vamos a responder a la brevedad.",
    can_say:
      "Puede saludar, confirmar recepción del mensaje, pedir destino, fechas aproximadas, cantidad de pasajeros, adultos, menores, edades de menores, ciudad de salida, cantidad de noches, presupuesto estimado, preferencias de hotel, flexibilidad de fechas y urgencia de compra. Puede explicar que está tomando datos para que un asesor pueda preparar mejor la cotización.",
    cannot_say:
      "No puede confirmar disponibilidad final, no puede garantizar precios, no puede emitir tickets, no puede prometer reservas, no puede tomar pagos, no puede confirmar pagos, no puede inventar promociones, no puede inventar paquetes, no puede inventar opciones de viaje, no puede decir que ya tiene opciones armadas si el sistema no le entregó opciones reales, no puede dar información legal, migratoria o sanitaria como definitiva y no puede inventar políticas de proveedores.",
    business_rules:
      "Debe responder principalmente al último mensaje del pasajero. No debe arrastrar destinos, fechas, pasajeros ni preferencias de mensajes viejos si el último mensaje no los confirma. Si faltan datos básicos, debe preguntar de a poco sin saturar. Debe pedir máximo dos o tres datos por mensaje. Debe priorizar consultas con intención de compra clara. Si detecta urgencia, reclamo, pasajero en destino, problema de documentación, cambios, cancelaciones o pago pendiente, debe derivar a un vendedor. No debe usar frases como opciones que armé, opciones que preparé o te paso las opciones salvo que existan opciones reales cargadas en el contexto del sistema.",
    handoff_rules:
      "Debe derivar cuando el pasajero informa destino, fecha aproximada y cantidad de pasajeros; cuando pide hablar con un asesor; cuando hay reclamo o urgencia; cuando hay intención fuerte de compra; cuando menciona pagar, reservar, señar, tarjeta, transferencia o link de pago; o cuando la conversación supera el límite razonable de indagación.",
    forbidden_phrases:
      "te paso las opciones que armé\nte paso las opciones que preparé\nya tengo opciones para enviarte\ncuando quieras te paso las opciones\ntengo armada la propuesta\ntenemos disponibilidad\nte confirmo disponibilidad\nel precio es",
    allowed_auto_cases:
      "saludo inicial\nfuera de horario\nconfirmacion de recepcion\npedido de datos faltantes\nderivacion a asesor\nmensaje breve de seguimiento",
    requires_human_validation_for:
      "precios\ndisponibilidad\nconfirmaciones de reserva\npagos\ndevoluciones\ncancelaciones\ncambios de fecha\ndocumentacion sensible\npromesas comerciales\ncondiciones legales\ninformacion migratoria\nreclamos",
    style_rules:
      "Mensajes cortos de WhatsApp.\nNo presentarse en cada mensaje si ya venía hablando.\nNo usar textos largos.\nNo usar markdown.\nNo usar emojis excesivos.\nNo inventar datos.\nSi el último mensaje es ambiguo, pedir aclaración simple."
  };
}

function draftFromRow(row: AiPersonaRow | null, code: string): AiPersonaDraft {
  const fallback = getDefaultDraft(code);
  if (!row) return fallback;

  const metadata = readMetadata(row.metadata);

  return {
    code,
    name: cleanText(row.name) || fallback.name,
    display_name: cleanText(row.display_name) || fallback.display_name,
    role_label: cleanText(row.role_label) || fallback.role_label,
    description: cleanText(row.description) || fallback.description,
    tone: cleanText(row.tone) || fallback.tone,
    avatar_url: cleanText(row.avatar_url),
    color: cleanText(row.color) || fallback.color,
    active: Boolean(row.active),
    default_mode:
      cleanText(metadata.default_mode) === "APAGADA" ||
      cleanText(metadata.default_mode) === "SUGERIDA" ||
      cleanText(metadata.default_mode) === "AUTOMATICA"
        ? (cleanText(metadata.default_mode) as AiPersonaDraft["default_mode"])
        : fallback.default_mode,
    welcome_message: cleanText(metadata.welcome_message) || fallback.welcome_message,
    fallback_message: cleanText(metadata.fallback_message) || fallback.fallback_message,
    handoff_message: cleanText(metadata.handoff_message) || fallback.handoff_message,
    can_say: cleanText(metadata.can_say) || fallback.can_say,
    cannot_say: cleanText(metadata.cannot_say) || fallback.cannot_say,
    business_rules: cleanText(metadata.business_rules) || fallback.business_rules,
    handoff_rules: cleanText(metadata.handoff_rules) || fallback.handoff_rules,
    forbidden_phrases: readArrayAsText(metadata.forbidden_phrases) || fallback.forbidden_phrases,
    allowed_auto_cases: readArrayAsText(metadata.allowed_auto_cases) || fallback.allowed_auto_cases,
    requires_human_validation_for:
      readArrayAsText(metadata.requires_human_validation_for) ||
      fallback.requires_human_validation_for,
    style_rules: readArrayAsText(metadata.style_rules) || fallback.style_rules
  };
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  if (!toast) return null;

  return (
    <div className="fixed right-5 top-5 z-[300] w-[340px] rounded-2xl border border-black/10 bg-white p-4 text-sm shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div
            className={[
              "mb-1 font-black",
              toast.type === "success" ? "text-green-700" : "text-red-700"
            ].join(" ")}
          >
            {toast.type === "success" ? "Listo" : "Atención"}
          </div>
          <div className="text-xs font-semibold text-[#334155]">{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[#64748b] hover:bg-[#f1f5f9]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function Field({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-[12px] font-black uppercase tracking-wide text-[#64748b]">
        {label}
      </span>
      {children}
    </label>
  );
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={[
        "h-11 w-full rounded-2xl border border-black/10 bg-white px-4 text-sm font-semibold text-[#111827] outline-none transition focus:border-[#4f7c90] focus:ring-2 focus:ring-[#4f7c90]/15",
        props.className || ""
      ].join(" ")}
    />
  );
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={[
        "min-h-[110px] w-full resize-none rounded-2xl border border-black/10 bg-white px-4 py-3 text-sm font-semibold leading-6 text-[#111827] outline-none transition focus:border-[#4f7c90] focus:ring-2 focus:ring-[#4f7c90]/15",
        props.className || ""
      ].join(" ")}
    />
  );
}

export function ConfiguracionIAsPanel() {
  const [personas, setPersonas] = useState<AiPersonaRow[]>([]);
  const [knowledge, setKnowledge] = useState<AiKnowledgeRow[]>([]);
  const [selectedCode, setSelectedCode] = useState("customer_assistant");
  const [draft, setDraft] = useState<AiPersonaDraft>(getDefaultDraft("customer_assistant"));
  const [knowledgeDraft, setKnowledgeDraft] = useState<KnowledgeDraft>({
    persona_code: "customer_assistant",
    title: "",
    category: "general",
    content: "",
    active: true,
    priority: 0
  });
  const [searchKnowledge, setSearchKnowledge] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingPersona, setSavingPersona] = useState(false);
  const [savingKnowledge, setSavingKnowledge] = useState(false);
  const [activeTab, setActiveTab] = useState<"persona" | "reglas" | "mensajes" | "conocimiento" | "prueba">(
    "persona"
  );
  const [testInput, setTestInput] = useState("Hola, quiero viajar a Madrid");
  const [testOutput, setTestOutput] = useState("");
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const selectedPersona = useMemo(
    () => personas.find((persona) => persona.code === selectedCode) || null,
    [personas, selectedCode]
  );

  const selectedMeta = PERSONA_CODES.find((item) => item.code === selectedCode) || PERSONA_CODES[0];

  const filteredKnowledge = useMemo(() => {
    const query = searchKnowledge.trim().toLowerCase();

    return knowledge
      .filter((item) => item.persona_code === selectedCode)
      .filter((item) => {
        if (!query) return true;
        return (
          item.title.toLowerCase().includes(query) ||
          item.category.toLowerCase().includes(query) ||
          item.content.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => Number(b.priority || 0) - Number(a.priority || 0));
  }, [knowledge, selectedCode, searchKnowledge]);

  useEffect(() => {
    void loadAll();
  }, []);

  useEffect(() => {
    setDraft(draftFromRow(selectedPersona, selectedCode));
    setKnowledgeDraft({
      persona_code: selectedCode,
      title: "",
      category: "general",
      content: "",
      active: true,
      priority: 0
    });
  }, [selectedCode, selectedPersona]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3200);
  }

  async function loadAll() {
    setLoading(true);

    const personasRes = await supabase
      .from("ai_personas")
      .select("*")
      .in("code", ["customer_assistant", "commercial_assistant"])
      .order("code", { ascending: true });

    if (personasRes.error) {
      showToast(personasRes.error.message || "No se pudieron cargar las IAs.", "error");
      setLoading(false);
      return;
    }

    const knowledgeRes = await supabase
      .from("ai_knowledge_base")
      .select("*")
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false });

    if (knowledgeRes.error) {
      showToast(
        knowledgeRes.error.message ||
          "No se pudo cargar la base de conocimiento. Revisá que exista la tabla ai_knowledge_base.",
        "error"
      );
    }

    setPersonas((personasRes.data || []) as AiPersonaRow[]);
    setKnowledge((knowledgeRes.data || []) as AiKnowledgeRow[]);
    setLoading(false);
  }

  function updateDraft<K extends keyof AiPersonaDraft>(key: K, value: AiPersonaDraft[K]) {
    setDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  function updateKnowledgeDraft<K extends keyof KnowledgeDraft>(
    key: K,
    value: KnowledgeDraft[K]
  ) {
    setKnowledgeDraft((current) => ({
      ...current,
      [key]: value
    }));
  }

  async function savePersona() {
    setSavingPersona(true);

    const currentMetadata = readMetadata(selectedPersona?.metadata);

    const payload = {
      name: draft.name.trim() || selectedMeta.title,
      display_name: draft.display_name.trim() || selectedMeta.title,
      role_label: draft.role_label.trim() || null,
      description: draft.description.trim() || null,
      tone: draft.tone.trim() || null,
      avatar_url: draft.avatar_url.trim() || null,
      color: draft.color.trim() || selectedMeta.color,
      active: draft.active,
      is_default: selectedCode === "commercial_assistant",
      metadata: {
        ...currentMetadata,
        system_ai: selectedCode === "commercial_assistant",
        customer_ai: selectedCode === "customer_assistant",
        default_channel: selectedCode === "customer_assistant" ? "whatsapp" : "interno",
        default_mode: draft.default_mode,
        welcome_message: draft.welcome_message.trim(),
        fallback_message: draft.fallback_message.trim(),
        handoff_message: draft.handoff_message.trim(),
        can_say: draft.can_say.trim(),
        cannot_say: draft.cannot_say.trim(),
        business_rules: draft.business_rules.trim(),
        handoff_rules: draft.handoff_rules.trim(),
        forbidden_phrases: textToArray(draft.forbidden_phrases),
        allowed_auto_cases: textToArray(draft.allowed_auto_cases),
        requires_human_validation_for: textToArray(draft.requires_human_validation_for),
        style_rules: textToArray(draft.style_rules),
        can_send_directly: selectedCode === "customer_assistant"
      },
      updated_at: new Date().toISOString()
    };

    if (selectedPersona?.id) {
      const { data, error } = await supabase
        .from("ai_personas")
        .update(payload)
        .eq("id", selectedPersona.id)
        .select("*")
        .single();

      if (error) {
        showToast(error.message || "No se pudo guardar la IA.", "error");
        setSavingPersona(false);
        return;
      }

      setPersonas((current) =>
        current.map((persona) => (persona.id === selectedPersona.id ? (data as AiPersonaRow) : persona))
      );
      showToast("Configuración guardada correctamente.");
      setSavingPersona(false);
      return;
    }

    const { data, error } = await supabase
      .from("ai_personas")
      .insert({
        code: selectedCode,
        ...payload
      })
      .select("*")
      .single();

    if (error) {
      showToast(error.message || "No se pudo crear la IA.", "error");
      setSavingPersona(false);
      return;
    }

    setPersonas((current) => [...current, data as AiPersonaRow]);
    showToast("Configuración creada correctamente.");
    setSavingPersona(false);
  }

  async function saveKnowledge() {
    if (!knowledgeDraft.title.trim() || !knowledgeDraft.content.trim()) {
      showToast("Completá título y contenido del conocimiento.", "error");
      return;
    }

    setSavingKnowledge(true);

    const payload = {
      persona_code: selectedCode,
      title: knowledgeDraft.title.trim(),
      category: knowledgeDraft.category.trim() || "general",
      content: knowledgeDraft.content.trim(),
      active: knowledgeDraft.active,
      priority: Number(knowledgeDraft.priority || 0),
      updated_at: new Date().toISOString()
    };

    if (knowledgeDraft.id) {
      const { data, error } = await supabase
        .from("ai_knowledge_base")
        .update(payload)
        .eq("id", knowledgeDraft.id)
        .select("*")
        .single();

      if (error) {
        showToast(error.message || "No se pudo actualizar el conocimiento.", "error");
        setSavingKnowledge(false);
        return;
      }

      setKnowledge((current) =>
        current.map((item) => (item.id === knowledgeDraft.id ? (data as AiKnowledgeRow) : item))
      );
      showToast("Conocimiento actualizado.");
    } else {
      const { data, error } = await supabase
        .from("ai_knowledge_base")
        .insert(payload)
        .select("*")
        .single();

      if (error) {
        showToast(error.message || "No se pudo crear el conocimiento.", "error");
        setSavingKnowledge(false);
        return;
      }

      setKnowledge((current) => [data as AiKnowledgeRow, ...current]);
      showToast("Conocimiento agregado.");
    }

    setKnowledgeDraft({
      persona_code: selectedCode,
      title: "",
      category: "general",
      content: "",
      active: true,
      priority: 0
    });

    setSavingKnowledge(false);
  }

  async function toggleKnowledge(item: AiKnowledgeRow) {
    const { data, error } = await supabase
      .from("ai_knowledge_base")
      .update({
        active: !item.active,
        updated_at: new Date().toISOString()
      })
      .eq("id", item.id)
      .select("*")
      .single();

    if (error) {
      showToast(error.message || "No se pudo cambiar el estado.", "error");
      return;
    }

    setKnowledge((current) =>
      current.map((row) => (row.id === item.id ? (data as AiKnowledgeRow) : row))
    );
  }

  async function deleteKnowledge(item: AiKnowledgeRow) {
    const { error } = await supabase.from("ai_knowledge_base").delete().eq("id", item.id);

    if (error) {
      showToast(error.message || "No se pudo eliminar.", "error");
      return;
    }

    setKnowledge((current) => current.filter((row) => row.id !== item.id));
    showToast("Conocimiento eliminado.");
  }

  function editKnowledge(item: AiKnowledgeRow) {
    setKnowledgeDraft({
      id: item.id,
      persona_code: item.persona_code,
      title: item.title,
      category: item.category,
      content: item.content,
      active: item.active,
      priority: Number(item.priority || 0)
    });
    setActiveTab("conocimiento");
  }

  async function runTest() {
    setTesting(true);
    setTestOutput("");

    window.setTimeout(() => {
      setTesting(false);
      setTestOutput(
        [
          "Prueba local del configurador:",
          "",
          `Asistente: ${draft.display_name}`,
          `Modo: ${draft.default_mode}`,
          "",
          "Mensaje simulado:",
          testInput,
          "",
          "Para una prueba real completa, luego conectamos este botón a una Edge Function de simulación que use la misma lógica de customer-assistant-reply sin enviar WhatsApp."
        ].join("\n")
      );
    }, 650);
  }

  return (
    <div className="h-full overflow-hidden bg-[radial-gradient(circle_at_16%_12%,rgba(124,58,237,0.12),transparent_28%),radial-gradient(circle_at_82%_18%,rgba(15,118,110,0.12),transparent_30%),linear-gradient(135deg,#eef3f5,#dfe8ec_48%,#eef3f5)] text-[#1f2937]">
      <div className="flex h-full min-h-0 flex-col">
        <header className="shrink-0 border-b border-black/10 bg-white/75 px-5 py-4 backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-600 text-white shadow-sm">
                  <Brain size={20} />
                </div>

                <div>
                  <h1 className="text-xl font-black tracking-tight text-[#111827]">
                    Configuración de IAs
                  </h1>
                  <p className="text-xs font-semibold text-[#64748b]">
                    Enseñá, ajustá y controlá los asistentes de NOSTUR sin tocar código.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void loadAll()}
                disabled={loading}
                className="flex h-10 items-center gap-2 rounded-2xl bg-white px-4 text-xs font-black text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] disabled:opacity-60"
              >
                {loading ? <Loader2 size={15} className="animate-spin" /> : <RefreshCcw size={15} />}
                Actualizar
              </button>

              <button
                type="button"
                onClick={savePersona}
                disabled={savingPersona || loading}
                className="flex h-10 items-center gap-2 rounded-2xl bg-violet-600 px-4 text-xs font-black text-white shadow-sm hover:bg-violet-700 disabled:opacity-60"
              >
                {savingPersona ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                Guardar asistente
              </button>
            </div>
          </div>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-[320px_minmax(0,1fr)] overflow-hidden">
          <aside className="min-h-0 overflow-auto border-r border-black/10 bg-white/75 p-4 backdrop-blur">
            <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-[#64748b]">
              Asistentes
            </div>

            <div className="grid gap-3">
              {PERSONA_CODES.map((item) => {
                const row = personas.find((persona) => persona.code === item.code);
                const selected = selectedCode === item.code;
                const active = Boolean(row?.active);

                return (
                  <button
                    key={item.code}
                    type="button"
                    onClick={() => setSelectedCode(item.code)}
                    className={[
                      "rounded-[22px] border p-4 text-left transition",
                      selected
                        ? "border-violet-300 bg-violet-50 shadow-sm"
                        : "border-black/10 bg-white hover:bg-[#f8fafc]"
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white"
                        style={{ backgroundColor: cleanText(row?.color) || item.color }}
                      >
                        <Bot size={22} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-black text-[#111827]">
                          {cleanText(row?.display_name) || item.title}
                        </div>
                        <div className="mt-0.5 truncate text-xs font-semibold text-[#64748b]">
                          {cleanText(row?.role_label) || item.subtitle}
                        </div>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between">
                      <span
                        className={[
                          "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                          active
                            ? "bg-green-100 text-green-700"
                            : "bg-slate-100 text-slate-500"
                        ].join(" ")}
                      >
                        {active ? "Activa" : "Apagada"}
                      </span>

                      <span className="text-[10px] font-black uppercase tracking-wide text-[#94a3b8]">
                        {cleanText(readMetadata(row?.metadata).default_mode) || "Sin modo"}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-[22px] border border-black/10 bg-[#f8fafc] p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-black text-[#111827]">
                <ShieldAlert size={16} />
                Barandas
              </div>
              <p className="text-xs font-semibold leading-5 text-[#64748b]">
                Las reglas editables se guardan en Supabase. Las reglas críticas de seguridad
                siguen protegidas en el motor para evitar precios, reservas o pagos inventados.
              </p>
            </div>
          </aside>

          <main className="min-h-0 overflow-auto p-5">
            {loading ? (
              <div className="flex h-full items-center justify-center text-sm font-black text-[#64748b]">
                <Loader2 size={18} className="mr-2 animate-spin" />
                Cargando configuración...
              </div>
            ) : (
              <div className="mx-auto grid max-w-6xl gap-5">
                <section className="rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm backdrop-blur">
                  <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-16 w-16 items-center justify-center rounded-[24px] text-white shadow-sm"
                        style={{ backgroundColor: draft.color || selectedMeta.color }}
                      >
                        {draft.avatar_url ? (
                          <img
                            src={draft.avatar_url}
                            alt={draft.display_name}
                            className="h-full w-full rounded-[24px] object-cover"
                          />
                        ) : (
                          <Bot size={28} />
                        )}
                      </div>

                      <div>
                        <h2 className="text-lg font-black text-[#111827]">
                          {draft.display_name}
                        </h2>
                        <p className="mt-1 text-xs font-semibold text-[#64748b]">
                          {draft.description}
                        </p>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => updateDraft("active", !draft.active)}
                      className={[
                        "flex h-11 items-center gap-2 rounded-2xl px-4 text-xs font-black shadow-sm ring-1",
                        draft.active
                          ? "bg-green-50 text-green-700 ring-green-200"
                          : "bg-white text-[#64748b] ring-black/10"
                      ].join(" ")}
                    >
                      {draft.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      {draft.active ? "Activa" : "Apagada"}
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {[
                      ["persona", "Identidad"],
                      ["reglas", "Reglas"],
                      ["mensajes", "Mensajes"],
                      ["conocimiento", "Conocimiento"],
                      ["prueba", "Prueba"]
                    ].map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveTab(key as typeof activeTab)}
                        className={[
                          "h-10 rounded-2xl px-4 text-xs font-black transition",
                          activeTab === key
                            ? "bg-[#111827] text-white"
                            : "bg-[#f1f5f9] text-[#334155] hover:bg-[#e2e8f0]"
                        ].join(" ")}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </section>

                {activeTab === "persona" ? (
                  <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="grid gap-4 rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Nombre corto">
                          <TextInput
                            value={draft.name}
                            onChange={(event) => updateDraft("name", event.target.value)}
                          />
                        </Field>

                        <Field label="Nombre visible">
                          <TextInput
                            value={draft.display_name}
                            onChange={(event) => updateDraft("display_name", event.target.value)}
                          />
                        </Field>
                      </div>

                      <Field label="Rol visible">
                        <TextInput
                          value={draft.role_label}
                          onChange={(event) => updateDraft("role_label", event.target.value)}
                        />
                      </Field>

                      <Field label="Descripción">
                        <TextArea
                          value={draft.description}
                          onChange={(event) => updateDraft("description", event.target.value)}
                        />
                      </Field>

                      <Field label="Tono">
                        <TextArea
                          value={draft.tone}
                          onChange={(event) => updateDraft("tone", event.target.value)}
                        />
                      </Field>
                    </div>

                    <aside className="grid content-start gap-4">
                      <div className="rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                        <div className="mb-3 flex items-center gap-2 text-sm font-black text-[#111827]">
                          <Palette size={16} />
                          Apariencia
                        </div>

                        <div className="grid gap-4">
                          <Field label="Avatar URL">
                            <TextInput
                              value={draft.avatar_url}
                              onChange={(event) => updateDraft("avatar_url", event.target.value)}
                              placeholder="https://..."
                            />
                          </Field>

                          <Field label="Color">
                            <div className="flex gap-3">
                              <input
                                type="color"
                                value={draft.color || selectedMeta.color}
                                onChange={(event) => updateDraft("color", event.target.value)}
                                className="h-11 w-16 rounded-2xl border border-black/10 bg-white p-1"
                              />
                              <TextInput
                                value={draft.color}
                                onChange={(event) => updateDraft("color", event.target.value)}
                              />
                            </div>
                          </Field>
                        </div>
                      </div>

                      <div className="rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                        <div className="mb-3 text-sm font-black text-[#111827]">Modo default</div>

                        <div className="grid gap-2">
                          {(["APAGADA", "SUGERIDA", "AUTOMATICA"] as const).map((mode) => (
                            <button
                              key={mode}
                              type="button"
                              onClick={() => updateDraft("default_mode", mode)}
                              className={[
                                "h-10 rounded-2xl text-xs font-black ring-1 ring-black/10",
                                draft.default_mode === mode
                                  ? "bg-violet-600 text-white"
                                  : "bg-white text-[#334155] hover:bg-violet-50"
                              ].join(" ")}
                            >
                              {mode === "APAGADA"
                                ? "Apagada"
                                : mode === "SUGERIDA"
                                  ? "Sugerida"
                                  : "Automática"}
                            </button>
                          ))}
                        </div>
                      </div>
                    </aside>
                  </section>
                ) : null}

                {activeTab === "reglas" ? (
                  <section className="grid gap-4 rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                    <Field label="Qué puede decir">
                      <TextArea
                        value={draft.can_say}
                        onChange={(event) => updateDraft("can_say", event.target.value)}
                      />
                    </Field>

                    <Field label="Qué NO puede decir">
                      <TextArea
                        value={draft.cannot_say}
                        onChange={(event) => updateDraft("cannot_say", event.target.value)}
                      />
                    </Field>

                    <Field label="Reglas de negocio">
                      <TextArea
                        value={draft.business_rules}
                        onChange={(event) => updateDraft("business_rules", event.target.value)}
                      />
                    </Field>

                    <Field label="Reglas de derivación">
                      <TextArea
                        value={draft.handoff_rules}
                        onChange={(event) => updateDraft("handoff_rules", event.target.value)}
                      />
                    </Field>

                    <div className="grid gap-4 lg:grid-cols-3">
                      <Field label="Frases prohibidas">
                        <TextArea
                          value={draft.forbidden_phrases}
                          onChange={(event) => updateDraft("forbidden_phrases", event.target.value)}
                        />
                      </Field>

                      <Field label="Casos permitidos en automático">
                        <TextArea
                          value={draft.allowed_auto_cases}
                          onChange={(event) => updateDraft("allowed_auto_cases", event.target.value)}
                        />
                      </Field>

                      <Field label="Requiere validación humana">
                        <TextArea
                          value={draft.requires_human_validation_for}
                          onChange={(event) =>
                            updateDraft("requires_human_validation_for", event.target.value)
                          }
                        />
                      </Field>
                    </div>

                    <Field label="Reglas de estilo">
                      <TextArea
                        value={draft.style_rules}
                        onChange={(event) => updateDraft("style_rules", event.target.value)}
                      />
                    </Field>
                  </section>
                ) : null}

                {activeTab === "mensajes" ? (
                  <section className="grid gap-4 rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                    <Field label="Mensaje de bienvenida">
                      <TextArea
                        value={draft.welcome_message}
                        onChange={(event) => updateDraft("welcome_message", event.target.value)}
                      />
                    </Field>

                    <Field label="Fallback">
                      <TextArea
                        value={draft.fallback_message}
                        onChange={(event) => updateDraft("fallback_message", event.target.value)}
                      />
                    </Field>

                    <Field label="Mensaje de derivación">
                      <TextArea
                        value={draft.handoff_message}
                        onChange={(event) => updateDraft("handoff_message", event.target.value)}
                      />
                    </Field>
                  </section>
                ) : null}

                {activeTab === "conocimiento" ? (
                  <section className="grid gap-5 lg:grid-cols-[420px_minmax(0,1fr)]">
                    <div className="grid content-start gap-4 rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                      <div className="flex items-center gap-2 text-sm font-black text-[#111827]">
                        <Database size={16} />
                        Agregar conocimiento
                      </div>

                      <Field label="Título">
                        <TextInput
                          value={knowledgeDraft.title}
                          onChange={(event) => updateKnowledgeDraft("title", event.target.value)}
                          placeholder="Horarios de atención"
                        />
                      </Field>

                      <div className="grid gap-4 md:grid-cols-2">
                        <Field label="Categoría">
                          <TextInput
                            value={knowledgeDraft.category}
                            onChange={(event) =>
                              updateKnowledgeDraft("category", event.target.value)
                            }
                            placeholder="horarios"
                          />
                        </Field>

                        <Field label="Prioridad">
                          <TextInput
                            type="number"
                            value={knowledgeDraft.priority}
                            onChange={(event) =>
                              updateKnowledgeDraft("priority", Number(event.target.value || 0))
                            }
                          />
                        </Field>
                      </div>

                      <Field label="Contenido">
                        <TextArea
                          value={knowledgeDraft.content}
                          onChange={(event) => updateKnowledgeDraft("content", event.target.value)}
                          className="min-h-[220px]"
                          placeholder="Escribí acá lo que querés que la IA sepa..."
                        />
                      </Field>

                      <button
                        type="button"
                        onClick={() => updateKnowledgeDraft("active", !knowledgeDraft.active)}
                        className={[
                          "flex h-11 items-center justify-between rounded-2xl px-4 text-xs font-black ring-1",
                          knowledgeDraft.active
                            ? "bg-green-50 text-green-700 ring-green-200"
                            : "bg-white text-[#64748b] ring-black/10"
                        ].join(" ")}
                      >
                        Activo
                        {knowledgeDraft.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                      </button>

                      <button
                        type="button"
                        onClick={saveKnowledge}
                        disabled={savingKnowledge}
                        className="flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#111827] px-4 text-xs font-black text-white disabled:opacity-60"
                      >
                        {savingKnowledge ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                        {knowledgeDraft.id ? "Actualizar conocimiento" : "Agregar conocimiento"}
                      </button>
                    </div>

                    <div className="min-h-0 rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black text-[#111827]">Base de conocimiento</div>
                          <div className="text-xs font-semibold text-[#64748b]">
                            {filteredKnowledge.length} registros para {draft.name}
                          </div>
                        </div>

                        <div className="relative w-64">
                          <Search size={15} className="absolute left-3 top-3 text-[#94a3b8]" />
                          <input
                            value={searchKnowledge}
                            onChange={(event) => setSearchKnowledge(event.target.value)}
                            className="h-10 w-full rounded-2xl border border-black/10 bg-white pl-9 pr-3 text-xs font-semibold outline-none focus:border-violet-300"
                            placeholder="Buscar..."
                          />
                        </div>
                      </div>

                      <div className="grid max-h-[560px] gap-3 overflow-auto pr-1">
                        {filteredKnowledge.length === 0 ? (
                          <div className="rounded-2xl border border-dashed border-black/10 bg-[#f8fafc] p-6 text-center text-xs font-semibold text-[#64748b]">
                            No hay conocimiento cargado para este asistente.
                          </div>
                        ) : (
                          filteredKnowledge.map((item) => (
                            <div
                              key={item.id}
                              className="rounded-2xl border border-black/10 bg-[#f8fafc] p-4"
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <div className="truncate text-sm font-black text-[#111827]">
                                      {item.title}
                                    </div>
                                    <span className="rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase tracking-wide text-[#64748b] ring-1 ring-black/10">
                                      {item.category}
                                    </span>
                                    <span
                                      className={[
                                        "rounded-full px-2 py-1 text-[10px] font-black uppercase tracking-wide",
                                        item.active
                                          ? "bg-green-100 text-green-700"
                                          : "bg-slate-200 text-slate-500"
                                      ].join(" ")}
                                    >
                                      {item.active ? "Activo" : "Apagado"}
                                    </span>
                                  </div>

                                  <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[#64748b]">
                                    {item.content}
                                  </p>
                                </div>

                                <div className="flex shrink-0 gap-1">
                                  <button
                                    type="button"
                                    onClick={() => editKnowledge(item)}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#64748b] hover:text-[#111827]"
                                    title="Editar"
                                  >
                                    <Edit3 size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void toggleKnowledge(item)}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#64748b] hover:text-[#111827]"
                                    title="Activar / apagar"
                                  >
                                    <Eye size={14} />
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => void deleteKnowledge(item)}
                                    className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-red-500 hover:bg-red-50"
                                    title="Eliminar"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </section>
                ) : null}

                {activeTab === "prueba" ? (
                  <section className="grid gap-5 lg:grid-cols-2">
                    <div className="rounded-[28px] border border-black/10 bg-white/85 p-5 shadow-sm">
                      <div className="mb-4 flex items-center gap-2 text-sm font-black text-[#111827]">
                        <MessageCircle size={16} />
                        Simulador
                      </div>

                      <Field label="Mensaje de prueba">
                        <TextArea
                          value={testInput}
                          onChange={(event) => setTestInput(event.target.value)}
                          className="min-h-[220px]"
                        />
                      </Field>

                      <button
                        type="button"
                        onClick={runTest}
                        disabled={testing}
                        className="mt-4 flex h-11 items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 text-xs font-black text-white hover:bg-violet-700 disabled:opacity-60"
                      >
                        {testing ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                        Probar configuración
                      </button>
                    </div>

                    <div className="rounded-[28px] border border-black/10 bg-[#111827] p-5 text-white shadow-sm">
                      <div className="mb-4 flex items-center gap-2 text-sm font-black">
                        <Sparkles size={16} />
                        Resultado
                      </div>

                      {testOutput ? (
                        <pre className="whitespace-pre-wrap rounded-2xl bg-white/10 p-4 text-xs leading-6 text-white/90">
                          {testOutput}
                        </pre>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-xs font-semibold text-white/60">
                          Todavía no hay resultado de prueba.
                        </div>
                      )}

                      <div className="mt-4 rounded-2xl border border-yellow-300/20 bg-yellow-300/10 p-4 text-xs leading-5 text-yellow-50">
                        Este simulador por ahora valida la configuración local. Después conectamos una
                        Edge Function de prueba para simular respuesta real sin enviar WhatsApp.
                      </div>
                    </div>
                  </section>
                ) : null}
              </div>
            )}
          </main>
        </div>
      </div>

      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}