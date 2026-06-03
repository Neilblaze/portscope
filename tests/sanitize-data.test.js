import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeText, sanitizeForAI } from "../src/config/sanitize-data.js";


describe("sanitizeText", () => {
  it("redacts API keys with sk- prefix", () => {
    const input = "Error: sk-1234567890abcdefghijklmnop failed";
    const result = sanitizeText(input);
    assert.ok(!result.includes("sk-1234567890abcdefghijklmnop"));
    assert.ok(result.includes("[REDACTED_KEY]"));
  });

  it("redacts API keys with api_ prefix", () => {
    const input = "Key: api_1234567890abcdefghijklmnop";
    const result = sanitizeText(input);
    assert.ok(!result.includes("api_1234567890abcdefghijklmnop"));
    assert.ok(result.includes("[REDACTED_KEY]"));
  });

  it("redacts Bearer tokens", () => {
    const input = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9token1234";
    const result = sanitizeText(input);
    assert.ok(result.includes("Bearer [REDACTED_TOKEN]"));
  });

  it("redacts JWT tokens", () => {
    const input = "Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    const result = sanitizeText(input);
    assert.ok(result.includes("[REDACTED_JWT]"));
  });

  it("redacts PostgreSQL connection strings (bare)", () => {
    const input = "Connecting to postgres://admin:s3cr3t_pass@db.example.com:5432/mydb";
    const result = sanitizeText(input);
    assert.ok(!result.includes("s3cr3t_pass"), "Password should be redacted");
    assert.ok(result.includes("[REDACTED]"), "Should contain REDACTED marker");
    assert.ok(result.includes("db.example.com"), "Host should be preserved");
  });

  it("redacts DATABASE_URL as a sensitive env var", () => {
    const input = "DATABASE_URL=postgres://admin:s3cr3t_pass@db.example.com:5432/mydb";
    const result = sanitizeText(input);
    assert.ok(!result.includes("s3cr3t_pass"), "Password should be redacted");
    assert.ok(result.includes("DATABASE_URL=[REDACTED]"), "Entire value should be redacted via env-var rule");
  });

  it("redacts MongoDB connection strings", () => {
    const input = "MONGO_URI=mongodb+srv://user:password123@cluster.mongodb.net/db";
    const result = sanitizeText(input);
    assert.ok(!result.includes("password123"));
  });

  it("redacts Redis connection strings", () => {
    const input = "REDIS_URL=redis://default:mysecret@redis.example.com:6379";
    const result = sanitizeText(input);
    assert.ok(!result.includes("mysecret"));
  });

  it("redacts sensitive environment variable assignments", () => {
    const input = 'API_KEY=sk_live_abc123def456ghi789 APP_NAME=myapp';
    const result = sanitizeText(input);
    assert.ok(result.includes("API_KEY=[REDACTED]"));
    assert.ok(result.includes("APP_NAME=myapp"), "Non-sensitive vars should be kept");
  });

  it("redacts DATABASE_URL values", () => {
    const input = 'DATABASE_URL="postgres://user:pass@host:5432/db"';
    const result = sanitizeText(input);
    assert.ok(result.includes("DATABASE_URL=[REDACTED]"));
  });

  it("redacts JWT_SECRET values", () => {
    const input = "JWT_SECRET=my_super_secret_jwt_key_123";
    const result = sanitizeText(input);
    assert.ok(result.includes("JWT_SECRET=[REDACTED]"));
  });

  it("redacts PEM private key blocks", () => {
    const input = `Here is a key:
    -----BEGIN RSA PRIVATE KEY-----
    MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn/ygWyF8PbnGcY5unA67hqxnfZ
    -----END RSA PRIVATE KEY-----
    and some more text`;
    const result = sanitizeText(input);
    assert.ok(result.includes("[REDACTED_PRIVATE_KEY]"));
    assert.ok(!result.includes("MIIEowIBAAKCAQEA0Z3VS5JJcds3xfn"));
  });

  it("redacts AWS access key IDs", () => {
    const input = "AWS key: AKIAIOSFODNN7EXAMPLE";
    const result = sanitizeText(input);
    assert.ok(result.includes("[REDACTED_AWS_KEY]"));
    assert.ok(!result.includes("AKIAIOSFODNN7EXAMPLE"));
  });

  it("redacts long hex strings (40+ chars)", () => {
    const hex = "a".repeat(40);
    const input = `Secret: ${hex}`;
    const result = sanitizeText(input);
    assert.ok(result.includes("[REDACTED_HEX]"));
  });

  it("preserves normal log content", () => {
    const input = "[2024-01-15 10:30:22] INFO: Server started on port 3000";
    const result = sanitizeText(input);
    assert.strictEqual(result, input);
  });

  it("preserves error messages without secrets", () => {
    const input = "Error: ECONNREFUSED 127.0.0.1:5432";
    const result = sanitizeText(input);
    assert.strictEqual(result, input);
  });

  it("preserves stack traces without secrets", () => {
    const input = "  at Server.listen (/app/server.js:42:10)\n  at Object.<anonymous> (/app/index.js:15:1)";
    const result = sanitizeText(input);
    assert.strictEqual(result, input);
  });

  it("handles custom patterns", () => {
    const input = "Company data: internal.corp.example.com/secret-endpoint";
    const customPatterns = [/internal\.corp\.example\.com[^\s]*/gi];
    const result = sanitizeText(input, customPatterns);
    assert.ok(result.includes("[REDACTED_CUSTOM]"));
    assert.ok(!result.includes("internal.corp.example.com"));
  });

  it("handles invalid custom patterns gracefully", () => {
    const input = "some text";
    // Invalid regex string — should be skipped silently
    const result = sanitizeText(input, ["[invalid regex"]);
    assert.strictEqual(result, input);
  });

  it("does not redact short strings that match key prefixes", () => {
    const input = "sk-short is fine";
    const result = sanitizeText(input);
    assert.ok(result.includes("sk-short"));
  });
});


