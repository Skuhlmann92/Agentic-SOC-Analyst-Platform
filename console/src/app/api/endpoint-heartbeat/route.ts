import {sqlFor} from "@/lib/database-access";
import {timingSafeEqual} from "node:crypto";
import {cookies} from "next/headers";
import {openSession,SESSION_COOKIE} from "@/lib/session-token";
import {LIVE_TENANT} from "@/lib/live-api";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Row=Record<string,unknown>;
const rows=(v:unknown):Row[]=>Array.isArray(v)?v as Row[]:[];
const text=(v:unknown)=>typeof v==="string"?v:"";
const DB=(purpose:"read"|"write"="write")=>sqlFor(purpose);
function constantMatch(actual:string,expected:string|undefined){
 if(!expected||!actual)return false;const a=Buffer.from(actual),b=Buffer.from(expected);
 return a.length===b.length&&timingSafeEqual(a,b);
}
export async function POST(request:Request){
 const raw=request.headers.get("authorization")||"";
 if(!raw.startsWith("Bearer "))return Response.json({error:"authentication_required"},{status:401});
 const provided=raw.slice(7);
 const hostname=constantMatch(provided,process.env.SOC_HEARTBEAT_PI_TOKEN)?"Homelab":
 constantMatch(provided,process.env.SOC_HEARTBEAT_WIN_TOKEN)?"DESKTOP-VKES2QF":null;
 if(!hostname)return Response.json({error:"invalid_endpoint_token"},{status:401});
 let data:Row;
 try{const raw=await request.text();if(raw.length>4096)return Response.json({error:"payload_too_large"},{status:413});
  const parsed=JSON.parse(raw);data=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};}
 catch{return Response.json({error:"invalid_json"},{status:400});}
 const service=text(data.agent_service);
 if(!["running","stopped","missing","unknown"].includes(service))
  return Response.json({error:"invalid_agent_service"},{status:422});
 const record={hostname,agent_service:service,os:text(data.os).slice(0,120),os_version:text(data.os_version).slice(0,80),
  wazuh_version:text(data.wazuh_version).slice(0,60),ip:text(data.ip).slice(0,48),
  manager_service:hostname==="Homelab"?text(data.manager_service).slice(0,24):null,
  collector:"signed_endpoint_heartbeat",reported_at:new Date().toISOString()};
 try{
  const sql=DB();
  await sql.query(`INSERT INTO soc_endpoint_heartbeats(tenant_id,hostname,received_at,payload)
   VALUES($1,$2,now(),$3::jsonb)
   ON CONFLICT(tenant_id,hostname) DO UPDATE SET received_at=now(),payload=excluded.payload`,[LIVE_TENANT,hostname,JSON.stringify(record)]);
  return Response.json({ok:true,hostname,received_at:record.reported_at});
 }catch{return Response.json({error:"heartbeat_storage_unavailable"},{status:503});}
}
export async function GET(){
 const session=await openSession((await cookies()).get(SESSION_COOKIE)?.value);
 if(session?.role!=="admin"||session.tenantId!==LIVE_TENANT)
  return Response.json({error:"admin_session_required"},{status:401});
 try{
  const sql=DB("read");
  const [heartbeats,activity]=await Promise.all([
   sql.query("SELECT hostname,received_at,payload FROM soc_endpoint_heartbeats WHERE tenant_id=$1 ORDER BY hostname",[LIVE_TENANT]),
   sql.query(`SELECT payload->>'hostname' AS hostname,COUNT(*)::int AS alerts_total,
   COUNT(*) FILTER(WHERE detected_at>=now()-interval '24 hours')::int AS alerts_24h,
   COUNT(*) FILTER(WHERE severity IN ('high','critical'))::int AS high_priority,
   MAX(detected_at) AS last_alert FROM soc_live_alerts WHERE tenant_id=$1 GROUP BY payload->>'hostname'`,[LIVE_TENANT])
  ]);
  const recent=rows(heartbeats),counts=rows(activity);
  const hosts=[...new Set(["Homelab","DESKTOP-VKES2QF",...counts.map(x=>text(x.hostname))])];
  const now=Date.now();
  return Response.json({generated_at:new Date().toISOString(),hosts:hosts.map(host=>{
   const beat=recent.find(x=>x.hostname===host),activity=counts.find(x=>x.hostname===host);
   const last=beat?new Date(text(beat.received_at)).getTime():NaN;
   const online=Number.isFinite(last)&&now-last<=15*60000;
   const record=beat?.payload as Row|undefined;
   return {hostname:host,heartbeat_status:!beat?"not_configured":online?"recent":"stale",
    observed_at:beat?.received_at||null,agent_service:online?record?.agent_service||"unknown":"unverified",
    wazuh_manager_service:online?record?.manager_service||null:null,
    os:record?.os||null,os_version:record?.os_version||null,
    wazuh_version:record?.wazuh_version||null,ip:record?.ip||null,
    alerts_total:Number(activity?.alerts_total||0),alerts_24h:Number(activity?.alerts_24h||0),
    high_priority:Number(activity?.high_priority||0),last_alert:activity?.last_alert||null,
    note:"Status is locally self-reported by a signed endpoint heartbeat, not verified by the Wazuh Manager API."};
  })},{headers:{"cache-control":"private, no-store"}});
 }catch{return Response.json({error:"endpoint_data_unavailable"},{status:503});}
}
