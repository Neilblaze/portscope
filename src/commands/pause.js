import { resolveKillTarget } from "../scanner/process.js";
import chalk from "chalk";


// Pause (SIGSTOP) a process by port or PID.
// This suspends the process without terminating it — useful for temporarily freeing resources.
export async function pauseCommand(filteredArgs) {
  if (process.platform === "win32") {
    console.log(chalk.red("\n  ✕ Pause/resume is not supported on Windows (no SIGSTOP/SIGCONT).\n"));
    process.exitCode = 1;
    return;
  }

  const target = filteredArgs[1];
  if (!target) {
    console.log(chalk.red("\n  Usage: portscope pause <port|pid>\n"));
    console.log(chalk.gray("  Suspends a process (SIGSTOP). Resume with: portscope resume <port|pid>\n"));
    return;
  }

  const n = parseInt(target, 10);
  if (isNaN(n)) {
    console.log(chalk.red(`\n  ✕ "${target}" is not a valid port/PID\n`));
    process.exitCode = 1;
    return;
  }

  const resolved = await resolveKillTarget(n);
  if (!resolved) {
    const msg = n <= 65535
      ? `No listener on :${n} and no process with PID ${n}`
      : `No process with PID ${n}`;
    console.log(chalk.red(`\n  ✕ ${msg}\n`));
    process.exitCode = 1;
    return;
  }

  if (resolved.blocked) {
    console.log(chalk.red(`\n  ⛊  Blocked — PID ${resolved.pid}${resolved.processName ? ` (${resolved.processName})` : ""}`));
    console.log(chalk.red(`     ${resolved.reason}\n`));
    process.exitCode = 1;
    return;
  }

  const { pid, via } = resolved;
  const label = via === "port"
    ? `:${resolved.port} — ${resolved.info?.processName || "unknown"} (PID ${pid})`
    : `PID ${pid}`;

  const ok = sendSignal(pid, "SIGSTOP");
  if (ok) {
    console.log(chalk.green(`\n  ✔ Paused ${label}`));
    console.log(chalk.gray(`  Resume with: portscope resume ${target}\n`));
  } else {
    console.log(chalk.red(`\n  ✕ Failed to pause ${label}. Try: sudo kill -STOP ${pid}\n`));
    process.exitCode = 1;
  }
}


// Resume (SIGCONT) a previously paused process.
export async function resumeCommand(filteredArgs) {
  if (process.platform === "win32") {
    console.log(chalk.red("\n  ✕ Pause/resume is not supported on Windows (no SIGSTOP/SIGCONT).\n"));
    process.exitCode = 1;
    return;
  }

  const target = filteredArgs[1];
  if (!target) {
    console.log(chalk.red("\n  Usage: portscope resume <port|pid>\n"));
    console.log(chalk.gray("  Resumes a previously paused (SIGSTOP) process.\n"));
    return;
  }

  const n = parseInt(target, 10);
  if (isNaN(n)) {
    console.log(chalk.red(`\n  ✕ "${target}" is not a valid port/PID\n`));
    process.exitCode = 1;
    return;
  }

  const resolved = await resolveKillTarget(n);
  if (!resolved) {
    const msg = n <= 65535
      ? `No listener on :${n} and no process with PID ${n}`
      : `No process with PID ${n}`;
    console.log(chalk.red(`\n  ✕ ${msg}\n`));
    process.exitCode = 1;
    return;
  }

  if (resolved.blocked) {
    console.log(chalk.red(`\n  ⛊  Blocked — PID ${resolved.pid}${resolved.processName ? ` (${resolved.processName})` : ""}`));
    console.log(chalk.red(`     ${resolved.reason}\n`));
    process.exitCode = 1;
    return;
  }

  const { pid, via } = resolved;
  const label = via === "port"
    ? `:${resolved.port} — ${resolved.info?.processName || "unknown"} (PID ${pid})`
    : `PID ${pid}`;

  const ok = sendSignal(pid, "SIGCONT");
  if (ok) {
    console.log(chalk.green(`\n  ✔ Resumed ${label}\n`));
  } else {
    console.log(chalk.red(`\n  ✕ Failed to resume ${label}. Try: sudo kill -CONT ${pid}\n`));
    process.exitCode = 1;
  }
}


// Send a signal to a process ; Exported for testing.
export function sendSignal(pid, signal) {
  try {
    process.kill(pid, signal);
    return true;
  } catch {
    return false;
  }
}

