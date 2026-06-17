// src/lib/supabase.ts

import { createClient } from "@supabase/supabase-js";
import { tenantConfig } from "../config/tenantConfig";

/* =========================================================
   NOSTUR — SUPABASE CLIENT

   La configuración viene desde tenantConfig.

   IMPORTANTE:
   - En NOSTUR-MASTER, .env.local apunta a la BD master.
   - En NOSTUR-NOSSIX, .env.local apunta a la BD NOSSIX.
   - No hardcodear URLs ni keys en este archivo.
========================================================= */

const supabaseUrl = tenantConfig.supabaseUrl;
const supabaseAnonKey = tenantConfig.supabaseAnonKey;

if (!supabaseUrl) {
  throw new Error(
    "Falta VITE_SUPABASE_URL en .env.local para el tenant " + tenantConfig.tenantSlug
  );
}

if (!supabaseAnonKey) {
  throw new Error(
    "Falta VITE_SUPABASE_ANON_KEY en .env.local para el tenant " + tenantConfig.tenantSlug
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
    storageKey: `nostur-auth-session-${tenantConfig.tenantSlug}`
  }
});