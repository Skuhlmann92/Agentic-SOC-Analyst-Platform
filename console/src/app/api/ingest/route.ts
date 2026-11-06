import { ingestEvents } from "@/lib/live-api";
import {authenticateIngest,validateIngestEvents} from "@/lib/ingest-auth";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY = 256 * 1024;
const MAX_BATCH = 100;

export async function POST(request: Request) {
  const credential=await authenticateIngest(request.headers.get("authorization"));
  if (!credential) {
    return Response.json({ error: { code: "unauthorized", message: "Valid bearer token required" } }, { status: 401 });
  }
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return Response.json({ error: { code: "unsupported_media_type", message: "Expected application/json" } }, { status: 415 });
  }
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY) {
    return Response.json({ error: { code: "too_large", message: "Max 256 KiB" } }, { status: 413 });
  }
  let body: unknown;
  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_BODY) {
      return Response.json({ error: { code: "too_large", message: "Max 256 KiB" } }, { status: 413 });
    }
    body = JSON.parse(raw);
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "Expected JSON object or events array" } }, { status: 400 });
  }
  const wrapper = body && typeof body === "object" && !Array.isArray(body) ? body as Record<string, unknown> : {};
  const events = Array.isArray(body) ? body : Array.isArray(wrapper.events) ? wrapper.events : [body];
  if (!events.length || events.length > MAX_BATCH || events.some(x=>!x||typeof x!=="object"||Array.isArray(x))) {
    return Response.json({ error: { code: "invalid_batch", message: "Provide 1-100 event objects" } }, { status: 422 });
  }
  if(!validateIngestEvents(events,credential))return Response.json({error:{code:"agent_not_registered",message:"Connector agent is not enrolled in this organization"}},{status:403});
  const hint = typeof wrapper.source === "string" ? wrapper.source.slice(0,64) :
    (request.headers.get("x-soc-source") || "wazuh").slice(0,64);
  try {
    const result = await ingestEvents(events,hint,credential.tenantId);
    return Response.json({ok:true,source:hint,received:events.length,...result},{headers:{"cache-control":"no-store"}});
  } catch {
    return Response.json({error:{code:"storage_unavailable",message:"Unable to persist events to Neon"}},{status:503});
  }
}
export async function GET() {
  return Response.json({error:{code:"method_not_allowed",message:"Use authenticated POST"}},{status:405});
}
