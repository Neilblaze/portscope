import { PROVIDER_DEFAULTS } from "../config/schema.js";

export async function sendMessage(config, apiKey, messages, tools, systemPrompt) {
  let attempt = 0;
  const maxAttempts = 2;

  while (attempt < maxAttempts) {
    try {
      const provider = config.ai.provider;
      switch (provider) {
        case "anthropic":
          return await sendAnthropic(config, apiKey, messages, tools, systemPrompt);
        case "openai":
          return await sendOpenAI(config, apiKey, messages, tools, systemPrompt, PROVIDER_DEFAULTS.openai.baseUrl);
        case "openrouter":
          return await sendOpenAI(config, apiKey, messages, tools, systemPrompt, PROVIDER_DEFAULTS.openrouter.baseUrl);
        case "nvidia":
          return await sendOpenAI(config, apiKey, messages, tools, systemPrompt, PROVIDER_DEFAULTS.nvidia.baseUrl);
        case "ollama":
          return await sendOllama(config, messages, systemPrompt);
        default:
          throw new Error(`Unknown AI provider: ${provider}`);
      }
    } catch (err) {
      attempt++;
      if (attempt >= maxAttempts) throw err;
      // NOTE: Do not retry on authentication errors
      if (err.message.includes("401") || err.message.includes("403") || err.message.toLowerCase().includes("key")) {
        throw err;
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
}



// ── Anthropic ──────────────────────────────────────────────────────────── ///

async function sendAnthropic(config, apiKey, messages, tools, systemPrompt) {
  const body = {
    model: config.ai.model,
    max_tokens: config.ai.maxTokens,
    system: systemPrompt,
    messages: toAnthropicMessages(messages),
    tools: tools.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters,
    })),
  };

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
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error("Anthropic API timed out after 30s. Check your connection and try again.");
    }
    throw err;
  }

  if (!res.ok) {
    const err = await res.text();
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
            content: JSON.stringify(tr.result),
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




// ── OpenAI / OpenRouter / NVIDIA NIM ───────────────────────────────────────── ///

async function sendOpenAI(config, apiKey, messages, tools, systemPrompt, baseUrl) {
  // OpenAI newer models require max_completion_tokens; OpenRouter/NVIDIA use max_tokens
  const tokenKey = config.ai.provider === "openai" ? "max_completion_tokens" : "max_tokens";
  const body = {
    model: config.ai.model,
    [tokenKey]: config.ai.maxTokens,
    messages: [
      { role: "system", content: systemPrompt },
      ...toOpenAIMessages(messages),
    ],
    tools: tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        description: t.description,
        parameters: t.parameters,
      },
    })),
  };

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${apiKey}`,
  };

  if (config.ai.provider === "openrouter") {
    headers["HTTP-Referer"] = "https://github.com/neilblaze/portscope";
    headers["X-Title"] = "PortScope";
  }

  let res;
  try {
    res = await fetch(baseUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    if (err.name === "TimeoutError") {
      throw new Error(
        `${config.ai.provider} API timed out after 30s. ` +
        `The model "${config.ai.model}" may be slow — try again, or switch models with /models.`,
      );
    }
    throw err;
  }

  if (!res.ok) {
    let err = await res.text();
    // Strip HTML tags (NVIDIA NIM returns raw HTML on 502)
    err = err.replace(/<[^>]*>/g, "").trim();
    if (!err) err = `HTTP ${res.status}`;
    if (res.status === 502 || res.status === 503) {
      throw new Error(
        `${config.ai.provider} is temporarily unavailable (${res.status}). ` +
        `The model "${config.ai.model}" may be down — try again in a moment, or switch models with /models.`,
      );
    }
    throw new Error(`${config.ai.provider} API error (${res.status}): ${err}`);
  }

  const data = await res.json();
  return parseOpenAIResponse(data);
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
            content: JSON.stringify(tr.result),
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

function parseOpenAIResponse(data) {
  const choice = data.choices[0];
  const msg = choice.message;
  const result = { text: msg.content || "", toolCalls: [], usage: null };
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      result.toolCalls.push({
        id: tc.id,
        name: tc.function.name,
        input: JSON.parse(tc.function.arguments),
      });
    }
  }
  result.stopReason =
    choice.finish_reason === "tool_calls" ? "tool_calls" : "stop";
  if (data.usage) {
    result.usage = {
      inputTokens: data.usage.prompt_tokens || 0,
      outputTokens: data.usage.completion_tokens || 0,
    };
  }
  return result;
}



// ── Ollama (Local) ─────────────────────────────────────────────────────── ///

async function sendOllama(config, messages, systemPrompt) {
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

  let res;
  try {
    res = await fetch(chatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60000),
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

