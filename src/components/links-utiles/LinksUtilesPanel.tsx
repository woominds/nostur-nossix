// src/components/links/LinksUtilesPanel.tsx

import { useEffect, useState } from "react";
import type { ComponentType, ReactNode } from "react";
import {
  Building2,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  ExternalLink,
  KeyRound,
  Link2,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X
} from "lucide-react";
import {
  useLinksUtilesStore,
  type AccesoDraft,
  type AccesoRestringido,
  type CuentaBancariaDraft,
  type CuentaBancariaUtil,
  type LinkUtil,
  type LinkUtilDraft,
  type LinksUtilesTab
} from "../../store/linksUtilesStore";
import { IconButton } from "../ui/IconButton";

type ToastState = {
  type: "success" | "error";
  message: string;
} | null;

type ConfirmState = {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
} | null;

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1 block text-[10px] font-medium uppercase tracking-[0.12em] text-[#64748b]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text"
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      value={value}
      type={type}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-8 w-full rounded-[10px] border border-black/10 bg-white px-3 text-[12px] font-normal text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
    />
  );
}

function TextArea({
  value,
  onChange,
  placeholder
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="min-h-[78px] w-full resize-none rounded-[10px] border border-black/10 bg-white px-3 py-2 text-[12px] font-normal leading-relaxed text-[#172033] outline-none transition placeholder:text-[#94a3b8] focus:border-[#4f7c90]"
    />
  );
}

function Toast({ toast, onClose }: { toast: ToastState; onClose: () => void }) {
  useEffect(() => {
    if (!toast) return;

    const timer = window.setTimeout(() => {
      onClose();
    }, 3200);

    return () => window.clearTimeout(timer);
  }, [toast, onClose]);

  if (!toast) return null;

  return (
    <div className="fixed right-5 top-5 z-[260] w-[300px] rounded-[14px] border border-black/10 bg-white px-3.5 py-3 text-[12px] shadow-2xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className={[
              "mb-0.5 font-semibold",
              toast.type === "success" ? "text-emerald-700" : "text-red-700"
            ].join(" ")}
          >
            {toast.type === "success" ? "Operación exitosa" : "Atención"}
          </div>

          <div className="font-normal leading-relaxed text-[#334155]">{toast.message}</div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[9px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

function ConfirmModal({
  confirm,
  saving,
  onClose
}: {
  confirm: ConfirmState;
  saving: boolean;
  onClose: () => void;
}) {
  if (!confirm) return null;

  return (
    <div className="fixed inset-0 z-[280] flex items-start justify-center bg-black/35 px-4 pt-24 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[16px] font-semibold text-[#172033]">{confirm.title}</h2>
            <p className="mt-1 text-[12px] font-normal leading-relaxed text-[#64748b]">
              {confirm.message}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033] disabled:opacity-50"
          >
            <X size={16} />
          </button>
        </div>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033] disabled:opacity-50"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={confirm.onConfirm}
            className={[
              "h-8 rounded-[10px] px-4 text-[12px] font-medium text-white shadow-sm disabled:opacity-50",
              confirm.danger ? "bg-red-600 hover:bg-red-700" : "bg-[#4f7c90] hover:bg-[#406b7d]"
            ].join(" ")}
          >
            {saving ? "Procesando..." : confirm.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  onClick
}: {
  active: boolean;
  icon: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "inline-flex h-8 items-center gap-1.5 rounded-[10px] px-3 text-[11px] font-medium transition",
        active
          ? "bg-[#4f7c90] text-white shadow-sm"
          : "bg-white text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc]"
      ].join(" ")}
    >
      <Icon size={13} strokeWidth={1.8} />
      {label}
    </button>
  );
}

function copyText(value: string, onDone: () => void) {
  if (!value.trim()) return;

  navigator.clipboard.writeText(value);
  onDone();
}

function createLinkDraft(item: LinkUtil | null): LinkUtilDraft {
  return {
    herramienta: item?.herramienta || "",
    url: item?.url || "",
    observaciones: item?.observaciones || ""
  };
}

