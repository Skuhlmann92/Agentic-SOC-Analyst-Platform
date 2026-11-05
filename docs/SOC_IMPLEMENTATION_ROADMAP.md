# Commercial Readiness — P0/P1/P2

Aktuelle technische Bestandsaufnahme und Prüfergebnisse: [COMMERCIAL_READINESS_AUDIT.md](./COMMERCIAL_READINESS_AUDIT.md).

## P0 — Sicherheit / Datenintegrität / Mandantentrennung
- [x] Additive Neon-Datenmodelle für Organisation, Mitglieder, Connectoren, Agent-Zuordnung, Audit, Tarife (149/349/699 EUR) und inaktive Subscriptions; bestehende Records unberührt.
- [x] Live/Demo-API-Grenze im Code fail-closed für unbekannte Mandanten; private Live-API prüft aktive Org-Mitgliedschaft. Session-Secret und Test-Account-Absicherung, Login-Throttle, API-Origin-Prüfung, Browser-Sicherheitsheader.
- [x] Automatisierte Rollen-/Tenant-Grenztests und Next-Produktionsbuild als CI-Workflow.
- [ ] **Release-Blocker:** Vercel API HTTP 402 (kostenloses Tageskontingent >100 Deployments). Neuesten P0-Commit nach Freigabe des Kontingents deployen; URL/API/Release-SHA verifizieren.
- [ ] **Pflicht vor Kundenbetrieb:** PostgreSQL Row-Level Security + Least-Privilege DB-Rollen, vollständige Tenant-ID/Connector-Token-Zuordnung, echte Benutzer/Mitgliedschaften/Einladungen, Datenbank-Migrationstests und E2E-Tests.
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
