import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/features/auth/lib/session";

const publicRoutes = ["/login", "/api/auth/login"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static assets, public files, Next.js internals
  if (
    pathname.includes(".") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/static") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const isPublicRoute = publicRoutes.includes(pathname);
  const sessionCookie = request.cookies.get("session")?.value;
  
  // Verify JWT session
  const sessionUser = sessionCookie ? await verifySession(sessionCookie) : null;

  // Protect private routes
  if (!isPublicRoute && !sessionUser) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect authenticated users away from the login page
  if (pathname === "/login" && sessionUser) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  
  // Root URL redirects to dashboard if authenticated, else login
  if (pathname === "/") {
      if (sessionUser) {
          return NextResponse.redirect(new URL("/dashboard", request.url));
      } else {
          return NextResponse.redirect(new URL("/login", request.url));
      }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (except /api/auth/*, let those pass to be checked in middleware logic)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
