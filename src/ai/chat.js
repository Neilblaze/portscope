import chalk from "chalk";
import { generateConversationId, saveConversation } from "./history.js";
import { extractImages, toAnthropicImageContent, toOpenAIImageContent } from "./image.js";
import { createGhostTextInterface } from "../ui/ghost-text.js";
import { sanitizeError } from "../config/sanitize-error.js";
import { handleSlashCommand } from "./slash-commands.js";
import { processConversation } from "./tool-loop.js";
import { printChatHeader } from "./provider-flow.js";


export async function startChat(config, apiKey, verbose = false) {
  const messages = [];
  const conversationId = generateConversationId();
  const state = { config, apiKey, conversationId, verbose };

  const rl = createGhostTextInterface({
    input: process.stdin,
    output: process.stdout,
  });

  printChatHeader(state);

  const prompt = () => {
    rl.question(chalk.rgb(100, 200, 255)("  ❯ "), async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        prompt();
        return;
      }

      if (trimmed.startsWith("/")) {
        const handled = await handleSlashCommand(trimmed, state, messages, rl);
        if (handled === "exit") {
          rl.close();
          return;
        }
        prompt();
        return;
      }

      if (["exit", "quit", ".exit"].includes(trimmed.toLowerCase())) {
        console.log(chalk.gray("\n  👋 Goodbye!\n"));
        rl.close();
        return;
      }

      if (!state.apiKey) {
        console.log(chalk.yellow("\n  No API key configured. Use /provider to set one up.\n"));
        prompt();
        return;
      }

      const { text, images, errors } = extractImages(trimmed);
      for (const err of errors) {
        console.log(chalk.yellow(`  ⚠ ${err}`));
      }
      if (images.length > 0) {
        for (const img of images) {
          console.log(chalk.dim(`  📎 Attached: ${img.originalPath} (${img.sizeKB} KB)`));
        }
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
        console.log(chalk.red(`\n  Error: ${sanitizeError(err)}\n`));
      }

      prompt();
    });
  };

  prompt();

  await new Promise((resolve) => {
    rl.on("close", resolve);
  });
}
