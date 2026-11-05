import { NextResponse } from "next/server";
import { neon } from "@neondatabase/serverless";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.POSTGRES_DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) {
    return NextResponse.json(
      { service: "soc-console", database: "not_configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
  try {
    const sql = neon(url);
    await sql`SELECT 1 AS connected`;
    return NextResponse.json(
      { service: "soc-console", database: "connected" },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { service: "soc-console", database: "unavailable" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
