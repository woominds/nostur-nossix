// src/modules/comunicaciones/liveNos/ui.tsx

import type { ReactNode } from "react";
import {
  Bell,
  CalendarClock,
  Clock3,
  FileText,
  Loader2,
  Search,
  Sparkles
} from "lucide-react";
import { EmptyState, Pill } from "../comunicacionesShared";
import type {
  ConversationVM,
  InboxKey,
  Mensaje,
  NotaConversacion,
  ProfileLite,
  RightTab
} from "./types";
import { INBOXES } from "./constants";
import {
  formatDateTime,
  getDisplayName,
  getInitials,
  getVendedorName,
  isWindowOpen
} from "./helpers";

function SoftTooltip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-[36px] z-[9999] -translate-x-1/2 translate-y-1 opacity-0 transition duration-150 group-hover/tooltip:translate-y-0 group-hover/tooltip:opacity-100">
      <span className="whitespace-nowrap rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[11px] font-normal text-[#334155] shadow-lg">
        {text}
      </span>
    </span>
  );
}

export function StatusPill({ conv }: { conv: ConversationVM }) {
  if (conv.deleted_at) return <Pill>Eliminada</Pill>;
  if (conv.archived_at) return <Pill>Archivada</Pill>;
  if (conv.closed_at) return <Pill>Cerrada</Pill>;
  if (conv.estado_gestion === "sin_atender" || !conv.assigned_to) return <Pill>Sin atender</Pill>;

  if (conv.colaboradores && conv.colaboradores.length > 0) {
    return <Pill>Colaboración</Pill>;
  }

  if (conv.oportunidad?.cande_activa) return <Pill>Cande activa</Pill>;
  if (conv.assigned_to) return <Pill>En gestión</Pill>;

  return <Pill>Abierta</Pill>;
}

export function HeaderButton({
  children,
  onClick,
  disabled = false,
  variant = "default"
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "danger";
}) {
  const className =
    variant === "primary"
      ? "bg-[#4f7c90] text-white hover:bg-[#456f82]"
      : variant === "danger"
        ? "bg-red-50 text-red-600 hover:bg-red-100"
        : "bg-white text-[#334155] hover:bg-[#f8fafc]";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "inline-flex h-8 items-center justify-center gap-1.5 rounded-xl px-3 text-[11.5px] font-medium shadow-sm ring-1 ring-black/5 transition disabled:cursor-not-allowed disabled:opacity-50",
        className
      ].join(" ")}
    >
      {children}
    </button>
  );
}

