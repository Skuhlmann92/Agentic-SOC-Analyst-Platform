#!/usr/bin/env bash
# Install and enroll a Wazuh agent on Debian/Ubuntu/Raspberry Pi OS (arm64 / armhf).
# Requires the address of an already deployed Wazuh Manager.
# Use: sudo WAZUH_MANAGER='10.0.0.5' WAZUH_AGENT_NAME='rpi5' bash scripts/install-rpi-wazuh-agent.sh
set -Eeuo pipefail
[[ "$EUID" -eq 0 ]] || { echo "Run with sudo" >&2; exit 1; }
[[ -n "${WAZUH_MANAGER:-}" ]] || { echo "Set WAZUH_MANAGER to the reachable Wazuh Manager address" >&2; exit 1; }
case "$(dpkg --print-architecture)" in arm64|armhf|amd64) ;; *) echo "Unsupported architecture"; exit 1 ;; esac
if systemctl is-active --quiet wazuh-manager 2>/dev/null; then
  echo "This host runs the Wazuh Manager. Do not install a separate agent here." >&2
  exit 1
fi
if dpkg-query -W -f='${Status}' wazuh-agent 2>/dev/null | grep -q 'install ok installed'; then
  echo "Wazuh agent already installed. No changes made."
  systemctl --no-pager status wazuh-agent || true
  exit 0
fi
apt-get update
apt-get install -y curl gnupg ca-certificates
mkdir -p /usr/share/keyrings
curl --fail --location --show-error --silent https://packages.wazuh.com/key/GPG-KEY-WAZUH |
  gpg --dearmor --yes -o /usr/share/keyrings/wazuh.gpg
chmod 644 /usr/share/keyrings/wazuh.gpg
echo "deb [signed-by=/usr/share/keyrings/wazuh.gpg] https://packages.wazuh.com/4.x/apt/ stable main"   > /etc/apt/sources.list.d/wazuh.list
apt-get update
WAZUH_MANAGER="$WAZUH_MANAGER" WAZUH_AGENT_NAME="${WAZUH_AGENT_NAME:-rpi-soc}" apt-get install -y wazuh-agent
systemctl daemon-reload
systemctl enable --now wazuh-agent
echo "Wazuh Agent installed. Confirm successful enrollment in the Wazuh Manager."
systemctl --no-pager status wazuh-agent || true
