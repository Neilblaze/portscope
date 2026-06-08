import { describe, it } from "node:test";
import assert from "node:assert";
import { maskApiKey } from "../src/config/mask.js";


describe("maskApiKey", () => {
  it("should mask long API keys (>15 chars) showing first 5 and last 4", () => {
    const key = "sk-1234567890abcdefghijklmnop";
    const masked = maskApiKey(key);
    assert.strictEqual(masked, "sk-12********************mnop");
    assert.strictEqual(masked.length, key.length);
  });

  it("should mask medium API keys (<=15 chars) showing first 3 and last 2", () => {
    const key = "abc123xyz789def";
    const masked = maskApiKey(key);
    assert.strictEqual(masked, "abc**********ef");
    assert.strictEqual(masked.length, key.length);
  });

  it("should mask very short keys (<=5 chars) completely", () => {
    const key = "short";
    const masked = maskApiKey(key);
    assert.strictEqual(masked, "*****");
  });

  it("should not mask 'local' keyword for ollama", () => {
    const key = "local";
    const masked = maskApiKey(key);
    assert.strictEqual(masked, "local");
  });

  it("should handle empty strings", () => {
    const masked = maskApiKey("");
    assert.strictEqual(masked, "");
  });

  it("should handle null/undefined", () => {
    assert.strictEqual(maskApiKey(null), "");
    assert.strictEqual(maskApiKey(undefined), "");
  });

  it("should mask typical OpenAI API key format", () => {
    const key = "sk-proj-abcdefghijklmnopqrstuvwxyz1234567890";
    const masked = maskApiKey(key);
    assert.strictEqual(masked.slice(0, 5), "sk-pr");
    assert.strictEqual(masked.slice(-4), "7890");
    assert.ok(masked.includes("*"));
  });

  it("should mask typical Anthropic API key format", () => {
    const key = "sk-ant-api03-1234567890abcdefghijklmnopqrstuvwxyz";
    const masked = maskApiKey(key);
    assert.strictEqual(masked.slice(0, 5), "sk-an");
    assert.strictEqual(masked.slice(-4), "wxyz");
    assert.ok(masked.includes("*"));
  });

  it("should mask typical Google Gemini API key format", () => {
    const key = "AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567";
    const masked = maskApiKey(key);
    assert.strictEqual(masked.slice(0, 5), "AIzaS");
    assert.strictEqual(masked.slice(-4), "4567");
    assert.ok(masked.includes("*"));
  });

  it("should preserve total length for short keys, or cap at 32 chars", () => {
    const keys = [
      "sk-1234567890abcdefghijklmnop",
      "short",
      "mediumlength123",
      "AIzaSyAbCdEfGhIjKlMnOpQrStUvWxYz1234567",
    ];

    for (const key of keys) {
      const masked = maskApiKey(key);
      const expectedLength = Math.min(key.length, 32);
      assert.strictEqual(masked.length, expectedLength, `Length mismatch for key: ${key}`);
    }
  });
});
