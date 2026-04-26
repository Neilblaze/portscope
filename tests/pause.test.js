import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { sendSignal } from "../src/commands/pause.js";

describe("sendSignal", () => {
  it("returns true when signal is sent successfully to own PID (SIGCONT is safe)", () => {
    // SIGCONT to our own process is a no-op but demonstrates the signal path
    const result = sendSignal(process.pid, "SIGCONT");
    assert.equal(result, true);
  });

  it("returns false for a nonexistent PID", () => {
    // PID 99999999 almost certainly doesn't exist
    const result = sendSignal(99999999, "SIGCONT");
    assert.equal(result, false);
  });

  it("returns false for invalid signal on nonexistent PID", () => {
    const result = sendSignal(99999999, "SIGSTOP");
    assert.equal(result, false);
  });
});
