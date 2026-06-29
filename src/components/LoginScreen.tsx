// src/components/LoginScreen.tsx

import { useEffect, useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  Layers3,
  LockKeyhole,
  Mail,
  MonitorCheck,
  ShieldCheck
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { brandAssets, brandText } from "../lib/brandAssets";
import { supabase } from "../lib/supabase";

type LoginMode = "login" | "forgot" | "reset";



function getHashParamsFromUrl(rawUrl: string): URLSearchParams {
  const url = new URL(rawUrl);
  const hash = url.hash?.startsWith("#") ? url.hash.slice(1) : url.hash || "";
  const search = url.search?.startsWith("?") ? url.search.slice(1) : url.search || "";

  return new URLSearchParams(hash || search);
}

export function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [mode, setMode] = useState<LoginMode>("login");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [newPasswordRepeat, setNewPasswordRepeat] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState("");
  const [localSuccess, setLocalSuccess] = useState("");

  function resetLocalMessages() {
    setLocalError("");
    setLocalSuccess("");
    clearError();
  }

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    resetLocalMessages();
    await signIn(email, password);
  }

  async function handleForgotSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    resetLocalMessages();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      setLocalError("Ingresá tu email para recuperar la contraseña.");
      return;
    }

    try {
      setLocalLoading(true);

      const { error: resetError } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: "https://nostur.com.ar/auth/reset-password.html"
      });

      if (resetError) {
        throw resetError;
      }

      setLocalSuccess("Te enviamos un enlace de recuperación. Revisá tu correo.");
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "No se pudo enviar el enlace de recuperación."
      );
    } finally {
      setLocalLoading(false);
    }
  }

  async function handleResetSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    resetLocalMessages();

    if (!newPassword || newPassword.length < 8) {
      setLocalError("La nueva contraseña debe tener al menos 8 caracteres.");
      return;
    }

    if (newPassword !== newPasswordRepeat) {
      setLocalError("Las contraseñas no coinciden.");
      return;
    }

    try {
      setLocalLoading(true);

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        throw updateError;
      }

      await supabase.auth.signOut();

      setNewPassword("");
      setNewPasswordRepeat("");
      setPassword("");
      setMode("login");
      setLocalSuccess("Contraseña actualizada. Ya podés ingresar con tu nueva clave.");
    } catch (err) {
      setLocalError(
        err instanceof Error
          ? err.message
          : "No se pudo actualizar la contraseña."
      );
    } finally {
      setLocalLoading(false);
    }
  }

  async function consumePasswordResetUrl(rawUrl: string) {
    resetLocalMessages();

    try {
      const params = getHashParamsFromUrl(rawUrl);

      const accessToken = params.get("access_token") || "";
      const refreshToken = params.get("refresh_token") || "";
      const type = params.get("type") || "";

      if (!accessToken || !refreshToken) {
        throw new Error("El enlace de recuperación no tiene tokens válidos.");
      }

      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      if (sessionError) {
        throw sessionError;
      }

      setMode("reset");
      setLocalSuccess(
        type === "recovery"
          ? "Enlace verificado. Ingresá tu nueva contraseña."
          : "Sesión verificada. Ingresá tu nueva contraseña."
      );
    } catch (err) {
      setMode("forgot");
      setLocalError(
        err instanceof Error
          ? err.message
          : "No se pudo abrir el enlace de recuperación."
      );
    }
  }

useEffect(() => {
  const currentHash = window.location.hash || "";

  if (currentHash.includes("access_token=") && currentHash.includes("type=recovery")) {
    void consumePasswordResetUrl(window.location.href);
  }

  const unsubscribe = window.nostur?.onPasswordResetLink?.((payload) => {
    if (payload?.url) {
      void consumePasswordResetUrl(payload.url);
    }
  });

  return () => {
    if (typeof unsubscribe === "function") {
      unsubscribe();
    }
  };
}, []);

