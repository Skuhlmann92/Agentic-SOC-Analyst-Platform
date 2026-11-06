-- P0 transactional RLS acceptance checks, executed with the database owner.
-- Each SET LOCAL ROLE is scoped to its own transaction and reverts on COMMIT.
-- Run each block separately using Neon run_sql_transaction.
-- There must be no password or LOGIN attribute on either probe.
--
-- Demo probe expected: demo_rows > 0, organizations=1, live SELECT denied.
-- BEGIN;
-- SET LOCAL ROLE soc_rls_demo_probe;
SELECT current_user AS role,
  (SELECT count(*) FROM public.soc_demo_records) AS demo_rows,
  (SELECT count(*) FROM public.soc_organizations) AS own_org_rows,
  has_table_privilege(current_user,'public.soc_live_alerts','SELECT') AS can_read_live,
  has_table_privilege(current_user,'public.soc_demo_records','INSERT') AS can_mutate_demo;
-- COMMIT;
--
-- Live probe expected: live rows > 0, own_org_rows=1, inventories=2,
-- zero cross-tenant data and no INSERT/UPDATE/DELETE.
-- BEGIN;
-- SET LOCAL ROLE soc_rls_live_probe;
SELECT current_user AS role,
  (SELECT count(*) FROM public.soc_live_alerts) AS live_rows,
  (SELECT count(*) FROM public.soc_organizations) AS own_org_rows,
  (SELECT count(*) FROM public.soc_endpoint_inventory) AS inventory_rows,
  (SELECT count(*) FROM public.soc_live_alerts WHERE tenant_id <>
    '22222222-2222-4222-8222-222222222222') AS cross_tenant_rows,
  has_table_privilege(current_user,'public.soc_live_alerts','INSERT') AS can_insert,
  has_table_privilege(current_user,'public.soc_live_alerts','UPDATE') AS can_update,
  has_table_privilege(current_user,'public.soc_live_alerts','DELETE') AS can_delete;
-- COMMIT;
--
-- Both probes must be blocked from all non-granted tables.
-- CRITICAL: neondb_owner bypasses RLS. These tests DO NOT demonstrate that
-- the currently deployed application uses a restricted credential.
