import {neon} from "@neondatabase/serverless";

/**
 * Explicit database access boundary.
 * The legacy production credential remains available only for migration
 * compatibility. A separate restricted READ credential can be enabled after
 * tenant-policy and read-only acceptance tests pass.
 *
 * SOC_READ_DATABASE_URL must be a NO-BYPASSRLS database user restricted to
 * the current workspace. Do NOT point it at neondb_owner.
 *
 * SOC_READ_DB_ENABLED is intentionally false unless explicitly set to true.
 * Once enabled, a missing read credential is a hard error, not fallback to owner.
 */
/** Sanity gate only; PostgreSQL grants and RLS must be verified separately. */
export function assertRestrictedUrl(url:string):void {
 let parsed:URL;
 try{parsed=new URL(url);}catch{throw Error("Invalid scoped database URL");}
 const role=decodeURIComponent(parsed.username).toLowerCase();
 if(!["postgres:","postgresql:"].includes(parsed.protocol)||
    !role||["neondb_owner","postgres","neon_superuser"].includes(role)){
   throw Error("Scoped database URL must use a named, non-owner PostgreSQL role");
 }
}
export function databaseUrl(purpose:"read"|"demo_read"|"write"|"ingest"="write"):string{
 if(purpose==="read"&&process.env.SOC_READ_DB_ENABLED==="true"){
  const url=process.env.SOC_READ_DATABASE_URL;
  if(!url)throw new Error("SOC_READ_DB_ENABLED requires SOC_READ_DATABASE_URL");
  assertRestrictedUrl(url);
  return url;
 }
 if(purpose==="demo_read"&&process.env.SOC_READ_DB_ENABLED==="true"){
  const url=process.env.SOC_DEMO_READ_DATABASE_URL;
  if(!url)throw new Error("SOC_READ_DB_ENABLED requires SOC_DEMO_READ_DATABASE_URL for public demo");
  assertRestrictedUrl(url);
  return url;
 }
 if(purpose==="ingest"&&process.env.SOC_INGEST_DB_ENABLED==="true"){
  const url=process.env.SOC_INGEST_DATABASE_URL;
  if(!url)throw new Error("SOC_INGEST_DB_ENABLED requires SOC_INGEST_DATABASE_URL");
  assertRestrictedUrl(url);
  return url;
 }
 const legacy=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;
 if(!legacy)throw new Error("No database URL configured");
 return legacy;
}
export function sqlFor(purpose:"read"|"demo_read"|"write"|"ingest"="write"):ReturnType<typeof neon>{
 return neon(databaseUrl(purpose)) as ReturnType<typeof neon>;
}
