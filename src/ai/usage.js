import chalk from "chalk";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const METRICS_FILE = join(homedir(), ".portscope", "metrics.json");

let currentProvider = null;
let currentModel = null;

export let session = {
  inputTokens: 0,
  outputTokens: 0,
  apiCalls: 0,
  compactions: 0,
  startedAt: Date.now(),
};

let callHistory = [];

function syncMetrics(provider, model) {
  if (currentProvider === provider && currentModel === model) return;

  let needsReset = true;
  if (existsSync(METRICS_FILE)) {
    try {
      const data = JSON.parse(readFileSync(METRICS_FILE, "utf8"));
      if (data.provider === provider && data.model === model) {
        session.inputTokens = data.inputTokens || 0;
        session.outputTokens = data.outputTokens || 0;
        session.apiCalls = data.apiCalls || 0;
        session.compactions = data.compactions || 0;
        session.startedAt = data.startedAt || Date.now();
        callHistory = [];
        if (data.callHistory) callHistory.push(...data.callHistory);
        needsReset = false;
      }
    } catch { }
  }

  if (needsReset) {
    session.inputTokens = 0;
    session.outputTokens = 0;
    session.apiCalls = 0;
    session.compactions = 0;
    session.startedAt = Date.now();
    callHistory = [];
  }

  currentProvider = provider;
  currentModel = model;
}

function saveMetrics() {
  const dir = join(homedir(), ".portscope");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  const data = {
    provider: currentProvider,
    model: currentModel,
    inputTokens: session.inputTokens,
    outputTokens: session.outputTokens,
    apiCalls: session.apiCalls,
    compactions: session.compactions,
    startedAt: session.startedAt,
    callHistory
  };
  try {
    writeFileSync(METRICS_FILE, JSON.stringify(data), "utf8");
  } catch { }
}



// Approximate pricing per 1M tokens [input, output] in USD
// Falls back to these hardcoded values if the synced pricing file is unavailable.
const PRICING = {
  "claude-haiku-4-5": [1.00, 5.00],
  "claude-haiku-4-5-20251001": [1.00, 5.00],
  "claude-sonnet-4-6": [3.00, 15.00],
  "claude-opus-4-6": [5.00, 25.00],
  "gpt-5.4-nano": [0.20, 1.25],
  "gpt-5.4-mini": [0.75, 4.50],
  "gpt-5.4": [2.50, 15.00],
  "gpt-5.5": [5.00, 30.00],
  "gpt-5-nano": [0.05, 0.40],
  "gpt-4.1-nano": [0.10, 0.40],
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4o": [2.50, 10.00],
  "llama3.1-8b": [0.10, 0.10],
  "llama-3.3-70b": [0.85, 1.20],
  "llama-4-scout-17b-16e-instruct": [0.10, 0.10],
  "gpt-oss-120b": [0.35, 0.75],
  "qwen3-235b-a22b-2507": [0.60, 1.20],
  "llama-3.3-70b-versatile": [0.59, 0.79],
  "llama-3.1-8b-instant": [0.05, 0.08],
  "openai/gpt-oss-120b": [0.15, 0.60],
  "openai/gpt-oss-20b": [0.075, 0.30],
  "meta-llama/llama-4-scout-17b-16e-instruct": [0.11, 0.34],
  "qwen/qwen3-32b": [0.29, 0.59],
  "moonshotai/kimi-k2-instruct": [1.00, 3.00],
  "gemini-2.5-flash": [0.30, 2.50],
  "gemini-2.5-flash-lite": [0.15, 0.75],
  "gemini-2.5-pro": [1.25, 10.00],
  "gemini-2.0-flash": [0.10, 0.40],
  "meta-llama/llama-4-scout": [0.08, 0.30],
  "meta-llama/llama-4-maverick": [0.15, 0.60],
  "deepseek/deepseek-r1": [0.50, 2.15],
  "deepseek/deepseek-chat": [0.32, 0.89],
  "mistralai/mistral-large-2407": [2.00, 6.00],
  "mistralai/mistral-small-2603": [0.15, 0.60],
  "mistralai/devstral-2": [0.40, 2.00],
};

import { getSyncedPricing } from "../data/pricing-sync.js";

const litellm = getSyncedPricing();
for (const [key, info] of Object.entries(litellm)) {
  if (key === "sample_spec" || typeof info !== "object" || !info) continue;
  const inCost = (Number(info.input_cost_per_token) || 0) * 1_048_576;
  const outCost = (Number(info.output_cost_per_token) || 0) * 1_048_576;
  if (inCost >= 0 && outCost >= 0 && (inCost > 0 || outCost > 0)) {
    PRICING[key] = [inCost, outCost];
  }
}

