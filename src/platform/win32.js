// Windows platform — netstat + wmic/PowerShell


import { execSync } from "child_process";
import { basename, dirname } from "path";


function exec(cmd, timeout = 10000) {
  try {
    return execSync(cmd, {
      encoding: "utf8",
      timeout,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function parseCSVLine(line) {
  const fields = [];
  let current = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

function getProcessNames(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  const pidCondition = pids.map((p) => `ProcessId=${p}`).join(" or ");
  const raw = exec(
    `wmic process where "(${pidCondition})" get ProcessId,Name /format:csv`,
    5000,
  );

  if (raw) {
    for (const line of raw.split(/\r?\n/).filter((l) => l.includes(","))) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        const name = parts[1];
        const pid = parseInt(parts[2], 10);
        if (!isNaN(pid)) {
          map.set(pid, name.replace(/\.exe$/i, ""));
        }
      }
    }
  }

  // Fallback for PS for missing PIDs
  for (const pid of pids) {
    if (!map.has(pid)) {
      const psOutput = exec(
        `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).ProcessName"`,
        3000,
      );
      if (psOutput) map.set(pid, psOutput);
    }
  }

  return map;
}

export function getListeningPortsRaw() {
  const entries = [];
  const portMap = new Map();

  const raw = exec("netstat -ano -p TCP");
  if (!raw) return entries;

  const lines = raw.split(/\r?\n/).filter((l) => l.includes("LISTENING"));
  const pidsToResolve = new Set();

  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length < 5) continue;

    const localAddr = parts[1];
    const portMatch = localAddr.match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1], 10);

    if (portMap.has(port)) continue;

    const pid = parseInt(parts[parts.length - 1], 10);
    if (isNaN(pid) || pid === 0) continue;

    portMap.set(port, true);
    pidsToResolve.add(pid);
    entries.push({ port, pid, processName: "" });
  }

  const processNames = getProcessNames([...pidsToResolve]);
  for (const entry of entries) {
    entry.processName = processNames.get(entry.pid) || "unknown";
  }

  return entries;
}

