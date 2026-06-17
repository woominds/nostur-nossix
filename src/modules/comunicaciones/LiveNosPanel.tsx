// src/components/comunicaciones/LiveNosPanel.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { OportunidadDetalleModal } from "./OportunidadDetalleModal";
import {
  Archive,
  Bot,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  Image,
  Loader2,
  MessageCircle,
  Mic,
  MoreVertical,
  Paperclip,
  RefreshCcw,
  Reply,
  Send,
  Smile,
  Sparkles,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  Wand2,
  X,
  XCircle
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { EmptyState, Pill } from "./comunicacionesShared";

import { EMOJI_GROUPS, QUICK_EMOJIS } from "./liveNos/constants";
import {
  ComposerIconButton,
  ConversationsColumn,
  HeaderButton,
  LiveNosSidebar,
  MessageStatusIcon,
  RightPanelTabs,
  StatusPill,
  getNotaVisual
} from "./liveNos/ui";
import type {
  ContactoWa,
  Conversacion,
  ConversacionColaborador,
  ConversationVM,
  InboxKey,
  LeadOportunidad,
  Mensaje,
  MensajeReaccion,
  NotaConversacion,
  PendingAttachment,
  PipelineEstado,
  PreviewMedia,
  ProfileLite,
  RespuestaRapida,
  RightTab,
  TimelineItem,
  WhatsappTemplate
} from "./liveNos/types";
import {
  canSendAsWhatsappAudio,
  filterByInbox,
  formatDateTime,
  formatFileSize,
  getAudioExtension,
  getCleanAudioMimeForMeta,
  getDisplayName,
  getInitials,
  getMessageMediaMime,
  getMessageMediaName,
  getMessageMediaSize,
  getMessageMediaUrl,
  getMessageRole,
  getMessageSenderName,
  getRecorderMimeType,
  getVendedorName,
  getWindowRemainingLabel,
  isAudioMessage,
  isImageMessage,
  normalizePhoneForLiveNos,
  normalizePhoneWithPlus
} from "./liveNos/helpers";

type CandeFeedbackTipo = "positivo" | "negativo" | "correccion";

type CandeFeedbackDraft = {
  message: Mensaje;
  tipo: CandeFeedbackTipo;
};

function getDatoFromKeys(
  datos: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback = "—"
): string {
  if (!datos) return fallback;

  for (const key of keys) {
    const value = datos[key];

    if (value === null || value === undefined) continue;

    if (typeof value === "string") {
      const text = value.trim();
      if (text) return text;
    }

    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "boolean") {
      return value ? "Sí" : "No";
    }
  }

  return fallback;
}

function getScoreLabel(score: number): string {
  if (score >= 75) return "Caliente";
  if (score >= 45) return "Tibia";
  return "Fría";
}

function getScoreTextColor(score: number): string {
  if (score >= 75) return "text-red-700";
  if (score >= 45) return "text-amber-700";
  return "text-slate-600";
}

function getProfileFullName(profile?: ProfileLite | null): string {
  if (!profile) return "Sin asignar";
  return `${profile.nombre || ""} ${profile.apellido || ""}`.trim() || profile.email || "Usuario";
}

