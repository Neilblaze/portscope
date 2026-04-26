import { PROVIDER_DEFAULTS } from "./schema.js";

// NOTE: Needs to be updated when new models are released
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
    { id: "gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "gpt-4o", name: "GPT-4o" },
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
    return { models: [], error: `Failed to fetch models: ${err.message}` };
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
    return { models: [], error: `Failed to list Ollama models: ${err.message}` };
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
