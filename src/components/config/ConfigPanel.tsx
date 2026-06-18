// src/components/config/ConfigPanel.tsx

import { useEffect, useMemo, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  AlertTriangle,
  Building2,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  Database,
  Eye,
  EyeOff,
  Hotel,
  KeyRound,
  Landmark,
  MapPin,
  Pencil,
  Plus,
  RefreshCcw,
  Save,
  Search,
  Tag,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UploadCloud,
  UserRound,
  X
} from "lucide-react";
import { appRegistry } from "../../registry/appRegistry";
import {
  useConfigStore,
  type AppRole,
  type Caja,
  type CategoriaFinanciera,
  type CategoriaTipo,
  type Destino,
  type FormaPago,
  type HotelMaestro,
  type MetodoContacto,
  type Operador,
  type Profile,
  type Proveedor,
  type Servicio,
  type Sucursal,
  type UserCredential
} from "../../store/configStore";
import { ImportadorCatalogosPanel } from "./ImportadorCatalogosPanel";
import { DeployActionsPanel } from "./DeployActionsPanel";

type ConfigTab =
  | "sucursales"
  | "profiles"
  | "metodos_contacto"
  | "destinos"
  | "formas_pago"
  | "cajas"
  | "categorias_financieras"
  | "operadores"
  | "proveedores"
  | "servicios"
  | "hoteles_maestros"
  | "credenciales"
  | "importador";

type SelectOption = {
  value: string;
  label: string;
};

type FormState = Record<string, string | boolean | number | null | undefined>;

type NoticeState = {
  type: "info" | "error" | "success";
  title: string;
  message: string;
} | null;

const tabs: Array<{
  id: ConfigTab;
  label: string;
  icon: typeof Building2;
}> = [
  { id: "sucursales", label: "Sucursales", icon: Building2 },
  { id: "profiles", label: "Usuarios", icon: UserRound },
  { id: "metodos_contacto", label: "Métodos", icon: Tag },
  { id: "destinos", label: "Destinos", icon: MapPin },
  { id: "formas_pago", label: "Pagos", icon: CreditCard },
  { id: "cajas", label: "Cajas", icon: Landmark },
  { id: "categorias_financieras", label: "Categorías", icon: CircleDollarSign },
  { id: "operadores", label: "Operadores", icon: BriefcaseBusiness },
  { id: "proveedores", label: "Proveedores", icon: Database },
  { id: "servicios", label: "Servicios", icon: Tag },
  { id: "hoteles_maestros", label: "Hoteles", icon: Hotel },
  { id: "credenciales", label: "Credenciales", icon: KeyRound },
  { id: "importador", label: "Importador", icon: UploadCloud }
];

const appRoleOptions: SelectOption[] = [
  { value: "vendedor", label: "Vendedor" },
  { value: "administracion", label: "Administración" },
  { value: "gerencia", label: "Gerencia" },
  { value: "admin_general", label: "Admin general" }
];

const categoriaTipoOptions: SelectOption[] = [
  { value: "ingreso", label: "Ingreso" },
  { value: "egreso", label: "Egreso" }
];

const cajaTipoOptions: SelectOption[] = [
  { value: "CAJA", label: "Caja" },
  { value: "BANCO", label: "Banco" },
  { value: "BILLETERA", label: "Billetera" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "ALMUNDO", label: "Almundo" },
  { value: "OTRA", label: "Otra" }
];

const monedaOptions: SelectOption[] = [
  { value: "ARS", label: "ARS" },
  { value: "USD", label: "USD" }
];

function getInitialForm(tab: ConfigTab): FormState {
  if (tab === "sucursales") {
    return {
      nombre: "",
      color: "#FF6A00",
      activa: true,
      activo: true
    };
  }

  if (tab === "profiles") {
    return {
      id: "",
      nombre: "",
      apellido: "",
      email: "",
      sucursal_id: "",
      rol: "vendedor",
      color: "#FF6A00",
      activo: true
    };
  }

  if (tab === "metodos_contacto") {
    return {
      nombre: "",
      color: "#FF6A00",
      activo: true
    };
  }

  if (tab === "destinos") {
    return {
      nombre: "",
      pais: "Argentina",
      activo: true
    };
  }

  if (tab === "formas_pago") {
    return {
      nombre: "",
      impacta_tesoreria: true,
      activo: true
    };
  }

  if (tab === "cajas") {
    return {
      nombre: "",
      tipo: "CAJA",
      moneda: "ARS",
      sucursal_id: "",
      descripcion: "",
      orden: "100",
      activa: true,
      activo: true
    };
  }

  if (tab === "categorias_financieras") {
    return {
      nombre: "",
      tipo: "egreso",
      activa: true,
      activo: true
    };
  }

  if (tab === "operadores") {
    return {
      nombre: "",
      color: "#FF6A00",
      razon_social: "",
      cuit: "",
      activo: true
    };
  }

  if (tab === "proveedores") {
    return {
      nombre_comercial: "",
      razon_social: "",
      cuit: "",
      telefono: "",
      activo: true
    };
  }

  if (tab === "servicios") {
    return {
      nombre: "",
      color: "#FF6A00",
      activo: true
    };
  }

  if (tab === "hoteles_maestros") {
    return {
      nombre: "",
      ubicacion: "",
      categoria: "",
      descripcion: "",
      imagenes: "[]",
      regimen: "",
      tipo_habitacion: "",
      tipo_tarifa: "",
      cargos_adicionales: false,
      descripcion_cargos: "",
      veces_usado: 0,
      ultimo_uso: "",
      activo: true
    };
  }

  if (tab === "credenciales") {
    return {
      service_key: "experts",
      username: "",
      password_encrypted: "",
      autofill_enabled: true,
      auto_submit_enabled: false
    };
  }

  return {};
}

function normalizeText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getItemName(tab: ConfigTab, item: Record<string, unknown>): string {
  if (tab === "profiles") {
    return `${String(item.nombre || "")} ${String(item.apellido || "")}`.trim();
  }

  if (tab === "proveedores") {
    return String(item.nombre_comercial || "");
  }

  if (tab === "credenciales") {
    const serviceKey = String(item.service_key || "");
    const app = appRegistry.find((registeredApp) => registeredApp.id === serviceKey);
    return app?.name || serviceKey;
  }

  return String(item.nombre || "");
}

