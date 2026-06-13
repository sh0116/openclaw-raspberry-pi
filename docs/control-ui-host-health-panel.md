# Control UI host health panel

This note documents the current Raspberry Pi dashboard integration pattern.

## Goal

Show a small Raspberry Pi health panel inside OpenClaw Control without using a
floating overlay. The useful first-pass metrics are:

- CPU: one-minute load average
- MEM: system memory used percentage
- DISK: root filesystem used percentage
- TEMP: CPU temperature from `vcgencmd`

## Current plugin surface

The `host-health` plugin exposes two read-only HTTP routes:

- `GET /host-health/api`: JSON metrics for programmatic UI rendering.
- `GET /host-health`: standalone HTML dashboard for manual inspection.

The routes use `auth: "plugin"` because OpenClaw Control's normal browser page
does not automatically pass Gateway route auth into plugin HTTP routes. Keep the
Gateway bound to loopback or a trusted private network when enabling this panel.

## Control UI integration

OpenClaw 2026.6.1 accepts plugin UI descriptors, but the shipped Control UI does
not yet render arbitrary `plugins.uiDescriptors` as real panels. Until that
renderer exists upstream, the practical local integration is:

1. Keep data collection in the `host-health` plugin.
2. Fetch `/host-health/api` from the Control UI.
3. Render CPU/MEM/DISK/TEMP as a regular panel in the `Instances` tab.

The local Pi currently uses a small installed-file patch against:

```text
/home/pi/.npm-global/lib/node_modules/openclaw/dist/control-ui/assets/instances-DVoLFU96.js
```

That patch is intentionally treated as temporary. OpenClaw updates may replace
the hashed bundle file. The longer-term fix should be an upstream Control UI
renderer for plugin-provided UI descriptors.

## Desired upstream shape

The cleaner version is for Control UI to:

1. Call `plugins.uiDescriptors`.
2. Recognize a descriptor such as `kind: "host-health-card"`.
3. Dispatch the descriptor's action or fetch its route.
4. Render a first-class card in a chosen surface, for example `instances` or
   `overview`.

