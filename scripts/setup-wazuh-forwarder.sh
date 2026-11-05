#!/usr/bin/env bash
# Installs SOC forwarder on the host running wazuh-manager (not on agents).
# Requires sudo, python3 and a Wazuh Manager instance.
set -Eeuo pipefail
if [[ ${EUID} -ne 0 ]]; then echo "Run with sudo on the Wazuh Manager" >&2; exit 1; fi
if ! systemctl list-unit-files wazuh-manager.service --no-legend 2>/dev/null | grep -q wazuh-manager; then
  echo "Wazuh Manager service not found. Install on the manager, not on your Raspberry Pi agent." >&2
  exit 1
fi
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRIPT="$ROOT/integrations/wazuh/custom-soc-forwarder"
CONF="/var/ossec/etc/ossec.conf"
TARGET="/var/ossec/integrations/custom-soc-forwarder"
URL="https://soc.samuelkuhlmann.com/api/ingest"
[[ -f "$SCRIPT" && -f "$CONF" ]] || { echo "Script or Wazuh configuration missing" >&2; exit 1; }
if [[ -z "${SOC_INGEST_TOKEN:-}" ]]; then
  read -rsp "SOC_INGEST_TOKEN (input hidden): " SOC_INGEST_TOKEN
  echo
fi
[[ -n "$SOC_INGEST_TOKEN" ]] || { echo "Token required" >&2; exit 1; }
if [[ "$SOC_INGEST_TOKEN" =~ [\<\>\&\"\'] ]]; then
  echo "Token contains unsupported XML special characters" >&2; exit 1
fi
BACKUP="$CONF.backup.$(date +%Y%m%d%H%M%S)"
cp -a "$CONF" "$BACKUP"
install -o root -g wazuh -m 750 "$SCRIPT" "$TARGET"
export SOC_INGEST_TOKEN CONF URL
python3 - <<'PY'
import os
import pathlib
import re
conf = pathlib.Path(os.environ["CONF"])
text = conf.read_text(encoding="utf-8")
if "<name>custom-soc-forwarder</name>" in text:
    raise SystemExit("The integration already exists. Review ossec.conf before updating it.")
block = """  <integration>
    <name>custom-soc-forwarder</name>
    <hook_url>""" + os.environ["URL"] + """</hook_url>
    <api_key>""" + os.environ["SOC_INGEST_TOKEN"] + """</api_key>
    <alert_format>json</alert_format>
    <level>3</level>
  </integration>
"""
if "</ossec_config>" not in text:
    raise SystemExit("Could not locate closing </ossec_config>")
text = text.replace("</ossec_config>", block + "</ossec_config>", 1)
conf.write_text(text, encoding="utf-8")
PY
unset SOC_INGEST_TOKEN
if command -v xmllint >/dev/null 2>&1; then
  if ! xmllint --noout "$CONF"; then
    cp -a "$BACKUP" "$CONF"
    echo "Invalid XML; backup restored" >&2; exit 1
  fi
fi
if ! systemctl restart wazuh-manager; then
  cp -a "$BACKUP" "$CONF"
  systemctl restart wazuh-manager || true
  echo "Manager restart failed; backup restored" >&2; exit 1
fi
echo "Forwarder installed. Backup: $BACKUP"
echo "Check: sudo tail -n 30 /var/ossec/logs/ossec.log"
