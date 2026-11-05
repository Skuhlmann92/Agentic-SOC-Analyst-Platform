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
    // Correlate within bounded 60-minute UTC windows; a large recurring rule is
    // not a single eternal incident. CIS SCA check titles are separate findings.
    const groups=new Map<string,Row[]>();
    for(const alert of hostAlerts){
      const detected=Date.parse(string(alert.detected_at));
      if(!Number.isFinite(detected))continue;
      const hour=Math.floor(detected/3_600_000);
      const rule=string(alert.rule_id)||string(alert.title)||"unknown";
      const isSca=["19007","19008","19004"].includes(rule);
      const suffix=isSca?":"+string(alert.title).toLowerCase().slice(0,180):"";
      const key=hostName+"|"+rule+suffix+"|"+hour;
      const list=groups.get(key)||[];list.push(alert);groups.set(key,list);
    }
    for(const [key,records] of groups){
      const ordered=records.sort((a,b)=>string(a.detected_at).localeCompare(string(b.detected_at)));
      const severityGroup=worst(records);
      const isSignificant=["critical","high"].includes(severityGroup);
      // Repeated low alerts are triage candidates, never confirmed attacks.
      if(!isSignificant&&records.length<3)continue;
      const caseId=idFromKey("correlated-case:"+key);
      const investigationId=idFromKey("correlated-investigation:"+key);
      const title=string(records[0].title)||"Security alert";
      const rule=string(records[0].rule_id)||"unknown";
      const sca=["19007","19008","19004"].includes(rule);
      const reason=sca?"Related CIS Security Configuration Assessment observations":
        "Repeated detections sharing endpoint, detection rule and one-hour time window";
      const hypothesis=sca?"This configuration check may require security hardening; verify its current state before remediation.":
        "Several detections might reflect a recurring source, legitimate activity or a common security event; analyst validation is required.";
      cases.push({id:caseId,title:sca?"Configuration check: "+title:"Correlated: "+title,
        description:reason+". Not a confirmed incident.",
        severity:severityGroup,status:"open",assignee:"SOC Analyst",external_ref:"CORR-"+caseId.slice(0,8),
        opened_at:oldest(records),closed_at:null,investigation_ids:[investigationId],finding_ids:[],
        correlation:{method:"rule-host-time-window",window_minutes:60,rule_id:rule,
          hostname:hostName,alert_count:records.length,evidence_alert_ids:records.slice(0,75).map(a=>a.id),
          explanation:reason}});
      investigations.push({id:investigationId,case_id:caseId,title:"Review "+title,
        status:"open",priority:severityGroup,hypothesis,
        summary:reason+". Evidence is linked; this is an automated rule-based correlation, not a Claude conclusion.",
        assignee:"SOC Analyst",opened_at:oldest(records),closed_at:null,
        alert_ids:records.slice(0,75).map(a=>a.id),
        correlation:{method:"rule-host-time-window",window_minutes:60,hostname:hostName,rule_id:rule,alert_count:records.length}});
    }
  }
  for(const [name,userAlerts] of userMap){
    entities.push({id:idFromKey("user:"+name),entity_type:"user",value:name,
      display_value:name,severity:worst(userAlerts),first_seen:oldest(userAlerts),
      last_seen:newest(userAlerts),event_count:userAlerts.length,
      headline:userAlerts[0]?.title||null});
  }
  cases.sort((a,b)=>string(b.opened_at).localeCompare(string(a.opened_at)));
  investigations.sort((a,b)=>string(b.opened_at).localeCompare(string(a.opened_at)));
  return {cases,investigations,entities};
}
