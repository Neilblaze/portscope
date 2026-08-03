import { PROVIDER_DEFAULTS } from "./schema.js";
import { sanitizeError } from "./sanitize-error.js";
import { createHash } from "crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";


const CURATED_MODELS = {
  anthropic: [
    { id: "claude-haiku-4-5-20251001", name: "Claude Haiku 4.5" },
    { id: "claude-sonnet-4-6", name: "Claude Sonnet 4.6" },
    { id: "claude-opus-4-6", name: "Claude Opus 4.6" },
  ],
  openai: [
    { id: "gpt-5.5", name: "GPT-5.5" },
    { id: "gpt-5.4", name: "GPT-5.4" },
    { id: "gpt-5.4-mini", name: "GPT-5.4 Mini" },
    { id: "gpt-5.4-nano", name: "GPT-5.4 Nano" },
    { id: "gpt-5-nano", name: "GPT-5 Nano" },
    { id: "gpt-4.1-nano", name: "GPT-4.1 Nano" },
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4o", name: "GPT-4o" },
  ],
  cerebras: [
    { id: "llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B" },
    { id: "llama-3.3-70b", name: "Llama 3.3 70B" },
    { id: "llama3.1-8b", name: "Llama 3.1 8B" },
  ],
  groq: [
    { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B Versatile" },
    { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B Instant" },
    { id: "gemma2-9b-it", name: "Gemma 2 9B IT" },
    { id: "mixtral-8x7b-32768", name: "Mixtral 8x7B" },
  ],
  gemini: [
    { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash" },
    { id: "gemini-2.5-flash-lite", name: "Gemini 2.5 Flash Lite" },
    { id: "gemini-2.5-pro", name: "Gemini 2.5 Pro" },
    { id: "gemini-2.0-flash", name: "Gemini 2.0 Flash" },
  ],
  openrouter: [
    { id: "openai/gpt-oss-120b", name: "GPT-OSS 120B (OpenAI)" },
    { id: "openai/gpt-oss-20b", name: "GPT-OSS 20B (OpenAI)" },
    { id: "meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B (Meta)" },
    { id: "meta-llama/llama-4-scout", name: "Llama 4 Scout (Meta)" },
    { id: "meta-llama/llama-4-maverick", name: "Llama 4 Maverick (Meta)" },
    { id: "qwen/qwen3-32b", name: "Qwen 3 32B" },
    { id: "moonshotai/kimi-k2-instruct", name: "Kimi K2 Instruct (Moonshot)" },
    { id: "deepseek/deepseek-r1", name: "DeepSeek R1" },
    { id: "deepseek/deepseek-chat", name: "DeepSeek Chat" },
    { id: "mistralai/mistral-large-2407", name: "Mistral Large (2407)" },
    { id: "mistralai/mistral-small-2603", name: "Mistral Small (2603)" },
    { id: "mistralai/devstral-2", name: "Devstral 2" },
  ],
};


const curatedNames = {};
for (const list of Object.values(CURATED_MODELS)) {
  for (const m of list) curatedNames[m.id] = m.name;
}

const PORTSCOPE_HOME = join(homedir(), ".portscope");
const CACHE_FILE = join(PORTSCOPE_HOME, "models-cache.json");
const CACHE_TTL = 12 * 60 * 60 * 1000; // 12 hours


function getCacheKey(provider, apiKey) {
  if (!apiKey || apiKey === "local") return `${provider}:local`;
  const hash = createHash("sha256").update(apiKey).digest("hex").slice(0, 16);
  return `${provider}:${hash}`;
}

function loadCache() {
  if (existsSync(CACHE_FILE)) {
    try {
      return JSON.parse(readFileSync(CACHE_FILE, "utf8"));
    } catch { }
  }
  return {};
}

function saveCache(cache) {
  if (!existsSync(PORTSCOPE_HOME)) {
    mkdirSync(PORTSCOPE_HOME, { recursive: true, mode: 0o700 });
  }
  writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2), { encoding: "utf8", mode: 0o600 });
}

import { getSyncedPricing } from "../data/pricing-sync.js";

function getModelsFromPricingJson(provider) {
  try {
    const PRICING = getSyncedPricing();
    if (!PRICING || Object.keys(PRICING).length === 0) return [];

    const prefix = `${provider}/`;
    const models = [];
    const seen = new Set();

    for (const [key, info] of Object.entries(PRICING)) {
      if (!info || typeof info !== "object") continue;

      const isOfficialProvider = info.litellm_provider === provider || key.startsWith(prefix);

      if (isOfficialProvider) {
        let id = key.startsWith(prefix) ? key.slice(prefix.length) : key;

        if (provider === "openai") {
          const validPrefix = /^(gpt-|o1|o3|o4|chatgpt-)/.test(id);
          if (!validPrefix) continue;
        }

        if (!seen.has(id)) {
          seen.add(id);
          models.push({ id, name: id });
        }
      }
    }
    return models.sort((a, b) => a.id.localeCompare(b.id));
  } catch (err) { }
  return [];
}


function isChatModel(provider, id) {
  const lower = id.toLowerCase();

  const ignored = [
    "embedding", "tts", "whisper", "sora", "dalle", "dall-e", "audio", "realtime",
    "moderation", "babbage", "davinci", "curie", "ada-",
    "transcribe", "diarize", "search", "image", "codex", "chat-latest"
  ];
  if (ignored.some(p => lower.includes(p))) return false;

  if (provider === "openai" && lower.includes("instruct")) return false;

  return true;
}

function cleanModelList(provider, models) {
  let cleaned = models.filter(m => isChatModel(provider, m.id));

  if (provider === "openai" || provider === "openrouter") {
    if (provider === "openai") {
      cleaned = cleaned.filter(m => /^(gpt-|o1|o3|o4|chatgpt-)/.test(m.id) && !m.id.includes("oss"));
    }

    const idSet = new Set(cleaned.map((m) => m.id));
    cleaned = cleaned.filter((m) => {
      const isDated = /-\d{4}-\d{2}-\d{2}$/.test(m.id) || /-\d{4}$/.test(m.id);
      if (isDated) {
        const base = m.id.replace(/-\d{4}-\d{2}-\d{2}$/, "").replace(/-\d{4}$/, "");
        if (idSet.has(base)) return false;
      }
      return true;
    });
  }
  return cleaned;
}

/**
 * Ensures the given model is in the cache for the given provider/key.
 * If not found, immediately triggers a background fetch to update the cache.
 */
export async function ensureModelDiscovered(provider, apiKey, model, ollamaEndpoint) {
  if (!model || provider === "ollama") return;
  if (PROVIDER_DEFAULTS[provider]?.isCustom) return;

  const cacheKey = getCacheKey(provider, apiKey);
  const cache = loadCache();

  const entry = cache[cacheKey];
  if (entry && entry.models) {
    const found = entry.models.find(m => m.id === model || m.id.includes(model));
    if (found) return;
  }

  await fetchAvailableModels(provider, apiKey, ollamaEndpoint, true);
}

/**
 * Fetch available models for a provider.
 * Uses a local cache with a 12-hour TTL.
 * Returns: { models: [{ id, name }], error: string|null }
 */
export async function fetchAvailableModels(provider, apiKey, ollamaEndpoint, forceRefresh = false) {
  if (provider === "ollama") {
    return fetchOllamaModels(ollamaEndpoint);
  }

  const cacheKey = getCacheKey(provider, apiKey);
  const cache = loadCache();
  const now = Date.now();

  if (!forceRefresh && cache[cacheKey] && (now - cache[cacheKey].updatedAt) < CACHE_TTL) {
    const cleanedModels = cleanModelList(provider, cache[cacheKey].models);
    return { models: cleanedModels, error: null };
  }

  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) {
    return { models: [], error: `No model listing available for ${provider}` };
  }

  if (defaults.isCustom) {
    return fetchCustomModels(provider, defaults, apiKey);
  }

  if (!apiKey) {
    return { models: [], error: `API key required to list ${defaults.label} models` };
  }

  try {
    let models = [];

    if (!defaults.modelsUrl) {
      models = getModelsFromPricingJson(provider);
      if (models.length === 0) {
        return { models: [], error: `No models found for ${provider} in local database.` };
      }
    } else {
      let finalUrl = defaults.modelsUrl;
      const headers = {};

      if (provider === "gemini") {
        finalUrl = `${defaults.modelsUrl}?key=${apiKey}`;
      } else {
        headers.Authorization = `Bearer ${apiKey}`;
        if (provider === "openrouter") {
          headers["HTTP-Referer"] = "https://github.com/neilblaze/portscope";
          headers["X-Title"] = "PortScope";
        }
      }

      const res = await fetch(finalUrl, { headers, signal: AbortSignal.timeout(15000) });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        if (res.status === 401 || res.status === 403 || res.status === 400) {
          return { models: [], error: `Invalid API key for ${defaults.label}` };
        }

        // NOTE: Fallback to local db (if API fails)
        models = getModelsFromPricingJson(provider);
        if (models.length > 0) {
          return { models, error: null };
        }
        return { models: [], error: `${defaults.label} API error (${res.status}): ${errText.slice(0, 200)}` };
      }

      const data = await res.json();
      const rawModels = data.data || data.models || [];

      models = rawModels
        .map((m) => {
          let id = m.id || m.name;
          if (provider === "gemini" && id && id.startsWith("models/")) {
            id = id.replace("models/", "");
          }
          return {
            id,
            name: curatedNames[id] || m.name || id,
          };
        })
        .filter((m) => m.id && isChatModel(provider, m.id))
        .sort((a, b) => a.id.localeCompare(b.id));

      models = cleanModelList(provider, models);

      if (CURATED_MODELS[provider]) {
        const fetchedIds = new Set(models.map(m => m.id));
        const missingCurated = CURATED_MODELS[provider].filter(m => !fetchedIds.has(m.id));
        models = [...missingCurated, ...models];
      }
    }

    if (models.length === 0) {
      return { models: [], error: `No models returned by ${defaults.label}` };
    }

    cache[cacheKey] = {
      updatedAt: now,
      models,
    };
    saveCache(cache);

    return { models, error: null };
  } catch (err) {
    if (err.name === "TimeoutError") {
      return { models: [], error: `Timed out connecting to ${defaults.label}` };
    }

    const fallbackModels = getModelsFromPricingJson(provider);
    if (fallbackModels.length > 0) {
      return { models: fallbackModels, error: null };
    }
    return { models: [], error: `Failed to fetch models: ${sanitizeError(err)}` };
  }
}



