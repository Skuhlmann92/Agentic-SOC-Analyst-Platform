import { createHash, randomUUID } from "node:crypto";
import type { neon } from "@neondatabase/serverless";

type SQL = ReturnType<typeof neon>;
type Row = Record<string, unknown>;
const TENANT="22222222-2222-4222-8222-222222222222";
const items=(v:unknown):Row[]=>Array.isArray(v)?v as Row[]:[];
const s=(v:unknown)=>typeof v==="string"?v:"";
const severityWeight=(s:string)=>({critical:4,high:3,medium:2,low:1,informational:0}[s]??0);
const guid=(input:string)=>{const h=createHash("sha256").update(input).digest("hex");return h.slice(0,8)+"-"+h.slice(8,12)+"-4"+h.slice(13,16)+"-8"+h.slice(17,20)+"-"+h.slice(20,32);};

export async function initAgent(sql:SQL){
 await sql.query(`CREATE TABLE IF NOT EXISTS soc_agent_runs (
 tenant_id text NOT NULL, id uuid NOT NULL, alert_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(), payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id), UNIQUE(tenant_id,alert_id))`);
 await sql.query("CREATE INDEX IF NOT EXISTS soc_agent_runs_created ON soc_agent_runs (tenant_id,created_at DESC)");
}
async function buildRun(sql:SQL,alert:Row):Promise<Row>{
 const alertId=s(alert.id);
 const existing=items(await sql.query("SELECT payload FROM soc_agent_runs WHERE tenant_id=$1 AND alert_id=$2",[TENANT,alertId]));
 if(existing.length) return existing[0].payload as Row;
 const hostname=s(alert.hostname)||"unknown host";
 const detected=s(alert.detected_at);
 const related=items(await sql.query(
 "SELECT payload FROM soc_live_alerts WHERE tenant_id=$1 AND payload->>'hostname'=$2 ORDER BY detected_at DESC LIMIT 100",
 [TENANT,hostname]
 )).map(x=>x.payload as Row);
 const timeMs=Date.parse(detected);
 const timeWindow=related.filter(r=>Math.abs(Date.parse(s(r.detected_at))-timeMs)<=24*3600*1000);
 const criticalCount=timeWindow.filter(x=>x.severity==="critical").length;
 const distinctRules=[...new Set(timeWindow.map(x=>s(x.rule_id)).filter(Boolean))];
 const score=Math.min(100,15+severityWeight(s(alert.severity))*14+Math.min(timeWindow.length,8)*3+Math.min(distinctRules.length,5)*3);
 const rule=s(alert.rule_id);
 const primaryTitle=s(alert.title)||"Security alert";
 const techniques=Array.isArray(alert.technique_ids)?alert.technique_ids.filter(x=>typeof x==="string") as string[]:[];
 const highCount=timeWindow.filter(x=>severityWeight(s(x.severity))>=3).length;
 const hypothesis=score>=75?"Priority triage: inspect authentication and process context on this endpoint.":score>=45?
 "Correlated activity merits analyst review.":"Low confidence signal: validate the rule and endpoint context.";
 const findings=[
   {position:1,template:"observed_alert",statement:`Wazuh/EDR reported "${primaryTitle}" on ${hostname} at ${detected}.`,
     arguments:{hostname,detected_at:detected,severity:alert.severity,rule_id:rule},
     citations:[{kind:"alert",record_id:alertId}]},
   {position:2,template:"host_correlation",statement:`The endpoint has ${timeWindow.length} alerts within ±24 hours, including ${highCount} high/critical alerts and ${distinctRules.length} distinct rule IDs.`,
     arguments:{related_alerts:timeWindow.length,high_or_critical:highCount,critical:criticalCount,distinct_rules:distinctRules.length},
     citations:timeWindow.slice(0,8).map(x=>({kind:"alert",record_id:s(x.id)}))},
 ];
 if(techniques.length) findings.push({position:3,template:"mitre_context",
   statement:"The original detection references ATT&CK technique(s): "+techniques.join(", ")+". This is a rule mapping, not proof of technique execution.",
   arguments:{techniques},citations:[{kind:"alert",record_id:alertId}]});
 const now=new Date().toISOString(),id=randomUUID(),draftId=randomUUID();
 const draft={id:draftId,run_id:id,status:"pending_approval",title:"Automated triage: "+primaryTitle,
   summary:`Rule-based triage score ${score}/100. ${hypothesis} Analyst verification required; no action taken.`,
   severity:alert.severity,source_of_truth:false,notice:"Deterministic script analysis of stored security alerts; NOT a generative AI judgment or confirmed incident.",
   claims:findings,approval:null,created_at:now,updated_at:now};
 const run:Row={id,alert_id:alertId,question:null,status:"completed",error_code:null,error_message:null,
   requested_by:"automatic-triage",draft,memory:[
     {sequence:1,agent:"retrieval",kind:"evidence",payload:{alert_id:alertId}},
     {sequence:2,agent:"correlation",kind:"summary",payload:{host:hostname,window_hours:24,related:timeWindow.length}},
     {sequence:3,agent:"rule_engine",kind:"assessment",payload:{score,techniques,rule_id:rule}},
     {sequence:4,agent:"reporting",kind:"draft",payload:{approval_required:true}}
   ],created_at:now,finished_at:now};
 await sql.query("INSERT INTO soc_agent_runs(tenant_id,id,alert_id,payload) VALUES($1,$2,$3,$4::jsonb) ON CONFLICT(tenant_id,alert_id) DO NOTHING",
 [TENANT,id,alertId,JSON.stringify(run)]);
 const saved=items(await sql.query("SELECT payload FROM soc_agent_runs WHERE tenant_id=$1 AND alert_id=$2",[TENANT,alertId]));
 return saved[0]?.payload as Row ||run;
}
export async function analyzeNewAlert(sql:SQL,alert:Row){
 await initAgent(sql);return buildRun(sql,alert);
}
export async function agentApi(sql:SQL,request:Request,endpoint:string):Promise<Response>{
 await initAgent(sql);
 const q=new URL(request.url).searchParams;
 if(endpoint==="api/v1/agent/runs"&&request.method==="POST"){
   let body:Row;
   try{const parsed=await request.json();body=parsed&&typeof parsed==="object"&&!Array.isArray(parsed)?parsed:{};}
   catch{return Response.json({error:{code:"validation_error",message:"Expected JSON"}},{status:422});}
   const alertId=s(body.alert_id);
   if(!/^[0-9a-f-]{36}$/i.test(alertId))return Response.json({error:{code:"validation_error",message:"Select a valid alert ID for a rule-based analysis"}},{status:422});
   const hits=items(await sql.query("SELECT payload FROM soc_live_alerts WHERE tenant_id=$1 AND id=$2",[TENANT,alertId]));
   if(!hits.length)return Response.json({error:{code:"not_found",message:"Alert not found"}},{status:404});
   const run=await buildRun(sql,hits[0].payload as Row);
   return Response.json(run,{status:200});
 }
 if(request.method==="POST"&&endpoint.startsWith("api/v1/agent/drafts/")&&endpoint.endsWith("/decisions")){
   const id=endpoint.split("/")[4];
   let body:Row;try{body=await request.json();}catch{return Response.json({error:{code:"invalid_json",message:"Expected JSON"}},{status:400});}
   const decision=s(body.decision);if(!["approved","rejected"].includes(decision))return Response.json({error:{code:"validation_error",message:"Invalid decision"}},{status:422});
   const found=items(await sql.query("SELECT id,payload FROM soc_agent_runs WHERE tenant_id=$1 AND payload->'draft'->>'id'=$2",[TENANT,id]));
   if(!found.length)return Response.json({error:{code:"not_found",message:"Draft not found"}},{status:404});
   const run=found[0].payload as Row,draft=run.draft as Row;
   if(draft.status!=="pending_approval")return Response.json({error:{code:"conflict",message:"Draft already decided"}},{status:409});
   const updated={...draft,status:decision,updated_at:new Date().toISOString(),
     approval:{decision,actor:"SOC Administrator",note:s(body.note)||null,created_at:new Date().toISOString()}};
   await sql.query("UPDATE soc_agent_runs SET payload=jsonb_set(payload,'{draft}',$3::jsonb) WHERE tenant_id=$1 AND id=$2",
     [TENANT,found[0].id,JSON.stringify(updated)]);
   return Response.json(updated);
 }
 if(request.method!=="GET")return Response.json({error:{code:"method_not_allowed",message:"Unsupported agent action"}},{status:405});
 const limit=Math.max(1,Math.min(100,Number(q.get("limit"))||20));
 const rows=items(await sql.query("SELECT payload FROM soc_agent_runs WHERE tenant_id=$1 ORDER BY created_at DESC LIMIT 1000",[TENANT])).map(x=>x.payload as Row);
 if(endpoint==="api/v1/agent/runs")return Response.json({data:rows.slice(0,limit).map(run=>({
   id:run.id,alert_id:run.alert_id,question:run.question,status:run.status,error_code:run.error_code,error_message:run.error_message,
   requested_by:run.requested_by,draft_id:(run.draft as Row)?.id,draft_status:(run.draft as Row)?.status,
   draft_title:(run.draft as Row)?.title,draft_severity:(run.draft as Row)?.severity,created_at:run.created_at,finished_at:run.finished_at
 })),page:{limit,has_more:rows.length>limit,next_cursor:null}});
 if(endpoint==="api/v1/agent/drafts"){
   const drafts=rows.map(x=>x.draft as Row).filter(x=>!q.get("status")||x.status===q.get("status"));
   return Response.json({data:drafts.slice(0,limit),page:{limit,has_more:drafts.length>limit,next_cursor:null}});
 }
 if(endpoint.startsWith("api/v1/agent/runs/")){
   const run=rows.find(x=>x.id===endpoint.split("/").at(-1));
   return run?Response.json(run):Response.json({error:{code:"not_found",message:"Run not found"}},{status:404});
 }
 if(endpoint.startsWith("api/v1/agent/drafts/")){
   const draft=rows.map(x=>x.draft as Row).find(x=>x.id===endpoint.split("/").at(-1));
   return draft?Response.json(draft):Response.json({error:{code:"not_found",message:"Draft not found"}},{status:404});
 }
 return Response.json({error:{code:"not_found",message:"Unknown agent endpoint"}},{status:404});
}