function createCuentaDraft(item: CuentaBancariaUtil | null): CuentaBancariaDraft {
  return {
    banco: item?.banco || "",
    cbu: item?.cbu || "",
    alias: item?.alias || "",
    cuit: item?.cuit || "",
    titular_cuenta: item?.titular_cuenta || "",
    observaciones: item?.observaciones || ""
  };
}

function createAccesoDraft(item: AccesoRestringido | null): AccesoDraft {
  return {
    titulo: item?.titulo || "",
    url: item?.url || "",
    usuario: item?.usuario || "",
    password: item?.password || "",
    observaciones: item?.observaciones || ""
  };
}

function LinkModal({
  item,
  saving,
  onClose,
  onSave
}: {
  item: LinkUtil | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: LinkUtilDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<LinkUtilDraft>(() => createLinkDraft(item));

  useEffect(() => {
    setDraft(createLinkDraft(item));
  }, [item?.id]);

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center bg-black/35 px-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {item ? "Editar link" : "Nuevo link útil"}
            </h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Herramienta, URL y observaciones.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-3">
          <div>
            <FieldLabel>Herramienta</FieldLabel>
            <TextInput
              value={draft.herramienta}
              onChange={(value) => setDraft((current) => ({ ...current, herramienta: value }))}
              placeholder="Ej: Ábaco, Experts, banco, proveedor..."
            />
          </div>

          <div>
            <FieldLabel>URL</FieldLabel>
            <TextInput
              value={draft.url}
              onChange={(value) => setDraft((current) => ({ ...current, url: value }))}
              placeholder="https://..."
            />
          </div>

          <div>
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea
              value={draft.observaciones}
              onChange={(value) => setDraft((current) => ({ ...current, observaciones: value }))}
              placeholder="Notas opcionales..."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CuentaModal({
  item,
  saving,
  onClose,
  onSave
}: {
  item: CuentaBancariaUtil | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: CuentaBancariaDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<CuentaBancariaDraft>(() => createCuentaDraft(item));

  useEffect(() => {
    setDraft(createCuentaDraft(item));
  }, [item?.id]);

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center bg-black/35 px-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {item ? "Editar cuenta bancaria" : "Nueva cuenta bancaria"}
            </h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Banco, CBU, alias, CUIT y titular.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Banco</FieldLabel>
            <TextInput
              value={draft.banco}
              onChange={(value) => setDraft((current) => ({ ...current, banco: value }))}
              placeholder="Banco"
            />
          </div>

          <div>
            <FieldLabel>Titular</FieldLabel>
            <TextInput
              value={draft.titular_cuenta}
              onChange={(value) => setDraft((current) => ({ ...current, titular_cuenta: value }))}
              placeholder="Titular de cuenta"
            />
          </div>

          <div>
            <FieldLabel>CBU</FieldLabel>
            <TextInput
              value={draft.cbu}
              onChange={(value) => setDraft((current) => ({ ...current, cbu: value }))}
              placeholder="CBU"
            />
          </div>

          <div>
            <FieldLabel>Alias</FieldLabel>
            <TextInput
              value={draft.alias}
              onChange={(value) => setDraft((current) => ({ ...current, alias: value }))}
              placeholder="Alias"
            />
          </div>

          <div>
            <FieldLabel>CUIT</FieldLabel>
            <TextInput
              value={draft.cuit}
              onChange={(value) => setDraft((current) => ({ ...current, cuit: value }))}
              placeholder="CUIT"
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea
              value={draft.observaciones}
              onChange={(value) => setDraft((current) => ({ ...current, observaciones: value }))}
              placeholder="Notas opcionales..."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AccesoModal({
  item,
  saving,
  onClose,
  onSave
}: {
  item: AccesoRestringido | null;
  saving: boolean;
  onClose: () => void;
  onSave: (draft: AccesoDraft) => Promise<void>;
}) {
  const [draft, setDraft] = useState<AccesoDraft>(() => createAccesoDraft(item));

  useEffect(() => {
    setDraft(createAccesoDraft(item));
  }, [item?.id]);

  return (
    <div className="fixed inset-0 z-[220] flex items-start justify-center bg-black/35 px-4 pt-16 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[18px] border border-black/10 bg-white p-4 text-[#172033] shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold text-[#172033]">
              {item ? "Editar acceso" : "Nuevo acceso"}
            </h2>
            <p className="mt-0.5 text-[12px] font-normal text-[#64748b]">
              Visible solo para perfiles autorizados.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            <X size={16} />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel>Título</FieldLabel>
            <TextInput
              value={draft.titulo}
              onChange={(value) => setDraft((current) => ({ ...current, titulo: value }))}
              placeholder="Ej: Portal proveedor"
            />
          </div>

          <div>
            <FieldLabel>URL</FieldLabel>
            <TextInput
              value={draft.url}
              onChange={(value) => setDraft((current) => ({ ...current, url: value }))}
              placeholder="https://..."
            />
          </div>

          <div>
            <FieldLabel>Usuario</FieldLabel>
            <TextInput
              value={draft.usuario}
              onChange={(value) => setDraft((current) => ({ ...current, usuario: value }))}
              placeholder="Usuario"
            />
          </div>

          <div>
            <FieldLabel>Password</FieldLabel>
            <TextInput
              value={draft.password}
              onChange={(value) => setDraft((current) => ({ ...current, password: value }))}
              placeholder="Password"
            />
          </div>

          <div className="md:col-span-2">
            <FieldLabel>Observaciones</FieldLabel>
            <TextArea
              value={draft.observaciones}
              onChange={(value) => setDraft((current) => ({ ...current, observaciones: value }))}
              placeholder="Notas opcionales..."
            />
          </div>
        </div>

        <div className="mt-5 flex justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[12px] font-medium text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
          >
            Cancelar
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={() => onSave(draft)}
            className="h-8 rounded-[10px] bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function LinksUtilesPanel() {
  const loading = useLinksUtilesStore((state) => state.loading);
  const saving = useLinksUtilesStore((state) => state.saving);
  const error = useLinksUtilesStore((state) => state.error);
  const canManageLinksUtiles = useLinksUtilesStore((state) => state.canManageLinksUtiles);
  const filters = useLinksUtilesStore((state) => state.filters);

  const loadLinksUtiles = useLinksUtilesStore((state) => state.loadLinksUtiles);
  const clearError = useLinksUtilesStore((state) => state.clearError);
  const setFilter = useLinksUtilesStore((state) => state.setFilter);

  const createLink = useLinksUtilesStore((state) => state.createLink);
  const updateLink = useLinksUtilesStore((state) => state.updateLink);
  const deleteLink = useLinksUtilesStore((state) => state.deleteLink);

  const createCuenta = useLinksUtilesStore((state) => state.createCuenta);
  const updateCuenta = useLinksUtilesStore((state) => state.updateCuenta);
  const deleteCuenta = useLinksUtilesStore((state) => state.deleteCuenta);

  const createAcceso = useLinksUtilesStore((state) => state.createAcceso);
  const updateAcceso = useLinksUtilesStore((state) => state.updateAcceso);
  const deleteAcceso = useLinksUtilesStore((state) => state.deleteAcceso);

  const getFilteredLinks = useLinksUtilesStore((state) => state.getFilteredLinks);
  const getFilteredCuentas = useLinksUtilesStore((state) => state.getFilteredCuentas);
  const getFilteredAccesos = useLinksUtilesStore((state) => state.getFilteredAccesos);

  const links = getFilteredLinks();
  const cuentas = getFilteredCuentas();
  const accesos = getFilteredAccesos();

  const [activeTab, setActiveTab] = useState<LinksUtilesTab>("links");
  const [toast, setToast] = useState<ToastState>(null);
  const [confirm, setConfirm] = useState<ConfirmState>(null);

  const [linkModal, setLinkModal] = useState<LinkUtil | null>(null);
  const [linkModalOpen, setLinkModalOpen] = useState(false);

  const [cuentaModal, setCuentaModal] = useState<CuentaBancariaUtil | null>(null);
  const [cuentaModalOpen, setCuentaModalOpen] = useState(false);

  const [accesoModal, setAccesoModal] = useState<AccesoRestringido | null>(null);
  const [accesoModalOpen, setAccesoModalOpen] = useState(false);

  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadLinksUtiles();
  }, [loadLinksUtiles]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ type, message });
  }

  function openCreate() {
    if (activeTab === "links") {
      setLinkModal(null);
      setLinkModalOpen(true);
      return;
    }

    if (activeTab === "cuentas") {
      setCuentaModal(null);
      setCuentaModalOpen(true);
      return;
    }

    setAccesoModal(null);
    setAccesoModalOpen(true);
  }

  function handleDeleteLink(item: LinkUtil) {
    setConfirm({
      title: "Eliminar link",
      message: `¿Querés eliminar definitivamente el link "${item.herramienta}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
      onConfirm: async () => {
        const ok = await deleteLink(item);

        if (ok) {
          setConfirm(null);
          showToast("Link eliminado.");
        }
      }
    });
  }

  function handleDeleteCuenta(item: CuentaBancariaUtil) {
    setConfirm({
      title: "Eliminar cuenta bancaria",
      message: `¿Querés eliminar definitivamente la cuenta de "${item.banco}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
      onConfirm: async () => {
        const ok = await deleteCuenta(item);

        if (ok) {
          setConfirm(null);
          showToast("Cuenta eliminada.");
        }
      }
    });
  }

  function handleDeleteAcceso(item: AccesoRestringido) {
    setConfirm({
      title: "Eliminar acceso",
      message: `¿Querés eliminar definitivamente el acceso "${item.titulo}"? Esta acción no se puede deshacer.`,
      confirmLabel: "Eliminar",
      danger: true,
      onConfirm: async () => {
        const ok = await deleteAcceso(item);

        if (ok) {
          setConfirm(null);
          showToast("Acceso eliminado.");
        }
      }
    });
  }

  function getActiveCount(): number {
    if (activeTab === "links") return links.length;
    if (activeTab === "cuentas") return cuentas.length;
    return accesos.length;
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/78 px-5 py-3 backdrop-blur-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                Links útiles
              </h1>

              <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                Recursos
              </span>
            </div>

            <p className="mt-1 text-[12px] font-normal text-[#64748b]">
              Links, cuentas bancarias y accesos internos del equipo.
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            <button
              type="button"
              onClick={loadLinksUtiles}
              disabled={loading}
              className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
            >
              <RefreshCcw size={13} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>

            {canManageLinksUtiles ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-[#4f7c90] px-2.5 text-[11px] font-medium text-white shadow-sm transition hover:bg-[#406b7d]"
              >
                <Plus size={13} />
                Nuevo
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-3.5">
        {error ? (
          <div className="mb-3 flex items-start justify-between gap-3 rounded-[12px] border border-red-200 bg-red-50 px-3 py-2.5 text-[12px] font-medium text-red-700">
            <span>{error}</span>

            <button type="button" onClick={clearError} className="text-red-500 hover:text-red-700">
              <X size={14} />
            </button>
          </div>
        ) : null}

        <section className="relative z-[40] mb-3 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <TabButton
                active={activeTab === "links"}
                icon={Link2}
                label="Links útiles"
                onClick={() => setActiveTab("links")}
              />

              <TabButton
                active={activeTab === "cuentas"}
                icon={Building2}
                label="Cuentas bancarias"
                onClick={() => setActiveTab("cuentas")}
              />

              {canManageLinksUtiles ? (
                <TabButton
                  active={activeTab === "accesos"}
                  icon={KeyRound}
                  label="Accesos"
                  onClick={() => setActiveTab("accesos")}
                />
              ) : null}
            </div>

            <div className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-nostur-orange ring-1 ring-orange-100">
              {loading ? "Cargando..." : `${getActiveCount()} resultados`}
            </div>
          </div>

          <div className="mt-3 flex h-8 items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
            <Search size={14} className="shrink-0 text-[#94a3b8]" />

            <input
              value={filters.search}
              onChange={(event) => setFilter("search", event.target.value)}
              placeholder="Buscar por herramienta, banco, titular, alias, usuario, URL..."
              className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
            />
          </div>
        </section>

        <section className="relative z-0 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          {activeTab === "links" ? (
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">Links útiles</h2>
                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    Herramientas, sistemas externos y accesos rápidos.
                  </p>
                </div>
              </div>

              {links.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  No hay links útiles.
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {links.map((item) => (
                    <div
                      key={item.id}
                      className="grid min-w-0 gap-2 rounded-[12px] border border-black/10 bg-[#f8fafc] px-2.5 py-2 transition hover:bg-white lg:grid-cols-[1.1fr_minmax(0,1.5fr)_minmax(0,1fr)_112px]"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-semibold text-[#172033]">
                          {item.herramienta}
                        </div>
                        <div className="truncate text-[11px] font-normal text-[#64748b]">
                          Herramienta
                        </div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-medium text-[#4f7c90]">
                          {item.url}
                        </div>
                        <div className="truncate text-[11px] font-normal text-[#64748b]">URL</div>
                      </div>

                      <div className="min-w-0">
                        <div className="truncate text-[12px] font-normal text-[#334155]">
                          {item.observaciones || "Sin observaciones"}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-1">
                        <IconButton
                          icon={ExternalLink}
                          label="Abrir"
                          onClick={() => window.open(item.url, "_blank")}
                        />

                        {canManageLinksUtiles ? (
                          <>
                            <IconButton
                              icon={Edit3}
                              label="Editar"
                              onClick={() => {
                                setLinkModal(item);
                                setLinkModalOpen(true);
                              }}
                            />

                            <IconButton
                              icon={Trash2}
                              label="Eliminar"
                              className="text-red-600"
                              onClick={() => handleDeleteLink(item)}
                            />
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "cuentas" ? (
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">Cuentas bancarias</h2>
                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    Datos bancarios frecuentes para copiar y enviar.
                  </p>
                </div>
              </div>

              {cuentas.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  No hay cuentas bancarias.
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {cuentas.map((item) => {
                    const textoCuenta = [
                      `Banco: ${item.banco}`,
                      `Titular: ${item.titular_cuenta}`,
                      item.cuit ? `CUIT: ${item.cuit}` : "",
                      item.cbu ? `CBU: ${item.cbu}` : "",
                      item.alias ? `Alias: ${item.alias}` : ""
                    ]
                      .filter(Boolean)
                      .join("\n");

                    return (
                      <div
                        key={item.id}
                        className="grid min-w-0 gap-2 rounded-[12px] border border-black/10 bg-[#f8fafc] px-2.5 py-2 transition hover:bg-white lg:grid-cols-[1fr_1.1fr_1fr_1fr_126px]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {item.banco}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            Banco
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {item.titular_cuenta}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            CUIT {item.cuit || "—"}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-medium text-[#4f7c90]">
                            {item.alias || "Sin alias"}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            Alias
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {item.cbu || "Sin CBU"}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">CBU</div>
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon={Copy}
                            label="Copiar datos"
                            onClick={() => copyText(textoCuenta, () => showToast("Datos copiados."))}
                          />

                          {canManageLinksUtiles ? (
                            <>
                              <IconButton
                                icon={Edit3}
                                label="Editar"
                                onClick={() => {
                                  setCuentaModal(item);
                                  setCuentaModalOpen(true);
                                }}
                              />

                              <IconButton
                                icon={Trash2}
                                label="Eliminar"
                                className="text-red-600"
                                onClick={() => handleDeleteCuenta(item)}
                              />
                            </>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {activeTab === "accesos" && canManageLinksUtiles ? (
            <div>
              <div className="mb-2.5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-[14px] font-semibold text-[#172033]">Accesos restringidos</h2>
                  <p className="text-[11.5px] font-normal text-[#64748b]">
                    Usuarios y contraseñas internas para perfiles autorizados.
                  </p>
                </div>
              </div>

              {accesos.length === 0 ? (
                <div className="rounded-[14px] border border-black/10 bg-[#f8fafc] p-5 text-center text-[12px] font-normal text-[#64748b]">
                  No hay accesos cargados.
                </div>
              ) : (
                <div className="grid gap-1.5">
                  {accesos.map((item) => {
                    const passwordVisible = Boolean(visiblePasswords[item.id]);

                    return (
                      <div
                        key={item.id}
                        className="grid min-w-0 gap-2 rounded-[12px] border border-black/10 bg-[#f8fafc] px-2.5 py-2 transition hover:bg-white lg:grid-cols-[1fr_1fr_1fr_1fr_160px]"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {item.titulo}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            {item.url || "Sin URL"}
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-semibold text-[#172033]">
                            {item.usuario || "Sin usuario"}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            Usuario
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-medium text-[#4f7c90]">
                            {passwordVisible ? item.password || "Sin password" : "••••••••"}
                          </div>
                          <div className="truncate text-[11px] font-normal text-[#64748b]">
                            Password
                          </div>
                        </div>

                        <div className="min-w-0">
                          <div className="truncate text-[12px] font-normal text-[#334155]">
                            {item.observaciones || "Sin observaciones"}
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-1">
                          <IconButton
                            icon={passwordVisible ? EyeOff : Eye}
                            label={passwordVisible ? "Ocultar" : "Ver"}
                            onClick={() =>
                              setVisiblePasswords((current) => ({
                                ...current,
                                [item.id]: !current[item.id]
                              }))
                            }
                          />

                          <IconButton
                            icon={Copy}
                            label="Copiar password"
                            onClick={() => copyText(item.password || "", () => showToast("Password copiado."))}
                          />

                          {item.url ? (
                            <IconButton
                              icon={ExternalLink}
                              label="Abrir"
                              onClick={() => window.open(item.url || "", "_blank")}
                            />
                          ) : null}

                          <IconButton
                            icon={Edit3}
                            label="Editar"
                            onClick={() => {
                              setAccesoModal(item);
                              setAccesoModalOpen(true);
                            }}
                          />

                          <IconButton
                            icon={Trash2}
                            label="Eliminar"
                            className="text-red-600"
                            onClick={() => handleDeleteAcceso(item)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </main>

      {linkModalOpen ? (
        <LinkModal
          item={linkModal}
          saving={saving}
          onClose={() => {
            setLinkModal(null);
            setLinkModalOpen(false);
          }}
          onSave={async (draft) => {
            const ok = linkModal ? await updateLink(linkModal, draft) : await createLink(draft);

            if (ok) {
              setLinkModal(null);
              setLinkModalOpen(false);
              showToast("Link guardado.");
            }
          }}
        />
      ) : null}

      {cuentaModalOpen ? (
        <CuentaModal
          item={cuentaModal}
          saving={saving}
          onClose={() => {
            setCuentaModal(null);
            setCuentaModalOpen(false);
          }}
          onSave={async (draft) => {
            const ok = cuentaModal ? await updateCuenta(cuentaModal, draft) : await createCuenta(draft);

            if (ok) {
              setCuentaModal(null);
              setCuentaModalOpen(false);
              showToast("Cuenta guardada.");
            }
          }}
        />
      ) : null}

      {accesoModalOpen ? (
        <AccesoModal
          item={accesoModal}
          saving={saving}
          onClose={() => {
            setAccesoModal(null);
            setAccesoModalOpen(false);
          }}
          onSave={async (draft) => {
            const ok = accesoModal ? await updateAcceso(accesoModal, draft) : await createAcceso(draft);

            if (ok) {
              setAccesoModal(null);
              setAccesoModalOpen(false);
              showToast("Acceso guardado.");
            }
          }}
        />
      ) : null}

      <ConfirmModal confirm={confirm} saving={saving} onClose={() => setConfirm(null)} />
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}

export default LinksUtilesPanel;