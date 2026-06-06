import { createInterface } from "readline";
import { getListeningPorts, watchPorts } from "../scanner/ports.js";
import { displayWatchEvent, displayWatchHeader, displayAutoRestart, getWatchSeparator } from "../ui/watch.js";
import { getPortRole, parseWatchFilters, ROLE_ALIASES, ALL_ROLES } from "../scanner/roles.js";
import { getKillHistory } from "../scanner/kill-history.js";
import { computeDelay, shouldRestart, recordCrashAttempt, resetCrashTracker, getCrashAttemptCount, attemptAutoRestart } from "./autoreload.js";
import chalk from "chalk";


function parseAutoreloadFlag(args) {
  return args.some((a) => a === "--autoreload" || a === "--ar");
}


export async function watchCommand(args = [], rl = null) {
  const filterArgs = args.filter((a) => a !== "watch");
  const autoreload = parseAutoreloadFlag(filterArgs);
  const roleArgs = filterArgs.filter((a) => a !== "--autoreload" && a !== "--ar");
  const filters = parseWatchFilters(roleArgs);

  // NOTE: Validators
  const unknownFlags = roleArgs.filter((a) => {
    if (!a.startsWith("--")) return false;
    const raw = a.slice(2);
    const value = raw.includes("=") ? raw.split("=")[1] : raw;
    return value.split(",").some((part) => !ROLE_ALIASES[part.trim().toLowerCase()]);
  });
  if (unknownFlags.length > 0) {
    console.log();
    for (const f of unknownFlags) {
      const invalid = f.slice(2).split(",").filter((p) => !ROLE_ALIASES[p.trim().toLowerCase()]);
      console.log(chalk.yellow(`  ⚠ Unknown filter: ${chalk.white(invalid.join(", "))}`));
    }
    console.log(chalk.dim(`  Valid filters: ${ALL_ROLES.map((r) => `--${r}`).join(", ")}`));
    console.log(chalk.dim(`  Aliases: --fe, --be, --db, --api, --ui, --ml`));
    console.log();
  }

  // Autoreload confirmation prompt
  if (autoreload) {
    const confirmed = await confirmAutoreload(rl);
    if (!confirmed) {
      console.log(chalk.dim(`  Autoreload disabled. Starting ${chalk.bold("watch")} without it...\n`));
      return watchCommand(args.filter((a) => a !== "--autoreload" && a !== "--ar"), rl);
    }
  }

  await displayWatchHeader(filters, { autoreload });

  const processNames = new Set();

  // STATE: Autoreload
  const portSnapshots = new Map();
  const crashTracker = new Map();
  const pendingRestarts = new Map();
  const activeRestarts = new Set();

  try {
    const initialPorts = await getListeningPorts();
    for (const p of initialPorts) {
      if (!filters || filters.has(getPortRole(p))) {
        processNames.add(`${p.processName || "unknown"} [${p.pid}]`);
        if (autoreload) {
          portSnapshots.set(p.port, {
            processName: p.processName,
            pid: p.pid,
            command: p.command || "",
            cwd: p.cwd || "",
            framework: p.framework || null,
            port: p.port,
          });
        }
      }
    }
  } catch {
  }

  const interval = watchPorts((type, info) => {
    if (filters) {
      if (type !== "removed" && !filters.has(getPortRole(info))) return;
    }

    const nameAndPid = `${info.processName || "unknown"} [${info.pid}]`;

    if (type === "new" || type === "update") {
      processNames.add(nameAndPid);

      // Upsert snapshot for autoreload
      if (autoreload) {
        portSnapshots.set(info.port, {
          processName: info.processName,
          pid: info.pid,
          command: info.command || "",
          cwd: info.cwd || "",
          framework: info.framework || null,
          port: info.port,
        });
      }

      if (autoreload && pendingRestarts.has(info.port)) {
        clearTimeout(pendingRestarts.get(info.port));
        pendingRestarts.delete(info.port);
        activeRestarts.delete(info.port);
        resetCrashTracker(info.port, crashTracker);
      }
    }

    const maxWidth = Math.max(
      ...Array.from(processNames).map((name) => name.length),
      0
    );

    if (!activeRestarts.has(info.port)) {
      displayWatchEvent(type, info, maxWidth);
    }

    if (autoreload && type === "removed") {
      handleAutoRestart(info.port, portSnapshots, crashTracker, pendingRestarts, activeRestarts, filters);
    }
  }, 2000);

  await new Promise((resolve) => {
    const sigintHandler = () => {
      clearInterval(interval);

      for (const [, timerId] of pendingRestarts) {
        clearTimeout(timerId);
      }
      pendingRestarts.clear();

      console.log(getWatchSeparator());
      console.log(`  ${chalk.red("■")} ${chalk.white.bold("Watch mode stopped")}`);
      console.log(chalk.dim("    Returned to interactive prompt.\n"));
      process.off("SIGINT", sigintHandler);
      resolve();
    };
    process.once("SIGINT", sigintHandler);
  });
}


