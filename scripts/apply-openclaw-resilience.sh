#!/usr/bin/env bash
set -euo pipefail

OPENCLAW_GATEWAY_UNIT="${OPENCLAW_GATEWAY_UNIT:-openclaw-gateway.service}"
CPU_QUOTA="${CPU_QUOTA:-300%}"
MEMORY_HIGH="${MEMORY_HIGH:-10G}"
MEMORY_MAX="${MEMORY_MAX:-12G}"
TASKS_MAX="${TASKS_MAX:-4096}"
WATCHDOG_RUNTIME="${WATCHDOG_RUNTIME:-30s}"
WATCHDOG_REBOOT="${WATCHDOG_REBOOT:-10min}"

if [[ "${EUID}" -eq 0 ]]; then
  echo "Run this as the OpenClaw user, not root, so systemctl --user targets the right service." >&2
  exit 1
fi

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "Missing required command: $1" >&2
    exit 1
  fi
}

require_command systemctl
require_command sudo

USER_DROPIN_DIR="${HOME}/.config/systemd/user/${OPENCLAW_GATEWAY_UNIT}.d"
USER_DROPIN="${USER_DROPIN_DIR}/resource-limits.conf"
SYSTEMD_DROPIN_DIR="/etc/systemd/system.conf.d"
SYSTEMD_DROPIN="${SYSTEMD_DROPIN_DIR}/10-openclaw-watchdog.conf"

echo "== Writing OpenClaw gateway resource limits =="
mkdir -p "${USER_DROPIN_DIR}"
cat >"${USER_DROPIN}" <<EOF
[Service]
CPUQuota=${CPU_QUOTA}
MemoryHigh=${MEMORY_HIGH}
MemoryMax=${MEMORY_MAX}
TasksMax=${TASKS_MAX}
EOF

systemctl --user daemon-reload

if systemctl --user is-active --quiet "${OPENCLAW_GATEWAY_UNIT}"; then
  echo "== Applying runtime limits to ${OPENCLAW_GATEWAY_UNIT} =="
  systemctl --user set-property --runtime "${OPENCLAW_GATEWAY_UNIT}" \
    "CPUQuota=${CPU_QUOTA}" \
    "MemoryHigh=${MEMORY_HIGH}" \
    "MemoryMax=${MEMORY_MAX}" \
    "TasksMax=${TASKS_MAX}"
else
  echo "== ${OPENCLAW_GATEWAY_UNIT} is not active; limits will apply on next start =="
fi

echo "== Writing systemd hardware watchdog config =="
sudo mkdir -p "${SYSTEMD_DROPIN_DIR}"
tmpfile="$(mktemp)"
trap 'rm -f "${tmpfile}"' EXIT
cat >"${tmpfile}" <<EOF
[Manager]
RuntimeWatchdogSec=${WATCHDOG_RUNTIME}
RebootWatchdogSec=${WATCHDOG_REBOOT}
EOF
sudo install -m 0644 "${tmpfile}" "${SYSTEMD_DROPIN}"
sudo systemctl daemon-reexec

echo "== Enabling persistent journald storage =="
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald

echo "== Verification =="
systemctl --user show "${OPENCLAW_GATEWAY_UNIT}" \
  -p CPUQuotaPerSecUSec \
  -p MemoryHigh \
  -p MemoryMax \
  -p TasksMax
systemctl show -p RuntimeWatchdogUSec -p RebootWatchdogUSec
