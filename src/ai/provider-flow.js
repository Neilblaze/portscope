import chalk from "chalk";
import { PROVIDER_DEFAULTS, PROVIDER_IDS, DEFAULT_CONFIG } from "../config/schema.js";
import { getApiKeyForProvider, saveApiKey, resetConfig, persistProviderChoice, revokeApiKey } from "../config/loader.js";
import { fetchAvailableModels, validateApiKey, probeCustomEndpoint } from "../config/models.js";
import { maskApiKey } from "../config/mask.js";
import { sanitizeError } from "../config/sanitize-error.js";
import { resetUsage } from "./usage.js";
import { generateConversationId } from "./history.js";
import {
  CUSTOM_PREFIX,
  isCustomProvider,
  endpointIdOf,
  normalizeBaseUrl,
  deriveModelsUrl,
  loadCustomEndpoints,
  upsertCustomEndpoint,
  removeCustomEndpoint,
  uniqueEndpointId,
  registerCustomEndpoints,
} from "../config/custom-endpoints.js";


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
  console.log(chalk.gray("  ─────────────────────────────────●"));
  console.log(`  ${chalk.gray("Provider")}    ${chalk.white.bold(provider?.label || state.config.ai.provider)}`);
  console.log(`  ${chalk.gray("Model")}       ${chalk.white.bold(state.config.ai.model || "endpoint default")}`);
  if (provider?.isCustom) {
    console.log(`  ${chalk.gray("Endpoint")}    ${chalk.white(provider.baseUrl)}`);
    console.log(
      `  ${chalk.gray("Mode")}        ${chalk.white(provider.streaming ? "streaming" : "non-streaming")}` +
      chalk.dim(`  ·  tools: ${provider.supportsTools === false ? "off" : "on"}`),
    );
  }
  if (state.apiKey && state.apiKey !== "local") {
    const keyLabel = provider?.isCustom ? "Token  " : "API Key";
    console.log(`  ${chalk.gray(keyLabel)}     ${chalk.green("✔")} ${chalk.dim(maskApiKey(state.apiKey))}`);
  } else if (state.apiKey === "local") {
    console.log(`  ${chalk.gray("API Key")}     ${chalk.green(provider?.isCustom ? "✔ no auth" : "✔ local")}`);
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
    console.log(chalk.dim("    Your current conversation will be lost unless you export it first."));
    console.log();
    const confirm = await question(rl, chalk.yellow("  Continue? [y/N] "));
    if (confirm.trim().toLowerCase() !== "y") {
      console.log(chalk.gray("  Cancelled!\n"));
      return;
    }
  }

  registerCustomEndpoints();

  console.log();
  console.log(chalk.cyan.bold("  Select a Provider"));
  console.log(chalk.gray("  ─────────────────────────────────●"));

  let printedCustomHeader = false;
  for (let i = 0; i < PROVIDER_IDS.length; i++) {
    const id = PROVIDER_IDS[i];
    const defaults = PROVIDER_DEFAULTS[id];
    const isCurrent = id === state.config.ai.provider;
    const marker = isCurrent ? chalk.cyan(" ◀ current") : "";

    if (isCustomProvider(id) && !printedCustomHeader) {
      printedCustomHeader = true;
      console.log();
      console.log(chalk.dim("  ── Custom endpoints ──"));
    }

    let keyStatus;
    if (!defaults.envKey) {
      keyStatus = chalk.dim(id === "ollama" ? " (local)" : " (no auth)");
    } else {
      const hasKey = getApiKeyForProvider(id) && getApiKeyForProvider(id) !== "local";
      keyStatus = hasKey ? chalk.green(" ✔") : chalk.dim(" ○");
    }

    const hint = isCustomProvider(id) ? chalk.dim(`  (${shortUrl(defaults.baseUrl)})`) : "";
    console.log(`  ${chalk.white.bold(i + 1)}  ${chalk.white(defaults.label)}${keyStatus}${marker}${hint}`);
  }

  const addIdx = PROVIDER_IDS.length + 1;
  console.log(`  ${chalk.white.bold(addIdx)}  ${chalk.magenta("+ Add a custom endpoint")} ${chalk.dim("(OpenAI-compatible)")}`);
  console.log(`  ${chalk.dim("0")}  ${chalk.dim("Exit")}`);
  console.log();

  const answer = await question(rl, chalk.yellow(`  Pick a provider (0-${addIdx}): `));
  const idx = parseInt(answer, 10);
  if (isNaN(idx) || idx < 1 || idx > addIdx) {
    if (idx !== 0) console.log(chalk.gray("  Cancelled.\n"));
    else console.log();
    return;
  }

  if (idx === addIdx) {
    const newProvider = await addCustomEndpointFlow(state, rl);
    if (newProvider) await activateProvider(state, rl, newProvider, messages);
    return;
  }

  const provider = PROVIDER_IDS[idx - 1];
  const defaults = PROVIDER_DEFAULTS[provider];
  let apiKey = getApiKeyForProvider(provider);

  if (isCustomProvider(provider)) {
    console.log();
    console.log(`  ${chalk.gray("Endpoint")}  ${chalk.white(defaults.baseUrl)}`);
    console.log(
      `  ${chalk.gray("Mode")}      ${chalk.white(defaults.streaming ? "streaming" : "non-streaming")}` +
      chalk.dim(`  ·  tools: ${defaults.supportsTools === false ? "off" : "on"}`),
    );

    if (defaults.envKey && (!apiKey || apiKey === "local")) {
      console.log();
      const token = await question(rl, chalk.yellow(`  Paste the bearer token for ${defaults.label} (blank to skip): `));
      if (token.trim()) {
        process.stdout.write(chalk.gray("  Verifying..."));
        const probe = await probeCustomEndpoint({
          baseUrl: defaults.baseUrl,
          modelsUrl: defaults.modelsUrl,
          token: token.trim(),
          model: defaults.model,
          headers: defaults.extraHeaders,
        });
        process.stdout.write("\r" + " ".repeat(40) + "\r");
        if (!probe.valid) {
          console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(`${probe.error}\n`)}`);
          return;
        }
        saveApiKey(provider, token.trim());
        apiKey = token.trim();
        console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green("Token saved to ~/.portscope/.env")}`);
      } else {
        console.log(chalk.gray("  Continuing without a token."));
        apiKey = "local";
      }
    } else if (apiKey && apiKey !== "local") {
      console.log(`  ${chalk.gray("Token")}     ${chalk.green("✔")} ${chalk.dim(maskApiKey(apiKey))}`);
    }
    console.log();

    await activateProvider(state, rl, provider, messages, { skipBrowsePrompt: !defaults.modelsUrl });
    return;
  }

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
        console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(`Ollama at ${endpoint} returned ${res.status}`)}`);
        return;
      }
    } catch (err) {
      process.stdout.write("\r" + " ".repeat(60) + "\r");
      if (err.cause?.code === "ECONNREFUSED" || err.name === "TimeoutError") {
        console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(`Cannot connect to Ollama at ${endpoint}`)}`);
      } else {
        console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(sanitizeError(err))}`);
      }
      console.log(chalk.gray("  Make sure Ollama is running: ollama serve\n"));
      return;
    }

    console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Ollama is running at ${endpoint}`)}`);
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
      console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(`${error || "Invalid API key"}\n`)}`);
      return;
    }

    console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green("API key validated!")}`);
    console.log(chalk.dim(`      Key: ${maskApiKey(key.trim())}`));

    saveApiKey(provider, key.trim());
    apiKey = key.trim();
    console.log(chalk.gray(`      Saved to ~/.portscope/.env\n`));
  } else {
    console.log();
    console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`API key already configured for ${chalk.bold(defaults.label)}`)}`);
    console.log(chalk.dim(`      Key: ${maskApiKey(apiKey)}`));
    console.log();
  }

  await activateProvider(state, rl, provider, messages);
}


