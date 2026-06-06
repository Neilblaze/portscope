import { execSync } from "child_process";
import { basename } from "path";
import { getPlatform } from "../platform/index.js";
import { promptSudoAction } from "../utils/sudo.js";
import { isSystemProcess, formatBlockMessage } from "./system-guard.js";
import { findProjectRoot, formatUptime, formatMemory, summarizeCommand } from "./utils.js";
import { detectFramework, detectFrameworkFromCommand } from "./framework.js";
import { getListeningPorts, getPortDetails } from "./ports.js";


// Get all running processes (ps)
export async function getAllProcesses() {
  const platform = await getPlatform();
  const entries = platform.getAllProcessesRaw();

  const nonDockerEntries = entries.filter(
    (e) =>
      !e.processName.startsWith("com.docke") &&
      !e.processName.startsWith("Docker") &&
      e.processName !== "docker" &&
      e.processName !== "docker-sandbox",
  );
  const cwdMap = platform.batchCwd(nonDockerEntries.map((e) => e.pid));

  return entries.map((e) => {
    const cwd = cwdMap.get(e.pid);
    const info = {
      pid: e.pid,
      processName: e.processName,
      command: e.command,
      description: summarizeCommand(e.command, e.processName),
      cpu: e.cpu,
      memory: e.rss > 0 ? formatMemory(e.rss) : null,
      cwd: null,
      projectName: null,
      framework: null,
      uptime: null,
    };

    if (e.lstart) {
      const startTime = new Date(e.lstart);
      if (!isNaN(startTime.getTime())) {
        info.uptime = formatUptime(Date.now() - startTime.getTime());
      }
    }

    info.framework = detectFrameworkFromCommand(e.command, e.processName);

    if (cwd) {
      const projectRoot = findProjectRoot(cwd);
      info.cwd = projectRoot;
      info.projectName = basename(projectRoot);
      info.framework = info.framework || detectFramework(projectRoot);
    }

    return info;
  });
}

export async function findOrphanedProcesses() {
  const ports = await getListeningPorts();
  return ports.filter((p) => p.status === "orphaned" || p.status === "zombie");
}

export function pidExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}


export async function killProcess(pid, signal = "SIGTERM", rl, processName) {
  const guard = isSystemProcess(pid, processName);
  if (guard.blocked) {
    process.stderr.write(`\n${formatBlockMessage(pid, processName, guard.reason)}\n\n`);
    return false;
  }

  if (process.platform === "win32" && signal === "SIGKILL") {
    try {
      execSync(`taskkill /F /PID ${pid}`, {
        windowsHide: true,
        stdio: ["pipe", "pipe", "pipe"],
      });
      return true;
    } catch (err) {
      if (err.status === 1 || (err.message && err.message.includes("Access is denied"))) {
        const res = await promptSudoAction("kill process", `taskkill /F /PID ${pid}`, rl);
        return res.success;
      }
      return false;
    }
  }
  try {
    process.kill(pid, signal);
    return true;
  } catch (err) {
    if (err.code === "EPERM" || err.code === "EACCES") {
      const res = await promptSudoAction("kill process", `kill -${signal.replace("SIG", "")} ${pid}`, rl);
      return res.success;
    }
    return false;
  }
}


export async function resolveKillTarget(n) {
  if (!Number.isInteger(n) || n < 1) return null;

  const pidGuard = isSystemProcess(n);
  if (pidGuard.blocked) {
    return { blocked: true, pid: n, reason: pidGuard.reason };
  }

  if (n <= 65535) {
    const info = await getPortDetails(n);
    if (info) {
      const nameGuard = isSystemProcess(info.pid, info.processName);
      if (nameGuard.blocked) {
        return { blocked: true, pid: info.pid, processName: info.processName, reason: nameGuard.reason };
      }
      return { pid: info.pid, via: "port", port: n, info };
    }
  }

  if (pidExists(n)) {
    return { pid: n, via: "pid" };
  }
  return null;
}
