// src/components/Shell.tsx

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sidebar } from "./Sidebar";
import { TabsBar } from "./TabsBar";
import { TopBar } from "./TopBar";
import { Home } from "./Home";
import { WebviewArea } from "./WebviewArea";
import { useBrowserStore, type BrowserTab } from "../store/browserStore";
import { getAppById } from "../registry/appRegistry";
import { DownloadToast } from "./DownloadToast";
import { NosturUpdateBanner } from "./updates/NosturUpdateBanner";

import { ContactosPanel } from "./contactos/ContactosPanel";
import { ClientesPanel } from "./clientes/ClientesPanel";
import { PresupuestosV2Panel } from "./presupuestos/PresupuestosV2Panel";
import { CarritosPanel } from "./carritos/CarritosPanel";
import { FilesPanel } from "./files/FilesPanel";
import { CtasCtesPanel } from "./ctas-ctes/CtasCtesPanel";
import { ControlVentasPanel } from "./control-ventas/ControlVentasPanel";
import { PagosOperadoresPanel } from "./pagos-operadores/PagosOperadoresPanel";
import { RiesgosPanel } from "./riesgos/RiesgosPanel";
import { CajaPanel } from "./caja/CajaPanel";
import { FacturasCobrarPanel } from "./facturas-cobrar/FacturasCobrarPanel";
import { FacturasPagarPanel } from "./facturas-pagar/FacturasPagarPanel";
import { CashflowPanel } from "./cashflow/CashflowPanel";
import { MetasPanel } from "./metas/MetasPanel";
import { ComisionesPanel } from "./comisiones/ComisionesPanel";
import { PendientesPanel } from "./pendientes/PendientesPanel";
import { LinksUtilesPanel } from "./links-utiles/LinksUtilesPanel";
import { CalendarioPaxPanel } from "./calendario-pax/CalendarioPaxPanel";
import { HorariosPanel } from "./horarios/HorariosPanel";
import { DocumentosPanel } from "./documentos/DocumentosPanel";
import { ColaborativoPanel } from "./colaborativo/ColaborativoPanel";

import { ConfigPanel } from "./config/ConfigPanel";
import { ImportadorCatalogosPanel } from "./config/ImportadorCatalogosPanel";

import { LiveNosPanel } from "../modules/comunicaciones/LiveNosPanel";
import { OportunidadesPanel } from "../modules/comunicaciones/OportunidadesPanel";
import { CandePanel } from "../modules/comunicaciones/CandePanel";
import { NiaPanel } from "../modules/comunicaciones/NiaPanel";
import { ControlIaPanel } from "../modules/comunicaciones/ControlIaPanel";
import { MiPerfilPanel } from "../modules/perfil/MiPerfilPanel";
import { NiaFloatingWidget } from "./NiaFloatingWidget";

type InternalOpenEventDetail = {
  moduleId?: string;
  appId?: string;
  route?: string;
  url?: string;
  title?: string;
  params?: Record<string, unknown>;
};

function normalizeInternalAppId(moduleId: string): string {
  if (moduleId === "presupuestos") return "presupuestos-v2";
  if (moduleId === "presupuestos-v2") return "presupuestos-v2";
  if (moduleId === "carritos") return "carritos";
  if (moduleId === "contactos") return "contactos";
  if (moduleId === "clientes") return "clientes";

  if (moduleId === "config") return "configuracion";
  if (moduleId === "settings") return "configuracion";
  if (moduleId === "configuracion") return "configuracion";

  if (moduleId === "livenos") return "livenos";
  if (moduleId === "oportunidades") return "oportunidades";
  if (moduleId === "cande") return "cande";
  if (moduleId === "nia") return "nia";
  if (moduleId === "control-ia") return "control-ia";
  if (moduleId === "mi-perfil") return "mi-perfil";

  return moduleId;
}

function getInternalUrl(appId: string, route?: string, url?: string): string {
  if (url?.startsWith("internal://")) return url;
  if (route?.startsWith("internal://")) return route;

  return `internal://${appId}`;
}

