import { useEffect, useRef } from "react";
import { Sidebar } from "./Sidebar";
import { TabsBar } from "./TabsBar";
import { TopBar } from "./TopBar";
import { Home } from "./Home";
import { WebviewArea } from "./WebviewArea";
import { useBrowserStore } from "../store/browserStore";
import { getAppById } from "../registry/appRegistry";

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
import { TableroControlPanel } from "./dashboard/TableroControlPanel";
import { ImportadorCatalogosPanel } from "./config/ImportadorCatalogosPanel";
import { ConfiguracionIAsPanel } from "./configuracion/ConfiguracionIAsPanel";

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

  return moduleId;
}

function getInternalUrl(appId: string, route?: string, url?: string): string {
  if (url?.startsWith("internal://")) return url;
  if (route?.startsWith("internal://")) return route;

  return `internal://${appId}`;
}

function getInternalTitle(appId: string, customTitle?: string): string {
  if (customTitle?.trim()) return customTitle.trim();

  return getAppById(appId).name || appId;
}

export function Shell() {
  const initializedRef = useRef(false);

  const tabs = useBrowserStore((state) => state.tabs);
  const activeTabId = useBrowserStore((state) => state.activeTabId);
  const createTab = useBrowserStore((state) => state.createTab);

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

  const activeTab = tabs.find((tab) => tab.id === activeTabId);
  const activeUrl = activeTab?.url || "nostur://home";

  const isHome = !activeTab || activeUrl === "nostur://home";
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
  const isTableroControl = activeUrl === "internal://tablero-control";
  const isImportadorCatalogos = activeUrl === "internal://importador-catalogos";
  const isConfiguracionIAs = activeUrl === "internal://configuracion-ias";

  return (
    <div className="h-screen w-screen overflow-hidden bg-[#e9edf4] text-[#1f2937]">
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar />

        <main className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <TabsBar />
          <TopBar />

          <div className="relative min-h-0 flex-1 overflow-hidden bg-[#eef1f6]">
            {isHome ? (
              <Home />
            ) : isContactos ? (
              <ContactosPanel />
            ) : isClientes ? (
              <ClientesPanel />
            ) : isPresupuestosV2 ? (
              <PresupuestosV2Panel />
            ) : isCarritos ? (
              <CarritosPanel />
            ) : isFiles ? (
              <FilesPanel />
            ) : isCtasCtes ? (
              <CtasCtesPanel />
            ) : isControlVentas ? (
              <ControlVentasPanel />
            ) : isPagosOperadores ? (
              <PagosOperadoresPanel />
            ) : isRiesgos ? (
              <RiesgosPanel />
            ) : isCaja ? (
              <CajaPanel />
            ) : isFacturasCobrar ? (
              <FacturasCobrarPanel />
            ) : isFacturasPagar ? (
              <FacturasPagarPanel />
            ) : isCashflow ? (
              <CashflowPanel />
            ) : isMetas ? (
              <MetasPanel />
            ) : isComisiones ? (
              <ComisionesPanel />
            ) : isPendientes ? (
              <PendientesPanel />
            ) : isLinksUtiles ? (
              <LinksUtilesPanel />
            ) : isCalendarioPax ? (
              <CalendarioPaxPanel />
            ) : isHorarios ? (
              <HorariosPanel />
            ) : isDocumentos ? (
              <DocumentosPanel />
            ) : isColaborativo ? (
              <ColaborativoPanel />
            ) : isTableroControl ? (
              <TableroControlPanel />
            ) : isImportadorCatalogos ? (
              <ImportadorCatalogosPanel />
            ) : isConfiguracionIAs ? (
              <ConfiguracionIAsPanel />
            ) : (
              <WebviewArea />
            )}
          </div>
        </main>
      </div>
    </div>
  );
}