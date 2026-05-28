import { spawn } from "child_process";
import chalk from "chalk";
import { createInterface } from "readline";
import { resolveKillTarget, killProcess, pidExists } from "../scanner/process.js";
import { getListeningPorts } from "../scanner/ports.js";


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


  // ── 1. Resolve process info ────────────────────────────────────────── //
  const resolved = await resolveKillTarget(port);
  if (!resolved || resolved.via !== "port") {
    console.log(chalk.red(`\n  ✕ No process found listening on :${port}\n`));
    process.exitCode = 1;
    return;
  }

  const { pid, info } = resolved;
  const processName = info?.processName || "unknown";
  const command = info?.command || "";
  const cwd = info?.cwd || process.cwd();

  if (!command) {
    console.log(chalk.red(`\n  ✕ Could not capture command for PID ${pid} — cannot restart\n`));
    process.exitCode = 1;
    return;
  }

  // NOTE: Docker-managed processes cannot be relaunched this way
  if (processName === "docker") {
    console.log(chalk.red(`\n  ✕ :${port} is a Docker-managed port. Use \`docker restart\` instead.\n`));
    process.exitCode = 1;
    return;
  }

  console.log();
  console.log(
    `  ${chalk.dim("Restarting")} ${chalk.white.bold(processName)} ${chalk.gray(`on :${port} (PID ${pid})`)}`
  );
  console.log(`  ${chalk.dim("Command:")} ${chalk.white(truncateCommand(command, 70))}`);
  console.log(`  ${chalk.dim("CWD:    ")} ${chalk.white(cwd)}`);
  console.log();


  // ── 2. Confirm ──────────────────────────────── //
  const confirmed = await confirm(
    `Restart :${port} — ${processName} (PID ${pid})?`,
    rl
  );
  if (!confirmed) {
    console.log(chalk.gray("  Aborted.\n"));
    return;
  }


  // ── 3. Kill ──────────────────────────────────────────────────────────────────────── //
  const signal = force ? "SIGKILL" : "SIGTERM";
  const killed = await killProcess(pid, signal, rl);

  if (!killed) {
    console.log(chalk.red(`  ✕ Failed to kill PID ${pid}. Try with -f or run as sudo.\n`));
    process.exitCode = 1;
    return;
  }
  console.log(chalk.green(`  ✓ Killed ${processName} (PID ${pid})`));


  // ── 4. Wait for process to exit and port to become free ──────────────────────────────────── //
  const freed = await waitForPortFree(port, pid);
  if (!freed) {
    console.log(chalk.yellow(`  ⚠ Port :${port} did not free up within 5s — proceeding anyway\n`));
  }


  // ── 5. Parse and spawn ────────────────────────────────────────── //
  const [executable, ...spawnArgs] = parseCommand(command);

  if (!executable) {
    console.log(chalk.red(`  ✕ Could not parse command: ${command}\n`));
    process.exitCode = 1;
    return;
  }

  let child;
  try {
    child = spawn(executable, spawnArgs, {
      cwd,
      detached: true,
      stdio: "ignore",
      env: process.env,
    });
    child.unref();
  } catch (err) {
    console.log(chalk.red(`  ✕ Failed to relaunch: ${err.message}\n`));
    process.exitCode = 1;
    return;
  }


  // ── 6. Poll until the new process binds to the port ───────────────────── //
  const newPid = await waitForPortBound(port, child.pid);

  if (newPid) {
    console.log(chalk.green(`  ✓ Relaunched: ${truncateCommand(command, 60)} ${chalk.gray(`(new PID ${newPid})`)}`));
  } else {
    // Process may have started but not yet bound to the port (slow startup)
    console.log(chalk.green(`  ✓ Relaunched ${processName}`) + chalk.dim(` (PID ${child.pid} — port binding pending)`));
  }
  console.log();
}



/**
 * Parse a command string into [executable, ...args].
 * Handles single/double quoted arguments correctly.
 * Does NOT use shell evaluation — safe against injection.
 */
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


/**
 * Poll until the given PID is gone AND the port is no longer in use.
 * Returns true if both conditions are met within the timeout.
 */
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


/**
 * Poll until `port` is bound again, returning the PID of the new listener.
 * Times out gracefully after `timeoutMs` ms.
 */
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

