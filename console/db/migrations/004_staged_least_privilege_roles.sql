-- P0 staged least-privilege database roles, non-destructive.
-- NOLOGIN roles have no password and cannot be used externally.
-- Do not deploy these roles as app credentials until runtime DDL is removed
-- and API operations are split between read, ingest and mutation.
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='soc_live_dashboard_candidate') THEN
  CREATE ROLE soc_live_dashboard_candidate NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='soc_live_ingest_candidate') THEN
  CREATE ROLE soc_live_ingest_candidate NOLOGIN NOINHERIT NOBYPASSRLS;
 END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO soc_live_dashboard_candidate,soc_live_ingest_candidate;
-- Dashboard needs only SELECT. Tenant-owned data remain inaccessible by default.
GRANT SELECT ON public.soc_live_alerts,public.soc_live_audit,
 public.soc_agent_runs,public.soc_endpoint_inventory,
 public.soc_endpoint_heartbeats,public.soc_ai_remediations,
 public.soc_remediation_assessments,public.soc_correlation_ai,
 public.soc_org_memberships,public.soc_organizations,
 public.soc_org_connectors,public.soc_org_agents,
 public.soc_org_subscriptions TO soc_live_dashboard_candidate;

GRANT INSERT ON public.soc_live_alerts TO soc_live_ingest_candidate;
-- Explicitly no UPDATE/DELETE/SELECT on alerts to ingest candidate.
-- RETURNING id in the current ingest pipeline needs a separately bounded
-- migration before a production credential switch.
CREATE POLICY soc_soc_live_alerts_cand_read ON public.soc_live_alerts
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_live_alerts_cand_ingest ON public.soc_live_alerts
 FOR INSERT TO soc_live_ingest_candidate
 WITH CHECK(tenant_id='22222222-2222-4222-8222-222222222222');

CREATE POLICY soc_soc_agent_runs_cand_read ON public.soc_agent_runs
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_live_audit_cand_read ON public.soc_live_audit
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_endpoint_inventory_cand_read ON public.soc_endpoint_inventory
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_endpoint_heartbeats_cand_read ON public.soc_endpoint_heartbeats
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_ai_remediations_cand_read ON public.soc_ai_remediations
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_remediation_assessments_cand_read ON public.soc_remediation_assessments
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_correlation_ai_cand_read ON public.soc_correlation_ai
 FOR SELECT TO soc_live_dashboard_candidate
 USING(tenant_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_org_memberships_cand_read ON public.soc_org_memberships
 FOR SELECT TO soc_live_dashboard_candidate
 USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_organizations_cand_read ON public.soc_organizations
 FOR SELECT TO soc_live_dashboard_candidate
 USING(id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_org_connectors_cand_read ON public.soc_org_connectors
 FOR SELECT TO soc_live_dashboard_candidate
 USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_org_agents_cand_read ON public.soc_org_agents
 FOR SELECT TO soc_live_dashboard_candidate
 USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_org_subscriptions_cand_read ON public.soc_org_subscriptions
 FOR SELECT TO soc_live_dashboard_candidate
 USING(org_id='22222222-2222-4222-8222-222222222222');
CREATE POLICY soc_soc_org_audit_cand_read ON public.soc_org_audit
 FOR SELECT TO soc_live_dashboard_candidate
 USING(org_id='22222222-2222-4222-8222-222222222222');
GRANT SELECT ON public.soc_org_audit TO soc_live_dashboard_candidate;
-- Owner SET ROLE is solely for transactional acceptance tests.
GRANT soc_live_dashboard_candidate,soc_live_ingest_candidate TO neondb_owner;
