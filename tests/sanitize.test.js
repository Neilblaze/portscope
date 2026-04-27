import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assertSafeInt, sanitizePath } from "../src/scanner/sanitize.js";

describe("assertSafeInt", () => {
  it("allows valid positive integers", () => {
    assert.equal(assertSafeInt(1234), 1234);
    assert.equal(assertSafeInt("8080"), 8080);
    assert.equal(assertSafeInt(0), 0);
  });

  it("throws on negative integers", () => {
    assert.throws(() => assertSafeInt(-1), /Invalid numeric argument/);
  });

  it("throws on floats", () => {
    assert.throws(() => assertSafeInt(3.14), /Invalid numeric argument/);
  });

  it("throws on non-numeric strings", () => {
    assert.throws(() => assertSafeInt("abc"), /Invalid numeric argument/);
    assert.throws(() => assertSafeInt("123; rm -rf /"), /Invalid numeric argument/);
  });
});

describe("sanitizePath", () => {
  it("allows safe paths", () => {
    const safe1 = "/var/log/system.log";
    const safe2 = "C:\\Logs\\app.log";
    assert.equal(sanitizePath(safe1), safe1);
    assert.equal(sanitizePath(safe2), safe2);
  });

  it("throws on shell metacharacters", () => {
    assert.throws(() => sanitizePath("/var/log/sys; rm -rf /"), /Unsafe characters in path/);
    assert.throws(() => sanitizePath("/var/log/sys & echo 1"), /Unsafe characters in path/);
    assert.throws(() => sanitizePath("/var/log/sys | cat"), /Unsafe characters in path/);
    assert.throws(() => sanitizePath("/var/log/sys\n"), /Unsafe characters in path/);
    assert.throws(() => sanitizePath("$(cat /etc/passwd)"), /Unsafe characters in path/);
    assert.throws(() => sanitizePath("`cat /etc/passwd`"), /Unsafe characters in path/);
  });
});
