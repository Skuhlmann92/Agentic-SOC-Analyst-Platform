-- Applied with the existing migration process before enabling 2FA.
CREATE TABLE IF NOT EXISTS public.soc_admin_totp_state (
 id smallint PRIMARY KEY CHECK (id = 1),
 last_step bigint NOT NULL
);
REVOKE ALL ON public.soc_admin_totp_state FROM PUBLIC;