async function handleAutoRestart(port, portSnapshots, crashTracker, pendingRestarts, activeRestarts, filters) {
  if (pendingRestarts.has(port)) return;

  try {
    const history = getKillHistory(port);
    if (history && history.killedAt) {
      const age = Date.now() - new Date(history.killedAt).getTime();
      if (age < 10000) {
        displayAutoRestart(port, "skipped-kill");
        return;
      }
    }
  } catch { }

  if (!shouldRestart(port, crashTracker)) {
    displayAutoRestart(port, "parked");
    return;
  }

  const snapshot = portSnapshots.get(port);
  if (!snapshot) {
    displayAutoRestart(port, "failed", { reason: "no process info captured" });
    return;
  }

  const role = getPortRole(snapshot);
  const attempt = getCrashAttemptCount(port, crashTracker) + 1;
  const delay = computeDelay(role, attempt);

  const restartCmd = snapshot.command || "unknown";
  displayAutoRestart(port, "pending", { delay, command: restartCmd });

  activeRestarts.add(port);

  const timerId = setTimeout(async () => {
    pendingRestarts.delete(port);
    recordCrashAttempt(port, crashTracker);

    try {
      const result = await attemptAutoRestart(port, snapshot);

      if (result.success) {
        displayAutoRestart(port, "success", { newPid: result.newPid });
        resetCrashTracker(port, crashTracker);
      } else {
        const reasons = {
          "no-snapshot": "no process info captured",
          "docker": "Docker-managed — use docker restart",
          "no-command": "no restart command available",
          "spawn-failed": "failed to launch process",
          "bind-timeout": "port did not bind within 10s",
        };
        displayAutoRestart(port, "failed", { reason: reasons[result.reason] || result.reason });
      }
    } catch (err) {
      displayAutoRestart(port, "failed", { reason: String(err.message || err) });
    } finally {
      activeRestarts.delete(port);
    }
  }, delay);

  pendingRestarts.set(port, timerId);
}

async function confirmAutoreload(rl) {
  const g = chalk.gray;
  console.log();
  console.log(
    `  ${chalk.yellow("⚠")} ${chalk.yellow.bold("Autoreload will automatically restart crashed processes!")}`,
  );
  console.log(
    `  ${g("│")} ${chalk.dim("This spawns new child processes and may cause port conflicts or restart loops ")}`,
  );
  console.log(
    `  ${g("│")} ${chalk.dim("if the underlying issue persists.")}`,
  );
  console.log(`  ${g("│")}`);

  const promptText = `  ${g("╰─")}${chalk.cyan("⊛")} ${chalk.yellow("Enable autoreload?")} ${chalk.dim("(y/N)")} `;

  let answer;
  if (rl) {
    answer = await new Promise((resolve) => rl.question(promptText, resolve));
  } else {
    const tmpRl = createInterface({ input: process.stdin, output: process.stdout });
    answer = await new Promise((resolve) => tmpRl.question(promptText, resolve));
    tmpRl.close();
  }

  console.log();
  return answer.trim().toLowerCase() === "y";
}
