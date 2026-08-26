import type { PermissionMap } from "../lib/permissions";

export type Role = "admin" | "operator";

export interface User {
  id: string;
  email: string;
  passwordHash: string;
  role: Role;
}

export interface SessionUser {
  id: string;
  email: string;
  role: Role;
  // Per-module access levels. Absent/empty for admins (who bypass all checks).
  perms?: PermissionMap;
}
