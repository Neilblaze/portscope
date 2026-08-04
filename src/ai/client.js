import { PROVIDER_DEFAULTS } from "../config/schema.js";
import { stripNulls } from "./context.js";
import { ensureModelDiscovered } from "../config/models.js";
import { setEndpointCapability } from "../config/custom-endpoints.js";

// Auth is optional
function openAIHeaders(provider, apiKey, defaults) {
  const headers = { "Content-Type": "application/json" };

  if (apiKey && apiKey !== "local") {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  if (provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/neilblaze/portscope";
    headers["X-Title"] = "PortScope";
  }

  if (defaults?.extraHeaders) {
    for (const [k, v] of Object.entries(defaults.extraHeaders)) {
      if (typeof v === "string") headers[k] = v;
    }
  }

  return headers;
}


function looksLikeToolsUnsupported(status, message) {
  if (status !== 400 && status !== 422) return false;
  const m = String(message || "").toLowerCase();
  return (
    (m.includes("tool") || m.includes("function")) &&
    (m.includes("not supported") || m.includes("unsupported") || m.includes("unknown") ||
      m.includes("unexpected") || m.includes("invalid") || m.includes("not allowed") ||
      m.includes("does not support"))
  );
}

function getSignal(options, timeoutMs) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    const err = new Error("TimeoutError");
    err.name = "TimeoutError";
    controller.abort(err);
  }, timeoutMs);

  if (options && options.signal) {
    if (options.signal.aborted) {
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener("abort", () => {
        controller.abort(options.signal.reason);
      }, { once: true });
    }
  }

  return { signal: controller.signal, cancel: () => clearTimeout(timeoutId) };
}


export async function sendMessage(config, apiKey, messages, tools, systemPrompt, options = {}) {
  await ensureModelDiscovered(config.ai.provider, apiKey, config.ai.model, config.ai.ollamaEndpoint).catch(() => { });

  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const provider = config.ai.provider;
      switch (provider) {
        case "anthropic":
          return await sendAnthropic(config, apiKey, messages, tools, systemPrompt, options);
        case "gemini":
          return await sendGemini(config, apiKey, messages, tools, systemPrompt, options);
        case "ollama":
          return await sendOllama(config, messages, systemPrompt, options);
        default: {
          // OpenAI, OpenRouter, NVIDIA, Cerebras, Groq and custom endpoints
          // all share the same wire format.
          const defaults = PROVIDER_DEFAULTS[provider];
          if (!defaults) throw new Error(`Unknown AI provider: ${provider}`);
          return await sendOpenAI(config, apiKey, messages, tools, systemPrompt, defaults.baseUrl, options);
        }
      }
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      if (err.name === "AbortError") throw err;
      if (err.message.includes("401") || err.message.includes("403") || err.message.toLowerCase().includes("key")) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}



// ── Anthropic ──────────────────────────────────────────────────────────── ///

