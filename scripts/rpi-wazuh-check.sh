#!/usr/bin/env bash
# Non-destructive Raspberry Pi / Wazuh connection diagnostics.
# Run locally on your Raspberry Pi: bash scripts/rpi-wazuh-check.sh
set -u
printf '=== System ===\n'
hostnamectl --static 2>/dev/null || hostname
uname -m
grep '^PRETTY_NAME=' /etc/os-release | head -1
printf '\n=== SSH ===\n'
systemctl is-active ssh 2>/dev/null || true
ss -lnt 2>/dev/null | grep -E '(:22[[:space:]]|:22$)' || true
printf '\n=== Wazuh services ===\n'
for service in wazuh-agent wazuh-manager; do
  printf '%s: ' "$service"
  systemctl is-active "$service" 2>/dev/null || true
done
printf '\n=== Agent / Manager config ===\n'
if [ -f /var/ossec/etc/ossec.conf ]; then
  if sudo -n true 2>/dev/null; then
    sudo grep -E '<address>|<port>|<protocol>' /var/ossec/etc/ossec.conf | head -15
  else
    printf 'Wazuh config present; no passwordless sudo access, not printing config.\n'
  fi
else
  printf 'No Wazuh config found.\n'
fi
printf '\n=== Tunnel ===\n'
command -v cloudflared || true
systemctl is-active cloudflared 2>/dev/null || true
printf '\n=== Networking ===\n'
ip -brief address show 2>/dev/null | head -12
printf '\n=== Endpoint reachability ===\n'
curl --silent --show-error --max-time 8 -o /dev/null -w 'SOC endpoint HTTP status: %{http_code}\n' https://soc.samuelkuhlmann.com/api/health/database || true
printf '\nDo NOT share secret tokens, private SSH keys or full Wazuh config.\n'
