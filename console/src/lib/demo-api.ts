import { neon } from "@neondatabase/serverless";

const TENANT = "11111111-1111-4111-8111-111111111111";
const uuid = (group: number, index: number) =>
  String(group).padStart(8,"0") + "-1111-4111-8111-" + String(index).padStart(12,"0");
type RecordRow = Record<string, unknown>;
type Sql = ReturnType<typeof neon>;

function connection(): Sql {
  const uri = process.env.POSTGRES_DATABASE_URL || process.env.POSTGRES_URL;
  if (!uri) throw new Error("POSTGRES_DATABASE_URL is missing");
  return neon(uri);
}

function time(index: number) {
  return new Date(Date.now() - index * 3600_000 * 3).toISOString();
}

const samples = [
  ["Suspicious encoded PowerShell","critical","sigma_alert","WIN-DC01","administrator","T1059.001","Process Activity"],
  ["Repeated failed logons","high","windows_event","WIN-DC01","svc-backup","T1110","Authentication"],
  ["Office spawning PowerShell","high","mock_edr_alert","HR-LAPTOP-03","j.doe","T1204","Process Activity"],
  ["Unusual DNS request burst","medium","sigma_alert","DNS-SRV-01","system","T1071.004","Network Activity"],
  ["Unsigned startup executable","high","mock_edr_alert","FIN-PC-07","a.miller","T1547.001","File Activity"],
  ["Privileged group modification","critical","windows_event","WIN-DC01","administrator","T1098","Account Change"],
  ["Suspicious remote service creation","medium","windows_event","FILE-SRV-02","svc-deploy","T1543.003","Service Activity"],
  ["Potential credential dumping","critical","mock_edr_alert","HR-LAPTOP-03","j.doe","T1003","Process Activity"],
  ["Unusual RDP connections","medium","sigma_alert","WIN-DC01","guest","T1021.001","Authentication"],
  ["Large outbound transfer","high","mock_edr_alert","FIN-PC-07","a.miller","T1041","Network Activity"],
  ["Unexpected scheduled task","low","windows_event","APP-SRV-04","svc-deploy","T1053.005","Process Activity"],
  ["Possible DNS tunneling","high","sigma_alert","DNS-SRV-01","system","T1071.004","Network Activity"],
  ["Possible lateral movement","critical","mock_edr_alert","FILE-SRV-02","administrator","T1021","Network Activity"],
  ["Endpoint policy change","low","windows_event","HR-LAPTOP-03","j.doe","T1562.001","Configuration Change"],
  ["Firewall rule modifications","medium","sigma_alert","FW-EDGE-01","operator","T1562.004","Configuration Change"],
] as const;

async function save(sql: Sql, kind: string, row: RecordRow) {
  await sql.query(
    "INSERT INTO soc_demo_records (tenant_id,kind,id,payload) VALUES ($1,$2,$3,$4::jsonb) ON CONFLICT DO NOTHING",
    [TENANT,kind,row.id,JSON.stringify(row)]
  );
}

async function prepare(sql: Sql) {
  await sql.query("CREATE TABLE IF NOT EXISTS soc_demo_records (tenant_id text NOT NULL, kind text NOT NULL, id uuid NOT NULL, payload jsonb NOT NULL, PRIMARY KEY(tenant_id,kind,id))");
  const exists = await sql.query("SELECT id FROM soc_demo_records WHERE tenant_id=$1 AND kind='marker' LIMIT 1",[TENANT]);
  if (exists.length) return;
  for (let i=0;i<samples.length;i++) {
    const [title,severity,source,hostname,username,technique,eventType] = samples[i];
    const at=time(i+1), eventId=uuid(200,i+1);
    const status = i%7===0 ? "in_review" : (i%9===0 ? "closed" : "new");
    await save(sql,"event",{id:eventId,source,event_time:at,class_name:eventType,
      activity_name:title,severity,outcome:"unknown",hostname,username,
      message:"Fictional detection: "+title+" on "+hostname,technique_ids:[technique],
      document:{demo:true,hostname,username,technique}});
    await save(sql,"alert",{id:uuid(100,i+1),tenant_id:TENANT,canonical_event_id:eventId,
      source,external_id:"DEMO-"+(i+1),title,
      description:"Fictional security alert for the public SOC demonstration.",
      severity,status,rule_id:"demo-rule-"+(i+1),rule_name:title,vendor:"Demo Sensor",
      product:"Sample Telemetry",technique_ids:[technique],tactics:[],
      detected_at:at,created_at:at,updated_at:at,event_type:eventType,
      hostname,username,headline:title+" on "+hostname});
  }
  const caseItems=[
    ["Suspicious domain-controller activity","critical","investigating",[1,2,6]],
    ["Potential credential compromise","high","open",[3,8]],
    ["Unusual outbound traffic","high","investigating",[4,10,12]],
    ["Possible lateral movement","critical","open",[7,9,13]],
  ] as const;
  for(let i=0;i<caseItems.length;i++){
    const [title,severity,status,linked]=caseItems[i];
    const caseId=uuid(300,i+1), invId=uuid(400,i+1), opened=time(i+2);
    await save(sql,"case",{id:caseId,title,severity,status,
      description:"Fictional case for interactive demonstration.",
      assignee:"Demo Analyst",external_ref:"DEMO-CASE-"+(i+1),
      opened_at:opened,closed_at:null,investigation_ids:[invId],finding_ids:[]});
    await save(sql,"investigation",{id:invId,case_id:caseId,title,
      status:i%2===0?"active":"open",priority:severity,
      hypothesis:"Review related fictional alerts and assess possible suspicious activity.",
      summary:null,assignee:"Demo Analyst",opened_at:opened,closed_at:null,
      alert_ids:linked.map(n=>uuid(100,n))});
  }
  const events = samples.map((s,i)=>({host:s[3],source:s[2],severity:s[1],event_time:time(i+1)}));
  const hosts=[...new Set(events.map(e=>e.host))];
  for(let i=0;i<hosts.length;i++){
    const host=hosts[i];
    await save(sql,"entity",{id:uuid(700,i+1),entity_type:"host",
      value:host,display_value:host,severity:"medium",first_seen:time(15),
      last_seen:time(1),event_count:events.filter(e=>e.host===host).length,
      headline:"Fictional demonstration endpoint"});
  }
  await save(sql,"marker",{id:uuid(900,1),created_at:new Date().toISOString()});
}

