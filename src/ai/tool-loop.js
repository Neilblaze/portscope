import chalk from "chalk";
import { sendMessage, sendMessageStream } from "./client.js";
import { executeTool } from "./executor.js";
import { TOOLS, DESTRUCTIVE_TOOLS } from "./tools.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { prepareMessages } from "./context.js";
import { trackUsage } from "./usage.js";
import { sanitizeForAI } from "../config/sanitize-data.js";
import { renderMarkdown, wrapAnsi } from "../ui/markdown.js";
import { startSpinner } from "../ui/spinner.js";


const TOOL_LABELS = {
  list_ports: "Scanning ports",
  inspect_port: "Inspecting port",
  kill_process: "Stopping process",
  kill_all_dev_ports: "Killing dev ports",
  list_processes: "Listing processes",
  find_orphaned: "Finding orphans",
  clean_orphaned: "Cleaning up",
  view_logs: "Reading logs",
  get_system_stats: "Checking system",
  restart_process: "Restarting process",
  get_port_connections: "Mapping connections",
};


async function callAI(config, apiKey, messages, verbose, onChunk) {
  const compacted = prepareMessages(messages, { maxContextTokens: config.ai?.maxContextTokens || 32000 });
  if (verbose) {
    return sendMessageStream(config, apiKey, compacted, TOOLS, SYSTEM_PROMPT, onChunk);
  }
  return sendMessage(config, apiKey, compacted, TOOLS, SYSTEM_PROMPT);
}


async function callAIWithSpinner(config, apiKey, messages, verbose, t0) {
  if (verbose) {
    let chunkCount = 0;
    const interval = setInterval(() => {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const label = chunkCount > 0
        ? `Generating... (${chunkCount} chunks, ${elapsed}s)`
        : `Thinking... (${elapsed}s)`;
      process.stdout.write(`\r  💭 ${chalk.dim(label)}  `);
    }, 200);

    try {
      const response = await callAI(config, apiKey, messages, true, () => { chunkCount++; });
      return response;
    } finally {
      clearInterval(interval);
      process.stdout.write("\r\x1b[2K");
    }
  } else {
    const spinner = startSpinner();
    try {
      return await callAI(config, apiKey, messages, false, null);
    } finally {
      spinner.stop();
    }
  }
}


async function executeToolCall(tc, rl, verbose) {
  const label = TOOL_LABELS[tc.name] ?? tc.name.replace(/_/g, " ");

  if (verbose) {
    const params = Object.keys(tc.input || {});
    const paramsStr = params.length > 0
      ? chalk.gray(` (${params.map(k => `${k}: ${JSON.stringify(tc.input[k])}`).join(", ")})`)
      : "";
    process.stdout.write(`  ${chalk.rgb(185, 148, 0)("⚡")} ${chalk.white(label)}${chalk.dim(` · ${tc.name}`)}${paramsStr}`);
    const t0 = Date.now();
    const result = await executeTool(tc.name, tc.input, rl);
    if (!DESTRUCTIVE_TOOLS.has(tc.name)) {
      console.log(chalk.dim(` ${Date.now() - t0}ms`));
    }
    return result;
  }

  if (process.stdout.isTTY && !DESTRUCTIVE_TOOLS.has(tc.name)) {
    const bolt = chalk.rgb(185, 148, 0)("⚡");
    const glowFrames = [
      chalk.rgb(100, 80, 0)("⚡"),
      chalk.rgb(185, 148, 0)("⚡"),
      chalk.rgb(220, 175, 0)("⚡"),
      chalk.rgb(255, 210, 50)("⚡"),
      chalk.rgb(220, 175, 0)("⚡"),
      chalk.rgb(185, 148, 0)("⚡"),
    ];
    let glowIdx = 0;

    process.stdout.write(`  ${bolt} ${chalk.dim(`${label}...`)}`);
    const interval = setInterval(() => {
      glowIdx++;
      const frame = glowFrames[glowIdx % glowFrames.length];
      process.stdout.write(`\r  ${frame} ${chalk.dim(`${label}...`)}`);
    }, 100);

    const result = await executeTool(tc.name, tc.input, rl);
    clearInterval(interval);
    process.stdout.write(`\r  ${bolt} ${chalk.dim(`${label}...`)}\n`);
    return result;
  }

  console.log(`  ${chalk.rgb(185, 148, 0)("⚡")} ${chalk.dim(`${label}...`)}`);
  return executeTool(tc.name, tc.input, rl);
}


export async function processConversation(config, apiKey, messages, rl, options = {}) {
  const { verbose = false } = options;
  const t0 = Date.now();
  let tookAction = false;

  let response = await callAIWithSpinner(config, apiKey, messages, verbose, t0);
  trackUsage(config.ai.provider, config.ai.model, response.usage, Date.now() - t0);

  if (verbose && response.usage) {
    const { inputTokens: inT, outputTokens: outT } = response.usage;
    console.log(chalk.dim(`  ↔️  ${inT + outT} tokens (${inT} in · ${outT} out) · ${((Date.now() - t0) / 1000).toFixed(1)}s`));
  }

  // Tool calling loop — AI can make multiple sequential rounds of tool calls
  while (response.toolCalls && response.toolCalls.length > 0) {
    tookAction = true;

    if (response.text) {
      console.log(renderMarkdown(response.text, true));
    }

    messages.push({
      role: "assistant",
      text: response.text,
      toolCalls: response.toolCalls,
    });

    const toolResults = [];
    for (const tc of response.toolCalls) {
      const result = await executeToolCall(tc, rl, verbose);
      toolResults.push({ id: tc.id, result });
    }

    const customPatterns = config.ai?.sanitizePatterns || [];
    const sanitizedResults = toolResults.map((tr) => ({
      ...tr,
      result: sanitizeForAI(tr.result, customPatterns),
    }));
    messages.push({ role: "user", toolResults: sanitizedResults });

    const t1 = Date.now();
    response = await callAIWithSpinner(config, apiKey, messages, verbose, t1);
    trackUsage(config.ai.provider, config.ai.model, response.usage, Date.now() - t1);

    if (verbose && response.usage) {
      const { inputTokens: inT, outputTokens: outT } = response.usage;
      console.log(chalk.dim(`  ↔️  ${inT + outT} tokens (${inT} in · ${outT} out) · ${((Date.now() - t1) / 1000).toFixed(1)}s`));
    }
  }

  if (response.text) {
    console.log(renderMarkdown(response.text, true) + "\n");

    if (!tookAction) {
      const lastUserMsg = messages.slice().reverse().find(m => m.role === "user");
      const userText = lastUserMsg
        ? (lastUserMsg._text || (typeof lastUserMsg.content === "string" ? lastUserMsg.content : ""))
        : "";
      const lower = userText.toLowerCase();
      const exitKeywords = ["exit", "quit", "close", "kill", "pause", "stop", "terminate", "free", "leave"];
      if (exitKeywords.some(w => lower.includes(w))) {
        const msg = "💡 If you want to terminate or suspend a process, use 'kill' or 'pause'. Run 'help' to see all commands, or type 'exit' / 'quit' to close this interactive session.";
        const cols = process.stdout.columns || 80;
        console.log(chalk.dim(wrapAnsi(msg, cols - 2, "  ", "     ")) + "\n");
      }
    }
  }

  messages.push({ role: "assistant", text: response.text, toolCalls: [] });
}
