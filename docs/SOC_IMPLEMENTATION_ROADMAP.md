# Commercial Readiness — P0/P1/P2

## Sicherheits-Fortsetzung 11.11.2026 — Draft-PR #9

- [x] Im Branch `roadmap/security-hardening-20261111`: TOTP-Verifikation für Administratorzugänge, Datenbank-Replay-Schutz, signierter MFA-Nachweis in Sessions und Eingabe im Login. Technische Anleitung: `docs/ADMIN_TOTP_ROLLOUT.md`.
- [x] Unit- und statische Sicherheitsregressionstests ergänzt; GitHub Actions Run #157 (Tests + Produktionsbuild) erfolgreich.
- [x] Migration 008 am 11.11.2026 auf Neon-Staging `security-2fa-validation` angewendet; Schema und atomare Countersperre (temporäre Testtabelle, ohne produktive Daten) geprüft.
- [ ] Dedizierte Auth-DB-Rolle konfigurieren und den Preview-Login mit echten TOTP-Codes prüfen (Staging-Migration 008 bereits angewendet).
- [ ] Vollständige MFA-Recovery, per-User-Enrollment, Reset-Audit und browserbasierte E2E-Abnahme. Kein Kunden-Onboarding vor Freigabe.
- [ ] Erst nach Freigabe in `main` mergen und separat auf Vercel veröffentlichen; Produktionsumgebung bisher unverändert.

Aktuelle technische Bestandsaufnahme und Prüfergebnisse: [COMMERCIAL_READINESS_AUDIT.md](./COMMERCIAL_READINESS_AUDIT.md).

## Release-Stand 06.11.2026
- [x] Runtime-DDL-Bereinigung, separates `database-access.ts`, eigene Live-/Demo-Leser und Ingest-Zugangsrouten im Code; Testfälle gegen Schemaänderungen im Requestpfad und fehlerhaft konfigurierte URLs.
- [x] Neon-Kandidatentest: read-only Rolle liest 858 Live-Alerts, zwei Inventare, eine aktive Mitgliedschaft, Agentenläufe und Heartbeats; geprüfte RLS-Rechte unverändert.
- [x] GitHub Actions: neue DB-/RLS-/Mandanten- und Ingest-Tests sowie Next.js-Produktionsbuild erfolgreich (Commit `a568fe2d`).
- [ ] **Aktueller Release-Blocker:** Manuelle Veröffentlichung des neuesten GitHub-Standes von Vercel mit HTTP 402 `api-deployments-free-per-day` verweigert. Nicht als live markieren. Keine kostenpflichtige Freischaltung ohne ausdrückliche Genehmigung.
- [ ] **Vor Umschaltung** aktuelle Server-Owner-Verbindung durch tatsächlich eingeschränkte LOGIN-Rollen ersetzen, deren Rechte und API-Zugriffe im Staging prüfen; danach reproduzierbaren End-to-End-Test und Rollback durchführen.
- [ ] `docs/DB_ACCESS_CUTOVER.md` als verbindlichen Prüfkatalog benutzen.

## P0-Fortschritt 07.11.2026 — echte PostgreSQL-RLS-Logins
- [x] Zwei echte, nicht privilegierte Neon-Leser `soc_live_reader_v1` und `soc_demo_reader_v1` angelegt und mit RLS-Policies streng an Live-/Demo-Mandanten gebunden. Test mit den **echten Loginkonten**: 2.290 Live-Alerts, zwei Inventare, 46 Demodatensätze; gegenseitiger Tabellenzugriff verweigert, fremde Zeilen null, kein INSERT/UPDATE und kein Lesezugriff auf Connector-Secrets.
- [x] Separate Datenbank-URLs verschlüsselt bei Vercel hinterlegt. Produktionsschalter `SOC_READ_DB_ENABLED` bleibt ausdrücklich deaktiviert.
- [x] Separater GitHub-Testbranch `test/restricted-read-20261107` mit aktiviertem Read-only-Schalter **nur in Vercel Preview**. Preview-Build READY, Health-Check HTTP 200 und Demo-Seite HTTP 200. Produktionsdomain weiterhin HTTP 200.
- [ ] **Gate zur Produktivaktivierung:** Authentifizierte Preview-Abfragen über tatsächliche Dashboard-API auf Alerts, Timeline, Fälle, Inventar, Membership und Demo testen. Bis dahin keine Aktivierung des Produktionsschalters.
- [ ] **Danach:** privilegierte Schreib-/Ingest-Verbindung ablösen, Write-Operations inklusive Audit/Agent-Triage transactionssicher trennen und echte mandantenspezifische Dateneingänge erproben.

