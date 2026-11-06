import assert from "node:assert/strict";
import {afterEach,test} from "node:test";
import {databaseUrl,assertRestrictedUrl} from "../src/lib/database-access.ts";

const keys=["SOC_READ_DB_ENABLED","SOC_READ_DATABASE_URL","SOC_DEMO_READ_DATABASE_URL",
 "SOC_INGEST_DB_ENABLED","SOC_INGEST_DATABASE_URL","POSTGRES_DATABASE_URL","POSTGRES_URL"];
const originals=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
afterEach(()=>{for(const [key,value] of Object.entries(originals)){
 if(value===undefined)delete process.env[key];else process.env[key]=value;
}});
const legacy="postgresql://neondb_owner:dummy@db.local/soc";
const limited="postgresql://soc_live_reader:dummy@db.local/soc";
test("legacy credentials retained until explicitly switched",()=>{
 process.env.SOC_READ_DB_ENABLED="false";process.env.SOC_INGEST_DB_ENABLED="false";
 process.env.POSTGRES_DATABASE_URL=legacy;
 assert.equal(databaseUrl("read"),legacy);
 assert.equal(databaseUrl("demo_read"),legacy);
 assert.equal(databaseUrl("ingest"),legacy);
});
test("scoped readers require independent live and demo credentials",()=>{
 process.env.SOC_READ_DB_ENABLED="true";process.env.POSTGRES_DATABASE_URL=legacy;
 process.env.SOC_READ_DATABASE_URL=limited;
 delete process.env.SOC_DEMO_READ_DATABASE_URL;
 assert.equal(databaseUrl("read"),limited);
 assert.throws(()=>databaseUrl("demo_read"),/SOC_DEMO_READ_DATABASE_URL/);
 process.env.SOC_DEMO_READ_DATABASE_URL="postgresql://soc_demo_reader:dummy@db.local/soc";
 assert.match(databaseUrl("demo_read"),/soc_demo_reader/);
});
test("owner connection cannot be configured as scoped reader or writer",()=>{
 for(const role of ["neondb_owner","postgres","neon_superuser"]){
  assert.throws(()=>assertRestrictedUrl("postgres://"+role+":x@db.local/soc"),/non-owner/);
 }
 assert.throws(()=>assertRestrictedUrl("https://example.com"),/non-owner/);
 assert.doesNotThrow(()=>assertRestrictedUrl(limited));
});
test("enable flag fails closed without a restricted URL",()=>{
 process.env.SOC_INGEST_DB_ENABLED="true";
 delete process.env.SOC_INGEST_DATABASE_URL;
 assert.throws(()=>databaseUrl("ingest"),/SOC_INGEST_DATABASE_URL/);
 process.env.SOC_INGEST_DATABASE_URL=legacy;
 assert.throws(()=>databaseUrl("ingest"),/non-owner/);
});
