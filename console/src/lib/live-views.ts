import { createHash } from "node:crypto";

type Row = Record<string, unknown>;
function string(value: unknown): string { return typeof value === "string" ? value : ""; }
function idFromKey(key: string): string {
  const h=createHash("sha256").update(key).digest("hex");
  return h.slice(0,8)+"-"+h.slice(8,12)+"-4"+h.slice(13,16)+"-8"+h.slice(17,20)+"-"+h.slice(20,32);
}
function worst(items:Row[]):string {
  const order=["critical","high","medium","low","informational","unknown"];
  return order.find(sev=>items.some(item=>item.severity===sev)) || "unknown";
}
function newest(rows:Row[]):string {
  return rows.map(x=>string(x.detected_at)).filter(Boolean).sort().at(-1)||new Date().toISOString();
}
function oldest(rows:Row[]):string {
  return rows.map(x=>string(x.detected_at)).filter(Boolean).sort()[0]||new Date().toISOString();
}

export function deriveLiveViews(alerts:Row[]){
  const cases:Row[]=[];
  const investigations:Row[]=[];
  const entities:Row[]=[];
  const hostMap=new Map<string,Row[]>();
  const userMap=new Map<string,Row[]>();
  for(const item of alerts){
    const hostname=string(item.hostname);
    if(hostname){const items=hostMap.get(hostname)||[];items.push(item);hostMap.set(hostname,items);}
    const username=string(item.username);
    if(username){const items=userMap.get(username)||[];items.push(item);userMap.set(username,items);}
  }
  for(const [hostName,hostAlerts] of hostMap){
    const severity=worst(hostAlerts);
    const first=oldest(hostAlerts),last=newest(hostAlerts);
    entities.push({id:idFromKey("host:"+hostName),entity_type:"host",value:hostName,
      display_value:hostName,severity,first_seen:first,last_seen:last,
      event_count:hostAlerts.length,headline:hostAlerts[0]?.title||null});
    const significant=hostAlerts.filter(a=>["high","critical"].includes(string(a.severity)));
    if(significant.length===0)continue;
    const caseId=idFromKey("case:"+hostName),investigationId=idFromKey("investigation:"+hostName);
    cases.push({id:caseId,title:"Investigate "+hostName,
      description:"Automatically grouped high/critical alerts observed on this endpoint.",
      severity:worst(significant),status:"open",assignee:"SOC Analyst",external_ref:"AUTO-"+hostName,
      opened_at:oldest(significant),closed_at:null,investigation_ids:[investigationId],finding_ids:[]});
    investigations.push({id:investigationId,case_id:caseId,title:"Correlate detections on "+hostName,
      status:"open",priority:worst(significant),hypothesis:
      "Multiple security detections on the same endpoint may share a root cause.",
      summary:"Automatically derived triage group. Review sources before making a determination.",
      assignee:"SOC Analyst",opened_at:oldest(significant),closed_at:null,
      alert_ids:significant.map(a=>a.id)});
  }
  for(const [name,userAlerts] of userMap){
    entities.push({id:idFromKey("user:"+name),entity_type:"user",value:name,
      display_value:name,severity:worst(userAlerts),first_seen:oldest(userAlerts),
      last_seen:newest(userAlerts),event_count:userAlerts.length,
      headline:userAlerts[0]?.title||null});
  }
  return {cases,investigations,entities};
}
