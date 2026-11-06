# Agentic SOC Analyst Platform — Commercial Readiness / P0 Audit

Audit date: 2026-11-05 (Europe/Berlin). Scope: existing Vercel Next.js console, Neon PostgreSQL, Raspberry Pi Wazuh Manager, Windows agent, Claude endpoint. This document differentiates verified observations from code-only changes and untested integrations.

## Baseline — verified
- Vercel latest observed production release before P0 work: READY; newer P0 commits cannot yet be published because Vercel API returned HTTP 402 `api-deployments-free-per-day` (>100 deployments in 24h). Do not claim the new P0 protections are live before a new READY deployment with the latest Git SHA.
- Neon connection checked successfully; 808+ pre-existing live events stored under `22222222-2222-4222-8222-222222222222`. Public demo data uses `11111111-1111-4111-8111-111111111111`.
- Raspberry Pi Wazuh Manager active. Windows Wazuh service was reported active; exact Wazuh Manager API registration/status and complete Syscollector/CVE coverage not independently verified in this audit.
- Two signed local inventory snapshots contain installed package/software metadata, OS and hardware data. These are NOT full Wazuh Syscollector inventories. No source-verified CVE mapping exists.
- Dashboard already implements hour/minute time series, Europe/Berlin presentation, multilingual controls and light/dark appearance. Some pages remain partly English; E2E browser testing pending.
- Claude Sonnet 5.5 API integration uses `output_config.format` with `json_schema` and no `temperature`, consistent with current Anthropic docs. Key is configured in Vercel. No paid API calls were made in this audit; successful end-to-end script generation has NOT been established.
- Remediation is draft/review only, no automatic execution. Powershell AST verification and independent remote runner are still missing.

## P0 implemented in code, tested in CI
- `tenant-policy.ts`: explicit allowlist for public read-only demo and legacy live workspace, deny unknown tenants, reject forged role/tenant combinations.
- Existing `/api/platform/... ` path no longer routes arbitrary signed tenant sessions to the old generic backend proxy. Legacy live path additionally verifies an active administrator membership in Neon.
- Production local test accounts are disabled and hard-coded sample passwords removed; production requires a configured `CONSOLE_SESSION_SECRET`. Database-backed administrator login-attempt throttling now exists (30 attempts per 15 minutes per derived fingerprint). Still add managed edge/WAF limits in a later phase.
- Browser security headers: HSTS, X-Frame-Options DENY, nosniff, referrer policy, restricted permissions, CSP frame-ancestors/object-src/base-uri. Cross-origin browser API mutations rejected.
- CI: GitHub Actions runs tenant/demo/role-boundary tests and Next.js build. Test runner passed on commit e1dbc367 (previous workflow attempts failed because console/package-lock.json predates Neon dependency). CI temporarily uses npm install until lockfile is regenerated.
- Additive PostgreSQL tables: organizations, memberships, connector definitions, agent mappings, subscription plans/subscriptions, organization audit, login throttle. Legacy live and public demo orgs seeded; original SOC records not modified.
- The Essential / Professional / Business catalog is seeded as 14900/34900/69900 euro cents monthly, limits 15/50/150 endpoints respectively. NO active subscription, Stripe account connection, payment charge or external service enabled.

## P0 RLS migration — 2026-11-06
- Added `console/db/migrations/002_tenant_rls_canary.sql` and `003_expand_rls_tenant_tables.sql`.
- On the existing Neon branch, enabled RLS on **15 tenant-bearing SOC tables** without `FORCE ROW LEVEL SECURITY`. This does **not** alter rows or revoke production owner access.
- Created two `NOLOGIN NOBYPASSRLS NOINHERIT` canary roles with separate read-only privileges and explicit legacy-live/demo policies.
- Verified in transaction-scoped `SET LOCAL ROLE` tests: demo-only access to 46 demo records, live-only access to 827 live alerts and two endpoint inventories; both see only their own organization; 0 cross-tenant rows; denied attempts to read the opposite tenant's table; INSERT/UPDATE/DELETE privileges absent.
- Canary role membership was granted to the database owner for controlled testing. Do not hand canary privileges to external parties or use them as application credentials.
- **Critical remaining risk:** `neondb_owner` is `BYPASSRLS` and is still the serverless application's production database connection. Therefore this is a proven RLS canary, **not production customer isolation**. Move to scoped non-owner database identities, test API reads/writes/ingest per tenant and customer invitations, and only then mark RLS P0 complete.
- Automated application tests and Next builds were green on the latest tested migration commit; see GitHub Actions. A live authenticated browser E2E session was not exercised.

## P0 blocking items BEFORE onboarding external paying customers
1. **Release blocker:** publish latest security changes to Vercel when deployment quota/plan allows, verify release SHA and protected API responses. No paid plan changes without approval.
2. **True PostgreSQL tenant isolation:** introduce least-privileged service roles and row-level security, transaction-scoped tenant context, tenant-scoped ingest credentials and encrypted secrets; verify malicious cross-tenant read/write attempts against DB and APIs. The current DB owner still has broad database access. The current production ingest token is single-tenant.
3. **Real identities:** implement password-hashed/SSO-backed users, email verification, single-use expiring invite hashes, identity-based session revocation, customer roles and privileges on *every* route. New customer sessions stay disabled meanwhile.
4. **Stable deployment pipeline:** regenerate and commit synced package-lock; require passing tests/build before release, avoid automatic flood of Vercel deployments; keep secrets out of logs.
5. **Full Wazuh data assurance:** secure Wazuh Manager API connector, agent-to-tenant binding, syscollector, SCA, FIM and vulnerability detection coverage; source-tag everything; verify transfer and completeness.
6. **Claude validation:** controlled API test with explicit budget approval; handle errors, truncation, timeouts, secrets/prompt injection. Keep unsafe remediation execution disabled.
7. **Recovery/security:** actual backup/restore drill, rate limits for ingest and compute, dependency and secrets scanning, privacy retention/deletion and legal terms, production observability, real browser E2E tests.

## P1 — after P0 gates
- Subscription entitlement service: enforce endpoint count and AI quotas on server; test/trial and expiry states.
- Stripe integration as *disabled-by-default* adapters, tested with mocks only; activate payments only after explicit user approval.
- Guided organization onboarding (create, invite, Wazuh setup, enroll, connectivity test, security posture, first report).
- Verified executive reporting and customer-brandable PDF export with auditable measurements rather than fictional savings.
- Commercial workspace navigation (assets, vulnerabilities, incidents, AI analyst, remediation, reports, org settings, billing).

## P2 — after P1
- Threat-correlation quality and rich host/user/network graphs; safe human-approved remediation executor and rollback.
- White label, resellers, scaled workload queues, per-customer retention and service-level observability.
- Restore tests, tenant onboarding E2E and external penetration test before general availability.

## Release policy
Never create payments, paid resources, unmanaged remote execution, or automatically provision a new customer until explicit authorization and the listed isolation checks pass.
