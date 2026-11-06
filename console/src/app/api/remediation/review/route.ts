import {randomUUID} from "node:crypto";
import {cookies} from "next/headers";
import {neon} from "@neondatabase/serverless";
import {openSession,SESSION_COOKIE} from "@/lib/session-token";
import {LIVE_TENANT} from "@/lib/live-api";
export const runtime="nodejs";
type Row=Record<string,unknown>;
const rows=(v:unknown):Row[]=>Array.isArray(v)?v as Row[]:[];
const s=(v:unknown)=>typeof v==="string"?v:"";
export async function POST(request:Request){
 const session=await openSession((await cookies()).get(SESSION_COOKIE)?.value);
 if(session?.role!=="admin"||session.tenantId!==LIVE_TENANT||session.sub!==(process.env.SOC_ADMIN_USERNAME||"socadmin"))
  return Response.json({error:{message:"Administrator session required"}},{status:401});
 const origin=request.headers.get("origin");
 if(origin&&origin!==new URL(request.url).origin)return Response.json({error:{message:"Cross-origin review blocked"}},{status:403});
 let body:Row;try{body=await request.json() as Row;}catch{return Response.json({error:{message:"Invalid request"}},{status:400});}
 const id=s(body.id),action=s(body.action),note=s(body.note).slice(0,800);
 if(!/^[a-f0-9-]{36}$/i.test(id)||!["reviewed","rejected"].includes(action))
  return Response.json({error:{message:"Valid draft ID and action required"}},{status:422});
 if(action==="reviewed"&&body.acknowledged!==true)
  return Response.json({error:{message:"Explicit review acknowledgement required"}},{status:422});
 const database=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;
 if(!database)return Response.json({error:{message:"Database unavailable"}},{status:503});
 try{
  const sql=neon(database);
  const current=rows(await sql.query("SELECT payload FROM soc_ai_remediations WHERE tenant_id=$1 AND id=$2",[LIVE_TENANT,id]));
  if(!current.length)return Response.json({error:{message:"Draft not found"}},{status:404});
  const draft=current[0].payload as Row;
  if(draft.executed===true||draft.execution_enabled===true)
   return Response.json({error:{message:"Execution state mismatch; manual intervention needed"}},{status:409});
  if(!["awaiting_review","requires_security_review"].includes(s(draft.status)))
   return Response.json({error:{message:"Draft already reviewed"}},{status:409});
  const review={...draft,status:action==="reviewed"?"review_documented":"rejected",approved:false,executed:false,
   execution_enabled:false,ast_verified:false,reviewed_at:new Date().toISOString(),
   review_note:note,reviewer:session.sub,needs_ast_validation:true};
  const changed=rows(await sql.query(
    "UPDATE soc_ai_remediations SET payload=$3::jsonb WHERE tenant_id=$1 AND id=$2 AND payload->>'status' IN ('awaiting_review','requires_security_review') RETURNING id",
    [LIVE_TENANT,id,JSON.stringify(review)]));
  if(!changed.length)return Response.json({error:{message:"Concurrent review modification"}},{status:409});
  await sql.query("INSERT INTO soc_remediation_audit(id,tenant_id,remediation_id,action,reviewer,note) VALUES ($1,$2,$3,$4,$5,$6)",
   [randomUUID(),LIVE_TENANT,id,action,session.sub,note]);
  return Response.json({ok:true,record:review,execution_enabled:false});
 }catch{return Response.json({error:{message:"Review could not be saved"}},{status:503});}
}
