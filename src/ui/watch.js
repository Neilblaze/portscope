import chalk from "chalk";
import stringWidth from "string-width";
import { formatFramework } from "./format.js";
import { formatBytes } from "../scanner/utils.js";
import { renderBanner } from "./banner.js";

function normalizeBindAddress(raw) {
  if (!raw) return "0.0.0.0";
  const stripped = raw.replace(/^\[|\]$/g, "").trim();
  if (!stripped || stripped === "::" || stripped === "*" || stripped === "*.*") return "0.0.0.0";
  return stripped;
}

let lastWatchLineWidth = 50;

// Display watch mode events
export function displayWatchEvent(type, info, maxWidth = 10) {
  const timestamp = chalk.gray(new Date().toLocaleTimeString());

  const paddedWidth = maxWidth + 2;

  if (type === "new") {
    const nameAndPid = `${info.processName || "unknown"} [${info.pid}]`;
    const paddedProcess = chalk.white(nameAndPid.padEnd(paddedWidth, " "));
    const memoryStr = chalk.gray((info.memory || "—").padEnd(8, " "));
    const bindRaw = normalizeBindAddress(info.bindAddress);
    const bindPadded = bindRaw.padEnd(9, " ");
    const coloredBind = bindRaw === "0.0.0.0" ? chalk.yellow(bindPadded) : chalk.gray(bindPadded);
    const uptimeStr = chalk.gray((info.uptime || "—").padEnd(7, " "));

    const connections = info.connections !== undefined ? info.connections : 0;
    const connStr = String(connections).padStart(3, " ");

    const bIn = formatBytes(info.bytesInPerSec || 0);
    const bOut = formatBytes(info.bytesOutPerSec || 0);
    const tpStr = ` │ ${chalk.yellow("↑")}${chalk.gray(bOut.padEnd(8, " "))} ${chalk.green("↓")}${chalk.gray(bIn.padEnd(8, " "))}`;

    let rateStr = "";
    if (info.requestRate > 0) {
      let text = "";
      const r = info.requestRate;

      let bestReq = Math.round(r);
      let bestSec = 1;

      for (let s = 1; s <= 60; s++) {
        const req = Math.round(r * s);
        const error = Math.abs(r - req / s);
        if (error < 0.05 && req > 0) {
          bestReq = req;
          bestSec = s;
          break;
        }
      }

      if (bestSec === 1 && r < 1 && r > 0) {
        text = `1 req/${Math.round(1 / r)}s`;
      } else if (bestSec === 1) {
        text = `${bestReq} req/s`;
      } else {
        text = `${bestReq} req/${bestSec}s`;
      }
      rateStr = ` │ ${chalk.magenta(text.padStart(11, " "))}`;
    }

    const output = `  ${timestamp} ${chalk.green("▲ NEW")} :${chalk.white.bold(String(info.port).padEnd(5))} ← ${paddedProcess} │ ${memoryStr} │ ${coloredBind} │ ${uptimeStr} │ ${chalk.cyan(connStr)} conn${tpStr}${rateStr}`;
    console.log(output);
    lastWatchLineWidth = stringWidth(output);
  } else if (type === "update") {
    const nameAndPid = `${info.processName || "unknown"} [${info.pid}]`;
    const paddedProcess = chalk.white(nameAndPid.padEnd(paddedWidth, " "));
    const memoryStr = chalk.gray((info.memory || "—").padEnd(8, " "));
    const bindRaw = normalizeBindAddress(info.bindAddress);
    const bindPadded = bindRaw.padEnd(9, " ");
    const coloredBind = bindRaw === "0.0.0.0" ? chalk.yellow(bindPadded) : chalk.gray(bindPadded);
    const uptimeStr = chalk.gray((info.uptime || "—").padEnd(7, " "));

    const connections = info.connections !== undefined ? info.connections : 0;
    const connStr = String(connections).padStart(3, " ");

    let rateStr = "";
    if (info.requestRate > 0) {
      let text = "";
      const r = info.requestRate;

      let bestReq = Math.round(r);
      let bestSec = 1;

      for (let s = 1; s <= 60; s++) {
        const req = Math.round(r * s);
        const error = Math.abs(r - req / s);
        if (error < 0.05 && req > 0) {
          bestReq = req;
          bestSec = s;
          break;
        }
      }

      if (bestSec === 1 && r < 1 && r > 0) {
        text = `1 req/${Math.round(1 / r)}s`;
      } else if (bestSec === 1) {
        text = `${bestReq} req/s`;
      } else {
        text = `${bestReq} req/${bestSec}s`;
      }
      rateStr = ` │ ${chalk.magenta(text.padStart(11, " "))}`;
    }

    const bIn = formatBytes(info.bytesInPerSec || 0);
    const bOut = formatBytes(info.bytesOutPerSec || 0);
    const tpStr = ` │ ${chalk.yellow("↑")}${chalk.gray(bOut.padEnd(8, " "))} ${chalk.green("↓")}${chalk.gray(bIn.padEnd(8, " "))}`;

    const output = `  ${timestamp} ${chalk.blue("◆ UP ")} :${chalk.white.bold(String(info.port).padEnd(5))} ← ${paddedProcess} │ ${memoryStr} │ ${coloredBind} │ ${uptimeStr} │ ${chalk.cyan(connStr)} conn${tpStr}${rateStr}`;
    console.log(output);
    lastWatchLineWidth = stringWidth(output);
  } else if (type === "removed") {
    const output = `  ${timestamp} ${chalk.red("▼ CLOSED")} :${chalk.white.bold(info.port)}`;
    console.log(output);
  }
}

