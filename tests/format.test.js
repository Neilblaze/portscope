import { describe, it } from "node:test";
import assert from "node:assert";
import { formatEnvironment, formatFramework, formatStatus, truncate, padToWidth } from "../src/ui/format.js";

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

describe("formatFramework", () => {
  it("formats known frameworks", () => {
    const nextjs = formatFramework("Next.js");
    const vite = formatFramework("Vite");
    
    assert.ok(nextjs.includes("Next.js"));
    assert.ok(vite.includes("Vite"));
  });

  it("handles unknown frameworks", () => {
    const result = formatFramework("UnknownFramework123");
    assert.ok(result.includes("UnknownFramework123"));
  });

  it("returns dash for null/empty framework", () => {
    assert.ok(formatFramework(null).includes("—"));
    assert.ok(formatFramework("").includes("—"));
    assert.ok(formatFramework(undefined).includes("—"));
  });
});

describe("formatStatus", () => {
  it("formats healthy status", () => {
    const result = formatStatus("healthy");
    assert.ok(result.includes("healthy"));
  });

  it("formats orphaned status", () => {
    const result = formatStatus("orphaned");
    assert.ok(result.includes("orphaned"));
  });

  it("formats unknown status", () => {
    const result = formatStatus("nonexistent_status");
    assert.ok(result.includes("unknown"));
  });
});

describe("truncate", () => {
  it("truncates long strings and adds ellipsis", () => {
    const str = "hello world";
    assert.strictEqual(truncate(str, 8), "hello w…");
  });

  it("does not truncate short strings", () => {
    const str = "hello";
    assert.strictEqual(truncate(str, 10), "hello");
  });

  it("handles empty/null strings", () => {
    assert.strictEqual(truncate("", 10), "");
    assert.strictEqual(truncate(null, 10), "");
    assert.strictEqual(truncate(undefined, 10), "");
  });
});

describe("padToWidth", () => {
  it("pads strings to target width", () => {
    assert.strictEqual(padToWidth("hello", 10), "hello     ");
  });

  it("does not pad if string is already longer", () => {
    assert.strictEqual(padToWidth("hello world", 5), "hello world");
  });
});
