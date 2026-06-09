#!/usr/bin/env bash
set -euo pipefail

echo "== uptime =="
uptime

echo
echo "== memory =="
free -h

echo
echo "== disk =="
df -h / /boot/firmware 2>/dev/null || df -h /

echo
echo "== temperature =="
if command -v vcgencmd >/dev/null 2>&1; then
  vcgencmd measure_temp
else
  echo "vcgencmd not available"
fi

