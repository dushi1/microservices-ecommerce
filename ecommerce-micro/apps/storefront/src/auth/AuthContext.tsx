import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { MeResponse } from "@ecommerce/contracts/rest";
import * as authApi from "../api/auth";
import { onAuthEvent, restoreSession } from "../api/client";

interface AuthState {
  user: MeResponse | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();

  useEffect(() => {
    (async () => {
      // Tab reopened: if a refresh token survived in localStorage, exchange it
      // for a fresh access token, then load the profile. Otherwise anonymous.
      if (await restoreSession()) {
        try {
          setUser(await authApi.fetchMe());
        } catch {
          authApi.logout();
        }
      }
      setLoading(false);
    })();
  }, []);

  // Cross-tab sync: another tab logged in/out or refreshed — mirror its UI state here.
  useEffect(
    () =>
      onAuthEvent(async (msg) => {
        if (msg.type === "tokens") {
          try {
            setUser(await authApi.fetchMe());
          } catch {
            setUser(null);
          }
        } else {
          setUser(null);
          queryClient.clear();
        }
      }),
    [queryClient],
  );

  async function login(email: string, password: string) {
    await authApi.login({ email, password });
    setUser(await authApi.fetchMe());
    queryClient.clear();
  }

  async function register(email: string, password: string, displayName: string) {
    await authApi.register({ email, password, displayName });
    setUser(await authApi.fetchMe());
    queryClient.clear();
  }

  function logout() {
    authApi.logout();
    setUser(null);
    queryClient.clear();
  }

  if (loading) {
    return <div className="min-h-screen grid place-items-center text-slate-500">Loading…</div>;
  }

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: user !== null, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
