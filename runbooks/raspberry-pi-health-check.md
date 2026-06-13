# Raspberry Pi Health Check

## Quick Check

```bash
uptime
free -h
df -h
vcgencmd measure_temp
```

## Compact Check

```bash
uptime && free -h && df -h / /boot/firmware && vcgencmd measure_temp
```

## OpenClaw Session Hard Hang

Symptom: the Pi still has power, but SSH and OpenClaw stop responding until the
host is power-cycled. This usually means the host is hard-hung or saturated badly
enough that normal remote recovery is unavailable.

For an OpenClaw gateway host, use two layers:

1. Keep OpenClaw inside systemd cgroup limits so runaway sessions do not consume
   the whole Pi.
2. Enable the Raspberry Pi hardware watchdog through systemd so a host hard hang
   can reboot automatically.

Recommended OpenClaw gateway user-service drop-in:

```ini
# ~/.config/systemd/user/openclaw-gateway.service.d/resource-limits.conf
[Service]
CPUQuota=300%
MemoryHigh=10G
MemoryMax=12G
TasksMax=4096
```

Recommended systemd watchdog drop-in:

```ini
# /etc/systemd/system.conf.d/10-openclaw-watchdog.conf
[Manager]
RuntimeWatchdogSec=30s
RebootWatchdogSec=10min
```

Also enable persistent journald storage, so the next reboot after a crash can be
investigated:

```bash
sudo mkdir -p /var/log/journal
sudo systemd-tmpfiles --create --prefix /var/log/journal
sudo systemctl restart systemd-journald
```

The helper script applies these defaults:

```bash
bash scripts/apply-openclaw-resilience.sh
```

After applying, verify:

```bash
systemctl --user show openclaw-gateway.service \
  -p CPUQuotaPerSecUSec -p MemoryHigh -p MemoryMax -p TasksMax

systemctl show -p RuntimeWatchdogUSec -p RebootWatchdogUSec
```

If the Pi reboots after a future hang, inspect the previous boot:

```bash
journalctl -b -1 -p warning
journalctl -k -b -1
```

## What To Watch

- Load average staying above core count for a long time
- Memory available below 10-15%
- Swap usage increasing over time
- Disk usage above 80%
- Temperature staying above the throttling range
- OpenClaw gateway restarts or repeated connection failures
- SSH becoming unreachable during multiple concurrent OpenClaw sessions

## Notes

Momentary CPU spikes from OpenClaw, Codex, npm, or Quartz builds are expected. Treat sustained load, swap pressure, or disk exhaustion as operational problems.
