import { describe, it } from "node:test";
import assert from "node:assert/strict";
import chalk from "chalk";
import { renderMarkdown, stripAnsi } from "../src/ui/markdown.js";

describe("renderMarkdown", () => {
  it("renders bold text", () => {
    assert.equal(renderMarkdown("**hello**"), "  " + chalk.bold("hello"));
  });

  it("renders italic text", () => {
    assert.equal(renderMarkdown("*hello*"), "  " + chalk.italic("hello"));
  });

  it("renders code blocks and inline code", () => {
    assert.equal(renderMarkdown("`code`"), "  " + chalk.cyan("code"));
  });

  it("handles null or empty input", () => {
    assert.equal(renderMarkdown(""), "");
    assert.equal(renderMarkdown(null), "");
    assert.equal(renderMarkdown(undefined), "");
  });

  it("renders headers", () => {
    const result = renderMarkdown("# Title");
    assert.ok(result.includes("  " + chalk.bold.underline("Title")));
  });

  it("renders lists", () => {
    const result = renderMarkdown("- item 1\n- item 2");
    assert.ok(result.includes("  " + chalk.gray("• ") + "item 1"));
    assert.ok(result.includes("  " + chalk.gray("• ") + "item 2"));
  });

  it("handles mixed formatting", () => {
    const result = renderMarkdown("Kill **PID** `1234`");
    assert.equal(result, `  Kill ${chalk.bold("PID")} ${chalk.cyan("1234")}`);
  });
});

describe("emoji heading hanging indent", () => {
  const bulletCol = (line) => stripAnsi(line).indexOf("•");
  const textCol = (line, ch) => stripAnsi(line).indexOf(ch);

  it("aligns bullets under the heading text, not its emoji", () => {
    const out = renderMarkdown("🔍 **Port & Process Management**\n- List ports\n- Inspect ports");
    const [heading, ...bullets] = out.split("\n");
    // "🔍 " occupies 3 columns, so "P" and "•" must share a column.
    assert.equal(textCol(heading, "P"), bulletCol(bullets[0]));
    assert.equal(bulletCol(bullets[0]), bulletCol(bullets[1]));
  });

  it("treats a VS16 emoji as double-width", () => {
    const out = renderMarkdown("⚙️ **Config**\n- /provider");
    const [heading, bullet] = out.split("\n");
    assert.equal(textCol(heading, "C"), bulletCol(bullet));
  });

  it("leaves lists under plain headings flush", () => {
    const out = renderMarkdown("Plain heading\n- one\n- two");
    for (const line of out.split("\n").slice(1)) {
      assert.equal(bulletCol(line), 2, "should keep the default two-space indent");
    }
  });

  it("does not leak the indent past the emoji section", () => {
    const out = renderMarkdown("🔍 **Section**\n- indented\n\nPlain again\n- flush");
    const lines = out.split("\n");
    assert.equal(bulletCol(lines[1]), 5, "bullet under the emoji heading hangs");
    assert.equal(bulletCol(lines[lines.length - 1]), 2, "bullet under a plain line does not");
  });

  it("keeps nested-list indentation additive", () => {
    const out = renderMarkdown("🔍 **Section**\n- top\n  - nested");
    const [, top, nested] = out.split("\n");
    assert.equal(bulletCol(nested) - bulletCol(top), 2, "nesting still adds two columns");
  });

  it("ignores a trailing emoji", () => {
    const out = renderMarkdown("All done! 🚀\n- still flush");
    assert.equal(bulletCol(out.split("\n")[1]), 2);
  });

  it("applies to ordered lists too", () => {
    const out = renderMarkdown("📊 **Steps**\n1. first\n2. second");
    const lines = out.split("\n").map(stripAnsi);
    assert.equal(lines[0].indexOf("S"), lines[1].indexOf("1"));
    assert.equal(lines[1].indexOf("1"), lines[2].indexOf("2"));
  });
});

describe("port status cells", () => {
  it("colours the dot and label to match native output", () => {
    assert.equal(renderMarkdown("● healthy"), "  " + chalk.green("●") + " " + chalk.green("healthy"));
    assert.equal(renderMarkdown("● orphaned"), "  " + chalk.yellow("●") + " " + chalk.yellow("orphaned"));
    assert.equal(renderMarkdown("● zombie"), "  " + chalk.red("●") + " " + chalk.red("zombie"));
    assert.equal(renderMarkdown("● unknown"), "  " + chalk.gray("●") + " " + chalk.gray("unknown"));
  });

  it("keeps table columns aligned once coloured", () => {
    const out = renderMarkdown(
      "| Port | Status |\n|---|---|\n| :3000 | ● healthy |\n| :3001 | ● orphaned |",
    );
    const widths = new Set(stripAnsi(out).split("\n").map((l) => l.length));
    assert.equal(widths.size, 1, "every table row should be the same visible width");
  });

  it("leaves a bare status word untouched", () => {
    assert.equal(renderMarkdown("healthy"), "  healthy");
  });
});
