import { describe, it } from "node:test";
import assert from "node:assert";
import { formatEnvironment } from "../src/ui/format.js";

describe("formatEnvironment", () => {
  it("formats development environment", () => {
    const result = formatEnvironment("development");
    assert.ok(result.includes("dev"));
  });

  it("formats production environment", () => {
    const result = formatEnvironment("production");
    assert.ok(result.includes("prod"));
  });

  it("formats test environment", () => {
    const result = formatEnvironment("test");
    assert.ok(result.includes("test"));
  });

  it("formats staging environment", () => {
    const result = formatEnvironment("staging");
    assert.ok(result.includes("stage"));
  });

  it("returns dash for null environment", () => {
    const result = formatEnvironment(null);
    assert.ok(result.includes("—"));
  });

  it("returns dash for unknown environment", () => {
    const result = formatEnvironment("unknown");
    assert.ok(result.includes("—"));
  });

  it("truncates long environment names", () => {
    const result = formatEnvironment("verylongenvironmentname");
    // Should be truncated to 5 chars
    assert.ok(result.length < 20); // With ANSI codes
  });
});
