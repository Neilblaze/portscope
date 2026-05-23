import chalk from "chalk";
import Table from "cli-table3";


/**
 * Render markdown-like text for terminal output.
 * Converts:
 *   **bold** → chalk.bold
 *   *italic* / _italic_ → chalk.italic
 *   `code` → chalk.cyan
 *   > blockquote → indented with │ prefix
 *   | table | → cli-table3 rendered table
 *   - list / * list / numbered list → bullet points
 *   # headers → chalk.bold.underline
 *   --- / *** → horizontal rule
 */
export function renderMarkdown(text) {
  if (!text) return "";

  const lines = text.split("\n");
  const output = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // ── Table detection ──────────────────────────────────────────────
    if (isTableRow(line) && i + 1 < lines.length && isTableSeparator(lines[i + 1])) {
      const tableLines = [];
      while (i < lines.length && (isTableRow(lines[i]) || isTableSeparator(lines[i]))) {
        if (!isTableSeparator(lines[i])) {
          tableLines.push(lines[i]);
        }
        i++;
      }
      output.push(renderTable(tableLines));
      continue;
    }

    // Horizontal rule
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) {
      output.push(chalk.gray("  ─────────────────────────────────────────"));
      i++;
      continue;
    }

    // Blockquote
    if (/^\s*>\s?/.test(line)) {
      const content = line.replace(/^\s*>\s?/, "");
      const rendered = renderInline(content);
      const cols = process.stdout.columns || 80;
      const prefix = chalk.yellow("  💡 ");
      const subIndent = "     ";
      output.push(wrapAnsi(chalk.italic(rendered), cols - 5, prefix, subIndent));
      i++;
      continue;
    }

    // Headers
    const headingMatch = line.match(/^(#{1,3})\s+(.*)$/);
    if (headingMatch) {
      const content = renderInline(headingMatch[2]);
      const cols = process.stdout.columns || 80;
      if (headingMatch[1].length === 1) {
        output.push(wrapAnsi(chalk.bold.underline(content), cols - 2, "  ", "  "));
      } else {
        output.push(wrapAnsi(chalk.bold(content), cols - 2, "  ", "  "));
      }
      i++;
      continue;
    }

    // ── Unordered list ───────────────────────────────────────────────
    const ulMatch = line.match(/^(\s*)[-*]\s+(.*)$/);
    if (ulMatch) {
      const indent = ulMatch[1] || "";
      const prefix = indent + chalk.gray("  • ");
      const rendered = renderInline(ulMatch[2]);
      const cols = process.stdout.columns || 80;
      const strippedPrefix = stripAnsi(prefix);
      output.push(wrapAnsi(rendered, cols - strippedPrefix.length, prefix, " ".repeat(strippedPrefix.length)));
      i++;
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^(\s*)\d+[.)]\s+(.*)$/);
    if (olMatch) {
      const indent = olMatch[1] || "";
      const num = line.match(/^(\s*)(\d+)/)[2];
      const prefix = indent + chalk.gray(`  ${num}. `);
      const rendered = renderInline(olMatch[2]);
      const cols = process.stdout.columns || 80;
      const strippedPrefix = stripAnsi(prefix);
      output.push(wrapAnsi(rendered, cols - strippedPrefix.length, prefix, " ".repeat(strippedPrefix.length)));
      i++;
      continue;
    }

    // Regular line (inline formatting only)
    if (line.trim()) {
      const rendered = renderInline(line);
      const cols = process.stdout.columns || 80;
      output.push(wrapAnsi(rendered, cols - 2, "  ", "  "));
    } else {
      output.push("");
    }
    i++;
  }

  return output.join("\n");
}

/**
 * Render inline markdown elements: **bold**, *italic*, `code`, ~~strike~~
 */
