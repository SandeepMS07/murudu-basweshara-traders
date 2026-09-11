import { JWTPayload, SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { supabaseServer } from "@/lib/supabase/server";
import { SessionUser } from "../types";
import {
  can,
  type ModuleKey,
  type PermissionAction,
  type PermissionLevel,
  type PermissionMap,
} from "./permissions";

const secretKey = new TextEncoder().encode(env.SESSION_SECRET);

export async function signSession(payload: SessionUser): Promise<string> {
  return new SignJWT(payload as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("24h")
    .sign(secretKey);
}

export async function verifySession(input: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(input, secretKey, {
      algorithms: ["HS256"],
    });
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function setSessionCookie(sessionUser: SessionUser) {
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  const session = await signSession(sessionUser);
  const cookieStore = await cookies();
  
  cookieStore.set("session", session, {
    expires,
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export async function clearSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete("session");
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

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  const user = await verifySession(session);
  if (!user) return null;

  // Permissions are re-checked against the database on every call instead of
  // trusting what was baked into the token at login, so an admin changing a
  // user's access in /users takes effect immediately without requiring the
  // affected user to log out and back in. Admins always pass every check
  // (see can()), so there's nothing to refresh for them.
  if (user.role === "admin") return user;
  const perms = await loadUserPermissions(user.id);
  return { ...user, perms };
}

export async function requireAuth(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new Error("Unauthorized");
  }
  return user;
}

export async function requireRole(roles: string[]): Promise<SessionUser> {
  const user = await requireAuth();
  if (!roles.includes(user.role)) {
    throw new Error("Forbidden");
  }
  return user;
}

export async function requireModule(
  module: ModuleKey,
  action: PermissionAction = "view",
): Promise<SessionUser> {
  const user = await requireAuth();
  if (!can(user, module, action)) {
    throw new Error("Forbidden");
  }
  return user;
}
