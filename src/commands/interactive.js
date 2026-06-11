import chalk from "chalk";
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
import { generateConversationId, saveConversation } from "../ai/history.js";
import { extractImages, toAnthropicImageContent, toOpenAIImageContent } from "../ai/image.js";
import { classifyIntent } from "../ai/intent.js";
import { createGhostTextInterface, setPortCache } from "../ui/ghost-text.js";
import { getListeningPorts } from "../scanner/ports.js";
import { formatChatError } from "../config/sanitize-error.js";
import { restartCommand } from "./restart.js";


const SLASH_COMMANDS = [
  { name: "/provider", desc: "Switch AI provider" },
  { name: "/revoke", desc: "Revoke a saved API key" },
  { name: "/models", desc: "Browse models" },
  { name: "/model", desc: "Set model" },
  { name: "/status", desc: "Current config" },
  { name: "/usage", desc: "Token usage & cost" },
  { name: "/verbose", desc: "Toggle verbose mode" },
  { name: "/clear", desc: "Reset chat" },
  { name: "/history", desc: "Previous conversations" },
  { name: "/load", desc: "Restore conversation" },
  { name: "/export", desc: "Export conversation" },
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
export async function interactiveMode(showAll, verbose = false) {
  process.env.PORTSCOPE_REPL_ACTIVE = "true";
  console.clear();

  await listCommand(showAll, true);

  try {
    const ports = await getListeningPorts();
    setPortCache(ports);
  } catch { /* non-critical — suggestions will just be empty */ }

  const config = await loadConfig();
  const apiKey = getApiKey(config);
  const messages = [];
  const state = { config, apiKey, verbose };
  state.conversationId = generateConversationId();

  console.log(chalk.gray(" ╭─────────────────────────────────────────────────────────────────────────────●"));
  if (apiKey) {
    console.log(
      chalk.gray(" ╰─") +
      chalk.dim("💡 Ask anything — ") +
      chalk.dim.italic("\"what's hogging port 3000?\"") +
      chalk.dim(", or use a direct command below."),
    );
  } else {
    console.log(
      chalk.gray(" ╰─") +
      chalk.dim("💡 Use direct commands below, or ") +
      chalk.cyan("/provider") +
      chalk.dim(" to enable AI natural language."),
    );
  }
  console.log(
    chalk.dim("     ") +
    chalk.blue(" kill <port>") + chalk.dim(" · ") +
    chalk.blue("pause <port>") + chalk.dim(" · ") +
    chalk.blue("resume <port>") + chalk.dim(" · ") +
    chalk.blue("restart <port>") + chalk.dim(" · ") +
    chalk.blue("ps") + chalk.dim(" · ") +
    chalk.blue("clean")
  );
  console.log(
    chalk.dim("     ") +
    chalk.blue(" logs <port>") + chalk.dim(" · ") +
    chalk.blue("watch") + chalk.dim(" · ") +
    chalk.blue("<port>") + chalk.dim(" (inspect) · ") +
    chalk.blue("help") + chalk.dim(" · ") +
    chalk.blue("exit")
  );
  console.log();

  const rl = createGhostTextInterface({
    input: process.stdin,
    output: process.stdout,
    completer: slashCompleter,
  });

  let isExecuting = false;

  rl.on("SIGINT", () => {
    if (isExecuting) {
      process.emit("SIGINT");
    } else {
      console.log(chalk.gray("\n  👋 Goodbye!\n"));
      rl.close();
    }
  });

  const promptPrefix = chalk.rgb(100, 200, 255)("  ❯ ");

  console.log(promptPrefix + chalk.gray("Type a command or say hi to PortScope ..."));
  process.stdout.write("\x1b[1A\x1b[2K");

  const prompt = () => {
    if (rl.closed) {
      return;
    }

    rl.question(promptPrefix, async (input) => {
      isExecuting = true;
      try {
        const trimmed = input.trim();
        if (!trimmed) {
          return;
        }

        if (["exit", "quit", ".exit"].includes(trimmed.toLowerCase())) {
          console.log(chalk.gray("\n  👋 Goodbye!\n"));
          rl.close();
          return;
        }

        if (trimmed.startsWith("/")) {
          await animateSlashCommand(promptPrefix, input);
          const result = await handleSlashCommand(trimmed, state, messages, rl);
          if (result === "exit") {
            rl.close();
          }
          return;
        }

        const handled = await handleDirectCommand(trimmed, rl);
        if (handled) {
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
          return;
        }

        const intent = classifyIntent(trimmed);

        if (intent.type === "injection_attempt") {
          console.log();
          console.log(chalk.yellow(`  ⛊️  ${intent.response}`));
          console.log();
          return;
        }

        if (intent.type === "off_topic") {
          console.log();
          console.log(chalk.yellow(`  🔒 ${intent.response}`));
          if (intent.suggestions && intent.suggestions.length > 0) {
            console.log(chalk.dim("  Try:"));
            for (const s of intent.suggestions.slice(0, 3)) {
              console.log(chalk.cyan(`    → ${s}`));
            }
          }
          console.log();
          return;
        }

        if (intent.type === "vague" && intent.suggestions) {
          console.log();
          console.log(chalk.dim("  💡 Tip: try one of these, or describe your issue:"));
          for (const s of intent.suggestions.slice(0, 3)) {
            console.log(chalk.dim(`    → ${s}`));
          }
          console.log();
        }

        const { text, images, errors } = extractImages(trimmed);
        for (const err of errors) {
          console.log(chalk.yellow(`  ⚠ ${err}`));
        }

        if (images.length > 0 && state.config.ai.provider === "ollama") {
          console.log(chalk.yellow(`  ⚠ Ollama vision not currently supported. Images ignored.\n`));
          images.length = 0;
        }

        if (images.length > 0) {
          const provider = state.config.ai.provider;
          let content;
          if (provider === "anthropic") {
            content = toAnthropicImageContent(text, images);
          } else {
            content = toOpenAIImageContent(text, images);
          }
          messages.push({ role: "user", content, _text: text });
        } else {
          messages.push({ role: "user", content: text });
        }

        try {
          await processConversation(state.config, state.apiKey, messages, rl, { verbose: state.verbose });
          saveConversation(state.conversationId, state.config, messages);
        } catch (err) {
          messages.pop();
          console.log(formatChatError(err));
        }
      } finally {
        isExecuting = false;
        if (!rl.closed) {
          prompt();
        }
      }
    });
  };

  prompt();
  await new Promise((resolve) => rl.on("close", resolve));
}

// Tab-completion for slash commands
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
 *
 * NOTE: If the input contains conjunctions (and, then, also, plus) after a
 * recognized command keyword, it is likely a compound/mixed intent such as
 * "kill 3000 and show port 8080". These are routed to the AI instead of
 * half-executing only the first command.
 */
async function handleDirectCommand(input, rl) {
  const parts = input.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  // Guard: detect compound/mixed-intent queries and route them to AI
  const CONJUNCTIONS = /\b(and\s+then|and\s+also|and\s+show|and\s+kill|and\s+list|then\s+show|then\s+kill|then\s+list|also\s+show|also\s+kill|also\s+list|\band\b.*\b(?:show|kill|list|inspect|clean|watch|pause|resume|restart|logs|ps)\b)\b/i;
  const COMMAND_WORDS = new Set(["kill", "ps", "clean", "logs", "watch", "pause", "resume", "restart", "inspect", "list", "ports", "help"]);
  if (COMMAND_WORDS.has(cmd) && parts.length > 2 && CONJUNCTIONS.test(input)) {
    return false;
  }

  // Bare port number → inspect
  const portNum = parseInt(cmd, 10);
  if (!isNaN(portNum) && String(portNum) === cmd) {
    try {
      await inspectCommand(portNum);
    } catch (err) {
      console.log(formatChatError(err));
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
        console.log(formatChatError(err));
      }
      return true;

    case "ps":
      if (parts.length > 2 || (parts[1] && !["--all", "-a"].includes(parts[1]))) return false;
      try {
        await psCommand(parts.includes("--all") || parts.includes("-a"), false);
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "clean":
      try {
        await cleanCommand(rl);
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "logs":
      try {
        await logsCommand(parts);
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "watch":
      {
        const extraTokens = parts.slice(1).filter((p) => !p.startsWith("--"));
        if (extraTokens.length > 0) return false;
        try {
          await watchCommand(parts, rl);
        } catch (err) {
          console.log(formatChatError(err));
        }
      }
      return true;

    case "pause":
      try {
        await pauseCommand(parts);
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "resume":
      try {
        await resumeCommand(parts);
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "restart":
      if (!parts[1] || !/^\d+$/.test(parts[1])) {
        console.log(chalk.gray("  Usage: restart <port>"));
        return true;
      }
      try {
        await restartCommand(parts, rl);
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "inspect":
      if (parts[1]) {
        try {
          await inspectCommand(parseInt(parts[1], 10));
        } catch (err) {
          console.log(formatChatError(err));
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
        try {
          const ports = await getListeningPorts();
          setPortCache(ports);
        } catch { /* non-critical */ }
      } catch (err) {
        console.log(formatChatError(err));
      }
      return true;

    case "help":
      printInteractiveHelp();
      return true;

    default:
      return false;
  }
}



async function animateSlashCommand(promptPrefix, input) {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/")) return false;

  const parts = trimmed.split(/\s+/);
  const cmd = parts[0].toLowerCase();

  const noArgs = ["/help", "/exit", "/quit", "/clear", "/provider", "/providers", "/revoke", "/models", "/status", "/usage", "/verbose"];
  const oneArg = ["/model", "/history", "/load", "/export"];

  let isValid = false;
  let baseCmd = "";
  let restStr = "";

  if (noArgs.includes(cmd) && parts.length === 1) {
    isValid = true;
    baseCmd = input.trimEnd();
  } else if (oneArg.includes(cmd) && parts.length <= 2) {
    isValid = true;
    const match = input.match(/^(\s*\/\w+)(\s+.*)?$/);
    if (match) {
      baseCmd = match[1];
      restStr = match[2] || "";
    } else {
      baseCmd = input.trimEnd();
    }
  }
  if (!isValid) return false;

  const colorMap = {
    "/exit": "red", "/quit": "red",
    "/clear": "yellow", "/revoke": "yellow",
    "/verbose": "green", "/status": "green", "/usage": "green"
  };

  const baseColor = colorMap[cmd] || "cyan";
  const brightColor = baseColor + "Bright";

  const frames = [
    chalk[baseColor],
    chalk[brightColor],
    chalk[brightColor].bold,
    chalk[brightColor],
    chalk[baseColor]
  ];

  process.stdout.write("\x1b[?25l");
  for (const frame of frames) {
    const styledCmd = frame(baseCmd);
    const styledRest = restStr ? chalk.dim(restStr) : "";
    process.stdout.write("\x1b[1A\x1b[2K\r" + promptPrefix + styledCmd + styledRest + "\n");
    await new Promise(r => setTimeout(r, 40));
  }
  process.stdout.write("\x1b[?25h");
  return true;
}

// NOTE: Maybe I'll add some more commands/options here.
function printInteractiveHelp() {
  console.log();
  console.log(chalk.rgb(255, 140, 0).bold("  Direct Commands") + chalk.dim("  (no AI needed)"));
  console.log(chalk.gray("  ──────────────────────────────────────────────────❯"));
  console.log(`  ${chalk.cyan("<port>")}           Inspect a specific port`);
  console.log(`  ${chalk.cyan("kill <n>")}         Kill by port, PID, or range`);
  console.log(`  ${chalk.cyan("kill all")}         Kill all dev server ports`);
  console.log(`  ${chalk.cyan("pause <n>")}        Suspend a process (SIGSTOP)`);
  console.log(`  ${chalk.cyan("resume <n>")}       Resume a paused process (SIGCONT)`);
  console.log(`  ${chalk.cyan("restart <n>")}      Kill & relaunch a process by port`);
  console.log(`  ${chalk.cyan("ps")}               Show running dev processes`);
  console.log(`  ${chalk.cyan("list")}             Refresh port table`);
  console.log(`  ${chalk.cyan("logs <n>")}         Tail log output`);
  console.log(`  ${chalk.cyan("clean")}            Kill orphaned/zombie servers`);
  console.log(`  ${chalk.cyan("watch")}            Monitor port changes live`);
  console.log(`  ${chalk.cyan("watch --ar")}       Auto-restart crashed ports`);
  console.log(`  ${chalk.cyan("watch --fe")}       Watch any specific type of port`);
  console.log(`  ${chalk.cyan("watch --fe,be")}    Watch frontend + backend`);
  console.log();
  console.log(chalk.dim("  Here, fe=frontend, be=backend, db=database, api=backend"));
  console.log(chalk.dim("        ml=ml/ai, ui=frontend"));
  console.log();
  console.log(chalk.rgb(255, 140, 0).bold("  AI & Config"));
  console.log(chalk.gray("  ──────────────────────────────────────────────────❯"));
  console.log(`  ${chalk.cyan("/provider")}        Switch AI provider & add API key`);
  console.log(`  ${chalk.cyan("/revoke")}          Revoke a saved API key`);
  console.log(`  ${chalk.cyan("/models")}          Browse and select a model`);
  console.log(`  ${chalk.cyan("/model <name>")}    Set model directly`);
  console.log(`  ${chalk.cyan("/status")}          Show current provider & model`);
  console.log(`  ${chalk.cyan("/usage")}           Show token usage & estimated cost`);
  console.log(`  ${chalk.cyan("/verbose")}         Toggle verbose/streaming mode`);
  console.log(`  ${chalk.cyan("/clear")}           Reset conversation history`);
  console.log();
  console.log(chalk.rgb(255, 140, 0).bold("  History & Export"));
  console.log(chalk.gray("  ──────────────────────────────────────────────────❯"));
  console.log(`  ${chalk.cyan("/history")}         List previous conversations`);
  console.log(`  ${chalk.cyan("/history <n>")}     Preview a conversation`);
  console.log(`  ${chalk.cyan("/load <n>")}        Restore a previous conversation`);
  console.log(`  ${chalk.cyan("/export [fmt]")}    Export as md, html, or txt`);
  console.log();
  console.log(chalk.dim("  Or just type naturally — e.g. \"show me what's using the most CPU\""));
  console.log(chalk.dim("  Attach images: include a path like ~/screenshot.png in your query"));
  console.log(chalk.dim("  Type exit to quit · Tab-complete slash commands with '/'"));
  console.log();
}
