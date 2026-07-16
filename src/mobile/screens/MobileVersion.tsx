import { BellRing, CheckCircle2, Globe2, RefreshCcw, Smartphone } from "lucide-react";

const APP_VERSION = __APP_VERSION__;
const BUILD_DATE = __BUILD_DATE__;

export function MobileVersion() {
  const standalone = window.matchMedia("(display-mode: standalone)").matches;
  const serviceWorkerEnabled = "serviceWorker" in navigator;
  const notificationState = "Notification" in window ? Notification.permission : "no disponible";

  function reloadApp() {
    window.location.reload();
  }

  return (
    <div className="min-h-full px-3 py-3">
      <section className="rounded-[24px] bg-[#172033] p-4 text-white shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10">
            <Smartphone size={24} />
          </div>
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/55">NOSTUR Mobile</div>
            <div className="mt-1 text-xl font-black">Versión {APP_VERSION}</div>
          </div>
        </div>
        <div className="mt-3 text-[11px] font-medium text-white/65">Compilación: {BUILD_DATE}</div>
      </section>

      <section className="mt-3 grid gap-2.5">
        <StatusRow icon={<Globe2 size={17} />} label="Aplicación" value={standalone ? "PWA instalada" : "Navegador web"} />
        <StatusRow icon={<CheckCircle2 size={17} />} label="Service Worker" value={serviceWorkerEnabled ? "Compatible" : "No compatible"} />
        <StatusRow icon={<BellRing size={17} />} label="Notificaciones" value={notificationState} />
      </section>

      <button type="button" onClick={reloadApp} className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-nostur-orange px-4 py-3 text-sm font-bold text-white shadow-sm">
        <RefreshCcw size={16} />
        Buscar actualización
      </button>
    </div>
  );
}

function StatusRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[20px] border border-black/10 bg-white p-3.5 shadow-sm">
      <div className="flex items-center gap-2.5 text-[#172033]">
        <span className="text-nostur-orange">{icon}</span>
        <span className="text-[12px] font-bold">{label}</span>
      </div>
      <span className="text-right text-[11px] font-semibold text-[#64748b]">{value}</span>
    </div>
  );
}

export default MobileVersion;
