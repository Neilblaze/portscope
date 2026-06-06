import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { join } from "path";
import { homedir, tmpdir } from "os";

const HISTORY_DIR = join(homedir(), ".portscope");
const HISTORY_FILE = join(HISTORY_DIR, "kill-history.json");
const MAX_ENTRIES = 50;
const TTL_MS = 12 * 60 * 60 * 1000;


function ensureDir() {
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true, mode: 0o700 });
  }
}



function loadHistory() {
  ensureDir();
  if (!existsSync(HISTORY_FILE)) return {};
  try {
    const raw = readFileSync(HISTORY_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!data || typeof data !== "object") return {};
    return data;
  } catch {
    return {};
  }
}


function saveHistory(data) {
  ensureDir();
  const tmp = join(tmpdir(), `portscope-kill-history-${process.pid}.json`);
  writeFileSync(tmp, JSON.stringify(data, null, 2) + "\n", "utf8");
  try {
    renameSync(tmp, HISTORY_FILE);
  } catch {
    writeFileSync(HISTORY_FILE, JSON.stringify(data, null, 2) + "\n", "utf8");
  }
}


// Prune expired entries (older than TTL) and enforce max entries
function pruneHistory(data) {
  const now = Date.now();
  const keys = Object.keys(data);

  for (const key of keys) {
    const entry = data[key];
    if (!entry || !entry.killedAt) {
      delete data[key];
      continue;
    }
    const age = now - new Date(entry.killedAt).getTime();
    if (age > TTL_MS) {
      delete data[key];
    }
  }

  // Enforce max entries: keep most recent
  const remaining = Object.keys(data);
  if (remaining.length > MAX_ENTRIES) {
    const sorted = remaining.sort((a, b) => {
      const ta = new Date(data[a].killedAt).getTime();
      const tb = new Date(data[b].killedAt).getTime();
      return ta - tb;
    });
    const toRemove = sorted.slice(0, sorted.length - MAX_ENTRIES);
    for (const key of toRemove) {
      delete data[key];
    }
  }

  return data;
}


/**
 * Record a killed process in the history ledger.
 *
 * @param {number} port
 * @param {object} info - Process info from resolveKillTarget or port details
 * @param {string} info.processName
 * @param {string} info.command - Raw ps command string
 * @param {string} info.cwd - Working directory
 * @param {string} [info.framework] - Detected framework
 * @param {string} [devCommand] - Resolved dev command (e.g., "pnpm run dev")
 */
export function recordKill(port, info, devCommand) {
  if (!port || !info) return;

  const data = loadHistory();
  pruneHistory(data);

  data[String(port)] = {
    port,
    pid: info.pid || null,
    processName: info.processName || "unknown",
    command: info.command || "",
    cwd: info.cwd || "",
    framework: info.framework || null,
    devCommand: devCommand || null,
    killedAt: new Date().toISOString(),
  };

  saveHistory(data);
}


/**
 * Look up kill history for a port.
 * Returns the entry if it exists and is within the TTL window, or null.
 *
 * @param {number} port
 * @returns {object|null}
 */
export function getKillHistory(port) {
  const data = loadHistory();
  const entry = data[String(port)];
  if (!entry || !entry.killedAt) return null;

  const age = Date.now() - new Date(entry.killedAt).getTime();
  if (age > TTL_MS) return null;

  return entry;
}


// Remove a kill-history entry for a port (called after successful restart)
export function clearKillHistory(port) {
  const data = loadHistory();
  delete data[String(port)];
  saveHistory(data);
}

