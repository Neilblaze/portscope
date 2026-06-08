import { spawn } from "child_process";
import chalk from "chalk";
import { createInterface } from "readline";
import { resolveKillTarget, killProcess, pidExists } from "../scanner/process.js";
import { getListeningPorts } from "../scanner/ports.js";
import { getKillHistory, recordKill, clearKillHistory } from "../scanner/kill-history.js";
import { resolveDevCommand } from "../scanner/dev-command.js";


/**
 * Restart a process bound to a port by killing it and relaunching
 * it with its original command and working directory.
 *
 * @param {string[]} args - CLI args (first element is the port number string)
 * @param {import("readline").Interface} [rl]
 */
export async function restartCommand(args, rl) {
  const rawTarget = args[1];
  const force = args.includes("--force") || args.includes("-f");

  if (!rawTarget) {
    console.log(chalk.red(`\n  Usage: portscope restart <port> [-f|--force]\n`));
    console.log(chalk.gray("  Kills the process on the given port and relaunches it"));
    console.log(chalk.gray("  with its original command and working directory.\n"));
    return;
  }

  const port = parseInt(rawTarget, 10);
  if (isNaN(port) || port < 1 || port > 65535) {
    console.log(chalk.red(`\n  ✕ "${rawTarget}" is not a valid port number (1–65535)\n`));
    process.exitCode = 1;
    return;
  }


  const resolved = await resolveKillTarget(port);

  if (resolved && resolved.via === "port") {
    await liveRestart(port, resolved, force, rl);
  } else {
    await historyRestart(port, rl);
  }
}


async function liveRestart(port, resolved, force, rl) {
  const { pid, info } = resolved;
  const processName = info?.processName || "unknown";
  const rawCommand = info?.command || "";
  const cwd = info?.cwd || process.cwd();

  if (!rawCommand) {
    console.log(chalk.red(`\n  ✕ Could not capture command for PID ${pid} — cannot restart\n`));
    process.exitCode = 1;
    return;
  }

  if (processName === "docker") {
    console.log(chalk.red(`\n  ✕ :${port} is a Docker-managed port. Use \`docker restart\` instead.\n`));
    process.exitCode = 1;
    return;
  }

  const devResolved = resolveDevCommand(cwd, info?.framework, port);
  const restartCommand = devResolved?.command || rawCommand;
  const restartCwd = devResolved?.cwd || cwd;
  const useShell = !!devResolved;

  console.log();
  console.log(
    `  ${chalk.dim("Restarting")} ${chalk.white.bold(processName)} ${chalk.gray(`on :${port} (PID ${pid})`)}`
  );
  console.log(`  ${chalk.dim("Command:")} ${chalk.white(truncateCommand(restartCommand, 70))}`);
  console.log(`  ${chalk.dim("CWD:    ")} ${chalk.white(restartCwd)}`);
  console.log();


  const confirmed = await confirm(
    `Restart :${port} — ${processName} (PID ${pid})?`,
    rl
  );
  if (!confirmed) {
    console.log(chalk.gray("  Aborted.\n"));
    return;
  }


  const signal = force ? "SIGKILL" : "SIGTERM";
  const killed = await killProcess(pid, signal, rl);

  if (!killed) {
    console.log(chalk.red(`  ✕ Failed to kill PID ${pid}. Try with -f or run as sudo.\n`));
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`  ✔ Killed ${processName} (PID ${pid})`));

  try {
    recordKill(port, info, devResolved?.command || null);
  } catch { }


  const freed = await waitForPortFree(port, pid);
  if (!freed) {
    console.log(chalk.yellow(`  ⚠ Port :${port} did not free up within 5s — proceeding anyway\n`));
  }


  const child = spawnProcess(restartCommand, restartCwd, useShell);
  if (!child) {
    console.log(chalk.red(`  ✕ Failed to relaunch: ${restartCommand}\n`));
    process.exitCode = 1;
    return;
  }

  const newPid = await waitForPortBound(port, child.pid);

  if (newPid) {
    console.log(chalk.green(`  ✔ Relaunched: ${truncateCommand(restartCommand, 60)} ${chalk.gray(`(new PID ${newPid})`)}`));
    clearKillHistory(port);
  } else {
    console.log(chalk.green(`  ✔ Relaunched ${processName}`) + chalk.dim(` (PID ${child.pid} — port binding pending)`));
  }
  console.log();
}


