import { resolveDevCommand } from "../scanner/dev-command.js";
import { spawnProcess } from "./restart.js";
import { getListeningPorts } from "../scanner/ports.js";


const ROLE_BASE_DELAYS = {
  frontend: 2000,
  backend: 3000,
  database: 5000,
  infra: 4000,
  ml: 4000,
  runtime: 3000,
};

const MAX_DELAY = 15000;
const BACKOFF_FACTOR = 1.5;
const MAX_ATTEMPTS = 3;
const CRASH_WINDOW_MS = 60000;
const PORT_BIND_TIMEOUT = 10000;



export function computeDelay(role, attempt) {
  const base = ROLE_BASE_DELAYS[role] || ROLE_BASE_DELAYS.runtime;
  const delay = Math.round(base * Math.pow(BACKOFF_FACTOR, Math.max(0, attempt - 1)));
  return Math.min(delay, MAX_DELAY);
}


export function shouldRestart(port, crashTracker) {
  const tracker = crashTracker.get(port);
  if (!tracker) return true;
  if (tracker.parked) return false;

  const now = Date.now();
  if (now - tracker.firstAttemptAt >= CRASH_WINDOW_MS) {
    crashTracker.set(port, { attempts: 0, firstAttemptAt: now, parked: false });
    return true;
  }

  if (tracker.attempts >= MAX_ATTEMPTS) {
    tracker.parked = true;
    return false;
  }

  return true;
}


export function recordCrashAttempt(port, crashTracker) {
  const existing = crashTracker.get(port);
  const now = Date.now();

  if (!existing || now - existing.firstAttemptAt >= CRASH_WINDOW_MS) {
    crashTracker.set(port, { attempts: 1, firstAttemptAt: now, parked: false });
    return 1;
  }

  existing.attempts += 1;
  return existing.attempts;
}


export function resetCrashTracker(port, crashTracker) {
  crashTracker.delete(port);
}


export async function attemptAutoRestart(port, snapshot) {
  if (!snapshot) {
    return { success: false, reason: "no-snapshot" };
  }

  if ((snapshot.processName || "").toLowerCase() === "docker") {
    return { success: false, reason: "docker" };
  }

  const cwd = snapshot.cwd;
  const framework = snapshot.framework;
  const rawCommand = snapshot.command;

  if (!cwd && !rawCommand) {
    return { success: false, reason: "no-command" };
  }

  const devResolved = cwd ? resolveDevCommand(cwd, framework, port) : null;
  const restartCmd = devResolved?.command || rawCommand;
  const restartCwd = devResolved?.cwd || cwd || process.cwd();
  const useShell = !!devResolved;

  if (!restartCmd) {
    return { success: false, reason: "no-command" };
  }

  const child = spawnProcess(restartCmd, restartCwd, useShell);
  if (!child) {
    return { success: false, reason: "spawn-failed", command: restartCmd };
  }

  const newPid = await waitForPortBound(port, PORT_BIND_TIMEOUT);

  if (newPid) {
    return { success: true, newPid, command: restartCmd };
  }

  return { success: false, reason: "bind-timeout", command: restartCmd, childPid: child.pid };
}


async function waitForPortBound(port, timeoutMs) {
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


export function getCrashAttemptCount(port, crashTracker) {
  const tracker = crashTracker.get(port);
  if (!tracker) return 0;

  if (Date.now() - tracker.firstAttemptAt >= CRASH_WINDOW_MS) return 0;
  return tracker.attempts;
}
