// Linux platform — ss/netstat + /proc filesystem


import { execSync } from "child_process";
import { existsSync, readFileSync, readdirSync, readlinkSync } from "fs";
import { basename } from "path";


function commandExists(cmd) {
  try {
    execSync(`which ${cmd} 2>/dev/null`, { encoding: "utf8" });
    return true;
  } catch {
    return false;
  }
}

function getProcessNameFromProc(pid) {
  try {
    const commPath = `/proc/${pid}/comm`;
    if (existsSync(commPath)) {
      return readFileSync(commPath, "utf8").trim();
    }
  } catch { }
  return "unknown";
}

export function getListeningPortsRaw() {
  const entries = [];
  const portMap = new Map();

  if (commandExists("ss")) {
    try {
      const raw = execSync("ss -tlnp 2>/dev/null", {
        encoding: "utf8",
        timeout: 10000,
      });

      const lines = raw.trim().split("\n").slice(1);
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue;

        const localAddr = parts[3];
        const portMatch = localAddr.match(/:(\d+)$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);

        if (portMap.has(port)) continue;

        const usersField = parts.slice(5).join(" ");
        const pidMatch = usersField.match(/pid=(\d+)/);
        const nameMatch = usersField.match(/\("([^"]+)"/);

        if (pidMatch) {
          const pid = parseInt(pidMatch[1], 10);
          const processName = nameMatch
            ? nameMatch[1]
            : getProcessNameFromProc(pid);

          let bindAddress = "0.0.0.0";
          const ipv6Match = localAddr.match(/^\[([^\]]*)\]:/);
          if (ipv6Match) {
            const v6 = ipv6Match[1];
            bindAddress = (v6 === "::" || v6 === "" || v6 === "*") ? "0.0.0.0" : v6;
          } else {
            const ipv4Match = localAddr.match(/^([^:]+):/);
            if (ipv4Match) {
              const v4 = ipv4Match[1];
              bindAddress = (v4 === "*" || v4 === "*.*") ? "0.0.0.0" : v4;
            }
          }

          portMap.set(port, true);
          entries.push({ port, pid, processName, bindAddress });
        }
      }
    } catch { }
  }

  if (entries.length === 0 && commandExists("netstat")) {
    try {
      const raw = execSync("netstat -tlnp 2>/dev/null", {
        encoding: "utf8",
        timeout: 10000,
      });

      for (const line of raw.trim().split("\n")) {
        if (!line.includes("LISTEN")) continue;
        const parts = line.split(/\s+/);
        if (parts.length < 7) continue;

        const localAddr = parts[3];
        const portMatch = localAddr.match(/:(\d+)$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);

        if (portMap.has(port)) continue;

        const pidProgram = parts[parts.length - 1];
        const pidProgMatch = pidProgram.match(/^(\d+)\/(.+)$/);
        if (pidProgMatch) {
          const pid = parseInt(pidProgMatch[1], 10);

          let bindAddress = "0.0.0.0";
          const ipv6Match = localAddr.match(/^\[([^\]]*)\]:/);
          if (ipv6Match) {
            const v6 = ipv6Match[1];
            bindAddress = (v6 === "::" || v6 === "" || v6 === "*") ? "0.0.0.0" : v6;
          } else {
            const ipv4Match = localAddr.match(/^([^:]+):/);
            if (ipv4Match) {
              const v4 = ipv4Match[1];
              bindAddress = (v4 === "*" || v4 === "*.*") ? "0.0.0.0" : v4;
            }
          }

          portMap.set(port, true);
          entries.push({ port, pid, processName: pidProgMatch[2], bindAddress });
        }
      }
    } catch { }
  }

  return entries;
}

export function batchProcessInfo(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  // Use ps for batch info
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

  // Fill in any missing PIDs from /proc
  for (const pid of pids) {
    if (map.has(pid)) continue;
    try {
      const procDir = `/proc/${pid}`;
      if (!existsSync(procDir)) continue;

      const statContent = readFileSync(`${procDir}/stat`, "utf8");
      const lastParen = statContent.lastIndexOf(")");
      const afterComm = statContent.slice(lastParen + 2).split(" ");
      const stat = afterComm[0] || "?";
      const ppid = parseInt(afterComm[1], 10) || 0;

      let rss = 0;
      try {
        const statmContent = readFileSync(`${procDir}/statm`, "utf8");
        rss = (parseInt(statmContent.split(" ")[1], 10) || 0) * 4;
      } catch { }

      let command = "";
      try {
        command = readFileSync(`${procDir}/cmdline`, "utf8")
          .split("\0")
          .filter(Boolean)
          .join(" ");
      } catch { }

      map.set(pid, {
        ppid,
        stat,
        rss,
        lstart: "",
        command: command || getProcessNameFromProc(pid),
      });
    } catch { }
  }

  return map;
}

export function batchCwd(pids) {
  const map = new Map();
  if (pids.length === 0) return map;

  for (const pid of pids) {
    try {
      const cwdLink = `/proc/${pid}/cwd`;
      if (existsSync(cwdLink)) {
        const cwd = readlinkSync(cwdLink);
        if (cwd && cwd.startsWith("/")) {
          map.set(pid, cwd);
        }
      }
    } catch { }
  }

  return map;
}