export function ComposerIconButton({
  children,
  tooltip,
  title,
  onClick,
  disabled = false,
  active = false
}: {
  children: ReactNode;
  tooltip?: string;
  title?: string;
  onClick?: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  const finalTooltip = tooltip || title || "";

  return (
    <button
      type="button"
      aria-label={finalTooltip}
      onClick={onClick}
      disabled={disabled}
      className={[
        "group/tooltip relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[#64748b] shadow-sm transition disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-[#4f7c90]/25 bg-[#eef6f7] text-[#4f7c90]"
          : "border-black/10 bg-white hover:border-[#4f7c90]/30 hover:bg-[#f8fafc] hover:text-[#4f7c90]"
      ].join(" ")}
    >
      {children}
      {finalTooltip ? <SoftTooltip text={finalTooltip} /> : null}
    </button>
  );
}

export function getVisualMessageStatus(message: Mensaje): string {
  if (message.status === "pending" && message.wa_message_id) return "sent";
  return message.status || "pending";
}

export function MessageStatusIcon({ message }: { message: Mensaje }) {
  const status = getVisualMessageStatus(message);

  if (status === "pending") {
    return (
      <span aria-label="Pendiente de envío" className="inline-flex items-center text-white/55">
        <Clock3 size={11} strokeWidth={2.2} />
      </span>
    );
  }

  if (status === "sent") {
    return (
      <span aria-label="Enviado" className="inline-flex items-center text-[12px] font-semibold leading-none text-white/75">
        ✓
      </span>
    );
  }

  if (status === "delivered") {
    return (
      <span aria-label="Entregado" className="inline-flex items-center text-[12px] font-semibold leading-none tracking-[-0.18em] text-white/85">
        ✓✓
      </span>
    );
  }

  if (status === "read") {
    return (
      <span aria-label="Leído" className="inline-flex items-center text-[12px] font-semibold leading-none tracking-[-0.18em] text-[#38d5ff]">
        ✓✓
      </span>
    );
  }

  if (status === "failed") {
    return (
      <span
        aria-label={message.error || "Error de envío"}
        className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-100 px-1 text-[10px] font-semibold text-red-700"
      >
        !
      </span>
    );
  }

  return null;
}

export function getNotaVisual(nota: NotaConversacion) {
  if (nota.tipo === "programar_envio_cliente") {
    return {
      label: "Mensaje programado",
      icon: <CalendarClock size={13} />,
      bubbleClass: "border-sky-200 bg-sky-50 text-sky-950",
      chipClass: "bg-sky-100 text-sky-700"
    };
  }

  if (nota.tipo === "recordatorio") {
    return {
      label: "Recordatorio interno",
      icon: <Bell size={13} />,
      bubbleClass: "border-purple-200 bg-purple-50 text-purple-950",
      chipClass: "bg-purple-100 text-purple-700"
    };
  }

  return {
    label: "Mensaje interno",
    icon: <FileText size={13} />,
    bubbleClass: "border-amber-200 bg-amber-50 text-amber-950",
    chipClass: "bg-amber-100 text-amber-700"
  };
}

export function ConversationCard({
  conv,
  selectedId,
  onSelect
}: {
  conv: ConversationVM;
  selectedId: string | null;
  onSelect: (id: string) => void | Promise<void>;
}) {
  const name = getDisplayName(conv.contacto, conv);
  const active = conv.id === selectedId;
  const vendedor = getVendedorName(conv.vendedor);
  const score = conv.oportunidad?.score || 0;
  const colaboradoresCount = conv.colaboradores?.length || 0;

  return (
    <button
      key={conv.id}
      type="button"
      onClick={() => {
        void onSelect(conv.id);
      }}
      className={[
        "w-full rounded-[16px] border px-3 py-2.5 text-left transition",
        active
          ? "border-[#4f7c90]/38 bg-[#eef6f7] shadow-sm"
          : "border-transparent bg-white hover:border-black/10 hover:bg-[#f8fbfc]"
      ].join(" ")}
    >
      <div className="flex items-start gap-2.5">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#4f7c90] text-[10.5px] font-semibold text-white">
          {getInitials(name)}

          {conv.unread_count > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ff2f76] px-1 text-[9px] font-semibold text-white">
              {conv.unread_count > 9 ? "9+" : conv.unread_count}
            </span>
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="truncate text-[13px] font-semibold leading-tight text-[#172033]">
              {name}
            </div>

            <div className="shrink-0 text-[10px] font-normal text-[#94a3b8]">
              {formatDateTime(conv.last_message_at || conv.updated_at)}
            </div>
          </div>

          <div className="mt-1 line-clamp-2 text-[11.5px] font-normal leading-snug text-[#64748b]">
            {conv.last_message_preview || "Sin mensajes todavía"}
          </div>

          <div className="mt-1.5 flex flex-wrap gap-1">
            <StatusPill conv={conv} />
            <Pill>{vendedor}</Pill>
            {colaboradoresCount > 0 ? <Pill>{colaboradoresCount} colab.</Pill> : null}
            {score > 0 ? <Pill>Score {score}</Pill> : null}
            {isWindowOpen(conv) ? <Pill>24h abierta</Pill> : <Pill>24h cerrada</Pill>}
          </div>
        </div>
      </div>
    </button>
  );
}

export function InboxList({
  activeInbox,
  inboxCounts,
  onChangeInbox
}: {
  activeInbox: InboxKey;
  inboxCounts: Record<InboxKey, number>;
  onChangeInbox: (inbox: InboxKey) => void;
}) {
  return (
    <section className="min-h-0 flex-1 overflow-auto rounded-[18px] border border-black/10 bg-white/78 p-2 shadow-sm">
      <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
        Bandejas
      </div>

      <div className="space-y-1">
        {INBOXES.map((inbox) => {
          const count = inboxCounts[inbox.id] || 0;
          const active = activeInbox === inbox.id;
          const amberAlert = inbox.id === "sin_atender" && count > 0 && !active;

          return (
            <button
              key={inbox.id}
              type="button"
              onClick={() => onChangeInbox(inbox.id)}
              className={[
                "flex h-8 w-full items-center gap-2 rounded-xl px-2 text-left transition",
                active
                  ? "bg-[#4f7c90] text-white shadow-sm"
                  : amberAlert
                    ? "border border-amber-300 bg-amber-50 text-amber-900 shadow-sm"
                    : "text-[#475569] hover:bg-[#eef6f7] hover:text-[#172033]"
              ].join(" ")}
            >
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {inbox.icon}
              </span>

              <span className="min-w-0 flex-1 truncate text-[11.5px] font-medium">
                {inbox.label}
              </span>

              <span
                className={[
                  "flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-medium",
                  active
                    ? "bg-white/20 text-white"
                    : amberAlert
                      ? "bg-amber-400 text-white"
                      : "bg-[#eef2f7] text-[#475569]"
                ].join(" ")}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export function SellersList({ profiles }: { profiles: ProfileLite[] }) {
  return (
    <section className="shrink-0 rounded-[18px] border border-black/10 bg-white/78 p-2 shadow-sm">
      <div className="mb-2 px-1 text-[10px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
        Vendedores
      </div>

      <div className="space-y-0.5">
        {profiles.map((profile) => (
          <div
            key={profile.id}
            className="flex h-7 items-center gap-2 rounded-lg px-2 text-[11.5px] font-normal text-[#475569]"
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: profile.color || "#4f7c90" }}
            />
            <span className="truncate">{getVendedorName(profile)}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function NiaSidebarCard({ onOpenNia }: { onOpenNia: () => void }) {
  return (
    <section className="rounded-[18px] border border-black/10 bg-white/78 p-2.5 shadow-sm">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[#ff2f76] to-[#8b2cff] text-white shadow-sm">
          <Sparkles size={15} />
        </div>

        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold leading-tight text-[#172033]">
            NIA interno
          </div>

          <div className="truncate text-[10.5px] font-normal text-[#64748b]">
            Resúmenes y acciones
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenNia}
        className="mt-2.5 h-8 w-full rounded-xl bg-[#7c3aed] text-[11.5px] font-medium text-white shadow-sm hover:bg-[#6d28d9]"
      >
        Abrir NIA
      </button>
    </section>
  );
}

export function ConversationsColumn({
  loading,
  search,
  activeInbox,
  selectedId,
  filteredConversations,
  onSearchChange,
  onSelectConversation
}: {
  loading: boolean;
  search: string;
  activeInbox: InboxKey;
  selectedId: string | null;
  filteredConversations: ConversationVM[];
  onSearchChange: (value: string) => void;
  onSelectConversation: (id: string) => void | Promise<void>;
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-[18px] border border-black/10 bg-white/78 shadow-sm">
      <div className="shrink-0 border-b border-black/10 p-2.5">
        <div className="flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-2.5">
          <Search size={14} className="text-[#94a3b8]" />

          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Buscar conversación..."
            className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
          />
        </div>

        <div className="mt-1.5 text-[11px] font-normal text-[#64748b]">
          {filteredConversations.length} conversaciones ·{" "}
          {INBOXES.find((item) => item.id === activeInbox)?.label}
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-auto p-2.5">
        {loading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 size={20} className="animate-spin text-[#4f7c90]" />
          </div>
        ) : filteredConversations.length === 0 ? (
          <EmptyState title="Sin conversaciones" subtitle="Cuando ingresen mensajes por WhatsApp aparecerán acá." />
        ) : (
          filteredConversations.map((conv) => (
            <ConversationCard
              key={conv.id}
              conv={conv}
              selectedId={selectedId}
              onSelect={onSelectConversation}
            />
          ))
        )}
      </div>
    </section>
  );
}

export function RightPanelTabs({
  rightTab,
  onChangeTab
}: {
  rightTab: RightTab;
  onChangeTab: (tab: RightTab) => void;
}) {
  const tabs: { id: RightTab; label: string }[] = [
    { id: "info", label: "Datos" },
    { id: "tareas", label: "Tareas" },
    { id: "historial", label: "Historial" }
  ];

  return (
    <div className="grid grid-cols-3 gap-1 rounded-xl bg-[#f1f5f9] p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChangeTab(tab.id)}
          className={[
            "rounded-lg px-2 py-1.5 text-[10.5px] font-medium transition",
            rightTab === tab.id
              ? "bg-white text-[#4f7c90] shadow-sm"
              : "text-[#64748b] hover:text-[#172033]"
          ].join(" ")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export function LiveNosSidebar({
  activeInbox,
  inboxCounts,
  profiles,
  onChangeInbox,
  onOpenNia
}: {
  activeInbox: InboxKey;
  inboxCounts: Record<InboxKey, number>;
  profiles: ProfileLite[];
  onChangeInbox: (inbox: InboxKey) => void;
  onOpenNia: () => void;
}) {
  return (
    <aside className="flex min-h-0 flex-col gap-2.5 overflow-hidden">
      <NiaSidebarCard onOpenNia={onOpenNia} />

      <InboxList activeInbox={activeInbox} inboxCounts={inboxCounts} onChangeInbox={onChangeInbox} />

      <SellersList profiles={profiles} />
    </aside>
  );
}