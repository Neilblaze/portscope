import chalk from "chalk";
import { createInterface } from "readline";
import { loadConfig, getApiKey } from "../config/loader.js";
import { listCommand } from "./list.js";
import { inspectCommand } from "./inspect.js";
import { killCommand } from "./kill.js";
import { psCommand } from "./ps.js";
import { cleanCommand } from "./clean.js";
import { logsCommand } from "./logs.js";
import { watchCommand } from "./watch.js";
import { pauseCommand, resumeCommand } from "./pause.js";
import { handleSlashCommand, processConversation } from "../ai/conversation.js";

/** Slash commands for tab-completion */
const SLASH_COMMANDS = [
  { name: "/provider", desc: "Switch AI provider" },
  { name: "/models", desc: "Browse models" },
  { name: "/model", desc: "Set model" },
  { name: "/status", desc: "Current config" },
  { name: "/clear", desc: "Reset chat" },
  { name: "/help", desc: "All commands" },
  { name: "/exit", desc: "Quit" },
];

/**
 * Interactive REPL mode.
 * Shows port table → enters persistent prompt where users can:
 *   - Type natural language (routed to AI if key configured)
 *   - Type direct commands (kill, ps, inspect, etc.)
 *   - Use slash commands (/provider, /models, etc.)
 */
export async function interactiveMode(showAll) {
  console.clear();

  await listCommand(showAll, true);

  const config = await loadConfig();
  const apiKey = getApiKey(config);
  const messages = [];
  const state = { config, apiKey };

  console.log(chalk.gray("  ─────────────────────────────────────────────────────────────────────────────"));
  if (apiKey) {
    console.log(
      chalk.dim("  💡 Ask anything — ") +
      chalk.dim.italic("\"what's hogging port 3000?\"") +
      chalk.dim(" — or use a direct command below."),
    );
  } else {
    console.log(
      chalk.dim("  💡 Use direct commands below, or ") +
      chalk.cyan("/provider") +
      chalk.dim(" to enable AI natural language."),
    );
  }
  console.log(
    chalk.dim("     ") +
    chalk.cyan("kill <port>") + chalk.dim(" · ") +
    chalk.cyan("pause <port>") + chalk.dim(" · ") +
    chalk.cyan("resume <port>") + chalk.dim(" · ") +
    chalk.cyan("ps") + chalk.dim(" · ") +
    chalk.cyan("logs <port>")
  );
  console.log(
    chalk.dim("     ") +
    chalk.cyan("clean") + chalk.dim(" · ") +
    chalk.cyan("watch") + chalk.dim(" · ") +
    chalk.cyan("<port>") + chalk.dim(" (inspect) · ") +
    chalk.cyan("help") + chalk.dim(" · ") +
    chalk.cyan("exit")
  );
  console.log();

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    completer: slashCompleter,
  });

  rl.on("SIGINT", () => {
    console.log(chalk.gray("\n  👋 Goodbye!\n"));
    rl.close();
  });

  const promptPrefix = chalk.rgb(100, 200, 255)("  ❯ ");

  console.log(promptPrefix + chalk.gray("Type a command or say hi to PortScope ..."));
  process.stdout.write("\x1b[1A\x1b[2K");

  const prompt = () => {
    rl.question(promptPrefix, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        prompt();
        return;
      }

      if (["exit", "quit", ".exit"].includes(trimmed.toLowerCase())) {
        console.log(chalk.gray("\n  👋 Goodbye!\n"));
        rl.close();
        return;
      }

      if (trimmed.startsWith("/")) {
        const result = await handleSlashCommand(trimmed, state, messages, rl);
        if (result === "exit") {
          rl.close();
          return;
        }
        prompt();
        return;
      }

      const handled = await handleDirectCommand(trimmed, rl);
      if (handled) {
        prompt();
        return;
      }

      if (!state.apiKey) {
        console.log();
        console.log(
          chalk.yellow("  💬 To use natural language, set up an AI provider with ") +
          chalk.cyan("/provider"),
        );
        console.log(
          chalk.dim("  You can still use direct commands: ") +
          chalk.cyan("kill <port>") + chalk.dim(", ") +
          chalk.cyan("<port>") + chalk.dim(", ") +
          chalk.cyan("ps") + chalk.dim(", ") +
          chalk.cyan("clean") + chalk.dim(", ") +
          chalk.cyan("watch") + chalk.dim(", ") +
          chalk.cyan("logs <port>"),
        );
        console.log(chalk.dim("  Type ") + chalk.cyan("help") + chalk.dim(" or ") + chalk.cyan("/help") + chalk.dim(" for the full command list."));
        console.log();
        prompt();
        return;
      }

      messages.push({ role: "user", content: trimmed });
      try {
        await processConversation(state.config, state.apiKey, messages, rl);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      prompt();
    });
  };

  prompt();
  await new Promise((resolve) => rl.on("close", resolve));
}

