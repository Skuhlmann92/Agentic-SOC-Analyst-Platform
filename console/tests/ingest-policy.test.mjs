import assert from "node:assert/strict";
import {test} from "node:test";
import {validateIngestEvents,resolveIngestSource,deduplicationNamespace} from "../src/lib/ingest-policy.ts";
const live="22222222-2222-4222-8222-222222222222",customer="33333333-3333-4333-8333-333333333333";
const bound={tenantId:customer,connectorId:"connector-id",kind:"connector",sourceType:"wazuh",allowedAgentIds:["001","002"]};
const event=(id,extras={})=>({id:"event-id",agent:{id},...extras});
test("valid connector event must have registered Wazuh agent ID",()=>{
 assert.equal(validateIngestEvents([event("001"),event("002")],bound),true);
 assert.equal(validateIngestEvents([event("001"),event("999")],bound),false);
 assert.equal(validateIngestEvents([event(1)],bound),false);
 assert.equal(validateIngestEvents([{agent:{name:"spoofed"}}],bound),false);
 assert.equal(validateIngestEvents([null],bound),false);
 assert.equal(validateIngestEvents([],bound),false);
});
test("caller cannot change tenant, source or agent identity",()=>{
 assert.equal(validateIngestEvents([event("999",{tenant_id:live,source:"wazuh"})],bound),false);
 assert.equal(resolveIngestSource(bound,"untrusted-external-source"),"wazuh");
 assert.equal(resolveIngestSource({...bound,sourceType:"edr"},"wazuh"),"edr");
});
test("connector requires registered agents and verified connector ID",()=>{
 assert.equal(validateIngestEvents([event("001")],{...bound,connectorId:null}),false);
 assert.equal(validateIngestEvents([event("001")],{...bound,allowedAgentIds:[]}),false);
});
test("existing live ingest keeps stable event identifiers, customers are namespaced",()=>{
 assert.equal(deduplicationNamespace(live,live,"wazuh"),"wazuh");
 assert.equal(deduplicationNamespace(customer,live,"wazuh"),customer+":wazuh");
});
test("legacy authentication remains single-tenant compatible",()=>{
 const legacy={tenantId:live,kind:"legacy",sourceType:null,connectorId:null,allowedAgentIds:[]};
 assert.equal(validateIngestEvents([event("001")],legacy),true);
 assert.equal(resolveIngestSource(legacy,"wazuh"),"wazuh");
});