function getInternalTitle(appId: string, customTitle?: string): string {
  if (customTitle?.trim()) return customTitle.trim();

  if (appId === "configuracion") return "Configuración";

  try {
    return getAppById(appId).name || appId;
  } catch {
    return appId;
  }
}

function isWebTab(tab: BrowserTab | null | undefined): boolean {
  if (!tab) return false;
  if (tab.url === "nostur://home") return false;
  if (tab.url.startsWith("internal://")) return false;

  return true;
}

function renderInternalOrHome(tab: BrowserTab | null | undefined) {
  const activeUrl = tab?.url || "nostur://home";

  const isHome = !tab || activeUrl === "nostur://home";

  const isContactos = activeUrl === "internal://contactos";
  const isClientes = activeUrl === "internal://clientes";

  const isPresupuestosV2 =
    activeUrl === "internal://presupuestos-v2" || activeUrl === "internal://presupuestos";

  const isCarritos = activeUrl === "internal://carritos";
  const isFiles = activeUrl === "internal://files";
  const isCtasCtes = activeUrl === "internal://ctas-ctes";

  const isControlVentas = activeUrl === "internal://control-ventas";
  const isPagosOperadores = activeUrl === "internal://pagos-operadores";
  const isRiesgos = activeUrl === "internal://riesgos";
  const isCaja = activeUrl === "internal://caja";
  const isFacturasCobrar = activeUrl === "internal://facturas-cobrar";
  const isFacturasPagar = activeUrl === "internal://facturas-pagar";
  const isCashflow = activeUrl === "internal://cashflow";
  const isMetas = activeUrl === "internal://metas";
  const isComisiones = activeUrl === "internal://comisiones";

  const isPendientes = activeUrl === "internal://pendientes";
  const isLinksUtiles = activeUrl === "internal://links-utiles";
  const isCalendarioPax = activeUrl === "internal://calendario-pax";
  const isHorarios = activeUrl === "internal://horarios";
  const isDocumentos = activeUrl === "internal://documentos";
  const isColaborativo = activeUrl === "internal://colaborativo";

  const isConfiguracion =
    activeUrl === "internal://configuracion" ||
    activeUrl === "internal://config" ||
    activeUrl === "internal://settings";

  const isImportadorCatalogos = activeUrl === "internal://importador-catalogos";

  const isLiveNos = activeUrl === "internal://livenos";
  const isOportunidades = activeUrl === "internal://oportunidades";
  const isCande = activeUrl === "internal://cande";
  const isNia = activeUrl === "internal://nia";
  const isControlIa = activeUrl === "internal://control-ia";
  const isMiPerfil = activeUrl === "internal://mi-perfil";

  if (isHome) return <Home />;

  if (isLiveNos) return <LiveNosPanel />;
  if (isOportunidades) return <OportunidadesPanel />;
  if (isCande) return <CandePanel />;
  if (isNia) return <NiaPanel />;
  if (isControlIa) return <ControlIaPanel />;
  if (isMiPerfil) return <MiPerfilPanel />;

  if (isContactos) return <ContactosPanel />;
  if (isClientes) return <ClientesPanel />;
  if (isPresupuestosV2) return <PresupuestosV2Panel />;
  if (isCarritos) return <CarritosPanel />;
  if (isFiles) return <FilesPanel />;
  if (isCtasCtes) return <CtasCtesPanel />;

  if (isControlVentas) return <ControlVentasPanel />;
  if (isPagosOperadores) return <PagosOperadoresPanel />;
  if (isRiesgos) return <RiesgosPanel />;
  if (isCaja) return <CajaPanel />;
  if (isFacturasCobrar) return <FacturasCobrarPanel />;
  if (isFacturasPagar) return <FacturasPagarPanel />;
  if (isCashflow) return <CashflowPanel />;
  if (isMetas) return <MetasPanel />;
  if (isComisiones) return <ComisionesPanel />;

  if (isPendientes) return <PendientesPanel />;
  if (isLinksUtiles) return <LinksUtilesPanel />;
  if (isCalendarioPax) return <CalendarioPaxPanel />;
  if (isHorarios) return <HorariosPanel />;
  if (isDocumentos) return <DocumentosPanel />;
  if (isColaborativo) return <ColaborativoPanel />;

  if (isConfiguracion) return <ConfigPanel />;
  if (isImportadorCatalogos) return <ImportadorCatalogosPanel />;

  return (
    <div className="flex h-full items-center justify-center bg-[#eef1f6] p-6 text-center text-sm font-semibold text-[#64748b]">
      Módulo no encontrado.
    </div>
  );
}

