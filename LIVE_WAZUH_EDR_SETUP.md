# Live Wazuh / EDR integration (Vercel + Neon)

The public SOC demo and your private live telemetry are **separate**:

- **Public demo**: "Open demo dashboard" -> synthetic data only.
- **Private SOC admin**: choose **Administrator** at `https://soc.samuelkuhlmann.com/login`, use the private `SOC_ADMIN_PASSWORD`. The tenant is assigned automatically. This shows *live* alerts from Neon.
- **Ingestion**: `POST https://soc.samuelkuhlmann.com/api/ingest`, with `Authorization: Bearer <SOC_INGEST_TOKEN>`. Supports a Wazuh alert object, a generic EDR object, an array of up to 100 objects, or `{"source":"wazuh","events":[...]}`.

The dashboard expects:
- `POSTGRES_DATABASE_URL` or `POSTGRES_URL` from the Vercel/Neon Marketplace.
- `SOC_ADMIN_USERNAME` (defaults to `socadmin`, used as internal session subject).
- `SOC_ADMIN_PASSWORD` (generate a strong unique value, production only).
- `SOC_INGEST_TOKEN` (generate an independent strong bearer token, production only).
- `CONSOLE_SESSION_SECRET` (a strong secret for authenticated cookies).

The app creates the small **`soc_live_alerts`** table on the first ingestion or authenticated live read. It normalizes Wazuh fields (`rule.description`, `rule.level`, `rule.id`, `rule.mitre.id`, `agent.name`, `data.srcip`) and generic EDR fields into one alert schema. It stores **only normalized fields**; full raw telemetry and potentially sensitive log payloads are not retained. Duplicate source/id pairs are deduplicated. Wazuh rule levels map to severities: 12+ critical, 8–11 high, 5–7 medium, 3–4 low, below 3 informational.

## Wazuh Manager integration

Wazuh **agents** (including a Raspberry Pi agent) send events to the **Wazuh Manager**. Wazuh generates alerts centrally in `/var/ossec/logs/alerts/alerts.json` on the Manager. Configure forwarding on the Manager, not the Pi, unless the Pi is itself the Manager.

1. Copy `integrations/wazuh/custom-soc-forwarder` to `/var/ossec/integrations/custom-soc-forwarder` on the **Wazuh Manager**.
2. Execute:

   ```bash
   sudo chown root:wazuh /var/ossec/integrations/custom-soc-forwarder
   sudo chmod 750 /var/ossec/integrations/custom-soc-forwarder
   ```

3. Add within the existing `<ossec_config>` block of `/var/ossec/etc/ossec.conf`:

   ```xml
   <integration>
     <name>custom-soc-forwarder</name>
     <hook_url>https://soc.samuelkuhlmann.com/api/ingest</hook_url>
     <api_key>YOUR_SOC_INGEST_TOKEN</api_key>
     <alert_format>json</alert_format>
     <level>3</level>
   </integration>
   ```

   Replace `YOUR_SOC_INGEST_TOKEN` with the value from your Vercel project's private environment. Keep the configuration file readable only by authorized administrators.

4. Validate XML configuration and restart Wazuh Manager:

   ```bash
   sudo systemctl restart wazuh-manager
   sudo tail -n 50 /var/ossec/logs/ossec.log
   ```

5. New Wazuh alerts should appear in the **private** SOC admin `/alerts` view within a few seconds. Existing alerts are not backfilled by this integration.

## Test without Wazuh

```bash
export SOC_INGEST_TOKEN='your-secret-here'
curl --fail-with-body -X POST 'https://soc.samuelkuhlmann.com/api/ingest' \
  -H "Authorization: Bearer $SOC_INGEST_TOKEN" \
  -H 'Content-Type: application/json' \
  -H 'X-SOC-Source: wazuh' \
  --data '{"id":"test-0001","timestamp":"2026-11-05T12:00:00Z","rule":{"id":"5710","level":10,"description":"SSH brute force detected","mitre":{"id":["T1110"]}},"agent":{"name":"rpi5"},"data":{"srcip":"192.0.2.10"}}'
```

A successful response looks like `{"ok":true,"received":1,"accepted":1,"duplicates":0,...}`. Repeating the same source and id results in `duplicates:1`.

## Generic EDR JSON

```json
{
  "source": "edr",
  "events": [
    {
      "id": "edr-incident-123",
      "timestamp": "2026-11-05T12:00:00Z",
      "title": "Suspicious PowerShell execution",
      "severity": "high",
      "hostname": "workstation-01",
      "username": "testuser",
      "technique_ids": ["T1059.001"]
    }
  ]
}
```

The EDR vendor must export or forward events in JSON. Vendor API polling/webhooks need additional vendor-specific adapters and credentials.

## Security and limitations

- Only transmit the specific detection fields you need. Production alerts may contain personal or sensitive data. Confirm retention, access controls and GDPR requirements before real ingestion.
- Never put credentials into Git. Keep tokens in Vercel environment variables and protect the Wazuh Manager config.
- The live endpoint has a 256 KiB request limit and 100-event batch limit. HTTP requests must use HTTPS. A failed POST should be retried by the caller; the event id provides deduplication.
- This is a **functional telemetry intake and read dashboard**, not yet the original full FastAPI/LangGraph investigation engine. Advanced case workflows, correlation, approval, persistent evidence, long-term retention and multi-tenant administration still require backend implementation.
- The Neon free tier has storage/compute limits; this API currently retrieves up to 5,000 live alerts for dashboard filtering. For high-volume ingestion use paginated database queries, retention policies, and buffering/queuing.
- The private admin password has no distributed brute-force protection yet: deploy Cloudflare WAF/rate limiting and consider stronger identity-based login or MFA before exposing production event data.
