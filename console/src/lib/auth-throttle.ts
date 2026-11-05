import {createHmac} from "node:crypto";
import {neon} from "@neondatabase/serverless";
import {sessionSecret} from "@/lib/session-token";

/**
 * Best-effort database-backed protection against repeated login guessing.
 * The fingerprint is keyed with the session secret: never store raw IPs or passwords.
 * In production, a database outage fails closed for administrator authentication.
 */
export async function checkLoginThrottle(request:Request,operator:string){
 const database=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;
 if(!database)return {allowed:false,retrySeconds:60};
 const address=(request.headers.get("x-vercel-forwarded-for")||
   request.headers.get("x-forwarded-for")||"unknown").split(",")[0].trim().slice(0,80);
 const key=createHmac("sha256",sessionSecret()).update(address+"|"+operator.slice(0,80)).digest("hex");
 try{
  const sql=neon(database);
  const result=await sql.query(`INSERT INTO public.soc_auth_throttle(fingerprint,window_start,attempts,updated_at)
   VALUES($1,now(),1,now())
   ON CONFLICT(fingerprint) DO UPDATE SET
    attempts=CASE WHEN soc_auth_throttle.window_start < now()-interval '15 minutes' THEN 1
      ELSE soc_auth_throttle.attempts+1 END,
    window_start=CASE WHEN soc_auth_throttle.window_start < now()-interval '15 minutes'
      THEN now() ELSE soc_auth_throttle.window_start END,
    updated_at=now()
   RETURNING attempts`,[key]);
  const attempts=Number(result[0]?.attempts||999);
  return {allowed:attempts<=30,retrySeconds:900};
 }catch(error){
  console.error("Auth throttle failed",error instanceof Error?error.name:"unknown");
  return {allowed:false,retrySeconds:60};
 }
}
