import { execFile } from "node:child_process"
import os from "node:os"
import { promisify } from "node:util"
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry"

const execFileAsync = promisify(execFile)

async function commandOrNull(command, args) {
  try {
    const { stdout } = await execFileAsync(command, args, { timeout: 2_000 })
    return stdout.trim()
  } catch {
    return null
  }
}

async function readTemperatureC() {
  const output = await commandOrNull("vcgencmd", ["measure_temp"])
  const value = output?.match(/temp=([0-9.]+)/)?.[1]
  return value ? Number(value) : null
}

async function readDisk(paths) {
  const output = await commandOrNull("df", ["-kP", ...paths])
  if (!output) return []

  return output
    .split("\n")
    .slice(1)
    .map((line) => line.trim().split(/\s+/))
    .filter((parts) => parts.length >= 6)
    .map((parts) => ({
      filesystem: parts[0],
      totalKb: Number(parts[1]),
      usedKb: Number(parts[2]),
      availableKb: Number(parts[3]),
      usedPercent: Number(parts[4].replace("%", "")),
      mount: parts[5],
    }))
}

async function collectHostHealth(config = {}) {
  const diskPaths = Array.isArray(config.diskPaths) && config.diskPaths.length > 0
    ? config.diskPaths
    : ["/", "/boot/firmware"]

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptimeSec: os.uptime(),
    loadavg: os.loadavg(),
    memory: {
      totalBytes: os.totalmem(),
      freeBytes: os.freemem(),
    },
    disk: await readDisk(diskPaths),
    temperatureC: await readTemperatureC(),
    checkedAt: new Date().toISOString(),
  }
}

export default definePluginEntry({
  id: "host-health",
  name: "Host Health",
  description: "Read-only Raspberry Pi host health for OpenClaw Control UI.",
  register(api) {
    api.session.controls.registerControlUiDescriptor({
      id: "raspberry-pi-health",
      surface: "settings",
      label: "Raspberry Pi Health",
      description: "CPU load, memory, disk, uptime, and temperature for the OpenClaw host.",
      placement: "overview",
      requiredScopes: ["operator.read"],
      schema: {
        kind: "host-health-card",
        action: {
          pluginId: "host-health",
          actionId: "read",
        },
        refreshMs: 5000,
        fields: [
          "loadavg",
          "memory",
          "disk",
          "temperatureC",
          "uptimeSec",
        ],
      },
    })

    api.session.controls.registerSessionAction({
      id: "read",
      description: "Read Raspberry Pi host health metrics.",
      requiredScopes: ["operator.read"],
      handler: async () => ({
        ok: true,
        result: await collectHostHealth(api.config ?? {}),
      }),
    })
  },
})

