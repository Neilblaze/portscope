import { describe, it } from "node:test";
import assert from "node:assert/strict";
import chalk from "chalk";
import { renderMarkdown } from "../src/ui/markdown.js";

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
    assert.ok(result.includes(chalk.gray("  • ") + "item 1"));
    assert.ok(result.includes(chalk.gray("  • ") + "item 2"));
  });

  it("handles mixed formatting", () => {
    const result = renderMarkdown("Kill **PID** `1234`");
    assert.equal(result, `  Kill ${chalk.bold("PID")} ${chalk.cyan("1234")}`);
  });
});
