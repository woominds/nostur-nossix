import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  BriefcaseBusiness,
  Home,
  Menu,
  MessageCircle,
  ShoppingBag,
  UserRound
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { MobileHome } from "./screens/MobileHome";
import { MobileCarritos } from "./screens/MobileCarritos";
import { MobileCaja } from "./screens/MobileCaja";
import { MobileChatsScreen } from "./components/MobileChatsScreen";
import { MobileOportunidades } from "./screens/MobileOportunidades";
import { MobileMail } from "./screens/MobileMail";
import { MobileMas } from "./screens/MobileMas";
import { MobileVersion } from "./screens/MobileVersion";
import { MobileNotifications } from "./screens/MobileNotifications";
import { brandAssets, brandText } from "../lib/brandAssets";

export type MobileScreen =
  | "home"
  | "oportunidades"
  | "comunicaciones"
  | "carritos"
  | "mail"
  | "caja"
  | "version"
  | "notifications"
  | "mas";

const TITLES: Record<MobileScreen, string> = {
  home: "Inicio",
  oportunidades: "Oportunidades",
  comunicaciones: "Chats",
  carritos: "Carritos",
  mail: "Mails",
  caja: "Caja",
  version: "Versión",
  notifications: "Notificaciones",
  mas: "Más"
};

function NavButton({ active, label, icon, onClick }: { active: boolean; label: string; icon: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={["flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition active:scale-[0.98]", active ? "bg-[#172033] text-white shadow-sm" : "text-[#64748b]"].join(" ")}>
      <span className="flex h-5 items-center justify-center">{icon}</span>
      <span className="max-w-full truncate text-[9px] font-semibold leading-tight">{label}</span>
    </button>
  );
}

function MobileTopHeader({ screen }: { screen: MobileScreen }) {
  const user = useAuthStore((state) => state.user);
  return (
    <header className="shrink-0 border-b border-black/10 bg-white/90 px-3 pb-2.5 pt-[max(env(safe-area-inset-top),10px)] shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10">
            <img src={brandAssets.iconoColor} alt={brandText.appName} className="h-8 w-8 object-contain" draggable={false} />
          </div>
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold text-[#172033]">{TITLES[screen]}</div>
            <div className="truncate text-[10px] text-[#64748b]">NOSTUR Mobile · v{__APP_VERSION__}</div>
          </div>
        </div>
        <button type="button" className="relative flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#334155] shadow-sm ring-1 ring-black/5" aria-label="Notificaciones">
          <Bell size={15} />
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-nostur-orange" />
        </button>
      </div>
      <div className="mt-2 flex items-center gap-1.5 rounded-2xl bg-[#f8fafc] px-2.5 py-1.5 text-[10.5px] font-medium text-[#64748b] ring-1 ring-black/5">
        <UserRound size={12} className="text-nostur-orange" />
        <span className="truncate">{user?.email || "Usuario NOSTUR"}</span>
      </div>
    </header>
  );
}

export function MobileApp() {
  const [screen, setScreenState] = useState<MobileScreen>(() => {
    const queryScreen = new URLSearchParams(window.location.search).get("screen") as MobileScreen | null;
    const allowed: MobileScreen[] = ["home", "oportunidades", "comunicaciones", "carritos", "mail", "caja", "version", "notifications", "mas"];
    if (queryScreen && allowed.includes(queryScreen)) return queryScreen;
    return (sessionStorage.getItem("nostur:mobile-screen") as MobileScreen) || "home";
  });
  const setScreen = (next: MobileScreen) => {
    sessionStorage.setItem("nostur:mobile-screen", next);
    setScreenState(next);
  };

  useEffect(() => {
    const handler = (event: PopStateEvent) => {
      const next = (event.state?.mobileScreen as MobileScreen | undefined) || "home";
      setScreenState(next);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const isFullScreen = screen === "comunicaciones" || screen === "mail";
  const content = useMemo(() => {
    if (screen === "home") return <MobileHome setScreen={setScreen} />;
    if (screen === "oportunidades") return <MobileOportunidades />;
    if (screen === "comunicaciones") return <MobileChatsScreen />;
    if (screen === "carritos") return <MobileCarritos />;
    if (screen === "mail") return <MobileMail />;
    if (screen === "caja") return <MobileCaja />;
    if (screen === "version") return <MobileVersion />;
    if (screen === "notifications") return <MobileNotifications />;
    return <MobileMas onNavigate={setScreen} />;
  }, [screen]);

  return (
    <div className="flex w-full max-w-full flex-col overflow-hidden bg-[linear-gradient(135deg,#f7fbfc,#eff8f8_48%,#f4f8ff)] text-[#172033]" style={{ height: "100dvh", width: "100vw" }}>
      {!isFullScreen ? <MobileTopHeader screen={screen} /> : null}
      <main className="min-h-0 flex-1 overflow-auto overscroll-contain">{content}</main>
      <nav className="shrink-0 border-t border-black/10 bg-white/95 px-2 pb-[calc(7px+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex gap-1.5">
          <NavButton active={screen === "home"} label="Inicio" icon={<Home size={15} />} onClick={() => setScreen("home")} />
          <NavButton active={screen === "oportunidades"} label="Oportun." icon={<BriefcaseBusiness size={15} />} onClick={() => setScreen("oportunidades")} />
          <NavButton active={screen === "comunicaciones"} label="Chats" icon={<MessageCircle size={15} />} onClick={() => setScreen("comunicaciones")} />
          <NavButton active={screen === "carritos"} label="Carritos" icon={<ShoppingBag size={15} />} onClick={() => setScreen("carritos")} />
          <NavButton active={screen === "mas" || screen === "mail" || screen === "caja" || screen === "version" || screen === "notifications"} label="Más" icon={<Menu size={15} />} onClick={() => setScreen("mas")} />
        </div>
      </nav>
    </div>
  );
}

export default MobileApp;
