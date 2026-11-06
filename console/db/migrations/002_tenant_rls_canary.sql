-- P0 Stage 2: tenant-aware RLS shadow policies and strictly unprivileged probes.
-- SAFE ROLLOUT: Does not FORCE RLS; the existing owner connection is unaffected.
-- IMPORTANT: production is NOT isolated until owner connection is replaced by
-- least-privilege credentials and tenant-specific trusted database roles.
-- Role-to-org association cannot be edited by tenant roles.
CREATE TABLE IF NOT EXISTS public.soc_db_role_tenants (
 role_name name PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.soc_organizations(id),
 created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.soc_db_role_tenants FROM PUBLIC;

-- No SECURITY DEFINER tenant-identity helper: CURRENT_USER inside such a helper
-- resolves to the function owner. Each canary instead has an explicit role
-- policy. This avoids a spoofable custom GUC or owner-context identity bug.

-- Explicit canary roles are NOLOGIN and lack inherited privileges; they cannot
-- become application credentials or touch production data by themselves.
DO $block$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='soc_rls_demo_probe') THEN
  CREATE ROLE soc_rls_demo_probe NOLOGIN NOBYPASSRLS NOINHERIT;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='soc_rls_live_probe') THEN
  CREATE ROLE soc_rls_live_probe NOLOGIN NOBYPASSRLS NOINHERIT;
 END IF;
END
$block$;
INSERT INTO public.soc_db_role_tenants(role_name,org_id)
VALUES ('soc_rls_demo_probe','11111111-1111-4111-8111-111111111111'),
       ('soc_rls_live_probe','22222222-2222-4222-8222-222222222222')
ON CONFLICT (role_name) DO NOTHING;

-- The canary access check uses a direct per-role policy and does not depend on
-- a client-controllable GUC. Future tenant roles must each be provisioned with
-- a fixed, verified org identity by privileged onboarding infrastructure.
ALTER TABLE public.soc_live_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_demo_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY soc_live_probe_isolation ON public.soc_live_alerts FOR SELECT TO soc_rls_live_probe
 USING (tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_demo_probe_isolation ON public.soc_demo_records FOR SELECT TO soc_rls_demo_probe
 USING (tenant_id='11111111-1111-4111-8111-111111111111');

-- Scoped canary grants; no INSERT/UPDATE/DELETE; no password and no LOGIN.
GRANT USAGE ON SCHEMA public TO soc_rls_demo_probe,soc_rls_live_probe;
GRANT SELECT ON public.soc_demo_records TO soc_rls_demo_probe;
GRANT SELECT ON public.soc_live_alerts TO soc_rls_live_probe;

-- Existing owner bypasses RLS by design until application credentials rotate.
-- Do not grant membership of probe roles to untrusted applications or users.
