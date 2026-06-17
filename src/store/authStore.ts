import { create } from "zustand";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";

type AuthState = {
  loading: boolean;
  initialized: boolean;
  session: Session | null;
  user: User | null;
  error: string | null;

  initializeAuth: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
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

export const useAuthStore = create<AuthState>((set) => ({
  loading: false,
  initialized: false,
  session: null,
  user: null,
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
        error: normalizeAuthError(error.message)
      });

      return;
    }

    set({
      loading: false,
      initialized: true,
      session: data.session,
      user: data.session?.user || null,
      error: null
    });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({
        session,
        user: session?.user || null,
        initialized: true,
        loading: false,
        error: null
      });
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
        error: normalizeAuthError(error.message)
      });

      return false;
    }

    set({
      loading: false,
      session: data.session,
      user: data.user,
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
      error: null
    });
  },

  clearError: () => {
    set({ error: null });
  }
}));