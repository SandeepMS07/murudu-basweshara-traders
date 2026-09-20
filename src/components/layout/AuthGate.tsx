"use client";

import { useAuth } from "@/features/auth/components/AuthProvider";

/**
 * Holds a page back until we know who is looking at it.
 *
 * Permission checks (`canEdit`, `canView`) return false while the session is
 * still being fetched, and false is also what "you are not allowed" looks
 * like. So a page rendered during that window is not merely incomplete — it is
 * wrong: Add Purchase, Edit and Delete are all absent, exactly as they would
 * be for a view-only user, and then they appear a moment later.
 *
 * Showing a loader for that moment is the honest option. It is short — the
 * session is one request, and since AppShell and Sidebar stopped fetching it
 * separately there is only one in flight rather than three. It is also
 * genuinely brief for admins (no permission lookup) and a little longer for
 * operators, whose permissions are read from the database.
 *
 * Note this only covers the FIRST load. Moving between pages afterwards keeps
 * the same provider mounted, so the session is already known and nothing here
 * renders at all.
 */
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading } = useAuth();

  if (!loading) return <>{children}</>;

  return (
    <div
      className="flex min-h-[60vh] flex-col items-center justify-center gap-3"
      role="status"
      aria-live="polite"
    >
      <span
        aria-hidden
        className="h-7 w-7 animate-spin rounded-full border-2 border-[#2a2d34] border-t-[#ff6a3d]"
      />
      <span className="text-sm text-zinc-500">Loading…</span>
    </div>
  );
}