/**
 * Record token usage from an API response.
 * @param {string} provider
 * @param {string} model
 * @param {{ inputTokens?: number, outputTokens?: number }} usage
 * @param {number} [latencyMs]  // RTT Latency in ms
 */
export function trackUsage(provider, model, usage, latencyMs) {
  syncMetrics(provider, model);

  const input = usage?.inputTokens || 0;
  const output = usage?.outputTokens || 0;
  session.inputTokens += input;
  session.outputTokens += output;
  session.apiCalls += 1;

  const MAX_TOKENS = 128000;
  const THRESHOLD = 0.85 * MAX_TOKENS;
  const RESET_TO = 0.15 * MAX_TOKENS;

  if (session.inputTokens + session.outputTokens >= THRESHOLD) {
    const excess = (session.inputTokens + session.outputTokens) - RESET_TO;
    session.inputTokens -= excess;
    if (session.inputTokens < 0) {
      session.outputTokens += session.inputTokens;
      session.inputTokens = 0;
    }
    session.compactions += 1;
  }

  callHistory.push({
    timestamp: Date.now(),
    inputTokens: input,
    outputTokens: output,
    totalTokens: input + output,
    latencyMs: latencyMs || 0,
  });

  saveMetrics();
}


// Reset session usage counters
export function resetUsage() {
  session.inputTokens = 0;
  session.outputTokens = 0;
  session.apiCalls = 0;
  session.compactions = 0;
  session.startedAt = Date.now();
  callHistory = [];
  saveMetrics();
}


/**
 * Get the raw call history (for chart rendering).
 * @returns {Array<{timestamp: number, inputTokens: number, outputTokens: number, totalTokens: number, latencyMs: number}>}
 */
export function getCallHistory() {
  return callHistory;
}


/**
 * Resolves pricing rates for a given model, accounting for provider prefixes and region variations.
 * @param {string} model
 * @returns {[number, number]|null}
 */
function getRates(model) {
  if (!model) return null;

  if (currentProvider) {
    const providerModel = `${currentProvider}/${model}`;
    if (PRICING[providerModel]) return PRICING[providerModel];
  }

  if (PRICING[model]) return PRICING[model];

  const keys = Object.keys(PRICING);

  const findBest = (condition) => {
    const matches = keys.filter(condition);
    if (matches.length === 0) return null;
    matches.sort((a, b) => a.length - b.length);
    return matches[0];
  };

  let match = null;

  if (currentProvider) {
    match = findBest(k => k.includes(currentProvider) && k.includes(model));
    if (match) return PRICING[match];
  }

  match = findBest((k) => k.endsWith(`/${model}`));
  if (match) return PRICING[match];

  match = findBest((k) => k.includes(model));
  if (match) return PRICING[match];

  const prefixMatches = keys.filter((k) => model.startsWith(k));
  if (prefixMatches.length > 0) {
    prefixMatches.sort((a, b) => b.length - a.length);
    return PRICING[prefixMatches[0]];
  }

  return null;
}

/**
 * Estimate cost for the current session.
 * @param {string} model
 * @returns {string|null}
 */
function estimateCost(model) {
  const rates = getRates(model);
  if (!rates) return null;

  const inputCost = (session.inputTokens / 1_048_576) * rates[0];
  const outputCost = (session.outputTokens / 1_048_576) * rates[1];
  const total = inputCost + outputCost;
  return `$${total.toFixed(4)}`;
}

/**
 * Get raw cost as a number (for per-request calculations).
 * @param {string} model
 * @returns {number|null}
 */
function estimateCostRaw(model) {
  const rates = getRates(model);
  if (!rates) return null;
  return (session.inputTokens / 1_048_576) * rates[0] +
    (session.outputTokens / 1_048_576) * rates[1];
}


function formatNum(n) {
  return n.toLocaleString("en-US");
}


// Compute extended rate metrics from session data.
function computeMetrics(model) {
  const elapsedMs = Math.max(Date.now() - session.startedAt, 1);
  const elapsedSec = elapsedMs / 1000;
  const elapsedMin = elapsedSec / 60;
  const total = session.inputTokens + session.outputTokens;

  const metrics = {};

  if (session.apiCalls > 0) {
    metrics.rpm = (session.apiCalls / elapsedMin).toFixed(1);
    metrics.tpm = (total / elapsedMin).toFixed(0);
    metrics.rps = (session.apiCalls / elapsedSec).toFixed(2);

    metrics.rpd = Math.round(session.apiCalls / elapsedMin * 60 * 24);
    metrics.tpd = formatNum(Math.round(total / elapsedMin * 60 * 24));
  }

  const latencies = callHistory.filter((c) => c.latencyMs > 0).map((c) => c.latencyMs);
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    metrics.avgLatency = Math.round(sorted.reduce((a, b) => a + b, 0) / sorted.length);
    metrics.p95Latency = Math.round(sorted[Math.floor(sorted.length * 0.95)]);
  }

  const rawCost = estimateCostRaw(model);
  if (rawCost !== null && session.apiCalls > 0) {
    metrics.costPerReq = `$${(rawCost / session.apiCalls).toFixed(6)}`;
  }

  if (session.inputTokens > 0) {
    metrics.efficiency = (session.outputTokens / session.inputTokens).toFixed(2);
  }

  return metrics;
}


