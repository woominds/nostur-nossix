// src/config/tenantConfig.ts

/* =========================================================
   NOSTUR — CONFIGURACIÓN DE CLIENTE / TENANT

   Este archivo centraliza la configuración por cliente.

   IMPORTANTE:
   - NOSTUR es el producto.
   - NOSSIX es un cliente de NOSTUR.
   - Para cada nuevo cliente se cambia esta configuración.
========================================================= */

export type NosturTenantModules = {
  home: boolean;
  comunicaciones: boolean;
  clientes: boolean;
  carritos: boolean;
  presupuestos: boolean;
  caja: boolean;
  files: boolean;
  facturas: boolean;
  metas: boolean;
  nia: boolean;
  cande: boolean;
  configuracion: boolean;
};

export type NosturTenantConfig = {
  productName: string;
  tenantId: string;
  tenantSlug: string;
  tenantName: string;
  tenantLegalName: string;
  tenantDisplayName: string;
  supportEmail: string;
  updateBaseUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  modules: NosturTenantModules;
};

export const tenantConfig: NosturTenantConfig = {
  productName: "NOSTUR",

  tenantId: "nossix",
  tenantSlug: "nossix",
  tenantName: "NOSSIX",
  tenantLegalName: "NOSSIX S.A.S.",
  tenantDisplayName: "NOSSIX / ALMUNDO Franquicia Córdoba",

  supportEmail: "soporte@nostur.com.ar",

  updateBaseUrl: "https://updates.nostur.com.ar/nossix/desktop",

  supabaseUrl: import.meta.env.VITE_SUPABASE_URL || "",
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",

  modules: {
    home: true,
    comunicaciones: true,
    clientes: true,
    carritos: true,
    presupuestos: true,
    caja: true,
    files: true,
    facturas: true,
    metas: true,
    nia: true,
    cande: true,
    configuracion: true
  }
};