function customHeaders(defaults, apiKey) {
  const headers = { "Content-Type": "application/json" };
  if (apiKey && apiKey !== "local") headers.Authorization = `Bearer ${apiKey}`;
  for (const [k, v] of Object.entries(defaults.extraHeaders || {})) {
    if (typeof v === "string") headers[k] = v;
  }
  return headers;
}

/**
 * List models for a user-defined OpenAI-compatible endpoint. Many pin a single
 * model and expose no /models route — not an error, so the caller is told to
 * set the model by hand instead.
 */
async function fetchCustomModels(provider, defaults, apiKey) {
  if (!defaults.modelsUrl) {
    return {
      models: [],
      error: `${defaults.label} has no model listing URL. Set one directly with /model <name>, or leave it unset to let the endpoint choose.`,
    };
  }

  const cacheKey = getCacheKey(provider, apiKey);
  const cache = loadCache();
  const now = Date.now();
  if (cache[cacheKey] && (now - cache[cacheKey].updatedAt) < CACHE_TTL) {
    return { models: cache[cacheKey].models, error: null };
  }

  try {
    const res = await fetch(defaults.modelsUrl, {
      headers: customHeaders(defaults, apiKey),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        return { models: [], error: `${defaults.label} rejected the bearer token (${res.status})` };
      }
      return {
        models: [],
        error: `${defaults.label} has no usable /models route (${res.status}). Set the model with /model <name>.`,
      };
    }

    const data = await res.json();
    const rawModels = Array.isArray(data) ? data : (data.data || data.models || []);
    const models = rawModels
      .map((m) => {
        const id = typeof m === "string" ? m : (m.id || m.name || m.model);
        return id ? { id, name: (typeof m === "object" && m.name) || id } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0) {
      return { models: [], error: `${defaults.label} returned no models. Set the model with /model <name>.` };
    }

    cache[cacheKey] = { updatedAt: now, models };
    saveCache(cache);
    return { models, error: null };
  } catch (err) {
    if (err.name === "TimeoutError") {
      return { models: [], error: `Timed out connecting to ${defaults.label}` };
    }
    return { models: [], error: `Failed to list ${defaults.label} models: ${sanitizeError(err)}` };
  }
}


/**
 * Probe a custom endpoint: a cheap GET on /models when it has one, then a
 * 1-token completion, which is the only route guaranteed to exist.
 * @returns {Promise<{valid: boolean, error: string|null, model?: string|null}>}
 */
export async function probeCustomEndpoint({ baseUrl, modelsUrl, token, model, headers = {} }) {
  const reqHeaders = { "Content-Type": "application/json" };
  if (token) reqHeaders.Authorization = `Bearer ${token}`;
  for (const [k, v] of Object.entries(headers)) {
    if (typeof v === "string") reqHeaders[k] = v;
  }

  let discoveredModel = model || null;

  if (modelsUrl) {
    try {
      const res = await fetch(modelsUrl, { headers: reqHeaders, signal: AbortSignal.timeout(10000) });
      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: `Endpoint rejected the bearer token (${res.status})` };
      }
      if (res.ok && !discoveredModel) {
        const data = await res.json().catch(() => null);
        const list = Array.isArray(data) ? data : (data?.data || data?.models || []);
        const first = list?.[0];
        if (first) discoveredModel = typeof first === "string" ? first : (first.id || first.name || null);
      }
    } catch { /* fall through to the completion probe */ }
  }

  const body = { messages: [{ role: "user", content: "hi" }], max_tokens: 1 };
  if (discoveredModel) body.model = discoveredModel;

  try {
    const res = await fetch(baseUrl, {
      method: "POST",
      headers: reqHeaders,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });

    if (res.status === 401 || res.status === 403) {
      return {
        valid: false,
        error: token
          ? `Endpoint rejected the bearer token (${res.status})`
          : `Endpoint requires authorization (${res.status}) — add a bearer token`,
      };
    }
    if (res.status === 404) {
      return { valid: false, error: `404 Not Found at ${baseUrl} — check the URL` };
    }
    if (res.status >= 500) {
      return { valid: false, error: `Endpoint returned ${res.status}` };
    }

    if (res.ok) {
      const data = await res.json().catch(() => null);
      if (data && !data.choices) {
        return { valid: false, error: `Endpoint responded but is not OpenAI-compatible (no "choices" in the response)` };
      }
      if (data?.model && !discoveredModel) discoveredModel = data.model;
    }

    return { valid: true, error: null, model: discoveredModel };
  } catch (err) {
    if (err.name === "TimeoutError") return { valid: false, error: "Connection timed out" };
    if (err.cause?.code === "ECONNREFUSED") return { valid: false, error: `Connection refused at ${baseUrl}` };
    if (err.cause?.code === "ENOTFOUND") return { valid: false, error: `Host not found for ${baseUrl}` };
    return { valid: false, error: sanitizeError(err) };
  }
}


