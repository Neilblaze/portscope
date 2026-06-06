import { execSync } from "child_process";
import { spawn } from "child_process";
import os from "os";
import { createInterface } from "readline";
import chalk from "chalk";
import { getListeningPorts, getPortDetails } from "../scanner/ports.js";
import {
  getAllProcesses,
  findOrphanedProcesses,
  killProcess,
  resolveKillTarget,
  pidExists,
} from "../scanner/process.js";
import { isDevProcess } from "../scanner/utils.js";
import { getProcessLogFiles } from "../scanner/logs.js";
import { getAvailableMemory } from "../scanner/memory.js";
import { DESTRUCTIVE_TOOLS } from "./tools.js";
import { sanitizePath } from "../scanner/sanitize.js";
import { parseCommand } from "../commands/restart.js";
import { getPlatform } from "../platform/index.js";
import { sanitizeForAI } from "../config/sanitize-data.js";
import { recordKill, getKillHistory, clearKillHistory } from "../scanner/kill-history.js";
import { resolveDevCommand } from "../scanner/dev-command.js";



/**
 * Execute a tool call from the AI and return the result.
 * Destructive tools prompt for user confirmation before executing.
 *
 * @param {string} toolName
 * @param {object} input
 * @param {import("readline").Interface} [rl] — REPL readline to reuse for prompts
 */
