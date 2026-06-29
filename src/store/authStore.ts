import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

export type AuthProfile = {
  id: string;
  email: string | null;
  nombre: string | null;
  apellido: string | null;
  rol: string | null;
  sucursal_id: string | null;
  color?: string | null;
  activo: boolean | null;
  is_super_admin?: boolean | null;
  is_support_user?: boolean | null;
  visible_en_sistema?: boolean | null;
};

type AuthState = {
  loading: boolean;
  initialized: boolean;
  session: Session | null;
  user: User | null;
  profile: AuthProfile | null;
  currentProfile: AuthProfile | null;
  error: string | null;

  initializeAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
};

function normalizeAuthError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) {
    return "Email o contraseña incorrectos.";
  }

  if (lower.includes("email not confirmed")) {
    return "El email todavía no está confirmado.";
  }

  if (lower.includes("rate limit")) {
    return "Demasiados intentos. Probá nuevamente en unos minutos.";
  }

  return message || "No se pudo iniciar sesión.";
}

async function loadProfile(userId?: string | null): Promise<AuthProfile | null> {
  if (!userId) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id,email,nombre,apellido,rol,sucursal_id,color,activo,is_super_admin,is_support_user,visible_en_sistema"
    )
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    console.error("No se pudo cargar el perfil del usuario:", error);
    return null;
  }

  return (data || null) as AuthProfile | null;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  loading: false,
  initialized: false,
  session: null,
  user: null,
  profile: null,
  currentProfile: null,
  error: null,

  initializeAuth: async () => {
    set({ loading: true, error: null });

    const { data, error } = await supabase.auth.getSession();

    if (error) {
      set({
        loading: false,
        initialized: true,
        session: null,
        user: null,
        profile: null,
        currentProfile: null,
        error: normalizeAuthError(error.message)
      });

      return;
    }

    const session = data.session;
    const user = session?.user || null;
    const profile = await loadProfile(user?.id || null);

    set({
      loading: false,
      initialized: true,
      session,
      user,
      profile,
      currentProfile: profile,
      error: null
    });

    supabase.auth.onAuthStateChange((_event, nextSession) => {
      const nextUser = nextSession?.user || null;

      set({
        session: nextSession,
        user: nextUser,
        initialized: true,
        loading: true,
        error: null
      });

      window.setTimeout(() => {
        void loadProfile(nextUser?.id || null).then((nextProfile) => {
          set({
            profile: nextProfile,
            currentProfile: nextProfile,
            loading: false,
            error: null
          });
        });
      }, 0);
    });
  },

  signIn: async (email, password) => {
    set({ loading: true, error: null });

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password
    });

    if (error) {
      set({
        loading: false,
        session: null,
        user: null,
        profile: null,
        currentProfile: null,
        error: normalizeAuthError(error.message)
      });

      return false;
    }

    const profile = await loadProfile(data.user?.id || null);

    set({
      loading: false,
      session: data.session,
      user: data.user,
      profile,
      currentProfile: profile,
      error: null
    });

    return true;
  },

  signOut: async () => {
    set({ loading: true, error: null });

    await supabase.auth.signOut();

    set({
      loading: false,
      session: null,
      user: null,
      profile: null,
      currentProfile: null,
      error: null
    });
  },

  refreshProfile: async () => {
    const userId = get().user?.id || get().session?.user?.id || null;
    const profile = await loadProfile(userId);

    set({
      profile,
      currentProfile: profile
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));