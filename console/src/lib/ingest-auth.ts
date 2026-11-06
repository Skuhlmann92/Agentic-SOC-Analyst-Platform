import {createHash,timingSafeEqual} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {LEGACY_LIVE_TENANT} from "@/lib/tenant-policy";

type Credential={tenantId:string;connectorId:string|null;kind:"legacy"|"connector";sourceType:"wazuh"|"edr"|null;allowedAgentIds:readonly string[]};
/** Server-derived identity only. Never use tenant/source claims provided in an alert. */
export async function authenticateIngest(authorization:string|null):Promise<Credential|null>{
 if(!authorization?.startsWith("Bearer "))return null;
 const presented=authorization.slice(7);
 if(presented.length<32||presented.length>256)return null;
 const legacy=process.env.SOC_INGEST_TOKEN;
 if(legacy){
  const left=Buffer.from(presented),right=Buffer.from(legacy);
  if(left.length===right.length&&timingSafeEqual(left,right)){
   return {tenantId:LEGACY_LIVE_TENANT,connectorId:null,kind:"legacy",sourceType:null,allowedAgentIds:[]};
  }
 }
 // Disabled until all write paths and DB credential isolation have been verified.
 if(process.env.SOC_MULTI_TENANT_INGEST_ENABLED!=="true")return null;
 const db=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;
 if(!db)return null;
 try{
  const sql=neon(db),hash=createHash("sha256").update(presented).digest("hex");
  const records=await sql.query(
   `SELECT c.org_id::text AS org_id,c.connector_id::text AS connector_id,k.connector_type
      FROM public.soc_ingest_credentials c
      JOIN public.soc_organizations o ON o.id=c.org_id
      JOIN public.soc_org_connectors k ON k.id=c.connector_id AND k.org_id=c.org_id
     WHERE c.token_sha256=$1 AND c.status='active'
       AND (c.expires_at IS NULL OR c.expires_at>now())
       AND o.status='active' AND k.status='active'
     LIMIT 1`,[hash]);
  if(!records.length)return null;
  const record=records[0];
  const agents=await sql.query(
   "SELECT external_agent_id FROM public.soc_org_agents WHERE org_id=$1 AND connector_id=$2",
   [record.org_id,record.connector_id]);
  if(!agents.length)return null;
  return {tenantId:String(record.org_id),connectorId:String(record.connector_id),
   kind:"connector",sourceType:record.connector_type==="wazuh"?"wazuh":"edr",allowedAgentIds:agents.map(x=>String(x.external_agent_id))};
 }catch(error){
  console.error("Ingest authentication unavailable",error instanceof Error?error.name:"unknown");
  return null;
 }
}
export function validateIngestEvents(events:unknown[],credential:Credential):boolean{
 if(credential.kind==="legacy")return true; // Legacy token still bound to only the old live workspace.
 return events.every(item=>{
  if(!item||typeof item!=="object"||Array.isArray(item))return false;
  const raw=item as Record<string,unknown>;
  const agent=raw.agent&&typeof raw.agent==="object"&&!Array.isArray(raw.agent)
   ?raw.agent as Record<string,unknown>:{};
  return typeof agent.id==="string"&&credential.allowedAgentIds.includes(agent.id);
 });
}
