# Agentic SOC Platform – verbindliche nächste Arbeitsschritte

Stand: 2026-11-05. Nutzerauftrag: Nach den jetzt umzusetzenden Schritten auch die übrigen Verbesserungen umsetzen. Nicht als abgeschlossen markieren, bevor umgesetzt und geprüft.

## In dieser Iteration
- [ ] Security Posture Dashboard: Wazuh-Alert-basierte Risikobewertung und Datenquellenstatus; SCA, Schwachstellen, Dateiüberwachung und Inventar nur mit echten Daten darstellen. Wazuh-Manager-API/Collector nachrüsten, wenn Zugang verfügbar.
- [ ] Automatische Alert-Korrelation: wiederkehrende Signale je Host/Regel in Zeitfenstern konsolidieren, Risiko transparent begründen, Beleg-IDs und menschliche Bestätigung.

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
