#!/usr/bin/env node

import { listCommand } from "./commands/list.js";
import { inspectCommand } from "./commands/inspect.js";
import { killCommand } from "./commands/kill.js";
import { cleanCommand } from "./commands/clean.js";
import { logsCommand } from "./commands/logs.js";
import { watchCommand } from "./commands/watch.js";
import { psCommand } from "./commands/ps.js";
import { helpCommand } from "./commands/help.js";
import { chatCommand } from "./commands/chat.js";
import { pauseCommand, resumeCommand } from "./commands/pause.js";
import { interactiveMode } from "./commands/interactive.js";
import { sanitizeError } from "./config/sanitize-error.js";
import chalk from "chalk";

const args = process.argv.slice(2);
const showAll = args.includes("--all") || args.includes("-a");
const verbose = args.includes("--verbose");
const filteredArgs = args.filter((a) => a !== "--all" && a !== "-a" && a !== "--verbose");
const command = filteredArgs[0];

async function main() {
  // No args: interactive mode (shows ports + REPL) on TTY, just list on pipe
  if (!command) {
    if (process.stdin.isTTY) {
      await interactiveMode(showAll, verbose);
    } else {
      await listCommand(showAll);
    }
    return;
  }

  // Specific port number
  const portNum = parseInt(command, 10);
  if (!isNaN(portNum)) {
    await inspectCommand(portNum);
    return;
  }

  switch (command) {
    case "ps":
      await psCommand(showAll);
      break;
    case "clean":
      await cleanCommand();
      break;
    case "kill":
      await killCommand(filteredArgs);
      break;
    case "logs":
      await logsCommand(filteredArgs);
      break;
    case "watch":
      await watchCommand();
      break;
    case "chat":
      await chatCommand(verbose);
      break;
    case "pause":
      await pauseCommand(filteredArgs);
      break;
    case "resume":
      await resumeCommand(filteredArgs);
      break;
    case "help":
    case "--help":
    case "-h":
      helpCommand();
      break;
    case "mcp": {
      const { mcpCommand } = await import("./commands/mcp.js");
      await mcpCommand(filteredArgs);
      break;
    }
    default:
      console.log(chalk.red(`\n  Unknown command: ${command}`));
      console.log(
        chalk.gray(`  Run ${chalk.cyan("portscope --help")} for usage.\n`),
      );
      process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(chalk.red(`\n  Error: ${sanitizeError(err)}\n`));
  process.exitCode = 1;
});
