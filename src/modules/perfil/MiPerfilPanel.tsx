// src/modules/perfil/MiPerfilPanel.tsx

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Camera,
  CheckCircle2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  RefreshCcw,
  Save,
  ShieldCheck,
  ShoppingBag,
  UserRound
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import { formatMoneyAR } from "../../lib/formatters";

type ProfileRecord = {
  id: string;
  email?: string | null;
  nombre?: string | null;
  apellido?: string | null;
  display_name?: string | null;
  avatar_url?: string | null;
  rol?: string | null;
  sucursal_id?: string | null;
  [key: string]: unknown;
};

type VentaHistorica = {
  id: string;
  tipo: "CARRITO" | "FILE" | string;
  numero: string | null;
  fecha_venta: string | null;
  pasajero: string | null;
  vendedor_id: string | null;
  sucursal_id: string | null;
  moneda: string | null;
  importe: number | string | null;
  estado: string | null;
  created_at: string | null;
};

type TabKey = "perfil" | "seguridad" | "ventas";

function cleanText(value: unknown): string {
  return String(value || "").trim();
}

function getInitials(name?: string | null): string {
  const clean = cleanText(name) || "Usuario";
  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function formatDateAR(value?: string | null): string {
  if (!value) return "—";

  const clean = value.slice(0, 10);
  const [year, month, day] = clean.split("-");

  if (!year || !month || !day) return "—";

  return `${day}/${month}/${year}`;
}

function parseMoney(value: string | number | null | undefined): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const normalized = String(value || "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.-]/g, "");

  const parsed = Number(normalized);

  return Number.isFinite(parsed) ? parsed : 0;
}

function formatImporte(moneda?: string | null, value?: string | number | null): string {
  const cleanMoneda = cleanText(moneda) || "ARS";
  const amount = parseMoney(value);

  if (cleanMoneda.toUpperCase() === "USD") {
    return `US$ ${formatMoneyAR(amount)}`;
  }

  return `$ ${formatMoneyAR(amount)}`;
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <label className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-[#64748b]">
      {children}
    </label>
  );
}

function SoftInput({
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
      type={type}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="h-10 w-full rounded-xl border border-black/10 bg-white px-3 text-[13px] font-normal text-[#172033] outline-none placeholder:text-[#94a3b8] transition focus:border-[#4f7c90] focus:ring-3 focus:ring-[#4f7c90]/10 disabled:cursor-not-allowed disabled:bg-[#f1f5f9] disabled:text-[#64748b]"
    />
  );
}

function TabButton({
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
        "h-9 rounded-xl px-4 text-[12px] font-medium transition",
        active
          ? "bg-[#172033] text-white shadow-sm"
          : "bg-white/70 text-[#64748b] ring-1 ring-black/10 hover:bg-white hover:text-[#172033]"
      ].join(" ")}
    >
      {children}
    </button>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex min-h-[180px] items-center justify-center rounded-[20px] border border-dashed border-black/10 bg-white/55 px-6 py-8 text-center text-[13px] font-medium text-[#64748b]">
      {text}
    </div>
  );
}

