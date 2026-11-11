-- 008: shared replay counter for administrator TOTP, independent of Vercel process.
-- Apply manually in staging BEFORE SOC_REQUIRE_ADMIN_MFA=true or SOC_ADMIN_TOTP_SECRET is set.
-- This migration does NOT enable MFA or change existing administrator credentials.
CREATE TABLE IF NOT EXISTS public.soc_auth_totp_replay (
  principal TEXT PRIMARY KEY,
  last_step BIGINT NOT NULL CHECK (last_step >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON TABLE public.soc_auth_totp_replay FROM PUBLIC;

COMMENT ON TABLE public.soc_auth_totp_replay
  IS 'Last consumed RFC 6238 counter per principal; no OTP or TOTP secrets stored.';
