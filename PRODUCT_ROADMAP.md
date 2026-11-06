# Agentic SOC Analyst Platform — Product & UX Roadmap

Updated: 2026-11-06. Source of truth for this change: PR for `feature/smart-review-bulk-grouping`.

## Implemented in this branch (requires CI and merge)

- **#3 Evidence-based review recommendation**: Every pending draft in the review queue carries a deterministic recommendation (`rules_v1`) with cited stored evidence and an explanation. **Not yet an LLM verdict**: confidence percentages or "false positive" conclusions are intentionally not invented. Human approval is mandatory.
- **#4 Bulk review decisions**: Select 2–20 pending drafts of the same correlation group. The server verifies the group and atomically commits all draft transitions or none. Confirmation is explicit; there is no script execution or automatic remediation.
- **#5 Correlated alert groups**: Read-only group proposals based on identical host, rule, source and one-hour UTC bucket, covering the previous seven days regardless of the current alert page. The review queue displays grouped approvals; the alert explorer supports group drill-down. **Groups are not confirmed incidents.**

## Next milestones

| ID | Priority | Feature | Acceptance criteria |
| --- | --- | --- | --- |
| 1 | P0 | Fast review keyboard shortcuts | A/R/N/P work outside text fields; confirmation for destructive operations; accessible focus states and no accidental submissions |
| 2 | P0 | Smart review ordering | Configurable risk score combining severity, asset criticality, incident confidence and age; stable pagination with clear explanations |
| 6 | P1 | Incident timeline | Windows Event 7040/7045, 4688, Sysmon, auth events and networking merged by verified time/source; explicit provenance and missing-data markers |
| 7 | P0 | One-click context enrichment | Fetch correlated host/user/indicator history and asset vulnerabilities on demand; scoping, query limits and privacy controls |
| 8 | P1 | Safe remediation scripts | Read-only diagnostics by default; human-reviewed code, dry-run where supported, validated signatures and role-based execution guard |
| 9 | P1 | Assisted case closure | Generate cited final summary; require deliberate closure and audit record; never close on recommendation alone |
| 10 | P1 | Signal-driven notifications | High-priority immediate alerts, grouped digests, escalation policy, anti-spam limits and role-aware delivery |
| 11 | P0 | Complete review audit trail | Actor identity from authenticated session (not hardcoded); append-only decision events, request IDs, timestamps, decision provenance and access review |
| 12 | P2 | Feedback loop for recommendations | Compare analyst decisions to suggestions; version rules/models; drift and precision monitoring; human-reviewed updates |

## Commercial hardening required before B2B production

- Replace generic `SOC Administrator` decision attribution with actual authenticated actor, enforced permissions and separation-of-duties.
- Test concurrent bulk/individual approvals and explain partial failures; bulk endpoint must be audited and rate-limited.
- Add an optional grounded LLM recommendation service behind an explicit opt-in and provider credential. Validate model output against stored evidence, log model/version and never treat reported confidence as calibrated probability. Fall back to `rules_v1` if unavailable.
- Benchmark 7-day grouping and add DB indexes/retention if required; extend grouping only with validated causal indicators and deduplicate reliably.
- GDPR: data retention, purpose limitation and least-privilege access to command lines and identity/IP metadata.
- Provide backend integration tests for groups, bulk atomicity, tenant isolation and user interface flows.

No unreviewed automatic approvals, isolation or remediation operations are planned.
