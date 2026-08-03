import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { PROVIDER_DEFAULTS, PROVIDER_IDS, BUILTIN_PROVIDER_IDS, DEFAULT_CONFIG } from "../src/config/schema.js";

describe("PROVIDER_DEFAULTS", () => {
  it("has entries for all PROVIDER_IDS", () => {
    for (const id of PROVIDER_IDS) {
      assert.ok(PROVIDER_DEFAULTS[id], `Missing PROVIDER_DEFAULTS entry for "${id}"`);
    }
  });

  it("each built-in provider has required fields", () => {
    for (const id of BUILTIN_PROVIDER_IDS) {
      const p = PROVIDER_DEFAULTS[id];
      assert.ok(p.model, `${id} missing model`);
      assert.ok(p.baseUrl, `${id} missing baseUrl`);
      assert.ok(p.label, `${id} missing label`);
    }
  });

  it("cloud providers have envKey, Ollama does not", () => {
    const cloudProviders = BUILTIN_PROVIDER_IDS.filter((id) => id !== "ollama");
    for (const id of cloudProviders) {
      assert.ok(PROVIDER_DEFAULTS[id].envKey, `${id} should have envKey`);
    }
    assert.equal(PROVIDER_DEFAULTS.ollama.envKey, null, "Ollama should not have envKey");
  });

  it("Ollama uses localhost URLs", () => {
    assert.ok(PROVIDER_DEFAULTS.ollama.baseUrl.includes("localhost:11434"));
    assert.ok(PROVIDER_DEFAULTS.ollama.modelsUrl.includes("localhost:11434"));
  });
});

describe("PROVIDER_IDS", () => {
  it("starts out as the built-in list", () => {
    assert.deepEqual(PROVIDER_IDS, [...BUILTIN_PROVIDER_IDS]);
  });

  it("includes all expected providers", () => {
    assert.ok(PROVIDER_IDS.includes("anthropic"));
    assert.ok(PROVIDER_IDS.includes("openai"));
    assert.ok(PROVIDER_IDS.includes("gemini"));
    assert.ok(PROVIDER_IDS.includes("openrouter"));
    assert.ok(PROVIDER_IDS.includes("nvidia"));
    assert.ok(PROVIDER_IDS.includes("cerebras"));
    assert.ok(PROVIDER_IDS.includes("groq"));
    assert.ok(PROVIDER_IDS.includes("ollama"));
  });

  it("has exactly 8 built-in providers", () => {
    assert.equal(BUILTIN_PROVIDER_IDS.length, 8);
  });
});

describe("DEFAULT_CONFIG", () => {
  it("has ai section with expected defaults", () => {
    assert.ok(DEFAULT_CONFIG.ai);
    assert.equal(DEFAULT_CONFIG.ai.provider, "anthropic");
    assert.equal(DEFAULT_CONFIG.ai.model, null);
    assert.equal(DEFAULT_CONFIG.ai.maxTokens, 4096);
  });

  it("has display section", () => {
    assert.ok(DEFAULT_CONFIG.display);
    assert.equal(DEFAULT_CONFIG.display.showBanner, true);
  });
});
