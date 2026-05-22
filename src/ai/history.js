import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import chalk from "chalk";

const HISTORY_DIR = join(homedir(), ".portscope", "history");
const INDEX_FILE = join(HISTORY_DIR, "index.json");
const MAX_CONVERSATIONS = 50;


function ensureHistoryDir() {
  if (!existsSync(HISTORY_DIR)) {
    mkdirSync(HISTORY_DIR, { recursive: true, mode: 0o700 });
  }
}

function loadIndex() {
  ensureHistoryDir();
  if (!existsSync(INDEX_FILE)) return [];
  try {
    return JSON.parse(readFileSync(INDEX_FILE, "utf8"));
  } catch {
    return [];
  }
}

function saveIndex(index) {
  ensureHistoryDir();
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2) + "\n", "utf8");
}


// Generate a conversation ID based on date and sequence
export function generateConversationId() {
  const date = new Date().toISOString().slice(0, 10);
  const index = loadIndex();
  const todayCount = index.filter((c) => c.id && c.id.startsWith(`conv_${date}`)).length;
  return `conv_${date}_${String(todayCount + 1).padStart(3, "0")}`;
}


// Save/update a conversation to disk
export function saveConversation(id, config, messages) {
  ensureHistoryDir();
  const index = loadIndex();

  // Derive title from first user message
  const firstUserMsg = messages.find((m) => m.role === "user" && m.content);
  const title = firstUserMsg
    ? firstUserMsg.content.slice(0, 60) + (firstUserMsg.content.length > 60 ? "..." : "")
    : "Untitled";

  const convFile = join(HISTORY_DIR, `${id}.json`);
  const conv = {
    id,
    title,
    provider: config.ai.provider,
    model: config.ai.model,
    startedAt: existsSync(convFile)
      ? JSON.parse(readFileSync(convFile, "utf8")).startedAt
      : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages,
  };

  writeFileSync(convFile, JSON.stringify(conv, null, 2) + "\n", "utf8");

  // Update index
  const existing = index.findIndex((c) => c.id === id);
  const entry = {
    id,
    title,
    provider: config.ai.provider,
    model: config.ai.model,
    startedAt: conv.startedAt,
    updatedAt: conv.updatedAt,
    messageCount: messages.length,
  };

  if (existing >= 0) {
    index[existing] = entry;
  } else {
    index.push(entry);
  }

  // Prune oldest if over limit
  if (index.length > MAX_CONVERSATIONS) {
    const removed = index.splice(0, index.length - MAX_CONVERSATIONS);
    for (const r of removed) {
      try {
        const f = join(HISTORY_DIR, `${r.id}.json`);
        if (existsSync(f)) {
          unlinkSync(f);
        }
      } catch { }
    }
  }

  saveIndex(index);
}


// Load a conversation from disk by ID
export function loadConversation(id) {
  const convFile = join(HISTORY_DIR, `${id}.json`);
  if (!existsSync(convFile)) return null;
  try {
    return JSON.parse(readFileSync(convFile, "utf8"));
  } catch {
    return null;
  }
}


/**
 * List recent conversations.
 * @param {number} [count=20]
 */
export function listConversations(count = 20) {
  const index = loadIndex();
  return index.slice(-count).reverse();
}


// Print conversation history list
export function printHistory() {
  const conversations = listConversations(20);

  console.log();
  console.log(chalk.cyan.bold("  Conversation History"));
  console.log(chalk.gray("  ─────────────────────────────────────────"));

  if (conversations.length === 0) {
    console.log(chalk.gray("  No conversations yet.\n"));
    return;
  }

  for (let i = 0; i < conversations.length; i++) {
    const c = conversations[i];
    const date = new Date(c.updatedAt).toLocaleDateString("en-US", {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
    });
    const msgs = chalk.dim(`${c.messageCount} msgs`);
    const model = chalk.dim(c.model || "");
    console.log(
      `  ${chalk.white.bold(String(i + 1).padStart(3))}  ${chalk.gray(date)}  ${chalk.white(c.title)}`,
    );
    console.log(`       ${msgs}  ${model}`);
  }
  console.log();
  console.log(chalk.dim("  Use /history <n> to preview, /load <n> to restore, /export to save."));
  console.log();
}


