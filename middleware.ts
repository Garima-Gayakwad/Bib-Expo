import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";

import { AUTH_COOKIE_NAME, ACTIVE_EVENT_COOKIE_NAME } from "@/lib/auth";

const DASHBOARD_PATHS = ["/dashboard"];
const ADMIN_PATHS = ["/admin"];
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type Payload = {
  id: string;
  phone: string;
  role: string;
  counterName: string | null;
  eventId: string | null;
};

async function verifyTokenEdge(token: string): Promise<Payload | null> {
  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET ?? "fallback-secret-change-me");
    const { payload } = await jwtVerify(token, secret);
    return {
      id: payload.id as string,
      phone: payload.phone as string,
      role: (payload.role as string) ?? "VOLUNTEER",
      counterName: (payload.counterName as string) ?? null,
      eventId: (payload.eventId as string) ?? null,
    };
  } catch {
    return null;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  const payload = token ? await verifyTokenEdge(token) : null;

  // /admin/login is a common typo – redirect to /admin-login once
  if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
    return NextResponse.redirect(new URL("/admin-login", request.url));
  }

  // Admin routes: ADMIN only (exclude /admin-login – it's the login page, not a protected admin path)
  if (
    pathname !== "/admin-login" &&
    ADMIN_PATHS.some((p) => pathname.startsWith(p))
  ) {
    if (!payload) {
      const loginUrl = new URL("/admin-login", request.url);
      // Never redirect back to /admin/login (invalid) – use /admin/events as fallback
      const safeRedirect = pathname.startsWith("/admin/login") ? "/admin/events" : pathname;
      loginUrl.searchParams.set("redirect", safeRedirect);
      return NextResponse.redirect(loginUrl);
    }
    if (pathname.startsWith("/admin/events") && payload.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    // Allow only ADMIN and SUPER_ORGANIZER to access /admin routes
    if (payload.role !== "ADMIN" && payload.role !== "SUPER_ORGANIZER") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  // Dashboard: ADMIN + ORGANIZER + VOLUNTEER
  if (DASHBOARD_PATHS.some((p) => pathname.startsWith(p))) {
    if (!payload) {
      const loginUrl = new URL("/volunteer-login", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }

    const eventIdFromPath = pathname.startsWith("/dashboard/")
      ? pathname.split("/")[2] ?? ""
      : "";

    if (eventIdFromPath) {
      if (payload.role !== "ADMIN") {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }
      if (!UUID_LIKE.test(eventIdFromPath)) {
        return NextResponse.redirect(new URL("/dashboard", request.url));
      }

      const rewriteUrl = request.nextUrl.clone();
      rewriteUrl.pathname = "/dashboard";
      const response = NextResponse.rewrite(rewriteUrl);
      response.cookies.set(ACTIVE_EVENT_COOKIE_NAME, eventIdFromPath, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 60 * 60 * 24 * 30,
        path: "/",
      });
      return response;
    }

    if (payload.role === "ADMIN" && pathname === "/dashboard") {
      const activeEvent = request.cookies.get(ACTIVE_EVENT_COOKIE_NAME)?.value;
      if (!activeEvent) {
        return NextResponse.redirect(new URL("/admin/events", request.url));
      }
    }

    return NextResponse.next();
  }

  // Public auth pages: redirect to dashboard if already logged in
  if (
    ["/login", "/admin-login", "/organizer-login", "/volunteer-login", "/signup"].includes(pathname) &&
    payload
  ) {
    const target = payload.role === "ADMIN" ? "/admin/events" : "/dashboard";
    return NextResponse.redirect(new URL(target, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
