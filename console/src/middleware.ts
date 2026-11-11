import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { canAdminister, canReview } from "@/lib/operators";
import { openSession, SESSION_COOKIE } from "@/lib/session-token";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname === "/api/endpoint-heartbeat" && request.method === "POST") return NextResponse.next();
  if (pathname === "/api/endpoint-inventory" && request.method === "POST") return NextResponse.next();
  // Login is a browser mutation too: apply the origin guard before bypassing auth.
  // Ingest and public health probes remain unauthenticated but are not exempt
  // from the browser-origin policy when an Origin header is supplied.
  // Cookies are SameSite=Lax; additionally reject cross-origin browser writes.
  // Machine-to-machine ingestion uses independent bearer tokens and no cookies.
  if(pathname.startsWith("/api/")&& !["GET","HEAD","OPTIONS"].includes(request.method)){
    const origin=request.headers.get("origin");
    if(origin&&origin!==request.nextUrl.origin){
      return NextResponse.json(
        {error:{code:"invalid_origin",message:"Cross-origin API mutation denied."}},
        {status:403,headers:{"cache-control":"no-store"}}
      );
    }
  }
  if (pathname === "/api/auth/login" || pathname === "/api/ingest" || pathname === "/api/health/database") return NextResponse.next();
  const session = await openSession(request.cookies.get(SESSION_COOKIE)?.value);
  if (pathname === "/login") {
    if (session) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }
  if (!session) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "unauthenticated", message: "Sign in required." } },
        { status: 401 },
      );
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (pathname.startsWith("/reviews") && !canReview(session.role)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  if ((pathname.startsWith("/admin") || pathname.startsWith("/api/operations")) && !canAdminister(session.role)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Administration is limited to the administrator role." } },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
