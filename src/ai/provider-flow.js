import chalk from "chalk";
import { PROVIDER_DEFAULTS, PROVIDER_IDS } from "../config/schema.js";
import { getApiKeyForProvider, saveApiKey, resetConfig, persistProviderChoice, revokeApiKey } from "../config/loader.js";
import { fetchAvailableModels, validateApiKey } from "../config/models.js";
import { maskApiKey } from "../config/mask.js";
import { sanitizeError } from "../config/sanitize-error.js";
import { resetUsage } from "./usage.js";


export function printChatHeader(state) {
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

export function printStatus(state) {
  const provider = PROVIDER_DEFAULTS[state.config.ai.provider];
  console.log();
  console.log(chalk.cyan.bold("  Current Configuration"));
  console.log(chalk.gray("  ─────────────────────────────────"));
  console.log(`  ${chalk.gray("Provider")}    ${chalk.white.bold(provider?.label || state.config.ai.provider)}`);
  console.log(`  ${chalk.gray("Model")}       ${chalk.white.bold(state.config.ai.model || "not set")}`);
  if (state.apiKey && state.apiKey !== "local") {
    console.log(`  ${chalk.gray("API Key")}     ${chalk.green("✓")} ${chalk.dim(maskApiKey(state.apiKey))}`);
  } else if (state.apiKey === "local") {
    console.log(`  ${chalk.gray("API Key")}     ${chalk.green("✓ local")}`);
  } else {
    console.log(`  ${chalk.gray("API Key")}     ${chalk.red("✕ missing")}`);
  }
  console.log(`  ${chalk.gray("Max Tokens")}  ${chalk.white(state.config.ai.maxTokens)}`);
  console.log();
}


export async function switchProvider(state, rl, messages = []) {
  if (messages.length > 0) {
    console.log();
    console.log(chalk.yellow("  ⚠ Warning: Switching providers will reset conversation history"));
    console.log(chalk.dim("  Your current conversation will be lost unless you export it first."));
    console.log();
    const confirm = await question(rl, chalk.yellow("  Continue? [y/N] "));
    if (confirm.trim().toLowerCase() !== "y") {
      console.log(chalk.gray("  Cancelled!\n"));
      return;
    }
  }

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
        console.log(chalk.red(`  ✕ ${sanitizeError(err)}`));
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
    console.log(chalk.dim(`  Key: ${maskApiKey(key.trim())}`));

    saveApiKey(provider, key.trim());
    apiKey = key.trim();
    console.log(chalk.gray(`  Saved to ~/.portscope/.env\n`));
  } else {
    console.log();
    console.log(chalk.green(`  ✓ API key already configured for ${defaults.label}`));
    console.log(chalk.dim(`  Key: ${maskApiKey(apiKey)}`));
    console.log();
  }

  state.config.ai.provider = provider;
  state.config.ai.model = defaults.model;
  state.apiKey = apiKey;
  resetConfig();
  persistProviderChoice(provider, defaults.model, provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);

  if (messages.length > 0) {
    messages.length = 0;
    resetUsage();
    console.log(chalk.dim("  Conversation history cleared."));
  }

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

export async function revokeApiKeyFlow(state, rl) {
  const configuredProviders = [];
  for (const id of PROVIDER_IDS) {
    if (id === "ollama") continue;
    const key = getApiKeyForProvider(id);
    if (key) {
      configuredProviders.push(id);
    }
  }

  if (configuredProviders.length === 0) {
    console.log(chalk.yellow("\n  No API keys found.\n"));
    return;
  }

  console.log();
  console.log(chalk.cyan.bold("  Revoke an API Key"));
  console.log(chalk.gray("  ─────────────────────────────────"));

  for (let i = 0; i < configuredProviders.length; i++) {
    const id = configuredProviders[i];
    const defaults = PROVIDER_DEFAULTS[id];
    console.log(`  ${chalk.white.bold(i + 1)}  ${chalk.white(defaults.label)}`);
  }
  console.log(`  ${chalk.dim("0")}  ${chalk.dim("Cancel")}`);
  console.log();

  const answer = await question(rl, chalk.yellow(`  Pick a provider to revoke (0-${configuredProviders.length}): `));
  const idx = parseInt(answer, 10);
  if (isNaN(idx) || idx < 1 || idx > configuredProviders.length) {
    if (idx !== 0) console.log(chalk.gray("  Cancelled.\n"));
    else console.log();
    return;
  }

  const providerToRevoke = configuredProviders[idx - 1];
  const defaults = PROVIDER_DEFAULTS[providerToRevoke];

  const confirm = await question(rl, chalk.yellow(`  Are you sure you want to revoke the ${defaults.label} API key? [y/N] `));
  if (confirm.trim().toLowerCase() !== "y") {
    console.log(chalk.gray("  Cancelled.\n"));
    return;
  }

  revokeApiKey(providerToRevoke);
  console.log(chalk.green(`  ✓ Revoked API key for ${defaults.label}\n`));

  if (state.config.ai.provider === providerToRevoke) {
    state.apiKey = null;
    console.log(chalk.yellow(`  The API key for your current provider (${defaults.label}) has been revoked.`));
    console.log(chalk.yellow(`  Please configure a new provider to continue using natural language.\n`));
    await switchProvider(state, rl, []);
  }
}


export async function browseModels(state, rl) {
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

  const pageSize = 20;
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
    persistProviderChoice(state.config.ai.provider, state.config.ai.model, state.config.ai.provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);
    console.log(chalk.green(`  ✓ Model set to ${chalk.bold(state.config.ai.model)}\n`));
    return;
  }

  const match = models.find(
    (m) => m.id === input || m.id.includes(input) || m.name.toLowerCase().includes(input.toLowerCase()),
  );
  if (match) {
    state.config.ai.model = match.id;
    persistProviderChoice(state.config.ai.provider, state.config.ai.model, state.config.ai.provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);
    console.log(chalk.green(`  ✓ Model set to ${chalk.bold(state.config.ai.model)}\n`));
  } else {
    state.config.ai.model = input;
    persistProviderChoice(state.config.ai.provider, state.config.ai.model, state.config.ai.provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);
    console.log(chalk.yellow(`  Model set to "${input}" (not in list — may still work)\n`));
  }
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}