export async function executeTool(toolName, input, rl, options = { headless: false }) {
  if (DESTRUCTIVE_TOOLS.has(toolName) && !options.headless) {
    const confirmed = await confirm(
      `Allow AI to execute ${chalk.bold(toolName)}?`,
      rl,
    );
    if (!confirmed) {
      return { success: false, message: "User declined the operation." };
    }
  }

  switch (toolName) {
    case "list_ports": {
      let ports = await getListeningPorts();
      if (!input.all) {
        ports = ports.filter((p) => isDevProcess(p.processName, p.command));
      }
      return { ports: ports.map((p) => simplifyPort(p)) };
    }

    case "inspect_port": {
      const info = await getPortDetails(input.port);
      if (!info) return { error: `No process found on port ${input.port}` };
      return { port: simplifyPort(info, true) };
    }

    case "kill_process": {
      const results = {};
      const targets = input.targets || (input.target !== undefined ? [input.target] : []);
      if (targets.length === 0) return { error: "No targets provided" };

      const signal = input.force ? "SIGKILL" : "SIGTERM";
      for (const t of targets) {
        const resolved = await resolveKillTarget(t);
        if (!resolved) {
          results[t] = { error: `No process found for ${t}` };
          continue;
        }
        const ok = await killProcess(resolved.pid, signal, rl);
        if (ok) {
          results[t] = { success: true, pid: resolved.pid, signal };

          if (resolved.via === "port" && resolved.info) {
            try {
              const details = resolved.info;
              const devCmd = resolveDevCommand(details.cwd, details.framework, resolved.port);
              recordKill(resolved.port, details, devCmd?.command || null);
            } catch { }
          }
        } else {
          results[t] = { success: false, error: `Failed to kill PID ${resolved.pid}` };
        }
      }
      return results;
    }

    case "list_processes": {
      let procs = await getAllProcesses();
      if (!input.all) {
        procs = procs.filter((p) => isDevProcess(p.processName, p.command));
      }
      return { processes: procs.map((p) => simplifyProcess(p)) };
    }

    case "find_orphaned": {
      const orphaned = await findOrphanedProcesses();
      return { orphaned: orphaned.map((p) => simplifyPort(p)) };
    }

    case "clean_orphaned": {
      const orphaned = await findOrphanedProcesses();
      if (orphaned.length === 0)
        return { message: "No orphaned processes found." };
      const results = { killed: [], failed: [] };
      for (const p of orphaned) {
        if (await killProcess(p.pid, "SIGTERM", rl)) results.killed.push(p.pid);
        else results.failed.push(p.pid);
      }
      return results;
    }

    case "kill_all_dev_ports": {
      let ports = await getListeningPorts();
      ports = ports.filter((p) => isDevProcess(p.processName, p.command));
      if (ports.length === 0)
        return { message: "No dev server ports found." };
      const signal = input.force ? "SIGKILL" : "SIGTERM";
      const killResults = { killed: [], failed: [] };
      const seenPids = new Set();
      for (const p of ports) {
        if (seenPids.has(p.pid)) {
          killResults.killed.push({ port: p.port, pid: p.pid });
          continue;
        }
        seenPids.add(p.pid);
        if (await killProcess(p.pid, signal, rl)) {
          killResults.killed.push({ port: p.port, pid: p.pid });

          try {
            const devCmd = resolveDevCommand(p.cwd, p.framework, p.port);
            recordKill(p.port, p, devCmd?.command || null);
          } catch { }
        } else {
          killResults.failed.push({ port: p.port, pid: p.pid });
        }
      }
      return killResults;
    }

    case "view_logs": {
      const resolved = await resolveKillTarget(input.target);
      if (!resolved)
        return { error: `No process found for ${input.target}` };
      const logFiles = await getProcessLogFiles(resolved.pid, rl);
      if (logFiles.length === 0)
        return { message: "No log files found for this process." };
      try {
        const numLines = input.lines || 20;
        const file = logFiles[0];
        const safePath = sanitizePath(file.path);
        let content = execSync(`tail -n ${numLines} "${safePath}"`, {
          encoding: "utf8",
          timeout: 5000,
        });

        const lines = content.split("\n");
        const charBudget = 8000;
        if (content.length > charBudget && lines.length > 10) {
          let kept = [];
          let total = 0;
          for (let i = lines.length - 1; i >= 0; i--) {
            total += lines[i].length + 1;
            if (total > charBudget && kept.length >= 10) break;
            kept.unshift(lines[i]);
          }
          const skipped = lines.length - kept.length;
          if (skipped > 0) {
            content = `[... ${skipped} earlier lines omitted for brevity ...]\n` + kept.join("\n");
          } else {
            content = kept.join("\n");
          }
        }

        return { file: file.path, type: file.fd, content };
      } catch (e) {
        return { error: `Could not read logs: ${e.message}` };
      }
    }

    case "get_system_stats": {
      const totalMem = os.totalmem();
      const freeMem = getAvailableMemory();
      const usedMem = totalMem - freeMem;
      const memPressure = ((usedMem / totalMem) * 100).toFixed(1);
      const loadAvg = os.loadavg();
      const cpus = os.cpus().length;
      return {
        memory: {
          totalGB: (totalMem / 1024 ** 3).toFixed(2),
          freeGB: (freeMem / 1024 ** 3).toFixed(2),
          usedGB: (usedMem / 1024 ** 3).toFixed(2),
          pressurePercent: memPressure,
        },
        cpu: {
          cores: cpus,
          loadAverage: {
            "1m": loadAvg[0].toFixed(2),
            "5m": loadAvg[1].toFixed(2),
            "15m": loadAvg[2].toFixed(2),
          },
        },
        uptimeSeconds: os.uptime(),
      };
    }

    case "restart_process": {
      const port = input.port;
      const resolved = await resolveKillTarget(port);

      if (resolved && resolved.via === "port") {
        const { pid, info } = resolved;
        const rawCommand = info?.command || "";
        const cwd = info?.cwd || process.cwd();
        const processName = info?.processName || "unknown";

        if (!rawCommand) {
          return { error: `Could not capture command for PID ${pid} — cannot restart` };
        }
        if (processName === "docker") {
          return { error: `Port ${port} is Docker-managed. Use \`docker restart\` instead.` };
        }

        const devResolved = resolveDevCommand(cwd, info?.framework, port);
        const restartCmd = devResolved?.command || rawCommand;
        const restartCwd = devResolved?.cwd || cwd;
        const useShell = !!devResolved;

        const signal = input.force ? "SIGKILL" : "SIGTERM";
        const killed = await killProcess(pid, signal, rl);
        if (!killed) {
          return { error: `Failed to kill PID ${pid}` };
        }

        try {
          recordKill(port, info, devResolved?.command || null);
        } catch { }

        const freed = await waitForPortFreeExecutor(port, pid);
        if (!freed) {
          return { error: `Port ${port} did not free within 5s after killing PID ${pid}` };
        }

        const child = spawnProcessExecutor(restartCmd, restartCwd, useShell);
        if (!child) {
          return { error: `Failed to relaunch: ${restartCmd}` };
        }

        const newPid = await waitForPortBoundExecutor(port);
        if (newPid) clearKillHistory(port);

        return {
          success: true,
          port,
          killedPid: pid,
          processName,
          newPid: newPid || child.pid,
          portBound: newPid !== null,
        };
      } else {
        const history = getKillHistory(port);
        if (!history) {
          return { error: `No process found on port ${port} and no recent kill history available` };
        }

        const restartCmd = history.devCommand || history.command;
        const restartCwd = history.cwd;
        const processName = history.processName || "unknown";
        const useShell = !!history.devCommand;

        if (!restartCmd || !restartCwd) {
          return { error: `Kill history exists for port ${port} but command/cwd is missing — cannot restart` };
        }

        const child = spawnProcessExecutor(restartCmd, restartCwd, useShell);
        if (!child) {
          return { error: `Failed to relaunch from history: ${restartCmd}` };
        }

        const newPid = await waitForPortBoundExecutor(port);
        if (newPid) clearKillHistory(port);

        return {
          success: true,
          port,
          fromHistory: true,
          processName,
          newPid: newPid || child.pid,
          portBound: newPid !== null,
        };
      }
    }

    case "get_port_connections": {
      const platform = await getPlatform();
      const ports = await getListeningPorts();
      const listeningSet = new Set(ports.map((p) => p.port));
      const topology = platform.getPortTopology(listeningSet);

      const portInfoMap = new Map(ports.map((p) => [p.port, p]));
      const result = [];

      for (const [port, topo] of topology) {
        const info = portInfoMap.get(port);
        const entry = {
          port,
          process: info?.processName || "unknown",
          framework: info?.framework || null,
          connectedTo: [],
          externalConnections: topo.remoteConnections,
        };
        for (const peerPort of topo.connectedPorts) {
          const peerInfo = portInfoMap.get(peerPort);
          entry.connectedTo.push({
            port: peerPort,
            process: peerInfo?.processName || "unknown",
            framework: peerInfo?.framework || null,
          });
        }
        result.push(entry);
      }

      if (input.port) {
        const filtered = result.filter(
          (r) => r.port === input.port || r.connectedTo.some((c) => c.port === input.port),
        );
        return { topology: filtered };
      }

      return { topology: result };
    }

    default:
      return { error: `Unknown tool: ${toolName}` };
  }
}

