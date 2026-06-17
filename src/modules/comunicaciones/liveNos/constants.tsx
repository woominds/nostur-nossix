import type { ReactNode } from "react";
import {
  Archive,
  Bot,
  CheckCircle2,
  Inbox,
  Trash2,
  UserCheck,
  Users
} from "lucide-react";
import type { InboxKey } from "./types";

export const INBOXES: {
  id: InboxKey;
  label: string;
  description: string;
  icon: ReactNode;
  alertTone?: "amber" | "none";
}[] = [
  {
    id: "en_gestion",
    label: "En gestión",
    description: "Conversaciones tomadas por vendedores.",
    icon: <UserCheck size={15} />
  },
  {
    id: "sin_atender",
    label: "Sin atender",
    description: "Conversaciones nuevas o derivadas por Cande.",
    icon: <Inbox size={15} />,
    alertTone: "amber"
  },
  {
    id: "cande",
    label: "Cande",
    description: "Oportunidades con IA activa.",
    icon: <Bot size={15} />
  },
  {
    id: "colaboracion",
    label: "Colaboración",
    description: "Conversaciones con participantes internos.",
    icon: <Users size={15} />
  },
  {
    id: "cerradas",
    label: "Cerradas",
    description: "Conversaciones resueltas.",
    icon: <CheckCircle2 size={15} />
  },
  {
    id: "archivadas",
    label: "Archivadas",
    description: "Historial operativo.",
    icon: <Archive size={15} />
  },
  {
    id: "eliminadas",
    label: "Eliminadas",
    description: "Eliminación lógica.",
    icon: <Trash2 size={15} />
  }
];

export const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "🙏", "👏"];

export const EMOJI_GROUPS = [
  {
    label: "Frecuentes",
    emojis: ["😊", "😉", "👍", "🙏", "👏", "💪", "🙌", "👌", "✨", "✅", "📌", "🧳"]
  },
  {
    label: "Viajes",
    emojis: ["✈️", "🏝️", "🏖️", "🏨", "🚢", "🛳️", "🗺️", "🌎", "🧭", "🎒", "🛫", "🛬"]
  },
  {
    label: "Atención",
    emojis: ["📲", "📩", "📄", "💳", "💵", "🕐", "📅", "🔎", "⭐", "🔥", "🎯", "💬"]
  }
];