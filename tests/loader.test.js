import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getApiKeyForProvider } from "../src/config/loader.js";

describe("getApiKeyForProvider", () => {
  it("returns local for ollama", () => {
    assert.equal(getApiKeyForProvider("ollama"), "local");
  });

  it("returns null for unknown provider", () => {
    assert.equal(getApiKeyForProvider("unknown_provider_123"), null);
  });
});