async function sendAnthropic(config, apiKey, messages, tools, systemPrompt, options = {}) {
  const body = {
    model: config.ai.model,
    max_tokens: config.ai.maxTokens,
    system: systemPrompt,
    messages: toAnthropicMessages(messages),
  };
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const { signal, cancel } = getSignal(options, 30000);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error("Anthropic API timed out after 30s. Check your connection and try again.");
    }
    throw err;
  } finally {
    cancel();
  }

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 401 || err.includes("x-api-key")) {
      throw new Error("Invalid Anthropic API key. Check your ANTHROPIC_API_KEY and if you want, use /revoke to clear it and restart.");
    }
    throw new Error(`Anthropic API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return parseAnthropicResponse(data);
}

function toAnthropicMessages(messages) {
  const result = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.toolResults) {
        result.push({
          role: "user",
          content: msg.toolResults.map((tr) => ({
            type: "tool_result",
            tool_use_id: tr.id,
            content: JSON.stringify(stripNulls(tr.result)),
          })),
        });
      } else {
        result.push({ role: "user", content: msg.content });
      }
    } else if (msg.role === "assistant") {
      const content = [];
      if (msg.text) content.push({ type: "text", text: msg.text });
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.name,
            input: tc.input,
          });
        }
      }
      result.push({ role: "assistant", content });
    }
  }
  return result;
}

function parseAnthropicResponse(data) {
  const result = { text: "", toolCalls: [], usage: null };
  for (const block of data.content) {
    if (block.type === "text") result.text += block.text;
    if (block.type === "tool_use") {
      result.toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input,
      });
    }
  }
  result.stopReason =
    data.stop_reason === "tool_use" ? "tool_calls" : "stop";
  if (data.usage) {
    result.usage = {
      inputTokens: data.usage.input_tokens || 0,
      outputTokens: data.usage.output_tokens || 0,
    };
  }
  return result;
}




// ── OpenAI / OpenRouter / NVIDIA NIM / Cerebras / Groq ──────────────────── ///

async function sendOpenAI(config, apiKey, messages, tools, systemPrompt, baseUrl, options = {}) {
  const provider = config.ai.provider;
  const defaults = PROVIDER_DEFAULTS[provider] || {};
  const isCustom = defaults.isCustom === true;
  const label = defaults.label || provider;

  // OpenAI newer models require max_completion_tokens; all others use max_tokens
  const tokenKey = provider === "openai" ? "max_completion_tokens" : "max_tokens";
  const body = {
    [tokenKey]: config.ai.maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...toOpenAIMessages(messages),
    ],
  };

  if (config.ai.model) body.model = config.ai.model;

  const sendTools = tools && tools.length > 0 && (!isCustom || defaults.supportsTools !== false);
  if (sendTools) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const headers = openAIHeaders(provider, apiKey, defaults);

  const { signal, cancel } = getSignal(options, isCustom ? 60000 : 30000);
  let res;
  try {
    res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      const secs = isCustom ? 60 : 30;
      throw new Error(
        `${label} timed out after ${secs}s. ` +
        (config.ai.model
          ? `The model "${config.ai.model}" may be slow — try again, or switch models with /models.`
          : `Try again, or check the endpoint URL with /endpoint.`),
      );
    }
    if (isCustom && (err.cause?.code === "ECONNREFUSED" || err.cause?.code === "ENOTFOUND")) {
      throw new Error(`Cannot reach ${label} at ${baseUrl}. Check the URL with /endpoint.`);
    }
    throw err;
  } finally {
    cancel();
  }

  if (!res.ok) {
    let err = await res.text();
    // Strip HTML tags (NVIDIA NIM returns raw HTML on 502)
    err = err.replace(/<[^>]*>/g, "").trim();

    let parsedErr = err;
    try {
      const j = JSON.parse(err);
      if (j.error && j.error.message) parsedErr = j.error.message;
      else if (typeof j.error === "string") parsedErr = j.error;
      else if (j.message) parsedErr = j.message;
    } catch { }

    if (!parsedErr) parsedErr = `HTTP ${res.status}`;

    if (isCustom && sendTools && looksLikeToolsUnsupported(res.status, parsedErr)) {
      setEndpointCapability(provider, { tools: false });
      if (PROVIDER_DEFAULTS[provider]) PROVIDER_DEFAULTS[provider].supportsTools = false;
      return await sendOpenAI(config, apiKey, messages, [], systemPrompt, baseUrl, options);
    }

    if (res.status === 502 || res.status === 503) {
      throw new Error(
        `${label} is temporarily unavailable (${res.status}). ` +
        `Try again in a moment${config.ai.model ? `, or switch models with /models` : ""}.`,
      );
    }

    if (res.status === 404 && parsedErr.toLowerCase().includes("does not exist")) {
      throw new Error(`The model "${config.ai.model}" does not exist or your API key doesn't have access to it. Use /models to pick a valid model.`);
    }

    if (res.status === 404 && isCustom) {
      throw new Error(`${label} returned 404 for ${baseUrl}. The endpoint URL looks wrong — fix it with /endpoint.`);
    }

    if (res.status === 401 || res.status === 403 || parsedErr.toLowerCase().includes("invalid_api_key") || parsedErr.toLowerCase().includes("incorrect api key")) {
      if (isCustom) {
        throw new Error(
          apiKey && apiKey !== "local"
            ? `${label} rejected the bearer token (${res.status}). Use /revoke to clear it, then /provider to re-enter.`
            : `${label} requires authorization (${res.status}). Add a bearer token with /endpoint.`,
        );
      }
      throw new Error(`Invalid ${provider} API key. Check your ${provider}_API_KEY and if you want, use /revoke to clear it and restart.`);
    }
    throw new Error(`${label} API error (${res.status}): ${parsedErr}`);
  }

  const raw = await res.text();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(
      `${label} returned a 200 that isn't JSON. The endpoint may not be OpenAI-compatible: ` +
      raw.replace(/<[^>]*>/g, " ").trim().slice(0, 200),
    );
  }
  return parseOpenAIResponse(data, label);
}

