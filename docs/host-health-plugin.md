# Host Health Plugin

## Purpose

Raspberry Pi에서 실행 중인 OpenClaw Control UI에 host 상태를 read-only 카드로 보여준다.

## Metrics

- Hostname
- Uptime
- Load average
- CPU temperature
- Memory total/free/available
- Swap usage
- Disk usage for `/`, `/boot/firmware`, and optional configured paths
- OpenClaw gateway uptime or service state

## Preferred Shape

1. Plugin registers a Control UI descriptor.
2. Plugin registers a read-only session action or gateway-accessible method.
3. Control UI renders the descriptor in an overview/settings surface.
4. Metrics refresh every 5-10 seconds.

## Descriptor Sketch

```ts
api.session.controls.registerControlUiDescriptor({
  id: "host-health",
  surface: "settings",
  label: "Host Health",
  description: "Raspberry Pi CPU, memory, disk, temperature, and uptime.",
  placement: "overview",
  requiredScopes: ["operator"],
  schema: {
    kind: "host-health-card"
  }
})
```

## Action Sketch

```ts
api.session.controls.registerSessionAction({
  id: "hostHealth.read",
  description: "Read host health metrics.",
  requiredScopes: ["operator"],
  handler: async () => ({
    ok: true,
    result: await collectHostHealth()
  })
})
```

## Security Notes

- Do not expose process arguments by default.
- Do not expose private network addresses by default.
- Keep the route authenticated and operator-only.
- Prefer loopback or tailnet-only access.
- Return structured numbers, not raw shell output.

