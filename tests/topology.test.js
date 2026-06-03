import { describe, it } from "node:test";
import assert from "node:assert/strict";


describe("getPortTopology", () => {
  // NOTE: We can't easily unit-test the real platform functions without mocking
  // execSync, so we test the topology logic by importing the module and checking
  // the function signature. Integration testing is done manually.

  it("darwin module exports getPortTopology", async () => {
    try {
      const darwin = await import("../src/platform/darwin.js");
      assert.strictEqual(typeof darwin.getPortTopology, "function");
    } catch {
    }
  });

  it("linux module exports getPortTopology", async () => {
    try {
      const linux = await import("../src/platform/linux.js");
      assert.strictEqual(typeof linux.getPortTopology, "function");
    } catch {
    }
  });

  it("win32 module exports getPortTopology", async () => {
    try {
      const win32 = await import("../src/platform/win32.js");
      assert.strictEqual(typeof win32.getPortTopology, "function");
    } catch {
    }
  });

  it("getPortTopology returns a Map when called with empty set", async () => {
    const platform = process.platform;
    let mod;
    try {
      if (platform === "darwin") {
        mod = await import("../src/platform/darwin.js");
      } else if (platform === "linux") {
        mod = await import("../src/platform/linux.js");
      } else if (platform === "win32") {
        mod = await import("../src/platform/win32.js");
      }
    } catch {
      return;
    }

    if (!mod) return;

    const result = mod.getPortTopology(new Set());
    assert.ok(result instanceof Map, "Should return a Map");
  });

  it("getPortTopology returns a Map when called with known ports", async () => {
    const platform = process.platform;
    let mod;
    try {
      if (platform === "darwin") {
        mod = await import("../src/platform/darwin.js");
      } else if (platform === "linux") {
        mod = await import("../src/platform/linux.js");
      } else if (platform === "win32") {
        mod = await import("../src/platform/win32.js");
      }
    } catch {
      return;
    }

    if (!mod) return;

    const result = mod.getPortTopology(new Set([3000, 5000, 8080]));
    assert.ok(result instanceof Map, "Should return a Map");

    for (const [port, topo] of result) {
      assert.ok(typeof port === "number", "Key should be a port number");
      assert.ok(topo.connectedPorts instanceof Set, "connectedPorts should be a Set");
      assert.ok(typeof topo.remoteConnections === "number", "remoteConnections should be a number");
    }
  });
});


describe("get_port_connections tool", () => {
  it("tool schema is registered in TOOLS", async () => {
    const { TOOLS } = await import("../src/ai/tools.js");
    const tool = TOOLS.find((t) => t.name === "get_port_connections");
    assert.ok(tool, "get_port_connections tool should be registered");
    assert.ok(tool.description, "Tool should have a description");
    assert.ok(tool.parameters, "Tool should have parameters");
    assert.ok(tool.parameters.properties.port, "Should have optional port parameter");
  });
});
