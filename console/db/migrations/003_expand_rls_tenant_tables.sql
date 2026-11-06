-- P0 Stage 3: complete RLS coverage for tenant-bearing SOC tables.
-- No FORCE ROW LEVEL SECURITY because the existing application still uses
-- neondb_owner and must migrate to least-privilege credentials first.
-- All probe roles are NOLOGIN and SELECT-only. No credentials are created.
-- Other database roles are default-denied by RLS, barring owner/BYPASSRLS.
ALTER TABLE public.soc_agent_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_ai_remediations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_correlation_ai ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_endpoint_heartbeats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_endpoint_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_live_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_remediation_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_org_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_org_connectors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_org_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_org_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_org_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.soc_organizations ENABLE ROW LEVEL SECURITY;
-- Role-specific canary policies: these are not a customer-facing authorization design.
CREATE POLICY soc_run_live_ro ON public.soc_agent_runs FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_remediation_live_ro ON public.soc_ai_remediations FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_correlation_live_ro ON public.soc_correlation_ai FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_heartbeat_live_ro ON public.soc_endpoint_heartbeats FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_inventory_live_ro ON public.soc_endpoint_inventory FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_audit_live_ro ON public.soc_live_audit FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_assess_live_ro ON public.soc_remediation_assessments FOR SELECT TO soc_rls_live_probe USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_membership_live_ro ON public.soc_org_memberships FOR SELECT TO soc_rls_live_probe USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_connector_live_ro ON public.soc_org_connectors FOR SELECT TO soc_rls_live_probe USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_agents_live_ro ON public.soc_org_agents FOR SELECT TO soc_rls_live_probe USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_subscription_live_ro ON public.soc_org_subscriptions FOR SELECT TO soc_rls_live_probe USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_org_audit_live_ro ON public.soc_org_audit FOR SELECT TO soc_rls_live_probe USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_org_live_ro ON public.soc_organizations FOR SELECT TO soc_rls_live_probe USING(id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_org_demo_ro ON public.soc_organizations FOR SELECT TO soc_rls_demo_probe USING(id='11111111-1111-4111-8111-111111111111');
GRANT SELECT ON public.soc_agent_runs,public.soc_ai_remediations,public.soc_correlation_ai,
 public.soc_endpoint_heartbeats,public.soc_endpoint_inventory,public.soc_live_audit,
 public.soc_remediation_assessments,public.soc_org_memberships,public.soc_org_connectors,
 public.soc_org_agents,public.soc_org_subscriptions,public.soc_org_audit,
 public.soc_organizations TO soc_rls_live_probe;
GRANT SELECT ON public.soc_organizations TO soc_rls_demo_probe;
-- Keep catalog public to application only; probe grants are not required.
