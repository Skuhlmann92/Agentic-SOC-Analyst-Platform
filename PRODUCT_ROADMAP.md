# Agentic SOC Analyst Platform — Product & UX Roadmap

Updated: 2026-11-07. Features #3–#5 were merged and deployed via PR #3. Subsequent UX and localization work is tracked below.

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
- [x] **#2 Smart Review Ordering – erste Version:** Auswählbare Reihenfolge nach transparenter Heuristik aus Schweregrad, Wartezeit, Belegen und Eskalationshinweis oder nach Erstellungszeit; Erläuterung direkt in der Queue. Kein kalibrierter Risikoscore.
- [ ] **#2 Ausbau:** Asset-Kritikalität, verifizierte Detektionskonfidenz, übergreifende serverseitige Priorisierung, stabile Pagination und Performance-Tests.

## Next milestones

| ID | Priority | Feature | Acceptance criteria |
| --- | --- | --- | --- |
| DE | P0 | Vollständige deutsche Lokalisierung | Gesamte Oberfläche, Meldungen, KI-Ausgaben und Dokumentation in de-DE; automatisierte Schlüsselprüfung und Sprach-QA |
| 1 | P0 | Fast review keyboard shortcuts | **Implementiert (erste Version)**; Browser-/Screenreader-Abnahmetests noch offen |
| 2 | P0 | Smart review ordering | **Basis umgesetzt** (Schweregrad, Alter, Belege, transparente Sortierung); Asset-Kritikalität, kalibrierte Detektionskonfidenz und serverseitige Pagination offen |
| 6 | P1 | Incident timeline | Windows Event 7040/7045, 4688, Sysmon, auth events and networking merged by verified time/source; explicit provenance and missing-data markers |
| 7 | P0 | One-click context enrichment | Fetch correlated host/user/indicator history and asset vulnerabilities on demand; scoping, query limits and privacy controls |
| 8 | P1 | Safe remediation scripts | Read-only diagnostics by default; human-reviewed code, dry-run where supported, validated signatures and role-based execution guard |
| 9 | P1 | Assisted case closure | Generate cited final summary; require deliberate closure and audit record; never close on recommendation alone |
| 10 | P1 | Signal-driven notifications | High-priority immediate alerts, grouped digests, escalation policy, anti-spam limits and role-aware delivery |
| 11 | P0 | Complete review audit trail | Actor identity from authenticated session (not hardcoded); append-only decision events, request IDs, timestamps, decision provenance and access review |
| 12 | P2 | Feedback loop for recommendations | Compare analyst decisions to suggestions; version rules/models; drift and precision monitoring; human-reviewed updates |

## UX-Programm 2026/27 — visuelle Bestandsaufnahme vom 07.11.2026

**Grundlage:** Screenshots der angemeldeten Oberfläche von Dashboard, Alerts, Security Posture, Entitäten, Live-Endgeräten, Inventar, Cases, Investigations, KI-Agent & Skripten, Freigaben und Verwaltung sowie vollständige Inspektion der zugehörigen React-Komponenten. Die Screenshots dokumentieren den Stand **vor** diesem Feature-Branch. Eine reale Browser-/Responsive-Abnahme des neuen Builds ist erst nach einer erfolgreichen Vercel-Preview und authentifiziertem Zugriff möglich.

**Umsetzungsprinzip:** Kleine PRs, bestehende Wazuh/Neon/Claude-Funktionen erhalten, kein verdecktes Auto-Approve/Auto-Execute; pro Etappe Build, mobile + Desktop-Ansicht, Licht/Dunkel und realer Datenworkflow prüfen.

### Etappe UX-01 — Sofortige Entlastung und weniger Scrollen (P0)

