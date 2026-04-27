import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { DEFAULT_CONFIG, PROVIDER_DEFAULTS } from "./schema.js";

let _config = null;

/** Directory for persistent PortScope config (~/.portscope/) */
const PORTSCOPE_HOME = join(homedir(), ".portscope");

/**
 * Load configuration from portscope.config.json and environment variables.
 * Search order: ./portscope.config.json → ~/.portscope.config.json → defaults.
 * Also loads .env from cwd and ~/.portscope/.env
 */
export async function loadConfig() {
  if (_config) return _config;

  loadDotenv(join(process.cwd(), ".env"));
  loadDotenv(join(PORTSCOPE_HOME, ".env"));

  const config = structuredClone(DEFAULT_CONFIG);

  const configPaths = [
    join(process.cwd(), "portscope.config.json"),
    join(homedir(), ".portscope.config.json"),
  ];

  for (const p of configPaths) {
    if (existsSync(p)) {
      try {
        const fileConfig = JSON.parse(readFileSync(p, "utf8"));
        deepMerge(config, fileConfig);
      } catch { }
      break;
    }
  }

  // Load persisted provider/model
  const persistedPath = join(PORTSCOPE_HOME, "config.json");
  if (existsSync(persistedPath)) {
    try {
      const persisted = JSON.parse(readFileSync(persistedPath, "utf8"));
      if (persisted.provider) config.ai.provider = persisted.provider;
      if (persisted.model) config.ai.model = persisted.model;
      if (persisted.ollamaEndpoint) config.ai.ollamaEndpoint = persisted.ollamaEndpoint;
    } catch { }
  }

  if (process.env.PORTSCOPE_AI_PROVIDER) {
    config.ai.provider = process.env.PORTSCOPE_AI_PROVIDER;
  }

  const providerDefaults = PROVIDER_DEFAULTS[config.ai.provider];
  if (!config.ai.model && providerDefaults) {
    config.ai.model = providerDefaults.model;
  }

  _config = config;
  return config;
}


// Reset cached config — call after provider switch
export function resetConfig() {
  _config = null;
}

/**
 * Get the API key for the configured provider.
 * If the configured provider has no key, scans all providers for any available key
 * and switches the config to that provider automatically.
 */
export function getApiKey(config) {
  if (config.ai.provider === "ollama") return "local";

  const providerDefaults = PROVIDER_DEFAULTS[config.ai.provider];
  if (providerDefaults && providerDefaults.envKey) {
    const key = process.env[providerDefaults.envKey];
    if (key) return key;
  }
  // Fallback: scan all providers for any available key
  for (const [id, defaults] of Object.entries(PROVIDER_DEFAULTS)) {
    if (!defaults.envKey) continue;
    const key = process.env[defaults.envKey];
    if (key) {
      // Auto-switch to this provider
      config.ai.provider = id;
      config.ai.model = defaults.model;
      return key;
    }
  }
  return null;
}


// Get the API key for a specific provider (may differ from configured one)
export function getApiKeyForProvider(provider) {
  if (provider === "ollama") return "local";
  const providerDefaults = PROVIDER_DEFAULTS[provider];
  if (!providerDefaults || !providerDefaults.envKey) return null;
  return process.env[providerDefaults.envKey] || null;
}


/**
 * Save an API key to ~/.portscope/.env for persistent storage.
 * Only writes the key for the given provider & preserves other keys.
 */
export function saveApiKey(provider, key) {
  const providerDefaults = PROVIDER_DEFAULTS[provider];
  if (!providerDefaults || !providerDefaults.envKey) return;

  const envKey = providerDefaults.envKey;

  // Ensure ~/.portscope/ exists
  if (!existsSync(PORTSCOPE_HOME)) {
    mkdirSync(PORTSCOPE_HOME, { recursive: true, mode: 0o700 });
  }

  const envPath = join(PORTSCOPE_HOME, ".env");
  let lines = [];

  // Read existing
  if (existsSync(envPath)) {
    try {
      lines = readFileSync(envPath, "utf8").split("\n");
    } catch { }
  }

  // Remove old entry for this key
  lines = lines.filter((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return true;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) return true;
    return trimmed.slice(0, eqIdx).trim() !== envKey;
  });

  lines.push(`${envKey}=${key}`);
  writeFileSync(envPath, lines.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
  try { chmodSync(envPath, 0o600); } catch { }
  process.env[envKey] = key;
  persistProviderChoice(provider, PROVIDER_DEFAULTS[provider].model);
}

/**
 * Persist the provider and model choice to ~/.portscope/config.json.
 * Called automatically when saving keys and when switching providers.
 */
export function persistProviderChoice(provider, model, ollamaEndpoint) {
  if (!existsSync(PORTSCOPE_HOME)) {
    mkdirSync(PORTSCOPE_HOME, { recursive: true, mode: 0o700 });
  }
  const configPath = join(PORTSCOPE_HOME, "config.json");
  let existing = {};
  if (existsSync(configPath)) {
    try {
      existing = JSON.parse(readFileSync(configPath, "utf8"));
    } catch { }
  }
  existing.provider = provider;
  if (model) existing.model = model;
  if (ollamaEndpoint !== undefined) existing.ollamaEndpoint = ollamaEndpoint;
  writeFileSync(configPath, JSON.stringify(existing, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  try { chmodSync(configPath, 0o600); } catch { }
}


// NOTE: This is a minimal .env file parser — avoids adding dotenv as a dependency.
// Only sets variables that aren't already in process.env.
function loadDotenv(envPath) {
  if (!existsSync(envPath)) return;
  try {
    const content = readFileSync(envPath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eqIdx = trimmed.indexOf("=");
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let value = trimmed.slice(eqIdx + 1).trim();
      // NOTE: Strip inline comments (only when value is not quoted)
      if (!value.startsWith('"') && !value.startsWith("'")) {
        const hashIdx = value.indexOf(" #");
        if (hashIdx !== -1) value = value.slice(0, hashIdx).trim();
      }
      // Strip surrounding quotes
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch { }
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    // Guard against prototype pollution
    if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key])
    ) {
      if (!target[key]) target[key] = {};
      deepMerge(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
}
