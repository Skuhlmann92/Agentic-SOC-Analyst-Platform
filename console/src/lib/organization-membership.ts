import {neon} from "@neondatabase/serverless";
import {LEGACY_LIVE_TENANT} from "@/lib/tenant-policy";

/**
 * Verifies that the existing administrator still has an active membership in
 * the server-owned organization directory. This is an application authorization
 * check, NOT a substitute for future PostgreSQL row-level security.
 */
export async function verifyLegacyAdminMembership(principalId:string):Promise<boolean>{
 if(!principalId)return false;
 const url=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;
 if(!url)return false;
 try{
  const sql=neon(url);
  const result=await sql.query(
   `SELECT 1 FROM public.soc_org_memberships m
      JOIN public.soc_organizations o ON o.id=m.org_id
     WHERE m.org_id=$1 AND m.principal_id=$2
       AND m.role='platform_admin' AND m.status='active'
       AND o.status='active' LIMIT 1`,
    [LEGACY_LIVE_TENANT,principalId]
  );
  return Array.isArray(result)&&result.length===1;
 }catch(error){
  console.error("Organization authorization unavailable",
   error instanceof Error?error.name:"unknown");
  return false;
 }
}