function getItemSubtitle(tab: ConfigTab, item: Record<string, unknown>): string {
  if (tab === "profiles") {
    return `${String(item.email || "")} · ${String(item.rol || "")}`;
  }

  if (tab === "destinos") {
    return String(item.pais || "Sin especificar");
  }

  if (tab === "formas_pago") {
    return Boolean(item.impacta_tesoreria) ? "Impacta tesorería" : "No impacta tesorería";
  }

  if (tab === "cajas") {
    return [
      item.tipo || "CAJA",
      item.moneda || "ARS",
      item.descripcion,
      item.orden ? `Orden ${item.orden}` : null
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (tab === "categorias_financieras") {
    return String(item.tipo || "");
  }

  if (tab === "operadores") {
    return [item.razon_social, item.cuit].filter(Boolean).join(" · ");
  }

  if (tab === "proveedores") {
    return [item.razon_social, item.cuit, item.telefono].filter(Boolean).join(" · ");
  }

  if (tab === "hoteles_maestros") {
    return [
      item.ubicacion,
      item.categoria ? `${item.categoria} estrellas` : null,
      item.regimen,
      item.tipo_habitacion,
      item.tipo_tarifa
    ]
      .filter(Boolean)
      .join(" · ");
  }

  if (tab === "credenciales") {
    return String(item.username || "Sin usuario cargado");
  }

  return "";
}

function getIsActive(tab: ConfigTab, item: Record<string, unknown>): boolean {
  if (tab === "sucursales" || tab === "cajas" || tab === "categorias_financieras") {
    return Boolean(item.activa ?? item.activo);
  }

  if (tab === "credenciales") {
    return Boolean(item.autofill_enabled);
  }

  return Boolean(item.activo);
}

function getColor(tab: ConfigTab, item: Record<string, unknown>): string {
  if (typeof item.color === "string" && item.color) {
    return item.color;
  }

  if (tab === "profiles") return "#3b82f6";
  if (tab === "destinos") return "#22c55e";
  if (tab === "formas_pago") return "#f97316";
  if (tab === "cajas") return "#64748b";
  if (tab === "categorias_financieras") return "#a855f7";
  if (tab === "proveedores") return "#0ea5e9";
  if (tab === "hoteles_maestros") return "#14b8a6";
  if (tab === "credenciales") return "#ff6a00";

  return "#FF6A00";
}

function asString(value: unknown): string {
  return String(value || "");
}

function asBoolean(value: unknown): boolean {
  return Boolean(value);
}

function asNumber(value: unknown, fallback = 100): number {
  const parsed = Number(String(value || "").replace(/\./g, "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function asNullableNumber(value: unknown): number | null {
  const clean = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  if (!clean) return null;

  const parsed = Number(clean);

  return Number.isFinite(parsed) ? parsed : null;
}

type HotelImageItem = {
  id?: string;
  url: string;
  description?: string;
};

function parseHotelImages(value: unknown): HotelImageItem[] {
  function normalizeImage(item: unknown): HotelImageItem | null {
    if (!item || typeof item !== "object") return null;

    const rawItem = item as Record<string, unknown>;
    const url = String(rawItem.url || "").trim();

    if (!url) return null;

    return {
      id: rawItem.id ? String(rawItem.id) : undefined,
      url,
      description: rawItem.description ? String(rawItem.description) : undefined
    };
  }

  if (Array.isArray(value)) {
    return value.map(normalizeImage).filter((item): item is HotelImageItem => Boolean(item));
  }

  const raw = String(value || "").trim();

  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);

    if (Array.isArray(parsed)) {
      return parsed.map(normalizeImage).filter((item): item is HotelImageItem => Boolean(item));
    }

    const image = normalizeImage(parsed);
    return image ? [image] : [];
  } catch {
    return [];
  }
}

function stringifyHotelImages(value: unknown): string {
  const images = parseHotelImages(value);

  if (images.length === 0) return "[]";

  return JSON.stringify(images, null, 2);
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[10px] font-black uppercase tracking-[0.14em] text-[#64748b]">
      {children}
    </label>
  );
}

function TextInput({
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="h-9 w-full rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-xs font-semibold text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-nostur-orange disabled:cursor-not-allowed disabled:opacity-60"
      placeholder={placeholder}
      type={type}
      disabled={disabled}
    />
  );
}

function normalizeHexColor(value: unknown, fallback = "#FF6A00"): string {
  const raw = String(value || "").trim();

  if (/^#[0-9A-Fa-f]{6}$/.test(raw)) {
    return raw.toUpperCase();
  }

  if (/^[0-9A-Fa-f]{6}$/.test(raw)) {
    return `#${raw}`.toUpperCase();
  }

  return fallback;
}

function cleanHexInput(value: string): string {
  const raw = value.trim().replace(/[^0-9A-Fa-f#]/g, "");

  if (!raw) return "";

  const withoutHash = raw.replace(/#/g, "").slice(0, 6);

  return `#${withoutHash}`.toUpperCase();
}

function ColorInput({
  value,
  onChange,
  fallback = "#FF6A00"
}: {
  value: string;
  onChange: (value: string) => void;
  fallback?: string;
}) {
  const safeValue = normalizeHexColor(value, fallback);

  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={safeValue}
        onChange={(event) => onChange(event.target.value.toUpperCase())}
        className="h-9 w-11 shrink-0 cursor-pointer rounded-xl border border-black/10 bg-[#f8fafc] p-1 outline-none transition hover:bg-white"
        title="Seleccionar color"
      />

      <input
        value={value}
        onChange={(event) => onChange(cleanHexInput(event.target.value))}
        onBlur={() => onChange(normalizeHexColor(value, fallback))}
        placeholder={fallback}
        className="h-9 min-w-0 flex-1 rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-xs font-semibold uppercase text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-nostur-orange"
      />

      <div
        className="h-9 w-9 shrink-0 rounded-xl border border-black/10 shadow-sm"
        style={{ backgroundColor: safeValue }}
        title={safeValue}
      />
    </div>
  );
}

function TextArea({
  value,
  onChange,
  placeholder,
  minHeight = 92
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      style={{ minHeight }}
      className="w-full resize-none rounded-xl border border-black/10 bg-[#f8fafc] px-3 py-2 text-xs font-semibold text-[#111827] outline-none transition placeholder:text-[#94a3b8] focus:border-nostur-orange"
    />
  );
}

function NosturSelect({
  value,
  onChange,
  options,
  placeholder = "Seleccionar"
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const selected = options.find((option) => option.value === value);

  const filteredOptions = useMemo(() => {
    const q = normalizeText(search);

    if (!q) return options;

    return options.filter((option) => normalizeText(`${option.label} ${option.value}`).includes(q));
  }, [options, search]);

  return (
    <div className={["relative", open ? "z-[160]" : "z-0"].join(" ")}>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-left text-xs font-semibold text-[#111827] outline-none transition hover:bg-white"
      >
        <span className={selected ? "truncate" : "truncate text-[#94a3b8]"}>
          {selected?.label || placeholder}
        </span>

        <ChevronDown
          size={14}
          strokeWidth={1.8}
          className={["shrink-0 text-[#64748b] transition", open ? "rotate-180" : ""].join(" ")}
        />
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => {
              setOpen(false);
              setSearch("");
            }}
            tabIndex={-1}
          />

          <div className="absolute left-0 right-0 top-[42px] z-[180] rounded-2xl border border-black/10 bg-white p-2 shadow-xl">
            <div className="mb-2 flex h-8 items-center gap-2 rounded-xl border border-black/10 bg-[#f8fafc] px-2">
              <Search size={13} className="text-[#94a3b8]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar..."
                autoFocus
                className="h-full min-w-0 flex-1 bg-transparent text-xs font-semibold outline-none"
              />
            </div>

            <div className="max-h-56 overflow-auto">
              {filteredOptions.length === 0 ? (
                <div className="px-3 py-2 text-xs font-bold text-[#94a3b8]">Sin opciones</div>
              ) : (
                filteredOptions.map((option) => {
                  const active = option.value === value;

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        onChange(option.value);
                        setOpen(false);
                        setSearch("");
                      }}
                      className={[
                        "flex h-8 w-full items-center rounded-xl px-3 text-left text-xs font-bold transition",
                        active
                          ? "bg-nostur-orange text-white"
                          : "text-[#334155] hover:bg-[#f1f5f9]"
                      ].join(" ")}
                    >
                      <span className="truncate">{option.label}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

function BooleanChip({
  checked,
  onChange,
  label
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={[
        "flex h-9 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-black transition",
        checked
          ? "border-nostur-orange/40 bg-nostur-orange/20 text-[#111827]"
          : "border-black/10 bg-white/70 text-[#64748b] hover:bg-white"
      ].join(" ")}
    >
      {checked ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
      {label}
    </button>
  );
}

function MetricCard({
  label,
  value,
  icon: Icon,
  tone = "orange"
}: {
  label: string;
  value: string | number;
  icon: typeof Building2;
  tone?: "orange" | "blue" | "green" | "slate" | "violet";
}) {
  const toneClass = {
    orange: "bg-nostur-orange/15 text-nostur-orange",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    slate: "bg-slate-100 text-slate-700",
    violet: "bg-violet-50 text-violet-700"
  }[tone];

  return (
    <div className="rounded-2xl border border-black/10 bg-white/70 p-3 shadow-sm">
      <div className="flex items-center gap-3">
        <div className={["flex h-9 w-9 items-center justify-center rounded-xl", toneClass].join(" ")}>
          <Icon size={17} strokeWidth={1.8} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-lg font-black text-[#111827]">{value}</div>
          <div className="text-[11px] font-bold text-[#64748b]">{label}</div>
        </div>
      </div>
    </div>
  );
}

function NoticeBox({ notice, onClose }: { notice: NoticeState; onClose: () => void }) {
  if (!notice) return null;

  const classes =
    notice.type === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : notice.type === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-blue-200 bg-blue-50 text-blue-700";

  const Icon = notice.type === "success" ? CheckCircle2 : AlertTriangle;

  return (
    <div
      className={[
        "mb-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-xs font-semibold",
        classes
      ].join(" ")}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon size={15} className="mt-0.5 shrink-0" />
        <div className="min-w-0">
          <div className="mb-0.5 font-black">{notice.title}</div>
          <div>{notice.message}</div>
        </div>
      </div>

      <button type="button" onClick={onClose} className="text-current opacity-70 hover:opacity-100">
        <X size={14} />
      </button>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-black/15 bg-[#f8fafc] p-5 text-center text-xs font-semibold text-[#64748b]">
      {text}
    </div>
  );
}

export function ConfigPanel() {
  const loading = useConfigStore((state) => state.loading);
  const saving = useConfigStore((state) => state.saving);
  const error = useConfigStore((state) => state.error);
  const clearError = useConfigStore((state) => state.clearError);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const currentProfile = useConfigStore((state) => state.currentProfile);
  const canManageConfig = useConfigStore((state) => state.canManageConfig);

  const sucursales = useConfigStore((state) => state.sucursales);
  const profiles = useConfigStore((state) => state.profiles);
  const metodosContacto = useConfigStore((state) => state.metodosContacto);
  const destinos = useConfigStore((state) => state.destinos);
  const formasPago = useConfigStore((state) => state.formasPago);
  const cajas = useConfigStore((state) => state.cajas);
  const categoriasFinancieras = useConfigStore((state) => state.categoriasFinancieras);
  const operadores = useConfigStore((state) => state.operadores);
  const proveedores = useConfigStore((state) => state.proveedores);
  const servicios = useConfigStore((state) => state.servicios);
  const hotelesMaestros = useConfigStore((state) => state.hotelesMaestros);
  const userCredentials = useConfigStore((state) => state.userCredentials);

  const upsertSucursal = useConfigStore((state) => state.upsertSucursal);
  const upsertProfile = useConfigStore((state) => state.upsertProfile);
  const upsertMetodoContacto = useConfigStore((state) => state.upsertMetodoContacto);
  const upsertDestino = useConfigStore((state) => state.upsertDestino);
  const upsertFormaPago = useConfigStore((state) => state.upsertFormaPago);
  const upsertCaja = useConfigStore((state) => state.upsertCaja);
  const upsertCategoriaFinanciera = useConfigStore((state) => state.upsertCategoriaFinanciera);
  const upsertOperador = useConfigStore((state) => state.upsertOperador);
  const upsertProveedor = useConfigStore((state) => state.upsertProveedor);
  const upsertServicio = useConfigStore((state) => state.upsertServicio);
  const upsertHotelMaestro = useConfigStore((state) => state.upsertHotelMaestro);
  const upsertUserCredential = useConfigStore((state) => state.upsertUserCredential);

  const toggleSucursal = useConfigStore((state) => state.toggleSucursal);
  const toggleProfile = useConfigStore((state) => state.toggleProfile);
  const toggleMetodoContacto = useConfigStore((state) => state.toggleMetodoContacto);
  const toggleDestino = useConfigStore((state) => state.toggleDestino);
  const toggleFormaPago = useConfigStore((state) => state.toggleFormaPago);
  const toggleCaja = useConfigStore((state) => state.toggleCaja);
  const toggleCategoriaFinanciera = useConfigStore((state) => state.toggleCategoriaFinanciera);
  const toggleOperador = useConfigStore((state) => state.toggleOperador);
  const toggleProveedor = useConfigStore((state) => state.toggleProveedor);
  const toggleServicio = useConfigStore((state) => state.toggleServicio);
  const toggleHotelMaestro = useConfigStore((state) => state.toggleHotelMaestro);
  const toggleUserCredentialAutofill = useConfigStore((state) => state.toggleUserCredentialAutofill);
  const deleteUserCredential = useConfigStore((state) => state.deleteUserCredential);

  const [activeTab, setActiveTab] = useState<ConfigTab>("sucursales");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(() => getInitialForm("sucursales"));
  const [showCredentialPassword, setShowCredentialPassword] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [notice, setNotice] = useState<NoticeState>(null);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (!canManageConfig && activeTab !== "credenciales") {
      setActiveTab("credenciales");
      setEditingId(null);
      setForm(getInitialForm("credenciales"));
      setShowCredentialPassword(false);
      setListSearch("");
    }
  }, [canManageConfig, activeTab]);

  const visibleTabs = useMemo(() => {
    if (canManageConfig) return tabs;
    return tabs.filter((tab) => tab.id === "credenciales");
  }, [canManageConfig]);

  const currentItems = useMemo(() => {
    if (activeTab === "sucursales") return sucursales;
    if (activeTab === "profiles") return profiles;
    if (activeTab === "metodos_contacto") return metodosContacto;
    if (activeTab === "destinos") return destinos;
    if (activeTab === "formas_pago") return formasPago;
    if (activeTab === "cajas") return cajas;
    if (activeTab === "categorias_financieras") return categoriasFinancieras;
    if (activeTab === "operadores") return operadores;
    if (activeTab === "proveedores") return proveedores;
    if (activeTab === "servicios") return servicios;
    if (activeTab === "hoteles_maestros") return hotelesMaestros;
    if (activeTab === "credenciales") return userCredentials;

    return [];
  }, [
    activeTab,
    sucursales,
    profiles,
    metodosContacto,
    destinos,
    formasPago,
    cajas,
    categoriasFinancieras,
    operadores,
    proveedores,
    servicios,
    hotelesMaestros,
    userCredentials
  ]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(listSearch);

    if (!q) return currentItems;

    return currentItems.filter((rawItem) => {
      const item = rawItem as Record<string, unknown>;

      return normalizeText(
        [
          getItemName(activeTab, item),
          getItemSubtitle(activeTab, item),
          item.email,
          item.nombre,
          item.apellido,
          item.pais,
          item.tipo,
          item.moneda,
          item.descripcion,
          item.ubicacion,
          item.categoria,
          item.regimen,
          item.tipo_habitacion,
          item.tipo_tarifa,
          item.razon_social,
          item.cuit,
          item.telefono,
          item.username,
          item.service_key
        ]
          .filter(Boolean)
          .join(" ")
      ).includes(q);
    });
  }, [activeTab, currentItems, listSearch]);

  const metrics = useMemo(() => {
    const activos = currentItems.filter((rawItem) =>
      getIsActive(activeTab, rawItem as Record<string, unknown>)
    ).length;

    return {
      total: currentItems.length,
      activos,
      inactivos: Math.max(0, currentItems.length - activos),
      visibles: filteredItems.length
    };
  }, [activeTab, currentItems, filteredItems.length]);

  function showNotice(type: "info" | "error" | "success", title: string, message: string) {
    setNotice({ type, title, message });

    window.setTimeout(() => {
      setNotice(null);
    }, 4200);
  }

  function setField(field: string, value: string | boolean | number | null | undefined) {
    setForm((current) => ({
      ...current,
      [field]: value
    }));
  }

  function resetForm(nextTab = activeTab) {
    setEditingId(null);
    setForm(getInitialForm(nextTab));
    setShowCredentialPassword(false);
    clearError();
  }

  function handleChangeTab(tab: ConfigTab) {
    setActiveTab(tab);
    setListSearch("");
    resetForm(tab);
  }

  function handleEdit(item: Record<string, unknown>) {
    const nextForm: FormState = {};

    Object.entries(item).forEach(([key, value]) => {
      if (
        typeof value === "string" ||
        typeof value === "boolean" ||
        typeof value === "number" ||
        value === null
      ) {
        nextForm[key] = value;
      }
    });

    if (activeTab === "hoteles_maestros") {
      nextForm.imagenes = stringifyHotelImages(item.imagenes);
    }

    setEditingId(String(item.id || ""));
    setForm({
      ...getInitialForm(activeTab),
      ...nextForm
    });
    clearError();
  }

  async function handleToggle(item: Record<string, unknown>) {
    if (activeTab === "sucursales") await toggleSucursal(item as Sucursal);
    if (activeTab === "profiles") await toggleProfile(item as Profile);
    if (activeTab === "metodos_contacto") await toggleMetodoContacto(item as MetodoContacto);
    if (activeTab === "destinos") await toggleDestino(item as Destino);
    if (activeTab === "formas_pago") await toggleFormaPago(item as FormaPago);
    if (activeTab === "cajas") await toggleCaja(item as Caja);
    if (activeTab === "categorias_financieras") {
      await toggleCategoriaFinanciera(item as CategoriaFinanciera);
    }
    if (activeTab === "operadores") await toggleOperador(item as Operador);
    if (activeTab === "proveedores") await toggleProveedor(item as Proveedor);
    if (activeTab === "servicios") await toggleServicio(item as Servicio);
    if (activeTab === "hoteles_maestros") await toggleHotelMaestro(item as HotelMaestro);
    if (activeTab === "credenciales") await toggleUserCredentialAutofill(item as UserCredential);
  }

  async function handleDeleteCredential(id: string) {
    await deleteUserCredential(id);

    if (editingId === id) {
      resetForm();
    }
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    let ok = false;

    if (activeTab === "sucursales") {
      ok = await upsertSucursal({
        id: editingId || undefined,
        nombre: asString(form.nombre),
color: normalizeHexColor(form.color),
        activa: asBoolean(form.activa),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "profiles") {
      if (!editingId && !form.id) {
        showNotice(
          "info",
          "Usuario requerido",
          "Para crear un usuario/perfil nuevo necesitás primero crear el usuario en Supabase Auth y usar su UUID como ID del perfil."
        );
        return;
      }

      ok = await upsertProfile({
        id: editingId || asString(form.id),
        nombre: asString(form.nombre),
        apellido: asString(form.apellido),
        email: asString(form.email),
        sucursal_id: asString(form.sucursal_id) || null,
        rol: asString(form.rol) as AppRole,
color: normalizeHexColor(form.color),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "metodos_contacto") {
      ok = await upsertMetodoContacto({
        id: editingId || undefined,
        nombre: asString(form.nombre),
color: normalizeHexColor(form.color),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "destinos") {
      ok = await upsertDestino({
        id: editingId || undefined,
        nombre: asString(form.nombre),
        pais: asString(form.pais) || "Sin especificar",
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "formas_pago") {
      ok = await upsertFormaPago({
        id: editingId || undefined,
        nombre: asString(form.nombre),
        impacta_tesoreria: asBoolean(form.impacta_tesoreria),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "cajas") {
      ok = await upsertCaja({
        id: editingId || undefined,
        nombre: asString(form.nombre),
        tipo: asString(form.tipo) || "CAJA",
        moneda: asString(form.moneda) || "ARS",
        sucursal_id: asString(form.sucursal_id) || null,
        descripcion: asString(form.descripcion) || null,
        orden: asNumber(form.orden, 100),
        activa: asBoolean(form.activa),
        activo: asBoolean(form.activo)
      } as Partial<Caja> & { nombre: string });
    }

    if (activeTab === "categorias_financieras") {
      ok = await upsertCategoriaFinanciera({
        id: editingId || undefined,
        nombre: asString(form.nombre),
        tipo: asString(form.tipo) as CategoriaTipo,
        activa: asBoolean(form.activa),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "operadores") {
      ok = await upsertOperador({
        id: editingId || undefined,
        nombre: asString(form.nombre),
color: normalizeHexColor(form.color),
        razon_social: asString(form.razon_social),
        cuit: asString(form.cuit),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "proveedores") {
      ok = await upsertProveedor({
        id: editingId || undefined,
        nombre_comercial: asString(form.nombre_comercial),
        razon_social: asString(form.razon_social),
        cuit: asString(form.cuit),
        telefono: asString(form.telefono),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "servicios") {
      ok = await upsertServicio({
        id: editingId || undefined,
        nombre: asString(form.nombre),
color: normalizeHexColor(form.color),
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "hoteles_maestros") {
      ok = await upsertHotelMaestro({
        id: editingId || undefined,
        nombre: asString(form.nombre),
        ubicacion: asString(form.ubicacion) || null,
        categoria: asNullableNumber(form.categoria),
        descripcion: asString(form.descripcion) || null,
        imagenes: parseHotelImages(form.imagenes),
        regimen: asString(form.regimen) || null,
        tipo_habitacion: asString(form.tipo_habitacion) || null,
        tipo_tarifa: asString(form.tipo_tarifa) || null,
        cargos_adicionales: asBoolean(form.cargos_adicionales),
        descripcion_cargos: asString(form.descripcion_cargos) || null,
        veces_usado: asNumber(form.veces_usado, 0),
        ultimo_uso: asString(form.ultimo_uso) || null,
        activo: asBoolean(form.activo)
      });
    }

    if (activeTab === "credenciales") {
      ok = await upsertUserCredential({
        id: editingId || undefined,
        service_key: asString(form.service_key),
        username: asString(form.username),
        password_encrypted: asString(form.password_encrypted),
        autofill_enabled: asBoolean(form.autofill_enabled),
        auto_submit_enabled: asBoolean(form.auto_submit_enabled)
      });
    }

    if (ok) {
      resetForm();
      showNotice("success", "Guardado correctamente", "La configuración fue actualizada.");
    }
  }

  function renderFormFields() {
    if (activeTab === "sucursales") {
      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Barrio Jardín"
            />
          </div>

          <div>
           <div>
  <FieldLabel>Color</FieldLabel>
  <ColorInput
    value={asString(form.color)}
    onChange={(value) => setField("color", value)}
  />
</div>
          </div>

          <BooleanChip
            checked={asBoolean(form.activa)}
            onChange={(value) => {
              setField("activa", value);
              setField("activo", value);
            }}
            label="Sucursal activa"
          />
        </>
      );
    }

    if (activeTab === "profiles") {
      const sucursalOptions: SelectOption[] = [
        { value: "", label: "Sin sucursal" },
        ...sucursales.map((sucursal) => ({
          value: sucursal.id,
          label: sucursal.nombre
        }))
      ];

      return (
        <>
          {!editingId ? (
            <div>
              <FieldLabel>ID usuario Supabase</FieldLabel>
              <TextInput
                value={asString(form.id)}
                onChange={(value) => setField("id", value)}
                placeholder="UUID del usuario de Auth"
              />
              <p className="mt-1 text-[10px] font-semibold text-[#64748b]">
                Para crear un perfil nuevo, primero creá el usuario en Supabase Auth.
              </p>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Nombre</FieldLabel>
              <TextInput
                value={asString(form.nombre)}
                onChange={(value) => setField("nombre", value)}
              />
            </div>

            <div>
              <FieldLabel>Apellido</FieldLabel>
              <TextInput
                value={asString(form.apellido)}
                onChange={(value) => setField("apellido", value)}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Email</FieldLabel>
            <TextInput value={asString(form.email)} onChange={(value) => setField("email", value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Rol</FieldLabel>
              <NosturSelect
                value={asString(form.rol)}
                onChange={(value) => setField("rol", value)}
                options={appRoleOptions}
              />
            </div>

            <div>
              <FieldLabel>Sucursal</FieldLabel>
              <NosturSelect
                value={asString(form.sucursal_id)}
                onChange={(value) => setField("sucursal_id", value || null)}
                options={sucursalOptions}
              />
            </div>
          </div>

          <div>
<div>
  <FieldLabel>Color</FieldLabel>
  <ColorInput
    value={asString(form.color)}
    onChange={(value) => setField("color", value)}
  />
</div>          </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Usuario activo"
          />
        </>
      );
    }

    if (activeTab === "metodos_contacto") {
      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="WhatsApp, Aivo, Referido..."
            />
          </div>

          <div>
<div>
  <FieldLabel>Color</FieldLabel>
  <ColorInput
    value={asString(form.color)}
    onChange={(value) => setField("color", value)}
  />
</div>        </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Método activo"
          />
        </>
      );
    }

    if (activeTab === "destinos") {
      return (
        <>
          <div>
            <FieldLabel>Destino / ciudad</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Cancún"
            />
          </div>

          <div>
            <FieldLabel>País</FieldLabel>
            <TextInput
              value={asString(form.pais)}
              onChange={(value) => setField("pais", value)}
              placeholder="México"
            />
          </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Destino activo"
          />
        </>
      );
    }

    if (activeTab === "formas_pago") {
      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Transferencia, efectivo..."
            />
          </div>

          <BooleanChip
            checked={asBoolean(form.impacta_tesoreria)}
            onChange={(value) => setField("impacta_tesoreria", value)}
            label="Impacta tesorería"
          />

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Forma activa"
          />
        </>
      );
    }

    if (activeTab === "cajas") {
      const sucursalOptions: SelectOption[] = [
        { value: "", label: "Sin sucursal" },
        ...sucursales.map((sucursal) => ({
          value: sucursal.id,
          label: sucursal.nombre
        }))
      ];

      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Caja pesos, banco 1..."
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Tipo</FieldLabel>
              <NosturSelect
                value={asString(form.tipo) || "CAJA"}
                onChange={(value) => setField("tipo", value)}
                options={cajaTipoOptions}
              />
            </div>

            <div>
              <FieldLabel>Moneda</FieldLabel>
              <NosturSelect
                value={asString(form.moneda) || "ARS"}
                onChange={(value) => setField("moneda", value)}
                options={monedaOptions}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Sucursal</FieldLabel>
            <NosturSelect
              value={asString(form.sucursal_id)}
              onChange={(value) => setField("sucursal_id", value || null)}
              options={sucursalOptions}
            />
          </div>

          <div>
            <FieldLabel>Descripción</FieldLabel>
            <TextInput
              value={asString(form.descripcion)}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Uso interno, cuenta, observación..."
            />
          </div>

          <div>
            <FieldLabel>Orden</FieldLabel>
            <TextInput
              value={asString(form.orden || "100")}
              onChange={(value) => setField("orden", value)}
              placeholder="100"
              type="number"
            />
          </div>

          <BooleanChip
            checked={asBoolean(form.activa)}
            onChange={(value) => {
              setField("activa", value);
              setField("activo", value);
            }}
            label="Caja activa"
          />
        </>
      );
    }

    if (activeTab === "categorias_financieras") {
      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Alquileres, proveedores..."
            />
          </div>

          <div>
            <FieldLabel>Tipo</FieldLabel>
            <NosturSelect
              value={asString(form.tipo)}
              onChange={(value) => setField("tipo", value)}
              options={categoriaTipoOptions}
            />
          </div>

          <BooleanChip
            checked={asBoolean(form.activa)}
            onChange={(value) => {
              setField("activa", value);
              setField("activo", value);
            }}
            label="Categoría activa"
          />
        </>
      );
    }

    if (activeTab === "operadores") {
      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput value={asString(form.nombre)} onChange={(value) => setField("nombre", value)} />
          </div>

          <div>
 <div>
  <FieldLabel>Color</FieldLabel>
  <ColorInput
    value={asString(form.color)}
    onChange={(value) => setField("color", value)}
  />
</div>         </div>

          <div>
            <FieldLabel>Razón social</FieldLabel>
            <TextInput
              value={asString(form.razon_social)}
              onChange={(value) => setField("razon_social", value)}
            />
          </div>

          <div>
            <FieldLabel>CUIT</FieldLabel>
            <TextInput value={asString(form.cuit)} onChange={(value) => setField("cuit", value)} />
          </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Operador activo"
          />
        </>
      );
    }

    if (activeTab === "proveedores") {
      return (
        <>
          <div>
            <FieldLabel>Nombre comercial</FieldLabel>
            <TextInput
              value={asString(form.nombre_comercial)}
              onChange={(value) => setField("nombre_comercial", value)}
            />
          </div>

          <div>
            <FieldLabel>Razón social</FieldLabel>
            <TextInput
              value={asString(form.razon_social)}
              onChange={(value) => setField("razon_social", value)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>CUIT</FieldLabel>
              <TextInput value={asString(form.cuit)} onChange={(value) => setField("cuit", value)} />
            </div>

            <div>
              <FieldLabel>Teléfono</FieldLabel>
              <TextInput
                value={asString(form.telefono)}
                onChange={(value) => setField("telefono", value)}
              />
            </div>
          </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Proveedor activo"
          />
        </>
      );
    }

    if (activeTab === "servicios") {
      return (
        <>
          <div>
            <FieldLabel>Nombre</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Hoteles, vuelos, traslados..."
            />
          </div>

          <div>
<div>
  <FieldLabel>Color</FieldLabel>
  <ColorInput
    value={asString(form.color)}
    onChange={(value) => setField("color", value)}
  />
</div>         </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Servicio activo"
          />
        </>
      );
    }

    if (activeTab === "hoteles_maestros") {
      return (
        <>
          <div>
            <FieldLabel>Nombre del hotel</FieldLabel>
            <TextInput
              value={asString(form.nombre)}
              onChange={(value) => setField("nombre", value)}
              placeholder="Hotel, pousada, resort..."
            />
          </div>

          <div>
            <FieldLabel>Ubicación</FieldLabel>
            <TextInput
              value={asString(form.ubicacion)}
              onChange={(value) => setField("ubicacion", value)}
              placeholder="Zona, dirección, ciudad..."
            />
          </div>

          <div>
            <FieldLabel>Categoría</FieldLabel>
            <TextInput
              value={asString(form.categoria)}
              onChange={(value) => setField("categoria", value)}
              placeholder="3, 4, 5..."
              type="number"
            />
          </div>

          <div>
            <FieldLabel>Descripción</FieldLabel>
            <TextArea
              value={asString(form.descripcion)}
              onChange={(value) => setField("descripcion", value)}
              placeholder="Descripción comercial del hotel..."
            />
          </div>

          <div>
            <FieldLabel>Imágenes JSON</FieldLabel>
            <TextArea
              value={asString(form.imagenes)}
              onChange={(value) => setField("imagenes", value)}
              placeholder='[{"url":"https://...","description":"Foto principal"}]'
              minHeight={130}
            />
            <p className="mt-1 text-[10px] font-semibold text-[#64748b]">
              Se cargan automáticamente desde el importador. Podés editar el JSON si necesitás
              corregir una imagen.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Régimen</FieldLabel>
              <TextInput
                value={asString(form.regimen)}
                onChange={(value) => setField("regimen", value)}
                placeholder="Desayuno, All Inclusive..."
              />
            </div>

            <div>
              <FieldLabel>Tipo habitación</FieldLabel>
              <TextInput
                value={asString(form.tipo_habitacion)}
                onChange={(value) => setField("tipo_habitacion", value)}
                placeholder="Standard, doble, superior..."
              />
            </div>
          </div>

          <div>
            <FieldLabel>Tipo tarifa</FieldLabel>
            <TextInput
              value={asString(form.tipo_tarifa)}
              onChange={(value) => setField("tipo_tarifa", value)}
              placeholder="Reembolsable, no reembolsable..."
            />
          </div>

          <BooleanChip
            checked={asBoolean(form.cargos_adicionales)}
            onChange={(value) => setField("cargos_adicionales", value)}
            label="Tiene cargos adicionales"
          />

          <div>
            <FieldLabel>Descripción cargos</FieldLabel>
            <TextInput
              value={asString(form.descripcion_cargos)}
              onChange={(value) => setField("descripcion_cargos", value)}
              placeholder="Tasas, resort fee, pago en destino..."
            />
          </div>

          <BooleanChip
            checked={asBoolean(form.activo)}
            onChange={(value) => setField("activo", value)}
            label="Hotel activo"
          />
        </>
      );
    }

    const appOptions: SelectOption[] = appRegistry.map((app) => ({
      value: app.id,
      label: app.name
    }));

    return (
      <>
        <div>
          <FieldLabel>Aplicativo</FieldLabel>
          <NosturSelect
            value={asString(form.service_key)}
            onChange={(value) => setField("service_key", value)}
            options={appOptions}
          />
        </div>

        <div>
          <FieldLabel>Usuario</FieldLabel>
          <TextInput
            value={asString(form.username)}
            onChange={(value) => setField("username", value)}
          />
        </div>

        <div>
          <FieldLabel>Contraseña</FieldLabel>
          <div className="flex gap-2">
            <input
              value={asString(form.password_encrypted)}
              onChange={(event) => setField("password_encrypted", event.target.value)}
              className="h-9 min-w-0 flex-1 rounded-xl border border-black/10 bg-[#f8fafc] px-3 text-xs font-semibold text-[#111827] outline-none transition focus:border-nostur-orange"
              type={showCredentialPassword ? "text" : "password"}
            />

            <button
              type="button"
              onClick={() => setShowCredentialPassword((current) => !current)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-black/10 bg-white/70 text-[#64748b] hover:bg-white"
            >
              {showCredentialPassword ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <BooleanChip
          checked={asBoolean(form.autofill_enabled)}
          onChange={(value) => setField("autofill_enabled", value)}
          label="Autofill habilitado"
        />

        <BooleanChip
          checked={asBoolean(form.auto_submit_enabled)}
          onChange={(value) => setField("auto_submit_enabled", value)}
          label="Auto submit habilitado"
        />
      </>
    );
  }

const activeTabMeta = tabs.find((tab) => tab.id === activeTab) || tabs[0];
const ActiveIcon = activeTabMeta.icon;
const currentProfileRecord = currentProfile as
  | (Profile & { is_support_user?: boolean })
  | null;

const canSeeDeployPanel =
  currentProfileRecord?.email?.toLowerCase() === "soporte@nostur.com.ar" ||
  currentProfileRecord?.is_support_user === true;


  return (
    <div className="h-full overflow-auto bg-[#edf3f7] px-5 py-4 text-[#172033]">
      <div className="mx-auto w-full max-w-[calc(100vw-110px)]">
        <header className="mb-3 rounded-[16px] border border-black/10 bg-white/78 px-4 py-3 shadow-sm backdrop-blur-xl">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[17px] font-semibold tracking-tight text-[#172033]">
                  Configuración
                </h1>

                <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] text-nostur-orange ring-1 ring-orange-100">
                  Sistema
                </span>
              </div>

              <p className="mt-1 text-[12px] font-normal text-[#64748b]">
                {canManageConfig
                  ? "ABM central conectado a Supabase."
                  : "Credenciales personales de autofill."}
                {currentProfile ? ` Usuario: ${currentProfile.nombre} · ${currentProfile.rol}` : ""}
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={loadConfig}
                disabled={loading}
                className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
              >
                <RefreshCcw size={13} strokeWidth={1.8} className={loading ? "animate-spin" : ""} />
                Actualizar
              </button>

              {editingId ? (
                <button
                  type="button"
                  onClick={() => resetForm()}
                  className="inline-flex h-7 items-center gap-1.5 rounded-[10px] bg-white px-2.5 text-[11px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc]"
                >
                  <X size={13} strokeWidth={1.8} />
                  Cancelar edición
                </button>
              ) : null}
            </div>
          </div>
        </header>

      {canSeeDeployPanel ? (
  <div className="mb-3">
    <DeployActionsPanel />
  </div>
) : null}

        <section className="relative z-[30] mb-3 rounded-[16px] border border-black/10 bg-white/62 p-3 shadow-sm backdrop-blur-xl">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <ActiveIcon size={14} className="text-[#4f7c90]" />

                <h2 className="text-[12px] font-semibold text-[#172033]">
                  {activeTabMeta.label}
                </h2>

                <span className="rounded-md bg-orange-50 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.1em] text-nostur-orange ring-1 ring-orange-100">
                  {editingId ? "Editando" : "Nuevo registro"}
                </span>
              </div>

              <div className="mt-1 truncate text-[11.5px] font-normal text-[#64748b]">
                Seleccioná una sección para administrar catálogos, usuarios, cajas y credenciales.
              </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {visibleTabs.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleChangeTab(tab.id)}
                  className={[
                    "flex h-9 shrink-0 items-center justify-center gap-2 rounded-[12px] px-3 text-[11px] font-medium transition",
                    active
                      ? "bg-[#4f7c90] text-white shadow-sm"
                      : "bg-white text-[#334155] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] hover:text-[#172033]"
                  ].join(" ")}
                >
                  <Icon size={14} strokeWidth={1.8} className="shrink-0" />
                  <span className="min-w-0 truncate">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </section>

        {error ? (
          <NoticeBox
            notice={{
              type: "error",
              title: "Atención",
              message: error
            }}
            onClose={clearError}
          />
        ) : null}

        <NoticeBox notice={notice} onClose={() => setNotice(null)} />

        {activeTab === "importador" ? (
          <div className="rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
            <ImportadorCatalogosPanel />
          </div>
        ) : (
          <>
            <section className="relative z-0 mb-3 grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard label="Registros" value={metrics.total} icon={Database} tone="orange" />
              <MetricCard label="Activos" value={metrics.activos} icon={CheckCircle2} tone="green" />
              <MetricCard label="Inactivos" value={metrics.inactivos} icon={ToggleLeft} tone="slate" />
              <MetricCard label="Visibles" value={metrics.visibles} icon={Search} tone="blue" />
            </section>

            <div className="grid gap-3 lg:grid-cols-[410px_minmax(0,1fr)]">
              <form
                onSubmit={handleSubmit}
                className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl"
              >
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] bg-[#eef6f7] text-[#4f7c90] ring-1 ring-[#4f7c90]/15">
                      <ActiveIcon size={17} strokeWidth={1.8} />
                    </div>

                    <div className="min-w-0">
                      <h3 className="truncate text-[14px] font-semibold text-[#172033]">
                        {editingId ? "Editar registro" : "Nuevo registro"}
                      </h3>
                      <p className="truncate text-[11.5px] font-normal text-[#64748b]">
                        {activeTabMeta.label}
                      </p>
                    </div>
                  </div>

                  {editingId ? (
                    <button
                      type="button"
                      onClick={() => resetForm()}
                      className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#172033]"
                    >
                      <X size={15} />
                    </button>
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-orange-50 text-nostur-orange ring-1 ring-orange-100">
                      <Plus size={15} />
                    </div>
                  )}
                </div>

                <div className="grid gap-3">{renderFormFields()}</div>

                <button
                  type="submit"
                  disabled={saving}
                  className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-[10px] bg-[#4f7c90] text-[12px] font-medium text-white shadow-sm hover:bg-[#406b7d] disabled:opacity-50"
                >
                  <Save size={14} strokeWidth={1.8} />
                  {saving ? "Guardando..." : "Guardar"}
                </button>
              </form>

              <div className="min-w-0 rounded-[16px] border border-black/10 bg-white/68 p-3 shadow-sm backdrop-blur-xl">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#172033]">
                      {activeTabMeta.label}
                    </h3>
                    <p className="text-[11.5px] font-normal text-[#64748b]">
                      {loading
                        ? "Cargando..."
                        : `${filteredItems.length} de ${currentItems.length} registros`}
                    </p>
                  </div>

                  <div className="flex h-8 min-w-[240px] items-center gap-2 rounded-[10px] border border-black/10 bg-white px-3">
                    <Search size={14} className="shrink-0 text-[#94a3b8]" />
                    <input
                      value={listSearch}
                      onChange={(event) => setListSearch(event.target.value)}
                      placeholder="Buscar..."
                      className="h-full min-w-0 flex-1 bg-transparent text-[12px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8]"
                    />
                  </div>
                </div>

                {loading ? (
                  <EmptyState text="Cargando configuración..." />
                ) : filteredItems.length === 0 ? (
                  <EmptyState text="No hay registros para mostrar." />
                ) : (
                  <div className="grid max-h-[calc(100vh-430px)] gap-2 overflow-auto pr-1">
                    {filteredItems.map((rawItem) => {
                      const item = rawItem as Record<string, unknown>;
                      const id = String(item.id);
                      const active = getIsActive(activeTab, item);
                      const color = getColor(activeTab, item);

                      if (activeTab === "hoteles_maestros") {
                        const hotelImages = parseHotelImages(item.imagenes);
                        const mainImage = hotelImages[0];

                        return (
                          <div
                            key={id}
                            className={[
                              "rounded-[14px] border p-3 transition",
                              editingId === id
                                ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                                : "border-black/10 bg-[#f8fafc] hover:bg-white"
                            ].join(" ")}
                          >
                            <div className="flex gap-3">
                              <div className="h-20 w-28 shrink-0 overflow-hidden rounded-[12px] border border-black/10 bg-white">
                                {mainImage?.url ? (
                                  <img
                                    src={mainImage.url}
                                    alt={mainImage.description || getItemName(activeTab, item)}
                                    className="h-full w-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[10px] font-medium text-[#94a3b8]">
                                    Sin imagen
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[12px] font-semibold text-[#172033]">
                                  {getItemName(activeTab, item)}
                                </div>

                                <div className="mt-0.5 line-clamp-2 text-[11px] font-normal text-[#64748b]">
                                  {getItemSubtitle(activeTab, item) || "Sin detalle"}
                                </div>

                                <div className="mt-2 flex flex-wrap gap-1">
                                  {hotelImages.slice(0, 5).map((image, imageIndex) => (
                                    <div
                                      key={`${id}-${image.id || image.url || imageIndex}`}
                                      className="h-8 w-10 overflow-hidden rounded-[9px] border border-black/10 bg-white"
                                    >
                                      {image.url ? (
                                        <img
                                          src={image.url}
                                          alt={image.description || `Imagen ${imageIndex + 1}`}
                                          className="h-full w-full object-cover"
                                          loading="lazy"
                                        />
                                      ) : null}
                                    </div>
                                  ))}

                                  {hotelImages.length > 5 ? (
                                    <div className="flex h-8 items-center rounded-[9px] border border-black/10 bg-white px-2 text-[10px] font-medium text-[#64748b]">
                                      +{hotelImages.length - 5}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              <div className="flex shrink-0 flex-col gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleToggle(item)}
                                  className={[
                                    "flex h-8 items-center justify-center gap-1.5 rounded-[10px] px-2 text-[11px] font-medium",
                                    active
                                      ? "bg-green-100 text-green-700 hover:bg-green-200"
                                      : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                                  ].join(" ")}
                                  title={active ? "Activo" : "Inactivo"}
                                >
                                  {active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                                  {active ? "Activo" : "Inactivo"}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleEdit(item)}
                                  className="flex h-8 items-center justify-center gap-1.5 rounded-[10px] bg-white px-2 text-[11px] font-medium text-[#64748b] shadow-sm ring-1 ring-black/10 hover:bg-[#f8fafc] hover:text-[#172033]"
                                  title="Editar"
                                >
                                  <Pencil size={14} strokeWidth={1.8} />
                                  Editar
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={id}
                          className={[
                            "flex items-center gap-3 rounded-[14px] border p-3 transition",
                            editingId === id
                              ? "border-[#4f7c90]/50 bg-[#eef6f7]"
                              : "border-black/10 bg-[#f8fafc] hover:bg-white"
                          ].join(" ")}
                        >
                          <div
                            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[12px] text-[12px] font-semibold text-white shadow-sm"
                            style={{ backgroundColor: color }}
                          >
                            {getItemName(activeTab, item).slice(0, 1).toUpperCase() || "N"}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[12px] font-semibold text-[#172033]">
                              {getItemName(activeTab, item)}
                            </div>
                            <div className="truncate text-[11px] font-normal text-[#64748b]">
                              {getItemSubtitle(activeTab, item) || "Sin detalle"}
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleToggle(item)}
                            className={[
                              "flex h-8 items-center gap-1.5 rounded-[10px] px-2 text-[11px] font-medium",
                              active
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-slate-200 text-slate-500 hover:bg-slate-300"
                            ].join(" ")}
                            title={active ? "Activo" : "Inactivo"}
                          >
                            {active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            {active ? "Activo" : "Inactivo"}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleEdit(item)}
                            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-black/5 hover:text-[#172033]"
                            title="Editar"
                          >
                            <Pencil size={14} strokeWidth={1.8} />
                          </button>

                          {activeTab === "credenciales" ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteCredential(id)}
                              className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#64748b] hover:bg-red-100 hover:text-red-600"
                              title="Eliminar"
                            >
                              <Trash2 size={14} strokeWidth={1.8} />
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ConfigPanel;