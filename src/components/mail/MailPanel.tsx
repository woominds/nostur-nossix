// src/components/mail/MailPanel.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent } from "react";
import {
  Archive,
  ArchiveRestore,
  ArrowLeft,
  Bold,
  CheckCircle2,
  CheckSquare,
  Edit3,
  Folder,
  FolderPlus,
  Image as ImageIcon,
  Inbox,
  Italic,
  Link,
  List,
  ListOrdered,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  RefreshCcw,
  Reply,
  Search,
  Send,
  Square,
  Star,
  StarOff,
  Trash2,
  Underline,
  X
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  useMailStore,
  type MailAddress,
  type MailFilters,
  type MailMessage,
  type MailUserFolder,
  type MailThread
} from "../../store/mailStore";

type ComposeAttachment = {
  filename: string;
  public_url: string;
  path: string;
  content_type: string | null;
  size_bytes: number;
};

type ComposeState = {
  open: boolean;
  mode: "new" | "reply";
  threadId: string | null;
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
  bodyHtml: string;
  attachments: ComposeAttachment[];
  uploading: boolean;
};

const initialComposeState: ComposeState = {
  open: false,
  mode: "new",
  threadId: null,
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  bodyHtml: "",
  attachments: [],
  uploading: false
};

function formatDateTime(value?: string | null): string {
  if (!value) return "—";

  try {
    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function formatShortDate(value?: string | null): string {
  if (!value) return "";

  try {
    const date = new Date(value);
    const now = new Date();

    const sameDay =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();

    if (sameDay) {
      return new Intl.DateTimeFormat("es-AR", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date);
    }

    return new Intl.DateTimeFormat("es-AR", {
      day: "2-digit",
      month: "2-digit"
    }).format(date);
  } catch {
    return value;
  }
}

function parseAddressInput(value: string): MailAddress[] {
  return value
    .split(/[;,]/g)
    .map((item) => item.trim())
    .filter(Boolean)
    .map((item) => {
      const match = item.match(/^(.*?)<(.+?)>$/);

      if (match) {
        return {
          name: match[1].trim().replace(/^"|"$/g, "") || null,
          email: match[2].trim().toLowerCase()
        };
      }

      return {
        email: item.toLowerCase(),
        name: null
      };
    });
}

function formatAddress(address?: MailAddress | null): string {
  if (!address) return "";

  if (address.name) {
    return `${address.name} <${address.email}>`;
  }

  return address.email;
}

function formatAddressList(addresses?: MailAddress[] | null): string {
  if (!Array.isArray(addresses) || addresses.length === 0) {
    return "—";
  }

  return addresses.map(formatAddress).join(", ");
}

function buildReplySubject(subject?: string | null): string {
  const cleanSubject = subject?.trim() || "(sin asunto)";

  if (/^re:/i.test(cleanSubject)) {
    return cleanSubject;
  }

  return `Re: ${cleanSubject}`;
}

function getThreadSender(thread: MailThread): string {
  if (thread.last_from_name) return thread.last_from_name;
  if (thread.last_from_email) return thread.last_from_email;
  return "Sin remitente";
}

function getFolderName(folder: MailUserFolder): string {
  return folder.name?.trim() || "Carpeta sin nombre";
}

function getMessageSender(message: MailMessage): string {
  if (message.direction === "OUTBOUND") {
    return message.identity_nombre || message.from_name || message.from_email || "Yo";
  }

  return message.from_name || message.from_email || "Sin remitente";
}

function getMessageBody(message: MailMessage): string {
  if (message.body_html) return message.body_html;

  const text = message.body_text || message.snippet || "";

  return text
    .split("\n")
    .map((line) => `<p>${line || "&nbsp;"}</p>`)
    .join("");
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function htmlToPlainText(html: string): string {
  if (!html) return "";

  const div = document.createElement("div");
  div.innerHTML = html;

  return div.textContent || div.innerText || "";
}

function sanitizeEditorHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/onerror=/gi, "")
    .replace(/onload=/gi, "");
}

function buildMailStoragePath(file: File): string {
  const cleanName = file.name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9.\-_]+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();

  const date = new Date();
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");

  return `${yyyy}/${mm}/${crypto.randomUUID()}-${cleanName}`;
}

function EmptyDetail() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
        <Mail className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-base font-semibold text-slate-700">Seleccioná un correo</h3>
      <p className="mt-1 max-w-sm text-sm">
        Elegí una conversación de la bandeja para ver el historial, responder, archivar o marcar como leída.
      </p>
    </div>
  );
}

