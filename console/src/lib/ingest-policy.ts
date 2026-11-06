/** Pure, dependency-free binding checks for tenant-scoped ingestion.
 * The tenant and connector identity MUST come from verified server credentials,
 * never from request bodies or caller-provided headers.
 */
export type IngestIdentity={
 tenantId:string;
 connectorId:string|null;
 kind:"legacy"|"connector";
 sourceType:"wazuh"|"edr"|null;
 allowedAgentIds:readonly string[];
};
export function validateIngestEvents(events:unknown[],credential:IngestIdentity):boolean{
 if(!events.length)return false;
 if(credential.kind==="legacy")return true;
 if(!credential.connectorId||!credential.sourceType||!credential.allowedAgentIds.length)return false;
 return events.every(item=>{
  if(!item||typeof item!=="object"||Array.isArray(item))return false;
  const raw=item as Record<string,unknown>;
  const agent=raw.agent&&typeof raw.agent==="object"&&!Array.isArray(raw.agent)
   ?raw.agent as Record<string,unknown>:{};
  return typeof agent.id==="string"&&credential.allowedAgentIds.includes(agent.id);
 });
}
export function resolveIngestSource(credential:IngestIdentity,callerHint:string):string{
 return credential.kind==="connector" ? credential.sourceType||"edr" : callerHint;
}
export function deduplicationNamespace(tenantId:string,legacyTenantId:string,source:string):string{
 return tenantId===legacyTenantId?source:`${tenantId}:${source}`;
}
