# Agentic SOC Platform – verbindliche nächste Arbeitsschritte

Stand: 2026-11-05. Nutzerauftrag: Nach den jetzt umzusetzenden Schritten auch die übrigen Verbesserungen umsetzen. Nicht als abgeschlossen markieren, bevor umgesetzt und geprüft.

## In dieser Iteration
- [x] Security Posture Dashboard (erste produktive Stufe): echte CIS-SCA-Checks aus Wazuh-Alerts je Host, Regel und Beschreibung, nachgewiesene SCA-Summary-Werte, direkte Belege und offener Integrationsstatus.\n- [ ] **Posture komplettieren:** Wazuh Manager API sicher anbinden und die vollständigen SCA-Checks, CVE/Vulnerability Detection, FIM sowie Syscollector-Inventar verlässlich integrieren. Aktueller Termalin-Linux-Account hat keinen autorisierten Zugriff auf die Wazuh-API-Zugangsdaten. Keine CVEs oder Scores erfinden.
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
