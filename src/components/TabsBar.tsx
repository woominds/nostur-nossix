// src/components/TabsBar.tsx

import { useEffect, useMemo, useState } from "react";
import type { DragEvent } from "react";
import { Columns2, Home, LogOut, Plus, UserRound, X } from "lucide-react";
import { getAppById } from "../registry/appRegistry";
import { useBrowserStore, type BrowserTab } from "../store/browserStore";
import { useAuthStore } from "../store/authStore";
import { LiveNosNotificationBell } from "./LiveNosNotificationBell";
import { supabase } from "../lib/supabase";

const ALMUNDO_TAB_ICON = "brand/almundo-isotipo.png";

type TabGroupKey =
  | "chat"
  | "ventas"
  | "administracion"
  | "operaciones"
  | "apps"
  | "web"
  | "otros";

type GroupConfig = {
  label: string;
  color: string;
  order: number;
};

const GROUP_CONFIG: Record<TabGroupKey, GroupConfig> = {
  chat: {
    label: "Chat",
    color: "#10b981",
    order: 10
  },
  ventas: {
    label: "Ventas",
    color: "#ff7a1a",
    order: 20
  },
  administracion: {
    label: "Administración",
    color: "#0ea5e9",
    order: 30
  },
  operaciones: {
    label: "Operaciones",
    color: "#7c3aed",
    order: 40
  },
  apps: {
    label: "Apps",
    color: "#ff2f76",
    order: 50
  },
  web: {
    label: "Web",
    color: "#64748b",
    order: 80
  },
  otros: {
    label: "Otros",
    color: "#64748b",
    order: 90
  }
};

const APP_GROUP_ORDER: Record<string, number> = {
  livenos: 10,
  oportunidades: 11,
  cande: 12,
  nia: 13,
  "control-ia": 14,

  clientes: 20,
  carritos: 21,
  files: 22,
  "ctas-ctes": 23,
  "presupuestos-v2": 24,
  comisiones: 25,

  caja: 30,
  "control-ventas": 31,
  "facturas-pagar": 32,
  cashflow: 33,
  "facturas-cobrar": 34,
  metas: 35,
  "pagos-operadores": 36,
  riesgos: 37,

  "calendario-pax": 40,
  horarios: 41,
  pendientes: 42,
  documentos: 43,
  colaborativo: 44,
  "links-utiles": 45,

  web: 80,
  experts: 81,
  abaco: 82,
  krooze: 83,
  liveconnect: 84,
  aivo: 85,
  amadeus: 86,
  sabre: 87,
  chatgpt: 88
};

function normalizeAppKey(appId: string): string {
  if (appId === "presupuestos") return "presupuestos-v2";
  if (appId === "contactos") return "oportunidades";
  if (appId === "config") return "configuracion";
  if (appId === "settings") return "configuracion";

  return appId;
}

