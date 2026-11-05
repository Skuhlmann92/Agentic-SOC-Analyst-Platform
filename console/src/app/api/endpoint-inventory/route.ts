import {timingSafeEqual,createHash} from "node:crypto";
import {cookies} from "next/headers";
import {neon} from "@neondatabase/serverless";
import {openSession,SESSION_COOKIE} from "@/lib/session-token";
import {LIVE_TENANT} from "@/lib/live-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const DB=()=>{const url=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;if(!url)throw Error("No database");return neon(url);};
type R=Record<string,unknown>;
const rows=(v:unknown):R[]=>Array.isArray(v)?v as R[]:[];
const s=(v:unknown)=>typeof v==="string"?v:"";
const fail=(status:number,message:string)=>Response.json({error:{message}},{status});
function match(a:string,b:string|undefined){if(!a||!b)return false;const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y);}
async function prepare(sql:ReturnType<typeof DB>){
 await sql.query("CREATE TABLE IF NOT EXISTS soc_endpoint_inventory (tenant_id text NOT NULL,hostname text NOT NULL,received_at timestamptz NOT NULL DEFAULT now(),payload jsonb NOT NULL, PRIMARY KEY(tenant_id,hostname))");
}
export async function POST(req:Request){
 const token=(req.headers.get("authorization")||"").replace(/^Bearer /,"");
 const hostname=match(token,process.env.SOC_HEARTBEAT_PI_TOKEN)?"Homelab":match(token,process.env.SOC_HEARTBEAT_WIN_TOKEN)?"DESKTOP-VKES2QF":null;
 if(!hostname)return fail(401,"Invalid endpoint credential");
 const raw=await req.text();if(raw.length>180000)return fail(413,"Inventory too large");
 let body:R;try{const value=JSON.parse(raw);body=value&&typeof value==="object"&&!Array.isArray(value)?value:{};}catch{return fail(400,"Invalid inventory JSON");}
 const source=s(body.source);
 if(source!=="local_signed_inventory")return fail(422,"Unknown inventory source");
 const incoming=Array.isArray(body.software)?body.software:[];
 if(incoming.length>1200)return fail(422,"Too many software entries");
 const seen=new Set<string>();
 const software:{name:string;version:string;publisher:string}[]=[];
 for(const item of incoming){
  if(!item||typeof item!=="object"||Array.isArray(item))continue;
  const r=item as R,name=s(r.name).trim().slice(0,180),version=s(r.version).trim().slice(0,100),publisher=s(r.publisher).trim().slice(0,120);
  if(!name)continue;
  const key=(name+"|"+version).toLowerCase();if(seen.has(key))continue;seen.add(key);
  software.push({name,version,publisher});
 }
 const os=body.os&&typeof body.os==="object"&&!Array.isArray(body.os)?body.os as R:{};
 const hardware=body.hardware&&typeof body.hardware==="object"&&!Array.isArray(body.hardware)?body.hardware as R:{};
 const value={hostname,source,os:{name:s(os.name).slice(0,150),version:s(os.version).slice(0,100),build:s(os.build).slice(0,80),architecture:s(os.architecture).slice(0,50),kernel:s(os.kernel).slice(0,100)},hardware:{
  cpu:s(hardware.cpu).slice(0,150),memory_bytes:Math.max(0,Math.min(1e15,Number(hardware.memory_bytes)||0)),
  processor_count:Math.max(0,Math.min(1024,Number(hardware.processor_count)||0))},
 software,software_count:software.length,collection_scope:s(body.collection_scope).slice(0,180),
 received_at:new Date().toISOString(),complete:body.complete===true};
 try{
  const sql=DB();await prepare(sql);
  await sql.query("INSERT INTO soc_endpoint_inventory(tenant_id,hostname,payload) VALUES($1,$2,$3::jsonb) ON CONFLICT(tenant_id,hostname) DO UPDATE SET received_at=now(),payload=excluded.payload",
   [LIVE_TENANT,hostname,JSON.stringify(value)]);
  return Response.json({ok:true,hostname,software_count:software.length});
 }catch{return fail(503,"Inventory storage unavailable");}
}
export async function GET(req:Request){
 const session=await openSession((await cookies()).get(SESSION_COOKIE)?.value);
 if(session?.role!=="admin"||session.tenantId!==LIVE_TENANT)return fail(401,"Administrator login required");
 try{
  const sql=DB();await prepare(sql);
  const requested=new URL(req.url).searchParams.get("host")||"";
  const result=rows(await sql.query("SELECT hostname,received_at,payload FROM soc_endpoint_inventory WHERE tenant_id=$1 ORDER BY hostname",[LIVE_TENANT]));
  const items:R[]=result.map(x=>({...((x.payload && typeof x.payload==="object")?x.payload as R:{}),received_at:x.received_at}));
  return Response.json({generated_at:new Date().toISOString(),source:"local_signed_inventory",wazuh_syscollector_connected:false,
   cve_source_connected:false,data:requested?items.filter(x=>x.hostname===requested):items},
   {headers:{"cache-control":"private, no-store"}});
 }catch{return fail(503,"Inventory database unavailable");}
}