// Restart a previously-killed port using kill history
async function historyRestart(port, rl) {
  const history = getKillHistory(port);

  if (!history) {
    console.log(chalk.red(`\n  ✕ No process found listening on :${port}`));
    console.log(chalk.gray(`  No recent kill history for this port either.`));
    console.log(chalk.gray(`  Tip: Use ${chalk.cyan("portscope kill <port>")} first, then ${chalk.cyan("portscope restart <port>")} to relaunch.\n`));
    process.exitCode = 1;
    return;
  }

  const restartCmd = history.devCommand || history.command;
  const restartCwd = history.cwd;
  const processName = history.processName || "unknown";

  if (!restartCmd) {
    console.log(chalk.red(`\n  ✕ Kill history exists for :${port} but no command was captured — cannot restart\n`));
    process.exitCode = 1;
    return;
  }

  if (!restartCwd) {
    console.log(chalk.red(`\n  ✕ Kill history exists for :${port} but no working directory was captured — cannot restart\n`));
    process.exitCode = 1;
    return;
  }

  const killedAgo = timeSince(history.killedAt);

  console.log();
  console.log(
    `  ${chalk.dim("Restarting from history")} ${chalk.gray(`(killed ${killedAgo} ago)`)}`
  );
  console.log(`  ${chalk.dim("Port:   ")} ${chalk.white.bold(`:${port}`)} ${chalk.gray(`— ${processName}`)}`);
  console.log(`  ${chalk.dim("Command:")} ${chalk.white(truncateCommand(restartCmd, 70))}`);
  console.log(`  ${chalk.dim("CWD:    ")} ${chalk.white(restartCwd)}`);
  console.log();


  const confirmed = await confirm(
    `Restart :${port} — ${processName} (from history)?`,
    rl
  );
  if (!confirmed) {
    console.log(chalk.gray("  Aborted.\n"));
    return;
  }


  // Spawn 
  // Dev commands (pnpm run dev, npm run dev, etc.) need shell=true
  // Raw ps commands (node /path/to/script.js) do not
  const useShell = !!history.devCommand;

  const child = spawnProcess(restartCmd, restartCwd, useShell);
  if (!child) {
    console.log(chalk.red(`  ✕ Failed to relaunch: ${restartCmd}\n`));
    process.exitCode = 1;
    return;
  }


  // Poll until the new process binds to the port
  const newPid = await waitForPortBound(port, child.pid);

  if (newPid) {
    console.log(chalk.green(`  ✔ Relaunched: ${truncateCommand(restartCmd, 60)} ${chalk.gray(`(new PID ${newPid})`)}`));
    clearKillHistory(port);
  } else {
    console.log(chalk.green(`  ✔ Relaunched ${processName}`) + chalk.dim(` (PID ${child.pid} — port binding pending)`));
  }
  console.log();
}



// Helpers ----------------------------------------- ///


/**
 * Spawn a process in the background.
 * - If useShell=true, runs through the system shell (needed for npm/pnpm/yarn shims).
 * - If useShell=false, parses the command into executable + args (direct exec).
 *
 * Returns the child process or null on failure.
 */
export function spawnProcess(command, cwd, useShell) {
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


export function parseCommand(command) {
  const tokens = [];
  let current = "";
  let inSingle = false;
  let inDouble = false;

  for (let i = 0; i < command.length; i++) {
    const ch = command[i];

    if (ch === "'" && !inDouble) {
      inSingle = !inSingle;
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === " " && !inSingle && !inDouble) {
      if (current.length > 0) {
        tokens.push(current);
        current = "";
      }
    } else {
      current += ch;
    }
  }

  if (current.length > 0) tokens.push(current);
  return tokens;
}


// Poll until the given PID is gone AND the port is no longer in use.
// Returns true if both conditions are met within the timeout
async function waitForPortFree(port, pid, timeoutMs = 5000) {
  const interval = 200;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(interval);
    const stillAlive = pidExists(pid);
    if (stillAlive) continue;

    try {
      const ports = await getListeningPorts();
      if (!ports.some((p) => p.port === port)) return true;
    } catch {
      return true;
    }
  }
  return false;
}


// Poll until `port` is bound again, returning the PID of the new listener.
// Times out gracefully after `timeoutMs` ms.
async function waitForPortBound(port, expectedPid, timeoutMs = 8000) {
  const interval = 300;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    await sleep(interval);
    try {
      const ports = await getListeningPorts();
      const found = ports.find((p) => p.port === port);
      if (found) return found.pid;
    } catch { /* scanner hiccup — keep polling */ }
  }
  return null;
}


function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function truncateCommand(cmd, max) {
  return cmd.length > max ? cmd.slice(0, max - 1) + "…" : cmd;
}

function confirm(message, existingRl) {
  return new Promise((resolve) => {
    if (existingRl) {
      existingRl.question(chalk.yellow(`  ${message} [y/N] `), (answer) => {
        resolve(answer.trim().toLowerCase() === "y");
      });
    } else {
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      rl.question(chalk.yellow(`  ${message} [y/N] `), (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === "y");
      });
    }
  });
}


// Format a time delta from an ISO date string to a human-readable "Xm", "Xh", etc.
function timeSince(isoDate) {
  const ms = Date.now() - new Date(isoDate).getTime();
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m`;
  return `${seconds}s`;
}
