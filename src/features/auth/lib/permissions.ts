// Central RBAC definitions: modules, levels, and access checks.
// A user with role "admin" always passes every check. Everyone else is
// governed by their per-module permission levels.

export const MODULES = [
  "dashboard",
  "purchases",
  "bilty",
  "sales",
  "gunny",
  "expenses",
  "users",
] as const;

export type ModuleKey = (typeof MODULES)[number];

export type PermissionLevel = "none" | "view" | "edit";

export type PermissionMap = Partial<Record<ModuleKey, PermissionLevel>>;

export type PermissionAction = "view" | "edit";

export const MODULE_LABELS: Record<ModuleKey, string> = {
  dashboard: "Dashboard",
  purchases: "Purchases",
  bilty: "Bilty",
  sales: "Sales & Companies",
  gunny: "Gunny Bags",
  expenses: "Expenses",
  users: "Users",
};

// Default landing route for each module (used for smart redirects).
export const MODULE_HOME: Record<ModuleKey, string> = {
  dashboard: "/dashboard",
  purchases: "/purchases",
  bilty: "/bilty",
  sales: "/sales",
  gunny: "/gunny",
  expenses: "/expenses/overview",
  users: "/users",
};

// Longest-prefix wins, so order does not matter here.
const ROUTE_MODULE: { prefix: string; module: ModuleKey }[] = [
  { prefix: "/dashboard", module: "dashboard" },
  { prefix: "/purchases", module: "purchases" },
  { prefix: "/bilty", module: "bilty" },
  { prefix: "/sales", module: "sales" },
  { prefix: "/companies", module: "sales" },
  { prefix: "/our-companies", module: "sales" },
  { prefix: "/gunny", module: "gunny" },
  { prefix: "/expenses", module: "expenses" },
  { prefix: "/users", module: "users" },
];

/** Which module governs a given path, or null if the path is not module-gated. */
export function moduleForPath(pathname: string): ModuleKey | null {
  let match: { prefix: string; module: ModuleKey } | null = null;
  for (const entry of ROUTE_MODULE) {
    const isBoundary =
      pathname === entry.prefix || pathname.startsWith(`${entry.prefix}/`);
    if (isBoundary && (!match || entry.prefix.length > match.prefix.length)) {
      match = entry;
    }
  }
  return match?.module ?? null;
}

const LEVEL_RANK: Record<PermissionLevel, number> = {
  none: 0,
  view: 1,
  edit: 2,
};

type AccessUser = { role?: string | null; perms?: PermissionMap | null };

/** Does the user have at least `action` access to `module`? Admin always does. */
export function can(
  user: AccessUser | null | undefined,
  module: ModuleKey,
  action: PermissionAction = "view",
): boolean {
  if (!user) return false;
  if (user.role === "admin") return true;
  const level = user.perms?.[module] ?? "none";
  const needed = action === "edit" ? LEVEL_RANK.edit : LEVEL_RANK.view;
  return LEVEL_RANK[level] >= needed;
}

/** The path to send a user to after login / when blocked: their first allowed module. */
export function firstAllowedPath(user: AccessUser | null | undefined): string {
  for (const mod of MODULES) {
    if (can(user, mod, "view")) return MODULE_HOME[mod];
  }
  return "/no-access";
}
