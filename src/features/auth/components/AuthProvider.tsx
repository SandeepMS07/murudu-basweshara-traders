"use client";

import {
  createContext,
  useCallback,
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
  /**
   * Re-reads the session from the server.
   *
   * Required after signing in. This provider lives in the root layout, so a
   * client-side navigation from /login to /dashboard does NOT remount it and
   * does NOT refetch — it would keep serving the `null` user it got from the
   * 401 on the login page, leaving the sidebar empty and every permission
   * check answering "no" until a hard refresh. router.refresh() cannot fix
   * that: it re-renders server components and does not touch client state.
   */
  refresh: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  canView: () => false,
  canEdit: () => false,
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      const data = res.ok ? await res.json() : null;
      setUser(data?.user ?? null);
    } catch {
      // Leave the last known user in place: a dropped request is not proof
      // the session ended, and blanking it would empty the nav mid-session.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchUser = () => refresh();

    fetchUser();

    // Permissions are checked live against the database on the server, but
    // this client copy is only fetched once on mount — refetch on focus so
    // an admin changing someone's access shows up (e.g. Add/Edit buttons)
    // without the user having to reload the page.
    const onFocus = () => fetchUser();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [refresh]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      canView: (module) => can(user, module, "view"),
      canEdit: (module) => can(user, module, "edit"),
      refresh,
    }),
    [user, loading, refresh],
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
