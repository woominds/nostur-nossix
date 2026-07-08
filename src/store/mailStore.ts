// src/store/mailStore.ts

import { create } from "zustand";
import { supabase } from "../lib/supabase";

export type MailAddress = {
  email: string;
  name?: string | null;
};

export type MailIdentity = {
  identity_id: string;
  account_id: string | null;
  nombre: string | null;
  email: string;
  reply_to: string | null;
  firma_html: string | null;
  firma_texto: string | null;
  smtp_username: string | null;
  imap_username: string | null;
  send_enabled: boolean;
  sync_enabled: boolean;
};

export type MailThread = {
  thread_id: string;
  account_id: string | null;
  identity_id: string | null;
  account_email: string | null;
  profile_id: string | null;
  identity_nombre: string | null;
  identity_email: string | null;

  subject: string | null;
  estado: string | null;
  prioridad: string | null;

  messages_count: number;
  unread_count: number;

  last_message_at: string | null;
  last_from_email: string | null;
  last_from_name: string | null;
  last_snippet: string | null;

  last_message_id: string | null;
  last_message_direction: string | null;
  last_message_status: string | null;
  last_message_to_emails: MailAddress[] | null;
  last_message_has_attachments: boolean | null;
  last_message_created_at: string | null;

  is_archived: boolean;
  is_starred: boolean;

  related_type: string | null;
  related_id: string | null;
  contacto_id: string | null;
  cliente_id: string | null;
  carrito_id: string | null;
  file_id: string | null;
  presupuesto_id: string | null;
  conversacion_id: string | null;

  sucursal_id: string | null;
  assigned_to: string | null;

  created_at: string | null;
  updated_at: string | null;
};