export function getAllProcessesRaw() {
  let raw;
  try {
    raw = execSync("ps -eo pid=,pcpu=,pmem=,rss=,lstart=,cmd= 2>/dev/null", {
      encoding: "utf8",
      timeout: 5000,
    }).trim();
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
  const processes = new Map();

  try {
    const procDirs = readdirSync("/proc").filter((d) => /^\d+$/.test(d));
    for (const dir of procDirs) {
      try {
        const p = parseInt(dir, 10);
        const statContent = readFileSync(`/proc/${dir}/stat`, "utf8");
        const commStart = statContent.indexOf("(");
        const commEnd = statContent.lastIndexOf(")");
        const name = statContent.slice(commStart + 1, commEnd);
        const afterComm = statContent.slice(commEnd + 2).split(" ");
        const ppid = parseInt(afterComm[1], 10) || 0;
        processes.set(p, { pid: p, ppid, name });
      } catch { }
    }
  } catch { }

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

  if (commandExists("ss")) {
    try {
      const raw = execSync("ss -tn state established 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      });

      const lines = raw.trim().split("\n").slice(1);
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 4) continue;

        const localAddr = parts[3];
        const portMatch = localAddr.match(/:(\d+)$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);

        connectionMap.set(port, (connectionMap.get(port) || 0) + 1);
      }
      return connectionMap;
    } catch { }
  }

  if (commandExists("netstat")) {
    try {
      const raw = execSync("netstat -tn 2>/dev/null | grep ESTABLISHED", {
        encoding: "utf8",
        timeout: 5000,
      });

      for (const line of raw.trim().split("\n")) {
        const parts = line.split(/\s+/);
        if (parts.length < 4) continue;

        const localAddr = parts[3];
        const portMatch = localAddr.match(/:(\d+)$/);
        if (!portMatch) continue;
        const port = parseInt(portMatch[1], 10);

        connectionMap.set(port, (connectionMap.get(port) || 0) + 1);
      }
    } catch { }
  }

  return connectionMap;
}

export function getPortTopology(listeningPorts) {
  const topology = new Map();

  if (commandExists("ss")) {
    try {
      const raw = execSync("ss -tn state established 2>/dev/null", {
        encoding: "utf8",
        timeout: 5000,
      });

      const lines = raw.trim().split("\n").slice(1);
      for (const line of lines) {
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue;

        const localAddr = parts[3];
        const peerAddr = parts[4];

        const localMatch = localAddr.match(/:(\d+)$/);
        const peerMatch = peerAddr.match(/:(\d+)$/);
        if (!localMatch || !peerMatch) continue;

        const localPort = parseInt(localMatch[1], 10);
        const remotePort = parseInt(peerMatch[1], 10);

        if (!listeningPorts.has(localPort)) continue;

        if (!topology.has(localPort)) {
          topology.set(localPort, { connectedPorts: new Set(), remoteConnections: 0 });
        }

        const entry = topology.get(localPort);
        const remoteHost = peerAddr.replace(/:(\d+)$/, "");
        const isLocalRemote =
          listeningPorts.has(remotePort) &&
          (remoteHost === "127.0.0.1" || remoteHost === "::1" || remoteHost === "[::1]" || remoteHost === "localhost");

        if (isLocalRemote) {
          entry.connectedPorts.add(remotePort);
        } else {
          entry.remoteConnections++;
        }
      }
      return topology;
    } catch { }
  }

  // Fallback: netstat
  if (commandExists("netstat")) {
    try {
      const raw = execSync("netstat -tn 2>/dev/null | grep ESTABLISHED", {
        encoding: "utf8",
        timeout: 5000,
      });

      for (const line of raw.trim().split("\n")) {
        const parts = line.split(/\s+/);
        if (parts.length < 5) continue;

        const localAddr = parts[3];
        const peerAddr = parts[4];

        const localMatch = localAddr.match(/:(\d+)$/);
        const peerMatch = peerAddr.match(/:(\d+)$/);
        if (!localMatch || !peerMatch) continue;

        const localPort = parseInt(localMatch[1], 10);
        const remotePort = parseInt(peerMatch[1], 10);

        if (!listeningPorts.has(localPort)) continue;

        if (!topology.has(localPort)) {
          topology.set(localPort, { connectedPorts: new Set(), remoteConnections: 0 });
        }

        const entry = topology.get(localPort);
        const remoteHost = peerAddr.replace(/:(\d+)$/, "");
        const isLocalRemote =
          listeningPorts.has(remotePort) &&
          (remoteHost === "127.0.0.1" || remoteHost === "::1" || remoteHost === "localhost");

        if (isLocalRemote) {
          entry.connectedPorts.add(remotePort);
        } else {
          entry.remoteConnections++;
        }
      }
    } catch { }
  }

  return topology;
}

export function getThroughput(pids) {
  return new Map();
}
