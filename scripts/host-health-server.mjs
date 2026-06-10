#!/usr/bin/env node
import { execFile } from "node:child_process"
import { createServer } from "node:http"
import os from "node:os"
import { promisify } from "node:util"

const execFileAsync = promisify(execFile)
const host = process.env.HOST_HEALTH_HOST ?? "127.0.0.1"
const port = Number(process.env.HOST_HEALTH_PORT ?? "8787")

const dashboardHtml = `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Raspberry Pi Health</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f7f8fb;
      --panel: #ffffff;
      --text: #111827;
      --muted: #667085;
      --border: #d8dee8;
      --blue: #2563eb;
      --green: #16803c;
      --amber: #b45309;
      --red: #b42318;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    main {
      width: min(1120px, calc(100vw - 32px));
      margin: 0 auto;
      padding: 28px 0 40px;
    }
    header {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
      margin-bottom: 18px;
    }
    h1 {
      margin: 0;
      font-size: 28px;
      line-height: 1.15;
      letter-spacing: 0;
    }
    .sub {
      margin-top: 8px;
      color: var(--muted);
      font-size: 14px;
    }
    .status-pill {
      border: 1px solid var(--border);
      background: var(--panel);
      border-radius: 999px;
      padding: 8px 12px;
      font-size: 13px;
      color: var(--muted);
      white-space: nowrap;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
    }
    .card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      min-height: 132px;
    }
    .card.wide {
      grid-column: span 2;
    }
    .label {
      color: var(--muted);
      font-size: 13px;
      margin-bottom: 10px;
    }
    .value {
      font-size: 30px;
      font-weight: 750;
      line-height: 1.1;
      letter-spacing: 0;
    }
    .unit {
      color: var(--muted);
      font-size: 14px;
      font-weight: 500;
      margin-left: 4px;
    }
    .detail {
      margin-top: 12px;
      color: var(--muted);
      font-size: 13px;
      line-height: 1.45;
    }
    .bar {
      height: 8px;
      border-radius: 999px;
      overflow: hidden;
      background: #e5e7eb;
      margin-top: 14px;
    }
    .bar > span {
      display: block;
      height: 100%;
      width: 0%;
      background: var(--blue);
      transition: width 180ms ease;
    }
    .bar.ok > span { background: var(--green); }
    .bar.warn > span { background: var(--amber); }
    .bar.hot > span { background: var(--red); }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    th, td {
      padding: 10px 8px;
      border-bottom: 1px solid var(--border);
      text-align: left;
    }
    th {
      color: var(--muted);
      font-weight: 650;
      font-size: 12px;
    }
    td:last-child, th:last-child { text-align: right; }
    code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
      font-size: 12px;
    }
    @media (max-width: 820px) {
      header { align-items: flex-start; flex-direction: column; }
      .grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .card.wide { grid-column: span 2; }
    }
    @media (max-width: 520px) {
      main { width: min(100vw - 20px, 1120px); padding-top: 18px; }
      .grid { grid-template-columns: 1fr; }
      .card.wide { grid-column: span 1; }
      h1 { font-size: 23px; }
      .value { font-size: 26px; }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <div>
        <h1>Raspberry Pi Health</h1>
        <div class="sub">OpenClaw host dashboard</div>
      </div>
      <div class="status-pill" id="status">loading</div>
    </header>
    <section class="grid">
      <article class="card">
        <div class="label">Load average</div>
        <div class="value" id="load">--</div>
        <div class="detail" id="loadDetail">1m / 5m / 15m</div>
      </article>
      <article class="card">
        <div class="label">Memory used</div>
        <div class="value"><span id="mem">--</span><span class="unit">%</span></div>
        <div class="bar" id="memBar"><span></span></div>
        <div class="detail" id="memDetail">--</div>
      </article>
      <article class="card">
        <div class="label">Temperature</div>
        <div class="value"><span id="temp">--</span><span class="unit">C</span></div>
        <div class="bar" id="tempBar"><span></span></div>
        <div class="detail">Raspberry Pi CPU</div>
      </article>
      <article class="card">
        <div class="label">Uptime</div>
        <div class="value" id="uptime">--</div>
        <div class="detail" id="hostDetail">--</div>
      </article>
      <article class="card wide">
        <div class="label">Disk</div>
        <table>
          <thead><tr><th>Mount</th><th>Used</th><th>Available</th><th>Usage</th></tr></thead>
          <tbody id="diskRows"><tr><td colspan="4">Loading</td></tr></tbody>
        </table>
      </article>
      <article class="card wide">
        <div class="label">Endpoint</div>
        <div class="detail">
          JSON: <code>/api/host/health</code><br>
          Refresh: 5 seconds<br>
          Access: bind host configured by <code>HOST_HEALTH_HOST</code>
        </div>
      </article>
    </section>
  </main>
  <script>
    const fmtBytes = (bytes) => {
      const units = ["B", "KiB", "MiB", "GiB", "TiB"]
      let value = bytes
      let idx = 0
      while (value >= 1024 && idx < units.length - 1) {
        value /= 1024
        idx += 1
      }
      return value.toFixed(idx === 0 ? 0 : 1) + " " + units[idx]
    }
    const fmtDuration = (seconds) => {
      const days = Math.floor(seconds / 86400)
      const hours = Math.floor((seconds % 86400) / 3600)
      const minutes = Math.floor((seconds % 3600) / 60)
      if (days > 0) return days + "d " + hours + "h"
      if (hours > 0) return hours + "h " + minutes + "m"
      return minutes + "m"
    }
    const setBar = (id, pct, warnAt = 75, hotAt = 90) => {
      const bar = document.getElementById(id)
      bar.className = "bar " + (pct >= hotAt ? "hot" : pct >= warnAt ? "warn" : "ok")
      bar.querySelector("span").style.width = Math.max(0, Math.min(100, pct)) + "%"
    }
    async function loadHealth() {
      const status = document.getElementById("status")
      try {
        const res = await fetch("/api/host/health", { cache: "no-store" })
        const data = await res.json()
        const memUsed = 100 - (data.memory.freeBytes / data.memory.totalBytes * 100)
        document.getElementById("load").textContent = data.loadavg[0].toFixed(2)
        document.getElementById("loadDetail").textContent = data.loadavg.map((v) => v.toFixed(2)).join(" / ")
        document.getElementById("mem").textContent = memUsed.toFixed(1)
        document.getElementById("memDetail").textContent = fmtBytes(data.memory.totalBytes - data.memory.freeBytes) + " used / " + fmtBytes(data.memory.totalBytes)
        setBar("memBar", memUsed)
        document.getElementById("temp").textContent = data.temperatureC == null ? "--" : data.temperatureC.toFixed(1)
        setBar("tempBar", data.temperatureC ?? 0, 70, 80)
        document.getElementById("uptime").textContent = fmtDuration(data.uptimeSec)
        document.getElementById("hostDetail").textContent = data.hostname + " · " + data.arch
        document.getElementById("diskRows").innerHTML = data.disk.map((disk) => (
          "<tr><td><code>" + disk.mount + "</code></td><td>" + fmtBytes(disk.usedKb * 1024) + "</td><td>" + fmtBytes(disk.availableKb * 1024) + "</td><td>" + disk.usedPercent + "%</td></tr>"
        )).join("")
        status.textContent = "updated " + new Date(data.checkedAt).toLocaleTimeString()
      } catch (error) {
        status.textContent = "offline"
      }
    }
    loadHealth()
    setInterval(loadHealth, 5000)
  </script>
</body>
</html>`

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
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`)

  if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/dashboard")) {
    res.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
    })
    res.end(dashboardHtml)
    return
  }

  if (req.method !== "GET" || url.pathname !== "/api/host/health") {
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