- [x] **UX-01a: KI-Agent/Skripte nebeneinander.** Desktop mit drei Spalten: Alert-/Analyseauswahl links, Analyse + Evidenz mittig, Claude-Skriptgenerator und Skriptprüfung rechts. Unabhängige vertikale Scrollbereiche, kompakte Skriptliste und begrenzte Codehöhe. Mobil linear gestapelt; echte Tab-/Drawer-Optimierung folgt in UX-05.
- [x] **UX-01b: Alerts entschlacken.** Erweiterte Filter, Facetten und 7-Tage-Korrelationskarten standardmäßig einklappen. Haupttabelle erhält mehr Breite; einzelne Gruppen können bei Bedarf geöffnet werden. Gruppierung bleibt nur ein Hinweis.
- [x] **UX-01c: Sentinel-Assistent nicht aufdrängen.** Geschlossen starten, als Button unten rechts aufrufbar; gemerkte Sitzungsentscheidung respektieren. Guide nicht als aktiv untersuchenden KI-Analysten bewerben.
- [x] **UX-01d: Freigaben breiter und fokussierter.** Breitere Auswahlspalte mit eigenem Scrollbereich und separatem Detail-/Entscheidungsbereich.
- [ ] **UX-01e: Bildschirmabnahme** auf 1366/1440/1920 px, kleinen Displays, Dark Mode, 100 % Browserzoom; keine verdeckten Aktionsbuttons oder überlagernden Hilfefenster.

### Etappe UX-02 — Navigation und Analystenfluss (P0)

- [x] **UX-02a: Asset-Bereich bündeln.** Entitäten, Live-Status und Inventar in ausklappbare Asset-Navigation.
- [x] **UX-02b: Gemeinsames Hostprofil.** Verlinkte Detailansicht mit Heartbeat, Betriebssystem, Softwarebestandsaufnahme und zugehörigen Alerts, inklusive transparenter Quellen-/Abdeckungs-Hinweise.
- [x] **UX-02c: Dashboard „Jetzt bearbeiten“.** Direkte Einstiegskarten für Freigaben, kritische Alerts und offene Cases; bei Teilfehlern verfügbare Kennzahlen weiter anzeigen.
- [x] **UX-02d: Sichtbare Links.** Cases, Investigations, Alerts und Entitäten statt allein per Tabellenzeilen-Klick auch über erkennbare Textlinks öffnen.
- [x] **UX-02e: Untersuchungsstart ohne UUID-Zwang.** Aktuelle Alerts per Auswahl laden, manuelle Alert-ID bleibt als Fallback.
- [ ] **UX-02f: Echte globale Aufgaben-Queue** über Alerts, Drafts, Cases, SLA, Analysten-Zuweisungen und Duplikaterkennung, inklusive serverseitiger Sortierung/Pagination.
- [ ] **UX-02g: Kontextnavigation vervollständigen** (Alert ↔ Host ↔ Case ↔ Investigation ↔ Draft ↔ Remediation) mit Zurück-Pfad und Erhalt von Filtern.

### Etappe UX-03 — Klarer Sicherheitsentscheid (P0/P1)

- [x] **UX-03a: Alert-Detail umstellen.** „Was ist passiert?“ zuerst, „Untersuchen“ als primäre Aktion, Statusänderungen als nachrangige Aktionen, Schließen/Unterdrücken mit Bestätigung, Roh-Wazuh-Kontext hinter Aufklappen.
- [x] **UX-03b: Statusrückmeldung.** Sichtbare Erfolg-/Fehlermeldungen nach Alert-Statusänderungen.
- [ ] **UX-03c: Geführtes Entscheiden in Freigaben.** Zusammenfassung vor Evidenz, Hauptentscheidung an konsistenter Stelle, Bestätigung und klarer Folgeschritt; Undo nur, wenn serverseitig fachlich/revisionssicher umgesetzt.
- [ ] **UX-03d: Einheitliche Detail-Struktur** (Zusammenfassung → Risikobewertung → nächste Aktion → Evidenz → technische Rohdaten) in Alert-, Case-, Investigation- und Agentenansichten.
- [ ] **UX-03e: Sichere Statusdialoge** mit erforderlicher Begründung, Zugriffskontrolle und unveränderlicher Audit-Spur; ein einfacher Bestätigungsdialog reicht langfristig nicht.

### Etappe UX-04 — Lesbarkeit, Konsistenz und Lokalisierung (P0)

