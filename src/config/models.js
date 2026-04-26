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
export async function fetchAvailableModels(provider, apiKey) {
  if (CURATED_MODELS[provider]) {
    return { models: CURATED_MODELS[provider], error: null };
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


// NOTE: Validate an API key (works for a given provider)
export async function validateApiKey(provider, apiKey) {
  const defaults = PROVIDER_DEFAULTS[provider];
  if (!defaults) return { valid: false, error: "Unknown provider" };

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
