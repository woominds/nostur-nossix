// src/components/Sidebar.tsx

import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Globe2,
  HomeIcon,
  LogOut,
  MessageSquare,
  Monitor,
  Plane,
  Settings
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import {
  getAppById,
  getVisibleAppsForProfile
} from "../registry/appRegistry";
import { useAuthStore } from "../store/authStore";
import { useBrowserStore } from "../store/browserStore";
import { brandAssets, brandText } from "../lib/brandAssets";

type SidebarSectionKey = "chat" | "ventas" | "administracion" | "operaciones" | "apps";

type SidebarButtonProps = {
  label: string;
  icon: ReactNode;
  active?: boolean;
  danger?: boolean;
  onClick: () => void;
};

type ProfileLike = {
  id?: string | null;
  rol?: string | null;
  activo?: boolean | null;
  is_super_admin?: boolean | null;
  is_support_user?: boolean | null;
};

type RegistryApp = NonNullable<ReturnType<typeof getAppById>>;

const CHATGPT_URL = "https://chatgpt.com/";

const SECTION_LABELS: Record<SidebarSectionKey, string> = {
  chat: "Chat",
  ventas: "Ventas",
  administracion: "Administración",
  operaciones: "Operaciones",
  apps: "Apps externas"
};

const SECTION_COLORS: Record<SidebarSectionKey, string> = {
  chat: "#10b981",
  ventas: "#ff7a1a",
  administracion: "#0ea5e9",
  operaciones: "#7c3aed",
  apps: "#ff2f76"
};

const CHAT_APP_IDS = ["livenos", "oportunidades", "cande", "nia", "control-ia"];

const VENTAS_APP_IDS = [
  "clientes",
  "carritos",
  "files",
  "ctas-ctes",
  "presupuestos-v2",
  "comisiones"
];

const ADMINISTRACION_APP_IDS = [
  "caja",
  "control-ventas",
  "facturas-pagar",
  "cashflow",
  "facturas-cobrar",
  "metas",
  "pagos-operadores",
  "riesgos",
  "importador-catalogos"
];

const OPERACIONES_APP_IDS = [
  "calendario-pax",
  "horarios",
  "pendientes",
  "documentos",
  "colaborativo",
  "links-utiles",
  "mi-perfil"
];

function isAdminLike(profile: ProfileLike | null): boolean {
  const role = String(profile?.rol || "").toLowerCase();

  return Boolean(
    profile?.activo &&
      (profile?.is_super_admin ||
        profile?.is_support_user ||
        role === "admin_general" ||
        role === "gerencia" ||
        role === "gerente" ||
        role === "administracion")
  );
}

function isInternalApp(app: RegistryApp): boolean {
  return app.url.startsWith("internal://");
}

function getAppsByIds(appIds: string[]): RegistryApp[] {
  return appIds
    .map((appId) => {
      try {
        return getAppById(appId) as RegistryApp;
      } catch {
        return null;
      }
    })
    .filter(Boolean) as RegistryApp[];
}

function MicrosoftLogo({ size = 18 }: { size?: number }) {
  const box = Math.floor(size / 2) - 1;

  return (
    <span
      aria-hidden="true"
      className="grid shrink-0 grid-cols-2 gap-[2px]"
      style={{ width: size, height: size }}
    >
      <span style={{ width: box, height: box }} className="bg-red-500" />
      <span style={{ width: box, height: box }} className="bg-green-500" />
      <span style={{ width: box, height: box }} className="bg-blue-500" />
      <span style={{ width: box, height: box }} className="bg-yellow-400" />
    </span>
  );
}

function BrandIso({ size = 40 }: { size?: number }) {
  return (
    <span
      className="relative flex items-center justify-center overflow-hidden rounded-2xl"
      style={{
        width: size,
        height: size
      }}
    >
      <img
        src={brandAssets.iconoColor}
        alt={brandText.appName}
        draggable={false}
        className="pointer-events-none h-full w-full select-none object-contain"
      />
    </span>
  );
}

function SectionIcon({ section }: { section: SidebarSectionKey }) {
  if (section === "chat") return <Bot size={15} strokeWidth={2} />;
  if (section === "ventas") return <BriefcaseBusiness size={15} strokeWidth={2} />;
  if (section === "administracion") return <CircleDollarSign size={15} strokeWidth={2} />;
  if (section === "operaciones") return <Plane size={15} strokeWidth={2} />;

  return <Monitor size={15} strokeWidth={2} />;
}

