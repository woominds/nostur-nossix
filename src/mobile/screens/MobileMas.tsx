import { BellRing, Info, LogOut, Mail, Wallet, UserRound } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import type { MobileScreen } from "../MobileApp";

export function MobileMas({ onNavigate }: { onNavigate: (screen: MobileScreen) => void }) {
  const user = useAuthStore((state) => state.user);
  const signOut = useAuthStore((state) => state.signOut);
  const items = [
    { label: "Mails", subtitle: "Entrada, enviados y respuestas", icon: <Mail size={18} />, screen: "mail" as const },
    { label: "Caja", subtitle: "Movimientos y saldos", icon: <Wallet size={18} />, screen: "caja" as const },
    { label: "Notificaciones", subtitle: "Permisos push y sonidos", icon: <BellRing size={18} />, screen: "notifications" as const },
    { label: "Versión y estado", subtitle: `NOSTUR Mobile v${__APP_VERSION__}`, icon: <Info size={18} />, screen: "version" as const }
  ];

  return (
    <div className="min-h-full px-3 py-3">
      <section className="mb-3 rounded-[22px] border border-black/10 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#172033] text-white"><UserRound size={21} /></div>
          <div className="min-w-0"><div className="text-[13px] font-black">Usuario</div><div className="truncate text-[11px] font-bold text-[#64748b]">{user?.email || "Sin email"}</div></div>
        </div>
      </section>
      <section className="grid gap-2.5">
        {items.map((item) => (
          <button key={item.label} type="button" onClick={() => onNavigate(item.screen)} className="flex items-center gap-3 rounded-[20px] border border-black/10 bg-white p-3.5 text-left shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-nostur-orange/10 text-nostur-orange">{item.icon}</span>
            <span className="min-w-0 flex-1"><span className="block text-[13px] font-black">{item.label}</span><span className="block truncate text-[10.5px] font-semibold text-[#64748b]">{item.subtitle}</span></span>
          </button>
        ))}
        <button type="button" onClick={signOut} className="flex items-center gap-3 rounded-[20px] border border-red-200 bg-red-50 p-3.5 text-left text-red-700 shadow-sm">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-red-100"><LogOut size={18} /></span>
          <span className="text-[13px] font-black">Cerrar sesión</span>
        </button>
      </section>
    </div>
  );
}

export default MobileMas;
