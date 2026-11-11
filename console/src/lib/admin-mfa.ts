import { neon } from "@neondatabase/serverless";
import { adminMfaRequired } from "@/lib/session-token";
import { matchTotpStep } from "@/lib/totp";

/**
 * Password must be checked before calling this function. This does not issue a
 * session and never returns the TOTP secret or input code to clients/logs.
 *
 * A single atomic UPDATE/INSERT protects against code replay across Vercel
 * instances. A database outage or missing migration fails closed.
 */
export async function verifyAndConsumeAdminTotp(code: unknown, principal: string): Promise<boolean> {
  if (!adminMfaRequired()) return false;
  const secret = process.env.SOC_ADMIN_TOTP_SECRET;
  if (typeof secret !== "string" || typeof code !== "string") return false;
  const step = matchTotpStep(secret, code);
  if (step === null) return false;
  const connection = process.env.SOC_AUTH_DATABASE_URL || process.env.POSTGRES_DATABASE_URL || process.env.POSTGRES_URL;
  if (!connection) return false;
  try {
    const sql = neon(connection);
    const rows = await sql.query(
      `INSERT INTO public.soc_auth_totp_replay (principal, last_step, updated_at)
       VALUES ($1, $2, now())
       ON CONFLICT (principal) DO UPDATE
       SET last_step = EXCLUDED.last_step, updated_at = now()
       WHERE public.soc_auth_totp_replay.last_step < EXCLUDED.last_step
       RETURNING principal`,
      [`admin:${principal}`, step],
    );
    return rows.length === 1;
  } catch (error) {
    console.error("Admin MFA verification unavailable", error instanceof Error ? error.name : "unknown");
    return false;
  }
}
