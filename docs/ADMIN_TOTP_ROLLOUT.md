# Administrator-TOTP — gestufte Aktivierung (11.11.2026)

**Status:** Implementierung im Security-Draft-PR; keine Aktivierung oder Migration in Produktion durchgeführt. Kein vollständiges Nutzer-2FA-System. Gilt zunächst für den bestehenden einzelnen Administratorzugang.

## Implementierte Schutzmechanismen

- HMAC-SHA1 TOTP nach RFC 6238, 6 Stellen, 30 Sekunden, Toleranz von +/- einem Zeitfenster.
- TOTP-Prüfung ausschließlich serverseitig nach erfolgreichem Passwortvergleich.
- Einmalige Verwendung: atomare, pro Administrator fortschreitende Counter in `soc_auth_totp_replay` (PostgreSQL) und Fail-closed bei DB-Ausfall; keine Codes/Secrets persistiert.
- Signierte Admin-Sessions enthalten `mfaVerifiedAt`; bei aktivierter MFA werden ältere Admin-Sessions ohne gültigen Nachweis sofort ungültig.
- Vorhandene Produktions-Login-Drosselung gilt auch für fehlgeschlagene TOTP-Versuche.
- TOTP-Secret wird nur aus einer serverseitigen Umgebungsvariable gelesen. Kein QR-Code/Secret-Endpunkt.

## Vorbereitung (zuerst Preview/Staging)

1. Sicherheitsbranch bauen und alle Tests prüfen. Migration `console/db/migrations/008_admin_totp_replay.sql` auf der **Staging**-Datenbank als berechtigter Operator ausführen.
2. Dedizierte Datenbankrolle mit `USAGE` auf Schema `public` und den für die atomare Replay-Abfrage benötigten `INSERT`, `SELECT` und `UPDATE`-Rechten ausschließlich für `soc_auth_totp_replay` vorsehen. Verbindung ausschließlich als serverseitiges `SOC_AUTH_DATABASE_URL`-Secret speichern. Wenn noch die allgemeine Postgres-Verbindung verwendet wird, ist die Least-Privilege-Umstellung ausdrücklich noch offen.
3. Ein einziges zufälliges, individuelles Base32-TOTP-Secret lokal generieren, z. B. `python -c "import base64,secrets; print(base64.b32encode(secrets.token_bytes(20)).decode())"`. **Nicht** in Git, Chat, Logs, Screenshots oder Tickets kopieren.
4. Das Secret manuell im Authenticator anlegen (Kontobezeichnung `Agentic SOC Admin`, Typ TOTP, SHA1, 6 Stellen, 30 Sekunden). Es wird noch kein automatisches Enrollment oder QR-Code angeboten.
5. **Erst nach Migration und Authenticator-Setup** das Secret in der Vercel **Preview**-Umgebung als `SOC_ADMIN_TOTP_SECRET` hinterlegen. Die Präsenz eines nichtleeren Secrets erzwingt MFA automatisch. Optional `SOC_REQUIRE_ADMIN_MFA=true`. Ist der Schalter `true`, aber das Secret fehlt, wird die Admin-Anmeldung absichtlich blockiert.
6. Preview neu deployen, Passwort+gültigen Code testen, falschen/fehlenden Code zurückweisen und identischen Code unmittelbar erneut versuchen (muss fehlschlagen). Browser-, API- und Audit-Tests durchführen. Alten Admin-Cookie testen (muss zurückgewiesen werden).
7. In Produktion **nichts aktivieren**, bevor eine dokumentierte Recovery-Prozedur, getesteter Rollback und vollständige authentifizierte E2E-Abnahme vorliegen. Anschließend Staging-Erkenntnisse gesondert freigeben.

## Verifikation am 11.11.2026

Die additive Migration 008 wurde auf dem vorhandenen Neon-Staging-Branch `security-2fa-validation` angewendet. Prüfung: Tabelle vorhanden, alle drei Spalten mit erwarteten Typen und NOT-NULL vorhanden. Ein transaktionaler Smoke-Test auf einer temporären Tabelle bestätigte: erster Zeitschritt akzeptiert, identischer Zeitschritt abgewiesen (0 Zeilen), höherer Zeitschritt akzeptiert. **Kein Test mit echtem Authenticator-Secret, keiner produktiven Datenbank und keinem authentifizierten Preview-Login.** Die temporäre Testtabelle wurde beim Commit automatisch entfernt.

## Verhalten bei Problemen

- Keine gültige Code/DB-Abfrage -> kein Administrator-Session-Cookie.
- Fehlende Migration oder falsche DB-Rechte -> kein Login (fail-closed).
- Nach Aktivierung müssen bereits angemeldete Admins erneut mit TOTP anmelden.
- Zeitabweichungen von mehr als +/-30 Sekunden können Login blockieren; NTP/Zeitsynchronisation sicherstellen.
- Bei verlorenem Authenticator existieren **noch keine Recovery-Codes**. Es gibt bewusst **keinen automatischen MFA-Bypass**. Ein separat kontrollierter, protokollierter Wiederherstellungsprozess ist vor Live-Freigabe zu implementieren.

## Offene P0-Aufgaben für Kundenbetrieb

- Per-User-Identitäten, Enrollment/Reset mit Re-Authentifizierung und Zwei-Personen-Freigabe, verschlüsselte Secret-Speicherung, Recovery-Codes als Hashes.
- Rollenbasierte Erzwangung auch für Kundenadmins und privilegierte Aktionen, risikobasierte Step-up-Authentifizierung, Security-Event-Audit.
- Authentifizierte Browser-E2E-Tests und Test der Replay-Sperre gegen eine echte Staging-Postgres-Verbindung unter Parallelität.
- Ablauf/Rücknahme aktiver Sessions bei Reset/Passwortwechsel; geprüfte Secrets-Rotation.
- Datenbank-Rollentrennung und Least-Privilege-Runtime-Cutover aus `docs/DB_ACCESS_CUTOVER.md`.

**Hinweis:** Diese Stufe ist absichtlich ein begrenzter Admin-TOTP-Schutz, keine abgeschlossene allgemeine 2FA-Einrichtung. Es wurden keine produktiven Vercel-Umgebungsvariablen und keine Kundendaten geändert.
