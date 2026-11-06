/**
 * Bounded, privacy-aware Windows/Wazuh event context for investigation.
 * Never infer the actor of SCM event 7040 from its provider process ID.
 * This projection enriches newly ingested alerts; source metadata is untrusted.
 */
type Dict=Record<string,unknown>;
const object=(x:unknown):Dict=>x&&typeof x==="object"&&!Array.isArray(x)?x as Dict:{};
const str=(x:unknown,max=256):string|null=>{
  if(typeof x!=="string"&&typeof x!=="number")return null;
  const s=String(x).trim();return s?s.slice(0,max):null;
};
const pick=(o:Dict,keys:string[],max=256):string|null=>{
  for(const key of keys){const v=str(o[key],max);if(v)return v;}return null;
};
function redact(value:string):string {
  return value
    .replace(/(\b(?:password|passwd|pwd|token|secret|api[_-]?key|authorization)\b\s*[:=]\s*)(?:"[^"]*"|'[^']*'|\S+)/gi,"$1[REDACTED]")
    .replace(/(\b(?:-password|-credential|-token|-apikey|--password|--token|--secret)\s+)(?:"[^"]*"|'[^']*'|\S+)/gi,"$1[REDACTED]")
    .replace(/(https?:\/\/)([^\s/@]+)@/gi,"$1[REDACTED]@")
    .replace(/(https?:\/\/[^\s?#]+)[?#][^\s]*/gi,"$1?[REDACTED]");
}
export type WindowsEventContext={
  event_id:string|null;record_id:string|null;channel:string|null;
  provider:string|null;computer:string|null;event_time:string|null;
  correlation_activity_id:string|null;
  process_id:string|null;thread_id:string|null;
  subject_user:string|null;subject_domain:string|null;subject_sid:string|null;
  target_user:string|null;logon_id:string|null;
  image:string|null;parent_image:string|null;new_process_id:string|null;
  parent_process_id:string|null;process_guid:string|null;parent_process_guid:string|null;
  command_line:string|null;
  service_name:string|null;service_start_type:string|null;
  service_binary:string|null;service_account:string|null;
  hashes:string|null;signature:string|null;
  source_ip:string|null;destination_ip:string|null;
  scm_provider_pid_not_actor:boolean;
};
export function extractWindowsEventContext(payload:unknown):WindowsEventContext|null {
  const raw=object(payload), data=object(raw.data), win=object(data.win);
  const system=object(win.system), eventdata=object(win.eventdata);
  const event=object(raw.event), agent=object(raw.agent);
  const eventId=pick(system,["eventID","eventId","event_id"])||
    pick(data,["event_id","eventID"])||pick(event,["code"]);
  if(!Object.keys(win).length&&!eventId)return null;
  const provider=pick(system,["providerName","provider","provider_name"]);
  const image=pick(eventdata,["newProcessName","image","Image","processName","ProcessName"],520);
  const commandLine=pick(eventdata,["commandLine","CommandLine","processCommandLine"],1500);
  const id=eventId;
  return {
    event_id:id,
    record_id:pick(system,["eventRecordID","eventRecordId","recordId","record_id"]),
    channel:pick(system,["channel","Channel"]),
    provider,computer:pick(system,["computer","Computer"])||pick(agent,["name"]),
    event_time:pick(system,["systemTime","timeCreated","timestamp"])||pick(raw,["timestamp"]),
    correlation_activity_id:pick(system,["activityID","activityId","correlationActivityID"]),
    process_id:pick(system,["processID","processId"]),
    thread_id:pick(system,["threadID","threadId"]),
    subject_user:pick(eventdata,["subjectUserName","SubjectUserName","user","User"]),
    subject_domain:pick(eventdata,["subjectDomainName","SubjectDomainName"]),
    subject_sid:pick(eventdata,["subjectUserSid","SubjectUserSid","userSid"]),
    target_user:pick(eventdata,["targetUserName","TargetUserName"]),
    logon_id:pick(eventdata,["subjectLogonId","SubjectLogonId","targetLogonId","TargetLogonId"]),
    image,
    parent_image:pick(eventdata,["parentProcessName","ParentProcessName","parentImage","ParentImage"],520),
    new_process_id:pick(eventdata,["newProcessId","NewProcessId","processId","ProcessId"]),
    parent_process_id:pick(eventdata,["processId","ProcessId","parentProcessId","ParentProcessId"]),
    process_guid:pick(eventdata,["processGuid","ProcessGuid"]),
    parent_process_guid:pick(eventdata,["parentProcessGuid","ParentProcessGuid"]),
    command_line:commandLine?redact(commandLine):null,
    service_name:pick(eventdata,["serviceName","ServiceName","param1"]),
    service_start_type:pick(eventdata,["serviceStartType","ServiceStartType","param2","param3"]),
    service_binary:pick(eventdata,["imagePath","ImagePath","serviceFileName","ServiceFileName"],520),
    service_account:pick(eventdata,["accountName","AccountName","serviceAccount","ServiceAccount"]),
    hashes:pick(eventdata,["hashes","Hashes"],700),
    signature:pick(eventdata,["signature","Signature","signed","Signed"]),
    source_ip:pick(data,["srcip","src_ip"])||pick(eventdata,["sourceIp","SourceIp"]),
    destination_ip:pick(data,["dstip","dst_ip"])||pick(eventdata,["destinationIp","DestinationIp"]),
    scm_provider_pid_not_actor:id==="7040"&&!!provider&&/service control manager/i.test(provider),
  };
}
