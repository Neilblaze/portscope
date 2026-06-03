import chalk from "chalk";
import stringWidth from "string-width";
import { formatFramework } from "./format.js";
import { formatBytes } from "../scanner/utils.js";
import { renderBanner } from "./banner.js";

let lastWatchLineWidth = 50;

// Display watch mode events
export function displayWatchEvent(type, info, maxWidth = 10) {
  const timestamp = chalk.gray(new Date().toLocaleTimeString());

  const paddedWidth = maxWidth + 2;

  if (type === "new") {
    const nameAndPid = `${info.processName || "unknown"} [${info.pid}]`;
    const paddedProcess = chalk.white(nameAndPid.padEnd(paddedWidth, " "));
    const memoryStr = chalk.gray((info.memory || "—").padEnd(8, " "));
    const bindRaw = info.bindAddress || "0.0.0.0";
    const bindPadded = bindRaw.padEnd(9, " ");
    const coloredBind = bindRaw === "0.0.0.0" || bindRaw === "[::]" ? chalk.yellow(bindPadded) : chalk.gray(bindPadded);
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
    const bindRaw = info.bindAddress || "0.0.0.0";
    const bindPadded = bindRaw.padEnd(9, " ");
    const coloredBind = bindRaw === "0.0.0.0" || bindRaw === "[::]" ? chalk.yellow(bindPadded) : chalk.gray(bindPadded);
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


export async function displayWatchHeader() {
  await renderBanner();
  console.log(chalk.cyan.bold("  Watching for port changes..."));
  console.log(chalk.gray("  Press Ctrl+C to stop\n"));
}