export function MailPanel() {
  const {
    identity,
    threads,
    selectedThread,
    messages,
    mailboxes,
    folders,
    drafts,
    filters,
    loadingIdentity,
    loadingThreads,
     rules,
    loadingMessages,
    loadingMailboxes,
    loadingFolders,
    loadingDrafts,
    sending,
    savingDraft,
    error,
    setFilters,
    clearError,
    refreshAll,
    fetchThreads,
    createFolder,
    renameFolder,
    deleteFolder,
    moveThreadsToFolder,
    removeThreadFromFolder,
    createRuleFromSender,
    fetchMessages,
    selectThread,
    sendMail,
    replyThread,
    saveDraft,
    markMessageRead,
    archiveThread,
    trashThreads,
    deleteThreadsForever,
    starThread
  } = useMailStore();

  const [compose, setCompose] = useState<ComposeState>(initialComposeState);
  const [selectedThreadIds, setSelectedThreadIds] = useState<string[]>([]);
  const [deleteForeverModalOpen, setDeleteForeverModalOpen] = useState(false);
  const [folderActionMessage, setFolderActionMessage] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);

  const editorRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  const composeResizeRef = useRef({
    resizing: false,
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0
  });

  const [composeSize, setComposeSize] = useState({
    width: Math.max(760, window.innerWidth - 96),
    height: Math.max(520, window.innerHeight - 200)
  });

  const selectedCount = selectedThreadIds.length;
  const isTrashMailbox = filters.mailbox === "trash";

  const unreadTotal = useMemo(() => {
    const inbox = mailboxes.find((mailbox) => String(mailbox.codigo || "").toLowerCase() === "inbox");

    if (inbox) {
      return Number(inbox.unread_count || 0);
    }

    return threads.reduce((acc, thread) => acc + Number(thread.unread_count || 0), 0);
  }, [mailboxes, threads]);

  const inboxTotal = useMemo(() => {
    const inbox = mailboxes.find((mailbox) => String(mailbox.codigo || "").toLowerCase() === "inbox");

    return Number(inbox?.messages_count || inbox?.provider_total_count || 0);
  }, [mailboxes]);

  const inboxMailbox = useMemo(() => {
    return mailboxes.find((mailbox) => mailbox.codigo === "inbox");
  }, [mailboxes]);

  const selectedFolder = useMemo(() => {
    if (!filters.folderId) return null;
    return folders.find((folder) => folder.id === filters.folderId) || null;
  }, [folders, filters.folderId]);

  const selectedThreadUnreadMessage = useMemo(() => {
    return messages.find((message) => message.direction === "INBOUND" && !message.read_at);
  }, [messages]);

  const allVisibleSelected = useMemo(() => {
    if (threads.length === 0) return false;
    return threads.every((thread) => selectedThreadIds.includes(thread.thread_id));
  }, [threads, selectedThreadIds]);

  useEffect(() => {
    void refreshAll();
  }, [refreshAll]);

  useEffect(() => {
    void fetchThreads();
  }, [filters, fetchThreads]);

  useEffect(() => {
    setSelectedThreadIds([]);
    setDeleteForeverModalOpen(false);
  }, [filters.mailbox, filters.folderId]);

  function toggleThreadSelection(threadId: string) {
    setSelectedThreadIds((current) =>
      current.includes(threadId)
        ? current.filter((id) => id !== threadId)
        : [...current, threadId]
    );
  }

  function clearThreadSelection() {
    setSelectedThreadIds([]);
  }

  async function handleCreateFolder(name?: string) {
    const cleanName = (name ?? newFolderName).trim();

    if (!cleanName) {
      setNewFolderOpen(true);
      return;
    }

    setCreatingFolder(true);

    try {
      const folderId = await createFolder(cleanName);

      if (folderId) {
        setFolderActionMessage(`Carpeta "${cleanName}" creada.`);
        setNewFolderName("");
        setNewFolderOpen(false);
      }
    } finally {
      setCreatingFolder(false);
    }
  }

  async function handleRenameFolder(folder: MailUserFolder) {
    const name = window.prompt("Nuevo nombre de la carpeta:", getFolderName(folder));

    if (!name?.trim()) return;

    await renameFolder(folder.id, name.trim());
    setFolderActionMessage("Carpeta actualizada.");
  }

  async function handleDeleteFolder(folder: MailUserFolder) {
    const confirmed = window.confirm(
      `¿Eliminar la carpeta "${getFolderName(folder)}"? Los correos no se borran, solo dejan de estar en esa carpeta.`
    );

    if (!confirmed) return;

    await deleteFolder(folder.id);
    setFolderActionMessage("Carpeta eliminada.");
  }

  async function handleMoveSelectedToFolder(folderId: string) {
    const threadIds =
      selectedThreadIds.length > 0
        ? selectedThreadIds
        : selectedThread?.thread_id
          ? [selectedThread.thread_id]
          : [];

    if (threadIds.length === 0 || !folderId) return;

    await moveThreadsToFolder(threadIds, folderId);
    clearThreadSelection();

    const folder = folders.find((item) => item.id === folderId);
    setFolderActionMessage(`Movido a ${folder ? getFolderName(folder) : "carpeta"}.`);
  }

  async function handleRemoveSelectedFromCurrentFolder() {
    if (!filters.folderId) return;

    const threadIds =
      selectedThreadIds.length > 0
        ? selectedThreadIds
        : selectedThread?.thread_id
          ? [selectedThread.thread_id]
          : [];

    if (threadIds.length === 0) return;

    for (const threadId of threadIds) {
      await removeThreadFromFolder(threadId, filters.folderId);
    }

    clearThreadSelection();
    setFolderActionMessage("Correo quitado de la carpeta.");
  }

  async function handleCreateRuleFromSelectedSender(folderId: string) {
    if (!selectedThread || !folderId) return;

    const ruleId = await createRuleFromSender(selectedThread, folderId);

    if (ruleId) {
      const folder = folders.find((item) => item.id === folderId);
      setFolderActionMessage(
        `Regla creada: ${selectedThread.last_from_email} → ${folder ? getFolderName(folder) : "carpeta"}.`
      );
    }
  }

  function toggleSelectAllVisibleThreads() {
    const visibleIds = threads.map((thread) => thread.thread_id);

    if (visibleIds.length === 0) return;

    const allSelected = visibleIds.every((id) => selectedThreadIds.includes(id));

    if (allSelected) {
      setSelectedThreadIds((current) => current.filter((id) => !visibleIds.includes(id)));
    } else {
      setSelectedThreadIds((current) => Array.from(new Set([...current, ...visibleIds])));
    }
  }

  async function handleBulkDelete() {
    const threadIds =
      selectedThreadIds.length > 0
        ? selectedThreadIds
        : selectedThread?.thread_id
          ? [selectedThread.thread_id]
          : [];

    if (threadIds.length === 0) return;

    if (isTrashMailbox) {
      setSelectedThreadIds(threadIds);
      setDeleteForeverModalOpen(true);
      return;
    }

    await trashThreads(threadIds, true);
    clearThreadSelection();
  }

  async function confirmDeleteForever() {
    if (selectedThreadIds.length === 0) return;

    await deleteThreadsForever(selectedThreadIds);
    clearThreadSelection();
    setDeleteForeverModalOpen(false);
  }

  function syncEditorState() {
    const html = sanitizeEditorHtml(editorRef.current?.innerHTML || "");
    const text = htmlToPlainText(html);

    setCompose((prev) => ({
      ...prev,
      bodyHtml: html,
      body: text
    }));
  }

  function runEditorCommand(command: string, value?: string) {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    syncEditorState();
  }

  function insertLink() {
    const url = window.prompt("Pegá la URL del enlace:");

    if (!url?.trim()) return;

    runEditorCommand("createLink", url.trim());
  }

  async function uploadMailFile(file: File): Promise<ComposeAttachment | null> {
    const path = buildMailStoragePath(file);

    const { error } = await supabase.storage
      .from("mail-attachments")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || undefined
      });

    if (error) {
      throw error;
    }

    const { data } = supabase.storage.from("mail-attachments").getPublicUrl(path);

    return {
      filename: file.name,
      public_url: data.publicUrl,
      path: data.publicUrl,
      content_type: file.type || null,
      size_bytes: file.size
    };
  }

  async function handleAttachFiles(files: FileList | null) {
    if (!files || files.length === 0) return;

    setCompose((prev) => ({
      ...prev,
      uploading: true
    }));

    try {
      const uploaded: ComposeAttachment[] = [];

      for (const file of Array.from(files)) {
        const attachment = await uploadMailFile(file);

        if (attachment) {
          uploaded.push(attachment);
        }
      }

      setCompose((prev) => ({
        ...prev,
        attachments: [...prev.attachments, ...uploaded],
        uploading: false
      }));
    } catch (error) {
      setCompose((prev) => ({
        ...prev,
        uploading: false
      }));

      useMailStore.setState({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  async function handleInsertImages(files: FileList | null) {
    if (!files || files.length === 0) return;

    setCompose((prev) => ({
      ...prev,
      uploading: true
    }));

    try {
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) continue;

        const uploaded = await uploadMailFile(file);

        if (!uploaded) continue;

        editorRef.current?.focus();

        document.execCommand(
          "insertHTML",
          false,
          `<p><img src="${uploaded.public_url}" alt="${uploaded.filename}" style="max-width:100%;border-radius:12px;" /></p>`
        );

        syncEditorState();
      }

      setCompose((prev) => ({
        ...prev,
        uploading: false
      }));
    } catch (error) {
      setCompose((prev) => ({
        ...prev,
        uploading: false
      }));

      useMailStore.setState({
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function removeAttachment(publicUrl: string) {
    setCompose((prev) => ({
      ...prev,
      attachments: prev.attachments.filter((attachment) => attachment.public_url !== publicUrl)
    }));
  }

  function resetEditorContent() {
    window.setTimeout(() => {
      if (editorRef.current) {
        editorRef.current.innerHTML = "";
      }
    }, 0);
  }

  function openNewCompose() {
    clearError();
    setCompose({
      ...initialComposeState,
      open: true,
      mode: "new"
    });
    resetEditorContent();
  }

  function openReplyCompose(thread: MailThread) {
    clearError();

    const target =
      thread.last_from_email && thread.last_from_email !== identity?.email
        ? `${thread.last_from_name ? `${thread.last_from_name} <${thread.last_from_email}>` : thread.last_from_email}`
        : "";

    setCompose({
      ...initialComposeState,
      open: true,
      mode: "reply",
      threadId: thread.thread_id,
      to: target,
      subject: buildReplySubject(thread.subject)
    });
    resetEditorContent();
  }

  function closeCompose() {
    setCompose(initialComposeState);
    resetEditorContent();
  }

  async function handleSubmitCompose() {
    syncEditorState();

    const html = sanitizeEditorHtml(editorRef.current?.innerHTML || compose.bodyHtml || "");
    const text = htmlToPlainText(html);

    const to = parseAddressInput(compose.to);
    const cc = parseAddressInput(compose.cc);
    const bcc = parseAddressInput(compose.bcc);

    if (compose.mode === "new") {
      const outboxId = await sendMail({
        to,
        cc,
        bcc,
        subject: compose.subject,
        bodyText: text,
        bodyHtml: html,
        attachments: compose.attachments
      });

      if (outboxId) {
        closeCompose();
      }

      return;
    }

    if (compose.mode === "reply" && compose.threadId) {
      const outboxId = await replyThread({
        threadId: compose.threadId,
        to,
        cc,
        bcc,
        bodyText: text,
        bodyHtml: html,
        attachments: compose.attachments
      });

      if (outboxId) {
        closeCompose();
      }
    }
  }

  async function handleSaveDraft() {
    syncEditorState();

    const html = sanitizeEditorHtml(editorRef.current?.innerHTML || compose.bodyHtml || "");
    const text = htmlToPlainText(html);

    const draftId = await saveDraft({
      threadId: compose.threadId,
      to: parseAddressInput(compose.to),
      cc: parseAddressInput(compose.cc),
      bcc: parseAddressInput(compose.bcc),
      subject: compose.subject,
      bodyText: text,
      bodyHtml: html,
      attachments: compose.attachments
    });

    if (draftId) {
      closeCompose();
    }
  }

   async function handleSelectThread(thread: MailThread) {
    await selectThread(thread);

    const messageId = thread.last_message_id;

    if (thread.unread_count > 0 && messageId) {
      window.setTimeout(() => {
        void markMessageRead(messageId, true);
      }, 400);
    }
  }

  async function handleRefreshSelectedThread() {
    if (selectedThread?.thread_id) {
      await fetchMessages(selectedThread.thread_id);
    }
  }

  function startComposeResize(event: PointerEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    composeResizeRef.current = {
      resizing: true,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: composeSize.width,
      startHeight: composeSize.height
    };

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // ignore
    }
  }

  function updateComposeResize(event: PointerEvent<HTMLButtonElement>) {
    if (!composeResizeRef.current.resizing) return;

    event.preventDefault();
    event.stopPropagation();

    const deltaX = event.clientX - composeResizeRef.current.startX;
    const deltaY = event.clientY - composeResizeRef.current.startY;

    const maxWidth = window.innerWidth - 48;
    const maxHeight = window.innerHeight - 48;

    const nextWidth = Math.min(
      maxWidth,
      Math.max(680, composeResizeRef.current.startWidth + deltaX)
    );

    const nextHeight = Math.min(
      maxHeight,
      Math.max(420, composeResizeRef.current.startHeight + deltaY)
    );

    setComposeSize({
      width: nextWidth,
      height: nextHeight
    });
  }

  function stopComposeResize(event?: PointerEvent<HTMLButtonElement>) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    composeResizeRef.current.resizing = false;
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-slate-50 text-slate-900">
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
            <Mail className="h-5 w-5" />
          </div>

          <div>
            <h1 className="text-lg font-semibold leading-tight">Mail</h1>
            <p className="text-xs text-slate-500">
              {identity?.email || (loadingIdentity ? "Cargando identidad..." : "Sin identidad de correo")}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unreadTotal > 0 ? (
            <span className="rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
              {unreadTotal} sin leer
            </span>
          ) : (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
              Al día
            </span>
          )}

          <button
            type="button"
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <RefreshCcw className={cx("h-4 w-4", loadingThreads && "animate-spin")} />
            Actualizar
          </button>

          <button
            type="button"
            onClick={openNewCompose}
            className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
          >
            <Edit3 className="h-4 w-4" />
            Nuevo
          </button>
        </div>
      </div>

      {error ? (
        <div className="mx-4 mt-3 flex items-start justify-between rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{error}</span>
          <button type="button" onClick={clearError} className="ml-3 text-red-500 hover:text-red-700">
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 grid-cols-[280px_minmax(320px,420px)_1fr] overflow-hidden">
        <aside className="min-h-0 border-r border-slate-200 bg-white">
          <div className="p-3">
            <button
              type="button"
              onClick={openNewCompose}
              className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
            >
              <Edit3 className="h-4 w-4" />
              Redactar
            </button>

            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => setFilters({ mailbox: "inbox", unreadOnly: false, folderId: null })}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                  filters.mailbox === "inbox" && !filters.folderId
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Inbox className="h-4 w-4" />
                  Bandeja
                </span>
              <span className="text-xs">{inboxTotal || inboxMailbox?.messages_count || unreadTotal || ""}</span>
              </button>

              <button
                type="button"
                onClick={() => setFilters({ mailbox: "sent", unreadOnly: false, folderId: null })}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                  filters.mailbox === "sent" && !filters.folderId
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Send className="h-4 w-4" />
                  Enviados
                </span>
              </button>

              <button
                type="button"
               onClick={() => setFilters({ mailbox: "starred", unreadOnly: false, folderId: null })}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                  filters.mailbox === "starred" && !filters.folderId
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Star className="h-4 w-4" />
                  Destacados
                </span>
              </button>

              <button
                type="button"
             onClick={() => setFilters({ mailbox: "archived", unreadOnly: false, folderId: null })}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                  filters.mailbox === "archived" && !filters.folderId
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Archive className="h-4 w-4" />
                  Archivados
                </span>
              </button>

              <button
                type="button"
                onClick={() => setFilters({ mailbox: "trash", unreadOnly: false, folderId: null })}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                  filters.mailbox === "trash" && !filters.folderId
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4" />
                  Papelera
                </span>
              </button>

              <button
                type="button"
              onClick={() => setFilters({ mailbox: "all", unreadOnly: false, folderId: null })}
                className={cx(
                  "flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium",
                  filters.mailbox === "all" && !filters.folderId
                    ? "bg-violet-50 text-violet-700"
                    : "text-slate-700 hover:bg-slate-50"
                )}
              >
                <span className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Todos
                </span>
              </button>
            </nav>

            <div className="mt-5 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Mis carpetas
                </p>

                <button
                  type="button"
                  onClick={() => {
                    setNewFolderOpen((current) => !current);
                    setFolderActionMessage("");
                  }}
                  className="rounded-lg bg-white p-1.5 text-blue-600 shadow-sm ring-1 ring-blue-100 hover:bg-blue-600 hover:text-white"
                  title="Nueva carpeta"
                >
                  <FolderPlus className="h-3.5 w-3.5" />
                </button>
              </div>

              {newFolderOpen ? (
                <div className="mb-2 rounded-xl bg-white p-2 ring-1 ring-blue-100">
                  <input
                    value={newFolderName}
                    onChange={(event) => setNewFolderName(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void handleCreateFolder();
                      }

                      if (event.key === "Escape") {
                        setNewFolderOpen(false);
                        setNewFolderName("");
                      }
                    }}
                    autoFocus
                    placeholder="Nombre de carpeta"
                    className="mb-2 h-9 w-full rounded-lg border border-slate-200 px-2 text-xs font-medium text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                  />

                  <div className="flex justify-end gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setNewFolderOpen(false);
                        setNewFolderName("");
                      }}
                      className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                    >
                      Cancelar
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleCreateFolder()}
                      disabled={creatingFolder || !newFolderName.trim()}
                      className="rounded-lg bg-blue-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {creatingFolder ? "Creando..." : "Crear"}
                    </button>
                  </div>
                </div>
              ) : null}

              {folderActionMessage ? (
                <div className="mb-2 rounded-lg bg-white px-2 py-1.5 text-[11px] font-medium text-blue-700 ring-1 ring-blue-100">
                  {folderActionMessage}
                </div>
              ) : null}

                            {rules.length > 0 ? (
                <div className="mb-3 rounded-xl bg-white p-2 ring-1 ring-blue-100">
                  <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-blue-500">
                    Reglas activas
                  </p>

                  <div className="space-y-1">
                    {rules
                      .filter((rule) => rule.enabled)
                      .slice(0, 5)
                      .map((rule) => {
                        const folder = folders.find((item) => item.id === rule.folder_id);

                        return (
                          <div
                            key={rule.id}
                            className="rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-medium text-blue-700"
                          >
                            <div className="truncate">
                              {rule.from_equals || rule.from_contains || rule.subject_contains || rule.name}
                            </div>

                            <div className="truncate text-[10px] font-normal text-blue-500">
                              → {folder ? getFolderName(folder) : "Carpeta"}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ) : null}

              <div className="space-y-1">
                {folders.length === 0 && !loadingFolders ? (
                  <p className="text-xs text-slate-500">
                    Creá carpetas propias para ordenar tus correos.
                  </p>
                ) : null}

                {loadingFolders ? (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Cargando carpetas...
                  </p>
                ) : null}

                {folders.map((folder) => {
                  const active = filters.folderId === folder.id;

                  return (
                    <div
                      key={folder.id}
                      className={cx(
                        "group flex items-center gap-1 rounded-lg px-2 py-1.5 transition",
                        active
                          ? "bg-blue-600 text-white"
                          : "text-slate-700 hover:bg-white hover:text-slate-950"
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setFilters({
                            mailbox: "all",
                            folderId: folder.id,
                            unreadOnly: false
                          });
                        }}
                        className="flex min-w-0 flex-1 items-center gap-2 text-left text-xs font-semibold"
                      >
                        <Folder className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{getFolderName(folder)}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleRenameFolder(folder)}
                        className={cx(
                          "rounded-md p-1 opacity-0 transition group-hover:opacity-100",
                          active ? "text-white/80 hover:bg-white/15" : "text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        )}
                        title="Renombrar carpeta"
                      >
                        <Edit3 className="h-3 w-3" />
                      </button>

                      <button
                        type="button"
                        onClick={() => void handleDeleteFolder(folder)}
                        className={cx(
                          "rounded-md p-1 opacity-0 transition group-hover:opacity-100",
                          active ? "text-white/80 hover:bg-white/15" : "text-slate-400 hover:bg-red-50 hover:text-red-600"
                        )}
                        title="Eliminar carpeta"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Buzones
                </p>
                {loadingMailboxes ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
              </div>

              <div className="space-y-1">
                {mailboxes.length === 0 && !loadingMailboxes ? (
                  <p className="text-xs text-slate-500">Sin carpetas.</p>
                ) : null}

                {mailboxes.map((mailbox) => {
                  const codigo = String(mailbox.codigo || "").toLowerCase();

                  const targetMailbox: MailFilters["mailbox"] =
                    codigo === "inbox"
                      ? "inbox"
                      : codigo === "sent"
                        ? "sent"
                        : codigo === "drafts"
                          ? "drafts"
                          : codigo === "trash"
                            ? "trash"
                            : codigo === "spam"
                              ? "spam"
                              : "all";

                  const active = filters.mailbox === targetMailbox;

                  return (
                    <button
                      key={mailbox.mailbox_id}
                      type="button"
                      onClick={() => {
                        setFilters({
                          mailbox: targetMailbox,
                          folderId: null,
                          unreadOnly: false
                        });
                      }}
                      className={cx(
                        "flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-xs transition",
                        active
                          ? "bg-violet-100 font-semibold text-violet-700"
                          : "text-slate-600 hover:bg-white hover:text-slate-900"
                      )}
                    >
                      <span>{mailbox.nombre || mailbox.codigo}</span>
                      <span className="font-medium">
                        {mailbox.unread_count || mailbox.messages_count || 0}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Borradores
                </p>
                {loadingDrafts ? <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" /> : null}
              </div>

              <p className="text-xs text-slate-600">
                {drafts.length} borrador{drafts.length === 1 ? "" : "es"}
              </p>
            </div>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col border-r border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(event) => setFilters({ search: event.target.value })}
                placeholder="Buscar correo..."
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-300 focus:bg-white focus:ring-2 focus:ring-violet-100"
              />
            </div>

            <div className="mt-3 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setFilters({ unreadOnly: !filters.unreadOnly })}
                className={cx(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  filters.unreadOnly
                    ? "bg-violet-100 text-violet-700"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                )}
              >
                Solo no leídos
              </button>

              {loadingThreads ? (
                <span className="flex items-center gap-1 text-xs text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Cargando
                </span>
              ) : (
              <span className="text-xs text-slate-500">
  {threads.length} hilo{threads.length === 1 ? "" : "s"}
  {filters.mailbox === "inbox" && inboxTotal ? ` de ${inboxTotal} correos` : ""}
  {selectedFolder ? ` · ${getFolderName(selectedFolder)}` : ""}
</span>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <button
              type="button"
              onClick={toggleSelectAllVisibleThreads}
              className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              {allVisibleSelected ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              Seleccionar
            </button>

            {selectedCount > 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-violet-600">
                  {selectedCount} seleccionado{selectedCount === 1 ? "" : "s"}
                </span>

                {folders.length > 0 ? (
                  <select
                    value=""
                    onChange={(event) => {
                      const folderId = event.target.value;
                      event.target.value = "";
                      if (folderId) void handleMoveSelectedToFolder(folderId);
                    }}
                    className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50"
                  >
                    <option value="">Mover a...</option>
                    {folders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {getFolderName(folder)}
                      </option>
                    ))}
                  </select>
                ) : null}

                {filters.folderId ? (
                  <button
                    type="button"
                    onClick={() => void handleRemoveSelectedFromCurrentFolder()}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-100"
                  >
                    Quitar de carpeta
                  </button>
                ) : null}

                <button
                  type="button"
                  onClick={() => void handleBulkDelete()}
                  className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                >
                  {isTrashMailbox ? "Eliminar definitivo" : "Borrar"}
                </button>

                <button
                  type="button"
                  onClick={clearThreadSelection}
                  className="rounded-lg px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-100"
                >
                  Cancelar
                </button>
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {threads.length === 0 && !loadingThreads ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center text-slate-500">
                <MailOpen className="mb-3 h-10 w-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-700">No hay correos para mostrar</p>
                <p className="mt-1 text-xs">Probá actualizar o cambiar los filtros.</p>
              </div>
            ) : null}

            {threads.map((thread) => {
              const selected = selectedThread?.thread_id === thread.thread_id;
              const checked = selectedThreadIds.includes(thread.thread_id);
              const unread = Number(thread.unread_count || 0) > 0;

              return (
                <div
                  key={thread.thread_id}
                  className={cx(
                    "flex w-full gap-2 border-b border-slate-100 px-3 py-3 hover:bg-slate-50",
                    selected && "bg-violet-50 hover:bg-violet-50"
                  )}
                >
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      toggleThreadSelection(thread.thread_id);
                    }}
                    className="mt-0.5 h-7 w-7 shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-violet-600"
                    title={checked ? "Quitar selección" : "Seleccionar"}
                  >
                    {checked ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleSelectThread(thread)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="mb-1 flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p
                          className={cx(
                            "truncate text-sm",
                            unread ? "font-bold text-slate-950" : "font-semibold text-slate-700"
                          )}
                        >
                          {getThreadSender(thread)}
                        </p>
                        <p
                          className={cx(
                            "mt-0.5 truncate text-sm",
                            unread ? "font-bold text-slate-950" : "font-medium text-slate-700"
                          )}
                        >
                          {thread.subject || "(sin asunto)"}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-xs text-slate-400">
                          {formatShortDate(thread.last_message_at || thread.updated_at)}
                        </span>

                        {thread.is_starred ? <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" /> : null}
                      </div>
                    </div>

                    <p className="line-clamp-2 text-xs leading-5 text-slate-500">
                      {thread.last_snippet || "Sin vista previa"}
                    </p>

                    <div className="mt-2 flex items-center gap-2">
                      {unread ? (
                        <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[11px] font-semibold text-orange-700">
                          {thread.unread_count} sin leer
                        </span>
                      ) : null}

                      {thread.is_archived ? (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Archivado
                        </span>
                      ) : null}

                      <span className="text-[11px] text-slate-400">
                        {thread.messages_count} mensaje{thread.messages_count === 1 ? "" : "s"}
                      </span>
                    </div>
                  </button>
                </div>
              );
            })}
          </div>
        </section>

        <main className="flex min-h-0 flex-col bg-slate-50">
          {!selectedThread ? (
            <EmptyDetail />
          ) : (
            <>
              <div className="border-b border-slate-200 bg-white px-4 py-3">
                <div className="mb-3 grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-4">
  <div className="min-w-0 overflow-hidden">
    <div className="mb-1 flex min-w-0 items-center gap-2 overflow-hidden">
      <button
        type="button"
        onClick={() => void selectThread(null)}
        className="shrink-0 rounded-lg p-1 text-slate-500 hover:bg-slate-100 lg:hidden"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>

      <h2
        className="min-w-0 max-w-full truncate text-base font-semibold text-slate-900"
        title={selectedThread.subject || "(sin asunto)"}
      >
        {selectedThread.subject || "(sin asunto)"}
      </h2>
    </div>

    <p className="truncate text-xs text-slate-500">
      {selectedThread.messages_count} mensaje{selectedThread.messages_count === 1 ? "" : "s"}
      {" · "}
      Último: {formatDateTime(selectedThread.last_message_at)}
    </p>
  </div>

  <div className="flex max-w-[520px] shrink-0 flex-wrap items-center justify-end gap-2">
                        <button
                      type="button"
                      onClick={() => void handleRefreshSelectedThread()}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                      title="Actualizar hilo"
                    >
                      <RefreshCcw className={cx("h-4 w-4", loadingMessages && "animate-spin")} />
                    </button>

                    {selectedThreadUnreadMessage ? (
                      <button
                        type="button"
                        onClick={() => void markMessageRead(selectedThreadUnreadMessage.message_id, true)}
                        className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                        title="Marcar leído"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => void starThread(selectedThread.thread_id, !selectedThread.is_starred)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                      title={selectedThread.is_starred ? "Quitar destacado" : "Destacar"}
                    >
                      {selectedThread.is_starred ? (
                        <StarOff className="h-4 w-4" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void archiveThread(selectedThread.thread_id, !selectedThread.is_archived)}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                      title={selectedThread.is_archived ? "Desarchivar" : "Archivar"}
                    >
                      {selectedThread.is_archived ? (
                        <ArchiveRestore className="h-4 w-4" />
                      ) : (
                        <Archive className="h-4 w-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => void handleBulkDelete()}
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-red-50 hover:text-red-600"
                      title={isTrashMailbox ? "Eliminar definitivamente" : "Mover a Papelera"}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>

                    {folders.length > 0 ? (
                      <select
                        value=""
                        onChange={(event) => {
                          const folderId = event.target.value;
                          event.target.value = "";
                          if (folderId) void handleMoveSelectedToFolder(folderId);
                        }}
                        className="h-9 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-600 outline-none hover:bg-slate-50"
                        title="Mover a carpeta"
                      >
                        <option value="">Mover...</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {getFolderName(folder)}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {folders.length > 0 && selectedThread.last_from_email ? (
                      <select
                        value=""
                        onChange={(event) => {
                          const folderId = event.target.value;
                          event.target.value = "";
                          if (folderId) void handleCreateRuleFromSelectedSender(folderId);
                        }}
                        className="h-9 rounded-xl border border-blue-200 bg-blue-50 px-2 text-xs font-semibold text-blue-700 outline-none hover:bg-blue-100"
                        title="Crear regla automática por remitente"
                      >
                        <option value="">Regla remitente...</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {getFolderName(folder)}
                          </option>
                        ))}
                      </select>
                    ) : null}

                    {filters.folderId ? (
                      <button
                        type="button"
                        onClick={() => void handleRemoveSelectedFromCurrentFolder()}
                        className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100"
                        title="Quitar de esta carpeta"
                      >
                        Quitar
                      </button>
                    ) : null}

                    <button
                      type="button"
                      onClick={() => openReplyCompose(selectedThread)}
                      className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
                    >
                      <Reply className="h-4 w-4" />
                      Responder
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {loadingMessages ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Cargando mensajes...
                  </div>
                ) : null}

                {!loadingMessages && messages.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-slate-500">
                    No hay mensajes en este hilo.
                  </div>
                ) : null}

                <div className="space-y-4">
                  {messages.map((message) => {
                    const outbound = message.direction === "OUTBOUND";

                    return (
                      <article
                        key={message.message_id}
                        className={cx(
                          "rounded-2xl border bg-white p-4 shadow-sm",
                          outbound ? "border-violet-100" : "border-slate-200"
                        )}
                      >
                        <div className="mb-3 flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <div
                                className={cx(
                                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                                  outbound ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-700"
                                )}
                              >
                                {outbound ? "YO" : getMessageSender(message).slice(0, 2).toUpperCase()}
                              </div>

                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {getMessageSender(message)}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {outbound ? "Para: " : "De: "}
                                  {outbound
                                    ? formatAddressList(message.to_emails)
                                    : message.from_email || "—"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            <p className="text-xs text-slate-500">
                              {formatDateTime(message.received_at || message.sent_at || message.created_at)}
                            </p>
                            <span
                              className={cx(
                                "mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium",
                                outbound
                                  ? "bg-violet-50 text-violet-700"
                                  : message.read_at
                                    ? "bg-emerald-50 text-emerald-700"
                                    : "bg-orange-50 text-orange-700"
                              )}
                            >
                              {outbound ? message.status || "ENVIADO" : message.read_at ? "Leído" : "No leído"}
                            </span>
                          </div>
                        </div>

                        <div className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500">
                          <p>
                            <span className="font-semibold">Asunto:</span>{" "}
                            {message.subject || selectedThread.subject || "(sin asunto)"}
                          </p>
                          {message.cc_emails && message.cc_emails.length > 0 ? (
                            <p className="mt-1">
                              <span className="font-semibold">CC:</span>{" "}
                              {formatAddressList(message.cc_emails)}
                            </p>
                          ) : null}
                        </div>

                        <div
                          className="prose prose-sm max-w-none text-slate-700"
                          dangerouslySetInnerHTML={{ __html: getMessageBody(message) }}
                        />

                        {message.has_attachments ? (
                          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
                            Adjuntos detectados. La descarga de adjuntos se conecta en la siguiente etapa.
                          </div>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              </div>
            </>
          )}
        </main>
      </div>

      {compose.open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/25 p-6">
          <div
            className="relative flex max-h-[calc(100vh-48px)] max-w-[calc(100vw-48px)] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
            style={{
              width: composeSize.width,
              height: composeSize.height
            }}
          >
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900">
                  {compose.mode === "reply" ? "Responder correo" : "Nuevo correo"}
                </h3>
                <p className="text-xs text-slate-500">
                  Desde: {identity?.email || "Sin identidad"}
                </p>
              </div>

              <button
                type="button"
                onClick={closeCompose}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <div className="flex min-h-full flex-col space-y-3">
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Para</span>
                  <input
                    value={compose.to}
                    onChange={(event) => setCompose((prev) => ({ ...prev, to: event.target.value }))}
                    placeholder="cliente@email.com"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">CC</span>
                    <input
                      value={compose.cc}
                      onChange={(event) => setCompose((prev) => ({ ...prev, cc: event.target.value }))}
                      placeholder="Opcional"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-slate-500">BCC</span>
                    <input
                      value={compose.bcc}
                      onChange={(event) => setCompose((prev) => ({ ...prev, bcc: event.target.value }))}
                      placeholder="Opcional"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                    />
                  </label>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Asunto</span>
                  <input
                    value={compose.subject}
                    onChange={(event) => setCompose((prev) => ({ ...prev, subject: event.target.value }))}
                    placeholder="Asunto del correo"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-300 focus:ring-2 focus:ring-violet-100"
                  />
                </label>

                <div className="flex min-h-0 flex-1 flex-col">
                  <span className="mb-1 block text-xs font-semibold text-slate-500">Mensaje</span>

                  <div className="flex min-h-[340px] flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white focus-within:border-violet-300 focus-within:ring-2 focus-within:ring-violet-100">
                    <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 px-2 py-2">
                      <button
                        type="button"
                        onClick={() => runEditorCommand("bold")}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Negrita"
                      >
                        <Bold className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => runEditorCommand("italic")}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Cursiva"
                      >
                        <Italic className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => runEditorCommand("underline")}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Subrayado"
                      >
                        <Underline className="h-4 w-4" />
                      </button>

                      <span className="mx-1 h-6 w-px bg-slate-200" />

                      <button
                        type="button"
                        onClick={() => runEditorCommand("insertUnorderedList")}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Lista"
                      >
                        <List className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => runEditorCommand("insertOrderedList")}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Lista numerada"
                      >
                        <ListOrdered className="h-4 w-4" />
                      </button>

                      <span className="mx-1 h-6 w-px bg-slate-200" />

                      <button
                        type="button"
                        onClick={insertLink}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Insertar enlace"
                      >
                        <Link className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => imageInputRef.current?.click()}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Insertar imagen"
                      >
                        <ImageIcon className="h-4 w-4" />
                      </button>

                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="rounded-lg p-2 text-slate-600 hover:bg-white hover:text-violet-700"
                        title="Adjuntar archivo"
                      >
                        <Paperclip className="h-4 w-4" />
                      </button>

                      {compose.uploading ? (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-slate-500">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Subiendo...
                        </span>
                      ) : null}

                      <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => {
                          void handleAttachFiles(event.target.files);
                          event.target.value = "";
                        }}
                      />

                      <input
                        ref={imageInputRef}
                        type="file"
                        multiple
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => {
                          void handleInsertImages(event.target.files);
                          event.target.value = "";
                        }}
                      />
                    </div>

                    <div
                      ref={editorRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={syncEditorState}
                      className="min-h-[260px] w-full flex-1 overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-800 outline-none"
                      data-placeholder="Escribí el mensaje..."
                    />
                  </div>

                  {compose.attachments.length > 0 ? (
                    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Adjuntos
                      </p>

                      <div className="space-y-2">
                        {compose.attachments.map((attachment) => (
                          <div
                            key={attachment.public_url}
                            className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-700"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-medium">{attachment.filename}</p>
                              <p className="text-slate-400">
                                {(attachment.size_bytes / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeAttachment(attachment.public_url)}
                              className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3">
              <button
                type="button"
                onClick={closeCompose}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Trash2 className="h-4 w-4" />
                Descartar
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleSaveDraft()}
                  disabled={savingDraft || sending || compose.uploading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {savingDraft ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Guardar borrador
                </button>

                <button
                  type="button"
                  onClick={() => void handleSubmitCompose()}
                  disabled={sending || savingDraft || compose.uploading || !compose.to.trim()}
                  className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  Enviar
                </button>
              </div>
            </div>

            <button
              type="button"
              aria-label="Redimensionar"
              title="Redimensionar"
              onPointerDown={startComposeResize}
              onPointerMove={updateComposeResize}
              onPointerUp={stopComposeResize}
              onPointerCancel={stopComposeResize}
              className="absolute bottom-1 right-1 z-10 h-6 w-6 cursor-nwse-resize rounded-br-2xl text-slate-300 hover:text-violet-500"
            >
              <span className="absolute bottom-1 right-1 h-3 w-3 border-b-2 border-r-2 border-current" />
            </button>
          </div>
        </div>
      ) : null}

      {deleteForeverModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/30 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
            <div className="mb-4 flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
                <Trash2 className="h-5 w-5" />
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Eliminar definitivamente
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Vas a eliminar {selectedCount} correo{selectedCount === 1 ? "" : "s"} de la papelera.
                  Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteForeverModalOpen(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={() => void confirmDeleteForever()}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Eliminar definitivamente
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default MailPanel;