/**
 * Print formatted usage summary to the console.
 * @param {object} state — { config: { ai: { provider, model } } }
 */
export async function printUsage(state) {
  const provider = state.config.ai.provider;
  const model = state.config.ai.model || "default";

  syncMetrics(provider, model);

  const total = session.inputTokens + session.outputTokens;
  const cost = estimateCost(model);
  const isLocal = provider === "ollama";
  const metrics = computeMetrics(model);

  const ping = await measurePing(state, provider);

  console.log();
  console.log(chalk.rgb(100, 200, 255).bold("  ╭─────────────────────────────────────────╮"));
  console.log(chalk.rgb(100, 200, 255).bold("  │") + chalk.white.bold("    💠 Usage & Telemetry Dashboard 💠    ") + chalk.rgb(100, 200, 255).bold("│"));
  console.log(chalk.rgb(100, 200, 255).bold("  ╰─────────────────────────────────────────╯"));
  console.log();

  // ── Context Usage Grid ────────────────────────────────────────────────
  const MAX_TOKENS = 128000;
  const TOTAL_BLOCKS = 50;
  const TOKENS_PER_BLOCK = MAX_TOKENS / TOTAL_BLOCKS;

  const inTokens = session.inputTokens;
  const outTokens = session.outputTokens;

  let inBlocks = Math.round(inTokens / TOKENS_PER_BLOCK);
  let outBlocks = Math.round(outTokens / TOKENS_PER_BLOCK);

  if (inTokens > 0 && inBlocks === 0) inBlocks = 1;
  if (outTokens > 0 && outBlocks === 0) outBlocks = 1;
  if (inBlocks + outBlocks > TOTAL_BLOCKS) {
    const scale = TOTAL_BLOCKS / (inBlocks + outBlocks);
    inBlocks = Math.floor(inBlocks * scale);
    outBlocks = Math.floor(outBlocks * scale);
  }

  const freeBlocks = TOTAL_BLOCKS - inBlocks - outBlocks;

  const blocks = [];
  for (let i = 0; i < inBlocks; i++) blocks.push(chalk.cyan("▤"));
  for (let i = 0; i < outBlocks; i++) blocks.push(chalk.magenta("▤"));
  for (let i = 0; i < freeBlocks; i++) blocks.push(chalk.gray("◻"));

  const rows = [];
  for (let i = 0; i < 5; i++) {
    rows.push(blocks.slice(i * 10, (i + 1) * 10).join(" "));
  }

  const inPct = ((inTokens / MAX_TOKENS) * 100).toFixed(1);
  const outPct = ((outTokens / MAX_TOKENS) * 100).toFixed(1);
  const freePct = (((MAX_TOKENS - inTokens - outTokens) / MAX_TOKENS) * 100).toFixed(1);
  const freeTokens = MAX_TOKENS - inTokens - outTokens;

  function formatCompact(n) {
    if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
    if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
    return String(n);
  }

  console.log(chalk.bold("  Context Usage"));
  console.log(`  ${chalk.gray(model)} · ${formatCompact(inTokens + outTokens)}/${formatCompact(MAX_TOKENS)} tokens (${((inTokens + outTokens) / MAX_TOKENS * 100).toFixed(1)}%)`);
  console.log();

  console.log(`  ${rows[0]}   ${chalk.cyan("▤")} Input: ${formatCompact(inTokens)} tokens (${inPct}%)`);
  console.log(`  ${rows[1]}   ${chalk.magenta("▤")} Output: ${formatCompact(outTokens)} tokens (${outPct}%)`);
  console.log(`  ${rows[2]}   ${chalk.gray("◻")} Free space: ${formatCompact(freeTokens)} tokens (${freePct}%)`);
  console.log(`  ${rows[3]}`);
  console.log(`  ${rows[4]}   ${chalk.rgb(128, 255, 100)("⏏")} Context Compactions: ${session.compactions}`);
  console.log();

  // ── Connection Ping ───────────────────────────────────────────────────
  console.log(chalk.bold("  Connection"));
  if (ping.error) {
    console.log(`  ${chalk.red("✕")} ${ping.error}  ${chalk.dim(ping.elapsed + "ms")}  ${chalk.dim(ping.label)}`);
  } else {
    console.log(`  ${ping.icon} reachable  ${ping.color(ping.elapsed + "ms")}  ${chalk.dim(ping.label)}`);
  }
  console.log();


  // ── Cost & Telemetry ──────────────────────────────────────────────────
  console.log(chalk.bold("  Cost & Metrics"));
  if (isLocal) {
    console.log(`  Est. Cost: ${chalk.green("$0.00 (local)")}  ·  Calls: ${chalk.white(formatNum(session.apiCalls))}`);
  } else if (cost) {
    console.log(`  Est. Cost: ${chalk.yellow(cost)}  ·  Calls: ${chalk.white(formatNum(session.apiCalls))}`);
  } else {
    console.log(`  Est. Cost: ${chalk.dim("varies by model")}  ·  Calls: ${chalk.white(formatNum(session.apiCalls))}`);
  }

  if (session.apiCalls > 0) {
    let metricsStr = [];
    if (metrics.rpm) metricsStr.push(`RPM: ${chalk.white(metrics.rpm)}`);
    if (metrics.tpm) metricsStr.push(`TPM: ${chalk.white(formatCompact(Number(metrics.tpm)))}`);
    if (metrics.avgLatency) metricsStr.push(`Avg Latency: ${chalk.white(metrics.avgLatency + "ms")}`);
    if (metrics.efficiency) metricsStr.push(`Ratio: ${chalk.white(metrics.efficiency + "x")}`);

    if (metricsStr.length > 0) {
      console.log(`  ${chalk.dim("└")} ` + metricsStr.join(chalk.dim(" · ")));
      console.log();
    }
  } else {
    console.log();
  }
}

