import {consumeAdminTotp} from "@/lib/admin-totp";
import {checkLoginThrottle} from "@/lib/auth-throttle";
import { timingSafeEqual } from "node:crypto";
import { LIVE_TENANT } from "@/lib/live-api";
import { NextResponse } from "next/server";

import { findOperator, isUuid } from "@/lib/operators";
import { sealSession, SESSION_COOKIE } from "@/lib/session-token";

export async function POST(request: Request) {
  // Login also changes a browser's authentication state; reject login CSRF.
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) {
    return NextResponse.json({error:{code:"invalid_origin",message:"Cross-origin login denied."}},
      {status:403,headers:{"Cache-Control":"no-store"}});
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "The request body is not valid JSON." } },
      { status: 422 },
    );
  }
  // JSON assertions do not validate runtime input. Reject wrong field types before
  // property access, Buffer conversion, string operations or authentication work.
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return invalidInput();
  }
  const fields = input as Record<string, unknown>;
  const limits = {operator: 128, password: 4096, tenantId: 64, totp: 64};
  for (const [key, limit] of Object.entries(limits)) {
    if (fields[key] !== undefined &&
        (typeof fields[key] !== "string" || fields[key].length > limit)) return invalidInput();
  }
  if (fields.demo !== undefined && typeof fields.demo !== "boolean") return invalidInput();
  const body = fields as {operator?: string; password?: string; tenantId?: string; demo?: boolean; totp?: string};
  if (body.demo === true) {
    const tenantId = "11111111-1111-4111-8111-111111111111";
    const token = await sealSession({
      sub: "demo-analyst", role: "analyst", name: "Demo Analyst",
      tenantId, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 4,
    });
    const response = NextResponse.json({ name: "Demo Analyst", role: "analyst", tenantId, demo: true });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 60 * 60 * 4,
    });
    return response;
  }
  // Production administrator auth has an atomic server-side attempt limit.
  if(process.env.NODE_ENV==="production" && body.operator==="admin"){
    const throttle=await checkLoginThrottle(request,"admin");
    if(!throttle.allowed)return NextResponse.json(
      {error:{code:"rate_limited",message:"Too many login attempts or login protection unavailable."}},
      {status:429,headers:{"Retry-After":String(throttle.retrySeconds),"Cache-Control":"no-store"}}
    );
  }
  const adminName = process.env.SOC_ADMIN_USERNAME || "socadmin";
  const adminPassword = process.env.SOC_ADMIN_PASSWORD;
  const provided = body.password || "";
  const safeMatch = (left: string, right: string) => {
    const a = Buffer.from(left), b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a,b);
  };
  if (body.operator === "admin" && adminPassword && safeMatch(adminPassword,provided)) {
    if (!await consumeAdminTotp(typeof body.totp === "string" ? body.totp : "")) {
      return failedAdminLogin();
    }
    const token = await sealSession({
      mfa: true, sub: adminName, role: "admin", name: "SOC Administrator",
      tenantId: LIVE_TENANT, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    });
    const response = NextResponse.json({name:"SOC Administrator",role:"admin",tenantId:LIVE_TENANT});
    response.cookies.set(SESSION_COOKIE,token,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*8,
    });
    return response;
  }
  // Do not disclose whether the password or the second factor was incorrect.
  if (body.operator === "admin" && (process.env.NODE_ENV === "production" || adminPassword)) return failedAdminLogin();
  // Local sample accounts have known credentials: never permit them in production.
  if (process.env.NODE_ENV === "production" || process.env.ENABLE_LOCAL_OPERATORS !== "true") {
    return NextResponse.json(
      { error: { code: "disabled", message: "Private SOC sign-in failed. Check your administrator password or use the demo." } },
      { status: 403 },
    );
  }
  const tenantId = (body.tenantId || "").trim();
  const operator = findOperator((body.operator || "").trim(), body.password || "");
  if (!operator || !isUuid(tenantId)) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: "Operator, password, or tenant is not valid." } },
      { status: 401 },
    );
  }
  const token = await sealSession({
    sub: operator.id,
    role: operator.role,
    name: operator.name,
    tenantId,
    exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12,
  });
  const response = NextResponse.json({ name: operator.name, role: operator.role, tenantId });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return response;
}

function invalidInput() {
  return NextResponse.json({error:{code:"validation_error",message:"Ungültige Anmeldedaten."}},
    {status:422,headers:{"Cache-Control":"no-store"}});
}

function failedAdminLogin() {
  return NextResponse.json({error:{code:"unauthenticated",message:"Anmeldung fehlgeschlagen. Passwort und Bestätigungscode prüfen."}},
    {status:401,headers:{"Cache-Control":"no-store"}});
}