// Print a preview of a conversation
export function printConversationPreview(conv) {
  console.log();
  console.log(chalk.cyan.bold(`  Preview: ${conv.title}`));
  console.log(chalk.gray(`  ${conv.provider} · ${conv.model} · ${new Date(conv.startedAt).toLocaleString()}`));
  console.log(chalk.gray("  ─────────────────────────────────────────"));

  const userMsgs = conv.messages.filter((m) => m.role === "user" && m.content);
  const assistantMsgs = conv.messages.filter((m) => m.role === "assistant" && m.text);

  const previewCount = 5;
  const preview = [];

  for (let i = 0; i < Math.min(previewCount, userMsgs.length); i++) {
    preview.push({ role: "user", text: userMsgs[i].content });
    if (assistantMsgs[i]) {
      preview.push({ role: "assistant", text: assistantMsgs[i].text });
    }
  }

  for (const msg of preview) {
    if (msg.role === "user") {
      console.log(`  ${chalk.rgb(100, 200, 255)("❯")} ${chalk.white(truncate(msg.text, 100))}`);
    } else {
      console.log(`  ${chalk.gray("◆")} ${chalk.gray(truncate(msg.text, 100))}`);
    }
  }

  if (userMsgs.length > previewCount) {
    console.log(chalk.dim(`  ... and ${userMsgs.length - previewCount} more exchanges`));
  }
  console.log();
}


/**
 * Export a conversation to a file.
 * @param {object} conv — conversation object
 * @param {"md"|"html"|"txt"} format
 * @returns {string} — path to exported file
 */
export function exportConversation(conv, format = "md") {
  const downloadsDir = join(homedir(), "Downloads");
  const baseDir = existsSync(downloadsDir) ? downloadsDir : process.cwd();
  const filename = `portscope-${conv.id}.${format}`;
  const filepath = join(baseDir, filename);

  let content;
  switch (format) {
    case "html":
      content = exportAsHtml(conv);
      break;
    case "txt":
      content = exportAsTxt(conv);
      break;
    case "md":
    default:
      content = exportAsMarkdown(conv);
      break;
  }

  writeFileSync(filepath, content, "utf8");
  return filepath;
}


function exportAsMarkdown(conv) {
  const lines = [
    `# PortScope Conversation`,
    ``,
    `> **Provider**: ${conv.provider} · **Model**: ${conv.model}`,
    `> **Date**: ${new Date(conv.startedAt).toLocaleString()}`,
    ``,
    `---`,
    ``,
  ];

  for (const msg of conv.messages) {
    if (msg.role === "user" && msg.content) {
      lines.push(`## 🧑 User`);
      lines.push(``, msg.content, ``);
    } else if (msg.role === "assistant" && msg.text) {
      lines.push(`## 🤖 Assistant`);
      lines.push(``, msg.text, ``);
    } else if (msg.role === "user" && msg.toolResults) {
      lines.push(`<details><summary>Tool Results</summary>`, ``);
      for (const tr of msg.toolResults) {
        lines.push(`\`\`\`json`, JSON.stringify(tr.result, null, 2), `\`\`\``);
      }
      lines.push(``, `</details>`, ``);
    }
  }

  return lines.join("\n");
}


function exportAsHtml(conv) {
  const msgs = conv.messages
    .filter((m) => (m.role === "user" && m.content) || (m.role === "assistant" && m.text))
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      const text = escapeHtml(m.content || m.text || "");
      const cls = m.role === "user" ? "user" : "assistant";
      return `<div class="msg ${cls}"><div class="role">${role}</div><div class="text">${text}</div></div>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
  <html lang="en">
  <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>PortScope — ${escapeHtml(conv.title)}</title>
  <style>
    body { font-family: 'Inter', -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; max-width: 720px; margin: 0 auto; padding: 2rem; }
    h1 { color: #64c8ff; font-size: 1.4rem; }
    .meta { color: #8b949e; font-size: 0.85rem; margin-bottom: 2rem; }
    .msg { padding: 1rem; margin: 0.5rem 0; border-radius: 8px; }
    .user { background: #161b22; border-left: 3px solid #64c8ff; }
    .assistant { background: #1c2128; border-left: 3px solid #3fb950; }
    .role { font-size: 0.75rem; font-weight: 700; text-transform: uppercase; color: #8b949e; margin-bottom: 0.4rem; }
    .text { white-space: pre-wrap; line-height: 1.6; }
  </style>
  </head>
    <body>
    <h1>🔊 PortScope Conversation</h1>
    <div class="meta">${conv.provider} · ${conv.model} · ${new Date(conv.startedAt).toLocaleString()}</div>
    ${msgs}
  </body>
  </html>`;
}


function exportAsTxt(conv) {
  const lines = [
    `PortScope Conversation`,
    `Provider: ${conv.provider} · Model: ${conv.model}`,
    `Date: ${new Date(conv.startedAt).toLocaleString()}`,
    `${"─".repeat(60)}`,
    ``,
  ];

  for (const msg of conv.messages) {
    if (msg.role === "user" && msg.content) {
      lines.push(`[USER]`, msg.content, ``);
    } else if (msg.role === "assistant" && msg.text) {
      lines.push(`[ASSISTANT]`, msg.text, ``);
    }
  }

  return lines.join("\n");
}


function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}


function truncate(str, max) {
  if (!str) return "";
  return str.length > max ? str.slice(0, max - 1) + "…" : str;
}