- [x] **UX-04a: Verwaltung in Tabs** (Datenquellen, Verarbeitung, Replay, Audit) statt einer langen Seite.
- [ ] **UX-04b: Vollständige DE-DE-Übersetzung aller Seiten** einschließlich automatisch erzeugter Analysen, Hilfetexte, Erklärungen, Labels, Serverfehler und aller Statuswerte. Zentraler Schlüssel-Katalog und automatisierte Vollständigkeitsprüfung gemäß obenstehendem P0-Lokalisierungsmeilenstein.
- [ ] **UX-04c: Einheitliche Typografie und Dichte:** Lesbarer Grundschriftgrad und Kontrast, Mindesthöhe/Abstände von Buttons, semantische Überschriften, besserer Umgang mit sehr langen Titeln, IDs, Prozessen, Tabellenspalten und Kommandozeilen.
- [ ] **UX-04d: Einheitliche leer-/lade-/Fehler-Zustände**, Retry pro Widget statt totaler Dashboard-Sperre; kein „0“ bei fehlgeschlagener Datenabfrage.
- [ ] **UX-04e: Klarere Filter** (Status/Schwere/Zeitraum) mit aktiven Filterchips, Filterzahl und einem verlässlichen „Zurücksetzen“. Query-Parameter vollständig synchronisieren, damit Zurück/Vorwärts funktioniert.
- [ ] **UX-04f: Tastatur-/Screenreader-Tests** für Buttons, Tabellen, Tabs, Menüs, Fokus, Escape und automatisches Weiterblättern.

### Etappe UX-05 — Weitere konkrete Screenshot-Befunde (P1)

- [ ] **UX-05a: Cases & Investigations**: Listen mit Suchfeld, Zuordnung, Priorität, letztem Fortschritt, „Nächste Aktion“ und Status-Tabs; Detailseiten durch direkt sichtbare Belegrelationen/Timeline stärker verbinden.
- [ ] **UX-05b: Security Posture**: Statt bis zu 90 unsortierter CIS-Befunde thematische Risiko-Gruppen (z. B. Windows Update, RDP, Accounts), sortiert nach Auswirkung; Sammelhinweise und belegte Remediation-Vorschläge ohne automatischen Eingriff.
- [ ] **UX-05c: Inventar**: Sortierbare/paginierte 1.800+ Softwareeinträge, Host-spezifische Suche, Filter nach Hersteller, Version und fehlender Aktualität; CVE nur mit realer Schwachstellenquelle.
- [ ] **UX-05d: Live-Endgeräte**: frische/veraltete Heartbeats mit tatsächlichem Alter und Aktion; lokaler Dienststatus klar von Manager-Online-Status getrennt.
- [ ] **UX-05e: KI-Agent / Skriptgenerator**: Mobil Tabs zwischen Auswahl, Analyse und Skripten; Codevergleich, Sicherheitsflags, Prüfung, Rollback und nachprüfbarer Kopiererfolg. Vorschläge niemals ungeprüft ausführen.
- [ ] **UX-05f: Sentinel-Guide**: vollständig deutsch, kontextsensitiv, kurz und auf Abruf; Hilfe darf keine interaktiven Tabellen, Buttons oder Dialoge verdecken; Zustand über Sitzungen hinweg sinnvoll speichern.
- [ ] **UX-05g: Dashboard**: Relevante Trends, Zeitraum, Frische/Provenienz der Daten, klare Kennzeichnung unvollständiger Metriken; bei 100+ offenen Reviews exakte Gesamtzahl erst über echte Zählabfrage.
- [ ] **UX-05h: Responsive/Zoom & visuelle Regressionen** für 320/375/768/1024/1440/1920 px, 125/150/200 % Zoom sowie Light/Dark.
- [ ] **UX-05i: Interaktive visuelle Abnahme** mit echten Screenshots des *neuen* Preview-Builds, inkl. Navigation, geöffneten Menüs, Eingabe-/Fehlerzuständen, Script-Review und Tastatur-Fokuszuständen.

### Freigabe-Gates vor Merge dieses UX-Branches

