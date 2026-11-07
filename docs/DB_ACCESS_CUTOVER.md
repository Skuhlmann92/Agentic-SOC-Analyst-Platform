## Verified P0 read-only login credentials — 2026-11-07

**Implemented and tested, NOT enabled on the production website.**

- Neon main branch `br-flat-cake-bcruq472`, database `neondb`: created actual `LOGIN` identities `soc_live_reader_v1` and `soc_demo_reader_v1` using Neon scoped `read_only` access (not `neon_superuser`). Both are `NOSUPERUSER`, `NOBYPASSRLS`.
- Added tenant-bound SELECT policies across 14 live tables and a demo-only policy on `soc_demo_records`. Revoked access to the opposite tenant's tables and protected credential/throttle/audit tables. Source-controlled as `007_restricted_login_readers.sql`. No existing alerts or software inventories were modified.
- Direct SQL queries **authenticated as these actual roles**: live reader sees **2,290 alerts** and two inventory rows; demo reader sees **46 demo records**; cross-tenant SELECT attempts raise PostgreSQL `42501 permission denied`; live role has no INSERT/UPDATE and cannot SELECT credential hashes.
- Vercel production now stores the two connection URLs as **encrypted environment values** `SOC_READ_DATABASE_URL` and `SOC_DEMO_READ_DATABASE_URL`. Production `SOC_READ_DB_ENABLED` remains **unset/off**.
- Vercel preview stores independent encrypted read URLs with `SOC_READ_DB_ENABLED=true` and runs test branch `test/restricted-read-20261107`. Preview deploy `dpl_Bf1PfbvKGjvnNnccjCgzRG8NAnVw` built **READY**; preview `/api/health/database` HTTP 200/connected, `/demo` HTTP 200. No preview runtime errors were reported in the sampled error log window.
- **Testing limitation:** An authenticated frontend/API round-trip through the preview session was not completed; an unauthenticated private API correctly returned HTTP 401. Do not enable production read-only flag before authenticated `/api/platform` route tests, particularly `/api/v1/search/alerts`, timeline, cases, and membership guard.
- Production `https://soc.samuelkuhlmann.com/api/health/database` returns HTTP 200 connected and the `/dashboard` page returns HTTP 200 at this checkpoint. Production continues with its existing database credentials.

Next release gate: authenticated preview end-to-end verification with the actual read-only login; verify demo API after demo sign-in, alert list/detail/time series, membership checks, and private inventory; only then activate the **read-only** production flag. The ingest/write owner cutover is still a separate, higher-risk migration.

# P0 Database Access Cutover — staged and reversible

Status: **prepared, NOT enabled**. No external customer data should be ingested yet.

## 1. Verified current prerequisites
- Current Neon project remains the source of truth. Existing live telemetry, two inventory snapshots, demo marker and agent run records are retained.
- Runtime schema initialization has been removed from live events, automated triage, demo GET, remediation GET/POST, correlation review, endpoint health/inventory and remediation review. See `006_runtime_ddl_to_migrations.sql`.
- PostgreSQL Row-Level Security (RLS) is enabled on the existing tenant tables, but **production continues using the privileged `neondb_owner`** until credential separation and mutation tests are complete.
- Read-only, no-login `soc_live_dashboard_candidate` and no-login demo probe are available for transaction-scoped Neon tests.
- No new paid account, Stripe integration or external ingestion token is activated.

## 2. Connection roles and flags

| Purpose | Configuration | Current behavior | Expected future role |
| --- | --- | --- | --- |
| Live dashboard and other GET routes | `SOC_READ_DB_ENABLED=true`, `SOC_READ_DATABASE_URL` | Old URL unless enabled | verified read-only live tenant role |
| Public demo GET | `SOC_READ_DB_ENABLED=true`, `SOC_DEMO_READ_DATABASE_URL` | Old URL unless enabled | independently scoped demo-only read role |
| Wazuh ingestion | `SOC_INGEST_DB_ENABLED=true`, `SOC_INGEST_DATABASE_URL` | Old URL unless enabled | verified live ingest/triage worker role |
| Data mutations and audit | `POSTGRES_DATABASE_URL` | Owner connection | yet-to-be-defined least-privileged mutation role |
| Schema migration | operator-driven SQL scripts | owner connection | separate privileged migration identity |

These flags default to **off**. Enabling a flag without its URL fails closed.
Opt-in URLs reject obvious privileged login names, but a username check is **not** a PostgreSQL grant or RLS guarantee. Database role verification is mandatory before switching.

## 3. Acceptance criteria before setting any flag
1. Provision new per-environment PostgreSQL **LOGIN** identities with `NOBYPASSRLS`, no owner/admin membership, and grants scoped to their respective tenant workloads. Never expose credentials in source control, logs or browser.
2. Confirm `current_user`, `rolbypassrls=false`, `has_table_privilege` for expected reads/writes, and cross-tenant query isolation under the **actual login credentials**.
3. Verify live alert list/detail/timeline, membership check, inventory, heartbeat GET, remediation listing, correlation listing and public demo through the intended read-only roles. Test a cross-tenant rejection, not just an empty table.
4. Adapt existing ingest internals: today's `INSERT ... RETURNING id`, automated triage read/insert, status updates, audit writes and on-conflict inventory updates need carefully scoped worker/mutation roles. Simple append-only INSERT permission does **not** cover these operations.
5. Add transaction-safe audit handling and service-to-tenant identity binding; separate credential resolver from tenant data storage.
6. Add E2E tests with a real authenticated browser session and recorded release SHA, and confirm a fresh Wazuh event actually enters Neon after any role switch.
7. Deploy to staging first; change only one credential flag at a time. Back up/restore proof, monitoring, and rollback must exist.

## 4. Safe rollback
- Set `SOC_READ_DB_ENABLED=false` and/or `SOC_INGEST_DB_ENABLED=false`; redeploy known-good commit.
- Do not delete tables, policies, tenant mappings or existing data.
- Observe ingestion freshness, authentication and API status after rollback.
- Do not regard rollback to owner access as sufficient for customer isolation; onboarding remains blocked.

## 5. Remaining blockers
- No customer-grade login roles or independently tested restricted Vercel credentials yet.
- Some ancillary APIs still use the legacy writer for POST mutations and require further classification.
- Wazuh Manager Syscollector/CVE data and Claude end-to-end generation have not been verified.
- No billing activation has occurred. Stripe must remain disabled pending explicit approval.
