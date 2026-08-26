import { SessionUser, User } from "../types";
import { LoginInput } from "../schemas";
import { verifyPassword } from "../lib/password";
import { setSessionCookie, clearSessionCookie } from "../lib/session";
import { supabaseServer } from "@/lib/supabase/server";
import type { ModuleKey, PermissionLevel, PermissionMap } from "../lib/permissions";

function toRole(value: string): User["role"] | null {
  return value === "admin" || value === "operator" ? value : null;
}

/** Load a user's per-module permission levels into a map. */
export async function loadUserPermissions(userId: string): Promise<PermissionMap> {
  const { data, error } = await supabaseServer
    .from("user_permissions")
    .select("module, level")
    .eq("user_id", userId);

  if (error || !data) return {};

  const perms: PermissionMap = {};
  for (const row of data as { module: string; level: string }[]) {
    if (row.level === "none" || row.level === "view" || row.level === "edit") {
      perms[row.module as ModuleKey] = row.level as PermissionLevel;
    }
  }
  return perms;
}

export async function authenticateUser(credentials: LoginInput): Promise<SessionUser | null> {
  const { data: user, error } = await supabaseServer
    .from("users")
    .select("id, email, password_hash, role")
    .eq("email", credentials.email)
    .maybeSingle();

  if (error || !user) return null;

  const role = toRole(user.role);
  if (!role) return null;

  const dbUser: User = {
    id: user.id,
    email: user.email,
    passwordHash: user.password_hash,
    role,
  };

  const isValid = await verifyPassword(credentials.password, dbUser.passwordHash);
  if (!isValid) return null;

  // Admins bypass per-module checks, so don't bloat their token with perms.
  const perms = dbUser.role === "admin" ? {} : await loadUserPermissions(dbUser.id);

  const sessionUser: SessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
    perms,
  };

  await setSessionCookie(sessionUser);
  return sessionUser;
}

export async function logoutUser() {
  await clearSessionCookie();
}
