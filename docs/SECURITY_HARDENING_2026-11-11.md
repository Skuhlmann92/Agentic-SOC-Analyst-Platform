# Security hardening iteration — 2026-11-11

Branch: `roadmap/security-hardening-20261111`. This is an implementation branch, not a production release.

## Delivered
- [x] Added `console/tests/auth-security-regression.test.mjs` with static regression guards for production sample-account exclusion, server-side admin password configuration, timing-safe comparison, throttling and cookie flags.
- [ ] Run CI and validate tests on this branch. No green build or deployment is claimed.

## Fortschritt 11.11.2026 (Draft PR #9)
- [x] Im Branch: RFC-6238-Admin-TOTP mit 6-stelligen Codes, serverseitiger Prüfung und atomarer PostgreSQL-Replay-Sperre.
- [x] `mfaVerifiedAt` in Administrator-Sessions sowie Login-Eingabefeld und Tests; CI #164 erfolgreich.
- [x] Neon-Staging: Migration 008 (Tabelle) und Migration 009 (NOLOGIN-Rollenkandidat) angewendet; SQL-Counter-Test und PostgreSQL-ACL-Prüfung erfolgreich.
- [ ] Noch offen: Test unter echten eingeschränkten LOGIN-Credentials, sichere Provisionierung eines TOTP-Secrets im Preview, authentifizierter E2E-Test, Recovery und produktiver Release.
- [ ] Per-User-MFA mit Reset/Audit/Recovery-Codes bleibt unimplementiert.

## P0 — Authentication
- [ ] Replace shared administrator password with per-user identities, salted password hashing (Argon2id), user lifecycle and recovery.
- [ ] Add server-side TOTP enrollment with verified challenge, encrypted TOTP secrets, one-time recovery codes stored as hashes, replay protection, rate limiting, audit and forced MFA for administrators.
- [ ] Session must record verified MFA assurance; middleware and every sensitive API action must enforce it, including direct API calls. Revoke sessions on MFA reset and credential change.
- [ ] Distinguish demo and production sessions; demo cannot reach live tenant or administrative APIs.
- [ ] Add negative E2E tests: MFA bypass, expired challenge, TOTP replay, session tampering, login brute force, CSRF and cross-tenant access.

## P0 — Database isolation
- [ ] Verify current production deployment SHA, environment flags and actual DB roles; never assume historical roadmap claims are current.
- [ ] Authenticated preview E2E with restricted Neon read role across alerts, timeline, cases, inventory, membership and demo.
- [ ] Replace owner/BYPASSRLS credentials with restricted service roles for write and ingest, including transactional audit and rollback.
- [ ] Re-run tenant isolation tests with two real tenants and explicit negative authorization cases.

## P0 — Release gate
- [ ] `npm ci`, unit tests, lint, production build, dependency audit, secrets scan, SAST and API authorization tests.
- [ ] Manual desktop/mobile keyboard and German-language QA.
- [ ] Backup restore drill, log retention and GDPR data handling review.
- [ ] Only merge and deploy after passing checks; do not activate paid subscriptions or customer onboarding.

## P1 — Analyst workflow
- [ ] Server-side unified task queue with cursor pagination, stable ordering, assignees and SLA.
- [ ] Provenance-aware incident timeline, host enrichment, safe remediation review, and audit-backed case closure.
- [ ] Source freshness indicators for Wazuh, n8n and asset inventory.