export type MailMessage = {
  message_id: string;
  thread_id: string | null;
  account_id: string | null;
  identity_id: string | null;

  account_email: string | null;
  profile_id: string | null;
  identity_nombre: string | null;
  identity_email: string | null;

  thread_subject: string | null;
  thread_estado: string | null;
  thread_prioridad: string | null;

  direction: "INBOUND" | "OUTBOUND" | string;
  status: string | null;

  provider_message_id: string | null;
  message_id_header: string | null;
  in_reply_to: string | null;
  references_header: string | null;

  subject: string | null;

  from_email: string | null;
  from_name: string | null;

  to_emails: MailAddress[] | null;
  cc_emails: MailAddress[] | null;
  bcc_emails: MailAddress[] | null;
  reply_to_emails: MailAddress[] | null;

  body_text: string | null;
  body_html: string | null;
  snippet: string | null;

  has_attachments: boolean | null;
  attachments: unknown[] | null;

  sent_at: string | null;
  received_at: string | null;
  read_at: string | null;
  archived_at: string | null;

  provider_payload: Record<string, unknown> | null;

  related_type: string | null;
  related_id: string | null;
  contacto_id: string | null;
  cliente_id: string | null;
  carrito_id: string | null;
  file_id: string | null;
  presupuesto_id: string | null;
  conversacion_id: string | null;

  sucursal_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  updated_by: string | null;

  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MailboxSummary = {
  mailbox_id: string;
  account_id: string | null;
  identity_id: string | null;
  account_email: string | null;
  profile_id: string | null;
  identity_nombre: string | null;
  identity_email: string | null;

  codigo: string | null;
  nombre: string | null;
  tipo: string | null;
  remote_path: string | null;
  activa: boolean | null;

  messages_count: number;
  unread_count: number;
  inbound_count: number;
  outbound_count: number;
  last_message_at: string | null;

  provider_total_count: number | null;
  provider_unread_count: number | null;

  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type MailUserFolder = {
  id: string;
  user_id: string;
  name: string;
  parent_id: string | null;
  color: string | null;
  icon: string | null;
  position: number;
  is_archived: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type MailRule = {
  id: string;
  user_id: string;
  name: string;
  enabled: boolean;
  priority: number;
  match_type: "all" | "any" | string;
  from_contains: string | null;
  from_equals: string | null;
  subject_contains: string | null;
  body_contains: string | null;
  to_contains: string | null;
  has_attachment: boolean | null;
  folder_id: string | null;
  remove_from_inbox: boolean;
  mark_as_read: boolean;
  star: boolean;
  notify: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type MailDraft = {
  draft_id: string;
  thread_id: string | null;
  account_id: string | null;
  identity_id: string | null;
  outbox_id: string | null;

  account_email: string | null;
  profile_id: string | null;
  identity_nombre: string | null;
  identity_email: string | null;

  thread_subject: string | null;
  thread_estado: string | null;
  thread_prioridad: string | null;

  status: string | null;

  from_email: string | null;
  from_name: string | null;

  to_emails: MailAddress[] | null;
  cc_emails: MailAddress[] | null;
  bcc_emails: MailAddress[] | null;
  reply_to_emails: MailAddress[] | null;

  subject: string | null;
  body_text: string | null;
  body_html: string | null;
  attachments: unknown[] | null;

  related_type: string | null;
  related_id: string | null;
  contacto_id: string | null;
  cliente_id: string | null;
  carrito_id: string | null;
  file_id: string | null;
  presupuesto_id: string | null;
  conversacion_id: string | null;

  sucursal_id: string | null;
  assigned_to: string | null;
  created_by: string | null;
  updated_by: string | null;

  sent_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
  updated_at: string | null;
};

export type ComposeMailInput = {
  to: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  replyTo?: MailAddress[];
  subject: string;
  bodyHtml?: string | null;
  bodyText?: string | null;
  attachments?: unknown[];

  relatedType?: string | null;
  relatedId?: string | null;
  contactoId?: string | null;
  clienteId?: string | null;
  carritoId?: string | null;
  fileId?: string | null;
  presupuestoId?: string | null;
  conversacionId?: string | null;
};

export type ReplyThreadInput = {
  threadId: string;
  to?: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  bodyHtml?: string | null;
  bodyText?: string | null;
  attachments?: unknown[];
};

export type SaveDraftInput = {
  draftId?: string | null;
  threadId?: string | null;
  to?: MailAddress[];
  cc?: MailAddress[];
  bcc?: MailAddress[];
  subject?: string | null;
  bodyHtml?: string | null;
  bodyText?: string | null;
  attachments?: unknown[];

  relatedType?: string | null;
  relatedId?: string | null;
  contactoId?: string | null;
  clienteId?: string | null;
  carritoId?: string | null;
  fileId?: string | null;
  presupuestoId?: string | null;
  conversacionId?: string | null;
};

export type MailFilters = {
  search: string;
  mailbox:
    | "inbox"
    | "sent"
    | "drafts"
    | "trash"
    | "spam"
    | "archived"
    | "starred"
    | "all";
  unreadOnly: boolean;
  folderId: string | null;
};

type MailStoreState = {
  identity: MailIdentity | null;

  threads: MailThread[];
  selectedThread: MailThread | null;
  messages: MailMessage[];
  mailboxes: MailboxSummary[];
  folders: MailUserFolder[];
  rules: MailRule[];
  drafts: MailDraft[];

  filters: MailFilters;

  loadingIdentity: boolean;
  loadingThreads: boolean;
  loadingMessages: boolean;
  loadingMailboxes: boolean;
  loadingFolders: boolean;
  loadingRules: boolean;
  loadingDrafts: boolean;
  sending: boolean;
  savingDraft: boolean;

  error: string | null;

  setFilters: (patch: Partial<MailFilters>) => void;
  clearError: () => void;

  fetchIdentity: () => Promise<MailIdentity | null>;
  fetchMailboxes: () => Promise<void>;
  fetchFolders: () => Promise<void>;
  fetchRules: () => Promise<void>;
  fetchThreads: () => Promise<void>;
  selectThread: (thread: MailThread | null) => Promise<void>;
  fetchMessages: (threadId: string) => Promise<void>;
  fetchDrafts: () => Promise<void>;

  createFolder: (name: string, parentId?: string | null) => Promise<string | null>;
  renameFolder: (folderId: string, name: string) => Promise<void>;
  deleteFolder: (folderId: string) => Promise<void>;
  moveThreadsToFolder: (threadIds: string[], folderId: string) => Promise<void>;
  removeThreadFromFolder: (threadId: string, folderId: string) => Promise<void>;
  createRuleFromSender: (thread: MailThread, folderId: string) => Promise<string | null>;

  sendMail: (input: ComposeMailInput) => Promise<string | null>;
  replyThread: (input: ReplyThreadInput) => Promise<string | null>;
  saveDraft: (input: SaveDraftInput) => Promise<string | null>;
  sendDraft: (draftId: string) => Promise<string | null>;

  markMessageRead: (messageId: string, read?: boolean) => Promise<void>;
   archiveThread: (threadId: string, archived?: boolean) => Promise<void>;
 trashThreads: (threadIds: string[], trashed?: boolean) => Promise<void>;
deleteThreadsForever: (threadIds: string[]) => Promise<void>;
  starThread: (threadId: string, starred?: boolean) => Promise<void>;

  refreshAll: () => Promise<void>;
  reset: () => void;
};

const initialFilters: MailFilters = {
  search: "",
  mailbox: "inbox",
  unreadOnly: false,
  folderId: null
};

function normalizeError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === "object") {
    const record = error as {
      message?: unknown;
      details?: unknown;
      hint?: unknown;
      code?: unknown;
      error_description?: unknown;
      error?: unknown;
    };

    const parts = [
      record.message,
      record.error_description,
      record.error,
      record.details,
      record.hint,
      record.code ? `Código: ${String(record.code)}` : null
    ]
      .filter(Boolean)
      .map(String);

    if (parts.length > 0) {
      return parts.join(" · ");
    }

    try {
      return JSON.stringify(error);
    } catch {
      return "Error desconocido";
    }
  }

  return String(error);
}

function normalizeAddresses(addresses?: MailAddress[] | null): MailAddress[] {
  if (!Array.isArray(addresses)) {
    return [];
  }

  return addresses
    .map((address) => ({
      email: address.email?.trim().toLowerCase(),
      name: address.name?.trim() || null
    }))
    .filter((address) => Boolean(address.email));
}

function normalizeSubject(subject?: string | null): string {
  return subject?.trim() || "(sin asunto)";
}

function aggregateMailboxes(mailboxes: MailboxSummary[]): MailboxSummary[] {
  const map = new Map<string, MailboxSummary>();

  for (const mailbox of mailboxes) {
    const key = mailbox.codigo || mailbox.tipo || mailbox.nombre || mailbox.mailbox_id;
    const existing = map.get(key);

    if (!existing) {
      map.set(key, {
        ...mailbox,
        messages_count: Number(mailbox.messages_count || 0),
        unread_count: Number(mailbox.unread_count || 0),
        inbound_count: Number(mailbox.inbound_count || 0),
        outbound_count: Number(mailbox.outbound_count || 0),
        provider_total_count: Number(mailbox.provider_total_count || 0),
        provider_unread_count: Number(mailbox.provider_unread_count || 0)
      });
      continue;
    }

    existing.messages_count =
      Number(existing.messages_count || 0) + Number(mailbox.messages_count || 0);

    existing.unread_count =
      Number(existing.unread_count || 0) + Number(mailbox.unread_count || 0);

    existing.inbound_count =
      Number(existing.inbound_count || 0) + Number(mailbox.inbound_count || 0);

    existing.outbound_count =
      Number(existing.outbound_count || 0) + Number(mailbox.outbound_count || 0);

    existing.provider_total_count =
      Number(existing.provider_total_count || 0) + Number(mailbox.provider_total_count || 0);

    existing.provider_unread_count =
      Number(existing.provider_unread_count || 0) + Number(mailbox.provider_unread_count || 0);

    existing.last_message_at =
      existing.last_message_at && mailbox.last_message_at
        ? existing.last_message_at > mailbox.last_message_at
          ? existing.last_message_at
          : mailbox.last_message_at
        : existing.last_message_at || mailbox.last_message_at;
  }

  const order = ["inbox", "sent", "drafts", "trash", "spam"];

  return Array.from(map.values()).sort((a, b) => {
    const aIndex = order.indexOf(String(a.codigo || "").toLowerCase());
    const bIndex = order.indexOf(String(b.codigo || "").toLowerCase());

    if (aIndex !== -1 || bIndex !== -1) {
      return (aIndex === -1 ? 999 : aIndex) - (bIndex === -1 ? 999 : bIndex);
    }

    return String(a.nombre || "").localeCompare(String(b.nombre || ""), "es");
  });
}

function buildThreadQuery(filters: MailFilters) {
  let query = supabase
    .from("vw_mail_unified_inbox")
    .select("*")
    .order("last_message_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false, nullsFirst: false })
    .limit(100);

  if (filters.mailbox === "inbox") {
    query = query.eq("is_archived", false);
  }

  if (filters.mailbox === "sent") {
    query = query.eq("last_message_direction", "OUTBOUND");
  }

  if (filters.mailbox === "drafts") {
    query = query.eq("last_message_status", "DRAFT");
  }

  if (filters.mailbox === "trash") {
    query = query.eq("estado", "PAPELERA");
  }

  if (filters.mailbox === "spam") {
    query = query.eq("estado", "SPAM");
  }

  if (filters.mailbox === "archived") {
    query = query.eq("is_archived", true);
  }

  if (filters.mailbox === "starred") {
    query = query.eq("is_starred", true);
  }

  if (filters.unreadOnly) {
    query = query.gt("unread_count", 0);
  }

  const search = filters.search.trim();

  if (search) {
    query = query.or(
      [
        `subject.ilike.%${search}%`,
        `last_from_email.ilike.%${search}%`,
        `last_from_name.ilike.%${search}%`,
        `last_snippet.ilike.%${search}%`
      ].join(",")
    );
  }

  return query;
}

export const useMailStore = create<MailStoreState>((set, get) => ({
  identity: null,

  threads: [],
  selectedThread: null,
  messages: [],
  mailboxes: [],
  folders: [],
  rules: [],
  drafts: [],

  filters: initialFilters,

  loadingIdentity: false,
  loadingThreads: false,
  loadingMessages: false,
  loadingMailboxes: false,
  loadingFolders: false,
  loadingRules: false,
  loadingDrafts: false,
  sending: false,
  savingDraft: false,

  error: null,

  setFilters: (patch) => {
    set((state) => {
      const nextPatch = { ...patch };

      if ("mailbox" in patch && !("folderId" in patch)) {
        nextPatch.folderId = null;
      }

      return {
        filters: {
          ...state.filters,
          ...nextPatch
        }
      };
    });
  },

  clearError: () => {
    set({ error: null });
  },

  fetchIdentity: async () => {
    set({ loadingIdentity: true, error: null });

    try {
      const { data, error } = await supabase.rpc("get_my_mail_identity");

      if (error) {
        throw error;
      }

      const identity = Array.isArray(data) && data.length > 0 ? (data[0] as MailIdentity) : null;

      set({
        identity,
        loadingIdentity: false
      });

      return identity;
    } catch (error) {
      const message = normalizeError(error);

      set({
        error: message,
        loadingIdentity: false
      });

      return null;
    }
  },

  fetchMailboxes: async () => {
    set({ loadingMailboxes: true, error: null });

    try {
      const identity = get().identity;

      let query = supabase
        .from("vw_mail_mailboxes_summary")
        .select("*")
        .order("codigo", { ascending: true });

      if (identity?.account_id) {
        query = query.eq("account_id", identity.account_id);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      const rawMailboxes = (data ?? []) as MailboxSummary[];

      set({
        mailboxes: identity?.account_id ? rawMailboxes : aggregateMailboxes(rawMailboxes),
        loadingMailboxes: false
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        loadingMailboxes: false
      });
    }
  },

  fetchFolders: async () => {
    set({ loadingFolders: true, error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (!userId) {
        set({ folders: [], loadingFolders: false });
        return;
      }

      const { data, error } = await supabase
        .from("mail_folders")
        .select("*")
        .eq("user_id", userId)
        .eq("is_archived", false)
        .order("position", { ascending: true })
        .order("name", { ascending: true });

      if (error) throw error;

      set({
        folders: (data ?? []) as MailUserFolder[],
        loadingFolders: false
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        loadingFolders: false
      });
    }
  },

  fetchRules: async () => {
    set({ loadingRules: true, error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (!userId) {
        set({ rules: [], loadingRules: false });
        return;
      }

      const { data, error } = await supabase
        .from("mail_rules")
        .select("*")
        .eq("user_id", userId)
        .order("priority", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;

      set({
        rules: (data ?? []) as MailRule[],
        loadingRules: false
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        loadingRules: false
      });
    }
  },

  createFolder: async (name, parentId = null) => {
    const cleanName = name.trim();

    if (!cleanName) return null;

    set({ error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (!userId) throw new Error("No se pudo identificar el usuario.");

      const { data, error } = await supabase
        .from("mail_folders")
        .insert({
          user_id: userId,
          name: cleanName,
          parent_id: parentId || null
        })
        .select("id")
        .single();

      if (error) throw error;

      await get().fetchFolders();

      return data?.id || null;
    } catch (error) {
      set({ error: normalizeError(error) });
      return null;
    }
  },

  renameFolder: async (folderId, name) => {
    const cleanName = name.trim();

    if (!folderId || !cleanName) return;

    set({ error: null });

    try {
      const { error } = await supabase
        .from("mail_folders")
        .update({ name: cleanName })
        .eq("id", folderId);

      if (error) throw error;

      await get().fetchFolders();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

  deleteFolder: async (folderId) => {
    if (!folderId) return;

    set({ error: null });

    try {
      const { error } = await supabase
        .from("mail_folders")
        .update({ is_archived: true })
        .eq("id", folderId);

      if (error) throw error;

      const { filters } = get();

      if (filters.folderId === folderId) {
        set({
          filters: {
            ...filters,
            mailbox: "inbox",
            folderId: null
          }
        });
      }

      await get().fetchFolders();
      await get().fetchThreads();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

  moveThreadsToFolder: async (threadIds, folderId) => {
    const uniqueThreadIds = Array.from(new Set(threadIds)).filter(Boolean);

    if (uniqueThreadIds.length === 0 || !folderId) return;

    set({ error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (!userId) throw new Error("No se pudo identificar el usuario.");

      const rows = uniqueThreadIds.map((threadId) => ({
        user_id: userId,
        thread_id: threadId,
        folder_id: folderId
      }));

      const { error } = await supabase
        .from("mail_thread_folders")
        .upsert(rows, {
          onConflict: "user_id,thread_id,folder_id",
          ignoreDuplicates: true
        });

      if (error) throw error;

      /*
        Mover a carpeta en NOSTUR significa:
        - asignar carpeta personalizada
        - sacar de Bandeja de entrada
        - seguir visible dentro de la carpeta
      */
      for (const threadId of uniqueThreadIds) {
        const { error: archiveError } = await supabase.rpc("mail_set_thread_archived", {
          p_thread_id: threadId,
          p_archived: true
        });

        if (archiveError) throw archiveError;
      }

      const { selectedThread } = get();

      if (selectedThread && uniqueThreadIds.includes(selectedThread.thread_id)) {
        set({
          selectedThread: {
            ...selectedThread,
            is_archived: true,
            estado: selectedThread.estado === "PAPELERA" ? selectedThread.estado : "ARCHIVADO"
          }
        });
      }

      await get().fetchThreads();
      await get().fetchMailboxes();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

  removeThreadFromFolder: async (threadId, folderId) => {
    if (!threadId || !folderId) return;

    set({ error: null });

    try {
      const { error } = await supabase
        .from("mail_thread_folders")
        .delete()
        .eq("thread_id", threadId)
        .eq("folder_id", folderId);

      if (error) throw error;

      await get().fetchThreads();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

  createRuleFromSender: async (thread, folderId) => {
    if (!folderId) return null;

    const sender = thread.last_from_email?.trim().toLowerCase();

    if (!sender) {
      set({ error: "Este hilo no tiene remitente válido para crear una regla." });
      return null;
    }

    set({ error: null });

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();

      if (authError) throw authError;

      const userId = authData.user?.id;

      if (!userId) throw new Error("No se pudo identificar el usuario.");

      const { data: existingRule, error: existingRuleError } = await supabase
        .from("mail_rules")
        .select("id")
        .eq("user_id", userId)
        .eq("from_equals", sender)
        .eq("folder_id", folderId)
        .maybeSingle();

      if (existingRuleError) throw existingRuleError;

      let ruleId = existingRule?.id || null;

      if (ruleId) {
        const { error } = await supabase
          .from("mail_rules")
          .update({
            enabled: true,
            remove_from_inbox: true,
            updated_at: new Date().toISOString()
          })
          .eq("id", ruleId);

        if (error) throw error;
      } else {
        const { data: insertedRule, error } = await supabase
          .from("mail_rules")
          .insert({
            user_id: userId,
            name: `Remitente ${sender}`,
            enabled: true,
            priority: 100,
            match_type: "all",
            from_equals: sender,
            folder_id: folderId,
            remove_from_inbox: true
          })
          .select("id")
          .single();

        if (error) throw error;

        ruleId = insertedRule?.id || null;
      }

      const matchingThreadIds = get()
        .threads
        .filter((item) => item.last_from_email?.trim().toLowerCase() === sender)
        .map((item) => item.thread_id);

      if (matchingThreadIds.length > 0) {
        await get().moveThreadsToFolder(matchingThreadIds, folderId);
      }

      await get().fetchRules();

      return ruleId;
    } catch (error) {
      set({ error: normalizeError(error) });
      return null;
    }
  },

  fetchThreads: async () => {
    const { filters } = get();

    set({ loadingThreads: true, error: null });

    try {
      let folderThreadIds: string[] | null = null;

      if (filters.folderId) {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) throw authError;

        const userId = authData.user?.id;

        if (!userId) {
          set({ threads: [], loadingThreads: false });
          return;
        }

        const { data: folderRows, error: folderError } = await supabase
          .from("mail_thread_folders")
          .select("thread_id")
          .eq("user_id", userId)
          .eq("folder_id", filters.folderId);

        if (folderError) throw folderError;

        folderThreadIds = (folderRows ?? [])
          .map((row) => String(row.thread_id || ""))
          .filter(Boolean);

        if (folderThreadIds.length === 0) {
          set({ threads: [], loadingThreads: false });
          return;
        }
      }

      let query = buildThreadQuery(filters);

      if (folderThreadIds) {
        query = query.in("thread_id", folderThreadIds);
      }

      const { data, error } = await query;

      if (error) {
        throw error;
      }

      set({
        threads: (data ?? []) as MailThread[],
        loadingThreads: false
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        loadingThreads: false
      });
    }
  },

  selectThread: async (thread) => {
    set({
      selectedThread: thread,
      messages: []
    });

    if (thread?.thread_id) {
      await get().fetchMessages(thread.thread_id);
    }
  },

  fetchMessages: async (threadId) => {
    set({ loadingMessages: true, error: null });

    try {
      const { data, error } = await supabase
        .from("vw_mail_messages")
        .select("*")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: true });

      if (error) {
        throw error;
      }

      set({
        messages: (data ?? []) as MailMessage[],
        loadingMessages: false
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        loadingMessages: false
      });
    }
  },

  fetchDrafts: async () => {
    set({ loadingDrafts: true, error: null });

    try {
      const { data, error } = await supabase
        .from("vw_mail_drafts")
        .select("*")
        .in("status", ["DRAFT", "SAVED"])
        .order("updated_at", { ascending: false, nullsFirst: false });

      if (error) {
        throw error;
      }

      set({
        drafts: (data ?? []) as MailDraft[],
        loadingDrafts: false
      });
    } catch (error) {
      set({
        error: normalizeError(error),
        loadingDrafts: false
      });
    }
  },

  sendMail: async (input) => {
    set({ sending: true, error: null });

    try {
      const { data, error } = await supabase.rpc("mail_create_outbox", {
        p_to_emails: normalizeAddresses(input.to),
        p_subject: normalizeSubject(input.subject),
        p_body_html: input.bodyHtml ?? null,
        p_body_text: input.bodyText ?? null,
        p_cc_emails: normalizeAddresses(input.cc),
        p_bcc_emails: normalizeAddresses(input.bcc),
        p_reply_to_emails: normalizeAddresses(input.replyTo),
        p_attachments: input.attachments ?? [],
        p_related_type: input.relatedType ?? null,
        p_related_id: input.relatedId ?? null,
        p_contacto_id: input.contactoId ?? null,
        p_cliente_id: input.clienteId ?? null,
        p_carrito_id: input.carritoId ?? null,
        p_file_id: input.fileId ?? null,
        p_presupuesto_id: input.presupuestoId ?? null,
        p_conversacion_id: input.conversacionId ?? null
      });

      if (error) {
        throw error;
      }

      set({ sending: false });

      await get().fetchThreads();

      return data as string | null;
    } catch (error) {
      set({
        error: normalizeError(error),
        sending: false
      });

      return null;
    }
  },

  replyThread: async (input) => {
    set({ sending: true, error: null });

    try {
      const { data, error } = await supabase.rpc("mail_reply_thread", {
        p_thread_id: input.threadId,
        p_body_html: input.bodyHtml ?? null,
        p_body_text: input.bodyText ?? null,
        p_to_emails: normalizeAddresses(input.to),
        p_cc_emails: normalizeAddresses(input.cc),
        p_bcc_emails: normalizeAddresses(input.bcc),
        p_attachments: input.attachments ?? []
      });

      if (error) {
        throw error;
      }

      set({ sending: false });

      await get().fetchThreads();
      await get().fetchMessages(input.threadId);

      return data as string | null;
    } catch (error) {
      set({
        error: normalizeError(error),
        sending: false
      });

      return null;
    }
  },

  saveDraft: async (input) => {
    set({ savingDraft: true, error: null });

    try {
      const { data, error } = await supabase.rpc("mail_save_draft", {
        p_draft_id: input.draftId ?? null,
        p_thread_id: input.threadId ?? null,
        p_to_emails: normalizeAddresses(input.to),
        p_cc_emails: normalizeAddresses(input.cc),
        p_bcc_emails: normalizeAddresses(input.bcc),
        p_subject: input.subject ?? null,
        p_body_html: input.bodyHtml ?? null,
        p_body_text: input.bodyText ?? null,
        p_attachments: input.attachments ?? [],
        p_related_type: input.relatedType ?? null,
        p_related_id: input.relatedId ?? null,
        p_contacto_id: input.contactoId ?? null,
        p_cliente_id: input.clienteId ?? null,
        p_carrito_id: input.carritoId ?? null,
        p_file_id: input.fileId ?? null,
        p_presupuesto_id: input.presupuestoId ?? null,
        p_conversacion_id: input.conversacionId ?? null
      });

      if (error) {
        throw error;
      }

      set({ savingDraft: false });

      await get().fetchDrafts();

      return data as string | null;
    } catch (error) {
      set({
        error: normalizeError(error),
        savingDraft: false
      });

      return null;
    }
  },

  sendDraft: async (draftId) => {
    set({ sending: true, error: null });

    try {
      const { data, error } = await supabase.rpc("mail_send_draft", {
        p_draft_id: draftId
      });

      if (error) {
        throw error;
      }

      set({ sending: false });

      await get().fetchDrafts();
      await get().fetchThreads();

      return data as string | null;
    } catch (error) {
      set({
        error: normalizeError(error),
        sending: false
      });

      return null;
    }
  },

  markMessageRead: async (messageId, read = true) => {
    set({ error: null });

    try {
      const { error } = await supabase.rpc("mail_set_message_read", {
        p_message_id: messageId,
        p_read: read
      });

      if (error) {
        throw error;
      }

      const selectedThread = get().selectedThread;

      if (selectedThread?.thread_id) {
        await get().fetchMessages(selectedThread.thread_id);
      }

      await get().fetchThreads();
      await get().fetchMailboxes();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

  archiveThread: async (threadId, archived = true) => {
    set({ error: null });

    try {
      const { error } = await supabase.rpc("mail_set_thread_archived", {
        p_thread_id: threadId,
        p_archived: archived
      });

      if (error) {
        throw error;
      }

      const { selectedThread } = get();

      if (selectedThread?.thread_id === threadId) {
        set({
          selectedThread: {
            ...selectedThread,
            is_archived: archived,
            estado: archived ? "ARCHIVADO" : "ABIERTO"
          }
        });
      }

      await get().fetchThreads();
      await get().fetchMailboxes();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },


   trashThread: async (threadId: string, trashed = true) => {
    set({ error: null });

    try {
      const { error } = await supabase.rpc("mail_set_thread_trashed", {
        p_thread_id: threadId,
        p_trashed: trashed
      });

      if (error) {
        throw error;
      }

      const { selectedThread } = get();

      if (selectedThread?.thread_id === threadId) {
        set({
          selectedThread: {
            ...selectedThread,
            estado: trashed ? "PAPELERA" : "ABIERTO",
            is_archived: trashed
          }
        });
      }

      await get().fetchThreads();
      await get().fetchMailboxes();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

trashThreads: async (threadIds, trashed = true) => {
  set({ error: null });

  const uniqueThreadIds = Array.from(new Set(threadIds)).filter(Boolean);

  if (uniqueThreadIds.length === 0) return;

  try {
    for (const threadId of uniqueThreadIds) {
      const { error } = await supabase.rpc("mail_set_thread_trashed", {
        p_thread_id: threadId,
        p_trashed: trashed
      });

      if (error) throw error;
    }

    const { selectedThread } = get();

    if (selectedThread && uniqueThreadIds.includes(selectedThread.thread_id)) {
      set({ selectedThread: null, messages: [] });
    }

    await get().fetchThreads();
    await get().fetchMailboxes();
  } catch (error) {
    set({ error: normalizeError(error) });
  }
},

deleteThreadsForever: async (threadIds) => {
  set({ error: null });

  const uniqueThreadIds = Array.from(new Set(threadIds)).filter(Boolean);

  if (uniqueThreadIds.length === 0) return;

  try {
    /*
      Borrado definitivo lógico:
      por ahora marcamos estado ELIMINADO.
      Si después queremos borrar físicamente mensajes/adjuntos, lo hacemos con una RPC.
    */

    const { error } = await supabase
      .from("email_threads")
      .update({
        estado: "ELIMINADO",
        is_archived: true,
        updated_at: new Date().toISOString()
      })
      .in("id", uniqueThreadIds);

    if (error) throw error;

    const { selectedThread } = get();

    if (selectedThread && uniqueThreadIds.includes(selectedThread.thread_id)) {
      set({ selectedThread: null, messages: [] });
    }

    await get().fetchThreads();
    await get().fetchMailboxes();
  } catch (error) {
    set({ error: normalizeError(error) });
  }
},


  starThread: async (threadId, starred = true) => {
    set({ error: null });

    try {
      const { error } = await supabase.rpc("mail_set_thread_starred", {
        p_thread_id: threadId,
        p_starred: starred
      });

      if (error) {
        throw error;
      }

      const { selectedThread } = get();

      if (selectedThread?.thread_id === threadId) {
        set({
          selectedThread: {
            ...selectedThread,
            is_starred: starred
          }
        });
      }

      await get().fetchThreads();
    } catch (error) {
      set({ error: normalizeError(error) });
    }
  },

  refreshAll: async () => {
    await get().fetchIdentity();

    await Promise.all([
      get().fetchMailboxes(),
      get().fetchFolders(),
      get().fetchRules(),
      get().fetchThreads(),
      get().fetchDrafts()
    ]);
  },

  reset: () => {
    set({
      identity: null,
      threads: [],
      selectedThread: null,
      messages: [],
      mailboxes: [],
      folders: [],
      rules: [],
      drafts: [],
      filters: initialFilters,
      loadingIdentity: false,
      loadingThreads: false,
      loadingMessages: false,
      loadingMailboxes: false,
      loadingFolders: false,
      loadingRules: false,
      loadingDrafts: false,
      sending: false,
      savingDraft: false,
      error: null
    });
  }
}));