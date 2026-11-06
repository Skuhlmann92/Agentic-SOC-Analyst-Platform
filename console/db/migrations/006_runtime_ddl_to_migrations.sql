-- P0 schema bootstrap: relocate historical API-time DDL into version-controlled migrations.
-- Execute once with a migration role BEFORE any least-privilege runtime switch.
-- All statements are additive / IF NOT EXISTS; no existing records are removed.
CREATE TABLE IF NOT EXISTS public.soc_live_alerts (
 tenant_id text NOT NULL,id uuid NOT NULL,external_id text NOT NULL,
 source text NOT NULL,severity text NOT NULL,status text NOT NULL DEFAULT 'new',
 detected_at timestamptz NOT NULL,payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS soc_live_alerts_recent ON public.soc_live_alerts(tenant_id,detected_at DESC);
CREATE TABLE IF NOT EXISTS public.soc_live_audit (
 id bigserial PRIMARY KEY,tenant_id text NOT NULL,alert_id uuid NOT NULL,
 action text NOT NULL,actor text NOT NULL,recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.soc_agent_runs (
 tenant_id text NOT NULL,id uuid NOT NULL,alert_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,id),UNIQUE(tenant_id,alert_id)
);
CREATE INDEX IF NOT EXISTS soc_agent_runs_created ON public.soc_agent_runs(tenant_id,created_at DESC);
CREATE TABLE IF NOT EXISTS public.soc_demo_records (
 tenant_id text NOT NULL,kind text NOT NULL,id uuid NOT NULL,payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,kind,id)
);
CREATE TABLE IF NOT EXISTS public.soc_ai_remediations (
 tenant_id text NOT NULL,id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 hostname text NOT NULL,payload jsonb NOT NULL,PRIMARY KEY(tenant_id,id)
);
CREATE TABLE IF NOT EXISTS public.soc_correlation_ai (
 tenant_id text NOT NULL,case_id uuid NOT NULL,created_at timestamptz NOT NULL DEFAULT now(),
 payload jsonb NOT NULL,PRIMARY KEY(tenant_id,case_id)
);
CREATE TABLE IF NOT EXISTS public.soc_endpoint_heartbeats (
 tenant_id text NOT NULL,hostname text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,hostname)
);
CREATE TABLE IF NOT EXISTS public.soc_endpoint_inventory (
 tenant_id text NOT NULL,hostname text NOT NULL,
 received_at timestamptz NOT NULL DEFAULT now(),payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,hostname)
);
CREATE TABLE IF NOT EXISTS public.soc_remediation_assessments (
 tenant_id text NOT NULL,remediation_id uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now(),payload jsonb NOT NULL,
 PRIMARY KEY(tenant_id,remediation_id)
);
CREATE TABLE IF NOT EXISTS public.soc_remediation_audit (
 id uuid PRIMARY KEY,tenant_id text NOT NULL,remediation_id uuid NOT NULL,
 action text NOT NULL,reviewer text NOT NULL,note text,recorded_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.soc_remediation_audit ENABLE ROW LEVEL SECURITY;
-- No customer policy on audit records; owner access only until a
-- specific reviewer/service-role policy is implemented.
