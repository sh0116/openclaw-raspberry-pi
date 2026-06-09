#!/usr/bin/env node
import { execFile } from "node:child_process"
import { createServer } from "node:http"
import os from "node:os"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const host = process.env.HOST_HEALTH_HOST ?? "127.0.0.1"
const port = Number(process.env.HOST_HEALTH_PORT ?? "8787")

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

async function health() {
  const diskPaths = ["/", "/boot/firmware"]
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

const server = createServer(async (req, res) => {
  if (req.method !== "GET" || req.url !== "/api/host/health") {
    res.writeHead(404, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: "not_found" }))
    return
  }

  res.writeHead(200, {
    "content-type": "application/json",
    "cache-control": "no-store",
  })
  res.end(JSON.stringify(await health(), null, 2))
})

server.listen(port, host, () => {
  console.log(`host health listening on http://${host}:${port}/api/host/health`)
})

