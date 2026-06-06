import chalk from "chalk";
import Table from "cli-table3";
import { formatFramework, formatStatus, formatEnvironment } from "./format.js";
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


export async function displayPortTable(ports, filtered = false, showBanner = true) {
  if (showBanner) await renderBanner();

  const shouldIndent = process.env.PORTSCOPE_REPL_ACTIVE === "true" && !showBanner;
  const prefix = shouldIndent ? "    " : "";

  // TODO: I'll try to make this a bit more better when I get some peace of mind and time :)
  if (ports.length === 0) {
    const boxPrefix = shouldIndent ? "    " : "  ";
    console.log(boxPrefix + chalk.gray("╭─ ") + chalk.yellow("No Ports Found") + chalk.gray(" ────────────────────────╮"));
    console.log(boxPrefix + chalk.gray("│                                         │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.white("PortScope didn't detect any active") + chalk.gray("     │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.white("dev servers right now.") + chalk.gray("                 │"));
    console.log(boxPrefix + chalk.gray("│                                         │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.dim("Start your Next.js, Vite, or Python") + chalk.gray("    │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.dim("backend and run ") + chalk.cyan("portscope") + chalk.dim(" again.") + chalk.gray("       │"));
    console.log(boxPrefix + chalk.gray("╰─────────────────────────────────────────╯\n"));
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
      chalk.rgb(100, 200, 255).bold("ENV"),
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
      formatEnvironment(p.environment),
      p.uptime ? chalk.yellow(p.uptime) : chalk.gray("—"),
      formatStatus(p.status),
    ]);
  }

  const tableStr = table.toString();
  if (shouldIndent) {
    console.log(tableStr.split("\n").map((line) => prefix + line).join("\n"));
  } else {
    console.log(tableStr);
  }
  console.log();

  const count = chalk.white.bold(ports.length);
  const suffix = ports.length === 1 ? "port" : "ports";
  const allHint = filtered
    ? chalk.dim(" ·  ") +
    chalk.cyan("--all") +
    chalk.dim(" to show everything")
    : "";
  console.log(
    (shouldIndent ? "    " : "  ") +
    chalk.dim(`${count} ${chalk.dim(suffix)} active`) +
    chalk.dim(" · ") +
    chalk.dim("Run ") +
    chalk.cyan("portscope <port>") +
    chalk.dim(" for details") +
    allHint,
  );
  console.log();
}


export async function displayProcessTable(processes, filtered = false, showBanner = true) {
  if (showBanner) await renderBanner();

  const shouldIndent = process.env.PORTSCOPE_REPL_ACTIVE === "true" && !showBanner;
  const prefix = shouldIndent ? "    " : "";

  if (processes.length === 0) {
    const boxPrefix = shouldIndent ? "    " : "  ";
    console.log(boxPrefix + chalk.gray("╭─ ") + chalk.yellow("No Processes Found") + chalk.gray(" ────────────────────╮"));
    console.log(boxPrefix + chalk.gray("│                                         │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.white("PortScope didn't detect any active") + chalk.gray("     │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.white("dev processes right now.") + chalk.gray("               │"));
    console.log(boxPrefix + chalk.gray("│                                         │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.dim("Run ") + chalk.cyan("portscope ps --all") + chalk.dim(" to see all") + chalk.gray("      │"));
    console.log(boxPrefix + chalk.gray("│  ") + chalk.dim("processes, including system apps.") + chalk.gray("       │"));
    console.log(boxPrefix + chalk.gray("╰─────────────────────────────────────────╯\n"));
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

  const tableStr = table.toString();
  if (shouldIndent) {
    console.log(tableStr.split("\n").map((line) => prefix + line).join("\n"));
  } else {
    console.log(tableStr);
  }
  console.log();
  const count = chalk.white.bold(processes.length);
  const suffix = processes.length === 1 ? "process" : "processes";
  const allHint = filtered
    ? chalk.dim("  ·  ") +
    chalk.cyan("--all") +
    chalk.dim(" to show everything")
    : "";
  console.log((shouldIndent ? "    " : "  ") + chalk.dim(`${count} ${chalk.dim(suffix)}`) + allHint);
  console.log();
}