export function batchProcessInfo(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  const pidCondition = pids.map((p) => `ProcessId=${p}`).join(" or ");
  const raw = exec(
    `wmic process where "(${pidCondition})" get ProcessId,ParentProcessId,WorkingSetSize,CreationDate,CommandLine,Name /format:csv`,
    10000,
  );

  if (raw) {
    for (const line of raw
      .split(/\r?\n/)
      .filter((l) => l.trim() && l.includes(","))) {
      const parts = parseCSVLine(line);
      if (parts.length < 7) continue;

      const commandLine = parts[1] || "";
      const creationDate = parts[2] || "";
      const name = parts[3] || "";
      const ppid = parseInt(parts[4], 10) || 0;
      const pid = parseInt(parts[5], 10);
      const workingSetSize = parseInt(parts[6], 10) || 0;

      if (isNaN(pid)) continue;

      let lstart = "";
      if (creationDate && creationDate.length >= 14) {
        const y = creationDate.slice(0, 4);
        const mo = creationDate.slice(4, 6);
        const d = creationDate.slice(6, 8);
        const h = creationDate.slice(8, 10);
        const mi = creationDate.slice(10, 12);
        const s = creationDate.slice(12, 14);
        lstart = `${mo}/${d}/${y} ${h}:${mi}:${s}`;
      }

      map.set(pid, {
        ppid,
        stat: "S",
        rss: Math.round(workingSetSize / 1024),
        lstart,
        command: commandLine || name,
      });
    }
  }

  // PowerShell fallback if wmic returned nothing (wmic is deprecated)
  if (map.size === 0 && pids.length > 0) {
    const pidFilter = pids.map((p) => `$_.Id -eq ${p}`).join(" -or ");
    const psRaw = exec(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object {${pidFilter}} | Select-Object ProcessId,ParentProcessId,WorkingSetSize,CreationDate,CommandLine,Name | ConvertTo-Csv -NoTypeInformation"`,
      10000,
    );
    if (psRaw) {
      for (const line of psRaw.split(/\r?\n/).slice(1)) {
        const parts = parseCSVLine(line);
        if (parts.length < 6) continue;
        const pid = parseInt((parts[0] || "").replace(/"/g, ""), 10);
        const ppid = parseInt((parts[1] || "").replace(/"/g, ""), 10) || 0;
        const ws = parseInt((parts[2] || "").replace(/"/g, ""), 10) || 0;
        const startTime = (parts[3] || "").replace(/"/g, "");
        const cmdLine = (parts[4] || "").replace(/"/g, "");
        const name = (parts[5] || "").replace(/"/g, "");
        if (!isNaN(pid)) {
          map.set(pid, {
            ppid,
            stat: "S",
            rss: Math.round(ws / 1024),
            lstart: startTime,
            command: cmdLine || name,
          });
        }
      }
    }
  }

  return map;
}

export function batchCwd(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  // Windows: best we can do is get the executable path
  const pidCondition = pids.map((p) => `ProcessId=${p}`).join(" or ");
  const raw = exec(
    `wmic process where "(${pidCondition})" get ProcessId,ExecutablePath /format:csv`,
    5000,
  );

  if (raw) {
    for (const line of raw.split(/\r?\n/).filter((l) => l.includes(","))) {
      const parts = line.split(",");
      if (parts.length >= 3) {
        const exePath = parts[1];
        const pid = parseInt(parts[2], 10);
        if (!isNaN(pid) && exePath) {
          map.set(pid, dirname(exePath));
        }
      }
    }
  }

  // PS fallback
  if (map.size === 0 && pids.length > 0) {
    for (const pid of pids) {
      const psPath = exec(
        `powershell -NoProfile -Command "(Get-Process -Id ${pid} -ErrorAction SilentlyContinue).Path"`,
        3000,
      );
      if (psPath) map.set(pid, dirname(psPath));
    }
  }

  return map;
}

export function getAllProcessesRaw() {
  // Use PS for CPU% since wmic can't provide it in a snapshot
  const raw = exec(
    'powershell -NoProfile -Command "Get-Process | Select-Object Id,CPU,WorkingSet64,ProcessName,Path,StartTime | ConvertTo-Csv -NoTypeInformation"',
    10000,
  );

  if (!raw) return [];

  const entries = [];
  const seen = new Set();
  const lines = raw.split(/\r?\n/).slice(1); // skip CSV header

  for (const line of lines) {
    const parts = parseCSVLine(line);
    if (parts.length < 6) continue;

    const pid = parseInt(parts[0]?.replace(/"/g, ""), 10);
    if (isNaN(pid) || pid <= 4 || pid === process.pid || seen.has(pid))
      continue;
    seen.add(pid);

    const cpu = parseFloat(parts[1]?.replace(/"/g, "")) || 0;
    const ws = parseInt(parts[2]?.replace(/"/g, ""), 10) || 0;
    const processName = (parts[3] || "").replace(/"/g, "");
    const exePath = (parts[4] || "").replace(/"/g, "");
    const startTime = (parts[5] || "").replace(/"/g, "");

    entries.push({
      pid,
      processName,
      cpu,
      memPercent: 0,
      rss: Math.round(ws / 1024),
      lstart: startTime,
      command: exePath || processName,
    });
  }

  return entries;
}

export function getProcessTree(pid) {
  const tree = [];


  // Build process map via wmic
  const raw = exec(
    "wmic process get ProcessId,ParentProcessId,Name /format:csv",
    5000,
  );
  if (!raw) return tree;

  const processes = new Map();
  for (const line of raw.split(/\r?\n/).filter((l) => l.includes(","))) {
    const parts = line.split(",");
    if (parts.length >= 4) {
      const name = parts[1];
      const ppid = parseInt(parts[2], 10);
      const p = parseInt(parts[3], 10);
      if (!isNaN(p)) {
        processes.set(p, { pid: p, ppid: ppid || 0, name: name || "unknown" });
      }
    }
  }


  let currentPid = pid;
  let depth = 0;
  while (currentPid > 1 && depth < 8) {
    const proc = processes.get(currentPid);
    if (!proc) break;
    tree.push(proc);
    currentPid = proc.ppid;
    depth++;
  }

  return tree;
}


export function getConnectionCounts() {
  const connectionMap = new Map();
  
  try {
    const raw = exec("netstat -ano -p TCP");
    if (!raw) return connectionMap;

    const lines = raw.split(/\r?\n/).filter((l) => l.includes("ESTABLISHED"));
    
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 5) continue;

      const localAddr = parts[1];
      const portMatch = localAddr.match(/:(\d+)$/);
      if (!portMatch) continue;
      const port = parseInt(portMatch[1], 10);

      connectionMap.set(port, (connectionMap.get(port) || 0) + 1);
    }
  } catch { }

  return connectionMap;
}

