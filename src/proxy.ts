import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession } from "@/features/auth/lib/session";
import { can, firstAllowedPath, moduleForPath } from "@/features/auth/lib/permissions";

const publicRoutes = ["/login", "/api/auth/login", "/no-access"];

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
    return NextResponse.redirect(new URL(firstAllowedPath(sessionUser), request.url));
  }

  // Root URL redirects to the user's first allowed module, else login
  if (pathname === "/") {
    return NextResponse.redirect(
      new URL(sessionUser ? firstAllowedPath(sessionUser) : "/login", request.url),
    );
  }

  // Module-based access control: block routes the user can't view.
  if (sessionUser && !isPublicRoute) {
    const routeModule = moduleForPath(pathname);
    if (routeModule && !can(sessionUser, routeModule, "view")) {
      return NextResponse.redirect(
        new URL(firstAllowedPath(sessionUser), request.url),
      );
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
