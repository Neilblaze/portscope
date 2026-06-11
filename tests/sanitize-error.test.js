import { describe, it } from "node:test";
import assert from "node:assert";
import { sanitizeError, sanitizeErrorObject, formatChatError } from "../src/config/sanitize-error.js";

describe("sanitizeError", () => {
  it("should redact API keys with sk- prefix", () => {
    const err = "API error: sk-1234567890abcdefghijklmnop failed";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("sk-1234567890abcdefghijklmnop"));
    assert.ok(sanitized.includes("[REDACTED_KEY]"));
  });

  it("should redact API keys with api_ prefix", () => {
    const err = "Authentication failed with api_1234567890abcdefghijklmnop";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("api_1234567890abcdefghijklmnop"));
    assert.ok(sanitized.includes("[REDACTED_KEY]"));
  });

  it("should redact API keys with key_ prefix", () => {
    const err = "Invalid key: key_1234567890abcdefghijklmnop";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("key_1234567890abcdefghijklmnop"));
    assert.ok(sanitized.includes("[REDACTED_KEY]"));
  });

  it("should redact Bearer tokens", () => {
    const err = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    assert.ok(sanitized.includes("Bearer [REDACTED_TOKEN]"));
  });

  it("should redact Authorization header values", () => {
    const err = "Request failed: Authorization: sk-1234567890abcdefghijklmnop";
    const sanitized = sanitizeError(err);
    assert.ok(sanitized.includes("Authorization: [REDACTED]"));
  });

  it("should redact x-api-key header values", () => {
    const err = "Headers: x-api-key: sk-1234567890abcdefghijklmnop";
    const sanitized = sanitizeError(err);
    assert.ok(sanitized.includes("x-api-key: [REDACTED]"));
  });

  it("should redact anthropic-api-key header values", () => {
    const err = "Headers: anthropic-api-key: sk-ant-1234567890abcdefghijklmnop";
    const sanitized = sanitizeError(err);
    assert.ok(sanitized.includes("anthropic-api-key: [REDACTED]"));
  });

  it("should redact base64 encoded strings (40+ chars)", () => {
    const err = "Credential: dGhpc2lzYXZlcnlsb25nYmFzZTY0ZW5jb2RlZHN0cmluZ3RoYXRtaWdodGJlYXNlY3JldA==";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("dGhpc2lzYXZlcnlsb25nYmFzZTY0ZW5jb2RlZHN0cmluZ3RoYXRtaWdodGJlYXNlY3JldA=="));
    assert.ok(sanitized.includes("[REDACTED_BASE64]"));
  });

  it("should redact long hex strings (32+ chars)", () => {
    const err = "Secret: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2"));
    assert.ok(sanitized.includes("[REDACTED_HEX]"));
  });

  it("should redact JWT tokens", () => {
    const err = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"));
    assert.ok(sanitized.includes("[REDACTED_JWT]"));
  });

  it("should handle Error objects", () => {
    const err = new Error("API key sk-1234567890abcdefghijklmnop is invalid");
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("sk-1234567890abcdefghijklmnop"));
    assert.ok(sanitized.includes("[REDACTED_KEY]"));
  });

  it("should handle string errors", () => {
    const err = "Connection failed with key_1234567890abcdefghijklmnop";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("key_1234567890abcdefghijklmnop"));
    assert.ok(sanitized.includes("[REDACTED_KEY]"));
  });

  it("should preserve non-sensitive error messages", () => {
    const err = "Connection timeout after 30s";
    const sanitized = sanitizeError(err);
    assert.strictEqual(sanitized, "Connection timeout after 30s");
  });

  it("should handle multiple secrets in one message", () => {
    const err = "Failed: sk-1234567890abcdefghijklmnop and api_9876543210zyxwvutsrqponmlk";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("sk-1234567890abcdefghijklmnop"));
    assert.ok(!sanitized.includes("api_9876543210zyxwvutsrqponmlk"));
    assert.strictEqual((sanitized.match(/\[REDACTED_KEY\]/g) || []).length, 2);
  });

  it("should be case-insensitive for key patterns", () => {
    const err = "Error with SK-1234567890ABCDEFGHIJKLMNOP";
    const sanitized = sanitizeError(err);
    assert.ok(!sanitized.includes("SK-1234567890ABCDEFGHIJKLMNOP"));
    assert.ok(sanitized.includes("[REDACTED_KEY]"));
  });

  it("should not redact short strings that match prefixes", () => {
    const err = "sk-short is too short";
    const sanitized = sanitizeError(err);
    assert.ok(sanitized.includes("sk-short"));
  });
});

