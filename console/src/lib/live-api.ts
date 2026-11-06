import {deriveSecurityPosture} from "@/lib/security-posture";
import {createTimeline,timelineBounds,timelineOptions} from "@/lib/timeline";
import { agentApi, analyzeNewAlert } from "@/lib/agent-triage";
import { deriveLiveViews } from "@/lib/live-views";
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
/** Retain bounded incident context without persisting full raw logs or obvious credentials. */
function safeWazuhContext(raw: Row, rule: Row, data: Row): Row {
  const sensitive = /(?:pass(?:word|wd)?|secret|token|api.?key|authorization|cookie|private.?key|credential)/i;
  const clean = (input: unknown, depth=0): unknown => {
    if (depth>5) return "[depth limit]";
    if (Array.isArray(input)) return input.slice(0,30).map(x=>clean(x,depth+1));
    if (input && typeof input==="object") {
      return Object.fromEntries(Object.entries(input as Row).slice(0,75).filter(([k])=>!sensitive.test(k)).map(([k,v])=>[k,clean(v,depth+1)]));
    }
    if(typeof input==="string") return input.slice(0,1200).replace(/(password|token|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/ig,"$1=[REDACTED]");
    return typeof input==="number"||typeof input==="boolean" ? input : null;
  };
  return {
    source_location: value(raw.location).slice(0,250),
    decoder: clean(raw.decoder || {}),
    rule: clean({id:rule.id,level:rule.level,groups:rule.groups,mitre:rule.mitre,pci_dss:rule.pci_dss,description:rule.description}),
    data: clean(data),
    win: clean(obj(data.win)),
    full_log_excerpt: clean(value(raw.full_log).slice(0,1600)),
    manager_name:value(raw.manager).slice(0,120),
  };
}

export type Normalized = {
  id: string; tenant_id: string; source: string; external_id: string;
  title: string; description: string; severity: string; status: string;
  rule_id: string | null; rule_level: number | null; rule_name: string; vendor: string; product: string;
  wazuh_context?: Row;
  technique_ids: string[]; tactics: string[]; hostname: string | null;
  username: string | null; detected_at: string; created_at: string;
  updated_at: string; headline: string; event_type: string;
  canonical_event_id: string; event_id: string;
  event_message: string; event_outcome: string; srcip: string | null;
};
export function normalizeEvent(payload: unknown, sourceHint: string,tenantId=LIVE_TENANT): Normalized {
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
  const keyPrefix=tenantId===LIVE_TENANT?source:`${tenantId}:${source}`;
  const key=idRaw ? `${keyPrefix}:${idRaw}` : `${keyPrefix}:${createHash("sha256").update(JSON.stringify(raw)).digest("hex")}`;
  const id=uuidFromKey(key);
  const level=Number(rule.level)||Number(raw.rule_level)||0;
  const technique_ids = (Array.isArray(mitre.id) ? mitre.id : mitre.id ? [mitre.id] : (Array.isArray(raw.technique_ids)?raw.technique_ids:[]))
    .map(value).filter(Boolean).slice(0,12);
  return {
    id,tenant_id:tenantId,source,external_id:idRaw||key.slice(0,100),title,
    description:(value(raw.description)||value(raw.message)||title).slice(0,2000),
    severity:severity(raw.severity,level),status:"new",
    rule_id:value(rule.id)||null,rule_level:Number.isFinite(level)?level:null,rule_name:value(rule.description)||title,
    vendor:source==="wazuh"?"Wazuh":value(raw.vendor)||"EDR",
    product:value(raw.product)||source,technique_ids,tactics:[],
    ...(source==="wazuh"?{wazuh_context:safeWazuhContext(raw,rule,data)}:{}),
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
  await sql.query(`CREATE TABLE IF NOT EXISTS soc_live_audit (
    id bigserial PRIMARY KEY, tenant_id text NOT NULL, alert_id uuid NOT NULL,
    action text NOT NULL, actor text NOT NULL, recorded_at timestamptz NOT NULL DEFAULT NOW()
  )`);
}
export async function ingestEvents(events: unknown[], source: string,tenantId=LIVE_TENANT): Promise<{accepted:number;duplicates:number}> {
  const sql=sqlClient();
  await initLive(sql);
  let accepted=0,duplicates=0;
  for(const raw of events){
    const row=normalizeEvent(raw,source,tenantId);
    const res=await sql.query(
      `INSERT INTO soc_live_alerts (tenant_id,id,external_id,source,severity,status,detected_at,payload)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) ON CONFLICT DO NOTHING RETURNING id`,
      [tenantId,row.id,row.external_id,row.source,row.severity,row.status,row.detected_at,JSON.stringify(row)]
    );
    if(resultRows(res).length) { accepted++; if(tenantId===LIVE_TENANT){try { await analyzeNewAlert(sql,row as unknown as Row); } catch(error) { console.error("SOC automated triage failed", error instanceof Error ? error.message : "unknown"); }} } else duplicates++;
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
export async function liveApi(request:Request,path:string[],actor="SOC Administrator"):Promise<Response> {
  const sql=sqlClient();
  await initLive(sql);
  const endpoint=path.join("/");
  const parts=endpoint.split("/");
  if(endpoint==="api/v1/search/timeline"){
    if(request.method!=="GET")return Response.json({error:{code:"method_not_allowed",message:"Timeline is read-only"}},{status:405});
    const options=timelineOptions(new URL(request.url).searchParams.get("range"));
    const {startMs,endMs,stepMs}=timelineBounds(options.step,options.points);
    const aggregated=await sql.query(
      `SELECT date_bin(make_interval(mins => $2::int),detected_at,'2000-01-01 00:00:00+00'::timestamptz) AS bucket,
              severity,COUNT(*)::int AS count
       FROM soc_live_alerts
       WHERE tenant_id=$1 AND detected_at >= $3::timestamptz AND detected_at < $4::timestamptz
       GROUP BY 1,2 ORDER BY 1`,
      [LIVE_TENANT,options.step,new Date(startMs).toISOString(),new Date(Math.min(Date.now(),endMs+stepMs)).toISOString()]
    );
    return Response.json(createTimeline(options.range,options.step,options.points,
      resultRows(aggregated) as Array<{bucket:unknown;severity:unknown;count:unknown}>),{
      headers:{"Cache-Control":"private, no-store"}
    });
  }
  if(endpoint.startsWith("api/v1/agent/")) return agentApi(sql,request,endpoint);
  if(request.method==="POST" && parts.length===5 && parts.slice(0,3).join("/")==="api/v1/alerts" && parts[4]==="status"){
    const alertId=parts[3];
    if(!/^[0-9a-f-]{36}$/i.test(alertId))
      return Response.json({error:{code:"invalid_id",message:"Invalid alert UUID"}},{status:422});
    let body:Record<string,unknown>;
    try{const value=await request.json();body=value&&typeof value==="object"&&!Array.isArray(value)?value:{};}
    catch{return Response.json({error:{code:"invalid_json",message:"Invalid JSON body"}},{status:400});}
    const status=body.status;
    if(!["new","in_review","closed","suppressed"].includes(String(status)))
      return Response.json({error:{code:"invalid_status",message:"Unsupported alert status"}},{status:422});
    const changed=await sql.query(
      "UPDATE soc_live_alerts SET status=$3,payload=jsonb_set(payload,'{status}',to_jsonb($3::text),true) WHERE tenant_id=$1 AND id=$2 RETURNING payload",
      [LIVE_TENANT,alertId,status]
    );
    const row=resultRows(changed)[0];
    if(!row)return Response.json({error:{code:"not_found",message:"Alert not found"}},{status:404});
    await sql.query("INSERT INTO soc_live_audit (tenant_id,alert_id,action,actor) VALUES ($1,$2,$3,$4)",
      [LIVE_TENANT,alertId,"set_status:"+status,actor]);
    return Response.json(row.payload);
  }
  if(request.method==="GET" && endpoint==="api/v1/search/alerts"){
    const q=new URL(request.url).searchParams;
    const start=q.get("from"),end=q.get("to");
    const from=start&&Number.isFinite(Date.parse(start))?new Date(start).toISOString():null;
    const to=end&&Number.isFinite(Date.parse(end))?new Date(end).toISOString():null;
    if((start&&!from)||(end&&!to)||(from&&to&&from>=to))
      return Response.json({error:{code:"invalid_time_range",message:"Invalid ISO timestamp range"}},{status:422});
    const limit=Math.min(100,Math.max(1,Number(q.get("limit"))||25));
    const offset=Math.min(100000,Math.max(0,Number(q.get("cursor"))||0));
    const source=q.get("source")||null,severity=q.get("severity")||null,status=q.get("status")||null;
    const host=q.get("host")?.slice(0,128)||null,rule=q.get("rule_id")?.slice(0,80)||null;
    const level=q.get("rule_level");
    if(level!==null&&(!/^\\d{1,2}$/.test(level)||Number(level)>15))
      return Response.json({error:{code:"invalid_rule_level",message:"Rule level must be between 0 and 15"}},{status:422});
    const technique=q.get("technique_id")?.slice(0,40)||null;
    const term=q.get("q")?.trim().slice(0,120)||null;
    const sort=q.get("sort")==="severity"?"severity":q.get("sort")==="created_time"?"created":"detected";
    const result=await sql.query(
      `SELECT payload FROM soc_live_alerts WHERE tenant_id=$1
       AND ($2::timestamptz IS NULL OR detected_at >= $2::timestamptz)
       AND ($3::timestamptz IS NULL OR detected_at < $3::timestamptz)
       AND ($4::text IS NULL OR source=$4)
       AND ($5::text IS NULL OR severity=$5)
       AND ($6::text IS NULL OR status=$6)
       AND ($7::text IS NULL OR payload->>'hostname'=$7)
       AND ($8::text IS NULL OR payload->>'rule_id'=$8)
       AND ($9::int IS NULL OR (CASE WHEN payload->>'rule_level' ~ '^[0-9]+$' THEN (payload->>'rule_level')::int ELSE NULL END)=$9)
       AND ($10::text IS NULL OR payload->'technique_ids' ? $10)
       AND ($11::text IS NULL OR (payload->>'title' ILIKE '%%'||$11||'%%' OR payload->>'description' ILIKE '%%'||$11||'%%'))
       ORDER BY
         CASE WHEN $12='severity' THEN CASE severity WHEN 'critical' THEN 5 WHEN 'high' THEN 4 WHEN 'medium' THEN 3 WHEN 'low' THEN 2 ELSE 1 END END DESC NULLS LAST,
         CASE WHEN $12='created' THEN payload->>'created_at' END DESC NULLS LAST,
         detected_at DESC LIMIT $13 OFFSET $14`,
       [LIVE_TENANT,from,to,source,severity,status,host,rule,level===null?null:Number(level),technique,term,sort,limit+1,offset]
    );
    const items=resultRows(result).map(r=>r.payload as Row);
    return Response.json({data:items.slice(0,limit),
      page:{limit,has_more:items.length>limit,next_cursor:items.length>limit?String(offset+limit):null}});
  }
  if(request.method!=="GET")
    return Response.json({error:{code:"method_not_allowed",message:"Unsupported private SOC operation"}},{status:405});
  const result=await sql.query(
    "SELECT payload FROM soc_live_alerts WHERE tenant_id=$1 ORDER BY detected_at DESC LIMIT 5000",[LIVE_TENANT]
  );
  const alerts=resultRows(result).map(r=>r.payload as Row);
  if(endpoint==="api/v1/security/posture")return Response.json(deriveSecurityPosture(alerts),{headers:{"cache-control":"private, no-store"}});
  const {cases,investigations,entities}=deriveLiveViews(alerts);
  const url=new URL(request.url), q=url.searchParams;
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
    document:{source:a.source,rule_id:a.rule_id,rule_level:a.rule_level,srcip:a.srcip,wazuh_context:a.wazuh_context||null}
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
  if(endpoint==="api/v1/cases")return Response.json(page(cases.filter(item=>!q.get("case_status")||item.status===q.get("case_status")),q));
  if(endpoint==="api/v1/investigations")return Response.json(page(investigations.filter(item=>!q.get("investigation_status")||item.status===q.get("investigation_status")),q));
  if(endpoint==="api/v1/search/entities"){
    const filteredEntities=entities.filter(item=>
      (!q.get("type")||item.entity_type===q.get("type"))&&
      (!q.get("q")||JSON.stringify(item).toLowerCase().includes((q.get("q")||"").toLowerCase()))
    );
    return Response.json(page(filteredEntities,q));
  }

  const detailType=endpoint.startsWith("api/v1/cases/")?"cases":
    endpoint.startsWith("api/v1/investigations/")?"investigations":
    endpoint.startsWith("api/v1/search/entities/")?"entities":null;
  if(detailType){
    const collection=detailType==="cases"?cases:detailType==="investigations"?investigations:entities;
    const item=collection.find(row=>row.id===endpoint.split("/").at(-1));
    return item?Response.json(item):Response.json({error:{code:"not_found",message:"Record not found"}},{status:404});
  }
  const alertMatch=endpoint.match(/^api\/v1\/alerts\/([a-f0-9-]{36})$/i);
  if(alertMatch){const a=alerts.find(r=>r.id===alertMatch[1]);return a?Response.json(a):Response.json({error:{code:"not_found",message:"Alert not found"}},{status:404});}
  const eventMatch=endpoint.match(/^api\/v1\/events\/([a-f0-9-]{36})$/i);
  if(eventMatch){const e=events.find(r=>r.id===eventMatch[1]);return e?Response.json(e):Response.json({error:{code:"not_found",message:"Event not found"}},{status:404});}
  return Response.json({error:{code:"not_implemented",message:"This feature requires the full SOC Python backend."}},{status:501});
}
