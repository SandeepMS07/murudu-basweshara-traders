import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/lib/env";
import { SessionUser } from "../types";

const secretKey = new TextEncoder().encode(env.SESSION_SECRET);

export async function signSession(payload: SessionUser): Promise<string> {
  return new SignJWT(payload as any)
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
  } catch (error) {
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

export async function getCurrentUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;
  if (!session) return null;
  return verifySession(session);
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
