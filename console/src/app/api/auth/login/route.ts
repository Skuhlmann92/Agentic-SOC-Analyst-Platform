import { timingSafeEqual } from "node:crypto";
import { LIVE_TENANT } from "@/lib/live-api";
import { NextResponse } from "next/server";

import { findOperator, isUuid } from "@/lib/operators";
import { sealSession, SESSION_COOKIE } from "@/lib/session-token";

export async function POST(request: Request) {
  let body: { operator?: string; password?: string; tenantId?: string; demo?: boolean };
  try {
    body = (await request.json()) as { operator?: string; password?: string; tenantId?: string; demo?: boolean };
  } catch {
    return NextResponse.json(
      { error: { code: "validation_error", message: "The request body is not valid JSON." } },
      { status: 422 },
    );
  }
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
  const adminName = process.env.SOC_ADMIN_USERNAME || "socadmin";
  const adminPassword = process.env.SOC_ADMIN_PASSWORD;
  const provided = body.password || "";
  const safeMatch = (left: string, right: string) => {
    const a = Buffer.from(left), b = Buffer.from(right);
    return a.length === b.length && timingSafeEqual(a,b);
  };
  if (body.operator === "admin" && adminPassword && safeMatch(adminPassword,provided)) {
    const token = await sealSession({
      sub: adminName, role: "admin", name: "SOC Administrator",
      tenantId: LIVE_TENANT, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 8,
    });
    const response = NextResponse.json({name:"SOC Administrator",role:"admin",tenantId:LIVE_TENANT});
    response.cookies.set(SESSION_COOKIE,token,{
      httpOnly:true,secure:process.env.NODE_ENV==="production",sameSite:"lax",path:"/",maxAge:60*60*8,
    });
    return response;
  }
  if (process.env.NODE_ENV === "production" && process.env.ENABLE_LOCAL_OPERATORS !== "true") {
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
