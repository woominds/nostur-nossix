// src/components/LoginScreen.tsx

import { useState } from "react";
import type { ReactNode, SyntheticEvent } from "react";
import {
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

export function LoginScreen() {
  const signIn = useAuthStore((state) => state.signIn);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const clearError = useAuthStore((state) => state.clearError);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    await signIn(email, password);
  }

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

        <form
          onSubmit={handleSubmit}
          className="rounded-[32px] border border-white/20 bg-white/95 p-7 text-[#111827] shadow-2xl shadow-black/30 backdrop-blur"
        >
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
              Ingresar a {brandText.appName}
            </h2>

            <p className="mt-1.5 text-xs font-bold text-[#64748b]">
              Usá tu usuario autorizado.
            </p>
          </div>

          <label className="mb-1.5 block text-[11px] font-black uppercase tracking-[0.14em] text-[#64748b]">
            Email
          </label>

          <div className="mb-4 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
            <Mail size={17} strokeWidth={1.9} className="text-[#64748b]" />

            <input
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                clearError();
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

          <div className="mb-4 flex h-12 items-center gap-2.5 rounded-2xl border border-black/10 bg-[#f8fafc] px-3.5 shadow-inner focus-within:border-[#ff7a1a]">
            <LockKeyhole size={17} strokeWidth={1.9} className="text-[#64748b]" />

            <input
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                clearError();
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

          {error ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={loading || !email.trim() || !password}
            className="flex h-12 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#ff7a1a] via-[#f05b59] to-[#ff2f76] text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Ingresando..." : "Ingresar"}
          </button>

          <p className="mt-4 text-center text-[11px] font-semibold text-[#64748b]">
            
          </p>
        </form>
      </div>
    </div>
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