function getInitials(name?: string | null): string {
  const clean = String(name || "Usuario").trim();
  const parts = clean.split(" ").filter(Boolean);

  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function getTabLabel(tab: BrowserTab): string {
  if (tab.url === "nostur://home") return "Inicio";

  try {
    return tab.isLoading ? "Cargando..." : tab.title || getAppById(tab.appId).name;
  } catch {
    return tab.isLoading ? "Cargando..." : tab.title || "Pestaña";
  }
}

function getTabApp(tab: BrowserTab) {
  try {
    return getAppById(tab.appId);
  } catch {
    return getAppById("web");
  }
}

function getTabColor(tab: BrowserTab): string {
  if (tab.url === "nostur://home") return "#64748b";

  const app = getTabApp(tab);

  return app.color || "#64748b";
}

function getTabGroup(tab: BrowserTab): TabGroupKey {
  if (tab.url === "nostur://home") return "otros";

  const appId = normalizeAppKey(tab.appId || "");
  const isInternal = tab.url.startsWith("internal://");

  if (!isInternal) return "web";

  if (["livenos", "oportunidades", "cande", "nia", "control-ia"].includes(appId)) {
    return "chat";
  }

  if (
    ["clientes", "carritos", "files", "ctas-ctes", "presupuestos-v2", "comisiones"].includes(appId)
  ) {
    return "ventas";
  }

  if (
    [
      "caja",
      "control-ventas",
      "facturas-pagar",
      "cashflow",
      "facturas-cobrar",
      "metas",
      "pagos-operadores",
      "riesgos"
    ].includes(appId)
  ) {
    return "administracion";
  }

  if (
    [
      "calendario-pax",
      "horarios",
      "pendientes",
      "documentos",
      "colaborativo",
      "links-utiles",
      "importador-catalogos"
    ].includes(appId)
  ) {
    return "operaciones";
  }

  if (appId === "web" || appId === "chatgpt") return "web";

  return "otros";
}

function getTabOrder(tab: BrowserTab): number {
  if (tab.url === "nostur://home") return 0;

  const appKey = normalizeAppKey(tab.appId || "");
  const byApp = APP_GROUP_ORDER[appKey];

  if (typeof byApp === "number") return byApp;

  return GROUP_CONFIG[getTabGroup(tab)].order;
}

function getClosedGroups(): Record<TabGroupKey, boolean> {
  return {
    chat: false,
    ventas: false,
    administracion: false,
    operaciones: false,
    apps: false,
    web: false,
    otros: false
  };
}

function getOnlyGroupOpen(groupKey: TabGroupKey): Record<TabGroupKey, boolean> {
  return {
    ...getClosedGroups(),
    [groupKey]: true
  };
}

function getGroupsOpen(groupKeys: TabGroupKey[]): Record<TabGroupKey, boolean> {
  const next = getClosedGroups();

  groupKeys.forEach((groupKey) => {
    next[groupKey] = true;
  });

  return next;
}

function SoftTooltip({ text }: { text: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-[36px] z-[9999] -translate-x-1/2 translate-y-1 opacity-0 transition duration-150 group-hover/tab:translate-y-0 group-hover/tab:opacity-100">
      <span className="whitespace-nowrap rounded-xl border border-black/10 bg-white px-3 py-1.5 text-[11px] font-normal text-[#334155] shadow-lg">
        {text}
      </span>
    </span>
  );
}

function getTabIcon(tab: BrowserTab) {
  if (tab.url === "nostur://home") {
    return (
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-white/70 text-[#64748b] ring-1 ring-black/10">
        <Home size={13} strokeWidth={2} />
      </span>
    );
  }

  const app = getTabApp(tab);
  const usesAlmundoIcon = ["experts", "abaco", "krooze"].includes(app.id);

  if (usesAlmundoIcon) {
    return (
      <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-md bg-white">
        <img src={ALMUNDO_TAB_ICON} alt="Almundo" className="h-4 w-4 object-contain" />
      </span>
    );
  }

  if (tab.faviconUrl && !tab.url.startsWith("internal://")) {
    return <img src={tab.faviconUrl} alt="" className="h-4 w-4 rounded object-contain" />;
  }

  return (
    <span
      className="flex h-5 w-5 items-center justify-center rounded-md text-[9px] font-semibold text-white"
      style={{ backgroundColor: getTabColor(tab) }}
    >
      {app.name.slice(0, 1).toUpperCase()}
    </span>
  );
}

function closeSidebarIfAvailable() {
  const state = useBrowserStore.getState() as unknown as {
    setSidebarOpen?: (open: boolean) => void;
    setSidebarCollapsed?: (collapsed: boolean) => void;
    closeSidebar?: () => void;
    collapseSidebar?: () => void;
  };

  if (typeof state.closeSidebar === "function") {
    state.closeSidebar();
    return;
  }

  if (typeof state.setSidebarOpen === "function") {
    state.setSidebarOpen(false);
    return;
  }

  if (typeof state.collapseSidebar === "function") {
    state.collapseSidebar();
    return;
  }

  if (typeof state.setSidebarCollapsed === "function") {
    state.setSidebarCollapsed(true);
    return;
  }

  window.dispatchEvent(new CustomEvent("nostur:close-sidebar"));
}

export function TabsBar() {
  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const activateTab = useBrowserStore((state) => state.activateTab);
  const closeTab = useBrowserStore((state) => state.closeTab);
  const createTab = useBrowserStore((state) => state.createTab);
  const moveTab = useBrowserStore((state) => state.moveTab);

  const splitViewEnabled = useBrowserStore((state) => state.splitViewEnabled);
  const splitLeftTabId = useBrowserStore((state) => state.splitLeftTabId);
  const splitRightTabId = useBrowserStore((state) => state.splitRightTabId);
  const splitActivePane = useBrowserStore((state) => state.splitActivePane);
  const toggleSplitView = useBrowserStore((state) => state.toggleSplitView);
  const setSplitPaneTab = useBrowserStore((state) => state.setSplitPaneTab);
  const setSplitActivePane = useBrowserStore((state) => state.setSplitActivePane);

  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);

  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);

  const [draggedTabId, setDraggedTabId] = useState<string | null>(null);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<TabGroupKey, boolean>>(() =>
    getClosedGroups()
  );

  const homeTab = tabs.find((tab) => tab.url === "nostur://home");
  const browserTabs = tabs.filter((tab) => tab.url !== "nostur://home");

  const virtualHomeTab = useMemo(() => {
    return {
      id: "__home_virtual__",
      appId: "web",
      url: "nostur://home",
      title: "Inicio",
      isLoading: false
    } as BrowserTab;
  }, []);

  const groupedTabs = useMemo(() => {
    const groups = new Map<TabGroupKey, BrowserTab[]>();

    browserTabs.forEach((tab) => {
      const groupKey = getTabGroup(tab);
      const current = groups.get(groupKey) || [];

      current.push(tab);
      groups.set(groupKey, current);
    });

    return Array.from(groups.entries())
      .map(([groupKey, items]) => ({
        groupKey,
        config: GROUP_CONFIG[groupKey],
        items: [...items].sort((a, b) => getTabOrder(a) - getTabOrder(b))
      }))
      .sort((a, b) => a.config.order - b.config.order);
  }, [browserTabs]);


  useEffect(() => {
  let mounted = true;

  async function loadMiniProfile() {
    if (!user?.id) return;

    const { data } = await supabase
      .from("profiles")
      .select("display_name,nombre,apellido,avatar_url")
      .eq("id", user.id)
      .maybeSingle();

    if (!mounted) return;

    const profile = data as {
      display_name?: string | null;
      nombre?: string | null;
      apellido?: string | null;
      avatar_url?: string | null;
    } | null;

    const name =
      profile?.display_name ||
      [profile?.nombre, profile?.apellido].filter(Boolean).join(" ") ||
      user.email ||
      "Usuario";

    setProfileDisplayName(name);
    setProfileAvatarUrl(profile?.avatar_url || null);
  }

  void loadMiniProfile();

  function handleProfileUpdated() {
    void loadMiniProfile();
  }

  window.addEventListener("nostur:profile-updated", handleProfileUpdated);

  return () => {
    mounted = false;
    window.removeEventListener("nostur:profile-updated", handleProfileUpdated);
  };
}, [user?.id, user?.email]);



  function openHome() {
    if (homeTab) {
      activateTab(homeTab.id);

      if (splitViewEnabled) {
        setSplitPaneTab(splitActivePane, homeTab.id);
      }

      return;
    }

    createTab({
      appId: "web",
      url: "nostur://home",
      title: "Inicio",
      activate: true
    });
  }

  function openNewWebTab() {
    createTab({
      appId: "web",
      url: "https://www.google.com/",
      title: "Web",
      activate: true
    });
  }

  function handleTabClick(tab: BrowserTab) {
    if (tab.url === "nostur://home" && tab.id === "__home_virtual__") {
      openHome();
      return;
    }

    activateTab(tab.id);

    if (splitViewEnabled) {
      setSplitPaneTab(splitActivePane, tab.id);
    }
  }

  function handleDragStart(tabId: string) {
    if (tabId === "__home_virtual__") return;
    setDraggedTabId(tabId);
  }

  function handleDragOver(event: DragEvent<HTMLButtonElement>) {
    event.preventDefault();
  }

  function handleDrop(targetTabId: string) {
    if (
      !draggedTabId ||
      draggedTabId === targetTabId ||
      draggedTabId === "__home_virtual__" ||
      targetTabId === "__home_virtual__"
    ) {
      setDraggedTabId(null);
      return;
    }

    moveTab(draggedTabId, targetTabId);
    setDraggedTabId(null);
  }

  function toggleGroup(groupKey: TabGroupKey) {
    setOpenGroups((current) => {
      const isOpen = Boolean(current[groupKey]);

      if (isOpen) {
        return getClosedGroups();
      }

      return getOnlyGroupOpen(groupKey);
    });
  }

  function handleSplitViewClick() {
    closeSidebarIfAvailable();

    const currentActiveTab =
      tabs.find((tab) => tab.id === activeTabId) ||
      homeTab ||
      virtualHomeTab;

    if (!splitViewEnabled && currentActiveTab) {
      const firstSupportTab =
        tabs.find(
          (tab) =>
            tab.id !== currentActiveTab.id &&
            tab.url !== "nostur://home"
        ) ||
        homeTab ||
        currentActiveTab;

      toggleSplitView();

      window.setTimeout(() => {
        if (firstSupportTab?.id && firstSupportTab.id !== "__home_virtual__") {
          setSplitPaneTab("left", firstSupportTab.id);
        }

        if (currentActiveTab?.id && currentActiveTab.id !== "__home_virtual__") {
          setSplitPaneTab("right", currentActiveTab.id);
          activateTab(currentActiveTab.id);
        }

        setSplitActivePane("right");
      }, 0);

      return;
    }

    toggleSplitView();
  }

  function openMyProfile() {
    setUserMenuOpen(false);

    createTab({
      appId: "mi-perfil",
      url: "internal://mi-perfil",
      title: "Mi perfil",
      activate: true
    });
  }

  function renderUserMenu() {
    const email = user?.email || "";
const label = profileDisplayName || (email ? email.split("@")[0] : "Usuario");

    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setUserMenuOpen((current) => !current)}
          className="group/tab relative flex h-8 items-center gap-2 rounded-lg bg-white/35 px-2 text-[#334155] transition hover:bg-white/70 hover:text-[#172033]"
          aria-label="Usuario"
          title={email || "Usuario"}
        >
          <span className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-lg bg-[#172033] text-[9.5px] font-semibold text-white">
  {profileAvatarUrl ? (
    <img
      src={profileAvatarUrl}
      alt={label}
      className="h-full w-full object-cover"
      draggable={false}
    />
  ) : (
    getInitials(label || email)
  )}
</span>

          <span className="hidden max-w-[82px] truncate text-[11px] font-medium xl:block">
            {label}
          </span>

          <SoftTooltip text={email || "Usuario"} />
        </button>

        {userMenuOpen ? (
          <>
            <button
              type="button"
              className="fixed inset-0 z-[980] cursor-default bg-transparent"
              onClick={() => setUserMenuOpen(false)}
              tabIndex={-1}
            />

            <div className="absolute right-0 top-9 z-[990] w-[210px] overflow-hidden rounded-[18px] border border-black/10 bg-white p-1.5 shadow-2xl">
              <button
                type="button"
                onClick={openMyProfile}
                className="flex h-10 w-full items-center gap-2 rounded-2xl px-3 text-left text-[12px] font-medium text-[#334155] transition hover:bg-[#f1f5f9] hover:text-[#172033]"
              >
                <UserRound size={15} />
                Mi perfil
              </button>

              <button
                type="button"
                onClick={() => {
                  setUserMenuOpen(false);
                  void signOut();
                }}
                className="flex h-10 w-full items-center gap-2 rounded-2xl px-3 text-left text-[12px] font-medium text-red-600 transition hover:bg-red-50"
              >
                <LogOut size={15} />
                Cerrar sesión
              </button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  function isGroupActive(items: BrowserTab[]) {
    return items.some((tab) => tab.id === activeTabId);
  }

  function renderGroupButton(groupKey: TabGroupKey, items: BrowserTab[]) {
    const config = GROUP_CONFIG[groupKey];
    const active = isGroupActive(items);
    const open = Boolean(openGroups[groupKey]);

    return (
      <button
        key={`group-${groupKey}`}
        type="button"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          toggleGroup(groupKey);
        }}
        className={[
          "group/tab nostur-no-drag relative flex h-[32px] min-w-[96px] max-w-[150px] items-center gap-2 overflow-visible rounded-t-[9px] px-3 text-left transition",
          active
            ? "z-20 bg-[#f8fafc] text-[#111827]"
            : "z-10 bg-white/22 text-[#526174] hover:bg-white/48 hover:text-[#172033]"
        ].join(" ")}
      >
        <span
          className="absolute left-2 right-2 top-0 h-[2px] rounded-full"
          style={{
            backgroundColor: config.color,
            opacity: active ? 1 : 0.45
          }}
        />

        {active ? <span className="absolute bottom-0 left-0 right-0 h-px bg-[#f8fafc]" /> : null}

        <span
          className="relative z-10 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[9px] font-semibold text-white"
          style={{ backgroundColor: config.color }}
        >
          {items.length}
        </span>

        <span className="relative z-10 min-w-0 flex-1 truncate text-[12px] font-medium leading-none">
          {config.label}
        </span>

        <span className="relative z-10 text-[13px] font-normal leading-none text-[#64748b]">
          {open ? "−" : "+"}
        </span>
      </button>
    );
  }

  function renderTabButton(tab: BrowserTab, compact = false) {
    const isHome = tab.url === "nostur://home";
    const active =
      tab.id === activeTabId ||
      (isHome && homeTab?.id === activeTabId) ||
      (isHome && !homeTab && activeTabId === null);

    const tabLabel = getTabLabel(tab);
    const color = getTabColor(tab);
    const canClose = !isHome && tab.id !== "__home_virtual__";

    const inSplitLeft = splitViewEnabled && splitLeftTabId === tab.id;
    const inSplitRight = splitViewEnabled && splitRightTabId === tab.id;

    return (
      <button
        key={tab.id}
        type="button"
        draggable={tab.id !== "__home_virtual__"}
        onDragStart={() => handleDragStart(tab.id)}
        onDragOver={handleDragOver}
        onDrop={() => handleDrop(tab.id)}
        onClick={() => handleTabClick(tab)}
        className={[
          "group/tab nostur-no-drag relative flex h-[32px] items-center gap-2 overflow-visible px-3 text-left transition",
          "rounded-t-[9px] rounded-b-none",
          isHome
            ? "min-w-[84px] max-w-[132px] flex-[0_1_132px]"
            : compact
              ? "min-w-[118px] max-w-[178px] flex-[0_1_178px]"
              : "min-w-[92px] max-w-[210px] flex-[0_1_210px]",
          active
            ? "z-20 bg-[#f8fafc] text-[#111827]"
            : "z-10 bg-transparent text-[#526174] hover:bg-white/42 hover:text-[#172033]",
          draggedTabId === tab.id ? "opacity-45" : "opacity-100"
        ].join(" ")}
      >
        <span
          className="absolute left-2 right-2 top-0 h-[2px] rounded-full transition"
          style={{
            backgroundColor: color,
            opacity: active ? 1 : 0.22
          }}
        />

        {active ? <span className="absolute bottom-0 left-0 right-0 h-px bg-[#f8fafc]" /> : null}

        <span className="relative z-10 shrink-0">{getTabIcon(tab)}</span>

        <span
          className={[
            "relative z-10 min-w-0 flex-1 truncate text-[12px] leading-none",
            active ? "font-medium" : "font-normal"
          ].join(" ")}
        >
          {tabLabel}
        </span>

        {tab.isLoading ? (
          <span
            className="relative z-10 h-2 w-2 shrink-0 animate-pulse rounded-full"
            style={{ backgroundColor: color }}
          />
        ) : null}

        {inSplitLeft || inSplitRight ? (
          <span className="relative z-10 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-[#111827] px-1 text-[8px] font-medium text-white">
            {inSplitLeft ? "L" : "R"}
          </span>
        ) : null}

        {canClose ? (
          <span
            className={[
              "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg transition",
              active
                ? "text-[#1f2937] hover:bg-red-50 hover:text-red-600"
                : "text-[#334155] opacity-80 hover:bg-red-50 hover:text-red-600 hover:opacity-100"
            ].join(" ")}
            onClick={(event) => {
              event.stopPropagation();
              closeTab(tab.id);
            }}
            aria-label="Cerrar pestaña"
          >
            <X size={15} strokeWidth={2} />
          </span>
        ) : null}

        <SoftTooltip text={tabLabel} />
      </button>
    );
  }

  return (
    <div className="nostur-drag relative flex h-[39px] shrink-0 items-end gap-1 overflow-visible border-b border-[#d8e1ea] bg-[#dbe9fa] pl-[78px] pr-2">
      <div className="flex min-w-0 flex-1 items-end gap-0.5 overflow-visible">
        <div className="mr-1 flex items-end">{renderTabButton(homeTab || virtualHomeTab)}</div>

        {groupedTabs.map(({ groupKey, items }) => {
          const groupIsOpen = Boolean(openGroups[groupKey]);

          return (
            <div key={groupKey} className="flex min-w-0 items-end gap-0.5">
              {renderGroupButton(groupKey, items)}

              {groupIsOpen ? (
                <div className="flex min-w-0 items-end gap-0.5 border-l border-white/55 pl-1">
                  {items.map((tab) => renderTabButton(tab, true))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="nostur-no-drag flex h-[32px] shrink-0 items-center gap-1 pl-1">
        <LiveNosNotificationBell />

        {renderUserMenu()}

        <button
          type="button"
          onClick={handleSplitViewClick}
          className={[
            "group/tab relative flex h-8 w-8 items-center justify-center rounded-lg transition",
            splitViewEnabled
              ? "bg-white text-[#ff7a1a] shadow-sm"
              : "text-[#334155] hover:bg-white/65 hover:text-[#172033]"
          ].join(" ")}
          aria-label={splitViewEnabled ? "Cerrar vista dividida" : "Dividir pantalla"}
        >
          <Columns2 size={16} strokeWidth={1.9} />

          <SoftTooltip text={splitViewEnabled ? "Cerrar vista dividida" : "Dividir pantalla"} />
        </button>

        <button
          type="button"
          onClick={openNewWebTab}
          className="group/tab relative flex h-8 w-8 items-center justify-center rounded-lg text-[#334155] transition hover:bg-white/65 hover:text-[#172033]"
          aria-label="Nueva pestaña"
        >
          <Plus size={19} strokeWidth={1.9} />

          <SoftTooltip text="Nueva pestaña" />
        </button>
      </div>
    </div>
  );
}

export default TabsBar;