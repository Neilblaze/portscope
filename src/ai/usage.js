import chalk from "chalk";

// NOTE: Per-session usage accumulator 
const session = {
  inputTokens: 0,
  outputTokens: 0,
  apiCalls: 0,
};

// Approximate pricing per 1M tokens [input, output] in USD : 27th April, 2026
// TASK (WIP): Will try to write a helper function that programmatically retrieves this from the web
const PRICING = {
  "claude-haiku-4-5": [1.00, 5.00],
  "claude-haiku-4-5-20251001": [1.00, 5.00],
  "claude-sonnet-4-6": [3.00, 15.00],
  "claude-opus-4-6": [5.00, 25.00],
  "gpt-5.4-nano": [0.20, 1.25],
  "gpt-5.4-mini": [0.75, 4.50],
  "gpt-5.4": [2.50, 15.00],
  "gpt-5.5": [5.00, 15.00],
  "gpt-5-nano": [0.05, 0.40],
  "gpt-4o-mini": [0.15, 0.60],
  "gpt-4o": [2.50, 10.00],
};


/**
 * Record token usage from an API response.
 * @param {{ inputTokens?: number, outputTokens?: number }} usage
 */
export function trackUsage(usage) {
  if (!usage) return;
  session.inputTokens += usage.inputTokens || 0;
  session.outputTokens += usage.outputTokens || 0;
  session.apiCalls += 1;
}


// Reset session usage counters
export function resetUsage() {
  session.inputTokens = 0;
  session.outputTokens = 0;
  session.apiCalls = 0;
}


/**
 * Estimate cost for the current session.
 * @param {string} model
 * @returns {string|null}
 */
function estimateCost(model) {
  let rates = PRICING[model];
  if (!rates) {
    const key = Object.keys(PRICING).find((k) => model.startsWith(k));
    if (key) rates = PRICING[key];
  }
  if (!rates) return null;

  const inputCost = (session.inputTokens / 1_000_000) * rates[0];
  const outputCost = (session.outputTokens / 1_000_000) * rates[1];
  const total = inputCost + outputCost;
  return `$${total.toFixed(4)}`;
}


function formatNum(n) {
  return n.toLocaleString("en-US");
}


/**
 * Print formatted usage summary to the console.
 * @param {object} state — { config: { ai: { provider, model } } }
 */
export function printUsage(state) {
  const provider = state.config.ai.provider;
  const model = state.config.ai.model || "default";
  const total = session.inputTokens + session.outputTokens;
  const cost = estimateCost(model);
  const isLocal = provider === "ollama";

  console.log();
  console.log(chalk.cyan.bold("  Session Usage"));
  console.log(chalk.gray("  ─────────────────────────────────"));
  console.log(`  ${chalk.gray("Provider")}      ${chalk.white.bold(provider)}`);
  console.log(`  ${chalk.gray("Model")}         ${chalk.white.bold(model)}`);
  console.log(`  ${chalk.gray("API Calls")}     ${chalk.white(formatNum(session.apiCalls))}`);
  console.log(`  ${chalk.gray("Input Tokens")}  ${chalk.white(formatNum(session.inputTokens))}`);
  console.log(`  ${chalk.gray("Output Tokens")} ${chalk.white(formatNum(session.outputTokens))}`);
  console.log(`  ${chalk.gray("Total Tokens")}  ${chalk.white.bold(formatNum(total))}`);

  if (isLocal) {
    console.log(`  ${chalk.gray("Est. Cost")}     ${chalk.green("$0.00 (local)")}`);
  } else if (cost) {
    console.log(`  ${chalk.gray("Est. Cost")}     ${chalk.yellow(cost)}`);
  } else {
    console.log(`  ${chalk.gray("Est. Cost")}     ${chalk.dim("varies by model")}`);
  }
  console.log();
}