function toOpenAIMessages(messages) {
  const result = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.toolResults) {
        for (const tr of msg.toolResults) {
          result.push({
            role: "tool",
            tool_call_id: tr.id,
            content: JSON.stringify(stripNulls(tr.result)),
          });
        }
      } else {
        result.push({ role: "user", content: msg.content });
      }
    } else if (msg.role === "assistant") {
      const m = { role: "assistant", content: msg.text || null };
      if (msg.toolCalls && msg.toolCalls.length > 0) {
        m.tool_calls = msg.toolCalls.map((tc) => ({
          id: tc.id,
          type: "function",
          function: {
            name: tc.name,
            arguments: JSON.stringify(tc.input),
          },
        }));
      }
      result.push(m);
    }
  }
  return result;
}

function parseOpenAIResponse(data, label = "provider") {
  const choice = data?.choices?.[0];
  if (!choice) {
    throw new Error(
      `${label} returned an unexpected response shape (no "choices"). ` +
      `The endpoint may not be OpenAI-compatible: ${JSON.stringify(data).slice(0, 200)}`,
    );
  }
  const msg = choice.message || {};
  const result = { text: typeof msg.content === "string" ? msg.content : "", toolCalls: [], usage: null };
  if (Array.isArray(msg.tool_calls)) {
    for (const tc of msg.tool_calls) {
      if (!tc?.function?.name) continue;
      let input = {};
      try {
        input = JSON.parse(tc.function.arguments || "{}");
      } catch { /* endpoint emitted malformed args — call the tool with none */ }
      result.toolCalls.push({ id: tc.id, name: tc.function.name, input });
    }
  }
  result.stopReason =
    choice.finish_reason === "tool_calls" || result.toolCalls.length > 0 ? "tool_calls" : "stop";
  if (data.usage) {
    result.usage = {
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0,
    };
  }
  return result;
}



// ── Ollama (Local) ─────────────────────────────────────────────────────── ///

async function sendOllama(config, messages, systemPrompt, options = {}) {
  const endpoint = config.ai.ollamaEndpoint || "http://localhost:11434";
  const chatUrl = `${endpoint}/api/chat`;

  const ollamaMessages = [
    { role: "system", content: systemPrompt },
    ...messages
      .filter((m) => !m.toolResults)
      .map((m) => ({
        role: m.role,
        content: m.content || m.text || "",
      })),
  ];

  const body = {
    model: config.ai.model,
    messages: ollamaMessages,
    stream: false,
  };

  const { signal, cancel } = getSignal(options, 60000);
  let res;
  try {
    res = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error(
        `Ollama timed out after 60s. The model "${config.ai.model}" may be loading — try again in a moment.`,
      );
    }
    if (err.cause?.code === "ECONNREFUSED") {
      throw new Error(
        `Cannot connect to Ollama at ${endpoint}. Is it running? Start with: ollama serve`,
      );
    }
    throw err;
  } finally {
    cancel();
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return {
    text: data.message?.content || "",
    toolCalls: [],
    stopReason: "stop",
    usage: {
      inputTokens: data.prompt_eval_count || 0,
      outputTokens: data.eval_count || 0,
    },
  };
}



// ── Google Gemini ──────────────────────────────────────────────────────── ///

