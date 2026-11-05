-- P0: additive, non-destructive B2B tenancy foundation.
-- Existing soc_live_*, soc_demo_* and endpoint records remain unchanged.
-- These metadata tables do NOT by themselves constitute PostgreSQL RLS isolation.
-- Never expose membership creation to unauthenticated users.
CREATE TABLE IF NOT EXISTS public.soc_organizations (
 id uuid PRIMARY KEY,
 slug text NOT NULL UNIQUE,
 display_name text NOT NULL,
 kind text NOT NULL CHECK(kind IN ('legacy_live','public_demo','customer')),
 status text NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','active','suspended')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.soc_org_memberships (
 org_id uuid NOT NULL REFERENCES public.soc_organizations(id),
 principal_id text NOT NULL,
 role text NOT NULL CHECK(role IN ('platform_admin','customer_admin','security_analyst','viewer')),
 status text NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','suspended','revoked')),
 created_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(org_id,principal_id)
);
CREATE TABLE IF NOT EXISTS public.soc_org_connectors (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.soc_organizations(id),
 connector_type text NOT NULL CHECK(connector_type IN ('wazuh','edr')),
 display_name text NOT NULL,
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','testing','active','disabled')),
 credential_fingerprint text,
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(id,org_id)
);
CREATE TABLE IF NOT EXISTS public.soc_org_agents (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.soc_organizations(id),
 connector_id uuid NOT NULL,
 external_agent_id text NOT NULL,
 hostname text,
 created_at timestamptz NOT NULL DEFAULT now(),
 FOREIGN KEY(connector_id,org_id) REFERENCES public.soc_org_connectors(id,org_id),
 UNIQUE(connector_id,external_agent_id)
);
CREATE TABLE IF NOT EXISTS public.soc_subscription_catalog (
 plan_code text PRIMARY KEY CHECK(plan_code IN ('essential','professional','business')),
 price_eur_cents integer NOT NULL CHECK(price_eur_cents>=0),
 max_endpoints integer NOT NULL CHECK(max_endpoints>0),
 features jsonb NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.soc_org_subscriptions (
 id uuid PRIMARY KEY,
 org_id uuid NOT NULL UNIQUE REFERENCES public.soc_organizations(id),
 plan_code text NOT NULL REFERENCES public.soc_subscription_catalog(plan_code),
 status text NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','trial','pilot','active','past_due','expired','cancelled')),
 starts_at timestamptz,
 expires_at timestamptz,
 external_billing_id text UNIQUE,
 created_at timestamptz NOT NULL DEFAULT now(),
 CHECK(expires_at IS NULL OR starts_at IS NULL OR expires_at>starts_at)
);
CREATE TABLE IF NOT EXISTS public.soc_org_audit (
 id bigserial PRIMARY KEY,
 org_id uuid NOT NULL REFERENCES public.soc_organizations(id),
 actor_id text NOT NULL,
 action text NOT NULL,
 resource_type text,
 resource_id text,
 details jsonb NOT NULL DEFAULT '{}'::jsonb,
 occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS soc_org_audit_recent ON public.soc_org_audit(org_id,occurred_at DESC);
CREATE INDEX IF NOT EXISTS soc_org_agents_tenant ON public.soc_org_agents(org_id,connector_id);
-- Commercial subscriptions are not activated, no charges are created.
INSERT INTO public.soc_organizations(id,slug,display_name,kind,status)
VALUES
 ('22222222-2222-4222-8222-222222222222','legacy-live','SOC Private Workspace','legacy_live','active'),
 ('11111111-1111-4111-8111-111111111111','public-demo','Public Demo Workspace','public_demo','active')
ON CONFLICT(id) DO NOTHING;
INSERT INTO public.soc_subscription_catalog(plan_code,price_eur_cents,max_endpoints,features)
VALUES
 ('essential',14900,15,'{"monitoring":true,"ai_analysis":"basic","reports":"monthly","remediation_scripts":false}'::jsonb),
 ('professional',34900,50,'{"monitoring":true,"ai_analysis":"advanced","reports":"weekly","remediation_scripts":true}'::jsonb),
 ('business',69900,150,'{"monitoring":true,"ai_analysis":"advanced","reports":"weekly","remediation_scripts":true,"priority_support":true}'::jsonb)
ON CONFLICT(plan_code) DO NOTHING;
