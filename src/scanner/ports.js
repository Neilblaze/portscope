import { execSync } from "child_process";
import { basename } from "path";
import { getPlatform } from "../platform/index.js";
import {
  findProjectRoot,
  formatUptime,
  formatMemory,
  isDevProcess,
} from "./utils.js";
import {
  detectFramework,
  detectFrameworkFromCommand,
  detectFrameworkFromImage,
} from "./framework.js";


/**
 * Batch-fetch docker container info mapped by host port. Also, Docker CLI is cross-platform.
 */
function batchDockerInfo() {
  const map = new Map();
  try {
    const raw = execSync(
      'docker ps --format "{{.Ports}}\\t{{.Names}}\\t{{.Image}}" 2>/dev/null',
      { encoding: "utf8", timeout: 5000 },
    ).trim();

    for (const line of raw.split("\n")) {
      if (!line.trim()) continue;
      const [portsStr, name, image] = line.split("\t");
      if (!portsStr || !name) continue;

      const portMatches = portsStr.matchAll(
        /(?:\d+\.\d+\.\d+\.\d+|::):(\d+)->/g,
      );
      const seen = new Set();
      for (const m of portMatches) {
        const port = parseInt(m[1], 10);
        if (!seen.has(port)) {
          seen.add(port);
          map.set(port, { name, image });
        }
      }
    }
  } catch { }
  return map;
}

// Get all listening ports with process info
export async function getListeningPorts(detailed = false) {
  const platform = await getPlatform();
  const entries = platform.getListeningPortsRaw();

  const uniquePids = [...new Set(entries.map((e) => e.pid))];

  const psMap = platform.batchProcessInfo(uniquePids);
  const cwdMap = platform.batchCwd(uniquePids);
  const hasDocker = entries.some(
    (e) => e.processName.startsWith("com.docke") || e.processName === "docker",
  );
  const dockerMap = hasDocker ? batchDockerInfo() : new Map();

  const results = entries.map(({ port, pid, processName }) => {
    const ps = psMap.get(pid);
    const cwd = cwdMap.get(pid);

    // lsof truncates process names (~9 chars on macOS). 
    // Use the full binary name from ps command path when available.
    let fullProcessName = processName;
    if (ps && ps.command) {
      const cmdBin = basename(ps.command.split(/\s+/)[0]);
      if (cmdBin && cmdBin.length > fullProcessName.length) {
        fullProcessName = cmdBin;
      }
    }

    const info = {
      port,
      pid,
      processName: fullProcessName,
      rawName: processName,
      command: ps ? ps.command : "",
      cwd: null,
      projectName: null,
      framework: null,
      uptime: null,
      startTime: null,
      status: "healthy",
      memory: null,
      gitBranch: null,
      processTree: [],
    };

    if (ps) {
      if (ps.stat.includes("Z")) info.status = "zombie";
      else if (ps.ppid === 1 && isDevProcess(processName, ps.command))
        info.status = "orphaned";

      if (ps.rss > 0) info.memory = formatMemory(ps.rss);

      if (ps.lstart) {
        info.startTime = new Date(ps.lstart);
        if (!isNaN(info.startTime.getTime())) {
          info.uptime = formatUptime(Date.now() - info.startTime.getTime());
        }
      }

      if (!info.framework) {
        info.framework = detectFrameworkFromCommand(ps.command, processName);
      }
    }

    const docker = dockerMap.get(port);
    if (docker) {
      info.projectName = docker.name;
      info.framework = detectFrameworkFromImage(docker.image);
      info.processName = "docker";
    }

    if (cwd && !docker) {
      const projectRoot = findProjectRoot(cwd);
      info.cwd = projectRoot;
      info.projectName = basename(projectRoot);
      info.framework = info.framework || detectFramework(projectRoot);

      if (detailed) {
        try {
          info.gitBranch = execSync(
            `git -C "${info.cwd}" rev-parse --abbrev-ref HEAD 2>/dev/null`,
            { encoding: "utf8", timeout: 3000 },
          ).trim();
        } catch { }
      }
    }

    if (detailed) {
      info.processTree = platform.getProcessTree(pid);
    }

    return info;
  });

  return results.sort((a, b) => a.port - b.port);
}

/**
 * Get detailed info for a specific port.
 */
export async function getPortDetails(targetPort) {
  const ports = await getListeningPorts(true);
  return ports.find((p) => p.port === targetPort) || null;
}

export function watchPorts(callback, intervalMs = 2000) {
  let previousPorts = new Set();
  let running = false;

  const check = async () => {
    if (running) return;
    running = true;
    try {
      const current = await getListeningPorts();
      const currentSet = new Set(current.map((p) => p.port));

      for (const p of current) {
        if (!previousPorts.has(p.port)) {
          callback("new", p);
        }
      }

      for (const port of previousPorts) {
        if (!currentSet.has(port)) {
          callback("removed", { port });
        }
      }

      previousPorts = currentSet;
    } finally {
      running = false;
    }
  };

  check();
  return setInterval(check, intervalMs);
}
