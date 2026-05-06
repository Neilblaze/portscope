import { PROVIDER_DEFAULTS } from "./schema.js";
import { sanitizeError } from "./sanitize-error.js";

// NOTE: Needs to be updated when new models are released
// Or, maybe I should automate this? 🤔 ... nvm, will do later
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
    { id: "gpt-oss-120b", name: "GPT-OSS 120B" },
    { id: "qwen3-235b-a22b-2507", name: "Qwen 3 235B" },
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


/**
 * Fetch available models for a provider.
 * For OpenRouter & NVIDIA NIM: hits their /models endpoint.
 * For Anthropic & OpenAI: returns a curated list.
 * Returns: { models: [{ id, name }], error: string|null }
 */
export async function fetchAvailableModels(provider, apiKey, ollamaEndpoint) {
  if (CURATED_MODELS[provider]) {
    return { models: CURATED_MODELS[provider], error: null };
  }

  // Ollama uses /api/tags with a different response shape
  if (provider === "ollama") {
    return fetchOllamaModels(ollamaEndpoint);
  }

  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults || !defaults.modelsUrl) {
    return { models: [], error: `No model listing available for ${provider}` };
  }

  if (!apiKey) {
    return { models: [], error: `API key required to list ${defaults.label} models` };
  }

  try {
    const headers = { Authorization: `Bearer ${apiKey}` };
    if (provider === "openrouter") {
      headers["HTTP-Referer"] = "https://github.com/neilblaze/portscope";
      headers["X-Title"] = "PortScope";
    }

    const res = await fetch(defaults.modelsUrl, { headers, signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      if (res.status === 401 || res.status === 403) {
        return { models: [], error: `Invalid API key for ${defaults.label}` };
      }
      return { models: [], error: `${defaults.label} API error (${res.status}): ${errText.slice(0, 200)}` };
    }

    const data = await res.json();
    const models = (data.data || [])
      .filter((m) => m.id)
      .map((m) => ({
        id: m.id,
        name: m.name || m.id,
      }))
      .sort((a, b) => a.id.localeCompare(b.id));

    if (models.length === 0) {
      return { models: [], error: `No models returned by ${defaults.label}` };
    }

    return { models, error: null };
  } catch (err) {
    if (err.name === "TimeoutError") {
      return { models: [], error: `Timed out connecting to ${defaults.label}` };
    }
    return { models: [], error: `Failed to fetch models: ${sanitizeError(err)}` };
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