async function sendGemini(config, apiKey, messages, tools, systemPrompt, options = {}) {
  const model = config.ai.model;
  const baseUrl = PROVIDER_DEFAULTS.gemini.baseUrl;
  const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

  const body = {
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiMessages(messages),
    tools: tools.length > 0 ? [{
      function_declarations: tools.map((t) => ({
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      })),
    }] : undefined,
    generationConfig: {
      maxOutputTokens: config.ai.maxTokens,
    },
  };

  const { signal, cancel } = getSignal(options, 30000);
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error(
        `Gemini API timed out after 30s. The model "${model}" may be slow — try again.`,
      );
    }
    throw err;
  } finally {
    cancel();
  }

  if (!res.ok) {
    const err = await res.text();
    if (res.status === 400 && err.includes("API_KEY_INVALID")) {
      throw new Error("Invalid Gemini API key. Check your GEMINI_API_KEY and if you want, use /revoke to clear it and restart.");
    }
    throw new Error(`Gemini API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return parseGeminiResponse(data);
}

function toGeminiMessages(messages) {
  const result = [];
  for (const msg of messages) {
    if (msg.role === "user") {
      if (msg.toolResults) {
        const parts = msg.toolResults.map((tr) => ({
          functionResponse: {
            name: tr.name || "tool",
            response: tr.result,
          },
        }));
        result.push({ role: "user", parts });
      } else if (Array.isArray(msg.content)) {
        const parts = msg.content.map((c) => {
          if (c.type === "text") return { text: c.text };
          if (c.type === "image" && c.source) {
            return {
              inline_data: {
                mime_type: c.source.media_type,
                data: c.source.data,
              },
            };
          }
          if (c.type === "image_url" && c.image_url?.url) {
            const match = c.image_url.url.match(/^data:([^;]+);base64,(.+)$/);
            if (match) {
              return { inline_data: { mime_type: match[1], data: match[2] } };
            }
          }
          return { text: JSON.stringify(c) };
        });
        result.push({ role: "user", parts });
      } else {
        result.push({ role: "user", parts: [{ text: msg.content }] });
      }
    } else if (msg.role === "assistant") {
      const parts = [];
      if (msg.text) parts.push({ text: msg.text });
      if (msg.toolCalls) {
        for (const tc of msg.toolCalls) {
          parts.push({
            functionCall: {
              name: tc.name,
              args: tc.input,
            },
          });
        }
      }
      if (parts.length > 0) {
        result.push({ role: "model", parts });
      }
    }
  }
  return result;
}

function parseGeminiResponse(data) {
  const result = { text: "", toolCalls: [], usage: null };

  const candidate = data.candidates?.[0];
  if (!candidate || !candidate.content) return result;

  for (const part of candidate.content.parts || []) {
    if (part.text) result.text += part.text;
    if (part.functionCall) {
      result.toolCalls.push({
        id: `gemini_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        name: part.functionCall.name,
        input: part.functionCall.args || {},
      });
    }
  }

  const hasToolCalls = result.toolCalls.length > 0;
  result.stopReason = hasToolCalls ? "tool_calls" :
    (candidate.finishReason === "STOP" ? "stop" : "stop");

  if (data.usageMetadata) {
    result.usage = {
      inputTokens: data.usageMetadata.promptTokenCount || 0,
      outputTokens: data.usageMetadata.candidatesTokenCount || 0,
    };
  }

  return result;
}


// NEW UPDATE: 22/05/26 (TODO: Needs some auditing)
// ── Streaming Support ──────────────────────────────────────────────────── ///

/**
 * Parse an SSE (Server-Sent Events) stream from a fetch Response.
 * Yields parsed JSON objects from `data:` lines.
 */
async function* parseSSEStream(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(":")) continue;
        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          if (data === "[DONE]") return;
          try {
            yield JSON.parse(data);
          } catch { /* skip malformed chunks */ }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}


