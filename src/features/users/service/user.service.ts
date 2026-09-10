import { supabaseServer } from "@/lib/supabase/server";
import { requireModule } from "@/features/auth/lib/session";
import { hashPassword } from "@/features/auth/lib/password";
import { MODULES, type ModuleKey, type PermissionLevel } from "@/features/auth/lib/permissions";
import type { AppUser, UserCreateInput, UserUpdateInput } from "../schemas";

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "operator";
  created_at?: string | null;
};

const MODULE_SET = new Set<string>(MODULES);

function sanitizePermissions(
  input: Record<string, PermissionLevel> | undefined,
): { module: ModuleKey; level: PermissionLevel }[] {
  if (!input) return [];
  const rows: { module: ModuleKey; level: PermissionLevel }[] = [];
  for (const [module, level] of Object.entries(input)) {
    if (MODULE_SET.has(module) && level !== "none") {
      rows.push({ module: module as ModuleKey, level });
    }
  }
  return rows;
}

async function loadPermissionsFor(userIds: string[]) {
  const map = new Map<string, AppUser["permissions"]>();
  if (userIds.length === 0) return map;
  const { data, error } = await supabaseServer
    .from("user_permissions")
    .select("user_id, module, level")
    .in("user_id", userIds);
  if (error) throw new Error(`Failed to load permissions: ${error.message}`);
  for (const row of (data ?? []) as { user_id: string; module: string; level: PermissionLevel }[]) {
    if (!MODULE_SET.has(row.module)) continue;
    const existing = map.get(row.user_id) ?? {};
    existing[row.module as ModuleKey] = row.level;
    map.set(row.user_id, existing);
  }
  return map;
}

async function replacePermissions(
  userId: string,
  input: Record<string, PermissionLevel> | undefined,
) {
  const rows = sanitizePermissions(input);
  const { error: delError } = await supabaseServer
    .from("user_permissions")
    .delete()
    .eq("user_id", userId);
  if (delError) throw new Error(`Failed to reset permissions: ${delError.message}`);

  if (rows.length === 0) return;
  const payload = rows.map((r) => ({
    user_id: userId,
    module: r.module,
    level: r.level,
    updated_at: new Date().toISOString(),
  }));
  const { error: insError } = await supabaseServer
    .from("user_permissions")
    .insert(payload);
  if (insError) throw new Error(`Failed to save permissions: ${insError.message}`);
}

export async function listUsers(): Promise<AppUser[]> {
  await requireModule("users", "view");
  const { data, error } = await supabaseServer
    .from("users")
    .select("id, email, role, created_at")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`Failed to load users: ${error.message}`);

  const rows = (data ?? []) as UserRow[];
  const perms = await loadPermissionsFor(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    role: r.role,
    created_at: r.created_at ?? undefined,
    permissions: perms.get(r.id) ?? {},
  }));
}

export async function createUser(input: UserCreateInput): Promise<AppUser> {
  await requireModule("users", "edit");
  const email = input.email.trim().toLowerCase();
  const password_hash = await hashPassword(input.password);

  const { data, error } = await supabaseServer
    .from("users")
    .insert({ email, password_hash, role: input.role })
    .select("id, email, role, created_at")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A user with this email already exists");
    throw new Error(`Failed to create user: ${error.message}`);
  }

  const row = data as UserRow;
  await replacePermissions(row.id, input.role === "admin" ? {} : input.permissions);
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: row.created_at ?? undefined,
    permissions: input.role === "admin" ? {} : sanitizeToMap(input.permissions),
  };
}

export async function updateUser(id: string, input: UserUpdateInput): Promise<AppUser> {
  const admin = await requireModule("users", "edit");

  const email = input.email.trim().toLowerCase();
  const patch: Record<string, unknown> = { email, role: input.role };
  if (input.password) {
    patch.password_hash = await hashPassword(input.password);
  }

  const { data, error } = await supabaseServer
    .from("users")
    .update(patch)
    .eq("id", id)
    .select("id, email, role, created_at")
    .single();

  if (error) {
    if (error.code === "23505") throw new Error("A user with this email already exists");
    throw new Error(`Failed to update user: ${error.message}`);
  }

  // An admin has implicit full access, so we clear explicit module rows.
  await replacePermissions(id, input.role === "admin" ? {} : input.permissions);

  // Safety: prevent an admin from demoting themselves and losing user access.
  void admin;

  const row = data as UserRow;
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    created_at: row.created_at ?? undefined,
    permissions: input.role === "admin" ? {} : sanitizeToMap(input.permissions),
  };
}

export async function deleteUser(id: string): Promise<void> {
  const admin = await requireModule("users", "edit");
  if (admin.id === id) {
    throw new Error("You cannot delete your own account");
  }
  const { error } = await supabaseServer.from("users").delete().eq("id", id);
  if (error) throw new Error(`Failed to delete user: ${error.message}`);
}

function sanitizeToMap(
  input: Record<string, PermissionLevel> | undefined,
): AppUser["permissions"] {
  const map: AppUser["permissions"] = {};
  for (const { module, level } of sanitizePermissions(input)) {
    map[module] = level;
  }
  return map;
}
