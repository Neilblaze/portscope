import chalk from "chalk";
import { formatFramework } from "./format.js";
import { renderBanner } from "./banner.js";


// Display watch mode events
export function displayWatchEvent(type, info, maxWidth = 10) {
  const timestamp = chalk.gray(new Date().toLocaleTimeString());
  
  const paddedWidth = maxWidth + 2;

  if (type === "new") {
    const processName = info.processName || "unknown";
    const paddedProcess = processName.padEnd(paddedWidth, " ");
    const connections = info.connections !== undefined ? info.connections : 0;
    const connStr = String(connections).padStart(3, " ");
    
    console.log(
      `  ${timestamp} ${chalk.green("▲ NEW")}    :${chalk.white.bold(String(info.port).padEnd(5))} ← ${chalk.white(paddedProcess)} │ ${chalk.cyan(connStr)} conn │`,
    );
  } else if (type === "update") {
    const processName = info.processName || "unknown";
    const paddedProcess = processName.padEnd(paddedWidth, " ");
    const connections = info.connections !== undefined ? info.connections : 0;
    const connStr = String(connections).padStart(3, " ");
    
    let rateStr = "";
    if (info.requestRate > 0) {
      const rate = info.requestRate.toFixed(1);
      rateStr = ` │ ${chalk.magenta(rate.padStart(5, " "))} req/s`;
    }
    
    console.log(
      `  ${timestamp} ${chalk.blue("◆ UPDATE")} :${chalk.white.bold(String(info.port).padEnd(5))} ← ${chalk.white(paddedProcess)} │ ${chalk.cyan(connStr)} conn${rateStr}`,
    );
  } else if (type === "removed") {
    console.log(
      `  ${timestamp} ${chalk.red("▼ CLOSED")} :${chalk.white.bold(info.port)}`,
    );
  }
}


// Display watch mode header
export function displayWatchHeader() {
  renderBanner();
  console.log(chalk.cyan.bold("  Watching for port changes..."));
  console.log(chalk.gray("  Press Ctrl+C to stop\n"));
}