function PaneHeader({
  label,
  tab,
  active,
  onClick
}: {
  label: string;
  tab: BrowserTab | null | undefined;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "flex h-8 shrink-0 items-center justify-between border-b px-3 text-left transition",
        active
          ? "border-[#ff7a1a]/30 bg-[#fff7ed] text-[#111827]"
          : "border-black/10 bg-[#f8fafc] text-[#64748b] hover:bg-white"
      ].join(" ")}
    >
      <span className="text-[10px] font-black uppercase tracking-[0.14em]">
        {label}
      </span>

      <span className="min-w-0 flex-1 truncate pl-3 text-[11px] font-black">
        {tab?.title || "Sin pestaña"}
      </span>
    </button>
  );
}

function SplitPane({
  pane,
  tab,
  visibleWebTabIds,
  active
}: {
  pane: "left" | "right";
  tab: BrowserTab | null | undefined;
  visibleWebTabIds: string[];
  active: boolean;
}) {
  const setSplitActivePane = useBrowserStore((state) => state.setSplitActivePane);

  const web = isWebTab(tab);
  const internalContent = renderInternalOrHome(tab);

  return (
    <section className="relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-black/10 bg-white shadow-sm">
      <PaneHeader
        label={pane === "left" ? "Izquierda" : "Derecha"}
        tab={tab}
        active={active}
        onClick={() => setSplitActivePane(pane)}
      />

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {web && tab ? (
          <WebviewArea visibleTabIds={visibleWebTabIds} />
        ) : (
          internalContent
        )}
      </div>
    </section>
  );
}