async function rows(sql: Sql, kind: string):Promise<RecordRow[]> {
  const result=await sql.query("SELECT payload FROM soc_demo_records WHERE tenant_id=$1 AND kind=$2",[TENANT,kind]);
  return result.map(r=>r.payload as RecordRow);
}

function page(items:RecordRow[], params:URLSearchParams){
  const limit=Math.max(1,Math.min(100,Number(params.get("limit"))||50));
  const offset=Math.max(0,Number(params.get("cursor"))||0);
  return {data:items.slice(offset,offset+limit),page:{
    limit,has_more:offset+limit<items.length,
    next_cursor:offset+limit<items.length?String(offset+limit):null}};
}

function filter(items:RecordRow[],params:URLSearchParams){
  const q=(params.get("q")||"").toLowerCase();
  const result=items.filter(row=>{
    if(q&&!JSON.stringify(row).toLowerCase().includes(q))return false;
    for(const key of ["severity","source","status","event_type","entity_type"]){
      const v=params.get(key)|| (key==="status"?(params.get("case_status")||params.get("investigation_status")):null);
      if(v&&row[key]!==v)return false;
    }
    if(params.get("type")&&row.entity_type!==params.get("type"))return false;
    if(params.get("alert_id")&&row.alert_id!==params.get("alert_id"))return false;
    return true;
  });
  if(params.get("sort")==="severity"){
    const rank=["critical","high","medium","low","informational","unknown"];
    result.sort((a,b)=>rank.indexOf(String(a.severity))-rank.indexOf(String(b.severity)));
  }else result.sort((a,b)=>String(b.detected_at||b.created_at||b.opened_at||"").localeCompare(String(a.detected_at||a.created_at||a.opened_at||"")));
  return result;
}
function facet(items:RecordRow[], key:string){
  const map=new Map<string,number>();
  for(const r of items){const v=r[key];if(typeof v==="string"&&v)map.set(v,(map.get(v)||0)+1);}
  return [...map].map(([value,count])=>({value,count}));
}

export async function publicDemoApi(request:Request,path:string[]){
  if(request.method!=="GET"){
    return Response.json({error:{code:"demo_read_only",message:"Public demo is read-only."}},{status:403});
  }
  const sql=connection();
  await prepare(sql);
  const endpoint=path.join("/");
  const params=new URL(request.url).searchParams;
  if(endpoint==="api/v1/search/facets"){
    const alerts=await rows(sql,"alert");
    return Response.json({event_type:facet(alerts,"event_type"),severity:facet(alerts,"severity"),
      source:facet(alerts,"source"),host:facet(alerts,"hostname"),user:facet(alerts,"username")});
  }
  if(endpoint==="api/v1/operations/connectors"){
    const alerts=await rows(sql,"alert");
    return Response.json({data:["sigma_alert","mock_edr_alert","windows_event"].map(source=>({
      source,label:source.replaceAll("_"," "),projected:alerts.filter(a=>a.source===source).length,
      dead_lettered:0,last_received_at:time(1)}))});
  }
  if(endpoint==="api/v1/operations/dead-letters"||endpoint==="api/v1/operations/publications"){
    return Response.json(page([],params));
  }
  const collections:Record<string,string>={
    "api/v1/search/alerts":"alert","api/v1/search/events":"event",
    "api/v1/search/entities":"entity","api/v1/cases":"case",
    "api/v1/investigations":"investigation","api/v1/agent/runs":"run",
    "api/v1/agent/drafts":"draft",
  };
  const kind=collections[endpoint];
  if(kind){
    const items=filter(await rows(sql,kind),params);
    return Response.json(page(items,params));
  }
  const match=endpoint.match(/^api\/v1\/(alerts|events|cases|investigations|agent\/runs|agent\/drafts|search\/entities|findings|evidence)\/([a-f0-9-]{36})$/i);
  if(match){
    const types:Record<string,string>={alerts:"alert",events:"event",cases:"case",
      investigations:"investigation","agent/runs":"run","agent/drafts":"draft",
      "search/entities":"entity",findings:"finding",evidence:"evidence"};
    const item=(await rows(sql,types[match[1]])).find(r=>r.id===match[2]);
    return item?Response.json(item):Response.json({error:{code:"not_found",message:"Record not found"}},{status:404});
  }
  return Response.json({error:{code:"not_implemented",message:"This action is not available in the public read-only demo."}},{status:404});
}
