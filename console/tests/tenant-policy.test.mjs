import assert from "node:assert/strict";
import {test} from "node:test";
import {authorizeWorkspace,DEMO_TENANT,LEGACY_LIVE_TENANT,hasCommercialPermission} from "../src/lib/tenant-policy.ts";

const admin="socadmin";
const publicSession={sub:"demo-analyst",role:"analyst",tenantId:DEMO_TENANT};
const privateSession={sub:admin,role:"admin",tenantId:LEGACY_LIVE_TENANT};
test("anonymous clients cannot enter any workspace",()=>assert.equal(authorizeWorkspace(null,admin).kind,"denied"));
test("public demo is confined to read-only demo tenant",()=>{
 const access=authorizeWorkspace(publicSession,admin);
 assert.equal(access.kind,"public_demo");
 if(access.kind==="public_demo")assert.equal(access.permissions,"read");
 assert.equal(authorizeWorkspace({...publicSession,tenantId:LEGACY_LIVE_TENANT},admin).kind,"denied");
 assert.equal(authorizeWorkspace({...publicSession,role:"admin"},admin).kind,"denied");
});
test("live administrator remains admitted only to assigned live tenant",()=>{
 assert.equal(authorizeWorkspace(privateSession,admin).kind,"legacy_live");
 assert.equal(authorizeWorkspace({...privateSession,tenantId:DEMO_TENANT},admin).kind,"denied");
 assert.equal(authorizeWorkspace({...privateSession,role:"viewer"},admin).kind,"denied");
 assert.equal(authorizeWorkspace({...privateSession,sub:"attacker"},admin).kind,"denied");
});
test("arbitrary signed sessions and tenant spoofing are denied",()=>{
 for(const role of ["viewer","customer_admin","platform_admin","security_analyst","admin"]){
  assert.equal(authorizeWorkspace({sub:"other",role,tenantId:"33333333-3333-4333-8333-333333333333"},admin).kind,"denied");
 }
});
test("commercial RBAC prevents viewer write and analyst billing escalation",()=>{
 assert.equal(hasCommercialPermission("viewer","remediation:review"),false);
 assert.equal(hasCommercialPermission("viewer","alerts:triage"),false);
 assert.equal(hasCommercialPermission("security_analyst","billing:manage"),false);
 assert.equal(hasCommercialPermission("security_analyst","remediation:propose"),true);
 assert.equal(hasCommercialPermission("customer_admin","org:manage"),true);
});
