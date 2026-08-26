"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { SessionUser } from "../types";
import { can, type ModuleKey } from "../lib/permissions";

type AuthContextValue = {
  user: SessionUser | null;
  loading: boolean;
  canView: (module: ModuleKey) => boolean;
  canEdit: (module: ModuleKey) => boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  canView: () => false,
  canEdit: () => false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!active) return;
        setUser(data?.user ?? null);
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      canView: (module) => can(user, module, "view"),
      canEdit: (module) => can(user, module, "edit"),
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

/** True when the current user may edit the given module (admins always can). */
export function useCanEdit(module: ModuleKey): boolean {
  return useAuth().canEdit(module);
}