function AppMiniIcon({
  appId,
  fallback,
  color
}: {
  appId: string;
  fallback: string;
  color: string;
}) {
  if (["office", "microsoft365", "microsoft-365"].includes(appId)) {
    return <MicrosoftLogo size={14} />;
  }

  if (["experts", "abaco", "krooze"].includes(appId)) {
    return (
      <span className="flex h-4 w-4 items-center justify-center overflow-hidden rounded bg-white ring-1 ring-black/5">
        <img
          src="brand/almundo-isotipo.png"
          alt="Almundo"
          className="h-3.5 w-3.5 object-contain"
        />
      </span>
    );
  }

  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-md text-[8px] font-semibold text-white"
      style={{ backgroundColor: color }}
    >
      {fallback.slice(0, 1).toUpperCase()}
    </span>
  );
}

function SidebarButton({
  label,
  icon,
  active = false,
  danger = false,
  onClick
}: SidebarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-9 w-full items-center gap-3 rounded-2xl px-3 text-left transition",
        active
          ? "bg-white text-[#172033] shadow-sm ring-1 ring-black/5"
          : danger
            ? "text-[#64748b] hover:bg-red-50 hover:text-red-600"
            : "text-[#64748b] hover:bg-white/75 hover:text-[#172033]"
      ].join(" ")}
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl">
        {icon}
      </span>

      <span className="min-w-0 flex-1 truncate text-[12.5px] font-medium leading-none">
        {label}
      </span>
    </button>
  );
}