async function fetchOllamaModels(ollamaEndpoint) {
  const endpoint = ollamaEndpoint || "http://localhost:11434";
  const tagsUrl = `${endpoint}/api/tags`;
  try {
    const res = await fetch(tagsUrl, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { models: [], error: `Ollama returned ${res.status}` };
    }
    const data = await res.json();
    const models = (data.models || [])
      .map((m) => ({ id: m.name, name: m.name }))
      .sort((a, b) => a.id.localeCompare(b.id));
    if (models.length === 0) {
      return { models: [], error: "No models installed. Run: ollama pull llama3" };
    }
    return { models, error: null };
  } catch (err) {
    if (err.cause?.code === "ECONNREFUSED" || err.name === "TimeoutError") {
      return { models: [], error: `Cannot connect to Ollama at ${endpoint}. Is it running?` };
    }
    return { models: [], error: `Failed to list Ollama models: ${sanitizeError(err)}` };
  }
}


// NOTE: Validate an API key (works for a given provider)
export async function validateApiKey(provider, apiKey) {
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) return { valid: false, error: "Unknown provider" };

  if (defaults.isCustom) {
    return probeCustomEndpoint({
      baseUrl: defaults.baseUrl,
      modelsUrl: defaults.modelsUrl,
      token: apiKey && apiKey !== "local" ? apiKey : null,
      model: defaults.model,
      headers: defaults.extraHeaders,
    });
  }

  // Ollama: no key — just check if the server is reachable
  if (provider === "ollama") {
    const endpoint = apiKey || "http://localhost:11434";
    const tagsUrl = `${endpoint}/api/tags`;
    try {
      const res = await fetch(tagsUrl, {
        signal: AbortSignal.timeout(5000),
      });
      if (res.ok) return { valid: true, error: null };
      return { valid: false, error: `Ollama returned ${res.status}` };
    } catch {
      return { valid: false, error: `Cannot connect to Ollama at ${endpoint}` };
    }
  }

  try {
    if (provider === "anthropic") {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5",
          max_tokens: 1,
          messages: [{ role: "user", content: "hi" }],
        }),
        signal: AbortSignal.timeout(15000),
      });
      // NOTE: 200 or 400 (bad request but auth passed) means key is valid
      if (res.status === 401 || res.status === 403) {
        return { valid: false, error: "Invalid API key" };
      }
      return { valid: true, error: null };
    }

    if (provider === "gemini") {
      try {
        const url = `${defaults.baseUrl}/models?key=${apiKey}`;
        const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
        if (res.status === 400 || res.status === 403) {
          return { valid: false, error: "Invalid API key" };
        }
        return { valid: true, error: null };
      } catch (err) {
        if (err.name === "TimeoutError") {
          return { valid: false, error: "Connection timed out" };
        }
        return { valid: false, error: err.message };
      }
    }

    // OpenAI-compatible providers: hit /models endpoint
    const modelsUrl = defaults.modelsUrl || defaults.baseUrl.replace("/chat/completions", "/models");
    const headers = { Authorization: `Bearer ${apiKey}` };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/neilblaze/portscope";
    }
    const res = await fetch(modelsUrl, { headers, signal: AbortSignal.timeout(15000) });
    if (res.status === 401 || res.status === 403) {
      return { valid: false, error: "Invalid API key" };
    }
    return { valid: true, error: null };
  } catch (err) {
    if (err.name === "TimeoutError") {
      return { valid: false, error: "Connection timed out" };
    }
    return { valid: false, error: err.message };
  }
}