## P0 — Sicherheit / Datenintegrität / Mandantentrennung
- [x] Additive Neon-Datenmodelle für Organisation, Mitglieder, Connectoren, Agent-Zuordnung, Audit, Tarife (149/349/699 EUR) und inaktive Subscriptions; bestehende Records unberührt.
- [x] Live/Demo-API-Grenze im Code fail-closed für unbekannte Mandanten; private Live-API prüft aktive Org-Mitgliedschaft. Session-Secret und Test-Account-Absicherung, Login-Throttle, API-Origin-Prüfung, Browser-Sicherheitsheader.
- [x] Automatisierte Rollen-/Tenant-Grenztests und Next-Produktionsbuild als CI-Workflow.
- [ ] **Release-Verifikation:** Das frühere Vercel-Tageslimit (HTTP 402) hat neue Releases blockiert; automatische Deployments laufen inzwischen wieder an. Neuesten SHA auf der Produktionsdomain, authentifizierte Dashboard-Abfragen und alle P0-Schutzmaßnahmen vollständig prüfen.
- [x] **RLS-Staging auf Neon:** 15 mandantenbezogene SOC-Tabellen mit RLS versehen. NOLOGIN/NOBYPASSRLS/NOINHERIT-Testrollen sind per SELECT-Policy an jeweils nur einen Bestandsmandanten gebunden. Getrennte Transaktionstests: 46 Demo-Records, 827 Live-Alerts und zwei Live-Inventare sichtbar; fremde Tabellen verweigert, fremde Zeilen 0, Schreibrechte 0.
- [x] **P0 Rolle- und Ingest-Staging (2026-11-06):** Zwei weitere NOLOGIN/NOBYPASSRLS-Rollen erstellt: `soc_live_dashboard_candidate` mit mandantengebundenen reinen Leserechten; `soc_live_ingest_candidate` mit ausschließlich INSERT-Berechtigung auf Live-Alerts. Neon-Prüfung: 855 Live-Alerts + zwei Inventare read-only; kein Demo-Zugriff; Ingest keine SELECT/UPDATE/DELETE-Rechte.
- [x] **Connector-Token-Vorbereitung:** Tabelle `soc_ingest_credentials` mit Token-SHA-256, Organisations-/Connector-Fremdschlüssel, Ablauf- und Sperrstatus sowie RLS. Authentifizierung und registrierte Wazuh-Agent-IDs serverseitig geprüft; Client-Felder `tenant_id` und `source` bestimmen den Mandanten nicht. Neue Mandanten-Ingests standardmäßig **deaktiviert** (`SOC_MULTI_TENANT_INGEST_ENABLED` muss explizit gesetzt werden). 0 kundenspezifische Tokens aktiviert, keine Zahlungsaktivierung.
- [x] **P0 Runtime-DDL-Entkopplung:** Schema-DDL aus Live-/Demo-/Agent-/Heartbeat-/Inventar-/Claude-/Audit-Endpunkten entfernt. Additive Migration `006_runtime_ddl_to_migrations.sql` erstellt; die vorhandenen Tabellen/Indizes und der Demo-Marker wurden vor der Umstellung in Neon geprüft.
- [x] **Vorbereitung eingeschränkter DB-Verbindungen:** Live-GET (inkl. Alert-, Fall- und Zeitverlaufsabfragen), öffentliche Demo, Inventar, Heartbeats, Korrelations- und Remediation-GETs sowie Membership-Guard auf einen opt-in SQL-Client mit getrennten URLs umgestellt. Flags `SOC_READ_DB_ENABLED` und `SOC_INGEST_DB_ENABLED` weiterhin **aus**; fehlende URLs führen bei Aktivierung zum Fehler statt einem Rückfall auf den Owner. Testfälle für DB-Zugangswahl und Runtime-DDL-Rückfälle hinzugefügt.
- [x] **Read-only-Rollentest:** Die eingeschränkte Live-Rolle kann echte Alert-, Inventar-, Mitgliedschafts-, Zeitverlaufs-, Triage- und Heartbeat-Abfragen lesen. Es wurden keine Daten migriert, gelöscht oder geändert.
- [ ] **Wichtige produktive Umstellung weiter offen:** Die Produktion nutzt noch `neondb_owner`; getrennte tatsächliche LOGIN-Credentials, vollständige Berechtigungen für Alert-Status, Ingest `RETURNING`, automatische Triage, Audit- und Inventar-UPSER­Ts, authentifizierte E2E-Tests und Staging-Rollback fehlen. Daher keine Customer-Onboarding-Freigabe. Siehe `docs/DB_ACCESS_CUTOVER.md`.
- [ ] **Kritisch vor Kundenbetrieb:** Die produktive Verbindung verwendet weiterhin `neondb_owner` (BYPASSRLS); daher RLS für Produktions-App noch NICHT durchgesetzt. Sichere tenant-spezifische Service-Credentials/DB-Rollen, echte Membership- und Ingest-Zuordnung, API-Schreibrechte, Rollback und E2E-Tests sind weiterhin erforderlich. Kein Kunden-Onboarding freigeben.
- [ ] Next.js package-lock reparieren; CI von temporärem npm install zurück auf reproduzierbares npm ci.
- [ ] End-to-End Claude/Wazuh-Syscollector-Sicherheit, Datenvollständigkeit, Secrets/Dependency Scanning, Backup- und Restore-Tests, Logging/Retention/DSGVO.