const visibleError = localError || error || undefined;

  return (
    <div className="relative flex h-screen w-screen items-center justify-center overflow-hidden bg-[#12091c] px-6 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_16%,rgba(255,122,26,0.32),transparent_32%),radial-gradient(circle_at_76%_18%,rgba(255,47,118,0.30),transparent_34%),radial-gradient(circle_at_72%_82%,rgba(148,163,184,0.34),transparent_38%),linear-gradient(135deg,#12091c,#21122f_50%,#3f4757)]" />
      <div className="absolute inset-0 bg-black/30" />

      <div className="relative z-10 grid w-full max-w-5xl gap-8 lg:grid-cols-[1fr_420px]">
        <section className="hidden flex-col justify-center lg:flex">
          <div className="mb-8 flex items-center gap-5">
            <img
              src={brandAssets.logoColorBlanco}
              alt={`${brandText.appName} - ${brandText.appDescription}`}
              className="h-auto max-h-[96px] w-[470px] max-w-full object-contain object-left"
              draggable={false}
            />
          </div>

          <h1 className="max-w-xl text-[42px] font-black leading-[1.05] tracking-tight text-white drop-shadow-sm">
            {brandText.appDescription}
          </h1>

          <p className="mt-5 max-w-xl text-[15px] font-semibold leading-7 text-white/82">
            Navegador operativo de trabajo para AGENCIAS DE VIAJES. Acceso centralizado a operación,
            ventas, administración, comunicaciones, sesiones persistentes y entorno controlado.
          </p>

          <div className="mt-9 grid max-w-xl grid-cols-3 gap-3">
            <InfoCard
              icon={<Layers3 size={17} strokeWidth={2.1} />}
              title="Operación"
              text="Apps, módulos internos y herramientas de gestión."
            />

            <InfoCard
              icon={<MonitorCheck size={17} strokeWidth={2.1} />}
              title="Productividad"
              text="Tabs agrupadas, accesos rápidos y navegación diaria."
            />

            <InfoCard
              icon={<ShieldCheck size={17} strokeWidth={2.1} />}
              title="Seguridad"
              text="Acceso privado mediante usuarios autorizados."
            />
          </div>
        </section>

        {mode === "login" ? (
          <form
            onSubmit={handleSubmit}
            className="rounded-[32px] border border-white/20 bg-white/95 p-7 text-[#111827] shadow-2xl shadow-black/30 backdrop-blur"
          >
            <LoginHeader title={`Ingresar a ${brandText.appName}`} subtitle="Usá tu usuario autorizado." />

            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
              Email
            </label>

            <div className="mb-4 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
              <Mail size={17} strokeWidth={1.9} className="text-[#64748b]" />

              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  resetLocalMessages();
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="usuario@agencia.com.ar"
                type="email"
                autoComplete="email"
              />
            </div>

            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
              Contraseña
            </label>

            <div className="mb-3 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
              <LockKeyhole size={17} strokeWidth={1.9} className="text-[#64748b]" />

              <input
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  resetLocalMessages();
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="••••••••"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-black/5 hover:text-[#111827]"
                title={showPassword ? "Ocultar contraseña" : "Ver contraseña"}
              >
                {showPassword ? (
                  <EyeOff size={16} strokeWidth={1.9} />
                ) : (
                  <Eye size={16} strokeWidth={1.9} />
                )}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                resetLocalMessages();
                setMode("forgot");
              }}
              className="mb-4 text-xs font-black text-[#ff6a00] hover:text-[#ff2f76]"
            >
              Olvidé mi contraseña
            </button>

            <StatusMessages error={visibleError} success={localSuccess} />

            <button
              type="submit"
              disabled={loading || !email.trim() || !password}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff7a1a] via-[#f05b59] to-[#ff2f76] text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
        ) : null}

        {mode === "forgot" ? (
          <form
            onSubmit={handleForgotSubmit}
            className="rounded-[32px] border border-white/20 bg-white/95 p-7 text-[#111827] shadow-2xl shadow-black/30 backdrop-blur"
          >
            <LoginHeader
              title="Recuperar contraseña"
              subtitle="Ingresá tu email y te enviamos un enlace de recuperación."
            />

            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
              Email
            </label>

            <div className="mb-4 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
              <Mail size={17} strokeWidth={1.9} className="text-[#64748b]" />

              <input
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  resetLocalMessages();
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="usuario@agencia.com.ar"
                type="email"
                autoComplete="email"
              />
            </div>

            <StatusMessages error={visibleError} success={localSuccess} />

            <button
              type="submit"
              disabled={localLoading || !email.trim()}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff7a1a] via-[#f05b59] to-[#ff2f76] text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localLoading ? "Enviando..." : "Enviar enlace"}
            </button>

            <button
              type="button"
              onClick={() => {
                resetLocalMessages();
                setMode("login");
              }}
              className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-2xl text-xs font-black text-[#64748b] hover:bg-black/5 hover:text-[#111827]"
            >
              <ArrowLeft size={15} />
              Volver al ingreso
            </button>
          </form>
        ) : null}

        {mode === "reset" ? (
          <form
            onSubmit={handleResetSubmit}
            className="rounded-[32px] border border-white/20 bg-white/95 p-7 text-[#111827] shadow-2xl shadow-black/30 backdrop-blur"
          >
            <LoginHeader
              title="Nueva contraseña"
              subtitle="Ingresá una nueva clave para tu usuario."
            />

            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
              Nueva contraseña
            </label>

            <div className="mb-4 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
              <LockKeyhole size={17} strokeWidth={1.9} className="text-[#64748b]" />

              <input
                value={newPassword}
                onChange={(event) => {
                  setNewPassword(event.target.value);
                  resetLocalMessages();
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="Nueva contraseña"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() => setShowNewPassword((current) => !current)}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-[#64748b] hover:bg-black/5 hover:text-[#111827]"
              >
                {showNewPassword ? (
                  <EyeOff size={16} strokeWidth={1.9} />
                ) : (
                  <Eye size={16} strokeWidth={1.9} />
                )}
              </button>
            </div>

            <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
              Repetir contraseña
            </label>

            <div className="mb-4 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
              <LockKeyhole size={17} strokeWidth={1.9} className="text-[#64748b]" />

              <input
                value={newPasswordRepeat}
                onChange={(event) => {
                  setNewPasswordRepeat(event.target.value);
                  resetLocalMessages();
                }}
                className="h-full min-w-0 flex-1 bg-transparent text-sm font-semibold text-[#111827] outline-none placeholder:text-[#94a3b8]"
                placeholder="Repetir contraseña"
                type={showNewPassword ? "text" : "password"}
                autoComplete="new-password"
              />
            </div>

            <StatusMessages error={visibleError} success={localSuccess} />

            <button
              type="submit"
              disabled={localLoading || !newPassword || !newPasswordRepeat}
              className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff7a1a] via-[#f05b59] to-[#ff2f76] text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {localLoading ? "Actualizando..." : "Actualizar contraseña"}
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function LoginHeader({
  title,
  subtitle
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mb-7 text-center">
      <div className="mx-auto mb-4 flex h-[92px] w-[92px] items-center justify-center overflow-hidden rounded-[28px] border border-black/10 bg-white shadow-lg">
        <img
          src={brandAssets.iconoColor}
          alt={brandText.appName}
          className="h-[76px] w-[76px] object-contain"
          draggable={false}
        />
      </div>

      <div className="mx-auto mb-4 flex max-w-[285px] justify-center lg:hidden">
        <img
          src={brandAssets.logoColorNegro}
          alt={brandText.appName}
          className="max-h-[72px] w-full object-contain"
          draggable={false}
        />
      </div>

      <h2 className="text-[23px] font-black text-[#111827]">
        {title}
      </h2>

      <p className="mt-1.5 text-xs font-bold text-[#64748b]">
        {subtitle}
      </p>
    </div>
  );
}

function StatusMessages({
  error,
  success
}: {
  error?: string;
  success?: string;
}) {
  return (
    <>
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 flex items-start gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 size={15} className="mt-0.5 shrink-0" />
          <span>{success}</span>
        </div>
      ) : null}
    </>
  );
}

function InfoCard({
  icon,
  title,
  text
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-white/18 bg-white/14 p-4 shadow-sm backdrop-blur">
      <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/18 text-white">
        {icon}
      </div>

      <div className="text-xs font-black uppercase tracking-wider text-white">
        {title}
      </div>

      <div className="mt-1.5 text-[11px] font-semibold leading-4 text-white/72">
        {text}
      </div>
    </div>
  );
}