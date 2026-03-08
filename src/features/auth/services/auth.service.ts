import { SessionUser, User } from "../types";
import { LoginInput } from "../schemas";
import { verifyPassword } from "../lib/password";
import { setSessionCookie, clearSessionCookie } from "../lib/session";
import { supabaseServer } from "@/lib/supabase/server";

function toRole(value: string): User["role"] | null {
  return value === "admin" || value === "operator" ? value : null;
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

  const sessionUser: SessionUser = {
    id: dbUser.id,
    email: dbUser.email,
    role: dbUser.role,
  };

  await setSessionCookie(sessionUser);
  return sessionUser;
}

export async function logoutUser() {
  await clearSessionCookie();
}