export function Shell() {
  const initializedRef = useRef(false);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const splitDragPointerIdRef = useRef<number | null>(null);

  const [splitLeftWidth, setSplitLeftWidth] = useState(50);
  const [isDraggingSplit, setIsDraggingSplit] = useState(false);

  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const createTab = useBrowserStore((state) => state.createTab);
  const activateNextTab = useBrowserStore((state) => state.activateNextTab);
  const activatePreviousTab = useBrowserStore((state) => state.activatePreviousTab);

  const splitViewEnabled = useBrowserStore((state) => state.splitViewEnabled);
  const splitLeftTabId = useBrowserStore((state) => state.splitLeftTabId);
  const splitRightTabId = useBrowserStore((state) => state.splitRightTabId);
  const splitActivePane = useBrowserStore((state) => state.splitActivePane);

  const stopSplitDragging = useCallback(() => {
    splitDragPointerIdRef.current = null;
    setIsDraggingSplit(false);

    document.documentElement.classList.remove("nostur-split-resizing");
    document.body.classList.remove("nostur-split-resizing");

    document.documentElement.style.cursor = "";
    document.documentElement.style.userSelect = "";
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  const updateSplitWidthFromClientX = useCallback((clientX: number) => {
    const container = splitContainerRef.current;

    if (!container) return;

    const rect = container.getBoundingClientRect();

    if (rect.width <= 0) return;

    const rawPercent = ((clientX - rect.left) / rect.width) * 100;
    const limitedPercent = Math.min(75, Math.max(30, rawPercent));

    setSplitLeftWidth(limitedPercent);
  }, []);

  useEffect(() => {
    if (initializedRef.current) return;

    initializedRef.current = true;

    if (tabs.length === 0) {
      createTab({
        appId: "web",
        url: "nostur://home",
        title: "Inicio",
        activate: true
      });
    }
  }, [tabs.length, createTab]);

  useEffect(() => {
    function handleKeyboardNavigation(event: globalThis.KeyboardEvent) {
      const isTabShortcut =
        event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        event.key === "Tab";

      if (!isTabShortcut) return;

      event.preventDefault();
      event.stopPropagation();

      if (event.shiftKey) {
        activatePreviousTab();
        return;
      }

      activateNextTab();
    }

    window.addEventListener("keydown", handleKeyboardNavigation, true);

    return () => {
      window.removeEventListener("keydown", handleKeyboardNavigation, true);
    };
  }, [activateNextTab, activatePreviousTab]);

  useEffect(() => {
    function handleOpenInternal(event: Event) {
      const customEvent = event as CustomEvent<InternalOpenEventDetail>;
      const detail = customEvent.detail || {};

      const rawModuleId = detail.moduleId || detail.appId || "";
      const appId = normalizeInternalAppId(rawModuleId);

      if (!appId) return;

      const url = getInternalUrl(appId, detail.route, detail.url);
      const title = getInternalTitle(appId, detail.title);

      createTab({
        appId,
        url,
        title,
        activate: true
      });
    }

    window.addEventListener("nostur:open-internal", handleOpenInternal);
    window.addEventListener("nostur:navigate", handleOpenInternal);

    return () => {
      window.removeEventListener("nostur:open-internal", handleOpenInternal);
      window.removeEventListener("nostur:navigate", handleOpenInternal);
    };
  }, [createTab]);

  useEffect(() => {
    const unsubscribe = window.nostur?.onOpenConversationFromNotification?.(
      ({ conversationId }) => {
        if (!conversationId) return;

        window.localStorage.setItem("nostur_open_livenos_conversation_id", conversationId);

        createTab({
          appId: "livenos",
          url: "internal://livenos",
          title: "LiveNos",
          activate: true
        });

        window.setTimeout(() => {
          window.dispatchEvent(
            new CustomEvent("nostur:open-livenos-conversation", {
              detail: {
                conversationId
              }
            })
          );
        }, 350);
      }
    );

    return () => {
      unsubscribe?.();
    };
  }, [createTab]);

  useEffect(() => {
    if (!isDraggingSplit) return;

    function handlePointerMove(event: PointerEvent) {
      event.preventDefault();
      updateSplitWidthFromClientX(event.clientX);
    }

    function handlePointerUp(event: PointerEvent) {
      event.preventDefault();
      stopSplitDragging();
    }

    function handlePointerCancel() {
      stopSplitDragging();
    }

    function handleWindowBlur() {
      stopSplitDragging();
    }

    function handleEscape(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") return;

      stopSplitDragging();
    }

    document.documentElement.classList.add("nostur-split-resizing");
    document.body.classList.add("nostur-split-resizing");

    document.documentElement.style.cursor = "col-resize";
    document.documentElement.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", handlePointerUp, true);
    window.addEventListener("pointercancel", handlePointerCancel, true);
    window.addEventListener("blur", handleWindowBlur, true);
    window.addEventListener("keyup", handleEscape, true);
    window.addEventListener("nostur:force-stop-resize", stopSplitDragging);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", handlePointerUp, true);
      window.removeEventListener("pointercancel", handlePointerCancel, true);
      window.removeEventListener("blur", handleWindowBlur, true);
      window.removeEventListener("keyup", handleEscape, true);
      window.removeEventListener("nostur:force-stop-resize", stopSplitDragging);

      document.documentElement.classList.remove("nostur-split-resizing");
      document.body.classList.remove("nostur-split-resizing");

      document.documentElement.style.cursor = "";
      document.documentElement.style.userSelect = "";
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isDraggingSplit, stopSplitDragging, updateSplitWidthFromClientX]);

  useEffect(() => {
    if (!splitViewEnabled && isDraggingSplit) {
      stopSplitDragging();
    }
  }, [splitViewEnabled, isDraggingSplit, stopSplitDragging]);

  useEffect(() => {
    return () => {
      stopSplitDragging();
    };
  }, [stopSplitDragging]);

  const activeTab = useMemo(() => {
    return (
      tabs.find((tab) => tab.id === activeTabId) ||
      tabs.find((tab) => tab.url === "nostur://home") ||
      null
    );
  }, [tabs, activeTabId]);

  const activeUrl = activeTab?.url || "nostur://home";

  const leftTab = useMemo(() => {
    return (
      tabs.find((tab) => tab.id === splitLeftTabId) ||
      tabs.find((tab) => tab.url === "nostur://home") ||
      activeTab
    );
  }, [tabs, splitLeftTabId, activeTab]);

  const rightTab = useMemo(() => {
    return (
      tabs.find((tab) => tab.id === splitRightTabId) ||
      tabs.find((tab) => tab.id !== leftTab?.id && tab.url !== "nostur://home") ||
      null
    );
  }, [tabs, splitRightTabId, leftTab?.id]);

  const visibleWebTabIds = useMemo(() => {
    return [leftTab, rightTab]
      .filter((tab): tab is BrowserTab => Boolean(tab && isWebTab(tab)))
      .map((tab) => tab.id);
  }, [leftTab, rightTab]);

  const activeSingleIsWeb = isWebTab(activeTab);
  const activeSingleContent = renderInternalOrHome(activeTab);

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#e9edf4] text-[#1f2937]">
      <DownloadToast />
      <NosturUpdateBanner />

      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />

        <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <TabsBar />
          <TopBar />

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[#eef1f6]">
            {splitViewEnabled ? (
              <div
                ref={splitContainerRef}
                className="relative flex h-full min-h-0 min-w-0 gap-0 bg-[#dbe3ee] p-1"
              >
                {isDraggingSplit ? (
                  <div
                    className="absolute inset-0 z-[80] cursor-col-resize select-none bg-transparent"
                    onPointerMove={(event) => {
                      event.preventDefault();
                      updateSplitWidthFromClientX(event.clientX);
                    }}
                    onPointerUp={(event) => {
                      event.preventDefault();
                      stopSplitDragging();
                    }}
                    onPointerCancel={() => {
                      stopSplitDragging();
                    }}
                  />
                ) : null}

                <div
                  className="min-h-0 min-w-0"
                  style={{
                    width: `${splitLeftWidth}%`
                  }}
                >
                  <SplitPane
                    pane="left"
                    tab={leftTab}
                    visibleWebTabIds={visibleWebTabIds}
                    active={splitActivePane === "left"}
                  />
                </div>

                <div
                  role="separator"
                  aria-orientation="vertical"
                  title="Arrastrar para ajustar"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();

                    splitDragPointerIdRef.current = event.pointerId;
                    setIsDraggingSplit(true);
                    updateSplitWidthFromClientX(event.clientX);

                    try {
                      event.currentTarget.setPointerCapture(event.pointerId);
                    } catch {
                      // Algunos entornos Electron/WebView pueden no permitir capture.
                    }
                  }}
                  className={[
                    "group relative z-[90] flex w-3 shrink-0 touch-none cursor-col-resize items-center justify-center",
                    isDraggingSplit ? "bg-[#ff7a1a]/10" : "hover:bg-[#ff7a1a]/10"
                  ].join(" ")}
                >
                  <div
                    className={[
                      "h-14 w-[3px] rounded-full transition",
                      isDraggingSplit
                        ? "bg-[#ff7a1a]"
                        : "bg-[#94a3b8]/55 group-hover:bg-[#ff7a1a]"
                    ].join(" ")}
                  />
                </div>

                <div
                  className="min-h-0 min-w-0 flex-1"
                  style={{
                    width: `${100 - splitLeftWidth}%`
                  }}
                >
                  <SplitPane
                    pane="right"
                    tab={rightTab}
                    visibleWebTabIds={visibleWebTabIds}
                    active={splitActivePane === "right"}
                  />
                </div>
              </div>
            ) : activeSingleIsWeb ? (
              <WebviewArea visibleTabIds={activeTab ? [activeTab.id] : []} />
            ) : (
              activeSingleContent
            )}

            <NiaFloatingWidget activeUrl={activeUrl} />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Shell;