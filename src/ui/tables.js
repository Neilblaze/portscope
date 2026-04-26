import chalk from "chalk";
import Table from "cli-table3";
import { formatFramework, formatStatus } from "./format.js";
import { renderBanner } from "./banner.js";

const TABLE_CHARS = {
  top: "─",
  "top-mid": "┬",
  "top-left": "╭",
  "top-right": "╮",
  bottom: "─",
  "bottom-mid": "┴",
  "bottom-left": "╰",
  "bottom-right": "╯",
  left: "│",
  "left-mid": "├",
  mid: "─",
  "mid-mid": "┼",
  right: "│",
  "right-mid": "┤",
  middle: "│",
};

const TABLE_STYLE = {
  head: [],
  border: ["gray"],
  "padding-left": 1,
  "padding-right": 1,
};


export function displayPortTable(ports, filtered = false, showBanner = true) {
  if (showBanner) renderBanner();

  if (ports.length === 0) {
    console.log(chalk.gray("  No active listening ports found.\n"));
    console.log(
      chalk.gray("  Start a dev server and run ") +
      chalk.cyan("portscope") +
      chalk.gray(" again.\n"),
    );
    return;
  }

  const table = new Table({
    chars: TABLE_CHARS,
    style: TABLE_STYLE,
    head: [
      chalk.rgb(100, 200, 255).bold("PORT"),
      chalk.rgb(100, 200, 255).bold("PROCESS"),
      chalk.rgb(100, 200, 255).bold("PID"),
      chalk.rgb(100, 200, 255).bold("PROJECT"),
      chalk.rgb(100, 200, 255).bold("FRAMEWORK"),
      chalk.rgb(100, 200, 255).bold("UPTIME"),
      chalk.rgb(100, 200, 255).bold("STATUS"),
    ],
  });

  for (const p of ports) {
    table.push([
      chalk.white.bold(`:${p.port}`),
      chalk.white(p.processName || p.rawName || "—"),
      chalk.gray(String(p.pid)),
      p.projectName ? chalk.blue(p.projectName) : chalk.gray("—"),
      formatFramework(p.framework),
      p.uptime ? chalk.yellow(p.uptime) : chalk.gray("—"),
      formatStatus(p.status),
    ]);
  }

  console.log(table.toString());
  console.log();

  const count = chalk.white.bold(ports.length);
  const suffix = ports.length === 1 ? "port" : "ports";
  const allHint = filtered
    ? chalk.dim("  ·  ") +
    chalk.cyan("--all") +
    chalk.dim(" to show everything")
    : "";
  console.log(
    chalk.dim(`  ${count} ${chalk.dim(suffix)} active`) +
    chalk.dim("  ·  ") +
    chalk.dim("Run ") +
    chalk.cyan("portscope <port>") +
    chalk.dim(" for details") +
    allHint,
  );
  console.log();
}


export function displayProcessTable(processes, filtered = false, showBanner = true) {
  if (showBanner) renderBanner();

  if (processes.length === 0) {
    console.log(chalk.gray("  No dev processes found.\n"));
    console.log(
      chalk.gray("  Run ") +
      chalk.cyan("portscope ps --all") +
      chalk.gray(" to show all processes.\n"),
    );
    return;
  }

  const table = new Table({
    chars: TABLE_CHARS,
    style: TABLE_STYLE,
    head: [
      chalk.rgb(100, 200, 255).bold("PID"),
      chalk.rgb(100, 200, 255).bold("PROCESS"),
      chalk.rgb(100, 200, 255).bold("CPU%"),
      chalk.rgb(100, 200, 255).bold("MEM"),
      chalk.rgb(100, 200, 255).bold("PROJECT"),
      chalk.rgb(100, 200, 255).bold("FRAMEWORK"),
      chalk.rgb(100, 200, 255).bold("UPTIME"),
      chalk.rgb(100, 200, 255).bold("WHAT"),
    ],
  });

  for (const p of processes) {
    const cpuStr = p.cpu.toFixed(1);
    let cpuColored;
    if (p.cpu > 25) cpuColored = chalk.red(cpuStr);
    else if (p.cpu > 5) cpuColored = chalk.yellow(cpuStr);
    else cpuColored = chalk.green(cpuStr);

    table.push([
      chalk.gray(String(p.pid)),
      chalk.white.bold(p.processName || "—"),
      cpuColored,
      p.memory ? chalk.green(p.memory) : chalk.gray("—"),
      p.projectName ? chalk.blue(p.projectName) : chalk.gray("—"),
      formatFramework(p.framework),
      p.uptime ? chalk.yellow(p.uptime) : chalk.gray("—"),
      chalk.gray(p.description || p.processName || "—"),
    ]);
  }

  console.log(table.toString());
  console.log();
  const count = chalk.white.bold(processes.length);
  const suffix = processes.length === 1 ? "process" : "processes";
  const allHint = filtered
    ? chalk.dim("  ·  ") +
    chalk.cyan("--all") +
    chalk.dim(" to show everything")
    : "";
  console.log(chalk.dim(`  ${count} ${chalk.dim(suffix)}`) + allHint);
  console.log();
}