function LiveNosProfileSelect({
  value,
  placeholder,
  profiles,
  disabledIds = [],
  onChange
}: {
  value: string;
  placeholder: string;
  profiles: ProfileLite[];
  disabledIds?: string[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const selectedProfile = profiles.find((profile) => profile.id === value) || null;
  const availableProfiles = profiles.filter((profile) => !disabledIds.includes(profile.id));

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className={[
          "flex h-9 w-full items-center justify-between gap-3 rounded-xl border px-3 text-left text-[13px] font-normal shadow-sm transition",
          open
            ? "border-[#4f7c90] bg-white text-[#142033] ring-2 ring-[#4f7c90]/10"
            : "border-black/10 bg-[#f8fafc] text-[#142033] hover:border-[#4f7c90]/40"
        ].join(" ")}
      >
        <span className={selectedProfile ? "truncate" : "truncate text-[#8a97aa]"}>
          {selectedProfile ? getProfileFullName(selectedProfile) : placeholder}
        </span>

        <span className={["text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}>
          ⌄
        </span>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-[42px] z-50 max-h-[240px] overflow-auto rounded-2xl border border-black/10 bg-white p-2 shadow-2xl">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className={[
              "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-[13px] font-normal transition",
              !value
                ? "bg-[#eef6f7] text-[#4f7c90]"
                : "text-[#64748b] hover:bg-[#f8fafc] hover:text-[#142033]"
            ].join(" ")}
          >
            {placeholder}
          </button>

          {availableProfiles.length === 0 ? (
            <div className="rounded-xl px-3 py-3 text-xs font-normal text-[#94a3b8]">
              No hay vendedores disponibles.
            </div>
          ) : (
            availableProfiles.map((profile) => (
              <button
                key={profile.id}
                type="button"
                onClick={() => {
                  onChange(profile.id);
                  setOpen(false);
                }}
                className={[
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition",
                  value === profile.id
                    ? "bg-[#eef6f7] text-[#4f7c90]"
                    : "text-[#142033] hover:bg-[#f8fafc]"
                ].join(" ")}
              >
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: profile.color || "#4f7c90" }}
                />

                <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                  {getProfileFullName(profile)}
                </span>

                {value === profile.id ? (
                  <span className="text-xs font-medium text-[#4f7c90]">✓</span>
                ) : null}
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

export function LiveNosPanel() {
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const [activeInbox, setActiveInbox] = useState<InboxKey>("en_gestion");

  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [conversaciones, setConversaciones] = useState<ConversationVM[]>([]);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [notas, setNotas] = useState<NotaConversacion[]>([]);
  const [reacciones, setReacciones] = useState<MensajeReaccion[]>([]);
  const [profiles, setProfiles] = useState<ProfileLite[]>([]);
  const [pipeline, setPipeline] = useState<PipelineEstado[]>([]);

  const [transferTargetId, setTransferTargetId] = useState("");
  const [collaborationTargetId, setCollaborationTargetId] = useState("");

  const [whatsappTemplates, setWhatsappTemplates] = useState<WhatsappTemplate[]>([]);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [templateVariables, setTemplateVariables] = useState<Record<string, string>>({});
  const [templateSending, setTemplateSending] = useState(false);
  const [templateSyncing, setTemplateSyncing] = useState(false);

  const [newConversationOpen, setNewConversationOpen] = useState(false);
  const [newConversationPhone, setNewConversationPhone] = useState("");
  const [newConversationName, setNewConversationName] = useState("");
  const [newConversationTemplateId, setNewConversationTemplateId] = useState<string | null>(null);
  const [newConversationVariables, setNewConversationVariables] = useState<Record<string, string>>(
    {}
  );
  const [newConversationSending, setNewConversationSending] = useState(false);

  const [quickReplies, setQuickReplies] = useState<RespuestaRapida[]>([]);
  const [composerText, setComposerText] = useState("");
  const [internalText, setInternalText] = useState("");
  const [editingContactName, setEditingContactName] = useState(false);
  const [contactNameDraft, setContactNameDraft] = useState("");
  const [scheduledText, setScheduledText] = useState("");
  const [reminderText, setReminderText] = useState("");
  const [scheduledFor, setScheduledFor] = useState("");
  const [reminderFor, setReminderFor] = useState("");

  const [replyToMessage, setReplyToMessage] = useState<Mensaje | null>(null);
  const [showEmojiPanel, setShowEmojiPanel] = useState(false);
  const [showQuickRepliesPanel, setShowQuickRepliesPanel] = useState(false);
  const [quickReplySearch, setQuickReplySearch] = useState("");
  const [quickReplyTitle, setQuickReplyTitle] = useState("");
  const [quickReplyContent, setQuickReplyContent] = useState("");
  const [quickReplyCategory, setQuickReplyCategory] = useState("");
  const [showAgentName, setShowAgentName] = useState(true);
  const [pendingAttachment, setPendingAttachment] = useState<PendingAttachment | null>(null);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [audioRecording, setAudioRecording] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<PreviewMedia | null>(null);
  const [rightTab, setRightTab] = useState<RightTab>("info");
  const [openMessageMenuId, setOpenMessageMenuId] = useState<string | null>(null);

  const [candeFeedbackDraft, setCandeFeedbackDraft] = useState<CandeFeedbackDraft | null>(null);
  const [candeFeedbackMotivo, setCandeFeedbackMotivo] = useState("");
  const [candeFeedbackCorreccion, setCandeFeedbackCorreccion] = useState("");
  const [candeFeedbackSaving, setCandeFeedbackSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const timelineRef = useRef<HTMLDivElement | null>(null);
  const shouldStickToBottomRef = useRef(true);
 const selectedIdRef = useRef<string | null>(null);
const pendingScrollMessageIdRef = useRef<string | null>(null);
const reloadTimerRef = useRef<number | null>(null);
const audioRecorderRef = useRef<MediaRecorder | null>(null);

  const selectedConversation = useMemo(() => {
    return conversaciones.find((item) => item.id === selectedId) || null;
  }, [conversaciones, selectedId]);

  const selectedOportunidad = selectedConversation?.oportunidad || null;
  const selectedContacto = selectedConversation?.contacto || null;
  const selectedVendedor = selectedConversation?.vendedor || null;
  const selectedColaboradores = selectedConversation?.colaboradores || [];
  const [opportunityModalOpen, setOpportunityModalOpen] = useState(false);

  const timeline = useMemo<TimelineItem[]>(() => {
    const messageItems: TimelineItem[] = mensajes.map((message) => ({
      id: `message:${message.id}`,
      kind: "message",
      at: message.wa_timestamp || message.created_at,
      message
    }));

    const internalItems: TimelineItem[] = notas
      .filter((nota) => nota.tipo === "mensaje_interno" || nota.tipo === "nota")
      .map((nota) => ({
        id: `internal:${nota.id}`,
        kind: "internal",
        at: nota.created_at,
        nota
      }));

    return [...messageItems, ...internalItems].sort((a, b) => {
      const aTime = new Date(a.at).getTime();
      const bTime = new Date(b.at).getTime();

      return aTime - bTime;
    });
  }, [mensajes, notas]);

  const filteredConversations = useMemo(() => {
    const clean = search.trim().toLowerCase();

    return conversaciones
      .filter((conv) => filterByInbox(conv, activeInbox))
      .filter((conv) => {
        if (!clean) return true;

        const haystack = [
          conv.wa_phone,
          conv.last_message_preview,
          conv.titulo,
          conv.subject,
          conv.contacto?.display_name,
          conv.contacto?.profile_name,
          conv.vendedor?.nombre,
          conv.vendedor?.apellido,
          conv.oportunidad?.datos?.destino,
          conv.oportunidad?.datos?.origen,
          conv.oportunidad?.datos?.origen_sugerido,
          conv.oportunidad?.datos?.fechas_tentativas,
          conv.oportunidad?.datos?.cantidad_pasajeros,
          conv.oportunidad?.datos?.presupuesto_aproximado
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        return haystack.includes(clean);
      })
      .sort((a, b) => {
        const aDate = new Date(a.last_message_at || a.updated_at || a.created_at).getTime();
        const bDate = new Date(b.last_message_at || b.updated_at || b.created_at).getTime();
        return bDate - aDate;
      });
  }, [activeInbox, conversaciones, search]);

  const inboxCounts = useMemo(() => {
    return [
      "sin_atender",
      "en_gestion",
      "cande",
      "colaboracion",
      "cerradas",
      "archivadas",
      "eliminadas"
    ].reduce<Record<InboxKey, number>>((acc, inbox) => {
      acc[inbox as InboxKey] = conversaciones.filter((conv) =>
        filterByInbox(conv, inbox as InboxKey)
      ).length;
      return acc;
    }, {} as Record<InboxKey, number>);
  }, [conversaciones]);

  const reaccionesByMensaje = useMemo(() => {
    return reacciones.reduce<Record<string, MensajeReaccion[]>>((acc, reaccion) => {
      if (!acc[reaccion.mensaje_id]) acc[reaccion.mensaje_id] = [];
      acc[reaccion.mensaje_id].push(reaccion);
      return acc;
    }, {});
  }, [reacciones]);

  const activeWhatsappTemplates = useMemo(() => {
    return whatsappTemplates
      .filter((template) => template.active && template.meta_status === "approved")
      .sort((a, b) => {
        const aName = a.display_name || a.name;
        const bName = b.display_name || b.name;
        return aName.localeCompare(bName);
      });
  }, [whatsappTemplates]);

  const selectedWhatsappTemplate = useMemo(() => {
    if (!selectedTemplateId) return null;
    return activeWhatsappTemplates.find((template) => template.id === selectedTemplateId) || null;
  }, [activeWhatsappTemplates, selectedTemplateId]);

  const templatePreview = useMemo(() => {
    if (!selectedWhatsappTemplate) return "";

    let text = selectedWhatsappTemplate.body || "";

    selectedWhatsappTemplate.variables.forEach((variable, index) => {
      const key = String(index + 1);
      const value = templateVariables[key] || templateVariables[variable] || `{{${index + 1}}}`;

      text = text.replaceAll(`{{${index + 1}}}`, value);
    });

    return text;
  }, [selectedWhatsappTemplate, templateVariables]);

  const newConversationTemplate = useMemo(() => {
    if (!newConversationTemplateId) return null;

    return activeWhatsappTemplates.find((template) => template.id === newConversationTemplateId) || null;
  }, [activeWhatsappTemplates, newConversationTemplateId]);

  const newConversationPreview = useMemo(() => {
    if (!newConversationTemplate) return "";

    let text = newConversationTemplate.body || "";

    newConversationTemplate.variables.forEach((variable, index) => {
      const key = String(index + 1);
      const value =
        newConversationVariables[key] ||
        newConversationVariables[variable] ||
        `{{${index + 1}}}`;

      text = text.replaceAll(`{{${index + 1}}}`, value);
    });

    return text;
  }, [newConversationTemplate, newConversationVariables]);

  const filteredQuickReplies = useMemo(() => {
    const clean = quickReplySearch.trim().toLowerCase();

    return quickReplies.filter((reply) => {
      if (!clean) return true;

      return [reply.titulo, reply.contenido, reply.categoria, reply.atajo]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(clean);
    });
  }, [quickReplies, quickReplySearch]);

  

  function scrollTimelineToBottom(behavior: ScrollBehavior = "auto") {
    window.requestAnimationFrame(() => {
      const el = timelineRef.current;
      if (!el) return;

      el.scrollTo({
        top: el.scrollHeight,
        behavior
      });
    });
  }

  function updateStickToBottom() {
    const el = timelineRef.current;
    if (!el) return;

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    shouldStickToBottomRef.current = distanceFromBottom < 120;
  }

  const loadData = useCallback(async () => {
    setError(null);

    const [convRes, contactosRes, profilesRes, oppRes, pipelineRes, colaboradoresRes] =
      await Promise.all([
        supabase
          .from("conversaciones")
          .select("*")
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .limit(200),
        supabase.from("contactos_wa").select("*"),
        supabase
          .from("profiles")
          .select(
            "id,nombre,apellido,email,color,activo,nombre_publico_whatsapp,mostrar_nombre_agente"
          )
          .eq("activo", true)
          .order("nombre", { ascending: true }),
        supabase.from("lead_oportunidades").select("*").order("updated_at", { ascending: false }),
        supabase
          .from("pipeline_estados")
          .select("id,nombre,color,orden,es_final,resultado,es_sin_atender")
          .order("orden", { ascending: true }),
        supabase
          .from("conversacion_colaboradores")
          .select("id,conversacion_id,profile_id,added_by,created_at")
          .order("created_at", { ascending: true })
      ]);

    const firstError =
      convRes.error ||
      contactosRes.error ||
      profilesRes.error ||
      oppRes.error ||
      pipelineRes.error ||
      colaboradoresRes.error;

    if (firstError) {
      setError(firstError.message || "No se pudo cargar LiveNos.");
      return;
    }

    const contactosMap = new Map<string, ContactoWa>();
    ((contactosRes.data || []) as ContactoWa[]).forEach((item) => contactosMap.set(item.id, item));

    const profilesMap = new Map<string, ProfileLite>();
    ((profilesRes.data || []) as ProfileLite[]).forEach((item) => profilesMap.set(item.id, item));

    const oppMap = new Map<string, LeadOportunidad>();
    ((oppRes.data || []) as LeadOportunidad[]).forEach((item) =>
      oppMap.set(item.conversacion_id, item)
    );

    const colaboradoresByConversation = new Map<string, ConversacionColaborador[]>();

    ((colaboradoresRes.data || []) as ConversacionColaborador[]).forEach((item) => {
      const profile = profilesMap.get(item.profile_id) || null;

      const colaborador: ConversacionColaborador = {
        ...item,
        profile
      };

      const current = colaboradoresByConversation.get(item.conversacion_id) || [];
      current.push(colaborador);
      colaboradoresByConversation.set(item.conversacion_id, current);
    });

    const nextConversaciones = ((convRes.data || []) as Conversacion[]).map((conv) => ({
      ...conv,
      contacto: contactosMap.get(conv.contacto_id) || null,
      vendedor: conv.assigned_to ? profilesMap.get(conv.assigned_to) || null : null,
      oportunidad: oppMap.get(conv.id) || null,
      colaboradores: colaboradoresByConversation.get(conv.id) || []
    }));

    setConversaciones(nextConversaciones);
    setProfiles((profilesRes.data || []) as ProfileLite[]);
    setPipeline((pipelineRes.data || []) as PipelineEstado[]);

    const currentSelectedId = selectedIdRef.current;

    if (currentSelectedId) {
      const stillExists = nextConversaciones.some((conv) => conv.id === currentSelectedId);

      if (!stillExists) {
        setSelectedId(null);
        selectedIdRef.current = null;
        setMensajes([]);
        setNotas([]);
        setReacciones([]);
      }
    }
  }, []);

  const loadQuickReplies = useCallback(async () => {
    const { data, error: quickError } = await supabase
      .from("respuestas_rapidas")
      .select("*")
      .eq("activa", true)
      .order("orden", { ascending: true })
      .order("titulo", { ascending: true });

    if (quickError) {
      setError(quickError.message || "No se pudieron cargar las respuestas rápidas.");
      return;
    }

    setQuickReplies((data || []) as RespuestaRapida[]);
  }, []);

  const loadWhatsappTemplates = useCallback(async () => {
    const { data, error: templatesError } = await supabase
      .from("whatsapp_templates")
      .select(
        "id,name,display_name,language,category,body,variables,components,meta_id,meta_status,active,last_synced_at"
      )
      .eq("active", true)
      .order("display_name", { ascending: true });

    if (templatesError) {
      setError(templatesError.message || "No se pudieron cargar las plantillas de WhatsApp.");
      return;
    }

    setWhatsappTemplates((data || []) as WhatsappTemplate[]);
  }, []);

  const loadConversationDetail = useCallback(
    async (
      conversationId: string,
      options: {
        preserveScroll?: boolean;
        forceBottom?: boolean;
      } = {}
    ) => {
      setError(null);

      const shouldAutoScroll =
        options.forceBottom || (!options.preserveScroll && shouldStickToBottomRef.current);

      const [messagesRes, notesRes] = await Promise.all([
        supabase
          .from("mensajes")
          .select("*")
          .eq("conversacion_id", conversationId)
          .is("deleted_at", null)
          .order("wa_timestamp", { ascending: true }),
        supabase
          .from("notas_conversacion")
          .select("*")
          .eq("conversacion_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(100)
      ]);

      const firstError = messagesRes.error || notesRes.error;

      if (firstError) {
        setError(firstError.message || "No se pudo cargar la conversación.");
        return;
      }

      const nextMensajes = (messagesRes.data || []) as Mensaje[];
      const messageIds = nextMensajes.map((message) => message.id);

      let nextReacciones: MensajeReaccion[] = [];

      if (messageIds.length > 0) {
        const reactionsRes = await supabase
          .from("mensaje_reacciones")
          .select("*")
          .in("mensaje_id", messageIds)
          .order("created_at", { ascending: true });

        if (!reactionsRes.error) {
          nextReacciones = (reactionsRes.data || []) as MensajeReaccion[];
        }
      }

      setMensajes(nextMensajes);
      setNotas((notesRes.data || []) as NotaConversacion[]);
      setReacciones(nextReacciones);

      if (shouldAutoScroll || options.forceBottom) {
        scrollTimelineToBottom(options.forceBottom ? "smooth" : "auto");
      }
    },
    []
  );

  useEffect(() => {
    selectedIdRef.current = selectedId;
  }, [selectedId]);

  useEffect(() => {
    async function initialLoad() {
      setLoading(true);

      await Promise.all([
        loadData(),
        loadQuickReplies(),
        loadWhatsappTemplates()
      ]);

      setLoading(false);
    }

    void initialLoad();
  }, [loadData, loadQuickReplies, loadWhatsappTemplates]);

  useEffect(() => {
    if (!selectedId) return;

    shouldStickToBottomRef.current = true;
    void loadConversationDetail(selectedId, { forceBottom: true });
  }, [selectedId, loadConversationDetail]);

  useEffect(() => {
    if (!selectedConversation) return;

    const detail = buildLiveNosNiaContext();

    window.localStorage.setItem("nostur_nia_context", JSON.stringify(detail));

    window.dispatchEvent(
      new CustomEvent("nostur:nia-context-updated", {
        detail
      })
    );
  }, [selectedConversation, selectedContacto, selectedVendedor, selectedOportunidad]);

  useEffect(() => {
    const channelName = `livenos-realtime-${Date.now()}`;

    let refreshListTimer: number | null = null;
    let refreshDetailTimer: number | null = null;

    const refreshListSoft = () => {
      if (refreshListTimer) {
        window.clearTimeout(refreshListTimer);
      }

      refreshListTimer = window.setTimeout(() => {
        void loadData();
      }, 500);
    };

    const refreshCurrentConversationSoft = () => {
      const current = selectedIdRef.current;

      if (!current) return;

      if (refreshDetailTimer) {
        window.clearTimeout(refreshDetailTimer);
      }

      refreshDetailTimer = window.setTimeout(() => {
        void loadConversationDetail(current, { preserveScroll: true });
      }, 500);
    };

    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversaciones"
        },
        () => {
          refreshListSoft();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "lead_oportunidades"
        },
        () => {
          refreshListSoft();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensajes"
        },
        (payload) => {
          const newMessage = payload.new as Mensaje;
          const current = selectedIdRef.current;

          refreshListSoft();

          if (current && newMessage.conversacion_id === current) {
            refreshCurrentConversationSoft();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "mensajes"
        },
        (payload) => {
          const updatedMessage = payload.new as Mensaje;
          const current = selectedIdRef.current;

          refreshListSoft();

          if (current && updatedMessage.conversacion_id === current) {
            refreshCurrentConversationSoft();
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversacion_colaboradores"
        },
        () => {
          refreshListSoft();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notas_conversacion"
        },
        () => {
          refreshCurrentConversationSoft();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "mensaje_reacciones"
        },
        () => {
          refreshCurrentConversationSoft();
        }
      )
      .subscribe((subscriptionStatus) => {
        console.log("[LiveNos realtime]", subscriptionStatus);
      });

    const fallbackInterval = window.setInterval(() => {
      void loadData();

      const current = selectedIdRef.current;

      if (current) {
        void loadConversationDetail(current, { preserveScroll: true });
      }
    }, 30000);

    return () => {
      if (reloadTimerRef.current) {
        window.clearTimeout(reloadTimerRef.current);
      }

      if (refreshListTimer) {
        window.clearTimeout(refreshListTimer);
      }

      if (refreshDetailTimer) {
        window.clearTimeout(refreshDetailTimer);
      }

      window.clearInterval(fallbackInterval);
      supabase.removeChannel(channel);
    };
  }, [loadData, loadConversationDetail]);

  useEffect(() => {
    if (shouldStickToBottomRef.current) {
      scrollTimelineToBottom("auto");
    }
  }, [timeline.length]);

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }

      const recorder = audioRecorderRef.current;

      if (recorder && recorder.state !== "inactive") {
        recorder.stop();
      }
    };
  }, [pendingAttachment]);

  useEffect(() => {
    if (!status) return;

    const timer = window.setTimeout(() => {
      setStatus(null);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [status]);

  useEffect(() => {
  function openConversationFromNotification(event: Event) {
    const customEvent = event as CustomEvent<{
      conversationId?: string | null;
      messageId?: string | null;
      inbox?: InboxKey | null;
    }>;

    const conversationId = customEvent.detail?.conversationId || null;
    const messageId = customEvent.detail?.messageId || null;
    const inbox = customEvent.detail?.inbox || null;

    if (inbox) {
      setActiveInbox(inbox);
    } else {
      setActiveInbox("sin_atender");
    }

    if (messageId) {
      pendingScrollMessageIdRef.current = messageId;
      window.localStorage.setItem("nostur_open_livenos_message_id", messageId);
    }

    if (conversationId) {
      void selectConversation(conversationId);
      window.localStorage.removeItem("nostur_open_livenos_conversation_id");
    }
  }

  const pendingInbox = window.localStorage.getItem("nostur_livenos_open_inbox") as InboxKey | null;
  const pendingConversationId = window.localStorage.getItem("nostur_open_livenos_conversation_id");
  const pendingMessageId = window.localStorage.getItem("nostur_open_livenos_message_id");

  if (pendingInbox) {
    setActiveInbox(pendingInbox);
    window.localStorage.removeItem("nostur_livenos_open_inbox");
  }

  if (pendingMessageId) {
    pendingScrollMessageIdRef.current = pendingMessageId;
  }

  if (pendingConversationId) {
    window.setTimeout(() => {
      void selectConversation(pendingConversationId);
      window.localStorage.removeItem("nostur_open_livenos_conversation_id");
    }, 400);
  }

  window.addEventListener("nostur:open-livenos-conversation", openConversationFromNotification);

  return () => {
    window.removeEventListener(
      "nostur:open-livenos-conversation",
      openConversationFromNotification
    );
  };
}, []);

useEffect(() => {
  const messageId = pendingScrollMessageIdRef.current;

  if (!messageId || mensajes.length === 0) return;

  window.setTimeout(() => {
    const element = document.getElementById(`livenos-message-${messageId}`);

    if (!element) return;

    element.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    element.classList.add("ring-4", "ring-red-300", "ring-offset-2");

    window.setTimeout(() => {
      element.classList.remove("ring-4", "ring-red-300", "ring-offset-2");
    }, 2200);

    pendingScrollMessageIdRef.current = null;
    window.localStorage.removeItem("nostur_open_livenos_message_id");
  }, 450);
}, [mensajes]);

    async function getUserId() {
    const { data } = await supabase.auth.getUser();
    return data.user?.id || null;
  }

  async function selectConversation(id: string) {
    setSelectedId(id);
    selectedIdRef.current = id;
    setComposerText("");
    setInternalText("");
    setScheduledText("");
    setReminderText("");
    setScheduledFor("");
    setReminderFor("");
    setTransferTargetId("");
    setCollaborationTargetId("");
    setReplyToMessage(null);
    setOpenMessageMenuId(null);
    setShowEmojiPanel(false);
    setShowQuickRepliesPanel(false);
    setQuickReplySearch("");

    setTemplateModalOpen(false);
    setSelectedTemplateId(null);
    setTemplateVariables({});
    setTemplateSending(false);

    setNewConversationOpen(false);
    setNewConversationPhone("");
    setNewConversationName("");
    setNewConversationTemplateId(null);
    setNewConversationVariables({});
    setNewConversationSending(false);

    setCandeFeedbackDraft(null);
    setCandeFeedbackMotivo("");
    setCandeFeedbackCorreccion("");

    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }

    setPendingAttachment(null);
    setIsDraggingFile(false);
    setAudioRecording(false);
    setPreviewMedia(null);

    const selected = conversaciones.find((conv) => conv.id === id);

    setEditingContactName(false);
    setContactNameDraft(getDisplayName(selected?.contacto, selected || null));

    if (selected && selected.unread_count > 0) {
      await supabase.from("conversaciones").update({ unread_count: 0 }).eq("id", id);
      await loadData();
    }
  }

  async function takeConversation() {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setActionLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("conversaciones")
      .update({
        assigned_to: userId,
        tomada_by: userId,
        tomada_at: new Date().toISOString(),
        estado_gestion: "en_gestion",
        inbox: "vendedor"
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      setError(updateError.message || "No se pudo tomar la conversación.");
      setActionLoading(false);
      return;
    }

    setStatus("Conversación tomada.");
    await loadData();
    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
    setActionLoading(false);
  }

  async function toggleCande() {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const current = selectedConversation.oportunidad;

    if (!current) {
      setError("Esta conversación todavía no tiene oportunidad vinculada.");
      setActionLoading(false);
      return;
    }

    const { error: updateError } = await supabase
      .from("lead_oportunidades")
      .update({
        cande_activa: !current.cande_activa,
        updated_at: new Date().toISOString()
      })
      .eq("id", current.id);

    if (updateError) {
      setError(updateError.message || "No se pudo actualizar Cande.");
      setActionLoading(false);
      return;
    }

    setStatus(current.cande_activa ? "Cande desactivada." : "Cande activada.");
    await loadData();
    setActionLoading(false);
  }

  async function closeConversation() {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from("conversaciones")
      .update({
        closed_at: new Date().toISOString(),
        estado_gestion: "resuelta"
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      setError(updateError.message || "No se pudo cerrar la conversación.");
      setActionLoading(false);
      return;
    }

    setStatus("Conversación cerrada.");
    await loadData();
    setActionLoading(false);
  }

  async function archiveConversation() {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from("conversaciones")
      .update({
        archived_at: new Date().toISOString(),
        status: "archived"
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      setError(updateError.message || "No se pudo archivar la conversación.");
      setActionLoading(false);
      return;
    }

    setStatus("Conversación archivada.");
    await loadData();
    setActionLoading(false);
  }

  async function deleteConversation() {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from("conversaciones")
      .update({
        deleted_at: new Date().toISOString(),
        status: "trash"
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      setError(updateError.message || "No se pudo eliminar la conversación.");
      setActionLoading(false);
      return;
    }

    setStatus("Conversación enviada a eliminadas.");
    await loadData();
    setActionLoading(false);
  }

  async function restoreConversation() {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from("conversaciones")
      .update({
        archived_at: null,
        deleted_at: null,
        closed_at: null,
        status: "open",
        estado_gestion: selectedConversation.assigned_to ? "en_gestion" : "sin_atender"
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      setError(updateError.message || "No se pudo restaurar la conversación.");
      setActionLoading(false);
      return;
    }

    setStatus("Conversación restaurada.");
    await loadData();
    setActionLoading(false);
  }

  async function addTaskItem(tipo: "programar_envio_cliente" | "recordatorio") {
    if (!selectedConversation) return;

    const text = tipo === "programar_envio_cliente" ? scheduledText.trim() : reminderText.trim();

    if (!text) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setActionLoading(false);
      return;
    }

    const scheduledValue =
      tipo === "programar_envio_cliente" ? scheduledFor || null : reminderFor || null;

    const { error: insertError } = await supabase.from("notas_conversacion").insert({
      conversacion_id: selectedConversation.id,
      autor_id: userId,
      contenido: text,
      tipo,
      scheduled_for: scheduledValue
    });

    if (insertError) {
      setError(insertError.message || "No se pudo guardar la tarea.");
      setActionLoading(false);
      return;
    }

    if (tipo === "programar_envio_cliente") {
      setScheduledText("");
      setScheduledFor("");
      setStatus("Mensaje programado guardado.");
    } else {
      setReminderText("");
      setReminderFor("");
      setStatus("Recordatorio guardado.");
    }

    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
    setActionLoading(false);
  }

  async function addInternalSystemNote(contenido: string) {
    if (!selectedConversation) return;

    const userId = await getUserId();

    if (!userId) return;

    await supabase.from("notas_conversacion").insert({
      conversacion_id: selectedConversation.id,
      autor_id: userId,
      contenido,
      tipo: "nota",
      scheduled_for: null
    });
  }

  async function transferConversationToSeller() {
    if (!selectedConversation || !transferTargetId) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setActionLoading(false);
      return;
    }

    const targetProfile = profiles.find((profile) => profile.id === transferTargetId) || null;
    const targetName = getProfileFullName(targetProfile);

    const { error: updateError } = await supabase
      .from("conversaciones")
      .update({
        assigned_to: transferTargetId,
        estado_gestion: "en_gestion",
        inbox: "vendedor",
        tomada_by: transferTargetId,
        tomada_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedConversation.id);

    if (updateError) {
      setError(updateError.message || "No se pudo transferir la conversación.");
      setActionLoading(false);
      return;
    }

    if (selectedOportunidad) {
      await supabase
        .from("lead_oportunidades")
        .update({
          assigned_to: transferTargetId,
          transferida_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedOportunidad.id);
    }

    await addInternalSystemNote(`Conversación transferida a ${targetName}.`);

    setTransferTargetId("");
    setStatus(`Conversación transferida a ${targetName}.`);

    await loadData();
    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });

    setActionLoading(false);
  }

  async function addConversationCollaborator() {
    if (!selectedConversation || !collaborationTargetId) return;

    const alreadyExists = selectedColaboradores.some(
      (colaborador) => colaborador.profile_id === collaborationTargetId
    );

    if (alreadyExists) {
      setError("Ese vendedor ya está colaborando en esta conversación.");
      return;
    }

    if (selectedConversation.assigned_to === collaborationTargetId) {
      setError("Ese vendedor ya es el responsable principal de la conversación.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setActionLoading(false);
      return;
    }

    const targetProfile = profiles.find((profile) => profile.id === collaborationTargetId) || null;
    const targetName = getProfileFullName(targetProfile);

    const { error: insertError } = await supabase.from("conversacion_colaboradores").insert({
      conversacion_id: selectedConversation.id,
      profile_id: collaborationTargetId,
      added_by: userId
    });

    if (insertError) {
      setError(insertError.message || "No se pudo agregar el colaborador.");
      setActionLoading(false);
      return;
    }

    await supabase
      .from("conversaciones")
      .update({
        inbox: "colaboracion",
        estado_gestion: "colaboracion",
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedConversation.id);

    await addInternalSystemNote(`${targetName} fue agregado como colaborador.`);

    setCollaborationTargetId("");
    setStatus(`${targetName} agregado en colaboración.`);

    await loadData();
    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });

    setActionLoading(false);
  }

  async function removeConversationCollaborator(colaborador: ConversacionColaborador) {
    if (!selectedConversation) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const collaboratorName = getProfileFullName(colaborador.profile);

    const { error: deleteError } = await supabase
      .from("conversacion_colaboradores")
      .delete()
      .eq("id", colaborador.id);

    if (deleteError) {
      setError(deleteError.message || "No se pudo quitar el colaborador.");
      setActionLoading(false);
      return;
    }

    await addInternalSystemNote(`${collaboratorName} fue quitado de la colaboración.`);

    const remainingCollaborators = selectedColaboradores.filter(
      (item) => item.id !== colaborador.id
    );

    if (remainingCollaborators.length === 0) {
      await supabase
        .from("conversaciones")
        .update({
          inbox: selectedConversation.assigned_to ? "vendedor" : "sin_atender",
          estado_gestion: selectedConversation.assigned_to ? "en_gestion" : "sin_atender",
          updated_at: new Date().toISOString()
        })
        .eq("id", selectedConversation.id);
    }

    setStatus(`${collaboratorName} quitado de colaboración.`);

    await loadData();
    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });

    setActionLoading(false);
  }

    async function saveContactDisplayName() {
    if (!selectedConversation || !selectedContacto) return;

    const cleanName = contactNameDraft.trim();

    if (!cleanName) {
      setError("El nombre del contacto no puede quedar vacío.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const { error: updateContactError } = await supabase
      .from("contactos_wa")
      .update({
        display_name: cleanName,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedContacto.id);

    if (updateContactError) {
      setError(updateContactError.message || "No se pudo actualizar el nombre del contacto.");
      setActionLoading(false);
      return;
    }

    const { error: updateConversationError } = await supabase
      .from("conversaciones")
      .update({
        titulo: cleanName,
        subject: cleanName,
        updated_at: new Date().toISOString()
      })
      .eq("id", selectedConversation.id);

    if (updateConversationError) {
      setError(
        updateConversationError.message || "No se pudo actualizar el título de la conversación."
      );
      setActionLoading(false);
      return;
    }

    setEditingContactName(false);
    setStatus("Nombre del contacto actualizado.");

    await loadData();
    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });

    setActionLoading(false);
  }

  function applyQuickReplyVariables(text: string): string {
    const vendedorName =
      selectedVendedor?.nombre_publico_whatsapp || getVendedorName(selectedVendedor);

    return text
      .replaceAll("{{vendedor}}", vendedorName === "Sin asignar" ? "NOSSIX Travel" : vendedorName)
      .replaceAll("{{cliente}}", getDisplayName(selectedContacto, selectedConversation))
      .replaceAll("{{telefono}}", selectedConversation?.wa_phone || "");
  }

  function insertQuickReply(reply: RespuestaRapida) {
    const finalText = applyQuickReplyVariables(reply.contenido);

    setComposerText((current) => {
      if (!current.trim()) return finalText;
      return `${current.trim()}\n${finalText}`;
    });

    setShowQuickRepliesPanel(false);
    setQuickReplySearch("");
  }

  async function createQuickReply() {
    const title = quickReplyTitle.trim();
    const content = quickReplyContent.trim();

    if (!title || !content) {
      setError("La respuesta rápida necesita título y contenido.");
      return;
    }

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    const { error: insertError } = await supabase.from("respuestas_rapidas").insert({
      titulo: title,
      contenido: content,
      categoria: quickReplyCategory.trim() || null,
      atajo: null,
      activa: true,
      orden: quickReplies.length + 1,
      created_by: userId
    });

    if (insertError) {
      setError(insertError.message || "No se pudo crear la respuesta rápida.");
      setActionLoading(false);
      return;
    }

    setQuickReplyTitle("");
    setQuickReplyContent("");
    setQuickReplyCategory("");
    setStatus("Respuesta rápida creada.");

    await loadQuickReplies();
    setActionLoading(false);
  }

  async function sendInternalMessage() {
    if (!selectedConversation || !internalText.trim()) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setActionLoading(false);
      return;
    }

    const text = internalText.trim();

    const { error: insertError } = await supabase.from("notas_conversacion").insert({
      conversacion_id: selectedConversation.id,
      autor_id: userId,
      contenido: text,
      tipo: "mensaje_interno",
      scheduled_for: null
    });

    if (insertError) {
      setError(insertError.message || "No se pudo enviar el mensaje interno.");
      setActionLoading(false);
      return;
    }

    setInternalText("");
    shouldStickToBottomRef.current = true;

    await loadConversationDetail(selectedConversation.id, { forceBottom: true });
    setActionLoading(false);
  }

  async function sendLocalMessage() {
    if (!selectedConversation) return;

    const hasText = Boolean(composerText.trim());
    const hasAttachment = Boolean(pendingAttachment);

    if (!hasText && !hasAttachment) return;

    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setActionLoading(false);
      return;
    }

    const text = composerText.trim();
    const captionText = text || "";
    const now = new Date().toISOString();

    let mediaPayload: Record<string, unknown> | null = null;

    let localMessageType = "text";
    let whatsappMessageType = "text";

    try {
      if (pendingAttachment) {
        const uploaded = await uploadAttachmentToStorage({
          conversationId: selectedConversation.id,
          attachment: pendingAttachment
        });

        localMessageType =
          pendingAttachment.kind === "image"
            ? "image"
            : pendingAttachment.kind === "audio"
              ? "audio"
              : "document";

        whatsappMessageType = localMessageType;

        mediaPayload = {
          url: uploaded.url,
          media_url: uploaded.url,
          path: uploaded.path,
          media_path: uploaded.path,
          filename: uploaded.filename,
          media_filename: uploaded.filename,
          mime_type: uploaded.mimeType,
          media_mime_type: uploaded.mimeType,
          size: uploaded.size,
          media_size: uploaded.size
        };
      }

      const previewText =
        text ||
        (localMessageType === "image"
          ? "Imagen enviada"
          : localMessageType === "audio"
            ? "Audio enviado"
            : localMessageType === "document"
              ? "Archivo enviado"
              : "");

      const { data: insertedMessage, error: insertError } = await supabase
        .from("mensajes")
        .insert({
          conversacion_id: selectedConversation.id,
          direction: "out",
          type: localMessageType,
          text: text || null,
          media: mediaPayload,
          reply_to_id: replyToMessage?.id || null,
          forwarded: false,
          status: "pending",
          error: null,
          wa_message_id: null,
          sender_profile_id: userId,
          deleted_at: null,
          delivered_at: null,
          read_at: null,
          wa_timestamp: now,
          sender_kind: "humano"
        })
        .select("id")
        .single();

      if (insertError) {
        throw new Error(insertError.message || "No se pudo crear el mensaje.");
      }

      const messageId = insertedMessage.id as string;

      await supabase
        .from("conversaciones")
        .update({
          last_message_at: now,
          last_outbound_message_at: now,
          last_message_preview: previewText,
          estado_gestion: "en_gestion",
          updated_at: now
        })
        .eq("id", selectedConversation.id);

      setComposerText("");
      setReplyToMessage(null);
      setShowEmojiPanel(false);
      setShowQuickRepliesPanel(false);
      clearPendingAttachment();
      setIsDraggingFile(false);

      shouldStickToBottomRef.current = true;
      await loadConversationDetail(selectedConversation.id, { forceBottom: true });

      const { data: sendData, error: sendError } = await supabase.functions.invoke(
        "whatsapp-send-message",
        {
          body: {
            conversacion_id: selectedConversation.id,
            conversation_id: selectedConversation.id,
            message_id: messageId,
            local_message_id: messageId,
            to: selectedConversation.wa_phone,
            wa_phone: selectedConversation.wa_phone,
            text: captionText,
            message_type: whatsappMessageType,
            media_url: mediaPayload?.media_url || null,
            media_mime_type:
              localMessageType === "audio"
                ? getCleanAudioMimeForMeta(String(mediaPayload?.media_mime_type || "audio/ogg"))
                : mediaPayload?.media_mime_type || null,
            media_filename:
              localMessageType === "audio"
                ? mediaPayload?.media_filename || "audio.ogg"
                : mediaPayload?.media_filename || null,
            reply_to_whatsapp_message_id: replyToMessage?.wa_message_id || null,
            sender_profile_id: userId,
            show_agent_name: showAgentName
          }
        }
      );

      if (sendError) {
        await supabase
          .from("mensajes")
          .update({
            status: "failed",
            error: sendError.message || "No se pudo enviar el mensaje por WhatsApp."
          })
          .eq("id", messageId);

        setError(sendError.message || "No se pudo enviar el mensaje por WhatsApp.");
        await loadData();
        await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
        setActionLoading(false);
        return;
      }

      if (!sendData?.ok) {
        const errorMessage = sendData?.error || "WhatsApp rechazó el envío del mensaje.";

        await supabase
          .from("mensajes")
          .update({
            status: "failed",
            error: errorMessage
          })
          .eq("id", messageId);

        setError(errorMessage);
        await loadData();
        await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
        setActionLoading(false);
        return;
      }

      await loadData();
      await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
      setActionLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo preparar el archivo.");
      setActionLoading(false);
    }
  }

  async function deleteMessage(message: Mensaje) {
    setActionLoading(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("mensajes")
      .update({
        deleted_at: new Date().toISOString()
      })
      .eq("id", message.id);

    if (updateError) {
      setError(updateError.message || "No se pudo eliminar el mensaje.");
      setActionLoading(false);
      return;
    }

    setOpenMessageMenuId(null);

    if (selectedConversation) {
      await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
    }

    setActionLoading(false);
  }

    async function handleReaction(message: Mensaje, emoji: string) {
    setOpenMessageMenuId(null);
    setError(null);

    const userId = await getUserId();

    const existing = reacciones.find(
      (reaccion) => reaccion.mensaje_id === message.id && reaccion.autor_id === userId
    );

    if (existing) {
      await supabase.from("mensaje_reacciones").delete().eq("id", existing.id);
    }

    const { error: insertError } = await supabase.from("mensaje_reacciones").insert({
      mensaje_id: message.id,
      autor_id: userId,
      emoji
    });

    if (insertError) {
      setError(insertError.message || "No se pudo guardar la reacción.");
      return;
    }

    if (message.wa_message_id && message.direction === "in") {
      await supabase.functions.invoke("whatsapp-send-message", {
        body: {
          conversacion_id: selectedConversation?.id || message.conversacion_id,
          to: selectedConversation?.wa_phone || null,
          reaction_emoji: emoji,
          reaction_to_whatsapp_message_id: message.wa_message_id
        }
      });
    }

    if (selectedConversation) {
      await loadConversationDetail(selectedConversation.id, { preserveScroll: true });
    }
  }

  function handleForward(message: Mensaje) {
    setStatus("Reenvío preparado para próxima fase.");
    setOpenMessageMenuId(null);
    console.info("forward_pending", message);
  }

  function handleReply(message: Mensaje) {
    setReplyToMessage(message);
    setOpenMessageMenuId(null);
  }

  function handleFileButtonClick(kind: "file" | "image") {
    if (kind === "image") {
      imageInputRef.current?.click();
      return;
    }

    fileInputRef.current?.click();
  }

  async function startAudioRecording() {
    if (audioRecording) return;

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Este navegador no permite grabar audio.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = getRecorderMimeType();

      const recorder = preferredMimeType
        ? new MediaRecorder(stream, { mimeType: preferredMimeType })
        : new MediaRecorder(stream);

      const chunks: BlobPart[] = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const recordedMimeType = recorder.mimeType || preferredMimeType || "audio/webm";
        const extension = getAudioExtension(recordedMimeType);
        const finalMimeType =
          getCleanAudioMimeForMeta(recordedMimeType) || recordedMimeType || "audio/webm";

        const blob = new Blob(chunks, {
          type: finalMimeType
        });

        const file = new File([blob], `audio-${Date.now()}.${extension}`, {
          type: finalMimeType
        });

        setAttachmentFromFile(file);

        stream.getTracks().forEach((track) => track.stop());
        setAudioRecording(false);
        audioRecorderRef.current = null;

        if (!canSendAsWhatsappAudio(finalMimeType)) {
          setStatus("Audio grabado. Si WhatsApp no acepta el formato, revisaremos conversión luego.");
        } else {
          setStatus("Audio listo para enviar.");
        }
      };

      audioRecorderRef.current = recorder;
      recorder.start();

      setAudioRecording(true);
      setError(null);
      setStatus("Grabando audio...");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la grabación.");
      setAudioRecording(false);
    }
  }

  function stopAudioRecording() {
    const recorder = audioRecorderRef.current;

    if (!recorder || recorder.state === "inactive") {
      setAudioRecording(false);
      return;
    }

    recorder.stop();
  }

  function handleMicButtonClick() {
    if (audioRecording) {
      stopAudioRecording();
      return;
    }

    void startAudioRecording();
  }

  async function syncWhatsappTemplates() {
    setTemplateSyncing(true);
    setError(null);
    setStatus(null);

    const { data, error: syncError } = await supabase.functions.invoke("whatsapp-sync-templates", {
      body: {}
    });

    if (syncError) {
      setError(syncError.message || "No se pudieron sincronizar las plantillas.");
      setTemplateSyncing(false);
      return;
    }

    if (!data?.ok) {
      setError(data?.error || "Meta rechazó la sincronización de plantillas.");
      setTemplateSyncing(false);
      return;
    }

    setStatus(`Plantillas sincronizadas: ${data.synced || 0}.`);
    await loadWhatsappTemplates();
    setTemplateSyncing(false);
  }

  function openNewConversationModal() {
    if (activeWhatsappTemplates.length === 0) {
      setError("No hay plantillas activas sincronizadas desde Meta.");
      return;
    }

    const firstTemplate = activeWhatsappTemplates[0];

    setNewConversationPhone("");
    setNewConversationName("");
    setNewConversationTemplateId(firstTemplate.id);
    setNewConversationVariables({});
    setNewConversationOpen(true);
  }

  function handleTemplateButton() {
    if (!selectedConversation) return;

    if (activeWhatsappTemplates.length === 0) {
      setError("No hay plantillas activas sincronizadas desde Meta.");
      return;
    }

    const firstTemplate = activeWhatsappTemplates[0];

    setSelectedTemplateId(firstTemplate.id);
    setTemplateVariables({});
    setTemplateModalOpen(true);
  }

  async function sendNewConversationTemplate() {
    if (!newConversationTemplate) return;

    const phone = normalizePhoneForLiveNos(newConversationPhone);
    const phonePlus = normalizePhoneWithPlus(newConversationPhone);
    const name = newConversationName.trim() || phonePlus || phone;

    if (!phone) {
      setError("Ingresá un teléfono válido.");
      return;
    }

    setNewConversationSending(true);
    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setNewConversationSending(false);
      setActionLoading(false);
      return;
    }

    const variables = newConversationTemplate.variables.map((variable, index) => {
      const numericKey = String(index + 1);
      return newConversationVariables[numericKey] || newConversationVariables[variable] || "";
    });

    const now = new Date().toISOString();

    try {
      const existingContactRes = await supabase
        .from("contactos_wa")
        .select("*")
        .or(`wa_phone.eq.${phonePlus},wa_phone.eq.${phone}`)
        .limit(1)
        .maybeSingle();

      if (existingContactRes.error) {
        throw new Error(existingContactRes.error.message || "No se pudo buscar el contacto.");
      }

      let contactoId = existingContactRes.data?.id as string | undefined;

      if (!contactoId) {
        const insertContactRes = await supabase
          .from("contactos_wa")
          .insert({
            wa_phone: phonePlus,
            display_name: name,
            profile_name: name,
            avatar_url: null
          })
          .select("id")
          .single();

        if (insertContactRes.error) {
          throw new Error(insertContactRes.error.message || "No se pudo crear el contacto.");
        }

        contactoId = insertContactRes.data.id as string;
      } else if (newConversationName.trim()) {
        await supabase
          .from("contactos_wa")
          .update({
            display_name: name
          })
          .eq("id", contactoId);
      }

      const existingConversationRes = await supabase
        .from("conversaciones")
        .select("*")
        .eq("contacto_id", contactoId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existingConversationRes.error) {
        throw new Error(existingConversationRes.error.message || "No se pudo buscar la conversación.");
      }

      let conversationId = existingConversationRes.data?.id as string | undefined;

      if (!conversationId) {
        const insertConversationRes = await supabase
          .from("conversaciones")
          .insert({
            contacto_id: contactoId,
            assigned_to: userId,
            inbox: "vendedor",
            status: "open",
            priority: 0,
            unread_count: 0,
            last_message_at: now,
            last_message_preview: newConversationPreview,
            window_expires_at: null,
            wa_phone: phonePlus,
            last_outbound_message_at: now,
            whatsapp_24h_expires_at: null,
            estado_gestion: "en_gestion",
            estado_comercial: "NUEVO",
            subject: name,
            titulo: name,
            channel: "whatsapp",
            metadata: {
              source: "livenos_new_conversation",
              created_from_template: newConversationTemplate.name
            },
            tomada_at: now,
            tomada_by: userId
          })
          .select("id")
          .single();

        if (insertConversationRes.error) {
          throw new Error(insertConversationRes.error.message || "No se pudo crear la conversación.");
        }

        conversationId = insertConversationRes.data.id as string;
      }

      const insertMessageRes = await supabase
        .from("mensajes")
        .insert({
          conversacion_id: conversationId,
          direction: "out",
          type: "template",
          text: newConversationPreview,
          media: null,
          reply_to_id: null,
          forwarded: false,
          status: "pending",
          error: null,
          wa_message_id: null,
          sender_profile_id: userId,
          deleted_at: null,
          delivered_at: null,
          read_at: null,
          wa_timestamp: now,
          sender_kind: "humano"
        })
        .select("id")
        .single();

      if (insertMessageRes.error) {
        throw new Error(insertMessageRes.error.message || "No se pudo crear el mensaje.");
      }

      const messageId = insertMessageRes.data.id as string;

      const { data: sendData, error: sendError } = await supabase.functions.invoke(
        "whatsapp-send-message",
        {
          body: {
            conversacion_id: conversationId,
            conversation_id: conversationId,
            message_id: messageId,
            local_message_id: messageId,
            to: phone,
            wa_phone: phone,
            text: newConversationPreview,
            template_name: newConversationTemplate.name,
            template_language: newConversationTemplate.language,
            template_variables: variables,
            sender_profile_id: userId,
            show_agent_name: false
          }
        }
      );

      if (sendError || !sendData?.ok) {
        const errorMessage =
          sendError?.message || sendData?.error || "WhatsApp rechazó la plantilla.";

        await supabase
          .from("mensajes")
          .update({
            status: "failed",
            error: errorMessage
          })
          .eq("id", messageId);

        throw new Error(errorMessage);
      }

      await supabase
        .from("conversaciones")
        .update({
          last_message_at: now,
          last_outbound_message_at: now,
          last_message_preview: newConversationPreview,
          estado_gestion: "en_gestion",
          updated_at: now
        })
        .eq("id", conversationId);

      setNewConversationOpen(false);
      setNewConversationPhone("");
      setNewConversationName("");
      setNewConversationTemplateId(null);
      setNewConversationVariables({});
      setStatus("Nueva conversación iniciada.");

      await loadData();

      setSelectedId(conversationId);
      selectedIdRef.current = conversationId;
      shouldStickToBottomRef.current = true;
      await loadConversationDetail(conversationId, { forceBottom: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo iniciar la conversación.");
    }

    setNewConversationSending(false);
    setActionLoading(false);
  }

    async function sendTemplateMessage() {
    if (!selectedConversation || !selectedWhatsappTemplate) return;

    setTemplateSending(true);
    setActionLoading(true);
    setError(null);
    setStatus(null);

    const userId = await getUserId();

    if (!userId) {
      setError("No se pudo identificar el usuario actual.");
      setTemplateSending(false);
      setActionLoading(false);
      return;
    }

    const variables = selectedWhatsappTemplate.variables.map((variable, index) => {
      const numericKey = String(index + 1);
      return templateVariables[numericKey] || templateVariables[variable] || "";
    });

    const now = new Date().toISOString();

    const { data: insertedMessage, error: insertError } = await supabase
      .from("mensajes")
      .insert({
        conversacion_id: selectedConversation.id,
        direction: "out",
        type: "template",
        text: templatePreview,
        media: null,
        reply_to_id: null,
        forwarded: false,
        status: "pending",
        error: null,
        wa_message_id: null,
        sender_profile_id: userId,
        deleted_at: null,
        delivered_at: null,
        read_at: null,
        wa_timestamp: now,
        sender_kind: "humano"
      })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message || "No se pudo crear el mensaje de plantilla.");
      setTemplateSending(false);
      setActionLoading(false);
      return;
    }

    const messageId = insertedMessage.id as string;

    const { data: sendData, error: sendError } = await supabase.functions.invoke(
      "whatsapp-send-message",
      {
        body: {
          conversacion_id: selectedConversation.id,
          conversation_id: selectedConversation.id,
          message_id: messageId,
          local_message_id: messageId,
          to: selectedConversation.wa_phone,
          wa_phone: selectedConversation.wa_phone,
          text: templatePreview,
          template_name: selectedWhatsappTemplate.name,
          template_language: selectedWhatsappTemplate.language,
          template_variables: variables,
          sender_profile_id: userId,
          show_agent_name: false
        }
      }
    );

    if (sendError || !sendData?.ok) {
      const errorMessage =
        sendError?.message || sendData?.error || "WhatsApp rechazó la plantilla.";

      await supabase
        .from("mensajes")
        .update({
          status: "failed",
          error: errorMessage
        })
        .eq("id", messageId);

      setError(errorMessage);
      await loadConversationDetail(selectedConversation.id, { preserveScroll: true });

      setTemplateSending(false);
      setActionLoading(false);
      return;
    }

    await supabase
      .from("conversaciones")
      .update({
        last_message_at: now,
        last_outbound_message_at: now,
        last_message_preview: templatePreview,
        estado_gestion: "en_gestion",
        updated_at: now
      })
      .eq("id", selectedConversation.id);

    setTemplateModalOpen(false);
    setSelectedTemplateId(null);
    setTemplateVariables({});
    setStatus("Plantilla enviada.");

    shouldStickToBottomRef.current = true;

    await loadData();
    await loadConversationDetail(selectedConversation.id, { forceBottom: true });

    setTemplateSending(false);
    setActionLoading(false);
  }

  function getAttachmentKind(file: File): PendingAttachment["kind"] {
    if (file.type.startsWith("image/")) return "image";
    if (file.type.startsWith("audio/")) return "audio";
    return "document";
  }

  function setAttachmentFromFile(file: File | null) {
    if (!file) return;

    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }

    const kind = getAttachmentKind(file);
    const previewUrl = kind === "image" || kind === "audio" ? URL.createObjectURL(file) : null;

    setPendingAttachment({
      file,
      previewUrl,
      kind
    });

    setStatus(null);
    setError(null);
  }

  function clearPendingAttachment() {
    if (pendingAttachment?.previewUrl) {
      URL.revokeObjectURL(pendingAttachment.previewUrl);
    }

    setPendingAttachment(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (imageInputRef.current) {
      imageInputRef.current.value = "";
    }
  }

  function getSafeStorageName(file: File): string {
    const cleanName = file.name
      .replace(/[^\w.\-áéíóúÁÉÍÓÚñÑ ]/g, "")
      .replace(/\s+/g, "-")
      .trim()
      .slice(0, 120);

    return cleanName || `archivo-${Date.now()}`;
  }

  async function uploadAttachmentToStorage(params: {
    conversationId: string;
    attachment: PendingAttachment;
  }) {
    const safeName = getSafeStorageName(params.attachment.file);
    const path = `whatsapp-outbound/${params.conversationId}/${Date.now()}-${safeName}`;

    const uploadRes = await supabase.storage
      .from("comunicaciones-media")
      .upload(path, params.attachment.file, {
        contentType: params.attachment.file.type || "application/octet-stream",
        cacheControl: "3600",
        upsert: false
      });

    if (uploadRes.error) {
      throw new Error(uploadRes.error.message || "No se pudo subir el archivo.");
    }

    const publicRes = supabase.storage.from("comunicaciones-media").getPublicUrl(path);

    return {
      path,
      url: publicRes.data.publicUrl,
      filename: params.attachment.file.name,
      mimeType: params.attachment.file.type || "application/octet-stream",
      size: params.attachment.file.size
    };
  }

  function handleSelectedFile(file: File | null, source: "file" | "image" = "file") {
    setAttachmentFromFile(file);

    if (source === "image" && imageInputRef.current) {
      imageInputRef.current.value = "";
    }

    if (source === "file" && fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function getFileFromDataTransfer(dataTransfer: DataTransfer): File | null {
    const files = Array.from(dataTransfer.files || []);
    return files.length > 0 ? files[0] : null;
  }

  function handleChatDragOver(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (!selectedConversation) return;

    setIsDraggingFile(true);
  }

  function handleChatDragLeave(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    const currentTarget = event.currentTarget;
    const relatedTarget = event.relatedTarget as Node | null;

    if (relatedTarget && currentTarget.contains(relatedTarget)) return;

    setIsDraggingFile(false);
  }

  function handleChatDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    event.stopPropagation();

    setIsDraggingFile(false);

    if (!selectedConversation) return;

    const file = getFileFromDataTransfer(event.dataTransfer);

    if (!file) {
      setError("No se detectó ningún archivo para adjuntar.");
      return;
    }

    setAttachmentFromFile(file);
  }

  function handleComposerPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    const items = Array.from(event.clipboardData?.items || []);
    const fileItem = items.find((item) => item.kind === "file");
    const file = fileItem?.getAsFile() || null;

    if (!file) return;

    event.preventDefault();
    setAttachmentFromFile(file);
  }

  function openMediaPreview(message: Mensaje) {
    const url = getMessageMediaUrl(message);

    if (!url) return;

    const name = getMessageMediaName(message);
    const mime = getMessageMediaMime(message);
    const type = isImageMessage(message) ? "image" : isAudioMessage(message) ? "audio" : "file";

    setPreviewMedia({
      url,
      name,
      mime,
      type
    });
  }

  function openMediaInNewTab(message: Mensaje) {
    const mediaUrl = getMessageMediaUrl(message);

    if (!mediaUrl) return;

    window.open(mediaUrl, "_blank", "noopener,noreferrer");
  }

    function buildLiveNosNiaContext() {
    if (!selectedConversation) {
      return {
        source: "livenos",
        module: "comunicaciones",
        action: "open_nia_without_conversation",
        created_at: new Date().toISOString()
      };
    }

    return {
      source: "livenos",
      module: "comunicaciones",
      action: "open_nia_with_conversation_context",

      conversation_id: selectedConversation.id,
      conversacion_id: selectedConversation.id,

      wa_phone: selectedConversation.wa_phone,
      contacto_id: selectedConversation.contacto_id,
      contacto_nombre: getDisplayName(selectedContacto, selectedConversation),
      contacto_profile_name: selectedContacto?.profile_name || null,

      vendedor_id: selectedConversation.assigned_to || null,
      vendedor_nombre: getVendedorName(selectedVendedor),

      estado_gestion: selectedConversation.estado_gestion,
      estado_comercial: selectedConversation.estado_comercial,
      inbox: selectedConversation.inbox,
      status: selectedConversation.status,

      last_message_at: selectedConversation.last_message_at,
      last_inbound_message_at: selectedConversation.last_inbound_message_at,
      last_outbound_message_at: selectedConversation.last_outbound_message_at,
      last_message_preview: selectedConversation.last_message_preview,

      ventana_24h_abierta: Boolean(
        selectedConversation.whatsapp_24h_expires_at &&
          new Date(selectedConversation.whatsapp_24h_expires_at).getTime() > Date.now()
      ),
      whatsapp_24h_expires_at: selectedConversation.whatsapp_24h_expires_at,

      oportunidad_id: selectedOportunidad?.id || null,
      oportunidad_score: selectedOportunidad?.score || null,
      oportunidad_estado_id: selectedOportunidad?.estado_id || null,
      oportunidad_datos: selectedOportunidad?.datos || null,
      cande_activa: selectedOportunidad?.cande_activa || false,
      cande_handoff_requested_at: selectedOportunidad?.cande_handoff_requested_at || null,

      created_at: new Date().toISOString()
    };
  }

  function buildOpportunityActionDetail(action: string) {
    if (!selectedConversation) return null;

    const datos = selectedOportunidad?.datos || {};

    return {
      source: "livenos",
      module: "comunicaciones",
      action,

      conversation_id: selectedConversation.id,
      conversacion_id: selectedConversation.id,

      oportunidad_id: selectedOportunidad?.id || null,
      oportunidad_score: selectedOportunidad?.score || null,
      oportunidad_estado_id: selectedOportunidad?.estado_id || null,
      oportunidad_datos: datos,

      contacto_id: selectedConversation.contacto_id,
      contacto_nombre: getDisplayName(selectedContacto, selectedConversation),
      contacto_profile_name: selectedContacto?.profile_name || null,
      wa_phone: selectedConversation.wa_phone,

      vendedor_id: selectedConversation.assigned_to || null,
      vendedor_nombre: getVendedorName(selectedVendedor),

      destino: getDatoFromKeys(datos, ["destino", "destinos", "lugar", "ciudad", "pais", "país"], ""),
      origen: getDatoFromKeys(datos, ["origen", "ciudad_origen", "salida_desde", "origen_sugerido"], ""),
      fechas: getDatoFromKeys(datos, ["fechas_tentativas", "fecha_tentativa", "fecha", "fechas", "mes"], ""),
      pasajeros: getDatoFromKeys(datos, ["cantidad_pasajeros", "pasajeros", "pax", "personas"], ""),
      presupuesto: getDatoFromKeys(datos, ["presupuesto_aproximado", "presupuesto", "budget"], ""),

      created_at: new Date().toISOString()
    };
  }

  function openModuleFromOpportunity(params: {
    appId: string;
    url: string;
    title: string;
    action: string;
  }) {
    const detail = buildOpportunityActionDetail(params.action);

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

    setOpportunityModalOpen(false);
  }

  function createBudgetFromOpportunity() {
    openModuleFromOpportunity({
      appId: "presupuestos-v2",
      url: "internal://presupuestos-v2",
      title: "Presupuestos",
      action: "create_budget_from_opportunity"
    });
  }

  function createCartFromOpportunity() {
    openModuleFromOpportunity({
      appId: "carritos",
      url: "internal://carritos",
      title: "Carritos",
      action: "create_cart_from_opportunity"
    });
  }

  function createFileFromOpportunity() {
    openModuleFromOpportunity({
      appId: "files",
      url: "internal://files",
      title: "Files",
      action: "create_file_from_opportunity"
    });
  }

  function openNiaFromLiveNos() {
    const detail = buildLiveNosNiaContext();

    window.localStorage.setItem("nostur_nia_context", JSON.stringify(detail));

    window.dispatchEvent(
      new CustomEvent("nostur:open-nia-chat", {
        detail
      })
    );

    setStatus(
      selectedConversation
        ? "NIA recibió el contexto de esta conversación."
        : "NIA abierta sin conversación seleccionada."
    );
  }

  function openCandeFeedback(message: Mensaje, tipo: CandeFeedbackTipo) {
    setCandeFeedbackDraft({
      message,
      tipo
    });

    setCandeFeedbackMotivo("");
    setCandeFeedbackCorreccion(
      tipo === "positivo" ? "La respuesta fue correcta, útil y natural." : ""
    );

    setOpenMessageMenuId(null);
  }

  function closeCandeFeedbackModal() {
    if (candeFeedbackSaving) return;

    setCandeFeedbackDraft(null);
    setCandeFeedbackMotivo("");
    setCandeFeedbackCorreccion("");
  }

  async function saveCandeFeedback() {
    if (!selectedConversation || !candeFeedbackDraft) return;

    const userId = await getUserId();

    setCandeFeedbackSaving(true);
    setError(null);
    setStatus(null);

    const message = candeFeedbackDraft.message;
    const tipo = candeFeedbackDraft.tipo;

    const oportunidadDatos =
      selectedOportunidad?.datos && typeof selectedOportunidad.datos === "object"
        ? selectedOportunidad.datos
        : {};

    const contexto = {
      conversation_id: selectedConversation.id,
      wa_phone: selectedConversation.wa_phone,
      contacto_nombre: getDisplayName(selectedContacto, selectedConversation),
      vendedor_nombre: getVendedorName(selectedVendedor),
      estado_gestion: selectedConversation.estado_gestion,
      estado_comercial: selectedConversation.estado_comercial,
      inbox: selectedConversation.inbox,
      oportunidad_id: selectedOportunidad?.id || null,
      oportunidad_score: selectedOportunidad?.score || null,
      oportunidad_datos: oportunidadDatos,
      last_message_preview: selectedConversation.last_message_preview,
      created_from: "livenos_feedback_modal"
    };

    const { error: insertError } = await supabase.from("cande_feedback").insert({
      conversacion_id: selectedConversation.id,
      mensaje_id: message.id,
      oportunidad_id: selectedOportunidad?.id || null,
      autor_id: userId,
      feedback_tipo: tipo,
      motivo: candeFeedbackMotivo.trim() || null,
      correccion_sugerida: candeFeedbackCorreccion.trim() || null,
      respuesta_original: message.text || null,
      contexto
    });

    if (insertError) {
      setError(insertError.message || "No se pudo guardar el feedback de Cande.");
      setCandeFeedbackSaving(false);
      return;
    }

    const emoji = tipo === "positivo" ? "👍" : "👎";

    const existing = reacciones.find(
      (reaccion) => reaccion.mensaje_id === message.id && reaccion.autor_id === userId
    );

    if (existing) {
      await supabase.from("mensaje_reacciones").delete().eq("id", existing.id);
    }

    await supabase.from("mensaje_reacciones").insert({
      mensaje_id: message.id,
      autor_id: userId,
      emoji
    });

    setStatus(
      tipo === "positivo"
        ? "Feedback positivo guardado para Cande."
        : "Feedback guardado. Cande podrá aprender de esta corrección."
    );

    setCandeFeedbackDraft(null);
    setCandeFeedbackMotivo("");
    setCandeFeedbackCorreccion("");

    await loadConversationDetail(selectedConversation.id, { preserveScroll: true });

    setCandeFeedbackSaving(false);
  }

  function renderCandeFeedbackModal() {
    if (!candeFeedbackDraft || !selectedConversation) return null;

    const message = candeFeedbackDraft.message;
    const tipo = candeFeedbackDraft.tipo;

    const oportunidadDatos =
      selectedOportunidad?.datos && typeof selectedOportunidad.datos === "object"
        ? selectedOportunidad.datos
        : {};

    const destino = getDatoFromKeys(oportunidadDatos, ["destino", "destinos", "lugar"]);
    const origen = getDatoFromKeys(oportunidadDatos, ["origen", "ciudad_origen", "salida_desde"]);
    const fechas = getDatoFromKeys(oportunidadDatos, ["fechas_tentativas", "fecha", "fechas", "mes"]);
    const pasajeros = getDatoFromKeys(oportunidadDatos, [
      "cantidad_pasajeros",
      "pasajeros",
      "pax",
      "personas"
    ]);
    const presupuesto = getDatoFromKeys(oportunidadDatos, [
      "presupuesto_aproximado",
      "presupuesto",
      "budget"
    ]);

    const score = Number(selectedOportunidad?.score || 0);

    return (
      <div className="fixed inset-0 z-[120] flex items-center justify-center bg-[#0f172a]/45 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-[820px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  className={[
                    "flex h-9 w-9 items-center justify-center rounded-xl text-base font-medium",
                    tipo === "positivo"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-amber-50 text-amber-700"
                  ].join(" ")}
                >
                  {tipo === "positivo" ? "👍" : "👎"}
                </div>

                <div>
                  <h3 className="text-[15px] font-semibold text-[#142033]">Feedback para Cande</h3>
                  <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
                    Queda guardado para revisar y mejorar respuestas futuras.
                  </p>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={closeCandeFeedbackModal}
              disabled={candeFeedbackSaving}
              className="rounded-xl bg-[#f1f5f9] px-3 py-2 text-xs font-medium text-[#64748b] hover:bg-[#e2e8f0] disabled:opacity-50"
            >
              Cerrar
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-4">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
              <section className="space-y-3">
                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
                    Respuesta original de Cande
                  </div>

                  <div className="whitespace-pre-wrap rounded-xl bg-[#f8fafc] p-3 text-[13px] font-normal leading-relaxed text-[#142033]">
                    {message.text || "Sin texto"}
                  </div>
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
                    Motivo del feedback
                  </div>

                  <textarea
                    value={candeFeedbackMotivo}
                    onChange={(event) => setCandeFeedbackMotivo(event.target.value)}
                    placeholder={
                      tipo === "positivo"
                        ? "Ej: Respondió bien, pidió el dato correcto, tono natural..."
                        : "Ej: Derivó muy rápido, inventó datos, no pidió origen, tono incorrecto..."
                    }
                    className="min-h-[90px] w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-normal leading-relaxed text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                  />
                </div>

                <div className="rounded-2xl border border-black/10 bg-white p-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#94a3b8]">
                    Corrección o respuesta sugerida
                  </div>

                  <textarea
                    value={candeFeedbackCorreccion}
                    onChange={(event) => setCandeFeedbackCorreccion(event.target.value)}
                    placeholder="Escribí cómo debería haber respondido Cande en este caso..."
                    className="min-h-[118px] w-full resize-none rounded-xl border border-black/10 bg-white px-3 py-2 text-[13px] font-normal leading-relaxed text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                  />

                  <p className="mt-2 text-[11px] font-normal text-[#64748b]">
                    Esta corrección no se envía al pasajero.
                  </p>
                </div>
              </section>

              <aside className="space-y-3">
                <section className="rounded-2xl border border-black/10 bg-white p-4">
                  <h4 className="text-[13px] font-semibold text-[#142033]">Contexto comercial</h4>

                  <div className="mt-3 space-y-2 text-[12px] font-normal text-[#475569]">
                    <div className="flex justify-between gap-3">
                      <span>Pasajero</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {getDisplayName(selectedContacto, selectedConversation)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>WhatsApp</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {selectedConversation.wa_phone}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Score</span>
                      <span className="font-medium text-[#142033]">
                        {score}/100 · {getScoreLabel(score)}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Vendedor</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {getVendedorName(selectedVendedor)}
                      </span>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-black/10 bg-white p-4">
                  <h4 className="text-[13px] font-semibold text-[#142033]">Datos detectados</h4>

                  <div className="mt-3 space-y-2 text-[12px] font-normal text-[#475569]">
                    <div className="flex justify-between gap-3">
                      <span>Destino</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {destino}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Origen</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {origen}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Fechas</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {fechas}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Pasajeros</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {pasajeros}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Presupuesto</span>
                      <span className="max-w-[140px] truncate text-right font-medium text-[#142033]">
                        {presupuesto}
                      </span>
                    </div>
                  </div>
                </section>
              </aside>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-white px-5 py-4">
            <button
              type="button"
              onClick={closeCandeFeedbackModal}
              disabled={candeFeedbackSaving}
              className="h-9 rounded-xl bg-[#f1f5f9] px-4 text-xs font-medium text-[#64748b] hover:bg-[#e2e8f0] disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={saveCandeFeedback}
              disabled={candeFeedbackSaving}
              className={[
                "inline-flex h-9 items-center gap-2 rounded-xl px-4 text-xs font-medium text-white shadow-sm disabled:opacity-50",
                tipo === "positivo"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-[#4f7c90] hover:bg-[#406b7d]"
              ].join(" ")}
            >
              {candeFeedbackSaving ? <Loader2 size={14} className="animate-spin" /> : null}
              Guardar feedback
            </button>
          </div>
        </div>
      </div>
    );
  }

  function renderMessageMenu(message: Mensaje) {
    const mediaUrl = getMessageMediaUrl(message);

    return (
      <div
        className="absolute right-0 top-7 z-40 w-[215px] overflow-hidden rounded-xl border border-black/10 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-black/10 p-2">
          <div className="mb-1 px-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
            Reaccionar
          </div>

          <div className="flex gap-1">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => handleReaction(message, emoji)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[15px] hover:bg-[#f1f5f9]"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => handleReply(message)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[#475569] hover:bg-[#f8fafc]"
        >
          <Reply size={14} />
          Responder
        </button>

        <button
          type="button"
          onClick={() => handleForward(message)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[#475569] hover:bg-[#f8fafc]"
        >
          <Send size={14} />
          Reenviar
        </button>

        {mediaUrl ? (
          <>
            <button
              type="button"
              onClick={() => {
                openMediaPreview(message);
                setOpenMessageMenuId(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[#475569] hover:bg-[#f8fafc]"
            >
              <Eye size={14} />
              Vista rápida
            </button>

            <button
              type="button"
              onClick={() => {
                openMediaInNewTab(message);
                setOpenMessageMenuId(null);
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[#475569] hover:bg-[#f8fafc]"
            >
              <FileText size={14} />
              Abrir archivo
            </button>

            <a
              href={mediaUrl}
              download={getMessageMediaName(message)}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpenMessageMenuId(null)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[#475569] hover:bg-[#f8fafc]"
            >
              <Download size={14} />
              Descargar
            </a>
          </>
        ) : null}

        {message.sender_kind === "cande" ? (
          <>
            <div className="my-1 border-t border-black/10" />

            <button
              type="button"
              onClick={() => openCandeFeedback(message, "positivo")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-emerald-700 hover:bg-emerald-50"
            >
              👍
              Cande respondió bien
            </button>

            <button
              type="button"
              onClick={() => openCandeFeedback(message, "negativo")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-amber-700 hover:bg-amber-50"
            >
              👎
              Marcar mala respuesta
            </button>

            <button
              type="button"
              onClick={() => openCandeFeedback(message, "correccion")}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-[#4f7c90] hover:bg-[#eef6f7]"
            >
              <Sparkles size={14} />
              Corregir / enseñar
            </button>
          </>
        ) : null}

        <button
          type="button"
          onClick={() => deleteMessage(message)}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] font-medium text-red-600 hover:bg-red-50"
        >
          <Trash2 size={14} />
          Eliminar
        </button>
      </div>
    );
  }

  function renderReactions(message: Mensaje) {
    const messageReactions = reaccionesByMensaje[message.id] || [];

    if (messageReactions.length === 0) return null;

    return (
      <div className="mt-1.5 flex flex-wrap gap-1">
        {messageReactions.map((reaction) => (
          <span
            key={reaction.id}
            className="rounded-full bg-white/75 px-1.5 py-0.5 text-[11px] shadow-sm ring-1 ring-black/5"
          >
            {reaction.emoji}
          </span>
        ))}
      </div>
    );
  }

  function renderMediaPreviewModal() {
    if (!previewMedia) return null;

    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0f172a]/60 p-4 backdrop-blur-sm">
        <div className="flex max-h-[92vh] w-full max-w-[900px] flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-center justify-between gap-3 border-b border-black/10 px-5 py-4">
            <div className="min-w-0">
              <h3 className="truncate text-[15px] font-semibold text-[#142033]">
                {previewMedia.name}
              </h3>
              <p className="text-[12px] font-normal text-[#64748b]">
                {previewMedia.mime || "archivo"}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => window.open(previewMedia.url, "_blank", "noopener,noreferrer")}
                className="rounded-xl bg-[#f1f5f9] px-3 py-2 text-xs font-medium text-[#475569] hover:bg-[#e2e8f0]"
              >
                Abrir
              </button>

              <a
                href={previewMedia.url}
                download={previewMedia.name}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[#4f7c90] px-3 py-2 text-xs font-medium text-white hover:bg-[#406b7d]"
              >
                Descargar
              </a>

              <button
                type="button"
                onClick={() => setPreviewMedia(null)}
                className="rounded-xl bg-red-50 px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-100"
              >
                Cerrar
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto bg-[#f8fafc] p-4">
            {previewMedia.type === "image" ? (
              <img
                src={previewMedia.url}
                alt={previewMedia.name}
                className="mx-auto max-h-[72vh] max-w-full rounded-2xl object-contain shadow-sm"
              />
            ) : previewMedia.type === "audio" ? (
              <div className="mx-auto max-w-[620px] rounded-2xl bg-white p-5 shadow-sm ring-1 ring-black/10">
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef6f7] text-[#4f7c90]">
                    <Mic size={22} />
                  </div>

                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[#142033]">
                      {previewMedia.name}
                    </div>
                    <div className="text-[12px] font-normal text-[#64748b]">Audio recibido</div>
                  </div>
                </div>

                <audio controls className="w-full" src={previewMedia.url}>
                  Tu navegador no puede reproducir este audio.
                </audio>
              </div>
            ) : (
              <div className="mx-auto max-w-[620px] rounded-2xl bg-white p-5 text-center shadow-sm ring-1 ring-black/10">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef6f7] text-[#4f7c90]">
                  <FileText size={26} />
                </div>

                <div className="text-[13px] font-semibold text-[#142033]">{previewMedia.name}</div>
                <div className="mt-1 text-[12px] font-normal text-[#64748b]">
                  Este archivo se abre en una pestaña nueva.
                </div>

                <button
                  type="button"
                  onClick={() => window.open(previewMedia.url, "_blank", "noopener,noreferrer")}
                  className="mt-4 rounded-xl bg-[#4f7c90] px-4 py-2 text-xs font-medium text-white hover:bg-[#406b7d]"
                >
                  Abrir archivo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

    function renderMessageBubble(message: Mensaje) {
    const role = getMessageRole(message);
    const outbound = role !== "passenger";
    const mediaUrl = getMessageMediaUrl(message);
    const mediaMime = getMessageMediaMime(message);
    const mediaName = getMessageMediaName(message);
    const mediaSize = getMessageMediaSize(message);
    const isImage = isImageMessage(message);
    const isAudio = isAudioMessage(message);
    const isAi = role === "cande" || role === "nia";
    const menuOpen = openMessageMenuId === message.id;

    const bubbleClass =
      role === "cande"
        ? "rounded-br-sm bg-[#f3e8ff] text-[#4c1d95] ring-purple-100"
        : role === "nia"
          ? "rounded-br-sm bg-[#fce7f3] text-[#831843] ring-pink-100"
          : role === "agent"
            ? "rounded-br-sm bg-[#d9fdd3] text-[#172033] ring-[#bdebb5]"
            : role === "system"
              ? "mx-auto bg-amber-50 text-amber-800 ring-amber-100"
              : "rounded-bl-sm bg-white text-[#172033] ring-black/5";

    return (
     <article
  key={message.id}
  id={`livenos-message-${message.id}`}
  className={[
          "flex w-full px-1",
          role === "system" ? "justify-center" : outbound ? "justify-end" : "justify-start"
        ].join(" ")}
      >
        <div
          className={[
            "group relative max-w-[66%] rounded-2xl px-3.5 py-2.5 text-[13px] font-normal leading-relaxed shadow-sm ring-1 transition",
            bubbleClass,
            message.status === "failed" ? "ring-red-200" : ""
          ].join(" ")}
        >
          <div
            className={[
              "absolute top-1.5 opacity-0 transition group-hover:opacity-100",
              outbound ? "-left-8" : "-right-8"
            ].join(" ")}
          >
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setOpenMessageMenuId((current) => (current === message.id ? null : message.id));
              }}
              className="flex h-6 w-6 items-center justify-center rounded-full border border-black/10 bg-white text-[#64748b] shadow-sm hover:bg-[#f8fafc] hover:text-[#142033]"
              aria-label="Acciones del mensaje"
            >
              <MoreVertical size={13} />
            </button>

            {menuOpen ? renderMessageMenu(message) : null}
          </div>

          {role === "cande" ? (
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[#6d28d9]">
              <Sparkles size={11} />
              Cande
            </div>
          ) : null}

          {role === "nia" ? (
            <div className="mb-1 flex items-center gap-1 text-[11px] font-medium text-[#be185d]">
              <Sparkles size={11} />
              NIA
            </div>
          ) : null}

          {role === "agent" && showAgentName ? (
            <div className="mb-1 text-[11px] font-medium text-[#2f6f4e]">
              {getMessageSenderName(message, profiles)}
            </div>
          ) : null}

          {mediaUrl ? (
            <div className="mb-2 overflow-hidden rounded-xl bg-black/5">
              {isImage ? (
                <div className="overflow-hidden rounded-xl bg-white/20">
                  <button type="button" onClick={() => openMediaPreview(message)} className="block w-full">
                    <img
                      src={mediaUrl}
                      alt={mediaName}
                      className="max-h-64 w-full min-w-[190px] object-cover"
                    />
                  </button>
                </div>
              ) : isAudio ? (
                <div className={["rounded-xl p-2.5", outbound ? "bg-white/55" : "bg-white"].join(" ")}>
                  <div className="mb-2 flex items-center gap-2">
                    <Mic size={15} />
                    <span className="truncate text-[12px] font-medium">{mediaName}</span>
                  </div>

                  <audio controls className="w-full" src={mediaUrl}>
                    Tu navegador no puede reproducir este audio.
                  </audio>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => openMediaInNewTab(message)}
                  className="flex min-w-[220px] items-center gap-3 rounded-xl bg-white/70 px-3 py-2.5 text-left shadow-sm ring-1 ring-black/5"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#eef6f7] text-[#4f7c90]">
                    <FileText size={18} />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium">{mediaName}</div>

                    <div className="mt-0.5 text-[10px] font-normal text-[#94a3b8]">
                      {mediaMime || "archivo"}
                      {mediaSize ? ` · ${formatFileSize(mediaSize)}` : ""}
                    </div>
                  </div>

                  <Download size={15} className="shrink-0 opacity-70" />
                </button>
              )}
            </div>
          ) : null}

          <div className="whitespace-pre-wrap break-words">{message.text || `[${message.type}]`}</div>

          <div
            className={[
              "mt-1.5 flex items-center gap-2 text-[10px] font-medium",
              outbound ? "justify-end text-[#5b7b68]" : "justify-start text-[#94a3b8]"
            ].join(" ")}
          >
            {role === "passenger" ? (
              <span className="rounded-full bg-[#f1f5f9] px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-[#94a3b8]">
                pasajero
              </span>
            ) : null}

            <span>{formatDateTime(message.wa_timestamp || message.created_at)}</span>

            {outbound ? <MessageStatusIcon message={message} /> : null}
          </div>

          {renderReactions(message)}

          {isAi ? (
            <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={() => openCandeFeedback(message, "positivo")}
                className="rounded-lg px-1.5 py-0.5 hover:bg-white/55"
              >
                👍
              </button>

              <button
                type="button"
                onClick={() => openCandeFeedback(message, "negativo")}
                className="rounded-lg px-1.5 py-0.5 hover:bg-white/55"
              >
                👎
              </button>

              <button
                type="button"
                onClick={() => openCandeFeedback(message, "correccion")}
                className="rounded-lg px-1.5 py-0.5 text-[10px] font-medium hover:bg-white/55"
              >
                Corregir
              </button>
            </div>
          ) : null}

          {message.status === "failed" && message.error ? (
            <div className="mt-2 rounded-lg border border-red-100 bg-red-50 px-2 py-1 text-[10px] font-normal leading-relaxed text-red-700">
              {message.error}
            </div>
          ) : null}
        </div>
      </article>
    );
  }

  function renderInternalBubble(nota: NotaConversacion) {
    const visual = getNotaVisual(nota);

    return (
      <article key={nota.id} className="flex w-full justify-center px-1">
        <div
          className={[
            "max-w-[68%] rounded-xl border px-3 py-2 text-[12px] font-normal leading-relaxed shadow-sm",
            visual.bubbleClass
          ].join(" ")}
        >
          <div className="mb-1 flex items-center gap-2">
            <span
              className={[
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.08em]",
                visual.chipClass
              ].join(" ")}
            >
              {visual.icon}
              {visual.label}
            </span>
          </div>

          <div className="whitespace-pre-wrap break-words">{nota.contenido}</div>

          <div className="mt-1 text-right text-[10px] font-normal opacity-60">
            {formatDateTime(nota.created_at)}
          </div>
        </div>
      </article>
    );
  }

  function renderTimelineItem(item: TimelineItem) {
    if (item.kind === "message") return renderMessageBubble(item.message);
    return renderInternalBubble(item.nota);
  }

  function renderTemplateModal() {
    if (!templateModalOpen || !selectedConversation) return null;

    return (
      <div className="fixed inset-0 z-[80] flex items-center justify-center bg-[#0f172a]/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-[600px] overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[#142033]">Enviar plantilla WhatsApp</h3>
              <p className="mt-1 text-[12px] font-normal text-[#64748b]">
                {getDisplayName(selectedContacto, selectedConversation)} · {selectedConversation.wa_phone}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setTemplateModalOpen(false);
                setSelectedTemplateId(null);
                setTemplateVariables({});
              }}
              className="rounded-xl bg-[#f1f5f9] px-3 py-2 text-xs font-medium text-[#64748b] hover:bg-[#e2e8f0]"
            >
              Cerrar
            </button>
          </div>

          <div className="max-h-[72vh] overflow-auto p-5">
            <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
              Plantilla
            </label>

            <select
              value={selectedTemplateId || ""}
              onChange={(event) => {
                setSelectedTemplateId(event.target.value || null);
                setTemplateVariables({});
              }}
              className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none focus:border-[#4f7c90]"
            >
              {activeWhatsappTemplates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.display_name || template.name} · {template.language}
                </option>
              ))}
            </select>

            {selectedWhatsappTemplate ? (
              <>
                <div className="mt-4 rounded-xl border border-black/10 bg-[#f8fafc] p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Pill>{selectedWhatsappTemplate.name}</Pill>
                    <Pill>{selectedWhatsappTemplate.language}</Pill>
                    {selectedWhatsappTemplate.category ? <Pill>{selectedWhatsappTemplate.category}</Pill> : null}
                  </div>

                  <div className="whitespace-pre-wrap text-[13px] font-normal leading-relaxed text-[#142033]">
                    {selectedWhatsappTemplate.body}
                  </div>
                </div>

                {selectedWhatsappTemplate.variables.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                      Variables
                    </div>

                    {selectedWhatsappTemplate.variables.map((variable, index) => {
                      const numericKey = String(index + 1);

                      return (
                        <div key={`${variable}-${index}`}>
                          <label className="mb-1 block text-[12px] font-medium text-[#475569]">
                            Variable {index + 1}{" "}
                            <span className="font-normal text-[#94a3b8]">({variable})</span>
                          </label>

                          <input
                            value={templateVariables[numericKey] || ""}
                            onChange={(event) =>
                              setTemplateVariables((current) => ({
                                ...current,
                                [numericKey]: event.target.value
                              }))
                            }
                            placeholder={`Valor para {{${index + 1}}}`}
                            className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-[#4f7c90]/20 bg-[#eef6f7] p-4">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#4f7c90]">
                    Vista previa
                  </div>

                  <div className="whitespace-pre-wrap text-[13px] font-normal leading-relaxed text-[#142033]">
                    {templatePreview || "Completá las variables para ver la plantilla final."}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-[#f8fafc] px-5 py-4">
            <button
              type="button"
              onClick={syncWhatsappTemplates}
              disabled={templateSyncing}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-medium text-[#64748b] ring-1 ring-black/10 hover:bg-[#f1f5f9] disabled:opacity-50"
            >
              {templateSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Sincronizar
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setTemplateModalOpen(false);
                  setSelectedTemplateId(null);
                  setTemplateVariables({});
                }}
                className="h-9 rounded-xl bg-white px-4 text-xs font-medium text-[#64748b] ring-1 ring-black/10 hover:bg-[#f1f5f9]"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={sendTemplateMessage}
                disabled={templateSending || !selectedWhatsappTemplate}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f7c90] px-4 text-xs font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
              >
                {templateSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Enviar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderNewConversationModal() {
    if (!newConversationOpen) return null;

    return (
      <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#0f172a]/40 p-4 backdrop-blur-sm">
        <div className="w-full max-w-[640px] overflow-hidden rounded-[22px] bg-white shadow-2xl ring-1 ring-black/10">
          <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
            <div>
              <h3 className="text-[15px] font-semibold text-[#142033]">Nueva conversación WhatsApp</h3>
              <p className="mt-1 text-[12px] font-normal text-[#64748b]">
                Para iniciar una conversación nueva necesitás enviar una plantilla aprobada.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setNewConversationOpen(false);
                setNewConversationPhone("");
                setNewConversationName("");
                setNewConversationTemplateId(null);
                setNewConversationVariables({});
              }}
              className="rounded-xl bg-[#f1f5f9] px-3 py-2 text-xs font-medium text-[#64748b] hover:bg-[#e2e8f0]"
            >
              Cerrar
            </button>
          </div>

          <div className="max-h-[72vh] overflow-auto p-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                  Teléfono WhatsApp
                </label>

                <input
                  value={newConversationPhone}
                  onChange={(event) => setNewConversationPhone(event.target.value)}
                  placeholder="Ej: 351..."
                  className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                  Nombre pasajero
                </label>

                <input
                  value={newConversationName}
                  onChange={(event) => setNewConversationName(event.target.value)}
                  placeholder="Nombre visible en LiveNos"
                  className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                />
              </div>
            </div>

            <div className="mt-4">
              <label className="block text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                Plantilla Meta
              </label>

              <select
                value={newConversationTemplateId || ""}
                onChange={(event) => {
                  setNewConversationTemplateId(event.target.value || null);
                  setNewConversationVariables({});
                }}
                className="mt-2 h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none focus:border-[#4f7c90]"
              >
                {activeWhatsappTemplates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.display_name || template.name} · {template.language}
                  </option>
                ))}
              </select>
            </div>

            {newConversationTemplate ? (
              <>
                <div className="mt-4 rounded-xl border border-black/10 bg-[#f8fafc] p-4">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Pill>{newConversationTemplate.name}</Pill>
                    <Pill>{newConversationTemplate.language}</Pill>
                    {newConversationTemplate.category ? <Pill>{newConversationTemplate.category}</Pill> : null}
                  </div>

                  <div className="whitespace-pre-wrap text-[13px] font-normal leading-relaxed text-[#142033]">
                    {newConversationTemplate.body}
                  </div>
                </div>

                {newConversationTemplate.variables.length > 0 ? (
                  <div className="mt-4 space-y-3">
                    <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                      Variables
                    </div>

                    {newConversationTemplate.variables.map((variable, index) => {
                      const numericKey = String(index + 1);

                      return (
                        <div key={`${variable}-${index}`}>
                          <label className="mb-1 block text-[12px] font-medium text-[#475569]">
                            Variable {index + 1}{" "}
                            <span className="font-normal text-[#94a3b8]">({variable})</span>
                          </label>

                          <input
                            value={newConversationVariables[numericKey] || ""}
                            onChange={(event) =>
                              setNewConversationVariables((current) => ({
                                ...current,
                                [numericKey]: event.target.value
                              }))
                            }
                            placeholder={`Valor para {{${index + 1}}}`}
                            className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <div className="mt-4 rounded-xl border border-[#4f7c90]/20 bg-[#eef6f7] p-4">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#4f7c90]">
                    Vista previa
                  </div>

                  <div className="whitespace-pre-wrap text-[13px] font-normal leading-relaxed text-[#142033]">
                    {newConversationPreview || "Completá las variables para ver la plantilla final."}
                  </div>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-black/10 bg-[#f8fafc] px-5 py-4">
            <button
              type="button"
              onClick={syncWhatsappTemplates}
              disabled={templateSyncing}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-xs font-medium text-[#64748b] ring-1 ring-black/10 hover:bg-[#f1f5f9] disabled:opacity-50"
            >
              {templateSyncing ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
              Sincronizar
            </button>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setNewConversationOpen(false);
                  setNewConversationPhone("");
                  setNewConversationName("");
                  setNewConversationTemplateId(null);
                  setNewConversationVariables({});
                }}
                className="h-9 rounded-xl bg-white px-4 text-xs font-medium text-[#64748b] ring-1 ring-black/10 hover:bg-[#f1f5f9]"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={sendNewConversationTemplate}
                disabled={newConversationSending || !newConversationTemplate}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f7c90] px-4 text-xs font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
              >
                {newConversationSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Iniciar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  function renderRightPanelContent() {
    if (!selectedConversation) return null;

    const oportunidadDatos =
      selectedOportunidad?.datos && typeof selectedOportunidad.datos === "object"
        ? selectedOportunidad.datos
        : {};

    const score = Number(selectedOportunidad?.score || 0);

    const destino = getDatoFromKeys(oportunidadDatos, [
      "destino",
      "destinos",
      "lugar",
      "ciudad",
      "pais",
      "país"
    ]);

    const origen = getDatoFromKeys(oportunidadDatos, [
      "origen",
      "ciudad_origen",
      "salida_desde"
    ]);

    const origenSugerido = getDatoFromKeys(oportunidadDatos, ["origen_sugerido"]);

    const origenAeropuerto = getDatoFromKeys(oportunidadDatos, [
      "origen_aeropuerto",
      "origen_sugerido_aeropuerto",
      "aeropuerto_origen"
    ]);

    const origenConfirmado = oportunidadDatos.origen_confirmado === true;

    const fechas = getDatoFromKeys(oportunidadDatos, [
      "fechas_tentativas",
      "fecha_tentativa",
      "fecha",
      "fechas",
      "mes",
      "cuando",
      "cuándo",
      "fecha_viaje"
    ]);

    const pasajeros = getDatoFromKeys(oportunidadDatos, [
      "cantidad_pasajeros",
      "pasajeros",
      "pax",
      "cantidad_pax",
      "personas",
      "cantidad_personas"
    ]);

    const presupuesto = getDatoFromKeys(oportunidadDatos, [
      "presupuesto_aproximado",
      "presupuesto",
      "budget",
      "monto_estimado"
    ]);

    const ultimoMensaje = getDatoFromKeys(oportunidadDatos, [
      "ultimo_mensaje",
      "last_message",
      "mensaje"
    ]);

    const tipoViaje = getDatoFromKeys(oportunidadDatos, [
      "tipo_viaje",
      "tipo_de_viaje",
      "categoria_viaje"
    ]);

    if (rightTab === "info") {
      return (
        <div className="space-y-3">
          <section className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#142033]">Datos del contacto</h3>

            <div className="mt-3 space-y-2 text-[12px] font-normal text-[#475569]">
              <div>
                <span className="block text-[#94a3b8]">Nombre</span>
                <span className="font-medium text-[#142033]">
                  {getDisplayName(selectedContacto, selectedConversation)}
                </span>
              </div>

              <div>
                <span className="block text-[#94a3b8]">WhatsApp</span>
                <span className="font-medium text-[#142033]">{selectedConversation.wa_phone}</span>
              </div>

              <div>
                <span className="block text-[#94a3b8]">Canal</span>
                <span className="font-medium text-[#142033]">{selectedConversation.channel}</span>
              </div>

              <div>
                <span className="block text-[#94a3b8]">Último inbound</span>
                <span className="font-medium text-[#142033]">
                  {formatDateTime(selectedConversation.last_inbound_message_at)}
                </span>
              </div>

              <div>
                <span className="block text-[#94a3b8]">Último outbound</span>
                <span className="font-medium text-[#142033]">
                  {formatDateTime(selectedConversation.last_outbound_message_at)}
                </span>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3.5">
            <h3 className="text-[13px] font-semibold text-[#142033]">Oportunidad</h3>

            {selectedOportunidad ? (
              <div className="mt-3 space-y-3 text-[12px] font-normal text-[#475569]">
                <div className="flex justify-between gap-3">
                  <span>Score</span>
                  <span className={["font-semibold", getScoreTextColor(score)].join(" ")}>
                    {score}/100 · {getScoreLabel(score)}
                  </span>
                </div>

                <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-[#4f7c90]"
                    style={{ width: `${Math.min(Math.max(score, 0), 100)}%` }}
                  />
                </div>

                <div className="flex justify-between gap-3">
                  <span>Cande</span>
                  <span className="font-medium text-[#142033]">
                    {selectedOportunidad.cande_activa ? "Activa" : "Pausada"}
                  </span>
                </div>

                <div className="flex justify-between gap-3">
                  <span>Estado</span>
                  <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                    {pipeline.find((item) => item.id === selectedOportunidad.estado_id)?.nombre || "—"}
                  </span>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <div className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                    Datos relevados
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between gap-3">
                      <span>Destino</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {destino}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Origen</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {origen !== "—" ? origen : "Sin confirmar"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Origen sugerido</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {origenSugerido}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Origen confirmado</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {origenConfirmado ? "Sí" : "No"}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Aeropuerto sugerido</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {origenAeropuerto}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Fechas</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {fechas}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Pasajeros</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {pasajeros}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Presupuesto</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {presupuesto}
                      </span>
                    </div>

                    <div className="flex justify-between gap-3">
                      <span>Tipo de viaje</span>
                      <span className="max-w-[150px] truncate text-right font-medium text-[#142033]">
                        {tipoViaje}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-white p-3">
                  <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                    Último dato guardado
                  </div>

                  <div className="line-clamp-4 text-[12px] font-normal leading-relaxed text-[#475569]">
                    {ultimoMensaje}
                  </div>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[12px] font-normal text-[#64748b]">
                Esta conversación todavía no tiene oportunidad creada.
              </p>
            )}
          </section>
        </div>
      );
    }

    if (rightTab === "tareas") {
      return (
        <div className="space-y-3">
          <section className="rounded-2xl border border-black/10 bg-white p-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#eef6f7] text-[#4f7c90]">
                <UserPlus size={16} />
              </div>

              <div>
                <h3 className="text-[13px] font-semibold text-[#142033]">Transferir conversación</h3>
                <p className="text-[11px] font-normal text-[#64748b]">
                  Cambia el vendedor responsable.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <LiveNosProfileSelect
                value={transferTargetId}
                placeholder="Elegir vendedor..."
                profiles={profiles}
                disabledIds={selectedConversation.assigned_to ? [selectedConversation.assigned_to] : []}
                onChange={setTransferTargetId}
              />

              <button
                type="button"
                onClick={transferConversationToSeller}
                disabled={actionLoading || !transferTargetId}
                className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-xl bg-[#4f7c90] text-xs font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
              >
                <UserCheck size={14} />
                Transferir
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-3.5">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-purple-50 text-purple-700">
                <Users size={16} />
              </div>

              <div>
                <h3 className="text-[13px] font-semibold text-[#142033]">Colaboración</h3>
                <p className="text-[11px] font-normal text-[#64748b]">
                  Sumá vendedores al seguimiento.
                </p>
              </div>
            </div>

            <div className="mt-3">
              <LiveNosProfileSelect
                value={collaborationTargetId}
                placeholder="Elegir colaborador..."
                profiles={profiles}
                disabledIds={[
                  selectedConversation.assigned_to || "",
                  ...selectedColaboradores.map((item) => item.profile_id)
                ].filter(Boolean)}
                onChange={setCollaborationTargetId}
              />

              <button
                type="button"
                onClick={addConversationCollaborator}
                disabled={actionLoading || !collaborationTargetId}
                className="mt-2 inline-flex h-8 w-full items-center justify-center gap-2 rounded-xl bg-purple-600 text-xs font-medium text-white shadow-sm hover:bg-purple-700 disabled:opacity-50"
              >
                <UserPlus size={14} />
                Agregar
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {selectedColaboradores.length === 0 ? (
                <div className="rounded-xl bg-[#f8fafc] p-3 text-[12px] font-normal text-[#94a3b8]">
                  Todavía no hay vendedores colaborando.
                </div>
              ) : (
                selectedColaboradores.map((colaborador) => (
                  <div
                    key={colaborador.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-[12px] font-medium text-[#142033]">
                        {getProfileFullName(colaborador.profile)}
                      </div>

                      <div className="text-[10px] font-normal text-[#94a3b8]">
                        Desde {formatDateTime(colaborador.created_at)}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeConversationCollaborator(colaborador)}
                      disabled={actionLoading}
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-red-600 shadow-sm ring-1 ring-black/5 hover:bg-red-50 disabled:opacity-50"
                      aria-label="Quitar colaborador"
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-black/10 bg-white p-3.5">
            <h3 className="text-[13px] font-semibold text-[#142033]">Tareas y programados</h3>

            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 p-3">
              <div className="mb-2 text-[12px] font-medium text-sky-800">
                Programar mensaje al cliente
              </div>

              <textarea
                value={scheduledText}
                onChange={(event) => setScheduledText(event.target.value)}
                placeholder="Mensaje a programar..."
                className="min-h-[76px] w-full resize-none rounded-xl border border-sky-200 bg-white px-3 py-2 text-[12px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8]"
              />

              <input
                type="datetime-local"
                value={scheduledFor}
                onChange={(event) => setScheduledFor(event.target.value)}
                className="mt-2 h-8 w-full rounded-xl border border-sky-200 bg-white px-3 text-[12px] font-normal text-[#142033] outline-none"
              />

              <button
                type="button"
                onClick={() => addTaskItem("programar_envio_cliente")}
                disabled={actionLoading || !scheduledText.trim()}
                className="mt-2 h-8 w-full rounded-xl bg-sky-400 text-xs font-medium text-white shadow-sm hover:bg-sky-500 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>

            <div className="mt-3 rounded-xl border border-purple-100 bg-purple-50 p-3">
              <div className="mb-2 text-[12px] font-medium text-purple-800">Recordatorio interno</div>

              <textarea
                value={reminderText}
                onChange={(event) => setReminderText(event.target.value)}
                placeholder="Recordatorio propio o del equipo..."
                className="min-h-[76px] w-full resize-none rounded-xl border border-purple-200 bg-white px-3 py-2 text-[12px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8]"
              />

              <input
                type="datetime-local"
                value={reminderFor}
                onChange={(event) => setReminderFor(event.target.value)}
                className="mt-2 h-8 w-full rounded-xl border border-purple-200 bg-white px-3 text-[12px] font-normal text-[#142033] outline-none"
              />

              <button
                type="button"
                onClick={() => addTaskItem("recordatorio")}
                disabled={actionLoading || !reminderText.trim()}
                className="mt-2 h-8 w-full rounded-xl bg-purple-400 text-xs font-medium text-white shadow-sm hover:bg-purple-500 disabled:opacity-50"
              >
                Guardar
              </button>
            </div>
          </section>
        </div>
      );
    }

    return (
      <section className="rounded-2xl border border-black/10 bg-[#f8fafc] p-3.5">
        <h3 className="text-[13px] font-semibold text-[#142033]">Historial interno</h3>

        <div className="mt-3 space-y-2">
          {notas.filter((nota) => nota.tipo !== "mensaje_interno" && nota.tipo !== "nota").length === 0 ? (
            <div className="text-[12px] font-normal text-[#94a3b8]">Sin tareas ni programaciones.</div>
          ) : (
            notas
              .filter((nota) => nota.tipo !== "mensaje_interno" && nota.tipo !== "nota")
              .slice()
              .reverse()
              .map((nota) => {
                const visual = getNotaVisual(nota);

                return (
                  <div key={nota.id} className={["rounded-xl border p-3", visual.bubbleClass].join(" ")}>
                    <div className="mb-1 flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.08em] opacity-70">
                      {visual.icon}
                      {visual.label}
                    </div>

                    <div className="text-[12px] font-normal leading-relaxed">{nota.contenido}</div>

                    {nota.scheduled_for ? (
                      <div className="mt-2 text-[10px] font-normal opacity-60">
                        Programado: {formatDateTime(nota.scheduled_for)}
                      </div>
                    ) : null}

                    <div className="mt-1 text-[10px] font-normal opacity-60">
                      Creado: {formatDateTime(nota.created_at)}
                    </div>
                  </div>
                );
              })
          )}
        </div>
      </section>
    );
  }

  return (
    <>
      {renderTemplateModal()}
      {renderNewConversationModal()}
      {renderMediaPreviewModal()}
      {renderCandeFeedbackModal()}

      <OportunidadDetalleModal
        open={opportunityModalOpen}
        oportunidad={selectedOportunidad}
        estados={pipeline}
        contacto={selectedContacto}
        conversacion={selectedConversation}
        onClose={() => setOpportunityModalOpen(false)}
        onCreateBudget={createBudgetFromOpportunity}
        onCreateCart={createCartFromOpportunity}
        onCreateFile={createFileFromOpportunity}
        onUseSuggestedReply={(text) => {
          setComposerText((current) => {
            if (!current.trim()) return text;
            return `${current.trim()}\n${text}`;
          });

          setOpportunityModalOpen(false);
        }}
      />

      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#eef3f6] text-[#142033]">
        <header className="shrink-0 border-b border-black/10 bg-white/86 px-5 py-3 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[18px] font-semibold tracking-tight text-[#142033]">LiveNos</h1>
                <Pill>WhatsApp</Pill>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <HeaderButton onClick={loadData} disabled={loading}>
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCcw size={14} />}
                Actualizar
              </HeaderButton>

              <HeaderButton onClick={syncWhatsappTemplates} disabled={templateSyncing}>
                {templateSyncing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                Plantillas
              </HeaderButton>

              <HeaderButton variant="primary" onClick={openNewConversationModal}>
                <MessageCircle size={14} />
                Nueva conversación
              </HeaderButton>
            </div>
          </div>

          {error ? (
            <div className="mt-3 flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-[12px] font-normal text-red-700">
              <span>{error}</span>
              <button type="button" onClick={() => setError(null)} className="text-red-500">
                <XCircle size={15} />
              </button>
            </div>
          ) : null}

          {status ? (
            <div className="pointer-events-none fixed right-6 top-[118px] z-[90]">
              <div className="pointer-events-auto flex max-w-[420px] items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-[12px] font-normal text-emerald-700 shadow-lg shadow-slate-900/8">
                <span className="line-clamp-2">{status}</span>

                <button
                  type="button"
                  onClick={() => setStatus(null)}
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-800"
                  aria-label="Cerrar aviso"
                >
                  <X size={13} strokeWidth={1.8} />
                </button>
              </div>
            </div>
          ) : null}
        </header>

        <main className="grid min-h-0 flex-1 grid-cols-[255px_325px_minmax(0,1fr)] gap-3 overflow-hidden p-3">
          <aside className="flex min-h-0 flex-col gap-3 overflow-hidden">
            <LiveNosSidebar
              activeInbox={activeInbox}
              inboxCounts={inboxCounts}
              profiles={profiles}
              onChangeInbox={setActiveInbox}
              onOpenNia={openNiaFromLiveNos}
            />
          </aside>

          <ConversationsColumn
            loading={loading}
            search={search}
            activeInbox={activeInbox}
            selectedId={selectedId}
            filteredConversations={filteredConversations}
            onSearchChange={setSearch}
            onSelectConversation={selectConversation}
          />

          <section className="flex min-h-0 flex-col overflow-hidden rounded-[22px] border border-black/10 bg-white/86 shadow-sm">
            {!selectedConversation ? (
              <div className="flex h-full items-center justify-center p-8">
                <EmptyState
                  title="Seleccioná una conversación"
                  subtitle="Acá vas a ver el chat, datos del pasajero y acciones."
                />
              </div>
            ) : (
              <>
                <div className="shrink-0 border-b border-black/10 bg-white px-4 py-3">
                  <div className="grid items-start gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
                    <div className="min-w-0">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#4f7c90] text-[12px] font-medium text-white">
                          {getInitials(getDisplayName(selectedContacto, selectedConversation))}
                        </div>

                        <div className="min-w-0 flex-1">
                          {editingContactName ? (
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                value={contactNameDraft}
                                onChange={(event) => setContactNameDraft(event.target.value)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    void saveContactDisplayName();
                                  }

                                  if (event.key === "Escape") {
                                    setEditingContactName(false);
                                    setContactNameDraft(getDisplayName(selectedContacto, selectedConversation));
                                  }
                                }}
                                className="h-8 min-w-[220px] rounded-xl border border-[#4f7c90]/30 bg-white px-3 text-[13px] font-normal text-[#142033] outline-none focus:border-[#4f7c90]"
                                autoFocus
                              />

                              <button
                                type="button"
                                onClick={saveContactDisplayName}
                                disabled={actionLoading}
                                className="h-8 rounded-xl bg-[#4f7c90] px-3 text-xs font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                              >
                                Guardar
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setEditingContactName(false);
                                  setContactNameDraft(getDisplayName(selectedContacto, selectedConversation));
                                }}
                                className="h-8 rounded-xl bg-[#f1f5f9] px-3 text-xs font-medium text-[#64748b] hover:bg-[#e2e8f0]"
                              >
                                Cancelar
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setContactNameDraft(getDisplayName(selectedContacto, selectedConversation));
                                setEditingContactName(true);
                              }}
                              className="group flex max-w-full items-center gap-2 text-left"
                            >
                              <h2 className="truncate text-[17px] font-semibold leading-tight text-[#142033]">
                                {getDisplayName(selectedContacto, selectedConversation)}
                              </h2>

                              <span className="rounded-full bg-[#f1f5f9] px-2 py-0.5 text-[10px] font-normal text-[#94a3b8] opacity-0 transition group-hover:opacity-100">
                                Editar
                              </span>
                            </button>
                          )}

                          <p className="mt-0.5 truncate text-[12px] font-normal text-[#64748b]">
                            {selectedConversation.wa_phone} · {selectedConversation.channel}
                            {selectedContacto?.profile_name ? ` · WhatsApp: ${selectedContacto.profile_name}` : ""}
                          </p>

                          <div className="mt-1.5 flex max-w-full flex-nowrap items-center gap-1 overflow-hidden">
                            <span className="shrink-0">
                              <StatusPill conv={selectedConversation} />
                            </span>

                            <span className="shrink-0">
                              <Pill>{getVendedorName(selectedVendedor)}</Pill>
                            </span>

                            <span className="shrink-0">
                              <Pill>{getWindowRemainingLabel(selectedConversation)}</Pill>
                            </span>

                            {selectedOportunidad ? (
                              <span className="shrink-0">
                                <Pill>Score {selectedOportunidad.score}</Pill>
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-start justify-start gap-2 xl:max-w-[560px] xl:justify-end">
                      {!selectedConversation.assigned_to ? (
                        <HeaderButton onClick={takeConversation} disabled={actionLoading} variant="primary">
                          <UserCheck size={14} />
                          Tomar
                        </HeaderButton>
                      ) : null}

                      <HeaderButton onClick={toggleCande} disabled={actionLoading || !selectedOportunidad}>
                        <Bot size={14} />
                        {selectedOportunidad?.cande_activa ? "Pausar Cande" : "Activar Cande"}
                      </HeaderButton>

                      {selectedConversation.archived_at ||
                      selectedConversation.deleted_at ||
                      selectedConversation.closed_at ? (
                        <HeaderButton onClick={restoreConversation} disabled={actionLoading}>
                          <RefreshCcw size={14} />
                          Restaurar
                        </HeaderButton>
                      ) : (
                        <>
                          <HeaderButton
                            onClick={() => setOpportunityModalOpen(true)}
                            disabled={!selectedOportunidad}
                          >
                            <Sparkles size={14} />
                            Ver oportunidad
                          </HeaderButton>

                          <HeaderButton onClick={closeConversation} disabled={actionLoading}>
                            <CheckCircle2 size={14} />
                            Cerrar
                          </HeaderButton>

                          <HeaderButton onClick={archiveConversation} disabled={actionLoading}>
                            <Archive size={14} />
                            Archivar
                          </HeaderButton>

                          <HeaderButton onClick={deleteConversation} disabled={actionLoading} variant="danger">
                            <Trash2 size={14} />
                            Eliminar
                          </HeaderButton>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_330px] overflow-hidden">
                  <div
                    className="relative flex min-h-0 flex-col overflow-hidden"
                    onDragOver={handleChatDragOver}
                    onDragLeave={handleChatDragLeave}
                    onDrop={handleChatDrop}
                  >
                    {isDraggingFile ? (
                      <div className="pointer-events-none absolute inset-3 z-40 flex items-center justify-center rounded-2xl border-2 border-dashed border-[#4f7c90]/50 bg-[#eef6f7]/85 backdrop-blur-sm">
                        <div className="rounded-2xl bg-white px-6 py-5 text-center shadow-xl ring-1 ring-black/10">
                          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-[#eef6f7] text-[#4f7c90]">
                            <Paperclip size={24} />
                          </div>

                          <div className="text-[13px] font-semibold text-[#142033]">
                            Soltá el archivo para adjuntarlo
                          </div>

                          <div className="mt-1 text-[12px] font-normal text-[#64748b]">
                            Imágenes, audios o documentos.
                          </div>
                        </div>
                      </div>
                    ) : null}

                    <div
                      ref={timelineRef}
                      onScroll={updateStickToBottom}
                      className="min-h-0 flex-1 space-y-3 overflow-auto bg-[linear-gradient(180deg,#eef7f8,#e8f0f2)] px-5 py-4"
                      onClick={() => {
                        if (openMessageMenuId) setOpenMessageMenuId(null);
                      }}
                    >
                      {timeline.length === 0 ? (
                        <EmptyState title="Sin mensajes" subtitle="No hay actividad cargada para esta conversación." />
                      ) : (
                        timeline.map((item) => renderTimelineItem(item))
                      )}
                    </div>

                    <div className="relative z-20 shrink-0 border-t border-black/10 bg-white p-3">
                      {replyToMessage ? (
                        <div className="mb-2 flex items-start justify-between gap-3 rounded-xl border border-[#4f7c90]/20 bg-[#eef6f7] px-3 py-2">
                          <div className="min-w-0">
                            <div className="text-[10px] font-medium uppercase tracking-[0.08em] text-[#4f7c90]">
                              Respondiendo
                            </div>
                            <div className="truncate text-[12px] font-normal text-[#142033]">
                              {replyToMessage.text || `[${replyToMessage.type}]`}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => setReplyToMessage(null)}
                            className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-[#64748b] hover:bg-white"
                          >
                            Cancelar
                          </button>
                        </div>
                      ) : null}

                      <input
                        ref={fileInputRef}
                        type="file"
                        className="hidden"
                        onChange={(event) => handleSelectedFile(event.target.files?.[0] || null, "file")}
                      />

                      <input
                        ref={imageInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleSelectedFile(event.target.files?.[0] || null, "image")}
                      />

                      {pendingAttachment ? (
                        <div className="mb-2 rounded-xl border border-[#4f7c90]/20 bg-[#eef6f7] p-2.5">
                          <div className="flex items-center gap-3">
                            {pendingAttachment.kind === "image" && pendingAttachment.previewUrl ? (
                              <img
                                src={pendingAttachment.previewUrl}
                                alt={pendingAttachment.file.name}
                                className="h-12 w-12 rounded-xl object-cover"
                              />
                            ) : pendingAttachment.kind === "audio" && pendingAttachment.previewUrl ? (
                              <div className="min-w-0 flex-1 rounded-xl bg-white p-2.5">
                                <div className="mb-2 text-[12px] font-medium text-[#142033]">
                                  {pendingAttachment.file.name}
                                </div>
                                <audio controls className="w-full" src={pendingAttachment.previewUrl} />
                              </div>
                            ) : (
                              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-[#4f7c90]">
                                <FileText size={22} />
                              </div>
                            )}

                            {pendingAttachment.kind !== "audio" ? (
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[13px] font-medium text-[#142033]">
                                  {pendingAttachment.file.name}
                                </div>

                                <div className="text-[11px] font-normal text-[#64748b]">
                                  {pendingAttachment.kind === "image" ? "Imagen" : "Archivo"} ·{" "}
                                  {formatFileSize(pendingAttachment.file.size)}
                                </div>
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={clearPendingAttachment}
                              className="rounded-lg bg-white px-3 py-2 text-xs font-medium text-[#64748b] hover:bg-[#f8fafc]"
                            >
                              Quitar
                            </button>
                          </div>
                        </div>
                      ) : null}

                      <div className="flex items-center gap-2">
                        <ComposerIconButton
                          title="Emojis"
                          active={showEmojiPanel}
                          onClick={() => {
                            setShowEmojiPanel((current) => !current);
                            setShowQuickRepliesPanel(false);
                          }}
                        >
                          <Smile size={18} />
                        </ComposerIconButton>

                        <ComposerIconButton
                          title="Respuestas rápidas"
                          active={showQuickRepliesPanel}
                          onClick={() => {
                            setShowQuickRepliesPanel((current) => !current);
                            setShowEmojiPanel(false);
                          }}
                        >
                          <MessageCircle size={18} />
                        </ComposerIconButton>

                        <ComposerIconButton title="Acción rápida / IA" onClick={openNiaFromLiveNos}>
                          <Wand2 size={18} />
                        </ComposerIconButton>

                        <ComposerIconButton title="Enviar imagen" onClick={() => handleFileButtonClick("image")}>
                          <Image size={18} />
                        </ComposerIconButton>

                        <ComposerIconButton title="Adjuntar archivo" onClick={() => handleFileButtonClick("file")}>
                          <Paperclip size={18} />
                        </ComposerIconButton>

                        <div className="relative min-w-0 flex-1">
                          {showEmojiPanel ? (
                            <div className="fixed bottom-[164px] left-[520px] z-[9999] w-[420px] rounded-[18px] border border-black/10 bg-white p-3 shadow-2xl">
                              <div className="mb-2 flex items-center justify-between">
                                <div className="text-[12px] font-semibold text-[#142033]">Emoticones</div>

                                <button
                                  type="button"
                                  onClick={() => setShowEmojiPanel(false)}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-[#94a3b8] hover:bg-[#f1f5f9]"
                                >
                                  Cerrar
                                </button>
                              </div>

                              <div className="space-y-3">
                                {EMOJI_GROUPS.map((group) => (
                                  <div key={group.label}>
                                    <div className="mb-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                                      {group.label}
                                    </div>

                                    <div className="grid grid-cols-12 gap-1">
                                      {group.emojis.map((emoji) => (
                                        <button
                                          key={`${group.label}-${emoji}`}
                                          type="button"
                                          onClick={() => {
                                            setComposerText((current) => `${current}${emoji}`);
                                          }}
                                          className="flex h-7 w-7 items-center justify-center rounded-lg text-[17px] hover:bg-[#f1f5f9]"
                                        >
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {showQuickRepliesPanel ? (
                            <div className="fixed bottom-[164px] left-[520px] z-[9999] w-[440px] rounded-[18px] border border-black/10 bg-white p-3 shadow-2xl">
                              <div className="mb-3 flex items-center justify-between gap-3">
                                <div>
                                  <div className="text-[12px] font-semibold text-[#142033]">
                                    Respuestas rápidas
                                  </div>
                                  <div className="text-[10px] font-normal text-[#94a3b8]">
                                    Insertan texto en el mensaje.
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => setShowQuickRepliesPanel(false)}
                                  className="rounded-lg px-2 py-1 text-xs font-medium text-[#94a3b8] hover:bg-[#f1f5f9]"
                                >
                                  Cerrar
                                </button>
                              </div>

                              <input
                                value={quickReplySearch}
                                onChange={(event) => setQuickReplySearch(event.target.value)}
                                placeholder="Buscar respuesta..."
                                className="mb-3 h-9 w-full rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-[12px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                              />

                              <div className="max-h-[220px] space-y-2 overflow-auto pr-1">
                                {filteredQuickReplies.length === 0 ? (
                                  <div className="rounded-xl bg-[#f8fafc] p-3 text-[12px] font-normal text-[#94a3b8]">
                                    No hay respuestas rápidas.
                                  </div>
                                ) : (
                                  filteredQuickReplies.map((reply) => (
                                    <button
                                      key={reply.id}
                                      type="button"
                                      onClick={() => insertQuickReply(reply)}
                                      className="w-full rounded-xl border border-black/10 bg-white p-3 text-left hover:border-[#4f7c90]/40 hover:bg-[#f8fbfc]"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                          <div className="truncate text-[12px] font-medium text-[#142033]">
                                            {reply.titulo}
                                          </div>

                                          <div className="mt-1 line-clamp-2 text-[11px] font-normal leading-relaxed text-[#64748b]">
                                            {reply.contenido}
                                          </div>
                                        </div>

                                        {reply.categoria ? (
                                          <span className="shrink-0 rounded-full bg-[#eef6f7] px-2 py-1 text-[9px] font-medium uppercase tracking-wide text-[#4f7c90]">
                                            {reply.categoria}
                                          </span>
                                        ) : null}
                                      </div>
                                    </button>
                                  ))
                                )}
                              </div>

                              <div className="mt-3 rounded-xl border border-dashed border-black/10 bg-[#f8fafc] p-3">
                                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.08em] text-[#94a3b8]">
                                  Crear nueva
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    value={quickReplyTitle}
                                    onChange={(event) => setQuickReplyTitle(event.target.value)}
                                    placeholder="Título"
                                    className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-normal outline-none"
                                  />

                                  <input
                                    value={quickReplyCategory}
                                    onChange={(event) => setQuickReplyCategory(event.target.value)}
                                    placeholder="Categoría"
                                    className="h-8 rounded-lg border border-black/10 bg-white px-3 text-[12px] font-normal outline-none"
                                  />
                                </div>

                                <textarea
                                  value={quickReplyContent}
                                  onChange={(event) => setQuickReplyContent(event.target.value)}
                                  placeholder="Texto de la respuesta rápida..."
                                  className="mt-2 min-h-[62px] w-full resize-none rounded-lg border border-black/10 bg-white px-3 py-2 text-[12px] font-normal outline-none"
                                />

                                <button
                                  type="button"
                                  onClick={createQuickReply}
                                  disabled={actionLoading || !quickReplyTitle.trim() || !quickReplyContent.trim()}
                                  className="mt-2 h-8 w-full rounded-lg bg-[#4f7c90] text-xs font-medium text-white hover:bg-[#406b7d] disabled:opacity-50"
                                >
                                  Guardar respuesta
                                </button>
                              </div>
                            </div>
                          ) : null}

                          <input
                            value={composerText}
                            onPaste={handleComposerPaste}
                            onChange={(event) => {
                              const value = event.target.value;
                              setComposerText(value);

                              if (value.endsWith("/")) {
                                setShowQuickRepliesPanel(true);
                                setShowEmojiPanel(false);
                              }
                            }}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void sendLocalMessage();
                              }

                              if (event.key === "Escape") {
                                setShowEmojiPanel(false);
                                setShowQuickRepliesPanel(false);
                              }
                            }}
                            placeholder={
                              pendingAttachment
                                ? "Comentario opcional..."
                                : "Escribí un mensaje al pasajero"
                            }
                            className="h-10 w-full rounded-full border border-black/10 bg-white px-4 text-[13px] font-normal text-[#142033] outline-none placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={composerText.trim() || pendingAttachment ? sendLocalMessage : handleMicButtonClick}
                          disabled={actionLoading}
                          className={[
                            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
                            audioRecording
                              ? "animate-pulse bg-red-500 hover:bg-red-600"
                              : "bg-[#4f7c90] hover:bg-[#406b7d]"
                          ].join(" ")}
                          aria-label={
                            composerText.trim() || pendingAttachment
                              ? "Enviar por WhatsApp"
                              : audioRecording
                                ? "Detener grabación"
                                : "Grabar audio"
                          }
                        >
                          {actionLoading ? (
                            <Loader2 size={17} className="animate-spin" />
                          ) : composerText.trim() || pendingAttachment ? (
                            <Send size={18} />
                          ) : audioRecording ? (
                            <span className="h-3 w-3 rounded-sm bg-white" />
                          ) : (
                            <Mic size={18} />
                          )}
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <button
                          type="button"
                          onClick={handleTemplateButton}
                          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-normal text-[#64748b] hover:bg-[#f8fafc] hover:text-[#142033]"
                        >
                          <FileText size={13} />
                          Plantilla
                        </button>

                        <button
                          type="button"
                          onClick={() => setShowAgentName((current) => !current)}
                          className={[
                            "rounded-full px-3 py-1 text-[11px] font-normal",
                            showAgentName
                              ? "bg-[#eaf7f1] text-[#4f7c90]"
                              : "bg-[#f1f5f9] text-[#64748b]"
                          ].join(" ")}
                        >
                          {showAgentName ? "Nombre agente visible" : "Nombre agente oculto"}
                        </button>
                      </div>

                      <div className="mt-2 border-t border-dashed border-amber-200 pt-2">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-700">
                            <MessageCircle size={16} />
                          </div>

                          <input
                            value={internalText}
                            onChange={(event) => setInternalText(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void sendInternalMessage();
                              }
                            }}
                            placeholder="Mensaje interno para el equipo..."
                            className="h-8 min-w-0 flex-1 rounded-full border border-amber-200 bg-amber-50 px-3 text-[12px] font-normal text-[#142033] outline-none placeholder:text-[#b69362] focus:border-amber-300"
                          />

                          <button
                            type="button"
                            onClick={sendInternalMessage}
                            disabled={actionLoading || !internalText.trim()}
                            className="h-8 rounded-full bg-amber-300 px-3 text-[11px] font-medium text-white shadow-sm hover:bg-amber-400 disabled:opacity-50"
                          >
                            Interno
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <aside className="min-h-0 overflow-auto border-l border-black/10 bg-white p-3">
                    <RightPanelTabs rightTab={rightTab} onChangeTab={setRightTab} />

                    <div className="mt-3">{renderRightPanelContent()}</div>
                  </aside>
                </div>
              </>
            )}
          </section>
        </main>
      </div>
    </>
  );
}

export default LiveNosPanel;