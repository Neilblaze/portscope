import chalk from "chalk";
import { VERSION } from "../version.js";


export function helpCommand() {
  console.log();
  console.log(
    chalk.rgb(100, 200, 255).bold("  ╭─────────────────────────────────────────╮"),
  );
  console.log(
    chalk.rgb(100, 200, 255).bold("  │") +
    chalk.white.bold("  🔊 PortScope") +
    chalk.dim(` v${VERSION}`) +
    " ".repeat(Math.max(1, 26 - VERSION.length)) +
    chalk.rgb(100, 200, 255).bold("│"),
  );
  console.log(
    chalk.rgb(100, 200, 255).bold("  ╰─────────────────────────────────────────╯"),
  );
  console.log();
  console.log(chalk.white.bold("  Commands"));
  console.log(chalk.gray("  ─────────────────────────────────────────"));
  console.log(
    `    ${chalk.cyan("portscope")}                Show dev server ports`,
  );
  console.log(
    `    ${chalk.cyan("portscope --all")}          Show all listening ports`,
  );
  console.log(
    `    ${chalk.cyan("portscope ps")}             Show running dev processes`,
  );
  console.log(
    `    ${chalk.cyan("portscope <port>")}         Detailed info about a port`,
  );
  console.log(
    `    ${chalk.cyan("portscope kill <n>")}       Kill by port, PID, or range`,
  );
  console.log(
    `    ${chalk.cyan("portscope kill 3k,5k,8k")}  Kill comma-separated ports`,
  );
  console.log(
    `    ${chalk.cyan("portscope kill all")}       Kill all dev server ports`,
  );
  console.log(
    `    ${chalk.cyan("portscope logs <n>")}       Tail log output for a port`,
  );
  console.log(
    `    ${chalk.cyan("portscope clean")}          Kill orphaned/zombie servers`,
  );
  console.log(
    `    ${chalk.cyan("portscope watch")}          Monitor port changes live`,
  );
  console.log(
    `    ${chalk.cyan("portscope watch --fe")}     Watch any specific type of port`,
  );
  console.log(
    `    ${chalk.cyan("portscope watch --fe,be")} Watch frontend + backend`,
  );
  console.log(
    `    ${chalk.cyan("portscope watch --ar")}     Auto-restart crashed ports`,
  );
  console.log();
  console.log(
    chalk.dim(`    Here, fe=frontend, be=backend, db=database, api=backend`),
  );
  console.log(
    chalk.dim(`          ml=ml/ai, ui=frontend`),
  );
  console.log();
  console.log(
    `    ${chalk.cyan("portscope chat")}           AI-powered conversation mode`,
  );
  console.log(
    `    ${chalk.cyan("portscope pause <n>")}      Suspend a process (SIGSTOP)`,
  );
  console.log(
    `    ${chalk.cyan("portscope resume <n>")}     Resume a paused process (SIGCONT)`,
  );
  console.log(
    `    ${chalk.cyan("portscope restart <n>")}    Kill & relaunch a process by port`,
  );
  console.log();
  console.log(chalk.white.bold("  Chat Slash Commands"));
  console.log(chalk.gray("  ─────────────────────────────────────────"));
  console.log(
    `    ${chalk.cyan("/provider")}   Switch AI provider & add API key`,
  );
  console.log(
    `    ${chalk.cyan("/models")}     Browse and select a model`,
  );
  console.log(
    `    ${chalk.cyan("/status")}     Show current provider & model`,
  );
  console.log(
    `    ${chalk.cyan("/clear")}      Reset conversation history`,
  );
  console.log();
  console.log(chalk.dim(`  Aliases: ${chalk.white("ports")}, ${chalk.white("whoisonport")}`));
  console.log();
}
