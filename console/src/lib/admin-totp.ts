import {neon} from "@neondatabase/serverless";
import {matchingTotpStep} from "@/lib/totp";

// Atomic, persistent replay protection shared by all serverless instances.
export async function consumeAdminTotp(code:string):Promise<boolean> {
 const secret=process.env.SOC_ADMIN_TOTP_SECRET_HEX||"";
 const step=matchingTotpStep(secret,code);
 const database=process.env.POSTGRES_DATABASE_URL||process.env.POSTGRES_URL;
 if(step===null||!database)return false;
 try {
  const sql=neon(database);
  const rows=await sql.query(`INSERT INTO public.soc_admin_totp_state (id,last_step)
    VALUES (1,$1) ON CONFLICT (id) DO UPDATE SET last_step=EXCLUDED.last_step
    WHERE public.soc_admin_totp_state.last_step < EXCLUDED.last_step RETURNING id`,[step]);
  return rows.length===1;
 } catch { return false; }
}
