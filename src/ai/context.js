/**
 * Context management — compacts conversation history before sending to AI.
 *
 * Strategy (sliding window + summarization):
 *   1. Always keep the last HOT_TURNS user/assistant exchange pairs verbatim.
 *   2. Older tool-call results are replaced with compact 1-line summaries.
 *   3. Null / undefined fields are stripped from serialized tool results.
 *   4. If the estimated token count still exceeds the budget, prune oldest
 *      messages first (keeping at least the last HOT_TURNS).
 *
 * The *local* messages array is never mutated — a compacted copy is returned
 * for transmission only.  Full history remains available for /export, /history.
 */


// Default number of recent exchange pairs to preserve verbatim
const HOT_TURNS = 3;

// Rough token estimator: 1 token ≈ 4 chars for English / JSON.
function estimateTokens(text) {
  if (!text) return 0;
  const str = typeof text === "string" ? text : JSON.stringify(text);
  return Math.ceil(str.length / 4);
}

/**
 * Strip null / undefined values from an object (shallow).
 * Reduces token waste on `"field": null` in JSON payloads.
 */
export function stripNulls(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (typeof obj !== "object") return obj;
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined) {
      out[k] = typeof v === "object" ? stripNulls(v) : v;
    }
  }
  return out;
}


// Create a compact 1-line summary of a tool result for older turns.
// e.g. "[Tool: list_ports → 8 ports]"
function summarizeToolResult(toolName, result) {
  if (!result) return `[Tool: ${toolName} → done]`;

  if (result.ports && Array.isArray(result.ports)) {
    return `[Tool: ${toolName} → ${result.ports.length} port(s)]`;
  }
  if (result.processes && Array.isArray(result.processes)) {
    return `[Tool: ${toolName} → ${result.processes.length} process(es)]`;
  }
  if (result.orphaned && Array.isArray(result.orphaned)) {
    return `[Tool: ${toolName} → ${result.orphaned.length} orphaned]`;
  }
  if (result.topology && Array.isArray(result.topology)) {
    return `[Tool: ${toolName} → ${result.topology.length} connected port(s)]`;
  }
  if (result.port) {
    const p = result.port;
    return `[Tool: ${toolName} → :${p.port} ${p.process || ""} ${p.framework || ""}]`;
  }
  if (result.memory) {
    return `[Tool: ${toolName} → mem ${result.memory.usedGB}/${result.memory.totalGB} GB, CPU load ${result.cpu?.loadAverage?.["1m"] || "?"}]`;
  }
  if (result.file && result.content) {
    const lines = (result.content.match(/\n/g) || []).length + 1;
    return `[Tool: ${toolName} → ${lines} log lines from ${result.file}]`;
  }
  if (result.success !== undefined) {
    return `[Tool: ${toolName} → ${result.success ? "success" : "failed"}]`;
  }
  if (result.message) {
    return `[Tool: ${toolName} → ${result.message}]`;
  }
  if (result.error) {
    return `[Tool: ${toolName} → error: ${result.error}]`;
  }
  if (result.killed && Array.isArray(result.killed)) {
    return `[Tool: ${toolName} → killed ${result.killed.length}, failed ${(result.failed || []).length}]`;
  }

  const json = JSON.stringify(result);
  if (json.length > 120) {
    return `[Tool: ${toolName} → ${json.slice(0, 100)}…]`;
  }
  return `[Tool: ${toolName} → ${json}]`;
}


/**
 * Prepare a compacted copy of `messages` for transmission to the AI.
 *
 * @param {Array} messages — full conversation history (NOT mutated)
 * @param {object} [options]
 * @param {number} [options.maxContextTokens=32000] — soft token budget for messages
 * @param {number} [options.hotTurns=3] — number of recent exchange pairs to keep verbatim
 * @returns {Array} — compacted message array ready for serialization
 */
export function prepareMessages(messages, options = {}) {
  const { maxContextTokens = 32000, hotTurns = HOT_TURNS } = options;

  if (!messages || messages.length === 0) return [];


  // Separate hot zone (most recent turns) from cold zone (older turns)
  // NOTE: A "turn" is one user message + one assistant response (+ optional tool results)
  const hotBoundary = findHotBoundary(messages, hotTurns);

  const cold = messages.slice(0, hotBoundary);
  const hot = messages.slice(hotBoundary);

  // Compact cold messages: summarize tool results, keep user/assistant text as-is
  const compacted = [];

  for (const msg of cold) {
    if (msg.role === "user" && msg.toolResults) {
      const summaries = msg.toolResults.map((tr) => {
        const summary = summarizeToolResult(tr.name || "tool", tr.result);
        return { id: tr.id, result: summary, name: tr.name };
      });
      compacted.push({ role: "user", toolResults: summaries });
    } else if (msg.role === "assistant" && msg.toolCalls && msg.toolCalls.length > 0) {
      compacted.push(stripNulls(msg));
    } else if (msg.role === "user") {
      if (Array.isArray(msg.content)) {
        const textOnly = msg.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join(" ");
        compacted.push({ role: "user", content: textOnly || "(image attachment)" });
      } else {
        compacted.push({ role: "user", content: msg.content });
      }
    } else if (msg.role === "assistant") {
      compacted.push({ role: "assistant", text: msg.text, toolCalls: msg.toolCalls || [] });
    }
  }


  const hotCleaned = hot.map((msg) => {
    if (msg.role === "user" && msg.toolResults) {
      return {
        ...msg,
        toolResults: msg.toolResults.map((tr) => ({
          ...tr,
          result: stripNulls(tr.result),
        })),
      };
    }
    return msg;
  });

  let result = [...compacted, ...hotCleaned];

  // Token budget enforcement: if still too large, progressively prune cold zone
  let totalTokens = result.reduce((sum, m) => sum + estimateTokens(m), 0);
  while (totalTokens > maxContextTokens && compacted.length > 0) {
    compacted.shift(); // Remove oldest cold message
    result = [...compacted, ...hotCleaned];
    totalTokens = result.reduce((sum, m) => sum + estimateTokens(m), 0);
  }

  return result;
}


/**
 * Find the index that separates cold (older) from hot (recent) messages.
 * Counts backward from the end, finding `hotTurns` user messages.
 */
function findHotBoundary(messages, hotTurns) {
  let userCount = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === "user" && !messages[i].toolResults) {
      userCount++;
      if (userCount >= hotTurns) {
        return i;
      }
    }
  }
  return 0;
}

