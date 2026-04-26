import chalk from "chalk";
import { formatFramework } from "./format.js";
import { renderBanner } from "./banner.js";


// Display watch mode events
export function displayWatchEvent(type, info) {
  const timestamp = chalk.gray(new Date().toLocaleTimeString());

  if (type === "new") {
    const fw = info.framework ? ` ${formatFramework(info.framework)}` : "";
    const proj = info.projectName ? chalk.blue(` [${info.projectName}]`) : "";
    console.log(
      `  ${timestamp} ${chalk.green("▲ NEW")}    :${chalk.white.bold(info.port)} ← ${chalk.white(info.processName)}${proj}${fw}`,
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