async function activateProvider(state, rl, provider, messages = [], opts = {}) {
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) return;

  state.config.ai.provider = provider;
  state.config.ai.model = defaults.model;
  state.apiKey = getApiKeyForProvider(provider);
  resetConfig();
  persistProviderChoice(provider, defaults.model, provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);

  if (messages.length > 0) {
    messages.length = 0;
    resetUsage();
    state.conversationId = generateConversationId();
    console.log(`  ${chalk.gray("🗑️")} ${chalk.dim("Conversation history cleared.")}`);
    console.log();
  }

  console.log(
    `  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Switched to ${chalk.bold(defaults.label)}`)}` +
    (defaults.model ? chalk.gray(` (${defaults.model})`) : chalk.dim(" (endpoint default model)")),
  );

  if (defaults.modelsUrl && !opts.skipBrowsePrompt) {
    console.log();
    const browse = await question(rl, chalk.yellow("  Browse available models? [y/N] "));
    if (browse.toLowerCase() === "y") {
      await browseModels(state, rl);
      return;
    }
  }
  console.log();
}


function shortUrl(url) {
  try {
    const u = new URL(url);
    return u.host + (u.pathname === "/" ? "" : u.pathname);
  } catch {
    return url;
  }
}


/**
 * Interactive setup for a user-defined OpenAI-compatible endpoint.
 * @returns {Promise<string|null>} the provider id (`custom:<slug>`), or null if cancelled
 */
export async function addCustomEndpointFlow(state, rl, existing = null) {
  console.log();
  console.log(chalk.cyan.bold(existing ? "  Edit Custom Endpoint" : "  Add a Custom Endpoint"));
  console.log(chalk.gray("  ─────────────────────────────────●"));
  console.log(chalk.dim("  Any OpenAI-compatible /v1/chat/completions server works."));
  console.log(chalk.dim("  Example: https://ai.example.com/v1/chat/completions"));
  console.log();

  const urlPrompt = existing
    ? chalk.yellow(`  Endpoint URL [${existing.baseUrl}]: `)
    : chalk.yellow("  Endpoint URL: ");
  const urlInput = (await question(rl, urlPrompt)).trim();
  const baseUrl = normalizeBaseUrl(urlInput || existing?.baseUrl);
  if (!baseUrl) {
    console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red("That doesn't look like a valid URL.\n")}`);
    return null;
  }
  if (baseUrl !== (urlInput || existing?.baseUrl)) {
    console.log(chalk.dim(`      → ${baseUrl}`));
  }

  const defaultLabel = existing?.label || new URL(baseUrl).host;
  const labelInput = (await question(rl, chalk.yellow(`  Display name [${defaultLabel}]: `))).trim();
  const label = labelInput || defaultLabel;

  const tokenInput = (await question(
    rl,
    chalk.yellow(`  Authorization bearer token ${chalk.dim("(blank = no auth)")}: `),
  )).trim();
  const token = tokenInput || null;

  const modelHint = existing?.model ? ` [${existing.model}]` : chalk.dim(" (blank = let the endpoint decide)");
  const modelInput = (await question(rl, chalk.yellow(`  Model${modelHint}: `))).trim();
  const model = modelInput || existing?.model || null;

  const streamAnswer = (await question(
    rl,
    chalk.yellow(`  Does it support streaming (SSE)? [y/N] `),
  )).trim().toLowerCase();
  const streaming = streamAnswer === "y" || streamAnswer === "yes";

  const modelsUrl = deriveModelsUrl(baseUrl);

  process.stdout.write(chalk.gray("  Testing endpoint..."));
  const probe = await probeCustomEndpoint({ baseUrl, modelsUrl, token, model });
  process.stdout.write("\r" + " ".repeat(40) + "\r");

  if (!probe.valid) {
    console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(probe.error || "Endpoint check failed")}`);
    console.log();
    const save = (await question(rl, chalk.yellow("  Save it anyway? [y/N] "))).trim().toLowerCase();
    if (save !== "y") {
      console.log(chalk.gray("  Cancelled.\n"));
      return null;
    }
  } else {
    console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green("Endpoint responded successfully")}`);
    if (token) console.log(chalk.dim(`      Token: ${maskApiKey(token)}`));
    if (probe.model && !model) console.log(chalk.dim(`      Model: ${probe.model}`));
  }

  const id = existing?.id || uniqueEndpointId(label);
  const endpoint = {
    id,
    label,
    baseUrl,
    modelsUrl,
    model: model || probe.model || null,
    auth: !!token || (existing?.auth === true && !tokenInput),
    streaming,
    tools: existing?.tools !== false,
    headers: existing?.headers || {},
  };

  const providerId = upsertCustomEndpoint(endpoint);

  if (token) {
    saveApiKey(providerId, token);
  }

  console.log(
    `  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Saved ${chalk.bold(label)}`)} ` +
    chalk.dim(`(${streaming ? "streaming" : "non-streaming"})`),
  );
  console.log(chalk.gray(`      Config: ~/.portscope/endpoints.json`));
  console.log();

  return providerId;
}


export async function manageEndpoints(state, rl, args = [], messages = []) {
  const sub = (args[0] || "").toLowerCase();
  registerCustomEndpoints();

  if (sub === "add" || sub === "new") {
    const providerId = await addCustomEndpointFlow(state, rl);
    if (providerId) {
      const use = (await question(rl, chalk.yellow("  Switch to it now? [Y/n] "))).trim().toLowerCase();
      if (use !== "n") await activateProvider(state, rl, providerId, messages, { skipBrowsePrompt: true });
      else persistProviderChoice(state.config.ai.provider, state.config.ai.model);
    }
    return;
  }

  const endpoints = loadCustomEndpoints();

  if (endpoints.length === 0) {
    console.log();
    console.log(chalk.yellow("  No custom endpoints configured yet."));
    console.log(chalk.dim("  Run /endpoint add — or pick “+ Add a custom endpoint” in /provider.\n"));
    if (sub === "remove" || sub === "rm" || sub === "edit") return;
    const add = (await question(rl, chalk.yellow("  Add one now? [Y/n] "))).trim().toLowerCase();
    if (add === "n") return;
    const providerId = await addCustomEndpointFlow(state, rl);
    if (providerId) await activateProvider(state, rl, providerId, messages, { skipBrowsePrompt: true });
    return;
  }

  console.log();
  console.log(chalk.cyan.bold(`  Custom Endpoints (${endpoints.length})`));
  console.log(chalk.gray("  ─────────────────────────────────●"));
  for (let i = 0; i < endpoints.length; i++) {
    const ep = endpoints[i];
    const providerId = CUSTOM_PREFIX + ep.id;
    const isCurrent = providerId === state.config.ai.provider;
    const key = getApiKeyForProvider(providerId);
    const auth = ep.auth === false || !key || key === "local"
      ? chalk.dim("no auth")
      : chalk.green(`bearer ${maskApiKey(key)}`);
    console.log(
      `  ${chalk.white.bold(i + 1)}  ${chalk.white(ep.label)}${isCurrent ? chalk.cyan(" ◀ current") : ""}`,
    );
    console.log(`     ${chalk.dim(ep.baseUrl)}`);
    console.log(
      `     ${chalk.dim(`model: ${ep.model || "endpoint default"} · ${ep.streaming ? "streaming" : "non-streaming"} · tools: ${ep.tools === false ? "off" : "on"} · `)}${auth}`,
    );
  }
  console.log();

  if (sub === "list" || sub === "ls") return;

  const action = (await question(
    rl,
    chalk.yellow("  [a]dd, [e]dit <n>, [r]emove <n>, [u]se <n>, or Enter to exit: "),
  )).trim().toLowerCase();

  if (!action) {
    console.log();
    return;
  }

  const [verb, numArg] = action.split(/\s+/);
  const n = parseInt(numArg, 10);
  const target = !isNaN(n) && n >= 1 && n <= endpoints.length ? endpoints[n - 1] : null;

  if (verb === "a" || verb === "add") {
    const providerId = await addCustomEndpointFlow(state, rl);
    if (providerId) await activateProvider(state, rl, providerId, messages, { skipBrowsePrompt: true });
    return;
  }

  if (!target) {
    console.log(chalk.red(`\n  Pick a number between 1 and ${endpoints.length}. e.g. "r 1"\n`));
    return;
  }

  if (verb === "e" || verb === "edit") {
    const providerId = await addCustomEndpointFlow(state, rl, target);
    if (providerId && providerId === state.config.ai.provider) {
      await activateProvider(state, rl, providerId, messages, { skipBrowsePrompt: true });
    }
    return;
  }

  if (verb === "u" || verb === "use") {
    await activateProvider(state, rl, CUSTOM_PREFIX + target.id, messages, { skipBrowsePrompt: true });
    return;
  }

  if (verb === "r" || verb === "rm" || verb === "remove" || verb === "delete") {
    const confirm = (await question(
      rl,
      chalk.yellow(`  Remove ${chalk.bold(target.label)}? [y/N] `),
    )).trim().toLowerCase();
    if (confirm !== "y") {
      console.log(chalk.gray("  Cancelled.\n"));
      return;
    }
    const providerId = CUSTOM_PREFIX + target.id;
    revokeApiKey(providerId);
    removeCustomEndpoint(target.id);
    console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Removed ${target.label}\n`)}`);

    if (state.config.ai.provider === providerId) {
      state.config.ai.provider = DEFAULT_CONFIG.ai.provider;
      state.config.ai.model = PROVIDER_DEFAULTS[DEFAULT_CONFIG.ai.provider].model;
      state.apiKey = getApiKeyForProvider(state.config.ai.provider);
      persistProviderChoice(state.config.ai.provider, state.config.ai.model);
      resetConfig();
      console.log(chalk.yellow("  That was your active provider — pick a new one.\n"));
      await switchProvider(state, rl, []);
    }
    return;
  }

  console.log(chalk.gray("  Cancelled.\n"));
}

export async function revokeApiKeyFlow(state, rl, providerArg) {
  const configuredProviders = [];
  for (const id of PROVIDER_IDS) {
    // Providers with no envKey hold no credential to revoke.
    if (!PROVIDER_DEFAULTS[id]?.envKey) continue;
    const key = getApiKeyForProvider(id);
    if (key && key !== "local") {
      configuredProviders.push(id);
    }
  }

  if (providerArg) {
    const targetProvider = providerArg.toLowerCase();

    if (!PROVIDER_IDS.includes(targetProvider)) {
      console.log(chalk.red(`\n  Unknown provider: "${targetProvider}"\n`));
      return;
    }

    if (!configuredProviders.includes(targetProvider)) {
      console.log(chalk.yellow(`\n  No API key found for ${PROVIDER_DEFAULTS[targetProvider].label}.\n`));
      return;
    }

    const defaults = PROVIDER_DEFAULTS[targetProvider];
    revokeApiKey(targetProvider);
    console.log(`\n  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Revoked API key for ${defaults.label}\n`)}`);

    if (state.config.ai.provider === targetProvider) {
      state.apiKey = null;
      console.log(chalk.yellow(`  The API key for your current provider (${defaults.label}) has been revoked.`));
      console.log(chalk.yellow(`  Please configure a new provider to continue using natural language.\n`));
      await switchProvider(state, rl, []);
    }
    return;
  }

  if (configuredProviders.length === 0) {
    console.log(chalk.yellow("\n  No API keys found.\n"));
    return;
  }

  console.log();
  console.log(chalk.cyan.bold("  Revoke an API Key"));
  console.log(chalk.gray("  ─────────────────────────────────●"));

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
  console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Revoked API key for ${defaults.label}\n`)}`);

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
    console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(`${error}\n`)}`);
    return;
  }

  if (models.length === 0) {
    console.log(chalk.yellow("  No models available.\n"));
    return;
  }

  const pageSize = 20;
  const totalPages = Math.ceil(models.length / pageSize);

  console.log(chalk.cyan.bold(`\n  Available Models (${models.length})`));
  console.log(chalk.gray("  ─────────────────────────────────●"));

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

  const isCancel = (val) => {
    const l = val.toLowerCase();
    return !l || l === "exit" || l === "quit" || l === "cancel" || l === "0";
  };

  const matchModel = (input) => {
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= models.length) {
      return models[num - 1];
    }
    return models.find(
      (m) => m.id === input || m.id.includes(input) || m.name.toLowerCase().includes(input.toLowerCase()),
    );
  };

  let attempts = 0;
  let showingFirstPage = true;

  while (attempts < 3) {
    const promptText = (showingFirstPage && totalPages > 1)
      ? "  Enter model number, name, or 'n' for next page: "
      : "  Enter model number or name, or press '0' to cancel: ";

    const input = await question(rl, chalk.yellow(promptText));
    const trimmed = input.trim();

    if (isCancel(trimmed)) {
      console.log(`\n  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red("Cancelled!")}\n`);
      return;
    }

    if (showingFirstPage && trimmed.toLowerCase() === "n" && totalPages > 1) {
      console.log();
      for (let p = 1; p < totalPages; p++) {
        displayPage(p);
      }
      console.log();
      showingFirstPage = false;
      continue;
    }

    const match = matchModel(trimmed);
    if (match) {
      state.config.ai.model = match.id;
      persistProviderChoice(state.config.ai.provider, state.config.ai.model, state.config.ai.provider === "ollama" ? state.config.ai.ollamaEndpoint : undefined);
      console.log(`  ${chalk.bgGreen.black.bold(" ✔ ")} ${chalk.green(`Model set to ${chalk.bold(state.config.ai.model)}\n`)}`);
      return;
    }

    attempts++;
    if (attempts >= 3) {
      console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red("Too many invalid attempts. Cancelled.\n")}`);
      return;
    }
    console.log(`  ${chalk.bgRed.white.bold(" ✕ ")} ${chalk.red(`Model "${trimmed}" not found. Please pick from the list.`)}\n`);
  }
}

function question(rl, prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}
