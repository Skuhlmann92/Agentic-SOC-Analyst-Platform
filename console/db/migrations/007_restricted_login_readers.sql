-- P0: real, non-owner PostgreSQL read identities.
-- These roles are provisioned using Neon create_postgres_role with
-- access=read_only, database=neondb, schemas=['public'].
-- Do NOT create or hardcode passwords here; Neon manages login credentials.
-- Role identifiers refer only to the existing legacy live and demo tenants.
-- IMPORTANT: No application flag is enabled by this migration.

REVOKE ALL PRIVILEGES ON
 public.soc_agent_runs,public.soc_ai_remediations,
 public.soc_auth_throttle,public.soc_correlation_ai,
 public.soc_db_role_tenants,public.soc_endpoint_heartbeats,
 public.soc_endpoint_inventory,public.soc_ingest_credentials,
 public.soc_live_alerts,public.soc_live_audit,public.soc_org_agents,
 public.soc_org_audit,public.soc_org_connectors,
 public.soc_org_memberships,public.soc_org_subscriptions,
 public.soc_organizations,public.soc_remediation_assessments,
 public.soc_remediation_audit,public.soc_subscription_catalog
 FROM soc_demo_reader_v1;

REVOKE ALL PRIVILEGES ON
 public.soc_demo_records,public.soc_ingest_credentials,
 public.soc_auth_throttle,public.soc_db_role_tenants,
 public.soc_remediation_audit
 FROM soc_live_reader_v1;

DO $$
DECLARE t text; key_col text;
BEGIN
 FOREACH t IN ARRAY ARRAY[
 'soc_live_alerts','soc_agent_runs','soc_ai_remediations',
 'soc_correlation_ai','soc_endpoint_heartbeats','soc_endpoint_inventory',
 'soc_live_audit','soc_remediation_assessments','soc_org_memberships',
 'soc_org_connectors','soc_org_agents','soc_org_subscriptions',
 'soc_org_audit','soc_organizations'
 ] LOOP
   key_col:=CASE
     WHEN t='soc_organizations' THEN 'id'
     WHEN t LIKE 'soc_org_%' THEN 'org_id'
     ELSE 'tenant_id'
   END;
   IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
     AND tablename=t AND policyname=t||'_live_reader_v1_policy') THEN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR SELECT TO soc_live_reader_v1 USING (%I = %L)',
        t||'_live_reader_v1_policy',t,key_col,
        '22222222-2222-4222-8222-222222222222');
   END IF;
 END LOOP;
END $$;
DO $$
BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public'
  AND tablename='soc_demo_records' AND policyname='soc_demo_records_reader_v1_policy') THEN
  CREATE POLICY soc_demo_records_reader_v1_policy ON public.soc_demo_records
   FOR SELECT TO soc_demo_reader_v1
   USING(tenant_id='11111111-1111-4111-8111-111111111111');
 END IF;
END $$;

-- Explicitly no policies grant these roles INSERT, UPDATE or DELETE.
-- Application credentials are stored only as encrypted Vercel environment values.
