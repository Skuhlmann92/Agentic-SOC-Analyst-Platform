# Windows event enrichment (live Wazuh / Neon)

This feature extends the existing `soc_live_alerts.payload` JSON projection. It does not change the ingestion token, tenant boundary, database schema or Wazuh forwarder. Only **newly ingested** records receive `windows_event`; existing records are not modified/backfilled.

## Data path
Windows Event Log -> Wazuh agent -> Wazuh manager alert JSON -> existing HTTPS `/api/ingest` -> `normalizeEvent` -> `windows_event` JSON -> private `/api/v1/search/events` and alert detail API.

The enrichment is a bounded projection, not an assertion of causality. In particular the PID in the **System** metadata of SCM **7040** identifies the event provider context, not necessarily the process responsible for changing BITS startup type.

## Windows events relevant to service changes

| Channel | Event IDs | Why |
| --- | --- | --- |
| System / Service Control Manager | 7040, 7045 | Startup configuration and service creation |
| Security | 4688, 4697 | Process creation and service installation (if audit policy permits) |
| Microsoft-Windows-Sysmon/Operational | 1, 7, 11, 12, 13, 14, 22 | Process, optional image-load, file, registry and DNS context (only where Sysmon installed/configured) |
| Microsoft-Windows-Bits-Client/Operational | 3, 4, 59, 60 and vendor/version-dependent events | BITS diagnostics; inspect actual emitted event IDs on each OS version |
| Application / MsiInstaller | 1033, 11707 | Installer correlation |

Events are **not guaranteed** to exist: the Wazuh agent must read the corresponding channel, auditing must be enabled, and the Wazuh manager must generate/forward matching alerts. A lack of related events is an **evidence gap**, not proof of benign activity. The custom Wazuh integration forwards **alerts**, not every raw event in the archive.

Example fragment for an explicitly reviewed Windows Wazuh agent `ossec.conf` (merge with current configuration; do not duplicate existing entries):
```xml
<localfile>
  <location>System</location>
  <log_format>eventchannel</log_format>
</localfile>
<localfile>
  <location>Security</location>
  <log_format>eventchannel</log_format>
</localfile>
<localfile>
  <location>Application</location>
  <log_format>eventchannel</log_format>
</localfile>
<localfile>
  <location>Microsoft-Windows-Sysmon/Operational</location>
  <log_format>eventchannel</log_format>
</localfile>
```
Only add the Sysmon channel when Sysmon is installed and its configuration has been reviewed. Review manager-side Wazuh rules and alert thresholds. In the current integration `<level>3</level>` excludes lower-level matches.

## 4688 command-line collection
Process command lines are available only when both **Audit Process Creation** and **Include command line in process creation events** are enabled. This has material privacy/secret-exposure impact. Require host-owner approval, an explicit retention period, least-privilege access and testing before enabling it. Prefer Sysmon 1 process GUIDs when present to correlate across short-lived PIDs. Never treat matching time windows alone as definitive attribution.

## Security and limitations
- Event contexts are **allowlisted and bounded**. Sensitive key/value tokens and URL query strings are redacted on a best-effort basis; **arbitrary secrets can still appear in process paths, command lines and manufacturer-specific fields**. Review your data classification and any existing `wazuh_context` retention separately.
- The platform continues to include the pre-existing bounded Wazuh context. Additional projection does **not** mean unrestricted raw-event retention.
- Wazuh field spellings vary by decoder/Windows version; absent values remain null and should display as “not collected”, not as “clean”.
- Data are scoped to the existing verified ingest credential/tenant. Do not expose the live API publicly.
- No host scripts, event-log policy, audit policy, service configuration or production deployment are modified by this branch.
- Use an explicit human review before interpreting suggested remediation for service-start changes.

## Example BITS event
```json
{
  "id":"7040-example","timestamp":"2026-11-06T09:36:01Z",
  "agent":{"id":"enrolled-agent-id","name":"DESKTOP-VKES2QF"},
  "rule":{"id":"example","level":3,"description":"Service start type changed"},
  "data":{"win":{
    "system":{"eventID":"7040","channel":"System","providerName":"Service Control Manager","eventRecordID":"1234","processID":"1116"},
    "eventdata":{"param1":"Background Intelligent Transfer Service","param2":"demand start","param3":"auto start"}
  }}
}
```
The normalized alert adds `windows_event.event_id=7040`, `windows_event.service_name`, `windows_event.service_start_type` and `windows_event.scm_provider_pid_not_actor=true`.
