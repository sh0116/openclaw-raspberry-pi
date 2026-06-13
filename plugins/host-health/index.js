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

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader("cache-control", "no-store")
  res.setHeader("content-type", "application/json; charset=utf-8")
  res.end(JSON.stringify(body, null, 2))
}

function sendHtml(res, status, body) {
  res.statusCode = status
  res.setHeader("cache-control", "no-store")
  res.setHeader("content-type", "text/html; charset=utf-8")
  res.end(body)
}

function createDashboardHtml() {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Raspberry Pi Health</title>
  <style>
    body{margin:0;background:#f7f8fb;color:#111827;font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
    main{width:min(960px,calc(100vw - 32px));margin:0 auto;padding:28px 0}
    h1{margin:0 0 8px;font-size:28px;letter-spacing:0}.sub{color:#667085;margin-bottom:18px}
    .grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
    .card{background:#fff;border:1px solid #d8dee8;border-radius:8px;padding:16px;min-height:120px}
    .wide{grid-column:span 2}.label{font-size:13px;color:#667085;margin-bottom:10px}.value{font-size:30px;font-weight:750}
    .detail{font-size:13px;color:#667085;margin-top:12px;line-height:1.45}.bar{height:8px;border-radius:999px;background:#e5e7eb;overflow:hidden;margin-top:12px}.bar span{display:block;height:100%;width:0;background:#16803c}
    table{width:100%;border-collapse:collapse;font-size:14px}th,td{padding:9px 6px;border-bottom:1px solid #d8dee8;text-align:left}th{font-size:12px;color:#667085}td:last-child,th:last-child{text-align:right}
    @media(max-width:760px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.wide{grid-column:span 2}}@media(max-width:480px){.grid{grid-template-columns:1fr}.wide{grid-column:span 1}}
  </style>
</head>
<body>
<main>
  <h1>Raspberry Pi Health</h1>
  <div class="sub" id="status">Loading</div>
  <section class="grid">
    <article class="card"><div class="label">Load</div><div class="value" id="load">--</div><div class="detail" id="loadDetail">1m / 5m / 15m</div></article>
    <article class="card"><div class="label">Memory</div><div class="value"><span id="mem">--</span>%</div><div class="bar"><span id="memBar"></span></div><div class="detail" id="memDetail">--</div></article>
    <article class="card"><div class="label">Temp</div><div class="value"><span id="temp">--</span>C</div><div class="detail">CPU temperature</div></article>
    <article class="card"><div class="label">Uptime</div><div class="value" id="uptime">--</div><div class="detail" id="host">--</div></article>
    <article class="card wide"><div class="label">Disk</div><table><thead><tr><th>Mount</th><th>Used</th><th>Free</th><th>%</th></tr></thead><tbody id="disk"></tbody></table></article>
  </section>
</main>
<script>
const fmtBytes=b=>{const u=["B","KiB","MiB","GiB","TiB"];let v=b,i=0;while(v>=1024&&i<u.length-1){v/=1024;i++}return v.toFixed(i?1:0)+" "+u[i]}
const fmtDuration=s=>{const d=Math.floor(s/86400),h=Math.floor(s%86400/3600),m=Math.floor(s%3600/60);return d?d+"d "+h+"h":h?h+"h "+m+"m":m+"m"}
async function load(){const r=await fetch("/host-health/api",{cache:"no-store"});const x=await r.json();const mu=100-(x.memory.freeBytes/x.memory.totalBytes*100);loadDetail.textContent=x.loadavg.map(v=>v.toFixed(2)).join(" / ");load.textContent=x.loadavg[0].toFixed(2);mem.textContent=mu.toFixed(1);memBar.style.width=Math.max(0,Math.min(100,mu))+"%";memDetail.textContent=fmtBytes(x.memory.totalBytes-x.memory.freeBytes)+" used / "+fmtBytes(x.memory.totalBytes);temp.textContent=x.temperatureC==null?"--":x.temperatureC.toFixed(1);uptime.textContent=fmtDuration(x.uptimeSec);host.textContent=x.hostname+" - "+x.arch;disk.innerHTML=x.disk.map(d=>"<tr><td>"+d.mount+"</td><td>"+fmtBytes(d.usedKb*1024)+"</td><td>"+fmtBytes(d.availableKb*1024)+"</td><td>"+d.usedPercent+"%</td></tr>").join("");status.textContent="Updated "+new Date(x.checkedAt).toLocaleTimeString()}
load().catch(()=>status.textContent="Failed to load");setInterval(()=>load().catch(()=>{}),5000)
</script>
</body>
</html>`
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

    api.registerHttpRoute({
      path: "/host-health/api",
      auth: "plugin",
      match: "exact",
      handler: async (_req, res) => {
        sendJson(res, 200, await collectHostHealth(api.config ?? {}))
        return true
      },
    })

    api.registerHttpRoute({
      path: "/host-health",
      auth: "plugin",
      match: "exact",
      handler: async (_req, res) => {
        sendHtml(res, 200, createDashboardHtml())
        return true
      },
    })
  },
})