## P1 — Kommerzielle Funktionen
- [x] Tarifkatalog und Subscription-Datenmodell ohne Zahlungsaktivierung angelegt.
- [ ] Serverseitige Endpoint- und KI-Kontingente, Pilot-/Testlizenzen, Stripe-Testadapter und Webhook-Verifikation; **keine Zahlungen ohne Freigabe**.
- [ ] Sichere Organisations-Einladung und geführtes Kunden-Onboarding.
- [ ] Messbare Executive Reports, wöchentliche/monatliche Zeitpläne, gebrandeter PDF-Export.
- [ ] Commercial Dashboard (Organisation, Billing, Assets, Vulnerabilities, Remediation, Reports).

## P2 — Automatisierung / Skalierung
- [ ] White-Label, Verteilungs- und Datenhaltungsstrategie, Warteschlangen/SLA, qualitätsgesicherte Korrelation, sichere Remote-Remediation nach gesonderter Freigabe.

---

# Agentic SOC Platform – verbindliche nächste Arbeitsschritte

Stand: 2026-11-05. Nutzerauftrag: Nach den jetzt umzusetzenden Schritten auch die übrigen Verbesserungen umsetzen. Nicht als abgeschlossen markieren, bevor umgesetzt und geprüft.

## In dieser Iteration
- [x] Security Posture Dashboard (erste produktive Stufe): echte CIS-SCA-Checks aus Wazuh-Alerts je Host, Regel und Beschreibung, nachgewiesene SCA-Summary-Werte, direkte Belege und offener Integrationsstatus.\n- [x] **Signiertes Systeminventar, Stufe 1:** Windows-Registrierung (maschinenweit) und Debian dpkg-Query liefern Softwarepakete, Versionsnummern, Betriebssystem, CPU/RAM über getrennte Endpoint-Tokens an Neon. Geschütztes Dashboard `/inventory`, DE/EN, Filter, Zeitstempel; automatische Erfassung alle 6 Stunden. Quelle klar als `local_signed_inventory` gekennzeichnet. Keine Ausführung von Remediation-Skripten.\n- [ ] **Posture komplettieren:** Wazuh Manager API sicher anbinden und die vollständigen SCA-Checks, CVE/Vulnerability Detection, FIM sowie Syscollector-Inventar verlässlich integrieren. Aktueller Termalin-Linux-Account hat keinen autorisierten Zugriff auf die Wazuh-API-Zugangsdaten. Keine CVEs oder Scores erfinden.
- [x] Automatische regelbasierte Alert-Korrelation nach Host, Regel und UTC-Stundenfenster; CIS-Checks separat, verlinkte Beleg-IDs. Optionaler Claude-Korrelationsentwurf pro Fall (Bestätigung und unabhängige Prüfung erforderlich).\n- [ ] **Qualität weiter steigern:** Deduplizierung pro Check-ID und Status statt ausschließlich Alert-Titel, Persistenz von Fallstatus/Analystenentscheidungen, korrelationsübergreifende Host-/User-/Netzwerkgraphen.

## Danach – noch offen (Reihenfolge)
1. [ ] **Interaktive Zeitfilter & Drill-down**: Zeitbereich per Drag/Brush, Drill-down Host/Regel-Level/Quelle/MITRE, URL-State, UTC intern und Europe/Berlin UI.
2. [ ] **Live-Endgeräteübersicht**: tatsächlicher Wazuh-Agentstatus, letzte Verbindung, Version, OS/IP, Host-Risiken und offene Maßnahmen. Nicht aus Alert-Empfang allein „online“ behaupten.
3. [ ] **Kontrollierte PowerShell-Remediation über Termalin**: AST/Syntaxprüfung, statische Risikoanalyse, Administratorfreigabe, erlaubte Hosts und Befehle, Dry-Run/WhatIf, Audit-Trail, Rollback und Erfolgskontrolle. Keine ungeprüfte automatische Skriptausführung.

## Qualitätskriterien
- Live/Demo strikt getrennt.
- Kein erfundener SCA-Compliance-Score und keine fingierten CVEs.
- Funde mit Quellenbelegen und Stand der Datenerfassung.
- Keine Passwörter/Token in Repository, Browser oder Telemetrie.
- UI deutsch/englisch und Dark/Light, Zeit Europe/Berlin.
