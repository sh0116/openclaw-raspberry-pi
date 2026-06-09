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

## What To Watch

- Load average staying above core count for a long time
- Memory available below 10-15%
- Swap usage increasing over time
- Disk usage above 80%
- Temperature staying above the throttling range
- OpenClaw gateway restarts or repeated connection failures

## Notes

Momentary CPU spikes from OpenClaw, Codex, npm, or Quartz builds are expected. Treat sustained load, swap pressure, or disk exhaustion as operational problems.