describe("sanitizeErrorObject", () => {
  it("should sanitize error message", () => {
    const err = new Error("API key sk-1234567890abcdefghijklmnop failed");
    const sanitized = sanitizeErrorObject(err);
    assert.ok(!sanitized.message.includes("sk-1234567890abcdefghijklmnop"));
    assert.ok(sanitized.message.includes("[REDACTED_KEY]"));
  });

  it("should preserve error name and code", () => {
    const err = new Error("Test error");
    err.name = "ValidationError";
    err.code = "INVALID_INPUT";
    const sanitized = sanitizeErrorObject(err);
    assert.strictEqual(sanitized.name, "ValidationError");
    assert.strictEqual(sanitized.code, "INVALID_INPUT");
  });

  it("should sanitize stack trace", () => {
    const err = new Error("API key sk-1234567890abcdefghijklmnop failed");
    err.stack = "Error: API key sk-1234567890abcdefghijklmnop failed\n    at test.js:10:5";
    const sanitized = sanitizeErrorObject(err);
    assert.ok(!sanitized.stack.includes("sk-1234567890abcdefghijklmnop"));
    assert.ok(sanitized.stack.includes("[REDACTED_KEY]"));
  });

  it("should sanitize nested cause errors", () => {
    const cause = new Error("Inner error with api_1234567890abcdefghijklmnop");
    const err = new Error("Outer error");
    err.cause = cause;
    const sanitized = sanitizeErrorObject(err);
    assert.ok(!sanitized.cause.message.includes("api_1234567890abcdefghijklmnop"));
    assert.ok(sanitized.cause.message.includes("[REDACTED_KEY]"));
  });

  it("should handle null error", () => {
    const sanitized = sanitizeErrorObject(null);
    assert.strictEqual(sanitized, null);
  });
});

describe("formatChatError", () => {
  it("formats invalid model errors", () => {
    const err = new Error("Model does not exist");
    const result = formatChatError(err);
    assert.ok(result.includes("Invalid Model"));
    assert.ok(result.includes("Model does not exist"));
  });

  it("formats auth failed errors", () => {
    const err = new Error("Incorrect API key provided");
    const result = formatChatError(err);
    assert.ok(result.includes("Auth Failed"));
    assert.ok(result.includes("Incorrect API key provided"));
  });

  it("formats provider down errors", () => {
    const err = new Error("Server returned 502 Bad Gateway");
    const result = formatChatError(err);
    assert.ok(result.includes("Provider Down"));
  });

  it("formats timeout errors", () => {
    const err = new Error("Request timed out");
    const result = formatChatError(err);
    assert.ok(result.includes("Timeout"));
  });

  it("formats offline errors", () => {
    const err = new Error("ECONNREFUSED 127.0.0.1:11434");
    const result = formatChatError(err);
    assert.ok(result.includes("Offline"));
  });

  it("formats rate limit errors", () => {
    const err = new Error("Rate limit exceeded 429");
    const result = formatChatError(err);
    assert.ok(result.includes("Rate Limited"));
  });

  it("formats generic API errors", () => {
    const err = new Error("Some weird unexpected error");
    const result = formatChatError(err);
    assert.ok(result.includes("API Error"));
  });
});
