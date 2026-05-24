// macOS (Darwin) platform — lsof + ps


import { execSync } from "child_process";
import { basename } from "path";

export function getListeningPortsRaw() {
  let raw;
  try {
    raw = execSync("lsof -iTCP -sTCP:LISTEN -P -n 2>/dev/null", {
      encoding: "utf8",
      timeout: 10000,
    });
  } catch {
    return [];
  }

  const lines = raw.trim().split("\n").slice(1);
  const portMap = new Map();
  const entries = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length < 9) continue;

    const processName = parts[0];
    const pid = parseInt(parts[1], 10);
    const nameField = parts[8];

    const portMatch = nameField.match(/:(\d+)$/);
    if (!portMatch) continue;
    const port = parseInt(portMatch[1], 10);

    const bindMatch = nameField.match(/^([^:]+):/);
    let bindAddress = bindMatch ? bindMatch[1] : "0.0.0.0";
    if (bindAddress === "*" || bindAddress === "*.*") bindAddress = "0.0.0.0";

    if (portMap.has(port)) continue;
    portMap.set(port, true);
    entries.push({ port, pid, processName, bindAddress });
  }

  return entries;
}


export function batchProcessInfo(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  try {
    const pidList = pids.join(",");
    const raw = execSync(
      `ps -p ${pidList} -o pid=,ppid=,stat=,rss=,lstart=,command= 2>/dev/null`,
      { encoding: "utf8", timeout: 5000 },
    ).trim();

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const m = line
        .trim()
        .match(
          /^(\d+)\s+(\d+)\s+(\S+)\s+(\d+)\s+\w+\s+(\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.*)$/,
        );
      if (!m) continue;
      map.set(parseInt(m[1], 10), {
        ppid: parseInt(m[2], 10),
        stat: m[3],
        rss: parseInt(m[4], 10),
        lstart: m[5],
        command: m[6],
      });
    }
  } catch { }
  return map;
}


export function batchCwd(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  try {
    const pidList = pids.join(",");
    const raw = execSync(`lsof -a -d cwd -p ${pidList} 2>/dev/null`, {
      encoding: "utf8",
      timeout: 10000,
    }).trim();

    const lines = raw.split("\n").slice(1);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;
      const pid = parseInt(parts[1], 10);
      const path = parts.slice(8).join(" ");
      if (path && path.startsWith("/")) {
        map.set(pid, path);
      }
    }
  } catch { }
  return map;
}

export function getAllProcessesRaw() {
  let raw;
  try {
    raw = execSync(
      "ps -eo pid=,pcpu=,pmem=,rss=,lstart=,command= 2>/dev/null",
      { encoding: "utf8", timeout: 5000 },
    ).trim();
  } catch {
    return [];
  }

  const entries = [];
  const seen = new Set();

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    const m = line
      .trim()
      .match(
        /^(\d+)\s+([\d.]+)\s+([\d.]+)\s+(\d+)\s+\w+\s+(\w+\s+\d+\s+[\d:]+\s+\d+)\s+(.*)$/,
      );
    if (!m) continue;

    const pid = parseInt(m[1], 10);
    if (pid <= 1 || pid === process.pid || seen.has(pid)) continue;
    seen.add(pid);

    const command = m[6];
    const processName = basename(command.split(/\s+/)[0]);

    entries.push({
      pid,
      processName,
      cpu: parseFloat(m[2]),
      memPercent: parseFloat(m[3]),
      rss: parseInt(m[4], 10),
      lstart: m[5],
      command,
    });
  }

  return entries;
}


export function getProcessTree(pid) {
  const tree = [];
  try {
    const raw = execSync("ps -eo pid=,ppid=,comm= 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();

    const processes = new Map();
    for (const line of raw.split("\n")) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 3) continue;
      const p = parseInt(parts[0], 10);
      const pp = parseInt(parts[1], 10);
      processes.set(p, { pid: p, ppid: pp, name: parts.slice(2).join(" ") });
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
  } catch { }
  return tree;
}

/**
 * Get connection counts for all listening ports
 * Returns a Map of port -> connection count
 */
export function getConnectionCounts() {
  const connectionMap = new Map();
  try {
    // Get all TCP connections (ESTABLISHED state)
    const raw = execSync("lsof -iTCP -sTCP:ESTABLISHED -P -n 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    });

    const lines = raw.trim().split("\n").slice(1);
    for (const line of lines) {
      const parts = line.split(/\s+/);
      if (parts.length < 9) continue;

      const localAddr = parts[8];
      const portMatch = localAddr.match(/:(\d+)$/);
      if (!portMatch) continue;
      const port = parseInt(portMatch[1], 10);

      connectionMap.set(port, (connectionMap.get(port) || 0) + 1);
    }
  } catch { }
  return connectionMap;
}

export function getThroughput(pids) {
  const map = new Map();
  if (pids.length === 0) return map;
  
  try {
    const raw = execSync("nettop -P -L 1 -J bytes_in,bytes_out 2>/dev/null", {
      encoding: "utf8",
      timeout: 3000
    });
    
    const pidSet = new Set(pids);
    const lines = raw.trim().split("\n").slice(1);
    for (const line of lines) {
      if (!line) continue;
      const parts = line.split(",");
      if (parts.length < 3) continue;
      
      const namePid = parts[0];
      const match = namePid.match(/\.(\d+)$/);
      if (!match) continue;
      const pid = parseInt(match[1], 10);
      
      if (pidSet.has(pid)) {
        const bytesIn = parseInt(parts[1], 10) || 0;
        const bytesOut = parseInt(parts[2], 10) || 0;
        
        const existing = map.get(pid) || { bytesIn: 0, bytesOut: 0 };
        map.set(pid, {
          bytesIn: existing.bytesIn + bytesIn,
          bytesOut: existing.bytesOut + bytesOut
        });
      }
    }
  } catch {}
  return map;
}