function simplifyPort(p, detailed = false) {
  const result = {
    port: p.port,
    pid: p.pid,
    process: p.processName,
    project: p.projectName,
    framework: p.framework,
    status: p.status,
    uptime: p.uptime,
    memory: p.memory,
  };
  if (detailed) {
    result.cwd = p.cwd;
    result.gitBranch = p.gitBranch;
    if (p.command) {
      const cmd = String(p.command);
      const MAX = 80;
      if (cmd.length > MAX) {
        const firstToken = cmd.split(" ")[0];
        const exe = firstToken.split(/[/\\]/).pop() || firstToken;
        result.command = `${exe} … (${cmd.length} chars)`;
      } else {
        result.command = cmd;
      }
    }
  }
  return result;
}

function simplifyProcess(p) {
  return {
    pid: p.pid,
    process: p.processName,
    cpu: p.cpu,
    memory: p.memory,
    project: p.projectName,
    framework: p.framework,
    uptime: p.uptime,
    description: p.description,
  };
}


async function waitForPortFreeExecutor(port, pid, timeoutMs = 5000) {
  const interval = 200;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    if (pidExists(pid)) continue;
    try {
      const ports = await getListeningPorts();
      if (!ports.some((p) => p.port === port)) return true;
    } catch {
      return true;
    }
  }
  return false;
}


async function waitForPortBoundExecutor(port, timeoutMs = 8000) {
  const interval = 300;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, interval));
    try {
      const ports = await getListeningPorts();
      const found = ports.find((p) => p.port === port);
      if (found) return found.pid;
    } catch { }
  }
  return null;
}


function spawnProcessExecutor(command, cwd, useShell) {
  try {
    let child;
    if (useShell) {
      child = spawn(command, [], {
        cwd,
        shell: true,
        detached: true,
        stdio: "ignore",
        env: { ...process.env },
      });
    } else {
      const [executable, ...spawnArgs] = parseCommand(command);
      if (!executable) return null;

      child = spawn(executable, spawnArgs, {
        cwd,
        detached: true,
        stdio: "ignore",
        env: process.env,
      });
    }
    child.unref();
    return child;
  } catch {
    return null;
  }
}


function confirm(message, existingRl) {
  return new Promise((resolve) => {
    if (existingRl) {
      existingRl.question(chalk.yellow(`  ${message} [y/N] `), (answer) => {
        resolve(answer.trim().toLowerCase() === "y");
      });
    } else {
      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
      });
      rl.question(chalk.yellow(`  ${message} [y/N] `), (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "y");
      });
    }
  });
}
