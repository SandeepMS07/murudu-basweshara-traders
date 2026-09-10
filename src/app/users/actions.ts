"use server";

import { userCreateSchema, userUpdateSchema } from "@/features/users/schemas";
import { createUser, deleteUser, updateUser } from "@/features/users/service/user.service";

export async function createUserAction(data: unknown) {
  const parsed = userCreateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  try {
    const user = await createUser(parsed.data);
    return { success: true as const, user };
  } catch (error) {
    console.error("createUserAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to create user",
    };
  }
}

export async function updateUserAction(id: string, data: unknown) {
  const parsed = userUpdateSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, message: parsed.error.issues[0]?.message ?? "Invalid data" };
  }
  try {
    const user = await updateUser(id, parsed.data);
    return { success: true as const, user };
  } catch (error) {
    console.error("updateUserAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to update user",
    };
  }
}

export async function deleteUserAction(id: string) {
  if (!id?.trim()) {
    return { success: false as const, message: "User id is required" };
  }
  try {
    await deleteUser(id.trim());
    return { success: true as const };
  } catch (error) {
    console.error("deleteUserAction failed:", error);
    return {
      success: false as const,
      message: error instanceof Error ? error.message : "Failed to delete user",
    };
  }
}
