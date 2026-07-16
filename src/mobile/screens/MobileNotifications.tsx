import { useCallback, useEffect, useState } from "react";
import { BellRing, CheckCircle2, Loader2, Music2, Send, Smartphone, Volume2, XCircle } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import {
  disablePushNotifications,
  enablePushNotifications,
  getPushStatus,
  playNotificationSound,
  sendTestPush,
  type PushStatus
} from "../services/mobilePushService";

const EMPTY_STATUS: PushStatus = {
  supported: false,
  permission: "unsupported",
  subscribed: false,
  endpoint: null
};

export function MobileNotifications() {
  const user = useAuthStore((state) => state.user);
  const [status, setStatus] = useState<PushStatus>(EMPTY_STATUS);
  const [loading, setLoading] = useState(true);
  const [action, setAction] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setStatus(await getPushStatus());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  async function run(name: string, task: () => Promise<void>) {
    setAction(name);
    setMessage(null);
    setError(null);
    try {
      await task();
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ocurrió un error inesperado.");
    } finally {
      setAction(null);
    }
  }

  const permissionLabel = status.permission === "granted"
    ? "Concedido"
    : status.permission === "denied"
      ? "Rechazado"
      : status.permission === "default"
        ? "Pendiente"
        : "No disponible";

  return (
    <div className="min-h-full px-3 py-3">
      <section className="rounded-[24px] bg-[#172033] p-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10"><BellRing size={24} /></div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">Avisos del dispositivo</div>
            <div className="mt-1 text-xl font-black">Notificaciones</div>
          </div>
        </div>
        <p className="mt-3 text-[11px] font-medium leading-relaxed text-white/65">
          Activá push para recibir mensajes aunque NOSTUR esté en segundo plano. Los sonidos personalizados funcionan cuando la PWA está abierta.
        </p>
      </section>

      <section className="mt-3 grid gap-2.5">
        <StatusRow icon={<Smartphone size={17} />} label="Compatibilidad" value={loading ? "Verificando…" : status.supported ? "Compatible" : "No compatible"} ok={status.supported} />
        <StatusRow icon={<BellRing size={17} />} label="Permiso" value={permissionLabel} ok={status.permission === "granted"} />
        <StatusRow icon={<CheckCircle2 size={17} />} label="Este dispositivo" value={status.subscribed ? "Registrado" : "No registrado"} ok={status.subscribed} />
      </section>

      {message ? <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[11px] font-semibold text-emerald-700">{message}</div> : null}
      {error ? <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2.5 text-[11px] font-semibold text-red-700">{error}</div> : null}

      <section className="mt-3 grid gap-2.5">
        {!status.subscribed ? (
          <ActionButton
            icon={<BellRing size={17} />}
            label="Activar push en este dispositivo"
            busy={action === "enable"}
            disabled={!status.supported || !user?.id}
            onClick={() => run("enable", async () => {
              if (!user?.id) throw new Error("No se encontró el usuario autenticado.");
              setStatus(await enablePushNotifications(user.id));
              setMessage("Dispositivo registrado correctamente.");
            })}
          />
        ) : (
          <ActionButton
            icon={<XCircle size={17} />}
            label="Desactivar este dispositivo"
            busy={action === "disable"}
            tone="danger"
            onClick={() => run("disable", async () => {
              setStatus(await disablePushNotifications());
              setMessage("Las notificaciones quedaron desactivadas en este dispositivo.");
            })}
          />
        )}

        <ActionButton
          icon={<Volume2 size={17} />}
          label="Probar sonido"
          busy={action === "sound"}
          onClick={() => run("sound", async () => {
            await playNotificationSound();
            setMessage("Sonido reproducido. Los sonidos internos quedaron habilitados.");
          })}
        />

        <ActionButton
          icon={<Send size={17} />}
          label="Enviar push de prueba"
          busy={action === "push"}
          disabled={!status.subscribed}
          onClick={() => run("push", async () => {
            await sendTestPush();
            setMessage("Push enviado. Puede demorar algunos segundos en aparecer.");
          })}
        />
      </section>

      <section className="mt-3 rounded-[20px] border border-black/10 bg-white p-3.5 shadow-sm">
        <div className="flex items-center gap-2 text-[12px] font-black text-[#172033]"><Music2 size={16} className="text-nostur-orange" /> Tipos previstos</div>
        <div className="mt-2 text-[11px] font-semibold leading-6 text-[#64748b]">
          Mensajes nuevos · conversaciones propias · derivaciones CANDE · alertas NIA · nuevos mails.
        </div>
      </section>
    </div>
  );
}

function StatusRow({ icon, label, value, ok }: { icon: React.ReactNode; label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-black/10 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5 text-[#172033]"><span className="text-nostur-orange">{icon}</span><span className="text-[12px] font-bold">{label}</span></div>
      <span className={["text-right text-[11px] font-semibold", ok ? "text-emerald-600" : "text-[#64748b]"].join(" ")}>{value}</span>
    </div>
  );
}

function ActionButton({ icon, label, busy, disabled, tone = "primary", onClick }: { icon: React.ReactNode; label: string; busy: boolean; disabled?: boolean; tone?: "primary" | "danger"; onClick: () => void }) {
  return (
    <button
      type="button"
      disabled={disabled || busy}
      onClick={onClick}
      className={[
        "flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-bold shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50",
        tone === "danger" ? "border border-red-200 bg-red-50 text-red-700" : "bg-nostur-orange text-white"
      ].join(" ")}
    >
      {busy ? <Loader2 size={17} className="animate-spin" /> : icon}
      {label}
    </button>
  );
}

export default MobileNotifications;
