type Row=Record<string,unknown>;
const s=(v:unknown)=>typeof v==="string"?v:"";
type Check={id:string;host:string;title:string;result:"failed"|"passed"|"summary";rule_id:string;last_seen:string;occurrences:number;alert_id:string;score:number|null};
type Host={hostname:string;alerts:number;high_priority:number;last_detection:string;failed_checks:number;passed_checks:number;sca_score:number|null;sca_score_source:string|null;status:"alerts_received_not_live_status"};
export type PostureResponse={generated_at:string;source:"wazuh_alerts";time_zone:"Europe/Berlin";hosts:Host[];checks:Check[];coverage:Array<{key:string;status:"partial"|"not_connected";explanation:string}>;limitations:string[]};
const checkKind=(rule:string):Check["result"]|null=>rule==="19007"?"failed":rule==="19008"?"passed":rule==="19004"?"summary":null;
function scoreInTitle(title:string):number|null{
 const found=title.match(/score\s*(?:less\s+than\s+\d+%?\s*)?\(?([0-9]{1,3})\)?\s*%?/i);
 if(!found)return null;
 const score=Number(found[1]);return score>=0&&score<=100?score:null;
}
export function deriveSecurityPosture(alerts:Row[]):PostureResponse{
 const group=new Map<string,{host:Host;checks:Map<string,Check>}>();
 for(const item of alerts){
  if(item.source!=="wazuh")continue;
  const hostname=s(item.hostname);if(!hostname)continue;
  let existing=group.get(hostname);
  if(!existing){
   existing={host:{hostname,alerts:0,high_priority:0,last_detection:"",failed_checks:0,passed_checks:0,sca_score:null,sca_score_source:null,status:"alerts_received_not_live_status"},checks:new Map()};
   group.set(hostname,existing);
  }
  const host=existing.host,at=s(item.detected_at),rule=s(item.rule_id);
  host.alerts++;
  if(item.severity==="critical"||item.severity==="high")host.high_priority++;
  if(at>host.last_detection)host.last_detection=at;
  const kind=checkKind(rule);if(!kind)continue;
  const title=s(item.title).slice(0,380);
  // Wazuh 19007=failed, 19008=passed; summaries carry a snapshot score.
  const key=rule+"|"+title;
  const prior=existing.checks.get(key);
  if(!prior){existing.checks.set(key,{id:hostname+"|"+rule+"|"+title,host:hostname,title,result:kind,rule_id:rule,last_seen:at,occurrences:1,alert_id:s(item.id),score:kind==="summary"?scoreInTitle(title):null});}
  else{prior.occurrences++;if(at>prior.last_seen){prior.last_seen=at;prior.alert_id=s(item.id);}}
 }
 const hosts:Host[]=[],checks:Check[]=[];
 for(const {host,checks:hostChecks} of group.values()){
  const row=[...hostChecks.values()];
  host.failed_checks=row.filter(x=>x.result==="failed").length;
  host.passed_checks=row.filter(x=>x.result==="passed").length;
  const snapshot=row.filter(x=>x.result==="summary"&&x.score!==null).sort((a,b)=>b.last_seen.localeCompare(a.last_seen))[0];
  if(snapshot){host.sca_score=snapshot.score;host.sca_score_source=snapshot.alert_id;}
  hosts.push(host);checks.push(...row);
 }
 hosts.sort((a,b)=>b.high_priority-a.high_priority||a.hostname.localeCompare(b.hostname));
 checks.sort((a,b)=>(a.result==="failed"?0:a.result==="summary"?1:2)-(b.result==="failed"?0:b.result==="summary"?1:2)||b.last_seen.localeCompare(a.last_seen));
 return {generated_at:new Date().toISOString(),source:"wazuh_alerts",time_zone:"Europe/Berlin",hosts,checks:checks.slice(0,500),
  coverage:[
   {key:"sca",status:"partial",explanation:"CIS SCA observations are extracted from Wazuh alert rules 19007/19008/19004; not the full SCA check inventory."},
   {key:"vulnerability",status:"not_connected",explanation:"Wazuh Vulnerability Detection inventory / CVE API is not connected."},
   {key:"fim",status:"not_connected",explanation:"Full file integrity baseline and change history require the Wazuh manager API."},
   {key:"inventory",status:"not_connected",explanation:"Syscollector software, hardware and patch inventories are not connected."},
   {key:"agent_status",status:"not_connected",explanation:"Recent alerts prove reception, not whether an agent is currently connected."}
  ],
  limitations:["Only ingested Wazuh alerts are analyzed, not all events or SCA checks.",
   "A missing passed or failed check is not proof that a system is compliant.",
   "An SCA score is shown only when present in a Wazuh summary alert; never calculated from selected alerts.",
   "Repeated alerts may represent rechecks; findings are deduplicated by host, rule and title."]};
}