async function streamAnthropic(config, apiKey, messages, tools, systemPrompt, onChunk, options = {}) {
  const body = {
    model: config.ai.model,
    max_tokens: config.ai.maxTokens,
    stream: true,
    system: systemPrompt,
    messages: toAnthropicMessages(messages),
  };
  if (tools && tools.length > 0) {
    body.tools = tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    }));
  }

  const { signal, cancel } = getSignal(options, 60000);
  let res;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    cancel();
    throw err;
  }

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic streaming error (${res.status}): ${err}`);
  }

  const result = { text: "", toolCalls: [], usage: null, stopReason: "stop" };
  let currentToolId = null;
  let currentToolName = null;
  let currentToolInput = "";

  for await (const event of parseSSEStream(res)) {
    switch (event.type) {
      case "content_block_delta":
        if (event.delta?.type === "text_delta") {
          result.text += event.delta.text;
          onChunk(event.delta.text);
        } else if (event.delta?.type === "input_json_delta") {
          currentToolInput += event.delta.partial_json || "";
        }
        break;
      case "content_block_start":
        if (event.content_block?.type === "tool_use") {
          currentToolId = event.content_block.id;
          currentToolName = event.content_block.name;
          currentToolInput = "";
        }
        break;
      case "content_block_stop":
        if (currentToolName) {
          try {
            result.toolCalls.push({
              id: currentToolId,
              name: currentToolName,
              input: JSON.parse(currentToolInput || "{}"),
            });
          } catch {
            result.toolCalls.push({
              id: currentToolId,
              name: currentToolName,
              input: {},
            });
          }
          currentToolName = null;
          currentToolInput = "";
        }
        break;
      case "message_delta":
        if (event.delta?.stop_reason === "tool_use") {
          result.stopReason = "tool_calls";
        }
        if (event.usage) {
          result.usage = result.usage || { inputTokens: 0, outputTokens: 0 };
          result.usage.outputTokens = event.usage.output_tokens || 0;
        }
        break;
      case "message_start":
        if (event.message?.usage) {
          result.usage = {
            inputTokens: event.message.usage.input_tokens || 0,
            outputTokens: 0,
          };
        }
        break;
    }
  }

  return result;
}


async function streamOpenAI(config, apiKey, messages, tools, systemPrompt, baseUrl, onChunk, options = {}) {
  const provider = config.ai.provider;
  const defaults = PROVIDER_DEFAULTS[provider] || {};
  const isCustom = defaults.isCustom === true;
  const label = defaults.label || provider;

  const tokenKey = provider === "openai" ? "max_completion_tokens" : "max_tokens";
  const body = {
    [tokenKey]: config.ai.maxTokens,
    stream: true,
    stream_options: { include_usage: true },
    messages: [
      { role: "system", content: systemPrompt },
      ...toOpenAIMessages(messages),
    ],
  };
  if (config.ai.model) body.model = config.ai.model;

  const sendTools = tools && tools.length > 0 && (!isCustom || defaults.supportsTools !== false);
  if (sendTools) {
    body.tools = tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    }));
  }

  const headers = openAIHeaders(provider, apiKey, defaults);

  const { signal, cancel } = getSignal(options, 60000);
  let res;
  try {
    res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    cancel();
    throw err;
  }

  if (!res.ok) {
    const err = await res.text();
    let parsedErr = err;
    try {
      const j = JSON.parse(err);
      if (j.error && j.error.message) parsedErr = j.error.message;
      else if (typeof j.error === "string") parsedErr = j.error;
      else if (j.message) parsedErr = j.message;
    } catch { }

    if (isCustom) {
      cancel();
      if (sendTools && looksLikeToolsUnsupported(res.status, parsedErr)) {
        setEndpointCapability(provider, { tools: false });
        if (PROVIDER_DEFAULTS[provider]) PROVIDER_DEFAULTS[provider].supportsTools = false;
      } else if (res.status === 400 || res.status === 422 || res.status === 501) {
        setEndpointCapability(provider, { streaming: false });
        if (PROVIDER_DEFAULTS[provider]) PROVIDER_DEFAULTS[provider].streaming = false;
      }
      return await sendMessage(config, apiKey, messages, tools, systemPrompt, options);
    }

    if (res.status === 404 && parsedErr.toLowerCase().includes("does not exist")) {
      throw new Error(`The model "${config.ai.model}" does not exist or your API key doesn't have access to it. Use /models to pick a valid model.`);
    }
    if (res.status === 401 || parsedErr.toLowerCase().includes("invalid_api_key") || parsedErr.toLowerCase().includes("incorrect api key")) {
      throw new Error(`Invalid ${provider} API key. Check your ${provider}_API_KEY and if you want, use /revoke to clear it and restart.`);
    }

    throw new Error(`${label} streaming error (${res.status}): ${parsedErr}`);
  }

  const result = { text: "", toolCalls: [], usage: null, stopReason: "stop" };
  const toolCallAccumulators = new Map();

  for await (const data of parseSSEStream(res)) {
    const choice = data.choices?.[0];
    if (choice) {
      if (choice.delta?.content) {
        result.text += choice.delta.content;
        onChunk(choice.delta.content);
      }

      if (choice.delta?.tool_calls) {
        for (const tc of choice.delta.tool_calls) {
          if (tc.id) {
            toolCallAccumulators.set(tc.index, {
              id: tc.id,
              name: tc.function?.name || "",
              args: "",
            });
          }
          const acc = toolCallAccumulators.get(tc.index);
          if (acc && tc.function?.arguments) {
            acc.args += tc.function.arguments;
            if (tc.function.name) acc.name = tc.function.name;
          }
        }
      }

      if (choice.finish_reason === "tool_calls") {
        result.stopReason = "tool_calls";
      }
    }

    if (data.usage) {
      result.usage = {
        inputTokens: data.usage.prompt_tokens || 0,
        outputTokens: data.usage.completion_tokens || 0,
      };
    }
  }

  for (const [, acc] of toolCallAccumulators) {
    try {
      result.toolCalls.push({
        id: acc.id,
        name: acc.name,
        input: JSON.parse(acc.args || "{}"),
      });
    } catch {
      result.toolCalls.push({ id: acc.id, name: acc.name, input: {} });
    }
  }

  cancel();
  return result;
}


