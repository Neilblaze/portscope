import chalk from "chalk";
import { createInterface } from "readline";
import { sendMessage } from "./client.js";
import { executeTool } from "./executor.js";
import { TOOLS } from "./tools.js";
import { PROVIDER_DEFAULTS, PROVIDER_IDS } from "../config/schema.js";
import { getApiKeyForProvider, saveApiKey, resetConfig, persistProviderChoice } from "../config/loader.js";
import { fetchAvailableModels, validateApiKey } from "../config/models.js";
import { renderMarkdown } from "../ui/markdown.js";



const SYSTEM_PROMPT = `You are PortScope, a concise and helpful assistant for managing ports and processes on the user's machine.

You help users:
- See what's running on their ports
- Inspect specific ports for detailed info
- Kill processes by port or PID
- Find and clean up orphaned/zombie processes
- View process logs
- Monitor port changes

Behavior rules:
- For greetings (hi, hello, hey, etc.): respond with a SHORT one-liner like "Hey! What port or process do you need help with?" — do NOT list your capabilities or available tools. The user already sees a command reference in the terminal.
- For actual queries: call the appropriate tool immediately. Be action-oriented.
- When killing processes or cleaning up, explain what you're about to do before calling the tool.

Formatting rules:
- ALWAYS use markdown tables (| Port | Process | PID | ...) when listing ports, processes, or structured results. The terminal will render them as formatted GUI tables.
- Use **bold** for emphasis and \`code\` for port numbers, PIDs, and commands.
- Keep responses extremely concise, high-signal, and professional.
- Do NOT list tool names, function signatures, or internal API names to the user. Speak in natural language.
- Format port numbers with a colon prefix (e.g., :3000).`;



/**
 * Start the interactive AI chat loop.
 */