import { PROVIDER_DEFAULTS } from "../config/schema.js";
import { deriveHealthUrl } from "../config/custom-endpoints.js";

async function measurePing(state, provider) {
  const defaults = PROVIDER_DEFAULTS[provider];
  const label = defaults?.label || provider;

  if (!state.apiKey && provider !== "ollama") {
    return { error: "unconfigured", elapsed: 0, label };
  }

  let url;
  let headers = {};
  if (defaults?.isCustom) {
    url = defaults.modelsUrl || deriveHealthUrl(defaults.baseUrl) || defaults.baseUrl;
    if (state.apiKey && state.apiKey !== "local") {
      headers = { Authorization: `Bearer ${state.apiKey}` };
    }
    for (const [k, v] of Object.entries(defaults.extraHeaders || {})) {
      if (typeof v === "string") headers[k] = v;
    }
  } else if (provider === "ollama") {
    url = (state.config.ai.ollamaEndpoint || "http://localhost:11434") + "/api/tags";
  } else if (provider === "gemini") {
    url = `${defaults.baseUrl}/models?key=${state.apiKey}`;
  } else if (provider === "anthropic") {
    url = "https://api.anthropic.com/v1/messages";
    headers = { "x-api-key": state.apiKey, "anthropic-version": "2023-06-01" };
  } else {
    const modelsUrl = defaults.modelsUrl || defaults.baseUrl.replace("/chat/completions", "/models");
    url = modelsUrl;
    headers = { Authorization: `Bearer ${state.apiKey}` };
  }

  const start = Date.now();
  try {
    const method = provider === "anthropic" ? "POST" : "GET";
    const fetchOpts = {
      method,
      headers: { ...headers, "Content-Type": "application/json" },
      signal: AbortSignal.timeout(5000),
    };
    if (provider === "anthropic") {
      fetchOpts.body = JSON.stringify({ model: "claude-haiku-4-5", max_tokens: 1, messages: [] });
    }

    const res = await fetch(url, fetchOpts);
    const elapsed = Date.now() - start;
    let icon;
    // 400/404/405 from a custom endpoint still proves the host answered.
    const reachable = res.ok || res.status === 400 ||
      (defaults?.isCustom && (res.status === 404 || res.status === 405));
    if (reachable) icon = chalk.green("✔");
    else if (res.status === 401 || res.status === 403) return { error: "auth error", elapsed, label };
    else return { error: `HTTP ${res.status}`, elapsed, label };

    let color = chalk.green;
    if (elapsed > 300) color = chalk.yellow;
    if (elapsed > 1000) color = chalk.red;

    return { error: null, icon, color, elapsed, label };
  } catch (err) {
    return { error: err.name === "TimeoutError" ? "timeout" : "unreachable", elapsed: Date.now() - start, label };
  }
}