function renderInline(text) {
  if (!text) return "";
  let result = text;

  // Code spans first (protect from other transformations)
  const codeSpans = [];
  result = result.replace(/`([^`]+)`/g, (_, code) => {
    const idx = codeSpans.length;
    codeSpans.push(chalk.cyan(code));
    return `\x00CODE${idx}\x00`;
  });

  // Bold **text** or __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, t) => chalk.bold(t));
  result = result.replace(/__([^_]+)__/g, (_, t) => chalk.bold(t));

  // Italic *text* or _text_ (careful not to match mid-word underscores)
  result = result.replace(/(?<!\w)\*([^*]+)\*(?!\w)/g, (_, t) => chalk.italic(t));
  result = result.replace(/(?<!\w)_([^_]+)_(?!\w)/g, (_, t) => chalk.italic(t));

  // Strikethrough ~~text~~
  result = result.replace(/~~([^~]+)~~/g, (_, t) => chalk.strikethrough(t));

  result = result.replace(/(?<!-)\b([Nn]ormal|[Ll]ow)\b(?!-)/g, (match) => chalk.green(match));
  result = result.replace(/(?<!-)\b([Mm]oderate)\b(?!-)/g, (match) => chalk.yellow(match));
  result = result.replace(/(?<!-)\b([Hh]igh|[Cc]ritical)\b(?!-)/g, (match) => chalk.rgb(255, 80, 0)(match));

  // Restore code spans
  result = result.replace(/\x00CODE(\d+)\x00/g, (_, idx) => codeSpans[parseInt(idx, 10)]);

  return result;
}

function isTableRow(line) {
  if (!line) return false;
  const trimmed = line.trim();
  return trimmed.startsWith("|") && trimmed.endsWith("|") && trimmed.split("|").length >= 3;
}

function isTableSeparator(line) {
  if (!line) return false;
  return /^\s*\|[\s:]*[-]+[\s:]*(\|[\s:]*[-]+[\s:]*)*\|\s*$/.test(line);
}

function stripAnsi(str) {
  return str.replace(/\x1B\[\d+;?\d*m/g, "");
}

export function wrapAnsi(text, width, firstIndent, subIndent) {
  const words = text.split(/(\s+)/);
  const lines = [];
  let currentLine = "";
  let currentLength = 0;
  let isFirstLine = true;

  for (const word of words) {
    const wordLen = stripAnsi(word).length;
    if (currentLength === 0 && !word.trim()) continue;

    if (currentLength + wordLen > width) {
      if (currentLine) {
        lines.push((isFirstLine ? firstIndent : subIndent) + currentLine);
        currentLine = "";
        currentLength = 0;
        isFirstLine = false;
      }
      if (!word.trim()) continue;
    }
    currentLine += word;
    currentLength += wordLen;
  }
  if (currentLine) {
    lines.push((isFirstLine ? firstIndent : subIndent) + currentLine.trimEnd());
  }
  return lines.join("\n");
}

// Render markdown table rows as a cli-table3 table (\w rounded corners)
function renderTable(rows) {
  if (rows.length <= 1) return "";

  const parseRow = (row) =>
    row
      .split("|")
      .slice(1, -1)
      .map((cell) => cell.trim());

  const headers = parseRow(rows[0]);
  const dataRows = rows.slice(1).map(parseRow);

  const TABLE_CHARS = {
    top: "─", "top-mid": "┬", "top-left": "╭", "top-right": "╮",
    bottom: "─", "bottom-mid": "┴", "bottom-left": "╰", "bottom-right": "╯",
    left: "│", "left-mid": "├", mid: "─", "mid-mid": "┼",
    right: "│", "right-mid": "┤", middle: "│",
  };

  const table = new Table({
    chars: TABLE_CHARS,
    style: { head: [], border: ["gray"], "padding-left": 1, "padding-right": 1 },
    head: headers.map((h) => chalk.rgb(100, 200, 255).bold(renderInline(h))),
  });

  for (const row of dataRows) {
    table.push(row.map((cell) => renderInline(cell)));
  }

  return table.toString().split("\n").map((line) => "  " + line).join("\n");
}
