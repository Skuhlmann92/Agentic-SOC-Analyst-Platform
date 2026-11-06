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

CREATE OR REPLACE FUNCTION public.soc_tenant_role_matches(candidate uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = pg_catalog, public
AS $function$
 SELECT EXISTS (
  SELECT 1 FROM public.soc_db_role_tenants r
  JOIN public.soc_organizations o ON o.id=r.org_id
  WHERE r.role_name=current_user::name
    AND r.org_id=candidate
    AND o.status='active'
 )
$function$;
REVOKE ALL ON FUNCTION public.soc_tenant_role_matches(uuid) FROM PUBLIC;

-- PostgreSQL SECURITY DEFINER changes CURRENT_USER to function owner.
-- For production use, role identity MUST be transmitted as a trusted function
-- argument from a privileged gateway; never trust a settable custom GUC.
-- Probe policies below instead rely on PG roles directly using CURRENT_ROLE,
-- which is preserved by invoker expressions (no SECURITY DEFINER helper).

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
DROP POLICY IF EXISTS soc_live_probe_isolation ON public.soc_live_alerts;
CREATE POLICY soc_live_probe_isolation ON public.soc_live_alerts FOR SELECT TO soc_rls_live_probe
 USING (tenant_id='22222222-2222-4222-8222-222222222222');
DROP POLICY IF EXISTS soc_demo_probe_isolation ON public.soc_demo_records;
CREATE POLICY soc_demo_probe_isolation ON public.soc_demo_records FOR SELECT TO soc_rls_demo_probe
 USING (tenant_id='11111111-1111-4111-8111-111111111111');

-- Scoped canary grants; no INSERT/UPDATE/DELETE; no password and no LOGIN.
GRANT USAGE ON SCHEMA public TO soc_rls_demo_probe,soc_rls_live_probe;
GRANT SELECT ON public.soc_demo_records TO soc_rls_demo_probe;
GRANT SELECT ON public.soc_live_alerts TO soc_rls_live_probe;

-- Existing owner bypasses RLS by design until application credentials rotate.
-- Do not grant membership of probe roles to untrusted applications or users.