/**
 * Send a message using streaming where supported.
 * Falls back to non-streaming sendMessage on unsupported providers or errors.
 *
 * @param {object} config
 * @param {string} apiKey
 * @param {Array} messages
 * @param {Array} tools
 * @param {string} systemPrompt
 * @param {function} onChunk - Called with each text delta: onChunk(textDelta)
 * @returns {Promise<{text: string, toolCalls: Array, usage: object, stopReason: string}>}
 */
export async function sendMessageStream(config, apiKey, messages, tools, systemPrompt, onChunk, options = {}) {
  const provider = config.ai.provider;

  await ensureModelDiscovered(config.ai.provider, apiKey, config.ai.model, config.ai.ollamaEndpoint).catch(() => { });

  try {
    switch (provider) {
      case "anthropic":
        return await streamAnthropic(config, apiKey, messages, tools, systemPrompt, onChunk, options);
      case "openai":
      case "openrouter":
      case "nvidia":
      case "cerebras":
      case "groq":
        return await streamOpenAI(config, apiKey, messages, tools, systemPrompt, PROVIDER_DEFAULTS[provider].baseUrl, onChunk, options);
      default: {
        const defaults = PROVIDER_DEFAULTS[provider];
        if (defaults?.isCustom && defaults.streaming === true) {
          return await streamOpenAI(config, apiKey, messages, tools, systemPrompt, defaults.baseUrl, onChunk, options);
        }
        // Gemini, Ollama, non-streaming custom endpoints
        return await sendMessage(config, apiKey, messages, tools, systemPrompt, options);
      }
    }
  } catch (err) {
    if (err.name === "AbortError") throw err;
    if (err.message.includes("API error") || err.message.includes("does not exist") || err.message.includes("Invalid ") || err.message.includes("temporarily unavailable") || err.message.includes("streaming error")) {
      throw err;
    }
    return await sendMessage(config, apiKey, messages, tools, systemPrompt, options);
  }
}
