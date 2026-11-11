-- Staging candidate for least-privilege TOTP replay consumption.
-- This NOLOGIN role is NOT a connection credential. Grant it to a dedicated
-- LOGIN role only after authentication connection and rollback have been tested.
-- Requires migration 008_admin_totp_replay.sql.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'soc_auth_replay_candidate') THEN
    CREATE ROLE soc_auth_replay_candidate NOLOGIN NOINHERIT NOBYPASSRLS;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO soc_auth_replay_candidate;
GRANT SELECT (principal, last_step) ON public.soc_auth_totp_replay TO soc_auth_replay_candidate;
GRANT INSERT (principal, last_step, updated_at) ON public.soc_auth_totp_replay TO soc_auth_replay_candidate;
GRANT UPDATE (last_step, updated_at) ON public.soc_auth_totp_replay TO soc_auth_replay_candidate;
-- No DELETE, TRUNCATE, table-owner or connector-secret privileges.
