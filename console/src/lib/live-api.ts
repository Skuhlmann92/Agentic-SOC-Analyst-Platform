import { createHash, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const LIVE_TENANT = "22222222-2222-4222-8222-222222222222";
type Row = Record<string, unknown>;
type NeonSql = ReturnType<typeof neon>;

function sqlClient(): NeonSql {
  const url = process.env.POSTGRES_DATABASE_URL || process.env.POSTGRES_URL;
  if (!url) throw new Error("Missing Neon connection URL");
  return neon(url);
}
function resultRows(result: Awaited<ReturnType<NeonSql["query"]>>): Row[] {
  return Array.isArray(result) ? result as Row[] : [];
}
function uuidFromKey(key: string): string {
  const h = createHash("sha256").update(key).digest("hex");
  return `${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`;
}
export function validToken(provided: string | null): boolean {
  const expected = process.env.SOC_INGEST_TOKEN;
  if (!expected || !provided || !provided.startsWith("Bearer ")) return false;
  const candidate = provided.slice(7);
  const left = Buffer.from(candidate), right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left,right);
}
function value(v: unknown): string {
  return typeof v === "string" || typeof v === "number" ? String(v) : "";
}
function obj(v: unknown): Row {
  return v && typeof v === "object" && !Array.isArray(v) ? v as Row : {};
}
function severity(v: unknown, level: number): string {
  const s = value(v).toLowerCase();
  if (["critical","high","medium","low","informational"].includes(s)) return s;
  if (level>=12) return "critical";
  if (level>=8) return "high";
  if (level>=5) return "medium";
  if (level>=3) return "low";
  return "informational";
}
export type Normalized = {
  id: string; tenant_id: string; source: string; external_id: string;
  title: string; description: string; severity: string; status: string;
  rule_id: string | null; rule_name: string; vendor: string; product: string;
  technique_ids: string[]; tactics: string[]; hostname: string | null;
  username: string | null; detected_at: string; created_at: string;
  updated_at: string; headline: string; event_type: string;
  canonical_event_id: string; event_id: string;
  event_message: string; event_outcome: string; srcip: string | null;
};
export function normalizeEvent(payload: unknown, sourceHint: string): Normalized {
  const raw=obj(payload),rule=obj(raw.rule),agent=obj(raw.agent),data=obj(raw.data);
  const event=obj(raw.event),host=obj(raw.host),mitre=obj(rule.mitre);
  const originalSource=value(raw.source)||sourceHint||"edr";
  const source = /wazuh/i.test(originalSource) ? "wazuh" : originalSource.slice(0,64);
  const title=(value(rule.description)||value(raw.title)||value(event.action)||value(raw.message)||"Security detection").slice(0,320);
  const timestamp=value(raw.timestamp)||value(raw["@timestamp"])||value(raw.detected_at)||new Date().toISOString();
  const date=new Date(timestamp);
  const at=Number.isNaN(date.getTime())?new Date().toISOString():date.toISOString();
  const hostName=value(agent.name)||value(host.name)||value(raw.hostname)||value(raw.device_name)||"unknown";
  const idRaw=value(raw.id)||value(raw.external_id)||value(raw.event_id);
  const key=idRaw ? `${source}:${idRaw}` : `${source}:${createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`;
  const id=uuidFromKey(key);
  const level=Number(rule.level)||Number(raw.rule_level)||0;
  const technique_ids = (Array.isArray(mitre.id) ? mitre.id : mitre.id ? [mitre.id] : (Array.isArray(raw.technique_ids)?raw.technique_ids:[]))
    .map(value).filter(Boolean).slice(0,12);
  return {
    id,tenant_id:LIVE_TENANT,source,external_id:idRaw||key.slice(0,100),title,
    description:(value(raw.description)||value(raw.message)||title).slice(0,2000),
    severity:severity(raw.severity,level),status:"new",
    rule_id:value(rule.id)||null,rule_name:value(rule.description)||title,
    vendor:source==="wazuh"?"Wazuh":value(raw.vendor)||"EDR",
    product:value(raw.product)||source,technique_ids,tactics:[],
    hostname:hostName,username:value(data.dstuser)||value(data.srcuser)||value(raw.username)||null,
    detected_at:at,created_at:new Date().toISOString(),updated_at:new Date().toISOString(),
    headline:title,event_type:value(rule.groups)||value(event.category)||"Security Alert",
    canonical_event_id:uuidFromKey("event:"+key),event_id:uuidFromKey("event:"+key),
    event_message:title,event_outcome:"unknown",srcip:value(data.srcip)||value(raw.srcip)||null,
  };
}