- [ ] TypeScript, ESLint und GitHub-Actions-Workflow erfolgreich; Vercel Preview READY.
- [ ] Sicherheitskritische API- und Rollenverhalten unverändert; keine neue automatische Skriptausführung.
- [ ] Route /assets/[hostname] über funktionierende Hostlinks erreichbar; unabhängig ausfallende Collector-APIs blockieren nicht die ganze Hostseite.
- [ ] Manuelle Desktopprüfung: drei sichtbare Spalten auf ausreichend breitem Display, kein zu großer innerer Scrollbereich und alle Skript-Review-Aktionen erreichbar.
- [ ] Manuelle Mobilprüfung: sinnvolle Stapelung und bedienbare Buttons.
- [ ] Dokumentierte Screenshots Vorher/Nachher. Vorher-Bilder wurden vom Projektinhaber bereitgestellt; Nachher-Bilder stehen noch aus.

## Umsetzung November 2026 — Claude-Einzelanalyse & Linux-Skripte

- [x] **KI-Analyse einzelner Alerts:** Neuer, authentifizierter POST-Endpunkt `/api/alert-ai`. Nutzt den ausgewählten Alert und höchstens 24 weitere Alerts desselben Hosts aus ±24 Stunden, mit begrenzten Feldern. Die Claude-Antwort enthält Zusammenfassung, Bewertung, Hypothesen, harmlose Ursachen, lesende Prüfschritte, Grenzen und ausschließlich validierte Beleg-Alert-IDs.
- [x] **UI im KI-Agentenbereich:** Separater Button **„Alert mit Claude analysieren“** neben dem vorhandenen regelbasierten Untersuchungs-Workflow. Ergebnisse werden deutlich als unbestätigte, **nicht dauerhaft gespeicherte** Analyse angezeigt. Kein Remote-Eingriff oder automatisches Schließen von Alerts.
- [x] **Linux-/Bash-Unterstützung:** Explizite Zielsystem-Auswahl für **Windows/PowerShell** oder **Linux/Bash**, bei Einzel- und Sammeldiagnosen. Bestehende PowerShell-Entwürfe bleiben anzeigbar; neue Entwürfe erhalten Skriptsprache und Zielsystem als Metadaten.
- [x] **Basisschutz:** Nur lesende Diagnose angefordert, Risiko-Muster für Linux-Shell-Befehle, kein SSH und keine automatische Skriptausführung. Alle neuen Skripte müssen manuell sicherheitsgeprüft werden. Betriebssystemkonflikte werden abgefangen, soweit die Alerts Betriebssystem-Metadaten liefern.
- [ ] **Echte Linux-Syntaxprüfung:** ShellCheck und AST-/Befehlsanalyse vor jeglicher Ausführungsplanung; Regex-Indikatoren sind kein Sicherheitsnachweis.
- [ ] **KI-Analyse dauerhaft versionieren:** Mandantensichere Speicherung, eindeutige Zuordnung zu Alert/Analyst, nachvollziehbare Evidenz-Snapshots, Modellversion, Aufbewahrungsfristen und append-only Audit.
- [ ] **End-to-End-Tests mit Echtdaten und Fehlerfällen:** Linux- und Windows-Host prüfen, hohe Regel-Level, fremder Mandant, fehlende Claude-Credentials, Rate Limit, Timeout, manipulierte Alert-Inhalte, ungültige Referenzen und ausbleibende Skriptausführung.
- [ ] **OS-Erkennung aus verifiziertem Inventar:** Aktuelle Auswahl wird vom Analysten vorgenommen. Verlässliche automatische Plattformzuordnung über Host-Inventar/Heartbeat ist noch zu integrieren.

## Commercial hardening required before B2B production

- Replace generic `SOC Administrator` decision attribution with actual authenticated actor, enforced permissions and separation-of-duties.
- Test concurrent bulk/individual approvals and explain partial failures; bulk endpoint must be audited and rate-limited.
- Add an optional grounded LLM recommendation service behind an explicit opt-in and provider credential. Validate model output against stored evidence, log model/version and never treat reported confidence as calibrated probability. Fall back to `rules_v1` if unavailable.
- Benchmark 7-day grouping and add DB indexes/retention if required; extend grouping only with validated causal indicators and deduplicate reliably.
- GDPR: data retention, purpose limitation and least-privilege access to command lines and identity/IP metadata.
- Provide backend integration tests for groups, bulk atomicity, tenant isolation and user interface flows.

No unreviewed automatic approvals, isolation or remediation operations are planned.