export function getWatchSeparator() {
  const dashCount = Math.max(10, lastWatchLineWidth - 3);
  return chalk.gray("\n  " + "─".repeat(dashCount) + "❯");
}


export async function displayWatchHeader(filters = null, { autoreload = false } = {}) {
  await renderBanner();

  const ROLE_BG = {
    frontend: chalk.bgYellow.black,
    backend: chalk.bgMagenta.white,
    database: chalk.bgBlue.white,
    infra: chalk.bgCyan.black,
    ml: chalk.bgGreen.black,
    runtime: chalk.bgWhite.black,
  };

  const parts = [];

  if (filters && filters.size > 0) {
    const badges = [...filters]
      .map((r) => {
        const colorFn = ROLE_BG[r] || chalk.bgWhite.black;
        return colorFn(` ${r} `);
      })
      .join(" ");
    parts.push(badges);
  }

  if (autoreload) {
    parts.push(chalk.bgGreen.black(" autoreload "));
  }

  if (parts.length > 0) {
    console.log(chalk.cyan.bold("  Watching for port changes...") + chalk.gray("    ❯ ") + parts.join(" "));
  } else {
    console.log(chalk.cyan.bold("  Watching for port changes..."));
  }
  console.log(chalk.gray("  Press Ctrl+C to stop\n"));
}


export function displayAutoRestart(port, status, details = {}) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
  const timestamp = chalk.gray(time);
  const portStr = chalk.white.bold(String(port).padEnd(5));

  if (status === "pending") {
    const delayStr = (details.delay / 1000).toFixed(1);
    const cmd = details.command ? chalk.dim(` — ${truncateStr(details.command, 50)}`) : "";
    const output = `  ${timestamp} ${chalk.yellow("↻ RESTART")} :${portStr} ${chalk.dim(`(in ${delayStr}s...)`)}${cmd}`;
    console.log(output);
  } else if (status === "success") {
    const pidStr = details.newPid ? chalk.gray(` (PID ${details.newPid})`) : "";
    const output = `  ${timestamp} ${chalk.green("✔ RESTARTED")} :${portStr}${pidStr}`;
    console.log(output);
  } else if (status === "failed") {
    const reason = details.reason || "unknown error";
    const output = `  ${timestamp} ${chalk.red("✕ RESTART FAILED")} :${portStr} ${chalk.dim(`— ${reason}`)}`;
    console.log(output);
  } else if (status === "parked") {
    const output = `  ${timestamp} ${chalk.yellow("⚠ PARKED")} :${portStr} ${chalk.dim("— crashed 3 times in 60s, auto-restart disabled")}`;
    console.log(output);
  } else if (status === "skipped-kill") {
    const output = `  ${timestamp} ${chalk.gray("⊘ SKIP")} :${portStr} ${chalk.dim("— user-initiated kill detected")}`;
    console.log(output);
  }
}


function truncateStr(str, max) {
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