export async function startChat(config, apiKey) {
  const messages = [];
  const state = { config, apiKey };

  const rl = createInterface({
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

  await new Promise((resolve) => {
    rl.on("close", resolve);
  });
}


/**
 * Handle slash commands. Returns "exit" to close, or void.
 */
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
      console.log(chalk.green("\n  ✓ Conversation cleared.\n"));
      return;

    case "provider":
    case "providers":
      await switchProvider(state, rl);
      return;

    case "models":
    case "model":
      if (parts[1]) {
        // /model <name> — set directly
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

    default:
      console.log(chalk.yellow(`\n  Unknown command: /${cmd}`));
      printSlashHelp();
      return;
  }
}

function printSlashHelp() {
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

function printChatHeader(state) {
  const provider = PROVIDER_DEFAULTS[state.config.ai.provider];
  console.log();
  console.log(chalk.rgb(100, 200, 255).bold("  ╭─────────────────────────────────────────╮"));
  console.log(chalk.rgb(100, 200, 255).bold("  │") + chalk.white.bold("  🔊 PortScope Chat                      ") + chalk.rgb(100, 200, 255).bold("│"));
  console.log(chalk.rgb(100, 200, 255).bold("  ╰─────────────────────────────────────────╯"));
  if (state.apiKey) {
    console.log(
      chalk.gray(`  Provider: ${chalk.white(provider?.label || state.config.ai.provider)}`) +
      chalk.gray(` · Model: ${chalk.white(state.config.ai.model || "default")}`),
    );
  } else {
    console.log(chalk.yellow("  No API key configured. Type /provider to get started."));
  }
  console.log(chalk.dim("  Type /help for commands, or just ask a question.\n"));
}

function printStatus(state) {
  const provider = PROVIDER_DEFAULTS[state.config.ai.provider];
  console.log();
  console.log(chalk.cyan.bold("  Current Configuration"));
  console.log(chalk.gray("  ─────────────────────────────────"));
  console.log(`  ${chalk.gray("Provider")}    ${chalk.white.bold(provider?.label || state.config.ai.provider)}`);
  console.log(`  ${chalk.gray("Model")}       ${chalk.white.bold(state.config.ai.model || "not set")}`);
  console.log(`  ${chalk.gray("API Key")}     ${state.apiKey ? chalk.green("✓ configured") : chalk.red("✕ missing")}`);
  console.log(`  ${chalk.gray("Max Tokens")}  ${chalk.white(state.config.ai.maxTokens)}`);
  console.log();
}


/**
 * Interactive provider switcher with API key setup.
 */
async function switchProvider(state, rl) {
  console.log();
  console.log(chalk.cyan.bold("  Select a Provider"));
  console.log(chalk.gray("  ─────────────────────────────────"));

  for (let i = 0; i < PROVIDER_IDS.length; i++) {
    const id = PROVIDER_IDS[i];
    const defaults = PROVIDER_DEFAULTS[id];
    const isCurrent = id === state.config.ai.provider;
    const marker = isCurrent ? chalk.cyan(" ◀ current") : "";
    let keyStatus;
    if (id === "ollama") {
      keyStatus = chalk.dim(" (local)");
    } else {
      const hasKey = !!getApiKeyForProvider(id);
      keyStatus = hasKey ? chalk.green(" ✓") : chalk.dim(" ○");
    }
    console.log(`  ${chalk.white.bold(i + 1)}  ${chalk.white(defaults.label)}${keyStatus}${marker}`);
  }
  console.log(`  ${chalk.dim("0")}  ${chalk.dim("Exit")}`);
  console.log();

  const answer = await question(rl, chalk.yellow(`  Pick a provider (0-${PROVIDER_IDS.length}): `));
  const idx = parseInt(answer, 10);
  if (isNaN(idx) || idx < 1 || idx > PROVIDER_IDS.length) {
    if (idx !== 0) console.log(chalk.gray("  Cancelled.\n"));
    else console.log();
    return;
  }

  const provider = PROVIDER_IDS[idx - 1];
  const defaults = PROVIDER_DEFAULTS[provider];
  let apiKey = getApiKeyForProvider(provider);

  if (provider === "ollama") {
    const defaultEndpoint = "http://localhost:11434";
    const currentEndpoint = state.config.ai.ollamaEndpoint || defaultEndpoint;
    console.log();
    console.log(chalk.gray(`  Default Ollama endpoint: ${chalk.white(currentEndpoint)}`));
    const useCustom = await question(rl, chalk.yellow("  Use a custom endpoint? [y/N] "));

    let endpoint = currentEndpoint;
    if (useCustom.trim().toLowerCase() === "y") {
      const custom = await question(rl, chalk.yellow("  Enter Ollama endpoint (e.g. http://192.168.1.10:11434): "));
      if (custom.trim()) {
        endpoint = custom.trim().replace(/\/+$/, "");
      }
    }

    // Validate reachability at the chosen endpoint
    const tagsUrl = `${endpoint}/api/tags`;
    process.stdout.write(chalk.gray(`  Checking ${endpoint}...`));
    try {
      const res = await fetch(tagsUrl, { signal: AbortSignal.timeout(5000) });
      process.stdout.write("\r" + " ".repeat(60) + "\r");
      if (!res.ok) {
        console.log(chalk.red(`  ✕ Ollama at ${endpoint} returned ${res.status}`));
        return;
      }
    } catch (err) {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
      if (err.cause?.code === "ECONNREFUSED" || err.name === "TimeoutError") {
        console.log(chalk.red(`  ✕ Cannot connect to Ollama at ${endpoint}`));
      } else {
        console.log(chalk.red(`  ✕ ${err.message}`));
      }
      console.log(chalk.gray("  Make sure Ollama is running: ollama serve\n"));
      return;
    }

    console.log(chalk.green(`  ✓ Ollama is running at ${endpoint}`));
    state.config.ai.ollamaEndpoint = endpoint;
    apiKey = "local";
  } else if (!apiKey) {
    console.log();
    console.log(chalk.yellow(`  No API key found for ${defaults.label}.`));
    console.log(chalk.gray(`  Env variable: ${defaults.envKey}`));
    console.log();

    const key = await question(rl, chalk.yellow(`  Paste your ${defaults.label} API key: `));
    if (!key.trim()) {
      console.log(chalk.gray("  Cancelled.\n"));
      return;
    }

    // Validate Key
    process.stdout.write(chalk.gray("  Validating..."));
    const { valid, error } = await validateApiKey(provider, key.trim());
    process.stdout.write("\r" + " ".repeat(40) + "\r");

    if (!valid) {
      console.log(chalk.red(`  ✕ ${error || "Invalid API key"}\n`));
      return;
    }

    console.log(chalk.green("  ✓ API key validated!"));

    saveApiKey(provider, key.trim());
    apiKey = key.trim();
    console.log(chalk.gray(`  Saved to ~/.portscope/.env\n`));
  }

  state.config.ai.provider = provider;
  state.config.ai.model = defaults.model;
  state.apiKey = apiKey;
  resetConfig();
  persistProviderChoice(provider, defaults.model, provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);

  console.log(
    chalk.green(`  ✓ Switched to ${chalk.bold(defaults.label)}`) +
    (defaults.model ? chalk.gray(` (${defaults.model})`) : ""),
  );

  if (defaults.modelsUrl) {
    const browse = await question(rl, chalk.yellow("  Browse available models? [y/N] "));
    if (browse.toLowerCase() === "y") {
      await browseModels(state, rl);
      return;
    }
  }
  console.log();
}


/**
 * Interactive model browser.
 */
async function browseModels(state, rl) {
  const provider = state.config.ai.provider;
  const apiKey = state.apiKey || getApiKeyForProvider(provider);

  if (!apiKey) {
    console.log(chalk.yellow("\n  No API key configured. Use /provider first.\n"));
    return;
  }

  process.stdout.write(chalk.gray("\n  Fetching models..."));
  const { models, error } = await fetchAvailableModels(
    provider,
    apiKey,
    provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined
  );
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  if (error) {
    console.log(chalk.red(`  ✕ ${error}\n`));
    return;
  }

  if (models.length === 0) {
    console.log(chalk.yellow("  No models available.\n"));
    return;
  }


  const pageSize = 20; // Show paginated list (max 20 at a time)
  const totalPages = Math.ceil(models.length / pageSize);

  console.log(chalk.cyan.bold(`\n  Available Models (${models.length})`));
  console.log(chalk.gray("  ─────────────────────────────────"));

  const displayPage = (page) => {
    const start = page * pageSize;
    const end = Math.min(start + pageSize, models.length);
    for (let i = start; i < end; i++) {
      const m = models[i];
      const isCurrent = m.id === state.config.ai.model;
      const marker = isCurrent ? chalk.cyan(" ◀") : "";
      console.log(`  ${chalk.dim(String(i + 1).padStart(3))}  ${chalk.white(m.id)}${marker}`);
    }
    if (totalPages > 1) {
      console.log(chalk.dim(`\n  Page ${page + 1}/${totalPages}`));
    }
  };

  displayPage(0);
  console.log();

  const input = await question(rl, chalk.yellow("  Enter model number, name, or 'n' for next page: "));
  const trimmed = input.trim();

  if (!trimmed) {
    console.log();
    return;
  }

  if (trimmed.toLowerCase() === "n" && totalPages > 1) {
    for (let p = 1; p < totalPages; p++) {
      displayPage(p);
    }
    console.log();
    const pick = await question(rl, chalk.yellow("  Enter model number or name: "));
    return selectModel(pick.trim(), models, state);
  }

  return selectModel(trimmed, models, state);
}

function selectModel(input, models, state) {
  if (!input) return;

  const num = parseInt(input, 10);
  if (!isNaN(num) && num >= 1 && num <= models.length) {
    state.config.ai.model = models[num - 1].id;
    console.log(chalk.green(`  ✓ Model set to ${chalk.bold(state.config.ai.model)}\n`));
    return;
  }

  const match = models.find(
    (m) => m.id === input || m.id.includes(input) || m.name.toLowerCase().includes(input.toLowerCase()),
  );
  if (match) {
    state.config.ai.model = match.id;
    console.log(chalk.green(`  ✓ Model set to ${chalk.bold(state.config.ai.model)}\n`));
  } else {
    state.config.ai.model = input;
    console.log(chalk.yellow(`  Model set to "${input}" (not in list — may still work)\n`));
  }
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

/**
 * Process one round of conversation — may involve multiple tool-calling iterations.
 * Accepts an optional readline interface to pass through for destructive tool confirmations.
 *
 * @param {object} config
 * @param {string} apiKey
 * @param {Array} messages
 * @param {import("readline").Interface} [rl] — REPL readline to reuse for y/N prompts
 */
export async function processConversation(config, apiKey, messages, rl) {
  process.stdout.write(chalk.gray("\n  ⏳ Thinking..."));

  let response = await sendMessage(
    config,
    apiKey,
    messages,
    TOOLS,
    SYSTEM_PROMPT,
  );

  process.stdout.write("\r" + " ".repeat(40) + "\r");

  // Tool calling loop — AI can make multiple rounds of tool calls
  while (response.toolCalls && response.toolCalls.length > 0) {
    if (response.text) {
      const rendered = renderMarkdown(response.text);
      console.log(`\n  ${rendered}`);
    }

    messages.push({
      role: "assistant",
      text: response.text,
      toolCalls: response.toolCalls,
    });

    const toolResults = [];
    for (const tc of response.toolCalls) {
      console.log(chalk.dim(`  ⚡ ${tc.name}...`));
      const result = await executeTool(tc.name, tc.input, rl);
      toolResults.push({ id: tc.id, result });
    }

    messages.push({ role: "user", toolResults });

    process.stdout.write(chalk.gray("  ⏳ Thinking..."));
    response = await sendMessage(
      config,
      apiKey,
      messages,
      TOOLS,
      SYSTEM_PROMPT,
    );
    process.stdout.write("\r" + " ".repeat(40) + "\r");
  }

  if (response.text) {
    const rendered = renderMarkdown(response.text);
    console.log(`\n  ${rendered}\n`);
  }

  messages.push({ role: "assistant", text: response.text, toolCalls: [] });
}