export function Sidebar() {
  const createTab = useBrowserStore((state) => state.createTab);
  const activateTab = useBrowserStore((state) => state.activateTab);
  const setHomeViewMode = useBrowserStore((state) => state.setHomeViewMode);
  const homeViewMode = useBrowserStore((state) => state.homeViewMode);
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const signOut = useAuthStore((state) => state.signOut);

  const currentProfile = useAuthStore((state: any) => {
    return (
      state.profile ||
      state.currentProfile ||
      state.userProfile ||
      state.sessionProfile ||
      state.profileData ||
      null
    );
  }) as ProfileLike | null;

  const adminLike = isAdminLike(currentProfile);
  const canOpenAdminPanels = adminLike;
  const canSeeAdministrationSection = adminLike;

  const [dockOpen, setDockOpen] = useState(false);

  const [openSections, setOpenSections] = useState<Record<SidebarSectionKey, boolean>>({
    chat: true,
    ventas: true,
    administracion: true,
    operaciones: false,
    apps: false
  });

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activeUrl = activeTab?.url || "nostur://home";
  const activeAppId = activeTab?.appId || "web";

  const sectionApps = useMemo(() => {
    const visibleApps = getVisibleAppsForProfile(currentProfile);

    if (adminLike) {
      const externalApps = visibleApps
        .filter((app) => !isInternalApp(app as RegistryApp))
        .filter((app) => !["crm", "chatgpt"].includes(app.id));

      return {
        chat: getAppsByIds(CHAT_APP_IDS),
        ventas: getAppsByIds(VENTAS_APP_IDS),
        administracion: getAppsByIds(ADMINISTRACION_APP_IDS),
        operaciones: getAppsByIds(OPERACIONES_APP_IDS),
        apps: externalApps as RegistryApp[]
      };
    }

    const internalApps = visibleApps.filter((app) => app.url.startsWith("internal://"));

    const externalApps = visibleApps
      .filter((app) => !app.url.startsWith("internal://"))
      .filter((app) => !["crm", "chatgpt"].includes(app.id));

    return {
      chat: internalApps.filter((app) => CHAT_APP_IDS.includes(app.id)),
      ventas: internalApps.filter((app) => VENTAS_APP_IDS.includes(app.id)),
      administracion: internalApps.filter((app) => ADMINISTRACION_APP_IDS.includes(app.id)),
      operaciones: internalApps.filter((app) => OPERACIONES_APP_IDS.includes(app.id)),
      apps: externalApps
    };
  }, [currentProfile, adminLike]);

  function normalizeAppKey(appId: string): string {
    if (appId === "presupuestos") return "presupuestos-v2";
    if (appId === "contactos") return "oportunidades";
    if (appId === "config") return "configuracion";
    if (appId === "settings") return "configuracion";
    if (appId === "importador-catalogos") return "configuracion";

    return appId;
  }

  function openHome() {
    setHomeViewMode("apps");

    const homeTab = tabs.find((tab) => tab.url === "nostur://home");

    if (homeTab) {
      activateTab(homeTab.id);
      return;
    }

    createTab({
      appId: "web",
      url: "nostur://home",
      title: "Inicio",
      activate: true
    });
  }

  function openSettings() {
    if (!canOpenAdminPanels) return;

    setHomeViewMode("apps");

    const configTab = tabs.find(
      (tab) =>
        tab.url === "internal://configuracion" ||
        tab.url === "internal://config" ||
        tab.appId === "configuracion" ||
        tab.appId === "config"
    );

    if (configTab) {
      activateTab(configTab.id);
      return;
    }

    createTab({
      appId: "configuracion",
      url: "internal://configuracion",
      title: "Configuración",
      activate: true
    });
  }

  function openWeb() {
    createTab({
      appId: "web",
      url: "https://www.google.com.ar/",
      title: "Web",
      activate: true
    });
  }

  function openChatGpt() {
    const existingTab = tabs.find(
      (tab) => tab.appId === "chatgpt" || tab.url.includes("chatgpt.com")
    );

    if (existingTab) {
      activateTab(existingTab.id);
      return;
    }

    createTab({
      appId: "chatgpt",
      url: CHATGPT_URL,
      title: "ChatGPT",
      activate: true
    });
  }

  function openApp(appId: string) {
    const app = getAppById(appId);

    const isVisible =
      adminLike ||
      getVisibleAppsForProfile(currentProfile).some((visibleApp) => visibleApp.id === app.id);

    if (!isVisible) return;

    const normalizedAppId = normalizeAppKey(app.id);

    createTab({
      appId: normalizedAppId,
      url: app.id === "presupuestos" ? "internal://presupuestos-v2" : app.url,
      title: app.name,
      activate: true
    });
  }

  function toggleSection(section: SidebarSectionKey) {
    setOpenSections((current) => ({
      ...current,
      [section]: !current[section]
    }));
  }

  function isSectionActive(section: SidebarSectionKey) {
    return sectionApps[section].some((app) => normalizeAppKey(app.id) === activeAppId);
  }

  function isAppActive(appId: string, url: string) {
    return normalizeAppKey(appId) === activeAppId || activeUrl === url;
  }

  const isHomeActive = activeUrl === "nostur://home" && homeViewMode === "apps";

  const isSettingsActive =
    activeAppId === "configuracion" ||
    activeAppId === "config" ||
    activeUrl === "internal://configuracion" ||
    activeUrl === "internal://config";

  const isWebActive =
    activeAppId === "web" &&
    activeUrl !== "nostur://home" &&
    !activeUrl.startsWith("internal://");

  const isChatGptActive = activeAppId === "chatgpt" || activeUrl.includes("chatgpt.com");

  function renderSection(section: SidebarSectionKey) {
    const apps = sectionApps[section];
    const isOpen = openSections[section];
    const active = isSectionActive(section);
    const color = SECTION_COLORS[section];

    if (apps.length === 0) return null;

    return (
      <section key={section} className="space-y-0.5">
        <button
          type="button"
          onClick={() => toggleSection(section)}
          className={[
            "flex h-10 w-full items-center gap-3 rounded-2xl px-3 text-left transition",
            active
              ? "bg-white text-[#172033] shadow-sm ring-1 ring-black/5"
              : "text-[#64748b] hover:bg-white/75 hover:text-[#172033]"
          ].join(" ")}
        >
          <span
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            style={{ backgroundColor: color }}
          >
            <SectionIcon section={section} />
          </span>

          <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-none text-[#172033]">
            {SECTION_LABELS[section]}
          </span>

          {isOpen ? (
            <ChevronDown size={14} className="shrink-0 text-[#8a99ad]" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-[#8a99ad]" />
          )}
        </button>

        {isOpen ? (
          <div className="ml-[26px] pl-4" style={{ borderLeft: `1px solid ${color}55` }}>
            <div className="grid gap-0.5 py-1">
              {apps.map((app) => (
                <button
                  key={app.id}
                  type="button"
                  onClick={() => openApp(app.id)}
                  className={[
                    "group relative flex h-8 w-full items-center gap-2 rounded-xl px-2 text-left transition",
                    isAppActive(app.id, app.url)
                      ? "bg-white text-[#172033] shadow-sm ring-1 ring-black/5"
                      : "text-[#6b7a90] hover:bg-white/75 hover:text-[#172033]"
                  ].join(" ")}
                >
                  <span
                    className="absolute -left-[17px] top-1/2 h-px w-3 -translate-y-1/2"
                    style={{ backgroundColor: `${color}66` }}
                  />

                  {section === "apps" ? (
                    <AppMiniIcon appId={app.id} fallback={app.name} color={app.color || color} />
                  ) : (
                    <span
                      className={[
                        "h-1.5 w-1.5 shrink-0 rounded-full transition",
                        isAppActive(app.id, app.url) ? "opacity-100" : "opacity-55"
                      ].join(" ")}
                      style={{ backgroundColor: color }}
                    />
                  )}

                  <span className="min-w-0 flex-1 truncate text-[12px] font-normal leading-none">
                    {app.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  return (
    <aside
      onMouseEnter={() => setDockOpen(true)}
      onMouseLeave={() => setDockOpen(false)}
      className="nostur-no-drag relative z-[90] h-full w-[12px] shrink-0"
    >
      <div
        className={[
          "fixed bottom-0 left-0 top-0 z-[120] flex w-[260px] flex-col border-r border-black/10 bg-[#f8fafc] px-2 pb-4 pt-[52px] shadow-2xl transition-all duration-300 ease-out",
          dockOpen
            ? "translate-x-0 opacity-100"
            : "-translate-x-[248px] opacity-95"
        ].join(" ")}
      >
        <div
          className={[
            "pointer-events-none absolute bottom-0 right-0 top-0 w-[12px] transition",
            dockOpen
              ? "bg-transparent"
              : "bg-gradient-to-b from-[#ff7a1a]/75 via-[#4f7c90]/50 to-[#7c3aed]/65"
          ].join(" ")}
        />

        {!dockOpen ? (
          <div className="pointer-events-none absolute right-[2px] top-1/2 h-16 w-[3px] -translate-y-1/2 rounded-full bg-white/90 shadow" />
        ) : null}

        <div
          className={[
            "mb-5 flex items-center justify-between gap-2 transition-opacity duration-200",
            dockOpen ? "opacity-100" : "pointer-events-none opacity-0"
          ].join(" ")}
        >
          <button
            type="button"
            onClick={openHome}
            aria-label={brandText.appName}
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/10 transition hover:scale-[1.03] hover:shadow-md"
          >
            <BrandIso size={34} />
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-semibold leading-none text-[#172033]">
              {brandText.appName}
            </div>

            <div className="mt-1 truncate text-[10.5px] font-normal leading-none text-[#8a99ad]">
              {brandText.appDescription}
            </div>
          </div>
        </div>

        <div
          className={[
            "flex flex-1 flex-col gap-1.5 overflow-y-auto overflow-x-hidden pr-0.5 transition-opacity duration-200",
            dockOpen ? "opacity-100" : "pointer-events-none opacity-0"
          ].join(" ")}
        >
          <SidebarButton
            label="Inicio"
            active={isHomeActive}
            onClick={openHome}
            icon={<HomeIcon size={17} strokeWidth={1.8} />}
          />

          <SidebarButton
            label="Web"
            active={isWebActive}
            onClick={openWeb}
            icon={<Globe2 size={17} strokeWidth={1.8} />}
          />

          <SidebarButton
            label="ChatGPT"
            active={isChatGptActive}
            onClick={openChatGpt}
            icon={<MessageSquare size={17} strokeWidth={1.8} />}
          />

          <div className="my-1 h-px w-full bg-black/10" />

          {renderSection("chat")}
          {renderSection("ventas")}
          {canSeeAdministrationSection ? renderSection("administracion") : null}
          {renderSection("operaciones")}
          {renderSection("apps")}
        </div>

        <div
          className={[
            "mt-3 flex flex-col gap-1.5 transition-opacity duration-200",
            dockOpen ? "opacity-100" : "pointer-events-none opacity-0"
          ].join(" ")}
        >
          {canOpenAdminPanels ? (
            <SidebarButton
              label="Configuración"
              active={isSettingsActive}
              onClick={openSettings}
              icon={<Settings size={17} strokeWidth={1.8} />}
            />
          ) : null}

          <SidebarButton
            label="Cerrar sesión"
            danger
            onClick={signOut}
            icon={<LogOut size={17} strokeWidth={1.8} />}
          />
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;