// src/mobile/MobileApp.tsx

import { useState } from "react";
import type { ReactNode } from "react";
import {
  Bell,
  Home,
  LogOut,
  MessageCircle,
  ShoppingBag,
  UserRound,
  Wallet
} from "lucide-react";
import { useAuthStore } from "../store/authStore";
import { MobileHome } from "./screens/MobileHome";
import { MobileCarritos } from "./screens/MobileCarritos";
import { MobileCaja } from "./screens/MobileCaja";
import { MobileChatsScreen } from "./components/MobileChatsScreen";
import { brandAssets, brandText } from "../lib/brandAssets";

export type MobileScreen = "home" | "comunicaciones" | "carritos" | "caja";

function getScreenTitle(screen: MobileScreen): string {
  if (screen === "home") return "Tablero";
  if (screen === "comunicaciones") return "Chats";
  if (screen === "carritos") return "Carritos";
  if (screen === "caja") return "Caja";

  return "Tablero";
}

function NavButton({
  active,
  label,
  icon,
  onClick
}: {
  active: boolean;
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl px-1 py-1.5 transition active:scale-[0.98]",
        active
          ? "bg-[#172033] text-white shadow-sm"
          : "text-[#64748b] hover:bg-white hover:text-[#172033]"
      ].join(" ")}
    >
      <span className="flex h-5 items-center justify-center">{icon}</span>

      <span className="max-w-full truncate text-[9px] font-semibold leading-tight">
        {label}
      </span>
    </button>
  );
}

function MobileTopHeader({ screen }: { screen: MobileScreen }) {
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);

  return (
    <header className="shrink-0 border-b border-black/10 bg-white/82 px-3 pb-2.5 pt-[max(env(safe-area-inset-top),10px)] shadow-sm backdrop-blur-xl">
      <div className="flex items-center justify-between gap-2.5">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10"
            aria-label={brandText.appName}
          >
            <img
              src={brandAssets.iconoColor}
              alt={brandText.appName}
              className="h-8 w-8 object-contain"
              draggable={false}
            />
          </button>

          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold leading-tight text-[#172033]">
              {getScreenTitle(screen)}
            </div>

            <div className="truncate text-[10.5px] font-normal leading-tight text-[#64748b]">
              {brandText.appName} Mobile
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            className="relative flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#334155] shadow-sm ring-1 ring-black/5"
            title="Notificaciones"
          >
            <Bell size={14} strokeWidth={1.9} />
            <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-nostur-orange" />
          </button>

          <button
            type="button"
            onClick={signOut}
            className="flex h-8 w-8 items-center justify-center rounded-xl bg-white text-[#64748b] shadow-sm ring-1 ring-black/5 hover:text-red-600"
            title="Cerrar sesión"
          >
            <LogOut size={14} strokeWidth={1.9} />
          </button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 rounded-2xl bg-white/75 px-2.5 py-1.5 text-[10.5px] font-medium leading-tight text-[#64748b] ring-1 ring-black/5">
        <UserRound size={12} className="text-nostur-orange" />
        <span className="truncate">{user?.email || "Usuario NOSTUR"}</span>
      </div>
    </header>
  );
}

export function MobileApp() {
  const [screen, setScreen] = useState<MobileScreen>("home");

  const isChatsScreen = screen === "comunicaciones";

  return (
    <div
      className="flex w-full max-w-full flex-col overflow-hidden bg-[radial-gradient(circle_at_12%_8%,rgba(255,122,26,0.12),transparent_28%),radial-gradient(circle_at_86%_10%,rgba(255,47,118,0.07),transparent_30%),linear-gradient(135deg,#f7fbfc,#eff8f8_48%,#f4f8ff)] text-[#172033]"
      style={{
        height: "100dvh",
        minHeight: "100dvh",
        maxHeight: "100dvh",
        width: "100vw",
        maxWidth: "100vw"
      }}
    >
      {!isChatsScreen ? <MobileTopHeader screen={screen} /> : null}

      <main className="min-h-0 flex-1 overflow-auto overscroll-contain">
        {screen === "home" ? <MobileHome setScreen={setScreen} /> : null}
        {screen === "comunicaciones" ? <MobileChatsScreen /> : null}
        {screen === "carritos" ? <MobileCarritos /> : null}
        {screen === "caja" ? <MobileCaja /> : null}
      </main>

      <nav className="shrink-0 border-t border-black/10 bg-white/92 px-2 pb-[calc(7px+env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgba(15,23,42,0.06)] backdrop-blur-xl">
        <div className="flex gap-1.5">
          <NavButton
            active={screen === "home"}
            label="Inicio"
            icon={<Home size={15} strokeWidth={1.9} />}
            onClick={() => setScreen("home")}
          />

          <NavButton
            active={screen === "comunicaciones"}
            label="Chats"
            icon={<MessageCircle size={15} strokeWidth={1.9} />}
            onClick={() => setScreen("comunicaciones")}
          />

          <NavButton
            active={screen === "carritos"}
            label="Carritos"
            icon={<ShoppingBag size={15} strokeWidth={1.9} />}
            onClick={() => setScreen("carritos")}
          />

          <NavButton
            active={screen === "caja"}
            label="Caja"
            icon={<Wallet size={15} strokeWidth={1.9} />}
            onClick={() => setScreen("caja")}
          />
        </div>
      </nav>
    </div>
  );
}

export default MobileApp;