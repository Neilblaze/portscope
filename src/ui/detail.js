import chalk from "chalk";
import { formatFramework, formatStatus } from "./format.js";
import { renderBanner } from "./banner.js";


// Display detailed info for a single port
export function displayPortDetail(info) {
  renderBanner();

  if (!info) {
    console.log(chalk.red("  No process found on that port.\n"));
    return;
  }

  const box = (label, value) => {
    console.log(`  ${chalk.dim(label.padEnd(16))} ${value}`);
  };

  console.log(chalk.rgb(100, 200, 255).bold(`  ╭─ Port :${info.port} ${"─".repeat(Math.max(1, 30 - String(info.port).length))}╮`));
  console.log();

  box("Process", chalk.white.bold(info.processName || info.rawName || "—"));
  box("PID", chalk.gray(String(info.pid)));
  box("Status", formatStatus(info.status));
  box("Framework", formatFramework(info.framework));
  box("Memory", info.memory ? chalk.green(info.memory) : chalk.gray("—"));
  box("Uptime", info.uptime ? chalk.yellow(info.uptime) : chalk.gray("—"));
  if (info.startTime) {
    box("Started", chalk.gray(info.startTime.toLocaleString()));
  }

  console.log();
  console.log(chalk.rgb(100, 200, 255).bold("  ╭─ Location ──────────────────────╮"));
  console.log();
  box("Directory", info.cwd ? chalk.blue(info.cwd) : chalk.gray("—"));
  box(
    "Project",
    info.projectName ? chalk.white(info.projectName) : chalk.gray("—"),
  );
  box(
    "Git Branch",
    info.gitBranch ? chalk.magenta(info.gitBranch) : chalk.gray("—"),
  );

  if (info.processTree && info.processTree.length > 0) {
    console.log();
    console.log(chalk.rgb(100, 200, 255).bold("  ╭─ Process Tree ───────────────────╮"));
    console.log();
    for (let i = 0; i < info.processTree.length; i++) {
      const node = info.processTree[i];
      const indent = "  ".repeat(i);
      const prefix = i === 0 ? "→" : "└─";
      const pidColor = node.pid === info.pid ? chalk.white.bold : chalk.gray;
      console.log(
        `  ${indent}${chalk.gray(prefix)} ${pidColor(node.name)} ${chalk.gray(`(${node.pid})`)}`,
      );
    }
  }

  console.log();
  console.log(
    chalk.dim("  Actions: ") +
    chalk.cyan(`portscope kill ${info.port}`) +
    chalk.dim(" · ") +
    chalk.cyan(`portscope kill -f ${info.port}`) +
    chalk.dim(" (force)"),
  );
  console.log();
}

