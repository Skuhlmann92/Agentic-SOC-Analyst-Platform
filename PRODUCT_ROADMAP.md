# Agentic SOC Analyst Platform — Product & UX Roadmap

Updated: 2026-11-06. Features #3–#5 were merged and deployed via PR #3. Subsequent UX and localization work is tracked below.

## Implemented in production (merged into main)

- **#3 Evidence-based review recommendation**: Every pending draft in the review queue carries a deterministic recommendation (`rules_v1`) with cited stored evidence and an explanation. **Not yet an LLM verdict**: confidence percentages or "false positive" conclusions are intentionally not invented. Human approval is mandatory.
- **#4 Bulk review decisions**: Select 2–20 pending drafts of the same correlation group. The server verifies the group and atomically commits all draft transitions or none. Confirmation is explicit; there is no script execution or automatic remediation.
- **#5 Correlated alert groups**: Read-only group proposals based on identical host, rule, source and one-hour UTC bucket, covering the previous seven days regardless of the current alert page. The review queue displays grouped approvals; the alert explorer supports group drill-down. **Groups are not confirmed incidents.**

## P0 — Vollständige deutsche Lokalisierung (DE-DE)

**Verbindlicher Meilenstein vor kommerziellem B2B-Release:** Die gesamte nutzerseitige Plattform muss vollständig und konsistent in deutschem Deutsch (de-DE) verfügbar sein; Englisch bleibt als umschaltbare Sprache erhalten. Der aktuell gemischte deutsch/englische Stand ist **nicht** als abgeschlossen zu betrachten.

**Umfang und Abnahmekriterien:**

1. Sämtliche Oberflächen: Dashboard, Navigation, Alerts, Incident- und Case-Ansichten, Asset-Inventar, Benutzer-/Rollenverwaltung, Freigaben, Bulk Actions, Alert-Gruppen, KI-Empfehlungen, Reports, Einstellungen, Onboarding und Hilfen.
2. Alle Interaktionstexte einschließlich Buttons, Filter, Tabellentitel, Status, Eingabevalidierung, Lade-/Leermeldungen, Fehlerdialoge, Bestätigungen, Benachrichtigungen, Tooltips, Platzhalter und Barrierefreiheitsbeschriftungen.
3. KI- und Automationsausgaben: deutschsprachige Zusammenfassungen, Evidenzbegründungen, Incident-Berichte, Remediation-Hinweise, Freigabevorschläge und Sicherheitswarnungen. Maschinell generierte Inhalte müssen fachlich überprüfbar sein; technische Indikatoren, Ereignis-IDs und Quellbelege bleiben unverändert.
4. Durchgängiges Internationalisierungssystem (i18n) mit zentral gepflegten Übersetzungsschlüsseln, Fallback-Verhalten und vollständiger Sprachumschaltung ohne verstreute hartcodierte UI-Texte.
5. Deutsche Datums-, Zeit-, Zeitzonen-, Zahlen- und Formatkonventionen (de-DE / Europe/Berlin), ohne UTC-Zeitstempel oder API-Daten zu verfälschen.
6. Glossar für IT-/SOC-Fachbegriffe und einheitliche Terminologie (z. B. Sicherheitsmeldung, Freigabe, Vorfall, Schweregrad). Eigennamen und standardisierte Begriffe wie CVE, MITRE ATT&CK oder Wazuh bleiben bei Bedarf im Original.
7. Automatisierte Prüfungen für fehlende Schlüssel und sprachabhängige UI-Tests (inklusive Responsive Design, Überlängen, Tastatur- und Screenreader-Bedienung). Abnahmeprüfung aller Seiten und typischen Workflows in Deutsch.
8. Auch Benutzer-Dokumentation, Setup-Anleitungen, Sicherheitshinweise, Datenschutzhinweise und Kundenkommunikation vollständig auf Deutsch bereitstellen; technische Entwicklerdokumentation kann zusätzlich Englisch enthalten.

**Definition of Done:** Keine ungeplanten englischen nutzersichtbaren Zeichenketten im deutschen Modus; alle Seiten und relevanten Fehlerszenarien durchgetestet; keine regressiven Änderungen am englischen Modus; Freigabe durch fachliche und sprachliche QA.

## Umsetzungsschritt November 2026 — Freigaben-UX (P0-Teilumfang)

- [x] **#1 Tastaturbedienung im Freigabe-Workflow:** A = Genehmigen, R = Ablehnen (beide mit ausdrücklicher Bestätigung), N/P = Nächste/Vorherige Freigabe. Während der Texteingabe und laufenden Entscheidungen deaktiviert. Ausführung wird bei fehlender oder bereits entschiedener Freigabe unterbunden.
- [x] **DE-DE-Teilumsetzung:** Freigabeansicht mit deutsch-/englischsprachigen UI-Texten, einschließlich Bedienungshinweisen, Fehlermeldungen, Tabellenbeschriftungen und Entscheidungsstatus. **Die vollständige Plattformlokalisierung bleibt offen.**
- [ ] **#1 Abnahme:** Browser-/Tastatur-Tests für Fokuswechsel, Modaldialoge, Mehrfachaktionen, Screenreader sowie Produktiv-Rollen.
- [ ] **DE-DE Gesamtumfang:** Weitere Oberflächen, Serverfehler, automatisch generierte Analystentexte, Bestätigungsmeldungen, zentrale i18n-Schlüssel und vollständige Sprach-QA.
- [ ] **#2 Smart Review Ordering:** Nach dem UX-Grundgerüst als separater Schritt mit nachvollziehbaren Risikoscores und stabiler Queue implementieren.

## Next milestones

| ID | Priority | Feature | Acceptance criteria |
| --- | --- | --- | --- |
| DE | P0 | Vollständige deutsche Lokalisierung | Gesamte Oberfläche, Meldungen, KI-Ausgaben und Dokumentation in de-DE; automatisierte Schlüsselprüfung und Sprach-QA |
| 1 | P0 | Fast review keyboard shortcuts | **Implementiert (erste Version)**; Browser-/Screenreader-Abnahmetests noch offen |
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