/**
 * Tab-completion for slash commands.
 * When user types "/" and presses Tab, shows matching commands.
 */
function slashCompleter(line) {
  const trimmed = line.trimStart();

  if (trimmed.startsWith("/")) {
    const matches = SLASH_COMMANDS
      .filter((c) => c.name.startsWith(trimmed))
      .map((c) => c.name);
    if (matches.length > 0) {
      return [matches, trimmed];
    }
  }

  // No completions
  return [[], line];
}


/**
 * Parse and execute direct commands in the REPL.
 * Returns true if the input was handled as a command, false otherwise.
 */
async function handleDirectCommand(input, rl) {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  // Bare port number → inspect
  const portNum = parseInt(cmd, 10);
  if (!isNaN(portNum) && String(portNum) === cmd) {
    try {
      await inspectCommand(portNum);
    } catch (err) {
      console.log(chalk.red(`\n  Error: ${err.message}\n`));
    }
    return true;
  }

  switch (cmd) {
    case "kill":
      if (parts.length > 1 && !/^\d+(-\d+)?$/.test(parts[1]) && parts[1] !== "all") {
        return false;
      }
      try {
        await killCommand(parts, rl);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "ps":
      if (parts.length > 2 || (parts[1] && !["--all", "-a"].includes(parts[1]))) return false;
      try {
        await psCommand(parts.includes("--all") || parts.includes("-a"), false);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "clean":
      try {
        await cleanCommand(rl);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "logs":
      try {
        await logsCommand(parts);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "watch":
      try {
        await watchCommand();
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "pause":
      try {
        await pauseCommand(parts);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "resume":
      try {
        await resumeCommand(parts);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "inspect":
      if (parts[1]) {
        try {
          await inspectCommand(parseInt(parts[1], 10));
        } catch (err) {
          console.log(chalk.red(`\n  Error: ${err.message}\n`));
        }
      } else {
        console.log(chalk.gray("  Usage: inspect <port>"));
      }
      return true;

    case "list":
    case "ports":
      if (parts.length > 2 || (parts[1] && !["--all", "-a", "ports"].includes(parts[1]))) {
        return false;
      }
      try {
        await listCommand(parts.includes("--all") || parts.includes("-a"), false);
      } catch (err) {
        console.log(chalk.red(`\n  Error: ${err.message}\n`));
      }
      return true;

    case "help":
      printInteractiveHelp();
      return true;

    default:
      return false;
  }
}



// NOTE: Maybe I'll add some more commands/options here.
function printInteractiveHelp() {
  console.log();
  console.log(chalk.cyan.bold("  Direct Commands") + chalk.dim("  (no AI needed)"));
  console.log(chalk.gray("  ─────────────────────────────────────────"));
  console.log(`  ${chalk.cyan("<port>")}           Inspect a specific port`);
  console.log(`  ${chalk.cyan("kill <n>")}         Kill by port, PID, or range`);
  console.log(`  ${chalk.cyan("kill all")}         Kill all dev server ports`);
  console.log(`  ${chalk.cyan("pause <n>")}        Suspend a process (SIGSTOP)`);
  console.log(`  ${chalk.cyan("resume <n>")}       Resume a paused process (SIGCONT)`);
  console.log(`  ${chalk.cyan("ps")}               Show running dev processes`);
  console.log(`  ${chalk.cyan("list")}             Refresh port table`);
  console.log(`  ${chalk.cyan("logs <n>")}         Tail log output`);
  console.log(`  ${chalk.cyan("clean")}            Kill orphaned/zombie servers`);
  console.log(`  ${chalk.cyan("watch")}            Monitor port changes`);
  console.log();
  console.log(chalk.cyan.bold("  AI & Config"));
  console.log(chalk.gray("  ─────────────────────────────────────────"));
  console.log(`  ${chalk.cyan("/provider")}        Switch AI provider & add API key`);
  console.log(`  ${chalk.cyan("/models")}          Browse and select a model`);
  console.log(`  ${chalk.cyan("/model <name>")}    Set model directly`);
  console.log(`  ${chalk.cyan("/status")}          Show current provider & model`);
  console.log(`  ${chalk.cyan("/clear")}           Reset conversation history`);
  console.log();
  console.log(chalk.dim("  Or just type naturally — e.g. \"show me what's using the most CPU\""));
  console.log(chalk.dim("  Type exit to quit · Tab-complete slash commands with /"));
  console.log();
}
