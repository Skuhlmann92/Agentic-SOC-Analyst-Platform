import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";

const protectedPaths=[
 "src/lib/live-api.ts",
 "src/lib/agent-triage.ts",
 "src/lib/demo-api.ts",
 "src/app/api/remediation/route.ts",
 "src/app/api/remediation/review/route.ts",
 "src/app/api/endpoint-heartbeat/route.ts",
 "src/app/api/endpoint-inventory/route.ts",
 "src/app/api/correlation/route.ts",
];
test("SOC request handlers never create/alter database schemas",()=>{
 for(const path of protectedPaths){
  const source=readFileSync(new URL("../"+path,import.meta.url),"utf8");
  assert.doesNotMatch(source,/\b(?:CREATE\s+(?:TABLE|INDEX|POLICY)|ALTER\s+TABLE|DROP\s+(?:TABLE|INDEX))\b/i,path);
 }
});
test("schema migration exists for relocated historical tables",()=>{
 const source=readFileSync(new URL("../db/migrations/006_runtime_ddl_to_migrations.sql",import.meta.url),"utf8");
 for(const table of ["soc_live_alerts","soc_live_audit","soc_agent_runs","soc_demo_records",
 "soc_ai_remediations","soc_endpoint_heartbeats","soc_remediation_audit"]){
  assert.ok(source.includes(table),"Missing migration for "+table);
 }
});
