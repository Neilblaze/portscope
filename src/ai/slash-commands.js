import chalk from "chalk";
import { persistProviderChoice } from "../config/loader.js";
import { sanitizeError } from "../config/sanitize-error.js";
import { resetUsage, printUsage } from "./usage.js";
import {
  listConversations,
  loadConversation,
  printHistory,
  printConversationPreview,
  exportConversation,
} from "./history.js";
import { staggerPrint, flashSuccess } from "../ui/animate.js";
import { switchProvider, revokeApiKeyFlow, browseModels, printStatus } from "./provider-flow.js";


export async function handleSlashCommand(input, state, messages, rl) {
  const parts = input.slice(1).split(/\s+/);
  const cmd = parts[0].toLowerCase();

  switch (cmd) {
    case "help":
      printSlashHelp();
      return;

    case "exit":
    case "quit":
      console.log(chalk.gray("\n  👋 Goodbye!\n"));
      return "exit";

    case "clear":
      messages.length = 0;
      resetUsage();
      await flashSuccess("Conversation cleared.");
      return;

    case "provider":
    case "providers":
      await switchProvider(state, rl, messages);
      return;

    case "revoke":
      await revokeApiKeyFlow(state, rl);
      return;

    case "models":
    case "model":
      if (parts[1]) {
        state.config.ai.model = parts.slice(1).join(" ");
        persistProviderChoice(state.config.ai.provider, state.config.ai.model);
        console.log(chalk.green(`\n  ✓ Model set to ${chalk.bold(state.config.ai.model)}\n`));
      } else {
        await browseModels(state, rl);
      }
      return;

    case "status":
      printStatus(state);
      return;

    case "usage":
      await printUsage(state);
      return;

    case "history":
      if (parts[1]) {
        const idx = parseInt(parts[1], 10);
        const conversations = listConversations(20);
        if (isNaN(idx) || idx < 1 || idx > conversations.length) {
          console.log(chalk.red(`\n  Invalid index. Use /history to see available conversations.\n`));
          return;
        }
        const conv = loadConversation(conversations[idx - 1].id);
        if (conv) {
          printConversationPreview(conv);
        } else {
          console.log(chalk.red(`\n  Conversation not found.\n`));
        }
      } else {
        printHistory();
      }
      return;

    case "load":
      if (!parts[1]) {
        console.log(chalk.yellow("\n  Usage: /load <n> — load a conversation from /history\n"));
        return;
      }
      {
        const idx = parseInt(parts[1], 10);
        const conversations = listConversations(20);
        if (isNaN(idx) || idx < 1 || idx > conversations.length) {
          console.log(chalk.red(`\n  Invalid index. Use /history to see available conversations.\n`));
          return;
        }
        const conv = loadConversation(conversations[idx - 1].id);
        if (conv && conv.messages) {
          messages.length = 0;
          messages.push(...conv.messages);
          state.conversationId = conv.id;
          console.log(chalk.green(`\n  ✓ Loaded conversation: ${chalk.bold(conv.title)}`));
          console.log(chalk.dim(`  ${conv.messages.length} messages restored.\n`));
        } else {
          console.log(chalk.red(`\n  Conversation not found.\n`));
        }
      }
      return;

    case "export":
      {
        const format = (parts[1] || "md").toLowerCase();
        if (!["md", "html", "txt"].includes(format)) {
          console.log(chalk.yellow(`\n  Supported formats: md, html, txt\n`));
          return;
        }
        if (messages.length === 0) {
          console.log(chalk.yellow(`\n  No conversation to export.\n`));
          return;
        }
        const firstMsg = messages.find((m) => m.role === "user" && (m.content || m._text));
        const conv = {
          id: state.conversationId,
          title: (firstMsg ? (typeof firstMsg.content === "string" ? firstMsg.content : firstMsg._text) : "Untitled").slice(0, 60),
          provider: state.config.ai.provider,
          model: state.config.ai.model,
          startedAt: new Date().toISOString(),
          messages,
        };
        try {
          const filepath = exportConversation(conv, format);
          console.log(chalk.green(`\n  ✓ Exported to ${chalk.bold(filepath)}\n`));
        } catch (err) {
          console.log(chalk.red(`\n  Export failed: ${sanitizeError(err)}\n`));
        }
      }
      return;

    case "verbose":
      state.verbose = !state.verbose;
      if (state.verbose) {
        console.log(chalk.green(`\n  ✓ Verbose mode ${chalk.bold("enabled")} — streaming & detailed tool output`));
      } else {
        console.log(chalk.green(`\n  ✓ Verbose mode ${chalk.bold("disabled")} — compact output`));
      }
      console.log();
      return;

    default:
      console.log(chalk.yellow(`\n  Unknown command: /${cmd}`));
      printSlashHelp();
      return;
  }
}

function printSlashHelp() {
  const lines = [
    "",
    chalk.rgb(255, 140, 0).bold("  Direct Commands") + chalk.dim("  (no AI needed)"),
    chalk.gray("  ──────────────────────────────────────────────────❯"),
    `  ${chalk.cyan("<port>")}           Inspect a specific port`,
    `  ${chalk.cyan("kill <n>")}         Kill by port, PID, or range`,
    `  ${chalk.cyan("kill all")}         Kill all dev server ports`,
    `  ${chalk.cyan("pause <n>")}        Suspend a process (SIGSTOP)`,
    `  ${chalk.cyan("resume <n>")}       Resume a paused process (SIGCONT)`,
    `  ${chalk.cyan("ps")}               Show running dev processes`,
    `  ${chalk.cyan("list")}             Refresh port table`,
    `  ${chalk.cyan("logs <n>")}         Tail log output`,
    `  ${chalk.cyan("clean")}            Kill orphaned/zombie servers`,
    `  ${chalk.cyan("watch")}            Monitor port changes`,
    "",
    chalk.rgb(255, 140, 0).bold("  AI & Config"),
    chalk.gray("  ──────────────────────────────────────────────────❯"),
    `  ${chalk.cyan("/provider")}        Switch AI provider & add API key`,
    `  ${chalk.cyan("/revoke")}          Revoke a saved API key`,
    `  ${chalk.cyan("/models")}          Browse and select a model`,
    `  ${chalk.cyan("/model <name>")}    Set model directly`,
    `  ${chalk.cyan("/status")}          Show current provider & model`,
    `  ${chalk.cyan("/usage")}           Usage dashboard, context & telemetry`,
    `  ${chalk.cyan("/verbose")}         Toggle verbose/streaming mode`,
    `  ${chalk.cyan("/clear")}           Reset conversation history`,
    "",
    chalk.rgb(255, 140, 0).bold("  History & Export"),
    chalk.gray("  ──────────────────────────────────────────────────❯"),
    `  ${chalk.cyan("/history")}         List previous conversations`,
    `  ${chalk.cyan("/history <n>")}     Preview a conversation`,
    `  ${chalk.cyan("/load <n>")}        Restore a previous conversation`,
    `  ${chalk.cyan("/export [fmt]")}    Export as md, html, or txt`,
    "",
    chalk.dim('  Or just type naturally — e.g. "show me what\'s using the most CPU"'),
    chalk.dim("  Attach images: include a path like ~/screenshot.png in your query"),
    chalk.dim("  Type exit to quit · Tab-complete slash commands with /"),
    "",
  ];

  staggerPrint(lines).catch(() => {
    for (const l of lines) console.log(l);
  });
}