export async function initLive(sql: NeonSql): Promise<void> {
  await sql.query(`CREATE TABLE IF NOT EXISTS soc_live_alerts (
    tenant_id text NOT NULL,
    id uuid NOT NULL,
    external_id text NOT NULL,
    source text NOT NULL,
    severity text NOT NULL,
    status text NOT NULL DEFAULT 'new',
    detected_at timestamptz NOT NULL,
    payload jsonb NOT NULL,
    PRIMARY KEY (tenant_id,id)
  )`);
  await sql.query("CREATE INDEX IF NOT EXISTS soc_live_alerts_recent ON soc_live_alerts (tenant_id,detected_at DESC)");
}
export async function ingestEvents(events: unknown[], source: string): Promise<{accepted:number;duplicates:number}> {
  const sql=sqlClient();
  await initLive(sql);
  let accepted=0,duplicates=0;
  for(const raw of events){
    const row=normalizeEvent(raw,source);
    const res=await sql.query(
      `INSERT INTO soc_live_alerts (tenant_id,id,external_id,source,severity,status,detected_at,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
      [LIVE_TENANT,row.id,row.external_id,row.source,row.severity,row.status,row.detected_at,JSON.stringify(row)]
    );
    if(resultRows(res).length) accepted++; else duplicates++;
  }
  return {accepted,duplicates};
}
function page(items: Row[],q:URLSearchParams) {
  const limit=Math.min(100,Math.max(1,Number(q.get("limit"))||50));
  const cursor=Math.max(0,Number(q.get("cursor"))||0);
  return {data:items.slice(cursor,cursor+limit),
    page:{limit,has_more:cursor+limit<items.length,
      next_cursor:cursor+limit<items.length?String(cursor+limit):null}};
}
function bucket(rows:Row[],field:string) {
  const values=new Map<string,number>();
  for(const item of rows){
    const key=value(item[field]);
    if(key)values.set(key,(values.get(key)||0)+1);
  }
  return [...values].map(([value,count])=>({value,count}));
}
export async function liveApi(request:Request,path:string[]):Promise<Response> {
  if(request.method!=="GET")
    return Response.json({error:{code:"read_only",message:"Live ingestion uses the authenticated /api/ingest endpoint."}},{status:405});
  const sql=sqlClient();
  await initLive(sql);
  const result=await sql.query(
    "SELECT payload FROM soc_live_alerts WHERE tenant_id=$1 ORDER BY detected_at DESC LIMIT 5000",[LIVE_TENANT]
  );
  const alerts=resultRows(result).map(r=>r.payload as Row);
  const url=new URL(request.url), q=url.searchParams, endpoint=path.join("/");
  const query=value(q.get("q")).toLowerCase();
  const filtered=alerts.filter(a=>{
    if(query&&!JSON.stringify(a).toLowerCase().includes(query))return false;
    for(const key of ["severity","source","status"]){
      const v=q.get(key); if(v&&v!==a[key])return false;
    }
    if(q.get("alert_id")&&q.get("alert_id")!==a.id)return false;
    return true;
  });
  const events=filtered.map(a=>({
    id:a.canonical_event_id, source:a.source, event_time:a.detected_at,
    class_name:a.event_type,activity_name:a.title,severity:a.severity,
    outcome:a.event_outcome,hostname:a.hostname,username:a.username,
    message:a.event_message,technique_ids:a.technique_ids,
    document:{source:a.source,rule_id:a.rule_id,srcip:a.srcip}
  }));
  if(endpoint==="api/v1/search/alerts")return Response.json(page(filtered,q));
  if(endpoint==="api/v1/search/events")return Response.json(page(events,q));
  if(endpoint==="api/v1/search/facets")return Response.json({
    severity:bucket(filtered,"severity"),source:bucket(filtered,"source"),
    event_type:bucket(filtered,"event_type"),host:bucket(filtered,"hostname"),user:bucket(filtered,"username")
  });
  if(endpoint==="api/v1/operations/connectors")
    return Response.json({data:bucket(alerts,"source").map(b=>({
      source:b.value,label:b.value,projected:b.count,dead_lettered:0,
      last_received_at:value(alerts.find(a=>a.source===b.value)?.detected_at)||null
    }))});
  if(endpoint==="api/v1/operations/dead-letters"||endpoint==="api/v1/operations/publications")
    return Response.json(page([],q));
  if(endpoint==="api/v1/cases"||endpoint==="api/v1/investigations"||
     endpoint==="api/v1/agent/runs"||endpoint==="api/v1/agent/drafts"||
     endpoint==="api/v1/search/entities")return Response.json(page([],q));
  const alertMatch=endpoint.match(/^api\/v1\/alerts\/([a-f0-9-]{36})$/i);
  if(alertMatch){const a=alerts.find(r=>r.id===alertMatch[1]);return a?Response.json(a):Response.json({error:{code:"not_found",message:"Alert not found"}},{status:404});}
  const eventMatch=endpoint.match(/^api\/v1\/events\/([a-f0-9-]{36})$/i);
  if(eventMatch){const e=events.find(r=>r.id===eventMatch[1]);return e?Response.json(e):Response.json({error:{code:"not_found",message:"Event not found"}},{status:404});}
  return Response.json({error:{code:"not_implemented",message:"This feature requires the full SOC Python backend."}},{status:501});
}
