import { redirect } from "next/navigation";

import { getCurrentUser } from "@/features/auth/lib/session";
import type { SessionUser } from "@/features/auth/types";

/**
 * Page-level guard for every /soya route. Soya is admin-only, so it is gated on
 * role rather than on the per-module permission map — nothing is added to
 * MODULES/user_permissions for it.
 *
 * Redirects (rather than throwing like requireRole) because this runs in pages;
 * server actions use requireRole(["admin"]) instead.
 */
export async function requireSoyaAdminPage(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "admin") {
    redirect("/dashboard");
  }
  return user;
}
