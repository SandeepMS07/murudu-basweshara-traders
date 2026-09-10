import { z } from "zod";
import type { ModuleKey, PermissionLevel } from "@/features/auth/lib/permissions";

export const permissionLevelEnum = z.enum(["none", "view", "edit"]);
export const userRoleEnum = z.enum(["admin", "operator"]);

// module -> level. Unknown modules are ignored by the service.
export const userPermissionsSchema = z.record(z.string(), permissionLevelEnum);

export const userCreateSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  role: userRoleEnum.default("operator"),
  permissions: userPermissionsSchema.default({}),
});

export const userUpdateSchema = z.object({
  email: z.string().trim().email("Invalid email address"),
  role: userRoleEnum,
  // Optional on update: only changes the password when provided.
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  permissions: userPermissionsSchema.default({}),
});

export type UserCreateInput = z.infer<typeof userCreateSchema>;
export type UserUpdateInput = z.infer<typeof userUpdateSchema>;

export type AppUser = {
  id: string;
  email: string;
  role: "admin" | "operator";
  permissions: Partial<Record<ModuleKey, PermissionLevel>>;
  created_at?: string;
};
