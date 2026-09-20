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
  /**
   * True until we know who the user is.
   *
   * This matters more than a spinner usually does. Permission checks answer
   * "false" while loading, which is indistinguishable from "you are not
   * allowed" — so a screen rendered during this window shows no Add, Edit or
   * Delete controls at all, then pops them in a moment later. Screens gate on
   * this so they show a skeleton instead of a wrong answer.
   */
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

    const fetchUser = () =>
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

    fetchUser();

    // Permissions are checked live against the database on the server, but
    // this client copy is only fetched once on mount — refetch on focus so
    // an admin changing someone's access shows up (e.g. Add/Edit buttons)
    // without the user having to reload the page.
    const onFocus = () => fetchUser();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      active = false;
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
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
