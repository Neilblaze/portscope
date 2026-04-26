import { execSync } from "child_process";
import { createInterface } from "readline";
import chalk from "chalk";
import { getListeningPorts, getPortDetails } from "../scanner/ports.js";
import {
  getAllProcesses,
  findOrphanedProcesses,
  killProcess,
  resolveKillTarget,
} from "../scanner/process.js";
import { isDevProcess } from "../scanner/utils.js";
import { getProcessLogFiles } from "../scanner/logs.js";
import { DESTRUCTIVE_TOOLS } from "./tools.js";



/**
 * Execute a tool call from the AI and return the result.
 * Destructive tools prompt for user confirmation before executing.
 *
 * @param {string} toolName
 * @param {object} input
 * @param {import("readline").Interface} [rl] — REPL readline to reuse for prompts
 */
export async function executeTool(toolName, input, rl) {
  if (DESTRUCTIVE_TOOLS.has(toolName)) {
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
      const resolved = await resolveKillTarget(input.target);
      if (!resolved)
        return { error: `No process found for ${input.target}` };
      const signal = input.force ? "SIGKILL" : "SIGTERM";
      const ok = killProcess(resolved.pid, signal);
      return ok
        ? { success: true, pid: resolved.pid, signal }
        : { success: false, error: `Failed to kill PID ${resolved.pid}` };
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
        if (killProcess(p.pid)) results.killed.push(p.pid);
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
        if (killProcess(p.pid, signal))
          killResults.killed.push({ port: p.port, pid: p.pid });
        else killResults.failed.push({ port: p.port, pid: p.pid });
      }
      return killResults;
    }

    case "view_logs": {
      const resolved = await resolveKillTarget(input.target);
      if (!resolved)
        return { error: `No process found for ${input.target}` };
      const logFiles = getProcessLogFiles(resolved.pid);
      if (logFiles.length === 0)
        return { message: "No log files found for this process." };
      try {
        const numLines = input.lines || 20;
        const file = logFiles[0];
        const content = execSync(`tail -n ${numLines} "${file.path}"`, {
          encoding: "utf8",
          timeout: 5000,
        });
        return { file: file.path, type: file.fd, content };
      } catch (e) {
        return { error: `Could not read logs: ${e.message}` };
      }
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
    result.command = p.command;
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
