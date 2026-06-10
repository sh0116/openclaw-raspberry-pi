# Host Health Plugin

OpenClaw native plugin prototype that exposes Raspberry Pi host metrics as a Control UI descriptor and read-only session action.

## Runtime Shape

- Registers Control UI descriptor: `raspberry-pi-health`
- Registers session action: `host-health/read`
- Requires operator read scope: `operator.read`
- Collects metrics from Node `os`, `df`, and Raspberry Pi `vcgencmd`

## Planned Features

- Read-only host metric collection
- Operator-only Control UI descriptor
- Safe JSON output through plugin session action
- Configurable disk mount list
- Raspberry Pi temperature support via `vcgencmd`

## Non-Goals

- No write actions
- No public unauthenticated endpoint
- No private IP, token, credential, or process argument exposure

## Local Install

```bash
openclaw plugins install --link /home/pi/projects/openclaw-raspberry-pi/plugins/host-health
openclaw plugins inspect host-health --runtime --json
```