describe("sanitizeForAI", () => {
  it("sanitizes string values in objects", () => {
    const data = {
      file: "/var/log/app.log",
      content: "Error with sk-1234567890abcdefghijklmnop",
    };
    const result = sanitizeForAI(data);
    assert.ok(!result.content.includes("sk-1234567890abcdefghijklmnop"));
    assert.strictEqual(result.file, "/var/log/app.log");
  });

  it("sanitizes nested objects recursively", () => {
    const data = {
      port: { command: "node server.js API_KEY=secret_key_1234567890abcdef" },
    };
    const result = sanitizeForAI(data);
    assert.ok(result.port.command.includes("[REDACTED]"));
  });

  it("sanitizes arrays", () => {
    const data = [
      { content: "key_1234567890abcdefghijklmnop" },
      { content: "normal text" },
    ];
    const result = sanitizeForAI(data);
    assert.ok(result[0].content.includes("[REDACTED_KEY]"));
    assert.strictEqual(result[1].content, "normal text");
  });

  it("passes through numbers and booleans", () => {
    assert.strictEqual(sanitizeForAI(42), 42);
    assert.strictEqual(sanitizeForAI(true), true);
  });

  it("handles null and undefined", () => {
    assert.strictEqual(sanitizeForAI(null), null);
    assert.strictEqual(sanitizeForAI(undefined), undefined);
  });

  it("does not mutate the original data", () => {
    const original = { content: "sk-1234567890abcdefghijklmnop" };
    const copy = JSON.stringify(original);
    sanitizeForAI(original);
    assert.strictEqual(JSON.stringify(original), copy);
  });

  it("applies custom patterns", () => {
    const data = { log: "secret: internal-domain.example.com" };
    const result = sanitizeForAI(data, [/internal-domain\.example\.com/gi]);
    assert.ok(result.log.includes("[REDACTED_CUSTOM]"));
  });
});