export function MiPerfilPanel() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [activeTab, setActiveTab] = useState<TabKey>("perfil");
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [ventasLoading, setVentasLoading] = useState(false);

  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [sucursalNombre, setSucursalNombre] = useState<string>("—");

  const [displayName, setDisplayName] = useState("");
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");

  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [ventas, setVentas] = useState<VentaHistorica[]>([]);

  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const fullName = useMemo(() => {
    return (
      cleanText(displayName) ||
      [nombre, apellido].map(cleanText).filter(Boolean).join(" ") ||
      cleanText(profile?.email) ||
      "Usuario"
    );
  }, [displayName, nombre, apellido, profile?.email]);

  const ventasTotal = useMemo(() => {
    return ventas.reduce((acc, item) => acc + parseMoney(item.importe), 0);
  }, [ventas]);

  async function loadProfile() {
    setLoading(true);
    setError(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(userError?.message || "No se pudo obtener el usuario actual.");
      setLoading(false);
      return;
    }

    const userId = userData.user.id;

    const { data, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();

    if (profileError) {
      setError(profileError.message || "No se pudo cargar el perfil.");
      setLoading(false);
      return;
    }

    const nextProfile = {
      ...(data || {}),
      id: userId,
      email: cleanText((data as ProfileRecord | null)?.email) || userData.user.email || null
    } as ProfileRecord;

    setProfile(nextProfile);
    setDisplayName(cleanText(nextProfile.display_name));
    setNombre(cleanText(nextProfile.nombre));
    setApellido(cleanText(nextProfile.apellido));

    if (nextProfile.sucursal_id) {
      const { data: sucursalData } = await supabase
        .from("sucursales")
        .select("nombre")
        .eq("id", nextProfile.sucursal_id)
        .maybeSingle();

      setSucursalNombre(cleanText((sucursalData as { nombre?: string } | null)?.nombre) || "—");
    } else {
      setSucursalNombre("—");
    }

    setLoading(false);
  }

  async function loadVentas() {
    setVentasLoading(true);
    setError(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError(userError?.message || "No se pudo obtener el usuario actual.");
      setVentasLoading(false);
      return;
    }

    const { data, error: ventasError } = await supabase
      .from("vw_mi_perfil_ventas")
      .select("id,tipo,numero,fecha_venta,pasajero,vendedor_id,sucursal_id,moneda,importe,estado,created_at")
      .eq("vendedor_id", userData.user.id)
      .order("fecha_venta", { ascending: false, nullsFirst: false })
      .limit(300);

    if (ventasError) {
      setError(ventasError.message || "No se pudo cargar el histórico de ventas.");
      setVentasLoading(false);
      return;
    }

    setVentas((data || []) as unknown as VentaHistorica[]);
    setVentasLoading(false);
  }

  async function saveProfile() {
    if (!profile?.id) return;

    setSavingProfile(true);
    setError(null);
    setStatus(null);

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim() || null,
        nombre: nombre.trim() || null,
        apellido: apellido.trim() || null,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message || "No se pudo guardar el perfil.");
      setSavingProfile(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            display_name: displayName.trim() || null,
            nombre: nombre.trim() || null,
            apellido: apellido.trim() || null
          }
        : current
    );

    setStatus("Perfil actualizado correctamente.");
    window.dispatchEvent(new CustomEvent("nostur:profile-updated"));
    setSavingProfile(false);
  }

  async function uploadAvatar(file: File) {
    if (!profile?.id) return;

    if (!file.type.startsWith("image/")) {
      setError("Seleccioná una imagen válida.");
      return;
    }

    setUploadingAvatar(true);
    setError(null);
    setStatus(null);

    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file, {
        cacheControl: "3600",
        upsert: true,
        contentType: file.type
      });

    if (uploadError) {
      setError(uploadError.message || "No se pudo subir la imagen.");
      setUploadingAvatar(false);
      return;
    }

    const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = publicUrlData.publicUrl;

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        avatar_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq("id", profile.id);

    if (updateError) {
      setError(updateError.message || "La imagen subió, pero no se pudo guardar en el perfil.");
      setUploadingAvatar(false);
      return;
    }

    setProfile((current) =>
      current
        ? {
            ...current,
            avatar_url: publicUrl
          }
        : current
    );

    setStatus("Avatar actualizado correctamente.");
    window.dispatchEvent(new CustomEvent("nostur:profile-updated"));
    setUploadingAvatar(false);
  }

  async function changePassword() {
    setError(null);
    setStatus(null);

    if (password.length < 8) {
      setError("La contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (password !== passwordConfirm) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setSavingPassword(true);

    const { error: updateError } = await supabase.auth.updateUser({
      password
    });

    if (updateError) {
      setError(updateError.message || "No se pudo cambiar la contraseña.");
      setSavingPassword(false);
      return;
    }

    setPassword("");
    setPasswordConfirm("");
    setStatus("Contraseña actualizada correctamente.");
    setSavingPassword(false);
  }

  useEffect(() => {
    void loadProfile();
    void loadVentas();
  }, []);

  return (
    <section className="flex h-full min-h-0 flex-col overflow-hidden bg-[#edf3f7] text-[#172033]">
      <header className="shrink-0 border-b border-black/10 bg-white/82 px-5 py-4 backdrop-blur-xl">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#172033] text-[15px] font-semibold text-white shadow-sm">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={fullName}
                  className="h-full w-full object-cover"
                  draggable={false}
                />
              ) : (
                getInitials(fullName)
              )}
            </div>

            <div className="min-w-0">
              <h1 className="truncate text-[19px] font-semibold tracking-tight text-[#172033]">
                Mi perfil
              </h1>

              <p className="mt-1 truncate text-[12px] font-normal text-[#64748b]">
                {fullName} · {profile?.email || "Sin email"}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              void loadProfile();
              void loadVentas();
            }}
            disabled={loading || ventasLoading}
            className="inline-flex h-9 items-center gap-2 rounded-xl bg-white px-3 text-[12px] font-medium text-[#334155] shadow-sm ring-1 ring-black/10 transition hover:bg-[#f8fafc] disabled:opacity-50"
          >
            <RefreshCcw size={14} className={loading || ventasLoading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <TabButton active={activeTab === "perfil"} onClick={() => setActiveTab("perfil")}>
            Perfil
          </TabButton>

          <TabButton active={activeTab === "seguridad"} onClick={() => setActiveTab("seguridad")}>
            Seguridad
          </TabButton>

          <TabButton active={activeTab === "ventas"} onClick={() => setActiveTab("ventas")}>
            Histórico de ventas
          </TabButton>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto p-5">
        {error ? (
          <div className="mb-4 rounded-[16px] border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-medium text-red-700">
            {error}
          </div>
        ) : null}

        {status ? (
          <div className="mb-4 flex items-center gap-2 rounded-[16px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-[12px] font-medium text-emerald-700">
            <CheckCircle2 size={15} />
            {status}
          </div>
        ) : null}

        {loading ? (
          <div className="flex h-[360px] items-center justify-center">
            <Loader2 size={26} className="animate-spin text-[#4f7c90]" />
          </div>
        ) : null}

        {!loading && activeTab === "perfil" ? (
          <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
            <section className="rounded-[24px] border border-black/10 bg-white/72 p-5 shadow-sm backdrop-blur-xl">
              <div className="flex flex-col items-center text-center">
                <div className="relative flex h-28 w-28 items-center justify-center overflow-hidden rounded-[30px] bg-[#172033] text-[28px] font-semibold text-white shadow-sm">
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt={fullName}
                      className="h-full w-full object-cover"
                      draggable={false}
                    />
                  ) : (
                    getInitials(fullName)
                  )}

                  {uploadingAvatar ? (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/45">
                      <Loader2 size={24} className="animate-spin text-white" />
                    </div>
                  ) : null}
                </div>

                <h2 className="mt-3 max-w-full truncate text-[17px] font-semibold text-[#172033]">
                  {fullName}
                </h2>

                <p className="mt-1 max-w-full truncate text-[12px] font-normal text-[#64748b]">
                  {profile?.email || "Sin email"}
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";

                    if (file) {
                      void uploadAvatar(file);
                    }
                  }}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="mt-4 inline-flex h-9 items-center gap-2 rounded-xl bg-[#172033] px-4 text-[12px] font-medium text-white shadow-sm transition hover:bg-[#263247] disabled:opacity-50"
                >
                  {uploadingAvatar ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
                  Cambiar avatar
                </button>
              </div>

              <div className="mt-5 grid gap-2 rounded-2xl bg-[#f8fafc] p-3 text-left">
                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-[#64748b]">Rol</span>
                  <span className="font-medium text-[#172033]">{cleanText(profile?.rol) || "—"}</span>
                </div>

                <div className="flex items-center justify-between gap-3 text-[12px]">
                  <span className="text-[#64748b]">Sucursal</span>
                  <span className="font-medium text-[#172033]">{sucursalNombre}</span>
                </div>
              </div>
            </section>

            <section className="rounded-[24px] border border-black/10 bg-white/72 p-5 shadow-sm backdrop-blur-xl">
              <div className="mb-5 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#eef6f7] text-[#4f7c90]">
                  <UserRound size={18} />
                </div>

                <div>
                  <h2 className="text-[15px] font-semibold text-[#172033]">Datos del perfil</h2>
                  <p className="text-[12px] font-normal text-[#64748b]">
                    Estos datos se usan para mostrar tu usuario dentro del sistema.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Nombre para mostrar</FieldLabel>
                  <SoftInput
                    value={displayName}
                    onChange={setDisplayName}
                    placeholder="Ej: Jorge"
                  />
                </div>

                <div>
                  <FieldLabel>Email</FieldLabel>
                  <SoftInput
                    value={profile?.email || ""}
                    onChange={() => undefined}
                    disabled
                  />
                </div>

                <div>
                  <FieldLabel>Nombre</FieldLabel>
                  <SoftInput
                    value={nombre}
                    onChange={setNombre}
                    placeholder="Nombre"
                  />
                </div>

                <div>
                  <FieldLabel>Apellido</FieldLabel>
                  <SoftInput
                    value={apellido}
                    onChange={setApellido}
                    placeholder="Apellido"
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={savingProfile}
                  className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#4f7c90] px-4 text-[12px] font-medium text-white shadow-sm transition hover:bg-[#406b7d] disabled:opacity-50"
                >
                  {savingProfile ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                  Guardar cambios
                </button>
              </div>
            </section>
          </div>
        ) : null}

        {!loading && activeTab === "seguridad" ? (
          <section className="max-w-[720px] rounded-[24px] border border-black/10 bg-white/72 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-5 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
                <ShieldCheck size={18} />
              </div>

              <div>
                <h2 className="text-[15px] font-semibold text-[#172033]">Seguridad</h2>
                <p className="text-[12px] font-normal text-[#64748b]">
                  Cambiá tu contraseña de acceso.
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div>
                <FieldLabel>Nueva contraseña</FieldLabel>
                <div className="relative">
                  <SoftInput
                    value={password}
                    onChange={setPassword}
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-[#64748b] transition hover:bg-[#f1f5f9] hover:text-[#172033]"
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              <div>
                <FieldLabel>Confirmar contraseña</FieldLabel>
                <SoftInput
                  value={passwordConfirm}
                  onChange={setPasswordConfirm}
                  type={showPassword ? "text" : "password"}
                  placeholder="Repetí la contraseña"
                />
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={changePassword}
                disabled={savingPassword}
                className="inline-flex h-9 items-center gap-2 rounded-xl bg-[#172033] px-4 text-[12px] font-medium text-white shadow-sm transition hover:bg-[#263247] disabled:opacity-50"
              >
                {savingPassword ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
                Cambiar contraseña
              </button>
            </div>
          </section>
        ) : null}

        {!loading && activeTab === "ventas" ? (
          <section className="rounded-[24px] border border-black/10 bg-white/72 p-5 shadow-sm backdrop-blur-xl">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
                  <ShoppingBag size={18} />
                </div>

                <div>
                  <h2 className="text-[15px] font-semibold text-[#172033]">
                    Histórico de ventas
                  </h2>
                  <p className="text-[12px] font-normal text-[#64748b]">
                    Carritos y files asociados a tu usuario vendedor.
                  </p>
                </div>
              </div>

              <div className="rounded-2xl bg-[#f8fafc] px-4 py-2 text-right ring-1 ring-black/5">
                <div className="text-[11px] font-medium text-[#64748b]">Total listado</div>
                <div className="text-[17px] font-semibold text-[#172033]">
                  {formatMoneyAR(ventasTotal)}
                </div>
              </div>
            </div>

            {ventasLoading ? (
              <div className="flex h-[220px] items-center justify-center">
                <Loader2 size={24} className="animate-spin text-[#4f7c90]" />
              </div>
            ) : ventas.length === 0 ? (
              <EmptyState text="Todavía no hay ventas asociadas a tu usuario." />
            ) : (
              <div className="overflow-hidden rounded-2xl border border-black/10 bg-white">
                <div className="grid grid-cols-[120px_90px_130px_1fr_150px] border-b border-black/10 bg-[#f8fafc] px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748b]">
                  <div>Fecha</div>
                  <div>Tipo</div>
                  <div>Número</div>
                  <div>Pasajero</div>
                  <div className="text-right">Importe</div>
                </div>

                <div className="max-h-[520px] overflow-auto">
                  {ventas.map((venta) => (
                    <div
                      key={`${venta.tipo}-${venta.id}`}
                      className="grid grid-cols-[120px_90px_130px_1fr_150px] items-center border-b border-black/5 px-3 py-2.5 text-[12px] last:border-b-0 hover:bg-[#f8fafc]"
                    >
                      <div className="font-medium text-[#334155]">
                        {formatDateAR(venta.fecha_venta)}
                      </div>

                      <div>
                        <span
                          className={[
                            "rounded-lg px-2 py-1 text-[10px] font-semibold",
                            venta.tipo === "CARRITO"
                              ? "bg-orange-50 text-orange-700"
                              : "bg-blue-50 text-blue-700"
                          ].join(" ")}
                        >
                          {venta.tipo}
                        </span>
                      </div>

                      <div className="truncate font-medium text-[#172033]">
                        {venta.numero || "—"}
                      </div>

                      <div className="truncate text-[#475569]">
                        {venta.pasajero || "Sin pasajero"}
                      </div>

                      <div className="text-right font-semibold text-[#172033]">
                        {formatImporte(venta.moneda, venta.importe)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        ) : null}
      </main>
    </section>
  );
}

export default MiPerfilPanel;